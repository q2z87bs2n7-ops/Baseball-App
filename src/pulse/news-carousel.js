import { state } from '../state.js';
import { API_BASE } from '../config/constants.js';
import { fmtNewsDate } from '../utils/format.js';
import { isSafeNewsImage } from '../utils/news.js';

// Original two-tier news fetch: try MLB.com RSS via proxy first, fall back to
// ESPN's public news API. Same pattern as the legacy fetchMLBNewsFeed() that
// powered the Pulse carousel before the v3.42 multi-source aggregator detour.
export async function loadPulseNews() {
  try {
    const r=await fetch(API_BASE+'/api/proxy-rss?feed=mlb');
    if(!r.ok) throw new Error('Status '+r.status);
    const d=await r.json();
    if(!d.success||!Array.isArray(d.articles)||!d.articles.length) throw new Error('Empty MLB feed');
    state.pulseNewsArticles=d.articles.slice(0,10);
    state.pulseNewsIndex=0;
    renderPulseNewsCard();
    return;
  } catch(e) { /* fall through to ESPN */ }
  try {
    const r2=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20');
    if(!r2.ok) throw new Error('Status '+r2.status);
    const d2=await r2.json();
    const arts=(d2.articles||[]).filter(function(a){return a.headline;}).slice(0,10).map(function(a){
      return {
        title:a.headline,
        link:(a.links&&a.links.web&&a.links.web.href)||'',
        image:(a.images&&a.images[0]&&a.images[0].url)||'',
        pubDate:a.published||''
      };
    });
    state.pulseNewsArticles=arts;
    state.pulseNewsIndex=0;
    renderPulseNewsCard();
  } catch(e2) {
    state.pulseNewsArticles=[];
    showNewsUnavailable();
  }
}

function renderPulseNewsCard() {
  const container=document.getElementById('newsCard');
  if(!container) return;
  if(!state.pulseNewsArticles.length) {
    showNewsUnavailable();
    return;
  }
  const article=state.pulseNewsArticles[state.pulseNewsIndex];
  let img='';
  if(article.image&&isSafeNewsImage(article.image)) {
    const imgUrl=forceHttps(article.image);
    img='<img src="'+imgUrl+'" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block" onerror="this.style.display=\'none\'">';
  }
  const headline=article.headline||article.title||'News';
  const pubDate=article.pubDate||article.published||article.publishedAt||'';
  const html='<div style="padding:12px;display:flex;flex-direction:column;gap:8px">'
    +img
    +'<div style="font-size:.8rem;font-weight:600;color:var(--text);line-height:1.35">'+headline+'</div>'
    +(pubDate?'<div style="font-size:.65rem;color:var(--muted)">'+fmtNewsDate(pubDate)+'</div>':'')
    +'</div>';
  container.innerHTML=html;
}

function forceHttps(url) {
  return url?url.replace(/^http:/,'https:'):url;
}

export function nextNewsCard() {
  if(!state.pulseNewsArticles.length) return;
  state.pulseNewsIndex=(state.pulseNewsIndex+1)%state.pulseNewsArticles.length;
  renderPulseNewsCard();
}

export function prevNewsCard() {
  if(!state.pulseNewsArticles.length) return;
  state.pulseNewsIndex=(state.pulseNewsIndex-1+state.pulseNewsArticles.length)%state.pulseNewsArticles.length;
  renderPulseNewsCard();
}

function showNewsUnavailable() {
  const container=document.getElementById('newsCard');
  if(container) {
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
  }
}
