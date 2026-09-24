/** Clamp leftover logo coords so the box stays inside the device width. */
export const PARTNER_SHOP_LOGO_HOST_SCRIPT_ID = 'pw-shop-logo-host'
export const PARTNER_SHOP_LOGO_HOST_SCRIPT = `(function(){
  function headerMainOf(el){
    var header=el&&el.closest?el.closest('header,.pw-header,.pw-shop-header'):null;
    return header&&header.querySelector?(header.querySelector('.pw-header-main,.pw-shop-header-inner')||header):header;
  }
  function rebaseToHeaderMain(el){
    if(!el||!el.style)return;
    var host=headerMainOf(el);
    if(!host||el.parentNode===host)return;
    var r=null,hr=null;
    try{r=el.getBoundingClientRect();hr=host.getBoundingClientRect();}catch(eBox){}
    try{host.appendChild(el);}catch(eMove){return;}
    if(r&&hr){
      el.style.setProperty('left',Math.max(0,Math.round(r.left-hr.left))+'px','important');
      el.style.setProperty('top',Math.max(0,Math.round(r.top-hr.top))+'px','important');
      el.style.removeProperty('right');
      el.style.removeProperty('bottom');
      el.style.removeProperty('transform');
    }
  }
  function clamp(){
    var viewW=document.documentElement.clientWidth||window.innerWidth||0;
    var sceneW=parseFloat(window.getComputedStyle(document.documentElement).getPropertyValue('--pw-scene-w'))||0;
    if(sceneW>0)viewW=Math.min(viewW,sceneW);
    var logos=document.querySelectorAll('[data-pw-logo-float="1"]');
    for(var i=0;i<logos.length;i++){
      var el=logos[i];
      if(!el||!el.style)continue;
      rebaseToHeaderMain(el);
      var left=parseFloat(el.style.left);
      var top=parseFloat(el.style.top);
      var w=parseFloat(el.style.width)||0;
      var z=el.getAttribute('data-pw-z');
      if(z)el.style.setProperty('z-index',z,'important');
      if(isFinite(left)&&left<0)el.style.setProperty('left','0px','important');
      if(isFinite(top)&&top<0)el.style.setProperty('top','0px','important');
      if(viewW>0&&isFinite(left)&&w>0&&left+w>viewW){
        el.style.setProperty('left',Math.max(0,Math.round(viewW-w))+'px','important');
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clamp);
  else clamp();
  window.addEventListener('resize',clamp);
})();`
