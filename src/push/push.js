// Web Push subscription lifecycle. Toggles user opt-in for game-start
// notifications. Subscriptions are stored in Upstash Redis via
// /api/subscribe (Vercel function); the cron in api/notify.js fans out
// notifications when games are starting.
//
// togglePush is exposed on window via the bridge in main.js for the
// settings-panel toggle. Hidden on desktop via CSS in styles.css —
// push is mobile-only by design.

import { API_BASE } from '../config/constants.js';

export const VAPID_PUBLIC_KEY = 'BPI_UHKC-1UI9uIacuEooLwnRaRcGgIf1tji_5PiNhr6lcpQrgs2PqKyhfdhsYtxSxaUaENoAiZ7781iBvOlZWE';

export function urlBase64ToUint8Array(b64) {
  var pad = '='.repeat((4 - b64.length % 4) % 4);
  var raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function subscribeToPush() {
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await fetch((API_BASE || '') + '/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    localStorage.setItem('mlb_push', '1');
    document.getElementById('pushStatusText').textContent = 'On';
  } catch (err) {
    document.getElementById('pushToggle').style.background = 'var(--border)';
    document.getElementById('pushToggleKnob').style.left = '3px';
    document.getElementById('pushStatusText').textContent = 'Permission Denied';
  }
}

export async function unsubscribeFromPush() {
  try {
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch((API_BASE || '') + '/api/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    }
  } catch (e) {}
  localStorage.removeItem('mlb_push');
  document.getElementById('pushStatusText').textContent = 'Off';
}

export function togglePush() {
  var tog = document.getElementById('pushToggle');
  var knob = document.getElementById('pushToggleKnob');
  var enabled = localStorage.getItem('mlb_push') === '1';
  if (!enabled) {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      document.getElementById('pushStatusText').textContent = 'Not Supported On This Browser';
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      document.getElementById('pushStatusText').textContent = 'Push Not Configured Yet';
      return;
    }
    tog.style.background = 'var(--secondary)';
    knob.style.left = '21px';
    subscribeToPush();
  } else {
    tog.style.background = 'var(--border)';
    knob.style.left = '3px';
    unsubscribeFromPush();
  }
}
