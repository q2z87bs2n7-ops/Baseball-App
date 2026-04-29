// Final 4 cards for handoff: V1 Original, V2 Jumbotron, V3 Comic, V4 Broadcast
// Updated for: dynamic badge text (walk-off/grand-slam/etc), proper headshot framing.
//
// Headshot framing strategy:
// MLB API returns portrait headshots — face centered horizontally, eyes ~20-25% from top,
// head + shoulders + chest visible, transparent bg.
// Use background-position: center 15-22% (NOT center center).
// Reserve enough vertical photo space for head + shoulders (min ~200px tall at 320 wide).
// When in doubt, err toward MORE photo (zoom out) — half a face is the worst case.

const SAMPLE_PLAYERS = [
  { id: 596019, name: "FRANCISCO LINDOR", last: "LINDOR", first: "FRANCISCO", pos: "SS", jersey: "12", team: "METS", primary: "#002D72", secondary: "#FF5910" },
  { id: 592450, name: "AARON JUDGE",      last: "JUDGE",  first: "AARON",     pos: "RF", jersey: "99", team: "YANKEES", primary: "#003087", secondary: "#E4002C" },
  { id: 660271, name: "SHOHEI OHTANI",    last: "OHTANI", first: "SHOHEI",    pos: "DH", jersey: "17", team: "DODGERS", primary: "#005A9C", secondary: "#EF3E42" },
];

// All sample event "badges" — these are dynamic strings from getHRBadge() and getRBIBadge()
const SAMPLE_BADGES = [
  "HOME RUN",
  "GO-AHEAD HOME RUN",
  "GRAND SLAM",
  "WALK-OFF HOME RUN",
  "WALK-OFF GRAND SLAM",
  "RBI DOUBLE",
  "GO-AHEAD RBI",
];

const photoUrl = (id) =>
  `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_640,q_auto:best/v1/people/${id}/headshot/67/current`;

// Stats per player (mock — would come from statsCache)
const STATS = { avg: ".284", ops: ".891", hr: 18, rbi: 47 };

const CARD_W = 320, CARD_H = 448;

const Shell = ({ children, style }) => (
  <div style={{
    width: CARD_W, height: CARD_H,
    position: "relative", overflow: "hidden",
    fontFamily: "Helvetica, Arial, sans-serif", color: "#fff",
    boxShadow: "0 30px 60px -20px rgba(0,0,0,0.55)",
    ...style,
  }}>{children}</div>
);

