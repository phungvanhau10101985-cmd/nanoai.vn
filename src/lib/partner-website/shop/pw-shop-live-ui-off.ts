/**
 * Inlined into live shop IIFEs. Sửa nhanh adds `nanoai-ve-active` so clicks
 * stay display-only; Xem thử / `/site/{slug}` never get that class.
 */
export const PW_SHOP_LIVE_UI_OFF_FN =
  "function pwShopLiveUiOff(){try{return !!(document.body&&document.body.classList.contains('nanoai-ve-active'));}catch(e){return false}}"
