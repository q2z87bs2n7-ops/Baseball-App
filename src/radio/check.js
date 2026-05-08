// Radio Check sweep tool — verifies every team's flagship stream + fallback.
// Self-contained dev/QA overlay. No deps on Pulse poll loop or core state mutations.
import { state } from '../state.js';
import { TEAMS } from '../config/constants.js';
import { devTrace } from '../devtools-feed/devLog.js';
import {
  MLB_TEAM_RADIO, FALLBACK_RADIO, RADIO_CHECK_DEFAULT_NOTES,
} from './stations.js';
import {
  loadRadioStream, stopRadio, getRadioAudio,
} from './engine.js';

let checkCallbacks = { toggleSettings: null };
export function setRadioCheckCallbacks(cb) {
  Object.assign(checkCallbacks, cb);
}

// key: teamId or 'fallback' → 'yes'|'no' (absent = untested)
let radioCheckResults = {};
// key: teamId or 'fallback' → free-text note
let radioCheckNotes = {};
let radioCheckPlayingKey = null;

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}

function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
}

function loadRadioCheckResults() {
  try { var s = localStorage.getItem('mlb_radio_check'); if (s) radioCheckResults = JSON.parse(s) || {}; }
  catch (e) { radioCheckResults = {}; }
  try { var n = localStorage.getItem('mlb_radio_check_notes'); if (n) radioCheckNotes = JSON.parse(n) || {}; }
  catch (e) { radioCheckNotes = {}; }
  // One-time seed of default notes (preserves user-entered notes — only fills empty keys).
  try {
    if (!localStorage.getItem('mlb_radio_check_notes_seeded_v2')) {
      Object.keys(RADIO_CHECK_DEFAULT_NOTES).forEach(function(k) {
        if (!radioCheckNotes[k]) radioCheckNotes[k] = RADIO_CHECK_DEFAULT_NOTES[k];
      });
      saveRadioCheckNotes();
      localStorage.setItem('mlb_radio_check_notes_seeded_v2', '1');
    }
  } catch (e) {}
}
function saveRadioCheckResults() {
  try { localStorage.setItem('mlb_radio_check', JSON.stringify(radioCheckResults)); } catch (e) {}
}
function saveRadioCheckNotes() {
  try { localStorage.setItem('mlb_radio_check_notes', JSON.stringify(radioCheckNotes)); } catch (e) {}
}

export function openRadioCheck() {
  loadRadioCheckResults();
  document.getElementById('radioCheckOverlay').style.display = 'flex';
  renderRadioCheckList();
  if (checkCallbacks.toggleSettings) checkCallbacks.toggleSettings(); // close settings panel
}
export function closeRadioCheck() {
  document.getElementById('radioCheckOverlay').style.display = 'none';
  radioCheckStop();
}

function radioCheckEntries() {
  var entries = [];
  Object.keys(MLB_TEAM_RADIO).forEach(function(tid) {
    var team = TEAMS.find(function(t) { return t.id === +tid; });
    entries.push({ key: tid, teamId: +tid, teamName: team ? team.name : 'Team ' + tid, abbr: team ? team.short : '', station: MLB_TEAM_RADIO[tid].name, url: MLB_TEAM_RADIO[tid].url, format: MLB_TEAM_RADIO[tid].format });
  });
  entries.sort(function(a, b) { return a.teamName.localeCompare(b.teamName); });
  entries.push({ key: 'fallback', teamId: null, teamName: '(Fallback)', abbr: '', station: FALLBACK_RADIO.name, url: FALLBACK_RADIO.url, format: FALLBACK_RADIO.format });
  return entries;
}

