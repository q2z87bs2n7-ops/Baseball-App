import { FENCE_SLOT_COUNT } from './cards.js';

export const TIMING = Object.freeze({
  FOUL_LEFT_MAX: 0.15,
  PERFECT_LOW: 0.45,
  PERFECT_HIGH: 0.55,
  FOUL_RIGHT_MIN: 0.85,
});

export function timingToLandingX(timing) {
  if (timing == null) return null;
  if (timing < TIMING.FOUL_LEFT_MAX) return { kind: 'foul', side: 'left' };
  if (timing > TIMING.FOUL_RIGHT_MIN) return { kind: 'foul', side: 'right' };
  const t = (timing - TIMING.FOUL_LEFT_MAX) / (TIMING.FOUL_RIGHT_MIN - TIMING.FOUL_LEFT_MAX);
  const fenceX = 0.06 + t * 0.88;
  return { kind: 'fair', fenceX };
}

export function landingToSlot(fenceX) {
  const slotWidth = 1 / FENCE_SLOT_COUNT;
  const slot = Math.max(0, Math.min(FENCE_SLOT_COUNT - 1, Math.floor((fenceX - 0.05) / 0.9 * FENCE_SLOT_COUNT)));
  const slotCenter = 0.05 + (slot + 0.5) * (0.9 / FENCE_SLOT_COUNT);
  const offsetFromCenter = (fenceX - slotCenter) / (slotWidth * 0.9);
  return { slot, offsetFromCenter };
}

export function hitsRamp(slot, offsetFromCenter, ramp) {
  if (slot !== ramp.slot) return false;
  return Math.abs(offsetFromCenter) <= ramp.widthFraction;
}

export function bezier(t, p0, p1, p2) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}
