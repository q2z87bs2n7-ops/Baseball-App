/**
 * Tension score test harness — node scripts/tension-test.mjs
 *
 * HOW TO USE IN A STRESS TEST:
 *   1. Give the agent the SCENARIO FORMAT below and ask it to write 30 scenarios
 *      as a JSON array — NO arithmetic needed, just desc + g object + gut rating.
 *   2. Paste the array into SCENARIOS below.
 *   3. Run: node scripts/tension-test.mjs
 *   4. Share the output table back to the agent for subjective comparison.
 *
 * The formula here is the source of truth — keep it in sync with src/focus/mode.js
 * whenever calcFocusScore() is updated.
 *
 * SCENARIO FORMAT:
 *   {
 *     desc: 'Short description',
 *     gut: 7,          // your subjective 1-10 tension rating
 *     g: {
 *       status: 'Live',
 *       detailedState: 'In Progress',
 *       inning: 8,
 *       halfInning: 'bottom',   // 'top' or 'bottom'
 *       awayScore: 3,
 *       homeScore: 3,
 *       onFirst: false,
 *       onSecond: true,
 *       onThird: false,
 *       awayHits: 6,   // needed for no-hitter detection
 *       homeHits: 5,
 *     }
 *   }
 */

// ── FORMULA (mirror of src/focus/mode.js calcFocusScore) ────────────
function calcFocusScore(g) {
  if (g.status !== 'Live' || g.detailedState !== 'In Progress') return 0;
  const diff = Math.abs(g.awayScore - g.homeScore);
  const closeness = diff===0?60:diff===1?45:diff===2?28:diff===3?20:diff===4?8:3;
  const runners = (g.onFirst?1:0) + (g.onSecond?1:0) + (g.onThird?1:0);
  const isBL = g.onFirst && g.onSecond && g.onThird;
  const isWalkoff = g.halfInning==='bottom' && g.inning>=9
    && (g.awayScore - g.homeScore) <= runners + 1
    && g.awayScore >= g.homeScore;
  const isNoHit = g.inning >= 6 && (g.awayHits === 0 || g.homeHits === 0);
  let situation = isBL ? 40
    : (g.onThird && (g.onSecond || g.onFirst)) ? 35
    : g.onThird ? 28
    : (g.onSecond && g.onFirst) ? 22
    : g.onSecond ? 20
    : runners > 0 ? 12 : 0;
  if (isWalkoff) situation += 50;
  if (isNoHit)   situation += Math.min((g.inning - 4) * 18, 120);
  let innMult = g.inning<=3?0.5:g.inning<=5?0.75:g.inning<=8?1.0:g.inning===9?1.5:1.8;
  if (g.inning >= 9 && diff > runners + 2 && !isNoHit) innMult = Math.min(innMult, 1.0);
  return (closeness + situation) * innMult;
}

// ── BAND BOUNDARIES (mirror of src/feed/render.js tensionBand) ──────
function tensionBand(score) {
  if (score <= 0)   return 0;
  if (score <= 15)  return 1;
  if (score <= 40)  return 2;
  if (score <= 55)  return 3;
  if (score <= 72)  return 4;
  if (score <= 84)  return 5;
  if (score <= 100) return 6;
  if (score <= 115) return 7;
  if (score <= 145) return 8;
  if (score <= 210) return 9;
  return 10;
}

const BAND_COLORS = [
  '—', 'deep green', 'green', 'lime green', 'lime',
  'yellow', 'amber', 'orange', 'dark orange', 'red', 'dark red'
];

// ── PASTE SCENARIOS HERE ─────────────────────────────────────────────
const SCENARIOS = [
  // { desc: 'Tied, bases loaded, bottom 9th',
  //   gut: 10,
  //   g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom',
  //        awayScore:3, homeScore:3, onFirst:true, onSecond:true, onThird:true,
  //        awayHits:7, homeHits:8 } },
];
// ─────────────────────────────────────────────────────────────────────

if (!SCENARIOS.length) {
  console.error('No scenarios defined — add entries to the SCENARIOS array.');
  process.exit(1);
}

const rows = SCENARIOS.map((s, i) => {
  const score = calcFocusScore(s.g);
  const band  = tensionBand(score);
  const delta = s.gut !== undefined ? s.gut - band : null;
  const flag  = delta !== null && Math.abs(delta) >= 2 ? ' ⚠' : delta !== null && Math.abs(delta) === 1 ? ' ·' : '';
  return { i: i + 1, desc: s.desc, score, band, color: BAND_COLORS[band], gut: s.gut ?? '—', delta, flag };
});

// Results table
console.log('\n## Tension Score Results\n');
console.log('| # | Description | Score | Band | Color | Gut | Δ |');
console.log('|---|---|---|---|---|---|---|');
rows.forEach(r => {
  const d = r.delta !== null ? (r.delta > 0 ? `+${r.delta}` : `${r.delta}`) : '—';
  console.log(`| ${r.i} | ${r.desc} | ${r.score.toFixed(1)} | ${r.band} | ${r.color} | ${r.gut} | ${d}${r.flag} |`);
});

// Summary stats
const scored = rows.filter(r => r.delta !== null);
const misaligned = scored.filter(r => Math.abs(r.delta) >= 2);
const off1       = scored.filter(r => Math.abs(r.delta) === 1);
const aligned    = scored.filter(r => r.delta === 0);

console.log(`\n### Summary`);
console.log(`- Aligned (Δ=0):   ${aligned.length}/${scored.length}`);
console.log(`- Off by 1 (·):    ${off1.length}/${scored.length}`);
console.log(`- Misaligned ⚠ (Δ≥2): ${misaligned.length}/${scored.length}`);

// Band distribution
const dist = Array(11).fill(0);
rows.forEach(r => dist[r.band]++);
console.log('\n### Band distribution');
dist.forEach((n, b) => { if (b > 0) console.log(`  Band ${b} (${BAND_COLORS[b]}): ${n} scenario${n===1?'':'s'}`); });
