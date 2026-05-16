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
// Last curated: 2026-05-16 (unverified).

export const BASEBALL_BUZZ_ACCOUNTS = [
  // Core / all-around
  { handle: 'mlb.com',                     name: 'MLB',                 tag: 'League',     category: 'league' },
  { handle: 'mlbtraderumors.com',          name: 'MLB Trade Rumors',    tag: 'Rumors',     category: 'rumors' },
  { handle: 'fangraphs.com',               name: 'FanGraphs',           tag: 'Analytics',  category: 'analytics' },
  { handle: 'megrowley.fangraphs.com',     name: 'Meg Rowley',          tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'jayjaffe.bsky.social',        name: 'Jay Jaffe',           tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'benclemens.fangraphs.com',    name: 'Ben Clemens',         tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'dszymborski.bsky.social',     name: 'Dan Szymborski',      tag: 'ZiPS',       category: 'analytics' },
  { handle: 'baseballprospectus.com',      name: 'Baseball Prospectus', tag: 'Analytics',  category: 'analytics' },
  { handle: 'baseballamerica.com',         name: 'Baseball America',    tag: 'Prospects',  category: 'league' },
  { handle: 'kenrosenthal.bsky.social',    name: 'Ken Rosenthal',       tag: 'Insider',    category: 'insider' },
  { handle: 'jeffpassan.bsky.social',      name: 'Jeff Passan',         tag: 'Insider',    category: 'insider' },
  { handle: 'jaysonst.bsky.social',        name: 'Jayson Stark',        tag: 'Athletic',   category: 'insider' },
  { handle: 'keithlaw.bsky.social',        name: 'Keith Law',           tag: 'Scouting',   category: 'scouting' },
  { handle: 'slangs.bsky.social',          name: 'Sarah Langs',         tag: 'MLB.com',    category: 'league' },
  { handle: 'codifybaseball.bsky.social',  name: 'Codify',              tag: 'Stats',      category: 'analytics' },

  // Beat writers — one per club (name+outlet reliable; handles best-effort)
  { handle: 'npiecoro.bsky.social',        name: 'Nick Piecoro',        tag: 'D-backs',    category: 'team' },
  { handle: 'dobrien.bsky.social',         name: "David O'Brien",       tag: 'Braves',     category: 'team' },
  { handle: 'rochkubatko.bsky.social',     name: 'Roch Kubatko',        tag: 'Orioles',    category: 'team' },
  { handle: 'peteabe.bsky.social',         name: 'Pete Abraham',        tag: 'Red Sox',    category: 'team' },
  { handle: 'patrickmooney.bsky.social',   name: 'Patrick Mooney',      tag: 'Cubs',       category: 'team' },
  { handle: 'scottmerkin.bsky.social',     name: 'Scott Merkin',        tag: 'White Sox',  category: 'team' },
  { handle: 'ctrent.bsky.social',          name: 'C. Trent Rosecrans',  tag: 'Reds',       category: 'team' },
  { handle: 'zackmeisel.bsky.social',      name: 'Zack Meisel',         tag: 'Guardians',  category: 'team' },
  { handle: 'psaunders.bsky.social',       name: 'Patrick Saunders',    tag: 'Rockies',    category: 'team' },
  { handle: 'cstavenhagen.bsky.social',    name: 'Cody Stavenhagen',    tag: 'Tigers',     category: 'team' },
  { handle: 'chandlerrome.bsky.social',    name: 'Chandler Rome',       tag: 'Astros',     category: 'team' },
  { handle: 'annierogers.bsky.social',     name: 'Anne Rogers',         tag: 'Royals',     category: 'team' },
  { handle: 'samblum.bsky.social',         name: 'Sam Blum',            tag: 'Angels',     category: 'team' },
  { handle: 'fabardaya.bsky.social',       name: 'Fabian Ardaya',       tag: 'Dodgers',    category: 'team' },
  { handle: 'cdenicola.bsky.social',       name: 'Christina De Nicola', tag: 'Marlins',    category: 'team' },
  { handle: 'adammccalvy.bsky.social',     name: 'Adam McCalvy',        tag: 'Brewers',    category: 'team' },
  { handle: 'danhayes.bsky.social',        name: 'Dan Hayes',           tag: 'Twins',      category: 'team' },
  { handle: 'anthonydicomo.bsky.social',   name: 'Anthony DiComo',      tag: 'Mets',       category: 'team' },
  { handle: 'willsammon.bsky.social',      name: 'Will Sammon',         tag: 'Mets',       category: 'team' },
  { handle: 'bryanhoch.bsky.social',       name: 'Bryan Hoch',          tag: 'Yankees',    category: 'team' },
  { handle: 'mgallegos.bsky.social',       name: 'Martín Gallegos',     tag: 'Athletics',  category: 'team' },
  { handle: 'mattgelb.bsky.social',        name: 'Matt Gelb',           tag: 'Phillies',   category: 'team' },
  { handle: 'alexstumpf.bsky.social',      name: 'Alex Stumpf',         tag: 'Pirates',    category: 'team' },
  { handle: 'kevinacee.bsky.social',       name: 'Kevin Acee',          tag: 'Padres',     category: 'team' },
  { handle: 'extrabaggs.bsky.social',      name: 'Andrew Baggarly',     tag: 'Giants',     category: 'team' },
  { handle: 'ryandivish.bsky.social',      name: 'Ryan Divish',         tag: 'Mariners',   category: 'team' },
  { handle: 'katiejwoo.bsky.social',       name: 'Katie Woo',           tag: 'Cardinals',  category: 'team' },
  { handle: 'marctopkin.bsky.social',      name: 'Marc Topkin',         tag: 'Rays',       category: 'team' },
  { handle: 'evangrant.bsky.social',       name: 'Evan Grant',          tag: 'Rangers',    category: 'team' },
  { handle: 'keeganmatheson.bsky.social',  name: 'Keegan Matheson',     tag: 'Blue Jays',  category: 'team' },
  { handle: 'andrewgolden.bsky.social',    name: 'Andrew Golden',       tag: 'Nationals',  category: 'team' },
];
