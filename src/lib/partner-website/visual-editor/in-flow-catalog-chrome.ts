/** Designed stack blocks stay in-flow. Live must not hoist them onto the scene root. */

export const IN_FLOW_CATALOG_CHROME_ROLES = ['section-title', 'section-more'] as const

/** Mảng khối xếp dọc theo thiết kế — không scene-absolute. */
export const IN_FLOW_STACK_REGIONS = ['banner', 'categories', 'catalog', 'promo'] as const

const AUTHORED_OVERLAY_ATTRS = [
  'data-pw-added-text',
  'data-pw-added-btn',
  'data-pw-added-image',
  'data-pw-added-video',
] as const

const IN_FLOW_SLOT_ATTRS = [
  'data-pw-added-bg-slot',
  'data-pw-added-text-slot',
  'data-pw-added-btn-slot',
  'data-pw-added-image-slot',
  'data-pw-added-video-slot',
  'data-pw-added-chrome-slot',
] as const

function readAttr(source: string | Element, name: string): string {
  if (typeof source === 'string') {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return source.match(new RegExp(`\\b${safe}=(["'])([^"']*)\\1`, 'i'))?.[2] || ''
  }
  return source.getAttribute?.(name) || ''
}

function hasAttr(source: string | Element, name: string): boolean {
  if (typeof source === 'string') {
    const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${safe}(?:=|\\s|>|$)`, 'i').test(source)
  }
  return source.hasAttribute?.(name) === true
}

function classNameOf(source: string | Element): string {
  if (typeof source === 'string') {
    return source.match(/\bclass=(["'])([^"']*)\1/i)?.[2] || ''
  }
  return typeof source.className === 'string' ? source.className : ''
}

function isInFlowSlot(source: string | Element): boolean {
  if (IN_FLOW_SLOT_ATTRS.some((name) => readAttr(source, name) === '1')) return true
  if (readAttr(source, 'data-pw-added-catalog') === '1') return true
  if (readAttr(source, 'data-pw-added-banner') === '1') return true
  return hasAttr(source, 'data-pw-hrow')
}

function isOverlayAddedBg(source: string | Element): boolean {
  return readAttr(source, 'data-pw-added-bg') === '1' && readAttr(source, 'data-pw-added-bg-slot') !== '1'
}

function isAuthoredOverlay(source: string | Element): boolean {
  if (readAttr(source, 'data-pw-chrome-added') === '1' && readAttr(source, 'data-pw-chrome-btn')) {
    return readAttr(source, 'data-pw-chrome-kit') !== '1'
  }
  if (isOverlayAddedBg(source)) return true
  return AUTHORED_OVERLAY_ATTRS.some((name) => readAttr(source, name) === '1')
}

function isStackRegion(region: string): boolean {
  return (IN_FLOW_STACK_REGIONS as readonly string[]).includes(region)
}

export function isInFlowCatalogChromeRole(role: string | null | undefined): boolean {
  return role === 'section-title' || role === 'section-more'
}

export function isInFlowStackBlockAttrs(attrs: string): boolean {
  if (!attrs || isAuthoredOverlay(attrs)) return false
  if (isInFlowSlot(attrs)) return true
  if (isStackRegion(readAttr(attrs, 'data-pw-region'))) return true
  if (isInFlowCatalogChromeRole(readAttr(attrs, 'data-pw-el'))) return true
  if (/\bdata-pw-(?:catalog|grid)=/i.test(attrs)) return true
  if (
    /(?:^|[\s"'])(?:pw-hero|pw-banner|pw-shop-hero|pw-shop-banner|pw-categories|pw-section-title|pw-section-more)(?:[\s"']|$)/i.test(
      attrs
    )
  ) {
    return true
  }
  return false
}

export function isInFlowCatalogChromeAttrs(attrs: string): boolean {
  return isInFlowStackBlockAttrs(attrs)
}

export function isInFlowStackBlockElement(el: Element | null | undefined): boolean {
  if (!el || el.nodeType !== 1) return false
  if (isAuthoredOverlay(el)) return false
  if (isInFlowSlot(el)) return true
  if (isStackRegion(el.getAttribute?.('data-pw-region') || '')) return true
  if (isInFlowCatalogChromeRole(el.getAttribute('data-pw-el'))) return true
  if (el.hasAttribute('data-pw-catalog') || el.hasAttribute('data-pw-grid')) return true
  const cls = classNameOf(el)
  if (/(?:^|\s)(?:pw-hero|pw-banner|pw-shop-hero|pw-shop-banner|pw-categories|pw-section-title|pw-section-more)(?:\s|$)/.test(cls)) {
    return true
  }
  return !!(el.closest?.('[data-pw-region="catalog"],[data-pw-catalog]'))
}

export function isInFlowCatalogChromeElement(el: Element | null | undefined): boolean {
  return isInFlowStackBlockElement(el)
}

export function isInFlowStackHostElement(el: Element | null | undefined): boolean {
  if (!el || el.nodeType !== 1 || isAuthoredOverlay(el)) return false
  if (isInFlowSlot(el)) return true
  if (isStackRegion(el.getAttribute?.('data-pw-region') || '')) return true
  const cls = classNameOf(el)
  return /(?:^|\s)(?:pw-hero|pw-banner|pw-shop-hero|pw-shop-banner|pw-categories)(?:\s|$)/.test(cls)
}

export function releaseInFlowStackBlock(el: Element | null | undefined): void {
  if (!el || !isInFlowStackBlockElement(el)) return
  el.removeAttribute('data-pw-placement')
  el.removeAttribute('data-pw-user-move')
  el.removeAttribute('data-pw-coordinate-root')
  el.removeAttribute('data-pw-z')
  for (const name of [
    'data-pw-box-x',
    'data-pw-box-y',
    'data-pw-box-w',
    'data-pw-box-h',
    'data-pw-fixed-x',
    'data-pw-fixed-y',
    'data-pw-fixed-w',
    'data-pw-fixed-h',
    'data-pw-canvas-x',
    'data-pw-canvas-y',
    'data-pw-canvas-w',
    'data-pw-canvas-h',
  ]) {
    el.removeAttribute(name)
  }
  const style = (el as HTMLElement).style
  if (!style) return
  style.removeProperty('position')
  style.removeProperty('left')
  style.removeProperty('top')
  style.removeProperty('right')
  style.removeProperty('bottom')
  style.removeProperty('transform')
  style.removeProperty('z-index')
}

/** Chỉ bỏ absolute — giữ thứ tự DOM. Không gom lưới SP lên cạnh banner. */
export function reflowInFlowStackHosts(root: Element | null | undefined): void {
  if (!root?.querySelectorAll) return
  const nodes = root.querySelectorAll(
    '[data-pw-region="banner"],[data-pw-region="categories"],[data-pw-region="catalog"],[data-pw-region="promo"],[data-pw-added-banner],[data-pw-added-catalog],[data-pw-added-bg-slot],[data-pw-hrow],.pw-hero,.pw-banner,.pw-shop-hero,.pw-shop-banner,.pw-categories'
  )
  for (const node of Array.from(nodes)) releaseInFlowStackBlock(node)
}
