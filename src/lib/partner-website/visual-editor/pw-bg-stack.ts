/**
 * Stack lớp nền toàn trang — dùng chung mọi giao diện shop/landing.
 * Lớp 0 = nền trắng (canvas). Mỗi nền một lớp. Thêm nền / đưa lên / đưa xuống đi từng lớp.
 * Không dùng data-pw-bg-layer (đó là hit-layer ảnh banner).
 */

export const PW_BG_INDEX_ATTR = 'data-pw-bg-index'
export const PW_BG_ROLE_ATTR = 'data-pw-bg-role'
/** Nền khối gốc đã bỏ màu — giữ khối (logo/nút), không xóa DOM. */
export const PW_BG_CLEARED_ATTR = 'data-pw-bg-cleared'
export const PW_BG_CLEARED_CSS = [
  `html [${PW_BG_CLEARED_ATTR}="1"]{background-color:transparent!important;background-image:none!important;box-shadow:none!important}`,
  `html [${PW_BG_CLEARED_ATTR}="1"].pw-header,html [${PW_BG_CLEARED_ATTR}="1"].pw-shop-header,html [${PW_BG_CLEARED_ATTR}="1"].pw-topbar,html [${PW_BG_CLEARED_ATTR}="1"].pw-shop-topbar,html [${PW_BG_CLEARED_ATTR}="1"].pw-footer,html [${PW_BG_CLEARED_ATTR}="1"].pw-shop-footer,html [${PW_BG_CLEARED_ATTR}="1"][data-pw-region="header"],html [${PW_BG_CLEARED_ATTR}="1"][data-pw-region="topbar"],html [${PW_BG_CLEARED_ATTR}="1"][data-pw-region="footer"],html [${PW_BG_CLEARED_ATTR}="1"][data-pw-region="nav"]{background:transparent!important;background-image:none!important;background-color:transparent!important;box-shadow:none!important}`,
].join('')

/** Ảnh nền cover — mọi khối nền (main / header / footer / Thêm nền). Sửa nhanh ghi; live đọc. */
export const PW_PAPER_ATTR = 'data-pw-paper'
export const PW_PAPER_SRC_ATTR = 'data-pw-paper-src'
/** Ảnh nhỏ hơn nền đáy → lặp (tile) cho trải đủ. */
export const PW_PAPER_TILE_ATTR = 'data-pw-paper-tile'
/** Trọng tâm ảnh nền 0–100. Live đọc CSS var; không khóa center. */
export const PW_PAPER_POS_X_ATTR = 'data-pw-paper-pos-x'
export const PW_PAPER_POS_Y_ATTR = 'data-pw-paper-pos-y'
/** Ảnh banner / nền vừa có trước khi chọn màu — để hiện lại, không mất src. */
export const PW_LAST_MEDIA_SRC_ATTR = 'data-pw-last-media-src'
export const PW_MEDIA_HIDDEN_ATTR = 'data-pw-media-hidden'
export const PW_PAPER_CSS = [
  `html [${PW_PAPER_ATTR}="image"]:not([${PW_PAPER_TILE_ATTR}="1"]){--pw-paper-pos-x:50%;--pw-paper-pos-y:50%;background-size:cover!important;background-position:var(--pw-paper-pos-x,50%) var(--pw-paper-pos-y,50%)!important;background-repeat:no-repeat!important}`,
  `html [${PW_PAPER_ATTR}="image"][${PW_PAPER_TILE_ATTR}="1"]{background-size:auto!important;background-repeat:repeat!important;background-position:var(--pw-paper-pos-x,0%) var(--pw-paper-pos-y,0%)!important}`,
  `html [${PW_PAPER_ATTR}="white"]{background-image:none!important}`,
  `html [${PW_MEDIA_HIDDEN_ATTR}="1"]{opacity:0!important;visibility:hidden!important;pointer-events:none!important}`,
].join('')

