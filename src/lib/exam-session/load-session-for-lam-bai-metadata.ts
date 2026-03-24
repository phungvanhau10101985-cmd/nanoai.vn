import { createClient } from '@supabase/supabase-js'

export type LamBaiSessionSeoRow = {
  title: string
  practiceHomework: boolean
}

/**
 * Đọc tiêu đề + cờ homework cho SEO /lam-bai/[code] (service role — không lộ câu hỏi).
 */
export async function loadExamSessionForLamBaiMetadata(
  code: string
): Promise<LamBaiSessionSeoRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const c = String(code || '').trim().toUpperCase()
  if (c.length < 4) return null
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await supabase
    .from('exam_sessions')
    .select('title, is_practice_homework')
    .eq('code', c)
    .maybeSingle()
  if (error || !data) return null
  const title = String((data as { title?: unknown }).title ?? '').trim()
  return {
    title: title || '—',
    practiceHomework: Boolean((data as { is_practice_homework?: boolean | null }).is_practice_homework),
  }
}
