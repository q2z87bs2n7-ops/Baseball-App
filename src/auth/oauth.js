// OAuth + email-magic-link sign-in initiators. Both are fire-and-forget:
// signInWithGitHub triggers a redirect; signInWithEmail kicks off an
// out-of-band email flow. The session-token state, signOut, sync interval,
// and updateSyncUI all live in main.js for now — they depend on the
// collection module which has not been extracted yet.

import { API_BASE } from '../config/constants.js';

export function signInWithGitHub() {
  const state = Math.random().toString(36).slice(2, 15);
  const githubAuthUrl = 'https://github.com/login/oauth/authorize?' +
    'client_id=Ov23lilv8CB5JzyvevZE&' +
    'redirect_uri=' + encodeURIComponent(window.location.origin + '/api/auth/github') + '&' +
    'state=' + state + '&' +
    'scope=user:email';
  window.location = githubAuthUrl;
}

export function signInWithEmail() {
  const email = prompt('Enter your email to receive a sign-in link:');
  if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return alert('Invalid email');
  }
  fetch((API_BASE || '') + '/api/auth/email-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email }),
  })
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(d => {
      if (d.error) alert('Error: ' + d.error);
      else alert(d.message);
    })
    .catch(e => alert('Network error: ' + (e && e.message || e)));
}
