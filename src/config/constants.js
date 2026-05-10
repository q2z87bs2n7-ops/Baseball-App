// Pure constants — no mutations, no side effects, no dependencies.
// Extracted from app.js to demonstrate the modular pattern. Add more
// constants here as additional subsystems get extracted.

export const SEASON = 2026;
export const WC_SPOTS = 3;
export const MLB_BASE = 'https://statsapi.mlb.com/api/v1';
export const MLB_BASE_V1_1 = 'https://statsapi.mlb.com/api/v1.1';

// Vercel-hosted serverless functions (push subscribe/unsubscribe, RSS proxies,
// YouTube proxy, collection sync, OAuth flow, news aggregator).
export const API_BASE = 'https://baseball-app-sigma.vercel.app';

export const TEAMS = [
  {id:121,espnId:21,name:'New York Mets',short:'Mets',division:'National League East',league:'NL',primary:'#002D72',secondary:'#FF5910',youtubeUC:'UCgIMbGazP0uBDy9JVCqBUaA'},
  {id:144,espnId:15,name:'Atlanta Braves',short:'Braves',division:'National League East',league:'NL',primary:'#CE1141',secondary:'#13274F',youtubeUC:'UCNWnkblY5_kmf4OQ9l0LgnA'},
  {id:120,espnId:20,name:'Washington Nationals',short:'Nationals',division:'National League East',league:'NL',primary:'#AB0003',secondary:'#14225A',youtubeUC:'UCUnB3WNX238eraj5IK3fFEw'},
  {id:143,espnId:22,name:'Philadelphia Phillies',short:'Phillies',division:'National League East',league:'NL',primary:'#E81828',secondary:'#002D72',youtubeUC:'UCWkTX0S0Ii5pT2aRVz7Zctw'},
  {id:146,espnId:28,name:'Miami Marlins',short:'Marlins',division:'National League East',league:'NL',primary:'#00A3E0',secondary:'#EF3340',youtubeUC:'UC1Gh_pQ7l41tyBn2HeJ1k-A'},
  {id:112,espnId:16,name:'Chicago Cubs',short:'Cubs',division:'National League Central',league:'NL',primary:'#0E3386',secondary:'#CC3433',youtubeUC:'UCnU7B7B0U0t2vs-2HMLjgvg'},
  {id:113,espnId:17,name:'Cincinnati Reds',short:'Reds',division:'National League Central',league:'NL',primary:'#C6011F',secondary:'#000000',youtubeUC:'UCENXPJrzbHXudxhURfk5NCg'},
  {id:158,espnId:8,name:'Milwaukee Brewers',short:'Brewers',division:'National League Central',league:'NL',primary:'#0a2351',secondary:'#b6922e',youtubeUC:'UCybiT6P8jSv7gIxC4cHXl2Q'},
  {id:134,espnId:23,name:'Pittsburgh Pirates',short:'Pirates',division:'National League Central',league:'NL',primary:'#27251F',secondary:'#FDB827',youtubeUC:'UCmBaK2wdmP1LZ9gLkkHiM4Q'},
  {id:138,espnId:24,name:'St. Louis Cardinals',short:'Cardinals',division:'National League Central',league:'NL',primary:'#C41E3A',secondary:'#0C2340',youtubeUC:'UCwaMqLYzbyp2IbFgcF_s5Og'},
  {id:109,espnId:29,name:'Arizona Diamondbacks',short:'D-backs',division:'National League West',league:'NL',primary:'#A71930',secondary:'#E3D4AD',youtubeUC:'UCxeK534L7DDIwPFv_o9CZjw'},
  {id:115,espnId:27,name:'Colorado Rockies',short:'Rockies',division:'National League West',league:'NL',primary:'#33006f',secondary:'#C4CED4',youtubeUC:'UCBci3py0IfkjkjPKDE-B6Bw'},
  {id:119,espnId:19,name:'Los Angeles Dodgers',short:'Dodgers',division:'National League West',league:'NL',primary:'#005A9C',secondary:'#EF3E42',youtubeUC:'UC05cNJvMKzDLRPo59X2Xx7g'},
  {id:135,espnId:25,name:'San Diego Padres',short:'Padres',division:'National League West',league:'NL',primary:'#2F241D',secondary:'#FFC425',youtubeUC:'UCdhukF6o5_ENjbf_9oNGXNQ'},
  {id:137,espnId:26,name:'San Francisco Giants',short:'Giants',division:'National League West',league:'NL',primary:'#FD5A1E',secondary:'#27251F',youtubeUC:'UCpXMHgjrpnynDSV5mXpqImw'},
  {id:110,espnId:1,name:'Baltimore Orioles',short:'Orioles',division:'American League East',league:'AL',primary:'#DF4601',secondary:'#27251F',youtubeUC:'UC2jqf9lgDjMUtTow1Q4IKzg'},
  {id:111,espnId:2,name:'Boston Red Sox',short:'Red Sox',division:'American League East',league:'AL',primary:'#BD3039',secondary:'#0D2B56',youtubeUC:'UCoLrny_Oky6BE206kOfTmiw'},
  {id:147,espnId:10,name:'New York Yankees',short:'Yankees',division:'American League East',league:'AL',primary:'#003087',secondary:'#C4CED4',youtubeUC:'UCmAQ_4ELJodnKuNqviK86Dg'},
  {id:139,espnId:30,name:'Tampa Bay Rays',short:'Rays',division:'American League East',league:'AL',primary:'#092C5C',secondary:'#8FBCE6',youtubeUC:'UCZaT7TplNF541ySP8SlHVGA'},
  {id:141,espnId:14,name:'Toronto Blue Jays',short:'Blue Jays',division:'American League East',league:'AL',primary:'#134A8E',secondary:'#1D2D5C',youtubeUC:'UCVPkZh_H6m_stW8hq-2-yNw'},
  {id:145,espnId:4,name:'Chicago White Sox',short:'White Sox',division:'American League Central',league:'AL',primary:'#27251F',secondary:'#C4CED4',youtubeUC:'UCve-Ci-M4CkBOmNi2LQdCRg'},
  {id:114,espnId:5,name:'Cleveland Guardians',short:'Guardians',division:'American League Central',league:'AL',primary:'#E31937',secondary:'#0C2340',youtubeUC:'UCpI50OSBxxalmRZRq4gtRDw'},
  {id:116,espnId:6,name:'Detroit Tigers',short:'Tigers',division:'American League Central',league:'AL',primary:'#182d55',secondary:'#f26722',youtubeUC:'UCKKG465DFaJ3Yp-jQHA3jhw'},
  {id:118,espnId:7,name:'Kansas City Royals',short:'Royals',division:'American League Central',league:'AL',primary:'#174885',secondary:'#c0995a',youtubeUC:'UCvA2SgPVi3Hw6n_WER0VrcQ'},
  {id:142,espnId:9,name:'Minnesota Twins',short:'Twins',division:'American League Central',league:'AL',primary:'#002B5C',secondary:'#D31145',youtubeUC:'UCkXEh3jSl4oB1mQqjIePfTg'},
  {id:117,espnId:18,name:'Houston Astros',short:'Astros',division:'American League West',league:'AL',primary:'#002D62',secondary:'#EB6E1F',youtubeUC:'UC3RPfeyaEIPosC4eIcNr4Gw'},
  {id:108,espnId:3,name:'Los Angeles Angels',short:'Angels',division:'American League West',league:'AL',primary:'#BA0021',secondary:'#003263',youtubeUC:'UCS7H_WWPj5_qfD-zoUzuX2A'},
  {id:133,espnId:11,name:'Oakland Athletics',short:'Athletics',division:'American League West',league:'AL',primary:'#003831',secondary:'#EFB21E',youtubeUC:'UCeiRABiGBQTzpuEYohN_I1Q'},
  {id:136,espnId:12,name:'Seattle Mariners',short:'Mariners',division:'American League West',league:'AL',primary:'#0C2C56',secondary:'#c4ced4',youtubeUC:'UCWWLs-O8JGYYcNea7AgumAA'},
  {id:140,espnId:13,name:'Texas Rangers',short:'Rangers',division:'American League West',league:'AL',primary:'#003278',secondary:'#C0111F',youtubeUC:'UCZjXWMvOrhc91chSDPDUspA'},
];

