# MLB Tracker — Live Game Radio System

Background terrestrial sports-radio audio added v3.9.b–f. Auto-pairs to the currently-focused live game. Plays the home team's flagship station (away team as fallback) when approved; falls through to Fox Sports Radio otherwise. No MLB.tv content — these are public OTA sports-radio simulcasts.

## ⚙️ Approved teams — source of truth (READ FIRST)

Controlled by one place in `app.js`:

```javascript
// app.js ~line 4431
const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,140,142,144,146,147]);
```

To enable a team: add its `teamId` to this Set, bump comment date, bump app version + `sw.js` CACHE, commit. To disable: remove `teamId`. The `MLB_TEAM_RADIO` URL map stays untouched.

### ✅ Currently enabled (9 teams — last sweep 2026-05-02)

| `teamId` | Team | Flagship station | Format |
|---|---|---|---|
| 108 | Los Angeles Angels | KLAA Angels Radio | direct |
| 114 | Cleveland Guardians | WTAM 1100 AM | hls |
| 116 | Detroit Tigers | WXYT 97.1 The Ticket | hls |
| 117 | Houston Astros | SportsTalk 790 AM | direct |
| 140 | Texas Rangers | 105.3 The Fan KRLD | hls |
| 142 | Minnesota Twins | WCCO News Talk 830 | hls |
| 144 | Atlanta Braves | 680 The Fan / 93.7 FM | direct |
| 146 | Miami Marlins | WQAM 560 AM | hls |
| 147 | New York Yankees | WFAN 66 / 101.9 | hls |

### ❌ Currently disabled (21 teams)

URL is in `MLB_TEAM_RADIO` (Radio Check can still test it), but excluded from `APPROVED_RADIO_TEAM_IDS`.

| `teamId` | Team | Flagship station | Status |
|---|---|---|---|
| 109 | Arizona Diamondbacks | KTAR 620 AM | ⏳ URL updated v3.34.1 — untested |
| 110 | Baltimore Orioles | WBAL 1090 AM | ⏳ Station replaced v3.34.1 — untested |
| 111 | Boston Red Sox | WEEI 850 AM | ❌ Broken (Audacy rights) |
| 112 | Chicago Cubs | WSCR 670 The Score | ⏳ Untested |
| 113 | Cincinnati Reds | 700 WLW | ⏳ URL updated v3.34.1 — untested |
| 115 | Colorado Rockies | KOA 850 / 94.1 | ⏳ URL updated v3.34.1 — untested |
| 118 | Kansas City Royals | 96.5 The Fan KFNZ | ⏳ Station rebrand v3.34.1 — untested |
| 119 | Los Angeles Dodgers | KLAC AM 570 LA Sports | ⏳ URL updated v3.34.1 — untested |
| 120 | Washington Nationals | WJFK The Fan 106.7 | ❌ Broken (Audacy rights) |
| 121 | New York Mets | WCBS 880 AM | ⏳ Station replaced v3.34.1 — untested |
| 133 | Oakland Athletics | KSTE 650 AM Sacramento | ⏳ Station replaced v3.34.1 — untested |
| 134 | Pittsburgh Pirates | KDKA-FM 93.7 The Fan | ❌ Broken (Audacy rights) |
| 135 | San Diego Padres | KWFN 97.3 The Fan | ❌ Broken (Audacy rights) |
| 136 | Seattle Mariners | Seattle Sports 710 AM | ❌ Broken (Bonneville rebrand of KIRO) |
| 137 | San Francisco Giants | KNBR 104.5 / 680 | ⏳ Untested |
| 138 | St. Louis Cardinals | KMOX NewsRadio 1120 | ❌ Broken (Audacy rights) |
| 139 | Tampa Bay Rays | WDAE 95.3 FM / 620 AM | ⏳ Station replaced v3.34.1 — untested |
| 141 | Toronto Blue Jays | CJCL Sportsnet 590 | ❌ Broken (likely Canada geo-locked) |
| 143 | Philadelphia Phillies | 94 WIP Sportsradio | ❌ Broken (Audacy rights) |
| 145 | Chicago White Sox | WMVP ESPN 1000 AM | ⏳ URL updated v3.34.1 — untested |
| 158 | Milwaukee Brewers | WTMJ Newsradio 620 | ⏳ URL updated v3.34.1 — untested |

### 🌧️ Audacy rights gap

Many MLB market flagships are Audacy-owned (URLs `live.amperwave.net/manifest/audacy-*`). Audacy holds OTA simulcast rights but NOT MLB streaming rights. During live games their digital streams play alternate content (talk shows, ads, silence). There is no URL-side fix — replacement URLs must come from non-Audacy sources (iHeartRadio `stream.revma.ihrhls.com/...`, StreamTheWorld `playerservices.streamtheworld.com/.../*.aac`, Bonneville `bonneville.cdnstream1.com/...`).

## Architecture

