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
  { handle: 'mlb.com',                     name: 'MLB',                 tag: 'League' },
  { handle: 'mlbtraderumors.com',          name: 'MLB Trade Rumors',    tag: 'Rumors' },
  { handle: 'fangraphs.com',               name: 'FanGraphs',           tag: 'Analytics' },
  { handle: 'megrowley.fangraphs.com',     name: 'Meg Rowley',          tag: 'FanGraphs' },
  { handle: 'jayjaffe.bsky.social',        name: 'Jay Jaffe',           tag: 'FanGraphs' },
  { handle: 'benclemens.fangraphs.com',    name: 'Ben Clemens',         tag: 'FanGraphs' },
  { handle: 'dszymborski.bsky.social',     name: 'Dan Szymborski',      tag: 'ZiPS' },
  { handle: 'baseballprospectus.com',      name: 'Baseball Prospectus', tag: 'Analytics' },
  { handle: 'baseballamerica.com',         name: 'Baseball America',    tag: 'Prospects' },
  { handle: 'kenrosenthal.bsky.social',    name: 'Ken Rosenthal',       tag: 'Insider' },
  { handle: 'jeffpassan.bsky.social',      name: 'Jeff Passan',         tag: 'Insider' },
  { handle: 'jaysonst.bsky.social',        name: 'Jayson Stark',        tag: 'Athletic' },
  { handle: 'keithlaw.bsky.social',        name: 'Keith Law',           tag: 'Scouting' },
  { handle: 'slangs.bsky.social',          name: 'Sarah Langs',         tag: 'MLB.com' },
  { handle: 'codifybaseball.bsky.social',  name: 'Codify',              tag: 'Stats' },

  // Beat writers — one per club (name+outlet reliable; handles best-effort)
  { handle: 'npiecoro.bsky.social',        name: 'Nick Piecoro',        tag: 'D-backs' },
  { handle: 'dobrien.bsky.social',         name: "David O'Brien",       tag: 'Braves' },
  { handle: 'rochkubatko.bsky.social',     name: 'Roch Kubatko',        tag: 'Orioles' },
  { handle: 'peteabe.bsky.social',         name: 'Pete Abraham',        tag: 'Red Sox' },
  { handle: 'patrickmooney.bsky.social',   name: 'Patrick Mooney',      tag: 'Cubs' },
  { handle: 'scottmerkin.bsky.social',     name: 'Scott Merkin',        tag: 'White Sox' },
  { handle: 'ctrent.bsky.social',          name: 'C. Trent Rosecrans',  tag: 'Reds' },
  { handle: 'zackmeisel.bsky.social',      name: 'Zack Meisel',         tag: 'Guardians' },
  { handle: 'psaunders.bsky.social',       name: 'Patrick Saunders',    tag: 'Rockies' },
  { handle: 'cstavenhagen.bsky.social',    name: 'Cody Stavenhagen',    tag: 'Tigers' },
  { handle: 'chandlerrome.bsky.social',    name: 'Chandler Rome',       tag: 'Astros' },
  { handle: 'annierogers.bsky.social',     name: 'Anne Rogers',         tag: 'Royals' },
  { handle: 'samblum.bsky.social',         name: 'Sam Blum',            tag: 'Angels' },
  { handle: 'fabardaya.bsky.social',       name: 'Fabian Ardaya',       tag: 'Dodgers' },
  { handle: 'cdenicola.bsky.social',       name: 'Christina De Nicola', tag: 'Marlins' },
  { handle: 'adammccalvy.bsky.social',     name: 'Adam McCalvy',        tag: 'Brewers' },
  { handle: 'danhayes.bsky.social',        name: 'Dan Hayes',           tag: 'Twins' },
  { handle: 'anthonydicomo.bsky.social',   name: 'Anthony DiComo',      tag: 'Mets' },
  { handle: 'willsammon.bsky.social',      name: 'Will Sammon',         tag: 'Mets' },
  { handle: 'bryanhoch.bsky.social',       name: 'Bryan Hoch',          tag: 'Yankees' },
  { handle: 'mgallegos.bsky.social',       name: 'Martín Gallegos',     tag: 'Athletics' },
  { handle: 'mattgelb.bsky.social',        name: 'Matt Gelb',           tag: 'Phillies' },
  { handle: 'alexstumpf.bsky.social',      name: 'Alex Stumpf',         tag: 'Pirates' },
  { handle: 'kevinacee.bsky.social',       name: 'Kevin Acee',          tag: 'Padres' },
  { handle: 'extrabaggs.bsky.social',      name: 'Andrew Baggarly',     tag: 'Giants' },
  { handle: 'ryandivish.bsky.social',      name: 'Ryan Divish',         tag: 'Mariners' },
  { handle: 'katiejwoo.bsky.social',       name: 'Katie Woo',           tag: 'Cardinals' },
  { handle: 'marctopkin.bsky.social',      name: 'Marc Topkin',         tag: 'Rays' },
  { handle: 'evangrant.bsky.social',       name: 'Evan Grant',          tag: 'Rangers' },
  { handle: 'keeganmatheson.bsky.social',  name: 'Keegan Matheson',     tag: 'Blue Jays' },
  { handle: 'andrewgolden.bsky.social',    name: 'Andrew Golden',       tag: 'Nationals' },
];
