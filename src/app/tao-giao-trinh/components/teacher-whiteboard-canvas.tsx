'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Cuboid, Eraser, Grid3x3, Hand, MousePointer2, PaintBucket, PenLine, Ruler, RulerDimensionLine, Shapes, Trash2, Type, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { WhiteboardRulerGraphic, type RulerDragMode } from './teacher-whiteboard-ruler'
import { FigureEditor, FigureMenu, GraphPreview } from './teacher-whiteboard-figure-panel'
import { cn } from '@/lib/utils'
import { keepEntryFieldInCard, useMobileVisibleFrame } from './use-mobile-visible-frame'
import {
  DEFAULT_WHITEBOARD_CAMERA,
  WHITEBOARD_COLORS,
  WHITEBOARD_DIM_TOOLS,
  WHITEBOARD_GRID,
  WHITEBOARD_TEXT_SIZE,
  WHITEBOARD_TEXT_SIZES,
  WHITEBOARD_TEXT_WIDTH,
  applyWhiteboardMessage,
  emptyWhiteboardState,
  hitTestDraft,
  hitTestTop,
  topFigureHandle,
  closedFaceAt,
  smallestFillPocket,
  polygonArea,
  topClosedRegion,
  isFillableObject,
  isWhiteboardWireType,
  appendInkPoint,
  cameraForPinchGesture,
  cameraZoomKeepingPoint,
  clampWhiteboardScale,
  whiteboardZoomStepPercent,
  mathToWorld,
  newWhiteboardId,
  pathLength,
  paintWhiteboard,
  setWhiteboardImageRepaint,
  compressWhiteboardImage,
  placeWhiteboardImage,
  drawDraft,
  parsePlotInput,
  parseSpatialInput,
  pickObjectsInMarquee,
  joinThreeStrokeArrow,
  joinThreeStrokeTriangle,
  recognizeStroke,
  rotateObject,
  scaleObject,
  screenToWorld,
  worldToScreen,
  overviewCamera,
  whiteboardOverviewBounds,
  snapToGrid,
  snapToObjects,
  translateObject,
  type ComposedDim,
  type DimChain,
  type DimCirclePick,
  type DimLinePick,
  type WhiteboardCamera,
  type WhiteboardDimTool,
  type WhiteboardPoint,
  type WhiteboardLineType,
  type WhiteboardDraft,
  type TriangleLineRole,
  type WhiteboardGraph,
  type WhiteboardObject,
  type WhiteboardState,
  type WhiteboardTool,
  type WhiteboardWireMessage,
  footNameForNewPoint,
  freshCornerNames,
  freshVertexNames,
  angleAtPlace,
  chainFromDim,
  composeDim,
  dimClicksNeeded,
  drawWhiteboardDim,
  measurePickedArc,
  measurePickedCircle,
  measurePickedLine,
  nearestDimCircle,
  nearestDimLine,
  sameDimLine,
  nearestMarkedPoint,
  holdStrokeOnMark,
  clipStrokeEndToMark,
  pinLineEnds,
  nearestTriangleVertex,
  triangleForStraightStroke,
  triangleLinePoints,
  triangleVertexName,
  TRIANGLE_LINE_ROLES,
  fillTriangleSides,
  settleTriangleSides,
  triangleSideLocked,
  formatWholeAngle,
  formatWholeGrid,
  gridMeasureToWorld,
  guessTriangleKind,
  lineFromMeasure,
  lineMeasure,
  normalizeLineAngle,
  stampLineType,
  WHITEBOARD_LINE_PATTERNS,
  parseLineAngle,
  parseSideLength,
  hitMeasureLabel,
  angleAtCorner,
  cornersOfQuad,
  dist,
  fillQuadSides,
  guessQuadKind,
  placeQuad,
  placeTriangle,
  quadSideError,
  trapezoidHeight,
  projectOnRuler,
  protractorArmDeg,
  rulerFromEnds,
  rulerKindOf,
  SOLID_KINDS,
  SOLID_MEASURE_KEYS,
  parseSolidSlant,
  placeMeasuredSolid,
  solidIcon,
  solidMeasureError,
  WHITEBOARD_RULER_KINDS,
  type WhiteboardRuler,
  type WhiteboardRulerKind,
  freshFigureParams,
  figureItem,
  figureSimulates,
  figureClock,
  toggleFigureRun,
  toggleTitrationValve,
  toggleChemSwitch,
  setWaveSources,
  moveFigureTune,
  releaseFigureTune,
  dialogClearOfFigure,
  type FigureParams,
  sidesFromQuadSketch,
  sidesFromSketch,
  triangleSideError,
  type QuadKind,
  type QuadSides,
  type SolidKind,
  type SolidMeasures,
  type TriangleKind,
  type TriangleSides,
} from '../lib/teacher-whiteboard'

type Tr = (vi: string, en: string, zh: string, ja: string, ko: string) => string

const DIM_LABEL: Record<WhiteboardDimTool, { vi: string; en: string; zh: string; ja: string; ko: string }> = {
  quick: { vi: 'Nhanh', en: 'Quick', zh: '快速', ja: 'クイック', ko: '빠른' },
  linear: { vi: 'Thẳng', en: 'Linear', zh: '线性', ja: '長さ', ko: '선형' },
  aligned: { vi: 'Song song', en: 'Aligned', zh: '对齐', ja: '平行', ko: '정렬' },
  angular: { vi: 'Góc', en: 'Angular', zh: '角度', ja: '角度', ko: '각도' },
  arc: { vi: 'Chiều dài cung', en: 'Arc length', zh: '弧长', ja: '弧長', ko: '호 길이' },
  radius: { vi: 'Bán kính', en: 'Radius', zh: '半径', ja: '半径', ko: '반지름' },
  diameter: { vi: 'Đường kính', en: 'Diameter', zh: '直径', ja: '直径', ko: '지름' },
  jogged: { vi: 'Bán kính gãy', en: 'Jogged', zh: '折弯半径', ja: '折り曲げ半径', ko: '꺾인 반지름' },
  ordinate: { vi: 'Tọa độ', en: 'Ordinate', zh: '坐标', ja: '座標', ko: '좌표' },
  continue: { vi: 'Tiếp tục', en: 'Continue', zh: '连续', ja: '直列', ko: '연속' },
  baseline: { vi: 'Đường gióng', en: 'Baseline', zh: '基线', ja: '並列', ko: '기준선' },
}

const RULER_LABEL: Record<WhiteboardRulerKind, { vi: string; en: string; zh: string; ja: string; ko: string }> = {
  length: { vi: 'Thước đo chiều dài', en: 'Length ruler', zh: '长度尺', ja: '長さの定規', ko: '길이 자' },
  protractor: { vi: 'Thước đo độ', en: 'Protractor', zh: '量角器', ja: '分度器', ko: '각도기' },
  'set-square-45': { vi: 'Êke 45°', en: '45° set square', zh: '45°三角板', ja: '45°三角定規', ko: '45° 삼각자' },
  'set-square-60': { vi: 'Êke 30°–60°', en: '30°–60° set square', zh: '30°–60°三角板', ja: '30°–60°三角定規', ko: '30°–60° 삼각자' },
  compass: { vi: 'Compa', en: 'Compass', zh: '圆规', ja: 'コンパス', ko: '컴퍼스' },
}

const LINE_TYPE_CHOICES: { id: WhiteboardLineType; cad: string; vi: string; en: string; zh: string; ja: string; ko: string }[] = [
  { id: 'continuous', cad: 'Continuous', vi: 'Nét liền', en: 'Continuous', zh: '实线', ja: '実線', ko: '실선' },
  { id: 'dashed', cad: 'Dashed', vi: 'Nét đứt', en: 'Dashed', zh: '虚线', ja: '破線', ko: '파선' },
  { id: 'center', cad: 'Center', vi: 'Đường tâm', en: 'Center', zh: '中心线', ja: '中心線', ko: '중심선' },
  { id: 'dashdot', cad: 'Dashdot', vi: 'Gạch chấm', en: 'Dash dot', zh: '点划线', ja: '一点鎖線', ko: '일점쇄선' },
]

const MAP_W = 168
const MAP_H = 112

const LINE_WEIGHTS = [
  { size: 2, sw: 1.15, vi: 'Nét mảnh', en: 'Thin', zh: '细线', ja: '細線', ko: '가는 선' },
  { size: 5, sw: 2.4, vi: 'Nét đậm', en: 'Thick', zh: '粗线', ja: '太線', ko: '굵은 선' },
] as const

function MenuGlyph({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="16" viewBox="0 0 24 16" className="mr-2 shrink-0 text-slate-700" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </svg>
  )
}