/** Ảnh gốc nhỏ hơn khung (rộng hoặc cao) → nhân bản trải nền đáy. */
export function paperImageNeedsTile(naturalW: number, naturalH: number, hostW: number, hostH: number): boolean {
  if (!(naturalW > 0 && naturalH > 0 && hostW > 8 && hostH > 8)) return false
  return naturalW < hostW - 1 || naturalH < hostH - 1
}

/** Live + Sửa nhanh: footer / nền dưới cùng — ảnh nhỏ thì tile. */
export const PW_PAPER_TILE_RUNTIME_SOURCE = `(function(){
  var TILE=${JSON.stringify(PW_PAPER_TILE_ATTR)};
  var PAPER=${JSON.stringify(PW_PAPER_ATTR)};
  var SRC=${JSON.stringify(PW_PAPER_SRC_ATTR)};
  function cls(el){return ' '+String(el&&el.className||'')+' ';}
  function isFooter(el){
    if(!el||el.nodeType!==1)return false;
    if(el.getAttribute&&el.getAttribute('data-pw-region')==='footer')return true;
    var tag=el.tagName?el.tagName.toLowerCase():'';
    if(tag==='footer')return true;
    return cls(el).indexOf(' pw-footer ')>=0||cls(el).indexOf(' pw-shop-footer ')>=0;
  }
  function isAddedBg(el){return !!(el&&el.getAttribute&&el.getAttribute('data-pw-added-bg')==='1');}
  function paperSrc(el){
    if(!el)return '';
    var stamped=el.getAttribute?String(el.getAttribute(SRC)||'').trim():'';
    if(stamped)return stamped;
    var bg='';
    try{bg=(el.style&&el.style.backgroundImage)||'';}catch(eBg){bg='';}
    var m=String(bg).match(/url\\((['"]?)([^'")]+)\\1\\)/i);
    return m?String(m[2]||'').trim():'';
  }
  function bottomAddedBg(){
    var nodes=document.querySelectorAll('[data-pw-added-bg="1"]');
    var best=null,bestB=-Infinity;
    for(var i=0;i<nodes.length;i++){
      if(nodes[i].getAttribute&&nodes[i].getAttribute('data-pw-hidden')==='1')continue;
      var r=nodes[i].getBoundingClientRect();
      if(r.bottom>=bestB){bestB=r.bottom;best=nodes[i];}
    }
    return best;
  }
  function wantsTile(el){
    if(isFooter(el))return true;
    return isAddedBg(el)&&el===bottomAddedBg();
  }
  function needsTile(nw,nh,hw,hh){
    if(!(nw>0&&nh>0&&hw>8&&hh>8))return false;
    return nw<hw-1||nh<hh-1;
  }
  function applyFace(el,tile){
    if(!el)return;
    if(tile){
      el.setAttribute(TILE,'1');
      if(el.getAttribute&&el.getAttribute(PAPER)!=='image')el.setAttribute(PAPER,'image');
      if(el.style){el.style.backgroundSize='auto';el.style.backgroundRepeat='repeat';}
    }else{
      if(el.getAttribute&&el.getAttribute(TILE)==='1')el.removeAttribute(TILE);
      if(el.style&&el.getAttribute&&el.getAttribute(PAPER)==='image'){
        el.style.backgroundSize='cover';
        el.style.backgroundRepeat='no-repeat';
      }
    }
  }
  function measure(el,url){
    if(!el||!url||!wantsTile(el))return;
    var img=new Image();
    img.onload=function(){
      var r=el.getBoundingClientRect();
      applyFace(el,needsTile(img.naturalWidth,img.naturalHeight,r.width,r.height));
    };
    img.src=url;
  }
  function hydrate(){
    var hosts=document.querySelectorAll('footer,.pw-footer,.pw-shop-footer,[data-pw-region="footer"],[data-pw-added-bg="1"]');
    for(var i=0;i<hosts.length;i++){
      var el=hosts[i];
      if(!wantsTile(el))continue;
      var url=paperSrc(el);
      if(url)measure(el,url);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hydrate);
  else hydrate();
})();`

