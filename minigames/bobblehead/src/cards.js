export const FENCE_SLOT_COUNT = 12;

const VALUE_WEIGHTS = [
  { value: 'OUT',    weight: 4 },
  { value: 'SINGLE', weight: 5 },
  { value: 'DOUBLE', weight: 3 },
  { value: 'TRIPLE', weight: 1 },
  { value: 'HR',     weight: 1 },
];

function weightedPick(rng) {
  const total = VALUE_WEIGHTS.reduce((s, v) => s + v.weight, 0);
  let r = rng() * total;
  for (const { value, weight } of VALUE_WEIGHTS) {
    r -= weight;
    if (r <= 0) return value;
  }
  return 'OUT';
}

export function shuffleFence(rng = Math.random) {
  const slots = [];
  for (let i = 0; i < FENCE_SLOT_COUNT; i++) {
    slots.push({ value: weightedPick(rng) });
  }
  const rampSlot = Math.floor(rng() * FENCE_SLOT_COUNT);
  return { slots, ramp: { slot: rampSlot, widthFraction: 0.4 } };
}

export const VALUE_LABEL = {
  OUT: 'OUT',
  SINGLE: '1B',
  DOUBLE: '2B',
  TRIPLE: '3B',
  HR: 'HR',
};
