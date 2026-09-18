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
  function reactRoot(){
    try{return document.querySelector('['+REACT_ATTR+']');}catch(eR){return null;}
  }
  function reactApplied(){
    var el=reactRoot();
    return !!(el&&el.getAttribute(APPLIED_ATTR)==='1');
  }
  function ensureHost(){
    if(typeof document==='undefined')return null;
    var host=document.getElementById(EAGER);
    if(host)return host;
    host=document.createElement('div');
    host.id=EAGER;
    var react=reactRoot();
    if(react&&react.parentNode)react.parentNode.insertBefore(host,react);
    else{
      var main=document.querySelector('main')||document.body;
      if(!main)return null;
      main.insertBefore(host,main.firstChild||null);
    }
    return host;
  }
  function cardHtml(p){
    if(!p||typeof p!=='object')return '';
    var name=esc(p.name||'');
    var href=esc(p.detailPath||p.detail_path||p.product_url||'#');
    var img=esc(p.imageUrl||p.image_url||'');
    var price=esc(p.priceHint||p.price_hint||'');
    return '<article class="pw-shop-card" style="min-height:160px">'
      +'<a href="'+href+'" style="color:inherit;text-decoration:none;display:block">'
      +(img?'<img src="'+img+'" alt="" width="400" height="400" style="width:100%;aspect-ratio:1;object-fit:cover;display:block;background:var(--pw-surface,#f3f4f6)"/>':'')
      +'<p style="margin:8px 0 4px;font-size:13px;font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">'+name+'</p>'
      +(price?'<p class="pw-shop-muted" style="margin:0;font-size:12px">'+price+'</p>':'')
      +'</a></article>';
  }
  function paintEager(){
    if(typeof document==='undefined')return;
    var boot=window[KEY];
    if(!boot||!boot.started)return;
    if(reactApplied()){
      var done=document.getElementById(EAGER);
      if(done){done.hidden=true;done.innerHTML='';}
      var live=reactRoot();
      if(live)live.hidden=false;
      return;
    }
    var host=ensureHost();
    if(!host)return;
    var react=reactRoot();
    var list=Array.isArray(boot.products)?boot.products:[];
    if(list.length){
      var html='<div class="pw-shop-grid" data-pw-el="grid" data-pw-grid>';
      var n=Math.min(list.length,12);
      for(var i=0;i<n;i++)html+=cardHtml(list[i]);
      html+='</div>';
      host.innerHTML=html;
      host.hidden=false;
      if(react)react.hidden=true;
      return;
    }
    if(boot.loading){
      var skel='<div class="pw-shop-grid" data-pw-el="grid" aria-hidden="true">';
      for(var s=0;s<10;s++)skel+='<article class="pw-shop-card" style="min-height:220px;background:var(--pw-surface)"></article>';
      skel+='</div>';
      host.innerHTML=skel;
      host.hidden=false;
      if(react)react.hidden=true;
      return;
    }
    host.innerHTML='';
    host.hidden=true;
    if(react)react.hidden=false;
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
    window[KEY]={started:true,loading:true,previewDataUrl:raw,products:null,error:null};
    emit();
    paintEager();
    var blob=null;
    try{blob=blobFromDataUrl(raw);}catch(eB){}
    if(!blob){
      window[KEY]={started:true,loading:false,previewDataUrl:raw,products:null,error:'invalid'};
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
        var list=j&&Array.isArray(j.products)?j.products:[];
        window[KEY]={
          started:true,
          loading:false,
          previewDataUrl:raw,
          products:list,
          error:j&&j.error?String(j.error):null
        };
        emit();
        paintEager();
      })
      .catch(function(){
        window[KEY]={started:true,loading:false,previewDataUrl:raw,products:null,error:'network'};
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
