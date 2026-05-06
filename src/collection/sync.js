import { state } from '../state.js';
import { API_BASE, TIMING } from '../config/constants.js';

let syncCallbacks = { loadCollection: null, saveCollection: null, updateCollectionUI: null };
function setSyncCallbacks(callbacks) {
  Object.assign(syncCallbacks, callbacks);
}

const DEBUG = false;

async function syncCollection() {
  if (!state.mlbSessionToken) return;
  try {
    const local = syncCallbacks.loadCollection ? syncCallbacks.loadCollection() : {};
    const r = await fetch((window.API_BASE || API_BASE || '') + '/api/collection-sync', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.mlbSessionToken },
      body: JSON.stringify({ localCollection: local })
    });
    if (r.ok) {
      const data = await r.json();
      if (data.collection) {
        if (syncCallbacks.saveCollection) syncCallbacks.saveCollection(data.collection);
        if (DEBUG) console.log('[Sync] Collection synced', Object.keys(data.collection).length, 'cards');
      }
    }
  } catch (e) { console.error('[Sync] Collection error', e); }
}

async function mergeCollectionOnSignIn() {
  if (!state.mlbSessionToken) return;
  try {
    const r = await fetch((window.API_BASE || API_BASE || '') + '/api/collection/sync?token=' + state.mlbSessionToken);
    if (r.ok) {
      const data = await r.json();
      if (data.collection && Object.keys(data.collection).length > 0) {
        const local = syncCallbacks.loadCollection ? syncCallbacks.loadCollection() : {};
        const merged = mergeCollectionSlots(local, data.collection);
        if (syncCallbacks.saveCollection) syncCallbacks.saveCollection(merged);
        if (syncCallbacks.updateCollectionUI) syncCallbacks.updateCollectionUI();
        if (DEBUG) console.log('[Sync] Merged', Object.keys(merged).length, 'cards from server');
      }
    }
  } catch (e) { console.error('[Sync] Merge error', e); }
}

function mergeCollectionSlots(local, remote) {
  function tierRank(t) { const ranks = { legendary: 4, epic: 3, rare: 2, common: 1 }; return ranks[t] || 0; }
  const merged = { ...local, ...remote };
  Object.keys(local).forEach(k => {
    if (remote[k]) {
      const lr = tierRank(local[k].tier), rr = tierRank(remote[k].tier);
      if (lr > rr) { merged[k] = local[k]; }
      else if (rr > lr) { merged[k] = remote[k]; }
      else {
        const newer = local[k].collectedAt >= remote[k].collectedAt ? local[k] : remote[k];
        const em = new Map();
        (local[k].events || []).forEach(e => em.set(e.date + ':' + e.badge, e));
        (remote[k].events || []).forEach(e => em.set(e.date + ':' + e.badge, e));
        const events = Array.from(em.values()).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
        merged[k] = { ...newer, events: events };
      }
    }
  });
  return merged;
}

function startSyncInterval() {
  if (state.mlbSyncInterval) return;
  state.mlbSyncInterval = setInterval(async () => {
    syncCollection();
  }, TIMING.SYNC_INTERVAL_MS);
}

export { setSyncCallbacks, syncCollection, mergeCollectionOnSignIn, mergeCollectionSlots, startSyncInterval };
