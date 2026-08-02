import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteProductPath,
  partnerSiteProductsPath,
  partnerSiteSearchImageApiPath,
  partnerSiteSearchTextApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

const COPY: Record<
  WebLocale,
  { searching: string; empty: string; error: string; imageBtn: string; results: string }
> = {
  vi: {
    searching: 'Đang tìm…',
    empty: 'Không tìm thấy sản phẩm phù hợp.',
    error: 'Không tìm được. Thử lại.',
    imageBtn: 'Tìm bằng ảnh',
    results: 'Kết quả tìm kiếm',
  },
  en: {
    searching: 'Searching…',
    empty: 'No matching products.',
    error: 'Search failed. Try again.',
    imageBtn: 'Search by image',
    results: 'Search results',
  },
  zh: {
    searching: '搜索中…',
    empty: '未找到匹配商品。',
    error: '搜索失败，请重试。',
    imageBtn: '以图搜图',
    results: '搜索结果',
  },
  ja: {
    searching: '検索中…',
    empty: '該当する商品がありません。',
    error: '検索に失敗しました。',
    imageBtn: '画像で検索',
    results: '検索結果',
  },
  ko: {
    searching: '검색 중…',
    empty: '일치하는 상품이 없습니다.',
    error: '검색에 실패했습니다.',
    imageBtn: '이미지로 검색',
    results: '검색 결과',
  },
}

/**
 * Same-platform shop: auto-wire text + image product search (no Bearer).
 * Hooks: [data-pw-search], form[data-pw-search-form], input[type=search], [data-pw-image-search]
 */
export function buildPartnerSiteSearchBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const locale = input.locale in COPY ? input.locale : 'en'
  const copy = COPY[locale]
  const textApi = partnerSiteSearchTextApiPath(slug)
  const imageApi = partnerSiteSearchImageApiPath(slug)
  const productsPath = partnerSiteProductsPath(slug)
  const productPathPrefix = partnerSiteProductPath(slug, '__ID__').replace('__ID__', '')

  return `<script data-pw-search-bootstrap>(function(){
var TEXT_API=${JSON.stringify(textApi)};
var IMAGE_API=${JSON.stringify(imageApi)};
var PRODUCTS_PATH=${JSON.stringify(productsPath)};
var DETAIL_PREFIX=${JSON.stringify(productPathPrefix)};
var COPY=${JSON.stringify(copy)};
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
function ensurePanel(){
  var el=document.getElementById('pw-search-results');
  if(el)return el;
  el=document.createElement('section');
  el.id='pw-search-results';
  el.setAttribute('data-pw-search-results','1');
  el.setAttribute('hidden','');
  el.innerHTML='<div class="pw-search-results-inner" style="max-width:1200px;margin:1rem auto;padding:1rem"><h2 style="margin:0 0 1rem;font-size:1.25rem"></h2><p class="pw-search-status" style="margin:0 0 .75rem"></p><div class="pw-search-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:1rem"></div></div>';
  var main=document.querySelector('main,#pw-main,.pw-main')||document.body;
  main.insertBefore(el, main.firstChild);
  return el;
}
function showStatus(msg,isErr){
  var panel=ensurePanel();panel.hidden=false;
  var st=panel.querySelector('.pw-search-status');
  var h=panel.querySelector('h2');
  if(h)h.textContent=COPY.results;
  if(st){st.textContent=msg||'';st.style.color=isErr?'#b91c1c':'';}
}
function renderProducts(list){
  var panel=ensurePanel();panel.hidden=false;
  var grid=panel.querySelector('.pw-search-grid');if(!grid)return;
  var h=panel.querySelector('h2');if(h)h.textContent=COPY.results;
  var st=panel.querySelector('.pw-search-status');if(st)st.textContent='';
  if(!list||!list.length){grid.innerHTML='';showStatus(COPY.empty,false);return;}
  grid.innerHTML=list.map(function(p){
    var id=p.id||p.inventory_id||'';
    var href=p.detailPath||(id?DETAIL_PREFIX+encodeURIComponent(id):PRODUCTS_PATH);
    var img=p.imageUrl||p.image_url||'';
    var name=p.name||'';
    var price=p.priceHint||p.price_hint||'';
    return '<a href="'+esc(href)+'" class="pw-search-card" style="display:block;text-decoration:none;color:inherit;border-radius:12px;overflow:hidden;background:#f5f5f5">'
      +(img?'<img src="'+esc(img)+'" alt="'+esc(name)+'" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;display:block"/>':'')
      +'<div style="padding:.65rem"><div style="font-weight:600;font-size:.9rem">'+esc(name)+'</div>'
      +(price?'<div style="color:#ea580c;margin-top:.25rem;font-size:.85rem">'+esc(price)+'</div>':'')
      +'</div></a>';
  }).join('');
}
function runTextSearch(q){
  q=String(q||'').trim();if(q.length<1)return;
  showStatus(COPY.searching,false);
  fetch(TEXT_API+'?q='+encodeURIComponent(q)+'&limit=24',{credentials:'same-origin'})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(res){
      if(!res.ok||!res.j||!res.j.ok){showStatus((res.j&&res.j.error)||COPY.error,true);return;}
      renderProducts(res.j.products||[]);
    })
    .catch(function(){showStatus(COPY.error,true);});
}
function runImageSearch(file){
  if(!file)return;
  showStatus(COPY.searching,false);
  var fd=new FormData();fd.append('image',file);fd.append('limit','24');
  fetch(IMAGE_API,{method:'POST',body:fd,credentials:'same-origin'})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});})
    .then(function(res){
      if(!res.ok||!res.j||!res.j.ok){showStatus((res.j&&res.j.error)||COPY.error,true);return;}
      var list=res.j.products||[];
      if(!list.length){showStatus(res.j.error||COPY.empty,false);return;}
      renderProducts(list);
    })
    .catch(function(){showStatus(COPY.error,true);});
}
function bindText(){
  var forms=document.querySelectorAll('[data-pw-search-form], form[role="search"]');
  forms.forEach(function(form){
    if(form.getAttribute('data-pw-search-bound'))return;
    form.setAttribute('data-pw-search-bound','1');
    form.addEventListener('submit',function(e){
      var input=form.querySelector('[data-pw-search], input[type="search"], input[name="q"], input[name="search"]');
      var q=input&&'value' in input?input.value:'';
      if(!q)return;
      e.preventDefault();
      runTextSearch(q);
    });
  });
  document.querySelectorAll('[data-pw-search]').forEach(function(input){
    if(input.getAttribute('data-pw-search-bound'))return;
    input.setAttribute('data-pw-search-bound','1');
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();runTextSearch(input.value);}
    });
  });
  // Header search without data attrs: first type=search in header/nav
  if(!document.querySelector('[data-pw-search],[data-pw-search-form]')){
    var hi=document.querySelector('header input[type="search"], nav input[type="search"], .search input[type="search"], input[type="search"]');
    if(hi&&!hi.getAttribute('data-pw-search-bound')){
      hi.setAttribute('data-pw-search','1');
      hi.setAttribute('data-pw-search-bound','1');
      var form=hi.closest('form');
      if(form){
        form.setAttribute('data-pw-search-form','1');
        form.addEventListener('submit',function(e){e.preventDefault();runTextSearch(hi.value);});
      }else{
        hi.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();runTextSearch(hi.value);}});
      }
    }
  }
}
function ensureImageControl(){
  var btn=document.querySelector('[data-pw-image-search]');
  var file=document.querySelector('input[data-pw-image-search-input], input[type="file"][accept*="image"][data-pw-image-search-input]');
  if(!file){
    file=document.createElement('input');
    file.type='file';
    file.accept='image/*';
    file.setAttribute('data-pw-image-search-input','1');
    file.hidden=true;
    document.body.appendChild(file);
  }
  if(!btn){
    var host=document.querySelector('[data-pw-search], input[type="search"], header .search, header form')||document.querySelector('header');
    if(host){
      btn=document.createElement('button');
      btn.type='button';
      btn.setAttribute('data-pw-image-search','1');
      btn.setAttribute('aria-label',COPY.imageBtn);
      btn.title=COPY.imageBtn;
      btn.textContent='📷';
      btn.style.cssText='margin-left:.35rem;border:0;background:transparent;cursor:pointer;font-size:1.1rem;line-height:1;padding:.25rem';
      if(host.parentNode){
        if(host.tagName==='INPUT'||host.tagName==='FORM')host.parentNode.insertBefore(btn,host.nextSibling);
        else host.appendChild(btn);
      }
    }
  }
  if(btn&&!btn.getAttribute('data-pw-image-bound')){
    btn.setAttribute('data-pw-image-bound','1');
    btn.addEventListener('click',function(){file.click();});
  }
  if(file&&!file.getAttribute('data-pw-image-bound')){
    file.setAttribute('data-pw-image-bound','1');
    file.addEventListener('change',function(){
      var f=file.files&&file.files[0];if(f)runImageSearch(f);file.value='';
    });
  }
}
function boot(){bindText();ensureImageControl();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`
}
