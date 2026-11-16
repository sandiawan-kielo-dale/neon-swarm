// All drawing: the starfield, ships, bullets, particles, HUD and screen overlays.
// The renderer only reads state — it never mutates the world.
import { FIELD } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function makeBackground() {
  const bg = document.createElement('canvas');
  bg.width = FIELD.width;
  bg.height = FIELD.height;
  const c = bg.getContext('2d');
  const grad = c.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, '#070716');
  grad.addColorStop(0.55, '#0a0a24');
  grad.addColorStop(1, '#12081f');
  c.fillStyle = grad;
  c.fillRect(0, 0, FIELD.width, FIELD.height);
  // Nebulae: big soft radial blobs.
  const blobs = [
    [200, 120, 260, 'rgba(124, 58, 237, 0.20)'],
    [760, 420, 300, 'rgba(219, 39, 119, 0.14)'],
    [820, 90, 200, 'rgba(8, 145, 178, 0.16)'],
    [120, 460, 220, 'rgba(30, 64, 175, 0.18)'],
  ];
  for (const [x, y, r, color] of blobs) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Fixed stars baked into the background (seeded, so every load looks the same).
  const starRng = createRandom(1337);
  for (let i = 0; i < 130; i += 1) {
    const x = starRng() * FIELD.width;
    const y = starRng() * FIELD.height;
    const s = starRng();
    c.fillStyle = s > 0.9 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
    c.fillRect(x, y, s > 0.9 ? 2 : 1, s > 0.9 ? 2 : 1);
  }
  return bg;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const background = makeBackground();
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let vw = 0;
  let vh = 0;

  // Two drifting parallax star layers, seeded once.
  const layers = [0, 1].map((layer) => {
    const stars = [];
    const n = layer === 0 ? 46 : 26;
    const rng = createRandom(9001 + layer);
    for (let i = 0; i < n; i += 1) {
      stars.push({
        x: rng() * FIELD.width,
        y: rng() * FIELD.height,
        s: layer === 0 ? 1.4 : 2.4,
        speed: layer === 0 ? 14 : 34,
      });
    }
    return stars;
  });

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    vw = canvas.clientWidth || FIELD.width;
    vh = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(vw / FIELD.width, vh / FIELD.height);
    ox = (vw - FIELD.width * scale) / 2;
    oy = (vh - FIELD.height * scale) / 2;
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  function circle(x, y, r, color, glow) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawShip(x, y, angle, radius, body, glow, flame) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (flame > 0.05) {
      ctx.beginPath();
      ctx.moveTo(-radius * 0.7, radius * 0.45);
      ctx.lineTo(-radius * (1.1 + flame * 0.9), 0);
      ctx.lineTo(-radius * 0.7, -radius * 0.45);
      ctx.closePath();
      ctx.fillStyle = '#ffb703';
      ctx.shadowColor = '#ff8500';
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.moveTo(radius * 1.3, 0);
    ctx.lineTo(-radius * 0.8, radius * 0.85);
    ctx.lineTo(-radius * 0.4, 0);
    ctx.lineTo(-radius * 0.8, -radius * 0.85);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(radius * 0.25, 0, radius * 0.28, 0, TAU);
    ctx.fillStyle = '#e0fbfc';
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e, screen) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle || 0);
    ctx.fillStyle = e.color;
    ctx.strokeStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = 12;
    if (e.hitFlash > 0) ctx.fillStyle = '#ffffff';
    const r = e.radius;
    if (e.kind === 'drone') {
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(-r * 0.7, r * 0.8);
      ctx.lineTo(-r * 0.3, 0);
      ctx.lineTo(-r * 0.7, -r * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (e.kind === 'weaver') {
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(0, r * 0.75);
      ctx.lineTo(-r, 0);
      ctx.lineTo(0, -r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.3, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (e.kind === 'gunner') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * TAU;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.38, 0, TAU);
      ctx.fillStyle = '#1b0036';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.2, 0, TAU);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    } else if (e.kind === 'splitter') {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.rotate(-e.angle * 0.5);
      ctx.beginPath();
      ctx.moveTo(r * 0.55, 0);
      ctx.lineTo(-r * 0.4, r * 0.5);
      ctx.lineTo(-r * 0.4, -r * 0.5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill();
      ctx.restore();
    } else if (e.kind === 'asteroid') {
      ctx.beginPath();
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * TAU;
        const rr = r * (0.75 + 0.25 * Math.sin(i * 12.9898 + r));
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.2, r * 0.22, 0, TAU);
      ctx.arc(r * 0.3, r * 0.25, r * 0.16, 0, TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
    } else if (e.kind === 'boss') {
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, r * 1.15);
      ctx.lineTo(r * 0.95, r * 0.2);
      ctx.lineTo(r * 0.6, -r * 0.9);
      ctx.lineTo(-r * 0.6, -r * 0.9);
      ctx.lineTo(-r * 0.95, r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.34, 0, TAU);
      ctx.fillStyle = '#ffd60a';
      ctx.shadowColor = '#ffd60a';
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, -r * 0.1, r * 0.18, 0, TAU);
      ctx.fillStyle = '#ff2e63';
      ctx.fill();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    if (e.kind === 'boss' && screen === SCREEN_PLAY) {
      const w = 190;
      const pct = Math.max(0, e.hp / e.maxHp);
      // Near the top the bar would collide with the HUD: hang it below instead.
      const barY = e.y < 150 ? e.y + e.radius + 16 : e.y - e.radius - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(e.x - w / 2, barY, w, 9);
      ctx.fillStyle = '#ff2e63';
      ctx.fillRect(e.x - w / 2, barY, w * pct, 9);
    }
  }

  function drawPowerup(u) {
    const bob = Math.sin(u.t * 4) * 3;
    const y = u.y + bob;
    const colors = { spread: '#ffd60a', rapid: '#ff8500', shield: '#4cc9f0', bomb: '#ff5d8f', life: '#80ed99' };
    const labels = { spread: 'S', rapid: 'R', shield: 'O', bomb: 'B', life: '+' };
    ctx.save();
    ctx.translate(u.x, y);
    ctx.shadowColor = colors[u.kind];
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, TAU);
    ctx.fillStyle = 'rgba(5,5,20,0.85)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colors[u.kind];
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors[u.kind];
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[u.kind], 0, 1);
    ctx.restore();
  }

  function drawHud(state, best) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE ${state.score}`, 18, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 18, 54);
    if (state.multiplier > 1) {
      ctx.fillStyle = '#ffd60a';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`COMBO x${state.multiplier.toFixed(1)}`, 18, 78);
      ctx.fillStyle = 'rgba(255,214,10,0.35)';
      ctx.fillRect(18, 86, 90 * (state.comboTimer / 3), 4);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(state.wave > 0 ? `WAVE ${state.wave}` : 'GET READY', FIELD.width / 2, 32);
    const remaining = state.enemies.length + state.spawnQueue.length;
    if (state.waveState === 'fighting' && remaining > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(`${remaining} HOSTILE${remaining === 1 ? '' : 'S'}`, FIELD.width / 2, 52);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText('LIVES', FIELD.width - 18, 30);
    for (let i = 0; i < state.lives; i += 1) {
      drawShip(FIELD.width - 30 - i * 26, 52, -Math.PI / 2, 9, '#00f5d4', '#00f5d4', 0);
    }
    // Active power-up timers, bottom left.
    const p = state.player;
    if (p) {
      const chips = [];
      if (p.spreadUntil > state.time) chips.push(['SPREAD', (p.spreadUntil - state.time)]);
      if (p.rapidUntil > state.time) chips.push(['RAPID', (p.rapidUntil - state.time)]);
      if (p.shieldUntil > state.time) chips.push(['SHIELD', (p.shieldUntil - state.time)]);
      ctx.textAlign = 'left';
      chips.forEach(([label, left], i) => {
        const y = FIELD.height - 18 - i * 24;
        ctx.fillStyle = 'rgba(255,214,10,0.9)';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText(`${label} ${Math.ceil(left)}s`, 18, y);
      });
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('M mute · P pause', FIELD.width - 18, FIELD.height - 16);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(3,3,12,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#00f5d4';
    ctx.shadowColor = accent || '#00f5d4';
    ctx.shadowBlur = 26;
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillText(title, FIELD.width / 2, FIELD.height / 2 - 70);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - 18 + i * 26);
    });
  }

  function draw(state, screen, best) {
    resize();
    // resize() leaves the transform at the device-pixel scale: all drawing below
    // is in CSS pixels, so the letterbox fill covers the whole canvas.
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();
    // Shake and the hit flash are play-time feedback: once the game is over or
    // paused the world stops stepping, so frozen values would wash or jitter
    // the frozen frame forever.
    const shake = screen === SCREEN_PLAY ? state.shake : 0;
    const flash = screen === SCREEN_PLAY ? state.flash : 0;
    if (shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    ctx.drawImage(background, 0, 0);
    for (let li = 0; li < layers.length; li += 1) {
      ctx.fillStyle = li === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)';
      for (const s of layers[li]) {
        const y = (s.y + state.time * s.speed) % FIELD.height;
        ctx.fillRect(s.x, y, s.s, s.s);
      }
    }
    for (const u of state.powerups) drawPowerup(u);
    // Enemy bullets: glowing magenta orbs.
    for (const b of state.enemyBullets) circle(b.x, b.y, b.radius, '#ff5d8f', 10);
    for (const e of state.enemies) drawEnemy(e, screen);
    // Player bullets: bright cyan streaks.
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f5d4';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (const b of state.bullets) {
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    const p = state.player;
    if (p && p.alive) {
      const blink = p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0;
      if (!blink) {
        drawShip(p.x, p.y, p.angle, p.radius, '#00f5d4', '#00f5d4', p.thrust);
        if (p.shieldUntil > state.time) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 10 + Math.sin(state.time * 6) * 2, 0, TAU);
          ctx.strokeStyle = 'rgba(76,201,240,0.8)';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#4cc9f0';
          ctx.shadowBlur = 12;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }
    // Particles, additive.
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of state.particles) {
      const a = Math.max(0, pt.life / pt.maxLife);
      if (pt.ring) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, (1 - a) * 90 + 8, 0, TAU);
        ctx.strokeStyle = pt.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        circle(pt.x, pt.y, pt.size * a + 0.5, pt.color, 0);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    // Score popups.
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px system-ui, sans-serif';
    for (const pp of state.popups) {
      ctx.globalAlpha = Math.min(1, pp.life);
      ctx.fillStyle = pp.color;
      ctx.fillText(pp.text, pp.x, pp.y);
    }
    ctx.globalAlpha = 1;
    if (state.bannerTimer > 0 && state.banner) {
      const a = Math.min(1, state.bannerTimer);
      ctx.globalAlpha = a;
      ctx.fillStyle = state.banner.includes('WARNING') ? '#ff2e63' : '#ffd60a';
      ctx.shadowColor = state.banner.includes('WARNING') ? '#ff2e63' : '#ffd60a';
      ctx.shadowBlur = 22;
      ctx.font = '900 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.banner, FIELD.width / 2, FIELD.height / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
    if (screen !== SCREEN_TITLE) drawHud(state, best);
    if (screen === SCREEN_TITLE) {
      overlay('NEON SWARM', [
        'Blast the swarm. Survive the waves. Slay the Mothership.',
        '',
        'WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK / SPACE — fire',
        'Grab power-ups:  S spread · R rapid · O shield · B nova bomb · + life',
        '',
        best > 0 ? `BEST SCORE ${best}` : 'No flights logged yet — make this one count.',
        '',
        'CLICK OR PRESS ENTER TO LAUNCH',
      ], '#00f5d4');
    } else if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['Press P or click to resume.'], '#ffd60a');
    } else if (screen === SCREEN_OVER) {
      overlay('GAME OVER', [
        `FINAL SCORE  ${state.score}`,
        `WAVES CLEARED  ${Math.max(0, state.wave - 1)}    ·    KILLS  ${state.kills}`,
        `BEST  ${Math.max(best, state.score)}`,
        '',
        'PRESS R OR CLICK TO FLY AGAIN',
      ], '#ff2e63');
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.restore();
  }

  return { draw, resize, toField };
}
