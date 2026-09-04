import { isInFlowCatalogChromeAttrs } from './in-flow-catalog-chrome'
import {
  PW_COORDINATE_CONTRACT_VERSION,
  PW_COORDINATE_VERSION_ATTR,
  PW_PLACEMENT_ATTR,
  pwCoordinateDevice,
  pwLeftOriginToCenterX,
  pwLooksLikeNormalized01,
  pwParseCoordinateVersion,
  pwSceneBoxLeftCss,
  pwSceneBoxTopPx,
  pwSceneWidth,
  pwTopLeftToElementCenter,
  type PwCoordinateDevice,
  type PwPlacementMode,
} from './pw-coordinate-space'

type NormalizeCoordinateOptions = {
  variant?: PwCoordinateDevice
  /** Save path: retain semantic flags, but stop writing legacy geometry. */
  writeCanonicalOnly?: boolean
  /** HTML coordinate version before this pass. Missing/1/2 = left-origin; 3 = top-left of the element. */
  sourceVersion?: string
}

const FLOW_SLOT_RE =
  /\bdata-pw-added-(?:bg|text|btn|image|video|chrome)-slot=["']1["']/i
const AUTHORED_RE =
  /\bdata-pw-(?:added-bg|added-text|added-btn|added-image|added-video|chrome-added|user-move|clone-all)=["']1["']/i
const FIXED_RE =
  /\bdata-pw-(?:stay-scroll|pin-screen|chrome-float)=["']1["']/i

function readAttr(attrs: string, name: string): string {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return attrs.match(new RegExp(`\\b${safe}=(["'])([^"']*)\\1`, 'i'))?.[2] || ''
}

function removeAttr(attrs: string, name: string): string {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return attrs.replace(new RegExp(`\\s${safe}=(["'])[^"']*\\1`, 'gi'), '')
}

function setAttr(attrs: string, name: string, value: string): string {
  return `${removeAttr(attrs, name)} ${name}="${String(value).replace(/"/g, '&quot;')}"`
}

function readStyle(attrs: string): { quote: string; css: string } {
  const match = attrs.match(/\bstyle=(["'])([\s\S]*?)\1/i)
  return { quote: match?.[1] || '"', css: match?.[2] || '' }
}

function styleMap(css: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of css.split(';')) {
    const index = part.indexOf(':')
    if (index < 0) continue
    const key = part.slice(0, index).trim().toLowerCase()
    const value = part.slice(index + 1).trim()
    if (key && value) out.set(key, value)
  }
  return out
}

function writeStyle(attrs: string, map: Map<string, string>): string {
  const current = readStyle(attrs)
  const css = Array.from(map.entries())
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  const without = attrs.replace(/\sstyle=(["'])([\s\S]*?)\1/i, '')
  return css ? `${without} style=${current.quote}${css}${current.quote}` : without
}

function numberAttr(attrs: string, name: string): number {
  const raw = readAttr(attrs, name).trim()
  if (!raw) return Number.NaN
  const value = Number(raw)
  return Number.isFinite(value) ? value : Number.NaN
}

function cssNumber(value: string | undefined): number {
  const n = Number.parseFloat(String(value || ''))
  return Number.isFinite(n) ? n : Number.NaN
}

function logicalFromCss(value: string | undefined, sceneWidth: number): number {
  const n = cssNumber(value)
  if (!Number.isFinite(n)) return Number.NaN
  return String(value).includes('%') ? (n / 100) * sceneWidth : n
}

function translatePx(transform: string | undefined): { x: number; y: number } {
  const value = String(transform || '')
  let x = 0
  let y = 0
  const pair = value.match(/translate(?:3d)?\(\s*(-?[\d.]+)px(?:\s*,|\s+)\s*(-?[\d.]+)px/i)
  if (pair) {
    x += Number(pair[1]) || 0
    y += Number(pair[2]) || 0
  }
  const tx = value.match(/translateX\(\s*(-?[\d.]+)px/i)
  const ty = value.match(/translateY\(\s*(-?[\d.]+)px/i)
  if (tx) x += Number(tx[1]) || 0
  if (ty) y += Number(ty[1]) || 0
  return { x, y }
}

function round(value: number, precision = 3): string {
  const factor = 10 ** precision
  return String(Math.round(value * factor) / factor)
}

function explicitPlacement(attrs: string): PwPlacementMode | null {
  const raw = readAttr(attrs, PW_PLACEMENT_ATTR)
  return raw === 'flow' || raw === 'scene-absolute' || raw === 'viewport-fixed'
    ? raw
    : null
}

function canonicalizeOpeningTag(
  tag: string,
  rawAttrs: string,
  device: PwCoordinateDevice,
  options: NormalizeCoordinateOptions
): string {
  let attrs = rawAttrs
  const sceneWidth = pwSceneWidth(device)
  const sourceVer = pwParseCoordinateVersion(options.sourceVersion)
  const migrateLeftOrigin = sourceVer < 3
  const migrateElementCenter = sourceVer < 4
  const style = styleMap(readStyle(attrs).css)
  const explicit = explicitPlacement(attrs)
  if (
    /\bdata-pw-logo-(?:float|floated|frame|home|added)=["']1["']/i.test(attrs) ||
    /\bdata-pw-el=["']logo["']/i.test(attrs) ||
    /\b(?:pw-logo-frame|pw-logo|pw-shop-logo|pw-brand|pw-shop-brand)\b/i.test(attrs)
  ) {
    return `<${tag}${rawAttrs}>`
  }
  if (isInFlowCatalogChromeAttrs(attrs)) {
    attrs = setAttr(attrs, PW_PLACEMENT_ATTR, 'flow')
    attrs = removeAttr(attrs, 'data-pw-user-move')
    for (const name of [
      'data-pw-box-x',
      'data-pw-box-y',
      'data-pw-box-w',
      'data-pw-box-h',
      'data-pw-fixed-x',
      'data-pw-fixed-y',
      'data-pw-fixed-w',
      'data-pw-fixed-h',
      'data-pw-fixed-anchor',
      'data-pw-stay-x',
      'data-pw-stay-y',
      'data-pw-stay-w',
      'data-pw-stay-h',
      'data-pw-canvas-x',
      'data-pw-canvas-y',
      'data-pw-canvas-w',
      'data-pw-canvas-h',
      'data-pw-canvas-xu',
      'data-pw-canvas-yu',
    ]) {
      attrs = removeAttr(attrs, name)
    }
    for (const name of ['position', 'left', 'top', 'right', 'bottom', 'transform']) {
      style.delete(name)
    }
    attrs = writeStyle(attrs, style)
    return `<${tag}${attrs}>`
  }
  const faceColorVars: Array<[string, string]> = [
    ['data-pw-btn-color', '--pw-btn-color'],
    ['data-pw-btn-border', '--pw-btn-border'],
    ['data-pw-btn-text', '--pw-btn-text'],
    ['data-pw-icon-color', '--pw-icon-color'],
    ['data-pw-chrome-hover', '--pw-chrome-hover'],
  ]
  const isPageLinkFace =
    /\bdata-pw-el=["'](?:nav-link|link|crumb|section-more|menu-item)["']/i.test(attrs) &&
    (/\bdata-pw-btn-color=/i.test(attrs) || /\bdata-pw-btn-text=/i.test(attrs))
  if (isPageLinkFace) {
    for (const [attr, cssVar] of faceColorVars) {
      const color = readAttr(attrs, attr).trim()
      if (color && !style.has(cssVar)) style.set(cssVar, color)
    }
    attrs = writeStyle(attrs, style)
  }
  const isKitFloatBtn =
    /\bdata-pw-chrome-float=["']1["']/i.test(attrs) && /\bdata-pw-chrome-kit=["']1["']/i.test(attrs)
  if (isKitFloatBtn) {
    attrs = removeAttr(attrs, PW_PLACEMENT_ATTR)
    for (const name of [
      'data-pw-fixed-x',
      'data-pw-fixed-y',
      'data-pw-fixed-w',
      'data-pw-fixed-h',
      'data-pw-fixed-anchor',
      'data-pw-user-move',
    ]) {
      attrs = removeAttr(attrs, name)
    }
    for (const name of ['position', 'left', 'top', 'right', 'bottom', 'transform', 'z-index', 'margin']) {
      style.delete(name)
    }
    for (const [attr, cssVar] of faceColorVars) {
      const color = readAttr(attrs, attr).trim()
      if (color && !style.has(cssVar)) style.set(cssVar, color)
    }
    attrs = writeStyle(attrs, style)
    return `<${tag}${attrs}>`
  }
  const isFlow = FLOW_SLOT_RE.test(attrs) || explicit === 'flow'
  const isFixed =
    explicit === 'viewport-fixed' ||
    FIXED_RE.test(attrs) ||
    (AUTHORED_RE.test(attrs) && style.get('position') === 'fixed')
  const isAbsolute =
    explicit === 'scene-absolute' ||
    (AUTHORED_RE.test(attrs) && style.get('position') === 'absolute')

  if (isFlow) {
    attrs = setAttr(attrs, PW_PLACEMENT_ATTR, 'flow')
    if (options.writeCanonicalOnly) {
      for (const name of [
        'data-pw-box-x',
        'data-pw-box-y',
        'data-pw-box-w',
        'data-pw-box-h',
        'data-pw-fixed-x',
        'data-pw-fixed-y',
        'data-pw-fixed-w',
        'data-pw-fixed-h',
        'data-pw-fixed-anchor',
        'data-pw-stay-x',
        'data-pw-stay-y',
        'data-pw-stay-w',
        'data-pw-stay-h',
        'data-pw-canvas-x',
        'data-pw-canvas-y',
        'data-pw-canvas-w',
        'data-pw-canvas-h',
        'data-pw-canvas-xu',
        'data-pw-canvas-yu',
      ]) {
        attrs = removeAttr(attrs, name)
      }
      for (const name of ['position', 'left', 'top', 'right', 'bottom', 'transform']) {
        style.delete(name)
      }
      attrs = writeStyle(attrs, style)
    }
    return `<${tag}${attrs}>`
  }

  if (isFixed) {
    let x = numberAttr(attrs, 'data-pw-fixed-x')
    let y = numberAttr(attrs, 'data-pw-fixed-y')
    let width = numberAttr(attrs, 'data-pw-fixed-w')
    let height = numberAttr(attrs, 'data-pw-fixed-h')
    const stayX = numberAttr(attrs, 'data-pw-stay-x')
    const stayY = numberAttr(attrs, 'data-pw-stay-y')
    if (!Number.isFinite(x) && Number.isFinite(stayX)) x = stayX / 100
    if (!Number.isFinite(y) && Number.isFinite(stayY)) y = stayY / 100
    const leftCss = style.get('left')
    const topCss = style.get('top')
    if (!Number.isFinite(x) && leftCss?.includes('%')) x = cssNumber(leftCss) / 100
    if (!Number.isFinite(y) && topCss?.includes('%')) y = cssNumber(topCss) / 100
    if (!Number.isFinite(x) && leftCss?.includes('px')) x = cssNumber(leftCss) / sceneWidth
    if (!Number.isFinite(width)) width = numberAttr(attrs, 'data-pw-stay-w')
    if (!Number.isFinite(height)) height = numberAttr(attrs, 'data-pw-stay-h')
    if (!Number.isFinite(width)) width = cssNumber(style.get('width'))
    if (!Number.isFinite(height)) height = cssNumber(style.get('height'))
    if (
      migrateElementCenter &&
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      !pwLooksLikeNormalized01(x, y)
    ) {
      const center = pwTopLeftToElementCenter(x, y, width, height)
      x = center.x
      y = center.y
    }
    attrs = setAttr(attrs, PW_PLACEMENT_ATTR, 'viewport-fixed')
    if (Number.isFinite(x)) attrs = setAttr(attrs, 'data-pw-fixed-x', round(x, 5))
    if (Number.isFinite(y)) attrs = setAttr(attrs, 'data-pw-fixed-y', round(y, 5))
    if (Number.isFinite(width) && width > 0) attrs = setAttr(attrs, 'data-pw-fixed-w', round(width))
    if (Number.isFinite(height) && height > 0) attrs = setAttr(attrs, 'data-pw-fixed-h', round(height))
    if (options.writeCanonicalOnly && Number.isFinite(x) && Number.isFinite(y)) {
      for (const name of [
        'data-pw-stay-x',
        'data-pw-stay-y',
        'data-pw-stay-w',
        'data-pw-stay-h',
        'data-pw-canvas-x',
        'data-pw-canvas-y',
        'data-pw-canvas-w',
        'data-pw-canvas-h',
        'data-pw-canvas-xu',
        'data-pw-canvas-yu',
        'data-pw-box-x',
        'data-pw-box-y',
        'data-pw-box-w',
        'data-pw-box-h',
      ]) {
        attrs = removeAttr(attrs, name)
      }
      for (const name of ['position', 'left', 'top', 'right', 'bottom', 'transform']) style.delete(name)
      attrs = writeStyle(attrs, style)
    }
    return `<${tag}${attrs}>`
  }

  if (isAbsolute) {
    const hadCanonicalBox =
      Number.isFinite(numberAttr(attrs, 'data-pw-box-x')) &&
      Number.isFinite(numberAttr(attrs, 'data-pw-box-y'))
    let x = numberAttr(attrs, 'data-pw-box-x')
    let y = numberAttr(attrs, 'data-pw-box-y')
    let width = numberAttr(attrs, 'data-pw-box-w')
    let height = numberAttr(attrs, 'data-pw-box-h')
    if (!Number.isFinite(x)) {
      const canvasX = numberAttr(attrs, 'data-pw-canvas-x')
      const unit = readAttr(attrs, 'data-pw-canvas-xu')
      if (Number.isFinite(canvasX)) x = unit === 'pct' ? (canvasX / 100) * sceneWidth : canvasX
    }
    if (!Number.isFinite(y)) y = numberAttr(attrs, 'data-pw-canvas-y')
    if (!Number.isFinite(x)) x = logicalFromCss(style.get('left'), sceneWidth)
    if (!Number.isFinite(y) && !style.get('top')?.includes('%')) y = cssNumber(style.get('top'))
    if (!hadCanonicalBox) {
      const translated = translatePx(style.get('transform'))
      if (Number.isFinite(x)) x += translated.x
      if (Number.isFinite(y)) y += translated.y
    }
    if (!Number.isFinite(width)) width = numberAttr(attrs, 'data-pw-canvas-w')
    if (!Number.isFinite(height)) height = numberAttr(attrs, 'data-pw-canvas-h')
    if (!Number.isFinite(width)) width = cssNumber(style.get('width'))
    if (!Number.isFinite(height)) height = cssNumber(style.get('height'))
    if (Number.isFinite(x) && Number.isFinite(y)) {
      if (migrateLeftOrigin) x = pwLeftOriginToCenterX(x, sceneWidth)
      if (migrateElementCenter) {
        const center = pwTopLeftToElementCenter(x, y, width, height)
        x = center.x
        y = center.y
      }
      attrs = setAttr(attrs, PW_PLACEMENT_ATTR, 'scene-absolute')
      attrs = setAttr(attrs, 'data-pw-box-x', round(x))
      attrs = setAttr(attrs, 'data-pw-box-y', round(y))
      if (Number.isFinite(width) && width > 0) attrs = setAttr(attrs, 'data-pw-box-w', round(width))
      if (Number.isFinite(height) && height > 0) attrs = setAttr(attrs, 'data-pw-box-h', round(height))
      if (options.writeCanonicalOnly) {
        for (const name of [
          'data-pw-canvas-x',
          'data-pw-canvas-y',
          'data-pw-canvas-w',
          'data-pw-canvas-h',
          'data-pw-canvas-xu',
          'data-pw-canvas-yu',
        ]) {
          attrs = removeAttr(attrs, name)
        }
        style.set('position', 'absolute')
        style.set('left', pwSceneBoxLeftCss(x, width))
        style.set('top', `${pwSceneBoxTopPx(y, height)}px`)
        style.delete('right')
        style.delete('bottom')
        style.delete('transform')
        attrs = writeStyle(attrs, style)
      }
    }
  }

  return `<${tag}${attrs}>`
}

export function visualCoordinateContractVersionOf(html: string): string {
  return (
    html.match(new RegExp(`\\b${PW_COORDINATE_VERSION_ATTR}=["']([^"']+)["']`, 'i'))?.[1] ||
    ''
  )
}

/** Pure, idempotent legacy reader. Render is dual-read; save writes v4 element-center geometry. */
export function normalizeVisualCoordinateContract(
  html: string,
  options: NormalizeCoordinateOptions = {}
): string {
  if (!html.trim()) return html
  const sourceVersion = options.sourceVersion ?? visualCoordinateContractVersionOf(html)
  const stampedDevice =
    options.variant ||
    pwCoordinateDevice(
      html.match(/\bdata-pw-(?:edit-device|scene-lock)=["']([^"']+)["']/i)?.[1]
    )
  const tagOptions: NormalizeCoordinateOptions = { ...options, sourceVersion }
  const rawBlocks: string[] = []
  let next = html.replace(
    /<(script|style|textarea|template)\b[\s\S]*?<\/\1\s*>/gi,
    (block) => {
      const index = rawBlocks.push(block) - 1
      return `__PW_COORD_RAW_BLOCK_${index}__`
    }
  )
  next = next.replace(
    /<([a-zA-Z][\w-]*)(\s[^<>]*?)>/g,
    (_full, tag: string, attrs: string) =>
      canonicalizeOpeningTag(tag, attrs, stampedDevice, tagOptions)
  )
  next = next.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    return `<html${setAttr(attrs, PW_COORDINATE_VERSION_ATTR, PW_COORDINATE_CONTRACT_VERSION)}>`
  })
  if (/<main\b/i.test(next) && !/\bdata-pw-scene-root=["']1["']/i.test(next)) {
    next = next.replace(/<main\b([^>]*)>/i, (_full, attrs: string) => {
      return `<main${setAttr(attrs, 'data-pw-scene-root', '1')}>`
    })
  }
  next = next.replace(/__PW_COORD_RAW_BLOCK_(\d+)__/g, (_full, index: string) => {
    return rawBlocks[Number(index)] || ''
  })
  return next
}