export function buildPartnerSitePaperTileBootstrapScript(): string {
  return `<script data-pw-paper-tile-bootstrap="1">${PW_PAPER_TILE_RUNTIME_SOURCE}</script>`
}

export const PW_BG_CANVAS_INDEX = 0
export const PW_BG_HEADER_Z = 200

/** Lớp đặc biệt — không phải region. */
export const PW_BG_SPECIAL_ROLES = ['canvas', 'added'] as const

/** Region được phép có nền — `data-pw-bg-role` cùng tên `data-pw-region`. */
export const PW_BG_REGION_ROLES = [
  'header',
  'banner',
  'categories',
  'catalog',
  'promo',
  'footer',
  'content',
  'form',
  'gallery',
  'pdp-info',
  'reviews',
  'cart-list',
  'cart-summary',
  'account-nav',
  'account-main',
] as const

export const PW_BG_BUILTIN_ORDER = [
  'canvas',
  ...PW_BG_REGION_ROLES,
] as const

export const PW_BG_ROLES = [...PW_BG_BUILTIN_ORDER, 'added'] as const

export type PwBgStackRole = (typeof PW_BG_ROLES)[number]
export type PwBgRegionRole = (typeof PW_BG_REGION_ROLES)[number]

export const PW_BG_LOCKED_ROLES: readonly PwBgStackRole[] = ['canvas', 'header']

/** Region nội dung phải có z để “Thêm nền” ở lớp dưới không đè chữ/ảnh. */
export const PW_BG_PAINT_Z_ROLES: readonly PwBgStackRole[] = [
  'canvas',
  'header',
  'banner',
  'categories',
  'catalog',
  'promo',
  'footer',
  'content',
  'form',
  'gallery',
  'pdp-info',
  'reviews',
  'cart-list',
  'cart-summary',
  'account-nav',
  'account-main',
  'added',
]

export type PwBgStackItem = {
  index: number
  role: PwBgStackRole
  locked: boolean
  current?: boolean
}

export function isPwBgStackRole(raw: string | null | undefined): raw is PwBgStackRole {
  return PW_BG_ROLES.includes(String(raw || '') as PwBgStackRole)
}

export function isPwBgRegionRole(raw: string | null | undefined): raw is PwBgRegionRole {
  return (PW_BG_REGION_ROLES as readonly string[]).includes(String(raw || ''))
}

export function isPwBgPaintZRole(raw: string | null | undefined): boolean {
  return (PW_BG_PAINT_Z_ROLES as readonly string[]).includes(String(raw || ''))
}

export function pwBgRoleOrder(role: string): number {
  if (role === 'added') return 50
  const i = (PW_BG_BUILTIN_ORDER as readonly string[]).indexOf(role)
  return i < 0 ? 99 : i
}

export function isPwBgLockedRole(role: string): boolean {
  return (PW_BG_LOCKED_ROLES as readonly string[]).includes(role)
}

/** z-index vẽ: canvas 0, header chrome 200, các lớp còn lại = index. */
export function pwBgPaintZ(role: string, index: number): number {
  if (role === 'canvas') return PW_BG_CANVAS_INDEX
  if (role === 'header') return PW_BG_HEADER_Z
  return Math.max(0, Math.round(index))
}

export function parsePwBgStack(raw: unknown): PwBgStackItem[] {
  if (!Array.isArray(raw)) return []
  const out: PwBgStackItem[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const rec = row as { index?: unknown; role?: unknown; locked?: unknown; current?: unknown }
    const role = String(rec.role || '')
    if (!isPwBgStackRole(role)) continue
    const index = Number(rec.index)
    if (!Number.isFinite(index) || index < 0) continue
    out.push({
      index,
      role,
      locked: rec.locked === true || isPwBgLockedRole(role),
      current: rec.current === true,
    })
  }
  return out.sort((a, b) => a.index - b.index)
}
