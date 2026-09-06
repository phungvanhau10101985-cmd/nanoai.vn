/**
 * Product-grid page size — one engine for every shop / device.
 * Visible rows × stamped columns = first paint and each «Xem thêm».
 */

export const PW_GRID_ROWS_MIN = 1
export const PW_GRID_ROWS_MAX = 4
export const PW_GRID_ROWS_DEFAULT = 1
export const PW_GRID_COLS_WIDE = 5
export const PW_GRID_COLS_NARROW = 2
export const PW_GRID_PAGE_MAX = 48

export type PartnerProductGridDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export function isNarrowProductGridDevice(device?: string | null): boolean {
  const d = String(device || '').trim().toLowerCase()
  return d === 'mobile' || d === 'tablet'
}

export function productGridColsForDevice(device?: string | null): number {
  return isNarrowProductGridDevice(device) ? PW_GRID_COLS_NARROW : PW_GRID_COLS_WIDE
}

export function clampProductGridRows(value: unknown): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n)) return PW_GRID_ROWS_DEFAULT
  return Math.max(PW_GRID_ROWS_MIN, Math.min(PW_GRID_ROWS_MAX, n))
}

export function clampProductGridCols(value: unknown, fallback = PW_GRID_COLS_WIDE): number {
  const n = Math.floor(Number(value))
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.max(1, Math.min(8, n))
}

export function productGridPageSize(rows: number, cols: number): number {
  return Math.max(1, Math.min(PW_GRID_PAGE_MAX, clampProductGridRows(rows) * clampProductGridCols(cols)))
}

export function inferProductGridRows(input: {
  rows?: unknown
  limit?: unknown
  cols: number
}): number {
  const raw = Math.floor(Number(input.rows))
  if (Number.isFinite(raw) && raw >= PW_GRID_ROWS_MIN) return clampProductGridRows(raw)
  const limit = Math.floor(Number(input.limit))
  const cols = clampProductGridCols(input.cols)
  if (Number.isFinite(limit) && limit >= 1) {
    return clampProductGridRows(Math.ceil(limit / cols))
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
  if(d==='mobile'||d==='tablet')return 'narrow';
  if(d==='desktop'||d==='laptop')return 'wide';
  return window.innerWidth>=1280?'wide':'narrow';
}
function pwGridCols(el){
  var wide=parseInt(el.getAttribute('data-pw-grid-cols')||'5',10)||5;
  var narrow=parseInt(el.getAttribute('data-pw-grid-cols-mobile')||'2',10)||2;
  return pwGridDevice()==='narrow'?narrow:wide;
}
function pwGridRows(el){
  var raw=parseInt(el.getAttribute('data-pw-grid-rows')||'',10);
  if(raw>=1&&raw<=4)return raw;
  var cols=pwGridCols(el);
  var lim=parseInt(el.getAttribute('data-limit')||'',10);
  if(lim>=1)return Math.max(1,Math.min(4,Math.ceil(lim/Math.max(1,cols))));
  return 1;
}
function pwGridPageSize(el){
  var cols=pwGridCols(el);
  var raw=parseInt(el.getAttribute('data-pw-grid-rows')||'',10);
  if(raw>=1&&raw<=4)return Math.max(1,Math.min(48,raw*cols));
  var lim=parseInt(el.getAttribute('data-limit')||'',10);
  if(lim>=1)return Math.max(1,Math.min(48,lim));
  return Math.max(1,Math.min(48,1*cols));
}
`.trim()
