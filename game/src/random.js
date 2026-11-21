// Seeded random numbers (mulberry32) plus small helpers the city generator
// and the screenshot staging share, so the same seed always builds the same city.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

/** Whole number in [min, max], inclusive, from the seeded stream. */
export function randInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

export function pick(random, list) {
  return list[Math.floor(random() * list.length)];
}

/** Fisher–Yates shuffle of a copy, driven by the seeded stream. */
export function shuffle(random, list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Shortest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
