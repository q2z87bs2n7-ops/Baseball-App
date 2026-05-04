// Direction C — Broadcast Control Room.
// Pulse as a sports-TV graphics package, inspired by the user's "TV" reference.
// Three vertical zones: Left dock (live game board, persistent), Center stage
// (Focus + Story rotating as paired feature), Right column (narrative play feed).
// Bold, but every existing feature still has a home.

const DirectionC = () => {
  const W = 1280;
  return (
    <div style={{ width: W, background: '#0A1322', color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow:'hidden' }}>
      {/* Broadcast bar — wide, dense, full-bleed */}
      <div style={{ display:'flex', alignItems:'stretch', background:'linear-gradient(180deg,#0F1B2E,#08111F)', borderBottom:`1px solid ${PULSE.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 22px', background:'rgba(255,170,60,0.08)', borderRight:`1px solid ${PULSE.border}` }}>
          <Bolt size={20} color={PULSE.warn} />
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing:'.26em', color: PULSE.white }}>MLB PULSE</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:24, padding:'0 22px', flex:1, fontFamily: MONO }}>
          <span style={{ fontSize: 11, color: PULSE.dim, letterSpacing:'.14em' }}>LIVE</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: PULSE.green }}>7</span>
          <span style={{ width:1, height:18, background: PULSE.border }} />
          <span style={{ fontSize: 11, color: PULSE.dim, letterSpacing:'.14em' }}>FINAL</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: PULSE.muted }}>2</span>
          <span style={{ width:1, height:18, background: PULSE.border }} />
          <span style={{ fontSize: 11, color: PULSE.dim, letterSpacing:'.14em' }}>UPCOMING</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: PULSE.muted }}>2</span>
          <div style={{ flex:1 }} />
          <span style={{ fontSize: 11, color: PULSE.warn, letterSpacing:'.12em', display:'flex', alignItems:'center', gap:6 }}><Dot color={PULSE.warn} size={6} pulse />YOUR GAME · NYM T7 · TIED</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 18px', borderLeft:`1px solid ${PULSE.border}` }}>
          {['🔊','📻','☀️'].map((l,i)=>(
            <span key={i} style={{ width:32, height:32, borderRadius:6, background:'rgba(255,255,255,0.04)', border:`1px solid ${PULSE.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 14, cursor:'pointer' }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Three-column stage */}
      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr 320px', gap:0 }}>

        {/* LEFT DOCK — vertical scoreboard, the entire ticker becomes a board */}
        <div style={{ borderRight:`1px solid ${PULSE.border}`, background:'#0C1726', padding:'14px 12px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase' }}>Live Board</span>
            <span style={{ fontSize: 9.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>SORT · TENSION</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {GAMES.map(g => <BoardRow key={g.id} g={g} active={g.id===1} themed={g.away==='NYM'} />)}
          </div>
        </div>

        {/* CENTER STAGE — Focus card as the main event */}
        <div style={{ padding:'18px 22px' }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom: 12 }}>
            <Dot color={PULSE.warn} pulse size={8} />
            <span style={{ fontSize: 11, fontWeight:800, letterSpacing:'.20em', color: PULSE.warn, textTransform:'uppercase' }}>NOW · Highest Tension</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>↩ AUTO</span>
          </div>

          {/* Big scoreboard moment */}
          <div style={{ background:`radial-gradient(ellipse at top right, rgba(255,170,60,0.12), transparent 50%), ${PULSE.card}`, border:`1px solid ${PULSE.border}`, borderRadius: 12, overflow:'hidden' }}>
            <div style={{ padding:'18px 22px 14px', borderBottom:`1px solid ${PULSE.border}` }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 20 }}>
                <Team abbr={FOCUS.away} score={FOCUS.as} record="48-39" />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize: 12, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>INNING</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: PULSE.white, fontFamily: MONO }}>{FOCUS.inn}</div>
                  <div style={{ fontSize: 11, color: PULSE.warn, fontFamily: MONO, letterSpacing:'.12em', fontWeight:700, marginTop: 2 }}>TENSION {FOCUS.tension}</div>
                </div>
                <Team abbr={FOCUS.home} score={FOCUS.hs} record="50-37" right />
              </div>
            </div>

            {/* Live count strip — broadcast graphics */}
            <div style={{ display:'flex', alignItems:'center', gap: 22, padding:'14px 22px', background: 'rgba(0,0,0,0.18)', borderBottom:`1px solid ${PULSE.border}` }}>
              <Diamond first={FOCUS.bases.first} second={FOCUS.bases.second} third={FOCUS.bases.third} size={28} />
              <div>
                <div style={{ fontSize: 9.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>BALL</div>
                <div style={{ fontSize: 22, fontWeight:900, color: PULSE.green, fontFamily: MONO }}>{FOCUS.count.b}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>STRIKE</div>
                <div style={{ fontSize: 22, fontWeight:900, color: PULSE.red, fontFamily: MONO }}>{FOCUS.count.s}</div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>OUT</div>
                <div style={{ paddingTop: 6 }}><OutsDots outs={FOCUS.outs} /></div>
              </div>
              <div style={{ flex:1 }} />
              <div style={{ display:'flex', gap: 4 }}>
                {FOCUS.pitches.map((p,i)=>(
                  <span key={i} style={{ width:24, height:30, borderRadius:3, background: p==='—'?'transparent':p==='S'?PULSE.red:p==='B'?PULSE.green:PULSE.muted, border: p==='—'?`1px solid ${PULSE.border}`:'none', color:PULSE.white, fontSize:12, fontWeight:900, fontFamily:MONO, display:'flex', alignItems:'center', justifyContent:'center' }}>{p==='—'?'':p}</span>
                ))}
              </div>
            </div>

            {/* Matchup strip */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', padding: '14px 22px' }}>
              <div>
                <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>AT BAT</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: PULSE.white }}>{FOCUS.batter}</div>
                <div style={{ fontSize: 11.5, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.batterStat}</div>
              </div>
              <div style={{ borderLeft:`1px solid ${PULSE.border}`, paddingLeft: 22 }}>
                <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.16em' }}>PITCHING</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: PULSE.white }}>{FOCUS.pitcher}</div>
                <div style={{ fontSize: 11.5, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.pitcherStat}</div>
              </div>
            </div>
          </div>

          {/* Story under-strap — a TV-style "lower third" rotating between stages */}
          <div style={{ marginTop: 14, background:'linear-gradient(90deg, rgba(160,100,255,0.18), rgba(160,100,255,0.04))', border:`1px solid rgba(160,100,255,0.30)`, borderLeft:`3px solid ${PULSE.hr}`, borderRadius: 6, padding:'10px 14px', display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize: 10, fontWeight:900, letterSpacing:'.20em', color: PULSE.hr, textTransform:'uppercase', whiteSpace:'nowrap' }}>{STORY.kicker}</span>
            <div style={{ width:1, height:18, background:'rgba(160,100,255,0.35)' }} />
            <span style={{ fontSize: 13.5, color: PULSE.white, fontWeight:600, lineHeight:1.35 }}>{STORY.title}</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO }}>3 / 11 ‹ ›</span>
          </div>

          {/* Yesterday + collection cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop: 14 }}>
            <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 14, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize: 18 }}>📼</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize: 12, fontWeight:700, color: PULSE.white }}>Yesterday's Recap</div>
                <div style={{ fontSize: 10.5, color: PULSE.muted, fontFamily: MONO }}>9 games · 23 highlights</div>
              </div>
              <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO }}>›</span>
            </div>
            <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 14, display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:24, height:32, borderRadius:3, background:`linear-gradient(135deg, ${PULSE.hr}, #6041AA)` }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize: 12, fontWeight:700, color: PULSE.white }}>Collection · +1 today</div>
                <div style={{ fontSize: 10.5, color: PULSE.muted, fontFamily: MONO }}>14 of 30 teams</div>
              </div>
              <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO }}>›</span>
            </div>
          </div>
        </div>

        {/* RIGHT — Live narrative feed */}
        <div style={{ borderLeft:`1px solid ${PULSE.border}`, background:'#0C1726', padding:'14px 14px 18px' }}>
          <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase' }}>Play feed</span>
            <span style={{ fontSize: 9.5, color: PULSE.green, fontFamily: MONO, letterSpacing:'.1em', display:'flex', alignItems:'center', gap:5 }}><Dot color={PULSE.green} size={5} pulse />LIVE</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {FEED_ITEMS.map((it,i)=> <FeedRow key={i} item={it} dense />)}
          </div>
        </div>
      </div>
    </div>
  );
};

