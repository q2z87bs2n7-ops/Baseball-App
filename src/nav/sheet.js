// Bottom-sheet for the mobile nav "More" overflow.
// Hosts News / Standings / Stats which are hidden from the 5-tab mobile bar.

const SECTION_LABELS = {
  pulse: 'PULSE',
  home: 'MY TEAM',
  schedule: 'SCHEDULE',
  league: 'LEAGUE',
  news: 'NEWS',
  standings: 'STANDINGS',
  stats: 'STATS'
};

export function openMoreSheet() {
  const sheet = document.getElementById('moreSheet');
  const back = document.getElementById('moreSheetBackdrop');
  if (!sheet || !back) return;
  sheet.classList.add('open');
  back.classList.add('open');
}

export function closeMoreSheet() {
  const sheet = document.getElementById('moreSheet');
  const back = document.getElementById('moreSheetBackdrop');
  if (!sheet || !back) return;
  sheet.classList.remove('open');
  back.classList.remove('open');
}

export function toggleMoreSheet() {
  const sheet = document.getElementById('moreSheet');
  if (!sheet) return;
  if (sheet.classList.contains('open')) closeMoreSheet();
  else openMoreSheet();
}

export function openPulseOverflow() {
  const sheet = document.getElementById('pulseOverflowSheet');
  const back = document.getElementById('pulseOverflowBackdrop');
  if (!sheet || !back) return;
  sheet.classList.add('open');
  back.classList.add('open');
}

export function closePulseOverflow() {
  const sheet = document.getElementById('pulseOverflowSheet');
  const back = document.getElementById('pulseOverflowBackdrop');
  if (!sheet || !back) return;
  sheet.classList.remove('open');
  back.classList.remove('open');
}

export function togglePulseOverflow() {
  const sheet = document.getElementById('pulseOverflowSheet');
  if (!sheet) return;
  if (sheet.classList.contains('open')) closePulseOverflow();
  else openPulseOverflow();
}

export function openPulseShortcuts() {
  const sheet = document.getElementById('pulseShortcuts');
  const back = document.getElementById('pulseShortcutsBackdrop');
  if (!sheet || !back) return;
  sheet.classList.add('open');
  back.classList.add('open');
}

export function closePulseShortcuts() {
  const sheet = document.getElementById('pulseShortcuts');
  const back = document.getElementById('pulseShortcutsBackdrop');
  if (!sheet || !back) return;
  sheet.classList.remove('open');
  back.classList.remove('open');
}

export function updateHeaderCrumb(sectionId) {
  const el = document.getElementById('headerCrumb');
  if (!el) return;
  el.textContent = SECTION_LABELS[sectionId] || sectionId.toUpperCase();
}

export function installMoreSheetEscClose() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeMoreSheet();
    closePulseOverflow();
    closePulseShortcuts();
  });
}
