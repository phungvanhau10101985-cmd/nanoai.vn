/** Card thumbs. Bunny ignores width/quality when Optimizer is off and still returns the file. */
export const SHOP_CARD_IMAGE_EDGE = 640
/** Banners and PDP page images. */
export const SHOP_PAGE_IMAGE_EDGE = 1200
const SHOP_IMAGE_QUALITY = '68'

const SKIP_PATH_RE = /\/(favicon|pwa-icon|apple-touch-icon)(?:[./]|$)/i

function bunnyHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host.endsWith('.b-cdn.net') || host === 'cdn.188.com.vn'
}

/**
 * Downscale shop CDN photos on the URL. Layout CSS is unchanged.
 * AliCDN keeps its `_600x600` / `_1200x1200` suffix — those files already exist.
 */
export function tightenShopCdnImageUrl(raw: string | null | undefined, edge: number): string {
  const url = String(raw || '').trim()
  if (!url || url.startsWith('data:') || url.startsWith('/')) return url
  const abs = url.startsWith('//') ? `https:${url}` : url
  if (!/^https?:\/\//i.test(abs)) return url
  let parsed: URL
  try {
    parsed = new URL(abs)
  } catch {
    return url
  }
  if (!bunnyHost(parsed.hostname) || SKIP_PATH_RE.test(parsed.pathname)) return url
  const width = Math.max(64, Math.min(1600, Math.round(edge)))
  if (!parsed.searchParams.has('width')) parsed.searchParams.set('width', String(width))
  if (!parsed.searchParams.has('quality')) parsed.searchParams.set('quality', SHOP_IMAGE_QUALITY)
  return parsed.toString()
}

/** Same helper inside shop bootstrap scripts. Declare once per script. */
export const PW_SHOP_TIGHTEN_CDN_JS = `function tightenShopCdn(raw,edge){
  var u=String(raw||'').trim();
  if(!u||u.indexOf('data:')===0||u.charAt(0)==='/')return u;
  if(u.indexOf('//')===0)u='https:'+u;
  if(!/^https?:/i.test(u))return raw;
  try{
    var url=new URL(u);
    var host=url.hostname.toLowerCase();
    if(!/\\.b-cdn\\.net$/.test(host)&&host!=='cdn.188.com.vn')return u;
    if(/\\/(favicon|pwa-icon|apple-touch-icon)(?:[./]|$)/i.test(url.pathname))return u;
    var width=Math.max(64,Math.min(1600,Math.round(Number(edge)||800)));
    if(!url.searchParams.has('width'))url.searchParams.set('width',String(width));
    if(!url.searchParams.has('quality'))url.searchParams.set('quality','${SHOP_IMAGE_QUALITY}');
    return url.toString();
  }catch(e){return u;}
}`

function declaredImgWidth(tag: string): number {
  const match = tag.match(/\bwidth\s*=\s*["']?(\d+)/i)
  const n = match ? Number(match[1]) : 0
  return Number.isFinite(n) ? n : 0
}

/** Rewrite `<img src>` on the served page. Saved Sửa nhanh HTML stays untouched. */
export function rewriteShopHtmlImageDelivery(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bpw-logo\b|\bpw-chrome-chat-logo\b|\bpw-shop-footer-logo\b/i.test(tag)) return tag
    const srcMatch = tag.match(/\bsrc\s*=\s*(["'])([^"']+)\1/i)
    if (!srcMatch) return tag
    const declared = declaredImgWidth(tag)
    if (declared > 0 && declared < 280) return tag
    const edge = declared >= 280 ? Math.min(declared, 1600) : 800
    const next = tightenShopCdnImageUrl(srcMatch[2], edge)
    if (!next || next === srcMatch[2]) return tag
    return tag.replace(srcMatch[0], `src=${srcMatch[1]}${next}${srcMatch[1]}`)
  })
}
