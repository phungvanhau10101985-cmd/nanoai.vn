export const PARTNER_LOGO_HOME_LINK_SCRIPT_ID = 'pw-logo-home-link'

function shopHomeHref(siteSlug: string, customDomain?: boolean): string {
  const slug = siteSlug.trim()
  if (!slug) return '/'
  return customDomain ? '/' : `/site/${encodeURIComponent(slug)}`
}

/** Logo không nằm trong <a> (hoặc href rỗng/#) → về trang chủ. */
export function injectPartnerLogoHomeLinkScript(
  html: string,
  siteSlug: string,
  customDomain?: boolean
): string {
  const slug = siteSlug.trim()
  const trimmed = html.trim()
  if (!slug || !trimmed) return html
  const home = shopHomeHref(slug, customDomain)
  const script = `<script id="${PARTNER_LOGO_HOME_LINK_SCRIPT_ID}">(function(){
var FALLBACK=${JSON.stringify(home)};
var SEL='img.pw-logo,img.pw-shop-logo,img.pw-shop-footer-logo,img.site-logo,[data-pw-logo-added],[data-pw-logo-float="1"],.pw-logo-frame,[data-pw-logo-frame="1"]';
function liveOff(){try{return !!(document.body&&document.body.classList.contains('nanoai-ve-active'))}catch(e){return false}}
function currentHome(){
  try{
    var path=String(location.pathname||'/');
    if(path.indexOf('/site/')===0){
      var rest=path.slice(6);
      var cut=rest.search(/[/?#]/);
      var slug=cut<0?rest:rest.slice(0,cut);
      if(slug)return '/site/'+slug;
    }
  }catch(ePath){}
  return FALLBACK||'/';
}
function isEmptyHref(h){h=String(h||'').trim();return !h||h==='#'||h.toLowerCase().indexOf('javascript:')===0}
function isContents(el){
  if(!el)return false;
  if(el.style&&String(el.style.display||'').toLowerCase()==='contents')return true;
  try{return !!(window.getComputedStyle&&getComputedStyle(el).display==='contents')}catch(e){return false}
}
function unitOf(el){
  if(!el||el.nodeType!==1)return null;
  // Prefer frame / home-link over a floated <img> (legacy mistake that blew layout to 100%).
  var frame=el.closest?el.closest('.pw-logo-frame,[data-pw-logo-frame="1"]'):null;
  if(frame)return frame;
  var home=el.closest?el.closest('a[data-pw-logo-home][data-pw-logo-float="1"],a.pw-brand[data-pw-logo-float="1"],a.pw-shop-brand[data-pw-logo-float="1"]'):null;
  if(home)return home;
  if(el.getAttribute&&el.getAttribute('data-pw-logo-float')==='1'){
    if((el.tagName||'').toLowerCase()==='img')return el.parentElement||el;
    return el;
  }
  var cls=' '+(el.className||'')+' ';
  if(cls.indexOf(' pw-logo-frame ')>=0)return el;
  return el;
}
function unwrap(a){
  if(!a||!a.parentNode)return;
  while(a.firstChild)a.parentNode.insertBefore(a.firstChild,a);
  a.parentNode.removeChild(a);
}
function markHome(a){
  if(!a)return;
  a.setAttribute('href',currentHome());
  a.setAttribute('data-pw-logo-home','1');
  a.style.setProperty('cursor','pointer');
}
function wrapUnit(unit){
  if(!unit||unit.nodeType!==1)return;
  var tag=(unit.tagName||'').toLowerCase();
  if(tag==='a'){markHome(unit);return;}
  var a=unit.closest?unit.closest('a'):null;
  var floated=unit.getAttribute&&unit.getAttribute('data-pw-logo-float')==='1';
  if(a&&a!==unit){
    if(isContents(a))unwrap(a);
    else if(floated){
      if(a.parentNode)a.parentNode.insertBefore(unit,a.nextSibling);
      markHome(a);
    } else {
      markHome(a);
      unit.style.setProperty('cursor','pointer');
      return;
    }
  }
  if(!unit.parentNode)return;
  var link=document.createElement('a');
  link.className='pw-brand';
  markHome(link);
  unit.parentNode.insertBefore(link,unit);
  if(floated){
    link.setAttribute('data-pw-logo-float','1');
    var z=unit.getAttribute('data-pw-z');
    var scene=unit.getAttribute('data-pw-scene');
    if(z)link.setAttribute('data-pw-z',z);
    if(scene)link.setAttribute('data-pw-scene',scene);
    link.style.cssText=unit.style.cssText;
    link.style.setProperty('cursor','pointer');
    unit.removeAttribute('data-pw-logo-float');
    unit.style.setProperty('position','relative','important');
    unit.style.setProperty('left','0','important');
    unit.style.setProperty('top','0','important');
    // Keep frame/img size in px (copied onto link above). Never width/height 100% —
    // that expands to a huge ancestor and pushes the logo off-screen on live.
    unit.style.removeProperty('z-index');
  }
  link.appendChild(unit);
  unit.style.setProperty('cursor','pointer');
}
function logoHit(el){
  if(!el||!el.closest)return null;
  if(el.closest('.pw-product-card,.pw-shop-card,[data-pw-el="card"]'))return null;
  return el.closest('[data-pw-logo-float="1"],.pw-logo-frame,[data-pw-logo-frame="1"],img.pw-logo,img.pw-shop-logo,img.pw-shop-footer-logo,img.site-logo,[data-pw-logo-added],[data-pw-el="logo"],a[data-pw-logo-home],a.pw-brand,a.pw-shop-brand');
}
function logoUnderPoint(x,y){
  var nodes=document.querySelectorAll('[data-pw-logo-float="1"],a[data-pw-logo-home],.pw-logo-frame,[data-pw-logo-frame="1"],header img.pw-logo,header img.pw-shop-logo,.pw-header img.pw-logo,.pw-shop-header img.pw-shop-logo');
  for(var i=0;i<nodes.length;i++){
    var r=nodes[i].getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return nodes[i];
  }
  return null;
}
function goHome(){
  var dest=currentHome();
  try{
    var here=String(location.pathname||'/');
    if(here===dest||(dest==='/'&&(here===''||here==='/'))){window.scrollTo(0,0);return;}
  }catch(eHere){}
  location.assign(dest);
}
function onLogoClick(e){
  if(liveOff())return;
  if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button)return;
  var t=e.target;
  var hit=logoHit(t);
  if(!hit){
    var bar=t&&t.closest?t.closest('.pw-topbar,.pw-shop-topbar'):null;
    if(!bar)return;
    if(t.closest&&t.closest('a[href],button'))return;
    hit=logoUnderPoint(e.clientX,e.clientY);
  }
  if(!hit)return;
  e.preventDefault();
  e.stopPropagation();
  goHome();
}
function run(){
  var imgs=document.querySelectorAll('img.pw-logo,img.pw-shop-logo,img.pw-shop-footer-logo,img.site-logo,[data-pw-logo-added]');
  for(var ii=0;ii<imgs.length;ii++){
    imgs[ii].removeAttribute('data-pw-logo-float');
    imgs[ii].removeAttribute('data-pw-logo-floated');
  }
  var nodes=document.querySelectorAll(SEL);
  var seen=typeof WeakSet==='function'?new WeakSet():null;
  for(var i=0;i<nodes.length;i++){
    var unit=unitOf(nodes[i]);
    if(!unit)continue;
    if(seen){if(seen.has(unit))continue;seen.add(unit)}
    wrapUnit(unit);
  }
  repairPercentLogoHomes();
}
function repairPercentLogoHomes(){
  var links=document.querySelectorAll('a[data-pw-logo-home],a.pw-brand[data-pw-logo-float="1"],a.pw-shop-brand[data-pw-logo-float="1"]');
  for(var i=0;i<links.length;i++){
    var a=links[i];
    if(!a||!a.style)continue;
    var img=a.querySelector?a.querySelector('img.pw-logo,img.pw-shop-logo,img.pw-shop-footer-logo,img.site-logo,[data-pw-logo-added]'):null;
    if(!img){
      if(a.getAttribute&&a.getAttribute('data-pw-logo-float')==='1'&&a.parentNode)a.parentNode.removeChild(a);
      continue;
    }
    var sw=String(a.style.width||'');
    var sh=String(a.style.height||'');
    var badPct=sw.indexOf('%')>=0||sh.indexOf('%')>=0;
    var r=a.getBoundingClientRect();
    var off=r.right<0||r.bottom<0||r.left>(window.innerWidth||1200)||r.width>Math.max(480,(window.innerWidth||1200)*0.9);
    if(!badPct&&!off)continue;
    var frame=a.querySelector?a.querySelector('.pw-logo-frame,[data-pw-logo-frame="1"]'):null;
    var fw=frame?parseFloat(frame.style.width)||0:0;
    var fh=frame?parseFloat(frame.style.height)||0:0;
    if(!(fw>8&&fh>8)){fw=140;fh=48}
    a.style.setProperty('width',Math.round(fw)+'px','important');
    a.style.setProperty('height',Math.round(fh)+'px','important');
    a.style.removeProperty('transform');
    if(img.style){
      img.style.removeProperty('transform');
      img.style.setProperty('width','100%','important');
      img.style.setProperty('height','100%','important');
      img.style.objectFit='contain';
    }
    if(a.getAttribute&&(a.getAttribute('data-pw-logo-float')==='1'||a.getAttribute('data-pw-logo-floated')==='1')){
      a.style.setProperty('position','absolute','important');
      var host=a.closest?a.closest('.pw-header-main,.pw-shop-header-inner,header,.pw-header,.pw-shop-header'):null;
      var hr=host?host.getBoundingClientRect():{left:0,top:0,width:window.innerWidth||1200,height:64};
      var left=parseFloat(a.style.left);
      var top=parseFloat(a.style.top);
      // Broken wraps often leave left mid-header (over search). Snap back to the brand corner.
      if(!isFinite(left)||left<0||left>hr.width*0.35||off||badPct)left=8;
      if(!isFinite(top)||top<0||top>Math.max(8,hr.height))top=Math.max(2,Math.round((hr.height-fh)/2));
      a.style.setProperty('left',Math.round(left)+'px','important');
      a.style.setProperty('top',Math.round(top)+'px','important');
    }
  }
}
if(!window.__pwLogoHomeBound){
  window.__pwLogoHomeBound=1;
  document.addEventListener('click',onLogoClick,true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);
else run();
})();</script>`
  if (trimmed.includes(PARTNER_LOGO_HOME_LINK_SCRIPT_ID)) {
    return trimmed.replace(
      new RegExp(`<script id="${PARTNER_LOGO_HOME_LINK_SCRIPT_ID}">[\\s\\S]*?<\\/script>`, 'i'),
      script
    )
  }
  if (/<\/body>/i.test(trimmed)) return trimmed.replace(/<\/body>/i, `${script}\n</body>`)
  return `${trimmed}\n${script}`
}
