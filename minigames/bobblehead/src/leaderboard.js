const KEY = 'bobblehead_leaderboard_v1';
const MAX = 5;

export function loadLeaderboard() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordScore(score) {
  const entries = loadLeaderboard();
  entries.push({ score, date: new Date().toISOString() });
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {}
  return top;
}

export function renderLeaderboard(el, entries) {
  el.innerHTML = '';
  if (!entries.length) {
    const li = document.createElement('li');
    li.textContent = 'No scores yet';
    el.appendChild(li);
    return;
  }
  entries.forEach((e, i) => {
    const li = document.createElement('li');
    const rank = document.createElement('span');
    rank.textContent = `#${i + 1}`;
    const score = document.createElement('span');
    score.textContent = e.score;
    li.appendChild(rank);
    li.appendChild(score);
    el.appendChild(li);
  });
}
