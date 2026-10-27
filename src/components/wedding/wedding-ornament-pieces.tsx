import type { ReactElement } from 'react'
import type { OrnamentKit, OrnamentPieceId } from '@/lib/wedding/wedding-ornament-layouts'

type PieceProps = { kit: OrnamentKit }

function Leaf(props: { cx: number; cy: number; rot: number; fill: string; rx?: number; ry?: number }) {
  const rx = props.rx ?? 16
  const ry = props.ry ?? 6
  return <ellipse cx={props.cx} cy={props.cy} rx={rx} ry={ry} fill={props.fill} transform={`rotate(${props.rot} ${props.cx} ${props.cy})`} />
}

function Blossom(props: { cx: number; cy: number; r: number; fill: string; core: string }) {
  const { cx, cy, r, fill, core } = props
  return (
    <g>
      <circle cx={cx - r * 0.42} cy={cy + r * 0.08} r={r * 0.52} fill={fill} />
      <circle cx={cx + r * 0.4} cy={cy - r * 0.05} r={r * 0.48} fill={fill} />
      <circle cx={cx} cy={cy + r * 0.4} r={r * 0.46} fill={fill} />
      <circle cx={cx} cy={cy - r * 0.28} r={r * 0.4} fill={fill} />
      <circle cx={cx} cy={cy} r={r * 0.18} fill={core} />
    </g>
  )
}

function Stem(props: { x1: number; y1: number; x2: number; y2: number; color: string; sw?: number }) {
  return <line x1={props.x1} y1={props.y1} x2={props.x2} y2={props.y2} stroke={props.color} strokeWidth={props.sw ?? 1.6} strokeLinecap="round" />
}

function Butterfly({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full overflow-visible">
      <ellipse cx="68" cy="58" rx="52" ry="36" fill={kit.petal} transform="rotate(-16 68 58)" />
      <ellipse cx="152" cy="58" rx="52" ry="36" fill={kit.petal} transform="rotate(16 152 58)" />
      <ellipse cx="78" cy="96" rx="34" ry="24" fill={kit.petalDeep} transform="rotate(10 78 96)" />
      <ellipse cx="142" cy="96" rx="34" ry="24" fill={kit.petalDeep} transform="rotate(-10 142 96)" />
      <ellipse cx="64" cy="54" rx="22" ry="14" fill={kit.dot} opacity="0.85" transform="rotate(-16 64 54)" />
      <ellipse cx="156" cy="54" rx="22" ry="14" fill={kit.dot} opacity="0.85" transform="rotate(16 156 54)" />
      <circle cx="52" cy="48" r="3.2" fill={kit.leaf} />
      <circle cx="78" cy="70" r="2.4" fill={kit.leaf} />
      <circle cx="168" cy="48" r="3.2" fill={kit.leaf} />
      <circle cx="142" cy="70" r="2.4" fill={kit.leaf} />
      <ellipse cx="110" cy="78" rx="4.5" ry="28" fill={kit.stem} />
      <circle cx="110" cy="48" r="5" fill={kit.stem} />
      <path d="M106 46 C98 28 90 24 86 20" fill="none" stroke={kit.stem} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M114 46 C122 28 130 24 134 20" fill="none" stroke={kit.stem} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="84" cy="18" r="2.2" fill={kit.petalDeep} />
      <circle cx="136" cy="18" r="2.2" fill={kit.petalDeep} />
    </svg>
  )
}

