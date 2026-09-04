import { is1688ImageUrl, normalizeAlicdnImageUrl } from '@/lib/fetch-image-1688'
import { rewriteAllMessagingCdnUrls } from '@/lib/shop188-cdn-url'
import { isPdpProductInfoJsonBlob } from '@/lib/partner-website/shop/pdp-product-info-html'

export type InventoryShopSourceRow = {
  image_url?: string | null
  stock_note?: string | null
  material_note?: string | null
  consult_note?: string | null
  material_detail_image_url?: string | null
  real_use_image_url?: string | null
  real_use_image_url_2?: string | null
  product_video_url?: string | null
  /** Cột P / `gallery_images` — thư viện carousel PDP (không gồm ảnh chi tiết cột Q). */
  gallery_urls?: string[] | null
  /** Cột Q / `detail_images` — ảnh mô tả dưới PDP, full-width. */
  detail_image_urls?: string[] | null
  colors_json?: Array<{ name?: string; img?: string }> | null
}

function isHttpsUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
}

/** 188 `hasValidProductImageUrl` — bỏ placeholder / domain trống trước khi lấy ảnh đại diện. */
export function hasValidShopCardImageUrl(url: string | null | undefined): boolean {
  const raw = String(url ?? '').trim()
  if (!raw) return false
  const lower = raw.toLowerCase()
  if (['null', 'none', 'nan', 'undefined', 'n/a', '-', '0'].includes(lower)) return false
  if (/^(?:https?:\/\/)?(?:www\.)?188\.com\.vn\/?$/i.test(raw)) return false
  if (lower.startsWith('data:image')) return raw.length > 16
  if (raw.startsWith('/api/fetch-image')) return raw.length > 20
  if (raw.startsWith('//')) return raw.length > 4 && raw.includes('.')
  if (raw.startsWith('/')) return raw.length > 2
  return isHttpsUrl(raw.startsWith('//') ? `https:${raw}` : raw)
}

/**
 * 188 `getProductMainImage` — `main_image` rồi gallery/`images`.
 * Shop row: `image_url` ← `catalog_json.main_image`, rồi cột P.
 */
export function pickShopCardImageRaw(input: {
  imageUrl?: string | null
  image_url?: string | null
  main_image?: string | null
  mainImage?: string | null
  galleryImages?: string[] | null
  images?: string[] | null
  gallery?: string[] | null
} | null | undefined): string {
  const first = (arr?: string[] | null) => {
    if (!Array.isArray(arr)) return ''
    for (const item of arr) {
      const value = String(item ?? '').trim()
      if (hasValidShopCardImageUrl(value)) return value
    }
    return ''
  }
  const candidates = [
    input?.imageUrl,
    input?.image_url,
    input?.main_image,
    input?.mainImage,
    first(input?.galleryImages),
    first(input?.images),
    first(input?.gallery),
  ]
  for (const raw of candidates) {
    const value = String(raw ?? '').trim()
    if (hasValidShopCardImageUrl(value)) return value
  }
  return ''
}

/** Shop cards/PDP: `//cdn` → https, legacy `*.b-cdn.net` → custom host, cbu01 → img.alicdn. */
export function normalizeShopImageUrl(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t || !hasValidShopCardImageUrl(t)) return ''
  const withProto = t.startsWith('//') ? `https:${t}` : t
  const rewritten = normalizeAlicdnImageUrl(rewriteAllMessagingCdnUrls(withProto)).trim()
  if (rewritten.startsWith('/api/fetch-image') || rewritten.startsWith('/')) return rewritten
  return isHttpsUrl(rewritten) ? rewritten : ''
}

const ALICDN_HOST_RE = /alicdn\.com|alicdn\.net|tbcdn\.cn/i
const ALICDN_SIZE_SUFFIX_RE = /_\d+x\d+(?:q\d+)?\.jpg$/i

function unwrapShopFetchImageUrl(src: string): { proxied: boolean; inner: string } {
  const t = String(src || '').trim()
  if (!t.startsWith('/api/fetch-image')) return { proxied: false, inner: t }
  try {
    const inner = decodeURIComponent(new URL(t, 'https://local.invalid').searchParams.get('url') || '')
    return { proxied: true, inner: inner || t }
  } catch {
    return { proxied: true, inner: t }
  }
}

