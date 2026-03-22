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
