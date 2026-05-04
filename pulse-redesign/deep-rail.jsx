// Right rail — slim ambient column. Only schedule + collection + news.
const PRail = ({ games, lens }) => {
  const upcoming = games.filter(g => g.state === 'preview');
  const completed = games.filter(g => g.state === 'final');
  return (
    <div>
      <PSection kicker="Schedule">Up next</PSection>
      <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 10, overflow:'hidden' }}>
        {upcoming.map((g,i) => (
          <div key={g.id} style={{ padding:'10px 12px', borderTop: i?`1px solid ${PX.border}`:'none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: PX.white, fontFamily: MX }}>{g.away} @ {g.home}</span>
              <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX }}>{g.inn}</span>
            </div>
            <div style={{ fontSize: 11, color: PX.muted, marginTop: 2 }}>{g.probables}</div>
          </div>
        ))}
      </div>

      <PSection kicker="Final">Today's results</PSection>
      <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 10, overflow:'hidden', opacity: 0.85 }}>
        {completed.map((g,i) => (
          <div key={g.id} style={{ padding:'9px 12px', borderTop: i?`1px solid ${PX.border}`:'none', display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize: 12.5, color: PX.muted, fontFamily: MX }}>
              {g.away} <strong style={{color: g.as>g.hs?PX.text:PX.muted}}>{g.as}</strong>
              <span style={{ color: PX.dim, margin:'0 6px' }}>·</span>
              {g.home} <strong style={{color: g.hs>g.as?PX.text:PX.muted}}>{g.hs}</strong>
            </span>
            <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX }}>F</span>
          </div>
        ))}
      </div>

      <PSection kicker="Yours">Card collection</PSection>
      <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 10, padding: 12, display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:34, height:46, borderRadius:4, background:`linear-gradient(135deg, ${PX.hr}, #6041AA)`, flexShrink:0 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize: 12.5, color: PX.white, fontWeight: 700 }}>+1 today · Lindor HR</div>
          <div style={{ fontSize: 11, color: PX.muted, fontFamily: MX, marginTop: 1 }}>14 of 30 teams</div>
        </div>
        <span style={{ fontSize: 13, color: PX.dim }}>›</span>
      </div>

      <PSection kicker="Around the league">News</PSection>
      <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: PX.white, lineHeight:1.4 }}>{PNEWS[0].title}</div>
        <div style={{ fontSize: 10.5, color: PX.muted, marginTop: 4, fontFamily: MX, display:'flex', justifyContent:'space-between' }}>
          <span>{PNEWS[0].src} · {PNEWS[0].t}</span>
          <span>‹ 1 / {PNEWS.length} ›</span>
        </div>
      </div>
    </div>
  );
};

window.PRail = PRail;
