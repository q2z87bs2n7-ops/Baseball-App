// Builds the player batting + pitching tables from a boxscore.players payload.
// Used by Schedule (game detail panel) and Live Game view.

export function buildBoxscore(players){
  var hitters=[],pitchers=[];
  Object.values(players).forEach(function(p){var bat=p.stats&&p.stats.batting,pit=p.stats&&p.stats.pitching;if(bat&&bat.atBats>0)hitters.push({name:p.person.fullName,order:p.battingOrder||999,ab:bat.atBats,h:bat.hits,r:bat.runs,rbi:bat.rbi,bb:bat.baseOnBalls,k:bat.strikeOuts,hr:bat.homeRuns});if(pit&&(parseFloat(pit.inningsPitched||0)>0||pit.outs>0))pitchers.push({name:p.person.fullName,ip:pit.inningsPitched||'0.0',h:pit.hits,r:pit.runs,er:pit.earnedRuns,bb:pit.baseOnBalls,k:pit.strikeOuts,hr:pit.homeRuns,pc:pit.numberOfPitches||'—'});});
  hitters.sort(function(a,b){return a.order-b.order;});
  var t='<div style="margin-bottom:12px"><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin-bottom:6px">Batting</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>AB</th><th>H</th><th>R</th><th>RBI</th><th>BB</th><th>K</th><th>HR</th></tr></thead><tbody>';
  if(!hitters.length)t+='<tr><td colspan="8" style="color:var(--muted)">No data</td></tr>';
  hitters.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ab+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.rbi+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td></tr>';});
  t+='</tbody></table></div><div style="font-size:.68rem;font-weight:700;text-transform:uppercase;color:var(--accent);margin:10px 0 6px">Pitching</div>';
  t+='<div style="overflow-x:auto"><table class="linescore-table"><thead><tr><th style="text-align:left;min-width:130px">Player</th><th>IP</th><th>H</th><th>R</th><th>ER</th><th>BB</th><th>K</th><th>HR</th><th>PC</th></tr></thead><tbody>';
  if(!pitchers.length)t+='<tr><td colspan="9" style="color:var(--muted)">No data</td></tr>';
  pitchers.forEach(function(p){t+='<tr><td style="text-align:left">'+p.name+'</td><td>'+p.ip+'</td><td>'+p.h+'</td><td>'+p.r+'</td><td>'+p.er+'</td><td>'+p.bb+'</td><td>'+p.k+'</td><td>'+p.hr+'</td><td>'+p.pc+'</td></tr>';});
  return t+'</tbody></table></div></div>';
}
