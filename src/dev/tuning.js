// ── Dev Tools — Tuning UI + click delegator ────────────────────────────────
// Wraps the Dev Tools panel: open/close, tuning value editor, theme color
// lock + override capture, and the panel-wide delegated click dispatcher.

import { state } from '../state.js';
import { rotateStory } from '../carousel/rotation.js';
import { applyTeamTheme, applyPulseMLBTheme } from '../ui/theme.js';
import { toggleDemoMode } from '../demo/mode.js';
import { devTestVideoClip } from '../data/clips.js';
import {
  renderLogCapture, copyLogAsMarkdown, clearDevLog,
  renderAppState, copyAppStateAsMarkdown, _copyToClipboard,
  _stateAsMarkdownContext, _stateAsMarkdownGames, _stateAsMarkdownFeed,
  _stateAsMarkdownStories, _stateAsMarkdownFocus, _stateAsMarkdownPulse,
  renderNetTrace, copyNetTraceAsMarkdown, clearNetTrace,
  renderStorageInspector, clearLsKey, copyStorageAsMarkdown,
  renderSWInspector, copySWStateAsMarkdown, swForceUpdate, swUnregisterAndReload,
  testLocalNotification,
  renderLiveControls, forceFocusGo, forceRecapGo,
  copyDiagnosticSnapshot,
  renderDemoFeedsTester, testDemoFeedUrl,
} from './panels.js';
import { openYoutubeDebug } from './youtube-debug.js';
import { openVideoDebugPanel } from './video-debug.js';
import { openNewsSourceTest } from './news-test.js';
import { generateTestCard, resetCollection } from '../collection/book.js';
import { replayHRCard, replayRBICard } from '../cards/playerCard.js';
import { openRadioCheck } from '../radio/check.js';
import { previewSound } from '../ui/sound.js';
import { devTestClassicRadio } from '../radio/classic.js';
import { Recorder } from './recorder.js';
// DEBUG START: buzz handle health check
import { runBuzzCheck } from './buzz-check.js';
// DEBUG END: buzz handle health check

const DEBUG = false;

let _refreshDebugPanel = null;
let _devTuningDefaults = null;

export function setTuningCallbacks(cbs) {
  if (cbs.refreshDebugPanel) _refreshDebugPanel = cbs.refreshDebugPanel;
  if (cbs.devTuningDefaults) _devTuningDefaults = cbs.devTuningDefaults;
}

export function toggleDevTools() {
  const p = document.getElementById('devToolsPanel');
  const opening = p.style.display !== 'block';
  p.style.display = opening ? 'block' : 'none';
  if (opening) {
    document.getElementById('tuneRotateMs').value = state.devTuning.rotateMs;
    document.getElementById('tuneRbiThreshold').value = state.devTuning.rbiThreshold;
    document.getElementById('tuneRbiCooldown').value = state.devTuning.rbiCooldown;
    document.getElementById('tuneHRPriority').value = state.devTuning.hr_priority;
    document.getElementById('tuneHRCooldown').value = state.devTuning.hr_cooldown;
    document.getElementById('tuneBigInningPriority').value = state.devTuning.biginning_priority;
    document.getElementById('tuneBigInningThreshold').value = state.devTuning.biginning_threshold;
    document.getElementById('tuneWalkoffPriority').value = state.devTuning.walkoff_priority;
    document.getElementById('tuneNohitterFloor').value = state.devTuning.nohitter_inning_floor;
    document.getElementById('tuneBasesLoadedEnable').checked = state.devTuning.basesloaded_enable;
    document.getElementById('tuneBasesLoadedPriority').value = state.devTuning.basesloaded_priority;
    const tHF = document.getElementById('tuneHitstreakFloor'); if (tHF) tHF.value = state.devTuning.hitstreak_floor || 10;
    const tHP = document.getElementById('tuneHitstreakPriority'); if (tHP) tHP.value = state.devTuning.hitstreak_priority || 65;
    const tRI = document.getElementById('tuneRosterPriorityIL'); if (tRI) tRI.value = state.devTuning.roster_priority_il || 40;
    const tRT = document.getElementById('tuneRosterPriorityTrade'); if (tRT) tRT.value = state.devTuning.roster_priority_trade || 55;
    const tWL = document.getElementById('tuneWPLeverageFloor'); if (tWL) tWL.value = state.devTuning.wp_leverage_floor || 2;
    const tWE = document.getElementById('tuneWPExtremeFloor'); if (tWE) tWE.value = state.devTuning.wp_extreme_floor || 85;
    const tLP = document.getElementById('tuneLiveWPPriority'); if (tLP) tLP.value = state.devTuning.livewp_priority || 30;
    const tLR = document.getElementById('tuneLiveWPRefresh'); if (tLR) tLR.value = state.devTuning.livewp_refresh_ms || 90000;
    document.getElementById('tuneFocusCritical').value = state.devTuning.focus_critical;
    document.getElementById('tuneFocusHigh').value = state.devTuning.focus_high;
    document.getElementById('tuneFocusSwitchMargin').value = state.devTuning.focus_switch_margin;
    document.getElementById('tuneFocusAlertCooldown').value = state.devTuning.focus_alert_cooldown;
    document.getElementById('lockThemeToggle').checked = state.devColorLocked;
    Recorder._updateStatus();
    Recorder._updateButtonState();
  }
}

