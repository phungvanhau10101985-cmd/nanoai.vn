export const CHROME_COUNT_BADGE_KINDS = [
  'cart',
  'notifications',
  'recently-viewed',
  'wishlist',
] as const

export type ChromeCountBadgeKind = (typeof CHROME_COUNT_BADGE_KINDS)[number]

export const DEMO_CHROME_COUNT_BADGES: Record<ChromeCountBadgeKind, number> = {
  cart: 2,
  notifications: 3,
  'recently-viewed': 4,
  wishlist: 1,
}

const KIND_SET = new Set<string>(CHROME_COUNT_BADGE_KINDS)

export function chromeCountBadgeKindFromHref(href: string): ChromeCountBadgeKind | null {
  const raw = href.trim()
  if (!raw || raw.startsWith('javascript:')) return null
  let path = raw.split('?')[0]?.split('#')[0] || ''
  try {
    if (/^https?:\/\//i.test(path) || path.startsWith('//')) {
      path = new URL(path, 'https://example.invalid').pathname
    }
  } catch {
    /* keep path */
  }
  const lower = path.toLowerCase()
  if (/\/cart\/?$/.test(lower) || /\/account\/cart\/?$/.test(lower)) return 'cart'
  if (/recently-viewed\/?$/.test(lower)) return 'recently-viewed'
  if (/notifications\/?$/.test(lower)) return 'notifications'
  if (/\/wishlist\/?$/.test(lower) || /\/favorites\/?$/.test(lower) || /\/account\/wishlist\/?$/.test(lower)) {
    return 'wishlist'
  }
  return null
}

export function chromeCountBadgeKindFromAttr(kind: string, href?: string): ChromeCountBadgeKind | null {
  const raw = kind.trim().toLowerCase()
  const mapped = raw === 'favorites-link' ? 'wishlist' : raw
  if (KIND_SET.has(mapped)) return mapped as ChromeCountBadgeKind
  return href ? chromeCountBadgeKindFromHref(href) : null
}

export function chromeCountBadgeKindFromLabel(label: string): ChromeCountBadgeKind | null {
  const raw = label.trim().toLowerCase()
  if (!raw) return null
  if (/thông báo|thong bao|notification/.test(raw)) return 'notifications'
  if (/giỏ hàng|gio hang|shopping bag|\bcart\b/.test(raw)) return 'cart'
  if (/vừa xem|vua xem|đã xem|da xem|recently viewed|viewed/.test(raw)) return 'recently-viewed'
  if (/yêu thích|yeu thich|wishlist|favorite/.test(raw)) return 'wishlist'
  return null
}

export function formatChromeCountBadge(n: number): string {
  const count = Math.max(0, Math.round(Number(n) || 0))
  if (!count) return ''
  return count > 99 ? '99+' : String(count)
}

export const PW_CHROME_COUNT_ATTR = 'data-pw-chrome-count'

export type ChromeCountBadgeDevice = 'desktop' | 'laptop' | 'mobile' | 'tablet'
export type ChromeCountBadgeHost = 'actions' | 'nav' | 'mid' | 'topbar'

export function chromeCountBadgeKindFromHtmlSnippet(html: string): ChromeCountBadgeKind | null {
  const btn = html.match(/data-pw-chrome-btn=["']([^"']+)["']/i)?.[1] || ''
  const href = html.match(/\bhref=["']([^"']*)["']/i)?.[1] || ''
  const fromAttr = chromeCountBadgeKindFromAttr(btn, href)
  if (fromAttr) return fromAttr
  const aria =
    html.match(/\baria-label=["']([^"']*)["']/i)?.[1] || html.match(/\btitle=["']([^"']*)["']/i)?.[1] || ''
  return chromeCountBadgeKindFromLabel(aria)
}

export function htmlHasChromeCountBadgeKind(html: string, kind: ChromeCountBadgeKind): boolean {
  if (kind === 'wishlist') {
    return (
      /data-pw-chrome-btn=["'](wishlist|favorites-link)["']/i.test(html) ||
      /href=["'][^"']*(?:\/wishlist|\/favorites)(?:\/?|\?|#|")/i.test(html)
    )
  }
  const token = kind === 'recently-viewed' ? 'recently-viewed' : kind
  return (
    new RegExp(`data-pw-chrome-btn=["']${token}["']`, 'i').test(html) ||
    new RegExp(`href=["'][^"']*${token}(?:\/?|\\?|#|")`, 'i').test(html)
  )
}

function stripPositionStyleAttr(attrs: string): string {
  return attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (_m, q: string, css: string) => {
    const cleaned = css
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^(transform|left|top|right|bottom|position)\s*:/i.test(part))
      .join('; ')
    return cleaned ? ` style=${q}${cleaned}${q}` : ''
  })
}

