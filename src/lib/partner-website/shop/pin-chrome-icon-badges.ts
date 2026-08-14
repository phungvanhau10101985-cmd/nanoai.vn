/** Move count badges into the icon box so they sit on the heart/clock, not the nav cell. */
export function pinChromeIconBadges(root: ParentNode): number {
  const buttons = root.querySelectorAll(
    '[data-pw-chrome-btn], .pw-shop-bottom-nav a, .pw-bottom-nav a, .pw-shop-header-actions a, .pw-header-actions a, .pw-shop-icon-btn, .pw-icon-btn'
  )
  let moved = 0
  buttons.forEach((el) => {
    const badge = el.querySelector('[data-pw-chrome-badge], .pw-cart-badge, .pw-shop-cart-badge')
    if (!badge) return
    const owner = badge.closest('a,button,[data-pw-chrome-btn],.pw-icon-btn,.pw-shop-icon-btn')
    if (owner && owner !== el) return

    let wrap = el.querySelector(':scope > .pw-chrome-icon-wrap')
    if (!wrap) {
      const svg = el.querySelector(':scope > svg') || el.querySelector('svg')
      if (!svg) return
      const existing = svg.closest('.pw-chrome-icon-wrap')
      if (existing && el.contains(existing)) {
        wrap = existing
      } else {
        wrap = (el.ownerDocument || document).createElement('span')
        wrap.className = 'pw-chrome-icon-wrap'
        svg.parentNode?.insertBefore(wrap, svg)
        wrap.appendChild(svg)
      }
    }
    if (badge.parentElement !== wrap) {
      wrap.appendChild(badge)
      moved += 1
    }
  })
  return moved
}

export const PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT_ID = 'pw-shop-chrome-badge-pin'

export const PARTNER_SHOP_CHROME_BADGE_PIN_SCRIPT = `(function(){
  function pin(root){
    var buttons=(root||document).querySelectorAll('[data-pw-chrome-btn],.pw-shop-bottom-nav a,.pw-bottom-nav a,.pw-shop-header-actions a,.pw-header-actions a,.pw-shop-icon-btn,.pw-icon-btn');
    for(var i=0;i<buttons.length;i++){
      var el=buttons[i];
      var badge=el.querySelector('[data-pw-chrome-badge],.pw-cart-badge,.pw-shop-cart-badge');
      if(!badge)continue;
      var owner=badge.closest('a,button,[data-pw-chrome-btn],.pw-icon-btn,.pw-shop-icon-btn');
      if(owner&&owner!==el)continue;
      var wrap=el.querySelector(':scope > .pw-chrome-icon-wrap');
      if(!wrap){
        var svg=el.querySelector(':scope > svg')||el.querySelector('svg');
        if(!svg)continue;
        var existing=svg.closest('.pw-chrome-icon-wrap');
        if(existing&&el.contains(existing))wrap=existing;
        else{
          wrap=document.createElement('span');
          wrap.className='pw-chrome-icon-wrap';
          if(svg.parentNode)svg.parentNode.insertBefore(wrap,svg);
          wrap.appendChild(svg);
        }
      }
      if(badge.parentNode!==wrap)wrap.appendChild(badge);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){pin(document);});
  else pin(document);
})();`
