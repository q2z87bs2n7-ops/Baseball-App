const { useState } = React;

// Mets blue/orange as active team; Rockies purple/silver as opponent
const METS_P = '#002D72', METS_S = '#FF5910';
const OPP_P = '#333366', OPP_S = '#C4CED4'; // Rockies
const CARD_BG = 'hsl(217, 45%, 22%)';
const CARD_BG2 = 'hsl(217, 40%, 26%)';
const BORDER = 'hsl(217, 35%, 30%)';
const TEXT = '#e8eaf0';
const MUTED = '#8892a4';

// ---------- Stand-in "cap" mark (generic — NOT the real team logo) ----------
const CapMark = ({ size = 56, primary = OPP_P, secondary = OPP_S, letter = 'R' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
    <defs>
      <radialGradient id={`g-${primary}-${letter}`} cx="50%" cy="35%" r="70%">
        <stop offset="0%" stopColor={primary} stopOpacity="1"/>
        <stop offset="100%" stopColor={primary} stopOpacity=".85"/>
      </radialGradient>
    </defs>
    {/* cap crown */}
    <path d="M8 36 C8 20, 20 10, 32 10 C44 10, 56 20, 56 36 L56 40 L8 40 Z"
          fill={`url(#g-${primary}-${letter})`} stroke="rgba(0,0,0,.25)" strokeWidth="1"/>
    {/* brim */}
    <ellipse cx="32" cy="42" rx="30" ry="5" fill={primary} stroke="rgba(0,0,0,.3)" strokeWidth="1"/>
    <ellipse cx="32" cy="42" rx="30" ry="5" fill="rgba(0,0,0,.15)"/>
    {/* letter */}
    <text x="32" y="32" textAnchor="middle" fontFamily="'Oswald', 'Impact', sans-serif"
          fontSize="22" fontWeight="700" fill={secondary}>{letter}</text>
  </svg>
);

// ---------- Kicker ----------
const Kicker = ({ children, color = METS_S, style = {} }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, letterSpacing: '.14em',
    textTransform: 'uppercase', color, ...style
  }}>{children}</div>
);

const LiveDot = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '2px 8px', borderRadius: 999,
    background: 'rgba(255,68,68,.15)', color: '#ff6b6b',
    fontSize: 10, fontWeight: 700, letterSpacing: '.12em'
  }}>
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff4444' }}/>
    LIVE
  </span>
);

const WatchBtn = () => (
  <button style={{
    background: METS_S, color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 8
  }}>▶ Watch Live</button>
);

const cardBase = {
  background: CARD_BG, border: `1px solid ${BORDER}`,
  borderRadius: 14, padding: 20, color: TEXT,
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  position: 'relative', overflow: 'hidden'
};