const BoardRow = ({ g, active, themed }) => {
  const isLive = g.state === 'live';
  return (
    <div style={{
      display:'flex', alignItems:'stretch', gap:0,
      background: active ? 'rgba(255,170,60,0.10)' : 'transparent',
      border: `1px solid ${active ? PULSE.warn : 'transparent'}`,
      borderLeft: themed ? `2px solid #FF5910` : (active ? `2px solid ${PULSE.warn}` : `2px solid transparent`),
      borderRadius: 4, padding: '6px 8px', cursor:'pointer',
      opacity: g.state === 'final' ? 0.5 : g.state === 'preview' ? 0.7 : 1,
    }}>
      <div style={{ width: 14, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {isLive && <Dot color={g.hot ? PULSE.warn : PULSE.green} pulse size={5} />}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize: 11.5, fontFamily: MONO, fontWeight: 700, color: PULSE.text }}>
          <span>{g.away}</span><span>{g.as}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize: 11.5, fontFamily: MONO, fontWeight: 700, color: PULSE.text }}>
          <span>{g.home}</span><span>{g.hs}</span>
        </div>
      </div>
      <div style={{ width: 30, textAlign:'right', display:'flex', flexDirection:'column', justifyContent:'space-between', alignItems:'flex-end', flexShrink:0 }}>
        <span style={{ fontSize: 9.5, color: g.hot ? PULSE.warn : PULSE.muted, fontFamily: MONO, fontWeight: 700, letterSpacing:'.06em' }}>{g.inn}</span>
        {isLive && <OutsDots outs={g.outs||0} />}
      </div>
    </div>
  );
};

