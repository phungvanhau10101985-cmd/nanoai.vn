import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteCartApiPath,
  partnerSiteCartPath,
  partnerSiteContactChannelsApiPath,
  partnerSiteNotificationsApiPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductApiPath,
  partnerSiteProductPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_CHROME_COUNT_BADGE_RUNTIME_JS } from '@/lib/partner-website/shop/chrome-count-badges'

const COPY: Record<
  WebLocale,
  {
    addToCart: string
    addedToCart: string
    favoriteAdd: string
    favoriteRemove: string
    error: string
  }
> = {
  vi: {
    addToCart: 'Thêm vào giỏ',
    addedToCart: 'Đã thêm vào giỏ.',
    favoriteAdd: 'Thích',
    favoriteRemove: 'Bỏ thích',
    error: 'Không thực hiện được. Thử lại.',
  },
  en: {
    addToCart: 'Add to cart',
    addedToCart: 'Added to cart.',
    favoriteAdd: 'Favorite',
    favoriteRemove: 'Unfavorite',
    error: 'Action failed. Try again.',
  },
  zh: {
    addToCart: '加入购物车',
    addedToCart: '已加入购物车。',
    favoriteAdd: '收藏',
    favoriteRemove: '取消收藏',
    error: '操作失败，请重试。',
  },
  ja: {
    addToCart: 'カートに追加',
    addedToCart: 'カートに追加しました。',
    favoriteAdd: 'お気に入り',
    favoriteRemove: '解除',
    error: '失敗しました。再試行してください。',
  },
  ko: {
    addToCart: '장바구니',
    addedToCart: '담았습니다.',
    favoriteAdd: '찜',
    favoriteRemove: '찜 해제',
    error: '실패했습니다. 다시 시도하세요.',
  },
}

