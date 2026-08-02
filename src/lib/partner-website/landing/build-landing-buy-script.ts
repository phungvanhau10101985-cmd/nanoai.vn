import type { PartnerLandingProductSnapshot } from '@/lib/partner-website/landing/partner-landing-types'
import type { WebLocale } from '@/lib/i18n/config'

function escapeJs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function copyForLocale(locale: WebLocale): { buyTitle: string; close: string; empty: string } {
  if (locale === 'en') return { buyTitle: 'Choose a product', close: 'Close', empty: 'No products' }
  if (locale === 'zh') return { buyTitle: '选择商品', close: '关闭', empty: '暂无商品' }
  if (locale === 'ja') return { buyTitle: '商品を選ぶ', close: '閉じる', empty: '商品なし' }
  if (locale === 'ko') return { buyTitle: '상품 선택', close: '닫기', empty: '상품 없음' }
  return { buyTitle: 'Chọn sản phẩm', close: 'Đóng', empty: 'Chưa có sản phẩm' }
}

/** Inline script: product cards → PDP; [data-nanoai-buy] opens modal of attached products. */
export function buildPartnerLandingBuyScript(input: {
  siteSlug: string
  locale: WebLocale
  products: PartnerLandingProductSnapshot[]
}): string {
  const productsJson = JSON.stringify(
    input.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description.slice(0, 160),
      imageUrl: p.imageUrl,
      detailPath: p.detailPath,
    }))
  )
  const copy = copyForLocale(input.locale)
  const buyTitle = escapeJs(copy.buyTitle)
  const closeLabel = escapeJs(copy.close)
  const emptyLabel = escapeJs(copy.empty)

  return `<script data-pw-lp-buy>(function(){
var PRODUCTS=${productsJson};
var TITLE='${buyTitle}';
var CLOSE='${closeLabel}';
var EMPTY='${emptyLabel}';
function ensureModal(){
  var m=document.getElementById('pw-lp-buy-modal');
  if(m)return m;
  m=document.createElement('div');
  m.id='pw-lp-buy-modal';
  m.setAttribute('hidden','');
  m.innerHTML='<div class="pw-lp-buy-backdrop" data-pw-lp-close></div><div class="pw-lp-buy-panel" role="dialog" aria-modal="true"><div class="pw-lp-buy-head"><strong>'+TITLE+'</strong><button type="button" class="pw-lp-buy-close" data-pw-lp-close aria-label="'+CLOSE+'">×</button></div><div class="pw-lp-buy-list"></div></div>';
  var st=document.createElement('style');
  st.textContent='#pw-lp-buy-modal{position:fixed;inset:0;z-index:100000;display:flex;align-items:flex-end;justify-content:center;padding:16px}#pw-lp-buy-modal[hidden]{display:none!important}.pw-lp-buy-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.55)}.pw-lp-buy-panel{position:relative;z-index:1;width:min(480px,100%);max-height:80vh;overflow:auto;background:#fff;border-radius:16px 16px 12px 12px;box-shadow:0 20px 50px rgba(0,0,0,.25);padding:16px}.pw-lp-buy-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.pw-lp-buy-close{border:0;background:#f1f5f9;width:36px;height:36px;border-radius:999px;font-size:22px;cursor:pointer;line-height:1}.pw-lp-buy-item{display:grid;grid-template-columns:72px 1fr;gap:12px;padding:12px;border:1px solid #e2e8f0;border-radius:12px;text-decoration:none;color:inherit;margin-bottom:10px}.pw-lp-buy-item img{width:72px;height:72px;object-fit:cover;border-radius:8px;background:#f8fafc}.pw-lp-buy-item strong{display:block;font-size:14px}.pw-lp-buy-item span{display:block;font-size:13px;color:#64748b;margin-top:4px}@media(min-width:768px){#pw-lp-buy-modal{align-items:center}}';
  document.head.appendChild(st);
  document.body.appendChild(m);
  m.addEventListener('click',function(ev){
    var t=ev.target;
    if(t&&t.closest&&t.closest('[data-pw-lp-close]'))closeModal();
  });
  return m;
}
function closeModal(){
  var m=document.getElementById('pw-lp-buy-modal');
  if(m)m.setAttribute('hidden','');
  document.documentElement.style.overflow='';
}
function openModal(){
  var m=ensureModal();
  var list=m.querySelector('.pw-lp-buy-list');
  if(!list)return;
  list.innerHTML='';
  if(!PRODUCTS.length){
    list.textContent=EMPTY;
  }else{
    PRODUCTS.forEach(function(p){
      var a=document.createElement('a');
      a.className='pw-lp-buy-item';
      a.href=p.detailPath||('#');
      a.innerHTML=(p.imageUrl?'<img src="'+String(p.imageUrl).replace(/"/g,'&quot;')+'" alt="">':'<img alt="">')+
        '<div><strong></strong><span></span></div>';
      a.querySelector('strong').textContent=p.name||'';
      a.querySelector('span').textContent=p.price||'';
      list.appendChild(a);
    });
  }
  m.removeAttribute('hidden');
  document.documentElement.style.overflow='hidden';
}
document.addEventListener('click',function(ev){
  var t=ev.target;
  if(!t||!t.closest)return;
  var buy=t.closest('[data-nanoai-buy],.pw-lp-buy');
  if(buy){
    ev.preventDefault();
    ev.stopPropagation();
    openModal();
    return;
  }
},true);
})();</script>`
}

export function injectPartnerLandingBuyScriptIntoHtml(
  html: string,
  input: {
    siteSlug: string
    locale: WebLocale
    products: PartnerLandingProductSnapshot[]
  }
): string {
  if (html.includes('data-pw-lp-buy')) return html
  const script = buildPartnerLandingBuyScript(input)
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}\n</body>`)
  return `${html}\n${script}`
}
