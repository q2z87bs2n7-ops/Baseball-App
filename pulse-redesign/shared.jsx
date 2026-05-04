// Shared visual primitives for the Pulse redesign artboards.
// Mock data only — no live polling, no API.

const PULSE = {
  bg:    '#0E1726',
  bg2:   '#152034',
  card:  '#172B4D',
  card2: '#1E3A5F',
  border:'#243A5C',
  text:  '#E6E9F0',
  muted: '#8A95AA',
  dim:   '#5C6B85',
  accent:'#CFD3DC',
  white: '#FFFFFF',
  green: '#3CBE64',
  warn:  '#FFAA3C',
  red:   '#FF5A5A',
  hr:    '#A065FF',
  blue:  '#4FB8FF',
};
const FONT = '"Inter", system-ui, -apple-system, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

// Mock games — drawn from your daily-events spirit
const GAMES = [
  { id: 1, away: 'NYM', home: 'PHI', as: 4, hs: 3, inn: 'T7', state: 'live', risp: true,  outs: 1, hot: true },
  { id: 2, away: 'BOS', home: 'NYY', as: 2, hs: 2, inn: 'B6', state: 'live', risp: false, outs: 2 },
  { id: 3, away: 'LAD', home: 'SF',  as: 7, hs: 1, inn: 'T8', state: 'live', risp: false, outs: 0 },
  { id: 4, away: 'HOU', home: 'TEX', as: 0, hs: 0, inn: 'T1', state: 'live', risp: false, outs: 0 },
  { id: 5, away: 'ATL', home: 'MIA', as: 5, hs: 4, inn: 'B9', state: 'live', risp: true,  outs: 2, hot: true },
  { id: 6, away: 'TOR', home: 'BAL', as: 3, hs: 8, inn: 'F',  state: 'final' },
  { id: 7, away: 'CHC', home: 'STL', as: 6, hs: 6, inn: 'T10',state: 'live', risp: false, outs: 1 },
  { id: 8, away: 'SD',  home: 'AZ',  as: 0, hs: 0, inn: '7:10p', state: 'preview' },
  { id: 9, away: 'MIN', home: 'CLE', as: 1, hs: 3, inn: 'F',  state: 'final' },
];

const FEED_ITEMS = [
  { tag: 'HR', team: 'NYM', text: 'Lindor crushes a 2-run shot to right (412 ft)', meta: 'NYM 4 · PHI 3 · T7', t: 'just now', tone: 'hr' },
  { tag: 'SCORE', team: 'ATL', text: 'Acuña doubles, scores Albies from second', meta: 'ATL 5 · MIA 4 · B9', t: '2m', tone: 'score' },
  { tag: 'RISP', team: 'NYM', text: 'Runner moves to 3rd on a wild pitch', meta: 'NYM 4 · PHI 3 · T7', t: '3m', tone: 'risp' },
  { tag: 'HR', team: 'LAD', text: 'Ohtani — 3-run blast (440 ft, 112 mph EV)', meta: 'LAD 7 · SF 1 · T8', t: '6m', tone: 'hr' },
  { tag: 'SCORE', team: 'CHC', text: 'Suzuki singles, Happ scores from 2nd to tie', meta: 'CHC 6 · STL 6 · T10', t: '8m', tone: 'score' },
  { tag: 'STATUS', team: 'HOU', text: 'First pitch at Globe Life Field', meta: 'HOU @ TEX · T1', t: '9m', tone: 'status' },
  { tag: 'FINAL', team: 'BAL', text: 'Orioles take it 8–3 over Toronto', meta: 'BAL 8 · TOR 3 · Final', t: '14m', tone: 'final' },
];

const STORY = {
  kicker: 'Walk-off Threat',
  title: 'Marlins down to their final out, tying run on second',
  body: 'ATL leads 5–4 in the bottom of the 9th. Two outs, runner on second, full count to Arraez.',
  meta: 'ATL @ MIA · B9 · 2 outs',
};

const FOCUS = {
  kicker: 'At-Bat Focus · Auto',
  away: 'NYM', home: 'PHI', as: 4, hs: 3, inn: 'T7', outs: 1,
  bases: { first: false, second: true, third: true },
  count: { b: 2, s: 2 },
  batter: 'Pete Alonso',
  batterStat: '2-3, HR, RBI · .284 / .362 / .521',
  pitcher: 'Aaron Nola',
  pitcherStat: '6.1 IP, 5H, 2ER, 7K',
  pitches: ['B','S','S','F','B','—'],
  tension: 84,
};

// ---- Tiny presentational atoms ----
const Bolt = ({ size=14, color }) => (
  <span style={{ color: color || PULSE.accent, fontSize: size, lineHeight:1, display:'inline-block', transform:'translateY(-1px)' }}>⚡</span>
);

const Dot = ({ color=PULSE.green, size=6, pulse=false }) => (
  <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:color, boxShadow: pulse ? `0 0 0 4px ${color}22` : 'none' }} />
);