function alicdnJpgBase(url: string): string {
  let base = String(url || '').trim()
  const jpg = /\.jpg/i.exec(base)
  if (jpg) base = base.slice(0, jpg.index + 4)
  return base.replace(/\.webp\.jpg$/i, '.webp').replace(/\.png\.jpg$/i, '.png').replace(ALICDN_SIZE_SUFFIX_RE, '')
}

function applyShopAlicdnSize(url: string, suffix: string): string {
  const raw = String(url || '').trim()
  if (!raw || !ALICDN_HOST_RE.test(raw)) return raw
  if (/gw\.alicdn\.com\/mt\//i.test(raw)) return raw
  return `${alicdnJpgBase(raw)}${suffix}`
}

/** 188 listing card: `{base}.jpg_600x600q90.jpg` trên AliCDN. */
export function applyShopAlicdnCardSize(url: string): string {
  return applyShopAlicdnSize(url, '_600x600q90.jpg')
}

/** PDP trên trang: `_1200x1200.jpg` (không `q90` — suffix đó hay 404). */
export function applyShopAlicdnPageSize(url: string): string {
  return applyShopAlicdnSize(url, '_1200x1200.jpg')
}

/** So URL cùng một ảnh dù đã gắn cỡ / proxy. */
export function shopPdpImageKey(raw: string | null | undefined): string {
  const { inner } = unwrapShopFetchImageUrl(String(raw || '').trim())
  return inner.replace(ALICDN_SIZE_SUFFIX_RE, '').replace(/[?#].*$/, '').toLowerCase()
}

function displayShopImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('/')) return url
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host === 'img.alicdn.com' || host === 'gw.alicdn.com') return url
    if (is1688ImageUrl(url)) return `/api/fetch-image?url=${encodeURIComponent(url)}`
  } catch {
    /* keep url */
  }
  return url
}

/**
 * `<img src>` thẻ shop — đọc/hiện giống 188 `getProductMainImage`:
 * `img.alicdn.com` + `_600x600q90.jpg` trực tiếp; chỉ proxy host phụ / 1688.
 */
export function shopCardDisplaySrc(raw: string | null | undefined): string {
  const url = normalizeShopImageUrl(raw)
  if (!url) return ''
  if (url.startsWith('/')) return url
  const display = applyShopAlicdnCardSize(url)
  try {
    const host = new URL(display).hostname.toLowerCase()
    if (host === 'img.alicdn.com' || host === 'gw.alicdn.com') return display
    if (is1688ImageUrl(display)) return `/api/fetch-image?url=${encodeURIComponent(display)}`
  } catch {
    /* keep display */
  }
  return display
}

/** PDP / lightbox / Thử đồ — URL gốc, không ép `_600x600q90` (suffix đó hay 404 trên AliCDN). */
export function shopPdpDisplaySrc(raw: string | null | undefined): string {
  const url = normalizeShopImageUrl(raw).replace(ALICDN_SIZE_SUFFIX_RE, '')
  if (!url) return ''
  return displayShopImageUrl(url)
}

/** Ảnh hiện trên PDP: AliCDN `_1200x1200.jpg` vừa khung; gốc giữ ở `data-pw-full-src`. */
export function shopPdpPageSrc(raw: string | null | undefined): string {
  const url = normalizeShopImageUrl(raw)
  if (!url) return ''
  if (url.startsWith('/api/fetch-image')) {
    const { inner } = unwrapShopFetchImageUrl(url)
    const page = applyShopAlicdnPageSize(inner)
    if (page && page !== inner) return `/api/fetch-image?url=${encodeURIComponent(page)}`
    return url
  }
  if (url.startsWith('/')) return url
  return displayShopImageUrl(applyShopAlicdnPageSize(url))
}

