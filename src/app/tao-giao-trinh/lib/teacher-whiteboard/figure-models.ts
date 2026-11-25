import { clamp, tuneAt } from './bench-style'

export const METAL_SERIES = ['K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe', 'H', 'Cu', 'Ag'] as const

export const RUST_EQUATION = '4Fe + 3O2 → 2Fe2O3'

export const SHELLS = {
  Na: [2, 8, 1],
  Cl: [2, 8, 7],
} as const

export const ZINC_COPPER = { zn0: 0, zn1: 2, cu0: 2, cu1: 0 }

export const CARBON_ARROWS = [
  { id: 'photo', from: 'air', to: 'plant' },
  { id: 'respire', from: 'plant', to: 'air' },
  { id: 'burn', from: 'fuel', to: 'air' },
  { id: 'decay', from: 'life', to: 'soil' },
] as const

export function numberLineRange(variant: string): [number, number] {
  if (variant === 'hundred') return [0, 100]
  if (variant === 'fraction' || variant === 'decimal') return [0, 1]
  if (variant === 'integer') return [-5, 5]
  return [0, 10]
}

export function numberLineValue(variant: string, t: number) {
  const [lo, hi] = numberLineRange(variant)
  const span = clamp(t, 0, 1)
  return lo + span * (hi - lo)
}

export function fractionParts(tune?: number[]) {
  const den = clamp(Math.round(2 + tuneAt(tune, 0, 0.2) * 10), 2, 12)
  const num = clamp(Math.round(tuneAt(tune, 1, 0.5) * den), 0, den)
  return { num, den }
}

export function percentCount(t: number) {
  return clamp(Math.round(clamp(t, 0, 1) * 100), 0, 100)
}

export function linePairAngles(t: number) {
  const one = 30 + clamp(t, 0, 1) * 80
  return { one, other: 180 - one }
}

export function proportionPair(kind: 'direct' | 'inverse', x: number) {
  const safe = clamp(x, 0.5, 6)
  if (kind === 'inverse') {
    const y = 12 / safe
    return { x: safe, y, product: safe * y, ratio: safe / y }
  }
  const y = 2 * safe
  return { x: safe, y, product: safe * y, ratio: y / safe }
}

export function thalesSplits(t: number) {
  const split = clamp(t, 0.25, 0.75)
  return { left: split, right: split }
}

export function pythagorasParts(a: number, b: number) {
  const legA = clamp(a, 0.4, 2.4)
  const legB = clamp(b, 0.4, 2.4)
  return { a: legA, b: legB, a2: legA * legA, b2: legB * legB, c2: legA * legA + legB * legB }
}

export function inscribedAngle(central: number) {
  return central / 2
}

export function vectorSum(ax: number, ay: number, bx: number, by: number) {
  return { x: ax + bx, y: ay + by }
}

export function vectorFromTune(tune?: number[]) {
  const ax = tuneAt(tune, 0, 0.62) * 2 - 0.2
  const ay = tuneAt(tune, 1, 0.28)
  const bx = tuneAt(tune, 2, 0.25) * 2 - 0.3
  const by = tuneAt(tune, 3, 0.62)
  return { ax, ay, bx, by, ...vectorSum(ax, ay, bx, by) }
}

export function chanceLeaves() {
  return [0.5, 0.25, 0.25]
}

export function sequenceTerms(kind: 'arith' | 'geom', step: number) {
  const d = kind === 'geom' ? clamp(step, 2, 3) : clamp(step, -4, 5)
  const out: number[] = []
  for (let n = 1; n <= 5; n += 1) out.push(kind === 'arith' ? 2 + (n - 1) * d : 2 * d ** (n - 1))
  return out
}

export function tangentSlope(x0: number) {
  return 2 * x0
}

export function integralArea(steps = 800) {
  let sum = 0
  for (let i = 0; i < steps; i += 1) {
    const x = (i + 0.5) / steps
    sum += (x - x * x) / steps
  }
  return sum
}

export function complexModulus(a: number, b: number) {
  return Math.hypot(a, b)
}

export function normalDensity(x: number, mean: number, sd: number) {
  const width = Math.max(0.15, sd)
  const z = (x - mean) / width
  return Math.exp(-0.5 * z * z) / (width * Math.sqrt(2 * Math.PI))
}

export function leverForces(d1: number) {
  const left = clamp(d1, 0.4, 2.5)
  const d2 = 1
  const f2 = 10
  const f1 = (f2 * d2) / left
  return { f1, f2, d1: left, d2, moment: f1 * left - f2 * d2 }
}

export function centripetalAccel(v: number, r: number) {
  return (v * v) / Math.max(0.2, r)
}

export function elastic1d(m1: number, v1: number, m2: number, v2: number) {
  const left = Math.max(0.2, m1)
  const right = Math.max(0.2, m2)
  const v1f = ((left - right) * v1 + 2 * right * v2) / (left + right)
  const v2f = ((right - left) * v2 + 2 * left * v1) / (left + right)
  return { v1f, v2f, before: left * v1 + right * v2, after: left * v1f + right * v2f }
}

export function hookeForce(k: number, stretch: number) {
  return Math.max(0.2, k) * stretch
}

export function rlcAmplitude(freq: number, f0: number, peak = 1) {
  if (!(freq > 0) || !(f0 > 0)) return 0
  const delta = freq / f0 - f0 / freq
  return peak / Math.sqrt(1 + 25 * delta * delta)
}

export function shellTotal(element: keyof typeof SHELLS) {
  return SHELLS[element].reduce((sum, count) => sum + count, 0)
}

export function equilibriumProduct(heat: number, exothermic = true) {
  const t = clamp(heat, 0, 1)
  return exothermic ? 0.7 - 0.4 * t : 0.3 + 0.4 * t
}

export function firstOrderSlope(k: number) {
  return -Math.max(0, k)
}

export function dihybridGrid() {
  const gametes = ['AB', 'Ab', 'aB', 'ab']
  let both = 0
  const cells: string[] = []
  for (const left of gametes) {
    for (const right of gametes) {
      const cell = `${left[0]}${right[0]}${left[1]}${right[1]}`
      cells.push(cell)
      if (cell.includes('A') && cell.includes('B')) both += 1
    }
  }
  return { cells, both, total: 16 }
}

export function selectionShares(advantage: number) {
  const raw = [1 + clamp(advantage, 0, 3), 1, 1]
  const sum = raw[0] + raw[1] + raw[2]
  return raw.map((value) => value / sum)
}

export function enzymeActivity(t: number) {
  const x = clamp(t, 0, 1)
  return Math.exp(-((x - 0.55) ** 2) / 0.04)
}

export function snapClock(variant: string, tune?: number[]) {
  const hour = clamp(tuneAt(tune, 0, 0.25), 0, 1)
  let minute = clamp(tuneAt(tune, 1, 0), 0, 1)
  minute = Math.round(minute * 12) / 12
  if (variant === 'hour') minute = 0
  if (variant === 'half') minute = 0.5
  return [hour, minute]
}

export function clockReading(variant: string, tune?: number[]) {
  const [hourT, minuteT] = snapClock(variant, tune)
  const hour = Math.round(hourT * 11) % 12
  const minutes = Math.round(minuteT * 12) * 5
  return { hour, minutes }
}

export function diceFace(time: number, run: boolean) {
  if (!run) return 1
  const step = Math.floor(Math.abs(time))
  return 1 + (step % 6)
}
