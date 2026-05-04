// Hero zone — Focus card with broadcast score-bug + lower-third story strap.
// Two clearly-Layer-2 modules side by side.

const PHero = ({ game, story, onSwapStory, storyIdx, storyTotal }) => {
  if (!game || game.state !== 'live') return <PHeroEmpty />;
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:14 }}>
      <PFocusCard game={game} />
      <PStoryCard story={story} idx={storyIdx} total={storyTotal} onSwap={onSwapStory} />
    </div>
  );
};

const PHeroEmpty = () => (
  <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 12, padding: 24, textAlign:'center' }}>
    <div style={{ fontSize: 13, color: PX.muted, fontFamily: MX, letterSpacing:'.1em' }}>NO LIVE GAMES</div>
    <div style={{ fontSize: 17, color: PX.white, marginTop: 6, fontWeight: 600 }}>Slate complete · next first pitch in 14h 32m</div>
  </div>
);

const PFocusCard = ({ game }) => (
  <div style={{
    background: `radial-gradient(ellipse at top right, rgba(255,170,60,0.12), transparent 55%), ${PX.card}`,
    border: `1px solid ${PX.border}`, borderRadius: 12, overflow:'hidden',
    borderTop: `2px solid ${PX.warn}`,
  }}>
    {/* Top kicker bar */}
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 18px', background: PX.tint, borderBottom:`1px solid ${PX.border}` }}>
      <PDot color={PX.warn} pulse size={7} />
      <PKicker color={PX.warn}>At-Bat Focus · Tension {game.tension}</PKicker>
      {game.myteam && <span style={{ fontSize: 9.5, color: PX.team, fontWeight: 800, letterSpacing:'.16em', textTransform:'uppercase', padding:'2px 6px', border:`1px solid ${PX.team}55`, borderRadius: 3 }}>YOUR TEAM</span>}
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 10, color: PX.dim, fontFamily: MX, letterSpacing:'.12em' }}>↩ AUTO</span>
    </div>

    {/* Score bug — broadcast lead */}
    <div style={{ padding:'18px 22px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', gap: 16 }}>
      <PTeamBlock abbr={game.away} score={game.as} record="48-39" />
      <div style={{ textAlign:'center', minWidth: 80 }}>
        <div style={{ fontSize: 10, color: PX.dim, fontFamily: MX, letterSpacing:'.18em' }}>INNING</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: PX.white, fontFamily: MX, letterSpacing:'-.03em', lineHeight: 1.05 }}>{game.inn}</div>
      </div>
      <PTeamBlock abbr={game.home} score={game.hs} record="50-37" right />
    </div>

    {/* Count strip — broadcast graphic */}
    <div style={{ display:'flex', alignItems:'center', gap: 18, padding:'12px 22px', borderTop:`1px solid ${PX.border}`, borderBottom:`1px solid ${PX.border}`, background: PX.tint }}>
      <PDiamond first={game.bases.first} second={game.bases.second} third={game.bases.third} size={26} />
      <div>
        <div style={{ fontSize: 9.5, color: PX.dim, fontFamily: MX, letterSpacing:'.16em' }}>B</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: PX.green, fontFamily: MX }}>{game.count.b}</div>
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: PX.dim, fontFamily: MX, letterSpacing:'.16em' }}>S</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: PX.red, fontFamily: MX }}>{game.count.s}</div>
      </div>
      <div>
        <div style={{ fontSize: 9.5, color: PX.dim, fontFamily: MX, letterSpacing:'.16em' }}>OUT</div>
        <div style={{ paddingTop: 5 }}><POuts outs={game.outs} /></div>
      </div>
      <div style={{ flex:1 }} />
      <div style={{ display:'flex', gap: 4 }}>
        {[...game.pitches, ...Array(Math.max(0, 6 - game.pitches.length)).fill('—')].slice(0,6).map((p,i)=>(
          <span key={i} style={{
            width:22, height:28, borderRadius:3,
            background: p==='—'?'transparent':p==='S'?PX.red:p==='B'?PX.green:p==='F'?PX.warn:PX.muted,
            border: p==='—'?`1px solid ${PX.border}`:'none',
            color:PX.white, fontSize:11.5, fontWeight:900, fontFamily:MX,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>{p==='—'?'':p}</span>
        ))}
      </div>
    </div>

    {/* Matchup */}
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding:'14px 22px' }}>
      <div>
        <div style={{ fontSize: 10, color: PX.dim, fontFamily: MX, letterSpacing:'.16em' }}>AT BAT</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: PX.white }}>{game.batter}</div>
        <div style={{ fontSize: 11, color: PX.muted, fontFamily: MX, marginTop: 1 }}>{game.bStat}</div>
      </div>
      <div style={{ borderLeft: `1px solid ${PX.border}`, paddingLeft: 22 }}>
        <div style={{ fontSize: 10, color: PX.dim, fontFamily: MX, letterSpacing:'.16em' }}>PITCHING</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: PX.white }}>{game.pitcher}</div>
        <div style={{ fontSize: 11, color: PX.muted, fontFamily: MX, marginTop: 1 }}>{game.pStat}</div>
      </div>
    </div>
  </div>
);

