/**
 * Saved product-page HTML cannot match the live shop (theme CSS does not
 * apply inside the preview). Do not store or paint a copy. This module only
 * deletes leftovers from earlier builds so a phone does not open the unstyled page.
 */

const SNAP_ID = 'pw-viewed-pdp-snap'
const STORAGE_PREFIX = 'pw-viewed-pdp-'
const SESSION_KEYS = ['pw-viewed-pdp-handoff-v1', 'pw-viewed-pdp-scroll-v1']

export type ViewedProductStorage = {
  length?: number
  key?(index: number): string | null
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function storageKeys(storage: ViewedProductStorage): string[] {
  const keys: string[] = []
  if (typeof storage.key === 'function' && typeof storage.length === 'number') {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key) keys.push(key)
    }
    return keys
  }
  return []
}

/** Drop every saved product HTML preview on this browser. */
export function discardViewedProductSnapshots(storage?: ViewedProductStorage | null): void {
  const box =
    storage ??
    (typeof localStorage === 'undefined'
      ? null
      : (localStorage as ViewedProductStorage))
  if (!box) return
  const drop = storageKeys(box).filter((key) => key.startsWith(STORAGE_PREFIX))
  for (const key of drop) box.removeItem(key)
  try {
    if (typeof sessionStorage === 'undefined') return
    for (const key of SESSION_KEYS) sessionStorage.removeItem(key)
  } catch {
    /* private mode */
  }
  if (typeof document !== 'undefined') document.getElementById(SNAP_ID)?.remove()
}

/**
 * Parser-blocking cleanup. Replaces the old script that painted a saved page
 * before the live product arrived.
 */
export function buildViewedProductSnapshotBootScript(): string {
  return `(()=>{try{
    var frame=document.getElementById(${JSON.stringify(SNAP_ID)});
    if(frame) frame.remove();
    var drop=[];
    for(var i=0;i<localStorage.length;i++){
      var key=localStorage.key(i)||'';
      if(key.indexOf(${JSON.stringify(STORAGE_PREFIX)})===0) drop.push(key);
    }
    for(var j=0;j<drop.length;j++) localStorage.removeItem(drop[j]);
    try{
      sessionStorage.removeItem('pw-viewed-pdp-handoff-v1');
      sessionStorage.removeItem('pw-viewed-pdp-scroll-v1');
    }catch(e){}
  }catch(err){}})();`
}
