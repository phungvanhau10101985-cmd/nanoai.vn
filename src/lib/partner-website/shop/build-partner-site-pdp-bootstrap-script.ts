import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteProductApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

/**
 * Live PDP fields on the shared visual shell. Sửa nhanh strips this script;
 * public pages also get a server bind — this keeps inventory current after load.
 */
export function buildPartnerSitePdpBootstrapScript(input: { siteSlug: string; locale?: WebLocale }): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const apiPrefix = partnerSiteProductApiPath(slug, '__ID__').replace('__ID__', '')
  const eventsApi = `/api/site/${encodeURIComponent(slug)}/personalization/events`

  return `<script data-pw-pdp-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
if(pwShopLiveUiOff())return;
if(!document.querySelector('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp'))return;
var API_PREFIX=${JSON.stringify(apiPrefix)};
var EVENTS_API=${JSON.stringify(eventsApi)};
function sessionId(){try{return localStorage.getItem('app_guest_session_id')||localStorage.getItem('nanoai_guest_session_id')||'';}catch(e){return '';}}
function trackView(id){
  if(!id)return;
  var h={'Content-Type':'application/json'};
  var s=sessionId();if(s)h['x-guest-session-id']=s;
  fetch(EVENTS_API,{method:'POST',credentials:'same-origin',headers:h,body:JSON.stringify({event:'view_product',inventory_id:id})}).catch(function(){});
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function productId(){
  var host=document.querySelector('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp,[data-pw-page="product"]');
  var id=(host&&(host.getAttribute('data-inventory-id')||host.getAttribute('data-pw-inventory-id')))||'';
  if(id)return id.trim();
  var m=String(location.pathname||'').match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m?m[0]:'';
}
function setText(el,text){if(el)el.textContent=text;}
function stampId(el,id){if(el&&el.setAttribute)el.setAttribute('data-inventory-id',id);}
function imagesOf(p){
  var out=[],seen={};
  ;(p.galleryImages||[]).concat(p.imageUrl||'',p.detailImages||[]).forEach(function(url){
    var u=String(url||'').trim();
    if(!u||seen[u])return;
    seen[u]=1;out.push(u);
  });
  return out;
}
function apply(p){
  var id=String(p.id||'').trim();
  if(!id)return;
  stampId(document.body,id);
  document.querySelectorAll('[data-pw-region="pdp-info"],[data-pw-region="gallery"],.pw-pdp,.pw-pdp-sticky,[data-pw-pdp-favorite],[data-pw-pdp-add-cart],[data-pw-pdp-buy-now]').forEach(function(el){stampId(el,id);});
  var name=String(p.name||'Product');
  document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="title"],.pw-pdp-title').forEach(function(el){setText(el,name);});
  var sku=String(p.sku||'').trim();
  if(sku){
    document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="sku"],.pw-pdp-sku strong').forEach(function(el){setText(el,sku);});
  }
  var desc=String(p.detailDescription||p.description||'').trim();
  if(desc)document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="desc"]').forEach(function(el){setText(el,desc);});
  var price=String(p.priceHint||'').trim();
  if(price)document.querySelectorAll('[data-pw-region="pdp-info"] [data-pw-el="price"]').forEach(function(el){
    var compare=el.querySelector('[data-pw-el="compare-price"]');
    if(compare){el.childNodes.forEach(function(n){if(n.nodeType===3)n.textContent='';}); el.insertBefore(document.createTextNode(price),el.firstChild);}
    else setText(el,price);
  });
  var imgs=imagesOf(p);
  var main=imgs[0]||'';
  if(main){
    document.querySelectorAll('[data-pw-region="gallery"] img[data-pw-el="main-image"],[data-pw-region="gallery"] .pw-pdp-hero-img,[data-pw-region="gallery"] .pw-shop-product-img').forEach(function(img){
      img.setAttribute('src',main);img.setAttribute('alt',name);
    });
  }
  document.querySelectorAll('[data-pw-region="gallery"] [data-pw-el="thumb"]').forEach(function(thumb,i){
    var url=imgs[i];
    if(!url){thumb.hidden=true;thumb.style.display='none';return;}
    thumb.hidden=false;thumb.style.display='';
    var img=thumb.querySelector('img');
    if(img){img.setAttribute('src',url);img.setAttribute('alt',name);}
  });
  document.querySelectorAll('[data-pw-region="reviews"] [data-pw-el="card"]').forEach(function(card){card.innerHTML='';});
}
var id=productId();
if(!id)return;
trackView(id);
fetch(API_PREFIX+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json();}).then(function(j){
  if(j&&j.product)apply(j.product);
}).catch(function(){});
})();</script>`
}