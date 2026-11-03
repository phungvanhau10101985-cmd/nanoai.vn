import type { WebLocale } from '@/lib/i18n/config'
import { partnerHolidayLook } from '@/lib/partner-website/promotions/partner-holiday-looks'

export function partnerSiteHolidayThemeApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/holiday-theme`
}

const COPY: Record<
  WebLocale,
  { previewOnly: string; dismiss: string; closePreview: string }
> = {
  vi: {
    previewOnly: 'Chỉ admin thấy, còn {left}. Khách không thấy.',
    dismiss: 'Đóng dải',
    closePreview: 'Tắt xem trước',
  },
  en: {
    previewOnly: 'Admins only, {left} left. Shoppers do not see this.',
    dismiss: 'Dismiss',
    closePreview: 'Turn off preview',
  },
  zh: {
    previewOnly: '仅管理员可见，剩余 {left}。顾客看不到。',
    dismiss: '关闭',
    closePreview: '关闭预览',
  },
  ja: {
    previewOnly: '管理者のみ、残り {left}。客には見えません。',
    dismiss: '閉じる',
    closePreview: 'プレビューをオフ',
  },
  ko: {
    previewOnly: '관리자만 보입니다. {left} 남음. 고객은 보지 못합니다.',
    dismiss: '닫기',
    closePreview: '미리보기 끄기',
  },
}

const HOLIDAY_CSS = [
  'html.holiday-on{',
  '--pw-primary:var(--h-strong);',
  '--pw-accent:var(--h-mid);',
  '--pw-buy:var(--h-strong);',
  '--pw-cart:var(--h-deep);',
  '--pw-footer:var(--h-deep);',
  '}',
  'html.holiday-on [data-pw-region="header"],html.holiday-on .pw-header,html.holiday-on .pw-shop-header{',
  'box-shadow:inset 0 -3px 0 var(--h-gold);',
  '}',
  'html.holiday-on [data-pw-region="footer"],html.holiday-on .pw-footer{',
  'border-top:3px solid var(--h-strong);',
  '}',
  '[data-pw-holiday-preview]{position:sticky;top:0;z-index:80;background:var(--h-deep);color:#fff;padding:.45rem .75rem;font-size:12px;display:flex;gap:.75rem;align-items:center;justify-content:space-between}',
  '[data-pw-holiday-ribbon]{background:var(--h-paper);color:var(--h-ink);padding:.55rem .9rem;font-size:13px;border-bottom:1px solid var(--h-gold-soft)}',
  '[data-pw-holiday-ribbon] strong{display:block}',
].join('')

export function buildPartnerHolidayThemeBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = partnerSiteHolidayThemeApiPath(slug)
  const copy = COPY[input.locale] ?? COPY.vi
  const looks = Object.fromEntries(
    (['duong-lich', 'tao-quan', 'tet', 'valentine', 'nguyen-tieu', 'phu-nu-83', 'gio-to', 'dai-le', 'thieu-nhi', 'doan-ngo', 'vu-lan', 'quoc-khanh', 'trung-thu', 'phu-nu-2010', 'nha-giao', 'giang-sinh'] as const).map(
      (id) => {
        const look = partnerHolidayLook(id)
        return [id, look ? { vars: {
          '--h-strong': look.strong,
          '--h-deep': look.deep,
          '--h-mid': look.mid,
          '--h-gold': look.gold,
          '--h-gold-soft': look.goldSoft,
          '--h-paper': look.paper,
          '--h-ink': look.ink,
          '--h-dark': look.dark,
        }, themeColor: look.themeColor } : null]
      }
    )
  )
  return `<style data-pw-holiday-theme-css>${HOLIDAY_CSS}</style><script data-pw-holiday-theme-bootstrap>(function(){
if(typeof pwShopLiveUiOff==='function'&&pwShopLiveUiOff())return;
var API=${JSON.stringify(api)},COPY=${JSON.stringify(copy)},LOOKS=${JSON.stringify(looks)};
function qs(){return location.search||'';}
function apply(state){
  var html=document.documentElement;
  var theme=state&&state.activeTheme;
  var look=(state&&state.look)||null;
  var fallback=theme&&LOOKS[theme];
  var vars=look&&look.vars||fallback&&fallback.vars;
  if(!theme||!vars){
    html.classList.remove('holiday-on');
    html.removeAttribute('data-holiday-theme');
    removeBars();
    return;
  }
  html.classList.add('holiday-on');
  html.setAttribute('data-holiday-theme',theme);
  Object.keys(vars).forEach(function(k){html.style.setProperty(k,vars[k]);});
  var meta=document.querySelector('meta[name="theme-color"]');
  if(meta&&(look&&look.themeColor||fallback&&fallback.themeColor)) meta.setAttribute('content',look&&look.themeColor||fallback.themeColor);
  ensureRibbon(look);
  if(state.preview) ensurePreview(look,state.previewExpiresAt);
  else removePreview();
}
function host(){
  var chrome=document.querySelector('[data-pw-live-chrome]');
  if(chrome&&chrome.parentNode) return {parent:chrome.parentNode,after:chrome};
  var header=document.querySelector('header.pw-header,header.pw-shop-header,[data-pw-region="header"]');
  if(header&&header.parentNode) return {parent:header.parentNode,after:header};
  return {parent:document.body,before:document.body.firstChild};
}
function ensureRibbon(look){
  if(!look) return;
  var el=document.querySelector('[data-pw-holiday-ribbon]');
  if(!el){
    el=document.createElement('div');
    el.setAttribute('data-pw-holiday-ribbon','1');
    var slot=host();
    if(slot.after&&slot.after.nextSibling) slot.parent.insertBefore(el,slot.after.nextSibling);
    else if(slot.before) slot.parent.insertBefore(el,slot.before);
    else slot.parent.appendChild(el);
  }
  el.innerHTML='<strong>'+escapeHtml(look.ribbonTitle||'')+'</strong><span>'+escapeHtml(look.ribbonBody||'')+'</span>';
}
function ensurePreview(look,exp){
  var el=document.querySelector('[data-pw-holiday-preview]');
  if(!el){
    el=document.createElement('div');
    el.setAttribute('data-pw-holiday-preview','1');
    document.body.insertBefore(el,document.body.firstChild);
  }
  var left=exp?Math.max(0,exp*1000-Date.now()):0;
  var mm=Math.floor(left/60000),ss=Math.floor((left%60000)/1000);
  var clock=mm+':'+String(ss).padStart(2,'0');
  el.innerHTML='<span>'+escapeHtml((look&&look.preview)||'')+' '+COPY.previewOnly.replace('{left}',clock)+'</span>';
}
function removeBars(){removePreview();var r=document.querySelector('[data-pw-holiday-ribbon]');if(r)r.remove();}
function removePreview(){var p=document.querySelector('[data-pw-holiday-preview]');if(p)p.remove();}
function escapeHtml(s){return String(s||'').replace(/[&<>\"']/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':c==='>'?'&gt;':c==='\"'?'&quot;':'&#39;';});}
function load(){
  fetch(API+qs(),{cache:'no-store',credentials:'same-origin'}).then(function(r){return r.json();}).then(apply).catch(function(){});
}
load();
setInterval(load,60000);
})();</script>`
}
