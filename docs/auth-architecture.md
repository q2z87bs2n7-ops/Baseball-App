# Auth & Session Storage Architecture

> Full specification extracted from CLAUDE.md. See CLAUDE.md "Session Storage" section for the summary.

---

### Session Storage & Cross-Device Sync (v3.8+)

Users can optionally sign in to enable card collection sync across devices and days. Sign-in is **100% optional** — the app remains fully functional unsigned-in with localStorage-only storage.

#### Architecture

**Three auth endpoints (Vercel serverless):**
- `/api/auth/github` — GitHub OAuth callback (exchanges authorization code for access token, creates/links user account)
- `/api/auth/email-request` — Email magic-link request (generates 15-min token, sends link via SendGrid/Mailgun)
- `/api/auth/email-verify` — Magic-link verification (exchanges token for session token, redirects to app)

**One sync endpoint:**
- `/api/collection-sync` — GET (fetch remote cards), POST (push single card), PUT (full sync with merge)

**Storage (Upstash Redis keyed by opaque user ID):**
- `session:{token}` — session metadata (userId, auth_method, expiresAt) — 90-day TTL
- `collection:{userId}` — card collection JSON
- `github_map:{githubId}` → userId — links GitHub account to user
- `email_map:{email}` → userId — links email address to user (enables account unification)
- `email_token:{hash}` — one-time magic link (15-min TTL)

#### GitHub OAuth Flow

1. **User clicks "Sign in with GitHub"** in Settings panel
2. `signInWithGitHub()` redirects to GitHub's OAuth authorization endpoint with:
   - `client_id` — from `GITHUB_CLIENT_ID` env var
   - `redirect_uri` — `/api/auth/github` callback
   - `scope` — `user:email` (requests email permission)
   - `state` — random nonce for CSRF protection
3. **User authorizes on GitHub**
4. **GitHub redirects to `/api/auth/github?code=...&state=...`**
5. **Backend exchanges code for access token:**
   - POST to `https://github.com/login/oauth/access_token` with client_id, client_secret, code
   - Receives `access_token` in response
6. **Fetch user info from GitHub API:**
   - `GET https://api.github.com/user` with `Authorization: Bearer {access_token}`
   - Receives `id` (GitHub user ID), `login`, `email`
7. **Account unification logic:**
   - Check if GitHub ID already linked: `github_map:{githubId}` lookup
   - If not linked, check if email already has account: `email_map:{email}` lookup
   - If email found: **reuse existing userId** (link GitHub to email account)
   - If email not found: **generate new userId** (new account)
   - Store `github_map:{githubId}` → userId
   - Store `email_map:{email}` → userId
8. **Generate session token and store in Redis:**
   - Session token: 40-char random string
   - Store in `session:{token}` with 90-day TTL
9. **Redirect back to app with token:**
   - `{appUrl}?auth_token={token}&auth_method=github&github_login={login}`
   - App reads `auth_token` from URL, stores in `mlb_session_token` localStorage
   - Session remains valid for 90 days

**Redirect URL handling (v3.8 fix):**
- Uses `x-forwarded-host` and `x-forwarded-proto` request headers instead of `VERCEL_URL`
- Ensures correct app domain for all Vercel deployments (production + preview)

#### Email Magic-Link Flow

1. **User clicks "Sign in with Email"** in Settings panel
2. Modal prompts for email address
3. **Frontend POSTs to `/api/auth/email-request` with email**
4. **Backend generates 32-byte random token:**
   - Stores in Redis: `email_token:{token}` → `{email, createdAt, expiresAt}` with 15-min TTL
   - Generates magic link: `{appUrl}/api/auth/email-verify?token={token}`
5. **Sends email via SendGrid or Mailgun:**
   - From address: `EMAIL_FROM_ADDRESS` (must be verified in SendGrid)
   - Subject: "Sign in to Baseball App"
   - Body: plain text with magic link + 15-min expiry notice
6. **User receives email and clicks magic link**
7. **Magic link redirects to `/api/auth/email-verify?token=...`**
8. **Backend verifies token:**
   - Looks up `email_token:{token}`
   - Checks expiry: if past 15 minutes, returns 400 "Magic link has expired"
   - Deletes token (one-time use only)
9. **Account unification logic (same as GitHub):**
   - Check if email already linked: `email_map:{email}` lookup
   - If not linked: generate new userId
   - Store `email_map:{email}` → userId
10. **Generate session token and store in Redis:**
    - Same as GitHub flow (40-char token, 90-day TTL)
11. **Redirect back to app:**
    - `{appUrl}?auth_token={token}&auth_method=email`

