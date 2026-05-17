// News-related utility helpers: image-host allowlist + HTML escape/decode +
// http→https forcing. Used by News, League, Stats, Home (YouTube widget),
// and Schedule (highlight thumbs).
//
// NEWS_IMAGE_HOSTS was added v3.34.17 to prevent corporate firewalls
// (Check Point UserCheck etc) from flagging unexpected RSS thumbnail
// domains. If a legitimate source changes its CDN, add the new hostname
// to the regex below.

export const NEWS_IMAGE_HOSTS =
  /\.(mlb\.com|mlbstatic\.com|espn\.com|espncdn\.com|cbssports\.com|cbsi\.com|cbsistatic\.com|fangraphs\.com|mlbtraderumors\.com|wp\.com|wordpress\.com|cloudfront\.net|fastly\.net|akamaized\.net|amazonaws\.com|imgix\.net|twimg\.com|bsky\.app)$/;

export function isSafeNewsImage(url) {
  if (!url) return false;
  try { return NEWS_IMAGE_HOSTS.test(new URL(url).hostname); }
  catch (e) { return false; }
}

export function escapeNewsHtml(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

export function forceHttps(url){return url?url.replace(/^http:/,'https:'):url;}

export function decodeNewsHtml(s){const map={'&quot;':'"','&amp;':'&','&lt;':'<','&gt;':'>','&#39;':"'",'&apos;':"'"};return String(s||'').replace(/&(?:#\d+|#x[0-9a-f]+|quot|amp|lt|gt|apos?);/gi,function(e){return map[e.toLowerCase()]||e;}).replace(/&#(\d+);/g,function(m,code){return String.fromCharCode(parseInt(code,10));}).replace(/&#x([0-9a-f]+);/gi,function(m,code){return String.fromCharCode(parseInt(code,16));}); }

export function isBettingPromo(item) {
  return item.source === 'CBS' && /^Use\s+/i.test(item.title);
}
