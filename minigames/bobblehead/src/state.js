export const PHASES = Object.freeze({
  IDLE: 'idle',
  PITCHING: 'pitching',
  BALL_IN_FLIGHT: 'ball_in_flight',
  RESULT: 'result',
  GAME_OVER: 'game_over',
});

export const state = {
  phase: PHASES.IDLE,
  score: 0,
  outs: 0,
  strikes: 0,
  atBat: 1,
  maxOuts: 9,
  bases: { first: false, second: false, third: false },
  fence: [],
  ramp: { slot: -1, widthFraction: 0.4 },
  pitch: { t: 0, durationMs: 1500, startedAt: 0 },
  swing: { armed: false, timing: null, pressedAtMs: 0 },
  ball: { x: 0.5, y: 0.5, vx: 0, vy: 0, inFlight: false, landingX: null, t: 0, durationMs: 700 },
  lastResult: null,
};

export function resetGame() {
  state.phase = PHASES.IDLE;
  state.score = 0;
  state.outs = 0;
  state.strikes = 0;
  state.atBat = 1;
  state.bases = { first: false, second: false, third: false };
  state.lastResult = null;
}
