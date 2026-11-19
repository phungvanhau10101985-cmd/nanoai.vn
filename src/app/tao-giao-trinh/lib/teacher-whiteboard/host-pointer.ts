import { worldToScreen } from './geometry'

/** Đặt chuột máy chủ lên đúng điểm của bảng trắng máy này. */
export function clientPointForWhiteboardPointer(
  msg: { boardChrome?: boolean; relX?: number; relY?: number; worldX?: number; worldY?: number },
  camera: { x: number; y: number; scale: number },
): { x: number; y: number } | null {
  if (typeof document === 'undefined') return null
  const root = document.querySelector('[data-teacher-whiteboard]') as HTMLElement | null
  if (!root) return null
  if (msg.boardChrome && typeof msg.relX === 'number' && typeof msg.relY === 'number') {
    const rect = root.getBoundingClientRect()
    if (rect.width < 2 || rect.height < 2) return null
    return { x: rect.left + msg.relX * rect.width, y: rect.top + msg.relY * rect.height }
  }
  const view = root.querySelector('[data-teacher-whiteboard-view]') as HTMLElement | null
  if (!view || typeof msg.worldX !== 'number' || typeof msg.worldY !== 'number') return null
  const rect = view.getBoundingClientRect()
  if (rect.width < 2 || rect.height < 2) return null
  const screen = worldToScreen({ x: msg.worldX, y: msg.worldY }, camera, rect.width, rect.height)
  return { x: rect.left + screen.x, y: rect.top + screen.y }
}