export function updateTuning(param, val) {
  if (param === 'basesloaded_enable') {
    state.devTuning[param] = val === 'true';
    if (DEBUG) console.log('✓ Bases Loaded ' + (state.devTuning[param] ? 'enabled' : 'disabled'));
    return;
  }
  const parsed = parseInt(val, 10);
  if (isNaN(parsed) || parsed < 1) return;
  state.devTuning[param] = parsed;
  if (param === 'rotateMs') {
    if (state.storyRotateTimer) { clearInterval(state.storyRotateTimer); state.storyRotateTimer = null; }
    if (state.pulseInitialized && !state.demoMode) state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
    if (DEBUG) console.log('✓ Carousel rotation updated to ' + parsed + 'ms');
  } else {
    if (DEBUG) console.log('✓ ' + param + ' updated to ' + parsed);
  }
}

export function resetTuning() {
  if (!_devTuningDefaults) return;
  state.devTuning = Object.assign({}, _devTuningDefaults);
  document.getElementById('tuneRotateMs').value = _devTuningDefaults.rotateMs;
  document.getElementById('tuneRbiThreshold').value = _devTuningDefaults.rbiThreshold;
  document.getElementById('tuneRbiCooldown').value = _devTuningDefaults.rbiCooldown;
  document.getElementById('tuneHRPriority').value = _devTuningDefaults.hr_priority;
  document.getElementById('tuneHRCooldown').value = _devTuningDefaults.hr_cooldown;
  document.getElementById('tuneBigInningPriority').value = _devTuningDefaults.biginning_priority;
  document.getElementById('tuneBigInningThreshold').value = _devTuningDefaults.biginning_threshold;
  document.getElementById('tuneWalkoffPriority').value = _devTuningDefaults.walkoff_priority;
  document.getElementById('tuneNohitterFloor').value = _devTuningDefaults.nohitter_inning_floor;
  document.getElementById('tuneBasesLoadedEnable').checked = _devTuningDefaults.basesloaded_enable;
  document.getElementById('tuneBasesLoadedPriority').value = _devTuningDefaults.basesloaded_priority;
  document.getElementById('tuneFocusCritical').value = _devTuningDefaults.focus_critical;
  document.getElementById('tuneFocusHigh').value = _devTuningDefaults.focus_high;
  document.getElementById('tuneFocusSwitchMargin').value = _devTuningDefaults.focus_switch_margin;
  document.getElementById('tuneFocusAlertCooldown').value = _devTuningDefaults.focus_alert_cooldown;
  if (state.storyRotateTimer) { clearInterval(state.storyRotateTimer); state.storyRotateTimer = null; }
  if (state.pulseInitialized && !state.demoMode) state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
  if (DEBUG) console.log('✓ Dev tuning reset to defaults');
}

export function updateColorOverride(context, colorVar, value) {
  state.devColorOverrides[context][colorVar] = value;
  if (state.devColorLocked) {
    if (context === 'app') applyTeamTheme(state.activeTeam);
    else applyPulseMLBTheme();
  }
  if (DEBUG) console.log('✓ ' + context + ' theme.' + colorVar + ' → ' + value);
}

