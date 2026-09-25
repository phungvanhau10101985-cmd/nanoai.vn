/**
 * Product-grid page size — one engine for every shop / device.
 * Visible rows × stamped columns = first paint and each «Xem thêm».
 */

export const PW_GRID_ROWS_MIN = 1
export const PW_GRID_ROWS_MAX = 4
/** Lưới đã xem + lưới đề xuất — cùng 1–8 hàng trên mọi máy. */
export const PW_GRID_ROWS_MAX_PERSONAL = 8
export const PW_GRID_ROWS_DEFAULT = 1
export const PW_GRID_COLS_DESKTOP = 5
export const PW_GRID_COLS_LAPTOP = 4
export const PW_GRID_COLS_TABLET = 3
export const PW_GRID_COLS_MOBILE = 2
/** Backward-compatible aliases for persisted visual HTML. */
export const PW_GRID_COLS_WIDE = PW_GRID_COLS_DESKTOP
export const PW_GRID_COLS_NARROW = 2
export const PW_GRID_PAGE_MAX = 48
/** Category listing opened from outfit «Xem tất cả» — one batch, not a single row and not the 48-card search page. */
export const PW_LISTING_BATCH_SIZE = 20

export type PartnerProductGridDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export function isNarrowProductGridDevice(device?: string | null): boolean {
  const d = String(device || '').trim().toLowerCase()
  return d === 'mobile' || d === 'tablet'
}

export function productGridColsForDevice(device?: string | null): number {
  const d = String(device || '').trim().toLowerCase()
  if (d === 'mobile') return PW_GRID_COLS_MOBILE
  if (d === 'tablet') return PW_GRID_COLS_TABLET
  if (d === 'laptop') return PW_GRID_COLS_LAPTOP
  return PW_GRID_COLS_DESKTOP
}

export function productGridRowsMax(kind?: string | null): number {
  const k = String(kind || '').trim().toLowerCase()
  if (k === 'recently-viewed' || k === 'recommended') return PW_GRID_ROWS_MAX_PERSONAL
  return PW_GRID_ROWS_MAX
}

export function clampProductGridRows(value: unknown, kind?: string | null): number {
  const n = Math.floor(Number(value))
  const max = productGridRowsMax(kind)
  if (!Number.isFinite(n)) return PW_GRID_ROWS_DEFAULT
  return Math.max(PW_GRID_ROWS_MIN, Math.min(max, n))
}

export function clampProductGridCols(value: unknown, fallback = PW_GRID_COLS_WIDE): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.max(1, Math.min(8, n))
}

export function productGridPageSize(rows: number, cols: number, kind?: string | null): number {
  return Math.max(1, Math.min(PW_GRID_PAGE_MAX, clampProductGridRows(rows, kind) * clampProductGridCols(cols)))
}

export function inferProductGridRows(input: {
  rows?: unknown
  limit?: unknown
  cols: number
  kind?: string | null
}): number {
  const raw = Math.floor(Number(input.rows))
  if (Number.isFinite(raw) && raw >= PW_GRID_ROWS_MIN) return clampProductGridRows(raw, input.kind)
  const limit = Math.floor(Number(input.limit))
  const cols = clampProductGridCols(input.cols)
  if (Number.isFinite(limit) && limit >= 1) {
    return clampProductGridRows(Math.ceil(limit / cols), input.kind)
  }
  return PW_GRID_ROWS_DEFAULT
}

function escapeGridHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** In-flow «Xem thêm» + «Xem tất cả các nhóm» — same row under catalog / related / viewed. Recommended (188) is load-more only. */
export function productGridActionsHtml(input: {
  loadMoreLabel: string
  seeAllLabel: string
  seeAllHref?: string | null
  hostClass?: string
  moreClass?: string
  moreAttrs?: string
  allClass?: string
  hideSeeAll?: boolean
}): string {
  const href = String(input.seeAllHref || '#').trim() || '#'
  const hostClass = input.hostClass || 'pw-grid-actions'
  const moreClass = input.moreClass || 'pw-grid-more'
  const allClass = input.allClass || 'pw-grid-all'
  const moreAttrs = input.moreAttrs || 'data-pw-grid-more'
  const seeAll = input.hideSeeAll
    ? ''
    : `
    <a href="${escapeGridHtml(href)}" class="${allClass}" data-pw-el="section-more">${escapeGridHtml(input.seeAllLabel)}</a>`
  return `<div class="${hostClass}" data-pw-grid-actions>
    <button type="button" class="${moreClass}" ${moreAttrs}>
      <span class="pw-grid-more-icon" aria-hidden="true">↻</span>
      ${escapeGridHtml(input.loadMoreLabel)}
    </button>${seeAll}
  </div>`
}

/** Shared helpers injected into catalog / personalize / outfit bootstraps. */
export const PW_PRODUCT_GRID_PAGE_JS = `
function pwGridDevice(){
  var html=document.documentElement;
  var d=(html.getAttribute('data-pw-edit-device')||html.getAttribute('data-pw-scene-lock')||'').toLowerCase();
  if(d==='mobile'||d==='tablet'||d==='laptop'||d==='desktop')return d;
  var w=window.innerWidth||document.documentElement.clientWidth||0;
  if(w>=1440)return 'desktop';
  if(w>=1280)return 'laptop';
  if(w>=768)return 'tablet';
  return 'mobile';
}
function pwGridCols(el){
  var desktop=parseInt(el.getAttribute('data-pw-grid-cols')||'5',10)||5;
  var laptop=parseInt(el.getAttribute('data-pw-grid-cols-laptop')||'4',10)||4;
  var tablet=parseInt(el.getAttribute('data-pw-grid-cols-tablet')||'3',10)||3;
  var mobile=parseInt(el.getAttribute('data-pw-grid-cols-mobile')||'2',10)||2;
  var device=pwGridDevice();
  if(device==='mobile')return mobile;
  if(device==='tablet')return tablet;
  if(device==='laptop')return laptop;
  return desktop;
}
function pwGridRowsMax(el){
  var kind=((el.getAttribute('data-pw-grid-kind')||'')+' '+(el.getAttribute('data-pw-personalize')||'')).toLowerCase();
  if(kind.indexOf('recently-viewed')>=0||kind.indexOf('recommended')>=0)return 8;
  return 4;
}
function pwGridRows(el){
  var max=pwGridRowsMax(el);
  var raw=parseInt(el.getAttribute('data-pw-grid-rows')||'',10);
  if(raw>=1&&raw<=max)return raw;
  var cols=pwGridCols(el);
  var lim=parseInt(el.getAttribute('data-limit')||'',10);
  if(lim>=1)return Math.max(1,Math.min(max,Math.ceil(lim/Math.max(1,cols))));
  return 1;
}
function pwGridPageSize(el){
  var cols=pwGridCols(el);
  var max=pwGridRowsMax(el);
  var raw=parseInt(el.getAttribute('data-pw-grid-rows')||'',10);
  if(raw>=1&&raw<=max)return Math.max(1,Math.min(48,raw*cols));
  var lim=parseInt(el.getAttribute('data-limit')||'',10);
  if(lim>=1)return Math.max(1,Math.min(48,lim));
  return Math.max(1,Math.min(48,1*cols));
}
`.trim()
