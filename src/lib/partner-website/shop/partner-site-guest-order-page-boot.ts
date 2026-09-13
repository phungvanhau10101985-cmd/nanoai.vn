import {
  MESSAGING_GUEST_ACCOUNT_HEADER,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY,
  MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import {
  MESSAGING_GUEST_SESSION_HEADER,
  MESSAGING_GUEST_SESSION_STORAGE_KEY,
  MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
} from '@/lib/messaging/guest-auth-session'

export const PW_GUEST_ORDER_PAGE_BOOT_KEY = '__pwGuestOrderPage'
export const PW_GUEST_ORDER_PAGE_READY_EVENT = 'pw-guest-order-page-ready'

export type PartnerSiteGuestOrderPageBoot = {
  order?: Record<string, unknown> | null
  payment_display?: unknown
  default_deposit_percent?: number
  google_customer_reviews_merchant_id?: number | null
  shipment_events?: unknown[]
  sibling_orders?: unknown[]
  can_confirm_received?: boolean
}

/** Inline script: fetch order before React hydrates (Ctrl/click must not be required). */
export function buildPartnerSiteGuestOrderBootScript(partnerSlug: string, orderId: string): string {
  const url = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(orderId)}`
  return `(function(){
  var KEY=${JSON.stringify(PW_GUEST_ORDER_PAGE_BOOT_KEY)};
  var EVT=${JSON.stringify(PW_GUEST_ORDER_PAGE_READY_EVENT)};
  if(window[KEY]&&window[KEY].order)return;
  function cookie(n){
    try{
      var parts=document.cookie.split(';');
      for(var i=0;i<parts.length;i++){
        var p=parts[i].trim();
        var eq=p.indexOf('=');
        if(eq>0&&p.slice(0,eq)===n)return decodeURIComponent(p.slice(eq+1));
      }
    }catch(e){}
    return '';
  }
  var sid='',aid='';
  try{
    sid=String(localStorage.getItem(${JSON.stringify(MESSAGING_GUEST_SESSION_STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(MESSAGING_GUEST_SESSION_STORAGE_KEY_LEGACY)})||'').trim();
    aid=String(localStorage.getItem(${JSON.stringify(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY)})||localStorage.getItem(${JSON.stringify(MESSAGING_GUEST_ACCOUNT_STORAGE_KEY_LEGACY)})||'').trim();
  }catch(e){}
  if(!sid)sid=cookie(${JSON.stringify(MESSAGING_GUEST_SESSION_SYNC_COOKIE)});
  if(!aid)aid=cookie(${JSON.stringify(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE)});
  var headers={'accept':'application/json'};
  if(sid)headers[${JSON.stringify(MESSAGING_GUEST_SESSION_HEADER)}]=sid;
  if(aid)headers[${JSON.stringify(MESSAGING_GUEST_ACCOUNT_HEADER)}]=aid;
  fetch(${JSON.stringify(url)},{credentials:'same-origin',headers:headers})
    .then(function(r){return r.json();})
    .then(function(j){
      if(!j||!j.order)return;
      window[KEY]=j;
      window.dispatchEvent(new Event(EVT));
    }).catch(function(){});
})();`
}

export function readPartnerSiteGuestOrderPageBoot(): PartnerSiteGuestOrderPageBoot | null {
  if (typeof window === 'undefined') return null
  const boot = (window as Window & { [PW_GUEST_ORDER_PAGE_BOOT_KEY]?: PartnerSiteGuestOrderPageBoot })[
    PW_GUEST_ORDER_PAGE_BOOT_KEY
  ]
  if (!boot || typeof boot !== 'object' || !boot.order) return null
  return boot
}