export function captureCurrentTheme(context) {
  const cssVarMap = { dark: '--dark', card: '--card', card2: '--card2', border: '--border', primary: '--primary', secondary: '--secondary', accent: '--accent', accentText: '--accent-text', headerText: '--header-text' };
  const root = document.documentElement;
  Object.keys(cssVarMap).forEach(function(v) {
    const cssVal = getComputedStyle(root).getPropertyValue(cssVarMap[v]).trim();
    state.devColorOverrides[context][v] = cssVal;
    const elId = 'color' + context.charAt(0).toUpperCase() + context.slice(1) + v.charAt(0).toUpperCase() + v.slice(1);
    const el = document.getElementById(elId);
    if (el) el.value = cssVal;
  });
  if (DEBUG) console.log('✓ Captured current ' + context + ' theme colors');
}

export function toggleColorLock(enable) {
  state.devColorLocked = enable;
  if (enable) {
    if (!state.devColorOverrides.app.primary) captureCurrentTheme('app');
    if (!state.devColorOverrides.pulse.primary) captureCurrentTheme('pulse');
    applyTeamTheme(state.activeTeam);
    if (DEBUG) console.log('✓ Theme lock enabled — auto-switching disabled');
  } else {
    applyTeamTheme(state.activeTeam);
    applyPulseMLBTheme();
    if (DEBUG) console.log('✓ Theme lock disabled — auto-switching restored');
  }
  document.getElementById('lockThemeToggle').checked = state.devColorLocked;
}

export function confirmDevToolsChanges() {
  const fields = [
    ['rotateMs', 'tuneRotateMs'], ['rbiThreshold', 'tuneRbiThreshold'], ['rbiCooldown', 'tuneRbiCooldown'],
    ['hr_priority', 'tuneHRPriority'], ['hr_cooldown', 'tuneHRCooldown'],
    ['biginning_priority', 'tuneBigInningPriority'], ['biginning_threshold', 'tuneBigInningThreshold'],
    ['walkoff_priority', 'tuneWalkoffPriority'], ['nohitter_inning_floor', 'tuneNohitterFloor'],
    ['basesloaded_priority', 'tuneBasesLoadedPriority'],
    ['hitstreak_floor', 'tuneHitstreakFloor'], ['hitstreak_priority', 'tuneHitstreakPriority'],
    ['roster_priority_il', 'tuneRosterPriorityIL'], ['roster_priority_trade', 'tuneRosterPriorityTrade'],
    ['wp_leverage_floor', 'tuneWPLeverageFloor'], ['wp_extreme_floor', 'tuneWPExtremeFloor'],
    ['livewp_priority', 'tuneLiveWPPriority'], ['livewp_refresh_ms', 'tuneLiveWPRefresh'],
    ['focus_critical', 'tuneFocusCritical'], ['focus_high', 'tuneFocusHigh'],
    ['focus_switch_margin', 'tuneFocusSwitchMargin'], ['focus_alert_cooldown', 'tuneFocusAlertCooldown']
  ];
  fields.forEach(function(f) { const el = document.getElementById(f[1]); if (el && el.value !== '') updateTuning(f[0], el.value); });
  const btn = document.getElementById('devConfirmBtn');
  btn.textContent = '✓ Applied!'; btn.classList.add('applied');
  setTimeout(function() { btn.textContent = 'Confirm Changes'; btn.classList.remove('applied'); }, 1500);
}

