import type { WebLocale } from '@/lib/i18n/config'

/** Copy khớp modal `CartAddedPopup` 188 — đủ 5 locale shop. */
export type CartAddedModalCopy = {
  cartAddedTitle: string
  cartGoToCart: string
  cartContinueShopping: string
  cartAddedClose: string
}

export const CART_ADDED_MODAL_COPY: Record<WebLocale, CartAddedModalCopy> = {
  vi: {
    cartAddedTitle: 'Đã thêm vào giỏ hàng',
    cartGoToCart: 'Vào giỏ hàng',
    cartContinueShopping: 'Mua sắm tiếp',
    cartAddedClose: 'Đóng',
  },
  en: {
    cartAddedTitle: 'Added to cart',
    cartGoToCart: 'View cart',
    cartContinueShopping: 'Continue shopping',
    cartAddedClose: 'Close',
  },
  zh: {
    cartAddedTitle: '已加入购物车',
    cartGoToCart: '进入购物车',
    cartContinueShopping: '继续购物',
    cartAddedClose: '关闭',
  },
  ja: {
    cartAddedTitle: 'カートに追加しました',
    cartGoToCart: 'カートを見る',
    cartContinueShopping: '買い物を続ける',
    cartAddedClose: '閉じる',
  },
  ko: {
    cartAddedTitle: '장바구니에 담았습니다',
    cartGoToCart: '장바구니 보기',
    cartContinueShopping: '계속 쇼핑',
    cartAddedClose: '닫기',
  },
}

/**
 * Modal giữa màn — 188 `CartAddedPopup`:
 * mobile nút xếp dọc; ≥640px hai nút ngang; ≥768px card rộng hơn.
 * Nút vào giỏ = `--pw-buy`, không hex cam.
 */
export const PW_CART_ADDED_MODAL_CSS = `
[data-pw-cart-added-popup]{position:fixed;inset:0;z-index:100050;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box}
[data-pw-cart-added-popup][hidden]{display:none!important}
[data-pw-cart-added-backdrop]{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,.5)}
[data-pw-cart-added-card]{position:relative;z-index:1;width:100%;max-width:28rem;max-height:calc(100dvh - 2rem);overflow:auto;border-radius:12px;background:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);touch-action:manipulation}
[data-pw-cart-added-head]{display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid #f3f4f6}
[data-pw-cart-added-thumb]{width:48px;height:48px;border-radius:4px;background:#f3f4f6;overflow:hidden;flex-shrink:0}
a[data-pw-cart-added-thumb]{display:block;line-height:0}
[data-pw-cart-added-thumb] img{width:48px;height:48px;object-fit:cover;display:block}
[data-pw-cart-added-copy]{flex:1;min-width:0}
[data-pw-cart-added-title]{margin:0;font:600 14px/1.35 system-ui,sans-serif;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-pw-cart-added-name]{margin:2px 0 0;font:400 12px/1.35 system-ui,sans-serif;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
a[data-pw-cart-added-pdp]{color:inherit;text-decoration:none}
[data-pw-cart-added-name] a[data-pw-cart-added-pdp]:hover{color:var(--pw-primary)}
[data-pw-cart-added-close]{flex-shrink:0;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#6b7280;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}
[data-pw-cart-added-close]:hover{background:#f3f4f6;color:#374151}
[data-pw-cart-added-close] svg{width:20px;height:20px}
[data-pw-cart-added-actions]{padding:12px;display:flex;flex-direction:column;gap:8px}
[data-pw-cart-added-go],[data-pw-cart-added-stay]{width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:10px 12px;border-radius:8px;font:600 14px/1.2 system-ui,sans-serif;border:none;cursor:pointer;text-decoration:none;box-sizing:border-box}
[data-pw-cart-added-go]{background:var(--pw-buy);color:#fff}
[data-pw-cart-added-go]:hover{filter:brightness(.92)}
[data-pw-cart-added-stay]{background:var(--pw-surface,#f3f4f6);color:var(--pw-text,#1f2937)}
[data-pw-cart-added-stay]:hover{filter:brightness(.96)}
@media (min-width:640px){
  [data-pw-cart-added-actions]{flex-direction:row}
  [data-pw-cart-added-go],[data-pw-cart-added-stay]{width:50%}
}
@media (min-width:768px){
  [data-pw-cart-added-card]{max-width:32rem}
  [data-pw-cart-added-head],[data-pw-cart-added-actions]{padding:16px}
  [data-pw-cart-added-title]{font-size:16px}
  [data-pw-cart-added-name]{font-size:14px}
  [data-pw-cart-added-close] svg{width:24px;height:24px}
}
`

