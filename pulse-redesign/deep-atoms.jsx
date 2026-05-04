// Reusable presentational atoms for the deep Pulse mock.

const PBolt = ({ size=14, color }) => (
  <span style={{ color: color || PX.warn, fontSize: size, lineHeight:1, display:'inline-block', transform:'translateY(-1px)' }}>⚡</span>
);

const PDot = ({ color=PX.green, size=6, pulse=false }) => (
  <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:color, boxShadow: pulse ? `0 0 0 4px ${color}22` : 'none', flexShrink:0 }} />
);

const PDiamond = ({ first, second, third, size=14 }) => {
  const cell = (on) => ({
    width: size*0.42, height: size*0.42,
    background: on ? PX.warn : 'transparent',
    border: `1.5px solid ${on ? PX.warn : PX.border}`,
    transform: 'rotate(45deg)',
  });
  return (
    <div style={{ position:'relative', width:size*1.6, height:size*1.6, flexShrink:0 }}>
      <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)' }}><div style={cell(second)} /></div>
      <div style={{ position:'absolute', top:'50%', left:0, transform:'translateY(-50%)' }}><div style={cell(third)} /></div>
      <div style={{ position:'absolute', top:'50%', right:0, transform:'translateY(-50%)' }}><div style={cell(first)} /></div>
    </div>
  );
};

const POuts = ({ outs }) => (
  <span style={{ display:'inline-flex', gap:3 }}>
    {[0,1,2].map(i => (
      <span key={i} style={{
        width:6, height:6, borderRadius:'50%',
        border:`1.5px solid ${i < outs ? PX.red : 'rgba(255,90,90,0.45)'}`,
        background: i < outs ? PX.red : 'transparent',
      }} />
    ))}
  </span>
);

// Ticker chip — clickable to switch focus.
const PChip = ({ g, active, onClick, dim }) => {
  const isLive = g.state === 'live';
  const isFinal = g.state === 'final';
  const isPreview = g.state === 'preview';
  return (
    <div onClick={onClick} style={{
      flexShrink: 0, cursor: isLive ? 'pointer' : 'default',
      background: active ? 'rgba(255,170,60,0.10)' : g.hot ? 'rgba(255,170,60,0.05)' : PX.card,
      border: `1px solid ${active ? PX.warn : g.myteam ? PX.team : g.hot ? 'rgba(255,170,60,0.5)' : PX.border}`,
      borderRadius: 8, padding: '6px 10px',
      opacity: isFinal ? 0.55 : isPreview ? 0.7 : (dim ? 0.35 : 1),
      display:'flex', flexDirection:'column', gap:3, minWidth: 116, transition:'all .12s',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        {isLive && <PDot color={g.hot ? PX.warn : PX.green} pulse />}
        {!isLive && <span style={{ width:6, height:6, flexShrink:0 }} />}
        <span style={{ fontSize: 12.5, fontWeight: 700, color: PX.text, letterSpacing:'.02em' }}>
          {g.away} <span style={{color:PX.muted, fontWeight:600}}>{g.as}</span>
          <span style={{ color: PX.dim, margin:'0 4px' }}>·</span>
          {g.home} <span style={{color:PX.muted, fontWeight:600}}>{g.hs}</span>
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color: PX.muted, fontWeight:600, fontFamily: MX }}>
        <span style={{ minWidth: 24 }}>{g.inn}</span>
        {isLive && <><PDiamond first={g.bases?.first} second={g.bases?.second} third={g.bases?.third} /> <POuts outs={g.outs||0} /></>}
        {g.hot && <span style={{color:PX.warn, fontWeight:800, letterSpacing:'.1em', fontSize:9.5, marginLeft:'auto'}}>HOT</span>}
      </div>
    </div>
  );
};

// Feed row.
const PFeedRow = ({ item, dense, dim }) => {
  const tone = {
    hr:    { bg: 'rgba(160,100,255,0.10)', bd: 'rgba(160,100,255,0.35)', fg: '#C9A8FF' },
    score: { bg: 'rgba(60,190,100,0.08)',  bd: 'rgba(60,190,100,0.30)',  fg: '#7BD79A' },
    risp:  { bg: 'rgba(255,170,60,0.06)',  bd: 'rgba(255,170,60,0.28)',  fg: '#FFC36F' },
    final: { bg: 'transparent',            bd: PX.borderS,               fg: PX.muted },
    status:{ bg: 'transparent',            bd: PX.borderS,               fg: PX.muted },
  }[item.tone];
  return (
    <div style={{
      display:'flex', gap:12, padding: dense ? '8px 12px' : '10px 14px',
      borderRadius: 8, background: tone.bg, border: `1px solid ${tone.bd}`,
      borderLeft: item.myteam ? `3px solid ${PX.team}` : `1px solid ${tone.bd}`,
      fontFamily: FX, opacity: dim ? 0.35 : 1, transition:'opacity .15s',
    }}>
      <div style={{ flexShrink:0, width: 44, fontFamily: MX, fontSize: 10, fontWeight: 700, letterSpacing:'.1em', color: tone.fg, paddingTop: 2 }}>{item.tag}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize: dense ? 12.5 : 13.5, color: PX.text, fontWeight: 500, lineHeight: 1.4 }}>{item.text}</div>
        <div style={{ fontSize: 11, color: PX.muted, marginTop: 2, fontFamily: MX }}>{item.meta}</div>
      </div>
      <div style={{ flexShrink:0, fontSize: 11, color: PX.dim, fontFamily: MX, paddingTop: 3 }}>{item.t}</div>
    </div>
  );
};

const PKicker = ({ children, color }) => (
  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.18em', color: color || PX.dim, textTransform:'uppercase' }}>{children}</span>
);

const PSection = ({ kicker, kickerColor, action, children }) => (
  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'18px 0 10px' }}>
    <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
      <PKicker color={kickerColor}>{kicker}</PKicker>
      {children && <span style={{ fontSize: 13, fontWeight: 700, color: PX.text }}>{children}</span>}
    </div>
    {action && <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX, letterSpacing:'.08em' }}>{action}</span>}
  </div>
);

window.PBolt = PBolt; window.PDot = PDot; window.PDiamond = PDiamond; window.POuts = POuts;
window.PChip = PChip; window.PFeedRow = PFeedRow; window.PKicker = PKicker; window.PSection = PSection;