const Team = ({ abbr, score, record, right }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems: right ? 'flex-end':'flex-start', gap:4, flex:1 }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, flexDirection: right ? 'row-reverse':'row' }}>
      <div style={{ width: 36, height:36, borderRadius:8, background: PULSE.bg2, border:`1px solid ${PULSE.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize: 12, fontWeight: 900, color: PULSE.white, fontFamily: MONO, letterSpacing:'.04em' }}>{abbr}</div>
      <span style={{ fontSize: 44, fontWeight:900, color: PULSE.white, fontFamily: MONO, letterSpacing:'-.04em', lineHeight: 1 }}>{score}</span>
    </div>
    <span style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>{record}</span>
  </div>
);

// MOBILE — direction C
// Mobile keeps the broadcast feel: top status strip + Focus stage + collapsed
// board (horizontal chips) + feed underneath. The "lower third" story strap stays.
const DirectionCMobile = () => (
  <div style={{ width: 390, background: '#0A1322', color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow:'hidden' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'rgba(255,170,60,0.06)', borderBottom:`1px solid ${PULSE.border}` }}>
      <Bolt size={14} color={PULSE.warn} />
      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing:'.24em', color: PULSE.white }}>MLB PULSE</span>
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 11, color: PULSE.green, fontFamily: MONO }}>● 7</span>
      <span style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>2F</span>
      <span style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>2↗</span>
    </div>
    <div style={{ display:'flex', gap:5, padding:'8px 12px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}`, overflow:'hidden' }}>
      {GAMES.slice(0,4).map(g => <TickerChip key={g.id} g={g} hot={g.hot} themed={g.away==='NYM'} />)}
    </div>
    {/* Stage */}
    <div style={{ padding:'14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 10 }}>
        <Dot color={PULSE.warn} pulse />
        <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.18em', color: PULSE.warn, textTransform:'uppercase' }}>Now · Tension {FOCUS.tension}</span>
      </div>
      <div style={{ background:`radial-gradient(ellipse at top, rgba(255,170,60,0.12), transparent 60%), ${PULSE.card}`, border:`1px solid ${PULSE.border}`, borderRadius: 10, overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:`1px solid ${PULSE.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Team abbr={FOCUS.away} score={FOCUS.as} record="48-39" />
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize: 22, fontWeight:900, fontFamily: MONO, color:PULSE.white }}>{FOCUS.inn}</div>
          </div>
          <Team abbr={FOCUS.home} score={FOCUS.hs} record="50-37" right />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'rgba(0,0,0,0.18)' }}>
          <Diamond first={FOCUS.bases.first} second={FOCUS.bases.second} third={FOCUS.bases.third} size={20} />
          <span style={{ fontSize: 14, fontWeight:900, color: PULSE.white, fontFamily: MONO }}>{FOCUS.count.b}–{FOCUS.count.s}</span>
          <OutsDots outs={FOCUS.outs} />
          <div style={{ flex:1, display:'flex', justifyContent:'flex-end', gap:3 }}>
            {FOCUS.pitches.slice(0,5).map((p,i)=>(
              <span key={i} style={{ width:14, height:18, borderRadius:2, background: p==='S'?PULSE.red:p==='B'?PULSE.green:PULSE.muted, color:PULSE.white, fontSize:9, fontWeight:800, fontFamily:MONO, display:'flex', alignItems:'center', justifyContent:'center' }}>{p}</span>
            ))}
          </div>
        </div>
        <div style={{ padding:'10px 14px', fontSize: 12, color: PULSE.white, fontWeight: 700 }}>
          {FOCUS.batter} <span style={{color:PULSE.muted, fontWeight:500}}>vs</span> {FOCUS.pitcher}
        </div>
      </div>

      {/* Story strap */}
      <div style={{ marginTop: 12, background:'linear-gradient(90deg, rgba(160,100,255,0.18), rgba(160,100,255,0.04))', borderLeft:`3px solid ${PULSE.hr}`, borderRadius: 4, padding:'8px 12px' }}>
        <div style={{ fontSize: 10, fontWeight:900, letterSpacing:'.18em', color: PULSE.hr, textTransform:'uppercase', marginBottom: 3 }}>{STORY.kicker}</div>
        <div style={{ fontSize: 12.5, color: PULSE.white, lineHeight:1.35 }}>{STORY.title}</div>
      </div>

      <SectionLabel kicker="Live · firehose">Play feed</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {FEED_ITEMS.slice(0,5).map((it,i)=> <FeedRow key={i} item={it} dense />)}
      </div>
    </div>
  </div>
);

window.DirectionC = DirectionC;
window.DirectionCMobile = DirectionCMobile;
