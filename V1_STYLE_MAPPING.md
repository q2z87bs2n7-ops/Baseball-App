# V1 Card Style Mapping: React Mock → CSS

## Shell (Outer Card)
**React:**
```jsx
background: p.primary
borderRadius: 10
width: 320
height: 448
overflow: hidden
boxShadow: 0 30px 60px -20px rgba(0,0,0,0.55)
```

**CSS Target:** `#playerCard.pc-v1`

---

## Layer 1: Secondary Overlay (Diagonal Slash)
**React:**
```jsx
position: absolute
inset: 0  /* top: 0, right: 0, bottom: 0, left: 0 */
background: p.secondary
clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 78%)"
zIndex: implicit ~0
```

**CSS Target:** `#playerCard.pc-v1::after`

---

## Layer 2: Dot Pattern Overlay (on same diagonal)
**React:**
```jsx
position: absolute
inset: 0
backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px)"
backgroundSize: "8px 8px"
clipPath: "polygon(0 0, 100% 0, 100% 38%, 0 78%)"
zIndex: implicit ~0
```

**CSS Target:** Need a new `#playerCard.pc-v1::before` (currently hidden)
```css
#playerCard.pc-v1::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: radial-gradient(circle, rgba(0,0,0,0.18) 1.5px, transparent 1.5px);
  background-size: 8px 8px;
  clip-path: polygon(0 0, 100% 0, 100% 38%, 0 78%);
  z-index: 1;
  pointer-events: none;
}
```

---

## Badge (Event Text) - Top Left
**React:**
```jsx
position: absolute
top: 16
left: 14
right: 14
fontFamily: "'Helvetica Neue', sans-serif"
fontWeight: 900
fontSize: 14
letterSpacing: "0.25em"
color: "#fff"
textTransform: "uppercase"
borderBottom: "2px solid rgba(255,255,255,0.5)"
paddingBottom: 8
zIndex: 4
```

**CSS Target:** `#playerCard.pc-v1 .pc-event-badge`
```css
position: absolute;
top: 16;
left: 14;
right: 14;
font-family: 'Helvetica Neue', sans-serif;
font-weight: 900;
font-size: 14px;
letter-spacing: 0.25em;
color: #fff;
text-transform: uppercase;
border-bottom: 2px solid rgba(255,255,255,0.5);
padding-bottom: 8px;
padding-left: 0;
padding-right: 0;
padding-top: 0;
margin: 0;
z-index: 4;
background: transparent;
animation: none;
box-shadow: none;
border: none;
border-bottom: 2px solid rgba(255,255,255,0.5);
```

---

## Name (Last Name) - Top Left
**React:**
```jsx
position: absolute
top: 50
left: 14
right: 14
fontFamily: "'Helvetica Neue', sans-serif"
fontWeight: 900
fontSize: 48
letterSpacing: "-0.04em"
color: "#fff"
lineHeight: 0.9
textTransform: "uppercase"
zIndex: 2
```

**CSS Target:** `#playerCard.pc-v1 .pc-name`
```css
position: absolute;
top: 50px;
left: 14px;
right: 14px;
font-family: 'Helvetica Neue', sans-serif;
font-weight: 900;
font-size: 48px;
letter-spacing: -0.04em;
color: #fff;
line-height: 0.9;
text-transform: uppercase;
z-index: 2;
```

---

## Photo Circle - Top Right
**React:**
```jsx
position: absolute
top: 140
right: 18
width: 165
height: 165
borderRadius: "50%"
backgroundImage: `url(...)`
backgroundSize: "85% auto"
backgroundPosition: "center 25%"
backgroundColor: p.secondary
backgroundRepeat: "no-repeat"
border: "4px solid #fff"
boxShadow: "0 8px 20px rgba(0,0,0,0.3)"
zIndex: 3
```

**CSS Target:** `#playerCard.pc-v1 .pc-photo-bg`
```css
position: absolute;
top: 140px;
right: 18px;
width: 165px;
height: 165px;
border-radius: 50%;
background-size: 85% auto;
background-position: center 25%;
background-color: var(--secondary);
background-repeat: no-repeat;
border: 4px solid #fff;
box-shadow: 0 8px 20px rgba(0,0,0,0.3);
z-index: 3;
bottom: auto;
```

---

## Jersey Number - Left Side
**React:**
```jsx
position: absolute
top: 145
left: 16
fontFamily: "'Helvetica Neue', sans-serif"
fontWeight: 900
fontSize: 130
letterSpacing: "-0.05em"
color: "rgba(255,255,255,0.92)"
lineHeight: 0.8
zIndex: 2
textShadow: `4px 4px 0 ${p.primary}`
```

