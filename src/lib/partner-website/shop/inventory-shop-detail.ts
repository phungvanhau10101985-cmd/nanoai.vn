import { is1688ImageUrl, normalizeAlicdnImageUrl } from '@/lib/fetch-image-1688'
import { rewriteAllMessagingCdnUrls } from '@/lib/shop188-cdn-url'

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

/** Shop cards/PDP: `//cdn` → https, legacy `*.b-cdn.net` → custom host, cbu01 → img.alicdn. */
export function normalizeShopImageUrl(raw: string | null | undefined): string {
  const t = String(raw ?? '').trim()
  if (!t) return ''
  const withProto = t.startsWith('//') ? `https:${t}` : t
  const rewritten = normalizeAlicdnImageUrl(rewriteAllMessagingCdnUrls(withProto)).trim()
  return isHttpsUrl(rewritten) ? rewritten : ''
}

/**
 * `<img src>` for storefront cards. AliCDN/1688 often block hotlink when Referer is the shop —
 * same-origin proxy already used by chat (`/api/fetch-image`).
 */
export function shopCardDisplaySrc(raw: string | null | undefined): string {
  const url = normalizeShopImageUrl(raw)
  if (!url) return ''
  return is1688ImageUrl(url) ? `/api/fetch-image?url=${encodeURIComponent(url)}` : url
}

/** Injected catalog/outfit/personalize bootstrap — same rewrite as shopCardDisplaySrc. */
export const PW_SHOP_CARD_IMG_JS = `function shopImg(p){
  var raw=String((p&&(p.imageUrl||p.image_url))||(p&&p.galleryImages&&p.galleryImages[0])||'').trim();
  if(!raw)return '';
  if(raw.indexOf('//')===0)raw='https:'+raw;
  raw=raw.replace(/^https?:\\/\\/188comvn\\.b-cdn\\.net/i,'https://cdn.188.com.vn');
  try{
    var u=new URL(raw);
    var host=u.hostname.toLowerCase();
    if(/alicdn\\.com$/.test(host)||/1688\\.com$|alibaba\\.com$|taobao\\.com$|tmall\\.com$/.test(host)){
      if(host!=='img.alicdn.com'&&host!=='gw.alicdn.com'&&/\\.alicdn\\.com$/.test(host))u.hostname='img.alicdn.com';
      return '/api/fetch-image?url='+encodeURIComponent(u.toString());
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
  if (desc && !desc.startsWith('[')) return desc
  return (row.consult_note ?? '').trim()
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
