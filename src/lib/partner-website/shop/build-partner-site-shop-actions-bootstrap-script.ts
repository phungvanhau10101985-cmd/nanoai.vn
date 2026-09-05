import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteCartApiPath,
  partnerSiteCartPath,
  partnerSiteContactChannelsApiPath,
  partnerSiteInfoPath,
  partnerSiteLeadApiPath,
  partnerSiteLoginPath,
  partnerSiteNotificationsApiPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductApiPath,
  partnerSiteProductPath,
  partnerSitePromotionsValidateApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteAppliedPromoStorageKey } from '@/lib/partner-website/shop/partner-site-applied-promo'
import { PW_CHROME_COUNT_BADGE_RUNTIME_JS } from '@/lib/partner-website/shop/chrome-count-badges'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import {
  CART_ADDED_MODAL_COPY,
  PW_CART_ADDED_MODAL_RUNTIME_JS,
} from '@/lib/partner-website/shop/partner-site-cart-added-modal'
import {
  PRODUCT_VARIANT_MODAL_COPY,
  PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS,
  type ProductVariantModalCopy,
} from '@/lib/partner-website/shop/partner-site-product-variant-modal'

function variantModalCopyKeys(c: ProductVariantModalCopy) {
  return {
    variantTitle: c.title,
    variantSku: c.sku,
    variantSkuShort: c.skuShort,
    variantColor: c.color,
    variantSize: c.size,
    variantQty: c.qty,
    variantLineTotal: c.lineTotal,
    variantStockLeft: c.stockLeft,
    variantStockLeftShort: c.stockLeftShort,
    variantOutOfStock: c.outOfStock,
    variantAdd: c.add,
    variantBuy: c.buy,
    variantClose: c.close,
    variantSizeGuide: c.sizeGuide,
  }
}

const COPY: Record<
  WebLocale,
  {
    addToCart: string
    addedToCart: string
    favoriteAdd: string
    favoriteRemove: string
    error: string
    shareCopied: string
    shareFailed: string
    couponOk: string
    couponNeedCart: string
    cartAddedTitle: string
    cartGoToCart: string
    cartContinueShopping: string
    cartAddedClose: string
    variantTitle: string
    variantSku: string
    variantSkuShort: string
    variantColor: string
    variantSize: string
    variantQty: string
    variantLineTotal: string
    variantStockLeft: string
    variantStockLeftShort: string
    variantOutOfStock: string
    variantAdd: string
    variantBuy: string
    variantClose: string
    variantSizeGuide: string
  }
> = {
  vi: {
    addToCart: 'Thêm vào giỏ',
    addedToCart: 'Đã thêm vào giỏ.',
    ...CART_ADDED_MODAL_COPY.vi,
    ...variantModalCopyKeys(PRODUCT_VARIANT_MODAL_COPY.vi),
    favoriteAdd: 'Thích',
    favoriteRemove: 'Bỏ thích',
    error: 'Không thực hiện được. Thử lại.',
    shareCopied: 'Đã sao chép link.',
    shareFailed: 'Không chia sẻ được.',
    couponOk: 'Đã áp mã. Mở giỏ để xem giảm giá.',
    couponNeedCart: 'Thêm sản phẩm vào giỏ rồi áp mã.',
  },
  en: {
    addToCart: 'Add to cart',
    addedToCart: 'Added to cart.',
    ...CART_ADDED_MODAL_COPY.en,
    ...variantModalCopyKeys(PRODUCT_VARIANT_MODAL_COPY.en),
    favoriteAdd: 'Favorite',
    favoriteRemove: 'Unfavorite',
    error: 'Action failed. Try again.',
    shareCopied: 'Link copied.',
    shareFailed: 'Could not share.',
    couponOk: 'Code applied. Open the cart to see the discount.',
    couponNeedCart: 'Add items to the cart first.',
  },
  zh: {
    addToCart: '加入购物车',
    addedToCart: '已加入购物车。',
    ...CART_ADDED_MODAL_COPY.zh,
    ...variantModalCopyKeys(PRODUCT_VARIANT_MODAL_COPY.zh),
    favoriteAdd: '收藏',
    favoriteRemove: '取消收藏',
    error: '操作失败，请重试。',
    shareCopied: '链接已复制。',
    shareFailed: '无法分享。',
    couponOk: '已应用优惠码，请打开购物车查看。',
    couponNeedCart: '请先把商品加入购物车。',
  },
  ja: {
    addToCart: 'カートに追加',
    addedToCart: 'カートに追加しました。',
    ...CART_ADDED_MODAL_COPY.ja,
    ...variantModalCopyKeys(PRODUCT_VARIANT_MODAL_COPY.ja),
    favoriteAdd: 'お気に入り',
    favoriteRemove: '解除',
    error: '失敗しました。再試行してください。',
    shareCopied: 'リンクをコピーしました。',
    shareFailed: '共有できませんでした。',
    couponOk: 'コードを適用しました。カートで確認してください。',
    couponNeedCart: '先にカートへ商品を入れてください。',
  },
  ko: {
    addToCart: '장바구니',
    addedToCart: '담았습니다.',
    ...CART_ADDED_MODAL_COPY.ko,
    ...variantModalCopyKeys(PRODUCT_VARIANT_MODAL_COPY.ko),
    favoriteAdd: '찜',
    favoriteRemove: '찜 해제',
    error: '실패했습니다. 다시 시도하세요.',
    shareCopied: '링크를 복사했습니다.',
    shareFailed: '공유하지 못했습니다.',
    couponOk: '코드가 적용되었습니다. 장바구니에서 확인하세요.',
    couponNeedCart: '먼저 장바구니에 상품을 담으세요.',
  },
}

