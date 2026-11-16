// Tuning constants for NEON SWARM. One place to balance the whole game.
export const FIELD = { width: 960, height: 540 };
export const STEP = 1 / 60;
export const BEST_KEY = 'neon-swarm-best';

export const PLAYER = {
  radius: 14,
  accel: 2600,
  maxSpeed: 360,
  drag: 3.2,
  fireInterval: 0.13,
  bulletSpeed: 660,
  bulletRadius: 4,
  lives: 3,
  invulnSeconds: 2.2,
  respawnSeconds: 1.0,
};

export const ENEMY = {
  drone:    { radius: 13, hp: 2, speed: 150, score: 50,  color: '#ff4d6d' },
  weaver:   { radius: 14, hp: 3, speed: 190, score: 80,  color: '#ff9f1c' },
  gunner:   { radius: 16, hp: 4, speed: 95,  score: 120, color: '#c77dff' },
  splitter: { radius: 24, hp: 6, speed: 70,  score: 150, color: '#4cc9f0' },
  asteroid: { radius: 26, hp: 8, speed: 55,  score: 100, color: '#8d99ae' },
  boss:     { radius: 58, hp: 90, speed: 42,  score: 1500, color: '#ff2e63' },
};

export const POWERUP = {
  dropChance: 0.13,
  lifeChance: 0.08, // of drops
  kinds: ['spread', 'rapid', 'shield', 'bomb', 'life'],
  duration: { spread: 12, rapid: 10, shield: 9 },
};

export const COMBO_WINDOW = 3; // seconds to keep the combo alive
export const WAVE_BREATHER = 2.6; // seconds between waves
