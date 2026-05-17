import { state } from '../state.js';
import { TEAMS, MLB_THEME } from '../config/constants.js';
import { devTrace } from '../devtools-feed/devLog.js';

let themeCallbacks = { loadTodayGame: null, loadNextGame: null, loadNews: null, loadStandings: null, loadRoster: null, loadTeamStats: null, loadHomeInjuries: null, loadHomeMoves: null, loadHomeYoutubeWidget: null, loadHomePodcastWidget: null, applyMyTeamLens: null, clearHomeLiveTimer: null };
function setThemeCallbacks(callbacks) {
  Object.assign(themeCallbacks, callbacks);
}

function relLuminance(hex){hex=hex.replace('#','');let n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255;r=r<=0.03928?r/12.92:Math.pow((r+0.055)/1.055,2.4);g=g<=0.03928?g/12.92:Math.pow((g+0.055)/1.055,2.4);b=b<=0.03928?b/12.92:Math.pow((b+0.055)/1.055,2.4);return 0.2126*r+0.7152*g+0.0722*b;}
function contrastRatio(hexA,hexB){const lA=relLuminance(hexA),lB=relLuminance(hexB);return(Math.max(lA,lB)+0.05)/(Math.min(lA,lB)+0.05);}
function hslHex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l),f=function(n){const k=(n+h/30)%12,c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};return'#'+f(0)+f(8)+f(4);}
function hslLighten(hex,targetL){hex=hex.replace('#','');let n=parseInt(hex,16),r=((n>>16)&255)/255,g=((n>>8)&255)/255,b=(n&255)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),h=0,s=0,l=(max+min)/2;if(max!==min){const d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return hslHex(Math.round(h*360),Math.round(s*100),Math.round(targetL*100));}
function pickAccent(secondaryHex,cardHex){const sLum=relLuminance(secondaryHex),cCon=contrastRatio(secondaryHex,cardHex);if(sLum>=0.18&&cCon>=3.0)return secondaryHex;const lifted=hslLighten(secondaryHex,0.65);if(contrastRatio(lifted,cardHex)>=3.0)return lifted;return'#FFB273';}
function pickHeaderText(primaryHex){return relLuminance(primaryHex)>0.5?'#0a0f1e':'#ffffff';}

