import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteProductPath,
  partnerSiteProductsPath,
  partnerSiteSearchImageApiPath,
  partnerSiteSearchTextApiPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { searchGlyphSvg } from '@/lib/partner-website/visual-editor/search-cluster-icons'

const COPY: Record<
  WebLocale,
  {
    searching: string
    empty: string
    error: string
    imageBtn: string
    results: string
    imageTitle: string
    imagePaste: string
    imageHint: string
    imageChoose: string
    imageUrlPh: string
    imageUrlErr: string
    imageClose: string
    imageBusy: string
  }
> = {
  vi: {
    searching: 'Đang tìm…',
    empty: 'Không tìm thấy sản phẩm phù hợp.',
    error: 'Không tìm được. Thử lại.',
    imageBtn: 'Tìm bằng ảnh',
    results: 'Kết quả tìm kiếm',
    imageTitle: 'Tìm theo ảnh',
    imagePaste: 'Dán ảnh hoặc link',
    imageHint: 'Ctrl+V dán ảnh vào khung hoặc kéo thả ảnh — dán link vào ô bên dưới.',
    imageChoose: 'Chọn ảnh từ máy',
    imageUrlPh: 'https://…',
    imageUrlErr: 'Link cần bắt đầu bằng http:// hoặc https://',
    imageClose: 'Đóng',
    imageBusy: 'Đang tải ảnh…',
  },
  en: {
    searching: 'Searching…',
    empty: 'No matching products.',
    error: 'Search failed. Try again.',
    imageBtn: 'Search by image',
    results: 'Search results',
    imageTitle: 'Search by image',
    imagePaste: 'Paste a photo or link',
    imageHint: 'Ctrl+V to paste, or drag and drop — paste a link in the box below.',
    imageChoose: 'Choose a photo',
    imageUrlPh: 'https://…',
    imageUrlErr: 'Link must start with http:// or https://',
    imageClose: 'Close',
    imageBusy: 'Loading image…',
  },
  zh: {
    searching: '搜索中…',
    empty: '未找到匹配商品。',
    error: '搜索失败，请重试。',
    imageBtn: '以图搜图',
    results: '搜索结果',
    imageTitle: '以图搜图',
    imagePaste: '粘贴图片或链接',
    imageHint: 'Ctrl+V 粘贴，或拖放图片 — 也可在下方粘贴链接。',
    imageChoose: '从电脑选择图片',
    imageUrlPh: 'https://…',
    imageUrlErr: '链接需以 http:// 或 https:// 开头',
    imageClose: '关闭',
    imageBusy: '正在加载图片…',
  },
  ja: {
    searching: '検索中…',
    empty: '該当する商品がありません。',
    error: '検索に失敗しました。',
    imageBtn: '画像で検索',
    results: '検索結果',
    imageTitle: '画像で検索',
    imagePaste: '画像またはリンクを貼る',
    imageHint: 'Ctrl+V で貼るかドラッグ＆ドロップ。下の欄にリンクも可。',
    imageChoose: 'ファイルを選択',
    imageUrlPh: 'https://…',
    imageUrlErr: 'リンクは http:// または https:// で始めてください',
    imageClose: '閉じる',
    imageBusy: '画像を読み込み中…',
  },
  ko: {
    searching: '검색 중…',
    empty: '일치하는 상품이 없습니다.',
    error: '검색에 실패했습니다.',
    imageBtn: '이미지로 검색',
    results: '검색 결과',
    imageTitle: '이미지로 검색',
    imagePaste: '사진 또는 링크 붙여넣기',
    imageHint: 'Ctrl+V로 붙여넣거나 드래그 앤 드롭 — 아래 칸에 링크도 가능.',
    imageChoose: '파일 선택',
    imageUrlPh: 'https://…',
    imageUrlErr: '링크는 http:// 또는 https://로 시작해야 합니다',
    imageClose: '닫기',
    imageBusy: '이미지 불러오는 중…',
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
${PW_SHOP_LIVE_UI_OFF_FN};
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
  el.innerHTML='<div class="pw-search-results-inner" style="max-width:1200px;margin:1rem auto;padding:1rem"><h2 style="margin:0 0 1rem;font-size:1.25rem"></h2><p class="pw-search-status" style="margin:0 0 .75rem"></p><div class="pw-search-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem"></div></div>';
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
      +(price?'<div style="color:var(--pw-primary);margin-top:.25rem;font-size:.85rem">'+esc(price)+'</div>':'')
      +'</div></a>';
  }).join('');
}
function runTextSearch(q){
  if(pwShopLiveUiOff())return;
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
  if(pwShopLiveUiOff())return;
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
function looksHttp(u){return /^https?:\\/\\//i.test(String(u||'').trim());}
function imageBtnSel(){return '[data-pw-image-search], .pw-search-image-btn, .pw-shop-search-image';}
function ensureImageControl(){
  var file=document.querySelector('input[data-pw-image-search-input]');
  if(!file){
    file=document.createElement('input');
    file.type='file';
    file.accept='image/jpeg,image/png,image/webp,image/gif';
    file.setAttribute('data-pw-image-search-input','1');
    file.hidden=true;
    file.setAttribute('aria-hidden','true');
    document.body.appendChild(file);
  }
  var pop=document.getElementById('pw-image-search-popover');
  if(!pop){
    pop=document.createElement('div');
    pop.id='pw-image-search-popover';
    pop.setAttribute('data-pw-image-popover','1');
    pop.setAttribute('hidden','');
    pop.setAttribute('role','dialog');
    pop.setAttribute('aria-label',COPY.imageTitle);
    pop.innerHTML='<div class="pw-img-pop-head"><strong>'+esc(COPY.imageTitle)+'</strong><button type="button" data-pw-image-pop-close aria-label="'+esc(COPY.imageClose)+'">×</button></div>'
      +'<div class="pw-img-pop-drop" data-pw-image-drop>'
      +'<span class="pw-img-pop-title">'+esc(COPY.imagePaste)+'</span>'
      +'<span class="pw-img-pop-hint">'+esc(COPY.imageHint)+'</span>'
      +'<input data-pw-image-url type="url" inputmode="url" autocomplete="off" placeholder="'+esc(COPY.imageUrlPh)+'"/>'
      +'<span class="pw-img-pop-busy" data-pw-image-busy hidden>'+esc(COPY.imageBusy)+'</span>'
      +'<button type="button" class="pw-img-pop-choose" data-pw-image-choose>'+esc(COPY.imageChoose)+'</button>'
      +'</div><p class="pw-img-pop-err" data-pw-image-err hidden></p>';
    document.body.appendChild(pop);
  }
  var btns=document.querySelectorAll(imageBtnSel());
  if(!btns.length){
    var host=document.querySelector('[data-pw-search], input[type="search"], header .search, header form')||document.querySelector('header');
    if(host){
      var created=document.createElement('button');
      created.type='button';
      created.setAttribute('data-pw-image-search','1');
      created.setAttribute('data-pw-search-glyph','camera');
      created.setAttribute('aria-label',COPY.imageBtn);
      created.title=COPY.imageBtn;
      created.className='pw-search-image-btn pw-shop-search-image';
      created.innerHTML='<span class="pw-chrome-icon-wrap">${searchGlyphSvg('camera')}</span>';
      created.style.cssText='margin-left:.35rem;border:0;background:transparent;cursor:pointer;line-height:1;padding:.25rem;flex:0 0 auto';
      if(host.parentNode){
        if(host.tagName==='INPUT'||host.tagName==='FORM')host.parentNode.insertBefore(created,host.nextSibling);
        else host.appendChild(created);
      }
      btns=document.querySelectorAll(imageBtnSel());
    }
  }
  function setPopErr(msg){
    var err=pop.querySelector('[data-pw-image-err]');
    if(!err)return;
    if(msg){err.hidden=false;err.textContent=msg;}
    else{err.hidden=true;err.textContent='';}
  }
  function setPopBusy(on){
    var b=pop.querySelector('[data-pw-image-busy]');
    if(b)b.hidden=!on;
  }
  function placePop(anchor){
    pop.hidden=false;
    pop.style.position='fixed';
    pop.style.zIndex='100000';
    pop.style.visibility='hidden';
    pop.style.display='block';
    var pw=Math.min(320, Math.max(pop.offsetWidth||0, 260));
    var ph=pop.offsetHeight||0;
    var r=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect():{right:window.innerWidth-16,bottom:72,top:40};
    var left=Math.round(r.right-pw);
    if(left<8)left=8;
    if(left+pw>window.innerWidth-8)left=Math.max(8,window.innerWidth-pw-8);
    var top=Math.round(r.bottom+8);
    if(top+ph>window.innerHeight-8&&r.top>ph+16)top=Math.round(r.top-ph-8);
    pop.style.left=left+'px';
    pop.style.top=top+'px';
    pop.style.width=pw+'px';
    pop.style.visibility='';
    var url=pop.querySelector('[data-pw-image-url]');
    if(url)try{url.focus();}catch(errF){}
  }
  function hidePop(){
    pop.hidden=true;
    pop.style.display='none';
    setPopErr('');
    setPopBusy(false);
    var url=pop.querySelector('[data-pw-image-url]');
    if(url)url.value='';
  }
  function acceptFile(f){
    if(!f)return;
    hidePop();
    runImageSearch(f);
  }
  function fetchUrl(raw){
    var t=String(raw||'').trim();
    if(!t){setPopErr(COPY.imageUrlErr);return;}
    if(!looksHttp(t)){setPopErr(COPY.imageUrlErr);return;}
    setPopErr('');
    setPopBusy(true);
    fetch(t,{mode:'cors'}).then(function(r){
      if(!r.ok)throw new Error('http');
      return r.blob();
    }).then(function(blob){
      var type=blob.type||'image/jpeg';
      if(type.indexOf('image/')!==0)throw new Error('type');
      acceptFile(new File([blob],'search.jpg',{type:type}));
    }).catch(function(){
      setPopBusy(false);
      setPopErr(COPY.error);
    });
  }
  if(!file.getAttribute('data-pw-image-bound')){
    file.setAttribute('data-pw-image-bound','1');
    file.addEventListener('change',function(){
      var f=file.files&&file.files[0];if(f)acceptFile(f);file.value='';
    });
  }
  if(!pop.getAttribute('data-pw-image-bound')){
    pop.setAttribute('data-pw-image-bound','1');
    pop.querySelector('[data-pw-image-pop-close]').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();hidePop();});
    pop.querySelector('[data-pw-image-choose]').addEventListener('click',function(e){e.preventDefault();e.stopPropagation();file.click();});
    var drop=pop.querySelector('[data-pw-image-drop]');
    drop.addEventListener('dragover',function(e){e.preventDefault();});
    drop.addEventListener('drop',function(e){
      e.preventDefault();
      var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f&&String(f.type||'').indexOf('image/')===0)acceptFile(f);
    });
    drop.addEventListener('paste',function(e){
      var cd=e.clipboardData;if(!cd)return;
      var items=cd.items||[];
      for(var i=0;i<items.length;i++){
        if(items[i].kind==='file'&&String(items[i].type||'').indexOf('image/')===0){
          var pf=items[i].getAsFile&&items[i].getAsFile();
          if(pf){e.preventDefault();acceptFile(pf);return;}
        }
      }
      var text=(cd.getData&&cd.getData('text/plain')||'').trim();
      if(looksHttp(text)){e.preventDefault();fetchUrl(text);}
    });
    var urlInp=pop.querySelector('[data-pw-image-url]');
    urlInp.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();fetchUrl(urlInp.value);}
    });
  }
  if(!document.documentElement.getAttribute('data-pw-image-doc')){
    document.documentElement.setAttribute('data-pw-image-doc','1');
    document.addEventListener('click',function(e){
      if(pwShopLiveUiOff())return;
      var t=e.target;
      if(!t||!t.closest)return;
      var btn=t.closest(imageBtnSel());
      if(btn){
        e.preventDefault();
        e.stopPropagation();
        if(pop.hidden){setPopErr('');placePop(btn);}else hidePop();
        return;
      }
      if(!pop.hidden&&!pop.contains(t))hidePop();
    },true);
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!pop.hidden)hidePop();});
  }
}
function boot(){bindText();ensureImageControl();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
var imgMoT=null;
var imgMo=typeof MutationObserver!=='undefined'?new MutationObserver(function(){
  if(imgMoT)clearTimeout(imgMoT);
  imgMoT=setTimeout(function(){bindText();ensureImageControl();},120);
}):null;
if(imgMo)imgMo.observe(document.documentElement,{childList:true,subtree:true});
})();</script>
<style data-pw-search-image-css>
#pw-image-search-popover{background:#fff;border:1px solid var(--pw-border,#e5e7eb);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.16);padding:14px;color:var(--pw-text,#111);font:13px/1.4 system-ui,sans-serif}
#pw-image-search-popover[hidden]{display:none!important}
.pw-img-pop-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
.pw-img-pop-head strong{font-size:14px}
.pw-img-pop-head button{border:0;background:transparent;cursor:pointer;font-size:18px;line-height:1;color:var(--pw-muted,#6b7280)}
.pw-img-pop-drop{border:2px dashed var(--pw-primary,#f97316);border-radius:12px;background:var(--pw-surface,#fff7ed);padding:12px;text-align:center}
.pw-img-pop-title{display:block;font-weight:700;color:var(--pw-text,#111)}
.pw-img-pop-hint{display:block;margin-top:6px;font-size:12px;color:var(--pw-muted,#6b7280)}
.pw-img-pop-drop input[type=url]{margin-top:10px;width:100%;box-sizing:border-box;border:1px solid var(--pw-border,#e5e7eb);border-radius:8px;padding:8px 10px;font:13px system-ui,sans-serif}
.pw-img-pop-busy{display:block;margin-top:8px;font-size:12px;color:var(--pw-primary,#f97316);font-weight:600}
.pw-img-pop-choose{margin-top:10px;width:100%;border:0;border-radius:8px;padding:10px 12px;background:var(--pw-primary,#f97316);color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer}
.pw-img-pop-err{margin:8px 0 0;font-size:12px;color:#b91c1c}
[data-pw-image-search],.pw-search-image-btn,.pw-shop-search-image{cursor:pointer;pointer-events:auto!important}
</style>`
}
