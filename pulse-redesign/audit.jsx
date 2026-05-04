// Audit + assessment artboard. Long-form, but typeset like a design memo.
const PulseAudit = () => {
  const wrap = {
    width: 1200, padding: '56px 64px 64px', background: '#0E1726', color: '#E6E9F0',
    fontFamily: '"Inter", system-ui, sans-serif', lineHeight: 1.55,
    borderRadius: 8,
  };
  const kicker = { fontSize: 11, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: '#9CA6B8' };
  const h1 = { fontSize: 38, fontWeight: 800, letterSpacing: '-0.02em', margin: '6px 0 14px', color: '#fff' };
  const lede = { fontSize: 16, color: '#B7C0CF', margin: '0 0 28px', maxWidth: 880 };
  const h2 = { fontSize: 19, fontWeight: 700, letterSpacing: '-0.005em', margin: '34px 0 8px', color: '#fff', display: 'flex', gap: 10, alignItems: 'baseline' };
  const num = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#6F7B91', fontSize: 13, fontWeight: 600 };
  const p = { fontSize: 14.5, color: '#C7CEDB', margin: '0 0 10px', maxWidth: 920 };
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '12px 0 6px' };
  const card = { background: '#152034', border: '1px solid #233247', borderRadius: 10, padding: '14px 16px' };
  const cardHd = { fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#7B8AA3', marginBottom: 6 };
  const callout = (tone) => ({
    background: tone === 'good' ? 'rgba(60,190,100,0.08)' : tone === 'warn' ? 'rgba(255,170,60,0.08)' : 'rgba(255,90,90,0.08)',
    borderLeft: `3px solid ${tone === 'good' ? '#3CBE64' : tone === 'warn' ? '#FFAA3C' : '#FF5A5A'}`,
    padding: '10px 14px', borderRadius: 4, margin: '8px 0 14px', fontSize: 13.5, color: '#D4DBE7',
  });
  const tag = (s) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: s === 'keep' ? 'rgba(60,190,100,0.16)' : s === 'rework' ? 'rgba(255,170,60,0.16)' : 'rgba(255,90,90,0.16)', color: s === 'keep' ? '#7BD79A' : s === 'rework' ? '#FFC36F' : '#FF8B8B', marginRight: 8 });

  return (
    <div style={wrap}>
      <div style={kicker}>Pulse · structural audit & redesign brief</div>
      <h1 style={h1}>Pulse, restructured around what it actually is.</h1>
      <p style={lede}>
        Pulse grew feature by feature: a feed, then a ticker, then a carousel, then a focus card, then a top bar, then a lens. Each addition was right on its own, but the section now reads as a stack of <em>peers</em> when its features are actually <em>three nested layers of attention</em> — overview, focus, story. This memo names that structure, then proposes three directions that respect it. It also takes a position on the team-theme question.
      </p>

      <h2 style={h2}><span style={num}>01</span><span>What Pulse really is — three layers of attention</span></h2>
      <p style={p}>
        When you said "lean-back or lean-in depending on the game," that's the whole shape of the product. Pulse isn't one mode — it's a glance/scan/dive ladder, and every feature maps cleanly onto one rung:
      </p>
      <div style={grid}>
        <div style={card}>
          <div style={cardHd}>Layer 1 · Glance</div>
          <div style={{ fontSize: 14, color: '#D4DBE7' }}><strong style={{color:'#fff'}}>"What's the state of the league?"</strong><br/>Ticker, sound alerts, MY TEAM lens, top-bar status. Answers in &lt; 2 seconds without reading.</div>
        </div>
        <div style={card}>
          <div style={cardHd}>Layer 2 · Focus</div>
          <div style={{ fontSize: 14, color: '#D4DBE7' }}><strong style={{color:'#fff'}}>"What's the best game to watch right now?"</strong><br/>At-Bat Focus card, radio, the auto-tension pick. The thing that pulls you from lean-back to lean-in.</div>
        </div>
        <div style={card}>
          <div style={cardHd}>Layer 3 · Story</div>
          <div style={{ fontSize: 14, color: '#D4DBE7' }}><strong style={{color:'#fff'}}>"What's worth knowing about?"</strong><br/>Story Carousel, play feed, news, upcoming/completed. Narrative beats, not real-time.</div>
        </div>
        <div style={card}>
          <div style={cardHd}>Today's layout</div>
          <div style={{ fontSize: 14, color: '#D4DBE7' }}>The three layers are <em>scattered</em>: ticker is up top (good), but Focus sits in the rail below news (wrong rung), and the carousel sits between ticker and feed (good but visually equal to the feed it should outrank).</div>
        </div>
      </div>
      <div style={callout('warn')}>
        <strong>Diagnosis:</strong> the section feels less exciting than it should because the most exciting element on the page — At-Bat Focus, the live game pulling you in — is currently a quiet card buried below MLB News in the right rail. The hierarchy doesn't match the feature's role.
      </div>

      <h2 style={h2}><span style={num}>02</span><span>What works and shouldn't move</span></h2>
      <ul style={{ ...p, paddingLeft: 22 }}>
        <li><span style={tag('keep')}>Keep</span>The ticker as the persistent glance layer. Sticky at top is correct. Chip metaphor (score + diamond + outs) is dense and readable.</li>
        <li><span style={tag('keep')}>Keep</span>Sound alerts as ambient background channel. This is Pulse's personality and matches the second-screen mode.</li>
        <li><span style={tag('keep')}>Keep</span>State-aware empty states (pre-game hype, intermission countdown, slate complete). These do real work.</li>
        <li><span style={tag('keep')}>Keep</span>Story Carousel as a layer. It's a genuinely novel pattern — narrative summarisation living next to raw plays.</li>
        <li><span style={tag('keep')}>Keep</span>Auto-Focus tension formula. The fact that it picks the right game without input is the magic; surface it more, don't hide it.</li>
      </ul>

      <h2 style={h2}><span style={num}>03</span><span>What's mispositioned and should move</span></h2>
      <ul style={{ ...p, paddingLeft: 22 }}>
        <li><span style={tag('rework')}>Rework</span><strong>At-Bat Focus is buried.</strong> It belongs to Layer 2 (Focus) but lives in Layer 3 real estate (rail, below news). The whole section's "exciting" feel hinges on this card being primary, not tertiary.</li>
        <li><span style={tag('rework')}>Rework</span><strong>The feed and the carousel are visually peers.</strong> They serve different roles — the carousel is curated narrative (slow, editorial), the feed is firehose (fast, raw). Today they look like the same kind of card stacked.</li>
        <li><span style={tag('rework')}>Rework</span><strong>The right rail is a junk drawer.</strong> Collection module + Focus card + News carousel + Upcoming + Completed = five unrelated modules in one column. They share location but not purpose.</li>
        <li><span style={tag('rework')}>Rework</span><strong>Two stacked headers (top bar + ticker) eat 80px of vertical above the fold</strong> before the user sees a single play. That's a lot for a section meant to feel immediate.</li>
        <li><span style={tag('rework')}>Rework</span><strong>The top bar leans hard on icon-only buttons.</strong> 🔊 📻 ☀️ + a MY TEAM toggle + (conditional) Yesterday's Recap is six controls in a row, all visually equal. Nothing there is the obvious "primary" action because there isn't one.</li>
      </ul>

      <h2 style={h2}><span style={num}>04</span><span>What's broken</span></h2>
      <ul style={{ ...p, paddingLeft: 22 }}>
        <li><span style={tag('drop')}>Address</span><strong>Mobile collapses to a strip of cards in one column</strong> with the same vertical reading order as desktop. Focus mini-bar helps, but the rail content (news, upcoming, completed) shoves itself between the carousel and the feed on mobile, making mobile reading order nonsensical.</li>
        <li><span style={tag('drop')}>Address</span><strong>News in the Pulse rail.</strong> News belongs to its own section and exists in the app already. Having it inside Pulse fragments where the user looks for headlines.</li>
        <li><span style={tag('drop')}>Address</span><strong>Border-radius and density inconsistencies</strong> already documented in the existing easy-win review — those carry forward.</li>
      </ul>

      <h2 style={h2}><span style={num}>05</span><span>The team-theme question (you asked, here's an opinion)</span></h2>
      <p style={p}>
        The decision to disconnect Pulse from team theming was <strong style={{color:'#fff'}}>directionally correct, executed incompletely</strong>. Here's the honest read:
      </p>
      <div style={callout('good')}>
        <strong>Why it's right:</strong> Pulse is the only league-wide section in the app. Every other section (Home, Schedule, Standings, News) exists in the context of a chosen team. If Pulse adopted the active team's color, the user's emotional reading would be "this is my Mets feed," but the content shows runs scoring for 14 other games simultaneously. The mismatch is real. A neutral identity says "this is the league" — which it is.
      </div>
      <div style={callout('warn')}>
        <strong>Why it feels off:</strong> Pulse going neutral wasn't paired with any other signal of "you're somewhere different." Switching to Pulse from a Mets-themed Home tab is a hard cut to navy, with no transition, no different chrome shape, no top-bar identity moment. The user reads it as "Pulse is broken / lost my theme" rather than "Pulse is the league view, intentionally neutral."
      </div>
      <p style={p}>
        <strong style={{color:'#fff'}}>The fix isn't to re-attach team theming.</strong> It's to make Pulse's neutrality feel <em>intentional</em>. Two specific moves:
      </p>
      <ul style={{ ...p, paddingLeft: 22 }}>
        <li><strong>1. A clearer "I am Pulse" identity.</strong> The top bar today is a thin nav strip. It should be the place where Pulse's neutrality is asserted — a denser, broadcast-style header that the rest of the app doesn't have. When you arrive on Pulse, the chrome itself should change shape, not just color.</li>
        <li><strong>2. A small team-respect surface.</strong> Inside Pulse, the user's team's game (when live) should always have a visual privilege — a colored chip border in the ticker, a "your game" callout in the focus zone, a one-tap shortcut to switch Focus to that game. This honors the team affiliation without painting the whole section in it.</li>
      </ul>
      <p style={p}>
        Said differently: Pulse should be team-<em>aware</em>, not team-<em>themed</em>. The existing MY TEAM lens is the right primitive; it just needs to graduate from a hidden filter pill to a more visible "your team's game is in inning 7, tied" surface.
      </p>

      <h2 style={h2}><span style={num}>06</span><span>How Pulse fits in the whole app (quick aside)</span></h2>
      <p style={p}>
        Pulse is doing too much identity work for the app right now. It's both <em>a tab</em> (peer to Home, Schedule, etc.) and <em>the brand</em> (the bolt + "MLB PULSE" wordmark only appears in this section, but it reads as the app's identity). That's why the "is it disconnected from team theming?" question is hard to answer cleanly — Pulse is functioning as the app's masthead while pretending to be a tab.
      </p>
      <p style={p}>
        A small idea worth considering separately from this redesign: the bolt / "PULSE" wordmark could be promoted to <strong>app-wide</strong>, sitting next to whatever team chrome is currently active in other tabs. That way Pulse-the-section drops one job (being the brand) and can fully commit to its real job (being the live, league-wide attention engine).
      </p>

      <h2 style={h2}><span style={num}>07</span><span>The three directions on this canvas</span></h2>
      <div style={grid}>
        <div style={card}>
          <div style={cardHd}>A · Conservative restructure</div>
          <div style={{ fontSize: 13.5, color: '#D4DBE7' }}>Same two-column shape. Promote At-Bat Focus to top of rail above News. Tighten chrome, fix the easy wins, sharpen the carousel-vs-feed visual distinction. Lowest risk, highest ratio of polish-to-disruption.</div>
        </div>
        <div style={card}>
          <div style={cardHd}>B · Hero focus zone</div>
          <div style={{ fontSize: 13.5, color: '#D4DBE7' }}>Reorganize around the three layers. A new <em>Focus zone</em> spans the full width above the fold (At-Bat Focus + Story Carousel as a paired hero). Feed below as the firehose. Rail keeps only ambient modules (upcoming, completed, collection).</div>
        </div>
        <div style={card}>
          <div style={cardHd}>C · Broadcast control room</div>
          <div style={{ fontSize: 13.5, color: '#D4DBE7' }}>Pulse as a sports-TV broadcast graphics package. Persistent left dock (live games as a vertical board), center stage for Focus + carousel, right column for narrative feed. Inspired by your "TV" reference. Bold, but every feature still has a home.</div>
        </div>
        <div style={card}>
          <div style={cardHd}>Mobile, all three</div>
          <div style={{ fontSize: 13.5, color: '#D4DBE7' }}>Each direction includes a mobile artboard. The biggest mobile gain across all three: putting Focus directly under the ticker as a sticky strip, so the live game-of-the-moment is always one glance away regardless of scroll.</div>
        </div>
      </div>

      <p style={{ ...p, marginTop: 28, color: '#7B8AA3', fontSize: 13 }}>
        Pick a direction (or mix elements across) and I'll go deep — full interactive mock with all the real Pulse states, the focus card actually wired up, and the mobile flow.
      </p>
    </div>
  );
};
window.PulseAudit = PulseAudit;
