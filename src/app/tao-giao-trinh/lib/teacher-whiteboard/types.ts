export type WhiteboardPoint = { x: number; y: number }

export type WhiteboardCamera = { x: number; y: number; scale: number }

export type WhiteboardTool = 'pen' | 'eraser' | 'select' | 'pan'

export type WhiteboardStroke = {
  kind: 'stroke'
  id: string
  tool?: 'pen' | 'eraser'
  color: string
  size: number
  points: WhiteboardPoint[]
}

export type WhiteboardShapeKind = 'line' | 'arrow' | 'circle' | 'ellipse' | 'rect' | 'triangle' | 'polygon'

export type TriangleKind = 'equilateral' | 'isosceles' | 'right' | 'right-isosceles' | 'scalene'

/** Đường xuất phát từ một đỉnh (0=A, 1=B, 2=C), trừ trung bình nối hai trung điểm. */
export type TriangleLineRole = 'altitude' | 'bisector' | 'median' | 'perp-bisector' | 'midsegment'

export type TriangleLineMark = {
  role: TriangleLineRole
  vertex: 0 | 1 | 2
  triangleId: string
}

/** Cạnh AB, BC, CA. Góc vuông, nếu có, nằm tại C. Tam giác cân có AB = AC. */
export type TriangleMark = {
  kind: TriangleKind
  ab: string
  bc: string
  ca: string
}

export type WhiteboardShape = {
  kind: 'shape'
  id: string
  shape: WhiteboardShapeKind
  color: string
  size: number
  /** Line/arrow/polygon/triangle vertices. Rect: two opposite corners. */
  points: WhiteboardPoint[]
  cx?: number
  cy?: number
  r?: number
  rx?: number
  ry?: number
  rotation?: number
  triangle?: TriangleMark
  triangleLine?: TriangleLineMark
}

export type WhiteboardGraph = {
  kind: 'graph'
  id: string
  color: string
  axis: 'y' | 'x'
  expr: string
  origin: WhiteboardPoint
  unit: number
  /** Các hàm cùng frameId dùng một hệ trục. */
  frameId?: string
}

export type WhiteboardObject = WhiteboardStroke | WhiteboardShape | WhiteboardGraph

export type WhiteboardDraft = {
  id: string
  tool?: 'pen' | 'eraser'
  color: string
  size: number
  points: WhiteboardPoint[]
}

export type WhiteboardState = {
  objects: WhiteboardObject[]
  camera: WhiteboardCamera
  draft: WhiteboardDraft | null
  grid: boolean
  ortho: boolean
}

export type TeacherLeftPaneWire = 'visual' | 'infographic' | 'whiteboard'

export type WhiteboardWireMessage =
  | { type: 'whiteboard-sync'; objects: WhiteboardObject[]; camera: WhiteboardCamera; grid?: boolean }
  | { type: 'whiteboard-upsert'; object: WhiteboardObject }
  | { type: 'whiteboard-remove'; ids: string[] }
  | { type: 'whiteboard-clear' }
  | { type: 'whiteboard-camera'; camera: WhiteboardCamera }
  | { type: 'whiteboard-draft'; draft: WhiteboardDraft | null }
  | { type: 'whiteboard-grid'; grid: boolean }

export const WHITEBOARD_COLORS = ['#111827', '#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#ffffff'] as const
export const WHITEBOARD_BRUSH = [3, 5, 7] as const
export const WHITEBOARD_GRID = 32
export const WHITEBOARD_MAX_OBJECTS = 280
export const WHITEBOARD_MAX_POINTS = 900
export const DEFAULT_WHITEBOARD_CAMERA: WhiteboardCamera = { x: 0, y: 0, scale: 1 }

export function newWhiteboardId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `wb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function teacherSlideLeftPaneFromMode(
  leftPanelMode: string,
  currentVisualShowsInfographic: boolean,
): TeacherLeftPaneWire {
  if (leftPanelMode === 'whiteboard') return 'whiteboard'
  if (leftPanelMode === 'infographic' || (leftPanelMode === 'visual' && currentVisualShowsInfographic)) return 'infographic'
  return 'visual'
}

export function isTeacherLeftPaneWire(value: unknown): value is TeacherLeftPaneWire {
  return value === 'visual' || value === 'infographic' || value === 'whiteboard'
}
