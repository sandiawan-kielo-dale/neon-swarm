// The game world: player, enemies, bullets, power-ups, particles, waves, scoring.
// Pure simulation — no DOM, no canvas — so it can be stepped deterministically in
// tests and in the ?shot= scenes. All randomness flows through the seeded rng.
import { FIELD, STEP, PLAYER, ENEMY, POWERUP, COMBO_WINDOW, WAVE_BREATHER } from './config.js';
import { pick, range } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;
export const EVENT_BOSS = 8;

export const KIND = {
  drone: 'drone',
  weaver: 'weaver',
  gunner: 'gunner',
  splitter: 'splitter',
  asteroid: 'asteroid',
  boss: 'boss',
};

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(rng) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      wave: 0,
      waveState: 'breather', // 'breather' | 'fighting' | 'clear'
      waveTimer: 1.2,
      spawnQueue: [],
      spawnTimer: 0,
      score: 0,
      best: 0,
      combo: 0,
      comboTimer: 0,
      multiplier: 1,
      kills: 0,
      lives: PLAYER.lives,
      player: null,
      bullets: [],
      enemyBullets: [],
      enemies: [],
      powerups: [],
      particles: [],
      popups: [],
      shake: 0,
      boss: null,
      banner: '',
      bannerTimer: 0,
      flash: 0,
    };
  }

  function makePlayer() {
    return {
      x: FIELD.width / 2,
      y: FIELD.height * 0.72,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      fireTimer: 0,
      invuln: 2,
      alive: true,
      respawnTimer: 0,
      spreadUntil: 0,
      rapidUntil: 0,
      shieldUntil: 0,
      thrust: 0,
    };
  }

  function spawnPoint(minPlayerDist) {
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(rng() * 4);
      let x;
      let y;
      if (edge === 0) { x = range(rng, 40, FIELD.width - 40); y = -30; }
      else if (edge === 1) { x = range(rng, 40, FIELD.width - 40); y = FIELD.height + 30; }
      else if (edge === 2) { x = -30; y = range(rng, 40, FIELD.height - 40); }
      else { x = FIELD.width + 30; y = range(rng, 40, FIELD.height - 40); }
      const p = state.player;
      if (!p || !p.alive || dist2(x, y, p.x, p.y) > minPlayerDist * minPlayerDist) return { x, y };
    }
    return { x: FIELD.width / 2, y: -30 };
  }

  function addEnemy(kind, x, y) {
    const def = ENEMY[kind];
    const hpScale = 1 + Math.max(0, state.wave - 1) * 0.08;
    const enemy = {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      radius: def.radius,
      hp: Math.round(def.hp * (kind === 'boss' ? 1 + state.wave * 0.12 : hpScale)),
      maxHp: 0,
      speed: def.speed * (1 + Math.min(0.6, state.wave * 0.03)),
      score: def.score,
      color: def.color,
      t: range(rng, 0, TAU),
      fireTimer: range(rng, 1.2, 2.6),
      spawnTimer: 0,
      hitFlash: 0,
    };
    enemy.maxHp = enemy.hp;
    if (kind === 'weaver') enemy.vy = enemy.speed;
    if (kind === 'asteroid') {
      enemy.vx = range(rng, -40, 40);
      enemy.vy = range(rng, 30, 80);
      enemy.spin = range(rng, -1.2, 1.2);
    }
    if (kind === 'boss') {
      enemy.y = -70;
      enemy.x = FIELD.width / 2;
      enemy.vy = 55;
      enemy.phase = 0;
    }
    state.enemies.push(enemy);
    if (kind === 'boss') state.boss = enemy;
    return enemy;
  }

  function buildWave(n) {
    const queue = [];
    const count = 12 + n * 3;
    for (let i = 0; i < count; i += 1) {
      let kind = 'drone';
      const roll = rng();
      if (n >= 4 && roll < 0.12) kind = 'splitter';
      else if (n >= 3 && roll < 0.3) kind = 'gunner';
      else if (n >= 2 && roll < 0.52) kind = 'weaver';
      else if (n >= 3 && roll < 0.62) kind = 'asteroid';
      queue.push(kind);
    }
    // Shuffle so the wave is not a monotonous stream.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  function startWave(n) {
    state.wave = n;
    state.waveState = 'fighting';
    state.spawnQueue = buildWave(n);
    state.spawnTimer = 0.4;
    state.banner = n % 5 === 0 ? `WARNING — MOTHERSHIP INBOUND` : `WAVE ${n}`;
    state.bannerTimer = 2.2;
    if (n % 5 === 0) {
      state.spawnQueue.unshift('boss');
      return EVENT_BOSS;
    }
    return EVENT_WAVE;
  }

  function explode(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rng() * TAU;
      const s = range(rng, speed * 0.25, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: range(rng, 0.35, 0.9),
        maxLife: 0.9,
        size: range(rng, 2, 5),
        color,
        drag: 2.2,
      });
    }
    state.shake = Math.min(14, state.shake + (count > 20 ? 7 : 3));
  }

  function ring(x, y, color) {
    state.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, size: 6, color, ring: true, drag: 0 });
  }

  function popup(x, y, text, color) {
    state.popups.push({ x, y, text, color: color || '#ffffff', life: 1.1 });
  }

  function dropPowerup(x, y) {
    if (rng() > POWERUP.dropChance) return;
    let kind = pick(rng, POWERUP.kinds);
    if (kind === 'life' && rng() > POWERUP.lifeChance) kind = pick(rng, ['spread', 'rapid', 'shield']);
    state.powerups.push({ kind, x, y, vx: range(rng, -20, 20), vy: 42, t: rng() * TAU });
  }

  function damageEnemy(enemy, dmg, kx, ky) {
    enemy.hp -= dmg;
    enemy.hitFlash = 0.08;
    if (enemy.hp > 0) return false;
    const idx = state.enemies.indexOf(enemy);
    if (idx !== -1) state.enemies.splice(idx, 1);
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 4) * 0.5);
    const pts = Math.round(enemy.score * state.multiplier);
    state.score += pts;
    popup(enemy.x, enemy.y, `+${pts}`, enemy.color);
    explode(enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 90 : 22, enemy.kind === 'boss' ? 320 : 220);
    ring(enemy.x, enemy.y, enemy.color);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 3; i += 1) {
        const d = addEnemy('drone', enemy.x + range(rng, -24, 24), enemy.y + range(rng, -24, 24));
        const a = rng() * TAU;
        d.vx = Math.cos(a) * 180;
        d.vy = Math.sin(a) * 180;
      }
    }
    if (enemy.kind === 'boss') {
      state.boss = null;
      state.score += 500;
      popup(enemy.x, enemy.y - 40, 'MOTHERSHIP DOWN +500', '#ffd60a');
      state.flash = 0.35;
      for (let i = 0; i < 3; i += 1) dropPowerup(enemy.x + range(rng, -60, 60), enemy.y + range(rng, -30, 30));
    }
    dropPowerup(enemy.x, enemy.y);
    return true;
  }

  function hurtPlayer() {
    const p = state.player;
    if (!p || !p.alive || p.invuln > 0 || state.waveState === 'breather') return 0;
    if (p.shieldUntil > state.time) {
      p.shieldUntil = 0;
      explode(p.x, p.y, '#4cc9f0', 26, 260);
      popup(p.x, p.y - 24, 'SHIELD DOWN', '#4cc9f0');
      p.invuln = 1.2;
      return EVENT_HIT;
    }
    state.lives -= 1;
    state.combo = 0;
    state.multiplier = 1;
    explode(p.x, p.y, '#00f5d4', 40, 300);
    ring(p.x, p.y, '#00f5d4');
    state.flash = 0.25;
    if (state.lives <= 0) {
      p.alive = false;
      return EVENT_HIT | EVENT_OVER;
    }
    p.invuln = PLAYER.invulnSeconds;
    p.x = FIELD.width / 2;
    p.y = FIELD.height * 0.72;
    p.vx = 0;
    p.vy = 0;
    state.enemyBullets.length = 0;
    return EVENT_HIT;
  }

  function firePlayerBullet(p, angle, speedMul) {
    const spread = p.spreadUntil > state.time;
    const angles = spread ? [-0.16, 0, 0.16] : [0];
    for (const off of angles) {
      const a = angle + off;
      state.bullets.push({
        x: p.x + Math.cos(a) * (p.radius + 6),
        y: p.y + Math.sin(a) * (p.radius + 6),
        vx: Math.cos(a) * PLAYER.bulletSpeed * (speedMul || 1),
        vy: Math.sin(a) * PLAYER.bulletSpeed * (speedMul || 1),
        radius: PLAYER.bulletRadius,
        life: 1.4,
      });
    }
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (!p || !p.alive) return;
    p.invuln = Math.max(0, p.invuln - dt);
    const ax = (input.mx || 0) * PLAYER.accel;
    const ay = (input.my || 0) * PLAYER.accel;
    p.vx += ax * dt;
    p.vy += ay * dt;
    const damp = Math.exp(-PLAYER.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > PLAYER.maxSpeed) {
      p.vx = (p.vx / sp) * PLAYER.maxSpeed;
      p.vy = (p.vy / sp) * PLAYER.maxSpeed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.max(p.radius, Math.min(FIELD.width - p.radius, p.x));
    p.y = Math.max(p.radius, Math.min(FIELD.height - p.radius, p.y));
    p.thrust = Math.min(1, Math.hypot(ax, ay) / PLAYER.accel + 0.15);
    p.angle = Math.atan2((input.aimY ?? p.y - 100) - p.y, (input.aimX ?? p.x) - p.x);
    p.fireTimer -= dt;
    if (input.firing && p.fireTimer <= 0) {
      const rapid = p.rapidUntil > state.time;
      p.fireTimer = PLAYER.fireInterval * (rapid ? 0.55 : 1);
      firePlayerBullet(p, p.angle);
    }
  }

  function stepEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      e.t += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      const dx = p && p.alive ? p.x - e.x : 0;
      const dy = p && p.alive ? p.y - e.y : 0;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === 'drone') {
        e.vx += (dx / d) * 420 * dt;
        e.vy += (dy / d) * 420 * dt;
        const s = Math.hypot(e.vx, e.vy);
        const max = e.speed;
        if (s > max) { e.vx = (e.vx / s) * max; e.vy = (e.vy / s) * max; }
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.kind === 'weaver') {
        e.vy = e.speed;
        e.vx = Math.sin(e.t * 4) * 170;
        e.angle = Math.atan2(e.vy, e.vx);
      } else if (e.kind === 'gunner') {
        const want = 260;
        const toward = d > want ? 1 : -0.7;
        e.vx += (dx / d) * 260 * toward * dt;
        e.vy += (dy / d) * 260 * toward * dt;
        const s = Math.hypot(e.vx, e.vy);
        if (s > e.speed) { e.vx = (e.vx / s) * e.speed; e.vy = (e.vy / s) * e.speed; }
        e.angle = Math.atan2(dy, dx);
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && p && p.alive && d < 520) {
          e.fireTimer = range(rng, 1.6, 2.6);
          const a = Math.atan2(dy, dx);
          state.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, radius: 5, life: 5 });
        }
      } else if (e.kind === 'splitter') {
        e.vx += (dx / d) * 160 * dt;
        e.vy += (dy / d) * 160 * dt;
        const s = Math.hypot(e.vx, e.vy);
        if (s > e.speed) { e.vx = (e.vx / s) * e.speed; e.vy = (e.vy / s) * e.speed; }
        e.angle += dt * 0.8;
      } else if (e.kind === 'asteroid') {
        e.angle += (e.spin || 0.5) * dt;
      } else if (e.kind === 'boss') {
        if (e.y < 90) {
          e.vy = 55;
        } else {
          e.vy = 0;
          e.vx = Math.sin(e.t * 0.7) * 90;
          e.phase += dt;
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            e.fireTimer = 2.1;
            const n = 10 + Math.min(8, state.wave);
            for (let k = 0; k < n; k += 1) {
              const a = (k / n) * TAU + e.t;
              state.enemyBullets.push({ x: e.x, y: e.y + 30, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, radius: 5, life: 6 });
            }
          }
          e.spawnTimer -= dt;
          if (e.spawnTimer <= 0) {
            e.spawnTimer = 6;
            const s = spawnPoint(220);
            addEnemy('drone', s.x, s.y);
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.kind !== 'boss' && e.kind !== 'asteroid') {
        if (e.x < -60) e.x = FIELD.width + 50;
        if (e.x > FIELD.width + 60) e.x = -50;
        if (e.y > FIELD.height + 70 && e.kind === 'weaver') e.y = -40;
      }
      if (e.y > FIELD.height + 90 || e.y < -120 || e.x < -140 || e.x > FIELD.width + 140) {
        if (e.kind === 'boss') continue;
        state.enemies.splice(i, 1);
      }
    }
  }

  function stepBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          state.bullets.splice(i, 1);
          damageEnemy(e, 1, b.vx, b.vy);
          break;
        }
      }
    }
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.enemyBullets.splice(i, 1);
      }
    }
  }

  function stepCollisions() {
    const p = state.player;
    if (!p || !p.alive) return 0;
    let events = 0;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      const rr = e.radius + p.radius - 2;
      if (dist2(e.x, e.y, p.x, p.y) < rr * rr) {
        if (e.kind !== 'boss') {
          state.enemies.splice(i, 1);
          explode(e.x, e.y, e.color, 18, 200);
        }
        events |= hurtPlayer();
        if (!p.alive) break;
      }
    }
    if (!p.alive) return events;
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      // A hit can clear the bullet list mid-loop (hurtPlayer wipes it on a
      // surviving hit), so the slot may already be gone.
      if (!b) continue;
      const rr = b.radius + p.radius - 3;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        state.enemyBullets.splice(i, 1);
        events |= hurtPlayer();
        if (!p.alive) break;
      }
    }
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const u = state.powerups[i];
      const rr = 26 + p.radius;
      if (dist2(u.x, u.y, p.x, p.y) < rr * rr) {
        state.powerups.splice(i, 1);
        events |= applyPowerup(u.kind);
      }
    }
    return events;
  }

  function applyPowerup(kind) {
    const p = state.player;
    if (kind === 'spread') { p.spreadUntil = state.time + POWERUP.duration.spread; popup(p.x, p.y - 26, 'SPREAD SHOT!', '#ffd60a'); }
    else if (kind === 'rapid') { p.rapidUntil = state.time + POWERUP.duration.rapid; popup(p.x, p.y - 26, 'RAPID FIRE!', '#ffd60a'); }
    else if (kind === 'shield') { p.shieldUntil = state.time + POWERUP.duration.shield; popup(p.x, p.y - 26, 'SHIELD UP!', '#4cc9f0'); }
    else if (kind === 'bomb') {
      popup(p.x, p.y - 26, 'NOVA BOMB!', '#ff5d8f');
      for (let i = state.enemies.length - 1; i >= 0; i -= 1) damageEnemy(state.enemies[i], 6, 0, 0);
      state.enemyBullets.length = 0;
      state.flash = 0.4;
      ring(p.x, p.y, '#ffffff');
    } else if (kind === 'life') {
      state.lives = Math.min(5, state.lives + 1);
      popup(p.x, p.y - 26, '+1 LIFE!', '#80ed99');
    }
    explode(p.x, p.y, '#ffd60a', 12, 140);
    return 0;
  }

  function stepFx(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
      if (!pt.ring) {
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        const d = Math.exp(-pt.drag * dt);
        pt.vx *= d;
        pt.vy *= d;
      }
    }
    for (let i = state.popups.length - 1; i >= 0; i -= 1) {
      const pp = state.popups[i];
      pp.life -= dt;
      pp.y -= 34 * dt;
      if (pp.life <= 0) state.popups.splice(i, 1);
    }
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const u = state.powerups[i];
      u.t += dt;
      u.x += u.vx * dt;
      u.y += u.vy * dt;
      if (u.y > FIELD.height + 30) state.powerups.splice(i, 1);
    }
    state.shake = Math.max(0, state.shake - dt * 26);
    state.flash = Math.max(0, state.flash - dt * 1.4);
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }
  }

  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    if (!attract) {
      if (state.waveState === 'breather') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) events |= startWave(state.wave + 1);
      } else if (state.waveState === 'fighting') {
        if (state.spawnQueue.length > 0) {
          state.spawnTimer -= dt;
          if (state.spawnTimer <= 0) {
            state.spawnTimer = Math.max(0.28, 0.5 - state.wave * 0.02);
            const kind = state.spawnQueue.shift();
            const s = spawnPoint(200);
            addEnemy(kind, s.x, s.y);
          }
        } else if (state.enemies.length === 0 && !state.boss) {
          state.waveState = 'clear';
          state.waveTimer = WAVE_BREATHER;
          const bonus = 100 * state.wave;
          state.score += bonus;
          popup(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE CLEAR +${bonus}`, '#80ed99');
          events |= EVENT_WAVE;
        }
      } else if (state.waveState === 'clear') {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) {
          state.waveState = 'breather';
          state.waveTimer = 0.6;
        }
      }
    }

    if (attract) {
      // Title-screen demo: the ship flies itself, cannot die, waves never advance.
      if (state.enemies.length < 6 && rng() < 0.02) {
        const s = spawnPoint(200);
        addEnemy(pick(rng, ['drone', 'weaver', 'asteroid']), s.x, s.y);
      }
      const p = state.player;
      if (p) p.invuln = 1;
    }

    stepPlayer(dt, input || { mx: 0, my: 0, firing: false });
    stepEnemies(dt);
    stepBullets(dt);
    if (!attract) events |= stepCollisions();
    stepFx(dt);
    return events;
  }

  function reset(attract) {
    const keepBest = state.best;
    const next = freshState();
    next.best = keepBest;
    Object.keys(next).forEach((k) => { state[k] = next[k]; });
    state.player = makePlayer();
    state.waveState = attract ? 'fighting' : 'breather';
    state.waveTimer = attract ? 999 : 1.2;
    state.wave = attract ? 1 : 0;
    if (attract) state.spawnQueue = [];
    return state;
  }

  function jumpToWave(n) {
    reset(false);
    state.waveState = 'fighting';
    state.spawnQueue = [];
    startWave(n);
    return state;
  }

  return { state, reset, step, startWave, jumpToWave };
}
