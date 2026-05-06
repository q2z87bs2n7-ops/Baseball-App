// Web Audio API synthesis for in-game alerts. Each sound is a short,
// procedurally-generated tone or noise burst — no MP3 samples shipped
// (CC0 sample integration is in the backlog; see CLAUDE.md backlog).
//
// soundSettings is exported as a const object — importers see a live
// binding to the same object reference. Restoration from localStorage
// happens inside this module on import (Object.assign over the defaults
// instead of reassigning the binding) so importers never read undefined.

export const soundSettings = {
  master: false,
  hr: true, run: true, risp: true, dp: true, tp: true,
  gameStart: true, gameEnd: true, error: true,
};

// Hydrate from localStorage at module-init time.
try {
  var stored = localStorage.getItem('mlb_sound_settings');
  if (stored) Object.assign(soundSettings, JSON.parse(stored));
} catch (e) { /* ignore corrupt JSON */ }

// ── Audio primitives ─────────────────────────────────────────────────────────
function _makeCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

function _closeCtx(ctx, dur) {
  setTimeout(function() {
    try { ctx.close(); } catch (e) {}
  }, (dur + 0.6) * 1000);
}

function _osc(ctx, freq, t0, dur, vol, wave, attack) {
  var osc = ctx.createOscillator(), g = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.type = wave || 'sine';
  osc.frequency.value = freq;
  var at = ctx.currentTime + t0, att = attack || 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + att);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.start(at); osc.stop(at + dur + 0.05);
}

function _ns(ctx, t0, dur, vol, attack, filterType, filterFreq, filterQ) {
  var len = Math.ceil(ctx.sampleRate * (dur + 0.1));
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  var src = ctx.createBufferSource();
  src.buffer = buf;
  var filt = ctx.createBiquadFilter();
  filt.type = filterType || 'bandpass';
  filt.frequency.value = filterFreq || 1000;
  filt.Q.value = filterQ !== undefined ? filterQ : 1;
  var g = ctx.createGain();
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  var at = ctx.currentTime + t0, att = attack || 0.003;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + att);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.start(at); src.stop(at + dur + 0.05);
}

// ── Per-event sounds ─────────────────────────────────────────────────────────
function playHrSound() { try { var ctx = _makeCtx(); _ns(ctx, 0, 0.07, 0.32, 0.001, 'highpass', 2200, 0.8); _ns(ctx, 0, 0.05, 0.22, 0.001, 'bandpass', 900, 3.0); _osc(ctx, 140, 0, 0.06, 0.18, 'sine', 0.001); _ns(ctx, 0.05, 0.90, 0.09, 0.08, 'lowpass', 300, 1.0); _closeCtx(ctx, 1.2); } catch (e) {} }
function playRunSound() { try { var ctx = _makeCtx(); _osc(ctx, 523, 0, 0.55, 0.18, 'sine'); _osc(ctx, 659, 0.15, 0.50, 0.18, 'sine'); _osc(ctx, 784, 0.30, 0.60, 0.18, 'sine'); _closeCtx(ctx, 1.0); } catch (e) {} }
function playRispSound() { try { var ctx = _makeCtx(); _ns(ctx, 0, 0.10, 0.20, 0.003, 'lowpass', 180, 2.0); _ns(ctx, 0.13, 0.14, 0.16, 0.004, 'lowpass', 220, 1.5); _closeCtx(ctx, 0.4); } catch (e) {} }
function playDpSound() { try { var ctx = _makeCtx(); _ns(ctx, 0, 0.06, 0.28, 0.001, 'bandpass', 750, 5); _ns(ctx, 0.10, 0.06, 0.28, 0.001, 'bandpass', 750, 5); _closeCtx(ctx, 0.4); } catch (e) {} }
function playTpSound() { try { var ctx = _makeCtx(); _osc(ctx, 392, 0, 0.12, 0.17, 'triangle'); _osc(ctx, 523, 0.11, 0.12, 0.17, 'triangle'); _osc(ctx, 659, 0.22, 0.12, 0.17, 'triangle'); _osc(ctx, 784, 0.33, 0.32, 0.17, 'triangle'); _closeCtx(ctx, 0.8); } catch (e) {} }
function playGameStartSound() { try { var ctx = _makeCtx(); _osc(ctx, 523, 0, 0.14, 0.16, 'triangle'); _osc(ctx, 587, 0.13, 0.14, 0.16, 'triangle'); _osc(ctx, 659, 0.26, 0.14, 0.16, 'triangle'); _osc(ctx, 784, 0.39, 0.38, 0.16, 'triangle'); _closeCtx(ctx, 1.0); } catch (e) {} }
function playGameEndSound() { try { var ctx = _makeCtx(); _osc(ctx, 784, 0, 0.65, 0.15, 'sine'); _osc(ctx, 659, 0.38, 0.65, 0.15, 'sine'); _osc(ctx, 523, 0.76, 0.80, 0.15, 'sine'); _closeCtx(ctx, 1.8); } catch (e) {} }
function playErrorSound() { try { var ctx = _makeCtx(); _ns(ctx, 0, 0.18, 0.22, 0.003, 'lowpass', 160, 1.5); _osc(ctx, 130, 0.02, 0.16, 0.10, 'sine'); _closeCtx(ctx, 0.5); } catch (e) {} }

// ── Public API ───────────────────────────────────────────────────────────────
export function playSound(type) {
  if (!soundSettings.master || !soundSettings[type]) return;
  if (type === 'hr') playHrSound();
  else if (type === 'run') playRunSound();
  else if (type === 'risp') playRispSound();
  else if (type === 'dp') playDpSound();
  else if (type === 'tp') playTpSound();
  else if (type === 'gameStart') playGameStartSound();
  else if (type === 'gameEnd') playGameEndSound();
  else if (type === 'error') playErrorSound();
}

export function setSoundPref(key, val) {
  soundSettings[key] = val;
  if (key === 'master') document.getElementById('soundRows').classList.toggle('master-off', !val);
  localStorage.setItem('mlb_sound_settings', JSON.stringify(soundSettings));
}

export function toggleSoundPanel() {
  var p = document.getElementById('soundPanel');
  p.style.display = p.style.display === 'none' ? '' : 'none';
}

// Click-outside dismiss for both Sound panel AND Dev Tools panel.
// (Combined here because they share the same global listener; the Dev Tools
// branch will move to dev/panel.js when that subsystem is extracted.)
export function onSoundPanelClickOutside(e) {
  var panel = document.getElementById('soundPanel');
  var btn = document.getElementById('ptbSoundBtn');
  if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    panel.style.display = 'none';
  }
  var dbgPanel = document.getElementById('devToolsPanel');
  var dbgBtn = document.getElementById('btnDevTools');
  if (dbgPanel && dbgPanel.style.display !== 'none' && !dbgPanel.contains(e.target) && dbgBtn && !dbgBtn.contains(e.target)) {
    dbgPanel.style.display = 'none';
  }
}
