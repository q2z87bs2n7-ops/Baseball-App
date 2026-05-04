// Top bar + ticker for the deep mock. Pulse asserts identity here.

const PTopBar = ({ counts, lens, onLens, scheme, onScheme, onYesterday, sound, onSound, radio, onRadio }) => (
  <div style={{
    display:'flex', alignItems:'stretch',
    background: `linear-gradient(180deg, ${PX.topbarA} 0%, ${PX.topbarB} 100%)`,
    borderBottom: `1px solid ${PX.border}`,
  }}>
    {/* Brand block */}
    <div style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 22px', background:'rgba(255,170,60,0.06)', borderRight:`1px solid ${PX.border}` }}>
      <PBolt size={17} color={PX.warn} />
      <span style={{ fontSize: 14, fontWeight: 900, letterSpacing:'.26em', color: PX.white }}>MLB PULSE</span>
    </div>

    {/* Status counters */}
    <div style={{ display:'flex', alignItems:'center', gap: 20, padding:'0 22px', flex:1, fontFamily: MX, minWidth: 0 }}>
      <span style={{ display:'flex', alignItems:'center', gap:7 }}>
        <PDot color={PX.green} pulse size={6} />
        <span style={{ fontSize: 10.5, color: PX.dim, letterSpacing:'.16em' }}>LIVE</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: PX.green }}>{counts.live}</span>
      </span>
      <span style={{ width:1, height:14, background: PX.border }} />
      <span style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ fontSize: 10.5, color: PX.dim, letterSpacing:'.16em' }}>FINAL</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: PX.muted }}>{counts.final}</span>
      </span>
      <span style={{ width:1, height:14, background: PX.border }} />
      <span style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{ fontSize: 10.5, color: PX.dim, letterSpacing:'.16em' }}>UP NEXT</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: PX.muted }}>{counts.preview}</span>
      </span>
      <div style={{ flex:1 }} />
      {/* Your-game callout — team-aware not team-themed */}
      {counts.myTeamLive && (
        <span onClick={onLens} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 11px', borderRadius: 999, background: lens?'rgba(255,89,16,0.16)':'rgba(255,89,16,0.08)', border:`1px solid ${PX.team}88`, cursor:'pointer' }}>
          <PDot color={PX.team} pulse size={6} />
          <span style={{ fontSize: 10.5, color: PX.team, letterSpacing:'.14em', fontWeight:700, fontFamily: MX }}>YOUR GAME · NYM T7</span>
          <span style={{ fontSize: 10.5, color: PX.team, fontFamily: MX, fontWeight: 700 }}>{lens ? '● LENS ON' : '○'}</span>
        </span>
      )}
    </div>

    {/* Controls */}
    <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 16px', borderLeft:`1px solid ${PX.border}` }}>
      <PIconBtn label="🔊" on={sound} title="Sound alerts" onClick={onSound} />
      <PIconBtn label="📻" on={radio} title="Live radio" onClick={onRadio} indicator={radio ? PX.green : null} />
      <PIconBtn label={scheme==='dark'?'☀️':'🌙'} title="Light / dark" onClick={onScheme} />
      <span style={{ width:1, height:18, background: PX.border, margin:'0 4px' }} />
      <button onClick={onYesterday} style={{ background:'transparent', border:`1px solid ${PX.border}`, color: PX.muted, fontSize: 10, fontWeight:700, letterSpacing:'.14em', padding:'6px 11px', borderRadius: 4, cursor:'pointer', fontFamily: FX }}>📼 YESTERDAY</button>
    </div>
  </div>
);

const PIconBtn = ({ label, on, title, onClick, indicator }) => (
  <button onClick={onClick} title={title} style={{
    width:32, height:32, borderRadius:6,
    background: on ? 'rgba(255,170,60,0.12)' : 'rgba(255,255,255,0.03)',
    border: `1px solid ${on ? 'rgba(255,170,60,0.5)' : PX.border}`,
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize: 14, cursor:'pointer', position:'relative', padding:0,
  }}>
    {label}
    {indicator && <span style={{ position:'absolute', top:4, right:4, width:6, height:6, borderRadius:'50%', background:indicator }} />}
  </button>
);

// Ticker
const PTicker = ({ games, focusId, onPick, lens }) => (
  <div style={{
    display:'flex', alignItems:'center', gap:6, padding:'8px 14px',
    background: PX.bg2, borderBottom:`1px solid ${PX.border}`,
    overflowX:'auto', overflowY:'hidden',
  }}>
    {games.map(g => (
      <PChip key={g.id} g={g}
        active={g.id === focusId}
        dim={lens && !g.myteam}
        onClick={() => g.state==='live' && onPick(g.id)}
      />
    ))}
  </div>
);

window.PTopBar = PTopBar; window.PTicker = PTicker;
