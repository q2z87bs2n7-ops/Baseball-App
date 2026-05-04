// Hype card (pre-game / between-games / slate-complete) and Yesterday's Recap layouts.
// Both reuse the existing Hero zone shape so chrome stays consistent.

// Compact countdown digits
const PCountdown = ({ h, m, s }) => (
  <div style={{ display:'flex', gap:6, alignItems:'baseline', fontFamily: MX, fontWeight: 800 }}>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <span style={{ fontSize: 38, lineHeight:1, color: PX.white, fontVariantNumeric:'tabular-nums' }}>{String(h).padStart(2,'0')}</span>
      <span style={{ fontSize: 9, letterSpacing:'.18em', color: PX.dim, marginTop: 4 }}>HRS</span>
    </div>
    <span style={{ fontSize: 28, color: PX.dim, marginTop: -8 }}>:</span>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <span style={{ fontSize: 38, lineHeight:1, color: PX.white, fontVariantNumeric:'tabular-nums' }}>{String(m).padStart(2,'0')}</span>
      <span style={{ fontSize: 9, letterSpacing:'.18em', color: PX.dim, marginTop: 4 }}>MIN</span>
    </div>
    <span style={{ fontSize: 28, color: PX.dim, marginTop: -8 }}>:</span>
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
      <span style={{ fontSize: 38, lineHeight:1, color: PX.warn, fontVariantNumeric:'tabular-nums' }}>{String(s).padStart(2,'0')}</span>
      <span style={{ fontSize: 9, letterSpacing:'.18em', color: PX.dim, marginTop: 4 }}>SEC</span>
    </div>
  </div>
);

// Pre-game hype hero — replaces the live Focus zone before first pitch
const PHype = ({ kind = 'pregame' }) => {
  const copy = {
    pregame:    { kicker: 'Today\u2019s slate', title: 'First pitch', sub: '15 games on tap. Probables, lines, and the storylines worth watching.', countdown: { h: 3, m: 42, s: 18 } },
    intermission:{ kicker: 'Between games', title: 'Next up', sub: 'Cubs at Cardinals. Both teams in the wild-card hunt.', countdown: { h: 0, m: 22, s: 41 } },
    slate:      { kicker: 'Slate complete', title: 'See you tomorrow', sub: '15 games · 9 lead changes · 4 walk-offs. Highlight reel ready.', countdown: { h: 12, m: 8, s: 5 } },
  }[kind];

  return (
    <div style={{
      position:'relative',
      background: `linear-gradient(135deg, ${PX.card} 0%, ${PX.bg2} 60%, ${PX.card2} 100%)`,
      border:`1px solid ${PX.border}`,
      borderRadius: 14,
      padding: '22px 22px 20px',
      overflow:'hidden',
    }}>
      <div style={{ position:'absolute', right:-30, top:-30, fontSize: 220, color: PX.warn, opacity: 0.06, lineHeight:1, fontWeight: 900 }}>⚡</div>

      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 8 }}>
        <PKicker color={PX.warn}>{copy.kicker}</PKicker>
        <PKicker>{kind === 'pregame' ? '15 GAMES TODAY' : kind === 'intermission' ? 'CHC @ STL · 7:10 PM ET' : 'TONIGHT\u2019S RECAP READY'}</PKicker>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:24, alignItems:'center' }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 900, color: PX.white, lineHeight:1.05, letterSpacing:'-.02em', fontFamily: FX }}>{copy.title}</div>
          <div style={{ fontSize: 14, color: PX.muted, marginTop: 8, lineHeight: 1.5, maxWidth: 520 }}>{copy.sub}</div>
          <div style={{ display:'flex', gap:8, marginTop: 14, flexWrap:'wrap' }}>
            {kind === 'pregame' && (
              <React.Fragment>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', background: PX.bg2, border:`1px solid ${PX.border}`, borderRadius:999, fontSize: 11, color: PX.muted, fontFamily: MX, fontWeight: 700 }}>NYM @ PHI · 1:05p</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', background: PX.bg2, border:`1px solid ${PX.border}`, borderRadius:999, fontSize: 11, color: PX.muted, fontFamily: MX, fontWeight: 700 }}>LAD @ SF · 4:10p</span>
                <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', background: PX.bg2, border:`1px solid ${PX.border}`, borderRadius:999, fontSize: 11, color: PX.team, fontFamily: MX, fontWeight: 700 }}>● YOUR GAME · 1:05p</span>
              </React.Fragment>
            )}
            {kind === 'intermission' && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 10px', background: PX.bg2, border:`1px solid ${PX.border}`, borderRadius:999, fontSize: 11, color: PX.muted, fontFamily: MX, fontWeight: 700 }}>Steele (8\u20137, 3.21) vs. Mikolas (6\u20139, 4.45)</span>
            )}
            {kind === 'slate' && (
              <button style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', background: PX.warn, color:'#0B1424', border:'none', borderRadius:999, fontSize: 12, fontWeight: 800, letterSpacing:'.06em', textTransform:'uppercase', cursor:'pointer' }}>▶ Watch the recap</button>
            )}
          </div>
        </div>
        <PCountdown h={copy.countdown.h} m={copy.countdown.m} s={copy.countdown.s} />
      </div>
    </div>
  );
};

