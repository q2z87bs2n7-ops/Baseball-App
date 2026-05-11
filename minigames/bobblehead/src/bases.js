import { state } from './state.js';

export function applyHit(hitType) {
  const { bases } = state;
  let runs = 0;

  if (hitType === 'HR') {
    runs += (bases.first ? 1 : 0) + (bases.second ? 1 : 0) + (bases.third ? 1 : 0) + 1;
    state.bases = { first: false, second: false, third: false };
    state.score += runs;
    return runs;
  }

  const advance = hitType === 'SINGLE' ? 1 : hitType === 'DOUBLE' ? 2 : hitType === 'TRIPLE' ? 3 : 0;
  if (advance === 0) return 0;

  const before = [
    bases.third ? 3 : null,
    bases.second ? 2 : null,
    bases.first ? 1 : null,
  ].filter((v) => v !== null);

  const moved = before.map((b) => b + advance);
  const batter = advance;

  const all = [...moved, batter];
  const nextBases = { first: false, second: false, third: false };
  for (const pos of all) {
    if (pos >= 4) {
      runs += 1;
    } else if (pos === 1) {
      nextBases.first = true;
    } else if (pos === 2) {
      nextBases.second = true;
    } else if (pos === 3) {
      nextBases.third = true;
    }
  }
  state.bases = nextBases;
  state.score += runs;
  return runs;
}
