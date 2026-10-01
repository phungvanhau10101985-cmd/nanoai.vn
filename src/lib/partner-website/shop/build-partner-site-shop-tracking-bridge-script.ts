export const PW_SHOP_TRACK_BRIDGE_ATTR = 'data-pw-shop-track-bridge'

/** Shared by catalog / PDP / shop-actions native bootstraps. */
export const PW_SHOP_NATIVE_TRACK_JS = [
  'function pwShopTrack(kind,payload){try{if(typeof window.__pwShopTrackEvent==="function")window.__pwShopTrackEvent(kind,payload||{});}catch(e){}}',
  'function pwShopTrackProduct(p){p=p||{};var sale=Number(p.salePriceAmount!=null?p.salePriceAmount:p.sale_price_amount);var list=Number(p.priceAmount!=null?p.priceAmount:p.price_amount);var hint=Math.max(0,Math.round(Number(String(p.priceHint||p.price_hint||"").replace(/[^\\d]/g,""))||0));var value=(sale>0&&(!list||sale<list))?sale:(list>0?list:hint);var out={itemId:String(p.id||p.inventory_id||""),itemName:String(p.name||""),value:Math.max(0,Math.round(value||0)),quantity:Math.max(1,Math.floor(Number(p.quantity)||1)),sku:String(p.sku||""),remarketingId:String(p.remarketingId||p.remarketing_id||"")};var cat=String(p.category||p.categoryL3||"").trim();if(cat)out.category=cat;return out;}',
  'function pwShopTrackProducts(list){return (Array.isArray(list)?list:[]).map(pwShopTrackProduct);}',
].join('')

/** Native HTML bootstraps enqueue until React tracking engine is ready. */
export function buildPartnerSiteShopTrackingBridgeScript(): string {
  return (
    `<script ${PW_SHOP_TRACK_BRIDGE_ATTR}="1">` +
    `(function(){var w=window;w.__pwShopTrackQueue=w.__pwShopTrackQueue||[];` +
    `w.__pwShopTrackEvent=function(kind,payload){try{` +
    `if(typeof w.__pwShopTrack==='function'){w.__pwShopTrack(kind,payload||{});return;}` +
    `w.__pwShopTrackQueue.push({kind:kind,payload:payload||{}});` +
    `}catch(e){}};})();` +
    `</script>`
  )
}
