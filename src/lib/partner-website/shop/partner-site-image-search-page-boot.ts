import { PARTNER_PUBLIC_INVENTORY_SEARCH_MAX } from '@/lib/messaging/partner-public-search-limits'
import {
  PW_PENDING_IMAGE_EVENT,
  PW_PENDING_IMAGE_KEY,
} from '@/lib/partner-website/shop/partner-site-pending-image'
import { partnerSiteSearchImageApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

const PW_SHOP_SOFT_NAV_EVENT = 'pw-shop-soft-nav'

export const PW_IMAGE_SEARCH_BOOT_KEY = '__pwImageSearchBoot'
export const PW_IMAGE_SEARCH_BOOT_EVENT = 'pw-image-search-boot-ready'
export const PW_IMAGE_SEARCH_BOOT_SCRIPT_ID = 'pw-image-search-boot'
export const PW_IMAGE_SEARCH_EAGER_ID = 'pw-image-search-eager'
export const PW_IMAGE_SEARCH_REACT_ATTR = 'data-pw-image-search-react'
export const PW_IMAGE_SEARCH_APPLIED_ATTR = 'data-pw-image-search-applied'
export const PW_IMAGE_SEARCH_BOOT_RUN = '__pwRunImageSearchBoot'

export type PartnerSiteImageSearchBoot = {
  started: boolean
  loading: boolean
  previewDataUrl: string | null
  products: unknown[] | null
  error: string | null
  requestId?: string
}

type ImageSearchBootWindow = Window & {
  [PW_IMAGE_SEARCH_BOOT_KEY]?: PartnerSiteImageSearchBoot
  [PW_IMAGE_SEARCH_BOOT_RUN]?: () => void
}

/** Inline script: consume pending image, POST, and paint results before React hydrates. */
export function buildPartnerSiteImageSearchPageBootScript(siteSlug: string): string {
  const api = partnerSiteSearchImageApiPath(siteSlug)
  return `(function(){
  var KEY=${JSON.stringify(PW_IMAGE_SEARCH_BOOT_KEY)};
  var EVT=${JSON.stringify(PW_IMAGE_SEARCH_BOOT_EVENT)};
  var STORE=${JSON.stringify(PW_PENDING_IMAGE_KEY)};
  var PEND=${JSON.stringify(PW_PENDING_IMAGE_EVENT)};
  var SOFT=${JSON.stringify(PW_SHOP_SOFT_NAV_EVENT)};
  var EAGER=${JSON.stringify(PW_IMAGE_SEARCH_EAGER_ID)};
  var REACT_ATTR=${JSON.stringify(PW_IMAGE_SEARCH_REACT_ATTR)};
  var APPLIED_ATTR=${JSON.stringify(PW_IMAGE_SEARCH_APPLIED_ATTR)};
  var RUN=${JSON.stringify(PW_IMAGE_SEARCH_BOOT_RUN)};
  var LIMIT=${JSON.stringify(String(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX))};
  function pathOf(href){
    try{
      if(href){
        var u=new URL(String(href),location.href);
        return String(u.pathname||'').replace(/\\/$/,'');
      }
    }catch(eH){}
    try{return String(location.pathname||'').replace(/\\/$/,'');}catch(eP){return '';}
  }
  function onImageSearchPage(href){
    return /\\/tim-theo-anh$/.test(pathOf(href));
  }
  function emit(){
    try{window.dispatchEvent(new Event(EVT));}catch(eD){}
  }
  function esc(s){
    return String(s==null?'':s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  }
  function lang(){
    try{
      var raw=String((document.documentElement&&document.documentElement.lang)||'').slice(0,2).toLowerCase();
      if(raw==='en'||raw==='zh'||raw==='ja'||raw==='ko')return raw;
    }catch(eL){}
    return 'vi';
  }
  function soldLabel(){
    var map={vi:'Đã bán',en:'Sold',zh:'已售',ja:'販売',ko:'판매'};
    return map[lang()]||map.vi;
  }
  function favLabel(){
    var map={vi:'Thêm yêu thích',en:'Add to favorites',zh:'加入收藏',ja:'お気に入りに追加',ko:'찜하기'};
    return map[lang()]||map.vi;
  }
  function resultHeading(n){
    var map={
      vi:'Kết quả ('+n+')',
      en:'Results ('+n+')',
      zh:'结果（'+n+'）',
      ja:'結果（'+n+'）',
      ko:'결과 ('+n+')'
    };
    return map[lang()]||map.vi;
  }
  function loadingHeading(){
    var map={vi:'Đang tìm…',en:'Searching…',zh:'正在搜索…',ja:'検索中…',ko:'검색 중…'};
    return map[lang()]||map.vi;
  }
  function headingHtml(text){
    return '<h2 data-pw-el="section-title" style="font-size:14px;margin:0 0 12px;width:fit-content;padding-bottom:4px;border-bottom:1px solid color-mix(in srgb, var(--pw-primary) 40%, transparent)">'+esc(text)+'</h2>';
  }
  function reactRoot(){
    try{return document.querySelector('['+REACT_ATTR+']');}catch(eR){return null;}
  }
  function reactApplied(){
    var el=reactRoot();
    return !!(el&&el.getAttribute(APPLIED_ATTR)==='1');
  }
  function isMisplaced(host){
    try{
      if(!host||!host.parentNode)return false;
      var p=host.parentNode;
      if(p===document.body||p===document.documentElement)return true;
      var header=document.querySelector('header,[data-pw-region="header"],[data-pw-live-chrome],.pw-header,.pw-shop-header');
      if(header&&(host.compareDocumentPosition(header)&4))return true;
    }catch(eM){}
    return false;
  }
  function ensureHost(){
    if(typeof document==='undefined')return null;
    var host=document.getElementById(EAGER);
    var react=reactRoot();
    if(!host){
      if(!react||!react.parentNode)return null;
      host=document.createElement('div');
      host.id=EAGER;
      react.parentNode.insertBefore(host,react);
      return host;
    }
    if(react&&react.parentNode&&host.nextSibling!==react){
      react.parentNode.insertBefore(host,react);
    }
    return host;
  }
  function paintHost(host,state,html,hidden){
    var prev='';
    try{prev=String(host.getAttribute('data-pw-image-search-eager-state')||'');}catch(eG){}
    if(prev!==state){
      try{host.setAttribute('data-pw-image-search-eager-state',state);}catch(eS){}
      host.innerHTML=html;
    }
    if(host.hidden!==hidden)host.hidden=hidden;
  }
  var painting=false;
  var observed=false;
  function watchSlot(){
    if(observed)return;
    observed=true;
    try{
      if(typeof MutationObserver==='undefined')return;
      var mo=new MutationObserver(function(){
        if(!onImageSearchPage())return;
        paintEager();
      });
      var root=document.documentElement||document.body;
      if(root)mo.observe(root,{childList:true,subtree:true});
    }catch(eO){}
  }
  function numOrZero(v){
    var n=Number(v);
    return isFinite(n)&&n>0?n:0;
  }
  function cardHtml(p){
    if(!p||typeof p!=='object')return '';
    var id=esc(p.id||p.inventory_id||'');
    var name=esc(p.name||'');
    var href=esc(p.detailPath||p.detail_path||p.product_url||'#');
    var img=esc(p.imageUrl||p.image_url||'');
    var price=esc(p.priceHint||p.price_hint||'');
    var rating=numOrZero(p.ratingScore!=null?p.ratingScore:p.rating_score).toFixed(1);
    var sold=Math.max(0,Math.round(numOrZero(p.purchasesCount!=null?p.purchasesCount:p.purchases_count)));
    var heart='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
    return '<article class="pw-shop-card pw-product-card" data-pw-el="card"'
      +(id?' data-inventory-id="'+id+'"':'')
      +' data-pw-actions-ready="1">'
      +'<a class="pw-product-card-hit" href="'+href+'" aria-label="'+name+'" tabindex="-1"></a>'
      +'<div class="pw-product-card-media" data-pw-el="card-media">'
      +(img?'<img src="'+img+'" alt="" width="400" height="400" loading="lazy" decoding="async"/>':'')
      +'</div>'
      +'<div class="pw-shop-card-body pw-product-card-body">'
      +'<h3 data-pw-el="card-name">'+name+'</h3>'
      +(price?'<p class="pw-price" data-pw-el="card-price">'+price+'</p>':'')
      +'<div class="pw-rec-stats"><span>★ '+rating+'</span><span>'+esc(soldLabel())+': '+sold+'</span></div>'
      +'</div>'
      +(id?'<button type="button" class="pw-rec-fav" data-pw-favorite="1" data-inventory-id="'+id+'" aria-pressed="false" aria-label="'+esc(favLabel())+'">'+heart+'</button>':'')
      +'</article>';
  }
  function paintEager(){
    if(typeof document==='undefined'||painting)return;
    painting=true;
    try{
    watchSlot();
    var boot=window[KEY];
    if(!boot||!boot.started)return;
    if(reactApplied()){
      var done=document.getElementById(EAGER);
      if(done)paintHost(done,'react','',true);
      var live=reactRoot();
      if(live&&live.hidden)live.hidden=false;
      return;
    }
    var host=ensureHost();
    if(!host)return;
    if(isMisplaced(host)){
      if(!host.hidden)host.hidden=true;
      var liveMis=reactRoot();
      if(liveMis&&liveMis.hidden)liveMis.hidden=false;
      return;
    }
    var react=reactRoot();
    var list=Array.isArray(boot.products)?boot.products:[];
    var requestId=String(boot.requestId||'0');
    if(list.length){
      var html=headingHtml(resultHeading(list.length));
      html+='<div class="pw-shop-grid" data-pw-el="grid" data-pw-grid>';
      var n=Math.min(list.length,12);
      for(var i=0;i<n;i++)html+=cardHtml(list[i]);
      html+='</div>';
      paintHost(host,'results:'+requestId,html,false);
      if(react&&!react.hidden)react.hidden=true;
      return;
    }
    if(boot.loading){
      var skel=headingHtml(loadingHeading());
      skel+='<div class="pw-shop-grid" data-pw-el="grid" aria-hidden="true">';
      for(var s=0;s<10;s++)skel+='<article class="pw-shop-card" style="min-height:220px;background:var(--pw-surface)"></article>';
      skel+='</div>';
      paintHost(host,'loading:'+requestId,skel,false);
      if(react&&!react.hidden)react.hidden=true;
      return;
    }
    paintHost(host,'empty:'+requestId,'',true);
    if(react&&react.hidden)react.hidden=false;
    }finally{
      painting=false;
    }
  }
  function blobFromDataUrl(dataUrl){
    var comma=dataUrl.indexOf(',');
    if(comma<0)return null;
    var header=dataUrl.slice(0,comma);
    var b64=dataUrl.slice(comma+1);
    var mime=(header.match(/data:(.*?);/)||[])[1]||'image/jpeg';
    var binary=atob(b64);
    var bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:mime});
  }
  function startFetch(raw){
    var requestId=String(Date.now())+'-'+String(Math.random());
    window[KEY]={started:true,loading:true,previewDataUrl:raw,products:null,error:null,requestId:requestId};
    emit();
    paintEager();
    var blob=null;
    try{blob=blobFromDataUrl(raw);}catch(eB){}
    if(!blob){
      window[KEY]={started:true,loading:false,previewDataUrl:raw,products:null,error:'invalid',requestId:requestId};
      emit();
      paintEager();
      return;
    }
    var fd=new FormData();
    fd.append('image',blob,'tim-theo-anh.jpg');
    fd.append('limit',LIMIT);
    fetch(${JSON.stringify(api)},{method:'POST',body:fd,credentials:'same-origin'})
      .then(function(r){return r.json();})
      .then(function(j){
        if(!window[KEY]||window[KEY].requestId!==requestId)return;
        var list=j&&Array.isArray(j.products)?j.products:[];
        window[KEY]={
          started:true,
          loading:false,
          previewDataUrl:raw,
          products:list,
          error:j&&j.error?String(j.error):null,
          requestId:requestId
        };
        emit();
        paintEager();
      })
      .catch(function(){
        if(!window[KEY]||window[KEY].requestId!==requestId)return;
        window[KEY]={started:true,loading:false,previewDataUrl:raw,products:null,error:'network',requestId:requestId};
        emit();
        paintEager();
      });
  }
  function run(ev){
    var href=ev&&ev.detail&&ev.detail.href;
    if(!onImageSearchPage(href)&&!onImageSearchPage())return;
    var raw='';
    try{raw=String(sessionStorage.getItem(STORE)||'');}catch(eR){}
    var boot=window[KEY];
    if(raw){
      try{sessionStorage.removeItem(STORE);}catch(eS){}
      startFetch(raw);
      return;
    }
    if(boot&&boot.started){
      paintEager();
    }
  }
  window[RUN]=function(){run(null);};
  watchSlot();
  run(null);
  try{
    window.addEventListener(PEND,run);
    window.addEventListener(SOFT,run);
    window.addEventListener('pageshow',run);
  }catch(eL){}
  try{
    if(typeof document!=='undefined'){
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){paintEager();});
      else paintEager();
    }
  }catch(eC){}
})();`
}

export function readPartnerSiteImageSearchBoot(): PartnerSiteImageSearchBoot | null {
  if (typeof window === 'undefined') return null
  const boot = (window as ImageSearchBootWindow)[PW_IMAGE_SEARCH_BOOT_KEY]
  if (!boot || typeof boot !== 'object' || !boot.started) return null
  return boot
}

export function subscribePartnerSiteImageSearchBoot(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(PW_IMAGE_SEARCH_BOOT_EVENT, onStoreChange)
  window.addEventListener(PW_PENDING_IMAGE_EVENT, onStoreChange)
  window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onStoreChange)
  return () => {
    window.removeEventListener(PW_IMAGE_SEARCH_BOOT_EVENT, onStoreChange)
    window.removeEventListener(PW_PENDING_IMAGE_EVENT, onStoreChange)
    window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onStoreChange)
  }
}

export function getPartnerSiteImageSearchBootSnapshot(): PartnerSiteImageSearchBoot | null {
  return readPartnerSiteImageSearchBoot()
}

export function runPartnerSiteImageSearchBoot(): void {
  if (typeof window === 'undefined') return
  const run = (window as ImageSearchBootWindow)[PW_IMAGE_SEARCH_BOOT_RUN]
  if (typeof run === 'function') run()
}
