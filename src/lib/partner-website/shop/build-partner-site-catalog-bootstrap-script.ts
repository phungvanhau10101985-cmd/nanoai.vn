import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteCategoryPath,
  partnerSiteProductApiPath,
  partnerSiteProductPath,
  partnerSiteProductsApiPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SHOP_CARD_IMG_JS } from '@/lib/partner-website/shop/inventory-shop-detail'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'

const COPY: Record<
  WebLocale,
  {
    empty: string
    viewCta: string
    addToCart: string
    favorite: string
    seeAll: string
    loadMore: string
    relatedEmpty: string
    error: string
  }
> = {
  vi: {
    empty: 'Chưa có sản phẩm trong kho shop.',
    viewCta: 'Xem chi tiết',
    addToCart: 'Thêm vào giỏ',
    favorite: 'Thích',
    seeAll: 'Xem tất cả',
    loadMore: 'Xem thêm',
    relatedEmpty: 'Không có sản phẩm khác cùng danh mục.',
    error: 'Không tải được sản phẩm.',
  },
  en: {
    empty: 'No products in the shop inventory yet.',
    viewCta: 'View details',
    addToCart: 'ADD TO CART',
    favorite: 'Favorite',
    seeAll: 'See all',
    loadMore: 'Load more',
    relatedEmpty: 'No other products in this category.',
    error: 'Could not load products.',
  },
  zh: {
    empty: '店铺库存暂无商品。',
    viewCta: '查看详情',
    addToCart: '加入购物车',
    favorite: '收藏',
    seeAll: '查看全部',
    loadMore: '加载更多',
    relatedEmpty: '该分类暂无其他商品。',
    error: '无法加载商品。',
  },
  ja: {
    empty: 'ショップの在庫に商品がありません。',
    viewCta: '詳細を見る',
    addToCart: 'カートに追加',
    favorite: 'お気に入り',
    seeAll: 'すべて見る',
    loadMore: 'もっと見る',
    relatedEmpty: 'このカテゴリに他の商品はありません。',
    error: '商品を読み込めませんでした。',
  },
  ko: {
    empty: '샵 재고에 상품이 없습니다.',
    viewCta: '자세히 보기',
    addToCart: '장바구니',
    favorite: '찜',
    seeAll: '전체 보기',
    loadMore: '더 보기',
    relatedEmpty: '이 카테고리에 다른 상품이 없습니다.',
    error: '상품을 불러오지 못했습니다.',
  },
}

/**
 * Hydrate [data-pw-catalog] grids from same-platform shop inventory
 * (GET /api/site/{slug}/products) — real chat-shop products, not mockup images.
 */
export function buildPartnerSiteCatalogBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale in COPY ? input.locale : 'en'
  const copy = COPY[locale]
  const api = partnerSiteProductsApiPath(slug)
  const productsPath = partnerSiteProductsPath(slug)
  const detailPrefix = partnerSiteProductPath(slug, '__ID__').replace('__ID__', '')
  const productApiPrefix = partnerSiteProductApiPath(slug, '__ID__').replace('__ID__', '')
  const categoryPrefix = partnerSiteCategoryPath(slug, '__PATH__').replace('__PATH__', '')

  return `<script data-pw-catalog-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(api)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var DETAIL_PREFIX=${JSON.stringify(detailPrefix)};
var PRODUCT_API_PREFIX=${JSON.stringify(productApiPrefix)};
var CATEGORY_PREFIX=${JSON.stringify(categoryPrefix)};
var COPY=${JSON.stringify(copy)};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
${PW_SHOP_CARD_IMG_JS}
function renderCard(p, opts){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var price=esc(p.priceHint||'');
  var badge=(opts&&opts.newBadge)?'<span class="pw-badge-new">NEW</span>':'';
  var favBtn='';
  if(id&&opts&&opts.favoriteHtml){
    favBtn=String(opts.favoriteHtml).replace(/data-inventory-id=["'][^"']*["']/gi,'data-inventory-id="'+esc(id)+'"');
    if(favBtn.indexOf('data-inventory-id=')<0)favBtn=favBtn.replace(/<(button|a)\\b/i,'<$1 data-inventory-id="'+esc(id)+'"');
  }else if(id&&opts&&opts.favorite){
    favBtn='<button type="button" class="pw-icon-btn pw-shop-icon-btn pw-chrome-has-label pw-chrome-label-below" data-pw-chrome-btn="favorite-product" data-pw-chrome-added="1" data-pw-favorite data-inventory-id="'+esc(id)+'" aria-pressed="false" aria-label="'+esc(COPY.favorite)+'" title="'+esc(COPY.favorite)+'"><span class="pw-chrome-icon-wrap"><svg class="pw-shop-nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></span><span class="pw-shop-nav-label pw-chrome-btn-label">'+esc(COPY.favorite)+'</span></button>';
  }
  var cartBtn=id
    ? '<button type="button" class="pw-btn pw-btn-cart" ${pwElAttr(PW_EL.cardCart)} data-pw-add-cart data-inventory-id="'+esc(id)+'">'+COPY.addToCart+'</button>'
    : '<a class="pw-btn pw-btn-cart" ${pwElAttr(PW_EL.cardCart)} href="'+esc(href)+'">'+COPY.viewCta+'</a>';
  return '<article class="pw-product-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'" data-pw-actions-ready="1"><a class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} href="'+esc(href)+'">'+badge+favBtn+'<img src="'+img+'" alt="'+name+'" loading="lazy"/></a><div class="pw-product-card-body"><h3 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h3>'+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+'<div class="pw-shop-action-bar">'+cartBtn+'</div></div></article>';
}
function isRelated(el){
  return el.getAttribute('data-pw-related')==='1'||el.getAttribute('data-pw-grid-kind')==='related';
}
function currentProductId(el){
  return String((el&&el.getAttribute('data-exclude'))||document.body.getAttribute('data-inventory-id')||'').trim();
}
function relatedLayout(){
  var html=document.documentElement;
  var d=html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||'';
  if(d==='mobile'||d==='tablet')return 'mobile';
  if(d==='desktop'||d==='laptop')return 'desktop';
  return window.innerWidth>=1280?'desktop':'mobile';
}
function renderRelatedCard(p){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var price=esc(p.priceHint||'');
  return '<article class="pw-product-card pw-related-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'"><a class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} href="'+esc(href)+'">'+(img?'<img src="'+img+'" alt="" loading="lazy"/>':'')+'</a><div class="pw-product-card-body pw-related-card-body"><h4 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h4>'+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+'</div></article>';
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
function ensureRelatedActions(el){
  var actions=el.querySelector('.pw-related-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='pw-related-actions';
    var grid=el.querySelector('[data-pw-grid]');
    if(grid&&grid.parentNode)grid.parentNode.insertBefore(actions,grid.nextSibling);
    else el.appendChild(actions);
  }
  var more=actions.querySelector('[data-pw-related-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-related-more';
    more.setAttribute('data-pw-related-more','1');
    more.innerHTML='<span class="pw-related-more-icon" aria-hidden="true">↻</span> '+esc(COPY.loadMore);
    actions.appendChild(more);
  }
  var all=actions.querySelector('[data-pw-el="section-more"],.pw-related-all');
  if(!all){
    all=document.createElement('a');
    all.className='pw-related-all';
    all.setAttribute('data-pw-el','section-more');
    all.textContent=COPY.seeAll;
    all.href=el.getAttribute('data-more-href')||PRODUCTS_PATH;
    actions.appendChild(all);
  }
  return {more:more,all:all};
}
function paintRelatedSlice(el){
  var st=el._pwRelated;if(!st)return;
  var grid=el.querySelector('[data-pw-grid]');if(!grid)return;
  grid.classList.add('pw-product-grid','pw-related-grid');
  grid.innerHTML=st.products.slice(0,st.visible).map(renderRelatedCard).join('');
  hideBrokenCardImgs(grid);
  var ui=ensureRelatedActions(el);
  ui.more.hidden=st.visible>=st.products.length;
  if(st.moreHref)ui.all.setAttribute('href',st.moreHref);
  ui.all.hidden=st.products.length===0;
}
function queryFor(el){
  if(isRelated(el)){
    var rLimit=Math.max(1,Math.min(48,parseInt(el.getAttribute('data-limit')||'24',10)||24));
    var exclude=currentProductId(el);
    var q='?limit='+rLimit+'&sort=newest';
    if(exclude)q+='&relatedTo='+encodeURIComponent(exclude);
    else {
      var cat=(el.getAttribute('data-category-id')||'').trim();
      if(cat)q+='&categoryId='+encodeURIComponent(cat);
    }
    return q;
  }
  var limit=Math.max(1,Math.min(24,parseInt(el.getAttribute('data-limit')||'8',10)||8));
  var sort=(el.getAttribute('data-sort')||'default').trim()||'default';
  var sale=el.getAttribute('data-sale');
  var collection=(el.getAttribute('data-collection')||'').trim();
  var q='?limit='+limit+'&sort='+encodeURIComponent(sort);
  if(sale==='1'||sale==='true')q+='&sale=1';
  if(collection)q+='&collection='+encodeURIComponent(collection);
  return q;
}
function hydrate(el){
  if(pwShopLiveUiOff())return;
  if(el.getAttribute('data-pw-personalize'))return;
  if(el.getAttribute('data-pw-outfit')==='1'||el.getAttribute('data-pw-grid-kind')==='outfit')return;
  var grid=el.querySelector('[data-pw-grid]');
  var empty=el.querySelector('.pw-catalog-empty,.pw-personalize-empty');
  if(!grid)return;
  fetch(API+queryFor(el),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};});}).then(function(res){
    var products=(res.j&&res.j.products)||[];
    if(!res.ok){
      grid.innerHTML='';
      if(empty){empty.hidden=false;empty.textContent=COPY.error+' ('+res.status+')';}
      el.hidden=false;
      return;
    }
    if(!products.length){
      if(isRelated(el)){
        grid.innerHTML='';
        if(empty){empty.hidden=false;empty.textContent=COPY.relatedEmpty;}
        var emptyUi=ensureRelatedActions(el);
        emptyUi.more.hidden=true;
        emptyUi.all.hidden=true;
        el.hidden=false;
        return;
      }
      // Keep SSR sample cards when inventory is still empty.
      if(grid.children.length){
        if(empty)empty.hidden=true;
        el.hidden=false;
        return;
      }
      grid.innerHTML='';
      if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
      el.hidden=false;
      return;
    }
    if(isRelated(el)){
      var exclude=currentProductId(el);
      if(exclude)products=products.filter(function(p){return String(p.id||'')!==exclude;});
      var filters=(res.j&&res.j.filters)||{};
      var moreHref=el.getAttribute('data-more-href')||'';
      if(!moreHref&&filters.categoryPath)moreHref=CATEGORY_PREFIX+String(filters.categoryPath).replace(/^\\/+/, '');
      if(!moreHref)moreHref=PRODUCTS_PATH;
      var step=relatedLayout()==='desktop'?5:2;
      el._pwRelated={products:products,visible:Math.min(step,products.length),step:step,moreHref:moreHref};
      if(empty)empty.hidden=products.length>0;
      if(!products.length&&empty)empty.textContent=COPY.relatedEmpty;
      paintRelatedSlice(el);
      el.hidden=false;
      return;
    }
    var newBadge=el.getAttribute('data-new-badge')==='1';
    var favOn=el.getAttribute('data-pw-card-favorite')==='1'||!!el.querySelector('[data-pw-chrome-btn="favorite-product"],template[data-pw-card-favorite-tpl]');
    var favTpl=el.querySelector('template[data-pw-card-favorite-tpl]');
    var favoriteHtml=favTpl&&favTpl.innerHTML?favTpl.innerHTML:'';
    grid.innerHTML=products.map(function(p){return renderCard(p,{newBadge:newBadge,favorite:favOn,favoriteHtml:favoriteHtml});}).join('');
    if(empty)empty.hidden=true;
    el.hidden=false;
  }).catch(function(){
    grid.innerHTML='';
    if(empty){empty.hidden=false;empty.textContent=COPY.error;}
    el.hidden=false;
  });
}
function ensureStyles(){
  if(!document.getElementById('pw-catalog-card-css')){
    var st=document.createElement('style');
    st.id='pw-catalog-card-css';
    st.textContent='.pw-product-grid{display:grid;gap:12px}.pw-product-card{display:flex;flex-direction:column;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}.pw-product-card-media{position:relative;display:block;aspect-ratio:1;background:#f8fafc}.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block}.pw-product-card-media [data-pw-chrome-btn="favorite-product"]{position:absolute;top:8px;right:8px;z-index:3;background:rgba(255,255,255,.92)!important}.pw-badge-new,.pw-for-you-badge{position:absolute;top:8px;left:8px;background:#9ca3af;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;z-index:2}.pw-for-you-badge{background:var(--pw-primary)}[data-pw-chrome-btn="favorite-product"].is-active svg,[data-pw-chrome-btn="favorite-product"][aria-pressed="true"] svg{fill:#e11d48;stroke:#e11d48}.pw-product-card-body{padding:12px;display:grid;gap:8px}.pw-product-card-body h3{margin:0;font-size:14px;line-height:1.35}.pw-product-card-body h3 a{color:inherit;text-decoration:none}.pw-price{margin:0;font-weight:800;color:var(--pw-primary)}.pw-shop-action-bar{display:grid;gap:8px}.pw-btn,.pw-btn-cart{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 12px;border-radius:8px;border:none;color:#fff;text-decoration:none;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.pw-btn{background:var(--pw-buy)}.pw-btn-cart{background:var(--pw-cart)}';
    document.head.appendChild(st);
  }
  if(!document.getElementById('pw-related-css')){
    var rel=document.createElement('style');
    rel.id='pw-related-css';
    rel.textContent=${JSON.stringify(PW_RELATED_CSS)};
    document.head.appendChild(rel);
  }
}
function run(){
  ensureStyles();
  document.querySelectorAll('[data-pw-catalog],[data-pw-related]').forEach(function(el){
    var grid=el.querySelector('[data-pw-grid]');
    if(!(grid&&grid.children.length)) el.hidden=true;
    hydrate(el);
  });
  if(!document.documentElement.getAttribute('data-pw-related-bound')){
    document.documentElement.setAttribute('data-pw-related-bound','1');
    document.addEventListener('click',function(ev){
      var t=ev.target;if(!t||!t.closest)return;
      var more=t.closest('[data-pw-related-more]');
      if(!more)return;
      ev.preventDefault();
      var host=more.closest('[data-pw-related],[data-pw-grid-kind="related"]');
      if(!host||!host._pwRelated)return;
      var st=host._pwRelated;
      st.visible=Math.min(st.visible+st.step,st.products.length);
      paintRelatedSlice(host);
    });
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();</script>`
}

