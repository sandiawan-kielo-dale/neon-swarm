// Small deterministic RNG (mulberry32) so ?seed=N replays the same game.
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, array) {
  return array[Math.floor(rng() * array.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}
