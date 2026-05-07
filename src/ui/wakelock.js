// Screen Wake Lock API wrapper. Used during Pulse to keep the screen on
// while live games stream. Gracefully no-ops on unsupported browsers
// (Firefox, older Safari) where navigator.wakeLock is undefined.

let screenWakeLock = null;

export async function requestScreenWakeLock() {
  if (!navigator.wakeLock) return;
  try {
    screenWakeLock = await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release', () => { screenWakeLock = null; });
  } catch (e) {
    console.warn('Wake lock request failed:', e);
  }
}

export async function releaseScreenWakeLock() {
  if (screenWakeLock) {
    try {
      await screenWakeLock.release();
      screenWakeLock = null;
    } catch (e) {
      console.warn('Wake lock release failed:', e);
    }
  }
}
