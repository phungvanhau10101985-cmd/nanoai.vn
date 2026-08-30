/**
 * Canonical coordinate contract shared by Sửa nhanh and the public storefront.
 *
 * Origin is the top edge + horizontal midpoint of the screen.
 * An element's stored (x, y) is the center of that element, not its top-left.
 * Each device owns one immutable logical scene width at scale 1:1.
 * A smaller/larger viewport uses one uniform scale: viewportWidth / sceneWidth.
 */
export const PW_COORDINATE_CONTRACT_VERSION = '4' as const
export const PW_COORDINATE_VERSION_ATTR = 'data-pw-coordinate-version' as const
export const PW_PLACEMENT_ATTR = 'data-pw-placement' as const

export const PW_COORDINATE_DEVICES = ['desktop', 'laptop', 'tablet', 'mobile'] as const
export type PwCoordinateDevice = (typeof PW_COORDINATE_DEVICES)[number]

/** One width per device. 1200px remains a content column, never a second origin. */
export const PW_SCENE_WIDTH: Readonly<Record<PwCoordinateDevice, number>> = {
  mobile: 390,
  tablet: 768,
  laptop: 1280,
  desktop: 1440,
}

export type PwPlacementMode = 'flow' | 'scene-absolute' | 'viewport-fixed'

/** Logical box. x/y is the element's center, not its top-left. */
export type PwSceneBox = PwPoint & {
  width: number
  height: number
}

export type PwViewportMap = {
  device: PwCoordinateDevice
  sceneWidth: number
  viewportWidth: number
  scale: number
  /** Client X of the top-center origin. */
  originX: number
  /** Client Y of the top-center origin (top edge). */
  originY: number
}

export type PwDeviceViewport = {
  forcedDevice?: unknown
  outerWidth?: unknown
  layoutWidth?: unknown
  screenWidth?: unknown
  /** `window.devicePixelRatio`. Windows Display Scale on FHD (21" 1920×1080 @ 150%) is 1.5. */
  devicePixelRatio?: unknown
}

export type PwViewportMapInput = PwDeviceViewport & {
  device?: unknown
  viewportWidth?: unknown
  scale?: unknown
  originX?: unknown
  originY?: unknown
  /** Public live fills the viewport; editor canvases pass false and stay at scale 1. */
  fitWidth?: boolean
}

export const PW_DEVICE_FALLBACK_ORDER: Readonly<
  Record<PwCoordinateDevice, readonly PwCoordinateDevice[]>
> = {
  desktop: ['desktop', 'laptop', 'tablet', 'mobile'],
  laptop: ['laptop', 'desktop', 'tablet', 'mobile'],
  tablet: ['tablet', 'laptop', 'desktop', 'mobile'],
  mobile: ['mobile', 'tablet', 'laptop', 'desktop'],
}

export function isPwCoordinateDevice(value: unknown): value is PwCoordinateDevice {
  return (
    value === 'mobile' ||
    value === 'tablet' ||
    value === 'laptop' ||
    value === 'desktop'
  )
}

export function pwCoordinateDevice(value: unknown): PwCoordinateDevice {
  return isPwCoordinateDevice(value) ? value : 'desktop'
}

export function pwSceneWidth(device: unknown): number {
  return PW_SCENE_WIDTH[pwCoordinateDevice(device)]
}

export function pwParseCoordinateVersion(value: unknown): number {
  const n = Number.parseInt(String(value || ''), 10)
  if (n === 4 || n === 3 || n === 2 || n === 1) return n
  return 0
}

export function pwIsCurrentCoordinateVersion(value: unknown): boolean {
  return String(value || '') === PW_COORDINATE_CONTRACT_VERSION
}

/**
 * v2 stored X from the left of the scene. v3+ stores X from the horizontal center.
 * y of the origin is unchanged: distance from the top edge.
 */
export function pwLeftOriginToCenterX(leftX: unknown, sceneWidth: unknown): number {
  return Number(leftX) - Number(sceneWidth) / 2
}

export function pwCenterXToLeftOrigin(centerX: unknown, sceneWidth: unknown): number {
  return Number(centerX) + Number(sceneWidth) / 2
}

/** v2 viewport-fixed X was 0–1 of the viewport left. */
export function pwNormalizedLeftToCenterX(normLeft: unknown, sceneWidth: unknown): number {
  const scene = Number(sceneWidth)
  return Number(normLeft) * scene - scene / 2
}

export function pwLooksLikeNormalized01(x: unknown, y: unknown): boolean {
  const nx = Number(x)
  const ny = Number(y)
  return nx > 0 && nx <= 1 && ny >= 0 && ny <= 1
}

export function pwSceneLeftCss(x: unknown): string {
  const n = pwRoundLogical(x)
  if (n === 0) return '50%'
  if (n > 0) return `calc(50% + ${n}px)`
  return `calc(50% - ${Math.abs(n)}px)`
}

function halfSize(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n / 2 : 0
}

/** v3 stored the top-left of the element. v4 stores the element's center. */
export function pwTopLeftToElementCenter(
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown
): PwPoint {
  return {
    x: Number(x) + halfSize(width),
    y: Number(y) + halfSize(height),
  }
}

