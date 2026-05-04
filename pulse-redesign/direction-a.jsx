// Direction A — Conservative restructure.
// Same two-column shape, but At-Bat Focus is promoted above the rail's News module,
// the Story Carousel gets a clear visual demotion vs the live Focus zone,
// chrome is tightened (single header, neutral accent enforced), and easy-wins applied.

const DirectionA = () => {
  const W = 1280;
  const wrap = { width: W, background: PULSE.bg, color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow: 'hidden' };

  return (
    <div style={wrap}>
      {/* Unified top bar — bolt+wordmark, status pills, controls all in one strip */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 18px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}` }}>
        <Bolt size={15} />
        <span style={{ fontSize: 13, fontWeight: 900, letterSpacing:'.22em', color: PULSE.white }}>MLB PULSE</span>
        <span style={{ width:1, height:14, background: PULSE.border, margin:'0 4px' }} />
        <span style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>9 GAMES · 7 LIVE · 2 FINAL</span>
        <div style={{ flex:1 }} />
        {['MY TEAM ●','🔊','📻','☀️'].map((l,i)=>(
          <button key={i} style={{ background:'transparent', border:`1px solid ${PULSE.border}`, color:PULSE.muted, borderRadius:999, padding:'5px 11px', fontSize:11, fontWeight:600, letterSpacing:'.08em', fontFamily: FONT, cursor:'pointer' }}>{l}</button>
        ))}
      </div>

      {/* Ticker */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}`, overflow:'hidden' }}>
        {GAMES.slice(0,7).map(g => <TickerChip key={g.id} g={g} hot={g.hot} themed={g.away==='NYM'} />)}
        <div style={{ marginLeft:'auto', fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.1em' }}>+2 MORE</div>
      </div>

      {/* Two-col body */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16, padding:'18px 18px 28px' }}>
        {/* LEFT */}
        <div>
          {/* Story carousel — quietly framed as editorial, NOT competing with the feed */}
          <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight:700, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase' }}>Story · {STORY.kicker}</span>
            <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO }}>3 / 11</span>
            <div style={{ flex:1 }} />
            <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO }}>‹ ›</span>
          </div>
          <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding:'14px 16px', marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: PULSE.white, letterSpacing:'-.005em', lineHeight:1.3 }}>{STORY.title}</div>
            <div style={{ fontSize: 13.5, color: PULSE.muted, marginTop: 6, lineHeight:1.5 }}>{STORY.body}</div>
            <div style={{ fontSize: 11, color: PULSE.dim, marginTop: 8, fontFamily: MONO }}>{STORY.meta}</div>
          </div>

          {/* Feed — clearly labeled as the firehose */}
          <SectionLabel kicker="Live" action="auto-scroll · 600 cap">League play feed</SectionLabel>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {FEED_ITEMS.map((it,i)=> <FeedRow key={i} item={it} />)}
          </div>
        </div>

        {/* RIGHT — At-Bat Focus is now FIRST in the rail (above News, above Upcoming) */}
        <div>
          <SectionLabel kicker="Focus · Auto-pick">Best game right now</SectionLabel>
          <FocusCard />

          <SectionLabel kicker="Schedule">Upcoming</SectionLabel>
          <UpcomingList />

          <SectionLabel kicker="Final">Completed today</SectionLabel>
          <CompletedList />

          <SectionLabel kicker="Headlines" action="MLB news">Around the league</SectionLabel>
          <NewsCard />
        </div>
      </div>
    </div>
  );
};

const FocusCard = ({ compact=false }) => (
  <div style={{ background: 'linear-gradient(180deg, rgba(255,170,60,0.05), transparent 60%), '+PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 14 }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: 10 }}>
      <Dot color={PULSE.warn} pulse />
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing:'.16em', color: PULSE.warn, textTransform:'uppercase' }}>Tension {FOCUS.tension}</span>
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO }}>↩ AUTO</span>
    </div>
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom: 10 }}>
      <span style={{ fontSize: 22, fontWeight: 800, color: PULSE.white, fontFamily: MONO, letterSpacing:'-.02em' }}>
        {FOCUS.away} {FOCUS.as} <span style={{color: PULSE.dim, fontWeight:600}}>·</span> {FOCUS.home} {FOCUS.hs}
      </span>
      <span style={{ fontSize: 13, fontFamily: MONO, color: PULSE.muted }}>{FOCUS.inn}</span>
    </div>
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'10px 0', borderTop:`1px solid ${PULSE.border}`, borderBottom:`1px solid ${PULSE.border}` }}>
      <Diamond first={FOCUS.bases.first} second={FOCUS.bases.second} third={FOCUS.bases.third} size={20} />
      <div>
        <div style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.12em' }}>COUNT</div>
        <div style={{ fontSize: 16, fontWeight:800, color: PULSE.white, fontFamily: MONO }}>{FOCUS.count.b}–{FOCUS.count.s}</div>
      </div>
      <div>
        <div style={{ fontSize: 10.5, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.12em' }}>OUTS</div>
        <div style={{ paddingTop: 4 }}><OutsDots outs={FOCUS.outs} /></div>
      </div>
      <div style={{ flex:1, display:'flex', justifyContent:'flex-end', gap:4 }}>
        {FOCUS.pitches.map((p,i)=>(
          <span key={i} style={{ width:18, height:22, borderRadius:3, background: p==='—'?PULSE.bg2:p==='S'?PULSE.red:p==='B'?PULSE.green:PULSE.muted, opacity: p==='—'?0.4:1, color:PULSE.white, fontSize:11, fontWeight:800, fontFamily:MONO, display:'flex', alignItems:'center', justifyContent:'center' }}>{p==='—'?'':p}</span>
        ))}
      </div>
    </div>
    <div style={{ marginTop: 10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
        <div>
          <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.12em' }}>AT BAT</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: PULSE.white }}>{FOCUS.batter}</div>
          <div style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.batterStat}</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, letterSpacing:'.12em' }}>PITCHING</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: PULSE.white }}>{FOCUS.pitcher}</div>
          <div style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>{FOCUS.pitcherStat}</div>
        </div>
      </div>
    </div>
  </div>
);

