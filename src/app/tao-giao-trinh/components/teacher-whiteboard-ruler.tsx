'use client'

import type { PointerEvent as ReactPointerEvent, SVGProps } from 'react'
import { formatWholeGrid } from '../lib/teacher-whiteboard/line-measure'
import { rulerKindOf, type WhiteboardRuler } from '../lib/teacher-whiteboard/ruler'
import { WHITEBOARD_GRID, type WhiteboardCamera } from '../lib/teacher-whiteboard/types'
import { worldToScreen } from '../lib/teacher-whiteboard/geometry'

export type RulerDragMode = 'move' | 'rotate' | 'end' | 'arm' | 'rim'

const PLASTIC_FILL = 'rgba(125, 211, 252, 0.38)'
const PLASTIC_STROKE = '#0284c7'
const PLASTIC_INK = '#075985'
const PLASTIC_SHEEN = 'rgba(255, 255, 255, 0.72)'

type Props = {
  ruler: WhiteboardRuler
  camera: WhiteboardCamera
  boardW: number
  boardH: number
  onPointerDown: (mode: RulerDragMode, event: ReactPointerEvent<SVGElement>) => void
  onPointerMove: (event: ReactPointerEvent<SVGElement>) => void
  onPointerUp: () => void
  onClose: () => void
}

function MeasureOrigin() {
  return (
    <g className="pointer-events-none">
      <line x1={-9} y1={0} x2={9} y2={0} stroke="#ffffff" strokeWidth={3.4} />
      <line x1={0} y1={-9} x2={0} y2={9} stroke="#ffffff" strokeWidth={3.4} />
      <line x1={-9} y1={0} x2={9} y2={0} stroke="#0f172a" strokeWidth={1.4} />
      <line x1={0} y1={-9} x2={0} y2={9} stroke="#0f172a" strokeWidth={1.4} />
      <circle r={2.1} fill="#0f172a" />
    </g>
  )
}

function RotatePivot(props: { x: number; y: number; upright: number; hit: ReturnType<typeof bind> }) {
  return (
    <g transform={`translate(${props.x} ${props.y}) rotate(${props.upright})`} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...props.hit}>
      <circle r={18} fill="transparent" />
      <circle r={8} fill="#ffffff" stroke={PLASTIC_STROKE} strokeWidth={2} className="pointer-events-none" />
      <path d="M6.8 11.7 A13.5 13.5 0 1 1 11.7 -6.8" fill="none" stroke="#ffffff" strokeWidth={4.4} strokeLinecap="round" className="pointer-events-none" />
      <path d="M6.8 11.7 A13.5 13.5 0 1 1 11.7 -6.8" fill="none" stroke={PLASTIC_INK} strokeWidth={2.5} strokeLinecap="round" className="pointer-events-none" />
      <path d="M7.4 -5 L15.7 0.1 L15.4 -9.6 Z" fill={PLASTIC_INK} className="pointer-events-none" />
    </g>
  )
}

function CloseRuler(props: { x: number; y: number; upright: number; onClose: () => void }) {
  return (
    <g
      transform={`translate(${props.x} ${props.y}) rotate(${props.upright})`}
      className="cursor-pointer"
      style={{ pointerEvents: 'auto' }}
      onPointerDown={(event) => {
        event.stopPropagation()
        event.preventDefault()
        props.onClose()
      }}
    >
      <circle r={10} fill="#ffffff" stroke="#b91c1c" strokeWidth={1.75} />
      <path d="M-3.6 -3.6 L3.6 3.6 M3.6 -3.6 L-3.6 3.6" stroke="#b91c1c" strokeWidth={2} strokeLinecap="round" className="pointer-events-none" />
    </g>
  )
}

function bind(
  mode: RulerDragMode,
  props: Props,
): Pick<SVGProps<SVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'> {
  return {
    onPointerDown: (event) => props.onPointerDown(mode, event),
    onPointerMove: props.onPointerMove,
    onPointerUp: props.onPointerUp,
    onPointerCancel: props.onPointerUp,
  }
}

