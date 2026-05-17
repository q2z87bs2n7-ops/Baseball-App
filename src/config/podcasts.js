// Curated team-podcast map, keyed by MLB team id.
//
// Each entry is an ordered list of up to 5 Apple Podcasts shows. The numeric
// `id` is the iTunes `collectionId` (the stable join key — survives CDN/feed
// rotation, unlike a hardcoded RSS feedUrl). At runtime the podcast proxy
// resolves each id to its current artwork + latest episode audio via
// itunes.apple.com/lookup. Teams not listed here fall back to an iTunes
// search-by-term (see fallbackPodcastTerm) at runtime.
//
// HARDCODING RISK: collectionIds + show selection must be re-verified each
// offseason (Nov–Feb) — drop shows inactive >3 months, refresh the list.
// Last curated: 2026-05-16.

export const TEAM_PODCASTS = {
  121: [ // New York Mets
    { name: 'The Mets Pod', id: 258864037 },
    { name: 'Locked On Mets', id: 1457146683 },
    { name: "Talkin' Mets", id: 271866252 },
    { name: 'Rico Brogna: A NY Mets Podcast', id: 1627097720 },
    { name: "Mets'd Up", id: 1559783548 },
  ],
  147: [ // New York Yankees
    { name: "Talkin' Yanks", id: 1257957660 },
    { name: 'Locked On Yankees', id: 1333234062 },
    { name: 'New York Yankees Official Podcast', id: 1341153569 },
    { name: 'Fireside Yankees', id: 1499018480 },
    { name: 'Yanks Go Yard', id: 1524654922 },
  ],
  119: [ // Los Angeles Dodgers
    { name: 'Locked On Dodgers', id: 1457146003 },
    { name: 'Dodgers Nation Podcast Network', id: 1385864210 },
    { name: 'All Dodgers', id: 1723083767 },
    { name: 'DodgerHeads', id: 1610389381 },
  ],
  111: [ // Boston Red Sox
    { name: 'Locked On Red Sox', id: 1456798246 },
    { name: 'The Bradfo Sho', id: 1212715122 },
    { name: 'Bastards of Boston Baseball', id: 1434494214 },
    { name: 'Pod Sox', id: 1615428779 },
  ],
  112: [ // Chicago Cubs
    { name: 'CHGO Chicago Cubs Podcast', id: 1110183965 },
    { name: 'Locked On Cubs', id: 1333234563 },
    { name: 'North Side Territory', id: 1745774349 },
    { name: 'Cubs Now', id: 1513391500 },
  ],
  144: [ // Atlanta Braves
    { name: 'Locked On Braves', id: 1382438394 },
    { name: 'Battery Power', id: 1082214582 },
  ],
  143: [ // Philadelphia Phillies
    { name: 'Locked On Phillies', id: 1457620388 },
  ],
  117: [ // Houston Astros
    { name: 'Locked On Astros', id: 1457064404 },
    { name: 'Houston Astros Podcast', id: 902521725 },
  ],
  137: [ // San Francisco Giants
    { name: 'Locked On Giants', id: 1455909225 },
    { name: 'Splash Hit Territory', id: 1850386082 },
    { name: 'Giants Splash', id: 1416246213 },
    { name: 'Giants Talk', id: 1092247887 },
  ],
  138: [ // St. Louis Cardinals
    { name: 'Best Podcast in Baseball', id: 855518046 },
    { name: 'Locked On Cardinals', id: 1371034395 },
    { name: 'Cardinals Conversations', id: 1798227890 },
  ],
};

// Fallback for teams with no curated entry: iTunes search-by-term. Full
// "City Nickname" + "podcast" disambiguates shared nicknames (Cardinals,
// Giants, Angels) and filters out single-mention news shows.
export function fallbackPodcastTerm(teamName) {
  return teamName + ' podcast';
}
