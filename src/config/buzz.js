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
// Last curated: 2026-05-17 (verified via web search).

export const BASEBALL_BUZZ_ACCOUNTS = [
  // Core / all-around
  { handle: 'mlb.com',                     name: 'MLB',                 tag: 'League',     category: 'league' },
  { handle: 'mlbtraderumors.bsky.social',   name: 'MLB Trade Rumors',    tag: 'Rumors',     category: 'rumors' },
  { handle: 'fangraphs.com',               name: 'FanGraphs',           tag: 'Analytics',  category: 'analytics' },
  { handle: 'megrowler.fangraphs.com',     name: 'Meg Rowley',          tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'jayjaffe.bsky.social',        name: 'Jay Jaffe',           tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'benclemens.bsky.social',      name: 'Ben Clemens',         tag: 'FanGraphs',  category: 'analytics' },
  { handle: 'dszymborski.fangraphs.com',   name: 'Dan Szymborski',      tag: 'ZiPS',       category: 'analytics' },
  { handle: 'baseballprospectus.com',      name: 'Baseball Prospectus', tag: 'Analytics',  category: 'analytics' },
  { handle: 'baseballamerica.com',         name: 'Baseball America',    tag: 'Prospects',  category: 'league' },
  { handle: 'ken-rosenthal.bsky.social',   name: 'Ken Rosenthal',       tag: 'Insider',    category: 'insider' },
  { handle: 'jeffpassan.bsky.social',      name: 'Jeff Passan',         tag: 'Insider',    category: 'insider' },
  { handle: 'jaysonst.bsky.social',        name: 'Jayson Stark',        tag: 'Athletic',   category: 'insider' },
  { handle: 'keithlaw.bsky.social',        name: 'Keith Law',           tag: 'Scouting',   category: 'scouting' },
  { handle: 'slangsonsports.bsky.social',  name: 'Sarah Langs',         tag: 'MLB.com',    category: 'league' },
  { handle: 'codifybaseball.bsky.social',  name: 'Codify',              tag: 'Stats',      category: 'analytics' },

  // Beat writers — one per club (name+outlet reliable; handles best-effort)
  { handle: 'dobrien.bsky.social',         name: "David O'Brien",       tag: 'Braves',     category: 'team' },
  { handle: 'rochkubatko.bsky.social',     name: 'Roch Kubatko',        tag: 'Orioles',    category: 'team' },
  { handle: 'peteabeglobe.bsky.social',    name: 'Pete Abraham',        tag: 'Red Sox',    category: 'team' },
  { handle: 'patrickmooney.bsky.social',   name: 'Patrick Mooney',      tag: 'Cubs',       category: 'team' },
  { handle: 'ctrent.bsky.social',          name: 'C. Trent Rosecrans',  tag: 'Reds',       category: 'team' },
  { handle: 'zackmeisel.bsky.social',      name: 'Zack Meisel',         tag: 'Guardians',  category: 'team' },
  { handle: 'psaunders.bsky.social',       name: 'Patrick Saunders',    tag: 'Rockies',    category: 'team' },
  { handle: 'codystavenhagen.bsky.social', name: 'Cody Stavenhagen',    tag: 'Tigers',     category: 'team' },
  { handle: 'chandlerrome.bsky.social',    name: 'Chandler Rome',       tag: 'Astros',     category: 'team' },
  { handle: 'annerogers.bsky.social',      name: 'Anne Rogers',         tag: 'Royals',     category: 'team' },
  { handle: 'samblum.bsky.social',         name: 'Sam Blum',            tag: 'Angels',     category: 'team' },
  { handle: 'fabianardaya.bsky.social',    name: 'Fabian Ardaya',       tag: 'Dodgers',    category: 'team' },
  { handle: 'cdenicola.bsky.social',       name: 'Christina De Nicola', tag: 'Marlins',    category: 'team' },
  { handle: 'adammccalvy.bsky.social',     name: 'Adam McCalvy',        tag: 'Brewers',    category: 'team' },
  { handle: 'danhayesmlb.bsky.social',     name: 'Dan Hayes',           tag: 'Twins',      category: 'team' },
  { handle: 'anthonydicomo.bsky.social',   name: 'Anthony DiComo',      tag: 'Mets',       category: 'team' },
  { handle: 'willsammon.bsky.social',      name: 'Will Sammon',         tag: 'Mets',       category: 'team' },
  { handle: 'bryanhoch.bsky.social',       name: 'Bryan Hoch',          tag: 'Yankees',    category: 'team' },
  { handle: 'mgallegos.bsky.social',       name: 'Martín Gallegos',     tag: 'Athletics',  category: 'team' },
  { handle: 'mattgelb.bsky.social',        name: 'Matt Gelb',           tag: 'Phillies',   category: 'team' },
  { handle: 'alexstumpf.bsky.social',      name: 'Alex Stumpf',         tag: 'Pirates',    category: 'team' },
  { handle: 'andrewbaggarly.bsky.social',  name: 'Andrew Baggarly',     tag: 'Giants',     category: 'team' },
  { handle: 'katiejwoo.bsky.social',       name: 'Katie Woo',           tag: 'Cardinals',  category: 'team' },
  { handle: 'tbtimesrays.bsky.social',     name: 'Marc Topkin',         tag: 'Rays',       category: 'team' },
  { handle: 'evangrant.bsky.social',       name: 'Evan Grant',          tag: 'Rangers',    category: 'team' },
  { handle: 'keeganmatheson.bsky.social',  name: 'Keegan Matheson',     tag: 'Blue Jays',  category: 'team' },
  { handle: 'andrewgolden.bsky.social',    name: 'Andrew Golden',       tag: 'Nationals',  category: 'team' },
];