function applyTeamTheme(team){
  if(team) devTrace('theme','applyTeamTheme · '+team.name+' (id:'+team.id+')'+(state.devColorLocked?' [locked]':''));
  if(state.devColorLocked&&state.devColorOverrides.app.primary){
    document.documentElement.style.setProperty('--dark',state.devColorOverrides.app.dark);
    document.documentElement.style.setProperty('--card',state.devColorOverrides.app.card);
    document.documentElement.style.setProperty('--card2',state.devColorOverrides.app.card2);
    document.documentElement.style.setProperty('--border',state.devColorOverrides.app.border);
    document.documentElement.style.setProperty('--primary',state.devColorOverrides.app.primary);
    document.documentElement.style.setProperty('--secondary',state.devColorOverrides.app.secondary);
    document.documentElement.style.setProperty('--accent',state.devColorOverrides.app.accent);
    document.documentElement.style.setProperty('--accent-text',state.devColorOverrides.app.accentText);
    document.documentElement.style.setProperty('--header-text',state.devColorOverrides.app.headerText);
    return;
  }
  const hdr=document.querySelector('header');
  if(hdr){['--primary','--secondary','--accent','--accent-text','--header-text'].forEach(function(v){hdr.style.removeProperty(v);});}
  const ct=state.themeOverride||team;
  const cp=state.themeInvert?ct.secondary:ct.primary,cs=state.themeInvert?ct.primary:ct.secondary;
  let l1=relLuminance(cp),l2=relLuminance(cs),ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05),accent=ratio>=3?cs:'#ffffff',accentLum=relLuminance(accent);
  if(accentLum<0.05){accent='#ffffff';accentLum=1;}
  const accentText=accentLum>0.4?'#111827':'#ffffff';
  let hueOf=function(hex){hex=hex.replace('#','');let r=parseInt(hex.substr(0,2),16)/255,g=parseInt(hex.substr(2,2),16)/255,b=parseInt(hex.substr(4,2),16)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,h=0;if(d){if(max===r)h=((g-b)/d+(g<b?6:0))/6;else if(max===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return Math.round(h*360);};
  const h=hueOf(cp),cardHex=hslHex(h,45,22);
  const safeAccent=pickAccent(accent,cardHex),headerText=pickHeaderText(cp);
  if(state.themeScope==='nav'){
    const dp=MLB_THEME.primary,ds=MLB_THEME.secondary;
    const dl1=relLuminance(dp),dl2=relLuminance(ds),dr=(Math.max(dl1,dl2)+0.05)/(Math.min(dl1,dl2)+0.05);
    let dacc=dr>=3?ds:'#ffffff',daccLum=relLuminance(dacc);
    if(daccLum<0.05){dacc='#ffffff';daccLum=1;}
    const daccText=daccLum>0.4?'#111827':'#ffffff';
    const dh=hueOf(dp),dcard=hslHex(dh,45,22);
    const dSafeAcc=pickAccent(dacc,dcard),dHdrText=pickHeaderText(dp);
    document.documentElement.style.setProperty('--dark',hslHex(dh,50,18));
    document.documentElement.style.setProperty('--card',dcard);
    document.documentElement.style.setProperty('--card2',hslHex(dh,40,26));
    document.documentElement.style.setProperty('--border',hslHex(dh,35,30));
    document.documentElement.style.setProperty('--primary',dp);
    document.documentElement.style.setProperty('--secondary',dacc);
    document.documentElement.style.setProperty('--accent-text',daccText);
    document.documentElement.style.setProperty('--accent',dSafeAcc);
    document.documentElement.style.setProperty('--header-text',dHdrText);
    try{localStorage.setItem('mlb_theme_vars',JSON.stringify({'--dark':hslHex(dh,50,18),'--card':dcard,'--card2':hslHex(dh,40,26),'--border':hslHex(dh,35,30),'--primary':dp,'--secondary':dacc,'--accent-text':daccText,'--accent':dSafeAcc,'--header-text':dHdrText}));}catch(e){}
    if(hdr){
      hdr.style.setProperty('--primary',cp);
      hdr.style.setProperty('--secondary',accent);
      hdr.style.setProperty('--accent-text',accentText);
      hdr.style.setProperty('--accent',safeAccent);
      hdr.style.setProperty('--header-text',headerText);
    }
    document.querySelector('.logo').innerHTML='<img src="https://www.mlbstatic.com/team-logos/'+team.id+'.svg" style="height:32px;width:32px"> <span>'+team.short.toUpperCase()+'</span>';
    document.title=team.short+' Tracker';
    const tcmN=document.getElementById('themeColorMeta');if(tcmN)tcmN.setAttribute('content',cp);
    const chipN=document.getElementById('teamChip');if(chipN)chipN.textContent=team.name.toUpperCase();
    return;
  }
  document.documentElement.style.setProperty('--dark',hslHex(h,50,18));
  document.documentElement.style.setProperty('--card',cardHex);
  document.documentElement.style.setProperty('--card2',hslHex(h,40,26));
  document.documentElement.style.setProperty('--border',hslHex(h,35,30));
  document.documentElement.style.setProperty('--primary',cp);
  document.documentElement.style.setProperty('--secondary',accent);
  document.documentElement.style.setProperty('--accent-text',accentText);
  document.documentElement.style.setProperty('--accent',safeAccent);
  document.documentElement.style.setProperty('--header-text',headerText);
  try{localStorage.setItem('mlb_theme_vars',JSON.stringify({'--dark':hslHex(h,50,18),'--card':cardHex,'--card2':hslHex(h,40,26),'--border':hslHex(h,35,30),'--primary':cp,'--secondary':accent,'--accent-text':accentText,'--accent':safeAccent,'--header-text':headerText}));}catch(e){}
  document.querySelector('.logo').innerHTML='<img src="https://www.mlbstatic.com/team-logos/'+team.id+'.svg" style="height:32px;width:32px"> <span>'+team.short.toUpperCase()+'</span>';
  document.title=team.short+' Tracker';
  const tcm=document.getElementById('themeColorMeta');if(tcm)tcm.setAttribute('content',cp);
  const chip=document.getElementById('teamChip');if(chip)chip.textContent=team.name.toUpperCase();
}

const PULSE_SCHEME = {
  dark: {
    label:'Navy', emoji:'⚾',
    dark:'#0F1B2E', card:'#172B4D', card2:'#1E3A5F', border:'#2C4A7F',
    accent:'#cfd3dc', accentSoft:'rgba(255,255,255,0.08)', accentStrong:'#ffffff',
    text:'#e8eaf0', muted:'#9aa0a8',
    scoringBg:'rgba(60,190,100,0.10)', scoringBorder:'rgba(60,190,100,0.28)',
    hrBg:'rgba(160,100,255,0.10)', hrBorder:'rgba(160,100,255,0.40)',
    statusBg:'rgba(80,140,255,0.08)', statusBorder:'rgba(80,140,255,0.22)'
  },
  light: {
    label:'Light', emoji:'☀️',
    dark:'#F1F5F9', card:'#FFFFFF', card2:'#E8EDF3', border:'#CBD5E1',
    accent:'#2563EB', accentSoft:'rgba(37,99,235,0.08)', accentStrong:'#1E40AF',
    text:'#0F172A', muted:'#64748B',
    scoringBg:'rgba(22,163,74,0.07)', scoringBorder:'rgba(22,163,74,0.32)',
    hrBg:'rgba(109,40,217,0.07)', hrBorder:'rgba(109,40,217,0.28)',
    statusBg:'rgba(37,99,235,0.06)', statusBorder:'rgba(37,99,235,0.22)'
  }
};
let pulseColorScheme=(function(){try{return localStorage.getItem('mlb_pulse_scheme')||'dark';}catch(e){return'dark';}})();

function applyPulseMLBTheme(){
  if(state.devColorLocked&&state.devColorOverrides.pulse.primary){
    document.documentElement.style.setProperty('--dark',state.devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-dark',state.devColorOverrides.pulse.dark);
    document.documentElement.style.setProperty('--p-card',state.devColorOverrides.pulse.card);
    document.documentElement.style.setProperty('--p-card2',state.devColorOverrides.pulse.card2);
    document.documentElement.style.setProperty('--p-border',state.devColorOverrides.pulse.border);
    return;
  }
  const s=PULSE_SCHEME[pulseColorScheme]||PULSE_SCHEME.dark;
  document.documentElement.style.setProperty('--dark',s.dark);
  document.documentElement.style.setProperty('--p-dark',s.dark);
  document.documentElement.style.setProperty('--p-card',s.card);
  document.documentElement.style.setProperty('--p-card2',s.card2);
  document.documentElement.style.setProperty('--p-border',s.border);
  document.documentElement.style.setProperty('--p-accent',s.accent);
  document.documentElement.style.setProperty('--p-accent-soft',s.accentSoft);
  document.documentElement.style.setProperty('--p-accent-strong',s.accentStrong);
  document.documentElement.style.setProperty('--p-text',s.text);
  document.documentElement.style.setProperty('--p-muted',s.muted);
  document.documentElement.style.setProperty('--p-scoring-bg',s.scoringBg);
  document.documentElement.style.setProperty('--p-scoring-border',s.scoringBorder);
  document.documentElement.style.setProperty('--p-hr-bg',s.hrBg);
  document.documentElement.style.setProperty('--p-hr-border',s.hrBorder);
  document.documentElement.style.setProperty('--p-status-bg',s.statusBg);
  document.documentElement.style.setProperty('--p-status-border',s.statusBorder);
}

function setPulseColorScheme(scheme){
  pulseColorScheme=scheme;
  try{localStorage.setItem('mlb_pulse_scheme',scheme);}catch(e){}
  const ps=document.getElementById('pulse');
  if(ps&&ps.classList.contains('active'))applyPulseMLBTheme();
  updatePulseToggle();
}

function updatePulseToggle(){
  const isLight=pulseColorScheme==='light';
  const icon=document.getElementById('ptbSchemeIcon');
  if(icon) icon.textContent=isLight?'☀️':'🌙';
}

function togglePulseColorScheme(){
  setPulseColorScheme(pulseColorScheme==='dark'?'light':'dark');
}

function toggleSettings(){document.getElementById('settingsPanel').classList.toggle('open');}

function setupSettingsClickOutside(){
  document.addEventListener('click',function(e){
    const wrap=document.querySelector('.settings-wrap');
    if(wrap&&!wrap.contains(e.target)){const panel=document.getElementById('settingsPanel');if(panel)panel.classList.remove('open');}
    const tt=document.getElementById('calTooltip');if(tt&&tt.classList.contains('open')&&!e.target.closest('.cal-day'))tt.classList.remove('open');
  });
}

function buildThemeSelect(){
  const sel=document.getElementById('themeSelect');sel.innerHTML='<option value="-1">Default</option><option value="0">Follow Team</option>';let lastDiv='';
  TEAMS.forEach(function(t){
    if(t.division!==lastDiv){const og=document.createElement('optgroup');og.label=t.division;sel.appendChild(og);lastDiv=t.division;}
    const opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;sel.lastChild.appendChild(opt);
  });
}

function switchTheme(val){
  if(val==='0'){state.themeOverride=null;}
  else if(val==='-1'){state.themeOverride=MLB_THEME;}
  else{state.themeOverride=TEAMS.find(t=>t.id===parseInt(val));}
  localStorage.setItem('mlb_theme',val);
  applyTeamTheme(state.activeTeam);
}

function switchThemeScope(val){
  state.themeScope=val;
  try{localStorage.setItem('mlb_theme_scope',val);}catch(e){}
  applyTeamTheme(state.activeTeam);
}

function toggleInvert(){
  state.themeInvert=!state.themeInvert;
  localStorage.setItem('mlb_invert',state.themeInvert);
  const t=document.getElementById('invertToggle'),k=document.getElementById('invertToggleKnob');
  t.style.background=state.themeInvert?'var(--primary)':'var(--border)';
  k.style.left=state.themeInvert?'21px':'3px';
  t.setAttribute('aria-checked',state.themeInvert?'true':'false');
  applyTeamTheme(state.activeTeam);
  if(themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
  if(themeCallbacks.loadNextGame) themeCallbacks.loadNextGame();
}

function buildTeamSelect(){
  const sel=document.getElementById('teamSelect');sel.innerHTML='';let lastDiv='';
  TEAMS.forEach(function(t){
    if(t.division!==lastDiv){const og=document.createElement('optgroup');og.label=t.division;sel.appendChild(og);lastDiv=t.division;}
    const opt=document.createElement('option');opt.value=t.id;opt.textContent=t.name;if(t.id===state.activeTeam.id)opt.selected=true;sel.lastChild.appendChild(opt);
  });
}

function switchTeam(teamId){
  if(themeCallbacks.clearHomeLiveTimer) themeCallbacks.clearHomeLiveTimer();
  state.activeTeam=TEAMS.find(t=>t.id===parseInt(teamId));localStorage.setItem('mlb_team',teamId);applyTeamTheme(state.activeTeam);
  document.getElementById('settingsPanel').classList.remove('open');
  state.scheduleData=[];state.scheduleLoaded=false;state.rosterData={hitting:[],pitching:[],fielding:[]};state.statsCache={hitting:[],pitching:[]};state.selectedPlayer=null;
  document.getElementById('playerStats').innerHTML='<div style="color:var(--muted);font-size:.9rem;padding:20px 0;text-align:center">Select a player to view stats</div>';
  if(themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
  if(themeCallbacks.loadNextGame) themeCallbacks.loadNextGame();
  if(themeCallbacks.loadNews) themeCallbacks.loadNews();
  if(themeCallbacks.loadStandings) themeCallbacks.loadStandings();
  if(themeCallbacks.loadRoster) themeCallbacks.loadRoster();
  if(themeCallbacks.loadTeamStats) themeCallbacks.loadTeamStats();
  if(themeCallbacks.loadHomeInjuries) themeCallbacks.loadHomeInjuries();
  if(themeCallbacks.loadHomeMoves) themeCallbacks.loadHomeMoves();
  if(themeCallbacks.loadHomePodcastWidget) themeCallbacks.loadHomePodcastWidget();
  if(themeCallbacks.loadHomeYoutubeWidget) themeCallbacks.loadHomeYoutubeWidget();
  if(document.getElementById('schedule').classList.contains('active')&&themeCallbacks.loadTodayGame) themeCallbacks.loadTodayGame();
  if(state.myTeamLens&&themeCallbacks.applyMyTeamLens) themeCallbacks.applyMyTeamLens(true);
}

export { setThemeCallbacks, applyTeamTheme, applyPulseMLBTheme, setPulseColorScheme, togglePulseColorScheme, updatePulseToggle, toggleSettings, setupSettingsClickOutside, toggleInvert, buildThemeSelect, buildTeamSelect, switchTheme, switchThemeScope, switchTeam };
