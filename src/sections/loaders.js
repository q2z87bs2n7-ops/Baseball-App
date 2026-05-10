// Section Loaders — Stats Roster + Player + Compare (Leaders/Team/News/etc.
// already extracted to their own modules; this file is being whittled down).
import { state } from '../state.js';
import {
  SEASON, WC_SPOTS, MLB_BASE, API_BASE, TEAMS, TIMING,
} from '../config/constants.js';
import {
  tcLookup, fmt, fmtRate, fmtDateTime, fmtNewsDate, pickOppColor,
  etDateStr, etDatePlus,
} from '../utils/format.js';
import { computePercentile, tierFromPercentile, pctBar, rankCaption, avgChip, leagueAverage, teamAverage, leaderEntry } from '../utils/stats-math.js';
import { NEWS_IMAGE_HOSTS, isSafeNewsImage, escapeNewsHtml, forceHttps, decodeNewsHtml } from '../utils/news.js';
import { buildBoxscore } from '../utils/boxscore.js';
import { fetchLeagueLeaders } from '../data/leaders.js';
import { scrollTabIntoView, hotColdBadge, HOT_COLD_TTL_MS } from './stats/_shared.js';
import { loadLeaders } from './stats/leaders.js';

// ── Callbacks (injected by main.js) ──────────────────────────────────────────
let sectionCallbacks={
  renderNextGame: null,
  getSeriesInfo: null,
  localDateStr: null,
  teamCapImg: null,
  capImgError: null,
};
export function setSectionCallbacks(cb) {
  Object.assign(sectionCallbacks, cb);
}