function rewriteCountBadgeAttrs(
  attrs: string,
  variant: ChromeCountBadgeDevice,
  opts?: { stripPosition?: boolean }
): string {
  // Keep user-dragged transform/left/top on save and Xem web. Only strip when
  // copying a widget onto another device so desktop coordinates do not leak.
  let next = opts?.stripPosition ? stripPositionStyleAttr(attrs) : attrs
  if (/\bdata-pw-device=/.test(next)) {
    next = next.replace(/\sdata-pw-device=(["'])[^"']*\1/gi, ` data-pw-device="${variant}"`)
  } else {
    next += ` data-pw-device="${variant}"`
  }
  if (!/\bdata-pw-chrome-count=/.test(next)) next += ` ${PW_CHROME_COUNT_ATTR}="1"`
  return next
}

/** Keep cart / notifications / viewed / wishlist visible on every device HTML. */
export function restampChromeCountBadgeWidgets(
  html: string,
  variant: ChromeCountBadgeDevice,
  opts?: { stripPosition?: boolean }
): string {
  return html.replace(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag: string, attrs: string, inner: string) => {
    if (!chromeCountBadgeKindFromHtmlSnippet(full)) return full
    return `<${tag}${rewriteCountBadgeAttrs(attrs, variant, opts)}>${inner}</${tag}>`
  })
}

function inferCountBadgeHost(html: string, index: number, attrs: string): ChromeCountBadgeHost {
  const place = (attrs.match(/data-pw-chrome-place=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
  if (place === 'nav') return 'nav'
  if (place === 'mid') return 'mid'
  if (place === 'header') return 'actions'
  const style = (attrs.match(/data-pw-chrome-style=["']([^"']+)["']/i)?.[1] || '').toLowerCase()
  if (style === 'text') return 'topbar'
  const before = html.slice(Math.max(0, index - 900), index).toLowerCase()
  if (before.includes('pw-bottom-nav') || before.includes('pw-shop-bottom-nav')) return 'nav'
  if (before.includes('pw-topbar')) return 'topbar'
  if (before.includes('pw-nav-main') || before.includes('pw-shop-nav-row')) return 'mid'
  return 'actions'
}

type ExtractedCountWidget = { kind: ChromeCountBadgeKind; html: string; host: ChromeCountBadgeHost }

export function extractChromeCountBadgeWidgets(html: string): ExtractedCountWidget[] {
  const found: ExtractedCountWidget[] = []
  const seen = new Set<ChromeCountBadgeKind>()
  const re = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const kind = chromeCountBadgeKindFromHtmlSnippet(match[0])
    if (!kind || seen.has(kind)) continue
    seen.add(kind)
    found.push({ kind, html: match[0], host: inferCountBadgeHost(html, match.index, match[2] || '') })
  }
  return found
}

const HOST_OPEN: Record<ChromeCountBadgeHost, RegExp> = {
  actions:
    /<(div)\b([^>]*class=["'][^"']*\b(?:pw-header-actions|pw-shop-header-actions)\b[^"']*["'][^>]*)>/i,
  nav: /<(nav)\b([^>]*class=["'][^"']*\b(?:pw-bottom-nav|pw-shop-bottom-nav)\b[^"']*["'][^>]*)>/i,
  mid: /<(nav)\b([^>]*class=["'][^"']*\b(?:pw-nav-main|pw-shop-nav-row)\b[^"']*["'][^>]*)>/i,
  topbar:
    /<(div)\b([^>]*class=["'][^"']*\b(?:pw-topbar-inner|pw-shop-topbar-inner|pw-topbar)\b[^"']*["'][^>]*)>/i,
}

function findMatchingCloseTag(html: string, from: number, tag: string): number {
  const re = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, 'gi')
  re.lastIndex = from
  let depth = 1
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    if (match[0].slice(0, 2) === '</') {
      depth -= 1
      if (depth === 0) return match.index
      continue
    }
    if (!/\/>$/.test(match[0].trim())) depth += 1
  }
  return -1
}

function insertWidgetIntoHost(
  html: string,
  host: ChromeCountBadgeHost,
  widget: string
): string | null {
  const open = html.match(HOST_OPEN[host])
  if (!open || open.index == null) return null
  const tag = open[1]
  const close = findMatchingCloseTag(html, open.index + open[0].length, tag)
  if (close < 0) return null
  return `${html.slice(0, close)}${widget}${html.slice(close)}`
}

/** Copy missing count-badge chrome (cart / notifications / viewed / wishlist) onto another device HTML. */
export function copyMissingChromeCountBadgeWidgets(
  sourceHtml: string,
  targetHtml: string,
  variant: ChromeCountBadgeDevice
): string {
  if (!sourceHtml.trim() || !targetHtml.trim()) return targetHtml
  let next = restampChromeCountBadgeWidgets(targetHtml, variant)
  const widgets = extractChromeCountBadgeWidgets(sourceHtml)
  for (const widget of widgets) {
    if (htmlHasChromeCountBadgeKind(next, widget.kind)) continue
    const prepared = restampChromeCountBadgeWidgets(widget.html, variant, { stripPosition: true })
    const hosts: ChromeCountBadgeHost[] = [widget.host, 'actions', 'nav', 'mid', 'topbar']
    const tried = new Set<ChromeCountBadgeHost>()
    for (const host of hosts) {
      if (tried.has(host)) continue
      tried.add(host)
      const attempt = insertWidgetIntoHost(next, host, prepared)
      if (attempt) {
        next = attempt
        break
      }
    }
  }
  return next
}

const BADGE_SEL = '[data-pw-chrome-badge], .pw-cart-badge, .pw-shop-cart-badge'

/** Strip live/demo numbers before saving Sửa nhanh HTML. Live shop hydrates from APIs. */
export function resetChromeCountBadges(root: ParentNode): number {
  let n = 0
  root.querySelectorAll(BADGE_SEL).forEach((badge) => {
    badge.setAttribute('hidden', '')
    badge.textContent = '0'
    badge.removeAttribute('data-pw-badge-demo')
    n += 1
  })
  return n
}

/**
 * Client helpers shared by visual HTML bootstrap and Sửa nhanh.
 * No template `${` — inlined into other JS strings.
 */
export const PW_CHROME_COUNT_BADGE_RUNTIME_JS = `
function pwChromeCountKind(el){
  if(!el||!el.getAttribute)return '';
  var k=String(el.getAttribute('data-pw-chrome-btn')||'').replace(/[^a-z0-9-]/g,'');
  if(k==='favorites-link')k='wishlist';
  if(k==='cart'||k==='notifications'||k==='recently-viewed'||k==='wishlist')return k;
  var href=String(el.getAttribute('href')||'');
  try{href=new URL(href,location.href).pathname||href;}catch(errHref){}
  href=String(href).split('?')[0].split('#')[0].toLowerCase();
  if(/\\/cart\\/?$/.test(href)||/\\/account\\/cart\\/?$/.test(href))return 'cart';
  if(/recently-viewed\\/?$/.test(href))return 'recently-viewed';
  if(/notifications\\/?$/.test(href))return 'notifications';
  if(/\\/wishlist\\/?$/.test(href)||/\\/favorites\\/?$/.test(href)||/\\/account\\/wishlist\\/?$/.test(href))return 'wishlist';
  var aria=String(el.getAttribute('aria-label')||el.getAttribute('title')||'').toLowerCase();
  if(/thông báo|thong bao|notification/.test(aria))return 'notifications';
  if(/giỏ hàng|gio hang|shopping bag/.test(aria)||aria==='cart')return 'cart';
  if(/vừa xem|vua xem|đã xem|da xem|recently viewed|viewed/.test(aria))return 'recently-viewed';
  if(/yêu thích|yeu thich|wishlist|favorite/.test(aria))return 'wishlist';
  if(el.querySelector&&(el.querySelector('.lucide-bell')||el.querySelector('[class*="lucide-bell"]')))return 'notifications';
  return '';
}
function pwChromeCountHosts(root){
  var scope=root&&root.querySelectorAll?root:document;
  return scope.querySelectorAll('[data-pw-chrome-btn],.pw-shop-header-actions a,.pw-header-actions a,.pw-shop-icon-btn,.pw-icon-btn,.pw-shop-bottom-nav a,.pw-bottom-nav a');
}
function pwStampChromeCountKinds(root){
  var nodes=pwChromeCountHosts(root);
  for(var i=0;i<nodes.length;i++){
    var el=nodes[i];
    var kind=pwChromeCountKind(el);
    if(!kind)continue;
    if(!el.getAttribute('data-pw-chrome-btn'))el.setAttribute('data-pw-chrome-btn',kind);
    if(!el.getAttribute('data-pw-chrome-count'))el.setAttribute('data-pw-chrome-count','1');
  }
}
function pwEnsureChromeCountBadge(el){
  var b=el.querySelector('[data-pw-chrome-badge],.pw-cart-badge,.pw-shop-cart-badge');
  if(b)return b;
  var doc=el.ownerDocument||document;
  var wrap=el.querySelector(':scope > .pw-chrome-icon-wrap');
  if(!wrap){
    var svg=el.querySelector(':scope > svg')||el.querySelector('svg');
    if(!svg)return null;
    wrap=svg.closest?svg.closest('.pw-chrome-icon-wrap'):null;
    if(!(wrap&&el.contains(wrap))){
      wrap=doc.createElement('span');
      wrap.className='pw-chrome-icon-wrap';
      if(svg.parentNode)svg.parentNode.insertBefore(wrap,svg);
      wrap.appendChild(svg);
    }
  }
  b=doc.createElement('span');
  b.className='pw-cart-badge pw-shop-cart-badge';
  b.setAttribute('data-pw-chrome-badge','');
  b.setAttribute('hidden','');
  b.textContent='0';
  wrap.appendChild(b);
  return b;
}
function pwSetChromeCountBadge(el,n,demo){
  if(el&&el.getAttribute&&el.getAttribute('data-pw-chrome-count')==='0'){
    var hidden=el.querySelector?el.querySelector('[data-pw-chrome-badge],.pw-cart-badge,.pw-shop-cart-badge'):null;
    if(hidden){hidden.setAttribute('hidden','');hidden.textContent='0';hidden.removeAttribute('data-pw-badge-demo');}
    return;
  }
  var b=pwEnsureChromeCountBadge(el);
  if(!b)return;
  var count=Math.max(0,Math.round(Number(n)||0));
  if(!count){b.setAttribute('hidden','');b.textContent='0';b.removeAttribute('data-pw-badge-demo');return;}
  b.removeAttribute('hidden');
  b.textContent=count>99?'99+':String(count);
  if(demo)b.setAttribute('data-pw-badge-demo','1');
  else b.removeAttribute('data-pw-badge-demo');
}
function pwApplyDemoChromeCountBadges(root){
  pwStampChromeCountKinds(root);
  var demo={cart:2,notifications:3,'recently-viewed':4,wishlist:1};
  var nodes=pwChromeCountHosts(root);
  for(var i=0;i<nodes.length;i++){
    var kind=pwChromeCountKind(nodes[i]);
    if(kind&&demo[kind])pwSetChromeCountBadge(nodes[i],demo[kind],true);
  }
}
function pwSetChromeCountBadgeByKind(kind,n){
  var nodes=pwChromeCountHosts(document);
  for(var i=0;i<nodes.length;i++){
    if(pwChromeCountKind(nodes[i])===kind)pwSetChromeCountBadge(nodes[i],n,false);
  }
}
function pwIsAdminChromePreview(){
  try{
    if(document.body&&document.body.classList.contains('nanoai-ve-active'))return true;
    if(document.documentElement&&document.documentElement.getAttribute('data-pw-edit-device'))return true;
  }catch(errPrev){}
  return false;
}
`.trim()

export const PW_CHROME_COUNT_BADGE_HIDE_CSS =
  '[data-pw-chrome-count="0"] .pw-cart-badge,[data-pw-chrome-count="0"] .pw-shop-cart-badge,' +
  '[data-pw-chrome-count="0"] [data-pw-chrome-badge]{display:none!important}' +
  '.pw-cart-badge[hidden],.pw-shop-cart-badge[hidden],[data-pw-chrome-badge][hidden]{display:none!important}' +
  '.pw-cart-badge:not([hidden]),.pw-shop-cart-badge:not([hidden]){display:flex!important;align-items:center;justify-content:center;font-size:10px!important;line-height:1!important;font-weight:700!important;color:#fff!important;-webkit-text-fill-color:#fff!important;background:var(--pw-primary)!important}' +
  '@media (max-width:899px){.pw-header .pw-cart-badge:not([hidden]),.pw-shop-header .pw-cart-badge:not([hidden]),.pw-header .pw-shop-cart-badge:not([hidden]),.pw-shop-header .pw-shop-cart-badge:not([hidden]),.pw-header-actions .pw-cart-badge:not([hidden]),.pw-shop-header-actions .pw-cart-badge:not([hidden]),.pw-header-actions .pw-shop-cart-badge:not([hidden]),.pw-shop-header-actions .pw-shop-cart-badge:not([hidden]){background:#fff!important;color:var(--pw-primary,#111)!important;-webkit-text-fill-color:var(--pw-primary,#111)!important;box-shadow:0 0 0 1px rgba(255,255,255,.45)!important}}'
