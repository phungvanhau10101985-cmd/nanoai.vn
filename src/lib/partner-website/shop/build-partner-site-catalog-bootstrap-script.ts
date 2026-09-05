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
import { PW_PRODUCT_CATALOG_CARD_FACE_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { PW_PRODUCT_GRID_PAGE_JS } from '@/lib/partner-website/shop/pw-product-grid-page'

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
    seeAll: 'Xem tất cả các nhóm',
    loadMore: 'Xem thêm',
    relatedEmpty: 'Không có sản phẩm khác cùng danh mục.',
    error: 'Không tải được sản phẩm.',
  },
  en: {
    empty: 'No products in the shop inventory yet.',
    viewCta: 'View details',
    addToCart: 'ADD TO CART',
    favorite: 'Favorite',
    seeAll: 'See all groups',
    loadMore: 'See more',
    relatedEmpty: 'No other products in this category.',
    error: 'Could not load products.',
  },
  zh: {
    empty: '店铺库存暂无商品。',
    viewCta: '查看详情',
    addToCart: '加入购物车',
    favorite: '收藏',
    seeAll: '查看全部分组',
    loadMore: '查看更多',
    relatedEmpty: '该分类暂无其他商品。',
    error: '无法加载商品。',
  },
  ja: {
    empty: 'ショップの在庫に商品がありません。',
    viewCta: '詳細を見る',
    addToCart: 'カートに追加',
    favorite: 'お気に入り',
    seeAll: 'すべてのグループを見る',
    loadMore: 'もっと見る',
    relatedEmpty: 'このカテゴリに他の商品はありません。',
    error: '商品を読み込めませんでした。',
  },
  ko: {
    empty: '샵 재고에 상품이 없습니다.',
    viewCta: '자세히 보기',
    addToCart: '장바구니',
    favorite: '찜',
    seeAll: '모든 그룹 보기',
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
var LOCALE=${JSON.stringify(locale)};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function money(n){var v=Math.max(0,Math.round(Number(n)||0));try{return new Intl.NumberFormat(LOCALE==='vi'?'vi-VN':LOCALE,{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);}catch(e){return v.toLocaleString()+'₫';}}
function saleView(p){
  var list=Number(p&&p.priceAmount),sale=Number(p&&p.salePriceAmount);
  if(!Number.isFinite(list)||list<=0||!Number.isFinite(sale)||sale<0||sale>=list)return null;
  var now=Date.now(),start=p.saleStartsAt?Date.parse(p.saleStartsAt):NaN,end=p.saleEndsAt?Date.parse(p.saleEndsAt):NaN;
  if(Number.isFinite(start)&&now<start)return null;
  if(Number.isFinite(end)&&now>end)return null;
  return {price:money(sale),compare:money(list),percent:Math.max(1,Math.round((list-sale)*100/list))};
}
function priceHtml(p){
  var sale=saleView(p);
  if(sale)return '<span class="pw-price-sale">'+esc(sale.price)+'</span> <del class="pw-price-compare">'+esc(sale.compare)+'</del>';
  return esc(p.priceHint||'');
}
${PW_PRODUCT_GRID_PAGE_JS}
${PW_SHOP_CARD_IMG_JS}
function renderCard(p, opts){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var sale=saleView(p);
  var price=priceHtml(p);
  var badge=sale?'<span class="pw-badge-new">-'+sale.percent+'%</span>':((opts&&opts.newBadge)?'<span class="pw-badge-new">NEW</span>':'');
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
function renderRelatedCard(p){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var price=priceHtml(p);
  return '<article class="pw-product-card pw-related-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'"><a class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)} href="'+esc(href)+'">'+(img?'<img src="'+img+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>':'')+'</a><div class="pw-product-card-body pw-related-card-body"><h4 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h4>'+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+'</div></article>';
}
function hideBrokenCardImgs(root){
  var imgs=(root||document).querySelectorAll('.pw-product-card-media img,[data-pw-el="card-media"] img');
  for(var i=0;i<imgs.length;i++){
    (function(imgEl){
      function retryOrHide(){
        if(imgEl.getAttribute('data-pw-img-retry')==='1'){imgEl.style.visibility='hidden';return;}
        imgEl.setAttribute('data-pw-img-retry','1');
        var src=imgEl.getAttribute('src')||'';
        if(/_600x600q90\\.jpg$/i.test(src)){imgEl.setAttribute('src',src.replace(/_600x600q90\\.jpg$/i,''));return;}
        if(src.indexOf('/api/fetch-image')!==0&&/alicdn\\.com|1688\\.com|alibaba\\.com/.test(src)){
          imgEl.setAttribute('src','/api/fetch-image?url='+encodeURIComponent(src));
          return;
        }
        imgEl.style.visibility='hidden';
      }
      imgEl.addEventListener('load',function(){this.style.visibility='';});
      imgEl.addEventListener('error',retryOrHide);
      if(imgEl.complete&&imgEl.naturalWidth===0&&(imgEl.currentSrc||''))retryOrHide();
    })(imgs[i]);
  }
}
function ensureGridMore(el){
  var actions=el.querySelector('[data-pw-grid-actions],.pw-related-actions,.pw-grid-actions');
  if(!actions){
    actions=document.createElement('div');
    actions.className='pw-grid-actions';
    actions.setAttribute('data-pw-grid-actions','1');
    var grid=el.querySelector('[data-pw-grid]');
    if(grid&&grid.parentNode)grid.parentNode.insertBefore(actions,grid.nextSibling);
    else el.appendChild(actions);
  }
  var more=actions.querySelector('[data-pw-grid-more],[data-pw-related-more]');
  if(!more){
    more=document.createElement('button');
    more.type='button';
    more.className='pw-grid-more';
    more.setAttribute('data-pw-grid-more','1');
    more.innerHTML='<span class="pw-grid-more-icon" aria-hidden="true">↻</span> '+esc(COPY.loadMore);
    actions.appendChild(more);
  }
  var see=actions.querySelector('[data-pw-el="section-more"],.pw-related-all,.pw-grid-all');
  if(!see){
    see=document.createElement('a');
    see.className=el.getAttribute('data-pw-related')==='1'?'pw-related-all':'pw-grid-all';
    see.setAttribute('data-pw-el','section-more');
    see.textContent=COPY.seeAll;
    var listing=el.getAttribute('data-pw-listing-href')||PRODUCTS_PATH||'#';
    see.setAttribute('href',listing);
    actions.appendChild(see);
  }
  see.hidden=false;
  return more;
}
function paintMore(el){
  var more=ensureGridMore(el);
  var st=el._pwGrid;
  more.hidden=!st||!st.hasMore;
}
function queryFor(el,offset,limit){
  var page=Math.max(1,Math.min(48,limit||pwGridPageSize(el)));
  var off=Math.max(0,offset||0);
  if(isRelated(el)){
    var exclude=currentProductId(el);
    var q='?limit='+page+'&offset='+off+'&sort=newest';
    if(exclude)q+='&relatedTo='+encodeURIComponent(exclude);
    else {
      var cat=(el.getAttribute('data-category-id')||'').trim();
      if(cat)q+='&categoryId='+encodeURIComponent(cat);
    }
    return q;
  }
  var sort=(el.getAttribute('data-sort')||'default').trim()||'default';
  var sale=el.getAttribute('data-sale');
  var collection=(el.getAttribute('data-collection')||'').trim();
  var q='?limit='+page+'&offset='+off+'&sort='+encodeURIComponent(sort);
  if(sale==='1'||sale==='true')q+='&sale=1';
  if(collection)q+='&collection='+encodeURIComponent(collection);
  return q;
}
function appendCards(el,products,replace){
  var grid=el.querySelector('[data-pw-grid]');if(!grid)return;
  var html;
  if(isRelated(el)){
    grid.classList.add('pw-product-grid','pw-related-grid');
    html=products.map(renderRelatedCard).join('');
  }else{
    var newBadge=el.getAttribute('data-new-badge')==='1';
    var favOn=el.getAttribute('data-pw-card-favorite')==='1'||!!el.querySelector('[data-pw-chrome-btn="favorite-product"],template[data-pw-card-favorite-tpl]');
    var favTpl=el.querySelector('template[data-pw-card-favorite-tpl]');
    var favoriteHtml=favTpl&&favTpl.innerHTML?favTpl.innerHTML:'';
    html=products.map(function(p){return renderCard(p,{newBadge:newBadge,favorite:favOn,favoriteHtml:favoriteHtml});}).join('');
  }
  if(replace)grid.innerHTML=html;
  else{
    var tmp=document.createElement('div');
    tmp.innerHTML=html;
    while(tmp.firstChild)grid.appendChild(tmp.firstChild);
  }
  hideBrokenCardImgs(grid);
}
function loadGridPage(el,append){
  if(pwShopLiveUiOff())return;
  if(el.getAttribute('data-pw-personalize'))return;
  if(el.getAttribute('data-pw-featured-categories')==='1'||el.getAttribute('data-pw-grid-kind')==='featured-categories')return;
  if(el.getAttribute('data-pw-outfit')==='1'||el.getAttribute('data-pw-grid-kind')==='outfit')return;
  var st=el._pwGrid;if(!st||st.loading)return;
  var grid=el.querySelector('[data-pw-grid]');
  var empty=el.querySelector('.pw-catalog-empty,.pw-personalize-empty');
  if(!grid)return;
  st.loading=true;
  fetch(API+queryFor(el,st.offset,st.pageSize),{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};});}).then(function(res){
    st.loading=false;
    var products=(res.j&&res.j.products)||[];
    if(isRelated(el)){
      var exclude=currentProductId(el);
      if(exclude)products=products.filter(function(p){return String(p.id||'')!==exclude;});
    }
    if(!res.ok){
      if(!append){
        grid.innerHTML='';
        if(empty){empty.hidden=false;empty.textContent=COPY.error+' ('+res.status+')';}
      }
      st.hasMore=false;paintMore(el);el.hidden=false;return;
    }
    if(!products.length){
      if(!append){
        if(isRelated(el)){
          grid.innerHTML='';
          if(empty){empty.hidden=false;empty.textContent=COPY.relatedEmpty;}
        }else if(grid.children.length){
          if(empty)empty.hidden=true;
        }else{
          grid.innerHTML='';
          if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
        }
      }
      st.hasMore=false;paintMore(el);el.hidden=false;return;
    }
    if(empty)empty.hidden=true;
    appendCards(el,products,!append);
    st.offset+=products.length;
    st.hasMore=res.j&&res.j.hasMore===true;
    paintMore(el);
    el.hidden=false;
  }).catch(function(){
    st.loading=false;
    if(!append){
      grid.innerHTML='';
      if(empty){empty.hidden=false;empty.textContent=COPY.error;}
    }
    st.hasMore=false;paintMore(el);el.hidden=false;
  });
}
function hydrate(el){
  el._pwGrid={offset:0,pageSize:pwGridPageSize(el),hasMore:true,loading:false};
  loadGridPage(el,false);
}
function ensureStyles(){
  if(!document.getElementById('pw-catalog-card-css')){
    var st=document.createElement('style');
    st.id='pw-catalog-card-css';
    st.textContent='.pw-product-grid{display:grid;gap:12px;align-items:stretch}.pw-product-card{display:flex;flex-direction:column;height:100%;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}.pw-product-card-media{position:relative;display:block;aspect-ratio:1;background:#f8fafc}.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block}.pw-product-card-media [data-pw-chrome-btn="favorite-product"]{position:absolute;top:8px;right:8px;z-index:3;background:rgba(255,255,255,.92)!important}.pw-badge-new,.pw-for-you-badge{position:absolute;top:8px;left:8px;background:#9ca3af;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;z-index:2}.pw-for-you-badge{background:var(--pw-primary)}[data-pw-chrome-btn="favorite-product"].is-active svg,[data-pw-chrome-btn="favorite-product"][aria-pressed="true"] svg{fill:#e11d48;stroke:#e11d48}.pw-product-card-body{padding:12px;display:flex;flex-direction:column;flex:1 1 auto;gap:6px}.pw-product-card-body h3,.pw-product-card-body [data-pw-el="card-name"]{margin:0;font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;min-height:2.6em;max-height:2.6em}.pw-product-card-body h3 a{color:inherit;text-decoration:none}.pw-price{margin:0;font-weight:800;color:var(--pw-primary)}.pw-shop-action-bar{display:grid;gap:8px;margin-top:auto}.pw-btn,.pw-btn-cart{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 12px;border-radius:8px;border:none;color:#fff;text-decoration:none;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.pw-btn{background:var(--pw-buy)}.pw-btn-cart{background:var(--pw-cart)}'+${JSON.stringify(PW_PRODUCT_CATALOG_CARD_FACE_CSS)};
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
  if(!document.documentElement.getAttribute('data-pw-grid-more-bound')){
    document.documentElement.setAttribute('data-pw-grid-more-bound','1');
    document.addEventListener('click',function(ev){
      var t=ev.target;if(!t||!t.closest)return;
      var more=t.closest('[data-pw-grid-more],[data-pw-related-more]');
      if(!more)return;
      if(more.closest('[data-pw-outfit],[data-pw-grid-kind="outfit"]'))return;
      if(more.closest('[data-pw-personalize]'))return;
      ev.preventDefault();
      var host=more.closest('[data-pw-catalog],[data-pw-related],[data-pw-grid-kind="related"]');
      if(!host||!host._pwGrid)return;
      loadGridPage(host,true);
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
  rows?: number
  locale?: WebLocale
  seeAllLabel?: string
}): string {
  const rows = Math.max(1, Math.min(4, Math.floor(Number(input.rows) || 1)))
  const limit = Math.max(1, Math.min(24, input.limit ?? rows * 5))
  const locale = input.locale && input.locale in COPY ? input.locale : 'vi'
  const title = input.title.trim() || (locale === 'en' ? 'Products' : 'Sản phẩm')
  const empty = COPY[locale].empty
  const loadMore = COPY[locale].loadMore
  const seeAll = input.seeAllLabel || COPY[locale].seeAll
  const seeAllHref = partnerSiteProductsPath(input.siteSlug)
  return `<section class="pw-catalog pw-section" ${pwRegionAttr(PW_REGION.catalog)} data-pw-section-id="${escapeAttr(input.sectionId)}" data-pw-catalog data-pw-grid-cols="5" data-pw-grid-cols-mobile="2" data-pw-grid-rows="${rows}" data-limit="${limit}" data-sort="default">
  <div class="pw-container" style="padding:16px 20px">
    <h2 ${pwElAttr(PW_EL.sectionTitle)} style="margin:0">${escapeHtml(title)}</h2>
    <div data-pw-grid class="pw-product-grid" ${pwElAttr(PW_EL.grid)}></div>
    <div class="pw-grid-actions" data-pw-grid-actions>
      <button type="button" class="pw-grid-more" data-pw-grid-more>
        <span class="pw-grid-more-icon" aria-hidden="true">↻</span>
        ${escapeHtml(loadMore)}
      </button>
      <a href="${escapeAttr(seeAllHref)}" class="pw-grid-all" ${pwElAttr(PW_EL.sectionMore)}>${escapeHtml(seeAll)}</a>
    </div>
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