const UpcomingList = () => (
  <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, overflow:'hidden' }}>
    {[
      ['SD @ AZ', '7:10 PM ET', 'Musgrove vs Gallen'],
      ['OAK @ SEA','9:40 PM ET', 'Sears vs Castillo'],
    ].map(([m,t,p],i)=>(
      <div key={i} style={{ padding:'10px 12px', borderTop: i?`1px solid ${PULSE.border}`:'none', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PULSE.white }}>{m}</div>
          <div style={{ fontSize: 11, color: PULSE.muted }}>{p}</div>
        </div>
        <div style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>{t}</div>
      </div>
    ))}
  </div>
);

const CompletedList = () => (
  <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, overflow:'hidden', opacity: 0.85 }}>
    {[
      ['TOR 3', 'BAL 8','F'],
      ['MIN 1', 'CLE 3','F'],
    ].map(([a,h,s],i)=>(
      <div key={i} style={{ padding:'8px 12px', borderTop: i?`1px solid ${PULSE.border}`:'none', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize: 12.5, color: PULSE.muted, fontFamily: MONO }}>{a} · {h}</span>
        <span style={{ fontSize: 11, color: PULSE.dim, fontFamily: MONO }}>{s}</span>
      </div>
    ))}
  </div>
);

const NewsCard = () => (
  <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: PULSE.white, lineHeight:1.4 }}>Cubs DFA reliever amid bullpen reshuffle ahead of trade deadline</div>
    <div style={{ fontSize: 11, color: PULSE.muted, marginTop: 4, fontFamily: MONO }}>ESPN · 2h ago · ‹ 1 / 8 ›</div>
  </div>
);

// MOBILE — direction A
const DirectionAMobile = () => (
  <div style={{ width: 390, background: PULSE.bg, color: PULSE.text, fontFamily: FONT, borderRadius: 6, overflow:'hidden' }}>
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}` }}>
      <Bolt size={13} />
      <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing:'.22em', color: PULSE.white }}>MLB PULSE</span>
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 16, color: PULSE.muted }}>🔊 📻 ☀️</span>
    </div>
    <div style={{ display:'flex', gap:6, padding:'8px 12px', background: PULSE.bg2, borderBottom:`1px solid ${PULSE.border}`, overflow:'hidden' }}>
      {GAMES.slice(0,3).map(g => <TickerChip key={g.id} g={g} hot={g.hot} themed={g.away==='NYM'} />)}
      <span style={{ fontSize: 10, color: PULSE.dim, fontFamily: MONO, alignSelf:'center' }}>+6</span>
    </div>
    {/* Focus mini-bar — sticky-style strip, glanceable */}
    <div style={{ padding:'10px 14px', background: 'rgba(255,170,60,0.06)', borderBottom:`1px solid ${PULSE.border}`, display:'flex', alignItems:'center', gap:10 }}>
      <Dot color={PULSE.warn} pulse />
      <span style={{ fontSize: 13, fontWeight: 800, color: PULSE.white, fontFamily: MONO }}>NYM 4 · PHI 3</span>
      <span style={{ fontSize: 11, color: PULSE.muted, fontFamily: MONO }}>T7 · 2-2 · Alonso</span>
      <div style={{ flex:1 }} />
      <span style={{ fontSize: 10, color: PULSE.warn, fontFamily: MONO, fontWeight:700 }}>OPEN ›</span>
    </div>
    <div style={{ padding:'14px' }}>
      <div style={{ fontSize: 10, fontWeight:700, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase', marginBottom: 6 }}>Story</div>
      <div style={{ background: PULSE.card, border:`1px solid ${PULSE.border}`, borderRadius: 10, padding:'12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: PULSE.white, lineHeight:1.3 }}>{STORY.title}</div>
        <div style={{ fontSize: 11, color: PULSE.dim, marginTop: 6, fontFamily: MONO }}>{STORY.meta}</div>
      </div>
      <div style={{ fontSize: 10, fontWeight:700, letterSpacing:'.18em', color: PULSE.dim, textTransform:'uppercase', marginBottom: 6 }}>Live feed</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {FEED_ITEMS.slice(0,5).map((it,i)=> <FeedRow key={i} item={it} dense />)}
      </div>
    </div>
  </div>
);

window.DirectionA = DirectionA;
window.DirectionAMobile = DirectionAMobile;
window.FocusCard = FocusCard;