const PTeamBlock = ({ abbr, score, record, right }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems: right ? 'flex-end':'flex-start', gap:5, flex:1, minWidth: 0 }}>
    <div style={{ display:'flex', alignItems:'center', gap:12, flexDirection: right ? 'row-reverse':'row' }}>
      <div style={{ width: 40, height:40, borderRadius:8, background: PX.bg2, border:`1px solid ${PX.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12, fontWeight: 900, color: PX.white, fontFamily: MX, letterSpacing:'.04em', flexShrink:0 }}>{abbr}</div>
      <span style={{ fontSize: 44, fontWeight: 900, color: PX.white, fontFamily: MX, letterSpacing:'-.04em', lineHeight: 1 }}>{score}</span>
    </div>
    <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX, letterSpacing:'.12em' }}>{record}</span>
  </div>
);

// Story card — distinct visual treatment from feed (lower-third broadcast feel)
const PStoryCard = ({ story, idx, total, onSwap }) => {
  if (!story) return null;
  const toneColor = { warn: PX.warn, hr: PX.hr, score: PX.green, blue: PX.blue }[story.tone] || PX.muted;
  return (
    <div style={{
      background: `linear-gradient(155deg, ${toneColor}18, transparent 55%), ${PX.card}`,
      border: `1px solid ${PX.border}`, borderLeft: `3px solid ${toneColor}`,
      borderRadius: 12, padding: 18, display:'flex', flexDirection:'column', minHeight: 0,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <PKicker color={toneColor}>Story · {story.kicker}</PKicker>
        <div style={{ flex:1 }} />
        <button onClick={()=>onSwap(-1)} style={navBtn}>‹</button>
        <span style={{ fontSize: 10, color: PX.dim, fontFamily: MX }}>{idx+1} / {total}</span>
        <button onClick={()=>onSwap(1)} style={navBtn}>›</button>
      </div>
      <div style={{ flex:1, padding:'14px 0' }}>
        <div style={{ fontSize: 21, fontWeight: 800, color: PX.white, lineHeight:1.25, letterSpacing:'-.01em' }}>{story.title}</div>
        <div style={{ fontSize: 13, color: PX.muted, marginTop: 10, lineHeight:1.55 }}>{story.body}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5, paddingTop:10, borderTop:`1px solid ${PX.border}` }}>
        {Array(total).fill(0).map((_,i)=>(
          <span key={i} style={{ width:5, height:5, borderRadius:'50%', background: i===idx?toneColor:PX.border }} />
        ))}
        <div style={{ flex:1 }} />
        <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX, letterSpacing:'.04em' }}>{story.meta}</span>
      </div>
    </div>
  );
};

const navBtn = { background:'transparent', border:`1px solid ${PX.border}`, color: PX.muted, width:22, height:22, borderRadius:4, cursor:'pointer', fontSize: 12, lineHeight:1, padding:0, fontFamily: FX };

window.PHero = PHero; window.PFocusCard = PFocusCard; window.PStoryCard = PStoryCard;
