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
import { isSafeNewsImage, escapeNewsHtml, forceHttps, decodeNewsHtml } from '../utils/news.js';

function mkEspnRow(a){var pub=a.published?new Date(a.published).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'';var link=(a.links&&a.links.web&&a.links.web.href)?a.links.web.href:'#';var headline=escapeNewsHtml(decodeNewsHtml(a.headline||''));return '<div class="news-item"><div class="news-dot"></div><div class="news-body"><div class="news-title"><a href="'+link+'" target="_blank">'+headline+'</a></div><div class="news-meta">'+pub+(a.byline?' · '+a.byline:'')+'</div></div></div>';}

function mkProxyNewsRow(item){
  var icon=window.NEWS_SOURCE_ICONS?window.NEWS_SOURCE_ICONS[item.source]||'📰':'📰';
  var sourceClass=item.source?' news-thumb--'+item.source:'';
  var thumb=isSafeNewsImage(item.image)
    ? '<div class="news-thumb'+sourceClass+'"><img src="'+escapeNewsHtml(forceHttps(item.image))+'" alt="" onerror="this.parentNode.innerHTML=\'<span class=&quot;news-thumb-placeholder&quot;>'+icon+'</span>\'"></div>'
    : '<div class="news-thumb'+sourceClass+'"><span class="news-thumb-placeholder">'+icon+'</span></div>';
  var NEWS_SOURCE_LABELS=window.NEWS_SOURCE_LABELS||{};
  var src=NEWS_SOURCE_LABELS[item.source]||item.source||'';
  var kicker=src?'<div class="news-source-kicker">VIA '+escapeNewsHtml(src)+'</div>':'';
  var date=fmtNewsDate(item.pubDate);
  var link=item.link||'#';
  var title=escapeNewsHtml(decodeNewsHtml(item.title||''));
  return '<div class="news-item">'+thumb+'<div class="news-body">'+kicker+'<div class="news-title"><a href="'+escapeNewsHtml(link)+'" target="_blank" rel="noopener">'+title+'</a></div>'+(date?'<div class="news-meta">'+date+'</div>':'')+'</div></div>';
}

function renderNewsList(){
  var el=document.getElementById('newsFull');if(!el)return;
  var items=state.newsSourceFilter==='all'?state.newsArticlesCache:state.newsArticlesCache.filter(function(a){return a.source===state.newsSourceFilter;});
  if(!items.length){el.innerHTML='<div class="loading">No articles for this source.</div>';return;}
  el.innerHTML=items.map(mkProxyNewsRow).join('');
}

export function selectNewsSource(key,btn){
  state.newsSourceFilter=key;
  var pills=document.querySelectorAll('#newsSourcePills .stat-tab');
  pills.forEach(function(p){p.classList.remove('active');});
  if(btn)btn.classList.add('active');
  else{var match=document.querySelector('#newsSourcePills .stat-tab[data-source="'+key+'"]');if(match)match.classList.add('active');}
  renderNewsList();
}

export async function loadNews(){
  var fullEl=document.getElementById('newsFull'),homeEl=document.getElementById('homeNews');
  var teamLensBtn=document.getElementById('newsTeamBtn'),teamLensKnob=document.getElementById('newsTeamLensKnob');if(teamLensBtn){teamLensBtn.classList.toggle('on',state.newsFeedMode==='team');if(teamLensKnob)teamLensKnob.style.left=state.newsFeedMode==='team'?'21px':'2px';}
  if(fullEl)fullEl.innerHTML='<div class="loading">Loading news...</div>';if(homeEl)homeEl.innerHTML='<div class="loading">Loading news...</div>';
  var teamUrl='https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?team='+state.activeTeam.espnId+'&limit=20';
  if(state.newsFeedMode==='team'){
    try{
      var resp=await fetch(teamUrl);
      var d=await resp.json();
      var arts=(d.articles||[]).filter(function(a){return a.headline;});
      if(!arts.length)throw new Error('No articles');
      if(fullEl)fullEl.innerHTML=arts.map(mkEspnRow).join('');
      if(homeEl)homeEl.innerHTML=arts.slice(0,5).map(mkEspnRow).join('');
    }catch(e){var msg='<div class="error">News unavailable (ESPN API may be blocked by browser).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
    return;
  }
  try{
    var responses=await Promise.all([fetch(API_BASE+'/api/proxy-news'),fetch(teamUrl)]);
    var d=await responses[0].json();
    state.newsArticlesCache=Array.isArray(d.articles)?d.articles:[];
    if(!state.newsArticlesCache.length)throw new Error('No articles');
    renderNewsList();
    if(homeEl){var hD=await responses[1].json();var hArts=(hD.articles||[]).filter(function(a){return a.headline;});homeEl.innerHTML=hArts.slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
  }catch(e){
    try{
      var fb=await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?limit=20');
      var fbD=await fb.json();var fbArts=(fbD.articles||[]).filter(function(a){return a.headline;});
      if(fullEl)fullEl.innerHTML=fbArts.map(mkEspnRow).join('');
      if(homeEl){var hResp=await fetch(teamUrl);var hJ=await hResp.json();homeEl.innerHTML=(hJ.articles||[]).filter(function(a){return a.headline;}).slice(0,5).map(mkEspnRow).join('')||'<div class="loading">No news available</div>';}
    }catch(e2){var msg='<div class="error">News unavailable (proxy and ESPN both failed).</div>';if(fullEl)fullEl.innerHTML=msg;if(homeEl)homeEl.innerHTML=msg;}
  }
}

export function switchNewsFeed(mode){
  state.newsFeedMode=mode;
  var lensBtn=document.getElementById('newsTeamBtn'),lensKnob=document.getElementById('newsTeamLensKnob');
  if(lensBtn){lensBtn.classList.toggle('on',mode==='team');if(lensKnob)lensKnob.style.left=mode==='team'?'21px':'2px';}
  var pills=document.getElementById('newsSourcePills');if(pills)pills.style.display=(mode==='mlb')?'flex':'none';
  loadNews();
}

export function toggleNewsTeamLens(){switchNewsFeed(state.newsFeedMode==='team'?'mlb':'team');}

// mkEspnRow is also used by the League view's news pane — exported for that.
export { mkEspnRow };
