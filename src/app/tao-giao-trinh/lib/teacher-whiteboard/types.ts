export type WhiteboardPoint = { x: number; y: number }

export type WhiteboardCamera = { x: number; y: number; scale: number }

export type WhiteboardTool = 'pen' | 'eraser' | 'fill' | 'select' | 'pan' | 'text'

/** Lệnh trong sổ Dim, giống bảng Dimension của AutoCAD. */
export const WHITEBOARD_DIM_TOOLS = [
  'quick',
  'linear',
  'aligned',
  'angular',
  'arc',
  'radius',
  'diameter',
  'jogged',
  'ordinate',
  'continue',
  'baseline',
] as const
export type WhiteboardDimTool = (typeof WHITEBOARD_DIM_TOOLS)[number]

/** Cách vẽ đã chốt. Tiếp tục và đường gióng lưu thành thẳng hoặc song song. */
export const WHITEBOARD_DIM_KINDS = ['linear', 'aligned', 'angular', 'arc', 'radius', 'diameter', 'jogged', 'ordinate'] as const
export type WhiteboardDimKind = (typeof WHITEBOARD_DIM_KINDS)[number]

export const WHITEBOARD_LINE_TYPE_IDS = ['continuous', 'dashed', 'hidden', 'center', 'dashdot', 'divide', 'phantom', 'dot'] as const
export type WhiteboardLineType = (typeof WHITEBOARD_LINE_TYPE_IDS)[number]

export type WhiteboardStroke = {
  kind: 'stroke'
  id: string
  tool?: 'pen' | 'eraser'
  color: string
  size: number
  /** Nét AutoCAD. Thiếu hoặc continuous là nét liền. */
  lineType?: WhiteboardLineType
  /** Màu tô khi nét khép kín. Thiếu thì chỉ có nét. */
  fill?: string
  points: WhiteboardPoint[]
}

export type WhiteboardShapeKind = 'line' | 'arrow' | 'circle' | 'ellipse' | 'rect' | 'triangle' | 'polygon' | 'solid'

/** Khối dây, phép chiếu xiên: mặt trước thật, chiều sâu lên phải. */
export const SOLID_KINDS = [
  'cube',
  'box',
  'oblique-box',
  'tri-prism',
  'hex-prism',
  'tetra',
  'square-pyramid',
  'hex-pyramid',
  'frustum',
  'cylinder',
  'cone',
  'cone-frustum',
  'octa',
  'sphere',
] as const
export type SolidKind = (typeof SOLID_KINDS)[number]

export type TriangleKind = 'equilateral' | 'isosceles' | 'right' | 'right-isosceles' | 'scalene'

/** Đường xuất phát từ một đỉnh (0=A, 1=B, 2=C), trừ trung bình nối hai trung điểm. */
export type TriangleLineRole = 'altitude' | 'bisector' | 'median' | 'perp-bisector' | 'midsegment'

export type TriangleLineMark = {
  role: TriangleLineRole
  vertex: 0 | 1 | 2
  triangleId: string
  /** Tên điểm mới do đường này tạo ra, ví dụ D. */
  footName?: string
}

/** Cạnh AB, BC, CA. Góc vuông, nếu có, nằm tại C. Tam giác cân có AB = AC. */
export type TriangleMark = {
  kind: TriangleKind
  ab: string
  bc: string
  ca: string
}

export type QuadKind = 'square' | 'rectangle' | 'parallelogram' | 'rhombus' | 'trapezoid'

/** Cạnh AB BC CD DA theo ô lưới. Góc tại A, độ. Vuông và chữ nhật là 90. Hình thoi để đường chéo AC nằm ngang. Hình thang: angle là chiều cao theo ô. */
export type QuadMark = {
  kind: QuadKind
  ab: string
  bc: string
  cd: string
  da: string
  angle: string
}

export type WhiteboardShape = {
  kind: 'shape'
  id: string
  shape: WhiteboardShapeKind
  color: string
  size: number
  lineType?: WhiteboardLineType
  /** Màu tô vùng khép kín. Thiếu thì chỉ có nét. */
  fill?: string
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
  quad?: QuadMark
  /** Bốn đỉnh của tứ giác đã chốt. */
  quadNames?: [string, string, string, string]
  /** Tên ba đỉnh. Thiếu thì tam giác gốc là A, B, C. */
  vertexNames?: [string, string, string]
  /** Tam giác con sinh ra khi một đường cắt cạnh. Không vẽ nét, chỉ để hỏi đường và đặt tên. */
  regionOnly?: boolean
  /** Vùng tô ghép từ nhiều nét. Chỉ tô, không vẽ thêm viền. */
  fillOnly?: boolean
  /** Khối 3D. solidHidden cặp cạnh đầu trong solidEdges vẽ nét đứt. */
  solid?: SolidKind
  solidEdges?: number[]
  solidHidden?: number
  /** Chỉ số đỉnh góc, để chấm điểm và bắt nét. */
  solidCorners?: number[]
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

export type WhiteboardDim = {
  kind: 'dim'
  id: string
  color: string
  size: number
  dim: WhiteboardDimKind
  /** Điểm định nghĩa. Điểm cuối là chỗ đặt đường kích thước, nếu lệnh cần. */
  points: WhiteboardPoint[]
}

export type WhiteboardText = {
  kind: 'text'
  id: string
  color: string
  /** Cỡ chữ theo pixel thế giới. */
  size: number
  text: string
  /** Góc trên-trái. */
  x: number
  y: number
  /** Bề rộng khung xuống dòng, pixel thế giới. */
  width: number
}

/** Ảnh chèn. Góc trên-trái và kích thước theo pixel thế giới. Nằm dưới nét vẽ. */
export type WhiteboardImage = {
  kind: 'image'
  id: string
  /** data:image/jpeg|png|webp;base64,... */
  src: string
  x: number
  y: number
  w: number
  h: number
}

/** Hình chèn: công thức hoặc sơ đồ. Góc trên-trái và kích thước theo pixel thế giới. */
export type WhiteboardFigure = {
  kind: 'figure'
  id: string
  color: string
  figure: string
  x: number
  y: number
  w: number
  h: number
  params: {
    variant: string
    liquid: string
    level: number
    label: string
    equation: string
    tune: number[]
    run: boolean
    clock: number
    shift: number
  }
}

export type WhiteboardObject = WhiteboardStroke | WhiteboardShape | WhiteboardGraph | WhiteboardDim | WhiteboardText | WhiteboardFigure | WhiteboardImage

export type WhiteboardDraft = {
  id: string
  tool?: 'pen' | 'eraser'
  color: string
  size: number
  lineType?: WhiteboardLineType
  points: WhiteboardPoint[]
}

export type WhiteboardState = {
  objects: WhiteboardObject[]
  camera: WhiteboardCamera
  draft: WhiteboardDraft | null
  grid: boolean
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
export const WHITEBOARD_BRUSH = [2, 5] as const
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
