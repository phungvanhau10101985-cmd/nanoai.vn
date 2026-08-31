import type { WebLocale } from '@/lib/i18n/config'
import {
  partnerSiteImageSearchPath,
  partnerSiteSearchHistoryApiPath,
  partnerSiteSearchPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerSiteSearchHistoryStorageKey } from '@/lib/partner-website/shop/partner-site-search-history'
import {
  PW_PENDING_IMAGE_EVENT,
  PW_PENDING_IMAGE_KEY,
} from '@/lib/partner-website/shop/partner-site-pending-image'
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
    historyAria: string
    historyRemove: string
    historyTitle: string
    historyEmpty: string
    historyClear: string
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
    historyAria: 'Lịch sử tìm kiếm',
    historyRemove: 'Xóa',
    historyTitle: 'Lịch sử tìm kiếm',
    historyEmpty: 'Chưa có từ khóa tìm kiếm',
    historyClear: 'Xóa tất cả lịch sử',
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
    historyAria: 'Search history',
    historyRemove: 'Remove',
    historyTitle: 'Search history',
    historyEmpty: 'No recent searches',
    historyClear: 'Clear all history',
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
    historyAria: '搜索历史',
    historyRemove: '删除',
    historyTitle: '搜索历史',
    historyEmpty: '暂无搜索记录',
    historyClear: '清除全部历史',
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
    historyAria: '検索履歴',
    historyRemove: '削除',
    historyTitle: '検索履歴',
    historyEmpty: '検索履歴はまだありません',
    historyClear: '履歴をすべて削除',
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
    historyAria: '검색 기록',
    historyRemove: '삭제',
    historyTitle: '검색 기록',
    historyEmpty: '최근 검색어가 없습니다',
    historyClear: '검색 기록 모두 삭제',
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
  const historyApi = partnerSiteSearchHistoryApiPath(slug)
  const historyLsKey = partnerSiteSearchHistoryStorageKey(slug)
  const searchPath = partnerSiteSearchPath(slug)
  const imagePath = partnerSiteImageSearchPath(slug)

  return `<script data-pw-search-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var SEARCH_PATH=${JSON.stringify(searchPath)};
var IMAGE_PATH=${JSON.stringify(imagePath)};
var HISTORY_API=${JSON.stringify(historyApi)};
var HISTORY_LS=${JSON.stringify(historyLsKey)};
var PENDING_KEY=${JSON.stringify(PW_PENDING_IMAGE_KEY)};
var PENDING_EVT=${JSON.stringify(PW_PENDING_IMAGE_EVENT)};
var COPY=${JSON.stringify(copy)};
var historyLoggedIn=false;
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
var historyList=[];
var historyOpen=false;
function searchHistoryWrap(el){
  if(el&&el.closest){
    var hit=el.closest('.pw-header-search,.pw-shop-search-wrap,[data-pw-el="search"]');
    if(hit)return hit;
  }
  return document.querySelector('.pw-header-search,.pw-shop-search-wrap,[data-pw-el="search"]');
}
function searchHistoryInput(){
  return document.querySelector('[data-pw-search], .pw-search-form input[type="search"], .pw-shop-search-form input[type="search"], input[type="search"]');
}
function normHistoryQ(raw){return String(raw||'').trim().replace(/\\s+/g,' ').slice(0,80);}
function dedupeHistory(arr){
  var out=[],seen={};
  for(var i=0;i<(arr||[]).length;i++){
    var q=normHistoryQ(arr[i]);if(!q)continue;
    var k=q.toLowerCase();if(seen[k])continue;seen[k]=1;out.push(q);if(out.length>=20)break;
  }
  return out;
}
function readLocalHistory(){
  try{return dedupeHistory(JSON.parse(localStorage.getItem(HISTORY_LS)||'[]'));}catch(e){return [];}
}
function writeLocalHistory(list){
  try{localStorage.setItem(HISTORY_LS,JSON.stringify(dedupeHistory(list)));}catch(e){}
}
function setHistoryList(list){
  historyList=dedupeHistory(list);
  if(historyOpen)renderHistory();
}
function ensureHistoryHost(){
  var wrap=searchHistoryWrap(document.activeElement)||searchHistoryWrap(searchHistoryInput());
  if(!wrap)return null;
  document.querySelectorAll('.pw-nav-main > [data-pw-search-history], .pw-shop-nav-row > [data-pw-search-history]').forEach(function(old){
    if(old.parentNode!==wrap)old.parentNode.removeChild(old);
  });
  var navOn=document.querySelector('.pw-nav-main[data-pw-search-history-on],.pw-shop-nav-row[data-pw-search-history-on]');
  if(navOn)navOn.removeAttribute('data-pw-search-history-on');
  var el=wrap.querySelector('[data-pw-search-history]');
  if(!el){
    el=document.createElement('div');
    el.setAttribute('data-pw-search-history','1');
    el.setAttribute('hidden','');
    wrap.appendChild(el);
  }
  el.setAttribute('data-pw-search-history-panel','1');
  if(!el.getAttribute('data-pw-search-history-bound')){
    el.setAttribute('data-pw-search-history-bound','1');
    el.addEventListener('mousedown',function(e){e.preventDefault();});
    el.addEventListener('click',function(e){
      if(pwShopLiveUiOff())return;
      var t=e.target;if(!t||!t.closest)return;
      var clear=t.closest('[data-pw-search-history-clear]');
      if(clear){e.preventDefault();e.stopPropagation();clearHistory();return;}
      var x=t.closest('[data-pw-search-history-x]');
      if(x){e.preventDefault();e.stopPropagation();removeHistory(x.getAttribute('data-pw-search-history-x'));return;}
      var qb=t.closest('[data-pw-search-history-q]');
      if(qb){e.preventDefault();runTextSearch(qb.getAttribute('data-pw-search-history-q'));closeHistory();}
    });
  }
  return el;
}
function renderHistory(){
  if(pwShopLiveUiOff())return;
  var host=ensureHistoryHost();if(!host)return;
  var list=dedupeHistory(historyList);
  host.setAttribute('role','listbox');
  host.setAttribute('aria-label',COPY.historyAria||'');
  var rows=list.length?list.map(function(q){
    var eq=esc(q);
    return '<div data-pw-search-history-item role="option"><button type="button" data-pw-search-history-q="'+eq+'">'+eq+'</button><button type="button" data-pw-search-history-x="'+eq+'" aria-label="'+esc((COPY.historyRemove||'')+' '+q)+'">×</button></div>';
  }).join(''):'<p data-pw-search-history-empty>'+esc(COPY.historyEmpty||'')+'</p>';
  var foot=list.length?'<button type="button" data-pw-search-history-clear>'+esc(COPY.historyClear||'')+'</button>':'';
  host.innerHTML='<div data-pw-search-history-head><span>'+esc(COPY.historyTitle||COPY.historyAria||'')+'</span></div>'+rows+foot;
  host.hidden=!historyOpen;
}
function openHistory(){
  if(pwShopLiveUiOff())return;
  historyOpen=true;
  var inp=searchHistoryInput();
  if(inp){inp.setAttribute('aria-expanded','true');inp.setAttribute('aria-haspopup','listbox');}
  renderHistory();
}
function closeHistory(){
  historyOpen=false;
  document.querySelectorAll('[data-pw-search-history]').forEach(function(el){el.hidden=true;});
  var inp=searchHistoryInput();
  if(inp)inp.setAttribute('aria-expanded','false');
}
function persistHistory(raw){
  if(pwShopLiveUiOff())return;
  var q=normHistoryQ(raw);if(!q)return;
  if(historyLoggedIn){
    fetch(HISTORY_API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({query:q})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};}).catch(function(){return {ok:false,j:null};});})
      .then(function(res){if(res.ok&&res.j&&res.j.ok)setHistoryList(res.j.queries||[]);})
      .catch(function(){});
    return;
  }
  var next=dedupeHistory([q].concat(readLocalHistory()));
  writeLocalHistory(next);
  setHistoryList(next);
}
function removeHistory(raw){
  if(pwShopLiveUiOff())return;
  var q=normHistoryQ(raw);
  if(historyLoggedIn){
    fetch(HISTORY_API,{method:'DELETE',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({query:q})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};}).catch(function(){return {ok:false,j:null};});})
      .then(function(res){if(res.ok&&res.j&&res.j.ok)setHistoryList(res.j.queries||[]);})
      .catch(function(){});
    return;
  }
  var next=readLocalHistory().filter(function(item){return item.toLowerCase()!==q.toLowerCase();});
  writeLocalHistory(next);
  setHistoryList(next);
}
function clearHistory(){
  if(pwShopLiveUiOff())return;
  if(historyLoggedIn){
    fetch(HISTORY_API,{method:'DELETE',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({})})
      .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};}).catch(function(){return {ok:false,j:null};});})
      .then(function(res){if(res.ok&&res.j&&res.j.ok){setHistoryList(res.j.queries||[]);closeHistory();}})
      .catch(function(){});
    return;
  }
  writeLocalHistory([]);
  setHistoryList([]);
  closeHistory();
}
function loadHistory(){
  if(pwShopLiveUiOff())return;
  fetch(HISTORY_API,{credentials:'same-origin'})
    .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};}).catch(function(){return {ok:false,j:null};});})
    .then(function(res){
      historyLoggedIn=!!(res.ok&&res.j&&res.j.loggedIn);
      if(historyLoggedIn){
        var local=readLocalHistory();
        if(local.length){
          fetch(HISTORY_API,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({queries:local})})
            .then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};}).catch(function(){return {ok:false,j:null};});})
            .then(function(m){writeLocalHistory([]);setHistoryList((m.ok&&m.j&&m.j.queries)||(res.j&&res.j.queries)||[]);})
            .catch(function(){setHistoryList(res.j&&res.j.queries||[]);});
        }else setHistoryList(res.j&&res.j.queries||[]);
      }else setHistoryList(readLocalHistory());
    })
    .catch(function(){setHistoryList(readLocalHistory());});
}
function toPublicPath(p){
  var s=String(p||'');
  if(String(location.pathname||'').indexOf('/site/')===0)return s;
  return s.replace(/^\\/site\\/[^/]+(?=\\/|$)/,'')||'/';
}
function runTextSearch(q){
  if(pwShopLiveUiOff())return;
  q=String(q||'').trim();if(q.length<1)return;
  closeHistory();
  persistHistory(q);
  var base=toPublicPath(SEARCH_PATH);
  var dest=base+(base.indexOf('?')>=0?'&':'?')+'q='+encodeURIComponent(q);
  location.assign(dest);
}
function onImageSearchPage(){
  var p=String(location.pathname||'').replace(/\\/$/,'');
  var dest=String(IMAGE_PATH||'').replace(/\\/$/,'');
  if(p===dest||(dest&&p.indexOf(dest+'/')===0))return true;
  return /\\/tim-theo-anh$/.test(p);
}
function fileToDataUrl(file){
  return new Promise(function(resolve,reject){
    var r=new FileReader();
    r.onload=function(){resolve(String(r.result));};
    r.onerror=function(){reject(r.error);};
    r.readAsDataURL(file);
  });
}
function compressFile(file,maxSide,quality){
  var type=String(file&&file.type||'');
  if(type.indexOf('image/')!==0||type==='image/gif')return fileToDataUrl(file);
  if(typeof createImageBitmap!=='function')return fileToDataUrl(file);
  return createImageBitmap(file).then(function(bitmap){
    var w=bitmap.width,h=bitmap.height;
    var scale=Math.min(1,maxSide/Math.max(w,h,1));
    var cw=Math.max(1,Math.round(w*scale));
    var ch=Math.max(1,Math.round(h*scale));
    var canvas=document.createElement('canvas');
    canvas.width=cw;canvas.height=ch;
    var ctx=canvas.getContext('2d');
    if(!ctx){bitmap.close();return fileToDataUrl(file);}
    ctx.drawImage(bitmap,0,0,cw,ch);
    bitmap.close();
    return canvas.toDataURL('image/jpeg',quality);
  }).catch(function(){return fileToDataUrl(file);});
}
function storePendingAndGo(file){
  if(pwShopLiveUiOff())return;
  if(!file)return;
  compressFile(file,1280,0.82).then(function(url){
    try{sessionStorage.setItem(PENDING_KEY,url);return url;}
    catch(e1){
      return compressFile(file,960,0.75).then(function(u2){
        try{sessionStorage.setItem(PENDING_KEY,u2);return u2;}
        catch(e2){
          return compressFile(file,800,0.72).then(function(u3){
            sessionStorage.setItem(PENDING_KEY,u3);return u3;
          });
        }
      });
    }
  }).then(function(){
    if(onImageSearchPage()){
      try{window.dispatchEvent(new CustomEvent(PENDING_EVT));}catch(e){}
      return;
    }
    location.assign(toPublicPath(IMAGE_PATH));
  }).catch(function(){location.assign(toPublicPath(IMAGE_PATH));});
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
  document.querySelectorAll('[data-pw-search], .pw-search-form input[type="search"], .pw-shop-search-form input[type="search"]').forEach(function(input){
    if(input.getAttribute('data-pw-search-bound'))return;
    input.setAttribute('data-pw-search-bound','1');
    input.setAttribute('aria-haspopup','listbox');
    input.setAttribute('aria-expanded','false');
    input.addEventListener('focus',function(){openHistory();});
    input.addEventListener('keydown',function(e){
      if(e.key==='Enter'){e.preventDefault();closeHistory();runTextSearch(input.value);}
      if(e.key==='Escape')closeHistory();
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
    storePendingAndGo(f);
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
function boot(){bindText();ensureImageControl();loadHistory();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
if(!document.documentElement.getAttribute('data-pw-search-history-doc')){
  document.documentElement.setAttribute('data-pw-search-history-doc','1');
  document.addEventListener('pw-search-history',function(e){
    var q=e&&e.detail&&e.detail.query;
    persistHistory(q);
  });
  document.addEventListener('mousedown',function(e){
    if(!historyOpen||pwShopLiveUiOff())return;
    var t=e.target;
    if(!t||!t.closest)return;
    if(t.closest('[data-pw-search-history], .pw-search-form, .pw-shop-search-form, [data-pw-search-form], [data-pw-search]'))return;
    closeHistory();
  });
}
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