function Garland({ kit }: PieceProps) {
  const stems = [40, 110, 180, 250, 320, 390, 460, 530, 600]
  return (
    <svg viewBox="0 0 640 190" className="h-full w-full overflow-visible">
      {stems.map((x, index) => {
        const lean = index % 2 === 0 ? -10 : 12
        const top = 28 + (index % 3) * 16
        return (
          <g key={x}>
            <Stem x1={x} y1={188} x2={x + lean} y2={top} color={kit.stem} sw={1.5} />
            <Leaf cx={x + lean * 0.4} cy={120} rot={lean * 3} fill={kit.leaf} rx={14} ry={5} />
            <ellipse cx={x + lean} cy={top + 8} rx={7} ry={11} fill={index % 3 === 0 ? kit.leaf : kit.petalDeep} transform={`rotate(${lean} ${x + lean} ${top + 8})`} />
            <circle cx={x + lean * 0.2} cy={top + 36} r={3.5} fill={kit.dot} />
          </g>
        )
      })}
      <Blossom cx={150} cy={78} r={22} fill={kit.petal} core={kit.metal} />
      <Blossom cx={330} cy={96} r={26} fill={kit.petal} core={kit.petalDeep} />
      <Blossom cx={500} cy={70} r={20} fill={kit.petalDeep} core={kit.dot} />
      <Leaf cx={210} cy={130} rot={-30} fill={kit.leaf} rx={22} ry={7} />
      <Leaf cx={430} cy={140} rot={28} fill={kit.leaf} rx={20} ry={7} />
    </svg>
  )
}

function Sprig({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 180 280" className="h-full w-full overflow-visible">
      <Stem x1={28} y1={268} x2={70} y2={40} color={kit.stem} sw={1.7} />
      <Stem x1={36} y1={250} x2={130} y2={90} color={kit.stem} sw={1.4} />
      <Stem x1={24} y1={240} x2={16} y2={120} color={kit.stem} sw={1.3} />
      <Leaf cx={48} cy={180} rot={-40} fill={kit.leaf} />
      <Leaf cx={96} cy={150} rot={30} fill={kit.leaf} rx={18} ry={6} />
      <Leaf cx={40} cy={120} rot={-20} fill={kit.leaf} rx={14} ry={5} />
      <Blossom cx={74} cy={48} r={24} fill={kit.petal} core={kit.petalDeep} />
      <Blossom cx={128} cy={96} r={16} fill={kit.petalDeep} core={kit.dot} />
      <ellipse cx={20} cy={118} rx={8} ry={14} fill={kit.leaf} transform="rotate(-8 20 118)" />
      <circle cx={58} cy={90} r={4} fill={kit.dot} />
      <circle cx={100} cy={70} r={3} fill={kit.dot} />
    </svg>
  )
}

function Peony({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full overflow-visible">
      <Leaf cx={70} cy={150} rot={-36} fill={kit.leaf} rx={36} ry={12} />
      <Leaf cx={130} cy={168} rot={24} fill={kit.leaf} rx={30} ry={10} />
      <Leaf cx={40} cy={100} rot={-70} fill={kit.leaf} rx={26} ry={9} />
      <Blossom cx={78} cy={78} r={46} fill={kit.petal} core={kit.petalDeep} />
      <Blossom cx={132} cy={112} r={28} fill={kit.petalDeep} core={kit.dot} />
      <Blossom cx={46} cy={124} r={16} fill={kit.dot} core={kit.metal} />
      <Stem x1={78} y1={120} x2={70} y2={210} color={kit.stem} sw={1.8} />
    </svg>
  )
}

function Vine({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 120 640" className="h-full w-full overflow-visible">
      <path d="M70 8 C 40 80, 90 140, 48 220 C 10 300, 86 360, 40 460 C 8 530, 72 580, 36 632" fill="none" stroke={kit.stem} strokeWidth="1.7" strokeLinecap="round" />
      <Leaf cx={46} cy={90} rot={-30} fill={kit.leaf} />
      <Leaf cx={78} cy={170} rot={36} fill={kit.leaf} rx={18} ry={6} />
      <Leaf cx={34} cy={250} rot={-24} fill={kit.leaf} />
      <Leaf cx={72} cy={340} rot={28} fill={kit.leaf} rx={16} ry={6} />
      <Leaf cx={30} cy={430} rot={-32} fill={kit.leaf} />
      <Leaf cx={64} cy={530} rot={24} fill={kit.leaf} rx={18} ry={6} />
      <Blossom cx={58} cy={200} r={16} fill={kit.petal} core={kit.petalDeep} />
      <Blossom cx={48} cy={400} r={14} fill={kit.petalDeep} core={kit.dot} />
      <Blossom cx={52} cy={580} r={12} fill={kit.petal} core={kit.metal} />
    </svg>
  )
}

