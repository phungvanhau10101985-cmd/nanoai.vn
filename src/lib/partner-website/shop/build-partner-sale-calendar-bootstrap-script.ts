import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteSaleCopy,
  PW_SITE_SALE_CARD_CSS,
  PW_SITE_SALE_MO_SKIP_JS,
  PW_SITE_SALE_TICK_CHIPS_JS,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { partnerSiteSaleCalendarApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export function buildPartnerSaleCalendarBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = partnerSiteSaleCalendarApiPath(slug)
  const copy = partnerSiteSaleCopy(input.locale)
  return `<script data-pw-sale-calendar-bootstrap>(function(){
if(typeof pwShopLiveUiOff==='function'&&pwShopLiveUiOff())return;
var API=${JSON.stringify(api)},COPY=${JSON.stringify(copy)};
var PAGES={home:1,listing:1,product:1,cart:1,account:1,info:1};
function pageKind(){
  var html=document.documentElement;
  var page=String(html.getAttribute('data-pw-page')||document.body.getAttribute('data-pw-page')||'');
  if(!page){
    var root=document.querySelector('[data-pw-inline-visual-root][data-pw-page],[data-pw-page]');
    if(root)page=String(root.getAttribute('data-pw-page')||'');
  }
  return page.toLowerCase();
}
function shouldShow(){
  var page=pageKind();
  if(page==='landing')return false;
  if(page==='home')return true;
  if(PAGES[page])return true;
  var path=(location.pathname||'/').replace(/\\/+$/,'')||'/';
  if(path==='/'||/^\\/site\\/[^/]+$/.test(path))return true;
  return true;
}
${PW_SITE_SALE_TICK_CHIPS_JS}
${PW_SITE_SALE_MO_SKIP_JS}
function bannerText(s){
  if(!s||!s.enabled||s.phase==='off'||!(s.discountPercent>0))return '';
  var tpl=s.phase==='active'?COPY.activeBanner:COPY.teaserBanner;
  return tpl.replace('{label}',s.eventLabel||COPY.program||'').replace('{pct}',String(s.discountPercent));
}
function storageKey(s){
  return 'pw_site_sale_banner_'+String((s&&s.eventDate)||'none').slice(0,10)+'_'+String((s&&s.phase)||'off');
}
function dismissed(s){
  try{return sessionStorage.getItem(storageKey(s))==='1';}catch(e){return false;}
}
function ensureCss(){
  if(document.getElementById('pw-site-sale-css'))return;
  var st=document.createElement('style');
  st.id='pw-site-sale-css';
  st.textContent=${JSON.stringify(PW_SITE_SALE_CARD_CSS)};
  document.head.appendChild(st);
}
function hostSlot(){
  var visual=document.querySelector('[data-pw-inline-visual-root]');
  var chrome=document.querySelector('[data-pw-live-chrome]');
  if(chrome&&chrome.parentNode)return {parent:chrome.parentNode,after:chrome};
  if(visual&&visual.parentNode)return {parent:visual.parentNode,before:visual};
  var header=document.querySelector('header.pw-header,header.pw-shop-header,[data-pw-region="header"]');
  if(header){
    var scaled=header.closest&&header.closest('[data-pw-inline-visual-root]');
    if(scaled&&scaled.parentNode)return {parent:scaled.parentNode,before:scaled};
    if(header.parentNode){
      var n=header.nextElementSibling;
      var last=header;
      if(n&&(n.getAttribute('data-pw-region')==='nav'||/(^|\\s)(pw-nav-main|pw-shop-nav-row)(\\s|$)/.test(n.className||''))) last=n;
      return {parent:last.parentNode,after:last};
    }
  }
  var filter=document.querySelector('[data-pw-listing-filter-slot]');
  var main=document.querySelector('main,.pw-shop-main,[data-pw-scene-root="1"]');
  var before=filter||main;
  if(before&&before.parentNode){
    var mainScaled=before.closest&&before.closest('[data-pw-inline-visual-root]');
    if(mainScaled&&mainScaled.parentNode)return {parent:mainScaled.parentNode,before:mainScaled};
    return {parent:before.parentNode,before:before};
  }
  return null;
}
function placeEl(el,slot){
  if(!el||!slot||!slot.parent)return;
  var visual=document.querySelector('[data-pw-inline-visual-root]');
  if(visual&&visual.contains(el)&&el!==visual&&visual.parentNode){
    visual.parentNode.insertBefore(el,visual);
  }
  if(slot.after){
    var next=slot.after.nextSibling;
    if(next!==el)slot.parent.insertBefore(el,next);
    return;
  }
  if(slot.before&&el.nextSibling!==slot.before)slot.parent.insertBefore(el,slot.before);
}
function paint(data){
  window.__pwSaleBannerData=data;
  var s=data&&data.state;
  var old=document.querySelector('[data-pw-sale-calendar-banner]');
  if(old&&old.getAttribute('data-pw-sale-banner-react')==='1')return;
  if(!shouldShow()||!s||s.phase==='off'||dismissed(s)){
    if(old&&old.getAttribute('data-pw-sale-banner-react')!=='1')old.remove();
    return;
  }
  var msg=bannerText(s);
  if(!msg){if(old&&old.getAttribute('data-pw-sale-banner-react')!=='1')old.remove();return;}
  ensureCss();
  var slot=hostSlot();
  if(!slot)return;
  var el=old;
  if(!el){
    el=document.createElement('aside');
    el.setAttribute('data-pw-sale-calendar-banner','1');
    el.setAttribute('role','status');
    el.setAttribute('aria-live','off');
  }
  placeEl(el,slot);
  var phase=s.phase==='active'?'active':'teaser';
  el.setAttribute('data-pw-sale-phase',phase);
  el.setAttribute('data-pw-sale-until',s.countdownTo||'');
  el.removeAttribute('data-pw-sale-countdown');
  var lead=(s.isTest?'[Test] ':'')+(s.eventLabel||COPY.program||'');
  var prefix=String(phase==='active'?COPY.countdownLeft:COPY.countdownStarts||'').replace('{label}',s.eventLabel||COPY.program||'');
  var count=pwSaleFmtChip(s.countdownTo);
  el.innerHTML='<button type="button" data-pw-sale-close aria-label="'+String(COPY.close||'Close').replace(/"/g,'')+'">×</button>'
    +'<p data-pw-sale-title>'+lead.replace(/</g,'&lt;')+'</p>'
    +'<p data-pw-sale-msg>'+msg.replace(/</g,'&lt;')+'</p>'
    +(count?'<span data-pw-sale-count>'+prefix.replace(/</g,'&lt;')+' <strong data-pw-sale-hms>'+count.replace(/</g,'&lt;')+'</strong></span>':'');
  var close=el.querySelector('[data-pw-sale-close]');
  if(close)close.onclick=function(){
    try{sessionStorage.setItem(storageKey(s),'1');}catch(e2){}
    el.remove();
  };
}
function tick(){
  var el=document.querySelector('[data-pw-sale-calendar-banner]');
  if(!el||el.getAttribute('data-pw-sale-banner-react')==='1')return;
  if(typeof pwSaleInView==='function'&&!pwSaleInView(el))return;
  var iso=el.getAttribute('data-pw-sale-until')||el.getAttribute('data-pw-sale-countdown')||'';
  var count=pwSaleFmtChip(iso);
  var node=el.querySelector('[data-pw-sale-count]');
  var hms=el.querySelector('[data-pw-sale-hms]');
  if(!count){if(node)node.remove();return;}
  if(hms){pwSaleSetText(hms,count);return;}
  if(!node){
    var phase=el.getAttribute('data-pw-sale-phase')||'teaser';
    var title=el.querySelector('[data-pw-sale-title]');
    var label=title?String(title.textContent||'').replace(/^\\[Test\\]\\s*/,''):'';
    var prefix=String(phase==='active'?COPY.countdownLeft:COPY.countdownStarts||'').replace('{label}',label||COPY.program||'');
    node=document.createElement('span');
    node.setAttribute('data-pw-sale-count','');
    node.appendChild(document.createTextNode(prefix+' '));
    hms=document.createElement('strong');
    hms.setAttribute('data-pw-sale-hms','1');
    hms.appendChild(document.createTextNode(count));
    node.appendChild(hms);
    el.appendChild(node);
    return;
  }
  pwSaleSetText(node,count);
}
fetch(API,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(data){
  paint(data);
  if(!window.__pwSaleBannerTimer)window.__pwSaleBannerTimer=setInterval(tick,1000);
  if(!window.__pwSaleBannerMo && !document.querySelector('[data-pw-live-chrome]')){
    window.__pwSaleBannerMo=new MutationObserver(function(recs){
      if(pwSaleMoSkip(recs))return;
      if(document.querySelector('[data-pw-live-chrome]')){paint(window.__pwSaleBannerData);window.__pwSaleBannerMo.disconnect();}
    });
    window.__pwSaleBannerMo.observe(document.documentElement,{childList:true,subtree:true});
  }
}).catch(function(){});
})();</script>`
}
