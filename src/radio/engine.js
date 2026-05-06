// ── Radio Engine
// Manages live-game terrestrial radio playback with HLS support.
// Encapsulates: radioAudio (HTML5 Audio), radioHls (HLS.js instance), radioCurrentTeamId
// Auto-pairs to focused game via pickRadioForFocus().

import { state } from '../state.js';
import { devTrace } from '../diag/devLog.js';
import { MLB_TEAM_RADIO, FALLBACK_RADIO, APPROVED_RADIO_TEAM_IDS } from './stations.js';

// Encapsulated radio state
let radioAudio = null;
let radioHls = null;
let radioCurrentTeamId = null;

export function pickRadioForFocus() {
  if (state.focusGamePk && state.gameStates[state.focusGamePk]) {
    var g = state.gameStates[state.focusGamePk];
    if (MLB_TEAM_RADIO[g.homeId] && APPROVED_RADIO_TEAM_IDS.has(g.homeId))
      return Object.assign({ teamId: g.homeId, abbr: g.homeAbbr }, MLB_TEAM_RADIO[g.homeId]);
    if (MLB_TEAM_RADIO[g.awayId] && APPROVED_RADIO_TEAM_IDS.has(g.awayId))
      return Object.assign({ teamId: g.awayId, abbr: g.awayAbbr }, MLB_TEAM_RADIO[g.awayId]);
  }
  return Object.assign({ teamId: null, abbr: '' }, FALLBACK_RADIO);
}

export function stopAllMedia(except) {
  if (except !== 'radio' && radioAudio && !radioAudio.paused) { stopRadio(); }
  if (except !== 'youtube') {
    var yt = document.getElementById('homeYoutubePlayer');
    if (yt && yt.contentWindow) {
      try {
        yt.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }), '*');
      } catch (e) { }
    }
  }
  if (except !== 'highlight') {
    document.querySelectorAll('video').forEach(function (v) { if (!v.paused) v.pause(); });
  }
}

export function toggleRadio() {
  if (radioAudio && !radioAudio.paused) { stopRadio(); }
  else { startRadio(); }
}

export function startRadio() {
  devTrace('radio', 'startRadio');
  stopAllMedia('radio');
  loadRadioStream(pickRadioForFocus());
}

export function loadRadioStream(pick) {
  if (radioHls) { try { radioHls.destroy(); } catch (e) { } radioHls = null; }
  if (!radioAudio) { radioAudio = new Audio(); radioAudio.preload = 'none'; }
  radioAudio.pause();
  radioCurrentTeamId = pick.teamId;
  var isHls = pick.format === 'hls';
  var nativeHls = radioAudio.canPlayType('application/vnd.apple.mpegurl');
  if (isHls && window.Hls && Hls.isSupported()) {
    radioHls = new Hls();
    radioHls.loadSource(pick.url);
    radioHls.attachMedia(radioAudio);
    radioHls.on(Hls.Events.ERROR, function (_, d) {
      if (d.fatal) { console.error('HLS fatal:', d); handleRadioError(new Error(d.details || 'HLS error')); }
    });
    radioAudio.play().then(function () { setRadioUI(true, pick); }).catch(handleRadioError);
  } else if (isHls && nativeHls) {
    radioAudio.src = pick.url;
    radioAudio.play().then(function () { setRadioUI(true, pick); }).catch(handleRadioError);
  } else {
    radioAudio.src = pick.url;
    radioAudio.play().then(function () { setRadioUI(true, pick); }).catch(handleRadioError);
  }
}

export function stopRadio() {
  devTrace('radio', 'stopRadio · was teamId=' + radioCurrentTeamId);
  if (radioAudio) { radioAudio.pause(); }
  if (radioHls) { try { radioHls.destroy(); } catch (e) { } radioHls = null; }
  radioCurrentTeamId = null;
  setRadioUI(false, null);
}

function handleRadioError(err) {
  console.error('Radio play failed:', err);
  alert('Radio failed: ' + (err && err.message ? err.message : 'unknown'));
  setRadioUI(false, null);
}

function setRadioUI(on, pick) {
  var t = document.getElementById('radioToggle'), k = document.getElementById('radioToggleKnob'), s = document.getElementById('radioStatusText');
  if (t) {
    if (on) {
      t.style.background = '#22c55e'; k.style.left = '21px';
      var label = pick && pick.name ? pick.name : 'Radio';
      if (pick && pick.abbr) label = pick.abbr + ' · ' + label;
      s.textContent = 'Playing · ' + label;
    } else {
      t.style.background = 'var(--border)'; k.style.left = '3px';
      s.textContent = 'Off · Auto-pairs to focus game';
    }
  }
  var ptbDot = document.getElementById('ptbRadioDot');
  if (ptbDot) ptbDot.style.display = on ? 'inline-block' : 'none';
}

export function updateRadioForFocus() {
  if (!radioAudio || radioAudio.paused) return;
  var pick = pickRadioForFocus();
  if (pick.teamId !== radioCurrentTeamId) loadRadioStream(pick);
}

export function getCurrentTeamId() {
  return radioCurrentTeamId;
}

export function getRadioAudio() {
  return radioAudio;
}
