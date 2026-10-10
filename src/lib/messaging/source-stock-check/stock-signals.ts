/** Tín hiệu hết hàng trong vùng giá / toast — không đọc chân trang hay mô tả. */

export type StockZoneSnap = {
  zoneText: string
  risksOpen: boolean
  productImage: boolean
  title: string
  missingProduct: boolean
}

export const EMPTY_STOCK_ZONE: StockZoneSnap = {
  zoneText: '',
  risksOpen: false,
  productImage: false,
  title: '',
  missingProduct: false,
}

const OOS_NOTICE_RES: RegExp[] = [
  /\bout of stock\b/i,
  /\bsold\s*out\b/i,
  /\bno longer (?:available|for sale)\b/i,
  /\b(?:has been removed|been taken down|has been discontinued|item removed|product removed)\b/i,
  /\boff the shelf\b/i,
  /\b(?:item|product|goods)\b[^.\n]{0,48}\b(?:does not exist|do not exist|unavailable|not available)\b/i,
  /\b(?:cannot|can't) be purchased\b/i,
  /下架|缺货|无货|售罄|库存不足|宝贝不存在|商品不存在|已售完/,
  /hết hàng|het hang|ngừng bán|ngung ban|tạm hết|tam het|ngừng kinh doanh|ngung kinh doanh/i,
  /không tìm thấy thông tin sản phẩm/i,
]

export function visibleTextOutOfStockNotice(text: string): string | null {
  const blob = (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  if (!blob) return null
  for (const pat of OOS_NOTICE_RES) {
    const match = pat.exec(blob)
    if (match) return match[0].replace(/\s+/g, ' ').trim().slice(0, 180)
  }
  return null
}

export function noticeFromStockZone(zone: Partial<StockZoneSnap> | null | undefined): string | null {
  if (zone?.missingProduct) return 'Không tìm thấy thông tin sản phẩm'
  return visibleTextOutOfStockNotice(String(zone?.zoneText || ''))
}

export function productZoneLooksLoaded(zone: Partial<StockZoneSnap> | null | undefined): boolean {
  if (zone?.risksOpen) return false
  if (zone?.productImage) return true
  const title = String(zone?.title || '').replace(/\s+/g, ' ').trim()
  if (title.length < 8) return false
  const generic = title.toLowerCase()
  if (generic.startsWith('cssbuy') || generic.includes('panda') || generic.startsWith('vipo')) return false
  return true
}

export const STOCK_ZONE_JS = `() => {
  const textOf = (el) => ((el && (el.innerText || el.textContent)) || "").replace(/\\s+/g, " ").trim();
  const bits = [];
  const pushShort = (el) => {
    const t = textOf(el);
    if (t && t.length <= 120) bits.push(t);
  };
  document.querySelectorAll(
    ".el-message,.el-message-box,.el-notification,.ant-message,.ant-message-notice,.toast,[role='alert'],.swal2-popup"
  ).forEach(pushShort);
  const zone = document.querySelector(
    ".shop_right, .shop_info, .product-price, .main-price, .group-btn, .list-btn, .product-type-content"
  );
  if (zone) zone.querySelectorAll("span, p, div, button, label").forEach(pushShort);
  const risksOpen = Array.from(document.querySelectorAll("button, div, span, p")).some((el) => {
    return /^i accept the risks$/i.test(textOf(el)) && el.offsetParent !== null;
  });
  const productImage = Array.from(document.querySelectorAll("img")).some((img) =>
    /alicdn|cbu01|ibank/i.test(img.currentSrc || img.src || "")
  );
  const titleEl = document.querySelector("h1, .product-name, .product-title, .goods-name, .goods_name");
  const title = textOf(titleEl).slice(0, 180);
  const main = document.querySelector("main") || document.body;
  const missingProduct = /không tìm thấy thông tin sản phẩm/i.test(textOf(main).slice(0, 2500));
  return { zoneText: bits.join("\\n").slice(0, 4000), risksOpen, productImage, title, missingProduct };
}`
