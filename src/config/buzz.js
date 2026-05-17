// Curated Bluesky accounts for the Pulse "Baseball Buzz" side-rail feed.
//
// Pulse-wide (NOT per-team). `handle` is the Bluesky handle; posts are
// pulled keyless from the public AT-Protocol API at runtime (no account,
// no key). An unresolved or renamed handle simply yields no posts (the
// feed degrades gracefully — it never throws). `name` is a display
// fallback if the live profile's displayName is missing; `tag` is a short
// context label.
//
// HARDCODING RISK: handles are hand-curated and were NOT live-verified at
// authoring time (the curation environment had no network). Beat
// assignments + handles churn — re-verify each offseason (Nov–Feb) against
// https://public.api.bsky.app, mirroring the ESPN-ID / radio / podcast
// re-verify convention. Prefer domain handles (impersonation-proof).
// Last curated: 2026-05-17 (live-verified via buzz-check dev tool).
//
// COVERAGE GAPS (as of 2026-05-17): no active beat writer found for
// Yankees, Rays, Tigers, Braves, Marlins, Cardinals, Pirates, Rockies,
// Diamondbacks. Community blogs fill some of these gaps partially.
// Re-verify each offseason and replace stale handles when found.

export const BASEBALL_BUZZ_ACCOUNTS = [
  // Core / league
  { handle: 'mlbtraderumors.bsky.social',      name: 'MLB Trade Rumors',    tag: 'Rumors',     category: 'rumors' },
  { handle: 'slangsonsports.bsky.social',      name: 'Sarah Langs',         tag: 'MLB.com',    category: 'league' },

  // National insiders
  { handle: 'ken-rosenthal.bsky.social',       name: 'Ken Rosenthal',       tag: 'Athletic',   category: 'insider' },
  { handle: 'jaysonst.bsky.social',            name: 'Jayson Stark',        tag: 'Athletic',   category: 'insider' },
  { handle: 'bnightengale.bsky.social',        name: 'Bob Nightengale',     tag: 'USA Today',  category: 'insider' },
  { handle: 'chelseajanes.bsky.social',        name: 'Chelsea Janes',       tag: 'Wash Post',  category: 'insider' },

  // Analytics & scouting
  { handle: 'fangraphs.com',                   name: 'FanGraphs',           tag: 'Analytics',  category: 'analytics' },
  { handle: 'megrowler.fangraphs.com',         name: 'Meg Rowley',          tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'jayjaffe.bsky.social',            name: 'Jay Jaffe',           tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'benclemens.bsky.social',          name: 'Ben Clemens',         tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'dszymborski.fangraphs.com',       name: 'Dan Szymborski',      tag: 'ZiPS',       category: 'analytics' },
  { handle: 'benlindbergh.bsky.social',        name: 'Ben Lindbergh',       tag: 'Ringer',     category: 'analytics' },
  { handle: 'enosarris.bsky.social',           name: 'Eno Sarris',          tag: 'Athletic',   category: 'analytics' },
  { handle: 'baseballprospectus.com',          name: 'Baseball Prospectus', tag: 'Analytics',  category: 'analytics' },
  { handle: 'baseballamerica.com',             name: 'Baseball America',    tag: 'Prospects',  category: 'analytics' },
  { handle: 'pitcherlist.com',                 name: 'Pitcher List',        tag: 'Analytics',  category: 'analytics' },
  { handle: 'keithlaw.bsky.social',            name: 'Keith Law',           tag: 'Scouting',   category: 'scouting' },
  { handle: 'codifybaseball.bsky.social',      name: 'Codify',              tag: 'Stats',      category: 'analytics' },

  // AL East beat writers
  { handle: 'peteabeglobe.bsky.social',        name: 'Pete Abraham',        tag: 'Red Sox',    category: 'team' },
  { handle: 'alexspeier.bsky.social',          name: 'Alex Speier',         tag: 'Red Sox',    category: 'team' },
  { handle: 'jcmccaffrey.bsky.social',         name: 'Jen McCaffrey',       tag: 'Red Sox',    category: 'team' },
  { handle: 'rochkubatko.bsky.social',         name: 'Roch Kubatko',        tag: 'Orioles',    category: 'team' },
  { handle: 'keeganmatheson.bsky.social',      name: 'Keegan Matheson',     tag: 'Blue Jays',  category: 'team' },

  // AL Central beat writers
  { handle: 'zackmeisel.bsky.social',          name: 'Zack Meisel',         tag: 'Guardians',  category: 'team' },
  { handle: 'danhayesmlb.bsky.social',         name: 'Dan Hayes',           tag: 'Twins',      category: 'team' },
  { handle: 'jrfegan.soxmachine.com',          name: 'James Fegan',         tag: 'White Sox',  category: 'team' },

  // AL West beat writers
  { handle: 'samblum.bsky.social',             name: 'Sam Blum',            tag: 'Angels',     category: 'team' },
  { handle: 'chandlerrome.bsky.social',        name: 'Chandler Rome',       tag: 'Astros',     category: 'team' },
  { handle: 'threetwoeephus.bsky.social',      name: 'Levi Weaver',         tag: 'Rangers',    category: 'team' },
  { handle: 'melissalockard.bsky.social',      name: 'Melissa Lockard',     tag: 'Athletics',  category: 'team' },

  // NL East beat writers
  { handle: 'timbritton.bsky.social',          name: 'Tim Britton',         tag: 'Mets',       category: 'team' },
  { handle: 'willsammon.bsky.social',          name: 'Will Sammon',         tag: 'Mets',       category: 'team' },
  { handle: 'mattgelb.bsky.social',            name: 'Matt Gelb',           tag: 'Phillies',   category: 'team' },
  { handle: 'andrewgolden.bsky.social',        name: 'Andrew Golden',       tag: 'Nationals',  category: 'team' },

  // NL Central beat writers
  { handle: 'cyrthogg.bsky.social',            name: 'Curt Hogg',           tag: 'Brewers',    category: 'team' },
  { handle: 'adammccalvy.bsky.social',         name: 'Adam McCalvy',        tag: 'Brewers',    category: 'team' },
  { handle: 'ctrent.bsky.social',              name: 'C. Trent Rosecrans',  tag: 'Reds',       category: 'team' },
  { handle: 'psaunders.bsky.social',           name: 'Patrick Saunders',    tag: 'Rockies',    category: 'team' },

  // NL West beat writers
  { handle: 'fabianardaya.bsky.social',        name: 'Fabian Ardaya',       tag: 'Dodgers',    category: 'team' },
  { handle: 'andrewbaggarly.bsky.social',      name: 'Andrew Baggarly',     tag: 'Giants',     category: 'team' },

  // Community / SB Nation blogs
  { handle: 'amazinavenue.bsky.social',        name: "Amazin' Avenue",      tag: 'Mets',       category: 'team' },
  { handle: 'lookoutlanding.bsky.social',      name: 'Lookout Landing',     tag: 'Mariners',   category: 'team' },
  { handle: 'bleedcubbieblue.bsky.social',     name: 'Bleed Cubbie Blue',   tag: 'Cubs',       category: 'team' },
  { handle: 'southsidesox.bsky.social',        name: 'South Side Sox',      tag: 'White Sox',  category: 'team' },
  { handle: 'royalsreview.bsky.social',        name: 'Royals Review',       tag: 'Royals',     category: 'team' },
  { handle: 'gaslampball.bsky.social',         name: 'Gaslamp Ball',        tag: 'Padres',     category: 'team' },
  { handle: 'thegoodphight.bsky.social',       name: 'The Good Phight',     tag: 'Phillies',   category: 'team' },
  { handle: 'mccoveychronicles.bsky.social',   name: 'McCovey Chronicles',  tag: 'Giants',     category: 'team' },
  { handle: 'federalbaseball.bsky.social',     name: 'Federal Baseball',    tag: 'Nationals',  category: 'team' },
];
