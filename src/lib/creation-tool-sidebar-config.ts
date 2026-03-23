/**
 * Sidebar trái cho các trang “tạo”: nút quay lại, menu cùng nhóm / giáo trình, công cụ phổ biến.
 */
import type { ToolKey } from '@/lib/i18n/dictionaries'
import { NAV_GROUPS } from '@/lib/nav-config'

export type CreationRelatedItem = { href: string; labelKey: ToolKey }

const CURRICULUM_RELATED: Record<string, CreationRelatedItem[]> = {
  '/tao-bai-thi': [
    { href: '/giao-trinh', labelKey: 'create_curriculum' },
    { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/tao-giao-trinh': [
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/giao-trinh': [
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/tao-de-trac-nghiem': [
    { href: '/giao-trinh', labelKey: 'create_curriculum' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/lop', labelKey: 'classes' },
  ],
  '/lop/tao': [
    { href: '/lop', labelKey: 'classes' },
    { href: '/giao-trinh', labelKey: 'create_curriculum' },
    { href: '/tao-bai-thi', labelKey: 'online_exam' },
    { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' },
  ],
}

/** Menu liên quan cho trang gán phiếu (URL động). */
export const GAN_PHIEU_RELATED: CreationRelatedItem[] = [
  { href: '/giao-trinh', labelKey: 'create_curriculum' },
  { href: '/tao-bai-thi', labelKey: 'online_exam' },
  { href: '/tao-de-trac-nghiem', labelKey: 'create_exam' },
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
  const fromNav = siblingsFromNav(path)
  return fromNav
}

/** Công cụ nhiều người dùng — hiển thị dưới cùng sidebar. */
export const CREATION_SIDEBAR_POPULAR_LINKS: CreationRelatedItem[] = [
  { href: '/thu-do-online', labelKey: 'try_on' },
  { href: '/tao-anh-tu-chu', labelKey: 'text_to_image' },
  { href: '/xoa-nen-png', labelKey: 'remove_bg_png' },
  { href: '/phuc-dung-anh', labelKey: 'restore_image' },
  { href: '/dich-anh-tai-lieu', labelKey: 'translate_document_image' },
  { href: '/hoc-tieng-anh-ai', labelKey: 'ai_language_learning' },
]
