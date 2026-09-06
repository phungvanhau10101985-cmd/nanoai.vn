import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PARTNER_MARKETING_BANNER_CAROUSEL_MS } from '@/lib/partner-website/promotions/partner-marketing-banner'

export function buildPartnerMarketingBannerBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = `/api/site/${encodeURIComponent(slug)}/marketing-banners`
  const locale = JSON.stringify(input.locale)
  return `<style data-pw-marketing-banner-css>
[data-pw-personalize-banner][data-pw-banner-live="1"]{min-height:0!important;aspect-ratio:21/9;overflow:hidden;position:relative}
[data-pw-personalize-banner][data-pw-banner-live="1"] [data-pw-el="copy"],
[data-pw-personalize-banner][data-pw-banner-live="1"] [data-pw-el="inner"]{display:none!important}
[data-pw-personalize-banner][data-pw-banner-live="1"] > img[data-pw-el="media"]{display:none!important}
[data-pw-personalize-banner][data-pw-banner-live="off"]{display:none!important}
[data-pw-banner-greeting]{margin:8px 0 12px;text-align:center;font:600 13px/1.4 system-ui,sans-serif;color:var(--pw-text)}
[data-pw-promo-carousel]{position:relative;width:100%;aspect-ratio:21/9;overflow:hidden;background:var(--pw-surface,#fff)}
[data-pw-promo-carousel] a{position:absolute;inset:0;display:block;opacity:0;pointer-events:none;transition:opacity .3s}
[data-pw-promo-carousel] a.is-active{opacity:1;pointer-events:auto;z-index:1}
[data-pw-promo-carousel] img{width:100%;height:100%;object-fit:contain;display:block;background:var(--pw-surface,#fff)}
[data-pw-promo-nav]{position:absolute;top:50%;z-index:2;transform:translateY(-50%);border:0;border-radius:999px;background:color-mix(in srgb,var(--pw-surface,#fff) 92%,transparent);color:var(--pw-primary);padding:6px 10px;font-size:18px;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,.12);cursor:pointer}
[data-pw-promo-prev]{left:8px}
[data-pw-promo-next]{right:8px}
[data-pw-promo-dots]{position:absolute;bottom:8px;left:50%;z-index:2;transform:translateX(-50%);display:flex;gap:6px}
[data-pw-promo-dots] button{width:6px;height:6px;border-radius:999px;border:0;background:color-mix(in srgb,#fff 90%,transparent);padding:0;cursor:pointer;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
[data-pw-promo-dots] button.is-active{width:20px;background:var(--pw-primary)}
</style>
<script data-pw-marketing-banner-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(api)};
var LOCALE=${locale};
var WAIT=${PARTNER_MARKETING_BANNER_CAROUSEL_MS};
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
function altOf(item){
  var pct=String(item.discount_percent||'')+'%';
  if(item.kind==='birthday') return LOCALE==='en'?'Birthday banner '+item.date_key:'Banner mừng sinh nhật '+item.date_key+', tặng '+pct;
  if(item.kind==='warehouse') return LOCALE==='en'?'Warehouse sale banner':'Banner sale kho, giảm '+pct;
  if(item.kind==='regular') return LOCALE==='en'?'Shop banner':'Banner cửa hàng';
  return LOCALE==='en'?'Sale banner '+item.date_key:'Banner sale '+item.date_key+', giảm '+pct;
}
function hideHost(section){
  var greet=greetingOf(section);
  if(greet)greet.remove();
  var live=section.querySelector('[data-pw-promo-carousel]');
  if(live)live.remove();
  if(pwShopLiveUiOff()){
    section.removeAttribute('data-pw-banner-live');
    return;
  }
  section.setAttribute('data-pw-banner-live','off');
}
function paintCarousel(host,items){
  seed(host);
  if(!items||!items.length){
    hideHost(host);
    return;
  }
  host.setAttribute('data-pw-banner-live','1');
  host.setAttribute('data-pw-personalize-banner','promo');
  var existing=host.querySelector('[data-pw-promo-carousel]');
  if(existing)existing.remove();
  var box=document.createElement('div');
  box.setAttribute('data-pw-promo-carousel','1');
  box.setAttribute('aria-label',LOCALE==='vi'?'Ưu đãi dành cho bạn':'Offers for you');
  var index=0;
  var paused=false;
  var swipe=false;
  var startX=null;
  function show(next){
    index=(next+items.length)%items.length;
    var links=box.querySelectorAll('a[data-pw-promo-slide]');
    for(var i=0;i<links.length;i++){
      var on=i===index;
      links[i].classList.toggle('is-active',on);
      links[i].tabIndex=on?0:-1;
      links[i].setAttribute('aria-hidden',on?'false':'true');
    }
    var dots=box.querySelectorAll('[data-pw-promo-dots] button');
    for(var d=0;d<dots.length;d++)dots[d].classList.toggle('is-active',d===index);
    var greet=greetingOf(host);
    var text=items[index]&&items[index].greeting?items[index].greeting:'';
    if(text){
      if(!greet){
        greet=document.createElement('p');
        greet.setAttribute('data-pw-banner-greeting','1');
        host.insertAdjacentElement('afterend',greet);
      }
      greet.textContent=text;
    }else if(greet)greet.remove();
  }
  items.forEach(function(item,i){
    var a=document.createElement('a');
    a.setAttribute('data-pw-promo-slide','1');
    a.href=item.href||'#';
    a.setAttribute('aria-label',altOf(item));
    if(i===0)a.className='is-active';
    a.tabIndex=i===0?0:-1;
    var img=document.createElement('img');
    img.src=item.image_url;
    img.alt=altOf(item);
    img.width=2100;
    img.height=900;
    img.loading='eager';
    img.decoding='async';
    img.addEventListener('error',function(){
      a.remove();
      items.splice(i,1);
      if(!items.length)hideHost(host);
      else show(Math.min(index,items.length-1));
    });
    a.appendChild(img);
    a.addEventListener('click',function(ev){
      if(swipe){ev.preventDefault();swipe=false;}
    });
    box.appendChild(a);
  });
  if(items.length>1){
    var prev=document.createElement('button');
    prev.type='button';
    prev.setAttribute('data-pw-promo-nav','1');
    prev.setAttribute('data-pw-promo-prev','1');
    prev.setAttribute('aria-label',LOCALE==='vi'?'Banner trước':'Previous banner');
    prev.textContent='‹';
    prev.addEventListener('click',function(){show(index-1);});
    var next=document.createElement('button');
    next.type='button';
    next.setAttribute('data-pw-promo-nav','1');
    next.setAttribute('data-pw-promo-next','1');
    next.setAttribute('aria-label',LOCALE==='vi'?'Banner tiếp theo':'Next banner');
    next.textContent='›';
    next.addEventListener('click',function(){show(index+1);});
    var dots=document.createElement('div');
    dots.setAttribute('data-pw-promo-dots','1');
    items.forEach(function(_,i){
      var b=document.createElement('button');
      b.type='button';
      if(i===0)b.className='is-active';
      b.setAttribute('aria-label',(LOCALE==='vi'?'Xem banner ':'View banner ')+(i+1));
      b.addEventListener('click',function(){show(i);});
      dots.appendChild(b);
    });
    box.appendChild(prev);
    box.appendChild(next);
    box.appendChild(dots);
    box.addEventListener('mouseenter',function(){paused=true;});
    box.addEventListener('mouseleave',function(){paused=false;});
    box.addEventListener('focusin',function(){paused=true;});
    box.addEventListener('focusout',function(){paused=false;});
    box.addEventListener('touchstart',function(ev){
      startX=ev.touches[0]?ev.touches[0].clientX:null;
      swipe=false;
      paused=true;
    },{passive:true});
    box.addEventListener('touchend',function(ev){
      paused=false;
      var end=ev.changedTouches[0]?ev.changedTouches[0].clientX:null;
      if(startX==null||end==null)return;
      var dist=end-startX;
      if(Math.abs(dist)<40)return;
      swipe=true;
      show(dist<0?index+1:index-1);
    });
    window.setInterval(function(){
      if(!paused&&items.length>1)show(index+1);
    },WAIT);
  }
  host.insertBefore(box,host.firstChild);
  show(0);
}
function apply(data){
  var items=data&&data.items?data.items:[];
  var nodes=document.querySelectorAll('[data-pw-personalize-banner]');
  if(!nodes.length)return;
  if(pwShopLiveUiOff()){
    for(var e=0;e<nodes.length;e++)seed(nodes[e]);
    return;
  }
  var host=nodes[0];
  for(var n=1;n<nodes.length;n++){
    seed(nodes[n]);
    nodes[n].setAttribute('data-pw-banner-live','off');
    var extraGreet=greetingOf(nodes[n]);
    if(extraGreet)extraGreet.remove();
  }
  paintCarousel(host,items);
}
fetch(API,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(apply).catch(function(){});
})();</script>`
}
