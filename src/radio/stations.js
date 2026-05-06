// Radio station data for the focus-paired Live Game Radio engine.
// All URLs sourced from radio.net's published OTA simulcast streams
// across Audacy/iHeart/Bonneville/Amperwave/StreamTheWorld. NOT MLB.tv.
//
// ⚠️ Audacy-hosted stations (live.amperwave.net/manifest/audacy-*) play
// alternate content (talk shows / ads) DURING games. Adding an Audacy
// teamId to APPROVED_RADIO_TEAM_IDS silently streams ads. See CLAUDE.md
// "Critical Gotchas" #2 (Audacy radio rights gap).
//
// Source of truth for the approved Set: in-app Radio Check sweep,
// last updated 2026-05-06.

export const MLB_TEAM_RADIO = {
  108: { name: 'KLAA Angels Radio',     url: 'https://klaa.streamguys1.com/live',                                                              format: 'direct' },
  109: { name: 'KTAR 620 AM',           url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KTARAMAAC.aac',               format: 'direct' },
  110: { name: 'WBAL 1090 AM',          url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WBALAMAAC.aac',               format: 'direct' },
  111: { name: 'WEEI 850 AM',           url: 'https://live.amperwave.net/manifest/audacy-weeifmaac-hlsc.m3u8',                                format: 'hls' },
  112: { name: 'WSCR 670 The Score',    url: 'https://live.amperwave.net/manifest/audacy-wscramaac-hlsc.m3u8',                                format: 'hls' },
  113: { name: '700 WLW',               url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WLWAMAAC.aac',                format: 'direct' },
  114: { name: 'WTAM 1100 AM',          url: 'https://stream.revma.ihrhls.com/zc1749/hls.m3u8',                                               format: 'hls' },
  115: { name: 'KOA 850 / 94.1',        url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KOAAMAAC.aac',                format: 'direct' },
  116: { name: 'WXYT 97.1 The Ticket',  url: 'https://live.amperwave.net/manifest/audacy-wxytfmaac-hlsc.m3u8',                                format: 'hls' },
  117: { name: 'SportsTalk 790 AM',     url: 'https://stream.revma.ihrhls.com/zc2257',                                                        format: 'direct' },
  118: { name: '96.5 The Fan KFNZ',     url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KFNZFMAAC.aac',               format: 'direct' },
  119: { name: 'KLAC AM 570 LA Sports', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KLACAMAAC.aac',               format: 'direct' },
  120: { name: 'WJFK The Fan 106.7',    url: 'https://live.amperwave.net/manifest/audacy-wjfkfmaac-hlsc.m3u8',                                format: 'hls' },
  121: { name: 'WCBS 880 AM',           url: 'https://live.amperwave.net/manifest/audacy-wcbsamaac-hlsc.m3u8',                                format: 'hls' },
  133: { name: 'KSTE 650 AM Sacramento', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KSTEAMAAC.aac',              format: 'direct' },
  134: { name: 'KDKA-FM 93.7 The Fan',  url: 'https://live.amperwave.net/manifest/audacy-kdkafmaac-hlsc.m3u8',                                format: 'hls' },
  135: { name: 'KWFN 97.3 The Fan',     url: 'https://live.amperwave.net/manifest/audacy-kwfnfmaac-llhlsc.m3u8',                              format: 'hls' },
  136: { name: 'Seattle Sports 710 AM', url: 'https://bonneville.cdnstream1.com/2642_48.aac',                                                 format: 'direct' },
  137: { name: 'KNBR 104.5 / 680',      url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/KNBRAMAAC.aac',               format: 'direct' },
  138: { name: 'KMOX NewsRadio 1120',   url: 'https://live.amperwave.net/manifest/audacy-kmoxamaac-llhlsc.m3u8',                              format: 'hls' },
  139: { name: 'WDAE 95.3 FM / 620 AM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WDAEAMAAC.aac',               format: 'direct' },
  140: { name: '105.3 The Fan KRLD',    url: 'https://live.amperwave.net/manifest/audacy-krldfmaac-hlsc.m3u8',                                format: 'hls' },
  141: { name: 'CJCL Sportsnet 590',    url: 'https://rogers-hls.leanstream.co/rogers/tor590.stream/playlist.m3u8',                           format: 'hls' },
  142: { name: 'WCCO News Talk 830',    url: 'https://live.amperwave.net/manifest/audacy-wccoamaac-llhlsc.m3u8',                              format: 'hls' },
  143: { name: '94 WIP Sportsradio',    url: 'https://live.amperwave.net/manifest/audacy-wipfmaac-hlsc.m3u8',                                 format: 'hls' },
  144: { name: '680 The Fan / 93.7 FM', url: 'https://stream.zeno.fm/q9458433dm8uv',                                                          format: 'direct' },
  145: { name: 'WMVP ESPN 1000 AM',     url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WMVPAMAAC.aac',               format: 'direct' },
  146: { name: 'WQAM 560 AM',           url: 'https://live.amperwave.net/manifest/audacy-wqamamaac-hlsc.m3u8',                                format: 'hls' },
  147: { name: 'WFAN 66 / 101.9',       url: 'https://live.amperwave.net/manifest/audacy-wfanamaac-hlsc.m3u8',                                format: 'hls' },
  158: { name: 'WTMJ Newsradio 620',    url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/WTMJAMAAC.aac',               format: 'direct' },
};

export const FALLBACK_RADIO = { name: 'Fox Sports Radio', url: 'https://ais-sa1.streamon.fm/7852_128k.aac', format: 'direct' };

// Approved team IDs whose flagship feeds verifiably play live game audio.
// Update as the in-app Radio Check sweep grows; non-approved teams skip
// to FALLBACK_RADIO.
export const APPROVED_RADIO_TEAM_IDS = new Set([108, 114, 116, 117, 137, 140, 142, 144, 146, 147]);

// Default notes seeded once into the Radio Check tool's textarea on first run
// (preserves user-entered notes via the `mlb_radio_check_notes_seeded_v2`
// localStorage flag — see loadRadioCheckResults).
export const RADIO_CHECK_DEFAULT_NOTES = {
  '108': 'Confirmed working — live game audio (verified 2026-05-02)',
  '109': 'URL updated v3.34.1 — not yet confirmed',
  '110': 'URL updated v3.34.1 — not yet confirmed',
  '112': 'Not yet confirmed — needs Radio Check sweep',
  '113': 'URL updated v3.34.1 — not yet confirmed',
  '114': 'Confirmed working — live game audio (verified 2026-05-02)',
  '115': 'URL updated v3.34.1 — not yet confirmed',
  '116': 'Confirmed working — live game audio (verified 2026-05-02)',
  '117': 'Confirmed working — live game audio (verified 2026-05-02)',
  '118': 'URL updated v3.34.1 — not yet confirmed',
  '119': 'URL updated v3.34.1 — not yet confirmed',
  '121': 'URL updated v3.34.1 — not yet confirmed',
  '133': 'URL updated v3.34.1 — not yet confirmed',
  '137': 'Confirmed working — live game audio (verified 2026-05-06)',
  '139': 'URL updated v3.34.1 — not yet confirmed',
  '140': 'Confirmed working — live game audio (verified 2026-05-02)',
  '142': 'Confirmed working — live game audio (verified 2026-05-02)',
  '144': 'Confirmed working — live game audio (verified 2026-05-02)',
  '145': 'URL updated v3.34.1 — not yet confirmed',
  '146': 'Confirmed working — live game audio (verified 2026-05-02)',
  '147': 'Confirmed working — live game audio (verified 2026-05-02)',
  '158': 'URL updated v3.34.1 — not yet confirmed',
};
