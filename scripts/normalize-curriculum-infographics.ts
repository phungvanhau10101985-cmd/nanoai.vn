/**
 * Chuẩn hóa infographic giáo trình trong DB sau đổi mô hình:
 * - Ảnh cả bài: canonical ở worksheet_slides → bỏ trùng trong user_customized_slides.
 * - Cache tiết: bỏ infographic tiết nếu trùng URL ảnh cả bài (lỗi copy cũ); bỏ trùng URL trên hàng personal/original khi shared đã có cùng URL.
 *
 * Dùng:
 *   npx tsx scripts/normalize-curriculum-infographics.ts              # dry-run
 *   npx tsx scripts/normalize-curriculum-infographics.ts --apply      # ghi DB
 *   npx tsx scripts/normalize-curriculum-infographics.ts --apply --delete-storage
 *     # (tùy chọn) xóa file storage try-on-images cho URL đã gỡ khỏi JSON
 *
 * Cần: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseStoredCurriculumSlidesJson,
  serializeStoredCurriculumSlidesJson,
} from '../src/app/tao-giao-trinh/lib/curriculum-slides-json'
import type { SlideInfographic } from '../src/app/tao-giao-trinh/lib/slide-infographic'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

function normUrl(u: string): string {
  const t = u.trim()
  if (!t) return ''
  try {
    const x = new URL(t)
    return x.origin + x.pathname
  } catch {
    return t
  }
}

function infUrl(inf: SlideInfographic | undefined): string {
  return inf?.imageUrl ? normUrl(inf.imageUrl) : ''
}

function stripIfSameWhole(
  inf: SlideInfographic | undefined,
  wholeUrl: string | undefined
): SlideInfographic | undefined {
  if (!inf?.imageUrl || !wholeUrl) return inf
  if (normUrl(inf.imageUrl) === normUrl(wholeUrl)) return undefined
  return inf
}

function tryStoragePathFromPublicUrl(url: string): string | null {
  const t = url.trim()
  const idx = t.indexOf('/try-on-images/')
  if (idx < 0) return null
  return t.slice(idx + '/try-on-images/'.length).split('?')[0] || null
}

type LessonRow = {
  id: string
  curriculum_id: string
  mode: string
  user_id: string | null
  lesson_no: number
  slides_json: unknown
}

async function loadWholeUrlByCurriculum(supabase: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let from = 0
  const page = 300
  for (;;) {
    const { data, error } = await supabase
      .from('worksheet_slides')
      .select('curriculum_id, content_json')
      .range(from, from + page - 1)
    if (error) throw new Error(`worksheet_slides: ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      const cid = String(row.curriculum_id ?? '')
      if (!cid) continue
      const inf = parseStoredCurriculumSlidesJson(row.content_json).curriculumInfographic
      const u = inf?.imageUrl?.trim()
      if (u) map.set(cid, u)
    }
    if (data.length < page) break
    from += page
  }
  return map
}

async function main() {
  const apply = process.argv.includes('--apply')
  const deleteStorage = process.argv.includes('--delete-storage')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) {
    console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(url, serviceKey)
  const strippedUrls = new Set<string>()
  let userUpdated = 0
  let userScanned = 0
  let lessonUpdated = 0
  let lessonScanned = 0
  let storageRemoved = 0

  console.log(apply ? '--- APPLY (ghi DB) ---' : '--- DRY-RUN (không ghi) ---')
  if (deleteStorage && !apply) {
    console.warn('--delete-storage bị bỏ qua khi không có --apply')
  }

  const wholeByCurriculum = await loadWholeUrlByCurriculum(supabase)
  console.log(`Đã đọc worksheet_slides: ${wholeByCurriculum.size} giáo trình có ảnh cả bài.`)

  // --- user_customized_slides: bỏ curriculumInfographic khi bản chung đã có ảnh cả bài ---
  let uFrom = 0
  const uPage = 200
  for (;;) {
    const { data, error } = await supabase
      .from('user_customized_slides')
      .select('user_id, curriculum_id, slides_json')
      .range(uFrom, uFrom + uPage - 1)
    if (error) throw new Error(`user_customized_slides: ${error.message}`)
    if (!data?.length) break
    for (const row of data) {
      userScanned += 1
      const cid = String(row.curriculum_id ?? '')
      const wsWhole = wholeByCurriculum.get(cid)
      if (!wsWhole) continue
      const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
      if (!parsed.curriculumInfographic?.imageUrl) continue
      const next = serializeStoredCurriculumSlidesJson(
        parsed.slides as unknown[],
        undefined
      )
      if (JSON.stringify(row.slides_json) === JSON.stringify(next)) continue
      strippedUrls.add(normUrl(parsed.curriculumInfographic.imageUrl))
      userUpdated += 1
      if (apply) {
        const { error: upErr } = await supabase
          .from('user_customized_slides')
          .update({ slides_json: next, updated_at: new Date().toISOString() })
          .eq('user_id', row.user_id)
          .eq('curriculum_id', row.curriculum_id)
        if (upErr) console.error('Lỗi update user_customized_slides', row.curriculum_id, upErr.message)
      }
    }
    if (data.length < uPage) break
    uFrom += uPage
  }

  // --- worksheet_curriculum_lesson_slides ---
  const lessonRows: LessonRow[] = []
  let lFrom = 0
  const lPage = 500
  for (;;) {
    const { data, error } = await supabase
      .from('worksheet_curriculum_lesson_slides')
      .select('id, curriculum_id, mode, user_id, lesson_no, slides_json')
      .range(lFrom, lFrom + lPage - 1)
    if (error) throw new Error(`worksheet_curriculum_lesson_slides: ${error.message}`)
    if (!data?.length) break
    lessonRows.push(...(data as LessonRow[]))
    if (data.length < lPage) break
    lFrom += lPage
  }

  const groupKey = (cid: string, lessonNo: number) => `${cid}|${lessonNo}`
  const byGroup = new Map<string, LessonRow[]>()
  for (const r of lessonRows) {
    const k = groupKey(r.curriculum_id, r.lesson_no)
    const arr = byGroup.get(k) ?? []
    arr.push(r)
    byGroup.set(k, arr)
  }

  for (const [, rows] of byGroup) {
    const curriculumId = rows[0].curriculum_id
    const wholeUrl = wholeByCurriculum.get(curriculumId)

    const sharedRow = rows.find((x) => x.mode === 'shared' && x.user_id == null)
    const sharedParsed = sharedRow ? parseStoredCurriculumSlidesJson(sharedRow.slides_json) : null
    const sharedAfterWhole = stripIfSameWhole(sharedParsed?.curriculumInfographic, wholeUrl)
    const sharedLessonUrl = infUrl(sharedAfterWhole)

    for (const r of rows) {
      lessonScanned += 1
      const parsed = parseStoredCurriculumSlidesJson(r.slides_json)
      const slides = parsed.slides as unknown[]
      if (!Array.isArray(slides) || slides.length === 0) continue

      let nextInf = stripIfSameWhole(parsed.curriculumInfographic, wholeUrl)
      const isSharedCanonical = r.mode === 'shared' && r.user_id == null
      if (!isSharedCanonical && (r.mode === 'personal' || r.mode === 'original')) {
        const nUrl = infUrl(nextInf)
        if (sharedLessonUrl && nUrl && nUrl === sharedLessonUrl) {
          nextInf = undefined
        }
      }

      const prevInf = parsed.curriculumInfographic
      const prevU = infUrl(prevInf)
      const nextU = infUrl(nextInf)
      if (prevU === nextU) continue

      if (prevInf?.imageUrl && prevU !== nextU) {
        strippedUrls.add(normUrl(prevInf.imageUrl))
      }

      const nextJson = serializeStoredCurriculumSlidesJson(slides, nextInf)
      if (JSON.stringify(r.slides_json) === JSON.stringify(nextJson)) continue

      lessonUpdated += 1
      if (apply) {
        const { error: upErr } = await supabase
          .from('worksheet_curriculum_lesson_slides')
          .update({ slides_json: nextJson, updated_at: new Date().toISOString() })
          .eq('id', r.id)
        if (upErr) console.error('Lỗi update lesson_slides', r.id, upErr.message)
      }
    }
  }

  if (apply && deleteStorage && strippedUrls.size > 0) {
    const paths = [...strippedUrls]
      .map((u) => tryStoragePathFromPublicUrl(u))
      .filter((p): p is string => !!p)
    const uniquePaths = [...new Set(paths)]
    for (const p of uniquePaths) {
      if (!p.includes('curriculum_infographic_')) continue
      const { error: delErr } = await supabase.storage.from('try-on-images').remove([p])
      if (delErr) {
        console.warn('Storage remove skip:', p, delErr.message)
      } else {
        storageRemoved += 1
      }
    }
  }

  console.log('')
  console.log('Kết quả:')
  console.log(`  user_customized_slides: quét ${userScanned}, ${apply ? 'đã cập nhật' : 'sẽ cập nhật'} ${userUpdated}`)
  console.log(`  worksheet_curriculum_lesson_slides: quét ${lessonScanned}, ${apply ? 'đã cập nhật' : 'sẽ cập nhật'} ${lessonUpdated}`)
  console.log(`  URL gỡ khỏi JSON (unique, chuẩn hóa): ${strippedUrls.size}`)
  if (apply && deleteStorage) {
    console.log(`  storage try-on-images đã xóa (curriculum_infographic_*): ${storageRemoved}`)
  }
  if (!apply && (userUpdated > 0 || lessonUpdated > 0)) {
    console.log('\nChạy lại với --apply để ghi DB.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
