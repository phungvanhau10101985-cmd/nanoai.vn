/**
 * Parser-blocking native navigation for shop storefronts.
 *
 * Next.js App Router + React hydration intercept same-origin `<a>` clicks for client
 * transitions. The first press is swallowed and chrome (Tài khoản / Giỏ hàng) only
 * "blinks" because the DOM is rewritten between pointerdown and click. Bind on
 * `window` capture from a parser-blocking root `<head>` `<script>` (not `next/script`)
 * and hard-navigate with `location.assign` only when App Router is not ready.
 * After hydration, `window.__pwShopSoftNav` (`PartnerSiteSoftNavRelay`) uses
 * `router.push` so the shared account header/sidebar stays mounted.
 *
 * Do not navigate on `pointerdown` — that would start navigation when the customer
 * is scrolling a product card on mobile. Prefetch on pointerdown; navigate on
 * `pointerup` (tap, little movement) so the press still wins when React eats the
 * later `click`. Keep the `<a>` from pointerdown: hydration / badge / wrap can
 * detach `event.target` before pointerup, which would otherwise make closest()
 * miss the link.
 *
 * Listing hearts (`.pw-rec-fav` / `[data-pw-favorite]`) sit on the card photo.
 * Skip navigation when the tap origin is the heart, even if a parent media
 * `<a>` or `.pw-product-card-hit` would otherwise open the product page.
 *
 * Category (`data-pw-chrome-btn="categories"`) and favorite
 * (`[data-pw-favorite]` / `.pw-rec-fav` / dock `favorite-product`) are JS-only:
 * `preventDefault` on click so Next.js does not hijack, but never
 * `stopPropagation` — shop-actions / React `onClick` must still receive the tap.
 *
 * Tap-ack (ripple + pending bar) is prepended so a press is visible before
 * hydration; extra taps while a navigation is in flight are swallowed.
 */
import { buildPartnerSiteTapAckScript } from '@/lib/partner-website/shop/partner-site-tap-ack'

export const PARTNER_SITE_NATIVE_NAV_SCRIPT_ID = 'pw-native-navigation'

const JS_ONLY_CHROME_SEL = [
  '[data-nanoai-open-chat]',
  '[data-nanoai-try-on]',
  '[data-pw-cat-toggle]',
  '[data-pw-el="cat-toggle"]',
  '[data-pw-chrome-btn="categories"]',
  '[data-pw-image-search]',
  '[data-pw-add-cart]',
  '[data-pw-pdp-add-cart]',
  '[data-pw-buy]',
  '[data-pw-favorite]',
  '[data-pw-react-fav]',
  '[data-pw-pdp-favorite]',
  '[data-pw-chrome-btn="favorite-product"]',
  '.pw-rec-fav',
  '.is-fav',
  '[data-pw-head-back]',
  '[data-pw-chrome-btn="back"]',
  '[data-pw-chrome-btn="chat"]',
  '[data-pw-chrome-btn="chat-zalo"]',
  '[data-pw-chrome-btn="chat-facebook"]',
  '[data-pw-chrome-btn="chat-instagram"]',
  '[data-pw-chrome-btn="chat-whatsapp"]',
  '[data-pw-chrome-btn="logout"]',
  '[data-pw-account-logout]',
  '[data-pw-slide-prev]',
  '[data-pw-slide-next]',
  '[data-pw-grid-more]',
  '[data-pw-native-nav="off"]',
].join(',')

