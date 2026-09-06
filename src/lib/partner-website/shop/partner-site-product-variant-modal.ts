import type { WebLocale } from '@/lib/i18n/config'

/** Copy khớp modal chọn biến thể 188 `ProductVariantModal` — đủ 5 locale shop. */
export type ProductVariantModalCopy = {
  title: string
  sku: string
  skuShort: string
  color: string
  size: string
  qty: string
  lineTotal: string
  stockLeft: string
  stockLeftShort: string
  outOfStock: string
  add: string
  buy: string
  close: string
  sizeGuide: string
}

export const PRODUCT_VARIANT_MODAL_COPY: Record<WebLocale, ProductVariantModalCopy> = {
  vi: {
    title: 'Chọn biến thể sản phẩm',
    sku: 'Mã sp: {sku}',
    skuShort: 'Mã: {sku}',
    color: 'Màu',
    size: 'Size',
    qty: 'Số lượng (hàng order)',
    lineTotal: 'Tổng tiền ({n} sp):',
    stockLeft: 'Còn {n} sản phẩm — Sắp hết hàng',
    stockLeftShort: 'Còn {n}',
    outOfStock: 'Hết hàng',
    add: 'Thêm vào Giỏ hàng',
    buy: 'Mua hàng',
    close: 'Đóng',
    sizeGuide: 'Hướng dẫn chọn kích cỡ >',
  },
  en: {
    title: 'Choose product options',
    sku: 'SKU: {sku}',
    skuShort: 'SKU: {sku}',
    color: 'Color',
    size: 'Size',
    qty: 'Quantity',
    lineTotal: 'Total ({n} items):',
    stockLeft: '{n} left — selling fast',
    stockLeftShort: '{n} left',
    outOfStock: 'Out of stock',
    add: 'Add to cart',
    buy: 'Buy now',
    close: 'Close',
    sizeGuide: 'Size guide >',
  },
  zh: {
    title: '选择商品规格',
    sku: '货号: {sku}',
    skuShort: '货号: {sku}',
    color: '颜色',
    size: '尺码',
    qty: '数量',
    lineTotal: '合计（{n} 件）：',
    stockLeft: '仅剩 {n} 件 — 即将售罄',
    stockLeftShort: '剩 {n}',
    outOfStock: '缺货',
    add: '加入购物车',
    buy: '立即购买',
    close: '关闭',
    sizeGuide: '尺码指南 >',
  },
  ja: {
    title: 'バリエーションを選ぶ',
    sku: '品番: {sku}',
    skuShort: '品番: {sku}',
    color: 'カラー',
    size: 'サイズ',
    qty: '数量',
    lineTotal: '合計（{n}点）:',
    stockLeft: '残り{n}点 — 残りわずか',
    stockLeftShort: '残り{n}',
    outOfStock: '在庫切れ',
    add: 'カートに追加',
    buy: '購入する',
    close: '閉じる',
    sizeGuide: 'サイズガイド >',
  },
  ko: {
    title: '옵션 선택',
    sku: '상품코드: {sku}',
    skuShort: '코드: {sku}',
    color: '색상',
    size: '사이즈',
    qty: '수량',
    lineTotal: '합계 ({n}개):',
    stockLeft: '{n}개 남음 — 마감 임박',
    stockLeftShort: '{n}개 남음',
    outOfStock: '품절',
    add: '장바구니 담기',
    buy: '구매하기',
    close: '닫기',
    sizeGuide: '사이즈 가이드 >',
  },
}

const LOW_STOCK_URGENCY_THRESHOLD = 5

export function variantModalMaxQty(stockQty: number | null | undefined): number {
  const n = Math.max(0, Math.round(Number(stockQty) || 0))
  if (n <= 0) return 99
  return Math.min(99, n)
}

export function variantModalShowsLowStock(stockQty: number | null | undefined): boolean {
  const n = Math.max(0, Math.round(Number(stockQty) || 0))
  return n >= 1 && n <= LOW_STOCK_URGENCY_THRESHOLD
}

export function resolveVariantModalFace(input?: {
  editDevice?: string | null
  sceneLock?: string | null
  queryDevice?: string | null
  viewportMinMd?: boolean
}): 'wide' | 'compact' {
  const lock = String(input?.editDevice || input?.sceneLock || input?.queryDevice || '')
    .trim()
    .toLowerCase()
  if (lock === 'mobile') return 'compact'
  if (lock === 'tablet' || lock === 'laptop' || lock === 'desktop') return 'wide'
  return input?.viewportMinMd ? 'wide' : 'compact'
}

/**
 * Modal chọn màu/size/SL — 188 ProductVariantModal:
 * mobile sheet đáy + ảnh nhỏ; ≥768 / máy tablet+ = 2 cột ảnh lớn.
 * Giá / chọn / nút mua dùng `--pw-buy` `--pw-cart`, không hex cam.
 */
