import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import { PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT } from '@/lib/partner-website/shop/partner-site-birth-gender-prompt-session'
import {
  PWA_INSTALL_PROMPT_COPY,
  PW_PWA_INSTALL_PROMPT_CSS,
  pwaInstallPromptLead,
} from '@/lib/partner-website/shop/partner-site-pwa-install-prompt'

export function buildPartnerSitePwaInstallPromptScript(input: {
  siteSlug: string
  locale?: WebLocale
  shopTitle?: string | null
}): string {
  const siteSlug = input.siteSlug.trim()
  if (!siteSlug) return ''
  const locale = input.locale ?? 'vi'
  const copy = PWA_INSTALL_PROMPT_COPY[locale]
  const shopTitle = String(input.shopTitle || '').trim()
  const lead = pwaInstallPromptLead(locale, shopTitle)

  return `<script data-pw-pwa-install-prompt-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var SLUG=${JSON.stringify(siteSlug)};
var COPY=${JSON.stringify({ ...copy, lead })};
var PROMPT_CSS=${JSON.stringify(PW_PWA_INSTALL_PROMPT_CSS)};
var SHOP_TITLE=${JSON.stringify(shopTitle)};
var SETTLED=${JSON.stringify(PW_BIRTH_GENDER_PROMPT_SETTLED_EVENT)};
var FRESH_KEY='pw_fresh_login_after_auth:'+SLUG;
var PENDING_KEY='pw_pwa_install_prompt_pending:'+SLUG;
var DISMISS_KEY='pw_pwa_install_prompt_dismissed:'+SLUG;
var SEEN_KEY='pw_pwa_install_prompt_seen:'+SLUG;
var INSTALLED_KEY='pw_pwa_installed:'+SLUG;
var SKIP_KEY='pw_shop_skip_auth_sync_'+SLUG;
var ACCOUNT_KEY='app_guest_account_id';
var ACCOUNT_KEY_LEGACY='nanoai_guest_account_id';
var deferred=window.__nanoaiShopPwaPrompt||null;
function ssGet(k){try{return sessionStorage.getItem(k);}catch(e){return null;}}
function ssSet(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}
function ssDel(k){try{sessionStorage.removeItem(k);}catch(e){}}
function remembered(){try{return localStorage.getItem(INSTALLED_KEY)==='1';}catch(e){return false;}}
function seen(){try{return localStorage.getItem(SEEN_KEY)==='1';}catch(e){return false;}}
function markSeen(){try{localStorage.setItem(SEEN_KEY,'1');}catch(e){}}
function markInstalled(){try{localStorage.setItem(INSTALLED_KEY,'1');}catch(e){}markSeen();ssDel(PENDING_KEY);}
function clearInstalled(){try{localStorage.removeItem(INSTALLED_KEY);}catch(e){}}
function accountId(){try{return localStorage.getItem(ACCOUNT_KEY)||localStorage.getItem(ACCOUNT_KEY_LEGACY)||'';}catch(e){return '';}}
function skipAuth(){try{return sessionStorage.getItem(SKIP_KEY)==='1';}catch(e){return false;}}
function isLoginPath(){var p=location.pathname||'';return /\\/login\\/?$/i.test(p)||/\\/auth\\//i.test(p);}
function isStandalone(){try{if(window.navigator.standalone===true)return true;if(window.matchMedia('(display-mode: standalone)').matches)return true;if(document.referrer&&String(document.referrer).indexOf('android-app')>=0)return true;}catch(e){}return false;}
function isIos(){return /iPad|iPhone|iPod/.test(navigator.userAgent)&&!window.MSStream;}
function isPhone(){
  var ua=String(navigator.userAgent||'');
  if(/ipad|tablet|kindle|silk/i.test(ua))return false;
  if(/iphone|ipod/i.test(ua))return true;
  if(/android/i.test(ua))return /mobile/i.test(ua);
  if(/mobile/i.test(ua))return true;
  if((navigator.maxTouchPoints||0)>1&&/macintosh/i.test(ua))return false;
  var scr=window.screen||{};
  var screenW=Math.max(Number(scr.width)||0,Number(scr.availWidth)||0);
  var w=window.outerWidth||screenW||window.innerWidth||0;
  return w>0&&w<768;
}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function shopName(){if(SHOP_TITLE)return SHOP_TITLE;var w=document.querySelector('.pw-wordmark,[data-pw-el="wordmark"]');var t=w&&String(w.textContent||'').trim();return t||'';}
function leadText(){var shop=shopName();if(shop&&COPY.leadNamed)return String(COPY.leadNamed).replace(/\\{shop\\}/g,shop);return COPY.lead;}
function blocker(){return document.querySelector('[data-pw-birth-gender-prompt],[data-pw-cart-added-popup]');}
function claim(){if(window.__pwPwaInstallPromptClaimed)return false;if(document.getElementById('pw-pwa-install-prompt'))return false;window.__pwPwaInstallPromptClaimed=true;return true;}
function canOpen(){
  if(!isPhone())return false;
  if(pwShopLiveUiOff())return false;
  if(isLoginPath())return false;
  if(skipAuth())return false;
  if(!accountId())return false;
  if(isStandalone()){markInstalled();return false;}
  if(ssGet(DISMISS_KEY)==='1'){ssDel(PENDING_KEY);return false;}
  if(ssGet(PENDING_KEY)!=='1'&&seen())return false;
  if(remembered()&&!deferred)return false;
  return true;
}
function closePrompt(root){if(root&&root.parentNode)root.parentNode.removeChild(root);document.body.style.overflow='';}
function ensureCss(){
  if(document.getElementById('pw-pwa-install-css'))return;
  var st=document.createElement('style');
  st.id='pw-pwa-install-css';
  st.textContent=PROMPT_CSS;
  (document.head||document.documentElement).appendChild(st);
}
function render(){
  if(!claim())return;
  ensureCss();
  markSeen();
  ssDel(PENDING_KEY);
  var root=document.createElement('div');
  root.id='pw-pwa-install-prompt';
  root.setAttribute('data-pw-pwa-install-prompt','1');
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','pw-pwa-install-title');
  var nativeBtn=!isIos()&&!!deferred;
  var tip=isIos()?COPY.iosTip:(nativeBtn?'':COPY.manualTip);
  root.innerHTML='<button type="button" data-pw-pwa-install-backdrop aria-label="'+esc(COPY.close)+'"></button>'+
    '<div data-pw-pwa-install-card>'+
    '<h2 data-pw-pwa-install-title id="pw-pwa-install-title">'+esc(COPY.title)+'</h2>'+
    '<p data-pw-pwa-install-lead id="pw-pwa-install-lead">'+esc(leadText())+'</p>'+
    '<p data-pw-pwa-install-tip'+(tip?'':' hidden')+'>'+esc(tip)+'</p>'+
    '<p data-pw-pwa-install-error hidden></p>'+
    '<div data-pw-pwa-install-actions>'+
    '<button type="button" data-pw-pwa-install-later>'+esc(COPY.later)+'</button>'+
    '<button type="button" data-pw-pwa-install-go'+(nativeBtn?'':' hidden')+'>'+esc(COPY.install)+'</button>'+
    '</div></div>';
  function showErr(msg){var el=root.querySelector('[data-pw-pwa-install-error]');if(!el)return;el.hidden=!msg;el.textContent=msg||'';}
  function onLater(){ssSet(DISMISS_KEY,'1');ssDel(PENDING_KEY);closePrompt(root);}
  var backdrop=root.querySelector('[data-pw-pwa-install-backdrop]');
  var later=root.querySelector('[data-pw-pwa-install-later]');
  var go=root.querySelector('[data-pw-pwa-install-go]');
  if(backdrop)backdrop.addEventListener('click',onLater);
  if(later)later.addEventListener('click',onLater);
  if(go)go.addEventListener('click',function(){
    if(!deferred){showErr(COPY.manualTip);return;}
    var ev=deferred;deferred=null;try{delete window.__nanoaiShopPwaPrompt;}catch(e){}
    var choice=ev.userChoice;
    Promise.resolve(ev.prompt()).catch(function(){});
    Promise.resolve(choice).then(function(c){
      if(c&&c.outcome==='accepted'){markInstalled();closePrompt(root);return;}
      onLater();
    }).catch(function(){showErr(COPY.failed);});
  });
  document.body.style.overflow='hidden';
  document.body.appendChild(root);
  var focusEl=nativeBtn?go:later;
  if(focusEl)setTimeout(function(){try{focusEl.focus();}catch(e){}},80);
  function onKey(e){if(e.key==='Escape'){onLater();window.removeEventListener('keydown',onKey);}}
  window.addEventListener('keydown',onKey);
}
function whenQuiet(fn){
  if(!blocker()){fn();return;}
  var obs=new MutationObserver(function(){if(!blocker()){obs.disconnect();fn();}});
  obs.observe(document.body,{childList:true,subtree:true});
}
function openPrompt(fromBirth){
  if(!canOpen())return;
  if(!fromBirth&&ssGet(FRESH_KEY)==='1')return;
  whenQuiet(function(){
    setTimeout(function(){
      if(!canOpen())return;
      if(blocker()){whenQuiet(function(){openPrompt(true);});return;}
      render();
    },400);
  });
}
var armTries=0;
function arm(){
  if(pwShopLiveUiOff())return;
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',arm);return;}
  if(!accountId()&&armTries<20){armTries++;setTimeout(arm,200);return;}
  if(ssGet(FRESH_KEY)==='1'){
    var released=false;
    function go(){if(released)return;released=true;openPrompt(true);}
    window.addEventListener(SETTLED,function onS(){window.removeEventListener(SETTLED,onS);go();});
    setTimeout(function(){if(!blocker())go();},1600);
    return;
  }
  openPrompt(false);
}
if(deferred)clearInstalled();
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  deferred=e;
  window.__nanoaiShopPwaPrompt=e;
  clearInstalled();
  var go=document.querySelector('[data-pw-pwa-install-go]');
  var tip=document.querySelector('[data-pw-pwa-install-tip]');
  if(go&&!isIos()){go.hidden=false;if(tip)tip.hidden=true;}
  if(!document.getElementById('pw-pwa-install-prompt'))openPrompt(ssGet(FRESH_KEY)!=='1');
});
window.addEventListener('appinstalled',function(){
  markInstalled();
  var root=document.getElementById('pw-pwa-install-prompt');
  if(root)closePrompt(root);
});
arm();
})();</script>`
}