// ───────────────────────────────────────────────────
// V1 — STYLIZED GRAPHIC (with event line, no pill)
// ───────────────────────────────────────────────────
const V1_Stylized = ({ p, badge }) => (
  <Shell style={{ background: p.primary, borderRadius: 10 }}>
    <div style={{ position: "absolute", inset: 0, background: p.secondary,
      clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 78%)" }}/>
    <div style={{ position: "absolute", inset: 0,
      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)",
      backgroundSize: "8px 8px",
      clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 78%)" }}/>

    {/* EVENT TEXT — replaces the pill, becomes part of the design */}
    <div style={{
      position: "absolute", top: 16, left: 14, right: 14,
      fontFamily: "'Helvetica Neue', sans-serif",
      fontWeight: 900, fontSize: 14, letterSpacing: "0.25em",
      color: "#fff", textTransform: "uppercase",
      borderBottom: "2px solid rgba(255,255,255,0.5)",
      paddingBottom: 8, zIndex: 4,
    }}>{badge}</div>

    {/* Stacked lastname */}
    <div style={{
      position: "absolute", top: 50, left: 14, right: 14,
      fontFamily: "'Helvetica Neue', sans-serif",
      fontWeight: 900, fontSize: 48, letterSpacing: "-0.04em",
      color: "#fff", lineHeight: 0.9, textTransform: "uppercase", zIndex: 2,
    }}>
      {p.last.length > 6 ? p.last.slice(0, Math.ceil(p.last.length/2)) : p.last}
      {p.last.length > 6 && <><br/>{p.last.slice(Math.ceil(p.last.length/2))}</>}
    </div>

    {/* Photo — circular, zoomed out to show full head + shoulders */}
    <div style={{
      position: "absolute", top: 140, right: 18,
      width: 165, height: 165, borderRadius: "50%",
      backgroundImage: `url(${photoUrl(p.id)})`,
      backgroundSize: "85% auto",             // contain the headshot inside the circle
      backgroundPosition: "center 25%",
      backgroundColor: p.secondary,
      backgroundRepeat: "no-repeat",
      border: `4px solid #fff`,
      boxShadow: "0 8px 20px rgba(0,0,0,0.3)", zIndex: 3,
    }}/>

    <div style={{
      position: "absolute", top: 145, left: 16,
      fontFamily: "'Helvetica Neue', sans-serif",
      fontWeight: 900, fontSize: 130, letterSpacing: "-0.05em",
      color: "rgba(255,255,255,0.92)", lineHeight: 0.8, zIndex: 2,
      textShadow: `4px 4px 0 ${p.primary}`,
    }}>{p.jersey}</div>

    <div style={{
      position: "absolute", top: 110, left: 14,
      background: "#fff", color: p.primary,
      fontWeight: 900, fontSize: 11, letterSpacing: "0.15em",
      padding: "4px 10px", zIndex: 4,
    }}>{p.pos} · {p.team}</div>

    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 86,
      background: "#000", display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)", zIndex: 4,
    }}>
      {[
        { l: "AVG", v: STATS.avg },
        { l: "HR",  v: STATS.hr, hi: true },
        { l: "RBI", v: STATS.rbi },
        { l: "OPS", v: STATS.ops },
      ].map((s, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: s.hi ? p.secondary : "transparent", gap: 4,
        }}>
          <div style={{ fontWeight: 900, fontSize: 26, color: "#fff", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{s.v}</div>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", color: s.hi ? "#fff" : "rgba(255,255,255,0.6)" }}>{s.l}</div>
        </div>
      ))}
    </div>
  </Shell>
);

