# MLB Pulse PWA Splash Screen — Design Brief

## 1. Overview

**Project:** MLB Pulse — Live MLB Tracker PWA  
**Component:** Loading Splash Screen / Boot Overlay  
**Current Version:** v3.34.2  

---

## 2. Business Case

### Current Experience
- OS splash screen appears (200–500ms)
- Blank/white screen while HTML parses and JavaScript loads (500ms–2s)
- Content renders with loading placeholders
- App becomes interactive (1–3s total)

### Problem
Users see an empty screen with no indication that the app is loading or responding. This creates uncertainty about whether the app is working or has crashed.

### Goal
Provide visual feedback during the boot sequence that the app is starting up, the brand is present, and the app is responsive.

---

## 3. Technical Requirements

### 3.1 Timing

The splash overlay must:
- Appear within 100ms of page load
- Display until one of these conditions is met (whichever comes first):
  - `pulseInitialized = true` (preferred trigger)
  - Home content loads (fallback trigger)
  - 5-second hard timeout (safety net)
- Dismiss with a transition (300–500ms fade)

### 3.2 HTML & CSS Structure

The overlay must be defined inline in the `<head>` before `styles.css` loads:

```html
<!-- In index.html <head>, before <link rel="stylesheet"> -->
<style>
  /* All splash screen styles here */
  /* Must not depend on styles.css */
</style>

<!-- In index.html <body>, as first child before <header> -->
<div id="splashOverlay">
  <!-- Splash content here -->
</div>
```

**Constraint:** No external files, web fonts, or dependencies. Everything must load instantly with the HTML.

### 3.3 Dismissal Control

The splash must be dismissable via JavaScript:

```javascript
function dismissSplash() {
  const splash = document.getElementById('splashOverlay');
  if (!splash) return;
  splash.classList.add('splash-dismissing'); // triggers CSS animation
  setTimeout(() => {
    splash.style.display = 'none'; // removes from layout
  }, 500); // duration in ms to match CSS transition
}
```

**Call site:** In `app.js`, after boot completes. Example:
```javascript
// Around line 5665
pulseInitialized = true;
dismissSplash(); // new call
initLeaguePulse();
```

### 3.4 Z-Index

The overlay must have `z-index: 10000` or higher to sit above all app content during load.

### 3.5 Interactivity

The overlay must not be interactive:
- `pointer-events: none` to allow clicking through (should not happen, but safe)
- No buttons, links, or touch targets
- User cannot dismiss manually

### 3.6 Responsive Requirements

The overlay must scale appropriately across:
- **Mobile:** ≤480px
- **iPad/Tablet:** 481–1024px

No specific design mandated; designer determines appropriate sizes and spacing per breakpoint.

### 3.7 Theme Support

The overlay should respond to the Pulse theme preference (light/dark mode):
- Read `localStorage.getItem('mlb_pulse_scheme')` if available
- Light mode: light background, dark text
- Dark mode: dark background, light text
- Fallback: use safe defaults if localStorage is empty

**Implementation approach:** Designer and dev team to decide (inline JS in `<head>`, or CSS custom properties).

### 3.8 No Dependencies

- No external CSS files
- No web fonts (system fonts or emoji only)
- No image files
- No JavaScript libraries
- SVG or CSS animations only
- Must load in <50ms with the HTML

---

## 4. Accessibility Requirements

- **WCAG AA contrast compliance** — ensure text and visual elements meet minimum contrast ratios
- **Motion respect** — support `prefers-reduced-motion` media query (slow or remove animations for users who request it)
- **No keyboard interaction** — overlay is non-interactive, no focus management needed
- **Screen reader friendly** — optional ARIA labels if needed (non-critical)

---

## 5. Platform Support

Must work on:
- iOS Safari 14+ (PWA installed to home screen)
- Android Chrome 90+ (PWA installed to home screen)

**Graceful degradation:** If the splash fails to render, the app still loads normally (no critical failures).

---

## 6. Performance Constraints

- Overlay CSS must be inline in `<head>` (no file I/O)
- HTML element must render immediately (no layout shift)
- Animations must be CSS-based (no JavaScript animation loops)
- Must not block app bootstrap or event handling
- Target: <1ms overhead to initial page load

---

## 7. Success Metrics

- [ ] Overlay appears within 100ms of page load
- [ ] Animations run at 60fps (no jank, no frame drops)
- [ ] Dismissal is smooth and immediate
- [ ] Theme preference is respected
- [ ] Works on iOS Safari 14+, Android Chrome 90+
- [ ] Responsive on mobile (≤480px) and iPad (481–1024px)
- [ ] WCAG AA accessibility compliance verified
- [ ] No performance regression on app boot time

---

## 8. Design Deliverables Required

Designer should provide:

1. **Visual Design**
   - Mockups for mobile (≤480px) and iPad (481–1024px), portrait and landscape
   - Light and dark mode variants
   - Asset files (SVG, if applicable)

2. **Animation Specification**
   - Transition timing (fade-in/out duration, easing)
   - Any animated elements (description, timing, colors)

3. **CSS & HTML Code**
   - Inline `<style>` block ready to paste into `<head>`
   - HTML element structure for `<body>`
   - Color values and sizing specifications
   - Responsive breakpoint rules

4. **Color & Typography Specs**
   - Hex/RGB values for all colors
   - Font sizes and weights per breakpoint
   - Any spacing/padding values

---

## 9. Implementation Notes

### For Designer
- Design for the splash in isolation (doesn't interact with app)
- Consider both breakpoints (mobile ≤480px, iPad 481–1024px) and both theme modes (light/dark)
- Test in portrait and landscape orientations
- Ensure all assets are provided as inline SVG or CSS
- Provide hex/RGB colors (not color names)

### For Developer
- Add dismissal function to `app.js`
- Call `dismissSplash()` after boot completes
- Verify dismissal timing with designer
- Test on actual iOS/Android PWAs
- Update version: v3.34.3

### For QA
- Test on iPhone 12+ (notch), iPhone SE (no notch), iPad Air/Pro (landscape + portrait)
- Test on Android 10+, 12, 13, 14+
- Test dark mode vs light mode toggling
- Verify no layout shift when splash dismisses
- Verify animations are smooth (no frame drops)

---

## 10. Timeline

- **Design phase:** Mockups + specs (no timeline specified)
- **Development:** Integrate CSS/HTML into codebase (2–4 hours)
- **Testing:** iOS/Android PWA testing (1–2 hours)
- **Release:** Version 3.34.3

---

**Brief Created:** 2026-05-04  
**For:** MLB Pulse v3.34.2+  
**Status:** Ready for Designer
