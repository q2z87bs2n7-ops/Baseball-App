// ── 🎙️ Classic Radio (POC)
// Streams full-length classic MLB radio broadcasts from archive.org as
// background atmosphere. No timestamp sync — picks a random URL from a
// hardcoded pool and a random offset between 30 min and 90 min into the
// broadcast (skipping pre-game and post-game). Used for Demo Mode
// classic-game vibe.
//
// Coexists with the live radio system in src/radio/engine.js by stopping
// it on activation and instructing setFocusGame to skip
// updateRadioForFocus while classic is active (see isClassicActive
// check in src/focus/mode.js).

import { stopRadio } from './engine.js';

const POC_POOL = [
  'https://archive.org/download/classicmlbbaseballradio/1969%2010%2016%20New%20York%20Mets%20vs%20Baltimore%20Orioles%20World%20Series%20Game%205.mp3',
  'https://archive.org/download/classicmlbbaseballradio/1970%2004%2022%20Padres%20vs%20New%20York%20Mets%20Seaver%2019ks%20Complete%20Broadcast%20Bob%20Murphy.mp3',
  'https://archive.org/download/classicmlbbaseballradio/19570805GiantsAtDodgersvinScullyRadioBroadcast.mp3',
  'https://archive.org/download/classicmlbbaseballradio/1968%2009%2028%20Yankees%20vs%20Red%20Sox%20Mantles%20FINAL%20Game%20Messer%20Coleman%20Rizzuto%20Radio%20Broadcast.mp3',
];

let _audio = null;
// _active reflects user intent — set true when the user explicitly turns
// classic radio on (via dev button or future settings toggle), false when
// they pause/stop or exit demo. Focus-switch re-rolls only fire while
// _active is true so we don't surprise users with autoplay.
let _active = false;

function ensureAudio() {
  if (_audio) return _audio;
  _audio = document.createElement('audio');
  _audio.id = 'classicRadioAudio';
  _audio.preload = 'none';
  // No crossOrigin attribute — plain media playback uses no-cors mode
  // which archive.org allows. Only set it if we ever want Web Audio API
  // sample access (visualizers etc.).
  _audio.volume = 0.4;
  document.body.appendChild(_audio);
  _audio.addEventListener('error', function() {
    console.warn('classic radio: audio element error', _audio.error);
  });
  return _audio;
}

function pickRandomUrl() {
  return POC_POOL[Math.floor(Math.random() * POC_POOL.length)];
}

function pickOffset(dur) {
  // Random in [30min, 90min] — skips pre-game intros and post-game
  // sign-offs. Caps to dur-60s if the file is shorter than 91 min.
  var minS = 30 * 60;
  var maxS = 90 * 60;
  if (dur && dur < maxS + 60) maxS = Math.max(minS, dur - 60);
  if (maxS <= minS) return minS;
  return minS + Math.random() * (maxS - minS);
}

// Internal: load `url`, wait for metadata, jump to a random in-game
// offset, play. Same URL re-roll skips the metadata round-trip.
function _playUrl(url) {
  if (!url) return;
  var a = ensureAudio();
  if (a.src && a.src.indexOf(url) !== -1 && a.readyState >= 2 && a.duration) {
    a.currentTime = pickOffset(a.duration);
    a.play().catch(function(e) { console.warn('classic radio: play blocked', e); });
    return;
  }
  a.pause();
  a.src = url;
  a.load();
  var onMeta = function() {
    a.removeEventListener('loadedmetadata', onMeta);
    var dur = a.duration || 0;
    if (dur > 60) a.currentTime = pickOffset(dur);
    a.play().catch(function(e) { console.warn('classic radio: play blocked', e); });
  };
  a.addEventListener('loadedmetadata', onMeta);
}

// Pick a random URL from the pool and play at a random in-game offset.
// Sets _active = true so subsequent focus-switch re-rolls fire. Also
// silences the live radio engine so the user doesn't hear Fox Sports
// (or any other live stream) on top of the classic broadcast.
export function playClassicRandom() {
  _active = true;
  try { stopRadio(); } catch (e) {}
  _playUrl(pickRandomUrl());
}

export function pauseClassic() {
  _active = false;
  if (_audio) _audio.pause();
}

export function stopClassic() {
  _active = false;
  if (!_audio) return;
  _audio.pause();
  _audio.removeAttribute('src');
  _audio.load();
}

export function isClassicActive() {
  return _active;
}

export function isClassicPlaying() {
  return !!(_audio && !_audio.paused && !_audio.ended);
}

export function setClassicVolume(v) {
  ensureAudio().volume = Math.max(0, Math.min(1, v));
}

// Called by setFocusGame on every focus change. Re-rolls a fresh URL +
// offset so the user gets a new bit of classic atmosphere whenever they
// switch games. No-op when classic radio isn't active.
export function rollClassicOnSwitch() {
  if (!_active) return;
  _playUrl(pickRandomUrl());
}

// Dev Tools toggle: starts classic radio if off, pauses if on.
export function devTestClassicRadio() {
  if (_active) {
    pauseClassic();
  } else {
    playClassicRandom();
  }
}
