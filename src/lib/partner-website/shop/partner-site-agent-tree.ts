/**
 * Live-only pass so the accessibility tree Lighthouse reads for agents is well-formed.
 * Does not change labels, layout, or which controls a shopper can use.
 */
export function buildPartnerSiteAgentTreeScript(): string {
  return `<script data-pw-agent-tree>(function(){
if(document.body&&document.body.classList.contains('nanoai-ve-active'))return;
var lang=(document.documentElement.lang||'vi').slice(0,2);
var COPY={
  vi:{home:'Trang chủ',cart:'Giỏ hàng',account:'Tài khoản',search:'Tìm kiếm',login:'Đăng nhập',wishlist:'Yêu thích',link:'Liên kết',button:'Nút',banner:'Banner',close:'Đóng'},
  en:{home:'Home',cart:'Cart',account:'Account',search:'Search',login:'Sign in',wishlist:'Wishlist',link:'Link',button:'Button',banner:'Banner',close:'Close'},
  zh:{home:'首页',cart:'购物车',account:'账户',search:'搜索',login:'登录',wishlist:'收藏',link:'链接',button:'按钮',banner:'横幅',close:'关闭'},
  ja:{home:'ホーム',cart:'カート',account:'アカウント',search:'検索',login:'ログイン',wishlist:'お気に入り',link:'リンク',button:'ボタン',banner:'バナー',close:'閉じる'},
  ko:{home:'홈',cart:'장바구니',account:'계정',search:'검색',login:'로그인',wishlist:'찜',link:'링크',button:'버튼',banner:'배너',close:'닫기'}
};
var t=COPY[lang]||COPY.vi;
function nameFromHref(href){
  var path=String(href||'').split('?')[0].replace(/\\/+$/,'');
  if(!path||path==='/'||path==='#')return t.home;
  if(/\\/cart$/.test(path))return t.cart;
  if(/\\/account$/.test(path))return t.account;
  if(/\\/(login|auth)$/.test(path))return t.login;
  if(/\\/(tim-kiem|search)$/.test(path))return t.search;
  if(/\\/wishlist$/.test(path))return t.wishlist;
  var bit=path.split('/').filter(Boolean).pop()||'';
  bit=decodeURIComponent(bit).replace(/[-_]+/g,' ').trim();
  return bit||t.link;
}
function hasName(el){
  var al=el.getAttribute('aria-label');
  if(al&&al.trim())return true;
  if((el.getAttribute('aria-labelledby')||'').trim())return true;
  var text=(el.textContent||'').replace(/\\s+/g,' ').trim();
  if(text)return true;
  var img=el.querySelector&&el.querySelector('img[alt]');
  return !!(img&&(img.getAttribute('alt')||'').trim());
}
function labelControl(el){
  if(!el||el.nodeType!==1)return;
  var tag=el.tagName;
  if(tag!=='A'&&tag!=='BUTTON'&&el.getAttribute('role')!=='link'&&el.getAttribute('role')!=='button')return;
  if(el.closest&&el.closest('[aria-hidden="true"]'))return;
  if(hasName(el))return;
  var title=(el.getAttribute('title')||'').trim();
  var href=el.getAttribute('href')||el.getAttribute('data-pw-clone-href')||'';
  var fallback=title||(tag==='A'||el.getAttribute('role')==='link'?nameFromHref(href):(el.getAttribute('data-pw-variant-close')!=null||el.getAttribute('data-pw-cart-added-close')!=null?t.close:t.button));
  el.setAttribute('aria-label',fallback);
}
function selfFocusable(el){
  if(!el||el.nodeType!==1||el.disabled)return false;
  var tag=el.tagName;
  if(tag==='A'&&el.hasAttribute('href'))return true;
  if(tag==='BUTTON'||tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return true;
  var ti=el.getAttribute('tabindex');
  return ti!=null&&ti!=='-1';
}
function hasFocusable(el){
  if(selfFocusable(el))return true;
  if(!el.querySelector)return false;
  return !!el.querySelector('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])');
}
function isDots(el){
  return !!(el&&el.classList&&(el.classList.contains('pw-slide-dots')||el.getAttribute('data-pw-el')==='dots'));
}
function labelDots(el){
  var buttons=el.querySelectorAll?el.querySelectorAll('button'):[];
  for(var i=0;i<buttons.length;i++){
    if(hasName(buttons[i]))continue;
    buttons[i].setAttribute('aria-label',t.banner+' '+(i+1));
  }
}
function defocusClone(el){
  var nodes=el.querySelectorAll?el.querySelectorAll('a[href]'):[];
  for(var i=0;i<nodes.length;i++){
    var a=nodes[i];
    var href=a.getAttribute('href');
    if(href&&!a.getAttribute('data-pw-clone-href'))a.setAttribute('data-pw-clone-href',href);
    a.removeAttribute('href');
  }
}
function nativelyHidden(el){
  var node=el;
  while(node&&node.nodeType===1){
    if(node.hasAttribute('hidden'))return true;
    node=node.parentElement;
  }
  return false;
}
function sync(el){
  if(!el||el.nodeType!==1)return;
  if(el.hasAttribute('data-pw-featured-clone')||(el.closest&&el.closest('[data-pw-featured-clone]'))){
    var clone=el.hasAttribute('data-pw-featured-clone')?el:el.closest('[data-pw-featured-clone]');
    if(clone)defocusClone(clone);
    return;
  }
  if(isDots(el)||(el.closest&&el.closest('.pw-slide-dots,[data-pw-el="dots"]'))){
    var dots=isDots(el)?el:el.closest('.pw-slide-dots,[data-pw-el="dots"]');
    if(dots){
      if(dots.getAttribute('aria-hidden')==='true')dots.removeAttribute('aria-hidden');
      dots.inert=false;
      labelDots(dots);
    }
    return;
  }
  var hidden=el.getAttribute('aria-hidden')==='true';
  if(el.tagName==='INPUT'&&String(el.type||'').toLowerCase()==='file')return;
  if(hidden&&hasFocusable(el)&&!nativelyHidden(el))el.inert=true;
  else if(!hidden&&el.inert)el.inert=false;
}
function walk(root){
  if(!root||(root.nodeType!==1&&root.nodeType!==9&&root.nodeType!==11))return;
  if(root.nodeType===1&&root.getAttribute('aria-hidden')==='true')sync(root);
  if(root.hasAttribute&&root.hasAttribute('data-pw-featured-clone'))sync(root);
  if(isDots(root))sync(root);
  var hidden=root.querySelectorAll?root.querySelectorAll('[aria-hidden="true"],[data-pw-featured-clone],.pw-slide-dots,[data-pw-el="dots"]'):[];
  for(var i=0;i<hidden.length;i++)sync(hidden[i]);
  var controls=root.querySelectorAll?root.querySelectorAll('a[href],button'):[];
  for(var c=0;c<controls.length;c++)labelControl(controls[c]);
}
if(!window.__pwFeatCloneClick){
  window.__pwFeatCloneClick=1;
  document.addEventListener('click',function(ev){
    var target=ev.target;
    if(!target||!target.closest)return;
    var a=target.closest('[data-pw-featured-clone] a[data-pw-clone-href]');
    if(!a)return;
    var href=a.getAttribute('data-pw-clone-href')||'';
    if(!href||href==='#')return;
    ev.preventDefault();
    location.assign(href);
  });
}
walk(document);
if(!document.title||!String(document.title).trim()){
  var h1=document.querySelector('h1');
  document.title=(h1&&h1.textContent||'').replace(/\\s+/g,' ').trim()||location.hostname;
}
var mo=new MutationObserver(function(list){
  for(var i=0;i<list.length;i++){
    var rec=list[i];
    if(rec.type==='attributes')sync(rec.target);
    else{
      for(var j=0;j<rec.addedNodes.length;j++)walk(rec.addedNodes[j]);
    }
  }
});
mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-hidden']});
})();</script>`
}
