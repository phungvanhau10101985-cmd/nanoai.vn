import { colorImageUrlsForInventorySearch } from '@/lib/messaging/inventory-extra-image-urls'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
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
  /** PS.1 — ảnh phụ bổ sung (Product Studio / upload nhiều ảnh) — nối THÊM, không thay thế nguồn cũ. */
  gallery_urls?: string[] | null
  /** PS.1 — ảnh chi tiết/chất liệu do Product Studio sinh — nối THÊM vào ảnh chi tiết hiện có. */
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

/** Mô tả chi tiết PDP: mô tả HTML/text (pro_content) rồi chất liệu. */
export function inventoryShopDetailDescription(row: {
  description?: string | null
  material_note?: string | null
  consult_note?: string | null
}): string {
  const desc = (row.description ?? '').trim()
  const material = (row.material_note ?? '').trim()
  const parts: string[] = []
  if (desc && !desc.startsWith('[')) parts.push(desc)
  if (material && material !== desc) parts.push(material)
  if (parts.length) return parts.join('\n\n')
  return (row.consult_note ?? '').trim()
}

/** Gallery ảnh shop: ảnh chính → màu → ảnh chi tiết / thực tế. */
export function collectShopProductGalleryImages(row: InventoryShopSourceRow): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const url = normalizeShopImageUrl(raw)
    if (!url || seen.has(url)) return
    seen.add(url)
    out.push(url)
  }

  push(row.image_url ?? '')
  for (const c of row.colors_json ?? []) {
    push(String(c?.img ?? ''))
  }
  for (const c of parseColorVariantsJson(row.stock_note ?? '')) {
    push(c.img)
  }
  for (const url of colorImageUrlsForInventorySearch(
    row.image_url ?? '',
    row.material_detail_image_url ?? '',
    row.real_use_image_url ?? '',
    row.real_use_image_url_2 ?? ''
  )) {
    push(url)
  }
  // PS.1 — ảnh phụ Product Studio (studio slots hoặc upload nhiều ảnh thủ công), nối thêm cuối.
  for (const url of row.gallery_urls ?? []) push(url)
  for (const url of row.detail_image_urls ?? []) push(url)

  return out
}

/** Ảnh chi tiết / lifestyle (không gồm ảnh chính). */
export function collectShopProductDetailImages(row: InventoryShopSourceRow): string[] {
  const main = normalizeShopImageUrl(row.image_url ?? '')
  return collectShopProductGalleryImages(row).filter((url) => url !== main)
}

export function inventoryShopProductVideoUrl(row: { product_video_url?: string | null }): string | null {
  const url = (row.product_video_url ?? '').trim()
  return isHttpsUrl(url) ? url : null
}
