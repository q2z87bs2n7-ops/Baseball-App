// ── 🎙️ Classic Radio (POC)
// Streams full-length classic MLB radio broadcasts from archive.org as
// background atmosphere. No timestamp sync — picks a random offset each
// time playClassic() is called. Used for Demo Mode classic-game vibe;
// does not interact with the live radio system in src/radio/engine.js.

let _audio = null;
let _currentUrl = null;

function ensureAudio() {
  if (_audio) return _audio;
  _audio = document.createElement('audio');
  _audio.id = 'classicRadioAudio';
  _audio.preload = 'none';
  // No crossOrigin set — for plain <audio> playback we can stream as
  // "no-cors" media which archive.org allows. Only set crossOrigin if
  // we ever need to read sample data via Web Audio API (visualizers etc).
  _audio.volume = 0.4;
  document.body.appendChild(_audio);
  _audio.addEventListener('error', function() {
    console.warn('classic radio: audio element error', _audio.error);
  });
  return _audio;
}

// Start streaming `url`, jumping to a random offset between 60 s and
// duration - 60 s once metadata loads. Calling again with the same URL
// picks a new random offset; calling with a different URL switches.
export function playClassic(url) {
  if (!url) return;
  var a = ensureAudio();
  // If same URL is already loaded and ready, just re-roll the offset
  // and resume — saves the metadata fetch round-trip.
  if (_currentUrl === url && a.readyState >= 2 && a.duration) {
    a.currentTime = pickOffset(a.duration);
    a.play().catch(function(e) { console.warn('classic radio: play blocked', e); });
    return;
  }
  _currentUrl = url;
  a.pause();
  a.src = url;
  a.load();
  var onMeta = function() {
    a.removeEventListener('loadedmetadata', onMeta);
    var dur = a.duration || 0;
    if (dur > 120) a.currentTime = pickOffset(dur);
    a.play().catch(function(e) { console.warn('classic radio: play blocked', e); });
  };
  a.addEventListener('loadedmetadata', onMeta);
}

function pickOffset(dur) {
  // Avoid first/last 60 seconds — usually pre-game intro / sign-off
  return 60 + Math.random() * Math.max(0, dur - 120);
}

export function pauseClassic() {
  if (_audio) _audio.pause();
}

export function stopClassic() {
  if (!_audio) return;
  _audio.pause();
  _audio.removeAttribute('src');
  _audio.load();
  _currentUrl = null;
}

export function isClassicPlaying() {
  return !!(_audio && !_audio.paused && !_audio.ended);
}

export function setClassicVolume(v) {
  ensureAudio().volume = Math.max(0, Math.min(1, v));
}

// POC convenience: one button toggles play/pause for the hardcoded test
// URL, re-rolling the random offset on each play. Wired from Dev Tools.
const POC_TEST_URL = 'https://archive.org/download/classicmlbbaseballradio/1963%2006%2009%20New%20York%20Mets%20vs%20Cardinals%20Complete%20Radio%20Broadcast.mp3';

export function devTestClassicRadio() {
  if (isClassicPlaying()) {
    pauseClassic();
    return;
  }
  playClassic(POC_TEST_URL);
}