export const MLB_THEME = {id:-1,name:'Default',short:'MLB',primary:'#0E3386',secondary:'#CC3433'};

export const NEWS_SOURCE_LABELS = {mlb:'MLB.com',espn:'ESPN',mlbtr:'MLB Trade Rumors',fangraphs:'FanGraphs',cbs:'CBS Sports'};
export const NEWS_SOURCE_ICONS = {mlb:'⚾',espn:'📺',mlbtr:'💼',fangraphs:'📊',cbs:'🎙️'};

// Stats-tab percentile lookups. Each entry maps a player-stat field key to the
// /stats/leaders leaderCategories enum, plus polarity (lowerIsBetter flips the
// rank comparator for ERA/WHIP/etc.) and decimals for delta-chip formatting.
// Consumed by src/utils/stats-math.js (computePercentile / leaderEntry) and
// fetchLeagueLeaders in src/data/leaders.js.
export const LEADER_CATS_FOR_PERCENTILE = [
  // Hitting (higher-is-better unless noted)
  {group:'hitting',  key:'avg',                 leaderCategory:'battingAverage',                  lowerIsBetter:false, decimals:3},
  {group:'hitting',  key:'homeRuns',            leaderCategory:'homeRuns',                        lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'rbi',                 leaderCategory:'runsBattedIn',                    lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'ops',                 leaderCategory:'onBasePlusSlugging',              lowerIsBetter:false, decimals:3},
  {group:'hitting',  key:'obp',                 leaderCategory:'onBasePercentage',                lowerIsBetter:false, decimals:3},
  {group:'hitting',  key:'slg',                 leaderCategory:'sluggingPercentage',              lowerIsBetter:false, decimals:3},
  {group:'hitting',  key:'hits',                leaderCategory:'hits',                            lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'doubles',             leaderCategory:'doubles',                         lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'triples',             leaderCategory:'triples',                         lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'runs',                leaderCategory:'runs',                            lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'stolenBases',         leaderCategory:'stolenBases',                     lowerIsBetter:false, decimals:0},
  {group:'hitting',  key:'baseOnBalls',         leaderCategory:'walks',                           lowerIsBetter:false, decimals:0},
  // For hitters, more strikeouts = worse
  {group:'hitting',  key:'strikeOuts',          leaderCategory:'strikeouts',                      lowerIsBetter:true,  decimals:0},
  // Pitching (mixed polarity)
  {group:'pitching', key:'era',                 leaderCategory:'earnedRunAverage',                lowerIsBetter:true,  decimals:2},
  {group:'pitching', key:'whip',                leaderCategory:'walksAndHitsPerInningPitched',    lowerIsBetter:true,  decimals:2},
  {group:'pitching', key:'strikeOuts',          leaderCategory:'strikeouts',                      lowerIsBetter:false, decimals:0},
  {group:'pitching', key:'wins',                leaderCategory:'wins',                            lowerIsBetter:false, decimals:0},
  {group:'pitching', key:'saves',               leaderCategory:'saves',                           lowerIsBetter:false, decimals:0},
  {group:'pitching', key:'inningsPitched',      leaderCategory:'inningsPitched',                  lowerIsBetter:false, decimals:1},
  {group:'pitching', key:'strikeoutWalkRatio',  leaderCategory:'strikeoutWalkRatio',              lowerIsBetter:false, decimals:2},
  {group:'pitching', key:'strikeoutsPer9Inn',   leaderCategory:'strikeoutsPer9Inn',               lowerIsBetter:false, decimals:2},
  {group:'pitching', key:'walksPer9Inn',        leaderCategory:'walksPer9Inn',                    lowerIsBetter:true,  decimals:2},
  {group:'pitching', key:'baseOnBalls',         leaderCategory:'walks',                           lowerIsBetter:true,  decimals:0},
  {group:'pitching', key:'hits',                leaderCategory:'hits',                            lowerIsBetter:true,  decimals:0},
  {group:'pitching', key:'homeRuns',            leaderCategory:'homeRuns',                        lowerIsBetter:true,  decimals:0},
];

export const TIMING = {
  PULSE_POLL_MS:      15000,  // pollLeaguePulse interval
  FOCUS_POLL_MS:       5000,  // pollFocusLinescore / focusFastTimer interval
  LIVE_REFRESH_MS:    30000,  // live game view auto-refresh
  HOME_LIVE_MS:       60000,  // home card live auto-refresh
  LEAGUE_REFRESH_MS:  60000,  // around the league matchup auto-refresh
  STORY_POOL_MS:      30000,  // buildStoryPool rebuild interval
  NEWS_REFRESH_MS:   600000,  // news carousel refresh (10 min)
  YESTERDAY_REFRESH_MS: 3600000, // yesterday recap hourly refresh
  CARD_DISMISS_MS:     5500,  // player/RBI card auto-dismiss
  CARD_CLOSE_ANIM_MS:   280,  // card close animation duration
  ALERT_DISMISS_MS:    8000,  // focus soft-alert auto-dismiss
  SIGNIN_CTA_MS:       8000,  // sign-in CTA auto-dismiss
  SYNC_INTERVAL_MS:   30000,  // background collection sync
};
