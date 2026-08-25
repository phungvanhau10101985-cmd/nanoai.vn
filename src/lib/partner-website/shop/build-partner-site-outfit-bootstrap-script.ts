import type { WebLocale } from '@/lib/i18n/config'
import { partnerSiteOutfitApiPath, partnerSiteProductPath, partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_EL, pwElAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SHOP_CARD_IMG_JS } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_OUTFIT_CSS } from '@/lib/partner-website/shop/outfit-products-css'

/**
 * Hydrate [data-pw-outfit] PDP grids from complementary inventory
 * (GET /api/site/{slug}/products/outfit).
 */
export function buildPartnerSiteOutfitBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale
  const t = getPartnerSiteShopCopy(locale)
  const api = partnerSiteOutfitApiPath(slug)
  const productsPath = partnerSiteProductsPath(slug)
  const detailPrefix = partnerSiteProductPath(slug, '__ID__').replace('__ID__', '')
  const copy = {
    subtitle: t.outfitSubtitle,
    empty: t.outfitEmpty,
    error: t.outfitError,
    seeAll: t.outfitSeeAll,
    loadMore: t.loadMore,
    slotsAria: t.outfitSlotsAria,
  }

  return `<script data-pw-outfit-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(api)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var DETAIL_PREFIX=${JSON.stringify(detailPrefix)};
var LOCALE=${JSON.stringify(locale)};
var COPY=${JSON.stringify(copy)};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
${PW_SHOP_CARD_IMG_JS}
function currentProductId(el){
  return String((el&&el.getAttribute('data-exclude'))||document.body.getAttribute('data-inventory-id')||'').trim();
}
function outfitLayout(){
  var html=document.documentElement;
  var d=html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||'';
  if(d==='mobile'||d==='tablet')return 'mobile';
  if(d==='desktop'||d==='laptop')return 'desktop';
  return window.innerWidth>=1280?'desktop':'mobile';
}
function renderCard(item){
  var p=item&&item.product?item.product:item||{};
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var price=esc(p.priceHint||'');
  var reason=esc((item&&item.reasons&&item.reasons[0])||'');
  return '<article class="pw-product-card pw-outfit-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'"><a class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} href="'+esc(href)+'">'+(img?'<img src="'+img+'" alt="" loading="lazy"/>':'')+'</a><div class="pw-product-card-body pw-outfit-card-body"><h4 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h4>'+(reason?'<p class="pw-outfit-reason">'+reason+'</p>':'')+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+'</div></article>';
}
function hideBrokenCardImgs(root){
  var imgs=(root||document).querySelectorAll('.pw-product-card-media img,[data-pw-el="card-media"] img');
  for(var i=0;i<imgs.length;i++){
    var imgEl=imgs[i];
    imgEl.addEventListener('load',function(){this.style.visibility='';});
    imgEl.addEventListener('error',function(){this.style.visibility='hidden';});
    if(imgEl.complete&&imgEl.naturalWidth===0&&(imgEl.currentSrc||''))imgEl.style.visibility='hidden';
  }
}
function ensureActions(el){
  var actions=el.querySelector('.pw-outfit-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='pw-outfit-actions';
    var grid=el.querySelector('[data-pw-grid]');
    if(grid&&grid.parentNode)grid.parentNode.insertBefore(actions,grid.nextSibling);
    else el.appendChild(actions);
  }
  var more=actions.querySelector('[data-pw-outfit-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-outfit-more';
    more.setAttribute('data-pw-outfit-more','1');
    more.innerHTML='<span class="pw-outfit-more-icon" aria-hidden="true">↻</span> '+esc(COPY.loadMore);
    actions.appendChild(more);
  }
  var all=actions.querySelector('[data-pw-el="section-more"],.pw-outfit-all');
  if(!all){
    all=document.createElement('a');
    all.className='pw-outfit-all';
    all.setAttribute('data-pw-el','section-more');
    all.textContent=COPY.seeAll;
    all.href=el.getAttribute('data-more-href')||PRODUCTS_PATH;
    actions.appendChild(all);
  }
  return {more:more,all:all};
}
function paintSlice(el){
  var st=el._pwOutfit;if(!st)return;
  var slot=st.slots[st.active]||null;
  var items=slot&&slot.items?slot.items:[];
  var grid=el.querySelector('[data-pw-grid]');if(!grid)return;
  grid.classList.add('pw-product-grid','pw-outfit-grid');
  grid.innerHTML=items.slice(0,st.visible).map(renderCard).join('');
  hideBrokenCardImgs(grid);
  var ui=ensureActions(el);
  ui.more.hidden=st.visible>=items.length;
  if(slot&&slot.listingHref)ui.all.setAttribute('href',slot.listingHref);
  ui.all.hidden=items.length===0;
  var tabs=el.querySelectorAll('[data-pw-outfit-slot]');
  for(var i=0;i<tabs.length;i++){
    var on=tabs[i].getAttribute('data-pw-outfit-slot')===st.active;
    tabs[i].setAttribute('aria-selected',on?'true':'false');
    tabs[i].classList.toggle('is-active',on);
  }
}
function renderSlots(el,slots){
  var host=el.querySelector('[data-pw-outfit-slots]');
  if(!host){
    host=document.createElement('div');
    host.className='pw-outfit-slots';
    host.setAttribute('role','tablist');
    host.setAttribute('data-pw-outfit-slots','1');
    host.setAttribute('aria-label',COPY.slotsAria);
    var title=el.querySelector('[data-pw-el="section-title"]');
    if(title&&title.parentNode)title.parentNode.insertBefore(host,title.nextSibling);
    else el.insertBefore(host,el.firstChild);
  }
  host.innerHTML=slots.map(function(slot,i){
    return '<button type="button" class="pw-outfit-slot'+(i===0?' is-active':'')+'" role="tab" data-pw-outfit-slot="'+esc(slot.id)+'" aria-selected="'+(i===0?'true':'false')+'">'+esc(slot.label)+'</button>';
  }).join('');
}
function hydrate(el){
  if(pwShopLiveUiOff())return;
  var grid=el.querySelector('[data-pw-grid]');
  var empty=el.querySelector('.pw-outfit-empty,.pw-catalog-empty');
  var id=currentProductId(el);
  if(!grid||!id){
    if(!id)el.hidden=true;
    return;
  }
  var limit=Math.max(1,Math.min(12,parseInt(el.getAttribute('data-limit')||'12',10)||12));
  fetch(API+'?inventoryId='+encodeURIComponent(id)+'&limit='+limit+'&locale='+encodeURIComponent(LOCALE),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};});}).then(function(res){
    var data=res.j||{};
    var slots=data.slots||[];
    if(!res.ok||!data.applicable||!slots.length){
      grid.innerHTML='';
      if(empty){empty.hidden=false;empty.textContent=res.ok?COPY.empty:COPY.error;}
      var emptyUi=ensureActions(el);
      emptyUi.more.hidden=true;
      emptyUi.all.hidden=true;
      el.hidden=true;
      return;
    }
    var title=el.querySelector('[data-pw-el="section-title"]');
    if(title&&data.anchor&&data.anchor.title)title.textContent=data.anchor.title;
    var sub=el.querySelector('.pw-outfit-subtitle');
    if(sub)sub.textContent=COPY.subtitle;
    renderSlots(el,slots);
    var step=outfitLayout()==='desktop'?5:2;
    el._pwOutfit={slots:slots,active:slots[0].id,visible:Math.min(step,slots[0].items.length),step:step};
    if(empty)empty.hidden=true;
    paintSlice(el);
    el.hidden=false;
  }).catch(function(){
    grid.innerHTML='';
    if(empty){empty.hidden=false;empty.textContent=COPY.error;}
    el.hidden=true;
  });
}
function ensureStyles(){
  if(document.getElementById('pw-outfit-css'))return;
  var st=document.createElement('style');
  st.id='pw-outfit-css';
  st.textContent=${JSON.stringify(PW_OUTFIT_CSS)};
  document.head.appendChild(st);
}
function run(){
  ensureStyles();
  document.querySelectorAll('[data-pw-outfit],[data-pw-grid-kind="outfit"]').forEach(function(el){
    var grid=el.querySelector('[data-pw-grid]');
    if(!(grid&&grid.children.length)) el.hidden=true;
    hydrate(el);
  });
  if(!document.documentElement.getAttribute('data-pw-outfit-bound')){
    document.documentElement.setAttribute('data-pw-outfit-bound','1');
    document.addEventListener('click',function(ev){
      var t=ev.target;if(!t||!t.closest)return;
      var slotBtn=t.closest('[data-pw-outfit-slot]');
      var more=t.closest('[data-pw-outfit-more]');
      var host=(slotBtn||more)&& (slotBtn||more).closest('[data-pw-outfit],[data-pw-grid-kind="outfit"]');
      if(!host||!host._pwOutfit)return;
      if(slotBtn){
        ev.preventDefault();
        var next=slotBtn.getAttribute('data-pw-outfit-slot');
        if(!next||next===host._pwOutfit.active)return;
        var found=null;
        for(var i=0;i<host._pwOutfit.slots.length;i++){if(host._pwOutfit.slots[i].id===next)found=host._pwOutfit.slots[i];}
        if(!found)return;
        host._pwOutfit.active=next;
        host._pwOutfit.visible=Math.min(host._pwOutfit.step,found.items.length);
        paintSlice(host);
        return;
      }
      if(more){
        ev.preventDefault();
        var st=host._pwOutfit;
        var cur=null;
        for(var j=0;j<st.slots.length;j++){if(st.slots[j].id===st.active)cur=st.slots[j];}
        var total=cur&&cur.items?cur.items.length:0;
        st.visible=Math.min(st.visible+st.step,total);
        paintSlice(host);
      }
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}
