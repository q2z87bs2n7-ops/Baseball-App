// Mobile Pulse — sticky Focus strip approach.
// Top bar (compact) → ticker → SCROLL-PERSISTENT focus strip → carousel → feed.
// Tapping the strip opens a fullscreen Focus overlay.

const PMobile = ({ focus, story, storyIdx, storyTotal, onSwapStory, lens, onLens, onOpenFocus, scheme, onScheme, sound, onSound }) => (
  <div style={{
    width: 390, height: 844, background: PX.bg, color: PX.text, fontFamily: FX,
    borderRadius: 32, overflow:'hidden', position:'relative',
    display:'flex', flexDirection:'column',
    border:`1px solid #000`,
  }}>
    {/* Status bar */}
    <div style={{ height: 44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', fontSize: 12, color: PX.text, fontFamily: MX, fontWeight: 700, flexShrink:0 }}>
      <span>9:41</span>
      <span>● ● ●</span>
    </div>

    {/* Compact top bar */}
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', background:'rgba(255,170,60,0.06)', borderBottom:`1px solid ${PX.border}`, flexShrink:0 }}>
      <PBolt size={14} color={PX.warn} />
      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing:'.24em', color: PX.white }}>MLB PULSE</span>
      <span style={{ fontSize: 10, color: PX.dim, fontFamily: MX }}>·</span>
      <span style={{ fontSize: 10.5, color: PX.green, fontFamily: MX, fontWeight:700 }}>● 5</span>
      <span style={{ fontSize: 10.5, color: PX.muted, fontFamily: MX, fontWeight:700 }}>2F</span>
      <div style={{ flex:1 }} />
      <span onClick={onSound} style={{ fontSize: 14, cursor:'pointer', opacity: sound?1:0.4 }}>🔊</span>
      <span onClick={onScheme} style={{ fontSize: 14, cursor:'pointer', marginLeft: 8 }}>{scheme==='dark'?'☀️':'🌙'}</span>
    </div>

    {/* Ticker */}
    <div style={{ display:'flex', gap:5, padding:'8px 12px', background: PX.bg2, borderBottom:`1px solid ${PX.border}`, overflowX:'auto', flexShrink:0 }}>
      {PGAMES.filter(g=>g.state==='live').slice(0,5).map(g => (
        <PChip key={g.id} g={g} active={g.id === focus.id} dim={lens && !g.myteam} />
      ))}
    </div>

    {/* Sticky Focus strip — tap to open overlay */}
    <div onClick={onOpenFocus} style={{
      padding:'10px 14px',
      background: 'linear-gradient(90deg, rgba(255,170,60,0.10), rgba(255,170,60,0.02))',
      borderBottom:`1px solid ${PX.border}`,
      display:'flex', alignItems:'center', gap:10, cursor:'pointer', flexShrink:0,
      borderLeft: focus.myteam ? `3px solid ${PX.team}` : 'none',
    }}>
      <PDot color={PX.warn} pulse size={7} />
      <div style={{ flex:1, minWidth: 0 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
          <span style={{ fontSize: 14, fontWeight: 900, color: PX.white, fontFamily: MX }}>
            {focus.away} {focus.as} · {focus.home} {focus.hs}
          </span>
          <span style={{ fontSize: 11, color: PX.warn, fontFamily: MX, fontWeight: 700 }}>{focus.inn}</span>
        </div>
        <div style={{ fontSize: 10.5, color: PX.muted, fontFamily: MX, marginTop: 1, display:'flex', alignItems:'center', gap:8 }}>
          <PDiamond first={focus.bases.first} second={focus.bases.second} third={focus.bases.third} size={14} />
          <span>{focus.count.b}–{focus.count.s}</span>
          <POuts outs={focus.outs} />
          <span style={{color: PX.dim, marginLeft:4 }}>· {focus.batter}</span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: PX.warn, fontFamily: MX, fontWeight: 700, letterSpacing:'.1em' }}>OPEN ›</span>
    </div>

    {/* Scroll content */}
    <div style={{ flex:1, overflowY:'auto', padding:'12px 14px 24px' }}>
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 7 }}>
        <PKicker color={({warn:PX.warn,hr:PX.hr,score:PX.green,blue:PX.blue})[story.tone]||PX.muted}>Story · {story.kicker}</PKicker>
        <span style={{ fontSize: 10, color: PX.dim, fontFamily: MX }} onClick={()=>onSwapStory(1)}>{storyIdx+1}/{storyTotal} ›</span>
      </div>
      <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderLeft:`3px solid ${({warn:PX.warn,hr:PX.hr,score:PX.green,blue:PX.blue})[story.tone]||PX.muted}`, borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: PX.white, lineHeight:1.3 }}>{story.title}</div>
        <div style={{ fontSize: 11.5, color: PX.muted, marginTop: 6, lineHeight:1.5 }}>{story.body}</div>
        <div style={{ display:'flex', gap:4, marginTop: 8 }}>
          {Array(storyTotal).fill(0).map((_,i)=>(
            <span key={i} style={{ width:4, height:4, borderRadius:'50%', background: i===storyIdx?PX.warn:PX.border }} />
          ))}
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 7 }}>
        <PKicker>Live · firehose</PKicker>
        {lens && <span style={{ fontSize: 9.5, color: PX.team, fontFamily: MX, fontWeight: 700, letterSpacing:'.1em' }}>● MY TEAM</span>}
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {PFEED.filter(it => !lens || it.myteam).map((it,i)=> <PFeedRow key={i} item={it} dense />)}
      </div>
    </div>
  </div>
);

// Fullscreen Focus overlay (mobile only)
const PMobileFocus = ({ focus, onClose }) => (
  <div style={{ width: 390, height: 844, background: PX.bg, color: PX.text, fontFamily: FX, borderRadius: 32, overflow:'hidden', position:'relative', border:`1px solid #000`, display:'flex', flexDirection:'column' }}>
    <div style={{ height: 44, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', fontSize: 12, fontFamily: MX, fontWeight: 700 }}>
      <span>9:41</span><span>● ● ●</span>
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:`1px solid ${PX.border}` }}>
      <span onClick={onClose} style={{ fontSize: 14, color: PX.muted, cursor:'pointer' }}>‹ Back</span>
      <div style={{ flex:1 }} />
      <PKicker color={PX.warn}>Tension {focus.tension}</PKicker>
    </div>
    <div style={{ flex:1, padding:14, overflowY:'auto' }}>
      <PFocusCard game={focus} />
    </div>
  </div>
);

window.PMobile = PMobile; window.PMobileFocus = PMobileFocus;
