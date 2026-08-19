import type { WebLocale } from '@/lib/i18n/config'
import {
  getPartnerSiteAccountMenuItems,
  getPartnerSiteCategoryNavLabels,
  partnerSiteAccountMenuIconSvg,
} from '@/lib/partner-website/shop/partner-site-shop-nav-config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCategoriesApiPath,
  partnerSiteCategoryPath,
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

/**
 * Live HTML shop: open/close category + account chrome, fill mega menu from
 * GET /api/site/{slug}/categories. Also upgrades plain `data-pw-chrome-btn`
 * account/category widgets added in Sửa nhanh so they share the same APIs.
 *
 * Account always toggles a dropdown; only menu item clicks navigate.
 * Panels are scoped per device chrome (desktop/laptop/tablet/mobile).
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
  const accountMenu = getPartnerSiteAccountMenuItems({ siteSlug: slug, locale })
    .filter((item) => !item.isHeader)
    .map((item) => ({
      href: item.href,
      label: item.label,
      isAccent: Boolean(item.isAccent),
      icon: partnerSiteAccountMenuIconSvg(item.id),
    }))

  return `<script data-pw-chrome-toggle-bootstrap>(function(){
window.__pwChromeToggleBoot=1;
var CAT_API=${JSON.stringify(catApi)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var SALE_PATH=${JSON.stringify(salePath)};
var CAT_PREFIX=${JSON.stringify(catPrefix)};
var LOCALE=${JSON.stringify(locale)};
var ACCOUNT_MENU=${JSON.stringify(accountMenu)};
var COPY=${JSON.stringify({
    categories: shop.navCategories,
    account: shop.navAccount,
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
function catSel(){return '[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn="categories"]'}
function panelSel(){return '[data-pw-cat-panel],.pw-shop-cat-panel,.pw-cat-panel,#pw-shop-cat-panel,#pw-cat-panel'}
function accBtnSel(){return '[data-pw-account-toggle],.pw-account-btn,[data-pw-chrome-btn="account"],.pw-bottom-nav a[href$="/account"],.pw-shop-bottom-nav a[href$="/account"]'}
function accPanelSel(){return '[data-pw-account-panel],.pw-shop-account-panel,.pw-account-panel,#pw-shop-account-panel,#pw-account-panel'}
function deviceRoot(el){
  return (el&&el.closest&&el.closest('[data-pw-visual-device],.pw-visual-desktop,.pw-visual-laptop,.pw-visual-tablet,.pw-visual-mobile'))||document;
}
function qs(root,sel){return (root||document).querySelector(sel)}
function isInsidePanel(el,sel){return !!(el&&el.closest&&el.closest(sel))}
function ensureAccountWrap(btn){
  if(!btn)return null;
  if(btn.closest&&btn.closest('.pw-bottom-nav,.pw-shop-bottom-nav'))return null;
  var wrap=btn.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
  if(wrap)return wrap;
  wrap=document.createElement('div');
  wrap.className='pw-account-wrap pw-chrome-account-wrap';
  if(btn.parentNode){
    btn.parentNode.insertBefore(wrap,btn);
    wrap.appendChild(btn);
  }
  return wrap;
}
function ensureCatWrap(btn){
  if(!btn)return null;
  var wrap=btn.closest('.pw-chrome-cat-wrap,.pw-brand-cluster,.pw-shop-brand-cluster');
  if(wrap)return wrap;
  wrap=document.createElement('span');
  wrap.className='pw-chrome-cat-wrap';
  if(btn.parentNode){
    btn.parentNode.insertBefore(wrap,btn);
    wrap.appendChild(btn);
  }
  return wrap;
}
function fillCatPanel(panel,tree){
  if(!panel)return;
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
function fillAccountPanel(panel){
  if(!panel)return;
  if(panel.getAttribute('data-pw-account-menu-v')==='2'&&panel.querySelector('a svg,a .pw-shop-account-icon'))return;
  var html='';
  for(var i=0;i<ACCOUNT_MENU.length;i++){
    var item=ACCOUNT_MENU[i];
    var cls=item.isAccent?' class="is-accent"':'';
    html+='<a href="'+esc(item.href)+'"'+cls+' data-pw-el="menu-item">'+(item.icon||'')+'<span>'+esc(item.label)+'</span></a>';
  }
  panel.innerHTML=html;
  panel.setAttribute('data-pw-account-filled','1');
  panel.setAttribute('data-pw-account-menu-v','2');
}
function ensureCatPanel(btn){
  var wrap=ensureCatWrap(btn);
  var local=wrap?wrap.querySelector(panelSel()):null;
  if(local)return local;
  var root=deviceRoot(btn);
  local=qs(root,panelSel());
  if(local&&(!wrap||wrap.contains(local)))return local;
  var panel=document.createElement('nav');
  var suffix=(root!==document&&root.getAttribute&&root.getAttribute('data-pw-visual-device'))||'main';
  panel.id='pw-shop-cat-panel-'+suffix;
  panel.className='pw-shop-cat-panel pw-cat-panel';
  panel.setAttribute('data-pw-cat-panel','1');
  panel.setAttribute('aria-label',COPY.categories);
  if(wrap)wrap.appendChild(panel);
  else if(btn&&btn.parentNode)btn.parentNode.insertBefore(panel,btn.nextSibling);
  else document.body.appendChild(panel);
  return panel;
}
function ensureAccPanel(btn){
  var wrap=ensureAccountWrap(btn);
  var local=wrap?wrap.querySelector(accPanelSel()):null;
  if(local){fillAccountPanel(local);return local;}
  var panel=document.createElement('nav');
  var root=deviceRoot(btn);
  var suffix=(root!==document&&root.getAttribute&&root.getAttribute('data-pw-visual-device'))||'main';
  panel.id='pw-shop-account-panel-'+suffix;
  panel.className='pw-shop-account-panel pw-account-panel';
  panel.setAttribute('data-pw-account-panel','1');
  panel.setAttribute('aria-label',COPY.account);
  if(wrap)wrap.appendChild(panel);
  else if(btn&&btn.parentNode)btn.parentNode.insertBefore(panel,btn.nextSibling);
  else document.body.appendChild(panel);
  fillAccountPanel(panel);
  return panel;
}
function normalizeCatBtns(){
  var nodes=document.querySelectorAll(catSel());
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(isInsidePanel(el,panelSel())||isInsidePanel(el,accPanelSel()))continue;
    if(!el.getAttribute('data-pw-cat-toggle'))el.setAttribute('data-pw-cat-toggle','1');
    if(!el.getAttribute('data-pw-el'))el.setAttribute('data-pw-el','cat-toggle');
    if(el.tagName&&el.tagName.toLowerCase()==='a'){
      var href=el.getAttribute('href');
      if(href)el.setAttribute('data-pw-cat-fallback-href',href);
      el.removeAttribute('href');
      el.setAttribute('role','button');
      el.setAttribute('aria-haspopup','true');
      el.setAttribute('tabindex','0');
    }
    ensureCatWrap(el);
  }
}
function normalizeAccountBtns(){
  var nodes=document.querySelectorAll(accBtnSel());
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    if(isInsidePanel(el,accPanelSel())||isInsidePanel(el,panelSel()))continue;
    if(!el.getAttribute('data-pw-account-toggle'))el.setAttribute('data-pw-account-toggle','1');
    if(!el.getAttribute('data-pw-el'))el.setAttribute('data-pw-el','account');
    if(!el.getAttribute('data-pw-chrome-btn'))el.setAttribute('data-pw-chrome-btn','account');
    if(el.tagName&&el.tagName.toLowerCase()==='a'){
      var href=el.getAttribute('href');
      if(href)el.setAttribute('data-pw-account-fallback-href',href);
      el.removeAttribute('href');
      el.setAttribute('role','button');
      el.setAttribute('aria-haspopup','menu');
      el.setAttribute('tabindex','0');
    }
    ensureAccountWrap(el);
  }
}
function clearPanelPos(panel){
  if(!panel||!panel.style)return;
  panel.style.position='';
  panel.style.left='';
  panel.style.top='';
  panel.style.right='';
  panel.style.bottom='';
  panel.style.zIndex='';
  panel.style.visibility='';
  panel.style.display='';
  panel.removeAttribute('data-pw-panel-fixed');
}
function restorePanelHome(panel){
  if(!panel)return;
  var home=panel.__pwHomeParent;
  if(home&&panel.parentNode===document.body){
    try{home.appendChild(panel);}catch(errHome){}
  }
  panel.__pwHomeParent=null;
  panel.__pwOwnerBtn=null;
}
function placePanelFixed(btn,panel){
  if(!btn||!panel)return;
  panel.__pwOwnerBtn=btn;
  if(panel.parentNode!==document.body){
    panel.__pwHomeParent=panel.parentNode;
    document.body.appendChild(panel);
  }
  panel.classList.add('is-open');
  panel.setAttribute('data-pw-panel-fixed','1');
  panel.style.position='fixed';
  panel.style.zIndex='99999';
  panel.style.right='auto';
  panel.style.bottom='auto';
  panel.style.visibility='hidden';
  panel.style.display='grid';
  var pw=Math.max(panel.offsetWidth||0,220);
  var ph=panel.offsetHeight||0;
  var r=btn.getBoundingClientRect();
  var left=Math.round(r.right-pw);
  if(left<8)left=8;
  if(left+pw>window.innerWidth-8)left=Math.max(8,window.innerWidth-pw-8);
  var top=Math.round(r.bottom+8);
  if(top+Math.max(ph,40)>window.innerHeight-8&&r.top>ph+16)top=Math.round(r.top-Math.max(ph,40)-8);
  panel.style.left=left+'px';
  panel.style.top=top+'px';
  panel.style.visibility='';
}
function closeEl(btn,panel){
  if(panel){
    panel.classList.remove('is-open');
    clearPanelPos(panel);
    restorePanelHome(panel);
  }
  if(btn)btn.setAttribute('aria-expanded','false');
}
function togglePair(btn,panel,otherBtn,otherPanel){
  if(!btn||!panel)return;
  var open=!panel.classList.contains('is-open');
  if(open){
    closeEl(otherBtn,otherPanel);
    placePanelFixed(btn,panel);
    btn.setAttribute('aria-expanded','true');
  }else{
    closeEl(btn,panel);
  }
}
function repositionOpenPanels(){
  var panels=document.querySelectorAll('[data-pw-panel-fixed].is-open');
  for(var i=0;i<panels.length;i++){
    var p=panels[i];
    var b=p.__pwOwnerBtn;
    if(b&&b.getBoundingClientRect)placePanelFixed(b,p);
  }
}
function bindPanelLinks(panel){
  if(!panel)return;
  panel.querySelectorAll('a').forEach(function(link){
    if(link.getAttribute('data-pw-acc-link-bound'))return;
    link.setAttribute('data-pw-acc-link-bound','1');
    link.addEventListener('click',function(){
      var btn=panel.__pwOwnerBtn;
      if(!btn){
        var wrap=panel.closest('.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap');
        btn=wrap?wrap.querySelector(accBtnSel()):null;
      }
      closeEl(btn,panel);
    });
  });
}
function bindToggles(){
  normalizeCatBtns();
  normalizeAccountBtns();
  var catBtns=document.querySelectorAll(catSel());
  var accBtns=document.querySelectorAll(accBtnSel());
  var i;
  for(i=0;i<catBtns.length;i++){
    var btn=catBtns[i];
    if(isInsidePanel(btn,panelSel())||isInsidePanel(btn,accPanelSel()))continue;
    var panel=ensureCatPanel(btn);
    if(btn.getAttribute('data-pw-toggle-bound'))continue;
    btn.setAttribute('data-pw-toggle-bound','1');
    if(panel&&panel.id)btn.setAttribute('aria-controls',panel.id);
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var cur=e.currentTarget;
      var livePanel=ensureCatPanel(cur);
      var root=deviceRoot(cur);
      var liveAccBtn=qs(root,accBtnSel());
      var liveAcc=liveAccBtn?ensureAccPanel(liveAccBtn):qs(root,accPanelSel());
      if(livePanel&&!livePanel.querySelector('a'))hydrateCats();
      togglePair(cur,livePanel,liveAccBtn,liveAcc);
    });
  }
  for(i=0;i<accBtns.length;i++){
    var ab=accBtns[i];
    if(isInsidePanel(ab,accPanelSel())||isInsidePanel(ab,panelSel()))continue;
    var accPanel=ensureAccPanel(ab);
    bindPanelLinks(accPanel);
    if(ab.getAttribute('data-pw-toggle-bound'))continue;
    ab.setAttribute('data-pw-toggle-bound','1');
    if(accPanel&&accPanel.id)ab.setAttribute('aria-controls',accPanel.id);
    ab.setAttribute('aria-expanded',accPanel&&accPanel.classList.contains('is-open')?'true':'false');
    ab.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      var cur=e.currentTarget;
      var liveAcc=ensureAccPanel(cur);
      bindPanelLinks(liveAcc);
      var root=deviceRoot(cur);
      var liveCatBtn=qs(root,catSel());
      var livePanel=liveCatBtn?ensureCatPanel(liveCatBtn):qs(root,panelSel());
      togglePair(cur,liveAcc,liveCatBtn,livePanel);
    });
  }
  if(!document.documentElement.getAttribute('data-pw-chrome-toggle-doc')){
    document.documentElement.setAttribute('data-pw-chrome-toggle-doc','1');
    window.addEventListener('scroll',repositionOpenPanels,true);
    window.addEventListener('resize',repositionOpenPanels);
    document.addEventListener('click',function(e){
      var t=e.target;
      var liveCatBtns=document.querySelectorAll(catSel());
      var liveAccBtns=document.querySelectorAll(accBtnSel());
      var livePanels=document.querySelectorAll(panelSel());
      var liveAccs=document.querySelectorAll(accPanelSel());
      var j,k;
      for(j=0;j<liveCatBtns.length;j++){if(liveCatBtns[j].contains(t))return;}
      for(j=0;j<liveAccBtns.length;j++){
        if(isInsidePanel(liveAccBtns[j],accPanelSel()))continue;
        if(liveAccBtns[j].contains(t))return;
      }
      for(j=0;j<livePanels.length;j++){if(livePanels[j].contains(t))return;}
      for(j=0;j<liveAccs.length;j++){if(liveAccs[j].contains(t))return;}
      for(j=0;j<liveCatBtns.length;j++){
        var root=deviceRoot(liveCatBtns[j]);
        closeEl(liveCatBtns[j],qs(root,panelSel())||ensureCatPanel(liveCatBtns[j]));
      }
      for(j=0;j<liveAccBtns.length;j++){
        if(isInsidePanel(liveAccBtns[j],accPanelSel()))continue;
        closeEl(liveAccBtns[j],ensureAccPanel(liveAccBtns[j]));
      }
    });
    document.addEventListener('keydown',function(e){
      if(e.key!=='Escape')return;
      var liveCatBtns=document.querySelectorAll(catSel());
      var liveAccBtns=document.querySelectorAll(accBtnSel());
      var j;
      for(j=0;j<liveCatBtns.length;j++)closeEl(liveCatBtns[j],ensureCatPanel(liveCatBtns[j]));
      for(j=0;j<liveAccBtns.length;j++){
        if(isInsidePanel(liveAccBtns[j],accPanelSel()))continue;
        closeEl(liveAccBtns[j],ensureAccPanel(liveAccBtns[j]));
      }
    });
  }
}
function hydrateCats(){
  var btns=document.querySelectorAll(catSel());
  var panels=[];
  var i;
  for(i=0;i<btns.length;i++){
    if(isInsidePanel(btns[i],panelSel()))continue;
    panels.push(ensureCatPanel(btns[i]));
  }
  if(!panels.length){
    var orphan=document.querySelector(panelSel());
    if(orphan)panels.push(orphan);
  }
  if(!panels.length)return;
  fetch(CAT_API,{credentials:'same-origin'}).then(function(r){return r.json()}).then(function(j){
    var tree=(j&&Array.isArray(j.tree))?j.tree:[];
    for(i=0;i<panels.length;i++){
      panels[i].removeAttribute('data-pw-cat-filled');
      fillCatPanel(panels[i],tree);
    }
  }).catch(function(){
    for(i=0;i<panels.length;i++){
      if(!panels[i].querySelector('a'))fillCatPanel(panels[i],[]);
    }
  });
}
function boot(){bindToggles();hydrateCats();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
var moTimer=null;
var mo=typeof MutationObserver!=='undefined'?new MutationObserver(function(){
  if(moTimer)clearTimeout(moTimer);
  moTimer=setTimeout(function(){
    bindToggles();
    var panels=document.querySelectorAll(panelSel());
    var need=false,i;
    for(i=0;i<panels.length;i++){if(!panels[i].querySelector('a')){need=true;break;}}
    if(need)hydrateCats();
  },100);
}):null;
if(mo)mo.observe(document.documentElement,{childList:true,subtree:true});
})();</script>
<style data-pw-chrome-toggle-css>
.pw-chrome-cat-wrap,.pw-account-wrap,.pw-shop-account-wrap,.pw-chrome-account-wrap{position:relative;display:inline-flex;align-items:center}
.pw-cat-panel:not(.is-open),.pw-shop-cat-panel:not(.is-open),[data-pw-cat-panel]:not(.is-open),
.pw-account-panel:not(.is-open),.pw-shop-account-panel:not(.is-open),[data-pw-account-panel]:not(.is-open){display:none!important}
.pw-cat-panel.is-open,.pw-shop-cat-panel.is-open,[data-pw-cat-panel].is-open,
.pw-account-panel.is-open,.pw-shop-account-panel.is-open,[data-pw-account-panel].is-open{
  display:grid!important;gap:2px;min-width:220px;padding:6px;background:#fff;border:1px solid #e5e7eb;
  border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.12)
}
.pw-cat-panel.is-open:not([data-pw-panel-fixed]),.pw-shop-cat-panel.is-open:not([data-pw-panel-fixed]),
[data-pw-cat-panel].is-open:not([data-pw-panel-fixed]),
.pw-account-panel.is-open:not([data-pw-panel-fixed]),.pw-shop-account-panel.is-open:not([data-pw-panel-fixed]),
[data-pw-account-panel].is-open:not([data-pw-panel-fixed]){
  position:absolute;right:0;left:auto;top:calc(100% + 8px);z-index:120
}
.pw-account-panel.is-open a,.pw-shop-account-panel.is-open a,[data-pw-account-panel].is-open a,
.pw-cat-panel.is-open a,.pw-shop-cat-panel.is-open a,[data-pw-cat-panel].is-open a{
  display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;font-size:13px;font-weight:600;
  color:#374151;text-decoration:none;white-space:nowrap
}
.pw-account-panel.is-open a svg,.pw-shop-account-panel.is-open a svg,[data-pw-account-panel].is-open a svg,
.pw-account-panel.is-open .pw-shop-account-icon,.pw-shop-account-panel.is-open .pw-shop-account-icon{
  width:18px;height:18px;flex-shrink:0;stroke:currentColor;fill:none
}
.pw-account-panel.is-open a:hover,.pw-shop-account-panel.is-open a:hover,[data-pw-account-panel].is-open a:hover,
.pw-cat-panel.is-open a:hover,.pw-shop-cat-panel.is-open a:hover,[data-pw-cat-panel].is-open a:hover{
  background:var(--pw-surface,#f3f4f6);color:var(--pw-primary,#2563eb)
}
.pw-account-panel.is-open a.is-header,.pw-shop-account-panel.is-open a.is-header{background:#eff6ff;color:#2563eb;border-left:3px solid #2563eb;font-weight:700}
.pw-account-panel.is-open a.is-accent,.pw-shop-account-panel.is-open a.is-accent{background:var(--pw-surface,#f3f4f6);color:var(--pw-accent,#ea580c);border-left:3px solid var(--pw-primary,#2563eb);font-weight:700}
[data-pw-chrome-btn="account"][role="button"],[data-pw-account-toggle]{cursor:pointer}
</style>`
}
