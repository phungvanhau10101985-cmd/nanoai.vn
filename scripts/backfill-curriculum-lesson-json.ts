/**
 * Backfill JSON từng tiết cho bảng worksheet_curriculum_lessons.
 *
 * Dùng:
 *   npx tsx scripts/backfill-curriculum-lesson-json.ts          # dry-run
 *   npx tsx scripts/backfill-curriculum-lesson-json.ts --apply  # ghi DB
 *   npx tsx scripts/backfill-curriculum-lesson-json.ts --apply --force # ghi đè row đã có
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GEMINI_25_FLASH_NO_THINKING } from '../src/lib/gemini-config'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

const PAGE_SIZE = 120

type CurriculumRow = {
  id: string
  content_markdown: string
  num_lessons: number | null
}

type LessonOutlineItem = {
  lessonNo: number
  title: string
  markdown: string
}

async function splitLessonsByAI(genAI: GoogleGenerativeAI, markdown: string, expectedLessons: number): Promise<LessonOutlineItem[]> {
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  })
  const prompt = `Tách giáo trình sau thành JSON theo từng tiết.
Mỗi lesson gồm:
- lessonNo: số tiết
- title: tiêu đề tiết
- markdown: nội dung markdown riêng của tiết

Yêu cầu:
- Không bỏ sót ý chính.
- Không trộn nội dung giữa các tiết.
- Ưu tiên theo heading "### Tiết X".
- Số tiết kỳ vọng: ${Math.max(1, Math.floor(expectedLessons || 1))}
- Chỉ trả JSON đúng schema:
{"lessons":[{"lessonNo":1,"title":"...","markdown":"..."}]}

Nội dung:
---
${markdown.slice(0, 120000)}
---`
  const result = await model.generateContent(prompt)
  const text = result.response.text()?.trim() || ''
  if (!text) return []
  const parsed = JSON.parse(text) as { lessons?: Array<{ lessonNo?: number; title?: string; markdown?: string }> }
  return (parsed.lessons ?? [])
    .map((r) => ({
      lessonNo: Math.floor(Number(r.lessonNo || 0)),
      title: String(r.title || '').trim(),
      markdown: String(r.markdown || '').trim(),
    }))
    .filter((r) => Number.isFinite(r.lessonNo) && r.lessonNo > 0 && r.markdown.length > 0)
    .sort((a, b) => a.lessonNo - b.lessonNo)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const force = process.argv.includes('--force')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const googleKey = process.env.GOOGLE_API_KEY?.trim()
  if (!url || !serviceKey) {
    console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!googleKey) {
    console.error('Thiếu GOOGLE_API_KEY')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey)
  const genAI = new GoogleGenerativeAI(googleKey)

  // Kiểm tra bảng đích đã tồn tại.
  const check = await admin.from('worksheet_curriculum_lessons').select('id').limit(1)
  if (check.error && /does not exist|42P01/i.test(check.error.message || '')) {
    console.error('Bảng worksheet_curriculum_lessons chưa có. Hãy chạy migration trước.')
    process.exit(1)
  }

  let offset = 0
  let scanned = 0
  let skipped = 0
  let changed = 0
  let failed = 0

  console.log(`[lesson-json-backfill] mode=${apply ? 'APPLY' : 'DRY-RUN'} force=${force ? 'YES' : 'NO'}`)

  for (;;) {
    const { data, error } = await admin
      .from('worksheet_curricula')
      .select('id, content_markdown, num_lessons')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`worksheet_curricula: ${error.message}`)
    const rows = (data ?? []) as CurriculumRow[]
    if (rows.length === 0) break

    for (const row of rows) {
      scanned += 1
      const markdown = String(row.content_markdown || '').trim()
      if (!markdown) {
        skipped += 1
        continue
      }

      if (!force) {
        const { count } = await admin
          .from('worksheet_curriculum_lessons')
          .select('id', { count: 'exact', head: true })
          .eq('curriculum_id', row.id)
        if ((count ?? 0) > 0) {
          skipped += 1
          continue
        }
      }

      try {
        const expected = Math.max(1, Number(row.num_lessons ?? 1) || 1)
        const lessons = await splitLessonsByAI(genAI, markdown, expected)
        if (lessons.length === 0) {
          failed += 1
          continue
        }
        changed += 1
        if (apply) {
          await admin.from('worksheet_curriculum_lessons').delete().eq('curriculum_id', row.id)
          const payload = lessons.map((l) => ({
            curriculum_id: row.id,
            lesson_no: l.lessonNo,
            lesson_title: l.title,
            lesson_markdown: l.markdown,
            lesson_json: { lessonNo: l.lessonNo, title: l.title },
            updated_at: new Date().toISOString(),
          }))
          const { error: insErr } = await admin.from('worksheet_curriculum_lessons').insert(payload)
          if (insErr) throw new Error(insErr.message)
        }
      } catch (e) {
        failed += 1
        console.warn('[lesson-json-backfill] failed curriculum:', row.id, e instanceof Error ? e.message : e)
      }
    }

    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  console.log('[lesson-json-backfill] result:', { scanned, skipped, changed, failed })
}

main().catch((e) => {
  console.error('[lesson-json-backfill] fatal:', e instanceof Error ? e.message : e)
  process.exit(1)
})
