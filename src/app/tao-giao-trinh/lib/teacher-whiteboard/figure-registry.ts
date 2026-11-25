export type LessonParams = {
  variant: string
  tune: number[]
  run?: boolean
  label?: string
  equation?: string
}

export type LessonHandle = { id: string; x: number; y: number }

type LessonSpec = {
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, params: LessonParams, time: number) => void
  handles?: (w: number, h: number, params: LessonParams) => LessonHandle[]
  move?: (params: LessonParams, w: number, h: number, handle: string, x: number, y: number, time: number) => number[] | null
  release?: (params: LessonParams, handle: string) => number[] | null
  runs?: boolean
}

const specs = new Map<string, LessonSpec>()

export function registerFigure(id: string, spec: LessonSpec) {
  specs.set(id, spec)
}

export function registeredFigureIds() {
  return [...specs.keys()]
}

export function extraRuns(id: string) {
  return specs.get(id)?.runs === true
}

export function drawExtra(ctx: CanvasRenderingContext2D, id: string, params: LessonParams, w: number, h: number, time: number) {
  const spec = specs.get(id)
  if (!spec) return false
  spec.draw(ctx, w, h, params, time)
  return true
}

export function extraHandles(id: string, params: LessonParams, w: number, h: number) {
  const spec = specs.get(id)
  if (!spec) return null
  return spec.handles?.(w, h, params) ?? []
}

export function moveExtra(id: string, params: LessonParams, w: number, h: number, handle: string, x: number, y: number, time: number) {
  const next = specs.get(id)?.move?.(params, w, h, handle, x, y, time)
  if (!next) return null
  return { ...params, tune: next }
}

export function releaseExtra(id: string, params: LessonParams, handle: string) {
  const next = specs.get(id)?.release?.(params, handle)
  if (!next) return null
  return { ...params, tune: next }
}
