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
  if (g.inning >= 6 && diff <= 2 && runners === 0) situation += Math.min((g.inning - 5) * 6, 24);
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
  {
    desc: 'Blowout in the 2nd — home up 9-0, no drama',
    gut: 1,
    gutReason: 'Game is effectively over before it started, nothing on the line',
    g: { status:'Live', detailedState:'In Progress', inning:2, halfInning:'top', awayScore:0, homeScore:9, onFirst:false, onSecond:false, onThird:false, awayHits:1, homeHits:8 }
  },
  {
    desc: 'Tie game, inning 2, bases empty — way too early to matter',
    gut: 2,
    gutReason: 'Tie sounds exciting but its inning 2 with 7+ innings of low-stakes play ahead',
    g: { status:'Live', detailedState:'In Progress', inning:2, halfInning:'bottom', awayScore:1, homeScore:1, onFirst:false, onSecond:false, onThird:false, awayHits:3, homeHits:2 }
  },
  {
    desc: 'Early game, home up 3-0 in the 3rd, no baserunners',
    gut: 2,
    gutReason: 'Small lead early, plenty of game left but nothing urgent happening',
    g: { status:'Live', detailedState:'In Progress', inning:3, halfInning:'top', awayScore:0, homeScore:3, onFirst:false, onSecond:false, onThird:false, awayHits:2, homeHits:5 }
  },
  {
    desc: 'Mid-game, 5-1 lead for away team, 5th inning, bases empty',
    gut: 3,
    gutReason: 'Four-run lead in the 5th is comfortable but not quite a laugher yet',
    g: { status:'Live', detailedState:'In Progress', inning:5, halfInning:'top', awayScore:5, homeScore:1, onFirst:false, onSecond:false, onThird:false, awayHits:7, homeHits:3 }
  },
  {
    desc: 'Perfect game bid — away pitcher through 6, no hits no runs',
    gut: 8,
    gutReason: 'Perfect game bids are rare and electrifying even though the score is lopsided',
    g: { status:'Live', detailedState:'In Progress', inning:6, halfInning:'top', awayScore:2, homeScore:0, onFirst:false, onSecond:false, onThird:false, awayHits:6, homeHits:0 }
  },
  {
    desc: 'No-hitter bid in the 8th, home pitcher, away has zero hits',
    gut: 9,
    gutReason: 'No-hitter through 8 is extraordinarily rare, entire stadium on edge every pitch',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'top', awayScore:0, homeScore:1, onFirst:false, onSecond:false, onThird:false, awayHits:0, homeHits:4 }
  },
  {
    desc: 'Walk-off situation — home down 1, bottom 9, bases loaded',
    gut: 10,
    gutReason: 'Maximum drama: bases loaded, one swing ends it, last at-bat of the game',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:4, homeScore:3, onFirst:true, onSecond:true, onThird:true, awayHits:8, homeHits:7 }
  },
  {
    desc: 'Tie game, bottom 9, runner on second — walk-off hit wins it',
    gut: 10,
    gutReason: 'Tie game, home team in scoring position in the 9th is pure walk-off tension',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:5, homeScore:5, onFirst:false, onSecond:true, onThird:false, awayHits:9, homeHits:8 }
  },
  {
    desc: 'Extra innings, tied in the 11th, ghost runner on second',
    gut: 10,
    gutReason: 'Extra innings with automatic runner is volatile and high-stakes every pitch',
    g: { status:'Live', detailedState:'In Progress', inning:11, halfInning:'bottom', awayScore:3, homeScore:3, onFirst:false, onSecond:true, onThird:false, awayHits:10, homeHits:9 }
  },
  {
    desc: 'Extra innings blowout — away up 8-0 in the 10th',
    gut: 2,
    gutReason: 'Eight-run lead even in extras means the game is a formality',
    g: { status:'Live', detailedState:'In Progress', inning:10, halfInning:'top', awayScore:8, homeScore:0, onFirst:false, onSecond:false, onThird:false, awayHits:14, homeHits:2 }
  },
  {
    desc: 'Home trailing by 5 in the 8th, runner on first — big deficit late',
    gut: 4,
    gutReason: 'Five runs is a lot to overcome in two innings but rally potential gives faint hope',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'bottom', awayScore:7, homeScore:2, onFirst:true, onSecond:false, onThird:false, awayHits:11, homeHits:5 }
  },
  {
    desc: 'Home trailing by 5 in the 9th, bases loaded — miracle still possible',
    gut: 6,
    gutReason: 'Grand slam cuts it to one and any hit scores; unlikely but bases loaded keeps hope alive',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:8, homeScore:3, onFirst:true, onSecond:true, onThird:true, awayHits:13, homeHits:6 }
  },
  {
    desc: 'One-run game in the 7th, top half, bases empty',
    gut: 6,
    gutReason: 'Close game in the 7th has real stakes but lacks immediate base-state urgency',
    g: { status:'Live', detailedState:'In Progress', inning:7, halfInning:'top', awayScore:4, homeScore:3, onFirst:false, onSecond:false, onThird:false, awayHits:7, homeHits:6 }
  },
  {
    desc: 'Tie game top 8th, bases loaded — go-ahead run every base',
    gut: 9,
    gutReason: 'Loaded bases in a tie game late means any contact changes the entire complexion',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'top', awayScore:2, homeScore:2, onFirst:true, onSecond:true, onThird:true, awayHits:5, homeHits:6 }
  },
  {
    desc: 'Rain delay restart — resumed in the 5th, tied 0-0, runners on corners',
    gut: 5,
    gutReason: 'Weird energy after rain delay, scoreless tie with runners on corners is interesting but still mid-game',
    g: { status:'Live', detailedState:'In Progress', inning:5, halfInning:'bottom', awayScore:0, homeScore:0, onFirst:true, onSecond:false, onThird:true, awayHits:2, homeHits:1 }
  },
  {
    desc: 'Away team chasing 3-run deficit in the 9th, runner on first',
    gut: 5,
    gutReason: 'Three-run deficit with one out to give is a long shot; possible but not likely',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'top', awayScore:1, homeScore:4, onFirst:true, onSecond:false, onThird:false, awayHits:4, homeHits:8 }
  },
  {
    desc: 'Pitcher duel — 0-0 through 7, bases empty top 8th',
    gut: 7,
    gutReason: 'Scoreless pitcher duel late means the first run could decide it all',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'top', awayScore:0, homeScore:0, onFirst:false, onSecond:false, onThird:false, awayHits:4, homeHits:3 }
  },
  {
    desc: 'Home up 2-1 in bottom 9, runner on 2nd, adding insurance',
    gut: 6,
    gutReason: 'Home team padding a 1-run lead late keeps things interesting on both sides',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:1, homeScore:2, onFirst:false, onSecond:true, onThird:false, awayHits:5, homeHits:6 }
  },
  {
    desc: 'Inning 12 tie game, bases empty — deep extra innings grind',
    gut: 8,
    gutReason: 'Both bullpens exhausted, any mistake ends it; sheer length adds existential tension',
    g: { status:'Live', detailedState:'In Progress', inning:12, halfInning:'top', awayScore:4, homeScore:4, onFirst:false, onSecond:false, onThird:false, awayHits:11, homeHits:12 }
  },
  {
    desc: 'Blowout 12-2 in the 6th, away leading — mop-up territory',
    gut: 1,
    gutReason: 'Ten-run margin is mathematically over; no scenario makes this watchable',
    g: { status:'Live', detailedState:'In Progress', inning:6, halfInning:'top', awayScore:12, homeScore:2, onFirst:false, onSecond:false, onThird:false, awayHits:16, homeHits:4 }
  },
  {
    desc: 'One-run game inning 6, runners on first and second',
    gut: 7,
    gutReason: 'Baserunners in a tight game mid-contest give genuine scoring threat and defensive pressure',
    g: { status:'Live', detailedState:'In Progress', inning:6, halfInning:'bottom', awayScore:3, homeScore:2, onFirst:true, onSecond:true, onThird:false, awayHits:6, homeHits:5 }
  },
  {
    desc: 'Away no-hitter bid through 7 but away trailing 1-0',
    gut: 9,
    gutReason: 'No-hit stuff through 7 AND trailing means both historic achievement and comeback drama collide',
    g: { status:'Live', detailedState:'In Progress', inning:7, halfInning:'bottom', awayScore:1, homeScore:0, onFirst:false, onSecond:false, onThird:false, awayHits:8, homeHits:0 }
  },
  {
    desc: 'Tie game inning 4, runners on corners',
    gut: 5,
    gutReason: 'Runners in scoring position in a tie game is spicy but we are still in the early middle innings',
    g: { status:'Live', detailedState:'In Progress', inning:4, halfInning:'top', awayScore:2, homeScore:2, onFirst:true, onSecond:false, onThird:true, awayHits:4, homeHits:5 }
  },
  {
    desc: 'Home down 1 in the 9th, runner on third — sacrifice fly wins it',
    gut: 10,
    gutReason: 'Tying run 90 feet away in the last inning is as elemental as baseball tension gets',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:3, homeScore:2, onFirst:false, onSecond:false, onThird:true, awayHits:7, homeHits:5 }
  },
  {
    desc: 'Away leading 6-4 in the 8th, nobody on',
    gut: 5,
    gutReason: 'Two-run lead in the 8th is real but without baserunners the immediate danger is contained',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'top', awayScore:6, homeScore:4, onFirst:false, onSecond:false, onThird:false, awayHits:9, homeHits:8 }
  },
  {
    desc: 'Scoreless duel inning 1, runner on second early',
    gut: 2,
    gutReason: 'First inning threat is interesting but there are 8+ innings left so stakes are minimal',
    g: { status:'Live', detailedState:'In Progress', inning:1, halfInning:'bottom', awayScore:0, homeScore:0, onFirst:false, onSecond:true, onThird:false, awayHits:0, homeHits:1 }
  },
  {
    desc: 'Away up 2-1 entering the 9th, bases loaded for the home team',
    gut: 10,
    gutReason: 'Loaded bases, one-run game, last inning — home team can win with a single; it does not get tighter',
    g: { status:'Live', detailedState:'In Progress', inning:9, halfInning:'bottom', awayScore:2, homeScore:1, onFirst:true, onSecond:true, onThird:true, awayHits:6, homeHits:7 }
  },
  {
    desc: 'Big comeback attempt — home down 5 in the 8th, bases loaded',
    gut: 7,
    gutReason: 'Grand slam ties it and there is still an inning left; improbable but the drama is real with bags full',
    g: { status:'Live', detailedState:'In Progress', inning:8, halfInning:'bottom', awayScore:7, homeScore:2, onFirst:true, onSecond:true, onThird:true, awayHits:12, homeHits:5 }
  },
  {
    desc: 'Tie game, 13th inning, runners on first and third',
    gut: 10,
    gutReason: 'Deep extra innings with runners in scoring position is peak chaos and exhaustion drama',
    g: { status:'Live', detailedState:'In Progress', inning:13, halfInning:'bottom', awayScore:5, homeScore:5, onFirst:true, onSecond:false, onThird:true, awayHits:13, homeHits:14 }
  },
  {
    desc: 'Dominant home pitcher through 7, 8-0 lead, one hit allowed — shutout bid',
    gut: 3,
    gutReason: 'No-hitter is gone, lead is massive — the only remaining subplot is historic shutout but score kills tension',
    g: { status:'Live', detailedState:'In Progress', inning:7, halfInning:'top', awayScore:0, homeScore:8, onFirst:false, onSecond:false, onThird:false, awayHits:1, homeHits:12 }
  },
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