**CSS Target:** `#playerCard.pc-v1 .pc-jersey`
```css
position: absolute;
top: 145px;
left: 16px;
font-weight: 900;
font-size: 130px;
letter-spacing: -0.05em;
color: rgba(255,255,255,0.92);
line-height: 0.8;
z-index: 2;
text-shadow: 4px 4px 0 var(--primary);
font-style: normal;
display: block;
font-family: 'Helvetica Neue', sans-serif;
```

---

## Position & Team - Above Photo
**React:**
```jsx
position: absolute
top: 110
left: 14
background: "#fff"
color: p.primary
fontWeight: 900
fontSize: 11
letterSpacing: "0.15em"
padding: "4px 10px"
zIndex: 4
```

**CSS Target:** `#playerCard.pc-v1 .pc-team-pos`
```css
position: absolute;
top: 110px;
left: 14px;
background: #fff;
color: var(--primary);
font-weight: 900;
font-size: 11px;
letter-spacing: 0.15em;
padding: 4px 10px;
z-index: 4;
margin: 0;
display: inline-block;
text-transform: uppercase;
```

---

## Stats Grid - Bottom Bar
**React (Container):**
```jsx
position: absolute
bottom: 0
left: 0
right: 0
height: 86
background: "#000"
display: "grid"
gridTemplateColumns: "repeat(4, 1fr)"
zIndex: 4
```

**CSS Target:** `#playerCard.pc-v1 .pc-stats`
```css
position: absolute;
bottom: 0;
left: 0;
right: 0;
height: 86px;
background: #000;
display: grid;
grid-template-columns: repeat(4, 1fr);
z-index: 4;
margin: 0;
border: none;
gap: 0;
```

---

## Stats Cell
**React (Each Cell):**
```jsx
display: "flex"
flexDirection: "column"
alignItems: "center"
justifyContent: "center"
background: s.hi ? p.secondary : "transparent"
gap: 4
```

**CSS Target:** `#playerCard.pc-v1 .pc-stat`
```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
background: transparent;  /* Override with .pc-hr-highlight for HR stat */
gap: 4px;
border-right: 1px solid rgba(255,255,255,0.15);
border-top: none;
padding: 0;
```

**For highlighted stat (HR):**
```css
#playerCard.pc-v1 .pc-stat.pc-hr-highlight {
  background: var(--secondary);
}
```

---

## Stat Value
**React:**
```jsx
fontWeight: 900
fontSize: 26
color: "#fff"
fontVariantNumeric: "tabular-nums"
lineHeight: 1
```

**CSS Target:** `#playerCard.pc-v1 .pc-stat-val`
```css
font-weight: 900;
font-size: 26px;
color: #fff;
font-variant-numeric: tabular-nums;
line-height: 1;
```

---

## Stat Label
**React:**
```jsx
fontSize: 9
fontWeight: 900
letterSpacing: "0.2em"
color: s.hi ? "#fff" : "rgba(255,255,255,0.6)"
```

**CSS Target:** `#playerCard.pc-v1 .pc-stat-lbl`
```css
font-size: 9px;
font-weight: 900;
letter-spacing: 0.2em;
color: rgba(255,255,255,0.6);  /* Default for unhighlighted */
```

**For highlighted stat:**
```css
#playerCard.pc-v1 .pc-stat.pc-hr-highlight .pc-stat-lbl {
  color: #fff;
}
```

---

## Key Differences from Current CSS

1. **::before layer:** Currently hidden; needs to show dot pattern overlay with clip-path
2. **Proportions:** Photo is 165×165, not 170×170
3. **Jersey positioning:** top: 145 (not 120), left: 16 (not 10), font-size: 130 (not 140)
4. **Name positioning:** Should be absolutely positioned at top: 50, not inside a relatively positioned header
5. **Badge positioning:** Absolutely positioned at top: 16, not relative inside header
6. **Team/Pos positioning:** Absolutely positioned at top: 110, left: 14, not relative with margin
7. **Stats grid:** Height 86px (not 90px); cells use flex layout with proper gap and alignment
8. **Overall layout:** All major elements are absolutely positioned peers, not nested within .pc-header

---

## Summary: The Issue

The current index.html structure is hierarchical (nested), but the React mock positions everything absolutely. The CSS needs to:

1. Override the relative/nested positioning
2. Make all elements absolutely positioned
3. Apply exact px values for top/left/right
4. Use proper z-index layering (0 < 1 < 2 < 3 < 4)
5. Show the ::before dot pattern overlay

**Result:** Exact pixel-perfect match to the React mock.
