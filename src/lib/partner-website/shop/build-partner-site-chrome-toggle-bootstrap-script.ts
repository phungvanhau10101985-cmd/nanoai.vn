import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteCategoryNavLabels } from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoriesApiPath,
  partnerSiteCategoryPath,
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

/**
 * Live HTML shop: open/close category + account chrome, fill mega menu from
 * GET /api/site/{slug}/categories.
 */
export function buildPartnerSiteChromeToggleBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale
  const shop = getPartnerSiteShopCopy(locale)
  const nav = getPartnerSiteCategoryNavLabels(locale)
  const catApi = partnerSiteCategoriesApiPath(slug)
  const productsPath = partnerSiteProductsPath(slug)
  const salePath = partnerSiteInfoPath(slug, 'sale')
  const catPrefix = partnerSiteCategoryPath(slug, '__PATH__').replace('__PATH__', '')

  return `<script data-pw-chrome-toggle-bootstrap>(function(){
window.__pwChromeToggleBoot=1;
var CAT_API=${JSON.stringify(catApi)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var SALE_PATH=${JSON.stringify(salePath)};
var CAT_PREFIX=${JSON.stringify(catPrefix)};
var LOCALE=${JSON.stringify(locale)};
var COPY=${JSON.stringify({
    categories: shop.navCategories,
    newArrivals: nav.newArrivals,
    sale: nav.sale,
  })};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function catName(n){
  var i18n=n&&(n.nameI18n||n.name_i18n)||{};
  return String((i18n[LOCALE]||(n&&n.name)||'')).trim();
}
function catHref(path){
  var segs=String(path||'').split('/').map(function(s){return s.trim()}).filter(Boolean).map(encodeURIComponent);
  return segs.length?CAT_PREFIX+segs.join('/'):PRODUCTS_PATH;
}
function catSel(){return '[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn'}
function panelSel(){return '#pw-shop-cat-panel,#pw-cat-panel,[data-pw-cat-panel],.pw-shop-cat-panel,.pw-cat-panel'}
function accBtnSel(){return '[data-pw-account-toggle],.pw-account-btn,.pw-shop-account-wrap > .pw-shop-icon-btn,.pw-account-wrap > button'}
function accPanelSel(){return '#pw-shop-account-panel,#pw-account-panel,[data-pw-account-panel],.pw-shop-account-panel,.pw-account-panel'}
function ensureCatPanel(btn){
  var panel=document.querySelector(panelSel());
  if(panel)return panel;
  panel=document.createElement('nav');
  panel.id='pw-shop-cat-panel';
  panel.className='pw-shop-cat-panel pw-cat-panel';
  panel.setAttribute('data-pw-cat-panel','1');
  panel.setAttribute('aria-label',COPY.categories);
  var host=(btn&&btn.parentNode)||document.querySelector('.pw-brand-cluster,.pw-shop-brand-cluster,header')||document.body;
  host.appendChild(panel);
  return panel;
}
function fillCatPanel(panel,tree){
  if(!panel||panel.getAttribute('data-pw-cat-filled')==='1')return;
  var html='<a href="'+esc(PRODUCTS_PATH)+'" data-pw-el="nav-link">'+esc(COPY.newArrivals)+'</a>';
  var list=Array.isArray(tree)?tree:[];
  for(var i=0;i<list.length;i++){
    var n=list[i];
    var label=catName(n);
    if(!label)continue;
    html+='<a href="'+esc(catHref(n.path||n.slug||''))+'" data-pw-el="nav-link">'+esc(label)+'</a>';
  }
  html+='<a href="'+esc(SALE_PATH)+'" class="is-sale pw-nav-sale" data-pw-el="nav-link">'+esc(COPY.sale)+'</a>';
  panel.innerHTML=html;
  panel.setAttribute('data-pw-cat-filled','1');
}
function closeEl(btn,panel){
  if(panel)panel.classList.remove('is-open');
  if(btn)btn.setAttribute('aria-expanded','false');
}
function togglePair(btn,panel,otherBtn,otherPanel){
  if(!btn||!panel)return;
  var open=panel.classList.toggle('is-open');
  btn.setAttribute('aria-expanded',open?'true':'false');
  if(open)closeEl(otherBtn,otherPanel);
}
function bindToggles(){
  var catBtns=document.querySelectorAll(catSel());
  if(!catBtns.length)return;
  var panel=ensureCatPanel(catBtns[0]);
  var accBtn=document.querySelector(accBtnSel());
  var accPanel=document.querySelector(accPanelSel());
  for(var i=0;i<catBtns.length;i++){
    var btn=catBtns[i];
    if(btn.getAttribute('data-pw-toggle-bound'))continue;
    btn.setAttribute('data-pw-toggle-bound','1');
    if(panel&&panel.id)btn.setAttribute('aria-controls',panel.id);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      togglePair(e.currentTarget,panel,accBtn,accPanel);
    });
  }
  if(accBtn&&accPanel&&!accBtn.getAttribute('data-pw-toggle-bound')){
    accBtn.setAttribute('data-pw-toggle-bound','1');
    accBtn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      togglePair(accBtn,accPanel,catBtns[0],panel);
    });
    accPanel.querySelectorAll('a').forEach(function(link){
      link.addEventListener('click',function(){closeEl(accBtn,accPanel)});
    });
  }
  document.addEventListener('click',function(e){
    var t=e.target;
    if(panel&&(panel.contains(t)||(catBtns[0]&&catBtns[0].contains(t))))return;
    if(accPanel&&accBtn&&(accPanel.contains(t)||accBtn.contains(t)))return;
    for(var j=0;j<catBtns.length;j++){if(catBtns[j].contains(t))return;}
    closeEl(catBtns[0],panel);
    closeEl(accBtn,accPanel);
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'){closeEl(catBtns[0],panel);closeEl(accBtn,accPanel);}
  });
}
function hydrateCats(){
  var panel=document.querySelector(panelSel());
  if(!panel)return;
  fetch(CAT_API,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){
    if(j&&Array.isArray(j.tree)&&j.tree.length){
      panel.removeAttribute('data-pw-cat-filled');
      fillCatPanel(panel,j.tree);
    }else if(!panel.querySelector('a')){
      fillCatPanel(panel,[]);
    }
  }).catch(function(){
    if(panel&&!panel.querySelector('a'))fillCatPanel(panel,[]);
  });
}
function boot(){bindToggles();hydrateCats();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>
<style data-pw-chrome-toggle-css>
.pw-cat-panel:not(.is-open),.pw-shop-cat-panel:not(.is-open),[data-pw-cat-panel]:not(.is-open){display:none}
.pw-cat-panel.is-open,.pw-shop-cat-panel.is-open,[data-pw-cat-panel].is-open{display:grid;gap:2px}
</style>`
}
