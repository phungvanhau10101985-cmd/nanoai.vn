import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

export function buildPartnerMarketingBannerBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = `/api/site/${encodeURIComponent(slug)}/marketing-banners`
  return `<style data-pw-marketing-banner-css>
[data-pw-personalize-banner][data-pw-banner-live="1"]{min-height:0!important;aspect-ratio:21/9;overflow:hidden}
[data-pw-personalize-banner][data-pw-banner-live="1"] [data-pw-el="copy"],
[data-pw-personalize-banner][data-pw-banner-live="1"] [data-pw-el="inner"]{display:none!important}
[data-pw-personalize-banner][data-pw-banner-live="1"] img[data-pw-el="media"]{position:relative!important;inset:auto!important;width:100%!important;height:100%!important;object-fit:contain!important;background:var(--pw-surface,#fff)}
[data-pw-personalize-banner][data-pw-banner-live="off"]{display:none!important}
[data-pw-banner-greeting]{margin:8px 0 12px;text-align:center;font:600 13px/1.4 system-ui,sans-serif;color:var(--pw-text)}
</style>
<script data-pw-marketing-banner-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(api)};
function seed(section){
  if(section.getAttribute('data-pw-seed-src')!=null)return;
  var img=section.querySelector('img[data-pw-el="media"]');
  var title=section.querySelector('[data-pw-el="title"]');
  var sub=section.querySelector('[data-pw-el="subtitle"]');
  section.setAttribute('data-pw-seed-src',img?img.getAttribute('src')||'':'');
  section.setAttribute('data-pw-seed-title',title?String(title.textContent||'').replace(/\\s+/g,' ').trim():'');
  section.setAttribute('data-pw-seed-subtitle',sub?String(sub.textContent||'').replace(/\\s+/g,' ').trim():'');
}
function greetingOf(section){
  var n=section.nextElementSibling;
  return n&&n.getAttribute('data-pw-banner-greeting')==='1'?n:null;
}
function removeGreeting(section){
  var greet=greetingOf(section);
  if(greet)greet.remove();
}
function paint(section,item){
  seed(section);
  var img=section.querySelector('img[data-pw-el="media"]');
  if(!item||!item.image_url){
    removeGreeting(section);
    if(pwShopLiveUiOff()){
      section.removeAttribute('data-pw-banner-live');
      return;
    }
    section.setAttribute('data-pw-banner-live','off');
    return;
  }
  if(img){
    img.setAttribute('src',item.image_url);
    img.removeAttribute('data-pw-banner-placeholder');
    img.alt=item.kind==='birthday'?'Birthday banner':'Sale banner';
  }
  section.setAttribute('data-pw-banner-live','1');
  var greet=greetingOf(section);
  if(item.greeting){
    if(!greet){
      greet=document.createElement('p');
      greet.setAttribute('data-pw-banner-greeting','1');
      section.insertAdjacentElement('afterend',greet);
    }
    greet.textContent=item.greeting;
  }else if(item.is_test&&item.event_label){
    if(!greet){
      greet=document.createElement('p');
      greet.setAttribute('data-pw-banner-greeting','1');
      section.insertAdjacentElement('afterend',greet);
    }
    greet.textContent=item.event_label;
  }else if(greet){greet.remove();}
  var cta=section.querySelector('a[data-pw-el="cta"]');
  if(cta&&item.href)cta.setAttribute('href',item.href);
}
function apply(data){
  var items=data&&data.items?data.items:[];
  var byKind={};
  for(var i=0;i<items.length;i++){byKind[items[i].kind]=items[i];}
  var nodes=document.querySelectorAll('[data-pw-personalize-banner]');
  for(var n=0;n<nodes.length;n++){
    var kind=nodes[n].getAttribute('data-pw-personalize-banner');
    var apiKind=kind==='sale-calendar'?'sale':kind;
    paint(nodes[n],byKind[apiKind]||null);
  }
}
fetch(API,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(apply).catch(function(){});
})();</script>`
}
