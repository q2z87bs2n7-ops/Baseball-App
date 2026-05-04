// Main deep Pulse app. Stitches everything together with state + interactivity.

const PulseDeepApp = () => {
  const [focusId, setFocusId] = React.useState(1); // NYM @ PHI — your team, hot
  const [storyIdx, setStoryIdx] = React.useState(0);
  const [lens, setLens] = React.useState(false);
  const [scheme, setScheme] = React.useState('dark');
  const [sound, setSound] = React.useState(true);
  const [radio, setRadio] = React.useState(false);
  const [mobileMode, setMobileMode] = React.useState('home'); // home | focus
  const [showState, setShowState] = React.useState('live'); // live | hype | yesterday

  PTHEME(scheme); // <-- mutates module-level PX so all children re-read fresh tokens this render

  // Auto-rotate stories
  React.useEffect(() => {
    const t = setInterval(() => setStoryIdx(i => (i+1) % PSTORIES.length), 4500);
    return () => clearInterval(t);
  }, []);

  const focus = PGAMES.find(g => g.id === focusId);
  const story = PSTORIES[storyIdx];

  const counts = {
    live: PGAMES.filter(g=>g.state==='live').length,
    final: PGAMES.filter(g=>g.state==='final').length,
    preview: PGAMES.filter(g=>g.state==='preview').length,
    myTeamLive: PGAMES.some(g => g.myteam && g.state==='live'),
  };

  const swapStory = (dir) => setStoryIdx(i => (i + dir + PSTORIES.length) % PSTORIES.length);

  const visibleFeed = lens ? PFEED.filter(it => it.myteam) : PFEED;

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: scheme==='dark' ? '#070D17' : '#E8ECF3', padding: '24px', fontFamily: FX, transition:'background .25s' }}>

      {/* State switcher — show off the multi-state power */}
      <div style={{ maxWidth: 1700, margin: '0 auto 18px', display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.18em', color: scheme==='dark'?'#5C6B85':'#5B6678', textTransform:'uppercase', marginRight: 4 }}>Show state</span>
        {[['live','Live slate'],['hype','Pre-game hype'],['yesterday','Yesterday\u2019s recap']].map(([k,label])=>(
          <button key={k} onClick={()=>setShowState(k)} style={{
            background: showState===k ? PX.warn : 'transparent',
            color: showState===k ? '#0B1424' : PX.muted,
            border:`1px solid ${showState===k ? PX.warn : PX.border}`,
            fontSize: 11, fontWeight: 700, letterSpacing:'.08em', textTransform:'uppercase',
            padding:'5px 12px', borderRadius: 999, cursor:'pointer',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 392px', gap: 24, maxWidth: 1700, margin: '0 auto' }}>

        {/* DESKTOP MOCK */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', color: '#5C6B85', textTransform:'uppercase', marginBottom: 8 }}>Desktop · 1280</div>
          <div style={{ width: 1280, maxWidth: '100%', background: PX.bg, borderRadius: 8, overflow:'hidden', border: `1px solid ${PX.border}` }}>
            <PTopBar
              counts={counts}
              lens={lens} onLens={()=>setLens(l=>!l)}
              scheme={scheme} onScheme={()=>setScheme(s=>s==='dark'?'light':'dark')}
              sound={sound} onSound={()=>setSound(s=>!s)}
              radio={radio} onRadio={()=>setRadio(r=>!r)}
              onYesterday={()=>{}}
            />
            <PTicker games={PGAMES} focusId={focusId} onPick={setFocusId} lens={lens} />

            {/* Hero zone — swaps based on slate state */}
            <div style={{ padding:'16px 18px 4px' }}>
              {showState === 'live' && (
                <PHero game={focus} story={story} storyIdx={storyIdx} storyTotal={PSTORIES.length} onSwapStory={swapStory} />
              )}
              {showState === 'hype' && <PHype kind="pregame" />}
              {showState === 'yesterday' && <PYesterdayHero />}
            </div>

            {/* Body — swaps with state */}
            {showState === 'live' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:16, padding:'10px 18px 24px' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', margin:'14px 0 10px' }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                      <PKicker>Live · firehose</PKicker>
                      <span style={{ fontSize: 13, fontWeight: 700, color: PX.text }}>League play feed</span>
                    </div>
                    {lens && <span style={{ fontSize: 10, color: PX.team, fontFamily: MX, fontWeight: 700, letterSpacing:'.12em', display:'flex', alignItems:'center', gap:6 }}><PDot color={PX.team} size={5} /> MY TEAM ONLY</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {PFEED.map((it,i)=>(
                      <PFeedRow key={i} item={it} dim={lens && !it.myteam} />
                    ))}
                  </div>
                </div>
                <PRail games={PGAMES} lens={lens} />
              </div>
            )}

            {showState === 'hype' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:16, padding:'18px 18px 24px' }}>
                <div>
                  <PKicker>Today\u2019s storylines</PKicker>
                  <div style={{ marginTop: 10, display:'flex', flexDirection:'column', gap:8 }}>
                    {PSTORIES.map((s,i)=>(
                      <div key={i} style={{ background: PX.card, border:`1px solid ${PX.border}`, borderLeft:`3px solid ${({warn:PX.warn,hr:PX.hr,score:PX.green,blue:PX.blue})[s.tone]||PX.muted}`, borderRadius:10, padding:'12px 14px' }}>
                        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.16em', color: ({warn:PX.warn,hr:PX.hr,score:PX.green,blue:PX.blue})[s.tone]||PX.muted, textTransform:'uppercase' }}>{s.kicker}</span>
                          <span style={{ fontSize: 10.5, color: PX.dim, fontFamily: MX }}>{s.meta}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: PX.white, lineHeight: 1.3 }}>{s.title}</div>
                        <div style={{ fontSize: 12, color: PX.muted, marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <PRail games={PGAMES} lens={lens} />
              </div>
            )}

            {showState === 'yesterday' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 290px', gap:16, padding:'18px 18px 24px' }}>
                <div>
                  <PKicker>All 15 games</PKicker>
                  <div style={{ marginTop: 10, display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8 }}>
                    {[
                      { a:'SD', as:5, h:'HOU', hs:4, headline:'Soto walks it off in the 11th' },
                      { a:'LAD', as:9, h:'SF', hs:2, headline:'Ohtani: 2 HR, 6 RBI day' },
                      { a:'NYM', as:6, h:'PHI', hs:5, headline:'Lindor caps 4-run 8th with HR' },
                      { a:'BAL', as:8, h:'TOR', hs:3, headline:'Henderson goes deep twice' },
                      { a:'CHC', as:7, h:'STL', hs:6, headline:'Suzuki walks off in extras' },
                      { a:'CLE', as:3, h:'MIN', hs:1, headline:'Bibee: 11 K, 1 ER over 7' },
                    ].map((g,i)=>(
                      <div key={i} style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius:10, padding:'10px 12px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: PX.white, fontFamily: MX, letterSpacing:'.04em' }}>
                            {g.a} <span style={{color: g.as>g.hs?PX.warn:PX.muted}}>{g.as}</span> · {g.h} <span style={{color: g.hs>g.as?PX.warn:PX.muted}}>{g.hs}</span>
                          </span>
                          <span style={{ fontSize: 10, color: PX.dim, fontFamily: MX, fontWeight: 700 }}>F</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: PX.muted, marginTop: 4, lineHeight: 1.4 }}>{g.headline}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <PRail games={PGAMES} lens={lens} />
              </div>
            )}
          </div>

          {/* Tweaks reminder */}
          <div style={{ marginTop: 24, padding: 18, background: scheme==='dark'?'#0F1A2C':'#FFFFFF', border:`1px solid ${PX.border}`, borderRadius: 10, color: PX.muted, fontSize: 13, lineHeight: 1.6 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.18em', color: PX.dim, textTransform:'uppercase', marginBottom: 8 }}>Try it</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Toggle <strong style={{color:PX.text}}>state pills</strong> at the top — Live / Pre-game hype / Yesterday\u2019s recap.</li>
              <li>Click ☀️/🌙 in the top bar — full light/dark theme swap.</li>
              <li>Click any <strong style={{color:PX.text}}>live ticker chip</strong> → Focus card switches to that game.</li>
              <li>Click <strong style={{color:PX.team}}>YOUR GAME</strong> in the top bar → MY TEAM lens dims non-NYM rows.</li>
            </ul>
          </div>

          {/* Claude Code handoff doc */}
          <div style={{ marginTop: 24, padding: 22, background: scheme==='dark'?'#0F1A2C':'#FFFFFF', border:`1px solid ${PX.border}`, borderRadius: 10, color: PX.text, fontSize: 13, lineHeight: 1.65 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.18em', color: PX.warn, textTransform:'uppercase', marginBottom: 4 }}>Handoff</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: PX.white, marginBottom: 14, letterSpacing:'-.01em' }}>How to ship this with Claude Code</div>

            <div style={{ color: PX.muted, marginBottom: 18 }}>
              The honest answer: this redesign is mostly <strong style={{color:PX.text}}>CSS + small DOM moves</strong>, not new feature code. Your Pulse logic, polling, story scoring, sound system, focus tension formula — none of that needs to change. That makes it unusually well-suited to Claude Code, because each step is a self-contained, scoped diff.
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 18, marginBottom: 18 }}>
              <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.14em', color: PX.green, textTransform:'uppercase', marginBottom: 6 }}>✓ Spoon-feed-able</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: PX.muted }}>
                  <li>The neutral <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>--p-*</code> token set + light-mode variant (drop-in CSS)</li>
                  <li>Top bar restructure (markup already present, just reordered)</li>
                  <li>Hero zone — new container that wraps the existing <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>focusCard</code> + story carousel</li>
                  <li>Feed row visual unification (one CSS rule covers HR/SCORE/RISP variants)</li>
                  <li>MY TEAM lens behavior change (filter → dim) — one JS toggle</li>
                  <li>Mobile sticky Focus strip — new element, position:sticky</li>
                </ul>
              </div>
              <div style={{ background: PX.card, border:`1px solid ${PX.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing:'.14em', color: PX.warn, textTransform:'uppercase', marginBottom: 6 }}>⚡ Needs your eye</div>
                <ul style={{ margin: 0, paddingLeft: 16, color: PX.muted }}>
                  <li>Color choices in light mode against your team palette overrides</li>
                  <li>How aggressively the Hero zone preempts on big plays (HR detection already exists)</li>
                  <li>Mobile Focus overlay — interaction polish, swipe-to-dismiss</li>
                  <li>Whether to keep the Story Carousel as a separate band or fold into Hero (this mock keeps both visible at once via the lower-third strap)</li>
                </ul>
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: PX.white, marginTop: 20, marginBottom: 10 }}>Suggested rollout order</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: PX.muted }}>
              <li><strong style={{color:PX.text}}>Token system</strong> — drop in the <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>--p-*</code> set with both dark and light variants. No visible change yet, but everything downstream depends on it. <em>One file, one PR.</em></li>
              <li><strong style={{color:PX.text}}>Light mode</strong> — wire <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>setPulseColorScheme</code> to swap <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>data-pulse-scheme</code> on <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>#pulse</code>; CSS does the rest.</li>
              <li><strong style={{color:PX.text}}>Top bar layout</strong> — markup is already there, mostly reordering + the new Yesterday entry pill.</li>
              <li><strong style={{color:PX.text}}>Hero zone wrapper</strong> — a new container that holds focusCard <em>full-width on Pulse</em> with the story carousel as a strap below. <em>This is the biggest visible change but a pure DOM move; logic untouched.</em></li>
              <li><strong style={{color:PX.text}}>Right rail trim</strong> — remove focusCard from rail (it lives in Hero now). Rail is now just schedule + finals + collection + news.</li>
              <li><strong style={{color:PX.text}}>Feed row CSS sweep</strong> — collapse 5–6 visually divergent row styles into one shared base + tone-tinted left border.</li>
              <li><strong style={{color:PX.text}}>Mobile sticky strip</strong> — new element, position:sticky under ticker, opens existing focus overlay on tap.</li>
              <li><strong style={{color:PX.text}}>MY TEAM dim behavior</strong> — change one filter call to a class toggle on rows.</li>
            </ol>

            <div style={{ marginTop: 20, padding: 14, background: PX.bg2, border:`1px solid ${PX.border}`, borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing:'.14em', color: PX.warn, textTransform:'uppercase', marginBottom: 8 }}>How to actually prompt Claude Code</div>
              <div style={{ color: PX.muted, marginBottom: 8 }}>
                Don\u2019t paste the whole vision at once. Each step above is one Claude Code session. The shape that works:
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: PX.muted }}>
                <li>Open this mock side-by-side with the live app (both running locally).</li>
                <li>For each step: say <em>\u201cPulse redesign step N. Here\u2019s the mock and the current code. Change only X. Don\u2019t touch the polling, story scoring, or audio.\u201d</em></li>
                <li>Claude Code is best with hard boundaries — <strong style={{color:PX.text}}>tell it which files it can\u2019t touch</strong> (app.js polling, pulse-card-templates.js, focusCard.js internals).</li>
                <li>After each step, reload Pulse in the browser and confirm before moving on. Bump the SW <code style={{color:PX.text, fontFamily: MX, fontSize: 12}}>CACHE</code> constant per CLAUDE.md.</li>
                <li>If a step looks wrong, screenshot the live result + the mock and ask Claude Code to reconcile.</li>
              </ol>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: PX.dim, fontStyle:'italic' }}>
              I can also generate a step-specific prompt + scoped file list for any of the 8 steps above — just ask for \u201cstep 4 prompt\u201d and I\u2019ll write it.
            </div>
          </div>
        </div>

        {/* MOBILE MOCK */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', color: '#5C6B85', textTransform:'uppercase', marginBottom: 8 }}>Mobile · 390 · {mobileMode==='focus'?'Focus overlay':'Home'}</div>
          {mobileMode === 'home' ? (
            <PMobile
              focus={focus} story={story} storyIdx={storyIdx} storyTotal={PSTORIES.length}
              onSwapStory={swapStory}
              lens={lens} onLens={()=>setLens(l=>!l)}
              onOpenFocus={()=>setMobileMode('focus')}
              scheme={scheme} onScheme={()=>setScheme(s=>s==='dark'?'light':'dark')}
              sound={sound} onSound={()=>setSound(s=>!s)}
            />
          ) : (
            <PMobileFocus focus={focus} onClose={()=>setMobileMode('home')} />
          )}
        </div>

      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<PulseDeepApp />);
