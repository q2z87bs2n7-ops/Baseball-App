import { state, PHASES, resetGame } from './state.js';
import { shuffleFence, VALUE_LABEL } from './cards.js';
import { timingToLandingX, landingToSlot, hitsRamp } from './physics.js';
import { bindInput } from './input.js';
import { setupField, drawField } from './render.field.js';
import {
  renderFence, flashCard, updateHud, showResult, updateTimingCursor,
} from './render.dom.js';
import { applyHit } from './bases.js';
import { loadLeaderboard, recordScore, renderLeaderboard } from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const els = {
  canvas: $('field'),
  fence: $('fence'),
  banner: $('resultBanner'),
  swingBtn: $('swingBtn'),
  timingCursor: $('timingCursor'),
  gameOver: $('gameOver'),
  finalScore: $('finalScore'),
  leaderboard: $('leaderboard'),
  resetBtn: $('resetBtn'),
};
const hud = {
  score: $('hud-score'),
  outs: $('hud-outs'),
  strikes: $('hud-strikes'),
  atBat: $('hud-atbat'),
};

const ctx = setupField(els.canvas);

function newPitch() {
  const f = shuffleFence();
  state.fence = f.slots;
  state.ramp = f.ramp;
  state.pitch.t = 0;
  state.pitch.startedAt = performance.now();
  state.swing.armed = true;
  state.swing.timing = null;
  state.ball.inFlight = false;
  state.ball.landingX = null;
  state.ball.t = 0;
  state.phase = PHASES.PITCHING;
  renderFence(els.fence);
}

function resolveSwing(timing) {
  state.swing.armed = false;
  state.swing.timing = timing;
  const landing = timingToLandingX(timing);

  if (landing.kind === 'foul') {
    state.ball.landingX = landing.side === 'left' ? 0.02 : 0.98;
    state.ball.t = 0;
    state.phase = PHASES.BALL_IN_FLIGHT;
    state.ball.pendingResolve = () => finishPlay({ kind: 'foul' });
    return;
  }

  const { slot, offsetFromCenter } = landingToSlot(landing.fenceX);
  state.ball.landingX = landing.fenceX;
  state.ball.t = 0;
  state.phase = PHASES.BALL_IN_FLIGHT;

  const slotDef = state.fence[slot];
  const isHomerun = hitsRamp(slot, offsetFromCenter, state.ramp);
  const hitValue = isHomerun ? 'HR' : slotDef.value;
  state.ball.pendingResolve = () => finishPlay({ kind: 'card', slot, hitValue, isHomerun });
}

async function finishPlay(result) {
  state.phase = PHASES.RESULT;

  if (result.kind === 'foul') {
    if (state.strikes < 2) state.strikes += 1;
    await showResult(els.banner, 'FOUL', 'out');
  } else if (result.hitValue === 'OUT') {
    state.outs += 1;
    state.strikes = 0;
    state.atBat += 1;
    flashCard(els.fence, result.slot, false);
    await showResult(els.banner, 'OUT', 'out');
  } else {
    const runs = applyHit(result.hitValue);
    state.strikes = 0;
    state.atBat += 1;
    flashCard(els.fence, result.slot, result.isHomerun);
    const label = result.isHomerun
      ? `HOME RUN${runs > 1 ? ` +${runs}` : ''}`
      : VALUE_LABEL[result.hitValue] || result.hitValue;
    await showResult(els.banner, label, result.isHomerun ? 'hr' : null);
  }

  if (state.strikes >= 3) {
    state.outs += 1;
    state.strikes = 0;
    state.atBat += 1;
    await showResult(els.banner, 'STRIKEOUT', 'out');
  }

  updateHud(hud);

  if (state.outs >= state.maxOuts) {
    endGame();
    return;
  }

  state.phase = PHASES.IDLE;
  state.lastResult = result;
}

function endGame() {
  state.phase = PHASES.GAME_OVER;
  els.finalScore.textContent = state.score;
  const top = recordScore(state.score);
  renderLeaderboard(els.leaderboard, top);
  els.gameOver.hidden = false;
  els.swingBtn.disabled = true;
}

function onSwingPress({ kind, timing }) {
  if (kind === 'pitch') {
    if (state.phase === PHASES.GAME_OVER) return;
    newPitch();
  } else if (kind === 'swing') {
    resolveSwing(timing);
  }
}

bindInput({ swingBtn: els.swingBtn, onSwingPress });

els.resetBtn.addEventListener('click', () => {
  resetGame();
  els.gameOver.hidden = true;
  els.swingBtn.disabled = false;
  updateHud(hud);
  renderFence(els.fence);
});

function tick(now) {
  if (state.phase === PHASES.PITCHING) {
    const elapsed = now - state.pitch.startedAt;
    state.pitch.t = Math.min(1, elapsed / state.pitch.durationMs);
    updateTimingCursor(els.timingCursor, state.pitch.t);
    if (state.pitch.t >= 1 && state.swing.armed) {
      state.swing.armed = false;
      state.strikes += 1;
      state.phase = PHASES.RESULT;
      updateHud(hud);
      (async () => {
        await showResult(els.banner, 'STRIKE', 'out');
        if (state.strikes >= 3) {
          state.outs += 1;
          state.strikes = 0;
          state.atBat += 1;
          updateHud(hud);
          await showResult(els.banner, 'STRIKEOUT', 'out');
          if (state.outs >= state.maxOuts) {
            endGame();
            return;
          }
        }
        state.phase = PHASES.IDLE;
      })();
    }
  } else if (state.phase === PHASES.BALL_IN_FLIGHT) {
    state.ball.t = Math.min(1, state.ball.t + 16 / state.ball.durationMs);
    if (state.ball.t >= 1 && state.ball.pendingResolve) {
      const fn = state.ball.pendingResolve;
      state.ball.pendingResolve = null;
      fn();
    }
  }
  drawField(ctx, els.canvas);
  requestAnimationFrame(tick);
}

// init
state.fence = shuffleFence().slots;
state.ramp = { slot: -1, widthFraction: 0.4 };
renderFence(els.fence);
updateHud(hud);
requestAnimationFrame(tick);