export function buildPartnerSiteNativeNavigationScript(siteSlug: string): string {
  const slug = siteSlug.trim()
  const prefix = slug ? `/site/${slug}` : ''
  const prefixEnc = slug ? `/site/${encodeURIComponent(slug)}` : ''
  return `${buildPartnerSiteTapAckScript()}
(function(){
  if(window.__pwNativeNavBound||window.__pwAccountNativeNavBound||window.__pwVisualNativeNavBound){
    window.__pwNativeNavBound=1;
    window.__pwAccountNativeNavBound=1;
    window.__pwVisualNativeNavBound=1;
    return;
  }
  window.__pwNativeNavBound=1;
  window.__pwAccountNativeNavBound=1;
  window.__pwVisualNativeNavBound=1;
  var PREFIX=${JSON.stringify(prefix)};
  var PREFIX_ENC=${JSON.stringify(prefixEnc)};
  var SKIP=${JSON.stringify(JS_ONLY_CHROME_SEL)};
  var tap=null;
  var lastHref='';
  var lastAt=0;
  var jsGateAt=0;
  function liveLink(node){
    if(!node||typeof node.closest!=='function')return null;
    if(node.closest('input,textarea,select,option,[contenteditable="true"]'))return null;
    return node.closest('a[href]');
  }
  function nodeConnected(node){
    if(!node)return false;
    if(node.isConnected===false)return false;
    if(node.isConnected===true)return true;
    try{
      var doc=node.ownerDocument||window.document;
      if(doc&&typeof doc.contains==='function')return doc.contains(node);
    }catch(_){}
    return true;
  }
  function pointNode(x,y){
    try{
      var doc=window.document;
      if(!doc||typeof doc.elementFromPoint!=='function')return null;
      return doc.elementFromPoint(x,y);
    }catch(_){return null;}
  }
  function eventOrigin(event){
    var target=event&&event.target;
    if(nodeConnected(target)&&typeof target.closest==='function')return target;
    if(!event)return null;
    var hit=pointNode(event.clientX,event.clientY);
    if(hit&&typeof hit.closest==='function')return hit;
    return null;
  }
  function isJsOnly(node){
    return !!(node&&typeof node.closest==='function'&&node.closest(SKIP));
  }
  function isCatToggle(node){
    return !!(node&&typeof node.closest==='function'&&node.closest('[data-pw-chrome-btn="categories"],[data-pw-cat-toggle],[data-pw-el="cat-toggle"]'));
  }
  function favNodeFrom(node){
    if(!node||typeof node.closest!=='function')return null;
    return node.closest('[data-pw-favorite],[data-pw-react-fav],[data-pw-pdp-favorite],[data-pw-chrome-btn="favorite-product"],.pw-rec-fav,.is-fav');
  }
  function favAtEvent(event){
    var fav=favNodeFrom(eventOrigin(event));
    if(fav)return fav;
    if(!event)return null;
    try{
      var doc=window.document;
      var list=doc&&typeof doc.elementsFromPoint==='function'?doc.elementsFromPoint(event.clientX||0,event.clientY||0):null;
      if(!list||!list.length)return null;
      for(var i=0;i<list.length;i++){
        fav=favNodeFrom(list[i]);
        if(fav)return fav;
      }
    }catch(_){}
    return null;
  }
  function pointLink(x,y){
    return liveLink(pointNode(x,y));
  }
  function resolveLink(event,saved){
    var origin=eventOrigin(event);
    var link=liveLink(origin);
    if(!link&&event)link=pointLink(event.clientX,event.clientY);
    if(!link)link=saved||null;
    return link;
  }
  function pathOnPlatform(path){
    var p=String(path||'');
    if(PREFIX&&(p===PREFIX||p.indexOf(PREFIX+'/')===0))return true;
    if(PREFIX_ENC&&PREFIX_ENC!==PREFIX&&(p===PREFIX_ENC||p.indexOf(PREFIX_ENC+'/')===0))return true;
    if(!PREFIX&&p.indexOf('/site/')===0)return true;
    return false;
  }
  function onPlatform(){
    return pathOnPlatform(window.location.pathname||'');
  }
  function stripPrefix(path){
    var p=String(path||'');
    if(PREFIX&&(p===PREFIX||p.indexOf(PREFIX+'/')===0))return p.slice(PREFIX.length)||'/';
    if(PREFIX_ENC&&PREFIX_ENC!==PREFIX&&(p===PREFIX_ENC||p.indexOf(PREFIX_ENC+'/')===0))return p.slice(PREFIX_ENC.length)||'/';
    var m=p.match(/^\\/site\\/[^/]+/);
    if(m)return p.slice(m[0].length)||'/';
    return p;
  }
  function rewriteHref(raw){
    var url=new URL(raw,window.location.href);
    if(!onPlatform()&&pathOnPlatform(url.pathname)){
      var nextPath=stripPrefix(url.pathname);
      if(url.origin!==window.location.origin)return window.location.origin+nextPath+url.search+url.hash;
      url.pathname=nextPath;
    }
    return url.href;
  }
  function openHref(href){
    var fn=window.__pwShopSoftNav;
    if(typeof fn==='function'){
      try{fn(href);return;}catch(_){}
    }
    window.location.assign(href);
  }
  function prefetchHref(href){
    var fn=window.__pwShopPrefetch;
    if(typeof fn==='function'){
      try{fn(href);}catch(_){}
    }
  }
  function swallow(event){
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  function ackNav(){
    try{if(typeof window.__pwShopTapAckNav==='function')window.__pwShopTapAckNav();}catch(_){}
  }
  function ackBusy(){
    try{return typeof window.__pwShopTapAckBusy==='function'&&!!window.__pwShopTapAckBusy();}catch(_){return false;}
  }
  function go(event,saved){
    if(event.button!=null&&event.button!==0)return;
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    var origin=eventOrigin(event);
    var fav=favAtEvent(event);
    if(fav||isJsOnly(origin)){
      var cat=isCatToggle(origin);
      if(!cat&&!fav&&ackBusy()){
        swallow(event);
        return;
      }
      if(!cat&&!fav&&(event.type==='click'||event.type==='pointerup')){
        var nowJs=Date.now();
        if(jsGateAt&&nowJs-jsGateAt<650){
          swallow(event);
          return;
        }
        jsGateAt=nowJs;
      }
      if(event.type==='click')event.preventDefault();
      return;
    }
    var link=resolveLink(event,saved);
    if(!link||link.hasAttribute('download'))return;
    if(link.closest(SKIP)){
      if(event.type==='click')event.preventDefault();
      return;
    }
    var targetName=String(link.getAttribute('target')||'').toLowerCase();
    if(targetName&&targetName!=='_self'&&targetName!=='_top')return;
    var raw=String(link.getAttribute('href')||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:javascript|mailto|tel|data):/i.test(raw))return;
    var href='';
    try{href=rewriteHref(raw);}catch(_){return;}
    var next=null;
    try{next=new URL(href,window.location.href);}catch(_){return;}
    if(next.pathname.indexOf('/api/')===0)return;
    if(next.origin===window.location.origin&&next.pathname===window.location.pathname&&next.search===window.location.search){
      return;
    }
    var now=Date.now();
    if(ackBusy()||(lastHref===href&&now-lastAt<800)){
      swallow(event);
      ackNav();
      return;
    }
    lastHref=href;
    lastAt=now;
    swallow(event);
    ackNav();
    openHref(href);
  }
  function onPointerDown(event){
    if(event.button!=null&&event.button!==0)return;
    var dup=false;
    try{if(typeof window.__pwShopTapAckPress==='function')dup=!!window.__pwShopTapAckPress(event);}catch(_){}
    var origin=eventOrigin(event);
    var link=liveLink(origin)||liveLink(event.target);
    tap={id:event.pointerId,x:event.clientX||0,y:event.clientY||0,link:link,skip:!!(favAtEvent(event)||isJsOnly(origin)),dup:dup};
    if(tap.skip||!link||link.closest(SKIP)||link.hasAttribute('download'))return;
    var raw=String(link.getAttribute('href')||'').trim();
    if(!raw||raw.charAt(0)==='#'||/^(?:javascript|mailto|tel|data):/i.test(raw))return;
    try{prefetchHref(rewriteHref(raw));}catch(_){}
  }
  function onPointerUp(event){
    if(!tap||(event.pointerId!=null&&event.pointerId!==tap.id))return;
    var dx=(event.clientX||0)-tap.x;
    var dy=(event.clientY||0)-tap.y;
    var saved=tap.link;
    var skip=tap.skip;
    tap=null;
    if(dx*dx+dy*dy>144)return;
    if(skip)return;
    go(event,saved);
  }
  window.addEventListener('pointerdown',onPointerDown,true);
  window.addEventListener('pointerup',onPointerUp,true);
  window.addEventListener('click',go,true);
})();`
}

/** Native first-click navigation for inline custom-domain visual HTML. */
export function buildPartnerSiteVisualNativeNavigationScript(siteSlug: string): string {
  return buildPartnerSiteNativeNavigationScript(siteSlug)
}

/** Backup for account-chrome; prefer the `<head>` copy from the site / root layout. */
export const PARTNER_SITE_ACCOUNT_NATIVE_NAV_SCRIPT = buildPartnerSiteNativeNavigationScript('')
