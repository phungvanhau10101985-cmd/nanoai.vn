/**
 * Canonical coordinate contract shared by Sửa nhanh and the public storefront.
 *
 * Device selection and display scaling are deliberately separate:
 * - a device owns one immutable logical scene width;
 * - a viewport maps that scene with one uniform scale around the scene midpoint.
 */
export const PW_COORDINATE_CONTRACT_VERSION = '2' as const
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

export type PwPoint = {
  x: number
  y: number
}

export type PwSceneBox = PwPoint & {
  width: number
  height: number
}

export type PwViewportMap = {
  device: PwCoordinateDevice
  sceneWidth: number
  viewportWidth: number
  scale: number
  originX: number
  originY: number
}

export type PwDeviceViewport = {
  forcedDevice?: unknown
  outerWidth?: unknown
  layoutWidth?: unknown
  screenWidth?: unknown
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

/**
 * Stable device resolver. Callers should pass outerWidth for browser windows and
 * layoutWidth only as a fallback. visualViewport width never owns device selection.
 */
export function pwResolveCoordinateDevice(input: PwDeviceViewport): PwCoordinateDevice {
  if (isPwCoordinateDevice(input.forcedDevice)) return input.forcedDevice
  const candidates = [input.outerWidth, input.layoutWidth, input.screenWidth]
  let width = 0
  for (const candidate of candidates) {
    const n = Number(candidate)
    if (Number.isFinite(n) && n > 0) {
      width = n
      break
    }
  }
  if (width < PW_SCENE_WIDTH.tablet) return 'mobile'
  if (width < PW_SCENE_WIDTH.laptop) return 'tablet'
  if (width < PW_SCENE_WIDTH.desktop) return 'laptop'
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
  const renderedWidth = sceneWidth * scale
  const explicitOriginX = Number(input.originX)
  return {
    device,
    sceneWidth,
    viewportWidth,
    scale,
    originX: Number.isFinite(explicitOriginX)
      ? explicitOriginX
      : (viewportWidth - renderedWidth) / 2,
    originY:
      Number.isFinite(Number(input.originY)) && Number(input.originY) !== 0
        ? Number(input.originY)
        : 0,
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
function resolve(i){i=i||{};if(i.forcedDevice==='mobile'||i.forcedDevice==='tablet'||i.forcedDevice==='laptop'||i.forcedDevice==='desktop')return i.forcedDevice;var a=[i.outerWidth,i.layoutWidth,i.screenWidth],w=0,n,j;for(j=0;j<a.length;j++){n=Number(a[j]);if(isFinite(n)&&n>0){w=n;break}}if(w<W.tablet)return'mobile';if(w<W.laptop)return'tablet';if(w<W.desktop)return'laptop';return'desktop'}
function pick(preferred,has){var list=O[device(preferred)]||O.desktop,j;for(j=0;j<list.length;j++)if(has(list[j]))return list[j];return''}
function map(i){i=i||{};var d=i.device?device(i.device):resolve(i),sw=W[d],vw=Number(i.viewportWidth==null?i.layoutWidth:i.viewportWidth);if(!(vw>0))vw=sw;var s=Number(i.scale);if(!(s>0))s=i.fitWidth===false?1:vw/sw;var ox=Number(i.originX);return{device:d,sceneWidth:sw,viewportWidth:vw,scale:s,originX:isFinite(ox)?ox:(vw-sw*s)/2,originY:isFinite(Number(i.originY))?Number(i.originY):0}}
function toClient(p,m){return{x:m.originX+Number(p.x||0)*m.scale,y:m.originY+Number(p.y||0)*m.scale}}
function toScene(p,m){var s=m.scale>0?m.scale:1;return{x:(Number(p.x||0)-m.originX)/s,y:(Number(p.y||0)-m.originY)/s}}
g.${safeGlobal}={version:'${PW_COORDINATE_CONTRACT_VERSION}',widths:W,fallback:O,device:device,resolveDevice:resolve,pickAvailable:pick,createMap:map,sceneToClient:toClient,clientToScene:toScene};
})(window);`
}
