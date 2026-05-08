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

export function updateHeaderCrumb(sectionId) {
  const el = document.getElementById('headerCrumb');
  if (!el) return;
  el.textContent = SECTION_LABELS[sectionId] || sectionId.toUpperCase();
}

export function installMoreSheetEscClose() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMoreSheet();
  });
}