```
[ Settings panel ]
   ├─ 📻 Live Game Radio toggle (id="radioToggle")
   │     └─ toggleRadio() → startRadio()/stopRadio()
   │           └─ pickRadioForFocus()  ← APPROVED_RADIO_TEAM_IDS gate
   │                 └─ MLB_TEAM_RADIO[homeId] || MLB_TEAM_RADIO[awayId] || FALLBACK_RADIO
   │           └─ loadRadioStream(pick)
   │                 ├─ Hls.js (window.Hls)         if format==='hls' && Hls.isSupported()
   │                 ├─ Safari native HLS           if format==='hls' && audio.canPlayType('application/vnd.apple.mpegurl')
   │                 └─ <audio> direct AAC/MP3      otherwise
   │
   └─ 🔍 Radio Check button → openRadioCheck()
         └─ #radioCheckOverlay (z-index 550)

[ Focus Mode ]
   └─ setFocusGame(pk) → updateRadioForFocus()
         └─ if currently playing AND new pick.teamId !== radioCurrentTeamId → loadRadioStream(pick)
```

Focus selection is unchanged. The radio follows focus; it never influences which game gets focused.

## Globals

```javascript
const MLB_TEAM_RADIO = { 108:{name,url,format}, ..., 158:{name,url,format} };  // 30 entries
const APPROVED_RADIO_TEAM_IDS = new Set([108,114,116,117,140,142,144,146,147]);
const FALLBACK_RADIO = { name:'Fox Sports Radio', url:'https://ais-sa1.streamon.fm/7852_128k.aac', format:'direct' };
var radioAudio = null;        // <audio> element, lazily created on first play
var radioHls   = null;        // Hls.js instance (null when direct stream / stopped)
var radioCurrentTeamId = null; // teamId whose feed is loaded; null = fallback
```

## Hls.js dependency

```html
<!-- index.html:15 -->
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.light.min.js" async></script>
```

Light build (~50KB). Not stored in repo, not in `sw.js` SHELL cache. If CDN goes down, all `format:'hls'` streams break in non-Safari browsers; Safari users keep working via native HLS.

## Stream format routing in `loadRadioStream(pick)`

| Condition | Path |
|---|---|
| `pick.format === 'hls'` AND `window.Hls && Hls.isSupported()` | Hls.js via `loadSource` + `attachMedia` |
| `pick.format === 'hls'` AND `radioAudio.canPlayType('application/vnd.apple.mpegurl')` truthy | Safari native — `audio.src = pick.url` |
| else (`format === 'direct'`, AAC/MP3) | Plain `<audio>` — `audio.src = pick.url` |

`radioHls` is destroyed before any source swap to prevent fd leaks on rapid focus changes.

## 🔍 Radio Check tool

Self-test panel for sweeping every station in `MLB_TEAM_RADIO` + Fox Sports fallback. Open via: Settings → 🔍 Radio Check row → "Open" → `openRadioCheck()`. Modal `#radioCheckOverlay` (z-index 550, top-level DOM).

**Per-station row:**
- ▶ Play — `radioCheckPlay(key)` → `loadRadioStream(...)` directly. **Bypasses** `APPROVED_RADIO_TEAM_IDS` gate (testing path).
- ✅ Works — tap to mark; tap again to clear (no accidental lock-in)
- ❌ Broken — tap to mark; tap again to clear
- Notes textarea — saves on every keystroke via `radioCheckSetNote(key, val)` (no re-render)

**Persistence:**

| Key | Shape | Purpose |
|---|---|---|
| `localStorage.mlb_radio_check` | `{ teamId\|'fallback': 'yes'\|'no' }` | Status (absent = untested) |
| `localStorage.mlb_radio_check_notes` | `{ teamId\|'fallback': 'string' }` | Per-station free-text notes |

**📋 Copy Results** — `radioCheckCopy()` builds categorised markdown (✅ Works / ❌ Broken / ⏳ Untested with notes) and writes to clipboard.

**Default notes seed (v3.34.1):** `RADIO_CHECK_DEFAULT_NOTES` constant maps `teamId` → string. `loadRadioCheckResults()` performs a one-time merge gated by `localStorage.mlb_radio_check_notes_seeded_v2`. Bump seed flag (`_v2` → `_v3`) when you want a re-seed pass.

## Workflow — updating the approved pool

1. Open Settings → 🔍 Radio Check
2. ▶ test each station, mark ✅/❌, add notes
3. 📋 Copy Results → paste into Claude session
4. **Edit `APPROVED_RADIO_TEAM_IDS` only** (`app.js` ~line 4431) — add ✅ `teamId`s, remove ❌ ones
5. Update the comment "last updated YYYY-MM-DD"
6. Bump `<title>` + settings panel version + `sw.js` CACHE
7. Commit + push

`MLB_TEAM_RADIO` URL map only needs editing when a station's stream URL itself changes.

## Known issues / backlog

- **Audacy rights gap** — ~14 stations; needs URL replacements from iHeart / StreamTheWorld / Bonneville
- **Oakland flagship** — KSTE Sacramento may not be the current flagship after A's move; needs research
- **Toronto** — CJCL Sportsnet 590 may be Canada-geo-locked
- **Per-team override UI** — user can't choose away team when both teams approved (always picks home)
- **Demo Mode** — toggle is functional but `pickRadioForFocus()` returns Fox Sports (no real focus game)
