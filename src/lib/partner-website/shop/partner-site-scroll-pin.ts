/** Giữ chỗ cuộn khi shop vừa hiện xong rồi dịch DOM / gắn widget.
 *  Không kéo khách xuống cuối trang. Sửa nhanh không bật. */

export const PARTNER_SHOP_SCROLL_PIN_SCRIPT_ID = 'pw-shop-scroll-pin'

export const PARTNER_SHOP_SCROLL_PIN_SCRIPT = `(function(){
  if(window.__pwScrollPin)return;
  window.__pwScrollPin=1;
  function editor(){
    var html=document.documentElement;
    var body=document.body;
    return !!((html&&html.classList&&html.classList.contains('nanoai-ve-active'))||(body&&body.classList&&body.classList.contains('nanoai-ve-active')));
  }
  function nearBottom(y){
    var root=document.documentElement;
    var docH=Math.max((root&&root.scrollHeight)||0,(document.body&&document.body.scrollHeight)||0);
    var max=docH-(window.innerHeight||0);
    if(!(max>400))return false;
    return y>Math.max(max-140,max*0.82);
  }
  window.__pwPinScroll=function(fn){
    var y=window.scrollY||0;
    var root=document.documentElement;
    var held=!!(root&&root.style&&root.style.overflowAnchor==='none');
    if(root&&root.style&&!held)root.style.overflowAnchor='none';
    window.__pwScrollPinning=1;
    try{fn();}finally{
      var now=window.scrollY||0;
      if(now-y>240&&nearBottom(now))window.scrollTo(0,y);
      if(root&&root.style&&!held)root.style.overflowAnchor='';
    }
    requestAnimationFrame(function(){
      var again=window.scrollY||0;
      if(again-y>240&&nearBottom(again))window.scrollTo(0,y);
      window.__pwScrollPinning=0;
    });
  };
  if(editor())return;
  var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
  var back=!!(nav&&nav.type==='back_forward');
  var html=document.documentElement;
  if(!html||!html.style)return;
  var prevAnchor=html.style.overflowAnchor;
  html.style.overflowAnchor='none';
  window.setTimeout(function(){
    if(html.style.overflowAnchor==='none')html.style.overflowAnchor=prevAnchor;
  },14000);
  if(back)return;
  var saved=window.scrollY||0;
  var userScroll=0;
  var armed=1;
  var until=Date.now()+14000;
  function markUser(){userScroll=Date.now();}
  window.addEventListener('wheel',markUser,{capture:true,passive:true});
  window.addEventListener('touchmove',markUser,{capture:true,passive:true});
  window.addEventListener('keydown',function(e){
    var k=e&&e.key;
    if(k==='ArrowDown'||k==='ArrowUp'||k==='PageDown'||k==='PageUp'||k===' '||k==='End'||k==='Home')markUser();
  },true);
  window.addEventListener('scroll',function(){
    if(!armed||window.__pwScrollPinning||editor())return;
    if(Date.now()>until){armed=0;return;}
    var now=window.scrollY||0;
    if(location.hash){saved=now;return;}
    if(Date.now()-userScroll<700||Math.abs(now-saved)<80){saved=now;return;}
    if(saved>180)return;
    if(now-saved<300)return;
    if(!nearBottom(now))return;
    window.__pwScrollPinning=1;
    window.scrollTo(0,saved);
    requestAnimationFrame(function(){window.__pwScrollPinning=0;});
  },{passive:true});
})();`
