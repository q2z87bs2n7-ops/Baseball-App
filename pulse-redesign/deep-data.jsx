// Mock data + helpers — drives the deep Pulse prototype.
// Multiple game states, multiple stories, simulated ticks for live feel.

// Themed token sets — switch via PTHEME(scheme).
const P_DARK = {
  bg:'#0B1424', bg2:'#11203A', card:'#172B4D', card2:'#1E3A5F',
  border:'#243A5C', borderS:'#1B2D49',
  text:'#E6E9F0', muted:'#8A95AA', dim:'#5C6B85', accent:'#CFD3DC',
  white:'#FFFFFF',
  green:'#3CBE64', warn:'#FFAA3C', red:'#FF5A5A', hr:'#A065FF', blue:'#4FB8FF',
  team:'#FF5910',
  // chrome tokens — used for in-card overlays + top bar gradient
  tint:'rgba(0,0,0,0.18)',           // darken-tint applied over cards
  topbarA:'#14223A', topbarB:'#0E1B2F',
};
const P_LIGHT = {
  bg:'#F4F6FB', bg2:'#FFFFFF', card:'#FFFFFF', card2:'#F0F3F9',
  border:'#DDE3EC', borderS:'#EAEEF5',
  text:'#0F1B2E', muted:'#5B6678', dim:'#94A0B5', accent:'#1F2A3D',
  white:'#0F1B2E', // "headline" color in light mode
  green:'#1F9C4A', warn:'#D97A00', red:'#D93B3B', hr:'#7A3FE0', blue:'#1E7BC4',
  team:'#FF5910',
  // chrome tokens
  tint:'rgba(15,27,46,0.04)',         // soft tint on white cards
  topbarA:'#FFFFFF', topbarB:'#F0F3F9',
};
let PX = P_DARK; // default; mutated by PTHEME at render time
const PTHEME = (scheme) => { PX = scheme === 'light' ? P_LIGHT : P_DARK; return PX; };
const FX = '"Inter", system-ui, -apple-system, sans-serif';
const MX = 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace';

// 9 mock games covering every state your app handles.
const PGAMES = [
  { id: 1, away: 'NYM', home: 'PHI', as: 4, hs: 3, inn: 'T7', state: 'live', risp: true,  outs: 1, hot: true,  tension: 84, myteam: true,
    batter: 'Pete Alonso',     bStat: '2-3, HR, RBI · .284 / .362 / .521',
    pitcher: 'Aaron Nola',     pStat: '6.1 IP, 5H, 2ER, 7K',
    bases: { first:false, second:true, third:true }, count: { b:2, s:2 }, pitches: ['B','S','S','F','B'],
    last: 'Lindor crushes a 2-run shot to right (412 ft)' },
  { id: 5, away: 'ATL', home: 'MIA', as: 5, hs: 4, inn: 'B9', state: 'live', risp: true,  outs: 2, hot: true, tension: 92,
    batter: 'Luis Arraez',     bStat: '1-4 · .312 / .374 / .402',
    pitcher: 'Raisel Iglesias', pStat: '0.2 IP, 1H · S22',
    bases: { first:false, second:true, third:false }, count: { b:3, s:2 }, pitches: ['B','S','B','F','F','B'],
    last: 'Acuña doubles, scores Albies from second' },
  { id: 7, away: 'CHC', home: 'STL', as: 6, hs: 6, inn: 'T10', state: 'live', risp: false, outs: 1, hot: false, tension: 71,
    batter: 'Seiya Suzuki',    bStat: '3-4, 2B · .298 / .371 / .489',
    pitcher: 'Ryan Helsley',   pStat: '0.1 IP · S31',
    bases: { first:true, second:false, third:false }, count: { b:1, s:1 }, pitches: ['B','S'],
    last: 'Suzuki singles, Happ scores from 2nd to tie' },
  { id: 3, away: 'LAD', home: 'SF',  as: 7, hs: 1, inn: 'T8', state: 'live', risp: false, outs: 0, hot: false, tension: 28,
    batter: 'Will Smith',      bStat: '0-3 · .246',
    pitcher: 'Camilo Doval',   pStat: '1.0 IP · ERA 3.41',
    bases: { first:false, second:false, third:false }, count: { b:0, s:0 }, pitches: [],
    last: 'Ohtani — 3-run blast (440 ft, 112 mph EV)' },
  { id: 2, away: 'BOS', home: 'NYY', as: 2, hs: 2, inn: 'B6', state: 'live', risp: false, outs: 2, hot: false, tension: 54,
    batter: 'Aaron Judge',     bStat: '1-3, BB · .276 / .402 / .551',
    pitcher: 'Tanner Houck',   pStat: '5.2 IP, 6H, 2ER, 4K',
    bases: { first:true, second:false, third:false }, count: { b:2, s:1 }, pitches: ['B','S','B'],
    last: 'Judge walks; runner to first' },
  { id: 4, away: 'HOU', home: 'TEX', as: 0, hs: 0, inn: 'T1', state: 'live', risp: false, outs: 0, hot: false, tension: 12,
    batter: 'José Altuve',     bStat: '— · .291',
    pitcher: 'Nathan Eovaldi', pStat: '0.0 IP · ERA 3.15',
    bases: { first:false, second:false, third:false }, count: { b:0, s:0 }, pitches: [],
    last: 'First pitch at Globe Life Field' },
  { id: 6, away: 'TOR', home: 'BAL', as: 3, hs: 8, inn: 'F',  state: 'final', last: 'Orioles take it 8–3 over Toronto' },
  { id: 9, away: 'MIN', home: 'CLE', as: 1, hs: 3, inn: 'F',  state: 'final', last: 'Cleveland holds on, 3–1' },
  { id: 8, away: 'SD',  home: 'AZ',  as: 0, hs: 0, inn: '7:10p', state: 'preview', probables: 'Musgrove · Gallen' },
  { id: 10,away: 'OAK', home: 'SEA', as: 0, hs: 0, inn: '9:40p', state: 'preview', probables: 'Sears · Castillo' },
];

