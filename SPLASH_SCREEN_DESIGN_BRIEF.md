# MLB Pulse PWA Splash Screen Design Brief

## 1. Overview

**Project:** MLB Pulse — Live MLB Tracker PWA  
**Component:** Loading Splash Screen / Boot Overlay  
**Purpose:** Create a branded, responsive loading experience that bridges the gap between PWA manifest splash and interactive app content  
**Platform:** Mobile-first (iOS/Android PWA), Tablet, Desktop  
**Current Version:** v3.34.2  

---

## 2. Context & Problem Statement

### Current Experience
- **OS splash screen** (200–500ms) — Android/iOS system splash based on `manifest.json` colors (#7C2D5C bg, #0E3E1A theme)
- **White/blank screen** (500ms–2s) — HTML renders before JS loads and populates content
- **Content appears** with loading placeholders ("Loading next game...", "Loading standings...")
- **Pulse initializes** (1–3s) — app becomes interactive

### Pain Point
The gap between OS splash and interactive content feels empty and unprofessional. Users see a blank screen with no indication of progress or brand presence.

### Goal
Show a branded loading experience that:
1. Appears immediately after OS splash dismisses
2. Displays the MLB Pulse logo + loading indicator
3. Respects theme preference (light/dark mode)
4. Dismisses smoothly when app is ready
5. Feels native and intentional, not like a crash or hang

---

## 3. Design Requirements

### 3.1 Visual Identity

**Logo:**
- ⚡ Bolt symbol (vibrant, energetic)
- "MLB PULSE" wordmark below
- Use existing brand colors where possible

**Color Palette:**
- **Primary:** Pulse accent color (teal/cyan or vibrant variant)
- **Background:** Respond to user's Pulse theme preference:
  - **Dark mode (default):** Deep background (#111827 or Pulse dark), semi-transparent overlay
  - **Light mode:** Light background (#f8f9fa or Pulse light), semi-transparent overlay
- **Text:** High contrast white/dark depending on background
- **Spinner/Animation:** Primary accent color (⚡ bolt color or team primary if available)

**Typography:**
- Logo: Existing "PULSE" brand font if available, else sans-serif bold (Helvetica, system font)
- Size: Logo ~60–80px on mobile, up to 120px on tablet/desktop
- Spacing: Bolt + text vertically stacked, centered

### 3.2 Layout

**Mobile (≤480px):**
```
┌─────────────────────────┐
│                         │
│                         │
│          ⚡             │  (bolt icon, ~60px)
│      MLB PULSE          │  (text below)
│                         │
│      ◰◰◰ ○ ◰◰◰         │  (loading spinner)
│                         │
│                         │
└─────────────────────────┘
```
- Full-screen overlay (fixed position)
- Centered, vertically and horizontally
- Padding: 16px safe area on edges
- Bolt: 60px
- Wordmark: 20px font
- Spinner: 32px diameter, 16px below text

**Tablet (481–1024px):**
- Same center-screen layout
- Bolt: 80px
- Wordmark: 24px font
- Spinner: 40px diameter

**Desktop (≥1025px):**
- Same center-screen layout
- Bolt: 100px
- Wordmark: 28px font
- Spinner: 48px diameter

### 3.3 States & Transitions

**State 1: Initial Load (0–100ms)**
- Overlay fully opaque, instant appearance
- Spinner begins rotating

**State 2: Active Loading (100ms–2000ms)**
- Overlay remains at 100% opacity
- Spinner animates continuously

**State 3: Dismissal (2000ms–2500ms)**
- Fade out over 300–500ms (ease-in)
- Optional: slight scale-down of logo during fade (1.0 → 0.95)
- Pointer-events: none (can't interact during dismissal)

**State 4: Hidden (2500ms+)**
- `display: none` or `visibility: hidden` (not just `opacity:0`)

### 3.4 Loading Spinner

**Options (Designer to choose one):**

**Option A: Rotating Bolt**
- ⚡ icon rotates 360° continuously
- Rotation speed: 2s per full rotation
- Easing: linear
- Opacity pulse: optional (0.6 → 1.0 → 0.6 over 1.5s, offset from rotation)

**Option B: Spinner Ring**
- Circular SVG stroke spinner (iOS/Android style)
- Diameter: 32–48px
- Stroke width: 3px
- Color: Pulse primary accent
- Rotation speed: 1s per full rotation
- Segment animated (arc sweep style, not full ring)

**Option C: Pulsing Dots**
- 3 dots (●●●) below text
- Fade in/out sequentially
- Timing: 600ms per dot cycle
- Colors: gradient from accent → muted

**Option D: Progress Bar (Minimal)**
- Horizontal bar below text (4px height)
- Width: 40% of screen (or 200px on mobile)
- Indeterminate animation (flows left-to-right, restarts)
- Color: Pulse primary accent

### 3.5 Theme Responsiveness

**Dark Mode (default Pulse):**
- Background: `rgba(17, 24, 39, 0.95)` (dark semi-transparent)
- Text: `#e8eaf0` (light text)
- Spinner: Pulse accent color (computed from team theme or fixed teal)
- Bolt color: Match current Pulse primary

**Light Mode (when toggled):**
- Background: `rgba(248, 249, 250, 0.95)` (light semi-transparent)
- Text: `#1f2937` (dark text)
- Spinner: Pulse accent color (darker/higher contrast)
- Bolt color: Match current Pulse primary

**Dynamic (Future Enhancement):**
- If Pulse theme is already in localStorage on reload, apply it immediately
- Logo colors inherit from Pulse theme CSS vars (--p-primary, --p-accent)

---

## 4. Interaction & Behavior

### 4.1 Dismissal Trigger

The overlay should dismiss when **one of these conditions is met** (whichever comes first):

1. **Pulse initializes** (preferred) — `pulseInitialized = true` in app.js
2. **Home content loads** — `todayGame` and `nextGame` divs have content (fallback)
3. **Hard timeout** — 5 seconds after page load (safety net, should never hit)

### 4.2 Programmatic Control

```javascript
// Hide the splash screen
function dismissSplash() {
  const splash = document.getElementById('splashOverlay');
  if (!splash) return;
  splash.classList.add('splash-dismissing'); // triggers fade-out animation
  setTimeout(() => {
    splash.style.display = 'none';
  }, 500); // duration of fade-out
}

// Called from app.js boot sequence
// Example: at line 5665 after pulseInitialized = true
```

### 4.3 No User Interaction

- Overlay is not clickable (pointer-events: none)
- No buttons, links, or touch targets
- Tapping anywhere does nothing (intended behavior)

---

## 5. Technical Constraints & Implementation

### 5.1 Inline CSS (Critical Path)

The splash overlay must be defined **inline in `<head>`** before `styles.css` loads, so it appears immediately:

```html
<style>
  #splashOverlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(17, 24, 39, 0.95);
    pointer-events: none;
    opacity: 1;
    transition: opacity 0.4s ease-in;
  }
  
  #splashOverlay.splash-dismissing {
    opacity: 0;
  }
  
  .splash-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  
  .splash-bolt {
    width: 60px;
    height: 60px;
    /* emoji or inline SVG */
  }
  
  .splash-text {
    font-size: 20px;
    font-weight: 700;
    color: #e8eaf0;
    letter-spacing: 0.1em;
  }
  
  .splash-spinner {
    width: 32px;
    height: 32px;
    margin-top: 8px;
    animation: splashSpin 2s linear infinite;
  }
  
  @keyframes splashSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
```

### 5.2 HTML Structure

```html
<div id="splashOverlay">
  <div class="splash-content">
    <div class="splash-bolt">⚡</div>
    <div class="splash-text">MLB PULSE</div>
    <div class="splash-spinner">
      <!-- SVG or emoji spinner -->
    </div>
  </div>
</div>
```

### 5.3 Responsive Breakpoints (via Media Queries)

```css
@media (max-width: 480px) {
  .splash-bolt { width: 60px; height: 60px; font-size: 48px; }
  .splash-text { font-size: 18px; }
  .splash-spinner { width: 32px; height: 32px; }
}

@media (min-width: 481px) and (max-width: 1024px) {
  .splash-bolt { width: 80px; height: 80px; font-size: 64px; }
  .splash-text { font-size: 22px; }
  .splash-spinner { width: 40px; height: 40px; }
}

@media (min-width: 1025px) {
  .splash-bolt { width: 100px; height: 100px; font-size: 80px; }
  .splash-text { font-size: 26px; }
  .splash-spinner { width: 48px; height: 48px; }
}
```

### 5.4 JavaScript Hook

```javascript
// In app.js, after pulseInitialized is set to true (line 5665)
function dismissSplash() {
  const splash = document.getElementById('splashOverlay');
  if (!splash) return;
  splash.classList.add('splash-dismissing');
  setTimeout(() => {
    splash.style.display = 'none';
  }, 400);
}

// Call at the appropriate moment in boot
// Example: pulseInitialized = true; dismissSplash();
```

### 5.5 Dark/Light Mode Support

Splash should read Pulse theme preference from localStorage:

```javascript
// In inline <style>, use CSS custom properties (fallback if not available)
// Or use JavaScript to apply theme colors immediately

<script>
  (function() {
    // Read Pulse theme preference
    const scheme = localStorage.getItem('mlb_pulse_scheme') || 'light';
    const splash = document.getElementById('splashOverlay');
    if (!splash) return;
    
    if (scheme === 'dark') {
      splash.style.background = 'rgba(17, 24, 39, 0.95)';
      splash.style.color = '#e8eaf0';
    } else {
      splash.style.background = 'rgba(248, 249, 250, 0.95)';
      splash.style.color = '#1f2937';
    }
  })();
</script>
```

---

## 6. Accessibility

- **ARIA:** `role="status" aria-label="Loading application"` (optional, for screen readers)
- **Contrast:** WCAG AA compliant (white text on dark bg, or dark text on light bg)
- **Motion:** Respects `prefers-reduced-motion` media query (slow spinner, no scale animation)
- **Keyboard:** No keyboard interaction needed (overlay is not interactive)

```css
@media (prefers-reduced-motion: reduce) {
  .splash-spinner {
    animation: none;
    opacity: 0.6;
  }
}
```

---

## 7. Browser & Platform Support

**Target:**
- iOS Safari 14+ (PWA)
- Android Chrome 90+ (PWA)
- Safari desktop 14+
- Chrome desktop (dev/test)
- Firefox desktop (dev/test)

**Fallbacks:**
- If inline CSS/JS fails, app still loads (graceful degrade)
- Splash overlay degrades to white/blank screen (current UX)
- No critical failures

---

## 8. Success Metrics

- [ ] Overlay appears within 100ms of page load (before or immediately after OS splash)
- [ ] Spinner animates smoothly (no jank, 60fps)
- [ ] Dismisses cleanly without flashing
- [ ] Theme preference is respected (light/dark mode matches user setting)
- [ ] Works on iOS 14+, Android 10+
- [ ] Accessibility passes WCAG AA
- [ ] No performance impact on app boot time

---

## 9. Design Deliverables

**Designer should provide:**

1. **Mockups** (Figma/Sketch)
   - Mobile (375px): Light & Dark modes
   - Tablet (768px): Light & Dark modes
   - Desktop (1200px): Light & Dark modes

2. **Animation Spec**
   - Spinner: rotation speed, easing, color
   - Fade-out: duration, easing curve
   - Optional: scale/transform effects

3. **Assets**
   - Bolt icon: SVG (if custom design needed)
   - Color values: RGB/Hex for inline CSS
   - Font specs: weight, size, line-height

4. **CSS / SVG Code** (ready to paste)
   - Inline `<style>` block for `<head>`
   - Spinner as inline SVG or CSS animation
   - No external dependencies (must load instantly)

---

## 10. Design Notes & Considerations

### Brand Consistency
- Bolt should match the ⚡ logo used in header and Pulse sections
- Colors should inherit from current Pulse theme (not team theme)
- Typography: use existing app font or system sans-serif

### Performance
- No web fonts (use emoji ⚡ or inline SVG)
- No external images (inline everything)
- CSS animations only (no JavaScript animation libraries)

### Simplicity
- Minimal visual elements (bolt + text + spinner)
- No unnecessary gradients, shadows, or effects
- Focus on clarity and legibility

### Mobile-First
- Design for phone first (375px)
- Scale up to tablet and desktop
- Safe area insets on notched devices (iPhone X+)

### Theme Consistency
- If user has set a dark/light mode preference, apply it immediately
- Don't hardcode colors; use CSS vars if possible (--p-dark, --p-text, etc.)
- Fallback to safe defaults if theme not found

---

## 11. Optional Enhancements (Future)

- **Team color accent** — if team is loaded, tint spinner to active team primary (deferred if adds complexity)
- **Custom Lottie animation** — more polished spinner (requires dependency, evaluate trade-off)
- **Perceived performance** — show version/loading stage text ("Loading data...", "Starting Pulse...") to make wait feel intentional
- **Haptic feedback** — dismiss with subtle haptic on iOS/Android (nice-to-have)

---

## 12. Approval & Next Steps

**For Review:**
1. Designer creates mockups in Figma (3 breakpoints × 2 themes = 6 artboards)
2. Design system specs: sizes, colors, animation timings
3. CSS/SVG code drafted and reviewed for performance
4. Accessibility audit (WCAG AA)

**Implementation:**
1. Inline CSS + HTML added to `index.html` `<head>`
2. Dismissal function added to `app.js` boot sequence
3. Testing on iOS/Android PWA, desktop browsers
4. Version bump: v3.34.3

---

**Design Brief Prepared By:** Claude  
**Date:** 2026-05-04  
**For:** MLB Pulse v3.34.2+
