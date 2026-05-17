(() => {
  // src/devtools-feed/devLog.js
  var DEV_LOG_CAP = 500;
  var devLog = [];
  function pushDevLog(level, src, args) {
    try {
      let msg = Array.prototype.map.call(args, function(a) {
        if (a == null) return String(a);
        if (typeof a === "string") return a;
        if (a instanceof Error) return a.stack || a.name + ": " + a.message;
        try {
          return JSON.stringify(a);
        } catch (e) {
          return String(a);
        }
      }).join(" ");
      if (msg.length > 600) msg = msg.slice(0, 600) + "\u2026";
      devLog.push({ ts: Date.now(), level, src: src || "", msg });
      if (devLog.length > DEV_LOG_CAP) devLog.splice(0, devLog.length - DEV_LOG_CAP);
    } catch (e) {
    }
  }
  (function wrapConsole() {
    ["log", "info", "warn", "error"].forEach(function(lvl) {
      const orig = console[lvl];
      console[lvl] = function() {
        pushDevLog(lvl === "info" ? "log" : lvl, "", arguments);
        try {
          orig.apply(console, arguments);
        } catch (e) {
        }
      };
    });
  })();
  window.addEventListener("error", function(e) {
    pushDevLog("error", "window", [e && e.message ? e.message : "error", e && e.filename ? e.filename + ":" + e.lineno : ""]);
  });
  window.addEventListener("unhandledrejection", function(e) {
    const r = e && e.reason;
    pushDevLog("error", "promise", [r && r.stack ? r.stack : r && r.message ? r.message : String(r)]);
  });
  function devTrace(src) {
    const args = Array.prototype.slice.call(arguments, 1);
    pushDevLog("log", src || "app", args);
    if (typeof DEBUG !== "undefined" && DEBUG) {
      try {
        console.log.apply(console, ["[" + (src || "app") + "]"].concat(args));
      } catch (e) {
      }
    }
  }

  // src/devtools-feed/devNet.js
  var DEV_NET_CAP = 50;
  var devNetLog = [];
  (function wrapFetch() {
    if (typeof window === "undefined" || !window.fetch) return;
    const origFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      const t0 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      const url = typeof input === "string" ? input : input && input.url || "";
      const method = init && init.method || input && input.method || "GET";
      const entry = { ts: Date.now(), method: method.toUpperCase(), url, status: null, ok: null, ms: null, sizeBytes: null, errorMsg: null };
      devNetLog.push(entry);
      if (devNetLog.length > DEV_NET_CAP) devNetLog.splice(0, devNetLog.length - DEV_NET_CAP);
      return origFetch(input, init).then(function(res) {
        const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        entry.ms = Math.round(t1 - t0);
        entry.status = res.status;
        entry.ok = res.ok;
        try {
          const cl = res.headers && res.headers.get && res.headers.get("content-length");
          if (cl) entry.sizeBytes = parseInt(cl, 10);
        } catch (e) {
        }
        if (!res.ok) pushDevLog("warn", "net", [method.toUpperCase() + " " + res.status + " \xB7 " + url + " \xB7 " + entry.ms + "ms"]);
        return res;
      }, function(err) {
        const t1 = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
        entry.ms = Math.round(t1 - t0);
        entry.ok = false;
        entry.errorMsg = err && err.message ? err.message : String(err);
        pushDevLog("error", "net", [method.toUpperCase() + " FAILED \xB7 " + url + " \xB7 " + entry.errorMsg]);
        throw err;
      });
    };
  })();

  // src/config/constants.js
  var SEASON = 2026;
  var WC_SPOTS = 3;
  var MLB_BASE = "https://statsapi.mlb.com/api/v1";
  var MLB_BASE_V1_1 = "https://statsapi.mlb.com/api/v1.1";
  var API_BASE = "https://baseball-app-sigma.vercel.app";
  var TEAMS = [
    { id: 121, espnId: 21, name: "New York Mets", short: "Mets", division: "National League East", league: "NL", primary: "#002D72", secondary: "#FF5910", youtubeUC: "UCgIMbGazP0uBDy9JVCqBUaA" },
    { id: 144, espnId: 15, name: "Atlanta Braves", short: "Braves", division: "National League East", league: "NL", primary: "#CE1141", secondary: "#13274F", youtubeUC: "UCNWnkblY5_kmf4OQ9l0LgnA" },
    { id: 120, espnId: 20, name: "Washington Nationals", short: "Nationals", division: "National League East", league: "NL", primary: "#AB0003", secondary: "#14225A", youtubeUC: "UCUnB3WNX238eraj5IK3fFEw" },
    { id: 143, espnId: 22, name: "Philadelphia Phillies", short: "Phillies", division: "National League East", league: "NL", primary: "#E81828", secondary: "#002D72", youtubeUC: "UCWkTX0S0Ii5pT2aRVz7Zctw" },
    { id: 146, espnId: 28, name: "Miami Marlins", short: "Marlins", division: "National League East", league: "NL", primary: "#00A3E0", secondary: "#EF3340", youtubeUC: "UC1Gh_pQ7l41tyBn2HeJ1k-A" },
    { id: 112, espnId: 16, name: "Chicago Cubs", short: "Cubs", division: "National League Central", league: "NL", primary: "#0E3386", secondary: "#CC3433", youtubeUC: "UCnU7B7B0U0t2vs-2HMLjgvg" },
    { id: 113, espnId: 17, name: "Cincinnati Reds", short: "Reds", division: "National League Central", league: "NL", primary: "#C6011F", secondary: "#000000", youtubeUC: "UCENXPJrzbHXudxhURfk5NCg" },
    { id: 158, espnId: 8, name: "Milwaukee Brewers", short: "Brewers", division: "National League Central", league: "NL", primary: "#0a2351", secondary: "#b6922e", youtubeUC: "UCybiT6P8jSv7gIxC4cHXl2Q" },
    { id: 134, espnId: 23, name: "Pittsburgh Pirates", short: "Pirates", division: "National League Central", league: "NL", primary: "#27251F", secondary: "#FDB827", youtubeUC: "UCmBaK2wdmP1LZ9gLkkHiM4Q" },
    { id: 138, espnId: 24, name: "St. Louis Cardinals", short: "Cardinals", division: "National League Central", league: "NL", primary: "#C41E3A", secondary: "#0C2340", youtubeUC: "UCwaMqLYzbyp2IbFgcF_s5Og" },
    { id: 109, espnId: 29, name: "Arizona Diamondbacks", short: "D-backs", division: "National League West", league: "NL", primary: "#A71930", secondary: "#E3D4AD", youtubeUC: "UCxeK534L7DDIwPFv_o9CZjw" },
    { id: 115, espnId: 27, name: "Colorado Rockies", short: "Rockies", division: "National League West", league: "NL", primary: "#33006f", secondary: "#C4CED4", youtubeUC: "UCBci3py0IfkjkjPKDE-B6Bw" },
    { id: 119, espnId: 19, name: "Los Angeles Dodgers", short: "Dodgers", division: "National League West", league: "NL", primary: "#005A9C", secondary: "#EF3E42", youtubeUC: "UC05cNJvMKzDLRPo59X2Xx7g" },
    { id: 135, espnId: 25, name: "San Diego Padres", short: "Padres", division: "National League West", league: "NL", primary: "#2F241D", secondary: "#FFC425", youtubeUC: "UCdhukF6o5_ENjbf_9oNGXNQ" },
    { id: 137, espnId: 26, name: "San Francisco Giants", short: "Giants", division: "National League West", league: "NL", primary: "#FD5A1E", secondary: "#27251F", youtubeUC: "UCpXMHgjrpnynDSV5mXpqImw" },
    { id: 110, espnId: 1, name: "Baltimore Orioles", short: "Orioles", division: "American League East", league: "AL", primary: "#DF4601", secondary: "#27251F", youtubeUC: "UC2jqf9lgDjMUtTow1Q4IKzg" },
    { id: 111, espnId: 2, name: "Boston Red Sox", short: "Red Sox", division: "American League East", league: "AL", primary: "#BD3039", secondary: "#0D2B56", youtubeUC: "UCoLrny_Oky6BE206kOfTmiw" },
    { id: 147, espnId: 10, name: "New York Yankees", short: "Yankees", division: "American League East", league: "AL", primary: "#003087", secondary: "#C4CED4", youtubeUC: "UCmAQ_4ELJodnKuNqviK86Dg" },
    { id: 139, espnId: 30, name: "Tampa Bay Rays", short: "Rays", division: "American League East", league: "AL", primary: "#092C5C", secondary: "#8FBCE6", youtubeUC: "UCZaT7TplNF541ySP8SlHVGA" },
    { id: 141, espnId: 14, name: "Toronto Blue Jays", short: "Blue Jays", division: "American League East", league: "AL", primary: "#134A8E", secondary: "#1D2D5C", youtubeUC: "UCVPkZh_H6m_stW8hq-2-yNw" },
    { id: 145, espnId: 4, name: "Chicago White Sox", short: "White Sox", division: "American League Central", league: "AL", primary: "#27251F", secondary: "#C4CED4", youtubeUC: "UCve-Ci-M4CkBOmNi2LQdCRg" },
    { id: 114, espnId: 5, name: "Cleveland Guardians", short: "Guardians", division: "American League Central", league: "AL", primary: "#E31937", secondary: "#0C2340", youtubeUC: "UCpI50OSBxxalmRZRq4gtRDw" },
    { id: 116, espnId: 6, name: "Detroit Tigers", short: "Tigers", division: "American League Central", league: "AL", primary: "#182d55", secondary: "#f26722", youtubeUC: "UCKKG465DFaJ3Yp-jQHA3jhw" },
    { id: 118, espnId: 7, name: "Kansas City Royals", short: "Royals", division: "American League Central", league: "AL", primary: "#174885", secondary: "#c0995a", youtubeUC: "UCvA2SgPVi3Hw6n_WER0VrcQ" },
    { id: 142, espnId: 9, name: "Minnesota Twins", short: "Twins", division: "American League Central", league: "AL", primary: "#002B5C", secondary: "#D31145", youtubeUC: "UCkXEh3jSl4oB1mQqjIePfTg" },
    { id: 117, espnId: 18, name: "Houston Astros", short: "Astros", division: "American League West", league: "AL", primary: "#002D62", secondary: "#EB6E1F", youtubeUC: "UC3RPfeyaEIPosC4eIcNr4Gw" },
    { id: 108, espnId: 3, name: "Los Angeles Angels", short: "Angels", division: "American League West", league: "AL", primary: "#BA0021", secondary: "#003263", youtubeUC: "UCS7H_WWPj5_qfD-zoUzuX2A" },
    { id: 133, espnId: 11, name: "Oakland Athletics", short: "Athletics", division: "American League West", league: "AL", primary: "#003831", secondary: "#EFB21E", youtubeUC: "UCeiRABiGBQTzpuEYohN_I1Q" },
    { id: 136, espnId: 12, name: "Seattle Mariners", short: "Mariners", division: "American League West", league: "AL", primary: "#0C2C56", secondary: "#c4ced4", youtubeUC: "UCWWLs-O8JGYYcNea7AgumAA" },
    { id: 140, espnId: 13, name: "Texas Rangers", short: "Rangers", division: "American League West", league: "AL", primary: "#003278", secondary: "#C0111F", youtubeUC: "UCZjXWMvOrhc91chSDPDUspA" }
  ];
  var MLB_THEME = { id: -1, name: "Default", short: "MLB", primary: "#0E3386", secondary: "#CC3433" };
  var LEADER_CATS_FOR_PERCENTILE = [
    // Hitting (higher-is-better unless noted)
    { group: "hitting", key: "avg", leaderCategory: "battingAverage", lowerIsBetter: false, decimals: 3 },
    { group: "hitting", key: "homeRuns", leaderCategory: "homeRuns", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "rbi", leaderCategory: "runsBattedIn", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "ops", leaderCategory: "onBasePlusSlugging", lowerIsBetter: false, decimals: 3 },
    { group: "hitting", key: "obp", leaderCategory: "onBasePercentage", lowerIsBetter: false, decimals: 3 },
    { group: "hitting", key: "slg", leaderCategory: "sluggingPercentage", lowerIsBetter: false, decimals: 3 },
    { group: "hitting", key: "hits", leaderCategory: "hits", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "doubles", leaderCategory: "doubles", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "triples", leaderCategory: "triples", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "runs", leaderCategory: "runs", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "stolenBases", leaderCategory: "stolenBases", lowerIsBetter: false, decimals: 0 },
    { group: "hitting", key: "baseOnBalls", leaderCategory: "walks", lowerIsBetter: false, decimals: 0 },
    // For hitters, more strikeouts = worse
    { group: "hitting", key: "strikeOuts", leaderCategory: "strikeouts", lowerIsBetter: true, decimals: 0 },
    // Pitching (mixed polarity)
    { group: "pitching", key: "era", leaderCategory: "earnedRunAverage", lowerIsBetter: true, decimals: 2 },
    { group: "pitching", key: "whip", leaderCategory: "walksAndHitsPerInningPitched", lowerIsBetter: true, decimals: 2 },
    { group: "pitching", key: "strikeOuts", leaderCategory: "strikeouts", lowerIsBetter: false, decimals: 0 },
    { group: "pitching", key: "wins", leaderCategory: "wins", lowerIsBetter: false, decimals: 0 },
    { group: "pitching", key: "saves", leaderCategory: "saves", lowerIsBetter: false, decimals: 0 },
    { group: "pitching", key: "inningsPitched", leaderCategory: "inningsPitched", lowerIsBetter: false, decimals: 1 },
    { group: "pitching", key: "strikeoutWalkRatio", leaderCategory: "strikeoutWalkRatio", lowerIsBetter: false, decimals: 2 },
    { group: "pitching", key: "strikeoutsPer9Inn", leaderCategory: "strikeoutsPer9Inn", lowerIsBetter: false, decimals: 2 },
    { group: "pitching", key: "walksPer9Inn", leaderCategory: "walksPer9Inn", lowerIsBetter: true, decimals: 2 },
    { group: "pitching", key: "baseOnBalls", leaderCategory: "walks", lowerIsBetter: true, decimals: 0 },
    { group: "pitching", key: "hits", leaderCategory: "hits", lowerIsBetter: true, decimals: 0 },
    { group: "pitching", key: "homeRuns", leaderCategory: "homeRuns", lowerIsBetter: true, decimals: 0 }
  ];
  var TIMING = {
    PULSE_POLL_MS: 15e3,
    // pollLeaguePulse interval
    FOCUS_POLL_MS: 5e3,
    // pollFocusLinescore / focusFastTimer interval
    LIVE_REFRESH_MS: 3e4,
    // live game view auto-refresh
    HOME_LIVE_MS: 6e4,
    // home card live auto-refresh
    LEAGUE_REFRESH_MS: 6e4,
    // around the league matchup auto-refresh
    STORY_POOL_MS: 3e4,
    // buildStoryPool rebuild interval
    NEWS_REFRESH_MS: 6e5,
    // news carousel refresh (10 min)
    BUZZ_REFRESH_MS: 12e4,
    // Baseball Buzz side-rail refresh (2 min)
    YESTERDAY_REFRESH_MS: 36e5,
    // yesterday recap hourly refresh
    CARD_DISMISS_MS: 5500,
    // player/RBI card auto-dismiss
    CARD_CLOSE_ANIM_MS: 280,
    // card close animation duration
    ALERT_DISMISS_MS: 8e3,
    // focus soft-alert auto-dismiss
    SIGNIN_CTA_MS: 8e3,
    // sign-in CTA auto-dismiss
    SYNC_INTERVAL_MS: 3e4
    // background collection sync
  };

  // src/utils/format.js
  function tcLookup(id) {
    const t = TEAMS.find(function(t2) {
      return t2.id === id;
    });
    return t ? { primary: t.primary, abbr: t.short, name: t.name } : { primary: "#444", abbr: "???", name: "Unknown" };
  }
  function fmt(v, d) {
    d = d === void 0 ? 3 : d;
    if (v == null || v === "") return "\u2014";
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    return n.toFixed(d);
  }
  function fmtRate(v, d) {
    d = d === void 0 ? 3 : d;
    if (v == null || v === "") return "\u2014";
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    const s = n.toFixed(d);
    return n > 0 && n < 1 ? s.slice(1) : s;
  }
  function fmtDateTime(ds) {
    const d = new Date(ds);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  function fmtNewsDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  var ET_DATE_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  var ET_HOUR_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false });
  function etDateStr(d) {
    return ET_DATE_FMT.format(d || /* @__PURE__ */ new Date());
  }
  function etHour(d) {
    return parseInt(ET_HOUR_FMT.format(d || /* @__PURE__ */ new Date()), 10) % 24;
  }
  function etDatePlus(dateStr, days) {
    const p = dateStr.split("-").map(Number);
    const u = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
    u.setUTCDate(u.getUTCDate() + days);
    return u.getUTCFullYear() + "-" + String(u.getUTCMonth() + 1).padStart(2, "0") + "-" + String(u.getUTCDate()).padStart(2, "0");
  }
  function pickOppColor(oppPrimary, oppSecondary, myPrimary) {
    function rgbDist(a, b) {
      a = (a || "").replace("#", "");
      b = (b || "").replace("#", "");
      if (a.length < 6 || b.length < 6) return 999;
      const ar = parseInt(a.substr(0, 2), 16), ag = parseInt(a.substr(2, 2), 16), ab = parseInt(a.substr(4, 2), 16);
      const br = parseInt(b.substr(0, 2), 16), bg = parseInt(b.substr(2, 2), 16), bb = parseInt(b.substr(4, 2), 16);
      return Math.sqrt(Math.pow(ar - br, 2) + Math.pow(ag - bg, 2) + Math.pow(ab - bb, 2));
    }
    if (rgbDist(oppPrimary, myPrimary) >= 60) return oppPrimary;
    if (oppSecondary && rgbDist(oppSecondary, myPrimary) >= 60) return oppSecondary;
    return oppPrimary;
  }

  // src/utils/news.js
  var NEWS_IMAGE_HOSTS = /\.(mlb\.com|mlbstatic\.com|espn\.com|espncdn\.com|cbssports\.com|cbsi\.com|cbsistatic\.com|fangraphs\.com|mlbtraderumors\.com|wp\.com|wordpress\.com|cloudfront\.net|fastly\.net|akamaized\.net|amazonaws\.com|imgix\.net|twimg\.com|bsky\.app)$/;
  function isSafeNewsImage(url) {
    if (!url) return false;
    try {
      return NEWS_IMAGE_HOSTS.test(new URL(url).hostname);
    } catch (e) {
      return false;
    }
  }
  function escapeNewsHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function forceHttps(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function decodeNewsHtml(s) {
    const map = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#39;": "'", "&apos;": "'" };
    return String(s || "").replace(/&(?:#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos?);/gi, function(e) {
      return map[e.toLowerCase()] || e;
    }).replace(/&#(\d+);/g, function(m, code) {
      return String.fromCharCode(parseInt(code, 10));
    }).replace(/&#x([0-9a-f]+);/gi, function(m, code) {
      return String.fromCharCode(parseInt(code, 16));
    });
  }
  function isBettingPromo(item) {
    if (item.source !== "cbs") return false;
    return /^Use\s+/i.test(item.title) || /\bpromo\s+code\b|\bbonus\s+(code|bets?)\b|\bprop\s+bets?\b/i.test(item.title) || /\bpicks?,\s*odds\b|\bodds,\s*time\b|\bpicks\s+for\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(item.title) || /\b(draftkings|betmgm|fanduel|caesars|pointsbet)\b/i.test(item.title);
  }

  // src/ui/wakelock.js
  var screenWakeLock = null;
  async function requestScreenWakeLock() {
    if (!navigator.wakeLock) return;
    try {
      screenWakeLock = await navigator.wakeLock.request("screen");
      screenWakeLock.addEventListener("release", () => {
        screenWakeLock = null;
      });
    } catch (e) {
      console.warn("Wake lock request failed:", e);
    }
  }
  async function releaseScreenWakeLock() {
    if (screenWakeLock) {
      try {
        await screenWakeLock.release();
        screenWakeLock = null;
      } catch (e) {
        console.warn("Wake lock release failed:", e);
      }
    }
  }

  // src/ui/sound.js
  var soundSettings = {
    master: false,
    hr: true,
    run: true,
    risp: true,
    dp: true,
    tp: true,
    gameStart: true,
    gameEnd: true,
    error: true
  };
  try {
    const stored = localStorage.getItem("mlb_sound_settings");
    if (stored) Object.assign(soundSettings, JSON.parse(stored));
  } catch (e) {
  }
  try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch (e) {
  }
  function _makeCtx() {
    return new (window.AudioContext || window.webkitAudioContext)();
  }
  function _closeCtx(ctx, dur) {
    setTimeout(function() {
      try {
        ctx.close();
      } catch (e) {
      }
    }, (dur + 0.6) * 1e3);
  }
  function _osc(ctx, freq, t0, dur, vol, wave, attack, dest) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g);
    g.connect(dest || ctx.destination);
    osc.type = wave || "sine";
    osc.frequency.value = freq;
    const at = ctx.currentTime + t0, att = attack || 5e-3;
    g.gain.setValueAtTime(1e-4, at);
    g.gain.exponentialRampToValueAtTime(vol, at + att);
    g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }
  function _ns(ctx, t0, dur, vol, attack, filterType, filterFreq, filterQ, dest) {
    const len = Math.ceil(ctx.sampleRate * (dur + 0.1));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = filterType || "bandpass";
    filt.frequency.value = filterFreq || 1e3;
    filt.Q.value = filterQ !== void 0 ? filterQ : 1;
    const g = ctx.createGain();
    src.connect(filt);
    filt.connect(g);
    g.connect(dest || ctx.destination);
    const at = ctx.currentTime + t0, att = attack || 3e-3;
    g.gain.setValueAtTime(1e-4, at);
    g.gain.exponentialRampToValueAtTime(vol, at + att);
    g.gain.exponentialRampToValueAtTime(1e-4, at + dur);
    src.start(at);
    src.stop(at + dur + 0.05);
  }
  function _comp(ctx) {
    const c = ctx.createDynamicsCompressor();
    c.threshold.value = -12;
    c.knee.value = 6;
    c.ratio.value = 4;
    c.attack.value = 3e-3;
    c.release.value = 0.15;
    c.connect(ctx.destination);
    return c;
  }
  function playHrSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _ns(ctx, 0, 0.05, 0.95, 5e-4, "highpass", 2800, 0.8, d);
      _ns(ctx, 0, 0.12, 0.8, 1e-3, "bandpass", 1e3, 2, d);
      _osc(ctx, 75, 0, 0.25, 0.75, "sine", 2e-3, d);
      _osc(ctx, 392, 0.15, 0.4, 0.5, "sine", 0.02, d);
      _osc(ctx, 523, 0.4, 0.4, 0.5, "sine", 0.02, d);
      _osc(ctx, 784, 0.65, 0.75, 0.45, "sine", 0.02, d);
      _ns(ctx, 0.12, 1.85, 0.22, 0.22, "lowpass", 650, 0.5, d);
      _closeCtx(ctx, 2.3);
    } catch (e) {
    }
  }
  function playRunSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _osc(ctx, 392, 0, 0.24, 0.55, "sine", 0.01, d);
      _osc(ctx, 494, 0.2, 0.24, 0.55, "sine", 0.01, d);
      _osc(ctx, 587, 0.4, 0.24, 0.55, "sine", 0.01, d);
      _osc(ctx, 784, 0.6, 0.55, 0.55, "sine", 0.01, d);
      _osc(ctx, 196, 0, 0.28, 0.38, "sine", 0.02, d);
      _osc(ctx, 247, 0.2, 0.28, 0.38, "sine", 0.02, d);
      _osc(ctx, 294, 0.4, 0.28, 0.38, "sine", 0.02, d);
      _osc(ctx, 392, 0.6, 0.58, 0.38, "sine", 0.02, d);
      _closeCtx(ctx, 1.4);
    } catch (e) {
    }
  }
  function playRispSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _osc(ctx, 100, 0, 0.32, 0.8, "sine", 3e-3, d);
      _ns(ctx, 0, 0.13, 0.65, 2e-3, "lowpass", 200, 1.5, d);
      _osc(ctx, 120, 0.42, 0.32, 0.65, "sine", 3e-3, d);
      _ns(ctx, 0.42, 0.13, 0.55, 2e-3, "lowpass", 220, 1.5, d);
      _osc(ctx, 880, 0.08, 0.6, 0.13, "sine", 0.06, d);
      _closeCtx(ctx, 1);
    } catch (e) {
    }
  }
  function playDpSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _ns(ctx, 0, 0.07, 0.95, 1e-3, "bandpass", 1100, 5, d);
      _osc(ctx, 200, 0, 0.1, 0.65, "sine", 1e-3, d);
      _ns(ctx, 0.2, 0.07, 0.95, 1e-3, "bandpass", 1400, 5, d);
      _osc(ctx, 260, 0.2, 0.1, 0.65, "sine", 1e-3, d);
      _osc(ctx, 660, 0.33, 0.32, 0.5, "sine", 0.01, d);
      _closeCtx(ctx, 0.8);
    } catch (e) {
    }
  }
  function playTpSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _ns(ctx, 0, 0.07, 0.9, 1e-3, "bandpass", 1e3, 4, d);
      _osc(ctx, 180, 0, 0.1, 0.6, "sine", 1e-3, d);
      _ns(ctx, 0.16, 0.07, 0.9, 1e-3, "bandpass", 1200, 4, d);
      _osc(ctx, 220, 0.16, 0.1, 0.6, "sine", 1e-3, d);
      _ns(ctx, 0.32, 0.07, 0.9, 1e-3, "bandpass", 1500, 4, d);
      _osc(ctx, 280, 0.32, 0.1, 0.6, "sine", 1e-3, d);
      _osc(ctx, 392, 0.46, 0.2, 0.55, "triangle", 0.01, d);
      _osc(ctx, 523, 0.6, 0.2, 0.55, "triangle", 0.01, d);
      _osc(ctx, 659, 0.74, 0.2, 0.55, "triangle", 0.01, d);
      _osc(ctx, 784, 0.88, 0.65, 0.55, "triangle", 0.01, d);
      _closeCtx(ctx, 1.75);
    } catch (e) {
    }
  }
  function playGameStartSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _osc(ctx, 523, 0, 0.26, 0.55, "triangle", 0.01, d);
      _osc(ctx, 659, 0.24, 0.26, 0.55, "triangle", 0.01, d);
      _osc(ctx, 784, 0.48, 0.26, 0.55, "triangle", 0.01, d);
      _osc(ctx, 1047, 0.72, 0.75, 0.55, "triangle", 0.01, d);
      _osc(ctx, 262, 0, 0.3, 0.4, "sine", 0.02, d);
      _osc(ctx, 330, 0.24, 0.3, 0.4, "sine", 0.02, d);
      _osc(ctx, 392, 0.48, 0.3, 0.4, "sine", 0.02, d);
      _osc(ctx, 523, 0.72, 0.8, 0.4, "sine", 0.02, d);
      _closeCtx(ctx, 1.7);
    } catch (e) {
    }
  }
  function playGameEndSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _osc(ctx, 784, 0, 0.7, 0.55, "sine", 0.01, d);
      _osc(ctx, 659, 0.58, 0.7, 0.55, "sine", 0.01, d);
      _osc(ctx, 523, 1.16, 1.1, 0.55, "sine", 0.01, d);
      _osc(ctx, 392, 0, 0.75, 0.38, "triangle", 0.02, d);
      _osc(ctx, 330, 0.58, 0.75, 0.38, "triangle", 0.02, d);
      _osc(ctx, 262, 1.16, 1.15, 0.38, "triangle", 0.02, d);
      _ns(ctx, 1.16, 1.05, 0.12, 0.22, "lowpass", 450, 0.5, d);
      _closeCtx(ctx, 2.6);
    } catch (e) {
    }
  }
  function playErrorSound() {
    try {
      const ctx = _makeCtx(), d = _comp(ctx);
      _osc(ctx, 220, 0, 0.5, 0.7, "sawtooth", 5e-3, d);
      _osc(ctx, 165, 0.1, 0.5, 0.6, "sawtooth", 5e-3, d);
      _ns(ctx, 0, 0.58, 0.5, 5e-3, "lowpass", 160, 1.5, d);
      _closeCtx(ctx, 0.9);
    } catch (e) {
    }
  }
  function playSound(type) {
    if (!soundSettings.master || !soundSettings[type]) return;
    _playSoundRaw(type);
  }
  function previewSound(type) {
    _playSoundRaw(type);
  }
  function _playSoundRaw(type) {
    if (type === "hr") playHrSound();
    else if (type === "run") playRunSound();
    else if (type === "risp") playRispSound();
    else if (type === "dp") playDpSound();
    else if (type === "tp") playTpSound();
    else if (type === "gameStart") playGameStartSound();
    else if (type === "gameEnd") playGameEndSound();
    else if (type === "error") playErrorSound();
  }
  function setSoundPref(key, val) {
    soundSettings[key] = val;
    if (key === "master") document.getElementById("soundRows").classList.toggle("master-off", !val);
    localStorage.setItem("mlb_sound_settings", JSON.stringify(soundSettings));
  }
  function toggleSoundPanel() {
    const p = document.getElementById("soundPanel");
    p.style.display = p.style.display === "none" ? "" : "none";
  }
  function onSoundPanelClickOutside(e) {
    const panel = document.getElementById("soundPanel");
    const btn = document.getElementById("ptbSoundBtn");
    if (panel && panel.style.display !== "none" && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      panel.style.display = "none";
    }
    const dbgPanel = document.getElementById("devToolsPanel");
    const dbgBtn = document.getElementById("btnDevTools");
    if (dbgPanel && dbgPanel.style.display !== "none" && !dbgPanel.contains(e.target) && dbgBtn && !dbgBtn.contains(e.target)) {
      dbgPanel.style.display = "none";
    }
  }

  // src/state.js
  var state = {
    // ── Team & UI State ──────────────────────────────────────────────────────
    activeTeam: TEAMS.find((t) => t.id === 121),
    // Mets default
    themeOverride: null,
    themeInvert: false,
    savedThemeForPulse: null,
    themeScope: "full",
    // ── Schedule & Section State ─────────────────────────────────────────────
    scheduleData: [],
    scheduleLoaded: false,
    rosterData: { hitting: [], pitching: [], fielding: [] },
    statsCache: { hitting: [], pitching: [] },
    currentRosterTab: "hitting",
    currentLeaderTab: "hitting",
    selectedPlayer: null,
    // ── Stats Tab v2 (Sprint 1+) ─────────────────────────────────────────────
    // leagueLeaders: keyed `${group}:${leaderCategory}` → sorted [{playerId, value, rank}]
    leagueLeaders: {},
    leagueLeadersFetchedAt: {},
    // keyed by group → ms timestamp
    leagueLeadersInflight: {},
    // keyed by group → in-flight Promise
    // teamStats: { hitting, pitching, fielding } each = MLB stats payload + ranks
    teamStats: { hitting: null, pitching: null, fielding: null, ranks: {} },
    teamStatsFetchedAt: 0,
    teamStatsInflight: null,
    // lastNCache: playerId → { last15: <stat object>, season: <stat object>, ts }
    lastNCache: {},
    // Persisted prefs
    qualifiedOnly: typeof localStorage !== "undefined" && localStorage.getItem("mlb_stats_qualified_only") === "0" ? false : true,
    vsLeagueBasis: typeof localStorage !== "undefined" && localStorage.getItem("mlb_stats_vs_basis") || "mlb",
    activeStatsTab: typeof localStorage !== "undefined" && localStorage.getItem("mlb_stats_tab") || "overview",
    careerSwipeHintShown: typeof localStorage !== "undefined" && localStorage.getItem("mlb_stats_career_hint_shown") === "1",
    // Game Log + Sparkline cache: playerId → { games: [...], ts }
    gameLogCache: {},
    // Sprint-2 cache: cached current player season stat for cheap tab re-renders
    selectedPlayerStat: null,
    // Pitch arsenal cache: playerId → { arsenal: [...], totalPitches, ts }
    pitchArsenalCache: {},
    // Splits cache: playerId → { splits: {...}, ts }
    statSplitsCache: {},
    // Sprint-3 caches
    // Statcast / advanced hitting metrics: playerId → { stat: {...}, ts }
    advancedHittingCache: {},
    // Career year-by-year cache: playerId → { hitting:[...], pitching:[...], ts }
    careerCache: {},
    // Strike-zone heat map cache: playerId → { zones:[...], ts } — populated
    // from /people/{id}/stats?stats=hotColdZones (Sprint 3, hitters only).
    hotColdCache: {},
    // Compare overlay state (Sprint 3 Batch D)
    compareOpen: false,
    compareA: null,
    // full player object {person, position, jerseyNumber}
    compareB: null,
    compareGroup: "hitting",
    // ── News State ───────────────────────────────────────────────────────────
    newsFeedMode: "mlb",
    newsSourceFilter: "all",
    newsArticlesCache: [],
    pulseNewsArticles: [],
    pulseNewsIndex: 0,
    baseballBuzzPosts: [],
    // ── League Pulse State ───────────────────────────────────────────────────
    pulseInitialized: false,
    gameStates: {},
    feedItems: [],
    enabledGames: /* @__PURE__ */ new Set(),
    myTeamLens: typeof localStorage !== "undefined" && localStorage.getItem("mlb_my_team_lens") === "1",
    rbiCardCooldowns: {},
    countdownTimer: null,
    pulseTimer: null,
    isFirstPoll: true,
    pollDateStr: null,
    pulseAbortCtrl: null,
    focusAbortCtrl: null,
    liveAbortCtrl: null,
    // ── Session & Sync State ─────────────────────────────────────────────────
    mlbSessionToken: null,
    mlbAuthUser: null,
    mlbSyncInterval: null,
    shownSignInCTA: false,
    signInCTACardCount: 0,
    signInCTATimer: null,
    // ── Story Carousel State ─────────────────────────────────────────────────
    storyPool: [],
    storyShownId: null,
    storyRotateTimer: null,
    storyPoolTimer: null,
    yesterdayRefreshTimer: null,
    onThisDayCache: null,
    yesterdayCache: null,
    dailyLeadersCache: null,
    dailyLeadersLastFetch: 0,
    tomorrowPreview: { dateStr: null, firstPitchMs: null, gameTime: null, gameCount: 0, fetchedAt: 0, inFlight: false },
    dailyHitsTracker: {},
    dailyPitcherKs: {},
    stolenBaseEvents: [],
    actionEvents: [],
    seenActionEventIds: /* @__PURE__ */ new Set(),
    storyCarouselRawGameData: {},
    probablePitcherStatsCache: {},
    hrBatterStatsCache: {},
    boxscoreCache: {},
    inningRecapsFired: /* @__PURE__ */ new Set(),
    inningRecapsPending: {},
    lastInningState: {},
    displayedStoryIds: /* @__PURE__ */ new Set(),
    transactionsCache: [],
    transactionsLastFetch: 0,
    highLowCache: null,
    highLowLastFetch: 0,
    liveWPCache: {},
    liveWPLastFetch: 0,
    streakCache: { data: [], fetchedAt: 0 },
    perfectGameTracker: {},
    // ── Dev Tuning State ─────────────────────────────────────────────────────
    devTuning: {
      rotateMs: 4500,
      rbiThreshold: 10,
      rbiCooldown: 9e4,
      hr_priority: 100,
      hr_cooldown: 3e5,
      biginning_priority: 70,
      biginning_threshold: 3,
      walkoff_priority: 100,
      walkoff_cooldown: 3e5,
      nohitter_inning_floor: 6,
      nohitter_priority: 95,
      basesloaded_enable: true,
      basesloaded_priority: 85,
      focus_critical: 120,
      focus_high: 70,
      focus_switch_margin: 25,
      focus_alert_cooldown: 9e4,
      hitstreak_floor: 10,
      hitstreak_priority: 65,
      roster_priority_il: 40,
      roster_priority_trade: 55,
      wp_leverage_floor: 2,
      wp_extreme_floor: 85,
      award_priority: 55,
      highlow_priority: 25,
      livewp_priority: 30,
      livewp_refresh_ms: 9e4
    },
    devColorLocked: false,
    devShowPushOnDesktop: false,
    devColorOverrides: {
      app: { dark: "", card: "", card2: "", border: "", primary: "", secondary: "", accent: "", accentText: "", headerText: "" },
      pulse: { dark: "", card: "", card2: "", border: "", primary: "", secondary: "", accent: "", accentText: "", headerText: "" }
    },
    // ── Focus Mode State ─────────────────────────────────────────────────────
    focusGamePk: null,
    focusIsManual: false,
    focusFastTimer: null,
    focusCurrentAbIdx: null,
    focusState: {
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      halfInning: "top",
      currentBatterId: null,
      currentBatterName: "",
      currentPitcherId: null,
      currentPitcherName: "",
      onFirst: false,
      onSecond: false,
      onThird: false,
      awayAbbr: "",
      homeAbbr: "",
      awayScore: 0,
      homeScore: 0,
      awayPrimary: "#444",
      homePrimary: "#444",
      tensionLabel: "NORMAL",
      tensionColor: "#9aa0a8",
      lastPitch: null,
      batterStats: null,
      pitcherStats: null
    },
    focusPitchSequence: [],
    focusStatsCache: {},
    focusLastTimecode: null,
    focusAlertShown: {},
    focusOverlayOpen: false,
    tabHiddenAt: null,
    // ── Scorecard Overlay State ──────────────────────────────────────────────
    scorecardOverlayOpen: false,
    scorecardGamePk: null,
    scorecardModel: null,
    scorecardCache: {},
    // ── Collection State ─────────────────────────────────────────────────────
    collectionFilter: "all",
    collectionSort: "newest",
    collectionPage: 0,
    collectionCareerStatsCache: {},
    lastCollectionResult: null,
    collectionSlotsDisplay: [],
    // ── Yesterday Recap State ────────────────────────────────────────────────
    yesterdayContentCache: {},
    liveContentCache: {},
    lastVideoClip: null,
    videoClipPollTimer: null,
    yesterdayOverlayOpen: false,
    ydHighlightClips: [],
    ydDateOffset: -1,
    ydDisplayCache: null,
    // ── Demo Mode State ──────────────────────────────────────────────────────
    demoMode: false,
    demoGamesCache: [],
    demoPlayQueue: [],
    demoPlayIdx: 0,
    demoTimer: null,
    demoStartTime: 0,
    demoDate: null,
    demoCurrentTime: 0,
    // Demo Mode v2 hydration targets (populated only by initDemo from
    // daily-events.json; consumed by PR-3 demo branches in Focus Mode,
    // pollPendingVideoClips, fetchBoxscore, etc.)
    pitchTimeline: {},
    // gamePk → [{atBatIndex, ts, pitches:[...], ...}]
    boxscoreSnapshots: {},
    // gamePk → [{ts, data}]
    contentCacheTimeline: {},
    // gamePk → [{ts, items:[trimmed clips]}]
    focusTrack: [],
    // [{ts, focusGamePk, isManual, tensionLabel}]
    demoCardCount: 0
    // session-only counter; rail chip increments as HR cards fire in demo (real localStorage untouched)
  };

  // src/ui/theme.js
  var themeCallbacks = { loadTodayGame: null, loadNextGame: null, loadNews: null, loadStandings: null, loadRoster: null, loadTeamStats: null, loadHomeInjuries: null, loadHomeMoves: null, loadHomeYoutubeWidget: null, loadHomePodcastWidget: null, applyMyTeamLens: null, clearHomeLiveTimer: null };
  function setThemeCallbacks(callbacks) {
    Object.assign(themeCallbacks, callbacks);
  }
  function relLuminance(hex) {
    hex = hex.replace("#", "");
    let n = parseInt(hex, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(hexA, hexB) {
    const lA = relLuminance(hexA), lB = relLuminance(hexB);
    return (Math.max(lA, lB) + 0.05) / (Math.min(lA, lB) + 0.05);
  }
  function hslHex(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l), f = function(n) {
      const k = (n + h / 30) % 12, c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, "0");
    };
    return "#" + f(0) + f(8) + f(4);
  }
  function hslLighten(hex, targetL) {
    hex = hex.replace("#", "");
    let n = parseInt(hex, 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return hslHex(Math.round(h * 360), Math.round(s * 100), Math.round(targetL * 100));
  }
  function pickAccent(secondaryHex, cardHex) {
    const sLum = relLuminance(secondaryHex), cCon = contrastRatio(secondaryHex, cardHex);
    if (sLum >= 0.18 && cCon >= 3) return secondaryHex;
    const lifted = hslLighten(secondaryHex, 0.65);
    if (contrastRatio(lifted, cardHex) >= 3) return lifted;
    return "#FFB273";
  }
  function pickHeaderText(primaryHex) {
    return relLuminance(primaryHex) > 0.5 ? "#0a0f1e" : "#ffffff";
  }
  function applyTeamTheme(team) {
    if (team) devTrace("theme", "applyTeamTheme \xB7 " + team.name + " (id:" + team.id + ")" + (state.devColorLocked ? " [locked]" : ""));
    if (state.devColorLocked && state.devColorOverrides.app.primary) {
      document.documentElement.style.setProperty("--dark", state.devColorOverrides.app.dark);
      document.documentElement.style.setProperty("--card", state.devColorOverrides.app.card);
      document.documentElement.style.setProperty("--card2", state.devColorOverrides.app.card2);
      document.documentElement.style.setProperty("--border", state.devColorOverrides.app.border);
      document.documentElement.style.setProperty("--primary", state.devColorOverrides.app.primary);
      document.documentElement.style.setProperty("--secondary", state.devColorOverrides.app.secondary);
      document.documentElement.style.setProperty("--accent", state.devColorOverrides.app.accent);
      document.documentElement.style.setProperty("--accent-text", state.devColorOverrides.app.accentText);
      document.documentElement.style.setProperty("--header-text", state.devColorOverrides.app.headerText);
      return;
    }
    const hdr = document.querySelector("header");
    if (hdr) {
      ["--primary", "--secondary", "--accent", "--accent-text", "--header-text"].forEach(function(v) {
        hdr.style.removeProperty(v);
      });
    }
    const ct = state.themeOverride || team;
    const cp = state.themeInvert ? ct.secondary : ct.primary, cs = state.themeInvert ? ct.primary : ct.secondary;
    let l1 = relLuminance(cp), l2 = relLuminance(cs), ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), accent = ratio >= 3 ? cs : "#ffffff", accentLum = relLuminance(accent);
    if (accentLum < 0.05) {
      accent = "#ffffff";
      accentLum = 1;
    }
    const accentText = accentLum > 0.4 ? "#111827" : "#ffffff";
    let hueOf = function(hex) {
      hex = hex.replace("#", "");
      let r = parseInt(hex.substr(0, 2), 16) / 255, g = parseInt(hex.substr(2, 2), 16) / 255, b = parseInt(hex.substr(4, 2), 16) / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h2 = 0;
      if (d) {
        if (max === r) h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h2 = ((b - r) / d + 2) / 6;
        else h2 = ((r - g) / d + 4) / 6;
      }
      return Math.round(h2 * 360);
    };
    const h = hueOf(cp), cardHex = hslHex(h, 45, 22);
    const safeAccent = pickAccent(accent, cardHex), headerText = pickHeaderText(cp);
    if (state.themeScope === "nav") {
      const dp = MLB_THEME.primary, ds = MLB_THEME.secondary;
      const dl1 = relLuminance(dp), dl2 = relLuminance(ds), dr = (Math.max(dl1, dl2) + 0.05) / (Math.min(dl1, dl2) + 0.05);
      let dacc = dr >= 3 ? ds : "#ffffff", daccLum = relLuminance(dacc);
      if (daccLum < 0.05) {
        dacc = "#ffffff";
        daccLum = 1;
      }
      const daccText = daccLum > 0.4 ? "#111827" : "#ffffff";
      const dh = hueOf(dp), dcard = hslHex(dh, 45, 22);
      const dSafeAcc = pickAccent(dacc, dcard), dHdrText = pickHeaderText(dp);
      document.documentElement.style.setProperty("--dark", hslHex(dh, 50, 18));
      document.documentElement.style.setProperty("--card", dcard);
      document.documentElement.style.setProperty("--card2", hslHex(dh, 40, 26));
      document.documentElement.style.setProperty("--border", hslHex(dh, 35, 30));
      document.documentElement.style.setProperty("--primary", dp);
      document.documentElement.style.setProperty("--secondary", dacc);
      document.documentElement.style.setProperty("--accent-text", daccText);
      document.documentElement.style.setProperty("--accent", dSafeAcc);
      document.documentElement.style.setProperty("--header-text", dHdrText);
      try {
        localStorage.setItem("mlb_theme_vars", JSON.stringify({ "--dark": hslHex(dh, 50, 18), "--card": dcard, "--card2": hslHex(dh, 40, 26), "--border": hslHex(dh, 35, 30), "--primary": dp, "--secondary": dacc, "--accent-text": daccText, "--accent": dSafeAcc, "--header-text": dHdrText }));
      } catch (e) {
      }
      if (hdr) {
        hdr.style.setProperty("--primary", cp);
        hdr.style.setProperty("--secondary", accent);
        hdr.style.setProperty("--accent-text", accentText);
        hdr.style.setProperty("--accent", safeAccent);
        hdr.style.setProperty("--header-text", headerText);
      }
      document.querySelector(".logo").innerHTML = '<img src="https://www.mlbstatic.com/team-logos/' + team.id + '.svg" style="height:32px;width:32px"> <span>' + team.short.toUpperCase() + "</span>";
      document.title = team.short + " Tracker";
      const tcmN = document.getElementById("themeColorMeta");
      if (tcmN) tcmN.setAttribute("content", cp);
      const chipN = document.getElementById("teamChip");
      if (chipN) chipN.textContent = team.name.toUpperCase();
      return;
    }
    document.documentElement.style.setProperty("--dark", hslHex(h, 50, 18));
    document.documentElement.style.setProperty("--card", cardHex);
    document.documentElement.style.setProperty("--card2", hslHex(h, 40, 26));
    document.documentElement.style.setProperty("--border", hslHex(h, 35, 30));
    document.documentElement.style.setProperty("--primary", cp);
    document.documentElement.style.setProperty("--secondary", accent);
    document.documentElement.style.setProperty("--accent-text", accentText);
    document.documentElement.style.setProperty("--accent", safeAccent);
    document.documentElement.style.setProperty("--header-text", headerText);
    try {
      localStorage.setItem("mlb_theme_vars", JSON.stringify({ "--dark": hslHex(h, 50, 18), "--card": cardHex, "--card2": hslHex(h, 40, 26), "--border": hslHex(h, 35, 30), "--primary": cp, "--secondary": accent, "--accent-text": accentText, "--accent": safeAccent, "--header-text": headerText }));
    } catch (e) {
    }
    document.querySelector(".logo").innerHTML = '<img src="https://www.mlbstatic.com/team-logos/' + team.id + '.svg" style="height:32px;width:32px"> <span>' + team.short.toUpperCase() + "</span>";
    document.title = team.short + " Tracker";
    const tcm = document.getElementById("themeColorMeta");
    if (tcm) tcm.setAttribute("content", cp);
    const chip = document.getElementById("teamChip");
    if (chip) chip.textContent = team.name.toUpperCase();
  }
  var PULSE_SCHEME = {
    dark: {
      label: "Navy",
      emoji: "\u26BE",
      dark: "#0F1B2E",
      card: "#172B4D",
      card2: "#1E3A5F",
      border: "#2C4A7F",
      accent: "#cfd3dc",
      accentSoft: "rgba(255,255,255,0.08)",
      accentStrong: "#ffffff",
      text: "#e8eaf0",
      muted: "#9aa0a8",
      scoringBg: "rgba(60,190,100,0.10)",
      scoringBorder: "rgba(60,190,100,0.28)",
      hrBg: "rgba(160,100,255,0.10)",
      hrBorder: "rgba(160,100,255,0.40)",
      statusBg: "rgba(80,140,255,0.08)",
      statusBorder: "rgba(80,140,255,0.22)"
    },
    light: {
      label: "Light",
      emoji: "\u2600\uFE0F",
      dark: "#F1F5F9",
      card: "#FFFFFF",
      card2: "#E8EDF3",
      border: "#CBD5E1",
      accent: "#2563EB",
      accentSoft: "rgba(37,99,235,0.08)",
      accentStrong: "#1E40AF",
      text: "#0F172A",
      muted: "#64748B",
      scoringBg: "rgba(22,163,74,0.07)",
      scoringBorder: "rgba(22,163,74,0.32)",
      hrBg: "rgba(109,40,217,0.07)",
      hrBorder: "rgba(109,40,217,0.28)",
      statusBg: "rgba(37,99,235,0.06)",
      statusBorder: "rgba(37,99,235,0.22)"
    }
  };
  var pulseColorScheme = function() {
    try {
      return localStorage.getItem("mlb_pulse_scheme") || "dark";
    } catch (e) {
      return "dark";
    }
  }();
  function applyPulseMLBTheme() {
    if (state.devColorLocked && state.devColorOverrides.pulse.primary) {
      document.documentElement.style.setProperty("--dark", state.devColorOverrides.pulse.dark);
      document.documentElement.style.setProperty("--p-dark", state.devColorOverrides.pulse.dark);
      document.documentElement.style.setProperty("--p-card", state.devColorOverrides.pulse.card);
      document.documentElement.style.setProperty("--p-card2", state.devColorOverrides.pulse.card2);
      document.documentElement.style.setProperty("--p-border", state.devColorOverrides.pulse.border);
      return;
    }
    const s = PULSE_SCHEME[pulseColorScheme] || PULSE_SCHEME.dark;
    document.documentElement.style.setProperty("--dark", s.dark);
    document.documentElement.style.setProperty("--p-dark", s.dark);
    document.documentElement.style.setProperty("--p-card", s.card);
    document.documentElement.style.setProperty("--p-card2", s.card2);
    document.documentElement.style.setProperty("--p-border", s.border);
    document.documentElement.style.setProperty("--p-accent", s.accent);
    document.documentElement.style.setProperty("--p-accent-soft", s.accentSoft);
    document.documentElement.style.setProperty("--p-accent-strong", s.accentStrong);
    document.documentElement.style.setProperty("--p-text", s.text);
    document.documentElement.style.setProperty("--p-muted", s.muted);
    document.documentElement.style.setProperty("--p-scoring-bg", s.scoringBg);
    document.documentElement.style.setProperty("--p-scoring-border", s.scoringBorder);
    document.documentElement.style.setProperty("--p-hr-bg", s.hrBg);
    document.documentElement.style.setProperty("--p-hr-border", s.hrBorder);
    document.documentElement.style.setProperty("--p-status-bg", s.statusBg);
    document.documentElement.style.setProperty("--p-status-border", s.statusBorder);
  }
  function setPulseColorScheme(scheme) {
    pulseColorScheme = scheme;
    try {
      localStorage.setItem("mlb_pulse_scheme", scheme);
    } catch (e) {
    }
    const ps = document.getElementById("pulse");
    if (ps && ps.classList.contains("active")) applyPulseMLBTheme();
    updatePulseToggle();
  }
  function updatePulseToggle() {
    const isLight = pulseColorScheme === "light";
    const icon = document.getElementById("ptbSchemeIcon");
    if (icon) icon.textContent = isLight ? "\u2600\uFE0F" : "\u{1F319}";
  }
  function togglePulseColorScheme() {
    setPulseColorScheme(pulseColorScheme === "dark" ? "light" : "dark");
  }
  function toggleSettings() {
    document.getElementById("settingsPanel").classList.toggle("open");
  }
  function setupSettingsClickOutside() {
    let t0x = 0, t0y = 0;
    document.addEventListener("touchstart", function(e) {
      t0x = e.touches[0].clientX;
      t0y = e.touches[0].clientY;
    }, { passive: true });
    function closeIfOutside(target) {
      const wrap = document.querySelector(".settings-wrap");
      if (wrap && !wrap.contains(target)) {
        const panel = document.getElementById("settingsPanel");
        if (panel) panel.classList.remove("open");
      }
      const tt = document.getElementById("calTooltip");
      if (tt && tt.classList.contains("open") && !target.closest(".cal-day")) tt.classList.remove("open");
    }
    document.addEventListener("touchend", function(e) {
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - t0x) > 10 || Math.abs(t.clientY - t0y) > 10) return;
      const target = document.elementFromPoint(t.clientX, t.clientY);
      if (target) closeIfOutside(target);
    }, { passive: true });
    document.addEventListener("click", function(e) {
      closeIfOutside(e.target);
    });
  }
  function buildThemeSelect() {
    const sel = document.getElementById("themeSelect");
    sel.innerHTML = '<option value="-1">Default</option><option value="0">Follow Team</option>';
    let lastDiv = "";
    TEAMS.forEach(function(t) {
      if (t.division !== lastDiv) {
        const og = document.createElement("optgroup");
        og.label = t.division;
        sel.appendChild(og);
        lastDiv = t.division;
      }
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      sel.lastChild.appendChild(opt);
    });
  }
  function switchTheme(val) {
    if (val === "0") {
      state.themeOverride = null;
    } else if (val === "-1") {
      state.themeOverride = MLB_THEME;
    } else {
      state.themeOverride = TEAMS.find((t) => t.id === parseInt(val));
    }
    localStorage.setItem("mlb_theme", val);
    applyTeamTheme(state.activeTeam);
  }
  function switchThemeScope(val) {
    state.themeScope = val;
    try {
      localStorage.setItem("mlb_theme_scope", val);
    } catch (e) {
    }
    applyTeamTheme(state.activeTeam);
  }
  function toggleInvert() {
    state.themeInvert = !state.themeInvert;
    localStorage.setItem("mlb_invert", state.themeInvert);
    const t = document.getElementById("invertToggle"), k = document.getElementById("invertToggleKnob");
    t.style.background = state.themeInvert ? "var(--primary)" : "var(--border)";
    k.style.left = state.themeInvert ? "21px" : "3px";
    t.setAttribute("aria-checked", state.themeInvert ? "true" : "false");
    applyTeamTheme(state.activeTeam);
    if (themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
    if (themeCallbacks.loadNextGame) themeCallbacks.loadNextGame();
  }
  function buildTeamSelect() {
    const sel = document.getElementById("teamSelect");
    sel.innerHTML = "";
    let lastDiv = "";
    TEAMS.forEach(function(t) {
      if (t.division !== lastDiv) {
        const og = document.createElement("optgroup");
        og.label = t.division;
        sel.appendChild(og);
        lastDiv = t.division;
      }
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      if (t.id === state.activeTeam.id) opt.selected = true;
      sel.lastChild.appendChild(opt);
    });
  }
  function switchTeam(teamId) {
    if (themeCallbacks.clearHomeLiveTimer) themeCallbacks.clearHomeLiveTimer();
    state.activeTeam = TEAMS.find((t) => t.id === parseInt(teamId));
    localStorage.setItem("mlb_team", teamId);
    applyTeamTheme(state.activeTeam);
    document.getElementById("settingsPanel").classList.remove("open");
    state.scheduleData = [];
    state.scheduleLoaded = false;
    state.rosterData = { hitting: [], pitching: [], fielding: [] };
    state.statsCache = { hitting: [], pitching: [] };
    state.selectedPlayer = null;
    document.getElementById("playerStats").innerHTML = '<div style="color:var(--muted);font-size:.9rem;padding:20px 0;text-align:center">Select a player to view stats</div>';
    if (themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
    if (themeCallbacks.loadNextGame) themeCallbacks.loadNextGame();
    if (themeCallbacks.loadNews) themeCallbacks.loadNews();
    if (themeCallbacks.loadStandings) themeCallbacks.loadStandings();
    if (themeCallbacks.loadRoster) themeCallbacks.loadRoster();
    if (themeCallbacks.loadTeamStats) themeCallbacks.loadTeamStats();
    if (themeCallbacks.loadHomeInjuries) themeCallbacks.loadHomeInjuries();
    if (themeCallbacks.loadHomeMoves) themeCallbacks.loadHomeMoves();
    if (themeCallbacks.loadHomePodcastWidget) themeCallbacks.loadHomePodcastWidget();
    if (themeCallbacks.loadHomeYoutubeWidget) themeCallbacks.loadHomeYoutubeWidget();
    if (document.getElementById("schedule").classList.contains("active") && themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
    if (state.myTeamLens && themeCallbacks.applyMyTeamLens) themeCallbacks.applyMyTeamLens(true);
  }

  // src/carousel/generators.js
  var DEBUG2 = false;
  var carouselCallbacks = { updateFeedEmpty: null, fetchBoxscore: null, localDateStr: null, getEffectiveDate: null, tcLookup: null };
  function setCarouselCallbacks(callbacks) {
    Object.assign(carouselCallbacks, callbacks);
  }
  function ordinal(n) {
    return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th";
  }
  function makeStory(id, type, tier, priority, icon, headline, sub, badge, gamePk, ts, cooldownMs, decayRate) {
    const existing = state.storyPool.find(function(s) {
      return s.id === id;
    });
    return { id, type, tier, priority, icon, headline, sub, badge, gamePk: gamePk || null, ts: ts || /* @__PURE__ */ new Date(), lastShown: existing ? existing.lastShown : null, cooldownMs, decayRate };
  }
  function liveOrHighlight(sbId, eventTs) {
    const recent = eventTs && Date.now() - eventTs.getTime() <= 6e4;
    return recent && !state.displayedStoryIds.has(sbId) ? "live" : "highlight";
  }
  function genHRStories() {
    const out = [];
    const hrsByBatter = {};
    state.feedItems.forEach(function(item) {
      if (!item.data || item.data.event !== "Home Run") return;
      if (state.demoMode && item.ts.getTime() > state.demoCurrentTime) return;
      const g = state.gameStates[item.gamePk];
      if (!g) return;
      const bid = item.data.batterId || "anon_" + item.gamePk + "_" + item.ts.getTime();
      if (!hrsByBatter[bid]) hrsByBatter[bid] = [];
      hrsByBatter[bid].push({ item, g });
    });
    const multiWords = ["", "", "second", "third", "fourth", "fifth"];
    Object.keys(hrsByBatter).forEach(function(bid) {
      const entries = hrsByBatter[bid];
      const latest = entries[0];
      const item = latest.item, g = latest.g;
      const count = entries.length;
      const bname = item.data.batterName || "Player";
      const statObj = state.hrBatterStatsCache[bid] || function() {
        const c = (state.statsCache.hitting || []).find(function(e) {
          return e.player && e.player.id == bid;
        });
        return c ? c.stat : null;
      }();
      let statStr = "";
      if (statObj && statObj.homeRuns != null) statStr = statObj.homeRuns + " HR \xB7 " + statObj.rbi + " RBI \xB7 " + fmtRate(statObj.avg) + " AVG \xB7 " + fmtRate(statObj.ops) + " OPS";
      const sub = g.awayAbbr + " @ " + g.homeAbbr + (statStr ? " \xB7 " + statStr : "");
      let id, headline, priority;
      if (count === 1) {
        id = "hr_" + item.gamePk + "_" + item.ts.getTime();
        const pitcherStr = item.data.pitcherName ? " off " + item.data.pitcherName : "";
        const distStr = item.data.distance ? item.data.distance + "ft " : "";
        const speedStr = item.data.speed ? " at " + item.data.speed + " mph" : "";
        const innStr = item.data.inning ? " in the " + ordinal(item.data.inning) + " inning" : "";
        const hrNumMatch = (item.data.desc || "").match(/\((\d+)\)/);
        const hrTag = hrNumMatch ? " (HR #" + hrNumMatch[1] + " this season)" : "";
        headline = bname + " hit a " + distStr + "homer" + speedStr + pitcherStr + innStr + hrTag;
        priority = state.devTuning.hr_priority;
      } else {
        id = "hr_multi_" + bid + "_" + entries[0].item.gamePk + "_" + count;
        const ordWord = multiWords[count] || count + "th";
        const innStr2 = item.data.inning ? " in the " + ordinal(item.data.inning) + " inning" : "";
        headline = bname + " hits his " + ordWord + " homer of the game" + innStr2 + "!";
        priority = state.devTuning.hr_priority + (count - 1) * 15;
      }
      out.push(makeStory(id, "realtime", 1, priority, "\u{1F4A5}", headline, sub, "highlight", item.gamePk, item.ts, state.devTuning.hr_cooldown, 0.5));
    });
    return out;
  }
  function genNoHitterWatch() {
    const out = [];
    Object.values(state.gameStates).forEach(function(g) {
      if (g.status !== "Live" || (g.detailedState === "Warmup" || g.detailedState === "Pre-Game")) return;
      if (g.inning < state.devTuning.nohitter_inning_floor) return;
      const nohitAway = g.awayHits === 0, nohitHome = g.homeHits === 0;
      if (!nohitAway && !nohitHome) return;
      const id = "nohit_" + g.gamePk;
      const pitchingTeam = nohitAway ? g.homeAbbr : g.awayAbbr;
      const hittingTeam = nohitAway ? g.awayAbbr : g.homeAbbr;
      const isPerfect = state.perfectGameTracker[g.gamePk] === true;
      let priority, headline;
      if (isPerfect) {
        priority = 99;
        headline = pitchingTeam + " working a perfect game through the " + ordinal(g.inning);
      } else {
        priority = state.devTuning.nohitter_priority;
        headline = pitchingTeam + " working a no-hitter through the " + ordinal(g.inning);
      }
      const sub = hittingTeam + " have 0 hits \xB7 " + g.awayAbbr + " " + g.awayScore + ", " + g.homeAbbr + " " + g.homeScore;
      out.push(makeStory(id, "nohit", 1, priority, "\u{1F6AB}", headline, sub, "live", g.gamePk, /* @__PURE__ */ new Date(), 2 * 6e4, 0.2));
    });
    return out;
  }
  function genWalkOffThreat() {
    const out = [];
    Object.values(state.gameStates).forEach(function(g) {
      if (g.status !== "Live" || g.halfInning !== "bottom" || g.inning < 9) return;
      const runnersOn = (g.onFirst ? 1 : 0) + (g.onSecond ? 1 : 0) + (g.onThird ? 1 : 0);
      const deficit = g.awayScore - g.homeScore;
      if (deficit < 0 || deficit > runnersOn + 1) return;
      const id = "walkoff_" + g.gamePk + "_" + g.inning;
      const headline = "Walk-off situation \u2014 " + g.homeAbbr + " in the bottom " + ordinal(g.inning);
      const sub = g.awayAbbr + " " + g.awayScore + ", " + g.homeAbbr + " " + g.homeScore + " \xB7 " + ordinal(g.inning) + " inning";
      out.push(makeStory(id, "walkoff", 1, state.devTuning.walkoff_priority, "\u{1F514}", headline, sub, "live", g.gamePk, /* @__PURE__ */ new Date(), state.devTuning.walkoff_cooldown, 0.9));
    });
    return out;
  }
  function genBasesLoaded() {
    if (!state.devTuning.basesloaded_enable) return [];
    const out = [];
    Object.values(state.gameStates).forEach(function(g) {
      if (g.status !== "Live" || !g.onFirst || !g.onSecond || !g.onThird) return;
      const battingAbbr = g.halfInning === "top" ? g.awayAbbr : g.homeAbbr;
      const id = "basesloaded_" + g.gamePk + "_" + g.inning + "_" + g.halfInning;
      const headline = "Bases loaded \u2014 " + battingAbbr + " batting in the " + ordinal(g.inning);
      const sub = g.awayAbbr + " " + g.awayScore + ", " + g.homeAbbr + " " + g.homeScore + " \xB7 " + ordinal(g.inning);
      out.push(makeStory(id, "realtime", 1, state.devTuning.basesloaded_priority, "\u{1F514}", headline, sub, "live", g.gamePk, /* @__PURE__ */ new Date(), 3 * 6e4, 0.8));
    });
    return out;
  }
  function genStolenBaseStories() {
    const out = [];
    const now = Date.now();
    state.stolenBaseEvents.forEach(function(sb) {
      const isHome = sb.base === "home";
      const baseLabel = isHome ? "home plate" : sb.base;
      const halfInd = sb.halfInning === "top" ? "\u25B2" : "\u25BC";
      const sub = sb.awayAbbr + " @ " + sb.homeAbbr + " \xB7 " + halfInd + sb.inning;
      if (sb.caught) {
        if (now - sb.ts.getTime() > 9e4) return;
        const csId = "cs_" + sb.key;
        out.push(makeStory(
          csId,
          "realtime",
          1,
          78,
          "\u{1F6AB}",
          (sb.runnerName || "Runner") + " caught stealing " + baseLabel,
          sub,
          liveOrHighlight(csId, sb.ts),
          sb.gamePk,
          sb.ts,
          9e4,
          0.9
        ));
      } else {
        const sbId = "sb_" + sb.key;
        out.push(makeStory(
          sbId,
          "realtime",
          isHome ? 1 : 2,
          isHome ? 92 : 65,
          "\u{1F3C3}",
          (sb.runnerName || "Runner") + " steals " + baseLabel,
          sub,
          liveOrHighlight(sbId, sb.ts),
          sb.gamePk,
          sb.ts,
          5 * 6e4,
          0.7
        ));
      }
    });
    return out;
  }
  function genActionEventStories() {
    const out = [];
    const now = Date.now();
    state.actionEvents.forEach(function(ae) {
      const ageMs = now - ae.ts.getTime();
      const halfInd = ae.halfInning === "top" ? "\u25B2" : "\u25BC";
      const sub = ae.awayAbbr + " @ " + ae.homeAbbr + " \xB7 " + halfInd + ae.inning;
      let id, headline, icon, priority, ttl;
      if (ae.kind === "pickoff_out") {
        ttl = 9e4;
        if (ageMs > ttl) return;
        id = "po_" + ae.key;
        headline = (ae.runnerName || "Runner") + " picked off at " + (ae.base === "home" ? "home" : ae.base);
        icon = "\u{1F3AF}";
        priority = 95;
      } else if (ae.kind === "pitching_change") {
        ttl = 9e4;
        if (ageMs > ttl) return;
        id = "pc_" + ae.key;
        headline = (ae.pitcherName || "New pitcher") + " takes the mound";
        icon = "\u{1F504}";
        priority = 80;
      } else if (ae.kind === "pinch_hitter") {
        ttl = 9e4;
        if (ageMs > ttl) return;
        id = "ph_" + ae.key;
        const phMatch = (ae.desc || "").match(/Pinch-hitter\s+([^.]+?)\s+replaces\s+([^.]+?)\.?$/);
        headline = phMatch ? phMatch[1] + " pinch-hits for " + phMatch[2] : "Pinch hitter announced";
        icon = "\u{1FA84}";
        priority = 80;
      } else if (ae.kind === "pinch_runner") {
        ttl = 9e4;
        if (ageMs > ttl) return;
        id = "pr_" + ae.key;
        const prMatch = (ae.desc || "").match(/Pinch-runner\s+([^.]+?)\s+replaces\s+([^.]+?)\.?$/);
        headline = prMatch ? prMatch[1] + " pinch-runs for " + prMatch[2] : "Pinch runner announced";
        icon = "\u{1F45F}";
        priority = 75;
      } else if (ae.kind === "replay_review") {
        ttl = 6e4;
        if (ageMs > ttl) return;
        id = "rr_" + ae.key;
        headline = "Replay review under way";
        icon = "\u{1F4FA}";
        priority = 90;
      } else {
        return;
      }
      out.push(makeStory(id, "realtime", 1, priority, icon, headline, sub, liveOrHighlight(id, ae.ts), ae.gamePk, ae.ts, ttl, 0.9));
    });
    return out;
  }
  function genBigInning() {
    const out = [], groups = {};
    state.feedItems.forEach(function(item) {
      if (!item.data || item.data.type !== "play" || !item.data.scoring) return;
      if (state.demoMode && item.ts.getTime() > state.demoCurrentTime) return;
      const key = item.gamePk + "_" + item.data.inning + "_" + item.data.halfInning;
      if (!groups[key]) groups[key] = { gamePk: item.gamePk, inning: item.data.inning, half: item.data.halfInning, runs: 0, lastItem: item };
      groups[key].runs++;
      groups[key].lastItem = item;
    });
    Object.values(groups).forEach(function(grp) {
      if (grp.runs < state.devTuning.biginning_threshold) return;
      const g = state.gameStates[grp.gamePk];
      if (!g) return;
      const id = "biginning_" + grp.gamePk + "_" + grp.inning + "_" + grp.half;
      const battingTeam = grp.half === "top" ? g.awayAbbr : g.homeAbbr;
      let headline = battingTeam + " scored " + grp.runs + " runs in the " + ordinal(grp.inning);
      const sub = g.awayAbbr + " @ " + g.homeAbbr;
      out.push(makeStory(id, "realtime", 1, state.devTuning.biginning_priority, "\u{1F525}", headline, sub, "highlight", grp.gamePk, grp.lastItem.ts, 10 * 6e4, 0.4));
    });
    return out;
  }
  function genFinalScoreStories() {
    const out = [];
    Object.values(state.gameStates).forEach(function(g) {
      if (g.status !== "Final") return;
      if (g.detailedState === "Postponed" || g.detailedState === "Cancelled" || g.detailedState === "Suspended") return;
      const id = "final_" + g.gamePk;
      const winner = g.awayScore > g.homeScore ? g.awayAbbr : g.homeAbbr;
      const loser = g.awayScore > g.homeScore ? g.homeAbbr : g.awayAbbr;
      const ws = Math.max(g.awayScore, g.homeScore), ls = Math.min(g.awayScore, g.homeScore);
      let headline = winner + " defeat " + loser + " " + ws + "-" + ls;
      const sub = "Final" + (g.venueName ? " \xB7 " + g.venueName : "");
      const ts = g.gameDateMs ? new Date(g.gameDateMs) : /* @__PURE__ */ new Date();
      out.push(makeStory(id, "game_status", 2, 50, "\u{1F3C1}", headline, sub, "final", g.gamePk, ts, 15 * 6e4, 0.3));
    });
    return out;
  }
  async function genStreakStories() {
    const out = [];
    const now = Date.now();
    if (now - state.streakCache.fetchedAt > 10 * 6e4) {
      try {
        const r = await fetch(MLB_BASE + "/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,league");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        const teams = [];
        (d.records || []).forEach(function(rec) {
          (rec.teamRecords || []).forEach(function(t) {
            teams.push(t);
          });
        });
        state.streakCache = { data: teams, fetchedAt: now };
      } catch (e) {
        return out;
      }
    }
    const floor = state.devTuning.hitstreak_floor || 3;
    let priority = state.devTuning.hitstreak_priority || 40;
    state.streakCache.data.forEach(function(t) {
      if (!t.streak || t.streak.streakNumber < floor) return;
      const isWin = t.streak.streakType === "wins";
      const n = t.streak.streakNumber;
      const id = "streak_" + t.team.id + "_" + n + "_" + (isWin ? "W" : "L");
      let headline = t.team.teamName + (isWin ? " on a " + n + "-game winning streak" : " on a " + n + "-game losing streak");
      out.push(makeStory(id, "streak", 2, priority, isWin ? "\u{1F525}" : "\u2744\uFE0F", headline, "", isWin ? "hot" : "cold", null, /* @__PURE__ */ new Date(), 20 * 6e4, 0.4));
    });
    return out;
  }
  async function genMultiHitDay() {
    const out = [], dateStr = carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
    const playerIds = Object.keys(state.dailyHitsTracker);
    for (let i = 0; i < playerIds.length; i++) {
      const batterId = playerIds[i];
      const entry = state.dailyHitsTracker[batterId];
      if (entry.hits < 3 && !(entry.hits >= 2 && entry.hrs >= 1)) continue;
      const id = "multihit_" + batterId + "_" + dateStr;
      let h = entry.hits, ab = entry.hits;
      if (!state.demoMode && entry.gamePk) {
        const bs = await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(entry.gamePk) : null);
        if (bs) {
          let team = bs.teams && bs.teams.away;
          let found = false;
          if (team && team.players) {
            Object.keys(team.players).forEach(function(pk) {
              const p = team.players[pk];
              if (p.person && p.person.id === parseInt(batterId)) {
                h = p.stats.batting.hits;
                ab = p.stats.batting.atBats;
                found = true;
              }
            });
          }
          if (!found) {
            team = bs.teams && bs.teams.home;
            if (team && team.players) {
              Object.keys(team.players).forEach(function(pk) {
                const p = team.players[pk];
                if (p.person && p.person.id === parseInt(batterId)) {
                  h = p.stats.batting.hits;
                  ab = p.stats.batting.atBats;
                }
              });
            }
          }
        }
      }
      const hrStr = entry.hrs ? " with " + entry.hrs + " HR" + (entry.hrs > 1 ? "s" : "") : "";
      let headline = state.demoMode ? entry.name + " goes " + h + "-for-today" + hrStr : entry.name + " goes " + h + " for " + ab + hrStr;
      const g = state.gameStates[entry.gamePk] || {};
      const sub = g.awayAbbr && g.homeAbbr ? g.awayAbbr + " @ " + g.homeAbbr : "";
      out.push(makeStory(id, "daily_stat", 2, 45, "\u{1F3CF}", headline, sub, g.status === "Live" ? "live" : "today", entry.gamePk, /* @__PURE__ */ new Date(), 15 * 6e4, 0.3));
    }
    return out;
  }
  function genDailyLeaders() {
    const out = [];
    if (!state.dailyLeadersCache) return out;
    const cats = [
      { key: "homeRuns", label: "Home Run Leaders", icon: "\u{1F3CF}", fmtVal: null },
      { key: "battingAverage", label: "Batting Avg Leaders", icon: "\u{1F3AF}", fmtVal: function(v) {
        return (v + "").replace(/^0\./, ".");
      } },
      { key: "rbi", label: "RBI Leaders", icon: "\u{1F3CF}", fmtVal: null },
      { key: "stolenBases", label: "Stolen Base Leaders", icon: "\u{1F3C3}", fmtVal: null },
      { key: "wins", label: "Pitching Wins Leaders", icon: "\u26BE", fmtVal: null },
      { key: "saves", label: "Pitching Saves Leaders", icon: "\u26BE", fmtVal: null }
    ];
    const today = carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
    cats.forEach(function(cat) {
      const list = state.dailyLeadersCache[cat.key];
      if (!list || !list.length) return;
      const sub = list.slice(0, 5).map(function(p, i) {
        if (!p || !p.person) return "";
        const lastName = p.person.fullName.split(" ").slice(1).join(" ") || p.person.fullName;
        const val = cat.fmtVal ? cat.fmtVal(p.value) : p.value;
        return i + 1 + ". " + lastName + " " + val;
      }).filter(Boolean).join(" \xB7 ");
      const id = "leader_" + cat.key + "_" + today;
      out.push(makeStory(id, "daily_stat", 3, 35, cat.icon, "MLB " + cat.label, sub, "leaders", null, /* @__PURE__ */ new Date(), 30 * 6e4, 0.4));
    });
    return out;
  }
  function genPitcherGem() {
    const out = [];
    Object.keys(state.dailyPitcherKs).forEach(function(key) {
      const entry = state.dailyPitcherKs[key];
      if (entry.ks < 8) return;
      const g = state.gameStates[entry.gamePk] || {};
      const id = "kgem_" + key;
      let headline = entry.name + " has " + entry.ks + " strikeouts today";
      const sub = g.awayAbbr && g.homeAbbr ? g.awayAbbr + " @ " + g.homeAbbr + (g.status === "Live" ? " \xB7 " + ordinal(g.inning) : "") : "";
      out.push(makeStory(id, "daily_stat", 2, 65, "\u26A1", headline, sub, g.status === "Live" ? "live" : "today", entry.gamePk, /* @__PURE__ */ new Date(), 10 * 6e4, 0.2));
    });
    return out;
  }
  function genOnThisDay() {
    if (!state.onThisDayCache || !state.onThisDayCache.length) return [];
    return state.onThisDayCache.map(function(item) {
      return makeStory(item.id, "historical", 4, 25, item.icon, item.headline, item.sub, "onthisday", item.gamePk, item.ts, 60 * 6e4, 0.6);
    });
  }
  function genYesterdayHighlights() {
    if (!state.yesterdayCache || !state.yesterdayCache.length) return [];
    return state.yesterdayCache.map(function(item) {
      return makeStory(item.id, "yesterday", 4, 30, item.icon, item.headline, item.sub, "yesterday", item.gamePk, item.ts, 30 * 6e4, 0.5);
    });
  }
  async function fetchMissingHRBatterStats() {
    if (state.demoMode) {
      if (DEBUG2) console.log("Demo: Skipping fetchMissingHRBatterStats API call");
      return;
    }
    const ids = [];
    state.feedItems.forEach(function(item) {
      if (!item.data || item.data.event !== "Home Run") return;
      const bid = item.data.batterId;
      if (bid && !state.hrBatterStatsCache[bid]) ids.push(bid);
    });
    const unique = [...new Set(ids)];
    if (!unique.length) return;
    await Promise.all(unique.map(async function(id) {
      try {
        const r = await fetch(MLB_BASE + "/people/" + id + "/stats?stats=season&season=" + SEASON + "&group=hitting");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        const stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
        if (stat) state.hrBatterStatsCache[id] = stat;
      } catch (e) {
      }
    }));
  }
  async function loadProbablePitcherStats() {
    if (state.demoMode) {
      if (DEBUG2) console.log("Demo: Skipping loadProbablePitcherStats API call");
      return;
    }
    const ids = [];
    Object.values(state.storyCarouselRawGameData).forEach(function(raw) {
      let awayPP = raw.teams && raw.teams.away && raw.teams.away.probablePitcher;
      let homePP = raw.teams && raw.teams.home && raw.teams.home.probablePitcher;
      if (awayPP && awayPP.id && !state.probablePitcherStatsCache[awayPP.id]) ids.push(awayPP.id);
      if (homePP && homePP.id && !state.probablePitcherStatsCache[homePP.id]) ids.push(homePP.id);
    });
    if (!ids.length) return;
    await Promise.all(ids.map(async function(id) {
      try {
        const r = await fetch(MLB_BASE + "/people/" + id + "/stats?stats=season&season=" + SEASON + "&group=pitching");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        const stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
        state.probablePitcherStatsCache[id] = { wins: stat ? stat.wins : 0, losses: stat ? stat.losses : 0 };
      } catch (e) {
        state.probablePitcherStatsCache[id] = { wins: 0, losses: 0 };
      }
    }));
  }
  function genProbablePitchers() {
    const out = [], today = carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
    const games = [];
    if (state.demoMode && DEBUG2) console.log("Demo: genProbablePitchers filtering to date", today, "found", Object.values(state.gameStates).filter((g) => carouselCallbacks.localDateStr(new Date(g.gameDateMs)) === today).length, "matching games");
    Object.values(state.gameStates).forEach(function(g) {
      if (carouselCallbacks.localDateStr(new Date(g.gameDateMs)) === today && g.awayAbbr && g.homeAbbr && g.status !== "Live" && g.status !== "Final") {
        const rawG = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
        if (rawG && rawG.doubleHeader === "Y" && rawG.gameNumber === 2) {
          const game1Live = Object.values(state.gameStates).some(function(s) {
            return s.status === "Live" && s.awayId === g.awayId && s.homeId === g.homeId;
          });
          if (game1Live) return;
        }
        games.push(g);
      }
    });
    games.forEach(function(g) {
      let awayAbbr = g.awayAbbr || "TBD", homeAbbr = g.homeAbbr || "TBD", awayPP = "TBD", homePP = "TBD";
      let awayPPId = null, homePPId = null;
      if (state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk]) {
        const raw = state.storyCarouselRawGameData[g.gamePk];
        if (raw.teams && raw.teams.away && raw.teams.away.probablePitcher && raw.teams.away.probablePitcher.fullName) {
          awayPP = raw.teams.away.probablePitcher.fullName;
          awayPPId = raw.teams.away.probablePitcher.id;
        }
        if (raw.teams && raw.teams.home && raw.teams.home.probablePitcher && raw.teams.home.probablePitcher.fullName) {
          homePP = raw.teams.home.probablePitcher.fullName;
          homePPId = raw.teams.home.probablePitcher.id;
        }
      }
      const awayWL = awayPPId && state.probablePitcherStatsCache[awayPPId] ? state.probablePitcherStatsCache[awayPPId].wins + "-" + state.probablePitcherStatsCache[awayPPId].losses : "0-0";
      const homeWL = homePPId && state.probablePitcherStatsCache[homePPId] ? state.probablePitcherStatsCache[homePPId].wins + "-" + state.probablePitcherStatsCache[homePPId].losses : "0-0";
      let headline = awayPP + " (" + awayWL + ") [" + awayAbbr + "] vs " + homePP + " (" + homeWL + ") [" + homeAbbr + "]";
      const rawG2 = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
      const timeTBD = rawG2 && rawG2.status && rawG2.status.startTimeTBD;
      const timeStr = timeTBD ? "TBD" : g.gameTime || "TBD";
      out.push(makeStory("probable_" + g.gamePk, "contextual", 4, 40, "\u26BE", headline, "Today \xB7 " + timeStr, "probables", g.gamePk, new Date(g.gameDateMs), 60 * 6e4, 0.3));
    });
    return out;
  }
  function genInningRecapStories() {
    const out = [];
    function genRecap(g, recapInning, recapHalf, recapKey) {
      if (state.inningRecapsFired.has(recapKey)) return;
      const inningPlays = state.feedItems.filter(function(item) {
        return item.gamePk === g.gamePk && item.data && item.data.inning === recapInning && item.data.halfInning === recapHalf && item.data.type === "play";
      });
      if (!inningPlays.length) return;
      const lastPlayInInning = inningPlays[0];
      const finalAwayScore = lastPlayInInning.data.awayScore;
      const finalHomeScore = lastPlayInInning.data.homeScore;
      let startAwayScore = 0, startHomeScore = 0;
      for (let i = 0; i < state.feedItems.length; i++) {
        if (state.feedItems[i].data && state.feedItems[i].data.type === "play" && state.feedItems[i].gamePk === g.gamePk) {
          if (state.feedItems[i].data.inning < recapInning || state.feedItems[i].data.inning === recapInning && state.feedItems[i].data.halfInning !== recapHalf) {
            startAwayScore = state.feedItems[i].data.awayScore;
            startHomeScore = state.feedItems[i].data.homeScore;
            break;
          }
        }
      }
      const runs = recapHalf === "top" ? finalAwayScore - startAwayScore : finalHomeScore - startHomeScore;
      let strikeouts = 0, walks = 0, hrs = 0, dps = 0, errors = 0, playerHRs = [], pitcherNames = /* @__PURE__ */ new Set(), hadRisp = false, dpBatter = null;
      const isClean123 = inningPlays.length === 3 && !inningPlays.some(function(p) {
        return p.data.scoring;
      });
      let runnersLeftOn = false;
      inningPlays.forEach(function(play) {
        if (play.data.risp) hadRisp = true;
        if (play.data.desc.indexOf("strikes out") !== -1) strikeouts++;
        if (play.data.desc.indexOf("walk") !== -1) walks++;
        if (play.data.event === "Home Run") {
          hrs++;
          playerHRs.push(play.data.batterName);
        }
        if (play.data.desc.indexOf("double play") !== -1) {
          dps++;
          if (!dpBatter) dpBatter = play.data.batterName;
        }
        if (play.data.desc.indexOf("error") !== -1) errors++;
        if (play.data.pitcherName) pitcherNames.add(play.data.pitcherName);
      });
      const lastPlay = inningPlays[inningPlays.length - 1];
      const b1 = !!lastPlay.data.onFirst, b2 = !!lastPlay.data.onSecond, b3 = !!lastPlay.data.onThird;
      const hasPerBaseInfo = lastPlay.data.onFirst != null || lastPlay.data.onSecond != null || lastPlay.data.onThird != null;
      runnersLeftOn = hasPerBaseInfo ? b1 || b2 || b3 : !!lastPlay.data.risp;
      let strandPhrase = "strand runners";
      if (hasPerBaseInfo) {
        if (b1 && b2 && b3) strandPhrase = "strand the bases loaded";
        else if (b1 && b3) strandPhrase = "strand runners at the corners";
        else if (b2 && b3) strandPhrase = "strand runners on 2nd and 3rd";
        else if (b1 && b2) strandPhrase = "strand runners on 1st and 2nd";
        else if (b3) strandPhrase = "strand a runner on 3rd";
        else if (b2) strandPhrase = "strand a runner on 2nd";
        else if (b1) strandPhrase = "strand a runner on 1st";
      } else if (lastPlay.data.risp) {
        strandPhrase = "strand runners in scoring position";
      }
      const pitcher = pitcherNames.size === 1 ? Array.from(pitcherNames)[0] : null;
      const battingTeam = recapHalf === "top" ? g.awayName : g.homeName;
      const pittchingTeam = recapHalf === "top" ? g.homeName : g.awayName;
      const halfLabel = recapHalf === "top" ? "top" : "bottom";
      const innStr = ordinal(recapInning);
      let priority = 0, headline = "";
      if (hrs > 0 && runs > 0) {
        priority = 100;
        const hrStr = hrs === 1 ? playerHRs[0] + " goes deep" : "Back-to-back homers";
        headline = hrStr + " in the " + halfLabel + " of the " + innStr + ", " + battingTeam + " score " + runs;
      } else if (strikeouts === 3 && inningPlays.length === 3) {
        priority = 95;
        headline = pitcher ? pitcher + " strikes out the side in the " + innStr : "Perfect strikeout inning in the " + innStr;
      } else if (runs >= 2 && hrs === 0) {
        priority = 90;
        headline = battingTeam + " score " + runs + " runs in the " + halfLabel + " of the " + innStr;
      } else if (runs > 0 && hadRisp) {
        const battingScore = recapHalf === "top" ? g.awayScore : g.homeScore;
        const pitchingScore = recapHalf === "top" ? g.homeScore : g.awayScore;
        if (battingScore <= pitchingScore) {
          priority = 85;
          headline = battingTeam + " claw back in the " + innStr;
        }
      } else if (runnersLeftOn && runs === 0 && inningPlays.length === 3) {
        priority = 80;
        headline = battingTeam + " " + strandPhrase + " in the " + halfLabel + " of the " + innStr;
      } else if (strikeouts >= 2 && runs === 0 && isClean123) {
        priority = 75;
        headline = pitcher ? pitcher + " keeps " + pittchingTeam + " off the board with " + strikeouts + " Ks in the " + innStr : "Clean " + strikeouts + "-strikeout inning in the " + innStr;
      } else if (dps > 0) {
        priority = 70;
        headline = dpBatter ? dpBatter + " hits into a double play in the " + innStr : pittchingTeam + " turn a double play to escape the " + innStr;
      } else if (walks >= 3) {
        priority = 65;
        headline = walks + " walks load the bases for " + battingTeam + " in the " + innStr;
      } else if (errors > 0 && runs > 0) {
        priority = 55;
        headline = "Error plates a run \u2014 " + battingTeam + " capitalize in the " + innStr;
      } else if (strikeouts >= 2 && isClean123) {
        priority = 40;
        headline = pitcher ? pitcher + " retires the side with " + strikeouts + " Ks in the " + innStr : battingTeam + " go 1-2-3 with " + strikeouts + " strikeouts in the " + innStr;
      } else if (isClean123) {
        priority = 25;
        headline = battingTeam + " go 1-2-3 in the " + halfLabel + " of the " + innStr;
      } else if (runs > 0) {
        priority = 45;
        headline = battingTeam + " score " + runs + " in the " + innStr;
      } else {
        priority = 0;
        headline = runs + " runs for " + battingTeam + " in the " + halfLabel + " of the " + innStr;
      }
      if (!headline) return;
      state.inningRecapsFired.add(recapKey);
      const sub = battingTeam + " \xB7 " + ordinal(recapInning) + " inning";
      out.push(makeStory("inning_recap_" + recapKey, "inning_recap", 2, priority, "\u{1F4CA}", headline, sub, "inning_recap", g.gamePk, /* @__PURE__ */ new Date(), 0, 0));
    }
    Object.keys(state.inningRecapsPending).forEach(function(recapKey) {
      const p = state.inningRecapsPending[recapKey];
      const g = state.gameStates[p.gamePk];
      if (!g) {
        delete state.inningRecapsPending[recapKey];
        return;
      }
      genRecap(g, p.inning, p.halfInning, recapKey);
      delete state.inningRecapsPending[recapKey];
      state.lastInningState[p.gamePk] = { inning: p.inning, halfInning: p.halfInning };
    });
    Object.values(state.gameStates).forEach(function(g) {
      if (g.status !== "Live") return;
      const lastState = state.lastInningState[g.gamePk];
      if (!lastState) {
        state.lastInningState[g.gamePk] = { inning: g.inning, halfInning: g.halfInning };
        return;
      }
      if (lastState.inning === g.inning && lastState.halfInning === g.halfInning) return;
      const recapKey = g.gamePk + "_" + lastState.inning + "_" + lastState.halfInning;
      if (state.inningRecapsFired.has(recapKey)) {
        state.lastInningState[g.gamePk] = { inning: g.inning, halfInning: g.halfInning };
        return;
      }
      genRecap(g, lastState.inning, lastState.halfInning, recapKey);
      state.lastInningState[g.gamePk] = { inning: g.inning, halfInning: g.halfInning };
    });
    return out;
  }
  async function loadTransactionsCache() {
    try {
      const today = etDateStr(), start = etDatePlus(today, -2);
      const r = await fetch(MLB_BASE + "/transactions?sportId=1&startDate=" + start + "&endDate=" + today);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const notable = ["Injured List", "Designated for Assignment", "Selected", "Called Up", "Trade", "Activated From"];
      state.transactionsCache = (d.transactions || []).filter(function(t) {
        return notable.some(function(kw) {
          return (t.typeDesc || "").indexOf(kw) !== -1;
        });
      });
      state.transactionsLastFetch = Date.now();
    } catch (e) {
      state.transactionsCache = state.transactionsCache || [];
    }
  }
  async function loadHighLowCache() {
    try {
      const stats = ["homeRuns", "strikeOuts", "hits"];
      const allResults = {};
      for (let i = 0; i < stats.length; i++) {
        try {
          const r = await fetch(MLB_BASE + "/highLow/player?sortStat=" + stats[i] + "&season=" + SEASON + "&sportId=1&gameType=R&limit=3");
          if (!r.ok) throw new Error(r.status);
          const d = await r.json();
          allResults[stats[i]] = d.results || [];
        } catch (e) {
          allResults[stats[i]] = [];
        }
      }
      state.highLowCache = allResults;
      state.highLowLastFetch = Date.now();
    } catch (e) {
      state.highLowCache = state.highLowCache || {};
    }
  }
  function genRosterMoveStories() {
    const out = [];
    if (!state.transactionsCache || !state.transactionsCache.length) return out;
    const cutoff = Date.now() - 48 * 60 * 60 * 1e3;
    state.transactionsCache.forEach(function(t) {
      if (!t.person || !t.person.fullName) return;
      const txDate = t.date ? new Date(t.date).getTime() : 0;
      if (txDate && txDate < cutoff) return;
      const fullName = t.person.fullName;
      const desc = t.typeDesc || "";
      let icon, priority, headline;
      const toAbbr = t.toTeam && t.toTeam.id ? carouselCallbacks.tcLookup(t.toTeam.id).abbr : "the majors";
      if (desc.indexOf("Activated") !== -1) {
        icon = "\u2705";
        priority = state.devTuning.roster_priority_il || 40;
        headline = fullName + " (" + toAbbr + ") activated";
      } else if (desc.indexOf("Injured List") !== -1) {
        icon = "\u{1F3E5}";
        priority = state.devTuning.roster_priority_il || 40;
        const ilMatch = desc.match(/(\d+)-Day/);
        const ilDays = ilMatch ? ilMatch[1] : "";
        headline = fullName + " (" + toAbbr + ") placed on the " + (ilDays ? ilDays + "-Day " : "") + "IL";
      } else if (desc.indexOf("Designated") !== -1) {
        icon = "\u2B07\uFE0F";
        priority = state.devTuning.roster_priority_il || 40;
        headline = fullName + " (" + toAbbr + ") designated for assignment";
      } else if (desc.indexOf("Selected") !== -1 || desc.indexOf("Called Up") !== -1) {
        icon = "\u2B06\uFE0F";
        priority = state.devTuning.roster_priority_trade || 55;
        headline = fullName + " called up by " + toAbbr;
      } else if (desc.indexOf("Trade") !== -1) {
        icon = "\u{1F504}";
        priority = state.devTuning.roster_priority_trade || 55;
        const fromAbbr = t.fromTeam && t.fromTeam.id ? carouselCallbacks.tcLookup(t.fromTeam.id).abbr : "the majors";
        headline = fullName + " traded from " + fromAbbr + " to " + toAbbr;
      } else {
        icon = "\u{1F4CB}";
        priority = 35;
        headline = fullName + " (" + toAbbr + ") \u2014 " + desc;
      }
      const id = "roster_" + t.typeCode + "_" + (t.person.id || 0) + "_" + (t.date || "today");
      const sub = toAbbr + (t.date ? " \xB7 " + t.date : "");
      out.push(makeStory(id, "roster_move", 3, priority, icon, headline, sub, "roster", null, t.date ? new Date(t.date) : /* @__PURE__ */ new Date(), 120 * 6e4, 0.2));
    });
    return out;
  }
  async function genWinProbabilityStories() {
    const out = [];
    if (!state.focusGamePk) return out;
    if (state.demoMode) return out;
    const g = state.gameStates[state.focusGamePk];
    if (!g || g.status !== "Live" || (g.detailedState === "Warmup" || g.detailedState === "Pre-Game")) return out;
    try {
      const r = await fetch(MLB_BASE + "/game/" + state.focusGamePk + "/contextMetrics");
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const homeWP = d.homeWinProbability || 50;
      const leverageIndex = d.leverageIndex || 1;
      const wpAdded = Math.abs(d.homeWinProbabilityAdded || 0);
      const isExtreme = homeWP >= (state.devTuning.wp_extreme_floor || 85) || homeWP <= 100 - (state.devTuning.wp_extreme_floor || 85);
      const isHighLev = leverageIndex >= (state.devTuning.wp_leverage_floor || 2);
      const isBigSwing = wpAdded >= 20;
      if (!isExtreme && !isHighLev && !isBigSwing) return out;
      const favAbbr = homeWP > 50 ? g.homeAbbr : g.awayAbbr;
      const favWP = homeWP > 50 ? homeWP : 100 - homeWP;
      const id = "wp_" + state.focusGamePk + "_" + Math.round(homeWP / 5) * 5;
      let icon, headline, badge, tier, priority;
      if (leverageIndex >= 3) {
        icon = "\u26A1";
        tier = 1;
        priority = 72;
        badge = "live";
        headline = "High leverage \u2014 " + g.awayAbbr + " @ " + g.homeAbbr;
      } else if (isExtreme) {
        icon = "\u{1F4CA}";
        tier = 2;
        priority = 65;
        badge = "live";
        headline = favAbbr + " are " + Math.round(favWP) + "% favorites in the " + ordinal(g.inning);
      } else {
        icon = "\u{1F4CA}";
        tier = 2;
        priority = 60;
        badge = "live";
        headline = "Win probability swings for " + favAbbr + " (+" + Math.round(wpAdded) + "%)";
      }
      const sub = g.awayAbbr + " @ " + g.homeAbbr + " \xB7 " + ordinal(g.inning) + " \xB7 " + Math.round(favWP) + "% WP";
      state.storyPool = state.storyPool.filter(function(s) {
        return s.id.indexOf("wp_" + state.focusGamePk + "_") !== 0;
      });
      out.push(makeStory(id, "realtime", tier, priority, icon, headline, sub, badge, state.focusGamePk, /* @__PURE__ */ new Date(), 3 * 6e4, 0.6));
    } catch (e) {
    }
    return out;
  }
  function genSeasonHighStories() {
    const out = [];
    if (!state.highLowCache) return out;
    const SEASON_STR = String(SEASON);
    const configs = [
      { stat: "homeRuns", icon: "\u{1F4A5}", label: "HR in a game", threshold: 3 },
      { stat: "strikeOuts", icon: "\u{1F525}", label: "strikeouts in a game", threshold: 13 },
      { stat: "hits", icon: "\u{1F3CF}", label: "hits in a game", threshold: 4 }
    ];
    configs.forEach(function(cfg) {
      const results = state.highLowCache[cfg.stat] || [];
      if (!results.length) return;
      const top = results[0];
      if (!top || !top.person || !top.stat) return;
      const val = top.stat[cfg.stat] || 0;
      if (val < cfg.threshold) return;
      const lastName = top.person.fullName.split(" ").slice(1).join(" ") || top.person.fullName;
      const teamAbbr = top.team && top.team.abbreviation || "";
      const oppAbbr = top.opponent && top.opponent.abbreviation || "";
      const dateStr = top.game && top.game.gameDate ? top.game.gameDate : "";
      const id = "highlow_" + cfg.stat + "_" + top.person.id + "_" + SEASON_STR;
      const headline = SEASON_STR + " season high: " + lastName + " \u2014 " + val + " " + cfg.label;
      const sub = teamAbbr + (oppAbbr ? " vs " + oppAbbr : "") + (dateStr ? " \xB7 " + dateStr : "");
      out.push(makeStory(id, "contextual", 4, state.devTuning.highlow_priority || 25, "\u{1F396}\uFE0F", headline, sub, "record", null, dateStr ? new Date(dateStr) : /* @__PURE__ */ new Date(), 24 * 60 * 6e4, 0.3));
    });
    return out;
  }
  async function loadDailyLeaders() {
    if (state.demoMode) {
      if (DEBUG2) console.log("Demo: Skipping loadDailyLeaders API call");
      return;
    }
    try {
      const rH = await fetch(MLB_BASE + "/stats/leaders?leaderCategories=homeRuns,battingAverage,rbi,stolenBases&season=" + SEASON + "&statGroup=hitting&limit=5");
      if (!rH.ok) throw new Error(rH.status);
      const dH = await rH.json();
      const rP = await fetch(MLB_BASE + "/stats/leaders?leaderCategories=wins,saves&season=" + SEASON + "&statGroup=pitching&limit=5");
      if (!rP.ok) throw new Error(rP.status);
      const dP = await rP.json();
      state.dailyLeadersCache = {};
      [dH.leagueLeaders || [], dP.leagueLeaders || []].forEach(function(list) {
        list.forEach(function(cat) {
          if (cat.leaderCategory && cat.leaders) state.dailyLeadersCache[cat.leaderCategory] = cat.leaders;
        });
      });
    } catch (e) {
    }
  }
  async function loadOnThisDayCache() {
    state.onThisDayCache = [];
    const todayParts = etDateStr().split("-");
    const mm = todayParts[1];
    const dd = todayParts[2];
    for (let i = 1; i <= 3; i++) {
      const yr = SEASON - i;
      try {
        const r = await fetch(MLB_BASE + "/schedule?date=" + yr + "-" + mm + "-" + dd + "&sportId=1&hydrate=linescore,team");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        const games = (d.dates || []).flatMap(function(dt) {
          return dt.games || [];
        }).filter(function(g) {
          return g.status.abstractGameState === "Final";
        });
        for (let j = 0; j < games.length; j++) {
          const g = games[j];
          const away = g.teams.away, home = g.teams.home;
          const winner = away.score > home.score ? away.team.abbreviation : home.team.abbreviation;
          const loser = away.score > home.score ? home.team.abbreviation : away.team.abbreviation;
          const ws = Math.max(away.score || 0, home.score || 0), ls = Math.min(away.score || 0, home.score || 0);
          let playerHighlight = "", sigPlay = "";
          try {
            const bs = await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(g.gamePk) : null);
            const allPlayers = Object.assign({}, bs && bs.teams && bs.teams.home && bs.teams.home.players || {}, bs && bs.teams && bs.teams.away && bs.teams.away.players || {});
            let topBatter = null, topBatterStats = null;
            const hrHitters = { multi: [], single: [] };
            Object.values(allPlayers).forEach(function(p) {
              if (!p.stats || !p.stats.batting) return;
              const bat = p.stats.batting;
              if (!bat.hits || bat.atBats < 2) return;
              if (!topBatter || bat.hits / bat.atBats > topBatterStats.hits / topBatterStats.atBats) {
                topBatter = p;
                topBatterStats = bat;
              }
              if (bat.homeRuns && bat.homeRuns >= 2) hrHitters.multi.push({ name: p.person.fullName.split(" ").pop(), hrs: bat.homeRuns });
              else if (bat.homeRuns === 1) hrHitters.single.push(p.person.fullName.split(" ").pop());
            });
            let winPitcher = null, winPitcherStats = null, losePitcher = null, losePitcherStats = null, savePitcher = null;
            const allPitchers = [];
            Object.values(allPlayers).forEach(function(p) {
              if (!p.stats || !p.stats.pitching) return;
              const pit = p.stats.pitching;
              if (p.gameStatus) {
                if (p.gameStatus.isWinningPitcher) {
                  winPitcher = p;
                  winPitcherStats = pit;
                }
                if (p.gameStatus.isLosingPitcher) {
                  losePitcher = p;
                  losePitcherStats = pit;
                }
                if (p.gameStatus.isSavePitcher) savePitcher = p;
              }
              if (parseFloat(pit.inningsPitched || 0) > 0) allPitchers.push({ p, stats: pit });
            });
            if (!winPitcher || !losePitcher) {
              allPitchers.sort(function(a, b) {
                return parseFloat(b.stats.inningsPitched || 0) - parseFloat(a.stats.inningsPitched || 0);
              });
              if (!winPitcher && allPitchers.length) {
                winPitcher = allPitchers[0].p;
                winPitcherStats = allPitchers[0].stats;
              }
              if (!losePitcher && allPitchers.length > 1) {
                losePitcher = allPitchers[1].p;
                losePitcherStats = allPitchers[1].stats;
              }
            }
            const lines = [];
            if (topBatter && topBatterStats) lines.push(topBatter.person.fullName.split(" ").pop() + " " + topBatterStats.hits + "-" + topBatterStats.atBats);
            if (winPitcher && winPitcherStats) lines.push("W: " + winPitcher.person.fullName.split(" ").pop() + " " + winPitcherStats.inningsPitched + "IP, " + winPitcherStats.strikeOuts + "K, " + (winPitcherStats.earnedRuns || 0) + " ER");
            if (losePitcher && losePitcherStats) lines.push("L: " + losePitcher.person.fullName.split(" ").pop() + " " + losePitcherStats.inningsPitched + "IP, " + losePitcherStats.strikeOuts + "K, " + (losePitcherStats.earnedRuns || 0) + " ER");
            if (savePitcher) lines.push("S: " + savePitcher.person.fullName.split(" ").pop());
            hrHitters.multi.forEach(function(h) {
              lines.push(h.name + " " + h.hrs + "HR");
            });
            hrHitters.single.forEach(function(name) {
              lines.push(name + " HR");
            });
            if (lines.length) playerHighlight = " \xB7 " + lines.join(" \xB7 ");
          } catch (e) {
          }
          try {
            const pbResp = await fetch(MLB_BASE + "/game/" + g.gamePk + "/playByPlay");
            if (!pbResp.ok) throw new Error(pbResp.status);
            const pb = await pbResp.json();
            const plays = pb.allPlays || [];
            const lastPlay = plays[plays.length - 1];
            if (lastPlay && lastPlay.about && lastPlay.about.isScoringPlay && lastPlay.result) {
              const evt = lastPlay.result.event || "";
              if (evt.indexOf("Home Run") !== -1 && lastPlay.about.inning >= 9 && Math.abs(ws - ls) <= 1) {
                sigPlay = " \xB7 Walk-off HR!";
              } else if (evt.indexOf("Grand Slam") !== -1) {
                sigPlay = " \xB7 Grand slam!";
              }
            }
            const allHits = { away: 0, home: 0 };
            plays.forEach(function(p) {
              if (p.result && ["Single", "Double", "Triple", "Home Run"].indexOf(p.result.event) !== -1) {
                const half = (p.about.halfInning || "Top").toLowerCase();
                allHits[half === "top" ? "away" : "home"]++;
              }
            });
            if (allHits.away === 0 || allHits.home === 0) {
              sigPlay = " \xB7 No-hitter!";
            }
          } catch (e) {
          }
          const headline = "On this day in " + yr + ": " + winner + " beat " + loser + " " + ws + "-" + ls + playerHighlight + sigPlay;
          state.onThisDayCache.push({ id: "otd_" + yr + "_" + g.gamePk, icon: "\u{1F4C5}", headline, sub: g.venue ? g.venue.name : "", gamePk: g.gamePk, ts: new Date(g.gameDate || Date.now()) });
        }
      } catch (e) {
      }
    }
  }
  async function loadYdForDate(dateStr) {
    const result = [];
    try {
      const r = await fetch(MLB_BASE + "/schedule?date=" + dateStr + "&sportId=1&hydrate=linescore,team");
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const games = (d.dates || []).flatMap(function(dt) {
        return dt.games || [];
      }).filter(function(g) {
        if (g.status.abstractGameState !== "Final") return false;
        const detailed = g.status.detailedState || "";
        if (detailed === "Postponed" || detailed === "Cancelled" || detailed === "Suspended") return false;
        return true;
      });
      for (let i = 0; i < games.length; i++) {
        const g = games[i];
        const away = g.teams.away, home = g.teams.home;
        const winner = away.score > home.score ? away.team.abbreviation : home.team.abbreviation;
        const loser = away.score > home.score ? home.team.abbreviation : away.team.abbreviation;
        const ws = Math.max(away.score || 0, home.score || 0), ls = Math.min(away.score || 0, home.score || 0);
        const linescore = g.linescore || {};
        const dur = linescore.gameDurationMinutes ? " \xB7 " + Math.floor(linescore.gameDurationMinutes / 60) + "h " + String(linescore.gameDurationMinutes % 60).padStart(2, "0") + "m" : "";
        let playerHighlight = "", sigPlay = "";
        try {
          const bs = await (carouselCallbacks.fetchBoxscore ? carouselCallbacks.fetchBoxscore(g.gamePk) : null);
          const allPlayers = Object.assign({}, bs && bs.teams && bs.teams.home && bs.teams.home.players || {}, bs && bs.teams && bs.teams.away && bs.teams.away.players || {});
          let topBatter = null, topBatterStats = null;
          Object.values(allPlayers).forEach(function(p) {
            if (!p.stats || !p.stats.batting) return;
            const bat = p.stats.batting;
            if (!bat.hits || bat.atBats < 2) return;
            if (!topBatter || bat.hits / bat.atBats > topBatterStats.hits / topBatterStats.atBats) {
              topBatter = p;
              topBatterStats = bat;
            }
          });
          let winPitcher = null, winPitcherStats = null, losePitcher = null, losePitcherStats = null, savePitcher = null;
          const allPitchers = [];
          Object.values(allPlayers).forEach(function(p) {
            if (!p.stats || !p.stats.pitching) return;
            const pit = p.stats.pitching;
            if (p.gameStatus) {
              if (p.gameStatus.isWinningPitcher) {
                winPitcher = p;
                winPitcherStats = pit;
              }
              if (p.gameStatus.isLosingPitcher) {
                losePitcher = p;
                losePitcherStats = pit;
              }
              if (p.gameStatus.isSavePitcher) savePitcher = p;
            }
            if (parseFloat(pit.inningsPitched || 0) > 0) allPitchers.push({ p, stats: pit });
          });
          if (!winPitcher || !losePitcher) {
            allPitchers.sort(function(a, b) {
              return parseFloat(b.stats.inningsPitched || 0) - parseFloat(a.stats.inningsPitched || 0);
            });
            if (!winPitcher && allPitchers.length) {
              winPitcher = allPitchers[0].p;
              winPitcherStats = allPitchers[0].stats;
            }
            if (!losePitcher && allPitchers.length > 1) {
              losePitcher = allPitchers[1].p;
              losePitcherStats = allPitchers[1].stats;
            }
          }
          const lines = [];
          if (topBatter && topBatterStats) {
            let bline = topBatter.person.fullName.split(" ").pop() + " " + topBatterStats.hits + "-" + topBatterStats.atBats;
            if (topBatterStats.homeRuns > 0) bline += " " + topBatterStats.homeRuns + "HR";
            if (topBatterStats.rbi > 0) bline += " " + topBatterStats.rbi + "RBI";
            lines.push(bline);
          }
          if (winPitcher && winPitcherStats) lines.push("W: " + winPitcher.person.fullName.split(" ").pop() + " " + winPitcherStats.inningsPitched + "IP, " + winPitcherStats.strikeOuts + "K, " + (winPitcherStats.earnedRuns || 0) + " ER");
          if (losePitcher && losePitcherStats) lines.push("L: " + losePitcher.person.fullName.split(" ").pop() + " " + losePitcherStats.inningsPitched + "IP, " + losePitcherStats.strikeOuts + "K, " + (losePitcherStats.earnedRuns || 0) + " ER");
          if (savePitcher) lines.push("S: " + savePitcher.person.fullName.split(" ").pop());
          if (lines.length) playerHighlight = " \xB7 " + lines.join(" \xB7 ");
        } catch (e) {
        }
        try {
          const pbResp2 = await fetch(MLB_BASE + "/game/" + g.gamePk + "/playByPlay");
          if (!pbResp2.ok) throw new Error(pbResp2.status);
          const pb = await pbResp2.json();
          const plays = pb.allPlays || [];
          const lastPlay = plays[plays.length - 1];
          if (lastPlay && lastPlay.about && lastPlay.about.isScoringPlay && lastPlay.result) {
            const evt = lastPlay.result.event || "";
            if (evt.indexOf("Home Run") !== -1 && lastPlay.about.inning >= 9 && Math.abs(ws - ls) <= 1) {
              sigPlay = " \xB7 Walk-off HR!";
            } else if (evt.indexOf("Grand Slam") !== -1) {
              sigPlay = " \xB7 Grand slam!";
            }
          }
          const allHits = { away: 0, home: 0 };
          plays.forEach(function(p) {
            if (p.result && ["Single", "Double", "Triple", "Home Run"].indexOf(p.result.event) !== -1) {
              const half = (p.about.halfInning || "Top").toLowerCase();
              allHits[half === "top" ? "away" : "home"]++;
            }
          });
          if (allHits.away === 0 || allHits.home === 0) {
            sigPlay = " \xB7 No-hitter!";
          }
        } catch (e) {
        }
        const headline = winner + " beat " + loser + " " + ws + "-" + ls + playerHighlight + sigPlay;
        let videoTitle = null;
        try {
          const cr = await fetch(MLB_BASE + "/game/" + g.gamePk + "/content");
          if (cr.ok) {
            const cd = await cr.json();
            const items = cd.highlights && cd.highlights.highlights && cd.highlights.highlights.items || [];
            if (items.length && items[0].headline) videoTitle = items[0].headline;
          }
        } catch (e) {
        }
        result.push({ id: "yday_" + g.gamePk + "_result", icon: "\u2705", headline: videoTitle || headline, sub: videoTitle ? headline : (g.venue ? g.venue.name : "") + dur, gamePk: g.gamePk, ts: new Date(g.gameDate || Date.now()) });
      }
    } catch (e) {
    }
    return result;
  }
  async function loadYesterdayCache() {
    state.yesterdayCache = [];
    const dateStr = etDatePlus(etDateStr(), -1);
    state.yesterdayCache = await loadYdForDate(dateStr);
    state.yesterdayCache.forEach(function(item) {
      item.headline = "Yesterday: " + item.headline;
    });
    if (carouselCallbacks.updateFeedEmpty) carouselCallbacks.updateFeedEmpty();
  }
  async function loadLiveWPCache() {
    const livePks = Object.keys(state.gameStates).filter(function(pk) {
      const g = state.gameStates[pk];
      return g && g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    if (!livePks.length) {
      state.liveWPCache = {};
      state.liveWPLastFetch = Date.now();
      return;
    }
    await Promise.all(livePks.map(function(pk) {
      return fetch(MLB_BASE + "/game/" + pk + "/contextMetrics").then(function(r) {
        if (!r.ok) throw new Error(r.status);
        return r.json();
      }).then(function(d) {
        state.liveWPCache[pk] = { homeWP: d.homeWinProbability || 50, leverageIndex: d.leverageIndex || 1, ts: Date.now() };
      }).catch(function() {
      });
    }));
    Object.keys(state.liveWPCache).forEach(function(pk) {
      if (!state.gameStates[pk] || state.gameStates[pk].status !== "Live") delete state.liveWPCache[pk];
    });
    state.liveWPLastFetch = Date.now();
  }
  function genLiveWinProbStories() {
    const out = [];
    Object.keys(state.liveWPCache).forEach(function(pk) {
      const g = state.gameStates[pk];
      if (!g || g.status !== "Live" || (g.detailedState === "Warmup" || g.detailedState === "Pre-Game")) return;
      const c = state.liveWPCache[pk];
      const homeWP = c.homeWP;
      const favAbbr = homeWP >= 50 ? g.homeAbbr : g.awayAbbr;
      const dogAbbr = homeWP >= 50 ? g.awayAbbr : g.homeAbbr;
      const favWP = homeWP >= 50 ? homeWP : 100 - homeWP;
      const bucket = Math.round(homeWP / 10) * 10;
      const id = "livewp_" + pk + "_" + bucket;
      const halfArrow = g.halfInning === "top" ? "\u25B2" : "\u25BC";
      const headline = favAbbr + " " + Math.round(favWP) + "% to win vs " + dogAbbr;
      let sub = g.awayAbbr + " @ " + g.homeAbbr + " \xB7 " + halfArrow + ordinal(g.inning) + " \xB7 " + g.awayScore + "\u2013" + g.homeScore;
      out.push(makeStory(id, "contextual", 4, state.devTuning.livewp_priority || 30, "\u{1F4C8}", headline, sub, "live", +pk, /* @__PURE__ */ new Date(), 15 * 6e4, 0.4));
    });
    return out;
  }
  function genDailyIntro() {
    const todayStr = carouselCallbacks.localDateStr(carouselCallbacks.getEffectiveDate());
    const todayGames = Object.values(state.gameStates).filter(function(g) {
      return g.gameDateMs && carouselCallbacks.localDateStr(new Date(g.gameDateMs)) === todayStr;
    });
    if (!todayGames.length) return [];
    const liveCount = todayGames.filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    }).length;
    const finalCount = todayGames.filter(function(g) {
      return g.status === "Final";
    }).length;
    if (liveCount >= 2 || finalCount >= Math.ceil(todayGames.length / 2)) return [];
    let marquee = null;
    todayGames.forEach(function(g) {
      const raw = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
      if (!raw || !raw.teams) return;
      const aPP = raw.teams.away && raw.teams.away.probablePitcher;
      const hPP = raw.teams.home && raw.teams.home.probablePitcher;
      if (!aPP || !hPP) return;
      const aS = state.probablePitcherStatsCache[aPP.id] || {}, hS = state.probablePitcherStatsCache[hPP.id] || {};
      const aW = aS.wins || 0, aL = aS.losses || 0, hW = hS.wins || 0, hL = hS.losses || 0;
      if (aW <= aL || hW <= hL) return;
      const aboveZero = aW - aL + (hW - hL);
      if (!marquee || aboveZero > marquee.score) {
        marquee = { away: aPP.fullName, home: hPP.fullName, awayAbbr: g.awayAbbr, homeAbbr: g.homeAbbr, score: aboveZero, gamePk: g.gamePk };
      }
    });
    let n = todayGames.length, headline, sub, gamePk = null;
    if (marquee && marquee.score >= 6) {
      headline = marquee.away.split(" ").pop() + " vs " + marquee.home.split(" ").pop() + " is the matchup tonight.";
      sub = n + " games \xB7 " + marquee.awayAbbr + " @ " + marquee.homeAbbr + " headlines";
      gamePk = marquee.gamePk;
    } else {
      headline = n + " games on the slate. Pulse is on.";
      sub = "Live play-by-play across every game";
    }
    return [makeStory("dailyintro_" + todayStr, "editorial", 4, 50, "\u{1F4F0}", headline, sub, "today", gamePk, /* @__PURE__ */ new Date(), 4 * 60 * 6e4, 0.4)];
  }

  // src/radio/stations.js
  var MLB_TEAM_RADIO = {
    108: { name: "KLAA Angels Radio", url: "https://klaa.streamguys1.com/live", format: "direct" },
    109: { name: "KTAR 620 AM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KTARAMAAC.aac", format: "direct" },
    110: { name: "WBAL 1090 AM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WBALAMAAC.aac", format: "direct" },
    111: { name: "WEEI 850 AM", url: "https://live.amperwave.net/manifest/audacy-weeifmaac-hlsc.m3u8", format: "hls" },
    112: { name: "WSCR 670 The Score", url: "https://live.amperwave.net/manifest/audacy-wscramaac-hlsc.m3u8", format: "hls" },
    113: { name: "700 WLW", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WLWAMAAC.aac", format: "direct" },
    114: { name: "WTAM 1100 AM", url: "https://stream.revma.ihrhls.com/zc1749/hls.m3u8", format: "hls" },
    115: { name: "KOA 850 / 94.1", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KOAAMAAC.aac", format: "direct" },
    116: { name: "WXYT 97.1 The Ticket", url: "https://live.amperwave.net/manifest/audacy-wxytfmaac-hlsc.m3u8", format: "hls" },
    117: { name: "SportsTalk 790 AM", url: "https://stream.revma.ihrhls.com/zc2257", format: "direct" },
    118: { name: "96.5 The Fan KFNZ", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KFNZFMAAC.aac", format: "direct" },
    119: { name: "KLAC AM 570 LA Sports", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KLACAMAAC.aac", format: "direct" },
    120: { name: "WJFK The Fan 106.7", url: "https://live.amperwave.net/manifest/audacy-wjfkfmaac-hlsc.m3u8", format: "hls" },
    121: { name: "WCBS 880 AM", url: "https://live.amperwave.net/manifest/audacy-wcbsamaac-hlsc.m3u8", format: "hls" },
    133: { name: "KSTE 650 AM Sacramento", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KSTEAMAAC.aac", format: "direct" },
    134: { name: "KDKA-FM 93.7 The Fan", url: "https://live.amperwave.net/manifest/audacy-kdkafmaac-hlsc.m3u8", format: "hls" },
    135: { name: "KWFN 97.3 The Fan", url: "https://live.amperwave.net/manifest/audacy-kwfnfmaac-llhlsc.m3u8", format: "hls" },
    136: { name: "Seattle Sports 710 AM", url: "https://bonneville.cdnstream1.com/2642_48.aac", format: "direct" },
    137: { name: "KNBR 104.5 / 680", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/KNBRAMAAC.aac", format: "direct" },
    138: { name: "KMOX NewsRadio 1120", url: "https://live.amperwave.net/manifest/audacy-kmoxamaac-llhlsc.m3u8", format: "hls" },
    139: { name: "WDAE 95.3 FM / 620 AM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WDAEAMAAC.aac", format: "direct" },
    140: { name: "105.3 The Fan KRLD", url: "https://live.amperwave.net/manifest/audacy-krldfmaac-hlsc.m3u8", format: "hls" },
    141: { name: "CJCL Sportsnet 590", url: "https://rogers-hls.leanstream.co/rogers/tor590.stream/playlist.m3u8", format: "hls" },
    142: { name: "WCCO News Talk 830", url: "https://live.amperwave.net/manifest/audacy-wccoamaac-llhlsc.m3u8", format: "hls" },
    143: { name: "94 WIP Sportsradio", url: "https://live.amperwave.net/manifest/audacy-wipfmaac-hlsc.m3u8", format: "hls" },
    144: { name: "680 The Fan / 93.7 FM", url: "https://stream.zeno.fm/q9458433dm8uv", format: "direct" },
    145: { name: "WMVP ESPN 1000 AM", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WMVPAMAAC.aac", format: "direct" },
    146: { name: "WQAM 560 AM", url: "https://live.amperwave.net/manifest/audacy-wqamamaac-hlsc.m3u8", format: "hls" },
    147: { name: "WFAN 66 / 101.9", url: "https://live.amperwave.net/manifest/audacy-wfanamaac-hlsc.m3u8", format: "hls" },
    158: { name: "WTMJ Newsradio 620", url: "https://playerservices.streamtheworld.com/api/livestream-redirect/WTMJAMAAC.aac", format: "direct" }
  };
  var FALLBACK_RADIO = { name: "Fox Sports Radio", url: "https://ais-sa1.streamon.fm/7852_128k.aac", format: "direct" };
  var APPROVED_RADIO_TEAM_IDS = /* @__PURE__ */ new Set([108, 114, 116, 117, 137, 140, 142, 144, 146, 147]);
  var RADIO_CHECK_DEFAULT_NOTES = {
    "108": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "109": "URL updated v3.34.1 \u2014 not yet confirmed",
    "110": "URL updated v3.34.1 \u2014 not yet confirmed",
    "112": "Not yet confirmed \u2014 needs Radio Check sweep",
    "113": "URL updated v3.34.1 \u2014 not yet confirmed",
    "114": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "115": "URL updated v3.34.1 \u2014 not yet confirmed",
    "116": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "117": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "118": "URL updated v3.34.1 \u2014 not yet confirmed",
    "119": "URL updated v3.34.1 \u2014 not yet confirmed",
    "121": "URL updated v3.34.1 \u2014 not yet confirmed",
    "133": "URL updated v3.34.1 \u2014 not yet confirmed",
    "137": "Confirmed working \u2014 live game audio (verified 2026-05-06)",
    "139": "URL updated v3.34.1 \u2014 not yet confirmed",
    "140": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "142": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "144": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "145": "URL updated v3.34.1 \u2014 not yet confirmed",
    "146": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "147": "Confirmed working \u2014 live game audio (verified 2026-05-02)",
    "158": "URL updated v3.34.1 \u2014 not yet confirmed"
  };

  // src/radio/classic.js
  var POC_POOL = [
    "https://archive.org/download/classicmlbbaseballradio/1969%2010%2016%20New%20York%20Mets%20vs%20Baltimore%20Orioles%20World%20Series%20Game%205.mp3",
    "https://archive.org/download/classicmlbbaseballradio/1970%2004%2022%20Padres%20vs%20New%20York%20Mets%20Seaver%2019ks%20Complete%20Broadcast%20Bob%20Murphy.mp3",
    "https://archive.org/download/classicmlbbaseballradio/19570805GiantsAtDodgersvinScullyRadioBroadcast.mp3",
    "https://archive.org/download/classicmlbbaseballradio/1968%2009%2028%20Yankees%20vs%20Red%20Sox%20Mantles%20FINAL%20Game%20Messer%20Coleman%20Rizzuto%20Radio%20Broadcast.mp3"
  ];
  var _audio = null;
  var _active = false;
  var _lastRolledUrl = null;
  function ensureAudio() {
    if (_audio) return _audio;
    _audio = document.createElement("audio");
    _audio.id = "classicRadioAudio";
    _audio.preload = "none";
    _audio.volume = 0.4;
    document.body.appendChild(_audio);
    _audio.addEventListener("error", function() {
      console.warn("classic radio: audio element error", _audio.error);
    });
    return _audio;
  }
  function pickRandomUrl() {
    return POC_POOL[Math.floor(Math.random() * POC_POOL.length)];
  }
  function pickOffset(dur) {
    const minS = 30 * 60;
    let maxS = 90 * 60;
    if (dur && dur < maxS + 60) maxS = Math.max(minS, dur - 60);
    if (maxS <= minS) return minS;
    return minS + Math.random() * (maxS - minS);
  }
  function _playUrl(url) {
    if (!url) return;
    const a = ensureAudio();
    const label = _broadcastLabel(url);
    if (a.src && a.src.indexOf(url) !== -1 && a.readyState >= 2 && a.duration) {
      a.currentTime = pickOffset(a.duration);
      a.play().then(function() {
        try {
          setRadioUI(true, { abbr: "CLASSIC", name: label });
        } catch (e) {
        }
      }).catch(function(e) {
        console.warn("classic radio: play blocked", e);
      });
      return;
    }
    if (url === _lastRolledUrl && !a.paused && a.readyState >= 2) {
      if (a.duration > 0) a.currentTime = pickOffset(a.duration);
      return;
    }
    _lastRolledUrl = url;
    a.pause();
    a.src = url;
    a.load();
    try {
      setRadioUI(true, { abbr: "CLASSIC", name: label + " (loading\u2026)" });
    } catch (e) {
    }
    const onMeta = function() {
      a.removeEventListener("loadedmetadata", onMeta);
      const dur = a.duration || 0;
      if (dur > 60) a.currentTime = pickOffset(dur);
      a.play().then(function() {
        try {
          setRadioUI(true, { abbr: "CLASSIC", name: label });
        } catch (e) {
        }
      }).catch(function(e) {
        console.warn("classic radio: play blocked", e);
      });
    };
    a.addEventListener("loadedmetadata", onMeta);
  }
  function _broadcastLabel(url) {
    try {
      const name = decodeURIComponent(url.split("/").pop().replace(/\.mp3$/i, ""));
      return name.length > 60 ? name.slice(0, 57) + "\u2026" : name;
    } catch (e) {
      return url;
    }
  }
  function playClassicRandom() {
    _active = true;
    try {
      stopRadio();
    } catch (e) {
    }
    const url = pickRandomUrl();
    console.log("[classic radio] play:", _broadcastLabel(url));
    _playUrl(url);
  }
  function pauseClassic() {
    _active = false;
    if (_audio) _audio.pause();
    try {
      setRadioUI(false, null);
    } catch (e) {
    }
  }
  function stopClassic() {
    _active = false;
    _lastRolledUrl = null;
    if (!_audio) return;
    _audio.pause();
    _audio.removeAttribute("src");
    _audio.load();
    try {
      setRadioUI(false, null);
    } catch (e) {
    }
  }
  function isClassicActive() {
    return _active;
  }
  function rollClassicOnSwitch() {
    if (!_active) return;
    try {
      stopRadio();
    } catch (e) {
    }
    const url = pickRandomUrl();
    console.log("[classic radio] roll on focus switch:", _broadcastLabel(url));
    _playUrl(url);
  }
  function devTestClassicRadio() {
    if (_active) {
      pauseClassic();
    } else {
      playClassicRandom();
    }
  }
  function playArchiveUrl(url) {
    if (!url) return;
    _active = true;
    try {
      stopRadio();
    } catch (e) {
    }
    console.log("[classic radio] play archive:", _broadcastLabel(url));
    _playUrl(url);
  }

  // src/radio/engine.js
  var radioAudio = null;
  var radioHls = null;
  var radioCurrentTeamId = null;
  function pickRadioForFocus() {
    if (state.focusGamePk && state.gameStates[state.focusGamePk]) {
      const g = state.gameStates[state.focusGamePk];
      if (MLB_TEAM_RADIO[g.homeId] && APPROVED_RADIO_TEAM_IDS.has(g.homeId))
        return Object.assign({ teamId: g.homeId, abbr: g.homeAbbr }, MLB_TEAM_RADIO[g.homeId]);
      if (MLB_TEAM_RADIO[g.awayId] && APPROVED_RADIO_TEAM_IDS.has(g.awayId))
        return Object.assign({ teamId: g.awayId, abbr: g.awayAbbr }, MLB_TEAM_RADIO[g.awayId]);
    }
    return Object.assign({ teamId: null, abbr: "" }, FALLBACK_RADIO);
  }
  function stopAllMedia(except) {
    if (except !== "radio" && radioAudio && !radioAudio.paused) {
      stopRadio();
    }
    if (except !== "youtube") {
      const yt = document.getElementById("homeYoutubePlayer");
      if (yt && yt.contentWindow) {
        try {
          yt.contentWindow.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: "" }), "*");
        } catch (e) {
        }
      }
    }
    if (except !== "podcast") {
      if (typeof window !== "undefined" && window.stopPodcast) window.stopPodcast();
    }
    if (except !== "highlight") {
      document.querySelectorAll("video").forEach(function(v) {
        if (!v.paused) v.pause();
      });
    }
  }
  function toggleRadio() {
    if (state.demoMode) {
      devTestClassicRadio();
      return;
    }
    if (radioAudio && !radioAudio.paused) {
      stopRadio();
    } else {
      startRadio();
    }
  }
  function startRadio() {
    devTrace("radio", "startRadio");
    stopAllMedia("radio");
    loadRadioStream(pickRadioForFocus());
  }
  function loadRadioStream(pick) {
    if (radioHls) {
      try {
        radioHls.destroy();
      } catch (e) {
      }
      radioHls = null;
    }
    if (!radioAudio) {
      radioAudio = new Audio();
      radioAudio.preload = "none";
    }
    radioAudio.pause();
    radioCurrentTeamId = pick.teamId;
    const isHls = pick.format === "hls";
    const nativeHls = radioAudio.canPlayType("application/vnd.apple.mpegurl");
    if (isHls && window.Hls && Hls.isSupported()) {
      radioHls = new Hls();
      radioHls.loadSource(pick.url);
      radioHls.attachMedia(radioAudio);
      radioHls.on(Hls.Events.ERROR, function(_, d) {
        if (d.fatal) {
          console.error("HLS fatal:", d);
          handleRadioError(new Error(d.details || "HLS error"));
        }
      });
      radioAudio.play().then(function() {
        setRadioUI(true, pick);
      }).catch(handleRadioError);
    } else if (isHls && nativeHls) {
      radioAudio.src = pick.url;
      radioAudio.play().then(function() {
        setRadioUI(true, pick);
      }).catch(handleRadioError);
    } else {
      radioAudio.src = pick.url;
      radioAudio.play().then(function() {
        setRadioUI(true, pick);
      }).catch(handleRadioError);
    }
  }
  function stopRadio() {
    devTrace("radio", "stopRadio \xB7 was teamId=" + radioCurrentTeamId);
    if (radioAudio) {
      radioAudio.pause();
    }
    if (radioHls) {
      try {
        radioHls.destroy();
      } catch (e) {
      }
      radioHls = null;
    }
    radioCurrentTeamId = null;
    setRadioUI(false, null);
  }
  function handleRadioError(err) {
    console.error("Radio play failed:", err);
    alert("Radio failed: " + (err && err.message ? err.message : "unknown"));
    setRadioUI(false, null);
  }
  function setRadioUI(on, pick) {
    const t = document.getElementById("radioToggle"), k = document.getElementById("radioToggleKnob"), s = document.getElementById("radioStatusText");
    if (t) {
      t.setAttribute("aria-checked", on ? "true" : "false");
      if (on) {
        t.style.background = "#22c55e";
        k.style.left = "21px";
        let label = pick && pick.name ? pick.name : "Radio";
        if (pick && pick.abbr) label = pick.abbr + " \xB7 " + label;
        s.textContent = "Playing \xB7 " + label;
      } else {
        t.style.background = "var(--border)";
        k.style.left = "3px";
        s.textContent = "Off \xB7 Auto-pairs to focus game";
      }
    }
    const ptbDot = document.getElementById("ptbRadioDot");
    if (ptbDot) ptbDot.style.display = on ? "inline-block" : "none";
  }
  function updateRadioForFocus() {
    if (!radioAudio || radioAudio.paused) return;
    const pick = pickRadioForFocus();
    if (pick.teamId !== radioCurrentTeamId) loadRadioStream(pick);
  }
  function getCurrentTeamId() {
    return radioCurrentTeamId;
  }
  function getRadioAudio() {
    return radioAudio;
  }

  // src/focus/mode.js
  function calcFocusScore(g) {
    if (g.status !== "Live" || (g.detailedState === "Warmup" || g.detailedState === "Pre-Game")) return 0;
    const diff = Math.abs(g.awayScore - g.homeScore);
    const runners = (g.onFirst ? 1 : 0) + (g.onSecond ? 1 : 0) + (g.onThird ? 1 : 0);
    const battingScore = g.halfInning === "top" ? g.awayScore : g.homeScore;
    const fieldingScore = g.halfInning === "top" ? g.homeScore : g.awayScore;
    const deficit = Math.max(0, fieldingScore - battingScore);
    const effectiveDiff = runners > 0 && deficit > 0 ? Math.max(0, deficit - runners) : diff;
    const closeness = effectiveDiff === 0 ? 60 : effectiveDiff === 1 ? 45 : effectiveDiff === 2 ? 28 : effectiveDiff === 3 ? 20 : effectiveDiff === 4 ? 8 : 3;
    const isBL = g.onFirst && g.onSecond && g.onThird;
    const isWalkoff = g.halfInning === "bottom" && g.inning >= 9 && g.awayScore - g.homeScore <= runners + 1 && g.awayScore >= g.homeScore;
    const isNoHit = g.inning >= 6 && (g.awayHits === 0 || g.homeHits === 0);
    let situation = isBL ? 40 : g.onThird && (g.onSecond || g.onFirst) ? 35 : g.onThird ? 28 : g.onSecond && g.onFirst ? 22 : g.onSecond ? 20 : runners > 0 ? 12 : 0;
    if (isWalkoff) situation += 50;
    if (isNoHit) situation += Math.min((g.inning - 4) * 18, 120);
    if (g.inning >= 6 && diff <= 2 && runners === 0) situation += Math.min((g.inning - 5) * 6, 24);
    let countBonus = 0;
    if (g.gamePk === state.focusGamePk) {
      if (state.focusState.balls === 3 && state.focusState.strikes === 2) countBonus = 20;
      else if (state.focusState.strikes === 2) countBonus = 12;
      if (state.focusState.outs === 2) countBonus += 8;
    }
    let innMult = g.inning <= 3 ? 0.5 : g.inning <= 5 ? 0.75 : g.inning <= 8 ? 1 : g.inning === 9 ? 1.5 : 1.8;
    if (g.inning >= 9 && diff > runners + 2 && !isNoHit) innMult = Math.min(innMult, 1);
    return (closeness + situation + countBonus) * innMult;
  }
  function getTensionInfo(score) {
    if (score >= state.devTuning.focus_critical) return { label: "CRITICAL", color: "#e03030" };
    if (score >= state.devTuning.focus_high) return { label: "HIGH", color: "#f59e0b" };
    return { label: "NORMAL", color: "#9aa0a8" };
  }
  function selectFocusGame() {
    if (state.demoMode) {
      if (state.focusIsManual) return;
      const ft = state.focusTrack || [];
      if (ft.length) {
        const nowMs = state.demoCurrentTime || 0;
        let entry = null;
        for (let ti = ft.length - 1; ti >= 0; ti--) {
          if (ft[ti].ts <= nowMs) {
            entry = ft[ti];
            break;
          }
        }
        if (!entry) entry = ft[0];
        if (entry && !entry.focusGamePk) {
          for (let fi = 0; fi < ft.length; fi++) {
            if (ft[fi].focusGamePk) {
              entry = ft[fi];
              break;
            }
          }
        }
        if (entry && entry.focusGamePk && state.focusGamePk !== entry.focusGamePk) {
          setFocusGame(entry.focusGamePk);
        }
        return;
      }
    }
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    if (!liveGames.length) return;
    const scored = liveGames.map(function(g) {
      return { g, score: calcFocusScore(g) };
    });
    scored.sort(function(a, b) {
      return b.score - a.score;
    });
    const best = scored[0];
    if (!state.focusGamePk || !state.gameStates[state.focusGamePk] || state.gameStates[state.focusGamePk].status !== "Live") {
      state.focusIsManual = false;
      setFocusGame(best.g.gamePk);
      return;
    }
    if (best.g.gamePk !== state.focusGamePk && best.score - calcFocusScore(state.gameStates[state.focusGamePk]) >= state.devTuning.focus_switch_margin) {
      const now = Date.now();
      if (!state.focusAlertShown[best.g.gamePk] || now - state.focusAlertShown[best.g.gamePk] > state.devTuning.focus_alert_cooldown) {
        state.focusAlertShown[best.g.gamePk] = now;
        const tension = getTensionInfo(best.score);
        showFocusAlert(best.g.gamePk, tension.label + " \xB7 " + best.g.awayAbbr + " @ " + best.g.homeAbbr);
      }
    }
  }
  function setFocusGame(pk) {
    if (!pk) return;
    const changed = state.focusGamePk !== pk;
    state.focusGamePk = pk;
    if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
      window.Recorder._captureFocusTrack();
    }
    if (changed) rollClassicOnSwitch();
    state.focusPitchSequence = [];
    state.focusCurrentAbIdx = null;
    state.focusLastTimecode = null;
    state.focusState.batterStats = null;
    state.focusState.pitcherStats = null;
    dismissFocusAlert();
    if (state.focusFastTimer) {
      clearInterval(state.focusFastTimer);
      state.focusFastTimer = null;
    }
    if (state.focusAbortCtrl) {
      state.focusAbortCtrl.abort();
      state.focusAbortCtrl = null;
    }
    if (state.focusOverlayOpen) renderFocusOverlay();
    if (!isClassicActive()) updateRadioForFocus();
    pollFocusLinescore();
    state.focusFastTimer = setInterval(pollFocusLinescore, TIMING.FOCUS_POLL_MS);
  }
  function setFocusGameManual(pk) {
    devTrace("focus", "manual pick \xB7 gamePk=" + pk);
    state.focusIsManual = true;
    setFocusGame(pk);
  }
  function resetFocusAuto() {
    state.focusIsManual = false;
    const live = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    if (!live.length) return;
    const scored = live.map(function(g) {
      return { g, score: calcFocusScore(g) };
    });
    scored.sort(function(a, b) {
      return b.score - a.score;
    });
    setFocusGame(scored[0].g.gamePk);
  }
  function hydrateFocusFromDemo() {
    const pk = state.focusGamePk;
    if (!pk) return;
    const g = state.gameStates[pk] || {};
    const timeline = state.pitchTimeline[pk] || [];
    const nowMs = state.demoCurrentTime || 0;
    let envelope = null;
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].ts <= nowMs) {
        envelope = timeline[i];
        break;
      }
    }
    if (!envelope && timeline.length) {
      const queueLen = state.demoPlayQueue && state.demoPlayQueue.length || 1;
      const idx = state.demoPlayIdx || 0;
      const fraction = Math.max(0, Math.min(1, idx / queueLen));
      const progressIdx = Math.min(timeline.length - 1, Math.floor(fraction * timeline.length));
      envelope = timeline[progressIdx];
    }
    const tension = getTensionInfo(calcFocusScore(g));
    if (!envelope) {
      state.focusState = {
        balls: 0,
        strikes: 0,
        outs: g.outs || 0,
        inning: g.inning || 1,
        halfInning: g.halfInning || "top",
        currentBatterId: null,
        currentBatterName: "",
        currentPitcherId: null,
        currentPitcherName: "",
        onFirst: !!g.onFirst,
        onSecond: !!g.onSecond,
        onThird: !!g.onThird,
        awayAbbr: g.awayAbbr || "",
        homeAbbr: g.homeAbbr || "",
        awayScore: g.awayScore || 0,
        homeScore: g.homeScore || 0,
        awayPrimary: g.awayPrimary || "#444",
        homePrimary: g.homePrimary || "#444",
        tensionLabel: tension.label,
        tensionColor: tension.color,
        lastPitch: null,
        batterStats: null,
        pitcherStats: null
      };
      state.focusPitchSequence = [];
      state.focusCurrentAbIdx = null;
      return;
    }
    state.focusCurrentAbIdx = envelope.atBatIndex;
    const revealedPitches = (envelope.pitches || []).filter(function(p) {
      return p.eventTs == null || p.eventTs <= nowMs;
    });
    state.focusPitchSequence = revealedPitches.map(function(p) {
      return {
        typeCode: p.typeCode,
        typeName: p.typeName,
        speed: p.speed,
        resultCode: p.resultCode,
        resultDesc: p.resultDesc,
        sequenceIndex: p.sequenceIndex
      };
    });
    const lastPitch = state.focusPitchSequence.length ? state.focusPitchSequence[state.focusPitchSequence.length - 1] : null;
    const lastRaw = revealedPitches.length ? revealedPitches[revealedPitches.length - 1] : null;
    const displayBalls = lastRaw && lastRaw.ballsAfter != null ? lastRaw.ballsAfter : envelope.balls || 0;
    const displayStrikes = lastRaw && lastRaw.strikesAfter != null ? lastRaw.strikesAfter : envelope.strikes || 0;
    const displayOuts = lastRaw && lastRaw.outsAfter != null ? lastRaw.outsAfter : envelope.outs || 0;
    state.focusState = {
      balls: displayBalls,
      strikes: displayStrikes,
      outs: displayOuts,
      inning: envelope.inning || g.inning || 1,
      halfInning: envelope.halfInning || g.halfInning || "top",
      currentBatterId: envelope.batterId || null,
      currentBatterName: envelope.batterName || "",
      currentPitcherId: envelope.pitcherId || null,
      currentPitcherName: envelope.pitcherName || "",
      onFirst: !!envelope.onFirst,
      onSecond: !!envelope.onSecond,
      onThird: !!envelope.onThird,
      awayAbbr: g.awayAbbr || "",
      homeAbbr: g.homeAbbr || "",
      awayScore: envelope.awayScore != null ? envelope.awayScore : g.awayScore || 0,
      homeScore: envelope.homeScore != null ? envelope.homeScore : g.homeScore || 0,
      awayPrimary: g.awayPrimary || "#444",
      homePrimary: g.homePrimary || "#444",
      tensionLabel: tension.label,
      tensionColor: tension.color,
      lastPitch,
      batterStats: state.focusStatsCache[envelope.batterId] || null,
      pitcherStats: state.focusStatsCache[envelope.pitcherId] || null
    };
  }
  async function pollFocusLinescore() {
    if (!state.focusGamePk) return;
    if (state.demoMode) {
      hydrateFocusFromDemo();
      renderFocusCard();
      renderFocusMiniBar();
      if (state.focusOverlayOpen) renderFocusOverlay();
      return;
    }
    if (state.focusAbortCtrl) {
      state.focusAbortCtrl.abort();
    }
    state.focusAbortCtrl = new AbortController();
    const focusSig = state.focusAbortCtrl.signal;
    try {
      const r = await fetch(MLB_BASE + "/game/" + state.focusGamePk + "/linescore", { signal: focusSig });
      if (!r.ok) throw new Error(r.status);
      const ls = await r.json();
      const g = state.gameStates[state.focusGamePk] || {};
      const tension = getTensionInfo(calcFocusScore(g));
      state.focusState = {
        balls: ls.balls || 0,
        strikes: ls.strikes || 0,
        outs: ls.outs || 0,
        inning: ls.currentInning || g.inning || 1,
        halfInning: ls.isTopInning === false ? "bottom" : "top",
        currentBatterId: ls.offense && ls.offense.batter && ls.offense.batter.id || null,
        currentBatterName: ls.offense && ls.offense.batter && ls.offense.batter.fullName || state.focusState.currentBatterName || "",
        currentPitcherId: ls.defense && ls.defense.pitcher && ls.defense.pitcher.id || null,
        currentPitcherName: ls.defense && ls.defense.pitcher && ls.defense.pitcher.fullName || state.focusState.currentPitcherName || "",
        onFirst: !!(ls.offense && ls.offense.first),
        onSecond: !!(ls.offense && ls.offense.second),
        onThird: !!(ls.offense && ls.offense.third),
        awayAbbr: g.awayAbbr || "",
        homeAbbr: g.homeAbbr || "",
        awayScore: g.awayScore || 0,
        homeScore: g.homeScore || 0,
        awayPrimary: g.awayPrimary || "#444",
        homePrimary: g.homePrimary || "#444",
        tensionLabel: tension.label,
        tensionColor: tension.color,
        lastPitch: state.focusPitchSequence.length ? state.focusPitchSequence[state.focusPitchSequence.length - 1] : null,
        batterStats: state.focusStatsCache[ls.offense && ls.offense.batter && ls.offense.batter.id] || null,
        pitcherStats: state.focusStatsCache[ls.defense && ls.defense.pitcher && ls.defense.pitcher.id] || null
      };
      fetchFocusPlayerStats(state.focusState.currentBatterId, state.focusState.currentPitcherId);
      renderFocusCard();
      renderFocusMiniBar();
      if (state.focusOverlayOpen) renderFocusOverlay();
      pollFocusRich(focusSig);
    } catch (e) {
      if (e.name !== "AbortError") console.error("pollFocusLinescore error", e);
    }
  }
  async function fetchFocusPlayerStats(batterId, pitcherId) {
    if (state.demoMode) return;
    let changed = false;
    if (batterId && !state.focusStatsCache[batterId]) {
      try {
        const r = await fetch(MLB_BASE + "/people/" + batterId + "/stats?stats=season&group=hitting&season=" + SEASON);
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        const s = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat || {};
        state.focusStatsCache[batterId] = { avg: s.avg || "\u2014", obp: s.obp || "\u2014", ops: s.ops || "\u2014", hr: s.homeRuns != null ? s.homeRuns : "\u2014", rbi: s.rbi != null ? s.rbi : "\u2014" };
        if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
          window.Recorder._captureFocusStat(batterId, "hitting", state.focusStatsCache[batterId]);
        }
        changed = true;
      } catch (e) {
      }
    }
    if (pitcherId && !state.focusStatsCache[pitcherId]) {
      try {
        const r2 = await fetch(MLB_BASE + "/people/" + pitcherId + "/stats?stats=season&group=pitching&season=" + SEASON);
        if (!r2.ok) throw new Error(r2.status);
        const d2 = await r2.json();
        const s2 = d2.stats && d2.stats[0] && d2.stats[0].splits && d2.stats[0].splits[0] && d2.stats[0].splits[0].stat || {};
        state.focusStatsCache[pitcherId] = { era: s2.era || "\u2014", whip: s2.whip || "\u2014", wins: s2.wins != null ? s2.wins : "\u2014", losses: s2.losses != null ? s2.losses : "\u2014" };
        if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
          window.Recorder._captureFocusStat(pitcherId, "pitching", state.focusStatsCache[pitcherId]);
        }
        changed = true;
      } catch (e) {
      }
    }
    if (!changed) return;
    if (batterId && state.focusStatsCache[batterId]) state.focusState.batterStats = state.focusStatsCache[batterId];
    if (pitcherId && state.focusStatsCache[pitcherId]) state.focusState.pitcherStats = state.focusStatsCache[pitcherId];
    if (state.focusOverlayOpen) renderFocusOverlay();
  }
  async function pollFocusRich(sig) {
    if (!state.focusGamePk || state.demoMode) return;
    try {
      let data;
      if (!state.focusLastTimecode) {
        const r = await fetch(MLB_BASE_V1_1 + "/game/" + state.focusGamePk + "/feed/live", sig ? { signal: sig } : {});
        if (!r.ok) throw new Error(r.status);
        data = await r.json();
        const tsList = data && data.metaData && data.metaData.timeStamp;
        if (tsList) state.focusLastTimecode = tsList;
      } else {
        const tsResp = await fetch(MLB_BASE_V1_1 + "/game/" + state.focusGamePk + "/feed/live/timestamps", sig ? { signal: sig } : {});
        if (!tsResp.ok) throw new Error(tsResp.status);
        const tsArr = await tsResp.json();
        const latest = Array.isArray(tsArr) && tsArr.length ? tsArr[tsArr.length - 1] : null;
        if (!latest || latest === state.focusLastTimecode) return;
        const dResp = await fetch(MLB_BASE_V1_1 + "/game/" + state.focusGamePk + "/feed/live/diffPatch?startTimecode=" + encodeURIComponent(state.focusLastTimecode) + "&endTimecode=" + encodeURIComponent(latest), sig ? { signal: sig } : {});
        if (!dResp.ok) throw new Error(dResp.status);
        const patch = await dResp.json();
        state.focusLastTimecode = latest;
        data = patch;
      }
      const cp = data && data.liveData && data.liveData.plays && data.liveData.plays.currentPlay;
      if (!cp) return;
      const abIdx = cp.about && cp.about.atBatIndex;
      if (state.focusCurrentAbIdx !== null && state.focusCurrentAbIdx !== abIdx) state.focusPitchSequence = [];
      state.focusCurrentAbIdx = abIdx;
      const pitchEvents = (cp.playEvents || []).filter(function(e) {
        return e.isPitch || e.type === "pitch";
      });
      state.focusPitchSequence = pitchEvents.map(function(e) {
        return {
          typeCode: e.details && e.details.type && e.details.type.code || "??",
          typeName: e.details && e.details.type && e.details.type.description || "",
          speed: e.pitchData && e.pitchData.startSpeed || null,
          resultCode: e.details && e.details.code || "",
          resultDesc: e.details && e.details.description || "",
          sequenceIndex: e.pitchNumber || 0
        };
      });
      if (state.focusPitchSequence.length) state.focusState.lastPitch = state.focusPitchSequence[state.focusPitchSequence.length - 1];
      if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
        window.Recorder._captureFocusPitches(cp, state.focusGamePk);
      }
      renderFocusCard();
      if (state.focusOverlayOpen) renderFocusOverlay();
    } catch (e) {
      if (e.name !== "AbortError") console.error("pollFocusRich error", e);
    }
  }
  function renderFocusCard() {
    const el = document.getElementById("focusCard");
    if (!el) return;
    if (!state.focusGamePk || !state.focusState.awayAbbr && !state.demoMode) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const cardData = Object.assign({}, state.focusState, {
      isManual: state.focusIsManual,
      gamePk: state.focusGamePk,
      allLiveGames: liveGames.map(function(g) {
        return {
          gamePk: g.gamePk,
          awayAbbr: g.awayAbbr,
          homeAbbr: g.homeAbbr,
          awayPrimary: g.awayPrimary,
          homePrimary: g.homePrimary,
          inning: g.inning,
          isFocused: g.gamePk === state.focusGamePk
        };
      })
    });
    el.innerHTML = window.FocusCard.renderCard(cardData);
  }
  function renderFocusMiniBar() {
    const el = document.getElementById("focusMiniBar");
    if (!el) return;
    if (!state.focusGamePk || !state.focusState.awayAbbr) {
      el.style.display = "none";
      return;
    }
    const half = state.focusState.halfInning === "bottom" ? "\u25BC" : "\u25B2";
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const showStrip = liveGames.length > 1 || state.focusIsManual;
    let stripHtml = "";
    if (showStrip) {
      stripHtml = '<div style="display:flex;align-items:center;gap:5px;padding:3px 10px 4px;background:var(--p-dark,#080e1c);border-bottom:1px solid var(--p-border,#1e2d4a);overflow-x:auto;-webkit-overflow-scrolling:touch;">';
      if (state.focusIsManual) {
        stripHtml += '<button onclick="resetFocusAuto()" style="flex:0 0 auto;padding:2px 7px;border-radius:4px;border:1px solid rgba(34,197,94,.35);background:rgba(34,197,94,.08);font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#22c55e;cursor:pointer">\u21A9 AUTO</button>';
      }
      liveGames.forEach(function(g) {
        const focused = g.gamePk === state.focusGamePk;
        stripHtml += "<button" + (focused ? "" : ' onclick="setFocusGameManual(' + g.gamePk + ')"') + ' style="flex:0 0 auto;display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;border:' + (focused ? "1.5px solid var(--p-accent,#3a4d75)" : "1px solid var(--p-border,#1e2d4a)") + ";background:transparent;cursor:" + (focused ? "default" : "pointer") + '"><span style="width:4px;height:4px;border-radius:50%;background:' + (g.awayPrimary || "#3a4d75") + ';flex:0 0 auto"></span><span style="font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;color:' + (focused ? "var(--p-text,#e8eaf0)" : "var(--p-muted,#9aa0a8)") + '">' + g.awayAbbr + '<span style="color:var(--p-border,#3a4d75);margin:0 2px">@</span>' + g.homeAbbr + '</span><span style="width:4px;height:4px;border-radius:50%;background:' + (g.homePrimary || "#3a4d75") + ';flex:0 0 auto"></span></button>';
      });
      stripHtml += "</div>";
    }
    el.style.display = "";
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--p-dark,#0c1426);border-bottom:1px solid var(--p-border,#1e2d4a);font-size:.75rem"><span style="font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-text,#e8eaf0);letter-spacing:.06em">' + state.focusState.awayAbbr + " <strong>" + state.focusState.awayScore + "</strong> \u2013 <strong>" + state.focusState.homeScore + "</strong> " + state.focusState.homeAbbr + '</span><span style="font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--p-muted,#9aa0a8)">' + half + state.focusState.inning + " \xB7 " + state.focusState.balls + "-" + state.focusState.strikes + " \xB7 " + state.focusState.outs + ' out</span><button onclick="openFocusOverlay()" style="padding:3px 8px;background:var(--p-dark,#0a0f1e);border:1px solid var(--p-border,#1e2d4a);border-radius:4px;color:var(--p-text,#e8eaf0);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;cursor:pointer">FOCUS \u2192</button></div>' + stripHtml;
  }
  function openFocusOverlay() {
    const el = document.getElementById("focusOverlay");
    if (!el || !state.focusGamePk) return;
    state.focusOverlayOpen = true;
    el.style.display = "flex";
    renderFocusOverlay();
  }
  function closeFocusOverlay() {
    const el = document.getElementById("focusOverlay");
    if (!el) return;
    state.focusOverlayOpen = false;
    el.style.display = "none";
  }
  function renderFocusOverlay() {
    const card = document.getElementById("focusOverlayCard");
    if (!card) return;
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const data = Object.assign({}, state.focusState, {
      pitchSequence: state.focusPitchSequence,
      gamePk: state.focusGamePk,
      allLiveGames: liveGames.map(function(g) {
        return {
          gamePk: g.gamePk,
          awayAbbr: g.awayAbbr,
          homeAbbr: g.homeAbbr,
          awayScore: g.awayScore,
          homeScore: g.homeScore,
          inning: g.inning,
          halfInning: g.halfInning,
          isFocused: g.gamePk === state.focusGamePk
        };
      })
    });
    card.innerHTML = window.FocusCard.renderOverlay(data);
  }
  function showFocusAlert(pk, reason) {
    const el = document.getElementById("focusAlertBanner");
    if (!el) return;
    el.style.display = "";
    el.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35);border-radius:6px;margin:6px 0;font-size:.75rem"><span>\u26A1 <strong style="color:var(--text)">' + reason + '</strong></span><div style="display:flex;gap:6px;flex-shrink:0"><button onclick="setFocusGame(' + pk + ');dismissFocusAlert()" style="padding:3px 10px;background:#f59e0b;border:none;border-radius:4px;color:#000;font-weight:700;font-size:11px;cursor:pointer">Switch</button><button onclick="dismissFocusAlert()" style="padding:3px 8px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--muted);font-size:11px;cursor:pointer">\u2715</button></div></div>';
  }
  function dismissFocusAlert() {
    const el = document.getElementById("focusAlertBanner");
    if (el) el.style.display = "none";
  }

  // src/feed/render.js
  var DEBUG3 = false;
  var feedCallbacks = { localDateStr: null };
  function setFeedCallbacks(callbacks) {
    Object.assign(feedCallbacks, callbacks);
  }
  function baseDiamondSvg(on1, on2, on3) {
    const litStyle = "fill:#ffd000;filter:drop-shadow(0 0 3px rgba(255,208,0,0.85))";
    const dimStyle = "fill:var(--muted,#9aa0a8);opacity:0.4";
    return '<svg class="ticker-diamond" width="28" height="24" viewBox="0 0 28 24" aria-hidden="true"><path d="M14,21 L24,12 L14,3 L4,12 Z" fill="none" style="stroke:var(--border,rgba(255,255,255,0.1))" stroke-width="1.2" opacity="0.45"/><circle cx="14" cy="21" r="2" style="' + dimStyle + '"/><circle cx="24" cy="12" r="3" style="' + (on1 ? litStyle : dimStyle) + '"/><circle cx="14" cy="3"  r="3" style="' + (on2 ? litStyle : dimStyle) + '"/><circle cx="4"  cy="12" r="3" style="' + (on3 ? litStyle : dimStyle) + '"/></svg>';
  }
  function tensionBand(score) {
    if (score <= 0) return 0;
    if (score <= 15) return 1;
    if (score <= 30) return 2;
    if (score <= 44) return 3;
    if (score <= 59) return 4;
    if (score <= 76) return 5;
    if (score <= 93) return 6;
    if (score <= 109) return 7;
    if (score <= 129) return 8;
    if (score <= 179) return 9;
    return 10;
  }
  function startCountdown(targetMs) {
    if (state.countdownTimer) {
      clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
    function tick() {
      const el = document.getElementById("heroCountdown");
      if (!el) {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        return;
      }
      const diff = targetMs - Date.now();
      if (diff <= 0) {
        el.textContent = "Starting now";
      } else if (diff >= 36e5) {
        const hrs = Math.floor(diff / 36e5), mins = Math.ceil(diff % 36e5 / 6e4);
        el.textContent = "First pitch in " + hrs + "h" + (mins > 0 ? " " + mins + "m" : "");
      } else {
        const mins = Math.ceil(diff / 6e4);
        el.textContent = "First pitch in " + mins + "m";
      }
    }
    tick();
    state.countdownTimer = setInterval(tick, 3e4);
  }
  function isPostSlate() {
    const games = Object.values(state.gameStates);
    if (!games.length) return false;
    if (!games.every(function(g) {
      return g.status === "Final";
    })) return false;
    let lastTerminalMs = 0;
    state.feedItems.forEach(function(fi) {
      if (fi.data && fi.data.type === "status" && (fi.data.label === "Game Final" || fi.data.label === "Game Postponed")) {
        const ms = fi.ts.getTime();
        if (ms > lastTerminalMs) lastTerminalMs = ms;
      }
    });
    if (!lastTerminalMs) return false;
    return Date.now() - lastTerminalMs > (state.devTuning.postSlateRevertMs || 20 * 60 * 1e3);
  }
  function isIntermission() {
    const games = Object.values(state.gameStates);
    if (!games.length) return false;
    if (!games.some(function(g) {
      return g.status === "Final";
    })) return false;
    if (games.some(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    })) return false;
    if (!games.some(function(g) {
      return g.status !== "Final";
    })) return false;
    let lastTerminalMs = 0;
    state.feedItems.forEach(function(fi) {
      if (fi.data && fi.data.type === "status" && (fi.data.label === "Game Final" || fi.data.label === "Game Postponed")) {
        const ms = fi.ts.getTime();
        if (ms > lastTerminalMs) lastTerminalMs = ms;
      }
    });
    if (!lastTerminalMs) return false;
    return Date.now() - lastTerminalMs > (state.devTuning.intermissionRevertMs || 20 * 60 * 1e3);
  }
  async function fetchTomorrowPreview() {
    if (state.tomorrowPreview.inFlight) return;
    if (Date.now() - state.tomorrowPreview.fetchedAt < 10 * 60 * 1e3) return;
    state.tomorrowPreview.inFlight = true;
    try {
      const ts = etDatePlus(state.pollDateStr || etDateStr(), 1);
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&date=" + ts + "&hydrate=team");
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const games = (d.dates || []).flatMap(function(dt) {
        return dt.games || [];
      });
      state.tomorrowPreview.dateStr = ts;
      state.tomorrowPreview.gameCount = games.length;
      if (games.length) {
        games.sort(function(a, b) {
          return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
        });
        const first = games[0], ms = new Date(first.gameDate).getTime();
        state.tomorrowPreview.firstPitchMs = ms;
        state.tomorrowPreview.gameTime = new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      } else {
        state.tomorrowPreview.firstPitchMs = null;
        state.tomorrowPreview.gameTime = null;
      }
      state.tomorrowPreview.fetchedAt = Date.now();
      if (isPostSlate()) renderEmptyState(true);
    } catch (e) {
      if (DEBUG3) console.warn("fetchTomorrowPreview", e);
    } finally {
      state.tomorrowPreview.inFlight = false;
    }
  }
  function hypeHeadline(diffMs) {
    if (diffMs > 4 * 36e5) return "Catch up on all the latest action.";
    if (diffMs > 36e5) return "Starters warming up.";
    return "First pitch soon.";
  }
  function renderAllHiddenState() {
    const el = document.getElementById("feedEmpty");
    el.className = "";
    el.innerHTML = '<span class="empty-icon">\u{1F441}</span><div class="empty-title">Feed hidden</div><div class="empty-sub">Tap a game chip above to follow its live feed.</div>';
  }
  function updateFeedEmpty() {
    const feed = document.getElementById("feed");
    const hasVisible = !!feed.querySelector(".feed-item:not(.feed-hidden)");
    const hasHiddenItems = !!feed.querySelector(".feed-item.feed-hidden");
    const hasAnyGames = Object.keys(state.gameStates).length > 0;
    const hasLiveInProgress = Object.values(state.gameStates).some(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const postSlate = isPostSlate();
    const intermission = !postSlate && isIntermission();
    const allUserHidden = !state.myTeamLens && !postSlate && !intermission && hasHiddenItems && !hasVisible;
    const showHype = !hasVisible && !allUserHidden && !(state.myTeamLens && hasLiveInProgress) || !hasAnyGames || postSlate || intermission;
    if (showHype) renderEmptyState(postSlate, intermission);
    else if (allUserHidden) renderAllHiddenState();
    document.getElementById("feedEmpty").style.display = showHype || allUserHidden ? "" : "none";
    const hideWhenEmpty = ["gameTicker", "sideRailNews", "sideRailGames", "myTeamLensBtn"];
    document.getElementById("pulse").classList.toggle("pulse-empty", !hasAnyGames || showHype);
    hideWhenEmpty.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = showHype && !allUserHidden ? "none" : "";
    });
    const ybtn = document.getElementById("ptbYestBtn");
    if (ybtn) ybtn.style.display = state.yesterdayCache && state.yesterdayCache.length && !showHype && !allUserHidden ? "" : "none";
  }
  function renderEmptyState(postSlate, intermission) {
    const el = document.getElementById("feedEmpty");
    const upcoming = Object.values(state.gameStates).filter(function(g) {
      if (!(g.status === "Preview" || g.status === "Scheduled" || g.status === "Live" && (g.detailedState === "Warmup" || g.detailedState === "Pre-Game"))) return false;
      const rawG = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
      if (rawG && rawG.doubleHeader === "Y" && rawG.gameNumber == 2) {
        if (Object.values(state.gameStates).some(function(s) {
          return s.status === "Live" && s.awayId === g.awayId && s.homeId === g.homeId;
        })) return false;
      }
      return true;
    });
    upcoming.sort(function(a, b) {
      const aMs = a.gameDateMs || 0, bMs = b.gameDateMs || 0;
      if (aMs !== bMs) return aMs - bMs;
      return a.awayAbbr.localeCompare(b.awayAbbr);
    });
    devTrace("empty", "renderEmptyState \xB7 upcoming=" + upcoming.length + " \xB7 postSlate=" + postSlate + " \xB7 intermission=" + intermission);
    if (!upcoming.length) {
      el.className = "";
      if (postSlate) {
        fetchTomorrowPreview();
        let subText = "Live play-by-play returns when games begin.";
        let countdownHtml = "";
        if (state.tomorrowPreview.firstPitchMs) {
          countdownHtml = '<div id="heroCountdown" style="margin-top:14px;font-size:1rem;color:var(--accent);font-weight:700"></div>';
          const n2 = state.tomorrowPreview.gameCount;
          subText = "Next slate \xB7 " + n2 + " " + (n2 === 1 ? "game" : "games") + " \xB7 first pitch " + (state.tomorrowPreview.gameTime || "TBD");
        } else if (state.tomorrowPreview.fetchedAt && state.tomorrowPreview.gameCount === 0) {
          subText = "No games scheduled in the next slate.";
        }
        const _etH = new Date((/* @__PURE__ */ new Date()).toLocaleString("en-US", { timeZone: "America/New_York" })).getHours();
        const _pastMidnight = _etH < 6;
        const slateRecapCta = Object.values(state.gameStates).length ? '<button onclick="openYesterdayRecap(' + (_pastMidnight ? "-1" : "0") + ')" style="margin-top:20px;display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.8rem;font-weight:700;letter-spacing:.06em;padding:9px 18px;border-radius:7px;cursor:pointer">\u{1F4FA} ' + (_pastMidnight ? "Yesterday's" : "Today's") + " Highlights \u2192</button>" : "";
        el.innerHTML = '<span class="empty-icon">\u{1F3C1}</span><div class="empty-title">Slate complete</div><div class="empty-sub">' + subText + "</div>" + countdownHtml + slateRecapCta;
        if (state.tomorrowPreview.firstPitchMs) startCountdown(state.tomorrowPreview.firstPitchMs);
      } else {
        el.innerHTML = `<span class="empty-icon">\u26BE</span><div class="empty-title">Up next</div><div class="empty-sub">Check back for today's slate.</div>`;
      }
      return;
    }
    el.className = "has-upcoming";
    const hero = upcoming[0], rest = upcoming.slice(1), n = upcoming.length;
    const heroGrad = state.themeOverride === MLB_THEME ? "linear-gradient(90deg," + MLB_THEME.primary + " 0%,#111827 45%," + MLB_THEME.primary + " 100%)" : "linear-gradient(90deg," + hero.awayPrimary + " 0%,#111827 45%," + hero.homePrimary + " 100%)";
    const headline = hypeHeadline(hero.gameDateMs ? hero.gameDateMs - Date.now() : 0);
    const labelText = intermission ? "NEXT UP &middot; " + n + (n === 1 ? " GAME REMAINING" : " GAMES REMAINING") : n + (n === 1 ? " UPCOMING GAME" : " UPCOMING GAMES");
    const hypeRecapCta = state.yesterdayCache && state.yesterdayCache.length ? `<button onclick="openYesterdayRecap()" style="display:inline-flex;align-items:center;gap:7px;background:none;border:1px solid var(--accent);color:var(--accent);font-size:.78rem;font-weight:700;letter-spacing:.06em;padding:7px 16px;border-radius:7px;cursor:pointer">\u{1F4FA} Yesterday's Highlights \u2192</button>` : "";
    const hypeBlock = intermission ? '<div class="empty-hype-block"><div class="empty-hype-headline">' + headline + "</div></div>" : '<div class="empty-hype-block"><div class="empty-hype-headline">' + headline + '</div><div class="hype-cta-row">' + hypeRecapCta + '<button class="demo-cta" onclick="toggleDemoMode()">' + (state.demoMode ? "\u23F9 Exit Demo" : "\u25B6 Try Demo") + '</button></div><div class="empty-hype-pills"><span class="hype-pill hr">\u{1F4A5} Home Runs</span><span class="hype-pill scoring">\u{1F7E2} Scoring Plays</span><span class="hype-pill risp">\u26A1 RISP</span></div><div class="empty-hype-sub">Play-by-play from every MLB game surfaces here the moment a game starts.</div></div>';
    let html = '<div class="empty-upcoming-label">' + labelText + "</div>" + hypeBlock + '<div class="upcoming-hero" style="background:' + heroGrad + '"><div class="upcoming-hero-kicker">NEXT UP</div><div class="upcoming-matchup-row"><div style="display:flex;align-items:center;gap:9px"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/' + hero.awayId + `.svg" onerror="this.style.display='none'"><div class="upcoming-team-name">` + hero.awayAbbr + '</div></div><div class="upcoming-at">@</div><div style="display:flex;align-items:center;gap:9px;flex-direction:row-reverse"><img class="upcoming-cap" src="https://www.mlbstatic.com/team-logos/' + hero.homeId + `.svg" onerror="this.style.display='none'"><div class="upcoming-team-name">` + hero.homeAbbr + '</div></div></div><div class="upcoming-foot"><div><div class="upcoming-foot-time">' + (hero.gameTime || "TBD") + '</div><div class="upcoming-foot-countdown" id="heroCountdown"></div></div>' + (hero.venueName ? '<div class="upcoming-foot-venue">' + hero.venueName + "</div>" : "") + "</div></div>";
    if (rest.length) {
      html += '<div class="upcoming-grid">';
      rest.forEach(function(g) {
        html += '<div class="matchup-card"><div style="font-size:.65rem;color:var(--muted);margin-bottom:4px">' + (g.gameTime || "TBD") + '</div><div style="display:flex;align-items:center;justify-content:center;gap:6px"><div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/' + g.awayId + `.svg" onerror="this.style.display='none'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">` + g.awayAbbr + '</div><div style="font-size:.62rem;color:var(--muted)">' + (g.awayW != null ? "(" + g.awayW + "-" + g.awayL + ")" : "") + '</div></div><span style="color:var(--muted);font-size:.8rem">vs</span><div style="text-align:center"><img class="matchup-cap" src="https://www.mlbstatic.com/team-logos/' + g.homeId + `.svg" onerror="this.style.display='none'"><div style="font-size:.8rem;font-weight:700;color:var(--text)">` + g.homeAbbr + '</div><div style="font-size:.62rem;color:var(--muted)">' + (g.homeW != null ? "(" + g.homeW + "-" + g.homeL + ")" : "") + "</div></div></div></div>";
      });
      html += "</div>";
    }
    el.innerHTML = html;
    if (hero.gameDateMs) startCountdown(hero.gameDateMs);
  }
  function addFeedItem(gamePk, data) {
    const item = { gamePk, data, ts: data.playTime || /* @__PURE__ */ new Date() };
    const idx = state.feedItems.findIndex(function(fi) {
      return fi.ts <= item.ts;
    });
    if (idx === -1) state.feedItems.push(item);
    else state.feedItems.splice(idx, 0, item);
    if (state.feedItems.length > 600) state.feedItems.length = 600;
    if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
      window.Recorder._captureFeedItem(item);
    }
    const el = buildFeedEl(item);
    el.dataset.ts = item.ts.getTime();
    if (!state.enabledGames.has(+gamePk)) el.classList.add("feed-hidden");
    const feed = document.getElementById("feed");
    const tsMs = item.ts.getTime();
    const sibling = Array.from(feed.children).find(function(c) {
      return +c.dataset.ts < tsMs;
    });
    feed.insertBefore(el, sibling || null);
    updateFeedEmpty();
  }
  function buildFeedEl(item) {
    const el = document.createElement("div"), g = state.gameStates[item.gamePk], d = item.data;
    if (d.type === "status") {
      el.className = "feed-item status-change";
      el.setAttribute("data-gamepk", item.gamePk);
      el.innerHTML = '<div class="status-row"><span class="status-icon">' + d.icon + '</span><span class="status-label">' + d.label + '</span><span class="status-sub">' + d.sub + "</span></div>";
      return el;
    }
    let cls = "feed-item";
    if (d.playClass === "homerun") cls += " homerun";
    else if (d.playClass === "scoring") cls += " scoring";
    else if (d.playClass === "risp") cls += " risp";
    el.className = cls;
    el.setAttribute("data-gamepk", item.gamePk);
    const half = d.halfInning === "top" ? "\u25B2" : "\u25BC";
    const innStr = half + ordinal(d.inning), outsStr = d.outs === 1 ? "1 out" : d.outs + " outs";
    const timeStr = item.ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const metaHtml = '<div class="feed-meta"><span class="feed-game-tag"><span class="feed-team-dot" style="background:' + g.awayPrimary + '"></span>' + g.awayAbbr + "&nbsp;<strong>" + d.awayScore + '</strong></span><span class="feed-sep">\xB7</span><span class="feed-game-tag"><strong>' + d.homeScore + "</strong>&nbsp;" + g.homeAbbr + '<span class="feed-team-dot" style="background:' + g.homePrimary + '"></span></span><span class="feed-sep">\xB7</span><span>' + innStr + '</span><span class="feed-sep">\xB7</span><span>' + outsStr + '</span><span class="feed-time">' + timeStr + "</span></div>";
    const icon = d.event === "Home Run" ? "\u{1F4A5} " : d.scoring ? "\u{1F7E2} " : "";
    let scoreBadge = "";
    if (d.scoring) {
      const awayScores = d.halfInning === "top";
      const awayHtml = awayScores ? '<span class="feed-score-scorer">' + g.awayAbbr + "&thinsp;" + d.awayScore + "</span>" : g.awayAbbr + "&thinsp;" + d.awayScore;
      const homeHtml = !awayScores ? '<span class="feed-score-scorer">' + d.homeScore + "&thinsp;" + g.homeAbbr + "</span>" : d.homeScore + "&thinsp;" + g.homeAbbr;
      scoreBadge = '<span class="feed-score-badge">' + awayHtml + '<span class="feed-score-sep">\xB7</span>' + homeHtml + "</span>";
    }
    const rispBadge = d.risp ? '<span class="risp-tag">\u26A1 RISP</span>' : "";
    let evt = d.event || "", playBadge = "";
    if (evt === "Single") playBadge = '<span class="play-tag hit-tag">1B</span>';
    else if (evt === "Double") playBadge = '<span class="play-tag hit-tag">2B</span>';
    else if (evt === "Triple") playBadge = '<span class="play-tag hit-tag">3B</span>';
    else if (evt === "Walk" || evt === "Intent Walk") playBadge = '<span class="play-tag walk-tag">BB</span>';
    else if (evt === "Strikeout") playBadge = '<span class="play-tag k-tag">K</span>';
    else if (evt.indexOf("Error") !== -1) playBadge = '<span class="play-tag err-tag">E</span>';
    else if (evt.indexOf("Triple Play") !== -1) playBadge = '<span class="play-tag tp-tag">TP</span>';
    else if (evt.indexOf("Double Play") !== -1 || evt.indexOf("Grounded Into DP") !== -1) playBadge = '<span class="play-tag dp-tag">DP</span>';
    el.innerHTML = metaHtml + '<div class="feed-play">' + icon + d.desc + rispBadge + playBadge + scoreBadge + "</div>";
    return el;
  }
  function renderFeed() {
    const feed = document.getElementById("feed");
    if (!feed) return;
    feed.innerHTML = "";
    state.feedItems.forEach(function(item) {
      if (state.demoMode && item.ts.getTime() > state.demoCurrentTime) return;
      const el = buildFeedEl(item);
      el.dataset.ts = item.ts.getTime();
      if (!state.enabledGames.has(+item.gamePk)) el.classList.add("feed-hidden");
      feed.appendChild(el);
    });
    updateFeedEmpty();
  }
  function renderTicker() {
    let ticker = document.getElementById("gameTicker"), states = Object.values(state.gameStates);
    states = states.filter(function(g) {
      return g.status === "Live";
    });
    if (!states.length) {
      ticker.innerHTML = '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:20px 12px;min-height:50px;"><div style="text-align:center"><div style="font-size:24px;margin-bottom:6px">\u26BE</div><div style="font-size:.81rem;font-weight:600;color:var(--text);margin-bottom:2px">No Live Games</div></div></div>';
      return;
    }
    states.sort(function(a, b) {
      return calcFocusScore(b) - calcFocusScore(a);
    });
    Array.from(ticker.children).forEach(function(child) {
      if (!child.dataset || !child.dataset.gamepk) ticker.removeChild(child);
    });
    const oldLeft = {};
    ticker.querySelectorAll(".ticker-game[data-gamepk]").forEach(function(el) {
      oldLeft[el.dataset.gamepk] = el.offsetLeft;
    });
    states.forEach(function(g) {
      const isLive = g.status === "Live", isFinal = g.status === "Final";
      const sc = isLive ? "status-live" : isFinal ? "status-final" : "status-preview";
      const half = g.halfInning === "top" ? "\u25B2" : "\u25BC";
      const isPostponed = isFinal && (g.detailedState === "Postponed" || g.detailedState === "Cancelled" || g.detailedState === "Suspended");
      const innStr = isLive ? half + g.inning : isPostponed ? "PPD" : isFinal ? "FINAL" : g.gameTime ? g.gameTime : "PRE";
      let warmupClass = "";
      if (isLive && (g.detailedState === "Warmup" || g.detailedState === "Pre-Game")) {
        warmupClass = " warmup-state";
      }
      const dot = isLive ? '<div class="ticker-live-dot' + warmupClass + '"></div>' : "";
      const hasRunners = isLive && (g.onFirst || g.onSecond || g.onThird);
      const fc = state.enabledGames.has(g.gamePk) ? " feed-enabled" : " feed-disabled";
      const rc = hasRunners ? " has-risp" : "";
      const band = tensionBand(calcFocusScore(g));
      const tc = band ? " tb-" + band : "";
      let outsHtml = "";
      if (isLive) {
        outsHtml = '<span class="ticker-outs">' + [0, 1, 2].map(function(i) {
          return '<span class="out-dot' + (i < g.outs ? " out-on" : "") + '"></span>';
        }).join("") + "</span>";
      }
      let inner;
      if (hasRunners) {
        inner = '<div class="ticker-top">' + dot + '<span class="ticker-score">' + g.awayAbbr + "&nbsp;<strong>" + g.awayScore + '</strong></span><span class="ticker-divider">\xB7</span><span class="ticker-score"><strong>' + g.homeScore + "</strong>&nbsp;" + g.homeAbbr + '</span></div><div class="ticker-bottom">' + baseDiamondSvg(g.onFirst, g.onSecond, g.onThird) + '<span class="ticker-inning">' + innStr + "</span>" + outsHtml + "</div>";
      } else {
        const spacer = isLive ? '<div class="ticker-dot-spacer"></div>' : "";
        inner = '<div class="ticker-row">' + dot + '<span class="ticker-score">' + g.awayAbbr + "&nbsp;<strong>" + g.awayScore + '</strong></span></div><div class="ticker-row">' + spacer + '<span class="ticker-score">' + g.homeAbbr + "&nbsp;<strong>" + g.homeScore + '</strong></span></div><div class="ticker-row"><span class="ticker-inning">' + innStr + "</span>" + outsHtml + "</div>";
      }
      let el = ticker.querySelector('.ticker-game[data-gamepk="' + g.gamePk + '"]');
      if (el) {
        el.className = "ticker-game " + sc + fc + rc + tc;
        el.innerHTML = inner;
      } else {
        el = document.createElement("div");
        el.className = "ticker-game " + sc + fc + rc + tc;
        el.dataset.gamepk = g.gamePk;
        el.setAttribute("onclick", "toggleGame(" + g.gamePk + ")");
        el.innerHTML = inner;
        ticker.appendChild(el);
      }
    });
    ticker.querySelectorAll(".ticker-game[data-gamepk]").forEach(function(el) {
      const pk = +el.dataset.gamepk;
      if (!states.some(function(g) {
        return g.gamePk === pk;
      })) ticker.removeChild(el);
    });
    states.forEach(function(g) {
      const el = ticker.querySelector('.ticker-game[data-gamepk="' + g.gamePk + '"]');
      if (el) ticker.appendChild(el);
    });
    states.forEach(function(g) {
      const el = ticker.querySelector('.ticker-game[data-gamepk="' + g.gamePk + '"]');
      if (!el || oldLeft[g.gamePk] == null) return;
      const delta = oldLeft[g.gamePk] - el.offsetLeft;
      if (Math.abs(delta) < 1) return;
      el.style.transition = "none";
      el.style.transform = "translateX(" + delta + "px)";
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          el.style.transition = "transform 0.35s cubic-bezier(0.4,0,0.2,1)";
          el.style.transform = "";
        });
      });
    });
  }
  function renderSideRailGames() {
    let upcomingHtml = "", completedHtml = "";
    let upcomingGames = [], completedGames = [], liveCount = 0;
    const localDateStr2 = feedCallbacks.localDateStr;
    const filterDate = state.demoMode && localDateStr2 ? localDateStr2(state.demoDate) : localDateStr2 ? localDateStr2(/* @__PURE__ */ new Date()) : null;
    if (state.demoMode && DEBUG3) console.log("Demo: renderSideRailGames filtering to date", filterDate, "from", Object.keys(state.gameStates).length, "total games");
    Object.values(state.gameStates).forEach(function(g) {
      if (state.demoMode && localDateStr2 && localDateStr2(new Date(g.gameDateMs)) !== filterDate) return;
      if (g.status === "Live") {
        liveCount++;
        return;
      }
      if (g.status === "Final") completedGames.push(g);
      else upcomingGames.push(g);
    });
    upcomingGames.sort(function(a, b) {
      return (a.gameDateMs || 0) - (b.gameDateMs || 0);
    });
    completedGames.sort(function(a, b) {
      return (b.gameDateMs || 0) - (a.gameDateMs || 0);
    });
    if (upcomingGames.length) {
      upcomingHtml += '<div class="side-rail-section-header"><span class="side-rail-section-title">Upcoming Today</span><span class="game-count">' + upcomingGames.length + "</span></div>";
      upcomingHtml += '<div class="side-rail-games-container">';
      upcomingGames.forEach(function(g) {
        const time = g.gameTime || "TBD";
        upcomingHtml += '<div class="side-rail-game" onclick="showLiveGame(' + g.gamePk + ')"><span class="side-rail-game-time-badge">' + time + '</span><span class="side-rail-game-dot" style="background:' + g.awayPrimary + '"></span><span class="side-rail-game-abbr">' + g.awayAbbr + '</span><span class="side-rail-game-vs">@</span><span class="side-rail-game-dot" style="background:' + g.homePrimary + '"></span><span class="side-rail-game-abbr">' + g.homeAbbr + "</span></div>";
      });
      upcomingHtml += "</div>";
    }
    if (completedGames.length) {
      completedHtml += '<div class="side-rail-section-header"><span class="side-rail-section-title">Completed</span><span class="game-count">' + completedGames.length + "</span></div>";
      completedHtml += '<div class="side-rail-games-container">';
      completedGames.forEach(function(g) {
        const isPostponed = g.detailedState === "Postponed" || g.detailedState === "Cancelled" || g.detailedState === "Suspended";
        const scoreStr = isPostponed ? "PPD" : g.awayScore + "-" + g.homeScore;
        completedHtml += '<div class="side-rail-game" onclick="showLiveGame(' + g.gamePk + ')"><span class="side-rail-game-score-badge">' + scoreStr + '</span><span class="side-rail-game-dot" style="background:' + g.awayPrimary + '"></span><span class="side-rail-game-abbr">' + g.awayAbbr + '</span><span class="side-rail-game-vs">@</span><span class="side-rail-game-dot" style="background:' + g.homePrimary + '"></span><span class="side-rail-game-abbr">' + g.homeAbbr + "</span></div>";
      });
      completedHtml += "</div>";
    }
    let gamesHtml = upcomingHtml + completedHtml;
    if (!gamesHtml) gamesHtml = '<div style="color:var(--muted);font-size:.75rem;padding:12px;text-align:center;">' + (liveCount ? "All " + liveCount + " game" + (liveCount > 1 ? "s" : "") + " in progress \u2014 see ticker above" : "No games today") + "</div>";
    document.getElementById("sideRailGames").innerHTML = gamesHtml;
  }
  function showAlert(opts) {
    const icon = opts.icon || "\u{1F514}", evtLabel = opts.event || "", desc = opts.desc || "", color = opts.color || "#e03030", duration = opts.duration || 5e3, persistent = !!opts.persistent;
    const stack = document.getElementById("alertStack"), el = document.createElement("div");
    el.className = "alert-toast";
    el.style.borderLeftColor = color;
    if (!persistent) el.style.setProperty("--toast-duration", duration + "ms");
    const closeBtn = persistent ? '<button class="alert-dismiss" onclick="event.stopPropagation()" aria-label="Dismiss">\u2715</button>' : "";
    const progressBar = persistent ? "" : '<div class="alert-progress"></div>';
    el.innerHTML = '<span class="alert-icon">' + icon + '</span><div class="alert-body"><div class="alert-event">' + evtLabel + '</div><div class="alert-desc">' + desc + "</div></div>" + closeBtn + progressBar;
    el.addEventListener("click", function() {
      dismissAlert(el);
    });
    if (persistent) {
      const btn = el.querySelector(".alert-dismiss");
      if (btn) btn.addEventListener("click", function() {
        dismissAlert(el);
      });
    }
    stack.appendChild(el);
    if (!persistent) setTimeout(function() {
      dismissAlert(el);
    }, duration);
  }
  function dismissAlert(el) {
    if (!el.parentNode) return;
    el.classList.add("dismissing");
    setTimeout(function() {
      el.remove();
    }, 300);
  }

  // src/radio/check.js
  var checkCallbacks = { toggleSettings: null };
  function setRadioCheckCallbacks(cb) {
    Object.assign(checkCallbacks, cb);
  }
  var radioCheckResults = {};
  var radioCheckNotes = {};
  var radioCheckPlayingKey = null;
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
    }
    document.body.removeChild(ta);
  }
  function loadRadioCheckResults() {
    try {
      const s = localStorage.getItem("mlb_radio_check");
      if (s) radioCheckResults = JSON.parse(s) || {};
    } catch (e) {
      radioCheckResults = {};
    }
    try {
      const n = localStorage.getItem("mlb_radio_check_notes");
      if (n) radioCheckNotes = JSON.parse(n) || {};
    } catch (e) {
      radioCheckNotes = {};
    }
    try {
      if (!localStorage.getItem("mlb_radio_check_notes_seeded_v2")) {
        Object.keys(RADIO_CHECK_DEFAULT_NOTES).forEach(function(k) {
          if (!radioCheckNotes[k]) radioCheckNotes[k] = RADIO_CHECK_DEFAULT_NOTES[k];
        });
        saveRadioCheckNotes();
        localStorage.setItem("mlb_radio_check_notes_seeded_v2", "1");
      }
    } catch (e) {
    }
  }
  function saveRadioCheckResults() {
    try {
      localStorage.setItem("mlb_radio_check", JSON.stringify(radioCheckResults));
    } catch (e) {
    }
  }
  function saveRadioCheckNotes() {
    try {
      localStorage.setItem("mlb_radio_check_notes", JSON.stringify(radioCheckNotes));
    } catch (e) {
    }
  }
  function openRadioCheck() {
    loadRadioCheckResults();
    document.getElementById("radioCheckOverlay").style.display = "flex";
    renderRadioCheckList();
    if (checkCallbacks.toggleSettings) checkCallbacks.toggleSettings();
  }
  function closeRadioCheck() {
    document.getElementById("radioCheckOverlay").style.display = "none";
    radioCheckStop();
  }
  function radioCheckEntries() {
    const entries = [];
    Object.keys(MLB_TEAM_RADIO).forEach(function(tid) {
      const team = TEAMS.find(function(t) {
        return t.id === +tid;
      });
      entries.push({ key: tid, teamId: +tid, teamName: team ? team.name : "Team " + tid, abbr: team ? team.short : "", station: MLB_TEAM_RADIO[tid].name, url: MLB_TEAM_RADIO[tid].url, format: MLB_TEAM_RADIO[tid].format });
    });
    entries.sort(function(a, b) {
      return a.teamName.localeCompare(b.teamName);
    });
    entries.push({ key: "fallback", teamId: null, teamName: "(Fallback)", abbr: "", station: FALLBACK_RADIO.name, url: FALLBACK_RADIO.url, format: FALLBACK_RADIO.format });
    return entries;
  }
  function renderRadioCheckList() {
    const list = document.getElementById("radioCheckList");
    if (!list) return;
    const entries = radioCheckEntries();
    const html = entries.map(function(e) {
      const status = radioCheckResults[e.key] || "";
      const note = (radioCheckNotes[e.key] || "").replace(/"/g, "&quot;");
      const playing = radioCheckPlayingKey === e.key;
      const gameLive = radioCheckTeamHasLiveGame(e.teamId);
      return '<div style="padding:0.5rem 0.625rem;border-bottom:1px solid var(--border);' + (playing ? "background:rgba(34,197,94,.08)" : "") + `"><div style="display:flex;align-items:center;gap:8px"><button onclick="radioCheckPlay('` + e.key + `')" style="background:` + (playing ? "#22c55e" : "var(--card2)") + ";border:1px solid var(--border);color:" + (playing ? "#000" : "var(--text)") + ';font-size:.7rem;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:700;flex-shrink:0;min-width:36px">\u25B6</button><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:.78rem;font-weight:700;color:var(--text)">' + e.teamName + (e.abbr ? ' <span style="color:var(--muted);font-weight:500">\xB7 ' + e.abbr + "</span>" : "") + "</span>" + (gameLive ? '<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(34,197,94,.15);border:1px solid #22c55e;border-radius:10px;padding:1px 6px;font-size:.6rem;font-weight:700;color:#22c55e">\u25CF GAME ON</span>' : "") + '</div><div style="font-size:.66rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + e.station + " \xB7 " + e.format.toUpperCase() + `</div></div><div style="display:flex;gap:4px;flex-shrink:0"><button onclick="radioCheckSet('` + e.key + `','yes')" title="Tap again to clear" style="cursor:pointer;background:` + (status === "yes" ? "#22c55e" : "var(--card2)") + ";color:" + (status === "yes" ? "#000" : "var(--text)") + `;border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">\u2705</button><button onclick="radioCheckSet('` + e.key + `','no')" title="Tap again to clear" style="cursor:pointer;background:` + (status === "no" ? "#e03030" : "var(--card2)") + ";color:" + (status === "no" ? "#fff" : "var(--text)") + ';border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:.7rem;font-weight:700">\u274C</button></div></div><input type="text" value="' + note + `" oninput="radioCheckSetNote('` + e.key + `',this.value)" placeholder="Notes (e.g. plays ads during games)" style="margin-top:6px;width:100%;background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 8px;border-radius:6px;box-sizing:border-box"></div>`;
    }).join("");
    const done = Object.values(radioCheckResults).filter(function(v) {
      return v === "yes" || v === "no";
    }).length;
    const summary = '<div style="padding:0.5rem 0.625rem;font-size:.7rem;color:var(--muted);text-align:center">' + done + " of " + entries.length + " checked</div>";
    list.innerHTML = summary + html;
  }
  function radioCheckTeamHasLiveGame(teamId) {
    if (!teamId) return false;
    return Object.values(state.gameStates).some(function(g) {
      return g.status === "Live" && g.detailedState === "In Progress" && (g.awayId === teamId || g.homeId === teamId);
    });
  }
  function radioCheckPlay(key) {
    const entries = radioCheckEntries();
    const e = entries.find(function(x) {
      return x.key === key;
    });
    if (!e) return;
    radioCheckPlayingKey = key;
    const pick = { teamId: e.teamId, abbr: e.abbr, name: e.station, url: e.url, format: e.format };
    loadRadioStream(pick);
    renderRadioCheckList();
  }
  function radioCheckTryCustom() {
    let url = (document.getElementById("radioCustomUrl") || {}).value || "";
    url = url.trim();
    const status = document.getElementById("radioCustomStatus");
    if (!url) {
      if (status) status.textContent = "Paste a URL first.";
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      if (status) status.textContent = "URL must start with http:// or https://";
      return;
    }
    const fmtSel = (document.getElementById("radioCustomFmt") || {}).value || "auto";
    let fmt2 = fmtSel;
    if (fmt2 === "auto") fmt2 = /\.m3u8(\?|$)/i.test(url) ? "hls" : "mp3";
    if (status) status.innerHTML = '<span style="color:var(--text)">Loading \xB7 format=' + fmt2 + "\u2026</span>";
    const pick = { teamId: null, abbr: "TEST", name: "Custom \xB7 " + (fmt2 === "hls" ? "HLS" : "MP3"), url, format: fmt2 };
    radioCheckPlayingKey = null;
    devTrace("radio", "custom URL \xB7 fmt=" + fmt2 + " \xB7 " + url);
    try {
      const audio = getRadioAudio() || new Audio();
      const onPlay = function() {
        if (status) status.innerHTML = '<span style="color:#22c55e">\u2705 Playing \xB7 ' + fmt2.toUpperCase() + " \xB7 " + escHtml(url.length > 80 ? url.slice(0, 80) + "\u2026" : url) + "</span>";
        audio.removeEventListener("playing", onPlay);
      };
      const onErr = function(e) {
        if (status) status.innerHTML = '<span style="color:#ff6b6b">\u274C Failed \xB7 ' + (e && e.message || "audio error") + "</span>";
        audio.removeEventListener("error", onErr);
      };
      audio.addEventListener("playing", onPlay, { once: true });
      audio.addEventListener("error", onErr, { once: true });
    } catch (e) {
    }
    loadRadioStream(pick);
    renderRadioCheckList();
  }
  function radioCheckStop() {
    radioCheckPlayingKey = null;
    const audio = getRadioAudio();
    if (audio && !audio.paused) stopRadio();
    if (document.getElementById("radioCheckOverlay").style.display !== "none") renderRadioCheckList();
    const st = document.getElementById("radioCustomStatus");
    if (st) st.textContent = "Stopped.";
  }
  function radioCheckSet(key, val) {
    if (radioCheckResults[key] === val) delete radioCheckResults[key];
    else radioCheckResults[key] = val;
    saveRadioCheckResults();
    renderRadioCheckList();
  }
  function radioCheckSetNote(key, val) {
    if (val) radioCheckNotes[key] = val;
    else delete radioCheckNotes[key];
    saveRadioCheckNotes();
  }
  function radioCheckReset() {
    radioCheckResults = {};
    radioCheckNotes = {};
    saveRadioCheckResults();
    saveRadioCheckNotes();
    renderRadioCheckList();
  }
  function radioCheckCopy() {
    const entries = radioCheckEntries();
    const lines = ["MLB Radio Check Results", "Date: " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), ""];
    const works = [], broken = [], untested = [];
    entries.forEach(function(e) {
      const s = radioCheckResults[e.key];
      const note = radioCheckNotes[e.key] || "";
      const block = ["\u2022 " + e.teamName + (e.abbr ? " (" + e.abbr + ")" : "") + " \u2014 " + e.station + " \u2014 " + e.url];
      if (note) block.push("  \u{1F4DD} " + note);
      if (s === "yes") works.push.apply(works, block);
      else if (s === "no") broken.push.apply(broken, block);
      else untested.push.apply(untested, block);
    });
    lines.push("\u2705 WORKS (" + works.filter(function(l) {
      return l.charAt(0) === "\u2022";
    }).length + "):");
    lines.push.apply(lines, works.length ? works : ["  (none marked)"]);
    lines.push("");
    lines.push("\u274C BROKEN (" + broken.filter(function(l) {
      return l.charAt(0) === "\u2022";
    }).length + "):");
    lines.push.apply(lines, broken.length ? broken : ["  (none marked)"]);
    lines.push("");
    if (untested.length) {
      lines.push("\u23F3 UNTESTED (" + untested.filter(function(l) {
        return l.charAt(0) === "\u2022";
      }).length + "):");
      lines.push.apply(lines, untested);
    }
    const text = lines.join("\n");
    const btn = document.getElementById("radioCheckCopyBtn");
    function flash(msg) {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(function() {
        btn.textContent = orig;
      }, 1800);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flash("\u2713 Copied!");
      }, function() {
        fallbackCopy(text);
        flash("\u2713 Copied (fallback)");
      });
    } else {
      fallbackCopy(text);
      flash("\u2713 Copied (fallback)");
    }
  }

  // src/dev/youtube-debug.js
  var ytDebugResults = {};
  var _loadHomeYoutubeWidget = null;
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function forceHttps2(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function setYoutubeDebugCallbacks(cbs) {
    if (cbs.loadHomeYoutubeWidget) _loadHomeYoutubeWidget = cbs.loadHomeYoutubeWidget;
  }
  function openYoutubeDebug() {
    document.getElementById("ytDebugOverlay").style.display = "flex";
    renderYoutubeDebugList();
    const inp = document.getElementById("ytCustomInput");
    if (inp && !inp.value && state.activeTeam && state.activeTeam.youtubeUC) inp.value = state.activeTeam.youtubeUC;
  }
  function closeYoutubeDebug() {
    document.getElementById("ytDebugOverlay").style.display = "none";
  }
  function parseYTChannelInput(s) {
    s = (s || "").trim();
    if (!s) return { error: "Empty." };
    if (/^UC[A-Za-z0-9_-]{20,30}$/.test(s)) return { uc: s };
    const m = s.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{20,30})/);
    if (m) return { uc: m[1] };
    if (/youtube\.com\/(@|user\/|c\/)/i.test(s) || /^@/.test(s)) {
      return { error: "@handle / /user / /c can't be resolved client-side. Visit the channel \u2192 \u22EF \u2192 Share Channel \u2192 Copy Channel ID (UCxxx\u2026)." };
    }
    return { error: "Not recognised. Paste a UC channel id or a youtube.com/channel/UCxxx URL." };
  }
  function ytDebugFetchCustom() {
    const raw = (document.getElementById("ytCustomInput") || {}).value || "";
    const out = document.getElementById("ytCustomResult");
    const p = parseYTChannelInput(raw);
    if (p.error) {
      if (out) out.innerHTML = '<span style="color:#ff6b6b">' + escapeHtml(p.error) + "</span>";
      return;
    }
    const uc = p.uc;
    if (out) out.innerHTML = '<span style="color:var(--text)">\u23F3 Fetching ' + escapeHtml(uc) + "\u2026</span>";
    const t0 = Date.now();
    fetch(API_BASE + "/api/proxy-youtube?channel=" + encodeURIComponent(uc)).then(function(r) {
      return r.json().then(function(j) {
        return { res: r, j };
      });
    }).then(function(o) {
      const ms = Date.now() - t0;
      if (!o.res.ok || !o.j.success || !o.j.videos || !o.j.videos.length) {
        const msg = "HTTP " + o.res.status + (o.j && o.j.error ? " \xB7 " + o.j.error : o.j && o.j.message ? " \xB7 " + o.j.message : "");
        if (out) out.innerHTML = '<span style="color:#ff6b6b">\u274C ' + escapeHtml(msg) + " \xB7 " + ms + "ms</span>";
        return;
      }
      const v = o.j.videos.slice(0, 5);
      const teamLbl = state.activeTeam ? state.activeTeam.short : "team";
      let html = '<div style="color:#22c55e;font-weight:700">\u2705 HTTP ' + o.res.status + " \xB7 " + o.j.count + " videos \xB7 " + ms + "ms</div>";
      html += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
      v.forEach(function(vid) {
        const thumbUrl = vid.thumb ? forceHttps2(vid.thumb) : "";
        html += '<div style="display:flex;gap:8px;align-items:flex-start"><img src="' + escapeHtml(thumbUrl) + `" style="width:60px;height:34px;object-fit:cover;border-radius:3px;flex-shrink:0" loading="lazy" onerror="this.style.display='none'"/><div style="flex:1;min-width:0"><div style="font-size:.65rem;color:var(--text);font-weight:600;line-height:1.2">` + escapeHtml(vid.title || "?") + '</div><div style="font-size:.6rem;color:var(--muted)">' + escapeHtml(vid.date || "") + "</div></div></div>";
      });
      html += "</div>";
      html += `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap"><button onclick="ytDebugApplyToTeam('` + escapeHtml(uc) + `')" style="background:var(--secondary);border:1px solid var(--border);color:var(--accent-text);font-size:.66rem;font-weight:700;padding:5px 10px;border-radius:6px;cursor:pointer">\u2699 Apply to ` + escapeHtml(teamLbl) + '</button><a href="https://www.youtube.com/channel/' + escapeHtml(uc) + '" target="_blank" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.66rem;padding:5px 10px;border-radius:6px;text-decoration:none">Open \u2197</a></div>';
      if (out) out.innerHTML = html;
    }).catch(function(err) {
      const ms = Date.now() - t0;
      if (out) out.innerHTML = '<span style="color:#ff6b6b">\u274C Network: ' + escapeHtml(err && err.message || "failed") + " \xB7 " + ms + "ms</span>";
    });
  }
  function ytDebugApplyToTeam(uc) {
    if (!state.activeTeam) {
      alert("No active team.");
      return;
    }
    const prev = state.activeTeam.youtubeUC;
    state.activeTeam.youtubeUC = uc;
    devTrace("yt", "custom UC applied \xB7 " + state.activeTeam.short + " \xB7 was " + prev + " \xB7 now " + uc);
    if (_loadHomeYoutubeWidget) _loadHomeYoutubeWidget();
    const out = document.getElementById("ytCustomResult");
    if (out) {
      const note = document.createElement("div");
      note.style.cssText = "margin-top:6px;padding:6px 8px;background:var(--card2);border:1px solid #22c55e;border-radius:4px;color:var(--text);font-size:.62rem";
      note.textContent = "\u2705 Applied to " + state.activeTeam.short + ". Open Home \u2192 YouTube widget to verify. Switching teams or reloading reverts to " + (prev || "(none)") + ".";
      out.appendChild(note);
    }
  }
  function ytDebugEntries() {
    const entries = TEAMS.map(function(t) {
      return { key: t.id, teamId: t.id, teamName: t.name, abbr: t.short, channelId: t.youtubeUC || "" };
    });
    entries.sort(function(a, b) {
      return a.teamName.localeCompare(b.teamName);
    });
    if (typeof window !== "undefined" && window.MLB_FALLBACK_UC) {
      entries.push({ key: "mlb_fallback", teamId: null, teamName: "MLB (Fallback)", abbr: "MLB", channelId: window.MLB_FALLBACK_UC });
    }
    return entries;
  }
  function renderYoutubeDebugList() {
    const list = document.getElementById("ytDebugList");
    if (!list) return;
    const entries = ytDebugEntries();
    const anyTested = Object.keys(ytDebugResults).length > 0;
    if (!anyTested) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Click "\u25B6 Run All" to sweep all ' + entries.length + " channels.</div>";
      return;
    }
    const done = Object.values(ytDebugResults).filter(function(r) {
      return r && !r.pending;
    }).length;
    const summary = '<div style="padding:6px 10px;font-size:.7rem;color:var(--muted);text-align:center;border-bottom:1px solid var(--border)">' + done + " of " + entries.length + " tested</div>";
    const html = entries.map(function(e) {
      const r = ytDebugResults[e.key];
      let icon, statusLine, extra = "";
      if (!r) {
        icon = "\u2B1C";
        statusLine = '<span style="color:var(--muted)">untested</span>';
      } else if (r.pending) {
        icon = "\u23F3";
        statusLine = '<span style="color:var(--muted)">testing\u2026</span>';
      } else if (r.ok) {
        icon = "\u2705";
        statusLine = '<span style="color:#22c55e;font-weight:700">HTTP ' + r.status + " \xB7 " + r.count + ' videos</span><span style="color:var(--muted);font-size:.66rem"> \xB7 ' + r.ms + "ms</span>";
      } else {
        icon = "\u274C";
        statusLine = '<span style="color:#e03030;font-weight:700">HTTP ' + (r.status || 0) + '</span><span style="color:var(--muted);font-size:.66rem"> \xB7 ' + r.ms + "ms</span>";
        if (r.error) extra = '<div style="margin-top:2px;font-size:.66rem;color:#e03030">' + escapeHtml(r.error) + "</div>";
      }
      return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px"><span style="font-size:.95rem;flex-shrink:0;width:20px;text-align:center">' + icon + '</span><div style="flex:1;min-width:0"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:.78rem;font-weight:700;color:var(--text)">' + escapeHtml(e.teamName) + '</span><span style="font-size:.66rem;color:var(--muted)">' + escapeHtml(e.abbr) + '</span></div><div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:2px"><span style="font-size:.63rem;color:var(--muted);font-family:monospace">' + escapeHtml(e.channelId) + '</span><span style="color:var(--muted)">\xB7</span>' + statusLine + "</div>" + extra + `</div><button onclick="runYoutubeDebugOne('` + e.key + `')" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.68rem;padding:5px 8px;border-radius:6px;cursor:pointer;flex-shrink:0;font-weight:700">\u25B6</button></div>`;
    }).join("");
    list.innerHTML = summary + html;
  }
  function runYoutubeDebugAll() {
    const btn = document.getElementById("ytDebugRunBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "\u23F3 Running\u2026";
    }
    const entries = ytDebugEntries();
    ytDebugResults = {};
    entries.forEach(function(e) {
      ytDebugResults[e.key] = { pending: true };
    });
    renderYoutubeDebugList();
    const promises = entries.map(function(e) {
      return runYoutubeDebugOne(e.key);
    });
    Promise.all(promises).then(function() {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "\u25B6 Run All";
      }
    });
  }
  function runYoutubeDebugOne(key) {
    const entries = ytDebugEntries();
    const e = entries.find(function(x) {
      return String(x.key) === String(key);
    });
    if (!e) return Promise.resolve();
    ytDebugResults[e.key] = { pending: true };
    renderYoutubeDebugList();
    const t0 = Date.now();
    return fetch(API_BASE + "/api/proxy-youtube?channel=" + encodeURIComponent(e.channelId)).then(function(res) {
      const ms = Date.now() - t0;
      return res.json().then(
        function(j) {
          ytDebugResults[e.key] = { ok: res.ok && !!j.success, status: res.status, count: j.count || 0, ms, error: j.error || null };
          renderYoutubeDebugList();
        },
        function() {
          ytDebugResults[e.key] = { ok: false, status: res.status, count: 0, ms, error: "JSON parse error" };
          renderYoutubeDebugList();
        }
      );
    }).catch(function(err) {
      const ms = Date.now() - t0;
      ytDebugResults[e.key] = { ok: false, status: 0, count: 0, ms, error: "Network: " + (err && err.message || "failed") };
      renderYoutubeDebugList();
    });
  }
  function ytDebugReset() {
    ytDebugResults = {};
    renderYoutubeDebugList();
  }
  function ytDebugCopy() {
    const entries = ytDebugEntries();
    const works = [], broken = [], untested = [];
    entries.forEach(function(e) {
      const r = ytDebugResults[e.key];
      if (!r || r.pending) {
        untested.push("\u2022 " + e.teamName + " (" + e.abbr + ") \u2014 " + e.channelId);
      } else if (r.ok) {
        works.push("\u2022 " + e.teamName + " (" + e.abbr + ") \u2014 " + e.channelId + " \u2014 " + r.count + " videos \xB7 " + r.ms + "ms");
      } else {
        const detail = "HTTP " + (r.status || 0) + (r.error ? " \xB7 " + r.error : "");
        broken.push("\u2022 " + e.teamName + " (" + e.abbr + ") \u2014 " + e.channelId + " \u2014 " + detail + " \xB7 " + r.ms + "ms");
      }
    });
    const lines = ["YouTube Channel Test", "Date: " + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), "Proxy: " + API_BASE + "/api/proxy-youtube", ""];
    lines.push("\u2705 WORKS (" + works.length + "):");
    lines.push.apply(lines, works.length ? works : ["  (none)"]);
    lines.push("");
    lines.push("\u274C BROKEN/ERROR (" + broken.length + "):");
    lines.push.apply(lines, broken.length ? broken : ["  (none)"]);
    lines.push("");
    if (untested.length) {
      lines.push("\u23F3 UNTESTED (" + untested.length + "):");
      lines.push.apply(lines, untested);
    }
    if (typeof window !== "undefined" && window._copyToClipboard) {
      window._copyToClipboard(lines.join("\n"), "ytDebugCopyBtn");
    }
  }

  // src/dev/news-test.js
  var NEWS_TEST_SOURCES = ["fangraphs", "mlbtraderumors", "cbssports", "yahoo", "sbnation_mets", "baseballamerica", "mlb_direct", "reddit_baseball", "espn_news"];
  var newsTestResults = {};
  var carouselDiagnostics = null;
  function escapeHtml2(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function openNewsSourceTest() {
    document.getElementById("newsSourceTestOverlay").style.display = "flex";
    renderNewsSourceTest();
  }
  function closeNewsSourceTest() {
    document.getElementById("newsSourceTestOverlay").style.display = "none";
  }
  function renderNewsSourceTest() {
    const list = document.getElementById("newsSourceTestList");
    if (!list) return;
    const testsDone = Object.keys(newsTestResults).length > 0;
    const carouselDone = carouselDiagnostics !== null;
    if (!testsDone && !carouselDone) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">Click "\u25B6 Run All" to test each source and carousel.</div>';
      return;
    }
    let html = "";
    html += '<div style="padding:10px;border-bottom:2px solid var(--border);background:var(--card2)"><b style="color:var(--text)">News Sources</b></div>';
    const rows = NEWS_TEST_SOURCES.map(function(k) {
      const r = newsTestResults[k];
      if (!r) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>' + k + "</b> \xB7 pending</div>";
      if (r.pending) return '<div style="padding:8px 10px;border-bottom:1px solid var(--border);color:var(--muted)"><b>' + k + "</b> \xB7 \u23F3 testing\u2026</div>";
      const ok = r.ok && r.status >= 200 && r.status < 300 && r.itemCount > 0;
      const icon = ok ? "\u2705" : "\u274C";
      const line1 = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:1rem">' + icon + '</span><b style="color:var(--text)">' + k + '</b><span style="color:var(--muted);font-size:.7rem">HTTP ' + (r.status || "?") + " \xB7 " + (r.kind || "?") + " \xB7 " + (r.byteLength || 0) + "b \xB7 " + (r.elapsedMs || 0) + "ms \xB7 " + (r.itemCount || 0) + " items</span></div>";
      const line2 = r.firstTitle ? '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)">First: ' + escapeHtml2(r.firstTitle).slice(0, 140) + "</div>" : "";
      const line3 = r.error ? '<div style="margin-top:4px;font-size:.7rem;color:#e03030">Error: ' + escapeHtml2(r.error) + "</div>" : "";
      const line4 = r.sample ? '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.65rem;color:var(--muted)">sample (first 600 chars)</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">' + escapeHtml2(r.sample) + "</pre></details>" : "";
      const line5 = r.firstItemSample ? '<details style="margin-top:4px"><summary style="cursor:pointer;font-size:.65rem;color:#8ad">first item / article (full)</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card2);border:1px solid var(--border);border-radius:6px;font-size:.62rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:240px;overflow-y:auto">' + escapeHtml2(r.firstItemSample) + "</pre></details>" : "";
      return '<div style="padding:10px;border-bottom:1px solid var(--border)">' + line1 + line2 + line3 + line4 + line5 + "</div>";
    }).join("");
    html += rows;
    if (carouselDone) {
      html += '<div style="padding:10px;border-bottom:2px solid var(--border);background:var(--card2);margin-top:10px"><b style="color:var(--text)">News Pool (proxy-news \u2192 News tab + Home card)</b></div>';
      if (carouselDiagnostics.pending) {
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:var(--muted)">\u23F3 Loading\u2026</div>';
      } else if (carouselDiagnostics.error) {
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:#e03030"><b>Error:</b> ' + escapeHtml2(carouselDiagnostics.error) + "</div>";
      } else if (!carouselDiagnostics.articles || !carouselDiagnostics.articles.length) {
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);color:var(--muted)">No articles returned</div>';
      } else {
        if (carouselDiagnostics.bySource) {
          const summaryRows = Object.keys(carouselDiagnostics.bySource).sort().map(function(src) {
            const s = carouselDiagnostics.bySource[src];
            const pct = s.total ? Math.round(100 * s.withImage / s.total) : 0;
            const color = pct >= 80 ? "#22c55e" : pct >= 40 ? "#e0a040" : "#ff6b6b";
            return '<tr><td style="padding:3px 8px"><b>' + escapeHtml2(src) + '</b></td><td style="padding:3px 8px">' + s.total + ' items</td><td style="padding:3px 8px;color:' + color + '">' + s.withImage + " w/ image (" + pct + '%)</td><td style="padding:3px 8px;color:var(--muted)">' + s.withSafeImage + " pass safe-list</td></tr>";
          }).join("");
          html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:.7rem"><div style="margin-bottom:6px"><b>Pool: ' + carouselDiagnostics.totalCount + ' articles</b> \xB7 per-source image extraction:</div><table style="width:100%;border-collapse:collapse;font-size:.68rem">' + summaryRows + "</table></div>";
        }
        html += '<div style="padding:10px;border-bottom:1px solid var(--border);background:var(--card2);font-size:.7rem;color:var(--muted)">First 10 articles (newest by pubDate):</div>';
        carouselDiagnostics.articles.forEach(function(a, i) {
          const headline = escapeHtml2(a.headline || a.title || "(no headline)");
          const srcTag = a.source ? '<span style="display:inline-block;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:0 6px;font-size:.6rem;color:var(--muted);margin-right:6px">' + escapeHtml2(a.source) + "</span>" : "";
          let imageLine = "";
          if (a.image) {
            const safe = a.imageSafe ? "\u2705" : "\u274C";
            const original = escapeHtml2(a.image);
            const afterHttps = escapeHtml2(a.imageAfterHttps || a.image);
            const domain = escapeHtml2(a.imageDomain || "?");
            imageLine = '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)"><b>Image:</b> [' + safe + "] domain: " + domain + '</div><div style="margin-top:2px;font-size:.65rem;color:var(--muted);word-break:break-all">URL: ' + original + "</div>" + (a.image !== (a.imageAfterHttps || a.image) ? '<div style="margin-top:2px;font-size:.65rem;color:#b0a0ff">forceHttps: ' + original + " \u2192 " + afterHttps + "</div>" : "") + (a.safeReason ? '<div style="margin-top:2px;font-size:.65rem;color:#ff8888">Reason: ' + escapeHtml2(a.safeReason) + "</div>" : "");
          } else {
            imageLine = '<div style="margin-top:4px;font-size:.7rem;color:var(--muted)"><b>Image:</b> (none)</div>';
          }
          html += '<div style="padding:10px;border-bottom:1px solid var(--border)"><div style="font-size:.8rem;color:var(--text);margin-bottom:2px">' + (i + 1) + ". " + srcTag + headline.slice(0, 100) + "</div>" + imageLine + "</div>";
        });
        if (carouselDiagnostics.allowlistSource) {
          html += '<div style="padding:10px;border-bottom:1px solid var(--border);font-size:.65rem;color:var(--muted)"><b>Allowlist regex:</b> <code style="word-break:break-all">' + escapeHtml2(carouselDiagnostics.allowlistSource) + "</code></div>";
        }
      }
    }
    list.innerHTML = html;
  }
  function forceHttps3(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function runNewsSourceTest() {
    const btn = document.getElementById("newsTestRunBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "\u23F3 Running\u2026";
    }
    newsTestResults = {};
    carouselDiagnostics = { pending: true };
    NEWS_TEST_SOURCES.forEach(function(k) {
      newsTestResults[k] = { pending: true };
    });
    renderNewsSourceTest();
    const promises = NEWS_TEST_SOURCES.map(function(k) {
      return fetch(API_BASE + "/api/proxy-test?source=" + encodeURIComponent(k)).then(function(r) {
        return r.json();
      }).then(function(j) {
        newsTestResults[k] = j;
        renderNewsSourceTest();
      }).catch(function(e) {
        newsTestResults[k] = { ok: false, error: "fetch failed: " + (e && e.message || e) };
        renderNewsSourceTest();
      });
    });
    promises.push(fetchCarouselDiagnostics());
    Promise.all(promises).then(function() {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "\u25B6 Run All";
      }
    });
  }
  function fetchCarouselDiagnostics() {
    return fetch(API_BASE + "/api/proxy-news").then(function(r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function(d) {
      const allArticles = Array.isArray(d.articles) ? d.articles : [];
      const bySource = {};
      allArticles.forEach(function(a) {
        const src = a.source || "(unknown)";
        if (!bySource[src]) bySource[src] = { total: 0, withImage: 0, withSafeImage: 0, exampleNoImage: null };
        bySource[src].total += 1;
        if (a.image) {
          bySource[src].withImage += 1;
          if (isSafeNewsImage(a.image)) bySource[src].withSafeImage += 1;
        } else if (!bySource[src].exampleNoImage) {
          bySource[src].exampleNoImage = { title: a.title || a.headline || "", link: a.link || "" };
        }
      });
      const articles = allArticles.slice(0, 10);
      carouselDiagnostics = {
        totalCount: allArticles.length,
        bySource,
        articles: articles.map(function(a) {
          const img = a.image || null;
          let imgDomain = null;
          let imgSafe = false;
          let imgAfterHttps = null;
          let safeReason = null;
          let suggestedEntry = null;
          if (!img) {
            safeReason = "no image URL";
          } else {
            try {
              const url = new URL(img);
              imgDomain = url.hostname;
              imgSafe = isSafeNewsImage(img);
              imgAfterHttps = forceHttps3(img);
              if (!imgSafe) {
                const parts = imgDomain.split(".");
                suggestedEntry = parts.length >= 2 ? parts.slice(-2).join(".") : imgDomain;
                safeReason = 'hostname "' + imgDomain + '" not in NEWS_IMAGE_HOSTS allowlist (add "' + suggestedEntry + '" to fix)';
              }
            } catch (e) {
              imgDomain = "(invalid URL)";
              imgAfterHttps = img;
              safeReason = "malformed URL: " + (e && e.message || e);
            }
          }
          return {
            source: a.source || "(unknown)",
            headline: a.headline || a.title || null,
            image: img,
            imageDomain: imgDomain,
            imageSafe: imgSafe,
            imageAfterHttps: imgAfterHttps,
            safeReason,
            suggestedEntry
          };
        }),
        allowlistSource: NEWS_IMAGE_HOSTS.source
      };
      renderNewsSourceTest();
    }).catch(function(e) {
      carouselDiagnostics = { error: "fetch failed: " + (e && e.message || e) };
      renderNewsSourceTest();
    });
  }
  function copyNewsSourceTest() {
    const lines = ["MLB News Source Test", "Date: " + (/* @__PURE__ */ new Date()).toISOString(), "Proxy: " + API_BASE + "/api/proxy-test", ""];
    NEWS_TEST_SOURCES.forEach(function(k) {
      const r = newsTestResults[k];
      lines.push("\u2500\u2500 " + k + " \u2500\u2500");
      if (!r || r.pending) {
        lines.push("  (not tested)");
        lines.push("");
        return;
      }
      lines.push("  url:        " + (r.url || "?"));
      lines.push("  status:     " + (r.status || "?") + " \xB7 ok=" + !!r.ok);
      lines.push("  kind:       " + (r.kind || "?"));
      lines.push("  contentType:" + (r.contentType || "?"));
      lines.push("  bytes:      " + (r.byteLength || 0));
      lines.push("  elapsedMs:  " + (r.elapsedMs || 0));
      lines.push("  itemCount:  " + (r.itemCount || 0));
      lines.push("  firstTitle: " + (r.firstTitle || ""));
      if (r.error) lines.push("  error:      " + r.error);
      if (r.sample) {
        lines.push("  sample (first 600 chars):");
        r.sample.split("\n").forEach(function(ln) {
          lines.push("    " + ln);
        });
      }
      if (r.firstItemSample) {
        lines.push("  first item / article (full):");
        r.firstItemSample.split("\n").forEach(function(ln) {
          lines.push("    " + ln);
        });
      }
      lines.push("");
    });
    lines.push("");
    lines.push("\u2500\u2500\u2500 News Pool (proxy-news \u2192 News tab + Home card) \u2500\u2500\u2500");
    if (carouselDiagnostics) {
      if (carouselDiagnostics.error) {
        lines.push("Error: " + carouselDiagnostics.error);
      } else if (carouselDiagnostics.articles && carouselDiagnostics.articles.length) {
        lines.push("Total articles: " + (carouselDiagnostics.totalCount || carouselDiagnostics.articles.length));
        if (carouselDiagnostics.bySource) {
          lines.push("");
          lines.push("Per-source image extraction:");
          Object.keys(carouselDiagnostics.bySource).sort().forEach(function(src) {
            const s = carouselDiagnostics.bySource[src];
            const pct = s.total ? Math.round(100 * s.withImage / s.total) : 0;
            lines.push("  " + src.padEnd(12) + " total=" + s.total + "  withImage=" + s.withImage + " (" + pct + "%)  passSafe=" + s.withSafeImage);
            if (s.exampleNoImage && s.exampleNoImage.title) {
              lines.push("    example with no image: " + s.exampleNoImage.title);
              if (s.exampleNoImage.link) lines.push("      " + s.exampleNoImage.link);
            }
          });
        }
        lines.push("");
        lines.push("First 10 articles:");
        carouselDiagnostics.articles.forEach(function(a, i) {
          lines.push("");
          lines.push("[" + (i + 1) + "] [" + (a.source || "?") + "] " + (a.headline || "(no headline)"));
          if (a.image) {
            lines.push("  image: " + a.image);
            lines.push("  domain: " + (a.imageDomain || "?"));
            lines.push("  safe (passes isSafeNewsImage): " + (a.imageSafe ? "YES" : "NO"));
            if (a.safeReason) lines.push("  reason: " + a.safeReason);
            if (a.image !== (a.imageAfterHttps || a.image)) {
              lines.push("  forceHttps: " + a.image + " \u2192 " + a.imageAfterHttps);
            }
          } else {
            lines.push("  image: (none)");
          }
        });
      } else {
        lines.push("(not tested)");
      }
    } else {
      lines.push("(not tested)");
    }
    const text = lines.join("\n");
    const btn = document.getElementById("newsTestCopyBtn");
    function flash(msg) {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = msg;
      setTimeout(function() {
        btn.textContent = orig;
      }, 1800);
    }
    if (typeof window !== "undefined" && window._copyToClipboard) {
      window._copyToClipboard(text);
      flash("\u2713 Copied!");
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flash("\u2713 Copied!");
      }, function() {
        if (typeof window !== "undefined" && window.fallbackCopy) {
          window.fallbackCopy(text);
          flash("\u2713 Copied (fallback)");
        }
      });
    }
  }

  // src/ui/overlays.js
  var _flashCollectionRailMessage = null;
  function setOverlayCallbacks(cbs) {
    if (cbs.flashCollectionRailMessage) _flashCollectionRailMessage = cbs.flashCollectionRailMessage;
  }
  function openVideoOverlay(url, title) {
    const ov = document.getElementById("videoOverlay");
    const vid = document.getElementById("videoOverlayPlayer");
    const ttl = document.getElementById("videoOverlayTitle");
    if (!ov || !vid) return;
    if (ttl) ttl.textContent = title || "";
    vid.src = url;
    vid.load();
    ov.style.display = "flex";
  }
  function closeVideoOverlay() {
    const ov = document.getElementById("videoOverlay");
    const vid = document.getElementById("videoOverlayPlayer");
    if (vid) {
      vid.pause();
      vid.src = "";
    }
    if (ov) ov.style.display = "none";
  }
  function dismissPlayerCard() {
    const overlay = document.getElementById("playerCardOverlay");
    if (!overlay || !overlay.classList.contains("open")) return;
    if (_flashCollectionRailMessage) _flashCollectionRailMessage();
    if (window._playerCardTimer) {
      clearTimeout(window._playerCardTimer);
      window._playerCardTimer = null;
    }
    overlay.classList.add("closing");
    setTimeout(function() {
      overlay.classList.remove("open", "closing");
      document.getElementById("playerCard").innerHTML = '<div class="pc-loading">Loading player card\u2026</div>';
    }, TIMING.CARD_CLOSE_ANIM_MS);
  }
  function closeSignInCTA() {
    if (state.signInCTATimer) {
      clearTimeout(state.signInCTATimer);
      state.signInCTATimer = null;
    }
    const el = document.getElementById("signInCTA");
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(16px)";
    el.style.pointerEvents = "none";
    setTimeout(function() {
      el.style.display = "none";
    }, 260);
  }

  // src/data/clips.js
  function forceHttps4(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function pickPlayback(playbacks) {
    if (!playbacks || !playbacks.length) return null;
    const mp4 = playbacks.find(function(p) {
      return p.name === "mp4Avc";
    });
    if (mp4) return mp4.url;
    const any = playbacks.find(function(p) {
      return p.url && p.url.endsWith(".mp4");
    });
    return any ? any.url : null;
  }
  function pickHeroImage(item) {
    if (!item || !item.image) return null;
    const raw = item.image.cuts;
    if (!raw) return null;
    const cuts = Array.isArray(raw) ? raw : Object.values(raw);
    if (!cuts.length) return null;
    const c16 = cuts.filter(function(c) {
      return c.aspectRatio === "16:9" && (c.width || 0) >= 480;
    });
    c16.sort(function(a, b) {
      return (a.width || 0) - (b.width || 0);
    });
    if (c16.length) return c16[0].src || c16[0].url || null;
    cuts.sort(function(a, b) {
      return (b.width || 0) - (a.width || 0);
    });
    return cuts.length ? cuts[0].src || cuts[0].url || null : null;
  }
  async function fetchGameContent(gamePk) {
    if (state.yesterdayContentCache[gamePk]) return state.yesterdayContentCache[gamePk];
    try {
      const r = await fetch(MLB_BASE + "/game/" + gamePk + "/content");
      const d = await r.json();
      state.yesterdayContentCache[gamePk] = d;
      return d;
    } catch (e) {
      state.yesterdayContentCache[gamePk] = null;
      return null;
    }
  }
  function patchFeedItemWithClip(feedItemTs, gamePk, clip) {
    const url = pickPlayback(clip.playbacks);
    const thumb = pickHeroImage(clip);
    const title = clip.headline || clip.blurb || "Watch Highlight";
    if (!url) return;
    const el = document.querySelector('#feed [data-ts="' + feedItemTs + '"][data-gamepk="' + gamePk + '"]');
    if (!el || el.dataset.clipPatched) return;
    el.dataset.clipPatched = "1";
    const wrap = document.createElement("div");
    wrap.style.cssText = "margin-top:8px;cursor:pointer;position:relative;border-radius:6px;overflow:hidden;background:#000;line-height:0;width:80%;margin-left:auto;margin-right:auto";
    const thumbUrl = thumb ? forceHttps4(thumb) : "";
    wrap.innerHTML = (thumbUrl ? '<img src="' + thumbUrl + `" style="width:100%;aspect-ratio:16/9;object-fit:cover;display:block" onerror="this.style.display='none'">` : '<div style="width:100%;aspect-ratio:16/9;background:#111"></div>') + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><div style="width:38px;height:38px;border-radius:50%;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;padding-left:3px">\u25B6</div></div>';
    wrap.onclick = function(e) {
      e.stopPropagation();
      openVideoOverlay(url, title);
    };
    el.appendChild(wrap);
  }
  async function pollPendingVideoClips() {
    const anchorMs = state.demoMode ? state.demoCurrentTime || 0 : Date.now();
    const cutoff = state.demoMode ? anchorMs - 2 * 60 * 60 * 1e3 : anchorMs - 16 * 60 * 60 * 1e3;
    const feed = document.getElementById("feed");
    if (!feed) return;
    const pending = state.feedItems.filter(function(item) {
      if (!item.data || !item.data.batterId) return false;
      if (item.data.event !== "Home Run" && !item.data.scoring && !(state.demoMode && item.data.event === "Caught Stealing")) return false;
      if (!item.ts || item.ts.getTime() < cutoff) return false;
      const el = feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
      return el && !el.dataset.clipPatched;
    });
    if (!pending.length) return;
    const byGame = {};
    pending.forEach(function(item) {
      (byGame[item.gamePk] = byGame[item.gamePk] || []).push(item);
    });
    for (const pk in byGame) {
      let isStatcast = function(clip) {
        const title = (clip.headline || clip.blurb || "").toLowerCase();
        if (title.indexOf("statcast") !== -1 || title.indexOf("savant") !== -1) return true;
        return (clip.keywordsAll || []).some(function(kw) {
          const v = (kw.value || kw.slug || "").toLowerCase();
          return v === "statcast" || v === "savant";
        });
      }, isABSChallenge = function(clip) {
        const tax = (clip.keywordsAll || []).filter(function(kw) {
          return kw.type === "taxonomy";
        });
        const hasAbs = tax.some(function(kw) {
          return (kw.value || kw.slug || "").toLowerCase() === "abs";
        });
        const hasChallenge = tax.some(function(kw) {
          return (kw.value || kw.slug || "").toLowerCase() === "challenge";
        });
        return hasAbs && hasChallenge;
      };
      const gpk = +pk;
      if (state.demoMode) {
        const timeline = state.contentCacheTimeline[gpk] || [];
        const snap = timeline.length ? timeline[timeline.length - 1] : null;
        if (snap && snap.items && snap.items.length) {
          state.liveContentCache[gpk] = { items: snap.items, fetchedAt: state.demoCurrentTime || 0 };
        }
      } else {
        const cached = state.liveContentCache[gpk];
        const hasNewerEvent = cached && byGame[pk].some(function(item) {
          return item.ts.getTime() > cached.fetchedAt;
        });
        if (!cached || hasNewerEvent || Date.now() - cached.fetchedAt > 5 * 60 * 1e3) {
          try {
            const r = await fetch(MLB_BASE + "/game/" + gpk + "/content");
            if (!r.ok) continue;
            const d = await r.json();
            const all = d.highlights && d.highlights.highlights && d.highlights.highlights.items || [];
            state.liveContentCache[gpk] = {
              items: all.filter(function(it) {
                if (it.type !== "video" || !pickPlayback(it.playbacks)) return false;
                return !(it.keywordsAll || []).some(function(kw) {
                  const v = (kw.value || kw.slug || "").toLowerCase();
                  return v === "data-visualization" || v === "data_visualization";
                });
              }),
              fetchedAt: Date.now()
            };
            if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
              window.Recorder._captureContentDelta(gpk, state.liveContentCache[gpk].items);
            }
          } catch (e) {
            continue;
          }
        }
      }
      const clips = state.liveContentCache[gpk] && state.liveContentCache[gpk].items || [];
      if (!clips.length) continue;
      const broadcastClips = clips.filter(function(c) {
        return !isStatcast(c) && !isABSChallenge(c);
      });
      const scoringClips = broadcastClips.filter(function(clip) {
        return (clip.keywordsAll || []).some(function(kw) {
          const v = kw.value || kw.slug || "";
          return v === "home-run" || v === "scoring-play" || v === "walk-off";
        });
      });
      byGame[pk].forEach(function(item) {
        const playTs = item.ts.getTime();
        const bid = String(item.data.batterId);
        function hasPlayer(clip) {
          return (clip.keywordsAll || []).some(function(kw) {
            if (kw.type === "player_id") return String(kw.value || "") === bid;
            if (kw.slug && kw.slug.startsWith("player_id-")) return kw.slug.split("-")[1] === bid;
            return false;
          });
        }
        const playerFromScoring = scoringClips.filter(hasPlayer);
        const playerFromBroadcast = broadcastClips.filter(hasPlayer);
        const pool = playerFromScoring.length ? playerFromScoring : playerFromBroadcast;
        let best = null, bestDiff = Infinity;
        pool.forEach(function(clip) {
          const clipTs = clip.date ? new Date(clip.date).getTime() : null;
          if (!clipTs) return;
          const diff = Math.abs(clipTs - playTs);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = clip;
          }
        });
        const matchCapMs = state.demoMode ? 60 * 60 * 1e3 : 20 * 60 * 1e3;
        if (best && bestDiff <= matchCapMs) {
          state.lastVideoClip = best;
          patchFeedItemWithClip(playTs, gpk, best);
        }
      });
    }
  }
  async function devTestVideoClip() {
    if (state.lastVideoClip && pickPlayback(state.lastVideoClip.playbacks)) {
      openVideoOverlay(pickPlayback(state.lastVideoClip.playbacks), state.lastVideoClip.headline || state.lastVideoClip.blurb || "Highlight");
      return;
    }
    const keys = Object.keys(state.yesterdayContentCache);
    for (let i = 0; i < keys.length; i++) {
      const c = state.yesterdayContentCache[keys[i]];
      if (!c) continue;
      const items = c.highlights && c.highlights.highlights && c.highlights.highlights.items || [];
      const playable = items.filter(function(it) {
        return it.type === "video" && pickPlayback(it.playbacks);
      });
      if (playable.length) {
        const clip = playable[2] || playable[0];
        state.lastVideoClip = clip;
        openVideoOverlay(pickPlayback(clip.playbacks), clip.headline || clip.blurb || "Highlight");
        return;
      }
    }
    try {
      const ds = etDatePlus(etDateStr(), -1);
      const r = await fetch(MLB_BASE + "/schedule?date=" + ds + "&sportId=1&hydrate=team");
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const games = (d.dates || []).flatMap(function(dt) {
        return dt.games || [];
      });
      if (!games.length) {
        alert("No clip available \u2014 open Yesterday Recap first");
        return;
      }
      const content = await fetchGameContent(games[0].gamePk);
      if (!content) throw new Error("no content");
      const items2 = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
      const playable2 = items2.filter(function(it) {
        return it.type === "video" && pickPlayback(it.playbacks);
      });
      if (!playable2.length) {
        alert("No playable clip found for yesterday");
        return;
      }
      state.lastVideoClip = playable2[0];
      openVideoOverlay(pickPlayback(playable2[0].playbacks), playable2[0].headline || playable2[0].blurb || "Highlight");
    } catch (e) {
      alert("Could not load clip: " + (e && e.message || e));
    }
  }

  // src/dev/video-debug.js
  function escHtml2(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function openVideoDebugPanel() {
    const p = document.getElementById("videoDebugPanel");
    if (!p) return;
    p.style.display = "flex";
    renderVideoDebugPanel();
  }
  function closeVideoDebugPanel() {
    const p = document.getElementById("videoDebugPanel");
    if (p) p.style.display = "none";
  }
  async function refreshVideoDebugPanel() {
    const btn = document.getElementById("videoDebugRefreshBtn");
    if (btn) {
      btn.textContent = "\u23F3 Fetching...";
      btn.disabled = true;
    }
    await pollPendingVideoClips();
    renderVideoDebugPanel();
    if (btn) {
      btn.textContent = "\u21BB Fetch Now";
      btn.disabled = false;
    }
  }
  function renderVideoDebugPanel() {
    const el = document.getElementById("videoDebugList");
    if (!el) return;
    let html = "";
    const feed = document.getElementById("feed");
    const cutoff = Date.now() - 2 * 60 * 60 * 1e3;
    const hrItems = state.feedItems.filter(function(item) {
      if (!item.data || !item.data.batterId) return false;
      if (item.data.event !== "Home Run" && !item.data.scoring) return false;
      return item.ts && item.ts.getTime() >= cutoff;
    });
    html += '<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
    html += '<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text)">\u{1F3AF} HR / scoring plays in last 2h \u2014 ' + hrItems.length + " found</div>";
    if (!hrItems.length) {
      html += '<div style="padding:8px 12px;color:var(--muted)">No qualifying plays in state.feedItems yet.</div>';
    } else {
      hrItems.slice().reverse().forEach(function(item) {
        const domEl = feed && feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
        const patched = domEl && domEl.dataset.clipPatched === "1";
        const patchBadge = patched ? '<span style="background:rgba(34,197,94,.2);color:#4ade80;padding:1px 6px;border-radius:4px">\u2713 clip attached</span>' : '<span style="background:rgba(245,158,11,.18);color:#fbbf24;padding:1px 6px;border-radius:4px">\u23F3 pending</span>';
        const domBadge = domEl ? '<span style="color:var(--muted)">in DOM</span>' : '<span style="color:#f87171">not in DOM</span>';
        html += '<div style="padding:7px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
        html += patchBadge + " " + domBadge;
        html += '<span style="color:var(--text)">' + escHtml2(item.data.batterName || "?") + "</span>";
        html += '<span style="color:var(--muted)">' + escHtml2(item.data.event || "") + "</span>";
        html += '<span style="color:var(--muted);font-size:.65rem">pk:' + item.gamePk + " ts:" + new Date(item.ts).toLocaleTimeString() + "</span>";
        html += "</div>";
      });
    }
    html += "</div>";
    const pks = Object.keys(state.liveContentCache);
    html += '<div style="margin-bottom:8px;font-weight:700;color:var(--text);font-size:.8rem">\u{1F4E6} state.liveContentCache \u2014 ' + pks.length + " game" + (pks.length === 1 ? "" : "s") + "</div>";
    if (!pks.length) {
      html += '<div style="color:var(--muted);padding:8px 0 4px">No content fetched yet. Click "\u21BB Fetch Now" above after HR plays appear in the feed.</div>';
    }
    pks.forEach(function(pk) {
      const entry = state.liveContentCache[pk];
      const clips = entry.items || [];
      const age = Math.round((Date.now() - entry.fetchedAt) / 1e3);
      html += '<div style="margin-bottom:16px;border:1px solid var(--border);border-radius:8px;overflow:hidden">';
      html += '<div style="background:var(--card2);padding:8px 12px;font-weight:700;color:var(--text);display:flex;justify-content:space-between;align-items:center">';
      html += "<span>Game " + pk + ' &nbsp;<span style="color:var(--muted);font-weight:400">(' + clips.length + " video clips)</span></span>";
      html += '<span style="color:var(--muted);font-size:.65rem;font-weight:400">fetched ' + age + "s ago</span>";
      html += "</div>";
      if (!clips.length) {
        html += '<div style="padding:8px 12px;color:var(--muted)">No playable video clips returned from API.</div>';
      } else {
        clips.forEach(function(clip, i) {
          const title = (clip.headline || clip.blurb || "").toLowerCase();
          const isStatcast2 = title.indexOf("statcast") !== -1 || title.indexOf("savant") !== -1 || (clip.keywordsAll || []).some(function(kw) {
            const v = (kw.value || kw.slug || "").toLowerCase();
            return v === "statcast" || v === "savant";
          });
          const hasScoringKw = (clip.keywordsAll || []).some(function(kw) {
            const v = kw.value || kw.slug || "";
            return v === "home-run" || v === "scoring-play" || v === "walk-off";
          });
          const playerIds = (clip.keywordsAll || []).filter(function(kw) {
            return kw.type === "player_id" || kw.slug && kw.slug.startsWith("player_id-");
          }).map(function(kw) {
            return kw.type === "player_id" ? kw.value : kw.slug.split("-")[1];
          });
          const hasPlayback = !!pickPlayback(clip.playbacks);
          const clipTs = clip.date ? new Date(clip.date).getTime() : null;
          const clipAge = clipTs ? Math.round((Date.now() - clipTs) / 6e4) + "m ago" : "no date";
          const statcastBadge = isStatcast2 ? '<span style="background:rgba(220,60,60,.25);color:#f87171;padding:1px 5px;border-radius:4px">\u{1F6AB}SC</span>' : '<span style="background:rgba(34,197,94,.15);color:#4ade80;padding:1px 5px;border-radius:4px">\u2713bc</span>';
          const scoringBadge = hasScoringKw ? '<span style="background:rgba(245,158,11,.2);color:#fbbf24;padding:1px 5px;border-radius:4px">\u2713kw</span>' : '<span style="color:var(--muted);padding:1px 5px">\u2014kw</span>';
          const playbackBadge = hasPlayback ? '<span style="color:#4ade80">\u2713mp4</span>' : '<span style="color:#f87171">\u2717mp4</span>';
          html += '<div style="padding:6px 12px;border-top:1px solid var(--border);' + (isStatcast2 ? "opacity:.4" : "") + '">';
          html += '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:3px">';
          html += '<span style="color:var(--muted);min-width:16px">' + i + ".</span>";
          html += statcastBadge + " " + scoringBadge + " " + playbackBadge;
          html += '<span style="color:var(--muted);font-size:.62rem">' + clipAge + "</span>";
          html += "</div>";
          html += '<div style="color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px" title="' + escHtml2(clip.headline || "") + '">' + escHtml2(clip.headline || clip.blurb || "(no title)") + "</div>";
          if (playerIds.length) html += '<div style="color:var(--muted);font-size:.62rem">player_ids: ' + escHtml2(playerIds.join(", ")) + "</div>";
          const kwTax = (clip.keywordsAll || []).filter(function(kw) {
            return kw.type === "taxonomy";
          }).map(function(kw) {
            return kw.value || kw.slug;
          }).join(", ");
          if (kwTax) html += '<div style="color:var(--muted);font-size:.62rem">taxonomy: ' + escHtml2(kwTax) + "</div>";
          html += "</div>";
        });
      }
      html += "</div>";
    });
    el.innerHTML = html;
  }
  function copyVideoDebug() {
    const btn = document.getElementById("videoDebugCopyBtn");
    function flash(t) {
      if (btn) {
        const o = btn.textContent;
        btn.textContent = t;
        setTimeout(function() {
          btn.textContent = o;
        }, 1800);
      }
    }
    const feed = document.getElementById("feed");
    const cutoff = Date.now() - 2 * 60 * 60 * 1e3;
    const pendingItems = state.feedItems.filter(function(item) {
      return item.data && item.data.batterId && (item.data.event === "Home Run" || item.data.scoring) && item.ts && item.ts.getTime() >= cutoff;
    }).map(function(item) {
      const domEl = feed && feed.querySelector('[data-ts="' + item.ts.getTime() + '"][data-gamepk="' + item.gamePk + '"]');
      return { gamePk: item.gamePk, batterName: item.data.batterName, batterId: item.data.batterId, event: item.data.event, ts: item.ts.toISOString(), clipPatched: !!(domEl && domEl.dataset.clipPatched === "1") };
    });
    const cacheOut = {};
    Object.keys(state.liveContentCache).forEach(function(pk) {
      const entry = state.liveContentCache[pk];
      cacheOut[pk] = {
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
        clipCount: (entry.items || []).length,
        clips: (entry.items || []).map(function(clip) {
          const playerIds = (clip.keywordsAll || []).filter(function(kw) {
            return kw.type === "player_id" || kw.slug && kw.slug.startsWith("player_id-");
          }).map(function(kw) {
            return kw.type === "player_id" ? kw.value : kw.slug.split("-")[1];
          });
          const taxonomy = (clip.keywordsAll || []).filter(function(kw) {
            return kw.type === "taxonomy";
          }).map(function(kw) {
            return kw.value || kw.slug;
          });
          const isStatcast = (clip.headline || clip.blurb || "").toLowerCase().indexOf("statcast") !== -1 || taxonomy.some(function(v) {
            return v === "statcast" || v === "savant";
          });
          return { id: clip.id, headline: clip.headline || clip.blurb, date: clip.date, isStatcast, hasScoringKw: taxonomy.some(function(v) {
            return v === "home-run" || v === "scoring-play" || v === "walk-off";
          }), playerIds, taxonomy, hasPlayback: !!pickPlayback(clip.playbacks) };
        })
      };
    });
    const text = JSON.stringify({ pendingFeedItems: pendingItems, liveContentCache: cacheOut }, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flash("\u2713 Copied!");
      }).catch(function() {
        if (typeof window !== "undefined" && window.fallbackCopy) window.fallbackCopy(text);
        flash("\u2713 Copied (fallback)");
      });
    } else {
      if (typeof window !== "undefined" && window.fallbackCopy) window.fallbackCopy(text);
      flash("\u2713 Copied (fallback)");
    }
  }

  // src/dev/recorder.js
  var SOFT_CAP_BYTES = 5 * 1024 * 1024;
  var HARD_CAP_BYTES = 10 * 1024 * 1024;
  var SNAPSHOT_INTERVAL_MS = 3e4;
  var STATUS_INTERVAL_MS = 5e3;
  var PITCH_CAP_PER_GAME = 5e3;
  var CONTENT_CAP_PER_GAME = 200;
  var BOXSCORE_CAP_PER_GAME = 10;
  var FEED_BASELINE_CAP = 200;
  function deepClone(x) {
    if (x === null || typeof x !== "object") return x;
    if (x instanceof Date) return new Date(x.getTime());
    if (x instanceof Set) return Array.from(x);
    if (Array.isArray(x)) return x.map(deepClone);
    const out = {};
    for (const k in x) {
      if (Object.prototype.hasOwnProperty.call(x, k)) out[k] = deepClone(x[k]);
    }
    return out;
  }
  function tsNow() {
    return Date.now();
  }
  function trimClip(clip) {
    if (!clip) return clip;
    const trimmed = {
      id: clip.id,
      headline: clip.headline,
      blurb: clip.blurb,
      date: clip.date,
      type: clip.type,
      keywordsAll: clip.keywordsAll
      // full — needed for player_id match + filters
    };
    if (clip.playbacks && clip.playbacks.length) {
      const mp4 = clip.playbacks.find(function(p) {
        return p.name === "mp4Avc";
      });
      const any = mp4 || clip.playbacks.find(function(p) {
        return p.url && typeof p.url === "string" && p.url.endsWith(".mp4");
      });
      if (any) trimmed.playbacks = [{ name: any.name, url: any.url }];
    }
    if (clip.image) {
      const raw = clip.image.cuts;
      const cuts = Array.isArray(raw) ? raw : raw ? Object.values(raw) : [];
      if (cuts.length) {
        const c16 = cuts.filter(function(c) {
          return c.aspectRatio === "16:9" && (c.width || 0) >= 480;
        });
        c16.sort(function(a, b) {
          return (a.width || 0) - (b.width || 0);
        });
        let best = c16[0];
        if (!best) {
          const sorted = cuts.slice().sort(function(a, b) {
            return (b.width || 0) - (a.width || 0);
          });
          best = sorted[0];
        }
        if (best) {
          trimmed.image = { cuts: [{ src: best.src || best.url, width: best.width, aspectRatio: best.aspectRatio }] };
        }
      }
    }
    return trimmed;
  }
  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function downloadFilename() {
    const d = /* @__PURE__ */ new Date();
    return "daily-events-" + d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "-" + pad2(d.getHours()) + pad2(d.getMinutes()) + ".json";
  }
  var Recorder = {
    active: false,
    data: null,
    snapshotTimer: null,
    statusTimer: null,
    startedAt: 0,
    capWarned: false,
    start: function() {
      if (Recorder.active) return;
      const startTs = tsNow();
      let baselineFeed = state.feedItems || [];
      if (baselineFeed.length > FEED_BASELINE_CAP) {
        baselineFeed = baselineFeed.slice(0, FEED_BASELINE_CAP);
      }
      Recorder.data = {
        metadata: {
          recorderVersion: 2,
          startedAt: startTs,
          season: typeof window !== "undefined" && window.SEASON || null
        },
        // Live game state + feed (overwritten/appended over time)
        gameStates: deepClone(state.gameStates || {}),
        feedItems: baselineFeed.map(function(it) {
          return { gamePk: it.gamePk, data: deepClone(it.data), ts: it.ts ? it.ts.getTime() : tsNow() };
        }),
        scheduleData: deepClone(state.scheduleData || []),
        // Pitch + boxscore — start empty, fill from observers (raw playByPlay
        // not retained between polls so backfill isn't possible)
        pitchTimeline: {},
        boxscoreSnapshots: {},
        // Video clip cache — unified timeline. Pre-existing liveContentCache
        // entries fold in as a single t=startTs entry (trimmed to demo essentials).
        // No separate baseline field. yesterdayContentCache dropped — out of demo
        // replay scope (Yesterday Recap is its own UI surface, not part of demo).
        contentCacheTimeline: {},
        lastVideoClip: state.lastVideoClip ? trimClip(state.lastVideoClip) : null,
        // Story-cache snapshots — overwritten on each 30s tick (latest only,
        // constant size — these are derived caches, not append-only)
        caches: {},
        // Focus mode tracking
        focusStatsCache: deepClone(state.focusStatsCache || {}),
        focusTrack: [{
          ts: startTs,
          focusGamePk: state.focusGamePk || null,
          isManual: !!state.focusIsManual,
          tensionLabel: state.focusState && state.focusState.tensionLabel || null
        }]
      };
      const existingContent = state.liveContentCache || {};
      Object.keys(existingContent).forEach(function(pk) {
        const entry = existingContent[pk];
        const items = entry && entry.items || [];
        if (!items.length) return;
        Recorder.data.contentCacheTimeline[pk] = [{
          ts: startTs,
          items: items.map(trimClip)
        }];
      });
      Recorder._snapshotCaches();
      Recorder.startedAt = startTs;
      Recorder.capWarned = false;
      Recorder.active = true;
      Recorder.snapshotTimer = setInterval(Recorder._snapshotCaches, SNAPSHOT_INTERVAL_MS);
      Recorder.statusTimer = setInterval(Recorder._updateStatus, STATUS_INTERVAL_MS);
      Recorder._updateStatus();
      Recorder._updateButtonState();
    },
    stop: function() {
      if (!Recorder.active) return;
      Recorder.active = false;
      if (Recorder.snapshotTimer) {
        clearInterval(Recorder.snapshotTimer);
        Recorder.snapshotTimer = null;
      }
      if (Recorder.statusTimer) {
        clearInterval(Recorder.statusTimer);
        Recorder.statusTimer = null;
      }
      if (Recorder.data) {
        Recorder.data.scheduleData = deepClone(state.scheduleData || []);
        Recorder.data.lastVideoClip = state.lastVideoClip ? trimClip(state.lastVideoClip) : Recorder.data.lastVideoClip;
        Recorder.data.metadata.exportedAt = tsNow();
        Recorder.data.metadata.durationMs = Recorder.data.metadata.exportedAt - Recorder.startedAt;
      }
      Recorder._updateStatus();
      Recorder._updateButtonState();
    },
    // Stamp metadata.exportedAt + durationMs at export time so mid-run
    // downloads carry an accurate "snapshot taken at" timestamp without
    // disturbing the running recording.
    _stampExportMetadata: function() {
      if (!Recorder.data) return;
      const now = tsNow();
      Recorder.data.metadata.exportedAt = now;
      Recorder.data.metadata.durationMs = now - Recorder.startedAt;
      Recorder.data.metadata.midRun = Recorder.active;
    },
    reset: function() {
      if (Recorder.active) return;
      Recorder.data = null;
      Recorder.startedAt = 0;
      Recorder.capWarned = false;
      Recorder._updateStatus();
      Recorder._updateButtonState();
    },
    download: function() {
      if (!Recorder.data) return;
      Recorder._stampExportMetadata();
      const blob = new Blob([JSON.stringify(Recorder.data)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename();
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 1e3);
    },
    copy: function() {
      if (!Recorder.data) return;
      Recorder._stampExportMetadata();
      const text = JSON.stringify(Recorder.data);
      function flash(msg) {
        const btn = document.getElementById("recorderCopyBtn");
        if (!btn) return;
        const orig = btn.textContent;
        btn.textContent = msg;
        setTimeout(function() {
          btn.textContent = orig;
        }, 1500);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function() {
            flash("\u2713 Copied!");
          },
          function() {
            Recorder._fallbackCopy(text);
            flash("\u2713 Copied (fallback)");
          }
        );
      } else {
        Recorder._fallbackCopy(text);
        flash("\u2713 Copied (fallback)");
      }
    },
    _fallbackCopy: function(text) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (e) {
      }
      document.body.removeChild(ta);
    },
    // ── Observer hooks (called from existing live functions) ─────────────────
    // Each hook is guarded by `if (window.Recorder && window.Recorder.active)`
    // at the call site so this is zero-cost when disabled.
    _captureGameStates: function() {
      if (!Recorder.data) return;
      Recorder.data.gameStates = deepClone(state.gameStates || {});
    },
    _captureFeedItem: function(item) {
      if (!Recorder.data) return;
      const entry = {
        gamePk: item.gamePk,
        data: deepClone(item.data),
        ts: item.ts ? item.ts.getTime() : tsNow()
      };
      const arr = Recorder.data.feedItems;
      for (let i = arr.length - 1; i >= Math.max(0, arr.length - 20); i--) {
        const e = arr[i];
        if (e.gamePk === entry.gamePk && e.ts === entry.ts && (e.data && entry.data && e.data.type === entry.data.type && (e.data.event || "") === (entry.data.event || ""))) {
          return;
        }
      }
      arr.push(entry);
      if (arr.length > 800) arr.shift();
    },
    _capturePlayPitches: function(play, gamePk, gameCtx) {
      if (!Recorder.data || !play || !play.about) return;
      const abIdx = play.about.atBatIndex;
      if (abIdx == null) return;
      const pitchEvents = (play.playEvents || []).filter(function(e) {
        return e.isPitch || e.type === "pitch";
      });
      if (!pitchEvents.length) return;
      const envelope = {
        atBatIndex: abIdx,
        ts: play.about.endTime ? new Date(play.about.endTime).getTime() : tsNow(),
        batterId: play.matchup && play.matchup.batter && play.matchup.batter.id || null,
        batterName: play.matchup && play.matchup.batter && play.matchup.batter.fullName || "",
        pitcherId: play.matchup && play.matchup.pitcher && play.matchup.pitcher.id || null,
        pitcherName: play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName || "",
        balls: play.count && play.count.balls || 0,
        strikes: play.count && play.count.strikes || 0,
        outs: play.count && play.count.outs || 0,
        inning: play.about && play.about.inning || gameCtx && gameCtx.inning || 0,
        halfInning: play.about && play.about.halfInning || gameCtx && gameCtx.halfInning || "top",
        onFirst: !!(gameCtx && gameCtx.onFirst),
        onSecond: !!(gameCtx && gameCtx.onSecond),
        onThird: !!(gameCtx && gameCtx.onThird),
        awayScore: play.result && play.result.awayScore != null ? play.result.awayScore : gameCtx && gameCtx.awayScore || 0,
        homeScore: play.result && play.result.homeScore != null ? play.result.homeScore : gameCtx && gameCtx.homeScore || 0,
        pitches: pitchEvents.map(function(e) {
          return {
            typeCode: e.details && e.details.type && e.details.type.code || "??",
            typeName: e.details && e.details.type && e.details.type.description || "",
            speed: e.pitchData && e.pitchData.startSpeed || null,
            resultCode: e.details && e.details.code || "",
            resultDesc: e.details && e.details.description || "",
            sequenceIndex: e.pitchNumber || 0,
            eventTs: e.startTime ? new Date(e.startTime).getTime() : null,
            // Per-pitch count from MLB's playEvents[i].count. Demo's pitch
            // sub-tick uses these to animate balls/strikes mid-AB instead of
            // re-deriving from resultCode (which gets hairy for fouls on 2 strikes).
            ballsAfter: e.count && e.count.balls != null ? e.count.balls : null,
            strikesAfter: e.count && e.count.strikes != null ? e.count.strikes : null,
            outsAfter: e.count && e.count.outs != null ? e.count.outs : null
          };
        })
      };
      Recorder._mergePitchEnvelope(gamePk, envelope);
    },
    // High-fidelity pitch capture from pollFocusRich (5s GUMBO). Same
    // pitchTimeline target — merge by atBatIndex; 5s data wins over 15s.
    _captureFocusPitches: function(currentPlay, gamePk) {
      if (!Recorder.data || !currentPlay) return;
      const g = state.gameStates[gamePk] || {};
      Recorder._capturePlayPitches(currentPlay, gamePk, g);
    },
    _mergePitchEnvelope: function(gamePk, envelope) {
      if (!Recorder.data.pitchTimeline[gamePk]) Recorder.data.pitchTimeline[gamePk] = [];
      const arr = Recorder.data.pitchTimeline[gamePk];
      const existing = arr.findIndex(function(e) {
        return e.atBatIndex === envelope.atBatIndex;
      });
      if (existing === -1) {
        arr.push(envelope);
      } else if ((envelope.pitches || []).length >= (arr[existing].pitches || []).length) {
        arr[existing] = envelope;
      }
      if (arr.length > PITCH_CAP_PER_GAME) {
        const dropped = arr.splice(0, arr.length - PITCH_CAP_PER_GAME);
        Recorder._note("\u26A0 pitch cap hit \xB7 gamePk=" + gamePk + " dropped=" + dropped.length);
      }
    },
    _captureContentDelta: function(gamePk, items) {
      if (!Recorder.data) return;
      if (!Recorder.data.contentCacheTimeline[gamePk]) Recorder.data.contentCacheTimeline[gamePk] = [];
      const arr = Recorder.data.contentCacheTimeline[gamePk];
      arr.push({ ts: tsNow(), items: (items || []).map(trimClip) });
      if (arr.length > CONTENT_CAP_PER_GAME) arr.shift();
    },
    _captureBoxscore: function(gamePk, bs) {
      if (!Recorder.data || !bs) return;
      if (!Recorder.data.boxscoreSnapshots[gamePk]) Recorder.data.boxscoreSnapshots[gamePk] = [];
      const arr = Recorder.data.boxscoreSnapshots[gamePk];
      arr.push({ ts: tsNow(), data: deepClone(bs) });
      if (arr.length > BOXSCORE_CAP_PER_GAME) arr.shift();
    },
    _captureFocusStat: function(playerId, group, stats) {
      if (!Recorder.data || !playerId) return;
      Recorder.data.focusStatsCache[playerId] = deepClone(stats);
    },
    _captureFocusTrack: function() {
      if (!Recorder.data) return;
      const entry = {
        ts: tsNow(),
        focusGamePk: state.focusGamePk || null,
        isManual: !!state.focusIsManual,
        tensionLabel: state.focusState && state.focusState.tensionLabel || null
      };
      const arr = Recorder.data.focusTrack;
      const last = arr[arr.length - 1];
      if (last && last.focusGamePk === entry.focusGamePk && last.isManual === entry.isManual && last.tensionLabel === entry.tensionLabel) {
        return;
      }
      arr.push(entry);
      if (arr.length > 4e3) arr.shift();
    },
    _snapshotCaches: function() {
      if (!Recorder.data) return;
      Recorder.data.caches = {
        dailyLeadersCache: deepClone(state.dailyLeadersCache),
        onThisDayCache: deepClone(state.onThisDayCache),
        yesterdayCache: deepClone(state.yesterdayCache),
        hrBatterStatsCache: deepClone(state.hrBatterStatsCache),
        probablePitcherStatsCache: deepClone(state.probablePitcherStatsCache),
        storyCarouselRawGameData: deepClone(state.storyCarouselRawGameData),
        dailyHitsTracker: deepClone(state.dailyHitsTracker),
        dailyPitcherKs: deepClone(state.dailyPitcherKs),
        stolenBaseEvents: deepClone(state.stolenBaseEvents || []),
        transactionsCache: deepClone(state.transactionsCache || []),
        liveWPCache: deepClone(state.liveWPCache || {}),
        perfectGameTracker: deepClone(state.perfectGameTracker || {}),
        highLowCache: deepClone(state.highLowCache)
      };
    },
    // ── UI ───────────────────────────────────────────────────────────────────
    _updateStatus: function() {
      const el = document.getElementById("recorderStatus");
      if (!el) return;
      if (!Recorder.data) {
        el.textContent = "Idle. Click Start to begin capture.";
        el.style.color = "var(--muted)";
        return;
      }
      let bytes = 0;
      try {
        bytes = JSON.stringify(Recorder.data).length;
      } catch (e) {
        bytes = -1;
      }
      const games = Object.keys(Recorder.data.gameStates || {}).length;
      const feedCount = (Recorder.data.feedItems || []).length;
      let pitchTotal = 0, clipTotal = 0;
      for (const pk in Recorder.data.pitchTimeline) {
        pitchTotal += (Recorder.data.pitchTimeline[pk] || []).reduce(function(s, ab) {
          return s + (ab.pitches || []).length;
        }, 0);
      }
      for (const ck in Recorder.data.contentCacheTimeline) {
        clipTotal += (Recorder.data.contentCacheTimeline[ck] || []).length;
      }
      const elapsedMs = Recorder.active ? tsNow() - Recorder.startedAt : Recorder.data.metadata && Recorder.data.metadata.durationMs || 0;
      const mins = Math.floor(elapsedMs / 6e4);
      const secs = Math.floor(elapsedMs % 6e4 / 1e3);
      const mb = (bytes / (1024 * 1024)).toFixed(2);
      let pitchHint = "";
      if (Recorder.active && pitchTotal === 0) pitchHint = " \xB7 Pitch data: starts on next poll";
      const stateLabel = Recorder.active ? "Recording" : "Stopped";
      el.textContent = stateLabel + " \xB7 " + mins + "m " + pad2(secs) + "s \xB7 " + games + " games \xB7 " + feedCount + " plays \xB7 " + pitchTotal + " pitches \xB7 " + clipTotal + " clips \xB7 " + mb + " MB" + pitchHint;
      if (bytes >= HARD_CAP_BYTES) {
        el.style.color = "#ff6464";
        if (Recorder.active) {
          Recorder.stop();
          try {
            alert("Recorder hit 10 MB hard cap \u2014 auto-stopped to protect tab. Download to keep, or Reset to discard.");
          } catch (e) {
          }
        }
      } else if (bytes >= SOFT_CAP_BYTES) {
        el.style.color = "#f59e0b";
        if (!Recorder.capWarned) {
          Recorder.capWarned = true;
          Recorder._note("\u26A0 over 5 MB \u2014 consider stopping soon (10 MB hard cap)");
        }
      } else {
        el.style.color = Recorder.active ? "#22c55e" : "var(--text)";
      }
    },
    _updateButtonState: function() {
      const toggleBtn = document.getElementById("recorderToggleBtn");
      const copyBtn = document.getElementById("recorderCopyBtn");
      const dlBtn = document.getElementById("recorderDownloadBtn");
      const resetBtn = document.getElementById("recorderResetBtn");
      if (toggleBtn) toggleBtn.textContent = Recorder.active ? "\u23F9 Stop Recording" : "\u23FA Start Recording";
      const hasData = !!Recorder.data;
      if (copyBtn) copyBtn.disabled = !hasData;
      if (dlBtn) dlBtn.disabled = !hasData;
      if (resetBtn) resetBtn.disabled = Recorder.active;
    },
    _note: function(msg) {
      const el = document.getElementById("recorderStatusNote");
      if (!el) return;
      el.textContent = msg;
      el.style.color = "#f59e0b";
      setTimeout(function() {
        if (el.textContent === msg) el.textContent = "";
      }, 6e3);
    },
    toggle: function() {
      if (Recorder.active) Recorder.stop();
      else Recorder.start();
    }
  };
  if (typeof window !== "undefined") window.Recorder = Recorder;

  // src/dev/panels.js
  var _buildStoryPool = null;
  var _fallbackCopy = null;
  function escapeHtml3(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function setPanelsCallbacks(cbs) {
    if (cbs.buildStoryPool) _buildStoryPool = cbs.buildStoryPool;
    if (cbs.fallbackCopy) _fallbackCopy = cbs.fallbackCopy;
  }
  function fallbackCopy2(text) {
    if (_fallbackCopy) return _fallbackCopy(text);
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
    }
    document.body.removeChild(ta);
  }
  function _logLevelRank(lvl) {
    return lvl === "error" ? 3 : lvl === "warn" ? 2 : 1;
  }
  function _fmtLogTs(ts) {
    const d = new Date(ts);
    const pad = function(n) {
      return n < 10 ? "0" + n : "" + n;
    };
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) + "." + String(d.getMilliseconds()).padStart(3, "0");
  }
  function _filteredDevLog() {
    const levelSel = (document.getElementById("logCaptureLevel") || {}).value || "all";
    const filter = ((document.getElementById("logCaptureFilter") || {}).value || "").trim().toLowerCase();
    const minRank = levelSel === "all" ? 0 : _logLevelRank(levelSel);
    return devLog.filter(function(e) {
      if (minRank && _logLevelRank(e.level) < minRank) return false;
      if (filter) {
        const hay = (e.msg + " " + e.src + " " + e.level).toLowerCase();
        if (hay.indexOf(filter) === -1) return false;
      }
      return true;
    });
  }
  function renderLogCapture() {
    const list = document.getElementById("logCaptureList");
    const count = document.getElementById("logCaptureCount");
    if (!list) return;
    if (count) count.textContent = "(" + devLog.length + ")";
    const rows = _filteredDevLog().slice(-200);
    if (!rows.length) {
      list.innerHTML = '<div class="dt-label-muted" style="padding:4px 0">No log entries match.</div>';
      return;
    }
    list.innerHTML = rows.slice().reverse().map(function(e) {
      const cls = "dt-log-row" + (e.level === "error" ? " lv-error" : e.level === "warn" ? " lv-warn" : "");
      const tag = e.src ? '<span class="lv-tag">[' + escapeHtml3(e.src) + "]</span>" : "";
      return '<div class="' + cls + '"><span class="lv-ts">' + _fmtLogTs(e.ts) + "</span>" + tag + escapeHtml3(e.msg) + "</div>";
    }).join("");
  }
  function copyLogAsMarkdown() {
    const rows = _filteredDevLog();
    const lines = ["# MLB Pulse \u2014 Log Capture", "Captured: " + (/* @__PURE__ */ new Date()).toISOString(), "Total entries: " + devLog.length + " (showing " + rows.length + " after filter)", ""];
    if (!rows.length) {
      lines.push("_(empty)_");
    } else {
      lines.push("| time | level | src | message |");
      lines.push("|---|---|---|---|");
      rows.forEach(function(e) {
        const msg = e.msg.replace(/\|/g, "\\|").replace(/\n/g, " \u21B5 ");
        lines.push("| " + _fmtLogTs(e.ts) + " | " + e.level + " | " + (e.src || "-") + " | " + msg + " |");
      });
    }
    const text = lines.join("\n");
    const btn = document.getElementById("logCaptureCopyBtn");
    function flash(msg) {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = msg;
      btn.style.background = "#1f7a3a";
      setTimeout(function() {
        btn.textContent = orig;
        btn.style.background = "";
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flash("\u2713 Copied!");
      }, function() {
        fallbackCopy2(text);
        flash("\u2713 Copied (fallback)");
      });
    } else {
      fallbackCopy2(text);
      flash("\u2713 Copied (fallback)");
    }
  }
  function clearDevLog() {
    devLog.length = 0;
    renderLogCapture();
  }
  function _stateGameRow(g) {
    if (!g) return "\u2014";
    const matchup = (g.awayAbbr || "?") + " " + g.awayScore + " @ " + (g.homeAbbr || "?") + " " + g.homeScore;
    const inn = g.status === "Live" ? " \xB7 " + (g.halfInning || "") + " " + (g.inning || "?") + " (" + g.outs + "o)" : "";
    const bases = g.onFirst || g.onSecond || g.onThird ? " \xB7 \u{1F3C3}" + (g.onFirst ? "1" : "\xB7") + (g.onSecond ? "2" : "\xB7") + (g.onThird ? "3" : "\xB7") : "";
    return matchup + " \xB7 " + g.status + (g.detailedState && g.detailedState !== g.status ? " (" + g.detailedState + ")" : "") + inn + bases;
  }
  function _stateContext() {
    const t = typeof state.activeTeam !== "undefined" && state.activeTeam || {};
    let section = "?";
    try {
      const s = document.querySelector(".section.active");
      if (s) section = s.id;
    } catch (e) {
    }
    return {
      version: true ? "v4.31.2" : "?",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      activeTeam: t.id ? t.short + " (id:" + t.id + ")" : "?",
      section,
      demoMode: typeof state.demoMode !== "undefined" ? !!state.demoMode : "?",
      pulseInitialized: typeof state.pulseInitialized !== "undefined" ? !!state.pulseInitialized : "?",
      pulseColorScheme: "?",
      themeScope: typeof state.themeScope !== "undefined" ? state.themeScope : "?",
      themeOverride: typeof state.themeOverride !== "undefined" && state.themeOverride ? state.themeOverride.short || "set" : null,
      themeInvert: typeof state.themeInvert !== "undefined" ? !!state.themeInvert : "?",
      devColorLocked: typeof state.devColorLocked !== "undefined" ? !!state.devColorLocked : "?",
      radioCurrentTeamId: getCurrentTeamId(),
      focusGamePk: typeof state.focusGamePk !== "undefined" ? state.focusGamePk : null,
      focusIsManual: typeof state.focusIsManual !== "undefined" ? !!state.focusIsManual : "?",
      counts: {
        gameStates: typeof state.gameStates !== "undefined" ? Object.keys(state.gameStates).length : 0,
        feedItems: typeof state.feedItems !== "undefined" ? state.feedItems.length : 0,
        storyPool: typeof state.storyPool !== "undefined" ? state.storyPool.length : 0,
        enabledGames: typeof state.enabledGames !== "undefined" ? state.enabledGames.size : 0,
        devLog: devLog.length
      },
      viewport: window.innerWidth + "\xD7" + window.innerHeight,
      userAgent: navigator.userAgent
    };
  }
  function _stateGameStatesArr() {
    if (typeof state.gameStates === "undefined") return [];
    return Object.keys(state.gameStates).map(function(pk) {
      const g = state.gameStates[pk];
      return {
        gamePk: +pk,
        status: g.status,
        detailedState: g.detailedState,
        matchup: (g.awayAbbr || "?") + "@" + (g.homeAbbr || "?"),
        score: (g.awayScore || 0) + "-" + (g.homeScore || 0),
        inning: (g.halfInning || "") + (g.inning || ""),
        outs: g.outs,
        bases: (g.onFirst ? "1" : "") + (g.onSecond ? "2" : "") + (g.onThird ? "3" : ""),
        hits: (g.awayHits || 0) + "-" + (g.homeHits || 0),
        enabled: typeof state.enabledGames !== "undefined" ? state.enabledGames.has(+pk) : null
      };
    }).sort(function(a, b) {
      const rank = function(s) {
        return s === "Live" ? 0 : s === "Preview" || s === "Scheduled" ? 1 : 2;
      };
      return rank(a.status) - rank(b.status);
    });
  }
  function _stateFeedItemsArr(limit) {
    if (typeof state.feedItems === "undefined") return [];
    return state.feedItems.slice(0, limit || 50).map(function(fi) {
      const d = fi.data || {};
      return {
        ts: fi.ts ? fi.ts.toISOString() : null,
        gamePk: fi.gamePk,
        type: d.type,
        label: d.label || d.event || "",
        desc: (d.desc || d.sub || "").slice(0, 200),
        scoring: !!d.scoring,
        score: (d.awayScore != null ? d.awayScore : "") + (d.homeScore != null ? "-" + d.homeScore : ""),
        inning: d.halfInning ? d.halfInning + " " + (d.inning || "") : null
      };
    });
  }
  function _stateStoryPoolArr() {
    if (typeof state.storyPool === "undefined") return [];
    return state.storyPool.map(function(s) {
      let cdRem = null;
      if (s.lastShown && s.cooldownMs) {
        const rem = s.cooldownMs - (Date.now() - s.lastShown);
        cdRem = rem > 0 ? Math.round(rem / 1e3) + "s" : "ready";
      }
      return {
        id: s.id,
        type: s.type,
        tier: s.tier,
        priority: s.priority,
        headline: s.headline,
        gamePk: s.gamePk,
        cooldownRem: cdRem,
        lastShownAgo: s.lastShown ? Math.round((Date.now() - s.lastShown) / 1e3) + "s" : null,
        isShown: s.id === state.storyShownId
      };
    }).sort(function(a, b) {
      return (b.priority || 0) - (a.priority || 0);
    });
  }
  function _stateFocusObj() {
    return {
      focusGamePk: typeof state.focusGamePk !== "undefined" ? state.focusGamePk : null,
      focusIsManual: typeof state.focusIsManual !== "undefined" ? !!state.focusIsManual : "?",
      focusedGame: typeof state.focusGamePk !== "undefined" && state.focusGamePk && typeof state.gameStates !== "undefined" && state.gameStates[state.focusGamePk] ? _stateGameRow(state.gameStates[state.focusGamePk]) : null
    };
  }
  function _kvList(obj) {
    return Object.keys(obj).map(function(k) {
      const v = obj[k];
      let disp = v == null ? "\u2014" : typeof v === "object" ? JSON.stringify(v) : String(v);
      if (disp.length > 200) disp = disp.slice(0, 200) + "\u2026";
      return '<div style="display:flex;gap:8px;padding:1px 0"><span style="color:var(--muted);min-width:120px">' + escapeHtml3(k) + "</span><span>" + escapeHtml3(disp) + "</span></div>";
    }).join("");
  }
  function _miniCopyBtn(action) {
    return '<button data-dt-action="' + action + '" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer;font-weight:600">\u{1F4CB}</button>';
  }
  function _section(title, action, body) {
    return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><span class="dt-label">' + title + "</span>" + _miniCopyBtn(action) + "</div>" + body + "</div>";
  }
  function renderAppState() {
    const body = document.getElementById("appStateBody");
    if (!body) return;
    const ctx = _stateContext();
    const c = document.getElementById("appStateCounts");
    if (c) c.textContent = "(" + ctx.counts.gameStates + "g \xB7 " + ctx.counts.feedItems + "f \xB7 " + ctx.counts.storyPool + "s)";
    const gs = _stateGameStatesArr();
    const gsBody = gs.length ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">' + gs.map(function(g) {
      return '<div class="dt-log-row">' + escapeHtml3(g.matchup) + " \xB7 " + escapeHtml3(g.status) + " \xB7 " + escapeHtml3(g.score) + (g.inning ? " \xB7 " + escapeHtml3(g.inning) + " (" + g.outs + "o)" : "") + (g.bases ? " \xB7 \u{1F3C3}" + escapeHtml3(g.bases) : "") + (g.enabled === false ? ' <span class="lv-tag">[hidden]</span>' : "") + "</div>";
    }).join("") + "</div>" : '<div class="dt-label-muted">No games loaded.</div>';
    const fi = _stateFeedItemsArr(30);
    const fiBody = fi.length ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">' + fi.map(function(f) {
      const ts = f.ts ? f.ts.slice(11, 19) : "";
      return '<div class="dt-log-row"><span class="lv-ts">' + escapeHtml3(ts) + '</span><span class="lv-tag">[' + escapeHtml3(String(f.type || "?")) + "]</span>" + escapeHtml3(f.label || f.desc || "") + (f.scoring ? " \u2B50" : "") + "</div>";
    }).join("") + "</div>" : '<div class="dt-label-muted">Feed empty.</div>';
    const sp = _stateStoryPoolArr();
    const spBody = sp.length ? '<div class="dt-mono" style="max-height:160px;overflow-y:auto">' + sp.map(function(s) {
      return '<div class="dt-log-row' + (s.isShown ? " lv-warn" : "") + '"><span class="lv-tag">p' + (s.priority || 0) + '</span><span class="lv-tag">[' + escapeHtml3(String(s.type || "?")) + "]</span>" + escapeHtml3(s.headline || "") + (s.cooldownRem ? ' <span class="lv-ts">(' + escapeHtml3(s.cooldownRem) + ")</span>" : "") + (s.isShown ? " \u25C0 shown" : "") + "</div>";
    }).join("") + "</div>" : '<div class="dt-label-muted">Story pool empty.</div>';
    const ctxBody = '<div style="font-size:.65rem">' + _kvList({
      version: ctx.version,
      section: ctx.section,
      activeTeam: ctx.activeTeam,
      demoMode: ctx.demoMode,
      pulseInitialized: ctx.pulseInitialized,
      pulseColorScheme: ctx.pulseColorScheme,
      themeScope: ctx.themeScope,
      themeOverride: ctx.themeOverride,
      themeInvert: ctx.themeInvert,
      devColorLocked: ctx.devColorLocked,
      radioCurrentTeamId: ctx.radioCurrentTeamId,
      focusGamePk: ctx.focusGamePk,
      focusIsManual: ctx.focusIsManual,
      viewport: ctx.viewport
    }) + "</div>";
    const focusBody = '<div style="font-size:.65rem">' + _kvList(_stateFocusObj()) + "</div>";
    const now = /* @__PURE__ */ new Date();
    const upcoming = Object.values(state.gameStates).filter(function(g) {
      if (!(g.status === "Preview" || g.status === "Scheduled" || g.status === "Live" && (g.detailedState === "Warmup" || g.detailedState === "Pre-Game"))) return false;
      const rawG = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
      if (rawG && rawG.doubleHeader === "Y" && rawG.gameNumber == 2) {
        if (Object.values(state.gameStates).some(function(s) {
          return s.status === "Live" && s.awayId === g.awayId && s.homeId === g.homeId;
        })) return false;
      }
      return true;
    });
    upcoming.sort(function(a, b) {
      return (a.gameDateMs || 0) - (b.gameDateMs || 0);
    });
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const nextDiffMs = upcoming.length && upcoming[0].gameDateMs ? upcoming[0].gameDateMs - Date.now() : 0;
    const pulseInfo = {
      now: now.toISOString().split("T")[1].split(".")[0],
      headline: hypeHeadline(nextDiffMs),
      liveGames: liveGames.length,
      upcomingGames: upcoming.length,
      enabledGames: state.enabledGames.size,
      totalGames: Object.keys(state.gameStates).length
    };
    const pulseBody = '<div style="font-size:.65rem">' + _kvList(pulseInfo) + "</div>";
    body.innerHTML = _section("Context", "copyStateContext", ctxBody) + _section("\u26A1 Pulse Diagnostics", "copyStatePulse", pulseBody) + _section("\u{1F3AF} Focus", "copyStateFocus", focusBody) + _section("\u{1F3AE} state.gameStates (" + gs.length + ")", "copyStateGames", gsBody) + _section("\u{1F4F0} state.feedItems (showing " + fi.length + " of " + ctx.counts.feedItems + ")", "copyStateFeed", fiBody) + _section("\u{1F4D6} state.storyPool (" + sp.length + ")", "copyStateStories", spBody);
  }
  function _copyToClipboard(text, btnId) {
    const btn = btnId ? document.getElementById(btnId) : null;
    function flash(msg) {
      if (!btn) return;
      const orig = btn.textContent;
      btn.textContent = msg;
      btn.style.background = "#1f7a3a";
      setTimeout(function() {
        btn.textContent = orig;
        btn.style.background = "";
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        flash("\u2713 Copied!");
      }, function() {
        fallbackCopy2(text);
        flash("\u2713 Copied (fb)");
      });
    } else {
      fallbackCopy2(text);
      flash("\u2713 Copied (fb)");
    }
  }
  function _stateAsMarkdownContext() {
    const c = _stateContext();
    return "## Context\n\n```json\n" + JSON.stringify(c, null, 2) + "\n```\n";
  }
  function _stateAsMarkdownGames() {
    const gs = _stateGameStatesArr();
    if (!gs.length) return "## state.gameStates\n\n_(empty)_\n";
    const lines = ["## state.gameStates (" + gs.length + ")", "", "| gamePk | matchup | status | score | inning | bases | hits | enabled |", "|---|---|---|---|---|---|---|---|"];
    gs.forEach(function(g) {
      lines.push("| " + g.gamePk + " | " + g.matchup + " | " + g.status + (g.detailedState && g.detailedState !== g.status ? " (" + g.detailedState + ")" : "") + " | " + g.score + " | " + (g.inning || "-") + (g.outs != null ? " " + g.outs + "o" : "") + " | " + (g.bases || "-") + " | " + g.hits + " | " + (g.enabled == null ? "-" : g.enabled ? "y" : "n") + " |");
    });
    return lines.join("\n") + "\n";
  }
  function _stateAsMarkdownFeed(limit) {
    const fi = _stateFeedItemsArr(limit || 50);
    if (!fi.length) return "## state.feedItems\n\n_(empty)_\n";
    const lines = ["## state.feedItems (" + fi.length + (typeof state.feedItems !== "undefined" && state.feedItems.length > fi.length ? " of " + state.feedItems.length : "") + ")", "", "| time | gamePk | type | label/desc | scoring |", "|---|---|---|---|---|"];
    fi.forEach(function(f) {
      const ts = f.ts ? f.ts.slice(11, 19) : "-";
      const msg = (f.label || f.desc || "").replace(/\|/g, "\\|").replace(/\n/g, " \u21B5 ");
      lines.push("| " + ts + " | " + f.gamePk + " | " + (f.type || "-") + " | " + msg + " | " + (f.scoring ? "y" : "") + " |");
    });
    return lines.join("\n") + "\n";
  }
  function _stateAsMarkdownStories() {
    const sp = _stateStoryPoolArr();
    if (!sp.length) return "## state.storyPool\n\n_(empty)_\n";
    const lines = ["## state.storyPool (" + sp.length + ")", "", "| priority | type | tier | headline | cooldown | shown |", "|---|---|---|---|---|---|"];
    sp.forEach(function(s) {
      lines.push("| " + (s.priority || 0) + " | " + (s.type || "-") + " | " + (s.tier || "-") + " | " + (s.headline || "").replace(/\|/g, "\\|") + " | " + (s.cooldownRem || "-") + " | " + (s.isShown ? "\u25C0" : "") + " |");
    });
    return lines.join("\n") + "\n";
  }
  function _stateAsMarkdownFocus() {
    return "## Focus\n\n```json\n" + JSON.stringify(_stateFocusObj(), null, 2) + "\n```\n";
  }
  function _stateAsMarkdownPulse() {
    const now = /* @__PURE__ */ new Date();
    const hour = now.getHours();
    const upcoming = Object.values(state.gameStates).filter(function(g) {
      if (!(g.status === "Preview" || g.status === "Scheduled" || g.status === "Live" && (g.detailedState === "Warmup" || g.detailedState === "Pre-Game"))) return false;
      const rawG = state.storyCarouselRawGameData && state.storyCarouselRawGameData[g.gamePk];
      if (rawG && rawG.doubleHeader === "Y" && rawG.gameNumber == 2) {
        if (Object.values(state.gameStates).some(function(s) {
          return s.status === "Live" && s.awayId === g.awayId && s.homeId === g.homeId;
        })) return false;
      }
      return true;
    });
    upcoming.sort(function(a, b) {
      return (a.gameDateMs || 0) - (b.gameDateMs || 0);
    });
    const liveGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Live" && g.detailedState !== "Warmup" && g.detailedState !== "Pre-Game";
    });
    const finalGames = Object.values(state.gameStates).filter(function(g) {
      return g.status === "Final";
    });
    const nextDiffMs = upcoming.length && upcoming[0].gameDateMs ? upcoming[0].gameDateMs - Date.now() : 0;
    const lines = [
      "## Pulse Empty State Diagnostics",
      "",
      "### Current Time & Headline",
      "| Field | Value |",
      "|---|---|",
      "| Now | " + now.toISOString() + " |",
      "| Hour | " + hour + " |",
      "| Headline | " + hypeHeadline(nextDiffMs) + " |",
      "",
      "### Game Counts",
      "| State | Count |",
      "|---|---|",
      "| Total state.gameStates | " + Object.keys(state.gameStates).length + " |",
      "| Enabled Games | " + state.enabledGames.size + " |",
      "| Live (In Progress) | " + liveGames.length + " |",
      "| Preview/Scheduled (Upcoming) | " + upcoming.length + " |",
      "| Final | " + finalGames.length + " |",
      "",
      "### Why Empty State Shows",
      "| Reason | Active |",
      "|---|---|",
      "| No upcoming games found | " + (upcoming.length === 0 ? '**YES** \u2014 will show "Slate complete"' : "no") + " |",
      "| Has intermission flag | no |",
      "| Has live games | " + (liveGames.length > 0 ? "**YES** \u2014 empty state should not show" : "no") + " |",
      "",
      "### All Games in state.gameStates"
    ];
    const gameRows = ["| gamePk | matchup | status | detailed | enabled | inning |", "|---|---|---|---|---|---|"];
    Object.values(state.gameStates).sort(function(a, b) {
      return (a.gameDateMs || 0) - (b.gameDateMs || 0);
    }).forEach(function(g) {
      const enabled = state.enabledGames.has(g.gamePk) ? "\u2713" : "\u2717";
      const inning = g.status === "Live" ? " " + g.inning + "i (" + g.halfInning.charAt(0) + ")" : "-";
      gameRows.push("| " + g.gamePk + " | " + g.awayAbbr + " @ " + g.homeAbbr + " | " + g.status + " | " + g.detailedState + " | " + enabled + " | " + inning + " |");
    });
    return lines.join("\n") + "\n" + gameRows.join("\n") + "\n";
  }
  function copyAppStateAsMarkdown() {
    const parts = [
      "# MLB Pulse \u2014 App State Snapshot",
      "Captured: " + (/* @__PURE__ */ new Date()).toISOString(),
      "",
      _stateAsMarkdownPulse(),
      _stateAsMarkdownContext(),
      _stateAsMarkdownFocus(),
      _stateAsMarkdownGames(),
      _stateAsMarkdownFeed(50),
      _stateAsMarkdownStories()
    ];
    _copyToClipboard(parts.join("\n"), "appStateCopyBtn");
  }
  function _shortUrl(u) {
    if (!u) return "?";
    try {
      let parsed = new URL(u, window.location.href);
      const host = parsed.host || "";
      const path = parsed.pathname.replace(/^\/api\/v1(\.1)?/, "/v1$1");
      const q = parsed.search ? parsed.search.length > 40 ? parsed.search.slice(0, 40) + "\u2026" : parsed.search : "";
      return (host ? host + " " : "") + path + q;
    } catch (e) {
      return u.length > 120 ? u.slice(0, 120) + "\u2026" : u;
    }
  }
  function _fmtBytes(n) {
    if (n == null) return "-";
    if (n < 1024) return n + "b";
    if (n < 1048576) return (n / 1024).toFixed(1) + "k";
    return (n / 1048576).toFixed(2) + "M";
  }
  function renderNetTrace() {
    const list = document.getElementById("netTraceList");
    const count = document.getElementById("netTraceCount");
    if (!list) return;
    if (count) count.textContent = "(" + devNetLog.length + ")";
    if (!devNetLog.length) {
      list.innerHTML = '<div class="dt-label-muted" style="padding:4px 0">No fetches captured yet.</div>';
      return;
    }
    list.innerHTML = devNetLog.slice().reverse().map(function(e) {
      const ts = _fmtLogTs(e.ts);
      const st = e.status == null ? e.ok === false ? "ERR" : "\u2026" : e.status;
      let cls = "dt-log-row";
      if (e.ok === false) cls += " lv-error";
      else if (e.status >= 400) cls += " lv-error";
      else if (e.status >= 300) cls += " lv-warn";
      const ms = e.ms != null ? e.ms + "ms" : "-";
      const size = _fmtBytes(e.sizeBytes);
      const err = e.errorMsg ? '<div style="margin-left:24px;color:#ff6b6b">' + escapeHtml3(e.errorMsg) + "</div>" : "";
      return '<div class="' + cls + '" title="' + escapeHtml3(e.url || "") + '"><span class="lv-ts">' + ts + '</span><span class="lv-tag">' + escapeHtml3(e.method) + " " + st + '</span><span class="lv-ts">' + ms + " \xB7 " + size + "</span> " + escapeHtml3(_shortUrl(e.url)) + err + "</div>";
    }).join("");
  }
  function copyNetTraceAsMarkdown() {
    const lines = ["# MLB Pulse \u2014 Network Trace", "Captured: " + (/* @__PURE__ */ new Date()).toISOString(), "Total entries: " + devNetLog.length + " (cap " + DEV_NET_CAP + ")", ""];
    if (!devNetLog.length) {
      lines.push("_(empty)_");
    } else {
      lines.push("| time | method | status | ms | size | url |");
      lines.push("|---|---|---|---|---|---|");
      devNetLog.forEach(function(e) {
        const url = (e.url || "").replace(/\|/g, "\\|");
        const status = e.status == null ? e.ok === false ? "ERR" : "-" : e.status;
        const ms = e.ms != null ? e.ms : "-";
        const size = _fmtBytes(e.sizeBytes);
        lines.push("| " + _fmtLogTs(e.ts) + " | " + e.method + " | " + status + " | " + ms + " | " + size + " | " + url + " |");
      });
      const failed = devNetLog.filter(function(e) {
        return e.ok === false;
      });
      if (failed.length) {
        lines.push("", "## Failed requests (" + failed.length + ")", "");
        failed.forEach(function(e) {
          lines.push("- `" + e.method + " " + (e.status || "ERR") + "` " + e.url + (e.errorMsg ? " \u2014 " + e.errorMsg : ""));
        });
      }
    }
    _copyToClipboard(lines.join("\n"), "netTraceCopyBtn");
  }
  function clearNetTrace() {
    devNetLog.length = 0;
    renderNetTrace();
  }
  function _lsKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf("mlb_") === 0) keys.push(k);
      }
    } catch (e) {
    }
    keys.sort();
    return keys;
  }
  function _lsEntry(k) {
    let raw = null, parsed = null, isJson = false, bytes = 0;
    try {
      raw = localStorage.getItem(k);
    } catch (e) {
      raw = null;
    }
    if (raw != null) {
      bytes = raw.length;
      try {
        parsed = JSON.parse(raw);
        isJson = parsed !== null && typeof parsed === "object";
      } catch (e) {
      }
    }
    return { key: k, raw, parsed, isJson, bytes };
  }
  function renderStorageInspector() {
    const list = document.getElementById("storageList");
    const count = document.getElementById("storageCount");
    if (!list) return;
    const keys = _lsKeys();
    if (count) count.textContent = "(" + keys.length + ")";
    if (!keys.length) {
      list.innerHTML = '<div class="dt-label-muted">No mlb_* keys present.</div>';
      return;
    }
    list.innerHTML = keys.map(function(k) {
      const e = _lsEntry(k);
      let preview;
      if (e.isJson) {
        preview = '<details style="margin-top:4px"><summary style="cursor:pointer;color:var(--muted);font-size:.6rem">view JSON</summary><pre style="margin:4px 0 0;padding:6px 8px;background:var(--card);border:1px solid var(--border);border-radius:4px;font-size:.6rem;color:var(--text);white-space:pre-wrap;word-break:break-all;max-height:160px;overflow-y:auto">' + escapeHtml3(JSON.stringify(e.parsed, null, 2)) + "</pre></details>";
      } else if (e.raw != null) {
        const disp = e.raw.length > 140 ? e.raw.slice(0, 140) + "\u2026" : e.raw;
        preview = '<div style="margin-top:2px;color:var(--muted);font-size:.6rem">' + escapeHtml3(disp) + "</div>";
      } else preview = '<div style="margin-top:2px;color:var(--muted);font-size:.6rem">(null)</div>';
      return '<div class="dt-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><span style="font-weight:600;color:var(--text);font-family:ui-monospace,monospace">' + escapeHtml3(k) + '</span><span class="dt-label-muted">' + _fmtBytes(e.bytes) + '</span><button data-dt-action="clearLsKey" data-ls-key="' + escapeHtml3(k) + '" style="background:var(--card);border:1px solid var(--hr-border);color:var(--text);font-size:.6rem;padding:2px 6px;border-radius:4px;cursor:pointer">\u{1F5D1}</button></div>' + preview + "</div>";
    }).join("");
  }
  function clearLsKey(key) {
    if (!key) return;
    if (!confirm('Remove localStorage key "' + key + '"? This may log you out / reset settings depending on the key.')) return;
    try {
      localStorage.removeItem(key);
      pushDevLog("warn", "storage", ["removed key: " + key]);
    } catch (e) {
    }
    renderStorageInspector();
  }
  function copyStorageAsMarkdown() {
    const keys = _lsKeys();
    const lines = ["# MLB Pulse \u2014 localStorage Snapshot", "Captured: " + (/* @__PURE__ */ new Date()).toISOString(), "Keys: " + keys.length, ""];
    if (!keys.length) lines.push("_(no mlb_* keys)_");
    else {
      lines.push("| key | bytes | json | preview |");
      lines.push("|---|---|---|---|");
      keys.forEach(function(k) {
        const e = _lsEntry(k);
        let prev = (e.raw || "").replace(/\|/g, "\\|").replace(/\n/g, " \u21B5 ");
        if (prev.length > 120) prev = prev.slice(0, 120) + "\u2026";
        lines.push("| `" + k + "` | " + _fmtBytes(e.bytes) + " | " + (e.isJson ? "y" : "") + " | " + prev + " |");
      });
      lines.push("", "## Full values", "");
      keys.forEach(function(k) {
        const e = _lsEntry(k);
        lines.push("### `" + k + "` (" + _fmtBytes(e.bytes) + ")");
        if (e.isJson) lines.push("```json", JSON.stringify(e.parsed, null, 2), "```", "");
        else lines.push("```", e.raw == null ? "(null)" : e.raw, "```", "");
      });
    }
    _copyToClipboard(lines.join("\n"), "storageCopyBtn");
  }
  var _swState = { scope: null, scriptURL: null, controller: null, hasUpdate: false, lastUpdated: null, error: null };
  function _refreshSWState() {
    if (!("serviceWorker" in navigator)) {
      _swState.error = "Service Worker API not supported.";
      return Promise.resolve();
    }
    return navigator.serviceWorker.getRegistration().then(function(reg) {
      if (!reg) {
        _swState.error = "No registration found.";
        return;
      }
      _swState.scope = reg.scope;
      _swState.scriptURL = reg.active && reg.active.scriptURL || reg.installing && reg.installing.scriptURL || reg.waiting && reg.waiting.scriptURL || null;
      _swState.controller = navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null;
      _swState.hasUpdate = !!reg.waiting;
      _swState.error = null;
    }, function(err) {
      _swState.error = err && err.message || String(err);
    });
  }
  function renderSWInspector() {
    const info = document.getElementById("swInfo");
    if (!info) return;
    info.innerHTML = '<div class="dt-label-muted">Loading\u2026</div>';
    _refreshSWState().then(function() {
      const rows = {
        "Supported": "serviceWorker" in navigator,
        "Scope": _swState.scope || "\u2014",
        "Active script": _swState.scriptURL || "\u2014",
        "Controller": _swState.controller || "(uncontrolled)",
        "Update waiting": _swState.hasUpdate ? "YES \u2014 reload to activate" : "no",
        "Error": _swState.error || "\u2014"
      };
      info.innerHTML = _kvList(rows);
    });
  }
  function copySWStateAsMarkdown() {
    _refreshSWState().then(function() {
      const lines = ["# MLB Pulse \u2014 Service Worker", "Captured: " + (/* @__PURE__ */ new Date()).toISOString(), ""];
      lines.push("- Supported: " + ("serviceWorker" in navigator));
      lines.push("- Scope: " + (_swState.scope || "-"));
      lines.push("- Active script: " + (_swState.scriptURL || "-"));
      lines.push("- Controller: " + (_swState.controller || "(uncontrolled)"));
      lines.push("- Update waiting: " + (_swState.hasUpdate ? "YES" : "no"));
      if (_swState.error) lines.push("- Error: " + _swState.error);
      _copyToClipboard(lines.join("\n"), "swCopyBtn");
    });
  }
  function swForceUpdate() {
    if (!("serviceWorker" in navigator)) {
      alert("Service Worker not supported.");
      return;
    }
    navigator.serviceWorker.getRegistration().then(function(reg) {
      if (!reg) {
        alert("No SW registration found.");
        return;
      }
      pushDevLog("log", "sw", ["Force update requested"]);
      reg.update().then(function() {
        pushDevLog("log", "sw", ["update() resolved \xB7 waiting=" + !!reg.waiting]);
        if (reg.waiting) {
          try {
            reg.waiting.postMessage({ type: "SKIP_WAITING" });
          } catch (e) {
          }
          alert("Update found. Reload the page to activate the new version.");
        } else {
          alert("No new update available \u2014 already on latest.");
        }
        renderSWInspector();
      }, function(err) {
        pushDevLog("error", "sw", ["update() failed: " + (err && err.message || err)]);
        alert("Update failed: " + (err && err.message || err));
      });
    });
  }
  function swUnregisterAndReload() {
    if (!confirm("Unregister the service worker and reload? This forces a fresh load (clears cached app shell).")) return;
    if (!("serviceWorker" in navigator)) {
      location.reload();
      return;
    }
    navigator.serviceWorker.getRegistration().then(function(reg) {
      const done = function() {
        try {
          if (window.caches) {
            caches.keys().then(function(keys) {
              keys.forEach(function(k) {
                caches.delete(k);
              });
              location.reload(true);
            });
          } else location.reload(true);
        } catch (e) {
          location.reload(true);
        }
      };
      if (reg) {
        reg.unregister().then(done, done);
      } else done();
    });
  }
  function testLocalNotification() {
    if (!("Notification" in window)) {
      alert("Notifications not supported on this device.");
      return;
    }
    function show() {
      if (!("serviceWorker" in navigator)) {
        alert("Service Worker not supported.");
        return;
      }
      navigator.serviceWorker.getRegistration().then(function(reg) {
        if (!reg) {
          alert("No SW registered yet \u2014 reload and try again.");
          return;
        }
        reg.showNotification("MLB Pulse \xB7 Dev test", {
          body: "Local test fired " + (/* @__PURE__ */ new Date()).toLocaleTimeString() + " \xB7 server pipeline NOT exercised",
          icon: "./icons/icon-192.png",
          badge: "./icons/icon-192.png",
          tag: "mlb-dev-test",
          renotify: true
        }).then(
          function() {
            pushDevLog("log", "notif", ["local test notification fired"]);
          },
          function(err) {
            pushDevLog("error", "notif", ["showNotification failed: " + (err && err.message || err)]);
            alert("showNotification failed: " + (err && err.message || err));
          }
        );
      });
    }
    if (Notification.permission === "granted") show();
    else if (Notification.permission === "denied") alert("Notifications are blocked. Re-enable in browser/site settings.");
    else Notification.requestPermission().then(function(p) {
      if (p === "granted") show();
      else alert("Permission not granted (" + p + ").");
    });
  }
  function renderDemoFeedsTester() {
    const body = document.getElementById("demoFeedsBody");
    if (!body) return;
    const feeds = [
      { url: "https://archive.org/download/classicmlbbaseballradio/1969%2010%2016%20New%20York%20Mets%20vs%20Baltimore%20Orioles%20World%20Series%20Game%205.mp3", title: "1969 Mets vs Orioles WS Game 5" },
      { url: "https://archive.org/download/classicmlbbaseballradio/1970%2004%2022%20Padres%20vs%20New%20York%20Mets%20Seaver%2019ks%20Complete%20Broadcast%20Bob%20Murphy.mp3", title: "1970 Padres vs Mets \xB7 Seaver 19Ks" },
      { url: "https://archive.org/download/classicmlbbaseballradio/19570805GiantsAtDodgersvinScullyRadioBroadcast.mp3", title: "1957 Giants vs Dodgers \xB7 Vin Scully" },
      { url: "https://archive.org/download/classicmlbbaseballradio/1968%2009%2028%20Yankees%20vs%20Red%20Sox%20Mantles%20FINAL%20Game%20Messer%20Coleman%20Rizzuto%20Radio%20Broadcast.mp3", title: "1968 Yankees vs Red Sox \xB7 Mantle Final" }
    ];
    body.innerHTML = feeds.map(function(feed, idx) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--card2);border:1px solid var(--border);border-radius:4px;margin-bottom:6px;font-size:.7rem"><div style="flex:1"><div style="font-weight:600;color:var(--text)">\u{1F4FB} ' + feed.title + '</div><div style="color:var(--muted);margin-top:2px;font-size:.6rem;font-family:ui-monospace,monospace;word-break:break-all">' + feed.url.split("/").pop().substring(0, 40) + '\u2026</div></div><button data-dt-action="demoFeedPlay" data-demo-feed-url="' + feed.url + '" style="background:var(--secondary);color:var(--accent-text);border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;font-size:.65rem;flex-shrink:0;margin-left:8px">\u25B6 Play</button></div>';
    }).join("");
  }
  function testDemoFeedUrl(url) {
    if (!url) return;
    try {
      playArchiveUrl(url);
    } catch (e) {
      console.error("archive feed test failed:", e);
    }
  }
  function _liveGamesForControls() {
    if (typeof state.gameStates === "undefined") return [];
    return Object.keys(state.gameStates).map(function(pk) {
      return { pk: +pk, g: state.gameStates[pk] };
    }).filter(function(x) {
      return x.g.status === "Live";
    }).sort(function(a, b) {
      return (b.g.inning || 0) - (a.g.inning || 0);
    });
  }
  function renderLiveControls() {
    const body = document.getElementById("liveControlsBody");
    if (!body) return;
    const live = _liveGamesForControls();
    if (!live.length) {
      body.innerHTML = '<div class="dt-label-muted">No live games right now. Try Demo Mode (Shift+M) to populate state.gameStates with sample data.</div>';
      return;
    }
    const opts = live.map(function(x) {
      return '<option value="' + x.pk + '">' + escapeHtml3(x.g.awayAbbr + " @ " + x.g.homeAbbr + " \xB7 " + (x.g.halfInning || "") + " " + (x.g.inning || "?") + " \xB7 " + x.g.awayScore + "-" + x.g.homeScore) + "</option>";
    }).join("");
    const curFocus = typeof state.focusGamePk !== "undefined" && state.focusGamePk ? state.focusGamePk : "";
    body.innerHTML = '<div class="dt-box"><div class="dt-label" style="margin-bottom:6px">\u{1F3AF} Force Focus</div><div class="dt-label-muted" style="margin-bottom:6px">Override auto-scoring and pin Focus Mode to a specific live game. Resets via the \u21A9 AUTO pill in the focus card.</div><div style="display:flex;gap:6px;align-items:center"><select id="forceFocusSel" class="dt-input" style="flex:1">' + opts + '</select><button data-dt-action="forceFocusGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Apply</button></div>' + (curFocus ? '<div class="dt-label-muted" style="margin-top:4px">Current focus: gamePk ' + curFocus + "</div>" : "") + '</div><div class="dt-box"><div class="dt-label" style="margin-bottom:6px">\u{1F4D6} Force Inning Recap</div><div class="dt-label-muted" style="margin-bottom:6px">Queues an inning_recap story so it surfaces in the next pool build. Replaces the manual <code>state.inningRecapsPending[\u2026]</code> + <code>buildStoryPool()</code> console workflow.</div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><select id="forceRecapGame" class="dt-input" style="flex:2;min-width:140px">' + opts + '</select><select id="forceRecapHalf" class="dt-input" style="flex:1;min-width:60px"><option value="top">Top</option><option value="bottom">Bottom</option></select><input id="forceRecapInning" type="number" min="1" max="20" placeholder="Inn" class="dt-input" style="flex:0 0 60px"><button data-dt-action="forceRecapGo" style="background:var(--card);border:1px solid var(--border);color:var(--text);font-size:.65rem;padding:5px 10px;border-radius:4px;cursor:pointer;font-weight:600">Queue</button></div></div>';
    const sel = document.getElementById("forceRecapGame"), inn = document.getElementById("forceRecapInning"), half = document.getElementById("forceRecapHalf");
    function sync() {
      if (!sel || !inn || !half) return;
      const g = state.gameStates[+sel.value];
      if (g) {
        inn.value = g.inning || 1;
        half.value = (g.halfInning || "top").toLowerCase().indexOf("bot") === 0 ? "bottom" : "top";
      }
    }
    if (sel) sel.addEventListener("change", sync);
    sync();
  }
  function forceFocusGo() {
    const sel = document.getElementById("forceFocusSel");
    if (!sel || !sel.value) return;
    const pk = +sel.value;
    setFocusGameManual(pk);
    pushDevLog("log", "focus", ["Force Focus applied \xB7 gamePk=" + pk]);
    renderLiveControls();
  }
  function forceRecapGo() {
    const sel = document.getElementById("forceRecapGame"), half = document.getElementById("forceRecapHalf"), inn = document.getElementById("forceRecapInning");
    if (!sel || !half || !inn || !sel.value) {
      alert("Pick a game first.");
      return;
    }
    const pk = +sel.value, inning = parseInt(inn.value, 10), halfInning = (half.value || "top").toLowerCase();
    if (!inning || inning < 1) {
      alert("Enter a valid inning number.");
      return;
    }
    const key = pk + "_" + inning + "_" + halfInning;
    if (typeof state.inningRecapsFired !== "undefined") state.inningRecapsFired.delete && state.inningRecapsFired.delete(key);
    if (typeof state.inningRecapsPending !== "undefined") {
      state.inningRecapsPending[key] = { gamePk: pk, inning, halfInning };
      pushDevLog("log", "recap", ["Queued recap \xB7 " + key]);
    }
    if (_buildStoryPool) _buildStoryPool();
    alert("Recap queued for " + key + ". Wait for the next carousel rotation (or open Pulse to see it sooner).");
  }
  function copyDiagnosticSnapshot() {
    const ctx = _stateContext();
    const lsKeys = _lsKeys();
    const lsSizes = lsKeys.map(function(k) {
      const e = _lsEntry(k);
      return "- `" + k + "`: " + _fmtBytes(e.bytes) + (e.isJson ? " (json)" : "");
    }).join("\n") || "_(none)_";
    let swSummary = "_not yet fetched_";
    if (_swState && (_swState.scope || _swState.error)) {
      swSummary = [
        "- Scope: " + (_swState.scope || "-"),
        "- Active: " + (_swState.scriptURL || "-"),
        "- Controller: " + (_swState.controller || "(uncontrolled)"),
        "- Update waiting: " + (_swState.hasUpdate ? "YES" : "no"),
        _swState.error ? "- Error: " + _swState.error : null
      ].filter(Boolean).join("\n");
    }
    const counts = ctx.counts;
    const logSummary = devLog.length ? function() {
      const rows = devLog.slice(-50);
      const lines = ["| time | level | src | message |", "|---|---|---|---|"];
      rows.forEach(function(e) {
        let msg = e.msg.replace(/\|/g, "\\|").replace(/\n/g, " \u21B5 ");
        if (msg.length > 200) msg = msg.slice(0, 200) + "\u2026";
        lines.push("| " + _fmtLogTs(e.ts) + " | " + e.level + " | " + (e.src || "-") + " | " + msg + " |");
      });
      return lines.join("\n");
    }() : "_(empty)_";
    const netSummary = devNetLog.length ? function() {
      const lines = ["| time | method | status | ms | size | url |", "|---|---|---|---|---|---|"];
      devNetLog.forEach(function(e) {
        const url = (e.url || "").replace(/\|/g, "\\|");
        const status = e.status == null ? e.ok === false ? "ERR" : "-" : e.status;
        lines.push("| " + _fmtLogTs(e.ts) + " | " + e.method + " | " + status + " | " + (e.ms || "-") + " | " + _fmtBytes(e.sizeBytes) + " | " + url + " |");
      });
      const failed = devNetLog.filter(function(e) {
        return e.ok === false;
      });
      if (failed.length) {
        lines.push("", "**Failed:** " + failed.length);
        failed.forEach(function(e) {
          lines.push("- `" + e.method + " " + (e.status || "ERR") + "` " + e.url + (e.errorMsg ? " \u2014 " + e.errorMsg : ""));
        });
      }
      return lines.join("\n");
    }() : "_(empty)_";
    const parts = [
      "# MLB Pulse \u2014 Diagnostic Snapshot",
      "Generated: " + (/* @__PURE__ */ new Date()).toISOString(),
      "Version: " + ctx.version + " \xB7 Section: " + ctx.section + " \xB7 Active team: " + ctx.activeTeam,
      "state.demoMode: " + ctx.demoMode + " \xB7 state.pulseInitialized: " + ctx.pulseInitialized + " \xB7 pulseColorScheme: " + ctx.pulseColorScheme + " \xB7 state.themeScope: " + ctx.themeScope,
      "Focus: gamePk=" + (ctx.focusGamePk || "(auto)") + " \xB7 manual=" + ctx.focusIsManual + " \xB7 radioCurrentTeamId=" + (ctx.radioCurrentTeamId || "-"),
      "Viewport: " + ctx.viewport,
      "UA: " + ctx.userAgent,
      "",
      "## Counts",
      "- state.gameStates: " + counts.gameStates,
      "- state.feedItems: " + counts.feedItems,
      "- state.storyPool: " + counts.storyPool,
      "- state.enabledGames: " + counts.enabledGames,
      "- devLog: " + counts.devLog,
      "- devNetLog: " + devNetLog.length,
      "",
      _stateAsMarkdownContext(),
      _stateAsMarkdownFocus(),
      _stateAsMarkdownGames(),
      _stateAsMarkdownFeed(50),
      _stateAsMarkdownStories(),
      "## Service Worker",
      "",
      swSummary,
      "",
      "## localStorage sizes",
      "",
      lsSizes,
      "",
      "## Last 50 logs",
      "",
      logSummary,
      "",
      "## Last " + devNetLog.length + " network calls",
      "",
      netSummary
    ];
    _refreshSWState().catch(function() {
    });
    _copyToClipboard(parts.join("\n"), "diagSnapshotBtn");
  }
  function initPanelsLazyRendering() {
    function attach() {
      const stateDet = document.getElementById("appStateDetails");
      if (stateDet) stateDet.addEventListener("toggle", function() {
        if (stateDet.open) renderAppState();
      });
      const demoFeedsDet = document.getElementById("demoFeedsDetails");
      if (demoFeedsDet) demoFeedsDet.addEventListener("toggle", function() {
        if (demoFeedsDet.open) renderDemoFeedsTester();
      });
      const netDet = document.getElementById("netTraceDetails");
      if (netDet) netDet.addEventListener("toggle", function() {
        if (netDet.open) renderNetTrace();
      });
      const stoDet = document.getElementById("storageDetails");
      if (stoDet) stoDet.addEventListener("toggle", function() {
        if (stoDet.open) renderStorageInspector();
      });
      const swDet = document.getElementById("swDetails");
      if (swDet) swDet.addEventListener("toggle", function() {
        if (swDet.open) renderSWInspector();
      });
      const lcDet = document.getElementById("liveControlsDetails");
      if (lcDet) lcDet.addEventListener("toggle", function() {
        if (lcDet.open) renderLiveControls();
      });
      const det = document.getElementById("logCaptureDetails");
      if (!det) return;
      det.addEventListener("toggle", function() {
        if (det.open) renderLogCapture();
      });
      const lvl = document.getElementById("logCaptureLevel");
      if (lvl) lvl.addEventListener("change", renderLogCapture);
      const f = document.getElementById("logCaptureFilter");
      if (f) f.addEventListener("input", renderLogCapture);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
    else attach();
  }

  // src/utils/boxscore.js
  function buildBoxscore(players) {
    const hitters = [], pitchers = [];
    Object.values(players).forEach(function(p) {
      const bat = p.stats && p.stats.batting, pit = p.stats && p.stats.pitching;
      if (bat && bat.atBats > 0) hitters.push({ name: p.person.fullName, order: p.battingOrder || 999, ab: bat.atBats, h: bat.hits, r: bat.runs, rbi: bat.rbi, bb: bat.baseOnBalls, k: bat.strikeOuts, hr: bat.homeRuns });
      if (pit && (parseFloat(pit.inningsPitched || 0) > 0 || pit.outs > 0)) pitchers.push({ name: p.person.fullName, ip: pit.inningsPitched || "0.0", h: pit.hits, r: pit.runs, er: pit.earnedRuns, bb: pit.baseOnBalls, k: pit.strikeOuts, hr: pit.homeRuns, pc: pit.numberOfPitches || "\u2014" });
    });
    hitters.sort(function(a, b) {
      return a.order - b.order;
    });
    let t = '<div style="margin-bottom:12px"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Batting</div>';
    t += '<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th><th>HR</th></tr></thead><tbody>';
    if (!hitters.length) t += '<tr><td colspan="8" style="color:var(--muted)">No data</td></tr>';
    hitters.forEach(function(p) {
      t += '<tr><td style="text-align:left">' + p.name + "</td><td>" + p.ab + "</td><td>" + p.h + "</td><td>" + p.r + "</td><td>" + p.rbi + "</td><td>" + p.bb + "</td><td>" + p.k + "</td><td>" + p.hr + "</td></tr>";
    });
    t += '</tbody></table></div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin:10px 0 6px">Pitching</div>';
    t += '<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>PC</th></tr></thead><tbody>';
    if (!pitchers.length) t += '<tr><td colspan="9" style="color:var(--muted)">No data</td></tr>';
    pitchers.forEach(function(p) {
      t += '<tr><td style="text-align:left">' + p.name + "</td><td>" + p.ip + "</td><td>" + p.h + "</td><td>" + p.r + "</td><td>" + p.er + "</td><td>" + p.bb + "</td><td>" + p.k + "</td><td>" + p.hr + "</td><td>" + p.pc + "</td></tr>";
    });
    return t + "</tbody></table></div></div>";
  }

  // src/overlay/scorecard.js
  var refreshTimer = null;
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var POS = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9", "10": "DH" };
  var NON_PA = {
    stolen_base: 1,
    stolen_base_2b: 1,
    stolen_base_3b: 1,
    stolen_base_home: 1,
    caught_stealing: 1,
    caught_stealing_2b: 1,
    caught_stealing_3b: 1,
    caught_stealing_home: 1,
    pickoff_1b: 1,
    pickoff_2b: 1,
    pickoff_3b: 1,
    pickoff_caught_stealing_2b: 1,
    pickoff_caught_stealing_3b: 1,
    pickoff_caught_stealing_home: 1,
    pickoff_error_1b: 1,
    pickoff_error_2b: 1,
    pickoff_error_3b: 1,
    wild_pitch: 1,
    passed_ball: 1,
    balk: 1,
    defensive_indiff: 1,
    other_advance: 1,
    runner_placed: 1,
    defensive_substitution: 1,
    offensive_substitution: 1,
    pitching_substitution: 1,
    defensive_switch: 1,
    injury: 1,
    ejection: 1,
    game_advisory: 1
  };
  function advReason(et) {
    if (!et) return "";
    if (et.indexOf("stolen_base") === 0) return "SB";
    if (et === "wild_pitch") return "WP";
    if (et === "passed_ball") return "PB";
    if (et === "balk") return "BK";
    if (et === "defensive_indiff") return "DI";
    if (et === "field_error" || et === "error") return "E";
    return "";
  }
  function runnerTags(r) {
    const d = r.details || {};
    return ((d.movementReason || "") + " " + (d.eventType || "") + " " + (d.event || "")).toLowerCase();
  }
  function runnerAdvReason(r) {
    const s = runnerTags(r);
    if (s.indexOf("stolen") >= 0) return "SB";
    if (s.indexOf("wild_pitch") >= 0 || s.indexOf("wild pitch") >= 0) return "WP";
    if (s.indexOf("passed_ball") >= 0 || s.indexOf("passed ball") >= 0) return "PB";
    if (s.indexOf("balk") >= 0) return "BK";
    if (s.indexOf("indiff") >= 0) return "DI";
    if (s.indexOf("error") >= 0) return "E";
    return "";
  }
  function runnerOutCode(r) {
    const s = runnerTags(r);
    if (s.indexOf("caught_stealing") >= 0 || s.indexOf("caught stealing") >= 0) return "CS";
    if (s.indexOf("pickoff") >= 0 || s.indexOf("pick-off") >= 0 || s.indexOf("picked off") >= 0) return "PO";
    return "";
  }
  function fielderChain(play) {
    const seq = [];
    (play.runners || []).forEach(function(r) {
      (r.credits || []).forEach(function(c) {
        if (c.credit !== "f_putout" && c.credit !== "f_assist") return;
        const num = POS[c.position && c.position.code] || "";
        if (num && seq[seq.length - 1] !== num) seq.push(num);
      });
    });
    return seq;
  }
  function errorPos(play) {
    let p = "";
    (play.runners || []).forEach(function(r) {
      (r.credits || []).forEach(function(c) {
        if (c.credit === "f_error" && !p) p = POS[c.position && c.position.code] || "";
      });
    });
    return p;
  }
  function runnerOutReason(et, play) {
    if (et.indexOf("caught_stealing") === 0 || et.indexOf("pickoff_caught_stealing") === 0) return "CS";
    if (et.indexOf("pickoff") === 0) return "PO";
    return fielderChain(play).join("-") || "OUT";
  }
  function hitTrajectory(play) {
    const ev = play.playEvents || [];
    for (let i = ev.length - 1; i >= 0; i--) {
      if (ev[i].hitData && ev[i].hitData.trajectory) return ev[i].hitData.trajectory;
    }
    return "";
  }
  function hitCoords(play) {
    const ev = play.playEvents || [];
    for (let i = ev.length - 1; i >= 0; i--) {
      const hd = ev[i].hitData;
      if (hd && hd.coordinates && hd.coordinates.coordX != null && hd.coordinates.coordY != null)
        return { x: hd.coordinates.coordX, y: hd.coordinates.coordY };
    }
    return null;
  }
  function pitchInfo(play) {
    let ev = play.playEvents || [], p = 0;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].isPitch) p++;
    }
    const c = play.count || {};
    return { p, b: c.balls != null ? c.balls : 0, s: c.strikes != null ? c.strikes : 0 };
  }
  function notatePlay(play) {
    const et = play.result && play.result.eventType || "";
    const desc = play.result && play.result.description || "";
    const d = desc.toLowerCase();
    const chain = fielderChain(play);
    const out = { code: "", hit: false, out: false };
    if (et === "strikeout" || et === "strikeout_double_play") {
      out.code = /called/.test(d) ? "\uA4D8" : "K";
      out.out = true;
    } else if (et === "walk") {
      out.code = "BB";
    } else if (et === "intent_walk") {
      out.code = "IBB";
    } else if (et === "hit_by_pitch") {
      out.code = "HBP";
    } else if (et === "single") {
      out.code = "1B";
      out.hit = true;
    } else if (et === "double") {
      out.code = "2B";
      out.hit = true;
    } else if (et === "triple") {
      out.code = "3B";
      out.hit = true;
    } else if (et === "home_run") {
      out.code = "HR";
      out.hit = true;
    } else if (et === "field_error") {
      out.code = "E" + (errorPos(play) || "");
    } else if (et === "catcher_interf") {
      out.code = "CI";
    } else if (et === "sac_fly" || et === "sac_fly_double_play") {
      out.code = "SF" + (chain[chain.length - 1] || "");
      out.out = true;
    } else if (et === "sac_bunt" || et === "sac_bunt_double_play") {
      out.code = "SAC " + chain.join("-");
      out.out = true;
    } else if (et === "fielders_choice" || et === "fielders_choice_out") {
      out.code = "FC" + (chain.length ? " " + chain.join("-") : "");
      out.out = true;
    } else if (et === "field_out" || et === "force_out" || et === "grounded_into_double_play" || et === "double_play" || et === "triple_play" || et === "other_out") {
      out.out = true;
      const tj = hitTrajectory(play);
      let pre = tj === "line_drive" ? "L" : tj === "popup" ? "P" : tj === "fly_ball" || tj === "flyball" ? "F" : "";
      if (!pre) {
        pre = /lines? out|lined out/.test(d) ? "L" : /pop|popped/.test(d) ? "P" : /fl(?:y|ies|ied)|flyball/.test(d) ? "F" : "";
      }
      if (pre === "L" || pre === "P" || pre === "F") {
        out.code = pre + (chain[chain.length - 1] || "");
      } else {
        out.code = chain.join("-") || "OUT";
      }
      if (et === "grounded_into_double_play" || et === "double_play") out.code += " DP";
      if (et === "triple_play") out.code += " TP";
    } else {
      out.code = play.result && play.result.event ? play.result.event : et || "\u2014";
    }
    return out;
  }
  function baseToNum(b) {
    return b === "1B" ? 1 : b === "2B" ? 2 : b === "3B" ? 3 : b === "score" ? 4 : 0;
  }
  function buildModel(feed) {
    const gd = feed.gameData || {}, ld = feed.liveData || {};
    const ls = ld.linescore || {};
    const box = ld.boxscore && ld.boxscore.teams ? ld.boxscore.teams : {};
    const plays = ld.plays && ld.plays.allPlays ? ld.plays.allPlays : [];
    const regInn = ls.scheduledInnings || 9;
    const innCount = Math.max(regInn, (ls.innings || []).length, ls.currentInning || 0);
    const dec = ld.decisions || {};
    const decById = {};
    if (dec.winner && dec.winner.id) decById[dec.winner.id] = "W";
    if (dec.loser && dec.loser.id) decById[dec.loser.id] = "L";
    if (dec.save && dec.save.id) decById[dec.save.id] = "S";
    const subRoles = {};
    plays.forEach(function(p) {
      if ((p.result && p.result.eventType) !== "offensive_substitution") return;
      const dsc = p.result && p.result.description || "";
      const role = /Pinch-hitter/i.test(dsc) ? "PH" : /Pinch-runner/i.test(dsc) ? "PR" : "";
      if (!role) return;
      const m = dsc.match(/(?:Pinch-hitter|Pinch-runner)\s+(.+?)\s+replaces/i);
      if (!m) return;
      const nm = m[1].trim();
      const side = p.about && p.about.halfInning === "top" ? "away" : "home";
      const players = box[side] && box[side].players || {};
      let id = null;
      Object.keys(players).forEach(function(k) {
        const pl = players[k];
        if (pl && pl.person && pl.person.fullName === nm) id = pl.person.id;
      });
      subRoles[id != null ? id : "name:" + nm] = role;
    });
    function teamModel(sideKey) {
      const t = box[sideKey] || {}, players = t.players || {};
      const slots = {};
      Object.keys(players).forEach(function(pid) {
        const p = players[pid];
        if (p.battingOrder == null) return;
        const ord = parseInt(p.battingOrder, 10);
        const slot = Math.floor(ord / 100);
        (slots[slot] = slots[slot] || []).push({
          id: p.person.id,
          name: p.person.fullName,
          pos: p.position && p.position.abbreviation || "",
          order: ord,
          cells: {}
          // inning → [cell, …]  (array supports batting around)
        });
      });
      Object.keys(slots).forEach(function(s) {
        slots[s].sort(function(a, b) {
          return a.order - b.order;
        });
      });
      const pitchers = (t.pitchers || []).map(function(pid) {
        const p = players["ID" + pid] || {}, st = p.stats && p.stats.pitching || {};
        return { name: p.person && p.person.fullName || "", dec: decById[pid] || "", line: st };
      });
      return { slots, pitchers };
    }
    const away = teamModel("away"), home = teamModel("home");
    function rowFor(model, pid) {
      let found = null;
      Object.keys(model.slots).forEach(function(s) {
        model.slots[s].forEach(function(r) {
          if (r.id === pid) found = r;
        });
      });
      return found;
    }
    function pushCell(row, inn, cell) {
      (row.cells[inn] = row.cells[inn] || []).push(cell);
    }
    let onBase = {};
    let prevHalf = null, prevSide = null, prevInn = null;
    const lobA = {}, lobH = {};
    plays.forEach(function(play) {
      if (!(play.about && play.about.isComplete)) return;
      const inn = play.about.inning, half = play.about.halfInning;
      const hk = inn + "-" + half;
      if (hk !== prevHalf) {
        if (prevHalf != null) (prevSide === "away" ? lobA : lobH)[prevInn] = Object.keys(onBase).length;
        onBase = {};
        prevHalf = hk;
        prevSide = half === "top" ? "away" : "home";
        prevInn = inn;
      }
      const model = half === "top" ? away : home;
      const et = play.result && play.result.eventType || "";
      const isPA = !NON_PA[et];
      const reason = advReason(et);
      const batterId = play.matchup && play.matchup.batter && play.matchup.batter.id;
      const nOuts = play.count && play.count.outs;
      const pre = {}, next = {};
      for (const k in onBase) {
        pre[k] = onBase[k];
        next[k] = onBase[k];
      }
      (play.runners || []).forEach(function(r) {
        const rid = r.details && r.details.runner && r.details.runner.id;
        if (rid === batterId) return;
        const mv = r.movement || {};
        const sN = baseToNum(mv.originBase || mv.start);
        if (sN < 1 || sN > 3) return;
        let cell = pre[sN];
        if (!cell) {
          if (inn > regInn && sN === 2) {
            cell = {
              code: "MR",
              hit: false,
              out: false,
              rbi: 0,
              reached: 2,
              scored: false,
              outNum: 0,
              inningEnd: false,
              p: 0,
              b: 0,
              s: 0,
              adv: "",
              ghost: true
            };
            const grow = rowFor(model, rid);
            if (grow) pushCell(grow, inn, cell);
            pre[sN] = cell;
            next[sN] = cell;
          } else return;
        }
        const rReason = runnerAdvReason(r) || reason;
        if (mv.isOut) {
          cell.outOnBase = true;
          cell.outReason = runnerOutCode(r) || runnerOutReason(et, play);
          if (nOuts === 3) cell.inningEnd = true;
          cell.outNum = nOuts || cell.outNum || 0;
          if (next[sN] === cell) delete next[sN];
          return;
        }
        const endN = baseToNum(mv.end);
        if (endN === 4) {
          cell.scored = true;
          cell.reached = 3;
          if (rReason) cell.adv = rReason;
          if (next[sN] === cell) delete next[sN];
        } else if (endN >= 1 && endN !== sN) {
          if (next[sN] === cell) delete next[sN];
          next[endN] = cell;
          cell.reached = Math.max(cell.reached || 0, Math.min(3, endN));
          if (rReason) cell.adv = rReason;
        }
      });
      if (isPA) {
        const row = rowFor(model, batterId);
        const n = notatePlay(play);
        const pi = pitchInfo(play);
        const br = (play.runners || []).filter(function(r) {
          return r.details && r.details.runner && r.details.runner.id === batterId && (r.movement.start == null || r.movement.originBase == null);
        })[0];
        const reached = br ? baseToNum(br.movement.end) : 0;
        const batterOut = br ? !!br.movement.isOut : n.out;
        const cell = {
          code: n.code,
          hit: n.hit,
          out: batterOut,
          rbi: play.result && play.result.rbi || 0,
          reached: reached >= 4 ? 3 : reached,
          scored: reached === 4,
          outNum: batterOut ? nOuts || 0 : 0,
          inningEnd: batterOut && nOuts === 3,
          p: pi.p,
          b: pi.b,
          s: pi.s,
          adv: "",
          hc: hitCoords(play),
          traj: hitTrajectory(play)
        };
        if ((et === "strikeout" || et === "strikeout_double_play") && !batterOut && reached >= 1) {
          const dd = (play.result && play.result.description || "").toLowerCase();
          cell.adv = /wild pitch/.test(dd) ? "WP" : /passed ball/.test(dd) ? "PB" : /error/.test(dd) ? "E" : "safe";
        }
        if (row) pushCell(row, inn, cell);
        if (!batterOut && !cell.scored && reached >= 1 && reached <= 3) next[reached] = cell;
      }
      onBase = next;
    });
    if (prevHalf != null) (prevSide === "away" ? lobA : lobH)[prevInn] = Object.keys(onBase).length;
    function lobByInn(map) {
      const out = [];
      for (let i = 1; i <= innCount; i++) out.push(map[i] != null ? map[i] : "");
      return out;
    }
    function lineTotals(side) {
      const tt = ls.teams && ls.teams[side] || {};
      return {
        r: tt.runs != null ? tt.runs : "\u2014",
        h: tt.hits != null ? tt.hits : "\u2014",
        e: tt.errors != null ? tt.errors : "\u2014",
        lob: tt.leftOnBase != null ? tt.leftOnBase : "\u2014"
      };
    }
    function inningRuns(side) {
      const out = [];
      for (let i = 0; i < innCount; i++) {
        const ii = (ls.innings || [])[i];
        out.push(ii && ii[side] && ii[side].runs != null ? ii[side].runs : ii ? 0 : "");
      }
      return out;
    }
    const at = gd.teams && gd.teams.away ? gd.teams.away : {};
    const ht = gd.teams && gd.teams.home ? gd.teams.home : {};
    const w = gd.weather || {}, gi = gd.gameInfo || {}, dt = gd.datetime || {};
    const metaBits = [];
    if (gd.venue && gd.venue.name) metaBits.push(gd.venue.name);
    if (dt.officialDate) metaBits.push(dt.officialDate);
    if (gi.attendance) metaBits.push("Att " + Number(gi.attendance).toLocaleString());
    if (w.temp && w.condition) metaBits.push(w.condition + " " + w.temp + "\xB0");
    if (w.wind) metaBits.push("Wind " + w.wind);
    return {
      innCount,
      status: gd.status && gd.status.detailedState || "",
      isLive: gd.status && gd.status.abstractGameState === "Live",
      isFinal: gd.status && gd.status.abstractGameState === "Final",
      dateStr: dt.officialDate || "",
      meta: metaBits.join(" \xB7 "),
      subRoles,
      away: { name: at.teamName || at.name || "Away", model: away, totals: lineTotals("away"), inn: inningRuns("away"), lobInn: lobByInn(lobA) },
      home: { name: ht.teamName || ht.name || "Home", model: home, totals: lineTotals("home"), inn: inningRuns("home"), lobInn: lobByInn(lobH) }
    };
  }
  var INK_NAVY = "#1a3a6e";
  var INK_RED = "#a8243a";
  var INK_FAINT = "#b8a890";
  var INK_EMPTY = "#d4c5a8";
  var CODE_FONT = "Georgia, &quot;Times New Roman&quot;, serif";
  function diamondSVG(cell, size) {
    size = size || 76;
    const H = "30,58", B1 = "58,30", B2 = "30,2", B3 = "2,30";
    const path = ["M30,58 L58,30", "M58,30 L30,2", "M30,2 L2,30", "M2,30 L30,58"];
    const isHR = cell.code === "HR";
    const isK = cell.code === "K" || cell.code === "\uA4D8";
    const ink = cell.out ? INK_RED : INK_NAVY;
    const pathStroke = cell.scored || cell.hit ? INK_NAVY : INK_FAINT;
    let s = '<svg viewBox="0 0 60 60" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false" style="display:block">';
    s += '<polygon points="' + B2 + " " + B1 + " " + H + " " + B3 + '" fill="none" stroke="' + INK_FAINT + '" stroke-width="0.8"/>';
    if (cell.hc && !cell.ghost && !isK) {
      const dx = cell.hc.x - 125.42, dy = 198.27 - cell.hc.y;
      let th = Math.atan2(dx, dy);
      if (th > 1.05) th = 1.05;
      else if (th < -1.05) th = -1.05;
      let rN = Math.sqrt(dx * dx + dy * dy) / 210;
      if (rN > 1) rN = 1;
      else if (rN < 0.12) rN = 0.12;
      const L = 8 + rN * 46;
      const ex = Math.max(4, Math.min(56, 30 + L * Math.sin(th)));
      const ey = Math.max(4, Math.min(56, 58 - L * Math.cos(th)));
      const vx = ex - 30, vy = ey - 57, vl = Math.sqrt(vx * vx + vy * vy) || 1;
      const k = cell.traj === "fly_ball" ? 7 : cell.traj === "popup" ? 9 : cell.traj === "line_drive" ? 2 : 0;
      const d = k > 0 ? "M30,57 Q" + ((30 + ex) / 2 + -vy / vl * k).toFixed(1) + "," + ((57 + ey) / 2 + vx / vl * k).toFixed(1) + " " + ex.toFixed(1) + "," + ey.toFixed(1) : "M30,57 L" + ex.toFixed(1) + "," + ey.toFixed(1);
      s += '<path d="' + d + '" stroke="' + INK_FAINT + '" stroke-width="0.9" fill="none" opacity="0.7"/>';
    }
    if (isHR) {
      s += '<polygon points="' + B2 + " " + B1 + " " + H + " " + B3 + '" fill="' + INK_RED + '" fill-opacity="0.18" stroke="' + INK_RED + '" stroke-width="1.2"/>';
    }
    const seg = cell.scored ? 4 : cell.reached || 0;
    for (let i = 0; i < seg; i++) {
      s += '<path d="' + path[i] + '" stroke="' + pathStroke + '" stroke-width="2.4" stroke-linecap="round" fill="none"/>';
    }
    [B1, B2, B3].forEach(function(p, idx) {
      const on = idx + 1 <= (cell.scored ? 3 : cell.reached);
      s += '<circle cx="' + p.split(",")[0] + '" cy="' + p.split(",")[1] + '" r="2.1" fill="' + (on ? pathStroke : INK_EMPTY) + '"/>';
    });
    if (cell.inningEnd) s += '<line x1="3" y1="3" x2="57" y2="57" stroke="' + INK_RED + '" stroke-width="1.6" opacity="0.85"/>';
    if (cell.outNum) {
      s += '<circle cx="50" cy="10" r="5.5" fill="none" stroke="' + INK_RED + '" stroke-width="0.9"/>';
      s += '<text x="50" y="13" font-size="8.5" font-weight="700" font-family="' + CODE_FONT + '" fill="' + INK_RED + '" text-anchor="middle">' + cell.outNum + "</text>";
    }
    for (let ri = 0; ri < (cell.rbi || 0); ri++) {
      s += '<circle cx="' + (7 + ri * 4.5) + '" cy="9" r="1.6" fill="' + INK_RED + '"/>';
    }
    const codeSize = isK ? 22 : isHR ? 13 : 11;
    const codeY = isK ? 38 : isHR ? 32 : 31;
    s += '<text x="30" y="' + codeY + '" font-size="' + codeSize + '" font-weight="700" font-family="' + CODE_FONT + '" fill="' + ink + '" text-anchor="middle">' + esc(cell.code) + "</text>";
    if (!isK) {
      const mid = cell.outOnBase ? cell.outReason || "OUT" : cell.adv;
      if (mid) s += '<text x="30" y="47" font-size="7.5" font-family="' + CODE_FONT + '" fill="' + (cell.outOnBase ? INK_RED : INK_FAINT) + '" text-anchor="middle">' + esc(mid) + "</text>";
    }
    s += "</svg>";
    return s;
  }
  function footHtml(cell) {
    if (cell.ghost) return "";
    const t = (cell.b != null && cell.s != null ? cell.b + "-" + cell.s : "") + (cell.p ? " \xB7 " + cell.p + "p" : "");
    return t ? '<div class="sc-foot">' + esc(t) + "</div>" : "";
  }
  function emptyCell() {
    return '<svg viewBox="0 0 60 60" width="76" height="76" aria-hidden="true" focusable="false" style="display:block;opacity:.4"><polygon points="30,2 58,30 30,58 2,30" fill="none" stroke="' + INK_FAINT + '" stroke-width="0.8"/></svg>';
  }
  function cellLabel(c) {
    if (!c) return "";
    const p = [c.ghost ? "Manfred runner on 2nd" : c.code];
    if (c.scored) p.push("scored");
    else if (c.outOnBase) p.push("out on the bases (" + (c.outReason || "") + ")");
    else if (c.out) p.push("out" + (c.outNum ? " number " + c.outNum : ""));
    else if (c.reached) p.push("reached " + (["", "1st", "2nd", "3rd"][c.reached] || "base"));
    if (c.rbi) p.push(c.rbi + " RBI");
    if (c.adv && !c.outOnBase && c.adv !== "safe") p.push("advanced " + c.adv);
    return p.join(", ");
  }
  function renderCellStack(arr) {
    if (!arr || !arr.length) return emptyCell();
    if (arr.length === 1) return diamondSVG(arr[0]) + footHtml(arr[0]);
    return '<div class="sc-stack" title="batted around">' + arr.map(function(c) {
      return "<div>" + diamondSVG(c, 54) + footHtml(c) + "</div>";
    }).join("") + "</div>";
  }
  function renderLineScore(model) {
    const n = model.innCount;
    let h = '<div class="sc-scroll"><table class="sc-table sc-ls"><thead><tr><th class="sc-name"></th>';
    for (let i = 1; i <= n; i++) h += "<th>" + i + "</th>";
    h += '<th class="sc-rhe">R</th><th class="sc-rhe">H</th><th class="sc-rhe">E</th><th class="sc-rhe">LOB</th></tr></thead><tbody>';
    [model.away, model.home].forEach(function(t) {
      h += '<tr><td class="sc-name"><span class="sc-pn">' + esc(t.name) + "</span></td>";
      for (let k = 0; k < n; k++) h += "<td>" + (t.inn[k] != null ? t.inn[k] : "") + "</td>";
      h += '<td class="sc-rhe">' + t.totals.r + '</td><td class="sc-rhe">' + t.totals.h + '</td><td class="sc-rhe">' + t.totals.e + '</td><td class="sc-rhe">' + t.totals.lob + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }
  function renderTeamTable(team, innCount) {
    const slots = team.model.slots;
    const slotNums = Object.keys(slots).map(Number).sort(function(a, b) {
      return a - b;
    });
    let th = '<th class="sc-name">' + esc(team.name) + "</th>";
    for (let i = 1; i <= innCount; i++) th += "<th>" + i + "</th>";
    const sr = team.subRoles || {};
    let body = "";
    slotNums.forEach(function(sn) {
      slots[sn].forEach(function(row, subIdx) {
        const role = sr[row.id] || sr["name:" + row.name];
        const roleTag = subIdx > 0 ? '<span class="sc-subtag">' + esc(role || "SUB") + "</span>" : "";
        body += "<tr" + (subIdx > 0 ? ' class="sc-subrow"' : "") + ">";
        body += '<td class="sc-name"><span class="sc-ord">' + (subIdx === 0 ? sn : "") + "</span>" + roleTag + '<span class="sc-pn">' + esc(row.name) + '</span><span class="sc-pos">' + esc(row.pos) + "</span></td>";
        for (let inn = 1; inn <= innCount; inn++) {
          const arr = row.cells[inn];
          const lbl = arr && arr.length ? ' aria-label="' + esc(row.name + ", inning " + inn + ": " + arr.map(cellLabel).join("; ")) + '"' : "";
          body += '<td class="sc-cell"' + lbl + ">" + renderCellStack(arr) + "</td>";
        }
        body += "</tr>";
      });
    });
    let lobRow = '<tr class="sc-lob"><td class="sc-name">Left on base</td>';
    for (let li = 0; li < innCount; li++) lobRow += "<td>" + (team.lobInn && team.lobInn[li] !== "" && team.lobInn[li] != null ? team.lobInn[li] : "") + "</td>";
    lobRow += "</tr>";
    return '<div class="sc-team"><div class="sc-team-h">' + esc(team.name) + ' \u2014 Batting</div><div class="sc-scroll"><table class="sc-table sc-bat"><thead><tr>' + th + "</tr></thead><tbody>" + body + "</tbody><tfoot>" + lobRow + "</tfoot></table></div></div>";
  }
  function renderPitchers(team) {
    if (!team.model.pitchers.length) return "";
    const rows = team.model.pitchers.map(function(p) {
      const L = p.line || {};
      const pc = (L.numberOfPitches != null ? L.numberOfPitches : "") + (L.strikes != null ? "-" + L.strikes : "");
      const dec = p.dec ? ' <span class="sc-dec">(' + p.dec + ")</span>" : "";
      return '<tr><td class="sc-name"><span class="sc-pn">' + esc(p.name) + "</span>" + dec + "</td><td>" + (L.inningsPitched || "0.0") + "</td><td>" + (L.battersFaced != null ? L.battersFaced : "") + "</td><td>" + (L.hits != null ? L.hits : 0) + "</td><td>" + (L.runs != null ? L.runs : 0) + "</td><td>" + (L.earnedRuns != null ? L.earnedRuns : 0) + "</td><td>" + (L.baseOnBalls != null ? L.baseOnBalls : 0) + "</td><td>" + (L.strikeOuts != null ? L.strikeOuts : 0) + "</td><td>" + (L.homeRuns != null ? L.homeRuns : 0) + "</td><td>" + pc + "</td></tr>";
    }).join("");
    return '<div class="sc-team"><div class="sc-team-h">' + esc(team.name) + ' \u2014 Pitching</div><div class="sc-scroll"><table class="sc-table sc-pit"><thead><tr><th class="sc-name">Pitcher</th><th>IP</th><th>BF</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>P-S</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>";
  }
  function renderInto(model) {
    const card = document.getElementById("scorecardCard");
    if (!card) return;
    model.away.subRoles = model.subRoles;
    model.home.subRoles = model.subRoles;
    const ov = document.getElementById("scorecardOverlay");
    const sy = ov ? ov.scrollTop : 0;
    const prevScroll = [];
    const scs = card.querySelectorAll(".sc-scroll");
    for (let z = 0; z < scs.length; z++) prevScroll.push(scs[z].scrollLeft);
    const live = model.isLive ? '<span class="sc-live">\u25CF LIVE</span> ' : "";
    card.innerHTML = '<div class="sc-head"><div><div class="sc-title" id="scorecardTitle">' + esc(model.away.name) + " @ " + esc(model.home.name) + '</div><div class="sc-sub">' + live + esc(model.status) + (model.meta ? " \xB7 " + esc(model.meta) : "") + '</div></div><div class="sc-actions"><button class="sc-print" onclick="window.print()" aria-label="Print scorecard">\u{1F5A8}</button><button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close scorecard">\u2715</button></div></div>' + renderLineScore(model) + renderTeamTable(model.away, model.innCount) + renderTeamTable(model.home, model.innCount) + renderPitchers(model.away) + renderPitchers(model.home);
    if (ov) ov.scrollTop = sy;
    const ns = card.querySelectorAll(".sc-scroll");
    for (let z2 = 0; z2 < ns.length && z2 < prevScroll.length; z2++) ns[z2].scrollLeft = prevScroll[z2];
  }
  function setMsg(msg) {
    const card = document.getElementById("scorecardCard");
    if (card) card.innerHTML = '<div class="sc-head"><div class="sc-title" id="scorecardTitle">Scorecard</div><button class="sc-close" onclick="closeScorecardOverlay()" aria-label="Close scorecard">\u2715</button></div><div class="sc-msg">' + esc(msg) + "</div>";
  }
  async function loadScorecard() {
    const gamePk = state.scorecardGamePk;
    if (!gamePk) return;
    const cached = state.scorecardCache[gamePk];
    if (cached && cached.isFinal) {
      state.scorecardModel = cached;
      renderInto(cached);
      return;
    }
    try {
      const res = await fetch(MLB_BASE_V1_1 + "/game/" + gamePk + "/feed/live");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const feed = await res.json();
      if (state.scorecardGamePk !== gamePk || !state.scorecardOverlayOpen) return;
      const model = buildModel(feed);
      state.scorecardModel = model;
      if (model.isFinal) state.scorecardCache[gamePk] = model;
      renderInto(model);
    } catch (e) {
      if (state.scorecardOverlayOpen && !state.scorecardModel) setMsg("Could not load scorecard data.");
    }
  }
  function trapFocus(e) {
    if (e.key !== "Tab") return;
    const el = document.getElementById("scorecardOverlay");
    if (!el || !state.scorecardOverlayOpen) return;
    const f = [].slice.call(el.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])')).filter(function(n) {
      return n.offsetParent !== null;
    });
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  function openScorecardOverlay(gamePk) {
    const el = document.getElementById("scorecardOverlay");
    if (!el) return;
    state.scorecardOverlayOpen = true;
    state.scorecardGamePk = gamePk;
    el.style.display = "flex";
    setMsg("Loading scorecard\u2026");
    document.addEventListener("keydown", trapFocus, true);
    const cb = el.querySelector(".sc-close");
    if (cb) cb.focus();
    loadScorecard();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(function() {
      if (state.scorecardOverlayOpen && state.scorecardModel && state.scorecardModel.isLive) loadScorecard();
    }, TIMING.LIVE_REFRESH_MS);
  }
  function closeScorecardOverlay() {
    const el = document.getElementById("scorecardOverlay");
    state.scorecardOverlayOpen = false;
    state.scorecardGamePk = null;
    state.scorecardModel = null;
    document.removeEventListener("keydown", trapFocus, true);
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (el) el.style.display = "none";
  }

  // src/sections/live.js
  var liveGamePk = null;
  var liveInterval = null;
  function liveScorecard() {
    if (liveGamePk != null) openScorecardOverlay(liveGamePk);
  }
  function showLiveGame(gamePk) {
    liveGamePk = gamePk;
    document.querySelector(".main").style.display = "none";
    document.getElementById("liveView").classList.add("active");
    fetchLiveGame();
    liveInterval = setInterval(fetchLiveGame, TIMING.LIVE_REFRESH_MS);
  }
  function closeLiveView() {
    clearInterval(liveInterval);
    liveInterval = null;
    if (state.liveAbortCtrl) {
      state.liveAbortCtrl.abort();
      state.liveAbortCtrl = null;
    }
    liveGamePk = null;
    document.getElementById("liveView").classList.remove("active");
    document.querySelector(".main").style.display = "block";
  }
  async function fetchLiveGame() {
    if (state.liveAbortCtrl) {
      state.liveAbortCtrl.abort();
    }
    state.liveAbortCtrl = new AbortController();
    const liveSig = state.liveAbortCtrl.signal;
    try {
      const responses = await Promise.all([fetch(MLB_BASE + "/game/" + liveGamePk + "/linescore", { signal: liveSig }), fetch(MLB_BASE + "/game/" + liveGamePk + "/boxscore", { signal: liveSig }), fetch(MLB_BASE + "/schedule?gamePk=" + liveGamePk, { signal: liveSig })]);
      if (!responses[0].ok) throw new Error(responses[0].status);
      if (!responses[1].ok) throw new Error(responses[1].status);
      if (!responses[2].ok) throw new Error(responses[2].status);
      const ls = await responses[0].json(), bs = await responses[1].json(), sd = await responses[2].json();
      const gameState = sd.dates && sd.dates[0] && sd.dates[0].games && sd.dates[0].games[0] ? sd.dates[0].games[0].status.abstractGameState : "Live";
      const isFinal = gameState === "Final";
      const homeTeam = bs.teams && bs.teams.home && bs.teams.home.team ? bs.teams.home.team : {}, awayTeam = bs.teams && bs.teams.away && bs.teams.away.team ? bs.teams.away.team : {};
      const inningHalf = ls.isTopInning ? "\u25B2" : "\u25BC", inning = ls.currentInning || "\u2014";
      let headerHtml = isFinal ? '<div class="live-status">FINAL</div>' : '<div class="live-status">' + inningHalf + " " + inning + ' &nbsp;\xB7&nbsp; <span class="live-indicator">\u25CF LIVE</span></div>';
      headerHtml += '<div class="live-score"><div class="live-team"><div class="live-team-name">' + (awayTeam.abbreviation || awayTeam.name || "Away") + '</div><div class="live-team-score">' + (ls.teams && ls.teams.away ? ls.teams.away.runs : 0) + '</div></div><div class="live-score-divider">\u2014</div><div class="live-team"><div class="live-team-name">' + (homeTeam.abbreviation || homeTeam.name || "Home") + '</div><div class="live-team-score">' + (ls.teams && ls.teams.home ? ls.teams.home.runs : 0) + "</div></div></div>";
      document.getElementById("liveHeader").innerHTML = headerHtml;
      let balls = ls.balls || 0, strikes = ls.strikes || 0, outs = ls.outs || 0, bHtml = "", sHtml = "", oHtml = "";
      for (let i = 0; i < 4; i++) bHtml += '<div class="count-dot ball' + (i < balls ? " on" : "") + '"></div>';
      for (let i = 0; i < 3; i++) sHtml += '<div class="count-dot strike' + (i < strikes ? " on" : "") + '"></div>';
      for (let i = 0; i < 3; i++) oHtml += '<div class="count-dot out' + (i < outs ? " on" : "") + '"></div>';
      document.getElementById("liveBalls").innerHTML = bHtml;
      document.getElementById("liveStrikes").innerHTML = sHtml;
      document.getElementById("liveOuts").innerHTML = oHtml;
      const offense = ls.offense || {}, on = "var(--accent)", off = "none", offStroke = "var(--muted)";
      document.getElementById("base1").setAttribute("fill", offense.first ? on : off);
      document.getElementById("base1").setAttribute("stroke", offense.first ? on : offStroke);
      document.getElementById("base2").setAttribute("fill", offense.second ? on : off);
      document.getElementById("base2").setAttribute("stroke", offense.second ? on : offStroke);
      document.getElementById("base3").setAttribute("fill", offense.third ? on : off);
      document.getElementById("base3").setAttribute("stroke", offense.third ? on : offStroke);
      let batter = offense.batter || {}, pitcher = ls.defense && ls.defense.pitcher ? ls.defense.pitcher : {}, batterStats = "", pitcherStats = "";
      if (batter.id) {
        try {
          const br = await fetch(MLB_BASE + "/people/" + batter.id + "/stats?stats=season&season=" + SEASON + "&group=hitting");
          if (!br.ok) throw new Error(br.status);
          const bd = await br.json();
          const bst = bd.stats && bd.stats[0] && bd.stats[0].splits && bd.stats[0].splits[0] && bd.stats[0].splits[0].stat;
          if (bst) batterStats = "AVG " + fmtRate(bst.avg) + " \xB7 OBP " + fmtRate(bst.obp) + " \xB7 OPS " + fmtRate(bst.ops);
        } catch (e) {
        }
      }
      if (pitcher.id) {
        try {
          const pr = await fetch(MLB_BASE + "/people/" + pitcher.id + "/stats?stats=season&season=" + SEASON + "&group=pitching");
          if (!pr.ok) throw new Error(pr.status);
          const pd = await pr.json();
          const pst = pd.stats && pd.stats[0] && pd.stats[0].splits && pd.stats[0].splits[0] && pd.stats[0].splits[0].stat;
          if (pst) pitcherStats = "ERA " + fmt(pst.era, 2) + " \xB7 WHIP " + fmt(pst.whip, 2);
        } catch (e) {
        }
      }
      let pitcherGameLine = "";
      if (pitcher.id) {
        const allPl = Object.assign({}, bs.teams && bs.teams.home && bs.teams.home.players || {}, bs.teams && bs.teams.away && bs.teams.away.players || {});
        const pitEntry = Object.values(allPl).find(function(p) {
          return p.person && p.person.id === pitcher.id;
        });
        if (pitEntry && pitEntry.stats && pitEntry.stats.pitching) {
          const ps = pitEntry.stats.pitching;
          pitcherGameLine = "Today: " + (ps.inningsPitched || "0.0") + " IP \xB7 " + (ps.hits || 0) + " H \xB7 " + (ps.earnedRuns || 0) + " ER \xB7 " + (ps.strikeOuts || 0) + " K" + (ps.numberOfPitches ? " \xB7 " + ps.numberOfPitches + " PC" : "");
        }
      }
      document.getElementById("liveMatchup").innerHTML = '<div class="matchup-player"><div class="matchup-role">\u{1F3CF} Batting</div><div class="matchup-name">' + (batter.fullName || "\u2014") + '</div><div class="matchup-stats">' + batterStats + '</div></div><div class="matchup-player"><div class="matchup-role">\u26BE Pitching</div><div class="matchup-name">' + (pitcher.fullName || "\u2014") + '</div><div class="matchup-stats">' + pitcherStats + "</div>" + (pitcherGameLine ? '<div class="matchup-stats is-strong">' + pitcherGameLine + "</div>" : "") + "</div>";
      let innings = ls.innings || [], lsHtml = '<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
      innings.forEach(function(inn) {
        lsHtml += "<th>" + inn.num + "</th>";
      });
      lsHtml += '<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
      ["away", "home"].forEach(function(side) {
        const name = side === "away" ? awayTeam.abbreviation || "Away" : homeTeam.abbreviation || "Home";
        lsHtml += "<tr><td>" + name + "</td>";
        innings.forEach(function(inn) {
          lsHtml += "<td>" + (inn[side] && inn[side].runs != null ? inn[side].runs : "\u2014") + "</td>";
        });
        const tot = ls.teams && ls.teams[side] ? ls.teams[side] : {};
        lsHtml += '<td class="rhe rhe-start">' + (tot.runs != null ? tot.runs : "\u2014") + '</td><td class="rhe">' + (tot.hits != null ? tot.hits : "\u2014") + '</td><td class="rhe">' + (tot.errors != null ? tot.errors : "\u2014") + "</td></tr>";
      });
      lsHtml += "</tbody></table></div>";
      document.getElementById("liveLinescore").innerHTML = lsHtml;
      const awayPlayers = bs.teams && bs.teams.away && bs.teams.away.players ? bs.teams.away.players : {}, homePlayers = bs.teams && bs.teams.home && bs.teams.home.players ? bs.teams.home.players : {};
      const awayAbbr = awayTeam.abbreviation || awayTeam.name || "Away", homeAbbr = homeTeam.abbreviation || homeTeam.name || "Home";
      document.getElementById("liveBoxscore").innerHTML = `<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Box Score</div><div class="boxscore-tabs"><button onclick="switchBoxTab('live_bs','away')" id="live_bs_away_btn" class="pill is-active">` + awayAbbr + `</button><button onclick="switchBoxTab('live_bs','home')" id="live_bs_home_btn" class="pill">` + homeAbbr + '</button></div><div id="live_bs_away">' + buildBoxscore(awayPlayers) + '</div><div id="live_bs_home" style="display:none">' + buildBoxscore(homePlayers) + "</div></div>";
      let giHtml = "";
      if (bs.info && bs.info.length) {
        giHtml = '<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Game Info</div><div class="game-note-box">';
        bs.info.forEach(function(item) {
          if (!item.value) return;
          const val = item.value.replace(/\.$/, "").trim();
          if (!item.label) giHtml += '<div class="detail-summary-note">' + val + "</div>";
          else giHtml += '<div class="detail-summary-row"><span class="detail-summary-label">' + item.label + "</span><span>" + val + "</span></div>";
        });
        giHtml += "</div></div>";
      }
      document.getElementById("liveGameInfo").innerHTML = giHtml;
      if (isFinal) {
        if (liveInterval) {
          clearInterval(liveInterval);
          liveInterval = null;
        }
        document.getElementById("liveRefreshTime").textContent = "Game Final";
      }
    } catch (e) {
      if (e.name !== "AbortError") document.getElementById("liveHeader").innerHTML = '<div class="error">Could not load live game data</div>';
    }
    fetchPlayByPlay();
  }
  async function fetchPlayByPlay() {
    try {
      const r = await fetch(MLB_BASE + "/game/" + liveGamePk + "/playByPlay");
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      const plays = (data.allPlays || []).filter(function(p) {
        return p.about && p.about.isComplete;
      });
      if (!plays.length) {
        document.getElementById("livePlayByPlay").innerHTML = "";
        return;
      }
      let html = '<div class="boxscore-wrap live-stack-card"><div class="live-card-title">Play Log</div>';
      const reversed = plays.slice().reverse();
      let lastKey = null;
      reversed.forEach(function(play) {
        const inn = play.about.inning, half = play.about.halfInning === "top" ? "\u25B2" : "\u25BC";
        const key = half + inn;
        const ord = inn === 1 ? "1st" : inn === 2 ? "2nd" : inn === 3 ? "3rd" : inn + "th";
        if (key !== lastKey) {
          if (lastKey !== null) html += "</div>";
          html += '<div class="play-log-inning">' + half + " " + ord + '</div><div class="play-log-group">';
          lastKey = key;
        }
        const isScore = play.about.isScoringPlay;
        const desc = (play.result.description || "\u2014").replace(/\.$/, "");
        const score = isScore ? '<span class="play-log-score">' + play.result.awayScore + "-" + play.result.homeScore + "</span>" : "";
        html += '<div class="play-log-entry' + (isScore ? " play-log-scoring" : "") + '">' + (isScore ? "\u{1F7E2} " : "") + desc + (score ? " \xB7 " + score : "") + "</div>";
      });
      if (lastKey !== null) html += "</div>";
      html += "</div>";
      document.getElementById("livePlayByPlay").innerHTML = html;
    } catch (e) {
    }
  }

  // src/collection/sync.js
  var syncCallbacks = { loadCollection: null, saveCollection: null, updateCollectionUI: null };
  function setSyncCallbacks(callbacks) {
    Object.assign(syncCallbacks, callbacks);
  }
  var DEBUG4 = false;
  async function syncCollection() {
    if (!state.mlbSessionToken) return;
    try {
      const local = syncCallbacks.loadCollection ? syncCallbacks.loadCollection() : {};
      const r = await fetch((window.API_BASE || API_BASE || "") + "/api/collection-sync", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + state.mlbSessionToken },
        body: JSON.stringify({ localCollection: local })
      });
      if (r.ok) {
        const data = await r.json();
        if (data.collection) {
          if (syncCallbacks.saveCollection) syncCallbacks.saveCollection(data.collection);
          if (DEBUG4) console.log("[Sync] Collection synced", Object.keys(data.collection).length, "cards");
        }
      }
    } catch (e) {
      console.error("[Sync] Collection error", e);
    }
  }
  async function mergeCollectionOnSignIn() {
    if (!state.mlbSessionToken) return;
    try {
      const r = await fetch((window.API_BASE || API_BASE || "") + "/api/collection/sync?token=" + state.mlbSessionToken);
      if (r.ok) {
        const data = await r.json();
        if (data.collection && Object.keys(data.collection).length > 0) {
          const local = syncCallbacks.loadCollection ? syncCallbacks.loadCollection() : {};
          const merged = mergeCollectionSlots(local, data.collection);
          if (syncCallbacks.saveCollection) syncCallbacks.saveCollection(merged);
          if (syncCallbacks.updateCollectionUI) syncCallbacks.updateCollectionUI();
          if (DEBUG4) console.log("[Sync] Merged", Object.keys(merged).length, "cards from server");
        }
      }
    } catch (e) {
      console.error("[Sync] Merge error", e);
    }
  }
  function mergeCollectionSlots(local, remote) {
    function tierRank2(t) {
      const ranks = { legendary: 4, epic: 3, rare: 2, common: 1 };
      return ranks[t] || 0;
    }
    const merged = { ...local, ...remote };
    Object.keys(local).forEach((k) => {
      if (remote[k]) {
        const lr = tierRank2(local[k].tier), rr = tierRank2(remote[k].tier);
        if (lr > rr) {
          merged[k] = local[k];
        } else if (rr > lr) {
          merged[k] = remote[k];
        } else {
          const newer = local[k].collectedAt >= remote[k].collectedAt ? local[k] : remote[k];
          const em = /* @__PURE__ */ new Map();
          (local[k].events || []).forEach((e) => em.set(e.date + ":" + e.badge, e));
          (remote[k].events || []).forEach((e) => em.set(e.date + ":" + e.badge, e));
          const events = Array.from(em.values()).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
          merged[k] = { ...newer, events };
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

  // src/collection/book.js
  var _showSignInCTA = null;
  var _showPlayerCard = null;
  var _showRBICard = null;
  var _getLeagueLeadersCache = null;
  function setBookCallbacks(cbs) {
    if (cbs.showSignInCTA) _showSignInCTA = cbs.showSignInCTA;
    if (cbs.showPlayerCard) _showPlayerCard = cbs.showPlayerCard;
    if (cbs.showRBICard) _showRBICard = cbs.showRBICard;
    if (cbs.getLeagueLeadersCache) _getLeagueLeadersCache = cbs.getLeagueLeadersCache;
  }
  function tierRank(t) {
    return { legendary: 4, epic: 3, rare: 2, common: 1 }[t] || 0;
  }
  function getCardTier(badge, eventType, rbi) {
    if (eventType === "HR") {
      if (badge.includes("WALK-OFF GRAND SLAM")) return "legendary";
      if (badge.includes("WALK-OFF") || badge.includes("GRAND SLAM")) return "epic";
      if (badge.includes("GO-AHEAD")) return "rare";
      return "common";
    } else {
      if (badge.includes("WALK-OFF") && (rbi || 0) >= 2) return "legendary";
      if (badge.includes("WALK-OFF") || (rbi || 0) >= 3) return "epic";
      if (badge.includes("GO-AHEAD") || badge.includes("TIES IT")) return "rare";
      return "common";
    }
  }
  function loadCollection() {
    try {
      return JSON.parse(localStorage.getItem("mlb_card_collection") || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveCollection(obj) {
    try {
      localStorage.setItem("mlb_card_collection", JSON.stringify(obj));
    } catch (e) {
    }
  }
  function showCollectedToast(type, playerName, eventType, tier) {
    const el = document.getElementById("cardCollectedToast");
    if (!el) return;
    const tierColor = { legendary: "#e03030", epic: "#f59e0b", rare: "#3b82f6", common: "#9aa0a8" }[tier] || "#9aa0a8";
    const lastName = playerName.split(" ").pop();
    let prefix, msg;
    if (type === "new") {
      if (tier === "legendary") {
        prefix = "\u{1F534}";
        msg = "LEGENDARY PULL! " + lastName + " " + eventType;
      } else if (tier === "epic") {
        prefix = "\u{1F7E0}";
        msg = "EPIC CARD! " + lastName + " " + eventType;
      } else if (tier === "rare") {
        prefix = "\u{1F48E}";
        msg = "Rare find \u2014 " + lastName + " " + eventType;
      } else {
        prefix = "\u{1F3B4}";
        msg = "Card collected \u2014 " + lastName + " " + eventType;
      }
    } else if (type === "upgrade") {
      if (tier === "legendary") {
        prefix = "\u{1F534}";
        msg = "UPGRADED TO LEGENDARY! " + lastName;
      } else if (tier === "epic") {
        prefix = "\u26A1";
        msg = "Upgraded to Epic! " + lastName + " " + eventType;
      } else if (tier === "rare") {
        prefix = "\u{1F48E}";
        msg = "Upgraded to Rare \u2014 " + lastName + " " + eventType;
      } else {
        prefix = "\u2B06";
        msg = "Upgraded \u2014 " + lastName + " " + eventType;
      }
    } else {
      if (tier === "legendary") {
        prefix = "\u{1F451}";
        msg = "Another legendary " + lastName + " moment!";
      } else if (tier === "epic") {
        prefix = "\u{1F525}";
        msg = "Epic variant added \u2014 " + lastName;
      } else if (tier === "rare") {
        prefix = "\u{1F48E}";
        msg = "Rare event added \u2014 " + lastName + " " + eventType;
      } else {
        prefix = "\u2713";
        msg = lastName + "'s " + eventType + " card updated";
      }
    }
    el.style.borderColor = tierColor + "99";
    el.style.boxShadow = tier === "legendary" || tier === "epic" ? "0 0 14px " + tierColor + "55" : "";
    el.innerHTML = '<span style="color:' + tierColor + ';font-weight:800;">' + prefix + "</span> " + msg;
    const duration = tier === "legendary" || tier === "epic" ? 2800 : 2100;
    el.style.animationDuration = duration + "ms";
    el.style.display = "block";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    setTimeout(function() {
      el.style.display = "none";
      el.classList.remove("show");
    }, duration);
  }
  function collectCard(data, force) {
    const playerId = data.playerId, playerName = data.playerName, teamAbbr = data.teamAbbr;
    const teamPrimary = data.teamPrimary, teamSecondary = data.teamSecondary, position = data.position || "";
    const eventType = data.eventType, badge = data.badge || "", rbi = data.rbi || 0;
    const key = playerId + "_" + eventType;
    const tier = getCardTier(badge, eventType, rbi);
    devTrace("collect", (playerName || "?") + " \xB7 " + eventType + " \xB7 tier=" + tier + (rbi ? " \xB7 rbi=" + rbi : "") + (force ? " [forced]" : ""));
    if (state.demoMode && !force) {
      const demoCol = loadCollection();
      const demoEx = demoCol[key];
      if (!demoEx) {
        state.lastCollectionResult = { type: "new", playerName, eventType, tier };
        state.demoCardCount = (state.demoCardCount || 0) + 1;
      } else {
        const dRank = tierRank(tier), dExRank = tierRank(demoEx.tier);
        state.lastCollectionResult = {
          type: dRank > dExRank ? "upgrade" : "dup",
          playerName,
          eventType,
          tier
        };
      }
      updateCollectionUI();
      return;
    }
    const col = loadCollection();
    const eventCtx = {
      badge,
      date: (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA"),
      inning: data.inning || 0,
      halfInning: data.halfInning || "top",
      awayAbbr: data.awayAbbr || "",
      homeAbbr: data.homeAbbr || "",
      awayScore: data.awayScore || 0,
      homeScore: data.homeScore || 0
    };
    if (!col[key]) {
      col[key] = {
        playerId,
        playerName,
        teamAbbr,
        teamPrimary,
        teamSecondary,
        position,
        eventType,
        tier,
        collectedAt: Date.now(),
        events: [eventCtx]
      };
      state.lastCollectionResult = { type: "new", playerName, eventType, tier };
      showCollectedToast("new", playerName, eventType, tier);
    } else {
      const existing = col[key];
      const newRank = tierRank(tier), existRank = tierRank(existing.tier);
      if (newRank > existRank) {
        existing.tier = tier;
        existing.events = [eventCtx];
        existing.collectedAt = Date.now();
        existing.teamPrimary = teamPrimary;
        existing.teamSecondary = teamSecondary;
        existing.position = position || existing.position;
        state.lastCollectionResult = { type: "upgrade", playerName, eventType, tier };
        showCollectedToast("upgrade", playerName, eventType, tier);
      } else if (newRank === existRank) {
        if (existing.events.length < 10) existing.events.push(eventCtx);
        state.lastCollectionResult = { type: "dup", playerName, eventType, tier };
        showCollectedToast("dup", playerName, eventType, tier);
      }
    }
    saveCollection(col);
    updateCollectionUI();
    if (state.mlbSessionToken) syncCollection();
    else if (_showSignInCTA) _showSignInCTA();
  }
  async function fetchCareerStats(playerId, position) {
    if (state.collectionCareerStatsCache[playerId]) return state.collectionCareerStatsCache[playerId];
    const isPitcher = ["SP", "RP", "CP", "P"].indexOf((position || "").toUpperCase()) !== -1;
    const group = isPitcher ? "pitching" : "hitting";
    try {
      const r = await fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=career&group=" + group);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
      if (!stat) return null;
      const result = isPitcher ? { careerERA: fmt(stat.era, 2), careerWHIP: fmt(stat.whip, 2), careerW: stat.wins || 0, careerK: stat.strikeOuts || 0 } : { careerHR: stat.homeRuns || 0, careerAVG: fmtRate(stat.avg), careerRBI: stat.rbi || 0, careerOPS: fmtRate(stat.ops) };
      state.collectionCareerStatsCache[playerId] = result;
      return result;
    } catch (e) {
      return null;
    }
  }
  function openCollection() {
    const el = document.getElementById("collectionOverlay");
    if (!el) return;
    state.collectionPage = 0;
    el.style.display = "flex";
    if (state.demoMode) {
      const book = document.getElementById("collectionBook");
      if (book) {
        book.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:50vh;padding:40px 20px"><div style="max-width:340px;text-align:center;color:var(--text)"><div style="font-size:48px;margin-bottom:12px">\u{1F3B4}</div><div style="font-size:1.05rem;font-weight:700;margin-bottom:6px">Demo cards aren\u2019t saved</div><div style="font-size:.85rem;line-height:1.5;color:var(--muted);margin-bottom:18px">Sign in to start your real collection. Every HR or key RBI you watch live becomes a card you can keep.</div><button onclick="closeCollection()" style="background:var(--secondary);color:var(--accent-text);border:none;padding:9px 20px;border-radius:8px;cursor:pointer;font-weight:700;font-size:.85rem">Back to Demo</button></div></div>';
      }
      return;
    }
    renderCollectionBook();
  }
  function closeCollection() {
    const el = document.getElementById("collectionOverlay");
    if (el) el.style.display = "none";
  }
  function filterCollection(f) {
    state.collectionFilter = f;
    state.collectionPage = 0;
    renderCollectionBook();
  }
  function sortCollection(s) {
    state.collectionSort = s;
    state.collectionPage = 0;
    renderCollectionBook();
  }
  function goCollectionPage(dir) {
    const col = loadCollection();
    let slots = Object.values(col);
    if (state.collectionFilter !== "all") slots = slots.filter(function(s) {
      return s.eventType === state.collectionFilter;
    });
    if (state.collectionSort === "team") {
      const abbrs = [];
      slots.forEach(function(s) {
        if (abbrs.indexOf(s.teamAbbr) === -1) abbrs.push(s.teamAbbr);
      });
      abbrs.sort();
      state.collectionPage = Math.max(0, Math.min(abbrs.length - 1, state.collectionPage + dir));
    } else {
      const totalPages = Math.max(1, Math.ceil(slots.length / 9));
      state.collectionPage = Math.max(0, Math.min(totalPages - 1, state.collectionPage + dir));
    }
    renderCollectionBook();
  }
  async function renderCollectionBook() {
    const book = document.getElementById("collectionBook");
    if (!book) return;
    const col = loadCollection();
    let slots = Object.values(col);
    if (state.collectionFilter !== "all") slots = slots.filter(function(s) {
      return s.eventType === state.collectionFilter;
    });
    let teamContext = null;
    if (state.collectionSort === "rarity") {
      slots.sort(function(a, b) {
        return tierRank(b.tier) - tierRank(a.tier) || b.collectedAt - a.collectedAt;
      });
    } else if (state.collectionSort === "team") {
      const teamAbbrs = [];
      slots.forEach(function(s) {
        if (teamAbbrs.indexOf(s.teamAbbr) === -1) teamAbbrs.push(s.teamAbbr);
      });
      teamAbbrs.sort();
      const teamCount = teamAbbrs.length;
      state.collectionPage = Math.max(0, Math.min(Math.max(0, teamCount - 1), state.collectionPage));
      const currentAbbr = teamAbbrs[state.collectionPage] || "";
      slots = slots.filter(function(s) {
        return s.teamAbbr === currentAbbr;
      });
      slots.sort(function(a, b) {
        return tierRank(b.tier) - tierRank(a.tier);
      });
      const td = TEAMS.find(function(t) {
        return t.short === currentAbbr;
      });
      teamContext = {
        abbr: currentAbbr,
        primary: td && td.primary || "#444444",
        secondary: td && td.secondary || "#888888",
        teamId: td ? td.id : null,
        teamIdx: state.collectionPage,
        teamCount
      };
    } else {
      slots.sort(function(a, b) {
        return b.collectedAt - a.collectedAt;
      });
    }
    if (state.collectionSort !== "team") {
      const totalPages = Math.max(1, Math.ceil(slots.length / 9));
      state.collectionPage = Math.min(state.collectionPage, totalPages - 1);
    }
    const pageSlots = state.collectionSort === "team" ? slots : slots.slice(state.collectionPage * 9, (state.collectionPage + 1) * 9);
    const careerStatsMap = Object.assign({}, state.collectionCareerStatsCache);
    await Promise.all(pageSlots.map(async function(slot) {
      if (!careerStatsMap[slot.playerId]) {
        const cs = await fetchCareerStats(slot.playerId, slot.position);
        if (cs) careerStatsMap[slot.playerId] = cs;
      }
    }));
    state.collectionSlotsDisplay = slots.slice();
    book.innerHTML = window.CollectionCard.renderBook({
      slots,
      filter: state.collectionFilter,
      sort: state.collectionSort,
      page: state.collectionPage,
      careerStatsMap,
      teamContext
    });
  }
  function openCardFromCollection(idx) {
    const slot = state.collectionSlotsDisplay[idx];
    if (!slot || !slot.events || !slot.events.length) return;
    const ev = slot.events[Math.floor(Math.random() * slot.events.length)];
    const awayTeam = TEAMS.find(function(t) {
      return t.short === ev.awayAbbr;
    });
    const homeTeam = TEAMS.find(function(t) {
      return t.short === ev.homeAbbr;
    });
    const awayTeamId = awayTeam ? awayTeam.id : 0;
    const homeTeamId = homeTeam ? homeTeam.id : 0;
    if (slot.eventType === "HR") {
      const careerStats = state.collectionCareerStatsCache[slot.playerId];
      let overrideStats = null;
      if (careerStats && careerStats.careerHR !== void 0) {
        overrideStats = {
          avg: careerStats.careerAVG,
          ops: careerStats.careerOPS,
          homeRuns: careerStats.careerHR,
          rbi: careerStats.careerRBI,
          _position: slot.position
        };
      } else if (slot.position) {
        overrideStats = { _position: slot.position };
      }
      if (_showPlayerCard) _showPlayerCard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, overrideStats, null, ev.badge, null);
    } else {
      const badgeUp = (ev.badge || "").toUpperCase();
      let eventType = "";
      if (badgeUp.indexOf("SINGLE") !== -1) eventType = "Single";
      else if (badgeUp.indexOf("DOUBLE") !== -1) eventType = "Double";
      else if (badgeUp.indexOf("TRIPLE") !== -1) eventType = "Triple";
      else if (badgeUp.indexOf("SAC FLY") !== -1) eventType = "Sac Fly";
      else if (badgeUp.indexOf("WALK") !== -1) eventType = "Walk";
      else if (badgeUp.indexOf("HBP") !== -1) eventType = "HBP";
      const rbiMatch = badgeUp.match(/^(\d+)-RUN/);
      const rbi = rbiMatch ? parseInt(rbiMatch[1]) : 1;
      if (_showRBICard) _showRBICard(slot.playerId, slot.playerName, awayTeamId, homeTeamId, ev.halfInning, rbi, eventType, ev.awayScore, ev.homeScore, ev.inning, null);
    }
  }
  function openCardFromKey(key) {
    const col = loadCollection();
    const slot = col[key];
    if (!slot || !slot.events || !slot.events.length) return;
    const sorted = Object.values(col).sort(function(a, b) {
      return (b.collectedAt || 0) - (a.collectedAt || 0);
    });
    state.collectionSlotsDisplay = sorted;
    let idx = sorted.indexOf(slot);
    if (idx === -1) {
      state.collectionSlotsDisplay.push(slot);
      idx = state.collectionSlotsDisplay.length - 1;
    }
    openCardFromCollection(idx);
  }
  function updateCollectionUI() {
    const count = state.demoMode ? state.demoCardCount || 0 : Object.keys(loadCollection()).length;
    const countEl = document.getElementById("collectionCountLabel");
    if (countEl) countEl.textContent = count;
    renderCollectionRailModule();
  }
  function renderCollectionRailModule() {
    const el = document.getElementById("collectionRailModule");
    if (!el || !window.CollectionCard) return;
    const count = state.demoMode ? state.demoCardCount || 0 : Object.keys(loadCollection()).length;
    el.innerHTML = window.CollectionCard.renderRailModule(count);
  }
  function flashCollectionRailMessage() {
    if (!state.lastCollectionResult) return;
    const el = document.getElementById("collectionRailModule");
    if (!el) return;
    const r = state.lastCollectionResult;
    state.lastCollectionResult = null;
    const tierColor = { legendary: "#e03030", epic: "#f59e0b", rare: "#3b82f6", common: "#9aa0a8" }[r.tier] || "#9aa0a8";
    const name = r.playerName.split(" ").pop();
    let label, sublabel;
    if (r.type === "new") {
      if (r.tier === "legendary") {
        label = "\u{1F534} LEGENDARY PULL!";
        sublabel = name + " " + r.eventType;
      } else if (r.tier === "epic") {
        label = "\u26A1 EPIC CARD!";
        sublabel = name + " " + r.eventType;
      } else if (r.tier === "rare") {
        label = "\u{1F48E} Rare Find!";
        sublabel = name + " " + r.eventType;
      } else {
        label = "\u{1F3B4} Card Collected";
        sublabel = name + " " + r.eventType;
      }
    } else if (r.type === "upgrade") {
      if (r.tier === "legendary") {
        label = "\u{1F534} LEGENDARY UPGRADE!";
        sublabel = name + " " + r.eventType;
      } else if (r.tier === "epic") {
        label = "\u26A1 Upgraded to Epic!";
        sublabel = name + " " + r.eventType;
      } else if (r.tier === "rare") {
        label = "\u{1F48E} Upgraded to Rare";
        sublabel = name + " " + r.eventType;
      } else {
        label = "\u2B06 Upgraded";
        sublabel = name + " " + r.eventType;
      }
    } else {
      if (r.tier === "legendary") {
        label = "\u{1F451} Legendary";
        sublabel = "Another " + name + " moment!";
      } else if (r.tier === "epic") {
        label = "\u{1F525} Epic Variant";
        sublabel = "Added to collection";
      } else if (r.tier === "rare") {
        label = "\u{1F48E} Rare Variant";
        sublabel = name + " " + r.eventType;
      } else {
        label = "\u2713 Already Have";
        sublabel = name + " " + r.eventType;
      }
    }
    const dotGlow = r.tier === "legendary" || r.tier === "epic" ? ";box-shadow:0 0 6px " + tierColor : "";
    el.innerHTML = '<div onclick="openCollection()" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;border-radius:8px;border:1px solid ' + tierColor + "55;background:linear-gradient(90deg," + tierColor + '22,transparent);font-size:.75rem;color:var(--text);white-space:nowrap;overflow:hidden;"><span style="width:8px;height:8px;border-radius:50%;background:' + tierColor + ";flex-shrink:0" + dotGlow + '"></span><span style="flex:1;overflow:hidden;text-overflow:ellipsis;"><span style="font-weight:700;color:' + tierColor + ';">' + label + '</span> <span style="color:var(--muted);">' + sublabel + '</span></span><span style="color:var(--muted);font-size:11px;flex-shrink:0;">Open \u2192</span></div>';
    setTimeout(function() {
      renderCollectionRailModule();
    }, 4e3);
  }
  function generateTestCard() {
    const rosterEntries = (state.rosterData.hitting || []).map(function(p2) {
      return {
        personId: p2.person.id,
        personName: p2.person.fullName,
        teamData: state.activeTeam,
        position: p2.position && p2.position.abbreviation || "OF"
      };
    });
    const seenIds = {};
    rosterEntries.forEach(function(e) {
      seenIds[e.personId] = true;
    });
    const leaderEntries = [];
    function addLeadersFromMap(map) {
      Object.keys(map).forEach(function(cat) {
        (map[cat] || []).forEach(function(l) {
          if (!l.person || !l.person.id || seenIds[l.person.id]) return;
          const td = l.team && l.team.id ? TEAMS.find(function(t) {
            return t.id === l.team.id;
          }) : null;
          if (!td) return;
          seenIds[l.person.id] = true;
          leaderEntries.push({
            personId: l.person.id,
            personName: l.person.fullName,
            teamData: td,
            position: "OF"
          });
        });
      });
    }
    const leagueLeadersCache = _getLeagueLeadersCache ? _getLeagueLeadersCache() : null;
    if (leagueLeadersCache && leagueLeadersCache.hitting) addLeadersFromMap(leagueLeadersCache.hitting);
    if (state.dailyLeadersCache) {
      const hitCats = { homeRuns: 1, battingAverage: 1, runsBattedIn: 1, stolenBases: 1 };
      const hitOnly = {};
      Object.keys(state.dailyLeadersCache).forEach(function(k) {
        if (hitCats[k]) hitOnly[k] = state.dailyLeadersCache[k];
      });
      addLeadersFromMap(hitOnly);
    }
    const fullPool = rosterEntries.concat(leaderEntries);
    if (!fullPool.length) {
      showCollectedToast("new", "No roster loaded", "", "common");
      return;
    }
    const p = fullPool[Math.floor(Math.random() * fullPool.length)];
    const eventType = Math.random() > 0.5 ? "HR" : "RBI";
    const tiers = ["common", "common", "rare", "epic", "legendary"];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    const badgeMap = {
      HR: { legendary: "WALK-OFF GRAND SLAM!", epic: "GRAND SLAM!", rare: "GO-AHEAD HOME RUN!", common: "\u{1F4A5} HOME RUN!" },
      RBI: { legendary: "WALK-OFF DOUBLE!", epic: "WALK-OFF SINGLE!", rare: "GO-AHEAD SINGLE!", common: "RBI SINGLE!" }
    };
    const rbiByTier = { legendary: 2, epic: 1, rare: 1, common: 1 };
    const innings = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const halves = ["top", "bottom"];
    const scores = [0, 1, 2, 3, 4, 5];
    collectCard({
      playerId: p.personId,
      playerName: p.personName,
      teamAbbr: p.teamData.short,
      teamPrimary: p.teamData.primary,
      teamSecondary: p.teamData.secondary,
      position: p.position,
      eventType,
      badge: badgeMap[eventType][tier],
      rbi: rbiByTier[tier],
      inning: innings[Math.floor(Math.random() * innings.length)],
      halfInning: halves[Math.floor(Math.random() * halves.length)],
      awayAbbr: "NYM",
      homeAbbr: p.teamData.short,
      awayScore: scores[Math.floor(Math.random() * scores.length)],
      homeScore: scores[Math.floor(Math.random() * scores.length)]
    }, true);
  }
  function resetCollection() {
    if (!confirm("Reset collection? This cannot be undone.")) return;
    localStorage.removeItem("mlb_card_collection");
    updateCollectionUI();
    if (state.mlbSessionToken) {
      fetch((window.API_BASE || "") + "/api/collection-sync", {
        method: "DELETE",
        headers: { "Authorization": "Bearer " + state.mlbSessionToken }
      }).catch(function() {
      });
    }
    alert("Collection reset");
  }

  // src/sections/yesterday.js
  var ydPrevSection = null;
  function forceHttps5(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function getYdActiveCache() {
    return state.ydDisplayCache !== null ? state.ydDisplayCache : state.yesterdayCache || [];
  }
  function openYesterdayRecap(offset) {
    state.yesterdayOverlayOpen = true;
    state.ydDateOffset = typeof offset === "number" ? offset : -1;
    state.ydDisplayCache = null;
    const active = document.querySelector(".section.active");
    ydPrevSection = active ? active.id : null;
    document.querySelectorAll(".section").forEach(function(s) {
      s.classList.remove("active");
    });
    document.querySelectorAll("nav button").forEach(function(b) {
      b.classList.remove("active");
    });
    document.getElementById("yesterday").classList.add("active");
    const lbl = document.getElementById("ydDateLabel");
    if (lbl) lbl.textContent = getYesterdayDisplayStr();
    const nextBtn = document.getElementById("ydNextDateBtn");
    if (nextBtn) nextBtn.disabled = state.ydDateOffset >= 0;
    if ((state.demoMode || state.ydDateOffset === 0) && loadYdForDate) {
      const card = document.getElementById("yesterdayCard");
      if (card) card.innerHTML = '<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading\u2026</div>';
      loadYdForDate(getYesterdayDateStr()).then(function(data) {
        state.ydDisplayCache = data || [];
        renderYesterdayRecap2();
      }).catch(function(e) {
        console.error("[yesterday] loadYdForDate error", e);
      });
    } else {
      renderYesterdayRecap2();
    }
  }
  async function ydChangeDate(dir) {
    const newOffset = state.ydDateOffset + dir;
    if (newOffset > 0) return;
    if (newOffset < -365) return;
    state.ydDateOffset = newOffset;
    const lbl = document.getElementById("ydDateLabel");
    if (lbl) lbl.textContent = getYesterdayDisplayStr();
    const nextBtn = document.getElementById("ydNextDateBtn");
    if (nextBtn) nextBtn.disabled = state.ydDateOffset >= 0;
    const card = document.getElementById("yesterdayCard");
    if (card) card.innerHTML = '<div style="padding:48px;text-align:center;color:var(--muted);font-size:.88rem">Loading\u2026</div>';
    const heroRegion = document.getElementById("ydHeroRegion");
    if (heroRegion) {
      heroRegion.dataset.mounted = "";
      heroRegion.innerHTML = "";
    }
    if (state.ydDateOffset === -1 && !state.demoMode) {
      state.ydDisplayCache = null;
    } else if (loadYdForDate) {
      state.ydDisplayCache = await loadYdForDate(getYesterdayDateStr());
    }
    renderYesterdayRecap2();
  }
  function closeYesterdayRecap() {
    state.yesterdayOverlayOpen = false;
    document.querySelectorAll(".section").forEach(function(s) {
      s.classList.remove("active");
    });
    const returnId = ydPrevSection || "pulse";
    const returnEl = document.getElementById(returnId);
    if (returnEl) returnEl.classList.add("active");
    document.querySelectorAll("nav button").forEach(function(b) {
      const onclick = b.getAttribute("onclick") || "";
      if (onclick.indexOf("'" + returnId + "'") !== -1) b.classList.add("active");
    });
  }
  function _ydAnchorDate() {
    return state.demoMode && state.demoDate ? new Date(state.demoDate) : /* @__PURE__ */ new Date();
  }
  function getYesterdayDateStr() {
    return etDatePlus(etDateStr(_ydAnchorDate()), state.ydDateOffset);
  }
  function getYesterdayDisplayStr() {
    const s = getYesterdayDateStr().split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[+s[1] - 1] + " " + +s[2] + ", " + s[0];
  }
  function getYesterdayCollectedCards() {
    const ydStr = getYesterdayDateStr();
    try {
      const col = loadCollection();
      const slots = Object.values(col).filter(function(s) {
        return s.events && s.events.some(function(ev) {
          return ev.date === ydStr;
        });
      });
      slots.sort(function(a, b) {
        return tierRank(b.tier) - tierRank(a.tier);
      });
      return slots.slice(0, 5);
    } catch (e) {
      return [];
    }
  }
  async function renderYesterdayRecap2() {
    const card = document.getElementById("yesterdayCard");
    if (!card) return;
    const activeCache = getYdActiveCache();
    if (!activeCache || !activeCache.length) {
      const noGamesMsg = state.ydDateOffset === -1 ? "No games yesterday." : "No games played on " + getYesterdayDisplayStr() + ".";
      card.innerHTML = '<div class="empty-state" style="padding:48px 24px">' + noGamesMsg + "</div>";
      return;
    }
    const ydCards = getYesterdayCollectedCards();
    let cardsHtml = "";
    if (ydCards.length && window.CollectionCard) {
      await Promise.all(ydCards.map(function(s) {
        return state.collectionCareerStatsCache[s.playerId] ? Promise.resolve() : fetchCareerStats(s.playerId, s.position).then(function(cs) {
          if (cs) state.collectionCareerStatsCache[s.playerId] = cs;
        });
      }));
      const miniCards = ydCards.map(function(s) {
        const key = s.playerId + "_" + s.eventType;
        const displayEvent = s.events && s.events[0] || null;
        const careerStats = state.collectionCareerStatsCache[s.playerId] || null;
        const cardHtml2 = window.CollectionCard.renderMiniCard(s, displayEvent, careerStats, null);
        return cardHtml2.replace("<article ", `<article onclick="openCardFromKey('` + key + `')" style="cursor:pointer" `);
      }).join("");
      const cardsLabel = "\u{1F3B4} CARDS \u2014 " + getYesterdayDisplayStr().toUpperCase();
      cardsHtml = '<div style="max-width:1100px;margin:0 auto;padding:16px 1.25rem;border-top:1px solid var(--border)"><div style="font-size:.7rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:12px">' + cardsLabel + '</div><div class="yd-clip-strip" style="display:flex;gap:0.75rem;overflow-x:auto;padding-bottom:8px">' + miniCards + "</div></div>";
    }
    const tilesHtml = activeCache.map(function(item) {
      let awayId = null, homeId = null;
      const sched = (state.scheduleData || []).find(function(s) {
        return s.gamePk === item.gamePk || s.gamePk === +item.gamePk;
      });
      if (sched) {
        awayId = sched.teams && sched.teams.away && sched.teams.away.team && sched.teams.away.team.id;
        homeId = sched.teams && sched.teams.home && sched.teams.home.team && sched.teams.home.team.id;
      }
      const awayTeam = awayId && TEAMS.find(function(t) {
        return t.id === awayId;
      });
      const homeTeam = homeId && TEAMS.find(function(t) {
        return t.id === homeId;
      });
      let capRow = "";
      if (awayTeam && homeTeam) {
        capRow = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><img src="https://www.mlbstatic.com/team-logos/' + awayId + `.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:.75rem;font-weight:700;color:var(--muted)">` + awayTeam.short + '</span><span style="font-size:.72rem;color:var(--muted)">@</span><img src="https://www.mlbstatic.com/team-logos/' + homeId + `.svg" style="width:28px;height:28px;object-fit:contain" onerror="this.style.display='none'"><span style="font-size:.75rem;font-weight:700;color:var(--muted)">` + homeTeam.short + "</span></div>";
      }
      const contentItems = state.yesterdayContentCache[item.gamePk] && state.yesterdayContentCache[item.gamePk].highlights && state.yesterdayContentCache[item.gamePk].highlights.highlights && state.yesterdayContentCache[item.gamePk].highlights.highlights.items || [];
      const videoTitle = contentItems[0] && (contentItems[0].headline || contentItems[0].blurb);
      const headlineText = videoTitle || item.headline.replace(/^Yesterday:\s*/, "");
      const videoRegion = '<div id="ydvideo_' + item.gamePk + '" style="margin-top:10px"></div>';
      return '<div id="ydtile_' + item.gamePk + '" class="card" style="padding:16px 18px">' + capRow + '<div class="yd-tile-headline" style="font-size:.88rem;color:var(--text);font-weight:600;line-height:1.45">' + headlineText + "</div>" + (item.sub ? '<div style="font-size:.72rem;color:var(--muted);margin-top:4px">' + item.sub + "</div>" : "") + videoRegion + '<div style="margin-top:12px"><button onclick="showLiveGame(' + item.gamePk + ')" style="background:none;border:1px solid var(--border);border-radius:16px;color:var(--accent);font-size:.72rem;font-weight:600;padding:5px 12px;cursor:pointer">Box Score \u2192</button></div></div>';
    }).join("");
    const tilesGrid = '<div class="yd-tiles-grid">' + tilesHtml + "</div>";
    card.innerHTML = '<div id="ydHeroRegion"></div><div id="ydVideoMeta" style="max-width:1100px;margin:0 auto;padding:8px 4px 0"></div><div id="ydHeroesStrip"></div>' + tilesGrid + cardsHtml;
    if ("IntersectionObserver" in window) {
      const obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          const tile = entry.target;
          const pk = tile.dataset.gamepk;
          if (pk) {
            loadYesterdayVideoStrip(+pk);
            obs.unobserve(tile);
          }
        });
      }, { root: null, rootMargin: "200px" });
      activeCache.forEach(function(item) {
        const tile = document.getElementById("ydtile_" + item.gamePk);
        if (tile) {
          tile.dataset.gamepk = item.gamePk;
          obs.observe(tile);
        }
      });
    } else {
      activeCache.forEach(function(item) {
        loadYesterdayVideoStrip(item.gamePk);
      });
    }
    loadYesterdayHero();
    prefetchAllYesterdayContent();
  }
  function pickMarqueeGame() {
    const cache = getYdActiveCache();
    if (!cache || !cache.length) return null;
    const walkoff = cache.find(function(item) {
      return item.headline && (item.headline.indexOf("Walk-off") !== -1 || item.headline.indexOf("walk-off") !== -1);
    });
    if (walkoff) return walkoff;
    const nohit = cache.find(function(item) {
      return item.headline && item.headline.indexOf("No-hitter") !== -1;
    });
    if (nohit) return nohit;
    return cache[0];
  }
  function mountSharedPlayer(heroRegion) {
    if (!heroRegion || heroRegion.dataset.mounted) return;
    heroRegion.dataset.mounted = "1";
    heroRegion.className = "yd-hero-grid";
    heroRegion.innerHTML = '<div class="yd-player-col"><div class="yd-video-wrap"><video id="ydSharedVideo" controls playsinline></video></div></div>';
  }
  async function loadYesterdayHero() {
    const heroRegion = document.getElementById("ydHeroRegion");
    if (!heroRegion) return;
    const marquee = pickMarqueeGame();
    if (!marquee) return;
    const content = await fetchGameContent(marquee.gamePk);
    if (!content) return;
    const items = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
    const playable = items.filter(function(item) {
      return !!pickPlayback(item.playbacks);
    });
    if (!playable.length) return;
    const first = playable[2] || playable[0];
    mountSharedPlayer(heroRegion);
    loadClipIntoSharedPlayer(
      pickPlayback(first.playbacks),
      pickHeroImage(first) || "",
      first.headline || first.blurb || "Top Highlight",
      first.blurb || "",
      "TOP HIGHLIGHT"
    );
  }
  function buildTopHighlightsCarousel() {
    const heroRegion = document.getElementById("ydHeroRegion");
    const ydCache = getYdActiveCache();
    if (!heroRegion || !ydCache || !ydCache.length) return;
    const marquee = pickMarqueeGame();
    const ordered = ydCache.slice().sort(function(a, b) {
      if (marquee) {
        if (a.gamePk === marquee.gamePk) return -1;
        if (b.gamePk === marquee.gamePk) return 1;
      }
      return 0;
    });
    state.ydHighlightClips = [];
    ordered.forEach(function(game) {
      const content = state.yesterdayContentCache[game.gamePk];
      if (!content) return;
      const items = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
      const playable = items.filter(function(item) {
        return !!pickPlayback(item.playbacks);
      });
      playable.slice(2, 5).forEach(function(clip) {
        state.ydHighlightClips.push(clip);
      });
    });
    if (!state.ydHighlightClips.length) return;
    mountSharedPlayer(heroRegion);
    const existing = document.getElementById("ydClipCarousel");
    if (existing) existing.parentNode.removeChild(existing);
    const chips = state.ydHighlightClips.map(function(clip, i) {
      const thumb = pickHeroImage(clip) || "";
      const title = (clip.headline || clip.blurb || "Highlight").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return '<div class="yd-clip-chip' + (i === 0 ? " active" : "") + '" onclick="selectYdClip(' + i + ')"><div class="yd-chip-thumb"><span style="font-size:1.1rem;color:var(--muted)">\u25B6</span>' + (thumb ? '<img src="' + thumb + `" onerror="this.style.display='none'" alt="">` : "") + '</div><div class="yd-chip-text">' + title + "</div></div>";
    }).join("");
    heroRegion.insertAdjacentHTML(
      "beforeend",
      '<div id="ydClipCarousel" class="yd-playlist yd-clip-strip"><div class="yd-playlist-kicker">TOP PLAYS</div>' + chips + "</div>"
    );
    loadClipIntoSharedPlayer(
      pickPlayback(state.ydHighlightClips[0].playbacks),
      pickHeroImage(state.ydHighlightClips[0]) || "",
      state.ydHighlightClips[0].headline || state.ydHighlightClips[0].blurb || "Top Highlight",
      state.ydHighlightClips[0].blurb || "",
      "TOP HIGHLIGHT"
    );
  }
  function selectYdClip(idx) {
    const carousel = document.getElementById("ydClipCarousel");
    if (carousel) carousel.querySelectorAll(".yd-clip-chip").forEach(function(c, i) {
      c.classList.toggle("active", i === idx);
    });
    const clip = state.ydHighlightClips[idx];
    if (!clip) return;
    loadClipIntoSharedPlayer(
      pickPlayback(clip.playbacks),
      pickHeroImage(clip) || "",
      clip.headline || clip.blurb || "Highlight",
      clip.blurb || "",
      "NOW PLAYING"
    );
  }
  function loadClipIntoSharedPlayer(url, poster, title, blurb, kicker) {
    const video = document.getElementById("ydSharedVideo");
    if (!video) return;
    stopAllMedia("highlight");
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (poster) video.poster = poster;
    else video.removeAttribute("poster");
    video.src = url;
    const meta = document.getElementById("ydVideoMeta");
    if (meta) {
      const k = kicker || "NOW PLAYING";
      const b = blurb && blurb !== title ? '<div style="font-size:.72rem;color:var(--muted);margin-top:2px">' + blurb + "</div>" : "";
      meta.innerHTML = '<div style="font-size:.62rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:3px">' + k + '</div><div style="font-size:.92rem;font-weight:700;color:var(--text);line-height:1.35">' + (title || "") + "</div>" + b;
    }
    const heroRegion = document.getElementById("ydHeroRegion");
    if (heroRegion) heroRegion.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function prefetchAllYesterdayContent() {
    const cache = getYdActiveCache();
    if (!cache || !cache.length) return;
    await Promise.all(cache.map(function(item) {
      return fetchGameContent(item.gamePk);
    }));
    buildAndRenderYesterdayHeroes();
    buildTopHighlightsCarousel();
  }
  function buildYesterdayHeroes() {
    const heroes = [];
    const seenPlayers = {};
    const ydCache = getYdActiveCache();
    if (!ydCache.length) return heroes;
    ydCache.forEach(function(cacheItem) {
      const content = state.yesterdayContentCache[cacheItem.gamePk];
      if (!content) return;
      const allItems = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
      const items = allItems.filter(function(clip) {
        return !(clip.keywordsAll || []).some(function(kw) {
          const v = (kw.value || kw.slug || "").toLowerCase();
          return v === "data-visualization" || v === "data_visualization";
        });
      });
      const playerClips = {};
      items.forEach(function(clip) {
        if (!clip.keywordsAll) return;
        const pidKw = clip.keywordsAll.find(function(kw) {
          return kw.type === "player_id" || kw.slug && kw.slug.startsWith("player_id-");
        });
        if (!pidKw) return;
        const pid = pidKw.value || pidKw.displayName || pidKw.slug;
        if (!pid) return;
        if (!playerClips[pid]) playerClips[pid] = { clips: [], name: "", isHR: false, isWalkoff: false, teamAbbr: "" };
        playerClips[pid].clips.push(clip);
        const isHRClip = clip.keywordsAll.some(function(kw) {
          return kw.type === "taxonomy" && kw.value === "home-run" || kw.slug === "home-run";
        });
        if (isHRClip) playerClips[pid].isHR = true;
        const isWO = (clip.headline || "").toLowerCase().indexOf("walk-off") !== -1 || (clip.blurb || "").toLowerCase().indexOf("walk-off") !== -1 || clip.keywordsAll.some(function(kw) {
          return kw.value === "walk-off" || kw.slug === "walk-off";
        });
        if (isWO) playerClips[pid].isWalkoff = true;
        if (!playerClips[pid].name && clip.headline) playerClips[pid].name = clip.headline.split("'")[0].split(" ").slice(0, 2).join(" ");
      });
      Object.keys(playerClips).forEach(function(pid) {
        if (seenPlayers[pid]) return;
        seenPlayers[pid] = true;
        const pc = playerClips[pid];
        if (!pc.isHR && !pc.isWalkoff) return;
        const hrCount = pc.clips.filter(function(c) {
          return c.keywordsAll && c.keywordsAll.some(function(kw) {
            return kw.value === "home-run" || kw.slug === "home-run";
          });
        }).length;
        const role = pc.isWalkoff ? "walkoff" : hrCount >= 2 ? "multi-HR" : "HR";
        let clip = pc.clips.find(function(c) {
          return pc.isWalkoff && (c.headline || "").toLowerCase().indexOf("walk-off") !== -1;
        });
        if (!clip) clip = pc.clips.find(function(c) {
          return c.keywordsAll && c.keywordsAll.some(function(kw) {
            return kw.value === "home-run" || kw.slug === "home-run";
          });
        });
        if (!clip) clip = pc.clips[0];
        const imgUrl = pickHeroImage(clip) || "";
        if (!imgUrl) return;
        heroes.push({ pid, playerName: pc.name, role, hrCount, imageUrl: imgUrl, blurb: clip.headline || clip.blurb || "", gamePk: cacheItem.gamePk, isWalkoff: pc.isWalkoff });
      });
    });
    const roleOrder = { walkoff: 0, "multi-HR": 1, HR: 2 };
    heroes.sort(function(a, b) {
      return (roleOrder[a.role] || 9) - (roleOrder[b.role] || 9);
    });
    return heroes;
  }
  function buildAndRenderYesterdayHeroes() {
    const stripEl = document.getElementById("ydHeroesStrip");
    if (!stripEl) return;
    const heroes = buildYesterdayHeroes();
    if (!heroes.length) return;
    const roleLabel = { walkoff: "WALK-OFF", "multi-HR": function(h) {
      return h.hrCount + " HR";
    }, "HR": "HR" };
    const tiles = heroes.map(function(h) {
      const lbl = typeof roleLabel[h.role] === "function" ? roleLabel[h.role](h) : roleLabel[h.role];
      const lastName = h.playerName ? h.playerName.split(" ").pop() : h.playerName;
      const heroUrl = h.imageUrl ? forceHttps5(h.imageUrl) : "";
      return '<div onclick="scrollToYdTile(' + h.gamePk + ')" style="cursor:pointer;flex-shrink:0;width:110px;position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border)"><img src="' + heroUrl + `" style="width:110px;height:74px;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none'"><div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.82));padding:4px 6px"><div style="font-size:.58rem;font-weight:700;color:#f59e0b;letter-spacing:.06em">` + lbl + '</div><div style="font-size:.68rem;font-weight:700;color:#fff">' + lastName + "</div></div></div>";
    }).join("");
    const heroesLabel = state.ydDateOffset === -1 ? "YESTERDAY'S HEROES" : "HEROES \xB7 " + getYesterdayDisplayStr().toUpperCase();
    stripEl.innerHTML = '<div style="max-width:1100px;margin:0 auto;padding:10px 1.25rem 0;border-top:1px solid var(--border)"><div style="font-size:.65rem;font-weight:700;color:var(--muted);letter-spacing:.1em;margin-bottom:8px">' + heroesLabel + '</div><div class="yd-clip-strip" style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px">' + tiles + "</div></div>";
  }
  function scrollToYdTile(gamePk) {
    const tile = document.getElementById("ydtile_" + gamePk);
    if (tile) tile.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function loadYesterdayVideoStrip(gamePk) {
    const region = document.getElementById("ydvideo_" + gamePk);
    if (!region || region.dataset.loaded) return;
    region.dataset.loaded = "1";
    const content = await fetchGameContent(gamePk);
    if (!content) return;
    const items = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
    if (!items.length) return;
    const playable = items.filter(function(item) {
      return !!pickPlayback(item.playbacks);
    });
    if (!playable.length) return;
    region.innerHTML = renderHighlightStrip(playable, gamePk);
    const tile = document.getElementById("ydtile_" + gamePk);
    if (tile && playable[0]) {
      const vTitle = playable[0].headline || playable[0].blurb;
      if (vTitle) {
        const headlineEl = tile.querySelector(".yd-tile-headline");
        if (headlineEl) headlineEl.textContent = vTitle;
      }
    }
  }
  function renderHighlightStrip(items, gamePk) {
    const item = items[0];
    if (!item) return "";
    const imgUrl = pickHeroImage(item) || "";
    const safeUrl = imgUrl ? forceHttps5(imgUrl) : "";
    const title = (item.headline || item.blurb || "Game Highlight").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return '<div class="yd-game-thumb" onclick="playYesterdayClip(' + JSON.stringify(gamePk) + ',0)">' + (safeUrl ? '<img src="' + safeUrl + `" loading="lazy" alt="" onerror="this.style.display='none'">` : '<div style="width:100%;height:140px;background:var(--card);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:2rem">\u25B6</div>') + '<div class="yd-game-thumb-play"><span>\u25B6</span></div><div class="yd-game-thumb-label">' + title + "</div></div>";
  }
  function playYesterdayClip(gamePk, itemIndex) {
    const content = state.yesterdayContentCache[gamePk];
    if (!content) return;
    const items = content.highlights && content.highlights.highlights && content.highlights.highlights.items || [];
    const playable = items.filter(function(item2) {
      return !!pickPlayback(item2.playbacks);
    });
    const item = playable[itemIndex];
    if (!item) return;
    const carousel = document.getElementById("ydClipCarousel");
    if (carousel) carousel.querySelectorAll(".yd-clip-chip").forEach(function(c) {
      c.classList.remove("active");
    });
    loadClipIntoSharedPlayer(
      pickPlayback(item.playbacks),
      pickHeroImage(item) || "",
      item.headline || item.blurb || "Game Highlight",
      item.blurb || "",
      "GAME HIGHLIGHT"
    );
  }

  // src/cards/playerCard.js
  var _fetchBoxscore = null;
  var _collectCard = null;
  function setPlayerCardCallbacks(cbs) {
    if (cbs.fetchBoxscore) _fetchBoxscore = cbs.fetchBoxscore;
    if (cbs.collectCard) _collectCard = cbs.collectCard;
  }
  function getHRBadge(rbi, halfInning, inning, aScore, hScore) {
    const battingAfter = halfInning === "bottom" ? hScore : aScore;
    const fieldingScore = halfInning === "bottom" ? aScore : hScore;
    const battingBefore = battingAfter - rbi;
    const deficitBefore = fieldingScore - battingBefore;
    const marginAfter = battingAfter - fieldingScore;
    const isWalkoff = halfInning === "bottom" && inning >= 9 && deficitBefore >= 0 && marginAfter > 0;
    const isGoAhead = deficitBefore >= 0 && marginAfter > 0;
    const isGrandSlam = rbi === 4;
    if (isWalkoff && isGrandSlam) return "WALK-OFF GRAND SLAM!";
    if (isWalkoff) return "WALK-OFF HOME RUN!";
    if (isGrandSlam) return "GRAND SLAM!";
    if (isGoAhead) return "GO-AHEAD HOME RUN!";
    return "\u{1F4A5} HOME RUN!";
  }
  function calcRBICardScore(rbi, event, aScore, hScore, inning, halfInning) {
    if (!rbi || rbi < 1) return 0;
    const base = rbi === 1 ? 10 : rbi === 2 ? 25 : rbi === 3 ? 40 : 55;
    const hitMult = event === "Double" ? 1.5 : event === "Triple" ? 2 : ["Sac Fly", "Sac Bunt", "Walk", "Hit By Pitch", "Grounded Into DP", "Field's Choice"].indexOf(event) !== -1 ? 0.7 : 1;
    const battingAfter = halfInning === "top" ? aScore : hScore;
    const fieldingScore = halfInning === "top" ? hScore : aScore;
    const battingBefore = battingAfter - rbi;
    const deficitBefore = fieldingScore - battingBefore;
    const marginAfter = battingAfter - fieldingScore;
    let ctx = 0;
    if (deficitBefore >= 0 && marginAfter > 0) ctx += 30;
    else if (deficitBefore > 0 && marginAfter === 0) ctx += 25;
    if (deficitBefore >= 3 && marginAfter >= -1) ctx += 20;
    if (marginAfter - rbi >= 5) ctx -= 15;
    const innMult = inning <= 3 ? 0.4 : inning <= 6 ? 0.75 : inning <= 8 ? 1 : inning === 9 ? 1.4 : 1.6;
    const score = (base * hitMult + ctx) * innMult;
    return score;
  }
  function getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter) {
    const lm = { "Single": "SINGLE", "Double": "DOUBLE", "Triple": "TRIPLE", "Sac Fly": "SAC FLY", "Walk": "WALK", "Hit By Pitch": "HBP" };
    const label = lm[event] || null;
    const goAhead = deficitBefore >= 0 && marginAfter > 0;
    const equalizer = deficitBefore > 0 && marginAfter === 0;
    if (goAhead && halfInning === "bottom" && inning >= 9 && label) return "WALK-OFF " + label + "!";
    if (goAhead && label) return "GO-AHEAD " + label + "!";
    if (equalizer && label) return label + " TIES IT!";
    if (rbi >= 2 && label) return rbi + "-RUN " + label;
    if (label) return "RBI " + label + "!";
    return "RBI!";
  }
  async function resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk) {
    const battingTeamId = halfInning === "top" ? awayTeamId : homeTeamId;
    const teamData = TEAMS.find(function(t) {
      return t.id === battingTeamId;
    }) || {};
    let stat = null, jerseyNumber = null, position = null;
    if (overrideStats) {
      stat = overrideStats;
    } else {
      const cached = (state.statsCache.hitting || []).find(function(e) {
        return e.player && e.player.id === batterId;
      });
      if (cached) {
        stat = cached.stat;
      }
      if (!stat) {
        try {
          const r = await fetch(MLB_BASE + "/people/" + batterId + "/stats?stats=season&season=" + SEASON + "&group=hitting");
          if (!r.ok) throw new Error(r.status);
          const d = await r.json();
          stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
        } catch (e) {
          stat = null;
        }
      }
    }
    if (stat && batterId) state.hrBatterStatsCache[batterId] = stat;
    let rEntry = (state.rosterData.hitting || []).find(function(p) {
      return p.person && p.person.id === batterId;
    });
    if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) {
      return p.person && p.person.id === batterId;
    });
    if (rEntry && rEntry.jerseyNumber) jerseyNumber = rEntry.jerseyNumber;
    position = rEntry && rEntry.position && rEntry.position.abbreviation || null;
    if (!position && overrideStats && overrideStats._position) position = overrideStats._position;
    if (!jerseyNumber && overrideStats && overrideStats._jersey) jerseyNumber = overrideStats._jersey;
    if ((!position || !jerseyNumber) && gamePk && _fetchBoxscore) {
      try {
        const bs = await _fetchBoxscore(gamePk);
        const allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
        const playerData = allPlayers.find(function(p) {
          return p.person && p.person.id === batterId;
        });
        if (playerData) {
          if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
          if (!position && playerData.position && playerData.position.code) {
            const posCode = playerData.position.code;
            const posMap = { "1": "P", "2": "C", "3": "1B", "4": "2B", "5": "3B", "6": "SS", "7": "LF", "8": "CF", "9": "RF", "10": "DH" };
            position = posMap[posCode] || playerData.position.code;
          }
        }
      } catch (e) {
      }
    }
    let hrCount = stat ? stat.homeRuns != null ? stat.homeRuns : "\u2014" : "\u2014";
    if (descHint) {
      const _m = descHint.match(/\((\d+)\)/);
      if (_m) {
        const _n = parseInt(_m[1], 10);
        if (typeof hrCount !== "number" || hrCount < _n) hrCount = _n;
      }
    }
    return {
      batterId,
      batterName,
      teamData,
      teamAbbr: teamData.short || "???",
      jerseyNumber,
      position: position || "\u2014",
      hrCount,
      hrPrev: typeof hrCount === "number" && hrCount >= 1 ? hrCount - 1 : hrCount,
      avg: stat ? fmtRate(stat.avg) : "\u2014",
      ops: stat ? fmtRate(stat.ops) : "\u2014",
      rbi: stat ? stat.rbi != null ? stat.rbi : "\u2014" : "\u2014"
    };
  }
  async function showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, badgeText, gamePk) {
    const overlay = document.getElementById("playerCardOverlay");
    const card = document.getElementById("playerCard");
    if (!overlay || !card) return;
    card.innerHTML = '<div class="pc-loading">Loading player card\u2026</div>';
    overlay.classList.remove("closing");
    overlay.classList.add("open");
    const d = await resolvePlayerCardData(batterId, batterName, awayTeamId, homeTeamId, halfInning, overrideStats, descHint, gamePk);
    card.innerHTML = window.PulseCard.render({
      batterId: d.batterId,
      name: d.batterName,
      team: { short: d.teamAbbr, primary: d.teamData.primary, secondary: d.teamData.secondary },
      position: d.position,
      jersey: d.jerseyNumber,
      badge: badgeText || "HOME RUN",
      stats: { avg: d.avg, ops: d.ops, hr: d.hrPrev, rbi: d.rbi },
      highlight: "hr"
    });
    if (typeof d.hrCount === "number" && d.hrCount >= 1) {
      setTimeout(function() {
        const el = card.querySelector(".pc-hr-val");
        if (el) {
          el.textContent = d.hrCount;
          el.classList.add("counting");
        }
      }, 500);
    }
    if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
    window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
    if (_collectCard) {
      const gs = state.gameStates[gamePk] || {};
      _collectCard({
        playerId: d.batterId,
        playerName: d.batterName,
        teamAbbr: d.teamAbbr,
        teamPrimary: d.teamData.primary,
        teamSecondary: d.teamData.secondary,
        position: d.position || "",
        eventType: "HR",
        badge: badgeText || "\u{1F4A5} HOME RUN!",
        inning: gs.inning || 0,
        halfInning,
        awayAbbr: gs.awayAbbr || "",
        homeAbbr: gs.homeAbbr || "",
        awayScore: gs.awayScore || 0,
        homeScore: gs.homeScore || 0
      });
    }
  }
  async function showRBICard(batterId, batterName, awayTeamId, homeTeamId, halfInning, rbi, event, aScore, hScore, inning, gamePk) {
    const overlay = document.getElementById("playerCardOverlay");
    const card = document.getElementById("playerCard");
    if (!overlay || !card) return;
    const battingTeamId = halfInning === "top" ? awayTeamId : homeTeamId;
    const teamData = TEAMS.find(function(t) {
      return t.id === battingTeamId;
    }) || {};
    const awayData = TEAMS.find(function(t) {
      return t.id === awayTeamId;
    }) || {};
    const homeData = TEAMS.find(function(t) {
      return t.id === homeTeamId;
    }) || {};
    const teamAbbr = teamData.short || "???";
    const awayAbbr = awayData.short || "AWY";
    const homeAbbr = homeData.short || "HME";
    card.innerHTML = '<div class="pc-loading">Loading player card\u2026</div>';
    overlay.classList.remove("closing");
    overlay.classList.add("open");
    let stat = null;
    const cached = (state.statsCache.hitting || []).find(function(e) {
      return e.player && e.player.id === batterId;
    });
    if (cached) stat = cached.stat;
    if (!stat) {
      try {
        const r = await fetch(MLB_BASE + "/people/" + batterId + "/stats?stats=season&season=" + SEASON + "&group=hitting");
        if (!r.ok) throw new Error(r.status);
        const d = await r.json();
        stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
      } catch (e) {
        stat = null;
      }
    }
    const rbiSeason = stat ? stat.rbi != null ? stat.rbi : "\u2014" : "\u2014";
    const hits = stat ? stat.hits != null ? stat.hits : "\u2014" : "\u2014";
    const avg = stat ? fmtRate(stat.avg) : "\u2014";
    const ops = stat ? fmtRate(stat.ops) : "\u2014";
    const rbiPrev = typeof rbiSeason === "number" && rbiSeason >= rbi ? rbiSeason - rbi : rbiSeason;
    const battingAfter = halfInning === "top" ? aScore : hScore;
    const fieldingScore = halfInning === "top" ? hScore : aScore;
    const deficitBefore = fieldingScore - (battingAfter - rbi);
    const marginAfter = battingAfter - fieldingScore;
    const badge = getRBIBadge(rbi, event, halfInning, inning, deficitBefore, marginAfter);
    let rEntry = (state.rosterData.hitting || []).find(function(p) {
      return p.person && p.person.id === batterId;
    });
    if (!rEntry) rEntry = (state.rosterData.pitching || []).find(function(p) {
      return p.person && p.person.id === batterId;
    });
    let jerseyNumber = rEntry && rEntry.jerseyNumber ? rEntry.jerseyNumber : null;
    let position = rEntry && rEntry.position && rEntry.position.abbreviation || null;
    if ((!position || !jerseyNumber) && gamePk && _fetchBoxscore) {
      try {
        const bs = await _fetchBoxscore(gamePk);
        const allPlayers = Object.values(bs.teams.away.players).concat(Object.values(bs.teams.home.players));
        const playerData = allPlayers.find(function(p) {
          return p.person && p.person.id === batterId;
        });
        if (playerData) {
          if (!jerseyNumber && playerData.jerseyNumber) jerseyNumber = playerData.jerseyNumber;
          if (!position && playerData.position && playerData.position.code) {
            const posCode = playerData.position.code;
            const posMap = { "1": "P", "2": "C", "3": "1B", "4": "2B", "5": "3B", "6": "SS", "7": "LF", "8": "CF", "9": "RF", "10": "DH" };
            position = posMap[posCode] || playerData.position.code;
          }
        }
      } catch (e) {
      }
    }
    position = position || "\u2014";
    card.innerHTML = window.PulseCard.render({
      batterId,
      name: batterName,
      team: { short: teamAbbr, primary: teamData.primary, secondary: teamData.secondary },
      position,
      jersey: jerseyNumber,
      badge,
      stats: { avg, ops, h: hits, rbi: rbiPrev },
      highlight: "rbi"
    });
    if (typeof rbiSeason === "number" && rbiSeason >= 1) {
      setTimeout(function() {
        const el = card.querySelector(".pc-rbi-val");
        if (el) {
          el.textContent = rbiSeason;
          el.classList.add("counting");
        }
      }, 500);
    }
    if (window._playerCardTimer) clearTimeout(window._playerCardTimer);
    window._playerCardTimer = setTimeout(dismissPlayerCard, TIMING.CARD_DISMISS_MS);
    if (_collectCard) {
      _collectCard({
        playerId: batterId,
        playerName: batterName,
        teamAbbr,
        teamPrimary: teamData.primary,
        teamSecondary: teamData.secondary,
        position: position || "",
        eventType: "RBI",
        badge,
        rbi,
        inning,
        halfInning,
        awayAbbr,
        homeAbbr,
        awayScore: aScore,
        homeScore: hScore
      });
    }
  }
  function replayHRCard(itemIndex) {
    const hrs = state.feedItems.filter(function(item2) {
      return item2.data && item2.data.event === "Home Run";
    });
    if (!hrs.length) {
      alert("No home runs in feed yet");
      return;
    }
    const idx = itemIndex !== void 0 ? itemIndex : 0;
    if (idx < 0 || idx >= hrs.length) {
      alert("Index out of range");
      return;
    }
    const item = hrs[idx];
    const play = item.data;
    const gs = state.gameStates[item.gamePk];
    if (!gs) {
      alert("Game state not found");
      return;
    }
    const batterId = play.batterId;
    const batterName = play.batterName;
    const awayTeamId = gs.awayId;
    const homeTeamId = gs.homeId;
    const halfInning = play.halfInning || gs.halfInning;
    const badgeText = play.desc.includes("walk-off") ? "WALK-OFF HOME RUN!" : "\u{1F4A5} HOME RUN!";
    showPlayerCard(batterId, batterName, awayTeamId, homeTeamId, halfInning, null, null, badgeText, item.gamePk);
  }
  function replayRBICard(itemIndex) {
    const rbis = state.feedItems.filter(function(item2) {
      return item2.data && item2.data.scoring && item2.data.event !== "Home Run" && item2.data.batterId;
    });
    if (!rbis.length) {
      alert("No RBI plays in feed yet");
      return;
    }
    const idx = itemIndex !== void 0 ? itemIndex : 0;
    if (idx < 0 || idx >= rbis.length) {
      alert("Index out of range");
      return;
    }
    const item = rbis[idx];
    const play = item.data;
    const gs = state.gameStates[item.gamePk];
    if (!gs) {
      alert("Game state not found");
      return;
    }
    showRBICard(play.batterId, play.batterName, gs.awayId, gs.homeId, play.halfInning, 1, play.event, play.awayScore, play.homeScore, play.inning, item.gamePk);
  }

  // src/pulse/poll.js
  var _pruneStaleGames = null;
  var _refreshDebugPanel = null;
  var _updateInningStates = null;
  var _localDateStr = null;
  function setPollCallbacks(cbs) {
    if (cbs.pruneStaleGames) _pruneStaleGames = cbs.pruneStaleGames;
    if (cbs.refreshDebugPanel) _refreshDebugPanel = cbs.refreshDebugPanel;
    if (cbs.updateInningStates) _updateInningStates = cbs.updateInningStates;
    if (cbs.localDateStr) _localDateStr = cbs.localDateStr;
  }
  function getEffectiveDate() {
    return state.demoMode && state.demoDate ? state.demoDate : /* @__PURE__ */ new Date();
  }
  async function pollLeaguePulse() {
    if (state.pulseAbortCtrl) {
      state.pulseAbortCtrl.abort();
    }
    state.pulseAbortCtrl = new AbortController();
    const sig = state.pulseAbortCtrl.signal;
    const hasLive = Object.values(state.gameStates).some(function(g) {
      return g.status === "Live";
    });
    devTrace("poll", "pollLeaguePulse start \xB7 hasLive=" + hasLive + " \xB7 pollDate=" + state.pollDateStr + " \xB7 games=" + Object.keys(state.gameStates).length + " \xB7 enabled=" + state.enabledGames.size);
    const isMidnightWindow = !state.demoMode && etHour() < 6;
    if (!hasLive) {
      const hasGamesFromCurrentDate = state.pollDateStr && Object.values(state.gameStates).some(function(g) {
        return g.gameDateMs && _localDateStr(new Date(g.gameDateMs)) === state.pollDateStr;
      });
      if (!hasGamesFromCurrentDate && !isMidnightWindow) {
        state.pollDateStr = _localDateStr(getEffectiveDate());
      } else if (!isMidnightWindow && isPostSlate()) {
        const todayStr = _localDateStr(getEffectiveDate());
        if (state.pollDateStr < todayStr) {
          if (_pruneStaleGames) _pruneStaleGames(todayStr);
          state.pollDateStr = todayStr;
        }
      }
    }
    let dateStr = state.pollDateStr;
    try {
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&date=" + dateStr + "&hydrate=linescore,team,probablePitcher", { signal: sig });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      let games = (d.dates || []).flatMap(function(dt) {
        return dt.games || [];
      });
      devTrace("poll", "schedule fetch \xB7 date=" + dateStr + " \xB7 games=" + games.length);
      const hasLiveInFetch = games.some(function(g) {
        return g.status.abstractGameState === "Live";
      });
      if ((!games.length || isMidnightWindow && !hasLiveInFetch) && !hasLive) {
        const yDateStr = etDatePlus(etDateStr(), -1);
        const yr = await fetch(MLB_BASE + "/schedule?sportId=1&date=" + yDateStr + "&hydrate=linescore,team,probablePitcher", { signal: sig });
        if (!yr.ok) throw new Error(yr.status);
        const yd = await yr.json();
        const yGames = (yd.dates || []).flatMap(function(dt) {
          return dt.games || [];
        });
        if (yGames.length) {
          games = yGames;
          dateStr = yDateStr;
          state.pollDateStr = dateStr;
        }
      }
      state.storyCarouselRawGameData = {};
      games.forEach(function(g) {
        state.storyCarouselRawGameData[g.gamePk] = g;
      });
      const pendingFinalItems = {};
      games.forEach(function(g) {
        const pk = g.gamePk, newStatus = g.status.abstractGameState, detailed = g.status.detailedState || "";
        const away = g.teams.away, home = g.teams.home;
        const awayTc = tcLookup(away.team.id), homeTc = tcLookup(home.team.id);
        let ls = g.linescore || {}, gameTime = null, gameDateMs = null;
        if (g.gameDate) {
          try {
            const gd = new Date(g.gameDate);
            gameTime = gd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            gameDateMs = gd.getTime();
          } catch (e) {
          }
        }
        if (!state.gameStates[pk]) {
          state.gameStates[pk] = {
            gamePk: pk,
            awayId: away.team.id,
            homeId: home.team.id,
            awayAbbr: away.team.abbreviation,
            homeAbbr: home.team.abbreviation,
            awayName: away.team.name,
            homeName: home.team.name,
            awayPrimary: awayTc.primary,
            homePrimary: homeTc.primary,
            awayScore: away.score || 0,
            homeScore: home.score || 0,
            awayW: away.leagueRecord ? away.leagueRecord.wins : null,
            awayL: away.leagueRecord ? away.leagueRecord.losses : null,
            homeW: home.leagueRecord ? home.leagueRecord.wins : null,
            homeL: home.leagueRecord ? home.leagueRecord.losses : null,
            status: newStatus,
            detailedState: detailed,
            inning: ls.currentInning || 1,
            halfInning: (ls.inningHalf || "Top").toLowerCase(),
            outs: ls.outs || 0,
            awayHits: ls.teams && ls.teams.away ? ls.teams.away.hits || 0 : 0,
            homeHits: ls.teams && ls.teams.home ? ls.teams.home.hits || 0 : 0,
            playCount: 0,
            lastTimestamp: null,
            gameTime,
            gameDateMs,
            venueName: g.venue ? g.venue.name : null,
            onFirst: !!(ls.offense && ls.offense.first),
            onSecond: !!(ls.offense && ls.offense.second),
            onThird: !!(ls.offense && ls.offense.third)
          };
          if (!state.myTeamLens || state.gameStates[pk].awayId === state.activeTeam.id || state.gameStates[pk].homeId === state.activeTeam.id) state.enabledGames.add(pk);
          const g0 = state.gameStates[pk], ts0 = gameDateMs ? new Date(gameDateMs) : /* @__PURE__ */ new Date();
          if (newStatus === "Final") {
            const isHistPpd = detailed === "Postponed" || detailed === "Cancelled" || detailed === "Suspended";
            if (isHistPpd) {
              if (!gameDateMs || Date.now() >= gameDateMs) addFeedItem(pk, { type: "status", icon: "\u{1F327}\uFE0F", label: "Game Postponed", sub: g0.awayAbbr + " @ " + g0.homeAbbr, playTime: ts0 });
            } else {
              const durLabel = ls.gameDurationMinutes ? "  \xB7  " + Math.floor(ls.gameDurationMinutes / 60) + "h " + String(ls.gameDurationMinutes % 60).padStart(2, "0") + "m" : "";
              pendingFinalItems[pk] = { sub: g0.awayAbbr + " " + (away.score || 0) + ", " + g0.homeAbbr + " " + (home.score || 0) + durLabel };
            }
          } else if (newStatus === "Live" && detailed === "In Progress") {
            addFeedItem(pk, { type: "status", icon: "\u26BE", label: "Game underway!", sub: g0.awayAbbr + " @ " + g0.homeAbbr, playTime: ts0 });
          } else if (detailed.toLowerCase().indexOf("delay") !== -1) {
            addFeedItem(pk, { type: "status", icon: "\u{1F327}\uFE0F", label: "Game Delayed", sub: g0.awayAbbr + " @ " + g0.homeAbbr + " \xB7 " + detailed, playTime: ts0 });
          }
        } else {
          const prev = state.gameStates[pk];
          if (gameTime) prev.gameTime = gameTime;
          if (gameDateMs) prev.gameDateMs = gameDateMs;
          if (prev.detailedState !== "In Progress" && detailed === "In Progress") {
            const ts1 = gameDateMs ? new Date(gameDateMs) : /* @__PURE__ */ new Date();
            addFeedItem(pk, { type: "status", icon: "\u26BE", label: "Game underway!", sub: prev.awayAbbr + " @ " + prev.homeAbbr, playTime: ts1 });
            playSound("gameStart");
          }
          if (prev.status !== "Final" && newStatus === "Final") {
            devTrace("poll", "game final \xB7 " + prev.awayAbbr + " @ " + prev.homeAbbr + " \xB7 " + prev.awayScore + "-" + prev.homeScore);
            const isGamePostponed = detailed === "Postponed" || detailed === "Cancelled" || detailed === "Suspended";
            const tsFinal = gameDateMs ? new Date(gameDateMs + (ls.gameDurationMinutes || 180) * 6e4) : /* @__PURE__ */ new Date();
            if (isGamePostponed) {
              addFeedItem(pk, { type: "status", icon: "\u{1F327}\uFE0F", label: "Game Postponed", sub: prev.awayAbbr + " @ " + prev.homeAbbr, playTime: tsFinal });
            } else {
              addFeedItem(pk, { type: "status", icon: "\u{1F3C1}", label: "Game Final", sub: prev.awayAbbr + " " + (away.score || 0) + ", " + prev.homeAbbr + " " + (home.score || 0), playTime: tsFinal });
              playSound("gameEnd");
            }
            delete state.perfectGameTracker[pk];
          }
          if (detailed.toLowerCase().indexOf("delay") !== -1 && prev.detailedState.toLowerCase().indexOf("delay") === -1) {
            const tsDelay = gameDateMs ? new Date(gameDateMs) : /* @__PURE__ */ new Date();
            addFeedItem(pk, { type: "status", icon: "\u{1F327}\uFE0F", label: "Game Delayed", sub: prev.awayAbbr + " @ " + prev.homeAbbr + " \xB7 " + detailed, playTime: tsDelay });
          }
          prev.detailedState = detailed;
          prev.status = newStatus;
          prev.awayScore = away.score || 0;
          prev.homeScore = home.score || 0;
          prev.inning = ls.currentInning || prev.inning;
          prev.halfInning = (ls.inningHalf || "Top").toLowerCase();
          prev.outs = ls.outs || 0;
          if (ls.teams && ls.teams.away) prev.awayHits = ls.teams.away.hits || 0;
          if (ls.teams && ls.teams.home) prev.homeHits = ls.teams.home.hits || 0;
          prev.onFirst = !!(ls.offense && ls.offense.first);
          prev.onSecond = !!(ls.offense && ls.offense.second);
          prev.onThird = !!(ls.offense && ls.offense.third);
        }
      });
      const liveGames = games.filter(function(g) {
        return g.status.abstractGameState === "Live" || pendingFinalItems[g.gamePk];
      });
      await Promise.all(liveGames.map(function(g) {
        return pollGamePlays(g.gamePk);
      }));
      Object.keys(pendingFinalItems).forEach(function(pk) {
        const pf = pendingFinalItems[pk];
        const gamePlays = state.feedItems.filter(function(fi) {
          return fi.gamePk == pk && fi.data && fi.data.type === "play";
        });
        if (gamePlays.length > 0) addFeedItem(+pk, { type: "status", icon: "\u{1F3C1}", label: "Game Final", sub: pf.sub, playTime: new Date(gamePlays[0].ts.getTime() + 6e4) });
      });
      if (state.isFirstPoll && state.feedItems.length > 0) {
        state.feedItems.sort(function(a, b) {
          return b.ts - a.ts;
        });
        renderFeed();
      }
      state.isFirstPoll = false;
      if (_updateInningStates) _updateInningStates();
      renderTicker();
      updateFeedEmpty();
      renderSideRailGames();
      pollPendingVideoClips();
      selectFocusGame();
      if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
        window.Recorder._captureGameStates();
        window.Recorder._captureFocusTrack();
      }
      if (_refreshDebugPanel) _refreshDebugPanel();
      const live = Object.values(state.gameStates).filter(function(g) {
        return g.status === "Live" && g.detailedState === "In Progress";
      }).length;
      const final = Object.values(state.gameStates).filter(function(g) {
        return g.status === "Final";
      }).length;
      devTrace("poll", "pollLeaguePulse end \xB7 live=" + live + " \xB7 final=" + final + " \xB7 games=" + Object.keys(state.gameStates).length + " \xB7 enabled=" + state.enabledGames.size + " \xB7 state.feedItems=" + state.feedItems.length);
    } catch (e) {
      if (e.name !== "AbortError") console.error("poll error", e);
    }
  }
  async function pollGamePlays(gamePk) {
    try {
      const g = state.gameStates[gamePk];
      if (!g) return;
      const tsResp = await fetch(MLB_BASE_V1_1 + "/game/" + gamePk + "/feed/live/timestamps");
      if (!tsResp.ok) throw new Error(tsResp.status);
      const tsData = await tsResp.json();
      const latestTs = Array.isArray(tsData) ? tsData[tsData.length - 1] : null;
      if (latestTs && latestTs === g.lastTimestamp) return;
      if (latestTs) g.lastTimestamp = latestTs;
      const r = await fetch(MLB_BASE + "/game/" + gamePk + "/playByPlay");
      if (!r.ok) throw new Error(r.status);
      const data = await r.json();
      const plays = (data.allPlays || []).filter(function(p) {
        return p.about && p.about.isComplete;
      });
      const lastCount = g.playCount || 0, isHistory = lastCount === 0 && plays.length > 0 || state.tabHiddenAt !== null;
      plays.slice(lastCount).forEach(function(play) {
        const event = play.result && play.result.event || "";
        const isScoringP = play.about && play.about.isScoringPlay || false;
        const aScore = play.result && play.result.awayScore != null ? play.result.awayScore : g.awayScore;
        const hScore = play.result && play.result.homeScore != null ? play.result.homeScore : g.homeScore;
        const inning = play.about && play.about.inning || g.inning;
        const halfInning = play.about && play.about.halfInning || g.halfInning;
        const outs = play.count && play.count.outs || 0;
        const desc = play.result && play.result.description || "\u2014";
        const batterId = play.matchup && play.matchup.batter && play.matchup.batter.id || null;
        const batterName = play.matchup && play.matchup.batter && play.matchup.batter.fullName || "";
        const runners = play.runners || [];
        const hasRISP = outs < 3 && runners.some(function(r2) {
          return r2.movement && !r2.movement.isOut && (r2.movement.end === "2B" || r2.movement.end === "3B");
        });
        let postOnFirst = false, postOnSecond = false, postOnThird = false;
        runners.forEach(function(rn) {
          const m = rn.movement || {};
          if (!m.end || m.isOut) return;
          if (m.end === "1B") postOnFirst = true;
          else if (m.end === "2B") postOnSecond = true;
          else if (m.end === "3B") postOnThird = true;
        });
        const playClass = event === "Home Run" ? "homerun" : isScoringP ? "scoring" : hasRISP ? "risp" : "normal";
        let playTime = null;
        if (play.about && play.about.startTime) {
          try {
            playTime = new Date(play.about.startTime);
          } catch (e) {
          }
        }
        const pitcherId = play.matchup && play.matchup.pitcher && play.matchup.pitcher.id || null;
        const pitcherName = play.matchup && play.matchup.pitcher && play.matchup.pitcher.fullName || "";
        const hrDistance = event === "Home Run" && play.hitData && play.hitData.totalDistance > 0 ? Math.round(play.hitData.totalDistance) : null;
        const hrSpeed = event === "Home Run" && play.hitData && play.hitData.launchSpeed > 0 ? Math.round(play.hitData.launchSpeed) : null;
        const playRbi = play.result && play.result.rbi != null ? play.result.rbi : null;
        addFeedItem(gamePk, { type: "play", event, desc, scoring: isScoringP, awayScore: aScore, homeScore: hScore, inning, halfInning, outs, risp: hasRISP, playClass, playTime, batterId, batterName, pitcherId, pitcherName, distance: hrDistance, speed: hrSpeed, rbi: playRbi, onFirst: postOnFirst, onSecond: postOnSecond, onThird: postOnThird, awayHits: g.awayHits, homeHits: g.homeHits });
        if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
          window.Recorder._capturePlayPitches(play, gamePk, g);
        }
        const isHitEvt = ["Single", "Double", "Triple", "Home Run"].indexOf(event) !== -1;
        if (state.perfectGameTracker[gamePk] === void 0) state.perfectGameTracker[gamePk] = true;
        if (["Walk", "Hit By Pitch", "Intentional Walk", "Error", "Fielders Choice", "Catcher Interference"].indexOf(event) !== -1) state.perfectGameTracker[gamePk] = false;
        if (isHitEvt) state.perfectGameTracker[gamePk] = false;
        if (isHitEvt && batterId) {
          const dh = state.dailyHitsTracker[batterId] || { name: batterName, hits: 0, hrs: 0, gamePk };
          dh.hits++;
          if (event === "Home Run") dh.hrs++;
          dh.name = batterName || dh.name;
          dh.gamePk = gamePk;
          state.dailyHitsTracker[batterId] = dh;
        }
        if (event === "Strikeout" && pitcherId) {
          const kkey = gamePk + "_" + pitcherId;
          const ke = state.dailyPitcherKs[kkey] || { name: pitcherName, ks: 0, gamePk };
          ke.ks++;
          ke.name = pitcherName || ke.name;
          state.dailyPitcherKs[kkey] = ke;
        }
        if (!isHistory) {
          const gameVisible = state.enabledGames.has(gamePk);
          if (event === "Home Run") {
            playSound("hr");
            if (batterId && gameVisible) {
              const _hrRbi = play.result && play.result.rbi != null ? play.result.rbi : 1;
              const _badge = getHRBadge(_hrRbi, halfInning, inning, aScore, hScore);
              showPlayerCard(batterId, batterName, g.awayId, g.homeId, halfInning, null, desc, _badge, gamePk);
            }
          } else if (isScoringP) {
            const _rbi = play.result && play.result.rbi != null ? play.result.rbi : 0;
            const _rs = calcRBICardScore(_rbi, event, aScore, hScore, inning, halfInning);
            const _rbiOk = Date.now() - (state.rbiCardCooldowns[gamePk] || 0) >= state.devTuning.rbiCooldown;
            if (_rbi > 0 && _rs >= state.devTuning.rbiThreshold && gameVisible && batterId && _rbiOk) {
              state.rbiCardCooldowns[gamePk] = Date.now();
              showRBICard(batterId, batterName, g.awayId, g.homeId, halfInning, _rbi, event, aScore, hScore, inning, gamePk);
            }
            playSound("run");
          } else if (event.indexOf("Triple Play") !== -1) {
            if (gameVisible) showAlert({ icon: "\u{1F500}", event: "TRIPLE PLAY \xB7 " + g.awayAbbr + " @ " + g.homeAbbr, desc, color: "#9b59b6", duration: 5e3 });
            playSound("tp");
          } else if (event.indexOf("Double Play") !== -1 || event.indexOf("Grounded Into DP") !== -1) {
            playSound("dp");
          } else if (event.indexOf("Error") !== -1) {
            playSound("error");
          } else if (hasRISP) {
            playSound("risp");
          }
          if (outs === 3) {
            const _rk = gamePk + "_" + inning + "_" + halfInning.toLowerCase();
            if (!state.inningRecapsFired.has(_rk)) state.inningRecapsPending[_rk] = { gamePk, inning, halfInning: halfInning.toLowerCase() };
          }
        }
      });
      if (!isHistory) {
        const allPlaysForActions = data.allPlays || [];
        allPlaysForActions.forEach(function(play) {
          const pe = play.playEvents || [];
          const about = play.about || {};
          pe.forEach(function(ev) {
            if (ev.type !== "action" && ev.type !== "pickoff") return;
            const det = ev.details || {};
            const evId = ev.playId || gamePk + "_" + about.atBatIndex + "_" + (ev.index != null ? ev.index : "na");
            if (state.seenActionEventIds.has(evId)) return;
            const evType = (det.eventType || "").toLowerCase();
            const desc = det.description || "";
            const ts = ev.startTime ? new Date(ev.startTime) : /* @__PURE__ */ new Date();
            const ctx = {
              key: evId,
              gamePk,
              awayAbbr: g.awayAbbr,
              homeAbbr: g.homeAbbr,
              inning: about.inning || g.inning,
              halfInning: about.halfInning || g.halfInning,
              ts,
              desc
            };
            const actionRunners = play.runners || [];
            const findRunner = function(et) {
              const rr = actionRunners.find(function(r2) {
                return r2.details && r2.details.eventType === et;
              });
              return rr && rr.details || {};
            };
            if (evType.indexOf("stolen_base") === 0) {
              const sbBase = evType === "stolen_base_home" ? "home" : evType === "stolen_base_3b" ? "3B" : "2B";
              const sbR = findRunner(evType);
              state.stolenBaseEvents.push(Object.assign({}, ctx, { runnerId: sbR.runner ? sbR.runner.id : null, runnerName: sbR.runner ? sbR.runner.fullName : "", base: sbBase, caught: false }));
            } else if (evType.indexOf("caught_stealing") === 0) {
              const csBase = evType === "caught_stealing_home" ? "home" : evType === "caught_stealing_3b" ? "3B" : "2B";
              const csR = findRunner(evType);
              state.stolenBaseEvents.push(Object.assign({}, ctx, { runnerId: csR.runner ? csR.runner.id : null, runnerName: csR.runner ? csR.runner.fullName : "", base: csBase, caught: true }));
            } else if (evType.indexOf("pickoff_caught_stealing") === 0) {
              const poBase = evType.indexOf("home") !== -1 ? "home" : evType.indexOf("3b") !== -1 ? "3B" : evType.indexOf("2b") !== -1 ? "2B" : "1B";
              const poR = findRunner(evType);
              state.actionEvents.push(Object.assign({}, ctx, { kind: "pickoff_out", base: poBase, runnerId: poR.runner ? poR.runner.id : null, runnerName: poR.runner ? poR.runner.fullName : "" }));
            } else if (evType === "pitching_substitution") {
              const newP = play.matchup && play.matchup.pitcher || {};
              state.actionEvents.push(Object.assign({}, ctx, { kind: "pitching_change", pitcherId: newP.id || null, pitcherName: newP.fullName || "" }));
            } else if (evType === "offensive_substitution") {
              const isPH = desc.indexOf("Pinch-hitter") !== -1;
              const isPR = desc.indexOf("Pinch-runner") !== -1;
              if (!isPH && !isPR) return;
              state.actionEvents.push(Object.assign({}, ctx, { kind: isPH ? "pinch_hitter" : "pinch_runner" }));
            } else if (evType === "game_advisory") {
              const isReview = desc.indexOf("Manager challenged") !== -1 || desc.indexOf("Crew chief review") !== -1 || desc.indexOf("Replay Review") !== -1;
              if (!isReview) return;
              state.actionEvents.push(Object.assign({}, ctx, { kind: "replay_review" }));
            } else {
              return;
            }
            state.seenActionEventIds.add(evId);
          });
        });
      }
      plays.forEach(function(play) {
        if (play.result && play.result.event === "Home Run") {
          const newDesc = play.result.description || "";
          let pt = null;
          try {
            if (play.about && play.about.startTime) pt = new Date(play.about.startTime);
          } catch (e) {
          }
          const found = state.feedItems.find(function(i) {
            return i.gamePk === gamePk && i.data && i.data.event === "Home Run" && pt && i.ts && Math.abs(i.ts.getTime() - pt.getTime()) < 5e3;
          });
          if (found) {
            if (!found.data.distance && play.hitData && play.hitData.totalDistance > 0) found.data.distance = Math.round(play.hitData.totalDistance);
            if (!found.data.speed && play.hitData && play.hitData.launchSpeed > 0) found.data.speed = Math.round(play.hitData.launchSpeed);
            if (newDesc.match(/\(\d+\)/) && !(found.data.desc || "").match(/\(\d+\)/)) found.data.desc = newDesc;
          }
        }
      });
      g.playCount = plays.length;
    } catch (e) {
    }
  }

  // src/pulse/news-carousel.js
  async function loadPulseNews() {
    try {
      const r = await fetch(API_BASE + "/api/proxy-rss?feed=mlb");
      if (!r.ok) throw new Error("Status " + r.status);
      const d = await r.json();
      if (!d.success || !Array.isArray(d.articles) || !d.articles.length) throw new Error("Empty MLB feed");
      state.pulseNewsArticles = d.articles.slice(0, 10);
      state.pulseNewsIndex = 0;
      renderPulseNewsCard();
      return;
    } catch (e) {
    }
    try {
      const r2 = await fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20");
      if (!r2.ok) throw new Error("Status " + r2.status);
      const d2 = await r2.json();
      const arts = (d2.articles || []).filter(function(a) {
        return a.headline;
      }).slice(0, 10).map(function(a) {
        return {
          title: a.headline,
          link: a.links && a.links.web && a.links.web.href || "",
          image: a.images && a.images[0] && a.images[0].url || "",
          pubDate: a.published || ""
        };
      });
      state.pulseNewsArticles = arts;
      state.pulseNewsIndex = 0;
      renderPulseNewsCard();
    } catch (e2) {
      state.pulseNewsArticles = [];
      showNewsUnavailable();
    }
  }
  function renderPulseNewsCard() {
    const container = document.getElementById("newsCard");
    if (!container) return;
    if (!state.pulseNewsArticles.length) {
      showNewsUnavailable();
      return;
    }
    const article = state.pulseNewsArticles[state.pulseNewsIndex];
    let img = "";
    if (article.image && isSafeNewsImage(article.image)) {
      const imgUrl = forceHttps6(article.image);
      img = '<img src="' + imgUrl + `" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block" onerror="this.style.display='none'">`;
    }
    const headline = article.headline || article.title || "News";
    const pubDate = article.pubDate || article.published || article.publishedAt || "";
    const html = '<div style="padding:12px;display:flex;flex-direction:column;gap:8px">' + img + '<div style="font-size:.8rem;font-weight:600;color:var(--text);line-height:1.35">' + headline + "</div>" + (pubDate ? '<div style="font-size:.65rem;color:var(--muted)">' + fmtNewsDate(pubDate) + "</div>" : "") + "</div>";
    container.innerHTML = html;
  }
  function forceHttps6(url) {
    return url ? url.replace(/^http:/, "https:") : url;
  }
  function nextNewsCard() {
    if (!state.pulseNewsArticles.length) return;
    state.pulseNewsIndex = (state.pulseNewsIndex + 1) % state.pulseNewsArticles.length;
    renderPulseNewsCard();
  }
  function prevNewsCard() {
    if (!state.pulseNewsArticles.length) return;
    state.pulseNewsIndex = (state.pulseNewsIndex - 1 + state.pulseNewsArticles.length) % state.pulseNewsArticles.length;
    renderPulseNewsCard();
  }
  function showNewsUnavailable() {
    const container = document.getElementById("newsCard");
    if (container) {
      container.innerHTML = '<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
    }
  }

  // src/config/buzz.js
  var BASEBALL_BUZZ_ACCOUNTS = [
    // Core / league
    { handle: "mlbtraderumors.bsky.social", name: "MLB Trade Rumors", tag: "Rumors", category: "rumors" },
    { handle: "slangsonsports.bsky.social", name: "Sarah Langs", tag: "MLB.com", category: "league" },
    // National insiders
    { handle: "ken-rosenthal.bsky.social", name: "Ken Rosenthal", tag: "Athletic", category: "insider" },
    { handle: "jaysonst.bsky.social", name: "Jayson Stark", tag: "Athletic", category: "insider" },
    { handle: "bnightengale.bsky.social", name: "Bob Nightengale", tag: "USA Today", category: "insider" },
    { handle: "chelseajanes.bsky.social", name: "Chelsea Janes", tag: "Wash Post", category: "insider" },
    // Analytics & scouting
    { handle: "fangraphs.com", name: "FanGraphs", tag: "Analytics", category: "analytics" },
    { handle: "megrowler.fangraphs.com", name: "Meg Rowley", tag: "FanGraphs", category: "analytics" },
    { handle: "jayjaffe.bsky.social", name: "Jay Jaffe", tag: "FanGraphs", category: "analytics" },
    { handle: "benclemens.bsky.social", name: "Ben Clemens", tag: "FanGraphs", category: "analytics" },
    { handle: "dszymborski.fangraphs.com", name: "Dan Szymborski", tag: "ZiPS", category: "analytics" },
    { handle: "benlindbergh.bsky.social", name: "Ben Lindbergh", tag: "Ringer", category: "analytics" },
    { handle: "enosarris.bsky.social", name: "Eno Sarris", tag: "Athletic", category: "analytics" },
    { handle: "baseballprospectus.com", name: "Baseball Prospectus", tag: "Analytics", category: "analytics" },
    { handle: "baseballamerica.com", name: "Baseball America", tag: "Prospects", category: "analytics" },
    { handle: "pitcherlist.com", name: "Pitcher List", tag: "Analytics", category: "analytics" },
    { handle: "keithlaw.bsky.social", name: "Keith Law", tag: "Scouting", category: "scouting" },
    { handle: "codifybaseball.bsky.social", name: "Codify", tag: "Stats", category: "analytics" },
    // AL East beat writers
    { handle: "peteabeglobe.bsky.social", name: "Pete Abraham", tag: "Red Sox", category: "team" },
    { handle: "alexspeier.bsky.social", name: "Alex Speier", tag: "Red Sox", category: "team" },
    { handle: "jcmccaffrey.bsky.social", name: "Jen McCaffrey", tag: "Red Sox", category: "team" },
    { handle: "rochkubatko.bsky.social", name: "Roch Kubatko", tag: "Orioles", category: "team" },
    { handle: "keeganmatheson.bsky.social", name: "Keegan Matheson", tag: "Blue Jays", category: "team" },
    // AL Central beat writers
    { handle: "zackmeisel.bsky.social", name: "Zack Meisel", tag: "Guardians", category: "team" },
    { handle: "danhayesmlb.bsky.social", name: "Dan Hayes", tag: "Twins", category: "team" },
    { handle: "jrfegan.soxmachine.com", name: "James Fegan", tag: "White Sox", category: "team" },
    // AL West beat writers
    { handle: "samblum.bsky.social", name: "Sam Blum", tag: "Angels", category: "team" },
    { handle: "chandlerrome.bsky.social", name: "Chandler Rome", tag: "Astros", category: "team" },
    { handle: "threetwoeephus.bsky.social", name: "Levi Weaver", tag: "Rangers", category: "team" },
    { handle: "melissalockard.bsky.social", name: "Melissa Lockard", tag: "Athletics", category: "team" },
    // NL East beat writers
    { handle: "timbritton.bsky.social", name: "Tim Britton", tag: "Mets", category: "team" },
    { handle: "willsammon.bsky.social", name: "Will Sammon", tag: "Mets", category: "team" },
    { handle: "mattgelb.bsky.social", name: "Matt Gelb", tag: "Phillies", category: "team" },
    { handle: "andrewgolden.bsky.social", name: "Andrew Golden", tag: "Nationals", category: "team" },
    // NL Central beat writers
    { handle: "cyrthogg.bsky.social", name: "Curt Hogg", tag: "Brewers", category: "team" },
    { handle: "adammccalvy.bsky.social", name: "Adam McCalvy", tag: "Brewers", category: "team" },
    { handle: "ctrent.bsky.social", name: "C. Trent Rosecrans", tag: "Reds", category: "team" },
    { handle: "psaunders.bsky.social", name: "Patrick Saunders", tag: "Rockies", category: "team" },
    // NL West beat writers
    { handle: "fabianardaya.bsky.social", name: "Fabian Ardaya", tag: "Dodgers", category: "team" },
    { handle: "andrewbaggarly.bsky.social", name: "Andrew Baggarly", tag: "Giants", category: "team" },
    // Community / SB Nation blogs
    { handle: "amazinavenue.bsky.social", name: "Amazin' Avenue", tag: "Mets", category: "team" },
    { handle: "lookoutlanding.bsky.social", name: "Lookout Landing", tag: "Mariners", category: "team" },
    { handle: "bleedcubbieblue.bsky.social", name: "Bleed Cubbie Blue", tag: "Cubs", category: "team" },
    { handle: "southsidesox.bsky.social", name: "South Side Sox", tag: "White Sox", category: "team" },
    { handle: "royalsreview.bsky.social", name: "Royals Review", tag: "Royals", category: "team" },
    { handle: "gaslampball.bsky.social", name: "Gaslamp Ball", tag: "Padres", category: "team" },
    { handle: "thegoodphight.bsky.social", name: "The Good Phight", tag: "Phillies", category: "team" },
    { handle: "mccoveychronicles.bsky.social", name: "McCovey Chronicles", tag: "Giants", category: "team" },
    { handle: "federalbaseball.bsky.social", name: "Federal Baseball", tag: "Nationals", category: "team" }
  ];

  // src/pulse/baseball-buzz.js
  var BSKY_API = "https://public.api.bsky.app/xrpc";
  var FRESH_MS = 31 * 24 * 60 * 60 * 1e3;
  var MAX_POSTS = 10;
  var PER_ACCOUNT = 6;
  var CACHE_KEY = "mlb_buzz_cache_v2";
  var CACHE_TTL_MS = 12e4;
  function rkeyOf(uri) {
    return (uri || "").split("/").pop() || "";
  }
  function relTime(ts) {
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1e3));
    if (s < 60) return "now";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h";
    const d = Math.floor(h / 24);
    return d + "d";
  }
  function initialsOf(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }
  function extractEmbedImage(embed) {
    if (!embed) return null;
    if (embed.$type === "app.bsky.embed.images#view" && embed.images && embed.images[0]) {
      return embed.images[0].thumb || null;
    }
    return null;
  }
  async function fetchAccount(acct) {
    try {
      const url = BSKY_API + "/app.bsky.feed.getAuthorFeed?actor=" + encodeURIComponent(acct.handle) + "&limit=" + PER_ACCOUNT + "&filter=posts_no_replies";
      const r = await fetch(url);
      if (!r.ok) return [];
      const d = await r.json();
      const feed = d && d.feed || [];
      const out = [];
      feed.forEach(function(item) {
        if (item.reason) return;
        const p = item.post;
        if (!p || !p.record || !p.record.text) return;
        if (p.record.reply) return;
        const ts = Date.parse(p.record.createdAt || "");
        if (!ts || Date.now() - ts > FRESH_MS) return;
        const handle = p.author && p.author.handle || acct.handle;
        out.push({
          name: acct.name || p.author && p.author.displayName || handle,
          handle,
          tag: acct.tag || "",
          category: acct.category || "team",
          avatar: p.author && p.author.avatar || null,
          embedImage: extractEmbedImage(p.embed),
          text: p.record.text,
          ts,
          url: "https://bsky.app/profile/" + handle + "/post/" + rkeyOf(p.uri)
        });
      });
      return out;
    } catch (e) {
      return [];
    }
  }
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || !Array.isArray(c.posts)) return null;
      if (Date.now() - c.ts > CACHE_TTL_MS) return null;
      return c.posts;
    } catch (e) {
      return null;
    }
  }
  function writeCache(posts) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), posts }));
    } catch (e) {
    }
  }
  async function loadBaseballBuzz(force) {
    const el = document.getElementById("sideRailBuzz");
    if (!el) return;
    if (!force) {
      const cached = readCache();
      if (cached && cached.length) {
        state.baseballBuzzPosts = cached;
        renderBaseballBuzz();
        return;
      }
    }
    if (!state.baseballBuzzPosts || !state.baseballBuzzPosts.length) {
      el.classList.remove("buzz-has-footer");
      el.innerHTML = buzzHeader() + '<div class="buzz-empty">Loading\u2026</div>';
    }
    try {
      const results = await Promise.allSettled(BASEBALL_BUZZ_ACCOUNTS.map(fetchAccount));
      let posts = [];
      results.forEach(function(res) {
        if (res.status === "fulfilled" && res.value) posts = posts.concat(res.value);
      });
      posts.sort(function(a, b) {
        return b.ts - a.ts;
      });
      posts = posts.slice(0, MAX_POSTS);
      state.baseballBuzzPosts = posts;
      if (posts.length) writeCache(posts);
      renderBaseballBuzz();
    } catch (e) {
      if (!state.baseballBuzzPosts || !state.baseballBuzzPosts.length) {
        el.classList.remove("buzz-has-footer");
        el.innerHTML = buzzHeader() + '<div class="buzz-empty">Buzz feed unavailable</div>';
      }
    }
  }
  function buzzHeader() {
    return '<div class="side-rail-section-header"><span class="side-rail-section-title">Baseball Buzz</span></div>';
  }
  function avatarHtml(p) {
    const ini = escapeNewsHtml(initialsOf(p.name));
    let img = "";
    if (p.avatar && isSafeNewsImage(p.avatar)) {
      img = '<img src="' + escapeNewsHtml(forceHttps(p.avatar)) + '" alt="" loading="lazy" onerror="this.remove()">';
    }
    return '<span class="buzz-avatar"><span class="buzz-avatar-fallback">' + ini + "</span>" + img + "</span>";
  }
  function cardHtml(p) {
    const head = avatarHtml(p) + '<span class="buzz-meta-name">' + escapeNewsHtml(p.name) + "</span>" + (p.tag ? '<span class="buzz-tag" data-cat="' + escapeNewsHtml(p.category || "") + '">' + escapeNewsHtml(p.tag) + "</span>" : "") + '<span class="buzz-time">' + relTime(p.ts) + "</span>";
    let embed = "";
    let hasEmbed = false;
    if (p.embedImage && isSafeNewsImage(p.embedImage)) {
      hasEmbed = true;
      embed = '<div class="buzz-embed"><img src="' + escapeNewsHtml(forceHttps(p.embedImage)) + '" alt="" loading="lazy"></div>';
    }
    return '<a class="buzz-card' + (hasEmbed ? " buzz-has-embed" : "") + '" href="' + escapeNewsHtml(p.url) + '" target="_blank" rel="noopener noreferrer"><div class="buzz-head">' + head + '</div><div class="buzz-text">' + escapeNewsHtml(p.text) + "</div>" + embed + "</a>";
  }
  function renderBaseballBuzz() {
    const el = document.getElementById("sideRailBuzz");
    if (!el) return;
    const all = state.baseballBuzzPosts || [];
    if (!all.length) {
      el.classList.remove("buzz-has-footer");
      el.innerHTML = buzzHeader() + '<div class="buzz-empty">No recent posts</div>';
      return;
    }
    el.classList.add("buzz-has-footer");
    let html = buzzHeader() + '<div class="buzz-list">';
    all.forEach(function(p) {
      html += cardHtml(p);
    });
    html += '</div><div class="buzz-footer">via <span>Bluesky</span></div>';
    el.innerHTML = html;
  }

  // src/carousel/rotation.js
  var rotationCallbacks = { refreshDebugPanel: null };
  function setRotationCallbacks(callbacks) {
    Object.assign(rotationCallbacks, callbacks);
  }
  async function buildStoryPool() {
    const now = Date.now();
    const staleCutoff = now - 30 * 6e4;
    state.stolenBaseEvents = state.stolenBaseEvents.filter(function(sb) {
      return sb.ts && sb.ts.getTime() > staleCutoff;
    });
    state.actionEvents = state.actionEvents.filter(function(ae) {
      return ae.ts && ae.ts.getTime() > staleCutoff;
    });
    if (now - state.dailyLeadersLastFetch > 5 * 6e4) {
      loadDailyLeaders();
      state.dailyLeadersLastFetch = now;
    }
    if (now - state.transactionsLastFetch > 120 * 6e4) {
      loadTransactionsCache();
    }
    if (now - state.highLowLastFetch > 6 * 60 * 6e4) {
      loadHighLowCache();
    }
    if (now - state.liveWPLastFetch > (state.devTuning.livewp_refresh_ms || 9e4)) {
      loadLiveWPCache();
    }
    await loadProbablePitcherStats();
    fetchMissingHRBatterStats();
    const multiHitStories = await genMultiHitDay();
    const wpStories = await genWinProbabilityStories();
    const streakStories = await genStreakStories();
    let fresh = [].concat(
      genHRStories(),
      genNoHitterWatch(),
      genWalkOffThreat(),
      genBasesLoaded(),
      genStolenBaseStories(),
      genActionEventStories(),
      genBigInning(),
      genFinalScoreStories(),
      streakStories,
      multiHitStories,
      genDailyLeaders(),
      genPitcherGem(),
      genOnThisDay(),
      genYesterdayHighlights(),
      genProbablePitchers(),
      genInningRecapStories(),
      wpStories,
      genRosterMoveStories(),
      genSeasonHighStories(),
      genLiveWinProbStories(),
      genDailyIntro()
    );
    const introMarquee = fresh.find(function(s) {
      return s.type === "editorial" && s.id.indexOf("dailyintro_") === 0 && s.gamePk;
    });
    if (introMarquee) {
      const dupId = "probable_" + introMarquee.gamePk;
      fresh = fresh.filter(function(s) {
        return s.id !== dupId;
      });
    }
    const hrInnings = {};
    state.feedItems.forEach(function(item) {
      if (!item.data || item.data.event !== "Home Run") return;
      if (!item.ts || now - item.ts.getTime() > 5 * 6e4) return;
      hrInnings[item.gamePk + "_" + item.data.inning + "_" + item.data.halfInning] = true;
    });
    fresh = fresh.filter(function(s) {
      if (s.id.indexOf("basesloaded_") !== 0) return true;
      const parts = s.id.split("_");
      if (parts.length < 4) return true;
      return !hrInnings[parts[1] + "_" + parts[2] + "_" + parts[3]];
    });
    state.storyPool = fresh.slice().sort(function(a, b) {
      return b.priority - a.priority;
    });
    const carousel = document.getElementById("storyCarousel");
    if (!carousel) return;
    if (state.storyPool.length) {
      if (carousel.style.display === "none") {
        carousel.style.display = "";
        rotateStory();
        if (!state.storyRotateTimer) state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
      }
    } else {
      carousel.style.display = "none";
      if (state.storyRotateTimer) {
        clearInterval(state.storyRotateTimer);
        state.storyRotateTimer = null;
      }
    }
  }
  function rotateStory() {
    if (!state.storyPool.length) return;
    const now = Date.now();
    const maxCooldown = Math.max(state.storyPool.length * state.devTuning.rotateMs * 1.5, 2 * 6e4);
    let eligible = state.storyPool.filter(function(s) {
      return !s.lastShown || now - s.lastShown.getTime() > Math.min(s.cooldownMs, maxCooldown);
    });
    if (!eligible.length) {
      eligible = state.storyPool.slice().sort(function(a, b) {
        return (a.lastShown ? a.lastShown.getTime() : 0) - (b.lastShown ? b.lastShown.getTime() : 0);
      });
    }
    const scored = eligible.map(function(s) {
      const ageMin = (now - s.ts.getTime()) / 6e4;
      const decay = Math.pow(Math.max(0, 1 - s.decayRate), ageMin / 30);
      return { s, score: s.priority * decay };
    });
    scored.sort(function(a, b) {
      return b.score - a.score;
    });
    showStoryCard(scored[0].s);
  }
  function showStoryCard(story) {
    story.lastShown = /* @__PURE__ */ new Date();
    state.storyShownId = story.id;
    state.displayedStoryIds.add(story.id);
    renderStoryCard(story);
    updateStoryDots();
    if (rotationCallbacks.refreshDebugPanel) rotationCallbacks.refreshDebugPanel();
  }
  function renderStoryCard(story) {
    const el = document.getElementById("storyCard");
    if (!el) return;
    const badgeMap = { live: "live", final: "final", today: "today", yesterday: "yesterday", onthisday: "onthisday", upcoming: "upcoming", leaders: "leaders", probables: "probables", highlight: "highlight", inning_recap: "inning_recap", hot: "hot", cold: "cold", streak: "streak", roster: "roster", award: "award", record: "award" };
    const labelMap = { live: "LIVE", final: "FINAL", today: "TODAY", yesterday: "YESTERDAY", onthisday: "ON THIS DAY", upcoming: "UPCOMING", leaders: "LEADERS", probables: "TODAY'S PROBABLE PITCHERS", highlight: "HIGHLIGHT", inning_recap: "INNING RECAP", hot: "HOT", cold: "COLD", streak: "HITTING STREAK", roster: "ROSTER MOVE", award: "AWARD", record: "SEASON HIGH" };
    const bc = badgeMap[story.badge] || "today", bl = labelMap[story.badge] || "TODAY";
    el.className = "story-card tier" + story.tier + (story.id.indexOf("biginning") === 0 ? " story-biginning" : "") + (story.id.indexOf("leader_") === 0 ? " story-leaders" : "");
    el.innerHTML = '<div><span class="story-badge ' + bc + '">' + bl + '</span></div><div style="display:flex;align-items:flex-start;gap:6px;margin-top:2px"><span class="story-icon">' + story.icon + '</span><div><div class="story-headline">' + story.headline + "</div>" + (story.sub ? '<div class="story-sub">' + story.sub + "</div>" : "") + "</div></div>";
  }
  function updateStoryDots() {
    const el = document.getElementById("storyDots");
    if (!el) return;
    const max = Math.min(state.storyPool.length, 8);
    const curIdx = state.storyPool.findIndex(function(s) {
      return s.id === state.storyShownId;
    });
    let html = "";
    for (let i = 0; i < max; i++) html += '<div class="story-dot' + (i === curIdx ? " active" : "") + '"></div>';
    el.innerHTML = html;
  }
  function prevStory() {
    if (!state.storyPool.length) return;
    const idx = state.storyPool.findIndex(function(s) {
      return s.id === state.storyShownId;
    });
    showStoryCard(state.storyPool[idx <= 0 ? state.storyPool.length - 1 : idx - 1]);
  }
  function nextStory() {
    if (!state.storyPool.length) return;
    const idx = state.storyPool.findIndex(function(s) {
      return s.id === state.storyShownId;
    });
    showStoryCard(state.storyPool[idx >= state.storyPool.length - 1 ? 0 : idx + 1]);
  }
  function onStoryVisibilityChange() {
    if (document.hidden) {
      clearInterval(state.storyRotateTimer);
      state.storyRotateTimer = null;
    } else if (state.pulseInitialized && state.storyPool.length) {
      rotateStory();
      state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
    }
  }

  // src/demo/mode.js
  var demoPaused = false;
  var demoSpeedMs = 1e4;
  var _hrSeekActive = false;
  var _hrSeekPriorSpeed = 0;
  var _addFeedItem = null;
  var _renderTicker = null;
  var _renderSideRailGames = null;
  var _buildStoryPool2 = null;
  var _updateFeedEmpty = null;
  var _showAlert = null;
  var _playSound = null;
  var _showPlayerCard2 = null;
  var _showRBICard2 = null;
  var _rotateStory = null;
  var _localDateStr2 = null;
  var _selectFocusGame = null;
  var _pollFocusLinescore = null;
  var _pollPendingVideoClips = null;
  var _resumeLivePulse = null;
  function setDemoCallbacks(callbacks) {
    _addFeedItem = callbacks.addFeedItem;
    _renderTicker = callbacks.renderTicker;
    _renderSideRailGames = callbacks.renderSideRailGames;
    _buildStoryPool2 = callbacks.buildStoryPool;
    _updateFeedEmpty = callbacks.updateFeedEmpty;
    _showAlert = callbacks.showAlert;
    _playSound = callbacks.playSound;
    _showPlayerCard2 = callbacks.showPlayerCard;
    _showRBICard2 = callbacks.showRBICard;
    _rotateStory = callbacks.rotateStory;
    _localDateStr2 = callbacks.localDateStr;
    _selectFocusGame = callbacks.selectFocusGame;
    _pollFocusLinescore = callbacks.pollFocusLinescore;
    _pollPendingVideoClips = callbacks.pollPendingVideoClips;
    _resumeLivePulse = callbacks.resumeLivePulse;
  }
  async function loadDailyEventsJSON() {
    try {
      const r = await fetch("./assets/daily-events.json");
      if (!r.ok) return null;
      const data = await r.json();
      if (data.feedItems) {
        data.feedItems.forEach(function(item) {
          if (item.playTime && typeof item.playTime === "string") {
            item.playTime = new Date(item.playTime);
          }
          if (typeof item.ts === "number") item.ts = new Date(item.ts);
          else if (typeof item.ts === "string") item.ts = new Date(item.ts);
          if (item.playTime && !item.ts) item.ts = item.playTime;
        });
      }
      if (data.onThisDayCache) {
        data.onThisDayCache.forEach(function(item) {
          if (item.ts && typeof item.ts === "string") {
            item.ts = new Date(item.ts);
          }
        });
      }
      if (data.yesterdayCache) {
        data.yesterdayCache.forEach(function(item) {
          if (item.ts && typeof item.ts === "string") {
            item.ts = new Date(item.ts);
          }
        });
      }
      return data;
    } catch (e) {
      console.error("Demo: Failed to load daily-events.json", e);
      return null;
    }
  }
  function updateDemoBtnLabel() {
    const lbl = document.getElementById("demoBtnLabel");
    if (lbl) lbl.textContent = state.demoMode ? "\u23F9 Exit Demo" : "\u25B6 Try Demo";
  }
  function toggleDemoMode() {
    devTrace("demo", state.demoMode ? "exit" : "init");
    if (state.demoMode) exitDemo();
    else initDemo();
    updateDemoBtnLabel();
  }
  async function initDemo() {
    if (state.pulseTimer) {
      clearInterval(state.pulseTimer);
      state.pulseTimer = null;
    }
    if (state.pulseAbortCtrl) {
      state.pulseAbortCtrl.abort();
      state.pulseAbortCtrl = null;
    }
    if (state.storyRotateTimer) {
      clearInterval(state.storyRotateTimer);
      state.storyRotateTimer = null;
    }
    if (state.focusFastTimer) {
      clearInterval(state.focusFastTimer);
      state.focusFastTimer = null;
    }
    if (state.focusAbortCtrl) {
      state.focusAbortCtrl.abort();
      state.focusAbortCtrl = null;
    }
    state.focusGamePk = null;
    state.focusIsManual = false;
    state.focusCurrentAbIdx = null;
    state.focusLastTimecode = null;
    state.focusPitchSequence = [];
    state.focusAlertShown = {};
    state.focusState = {
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      halfInning: "top",
      currentBatterId: null,
      currentBatterName: "",
      currentPitcherId: null,
      currentPitcherName: "",
      onFirst: false,
      onSecond: false,
      onThird: false,
      awayAbbr: "",
      homeAbbr: "",
      awayScore: 0,
      homeScore: 0,
      awayPrimary: "#444",
      homePrimary: "#444",
      tensionLabel: "NORMAL",
      tensionColor: "#9aa0a8",
      lastPitch: null,
      batterStats: null,
      pitcherStats: null
    };
    state.actionEvents = [];
    state.seenActionEventIds = /* @__PURE__ */ new Set();
    state.rbiCardCooldowns = {};
    stopRadio();
    state.focusOverlayOpen = false;
    const _focusOv = document.getElementById("focusOverlay");
    if (_focusOv) _focusOv.style.display = "none";
    const _playerOv = document.getElementById("playerCardOverlay");
    if (_playerOv) _playerOv.classList.remove("open");
    state.demoMode = true;
    document.body.classList.add("demo-active");
    const pulseSection = document.getElementById("pulse");
    if (pulseSection) pulseSection.classList.add("active");
    const main = document.getElementById("main");
    if (main) main.style.display = "none";
    const feedWrap = document.getElementById("feedWrap");
    if (feedWrap) feedWrap.style.display = "block";
    demoSpeedMs = 1e4;
    demoPaused = false;
    const mockBar = document.getElementById("mockBar");
    if (mockBar) {
      mockBar.style.display = "flex";
      mockBar.classList.add("open");
      const badge = document.getElementById("mockBarBadge");
      if (badge) badge.textContent = "\u{1F4FD}\uFE0F Demo";
      const fabBadge = document.getElementById("demoFabBadge");
      if (fabBadge) fabBadge.textContent = "1x";
      document.getElementById("demoSpeed1x").style.display = "";
      document.getElementById("demoSpeed10x").style.display = "";
      document.getElementById("demoSpeed30x").style.display = "";
      document.querySelectorAll("#demoSpeed1x,#demoSpeed10x,#demoSpeed30x").forEach((b) => b.classList.remove("active"));
      document.getElementById("demoSpeed1x").classList.add("active");
      document.getElementById("demoNextHRBtn").style.display = "";
      document.getElementById("demoPauseBtn").style.display = "";
      document.getElementById("demoForwardBtn").style.display = "";
      const _exitBtn = document.getElementById("demoExitBtn");
      if (_exitBtn) _exitBtn.style.display = "";
      document.getElementById("demoPauseBtn").textContent = "\u23F8";
    }
    state.gameStates = {};
    state.feedItems = [];
    const _feed = document.getElementById("feed");
    if (_feed) _feed.innerHTML = "";
    state.scheduleData = [];
    state.enabledGames = /* @__PURE__ */ new Set();
    state.storyPool = [];
    state.storyShownId = null;
    state.demoPlayQueue = [];
    state.demoPlayIdx = 0;
    state.demoCardCount = 0;
    state.dailyLeadersCache = null;
    state.onThisDayCache = null;
    state.yesterdayCache = null;
    state.hrBatterStatsCache = {};
    state.probablePitcherStatsCache = {};
    state.dailyHitsTracker = {};
    state.dailyPitcherKs = {};
    state.storyCarouselRawGameData = {};
    state.stolenBaseEvents = [];
    state.inningRecapsFired = /* @__PURE__ */ new Set();
    state.inningRecapsPending = {};
    state.lastInningState = {};
    const jsonData = await loadDailyEventsJSON();
    if (!jsonData || !jsonData.gameStates) {
      _showAlert({ icon: "\u26A0\uFE0F", event: "Demo Load Failed", desc: "Could not load daily-events.json", color: "#e85d4f", duration: 3e3 });
      return;
    }
    state.gameStates = jsonData.gameStates;
    const c = jsonData.caches || {};
    state.dailyLeadersCache = c.dailyLeadersCache || jsonData.dailyLeadersCache || null;
    state.onThisDayCache = c.onThisDayCache || jsonData.onThisDayCache || [];
    state.yesterdayCache = c.yesterdayCache || jsonData.yesterdayCache || [];
    state.hrBatterStatsCache = c.hrBatterStatsCache || jsonData.hrBatterStatsCache || {};
    state.probablePitcherStatsCache = c.probablePitcherStatsCache || jsonData.probablePitcherStatsCache || {};
    state.dailyHitsTracker = {};
    state.dailyPitcherKs = {};
    state.storyCarouselRawGameData = c.storyCarouselRawGameData || jsonData.storyCarouselRawGameData || {};
    state.stolenBaseEvents = (c.stolenBaseEvents || jsonData.stolenBaseEvents || []).map(function(sb) {
      if (sb && sb.ts && typeof sb.ts === "string") sb.ts = new Date(sb.ts);
      return sb;
    });
    state.transactionsCache = c.transactionsCache || jsonData.transactionsCache || [];
    state.liveWPCache = c.liveWPCache || jsonData.liveWPCache || {};
    state.perfectGameTracker = c.perfectGameTracker || jsonData.perfectGameTracker || {};
    state.highLowCache = c.highLowCache || jsonData.highLowCache || null;
    state.scheduleData = jsonData.scheduleData || [];
    state.pitchTimeline = jsonData.pitchTimeline || {};
    state.boxscoreSnapshots = jsonData.boxscoreSnapshots || {};
    state.contentCacheTimeline = jsonData.contentCacheTimeline || {};
    state.focusStatsCache = jsonData.focusStatsCache || {};
    state.focusTrack = jsonData.focusTrack || [];
    if (jsonData.lastVideoClip) state.lastVideoClip = jsonData.lastVideoClip;
    if (jsonData.gameStates) {
      let earliestMs = Infinity;
      Object.values(jsonData.gameStates).forEach(function(g) {
        if (g.gameDateMs && g.gameDateMs < earliestMs) earliestMs = g.gameDateMs;
      });
      if (earliestMs !== Infinity) state.demoDate = new Date(earliestMs);
    }
    state.onThisDayCache.forEach(function(item) {
      if (item.ts && typeof item.ts === "string") item.ts = new Date(item.ts);
    });
    state.yesterdayCache.forEach(function(item) {
      if (item.ts && typeof item.ts === "string") item.ts = new Date(item.ts);
    });
    const cutoff = jsonData.metadata && jsonData.metadata.startedAt || 0;
    const allItems = (jsonData.feedItems || []).map(function(item) {
      let ts = item.ts || item.playTime;
      if (typeof ts === "number") ts = new Date(ts);
      else if (typeof ts === "string") ts = new Date(ts);
      if (!(ts instanceof Date)) ts = /* @__PURE__ */ new Date();
      return { gamePk: item.gamePk, data: item.data, ts };
    });
    allItems.sort(function(a, b) {
      return a.ts.getTime() - b.ts.getTime();
    });
    const backlogItems = [], queueItems = [];
    allItems.forEach(function(item) {
      if (item.ts.getTime() < cutoff) backlogItems.push(item);
      else queueItems.push(item);
    });
    const touched = /* @__PURE__ */ new Set();
    allItems.forEach(function(item) {
      if (item.gamePk) touched.add(+item.gamePk);
    });
    Object.values(state.gameStates).forEach(function(g) {
      if (!touched.has(+g.gamePk)) return;
      g.status = "Preview";
      g.detailedState = "Scheduled";
      g.inning = 0;
      g.halfInning = null;
      g.outs = 0;
      g.awayScore = 0;
      g.homeScore = 0;
      g.onFirst = false;
      g.onSecond = false;
      g.onThird = false;
    });
    Object.keys(state.gameStates).forEach(function(pk) {
      if (touched.has(parseInt(pk))) state.enabledGames.add(parseInt(pk));
    });
    state.feedItems = [];
    backlogItems.forEach(function(item) {
      const g = state.gameStates[item.gamePk];
      const d = item.data || {};
      d.playTime = item.ts;
      if (g) {
        if (d.type === "play") {
          if (g.status !== "Final") {
            g.status = "Live";
            g.detailedState = "In Progress";
          }
          if (d.inning) g.inning = d.inning;
          if (d.halfInning) g.halfInning = d.halfInning;
          if (d.outs != null) g.outs = d.outs;
          if (d.awayScore != null) g.awayScore = d.awayScore;
          if (d.homeScore != null) g.homeScore = d.homeScore;
          if (d.onFirst != null) g.onFirst = !!d.onFirst;
          if (d.onSecond != null) g.onSecond = !!d.onSecond;
          if (d.onThird != null) g.onThird = !!d.onThird;
          if (d.awayHits != null) g.awayHits = d.awayHits;
          if (d.homeHits != null) g.homeHits = d.homeHits;
        } else if (d.type === "status") {
          if (d.label === "Game underway!") {
            g.status = "Live";
            g.detailedState = "In Progress";
          } else if (d.label === "Game Final") {
            g.status = "Final";
          } else if (d.label === "Game Postponed") {
            g.status = "Final";
            g.detailedState = "Postponed";
          } else if (d.label === "Game Delayed") {
            g.detailedState = "Delayed";
          }
        }
      }
      _addFeedItem(item.gamePk, d);
    });
    state.demoPlayQueue = [];
    queueItems.forEach(function(item) {
      const ts = item.ts.getTime();
      const d = item.data || {};
      state.demoPlayQueue.push({
        gamePk: item.gamePk,
        ts,
        event: d.event,
        desc: d.desc,
        type: d.type || "play",
        inning: d.inning,
        halfInning: d.halfInning,
        outs: d.outs,
        awayScore: d.awayScore,
        homeScore: d.homeScore,
        scoring: d.scoring,
        risp: d.risp,
        playClass: d.playClass,
        playTime: new Date(ts),
        batterId: d.batterId,
        batterName: d.batterName,
        pitcherId: d.pitcherId,
        pitcherName: d.pitcherName,
        distance: d.distance,
        speed: d.speed,
        rbi: d.rbi,
        onFirst: d.onFirst,
        onSecond: d.onSecond,
        onThird: d.onThird,
        awayHits: d.awayHits,
        homeHits: d.homeHits,
        icon: d.icon,
        label: d.label,
        sub: d.sub
      });
    });
    state.demoPlayQueue.sort(function(a, b) {
      return a.ts - b.ts;
    });
    state.demoPlayIdx = 0;
    state.demoCurrentTime = state.demoPlayQueue.length > 0 ? state.demoPlayQueue[0].ts : cutoff;
    _renderTicker();
    _renderSideRailGames();
    await _buildStoryPool2();
    _updateFeedEmpty();
    _showAlert({
      icon: "\u25B6",
      event: "Demo Mode",
      desc: "This is a limited playback of a May 11th 2026. Not all items can be simulated in demo mode, During game times Pulse has live match radio, an increased amount of real time carousel events and Focus mode can switch to any game and obtain audio and full pitch by data. Demo is best experienced at 30x and Toggle \u{1F4FB} for Classic Radio: The vintage broadcasts are for atmosphere only, not synced to plays.",
      color: "#7dd89e",
      persistent: true
    });
    if (state.storyRotateTimer) clearInterval(state.storyRotateTimer);
    state.storyRotateTimer = setInterval(_rotateStory, state.devTuning.rotateMs);
    state.demoStartTime = Date.now();
    updateDemoBtnLabel();
    pollDemoFeeds();
  }
  async function pollDemoFeeds() {
    if (!state.demoMode) return;
    if (demoPaused) {
      clearTimeout(state.demoTimer);
      state.demoTimer = setTimeout(pollDemoFeeds, demoSpeedMs);
      return;
    }
    if (state.demoPlayIdx >= state.demoPlayQueue.length) {
      renderDemoEndScreen();
      return;
    }
    const play = state.demoPlayQueue[state.demoPlayIdx];
    const tickStart = Date.now();
    await advanceDemoPlay(play);
    state.demoPlayIdx++;
    const nextDelay = Math.max(40, demoSpeedMs - (Date.now() - tickStart));
    clearTimeout(state.demoTimer);
    state.demoTimer = setTimeout(pollDemoFeeds, nextDelay);
  }
  function setDemoSpeed(ms, btn) {
    demoSpeedMs = ms;
    if (btn) {
      document.querySelectorAll("#demoSpeed1x,#demoSpeed10x,#demoSpeed30x").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    }
    const fabBadge = document.getElementById("demoFabBadge");
    if (fabBadge) fabBadge.textContent = ms >= 1e4 ? "1x" : ms >= 1e3 ? "10x" : "30x";
    if (state.demoMode && !demoPaused && state.demoTimer) {
      clearTimeout(state.demoTimer);
      state.demoTimer = setTimeout(pollDemoFeeds, demoSpeedMs);
    }
  }
  function toggleDemoPause() {
    demoPaused = !demoPaused;
    const btn = document.getElementById("demoPauseBtn");
    if (btn) btn.textContent = demoPaused ? "\u25B6" : "\u23F8";
    if (!demoPaused && state.demoMode) pollDemoFeeds();
  }
  function forwardDemoPlay() {
    if (state.demoPlayIdx < state.demoPlayQueue.length) state.demoPlayIdx++;
    clearTimeout(state.demoTimer);
    if (!demoPaused) pollDemoFeeds();
  }
  function demoNextHR() {
    if (_hrSeekActive) return;
    let found = false;
    for (let i = state.demoPlayIdx; i < state.demoPlayQueue.length; i++) {
      if (state.demoPlayQueue[i].event === "Home Run") {
        found = true;
        break;
      }
    }
    if (!found) {
      _showAlert({ icon: "\u26A0\uFE0F", event: "No more HRs", desc: "Reached end of demo", duration: 2e3 });
      return;
    }
    _hrSeekActive = true;
    _hrSeekPriorSpeed = demoSpeedMs;
    demoSpeedMs = 500;
    if (demoPaused) {
      demoPaused = false;
      const btn = document.getElementById("demoPauseBtn");
      if (btn) btn.textContent = "\u23F8 Pause";
    }
    clearTimeout(state.demoTimer);
    state.demoTimer = setTimeout(pollDemoFeeds, demoSpeedMs);
  }
  async function advanceDemoPlay(play) {
    const g = state.gameStates[play.gamePk];
    if (!g) {
      state.demoCurrentTime = play.ts;
      return;
    }
    if (play.type === "play" && state.focusGamePk === play.gamePk) {
      await _animateFocusPitches(play);
    }
    state.demoCurrentTime = play.ts;
    const feedData = { playTime: new Date(play.ts) };
    if (play.type === "status") {
      feedData.type = "status";
      feedData.icon = play.icon;
      feedData.label = play.label;
      feedData.sub = play.sub;
      if (play.label === "Game underway!") {
        g.status = "Live";
        g.detailedState = "In Progress";
      } else if (play.label === "Game Final") {
        g.status = "Final";
      } else if (play.label === "Game Postponed") {
        g.status = "Final";
        g.detailedState = "Postponed";
      } else if (play.label === "Game Delayed") {
        g.detailedState = "Delayed";
      }
    } else {
      if (g.status !== "Live" && g.status !== "Final") {
        g.status = "Live";
        g.detailedState = "In Progress";
      }
      const prevAway = g.awayScore || 0, prevHome = g.homeScore || 0;
      g.inning = play.inning;
      g.halfInning = play.halfInning;
      g.outs = play.outs;
      g.awayScore = play.awayScore;
      g.homeScore = play.homeScore;
      if (play.onFirst != null) g.onFirst = !!play.onFirst;
      if (play.onSecond != null) g.onSecond = !!play.onSecond;
      if (play.onThird != null) g.onThird = !!play.onThird;
      if (play.awayHits != null) g.awayHits = play.awayHits;
      if (play.homeHits != null) g.homeHits = play.homeHits;
      const isHitEvt = ["Single", "Double", "Triple", "Home Run"].indexOf(play.event) !== -1;
      if (state.perfectGameTracker[play.gamePk] === void 0) state.perfectGameTracker[play.gamePk] = true;
      if (["Walk", "Hit By Pitch", "Intentional Walk", "Error", "Fielders Choice", "Catcher Interference"].indexOf(play.event) !== -1) state.perfectGameTracker[play.gamePk] = false;
      if (isHitEvt) state.perfectGameTracker[play.gamePk] = false;
      if (isHitEvt && play.batterId) {
        const dh = state.dailyHitsTracker[play.batterId] || { name: play.batterName, hits: 0, hrs: 0, gamePk: play.gamePk };
        dh.hits++;
        if (play.event === "Home Run") dh.hrs++;
        dh.name = play.batterName || dh.name;
        dh.gamePk = play.gamePk;
        state.dailyHitsTracker[play.batterId] = dh;
      }
      if (play.event === "Strikeout" && play.pitcherId) {
        const kkey = play.gamePk + "_" + play.pitcherId;
        const ke = state.dailyPitcherKs[kkey] || { name: play.pitcherName, ks: 0, gamePk: play.gamePk };
        ke.ks++;
        ke.name = play.pitcherName || ke.name;
        state.dailyPitcherKs[kkey] = ke;
      }
      if (play.outs === 3) {
        const _rk = play.gamePk + "_" + play.inning + "_" + (play.halfInning || "top").toLowerCase();
        if (!state.inningRecapsFired.has(_rk)) state.inningRecapsPending[_rk] = { gamePk: play.gamePk, inning: play.inning, halfInning: (play.halfInning || "top").toLowerCase() };
      }
      let badge = "";
      if (play.event === "Home Run") badge = "HR";
      else if (play.event === "Double") badge = "2B";
      else if (play.event === "Triple") badge = "3B";
      else if (play.event === "Single") badge = "1B";
      feedData.type = "play";
      feedData.event = play.event;
      feedData.desc = play.desc;
      feedData.badge = badge;
      feedData.scoring = play.scoring;
      feedData.inning = play.inning;
      feedData.halfInning = play.halfInning;
      feedData.outs = play.outs;
      feedData.awayScore = play.awayScore;
      feedData.homeScore = play.homeScore;
      feedData.risp = play.risp;
      feedData.playClass = play.playClass;
      feedData.batterId = play.batterId;
      feedData.batterName = play.batterName;
      feedData.pitcherId = play.pitcherId;
      feedData.pitcherName = play.pitcherName;
      if (play.rbi != null) feedData.rbi = play.rbi;
      if (play.distance != null) feedData.distance = play.distance;
      if (play.speed != null) feedData.speed = play.speed;
      if (play.onFirst != null) feedData.onFirst = play.onFirst;
      if (play.onSecond != null) feedData.onSecond = play.onSecond;
      if (play.onThird != null) feedData.onThird = play.onThird;
      if (play.awayHits != null) feedData.awayHits = play.awayHits;
      if (play.homeHits != null) feedData.homeHits = play.homeHits;
      if (play.event === "Home Run") {
        _playSound("hr");
        if (play.batterId) _showPlayerCard2(play.batterId, play.batterName || "", g.awayId, g.homeId, play.halfInning, null, play.desc, null, play.gamePk);
        if (_hrSeekActive) {
          _hrSeekActive = false;
          demoSpeedMs = _hrSeekPriorSpeed || 1e4;
          demoPaused = true;
          const pauseBtn = document.getElementById("demoPauseBtn");
          if (pauseBtn) pauseBtn.textContent = "\u25B6";
        }
      } else if (play.scoring) {
        let rbi = play.rbi != null ? play.rbi : Math.max(0, play.awayScore - prevAway + (play.homeScore - prevHome));
        if (!rbi) rbi = 1;
        const rbiOk = Date.now() - (state.rbiCardCooldowns[play.gamePk] || 0) >= state.devTuning.rbiCooldown;
        const rbiScore = calcRBICardScore(rbi, play.event, play.awayScore, play.homeScore, play.inning, play.halfInning);
        if (_showRBICard2 && rbiScore >= state.devTuning.rbiThreshold && play.batterId && rbiOk) {
          state.rbiCardCooldowns[play.gamePk] = Date.now();
          _showRBICard2(play.batterId, play.batterName || "", g.awayId, g.homeId, play.halfInning, rbi, play.event, play.awayScore, play.homeScore, play.inning, play.gamePk);
        }
        _playSound("run");
      }
    }
    _addFeedItem(play.gamePk, feedData);
    _renderTicker();
    _renderSideRailGames();
    if (_selectFocusGame) _selectFocusGame();
    if (_pollFocusLinescore && state.focusGamePk) _pollFocusLinescore();
    if (_pollPendingVideoClips) _pollPendingVideoClips();
    await _buildStoryPool2();
  }
  async function _animateFocusPitches(play) {
    const timeline = state.pitchTimeline && state.pitchTimeline[play.gamePk] || [];
    if (!timeline.length || !play.batterId) return;
    let envelope = null;
    for (let ei = timeline.length - 1; ei >= 0; ei--) {
      const ev = timeline[ei];
      if (ev.batterId === play.batterId && Math.abs((ev.ts || 0) - play.ts) < 6e4) {
        envelope = ev;
        break;
      }
    }
    if (!envelope) return;
    const pitches = (envelope.pitches || []).filter(function(p) {
      return p.eventTs != null;
    });
    if (!pitches.length) return;
    const budget = Math.max(100, Math.min(demoSpeedMs * 0.5, 4e3));
    const perPitchMs = Math.max(40, Math.floor(budget / pitches.length));
    for (let i = 0; i < pitches.length; i++) {
      if (!state.demoMode) return;
      const p = pitches[i];
      state.demoCurrentTime = p.eventTs;
      if (_pollFocusLinescore && state.focusGamePk === play.gamePk) _pollFocusLinescore();
      await new Promise(function(res) {
        setTimeout(res, perPitchMs);
      });
    }
  }
  function renderDemoEndScreen() {
    state.demoMode = false;
    clearTimeout(state.demoTimer);
    if (state.storyRotateTimer) clearInterval(state.storyRotateTimer);
    const overlay = document.createElement("div");
    overlay.className = "demo-end-screen";
    overlay.innerHTML = '<div class="demo-end-card"><div class="demo-end-headline">Demo Complete</div><div class="demo-end-summary">' + state.demoGamesCache.length + " games &middot; " + state.demoPlayQueue.length + ' plays</div><div class="demo-end-tagline">Ready for live games? Enable Game Start Alerts in Settings.</div><button onclick="exitDemo()" style="margin-top:12px;background:var(--secondary);color:var(--accent-text);border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Exit Demo</button></div>';
    overlay.onclick = function(e) {
      if (e.target === overlay) exitDemo();
    };
    document.body.appendChild(overlay);
    setTimeout(function() {
      if (document.body.contains(overlay)) exitDemo();
    }, 4e3);
  }
  function exitDemo() {
    state.demoMode = false;
    demoPaused = false;
    _hrSeekActive = false;
    stopClassic();
    clearTimeout(state.demoTimer);
    if (state.storyRotateTimer) clearInterval(state.storyRotateTimer);
    if (state.pulseAbortCtrl) {
      state.pulseAbortCtrl.abort();
      state.pulseAbortCtrl = null;
    }
    if (state.focusAbortCtrl) {
      state.focusAbortCtrl.abort();
      state.focusAbortCtrl = null;
    }
    if (state.focusFastTimer) {
      clearInterval(state.focusFastTimer);
      state.focusFastTimer = null;
    }
    state.focusGamePk = null;
    state.focusIsManual = false;
    state.focusCurrentAbIdx = null;
    state.focusLastTimecode = null;
    state.focusPitchSequence = [];
    state.focusAlertShown = {};
    state.focusState = {
      balls: 0,
      strikes: 0,
      outs: 0,
      inning: 1,
      halfInning: "top",
      currentBatterId: null,
      currentBatterName: "",
      currentPitcherId: null,
      currentPitcherName: "",
      onFirst: false,
      onSecond: false,
      onThird: false,
      awayAbbr: "",
      homeAbbr: "",
      awayScore: 0,
      homeScore: 0,
      awayPrimary: "#444",
      homePrimary: "#444",
      tensionLabel: "NORMAL",
      tensionColor: "#9aa0a8",
      lastPitch: null,
      batterStats: null,
      pitcherStats: null
    };
    state.actionEvents = [];
    state.seenActionEventIds = /* @__PURE__ */ new Set();
    state.rbiCardCooldowns = {};
    state.focusOverlayOpen = false;
    const _focusOv = document.getElementById("focusOverlay");
    if (_focusOv) _focusOv.style.display = "none";
    const _focusMini = document.getElementById("focusMiniBar");
    if (_focusMini) _focusMini.style.display = "none";
    const _playerOv = document.getElementById("playerCardOverlay");
    if (_playerOv) _playerOv.classList.remove("open");
    const overlay = document.querySelector(".demo-end-screen");
    if (overlay) overlay.remove();
    document.body.classList.remove("demo-active");
    state.demoMode = false;
    state.gameStates = {};
    state.feedItems = [];
    state.enabledGames = /* @__PURE__ */ new Set();
    state.storyPool = [];
    state.demoPlayQueue = [];
    state.demoPlayIdx = 0;
    state.storyShownId = null;
    state.demoCurrentTime = 0;
    state.inningRecapsFired = /* @__PURE__ */ new Set();
    state.inningRecapsPending = {};
    state.lastInningState = {};
    state.pitchTimeline = {};
    state.boxscoreSnapshots = {};
    state.contentCacheTimeline = {};
    state.focusTrack = [];
    state.demoCardCount = 0;
    state.dailyLeadersCache = null;
    state.dailyLeadersLastFetch = 0;
    state.onThisDayCache = null;
    state.yesterdayCache = null;
    state.hrBatterStatsCache = {};
    state.probablePitcherStatsCache = {};
    state.dailyHitsTracker = {};
    state.dailyPitcherKs = {};
    state.storyCarouselRawGameData = {};
    state.stolenBaseEvents = [];
    state.transactionsCache = [];
    state.transactionsLastFetch = 0;
    state.liveWPCache = {};
    state.liveWPLastFetch = 0;
    state.perfectGameTracker = {};
    state.highLowCache = null;
    state.highLowLastFetch = 0;
    state.focusStatsCache = {};
    state.lastVideoClip = null;
    state.liveContentCache = {};
    state.yesterdayContentCache = {};
    state.boxscoreCache = {};
    const feed = document.getElementById("feed");
    if (feed) feed.innerHTML = "";
    const ticker = document.getElementById("gameTicker");
    if (ticker) ticker.innerHTML = "";
    const mockBar = document.getElementById("mockBar");
    if (mockBar) {
      mockBar.style.display = "none";
      mockBar.classList.remove("open");
      const btnNormal = document.getElementById("btnNormal");
      if (btnNormal) btnNormal.style.display = "";
      const btnFast = document.getElementById("btnFast");
      if (btnFast) btnFast.style.display = "";
      const btnSkip = document.getElementById("btnSkip");
      if (btnSkip) btnSkip.style.display = "";
      const demoSpeed1x = document.getElementById("demoSpeed1x");
      if (demoSpeed1x) demoSpeed1x.style.display = "none";
      const demoSpeed10x = document.getElementById("demoSpeed10x");
      if (demoSpeed10x) demoSpeed10x.style.display = "none";
      const demoSpeed30x = document.getElementById("demoSpeed30x");
      if (demoSpeed30x) demoSpeed30x.style.display = "none";
      const demoNextHRBtn = document.getElementById("demoNextHRBtn");
      if (demoNextHRBtn) demoNextHRBtn.style.display = "none";
      const demoPauseBtn = document.getElementById("demoPauseBtn");
      if (demoPauseBtn) demoPauseBtn.style.display = "none";
      const demoForwardBtn = document.getElementById("demoForwardBtn");
      if (demoForwardBtn) demoForwardBtn.style.display = "none";
      const demoExitBtn = document.getElementById("demoExitBtn");
      if (demoExitBtn) demoExitBtn.style.display = "none";
      const badge = document.getElementById("mockBarBadge");
      if (badge) badge.textContent = "\u26A1 Mock";
    }
    updateDemoBtnLabel();
    if (_resumeLivePulse) _resumeLivePulse();
  }

  // src/dev/tuning.js
  var DEBUG5 = false;
  var _refreshDebugPanel2 = null;
  var _devTuningDefaults = null;
  function setTuningCallbacks(cbs) {
    if (cbs.refreshDebugPanel) _refreshDebugPanel2 = cbs.refreshDebugPanel;
    if (cbs.devTuningDefaults) _devTuningDefaults = cbs.devTuningDefaults;
  }
  function toggleDevTools() {
    const p = document.getElementById("devToolsPanel");
    const opening = p.style.display !== "block";
    p.style.display = opening ? "block" : "none";
    if (opening) {
      document.getElementById("tuneRotateMs").value = state.devTuning.rotateMs;
      document.getElementById("tuneRbiThreshold").value = state.devTuning.rbiThreshold;
      document.getElementById("tuneRbiCooldown").value = state.devTuning.rbiCooldown;
      document.getElementById("tuneHRPriority").value = state.devTuning.hr_priority;
      document.getElementById("tuneHRCooldown").value = state.devTuning.hr_cooldown;
      document.getElementById("tuneBigInningPriority").value = state.devTuning.biginning_priority;
      document.getElementById("tuneBigInningThreshold").value = state.devTuning.biginning_threshold;
      document.getElementById("tuneWalkoffPriority").value = state.devTuning.walkoff_priority;
      document.getElementById("tuneNohitterFloor").value = state.devTuning.nohitter_inning_floor;
      document.getElementById("tuneBasesLoadedEnable").checked = state.devTuning.basesloaded_enable;
      document.getElementById("tuneBasesLoadedPriority").value = state.devTuning.basesloaded_priority;
      const tHF = document.getElementById("tuneHitstreakFloor");
      if (tHF) tHF.value = state.devTuning.hitstreak_floor || 10;
      const tHP = document.getElementById("tuneHitstreakPriority");
      if (tHP) tHP.value = state.devTuning.hitstreak_priority || 65;
      const tRI = document.getElementById("tuneRosterPriorityIL");
      if (tRI) tRI.value = state.devTuning.roster_priority_il || 40;
      const tRT = document.getElementById("tuneRosterPriorityTrade");
      if (tRT) tRT.value = state.devTuning.roster_priority_trade || 55;
      const tWL = document.getElementById("tuneWPLeverageFloor");
      if (tWL) tWL.value = state.devTuning.wp_leverage_floor || 2;
      const tWE = document.getElementById("tuneWPExtremeFloor");
      if (tWE) tWE.value = state.devTuning.wp_extreme_floor || 85;
      const tLP = document.getElementById("tuneLiveWPPriority");
      if (tLP) tLP.value = state.devTuning.livewp_priority || 30;
      const tLR = document.getElementById("tuneLiveWPRefresh");
      if (tLR) tLR.value = state.devTuning.livewp_refresh_ms || 9e4;
      document.getElementById("tuneFocusCritical").value = state.devTuning.focus_critical;
      document.getElementById("tuneFocusHigh").value = state.devTuning.focus_high;
      document.getElementById("tuneFocusSwitchMargin").value = state.devTuning.focus_switch_margin;
      document.getElementById("tuneFocusAlertCooldown").value = state.devTuning.focus_alert_cooldown;
      document.getElementById("lockThemeToggle").checked = state.devColorLocked;
      Recorder._updateStatus();
      Recorder._updateButtonState();
    }
  }
  function updateTuning(param, val) {
    if (param === "basesloaded_enable") {
      state.devTuning[param] = val === "true";
      if (DEBUG5) console.log("\u2713 Bases Loaded " + (state.devTuning[param] ? "enabled" : "disabled"));
      return;
    }
    const parsed = parseInt(val, 10);
    if (isNaN(parsed) || parsed < 1) return;
    state.devTuning[param] = parsed;
    if (param === "rotateMs") {
      if (state.storyRotateTimer) {
        clearInterval(state.storyRotateTimer);
        state.storyRotateTimer = null;
      }
      if (state.pulseInitialized && !state.demoMode) state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
      if (DEBUG5) console.log("\u2713 Carousel rotation updated to " + parsed + "ms");
    } else {
      if (DEBUG5) console.log("\u2713 " + param + " updated to " + parsed);
    }
  }
  function resetTuning() {
    if (!_devTuningDefaults) return;
    state.devTuning = Object.assign({}, _devTuningDefaults);
    document.getElementById("tuneRotateMs").value = _devTuningDefaults.rotateMs;
    document.getElementById("tuneRbiThreshold").value = _devTuningDefaults.rbiThreshold;
    document.getElementById("tuneRbiCooldown").value = _devTuningDefaults.rbiCooldown;
    document.getElementById("tuneHRPriority").value = _devTuningDefaults.hr_priority;
    document.getElementById("tuneHRCooldown").value = _devTuningDefaults.hr_cooldown;
    document.getElementById("tuneBigInningPriority").value = _devTuningDefaults.biginning_priority;
    document.getElementById("tuneBigInningThreshold").value = _devTuningDefaults.biginning_threshold;
    document.getElementById("tuneWalkoffPriority").value = _devTuningDefaults.walkoff_priority;
    document.getElementById("tuneNohitterFloor").value = _devTuningDefaults.nohitter_inning_floor;
    document.getElementById("tuneBasesLoadedEnable").checked = _devTuningDefaults.basesloaded_enable;
    document.getElementById("tuneBasesLoadedPriority").value = _devTuningDefaults.basesloaded_priority;
    document.getElementById("tuneFocusCritical").value = _devTuningDefaults.focus_critical;
    document.getElementById("tuneFocusHigh").value = _devTuningDefaults.focus_high;
    document.getElementById("tuneFocusSwitchMargin").value = _devTuningDefaults.focus_switch_margin;
    document.getElementById("tuneFocusAlertCooldown").value = _devTuningDefaults.focus_alert_cooldown;
    if (state.storyRotateTimer) {
      clearInterval(state.storyRotateTimer);
      state.storyRotateTimer = null;
    }
    if (state.pulseInitialized && !state.demoMode) state.storyRotateTimer = setInterval(rotateStory, state.devTuning.rotateMs);
    if (DEBUG5) console.log("\u2713 Dev tuning reset to defaults");
  }
  function updateColorOverride(context, colorVar, value) {
    state.devColorOverrides[context][colorVar] = value;
    if (state.devColorLocked) {
      if (context === "app") applyTeamTheme(state.activeTeam);
      else applyPulseMLBTheme();
    }
    if (DEBUG5) console.log("\u2713 " + context + " theme." + colorVar + " \u2192 " + value);
  }
  function captureCurrentTheme(context) {
    const cssVarMap = { dark: "--dark", card: "--card", card2: "--card2", border: "--border", primary: "--primary", secondary: "--secondary", accent: "--accent", accentText: "--accent-text", headerText: "--header-text" };
    const root = document.documentElement;
    Object.keys(cssVarMap).forEach(function(v) {
      const cssVal = getComputedStyle(root).getPropertyValue(cssVarMap[v]).trim();
      state.devColorOverrides[context][v] = cssVal;
      const elId = "color" + context.charAt(0).toUpperCase() + context.slice(1) + v.charAt(0).toUpperCase() + v.slice(1);
      const el = document.getElementById(elId);
      if (el) el.value = cssVal;
    });
    if (DEBUG5) console.log("\u2713 Captured current " + context + " theme colors");
  }
  function toggleColorLock(enable) {
    state.devColorLocked = enable;
    if (enable) {
      if (!state.devColorOverrides.app.primary) captureCurrentTheme("app");
      if (!state.devColorOverrides.pulse.primary) captureCurrentTheme("pulse");
      applyTeamTheme(state.activeTeam);
      if (DEBUG5) console.log("\u2713 Theme lock enabled \u2014 auto-switching disabled");
    } else {
      applyTeamTheme(state.activeTeam);
      applyPulseMLBTheme();
      if (DEBUG5) console.log("\u2713 Theme lock disabled \u2014 auto-switching restored");
    }
    document.getElementById("lockThemeToggle").checked = state.devColorLocked;
  }
  function confirmDevToolsChanges() {
    const fields = [
      ["rotateMs", "tuneRotateMs"],
      ["rbiThreshold", "tuneRbiThreshold"],
      ["rbiCooldown", "tuneRbiCooldown"],
      ["hr_priority", "tuneHRPriority"],
      ["hr_cooldown", "tuneHRCooldown"],
      ["biginning_priority", "tuneBigInningPriority"],
      ["biginning_threshold", "tuneBigInningThreshold"],
      ["walkoff_priority", "tuneWalkoffPriority"],
      ["nohitter_inning_floor", "tuneNohitterFloor"],
      ["basesloaded_priority", "tuneBasesLoadedPriority"],
      ["hitstreak_floor", "tuneHitstreakFloor"],
      ["hitstreak_priority", "tuneHitstreakPriority"],
      ["roster_priority_il", "tuneRosterPriorityIL"],
      ["roster_priority_trade", "tuneRosterPriorityTrade"],
      ["wp_leverage_floor", "tuneWPLeverageFloor"],
      ["wp_extreme_floor", "tuneWPExtremeFloor"],
      ["livewp_priority", "tuneLiveWPPriority"],
      ["livewp_refresh_ms", "tuneLiveWPRefresh"],
      ["focus_critical", "tuneFocusCritical"],
      ["focus_high", "tuneFocusHigh"],
      ["focus_switch_margin", "tuneFocusSwitchMargin"],
      ["focus_alert_cooldown", "tuneFocusAlertCooldown"]
    ];
    fields.forEach(function(f) {
      const el = document.getElementById(f[1]);
      if (el && el.value !== "") updateTuning(f[0], el.value);
    });
    const btn = document.getElementById("devConfirmBtn");
    btn.textContent = "\u2713 Applied!";
    btn.classList.add("applied");
    setTimeout(function() {
      btn.textContent = "Confirm Changes";
      btn.classList.remove("applied");
    }, 1500);
  }
  function initDevToolsClickDelegator() {
    function attach() {
      const panel = document.getElementById("devToolsPanel");
      if (!panel) return;
      panel.addEventListener("click", function(e) {
        const btn = e.target.closest("[data-dt-action]");
        if (!btn) return;
        const action = btn.dataset.dtAction;
        if (action === "close") {
          toggleDevTools();
        } else if (action === "demo") {
          toggleDemoMode();
          toggleDevTools();
        } else if (action === "replayHR") {
          replayHRCard();
          toggleDevTools();
        } else if (action === "replayRBI") {
          replayRBICard();
          toggleDevTools();
        } else if (action === "cardVariants") {
          window.PulseCard.demo();
          toggleDevTools();
        } else if (action === "testCard") {
          generateTestCard();
          toggleDevTools();
        } else if (action === "testClip") {
          devTestVideoClip();
          toggleDevTools();
        } else if (action === "resetCollection") {
          resetCollection();
        } else if (action === "newsTest") {
          openNewsSourceTest();
          toggleDevTools();
        } else if (action === "youtubeDebug") {
          openYoutubeDebug();
          toggleDevTools();
        } else if (action === "videoDebug") {
          openVideoDebugPanel();
          toggleDevTools();
        } else if (action === "radioCheck") {
          openRadioCheck();
          toggleDevTools();
        } else if (action === "testClassicRadio") {
          devTestClassicRadio();
        } else if (action === "openDemoFeeds") {
          const det = document.getElementById("demoFeedsDetails");
          if (det) {
            det.open = true;
            renderDemoFeedsTester();
          }
        } else if (action === "demoFeedPlay") {
          const url = btn.dataset.demoFeedUrl;
          if (url) testDemoFeedUrl(url);
        } else if (action === "resetTuning") {
          resetTuning();
        } else if (action === "captureApp") {
          captureCurrentTheme("app");
        } else if (action === "capturePulse") {
          captureCurrentTheme("pulse");
        } else if (action === "refreshDebug") {
          if (_refreshDebugPanel2) _refreshDebugPanel2();
        } else if (action === "copyLog") {
          copyLogAsMarkdown();
        } else if (action === "clearLog") {
          clearDevLog();
        } else if (action === "refreshLog") {
          renderLogCapture();
        } else if (action === "copyState") {
          copyAppStateAsMarkdown();
        } else if (action === "refreshState") {
          renderAppState();
        } else if (action === "copyStateContext") {
          _copyToClipboard(_stateAsMarkdownContext());
        } else if (action === "copyStatePulse") {
          _copyToClipboard(_stateAsMarkdownPulse());
        } else if (action === "copyStateFocus") {
          _copyToClipboard(_stateAsMarkdownFocus());
        } else if (action === "copyStateGames") {
          _copyToClipboard(_stateAsMarkdownGames());
        } else if (action === "copyStateFeed") {
          _copyToClipboard(_stateAsMarkdownFeed(50));
        } else if (action === "copyStateStories") {
          _copyToClipboard(_stateAsMarkdownStories());
        } else if (action === "copyNet") {
          copyNetTraceAsMarkdown();
        } else if (action === "clearNet") {
          clearNetTrace();
        } else if (action === "refreshNet") {
          renderNetTrace();
        } else if (action === "copyStorage") {
          copyStorageAsMarkdown();
        } else if (action === "refreshStorage") {
          renderStorageInspector();
        } else if (action === "clearLsKey") {
          clearLsKey(btn.dataset.lsKey);
        } else if (action === "copySW") {
          copySWStateAsMarkdown();
        } else if (action === "swUpdate") {
          swForceUpdate();
        } else if (action === "swUnregister") {
          swUnregisterAndReload();
        } else if (action === "testNotif") {
          testLocalNotification();
        } else if (action === "forceFocusGo") {
          forceFocusGo();
        } else if (action === "forceRecapGo") {
          forceRecapGo();
        } else if (action === "copySnapshot") {
          copyDiagnosticSnapshot();
        } else if (action === "previewSound") {
          previewSound(btn.dataset.soundType);
        } else if (action === "recorderToggle") {
          Recorder.toggle();
        } else if (action === "recorderDownload") {
          Recorder.download();
        } else if (action === "recorderCopy") {
          Recorder.copy();
        } else if (action === "recorderReset") {
          Recorder.reset();
        } else if (action === "confirm") {
          confirmDevToolsChanges();
        }
      });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach);
    else attach();
  }

  // src/auth/session.js
  function signOut() {
    if (!confirm("Sign out and disconnect sync?")) return;
    state.mlbSessionToken = null;
    state.mlbAuthUser = null;
    localStorage.removeItem("mlb_session_token");
    localStorage.removeItem("mlb_auth_user");
    clearInterval(state.mlbSyncInterval);
    state.mlbSyncInterval = null;
    updateSyncUI();
  }
  function updateSyncUI() {
    const panel = document.getElementById("syncStatus");
    if (!panel) return;
    if (state.mlbSessionToken && state.mlbAuthUser) {
      const isEmail = state.mlbAuthUser.indexOf("@") !== -1;
      const btnLabel = isEmail ? "\u2709\uFE0F Email \u2014 Sign Out" : "\u{1F419} GitHub \u2014 Sign Out";
      panel.innerHTML = '<button onclick="signOut()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 12px;border-radius:8px;cursor:pointer;width:100%;text-align:left">' + btnLabel + "</button>";
    } else {
      panel.innerHTML = '<div style="display:flex;gap:6px"><button onclick="signInWithGitHub()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 10px;border-radius:8px;cursor:pointer;flex:1;text-align:center">\u{1F419} GitHub</button><button onclick="signInWithEmail()" style="background:var(--card2);border:1px solid var(--border);color:var(--text);font-size:.72rem;padding:6px 10px;border-radius:8px;cursor:pointer;flex:1;text-align:center">\u2709\uFE0F Email</button></div>';
    }
  }
  function showSignInCTA() {
    if (state.mlbSessionToken || state.shownSignInCTA) return;
    state.signInCTACardCount++;
    if (state.signInCTACardCount < 3) return;
    state.shownSignInCTA = true;
    const el = document.getElementById("signInCTA");
    if (!el) return;
    el.style.display = "block";
    el.style.pointerEvents = "auto";
    requestAnimationFrame(function() {
      el.style.opacity = "1";
      el.style.transform = "translateX(-50%) translateY(0)";
      const bar = document.getElementById("signInCTABar");
      if (bar) {
        requestAnimationFrame(function() {
          bar.style.transform = "scaleX(0)";
        });
      }
    });
    state.signInCTATimer = setTimeout(closeSignInCTA, TIMING.SIGNIN_CTA_MS);
  }

  // src/ui/lens.js
  function myTeamGamePks() {
    const out = /* @__PURE__ */ new Set();
    Object.values(state.gameStates).forEach(function(g) {
      if (g.awayId === state.activeTeam.id || g.homeId === state.activeTeam.id) out.add(g.gamePk);
    });
    return out;
  }
  function applyMyTeamLens(on) {
    state.myTeamLens = !!on;
    localStorage.setItem("mlb_my_team_lens", state.myTeamLens ? "1" : "0");
    const btn = document.getElementById("myTeamLensBtn"), knob = document.getElementById("myTeamLensKnob");
    if (btn) btn.classList.toggle("on", state.myTeamLens);
    if (knob) knob.style.left = state.myTeamLens ? "21px" : "2px";
    if (state.myTeamLens) {
      const keep = myTeamGamePks();
      state.enabledGames = /* @__PURE__ */ new Set();
      keep.forEach(function(pk) {
        state.enabledGames.add(pk);
      });
      document.querySelectorAll("[data-gamepk]").forEach(function(el) {
        const pk = +el.getAttribute("data-gamepk");
        el.classList.toggle("feed-hidden", !keep.has(pk));
      });
    } else {
      Object.keys(state.gameStates).forEach(function(pk) {
        state.enabledGames.add(+pk);
      });
      document.querySelectorAll("[data-gamepk]").forEach(function(el) {
        el.classList.remove("feed-hidden");
      });
    }
    if (typeof renderTicker === "function") renderTicker();
    updateFeedEmpty();
  }
  function toggleMyTeamLens() {
    applyMyTeamLens(!state.myTeamLens);
  }
  function toggleGame(gamePk) {
    gamePk = +gamePk;
    if (state.enabledGames.has(gamePk)) {
      state.enabledGames.delete(gamePk);
      document.querySelectorAll('[data-gamepk="' + gamePk + '"]').forEach(function(el) {
        el.classList.add("feed-hidden");
      });
    } else {
      state.enabledGames.add(gamePk);
      document.querySelectorAll('[data-gamepk="' + gamePk + '"]').forEach(function(el) {
        el.classList.remove("feed-hidden");
      });
    }
    updateFeedEmpty();
    renderTicker();
  }

  // src/sections/stats/compare.js
  function compareBoxesFor(group) {
    if (group === "hitting") return [
      { l: "AVG", k: "avg", fmt: "rate" },
      { l: "OBP", k: "obp", fmt: "rate" },
      { l: "SLG", k: "slg", fmt: "rate" },
      { l: "OPS", k: "ops", fmt: "rate" },
      { l: "HR", k: "homeRuns", fmt: "int" },
      { l: "RBI", k: "rbi", fmt: "int" },
      { l: "H", k: "hits", fmt: "int" },
      { l: "2B", k: "doubles", fmt: "int" },
      { l: "3B", k: "triples", fmt: "int" },
      { l: "R", k: "runs", fmt: "int" },
      { l: "BB", k: "baseOnBalls", fmt: "int" },
      { l: "K", k: "strikeOuts", fmt: "int", lowerBetter: true },
      { l: "SB", k: "stolenBases", fmt: "int" },
      { l: "PA", k: "plateAppearances", fmt: "int", neutral: true }
    ];
    return [
      { l: "ERA", k: "era", fmt: "two", lowerBetter: true },
      { l: "WHIP", k: "whip", fmt: "two", lowerBetter: true },
      { l: "K", k: "strikeOuts", fmt: "int" },
      { l: "W", k: "wins", fmt: "int" },
      { l: "L", k: "losses", fmt: "int", lowerBetter: true },
      { l: "SV", k: "saves", fmt: "int" },
      { l: "IP", k: "inningsPitched", fmt: "ip", neutral: true },
      { l: "K/9", k: "strikeoutsPer9Inn", fmt: "two" },
      { l: "BB/9", k: "walksPer9Inn", fmt: "two", lowerBetter: true },
      { l: "K/BB", k: "strikeoutWalkRatio", fmt: "two" },
      { l: "H", k: "hits", fmt: "int", lowerBetter: true },
      { l: "BB", k: "baseOnBalls", fmt: "int", lowerBetter: true },
      { l: "HR", k: "homeRuns", fmt: "int", lowerBetter: true }
    ];
  }
  function compareFmt(box, val) {
    if (val == null || val === "") return "\u2014";
    if (box.fmt === "rate") {
      const n2 = parseFloat(val);
      if (isNaN(n2)) return String(val);
      const s = n2.toFixed(3);
      return s.charAt(0) === "0" ? s.slice(1) : s;
    }
    if (box.fmt === "two") {
      const n2 = parseFloat(val);
      if (isNaN(n2)) return String(val);
      return n2.toFixed(2);
    }
    if (box.fmt === "ip") {
      return String(val);
    }
    const n = parseInt(val, 10);
    return isNaN(n) ? String(val) : String(n);
  }
  function compareStatFor(playerId, group) {
    const pool = state.statsCache[group] || [];
    const entry = pool.find(function(p) {
      return p.player && p.player.id === playerId;
    });
    return entry && entry.stat ? entry.stat : null;
  }
  function openCompareOverlay() {
    if (!state.selectedPlayer) return;
    const group = state.currentRosterTab === "pitching" ? "pitching" : "hitting";
    state.compareGroup = group;
    state.compareA = state.selectedPlayer;
    const pool = state.rosterData[group] || [];
    const aId = state.selectedPlayer.person && state.selectedPlayer.person.id;
    const b = pool.find(function(p) {
      return p.person && p.person.id !== aId;
    });
    state.compareB = b || null;
    state.compareOpen = true;
    const ov = document.getElementById("compareOverlay");
    if (ov) ov.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    renderCompare();
  }
  function closeCompareOverlay() {
    state.compareOpen = false;
    const ov = document.getElementById("compareOverlay");
    if (ov) ov.setAttribute("hidden", "");
    document.body.style.overflow = "";
  }
  function setCompareSlot(slot, playerId) {
    const pool = state.rosterData[state.compareGroup] || [];
    const pid = parseInt(playerId, 10);
    const p = pool.find(function(pl) {
      return pl.person && pl.person.id === pid;
    });
    if (!p) return;
    if (slot === "a") state.compareA = p;
    else state.compareB = p;
    renderCompare();
  }
  function setCompareGroup(group) {
    if (group !== "hitting" && group !== "pitching") return;
    if (state.compareGroup === group) return;
    state.compareGroup = group;
    const pool = state.rosterData[group] || [];
    function inPool(pl) {
      return pl && pl.person && pool.some(function(p) {
        return p.person && p.person.id === pl.person.id;
      });
    }
    if (!inPool(state.compareA)) state.compareA = pool[0] || null;
    if (!inPool(state.compareB)) {
      const aId = state.compareA && state.compareA.person && state.compareA.person.id;
      state.compareB = pool.find(function(p) {
        return p.person && p.person.id !== aId;
      }) || null;
    }
    renderCompare();
  }
  function renderCompare() {
    const bodyEl = document.getElementById("compareBody");
    if (!bodyEl) return;
    const group = state.compareGroup;
    const a = state.compareA, b = state.compareB;
    const hasHitters = (state.rosterData.hitting || []).length > 0;
    const hasPitchers = (state.rosterData.pitching || []).length > 0;
    const groupBar = hasHitters && hasPitchers ? '<div class="compare-group-bar">' + ["hitting", "pitching"].map(function(g) {
      return '<button type="button" class="compare-group-btn' + (group === g ? " active" : "") + `" onclick="setCompareGroup('` + g + `')">` + (g === "hitting" ? "\u26BE Hitting" : "\u{1F94E} Pitching") + "</button>";
    }).join("") + "</div>" : "";
    function pickerOptions(otherId, selectedId) {
      const pool = state.rosterData[group] || [];
      return pool.filter(function(p) {
        return p.person && p.person.id !== otherId;
      }).map(function(p) {
        const sel = p.person.id === selectedId ? " selected" : "";
        return '<option value="' + p.person.id + '"' + sel + ">" + (p.person.fullName || "#" + p.person.id) + "</option>";
      }).join("");
    }
    function slotHeader(slot, player, otherPlayer) {
      const pid = player && player.person && player.person.id;
      const pname = player && player.person && player.person.fullName || "\u2014";
      const pos = player && player.position && player.position.abbreviation || "";
      const jersey = player && player.jerseyNumber ? "#" + player.jerseyNumber : "";
      const headshot = pid ? '<img class="compare-headshot" src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/' + pid + '/headshot/67/current" alt="">' : '<div class="compare-headshot compare-headshot-empty">?</div>';
      const otherId = otherPlayer && otherPlayer.person && otherPlayer.person.id;
      return '<div class="compare-slot">' + headshot + '<div class="compare-slot-name">' + pname + '</div><div class="compare-slot-meta">' + (jersey ? jersey + " \xB7 " : "") + pos + `</div><select class="compare-picker" onchange="setCompareSlot('` + slot + `', this.value)">` + pickerOptions(otherId, pid) + "</select></div>";
    }
    const aStat = a ? compareStatFor(a.person.id, group) : null;
    const bStat = b ? compareStatFor(b.person.id, group) : null;
    const head = '<div class="compare-pickers">' + slotHeader("a", a, b) + '<div class="compare-vs">vs</div>' + slotHeader("b", b, a) + "</div>";
    if (!a || !b) {
      bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">Pick a second player to compare.</div>';
      return;
    }
    if (!aStat || !bStat) {
      bodyEl.innerHTML = groupBar + head + '<div class="compare-empty">' + (!aStat ? a.person.fullName || "Player A" : "") + (!aStat && !bStat ? " and " : "") + (!bStat ? b.person.fullName || "Player B" : "") + " have no " + SEASON + " " + group + " stats yet.</div>";
      return;
    }
    const boxes = compareBoxesFor(group);
    const rows = boxes.map(function(box) {
      const av = aStat[box.k], bv = bStat[box.k];
      const aDisp = compareFmt(box, av);
      const bDisp = compareFmt(box, bv);
      const aN = parseFloat(av), bN = parseFloat(bv);
      let aClass = "", bClass = "";
      if (!box.neutral && !isNaN(aN) && !isNaN(bN) && aN !== bN) {
        const aWins = box.lowerBetter ? aN < bN : aN > bN;
        aClass = aWins ? " compare-win" : " compare-lose";
        bClass = aWins ? " compare-lose" : " compare-win";
      }
      return '<div class="compare-row"><div class="compare-cell' + aClass + '">' + aDisp + '</div><div class="compare-label">' + box.l + '</div><div class="compare-cell' + bClass + '">' + bDisp + "</div></div>";
    }).join("");
    bodyEl.innerHTML = groupBar + head + '<div class="compare-grid">' + rows + '</div><div class="compare-foot">Same-team comparison \xB7 season totals \xB7 winner highlighted per row (lower is better for ERA / WHIP / BB-9 / counting losses).</div>';
  }

  // src/sections/stats/_shared.js
  var HOT_COLD_OPS_HOT = 0.9;
  var HOT_COLD_OPS_COLD = 0.5;
  var HOT_COLD_MIN_GAMES_IN_10 = 7;
  var HOT_COLD_TTL_MS = 12 * 60 * 60 * 1e3;
  function scrollTabIntoView(btn) {
    if (!btn || !btn.parentElement) return;
    const p = btn.parentElement;
    if (p.scrollWidth <= p.clientWidth) return;
    const tgt = btn.offsetLeft - (p.clientWidth - btn.offsetWidth) / 2;
    p.scrollTo({ left: Math.max(0, tgt), behavior: "smooth" });
  }
  function hotColdBadge(playerId) {
    const cached = state.lastNCache[playerId];
    if (!cached || !cached.last10 || !cached.last15) return "";
    const gp10 = parseInt(cached.last10.gamesPlayed, 10) || 0;
    if (gp10 < HOT_COLD_MIN_GAMES_IN_10) return "";
    const l15 = parseFloat(cached.last15.ops);
    if (isNaN(l15)) return "";
    const fmtO = function(n) {
      const s = n.toFixed(3);
      return s.charAt(0) === "0" ? s.slice(1) : s;
    };
    const tip = "Last 15 OPS " + fmtO(l15) + " (" + gp10 + "/10 games)";
    if (l15 >= HOT_COLD_OPS_HOT) return ' <span class="story-badge hot stats-hot-cold" title="' + tip + '">\u{1F525} HOT</span>';
    if (l15 < HOT_COLD_OPS_COLD) return ' <span class="story-badge cold stats-hot-cold" title="' + tip + '">\u2744 COLD</span>';
    return "";
  }

  // src/sections/stats/leaders.js
  function selectLeaderPill(group, stat, btn) {
    const ids = group === "hitting" ? ["hitLeaderPills", "hitLeaderPillsExtras"] : ["pitLeaderPills", "pitLeaderPillsExtras"];
    ids.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.querySelectorAll(".leader-pill").forEach(function(b) {
        b.classList.remove("active");
      });
    });
    btn.classList.add("active");
    loadLeaders();
  }
  function switchLeaderTab(tab, btn) {
    state.currentLeaderTab = tab;
    document.querySelectorAll(".stat-tabs button").forEach(function(b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    scrollTabIntoView(btn);
    document.getElementById("hitLeaderPills").style.display = tab === "hitting" ? "flex" : "none";
    document.getElementById("pitLeaderPills").style.display = tab === "pitching" ? "flex" : "none";
    ["hitLeaderPillsExtras", "pitLeaderPillsExtras"].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.setAttribute("hidden", "");
    });
    document.querySelectorAll(".leader-pill--more").forEach(function(b) {
      b.classList.remove("open");
      b.setAttribute("aria-expanded", "false");
      b.textContent = "+ more";
    });
    loadLeaders();
  }
  function teamGamesFor(group) {
    const ts = state.teamStats || {};
    const src = group === "pitching" ? ts.pitching : ts.hitting;
    if (!src) return 0;
    const g = parseInt(src.gamesPlayed, 10);
    return isNaN(g) ? 0 : g;
  }
  function isQualified(group, stat) {
    const g = teamGamesFor(group);
    if (!g) return true;
    if (group === "hitting") {
      const pa = parseFloat(stat.plateAppearances);
      return !isNaN(pa) && pa >= 3.1 * g;
    }
    if (group === "pitching") {
      const ip = parseFloat(stat.inningsPitched);
      return !isNaN(ip) && ip >= 1 * g;
    }
    return true;
  }
  function loadLeaders() {
    const group = state.currentLeaderTab;
    const rowSel = group === "hitting" ? "#hitLeaderPills, #hitLeaderPillsExtras" : "#pitLeaderPills, #pitLeaderPillsExtras";
    const activePill = document.querySelector(rowSel.split(",").map(function(s) {
      return s.trim() + " .leader-pill.active";
    }).join(","));
    const stat = activePill ? activePill.dataset.stat : group === "hitting" ? "avg" : "era";
    const data = state.statsCache[group];
    if (!data || !data.length) {
      document.getElementById("leaderList").innerHTML = '<div style="color:var(--muted);padding:12px;font-size:.85rem">Stats still loading...</div>';
      return;
    }
    const isAsc = ["era", "whip", "walksAndHitsPerInningPitched", "walksPer9Inn", "losses"].indexOf(stat) > -1;
    const withStat = data.filter(function(s) {
      return s.stat[stat] != null && s.stat[stat] !== "";
    });
    const qualified = state.qualifiedOnly ? withStat.filter(function(s) {
      return isQualified(group, s.stat);
    }) : withStat;
    const hiddenCount = withStat.length - qualified.length;
    const sorted = qualified.slice().sort(function(a, b) {
      return isAsc ? parseFloat(a.stat[stat]) - parseFloat(b.stat[stat]) : parseFloat(b.stat[stat]) - parseFloat(a.stat[stat]);
    }).slice(0, 10);
    if (!sorted.length) {
      const emptyMsg = hiddenCount > 0 ? hiddenCount + " player(s) hidden by qualified filter \u2014 toggle off to show" : "No data for this stat yet";
      document.getElementById("leaderList").innerHTML = '<div style="color:var(--muted);padding:12px;font-size:.85rem">' + emptyMsg + "</div>";
      return;
    }
    let html = "";
    sorted.forEach(function(s, i) {
      const val = parseFloat(s.stat[stat]), display = val < 1 && val > 0 ? val.toFixed(3).slice(1) : Number.isInteger(val) ? val : val.toFixed(2);
      const badge = group === "hitting" ? hotColdBadge(s.player.id) : "";
      html += '<div class="player-item" onclick="selectPlayer(' + s.player.id + ",'" + group + `')"><div style="display:flex;align-items:center;gap:10px"><span style="color:var(--accent);font-weight:800;width:18px;font-size:.85rem">` + (i + 1) + '</span><div><div class="player-name" style="font-size:.85rem">' + (s.player.fullName || "\u2014") + badge + '</div></div></div><div style="font-size:1.1rem;font-weight:800;color:var(--accent)">' + display + "</div></div>";
    });
    if (state.qualifiedOnly && hiddenCount > 0) {
      html += '<div class="leader-qual-footer">\u26A0 ' + hiddenCount + " player" + (hiddenCount === 1 ? "" : "s") + " hidden \xB7 toggle off to show small samples</div>";
    }
    document.getElementById("leaderList").innerHTML = html;
  }
  function toggleLeaderMore(group, btn) {
    const extrasId = group === "hitting" ? "hitLeaderPillsExtras" : "pitLeaderPillsExtras";
    const el = document.getElementById(extrasId);
    if (!el) return;
    const isOpen = !el.hasAttribute("hidden");
    if (isOpen) {
      el.setAttribute("hidden", "");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "+ more";
    } else {
      el.removeAttribute("hidden");
      btn.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "\u2212 less";
    }
  }
  function toggleQualifiedOnly() {
    state.qualifiedOnly = !state.qualifiedOnly;
    if (typeof localStorage !== "undefined") localStorage.setItem("mlb_stats_qualified_only", state.qualifiedOnly ? "1" : "0");
    const sw = document.getElementById("qualifiedToggle");
    if (sw) sw.setAttribute("aria-checked", state.qualifiedOnly ? "true" : "false");
    if (sw) sw.classList.toggle("on", state.qualifiedOnly);
    loadLeaders();
  }

  // src/utils/stats-math.js
  function leaderEntry(group, statKey) {
    return LEADER_CATS_FOR_PERCENTILE.find(function(e) {
      return e.group === group && e.key === statKey;
    });
  }
  function computePercentile(group, statKey, value) {
    if (value == null || value === "") return null;
    const entry = leaderEntry(group, statKey);
    if (!entry) return null;
    const arr = state.leagueLeaders[group + ":" + entry.leaderCategory];
    if (!arr || !arr.length) return null;
    const v = parseFloat(value);
    if (isNaN(v)) return null;
    let rank = arr.length;
    let foundInPool = false;
    for (let i = 0; i < arr.length; i++) {
      const beats = entry.lowerIsBetter ? v < arr[i].value : v > arr[i].value;
      if (beats) {
        rank = i + 1;
        foundInPool = true;
        break;
      }
      const ties = v === arr[i].value;
      if (ties) {
        rank = i + 1;
        foundInPool = true;
        break;
      }
    }
    const total = arr.length;
    const percentile = Math.max(0, Math.min(100, Math.round((total - rank) / Math.max(1, total - 1) * 100)));
    return { rank, total, percentile, outsideTop: !foundInPool };
  }
  function tierFromPercentile(p) {
    if (p == null) return null;
    if (p >= 90) return "elite";
    if (p >= 65) return "good";
    if (p >= 30) return "mid";
    return "bad";
  }
  function pctBar(percentile) {
    if (percentile == null) return "";
    const tier = tierFromPercentile(percentile);
    return '<div class="pct-bar pct-bar--' + tier + '"><i style="width:' + percentile + '%"></i></div>';
  }
  function rankCaption(rank, total) {
    if (rank == null || total == null) return "";
    const label = "#" + rank;
    return '<div class="rank-caption"><span>MLB</span><b>' + label + "</b></div>";
  }
  function avgChip(playerValue, basisValue, decimals, lowerIsBetter) {
    if (basisValue == null) return "";
    decimals = decimals === void 0 ? 3 : decimals;
    const b = parseFloat(basisValue);
    if (isNaN(b)) return "";
    let s = b.toFixed(decimals);
    if (decimals >= 3 && s.charAt(0) === "0") s = s.slice(1);
    const p = playerValue == null ? NaN : parseFloat(playerValue);
    let cls = "";
    if (!isNaN(p)) {
      const beats = lowerIsBetter ? p < b : p > b;
      cls = beats ? " pos" : " neg";
    }
    return '<span class="delta-chip avg-chip' + cls + '">Avg: ' + s + "</span>";
  }
  function leagueAverage(group, statKey) {
    const entry = leaderEntry(group, statKey);
    if (!entry) return null;
    const arr = state.leagueLeaders[group + ":" + entry.leaderCategory];
    if (!arr || !arr.length) return null;
    let sum = 0;
    for (let i = 0; i < arr.length; i++) sum += arr[i].value;
    return sum / arr.length;
  }
  function teamAverage(group, statKey) {
    const pool = state.statsCache[group] || [];
    if (!pool.length) return null;
    let sum = 0, n = 0;
    for (let i = 0; i < pool.length; i++) {
      const raw = pool[i].stat ? pool[i].stat[statKey] : null;
      const v = raw == null ? NaN : parseFloat(raw);
      if (!isNaN(v)) {
        sum += v;
        n++;
      }
    }
    return n ? sum / n : null;
  }

  // src/data/leaders.js
  async function fetchLeagueLeaders(group) {
    if (!group) return;
    const FRESH_MS2 = 3e5;
    if (state.leagueLeadersInflight[group]) return state.leagueLeadersInflight[group];
    if (state.leagueLeadersFetchedAt[group] && Date.now() - state.leagueLeadersFetchedAt[group] < FRESH_MS2) return;
    const entries = LEADER_CATS_FOR_PERCENTILE.filter(function(e) {
      return e.group === group;
    });
    if (!entries.length) return;
    const seen = {}, cats = [];
    entries.forEach(function(e) {
      if (!seen[e.leaderCategory]) {
        seen[e.leaderCategory] = true;
        cats.push(e.leaderCategory);
      }
    });
    const url = MLB_BASE + "/stats/leaders?leaderCategories=" + cats.join(",") + "&statGroup=" + group + "&season=" + SEASON + "&limit=300";
    const p = async function() {
      try {
        const r = await fetch(url);
        const d = await r.json();
        const blocks = d.leagueLeaders || [];
        blocks.forEach(function(blk) {
          const entry = entries.find(function(e) {
            return e.leaderCategory === blk.leaderCategory;
          });
          if (!entry) return;
          const leaders = (blk.leaders || []).map(function(l) {
            const v = parseFloat(l.value);
            if (isNaN(v)) return null;
            return {
              playerId: l.person && l.person.id,
              playerName: l.person && l.person.fullName,
              teamId: l.team && l.team.id,
              teamAbbr: l.team && (l.team.abbreviation || l.team.name),
              value: v,
              rank: parseInt(l.rank, 10) || null
            };
          }).filter(function(x) {
            return x !== null;
          });
          leaders.sort(function(a, b) {
            return entry.lowerIsBetter ? a.value - b.value : b.value - a.value;
          });
          state.leagueLeaders[group + ":" + blk.leaderCategory] = leaders;
        });
        state.leagueLeadersFetchedAt[group] = Date.now();
      } catch (e) {
      } finally {
        delete state.leagueLeadersInflight[group];
      }
    }();
    state.leagueLeadersInflight[group] = p;
    return p;
  }

  // src/sections/stats/player.js
  async function selectPlayer(id, type, noScroll) {
    const playerObj = (state.rosterData[type] || []).find(function(p) {
      return p.person.id === id;
    }) || { person: { id } };
    state.selectedPlayer = playerObj;
    renderPlayerList();
    document.getElementById("playerStatsTitle").textContent = playerObj.person && playerObj.person.fullName ? playerObj.person.fullName : "Player Stats";
    document.getElementById("playerStats").innerHTML = '<div class="loading">Loading stats...</div>';
    try {
      const group = type === "pitching" ? "pitching" : type === "fielding" ? "fielding" : "hitting";
      const [r] = await Promise.all([
        fetch(MLB_BASE + "/people/" + id + "/stats?stats=season&season=" + SEASON + "&group=" + group),
        group === "fielding" ? Promise.resolve() : fetchLeagueLeaders(group)
      ]);
      if (!r.ok) throw new Error(r.status);
      if (group !== "fielding") {
        fetchGameLog(id, group).then(function() {
          onGameLogResolved(id, group);
        }).catch(function() {
        });
      }
      const d = await r.json();
      const stats = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
      if (!stats) {
        document.getElementById("playerStats").innerHTML = '<div class="empty-state">No ' + SEASON + " stats available yet</div>";
        if (!noScroll && (window.innerWidth <= 767 || window.innerWidth <= 1024 && window.matchMedia("(orientation:portrait)").matches)) {
          document.getElementById("playerStats").scrollIntoView({ behavior: "smooth", block: "end" });
        }
        return;
      }
      renderPlayerStats(stats, group);
      if (!noScroll && (window.innerWidth <= 767 || window.innerWidth <= 1024 && window.matchMedia("(orientation:portrait)").matches)) {
        document.getElementById("playerStats").scrollIntoView({ behavior: "smooth", block: "end" });
      }
    } catch (e) {
      document.getElementById("playerStats").innerHTML = '<div class="error">Could not load stats</div>';
    }
  }
  function renderPlayerStats(s, group) {
    state.selectedPlayerStat = { stat: s, group };
    let activeTab = state.activeStatsTab || "overview";
    const fieldingMode = group === "fielding";
    if (fieldingMode) activeTab = "overview";
    document.querySelectorAll("#playerTabs .player-tab").forEach(function(b) {
      const t = b.dataset.tab;
      b.style.display = fieldingMode && t !== "overview" ? "none" : "";
      b.classList.toggle("active", t === activeTab);
    });
    const html = '<div class="player-tab-panels"><div class="player-tab-panel" data-tab="overview"' + (activeTab !== "overview" ? " hidden" : "") + ">" + renderOverviewTab(s, group) + '</div><div class="player-tab-panel" data-tab="splits"' + (activeTab !== "splits" ? " hidden" : "") + ">" + renderSplitsPlaceholder() + '</div><div class="player-tab-panel" data-tab="gamelog"' + (activeTab !== "gamelog" ? " hidden" : "") + ">" + renderGameLogPlaceholder() + '</div><div class="player-tab-panel" data-tab="advanced"' + (activeTab !== "advanced" ? " hidden" : "") + ">" + renderAdvancedPlaceholder(group) + '</div><div class="player-tab-panel" data-tab="career"' + (activeTab !== "career" ? " hidden" : "") + ">" + renderCareerPlaceholder() + "</div></div>";
    document.getElementById("playerStats").innerHTML = html;
    if (activeTab !== "overview") {
      const pid = state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id;
      if (pid) {
        if (activeTab === "gamelog") {
          const glk = pid + ":" + (group === "fielding" ? "hitting" : group);
          if (state.gameLogCache[glk]) renderGameLogTab(pid, group);
          else fetchGameLog(pid, group).then(function() {
            onGameLogResolved(pid, group);
          }).catch(function() {
          });
        } else if (activeTab === "splits") {
          const slk = pid + ":" + (group === "fielding" ? "hitting" : group);
          if (state.statSplitsCache[slk]) renderSplitsTab(pid, group);
          else fetchStatSplits(pid, group).then(function() {
            if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === pid && state.activeStatsTab === "splits") renderSplitsTab(pid, group);
          }).catch(function() {
          });
        } else if (activeTab === "advanced" && group === "pitching") {
          if (state.pitchArsenalCache[pid]) renderArsenalTab(pid);
          else fetchPitchArsenal(pid).then(function() {
            if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === pid && state.activeStatsTab === "advanced") renderArsenalTab(pid);
          }).catch(function() {
          });
        } else if (activeTab === "advanced" && group === "hitting") {
          if (state.advancedHittingCache[pid] && state.hotColdCache[pid]) renderAdvancedHittingTab(pid);
          else loadAdvancedHittingForTab(pid);
        } else if (activeTab === "career") {
          ensureCareerLoaded(pid, group);
        }
      }
    }
  }
  function switchPlayerStatsTab(tab, btn) {
    if (["overview", "splits", "gamelog", "advanced", "career"].indexOf(tab) < 0) return;
    state.activeStatsTab = tab;
    if (typeof localStorage !== "undefined") localStorage.setItem("mlb_stats_tab", tab);
    document.querySelectorAll("#playerTabs .player-tab").forEach(function(b) {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    document.querySelectorAll(".player-tab-panel").forEach(function(p) {
      if (p.dataset.tab === tab) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });
    if (btn) scrollTabIntoView(btn);
    const sel = state.selectedPlayer;
    const pid = sel && sel.person && sel.person.id;
    const group = state.selectedPlayerStat ? state.selectedPlayerStat.group : state.currentRosterTab || "hitting";
    if (!pid) return;
    if (tab === "gamelog") {
      const cacheKey = pid + ":" + (group === "fielding" ? "hitting" : group);
      if (!state.gameLogCache[cacheKey]) {
        fetchGameLog(pid, group).then(function() {
          onGameLogResolved(pid, group);
        }).catch(function() {
        });
      } else {
        renderGameLogTab(pid, group);
      }
    } else if (tab === "splits") {
      const splitKey = pid + ":" + (group === "fielding" ? "hitting" : group);
      if (!state.statSplitsCache[splitKey]) {
        fetchStatSplits(pid, group).then(function() {
          if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === pid && state.activeStatsTab === "splits") {
            renderSplitsTab(pid, group);
          }
        }).catch(function() {
        });
      } else {
        renderSplitsTab(pid, group);
      }
    } else if (tab === "advanced") {
      if (group === "pitching") {
        if (!state.pitchArsenalCache[pid]) {
          fetchPitchArsenal(pid).then(function() {
            if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === pid && state.activeStatsTab === "advanced") {
              renderArsenalTab(pid);
            }
          }).catch(function() {
          });
        } else {
          renderArsenalTab(pid);
        }
      } else if (group === "hitting") {
        if (!state.advancedHittingCache[pid] || !state.hotColdCache[pid]) {
          loadAdvancedHittingForTab(pid);
        } else {
          renderAdvancedHittingTab(pid);
        }
      }
    } else if (tab === "career") {
      ensureCareerLoaded(pid, group);
    }
  }
  function renderSplitsPlaceholder() {
    return '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4CA}</div><h4>Splits panel</h4><p>Loading splits...</p></div>';
  }
  var STATSPLITS_TTL_MS = 24 * 60 * 60 * 1e3;
  var SPLIT_LABELS = {
    vl: "vs LHP",
    vr: "vs RHP",
    h: "Home",
    a: "Away",
    risp: "RISP",
    e: "Bases Empty",
    r: "Runners On",
    lc: "Late & Close"
  };
  async function fetchStatSplits(playerId, group) {
    if (!playerId) return null;
    if (group === "fielding") group = "hitting";
    const key = playerId + ":" + group;
    const cached = state.statSplitsCache[key];
    if (cached && Date.now() - cached.ts < STATSPLITS_TTL_MS) return cached.splits;
    try {
      const codes = "vl,vr,h,a,risp,e,r,lc";
      const r = await fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=statSplits&sitCodes=" + codes + "&season=" + SEASON + "&group=" + group);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const splits = d.stats && d.stats[0] && d.stats[0].splits ? d.stats[0].splits : [];
      state.statSplitsCache[key] = { splits, ts: Date.now() };
      return splits;
    } catch (e) {
      return null;
    }
  }
  function renderSplitsTab(playerId, group) {
    if (group === "fielding") group = "hitting";
    const key = playerId + ":" + group;
    const cached = state.statSplitsCache[key];
    const panelEl = document.querySelector('.player-tab-panel[data-tab="splits"]');
    if (!panelEl) return;
    if (!cached) {
      panelEl.innerHTML = renderSplitsPlaceholder();
      return;
    }
    const splits = cached.splits;
    if (!splits.length) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4CA}</div><h4>No split data</h4><p>This player has no ' + SEASON + " splits recorded yet.</p></div>";
      return;
    }
    const byCode = {};
    splits.forEach(function(s) {
      if (s.split && s.split.code) byCode[s.split.code] = s;
    });
    const opsValues = splits.map(function(s) {
      return parseFloat(s.stat && s.stat.ops);
    }).filter(function(v) {
      return !isNaN(v);
    });
    const opsMin = opsValues.length ? Math.min.apply(null, opsValues) : 0;
    let opsMax = opsValues.length ? Math.max.apply(null, opsValues) : 1;
    if (opsMax === opsMin) opsMax = opsMin + 1e-3;
    function fmtR(n) {
      const s = n.toFixed(3);
      return s.charAt(0) === "0" ? s.slice(1) : s;
    }
    function row(code) {
      const s = byCode[code];
      if (!s || !s.stat) return "";
      const st = s.stat;
      const avg = parseFloat(st.avg) || 0;
      const obp = parseFloat(st.obp) || 0;
      const slg = parseFloat(st.slg) || 0;
      const ops = parseFloat(st.ops) || 0;
      const pct = (ops - opsMin) / (opsMax - opsMin);
      const w = Math.max(8, Math.min(100, pct * 100));
      const label = SPLIT_LABELS[code] || code;
      const pa = parseInt(st.plateAppearances, 10) || parseInt(st.atBats, 10) || 0;
      return '<div class="split-row"><div class="split-row-head"><span class="split-row-label">' + label + '</span><span class="split-row-line">' + fmtR(avg) + " / " + fmtR(obp) + " / " + fmtR(slg) + '</span></div><div class="split-row-bar"><i style="width:' + w.toFixed(1) + '%"></i></div><div class="split-row-meta"><span>OPS ' + fmtR(ops) + "</span>" + (pa ? "<span>" + pa + " PA</span>" : "") + "</div></div>";
    }
    function section(label, codes) {
      const rows = codes.map(row).filter(Boolean).join("");
      if (!rows) return "";
      return '<div class="splits-section"><div class="splits-section-head">' + label + "</div>" + rows + "</div>";
    }
    const groupHint = group === "pitching" ? '<div class="splits-hint">Slash lines reflect <strong>opponents\u2019</strong> AVG / OBP / SLG against this pitcher.</div>' : "";
    const html = groupHint + '<div class="splits-grid"><div class="splits-col">' + section("vs Handedness", ["vl", "vr"]) + section("Home / Away", ["h", "a"]) + '</div><div class="splits-col">' + section("Situations", ["risp", "e", "r", "lc"]) + "</div></div>";
    panelEl.innerHTML = html;
  }
  var PITCH_ARSENAL_TTL_MS = 24 * 60 * 60 * 1e3;
  var PITCH_COLORS = {
    FF: "#E04848",
    FA: "#E04848",
    SI: "#F08C3C",
    FT: "#F08C3C",
    FC: "#FF6FB5",
    SL: "#F0D03C",
    ST: "#D9B83C",
    CU: "#7060FF",
    KC: "#9078FF",
    CS: "#9078FF",
    CH: "#3CBE64",
    FS: "#3CB4B0",
    SC: "#3CB4B0",
    KN: "#888888",
    EP: "#777777",
    PO: "#666666",
    SV: "#9F7CFF"
  };
  var PITCH_LABELS = {
    FF: "4-Seam",
    FA: "Fastball",
    SI: "Sinker",
    FT: "2-Seam",
    FC: "Cutter",
    SL: "Slider",
    ST: "Sweeper",
    CU: "Curveball",
    KC: "Knuckle-Curve",
    CS: "Slow Curve",
    CH: "Changeup",
    FS: "Splitter",
    SC: "Screwball",
    KN: "Knuckleball",
    EP: "Eephus",
    PO: "Pitchout",
    SV: "Slurve"
  };
  async function fetchPitchArsenal(playerId) {
    if (!playerId) return null;
    const cached = state.pitchArsenalCache[playerId];
    if (cached && Date.now() - cached.ts < PITCH_ARSENAL_TTL_MS) return cached.data;
    try {
      const r = await fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=pitchArsenal&season=" + SEASON);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const splits = d.stats && d.stats[0] && d.stats[0].splits ? d.stats[0].splits : [];
      const arsenal = splits.map(function(s) {
        const st = s.stat || {};
        const t = st.type || {};
        return {
          code: t.code || st.pitchTypeCode || s.split && s.split.code || "",
          type: t.description || st.pitchType || st.description || s.split && s.split.description || "",
          count: parseInt(st.count, 10) || parseInt(st.numP, 10) || 0,
          pct: parseFloat(st.percentage) || parseFloat(st.pitchTypePercentage) || 0,
          velo: parseFloat(st.averageSpeed) || parseFloat(st.averageVelocity) || 0
        };
      }).filter(function(p) {
        return p.pct > 0 || p.count > 0;
      });
      const maxPct = arsenal.reduce(function(m, p) {
        return Math.max(m, p.pct);
      }, 0);
      if (maxPct > 0 && maxPct <= 1.5) {
        arsenal.forEach(function(p) {
          p.pct = p.pct * 100;
        });
      }
      state.pitchArsenalCache[playerId] = { data: arsenal, ts: Date.now() };
      return arsenal;
    } catch (e) {
      return null;
    }
  }
  function renderArsenalTab(playerId) {
    const cached = state.pitchArsenalCache[playerId];
    const panelEl = document.querySelector('.player-tab-panel[data-tab="advanced"]');
    if (!panelEl) return;
    if (!cached) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F3AF}</div><h4>Pitch arsenal</h4><p>Loading pitch arsenal...</p></div>';
      return;
    }
    const arsenal = cached.data.slice();
    if (!arsenal.length) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F3AF}</div><h4>No pitch data</h4><p>No ' + SEASON + " pitch arsenal recorded yet.</p></div>";
      return;
    }
    arsenal.sort(function(a, b) {
      return b.pct - a.pct;
    });
    const total = arsenal.reduce(function(s, p) {
      return s + p.pct;
    }, 0) || 100;
    const size = 140, stroke = 22, r = (size - stroke) / 2, circ = 2 * Math.PI * r;
    let offset = 0;
    const segments = arsenal.map(function(p) {
      const portion = p.pct / total * circ;
      const color = PITCH_COLORS[p.code] || "#888";
      const seg = '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-dasharray="' + portion.toFixed(2) + " " + circ.toFixed(2) + '" stroke-dashoffset="-' + offset.toFixed(2) + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>';
      offset += portion;
      return seg;
    }).join("");
    const top = arsenal[0];
    const topLbl = top ? PITCH_LABELS[top.code] || top.type || top.code || "\u2014" : "\u2014";
    const donut = '<div class="arsenal-donut"><svg viewBox="0 0 ' + size + " " + size + '" width="' + size + '" height="' + size + '">' + segments + '</svg><div class="arsenal-donut-center"><div class="arsenal-donut-pct">' + (top ? top.pct.toFixed(0) : "\u2014") + '%</div><div class="arsenal-donut-lbl">' + topLbl + "</div></div></div>";
    const list = '<div class="arsenal-list">' + arsenal.map(function(p) {
      const color = PITCH_COLORS[p.code] || "#888";
      const label = PITCH_LABELS[p.code] || p.type || p.code || "?";
      const velo = p.velo ? p.velo.toFixed(1) + " mph" : "";
      return '<div class="arsenal-row"><span class="arsenal-dot" style="background:' + color + '"></span><span class="arsenal-row-label">' + label + '</span><span class="arsenal-row-pct">' + p.pct.toFixed(1) + '%</span><span class="arsenal-row-velo">' + velo + "</span></div>";
    }).join("") + "</div>";
    panelEl.innerHTML = '<div class="arsenal-grid">' + donut + list + "</div>";
  }
  var ADV_HITTING_TTL_MS = 24 * 60 * 60 * 1e3;
  async function fetchAdvancedHitting(playerId) {
    if (!playerId) return null;
    const cached = state.advancedHittingCache[playerId];
    if (cached && Date.now() - cached.ts < ADV_HITTING_TTL_MS) return cached.stat;
    try {
      const urls = [
        MLB_BASE + "/people/" + playerId + "/stats?stats=sabermetrics&season=" + SEASON + "&group=hitting",
        MLB_BASE + "/people/" + playerId + "/stats?stats=seasonAdvanced&season=" + SEASON + "&group=hitting"
      ];
      const responses = await Promise.all(urls.map(function(u) {
        return fetch(u).then(function(r) {
          return r.ok ? r.json() : null;
        }).catch(function() {
          return null;
        });
      }));
      const merged = {};
      responses.forEach(function(d) {
        if (!d || !d.stats) return;
        d.stats.forEach(function(block) {
          const split = block.splits && block.splits[0];
          if (split && split.stat) Object.assign(merged, split.stat);
        });
      });
      state.advancedHittingCache[playerId] = { stat: merged, ts: Date.now() };
      return merged;
    } catch (e) {
      return null;
    }
  }
  async function loadAdvancedHittingForTab(playerId) {
    await Promise.all([
      fetchAdvancedHitting(playerId),
      fetchHotColdZones(playerId)
    ]);
    if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === playerId && state.activeStatsTab === "advanced") {
      renderAdvancedHittingTab(playerId);
    }
  }
  function renderAdvancedHittingTab(playerId) {
    const cached = state.advancedHittingCache[playerId];
    const panelEl = document.querySelector('.player-tab-panel[data-tab="advanced"]');
    if (!panelEl) return;
    if (!cached) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4C8}</div><h4>Advanced Metrics</h4><p>Loading advanced metrics\u2026</p></div>';
      return;
    }
    const s = cached.stat || {};
    function num(v) {
      const n = parseFloat(v);
      return isNaN(n) ? null : n;
    }
    function pick() {
      for (let i = 0; i < arguments.length; i++) {
        const v = num(arguments[i]);
        if (v != null) return v;
      }
      return null;
    }
    function fmtR(n) {
      const v = n.toFixed(3);
      return v.charAt(0) === "0" ? v.slice(1) : v;
    }
    function fmtPct(n) {
      return (n > 1.5 ? n.toFixed(1) : (n * 100).toFixed(1)) + "%";
    }
    const woba = pick(s.woba, s.wOba);
    const babip = pick(s.babip);
    const iso = pick(s.iso);
    const wRcPlus = pick(s.wRcPlus, s.wrcPlus);
    const wRaa = pick(s.wRaa, s.wraa);
    const wRc = pick(s.wRc, s.wrc);
    const go_ao = pick(s.groundOutsToAirouts, s.groundOutsToAirOuts);
    const walksPerPa = pick(s.walksPerPlateAppearance);
    const ksPerPa = pick(s.strikeoutsPerPlateAppearance);
    const pitchesPerPa = pick(s.pitchesPerPlateAppearance);
    const atBatsPerHr = pick(s.atBatsPerHomeRun);
    const totalBases = pick(s.totalBases);
    const extraBaseHits = pick(s.extraBaseHits);
    const heroParts = [];
    if (woba != null) heroParts.push({ v: fmtR(woba), l: "wOBA" });
    if (babip != null) heroParts.push({ v: fmtR(babip), l: "BABIP" });
    if (wRcPlus != null) heroParts.push({ v: Math.round(wRcPlus), l: "wRC+" });
    else if (iso != null) heroParts.push({ v: fmtR(iso), l: "ISO" });
    const hero = heroParts.length ? '<div class="adv-hero-row">' + heroParts.map(function(p) {
      return '<div class="stat-box"><div class="stat-val">' + p.v + '</div><div class="stat-lbl">' + p.l + "</div></div>";
    }).join("") + "</div>" : "";
    const rows = [];
    if (wRcPlus != null && iso != null) rows.push({ l: "ISO", v: fmtR(iso) });
    if (wRaa != null) rows.push({ l: "wRAA", v: wRaa.toFixed(1) });
    if (wRc != null) rows.push({ l: "wRC", v: wRc.toFixed(1) });
    if (walksPerPa != null) rows.push({ l: "BB rate", v: fmtPct(walksPerPa) });
    if (ksPerPa != null) rows.push({ l: "K rate", v: fmtPct(ksPerPa) });
    if (pitchesPerPa != null) rows.push({ l: "P / PA", v: pitchesPerPa.toFixed(2) });
    if (atBatsPerHr != null && atBatsPerHr > 0) rows.push({ l: "AB / HR", v: atBatsPerHr.toFixed(1) });
    if (go_ao != null) rows.push({ l: "GO / AO", v: go_ao.toFixed(2) });
    if (extraBaseHits != null) rows.push({ l: "XBH", v: Math.round(extraBaseHits) });
    if (totalBases != null) rows.push({ l: "Total Bases", v: Math.round(totalBases) });
    const grid = rows.length ? '<div class="adv-stat-grid">' + rows.map(function(r) {
      return '<div class="stat-box"><div class="stat-val">' + r.v + '</div><div class="stat-lbl">' + r.l + "</div></div>";
    }).join("") + "</div>" : "";
    if (!hero && !grid) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4C8}</div><h4>No advanced metrics</h4><p>This player has no ' + SEASON + " advanced data yet.</p></div>";
      return;
    }
    const note = '<div class="adv-source-note">Advanced metrics from MLB Stats API \xB7 sabermetrics + seasonAdvanced. Statcast (xBA / xwOBA / exit velo / barrel rate) lives on Baseball Savant and is not proxied here.</div>';
    const heatmap = renderHotZoneSection(playerId);
    panelEl.innerHTML = hero + grid + note + heatmap;
  }
  function renderGameLogPlaceholder() {
    return '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4C5}</div><h4>Last-10 game log</h4><p>Loading game log...</p></div>';
  }
  var HOTCOLD_TTL_MS = 24 * 60 * 60 * 1e3;
  async function fetchHotColdZones(playerId) {
    if (!playerId) return null;
    const cached = state.hotColdCache[playerId];
    if (cached && Date.now() - cached.ts < HOTCOLD_TTL_MS) return cached.data;
    try {
      const r = await fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=hotColdZones&season=" + SEASON + "&group=hitting");
      if (!r.ok) {
        state.hotColdCache[playerId] = { data: [], ts: Date.now() };
        return [];
      }
      const d = await r.json();
      const splits = d.stats && d.stats[0] && d.stats[0].splits || [];
      state.hotColdCache[playerId] = { data: splits, ts: Date.now() };
      return splits;
    } catch (e) {
      state.hotColdCache[playerId] = { data: [], ts: Date.now() };
      return [];
    }
  }
  function pickAvgZoneMatrix(splits) {
    if (!splits || !splits.length) return null;
    let preferred = null;
    for (let i = 0; i < splits.length; i++) {
      const s = splits[i].stat;
      if (!s || !s.zones) continue;
      const name = (s.name || "").toLowerCase();
      if (name.indexOf("batting") >= 0 || name.indexOf("avg") >= 0) {
        preferred = s;
        break;
      }
      if (!preferred) preferred = s;
    }
    return preferred;
  }
  function avgHeatColor(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return "rgba(255,255,255,.05)";
    const t = Math.max(0, Math.min(1, (n - 0.15) / (0.38 - 0.15)));
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = Math.round(224 + (240 - 224) * u);
      g = Math.round(72 + (208 - 72) * u);
      b = Math.round(72 + (60 - 72) * u);
    } else {
      const u2 = (t - 0.5) / 0.5;
      r = Math.round(240 + (60 - 240) * u2);
      g = Math.round(208 + (190 - 208) * u2);
      b = Math.round(60 + (100 - 60) * u2);
    }
    return "rgba(" + r + "," + g + "," + b + ",.55)";
  }
  function renderHotZoneSection(playerId) {
    const cached = state.hotColdCache[playerId];
    if (!cached || !cached.data || !cached.data.length) return "";
    const matrix = pickAvgZoneMatrix(cached.data);
    if (!matrix || !matrix.zones) return "";
    const byZone = {};
    matrix.zones.forEach(function(z) {
      if (z && z.zone) byZone[String(z.zone).replace(/^0/, "")] = z;
    });
    function fmtR(v) {
      const n = parseFloat(v);
      if (isNaN(n)) return "\u2014";
      const s = n.toFixed(3);
      return s.charAt(0) === "0" ? s.slice(1) : s;
    }
    let cells = "";
    for (let i = 1; i <= 9; i++) {
      const z = byZone[String(i)];
      const v = z && (z.value != null ? z.value : null);
      const bg = z ? avgHeatColor(v) : "rgba(255,255,255,.04)";
      cells += '<div class="hotzone-cell" style="background:' + bg + '"><div class="hotzone-val">' + (z ? fmtR(v) : "\u2014") + "</div></div>";
    }
    const label = matrix.name || "Batting Avg";
    return '<div class="hotzone-section"><div class="hotzone-section-head">\u{1F3AF} Strike Zone Heat Map \xB7 ' + label + '</div><div class="hotzone-frame"><div class="hotzone-axis-top">High</div><div class="hotzone-axis-left">Inside</div><div class="hotzone-grid">' + cells + '</div><div class="hotzone-axis-right">Outside</div><div class="hotzone-axis-bot">Low</div></div><div class="hotzone-legend"><span class="hotzone-legend-bar"></span><span class="hotzone-legend-label">cold .150</span><span class="hotzone-legend-spacer"></span><span class="hotzone-legend-label">.380 hot</span></div><div class="hotzone-foot">View from catcher \xB7 inside / outside relative to RHB. Statcast spray-chart coordinates require Baseball Savant and aren\u2019t proxied here.</div></div>';
  }
  var CAREER_TTL_MS = 24 * 60 * 60 * 1e3;
  async function ensureCareerLoaded(playerId, group) {
    if (!playerId) return;
    const cached = state.careerCache[playerId];
    if (cached && Date.now() - cached.ts < CAREER_TTL_MS) {
      renderCareerTab(playerId, group);
      return;
    }
    const careerUrl = MLB_BASE + "/people/" + playerId + "/stats?stats=yearByYear&group=hitting,pitching";
    try {
      const cR = await fetch(careerUrl).then(function(r) {
        return r.ok ? r.json() : null;
      }).catch(function() {
        return null;
      });
      const hitting = [], pitching = [];
      if (cR && cR.stats) {
        cR.stats.forEach(function(block) {
          const g = block.group && block.group.displayName;
          (block.splits || []).forEach(function(sp) {
            if (!sp.team) return;
            const row = {
              season: sp.season,
              teamId: sp.team && sp.team.id,
              teamAbbr: sp.team && (sp.team.abbreviation || sp.team.name),
              stat: sp.stat || {}
            };
            if (g === "hitting") hitting.push(row);
            else if (g === "pitching") pitching.push(row);
          });
        });
      }
      state.careerCache[playerId] = { hitting, pitching, ts: Date.now() };
    } catch (e) {
      state.careerCache[playerId] = { hitting: [], pitching: [], ts: Date.now() };
    }
    if (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === playerId && state.activeStatsTab === "career") {
      renderCareerTab(playerId, group);
    }
  }
  function renderCareerPlaceholder() {
    return '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F5C2}\uFE0F</div><h4>Career history</h4><p>Loading year-by-year stats\u2026</p></div>';
  }
  function renderCareerTab(playerId, group) {
    const panelEl = document.querySelector('.player-tab-panel[data-tab="career"]');
    if (!panelEl) return;
    const career = state.careerCache[playerId];
    if (!career) {
      panelEl.innerHTML = renderCareerPlaceholder();
      return;
    }
    const hittingRows = (career.hitting || []).slice();
    const pitchingRows = (career.pitching || []).slice();
    hittingRows.sort(function(a, b) {
      return parseInt(a.season, 10) - parseInt(b.season, 10);
    });
    pitchingRows.sort(function(a, b) {
      return parseInt(a.season, 10) - parseInt(b.season, 10);
    });
    if (!hittingRows.length && !pitchingRows.length) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F5C2}\uFE0F</div><h4>No career data</h4><p>This player has no recorded MLB seasons yet.</p></div>';
      return;
    }
    function fmtR(v) {
      if (v == null || v === "") return "\u2014";
      const n = parseFloat(v);
      if (isNaN(n)) return String(v);
      const s = n.toFixed(3);
      return s.charAt(0) === "0" ? s.slice(1) : s;
    }
    function fmtN(v, d) {
      if (v == null || v === "") return "\u2014";
      const n = parseFloat(v);
      if (isNaN(n)) return String(v);
      return n.toFixed(d == null ? 0 : d);
    }
    function fmtIp(v) {
      if (v == null || v === "") return "\u2014";
      return String(v);
    }
    function intOr(v) {
      if (v == null || v === "") return "\u2014";
      const n = parseInt(v, 10);
      return isNaN(n) ? String(v) : String(n);
    }
    function tableFor(rows, kind) {
      if (!rows.length) return "";
      let cols, headerHtml;
      if (kind === "hitting") {
        cols = [
          ["season", "Year", function(r) {
            return r.season;
          }],
          ["team", "Team", function(r) {
            return r.teamAbbr || "";
          }],
          ["g", "G", function(r) {
            return intOr(r.stat.gamesPlayed);
          }],
          ["pa", "PA", function(r) {
            return intOr(r.stat.plateAppearances);
          }],
          ["avg", "AVG", function(r) {
            return fmtR(r.stat.avg);
          }],
          ["hr", "HR", function(r) {
            return intOr(r.stat.homeRuns);
          }],
          ["rbi", "RBI", function(r) {
            return intOr(r.stat.rbi);
          }],
          ["sb", "SB", function(r) {
            return intOr(r.stat.stolenBases);
          }],
          ["obp", "OBP", function(r) {
            return fmtR(r.stat.obp);
          }],
          ["slg", "SLG", function(r) {
            return fmtR(r.stat.slg);
          }],
          ["ops", "OPS", function(r) {
            return fmtR(r.stat.ops);
          }]
        ];
      } else {
        cols = [
          ["season", "Year", function(r) {
            return r.season;
          }],
          ["team", "Team", function(r) {
            return r.teamAbbr || "";
          }],
          ["g", "G", function(r) {
            return intOr(r.stat.gamesPlayed);
          }],
          ["ip", "IP", function(r) {
            return fmtIp(r.stat.inningsPitched);
          }],
          ["w", "W", function(r) {
            return intOr(r.stat.wins);
          }],
          ["l", "L", function(r) {
            return intOr(r.stat.losses);
          }],
          ["era", "ERA", function(r) {
            return fmtN(r.stat.era, 2);
          }],
          ["whip", "WHIP", function(r) {
            return fmtN(r.stat.whip, 2);
          }],
          ["k", "K", function(r) {
            return intOr(r.stat.strikeOuts);
          }],
          ["bb", "BB", function(r) {
            return intOr(r.stat.baseOnBalls);
          }],
          ["sv", "SV", function(r) {
            return intOr(r.stat.saves);
          }]
        ];
      }
      headerHtml = "<tr>" + cols.map(function(c) {
        return "<th>" + c[1] + "</th>";
      }).join("") + "</tr>";
      const bodyHtml = rows.map(function(r) {
        return "<tr>" + cols.map(function(c) {
          return '<td class="career-col-' + c[0] + '">' + c[2](r) + "</td>";
        }).join("") + "</tr>";
      }).join("");
      const titleEm = kind === "hitting" ? "\u26BE Hitting" : "\u{1F94E} Pitching";
      return '<div class="career-section"><div class="career-section-head">' + titleEm + " \xB7 " + rows.length + " season" + (rows.length === 1 ? "" : "s") + '</div><div class="career-table-wrap"><table class="career-table"><thead>' + headerHtml + "</thead><tbody>" + bodyHtml + "</tbody></table></div></div>";
    }
    const primary = group === "pitching" ? "pitching" : "hitting";
    const secondary = primary === "hitching" ? "pitching" : primary === "pitching" ? "hitting" : "pitching";
    let tablesHtml = "";
    if (primary === "pitching") {
      tablesHtml = tableFor(pitchingRows, "pitching") + tableFor(hittingRows, "hitting");
    } else {
      tablesHtml = tableFor(hittingRows, "hitting") + tableFor(pitchingRows, "pitching");
    }
    const isMobile = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width: 480px)").matches;
    const hintHtml = isMobile && !state.careerSwipeHintShown ? '<div class="career-swipe-hint" id="careerSwipeHint"><span>\u2190 Swipe to see more \u2192</span><button type="button" aria-label="Dismiss" onclick="dismissCareerSwipeHint()">\u2715</button></div>' : "";
    panelEl.innerHTML = hintHtml + tablesHtml;
    Array.prototype.forEach.call(panelEl.querySelectorAll(".career-table-wrap"), function(w) {
      const update = function() {
        const atEnd = w.scrollLeft + w.clientWidth >= w.scrollWidth - 2;
        w.classList.toggle("scrolled-end", atEnd);
      };
      w.addEventListener("scroll", update, { passive: true });
      update();
    });
  }
  function dismissCareerSwipeHint() {
    state.careerSwipeHintShown = true;
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem("mlb_stats_career_hint_shown", "1");
    } catch (_) {
    }
    const el = document.getElementById("careerSwipeHint");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  var _statsQuickNavInstalled = false;
  function installStatsQuickNav() {
    if (_statsQuickNavInstalled) return;
    const nav = document.getElementById("statsQuickNav");
    if (!nav) return;
    _statsQuickNavInstalled = true;
    nav.addEventListener("click", function(e) {
      const btn = e.target && e.target.closest && e.target.closest("button[data-target]");
      if (!btn) return;
      const tgt = document.getElementById(btn.dataset.target);
      if (!tgt) return;
      const headerH = nav.getBoundingClientRect().bottom;
      const top = tgt.getBoundingClientRect().top + window.pageYOffset - headerH - 8;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
    if (typeof IntersectionObserver === "undefined") return;
    const ids = Array.prototype.map.call(nav.querySelectorAll("button[data-target]"), function(b) {
      return b.dataset.target;
    });
    const targets = ids.map(function(id) {
      return document.getElementById(id);
    }).filter(Boolean);
    if (!targets.length) return;
    const io = new IntersectionObserver(function(entries) {
      entries.forEach(function(en) {
        if (!en.isIntersecting) return;
        const id = en.target.id;
        Array.prototype.forEach.call(nav.querySelectorAll("button[data-target]"), function(b) {
          b.classList.toggle("active", b.dataset.target === id);
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });
    targets.forEach(function(t) {
      io.observe(t);
    });
  }
  var GAMELOG_TTL_MS = 24 * 60 * 60 * 1e3;
  async function fetchGameLog(playerId, group) {
    if (!playerId) return null;
    if (group === "fielding") group = "hitting";
    const cacheKey = playerId + ":" + group;
    const existing = state.gameLogCache[cacheKey];
    if (existing && Date.now() - existing.ts < GAMELOG_TTL_MS) return existing.games;
    try {
      const r = await fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=gameLog&season=" + SEASON + "&group=" + group);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const games = d.stats && d.stats[0] && d.stats[0].splits ? d.stats[0].splits : [];
      state.gameLogCache[cacheKey] = { games, ts: Date.now() };
      return games;
    } catch (e) {
      return null;
    }
  }
  function renderGameLogTab(playerId, group) {
    if (group === "fielding") group = "hitting";
    const cacheKey = playerId + ":" + group;
    const cached = state.gameLogCache[cacheKey];
    const panelEl = document.querySelector('.player-tab-panel[data-tab="gamelog"]');
    if (!panelEl) return;
    if (!cached || !cached.games) {
      panelEl.innerHTML = renderGameLogPlaceholder();
      return;
    }
    const games = cached.games.slice().reverse().slice(0, 10);
    if (!games.length) {
      panelEl.innerHTML = '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4C5}</div><h4>No games yet</h4><p>This player has no ' + SEASON + " game log entries.</p></div>";
      return;
    }
    const sum = { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, hbp: 0, sf: 0, tb: 0, ip: 0, er: 0, k: 0, bbA: 0, hA: 0 };
    games.forEach(function(g) {
      const st = g.stat || {};
      if (group === "hitting") {
        sum.ab += parseInt(st.atBats, 10) || 0;
        sum.h += parseInt(st.hits, 10) || 0;
        sum.hr += parseInt(st.homeRuns, 10) || 0;
        sum.rbi += parseInt(st.rbi, 10) || 0;
        sum.bb += parseInt(st.baseOnBalls, 10) || 0;
        sum.hbp += parseInt(st.hitByPitch, 10) || 0;
        sum.sf += parseInt(st.sacFlies, 10) || 0;
        sum.tb += parseInt(st.totalBases, 10) || 0;
      } else {
        sum.ip += parseFloat(st.inningsPitched) || 0;
        sum.er += parseInt(st.earnedRuns, 10) || 0;
        sum.k += parseInt(st.strikeOuts, 10) || 0;
        sum.bbA += parseInt(st.baseOnBalls, 10) || 0;
        sum.hA += parseInt(st.hits, 10) || 0;
      }
    });
    let summaryHtml = "";
    if (group === "hitting") {
      const avg = sum.ab > 0 ? sum.h / sum.ab : 0;
      const pa = sum.ab + sum.bb + sum.hbp + sum.sf;
      const obp = pa > 0 ? (sum.h + sum.bb + sum.hbp) / pa : 0;
      const slg = sum.ab > 0 ? sum.tb / sum.ab : 0;
      const fmtR = function(n) {
        const s = n.toFixed(3);
        return s.charAt(0) === "0" ? s.slice(1) : s;
      };
      summaryHtml = '<div class="gamelog-summary"><div class="stat-box"><div class="stat-val">' + fmtR(avg) + '</div><div class="stat-lbl">L10 AVG</div></div><div class="stat-box"><div class="stat-val">' + sum.hr + '</div><div class="stat-lbl">L10 HR</div></div><div class="stat-box"><div class="stat-val">' + sum.rbi + '</div><div class="stat-lbl">L10 RBI</div></div><div class="stat-box"><div class="stat-val">' + fmtR(obp + slg) + '</div><div class="stat-lbl">L10 OPS</div></div></div>';
    } else {
      const era = sum.ip > 0 ? sum.er * 9 / sum.ip : 0;
      const whip = sum.ip > 0 ? (sum.bbA + sum.hA) / sum.ip : 0;
      summaryHtml = '<div class="gamelog-summary"><div class="stat-box"><div class="stat-val">' + era.toFixed(2) + '</div><div class="stat-lbl">L10 ERA</div></div><div class="stat-box"><div class="stat-val">' + sum.k + '</div><div class="stat-lbl">L10 K</div></div><div class="stat-box"><div class="stat-val">' + whip.toFixed(2) + '</div><div class="stat-lbl">L10 WHIP</div></div><div class="stat-box"><div class="stat-val">' + sum.ip.toFixed(1) + '</div><div class="stat-lbl">L10 IP</div></div></div>';
    }
    let html = '<div class="gamelog-strip">';
    games.forEach(function(g) {
      const st = g.stat || {};
      const d = g.date ? /* @__PURE__ */ new Date(g.date + "T12:00:00Z") : null;
      const dateLabel = d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
      const oppId = g.opponent && g.opponent.id;
      const oppD = oppId ? tcLookup(oppId) : { abbr: "?", primary: "#444" };
      const atVs = g.isHome === true ? "vs" : g.isHome === false ? "@" : "";
      const oppLabel = atVs + " " + (oppD.abbr || "?");
      let resultCls = "";
      if (typeof g.gameResult === "string") {
        if (g.gameResult.charAt(0) === "W") resultCls = " win";
        else if (g.gameResult.charAt(0) === "L") resultCls = " loss";
      }
      const hr = parseInt(st.homeRuns, 10) || 0;
      const hrCls = hr > 0 ? " hr" : "";
      let lineLabel = "";
      if (group === "hitting") {
        const ab = parseInt(st.atBats, 10) || 0;
        const h = parseInt(st.hits, 10) || 0;
        lineLabel = h + "/" + ab + (hr > 0 ? " \xB7 " + (hr > 1 ? hr + "HR" : "HR") : "");
      } else {
        const ip = parseFloat(st.inningsPitched) || 0;
        const k = parseInt(st.strikeOuts, 10) || 0;
        const er = parseInt(st.earnedRuns, 10) || 0;
        lineLabel = ip.toFixed(1) + "IP \xB7 " + k + "K \xB7 " + er + "ER";
      }
      const clickAttr = g.game && g.game.gamePk ? ' onclick="showLiveGame(' + g.game.gamePk + ')"' : "";
      html += '<div class="glog-item' + resultCls + hrCls + '"' + clickAttr + '><div class="glog-d">' + dateLabel + '</div><div class="glog-o">' + oppLabel + '</div><div class="glog-s">' + lineLabel + "</div></div>";
    });
    html += "</div>";
    panelEl.innerHTML = html + summaryHtml;
  }
  function computeRollingSeries(games, group, heroKey, windowSize) {
    if (!games || !games.length) return null;
    windowSize = windowSize || 7;
    const ordered = games.slice().reverse();
    const out = [];
    if (group === "hitting") {
      const window2 = [];
      let sumAB = 0, sumH = 0, sumPA = 0, sumOBP_n = 0, sumTB = 0;
      for (let i = 0; i < ordered.length; i++) {
        const st = ordered[i].stat || {};
        const ab = parseInt(st.atBats, 10) || 0;
        const h = parseInt(st.hits, 10) || 0;
        const pa = parseInt(st.plateAppearances, 10) || ab + (parseInt(st.baseOnBalls, 10) || 0) + (parseInt(st.hitByPitch, 10) || 0) + (parseInt(st.sacFlies, 10) || 0);
        const bbHbp = (parseInt(st.baseOnBalls, 10) || 0) + (parseInt(st.hitByPitch, 10) || 0);
        const tb = parseInt(st.totalBases, 10) || 0;
        window2.push({ ab, h, pa, bbHbp, tb });
        sumAB += ab;
        sumH += h;
        sumPA += pa;
        sumOBP_n += h + bbHbp;
        sumTB += tb;
        if (window2.length > windowSize) {
          const drop = window2.shift();
          sumAB -= drop.ab;
          sumH -= drop.h;
          sumPA -= drop.pa;
          sumOBP_n -= drop.h + drop.bbHbp;
          sumTB -= drop.tb;
        }
        if (window2.length >= 2) {
          const avg = sumAB > 0 ? sumH / sumAB : 0;
          const obp = sumPA > 0 ? sumOBP_n / sumPA : 0;
          const slg = sumAB > 0 ? sumTB / sumAB : 0;
          const y = heroKey === "ops" ? obp + slg : avg;
          out.push({ x: i, y });
        }
      }
    } else {
      const w = [];
      let sumIP = 0, sumER = 0;
      for (let j = 0; j < ordered.length; j++) {
        const ps = ordered[j].stat || {};
        const ip = parseFloat(ps.inningsPitched) || 0;
        const er = parseInt(ps.earnedRuns, 10) || 0;
        w.push({ ip, er });
        sumIP += ip;
        sumER += er;
        if (w.length > windowSize) {
          const dr = w.shift();
          sumIP -= dr.ip;
          sumER -= dr.er;
        }
        if (w.length >= 2) {
          const era = sumIP > 0 ? sumER * 9 / sumIP : 0;
          out.push({ x: j, y: era });
        }
      }
    }
    return out.length ? out : null;
  }
  function renderSparklineSVG(series, opts) {
    if (!series || series.length < 2) return "";
    opts = opts || {};
    const w = opts.width || 320;
    const h = opts.height || 56;
    const lowerIsBetter = !!opts.lowerIsBetter;
    const ys = series.map(function(p) {
      return p.y;
    });
    const ymin = Math.min.apply(null, ys);
    let ymax = Math.max.apply(null, ys);
    if (ymax === ymin) {
      ymax = ymin + 1e-3;
    }
    const pad = 4;
    const step = (w - pad * 2) / Math.max(1, series.length - 1);
    function plotY(y) {
      const t = (y - ymin) / (ymax - ymin);
      return lowerIsBetter ? pad + t * (h - pad * 2) : h - pad - t * (h - pad * 2);
    }
    const pts = series.map(function(p, idx) {
      return [pad + idx * step, plotY(p.y)];
    });
    const d = pts.map(function(pt, i) {
      return (i === 0 ? "M" : "L") + pt[0].toFixed(1) + "," + pt[1].toFixed(1);
    }).join(" ");
    const area = d + " L" + pts[pts.length - 1][0].toFixed(1) + "," + h + " L" + pts[0][0].toFixed(1) + "," + h + " Z";
    const last = pts[pts.length - 1];
    const first = ys[0];
    const lastY = ys[ys.length - 1];
    const diff = lowerIsBetter ? first - lastY : lastY - first;
    const trendCls = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const trendArrow = trendCls === "up" ? "\u25B2" : trendCls === "down" ? "\u25BC" : "\u25AC";
    const dec = opts.decimals == null ? 3 : opts.decimals;
    let absStr = Math.abs(diff).toFixed(dec);
    if (dec >= 3 && absStr.charAt(0) === "0") absStr = absStr.slice(1);
    const sign = diff > 0 ? "+" : diff < 0 ? "\u2212" : "";
    const diffStr = sign + absStr;
    return '<svg class="hero-spark" viewBox="0 0 ' + w + " " + h + '" preserveAspectRatio="none" width="100%" height="' + h + '"><defs><linearGradient id="spk-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".4"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs><path class="hero-spark-area" d="' + area + '" fill="url(#spk-grad)"/><path class="hero-spark-line" d="' + d + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="3.5" fill="#fff" stroke="currentColor" stroke-width="2"/></svg><div class="hero-spark-meta"><span>' + series.length + 'g rolling</span><span class="hero-spark-trend ' + trendCls + '">' + trendArrow + " " + diffStr + "</span></div>";
  }
  function onGameLogResolved(playerId, group) {
    if (!state.selectedPlayer || !state.selectedPlayer.person) return;
    if (state.selectedPlayer.person.id !== playerId) return;
    if (group === "fielding") group = "hitting";
    const stat = state.selectedPlayerStat && state.selectedPlayerStat.stat;
    if (stat && state.selectedPlayerStat.group !== "fielding") {
      const ovEl = document.querySelector('.player-tab-panel[data-tab="overview"]');
      if (ovEl) ovEl.innerHTML = renderOverviewTab(stat, state.selectedPlayerStat.group);
    }
    renderGameLogTab(playerId, group);
  }
  function renderAdvancedPlaceholder(group) {
    if (group === "hitting") {
      return '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F4C8}</div><h4>Statcast / Advanced</h4><p>Loading advanced metrics\u2026</p></div>';
    }
    if (group === "pitching") {
      return '<div class="tab-empty-state"><div class="tab-empty-icon">\u{1F3AF}</div><h4>Pitch arsenal</h4><p>Loading pitch arsenal...</p></div>';
    }
    return '<div class="tab-empty-state"><div class="tab-empty-icon">\u26BE</div><h4>Advanced</h4><p>Not available for fielding view.</p></div>';
  }
  function renderOverviewTab(s, group) {
    const pid = state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id;
    const jerseyOverlay = state.selectedPlayer && state.selectedPlayer.jerseyNumber ? '<div class="headshot-jersey-pill">#' + state.selectedPlayer.jerseyNumber + "</div>" : "";
    let html = pid ? '<div class="headshot-frame"><img src="https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/' + pid + '/headshot/67/current">' + jerseyOverlay + "</div>" : "";
    const playerQualified = group === "fielding" ? true : isQualified(group, s);
    function shouldShowRank(entry) {
      if (!entry) return true;
      if (entry.lowerIsBetter && entry.decimals < 2) return false;
      if (!entry.lowerIsBetter && entry.decimals < 2) return true;
      return playerQualified;
    }
    let boxes = [];
    if (group === "hitting") boxes = [
      { v: fmtRate(s.avg), l: "AVG", k: "avg", raw: s.avg },
      { v: s.homeRuns, l: "HR", k: "homeRuns", raw: s.homeRuns },
      { v: s.rbi, l: "RBI", k: "rbi", raw: s.rbi },
      { v: fmtRate(s.ops), l: "OPS", k: "ops", raw: s.ops },
      { v: s.hits, l: "H", k: "hits", raw: s.hits },
      { v: s.doubles, l: "2B", k: "doubles", raw: s.doubles },
      { v: s.triples, l: "3B", k: "triples", raw: s.triples },
      { v: s.strikeOuts, l: "K", k: "strikeOuts", raw: s.strikeOuts },
      { v: s.baseOnBalls, l: "BB", k: "baseOnBalls", raw: s.baseOnBalls },
      { v: s.runs, l: "R", k: "runs", raw: s.runs },
      { v: s.stolenBases, l: "SB", k: "stolenBases", raw: s.stolenBases },
      { v: s.plateAppearances, l: "PA", k: null, raw: null }
    ];
    else if (group === "pitching") boxes = [
      { v: fmt(s.era, 2), l: "ERA", k: "era", raw: s.era },
      { v: fmt(s.whip, 2), l: "WHIP", k: "whip", raw: s.whip },
      { v: s.strikeOuts, l: "K", k: "strikeOuts", raw: s.strikeOuts },
      { v: s.wins + "-" + s.losses, l: "W-L", k: null, raw: null },
      { v: fmt(s.inningsPitched, 1), l: "IP", k: null, raw: null },
      { v: s.hits, l: "H", k: "hits", raw: s.hits },
      { v: s.baseOnBalls, l: "BB", k: "baseOnBalls", raw: s.baseOnBalls },
      { v: s.homeRuns, l: "HR", k: "homeRuns", raw: s.homeRuns },
      { v: fmt(s.strikeoutWalkRatio, 2), l: "K/BB", k: "strikeoutWalkRatio", raw: s.strikeoutWalkRatio },
      { v: fmt(s.strikeoutsPer9Inn, 2), l: "K/9", k: "strikeoutsPer9Inn", raw: s.strikeoutsPer9Inn },
      { v: fmt(s.walksPer9Inn, 2), l: "BB/9", k: "walksPer9Inn", raw: s.walksPer9Inn },
      { v: s.saves, l: "SV", k: "saves", raw: s.saves }
    ];
    else boxes = [
      { v: fmtRate(s.fielding), l: "FPCT", k: null, raw: null },
      { v: s.putOuts, l: "PO", k: null, raw: null },
      { v: s.assists, l: "A", k: null, raw: null },
      { v: s.errors, l: "E", k: null, raw: null },
      { v: s.chances, l: "TC", k: null, raw: null },
      { v: s.doublePlays, l: "DP", k: null, raw: null }
    ];
    const cols = group === "fielding" ? 3 : 4;
    const basis = state.vsLeagueBasis || "mlb";
    if (group !== "fielding") {
      html += '<div class="vs-basis-row"><span class="vs-basis-label">Compare</span>' + ["mlb", "team"].map(function(bv) {
        return '<button type="button" class="vs-basis-pill' + (basis === bv ? " active" : "") + `" onclick="switchVsBasis('` + bv + `')">VS ` + (bv === "mlb" ? "MLB" : "TEAM") + "</button>";
      }).join("") + "</div>";
    }
    if (group !== "fielding" && boxes.length) {
      const hb = boxes[0];
      const hEntry = hb.k ? leaderEntry(group, hb.k) : null;
      const hShowRank = shouldShowRank(hEntry);
      const hPInfo = hb.k && hShowRank ? computePercentile(group, hb.k, hb.raw) : null;
      const hTier = hPInfo ? tierFromPercentile(hPInfo.percentile) : null;
      const hDir = hEntry && hEntry.lowerIsBetter ? "lower-better" : "higher-better";
      const hDec = hEntry ? hEntry.decimals : 0;
      const hBasisVal = hb.k ? basis === "mlb" ? leagueAverage(group, hb.k) : teamAverage(group, hb.k) : null;
      const hChip = hb.k ? avgChip(hb.raw, hBasisVal, hDec, hEntry && hEntry.lowerIsBetter) : "";
      const heroLabelMap = { AVG: "Batting Average", OPS: "On-Base + Slugging", ERA: "Earned Run Average", WHIP: "Walks + Hits / IP" };
      const heroLabel = heroLabelMap[hb.l] || hb.l;
      const heroMeta = SEASON + " " + (group.charAt(0).toUpperCase() + group.slice(1));
      let tierPill = "";
      if (hTier === "elite" && hPInfo) {
        tierPill = '<span class="hero-tier-pill">\u2605 Elite</span>';
      }
      let heroSparkHtml = "";
      const glogKey = (state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id) + ":" + group;
      const glogCached = state.gameLogCache[glogKey];
      if (glogCached && glogCached.games && glogCached.games.length) {
        const rollingKey = group === "hitting" ? hb.l === "OPS" ? "ops" : "avg" : "era";
        const series = computeRollingSeries(glogCached.games, group, rollingKey, 7);
        if (series && series.length >= 2) {
          const sparkClass = hTier ? "hero-spark-wrap hero-spark-wrap--" + hTier : "hero-spark-wrap";
          heroSparkHtml = '<div class="' + sparkClass + '">' + renderSparklineSVG(series, { lowerIsBetter: !!(hEntry && hEntry.lowerIsBetter), decimals: hDec }) + "</div>";
        }
      }
      if (!heroSparkHtml) {
        heroSparkHtml = '<div class="hero-panel-trend"><span class="hero-trend-pending">trend loading\u2026</span></div>';
      }
      let hRankHtml = "";
      let hBarHtml = "";
      if (hPInfo && !hPInfo.outsideTop) {
        hRankHtml = '<div class="hero-panel-rank">#' + hPInfo.rank + " of " + hPInfo.total + " Qualified Players</div>";
        hBarHtml = '<div class="hero-panel-bar">' + pctBar(hPInfo.percentile) + "</div>";
      }
      html += '<div class="hero-panel' + (hTier ? " hero-panel--" + hTier : "") + '"><div class="hero-panel-stat"><div class="hero-panel-meta">' + heroMeta + '</div><div class="hero-panel-val">' + (hb.v != null ? hb.v : "\u2014") + '</div><div class="hero-panel-lbl">' + heroLabel + "</div>" + (hChip || tierPill ? '<div class="hero-panel-deltas">' + hChip + tierPill + "</div>" : "") + '</div><div class="hero-panel-context">' + hRankHtml + hBarHtml + (!hPInfo && hEntry && !hShowRank ? '<div class="hero-panel-unq" title="Below MLB qualification threshold (PA \u2265 3.1\xD7G hitters, IP \u2265 1\xD7G pitchers). Rank suppressed for rate stats.">Below qualification \xB7 rank not shown</div>' : "") + heroSparkHtml + "</div></div>";
      boxes = boxes.slice(1);
    }
    html += '<div class="stat-grid stat-grid--cols-' + cols + '">';
    boxes.forEach(function(b) {
      const bEntry = b.k ? leaderEntry(group, b.k) : null;
      const bShowRank = shouldShowRank(bEntry);
      const pInfo = b.k && group !== "fielding" && bShowRank ? computePercentile(group, b.k, b.raw) : null;
      const tier = pInfo ? tierFromPercentile(pInfo.percentile) : null;
      const tierCls = tier && !pInfo.outsideTop && (pInfo.percentile >= 90 || pInfo.percentile <= 10) ? " stat-box--" + tier : "";
      let chip = "";
      if (b.k && group !== "fielding") {
        const entry = leaderEntry(group, b.k);
        const dec = entry ? entry.decimals : 0;
        const basisVal = basis === "mlb" ? leagueAverage(group, b.k) : teamAverage(group, b.k);
        chip = avgChip(b.raw, basisVal, dec, entry && entry.lowerIsBetter);
      }
      let boxRankHtml = "";
      if (pInfo && !pInfo.outsideTop) {
        boxRankHtml = pctBar(pInfo.percentile) + rankCaption(pInfo.rank, pInfo.total);
      }
      html += '<div class="stat-box' + tierCls + '"><div class="stat-val">' + (b.v != null ? b.v : "\u2014") + '</div><div class="stat-lbl">' + b.l + "</div>" + boxRankHtml + chip + "</div>";
    });
    return html + "</div>";
  }
  function switchVsBasis(basis) {
    if (basis !== "mlb" && basis !== "team") return;
    state.vsLeagueBasis = basis;
    if (typeof localStorage !== "undefined") localStorage.setItem("mlb_stats_vs_basis", basis);
    const sel = state.selectedPlayer;
    if (!sel || !sel.person) return;
    const group = state.currentRosterTab === "fielding" ? "fielding" : state.currentRosterTab;
    if (group === "fielding") return;
    const pool = state.statsCache[group] || [];
    const entry = pool.find(function(p) {
      return p.player && p.player.id === sel.person.id;
    });
    if (entry && entry.stat) renderPlayerStats(entry.stat, group);
  }

  // src/sections/stats/roster.js
  async function fetchAllPlayerStats() {
    const groups = ["hitting", "pitching"];
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi], players = group === "hitting" ? state.rosterData.hitting : state.rosterData.pitching;
      if (!players.length) continue;
      const results = await Promise.all(players.map(async function(p) {
        try {
          const r = await fetch(MLB_BASE + "/people/" + p.person.id + "/stats?stats=season&season=" + SEASON + "&group=" + group);
          const d = await r.json();
          const stat = d.stats && d.stats[0] && d.stats[0].splits && d.stats[0].splits[0] && d.stats[0].splits[0].stat;
          if (!stat) return null;
          return { player: p.person, position: p.position, stat };
        } catch (e) {
          return null;
        }
      }));
      state.statsCache[group] = results.filter(function(x) {
        return x !== null;
      });
    }
    loadLeaders();
    fetchLastNForRoster();
  }
  async function fetchLastN(playerId, n) {
    n = n || 15;
    const existing = state.lastNCache[playerId];
    if (existing && Date.now() - existing.ts < HOT_COLD_TTL_MS) return existing;
    try {
      const responses = await Promise.all([
        fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=lastXGames&group=hitting&season=" + SEASON + "&gameNumber=10"),
        fetch(MLB_BASE + "/people/" + playerId + "/stats?stats=lastXGames&group=hitting&season=" + SEASON + "&gameNumber=15")
      ]);
      const d10 = await responses[0].json();
      const d15 = await responses[1].json();
      const stat10 = d10.stats && d10.stats[0] && d10.stats[0].splits && d10.stats[0].splits[0] && d10.stats[0].splits[0].stat;
      const stat15 = d15.stats && d15.stats[0] && d15.stats[0].splits && d15.stats[0].splits[0] && d15.stats[0].splits[0].stat;
      if (stat10 && stat15) {
        state.lastNCache[playerId] = { last10: stat10, last15: stat15, ts: Date.now() };
        return state.lastNCache[playerId];
      }
    } catch (e) {
    }
    return null;
  }
  async function fetchLastNForRoster() {
    const hitters = state.rosterData.hitting || [];
    if (!hitters.length) return;
    await Promise.all(hitters.map(function(p) {
      return fetchLastN(p.person.id);
    }));
    if (state.currentLeaderTab === "hitting") loadLeaders();
    if (state.currentRosterTab === "hitting") renderPlayerList();
  }
  async function loadRoster() {
    document.getElementById("playerList").innerHTML = '<div class="loading">Loading players...</div>';
    document.getElementById("rosterTitle").textContent = SEASON + " " + state.activeTeam.short + " Players";
    try {
      const r = await fetch(MLB_BASE + "/teams/" + state.activeTeam.id + "/roster?rosterType=40Man&season=" + SEASON + "&hydrate=person");
      const d = await r.json(), roster = d.roster || [];
      state.rosterData.hitting = roster.filter(function(p) {
        return p.position && p.position.abbreviation !== "P";
      });
      state.rosterData.pitching = roster.filter(function(p) {
        return p.position && (p.position.abbreviation === "P" || p.position.abbreviation === "TWP");
      });
      state.rosterData.fielding = state.rosterData.hitting.slice();
      renderPlayerList();
      fetchAllPlayerStats();
      if (state.rosterData.hitting.length) selectPlayer(state.rosterData.hitting[0].person.id, "hitting");
    } catch (e) {
      document.getElementById("playerList").innerHTML = '<div class="error">Could not load players</div>';
    }
  }
  function rosterBucketKey(player, tab) {
    if (tab === "pitching") {
      const entry = (state.statsCache.pitching || []).find(function(p) {
        return p.player && p.player.id === player.person.id;
      });
      if (entry && entry.stat) {
        const gs = parseInt(entry.stat.gamesStarted, 10) || 0;
        const gp = parseInt(entry.stat.gamesPlayed, 10) || 0;
        if (gs >= 3 || gp > 0 && gs / gp >= 0.5) return "SP";
        return "RP";
      }
      return "P";
    }
    const abbr = player.position && player.position.abbreviation || "";
    if (abbr === "C") return "C";
    if (abbr === "1B" || abbr === "2B" || abbr === "3B" || abbr === "SS" || abbr === "IF") return "IF";
    if (abbr === "LF" || abbr === "CF" || abbr === "RF" || abbr === "OF") return "OF";
    if (abbr === "DH") return "DH";
    return "OTH";
  }
  var ROSTER_BUCKET_ORDER = {
    hitting: ["C", "IF", "OF", "DH", "OTH"],
    fielding: ["C", "IF", "OF", "DH", "OTH"],
    pitching: ["SP", "RP", "P"]
  };
  var ROSTER_BUCKET_LABEL = {
    C: "\u{1F9E4} Catchers",
    IF: "\u26BE Infielders",
    OF: "\u{1F3C3} Outfielders",
    DH: "\u{1F9BE} DH",
    SP: "\u{1F3AF} Starters",
    RP: "\u{1F525} Relievers",
    P: "\u{1F94E} Pitchers",
    OTH: "\u2796 Other"
  };
  function rosterInlineStatFor(player, tab) {
    const group = tab === "fielding" ? "hitting" : tab;
    const pool = state.statsCache[group] || [];
    const entry = pool.find(function(p) {
      return p.player && p.player.id === player.person.id;
    });
    if (!entry || !entry.stat) return null;
    const s = entry.stat;
    if (group === "hitting") {
      return {
        display: fmtRate(s.avg) + " / " + (s.homeRuns || 0) + " HR / " + fmtRate(s.ops) + " OPS",
        raw: parseFloat(s.ops)
      };
    }
    return {
      display: fmt(s.era, 2) + " ERA \xB7 " + (s.strikeOuts || 0) + " K \xB7 " + fmt(s.whip, 2) + " WHIP",
      raw: parseFloat(s.era)
    };
  }
  function rosterTeamBest(group) {
    const pool = state.statsCache[group] || [];
    if (!pool.length) return null;
    const key = group === "pitching" ? "era" : "ops";
    const values = pool.map(function(p) {
      return p.stat ? parseFloat(p.stat[key]) : NaN;
    }).filter(function(v) {
      return !isNaN(v);
    });
    if (!values.length) return null;
    return group === "pitching" ? Math.min.apply(null, values) : Math.max.apply(null, values);
  }
  function renderPlayerList() {
    const tab = state.currentRosterTab;
    const players = state.rosterData[tab] || [];
    if (!players.length) {
      document.getElementById("playerList").innerHTML = '<div class="loading">No players found</div>';
      return;
    }
    const showBadges = tab === "hitting";
    const statGroup = tab === "fielding" ? "hitting" : tab;
    const teamBest = rosterTeamBest(statGroup);
    const buckets = {};
    players.forEach(function(p) {
      const k = rosterBucketKey(p, tab);
      (buckets[k] = buckets[k] || []).push(p);
    });
    const order = ROSTER_BUCKET_ORDER[tab] || ["OTH"];
    let html = "";
    order.forEach(function(key) {
      const list = buckets[key];
      if (!list || !list.length) return;
      html += '<div class="roster-section-header">' + (ROSTER_BUCKET_LABEL[key] || key) + ' <span class="roster-section-count">' + list.length + "</span></div>";
      list.forEach(function(p) {
        const sel = state.selectedPlayer && state.selectedPlayer.person && state.selectedPlayer.person.id === p.person.id;
        const badge = showBadges ? hotColdBadge(p.person.id) : "";
        const inline = rosterInlineStatFor(p, tab);
        let barW = 0;
        if (inline && teamBest) {
          if (statGroup === "pitching") barW = isFinite(teamBest / inline.raw) ? Math.min(100, Math.max(8, teamBest / inline.raw * 100)) : 0;
          else barW = isFinite(inline.raw / teamBest) ? Math.min(100, Math.max(8, inline.raw / teamBest * 100)) : 0;
        }
        html += '<div class="player-item' + (sel ? " selected" : "") + '" onclick="selectPlayer(' + p.person.id + ",'" + tab + `')"><div class="roster-row-main"><div class="player-name">` + p.person.fullName + badge + '</div><div class="player-pos">#' + (p.jerseyNumber || "\u2014") + " \xB7 " + (p.position && p.position.name ? p.position.name : "\u2014") + (inline ? ' \xB7 <span class="roster-inline-stat">' + inline.display + "</span>" : "") + "</div>" + (barW ? '<div class="roster-mini-bar"><i style="width:' + barW.toFixed(0) + '%"></i></div>' : "") + '</div><span class="player-chevron">\u203A</span></div>';
      });
    });
    document.getElementById("playerList").innerHTML = html;
  }
  function switchRosterTab(tab, btn) {
    state.currentRosterTab = tab;
    state.selectedPlayer = null;
    document.querySelectorAll(".stat-tab").forEach(function(b) {
      b.classList.remove("active");
    });
    btn.classList.add("active");
    scrollTabIntoView(btn);
    const players = state.rosterData[tab] || [];
    if (players.length) selectPlayer(players[0].person.id, tab, true);
    else {
      renderPlayerList();
      document.getElementById("playerStatsTitle").textContent = "Player Stats";
      document.getElementById("playerStats").innerHTML = '<div class="empty-state">No players available</div>';
    }
  }

  // src/sections/stats/team.js
  async function loadTeamStats() {
    const stripEl = document.getElementById("teamStatsStrip");
    const formEl = document.getElementById("teamFormLine");
    const titleEl = document.getElementById("teamStatsTitle");
    if (!stripEl) return;
    titleEl.textContent = SEASON + " " + state.activeTeam.short + " \xB7 Team Stats";
    const FRESH_MS2 = 3e5;
    const teamId = state.activeTeam.id;
    if (state.teamStats.teamId === teamId && Date.now() - state.teamStatsFetchedAt < FRESH_MS2) {
      renderTeamStats();
      return;
    }
    if (state.teamStatsInflight) return state.teamStatsInflight;
    stripEl.innerHTML = '<div class="loading">Loading team stats...</div>';
    if (formEl) formEl.innerHTML = "";
    state.teamStatsInflight = async function() {
      try {
        const todayStr = etDateStr();
        const fromStr = etDatePlus(todayStr, -25);
        const schedReq = fetch(MLB_BASE + "/schedule?teamId=" + teamId + "&startDate=" + fromStr + "&endDate=" + todayStr + "&hydrate=linescore&sportId=1");
        const seasonReq = fetch(MLB_BASE + "/teams/" + teamId + "/stats?group=hitting,pitching,fielding&stats=season&season=" + SEASON);
        const l10Req = fetch(MLB_BASE + "/teams/" + teamId + "/stats?group=hitting,pitching&stats=lastXGames&limitGames=10&season=" + SEASON);
        const standingsReq = fetch(MLB_BASE + "/standings?leagueId=103,104&season=" + SEASON);
        const [seasonRes, l10Res, standingsRes, schedRes] = await Promise.all([seasonReq, l10Req, standingsReq, schedReq]);
        const seasonData = seasonRes && seasonRes.ok ? await seasonRes.json() : null;
        const l10Data = l10Res && l10Res.ok ? await l10Res.json() : null;
        const standingsData = standingsRes && standingsRes.ok ? await standingsRes.json() : null;
        const schedData = schedRes && schedRes.ok ? await schedRes.json() : null;
        state.teamStats.hitting = extractTeamStat(seasonData, "hitting");
        state.teamStats.pitching = extractTeamStat(seasonData, "pitching");
        state.teamStats.fielding = extractTeamStat(seasonData, "fielding");
        state.teamStats.l10Hitting = extractTeamStat(l10Data, "hitting");
        state.teamStats.l10Pitching = extractTeamStat(l10Data, "pitching");
        state.teamStats.standingsRecord = extractTeamRecord(standingsData, teamId);
        state.teamStats.last10RunDiff = computeLast10RunDiff(schedData, teamId);
        state.teamStats.teamId = teamId;
        state.teamStatsFetchedAt = Date.now();
        renderTeamStats();
      } catch (e) {
        if (stripEl) stripEl.innerHTML = '<div class="error">Could not load team stats</div>';
      } finally {
        state.teamStatsInflight = null;
      }
    }();
    return state.teamStatsInflight;
  }
  function extractTeamStat(payload, group) {
    if (!payload || !payload.stats) return null;
    const blk = payload.stats.find(function(s) {
      return s.group && s.group.displayName && s.group.displayName.toLowerCase() === group;
    });
    if (!blk || !blk.splits || !blk.splits.length) return null;
    return blk.splits[0].stat;
  }
  function computeLast10RunDiff(schedPayload, teamId) {
    if (!schedPayload || !schedPayload.dates) return null;
    const games = [];
    schedPayload.dates.forEach(function(d) {
      (d.games || []).forEach(function(g) {
        games.push(g);
      });
    });
    const finals = games.filter(function(g) {
      return g.status && g.status.abstractGameState === "Final" && g.linescore && g.linescore.teams && g.linescore.teams.home && g.linescore.teams.away;
    }).sort(function(a, b) {
      return new Date(b.gameDate) - new Date(a.gameDate);
    });
    if (!finals.length) return null;
    const slice = finals.slice(0, 10);
    let diff = 0, counted = 0;
    slice.forEach(function(g) {
      const home = g.teams && g.teams.home, away = g.teams && g.teams.away;
      const ls = g.linescore.teams;
      const homeR = parseInt(ls.home.runs, 10), awayR = parseInt(ls.away.runs, 10);
      if (isNaN(homeR) || isNaN(awayR)) return;
      if (home && home.team && home.team.id === teamId) {
        diff += homeR - awayR;
        counted++;
      } else if (away && away.team && away.team.id === teamId) {
        diff += awayR - homeR;
        counted++;
      }
    });
    return counted > 0 ? diff : null;
  }
  function extractTeamRecord(standingsData, teamId) {
    if (!standingsData || !standingsData.records) return null;
    for (let i = 0; i < standingsData.records.length; i++) {
      const teams = standingsData.records[i].teamRecords || [];
      for (let j = 0; j < teams.length; j++) {
        if (teams[j].team && teams[j].team.id === teamId) {
          const split = (teams[j].records && teams[j].records.splitRecords || []).find(function(s) {
            return s.type === "lastTen";
          });
          return {
            lastTen: split ? split.wins + "-" + split.losses : "",
            lastTenWins: split ? split.wins : 0,
            lastTenLosses: split ? split.losses : 0,
            streak: teams[j].streak ? teams[j].streak.streakCode : "",
            runDiff: typeof teams[j].runDifferential !== "undefined" ? teams[j].runDifferential : null
          };
        }
      }
    }
    return null;
  }
  function renderTeamStats() {
    const stripEl = document.getElementById("teamStatsStrip");
    const formEl = document.getElementById("teamFormLine");
    if (!stripEl) return;
    const ts = state.teamStats;
    let html = "";
    if (ts.hitting) {
      const h = ts.hitting;
      html += '<div class="team-stat-tile"><div class="team-stat-tile-head"><span>\u26BE Hitting</span></div><div class="team-stat-tile-grid"><div class="team-stat-tile-stat"><div class="v">' + fmtRate(h.avg) + '</div><div class="l">AVG</div></div><div class="team-stat-tile-stat"><div class="v">' + (h.homeRuns || 0) + '</div><div class="l">HR</div></div><div class="team-stat-tile-stat"><div class="v">' + fmtRate(h.ops) + '</div><div class="l">OPS</div></div><div class="team-stat-tile-stat"><div class="v">' + (h.runs || 0) + '</div><div class="l">R</div></div></div></div>';
    }
    if (ts.pitching) {
      const p = ts.pitching;
      html += '<div class="team-stat-tile"><div class="team-stat-tile-head"><span>\u{1F94E} Pitching</span></div><div class="team-stat-tile-grid"><div class="team-stat-tile-stat"><div class="v">' + fmt(p.era, 2) + '</div><div class="l">ERA</div></div><div class="team-stat-tile-stat"><div class="v">' + fmt(p.whip, 2) + '</div><div class="l">WHIP</div></div><div class="team-stat-tile-stat"><div class="v">' + (p.strikeOuts || 0) + '</div><div class="l">K</div></div><div class="team-stat-tile-stat"><div class="v">' + (p.saves || 0) + '</div><div class="l">SV</div></div></div></div>';
    }
    if (ts.fielding) {
      const f = ts.fielding;
      html += '<div class="team-stat-tile"><div class="team-stat-tile-head"><span>\u{1F9E4} Fielding</span></div><div class="team-stat-tile-grid"><div class="team-stat-tile-stat"><div class="v">' + fmtRate(f.fielding) + '</div><div class="l">FPCT</div></div><div class="team-stat-tile-stat"><div class="v">' + (f.errors || 0) + '</div><div class="l">E</div></div><div class="team-stat-tile-stat"><div class="v">' + (f.doublePlays || 0) + '</div><div class="l">DP</div></div><div class="team-stat-tile-stat"><div class="v">' + (f.assists || 0) + '</div><div class="l">A</div></div></div></div>';
    }
    if (!html) html = '<div class="empty-state" style="grid-column:1/-1">No team stats available</div>';
    stripEl.innerHTML = html;
    if (!formEl) return;
    const rec = ts.standingsRecord;
    if (rec && rec.lastTen) {
      const streakUp = rec.streak && rec.streak.charAt(0) === "W";
      const rd = ts.last10RunDiff;
      const rdStr = rd == null ? "" : " \xB7 run diff " + (rd >= 0 ? "+" : "") + rd;
      const l10w = rec.lastTenWins || 0;
      const formClass = l10w > 5 ? "" : l10w === 5 ? " neutral" : " cold";
      formEl.className = "team-form-line" + formClass;
      formEl.innerHTML = '<div><b style="color:#fff;">Last 10:</b> ' + rec.lastTen + (rec.streak ? " \xB7 " + (streakUp ? "\u25B2 " : "\u25BC ") + rec.streak : "") + rdStr + '</div><div class="form-meta">Form</div>';
    } else {
      formEl.className = "team-form-line empty";
      formEl.innerHTML = '<div>L10 form not yet available</div><div class="form-meta">Form</div>';
    }
  }

  // src/sections/league.js
  var leagueCallbacks = { teamCapImg: null };
  function setLeagueCallbacks(cb) {
    Object.assign(leagueCallbacks, cb);
  }
  var leagueRefreshTimer = null;
  function clearLeagueTimer() {
    if (leagueRefreshTimer) {
      clearInterval(leagueRefreshTimer);
      leagueRefreshTimer = null;
    }
  }
  var leagueLeaderTab = "hitting";
  var leagueStandingsMap = {};
  var leagueMatchupOffset = 0;
  var LEAGUE_HIT_STATS = [{ label: "HR", cats: "homeRuns", decimals: 0 }, { label: "AVG", cats: "battingAverage", decimals: 3, noLeadZero: true }, { label: "OPS", cats: "onBasePlusSlugging", decimals: 3, noLeadZero: true }, { label: "RBI", cats: "runsBattedIn", decimals: 0 }, { label: "SB", cats: "stolenBases", decimals: 0 }, { label: "BB", cats: "walks", decimals: 0 }];
  var LEAGUE_PIT_STATS = [{ label: "SO", cats: "strikeouts", decimals: 0 }, { label: "WHIP", cats: "walksAndHitsPerInningPitched", decimals: 2 }, { label: "ERA", cats: "earnedRunAverage", decimals: 2 }, { label: "W", cats: "wins", decimals: 0 }, { label: "SV", cats: "saves", decimals: 0 }, { label: "IP", cats: "inningsPitched", decimals: 1 }];
  async function loadLeagueView() {
    if (leagueRefreshTimer) {
      clearInterval(leagueRefreshTimer);
      leagueRefreshTimer = null;
    }
    leagueMatchupOffset = 0;
    ["matchupYest", "matchupToday", "matchupTomor"].forEach(function(id, i) {
      const el = document.getElementById(id);
      if (el) el.classList.toggle("active", i === 1);
    });
    const lbl = document.getElementById("matchupDayLabel");
    if (lbl) lbl.textContent = "Today's";
    await loadLeagueStandings();
    loadLeagueMatchups();
    loadLeagueNews();
    loadLeagueLeaders();
    leagueRefreshTimer = setInterval(loadLeagueMatchups, TIMING.LEAGUE_REFRESH_MS);
  }
  async function loadLeagueStandings() {
    try {
      const r = await fetch(MLB_BASE + "/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team");
      const d = await r.json();
      leagueStandingsMap = {};
      (d.records || []).forEach(function(rec) {
        (rec.teamRecords || []).forEach(function(t) {
          leagueStandingsMap[t.team.id] = { w: t.wins, l: t.losses };
        });
      });
    } catch (e) {
    }
  }
  async function loadLeagueMatchups() {
    const el = document.getElementById("leagueMatchups");
    const dayLabels = ["Yesterday's", "Today's", "Tomorrow's"], dayLabel = dayLabels[leagueMatchupOffset + 1];
    el.style.transition = "opacity 0.18s ease";
    el.style.opacity = "0.3";
    const dateStr = etDatePlus(etDateStr(), leagueMatchupOffset);
    try {
      let lastName = function(full) {
        if (!full) return "";
        const parts = full.split(" ");
        return parts.length > 1 ? parts.slice(1).join(" ") : full;
      }, pitcherChip = function(side) {
        const p = side && side.probablePitcher;
        if (!p || !p.fullName) return '<div class="matchup-pitcher matchup-pitcher--tbd">TBD</div>';
        return '<div class="matchup-pitcher" title="' + p.fullName + '">' + lastName(p.fullName) + "</div>";
      };
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&date=" + dateStr + "&hydrate=linescore,team,probablePitcher");
      let d = await r.json(), games = [];
      (d.dates || []).forEach(function(dt) {
        games = games.concat(dt.games || []);
      });
      games.sort(function(a, b) {
        return new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime();
      });
      if (!games.length) {
        el.innerHTML = '<div class="empty-state">No games scheduled ' + dayLabel.replace("'s", "") + "</div>";
        requestAnimationFrame(function() {
          el.style.opacity = "1";
        });
        return;
      }
      let html = '<div class="matchup-grid">';
      games.forEach(function(g) {
        const home = g.teams.home, away = g.teams.away, status = g.status.abstractGameState, detailed = g.status.detailedState;
        const actuallyLive = status === "Live" && detailed !== "Warmup" && detailed !== "Pre-Game";
        const clickable = actuallyLive || status === "Final";
        const preGame = !actuallyLive && status !== "Final";
        let statusHtml = "";
        if (actuallyLive) {
          const inn = g.linescore && g.linescore.currentInning ? (g.linescore.inningHalf === "Bottom" ? "Bot " : "Top ") + g.linescore.currentInning : "In Progress";
          statusHtml = '<div class="matchup-status is-live"><span class="matchup-live-dot"></span>LIVE \xB7 ' + inn + "</div>";
        } else if (status === "Final") statusHtml = '<div class="matchup-status">FINAL</div>';
        else {
          const t = new Date(g.gameDate);
          statusHtml = '<div class="matchup-status">' + t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div>";
        }
        let seriesHtml = "";
        if (g.gamesInSeries > 1 && g.seriesGameNumber) {
          seriesHtml = '<div class="matchup-series">Game ' + g.seriesGameNumber + " of " + g.gamesInSeries + "</div>";
        }
        let scoreOrVs;
        if (actuallyLive) {
          scoreOrVs = '<span class="matchup-score">' + (away.score != null ? away.score : 0) + '</span><span class="matchup-divider">\u2014</span><span class="matchup-score">' + (home.score != null ? home.score : 0) + "</span>";
        } else if (status === "Final") {
          const awayWon = away.score > home.score;
          scoreOrVs = '<span class="matchup-score' + (awayWon ? "" : " is-dim") + '">' + (away.score != null ? away.score : 0) + '</span><span class="matchup-divider">\u2014</span><span class="matchup-score' + (awayWon ? " is-dim" : "") + '">' + (home.score != null ? home.score : 0) + "</span>";
        } else {
          scoreOrVs = '<span class="matchup-vs">vs</span>';
        }
        const awayRec = leagueStandingsMap[away.team.id], homeRec = leagueStandingsMap[home.team.id];
        const awayD = TEAMS.find(function(t) {
          return t.id === away.team.id;
        }) || {}, homeD = TEAMS.find(function(t) {
          return t.id === home.team.id;
        }) || {};
        const pitcherRow = preGame ? '<div class="matchup-pitcher-row"><div class="matchup-pitcher-col">' + pitcherChip(away) + '</div><div class="matchup-pitcher-sep">vs</div><div class="matchup-pitcher-col">' + pitcherChip(home) + "</div></div>" : "";
        html += '<div class="matchup-card"' + (clickable ? ' onclick="showLiveGame(' + g.gamePk + ')"' : "") + ">" + seriesHtml + statusHtml + '<div class="matchup-score-row"><div class="matchup-team">' + leagueCallbacks.teamCapImg(away.team.id, away.team.teamName, awayD.primary || "#333", awayD.secondary || "#fff", "matchup-cap") + '<div class="matchup-abbr">' + (away.team.abbreviation || away.team.teamName) + '</div><div class="matchup-record">' + (awayRec ? "(" + awayRec.w + "-" + awayRec.l + ")" : "") + "</div></div>" + scoreOrVs + '<div class="matchup-team">' + leagueCallbacks.teamCapImg(home.team.id, home.team.teamName, homeD.primary || "#333", homeD.secondary || "#fff", "matchup-cap") + '<div class="matchup-abbr">' + (home.team.abbreviation || home.team.teamName) + '</div><div class="matchup-record">' + (homeRec ? "(" + homeRec.w + "-" + homeRec.l + ")" : "") + "</div></div></div>" + pitcherRow + "</div>";
      });
      el.innerHTML = html + "</div>";
    } catch (e) {
      el.innerHTML = '<div class="error">Could not load games</div>';
    }
    requestAnimationFrame(function() {
      el.style.opacity = "1";
    });
  }
  function switchMatchupDay(offset, btn) {
    leagueMatchupOffset = offset;
    ["matchupYest", "matchupToday", "matchupTomor"].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove("active");
    });
    if (btn) btn.classList.add("active");
    const labels = ["Yesterday's", "Today's", "Tomorrow's"], lbl = document.getElementById("matchupDayLabel");
    if (lbl) lbl.textContent = labels[offset + 1];
    loadLeagueMatchups();
  }
  async function loadLeagueNews() {
    const el = document.getElementById("leagueNews");
    el.innerHTML = '<div class="loading">Loading...</div>';
    try {
      const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=15");
      const d = await r.json(), articles = (d.articles || []).filter(function(a) {
        return a.headline;
      }).slice(0, 10);
      if (!articles.length) throw new Error("none");
      let html = "";
      articles.forEach(function(a) {
        const pub = a.published ? new Date(a.published).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
        const link = a.links && a.links.web && a.links.web.href ? a.links.web.href : "#";
        const headline = escapeNewsHtml(decodeNewsHtml(a.headline || ""));
        html += '<div class="news-item"><div class="news-dot"></div><div><div class="news-title"><a href="' + link + '" target="_blank">' + headline + '</a></div><div class="news-meta">' + pub + (a.byline ? " \xB7 " + a.byline : "") + "</div></div></div>";
      });
      el.innerHTML = html;
    } catch (e) {
      el.innerHTML = '<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';
    }
  }
  async function loadLeagueLeaders() {
    const el = document.getElementById("leagueLeaders");
    el.innerHTML = '<div class="loading">Loading leaders...</div>';
    const group = leagueLeaderTab;
    try {
      await fetchLeagueLeaders(group);
      renderLeagueLeaders(group);
    } catch (e) {
      el.innerHTML = '<div class="error">Could not load leaders</div>';
    }
  }
  function renderLeagueLeaders(group) {
    const el = document.getElementById("leagueLeaders");
    if (!el) return;
    const stats = group === "hitting" ? LEAGUE_HIT_STATS : LEAGUE_PIT_STATS;
    let html = '<div class="league-leaders-grid">';
    stats.forEach(function(s) {
      const leaders = state.leagueLeaders[group + ":" + s.cats] || [];
      html += '<div class="leader-stat-card"><div class="leader-stat-label">' + s.label + "</div>";
      if (!leaders.length) {
        html += '<div class="empty-state" style="padding:6px;font-size:.8rem">No data</div>';
      }
      leaders.slice(0, 10).forEach(function(l, i) {
        let val = l.value;
        if (val != null) {
          const n = parseFloat(val);
          if (!isNaN(n)) val = s.noLeadZero && n > 0 && n < 1 ? n.toFixed(s.decimals).slice(1) : n.toFixed(s.decimals);
        }
        html += '<div class="leader-row"><div class="leader-row-left"><span class="leader-rank">' + (i + 1) + '</span><span class="leader-name">' + (l.playerName || "\u2014") + '</span></div><span class="leader-val">' + val + "</span></div>";
      });
      html += "</div>";
    });
    el.innerHTML = html + "</div>";
  }
  function switchLeagueLeaderTab(tab, btn) {
    leagueLeaderTab = tab;
    document.getElementById("leagueHitTab").classList.toggle("active", tab === "hitting");
    document.getElementById("leaguePitTab").classList.toggle("active", tab === "pitching");
    const key = tab + ":" + (tab === "hitting" ? "homeRuns" : "earnedRunAverage");
    if (state.leagueLeaders[key] && state.leagueLeaders[key].length) renderLeagueLeaders(tab);
    else loadLeagueLeaders();
  }

  // src/sections/news.js
  function mkEspnRow(a) {
    const pub = a.published ? new Date(a.published).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
    const link = a.links && a.links.web && a.links.web.href ? a.links.web.href : "#";
    const headline = escapeNewsHtml(decodeNewsHtml(a.headline || ""));
    return '<div class="news-item"><div class="news-dot"></div><div class="news-body"><div class="news-title"><a href="' + link + '" target="_blank">' + headline + '</a></div><div class="news-meta">' + pub + (a.byline ? " \xB7 " + a.byline : "") + "</div></div></div>";
  }
  function mkProxyNewsRow(item) {
    const icon = window.NEWS_SOURCE_ICONS ? window.NEWS_SOURCE_ICONS[item.source] || "\u{1F4F0}" : "\u{1F4F0}";
    const sourceClass = item.source ? " news-thumb--" + item.source : "";
    const thumb = isSafeNewsImage(item.image) ? '<div class="news-thumb' + sourceClass + '"><img src="' + escapeNewsHtml(forceHttps(item.image)) + `" alt="" onerror="this.parentNode.innerHTML='<span class=&quot;news-thumb-placeholder&quot;>` + icon + `</span>'"></div>` : '<div class="news-thumb' + sourceClass + '"><span class="news-thumb-placeholder">' + icon + "</span></div>";
    const NEWS_SOURCE_LABELS2 = window.NEWS_SOURCE_LABELS || {};
    const src = NEWS_SOURCE_LABELS2[item.source] || item.source || "";
    const kicker = src ? '<div class="news-source-kicker">VIA ' + escapeNewsHtml(src) + "</div>" : "";
    const date = fmtNewsDate(item.pubDate);
    const link = item.link || "#";
    const title = escapeNewsHtml(decodeNewsHtml(item.title || ""));
    return '<div class="news-item">' + thumb + '<div class="news-body">' + kicker + '<div class="news-title"><a href="' + escapeNewsHtml(link) + '" target="_blank" rel="noopener">' + title + "</a></div>" + (date ? '<div class="news-meta">' + date + "</div>" : "") + "</div></div>";
  }
  function renderNewsList() {
    const el = document.getElementById("newsFull");
    if (!el) return;
    let items = state.newsSourceFilter === "all" ? state.newsArticlesCache : state.newsArticlesCache.filter(function(a) {
      return a.source === state.newsSourceFilter;
    });
    items = items.filter(function(a) {
      return !isBettingPromo(a);
    });
    if (!items.length) {
      el.innerHTML = '<div class="loading">No articles for this source.</div>';
      return;
    }
    el.innerHTML = items.map(mkProxyNewsRow).join("");
  }
  function selectNewsSource(key, btn) {
    state.newsSourceFilter = key;
    const pills = document.querySelectorAll("#newsSourcePills .stat-tab");
    pills.forEach(function(p) {
      p.classList.remove("active");
    });
    if (btn) btn.classList.add("active");
    else {
      const match = document.querySelector('#newsSourcePills .stat-tab[data-source="' + key + '"]');
      if (match) match.classList.add("active");
    }
    renderNewsList();
  }
  async function loadNews() {
    const fullEl = document.getElementById("newsFull"), homeEl = document.getElementById("homeNews");
    const teamLensBtn = document.getElementById("newsTeamBtn"), teamLensKnob = document.getElementById("newsTeamLensKnob");
    if (teamLensBtn) {
      teamLensBtn.classList.toggle("on", state.newsFeedMode === "team");
      if (teamLensKnob) teamLensKnob.style.left = state.newsFeedMode === "team" ? "21px" : "2px";
    }
    if (fullEl) fullEl.innerHTML = '<div class="loading">Loading news...</div>';
    if (homeEl) homeEl.innerHTML = '<div class="loading">Loading news...</div>';
    const teamUrl = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team=" + state.activeTeam.espnId + "&limit=20";
    if (state.newsFeedMode === "team") {
      try {
        const resp = await fetch(teamUrl);
        if (!resp.ok) throw new Error(resp.status);
        const d = await resp.json();
        const arts = (d.articles || []).filter(function(a) {
          return a.headline;
        });
        if (!arts.length) throw new Error("No articles");
        if (fullEl) fullEl.innerHTML = arts.map(mkEspnRow).join("");
        if (homeEl) homeEl.innerHTML = arts.slice(0, 5).map(mkEspnRow).join("");
      } catch (e) {
        const msg = '<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';
        if (fullEl) fullEl.innerHTML = msg;
        if (homeEl) homeEl.innerHTML = msg;
      }
      return;
    }
    try {
      const responses = await Promise.all([fetch(API_BASE + "/api/proxy-news"), fetch(teamUrl)]);
      if (!responses[0].ok) throw new Error(responses[0].status);
      const d = await responses[0].json();
      state.newsArticlesCache = Array.isArray(d.articles) ? d.articles : [];
      if (!state.newsArticlesCache.length) throw new Error("No articles");
      renderNewsList();
      if (homeEl && responses[1].ok) {
        const hD = await responses[1].json();
        const hArts = (hD.articles || []).filter(function(a) {
          return a.headline;
        });
        homeEl.innerHTML = hArts.slice(0, 5).map(mkEspnRow).join("") || '<div class="loading">No news available</div>';
      }
    } catch (e) {
      try {
        const fb = await fetch("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20");
        if (!fb.ok) throw new Error(fb.status);
        const fbD = await fb.json();
        const fbArts = (fbD.articles || []).filter(function(a) {
          return a.headline;
        });
        if (fullEl) fullEl.innerHTML = fbArts.map(mkEspnRow).join("");
        if (homeEl) {
          const hResp = await fetch(teamUrl);
          if (!hResp.ok) throw new Error(hResp.status);
          const hJ = await hResp.json();
          homeEl.innerHTML = (hJ.articles || []).filter(function(a) {
            return a.headline;
          }).slice(0, 5).map(mkEspnRow).join("") || '<div class="loading">No news available</div>';
        }
      } catch (e2) {
        const msg = '<div class="error">News unavailable (proxy and ESPN both failed).</div>';
        if (fullEl) fullEl.innerHTML = msg;
        if (homeEl) homeEl.innerHTML = msg;
      }
    }
  }
  function switchNewsFeed(mode) {
    state.newsFeedMode = mode;
    const lensBtn = document.getElementById("newsTeamBtn"), lensKnob = document.getElementById("newsTeamLensKnob");
    if (lensBtn) {
      lensBtn.classList.toggle("on", mode === "team");
      if (lensKnob) lensKnob.style.left = mode === "team" ? "21px" : "2px";
    }
    const pills = document.getElementById("newsSourcePills");
    if (pills) pills.style.display = mode === "mlb" ? "flex" : "none";
    loadNews();
  }
  function toggleNewsTeamLens() {
    switchNewsFeed(state.newsFeedMode === "team" ? "mlb" : "team");
  }

  // src/sections/schedule.js
  var calMonth = (/* @__PURE__ */ new Date()).getMonth();
  var calYear = (/* @__PURE__ */ new Date()).getFullYear();
  var selectedGamePk = null;
  async function loadSchedule() {
    document.getElementById("calGrid").innerHTML = '<div class="loading">Loading schedule...</div>';
    document.getElementById("scheduleTitle").innerHTML = SEASON + " " + state.activeTeam.short + ' Schedule <button class="refresh-btn" onclick="loadSchedule()">\u21BB Refresh</button>';
    try {
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&season=" + SEASON + "&teamId=" + state.activeTeam.id + "&hydrate=team,linescore,game,probablePitcher");
      const d = await r.json();
      state.scheduleData = [];
      (d.dates || []).forEach(function(dt) {
        dt.games.forEach(function(g) {
          state.scheduleData.push(g);
        });
      });
      state.scheduleLoaded = true;
      calMonth = (/* @__PURE__ */ new Date()).getMonth();
      calYear = (/* @__PURE__ */ new Date()).getFullYear();
      renderCalendar();
    } catch (e) {
      document.getElementById("calGrid").innerHTML = '<div class="error">Could not load schedule</div>';
    }
  }
  function changeMonth(dir) {
    calMonth += dir;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    }
    if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    selectedGamePk = null;
    document.getElementById("gameDetail").innerHTML = "";
    renderCalendar();
  }
  function renderCalendar() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("calMonthLabel").textContent = months[calMonth] + " " + calYear;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], today = /* @__PURE__ */ new Date(), firstDay = new Date(calYear, calMonth, 1).getDay(), daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const gamesByDate = {};
    state.scheduleData.forEach(function(g) {
      const _d = new Date(g.gameDate), ds = _d.getFullYear() + "-" + String(_d.getMonth() + 1).padStart(2, "0") + "-" + String(_d.getDate()).padStart(2, "0");
      if (!gamesByDate[ds]) gamesByDate[ds] = [];
      gamesByDate[ds].push(g);
    });
    Object.keys(gamesByDate).forEach(function(ds) {
      gamesByDate[ds].sort(function(a, b) {
        return a.gamePk - b.gamePk;
      });
    });
    let html = '<div class="cal-grid">';
    days.forEach(function(d) {
      html += '<div class="cal-header">' + d + "</div>";
    });
    for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
    for (let day = 1; day <= daysInMonth; day++) {
      const ds = calYear + "-" + String(calMonth + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0"), dayGames = gamesByDate[ds] || [];
      const isToday = today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;
      const isSelected = dayGames.some(function(gm) {
        return gm.gamePk === selectedGamePk;
      });
      const isDH = dayGames.length > 1;
      const classes = "cal-day" + (dayGames.length ? " has-game" : "") + (isToday ? " today" : "") + (isSelected ? " selected" : "");
      const onclick = dayGames.length ? 'onclick="selectCalGame(' + dayGames[0].gamePk + ',event)"' : "";
      let inner = '<div class="cal-day-num">' + day + "</div>";
      if (dayGames.length) {
        const g0 = dayGames[0], home0 = g0.teams.home, away0 = g0.teams.away, teamHome = home0.team.id === state.activeTeam.id, opp0 = teamHome ? away0 : home0;
        inner += '<div class="cal-game-info"><div class="cal-opp" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span class="cal-ha">' + (teamHome ? "vs " : "@ ") + "</span>" + opp0.team.teamName + (isDH ? ' <span style="font-size:.55rem;font-weight:700;color:var(--accent);letter-spacing:.04em">DH</span>' : "") + "</div>";
        let dotW = false, dotL = false, dotLive = false, dotPPD = false;
        dayGames.forEach(function(gm, idx) {
          const myT = gm.teams.home.team.id === state.activeTeam.id ? gm.teams.home : gm.teams.away;
          const opT = gm.teams.home.team.id === state.activeTeam.id ? gm.teams.away : gm.teams.home;
          const st = gm.status.abstractGameState, dtl = gm.status.detailedState || "";
          const ppd = dtl === "Postponed" || dtl === "Cancelled" || dtl === "Suspended";
          const calLive = st === "Live" && dtl !== "Warmup" && dtl !== "Pre-Game";
          const wrap = isDH ? '<div onclick="event.stopPropagation();selectCalGame(' + gm.gamePk + ',event)" style="cursor:pointer;display:flex;align-items:center;gap:3px;margin-top:2px"><span style="font-size:.6rem;color:var(--muted);flex-shrink:0">G' + (idx + 1) + ":</span>" : "";
          const wrapEnd = isDH ? "</div>" : "";
          if (ppd) {
            dotPPD = true;
            inner += wrap + '<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)' + (isDH ? ";font-size:.6rem;padding:1px 5px" : "") + '">PPD</span>' + wrapEnd;
          } else if (st === "Final") {
            const mW = myT.isWinner, sc = myT.score != null && opT.score != null ? myT.score + "-" + opT.score : "?-?";
            inner += wrap + '<span class="cal-result ' + (mW ? "cal-w" : "cal-l") + '"' + (isDH ? ' style="font-size:.6rem;padding:1px 5px"' : "") + ">" + (mW ? "W" : "L") + " " + sc + "</span>" + wrapEnd;
            if (mW) dotW = true;
            else dotL = true;
          } else if (calLive) {
            const sc = myT.score != null && opT.score != null ? myT.score + "-" + opT.score : "?-?";
            inner += wrap + '<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)' + (isDH ? ";font-size:.6rem;padding:1px 5px" : "") + '">LIVE ' + sc + "</span>" + wrapEnd;
            dotLive = true;
          } else {
            const t = new Date(gm.gameDate), ts = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
            inner += wrap + (isDH ? '<span style="font-size:.65rem;color:var(--accent)">' + ts + "</span>" : '<div class="cal-upcoming">' + ts + "</div>") + wrapEnd;
          }
        });
        inner += "</div>";
        const dotCls = "cal-dot " + (dotLive ? "cal-dot-live" : dotW && !dotL ? "cal-dot-w" : !dotW && dotL ? "cal-dot-l" : dotPPD && !dotW && !dotL ? "cal-dot-ppd" : "cal-dot-up");
        inner += '<span class="' + dotCls + '"></span>';
      }
      html += '<div class="' + classes + '" ' + onclick + ">" + inner + "</div>";
    }
    html += "</div>";
    document.getElementById("calGrid").innerHTML = html;
  }
  async function selectCalGame(gamePk, evt) {
    const cellRect = evt ? evt.currentTarget.getBoundingClientRect() : null;
    selectedGamePk = gamePk;
    renderCalendar();
    const g = state.scheduleData.find(function(x) {
      return x.gamePk === gamePk;
    });
    if (!g) return;
    const localFmt = function(_d) {
      return _d.getFullYear() + "-" + String(_d.getMonth() + 1).padStart(2, "0") + "-" + String(_d.getDate()).padStart(2, "0");
    };
    const ds = localFmt(new Date(g.gameDate));
    const dayGames = state.scheduleData.filter(function(x) {
      return localFmt(new Date(x.gameDate)) === ds;
    }).sort(function(a, b) {
      return a.gamePk - b.gamePk;
    });
    const isDH = dayGames.length > 1;
    if (cellRect && window.innerWidth <= 480) {
      const home = g.teams.home, away = g.teams.away, teamHome = home.team.id === state.activeTeam.id;
      const opp = teamHome ? away : home, myT = teamHome ? home : away, status = g.status.abstractGameState;
      const isPostponed = g.status.detailedState === "Postponed" || g.status.detailedState === "Cancelled" || g.status.detailedState === "Suspended";
      const gameDate = new Date(g.gameDate);
      const dateStr = gameDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + (isDH ? " \xB7 DH" : "");
      let badgeHtml = "";
      if (isPostponed) badgeHtml = '<span class="cal-result" style="background:rgba(150,150,150,.15);color:var(--muted);border:1px solid rgba(150,150,150,.4)">PPD</span>';
      else if (status === "Final") {
        const mW = myT.isWinner, sc = myT.score != null && opp.score != null ? myT.score + "-" + opp.score : "?-?";
        badgeHtml = '<span class="cal-result ' + (mW ? "cal-w" : "cal-l") + '">' + (mW ? "W" : "L") + " " + sc + "</span>";
      } else if (status === "Live") {
        const sc = myT.score != null && opp.score != null ? myT.score + "-" + opp.score : "?-?";
        badgeHtml = '<span class="cal-result" style="background:rgba(100,100,120,.12);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.2)">\u25CF LIVE ' + sc + "</span>";
      } else badgeHtml = '<span style="font-size:.8rem;color:var(--accent)">' + gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</span>";
      const tt = document.getElementById("calTooltip");
      tt.innerHTML = '<div class="cal-tt-opp">' + (teamHome ? "vs " : "@ ") + opp.team.teamName + '</div><div class="cal-tt-date">' + dateStr + "</div>" + badgeHtml;
      let ttW = 190, left = cellRect.left + cellRect.width / 2 - ttW / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - ttW - 8));
      tt.style.cssText = "left:" + left + "px;top:" + (cellRect.top - 8) + "px;transform:translateY(-100%);min-width:" + ttW + "px";
      tt.classList.add("open");
    }
    const detail = document.getElementById("gameDetail");
    detail.innerHTML = '<div class="loading">Loading game details...</div>';
    try {
      const panels = await Promise.all(dayGames.map(function(gm, idx) {
        return buildGameDetailPanel(gm, isDH ? idx + 1 : null);
      }));
      detail.innerHTML = panels.join("");
      detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) {
      detail.innerHTML = '<div class="error">Could not load game details</div>';
    }
  }
  function switchBoxTab(bsId, side) {
    const other = side === "away" ? "home" : "away";
    document.getElementById(bsId + "_" + side).style.display = "block";
    document.getElementById(bsId + "_" + other).style.display = "none";
    document.getElementById(bsId + "_" + side + "_btn").classList.add("is-active");
    document.getElementById(bsId + "_" + other + "_btn").classList.remove("is-active");
  }
  function pickPlayback2(playbacks) {
    return playbacks && playbacks.length ? playbacks.find(function(p) {
      return p.name === "mp4";
    }) || playbacks[0] : null;
  }
  function playHighlightVideo(el, url) {
    const stopAllMedia2 = window.stopAllMedia;
    if (stopAllMedia2) stopAllMedia2("highlight");
    const video = document.createElement("video");
    video.controls = true;
    video.style.cssText = "width:100%;display:block;background:#000";
    video.addEventListener("error", function(e) {
      console.error("Video load error:", e, video.error);
      video.innerHTML = '<div style="color:#e03030;padding:20px;text-align:center">Video failed to load. Please try refreshing.</div>';
    });
    video.addEventListener("canplay", function() {
      if (false) console.log("Video ready to play");
      video.play().catch(function(err) {
        console.error("Autoplay blocked:", err);
      });
    }, { once: true });
    const src = document.createElement("source");
    src.src = url;
    src.type = "video/mp4";
    video.appendChild(src);
    el.replaceWith(video);
  }
  async function buildGameDetailPanel(g, gameNum) {
    const home = g.teams.home, away = g.teams.away, gameDate = new Date(g.gameDate);
    const status = g.status.abstractGameState, detailed = g.status.detailedState || "";
    const isPostponed = detailed === "Postponed" || detailed === "Cancelled" || detailed === "Suspended";
    const sep = gameNum > 1 ? '<div class="detail-separator"></div>' : "";
    const label = gameNum ? '<div class="detail-game-label">Game ' + gameNum + "</div>" : "";
    const title = away.team.teamName + " @ " + home.team.teamName;
    if (isPostponed) {
      let html2 = sep + '<div class="boxscore-wrap">' + label + '<div class="boxscore-title">' + title + " &nbsp;\xB7&nbsp; " + gameDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + "</div>";
      html2 += '<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val is-muted">' + detailed + "</div></div>";
      html2 += '<div class="game-note-box"><div class="game-note-label">Venue</div><div class="game-note-val">' + (g.venue && g.venue.name ? g.venue.name : "TBD") + "</div></div></div></div>";
      return html2;
    }
    if (status !== "Final" && status !== "Live") {
      let html2 = sep + '<div class="boxscore-wrap">' + label + '<div class="boxscore-title">' + title + " &nbsp;\xB7&nbsp; " + gameDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + " " + gameDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div>";
      html2 += '<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Location</div><div class="game-note-val">' + (g.venue && g.venue.name ? g.venue.name : "TBD") + "</div></div>";
      const awayPP = away.probablePitcher && away.probablePitcher.fullName ? away.probablePitcher.fullName : "TBD", homePP = home.probablePitcher && home.probablePitcher.fullName ? home.probablePitcher.fullName : "TBD";
      html2 += '<div class="game-note-box"><div class="game-note-label">Probable Pitchers</div><div class="game-note-val">' + away.team.teamName + ": " + awayPP + '</div><div class="game-note-val">' + home.team.teamName + ": " + homePP + "</div></div></div></div>";
      return html2;
    }
    if (status === "Live") {
      const ls2 = g.linescore || {}, half = ls2.inningHalf || "Top", inn = ls2.currentInning || "?";
      const aScore = away.score != null ? away.score : 0, hScore = home.score != null ? home.score : 0;
      let html2 = sep + '<div class="boxscore-wrap">' + label + '<div class="boxscore-title">' + title + " &nbsp;\xB7&nbsp; " + gameDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) + "</div>";
      html2 += '<div class="game-notes-grid"><div class="game-note-box"><div class="game-note-label">Score</div><div class="game-note-val">' + away.team.teamName + " " + aScore + ", " + home.team.teamName + " " + hScore + "</div></div>";
      html2 += '<div class="game-note-box"><div class="game-note-label">Status</div><div class="game-note-val"><span class="live-indicator">\u25CF LIVE</span> \xB7 ' + half + " " + inn + "</div></div></div>";
      html2 += '<button onclick="showLiveGame(' + g.gamePk + ')" class="watch-live-btn">\u25B6 Watch Live</button>';
      html2 += '<button onclick="openScorecardOverlay(' + g.gamePk + ')" class="watch-live-btn sc-btn">\u{1F4CB} Scorecard</button></div>';
      return html2;
    }
    let ls = {}, bs = {}, content = {};
    try {
      const responses = await Promise.all([fetch(MLB_BASE + "/game/" + g.gamePk + "/linescore"), fetch(MLB_BASE + "/game/" + g.gamePk + "/boxscore"), fetch(MLB_BASE + "/game/" + g.gamePk + "/content")]);
      try {
        ls = await responses[0].json();
      } catch (e) {
      }
      try {
        bs = await responses[1].json();
      } catch (e) {
      }
      try {
        if (responses[2].ok) content = await responses[2].json();
      } catch (e) {
      }
    } catch (e) {
    }
    const highlight = content.highlights && content.highlights.highlights && content.highlights.highlights.items && content.highlights.highlights.items[0] ? content.highlights.highlights.items[0] : null;
    const highlightPb = highlight ? pickPlayback2(highlight.playbacks) : null;
    const highlightUrl = highlightPb ? highlightPb.url : null;
    const thumbCuts = highlight && highlight.image && highlight.image.cuts ? highlight.image.cuts : [];
    const thumbCut = thumbCuts.find(function(c) {
      return c.width >= 640 && c.width <= 960;
    }) || thumbCuts[thumbCuts.length - 1] || null;
    const thumbUrl = thumbCut ? thumbCut.src : null;
    let html = sep + '<div class="final-game-grid">';
    html += '<div class="boxscore-wrap"><div class="boxscore-title">' + title + " &nbsp;\xB7&nbsp; " + gameDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + "</div>";
    const innings = ls.innings || [];
    html += '<div class="linescore-scroll"><table class="linescore-table"><thead><tr><th></th>';
    innings.forEach(function(inn) {
      html += "<th>" + inn.num + "</th>";
    });
    html += '<th class="rhe-start">R</th><th>H</th><th>E</th></tr></thead><tbody>';
    html += "<tr><td>" + away.team.teamName + "</td>";
    innings.forEach(function(inn) {
      html += "<td>" + (inn.away && inn.away.runs != null ? inn.away.runs : "\u2014") + "</td>";
    });
    html += '<td class="rhe rhe-start">' + (ls.teams && ls.teams.away && ls.teams.away.runs != null ? ls.teams.away.runs : "\u2014") + '</td><td class="rhe">' + (ls.teams && ls.teams.away && ls.teams.away.hits != null ? ls.teams.away.hits : "\u2014") + '</td><td class="rhe">' + (ls.teams && ls.teams.away && ls.teams.away.errors != null ? ls.teams.away.errors : "\u2014") + "</td></tr>";
    html += "<tr><td>" + home.team.teamName + "</td>";
    innings.forEach(function(inn) {
      html += "<td>" + (inn.home && inn.home.runs != null ? inn.home.runs : "\u2014") + "</td>";
    });
    html += '<td class="rhe rhe-start">' + (ls.teams && ls.teams.home && ls.teams.home.runs != null ? ls.teams.home.runs : "\u2014") + '</td><td class="rhe">' + (ls.teams && ls.teams.home && ls.teams.home.hits != null ? ls.teams.home.hits : "\u2014") + '</td><td class="rhe">' + (ls.teams && ls.teams.home && ls.teams.home.errors != null ? ls.teams.home.errors : "\u2014") + "</td></tr>";
    html += "</tbody></table></div>";
    html += '<button onclick="openScorecardOverlay(' + g.gamePk + ')" class="watch-live-btn sc-btn">\u{1F4CB} View Scorecard</button>';
    if (highlightUrl) {
      const highlightHeadline = highlight.headline || "Full Game Highlight";
      const safeUrl = highlightUrl.replace(/'/g, "\\'");
      html += '<div class="detail-highlight">';
      if (thumbUrl) {
        html += `<div onclick="playHighlightVideo(this,'` + safeUrl + `')" class="detail-highlight-thumb">`;
        html += '<img src="' + forceHttps(thumbUrl) + `" loading="lazy" onerror="this.style.display='none'">`;
        html += '<div class="detail-highlight-overlay">';
        html += '<div class="detail-highlight-play">';
        html += '<span class="detail-highlight-arrow">\u25B6</span></div></div></div>';
      } else {
        html += '<div class="detail-highlight-video"><video controls preload="none"><source src="' + highlightUrl + '" type="video/mp4"></video></div>';
      }
      html += '<div class="detail-highlight-meta"><div class="detail-highlight-kicker">Highlights</div><div class="detail-highlight-title">' + highlightHeadline + "</div></div>";
      html += "</div>";
    }
    html += "</div>";
    const awayAbbr = away.team.abbreviation || away.team.teamName, homeAbbr = home.team.abbreviation || home.team.teamName;
    const isHomeActive = state.activeTeam.id === home.team.id, activeAbbr = isHomeActive ? homeAbbr : awayAbbr, activeTeamName = isHomeActive ? home.team.teamName : away.team.teamName;
    const activePlayers = isHomeActive ? bs.teams && bs.teams.home && bs.teams.home.players ? bs.teams.home.players : {} : bs.teams && bs.teams.away && bs.teams.away.players ? bs.teams.away.players : {};
    const activeBox = buildBoxscore(activePlayers);
    html += '<div class="boxscore-wrap"><div class="detail-team-header">' + activeTeamName + "</div>";
    html += activeBox + "</div>";
    if (bs.info && bs.info.length) {
      html += '<div class="boxscore-wrap"><div class="game-note-label">Game Summary</div>';
      bs.info.forEach(function(item) {
        if (!item.value) return;
        const val = item.value.replace(/\.$/, "").trim();
        if (!item.label) html += '<div class="detail-summary-note">' + val + "</div>";
        else html += '<div class="detail-summary-row"><span class="detail-summary-label">' + item.label + "</span><span>" + val + "</span></div>";
      });
      html += "</div>";
    }
    const oppPlayers = isHomeActive ? bs.teams && bs.teams.away && bs.teams.away.players ? bs.teams.away.players : {} : bs.teams && bs.teams.home && bs.teams.home.players ? bs.teams.home.players : {};
    const oppBox = buildBoxscore(oppPlayers), oppTeamName = isHomeActive ? away.team.teamName : home.team.teamName;
    html += '<div class="boxscore-wrap"><div class="detail-team-header">' + oppTeamName + "</div>";
    html += oppBox + "</div>";
    html += "</div>";
    return html;
  }

  // src/sections/standings.js
  async function loadStandings() {
    document.getElementById("nlEast").innerHTML = '<div class="loading">Loading...</div>';
    try {
      const r = await fetch(MLB_BASE + "/standings?leagueId=103,104&standingsTypes=regularSeason&hydrate=team,division,league");
      const d = await r.json(), divMap = {};
      (d.records || []).forEach(function(rec) {
        divMap[rec.division.id] = { name: rec.division.name, league: rec.league.name, teams: rec.teamRecords };
      });
      renderDivStandings(divMap);
      renderNLWC(divMap);
      renderOtherDivWC(divMap);
      renderFullStandings(divMap);
      renderHomeStandings(divMap);
      document.getElementById("divTitle").textContent = "\u{1F525} " + state.activeTeam.division;
      document.getElementById("wcTitle").textContent = "\u{1F0CF} " + state.activeTeam.league + " Wild Card Race";
      document.getElementById("otherDivWCTitle").textContent = "\u{1F0CF} " + (state.activeTeam.league === "NL" ? "AL" : "NL") + " Wild Card Race";
      document.getElementById("homeDivTitle").textContent = state.activeTeam.division + " Snapshot";
    } catch (e) {
      ["nlEast", "nlWC", "otherDivWC", "fullStandings", "homeStandings"].forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="error">Could not load standings</div>';
      });
    }
  }
  function standingsTable(teams) {
    let html = '<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    teams.forEach(function(t, i) {
      const isActive = t.team.id === state.activeTeam.id;
      html += '<tr class="' + (isActive ? "active-row" : "") + '"><td>' + (i + 1) + "</td><td><strong>" + t.team.teamName + "</strong></td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.winningPercentage + "</td><td>" + t.gamesBack + "</td></tr>";
    });
    return html + "</tbody></table>";
  }
  function renderDivStandings(divMap) {
    const f = Object.values(divMap).find(function(d) {
      return d.name === state.activeTeam.division;
    });
    document.getElementById("nlEast").innerHTML = f ? standingsTable(f.teams) : '<div class="error">Division not found</div>';
  }
  function renderNLWC(divMap) {
    const league = state.activeTeam.league === "NL" ? "National League" : "American League";
    const leagueDivs = Object.values(divMap).filter(function(d) {
      return d.league === league;
    });
    const leaders = new Set(leagueDivs.map(function(d) {
      return d.teams[0] && d.teams[0].team.id;
    }));
    let allLeague = [];
    leagueDivs.forEach(function(d) {
      allLeague = allLeague.concat(d.teams);
    });
    const wc = allLeague.filter(function(t) {
      return !leaders.has(t.team.id);
    }).sort(function(a, b) {
      return parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage);
    }).slice(0, 9);
    const top = wc[0], topW = top ? top.wins : 0, topL = top ? top.losses : 0;
    let html = '<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    wc.forEach(function(t, i) {
      const isActive = t.team.id === state.activeTeam.id, gb = i === 0 ? "\u2014" : ((topW - t.wins + (t.losses - topL)) / 2).toFixed(1), cls = (isActive ? "active-row" : "") + (i === WC_SPOTS - 1 ? " wc-cutoff-row" : "");
      html += '<tr class="' + cls.trim() + '"><td>' + (i + 1) + "</td><td><strong>" + t.team.teamName + "</strong></td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.winningPercentage + "</td><td>" + gb + "</td></tr>";
    });
    html += '</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
    document.getElementById("nlWC").innerHTML = html;
  }
  function renderOtherDivWC(divMap) {
    const otherLeague = state.activeTeam.league === "NL" ? "American League" : "National League";
    const leagueDivs = Object.values(divMap).filter(function(d) {
      return d.league === otherLeague;
    });
    const leaders = new Set(leagueDivs.map(function(d) {
      return d.teams[0] && d.teams[0].team.id;
    }));
    const teams = [];
    leagueDivs.forEach(function(d) {
      d.teams.forEach(function(t) {
        if (!leaders.has(t.team.id)) teams.push(t);
      });
    });
    teams.sort(function(a, b) {
      return parseFloat(b.winningPercentage) - parseFloat(a.winningPercentage);
    });
    const top = teams[0], topW = top ? top.wins : 0, topL = top ? top.losses : 0;
    let html = '<table class="standings-table"><thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
    teams.slice(0, 9).forEach(function(t, i) {
      const gb = i === 0 ? "\u2014" : ((topW - t.wins + (t.losses - topL)) / 2).toFixed(1), cls = i === WC_SPOTS - 1 ? "wc-cutoff-row" : "";
      html += '<tr class="' + cls + '"><td>' + (i + 1) + "</td><td><strong>" + t.team.teamName + "</strong></td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.winningPercentage + "</td><td>" + gb + "</td></tr>";
    });
    html += '</tbody></table><div class="wc-cutoff-label">Wild Card cutoff</div>';
    document.getElementById("otherDivWC").innerHTML = html;
  }
  function renderFullStandings(divMap) {
    const al = Object.values(divMap).filter(function(d) {
      return d.league === "American League";
    }), nl = Object.values(divMap).filter(function(d) {
      return d.league === "National League";
    });
    const isNL = state.activeTeam.league === "NL", primary = isNL ? nl : al, secondary = isNL ? al : nl;
    const primarySorted = primary.slice().sort(function(a, b) {
      return a.name === state.activeTeam.division ? -1 : b.name === state.activeTeam.division ? 1 : 0;
    });
    let html = "";
    primarySorted.concat(secondary).forEach(function(div) {
      if (div.name === state.activeTeam.division) return;
      html += '<div class="div-header">' + div.name + '</div><table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th></tr></thead><tbody>';
      div.teams.forEach(function(t) {
        const isActive = t.team.id === state.activeTeam.id;
        html += '<tr class="' + (isActive ? "active-row" : "") + '"><td><strong>' + t.team.teamName + "</strong></td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.winningPercentage + "</td><td>" + t.gamesBack + "</td></tr>";
      });
      html += "</tbody></table>";
    });
    document.getElementById("fullStandings").innerHTML = html;
  }
  function renderHomeStandings(divMap) {
    const f = Object.values(divMap).find(function(d) {
      return d.name === state.activeTeam.division;
    });
    if (!f) {
      document.getElementById("homeStandings").innerHTML = '<div class="error">No data</div>';
      return;
    }
    let html = '<table class="standings-table"><thead><tr><th>Team</th><th>W</th><th>L</th><th>GB</th></tr></thead><tbody>';
    f.teams.forEach(function(t) {
      const isActive = t.team.id === state.activeTeam.id;
      html += '<tr class="' + (isActive ? "active-row" : "") + '"><td><strong>' + t.team.teamName + "</strong></td><td>" + t.wins + "</td><td>" + t.losses + "</td><td>" + t.gamesBack + "</td></tr>";
    });
    document.getElementById("homeStandings").innerHTML = html + "</tbody></table>";
  }

  // src/config/podcasts.js
  var TEAM_PODCASTS = {
    121: [
      // New York Mets
      { name: "The Mets Pod", id: 258864037 },
      { name: "Locked On Mets", id: 1457146683 },
      { name: "Talkin' Mets", id: 271866252 },
      { name: "Rico Brogna: A NY Mets Podcast", id: 1627097720 },
      { name: "Mets'd Up", id: 1559783548 }
    ],
    147: [
      // New York Yankees
      { name: "Talkin' Yanks", id: 1257957660 },
      { name: "Locked On Yankees", id: 1333234062 },
      { name: "New York Yankees Official Podcast", id: 1341153569 },
      { name: "Fireside Yankees", id: 1499018480 },
      { name: "Yanks Go Yard", id: 1524654922 }
    ],
    119: [
      // Los Angeles Dodgers
      { name: "Locked On Dodgers", id: 1457146003 },
      { name: "Dodgers Nation Podcast Network", id: 1385864210 },
      { name: "All Dodgers", id: 1723083767 },
      { name: "DodgerHeads", id: 1610389381 }
    ],
    111: [
      // Boston Red Sox
      { name: "Locked On Red Sox", id: 1456798246 },
      { name: "The Bradfo Sho", id: 1212715122 },
      { name: "Bastards of Boston Baseball", id: 1434494214 },
      { name: "Pod Sox", id: 1615428779 }
    ],
    112: [
      // Chicago Cubs
      { name: "CHGO Chicago Cubs Podcast", id: 1110183965 },
      { name: "Locked On Cubs", id: 1333234563 },
      { name: "North Side Territory", id: 1745774349 },
      { name: "Cubs Now", id: 1513391500 }
    ],
    144: [
      // Atlanta Braves
      { name: "Locked On Braves", id: 1382438394 },
      { name: "Battery Power", id: 1082214582 }
    ],
    143: [
      // Philadelphia Phillies
      { name: "Locked On Phillies", id: 1457620388 }
    ],
    117: [
      // Houston Astros
      { name: "Locked On Astros", id: 1457064404 },
      { name: "Houston Astros Podcast", id: 902521725 }
    ],
    137: [
      // San Francisco Giants
      { name: "Locked On Giants", id: 1455909225 },
      { name: "Splash Hit Territory", id: 1850386082 },
      { name: "Giants Splash", id: 1416246213 },
      { name: "Giants Talk", id: 1092247887 }
    ],
    138: [
      // St. Louis Cardinals
      { name: "Best Podcast in Baseball", id: 855518046 },
      { name: "Locked On Cardinals", id: 1371034395 },
      { name: "Cardinals Conversations", id: 1798227890 }
    ]
  };
  function fallbackPodcastTerm(teamName) {
    return teamName + " podcast";
  }

  // src/sections/home.js
  var homeCallbacks = { renderNextGame: null, teamCapImg: null };
  function setHomeCallbacks(cb) {
    Object.assign(homeCallbacks, cb);
  }
  var homeLiveTimer = null;
  function clearHomeTimer() {
    if (homeLiveTimer) {
      clearInterval(homeLiveTimer);
      homeLiveTimer = null;
    }
  }
  var selectedVideoId = null;
  var mediaVideos = [];
  var MLB_FALLBACK_UC = "UCoLrcjPV5PbUrUyXq5mjc_A";
  var podcastShows = [];
  var playingPodcastId = null;
  async function loadTodayGame() {
    if (homeLiveTimer) {
      clearInterval(homeLiveTimer);
      homeLiveTimer = null;
    }
    const today = etDateStr();
    document.getElementById("todayGame").innerHTML = '<div class="loading">Loading next game...</div>';
    try {
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&date=" + today + "&teamId=" + state.activeTeam.id + "&hydrate=linescore,team,seriesStatus,gameInfo");
      const d = await r.json(), todayGames = d.dates && d.dates[0] && d.dates[0].games ? d.dates[0].games : [];
      const liveGame = todayGames.find(function(g) {
        return g.status.abstractGameState === "Live" && g.status.detailedState !== "Warmup" && g.status.detailedState !== "Pre-Game";
      });
      const upcomingToday = todayGames.find(function(g) {
        return g.status.abstractGameState === "Preview" || g.status.abstractGameState === "Scheduled" || g.status.abstractGameState === "Live" && (g.status.detailedState === "Warmup" || g.status.detailedState === "Pre-Game");
      });
      const gameToRender = liveGame || upcomingToday;
      if (gameToRender && !state.scheduleData.length) {
        try {
          const gdEt = etDateStr(new Date(gameToRender.gameDate));
          const sr = await fetch(MLB_BASE + "/schedule?sportId=1&startDate=" + etDatePlus(gdEt, -7) + "&endDate=" + etDatePlus(gdEt, 7) + "&teamId=" + state.activeTeam.id + "&hydrate=team,linescore");
          const srd = await sr.json();
          (srd.dates || []).forEach(function(dt) {
            dt.games.forEach(function(g) {
              state.scheduleData.push(g);
            });
          });
        } catch (e) {
        }
      }
      if (liveGame) {
        document.getElementById("todayGame").innerHTML = homeCallbacks.renderNextGame(liveGame, "TODAY");
        homeLiveTimer = setInterval(loadTodayGame, TIMING.HOME_LIVE_MS);
        return;
      }
      if (upcomingToday) {
        document.getElementById("todayGame").innerHTML = homeCallbacks.renderNextGame(upcomingToday, "TODAY");
        return;
      }
      const endStr = etDatePlus(today, 14);
      const r2 = await fetch(MLB_BASE + "/schedule?sportId=1&startDate=" + today + "&endDate=" + endStr + "&teamId=" + state.activeTeam.id + "&hydrate=linescore,team,seriesStatus,gameInfo");
      let d2 = await r2.json(), nextGame = null;
      for (let i = 0; i < (d2.dates || []).length; i++) {
        const u = (d2.dates[i].games || []).find(function(g) {
          return g.status.abstractGameState === "Preview" || g.status.abstractGameState === "Scheduled";
        });
        if (u) {
          nextGame = u;
          break;
        }
      }
      if (!nextGame) {
        document.getElementById("todayGame").innerHTML = '<div class="game-big surface-hero"><div class="card-title">NEXT GAME</div><div class="empty-state">No upcoming games found</div></div>';
        return;
      }
      const gd = new Date(nextGame.gameDate), label = gd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
      document.getElementById("todayGame").innerHTML = homeCallbacks.renderNextGame(nextGame, label);
    } catch (e) {
      document.getElementById("todayGame").innerHTML = '<div class="error">Could not load next game</div>';
    }
  }
  async function loadNextGame() {
    document.getElementById("nextGame").innerHTML = '<div class="loading">Loading next series...</div>';
    try {
      const today = etDateStr();
      const endStr = etDatePlus(today, 28);
      const r = await fetch(MLB_BASE + "/schedule?sportId=1&startDate=" + today + "&endDate=" + endStr + "&teamId=" + state.activeTeam.id + "&hydrate=team,linescore,venue,probablePitcher");
      const d = await r.json(), allGames = [];
      (d.dates || []).forEach(function(dt) {
        dt.games.forEach(function(g) {
          allGames.push(g);
        });
      });
      const seriesList = [], used = /* @__PURE__ */ new Set();
      allGames.forEach(function(g) {
        if (used.has(g.gamePk)) return;
        const oppId = g.teams.home.team.id === state.activeTeam.id ? g.teams.away.team.id : g.teams.home.team.id;
        const venueId = g.venue && g.venue.id, gDate = new Date(g.gameDate);
        const group = allGames.filter(function(s) {
          if (used.has(s.gamePk)) return false;
          const sOpp = s.teams.home.team.id === state.activeTeam.id ? s.teams.away.team.id : s.teams.home.team.id;
          const sVenue = s.venue && s.venue.id, daysDiff = Math.abs((new Date(s.gameDate) - gDate) / 864e5);
          return sOpp === oppId && sVenue === venueId && daysDiff <= 4;
        }).sort(function(a, b) {
          return new Date(a.gameDate) - new Date(b.gameDate);
        });
        group.forEach(function(s) {
          used.add(s.gamePk);
        });
        seriesList.push(group);
      });
      let currentIdx = -1;
      for (let i = 0; i < seriesList.length; i++) {
        if (seriesList[i].some(function(g) {
          return g.status.abstractGameState !== "Final";
        })) {
          currentIdx = i;
          break;
        }
      }
      const nextSeries = currentIdx >= 0 && currentIdx + 1 < seriesList.length ? seriesList[currentIdx + 1] : null;
      if (!nextSeries || !nextSeries.length) {
        document.getElementById("nextGame").innerHTML = '<div class="game-big surface-hero"><div class="card-title">NEXT SERIES</div><div class="empty-state">No upcoming series found</div></div>';
        return;
      }
      const first = nextSeries[0], teamHome = first.teams.home.team.id === state.activeTeam.id, oppTeam = teamHome ? first.teams.away.team : first.teams.home.team;
      const oppD = TEAMS.find(function(t) {
        return t.id === oppTeam.id;
      }) || {};
      const oppPrimary = oppD.primary || "#333", oppSecondary = oppD.secondary || "#fff";
      const d1 = new Date(nextSeries[0].gameDate), d2 = new Date(nextSeries[nextSeries.length - 1].gameDate);
      let dateRange = d1.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
      if (nextSeries.length > 1) dateRange += " \u2014 " + d2.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
      const venue = first.venue && first.venue.name ? first.venue.name : "";
      const numGames = nextSeries.length;
      let html = '<div class="game-big surface-hero has-ghost">';
      html += homeCallbacks.teamCapImg(oppTeam.id, oppTeam.teamName, oppSecondary, oppPrimary, "series-ghost");
      html += '<div class="hero-content">';
      html += '<div class="hero-top-row">';
      html += '<div class="eyebrow eyebrow--accent">NEXT SERIES</div>';
      html += '<div class="hero-meta-right">' + dateRange + "</div></div>";
      html += '<div class="hero-opp-row">';
      html += homeCallbacks.teamCapImg(oppTeam.id, oppTeam.teamName, oppPrimary, oppSecondary);
      html += '<div><div class="eyebrow">' + (teamHome ? "VS" : "AT") + "</div>";
      html += '<div class="hero-opp-name">' + oppTeam.teamName.toUpperCase() + "</div>";
      html += '<div class="hero-opp-meta">' + (venue ? venue + " \xB7 " : "") + numGames + " game" + (teamHome ? " home series" : " road series") + "</div>";
      html += "</div></div>";
      html += '<div class="hero-day-strip">';
      nextSeries.forEach(function(g) {
        const status = g.status.abstractGameState, gDate = new Date(g.gameDate);
        const dayLabel = gDate.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
        const myT = g.teams.home.team.id === state.activeTeam.id ? g.teams.home : g.teams.away, oppT = g.teams.home.team.id === state.activeTeam.id ? g.teams.away : g.teams.home;
        html += '<div class="hero-day-cell">';
        html += '<div class="hero-day-label">' + dayLabel + "</div>";
        if (status === "Final") {
          const w = myT.isWinner;
          html += '<span class="badge ' + (w ? "badge-w" : "badge-l") + '" style="font-size:.62rem">' + (w ? "W" : "L") + " " + myT.score + "-" + oppT.score + "</span>";
        } else if (status === "Live") {
          html += '<div class="hero-day-live"><span class="matchup-live-dot"></span>LIVE</div><div class="hero-day-score">' + myT.score + "-" + oppT.score + "</div>";
        } else {
          html += '<div class="hero-day-time">' + gDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) + "</div>";
        }
        html += "</div>";
      });
      html += "</div></div></div>";
      document.getElementById("nextGame").innerHTML = html;
    } catch (e) {
      document.getElementById("nextGame").innerHTML = '<div class="error">Could not load next series</div>';
    }
  }
  async function loadHomeInjuries() {
    const el = document.getElementById("homeInjuries");
    if (!el) return;
    el.innerHTML = '<div class="loading">Loading injuries...</div>';
    try {
      let ilDays = function(p) {
        const s = (p.status && p.status.code || "") + " " + (p.status && p.status.description || "");
        const m = s.match(/\d+/);
        return m ? parseInt(m[0], 10) : 999;
      };
      const r = await fetch(MLB_BASE + "/teams/" + state.activeTeam.id + "/roster?rosterType=40Man&date=" + etDateStr());
      const d = await r.json(), roster = d.roster || [];
      const il = roster.filter(function(p) {
        if (!p.status) return false;
        const code = p.status.code || "", desc = p.status.description || "";
        return /^D\d/i.test(code) || /injured list|disabled list|\bil\b/i.test(desc);
      });
      if (!il.length) {
        el.innerHTML = '<div class="empty-state">No players on the IL</div>';
        return;
      }
      il.sort(function(a, b) {
        return ilDays(a) - ilDays(b) || (a.person && a.person.fullName || "").localeCompare(b.person && b.person.fullName || "");
      });
      let html = '<div class="home-roster-list">';
      il.forEach(function(p) {
        const name = escapeNewsHtml(p.person && p.person.fullName || "\u2014");
        const pos = escapeNewsHtml(p.position && p.position.abbreviation || "");
        const desc = escapeNewsHtml(p.status && p.status.description || "Injured List");
        html += '<div class="home-roster-row"><div class="home-roster-main">' + name + (pos ? '<span class="home-roster-pos">' + pos + "</span>" : "") + '</div><div class="home-roster-sub">' + desc + "</div></div>";
      });
      el.innerHTML = html + "</div>";
    } catch (e) {
      el.innerHTML = '<div class="error">Could not load injuries</div>';
    }
  }
  async function loadHomeMoves() {
    const el = document.getElementById("homeMoves");
    if (!el) return;
    el.innerHTML = '<div class="loading">Loading roster moves...</div>';
    try {
      const end = etDateStr(), start = etDatePlus(end, -30);
      const r = await fetch(MLB_BASE + "/transactions?teamId=" + state.activeTeam.id + "&startDate=" + start + "&endDate=" + end);
      let d = await r.json(), tx = (d.transactions || []).slice();
      if (!tx.length) {
        el.innerHTML = '<div class="empty-state">No roster moves in the last 30 days</div>';
        return;
      }
      tx.sort(function(a, b) {
        return new Date(b.date || b.effectiveDate || 0) - new Date(a.date || a.effectiveDate || 0);
      });
      tx = tx.slice(0, 15);
      let html = '<div class="home-roster-list">';
      tx.forEach(function(x) {
        const dt = x.date || x.effectiveDate;
        const dlabel = dt ? (/* @__PURE__ */ new Date(dt + "T12:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
        const desc = escapeNewsHtml(x.description || x.typeDesc || "Transaction");
        html += '<div class="home-roster-row"><div class="home-roster-main">' + desc + '</div><div class="home-roster-sub">' + escapeNewsHtml(dlabel) + "</div></div>";
      });
      el.innerHTML = html + "</div>";
    } catch (e) {
      el.innerHTML = '<div class="error">Could not load roster moves</div>';
    }
  }
  async function loadHomeYoutubeWidget() {
    const uc = state.activeTeam.youtubeUC || MLB_FALLBACK_UC, teamName = state.activeTeam.youtubeUC ? state.activeTeam.name : "MLB", channelUrl = "https://www.youtube.com/channel/" + uc;
    const themeTeam = state.themeOverride || state.activeTeam, bannerColor = state.themeInvert ? themeTeam.secondary : themeTeam.primary;
    const grad = "background:linear-gradient(135deg," + bannerColor + " 0%,var(--dark) 100%)";
    document.getElementById("homeYoutubeHeader").innerHTML = '<div style="' + grad + ';border-radius:12px 12px 0 0;padding:16px 20px;display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">\u{1F4FA} Official Channel</div><div style="font-size:1.1rem;font-weight:800;color:#fff">' + teamName + '</div></div><a href="' + channelUrl + '" target="_blank" style="font-size:.78rem;color:rgba(255,255,255,.7);text-decoration:none;border:1px solid rgba(255,255,255,.3);padding:5px 12px;border-radius:6px">Open in YouTube \u2197</a></div>';
    await loadMediaFeed(uc);
  }
  async function loadMediaFeed(uc) {
    const listEl = document.getElementById("homeYoutubeList");
    try {
      const r = await fetch(API_BASE + "/api/proxy-youtube?channel=" + encodeURIComponent(uc));
      if (!r.ok) throw new Error("HTTP " + r.status);
      const json = await r.json();
      if (!json.success || !json.videos || !json.videos.length) throw new Error(json.message || "No videos");
      mediaVideos = json.videos;
      renderMediaList();
      selectMediaVideo(mediaVideos[0].videoId);
    } catch (e) {
      if (listEl) listEl.innerHTML = '<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load videos: ' + e.message + "</div>";
    }
  }
  function renderMediaList() {
    const listEl = document.getElementById("homeYoutubeList");
    if (!listEl) return;
    let html = "";
    mediaVideos.forEach(function(v) {
      const sel = v.videoId === selectedVideoId;
      const thumbUrl = v.thumb ? forceHttps(v.thumb) : "";
      html += `<div onclick="selectMediaVideo('` + v.videoId + `')" style="cursor:pointer;padding:10px;border-bottom:1px solid var(--border);background:` + (sel ? "color-mix(in srgb,var(--accent) 12%,transparent)" : "transparent") + ";" + (sel ? "border-left:3px solid var(--accent)" : "border-left:3px solid transparent") + '"><img src="' + thumbUrl + `" style="width:100%;border-radius:4px;margin-bottom:6px;display:block" loading="lazy" onerror="this.style.display='none'"/><div style="font-size:.72rem;font-weight:600;color:` + (sel ? "var(--accent)" : "var(--text)") + ';line-height:1.3;margin-bottom:3px">' + v.title + '</div><div style="font-size:.65rem;color:var(--muted)">' + v.date + "</div></div>";
    });
    listEl.innerHTML = html;
  }
  function selectMediaVideo(videoId) {
    const stopAllMedia2 = window.stopAllMedia;
    if (stopAllMedia2) stopAllMedia2("youtube");
    selectedVideoId = videoId;
    const player = document.getElementById("homeYoutubePlayer");
    if (player) player.src = "https://www.youtube-nocookie.com/embed/" + videoId + "?rel=0&enablejsapi=1";
    renderMediaList();
  }
  async function loadHomePodcastWidget() {
    const team = state.activeTeam, curated = TEAM_PODCASTS[team.id];
    const themeTeam = state.themeOverride || state.activeTeam, bannerColor = state.themeInvert ? themeTeam.secondary : themeTeam.primary;
    const grad = "background:linear-gradient(135deg," + bannerColor + " 0%,var(--dark) 100%)";
    const hdr = document.getElementById("homePodcastHeader");
    if (hdr) hdr.innerHTML = '<div style="' + grad + ';border-radius:12px 12px 0 0;padding:16px 20px"><div style="font-size:.7rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:2px">\u{1F399}\uFE0F Team Podcasts</div><div style="font-size:1.1rem;font-weight:800;color:#fff">' + escapeNewsHtml(team.name) + "</div></div>";
    const stripEl = document.getElementById("homePodcastStrip");
    if (stripEl) stripEl.innerHTML = '<div class="loading" style="padding:16px">Loading podcasts...</div>';
    const pl = document.getElementById("homePodcastPlayer");
    if (pl) pl.innerHTML = "";
    podcastShows = [];
    playingPodcastId = null;
    try {
      const term = encodeURIComponent(fallbackPodcastTerm(team.name));
      const url = API_BASE + "/api/proxy-podcast?term=" + term + (curated ? "&ids=" + curated.map(function(p) {
        return p.id;
      }).join(",") : "");
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);
      const json = await r.json();
      if (!json.success || !json.shows || !json.shows.length) throw new Error(json.message || "No podcasts");
      podcastShows = json.shows;
      renderPodcastStrip();
    } catch (e) {
      if (stripEl) stripEl.innerHTML = '<div class="error" style="padding:12px;color:var(--muted);font-size:.9rem">Could not load podcasts: ' + e.message + "</div>";
    }
  }
  function renderPodcastStrip() {
    const stripEl = document.getElementById("homePodcastStrip");
    if (!stripEl) return;
    let html = "";
    podcastShows.forEach(function(s) {
      const on = s.collectionId === playingPodcastId;
      const art = s.artwork ? forceHttps(s.artwork) : "";
      html += '<div class="podcast-icon' + (on ? " playing" : "") + '" onclick="playPodcast(' + s.collectionId + ')" title="' + escapeNewsHtml(s.name) + '"><div class="podcast-icon-art"><img src="' + art + `" loading="lazy" onerror="this.style.visibility='hidden'"/>` + (on ? '<span class="podcast-icon-eq">\u25AE\u25AE\u25AE</span>' : '<span class="podcast-icon-play">\u25B6</span>') + '</div><div class="podcast-icon-name">' + escapeNewsHtml(s.name) + "</div></div>";
    });
    stripEl.innerHTML = html;
  }
  function playPodcast(collectionId) {
    const show = podcastShows.find(function(s) {
      return s.collectionId === collectionId;
    });
    if (!show || !show.audioUrl) return;
    const stopAllMedia2 = window.stopAllMedia;
    if (stopAllMedia2) stopAllMedia2("podcast");
    playingPodcastId = collectionId;
    const pl = document.getElementById("homePodcastPlayer");
    if (pl) {
      const art = show.artwork ? forceHttps(show.artwork) : "";
      pl.innerHTML = '<div class="podcast-now"><img class="podcast-now-art" src="' + art + `" onerror="this.style.visibility='hidden'"/><div class="podcast-now-meta"><div class="podcast-now-show">` + escapeNewsHtml(show.name) + '</div><div class="podcast-now-ep">' + escapeNewsHtml(show.episodeTitle || "Latest episode") + (show.date ? " \xB7 " + escapeNewsHtml(show.date) : "") + '</div><audio id="homePodcastAudio" controls autoplay preload="none" style="width:100%;margin-top:8px"></audio></div></div>';
      const a = document.getElementById("homePodcastAudio");
      if (a) {
        a.src = show.audioUrl;
        const p = a.play();
        if (p && p.catch) p.catch(function() {
        });
      }
    }
    renderPodcastStrip();
  }
  function stopPodcast() {
    const a = document.getElementById("homePodcastAudio");
    if (a && !a.paused) a.pause();
  }

  // src/auth/oauth.js
  function signInWithGitHub() {
    const state2 = Math.random().toString(36).slice(2, 15);
    const githubAuthUrl = "https://github.com/login/oauth/authorize?client_id=Ov23lilv8CB5JzyvevZE&redirect_uri=" + encodeURIComponent(window.location.origin + "/api/auth/github") + "&state=" + state2 + "&scope=user:email";
    window.location = githubAuthUrl;
  }
  function signInWithEmail() {
    const email = prompt("Enter your email to receive a sign-in link:");
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return alert("Invalid email");
    }
    fetch((API_BASE || "") + "/api/auth/email-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    }).then((r) => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then((d) => {
      if (d.error) alert("Error: " + d.error);
      else alert(d.message);
    }).catch((e) => alert("Network error: " + (e && e.message || e)));
  }

  // src/nav/sheet.js
  var SECTION_LABELS = {
    pulse: "PULSE",
    home: "MY TEAM",
    schedule: "SCHEDULE",
    league: "LEAGUE",
    news: "NEWS",
    standings: "STANDINGS",
    stats: "STATS"
  };
  function openMoreSheet() {
    const sheet = document.getElementById("moreSheet");
    const back = document.getElementById("moreSheetBackdrop");
    if (!sheet || !back) return;
    sheet.classList.add("open");
    back.classList.add("open");
  }
  function closeMoreSheet() {
    const sheet = document.getElementById("moreSheet");
    const back = document.getElementById("moreSheetBackdrop");
    if (!sheet || !back) return;
    sheet.classList.remove("open");
    back.classList.remove("open");
  }
  function toggleMoreSheet() {
    const sheet = document.getElementById("moreSheet");
    if (!sheet) return;
    if (sheet.classList.contains("open")) closeMoreSheet();
    else openMoreSheet();
  }
  function openPulseOverflow() {
    const sheet = document.getElementById("pulseOverflowSheet");
    const back = document.getElementById("pulseOverflowBackdrop");
    if (!sheet || !back) return;
    sheet.classList.add("open");
    back.classList.add("open");
  }
  function closePulseOverflow() {
    const sheet = document.getElementById("pulseOverflowSheet");
    const back = document.getElementById("pulseOverflowBackdrop");
    if (!sheet || !back) return;
    sheet.classList.remove("open");
    back.classList.remove("open");
  }
  function togglePulseOverflow() {
    const sheet = document.getElementById("pulseOverflowSheet");
    if (!sheet) return;
    if (sheet.classList.contains("open")) closePulseOverflow();
    else openPulseOverflow();
  }
  function openPulseShortcuts() {
    const sheet = document.getElementById("pulseShortcuts");
    const back = document.getElementById("pulseShortcutsBackdrop");
    if (!sheet || !back) return;
    sheet.classList.add("open");
    back.classList.add("open");
  }
  function closePulseShortcuts() {
    const sheet = document.getElementById("pulseShortcuts");
    const back = document.getElementById("pulseShortcutsBackdrop");
    if (!sheet || !back) return;
    sheet.classList.remove("open");
    back.classList.remove("open");
  }
  function updateHeaderCrumb(sectionId) {
    const el = document.getElementById("headerCrumb");
    if (!el) return;
    el.textContent = SECTION_LABELS[sectionId] || sectionId.toUpperCase();
  }
  function installMoreSheetEscClose() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeMoreSheet();
      closePulseOverflow();
      closePulseShortcuts();
    });
  }

  // src/nav/behavior.js
  var HIDE_THRESHOLD_DELTA = 4;
  var SHOW_NEAR_TOP = 40;
  var lastScrollY = 0;
  var scrollTicking = false;
  function installHideOnScroll() {
    const nav = document.querySelector("nav");
    if (!nav) return;
    lastScrollY = window.scrollY;
    window.addEventListener("scroll", () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollY;
        if (delta < 0 || y < SHOW_NEAR_TOP) {
          nav.classList.remove("nav-hidden");
        } else if (delta > HIDE_THRESHOLD_DELTA) {
          nav.classList.add("nav-hidden");
        }
        lastScrollY = y;
        scrollTicking = false;
      });
    }, { passive: true });
  }
  var scrollMemory = /* @__PURE__ */ new Map();
  function captureScroll(sectionId) {
    if (!sectionId) return;
    scrollMemory.set(sectionId, window.scrollY);
  }
  function restoreScroll(sectionId) {
    const y = scrollMemory.get(sectionId) || 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  var hashRouterInstalled = false;
  var suppressHashChange = false;
  function syncHash(sectionId) {
    if (!sectionId) return;
    const target = "#" + sectionId;
    if (location.hash === target) return;
    suppressHashChange = true;
    history.replaceState(null, "", target);
    setTimeout(() => {
      suppressHashChange = false;
    }, 0);
  }
  function installHashRouter(showSectionFn) {
    if (hashRouterInstalled) return;
    hashRouterInstalled = true;
    window.addEventListener("hashchange", () => {
      if (suppressHashChange) return;
      const id = location.hash.slice(1);
      if (!id) return;
      if (!document.getElementById(id)) return;
      const btn = document.querySelector('nav button[data-section="' + id + '"]');
      showSectionFn(id, btn || void 0);
    });
    const initial = location.hash.slice(1);
    if (initial && initial !== "pulse" && document.getElementById(initial)) {
      requestAnimationFrame(() => {
        const btn = document.querySelector('nav button[data-section="' + initial + '"]');
        showSectionFn(initial, btn || void 0);
      });
    }
  }
  function ensureNavDot(btn) {
    let dot = btn.querySelector(".nav-dot");
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "nav-dot";
      btn.appendChild(dot);
    }
    return dot;
  }
  function setNavDot(sectionName, kind) {
    const btn = document.querySelector('nav button[data-section="' + sectionName + '"]');
    if (!btn) return;
    const dot = ensureNavDot(btn);
    dot.classList.toggle("live", kind === "live");
    dot.classList.toggle("fresh", kind === "fresh");
  }
  function clearNavDot(sectionName) {
    setNavDot(sectionName, null);
  }
  function refreshNavDots() {
    if (!state.activeTeam || !state.gameStates) {
      clearNavDot("schedule");
      return;
    }
    const teamId = state.activeTeam.id;
    const games = Object.values(state.gameStates);
    const myLive = games.some(function(g) {
      if (!g) return false;
      if (g.awayId !== teamId && g.homeId !== teamId) return false;
      if (g.detailedState === "Warmup" || g.detailedState === "Pre-Game") return false;
      return g.status === "Live";
    });
    setNavDot("schedule", myLive ? "live" : null);
  }
  var navDotsTimer = null;
  function installNavDotsRefresh(intervalMs) {
    if (navDotsTimer) clearInterval(navDotsTimer);
    refreshNavDots();
    navDotsTimer = setInterval(refreshNavDots, intervalMs || 3e4);
  }
  function attachLongPress(el, handler, ms) {
    if (!el || typeof handler !== "function") return;
    const delay = ms || 500;
    let timer = null;
    let pressed = false;
    function start(e) {
      pressed = true;
      timer = setTimeout(function() {
        if (!pressed) return;
        try {
          navigator.vibrate && navigator.vibrate(8);
        } catch (err) {
        }
        handler(e);
      }, delay);
    }
    function cancel() {
      pressed = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchend", cancel, { passive: true });
    el.addEventListener("touchmove", cancel, { passive: true });
    el.addEventListener("touchcancel", cancel, { passive: true });
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", cancel);
    el.addEventListener("mouseleave", cancel);
  }
  function installNavLongPress(handlers) {
    const map = handlers || {};
    document.querySelectorAll("nav button[data-section]").forEach(function(btn) {
      const section = btn.getAttribute("data-section");
      const h = map[section];
      if (typeof h === "function") attachLongPress(btn, h);
    });
  }
  function installNavClicks(showSectionFn) {
    const nav = document.querySelector("header nav");
    if (!nav) return;
    nav.addEventListener("click", function(e) {
      const btn = e.target.closest("button[data-section]");
      if (!btn) return;
      const section = btn.getAttribute("data-section");
      if (section && document.getElementById(section)) showSectionFn(section, btn);
    });
  }

  // src/push/push.js
  var VAPID_PUBLIC_KEY = "BPI_UHKC-1UI9uIacuEooLwnRaRcGgIf1tji_5PiNhr6lcpQrgs2PqKyhfdhsYtxSxaUaENoAiZ7781iBvOlZWE";
  function urlBase64ToUint8Array(b64) {
    const pad = "=".repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }
  async function subscribeToPush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      const r = await fetch((API_BASE || "") + "/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub)
      });
      if (!r.ok) throw new Error("HTTP " + r.status + ": subscription failed");
      localStorage.setItem("mlb_push", "1");
      document.getElementById("pushStatusText").textContent = "On";
    } catch (err) {
      const pt = document.getElementById("pushToggle");
      pt.style.background = "var(--border)";
      pt.setAttribute("aria-checked", "false");
      document.getElementById("pushToggleKnob").style.left = "3px";
      document.getElementById("pushStatusText").textContent = "Permission Denied";
    }
  }
  async function unsubscribeFromPush() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const r = await fetch((API_BASE || "") + "/api/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        if (!r.ok) throw new Error("HTTP " + r.status + ": unsubscription failed");
      }
    } catch (e) {
    }
    localStorage.removeItem("mlb_push");
    document.getElementById("pushStatusText").textContent = "Off";
  }
  function togglePush() {
    const tog = document.getElementById("pushToggle");
    const knob = document.getElementById("pushToggleKnob");
    const enabled = localStorage.getItem("mlb_push") === "1";
    if (!enabled) {
      if (!("serviceWorker" in navigator && "PushManager" in window)) {
        document.getElementById("pushStatusText").textContent = "Not Supported On This Browser";
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        document.getElementById("pushStatusText").textContent = "Push Not Configured Yet";
        return;
      }
      tog.style.background = "var(--secondary)";
      knob.style.left = "21px";
      tog.setAttribute("aria-checked", "true");
      subscribeToPush();
    } else {
      tog.style.background = "var(--border)";
      knob.style.left = "3px";
      tog.setAttribute("aria-checked", "false");
      unsubscribeFromPush();
    }
  }

  // src/main.js
  devTrace("boot", "bundle loaded \xB7 " + (/* @__PURE__ */ new Date()).toISOString());
  var devTuningDefaults = {
    rotateMs: 4500,
    rbiThreshold: 10,
    rbiCooldown: 9e4,
    hr_priority: 100,
    hr_cooldown: 3e5,
    biginning_priority: 75,
    biginning_threshold: 3,
    walkoff_priority: 90,
    walkoff_cooldown: 3e5,
    nohitter_inning_floor: 6,
    nohitter_priority: 95,
    basesloaded_enable: true,
    basesloaded_priority: 88,
    focus_critical: 120,
    focus_high: 70,
    focus_switch_margin: 25,
    focus_alert_cooldown: 9e4,
    hitstreak_floor: 10,
    hitstreak_priority: 65,
    roster_priority_il: 40,
    roster_priority_trade: 55,
    wp_leverage_floor: 2,
    wp_extreme_floor: 85,
    award_priority: 55,
    highlow_priority: 25,
    livewp_priority: 30,
    livewp_refresh_ms: 9e4
  };
  async function fetchBoxscore(gamePk) {
    if (state.demoMode) {
      const snaps = state.boxscoreSnapshots[gamePk] || [];
      const nowMs = state.demoCurrentTime || 0;
      for (let i = snaps.length - 1; i >= 0; i--) {
        if (snaps[i].ts <= nowMs) return snaps[i].data;
      }
      return null;
    }
    if (!state.boxscoreCache[gamePk]) {
      try {
        const bsR = await fetch(MLB_BASE + "/game/" + gamePk + "/boxscore");
        if (!bsR.ok) throw new Error(bsR.status);
        state.boxscoreCache[gamePk] = await bsR.json();
        if (typeof window !== "undefined" && window.Recorder && window.Recorder.active) {
          window.Recorder._captureBoxscore(gamePk, state.boxscoreCache[gamePk]);
        }
      } catch (e) {
        return null;
      }
    }
    return state.boxscoreCache[gamePk];
  }
  function initLeaguePulse() {
    devTrace("pulse", "initLeaguePulse \xB7 first nav to Pulse");
    initReal();
  }
  function initReal() {
    const _verEl = document.querySelector(".settings-version[data-version]");
    if (_verEl) _verEl.textContent = "v" + (true ? "4.31.2" : "?");
    setCarouselCallbacks({ updateFeedEmpty, fetchBoxscore, localDateStr, getEffectiveDate, tcLookup });
    setRotationCallbacks({ refreshDebugPanel });
    setSyncCallbacks({ loadCollection, saveCollection, updateCollectionUI });
    setThemeCallbacks({ loadTodayGame, loadNextGame, loadNews, loadStandings, loadRoster, loadTeamStats, loadHomeInjuries, loadHomeMoves, loadHomeYoutubeWidget, loadHomePodcastWidget, applyMyTeamLens, clearHomeLiveTimer: clearHomeTimer });
    setFeedCallbacks({ localDateStr });
    setHomeCallbacks({ renderNextGame, teamCapImg });
    setLeagueCallbacks({ teamCapImg });
    setRadioCheckCallbacks({ toggleSettings });
    setYoutubeDebugCallbacks({ loadHomeYoutubeWidget });
    setPanelsCallbacks({ buildStoryPool });
    initPanelsLazyRendering();
    initDevToolsClickDelegator();
    setOverlayCallbacks({ flashCollectionRailMessage });
    setBookCallbacks({
      showSignInCTA,
      showPlayerCard,
      showRBICard,
      // Was a local /stats/leaders cache from loadLeagueLeaders. Removed in
      // v4.8.7 when League Leaders started reading from state.leagueLeaders. This
      // synthesizes the old {hitting:{cat:[{person,team,...}]}} shape so the
      // test-card pool (book.js:addLeadersFromMap) keeps working.
      getLeagueLeadersCache: function() {
        const out = { hitting: {}, pitching: {} };
        const cache = state.leagueLeaders || {};
        Object.keys(cache).forEach(function(key) {
          const i = key.indexOf(":");
          if (i < 0) return;
          const grp = key.slice(0, i), cat = key.slice(i + 1);
          if (!out[grp]) return;
          out[grp][cat] = (cache[key] || []).map(function(l) {
            return {
              person: { id: l.playerId, fullName: l.playerName },
              team: { id: l.teamId },
              value: l.value
            };
          });
        });
        return out;
      }
    });
    setPlayerCardCallbacks({
      fetchBoxscore,
      collectCard
    });
    setPollCallbacks({
      pruneStaleGames,
      refreshDebugPanel,
      updateInningStates,
      localDateStr
    });
    setTuningCallbacks({
      refreshDebugPanel,
      devTuningDefaults
    });
    const mockBar = document.getElementById("mockBar");
    if (mockBar) {
      mockBar.style.display = "none";
      mockBar.style.setProperty("display", "none", "important");
    }
    if (!state.demoMode && etHour() < 6) {
      state.pollDateStr = etDatePlus(etDateStr(), -1);
    } else {
      state.pollDateStr = localDateStr(getEffectiveDate());
    }
    loadRoster();
    loadOnThisDayCache();
    loadYesterdayCache();
    loadTransactionsCache();
    loadHighLowCache();
    loadPulseNews();
    loadBaseballBuzz();
    document.removeEventListener("visibilitychange", onStoryVisibilityChange);
    document.addEventListener("visibilitychange", onStoryVisibilityChange);
    pollLeaguePulse().then(function() {
      buildStoryPool();
      setFocusGame(state.focusGamePk);
      if (typeof window !== "undefined" && typeof window.dismissAppSplash === "function") window.dismissAppSplash();
    }).catch(function(e) {
      console.error("[boot] pollLeaguePulse error", e);
    });
    state.pulseTimer = setInterval(pollLeaguePulse, TIMING.PULSE_POLL_MS);
    if (state.storyPoolTimer) {
      clearInterval(state.storyPoolTimer);
      state.storyPoolTimer = null;
    }
    state.storyPoolTimer = setInterval(buildStoryPool, TIMING.STORY_POOL_MS);
    if (state.videoClipPollTimer) {
      clearInterval(state.videoClipPollTimer);
      state.videoClipPollTimer = null;
    }
    state.videoClipPollTimer = setInterval(pollPendingVideoClips, 30 * 1e3);
    if (state.newsRefreshTimer) {
      clearInterval(state.newsRefreshTimer);
      state.newsRefreshTimer = null;
    }
    state.newsRefreshTimer = setInterval(loadPulseNews, TIMING.NEWS_REFRESH_MS);
    if (state.buzzRefreshTimer) {
      clearInterval(state.buzzRefreshTimer);
      state.buzzRefreshTimer = null;
    }
    state.buzzRefreshTimer = setInterval(function() {
      loadBaseballBuzz(true);
    }, TIMING.BUZZ_REFRESH_MS);
    if (state.yesterdayRefreshTimer) {
      clearInterval(state.yesterdayRefreshTimer);
      state.yesterdayRefreshTimer = null;
    }
    state.yesterdayRefreshTimer = setInterval(function() {
      loadYesterdayCache().then(function() {
        const ydCard = document.getElementById("yesterdayCard");
        if (ydCard && ydCard.offsetParent !== null) renderYesterdayRecap();
      }).catch(function(e) {
        console.error("[boot] loadYesterdayCache error", e);
      });
    }, TIMING.YESTERDAY_REFRESH_MS);
  }
  function updateInningStates() {
  }
  function refreshDebugPanel() {
    const panel = document.getElementById("debugPanel");
    if (!panel) return;
    const now = Date.now();
    const gameStatesArr = Object.values(state.gameStates);
    const liveCount = gameStatesArr.filter(function(g) {
      return g.status === "Live";
    }).length;
    const finalCount = gameStatesArr.filter(function(g) {
      return g.status === "Final";
    }).length;
    const previewCount = gameStatesArr.filter(function(g) {
      return g.status === "Preview" || g.status === "Scheduled";
    }).length;
    const tier1 = state.storyPool.filter(function(s) {
      return s.tier === 1;
    }).length;
    const tier2 = state.storyPool.filter(function(s) {
      return s.tier === 2;
    }).length;
    const tier3 = state.storyPool.filter(function(s) {
      return s.tier === 3;
    }).length;
    const tier4 = state.storyPool.filter(function(s) {
      return s.tier === 4;
    }).length;
    let nextPollIn = Math.round((1042 - Date.now()) % 15e3 / 1e3);
    if (nextPollIn < 0) nextPollIn += 15;
    const nextRotateIn = state.storyRotateTimer ? Math.round((state.devTuning.rotateMs - now % (state.devTuning.rotateMs || 2e4)) / 1e3) : "\u2014";
    let html = '<div style="padding:0;line-height:1.6">';
    html += '<div style="font-weight:600;margin-bottom:6px;color:var(--accent)">\u{1F4CA} Service Health</div>';
    html += "<div>Polls active: " + Object.keys(state.gameStates).length + "</div>";
    html += "<div>Live/Final/Preview: " + liveCount + " / " + finalCount + " / " + previewCount + "</div>";
    html += "<div>Feed items: " + state.feedItems.length + "</div>";
    html += "<div>Next poll in: " + nextPollIn + "s</div>";
    html += '<div style="margin-top:8px;font-weight:600;color:var(--accent)">\u{1F4BE} Caches</div>';
    html += "<div>On This Day: " + (state.onThisDayCache ? state.onThisDayCache.length + " stories" : "loading\u2026") + "</div>";
    html += "<div>Yesterday: " + (state.yesterdayCache ? state.yesterdayCache.length + " stories" : "loading\u2026") + "</div>";
    html += "<div>Daily Leaders: " + (state.dailyLeadersCache ? "loaded" : "loading\u2026") + "</div>";
    html += '<div style="margin-top:8px;font-weight:600;color:var(--accent)">\u{1F3AF} Story Pool (' + state.storyPool.length + ")</div>";
    html += "<div>Tier 1/2/3/4: " + tier1 + " / " + tier2 + " / " + tier3 + " / " + tier4 + "</div>";
    html += "<div>Rotation active: " + (state.storyRotateTimer ? "yes" : "no") + "</div>";
    html += "<div>Next rotate in: " + nextRotateIn + "s</div>";
    html += '<div style="margin-top:8px;font-weight:600;color:var(--accent);margin-bottom:4px">All Stories (' + state.storyPool.length + ")</div>";
    if (state.storyPool.length) {
      state.storyPool.forEach(function(s, idx) {
        const cooldownRemain = s.lastShown ? Math.max(0, Math.round((s.cooldownMs - (now - s.lastShown.getTime())) / 1e3)) : "\u2014";
        const age = Math.round((now - s.ts.getTime()) / 1e3);
        const ageStr = age < 60 ? age + "s" : Math.floor(age / 60) + "m";
        const decay = Math.pow(Math.max(0, 1 - s.decayRate), age / 6e4 / 30);
        const score = s.priority * decay;
        const shownStr = s.lastShown ? "shown " + Math.floor((now - s.lastShown.getTime()) / 1e3) + "s ago" : "never";
        const isCurrent = s.id === state.storyShownId ? " \u2605" : "";
        html += '<div style="margin-top:4px;padding:4px;background:rgba(255,255,255,0.04);border-radius:4px;border-left:2px solid var(--border)"><span style="color:var(--accent)">[' + (idx + 1) + "] T" + s.tier + isCurrent + "</span> " + s.headline.substring(0, 50) + '<br/><span style="color:var(--muted);font-size:0.9em">' + s.type + " \xB7 pri " + Math.round(score) + " \xB7 " + ageStr + " old \xB7 cooldown " + cooldownRemain + "s \xB7 " + shownStr + "</span></div>";
      });
    } else {
      html += '<div style="color:var(--muted)">No stories yet</div>';
    }
    html += "</div>";
    panel.innerHTML = html;
  }
  function localDateStr(d) {
    return etDateStr(d);
  }
  function pruneStaleGames(beforeDateStr) {
    Object.keys(state.gameStates).forEach(function(pk) {
      const g = state.gameStates[pk];
      if (g.status !== "Final" || !g.gameDateMs) return;
      const gDate = localDateStr(new Date(g.gameDateMs));
      if (gDate < beforeDateStr) {
        delete state.gameStates[pk];
        state.enabledGames.delete(+pk);
      }
    });
    state.feedItems = state.feedItems.filter(function(fi) {
      return state.gameStates[fi.gamePk] !== void 0;
    });
    state.stolenBaseEvents = state.stolenBaseEvents.filter(function(sb) {
      return state.gameStates[sb.gamePk] !== void 0;
    });
    state.actionEvents = state.actionEvents.filter(function(ae) {
      return state.gameStates[ae.gamePk] !== void 0;
    });
    state.dailyHitsTracker = {};
    state.dailyPitcherKs = {};
    state.inningRecapsFired = /* @__PURE__ */ new Set();
    state.seenActionEventIds = /* @__PURE__ */ new Set();
    renderFeed();
  }
  function teamCapImg(teamId, name, primary, secondary, cls) {
    const letter = (name || "?")[0].toUpperCase();
    const p = encodeURIComponent(primary || "#333"), s = encodeURIComponent(secondary || "#fff");
    return '<img src="https://www.mlbstatic.com/team-logos/' + teamId + '.svg" class="' + (cls || "card-cap") + `" onerror="capImgError(this,'` + primary + "','" + secondary + "','" + letter + `')">`;
  }
  function showSection(id, btn) {
    devTrace("nav", "showSection \xB7 " + id);
    if (state.demoMode) exitDemo();
    if (document.getElementById("liveView").classList.contains("active")) closeLiveView();
    if (id !== "league") clearLeagueTimer();
    if (id !== "home") clearHomeTimer();
    const prev = document.querySelector(".section.active");
    if (prev) captureScroll(prev.id);
    document.querySelectorAll(".section").forEach(function(s) {
      s.classList.remove("active");
    });
    document.querySelectorAll("nav button").forEach(function(b) {
      b.classList.remove("active");
    });
    document.getElementById(id).classList.add("active");
    if (!btn) {
      btn = document.querySelector('nav button[data-section="' + id + '"]');
      const moreBtn = document.querySelector('nav button[data-section="more"]');
      if (moreBtn && (id === "news" || id === "standings" || id === "stats")) moreBtn.classList.add("active");
    }
    if (btn) btn.classList.add("active");
    updateHeaderCrumb(id);
    if (id === "pulse") {
      state.savedThemeForPulse = state.themeOverride;
      applyPulseMLBTheme();
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
      if (state.savedThemeForPulse !== void 0) {
        applyTeamTheme(state.activeTeam);
      }
    }
    if (id === "schedule" && !state.scheduleLoaded) loadSchedule();
    if (id === "standings") loadStandings();
    if (id === "stats") {
      loadTeamStats();
      installStatsQuickNav();
      if (!state.rosterData.hitting.length) {
        loadRoster();
        loadLeaders();
      } else loadLeaders();
    }
    if (id === "league") loadLeagueView();
    if (id === "news") loadNews();
    restoreScroll(id);
    syncHash(id);
  }
  function getSeriesInfo(g) {
    const sn = g.seriesGameNumber || g.seriesSummary && g.seriesSummary.seriesGameNumber;
    const total = g.gamesInSeries || g.seriesSummary && g.seriesSummary.gamesInSeries;
    const desc = g.seriesSummary && g.seriesSummary.seriesStatus ? g.seriesSummary.seriesStatus : null;
    if (sn && total && desc) return "Game " + sn + " of " + total + " \xB7 " + desc;
    if (!state.scheduleData.length) return sn && total ? "Game " + sn + " of " + total : null;
    const oppId = g.teams.home.team.id === state.activeTeam.id ? g.teams.away.team.id : g.teams.home.team.id;
    const venueId = g.venue && g.venue.id, gameDateStr = g.gameDate.split("T")[0];
    const series = state.scheduleData.filter(function(s) {
      const sOpp = s.teams.home.team.id === state.activeTeam.id ? s.teams.away.team.id : s.teams.home.team.id;
      const sVenue = s.venue && s.venue.id, daysDiff = Math.abs((new Date(s.gameDate.split("T")[0]) - new Date(gameDateStr)) / 864e5);
      return sOpp === oppId && sVenue === venueId && daysDiff <= 4;
    }).sort(function(a, b) {
      return new Date(a.gameDate) - new Date(b.gameDate);
    });
    if (!sn && series.length < 2) return null;
    const gameNum = sn || series.findIndex(function(s) {
      return s.gamePk === g.gamePk;
    }) + 1;
    let gameTotal = total || series.length, myW = 0, oppW = 0;
    series.forEach(function(s) {
      if (s.status.abstractGameState !== "Final") return;
      const myT = s.teams.home.team.id === state.activeTeam.id ? s.teams.home : s.teams.away;
      if (myT.isWinner) myW++;
      else oppW++;
    });
    let recStr = "";
    if (myW > oppW) recStr = " \xB7 " + state.activeTeam.short + " lead " + myW + "-" + oppW;
    else if (oppW > myW) {
      const oN = g.teams.home.team.id === state.activeTeam.id ? g.teams.away.team.teamName : g.teams.home.team.teamName;
      recStr = " \xB7 " + oN + " lead " + oppW + "-" + myW;
    } else if (myW > 0) recStr = " \xB7 Tied " + myW + "-" + myW;
    return "Game " + gameNum + " of " + gameTotal + recStr;
  }
  function renderNextGame(g, label) {
    const home = g.teams.home, away = g.teams.away, teamHome = home.team.id === state.activeTeam.id;
    const opp = teamHome ? away : home, my = teamHome ? home : away;
    const status = g.status.abstractGameState, seriesInfo = getSeriesInfo(g);
    const oppD = TEAMS.find(function(t) {
      return t.id === opp.team.id;
    }) || {};
    const myD = TEAMS.find(function(t) {
      return t.id === my.team.id;
    }) || {};
    const showScores = status === "Live" || status === "Final";
    const oppScore = showScores ? opp.score != null ? opp.score : 0 : "";
    const myScore = showScores ? my.score != null ? my.score : 0 : "";
    const oppKicker = teamHome ? "VS" : "AT";
    const myKicker = teamHome ? "HOME" : "AWAY";
    let topBadge = "";
    if (status === "Live") {
      const inn = g.linescore && g.linescore.currentInning ? (g.linescore.inningHalf === "Bottom" ? "\u25BC " : "\u25B2 ") + g.linescore.currentInning + " \xB7 " : "";
      topBadge = '<span class="hero-live-meta">' + inn + '<span class="hero-live-dot"></span>LIVE</span>';
    } else if (status === "Final") {
      const mW = my.isWinner;
      topBadge = '<span class="badge badge-final">FINAL</span> <span class="badge ' + (mW ? "badge-w" : "badge-l") + '">' + (mW ? "W" : "L") + "</span>";
    }
    let bottomRight = "";
    if (status === "Live") {
      bottomRight = '<button onclick="showLiveGame(' + g.gamePk + ')" class="btn-primary">\u25B6 Watch Live</button>';
    } else if (status !== "Final") {
      bottomRight = '<div class="hero-meta-strong">' + (teamHome ? "\u{1F3DF}\uFE0F Home" : "\u2708\uFE0F Away") + " \xB7 " + fmtDateTime(g.gameDate) + "</div>";
    }
    const themeTeamMy = state.themeOverride || myD;
    const myPrimaryForClash = state.themeInvert ? themeTeamMy.secondary || state.activeTeam.primary : themeTeamMy.primary || state.activeTeam.primary;
    const oppPrimary = pickOppColor(oppD.primary || "#333", oppD.secondary, myPrimaryForClash);
    let html = '<div class="game-big surface-hero has-opp-tint" style="--opp-primary:' + oppPrimary + '">';
    html += '<div class="hero-kicker-row"><span class="eyebrow eyebrow--accent">' + label + "</span>";
    if (topBadge) html += " " + topBadge;
    html += "</div>";
    html += '<div class="ng-grid">';
    html += teamCapImg(opp.team.id, opp.team.teamName, oppPrimary, oppD.secondary || "#fff");
    html += '<div class="ng-team-left"><div class="eyebrow">' + oppKicker + '</div><div class="ng-name">' + opp.team.teamName + "</div>" + (showScores ? '<div class="ng-score">' + oppScore + "</div>" : "") + "</div>";
    html += '<div class="hero-divider">\u2014</div>';
    html += '<div class="ng-team-right"><div class="eyebrow">' + myKicker + '</div><div class="ng-name">' + my.team.teamName + "</div>" + (showScores ? '<div class="ng-score">' + myScore + "</div>" : "") + "</div>";
    html += teamCapImg(my.team.id, my.team.teamName, myD.primary || "#333", myD.secondary || "#fff");
    html += "</div>";
    html += '<div class="hero-bottom-row">';
    html += '<div class="hero-meta">' + (seriesInfo || "") + "</div>";
    html += bottomRight;
    html += "</div></div>";
    return html;
  }
  (async function() {
    (function() {
      try {
        const ua = navigator.userAgent || "";
        const isIPad = /iPad/.test(ua) || /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
        if (isIPad) {
          const m = document.querySelector("meta[name=viewport]");
          if (m) m.setAttribute("content", "width=device-width, initial-scale=1.0");
        }
      } catch (e) {
      }
    })();
    const sv = function(k) {
      return localStorage.getItem(k);
    };
    state.mlbSessionToken = sv("mlb_session_token");
    state.mlbAuthUser = sv("mlb_auth_user");
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get("auth_token"), authMethod = params.get("auth_method");
    if (authToken && authMethod) {
      state.mlbSessionToken = authToken;
      localStorage.setItem("mlb_session_token", authToken);
      if (authMethod === "github") {
        state.mlbAuthUser = params.get("github_login") || "GitHub User";
      } else if (authMethod === "email") {
        state.mlbAuthUser = params.get("email") || "Email User";
      }
      localStorage.setItem("mlb_auth_user", state.mlbAuthUser);
      window.history.replaceState({}, "", window.location.pathname);
      await mergeCollectionOnSignIn();
      startSyncInterval();
    } else if (state.mlbSessionToken) {
      startSyncInterval();
    }
    if (sv("mlb_team")) state.activeTeam = TEAMS.find((t) => t.id === parseInt(sv("mlb_team"))) || state.activeTeam;
    const storedTheme = sv("mlb_theme");
    if (!storedTheme || storedTheme === "-1") {
      state.themeOverride = MLB_THEME;
    } else if (storedTheme === "0") {
      state.themeOverride = null;
    } else {
      state.themeOverride = TEAMS.find((t) => t.id === parseInt(storedTheme)) || null;
    }
    if (sv("mlb_invert") === "true") state.themeInvert = true;
    if (sv("mlb_theme_scope") === "nav") state.themeScope = "nav";
    buildTeamSelect();
    buildThemeSelect();
    updatePulseToggle();
    document.getElementById("themeSelect").value = storedTheme || "-1";
    if (sv("mlb_theme_scope")) document.getElementById("themeScopeSelect").value = sv("mlb_theme_scope");
    if (state.themeInvert) {
      const it = document.getElementById("invertToggle"), ik = document.getElementById("invertToggleKnob");
      it.style.background = "var(--primary)";
      ik.style.left = "21px";
      it.setAttribute("aria-checked", "true");
    }
    if (sv("mlb_push") === "1") {
      const pt = document.getElementById("pushToggle"), pk = document.getElementById("pushToggleKnob");
      if (pt) {
        pt.style.background = "var(--secondary)";
        pk.style.left = "21px";
        pt.setAttribute("aria-checked", "true");
      }
      document.getElementById("pushStatusText").textContent = "On";
    }
    if (!state.qualifiedOnly) {
      const qt = document.getElementById("qualifiedToggle");
      if (qt) {
        qt.classList.remove("on");
        qt.setAttribute("aria-checked", "false");
      }
    }
    applyTeamTheme(state.activeTeam);
    loadTodayGame();
    loadNextGame();
    loadNews();
    loadStandings();
    loadRoster();
    loadHomeInjuries();
    loadHomeMoves();
    loadHomePodcastWidget();
    loadHomeYoutubeWidget();
    updateCollectionUI();
    updateSyncUI();
    setDemoCallbacks({
      addFeedItem,
      renderTicker,
      renderSideRailGames,
      buildStoryPool,
      updateFeedEmpty,
      showAlert,
      playSound,
      showPlayerCard,
      showRBICard,
      rotateStory,
      localDateStr,
      selectFocusGame,
      pollFocusLinescore,
      pollPendingVideoClips,
      // Called by exitDemo to restart live polling. Mirrors the live-init
      // section of initReal so Pulse fully resumes — fresh poll, story
      // pool rebuild, focus selection, and all the recurring timers. The
      // immediate updateFeedEmpty paints the hype/empty card so there's no
      // flash of empty Pulse while the first poll is in flight.
      resumeLivePulse: function() {
        if (state.pulseTimer) {
          clearInterval(state.pulseTimer);
          state.pulseTimer = null;
        }
        if (state.storyPoolTimer) {
          clearInterval(state.storyPoolTimer);
          state.storyPoolTimer = null;
        }
        if (state.videoClipPollTimer) {
          clearInterval(state.videoClipPollTimer);
          state.videoClipPollTimer = null;
        }
        state.pollDateStr = localDateStr(/* @__PURE__ */ new Date());
        updateFeedEmpty();
        renderTicker();
        renderSideRailGames();
        loadOnThisDayCache();
        loadYesterdayCache();
        loadTransactionsCache();
        loadHighLowCache();
        pollLeaguePulse().then(function() {
          buildStoryPool();
          if (state.focusGamePk) setFocusGame(state.focusGamePk);
        }).catch(function(e) {
          console.error("[pulse] pollLeaguePulse error", e);
        });
        state.pulseTimer = setInterval(pollLeaguePulse, TIMING.PULSE_POLL_MS);
        state.storyPoolTimer = setInterval(buildStoryPool, TIMING.STORY_POOL_MS);
        state.videoClipPollTimer = setInterval(pollPendingVideoClips, 30 * 1e3);
      }
    });
    state.pulseInitialized = true;
    initLeaguePulse();
    state.savedThemeForPulse = state.themeOverride;
    applyPulseMLBTheme();
    requestScreenWakeLock();
    applyMyTeamLens(state.myTeamLens);
  })();
  document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
      state.tabHiddenAt = Date.now();
      releaseScreenWakeLock();
      if (state.pulseTimer) {
        clearInterval(state.pulseTimer);
        state.pulseTimer = null;
      }
      if (state.storyPoolTimer) {
        clearInterval(state.storyPoolTimer);
        state.storyPoolTimer = null;
      }
      if (state.focusFastTimer) {
        clearInterval(state.focusFastTimer);
        state.focusFastTimer = null;
      }
      clearHomeTimer();
      clearLeagueTimer();
    } else {
      if (state.pulseInitialized && !state.demoMode) {
        pollLeaguePulse().finally(function() {
          state.tabHiddenAt = null;
        });
        state.pulseTimer = setInterval(pollLeaguePulse, TIMING.PULSE_POLL_MS);
        state.storyPoolTimer = setInterval(buildStoryPool, TIMING.STORY_POOL_MS);
        if (state.focusGamePk) state.focusFastTimer = setInterval(pollFocusLinescore, TIMING.FOCUS_POLL_MS);
      } else {
        state.tabHiddenAt = null;
      }
    }
  });
  installMoreSheetEscClose();
  installHideOnScroll();
  installNavClicks(showSection);
  installHashRouter(showSection);
  installNavDotsRefresh(3e4);
  installNavLongPress({
    pulse: function() {
      openPulseShortcuts();
    }
  });
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape" && state.scorecardOverlayOpen) {
      closeScorecardOverlay();
      return;
    }
    if (e.key === "Escape" && state.focusOverlayOpen) {
      closeFocusOverlay();
      return;
    }
    if (e.shiftKey && e.key === "M") {
      toggleDemoMode();
    }
    if (e.shiftKey && e.key === "H") {
      replayHRCard();
    }
    if (e.shiftKey && e.key === "B") {
      replayRBICard();
    }
    if (e.shiftKey && e.key === "V") {
      window.PulseCard.demo();
    }
    if (e.shiftKey && e.key === "D") {
      toggleDevTools();
    }
    if (e.shiftKey && e.key === "F") {
      window.FocusCard && window.FocusCard.demo();
    }
    if (e.shiftKey && e.key === "G") {
      generateTestCard();
    }
    if (e.shiftKey && e.key === "C") {
      window.CollectionCard && window.CollectionCard.demo();
    }
    if (e.shiftKey && e.key === "P") {
      devTestVideoClip();
    }
    if (e.shiftKey && e.key === "N") {
      openNewsSourceTest();
    }
    if (e.shiftKey && e.key === "L") {
      const p = document.getElementById("devToolsPanel");
      if (p && p.style.display !== "block") toggleDevTools();
      const det = document.getElementById("logCaptureDetails");
      if (det) {
        det.open = true;
        renderLogCapture();
        det.scrollIntoView({ block: "nearest" });
      }
    }
    if (e.shiftKey && e.key === "S") {
      const p = document.getElementById("devToolsPanel");
      if (p && p.style.display !== "block") toggleDevTools();
      const det = document.getElementById("appStateDetails");
      if (det) {
        det.open = true;
        renderAppState();
        det.scrollIntoView({ block: "nearest" });
      }
    }
    if (e.shiftKey && e.key === "I") {
      copyDiagnosticSnapshot();
    }
  });
  document.addEventListener("click", onSoundPanelClickOutside);
  setupSettingsClickOutside();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(
      function(reg) {
        devTrace("sw", "registered \xB7 scope=" + reg.scope);
      },
      function(err) {
        devTrace("sw", "registration FAILED \xB7 " + (err && err.message || err));
      }
    );
  }
  Object.assign(window, {
    // Navigation + section dispatch
    showSection,
    openMoreSheet,
    closeMoreSheet,
    toggleMoreSheet,
    openPulseOverflow,
    closePulseOverflow,
    togglePulseOverflow,
    openPulseShortcuts,
    closePulseShortcuts,
    // Settings + theme + team
    switchTeam,
    switchTheme,
    switchThemeScope,
    toggleSettings,
    toggleInvert,
    togglePush,
    toggleRadio,
    toggleDevTools,
    toggleMyTeamLens,
    toggleSoundPanel,
    setPulseColorScheme,
    togglePulseColorScheme,
    setSoundPref,
    // Collection + Yesterday Recap + Radio Check overlays
    openCollection,
    closeCollection,
    filterCollection,
    sortCollection,
    goCollectionPage,
    openCardFromCollection,
    openRadioCheck,
    closeRadioCheck,
    openYesterdayRecap,
    closeYesterdayRecap,
    // Section loaders (refresh buttons, day toggles)
    loadSchedule,
    loadNews,
    loadLeaders,
    loadLeagueMatchups,
    changeMonth,
    switchLeaderTab,
    selectLeaderPill,
    switchRosterTab,
    switchVsBasis,
    toggleQualifiedOnly,
    toggleLeaderMore,
    switchPlayerStatsTab,
    dismissCareerSwipeHint,
    openCompareOverlay,
    closeCompareOverlay,
    setCompareSlot,
    setCompareGroup,
    switchNewsFeed,
    toggleNewsTeamLens,
    switchLeagueLeaderTab,
    switchMatchupDay,
    selectNewsSource,
    // Live game view + matchup grid
    showLiveGame,
    closeLiveView,
    fetchLiveGame,
    liveScorecard,
    switchBoxTab,
    selectCalGame,
    // Carousel nav
    prevStory,
    nextStory,
    nextNewsCard,
    prevNewsCard,
    // Demo Mode controls
    setDemoSpeed,
    demoNextHR,
    toggleDemoPause,
    forwardDemoPlay,
    toggleDemoMode,
    exitDemo,
    // Auth
    signInWithGitHub,
    signInWithEmail,
    signOut,
    // Dev Tools + diagnostics
    openNewsSourceTest,
    runNewsSourceTest,
    copyNewsSourceTest,
    closeNewsSourceTest,
    openYoutubeDebug,
    ytDebugFetchCustom,
    runYoutubeDebugAll,
    runYoutubeDebugOne,
    ytDebugCopy,
    ytDebugReset,
    closeYoutubeDebug,
    ytDebugApplyToTeam,
    radioCheckTryCustom,
    radioCheckStop,
    radioCheckReset,
    radioCheckCopy,
    radioCheckPlay,
    radioCheckSet,
    radioCheckSetNote,
    copyVideoDebug,
    refreshVideoDebugPanel,
    closeVideoDebugPanel,
    copyDiagnosticSnapshot,
    _copyToClipboard,
    toggleColorLock,
    updateColorOverride,
    updateTuning,
    replayHRCard,
    replayRBICard,
    generateTestCard,
    devTestVideoClip,
    renderLogCapture,
    renderAppState,
    // Card overlays + dismissals
    dismissPlayerCard,
    closeSignInCTA,
    closeVideoOverlay,
    openCardFromKey,
    playHighlightVideo,
    playYesterdayClip,
    scrollToYdTile,
    selectYdClip,
    selectMediaVideo,
    playPodcast,
    stopPodcast,
    stopAllMedia,
    selectPlayer,
    ydChangeDate,
    // Scorecard
    openScorecardOverlay,
    closeScorecardOverlay,
    // Focus Mode
    openFocusOverlay,
    closeFocusOverlay,
    dismissFocusAlert,
    setFocusGame,
    setFocusGameManual,
    resetFocusAuto,
    toggleGame
  });
})();
//# sourceMappingURL=app.bundle.js.map