const Diamond = ({ first, second, third, size=14 }) => {
  const cell = (on) => ({
    width: size*0.45, height: size*0.45,
    background: on ? PULSE.warn : 'transparent',
    border: `1.5px solid ${on ? PULSE.warn : PULSE.border}`,
    transform: 'rotate(45deg)',
  });
  return (
    <div style={{ position:'relative', width:size*1.6, height:size*1.6 }}>
      <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)' }}><div style={cell(second)} /></div>
      <div style={{ position:'absolute', top:'50%', left:0, transform:'translateY(-50%)' }}><div style={cell(third)} /></div>
      <div style={{ position:'absolute', top:'50%', right:0, transform:'translateY(-50%)' }}><div style={cell(first)} /></div>
    </div>
  );
};

const OutsDots = ({ outs }) => (
  <span style={{ display:'inline-flex', gap:3 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width:6, height:6, borderRadius:'50%',
        border:`1.5px solid ${i < outs ? PULSE.red : 'rgba(255,90,90,0.45)'}`,
        background: i < outs ? PULSE.red : 'transparent',
      }} />
    ))}
  </span>
);

const TickerChip = ({ g, hot=false, dim=false, themed=false }) => {
  const isLive = g.state === 'live';
  const isFinal = g.state === 'final';
  const isPreview = g.state === 'preview';
  return (
    <div style={{
      flexShrink: 0,
      background: hot ? 'rgba(255,170,60,0.06)' : PULSE.card,
      border: `1px solid ${themed ? '#FF5910' : hot ? PULSE.warn : PULSE.border}`,
      borderRadius: 8, padding: '6px 10px',
      opacity: isFinal ? 0.55 : isPreview ? 0.7 : (dim ? 0.4 : 1),
      display:'flex', flexDirection:'column', gap:3, minWidth: 110,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {isLive && <Dot color={hot ? PULSE.warn : PULSE.green} pulse />}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: PULSE.text, letterSpacing:'.02em' }}>
          {g.away} <span style={{color:PULSE.muted, fontWeight:600}}>{g.as}</span>
          <span style={{ color: PULSE.dim, margin:'0 4px' }}>·</span>
          {g.home} <span style={{color:PULSE.muted, fontWeight:600}}>{g.hs}</span>
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color: PULSE.muted, fontWeight:600, fontFamily: MONO }}>
        <span>{g.inn}</span>
        {isLive && <><Diamond first={false} second={!!g.risp} third={!!g.risp} /> <OutsDots outs={g.outs||0} /></>}
        {hot && <span style={{color:PULSE.warn, fontWeight:800, letterSpacing:'.1em', fontSize:9.5}}>HOT</span>}
      </div>
    </div>
  );
};

const FeedRow = ({ item, dense=false }) => {
  const tone = {
    hr:    { bg: 'rgba(160,100,255,0.10)', bd: 'rgba(160,100,255,0.35)', fg: '#C9A8FF' },
    score: { bg: 'rgba(60,190,100,0.08)',  bd: 'rgba(60,190,100,0.30)',  fg: '#7BD79A' },
    risp:  { bg: 'rgba(255,170,60,0.06)',  bd: 'rgba(255,170,60,0.28)',  fg: '#FFC36F' },
    final: { bg: 'transparent',            bd: PULSE.border,             fg: PULSE.muted },
    status:{ bg: 'transparent',            bd: PULSE.border,             fg: PULSE.muted },
  }[item.tone];
  return (
    <div style={{
      display:'flex', gap:12, padding: dense ? '8px 12px' : '12px 14px',
      borderRadius: 8, background: tone.bg, border: `1px solid ${tone.bd}`,
      fontFamily: FONT,
    }}>
      <div style={{
        flexShrink:0, width: 48, fontFamily: MONO, fontSize: 10, fontWeight: 700,
        letterSpacing:'.1em', color: tone.fg, paddingTop: 2,
      }}>{item.tag}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: dense ? 13 : 14, color: PULSE.text, fontWeight: 500, lineHeight: 1.4 }}>{item.text}</div>
        <div style={{ fontSize: 11.5, color: PULSE.muted, marginTop: 2, fontFamily: MONO }}>{item.meta}</div>
      </div>
      <div style={{ flexShrink:0, fontSize: 11, color: PULSE.dim, fontFamily: MONO, paddingTop: 3 }}>{item.t}</div>
    </div>
  );
};

const SectionLabel = ({ children, kicker, action }) => (
  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'20px 0 10px' }}>
    <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
      {kicker && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase' }}>{kicker}</span>}
      <span style={{ fontSize: 13.5, fontWeight: 700, color: PULSE.text, letterSpacing:'.02em' }}>{children}</span>
    </div>
    {action && <span style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>{action}</span>}
  </div>
);

window.PULSE = PULSE; window.FONT = FONT; window.MONO = MONO;
window.GAMES = GAMES; window.FEED_ITEMS = FEED_ITEMS; window.STORY = STORY; window.FOCUS = FOCUS;
window.Bolt = Bolt; window.Dot = Dot; window.Diamond = Diamond; window.OutsDots = OutsDots;
window.TickerChip = TickerChip; window.FeedRow = FeedRow; window.SectionLabel = SectionLabel;
