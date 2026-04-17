/** Snippet Meta chuẩn — dùng chung tracker trang tư vấn + sự kiện Mua ngay. */
export const META_FB_EVENTS_BOOTSTRAP = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');`

export function ensureMetaPixelBootstrapDom(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('script[data-meta-pixel-bootstrap="1"]')) return
  const boot = document.createElement('script')
  boot.setAttribute('data-meta-pixel-bootstrap', '1')
  boot.textContent = META_FB_EVENTS_BOOTSTRAP
  document.head.appendChild(boot)
}
