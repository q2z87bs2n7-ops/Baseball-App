// Direction B — Hero Focus Zone.
// Reorganizes around the three layers of attention. The Focus zone is now the hero,
// spanning full width above the fold (At-Bat Focus + Story Carousel as paired modules).
// Feed sits below as the firehose. Right rail keeps only ambient/scheduled modules.

const DirectionB = () => {
  const W = 1280;
  return (
    <div style={{ width: W, background: PULSE.bg, color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow:'hidden' }}>
      {/* Denser broadcast-style top bar — Pulse asserts identity */}
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 22px', background:'linear-gradient(180deg,#162338,#0E1726)', borderBottom:`1px solid ${PULSE.border}` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Bolt size={18} color={PULSE.warn} />
          <span style={{ fontSize: 15, fontWeight: 900, letterSpacing:'.24em', color: PULSE.white }}>MLB PULSE</span>
        </div>
        <span style={{ width:1, height:18, background: PULSE.border }} />
        <div style={{ display:'flex', gap:14, fontFamily: MONO, fontSize: 11.5, color: PULSE.muted }}>
          <span><span style={{color:PULSE.green, fontWeight:800}}>● 7</span> LIVE</span>
          <span><span style={{color:PULSE.muted, fontWeight:800}}>2</span> FINAL</span>
          <span><span style={{color:PULSE.muted, fontWeight:800}}>2</span> UPCOMING</span>
        </div>
        <div style={{ flex:1 }} />
        <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>YOUR GAME · NYM T7 · TIED</span>
        <span style={{ width:1, height:18, background: PULSE.border }} />
        {['🔊','📻','☀️'].map((l,i)=>(
          <span key={i} style={{ fontSize: 14, color: PULSE.muted, cursor:'pointer' }}>{l}</span>
        ))}
      </div>

      {/* Ticker */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}`, overflow:'hidden' }}>
        {GAMES.slice(0,7).map(g => <TickerChip key={g.id} g={g} hot={g.hot} themed={g.away==='NYM'} />)}
      </div>

      {/* HERO ZONE — Focus + Story side by side, both clearly Layer 2 */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:14, padding:'18px 18px 6px' }}>
        <div style={{ background:`linear-gradient(160deg, rgba(255,170,60,0.10), transparent 55%), ${PULSE.card}`, border:`1px solid ${PULSE.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: 14 }}>
            <Dot color={PULSE.warn} pulse size={8} />
            <span style={{ fontSize: 11, fontWeight:800, letterSpacing:'.18em', color: PULSE.warn, textTransform:'uppercase' }}>At-Bat Focus · Tension {FOCUS.tension}</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>↩ AUTO · CHANGE GAME</span>
          </div>
          <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
            <span style={{ fontSize: 38, fontWeight: 800, color: PULSE.white, fontFamily: MONO, letterSpacing:'-.03em' }}>
              {FOCUS.away} {FOCUS.as} <span style={{color: PULSE.dim, fontWeight:600}}>·</span> {FOCUS.home} {FOCUS.hs}
            </span>
            <span style={{ fontSize: 16, fontFamily: MONO, color: PULSE.muted }}>{FOCUS.inn}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:24, padding:'14px 0', margin:'10px 0', borderTop:`1px solid ${PULSE.border}`, borderBottom:`1px solid ${PULSE.border}` }}>
            <Diamond first={FOCUS.bases.first} second={FOCUS.bases.second} third={FOCUS.bases.third} size={28} />
            <div>
              <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.14em' }}>COUNT</div>
              <div style={{ fontSize: 22, fontWeight:800, color: PULSE.white, fontFamily: MONO }}>{FOCUS.count.b}–{FOCUS.count.s}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.14em' }}>OUTS</div>
              <div style={{ paddingTop: 6 }}><OutsDots outs={FOCUS.outs} /></div>
            </div>
            <div style={{ flex:1, display:'flex', justifyContent:'flex-end', gap:5 }}>
              {FOCUS.pitches.map((p,i)=>(
                <span key={i} style={{ width:24, height:30, borderRadius:4, background: p==='—'?PULSE.bg2:p==='S'?PULSE.red:p==='B'?PULSE.green:PULSE.muted, opacity: p==='—'?0.4:1, color:PULSE.white, fontSize:12.5, fontWeight:800, fontFamily:MONO, display:'flex', alignItems:'center', justifyContent:'center' }}>{p==='—'?'':p}</span>
              ))}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <div>
              <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.14em' }}>AT BAT</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: PULSE.white }}>{FOCUS.batter}</div>
              <div style={{ fontSize: 11.5, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.batterStat}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.14em' }}>PITCHING</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: PULSE.white }}>{FOCUS.pitcher}</div>
              <div style={{ fontSize: 11.5, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.pitcherStat}</div>
            </div>
          </div>
        </div>

        {/* Story carousel — distinct visual treatment from the feed below */}
        <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 12, padding: 18, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing:'.18em', color: PULSE.hr, textTransform:'uppercase' }}>Story · {STORY.kicker}</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO }}>‹ 3 / 11 ›</span>
          </div>
          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'14px 0' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: PULSE.white, lineHeight:1.25, letterSpacing:'-.01em' }}>{STORY.title}</div>
            <div style={{ fontSize: 13.5, color: PULSE.muted, marginTop: 10, lineHeight:1.55 }}>{STORY.body}</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, paddingTop:10, borderTop:`1px solid ${PULSE.border}` }}>
            {[0,1,2,3,4,5,6,7,8,9,10].map(i=>(
              <span key={i} style={{ width:5, height:5, borderRadius:'50%', background: i===2?PULSE.hr:PULSE.border }} />
            ))}
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO }}>{STORY.meta}</span>
          </div>
        </div>
      </div>

      {/* Body — feed + slim ambient rail */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:16, padding:'12px 18px 28px' }}>
        <div>
          <SectionLabel kicker="Live · firehose" action="auto-scroll">League play feed</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {FEED_ITEMS.map((it,i)=> <FeedRow key={i} item={it} />)}
          </div>
        </div>
        <div>
          <SectionLabel kicker="Schedule">Upcoming</SectionLabel>
          <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, overflow:'hidden' }}>
            {[
              ['SD @ AZ', '7:10 PM', 'Musgrove · Gallen'],
              ['OAK @ SEA','9:40 PM', 'Sears · Castillo'],
            ].map(([m,t,p],i)=>(
              <div key={i} style={{ padding:'10px 12px', borderTop: i?`1px solid ${PULSE.border}`:'none' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: PULSE.white, fontFamily: MONO }}>{m}</span>
                  <span style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO }}>{t}</span>
                </div>
                <div style={{ fontSize: 10.5, color: PULSE.muted, marginTop: 2 }}>{p}</div>
              </div>
            ))}
          </div>

          <SectionLabel kicker="Final">Completed</SectionLabel>
          <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, overflow:'hidden', opacity: 0.85 }}>
            {[['TOR 3 · BAL 8'], ['MIN 1 · CLE 3']].map(([t],i)=>(
              <div key={i} style={{ padding:'8px 12px', borderTop: i?`1px solid ${PULSE.border}`:'none', fontSize: 12, color: PULSE.muted, fontFamily: MONO }}>{t}</div>
            ))}
          </div>

          <SectionLabel kicker="Yours">Card collection</SectionLabel>
          <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 12, display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:48, borderRadius:4, background:`linear-gradient(135deg, ${PULSE.hr}, #6041AA)` }} />
            <div style={{ flex:1 }}>
              <div style={{ fontSize: 12, color: PULSE.white, fontWeight: 700 }}>+1 today</div>
              <div style={{ fontSize: 10.5, color: PULSE.muted, fontFamily: MONO }}>14 of 30 teams</div>
            </div>
            <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO }}>›</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const DirectionBMobile = () => (
  <div style={{ width: 390, background: PULSE.bg, color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow:'hidden' }}>
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'linear-gradient(180deg,#162338,#0E1726)', borderBottom:`1px solid ${PULSE.border}` }}>
      <Bolt size={14} color={PULSE.warn} />
      <span style={{ fontSize: 12, fontWeight: 900, letterSpacing:'.22em', color: PULSE.white }}>MLB PULSE</span>
      <span style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO }}>·</span>
      <span style={{ fontSize: 10.5, color: PULSE.green, fontFamily: MONO }}>● 7 LIVE</span>
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 14, color: PULSE.muted }}>🔊</span>
    </div>
    <div style={{ display:'flex', gap:6, padding:'8px 12px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}`, overflow:'hidden' }}>
      {GAMES.slice(0,3).map(g => <TickerChip key={g.id} g={g} hot={g.hot} themed={g.away==='NYM'} />)}
      <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, alignSelf:'center' }}>+6</span>
    </div>
    {/* Hero focus card — full width on mobile, dominates above the fold */}
    <div style={{ margin:'12px 14px 8px', background:`linear-gradient(160deg, rgba(255,170,60,0.10), transparent 55%), ${PULSE.card}`, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 8 }}>
        <Dot color={PULSE.warn} pulse />
        <span style={{ fontSize: 10, fontWeight:800, letterSpacing:'.16em', color: PULSE.warn, textTransform:'uppercase' }}>Focus · {FOCUS.tension}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight:800, fontFamily: MONO, color: PULSE.white }}>NYM 4 · PHI 3 <span style={{fontSize:13, color:PULSE.muted}}>T7</span></div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginTop:10, paddingTop:10, borderTop:`1px solid ${PULSE.border}` }}>
        <Diamond first={FOCUS.bases.first} second={FOCUS.bases.second} third={FOCUS.bases.third} size={20} />
        <span style={{ fontSize: 14, fontFamily: MONO, color: PULSE.white, fontWeight:800 }}>2–2</span>
        <OutsDots outs={1} />
        <div style={{ flex:1, display:'flex', justifyContent:'flex-end', gap:3 }}>
          {FOCUS.pitches.slice(0,5).map((p,i)=>(
            <span key={i} style={{ width:14, height:18, borderRadius:2, background: p==='S'?PULSE.red:p==='B'?PULSE.green:PULSE.muted, color:PULSE.white, fontSize:9, fontWeight:800, fontFamily:MONO, display:'flex', alignItems:'center', justifyContent:'center' }}>{p}</span>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: PULSE.white, marginTop: 8, fontWeight:700 }}>Alonso vs Nola</div>
    </div>
    <div style={{ padding:'4px 14px 14px' }}>
      <SectionLabel kicker="Story">{STORY.kicker}</SectionLabel>
      <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: PULSE.white, lineHeight:1.3 }}>{STORY.title}</div>
      </div>
      <SectionLabel kicker="Live">Feed</SectionLabel>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {FEED_ITEMS.slice(0,5).map((it,i)=> <FeedRow key={i} item={it} dense />)}
      </div>
    </div>
  </div>
);

window.DirectionB = DirectionB;
window.DirectionBMobile = DirectionBMobile;