// Delegated click handler — replaces ~40 inline onclicks on the Dev Tools panel.
// IMPORTANT: the bundle is loaded via dynamic <script> insertion (see index.html),
// which makes it execute async — DOMContentLoaded may have already fired by the
// time this runs. Guard with readyState so we attach immediately in that case.
export function initDevToolsClickDelegator() {
  function attach() {
    const panel = document.getElementById('devToolsPanel');
    if (!panel) return;
    panel.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-dt-action]');
      if (!btn) return;
      const action = btn.dataset.dtAction;
      if      (action === 'close')             { toggleDevTools(); }
      else if (action === 'demo')              { toggleDemoMode(); toggleDevTools(); }
      else if (action === 'replayHR')          { replayHRCard(); toggleDevTools(); }
      else if (action === 'replayRBI')         { replayRBICard(); toggleDevTools(); }
      else if (action === 'cardVariants')      { window.PulseCard.demo(); toggleDevTools(); }
      else if (action === 'testCard')          { generateTestCard(); toggleDevTools(); }
      else if (action === 'testClip')          { devTestVideoClip(); toggleDevTools(); }
      else if (action === 'resetCollection')   { resetCollection(); }
      else if (action === 'newsTest')          { openNewsSourceTest(); toggleDevTools(); }
      else if (action === 'youtubeDebug')      { openYoutubeDebug(); toggleDevTools(); }
      else if (action === 'videoDebug')        { openVideoDebugPanel(); toggleDevTools(); }
      else if (action === 'radioCheck')        { openRadioCheck(); toggleDevTools(); }
      else if (action === 'testClassicRadio')  { devTestClassicRadio(); }
      else if (action === 'openDemoFeeds')     {
        const det = document.getElementById('demoFeedsDetails');
        if (det) { det.open = true; renderDemoFeedsTester(); }
      }
      else if (action === 'demoFeedPlay') {
        const url = btn.dataset.demoFeedUrl;
        if (url) testDemoFeedUrl(url);
      }
      else if (action === 'resetTuning')       { resetTuning(); }
      else if (action === 'captureApp')        { captureCurrentTheme('app'); }
      else if (action === 'capturePulse')      { captureCurrentTheme('pulse'); }
      else if (action === 'refreshDebug')      { if (_refreshDebugPanel) _refreshDebugPanel(); }
      else if (action === 'copyLog')           { copyLogAsMarkdown(); }
      else if (action === 'clearLog')          { clearDevLog(); }
      else if (action === 'refreshLog')        { renderLogCapture(); }
      else if (action === 'copyState')         { copyAppStateAsMarkdown(); }
      else if (action === 'refreshState')      { renderAppState(); }
      else if (action === 'copyStateContext')  { _copyToClipboard(_stateAsMarkdownContext()); }
      else if (action === 'copyStatePulse')    { _copyToClipboard(_stateAsMarkdownPulse()); }
      else if (action === 'copyStateFocus')    { _copyToClipboard(_stateAsMarkdownFocus()); }
      else if (action === 'copyStateGames')    { _copyToClipboard(_stateAsMarkdownGames()); }
      else if (action === 'copyStateFeed')     { _copyToClipboard(_stateAsMarkdownFeed(50)); }
      else if (action === 'copyStateStories')  { _copyToClipboard(_stateAsMarkdownStories()); }
      else if (action === 'copyNet')           { copyNetTraceAsMarkdown(); }
      else if (action === 'clearNet')          { clearNetTrace(); }
      else if (action === 'refreshNet')        { renderNetTrace(); }
      else if (action === 'copyStorage')       { copyStorageAsMarkdown(); }
      else if (action === 'refreshStorage')    { renderStorageInspector(); }
      else if (action === 'clearLsKey')        { clearLsKey(btn.dataset.lsKey); }
      else if (action === 'copySW')            { copySWStateAsMarkdown(); }
      else if (action === 'swUpdate')          { swForceUpdate(); }
      else if (action === 'swUnregister')      { swUnregisterAndReload(); }
      else if (action === 'testNotif')         { testLocalNotification(); }
      else if (action === 'forceFocusGo')      { forceFocusGo(); }
      else if (action === 'forceRecapGo')      { forceRecapGo(); }
      else if (action === 'copySnapshot')      { copyDiagnosticSnapshot(); }
      else if (action === 'previewSound')       { previewSound(btn.dataset.soundType); }
      else if (action === 'recorderToggle')    { Recorder.toggle(); }
      else if (action === 'recorderDownload')  { Recorder.download(); }
      else if (action === 'recorderCopy')      { Recorder.copy(); }
      else if (action === 'recorderReset')     { Recorder.reset(); }
      else if (action === 'confirm')           { confirmDevToolsChanges(); }
      // DEBUG START: buzz handle health check
      else if (action === 'buzzCheck')         { runBuzzCheck(); }
      // DEBUG END: buzz handle health check
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
}
