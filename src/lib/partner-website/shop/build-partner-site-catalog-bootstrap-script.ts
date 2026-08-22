import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteProductPath,
  partnerSiteProductsApiPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION, pwElAttr, pwRegionAttr } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'

const COPY: Record<
  WebLocale,
  { empty: string; viewCta: string; addToCart: string; favorite: string; seeAll: string; error: string }
> = {
  vi: {
    empty: 'Chưa có sản phẩm trong kho shop.',
    viewCta: 'Xem chi tiết',
    addToCart: 'Thêm vào giỏ',
    favorite: 'Thích',
    seeAll: 'Xem tất cả',
    error: 'Không tải được sản phẩm.',
  },
  en: {
    empty: 'No products in the shop inventory yet.',
    viewCta: 'View details',
    addToCart: 'ADD TO CART',
    favorite: 'Favorite',
    seeAll: 'See all',
    error: 'Could not load products.',
  },
  zh: {
    empty: '店铺库存暂无商品。',
    viewCta: '查看详情',
    addToCart: '加入购物车',
    favorite: '收藏',
    seeAll: '查看全部',
    error: '无法加载商品。',
  },
  ja: {
    empty: 'ショップの在庫に商品がありません。',
    viewCta: '詳細を見る',
    addToCart: 'カートに追加',
    favorite: 'お気に入り',
    seeAll: 'すべて見る',
    error: '商品を読み込めませんでした。',
  },
  ko: {
    empty: '샵 재고에 상품이 없습니다.',
    viewCta: '자세히 보기',
    addToCart: '장바구니',
    favorite: '찜',
    seeAll: '전체 보기',
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

  return `<script data-pw-catalog-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var API=${JSON.stringify(api)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var DETAIL_PREFIX=${JSON.stringify(detailPrefix)};
var COPY=${JSON.stringify(copy)};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function renderCard(p, opts){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(p.imageUrl||'');
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
function queryFor(el){
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
  if(document.getElementById('pw-catalog-card-css'))return;
  var st=document.createElement('style');
  st.id='pw-catalog-card-css';
  st.textContent='.pw-product-grid{display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}@media(min-width:1280px){.pw-product-grid{gap:18px;grid-template-columns:repeat(4,minmax(0,1fr))}}@media(min-width:1440px){.pw-product-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}.pw-product-card{display:flex;flex-direction:column;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}.pw-product-card-media{position:relative;display:block;aspect-ratio:1;background:#f8fafc}.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block}.pw-product-card-media [data-pw-chrome-btn="favorite-product"]{position:absolute;top:8px;right:8px;z-index:3;background:rgba(255,255,255,.92)!important}.pw-badge-new{position:absolute;top:8px;left:8px;background:#9ca3af;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px}[data-pw-chrome-btn="favorite-product"].is-active svg,[data-pw-chrome-btn="favorite-product"][aria-pressed="true"] svg{fill:#e11d48;stroke:#e11d48}.pw-product-card-body{padding:12px;display:grid;gap:8px}.pw-product-card-body h3{margin:0;font-size:14px;line-height:1.35}.pw-product-card-body h3 a{color:inherit;text-decoration:none}.pw-price{margin:0;font-weight:800;color:var(--pw-primary)}.pw-shop-action-bar{display:grid;gap:8px}.pw-btn,.pw-btn-cart{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 12px;border-radius:8px;border:none;color:#fff;text-decoration:none;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.pw-btn{background:var(--pw-buy)}.pw-btn-cart{background:var(--pw-cart)}';
  document.head.appendChild(st);
}
function run(){
  ensureStyles();
  document.querySelectorAll('[data-pw-catalog]').forEach(function(el){
    var grid=el.querySelector('[data-pw-grid]');
    if(!(grid&&grid.children.length)) el.hidden=true;
    hydrate(el);
  });
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
