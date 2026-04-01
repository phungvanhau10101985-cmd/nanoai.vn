/**
 * Sidebar trái cho các trang “tạo”: nút quay lại, menu cùng nhóm / giáo trình, công cụ phổ biến.
 */
import type { ToolKey } from '@/lib/i18n/dictionaries'
import { NAV_GROUPS } from '@/lib/nav-config'

export type CreationRelatedItem = { href: string; labelKey: ToolKey }

const CURRICULUM_RELATED: Record<string, CreationRelatedItem[]> = {
  '/tao-bai-thi': [
    { href: '/giao-trinh', labelKey: 'my_curricula' },
    { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/tao-bai-tap-ve-nha': [
    { href: '/giao-trinh', labelKey: 'my_curricula' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/tao-giao-trinh': [
    { href: '/giao-trinh', labelKey: 'my_curricula' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/giao-trinh': [
    { href: '/tao-giao-trinh', labelKey: 'create_curriculum' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/lop/tao': [
    { href: '/lop', labelKey: 'classes' },
    { href: '/giao-trinh', labelKey: 'my_curricula' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
  ],
  '/lop': [
    { href: '/giao-trinh', labelKey: 'my_curricula' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
  ],
}

/** Menu liên quan cho trang bài tập về nhà theo lớp `/lop/[id]/gan-phieu`. */
export const GAN_PHIEU_RELATED: CreationRelatedItem[] = [
  { href: '/giao-trinh', labelKey: 'my_curricula' },
  { href: '/tao-bai-thi', labelKey: 'online_exam' },
  { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
  { href: '/lop', labelKey: 'classes' },
]

function normalizePath(path: string) {
  const p = path.replace(/\/$/, '') || '/'
  return p
}

function siblingsFromNav(path: string): CreationRelatedItem[] {
  for (const group of NAV_GROUPS) {
    for (const link of group.links) {
      if (link.href === path) {
        return group.links.filter((l) => l.href !== path).map((l) => ({ href: l.href, labelKey: l.labelKey }))
      }
      if (link.subLinks) {
        for (const sub of link.subLinks) {
          if (sub.href === path) {
            return link.subLinks
              .filter((s) => s.href !== path)
              .map((s) => ({ href: s.href, labelKey: s.labelKey }))
          }
        }
      }
    }
  }
  return []
}

export function getCreationRelatedLinks(currentHref: string): CreationRelatedItem[] {
  const path = normalizePath(currentHref)
  if (CURRICULUM_RELATED[path]) return CURRICULUM_RELATED[path]
  /** HS làm bài thi online — menu liên quan (lớp, giáo trình). */
  if (path.startsWith('/lam-bai/')) {
    return [
      { href: '/lop', labelKey: 'classes' },
      { href: '/giao-trinh', labelKey: 'my_curricula' },
      { href: '/tao-bai-thi', labelKey: 'online_exam' },
      { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
    ]
  }
  /** Trang xem phiếu / lời giải /phieu-bai-tap/[id] */
  if (path.startsWith('/phieu-bai-tap/')) {
    return [
      { href: '/giao-trinh', labelKey: 'my_curricula' },
      { href: '/tao-bai-thi', labelKey: 'online_exam' },
      { href: '/tao-bai-tap-ve-nha', labelKey: 'homework_online' },
      { href: '/lop', labelKey: 'classes' },
    ]
  }
  /** Chi tiết lớp /lop/[id] — cùng menu liên quan với /lop */
  if (
    path.startsWith('/lop/') &&
    path !== '/lop/tao' &&
    path !== '/lop/tham-gia'
  ) {
    return CURRICULUM_RELATED['/lop'] ?? []
  }
  const fromNav = siblingsFromNav(path)
  return fromNav
}

/** Công cụ nhiều người dùng — hiển thị dưới cùng sidebar. */
export const CREATION_SIDEBAR_POPULAR_LINKS: CreationRelatedItem[] = [
  { href: '/thu-do-online', labelKey: 'try_on' },
  { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' },
  { href: '/tao-video-tu-anh', labelKey: 'create_video_from_image' },
  { href: '/flow-nhac-video-veo', labelKey: 'flow_music_veo_video' },
  { href: '/tao-infographic-tu-sach', labelKey: 'infographic_from_book' },
  { href: '/du-anh-tu-phac-thao', labelKey: 'sketch_to_image' },
  { href: '/xoa-nen-png', labelKey: 'remove_bg_png' },
  { href: '/phuc-dung-anh', labelKey: 'restore_image' },
  { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' },
  { href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' },
  { href: '/ghi-am-bao-cao-cuoc-hop', labelKey: 'meeting_recorder_report' },
]