/**
 * Same-platform shop: wire [data-pw-add-cart] / [data-pw-buy] / [data-pw-favorite] and
 * auto-enhance product cards that link to /site/{slug}/products/{uuid}.
 */
export function buildPartnerSiteShopActionsBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale in COPY ? input.locale : 'en'
  const copy = COPY[locale]
  const cartApi = partnerSiteCartApiPath(slug)
  const eventsApi = partnerSitePersonalizationApiPath(slug, 'events')
  const favApi = `${partnerSitePersonalizationApiPath(slug, 'favorites')}?limit=48`
  const recentApi = `${partnerSitePersonalizationApiPath(slug, 'recently-viewed')}?limit=48`
  const notifApi = partnerSiteNotificationsApiPath(slug, { unread: true })
  const contactApi = partnerSiteContactChannelsApiPath(slug)
  const leadApi = partnerSiteLeadApiPath(slug)
  const couponApi = partnerSitePromotionsValidateApiPath(slug)
  const googleDiscountApi = `/api/site/${encodeURIComponent(slug)}/promotions/google-discount`
  const affiliateApi = `/api/site/${encodeURIComponent(slug)}/affiliate`
  const promoLs = partnerSiteAppliedPromoStorageKey(slug)
  const cartPath = partnerSiteCartPath(slug)
  const loginPath = partnerSiteLoginPath(slug)
  const sizeGuidePath = partnerSiteInfoPath(slug, 'size-guide')
  const productApiPrefix = partnerSiteProductApiPath(slug, '__ID__').replace('__ID__', '')
  const detailPrefix = partnerSiteProductPath(slug, '__ID__').replace('__ID__', '')

  return `<script data-pw-shop-actions-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var CART_API=${JSON.stringify(cartApi)};
var EVENTS_API=${JSON.stringify(eventsApi)};
var FAV_API=${JSON.stringify(favApi)};
var RECENT_API=${JSON.stringify(recentApi)};
var NOTIF_API=${JSON.stringify(notifApi)};
var CONTACT_API=${JSON.stringify(contactApi)};
var LEAD_API=${JSON.stringify(leadApi)};
var COUPON_API=${JSON.stringify(couponApi)};
var GOOGLE_DISCOUNT_API=${JSON.stringify(googleDiscountApi)};
var AFFILIATE_API=${JSON.stringify(affiliateApi)};
var PROMO_LS=${JSON.stringify(promoLs)};
var PRODUCT_API_PREFIX=${JSON.stringify(productApiPrefix)};
var CART_PATH=${JSON.stringify(cartPath)};
var LOGIN_PATH=${JSON.stringify(loginPath)};
var SIZE_GUIDE_PATH=${JSON.stringify(sizeGuidePath)};
var DETAIL_PREFIX=${JSON.stringify(detailPrefix)};
var COPY=${JSON.stringify(copy)};
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var SESSION_HDR='x-guest-session-id';
var ACCOUNT_KEY='app_guest_account_id';
var ACCOUNT_KEY_LEGACY='nanoai_guest_account_id';
var ACCOUNT_HDR='x-guest-account-id';
var UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function accountId(){try{var ls=localStorage.getItem(ACCOUNT_KEY)||localStorage.getItem(ACCOUNT_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_account_sync')||readCookie(ACCOUNT_KEY);}
function authHeaders(){var h={};var s=sessionId(),a=accountId();if(s)h[SESSION_HDR]=s;if(a)h[ACCOUNT_HDR]=a;return h;}
function pageLocation(){try{if(window.top&&window.top.location&&window.top.location.href)return window.top.location;}catch(e){}return location;}
function purchaseLoginHref(){var loc=pageLocation();var base=loc.pathname.indexOf('/site/')===0?LOGIN_PATH:'/login';return base+'?redirect='+encodeURIComponent(loc.pathname+(loc.search||'')+(loc.hash||''));}
function navigateShop(url){try{if(window.top&&window.top!==window){window.top.location.assign(url);return;}}catch(e){}location.assign(url);}
function requirePurchaseLogin(){if(accountId())return false;navigateShop(purchaseLoginHref());return true;}
function captureSession(res){var sid=res.headers.get(SESSION_HDR);if(sid){try{localStorage.setItem(SESSION_KEY,sid);localStorage.setItem(SESSION_KEY_LEGACY,sid);}catch(e){}}}
function apiFetch(url,opts){
  opts=opts||{};opts.credentials='same-origin';
  opts.headers=Object.assign({},authHeaders(),opts.headers||{});
  return fetch(url,opts).then(function(r){captureSession(r);return r.json().then(function(j){return {ok:r.ok,j:j,status:r.status};}).catch(function(){return {ok:r.ok,j:{},status:r.status};});});
}
function toast(msg){
  var el=document.getElementById('pw-shop-action-toast');
  if(!el){el=document.createElement('div');el.id='pw-shop-action-toast';el.setAttribute('role','status');el.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;background:#0f172a;color:#fff;padding:10px 16px;border-radius:999px;font:600 13px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .2s;pointer-events:none';document.body.appendChild(el);}
  el.textContent=msg;el.style.opacity='1';
  clearTimeout(el._t);el._t=setTimeout(function(){el.style.opacity='0';},2200);
}
function productIdFromHref(href){
  if(!href)return '';
  try{
    var u=new URL(href,location.origin);
    var path=u.pathname||'';
    if(path.indexOf(DETAIL_PREFIX)!==0)return '';
    var id=decodeURIComponent(path.slice(DETAIL_PREFIX.length).split('/')[0]||'');
    return UUID_RE.test(id)?id:'';
  }catch(e){return '';}
}
function captureGoogleDiscount(){
  if(pwShopLiveUiOff())return;
  var token='';
  try{token=(new URL(location.href)).searchParams.get('pv2')||'';}catch(e){}
  if(!token)return;
  var inventoryId=productIdFromHref(location.href)||productIdFromHref(location.pathname);
  if(!inventoryId)return;
  apiFetch(GOOGLE_DISCOUNT_API,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({token:token,inventoryId:inventoryId})
  }).then(function(res){
    if(res.ok)document.dispatchEvent(new CustomEvent('pw-google-discount-locked',{detail:res.j||{}}));
  }).catch(function(){});
}
function captureAffiliate(){
  if(pwShopLiveUiOff())return;
  var code='';
  try{var u=new URL(location.href);code=u.searchParams.get('ref')||u.searchParams.get('affiliate')||'';}catch(e){}
  if(!code)return;
  apiFetch(AFFILIATE_API,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({referralCode:code})
  }).catch(function(){});
}
function readProductFromEl(el){
  var id=(el.getAttribute('data-inventory-id')||el.getAttribute('data-pw-inventory-id')||'').trim();
  if(!id||!UUID_RE.test(id)){
    var host=el.closest('[data-inventory-id],[data-pw-inventory-id],article,.pw-product-card,.pw-shop-card,[data-pw-region="pdp-info"],.pw-pdp');
    if(host){
      id=(host.getAttribute('data-inventory-id')||host.getAttribute('data-pw-inventory-id')||'').trim();
      if(!id||!UUID_RE.test(id)){
        var a=host.querySelector('a[href*="/products/"]');
        if(a)id=productIdFromHref(a.getAttribute('href'));
      }
    }
  }
  if(!id||!UUID_RE.test(id)){
    id=productIdFromHref(location.href)||productIdFromHref(location.pathname);
  }
  if(!id||!UUID_RE.test(id))return null;
  var host2=el.closest('article,.pw-product-card,.pw-shop-card,.pw-pdp,[data-pw-region="pdp-info"]')||el;
  var nameEl=host2.querySelector('h3,h2,h1,.pw-product-name,strong');
  var priceEl=host2.querySelector('.pw-price,.pw-shop-price,[data-pw-el="price"]');
  var imgEl=host2.querySelector('img');
  var linkEl=host2.querySelector('a[href*="/products/"]');
  var productUrl=(linkEl&&linkEl.href)||(DETAIL_PREFIX+id);
  var onPdp=el.closest('[data-pw-region="pdp-info"],.pw-pdp,.pw-pdp-sticky,[data-pw-pdp-add-cart],[data-pw-pdp-buy-now]');
  return {
    inventory_id:id,
    name:(nameEl&&nameEl.textContent||'Product').trim(),
    price_hint:(priceEl&&priceEl.textContent||'').trim(),
    image_url:(imgEl&&imgEl.getAttribute('src'))||'',
    product_url:productUrl,
    size:onPdp?selectedPdpOption('size'):'',
    color:onPdp?selectedPdpOption('color'):'',
    quantity:onPdp?selectedPdpQty():1
  };
}
function selectedPdpOption(kind){
  var block=document.querySelector('[data-pw-pdp-option="'+kind+'"]');
  if(!block)return '';
  var active=block.querySelector('.pw-pdp-pill.is-active,[data-pw-pdp-option-value].is-active');
  if(!active)return '';
  return String(active.getAttribute('data-pw-pdp-option-value')||active.textContent||'').trim();
}
function selectedPdpQty(){
  var host=document.querySelector('[data-pw-region="pdp-info"] [data-pw-el="qty"],.pw-pdp [data-pw-el="qty"]');
  if(!host)return 1;
  var n=Number((host.querySelector('span')&&host.querySelector('span').textContent)||host.getAttribute('data-qty')||1);
  return Math.min(99,Math.max(1,Math.round(n)||1));
}
function uuid(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);});
}
function resolveCartCard(product){
  return apiFetch(PRODUCT_API_PREFIX+encodeURIComponent(product.inventory_id)).then(function(res){
    var p=res.j&&res.j.product;
    if(!res.ok||!p)return null;
    var card={name:p.name||product.name,image_url:p.imageUrl||product.image_url,product_url:p.productUrl||product.product_url,inventory_id:p.id||product.inventory_id};
    if(p.priceHint||product.price_hint)card.price_hint=p.priceHint||product.price_hint;
    if(p.sku)card.sku=p.sku;
    if(!/^https?:\\/\\//i.test(card.image_url)||!/^https?:\\/\\//i.test(card.product_url))return null;
    return card;
  });
}
${PW_CART_ADDED_MODAL_RUNTIME_JS}
function addToCart(product, opts){
  opts=opts||{};
  if(requirePurchaseLogin())return Promise.resolve(false);
  var addedCard=null;
  return resolveCartCard(product).then(function(card){
    if(!card){toast(COPY.error);return null;}
    addedCard=card;
    return apiFetch(CART_API).then(function(res){
      var items=(res.j&&res.j.items)||[];
      if(!Array.isArray(items))items=[];
      var line={id:uuid(),card:card,quantity:Math.min(99,Math.max(1,Number(product.quantity)||1)),color:String(product.color||''),size:String(product.size||''),note:''};
      var key=((line.card.product_url||'')+'|'+line.color+'|'+line.size).toLowerCase();
      var found=false;
      for(var i=0;i<items.length;i++){
        var it=items[i];var k=(((it.card&&it.card.product_url)||'')+'|'+(it.color||'')+'|'+(it.size||'')).toLowerCase();
        if(k===key){it.quantity=Math.min(99,(Number(it.quantity)||1)+Math.min(99,Math.max(1,Number(product.quantity)||1)));found=true;break;}
      }
      if(!found)items.push(line);
      return apiFetch(CART_API,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})});
    });
  }).then(function(res){
    if(!res)return false;
    if(!res.ok){toast(COPY.error);return false;}
    if(!opts.silent)showCartAddedModal({name:addedCard&&addedCard.name||product.name,imageUrl:addedCard&&addedCard.image_url||product.image_url});
    try{document.dispatchEvent(new CustomEvent('pw-cart-updated'));}catch(e){}
    hydrateChromeBadges(true);
    return true;
  });
}
${PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS}
function readLikeBase(btn){
  var n=Number(btn&&btn.getAttribute&&btn.getAttribute('data-pw-like-base'));
  if(isFinite(n)&&n>=0)return Math.round(n);
  var el=btn&&btn.querySelector&&btn.querySelector('[data-pw-like-count]');
  var t=el?Number(String(el.textContent||'').replace(/[^\d.-]/g,'')):NaN;
  return isFinite(t)&&t>=0?Math.round(t):0;
}
function paintLikeCount(n,inventoryId){
  var likes=Math.max(0,Math.round(Number(n)||0));
  var id=String(inventoryId||'').toLowerCase();
  document.querySelectorAll('[data-pw-stat="likes"]').forEach(function(el){el.textContent=String(likes);});
  document.querySelectorAll('[data-pw-favorite],[data-pw-pdp-favorite],[data-pw-chrome-btn="favorite-product"]').forEach(function(btn){
    var p=readProductFromEl(btn);
    if(id&&p&&String(p.inventory_id||'').toLowerCase()!==id)return;
    btn.setAttribute('data-pw-like-base',String(likes));
    var countEl=btn.querySelector&&btn.querySelector('[data-pw-like-count]');
    if(countEl)countEl.textContent=String(likes);
  });
}
function applyFavoriteState(btn,on,likes){
  if(!btn)return;
  btn.setAttribute('aria-pressed',on?'true':'false');
  btn.classList.toggle('is-active',!!on);
  var svg=btn.querySelector&&btn.querySelector('svg');
  if(svg)svg.setAttribute('fill',on?'currentColor':'none');
  if(typeof likes==='number'&&isFinite(likes)){
    var n=Math.max(0,Math.round(likes));
    btn.setAttribute('data-pw-like-base',String(n));
    var countEl=btn.querySelector&&btn.querySelector('[data-pw-like-count]');
    if(countEl)countEl.textContent=String(n);
  }
  if(btn.getAttribute&&btn.getAttribute('data-pw-chrome-btn')==='favorite-product')return;
  if(btn.querySelector&&btn.querySelector('.pw-chrome-icon-wrap,svg,[data-pw-like-count]'))return;
  btn.textContent=on?COPY.favoriteRemove:COPY.favoriteAdd;
}
function toggleFavorite(product,btn){
  var id=String(product&&product.inventory_id||'').toLowerCase();
  if(!id)return Promise.resolve();
  window.__pwFavoriteToggleInFlight=window.__pwFavoriteToggleInFlight||{};
  if(window.__pwFavoriteToggleInFlight[id])return window.__pwFavoriteToggleInFlight[id];
  var was=btn&&btn.getAttribute&&btn.getAttribute('aria-pressed')==='true';
  var base=readLikeBase(btn);
  var req=apiFetch(EVENTS_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'toggle_favorite',inventory_id:product.inventory_id})}).then(function(res){
    if(!res.ok){toast(COPY.error);return;}
    var on=!!(res.j&&res.j.is_favorite);
    var likes=res.j&&typeof res.j.likes_count==='number'?Math.max(0,Math.round(res.j.likes_count)):Math.max(0,base+(on&&!was?1:!on&&was?-1:0));
    var all=document.querySelectorAll('[data-pw-favorite],[data-pw-chrome-btn="favorite-product"]');
    for(var i=0;i<all.length;i++){
      var p=readProductFromEl(all[i]);
      if(p&&String(p.inventory_id||'').toLowerCase()===id)applyFavoriteState(all[i],on,likes);
      else if(all[i]===btn)applyFavoriteState(all[i],on,likes);
    }
    paintLikeCount(likes,id);
    window.__pwFavoriteIdsCache=null;
    hydrateChromeBadges(true);
  }).finally(function(){
    if(window.__pwFavoriteToggleInFlight)delete window.__pwFavoriteToggleInFlight[id];
  });
  window.__pwFavoriteToggleInFlight[id]=req;
  return req;
}
function paintFavoriteButtons(ids){
  var btns=document.querySelectorAll('[data-pw-favorite],[data-pw-chrome-btn="favorite-product"]');
  for(var j=0;j<btns.length;j++){
    var p=readProductFromEl(btns[j]);
    applyFavoriteState(btns[j],!!(p&&ids[String(p.inventory_id||'').toLowerCase()]));
  }
}
function hydrateFavoriteButtons(force){
  var btns=document.querySelectorAll('[data-pw-favorite],[data-pw-chrome-btn="favorite-product"]');
  if(!btns.length)return;
  if(window.__pwFavoriteIdsCache&&!force){
    paintFavoriteButtons(window.__pwFavoriteIdsCache);
    return;
  }
  if(window.__pwFavoriteFetchInFlight)return;
  window.__pwFavoriteFetchInFlight=true;
  apiFetch(FAV_API).then(function(res){
    window.__pwFavoriteFetchInFlight=false;
    if(!res.ok)return;
    var ids={};
    var products=(res.j&&res.j.products)||[];
    for(var i=0;i<products.length;i++){
      var id=String(products[i]&&products[i].inventory_id||'').toLowerCase();
      if(id)ids[id]=1;
    }
    window.__pwFavoriteIdsCache=ids;
    paintFavoriteButtons(ids);
  }).catch(function(){window.__pwFavoriteFetchInFlight=false;});
}
function enhanceCards(){
  var links=document.querySelectorAll('a[href*="/products/"]');
  for(var i=0;i<links.length;i++){
    var a=links[i];
    var id=productIdFromHref(a.getAttribute('href'));
    if(!id)continue;
    var card=a.closest('article,.pw-product-card,.pw-shop-card')||a.parentElement;
    if(!card||card.getAttribute('data-pw-actions-ready')==='1')continue;
    card.setAttribute('data-pw-actions-ready','1');
    card.setAttribute('data-inventory-id',id);
    if(card.querySelector('[data-pw-add-cart],[data-pw-favorite]'))continue;
    var bar=document.createElement('div');
    bar.className='pw-shop-action-bar';
    bar.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:8px';
    bar.innerHTML='<button type="button" class="pw-btn pw-btn-sm pw-btn-accent" data-pw-add-cart data-inventory-id="'+id+'">'+COPY.addToCart+'</button><button type="button" class="pw-btn pw-btn-sm" data-pw-favorite data-inventory-id="'+id+'" aria-pressed="false">'+COPY.favoriteAdd+'</button>';
    card.appendChild(bar);
  }
}
function productCardFromEl(el){
  if(!el||!el.closest)return null;
  var card=el.closest('article.pw-product-card,article.pw-shop-card,.pw-product-card,.pw-shop-card,[data-pw-el="card"]');
  if(!card)return null;
  if(card.classList.contains('pw-featured-cat-card'))return null;
  if(card.closest('[data-pw-featured-categories],[data-pw-region="reviews"],.pw-pdp-rq-item,[data-pw-rq-item]'))return null;
  return card;
}
function productCardActionHit(el){
  return !!(el&&el.closest&&el.closest('[data-pw-add-cart],[data-pw-buy],[data-pw-favorite],[data-pw-chrome-btn="add-cart"],[data-pw-chrome-btn="buy-now"],[data-pw-chrome-btn="favorite-product"],[data-pw-chrome-btn="try-on"],[data-pw-grid-more],button[type="button"],button[type="submit"]'));
}
function productCardNavUrl(el){
  if(productCardActionHit(el))return '';
  var card=productCardFromEl(el);
  if(!card)return '';
  var a=(el.closest&&el.closest('a[href*="/products/"]'))||card.querySelector('a[href*="/products/"]');
  if(!a)return '';
  var href=a.getAttribute('href')||'';
  if(!productIdFromHref(href)&&!productIdFromHref(a.href||''))return '';
  return a.href||href;
}
function markProductCardNav(el){
  var card=productCardFromEl(el);
  if(card)card.setAttribute('data-pw-nav','1');
}
function prefetchProduct(url){
  if(!url||pwShopLiveUiOff())return;
  if(window.__pwProductPrefetch===url)return;
  window.__pwProductPrefetch=url;
  var links=document.querySelectorAll('link[data-pw-product-prefetch]');
  if(links.length>2&&links[0]&&links[0].parentNode)links[0].parentNode.removeChild(links[0]);
  var l=document.createElement('link');
  l.rel='prefetch';
  l.as='document';
  l.href=url;
  l.setAttribute('data-pw-product-prefetch','1');
  document.head.appendChild(l);
}
function goProduct(url){
  if(!url)return;
  try{location.assign(url);}catch(e){location.href=url;}
}
if(document.documentElement.getAttribute('data-pw-shop-actions-bound')!=='1'){
  document.documentElement.setAttribute('data-pw-shop-actions-bound','1');
  document.addEventListener('pointerdown',function(ev){
    if(pwShopLiveUiOff())return;
    if(ev.button&&ev.button!==0)return;
    var t=ev.target;if(!t||!t.closest)return;
    var url=productCardNavUrl(t);
    if(!url)return;
    markProductCardNav(t);
    prefetchProduct(url);
  },true);
  document.addEventListener('click',function(ev){
    if(pwShopLiveUiOff())return;
    var t=ev.target;if(!t||!t.closest)return;
    var addBtn=t.closest('[data-pw-add-cart],[data-pw-chrome-btn="add-cart"]');
    var buyBtn=t.closest('[data-pw-buy],[data-pw-chrome-btn="buy-now"]');
    if(addBtn){
      ev.preventDefault();ev.stopPropagation();
      if(requirePurchaseLogin())return;
      var p=readProductFromEl(addBtn);if(!p){toast(COPY.error);return;}
      if(isPdpCartTrigger(addBtn)){openPdpVariantModal(p,'add');return;}
      addBtn.disabled=true;
      addToCart(p).finally(function(){addBtn.disabled=false;});
      return;
    }
    if(buyBtn){
      ev.preventDefault();ev.stopPropagation();
      if(requirePurchaseLogin())return;
      var pBuy=readProductFromEl(buyBtn);if(!pBuy){toast(COPY.error);return;}
      if(isPdpCartTrigger(buyBtn)){openPdpVariantModal(pBuy,'buy');return;}
      buyBtn.disabled=true;
      addToCart(pBuy,{silent:true}).then(function(ok){
        if(ok) location.href=CART_PATH;
      }).finally(function(){buyBtn.disabled=false;});
      return;
    }
    var favBtn=t.closest('[data-pw-favorite],[data-pw-chrome-btn="favorite-product"]');
    if(favBtn){
      ev.preventDefault();ev.stopPropagation();
      var p2=readProductFromEl(favBtn);if(!p2){toast(COPY.error);return;}
      favBtn.disabled=true;
      toggleFavorite(p2,favBtn).finally(function(){favBtn.disabled=false;});
      return;
    }
    if(ev.defaultPrevented)return;
    if(ev.button&&ev.button!==0)return;
    if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey)return;
    var dest=productCardNavUrl(t);
    if(!dest)return;
    markProductCardNav(t);
    ev.preventDefault();
    goProduct(dest);
  },true);
}
function pinChromeIconBadges(){
  var buttons=document.querySelectorAll('[data-pw-chrome-btn],.pw-shop-bottom-nav a,.pw-bottom-nav a,.pw-shop-icon-btn,.pw-icon-btn');
  for(var i=0;i<buttons.length;i++){
    var el=buttons[i];
    var badge=el.querySelector('[data-pw-chrome-badge],.pw-cart-badge,.pw-shop-cart-badge');
    if(!badge)continue;
    var owner=badge.closest('a,button,[data-pw-chrome-btn],.pw-icon-btn,.pw-shop-icon-btn');
    if(owner&&owner!==el)continue;
    var wrap=el.querySelector(':scope > .pw-chrome-icon-wrap');
    if(!wrap){
      var svg=el.querySelector(':scope > svg')||el.querySelector('svg');
      if(!svg)continue;
      var existing=svg.closest('.pw-chrome-icon-wrap');
      if(existing&&el.contains(existing))wrap=existing;
      else{
        wrap=document.createElement('span');
        wrap.className='pw-chrome-icon-wrap';
        if(svg.parentNode)svg.parentNode.insertBefore(wrap,svg);
        wrap.appendChild(svg);
      }
    }
    if(badge.parentNode!==wrap)wrap.appendChild(badge);
  }
}
${PW_CHROME_COUNT_BADGE_RUNTIME_JS}
function cartQty(items){
  if(!Array.isArray(items))return 0;
  var n=0;
  for(var i=0;i<items.length;i++) n+=Math.max(0,Number(items[i]&&items[i].quantity)||1);
  return n;
}
function hydrateContactChatLinks(force){
  var zalo=document.querySelectorAll('[data-pw-chrome-btn="chat-zalo"],[data-pw-contact-channel="zalo"]');
  var fb=document.querySelectorAll('[data-pw-chrome-btn="chat-facebook"],[data-pw-contact-channel="facebook"]');
  var ig=document.querySelectorAll('[data-pw-chrome-btn="chat-instagram"],[data-pw-contact-channel="instagram"]');
  var wa=document.querySelectorAll('[data-pw-chrome-btn="chat-whatsapp"],[data-pw-contact-channel="whatsapp"]');
  var phone=document.querySelectorAll('[data-pw-chrome-btn="phone"],[data-pw-contact-channel="phone"]');
  if(!zalo.length&&!fb.length&&!ig.length&&!wa.length&&!phone.length)return;
  function apply(nodes,url,external){
    var i,el;
    for(i=0;i<nodes.length;i++){
      el=nodes[i];
      if(url){
        el.setAttribute('href',url);
        el.removeAttribute('data-pw-contact-pending');
        el.removeAttribute('aria-disabled');
        if(external){
          el.setAttribute('target','_blank');
          el.setAttribute('rel','noopener noreferrer');
        }else{
          el.removeAttribute('target');
          el.removeAttribute('rel');
        }
        el.style.removeProperty('display');
        el.style.removeProperty('pointer-events');
      }else if(el.getAttribute('data-pw-contact-pending')==='1'||!el.getAttribute('href')||el.getAttribute('href')==='#'){
        el.setAttribute('data-pw-contact-pending','1');
        el.setAttribute('aria-disabled','true');
        el.removeAttribute('href');
        el.style.display='none';
        el.style.pointerEvents='none';
      }
    }
  }
  function waHref(raw){
    var d=String(raw||'').replace(/[^0-9]/g,'');
    return d.length>=6?'https://wa.me/'+d:'';
  }
  function telHref(raw){
    var p=String(raw||'').replace(/[^0-9+]/g,'');
    return p.length>=6?'tel:'+p:'';
  }
  function applyChannels(c){
    c=c||{};
    apply(zalo,c.zaloUrl||'',true);
    apply(fb,c.messengerUrl||'',true);
    apply(ig,c.instagramUrl||'',true);
    apply(wa,waHref(c.phone||''),true);
    apply(phone,telHref(c.phone||''),false);
  }
  if(window.__pwContactChannelsCache&&!force){
    applyChannels(window.__pwContactChannelsCache);
    return;
  }
  if(pwShopLiveUiOff()||window.__pwContactFetchInFlight){
    if(window.__pwContactChannelsCache)applyChannels(window.__pwContactChannelsCache);
    return;
  }
  window.__pwContactFetchInFlight=true;
  apiFetch(CONTACT_API).then(function(res){
    window.__pwContactFetchInFlight=false;
    var c=res.ok&&res.j&&res.j.channels?res.j.channels:{};
    window.__pwContactChannelsCache=c;
    applyChannels(c);
  }).catch(function(){
    window.__pwContactFetchInFlight=false;
    applyChannels({});
  });
}
function bindShareLeadCoupon(){
  document.querySelectorAll('[data-pw-share],[data-pw-chrome-btn="share"]').forEach(function(el){
    if(el.getAttribute('data-pw-share-bound'))return;
    el.setAttribute('data-pw-share-bound','1');
    el.addEventListener('click',function(e){
      e.preventDefault();
      var url=location.href;
      if(navigator.share){
        navigator.share({url:url,title:document.title}).catch(function(){});
        return;
      }
      if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){toast(COPY.shareCopied);}).catch(function(){toast(COPY.shareFailed);});
        return;
      }
      toast(COPY.shareFailed);
    });
  });
  document.querySelectorAll('form[data-pw-lead-form-el],form[data-pw-lead-form],#pw-lead-form').forEach(function(f){
    if(f.getAttribute('data-pw-lead-bound'))return;
    f.setAttribute('data-pw-lead-bound','1');
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var msg=f.querySelector('.pw-form-msg');
      var btn=f.querySelector('button[type=submit]');
      if(btn)btn.disabled=true;
      var fd=new FormData(f);
      apiFetch(f.getAttribute('data-api')||LEAD_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:fd.get('name')||'',
          phone:fd.get('phone')||'',
          email:fd.get('email')||'',
          message:fd.get('message')||''
        })
      }).then(function(res){
        if(msg){
          msg.hidden=false;
          msg.textContent=res.ok?(f.getAttribute('data-success')||'OK'):((res.j&&res.j.error)||f.getAttribute('data-error')||COPY.error);
          msg.className='pw-form-msg '+(res.ok?'pw-form-ok':'pw-form-err');
        }
        if(res.ok)f.reset();
      }).catch(function(){
        if(msg){msg.hidden=false;msg.textContent=f.getAttribute('data-error')||COPY.error;msg.className='pw-form-msg pw-form-err';}
      }).finally(function(){if(btn)btn.disabled=false;});
    });
  });
  document.querySelectorAll('form[data-pw-coupon-form-el],[data-pw-coupon-form] form').forEach(function(f){
    if(f.getAttribute('data-pw-coupon-bound'))return;
    f.setAttribute('data-pw-coupon-bound','1');
    f.addEventListener('submit',function(e){
      e.preventDefault();
      var msg=f.querySelector('.pw-form-msg');
      var btn=f.querySelector('button[type=submit]');
      var code=String((new FormData(f)).get('code')||'').trim();
      if(!code)return;
      if(btn)btn.disabled=true;
      apiFetch(CART_API).then(function(cartRes){
        var items=(cartRes.ok&&cartRes.j&&cartRes.j.items)||[];
        var lines=[];
        for(var i=0;i<items.length;i++){
          var it=items[i]||{};
          var id=String(it.inventory_id||it.inventoryId||(it.card&&it.card.inventory_id)||'');
          if(id)lines.push({inventoryId:id,lineSubtotal:0});
        }
        if(!lines.length){
          if(msg){msg.hidden=false;msg.textContent=COPY.couponNeedCart;msg.className='pw-form-msg pw-form-err';}
          return null;
        }
        return apiFetch(f.getAttribute('data-api')||COUPON_API,{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({code:code,cartLines:lines})
        });
      }).then(function(res){
        if(!res)return;
        if(res.ok&&res.j&&res.j.ok){
          try{localStorage.setItem(PROMO_LS,JSON.stringify({code:res.j.code||code,name:res.j.name||'',discountAmount:res.j.discountAmount||0}));}catch(errLs){}
          if(msg){msg.hidden=false;msg.textContent=COPY.couponOk;msg.className='pw-form-msg pw-form-ok';}
        }else if(msg){
          msg.hidden=false;
          msg.textContent=(res.j&&res.j.error)||COPY.error;
          msg.className='pw-form-msg pw-form-err';
        }
      }).catch(function(){
        if(msg){msg.hidden=false;msg.textContent=COPY.error;msg.className='pw-form-msg pw-form-err';}
      }).finally(function(){if(btn)btn.disabled=false;});
    });
  });
}
function hydrateChromeBadges(force){
  pinChromeIconBadges();
  pwStampChromeCountKinds(document);
  if(window.__pwChromeBadgeCache&&!force){
    var c=window.__pwChromeBadgeCache;
    pwSetChromeCountBadgeByKind('cart',c.cart);
    pwSetChromeCountBadgeByKind('wishlist',c.wishlist);
    pwSetChromeCountBadgeByKind('recently-viewed',c.recently);
    pwSetChromeCountBadgeByKind('notifications',c.notifications);
    return;
  }
  var got={cart:0,notifications:0,recently:0,wishlist:0};
  var pending=4;
  function finish(){
    pending-=1;
    if(pending>0)return;
    window.__pwChromeBadgeCache=got;
    if(pwIsAdminChromePreview()&&!got.cart&&!got.notifications&&!got.recently){
      pwApplyDemoChromeCountBadges(document);
    }
  }
  apiFetch(CART_API).then(function(res){
    if(res.ok){
      got.cart=cartQty(res.j&&res.j.items);
      pwSetChromeCountBadgeByKind('cart',got.cart);
    }
  }).catch(function(){}).then(finish);
  apiFetch(FAV_API).then(function(res){
    if(res.ok){
      got.wishlist=(res.j&&typeof res.j.count==='number')?res.j.count:((res.j&&res.j.products)||[]).length;
      pwSetChromeCountBadgeByKind('wishlist',got.wishlist);
    }
  }).catch(function(){}).then(finish);
  apiFetch(RECENT_API).then(function(res){
    if(res.ok){
      got.recently=(res.j&&typeof res.j.count==='number')?res.j.count:((res.j&&res.j.products)||[]).length;
      pwSetChromeCountBadgeByKind('recently-viewed',got.recently);
    }
  }).catch(function(){}).then(finish);
  apiFetch(NOTIF_API).then(function(res){
    if(res.ok){
      got.notifications=(res.j&&typeof res.j.unreadCount==='number')?res.j.unreadCount:0;
      pwSetChromeCountBadgeByKind('notifications',got.notifications);
    }
  }).catch(function(){}).then(finish);
}
if(document.documentElement.getAttribute('data-pw-shop-actions-events')!=='1'){
  document.documentElement.setAttribute('data-pw-shop-actions-events','1');
  document.addEventListener('pw-cart-updated', function(){hydrateChromeBadges(true);});
  document.addEventListener('pw-shop-notifications-refresh', function(){hydrateChromeBadges(true);});
}
function runHydrate(forceNetwork){
  if(window.__pwShopHydrating)return;
  window.__pwShopHydrating=true;
  try{
    enhanceCards();
    hydrateChromeBadges(!!forceNetwork);
    hydrateContactChatLinks(!!forceNetwork);
    hydrateFavoriteButtons(!!forceNetwork);
    bindShareLeadCoupon();
  }finally{
    window.__pwShopHydrating=false;
  }
}
function run(){captureGoogleDiscount();captureAffiliate();runHydrate(true);
  if(document.documentElement.getAttribute('data-pw-shop-actions-mo')==='1')return;
  document.documentElement.setAttribute('data-pw-shop-actions-mo','1');
  var moTimer=null;
  var obs=typeof MutationObserver!=='undefined'?new MutationObserver(function(recs){
    if(window.__pwShopHydrating)return;
    if(recs&&recs.length){
      var onlyVe=true;
      for(var ri=0;ri<recs.length;ri++){
        var tg=recs[ri].target;
        var el=tg&&(tg.nodeType===1?tg:tg.parentNode);
        if(!el||!el.closest||!el.closest('#nanoai-ve-gap-pluses,.nanoai-ve-ignore,[data-nanoai-ve-ignore]')){onlyVe=false;break;}
      }
      if(onlyVe)return;
    }
    if(moTimer)clearTimeout(moTimer);
    moTimer=setTimeout(function(){
      if(window.__pwShopHydrating)return;
      runHydrate(false);
    },240);
  }):null;
  if(obs)obs.observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}