function renderRadioCheckList() {
  var list = document.getElementById('radioCheckList');
  if (!list) return;
  var entries = radioCheckEntries();
  var html = entries.map(function(e) {
    var status = radioCheckResults[e.key] || '';
    var note = (radioCheckNotes[e.key] || '').replace(/"/g, '&quot;');
    var playing = radioCheckPlayingKey === e.key;
    var gameLive = radioCheckTeamHasLiveGame(e.teamId);
    return '<div style="padding:0.5rem 0.625rem;border-bottom:1px solid var(--border);' + (playing ? 'background:rgba(34,197,94,.08)' : '') + '">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<button onclick="radioCheckPlay(\'' + e.key + '\')" style="background:' + (playing ? '#22c55e' : 'var(--card2)') + ';border:1px solid var(--border);color:' + (playing ? '#000' : 'var(--text)') + ';font-size:.7rem;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:700;flex-shrink:0;min-width:36px">▶</button>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
            '<span style="font-size:.78rem;font-weight:700;color:var(--text)">' + e.teamName + (e.abbr ? ' <span style="color:var(--muted);font-weight:500">· ' + e.abbr + '</span>' : '') + '</span>' +
            (gameLive ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(34,197,94,.15);border:1px solid #22c55e;border-radius:10px;padding:1px 6px;font-size:.6rem;font-weight:700;color:#22c55e">● GAME ON</span>' : '') +
          '</div>' +
          '<div style="font-size:.66rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.station + ' · ' + e.format.toUpperCase() + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0">' +
          '<button onclick="radioCheckSet(\'' + e.key + '\',\'yes\')" title="Tap again to clear" style="cursor:pointer;background:' + (status === 'yes' ? '#22c55e' : 'var(--card2)') + ';color:' + (status === 'yes' ? '#000' : 'var(--text)') + ';border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">✅</button>' +
          '<button onclick="radioCheckSet(\'' + e.key + '\',\'no\')" title="Tap again to clear" style="cursor:pointer;background:' + (status === 'no' ? '#e03030' : 'var(--card2)') + ';color:' + (status === 'no' ? '#fff' : 'var(--text)') + ';border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">❌</button>' +
        '</div>' +
      '</div>' +
      '<input type="text" value="' + note + '" oninput="radioCheckSetNote(\'' + e.key + '\',this.value)" placeholder="Notes (e.g. plays ads during games)" style="margin-top:6px;width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 8px;border-radius:6px;box-sizing:border-box">' +
    '</div>';
  }).join('');
  var done = Object.values(radioCheckResults).filter(function(v) { return v === 'yes' || v === 'no'; }).length;
  var summary = '<div style="padding:0.5rem 0.625rem;font-size:.7rem;color:var(--muted);text-align:center">' + done + ' of ' + entries.length + ' checked</div>';
  list.innerHTML = summary + html;
}

function radioCheckTeamHasLiveGame(teamId) {
  if (!teamId) return false;
  return Object.values(state.gameStates).some(function(g) {
    return g.status === 'Live' && g.detailedState === 'In Progress' && (g.awayId === teamId || g.homeId === teamId);
  });
}

export function radioCheckPlay(key) {
  var entries = radioCheckEntries();
  var e = entries.find(function(x) { return x.key === key; });
  if (!e) return;
  radioCheckPlayingKey = key;
  var pick = { teamId: e.teamId, abbr: e.abbr, name: e.station, url: e.url, format: e.format };
  loadRadioStream(pick);
  renderRadioCheckList();
}

// 🧪 Custom URL — paste any stream URL and play through the existing radio engine.
// Overrides whatever's currently playing. Format auto-detected from extension if 'auto'.
export function radioCheckTryCustom() {
  var url = (document.getElementById('radioCustomUrl') || {}).value || '';
  url = url.trim();
  var status = document.getElementById('radioCustomStatus');
  if (!url) { if (status) status.textContent = 'Paste a URL first.'; return; }
  if (!/^https?:\/\//i.test(url)) { if (status) status.textContent = 'URL must start with http:// or https://'; return; }
  var fmtSel = (document.getElementById('radioCustomFmt') || {}).value || 'auto';
  var fmt = fmtSel;
  if (fmt === 'auto') fmt = /\.m3u8(\?|$)/i.test(url) ? 'hls' : 'mp3';
  if (status) status.innerHTML = '<span style="color:var(--text)">Loading · format=' + fmt + '…</span>';
  var pick = { teamId: null, abbr: 'TEST', name: 'Custom · ' + (fmt === 'hls' ? 'HLS' : 'MP3'), url: url, format: fmt };
  radioCheckPlayingKey = null; // not a known entry
  devTrace('radio', 'custom URL · fmt=' + fmt + ' · ' + url);
  // Briefly hook into the audio element to surface play/error to the dev panel
  try {
    var audio = getRadioAudio() || new Audio();
    var onPlay = function() { if (status) status.innerHTML = '<span style="color:#22c55e">✅ Playing · ' + fmt.toUpperCase() + ' · ' + escHtml(url.length > 80 ? url.slice(0, 80) + '…' : url) + '</span>'; audio.removeEventListener('playing', onPlay); };
    var onErr = function(e) { if (status) status.innerHTML = '<span style="color:#ff6b6b">❌ Failed · ' + (e && e.message || 'audio error') + '</span>'; audio.removeEventListener('error', onErr); };
    audio.addEventListener('playing', onPlay, { once: true });
    audio.addEventListener('error', onErr, { once: true });
  } catch (e) {}
  loadRadioStream(pick);
  renderRadioCheckList();
}

export function radioCheckStop() {
  radioCheckPlayingKey = null;
  var audio = getRadioAudio();
  if (audio && !audio.paused) stopRadio();
  if (document.getElementById('radioCheckOverlay').style.display !== 'none') renderRadioCheckList();
  var st = document.getElementById('radioCustomStatus');
  if (st) st.textContent = 'Stopped.';
}

export function radioCheckSet(key, val) {
  if (radioCheckResults[key] === val) delete radioCheckResults[key];
  else radioCheckResults[key] = val;
  saveRadioCheckResults();
  renderRadioCheckList();
}
export function radioCheckSetNote(key, val) {
  if (val) radioCheckNotes[key] = val;
  else delete radioCheckNotes[key];
  saveRadioCheckNotes();
}
export function radioCheckReset() {
  radioCheckResults = {};
  radioCheckNotes = {};
  saveRadioCheckResults();
  saveRadioCheckNotes();
  renderRadioCheckList();
}
export function radioCheckCopy() {
  var entries = radioCheckEntries();
  var lines = ['MLB Radio Check Results', 'Date: ' + new Date().toISOString().slice(0, 10), ''];
  var works = [], broken = [], untested = [];
  entries.forEach(function(e) {
    var s = radioCheckResults[e.key];
    var note = radioCheckNotes[e.key] || '';
    var block = ['• ' + e.teamName + (e.abbr ? ' (' + e.abbr + ')' : '') + ' — ' + e.station + ' — ' + e.url];
    if (note) block.push('  📝 ' + note);
    if (s === 'yes') works.push.apply(works, block);
    else if (s === 'no') broken.push.apply(broken, block);
    else untested.push.apply(untested, block);
  });
  lines.push('✅ WORKS (' + works.filter(function(l) { return l.charAt(0) === '•'; }).length + '):'); lines.push.apply(lines, works.length ? works : ['  (none marked)']); lines.push('');
  lines.push('❌ BROKEN (' + broken.filter(function(l) { return l.charAt(0) === '•'; }).length + '):'); lines.push.apply(lines, broken.length ? broken : ['  (none marked)']); lines.push('');
  if (untested.length) { lines.push('⏳ UNTESTED (' + untested.filter(function(l) { return l.charAt(0) === '•'; }).length + '):'); lines.push.apply(lines, untested); }
  var text = lines.join('\n');
  var btn = document.getElementById('radioCheckCopyBtn');
  function flash(msg) { if (!btn) return; var orig = btn.textContent; btn.textContent = msg; setTimeout(function() { btn.textContent = orig; }, 1800); }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() { flash('✓ Copied!'); }, function() { fallbackCopy(text); flash('✓ Copied (fallback)'); });
  } else {
    fallbackCopy(text); flash('✓ Copied (fallback)');
  }
}
