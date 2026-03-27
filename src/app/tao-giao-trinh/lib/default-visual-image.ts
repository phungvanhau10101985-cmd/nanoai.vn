/**
 * Ảnh minh họa mặc định từ pipeline tạo slide (Pexels / Unsplash / Pixabay / picsum)
 * — khi có infographic cấp giáo trình, chỉ thay các ô visual thuần ảnh stock này;
 * không thay embed giáo viên (GeoGebra, plot, ảnh upload data:, v.v.).
 */

export type VisualCellLike = { visualEmbed?: string; imageUrl?: string }

export type SlideLikeForInfographicSwap = {
  visualCells?: VisualCellLike[]
  visualInput1?: string
  visualInput2?: string
  visualInput3?: string
  visualInput4?: string
}

export function getSlideVisualInputs(slide: {
  visualInput1?: string
  visualInput2?: string
  visualInput3?: string
  visualInput4?: string
}): string[] {
  return [slide.visualInput1, slide.visualInput2, slide.visualInput3, slide.visualInput4]
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
}

/** Khớp host ảnh stock dùng trong `curriculum-analyze-slides` */
export function isDefaultStockVisualImageUrl(url: string): boolean {
  const raw = url.trim()
  if (!raw) return false
  if (/^data:image\//i.test(raw)) return false
  let hostname = ''
  try {
    hostname = new URL(raw).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return false
  }
  if (hostname.includes('pexels.com')) return true
  if (hostname.includes('unsplash.com')) return true
  if (hostname.includes('pixabay.com')) return true
  if (hostname === 'picsum.photos' || hostname.endsWith('.picsum.photos')) return true
  return false
}

const IMAGE_MARKER_RE = /^\[image:\s*(.+)\]$/i

function imageUrlFromCell(cell: VisualCellLike): string | null {
  const iu = cell.imageUrl?.trim()
  if (iu) return iu
  const m = cell.visualEmbed?.trim().match(IMAGE_MARKER_RE)
  const inner = m?.[1]?.trim()
  return inner || null
}

/** Ô chỉ là ảnh (imageUrl hoặc marker [image:...]) và URL thuộc stock mặc định */
export function isDefaultStockVisualCell(cell: VisualCellLike): boolean {
  const url = imageUrlFromCell(cell)
  if (!url) return false
  if (cell.visualEmbed?.trim() && !IMAGE_MARKER_RE.test(cell.visualEmbed.trim())) return false
  return isDefaultStockVisualImageUrl(url)
}

/**
 * Nano viewer: visualCells đã lưu được ưu tiên trước 4 ô nhập — nếu chưa có ô lưu nào có nội dung
 * mà GV đã nhập 4 ô, coi toàn bộ visual do GV định nghĩa → không thay bằng infographic.
 */
export function skipInfographicDefaultSwapNano(slide: SlideLikeForInfographicSwap): boolean {
  const hasSavedCells = slide.visualCells?.some((c) => c.visualEmbed || c.imageUrl)
  if (hasSavedCells) return false
  return getSlideVisualInputs(slide).length > 0
}

/** Trang giáo viên: 4 ô nhập luôn được ưu tiên trước visualCells đã lưu */
export function skipInfographicDefaultSwapCurriculumPage(slide: SlideLikeForInfographicSwap): boolean {
  return getSlideVisualInputs(slide).length > 0
}

/** Ô Visual đang hiển thị đúng ảnh infographic giáo trình → dùng object-contain giống tab Infographic */
export function visualImageIsCurriculumInfographic(
  imageUrl: string | undefined | null,
  infographic: { imageUrl: string } | null | undefined,
): boolean {
  const a = String(imageUrl ?? '').trim()
  const b = String(infographic?.imageUrl ?? '').trim()
  return Boolean(a && b && a === b)
}

export function applyInfographicToDefaultVisualCells(
  meta: { layout: 1 | 2 | 4; cells: VisualCellLike[] },
  infographicImageUrl: string | undefined | null,
  skipAll: boolean,
): { layout: 1 | 2 | 4; cells: VisualCellLike[] } {
  if (!infographicImageUrl?.trim() || skipAll) return meta
  const url = infographicImageUrl.trim()
  const cells = meta.cells.map((cell) => {
    if (!isDefaultStockVisualCell(cell)) return cell
    return { imageUrl: url }
  })
  return { layout: meta.layout, cells }
}