const PFEED = [
  { tag: 'HR',    team: 'NYM', text: 'Lindor crushes a 2-run shot to right (412 ft)', meta: 'NYM 4 · PHI 3 · T7', t: 'just now', tone: 'hr', myteam: true },
  { tag: 'SCORE', team: 'ATL', text: 'Acuña doubles, scores Albies from second',     meta: 'ATL 5 · MIA 4 · B9', t: '1m', tone: 'score' },
  { tag: 'RISP',  team: 'NYM', text: 'Runner moves to 3rd on a wild pitch',          meta: 'NYM 4 · PHI 3 · T7', t: '3m', tone: 'risp', myteam: true },
  { tag: 'HR',    team: 'LAD', text: 'Ohtani — 3-run blast (440 ft, 112 mph EV)',    meta: 'LAD 7 · SF 1 · T8', t: '6m', tone: 'hr' },
  { tag: 'SCORE', team: 'CHC', text: 'Suzuki singles, Happ scores from 2nd to tie',   meta: 'CHC 6 · STL 6 · T10', t: '8m', tone: 'score' },
  { tag: 'STATUS',team: 'HOU', text: 'First pitch at Globe Life Field',              meta: 'HOU @ TEX · T1', t: '9m', tone: 'status' },
  { tag: 'FINAL', team: 'BAL', text: 'Orioles take it 8–3 over Toronto',             meta: 'BAL 8 · TOR 3 · Final', t: '14m', tone: 'final' },
  { tag: 'SCORE', team: 'NYM', text: 'Alonso scores on a sac fly to deep center',     meta: 'NYM 2 · PHI 3 · T5', t: '22m', tone: 'score', myteam: true },
  { tag: 'HR',    team: 'BAL', text: 'Henderson — solo shot, 396 ft to right-center', meta: 'BAL 6 · TOR 3 · B7', t: '38m', tone: 'hr' },
  { tag: 'STATUS',team: 'CLE', text: 'Game Final · Cleveland 3, Minnesota 1',        meta: 'CLE 3 · MIN 1 · Final', t: '52m', tone: 'final' },
];

// 4 stories rotating through the carousel
const PSTORIES = [
  { kicker: 'Walk-off Threat', tone: 'warn',
    title: 'Marlins down to their final out, tying run on second',
    body: 'ATL leads 5–4 in the bottom of the 9th. Two outs, runner on second, full count to Arraez.',
    meta: 'ATL @ MIA · B9 · 2 outs', priority: 95 },
  { kicker: 'No-Hitter Watch', tone: 'hr',
    title: "Skenes through 6 perfect against the Cardinals",
    body: "18 up, 18 down. 8 strikeouts. He'll face the top of the order in the 7th.",
    meta: 'PIT @ STL · T7', priority: 88 },
  { kicker: 'Big Inning', tone: 'score',
    title: 'Dodgers put up a 5-spot in the 4th',
    body: 'Bases-clearing double from Betts caps a 7-hit inning that flipped the game.',
    meta: 'LAD @ SF · T4', priority: 72 },
  { kicker: 'Yesterday', tone: 'blue',
    title: 'Soto walked off the Astros in extras',
    body: '11th-inning double scored two. Padres take 3 of 4 from Houston.',
    meta: 'SD 6 · HOU 5 · F/11', priority: 50 },
];

const PNEWS = [
  { src: 'ESPN',   t: '2h', title: 'Cubs DFA reliever amid bullpen reshuffle ahead of trade deadline' },
  { src: 'MLB.com',t: '4h', title: 'Mets recall outfield prospect from Triple-A Syracuse' },
  { src: 'ESPN',   t: '5h', title: 'AL Cy Young race tightens after Skenes-like start in Pittsburgh' },
];

window.PX = PX; window.FX = FX; window.MX = MX;
window.PGAMES = PGAMES; window.PFEED = PFEED; window.PSTORIES = PSTORIES; window.PNEWS = PNEWS;