/**
 * Same-platform shop: wire [data-pw-add-cart] / [data-pw-favorite] and
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
  const cartPath = partnerSiteCartPath(slug)
  const productApiPrefix = partnerSiteProductApiPath(slug, '__ID__').replace('__ID__', '')
  const detailPrefix = partnerSiteProductPath(slug, '__ID__').replace('__ID__', '')

  return `<script data-pw-shop-actions-bootstrap>(function(){
var CART_API=${JSON.stringify(cartApi)};
var EVENTS_API=${JSON.stringify(eventsApi)};
var FAV_API=${JSON.stringify(favApi)};
var RECENT_API=${JSON.stringify(recentApi)};
var NOTIF_API=${JSON.stringify(notifApi)};
var CONTACT_API=${JSON.stringify(contactApi)};
var PRODUCT_API_PREFIX=${JSON.stringify(productApiPrefix)};
var CART_PATH=${JSON.stringify(cartPath)};
var DETAIL_PREFIX=${JSON.stringify(detailPrefix)};
var COPY=${JSON.stringify(copy)};
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var SESSION_HDR='x-guest-session-id';
var UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function authHeaders(){var h={};var s=sessionId();if(s)h[SESSION_HDR]=s;return h;}
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
function readProductFromEl(el){
  var id=(el.getAttribute('data-inventory-id')||el.getAttribute('data-pw-inventory-id')||'').trim();
  if(!id||!UUID_RE.test(id)){
    var host=el.closest('[data-inventory-id],[data-pw-inventory-id],article,.pw-product-card,.pw-shop-card');
    if(host){
      id=(host.getAttribute('data-inventory-id')||host.getAttribute('data-pw-inventory-id')||'').trim();
      if(!id||!UUID_RE.test(id)){
        var a=host.querySelector('a[href*="/products/"]');
        if(a)id=productIdFromHref(a.getAttribute('href'));
      }
    }
  }
  if(!id||!UUID_RE.test(id))return null;
  var host2=el.closest('article,.pw-product-card,.pw-shop-card')||el;
  var nameEl=host2.querySelector('h3,h2,.pw-product-name,strong');
  var priceEl=host2.querySelector('.pw-price,.pw-shop-price');
  var imgEl=host2.querySelector('img');
  var linkEl=host2.querySelector('a[href*="/products/"]');
  var productUrl=(linkEl&&linkEl.href)||(DETAIL_PREFIX+id);
  return {
    inventory_id:id,
    name:(nameEl&&nameEl.textContent||'Product').trim(),
    price_hint:(priceEl&&priceEl.textContent||'').trim(),
    image_url:(imgEl&&imgEl.getAttribute('src'))||'',
    product_url:productUrl
  };
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
function addToCart(product){
  return resolveCartCard(product).then(function(card){
    if(!card){toast(COPY.error);return null;}
    return apiFetch(CART_API).then(function(res){
      var items=(res.j&&res.j.items)||[];
      if(!Array.isArray(items))items=[];
      var line={id:uuid(),card:card,quantity:1,color:'',size:'',note:''};
      var key=((line.card.product_url||'')+'|'+line.color+'|'+line.size).toLowerCase();
      var found=false;
      for(var i=0;i<items.length;i++){
        var it=items[i];var k=(((it.card&&it.card.product_url)||'')+'|'+(it.color||'')+'|'+(it.size||'')).toLowerCase();
        if(k===key){it.quantity=Math.min(99,(Number(it.quantity)||1)+1);found=true;break;}
      }
      if(!found)items.push(line);
      return apiFetch(CART_API,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:items})});
    });
  }).then(function(res){
    if(!res)return;
    if(!res.ok){toast(COPY.error);return;}
    toast(COPY.addedToCart);
    try{document.dispatchEvent(new CustomEvent('pw-cart-updated'));}catch(e){}
    hydrateChromeBadges(true);
  });
}
function toggleFavorite(product,btn){
  return apiFetch(EVENTS_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'toggle_favorite',inventory_id:product.inventory_id})}).then(function(res){
    if(!res.ok){toast(COPY.error);return;}
    var on=!!(res.j&&res.j.is_favorite);
    if(btn){btn.setAttribute('aria-pressed',on?'true':'false');btn.textContent=on?COPY.favoriteRemove:COPY.favoriteAdd;btn.classList.toggle('is-active',on);}
    hydrateChromeBadges(true);
  });
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
document.addEventListener('click',function(ev){
  var t=ev.target;if(!t||!t.closest)return;
  var addBtn=t.closest('[data-pw-add-cart]');
  if(addBtn){
    ev.preventDefault();ev.stopPropagation();
    var p=readProductFromEl(addBtn);if(!p){toast(COPY.error);return;}
    addBtn.disabled=true;
    addToCart(p).finally(function(){addBtn.disabled=false;});
    return;
  }
  var favBtn=t.closest('[data-pw-favorite]');
  if(favBtn){
    ev.preventDefault();ev.stopPropagation();
    var p2=readProductFromEl(favBtn);if(!p2){toast(COPY.error);return;}
    favBtn.disabled=true;
    toggleFavorite(p2,favBtn).finally(function(){favBtn.disabled=false;});
  }
},true);
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
function hydrateContactChatLinks(){
  var zalo=document.querySelectorAll('[data-pw-chrome-btn="chat-zalo"],[data-pw-contact-channel="zalo"]');
  var fb=document.querySelectorAll('[data-pw-chrome-btn="chat-facebook"],[data-pw-contact-channel="facebook"]');
  if(!zalo.length&&!fb.length)return;
  function apply(nodes,url){
    var i,el;
    for(i=0;i<nodes.length;i++){
      el=nodes[i];
      if(url){
        el.setAttribute('href',url);
        el.removeAttribute('data-pw-contact-pending');
        el.removeAttribute('aria-disabled');
        el.setAttribute('target','_blank');
        el.setAttribute('rel','noopener noreferrer');
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
  apiFetch(CONTACT_API).then(function(res){
    var c=res.ok&&res.j&&res.j.channels?res.j.channels:{};
    apply(zalo,c.zaloUrl||'');
    apply(fb,c.messengerUrl||'');
  }).catch(function(){
    apply(zalo,'');
    apply(fb,'');
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
document.addEventListener('pw-cart-updated', function(){hydrateChromeBadges(true);});
document.addEventListener('pw-shop-notifications-refresh', function(){hydrateChromeBadges(true);});
function run(){enhanceCards();hydrateChromeBadges(true);hydrateContactChatLinks();
  var moTimer=null;
  var obs=typeof MutationObserver!=='undefined'?new MutationObserver(function(){
    if(moTimer)clearTimeout(moTimer);
    moTimer=setTimeout(function(){
      enhanceCards();
      hydrateChromeBadges(false);
      hydrateContactChatLinks();
    },120);
  }):null;
  if(obs)obs.observe(document.documentElement,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}
