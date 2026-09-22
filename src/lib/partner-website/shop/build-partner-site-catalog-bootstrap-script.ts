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
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_RELATED_CSS } from '@/lib/partner-website/shop/related-products-css'
import { PW_PRODUCT_CATALOG_CARD_FACE_CSS } from '@/lib/partner-website/shop/pw-product-grid-ruler'
import { PW_PRODUCT_GRID_PAGE_JS } from '@/lib/partner-website/shop/pw-product-grid-page'
import {
  PW_SITE_SALE_CARD_CSS,
  PW_SITE_SALE_TICK_CHIPS_JS,
  PW_SITE_SALE_VIEW_JS,
  partnerSiteSaleCopy,
} from '@/lib/partner-website/promotions/partner-site-sale-display'

const COPY: Record<
  WebLocale,
  {
    empty: string
    favorite: string
    sold: string
    seeAll: string
    loadMore: string
    relatedEmpty: string
    error: string
  }
> = {
  vi: {
    empty: 'Chưa có sản phẩm trong kho shop.',
    favorite: 'Thích',
    sold: 'Đã bán',
    seeAll: 'Xem tất cả các nhóm',
    loadMore: 'Xem thêm',
    relatedEmpty: 'Không có sản phẩm khác cùng danh mục.',
    error: 'Không tải được sản phẩm.',
  },
  en: {
    empty: 'No products in the shop inventory yet.',
    favorite: 'Favorite',
    sold: 'Sold',
    seeAll: 'See all groups',
    loadMore: 'See more',
    relatedEmpty: 'No other products in this category.',
    error: 'Could not load products.',
  },
  zh: {
    empty: '店铺库存暂无商品。',
    favorite: '收藏',
    sold: '已售',
    seeAll: '查看全部分组',
    loadMore: '查看更多',
    relatedEmpty: '该分类暂无其他商品。',
    error: '无法加载商品。',
  },
  ja: {
    empty: 'ショップの在庫に商品がありません。',
    favorite: 'お気に入り',
    sold: '販売',
    seeAll: 'すべてのグループを見る',
    loadMore: 'もっと見る',
    relatedEmpty: 'このカテゴリに他の商品はありません。',
    error: '商品を読み込めませんでした。',
  },
  ko: {
    empty: '샵 재고에 상품이 없습니다.',
    favorite: '찜',
    sold: '판매',
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
  const saleCopy = partnerSiteSaleCopy(locale)
  const shopCopy = getPartnerSiteShopCopy(locale)
  const copy = {
    ...COPY[locale],
    expectedSave: saleCopy.expectedSave,
    teaserSave: saleCopy.teaserSave,
    save: saleCopy.save,
    startsAfter: saleCopy.startsAfter,
    remaining: saleCopy.remaining,
    flashRemaining: saleCopy.flashRemaining,
    countdownStarts: saleCopy.countdownStarts,
    countdownLeft: saleCopy.countdownLeft,
    birthdayCheckoutHint: saleCopy.birthdayCheckoutHint,
    birthdayBadge: saleCopy.birthdayBadge,
    flashBadge: saleCopy.flashBadge,
    flashName: saleCopy.flashName,
    clearanceBadge: saleCopy.clearanceBadge,
    calendarBadge: saleCopy.calendarBadge,
    clearanceName: saleCopy.clearanceName,
    teaserFallback: saleCopy.teaserFallback,
    activeFallback: saleCopy.activeFallback,
    filterSize: shopCopy.categoryFilterSize,
    filterStyle: shopCopy.categoryFilterStyle,
    filterColor: shopCopy.categoryFilterColor,
    filterAllSizes: shopCopy.categoryFilterAllSizes,
    filterAllStyles: shopCopy.categoryFilterAllStyles,
    filterAllColors: shopCopy.categoryFilterAllColors,
    filterMin: shopCopy.categoryFilterMinPrice,
    filterMax: shopCopy.categoryFilterMaxPrice,
    filterMinPh: shopCopy.categoryFilterPriceMinPh,
    filterMaxPh: shopCopy.categoryFilterPriceMaxPh,
    filterSort: shopCopy.categorySortLabel,
    filterRandom: shopCopy.categorySortRandom,
    filterNewest: shopCopy.categorySortNewest,
    filterOldest: shopCopy.categorySortOldest,
    filterViews: shopCopy.categorySortViews,
    filterClear: shopCopy.categoryFilterClear,
    filterAria: shopCopy.categoryFiltersAria,
  }
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
var REQUESTS={};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function fetchJsonOnce(url){
  if(REQUESTS[url])return REQUESTS[url];
  REQUESTS[url]=fetch(url,{credentials:'same-origin',cache:'no-store'}).then(function(r){return r.json().then(function(j){return {ok:r.ok,status:r.status,j:j};});});
  REQUESTS[url].then(function(){delete REQUESTS[url];},function(){delete REQUESTS[url];});
  return REQUESTS[url];
}
function money(n){var v=Math.max(0,Math.round(Number(n)||0));try{return new Intl.NumberFormat(LOCALE==='vi'?'vi-VN':LOCALE,{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);}catch(e){return v.toLocaleString()+'₫';}}
${PW_SITE_SALE_VIEW_JS}
function priceHtml(p){
  var sale=saleView(p);
  var bdayPct=Math.max(0,Math.round(Number(p.birthdayOfferPercent||(p.birthdayOffer&&p.birthdayOffer.percent)||0)||0));
  var bday=bdayPct>0&&p.isClearance!==true?String(COPY.birthdayCheckoutHint||'').replace('{pct}',String(bdayPct)):'';
  var extra=bday?'<small class="pw-price-birthday">'+esc(bday)+'</small>':'';
  if(!sale)return esc(p.priceHint||'')+extra;
  if(sale.kind==='teaser'){
    return '<span class="pw-price-sale">'+esc(sale.price)+'</span> <span class="pw-price-expected">→ '+esc(sale.expected)+'</span><small class="pw-price-teaser">'+esc((COPY.expectedSave||'').replace('{program}',sale.program||'').replace('{pct}',String(sale.percent)).replace('{amount}',sale.savings))+'</small>'+extra;
  }
  return '<span class="pw-price-sale">'+esc(sale.price)+'</span> <del class="pw-price-compare">'+esc(sale.compare)+'</del>'+(sale.savings?'<small class="pw-price-save">'+esc((COPY.save||'').replace('{program}',sale.program||'').replace('{amount}',sale.savings))+'</small>':'')+extra;
}
function saleBadgeHtml(sale, opts, p){
  var out='';
  if(sale&&sale.badge){
    var chipKind=sale.promoKind==='flash'?'flash':sale.kind;
    var chipLabel=sale.promoKind==='flash'?COPY.flashRemaining:String((sale.kind==='active'?COPY.countdownLeft:COPY.countdownStarts)||'').replace('{label}',sale.program||'');
    var chip=sale.countdown&&sale.promoKind!=='clearance'?'<span class="pw-sale-chip pw-sale-chip-'+chipKind+'" data-pw-sale-countdown="'+esc(sale.countdown)+'" data-pw-sale-phase="'+esc(sale.kind)+'" data-pw-sale-kind="'+(sale.promoKind||'')+'" data-pw-sale-label="'+esc(sale.program||'')+'">'+esc(chipLabel)+' <span data-pw-sale-hms></span></span>':'';
    out='<span class="pw-badge-sale pw-badge-sale-'+sale.kind+(sale.promoKind?' pw-badge-sale-'+sale.promoKind:'')+'">'+esc(sale.badge)+'</span>'+chip;
  }else if(opts&&opts.newBadge){
    out='<span class="pw-badge-new">NEW</span>';
  }
  var bdayPct=Math.max(0,Math.round(Number((p&&p.birthdayOfferPercent)||(p&&p.birthdayOffer&&p.birthdayOffer.percent)||0)||0));
  if(bdayPct>0&&!(p&&p.isClearance===true)){
    var bdayBadge=String(COPY.birthdayBadge||'').replace('{pct}',String(bdayPct));
    if(bdayBadge)out+='<span class="pw-badge-birthday">'+esc(bdayBadge)+'</span>';
  }
  return out;
}
${PW_PRODUCT_GRID_PAGE_JS}
${PW_SHOP_CARD_IMG_JS}
function listingHeartSvg(){
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>';
}
function listingFavHtml(id){
  if(!id)return '';
  return '<button type="button" class="pw-rec-fav" data-pw-favorite data-inventory-id="'+esc(id)+'" aria-pressed="false" aria-label="'+esc(COPY.favorite)+'">'+listingHeartSvg()+'</button>';
}
function listingStatsHtml(p){
  var rating=Number(p.ratingScore!=null?p.ratingScore:p.rating_score);
  if(!isFinite(rating))rating=0;
  var sold=Math.max(0,Math.round(Number(p.purchasesCount!=null?p.purchasesCount:p.purchases_count)||0));
  return '<div class="pw-rec-stats"><span>★ '+rating.toFixed(1)+'</span><span>'+esc(COPY.sold)+': '+sold+'</span></div>';
}
function renderCard(p, opts){
  var id=String(p.id||'').trim();
  var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
  var name=esc(p.name||'Product');
  var img=esc(shopImg(p));
  var sale=saleView(p);
  var price=priceHtml(p);
  var badge=saleBadgeHtml(sale,opts,p);
  var favBtn=listingFavHtml(id);
  return '<article class="pw-product-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'" data-pw-actions-ready="1"><div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)}>'+badge+'<img src="'+img+'" alt="'+name+'" loading="lazy"/></div><div class="pw-product-card-body"><h3 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h3>'+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+listingStatsHtml(p)+'</div><a class="pw-product-card-hit" href="'+esc(href)+'" aria-label="'+name+'" tabindex="-1"></a>'+favBtn+'</article>';
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
  return '<article class="pw-product-card pw-related-card" ${pwElAttr(PW_EL.card)} data-inventory-id="'+esc(id)+'"><div class="pw-product-card-media" ${pwElAttr(PW_EL.cardMedia)}>'+(img?'<img src="'+img+'" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"/>':'')+'</div><div class="pw-product-card-body pw-related-card-body"><h4 ${pwElAttr(PW_EL.cardName)}><a href="'+esc(href)+'">'+name+'</a></h4>'+(price?'<p class="pw-price" ${pwElAttr(PW_EL.cardPrice)}>'+price+'</p>':'')+listingStatsHtml(p)+'</div><a class="pw-product-card-hit" href="'+esc(href)+'" aria-label="'+name+'" tabindex="-1"></a>'+listingFavHtml(id)+'</article>';
}
function hideBrokenCardImgs(root){
  var imgs=(root||document).querySelectorAll('.pw-product-card-media img,[data-pw-el="card-media"] img');
  for(var i=0;i<imgs.length;i++){
    (function(imgEl){
      function retryOrHide(){
        if(imgEl.getAttribute('data-pw-img-retry')==='1'){imgEl.style.visibility='hidden';return;}
        imgEl.setAttribute('data-pw-img-retry','1');
        var next=typeof nextShopImageRetrySrc==='function'?nextShopImageRetrySrc(imgEl.getAttribute('src')||''):'';
        if(next){imgEl.setAttribute('src',next);return;}
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
function listingParamsFromUrl(){
  var u=new URLSearchParams(location.search||'');
  return {
    size:(u.get('size')||'').trim(),
    color:(u.get('color')||'').trim(),
    style_tag:(u.get('style_tag')||u.get('styleTag')||'').trim(),
    min_price:(u.get('min_price')||u.get('minPrice')||'').trim(),
    max_price:(u.get('max_price')||u.get('maxPrice')||'').trim(),
    sort:(u.get('sort')||'').trim(),
    q:(u.get('q')||'').trim(),
    r:(u.get('r')||'').trim()
  };
}
function listingIsWarehouse(){
  var path=location.pathname||'';
  return path.indexOf('/kho-sale')>=0;
}
function listingPageHasFilters(){
  var page=document.documentElement.getAttribute('data-pw-page')||'';
  if(page==='home'||page==='product'||page==='cart'||page==='account')return false;
  return page==='listing'||listingIsWarehouse()||!!document.querySelector('[data-pw-region="filters"]');
}
function listingCatalogEl(el){
  if(isRelated(el))return false;
  if(el.getAttribute('data-pw-personalize'))return false;
  if(el.getAttribute('data-pw-featured-categories')==='1'||el.getAttribute('data-pw-grid-kind')==='featured-categories')return false;
  if(el.getAttribute('data-pw-outfit')==='1'||el.getAttribute('data-pw-grid-kind')==='outfit')return false;
  return listingPageHasFilters()||el.getAttribute('data-warehouse')==='1'||el.getAttribute('data-warehouse')==='true'||listingIsWarehouse();
}
function queryFor(el,offset,limit){
  var page=Math.max(1,Math.min(48,limit||pwGridPageSize(el)));
  var off=Math.max(0,offset||0);
  if(isRelated(el)){
    var exclude=currentProductId(el);
    var q='?limit='+page+'&offset='+off+'&sort=newest';
    if(exclude)q+='&relatedTo='+encodeURIComponent(exclude);
    else {
      var catRel=(el.getAttribute('data-category-id')||'').trim();
      if(catRel)q+='&categoryId='+encodeURIComponent(catRel);
    }
    return q;
  }
  var p=listingCatalogEl(el)?listingParamsFromUrl():{size:'',color:'',style_tag:'',min_price:'',max_price:'',sort:'',q:'',r:''};
  var sale=el.getAttribute('data-sale');
  var collection=(el.getAttribute('data-collection')||'').trim();
  var cat=(el.getAttribute('data-category-id')||'').trim();
  var warehouse=el.getAttribute('data-warehouse')==='1'||el.getAttribute('data-warehouse')==='true'||listingIsWarehouse();
  var facetOn=!!(p.size||p.color||p.style_tag||p.min_price||p.max_price);
  var sort=(p.sort||(el.getAttribute('data-sort')||'default').trim()||'default');
  if(listingCatalogEl(el)&&!p.sort){
    sort=facetOn?'newest':(cat||warehouse||listingPageHasFilters()?'random':sort);
  }
  var qstr='?limit='+page+'&offset='+off+'&sort='+encodeURIComponent(sort);
  if(sale==='1'||sale==='true')qstr+='&sale=1';
  if(collection)qstr+='&collection='+encodeURIComponent(collection);
  if(warehouse)qstr+='&warehouse=1';
  if(cat && sale!=='1' && sale!=='true' && !collection && !warehouse)qstr+='&categoryId='+encodeURIComponent(cat);
  if(p.q)qstr+='&q='+encodeURIComponent(p.q);
  if(p.size)qstr+='&size='+encodeURIComponent(p.size);
  if(p.color)qstr+='&color='+encodeURIComponent(p.color);
  if(p.style_tag)qstr+='&style_tag='+encodeURIComponent(p.style_tag);
  if(p.min_price)qstr+='&min_price='+encodeURIComponent(p.min_price);
  if(p.max_price)qstr+='&max_price='+encodeURIComponent(p.max_price);
  if(sort==='random'&&p.r)qstr+='&r='+encodeURIComponent(p.r);
  if(listingCatalogEl(el))qstr+='&facets=1';
  return qstr;
}
function listingFilterBar(){
  return document.querySelector('[data-pw-region="filters"]');
}
function listingFacetOn(p){
  return !!(p.size||p.color||p.style_tag||p.min_price||p.max_price);
}
function paintFacetSelect(sel,items,allLabel,withCount,current){
  if(!sel)return;
  var html='<option value="">'+esc(allLabel||'')+'</option>';
  var seen={};
  (items||[]).forEach(function(it){
    var v=String((it&&it.value)||'').trim();
    if(!v||seen[v])return;
    seen[v]=1;
    var label=withCount&&it.count!=null?v+' ('+it.count+')':v;
    html+='<option value="'+esc(v)+'">'+esc(label)+'</option>';
  });
  if(current&&!seen[current])html+='<option value="'+esc(current)+'">'+esc(current)+'</option>';
  sel.innerHTML=html;
  sel.value=current||'';
}
function ensureListingClearBtn(bar){
  var btn=bar.querySelector('[data-pw-filter-clear],.pw-shop-filter-clear');
  if(!btn){
    btn=document.createElement('button');
    btn.type='button';
    btn.className='pw-shop-filter-clear';
    btn.setAttribute('data-pw-filter-clear','1');
    bar.appendChild(btn);
  }
  btn.textContent=COPY.filterClear||'';
  return btn;
}
function syncListingControlsFromUrl(){
  var bar=listingFilterBar();if(!bar)return;
  var p=listingParamsFromUrl();
  var size=bar.querySelector('[data-pw-facet="size"]');
  var style=bar.querySelector('[data-pw-facet="style"]');
  var color=bar.querySelector('[data-pw-facet="color"]');
  var min=bar.querySelector('[data-pw-facet="min_price"]');
  var max=bar.querySelector('[data-pw-facet="max_price"]');
  var sort=bar.querySelector('[data-pw-el="sort"],[data-pw-facet="sort"]');
  if(size)size.value=p.size||'';
  if(style)style.value=p.style_tag||'';
  if(color)color.value=p.color||'';
  if(min)min.value=p.min_price||'';
  if(max)max.value=p.max_price||'';
  if(sort){
    var sv=p.sort||(listingFacetOn(p)?'newest':'random');
    sort.value=sv;
  }
  var clear=ensureListingClearBtn(bar);
  clear.hidden=!listingFacetOn(p)&&!p.sort;
}
function paintListingFacets(j){
  if(pwShopLiveUiOff())return;
  var bar=listingFilterBar();if(!bar)return;
  var facets=(j&&j.facets)||{};
  var defs=j&&j.facetDefs;
  var showFashion=defs==null||(Array.isArray(defs)&&defs.length>0);
  ['size','style','color'].forEach(function(kind){
    var sel=bar.querySelector('[data-pw-facet="'+kind+'"]');
    if(!sel)return;
    var lab=sel.closest('label');
    if(lab)lab.hidden=!showFashion;
  });
  if(showFashion){
    var p=listingParamsFromUrl();
    paintFacetSelect(bar.querySelector('[data-pw-facet="size"]'),facets.sizes||[],COPY.filterAllSizes,true,p.size);
    paintFacetSelect(bar.querySelector('[data-pw-facet="style"]'),facets.styleTags||[],COPY.filterAllStyles,false,p.style_tag);
    paintFacetSelect(bar.querySelector('[data-pw-facet="color"]'),facets.colors||[],COPY.filterAllColors,true,p.color);
  }
  syncListingControlsFromUrl();
}
function writeListingUrl(next){
  if(pwShopLiveUiOff())return;
  var u=new URL(location.href);
  var p=u.searchParams;
  var qKeep=p.get('q')||'';
  ['size','style_tag','styleTag','color','min_price','minPrice','max_price','maxPrice','sort','page','r'].forEach(function(k){p.delete(k);});
  if(next.size)p.set('size',next.size);
  if(next.color)p.set('color',next.color);
  if(next.style_tag)p.set('style_tag',next.style_tag);
  if(next.min_price)p.set('min_price',next.min_price);
  if(next.max_price)p.set('max_price',next.max_price);
  if(next.sort)p.set('sort',next.sort);
  if(next.r)p.set('r',next.r);
  if(qKeep)p.set('q',qKeep);
  var qs=p.toString();
  history.replaceState(null,'',u.pathname+(qs?'?'+qs:'')+u.hash);
}
function reloadListingCatalogs(){
  document.querySelectorAll('[data-pw-catalog]').forEach(function(el){
    if(!listingCatalogEl(el))return;
    hydrate(el);
  });
}
function applyListingFiltersFromBar(){
  if(pwShopLiveUiOff())return;
  var bar=listingFilterBar();if(!bar)return;
  var size=String((bar.querySelector('[data-pw-facet="size"]')||{}).value||'').trim();
  var style=String((bar.querySelector('[data-pw-facet="style"]')||{}).value||'').trim();
  var color=String((bar.querySelector('[data-pw-facet="color"]')||{}).value||'').trim();
  var min=String((bar.querySelector('[data-pw-facet="min_price"]')||{}).value||'').trim();
  var max=String((bar.querySelector('[data-pw-facet="max_price"]')||{}).value||'').trim();
  var sortEl=bar.querySelector('[data-pw-el="sort"],[data-pw-facet="sort"]');
  var cur=listingParamsFromUrl();
  var prevImplicit=listingFacetOn(cur)?'newest':'random';
  var facetOn=!!(size||style||color||min||max);
  var implicit=facetOn?'newest':'random';
  var sort=sortEl?String(sortEl.value||'').trim():'';
  if(!sort||sort===prevImplicit)sort=implicit;
  var curSort=cur.sort||prevImplicit;
  if(cur.size===size&&cur.color===color&&cur.style_tag===style&&cur.min_price===min&&cur.max_price===max&&curSort===sort)return;
  var r='';
  if(sort==='random'){
    r=cur.r||('r'+Math.random().toString(36).slice(2,10));
  }
  if(sortEl)sortEl.value=sort;
  writeListingUrl({
    size:size,
    color:color,
    style_tag:style,
    min_price:min,
    max_price:max,
    sort:sort===implicit?'':sort,
    r:r
  });
  syncListingControlsFromUrl();
  reloadListingCatalogs();
}
function clearListingFilters(){
  if(pwShopLiveUiOff())return;
  writeListingUrl({});
  var bar=listingFilterBar();
  if(bar){
    bar.querySelectorAll('[data-pw-facet]').forEach(function(el){
      if(el.tagName==='SELECT'||el.tagName==='INPUT')el.value='';
    });
    var sort=bar.querySelector('[data-pw-el="sort"],[data-pw-facet="sort"]');
    if(sort)sort.value='random';
  }
  reloadListingCatalogs();
}
function bindListingFilters(){
  if(pwShopLiveUiOff())return;
  if(document.documentElement.getAttribute('data-pw-listing-filters-bound'))return;
  var bar=listingFilterBar();if(!bar)return;
  document.documentElement.setAttribute('data-pw-listing-filters-bound','1');
  ensureListingClearBtn(bar);
  syncListingControlsFromUrl();
  bar.addEventListener('change',function(ev){
    var t=ev.target;if(!t||!t.getAttribute)return;
    if(t.getAttribute('data-pw-facet')==='min_price'||t.getAttribute('data-pw-facet')==='max_price')return;
    if(t.getAttribute('data-pw-facet')||t.getAttribute('data-pw-el')==='sort')applyListingFiltersFromBar();
  });
  bar.addEventListener('keydown',function(ev){
    var t=ev.target;if(!t||ev.key!=='Enter')return;
    if(t.getAttribute&&(t.getAttribute('data-pw-facet')==='min_price'||t.getAttribute('data-pw-facet')==='max_price')){
      ev.preventDefault();
      applyListingFiltersFromBar();
    }
  });
  bar.addEventListener('focusout',function(ev){
    var t=ev.target;if(!t||!t.getAttribute)return;
    if(t.getAttribute('data-pw-facet')==='min_price'||t.getAttribute('data-pw-facet')==='max_price')applyListingFiltersFromBar();
  });
  bar.addEventListener('click',function(ev){
    var t=ev.target;if(!t||!t.closest)return;
    var clear=t.closest('[data-pw-filter-clear],.pw-shop-filter-clear');
    if(!clear)return;
    ev.preventDefault();
    clearListingFilters();
  });
}
function appendCards(el,products,replace){
  var grid=el.querySelector('[data-pw-grid]');if(!grid)return;
  var html;
  if(isRelated(el)){
    grid.classList.add('pw-product-grid','pw-related-grid');
    html=products.map(renderRelatedCard).join('');
  }else{
    var newBadge=el.getAttribute('data-new-badge')==='1';
    html=products.map(function(p){return renderCard(p,{newBadge:newBadge,favorite:true});}).join('');
  }
  if(replace)grid.innerHTML=html;
  else{
    var tmp=document.createElement('div');
    tmp.innerHTML=html;
    while(tmp.firstChild)grid.appendChild(tmp.firstChild);
  }
  hideBrokenCardImgs(grid);
}
function revealLiveCatalog(el){
  el.setAttribute('data-pw-live-products','ready');
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
  fetchJsonOnce(API+queryFor(el,st.offset,st.pageSize)).then(function(res){
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
      st.hasMore=false;paintMore(el);revealLiveCatalog(el);el.hidden=false;return;
    }
    if(!products.length){
      if(!append){
        if(isRelated(el)){
          grid.innerHTML='';
          if(empty){empty.hidden=false;empty.textContent=COPY.relatedEmpty;}
        }else{
          grid.innerHTML='';
          if(empty){empty.hidden=false;empty.textContent=COPY.empty;}
        }
      }
      st.hasMore=false;paintMore(el);revealLiveCatalog(el);el.hidden=false;
      if(listingCatalogEl(el)&&!append)paintListingFacets(res.j);
      return;
    }
    if(empty)empty.hidden=true;
    appendCards(el,products,!append);
    st.offset+=products.length;
    st.hasMore=res.j&&res.j.hasMore===true;
    paintMore(el);
    revealLiveCatalog(el);
    el.hidden=false;
    if(listingCatalogEl(el)&&!append)paintListingFacets(res.j);
  }).catch(function(){
    st.loading=false;
    if(!append){
      grid.innerHTML='';
      if(empty){empty.hidden=false;empty.textContent=COPY.error;}
    }
    st.hasMore=false;paintMore(el);revealLiveCatalog(el);el.hidden=false;
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
    st.textContent='.pw-product-grid{display:grid;gap:12px;align-items:stretch}.pw-product-card{display:flex;flex-direction:column;height:100%;border:1px solid #f3f4f6;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.06)}.pw-product-card-media{position:relative;display:block;aspect-ratio:1;background:#f8fafc}.pw-product-card-media img{width:100%;height:100%;object-fit:cover;display:block}.pw-product-card-media [data-pw-chrome-btn="favorite-product"]{position:absolute;top:8px;right:8px;z-index:3;background:rgba(255,255,255,.92)!important}.pw-badge-new,.pw-for-you-badge{position:absolute;top:8px;left:8px;background:#9ca3af;color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;z-index:2}.pw-for-you-badge{background:var(--pw-primary)}.pw-rec-fav.is-active svg,.pw-rec-fav[aria-pressed="true"] svg{fill:#fff;stroke:#fff}.pw-product-card-body{padding:12px;display:flex;flex-direction:column;flex:1 1 auto;gap:6px}.pw-product-card-body h3,.pw-product-card-body [data-pw-el="card-name"]{margin:0;font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;min-height:2.6em;max-height:2.6em}.pw-product-card-body h3 a{color:inherit;text-decoration:none}.pw-price{margin:0;font-weight:800;color:var(--pw-primary)}.pw-shop-action-bar{display:grid;gap:8px;margin-top:auto}.pw-btn,.pw-btn-cart{display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 12px;border-radius:8px;border:none;color:#fff;text-decoration:none;font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;cursor:pointer}.pw-btn{background:var(--pw-buy)}.pw-btn-cart{background:var(--pw-cart)}'+${JSON.stringify(PW_PRODUCT_CATALOG_CARD_FACE_CSS)}+${JSON.stringify(PW_SITE_SALE_CARD_CSS)};
    document.head.appendChild(st);
  }
  if(!document.getElementById('pw-related-css')){
    var rel=document.createElement('style');
    rel.id='pw-related-css';
    rel.textContent=${JSON.stringify(PW_RELATED_CSS)};
    document.head.appendChild(rel);
  }
}
${PW_SITE_SALE_TICK_CHIPS_JS}
function tickSaleChips(){
  pwSaleTickChips(COPY.remaining,COPY.startsAfter,COPY.flashRemaining,COPY.countdownStarts,COPY.countdownLeft);
}
function run(){
  ensureStyles();
  tickSaleChips();
  if(!window.__pwSaleChipTimer)window.__pwSaleChipTimer=setInterval(tickSaleChips,1000);
  document.querySelectorAll('[data-pw-catalog],[data-pw-related]').forEach(function(el){
    var grid=el.querySelector('[data-pw-grid]');
    if(grid&&el.getAttribute('data-pw-live-products')==='loading')grid.innerHTML='';
    if(!(grid&&grid.children.length)) el.hidden=true;
    hydrate(el);
  });
  bindListingFilters();
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
  return `<section class="pw-catalog pw-section" ${pwRegionAttr(PW_REGION.catalog)} data-pw-section-id="${escapeAttr(input.sectionId)}" data-pw-catalog data-pw-grid-cols="5" data-pw-grid-cols-laptop="4" data-pw-grid-cols-tablet="3" data-pw-grid-cols-mobile="2" data-pw-grid-rows="${rows}" data-limit="${limit}" data-sort="default">
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
