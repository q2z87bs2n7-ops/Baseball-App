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
  const stored = localStorage.getItem('mlb_sound_settings');
  if (stored) Object.assign(soundSettings, JSON.parse(stored));
} catch (e) { /* ignore corrupt JSON */ }

// Mix with other audio (Spotify/podcasts/etc) instead of interrupting on iOS.
// iOS 16.4+ only; no-op elsewhere where AudioContext already mixes by default.
try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) {}

// ── Audio primitives ─────────────────────────────────────────────────────────
function _makeCtx() {
  return new (window.AudioContext || window.webkitAudioContext)();
}

function _closeCtx(ctx, dur) {
  setTimeout(function() {
    try { ctx.close(); } catch (e) {}
  }, (dur + 0.6) * 1000);
}

function _osc(ctx, freq, t0, dur, vol, wave, attack, dest) {
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.connect(g); g.connect(dest || ctx.destination);
  osc.type = wave || 'sine';
  osc.frequency.value = freq;
  const at = ctx.currentTime + t0, att = attack || 0.005;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + att);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.start(at); osc.stop(at + dur + 0.05);
}

function _ns(ctx, t0, dur, vol, attack, filterType, filterFreq, filterQ, dest) {
  const len = Math.ceil(ctx.sampleRate * (dur + 0.1));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType || 'bandpass';
  filt.frequency.value = filterFreq || 1000;
  filt.Q.value = filterQ !== undefined ? filterQ : 1;
  const g = ctx.createGain();
  src.connect(filt); filt.connect(g); g.connect(dest || ctx.destination);
  const at = ctx.currentTime + t0, att = attack || 0.003;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + att);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.start(at); src.stop(at + dur + 0.05);
}

// ── Glue compressor (prevents inter-layer clipping, adds punch) ───────────────
function _comp(ctx) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = -12; c.knee.value = 6; c.ratio.value = 4;
  c.attack.value = 0.003; c.release.value = 0.15;
  c.connect(ctx.destination);
  return c;
}

