import { state } from '../state.js';
import { API_BASE } from '../config/constants.js';
import { fmtNewsDate } from '../utils/format.js';
import { isSafeNewsImage } from '../utils/news.js';

export async function loadPulseNews() {
  try {
    var r=await fetch(API_BASE+'/api/proxy-news');
    if(!r.ok) throw new Error('Status '+r.status);
    var d=await r.json();
    state.pulseNewsArticles=Array.isArray(d.articles)?(d.articles.slice(0,10)):[];
    state.pulseNewsIndex=0;
    renderPulseNewsCard();
  } catch(e) {
    state.pulseNewsArticles=[];
    showNewsUnavailable();
  }
}

function renderPulseNewsCard() {
  var container=document.getElementById('newsCard');
  if(!container) return;
  if(!state.pulseNewsArticles.length) {
    showNewsUnavailable();
    return;
  }
  var article=state.pulseNewsArticles[state.pulseNewsIndex];
  var img='';
  if(article.image&&isSafeNewsImage(article.image)) {
    var imgUrl=forceHttps(article.image);
    img='<img src="'+imgUrl+'" style="width:100%;height:160px;object-fit:cover;border-radius:6px;margin-bottom:8px;display:block" onerror="this.style.display=\'none\'">';
  }
  var html='<div style="padding:12px;display:flex;flex-direction:column;gap:8px">'
    +img
    +'<div style="font-size:.8rem;font-weight:600;color:var(--text);line-height:1.35">'+article.headline+'</div>'
    +'<div style="font-size:.65rem;color:var(--muted)">'+fmtNewsDate(article.pubDate)+'</div>'
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
  var container=document.getElementById('newsCard');
  if(container) {
    container.innerHTML='<div style="color:var(--muted);font-size:.75rem;padding:20px;text-align:center;">News feed unavailable</div>';
  }
}