export const PW_PRODUCT_VARIANT_MODAL_CSS = `
[data-pw-variant-modal]{position:fixed;inset:0;z-index:100040;display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box;pointer-events:none}
[data-pw-variant-modal][hidden]{display:none!important}
[data-pw-variant-backdrop]{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,.5);pointer-events:auto}
[data-pw-variant-card]{position:relative;z-index:1;width:100%;max-width:48rem;max-height:85vh;overflow:auto;border-radius:16px 16px 0 0;background:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);pointer-events:auto;touch-action:manipulation}
[data-pw-variant-head]{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;height:32px;background:#fff;border-bottom:1px solid #f3f4f6}
[data-pw-variant-close]{width:32px;height:32px;border:0;border-radius:999px;background:transparent;color:#4b5563;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
[data-pw-variant-close]:hover{background:#f3f4f6}
[data-pw-variant-close] svg{width:20px;height:20px}
[data-pw-variant-body]{padding:16px 16px 8px}
[data-pw-variant-wide],[data-pw-variant-compact]{display:none}
[data-pw-variant-modal][data-pw-variant-face="wide"] [data-pw-variant-wide]{display:flex;gap:16px;align-items:flex-start;margin-bottom:12px}
[data-pw-variant-modal][data-pw-variant-face="compact"] [data-pw-variant-compact]{display:block;margin-bottom:8px}
[data-pw-variant-hero]{flex:0 0 50%;width:50%;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb}
[data-pw-variant-hero] img{width:100%;height:100%;object-fit:contain;display:block}
[data-pw-variant-info]{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
[data-pw-variant-sku]{margin:0;font:400 11px/1.35 system-ui,sans-serif;color:#6b7280}
[data-pw-variant-name]{margin:0;font:500 14px/1.25 system-ui,sans-serif;color:#111827;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
[data-pw-variant-price]{margin:4px 0 0;font:800 24px/1.2 system-ui,sans-serif;color:var(--pw-buy)}
[data-pw-variant-sale]{display:flex;flex-direction:column;gap:6px;margin:6px 0 2px}
[data-pw-variant-sale-pill]{display:inline-flex;align-items:center;gap:6px;width:fit-content;padding:4px 10px;border-radius:999px;color:#fff;font:700 11px/1.2 system-ui,sans-serif}
[data-pw-variant-sale][data-pw-sale-phase="teaser"] [data-pw-variant-sale-pill]{background:#d97706}
[data-pw-variant-sale][data-pw-sale-phase="active"] [data-pw-variant-sale-pill]{background:#dc2626}
[data-pw-variant-sale-count]{display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:8px;font:600 12px/1.35 system-ui,sans-serif}
[data-pw-variant-sale][data-pw-sale-phase="teaser"] [data-pw-variant-sale-count]{border:1px solid #fde68a;background:#fffbeb;color:#78350f}
[data-pw-variant-sale][data-pw-sale-phase="active"] [data-pw-variant-sale-count]{border:1px solid #fecaca;background:#fef2f2;color:#7f1d1d}
[data-pw-variant-price-label]{margin:0;font:600 11px/1.2 system-ui,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.04em}
[data-pw-variant-price-row]{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 8px}
[data-pw-variant-expected],[data-pw-variant-save-chip]{display:inline-flex;align-items:baseline;gap:4px;border-radius:999px;padding:4px 8px;font:600 11px/1.2 system-ui,sans-serif}
[data-pw-variant-expected]{border:1px solid #a7f3d0;background:#ecfdf5;color:#065f46}
[data-pw-variant-save-chip]{background:#fff;color:#92400e;box-shadow:inset 0 0 0 1px #fde68a}
[data-pw-variant-sale][data-pw-sale-phase="active"] [data-pw-variant-save-chip]{color:#047857;box-shadow:inset 0 0 0 1px #a7f3d0}
[data-pw-variant-compare]{font:600 12px/1.2 system-ui,sans-serif;color:#6b7280;text-decoration:line-through}
[data-pw-variant-pct]{border-radius:4px;background:#ef4444;color:#fff;font:700 11px/1.2 system-ui,sans-serif;padding:2px 6px}
[data-pw-variant-total-save]{display:block;margin-top:2px;font:600 11px/1.3 system-ui,sans-serif;color:#059669;text-align:right}
[data-pw-variant-stock]{margin:4px 0 0;font:400 11px/1.35 system-ui,sans-serif;color:#b45309;display:flex;align-items:center;gap:4px}
[data-pw-variant-stock][hidden]{display:none!important}
[data-pw-variant-stock-icon]{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;background:#fef3c7;color:#d97706;font-size:10px;flex-shrink:0}
[data-pw-variant-section]{margin-top:8px}
[data-pw-variant-label]{margin:0 0 6px;font:600 12px/1.3 system-ui,sans-serif;color:#111827;text-transform:uppercase}
[data-pw-variant-size-row]{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
[data-pw-variant-size-row] [data-pw-variant-label]{margin:0}
[data-pw-variant-size-guide]{border:0;background:none;padding:0;cursor:pointer;font:500 11px/1.3 system-ui,sans-serif;color:var(--pw-buy);text-decoration:none}
[data-pw-variant-chips]{display:flex;flex-wrap:wrap;gap:6px}
[data-pw-variant-color]{display:flex;min-height:44px;align-items:center;gap:6px;border:2px solid #e5e7eb;border-radius:12px;padding:6px;background:#fff;cursor:pointer;touch-action:manipulation}
[data-pw-variant-color]:hover{border-color:#d1d5db}
[data-pw-variant-color][aria-pressed="true"]{border-color:var(--pw-buy);background:var(--pw-surface,#fff7ed)}
[data-pw-variant-swatch]{width:32px;height:32px;border-radius:8px;overflow:hidden;flex-shrink:0;border:1px solid #e5e7eb;background:#e5e7eb}
[data-pw-variant-swatch] img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
[data-pw-variant-color-name]{font:500 12px/1.2 system-ui,sans-serif;color:#111827;text-transform:uppercase;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pw-variant-size]{min-width:40px;padding:6px 10px;border:2px solid #d1d5db;border-radius:8px;background:#fff;font:500 12px/1.2 system-ui,sans-serif;color:#374151;cursor:pointer}
[data-pw-variant-size]:hover{border-color:#9ca3af}
[data-pw-variant-size][aria-pressed="true"]{border-color:var(--pw-buy);background:var(--pw-surface,#fff7ed);color:#c2410c}
[data-pw-variant-stepper]{display:flex;align-items:center;gap:10px}
[data-pw-variant-step]{width:36px;height:36px;border:2px solid #d1d5db;border-radius:8px;background:#fff;color:#4b5563;font:500 16px/1 system-ui,sans-serif;cursor:pointer}
[data-pw-variant-step]:hover{background:#f9fafb}
[data-pw-variant-step]:disabled{opacity:.5;cursor:not-allowed}
[data-pw-variant-qty]{width:40px;text-align:center;font:600 16px/1.2 system-ui,sans-serif;color:#111827}
[data-pw-variant-total]{display:flex;align-items:baseline;justify-content:space-between;border:1px solid #f3f4f6;background:#f9fafb;border-radius:8px;padding:8px 12px;margin-top:10px}
[data-pw-variant-total-label]{font:600 12px/1.3 system-ui,sans-serif;color:#111827}
[data-pw-variant-total-price]{display:flex;flex-direction:column;align-items:flex-end;font:700 18px/1.2 system-ui,sans-serif;color:var(--pw-buy)}
[data-pw-variant-foot]{position:sticky;bottom:0;z-index:2;background:#fff;border-top:1px solid #e5e7eb;padding:12px;display:flex;flex-direction:row;gap:8px}
[data-pw-variant-add],[data-pw-variant-buy]{flex:1;display:inline-flex;align-items:center;justify-content:center;padding:14px 12px;border:0;border-radius:12px;font:600 14px/1.2 system-ui,sans-serif;color:#fff;cursor:pointer}
[data-pw-variant-add]{background:var(--pw-cart,#6b7280)}
[data-pw-variant-buy]{background:var(--pw-buy)}
[data-pw-variant-add]:hover,[data-pw-variant-buy]:hover{filter:brightness(.92)}
[data-pw-variant-add]:disabled,[data-pw-variant-buy]:disabled{opacity:.55;cursor:not-allowed;filter:none}
[data-pw-variant-compact-top]{display:flex;gap:12px;margin-bottom:12px}
[data-pw-variant-thumb]{width:96px;height:96px;flex-shrink:0;border-radius:8px;overflow:hidden;background:#f3f4f6;border:1px solid #e5e7eb}
[data-pw-variant-thumb] img{width:100%;height:100%;object-fit:cover;display:block}
[data-pw-variant-compact] [data-pw-variant-sku]{font-size:10px;margin-bottom:2px}
[data-pw-variant-compact] [data-pw-variant-name]{margin-bottom:4px}
[data-pw-variant-compact] [data-pw-variant-price]{font-size:20px}
[data-pw-variant-compact] [data-pw-variant-sale]{gap:4px;margin:4px 0 0}
[data-pw-variant-compact] [data-pw-variant-sale-pill]{font-size:10px;padding:3px 8px}
[data-pw-variant-compact] [data-pw-variant-sale-count]{font-size:11px;padding:6px 8px}
[data-pw-variant-compact] [data-pw-variant-price-label]{font-size:10px}
[data-pw-variant-compact] [data-pw-variant-expected],[data-pw-variant-compact] [data-pw-variant-save-chip]{font-size:10px;padding:3px 6px}
[data-pw-variant-compact] [data-pw-variant-stock]{font-size:10px}
[data-pw-variant-compact] [data-pw-variant-stock-icon]{width:14px;height:14px}
[data-pw-variant-compact] [data-pw-variant-label]{font-size:11px}
[data-pw-variant-compact] [data-pw-variant-color]{min-width:44px;border-radius:8px;padding:4px 8px 4px 4px}
[data-pw-variant-compact] [data-pw-variant-swatch]{width:36px;height:36px;border-radius:4px}
[data-pw-variant-compact] [data-pw-variant-color-name]{font-size:11px;max-width:80px}
[data-pw-variant-compact] [data-pw-variant-size]{min-width:32px;padding:4px 8px;border-width:1px;border-radius:6px;font-size:11px}
[data-pw-variant-compact] [data-pw-variant-size][aria-pressed="true"]{box-shadow:0 0 0 1px var(--pw-buy)}
[data-pw-variant-compact] [data-pw-variant-color][aria-pressed="true"]{box-shadow:0 0 0 1px var(--pw-buy)}
[data-pw-variant-compact-step]{display:inline-flex;align-items:center;border:1px solid #d1d5db;border-radius:8px;overflow:hidden}
[data-pw-variant-compact-step] [data-pw-variant-step]{width:32px;height:32px;border:0;border-radius:0}
[data-pw-variant-compact-step] [data-pw-variant-qty]{width:32px;height:32px;display:flex;align-items:center;justify-content:center;border-left:1px solid #d1d5db;border-right:1px solid #d1d5db;background:#f9fafb;font-size:14px}
[data-pw-variant-compact] [data-pw-variant-total]{margin-top:8px}
[data-pw-variant-compact] [data-pw-variant-total-label]{font-size:11px}
[data-pw-variant-compact] [data-pw-variant-total-price]{font-size:16px}
[data-pw-variant-remain]{font:400 10px/1.3 system-ui,sans-serif;color:#6b7280;margin-left:8px}
@media (min-width:640px){
  [data-pw-variant-modal]{align-items:center;padding:16px}
  [data-pw-variant-card]{border-radius:16px}
}
@media (min-width:768px){
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-variant-modal]:not([data-pw-variant-face]) [data-pw-variant-wide]{display:flex;gap:16px;align-items:flex-start;margin-bottom:12px}
  html:not([data-pw-edit-device]):not([data-pw-scene-lock]) [data-pw-variant-modal]:not([data-pw-variant-face]) [data-pw-variant-compact]{display:none}
}
`

