export const PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT_ID = 'pw-arm-inline-runtime'

/**
 * Shop runtime scripts ship inert (`application/x-pw-runtime`) so they cannot mutate the
 * tree while React parses the flight payload. Live pages proved React may never commit the
 * visual subtree, which left every chrome/PDP handler dead until a second click. Arm the
 * runtime from plain HTML as soon as the document is parsed so the first click always works.
 */
export const PARTNER_SITE_ARM_INLINE_RUNTIME_SCRIPT = String.raw`
(function(){
  var INERT='application/x-pw-runtime';
  function arm(){
    var root=document.querySelector('[data-pw-inline-visual-root]');
    if(!root)return false;
    var scripts=root.querySelectorAll('script');
    if(!scripts.length)return false;
    var armed=0;
    Array.prototype.forEach.call(scripts,function(old){
      if(old.getAttribute('data-pw-script-armed')==='1')return;
      old.setAttribute('data-pw-script-armed','1');
      var next=document.createElement('script');
      next.textContent=old.textContent;
      Array.prototype.forEach.call(old.attributes,function(attr){
        if(attr.name==='data-pw-script-armed'||attr.name==='data-pw-script-inert'||attr.name==='data-pw-script-original-type')return;
        if(attr.name==='type'&&attr.value===INERT)return;
        next.setAttribute(attr.name,attr.value);
      });
      var originalType=old.getAttribute('data-pw-script-original-type');
      if(originalType)next.setAttribute('type',originalType);
      next.setAttribute('data-pw-script-armed','1');
      old.replaceWith(next);
      armed++;
    });
    if(!armed)return true;
    window.setTimeout(function(){
      document.dispatchEvent(new Event('pw-cart-updated'));
      document.dispatchEvent(new Event('pw-shop-notifications-refresh'));
      if(typeof window.__pwSceneCenterApply==='function')window.__pwSceneCenterApply();
    },0);
    return true;
  }
  if(arm())return;
  var tries=0;
  var iv=window.setInterval(function(){
    tries++;
    if(arm()||tries>120)window.clearInterval(iv);
  },25);
  document.addEventListener('DOMContentLoaded',function(){arm()});
})()
`