// ───────────────────────────────────────────────────
// V2 — JUMBOTRON (event text in scoreboard top strip)
// ───────────────────────────────────────────────────
const V2_Jumbotron = ({ p, badge }) => (
  <Shell style={{
    background: "#000", borderRadius: 10,
    backgroundImage: `radial-gradient(ellipse at 50% 40%, ${p.primary}33 0%, transparent 70%), radial-gradient(circle at center, #0a0e18 0%, #000 100%)`,
  }}>
    <div style={{ position: "absolute", inset: 0,
      backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1.2px)",
      backgroundSize: "5px 5px" }}/>

    {/* EVENT TEXT in the scoreboard top strip */}
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 44,
      background: "#0a0a0a",
      borderBottom: `2px solid ${p.secondary}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 14px", gap: 14,
      fontFamily: "'Courier New', ui-monospace, monospace",
    }}>
      <span style={{
        fontSize: 11, fontWeight: 900, letterSpacing: "0.15em",
        color: p.secondary, textShadow: `0 0 8px ${p.secondary}`,
      }}>● LIVE</span>
      <span style={{
        fontSize: 13, fontWeight: 900, letterSpacing: "0.18em",
        color: "#ffcc44", textShadow: "0 0 10px #ffcc44",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{badge}</span>
    </div>

    {/* Photo — fully framed, no crop */}
    <div style={{
      position: "absolute", top: 64, left: 22, right: 22,
      height: 200,
      backgroundImage: `url(${photoUrl(p.id)})`,
      backgroundSize: "auto 100%",           // contain by height — show entire portrait
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      backgroundColor: p.primary,
      borderRadius: 4,
      filter: "contrast(1.2) saturate(1.4)",
      boxShadow: `0 0 0 2px ${p.primary}, 0 0 30px ${p.primary}88`,
    }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 4,
        background: "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 2px, transparent 2px 4px)" }}/>
      <div style={{ position: "absolute", inset: 0, borderRadius: 4,
        background: `linear-gradient(180deg, ${p.primary}33 0%, transparent 50%, ${p.secondary}22 100%)`,
        mixBlendMode: "overlay" }}/>
    </div>

    <div style={{
      position: "absolute", top: 274, left: 0, right: 0,
      textAlign: "center",
      fontFamily: "'Courier New', monospace",
      fontWeight: 900, fontSize: 28, letterSpacing: "0.08em",
      color: "#ffcc44",
      textShadow: `0 0 12px #ffcc44, 0 0 24px #ffaa00`,
      lineHeight: 1,
    }}>{p.last}</div>
    <div style={{
      position: "absolute", top: 308, left: 0, right: 0,
      textAlign: "center",
      fontFamily: "'Courier New', monospace",
      fontSize: 11, fontWeight: 700, letterSpacing: "0.4em",
      color: "rgba(255,255,255,0.5)",
    }}>#{p.jersey} · {p.pos} · {p.team}</div>

    <div style={{
      position: "absolute", bottom: 16, left: 16, right: 16,
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
    }}>
      {[
        { l: "AVG", v: STATS.avg, c: "#fff" },
        { l: "HR", v: STATS.hr, c: "#ffcc44", glow: true },
        { l: "RBI", v: STATS.rbi, c: "#fff" },
        { l: "OPS", v: STATS.ops, c: "#fff" },
      ].map((s, i) => (
        <div key={i} style={{
          background: "#0a0a0a",
          border: `1px solid ${s.glow ? "#ffcc44" : "rgba(255,255,255,0.15)"}`,
          padding: "10px 4px", textAlign: "center", borderRadius: 3,
          boxShadow: s.glow ? "0 0 12px rgba(255,204,68,0.4)" : "none",
        }}>
          <div style={{
            fontFamily: "'Courier New', monospace",
            fontWeight: 900, fontSize: 18, color: s.c,
            textShadow: s.glow ? `0 0 8px ${s.c}` : "none",
            fontVariantNumeric: "tabular-nums", lineHeight: 1,
          }}>{s.v}</div>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.5)", marginTop: 4 }}>{s.l}</div>
        </div>
      ))}
    </div>
  </Shell>
);

