import { PARTNER_PUBLIC_INVENTORY_SEARCH_MAX } from '@/lib/messaging/partner-public-search-limits'
import { PW_PENDING_IMAGE_KEY } from '@/lib/partner-website/shop/partner-site-pending-image'
import { partnerSiteSearchImageApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const PW_IMAGE_SEARCH_BOOT_KEY = '__pwImageSearchBoot'
export const PW_IMAGE_SEARCH_BOOT_EVENT = 'pw-image-search-boot-ready'
export const PW_IMAGE_SEARCH_BOOT_SCRIPT_ID = 'pw-image-search-boot'

export type PartnerSiteImageSearchBoot = {
  started: boolean
  loading: boolean
  previewDataUrl: string | null
  products: unknown[] | null
  error: string | null
}

type ImageSearchBootWindow = Window & {
  [PW_IMAGE_SEARCH_BOOT_KEY]?: PartnerSiteImageSearchBoot
}

/** Inline script: consume pending image and POST search before React hydrates. */
export function buildPartnerSiteImageSearchPageBootScript(siteSlug: string): string {
  const api = partnerSiteSearchImageApiPath(siteSlug)
  return `(function(){
  var KEY=${JSON.stringify(PW_IMAGE_SEARCH_BOOT_KEY)};
  var EVT=${JSON.stringify(PW_IMAGE_SEARCH_BOOT_EVENT)};
  var STORE=${JSON.stringify(PW_PENDING_IMAGE_KEY)};
  var LIMIT=${JSON.stringify(String(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX))};
  var path='';
  try{path=String(location.pathname||'').replace(/\\/$/,'');}catch(eP){}
  if(!/\\/tim-theo-anh$/.test(path))return;
  if(window[KEY]&&window[KEY].started)return;
  var raw='';
  try{raw=String(sessionStorage.getItem(STORE)||'');}catch(eR){}
  if(!raw)return;
  try{sessionStorage.removeItem(STORE);}catch(eS){}
  window[KEY]={started:true,loading:true,previewDataUrl:raw,products:null,error:null};
  try{window.dispatchEvent(new Event(EVT));}catch(eD){}
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
  var blob=null;
  try{blob=blobFromDataUrl(raw);}catch(eB){}
  if(!blob){
    window[KEY].loading=false;
    window[KEY].error='invalid';
    try{window.dispatchEvent(new Event(EVT));}catch(eE){}
    return;
  }
  var fd=new FormData();
  fd.append('image',blob,'tim-theo-anh.jpg');
  fd.append('limit',LIMIT);
  fetch(${JSON.stringify(api)},{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.json();})
    .then(function(j){
      var list=j&&Array.isArray(j.products)?j.products:[];
      window[KEY].loading=false;
      window[KEY].products=list;
      window[KEY].error=j&&j.error?String(j.error):null;
      try{window.dispatchEvent(new Event(EVT));}catch(eF){}
    })
    .catch(function(){
      window[KEY].loading=false;
      window[KEY].error='network';
      try{window.dispatchEvent(new Event(EVT));}catch(eG){}
    });
})();`
}

export function readPartnerSiteImageSearchBoot(): PartnerSiteImageSearchBoot | null {
  if (typeof window === 'undefined') return null
  const boot = (window as ImageSearchBootWindow)[PW_IMAGE_SEARCH_BOOT_KEY]
  if (!boot || typeof boot !== 'object' || !boot.started) return null
  return boot
}
