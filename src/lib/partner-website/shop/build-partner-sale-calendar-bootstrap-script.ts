import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteSaleCopy } from '@/lib/partner-website/promotions/partner-site-sale-display'

export function buildPartnerSaleCalendarBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = `/api/site/${encodeURIComponent(slug)}/sale-calendar`
  const copy = partnerSiteSaleCopy(input.locale)
  return `<script data-pw-sale-calendar-bootstrap>(function(){
if(typeof pwShopLiveUiOff==='function'&&pwShopLiveUiOff())return;
var API=${JSON.stringify(api)},COPY=${JSON.stringify(copy)};
function fmtChip(iso){
  if(!iso)return '';
  var t=Date.parse(iso);if(!Number.isFinite(t))return '';
  var d=t-Date.now();if(d<=0)return '';
  var s=Math.floor(d/1000),days=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60),sec=s%60;
  var hms=('0'+h).slice(-2)+':'+('0'+m).slice(-2)+':'+('0'+sec).slice(-2);
  return days>0?days+'d '+hms:hms;
}
function bannerText(s){
  if(!s||!s.enabled||s.phase==='off'||!(s.discountPercent>0))return '';
  var tpl=s.phase==='active'?COPY.activeBanner:COPY.teaserBanner;
  return tpl.replace('{label}',s.eventLabel||'').replace('{pct}',String(s.discountPercent));
}
function paint(data){
  var s=data&&data.state;if(!s||s.phase==='off'){
    var old=document.querySelector('[data-pw-sale-calendar-banner]');
    if(old)old.remove();
    return;
  }
  var root=document.querySelector('main,[data-pw-scene-root="1"]');if(!root)return;
  var el=document.querySelector('[data-pw-sale-calendar-banner]');
  var phase=s.phase==='active'?'active':'teaser';
  var bg=phase==='active'?'#dc2626':'#d97706';
  if(!el){el=document.createElement('aside');el.setAttribute('data-pw-sale-calendar-banner','1');root.insertBefore(el,root.firstChild);}
  el.setAttribute('data-pw-sale-phase',phase);
  el.style.cssText='position:relative;z-index:2;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:9px 14px;background:'+bg+';color:#fff;font:700 13px/1.35 system-ui,sans-serif;text-align:center';
  var lead=(s.isTest?'[Test] ':'')+bannerText(s);
  el.setAttribute('data-pw-sale-lead',lead);
  el.setAttribute('data-pw-sale-countdown',s.countdownTo||'');
  var count=fmtChip(s.countdownTo);
  el.textContent=count?lead+' · '+(phase==='active'?COPY.remaining:COPY.startsAfter)+' '+count:lead;
}
function tick(){
  var el=document.querySelector('[data-pw-sale-calendar-banner]');
  if(!el)return;
  var iso=el.getAttribute('data-pw-sale-countdown')||'';
  var phase=el.getAttribute('data-pw-sale-phase')||'teaser';
  var lead=el.getAttribute('data-pw-sale-lead')||el.textContent||'';
  var left=fmtChip(iso);
  el.textContent=left?lead+' · '+(phase==='active'?COPY.remaining:COPY.startsAfter)+' '+left:lead;
}
fetch(API,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(function(data){
  paint(data);
  if(!window.__pwSaleBannerTimer)window.__pwSaleBannerTimer=setInterval(tick,1000);
}).catch(function(){});
})();</script>`
}