/** HTML runtime popup lives on `document.body` and survives App Router soft-nav. */
export function hideLeftoverPartnerCartAddedHtmlPopup(doc: Document | null | undefined = typeof document === 'undefined' ? null : document) {
  if (!doc) return
  const root = doc.getElementById('pw-cart-added-popup')
  if (root) root.setAttribute('hidden', '')
}

export function hideLeftoverPartnerVariantModal(doc: Document | null | undefined = typeof document === 'undefined' ? null : document) {
  if (!doc) return
  const root = doc.getElementById('pw-variant-modal')
  if (root) root.setAttribute('hidden', '')
}

/** Close leftover add-to-cart overlays and unlock page scroll (cart/account soft-nav). */
export function releasePartnerShopBodyScroll(doc: Document | null | undefined = typeof document === 'undefined' ? null : document) {
  if (!doc) return
  hideLeftoverPartnerCartAddedHtmlPopup(doc)
  hideLeftoverPartnerVariantModal(doc)
  doc.body.style.overflow = ''
}

/** Runtime HTML shop — gọi `showCartAddedModal({name,imageUrl,inventory_id})` sau khi thêm giỏ. */
export const PW_CART_ADDED_MODAL_RUNTIME_JS = `
function cartAddedImg(url){
  url=String(url||'').trim();
  if(!url)return '';
  if(url.indexOf('//')===0)url='https:'+url;
  try{
    var u=new URL(url,location.origin);
    var host=u.hostname.toLowerCase();
    if(/alicdn\\.com$/.test(host)||/1688\\.com$/.test(host)||/alibaba\\.com$/.test(host)){
      if(host!=='img.alicdn.com'&&host!=='gw.alicdn.com'&&/\\.alicdn\\.com$/.test(host))u.hostname='img.alicdn.com';
      return '/api/fetch-image?url='+encodeURIComponent(u.toString());
    }
  }catch(e){}
  return url;
}
function shopModalIsOpen(id){
  var el=document.getElementById(id);
  return !!(el&&!el.hasAttribute('hidden'));
}
function hideCartAddedModal(){
  var root=document.getElementById('pw-cart-added-popup');
  if(!root)return;
  root.setAttribute('hidden','');
  if(shopModalIsOpen('pw-variant-modal')){
    document.body.style.overflow='hidden';
    return;
  }
  document.body.style.overflow='';
}
function bindCartAddedModalNavHide(){
  if(window.__pwCartAddedNavHide)return;
  window.__pwCartAddedNavHide=1;
  window.addEventListener('pw-shop-soft-nav',hideCartAddedModal);
}
function ensureCartAddedModal(){
  bindCartAddedModalNavHide();
  var root=document.getElementById('pw-cart-added-popup');
  if(root)return root;
  root=document.createElement('div');
  root.id='pw-cart-added-popup';
  root.setAttribute('data-pw-cart-added-popup','1');
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','pw-cart-added-title');
  root.setAttribute('hidden','');
  root.innerHTML='<div data-pw-cart-added-backdrop></div>'
    +'<div data-pw-cart-added-card>'
    +'<div data-pw-cart-added-head>'
    +'<a data-pw-cart-added-thumb data-pw-cart-added-pdp><img alt="" width="48" height="48"/></a>'
    +'<div data-pw-cart-added-copy><p data-pw-cart-added-title id="pw-cart-added-title"></p><p data-pw-cart-added-name><a data-pw-cart-added-pdp></a></p></div>'
    +'<button type="button" data-pw-cart-added-close aria-label="">'
    +'<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>'
    +'</button></div>'
    +'<div data-pw-cart-added-actions>'
    +'<a data-pw-cart-added-go href="#"><span aria-hidden="true">🛒</span><span></span></a>'
    +'<button type="button" data-pw-cart-added-stay><span aria-hidden="true">🛍️</span><span></span></button>'
    +'</div></div>';
  document.body.appendChild(root);
  var backdrop=root.querySelector('[data-pw-cart-added-backdrop]');
  var closeBtn=root.querySelector('[data-pw-cart-added-close]');
  var stayBtn=root.querySelector('[data-pw-cart-added-stay]');
  var goBtn=root.querySelector('[data-pw-cart-added-go]');
  if(backdrop)backdrop.addEventListener('click',hideCartAddedModal);
  if(closeBtn)closeBtn.addEventListener('click',hideCartAddedModal);
  if(stayBtn)stayBtn.addEventListener('click',hideCartAddedModal);
  if(goBtn){
    goBtn.addEventListener('pointerdown',hideCartAddedModal);
    goBtn.addEventListener('click',hideCartAddedModal);
  }
  var pdpLinks=root.querySelectorAll('[data-pw-cart-added-pdp]');
  for(var i=0;i<pdpLinks.length;i++){
    pdpLinks[i].addEventListener('pointerdown',hideCartAddedModal);
    pdpLinks[i].addEventListener('click',hideCartAddedModal);
  }
  document.addEventListener('keydown',function(ev){
    if(ev.key==='Escape'&&root&&!root.hasAttribute('hidden'))hideCartAddedModal();
  });
  return root;
}
function cartAddedPdpHref(item){
  var href=String((item&&(item.productHref||item.product_href))||'').trim();
  if(href)return href;
  var id=String((item&&(item.inventory_id||item.inventoryId))||'').trim();
  if(id&&UUID_RE.test(id))return DETAIL_PREFIX+id;
  return '';
}
function bindCartAddedPdpHref(root,href){
  var links=root.querySelectorAll('[data-pw-cart-added-pdp]');
  for(var i=0;i<links.length;i++){
    if(href)links[i].setAttribute('href',href);
    else links[i].removeAttribute('href');
  }
}
function showCartAddedModal(item){
  item=item||{};
  if(typeof hideVariantModal==='function')hideVariantModal();
  var root=ensureCartAddedModal();
  var title=root.querySelector('[data-pw-cart-added-title]');
  var nameEl=root.querySelector('[data-pw-cart-added-name] [data-pw-cart-added-pdp]')||root.querySelector('[data-pw-cart-added-name]');
  var img=root.querySelector('[data-pw-cart-added-thumb] img');
  var go=root.querySelector('[data-pw-cart-added-go]');
  var stay=root.querySelector('[data-pw-cart-added-stay] span:last-child');
  var goLabel=root.querySelector('[data-pw-cart-added-go] span:last-child');
  var closeBtn=root.querySelector('[data-pw-cart-added-close]');
  if(title)title.textContent=COPY.cartAddedTitle||COPY.addedToCart;
  if(nameEl)nameEl.textContent=String(item.name||'').trim()||'—';
  bindCartAddedPdpHref(root,cartAddedPdpHref(item));
  if(img){
    var src=cartAddedImg(item.imageUrl||item.image_url||'');
    img.alt=String(item.name||'');
    if(src){img.src=src;img.style.display='block';}
    else {img.removeAttribute('src');img.style.display='none';}
  }
  if(go)go.setAttribute('href',CART_PATH);
  if(goLabel)goLabel.textContent=COPY.cartGoToCart;
  if(stay)stay.textContent=COPY.cartContinueShopping;
  if(closeBtn)closeBtn.setAttribute('aria-label',COPY.cartAddedClose||COPY.cartGoToCart);
  root.setAttribute('data-pw-prev-overflow',document.body.style.overflow||'');
  document.body.style.overflow='hidden';
  root.removeAttribute('hidden');
}
`