function SolidGlyph({ kind }: { kind: SolidKind }) {
  const icon = solidIcon(kind)
  return (
    <svg viewBox={icon.viewBox} className="h-9 w-9 text-slate-800" aria-hidden>
      <path d={icon.shown} fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <path d={icon.hidden} fill="none" stroke="currentColor" strokeWidth="7" strokeDasharray="12 9" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const SOLID_LABEL: Record<SolidKind, [string, string, string, string, string]> = {
  cube: ['Hình lập phương', 'Cube', '正方体', '立方体', '정육면체'],
  box: ['Hình hộp chữ nhật', 'Box', '长方体', '直方体', '직육면체'],
  'oblique-box': ['Hình hộp xiên', 'Oblique box', '斜四棱柱', '斜角柱', '비스듬한 기둥'],
  'tri-prism': ['Lăng trụ tam giác', 'Triangular prism', '三棱柱', '三角柱', '삼각기둥'],
  'hex-prism': ['Lăng trụ lục giác', 'Hexagonal prism', '六棱柱', '六角柱', '육각기둥'],
  tetra: ['Tứ diện', 'Tetrahedron', '四面体', '四面体', '정사면체'],
  'square-pyramid': ['Chóp tứ giác đều', 'Square pyramid', '正四棱锥', '正四角錐', '정사각뿔'],
  'hex-pyramid': ['Chóp lục giác', 'Hexagonal pyramid', '六棱锥', '六角錐', '육각뿔'],
  frustum: ['Chóp cụt', 'Frustum', '棱台', '角錐台', '각뿔대'],
  cylinder: ['Hình trụ', 'Cylinder', '圆柱', '円柱', '원기둥'],
  cone: ['Hình nón', 'Cone', '圆锥', '円錐', '원뿔'],
  'cone-frustum': ['Nón cụt', 'Truncated cone', '圆台', '円錐台', '원뿔대'],
  octa: ['Bát diện đều', 'Octahedron', '正八面体', '正八面体', '정팔면체'],
  sphere: ['Hình cầu', 'Sphere', '球', '球', '구'],
}

const SOLID_FIELD_LABEL: Record<string, [string, string, string, string, string]> = {
  'cube.a': ['Cạnh', 'Edge', '棱长', '辺', '모서리'],
  'box.a': ['Chiều dài', 'Length', '长', '長さ', '길이'],
  'box.b': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'box.c': ['Chiều rộng', 'Width', '宽', '幅', '너비'],
  'oblique-box.a': ['Chiều dài', 'Length', '长', '長さ', '길이'],
  'oblique-box.b': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'oblique-box.c': ['Chiều rộng', 'Width', '宽', '幅', '너비'],
  'oblique-box.s': ['Độ xiên', 'Slant', '斜偏', '傾き', '기울기'],
  'tri-prism.a': ['Cạnh đáy AB', 'Base AB', '底边 AB', '底辺 AB', '밑변 AB'],
  'tri-prism.b': ['Cạnh đáy BC', 'Base BC', '底边 BC', '底辺 BC', '밑변 BC'],
  'tri-prism.c': ['Cạnh đáy CA', 'Base CA', '底边 CA', '底辺 CA', '밑변 CA'],
  'tri-prism.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'hex-prism.a': ['Cạnh đáy', 'Base edge', '底边', '底辺', '밑변'],
  'hex-prism.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'tetra.a': ['Cạnh', 'Edge', '棱长', '辺', '모서리'],
  'square-pyramid.a': ['Cạnh đáy', 'Base edge', '底边', '底辺', '밑변'],
  'square-pyramid.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'hex-pyramid.a': ['Cạnh đáy', 'Base edge', '底边', '底辺', '밑변'],
  'hex-pyramid.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'frustum.a': ['Cạnh đáy lớn', 'Longer base', '下底', '下底', '아래 밑변'],
  'frustum.b': ['Cạnh đáy nhỏ', 'Shorter base', '上底', '上底', '위 밑변'],
  'frustum.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'cylinder.a': ['Đường kính đáy', 'Base diameter', '底面直径', '底面の直径', '밑면 지름'],
  'cylinder.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'cone.a': ['Đường kính đáy', 'Base diameter', '底面直径', '底面の直径', '밑면 지름'],
  'cone.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'cone-frustum.a': ['Đường kính đáy lớn', 'Larger base diameter', '下底直径', '下底の直径', '아래 밑면 지름'],
  'cone-frustum.b': ['Đường kính đáy nhỏ', 'Smaller base diameter', '上底直径', '上底の直径', '위 밑면 지름'],
  'cone-frustum.h': ['Chiều cao', 'Height', '高', '高さ', '높이'],
  'octa.a': ['Cạnh', 'Edge', '棱长', '辺', '모서리'],
  'sphere.a': ['Đường kính', 'Diameter', '直径', '直径', '지름'],
}

function RulerGlyph({ id }: { id: WhiteboardRulerKind }) {
  if (id === 'length') {
    return (
      <MenuGlyph>
        <line x1="1" y1="11" x2="23" y2="11" />
        <line x1="3" y1="11" x2="3" y2="6" />
        <line x1="8" y1="11" x2="8" y2="8" />
        <line x1="13" y1="11" x2="13" y2="6" />
        <line x1="18" y1="11" x2="18" y2="8" />
        <line x1="21" y1="11" x2="21" y2="6" />
      </MenuGlyph>
    )
  }
  if (id === 'protractor') {
    return (
      <MenuGlyph>
        <path d="M3 12 A9 9 0 0 1 21 12" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="12" x2="17" y2="5" />
      </MenuGlyph>
    )
  }
  if (id === 'set-square-45') {
    return (
      <MenuGlyph>
        <polygon points="3,13 21,13 3,3" />
      </MenuGlyph>
    )
  }
  if (id === 'set-square-60') {
    return (
      <MenuGlyph>
        <polygon points="2,13 22,13 8,3" />
      </MenuGlyph>
    )
  }
  return (
    <MenuGlyph>
      <circle cx="12" cy="3.2" r="1.3" fill="currentColor" stroke="none" />
      <line x1="12" y1="4.2" x2="6" y2="14" />
      <line x1="12" y1="4.2" x2="18" y2="14" />
      <circle cx="18" cy="14" r="1.1" />
    </MenuGlyph>
  )
}

function DimGlyph({ id }: { id: WhiteboardDimTool }) {
  if (id === 'quick') {
    return (
      <MenuGlyph>
        <line x1="2" y1="5" x2="2" y2="12" />
        <line x1="22" y1="5" x2="22" y2="12" />
        <line x1="2" y1="10" x2="8" y2="10" />
        <line x1="16" y1="10" x2="22" y2="10" />
        <path d="M13 3 L9 9 H12 L10 14 L16 7 H13 Z" fill="currentColor" stroke="none" />
      </MenuGlyph>
    )
  }
  if (id === 'linear') {
    return (
      <MenuGlyph>
        <line x1="3" y1="3" x2="3" y2="12" />
        <line x1="21" y1="3" x2="21" y2="12" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <path d="M6 9 L3 9 L6 7.4 M6 9 L3 9 L6 10.6 M18 9 L21 9 L18 7.4 M18 9 L21 9 L18 10.6" />
      </MenuGlyph>
    )
  }
  if (id === 'aligned') {
    return (
      <MenuGlyph>
        <line x1="3" y1="3" x2="7" y2="14" />
        <line x1="17" y1="2" x2="21" y2="13" />
        <line x1="4" y1="12" x2="20" y2="4" />
      </MenuGlyph>
    )
  }
  if (id === 'angular') {
    return (
      <MenuGlyph>
        <line x1="4" y1="13" x2="12" y2="3" />
        <line x1="12" y1="3" x2="21" y2="13" />
        <path d="M10 8 A4 4 0 0 1 15 8" />
      </MenuGlyph>
    )
  }
  if (id === 'arc') {
    return (
      <MenuGlyph>
        <path d="M3 12 A9 8 0 0 1 21 12" />
        <line x1="3" y1="12" x2="3" y2="15" />
        <line x1="21" y1="12" x2="21" y2="15" />
      </MenuGlyph>
    )
  }
  if (id === 'radius') {
    return (
      <MenuGlyph>
        <path d="M12 13 A7 7 0 0 1 19 6" />
        <line x1="5" y1="13" x2="16" y2="6" />
      </MenuGlyph>
    )
  }
  if (id === 'diameter') {
    return (
      <MenuGlyph>
        <circle cx="12" cy="8" r="5.5" />
        <line x1="7" y1="13" x2="17" y2="3" />
      </MenuGlyph>
    )
  }
  if (id === 'jogged') {
    return (
      <MenuGlyph>
        <path d="M14 12 A6 6 0 0 1 20 6" />
        <path d="M3 13 L8 8 L10 11 L14 7" />
      </MenuGlyph>
    )
  }
  if (id === 'ordinate') {
    return (
      <MenuGlyph>
        <circle cx="4" cy="11" r="1.2" fill="currentColor" stroke="none" />
        <path d="M4 11 H16 V4" />
      </MenuGlyph>
    )
  }
  if (id === 'continue') {
    return (
      <MenuGlyph>
        <line x1="2" y1="4" x2="2" y2="13" />
        <line x1="12" y1="4" x2="12" y2="13" />
        <line x1="22" y1="4" x2="22" y2="13" />
        <line x1="2" y1="9" x2="22" y2="9" />
      </MenuGlyph>
    )
  }
  return (
    <MenuGlyph>
      <line x1="3" y1="4" x2="3" y2="14" />
      <line x1="20" y1="4" x2="20" y2="8" />
      <line x1="20" y1="11" x2="20" y2="14" />
      <line x1="3" y1="6" x2="20" y2="6" />
      <line x1="3" y1="12" x2="20" y2="12" />
    </MenuGlyph>
  )
}

function LineTypeMark({ id, ink, weight = 2 }: { id: WhiteboardLineType; ink: string; weight?: number }) {
  const dash = WHITEBOARD_LINE_PATTERNS[id]
  return (
    <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden>
      <line
        x1="1"
        y1="8"
        x2="43"
        y2="8"
        stroke={ink}
        strokeWidth={weight}
        strokeLinecap="butt"
        strokeDasharray={dash.length ? dash.join(' ') : undefined}
      />
    </svg>
  )
}

function gridSides(sides: TriangleSides): TriangleSides {
  const one = (raw: string) => {
    const n = parseSideLength(raw)
    return n == null ? raw : formatWholeGrid(n)
  }
  return { ab: one(sides.ab), bc: one(sides.bc), ca: one(sides.ca) }
}

function worldSides(sides: TriangleSides): TriangleSides {
  const one = (raw: string) => {
    const n = parseSideLength(raw)
    return n == null ? raw : String(gridMeasureToWorld(n))
  }
  return { ab: one(sides.ab), bc: one(sides.bc), ca: one(sides.ca) }
}

function gridQuad(sides: QuadSides): QuadSides {
  const one = (raw: string) => {
    const n = parseSideLength(raw)
    return n == null ? raw : formatWholeGrid(n)
  }
  return { ab: one(sides.ab), bc: one(sides.bc), cd: one(sides.cd), da: one(sides.da) }
}

function wholeQuad(sides: QuadSides): QuadSides {
  const one = (raw: string) => {
    const n = parseSideLength(raw)
    return n == null ? raw : String(Math.max(1, Math.round(n)))
  }
  return { ab: one(sides.ab), bc: one(sides.bc), cd: one(sides.cd), da: one(sides.da) }
}

function worldQuad(sides: QuadSides): QuadSides {
  const one = (raw: string) => {
    const n = parseSideLength(raw)
    return n == null ? raw : String(gridMeasureToWorld(n))
  }
  return { ab: one(sides.ab), bc: one(sides.bc), cd: one(sides.cd), da: one(sides.da) }
}

function isEditableKeyTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

export type WhiteboardLivePointer = {
  boardChrome?: boolean
  relX?: number
  relY?: number
  worldX?: number
  worldY?: number
  click?: boolean
}

export type TeacherWhiteboardCanvasProps = {
  state: WhiteboardState
  onStateChange: (state: WhiteboardState) => void
  onBroadcast?: (msg: WhiteboardWireMessage) => void
  /** Chuột thật trên bảng. Máy này là chủ, máy khác vẽ chuột ảo đúng điểm thế giới. */
  onLivePointer?: (point: WhiteboardLivePointer | null) => void
  /** Máy vừa bấm chạy hoặc núm rung. Máy này phát nhịp, máy khác không tự đếm. */
  simHost?: boolean
  followedSimRef?: { current: number | null }
  onSim?: (sim: number) => void
  onClaimSim?: () => void
  readOnly?: boolean
  tr: Tr
  className?: string
}

export function TeacherWhiteboardCanvas({
  state,
  onStateChange,
  onBroadcast,
  onLivePointer,
  simHost = true,
  followedSimRef,
  onSim,
  onClaimSim,
  readOnly = false,
  tr,
  className,
}: TeacherWhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const onLivePointerRef = useRef(onLivePointer)
  onLivePointerRef.current = onLivePointer
  const mapRef = useRef<HTMLCanvasElement | null>(null)
  const mapCamRef = useRef<WhiteboardCamera | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const [tool, setTool] = useState<WhiteboardTool>('pen')
  const [textDraft, setTextDraft] = useState<{
    id: string
    x: number
    y: number
    width: number
    size: number
    color: string
    text: string
    fresh: boolean
  } | null>(null)
  const textDraftRef = useRef(textDraft)
  textDraftRef.current = textDraft
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const textSizeRef = useRef(WHITEBOARD_TEXT_SIZE)
  const textOpenAtRef = useRef(0)
  const [ruler, setRuler] = useState<WhiteboardRuler | null>(null)
  const rulerRef = useRef<WhiteboardRuler | null>(null)
  rulerRef.current = ruler
  const rulerDragRef = useRef<{ mode: RulerDragMode; gx: number; gy: number; ax: number; ay: number; baseAngle: number; pointerAngle: number } | null>(null)
  const [rulerMenu, setRulerMenu] = useState(false)
  const [solidMenu, setSolidMenu] = useState(false)
  const [solidKind, setSolidKind] = useState<SolidKind | null>(null)
  const solidKindRef = useRef<SolidKind | null>(null)
  solidKindRef.current = solidKind
  const [solidAsk, setSolidAsk] = useState<SolidKind | null>(null)
  const [figureMenu, setFigureMenu] = useState(false)
  const imageFileRef = useRef<HTMLInputElement | null>(null)
  const [imageError, setImageError] = useState('')
  const [imageTick, setImageTick] = useState(0)
  const [figurePick, setFigurePick] = useState<string | null>(null)
  const [figureParams, setFigureParams] = useState<FigureParams>({ variant: '', liquid: '#7dd3fc', level: 62, label: '', equation: '', tune: [], run: false, clock: 0, shift: 0 })
  const [solidFields, setSolidFields] = useState<Partial<Record<keyof SolidMeasures, string>>>({})
  const [solidError, setSolidError] = useState('')
  const solidMeasuresRef = useRef<SolidMeasures | null>(null)
  const [dimTool, setDimTool] = useState<WhiteboardDimTool | null>(null)
  const [dimMenu, setDimMenu] = useState(false)
  const [dimPicks, setDimPicks] = useState<WhiteboardPoint[]>([])
  const [dimCursor, setDimCursor] = useState<WhiteboardPoint | null>(null)
  const [dimChain, setDimChain] = useState<DimChain | null>(null)
  const [dimLine, setDimLine] = useState<DimLinePick | null>(null)
  const [dimLine2, setDimLine2] = useState<DimLinePick | null>(null)
  const [dimCircle, setDimCircle] = useState<DimCirclePick | null>(null)
  const [dimPoint, setDimPoint] = useState<WhiteboardPoint | null>(null)
  const [dimHold, setDimHold] = useState(false)
  const dimLineRef = useRef<DimLinePick | null>(null)
  const dimLine2Ref = useRef<DimLinePick | null>(null)
  const dimCircleRef = useRef<DimCirclePick | null>(null)
  const dimPointRef = useRef<WhiteboardPoint | null>(null)
  const dimHoldRef = useRef(false)
  const dimToolRef = useRef<WhiteboardDimTool | null>(null)
  const dimPicksRef = useRef<WhiteboardPoint[]>([])
  const dimChainRef = useRef<DimChain | null>(null)
  dimToolRef.current = dimTool
  dimChainRef.current = dimChain
  const rulerSnapRef = useRef(false)
  const [boardSize, setBoardSize] = useState({ w: 800, h: 600 })
  const [color, setColor] = useState<string>(WHITEBOARD_COLORS[0])
  const [brush, setBrush] = useState<(typeof LINE_WEIGHTS)[number]['size']>(2)
  const [lineType, setLineType] = useState<WhiteboardLineType>('continuous')
  const [lineMenu, setLineMenu] = useState(false)
  const [colorMenu, setColorMenu] = useState(false)
  const lineTypeRef = useRef<WhiteboardLineType>('continuous')
  lineTypeRef.current = lineType
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const marqueeRef = useRef<{ x0: number; y0: number; x1: number; y1: number; additive: boolean; pointer: string } | null>(null)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number; crossing: boolean } | null>(null)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const spaceToolRef = useRef<WhiteboardTool | null>(null)
  const [expr, setExpr] = useState('y=x^2')
  const [exprError, setExprError] = useState('')
  const [axisChoice, setAxisChoice] = useState('solo')
  const [axisMenu, setAxisMenu] = useState(false)
  const vertexAnchorRef = useRef<{ triangleId: string; vertex: 0 | 1 | 2; point: { x: number; y: number } } | null>(null)
  const endMarkRef = useRef<WhiteboardPoint | null>(null)
  const [lineAsk, setLineAsk] = useState<{
    id: string
    color: string
    size: number
    triangleId: string
    vertex: 0 | 1 | 2
    trianglePoints: { x: number; y: number }[]
    vertexNames: [string, string, string]
    fallbackPoints: { x: number; y: number }[]
  } | null>(null)
  const [triangleAsk, setTriangleAsk] = useState<{
    id: string
    color: string
    size: number
    corners: { x: number; y: number }[]
    rawPoints: { x: number; y: number }[]
    lineType: WhiteboardLineType
    restore: WhiteboardObject[]
  } | null>(null)
  const [triKind, setTriKind] = useState<TriangleKind>('scalene')
  const [triSides, setTriSides] = useState<TriangleSides>({ ab: '', bc: '', ca: '' })
  const [triError, setTriError] = useState('')
  const [quadAsk, setQuadAsk] = useState<{
    id: string
    color: string
    size: number
    corners: { x: number; y: number }[]
    measured: QuadSides
    sketchAngle: string
    keepShape: 'rect' | 'polygon'
    keepPoints: { x: number; y: number }[]
    rawPoints: { x: number; y: number }[]
    lineType: WhiteboardLineType
  } | null>(null)
  const [quadKind, setQuadKind] = useState<QuadKind>('square')
  const [quadSides, setQuadSides] = useState<QuadSides>({ ab: '', bc: '', cd: '', da: '' })
  const [quadAngle, setQuadAngle] = useState('90')
  const [quadError, setQuadError] = useState('')
  const [straightAsk, setStraightAsk] = useState<{
    id: string
    color: string
    size: number
    start: { x: number; y: number }
    end: { x: number; y: number }
    lineType?: WhiteboardLineType
    rawPoints?: { x: number; y: number }[]
  } | null>(null)
  const [straightLength, setStraightLength] = useState('')
  const [straightAngle, setStraightAngle] = useState('')
  const [straightError, setStraightError] = useState('')
  const [circleAsk, setCircleAsk] = useState<{
    id: string
    color: string
    size: number
    cx: number
    cy: number
    r: number
    rx: number
    ry: number
    rotation: number
    /** Trục dài của nét gốc nằm theo rx. */
    longOnRx: boolean
    lineType?: WhiteboardLineType
    rawPoints?: { x: number; y: number }[]
  } | null>(null)
  const [ovalKind, setOvalKind] = useState<'circle' | 'ellipse'>('circle')
  const [circleDiameter, setCircleDiameter] = useState('')
  const [ellipseMajor, setEllipseMajor] = useState('')
  const [ellipseMinor, setEllipseMinor] = useState('')
  const [circleError, setCircleError] = useState('')
  const settleOpenAskRef = useRef<() => void>(() => {})
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const drawRef = useRef<{ id: string; points: { x: number; y: number }[] } | null>(null)
  const panRef = useRef<{ x: number; y: number; cam: WhiteboardCamera } | null>(null)
  const pinchRef = useRef<{ dist: number; cam: WhiteboardCamera; mid: { x: number; y: number } } | null>(null)
  const cornerZoomRef = useRef<{
    oppSx: number
    oppSy: number
    startDist: number
    startScale: number
    cam: WhiteboardCamera
  } | null>(null)
  const dragRef = useRef<{ id: string; last: { x: number; y: number }; mode: 'move' | 'scale' | 'rotate'; frameId?: string } | null>(null)
  const fillPickRef = useRef<{ id: string; sx: number; sy: number; world: { x: number; y: number }; mode: 'move' | 'rotate' } | null>(null)
  const draftTimerRef = useRef<number | null>(null)
  const camTimerRef = useRef<number | null>(null)
  const simRef = useRef(0)
  const simHostRef = useRef(simHost)
  simHostRef.current = simHost
  const onSimRef = useRef(onSim)
  onSimRef.current = onSim
  const onClaimSimRef = useRef(onClaimSim)
  onClaimSimRef.current = onClaimSim
  const tuneDragRef = useRef<{ id: string; handle: string } | null>(null)

  const emit = useCallback((msg: WhiteboardWireMessage) => {
    onBroadcast?.(msg)
  }, [onBroadcast])

  const setState = useCallback((next: WhiteboardState, msg?: WhiteboardWireMessage) => {
    onStateChange(next)
    if (msg) emit(msg)
  }, [emit, onStateChange])

  const committedRef = useRef<{
    canvas: HTMLCanvasElement
    w: number
    h: number
    dpr: number
    camX: number
    camY: number
    camS: number
    grid: boolean
    selected: string
    objects: WhiteboardState['objects']
    textId: string
    imageTick: number
  } | null>(null)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const rect = wrap.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(rect.width))
    const h = Math.max(1, Math.floor(rect.height))
    const pxW = Math.floor(w * dpr)
    const pxH = Math.floor(h * dpr)
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW
      canvas.height = pxH
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const board = stateRef.current
    const selectedKey = selectedIds.join(',')
    const simulating = board.objects.some((item) => item.kind === 'figure' && figureSimulates(item.figure, item.params.variant, item.params.run))
    let cache = committedRef.current
    const cacheHit = !simulating && cache != null
      && cache.w === w && cache.h === h && cache.dpr === dpr
      && cache.camX === board.camera.x && cache.camY === board.camera.y && cache.camS === board.camera.scale
      && cache.grid === board.grid       && cache.selected === selectedKey
      && cache.objects === board.objects
      && cache.textId === (textDraft?.id ?? '')
      && cache.imageTick === imageTick
    if (!cacheHit) {
      const layer = cache?.canvas ?? document.createElement('canvas')
      layer.width = pxW
      layer.height = pxH
      const layerCtx = layer.getContext('2d')
      if (!layerCtx) return
      paintWhiteboard(layerCtx, {
        objects: textDraft ? board.objects.filter((item) => item.id !== textDraft.id) : board.objects,
        camera: board.camera,
        draft: null,
        grid: board.grid,
        selectedIds,
        width: w,
        height: h,
        dpr,
        simTime: simRef.current,
      })
      cache = {
        canvas: layer,
        w,
        h,
        dpr,
        camX: board.camera.x,
        camY: board.camera.y,
        camS: board.camera.scale,
        grid: board.grid,
        selected: selectedKey,
        objects: board.objects,
        textId: textDraft?.id ?? '',
        imageTick,
      }
      committedRef.current = cache
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, pxW, pxH)
    ctx.drawImage(cache.canvas, 0, 0)
    if (state.draft) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawDraft(ctx, state.draft, state.camera, w, h)
      if (selectedIds.includes(state.draft.id) && state.draft.points.length > 0) {
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        for (const p of state.draft.points) {
          const s = worldToScreen(p, state.camera, w, h)
          minX = Math.min(minX, s.x)
          minY = Math.min(minY, s.y)
          maxX = Math.max(maxX, s.x)
          maxY = Math.max(maxY, s.y)
        }
        ctx.save()
        ctx.strokeStyle = '#2563eb'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 3])
        ctx.strokeRect(minX - 6, minY - 6, Math.max(8, maxX - minX + 12), Math.max(8, maxY - minY + 12))
        ctx.restore()
      }
    }
    if (dimTool === 'angular' && dimLine) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const markLine = (line: DimLinePick) => {
        const sa = worldToScreen(line.a, state.camera, w, h)
        const sb = worldToScreen(line.b, state.camera, w, h)
        ctx.beginPath()
        ctx.moveTo(sa.x, sa.y)
        ctx.lineTo(sb.x, sb.y)
        ctx.stroke()
      }
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.setLineDash([])
      markLine(dimLine)
      if (dimLine2) markLine(dimLine2)
      ctx.restore()
      const arms = dimLine2 && dimCursor ? angleAtPlace(dimLine, dimLine2, dimCursor) : null
      if (arms) drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: 'angular', points: arms }, state.camera, w, h)
    } else if ((dimTool === 'radius' || dimTool === 'diameter' || dimTool === 'jogged' || dimTool === 'arc') && dimCircle && dimCursor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const center = worldToScreen({ x: dimCircle.cx, y: dimCircle.cy }, state.camera, w, h)
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(center.x, center.y, dimCircle.r * (state.camera.scale || 1), 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      const built = dimTool === 'arc' ? measurePickedArc(dimCircle, dimCursor) : measurePickedCircle(dimTool, dimCircle, dimCursor)
      if (built) drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: built.dim, points: built.points }, state.camera, w, h)
    } else if ((dimTool === 'linear' || dimTool === 'aligned' || dimTool === 'quick') && dimLine && dimCursor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sa = worldToScreen(dimLine.a, state.camera, w, h)
      const sb = worldToScreen(dimLine.b, state.camera, w, h)
      ctx.save()
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(sa.x, sa.y)
      ctx.lineTo(sb.x, sb.y)
      ctx.stroke()
      ctx.restore()
      const built = measurePickedLine(dimTool, dimLine, dimCursor)
      if (built) drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: built.dim, points: built.points }, state.camera, w, h)
    } else if (dimTool === 'ordinate' && dimPoint && dimCursor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const built = composeDim('ordinate', [dimPoint, dimCursor], null)
      if (built) drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: built.dim, points: built.points }, state.camera, w, h)
    } else if ((dimTool === 'continue' || dimTool === 'baseline') && dimHold && dimChain && dimCursor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const built = composeDim(dimTool, [dimCursor], dimChain)
      if (built) drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: built.dim, points: built.points }, state.camera, w, h)
    } else if (dimTool && dimCursor) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const built = composeDim(dimTool, [...dimPicks, dimCursor], dimChain)
      if (built) {
        drawWhiteboardDim(ctx, { kind: 'dim', id: 'preview', color, size: 2, dim: built.dim, points: built.points }, state.camera, w, h)
      } else if (dimPicks.length > 0) {
        const a = worldToScreen(dimPicks[dimPicks.length - 1], state.camera, w, h)
        const b = worldToScreen(dimCursor, state.camera, w, h)
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.25
        ctx.setLineDash([5, 4])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
        ctx.restore()
      }
    }
  }, [color, dimChain, dimCircle, dimCursor, dimHold, dimLine, dimLine2, dimPicks, dimPoint, dimTool, imageTick, selectedIds, state.camera, state.draft, state.grid, state.objects, textDraft])

  useEffect(() => {
    const simulating = state.objects.some((item) => item.kind === 'figure' && figureSimulates(item.figure, item.params.variant, item.params.run))
    if (!simulating) return
    let raf = 0
    let last = performance.now()
    let sent = 0
    const loop = (now: number) => {
      const still = stateRef.current.objects.some((item) => item.kind === 'figure' && figureSimulates(item.figure, item.params.variant, item.params.run))
      if (!still) {
        paint()
        return
      }
      if (simHostRef.current) {
        simRef.current += Math.min(0.05, (now - last) / 1000)
        last = now
        paint()
        if (now - sent > 90) {
          sent = now
          onSimRef.current?.(simRef.current)
        }
      } else {
        const followed = followedSimRef?.current
        if (typeof followed === 'number' && followed !== simRef.current) {
          simRef.current = followed
          paint()
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [followedSimRef, paint, state.objects])

  const paintMap = useCallback(() => {
    const canvas = mapRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const pxW = Math.floor(MAP_W * dpr)
    const pxH = Math.floor(MAP_H * dpr)
    if (canvas.width !== pxW || canvas.height !== pxH) {
      canvas.width = pxW
      canvas.height = pxH
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const viewW = Math.max(1, wrap.clientWidth)
    const viewH = Math.max(1, wrap.clientHeight)
    const bounds = whiteboardOverviewBounds(state.objects, state.camera, viewW, viewH)
    const cam = overviewCamera(bounds, MAP_W, MAP_H)
    mapCamRef.current = cam
    paintWhiteboard(ctx, {
      objects: state.objects,
      camera: cam,
      grid: false,
      width: MAP_W,
      height: MAP_H,
      dpr,
    })
    const scale = state.camera.scale || 1
    const a = worldToScreen({ x: state.camera.x - viewW / (2 * scale), y: state.camera.y - viewH / (2 * scale) }, cam, MAP_W, MAP_H)
    const b = worldToScreen({ x: state.camera.x + viewW / (2 * scale), y: state.camera.y + viewH / (2 * scale) }, cam, MAP_W, MAP_H)
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = 'rgba(37,99,235,0.16)'
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 1.5
    ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y))
    ctx.strokeRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  }, [imageTick, state.camera, state.objects])

  useEffect(() => {
    setWhiteboardImageRepaint(() => setImageTick((n) => n + 1))
    return () => setWhiteboardImageRepaint(null)
  }, [])

  useEffect(() => {
    if (!imageError) return
    const timer = window.setTimeout(() => setImageError(''), 4000)
    return () => window.clearTimeout(timer)
  }, [imageError])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    paintMap()
  }, [paintMap])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => {
      const w = Math.max(1, wrap.clientWidth)
      const h = Math.max(1, wrap.clientHeight)
      setBoardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }))
      paint()
      paintMap()
    })
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [paint, paintMap])

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const wrap = wrapRef.current
    if (!wrap) return { sx: 0, sy: 0, world: { x: 0, y: 0 } }
    const rect = wrap.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const world = screenToWorld(sx, sy, stateRef.current.camera, rect.width, rect.height)
    return { sx, sy, world }
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    let pending: PointerEvent | null = null
    const emitFrom = (e: PointerEvent, click: boolean) => {
      const report = onLivePointerRef.current
      if (!report) return
      const view = wrapRef.current
      if (view) {
        const rect = view.getBoundingClientRect()
        const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
        if (inside && rect.width > 1 && rect.height > 1) {
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, stateRef.current.camera, rect.width, rect.height)
          report({ worldX: world.x, worldY: world.y, click })
          return
        }
      }
      const rect = root.getBoundingClientRect()
      if (rect.width < 2 || rect.height < 2) return
      report({
        boardChrome: true,
        relX: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
        relY: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        click,
      })
    }
    const onMove = (e: PointerEvent) => {
      pending = e
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const event = pending
        pending = null
        if (event) emitFrom(event, false)
      })
    }
    const onDown = (e: PointerEvent) => emitFrom(e, true)
    const onLeave = (e: PointerEvent) => {
      const next = e.relatedTarget
      if (next instanceof Node && root.contains(next)) return
      onLivePointerRef.current?.(null)
    }
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const flushDraft = (draft: WhiteboardDraft | null) => {
    const next = { ...stateRef.current, draft }
    onStateChange(next)
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current)
    draftTimerRef.current = window.setTimeout(() => emit({ type: 'whiteboard-draft', draft }), 150)
  }

  const flushCamera = (camera: WhiteboardCamera) => {
    const nextCamera = { ...camera, scale: clampWhiteboardScale(camera.scale) }
    const next = { ...stateRef.current, camera: nextCamera, draft: stateRef.current.draft }
    onStateChange(next)
    if (camTimerRef.current) window.clearTimeout(camTimerRef.current)
    camTimerRef.current = window.setTimeout(() => emit({ type: 'whiteboard-camera', camera: nextCamera }), 80)
  }

  const jumpFromMap = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cam = mapCamRef.current
    if (!cam) return
    const rect = e.currentTarget.getBoundingClientRect()
    const sx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * MAP_W
    const sy = ((e.clientY - rect.top) / Math.max(1, rect.height)) * MAP_H
    const world = screenToWorld(sx, sy, cam, MAP_W, MAP_H)
    flushCamera({ ...stateRef.current.camera, x: world.x, y: world.y })
  }

  const cancelInk = () => {
    if (!drawRef.current && !stateRef.current.draft) return
    drawRef.current = null
    flushDraft(null)
  }

  const applyPinchFromClient = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const dist = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    if (!pinchRef.current) {
      pinchRef.current = { dist, cam: { ...stateRef.current.camera }, mid }
      return
    }
    const rect = wrap.getBoundingClientRect()
    const start = pinchRef.current
    flushCamera(cameraForPinchGesture(
      start.cam,
      { x: start.mid.x - rect.left, y: start.mid.y - rect.top },
      start.dist,
      { x: mid.x - rect.left, y: mid.y - rect.top },
      dist,
      rect.width,
      rect.height,
    ))
  }

  const zoomAround = (screen: { x: number; y: number }, nextScale: number) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    flushCamera(cameraZoomKeepingPoint(stateRef.current.camera, screen, nextScale, rect.width, rect.height))
  }

  const zoomByTen = (direction: 1 | -1) => {
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const pct = Math.round((stateRef.current.camera.scale || 1) * 100 + 1e-4)
    zoomAround({ x: rect.width / 2, y: rect.height / 2 }, whiteboardZoomStepPercent(pct, direction) / 100)
  }

  const pinchApiRef = useRef({ readOnly, cancelInk, applyPinchFromClient })
  pinchApiRef.current = { readOnly, cancelInk, applyPinchFromClient }

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const opts: AddEventListenerOptions = { passive: false, capture: true }
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      const api = pinchApiRef.current
      if (api.readOnly) return
      api.cancelInk()
      panRef.current = null
      dragRef.current = null
      fillPickRef.current = null
      if (!pinchRef.current) {
        api.applyPinchFromClient(
          { x: e.touches[0].clientX, y: e.touches[0].clientY },
          { x: e.touches[1].clientX, y: e.touches[1].clientY },
        )
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length < 2) return
      e.preventDefault()
      if (pinchApiRef.current.readOnly) return
      pinchApiRef.current.applyPinchFromClient(
        { x: e.touches[0].clientX, y: e.touches[0].clientY },
        { x: e.touches[1].clientX, y: e.touches[1].clientY },
      )
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null
    }
    const blockPageZoom = (e: Event) => {
      e.preventDefault()
    }
    wrap.addEventListener('touchstart', onTouchStart, opts)
    wrap.addEventListener('touchmove', onTouchMove, opts)
    wrap.addEventListener('touchend', onTouchEnd, opts)
    wrap.addEventListener('touchcancel', onTouchEnd, opts)
    wrap.addEventListener('gesturestart', blockPageZoom, opts)
    wrap.addEventListener('gesturechange', blockPageZoom, opts)
    wrap.addEventListener('gestureend', blockPageZoom, opts)
    return () => {
      wrap.removeEventListener('touchstart', onTouchStart, opts)
      wrap.removeEventListener('touchmove', onTouchMove, opts)
      wrap.removeEventListener('touchend', onTouchEnd, opts)
      wrap.removeEventListener('touchcancel', onTouchEnd, opts)
      wrap.removeEventListener('gesturestart', blockPageZoom, opts)
      wrap.removeEventListener('gesturechange', blockPageZoom, opts)
      wrap.removeEventListener('gestureend', blockPageZoom, opts)
    }
  }, [])

  const commitInk = (
    ink: { id: string; color: string; size: number; points: { x: number; y: number }[]; lineType?: WhiteboardLineType },
    restore?: WhiteboardObject[],
  ) => {
    for (const obj of restore ?? []) {
      const kept = obj.kind === 'graph' || obj.kind === 'dim' || (obj.kind === 'stroke' && obj.tool === 'eraser')
        ? obj
        : { ...obj, lineType: obj.lineType ?? 'continuous' }
      commitObject(kept)
    }
    commitObject({
      kind: 'stroke',
      id: ink.id,
      tool: 'pen',
      color: ink.color,
      size: ink.size,
      lineType: ink.lineType ?? 'continuous',
      points: ink.points.map((p) => ({ x: p.x, y: p.y })),
    })
  }

  const applyRegionFill = (id: string) => {
    const obj = stateRef.current.objects.find((item) => item.id === id)
    if (!obj || (obj.kind !== 'shape' && obj.kind !== 'stroke')) return
    if (obj.kind === 'stroke' && obj.tool === 'eraser') return
    if (obj.kind === 'shape' && obj.fillOnly && obj.fill === color) {
      const objects = stateRef.current.objects.filter((item) => item.id !== id)
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      setSelectedIds((ids) => ids.filter((item) => item !== id))
      setState(nextState, { type: 'whiteboard-remove', ids: [id] })
      return
    }
    const next = obj.fill === color ? { ...obj, fill: undefined } : { ...obj, fill: color }
    const objects = stateRef.current.objects.map((item) => (item.id === id ? next : item))
    const nextState = { ...stateRef.current, objects }
    stateRef.current = nextState
    setState(nextState, { type: 'whiteboard-upsert', object: next })
  }

  const paintClosedFace = (world: { x: number; y: number }) => {
    const objects = stateRef.current.objects
    const face = closedFaceAt(objects, world)
    const pocket = smallestFillPocket(objects, world)
    if (pocket && face) {
      const faceArea = polygonArea(face)
      const pocketArea = polygonArea(pocket.points)
      if (faceArea < pocketArea * 0.85) {
        const created = {
          kind: 'shape' as const,
          id: newWhiteboardId(),
          shape: 'polygon' as const,
          color,
          size: 1,
          fill: color,
          fillOnly: true,
          points: face,
        }
        const nextState = { ...stateRef.current, objects: [...objects, created] }
        stateRef.current = nextState
        setSelectedIds([created.id])
        selectedIdsRef.current = [created.id]
        setState(nextState, { type: 'whiteboard-upsert', object: created })
        return
      }
      applyRegionFill(pocket.id)
      return
    }
    if (pocket) {
      applyRegionFill(pocket.id)
      return
    }
    if (face) {
      const created = {
        kind: 'shape' as const,
        id: newWhiteboardId(),
        shape: 'polygon' as const,
        color,
        size: 1,
        fill: color,
        fillOnly: true,
        points: face,
      }
      const nextState = { ...stateRef.current, objects: [...objects, created] }
      stateRef.current = nextState
      setSelectedIds([created.id])
      selectedIdsRef.current = [created.id]
      setState(nextState, { type: 'whiteboard-upsert', object: created })
      return
    }
    const outline = hitTestTop(objects, world, 10 / (stateRef.current.camera.scale || 1))
    const region = topClosedRegion(objects, world)
    const outlineClosed = outline && isFillableObject(outline) ? outline : null
    const target = region && (!outline || outline.id === region.id) ? region : outlineClosed
    if (target && !(target.kind === 'shape' && target.fillOnly)) applyRegionFill(target.id)
  }

  const commitObject = (object: WhiteboardObject) => {
    if (draftTimerRef.current) {
      window.clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
    const stamped = stampLineType(object, lineTypeRef.current)
    const objects = [...stateRef.current.objects.filter((item) => item.id !== stamped.id), stamped]
    const next = { ...stateRef.current, objects, draft: null }
    stateRef.current = next
    setState(next, { type: 'whiteboard-upsert', object: stamped })
    emit({ type: 'whiteboard-draft', draft: null })
  }

  const finishText = (save: boolean) => {
    const draft = textDraftRef.current
    if (!draft) return
    textDraftRef.current = null
    setTextDraft(null)
    if (!save) return
    const text = (textAreaRef.current?.value ?? draft.text).replace(/\r\n/g, '\n').slice(0, 2000)
    if (!text.trim()) {
      if (!draft.fresh) {
        const objects = stateRef.current.objects.filter((item) => item.id !== draft.id)
        setState({ ...stateRef.current, objects, draft: null }, { type: 'whiteboard-remove', ids: [draft.id] })
        setSelectedIds((ids) => ids.filter((id) => id !== draft.id))
      }
      return
    }
    textSizeRef.current = draft.size
    commitObject({
      kind: 'text',
      id: draft.id,
      color: draft.color,
      size: draft.size,
      text,
      x: draft.x,
      y: draft.y,
      width: draft.width,
    })
    setSelectedIds([draft.id])
    selectedIdsRef.current = [draft.id]
  }

  const openTextAt = (world: WhiteboardPoint) => {
    const hit = hitTestTop(stateRef.current.objects, world, 8 / (stateRef.current.camera.scale || 1))
    const draft = hit && hit.kind === 'text'
      ? { id: hit.id, x: hit.x, y: hit.y, width: hit.width, size: hit.size, color: hit.color, text: hit.text, fresh: false }
      : {
          id: newWhiteboardId(),
          x: world.x,
          y: world.y,
          width: WHITEBOARD_TEXT_WIDTH,
          size: textSizeRef.current,
          color,
          text: '',
          fresh: true,
        }
    textDraftRef.current = draft
    textOpenAtRef.current = Date.now()
    setTextDraft(draft)
    setTool('text')
  }

  const clearDim = () => {
    dimToolRef.current = null
    dimPicksRef.current = []
    dimLineRef.current = null
    dimLine2Ref.current = null
    dimCircleRef.current = null
    dimPointRef.current = null
    dimHoldRef.current = false
    setDimTool(null)
    setDimPicks([])
    setDimLine(null)
    setDimLine2(null)
    setDimCircle(null)
    setDimPoint(null)
    setDimHold(false)
    setDimCursor(null)
    setDimMenu(false)
    setSolidMenu(false)
  }

  const disarmSolid = () => {
    solidKindRef.current = null
    solidMeasuresRef.current = null
    setSolidKind(null)
    setSolidMenu(false)
    setSolidAsk(null)
    setSolidError('')
  }

  const confirmSolid = () => {
    if (!solidAsk) return
    const measures: SolidMeasures = {}
    for (const key of SOLID_MEASURE_KEYS[solidAsk]) {
      const raw = (solidFields[key] ?? '').trim()
      if (!raw) {
        setSolidError(tr('Nhập đủ các kích thước', 'Enter every size', '请填写全部尺寸', '寸法をすべて入力', '치수를 모두 입력'))
        return
      }
      if (key === 's') {
        const slant = parseSolidSlant(raw)
        if (slant == null) {
          setSolidError(tr('Độ xiên phải là số', 'Slant must be a number', '斜偏须为数字', '傾きは数で', '기울기는 숫자여야 합니다'))
          return
        }
        measures.s = gridMeasureToWorld(slant)
        continue
      }
      const cells = parseSideLength(raw)
      if (cells == null) {
        setSolidError(tr('Kích thước phải là số dương', 'Each size must be a positive number', '尺寸须为正数', '寸法は正の数で', '치수는 양수여야 합니다'))
        return
      }
      measures[key] = gridMeasureToWorld(cells)
    }
    if (solidMeasureError(solidAsk, measures) === 'triangle') {
      setSolidError(tr('Ba cạnh đáy không dựng được tam giác', 'The base sides do not form a triangle', '三条底边不能构成三角形', '底辺が三角形になりません', '밑변이 삼각형이 되지 않습니다'))
      return
    }
    solidMeasuresRef.current = measures
    solidKindRef.current = solidAsk
    setSolidKind(solidAsk)
    setSolidAsk(null)
    setSolidError('')
    setTool('select')
  }

  const chooseDim = (next: WhiteboardDimTool) => {
    setRulerMenu(false)
    setLineMenu(false)
    setDimMenu(false)
    disarmSolid()
    if (dimToolRef.current === next) {
      clearDim()
      return
    }
    dimToolRef.current = next
    dimPicksRef.current = []
    dimLineRef.current = null
    dimLine2Ref.current = null
    dimCircleRef.current = null
    dimPointRef.current = null
    dimHoldRef.current = false
    setDimTool(next)
    setDimPicks([])
    setDimLine(null)
    setDimLine2(null)
    setDimCircle(null)
    setDimPoint(null)
    setDimHold(false)
    setDimCursor(null)
    setTool('select')
  }

  const engageFigureControl = (world: WhiteboardPoint) => {
    const hit = topFigureHandle(
      stateRef.current.objects,
      world,
      16 / (stateRef.current.camera.scale || 1),
      simRef.current,
    )
    if (!hit) return false
    setSelectedIds([hit.object.id])
    selectedIdsRef.current = [hit.object.id]
    if (hit.handle === 'one' || hit.handle === 'two') {
      const params = setWaveSources(hit.object.params, hit.handle === 'two')
      const nextObj = { ...hit.object, params }
      const objects = stateRef.current.objects.map((item) => (item.id === hit.object.id ? nextObj : item))
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      emit({ type: 'whiteboard-upsert', object: nextObj })
      onClaimSimRef.current?.()
      return true
    }
    if (hit.handle === 'push') {
      const params = toggleChemSwitch(hit.object.params)
      const nextObj = { ...hit.object, params }
      const objects = stateRef.current.objects.map((item) => (item.id === hit.object.id ? nextObj : item))
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      emit({ type: 'whiteboard-upsert', object: nextObj })
      onClaimSimRef.current?.()
      return true
    }
    if (hit.handle === 'valve') {
      const params = toggleTitrationValve(hit.object.params, figureClock(hit.object.params, simRef.current))
      const nextObj = { ...hit.object, params }
      const objects = stateRef.current.objects.map((item) => (item.id === hit.object.id ? nextObj : item))
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      emit({ type: 'whiteboard-upsert', object: nextObj })
      onClaimSimRef.current?.()
      return true
    }
    if (hit.handle === 'run') {
      const params = toggleFigureRun(hit.object.params, simRef.current)
      const nextObj = { ...hit.object, params }
      const objects = stateRef.current.objects.map((item) => (item.id === hit.object.id ? nextObj : item))
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      emit({ type: 'whiteboard-upsert', object: nextObj })
      onClaimSimRef.current?.()
      return true
    }
    tuneDragRef.current = { id: hit.object.id, handle: hit.handle }
    return true
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    setAxisMenu(false)
    setLineMenu(false)
    setDimMenu(false)
    setSolidMenu(false)
    setFigureMenu(false)
    setColorMenu(false)
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      cancelInk()
      panRef.current = null
      dragRef.current = null
      fillPickRef.current = null
      if (!pinchRef.current) {
        const pts = Array.from(pointersRef.current.values())
        applyPinchFromClient(pts[0], pts[1])
      }
      return
    }
    if (e.button === 1 || e.altKey) {
      panRef.current = { x: e.clientX, y: e.clientY, cam: stateRef.current.camera }
      return
    }
    const { sx, sy, world } = localPoint(e)
    if (e.button === 0 && engageFigureControl(world)) return
    if (tool === 'pan') {
      panRef.current = { x: e.clientX, y: e.clientY, cam: stateRef.current.camera }
      return
    }
    if (toolRef.current === 'text') {
      e.preventDefault()
      e.stopPropagation()
      if (textDraftRef.current) finishText(true)
      openTextAt(world)
      return
    }
    const pendingSolid = solidKindRef.current
    if (pendingSolid) {
      const measures = solidMeasuresRef.current
      const mesh = measures ? placeMeasuredSolid(pendingSolid, world, measures) : null
      if (!mesh) return
      commitObject({
        kind: 'shape',
        id: newWhiteboardId(),
        shape: 'solid',
        color,
        size: Math.max(brush, 1.6),
        points: mesh.points,
        solid: pendingSolid,
        solidEdges: mesh.edges,
        solidHidden: mesh.hidden,
        solidCorners: mesh.corners,
      })
      disarmSolid()
      setTool('select')
      return
    }
    if (dimToolRef.current) {
      const scale = stateRef.current.camera.scale || 1
      const active = dimToolRef.current
      const releasePick = () => {
        dimLineRef.current = null
        dimLine2Ref.current = null
        dimCircleRef.current = null
        dimPointRef.current = null
        dimHoldRef.current = false
        setDimLine(null)
        setDimLine2(null)
        setDimCircle(null)
        setDimPoint(null)
        setDimHold(false)
        setDimCursor(null)
      }
      const commitDim = (built: { dim: ComposedDim['dim']; points: ComposedDim['points']; chain: ComposedDim['chain'] } | null) => {
        if (!built) return
        commitObject({ kind: 'dim', id: newWhiteboardId(), color, size: 2, dim: built.dim, points: built.points })
        if (built.chain) {
          dimChainRef.current = built.chain
          setDimChain(built.chain)
        }
        releasePick()
      }
      if (active === 'angular') {
        const first = dimLineRef.current
        const second = dimLine2Ref.current
        if (first && second) {
          const arms = angleAtPlace(first, second, world)
          commitDim(arms ? composeDim('angular', arms, null) : null)
          return
        }
        const hit = nearestDimLine(stateRef.current.objects, world, 18 / scale)
        if (!hit) return
        const picked = { ...hit, at: world }
        if (!first) {
          dimLineRef.current = picked
          setDimLine(picked)
          return
        }
        if (sameDimLine(first, picked)) return
        dimLine2Ref.current = picked
        setDimLine2(picked)
        return
      }
      if (active === 'radius' || active === 'diameter' || active === 'jogged' || active === 'arc') {
        const chosen = dimCircleRef.current
        if (!chosen) {
          const hit = nearestDimCircle(stateRef.current.objects, world, 18 / scale)
          if (!hit) return
          dimCircleRef.current = hit
          setDimCircle(hit)
          return
        }
        const built = active === 'arc' ? measurePickedArc(chosen, world) : measurePickedCircle(active, chosen, world)
        commitDim(built)
        return
      }
      if (active === 'linear' || active === 'aligned' || active === 'quick') {
        const chosen = dimLineRef.current
        if (!chosen) {
          const hit = nearestDimLine(stateRef.current.objects, world, 18 / scale)
          if (!hit) return
          const picked = { ...hit, at: world }
          dimLineRef.current = picked
          setDimLine(picked)
          return
        }
        commitDim(measurePickedLine(active, chosen, world))
        return
      }
      if (active === 'ordinate') {
        const chosen = dimPointRef.current
        if (!chosen) {
          const thresh = 16 / scale
          const marked = nearestMarkedPoint(stateRef.current.objects, world, thresh)
          const snapped = snapToObjects(world, stateRef.current.objects, thresh)
          const grabbed = marked ?? (snapped.x !== world.x || snapped.y !== world.y ? snapped : null)
          if (!grabbed) return
          dimPointRef.current = grabbed
          setDimPoint(grabbed)
          return
        }
        commitDim(composeDim('ordinate', [chosen, world], null))
        return
      }
      if (active === 'continue' || active === 'baseline') {
        if (!dimHoldRef.current) {
          const hit = hitTestTop(stateRef.current.objects, world, 12 / scale)
          const chain = hit && hit.kind === 'dim' ? chainFromDim(hit) : null
          if (!chain) return
          dimChainRef.current = chain
          setDimChain(chain)
          dimHoldRef.current = true
          setDimHold(true)
          return
        }
        commitDim(composeDim(active, [world], dimChainRef.current))
        return
      }
    }
    if (tool === 'fill') {
      paintClosedFace(world)
      return
    }
    if (tool === 'text') {
      openTextAt(world)
      return
    }
    if (tool === 'pen' || tool === 'select') {
      const rect = wrapRef.current?.getBoundingClientRect()
      const label = rect
        ? hitMeasureLabel(stateRef.current.objects, sx, sy, stateRef.current.camera, rect.width, rect.height)
        : null
      const labeled = label ? stateRef.current.objects.find((item) => item.id === label.id) : null
      const touchLine = e.pointerType === 'touch'
        && labeled
        && labeled.kind === 'shape'
        && labeled.shape === 'line'
        && !labeled.triangleLine
      if (touchLine && labeled) {
        const nextIds = e.shiftKey
          ? selectedIdsRef.current.includes(labeled.id)
            ? selectedIdsRef.current.filter((id) => id !== labeled.id)
            : [...selectedIdsRef.current, labeled.id]
          : [labeled.id]
        setSelectedIds(nextIds)
        selectedIdsRef.current = nextIds
        setTool('select')
        if (!e.shiftKey) dragRef.current = { id: labeled.id, last: world, mode: 'move' }
        return
      }
      if (labeled && labeled.kind === 'shape' && labeled.shape === 'line' && !labeled.triangleLine && labeled.points.length >= 2) {
        const start = labeled.points[0]
        const end = labeled.points[labeled.points.length - 1]
        const measured = lineMeasure(start, end)
        setStraightLength(formatWholeGrid(measured.length))
        setStraightAngle(formatWholeAngle(measured.angleDeg))
        setStraightError('')
        setStraightAsk({ id: labeled.id, color: labeled.color, size: labeled.size, start, end, lineType: labeled.lineType ?? 'continuous' })
        return
      }
      if (labeled && labeled.kind === 'shape' && labeled.shape === 'circle' && labeled.cx != null && labeled.cy != null && labeled.r != null) {
        setOvalKind('circle')
        setCircleDiameter(formatWholeGrid(labeled.r * 2))
        setEllipseMajor(formatWholeGrid(labeled.r * 2))
        setEllipseMinor(formatWholeGrid(labeled.r * 2))
        setCircleError('')
        setCircleAsk({
          id: labeled.id,
          color: labeled.color,
          size: labeled.size,
          cx: labeled.cx,
          cy: labeled.cy,
          r: labeled.r,
          rx: labeled.r,
          ry: labeled.r,
          rotation: 0,
          longOnRx: true,
          lineType: labeled.lineType ?? 'continuous',
        })
        return
      }
    }
    if (tool === 'select') {
      const finger = e.pointerType === 'touch'
      const reach = (finger ? 18 : 10) / (stateRef.current.camera.scale || 1)
      const draft = stateRef.current.draft
      if (draft && hitTestDraft(draft, world, reach)) {
        selectedIdsRef.current = [draft.id]
        setSelectedIds([draft.id])
        return
      }
      const outline = hitTestTop(stateRef.current.objects, world, reach)
      if (e.detail >= 2 && outline && outline.kind === 'text') {
        openTextAt(world)
        return
      }
      const region = e.shiftKey ? null : topClosedRegion(stateRef.current.objects, world)
      const hit = outline ?? region
      const outlineClosed = outline && isFillableObject(outline) ? outline : null
      const fillTarget = region && (!outline || outline.id === region.id) ? region : outlineClosed
      fillPickRef.current = fillTarget
        ? { id: fillTarget.id, sx: e.clientX, sy: e.clientY, world, mode: e.ctrlKey ? 'rotate' : 'move' }
        : null
      if (hit) {
        const prev = selectedIdsRef.current
        const nextIds = e.shiftKey
          ? prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]
          : finger ? [hit.id] : prev.includes(hit.id) ? prev : [hit.id]
        setSelectedIds(nextIds)
        selectedIdsRef.current = nextIds
        if (nextIds.includes(hit.id) && !e.shiftKey && !fillTarget) {
          dragRef.current = { id: hit.id, last: world, mode: e.ctrlKey ? 'rotate' : 'move', frameId: hit.kind === 'graph' ? hit.frameId : undefined }
        }
      } else {
        marqueeRef.current = { x0: sx, y0: sy, x1: sx, y1: sy, additive: e.shiftKey, pointer: e.pointerType }
      }
      return
    }
    const anchor = tool === 'pen'
      ? nearestTriangleVertex(stateRef.current.objects, world, 18 / (stateRef.current.camera.scale || 1))
      : null
    const marked = tool === 'pen'
      ? nearestMarkedPoint(stateRef.current.objects, world, 18 / (stateRef.current.camera.scale || 1))
      : null
    vertexAnchorRef.current = anchor
    endMarkRef.current = null
    const onRuler = tool === 'pen' && rulerRef.current
      ? projectOnRuler(rulerRef.current, world, 18 / (stateRef.current.camera.scale || 1))
      : null
    rulerSnapRef.current = onRuler != null
    const start = marked ?? anchor?.point ?? onRuler ?? world
    if (tool === 'pen' || tool === 'eraser') settleOpenAskRef.current()
    const id = newWhiteboardId()
    drawRef.current = { id, points: [start] }
    flushDraft({ id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, lineType: tool === 'eraser' || lineType === 'continuous' ? undefined : lineType, points: [start] })
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (readOnly) return
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinchRef.current) {
      if (pointersRef.current.size >= 2) {
        const pts = Array.from(pointersRef.current.values())
        applyPinchFromClient(pts[0], pts[1])
      }
      return
    }
    if (cornerZoomRef.current) {
      const wrap = wrapRef.current
      if (!wrap) return
      const rect = wrap.getBoundingClientRect()
      const z = cornerZoomRef.current
      const dist = Math.hypot(e.clientX - rect.left - z.oppSx, e.clientY - rect.top - z.oppSy)
      const nextScale = z.startScale * (dist / Math.max(12, z.startDist))
      flushCamera(cameraZoomKeepingPoint(z.cam, { x: z.oppSx, y: z.oppSy }, nextScale, rect.width, rect.height))
      return
    }
    if (marqueeRef.current) {
      const m = marqueeRef.current
      m.x1 = e.clientX - (wrapRef.current?.getBoundingClientRect().left ?? 0)
      m.y1 = e.clientY - (wrapRef.current?.getBoundingClientRect().top ?? 0)
      const slop = m.pointer === 'touch' ? 36 : 6
      if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) >= slop) {
        setMarquee({ x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, crossing: m.x1 < m.x0 })
      }
      return
    }
    if (panRef.current) {
      const cam0 = panRef.current.cam
      const scale = cam0.scale || 1
      flushCamera({
        ...cam0,
        x: cam0.x - (e.clientX - panRef.current.x) / scale,
        y: cam0.y - (e.clientY - panRef.current.y) / scale,
      })
      return
    }
    const { world } = localPoint(e)
    if (tuneDragRef.current) {
      const drag = tuneDragRef.current
      const cur = stateRef.current.objects.find((item) => item.id === drag.id)
      if (!cur || cur.kind !== 'figure') return
      const params = moveFigureTune(cur.figure, cur.params, cur.w, cur.h, drag.handle, { x: world.x - cur.x, y: world.y - cur.y }, figureClock(cur.params, simRef.current))
      const objects = stateRef.current.objects.map((item) => (item.id === cur.id ? { ...cur, params } : item))
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      return
    }
    if (dimToolRef.current && !dragRef.current && !panRef.current) {
      setDimCursor(world)
      return
    }
    if (!dragRef.current && fillPickRef.current) {
      const pick = fillPickRef.current
      if (Math.hypot(e.clientX - pick.sx, e.clientY - pick.sy) < 6) return
      dragRef.current = { id: pick.id, last: pick.world, mode: pick.mode }
      fillPickRef.current = null
    }
    if (dragRef.current) {
      const cur = stateRef.current.objects.find((item) => item.id === dragRef.current?.id)
      if (!cur) return
      let target = world
      if (stateRef.current.grid && dragRef.current.mode === 'move') target = snapToGrid(world, WHITEBOARD_GRID)
      const dx = target.x - dragRef.current.last.x
      const dy = target.y - dragRef.current.last.y
      let next = cur
      if (dragRef.current.mode === 'move') next = translateObject(cur, dx, dy)
      else if (dragRef.current.mode === 'scale') {
        const origin = { x: cur.kind === 'graph' ? cur.origin.x : world.x - dx, y: cur.kind === 'graph' ? cur.origin.y : world.y - dy }
        const factor = 1 + (dx + dy) / 220
        next = scaleObject(cur, origin, factor)
      } else {
        next = rotateObject(cur, { x: world.x - dx, y: world.y - dy }, dx / 80)
      }
      dragRef.current.last = target
      const frameId = dragRef.current.frameId
      const movingMany = dragRef.current.mode === 'move'
      const selected = new Set(movingMany && selectedIdsRef.current.includes(cur.id) ? selectedIdsRef.current : [cur.id])
      if (frameId && (dragRef.current.mode === 'move' || dragRef.current.mode === 'scale')) {
        for (const item of stateRef.current.objects) {
          if (item.kind === 'graph' && item.frameId === frameId) selected.add(item.id)
        }
      }
      const objects = stateRef.current.objects.map((item) => {
        if (item.id === next.id) return next
        if (!selected.has(item.id)) return item
        if (dragRef.current?.mode === 'move') return translateObject(item, dx, dy)
        if (dragRef.current?.mode !== 'scale') return item
        const origin = { x: cur.kind === 'graph' ? cur.origin.x : world.x - dx, y: cur.kind === 'graph' ? cur.origin.y : world.y - dy }
        return scaleObject(item, origin, 1 + (dx + dy) / 220)
      })
      const nextState = { ...stateRef.current, objects }
      stateRef.current = nextState
      onStateChange(nextState)
      return
    }
    const drawing = drawRef.current
    if (!drawing) return
    let p = world
    if (rulerSnapRef.current && rulerRef.current && tool === 'pen') {
      const stuck = projectOnRuler(rulerRef.current, world, Number.POSITIVE_INFINITY)
      if (stuck) p = stuck
    } else if (tool === 'pen') {
      const thresh = 18 / (stateRef.current.camera.scale || 1)
      const hit = nearestMarkedPoint(stateRef.current.objects, world, thresh)
      const start = drawing.points[0]
      if (hit && (!start || dist(hit, start) > 4)) {
        p = hit
        endMarkRef.current = hit
      } else {
        const held = holdStrokeOnMark(drawing.points, endMarkRef.current, world, thresh)
        endMarkRef.current = held.mark
        if (held.mark) p = held.point
      }
    }
    const before = drawing.points.length
    appendInkPoint(drawing.points, p)
    if (drawing.points.length === before) return
    flushDraft({ id: drawing.id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, lineType: tool === 'eraser' || lineType === 'continuous' ? undefined : lineType, points: drawing.points.slice() })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    panRef.current = null
    cornerZoomRef.current = null
    if (marqueeRef.current) {
      const m = marqueeRef.current
      marqueeRef.current = null
      setMarquee(null)
      const slop = m.pointer === 'touch' ? 36 : 6
      const moved = Math.hypot(m.x1 - m.x0, m.y1 - m.y0) >= slop
      if (m.pointer === 'touch') {
        const scale = stateRef.current.camera.scale || 1
        const reach = 22 / scale
        const world0 = screenToWorld(
          m.x0,
          m.y0,
          stateRef.current.camera,
          wrapRef.current?.getBoundingClientRect().width ?? 1,
          wrapRef.current?.getBoundingClientRect().height ?? 1,
        )
        const draft = stateRef.current.draft
        const draftHit = !m.additive && draft && hitTestDraft(draft, world0, reach)
        const hit = draftHit ? null : hitTestTop(stateRef.current.objects, world0, reach)
        const id = draftHit && draft ? draft.id : hit?.id
        const nextIds = id ? [id] : []
        selectedIdsRef.current = nextIds
        setSelectedIds(nextIds)
        return
      }
      if (!moved) {
        const scale = stateRef.current.camera.scale || 1
        const reach = (m.pointer === 'touch' ? 18 : 10) / scale
        const worldUp = localPoint(e).world
        const draft = stateRef.current.draft
        if (!m.additive && draft && hitTestDraft(draft, worldUp, reach)) {
          selectedIdsRef.current = [draft.id]
          setSelectedIds([draft.id])
          return
        }
        const hit = hitTestTop(stateRef.current.objects, worldUp, reach)
        const prev = selectedIdsRef.current
        const nextIds = m.additive
          ? hit
            ? prev.includes(hit.id) ? prev.filter((id) => id !== hit.id) : [...prev, hit.id]
            : prev
          : hit
            ? [hit.id]
            : []
        selectedIdsRef.current = nextIds
        setSelectedIds(nextIds)
        return
      }
      const end = localPoint(e).world
      const start = screenToWorld(m.x0, m.y0, stateRef.current.camera, wrapRef.current?.getBoundingClientRect().width ?? 1, wrapRef.current?.getBoundingClientRect().height ?? 1)
      const crossing = m.pointer === 'touch' ? false : m.x1 < m.x0
      const ids = pickObjectsInMarquee(stateRef.current.objects, start, end, crossing)
      const nextIds = m.additive ? Array.from(new Set([...selectedIdsRef.current, ...ids])) : ids
      selectedIdsRef.current = nextIds
      setSelectedIds(nextIds)
      return
    }
    if (tuneDragRef.current) {
      const drag = tuneDragRef.current
      tuneDragRef.current = null
      const cur = stateRef.current.objects.find((item) => item.id === drag.id)
      if (cur && cur.kind === 'figure') {
        const params = releaseFigureTune(cur.figure, cur.params, drag.handle, figureClock(cur.params, simRef.current))
        const nextObj = { ...cur, params }
        const objects = stateRef.current.objects.map((item) => (item.id === cur.id ? nextObj : item))
        const nextState = { ...stateRef.current, objects }
        stateRef.current = nextState
        onStateChange(nextState)
        emit({ type: 'whiteboard-upsert', object: nextObj })
        onClaimSimRef.current?.()
      }
      return
    }
    const fillPick = fillPickRef.current
    fillPickRef.current = null
    if (fillPick && !dragRef.current) {
      applyRegionFill(fillPick.id)
      return
    }
    if (dragRef.current) {
      const frameId = dragRef.current.frameId
      const id = dragRef.current.id
      const mode = dragRef.current.mode
      dragRef.current = null
      const selected = new Set(mode === 'move' && selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id])
      if (frameId) {
        for (const item of stateRef.current.objects) {
          if (item.kind === 'graph' && item.frameId === frameId) selected.add(item.id)
        }
      }
      for (const obj of stateRef.current.objects) {
        if (selected.has(obj.id)) emit({ type: 'whiteboard-upsert', object: obj })
      }
      return
    }
    const drawing = drawRef.current
    drawRef.current = null
    rulerSnapRef.current = false
    if (!drawing || drawing.points.length < 2) {
      vertexAnchorRef.current = null
      endMarkRef.current = null
      flushDraft(null)
      return
    }
    vertexAnchorRef.current = null
    endMarkRef.current = null
    if (tool === 'pen') {
      drawing.points = clipStrokeEndToMark(drawing.points, stateRef.current.objects, 18 / (stateRef.current.camera.scale || 1))
    }
    const chord = drawing.points.length >= 2 ? Math.hypot(drawing.points[0].x - drawing.points[drawing.points.length - 1].x, drawing.points[0].y - drawing.points[drawing.points.length - 1].y) : 0
    const straight = chord >= 24 && pathLength(drawing.points) < chord * 1.35
    const entered = tool === 'pen' && straight
      ? triangleForStraightStroke(stateRef.current.objects, drawing.points, 18 / (stateRef.current.camera.scale || 1))
      : null
    const sketchDraft: WhiteboardDraft = {
      id: drawing.id,
      tool: 'pen',
      color,
      size: brush,
      lineType: lineTypeRef.current,
      points: drawing.points.map((p) => ({ x: p.x, y: p.y })),
    }
    if (entered) {
      flushDraft(sketchDraft)
      setLineAsk({
        id: drawing.id,
        color,
        size: brush,
        triangleId: entered.triangleId,
        vertex: entered.vertex,
        trianglePoints: entered.points.slice(0, 3),
        vertexNames: entered.vertexNames,
        fallbackPoints: drawing.points.slice(),
      })
      return
    }
    const recognized = tool === 'pen' ? recognizeStroke(drawing.points) : null
    if (recognized?.shape === 'triangle' && recognized.points.length >= 3) {
      const corners = recognized.points.slice(0, 3)
      const measured = sidesFromSketch(corners)
      const ab = parseSideLength(measured.ab) ?? 1
      const bc = parseSideLength(measured.bc) ?? 1
      const ca = parseSideLength(measured.ca) ?? 1
      const kind = guessTriangleKind(ab, bc, ca)
      flushDraft(sketchDraft)
      setTriKind(kind)
      setTriSides(settleTriangleSides(kind, gridSides(measured), 'bc'))
      setTriError('')
      setTriangleAsk({
        id: drawing.id,
        color,
        size: brush,
        corners,
        rawPoints: drawing.points.map((p) => ({ x: p.x, y: p.y })),
        lineType: lineTypeRef.current,
        restore: [],
      })
      return
    }
    const quadCorners = recognized ? cornersOfQuad(recognized.shape, recognized.points) : null
    if (quadCorners && recognized) {
      const measured = sidesFromQuadSketch(quadCorners)
      const kind = guessQuadKind(quadCorners)
      const cornerAngle = String(angleAtCorner(quadCorners, 0))
      flushDraft(sketchDraft)
      setQuadKind(kind)
      setQuadSides(gridQuad(fillQuadSides(kind, measured, 'ab')))
      setQuadAngle(kind === 'square' || kind === 'rectangle' ? '90' : kind === 'trapezoid' ? formatWholeGrid(trapezoidHeight(quadCorners)) : cornerAngle)
      setQuadError('')
      setQuadAsk({
        id: drawing.id,
        color,
        size: brush,
        corners: quadCorners,
        measured,
        sketchAngle: cornerAngle,
        keepShape: recognized.shape === 'rect' ? 'rect' : 'polygon',
        keepPoints: recognized.points.map((p) => ({ x: p.x, y: p.y })),
        rawPoints: drawing.points.map((p) => ({ x: p.x, y: p.y })),
        lineType: lineTypeRef.current,
      })
      return
    }
    const object: WhiteboardObject = recognized
      ? { ...recognized, id: drawing.id, color, size: brush }
      : { kind: 'stroke', id: drawing.id, tool: tool === 'eraser' ? 'eraser' : 'pen', color, size: brush, points: drawing.points }
    const snapRadius = 56 / (stateRef.current.camera.scale || 1)
    const triJoined = tool === 'pen' ? joinThreeStrokeTriangle(stateRef.current.objects, object, snapRadius) : null
    if (triJoined) {
      const drop = new Set(triJoined.removeIds)
      const restore = stateRef.current.objects.filter((item) => drop.has(item.id))
      flushDraft(sketchDraft)
      const measured = sidesFromSketch(triJoined.corners)
      const ab = parseSideLength(measured.ab) ?? 1
      const bc = parseSideLength(measured.bc) ?? 1
      const ca = parseSideLength(measured.ca) ?? 1
      const kind = guessTriangleKind(ab, bc, ca)
      setTriKind(kind)
      setTriSides(settleTriangleSides(kind, gridSides(measured), 'bc'))
      setTriError('')
      setTriangleAsk({
        id: drawing.id,
        color,
        size: brush,
        corners: triJoined.corners,
        rawPoints: drawing.points.map((p) => ({ x: p.x, y: p.y })),
        lineType: lineTypeRef.current,
        restore,
      })
      return
    }
    const joined = tool === 'pen'
      ? joinThreeStrokeArrow(stateRef.current.objects, object, snapRadius)
      : null
    if (joined) {
      if (draftTimerRef.current) {
        window.clearTimeout(draftTimerRef.current)
        draftTimerRef.current = null
      }
      const drop = new Set(joined.removeIds)
      const arrow = stampLineType(joined.arrow, lineTypeRef.current)
      const objects = [
        ...stateRef.current.objects.filter((item) => !drop.has(item.id) && item.id !== arrow.id),
        arrow,
      ]
      const next = { ...stateRef.current, objects, draft: null }
      stateRef.current = next
      setState(next, { type: 'whiteboard-remove', ids: joined.removeIds })
      emit({ type: 'whiteboard-upsert', object: arrow })
      emit({ type: 'whiteboard-draft', draft: null })
      return
    }
    if (e.pointerType === 'touch' && recognized?.shape === 'line') {
      const reach = 22 / (stateRef.current.camera.scale || 1)
      const near = hitTestTop(stateRef.current.objects, drawing.points[0], reach)
      const moved = pathLength(drawing.points)
      if (near && near.kind === 'shape' && near.shape === 'line' && !near.triangleLine && moved < 48) {
        flushDraft(null)
        setSelectedIds([near.id])
        selectedIdsRef.current = [near.id]
        setTool('select')
        return
      }
    }
    if (recognized?.shape === 'line' && recognized.points.length >= 2) {
      const [start, end] = pinLineEnds(
        recognized.points[0],
        recognized.points[recognized.points.length - 1],
        stateRef.current.objects,
        48,
      )
      const measured = lineMeasure(start, end)
      setStraightLength(formatWholeGrid(measured.length))
      setStraightAngle(formatWholeAngle(measured.angleDeg))
      setStraightError('')
      setStraightAsk({
        id: drawing.id,
        color,
        size: brush,
        start,
        end,
        lineType: lineTypeRef.current,
        rawPoints: drawing.points.map((p) => ({ x: p.x, y: p.y })),
      })
      flushDraft(sketchDraft)
      return
    }
    if (
      recognized
      && (recognized.shape === 'circle' || recognized.shape === 'ellipse')
      && recognized.cx != null
      && recognized.cy != null
      && (recognized.r != null || (recognized.rx != null && recognized.ry != null))
    ) {
      const rx = recognized.rx ?? recognized.r ?? 1
      const ry = recognized.ry ?? recognized.r ?? rx
      const r = recognized.r ?? (rx + ry) / 2
      const longOnRx = rx >= ry
      setOvalKind(recognized.shape === 'ellipse' ? 'ellipse' : 'circle')
      setCircleDiameter(formatWholeGrid(r * 2))
      setEllipseMajor(formatWholeGrid((longOnRx ? rx : ry) * 2))
      setEllipseMinor(formatWholeGrid((longOnRx ? ry : rx) * 2))
      setCircleError('')
      setCircleAsk({
        id: drawing.id,
        color,
        size: brush,
        cx: recognized.cx,
        cy: recognized.cy,
        r,
        rx,
        ry,
        rotation: recognized.rotation ?? 0,
        longOnRx,
        lineType: lineTypeRef.current,
        rawPoints: drawing.points.map((p) => ({ x: p.x, y: p.y })),
      })
      flushDraft(sketchDraft)
      return
    }
    commitObject(object)
    selectedIdsRef.current = [object.id]
    setSelectedIds([object.id])
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    const { sx, sy } = localPoint(e)
    zoomAround({ x: sx, y: sy }, stateRef.current.camera.scale * factor)
  }

  const onCornerPointerDown = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const wrap = wrapRef.current
    if (!wrap) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = wrap.getBoundingClientRect()
    const opp =
      corner === 'nw' ? { x: rect.width, y: rect.height }
      : corner === 'ne' ? { x: 0, y: rect.height }
      : corner === 'sw' ? { x: rect.width, y: 0 }
      : { x: 0, y: 0 }
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    cornerZoomRef.current = {
      oppSx: opp.x,
      oppSy: opp.y,
      startDist: Math.hypot(sx - opp.x, sy - opp.y),
      startScale: stateRef.current.camera.scale,
      cam: { ...stateRef.current.camera },
    }
  }

  const onCornerPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!cornerZoomRef.current) return
    const wrap = wrapRef.current
    if (!wrap) return
    const rect = wrap.getBoundingClientRect()
    const z = cornerZoomRef.current
    const dist = Math.hypot(e.clientX - rect.left - z.oppSx, e.clientY - rect.top - z.oppSy)
    flushCamera(cameraZoomKeepingPoint(z.cam, { x: z.oppSx, y: z.oppSy }, z.startScale * (dist / Math.max(12, z.startDist)), rect.width, rect.height))
  }

  const onCornerPointerUp = () => {
    cornerZoomRef.current = null
  }

  const addGraph = () => {
    const spatial = parseSpatialInput(expr)
    if (spatial) {
      const item = figureItem('spatial')
      if (!item) return
      setExprError('')
      const id = newWhiteboardId()
      const cam = stateRef.current.camera
      const spot = placeWhiteboardImage(
        stateRef.current.objects,
        cam,
        item.w,
        item.h,
        wrapRef.current?.clientWidth || 800,
        wrapRef.current?.clientHeight || 600,
      )
      commitObject({
        kind: 'figure',
        id,
        color,
        figure: 'spatial',
        x: spot.x,
        y: spot.y,
        w: item.w,
        h: item.h,
        params: {
          ...freshFigureParams(item),
          equation: spatial,
          variant: item.variants.find((row) => row.sample === spatial.replace(/\s/g, ''))?.id || 'paraboloid',
        },
      })
      setSelectedIds([id])
      setAxisMenu(false)
      setFigureMenu(false)
      return
    }
    const parsed = parsePlotInput(expr)
    if (!parsed) {
      setExprError(tr('Công thức không đọc được', 'Could not parse the formula', '无法解析公式', '式を解析できません', '수식을 읽지 못했습니다'))
      return
    }
    setExprError('')
    const graphs = stateRef.current.objects.filter((item): item is WhiteboardGraph => item.kind === 'graph')
    const host = graphs.find((item) => item.id === axisChoice)
    let frameId = newWhiteboardId()
    let origin = mathToWorld({ x: 0, y: 0 }, { x: state.camera.x, y: state.camera.y }, 1)
    let unit = 40
    if (host) {
      frameId = host.frameId || newWhiteboardId()
      origin = { ...host.origin }
      unit = host.unit
      if (!host.frameId) commitObject({ ...host, frameId })
    }
    const object: WhiteboardObject = {
      kind: 'graph',
      id: newWhiteboardId(),
      color,
      axis: parsed.axis,
      expr: parsed.source,
      origin,
      unit,
      frameId,
    }
    commitObject(object)
    setSelectedIds([object.id])
    setAxisMenu(false)
    setFigureMenu(false)
  }

  const undo = () => {
    const last = stateRef.current.objects[stateRef.current.objects.length - 1]
    if (!last) return
    const objects = stateRef.current.objects.slice(0, -1)
    setState({ ...stateRef.current, objects, draft: null }, { type: 'whiteboard-remove', ids: [last.id] })
    setSelectedIds((ids) => ids.filter((id) => id !== last.id))
  }

  const clearAll = () => {
    setSelectedIds([])
    setState({ ...stateRef.current, objects: [], draft: null }, { type: 'whiteboard-clear' })
  }

  const removeSelected = () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    const draft = stateRef.current.draft
    const dropDraft = Boolean(draft && ids.includes(draft.id))
    const objectIds = ids.filter((id) => !draft || id !== draft.id)
    const drop = new Set(objectIds)
    const objects = objectIds.length > 0
      ? stateRef.current.objects.filter((item) => !drop.has(item.id))
      : stateRef.current.objects
    const nextDraft = dropDraft ? null : draft
    if (objectIds.length > 0) {
      setState({ ...stateRef.current, objects, draft: nextDraft }, { type: 'whiteboard-remove', ids: objectIds })
    } else {
      setState({ ...stateRef.current, objects, draft: nextDraft })
    }
    if (dropDraft) emit({ type: 'whiteboard-draft', draft: null })
    selectedIdsRef.current = []
    setSelectedIds([])
  }

  const toggleGrid = () => {
    const grid = !stateRef.current.grid
    setState({ ...stateRef.current, grid }, { type: 'whiteboard-grid', grid })
  }

  const closeFigure = () => {
    setFigureMenu(false)
    setFigurePick(null)
  }

  const insertFigure = () => {
    const item = figurePick ? figureItem(figurePick) : null
    if (!item) return
    const id = newWhiteboardId()
    const cam = stateRef.current.camera
    const spot = placeWhiteboardImage(
      stateRef.current.objects,
      cam,
      item.w,
      item.h,
      wrapRef.current?.clientWidth || 800,
      wrapRef.current?.clientHeight || 600,
    )
    commitObject({
      kind: 'figure',
      id,
      color,
      figure: item.id,
      x: spot.x,
      y: spot.y,
      w: item.w,
      h: item.h,
      params: figureParams,
    })
    setSelectedIds([id])
    setFigurePick(null)
    setFigureMenu(false)
    setTool('select')
  }

  const insertPickedImage = async (file: File) => {
    const packed = await compressWhiteboardImage(file)
    if (!packed) {
      setImageError(tr('Không chèn được ảnh này', 'This image could not be inserted', '无法插入这张图片', 'この画像は挿入できません', '이 이미지는 넣을 수 없습니다'))
      return
    }
    const cam = stateRef.current.camera
    const spot = placeWhiteboardImage(
      stateRef.current.objects,
      cam,
      packed.w,
      packed.h,
      wrapRef.current?.clientWidth || 800,
      wrapRef.current?.clientHeight || 600,
    )
    const id = newWhiteboardId()
    commitObject({ kind: 'image', id, src: packed.src, x: spot.x, y: spot.y, w: packed.w, h: packed.h })
    setSelectedIds([id])
    setImageError('')
    setFigureMenu(false)
    setTool('select')
  }

  const keysRef = useRef({
    undo,
    clearAll,
    removeSelected,
    toggleGrid,
    zoomByTen,
    flushCamera,
    setTool,
    setBrush,
    setSelectedIds,
    clearDim,
    disarmSolid,
    closeFigure,
    discardOpenAsk: () => {},
  })
  const discardOpenAsk = () => {
    if (!straightAsk && !circleAsk && !triangleAsk && !quadAsk && !lineAsk) return
    const next = { ...stateRef.current, draft: null }
    stateRef.current = next
    flushDraft(null)
    setStraightAsk(null)
    setCircleAsk(null)
    setTriangleAsk(null)
    setQuadAsk(null)
    setLineAsk(null)
    setStraightError('')
    setCircleError('')
    setTriError('')
    setQuadError('')
  }
  const panFromAsk = () => {
    discardOpenAsk()
    clearDim()
    disarmSolid()
    setTool('pan')
  }
  const askJump = (next: 'select' | 'pen' | 'eraser' | 'text' | 'fill') => {
    discardOpenAsk()
    clearDim()
    disarmSolid()
    setTool(next)
  }
  const askChip = (next: 'select' | 'pen' | 'eraser' | 'text' | 'fill', label: string, icon: ReactNode) => (
    <button key={next} type="button" className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[12px] text-slate-700" title={tr('Hủy nét và chuyển công cụ', 'Discard the stroke and switch tool', '取消笔迹并切换工具', '線を消してツール切替', '획을 지우고 도구 전환')} onClick={() => askJump(next)}>
      {icon}
      {label}
    </button>
  )
  const askDialogHead = (title: ReactNode) => (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{title}</p>
        <button type="button" className="shrink-0 rounded p-0.5 text-slate-500 hover:bg-slate-100" aria-label={tr('Đóng', 'Close', '关闭', '閉じる', '닫기')} title={tr('Đóng và hủy nét', 'Close and discard the stroke', '关闭并取消笔迹', '閉じて線を消す', '닫고 획 지우기')} onClick={discardOpenAsk}><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {askChip('select', tr('Chọn', 'Select', '选择', '選択', '선택'), <MousePointer2 className="h-3.5 w-3.5" aria-hidden />)}
        {askChip('pen', tr('Vẽ', 'Draw', '画笔', '描画', '그리기'), <PenLine className="h-3.5 w-3.5" aria-hidden />)}
        {askChip('eraser', tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기'), <Eraser className="h-3.5 w-3.5" aria-hidden />)}
        <button type="button" className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 text-[12px] text-slate-700" title={tr('Hủy nét và chuyển Pan', 'Discard the stroke and pan', '取消笔迹并平移', '線を消してパン', '획을 지우고 이동')} onClick={panFromAsk}><Hand className="h-3.5 w-3.5" aria-hidden />{tr('Pan', 'Pan', '平移', 'パン', '이동')}</button>
        {askChip('text', tr('Chữ', 'Text', '文字', '文字', '글자'), <Type className="h-3.5 w-3.5" aria-hidden />)}
        {askChip('fill', tr('Tô', 'Fill', '填充', '塗り', '칠'), <PaintBucket className="h-3.5 w-3.5" aria-hidden />)}
      </div>
    </>
  )
  keysRef.current = {
    undo,
    clearAll,
    removeSelected,
    toggleGrid,
    zoomByTen,
    flushCamera,
    setTool,
    setBrush,
    setSelectedIds,
    clearDim,
    disarmSolid,
    closeFigure,
    discardOpenAsk,
  }

  useEffect(() => {
    if (readOnly) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableKeyTarget(e.target)) return
      const api = keysRef.current
      const key = e.key
      const lower = key.toLowerCase()
      const cmd = e.ctrlKey || e.metaKey

      if (cmd && lower === 'z' && !e.shiftKey) {
        e.preventDefault()
        api.undo()
        return
      }
      if (cmd && e.shiftKey && (key === 'Delete' || key === 'Backspace')) {
        e.preventDefault()
        api.clearAll()
        return
      }
      if (key === 'Delete' || key === 'Backspace') {
        e.preventDefault()
        api.removeSelected()
        return
      }
      if (cmd && (key === '+' || key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        api.zoomByTen(1)
        return
      }
      if (cmd && (key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        api.zoomByTen(-1)
        return
      }
      if (cmd && (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        api.flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })
        return
      }
      if (cmd) return

      if (key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat && toolRef.current !== 'pan') {
          spaceToolRef.current = toolRef.current
          api.discardOpenAsk()
          api.setTool('pan')
        }
        return
      }
      if (lower === 'b' || lower === 'p') {
        api.clearDim()
        api.disarmSolid()
        api.setTool('pen')
        return
      }
      if (lower === 'e') {
        api.clearDim()
        api.disarmSolid()
        api.setTool('eraser')
        return
      }
      if (lower === 'f') {
        api.clearDim()
        api.disarmSolid()
        api.setTool('fill')
        return
      }
      if (lower === 't') {
        api.clearDim()
        api.disarmSolid()
        api.setTool('text')
        return
      }
      if (lower === 'v') {
        api.clearDim()
        api.disarmSolid()
        api.setTool('select')
        return
      }
      if (lower === 'h') {
        api.clearDim()
        api.disarmSolid()
        api.discardOpenAsk()
        api.setTool('pan')
        return
      }
      if (lower === 'g') {
        api.toggleGrid()
        return
      }
      if (key === '1') {
        api.setBrush(2)
        return
      }
      if (key === '2') {
        api.setBrush(5)
        return
      }
      if (key === '-' || key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault()
        api.zoomByTen(-1)
        return
      }
      if (key === '+' || key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault()
        api.zoomByTen(1)
        return
      }
      if (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault()
        api.flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })
        return
      }
      if (key === 'Escape') {
        if (dimToolRef.current && (dimPicksRef.current.length > 0 || dimLineRef.current || dimLine2Ref.current || dimCircleRef.current || dimPointRef.current || dimHoldRef.current)) {
          dimPicksRef.current = []
          dimLineRef.current = null
          dimLine2Ref.current = null
          dimCircleRef.current = null
          dimPointRef.current = null
          dimHoldRef.current = false
          setDimPicks([])
          setDimLine(null)
          setDimLine2(null)
          setDimCircle(null)
          setDimPoint(null)
          setDimHold(false)
          setDimCursor(null)
        } else {
          api.clearDim()
        }
        api.disarmSolid()
        api.closeFigure()
        api.setSelectedIds([])
        api.setTool('select')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const prev = spaceToolRef.current
      spaceToolRef.current = null
      if (prev) keysRef.current.setTool(prev)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [readOnly])

  const confirmTriangle = () => {
    if (!triangleAsk) return
    const err = triangleSideError(triKind, triSides)
    if (err === 'missing') {
      setTriError(tr('Nhập đủ độ dài AB, BC, CA', 'Enter all of AB, BC, CA', '请填写 AB、BC、CA', 'AB・BC・CA を入力', 'AB, BC, CA를 입력'))
      return
    }
    if (err === 'inequality') {
      setTriError(tr('Ba cạnh không dựng được tam giác', 'These sides do not form a triangle', '三边不能构成三角形', '三角形になりません', '삼각형이 되지 않습니다'))
      return
    }
    if (err === 'equilateral') {
      setTriError(tr('Tam giác đều cần ba cạnh bằng nhau', 'An equilateral triangle needs three equal sides', '等边三角形三边相等', '正三角形は三辺が等しい', '정삼각형은 세 변이 같습니다'))
      return
    }
    if (err === 'isosceles') {
      setTriError(tr('Tam giác cân cần AB = AC', 'An isosceles triangle needs AB = AC', '等腰三角形需要 AB = AC', '二等辺三角形は AB = AC', '이등변삼각형은 AB = AC'))
      return
    }
    if (err === 'right' || err === 'right-isosceles') {
      setTriError(tr('Góc vuông tại C: AB² = BC² + CA²', 'Right angle at C: AB² = BC² + CA²', '直角在 C：AB² = BC² + CA²', '直角は C：AB² = BC² + CA²', '직각은 C: AB² = BC² + CA²'))
      return
    }
    const points = placeTriangle({ kind: triKind, ...worldSides(triSides) }, triangleAsk.corners)
    if (!points) {
      setTriError(tr('Ba cạnh không dựng được tam giác', 'These sides do not form a triangle', '三边不能构成三角形', '三角形になりません', '삼각형이 되지 않습니다'))
      return
    }
    const dropIds = triangleAsk.restore.map((item) => item.id)
    if (dropIds.length > 0) {
      const objects = stateRef.current.objects.filter((item) => !dropIds.includes(item.id))
      const cleared = { ...stateRef.current, objects }
      stateRef.current = cleared
      setState(cleared, { type: 'whiteboard-remove', ids: dropIds })
    }
    commitObject({
      kind: 'shape',
      id: triangleAsk.id,
      shape: 'triangle',
      color: triangleAsk.color,
      size: triangleAsk.size,
      points,
      vertexNames: freshVertexNames(stateRef.current.objects),
      triangle: { kind: triKind, ...triSides },
    })
    setTriangleAsk(null)
  }

  const confirmQuad = () => {
    if (!quadAsk) return
    const storedAngle = quadKind === 'square' || quadKind === 'rectangle' ? '90' : quadAngle
    const placeAngle = quadKind === 'trapezoid' ? String(gridMeasureToWorld(parseSideLength(quadAngle) ?? 0)) : storedAngle
    const err = quadSideError(quadKind, quadSides, storedAngle)
    if (err === 'missing') {
      setQuadError(tr('Nhập đủ các số đo', 'Enter the measurements', '请填写尺寸', '寸法を入力', '치수를 입력'))
      return
    }
    if (err === 'height') {
      setQuadError(tr('Chiều cao phải là số dương', 'Height must be a positive number', '高须为正数', '高さは正の数で', '높이는 양수여야 합니다'))
      return
    }
    if (err === 'angle') {
      setQuadError(tr('Góc tại A lớn hơn 0° và nhỏ hơn 180°', 'The angle at A is between 0° and 180°', 'A 处的角要大于 0° 且小于 180°', 'A の角は 0° より大きく 180° 未満', 'A의 각은 0°보다 크고 180°보다 작아야 합니다'))
      return
    }
    if (err === 'square') {
      setQuadError(tr('Hình vuông cần bốn cạnh bằng nhau', 'A square needs four equal sides', '正方形四边相等', '正方形は四辺が等しい', '정사각형은 네 변이 같습니다'))
      return
    }
    if (err === 'rhombus') {
      setQuadError(tr('Hình thoi cần bốn cạnh bằng nhau', 'A rhombus needs four equal sides', '菱形四边相等', 'ひし形は四辺が等しい', '마름모는 네 변이 같습니다'))
      return
    }
    if (err === 'opposite') {
      setQuadError(tr('Hai cặp cạnh đối phải bằng nhau', 'Opposite sides must match', '对边必须相等', '対辺は等しい', '마주 보는 변은 같아야 합니다'))
      return
    }
    const points = placeQuad({ kind: quadKind, ...worldQuad(quadSides), angle: placeAngle }, quadAsk.corners)
    if (!points) {
      setQuadError(tr('Số đo này không dựng được tứ giác', 'These measures do not form a quadrilateral', '这些尺寸不能构成四边形', 'この寸法では四角形になりません', '이 치수로는 사각형이 되지 않습니다'))
      return
    }
    const leg = quadKind === 'trapezoid' ? formatWholeGrid(dist(points[1], points[2])) : ''
    const storedSides = quadKind === 'trapezoid' ? { ...quadSides, bc: leg, da: leg } : quadSides
    const names = freshCornerNames(stateRef.current.objects, 4)
    commitObject({
      kind: 'shape',
      id: quadAsk.id,
      shape: 'polygon',
      color: quadAsk.color,
      size: quadAsk.size,
      points,
      quad: { kind: quadKind, ...storedSides, angle: storedAngle },
      quadNames: [names[0] || 'A', names[1] || 'B', names[2] || 'C', names[3] || 'D'],
    })
    setQuadAsk(null)
  }

  const quadKindLabel = (kind: QuadKind) => {
    if (kind === 'square') return tr('Hình vuông', 'Square', '正方形', '正方形', '정사각형')
    if (kind === 'rectangle') return tr('Hình chữ nhật', 'Rectangle', '长方形', '長方形', '직사각형')
    if (kind === 'rhombus') return tr('Hình thoi', 'Rhombus', '菱形', 'ひし形', '마름모')
    if (kind === 'trapezoid') return tr('Hình thang', 'Trapezoid', '梯形', '台形', '사다리꼴')
    return tr('Hình bình hành', 'Parallelogram', '平行四边形', '平行四辺形', '평행사변형')
  }

  const triangleKindLabel = (kind: TriangleKind) => {
    if (kind === 'equilateral') return tr('Tam giác đều', 'Equilateral', '等边三角形', '正三角形', '정삼각형')
    if (kind === 'isosceles') return tr('Tam giác cân', 'Isosceles', '等腰三角形', '二等辺三角形', '이등변삼각형')
    if (kind === 'right') return tr('Tam giác vuông', 'Right', '直角三角形', '直角三角形', '직각삼각형')
    if (kind === 'right-isosceles') return tr('Tam giác vuông cân', 'Isosceles right', '等腰直角三角形', '直角二等辺三角形', '직각이등변삼각형')
    return tr('Tam giác thường', 'Scalene', '一般三角形', '不等辺三角形', '부등변삼각형')
  }

  const triangleLineLabel = (role: TriangleLineRole) => {
    if (role === 'altitude') return tr('Đường cao', 'Altitude', '高线', '高さ', '높이')
    if (role === 'bisector') return tr('Đường phân giác', 'Angle bisector', '角平分线', '角の二等分線', '각의 이등분선')
    if (role === 'median') return tr('Đường trung tuyến', 'Median', '中线', '中線', '중선')
    if (role === 'perp-bisector') return tr('Đường trung trực', 'Perpendicular bisector', '垂直平分线', '垂直二等分線', '수직이등분선')
    return tr('Đường trung bình', 'Midsegment', '中位线', '中点連結', '중선분')
  }

  const commitStraight = (points: { x: number; y: number }[]) => {
    if (!straightAsk || points.length < 2) {
      setStraightAsk(null)
      return
    }
    commitObject({
      kind: 'shape',
      id: straightAsk.id,
      shape: 'line',
      color: straightAsk.color,
      size: straightAsk.size,
      lineType: straightAsk.lineType,
      points,
    })
    setStraightAsk(null)
  }

  const keepStraightSketch = () => {
    if (!straightAsk) return
    if (straightAsk.rawPoints && straightAsk.rawPoints.length >= 2) {
      commitInk({
        id: straightAsk.id,
        color: straightAsk.color,
        size: straightAsk.size,
        points: straightAsk.rawPoints,
        lineType: straightAsk.lineType,
      })
      setStraightAsk(null)
      return
    }
    commitStraight([straightAsk.start, straightAsk.end])
  }

  const confirmStraight = () => {
    if (!straightAsk) return
    const measured = lineMeasure(straightAsk.start, straightAsk.end)
    const lengthRaw = straightLength.trim()
    const angleRaw = straightAngle.trim()
    if (!lengthRaw && !angleRaw) {
      keepStraightSketch()
      return
    }
    const lengthChanged = lengthRaw !== '' && lengthRaw !== formatWholeGrid(measured.length)
    const angleChanged = angleRaw !== '' && angleRaw !== formatWholeAngle(measured.angleDeg)
    if (!lengthChanged && !angleChanged) {
      const [start, end] = pinLineEnds(straightAsk.start, straightAsk.end, stateRef.current.objects, 48)
      commitStraight([start, end])
      return
    }
    const cells = lengthRaw ? parseSideLength(lengthRaw) : null
    const lengthPx = lengthRaw ? (cells == null ? null : gridMeasureToWorld(cells)) : measured.length
    const angle = angleRaw ? parseLineAngle(angleRaw) : measured.angleDeg
    if (lengthPx == null || angle == null) {
      setStraightError(tr(
        'Độ dài phải là số dương, góc từ 0° đến 360°',
        'Length must be a positive number and the angle from 0° to 360°',
        '长度须为正数，角度为 0° 到 360°',
        '長さは正の数、角度は 0° から 360°',
        '길이는 양수, 각도는 0°에서 360°',
      ))
      return
    }
    commitStraight(lineFromMeasure(straightAsk.start, lengthPx, angle))
  }

  const commitCircle = (r: number) => {
    if (!circleAsk) return
    commitObject({
      kind: 'shape',
      id: circleAsk.id,
      shape: 'circle',
      color: circleAsk.color,
      size: circleAsk.size,
      lineType: circleAsk.lineType,
      points: [],
      cx: circleAsk.cx,
      cy: circleAsk.cy,
      r,
    })
    setCircleAsk(null)
  }

  const keepCircleSketch = () => {
    if (!circleAsk) return
    if (circleAsk.rawPoints && circleAsk.rawPoints.length >= 2) {
      commitInk({
        id: circleAsk.id,
        color: circleAsk.color,
        size: circleAsk.size,
        points: circleAsk.rawPoints,
        lineType: circleAsk.lineType,
      })
      setCircleAsk(null)
      return
    }
    commitCircle(circleAsk.r)
  }

  const keepTriangleSketch = () => {
    if (!triangleAsk) return
    commitInk({
      id: triangleAsk.id,
      color: triangleAsk.color,
      size: triangleAsk.size,
      points: triangleAsk.rawPoints,
      lineType: triangleAsk.lineType,
    })
    setTriangleAsk(null)
  }

  const keepQuadSketch = () => {
    if (!quadAsk) return
    commitInk({
      id: quadAsk.id,
      color: quadAsk.color,
      size: quadAsk.size,
      points: quadAsk.rawPoints,
      lineType: quadAsk.lineType,
    })
    setQuadAsk(null)
  }

  const keepLineSketch = () => {
    if (!lineAsk) return
    if (lineAsk.fallbackPoints.length >= 2) {
      commitInk({
        id: lineAsk.id,
        color: lineAsk.color,
        size: lineAsk.size,
        points: lineAsk.fallbackPoints,
        lineType: lineTypeRef.current,
      })
    } else {
      flushDraft(null)
    }
    setLineAsk(null)
  }

  settleOpenAskRef.current = () => {
    if (straightAsk) keepStraightSketch()
    if (circleAsk) keepCircleSketch()
    if (triangleAsk) keepTriangleSketch()
    if (quadAsk) keepQuadSketch()
    if (lineAsk) keepLineSketch()
  }

  const confirmCircle = () => {
    if (!circleAsk) return
    if (ovalKind === 'ellipse') {
      const majorRaw = ellipseMajor.trim()
      const minorRaw = ellipseMinor.trim()
      let major = (circleAsk.longOnRx ? circleAsk.rx : circleAsk.ry) * 2
      let minor = (circleAsk.longOnRx ? circleAsk.ry : circleAsk.rx) * 2
      if (majorRaw) {
        const cells = parseSideLength(majorRaw)
        if (cells == null) {
          setCircleError(tr('Trục phải là số dương', 'Each axis must be a positive number', '轴长须为正数', '軸は正の数で', '축은 양수여야 합니다'))
          return
        }
        major = gridMeasureToWorld(cells)
      }
      if (minorRaw) {
        const cells = parseSideLength(minorRaw)
        if (cells == null) {
          setCircleError(tr('Trục phải là số dương', 'Each axis must be a positive number', '轴长须为正数', '軸は正の数で', '축은 양수여야 합니다'))
          return
        }
        minor = gridMeasureToWorld(cells)
      }
      const rx = (circleAsk.longOnRx ? major : minor) / 2
      const ry = (circleAsk.longOnRx ? minor : major) / 2
      commitObject({
        kind: 'shape',
        id: circleAsk.id,
        shape: 'ellipse',
        color: circleAsk.color,
        size: circleAsk.size,
        lineType: circleAsk.lineType,
        points: [],
        cx: circleAsk.cx,
        cy: circleAsk.cy,
        rx,
        ry,
        rotation: circleAsk.rotation,
      })
      setCircleAsk(null)
      return
    }
    const raw = circleDiameter.trim()
    if (!raw) {
      commitCircle(circleAsk.r)
      return
    }
    const cells = parseSideLength(raw)
    if (cells == null) {
      setCircleError(tr(
        'Đường kính phải là số dương',
        'Diameter must be a positive number',
        '直径须为正数',
        '直径は正の数で',
        '지름은 양수여야 합니다',
      ))
      return
    }
    commitCircle(gridMeasureToWorld(cells) / 2)
  }

  const keepArbitraryLine = () => {
    if (!lineAsk) return
    const points = lineAsk.fallbackPoints
    const a = points[0]
    const b = points[points.length - 1]
    if (!a || !b) {
      setLineAsk(null)
      return
    }
    commitObject({
      kind: 'shape',
      id: lineAsk.id,
      shape: 'line',
      color: lineAsk.color,
      size: lineAsk.size,
      points: [a, b],
    })
    setLineAsk(null)
  }

  const chooseTriangleLine = (role: TriangleLineRole) => {
    if (!lineAsk) return
    const stored = stateRef.current.objects.find((item) => item.kind === 'shape' && item.shape === 'triangle' && item.id === lineAsk.triangleId)
    const corners = stored && stored.kind === 'shape' && stored.points.length >= 3 ? stored.points : lineAsk.trianglePoints
    const pts = corners.length >= 3 ? triangleLinePoints(role, lineAsk.vertex, corners) : null
    if (!pts) {
      setLineAsk(null)
      return
    }
    const footName = footNameForNewPoint(stateRef.current.objects, role, lineAsk.vertex, corners, pts[1])
    commitObject({
      kind: 'shape',
      id: lineAsk.id,
      shape: 'line',
      color: lineAsk.color,
      size: lineAsk.size,
      points: pts,
      triangleLine: {
        role,
        vertex: lineAsk.vertex,
        triangleId: lineAsk.triangleId,
        ...(footName ? { footName } : {}),
      },
    })
    setLineAsk(null)
  }

  const commitRuler = (next: WhiteboardRuler) => {
    rulerRef.current = next
    setRuler(next)
  }

  const chooseRuler = (kind: WhiteboardRulerKind) => {
    if (rulerRef.current && rulerKindOf(rulerRef.current) === kind) {
      rulerRef.current = null
      setRuler(null)
      setRulerMenu(false)
      return
    }
    const wrap = wrapRef.current
    const rect = wrap?.getBoundingClientRect()
    const w = rect?.width || boardSize.w
    const h = rect?.height || boardSize.h
    const mid = screenToWorld(w / 2, h / 2, stateRef.current.camera, w, h)
    if (kind === 'length') {
      const length = WHITEBOARD_GRID * 8
      commitRuler({ kind, x: mid.x - length / 2, y: mid.y, length, angleDeg: 0 })
    } else if (kind === 'protractor') {
      commitRuler({ kind, x: mid.x, y: mid.y, length: WHITEBOARD_GRID * 5, angleDeg: 0, armDeg: 60 })
    } else if (kind === 'compass') {
      commitRuler({ kind, x: mid.x, y: mid.y, length: WHITEBOARD_GRID * 3, angleDeg: 0 })
    } else {
      commitRuler({ kind, x: mid.x, y: mid.y, length: WHITEBOARD_GRID * 6, angleDeg: 0 })
    }
    setRulerMenu(false)
  }

  const onRulerPointerDown = (mode: RulerDragMode, e: ReactPointerEvent<SVGElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const current = rulerRef.current
    if (!current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const world = localPoint(e).world
    rulerDragRef.current = {
      mode,
      gx: world.x - current.x,
      gy: world.y - current.y,
      ax: current.x,
      ay: current.y,
      baseAngle: current.angleDeg,
      pointerAngle: lineMeasure({ x: current.x, y: current.y }, world).angleDeg,
    }
  }

  const onRulerPointerMove = (e: ReactPointerEvent<SVGElement>) => {
    const drag = rulerDragRef.current
    const current = rulerRef.current
    if (!drag || !current || !e.currentTarget.hasPointerCapture(e.pointerId)) return
    const world = localPoint(e).world
    if (drag.mode === 'move') {
      commitRuler({ ...current, x: world.x - drag.gx, y: world.y - drag.gy })
      return
    }
    const kind = rulerKindOf(current)
    if (drag.mode === 'rotate') {
      const measured = lineMeasure({ x: current.x, y: current.y }, world)
      if (measured.length < 24) return
      let step = measured.angleDeg - drag.pointerAngle
      if (step > 180) step -= 360
      if (step < -180) step += 360
      drag.pointerAngle = measured.angleDeg
      drag.baseAngle = normalizeLineAngle(drag.baseAngle + step)
      commitRuler({ ...current, angleDeg: drag.baseAngle })
      return
    }
    if (kind === 'length' && drag.mode === 'end') {
      commitRuler({ ...rulerFromEnds({ x: drag.ax, y: drag.ay }, world), kind: 'length' })
      return
    }
    const measured = lineMeasure({ x: current.x, y: current.y }, world)
    if (drag.mode === 'arm') {
      commitRuler({ ...current, armDeg: protractorArmDeg(current.angleDeg, measured.angleDeg) })
      return
    }
    if (drag.mode === 'rim') {
      commitRuler({ ...current, length: Math.max(WHITEBOARD_GRID, measured.length), angleDeg: measured.angleDeg })
      return
    }
    if (kind === 'protractor') {
      commitRuler({ ...current, angleDeg: measured.angleDeg })
      return
    }
    commitRuler({ ...current, length: Math.max(WHITEBOARD_GRID, measured.length), angleDeg: measured.angleDeg })
  }

  const onRulerPointerUp = () => {
    rulerDragRef.current = null
  }

  useEffect(() => {
    const el = textAreaRef.current
    if (!textDraft || !el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [textDraft?.id])

  useEffect(() => {
    setTextDraft((draft) => {
      if (!draft || draft.color === color) return draft
      const next = { ...draft, color }
      textDraftRef.current = next
      return next
    })
  }, [color])

  const btn = (on: boolean) => cn('shrink-0 touch-manipulation rounded px-2 py-1 text-[11px] max-md:px-2.5 max-md:py-2 max-md:text-[12px]', on ? 'bg-white/30' : 'hover:bg-white/15')
  const iconBtn = (on: boolean) => cn('inline-flex h-7 w-7 shrink-0 flex-col touch-manipulation items-center justify-center gap-0 rounded leading-none max-md:h-11 max-md:w-11', on ? 'bg-white/30' : 'hover:bg-white/15')
  const cap = (label: string) => (
    <span className="pointer-events-none block w-full truncate text-center text-[8px] font-medium leading-[11px] tracking-tight opacity-90 max-md:text-[9px] max-md:leading-3">{label}</span>
  )
  const glyph = (node: ReactNode) => <span className="flex h-4 shrink-0 items-center justify-center">{node}</span>
  const dock = 'mx-auto flex w-max max-w-full flex-nowrap items-center justify-center gap-0.5 overflow-visible rounded-xl border border-white/25 bg-black/70 px-1.5 py-1 text-white shadow-lg backdrop-blur-sm max-md:w-full max-md:justify-start max-md:gap-1 max-md:overflow-x-auto max-md:overscroll-x-contain max-md:px-1 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden'
  const cornerCls = 'absolute z-30 h-8 w-8 touch-none rounded-sm border-2 border-sky-400/90 bg-white/85 shadow'
  const placeMenu = (node: ReactNode) => {
    if (!visibleFrame.narrow || typeof document === 'undefined') return node
    return createPortal(
      <div
        className="fixed z-[90] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
        style={{ left: 8, right: 8, top: visibleFrame.top + 8, maxHeight: Math.max(220, visibleFrame.height - 16) }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {node}
      </div>,
      document.body,
    )
  }
  const menuBox = (desktop: string) => cn(visibleFrame.narrow ? 'w-full p-1.5' : desktop)
  const zoomPct = `${Math.round(state.camera.scale * 100)}%`
  const circleDiameterLabel = circleAsk ? formatWholeGrid(circleAsk.r * 2) : ''
  const straightMeasured = straightAsk ? lineMeasure(straightAsk.start, straightAsk.end) : null
  const straightLengthLabel = straightMeasured ? formatWholeGrid(straightMeasured.length) : ''
  const straightAngleLabel = straightMeasured ? formatWholeAngle(straightMeasured.angleDeg) : ''
  const visibleFrame = useMobileVisibleFrame()
  const holdEntryFocus = (event: { target: EventTarget | null }) => {
    const field = event.target
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      keepEntryFieldInCard({ currentTarget: field })
    }
  }
  const askFloatStyle = (cardH: number) => {
    if (visibleFrame.narrow) {
      const height = Math.min(cardH, Math.max(180, visibleFrame.height - 16))
      return {
        position: 'fixed' as const,
        left: 8,
        right: 8,
        width: 'auto' as const,
        top: visibleFrame.top + 8,
        maxHeight: height,
        zIndex: 80,
      }
    }
    const w = wrapRef.current?.clientWidth || boardSize.w
    const h = wrapRef.current?.clientHeight || boardSize.h
    const pts: { x: number; y: number }[] = []
    if (circleAsk) {
      const rx = Math.max(circleAsk.rx, circleAsk.r)
      const ry = Math.max(circleAsk.ry, circleAsk.r)
      pts.push(
        { x: circleAsk.cx - rx, y: circleAsk.cy - ry },
        { x: circleAsk.cx + rx, y: circleAsk.cy + ry },
        ...(circleAsk.rawPoints ?? []),
      )
    }
    if (straightAsk) pts.push(straightAsk.start, straightAsk.end, ...(straightAsk.rawPoints ?? []))
    if (triangleAsk) pts.push(...triangleAsk.corners, ...triangleAsk.rawPoints)
    if (quadAsk) pts.push(...quadAsk.corners, ...quadAsk.rawPoints)
    if (lineAsk) pts.push(...lineAsk.fallbackPoints)
    let figure: { minX: number; minY: number; maxX: number; maxY: number } | null = null
    if (pts.length > 0) {
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of pts) {
        const s = worldToScreen(p, state.camera, w, h)
        minX = Math.min(minX, s.x)
        minY = Math.min(minY, s.y)
        maxX = Math.max(maxX, s.x)
        maxY = Math.max(maxY, s.y)
      }
      figure = { minX, minY, maxX, maxY }
    }
    const cardW = Math.min(384, Math.max(220, w - 24))
    const pos = dialogClearOfFigure({ w, h }, figure, { w: cardW, h: cardH })
    return {
      left: pos.left,
      top: pos.top,
      width: pos.width,
      maxHeight: pos.height,
    }
  }
  const askCard = 'pointer-events-auto absolute overflow-y-auto rounded-2xl bg-white p-4 text-slate-900 shadow-2xl'
  return (
    <div ref={rootRef} className={cn('relative flex h-full min-h-0 w-full flex-col bg-slate-200 touch-none', className)} data-teacher-whiteboard>
      <div
        ref={wrapRef}
        data-teacher-whiteboard-view
        className="relative min-h-0 flex-1 overflow-hidden overscroll-none touch-none"
        style={{ touchAction: 'none' }}
      >
        {imageError ? (
          <p className="pointer-events-none absolute left-1/2 top-2 z-20 max-w-[90%] -translate-x-1/2 rounded-full bg-white px-3 py-1 text-center text-[12px] text-slate-700 shadow">
            {imageError}
          </p>
        ) : null}
        <input
          ref={imageFileRef}
          type="file"
          accept="image/*"
          className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.currentTarget.value = ''
            if (file) void insertPickedImage(file)
          }}
        />
        <canvas
          ref={canvasRef}
          className={cn(
            'absolute inset-0 h-full w-full touch-none',
            dimTool || tool === 'pen' || tool === 'eraser' || tool === 'fill' ? 'cursor-crosshair' : tool === 'text' ? 'cursor-text' : tool === 'pan' ? 'cursor-grab' : 'cursor-default',
          )}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        />
        {figurePick ? (
          <FigureEditor
            tr={tr}
            itemId={figurePick}
            params={figureParams}
            onParams={setFigureParams}
            onInsert={insertFigure}
            onClose={closeFigure}
          />
        ) : null}
        {textDraft ? (
          <div
            key={textDraft.id}
            data-wb-entry
            className="pointer-events-auto absolute z-30"
            style={visibleFrame.narrow ? {
              position: 'fixed',
              left: 8,
              right: 8,
              top: visibleFrame.top + 8,
              width: 'auto',
              zIndex: 80,
              touchAction: 'auto',
            } : {
              left: worldToScreen(
                { x: textDraft.x, y: textDraft.y },
                state.camera,
                wrapRef.current?.clientWidth || boardSize.w,
                wrapRef.current?.clientHeight || boardSize.h,
              ).x,
              top: worldToScreen(
                { x: textDraft.x, y: textDraft.y },
                state.camera,
                wrapRef.current?.clientWidth || boardSize.w,
                wrapRef.current?.clientHeight || boardSize.h,
              ).y,
              width: textDraft.width * (state.camera.scale || 1),
              touchAction: 'auto',
            }}
            onFocusCapture={holdEntryFocus}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault()
            }}
          >
            <textarea
              ref={textAreaRef}
              autoFocus
              value={textDraft.text}
              rows={Math.min(8, Math.max(2, textDraft.text.split('\n').length + 1))}
              aria-label={tr('Soạn chữ', 'Edit text', '编辑文字', '文字を編集', '글자 편집')}
              className="w-full resize-none rounded border border-sky-500 bg-white px-1 py-0.5 text-slate-900 shadow outline-none"
              style={{
                fontSize: textDraft.size * (state.camera.scale || 1),
                lineHeight: 1.35,
                color: textDraft.color,
                fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                touchAction: 'auto',
              }}
              onChange={(e) => {
                const value = e.target.value
                setTextDraft((draft) => {
                  if (!draft) return draft
                  const next = { ...draft, text: value }
                  textDraftRef.current = next
                  return next
                })
              }}
              onBlur={(e) => {
                const box = e.currentTarget.parentElement
                if (e.relatedTarget instanceof Node && box?.contains(e.relatedTarget)) return
                const id = textDraft.id
                if (textDraftRef.current?.id !== id) return
                if (Date.now() - textOpenAtRef.current < 500) {
                  requestAnimationFrame(() => textAreaRef.current?.focus())
                  return
                }
                finishText(true)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') {
                  e.preventDefault()
                  finishText(false)
                  return
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  finishText(true)
                }
              }}
            />
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {WHITEBOARD_TEXT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={cn('rounded bg-white px-1.5 py-0.5 text-[11px] text-slate-800 shadow', textDraft.size === size && 'ring-2 ring-sky-500')}
                  onClick={() => {
                    textSizeRef.current = size
                    setTextDraft((draft) => {
                      if (!draft) return draft
                      const next = { ...draft, size }
                      textDraftRef.current = next
                      return next
                    })
                  }}
                >
                  {size === 20
                    ? tr('Nhỏ', 'Small', '小', '小', '작게')
                    : size === 40
                      ? tr('Lớn', 'Large', '大', '大', '크게')
                      : tr('Vừa', 'Medium', '中', '中', '보통')}
                </button>
              ))}
              <button type="button" className="rounded bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white" onClick={() => finishText(true)}>
                {tr('Xong', 'Done', '完成', '完了', '완료')}
              </button>
            </div>
          </div>
        ) : null}
        {marquee ? (
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: Math.min(marquee.x0, marquee.x1),
              top: Math.min(marquee.y0, marquee.y1),
              width: Math.abs(marquee.x1 - marquee.x0),
              height: Math.abs(marquee.y1 - marquee.y0),
              border: marquee.crossing ? '1px dashed #16a34a' : '1px solid #2563eb',
              background: marquee.crossing ? 'rgba(34,197,94,0.15)' : 'rgba(37,99,235,0.14)',
            }}
          />
        ) : null}
        {readOnly ? null : (
          <>
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'left-1.5 top-1.5 cursor-nwse-resize')} onPointerDown={onCornerPointerDown('nw')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'right-1.5 top-1.5 cursor-nesw-resize')} onPointerDown={onCornerPointerDown('ne')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'bottom-3 left-1.5 cursor-nesw-resize')} onPointerDown={onCornerPointerDown('sw')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <button type="button" aria-label={tr('Kéo góc phóng', 'Drag corner to zoom', '拖角缩放', '角をドラッグして拡大', '모서리를 끌어 확대')} className={cn(cornerCls, 'bottom-3 right-1.5 cursor-nwse-resize')} onPointerDown={onCornerPointerDown('se')} onPointerMove={onCornerPointerMove} onPointerUp={onCornerPointerUp} onPointerCancel={onCornerPointerUp} />
            <canvas
              ref={mapRef}
              aria-label={tr('Bản đồ con', 'Overview map', '缩略图', '全体図', '전체 지도')}
              className="absolute bottom-[3.1rem] right-2 z-20 h-28 w-[168px] cursor-pointer touch-none rounded-md border border-slate-300 bg-white shadow-md max-md:bottom-[max(4.75rem,calc(env(safe-area-inset-bottom)+4.25rem))] max-md:right-1 max-md:h-16 max-md:w-24"
              onPointerDown={(e) => {
                e.stopPropagation()
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                jumpFromMap(e)
              }}
              onPointerMove={(e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
                e.stopPropagation()
                jumpFromMap(e)
              }}
            />
            {ruler ? (
              <svg className="pointer-events-none absolute inset-0 z-10 overflow-visible" width={boardSize.w} height={boardSize.h}>
                <WhiteboardRulerGraphic
                  ruler={ruler}
                  camera={state.camera}
                  boardW={boardSize.w}
                  boardH={boardSize.h}
                  onPointerDown={onRulerPointerDown}
                  onPointerMove={onRulerPointerMove}
                  onPointerUp={onRulerPointerUp}
                  onClose={() => {
                    rulerDragRef.current = null
                    rulerRef.current = null
                    setRuler(null)
                  }}
                />
              </svg>
            ) : null}
            <div
              className="absolute bottom-2 left-1/2 z-30 flex w-[min(98%,1080px)] -translate-x-1/2 flex-col gap-1 overflow-visible max-md:bottom-[max(0.35rem,env(safe-area-inset-bottom))] max-md:left-1 max-md:right-1 max-md:w-auto max-md:translate-x-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {dimTool ? (
                <p className="mx-auto rounded-full bg-black/75 px-3 py-1 text-center text-[11px] text-white">
                  {(() => {
                    const label = DIM_LABEL[dimTool]
                    const name = tr(label.vi, label.en, label.zh, label.ja, label.ko)
                    const need = dimClicksNeeded(dimTool, dimChain)
                    const ask = (vi: string, en: string, zh: string, ja: string, ko: string) => `${name} · ${tr(vi, en, zh, ja, ko)}`
                    const place = ask('đặt đường kích thước', 'place the dimension line', '放置尺寸线', '寸法線の位置', '치수선 위치')
                    if (dimTool === 'angular') {
                      if (!dimLine) return ask('bấm đường thẳng thứ nhất', 'pick the first line', '点第一条直线', '1本目の直線をクリック', '첫 직선을 누르세요')
                      if (!dimLine2) return ask('bấm đường thẳng thứ hai', 'pick the second line', '点第二条直线', '2本目の直線をクリック', '둘째 직선을 누르세요')
                      return place
                    }
                    if (dimTool === 'radius' || dimTool === 'diameter' || dimTool === 'jogged' || dimTool === 'arc') {
                      return dimCircle ? place : ask('bấm đường tròn', 'pick the circle', '点圆', '円をクリック', '원을 누르세요')
                    }
                    if (dimTool === 'linear' || dimTool === 'aligned' || dimTool === 'quick') {
                      return dimLine ? place : ask('bấm đường thẳng', 'pick the line', '点直线', '直線をクリック', '직선을 누르세요')
                    }
                    if (dimTool === 'ordinate') {
                      return dimPoint ? place : ask('bấm điểm có sẵn', 'pick an existing point', '点已有的点', '既存の点をクリック', '있는 점을 누르세요')
                    }
                    if (dimTool === 'continue' || dimTool === 'baseline') {
                      return dimHold ? ask('bấm điểm đo tiếp', 'pick the next measured point', '点下一个测量点', '次の測定点をクリック', '다음 측정점을 누르세요') : ask('bấm kích thước có sẵn', 'pick an existing dimension', '点已有尺寸', '既存の寸法をクリック', '있는 치수를 누르세요')
                    }
                    if (need === 1) return ask('bấm điểm tiếp theo', 'pick the next point', '点下一个点', '次の点をクリック', '다음 점을 누르세요')
                    if (dimPicks.length === 0) return ask('bấm điểm đầu', 'pick the first point', '点第一个点', '始点をクリック', '첫 점을 누르세요')
                    if (need === 2 || dimPicks.length === 1) return ask('bấm điểm tiếp theo', 'pick the next point', '点下一个点', '次の点をクリック', '다음 점을 누르세요')
                    return ask('đặt đường kích thước', 'place the dimension line', '放置尺寸线', '寸法線の位置', '치수선 위치')
                  })()}
                </p>
              ) : tool === 'fill' ? (
                <p className="mx-auto rounded-full bg-black/75 px-3 py-1 text-center text-[11px] text-white">
                  {tr('Bấm vào vùng kín để tô, kể cả vùng ghép từ nhiều đường thẳng. Bấm lại cùng màu thì bỏ tô.', 'Click a closed region to fill, including one made of several lines. Click again with the same color to clear.', '点击封闭区域填充，多条直线围成的也可以。再点同一颜色则清除。', '閉じた領域をクリックして塗る。複数の直線で囲まれた領域も含む。同じ色でもう一度押すと消える。', '닫힌 영역을 누르면 칠합니다. 여러 직선으로 막힌 영역도 됩니다. 같은 색을 다시 누르면 지웁니다.')}
                </p>
              ) : tool === 'text' && !textDraft ? (
                <p className="mx-auto rounded-full bg-black/75 px-3 py-1 text-center text-[11px] text-white">
                  {tr('Bấm vào bảng để viết. Bấm lại chữ đã có để sửa.', 'Click the board to write. Click existing text to edit it.', '点击白板写字。再点已有文字可修改。', 'ボードをクリックして書く。既存の文字をクリックすると編集。', '판을 눌러 글자를 씁니다. 있는 글자를 누르면 고칩니다.')}
                </p>
              ) : solidKind ? (
                <p className="mx-auto rounded-full bg-black/75 px-3 py-1 text-center text-[11px] text-white">
                  {tr('Bấm vào bảng để đặt khối. Esc để hủy.', 'Click the board to place the solid. Esc cancels.', '点击白板放置立体。Esc 取消。', 'ボードをクリックして立体を置く。Esc で取消。', '판을 눌러 입체를 놓습니다. Esc로 취소.')}
                </p>
              ) : null}
              <div className={dock}>
                <button type="button" className={iconBtn(tool === 'pen' && !dimTool)} title={`${tr('Vẽ', 'Draw', '画笔', '描画', '그리기')} (B)`} aria-label={tr('Vẽ', 'Draw', '画笔', '描画', '그리기')} onClick={() => { clearDim(); disarmSolid(); setTool('pen') }}>{glyph(<PenLine className="h-4 w-4" aria-hidden />)}{cap(tr('Vẽ', 'Draw', '画笔', '描画', '그리기'))}</button>
                <button
                  type="button"
                  className={iconBtn(false)}
                  title={selectedIds.length > 0
                    ? tr('Xóa phần đang chọn', 'Delete selection', '删除所选', '選択を削除', '선택 삭제')
                    : `${tr('Xóa hết', 'Clear all', '全部清除', 'すべて消去', '모두 지우기')} (Ctrl+Shift+Delete)`}
                  aria-label={selectedIds.length > 0
                    ? tr('Xóa phần đang chọn', 'Delete selection', '删除所选', '選択を削除', '선택 삭제')
                    : tr('Xóa hết', 'Clear all', '全部清除', 'すべて消去', '모두 지우기')}
                  onClick={() => {
                    if (selectedIdsRef.current.length > 0) removeSelected()
                    else clearAll()
                  }}
                >
                  {glyph(<Trash2 className="h-4 w-4" aria-hidden />)}
                  {cap(tr('Xóa', 'Del', '删除', '削除', '삭제'))}
                </button>
                <button type="button" className={iconBtn(tool === 'select' && !dimTool && solidKind == null)} title={`${tr('Chọn', 'Select', '选择', '選択', '선택')} (V)`} aria-label={tr('Chọn', 'Select', '选择', '選択', '선택')} onClick={() => { clearDim(); disarmSolid(); setTool('select') }}>{glyph(<MousePointer2 className="h-4 w-4" aria-hidden />)}{cap(tr('Chọn', 'Select', '选择', '選択', '선택'))}</button>
                <button
                  type="button"
                  className={iconBtn(tool === 'pan')}
                  onClick={() => { clearDim(); disarmSolid(); discardOpenAsk(); setTool('pan') }}
                  title={`${tr('Pan', 'Pan', '平移', 'パン', '이동')} (H)`}
                  aria-label={tr('Pan', 'Pan', '平移', 'パン', '이동')}
                >
                  {glyph(<Hand className="h-3.5 w-3.5" aria-hidden />)}
                  {cap(tr('Kéo', 'Pan', '平移', 'パン', '이동'))}
                </button>
                <button type="button" className={iconBtn(tool === 'eraser')} title={`${tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')} (E)`} aria-label={tr('Tẩy', 'Erase', '橡皮', '消しゴム', '지우기')} onClick={() => { clearDim(); disarmSolid(); setTool('eraser') }}>{glyph(<Eraser className="h-4 w-4" aria-hidden />)}{cap(tr('Tẩy', 'Erase', '橡皮', '消去', '지우기'))}</button>
                <button
                  type="button"
                  className={iconBtn(tool === 'fill')}
                  title={`${tr('Tô', 'Fill', '填充', '塗り', '칠')} (F)`}
                  aria-label={tr('Tô', 'Fill', '填充', '塗り', '칠')}
                  onClick={() => { clearDim(); disarmSolid(); setTool('fill') }}
                >
                  {glyph(<PaintBucket className="h-4 w-4" aria-hidden />)}
                  {cap(tr('Tô', 'Fill', '填充', '塗り', '칠'))}
                </button>
                <button
                  type="button"
                  className={iconBtn(tool === 'text' || textDraft != null)}
                  title={`${tr('Chữ', 'Text', '文字', '文字', '글자')} (T)`}
                  aria-label={tr('Chữ', 'Text', '文字', '文字', '글자')}
                  onClick={() => { clearDim(); disarmSolid(); setTool('text') }}
                >
                  {glyph(<Type className="h-4 w-4" aria-hidden />)}
                  {cap(tr('Chữ', 'Text', '文字', '文字', '글자'))}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    className={iconBtn(solidMenu || solidKind != null || solidAsk != null)}
                    aria-expanded={solidMenu}
                    aria-label={tr('Khối', 'Solid', '立体', '立体', '입체')}
                    title={tr('Chọn khối 3D', 'Choose a 3D solid', '选择立体', '立体を選ぶ', '입체를 고르기')}
                    onClick={() => {
                      setLineMenu(false)
                      setDimMenu(false)
                      setRulerMenu(false)
                      setAxisMenu(false)
                      setFigureMenu(false)
                      setColorMenu(false)
                      setSolidMenu((open) => !open)
                    }}
                  >
                    {glyph(<Cuboid className="h-4 w-4" aria-hidden />)}
                    {cap(tr('Khối', 'Solid', '立体', '立体', '입체'))}
                  </button>
                  {solidMenu ? placeMenu(
                    <div className={menuBox('absolute bottom-full left-1/2 z-40 mb-1 w-[300px] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl')}>
                      <p className="px-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr('Khối 3D', '3D solids', '立体', '立体', '입체')}</p>
                      <div className="grid grid-cols-4 gap-0.5">
                        {SOLID_KINDS.map((kind) => {
                          const label = SOLID_LABEL[kind]
                          return (
                            <button
                              key={kind}
                              type="button"
                              className={cn('flex flex-col items-center rounded-lg px-0.5 py-1 hover:bg-slate-100', (solidKind === kind || solidAsk === kind) && 'bg-sky-50')}
                              onClick={() => {
                                clearDim()
                                solidKindRef.current = null
                                solidMeasuresRef.current = null
                                setSolidKind(null)
                                setSolidAsk(kind)
                                setSolidFields({})
                                setSolidError('')
                                setSolidMenu(false)
                                setTool('select')
                              }}
                            >
                              <SolidGlyph kind={kind} />
                              <span className="text-center text-[9px] leading-tight">{tr(label[0], label[1], label[2], label[3], label[4])}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className={iconBtn(figureMenu || figurePick != null)}
                    aria-expanded={figureMenu}
                    aria-label={tr('Chèn', 'Insert', '插入', '挿入', '삽입')}
                    title={tr('Chèn công thức, sơ đồ và ảnh', 'Insert a formula, diagram, or image', '插入公式、图或图片', '公式・図・画像を挿入', '공식, 도식, 이미지 넣기')}
                    onClick={() => {
                      setLineMenu(false)
                      setDimMenu(false)
                      setSolidMenu(false)
                      setRulerMenu(false)
                      setAxisMenu(false)
                      setColorMenu(false)
                      setFigureMenu((open) => !open)
                    }}
                  >
                    {glyph(<Shapes className="h-4 w-4" aria-hidden />)}
                    {cap(tr('Chèn', 'Add', '插入', '挿入', '삽입'))}
                  </button>
                  {figureMenu && !figurePick ? placeMenu(<FigureMenu sheet={visibleFrame.narrow} tr={tr} onInsertImage={() => {
                    setFigureMenu(false)
                    imageFileRef.current?.click()
                  }} onPick={(id) => {
                    const item = figureItem(id)
                    if (!item) return
                    setFigureParams(freshFigureParams(item))
                    setFigurePick(id)
                    setFigureMenu(false)
                  }} mathPlot={(
                    <form
                      onSubmit={(event) => {
                        event.preventDefault()
                        addGraph()
                      }}
                    >
                      <div className="grid grid-cols-2 items-stretch gap-2 max-md:grid-cols-1">
                        <div className="min-w-0 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-500">
                        {tr('Vẽ đồ thị', 'Plot a graph', '绘制图像', 'グラフを描く', '그래프 그리기')}
                      </p>
                      <input
                        value={expr}
                        onChange={(event) => setExpr(event.target.value)}
                        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px] text-slate-900 outline-none"
                        placeholder={tr('y=x^2  hoặc  y=sin(x)', 'y=x^2  or  y=sin(x)', 'y=x^2 或 y=sin(x)', 'y=x^2 または y=sin(x)', 'y=x^2 또는 y=sin(x)')}
                        aria-label={tr('Công thức đồ thị', 'Graph formula', '图像公式', 'グラフ式', '그래프 식')}
                      />
                      {(() => {
                        const graphs = state.objects.filter((item): item is WhiteboardGraph => item.kind === 'graph')
                        const host = graphs.find((item) => item.id === axisChoice)
                        const axisLabel = host
                          ? `${host.axis}=${host.expr}`
                          : tr('Độc lập', 'Separate', '独立', '独立', '독립')
                        return (
                          <div className="flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                className="flex h-8 w-full items-center justify-between gap-1 rounded border border-slate-300 px-2 text-left text-[12px]"
                                aria-expanded={axisMenu}
                                aria-label={tr('Hệ trục', 'Axes', '坐标系', '座標', '좌표')}
                                title={tr('Chọn hệ trục', 'Choose axes', '选择坐标系', '座標を選ぶ', '좌표 선택')}
                                onClick={() => setAxisMenu((open) => !open)}
                              >
                                <span className="truncate">{axisLabel}</span>
                                <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" aria-hidden />
                              </button>
                              {axisMenu ? (
                                <div className="mt-1 max-h-28 overflow-auto rounded border border-slate-200 py-0.5">
                                  <button
                                    type="button"
                                    className={cn('block w-full px-2 py-1 text-left text-[12px] hover:bg-sky-50', !host && 'bg-sky-50')}
                                    onClick={() => {
                                      setAxisChoice('solo')
                                      setAxisMenu(false)
                                    }}
                                  >
                                    {tr('Độc lập', 'Separate', '独立', '独立', '독립')}
                                  </button>
                                  {graphs.map((graph) => (
                                    <button
                                      key={graph.id}
                                      type="button"
                                      className={cn('block w-full truncate px-2 py-1 text-left text-[12px] hover:bg-sky-50', host?.id === graph.id && 'bg-sky-50')}
                                      onClick={() => {
                                        setAxisChoice(graph.id)
                                        setAxisMenu(false)
                                      }}
                                    >
                                      {`${graph.axis}=${graph.expr}`}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <button type="submit" className="h-8 shrink-0 rounded bg-sky-600 px-2.5 text-[12px] font-medium text-white">
                              {tr('Vẽ hàm', 'Plot', '绘图', '描画', '그리기')}
                            </button>
                          </div>
                        )
                      })()}
                      {exprError ? <p className="text-[11px] font-medium text-red-600">{exprError}</p> : null}
                        </div>
                        <GraphPreview
                          expr={expr}
                          color={color}
                          shared={(() => {
                            const graphs = state.objects.filter((item): item is WhiteboardGraph => item.kind === 'graph')
                            const host = graphs.find((item) => item.id === axisChoice)
                            if (!host) return []
                            return graphs
                              .filter((graph) => graph.id === host.id || (Boolean(host.frameId) && graph.frameId === host.frameId))
                              .map((graph) => ({ expr: `${graph.axis}=${graph.expr}`, color: graph.color }))
                          })()}
                          empty={tr('Chưa đọc được công thức', 'Could not read the formula', '无法读取公式', '式を読めません', '수식을 읽지 못했습니다')}
                        />
                      </div>
                    </form>
                  )} />) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className={iconBtn(ruler != null || rulerMenu)}
                    aria-expanded={rulerMenu}
                    aria-label={tr('Thước', 'Ruler', '尺子', '定規', '자')}
                    title={tr('Chọn loại thước', 'Choose a ruler', '选择尺子', '定規を選ぶ', '자를 고르기')}
                    onClick={() => {
                      setLineMenu(false)
                      setDimMenu(false)
                      setSolidMenu(false)
                      setColorMenu(false)
                      setRulerMenu((open) => !open)
                    }}
                  >
                    {glyph(<Ruler className="h-4 w-4" aria-hidden />)}
                    {cap(tr('Thước', 'Ruler', '尺子', '定規', '자'))}
                  </button>
                  {rulerMenu ? placeMenu(
                    <div className={menuBox('absolute bottom-full left-1/2 z-40 mb-1 w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-xl')}>
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr('Chọn thước', 'Rulers', '尺子', '定規', '자')}</p>
                      {WHITEBOARD_RULER_KINDS.map((id) => {
                        const label = RULER_LABEL[id]
                        const active = ruler != null && rulerKindOf(ruler) === id
                        return (
                          <button
                            key={id}
                            type="button"
                            className={cn('flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12px] font-medium hover:bg-slate-100', active && 'bg-sky-50')}
                            onClick={() => chooseRuler(id)}
                          >
                            <RulerGlyph id={id} />
                            {tr(label.vi, label.en, label.zh, label.ja, label.ko)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className={cn(iconBtn(dimTool != null || dimMenu), 'w-9 gap-0 max-md:w-14')}
                    aria-expanded={dimMenu}
                    aria-label={tr('Dim', 'Dim', '标注', '寸法', '치수')}
                    title={tr('Công cụ đo Dim', 'Dimension tools', '标注工具', '寸法ツール', '치수 도구')}
                    onClick={() => {
                      setRulerMenu(false)
                      setLineMenu(false)
                      setSolidMenu(false)
                      setColorMenu(false)
                      disarmSolid()
                      setDimMenu((open) => !open)
                    }}
                  >
                    {glyph(<><RulerDimensionLine className="h-4 w-4" aria-hidden /><ChevronDown className="h-3 w-3" aria-hidden /></>)}
                    {cap(tr('Đo', 'Dim', '标注', '寸法', '치수'))}
                  </button>
                  {dimMenu ? placeMenu(
                    <div className={menuBox('absolute bottom-full left-1/2 z-40 mb-1 max-h-[70vh] w-52 -translate-x-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-xl')}>
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr('Công cụ đo', 'Dimensions', '标注', '寸法', '치수')}</p>
                      {WHITEBOARD_DIM_TOOLS.map((id) => {
                        const label = DIM_LABEL[id]
                        return (
                          <button
                            key={id}
                            type="button"
                            className={cn('flex w-full items-center rounded-lg px-2 py-1.5 text-left text-[12px] font-medium hover:bg-slate-100', dimTool === id && 'bg-sky-50')}
                            onClick={() => chooseDim(id)}
                          >
                            <DimGlyph id={id} />
                            {tr(label.vi, label.en, label.zh, label.ja, label.ko)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className={cn(btn(lineMenu), 'inline-flex h-7 flex-col items-center justify-center gap-0 px-1 py-0 leading-none max-md:h-11 max-md:py-0')}
                    title={tr('Kiểu nét', 'Linetype', '线型', '線種', '선 종류')}
                    aria-expanded={lineMenu}
                    aria-label={tr('Kiểu nét', 'Linetype', '线型', '線種', '선 종류')}
                    onClick={() => {
                      setRulerMenu(false)
                      setDimMenu(false)
                      setSolidMenu(false)
                      setColorMenu(false)
                      setLineMenu((open) => !open)
                    }}
                  >
                    {glyph(<LineTypeMark id={lineType} ink="#ffffff" weight={LINE_WEIGHTS.find((item) => item.size === brush)?.sw ?? 1.15} />)}
                    {cap(tr('Nét', 'Line', '线型', '線', '선'))}
                  </button>
                  {lineMenu ? placeMenu(
                    <div className={menuBox('absolute bottom-full left-1/2 z-40 mb-1 max-h-[70vh] w-56 -translate-x-1/2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-xl')}>
                      <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr('Độ dày', 'Weight', '线宽', '線の太さ', '선 굵기')}</p>
                      {LINE_WEIGHTS.map((item) => (
                        <button
                          key={item.size}
                          type="button"
                          className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-100', brush === item.size && 'bg-sky-50')}
                          onClick={() => {
                            setBrush(item.size)
                            setLineMenu(false)
                          }}
                        >
                          <LineTypeMark id="continuous" ink="#111827" weight={item.sw} />
                          <span className="text-[11px] font-medium">{tr(item.vi, item.en, item.zh, item.ja, item.ko)}</span>
                        </button>
                      ))}
                      <p className="mt-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr('Kiểu nét', 'Linetype', '线型', '線種', '선 종류')}</p>
                      {LINE_TYPE_CHOICES.map((choice) => (
                        <button
                          key={choice.id}
                          type="button"
                          className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-slate-100', lineType === choice.id && 'bg-sky-50')}
                          onClick={() => {
                            setLineType(choice.id)
                            setLineMenu(false)
                          }}
                        >
                          <LineTypeMark id={choice.id} ink="#111827" />
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold uppercase tracking-wide">{choice.cad}</span>
                            <span className="block text-[10px] text-slate-500">{tr(choice.vi, choice.en, choice.zh, choice.ja, choice.ko)}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    className={iconBtn(colorMenu)}
                    aria-expanded={colorMenu}
                    aria-label={tr('Màu', 'Color', '颜色', '色', '색')}
                    title={tr('Chọn màu', 'Choose a color', '选择颜色', '色を選ぶ', '색 선택')}
                    onClick={() => {
                      setLineMenu(false)
                      setDimMenu(false)
                      setSolidMenu(false)
                      setRulerMenu(false)
                      setFigureMenu(false)
                      setAxisMenu(false)
                      setColorMenu((open) => !open)
                    }}
                  >
                    {glyph(<span className="h-3.5 w-3.5 rounded-sm border border-white/80" style={{ backgroundColor: color }} />)}
                    {cap(tr('Màu', 'Color', '颜色', '色', '색'))}
                  </button>
                  {colorMenu ? placeMenu(
                    <div className={menuBox('absolute bottom-full left-1/2 z-40 mb-1 flex -translate-x-1/2 gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl max-md:flex-wrap')}>
                      {WHITEBOARD_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            setColor(c)
                            setColorMenu(false)
                          }}
                          className={cn('h-5 w-5 rounded-full border', color === c ? 'border-sky-600 ring-2 ring-sky-300' : 'border-slate-300')}
                          style={{ backgroundColor: c }}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
                <button type="button" className={iconBtn(false)} title={`${tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')} (Ctrl+Z)`} aria-label={tr('Undo', 'Undo', '撤销', '元に戻す', '실행 취소')} onClick={undo}>{glyph(<Undo2 className="h-4 w-4" aria-hidden />)}{cap(tr('Lùi', 'Undo', '撤销', '戻す', '취소'))}</button>
                <button
                  type="button"
                  className={iconBtn(false)}
                  onClick={() => zoomByTen(-1)}
                  title={`${tr('Thu nhỏ', 'Zoom out', '缩小', '縮小', '축소')} (-)`}
                  aria-label={tr('Thu nhỏ', 'Zoom out', '缩小', '縮小', '축소')}
                >
                  {glyph(<ZoomOut className="h-3.5 w-3.5" aria-hidden />)}
                  {cap(tr('Thu', 'Out', '缩小', '縮小', '축소'))}
                </button>
                <button type="button" className={cn(btn(Math.abs(state.camera.scale - 1) < 0.02), 'inline-flex h-7 w-auto flex-col items-center justify-center px-1.5 py-0 leading-none max-md:h-11 max-md:px-2 max-md:py-0')} title="0" onClick={() => flushCamera({ ...DEFAULT_WHITEBOARD_CAMERA })}>{glyph(<span className="text-[11px] font-medium leading-none tabular-nums max-md:text-[12px]">{zoomPct}</span>)}<span className="block h-[11px] max-md:h-3" aria-hidden /></button>
                <button
                  type="button"
                  className={iconBtn(false)}
                  onClick={() => zoomByTen(1)}
                  title={`${tr('Phóng to', 'Zoom in', '放大', '拡大', '확대')} (+)`}
                  aria-label={tr('Phóng to', 'Zoom in', '放大', '拡大', '확대')}
                >
                  {glyph(<ZoomIn className="h-3.5 w-3.5" aria-hidden />)}
                  {cap(tr('Phóng', 'In', '放大', '拡大', '확대'))}
                </button>
                <button
                  type="button"
                  className={cn(iconBtn(state.grid), state.grid && 'bg-sky-400 text-slate-950')}
                  title={tr('Hiện hoặc ẩn ô lưới', 'Show or hide the grid', '显示或隐藏网格', '格子の表示', '격자 표시')}
                  aria-label={tr('Lưới', 'Grid', '网格', '格子', '격자')}
                  onClick={toggleGrid}
                >
                  {glyph(<Grid3x3 className="h-4 w-4" aria-hidden />)}
                  {cap(tr('Lưới', 'Grid', '网格', '格子', '격자'))}
                </button>
                {selectedIds.length > 0 ? (
                  <button type="button" className={iconBtn(false)} title="Delete" aria-label={tr('Xóa hình', 'Delete', '删除', '削除', '삭제')} onClick={removeSelected}>{glyph(<X className="h-4 w-4" aria-hidden />)}{cap(tr('Bỏ', 'Del', '删除', '削除', '삭제'))}</button>
                ) : null}
              </div>
            </div>
          </>
        )}
        {triangleAsk ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <div className={askCard} data-wb-entry onFocusCapture={holdEntryFocus} style={askFloatStyle(380)} role="dialog" onPointerDown={(e) => e.stopPropagation()}>
                  {askDialogHead(tr('Đây là tam giác gì?', 'What kind of triangle?', '这是哪种三角形？', 'どの三角形？', '어떤 삼각형?'))}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(['equilateral', 'isosceles', 'right', 'right-isosceles', 'scalene'] as TriangleKind[]).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        className={cn('rounded-full border px-2 py-1 text-[11px]', triKind === kind ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200')}
                        onClick={() => {
                          setTriKind(kind)
                          setTriSides((sides) => settleTriangleSides(kind, sides, 'bc'))
                          setTriError('')
                        }}
                      >
                        {triangleKindLabel(kind)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {tr('Sửa hai cạnh, cạnh còn lại tự tính. 1 ô = 1. Tam giác vuông: AB tính từ BC và CA, góc vuông tại C. Tam giác cân: AC = AB.', 'Edit two sides. The other side is calculated. 1 square = 1. Right triangle: AB comes from BC and CA, right angle at C. Isosceles: AC = AB.', '改两条边，另一条自动计算。1 格 = 1。直角三角形：AB 由 BC 和 CA 算出，直角在 C。等腰：AC = AB。', '二辺を直すと残りの辺は自動。1 マス = 1。直角三角形は AB を BC と CA から計算、直角は C。二等辺は AC = AB。', '두 변만 고치면 나머지 변은 자동 계산. 1칸 = 1. 직각삼각형은 AB를 BC와 CA로 계산, 직각은 C. 이등변은 AC = AB.')}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {(['ab', 'bc', 'ca'] as (keyof TriangleSides)[]).map((key) => {
                      const locked = triangleSideLocked(triKind, key)
                      return (
                      <label key={key} className="text-[11px] font-medium">
                        {key.toUpperCase()}
                        <input
                          value={triSides[key]}
                          readOnly={locked}
                          onChange={(e) => {
                            if (locked) return
                            const filled = fillTriangleSides(triKind, { ...triSides, [key]: e.target.value }, key)
                            setTriSides({ ...filled, [key]: e.target.value })
                            setTriError('')
                          }}
                          className={cn('mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]', locked && 'bg-slate-100 text-slate-600')}
                          inputMode="decimal"
                        />
                      </label>
                      )
                    })}
                  </div>
                  {triError ? <p className="mt-1 text-[11px] font-medium text-red-600">{triError}</p> : null}
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-[11px] text-slate-500"
                      onClick={keepTriangleSketch}
                    >
                      {tr('Giữ nét', 'Keep sketch', '保留草图', '下絵のまま', '스케치 유지')}
                    </button>
                    <button type="button" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white" onClick={confirmTriangle}>
                      {tr('Vẽ tam giác', 'Draw triangle', '画三角形', '三角形を描く', '삼각형 그리기')}
                    </button>
                    </div>
                  </div>
            </div>
          </div>
        ) : null}
        {solidAsk ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/45 p-4" onPointerDown={(e) => e.stopPropagation()}>
            <form
              className="w-full max-w-sm rounded-2xl bg-white p-4 text-slate-900 shadow-2xl"
              role="dialog"
              aria-modal="true"
              onSubmit={(e) => {
                e.preventDefault()
                confirmSolid()
              }}
            >
              <p className="text-sm font-semibold">{tr(SOLID_LABEL[solidAsk][0], SOLID_LABEL[solidAsk][1], SOLID_LABEL[solidAsk][2], SOLID_LABEL[solidAsk][3], SOLID_LABEL[solidAsk][4])}</p>
              <p className="mt-1 text-[12px] text-slate-600">
                {tr(
                  'Kích thước theo ô lưới. Điền đủ mới vẽ được.',
                  'Sizes are in grid cells. Fill in every field to draw.',
                  '尺寸按格子。填全才能画。',
                  '寸法はマス目。すべて入れると描けます。',
                  '치수는 칸 단위. 모두 채워야 그립니다.',
                )}
              </p>
              {SOLID_MEASURE_KEYS[solidAsk].map((key) => {
                const label = SOLID_FIELD_LABEL[`${solidAsk}.${key}`]
                return (
                  <label key={key} className="mt-2 block text-[11px] font-medium">
                    {tr(label[0], label[1], label[2], label[3], label[4])}
                    <input
                      value={solidFields[key] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        setSolidFields((prev) => ({ ...prev, [key]: value }))
                        setSolidError('')
                      }}
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                      inputMode="decimal"
                    />
                  </label>
                )
              })}
              {solidAsk === 'oblique-box' ? (
                <p className="mt-1 text-[11px] text-slate-500">
                  {tr(
                    'Độ xiên là độ lệch ngang của cạnh trên so với cạnh dưới, theo ô. Âm nếu lệch sang trái.',
                    'Slant is the horizontal shift of the top edge from the bottom, in cells. Negative shifts left.',
                    '斜偏是上边相对下边的水平偏移，按格子。负数为向左。',
                    '傾きは上の辺が下の辺より横にずれるマス目。負で左。',
                    '기울기는 윗변이 아랫변보다 가로로 어긋난 칸. 음수면 왼쪽.',
                  )}
                </p>
              ) : null}
              {solidError ? <p className="mt-1 text-[11px] font-medium text-red-600">{solidError}</p> : null}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" className="text-[11px] text-slate-500" onClick={disarmSolid}>
                  {tr('Hủy', 'Cancel', '取消', 'キャンセル', '취소')}
                </button>
                <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white">
                  {tr('Vẽ khối', 'Draw solid', '画立体', '立体を描く', '입체 그리기')}
                </button>
              </div>
            </form>
          </div>
        ) : null}
        {quadAsk ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <div className={askCard} data-wb-entry onFocusCapture={holdEntryFocus} style={askFloatStyle(440)} role="dialog" onPointerDown={(e) => e.stopPropagation()}>
              {askDialogHead(tr('Đây là tứ giác gì?', 'What kind of quadrilateral?', '这是哪种四边形？', 'どの四角形？', '어떤 사각형?'))}
              <div className="mt-2 flex flex-wrap gap-1">
                {(['square', 'rectangle', 'parallelogram', 'rhombus', 'trapezoid'] as QuadKind[]).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={cn('rounded-full border px-2 py-1 text-[11px]', quadKind === kind ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200')}
                    onClick={() => {
                      const nextAngle = kind === 'square' || kind === 'rectangle'
                        ? '90'
                        : kind === 'trapezoid'
                          ? formatWholeGrid(trapezoidHeight(quadAsk.corners))
                          : quadAsk.sketchAngle
                      setQuadKind(kind)
                      setQuadSides(wholeQuad(fillQuadSides(kind, gridQuad(quadAsk.measured), 'ab')))
                      setQuadAngle(nextAngle)
                      setQuadError('')
                    }}
                  >
                    {quadKindLabel(kind)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {quadKind === 'trapezoid'
                  ? tr(
                    'Đáy AB nằm ngang, đáy CD song song. Hai cạnh bên bằng nhau. 1 ô = 1.',
                    'Base AB is horizontal and CD is parallel. The legs are equal. 1 square = 1.',
                    '底边 AB 水平，CD 与它平行。两腰相等。1 格 = 1。',
                    '底辺 AB は水平、CD は平行。脚は等しい。1 マス = 1。',
                    '밑변 AB는 수평, CD는 평행. 두 다리는 같음. 1칸 = 1.',
                  )
                  : tr(
                    'Chỉ nhập AB và BC, 1 ô = 1. Cạnh đối lấy theo hai cạnh này. Cạnh AB nằm ngang. Hình thoi thì đường chéo AC nằm ngang.',
                    'Enter only AB and BC, 1 square = 1. Opposite sides follow these two. Side AB is horizontal. A rhombus has diagonal AC horizontal.',
                    '只填 AB 和 BC，1 格 = 1。对边与这两边相同。边 AB 水平。菱形则对角线 AC 水平。',
                    'AB と BC だけ入力、1 マス = 1。対辺はこの二辺に揃う。辺 AB は水平。ひし形は対角線 AC が水平。',
                    'AB와 BC만 입력, 1칸 = 1. 맞은편 변은 이 두 변을 따름. 변 AB는 수평. 마름모는 대각선 AC가 수평.',
                  )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(quadKind === 'trapezoid' ? (['ab', 'cd'] as (keyof QuadSides)[]) : (['ab', 'bc'] as (keyof QuadSides)[])).map((key) => (
                  <label key={key} className="text-[11px] font-medium">
                    {quadKind === 'trapezoid'
                      ? (key === 'ab' ? tr('Đáy AB', 'Base AB', '底边 AB', '底辺 AB', '밑변 AB') : tr('Đáy CD', 'Base CD', '上底 CD', '上底 CD', '윗변 CD'))
                      : key.toUpperCase()}
                    <input
                      value={quadSides[key]}
                      onChange={(e) => {
                        const filled = fillQuadSides(quadKind, { ...quadSides, [key]: e.target.value }, key)
                        const next = wholeQuad(filled)
                        setQuadSides({ ...next, [key]: e.target.value })
                        setQuadError('')
                      }}
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                      inputMode="decimal"
                    />
                  </label>
                ))}
              </div>
              {quadKind === 'parallelogram' || quadKind === 'rhombus' ? (
                <label className="mt-2 block text-[11px] font-medium">
                  {tr('Góc tại A (°)', 'Angle at A (°)', 'A 处的角 (°)', 'A の角 (°)', 'A의 각 (°)')}
                  <input
                    value={quadAngle}
                    onChange={(e) => {
                      setQuadAngle(e.target.value)
                      setQuadError('')
                    }}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                    inputMode="decimal"
                  />
                </label>
              ) : quadKind === 'trapezoid' ? (
                <label className="mt-2 block text-[11px] font-medium">
                  {tr('Chiều cao', 'Height', '高', '高さ', '높이')}
                  <input
                    value={quadAngle}
                    onChange={(e) => {
                      setQuadAngle(e.target.value)
                      setQuadError('')
                    }}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                    inputMode="decimal"
                  />
                </label>
              ) : (
                <p className="mt-2 text-[11px] text-slate-500">
                  {tr('Góc tại A là 90°.', 'The angle at A is 90°.', 'A 处的角是 90°。', 'A の角は 90°。', 'A의 각은 90°입니다.')}
                </p>
              )}
              {quadError ? <p className="mt-1 text-[11px] font-medium text-red-600">{quadError}</p> : null}
              <div className="mt-2 flex items-center justify-end gap-2">
                <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[11px] text-slate-500"
                  onClick={keepQuadSketch}
                >
                  {tr('Giữ nét', 'Keep sketch', '保留草图', '下絵のまま', '스케치 유지')}
                </button>
                <button type="button" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white" onClick={confirmQuad}>
                  {tr('Vẽ tứ giác', 'Draw quadrilateral', '画四边形', '四角形を描く', '사각형 그리기')}
                </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {straightAsk ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <form
              className={askCard} data-wb-entry onFocusCapture={holdEntryFocus}
              style={askFloatStyle(280)}
              role="dialog"
              onPointerDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault()
                confirmStraight()
              }}
            >
              {askDialogHead(tr('Đường thẳng', 'Straight line', '直线', '直線', '직선'))}
              <p className="mt-1 text-[12px] text-slate-600">
                {tr(
                  `Dài ${straightLengthLabel} · góc hợp với phương ngang ${straightAngleLabel}°`,
                  `Length ${straightLengthLabel} · angle with the horizontal ${straightAngleLabel}°`,
                  `长 ${straightLengthLabel} · 与水平方向所成角 ${straightAngleLabel}°`,
                  `長さ ${straightLengthLabel} · 水平方向との角 ${straightAngleLabel}°`,
                  `길이 ${straightLengthLabel} · 수평과 이루는 각 ${straightAngleLabel}°`,
                )}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {tr(
                  'Số theo ô lưới, 1 ô = 1. Để trống thì giữ nét vừa vẽ. 0° ngang sang phải, 90° lên, 270° xuống.',
                  'Numbers are grid squares, 1 square = 1. Leave blank to keep the stroke. 0° is right, 90° is up, 270° is down.',
                  '数字按网格，1 格 = 1。留空则保持所画。0° 向右，90° 向上，270° 向下。',
                  '数値はマス目、1 マス = 1。空欄なら描いたまま。0° は右、90° は上、270° は下。',
                  '숫자는 칸 단위, 1칸 = 1. 비워 두면 그린 그대로. 0°는 오른쪽, 90°는 위, 270°는 아래.',
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[11px] font-medium">
                  {tr('Độ dài', 'Length', '长度', '長さ', '길이')}
                  <input
                    value={straightLength}
                    placeholder={straightLengthLabel}
                    onChange={(e) => {
                      setStraightLength(e.target.value)
                      setStraightError('')
                    }}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-[11px] font-medium">
                  {tr('Góc hợp với phương ngang (°)', 'Angle with the horizontal (°)', '与水平方向所成角 (°)', '水平方向との角 (°)', '수평과 이루는 각 (°)')}
                  <input
                    value={straightAngle}
                    placeholder={straightAngleLabel}
                    onChange={(e) => {
                      setStraightAngle(e.target.value)
                      setStraightError('')
                    }}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                    inputMode="decimal"
                  />
                </label>
              </div>
              {straightError ? <p className="mt-1 text-[11px] font-medium text-red-600">{straightError}</p> : null}
              <div className="mt-2 flex items-center justify-end gap-2">
                <div className="flex gap-2">
                <button type="button" className="text-[11px] text-slate-500" onClick={keepStraightSketch}>
                  {tr('Giữ nét', 'Keep sketch', '保留草图', '下絵のまま', '스케치 유지')}
                </button>
                <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white">
                  {tr('Vẽ đường', 'Draw line', '画直线', '直線を描く', '직선 그리기')}
                </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
        {circleAsk ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <form
              className={askCard} data-wb-entry onFocusCapture={holdEntryFocus}
              style={askFloatStyle(340)}
              role="dialog"
              onPointerDown={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault()
                confirmCircle()
              }}
            >
              {askDialogHead(tr('Vẽ hình tròn hay elip?', 'Draw a circle or an ellipse?', '画圆还是椭圆？', '円と楕円のどちら？', '원과 타원 중 무엇?'))}
              <div className="mt-2 flex flex-wrap gap-1">
                {(['circle', 'ellipse'] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className={cn('rounded-full border px-2 py-1 text-[11px]', ovalKind === kind ? 'border-sky-600 bg-sky-50 text-sky-800' : 'border-slate-200')}
                    onClick={() => {
                      setOvalKind(kind)
                      setCircleError('')
                    }}
                  >
                    {kind === 'circle'
                      ? tr('Hình tròn', 'Circle', '圆', '円', '원')
                      : tr('Elip', 'Ellipse', '椭圆', '楕円', '타원')}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {ovalKind === 'circle'
                  ? tr(
                    'Đường kính theo ô lưới, 1 ô = 1. Để trống thì giữ hình vừa vẽ, tâm giữ nguyên.',
                    'Diameter is in grid squares, 1 square = 1. Leave blank to keep the sketch; the center stays.',
                    '直径按网格，1 格 = 1。留空则保持所画的图，圆心不变。',
                    '直径はマス目、1 マス = 1。空欄なら描いた図のまま、中心はそのまま。',
                    '지름은 칸 단위, 1칸 = 1. 비워 두면 그린 도형을 유지하고 중심은 그대로입니다.',
                  )
                  : tr(
                    'Trục dài và trục ngắn theo ô lưới, 1 ô = 1. Để trống thì giữ elip vừa vẽ. Tâm và hướng giữ nguyên.',
                    'Long and short axes are in grid squares, 1 square = 1. Leave blank to keep the ellipse. Center and direction stay.',
                    '长轴和短轴按网格，1 格 = 1。留空则保持所画的椭圆。中心和方向不变。',
                    '長軸と短軸はマス目、1 マス = 1。空欄なら描いた楕円のまま。中心と向きはそのまま。',
                    '긴 축과 짧은 축은 칸 단위, 1칸 = 1. 비워 두면 그린 타원을 유지합니다. 중심과 방향은 그대로입니다.',
                  )}
              </p>
              {ovalKind === 'circle' ? (
                <label className="mt-2 block text-[11px] font-medium">
                  {tr('Đường kính', 'Diameter', '直径', '直径', '지름')}
                  <input
                    value={circleDiameter}
                    placeholder={circleDiameterLabel}
                    onChange={(e) => {
                      setCircleDiameter(e.target.value)
                      setCircleError('')
                    }}
                    className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                    inputMode="decimal"
                  />
                </label>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-1">
                  <label className="text-[11px] font-medium">
                    {tr('Trục dài', 'Long axis', '长轴', '長軸', '긴 축')}
                    <input
                      value={ellipseMajor}
                      onChange={(e) => {
                        setEllipseMajor(e.target.value)
                        setCircleError('')
                      }}
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="text-[11px] font-medium">
                    {tr('Trục ngắn', 'Short axis', '短轴', '短軸', '짧은 축')}
                    <input
                      value={ellipseMinor}
                      onChange={(e) => {
                        setEllipseMinor(e.target.value)
                        setCircleError('')
                      }}
                      className="mt-0.5 h-8 w-full rounded border border-slate-300 px-2 text-[12px]"
                      inputMode="decimal"
                    />
                  </label>
                </div>
              )}
              {circleError ? <p className="mt-1 text-[11px] font-medium text-red-600">{circleError}</p> : null}
              <div className="mt-2 flex items-center justify-end gap-2">
                <div className="flex gap-2">
                <button type="button" className="text-[11px] text-slate-500" onClick={keepCircleSketch}>
                  {tr('Giữ nét', 'Keep sketch', '保留草图', '下絵のまま', '스케치 유지')}
                </button>
                <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-[12px] font-medium text-white">
                  {ovalKind === 'circle'
                    ? tr('Vẽ hình tròn', 'Draw circle', '画圆', '円を描く', '원 그리기')
                    : tr('Vẽ elip', 'Draw ellipse', '画椭圆', '楕円を描く', '타원 그리기')}
                </button>
                </div>
              </div>
            </form>
          </div>
        ) : null}
        {lineAsk ? (
          <div className="pointer-events-none absolute inset-0 z-40">
            <div className={askCard} data-wb-entry onFocusCapture={holdEntryFocus} style={askFloatStyle(400)} role="dialog" onPointerDown={(e) => e.stopPropagation()}>
                  {askDialogHead(tr(
                    `Đường từ đỉnh ${lineAsk.vertexNames[lineAsk.vertex] || triangleVertexName(lineAsk.vertex)} là đường gì?`,
                    `Which triangle line from ${lineAsk.vertexNames[lineAsk.vertex] || triangleVertexName(lineAsk.vertex)}?`,
                    `从顶点 ${lineAsk.vertexNames[lineAsk.vertex] || triangleVertexName(lineAsk.vertex)} 画哪条线？`,
                    `頂点 ${lineAsk.vertexNames[lineAsk.vertex] || triangleVertexName(lineAsk.vertex)} からどの線？`,
                    `${lineAsk.vertexNames[lineAsk.vertex] || triangleVertexName(lineAsk.vertex)}에서 어떤 선?`,
                  ))}
                  <div className="mt-2 grid grid-cols-1 gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-[12px] hover:bg-slate-50"
                      onClick={keepArbitraryLine}
                    >
                      {tr('Đường bất kỳ', 'Arbitrary line', '任意直线', '任意の直線', '임의 직선')}
                    </button>
                    {TRIANGLE_LINE_ROLES.map((role) => (
                      <button
                        key={role}
                        type="button"
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-left text-[12px] hover:bg-slate-50"
                        onClick={() => chooseTriangleLine(role)}
                      >
                        {triangleLineLabel(role)}
                      </button>
                    ))}
                  </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function applyRemoteWhiteboard(
  state: WhiteboardState,
  msg: Record<string, unknown>,
): WhiteboardState {
  const type = typeof msg.type === 'string' ? msg.type : ''
  if (!isWhiteboardWireType(type)) return state
  return applyWhiteboardMessage(state, msg as WhiteboardWireMessage)
}

export { emptyWhiteboardState, DEFAULT_WHITEBOARD_CAMERA }