function Seal({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 160 160" className="h-full w-full overflow-visible">
      <circle cx="80" cy="80" r="62" fill={kit.metal} />
      <circle cx="80" cy="80" r="48" fill="none" stroke={kit.dot} strokeWidth="2" />
      <path
        d="M80 108 C80 108 48 84 48 64 C48 50 60 44 70 52 C76 46 84 46 90 52 C100 44 112 50 112 64 C112 84 80 108 80 108 Z"
        fill={kit.petal}
      />
    </svg>
  )
}

function Wreath({ kit }: PieceProps) {
  const buds = Array.from({ length: 26 }, (_, index) => {
    const angle = (index / 26) * Math.PI * 2 - Math.PI / 2
    return {
      cx: 200 + Math.cos(angle) * 148,
      cy: 260 + Math.sin(angle) * 196,
      rot: (angle * 180) / Math.PI,
      big: index % 6 === 0,
    }
  })
  return (
    <svg viewBox="0 0 400 520" className="h-full w-full overflow-visible">
      {buds.map((bud) => (
        <g key={`${bud.cx}-${bud.cy}`}>
          <Leaf cx={bud.cx} cy={bud.cy} rot={bud.rot} fill={kit.leaf} rx={bud.big ? 22 : 14} ry={bud.big ? 8 : 5} />
        </g>
      ))}
      {buds.map((bud, index) =>
        bud.big ? <Blossom key={`b-${index}`} cx={bud.cx} cy={bud.cy} r={index % 12 === 0 ? 22 : 16} fill={index % 12 === 0 ? kit.petal : kit.petalDeep} core={kit.dot} /> : null,
      )}
    </svg>
  )
}

function Arch({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 400 560" className="h-full w-full overflow-visible">
      <path d="M70 540 L70 190 Q70 48 200 48 Q330 48 330 190 L330 540" fill="none" stroke={kit.metal} strokeWidth="3" strokeLinecap="round" />
      <path d="M86 540 L86 196 Q86 70 200 70 Q314 70 314 196 L314 540" fill="none" stroke={kit.petalDeep} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      <Blossom cx={200} cy={46} r={22} fill={kit.petal} core={kit.petalDeep} />
      <Leaf cx={150} cy={70} rot={-40} fill={kit.leaf} />
      <Leaf cx={250} cy={70} rot={40} fill={kit.leaf} />
      <Blossom cx={78} cy={150} r={14} fill={kit.petalDeep} core={kit.dot} />
      <Blossom cx={322} cy={150} r={14} fill={kit.petalDeep} core={kit.dot} />
    </svg>
  )
}

function Plate({ kit }: PieceProps) {
  return (
    <svg viewBox="0 0 400 520" className="h-full w-full overflow-visible">
      <rect x="28" y="36" width="344" height="448" rx="28" fill="none" stroke={kit.metal} strokeWidth="2.2" />
      <rect x="40" y="48" width="320" height="424" rx="20" fill="none" stroke={kit.petalDeep} strokeWidth="1" opacity="0.85" />
      <circle cx="48" cy="56" r="3" fill={kit.metal} />
      <circle cx="352" cy="56" r="3" fill={kit.metal} />
      <circle cx="48" cy="464" r="3" fill={kit.metal} />
      <circle cx="352" cy="464" r="3" fill={kit.metal} />
    </svg>
  )
}

const PIECES: Record<OrnamentPieceId, (props: PieceProps) => ReactElement> = {
  butterfly: Butterfly,
  garland: Garland,
  sprig: Sprig,
  peony: Peony,
  vine: Vine,
  seal: Seal,
  wreath: Wreath,
  arch: Arch,
  plate: Plate,
}

export function WeddingOrnamentPiece(props: { id: OrnamentPieceId; kit: OrnamentKit }) {
  const Piece = PIECES[props.id]
  return <Piece kit={props.kit} />
}