export function WhiteboardRulerGraphic(props: Props) {
  const { ruler, camera, boardW, boardH } = props
  const scale = camera.scale || 1
  const origin = worldToScreen({ x: ruler.x, y: ruler.y }, camera, boardW, boardH)
  const kind = rulerKindOf(ruler)
  const lenPx = Math.max(1, ruler.length * scale)
  const flip = ruler.angleDeg > 90 && ruler.angleDeg < 270
  const hand = bind('move', props)
  const pivot = bind('rotate', props)
  const end = bind('end', props)
  const arm = bind('arm', props)
  const rim = bind('rim', props)

  if (kind === 'length') {
    const mmCount = Math.max(0, Math.round((ruler.length / WHITEBOARD_GRID) * 10))
    const ticks: number[] = []
    for (let mm = 0; mm <= mmCount; mm += 1) ticks.push(mm)
    return (
      <g transform={`translate(${origin.x} ${origin.y}) rotate(${-ruler.angleDeg})`}>
        <rect x={0} y={0} width={lenPx} height={26} rx={4} fill={PLASTIC_FILL} stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-move" style={{ pointerEvents: 'auto' }} {...hand} />
        <line x1={3} y1={2} x2={Math.max(3, lenPx - 3)} y2={2} stroke={PLASTIC_SHEEN} strokeWidth={1.25} className="pointer-events-none" />
        {ticks.map((mm) => {
          const x = (mm * WHITEBOARD_GRID * scale) / 10
          const cm = mm % 10 === 0
          const half = mm % 5 === 0
          return (
            <g key={mm} className="pointer-events-none">
              <line x1={x} y1={0} x2={x} y2={cm ? 12 : half ? 7 : 3.5} stroke={PLASTIC_INK} strokeWidth={cm ? 1.15 : 0.8} />
              {cm ? <text x={x + 2} y={22} fill={PLASTIC_INK} fontSize={9}>{mm / 10}</text> : null}
            </g>
          )
        })}
        <text x={lenPx / 2} y={-8} fill={PLASTIC_INK} fontSize={12} fontWeight={700} textAnchor="middle" transform={flip ? `rotate(180 ${lenPx / 2} -8)` : undefined} className="pointer-events-none">
          {formatWholeGrid(ruler.length)}
        </text>
        <MeasureOrigin />
        <line x1={Math.max(36, lenPx * 0.72)} y1={0} x2={Math.max(72, lenPx * 0.75)} y2={-40} stroke={PLASTIC_STROKE} strokeWidth={1.25} className="pointer-events-none" />
        <RotatePivot x={Math.max(72, lenPx * 0.75)} y={-40} upright={ruler.angleDeg} hit={pivot} />
        <circle cx={lenPx} cy={0} r={8} fill="#e0f2fe" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...end} />
        <CloseRuler x={lenPx + 16} y={-16} upright={ruler.angleDeg} onClose={props.onClose} />
      </g>
    )
  }

  if (kind === 'protractor') {
    const radius = lenPx
    const armDeg = Math.max(0, Math.min(180, ruler.armDeg ?? 0))
    const armRad = (armDeg * Math.PI) / 180
    const armX = Math.cos(armRad) * radius
    const armY = -Math.sin(armRad) * radius
    const ticks: number[] = []
    for (let d = 0; d <= 180; d += 10) ticks.push(d)
    return (
      <g transform={`translate(${origin.x} ${origin.y}) rotate(${-ruler.angleDeg})`}>
        <path d={`M ${radius} 0 A ${radius} ${radius} 0 0 0 ${-radius} 0 Z`} fill={PLASTIC_FILL} stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-move" style={{ pointerEvents: 'auto' }} {...hand} />
        <path d={`M ${radius - 3} 0 A ${radius - 3} ${radius - 3} 0 0 0 ${-(radius - 3)} 0`} fill="none" stroke={PLASTIC_SHEEN} strokeWidth={1.25} className="pointer-events-none" />
        {ticks.map((d) => {
          const rad = (d * Math.PI) / 180
          const outer = radius
          const inner = radius - (d % 30 === 0 ? 14 : 7)
          const major = d % 30 === 0
          return (
            <g key={d} className="pointer-events-none">
              <line x1={Math.cos(rad) * inner} y1={-Math.sin(rad) * inner} x2={Math.cos(rad) * outer} y2={-Math.sin(rad) * outer} stroke={PLASTIC_INK} strokeWidth={1} />
              {major ? (
                <text x={Math.cos(rad) * (radius - 24)} y={-Math.sin(rad) * (radius - 24)} fill={PLASTIC_INK} fontSize={9} textAnchor="middle" dominantBaseline="middle">{d}</text>
              ) : null}
            </g>
          )
        })}
        <line x1={0} y1={0} x2={armX} y2={armY} stroke={PLASTIC_STROKE} strokeWidth={1.5} className="pointer-events-none" />
        <text x={0} y={16} fill={PLASTIC_INK} fontSize={12} fontWeight={700} textAnchor="middle" className="pointer-events-none">{Math.round(armDeg)}°</text>
        <circle cx={radius} cy={0} r={8} fill="#e0f2fe" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...end} />
        <circle cx={armX} cy={armY} r={8} fill="#e0f2fe" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...arm} />
        <MeasureOrigin />
        <line x1={0} y1={-radius} x2={0} y2={-(radius + 28)} stroke={PLASTIC_STROKE} strokeWidth={1.25} className="pointer-events-none" />
        <RotatePivot x={0} y={-(radius + 28)} upright={ruler.angleDeg} hit={pivot} />
        <CloseRuler x={radius + 16} y={-16} upright={ruler.angleDeg} onClose={props.onClose} />
      </g>
    )
  }

  if (kind === 'compass') {
    return (
      <g transform={`translate(${origin.x} ${origin.y}) rotate(${-ruler.angleDeg})`}>
        <circle r={lenPx} fill={PLASTIC_FILL} stroke="none" className="pointer-events-none" />
        <circle r={lenPx} fill="none" stroke="transparent" strokeWidth={16} className="cursor-move" style={{ pointerEvents: 'auto' }} {...hand} />
        <circle r={lenPx} fill="none" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="pointer-events-none" />
        <circle r={Math.max(1, lenPx - 3)} fill="none" stroke={PLASTIC_SHEEN} strokeWidth={1.25} className="pointer-events-none" />
        <line x1={0} y1={0} x2={lenPx} y2={0} stroke={PLASTIC_STROKE} strokeWidth={1.5} className="pointer-events-none" />
        <text x={0} y={-14} fill={PLASTIC_INK} fontSize={12} fontWeight={700} textAnchor="middle" className="pointer-events-none">{formatWholeGrid(ruler.length)}</text>
        <MeasureOrigin />
        <line x1={-lenPx} y1={0} x2={-(lenPx + 28)} y2={0} stroke={PLASTIC_STROKE} strokeWidth={1.25} className="pointer-events-none" />
        <RotatePivot x={-(lenPx + 28)} y={0} upright={ruler.angleDeg} hit={pivot} />
        <circle cx={lenPx} cy={0} r={8} fill="#e0f2fe" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...rim} />
        <CloseRuler x={lenPx + 16} y={-16} upright={ruler.angleDeg} onClose={props.onClose} />
      </g>
    )
  }

  const short = kind === 'set-square-60' ? lenPx / Math.sqrt(3) : lenPx
  const points = `0,0 ${lenPx},0 0,${-short}`
  const farLabel = kind === 'set-square-60' ? '30°' : '45°'
  const topLabel = kind === 'set-square-60' ? '60°' : '45°'
  const midX = lenPx / 2
  const midY = -short / 2
  const midLen = Math.hypot(midX, midY) || 1
  const spinX = midX + (midX / midLen) * 36
  const spinY = midY + (midY / midLen) * 36
  return (
    <g transform={`translate(${origin.x} ${origin.y}) rotate(${-ruler.angleDeg})`}>
      <polygon points={points} fill={PLASTIC_FILL} stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-move" style={{ pointerEvents: 'auto' }} {...hand} />
      <text x={18} y={-10} fill={PLASTIC_INK} fontSize={11} fontWeight={700} className="pointer-events-none">90°</text>
      <text x={lenPx - 28} y={-8} fill={PLASTIC_INK} fontSize={11} fontWeight={700} className="pointer-events-none">{farLabel}</text>
      <text x={8} y={-short + 16} fill={PLASTIC_INK} fontSize={11} fontWeight={700} className="pointer-events-none">{topLabel}</text>
      <text x={lenPx / 3} y={-short / 2} fill={PLASTIC_INK} fontSize={12} fontWeight={700} textAnchor="middle" className="pointer-events-none">{formatWholeGrid(ruler.length)}</text>
      <MeasureOrigin />
      <line x1={midX} y1={midY} x2={spinX} y2={spinY} stroke={PLASTIC_STROKE} strokeWidth={1.25} className="pointer-events-none" />
      <RotatePivot x={spinX} y={spinY} upright={ruler.angleDeg} hit={pivot} />
      <circle cx={lenPx} cy={0} r={8} fill="#e0f2fe" stroke={PLASTIC_STROKE} strokeWidth={1.5} className="cursor-grab" style={{ pointerEvents: 'auto' }} {...end} />
      <CloseRuler x={lenPx + 16} y={-16} upright={ruler.angleDeg} onClose={props.onClose} />
    </g>
  )
}
