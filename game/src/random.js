// Seeded chance for SOLMAR HEAT. One mulberry32 stream backs everything
// that has to rebuild the same way every run: city blocks, parked cars,
// traffic, walkers, stash spots. One seed in, the same Solmar Bay out.
// The helpers after the generator are the shared toolkit world.js and the
// staging scripts draw from: clamps, squared distances, bearings, blends,
// draws and shuffles.

// mulberry32's increment, written out in decimal, and the 2^32 divisor the
// raw 32-bit output is scaled by to land in [0, 1).
const STEP_ADD = 1831565813;
const UINT32 = 2 ** 32;

// A full turn in radians, shared by the angle helpers below.
export const TAU = Math.PI * 2;

// A repeatable stream of floats in [0, 1), seeded by `seed`.
export const createRandom = (seed) => {
  let state = 0 | seed;
  const next = () => {
    state = (STEP_ADD + state) | 0;
    const first = Math.imul(state ^ (state >>> 15), state | 1);
    const second = (first + Math.imul(first ^ (first >>> 7), first | 61)) ^ first;
    return ((second ^ (second >>> 14)) >>> 0) / UINT32;
  };
  return next;
};

// Clamp `value` into the closed interval [lo, hi].
export const clamp = (value, lo, hi) => (value < lo ? lo : value > hi ? hi : value);

// Squared distance between two points, skipping the square root.
export const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

// Bearing from (ax, ay) toward (bx, by), in radians.
export const angleTo = (ax, ay, bx, by) => {
  const rise = by - ay;
  const run = bx - ax;
  return Math.atan2(rise, run);
};

// Shortest signed turn from `a` to `b`, landing in (-PI, PI].
export const angleDiff = (a, b) => {
  let d = -a + b;
  for (; d > Math.PI; d -= TAU) { /* spin down past +PI */ }
  for (; d <= -Math.PI; d += TAU) { /* spin up past -PI */ }
  return +d;
};

// Linear blend between `a` and `b`: `a` at t=0, `b` at t=1.
export const lerp = (a, b, t) => a+(b-a)*t;

// A float in [min, max) drawn from the seeded stream.
export const range = (random, min, max) => min+random()*(max-min);

// A whole number in [min, max], inclusive, from the seeded stream.
export const randInt = (random, min, max) => {
  const span = max - min + 1;
  return min + Math.floor(random() * span);
};

// One element of `list`, chosen by the seeded stream.
export const pick = (random, list) => {
  const slot = Math.floor(random() * list.length);
  return list[slot];
};

// Fisher-Yates shuffle of a copy, driven by the seeded stream.
export const shuffle = (random, list) => {
  const out = list.slice(0);
  for (let i = out.length - 1; 0 < i; i -= 1) {
    const j = Math.floor(random() * (1 + i));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [...out];
};