#### Collection Sync

**Data model (localStorage `mlb_card_collection`):**
```javascript
{
  "{playerId}_{HR|RBI}": {
    playerId: number,
    playerName: string,
    teamAbbr: string,
    teamPrimary: string,   // hex
    teamSecondary: string, // hex
    position: string,      // "RF", "SP", etc.
    eventType: 'HR' | 'RBI',
    tier: 'common' | 'rare' | 'epic' | 'legendary',
    collectedAt: number,   // ms of first collection at this tier
    events: [              // all events at current tier, capped 10
      { badge, date, inning, halfInning, awayAbbr, homeAbbr, awayScore, homeScore }
    ]
  }
}
```

**Tier ranks (for merge comparison):**
- `legendary` = 4
- `epic` = 3
- `rare` = 2
- `common` = 1

**Merge strategy (highest-tier-wins):**
- Compare local vs. remote tier ranks
- Higher tier always wins
- Same tier: use whichever card is newer (by `collectedAt`), merge events (dedup by date:badge, cap 10, newest first)
- Lower tier: silent no-op (remote card unchanged)

**Sync endpoints:**
- **GET `/api/collection-sync`** — Fetch remote collection from Redis
- **PUT `/api/collection-sync`** — Full sync (POST local collection, merge on server, return merged result)
- **POST `/api/collection-sync`** — Push single card (used by background sync)

**Background sync:**
- Fires every 30 seconds when signed in via `startSyncInterval()`
- Calls `syncCollection()` which POSTs current local collection
- Merges on server, updates remote state
- Prevents cross-device drift

**On sign-in:**
1. `mergeCollectionOnSignIn()` fires
2. Fetches remote collection via GET
3. Merges with local via `mergeCollectionSlots()`
4. Saves merged state to localStorage
5. Updates UI (card count in settings panel)

#### Vercel Environment Variables

Required for auth flows:

| Var | Source | Purpose |
|---|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth App settings | OAuth app identifier |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App settings | OAuth app secret (keep private) |
| `EMAIL_API_KEY` | SendGrid or Mailgun API key | Authenticate email sends |
| `EMAIL_FROM_ADDRESS` | Any verified email in SendGrid | Sender address (must be verified) |
| `KV_REST_API_URL` | Upstash/Vercel KV dashboard | Redis endpoint URL |
| `KV_REST_API_TOKEN` | Upstash/Vercel KV dashboard | Redis auth token |

**Setup steps:**

1. **GitHub OAuth:**
   - Go to GitHub → Settings → Developer settings → OAuth Apps → New
   - App name: "Baseball App"
   - Homepage URL: app domain
   - Authorization callback URL: `https://{vercel-domain}/api/auth/github`
   - Copy Client ID + Secret → Vercel env vars

2. **Email (SendGrid):**
   - Sign up at sendgrid.com (free tier: 100 emails/day)
   - Create API key → copy to `EMAIL_API_KEY`
   - Verify a sender email → use for `EMAIL_FROM_ADDRESS`
   - Click verification link in email SendGrid sends you

3. **Redis (Upstash):**
   - Auto-created via Vercel KV integration (or manual via upstash.com)
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` auto-populated by Vercel

#### Frontend Functions

| Function | Purpose |
|---|---|
| `signInWithGitHub()` | Redirect to GitHub OAuth authorization endpoint |
| `signInWithEmail()` | Prompt for email, POST to `/api/auth/email-request` |
| `handleAuthCallback()` | Called on page load, reads `auth_token` from URL, stores session token, merges collection |
| `mergeCollectionOnSignIn()` | Fetch remote collection, merge with local, save merged state |
| `syncCollection()` | POST current local collection to server (background sync) |
| `startSyncInterval()` | Arm 30-second background sync interval when signed in |
| `loadCollection()` | Read `mlb_card_collection` from localStorage, parse JSON |
| `saveCollection(obj)` | Write collection to localStorage |

#### Known Limitations

- **Email requires verified sender:** SendGrid will not send from an unverifed email address. Users must click verification link SendGrid sends to complete setup.
- **Apple private relay:** If user's GitHub uses Apple's email relay (e.g., `q2z87bs2n7@privaterelay.appleid.com`), email sign-in must use the same relay address for account unification. Solution: link both auth methods to a shared real email address.
- **Session expiry:** Sessions expire after 90 days. User must re-sign-in. No data loss (collection persists in Redis indefinitely).
- **Redis quota:** Free Vercel KV (100 commands/second) is sufficient for personal + light sharing. Monitor usage in Vercel dashboard.