// ── Per-event sounds ─────────────────────────────────────────────────────────
function playHrSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // Crack of the bat (sharp broadband + body thud + bass)
    _ns(ctx, 0,    0.05, 0.95, 0.0005, 'highpass', 2800, 0.8, d);
    _ns(ctx, 0,    0.12, 0.80, 0.001,  'bandpass', 1000, 2.0, d);
    _osc(ctx, 75,  0,    0.25, 0.75, 'sine', 0.002, d);
    // Rising excitement tones
    _osc(ctx, 392, 0.15, 0.40, 0.50, 'sine', 0.02, d);
    _osc(ctx, 523, 0.40, 0.40, 0.50, 'sine', 0.02, d);
    _osc(ctx, 784, 0.65, 0.75, 0.45, 'sine', 0.02, d);
    // Crowd swell fading in
    _ns(ctx, 0.12, 1.85, 0.22, 0.22, 'lowpass', 650, 0.5, d);
    _closeCtx(ctx, 2.3);
  } catch (e) {}
}
function playRunSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // G4→B4→D5→G5 bright arpeggio (G major — distinct from C-major game-start)
    _osc(ctx, 392, 0,    0.24, 0.55, 'sine', 0.01, d);
    _osc(ctx, 494, 0.20, 0.24, 0.55, 'sine', 0.01, d);
    _osc(ctx, 587, 0.40, 0.24, 0.55, 'sine', 0.01, d);
    _osc(ctx, 784, 0.60, 0.55, 0.55, 'sine', 0.01, d);
    // Sub-octave sine layer for warmth
    _osc(ctx, 196, 0,    0.28, 0.38, 'sine', 0.02, d);
    _osc(ctx, 247, 0.20, 0.28, 0.38, 'sine', 0.02, d);
    _osc(ctx, 294, 0.40, 0.28, 0.38, 'sine', 0.02, d);
    _osc(ctx, 392, 0.60, 0.58, 0.38, 'sine', 0.02, d);
    _closeCtx(ctx, 1.4);
  } catch (e) {}
}
function playRispSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // Two kick-drum pulses (tension — runners are in scoring position)
    _osc(ctx, 100, 0,    0.32, 0.80, 'sine', 0.003, d);
    _ns(ctx,  0,   0.13, 0.65, 0.002, 'lowpass', 200, 1.5, d);
    _osc(ctx, 120, 0.42, 0.32, 0.65, 'sine', 0.003, d);
    _ns(ctx,  0.42,0.13, 0.55, 0.002, 'lowpass', 220, 1.5, d);
    // Tense sustained high tone
    _osc(ctx, 880, 0.08, 0.60, 0.13, 'sine', 0.06, d);
    _closeCtx(ctx, 1.0);
  } catch (e) {}
}
function playDpSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // Two crisp snaps + quick up-note (1-2-done feel)
    _ns(ctx, 0,    0.07, 0.95, 0.001, 'bandpass', 1100, 5, d);
    _osc(ctx, 200, 0,    0.10, 0.65, 'sine', 0.001, d);
    _ns(ctx, 0.20, 0.07, 0.95, 0.001, 'bandpass', 1400, 5, d);
    _osc(ctx, 260, 0.20, 0.10, 0.65, 'sine', 0.001, d);
    _osc(ctx, 660, 0.33, 0.32, 0.50, 'sine', 0.01, d);
    _closeCtx(ctx, 0.8);
  } catch (e) {}
}
function playTpSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // Three rapid snaps (one per out)
    _ns(ctx, 0,    0.07, 0.90, 0.001, 'bandpass', 1000, 4, d);
    _osc(ctx, 180, 0,    0.10, 0.60, 'sine', 0.001, d);
    _ns(ctx, 0.16, 0.07, 0.90, 0.001, 'bandpass', 1200, 4, d);
    _osc(ctx, 220, 0.16, 0.10, 0.60, 'sine', 0.001, d);
    _ns(ctx, 0.32, 0.07, 0.90, 0.001, 'bandpass', 1500, 4, d);
    _osc(ctx, 280, 0.32, 0.10, 0.60, 'sine', 0.001, d);
    // Triumphant ascending flourish
    _osc(ctx, 392, 0.46, 0.20, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 523, 0.60, 0.20, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 659, 0.74, 0.20, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 784, 0.88, 0.65, 0.55, 'triangle', 0.01, d);
    _closeCtx(ctx, 1.75);
  } catch (e) {}
}
function playGameStartSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // C5→E5→G5→C6 stately fanfare (triangle = warm, brass-like)
    _osc(ctx, 523,  0,    0.26, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 659,  0.24, 0.26, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 784,  0.48, 0.26, 0.55, 'triangle', 0.01, d);
    _osc(ctx, 1047, 0.72, 0.75, 0.55, 'triangle', 0.01, d);
    // Sine sub-layer one octave down for richness
    _osc(ctx, 262, 0,    0.30, 0.40, 'sine', 0.02, d);
    _osc(ctx, 330, 0.24, 0.30, 0.40, 'sine', 0.02, d);
    _osc(ctx, 392, 0.48, 0.30, 0.40, 'sine', 0.02, d);
    _osc(ctx, 523, 0.72, 0.80, 0.40, 'sine', 0.02, d);
    _closeCtx(ctx, 1.7);
  } catch (e) {}
}
function playGameEndSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // G5→E5→C5 descending farewell
    _osc(ctx, 784, 0,    0.70, 0.55, 'sine', 0.01, d);
    _osc(ctx, 659, 0.58, 0.70, 0.55, 'sine', 0.01, d);
    _osc(ctx, 523, 1.16, 1.10, 0.55, 'sine', 0.01, d);
    // Triangle harmonic layer
    _osc(ctx, 392, 0,    0.75, 0.38, 'triangle', 0.02, d);
    _osc(ctx, 330, 0.58, 0.75, 0.38, 'triangle', 0.02, d);
    _osc(ctx, 262, 1.16, 1.15, 0.38, 'triangle', 0.02, d);
    // Final murmur fade
    _ns(ctx, 1.16, 1.05, 0.12, 0.22, 'lowpass', 450, 0.5, d);
    _closeCtx(ctx, 2.6);
  } catch (e) {}
}
function playErrorSound() {
  try {
    const ctx = _makeCtx(), d = _comp(ctx);
    // Descending dissonant sawtooth buzz
    _osc(ctx, 220, 0,    0.50, 0.70, 'sawtooth', 0.005, d);
    _osc(ctx, 165, 0.10, 0.50, 0.60, 'sawtooth', 0.005, d);
    _ns(ctx,  0,   0.58, 0.50, 0.005, 'lowpass', 160, 1.5, d);
    _closeCtx(ctx, 0.9);
  } catch (e) {}
}

// ── Public API ───────────────────────────────────────────────────────────────
export function playSound(type) {
  if (!soundSettings.master || !soundSettings[type]) return;
  _playSoundRaw(type);
}

export function previewSound(type) {
  _playSoundRaw(type);
}

function _playSoundRaw(type) {
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
  const p = document.getElementById('soundPanel');
  p.style.display = p.style.display === 'none' ? '' : 'none';
}

// Click-outside dismiss for both Sound panel AND Dev Tools panel.
// (Combined here because they share the same global listener; the Dev Tools
// branch will move to dev/panel.js when that subsystem is extracted.)
export function onSoundPanelClickOutside(e) {
  const panel = document.getElementById('soundPanel');
  const btn = document.getElementById('ptbSoundBtn');
  if (panel && panel.style.display !== 'none' && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
    panel.style.display = 'none';
  }
  const dbgPanel = document.getElementById('devToolsPanel');
  const dbgBtn = document.getElementById('btnDevTools');
  if (dbgPanel && dbgPanel.style.display !== 'none' && !dbgPanel.contains(e.target) && dbgBtn && !dbgBtn.contains(e.target)) {
    dbgPanel.style.display = 'none';
  }
}
