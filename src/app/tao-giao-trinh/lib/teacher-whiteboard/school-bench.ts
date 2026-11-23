import { drawBioBench, bioHandles, moveBioBench } from './bench-bio'
import { drawChemBench, chemHandles, moveChemBench } from './bench-chem'
import { drawPhysBench, movePhysBench, physHandles } from './bench-physics'
import { drawPhotoelectric, movePhotoelectric, photoelectricHandles } from './photoelectric-lab'
import type { Ctx } from './bench-style'

const PHYS = new Set(['standing', 'meters', 'radiation', 'transformer', 'buoyancy'])
const CHEM = new Set(['distill', 'gaslab', 'filter', 'galvanic', 'rate'])
const BIO = new Set(['osmosis', 'photo', 'slide', 'blood', 'reflex'])

export const SCHOOL_ANIM = new Set([
  'standing',
  'meters',
  'radiation',
  'transformer',
  'distill',
  'gaslab',
  'filter',
  'galvanic',
  'rate',
  'photo',
  'reflex',
  'photoelectric',
])

export function drawSchoolBench(ctx: Ctx, id: string, w: number, h: number, variant: string, tune: number[] | undefined, time: number) {
  if (id === 'photoelectric') drawPhotoelectric(ctx, w, h, variant, tune, time)
  else if (PHYS.has(id)) drawPhysBench(ctx, id, w, h, variant, tune, time)
  else if (CHEM.has(id)) drawChemBench(ctx, id, w, h, variant, tune, time)
  else if (BIO.has(id)) drawBioBench(ctx, id, w, h, variant, tune, time)
}

export function schoolHandles(figure: string, variant: string, tune: number[] | undefined, w: number, h: number) {
  if (figure === 'photoelectric') return photoelectricHandles(variant, tune, w, h)
  if (PHYS.has(figure)) return physHandles(figure, variant, tune, w, h)
  if (CHEM.has(figure)) return chemHandles(figure, variant, tune, w, h)
  if (BIO.has(figure)) return bioHandles(figure, variant, tune, w, h)
  return []
}

export function moveSchoolBench(
  figure: string,
  variant: string,
  tune: number[] | undefined,
  w: number,
  h: number,
  handle: string,
  x: number,
  y: number,
) {
  if (figure === 'photoelectric') return movePhotoelectric(variant, tune, w, h, handle, x, y)
  if (PHYS.has(figure)) return movePhysBench(figure, variant, tune, w, h, handle, x, y)
  if (CHEM.has(figure)) return moveChemBench(figure, tune, w, h, handle, x, y)
  if (BIO.has(figure)) return moveBioBench(figure, variant, tune, w, h, handle, x, y)
  return null
}