// Yesterday's recap hero — single hero clip + heroes strip
const PYesterdayHero = () => (
  <div style={{
    background: `linear-gradient(135deg, ${PX.card}, ${PX.bg2})`,
    border:`1px solid ${PX.border}`,
    borderRadius: 14,
    overflow:'hidden',
  }}>
    {/* Video player area — intentionally dark; inset on light bg to read as deliberate video frame */}
    <div style={{ padding: 8, background: PX.bg2 }}>
      <div style={{ position:'relative', aspectRatio:'16/9', background:`linear-gradient(135deg, #0a1020, #1a2845)`, display:'flex', alignItems:'center', justifyContent:'center', borderRadius: 8, overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse at center, rgba(255,170,60,0.10), transparent 60%)' }} />
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width: 64, height: 64, borderRadius:'50%', background: PX.warn, color:'#0B1424', fontSize: 24, fontWeight: 900, boxShadow:'0 8px 24px rgba(255,170,60,0.4)' }}>▶</div>
        <div style={{ position:'absolute', top: 14, left: 14, display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ background:'rgba(255,90,90,0.2)', color:'#FF8A8A', padding:'3px 8px', borderRadius:4, fontSize: 10, fontWeight: 800, letterSpacing:'.12em', fontFamily: MX }}>● HIGHLIGHT</span>
          <span style={{ color:'#E6E9F0', fontSize: 12, fontWeight: 700 }}>Soto walk-off double · 11th inning</span>
        </div>
        <div style={{ position:'absolute', bottom: 14, right: 14, color:'#8A95AA', fontSize: 11, fontFamily: MX, background:'rgba(0,0,0,0.4)', padding:'2px 8px', borderRadius:4 }}>0:43 / 2:14</div>
      </div>
    </div>

    {/* Playlist strip */}
    <div style={{ padding:'12px 14px', borderBottom:`1px solid ${PX.borderS}`, display:'flex', gap:8, overflowX:'auto' }}>
      {[
        { team:'SD', title:'Soto walk-off double', t:'2:14', active:true },
        { team:'NYM', title:'Lindor 2-run shot', t:'0:48' },
        { team:'LAD', title:'Ohtani slam', t:'1:12' },
        { team:'BAL', title:'Henderson, 2 HRs', t:'1:38' },
        { team:'CHC', title:'Walk-off in extras', t:'1:56' },
      ].map((c,i)=>(
        <div key={i} style={{
          flexShrink: 0, width: 130, padding: 8, borderRadius: 8,
          background: c.active ? PX.bg2 : 'transparent',
          border:`1px solid ${c.active ? PX.warn : PX.border}`,
          cursor:'pointer',
        }}>
          <div style={{ aspectRatio:'16/9', background: c.active ? `linear-gradient(135deg, ${PX.warn}33, ${PX.hr}33)` : PX.borderS, borderRadius: 4, marginBottom: 6, position:'relative' }}>
            <span style={{ position:'absolute', bottom:3, right:4, color: PX.text, fontSize: 9, fontFamily: MX, background:'rgba(0,0,0,0.5)', padding:'1px 4px', borderRadius:2 }}>{c.t}</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: PX.muted, fontFamily: MX, letterSpacing:'.06em' }}>{c.team}</div>
          <div style={{ fontSize: 11, color: c.active?PX.white:PX.text, lineHeight: 1.3, marginTop: 2 }}>{c.title}</div>
        </div>
      ))}
    </div>

    {/* Heroes strip */}
    <div style={{ padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div style={{ display:'flex', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing:'.18em', color: PX.dim, textTransform:'uppercase' }}>Top batter</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PX.white, marginTop: 2 }}>Ohtani · 4-5, 2 HR, 6 RBI</div>
        </div>
        <div style={{ width:1, background: PX.border }} />
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing:'.18em', color: PX.dim, textTransform:'uppercase' }}>Winning pitcher</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: PX.white, marginTop: 2 }}>Skenes · 7 IP, 11 K, 0 ER</div>
        </div>
      </div>
      <PKicker>15 GAMES · 9 LEAD CHANGES · 4 WALK-OFFS</PKicker>
    </div>
  </div>
);

window.PHype = PHype;
window.PYesterdayHero = PYesterdayHero;
