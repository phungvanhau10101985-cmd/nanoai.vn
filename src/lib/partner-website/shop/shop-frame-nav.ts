/**
 * Shop HTML inside the admin device preview must not assign `window.top`.
 * The preview iframe's top is `/dashboard/...`, so that replace reloads the admin tab.
 */
export function shopFrameTopIsAdminPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || '').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  return path === '/dashboard' || path.startsWith('/dashboard/')
}

export const PW_SHOP_FRAME_NAV_JS = `function pwTopIsAdmin(){
  try{
    if(!window.top||window.top===window)return false;
    var p=String(window.top.location.pathname||'').split('?')[0].split('#')[0].replace(/\\/+$/,'')||'/';
    return p==='/dashboard'||p.indexOf('/dashboard/')===0;
  }catch(e){return false;}
}
function pwShopNavWindow(){
  if(pwTopIsAdmin())return window;
  try{if(window.top&&window.top!==window)return window.top;}catch(e){}
  return window;
}`