// ───────────────────────────────────────────────────
// V3 — COMIC (event text replaces "POW!" stamp)
// ───────────────────────────────────────────────────
const V3_Comic = ({ p, badge }) => (
  <Shell style={{ background: "#fff7e0", borderRadius: 10, border: "3px solid #000" }}>
    <div style={{ position: "absolute", inset: 0,
      backgroundImage: "radial-gradient(circle, #ff4444 2px, transparent 2.2px)",
      backgroundSize: "10px 10px", opacity: 0.5 }}/>
    <div style={{
      position: "absolute", top: 70, left: -20, right: -20, height: 270,
      background: "#ffd84a",
      clipPath: "polygon(50% 0%, 60% 12%, 75% 4%, 78% 18%, 92% 14%, 88% 30%, 100% 36%, 90% 48%, 100% 62%, 88% 70%, 95% 86%, 78% 82%, 80% 96%, 62% 88%, 50% 100%, 38% 88%, 20% 96%, 22% 82%, 5% 86%, 12% 70%, 0% 62%, 10% 48%, 0% 36%, 12% 30%, 8% 14%, 22% 18%, 25% 4%, 40% 12%)",
    }}/>
    <div style={{
      position: "absolute", top: 70, left: -20, right: -20, height: 270,
      backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.7px)",
      backgroundSize: "7px 7px",
      clipPath: "polygon(50% 0%, 60% 12%, 75% 4%, 78% 18%, 92% 14%, 88% 30%, 100% 36%, 90% 48%, 100% 62%, 88% 70%, 95% 86%, 78% 82%, 80% 96%, 62% 88%, 50% 100%, 38% 88%, 20% 96%, 22% 82%, 5% 86%, 12% 70%, 0% 62%, 10% 48%, 0% 36%, 12% 30%, 8% 14%, 22% 18%, 25% 4%, 40% 12%)",
    }}/>

    {/* Photo — circular, zoomed out so full head + shoulders fit */}
    <div style={{
      position: "absolute", top: 110, left: 70, width: 180, height: 180,
      borderRadius: "50%",
      backgroundImage: `url(${photoUrl(p.id)})`,
      backgroundSize: "82% auto",
      backgroundPosition: "center 22%",
      backgroundRepeat: "no-repeat",
      backgroundColor: p.primary,
      border: "4px solid #000",
      filter: "contrast(1.3) saturate(1.5)",
      boxShadow: "5px 5px 0 #000", zIndex: 3,
    }}/>

    {/* EVENT TEXT — replaces the static "HOME RUN!" stamp */}
    <div style={{
      position: "absolute", top: 18, left: 14,
      background: "#ff3344",
      color: "#fff", border: "3px solid #000",
      fontWeight: 900, fontSize: badge.length > 14 ? 13 : 16,
      letterSpacing: "0.04em",
      padding: "6px 12px",
      transform: "rotate(-6deg)",
      boxShadow: "4px 4px 0 #000",
      fontStyle: "italic",
      maxWidth: 220,
      zIndex: 5,
    }}>{badge}!</div>

    <div style={{
      position: "absolute", top: 296, left: 0, right: 0,
      textAlign: "center",
      fontWeight: 900, fontSize: 36, letterSpacing: "-0.02em",
      color: "#000", lineHeight: 0.9, textTransform: "uppercase",
      fontStyle: "italic", WebkitTextStroke: "1px #000", zIndex: 4,
    }}>{p.last}</div>
    <div style={{
      position: "absolute", top: 332, left: 0, right: 0,
      textAlign: "center",
      fontWeight: 800, fontSize: 11, letterSpacing: "0.2em",
      color: "#000", zIndex: 4,
    }}>{p.pos} · #{p.jersey} · {p.team}</div>

    <div style={{
      position: "absolute", bottom: 14, left: 14, right: 14, height: 64,
      background: p.primary, border: "3px solid #000",
      boxShadow: "4px 4px 0 #000",
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)", zIndex: 4,
    }}>
      {[
        { l: "AVG", v: STATS.avg },
        { l: "HR",  v: STATS.hr, hi: true },
        { l: "RBI", v: STATS.rbi },
        { l: "OPS", v: STATS.ops },
      ].map((s, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: s.hi ? "#ffd84a" : "transparent",
          borderRight: i < 3 ? "2px solid #000" : "none",
        }}>
          <div style={{ fontWeight: 900, fontSize: 18,
            color: s.hi ? "#000" : "#fff",
            fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{s.v}</div>
          <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: "0.15em",
            color: s.hi ? "#000" : "rgba(255,255,255,0.7)", marginTop: 3 }}>{s.l}</div>
        </div>
      ))}
    </div>
  </Shell>
);