export function pwElementCenterToTopLeft(
  x: unknown,
  y: unknown,
  width: unknown,
  height: unknown
): PwPoint {
  return {
    x: Number(x) - halfSize(width),
    y: Number(y) - halfSize(height),
  }
}

export function pwSceneBoxLeftCss(centerX: unknown, width: unknown): string {
  return pwSceneLeftCss(Number(centerX) - halfSize(width))
}

export function pwSceneBoxTopPx(centerY: unknown, height: unknown): number {
  return pwRoundLogical(Number(centerY) - halfSize(height))
}

export function pwClientRectCenter(rect: {
  left: number
  top: number
  width: number
  height: number
}): PwPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  }
}

export function pwClientTopLeftFromCenter(
  center: PwPoint,
  width: unknown,
  height: unknown,
  scale = 1
): PwPoint {
  const s = Number(scale) > 0 ? Number(scale) : 1
  return {
    x: center.x - halfSize(width) * s,
    y: center.y - halfSize(height) * s,
  }
}

export function pwFirstPositivePx(...values: unknown[]): number {
  for (const candidate of values) {
    const n = Number(candidate)
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/**
 * Windows Display Scale on a full-HD panel (typical 21" 1920×1080 @ 125–175%).
 * CSS width lands in the laptop band (1280–1439) even though the screen is a desktop.
 * Exclude Retina `dpr >= 2` so a 13" MacBook at 1280 CSS stays laptop.
 */
export const PW_SCALED_FHD_DPR_MIN = 1.25
export const PW_SCALED_FHD_DPR_MAX_EXCLUSIVE = 2

export function pwScaledFhdDesktopMediaQuery(): string {
  return `(min-width:${PW_SCENE_WIDTH.laptop}px) and (max-width:${PW_SCENE_WIDTH.desktop - 1}px) and (min-resolution:${PW_SCALED_FHD_DPR_MIN}dppx) and (max-resolution:1.99dppx)`
}

export function pwLooksLikeScaledFhdDesktop(input: PwDeviceViewport): boolean {
  const dpr = Number(input.devicePixelRatio)
  if (!(dpr >= PW_SCALED_FHD_DPR_MIN) || !(dpr < PW_SCALED_FHD_DPR_MAX_EXCLUSIVE)) return false
  const width = pwFirstPositivePx(input.outerWidth, input.layoutWidth, input.screenWidth)
  return width >= PW_SCENE_WIDTH.laptop && width < PW_SCENE_WIDTH.desktop
}

/**
 * Stable device resolver. Callers should pass outerWidth for browser windows and
 * layoutWidth only as a fallback. visualViewport width never owns device selection.
 */
export function pwResolveCoordinateDevice(input: PwDeviceViewport): PwCoordinateDevice {
  if (isPwCoordinateDevice(input.forcedDevice)) return input.forcedDevice
  const width = pwFirstPositivePx(input.outerWidth, input.layoutWidth, input.screenWidth)
  if (width < PW_SCENE_WIDTH.tablet) return 'mobile'
  if (width < PW_SCENE_WIDTH.laptop) return 'tablet'
  if (width < PW_SCENE_WIDTH.desktop) {
    return pwLooksLikeScaledFhdDesktop({ ...input, outerWidth: width }) ? 'desktop' : 'laptop'
  }
  return 'desktop'
}

export function pwPickAvailableDevice(
  preferred: PwCoordinateDevice,
  available: Iterable<PwCoordinateDevice>
): PwCoordinateDevice | null {
  const set = available instanceof Set ? available : new Set(available)
  for (const device of PW_DEVICE_FALLBACK_ORDER[preferred]) {
    if (set.has(device)) return device
  }
  return null
}

export function pwUniformSceneScale(viewportWidth: unknown, sceneWidth: unknown): number {
  const viewport = Number(viewportWidth)
  const scene = Number(sceneWidth)
  if (!(viewport > 8) || !(scene > 8)) return 1
  return viewport / scene
}

export function pwCreateViewportMap(input: PwViewportMapInput): PwViewportMap {
  const device = isPwCoordinateDevice(input.device)
    ? input.device
    : pwResolveCoordinateDevice(input)
  const sceneWidth = pwSceneWidth(device)
  const viewport = Number(input.viewportWidth ?? input.layoutWidth)
  const viewportWidth = Number.isFinite(viewport) && viewport > 0 ? viewport : sceneWidth
  const explicitScale = Number(input.scale)
  const scale =
    Number.isFinite(explicitScale) && explicitScale > 0
      ? explicitScale
      : input.fitWidth === false
        ? 1
        : pwUniformSceneScale(viewportWidth, sceneWidth)
  const explicitOriginX = Number(input.originX)
  const explicitOriginY = Number(input.originY)
  return {
    device,
    sceneWidth,
    viewportWidth,
    scale,
    originX: Number.isFinite(explicitOriginX) ? explicitOriginX : viewportWidth / 2,
    originY: Number.isFinite(explicitOriginY) ? explicitOriginY : 0,
  }
}

export function pwSceneToClient(point: PwPoint, map: PwViewportMap): PwPoint {
  return {
    x: map.originX + point.x * map.scale,
    y: map.originY + point.y * map.scale,
  }
}

export function pwClientToScene(point: PwPoint, map: PwViewportMap): PwPoint {
  const scale = map.scale > 0 ? map.scale : 1
  return {
    x: (point.x - map.originX) / scale,
    y: (point.y - map.originY) / scale,
  }
}

export function pwSceneBoxToClient(box: PwSceneBox, map: PwViewportMap): PwSceneBox {
  const point = pwSceneToClient(box, map)
  return {
    ...point,
    width: box.width * map.scale,
    height: box.height * map.scale,
  }
}

export function pwClientBoxToScene(box: PwSceneBox, map: PwViewportMap): PwSceneBox {
  const point = pwClientToScene(box, map)
  const scale = map.scale > 0 ? map.scale : 1
  return {
    ...point,
    width: box.width / scale,
    height: box.height / scale,
  }
}

export function pwRoundLogical(value: unknown, precision = 3): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  const factor = 10 ** Math.max(0, Math.min(6, Math.round(precision)))
  return Math.round(n * factor) / factor
}

/** Generated once and injected into both editor and live documents. */
export function pwCoordinateRuntimeSource(globalName = '__pwCoordinate'): string {
  const safeGlobal = /^[A-Za-z_$][\w$]*$/.test(globalName) ? globalName : '__pwCoordinate'
  return `(function(g){
var W=${JSON.stringify(PW_SCENE_WIDTH)};
var O=${JSON.stringify(PW_DEVICE_FALLBACK_ORDER)};
function device(v){return v==='mobile'||v==='tablet'||v==='laptop'||v==='desktop'?v:'desktop'}
function pos(){var a=arguments,w=0,n,j;for(j=0;j<a.length;j++){n=Number(a[j]);if(isFinite(n)&&n>0){w=n;break}}return w}
function scaledDesk(i,w){var r=Number(i.devicePixelRatio);return r>=${PW_SCALED_FHD_DPR_MIN}&&r<${PW_SCALED_FHD_DPR_MAX_EXCLUSIVE}&&w>=W.laptop&&w<W.desktop}
function resolve(i){i=i||{};if(i.forcedDevice==='mobile'||i.forcedDevice==='tablet'||i.forcedDevice==='laptop'||i.forcedDevice==='desktop')return i.forcedDevice;var w=pos(i.outerWidth,i.layoutWidth,i.screenWidth);if(w<W.tablet)return'mobile';if(w<W.laptop)return'tablet';if(w<W.desktop)return scaledDesk(i,w)?'desktop':'laptop';return'desktop'}
function pick(preferred,has){var list=O[device(preferred)]||O.desktop,j;for(j=0;j<list.length;j++)if(has(list[j]))return list[j];return''}
function map(i){i=i||{};var d=i.device?device(i.device):resolve(i),sw=W[d],vw=Number(i.viewportWidth==null?i.layoutWidth:i.viewportWidth);if(!(vw>0))vw=sw;var s=Number(i.scale);if(!(s>0))s=i.fitWidth===false?1:vw/sw;var ox=Number(i.originX);var oy=Number(i.originY);return{device:d,sceneWidth:sw,viewportWidth:vw,scale:s,originX:isFinite(ox)?ox:vw/2,originY:isFinite(oy)?oy:0}}
function toClient(p,m){return{x:m.originX+Number(p.x||0)*m.scale,y:m.originY+Number(p.y||0)*m.scale}}
function toScene(p,m){var s=m.scale>0?m.scale:1;return{x:(Number(p.x||0)-m.originX)/s,y:(Number(p.y||0)-m.originY)/s}}
function leftCss(x){var n=Number(x)||0;if(!n)return'50%';return n>0?'calc(50% + '+n+'px)':'calc(50% - '+(-n)+'px)'}
function looksNorm(x,y){x=Number(x);y=Number(y);return x>0&&x<=1&&y>=0&&y<=1}
function half(v){v=Number(v);return isFinite(v)&&v>0?v/2:0}
function boxLeftCss(x,w){return leftCss(Number(x||0)-half(w))}
function boxTopPx(y,h){return Number(y||0)-half(h)}
function rectCenter(r){return{x:r.left+r.width/2,y:r.top+r.height/2}}
function clientTopLeft(c,w,h,s){s=s>0?s:1;return{x:c.x-half(w)*s,y:c.y-half(h)*s}}
g.${safeGlobal}={version:'${PW_COORDINATE_CONTRACT_VERSION}',widths:W,fallback:O,device:device,resolveDevice:resolve,pickAvailable:pick,createMap:map,sceneToClient:toClient,clientToScene:toScene,leftCss:leftCss,boxLeftCss:boxLeftCss,boxTopPx:boxTopPx,rectCenter:rectCenter,clientTopLeft:clientTopLeft,looksNorm:looksNorm};
})(window);`
}
