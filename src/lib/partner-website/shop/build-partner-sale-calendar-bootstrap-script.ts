import type { WebLocale } from '@/lib/i18n/config'

const COPY: Record<WebLocale, { teaser: string; active: string; days: string }> = {
  vi: { teaser: 'Sắp tới sale cùng ngày cùng tháng', active: 'Sale cùng ngày cùng tháng đang diễn ra', days: 'ngày nữa' },
  en: { teaser: 'Same-day same-month sale is coming', active: 'Same-day same-month sale is live', days: 'days left' },
  zh: { teaser: '同日同月促销即将开始', active: '同日同月促销进行中', days: '天后' },
  ja: { teaser: '同日同月セールまもなく開催', active: '同日同月セール開催中', days: '日後' },
  ko: { teaser: '같은 날짜·월 세일이 곧 시작됩니다', active: '같은 날짜·월 세일 진행 중', days: '일 후' },
}

export function buildPartnerSaleCalendarBootstrapScript(input: {
  siteSlug: string
  locale: WebLocale
}): string {
  const slug = input.siteSlug.trim()
  if (!slug) return ''
  const api = `/api/site/${encodeURIComponent(slug)}/sale-calendar`
  const copy = COPY[input.locale] ?? COPY.en
  return `<script data-pw-sale-calendar-bootstrap>(function(){
if(typeof pwShopLiveUiOff==='function'&&pwShopLiveUiOff())return;
var API=${JSON.stringify(api)},COPY=${JSON.stringify(copy)};
function paint(data){
  var s=data&&data.state;if(!s||s.phase==='off')return;
  var root=document.querySelector('main,[data-pw-scene-root="1"]');if(!root)return;
  var el=document.querySelector('[data-pw-sale-calendar-banner]');
  if(!el){el=document.createElement('aside');el.setAttribute('data-pw-sale-calendar-banner','1');el.style.cssText='position:relative;z-index:2;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:9px 14px;background:var(--pw-primary);color:#fff;font:700 13px/1.35 system-ui,sans-serif;text-align:center';root.insertBefore(el,root.firstChild);}
  var lead=s.phase==='active'?COPY.active:COPY.teaser;
  var suffix=s.phase==='active'?' · -'+s.discountPercent+'%':' · '+s.daysUntilSale+' '+COPY.days+' · -'+s.discountPercent+'%';
  el.textContent=lead+suffix;
}
fetch(API,{credentials:'same-origin'}).then(function(r){return r.ok?r.json():null;}).then(paint).catch(function(){});
})();</script>`
}