// ============================================================
// BASELINE — current v1.38 layout for reference
// ============================================================
const Baseline = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: '#0a0f1e' }}>
    <div style={cardBase}>
      <div style={{ textAlign: 'center' }}>
        <Kicker style={{ display: 'inline-flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
          TODAY — LIVE <LiveDot />
        </Kicker>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginTop: 16, alignItems: 'baseline' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Twins</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginTop: 4 }}>0</div>
          </div>
          <div style={{ fontSize: 28, color: MUTED }}>—</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Mets</div>
            <div style={{ fontSize: 42, fontWeight: 800, marginTop: 4 }}>0</div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}><WatchBtn /></div>
        <div style={{ marginTop: 12, fontSize: 13, color: MUTED }}>Game 2 of 3 · Twins lead 1-0</div>
      </div>
    </div>
    <div style={{ ...cardBase, background: `linear-gradient(135deg, ${OPP_P} 0%, #111827 50%, ${METS_P} 100%)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Kicker>NEXT SERIES</Kicker>
          <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>vs Rockies</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>Citi Field</div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: '.1em' }}>APR 24 — APR 26</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['Game 1', 'Fri, Apr 24', '7:10 PM'],['Game 2', 'Sat, Apr 25', '4:10 PM'],['Game 3', 'Sun, Apr 26', '1:40 PM']].map((g,i)=>(
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,.4)', borderRadius: 6, fontSize: 13 }}>
            <span><b>{g[0]}</b> &nbsp;{g[1]}</span><span>{g[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================================
// OPTION 1 — Cap logo + display-type opponent (MINIMAL)
// ============================================================
const Opt1 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: '#0a0f1e' }}>
    {/* Next Game */}
    <div style={cardBase}>
      <Kicker style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
        TODAY — LIVE <LiveDot />
      </Kicker>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto 1fr auto', alignItems: 'center', gap: 18, marginTop: 16 }}>
        <CapMark size={56} primary="#002B5C" secondary="#D31145" letter="T"/>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: MUTED, textTransform: 'uppercase' }}>vs</div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>Twins</div>
          <div style={{ fontSize: 38, fontWeight: 800, marginTop: 6 }}>0</div>
        </div>
        <div style={{ fontSize: 28, color: MUTED }}>—</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: MUTED, textTransform: 'uppercase' }}>home</div>
          <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>Mets</div>
          <div style={{ fontSize: 38, fontWeight: 800, marginTop: 6 }}>0</div>
        </div>
        <CapMark size={56} primary={METS_P} secondary={METS_S} letter="M"/>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 13, color: MUTED }}>Game 2 of 3 · Twins lead 1-0</div>
        <WatchBtn />
      </div>
    </div>
    {/* Next Series */}
    <div style={{ ...cardBase, background: `linear-gradient(135deg, ${OPP_P} 0%, #111827 55%, ${METS_P} 100%)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Kicker>NEXT SERIES</Kicker>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: '.1em' }}>APR 24 — APR 26</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
        <CapMark size={72} primary={OPP_P} secondary={OPP_S} letter="R"/>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.1em', color: 'rgba(255,255,255,.7)', textTransform: 'uppercase' }}>vs</div>
          <div style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, letterSpacing: '-.01em' }}>Rockies</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', marginTop: 4 }}>Citi Field · Home Series</div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['G1', 'Fri, Apr 24', '7:10 PM'],['G2', 'Sat, Apr 25', '4:10 PM'],['G3', 'Sun, Apr 26', '1:40 PM']].map((g,i)=>(
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,.45)', borderRadius: 6, fontSize: 13, border: '1px solid rgba(255,255,255,.06)' }}>
            <span><b>{g[0]}</b> &nbsp;{g[1]}</span><span>{g[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================================
// OPTION 2 — Split-field card (opposition owns left side)
// ============================================================
const Opt2 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: '#0a0f1e' }}>
    {/* Next Game — split */}
    <div style={{ ...cardBase, padding: 0, display: 'grid', gridTemplateColumns: '38% 1fr' }}>
      <div style={{ background: `linear-gradient(180deg, #002B5C, #001a3c)`, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
        <CapMark size={72} primary="#002B5C" secondary="#D31145" letter="T"/>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'rgba(255,255,255,.7)' }}>AWAY</div>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Twins</div>
        <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>0</div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Kicker style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>TODAY <LiveDot/></Kicker>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 900, lineHeight: 1 }}>0</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>Mets · Home</div>
        </div>
        <div>
          <WatchBtn/>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>G2 of 3 · Twins lead 1-0</div>
        </div>
      </div>
    </div>
    {/* Next Series — split */}
    <div style={{ ...cardBase, padding: 0, display: 'grid', gridTemplateColumns: '42% 1fr', overflow: 'hidden' }}>
      <div style={{ background: `linear-gradient(180deg, ${OPP_P}, #1a1a3d)`, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
        <Kicker style={{ color: 'rgba(255,255,255,.8)' }}>NEXT OPPONENT</Kicker>
        <div>
          <CapMark size={84} primary={OPP_P} secondary={OPP_S} letter="R"/>
          <div style={{ fontSize: 28, fontWeight: 900, marginTop: 10, lineHeight: 1 }}>Rockies</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>COL · NL West · 8-14</div>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: '.1em' }}>APR 24 — APR 26</div>
      </div>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>Citi Field · 3-game home series</div>
        {[['Game 1', 'Fri, Apr 24', '7:10 PM'],['Game 2', 'Sat, Apr 25', '4:10 PM'],['Game 3', 'Sun, Apr 26', '1:40 PM']].map((g,i)=>(
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: CARD_BG2, borderRadius: 6, fontSize: 13, borderLeft: `3px solid ${METS_S}` }}>
            <span><b>{g[0]}</b> &nbsp;{g[1]}</span><span style={{ color: MUTED }}>{g[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================================
// OPTION 3 — Ghosted background cap mark (biggest)
// ============================================================
const Opt3 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: '#0a0f1e' }}>
    <div style={{ ...cardBase, position: 'relative' }}>
      <div style={{ position: 'absolute', right: -30, bottom: -40, opacity: .1, pointerEvents: 'none' }}>
        <CapMark size={220} primary="#D31145" secondary="#002B5C" letter="T"/>
      </div>
      <div style={{ position: 'relative' }}>
        <Kicker style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>TODAY <LiveDot/></Kicker>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
          <CapMark size={48} primary="#002B5C" secondary="#D31145" letter="T"/>
          <div>
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: '.1em', fontWeight: 700 }}>VS</div>
            <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>TWINS</div>
          </div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <div style={{ fontSize: 52, fontWeight: 900, lineHeight: 1 }}>0<span style={{ fontSize: 20, color: MUTED, fontWeight: 400, margin: '0 12px' }}>—</span>0</div>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: MUTED }}>G2 of 3 · Twins lead 1-0</div>
          <WatchBtn/>
        </div>
      </div>
    </div>
    <div style={{ ...cardBase, position: 'relative', background: `linear-gradient(135deg, ${OPP_P}, #1a1a3d 70%)` }}>
      <div style={{ position: 'absolute', right: -60, bottom: -60, opacity: .12, pointerEvents: 'none' }}>
        <CapMark size={300} primary={OPP_S} secondary={OPP_P} letter="R"/>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Kicker style={{ color: 'rgba(255,255,255,.8)' }}>NEXT SERIES</Kicker>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', letterSpacing: '.1em' }}>APR 24 — APR 26</div>
        </div>
        <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 16 }}>
          <CapMark size={64} primary={OPP_P} secondary={OPP_S} letter="R"/>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', fontWeight: 700, letterSpacing: '.12em' }}>VS</div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: .95, letterSpacing: '-.015em' }}>ROCKIES</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', marginTop: 4 }}>Citi Field · 3 games</div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          {[['FRI','7:10'],['SAT','4:10'],['SUN','1:40']].map((g,i)=>(
            <div key={i} style={{ flex: 1, padding: 10, background: 'rgba(0,0,0,.45)', borderRadius: 6, textAlign: 'center', border: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', fontWeight: 700, letterSpacing: '.1em' }}>{g[0]}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{g[1]}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ============================================================
// OPTION 4 — Stripe + display-type (hybrid of #2 + #4)
// ============================================================
const Opt4 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: 16, background: '#0a0f1e' }}>
    <div style={{ ...cardBase, borderLeft: `6px solid #D31145`, paddingLeft: 16 }}>
      <Kicker style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>TODAY <LiveDot/></Kicker>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '.12em', fontWeight: 700 }}>VERSUS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <CapMark size={54} primary="#002B5C" secondary="#D31145" letter="T"/>
          <div style={{ fontSize: 34, fontWeight: 900, lineHeight: 1, color: '#D31145' }}>TWINS</div>
        </div>
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 44, fontWeight: 900 }}>0 <span style={{ color: MUTED, fontWeight: 400 }}>—</span> 0</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>G2 of 3 · Twins lead 1-0</div>
        </div>
        <WatchBtn/>
      </div>
    </div>
    <div style={{ ...cardBase, borderLeft: `6px solid ${OPP_P}`, paddingLeft: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Kicker>NEXT SERIES</Kicker>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '.1em' }}>APR 24 — APR 26</div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 11, color: MUTED, letterSpacing: '.12em', fontWeight: 700 }}>VERSUS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
          <CapMark size={64} primary={OPP_P} secondary={OPP_S} letter="R"/>
          <div>
            <div style={{ fontSize: 40, fontWeight: 900, lineHeight: 1, color: OPP_S, letterSpacing: '-.01em' }}>ROCKIES</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Citi Field · 8-14 away</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['Game 1','Fri, Apr 24','7:10 PM'],['Game 2','Sat, Apr 25','4:10 PM'],['Game 3','Sun, Apr 26','1:40 PM']].map((g,i)=>(
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: CARD_BG2, borderRadius: 6, fontSize: 13 }}>
            <span><b>{g[0]}</b> &nbsp;{g[1]}</span><span style={{ color: MUTED }}>{g[2]}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================================
// Mount
// ============================================================
const App = () => (
  <DesignCanvas>
    <DCSection id="sec" title="Opposition-forward home cards · 4 directions">
      <DCArtboard id="base" label="Baseline — v1.38 (for reference)" width={800} height={260}>
        <Baseline/>
      </DCArtboard>
      <DCArtboard id="opt1" label="Option 1 — Cap + display type (minimal lift)" width={800} height={260}>
        <Opt1/>
      </DCArtboard>
      <DCArtboard id="opt2" label="Option 2 — Split-field (opposition owns left)" width={800} height={260}>
        <Opt2/>
      </DCArtboard>
      <DCArtboard id="opt3" label="Option 3 — Ghosted cap background mark" width={800} height={260}>
        <Opt3/>
      </DCArtboard>
      <DCArtboard id="opt4" label="Option 4 — Color stripe + display-type opponent name" width={800} height={260}>
        <Opt4/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
