// League-wide stat leaders fetched via /stats/leaders. Cached on
// state.leagueLeaders keyed by `${group}:${leaderCategory}`. Used by:
//   - Stats tab percentile chips (loadRoster + selectPlayer flows)
//   - League tab "Stat Leaders" pane
//
// 5-min freshness cache + in-flight de-dupe via state.leagueLeadersFetchedAt
// and state.leagueLeadersInflight (both keyed by group).

import { state } from '../state.js';
import { SEASON, MLB_BASE, LEADER_CATS_FOR_PERCENTILE } from '../config/constants.js';

export async function fetchLeagueLeaders(group){
  if(!group)return;
  const FRESH_MS=300000;
  if(state.leagueLeadersInflight[group])return state.leagueLeadersInflight[group];
  if(state.leagueLeadersFetchedAt[group]&&Date.now()-state.leagueLeadersFetchedAt[group]<FRESH_MS)return;
  const entries=LEADER_CATS_FOR_PERCENTILE.filter(function(e){return e.group===group;});
  if(!entries.length)return;
  // v4.8.8: reverted to /stats/leaders. v4.8.4 attempted /stats?stats=season
  // with playerPool=Qualifier to bypass the leader-board ~100 cap, but the
  // endpoint silently returned empty splits in production (param naming /
  // schema mismatch suspected — `group` vs `statGroup`, `Qualifier` vs
  // `Qualified`). Effect was that state.leagueLeaders never populated, which
  // broke both the percentile UI in Stats and the League → Stat Leaders
  // display. Restored the v4.7.6-era query; the per-category pool is again
  // capped at ~100, accepted as the trade-off until we can verify a working
  // alternative endpoint shape.
  const seen={},cats=[];
  entries.forEach(function(e){if(!seen[e.leaderCategory]){seen[e.leaderCategory]=true;cats.push(e.leaderCategory);}});
  const url=MLB_BASE+'/stats/leaders?leaderCategories='+cats.join(',')+'&statGroup='+group+'&season='+SEASON+'&limit=300';
  const p=(async function(){
    try{
      const r=await fetch(url);
      const d=await r.json();
      const blocks=d.leagueLeaders||[];
      blocks.forEach(function(blk){
        const entry=entries.find(function(e){return e.leaderCategory===blk.leaderCategory;});
        if(!entry)return;
        const leaders=(blk.leaders||[]).map(function(l){
          const v=parseFloat(l.value);
          if(isNaN(v))return null;
          return{
            playerId:l.person&&l.person.id,
            playerName:l.person&&l.person.fullName,
            teamId:l.team&&l.team.id,
            teamAbbr:l.team&&(l.team.abbreviation||l.team.name),
            value:v,
            rank:parseInt(l.rank,10)||null
          };
        }).filter(function(x){return x!==null;});
        leaders.sort(function(a,b){return entry.lowerIsBetter?a.value-b.value:b.value-a.value;});
        state.leagueLeaders[group+':'+blk.leaderCategory]=leaders;
      });
      state.leagueLeadersFetchedAt[group]=Date.now();
    }catch(e){/* silent: percentile UI will simply not render */}
    finally{delete state.leagueLeadersInflight[group];}
  })();
  state.leagueLeadersInflight[group]=p;
  return p;
}
