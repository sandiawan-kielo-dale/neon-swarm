// The screenshot scenes behind ?shot=start|play|boss|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot,
// so the frame is what a real game looks like and the same seed always gives the same frame.
import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 20;
const BOSS_SECONDS = 20;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/**
 * Steer the ship. Modes:
 * - 'skilled': flee the nearest bullets and close enemies, drift toward the
 *   nearest enemy to shoot it, and stay inside the field.
 * - 'clumsy': only reacts to threats that are already very close, so it gets
 *   caught out — that is the end scene.
 * - 'reckless': charges straight at the nearest enemy and never dodges, so it
 *   trades lives for kills and always dies.
 */
export function autopilot(state, mode) {
  const p = state.player;
  if (!p || !p.alive) return { mx: 0, my: 0, aimX: p ? p.x : 0, aimY: 0, firing: false };
  const clumsy = mode === 'clumsy';
  const reckless = mode === 'reckless';
  const sense = clumsy ? 70 : 170;
  let fx = 0;
  let fy = 0;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < nearestD) { nearestD = d; nearest = e; }
  }
  if (reckless) {
    if (nearest) {
      fx = (nearest.x - p.x) / (nearestD || 1);
      fy = (nearest.y - p.y) / (nearestD || 1);
    }
    return {
      mx: fx,
      my: fy,
      aimX: nearest ? nearest.x : p.x,
      aimY: nearest ? nearest.y : p.y - 100,
      firing: true,
    };
  }
  for (const b of state.enemyBullets) {
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d < sense && d > 1) {
      const w = (sense - d) / sense;
      fx += (dx / d) * w * 2.2;
      fy += (dy / d) * w * 2.2;
    }
  }
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 110 && d > 1) {
      const w = (110 - d) / 110;
      fx += (dx / d) * w * 1.6;
      fy += (dy / d) * w * 1.6;
    }
  }
  if (nearest && nearestD > 300) {
    fx += ((nearest.x - p.x) / nearestD) * 0.9;
    fy += ((nearest.y - p.y) / nearestD) * 0.9;
  }
  // Keep off the walls.
  const margin = 60;
  if (p.x < margin) fx += (margin - p.x) / margin;
  if (p.x > FIELD.width - margin) fx -= (p.x - (FIELD.width - margin)) / margin;
  if (p.y < margin) fy += (margin - p.y) / margin;
  if (p.y > FIELD.height - margin) fy -= (p.y - (FIELD.height - margin)) / margin;
  const len = Math.hypot(fx, fy);
  if (len > 1) { fx /= len; fy /= len; }
  return {
    mx: fx,
    my: fy,
    aimX: nearest ? nearest.x : p.x,
    aimY: nearest ? nearest.y : p.y - 100,
    firing: true,
  };
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names behave like start.
 */
export function stageShot(name, world) {
  if (name === 'boss') {
    world.jumpToWave(5);
    for (let i = 0; i < BOSS_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 'skilled'), false);
      if (world.state.lives === 0) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'play') {
    world.reset(false);
    for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 'skilled'), false);
      if (world.state.lives === 0) break;
    }
    const over = world.state.lives === 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.reset(false);
    // A hurried player: reacts only to threats that are already very close.
    // After 90 seconds it stops dodging and charges the swarm instead, trading
    // lives for kills, so the scene always ends on a real game over.
    let i = 0;
    for (; i < 90 / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 'clumsy'), false);
      if (world.state.lives === 0) break;
    }
    for (; i < END_LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 'reckless'), false);
      if (world.state.lives === 0) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  world.reset(true);
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, 'skilled'), true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
