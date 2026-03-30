/**
 * Backfill metadata "chia theo tiết" vào JSON slides đã có trong DB.
 *
 * Dùng:
 *   npx tsx scripts/backfill-curriculum-slides-lessons.ts          # dry-run
 *   npx tsx scripts/backfill-curriculum-slides-lessons.ts --apply  # ghi DB
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  parseStoredCurriculumSlidesJson,
  serializeStoredCurriculumSlidesJson,
} from '../src/app/tao-giao-trinh/lib/curriculum-slides-json'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

const PAGE_SIZE = 300

type SharedRow = {
  curriculum_id: string
  content_json: unknown
}

type OriginalRow = {
  curriculum_id: string
  content_json: unknown
}

type PersonalRow = {
  user_id: string
  curriculum_id: string
  slides_json: unknown
}

function stable(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

async function processSharedTable(admin: SupabaseClient, apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const { data, error } = await admin
      .from('worksheet_slides')
      .select('curriculum_id, content_json')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`worksheet_slides: ${error.message}`)
    const rows = (data ?? []) as SharedRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.content_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.content_json)) continue
      changed += 1
      if (apply) {
        const { error: upErr } = await admin
          .from('worksheet_slides')
          .update({ content_json: nextJson })
          .eq('curriculum_id', row.curriculum_id)
        if (upErr) throw new Error(`worksheet_slides update(${row.curriculum_id}): ${upErr.message}`)
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function processOriginalTable(admin: SupabaseClient, apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const { data, error } = await admin
      .from('worksheet_slides_original')
      .select('curriculum_id, content_json')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`worksheet_slides_original: ${error.message}`)
    const rows = (data ?? []) as OriginalRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.content_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.content_json)) continue
      changed += 1
      if (apply) {
        const { error: upErr } = await admin
          .from('worksheet_slides_original')
          .update({ content_json: nextJson })
          .eq('curriculum_id', row.curriculum_id)
        if (upErr) throw new Error(`worksheet_slides_original update(${row.curriculum_id}): ${upErr.message}`)
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function processPersonalTable(admin: SupabaseClient, apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const { data, error } = await admin
      .from('user_customized_slides')
      .select('user_id, curriculum_id, slides_json')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) throw new Error(`user_customized_slides: ${error.message}`)
    const rows = (data ?? []) as PersonalRow[]
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.slides_json)) continue
      changed += 1
      if (apply) {
        const { error: upErr } = await admin
          .from('user_customized_slides')
          .update({ slides_json: nextJson })
          .eq('user_id', row.user_id)
          .eq('curriculum_id', row.curriculum_id)
        if (upErr) throw new Error(`user_customized_slides update(${row.user_id}/${row.curriculum_id}): ${upErr.message}`)
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const admin = createClient(url, key)
  console.log(`[lesson-backfill] mode=${apply ? 'APPLY' : 'DRY-RUN'}`)

  const shared = await processSharedTable(admin, apply)
  const original = await processOriginalTable(admin, apply)
  const personal = await processPersonalTable(admin, apply)

  console.log('[lesson-backfill] worksheet_slides:', shared)
  console.log('[lesson-backfill] worksheet_slides_original:', original)
  console.log('[lesson-backfill] user_customized_slides:', personal)
  console.log('[lesson-backfill] done')
}

main().catch((e) => {
  console.error('[lesson-backfill] failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})