/** Runtime HTML shop — gọi `openPdpVariantModal(seed, action)` trước khi thêm giỏ trên PDP. */
export const PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS = `
function variantModalFace(){
  var html=document.documentElement;
  var q='';
  try{q=new URLSearchParams(location.search).get('pw-device')||'';}catch(e){}
  var lock=String(html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||q||'').toLowerCase();
  if(lock==='mobile')return 'compact';
  if(lock==='tablet'||lock==='laptop'||lock==='desktop')return 'wide';
  try{return window.matchMedia('(min-width:768px)').matches?'wide':'compact';}catch(e2){return 'compact';}
}
function variantEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function variantMoney(n,fallback){
  var amt=Number(n);
  if(Number.isFinite(amt)&&amt>0){
    try{return new Intl.NumberFormat('vi-VN').format(Math.round(amt))+'\\u00a0₫';}catch(e){return String(Math.round(amt))+' ₫';}
  }
  return String(fallback||'').trim();
}
function saleCopy(){return typeof SALE_COPY==='object'&&SALE_COPY?SALE_COPY:{};}
function variantSaleFace(p){
  if(!p)return null;
  var list=Math.max(0,Math.round(Number(p.priceAmount)||0));
  var site=p.siteSale||{};
  var phase=String(site.phase||p.siteSalePhase||'');
  var pct=Math.max(0,Math.round(Number(site.percent||p.siteSalePercent||0)||0));
  var expected=Number(site.expectedSalePrice||p.siteSaleExpectedPrice);
  var countdown=site.countdownTo||'';
  var label=String(site.eventLabel||'');
  if(phase==='teaser'&&list>0&&pct>0&&Number.isFinite(expected)&&expected>0&&expected<list){
    return {kind:'teaser',display:list,compare:0,expected:Math.round(expected),percent:pct,savings:list-Math.round(expected),countdown:countdown,label:label};
  }
  if(phase!=='active')return null;
  var sale=Number(p.salePriceAmount);
  if(!Number.isFinite(sale)||sale<=0||list<=0||sale>=list)return null;
  return {kind:'active',display:Math.round(sale),compare:list,expected:0,percent:pct,savings:list-Math.round(sale),countdown:countdown,label:label};
}
function variantFmtChip(iso){
  if(!iso)return '';
  var t=Date.parse(iso);if(!Number.isFinite(t))return '';
  var d=t-Date.now();if(d<=0)return '';
  var s=Math.floor(d/1000),days=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
  var hms=('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+sec).slice(-2);
  return days>0?days+'d '+hms:hms;
}
function variantSaleHtml(st){
  var face=st.saleFace;if(!face||(face.kind!=='teaser'&&face.kind!=='active'))return '';
  var sc=saleCopy();
  var fallback=face.kind==='teaser'?sc.teaserFallback:sc.activeFallback;
  var label=face.label||fallback||'';
  var pillTpl=face.kind==='active'?sc.activePill:sc.teaserPill;
  var pill=String(pillTpl||'').replace('{label}',label).replace('{pct}',String(face.percent));
  var prefix=String((face.kind==='active'?sc.countdownLeft:sc.countdownStarts)||'').replace('{label}',label);
  var count=variantFmtChip(face.countdown);
  var price=variantMoney(face.display,st.priceHint);
  var expected=face.kind==='teaser'&&face.expected?variantMoney(face.expected,''):'';
  var saveAmt=variantMoney(face.savings,'');
  var save=saveAmt?String((face.kind==='teaser'?sc.teaserSave:sc.save)||'').replace('{amount}',saveAmt):'';
  var priceLabel=face.kind==='teaser'?sc.listPriceLabel:sc.offerPriceLabel;
  return '<div data-pw-variant-sale data-pw-sale-phase="'+face.kind+'">'
    +(pill?'<span data-pw-variant-sale-pill>'+(face.kind==='teaser'?'⏳ ':'🔥 ')+variantEsc(pill)+'</span>':'')
    +(count?'<div data-pw-variant-sale-count>⏱ '+variantEsc(prefix)+' <strong data-pw-sale-hms>'+variantEsc(count)+'</strong></div>':'')
    +(priceLabel?'<p data-pw-variant-price-label>'+variantEsc(priceLabel)+'</p>':'')
    +'<div data-pw-variant-price-row>'
    +(price?'<p data-pw-variant-price>'+variantEsc(price)+'</p>':'')
    +(expected?'<span data-pw-variant-expected><span>'+variantEsc(sc.expectedPrice||'')+'</span> '+variantEsc(expected)+'</span>':'')
    +(face.kind==='active'&&face.compare?'<span data-pw-variant-compare>'+variantEsc(variantMoney(face.compare,''))+'</span>':'')
    +(save?'<span data-pw-variant-save-chip>'+variantEsc(save)+'</span>':'')
    +(face.percent?'<span data-pw-variant-pct>-'+face.percent+'%</span>':'')
    +'</div></div>';
}
function variantTotalSaveHtml(st){
  var face=st.saleFace;if(!face||!(face.savings>0))return '';
  var sc=saleCopy();
  var amt=variantMoney(face.savings*st.qty,'');
  if(!amt)return '';
  var text=String((face.kind==='teaser'?sc.teaserSave:sc.save)||'').replace('{amount}',amt);
  return text?'<span data-pw-variant-total-save>'+variantEsc(text)+'</span>':'';
}
function variantImg(url){
  url=String(url||'').trim();
  if(!url)return '';
  if(url.indexOf('//')===0)url='https:'+url;
  url=url.replace(/_\\d+x\\d+q\\d+\\.jpg$/i,'');
  try{
    var u=new URL(url,location.origin);
    var host=u.hostname.toLowerCase();
    if(host==='img.alicdn.com'||host==='gw.alicdn.com')return u.toString();
    if(/alicdn\\.com$/.test(host)||/1688\\.com$/.test(host)||/alibaba\\.com$/.test(host)){
      if(/\\.alicdn\\.com$/.test(host))u.hostname='img.alicdn.com';
      return '/api/fetch-image?url='+encodeURIComponent(u.toString());
    }
  }catch(e){}
  return url;
}
function hideVariantModal(){
  var root=document.getElementById('pw-variant-modal');
  if(!root)return;
  root.setAttribute('hidden','');
  document.body.style.overflow=root.getAttribute('data-pw-prev-overflow')||'';
  window.__pwVariantState=null;
}
function readPdpOption(kind){
  var block=document.querySelector('[data-pw-pdp-option="'+kind+'"]');
  if(!block)return '';
  var active=block.querySelector('.pw-pdp-pill.is-active,[data-pw-pdp-option-value].is-active');
  if(!active)return '';
  return String(active.getAttribute('data-pw-pdp-option-value')||active.textContent||'').trim();
}
function readPdpOptionList(kind){
  var block=document.querySelector('[data-pw-pdp-option="'+kind+'"]');
  if(!block)return [];
  var out=[],seen={};
  var pills=block.querySelectorAll('[data-pw-pdp-option-value],.pw-pdp-pill');
  for(var i=0;i<pills.length;i++){
    var name=String(pills[i].getAttribute('data-pw-pdp-option-value')||pills[i].textContent||'').trim();
    if(!name||seen[name])continue;
    seen[name]=1;
    var img=pills[i].querySelector('img');
    out.push({name:name,img:img?img.getAttribute('src')||'':''});
  }
  return out;
}
function ensureVariantModal(){
  var root=document.getElementById('pw-variant-modal');
  if(root)return root;
  root=document.createElement('div');
  root.id='pw-variant-modal';
  root.setAttribute('data-pw-variant-modal','1');
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','pw-variant-title');
  root.setAttribute('hidden','');
  root.innerHTML='<div data-pw-variant-backdrop></div>'
    +'<div data-pw-variant-card>'
    +'<div data-pw-variant-head><button type="button" data-pw-variant-close aria-label=""><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button></div>'
    +'<div data-pw-variant-body>'
    +'<h2 id="pw-variant-title" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"></h2>'
    +'<div data-pw-variant-wide></div>'
    +'<div data-pw-variant-compact></div>'
    +'</div>'
    +'<div data-pw-variant-foot>'
    +'<button type="button" data-pw-variant-add></button>'
    +'<button type="button" data-pw-variant-buy></button>'
    +'</div></div>';
  document.body.appendChild(root);
  var backdrop=root.querySelector('[data-pw-variant-backdrop]');
  var closeBtn=root.querySelector('[data-pw-variant-close]');
  if(backdrop)backdrop.addEventListener('click',hideVariantModal);
  if(closeBtn)closeBtn.addEventListener('click',hideVariantModal);
  document.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'&&root&&!root.hasAttribute('hidden'))hideVariantModal();
  });
  root.addEventListener('click',function(ev){
    var t=ev.target;if(!t||!t.closest)return;
    var st=window.__pwVariantState;if(!st)return;
    var colorBtn=t.closest('[data-pw-variant-color]');
    if(colorBtn){
      st.colorIndex=Number(colorBtn.getAttribute('data-index')||0);
      paintVariantModal();
      return;
    }
    var sizeBtn=t.closest('[data-pw-variant-size]');
    if(sizeBtn){
      st.size=String(sizeBtn.getAttribute('data-size')||'');
      paintVariantModal();
      return;
    }
    var step=t.closest('[data-pw-variant-step]');
    if(step){
      var delta=Number(step.getAttribute('data-delta')||0);
      st.qty=Math.min(st.maxQty,Math.max(1,(Number(st.qty)||1)+delta));
      paintVariantModal();
    }
  });
  var addBtn=root.querySelector('[data-pw-variant-add]');
  var buyBtn=root.querySelector('[data-pw-variant-buy]');
  if(addBtn)addBtn.addEventListener('click',function(){confirmVariantModal(false);});
  if(buyBtn)buyBtn.addEventListener('click',function(){confirmVariantModal(true);});
  return root;
}
function variantColorHtml(st,compact){
  if(!st.colors.length)return '';
  var chips='';
  for(var i=0;i<st.colors.length;i++){
    var c=st.colors[i];
    var on=st.colorIndex===i;
    var src=variantImg(c.img||'');
    chips+='<button type="button" data-pw-variant-color data-index="'+i+'" aria-pressed="'+(on?'true':'false')+'">'
      +(src?'<span data-pw-variant-swatch><img alt="" width="'+(compact?36:32)+'" height="'+(compact?36:32)+'" src="'+variantEsc(src)+'"/></span>':'<span data-pw-variant-swatch></span>')
      +'<span data-pw-variant-color-name>'+variantEsc(c.name||'')+'</span></button>';
  }
  return '<div data-pw-variant-section><p data-pw-variant-label>'+variantEsc(COPY.variantColor||COPY.colorLabel||'Color')+'</p><div data-pw-variant-chips>'+chips+'</div></div>';
}
function variantSizeHtml(st){
  if(!st.sizes.length)return '';
  var chips='';
  for(var i=0;i<st.sizes.length;i++){
    var s=st.sizes[i];
    var on=st.size===s;
    chips+='<button type="button" data-pw-variant-size data-size="'+variantEsc(s)+'" aria-pressed="'+(on?'true':'false')+'">'+variantEsc(s)+'</button>';
  }
  var guide=st.sizeGuideHref
    ? '<a data-pw-variant-size-guide href="'+variantEsc(st.sizeGuideHref)+'">'+variantEsc(COPY.variantSizeGuide||'')+'</a>'
    : '';
  return '<div data-pw-variant-section><div data-pw-variant-size-row><p data-pw-variant-label>'+variantEsc(COPY.variantSize||COPY.sizeLabel||'Size')+'</p>'+guide+'</div><div data-pw-variant-chips>'+chips+'</div></div>';
}
function variantStockHtml(st,short){
  if(!st.showStock)return '';
  var text=short
    ? String(COPY.variantStockLeftShort||'').replace('{n}',String(st.stockQty))
    : String(COPY.variantStockLeft||'').replace('{n}',String(st.stockQty));
  return '<p data-pw-variant-stock><span data-pw-variant-stock-icon aria-hidden="true">★</span>'+variantEsc(text)+'</p>';
}
function variantQtyWide(st){
  var minusDis=st.qty<=1?' disabled':'';
  var plusDis=st.qty>=st.maxQty?' disabled':'';
  return '<div data-pw-variant-section><p data-pw-variant-label>'+variantEsc(COPY.variantQty||COPY.quantity||'Qty')+'</p>'
    +'<div data-pw-variant-stepper>'
    +'<button type="button" data-pw-variant-step data-delta="-1"'+minusDis+'>-</button>'
    +'<span data-pw-variant-qty>'+st.qty+'</span>'
    +'<button type="button" data-pw-variant-step data-delta="1"'+plusDis+'>+</button>'
    +'</div>'
    +'<div data-pw-variant-total><span data-pw-variant-total-label>'+variantEsc(String(COPY.variantLineTotal||'').replace('{n}',String(st.qty)))+'</span><span data-pw-variant-total-price>'+variantEsc(st.lineLabel)+variantTotalSaveHtml(st)+'</span></div>'
    +'</div>';
}
function variantQtyCompact(st){
  var minusDis=st.qty<=1?' disabled':'';
  var plusDis=st.qty>=st.maxQty?' disabled':'';
  var remain=st.showStock?'<span data-pw-variant-remain>('+variantEsc(String(COPY.variantStockLeftShort||'').replace('{n}',String(st.stockQty)))+')</span>':'';
  return '<div data-pw-variant-section><p data-pw-variant-label>'+variantEsc(COPY.variantQty||COPY.quantity||'Qty')+'</p>'
    +'<div style="display:flex;align-items:center;gap:12px">'
    +'<div data-pw-variant-compact-step>'
    +'<button type="button" data-pw-variant-step data-delta="-1"'+minusDis+'>-</button>'
    +'<span data-pw-variant-qty>'+st.qty+'</span>'
    +'<button type="button" data-pw-variant-step data-delta="1"'+plusDis+'>+</button>'
    +'</div>'+remain+'</div>'
    +'<div data-pw-variant-total><span data-pw-variant-total-label>'+variantEsc(String(COPY.variantLineTotal||'').replace('{n}',String(st.qty)))+'</span><span data-pw-variant-total-price>'+variantEsc(st.lineLabel)+variantTotalSaveHtml(st)+'</span></div>'
    +'</div>';
}
function paintVariantModal(){
  var st=window.__pwVariantState;if(!st)return;
  var root=ensureVariantModal();
  var color=st.colors[st.colorIndex]||null;
  var img=variantImg((color&&color.img)||st.imageUrl);
  var unit=st.unitPrice>0?st.unitPrice:0;
  st.lineLabel=unit>0?variantMoney(unit*st.qty,st.priceHint):st.priceHint;
  var skuFull=st.sku?String(COPY.variantSku||'').replace('{sku}',st.sku):'';
  var skuShort=st.sku?String(COPY.variantSkuShort||'').replace('{sku}',st.sku):'';
  var saleBlock=variantSaleHtml(st);
  var price=saleBlock?'':(unit>0?variantMoney(unit,st.priceHint):st.priceHint);
  var title=root.querySelector('#pw-variant-title');
  if(title)title.textContent=COPY.variantTitle||COPY.productDetail||'';
  var closeBtn=root.querySelector('[data-pw-variant-close]');
  if(closeBtn)closeBtn.setAttribute('aria-label',COPY.variantClose||COPY.cartAddedClose||'Close');
  var wide=root.querySelector('[data-pw-variant-wide]');
  var compact=root.querySelector('[data-pw-variant-compact]');
  if(wide){
    wide.innerHTML='<div data-pw-variant-hero>'+(img?'<img alt="'+variantEsc(st.name)+'" src="'+variantEsc(img)+'"/>':'')+'</div>'
      +'<div data-pw-variant-info>'
      +(skuFull?'<p data-pw-variant-sku>'+variantEsc(skuFull)+'</p>':'')
      +'<p data-pw-variant-name>'+variantEsc(st.name)+'</p>'
      +saleBlock
      +(price?'<p data-pw-variant-price>'+variantEsc(price)+'</p>':'')
      +variantStockHtml(st,false)
      +variantColorHtml(st,false)
      +variantSizeHtml(st)
      +variantQtyWide(st)
      +'</div>';
  }
  if(compact){
    compact.innerHTML='<div data-pw-variant-compact-top>'
      +'<div data-pw-variant-thumb>'+(img?'<img alt="'+variantEsc(st.name)+'" src="'+variantEsc(img)+'"/>':'')+'</div>'
      +'<div data-pw-variant-info>'
      +(skuShort?'<p data-pw-variant-sku>'+variantEsc(skuShort)+'</p>':'')
      +'<p data-pw-variant-name>'+variantEsc(st.name)+'</p>'
      +saleBlock
      +(price?'<p data-pw-variant-price>'+variantEsc(price)+'</p>':'')
      +variantStockHtml(st,true)
      +'</div></div>'
      +'<div>'+variantColorHtml(st,true)+variantSizeHtml(st)+variantQtyCompact(st)+'</div>';
  }
  var add=root.querySelector('[data-pw-variant-add]');
  var buy=root.querySelector('[data-pw-variant-buy]');
  if(add){add.textContent=COPY.variantAdd||COPY.addToCart;add.disabled=!!st.busy;}
  if(buy){buy.textContent=COPY.variantBuy||COPY.buyNow;buy.disabled=!!st.busy;}
  root.setAttribute('data-pw-variant-face',variantModalFace());
}
function tickVariantSale(){
  var root=document.getElementById('pw-variant-modal');
  if(!root||root.hasAttribute('hidden'))return;
  var st=window.__pwVariantState;
  if(!st||!st.saleFace||!st.saleFace.countdown)return;
  var el=root.querySelector('[data-pw-variant-sale-count] [data-pw-sale-hms]');
  if(!el)return;
  var next=variantFmtChip(st.saleFace.countdown);
  var n=el.firstChild;
  if(n&&n.nodeType===3&&!n.nextSibling){
    if(n.nodeValue!==next)n.nodeValue=next;
    return;
  }
  if((el.textContent||'')!==next)el.textContent=next;
}
function confirmVariantModal(buyNow){
  var st=window.__pwVariantState;if(!st||st.busy)return;
  var color=st.colors[st.colorIndex]||null;
  var product={
    inventory_id:st.inventoryId,
    name:st.name,
    price_hint:st.priceHint,
    image_url:(color&&color.img)||st.imageUrl,
    product_url:st.productUrl,
    sku:st.sku,
    color:color?color.name:'',
    size:st.size||'',
    quantity:st.qty
  };
  st.busy=true;paintVariantModal();
  addToCart(product,{silent:!!buyNow}).then(function(ok){
    st.busy=false;
    if(!ok){paintVariantModal();return;}
    hideVariantModal();
    if(buyNow) location.href=CART_PATH;
  }).catch(function(){st.busy=false;paintVariantModal();});
}
function openPdpVariantModal(seed,action){
  seed=seed||{};
  var id=String(seed.inventory_id||'').trim();
  if(!id){toast(COPY.error);return;}
  var root=ensureVariantModal();
  var colors=readPdpOptionList('color');
  var sizes=readPdpOptionList('size').map(function(x){return x.name;});
  var pickColor=readPdpOption('color');
  var pickSize=readPdpOption('size');
  var colorIndex=0;
  for(var i=0;i<colors.length;i++){if(colors[i].name===pickColor){colorIndex=i;break;}}
  window.__pwVariantState={
    inventoryId:id,
    name:seed.name||'Product',
    sku:'',
    imageUrl:seed.image_url||'',
    productUrl:seed.product_url||'',
    priceHint:seed.price_hint||'',
    unitPrice:0,
    stockQty:0,
    showStock:false,
    maxQty:99,
    colors:colors,
    sizes:sizes,
    colorIndex:colorIndex,
    size:pickSize||sizes[0]||'',
    qty:Math.min(99,Math.max(1,Number(seed.quantity)||1)),
    sizeGuideHref:typeof SIZE_GUIDE_PATH==='string'?SIZE_GUIDE_PATH:'',
    busy:true,
    action:action||'both',
    lineLabel:seed.price_hint||'',
    saleFace:null
  };
  root.setAttribute('data-pw-prev-overflow',document.body.style.overflow||'');
  document.body.style.overflow='hidden';
  root.removeAttribute('hidden');
  paintVariantModal();
  if(!window.__pwVariantSaleTimer)window.__pwVariantSaleTimer=setInterval(tickVariantSale,1000);
  var optUrl=PRODUCT_API_PREFIX+encodeURIComponent(id)+'/options';
  Promise.all([
    apiFetch(PRODUCT_API_PREFIX+encodeURIComponent(id)),
    apiFetch(optUrl).catch(function(){return {ok:false,j:{}};})
  ]).then(function(pair){
    var st=window.__pwVariantState;if(!st||st.inventoryId!==id)return;
    var p=pair[0]&&pair[0].j&&pair[0].j.product;
    var opt=pair[1]&&pair[1].j&&pair[1].j.options;
    if(p){
      st.name=p.name||st.name;
      st.sku=p.sku||st.sku;
      st.imageUrl=p.imageUrl||st.imageUrl;
      st.productUrl=p.productUrl||st.productUrl;
      st.priceHint=p.priceHint||st.priceHint;
      st.saleFace=variantSaleFace(p);
      if(st.saleFace)st.unitPrice=st.saleFace.display;
      else st.unitPrice=Number(p.salePriceAmount||p.priceAmount||0)||0;
      st.stockQty=Math.max(0,Math.round(Number(p.stockQty)||0));
      st.showStock=st.stockQty>=1&&st.stockQty<=5;
      st.maxQty=st.stockQty>0?Math.min(99,st.stockQty):99;
      if(Array.isArray(p.colors))st.colors=p.colors.map(function(c){return {name:String(c.name||'').trim(),img:String(c.img||'')};}).filter(function(c){return c.name;});
      if(Array.isArray(p.sizes))st.sizes=p.sizes.map(function(s){return String(s||'').trim();}).filter(Boolean);
      if(p.sizeGuideImageUrl)st.sizeGuideHref=st.sizeGuideHref||SIZE_GUIDE_PATH;
    }
    if(opt){
      st.name=opt.name||st.name;
      st.sku=opt.sku||st.sku;
      st.imageUrl=opt.image_url||st.imageUrl;
      st.productUrl=opt.product_url||st.productUrl;
      st.priceHint=opt.price_hint||st.priceHint;
      if(Array.isArray(opt.colors))st.colors=opt.colors.map(function(c){return {name:String(c.name||'').trim(),img:String(c.img||'')};}).filter(function(c){return c.name;});
      if(Array.isArray(opt.sizes))st.sizes=opt.sizes.map(function(s){return String(s||'').trim();}).filter(Boolean);
    }
    if(st.colors.length){
      var found=-1;
      for(var ci=0;ci<st.colors.length;ci++){if(st.colors[ci].name===pickColor){found=ci;break;}}
      st.colorIndex=found>=0?found:0;
    }else st.colorIndex=-1;
    if(st.sizes.length&&st.sizes.indexOf(st.size)<0)st.size=st.sizes[0];
    st.qty=Math.min(st.maxQty,Math.max(1,st.qty));
    st.busy=false;
    paintVariantModal();
  }).catch(function(){
    var st2=window.__pwVariantState;if(!st2)return;
    st2.busy=false;paintVariantModal();
  });
}
function isPdpProductPage(){
  var html=document.documentElement;
  var body=document.body;
  if((html.getAttribute('data-pw-page')||'')==='product')return true;
  if(body&&(body.getAttribute('data-pw-page')||'')==='product')return true;
  var inline=document.querySelector('[data-pw-inline-visual-root]');
  if(inline&&(inline.getAttribute('data-pw-page')||'')==='product')return true;
  return !!(html.querySelector&&html.querySelector('[data-pw-page="product"]'));
}
function isPdpBuyBoxHost(el){
  return !!(el&&el.closest&&el.closest('[data-pw-pdp-add-cart],[data-pw-pdp-buy-now],.pw-pdp-actions,.pw-shop-pdp-info,[data-pw-region="pdp-info"],.pw-pdp-sticky,[data-pw-pdp-bottom],.pw-pdp-sticky-ctas,[data-pw-dock-show="pdp"]'));
}
function isPdpCartTrigger(el){
  if(!el||!el.closest)return false;
  if(isPdpBuyBoxHost(el))return true;
  if(el.closest('.pw-product-card,.pw-shop-card,[data-pw-region="catalog"],[data-pw-catalog]'))return false;
  return isPdpProductPage();
}
function isPdpWideStickyViewport(){
  var html=document.documentElement;
  var q='';
  try{q=new URLSearchParams(location.search).get('pw-device')||'';}catch(e){}
  var d=String(html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||q||'').toLowerCase();
  if(d==='desktop'||d==='laptop')return true;
  if(d==='mobile'||d==='tablet')return false;
  try{return window.matchMedia('(min-width:1280px)').matches;}catch(e2){return false;}
}
function setPdpDesktopSticky(on){
  var html=document.documentElement;
  if(on)html.setAttribute('data-pw-pdp-desktop-sticky','1');
  else html.removeAttribute('data-pw-pdp-desktop-sticky');
}
function stampPdpBuyBoxCartHooks(){
  var roots=document.querySelectorAll('.pw-pdp-actions,.pw-shop-pdp-info,[data-pw-region="pdp-info"]');
  for(var r=0;r<roots.length;r++){
    var root=roots[r];
    if(root.closest&&root.closest('[data-pw-chrome-kit="dock"],[data-pw-live-dock],.pw-pdp-sticky,[data-pw-catalog]'))continue;
    var adds=root.querySelectorAll('[data-pw-add-cart],[data-pw-chrome-btn="add-cart"],[data-pw-el="card-cart"]');
    for(var i=0;i<adds.length;i++){
      if(adds[i].closest&&adds[i].closest('.pw-product-card,.pw-shop-card,[data-pw-region="catalog"],[data-pw-catalog]')&&!isPdpBuyBoxHost(adds[i]))continue;
      adds[i].setAttribute('data-pw-pdp-add-cart','1');
      if(!adds[i].hasAttribute('data-pw-add-cart'))adds[i].setAttribute('data-pw-add-cart','');
    }
    var buys=root.querySelectorAll('[data-pw-buy],[data-pw-chrome-btn="buy-now"],[data-pw-el="buy"]');
    for(var b=0;b<buys.length;b++){
      if(buys[b].closest&&buys[b].closest('.pw-product-card,.pw-shop-card,[data-pw-region="catalog"],[data-pw-catalog]')&&!isPdpBuyBoxHost(buys[b]))continue;
      buys[b].setAttribute('data-pw-pdp-buy-now','1');
      if(!buys[b].hasAttribute('data-pw-buy'))buys[b].setAttribute('data-pw-buy','');
    }
  }
}
function pdpBuyBoxActionsEl(){
  var nodes=document.querySelectorAll('.pw-pdp-actions,.pw-pdp-actions-inline');
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(el.closest&&el.closest('[data-pw-chrome-kit="dock"],[data-pw-live-dock],.pw-pdp-sticky'))continue;
    return el;
  }
  return document.querySelector('[data-pw-region="pdp-info"] [data-pw-pdp-add-cart],.pw-shop-pdp-info [data-pw-pdp-add-cart]');
}
function bindPdpDesktopStickyBar(){
  if(typeof pwShopLiveUiOff==='function'&&pwShopLiveUiOff()){setPdpDesktopSticky(false);return;}
  stampPdpBuyBoxCartHooks();
  if(!isPdpProductPage()){setPdpDesktopSticky(false);return;}
  var actions=pdpBuyBoxActionsEl();
  if(!actions){
    setPdpDesktopSticky(false);
    if(!window.__pwPdpStickyTries)window.__pwPdpStickyTries=0;
    if(window.__pwPdpStickyTries<40){
      window.__pwPdpStickyTries+=1;
      setTimeout(bindPdpDesktopStickyBar,120);
    }
    return;
  }
  window.__pwPdpStickyTries=40;
  function syncFromRect(){
    if(!isPdpWideStickyViewport()){setPdpDesktopSticky(false);return;}
    var rect=actions.getBoundingClientRect();
    setPdpDesktopSticky(rect.bottom<8||rect.top>window.innerHeight);
  }
  if(window.__pwPdpStickyObs){try{window.__pwPdpStickyObs.disconnect();}catch(e){}}
  if(typeof IntersectionObserver!=='undefined'){
    var obs=new IntersectionObserver(function(entries){
      if(!isPdpWideStickyViewport()){setPdpDesktopSticky(false);return;}
      var entry=entries&&entries[0];
      setPdpDesktopSticky(!!(entry&&!entry.isIntersecting));
    },{root:null,threshold:0.1});
    obs.observe(actions);
    window.__pwPdpStickyObs=obs;
  }
  syncFromRect();
  if(!window.__pwPdpStickyResize){
    window.__pwPdpStickyResize=1;
    window.addEventListener('resize',function(){
      if(!isPdpWideStickyViewport())setPdpDesktopSticky(false);
      else syncFromRect();
    },{passive:true});
  }
}
bindPdpDesktopStickyBar();
`

export function isPdpCartTriggerForTest(input: {
  inCatalog?: boolean
  inPdp?: boolean
  pageProduct?: boolean
}): boolean {
  if (input.inPdp) return true
  if (input.inCatalog) return false
  return Boolean(input.pageProduct)
}