// ───────────────────────────────────────────────────
// V4 — BROADCAST (event text as the big skewed graphic)
// ───────────────────────────────────────────────────
const V4_Broadcast = ({ p, badge }) => (
  <Shell style={{ background: "#0a0e18", borderRadius: 6 }}>
    <div style={{ position: "absolute", inset: 0,
      background: `linear-gradient(180deg, #0a0e18 0%, #0d1428 60%, #0a0e18 100%)` }}/>
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      background: p.primary,
      clipPath: "polygon(0 0, 100% 0, 100% 22%, 65% 28%, 70% 35%, 0 42%)" }}/>
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
      background: p.secondary,
      clipPath: "polygon(0 38%, 70% 30%, 65% 36%, 100% 30%, 100% 34%, 0 42%)" }}/>

    <div style={{
      position: "absolute", top: 14, right: 14,
      display: "flex", alignItems: "center", gap: 8, zIndex: 5,
    }}>
      <div style={{ background: p.secondary, width: 8, height: 8, borderRadius: "50%",
        boxShadow: `0 0 10px ${p.secondary}` }}/>
      <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.25em", color: "#fff" }}>LIVE</div>
    </div>

    {/* Photo — properly framed full-bleed */}
    <div style={{
      position: "absolute", top: 70, left: 0, right: 0, height: 230,
      backgroundImage: `url(${photoUrl(p.id)})`,
      backgroundSize: "auto 105%",          // contain vertically with breathing room
      backgroundPosition: "center 18%",
      backgroundRepeat: "no-repeat",
      filter: "contrast(1.1)",
      maskImage: "linear-gradient(180deg, transparent 0%, black 12%, black 80%, transparent 100%)",
      WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 12%, black 80%, transparent 100%)",
    }}/>
    <div style={{
      position: "absolute", top: 70, left: 0, right: 0, height: 230,
      background: `linear-gradient(180deg, transparent 30%, ${p.primary}66 100%)`,
    }}/>

    {/* EVENT TEXT — replaces the static "HOME RUN" graphic, dynamic */}
    <div style={{
      position: "absolute", top: 240, left: -8, maxWidth: "92%",
      transform: "skewX(-12deg)",
      background: p.secondary,
      padding: "6px 18px 6px 14px",
      boxShadow: `0 4px 0 ${p.primary}, 0 8px 20px rgba(0,0,0,0.5)`,
      zIndex: 6,
    }}>
      <div style={{
        transform: "skewX(12deg)",
        fontFamily: "'Helvetica Neue', sans-serif",
        fontWeight: 900,
        fontSize: badge.length > 16 ? 13 : 16,
        letterSpacing: "0.05em",
        color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.4)",
        fontStyle: "italic",
        whiteSpace: "nowrap",
      }}>{badge}</div>
    </div>

    <div style={{
      position: "absolute", bottom: 96, left: 0, right: 0, height: 64,
      background: "#000",
      borderTop: `3px solid ${p.secondary}`,
      borderBottom: `1px solid ${p.primary}`,
      padding: "8px 18px",
      display: "flex", alignItems: "center", gap: 12, zIndex: 5,
    }}>
      <div style={{
        background: p.primary, color: "#fff",
        fontWeight: 900, fontSize: 28,
        width: 50, height: 50, minWidth: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontStyle: "italic", letterSpacing: "-0.05em",
        clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)",
      }}>{p.jersey}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 900, fontSize: 22, letterSpacing: "-0.01em",
          color: "#fff", lineHeight: 1, textTransform: "uppercase",
        }}>{p.last}</div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.2em",
          color: p.secondary, marginTop: 4,
        }}>{p.pos} · {p.team}</div>
      </div>
    </div>

    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, height: 90,
      background: "#000", display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      borderTop: `1px solid ${p.primary}`, zIndex: 5,
    }}>
      {[
        { l: "AVG", v: STATS.avg },
        { l: "HR",  v: STATS.hr, hi: true },
        { l: "RBI", v: STATS.rbi },
        { l: "OPS", v: STATS.ops },
      ].map((s, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: s.hi ? p.secondary : "transparent",
          borderRight: i < 3 ? "1px solid rgba(255,255,255,0.1)" : "none", gap: 4,
        }}>
          <div style={{
            fontWeight: 900, fontSize: 26, fontStyle: "italic",
            letterSpacing: "-0.02em", color: "#fff",
            fontVariantNumeric: "tabular-nums", lineHeight: 1,
          }}>{s.v}</div>
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.22em",
            color: s.hi ? "#fff" : "rgba(255,255,255,0.5)" }}>{s.l}</div>
        </div>
      ))}
    </div>
  </Shell>
);

Object.assign(window, { V1_Stylized, V2_Jumbotron, V3_Comic, V4_Broadcast, SAMPLE_PLAYERS, SAMPLE_BADGES });