/** Bước thử lại khi `<img>` lỗi: bỏ cỡ trang/thẻ, rồi proxy 1688/AliCDN. Hết thì ẩn. */
export function nextShopImageRetrySrc(currentSrc: string): string | null {
  const src = String(currentSrc || '').trim()
  if (!src) return null
  if (src.startsWith('/api/fetch-image')) {
    const { inner } = unwrapShopFetchImageUrl(src)
    if (ALICDN_SIZE_SUFFIX_RE.test(inner)) {
      const orig = inner.replace(ALICDN_SIZE_SUFFIX_RE, '')
      return orig ? `/api/fetch-image?url=${encodeURIComponent(orig)}` : null
    }
    return null
  }
  if (ALICDN_SIZE_SUFFIX_RE.test(src)) return src.replace(ALICDN_SIZE_SUFFIX_RE, '')
  if (/alicdn\.com|1688\.com|alibaba\.com/i.test(src)) {
    return `/api/fetch-image?url=${encodeURIComponent(src)}`
  }
  return null
}

/** Gắn `src` cỡ trang + `data-pw-full-src` gốc + lazy cho HTML mô tả / cột Q. */
export function rewritePdpHtmlImagesForPage(html: string): string {
  if (!html || !/<img\b/i.test(html)) return html
  return html.replace(/<img\b([^>]*)\/?>/gi, (_full, attrs: string) => {
    const srcMatch = attrs.match(/(?:^|\s)src=(["'])([^"']*)\1/i)
    const src = srcMatch?.[2] || ''
    let next = attrs
    if (src && !src.startsWith('data:')) {
      const fullSrc = shopPdpDisplaySrc(src) || src
      const pageSrc = shopPdpPageSrc(src) || src
      next = next.replace(/(?:^|\s)src=(["'])[^"']*\1/i, ` src="${pageSrc.replace(/"/g, '&quot;')}"`)
      if (!/\bdata-pw-full-src=/.test(next) && fullSrc) {
        next += ` data-pw-full-src="${fullSrc.replace(/"/g, '&quot;')}"`
      }
    }
    if (!/\bloading=/.test(next)) next += ' loading="lazy"'
    if (!/\bdecoding=/.test(next)) next += ' decoding="async"'
    return `<img${next}>`
  })
}

export const PW_SHOP_PDP_PAGE_SRC_JS = `function shopPdpOrigSrc(raw){
  var u=String(raw||'').trim();
  if(!u)return '';
  if(u.indexOf('/api/fetch-image')===0){
    try{
      var inner=decodeURIComponent((u.split('url=')[1]||'').split('&')[0]||'');
      inner=inner.replace(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i,'');
      return inner?('/api/fetch-image?url='+encodeURIComponent(inner)):u;
    }catch(e){return u;}
  }
  return u.replace(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i,'');
}
function shopPdpPageSrc(raw){
  var u=String(raw||'').trim();
  if(!u)return '';
  if(u.charAt(0)==='/'&&u.indexOf('/api/fetch-image')!==0)return u;
  var inner=u;
  var proxied=u.indexOf('/api/fetch-image')===0;
  if(proxied){
    try{inner=decodeURIComponent((u.split('url=')[1]||'').split('&')[0]||'');}catch(e){return u;}
  }
  if(inner.indexOf('//')===0)inner='https:'+inner;
  try{
    var host=new URL(inner).hostname.toLowerCase();
    if(/alicdn\\.com$|alicdn\\.net$|tbcdn\\.cn$/.test(host)&&inner.indexOf('gw.alicdn.com/mt/')<0){
      var base=inner;
      var j=base.search(/\\.jpg/i);
      if(j>=0)base=base.slice(0,j+4);
      base=base.replace(/\\.webp\\.jpg$/i,'.webp').replace(/\\.png\\.jpg$/i,'.png');
      base=base.replace(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i,'');
      var page=base+'_1200x1200.jpg';
      if(proxied||(host!=='img.alicdn.com'&&host!=='gw.alicdn.com'))return '/api/fetch-image?url='+encodeURIComponent(page);
      return page;
    }
  }catch(e){}
  return u;
}
function pdpImgFullSrc(el){
  return (el&&(el.getAttribute('data-pw-full-src')||el.getAttribute('src')))||'';
}
function rewriteDescImgs(root){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll('img').forEach(function(img){
    var src=img.getAttribute('src')||'';
    if(!src)return;
    var full=shopPdpOrigSrc(src);
    var page=shopPdpPageSrc(src);
    if(full&&!img.getAttribute('data-pw-full-src'))img.setAttribute('data-pw-full-src',full);
    if(page)img.setAttribute('src',page);
    if(!img.getAttribute('loading'))img.setAttribute('loading','lazy');
    if(!img.getAttribute('decoding'))img.setAttribute('decoding','async');
  });
}
function galleryFaceVisible(el){
  var host=el.closest?el.closest('.pw-pdp-hero,.pw-pdp-gallery-desktop,[data-pw-region="gallery"]'):el;
  if(el.getAttribute('data-pw-deferred-src')&&!el.getAttribute('src'))return false;
  try{
    var cs=window.getComputedStyle(host||el);
    if(cs&&(cs.display==='none'||cs.visibility==='hidden'))return false;
  }catch(e){}
  return true;
}`

export const PW_SHOP_HIDE_BROKEN_PDP_IMGS_JS = `function nextShopImageRetrySrc(src){
  src=String(src||'').trim();
  if(!src)return '';
  if(src.indexOf('/api/fetch-image')===0){
    try{
      var inner=decodeURIComponent((src.split('url=')[1]||'').split('&')[0]||'');
      if(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i.test(inner)){
        return '/api/fetch-image?url='+encodeURIComponent(inner.replace(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i,''));
      }
    }catch(e){}
    return '';
  }
  if(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i.test(src))return src.replace(/_\\d+x\\d+(?:q\\d+)?\\.jpg$/i,'');
  if(/alicdn\\.com|1688\\.com|alibaba\\.com/i.test(src)){
    return '/api/fetch-image?url='+encodeURIComponent(src);
  }
  return '';
}
function hideBrokenPdpImgs(root){
  var scope=root||document;
  var imgs=scope.querySelectorAll('[data-pw-region="gallery"] img,img[data-pw-el="main-image"],[data-pw-pdp-slot="detail-images"] img,[data-pw-pdp-slot="material"] img,[data-pw-pdp-slot="real-use"] img,[data-pw-pdp-slot="size-guide"] img,[data-pw-pdp-option="color"] img,[data-pw-variant-modal] img,.pw-pdp-detail-photos img,.pw-shop-detail-grid img,.pw-shop-product-detail-body img');
  for(var i=0;i<imgs.length;i++){
    (function(imgEl){
      if(imgEl.getAttribute('data-pw-pdp-img-watch')==='1')return;
      imgEl.setAttribute('data-pw-pdp-img-watch','1');
      function hide(){
        imgEl.setAttribute('data-pw-pdp-img-broken','1');
        imgEl.hidden=true;
        imgEl.style.display='none';
        var thumb=imgEl.closest('[data-pw-el="thumb"],.pw-shop-product-thumb,.pw-pdp-hero-thumbs button,.pw-pdp-color');
        if(thumb){thumb.setAttribute('data-pw-pdp-img-broken','1');thumb.hidden=true;thumb.style.display='none';}
        var slot=imgEl.closest('[data-pw-pdp-slot="detail-images"],[data-pw-pdp-slot="material"],[data-pw-pdp-slot="real-use"],[data-pw-pdp-slot="size-guide"]');
        if(slot&&!slot.querySelector('img:not([data-pw-pdp-img-broken])'))slot.setAttribute('data-pw-pdp-img-broken','1');
      }
      function retryOrHide(){
        if(imgEl.getAttribute('data-pw-pdp-img-broken')==='1')return;
        var next=nextShopImageRetrySrc(imgEl.getAttribute('src')||imgEl.currentSrc||'');
        if(next&&imgEl.getAttribute('data-pw-img-retry')!=='1'){
          imgEl.setAttribute('data-pw-img-retry','1');
          imgEl.setAttribute('src',next);
          return;
        }
        hide();
      }
      imgEl.addEventListener('error',retryOrHide);
      if(imgEl.complete&&imgEl.naturalWidth===0&&(imgEl.currentSrc||imgEl.getAttribute('src')))retryOrHide();
    })(imgs[i]);
  }
}`

/** Injected catalog/outfit/personalize bootstrap — same rewrite as shopCardDisplaySrc. */
export const PW_SHOP_CARD_IMG_JS = `function shopImg(p){
  function first(arr){
    if(!arr||!arr.length)return '';
    for(var i=0;i<arr.length;i++){var x=String(arr[i]||'').trim();if(x&&x!=='0'&&x!=='-'&&x.toLowerCase()!=='null')return x;}
    return '';
  }
  var raw=String((p&&(p.imageUrl||p.image_url||p.main_image||p.mainImage))||first(p&&p.galleryImages)||first(p&&p.images)||first(p&&p.gallery)||'').trim();
  if(!raw||raw==='0'||raw==='-'||raw.toLowerCase()==='null')return '';
  if(raw.charAt(0)==='/')return raw;
  if(raw.indexOf('//')===0)raw='https:'+raw;
  raw=raw.replace(/^https?:\\/\\/188comvn\\.b-cdn\\.net/i,'https://cdn.188.com.vn');
  try{
    var u=new URL(raw);
    var host=u.hostname.toLowerCase();
    if(host!=='img.alicdn.com'&&host!=='gw.alicdn.com'&&/\\.alicdn\\.com$/.test(host)){u.hostname='img.alicdn.com';raw=u.toString();host='img.alicdn.com';}
    if(/alicdn\\.com$|alicdn\\.net$|tbcdn\\.cn$/.test(host)&&raw.indexOf('gw.alicdn.com/mt/')<0){
      var m=/\\.jpg/i.exec(raw);
      if(m) raw=raw.slice(0,m.index+4);
      raw=raw.replace(/_\\d+x\\d+q\\d+\\.jpg$/i,'');
      if(!/_600x600q90\\.jpg$/i.test(raw)) raw=raw+'_600x600q90.jpg';
    }
    if(host==='img.alicdn.com'||host==='gw.alicdn.com')return raw;
    if(/alicdn\\.com$|1688\\.com$|alibaba\\.com$|taobao\\.com$|tmall\\.com$/.test(host)){
      return '/api/fetch-image?url='+encodeURIComponent(raw);
    }
  }catch(e){}
  return raw;
}`

/** Mô tả PDP — cột F `pro_content` giống 188. Chất liệu hiện ở lưới thông số, không nhét vào mô tả. */
export function inventoryShopDetailDescription(row: {
  description?: string | null
  material_note?: string | null
  consult_note?: string | null
}): string {
  const desc = (row.description ?? '').trim()
  if (desc && !desc.startsWith('[') && !isPdpProductInfoJsonBlob(desc)) return desc
  const consult = (row.consult_note ?? '').trim()
  if (!consult || isPdpProductInfoJsonBlob(consult)) return ''
  return consult
}

function pushShopImageUrl(out: string[], seen: Set<string>, raw: string): void {
  const url = normalizeShopImageUrl(raw)
  if (!url || seen.has(url)) return
  seen.add(url)
  out.push(url)
}

/**
 * Thư viện ảnh PDP — giống 188 `mergeProductGalleryPhotoUrls`:
 * ảnh chính + cột P (`gallery_urls`). Không gộp cột Q / màu / thực tế vào carousel.
 */
export function collectShopProductGalleryImages(row: InventoryShopSourceRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  pushShopImageUrl(out, seen, row.image_url ?? '')
  for (const url of row.gallery_urls ?? []) pushShopImageUrl(out, seen, url)
  return out
}

/** Ảnh chi tiết PDP — giống 188 `product.gallery` (cột Q `detail_images`). */
export function collectShopProductDetailImages(row: InventoryShopSourceRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const url of row.detail_image_urls ?? []) pushShopImageUrl(out, seen, url)
  return out
}

/** Ảnh thực tế / chất liệu — ô riêng dưới mô tả, không nhét vào carousel. */
export function collectShopProductRealUseImages(row: InventoryShopSourceRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  pushShopImageUrl(out, seen, row.real_use_image_url ?? '')
  pushShopImageUrl(out, seen, row.real_use_image_url_2 ?? '')
  return out
}

export function collectShopProductMaterialImageUrl(row: InventoryShopSourceRow): string | null {
  return normalizeShopImageUrl(row.material_detail_image_url ?? '') || null
}

export function inventoryShopProductVideoUrl(row: { product_video_url?: string | null }): string | null {
  const url = (row.product_video_url ?? '').trim()
  return isHttpsUrl(url) ? url : null
}
