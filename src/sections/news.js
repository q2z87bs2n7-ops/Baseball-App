// News section — full feed (#newsFull) + Home page widget (#homeNews).
// Two modes: 'team' (ESPN team news only) and 'mlb' (Vercel proxy aggregator
// across MLB.com/ESPN/MLBTR/FanGraphs/CBS, with source-filter pills).
//
// KNOWN ISSUE: mkProxyNewsRow reads window.NEWS_SOURCE_ICONS / .LABELS but
// main.js imports those constants without exposing them on window — so the
// fallbacks ('📰', '') are always used. Pre-existing; fix is a follow-up
// (replace window.* with direct imports from config/constants.js).

import { state } from '../state.js';
import { API_BASE } from '../config/constants.js';
import { fmtNewsDate } from '../utils/format.js';
import { isSafeNewsImage, escapeNewsHtml, forceHttps, decodeNewsHtml, isBettingPromo } from '../utils/news.js';

function mkEspnRow(a){const pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';const link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';const headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));return '<div class="news-item"><div class="news-dot"></div><div class="news-body"><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';}

function mkProxyNewsRow(item){
  const icon=window.NEWS_SOURCE_ICONS?window.NEWS_SOURCE_ICONS[item.source]||'📰':'📰';
  const sourceClass=item.source?' news-thumb--'+item.source:'';
  const thumb=isSafeNewsImage(item.image)
    ? '<div class="news-thumb'+sourceClass+'"><img src="'+escapeNewsHtml(forceHttps(item.image))+'" alt="" onerror="this.parentNode.innerHTML=\'<span class=&quot;news-thumb-placeholder&quot;>'+icon+'</span>\'"></div>'
    : '<div class="news-thumb'+sourceClass+'"><span class="news-thumb-placeholder">'+icon+'</span></div>';
  const NEWS_SOURCE_LABELS=window.NEWS_SOURCE_LABELS||{};
  const src=NEWS_SOURCE_LABELS[item.source]||item.source||'';
  const kicker=src?'<div class="news-source-kicker">VIA '+escapeNewsHtml(src)+'</div>':'';
  const date=fmtNewsDate(item.pubDate);
  const link=item.link||'#';
  const title=escapeNewsHtml(decodeNewsHtml(item.title||''));
  return '<div class="news-item">'+thumb+'<div class="news-body">'+kicker+'<div class="news-title"><a href="'+escapeNewsHtml(link)+'" target="_blank" rel="noopener">'+title+'</a></div>'+(date?'<div class="news-meta">'+date+'</div>':'')+'</div></div>';
}

function renderNewsList(){
  const el=document.getElementById('newsFull');if(!el)return;
  let items=state.newsSourceFilter==='all'?state.newsArticlesCache:state.newsArticlesCache.filter(function(a){return a.source===state.newsSourceFilter;});
  items=items.filter(function(a){return !isBettingPromo(a);});
  if(!items.length){el.innerHTML='<div class="loading">No articles for this source.</div>';return;}
  el.innerHTML=items.map(mkProxyNewsRow).join('');
}

export function selectNewsSource(key,btn){
  state.newsSourceFilter=key;
  const pills=document.querySelectorAll('#newsSourcePills .stat-tab');
  pills.forEach(function(p){p.classList.remove('active');});
  if(btn)btn.classList.add('active');
  else{const match=document.querySelector('#newsSourcePills .stat-tab[data-source="'+key+'"]');if(match)match.classList.add('active');}
  renderNewsList();
}

export async function loadNews(){
  const fullEl=document.getElementById('newsFull'),homeEl=document.getElementById('homeNews');
  const teamLensBtn=document.getElementById('newsTeamBtn'),teamLensKnob=document.getElementById('newsTeamLensKnob');if(teamLensBtn){teamLensBtn.classList.toggle('on',state.newsFeedMode==='team');if(teamLensKnob)teamLensKnob.style.left=state.newsFeedMode==='team'?'21px':'2px';}
  if(fullEl)fullEl.innerHTML='<div class="loading">Loading news...</div>';if(homeEl)homeEl.innerHTML='<div class="loading">Loading news...</div>';
  const teamUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team='+state.activeTeam.espnId+'&limit=20';
  if(state.newsFeedMode==='team'){
    try{
      const resp=await fetch(teamUrl);
      if(!resp.ok) throw new Error(resp.status);
      const d=await resp.json();
      const arts=(d.articles||[]).filter(function(a){return a.headline;});
      if(!arts.length)throw new Error('No articles');
      if(fullEl)fullEl.innerHTML=arts.map(mkEspnRow).join('');
      if(homeEl)homeEl.innerHTML=arts.slice(0,5).map(mkEspnRow).join('');
    }catch(e){const msg='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
    return;
  }
  try{
    const responses=await Promise.all([fetch(API_BASE+'/api/proxy-news'),fetch(teamUrl)]);
    if(!responses[0].ok) throw new Error(responses[0].status);
    const d=await responses[0].json();
    state.newsArticlesCache=Array.isArray(d.articles)?d.articles:[];
    if(!state.newsArticlesCache.length)throw new Error('No articles');
    renderNewsList();
    if(homeEl&&responses[1].ok){const hD=await responses[1].json();const hArts=(hD.articles||[]).filter(function(a){return a.headline;});homeEl.innerHTML=hArts.slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
  }catch(e){
    try{
      const fb=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20');
      if(!fb.ok) throw new Error(fb.status);
      const fbD=await fb.json();const fbArts=(fbD.articles||[]).filter(function(a){return a.headline;});
      if(fullEl)fullEl.innerHTML=fbArts.map(mkEspnRow).join('');
      if(homeEl){const hResp=await fetch(teamUrl);if(!hResp.ok) throw new Error(hResp.status);const hJ=await hResp.json();homeEl.innerHTML=(hJ.articles||[]).filter(function(a){return a.headline;}).slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
    }catch(e2){const msg='<div class="error">News unavailable (proxy and ESPN both failed).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
  }
}

export function switchNewsFeed(mode){
  state.newsFeedMode=mode;
  const lensBtn=document.getElementById('newsTeamBtn'),lensKnob=document.getElementById('newsTeamLensKnob');
  if(lensBtn){lensBtn.classList.toggle('on',mode==='team');if(lensKnob)lensKnob.style.left=mode==='team'?'21px':'2px';}
  const pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}

export function toggleNewsTeamLens(){switchNewsFeed(state.newsFeedMode==='team'?'mlb':'team');}

// mkEspnRow is also used by the League view's news pane — exported for that.
export { mkEspnRow };
