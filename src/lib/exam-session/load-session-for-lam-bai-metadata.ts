import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type LamBaiSessionSeoRow = {
  title: string
  practiceHomework: boolean
}

/**
 * Đọc tiêu đề + cờ homework cho SEO /lam-bai/[code] (không lộ câu hỏi).
 */
export async function loadExamSessionForLamBaiMetadata(
  code: string
): Promise<LamBaiSessionSeoRow | null> {
  const c = String(code || '').trim().toUpperCase()
  if (c.length < 4) return null
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ title: unknown; is_practice_homework: unknown }>(
    `select title, is_practice_homework from public.exam_sessions where code = $1 limit 1`,
    [c]
  )
  if (!row) return null
  const title = String(row.title ?? '').trim()
  return {
    title: title || '—',
    practiceHomework: Boolean(row.is_practice_homework),
  }
}
