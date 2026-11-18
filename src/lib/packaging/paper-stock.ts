/** Caliper gần đúng để bù nắp/đáy. Nhà in vẫn đối chiếu giấy thật. */
export type PaperStockId = 'ivory_300' | 'ivory_350' | 'duplex_300' | 'duplex_350' | 'custom'

export const PAPER_STOCK_IDS: PaperStockId[] = [
  'ivory_300',
  'ivory_350',
  'duplex_300',
  'duplex_350',
  'custom',
]

/** Độ dày điển hình (mm) của giấy bìa thường dùng cho hộp. */
export const PAPER_STOCK_THICKNESS_MM: Record<Exclude<PaperStockId, 'custom'>, number> = {
  ivory_300: 0.42,
  ivory_350: 0.42,
  duplex_300: 0.45,
  duplex_350: 0.55,
}

export const DEFAULT_PAPER_STOCK: PaperStockId = 'ivory_350'

/** Nắp và đáy cộng thêm bấy nhiêu lần độ dày giấy. */
export const LID_CALIPER_MULTIPLIER = 2

/** Lưỡi gài và tai chống bụi hẹp từng bên. */
export const TUCK_SIDE_RELIEF_MM = 1

export function isPaperStockId(value: string | null | undefined): value is PaperStockId {
  return PAPER_STOCK_IDS.includes(value as PaperStockId)
}

export function paperStockThicknessMm(stock: PaperStockId, customMm?: number): number {
  if (stock === 'custom') {
    const n = Number(customMm)
    return Number.isFinite(n) ? n : PAPER_STOCK_THICKNESS_MM.ivory_350
  }
  return PAPER_STOCK_THICKNESS_MM[stock]
}

export function lidDepthExtraMm(thicknessMm: number): number {
  return Math.round(thicknessMm * LID_CALIPER_MULTIPLIER * 100) / 100
}
