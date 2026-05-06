// News-related utility helpers. Currently just the image-host allowlist.
// Added v3.34.17 to prevent corporate firewalls (Check Point UserCheck etc)
// from flagging unexpected RSS thumbnail domains. If a legitimate source
// changes its CDN, add the new hostname to the regex below.

export const NEWS_IMAGE_HOSTS =
  /\.(mlb\.com|mlbstatic\.com|espn\.com|espncdn\.com|cbssports\.com|cbsi\.com|fangraphs\.com|mlbtraderumors\.com|wp\.com|wordpress\.com|cloudfront\.net|fastly\.net|akamaized\.net|amazonaws\.com|imgix\.net|twimg\.com)$/;

export function isSafeNewsImage(url) {
  if (!url) return false;
  try { return NEWS_IMAGE_HOSTS.test(new URL(url).hostname); }
  catch (e) { return false; }
}
