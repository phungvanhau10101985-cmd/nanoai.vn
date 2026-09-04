import type { WebLocale } from '@/lib/i18n/config'
import { PW_SHOP_LIVE_UI_OFF_FN } from '@/lib/partner-website/shop/pw-shop-live-ui-off'
import {
  BIRTH_GENDER_PROMPT_COPY,
  birthGenderPromptLead,
} from '@/lib/partner-website/shop/partner-site-birth-gender-prompt'
import { partnerSitePersonalizationApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { partnerShopBirthYearOptions } from '@/lib/partner-website/shop/partner-site-profile-demographics'

export function buildPartnerSiteBirthGenderPromptScript(input: {
  siteSlug: string
  locale?: WebLocale
  shopTitle?: string | null
}): string {
  const siteSlug = input.siteSlug.trim()
  if (!siteSlug) return ''
  const locale = input.locale ?? 'vi'
  const copy = BIRTH_GENDER_PROMPT_COPY[locale]
  const years = partnerShopBirthYearOptions()
  const shopTitle = String(input.shopTitle || '').trim()
  const lead = birthGenderPromptLead(locale, shopTitle)
  const profileApi = partnerSitePersonalizationApiPath(siteSlug, 'profile')

  return `<script data-pw-birth-gender-prompt-bootstrap>(function(){
${PW_SHOP_LIVE_UI_OFF_FN};
var SLUG=${JSON.stringify(siteSlug)};
var PROFILE_API=${JSON.stringify(profileApi)};
var COPY=${JSON.stringify({ ...copy, lead })};
var YEARS=${JSON.stringify(years)};
var SHOP_TITLE=${JSON.stringify(shopTitle)};
var FRESH_KEY='pw_fresh_login_after_auth:'+SLUG;
var DISMISS_KEY='pw_birth_gender_prompt_dismissed:'+SLUG;
var SKIP_KEY='pw_shop_skip_auth_sync_'+SLUG;
var SESSION_KEY='app_guest_session_id';
var SESSION_KEY_LEGACY='nanoai_guest_session_id';
var ACCOUNT_KEY='app_guest_account_id';
var ACCOUNT_KEY_LEGACY='nanoai_guest_account_id';
var SESSION_HDR='x-guest-session-id';
var ACCOUNT_HDR='x-guest-account-id';
function readCookie(n){var p=document.cookie.split(';');for(var i=0;i<p.length;i++){var x=p[i].trim().split('=');if(x[0]===n)return decodeURIComponent(x.slice(1).join('=')||'');}return '';}
function sessionId(){try{var ls=localStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY_LEGACY)||'';if(ls)return ls;}catch(e){}return readCookie('app_guest_session_sync');}
function accountId(){try{return localStorage.getItem(ACCOUNT_KEY)||localStorage.getItem(ACCOUNT_KEY_LEGACY)||'';}catch(e){}return '';}
function skipAuth(){try{return sessionStorage.getItem(SKIP_KEY)==='1';}catch(e){return false;}}
function authHeaders(){var h={};var s=sessionId();if(s)h[SESSION_HDR]=s;if(skipAuth())return h;var a=accountId();if(a)h[ACCOUNT_HDR]=a;return h;}
function capture(res){var sid=res.headers.get(SESSION_HDR);if(sid){try{localStorage.setItem(SESSION_KEY,sid);localStorage.setItem(SESSION_KEY_LEGACY,sid);}catch(e){}}var aid=res.headers.get(ACCOUNT_HDR);if(aid&&!skipAuth()){try{localStorage.setItem(ACCOUNT_KEY,aid);localStorage.setItem(ACCOUNT_KEY_LEGACY,aid);}catch(e){}}}
function ssGet(k){try{return sessionStorage.getItem(k);}catch(e){return null;}}
function ssSet(k,v){try{sessionStorage.setItem(k,v);}catch(e){}}
function ssDel(k){try{sessionStorage.removeItem(k);}catch(e){}}
function isLoginPath(){var p=location.pathname||'';return /\\/login\\/?$/i.test(p)||/\\/auth\\//i.test(p);}
function isFresh(){return ssGet(FRESH_KEY)==='1';}
function clearFresh(){ssDel(FRESH_KEY);}
function dismiss(){ssSet(DISMISS_KEY,'1');clearFresh();}
function daysInMonth(y,m){return new Date(y,m,0).getDate();}
function validDate(y,m,d){if(m<1||m>12||d<1)return false;if(d>daysInMonth(y,m))return false;var dt=new Date(y,m-1,d);return dt.getFullYear()===y&&dt.getMonth()===m-1&&dt.getDate()===d;}
function shopName(){if(SHOP_TITLE)return SHOP_TITLE;var w=document.querySelector('.pw-wordmark,[data-pw-el="wordmark"]');var t=w&&String(w.textContent||'').trim();return t||'';}
function leadText(){var shop=shopName();if(shop&&COPY.leadNamed)return String(COPY.leadNamed).replace(/\\{shop\\}/g,shop);return COPY.lead;}
function needs(p){if(!p)return false;var dob=String(p.date_of_birth||'').trim().slice(0,10);var g=p.gender;return !/^\\d{4}-\\d{2}-\\d{2}$/.test(dob)||(g!=='male'&&g!=='female');}
function toast(title,body){var el=document.createElement('div');el.setAttribute('data-pw-birth-gender-toast','1');el.setAttribute('role','status');el.innerHTML='<strong>'+esc(title)+'</strong>'+esc(body);document.body.appendChild(el);setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},4000);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function optionHtml(value,label,selected){return '<option value="'+esc(value)+'"'+(selected?' selected':'')+'>'+esc(label)+'</option>';}
function closePrompt(root){if(root&&root.parentNode)root.parentNode.removeChild(root);document.body.style.overflow='';}
function render(profile){
  var existing=document.getElementById('pw-birth-gender-prompt');
  if(existing)existing.parentNode.removeChild(existing);
  var dob=String(profile&&profile.date_of_birth||'').slice(0,10);
  var parts=dob.split('-');
  var day=parts.length===3?parts[2]:'';
  var month=parts.length===3?parts[1]:'';
  var year=parts.length===3?parts[0]:'';
  var gender=profile&&(profile.gender==='male'||profile.gender==='female')?profile.gender:'';
  var root=document.createElement('div');
  root.id='pw-birth-gender-prompt';
  root.setAttribute('data-pw-birth-gender-prompt','1');
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-labelledby','pw-birth-gender-title');
  root.setAttribute('aria-describedby','pw-birth-gender-lead');
  function maxDays(){return year&&month?daysInMonth(parseInt(year,10),parseInt(month,10)):31;}
  function paint(){
    var md=maxDays();
    if(day&&parseInt(day,10)>md)day=String(md).padStart(2,'0');
    var dayOpts=optionHtml('',COPY.day,!day);
    for(var d=1;d<=md;d++){var dv=String(d).padStart(2,'0');dayOpts+=optionHtml(dv,String(d),day===dv);}
    var monthOpts=optionHtml('',COPY.month,!month);
    for(var m=0;m<12;m++){var mv=String(m+1).padStart(2,'0');monthOpts+=optionHtml(mv,COPY.monthLabels[m],month===mv);}
    var yearOpts=optionHtml('',COPY.year,!year);
    for(var i=0;i<YEARS.length;i++){var yv=String(YEARS[i]);yearOpts+=optionHtml(yv,yv,year===yv);}
    root.innerHTML='<button type="button" data-pw-birth-gender-backdrop aria-label="'+esc(COPY.close)+'"></button>'+
      '<div data-pw-birth-gender-card>'+
      '<h2 data-pw-birth-gender-title id="pw-birth-gender-title">'+esc(COPY.title)+'</h2>'+
      '<p data-pw-birth-gender-lead id="pw-birth-gender-lead">'+esc(leadText())+'</p>'+
      '<form data-pw-birth-gender-form>'+
      '<fieldset><legend data-pw-birth-gender-legend>'+esc(COPY.dobLegend)+'</legend>'+
      '<div data-pw-birth-gender-dob>'+
      '<label class="sr-only" for="pw-bg-day">'+esc(COPY.day)+'</label><select id="pw-bg-day" data-pw-bg-day>'+dayOpts+'</select>'+
      '<label class="sr-only" for="pw-bg-month">'+esc(COPY.month)+'</label><select id="pw-bg-month" data-pw-bg-month>'+monthOpts+'</select>'+
      '<label class="sr-only" for="pw-bg-year">'+esc(COPY.year)+'</label><select id="pw-bg-year" data-pw-bg-year>'+yearOpts+'</select>'+
      '</div></fieldset>'+
      '<div><span data-pw-birth-gender-label>'+esc(COPY.gender)+'</span><div data-pw-birth-gender-genders>'+
      '<button type="button" data-pw-birth-gender-gender="male" aria-pressed="'+(gender==='male'?'true':'false')+'">'+esc(COPY.male)+'</button>'+
      '<button type="button" data-pw-birth-gender-gender="female" aria-pressed="'+(gender==='female'?'true':'false')+'">'+esc(COPY.female)+'</button>'+
      '</div></div>'+
      '<p data-pw-birth-gender-error hidden></p>'+
      '<div data-pw-birth-gender-actions>'+
      '<button type="button" data-pw-birth-gender-defer>'+esc(COPY.defer)+'</button>'+
      '<button type="submit" data-pw-birth-gender-save>'+esc(COPY.save)+'</button>'+
      '</div></form></div>';
    bind();
    var first=root.querySelector('[data-pw-bg-day]');
    if(first)setTimeout(function(){try{first.focus();}catch(e){}},80);
  }
  function showErr(msg){var el=root.querySelector('[data-pw-birth-gender-error]');if(!el)return;el.hidden=!msg;el.textContent=msg||'';}
  function bind(){
    var dayEl=root.querySelector('[data-pw-bg-day]');
    var monthEl=root.querySelector('[data-pw-bg-month]');
    var yearEl=root.querySelector('[data-pw-bg-year]');
    var form=root.querySelector('[data-pw-birth-gender-form]');
    var backdrop=root.querySelector('[data-pw-birth-gender-backdrop]');
    var deferBtn=root.querySelector('[data-pw-birth-gender-defer]');
    function onDefer(){dismiss();closePrompt(root);}
    if(backdrop)backdrop.addEventListener('click',onDefer);
    if(deferBtn)deferBtn.addEventListener('click',onDefer);
    if(dayEl)dayEl.addEventListener('change',function(){day=dayEl.value;});
    if(monthEl)monthEl.addEventListener('change',function(){month=monthEl.value;paint();});
    if(yearEl)yearEl.addEventListener('change',function(){year=yearEl.value;paint();});
    root.querySelectorAll('[data-pw-birth-gender-gender]').forEach(function(btn){
      btn.addEventListener('click',function(){gender=btn.getAttribute('data-pw-birth-gender-gender')||'';paint();});
    });
    if(form)form.addEventListener('submit',function(e){
      e.preventDefault();
      showErr('');
      if(!year||!month||!day){showErr(COPY.needDob);return;}
      var y=parseInt(year,10),m=parseInt(month,10),d=parseInt(day,10);
      if(!validDate(y,m,d)){showErr(COPY.invalidDob);return;}
      var iso=year+'-'+month+'-'+day;
      var dt=new Date(y,m-1,d);var end=new Date();end.setHours(23,59,59,999);
      if(dt>end){showErr(COPY.futureDob);return;}
      if(gender!=='male'&&gender!=='female'){showErr(COPY.needGender);return;}
      var saveBtn=root.querySelector('[data-pw-birth-gender-save]');
      if(saveBtn)saveBtn.disabled=true;
      fetch(PROFILE_API,{method:'PATCH',credentials:'same-origin',headers:Object.assign({'Content-Type':'application/json'},authHeaders()),body:JSON.stringify({date_of_birth:iso,gender:gender})})
        .then(function(r){capture(r);return r.json().then(function(j){return {ok:r.ok,j:j};});})
        .then(function(res){
          if(!res.ok||!res.j||res.j.ok===false){showErr((res.j&&res.j.error)||COPY.saveFailed);if(saveBtn)saveBtn.disabled=false;return;}
          clearFresh();
          closePrompt(root);
          toast(COPY.savedTitle,COPY.savedBody);
        })
        .catch(function(){showErr(COPY.saveFailed);if(saveBtn)saveBtn.disabled=false;});
    });
  }
  document.body.style.overflow='hidden';
  document.body.appendChild(root);
  paint();
  function onKey(e){if(e.key==='Escape'){dismiss();closePrompt(root);window.removeEventListener('keydown',onKey);}}
  window.addEventListener('keydown',onKey);
}
function tryOpen(){
  if(pwShopLiveUiOff())return;
  if(isLoginPath())return;
  if(skipAuth())return;
  if(!accountId())return;
  if(!isFresh())return;
  if(ssGet(DISMISS_KEY)==='1'){clearFresh();return;}
  fetch(PROFILE_API,{credentials:'same-origin',headers:authHeaders()})
    .then(function(r){capture(r);return r.json();})
    .then(function(j){
      var p=j&&j.profile?j.profile:null;
      if(!p||!p.email){clearFresh();return;}
      if(!needs(p)){clearFresh();return;}
      render(p);
    })
    .catch(function(){});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tryOpen);
else tryOpen();
})();</script>`
}