/** Deterministic live catalog section HTML (real inventory via bootstrap). */
export function buildLiveCatalogSectionHtml(input: {
  sectionId: string
  title: string
  siteSlug: string
  limit?: number
  locale?: WebLocale
  seeAllLabel?: string
}): string {
  const limit = Math.max(1, Math.min(24, input.limit ?? 8))
  const locale = input.locale && input.locale in COPY ? input.locale : 'vi'
  const seeAll = input.seeAllLabel || COPY[locale].seeAll
  const title = input.title.trim() || (locale === 'en' ? 'Products' : 'Sản phẩm')
  const productsHref = partnerSiteProductsPath(input.siteSlug)
  const empty = COPY[locale].empty
  return `<section class="pw-catalog pw-section" ${pwRegionAttr(PW_REGION.catalog)} data-pw-section-id="${escapeAttr(input.sectionId)}" data-pw-catalog data-limit="${limit}" data-sort="default">
  <div class="pw-container" style="padding:32px 20px">
    <div style="display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      <h2 ${pwElAttr(PW_EL.sectionTitle)} style="margin:0;font-size:clamp(1.4rem,2.5vw,2rem)">${escapeHtml(title)}</h2>
      <a class="pw-btn" ${pwElAttr(PW_EL.sectionMore)} href="${escapeAttr(productsHref)}">${escapeHtml(seeAll)}</a>
    </div>
    <div data-pw-grid class="pw-product-grid" ${pwElAttr(PW_EL.grid)}></div>
    <p class="pw-catalog-empty pw-personalize-empty" hidden>${escapeHtml(empty)}</p>
  </div>
</section>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
