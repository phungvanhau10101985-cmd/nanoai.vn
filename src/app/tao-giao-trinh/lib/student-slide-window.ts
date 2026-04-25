import { PRESENTATION_SYNC_QUERY_KEY } from './presentation-broadcast'

/**
 * Hai route trình chiếu học sinh tách biệt:
 * - Giáo trình (chia sẻ link / mở từ GV có curriculumId…): `/giao-trinh/xem-slide`
 * - Phiếu bài tập (worksheetId trên giao-vien): `/giao-trinh/xem-slide-phieu`
 */
export const STUDENT_SLIDE_CURRICULUM_PATH = '/giao-trinh/xem-slide' as const
export const STUDENT_SLIDE_WORKSHEET_PATH = '/giao-trinh/xem-slide-phieu' as const

export const STUDENT_WINDOW_NAME_CURRICULUM = 'xem-slide' as const
export const STUDENT_WINDOW_NAME_WORKSHEET = 'xem-slide-phieu' as const

export type StudentSlidePresentationKind = 'curriculum' | 'worksheet'

export function getStudentSlideWindowConfig(isWorksheet: boolean): {
  url: string
  windowName: string
  kind: StudentSlidePresentationKind
} {
  if (isWorksheet) {
    return {
      url: STUDENT_SLIDE_WORKSHEET_PATH,
      windowName: STUDENT_WINDOW_NAME_WORKSHEET,
      kind: 'worksheet',
    }
  }
  return {
    url: STUDENT_SLIDE_CURRICULUM_PATH,
    windowName: STUDENT_WINDOW_NAME_CURRICULUM,
    kind: 'curriculum',
  }
}

/** Đường dẫn hiện tại có khớp route trình chiếu đã chọn không (để tránh điều hướng lặp). */
export function isPathMatchingStudentSlideKind(pathname: string, kind: StudentSlidePresentationKind): boolean {
  const p = (pathname || '').replace(/\/$/, '') || '/'
  if (kind === 'curriculum') {
    return p === STUDENT_SLIDE_CURRICULUM_PATH || p.endsWith(STUDENT_SLIDE_CURRICULUM_PATH)
  }
  return p === STUDENT_SLIDE_WORKSHEET_PATH || p.endsWith(STUDENT_SLIDE_WORKSHEET_PATH)
}

/** Gắn `?sync=` (hoặc thêm vào query có sẵn) để BroadcastChannel tách luồng theo tab GV. */
export function studentSlideUrlWithSync(pathWithOptionalQuery: string, syncId: string): string {
  const id = syncId.trim()
  if (!id) return pathWithOptionalQuery
  const u = new URL(pathWithOptionalQuery, 'http://placeholder.local')
  u.searchParams.set(PRESENTATION_SYNC_QUERY_KEY, id)
  return u.pathname + u.search
}

type ScreenDetailsScreen = {
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary?: boolean
  label?: string
}
type ScreenDetailsLike = {
  screens: ScreenDetailsScreen[]
  currentScreen: ScreenDetailsScreen
}
type NavigatorWithScreenDetails = Navigator & {
  getScreenDetails?: () => Promise<ScreenDetailsLike>
}

/**
 * Tự đẩy một cửa sổ học sinh sang màn hình khác (máy chiếu/extend) nếu trình duyệt hỗ trợ Window Management API.
 * Trả về `true` nếu đã di chuyển thành công, `false` nếu không hỗ trợ hoặc chỉ có 1 màn hình.
 * - Cần trình duyệt có API `navigator.getScreenDetails()` (Chrome/Edge ≥100).
 * - Lần đầu sẽ xin quyền "Xem thông tin màn hình" (chỉ 1 lần).
 */
export async function moveWindowToExternalScreen(target: Window | null): Promise<boolean> {
  if (!target || target.closed || typeof navigator === 'undefined') return false
  const nav = navigator as NavigatorWithScreenDetails
  if (typeof nav.getScreenDetails !== 'function') return false
  let details: ScreenDetailsLike | null = null
  try {
    details = await nav.getScreenDetails()
  } catch {
    return false
  }
  if (!details || !Array.isArray(details.screens) || details.screens.length < 2) return false
  const current = details.currentScreen
  const external = details.screens.find(
    (s) =>
      s.availLeft !== current.availLeft ||
      s.availTop !== current.availTop ||
      s.availWidth !== current.availWidth ||
      s.availHeight !== current.availHeight
  )
  if (!external) return false
  try {
    target.moveTo(external.availLeft, external.availTop)
    target.resizeTo(external.availWidth, external.availHeight)
    return true
  } catch {
    return false
  }
}
