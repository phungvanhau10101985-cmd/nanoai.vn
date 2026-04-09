/**
 * Backfill metadata "chia theo tiết" vào JSON slides đã có trong DB.
 *
 * Dùng:
 *   npx tsx scripts/backfill-curriculum-slides-lessons.ts          # dry-run
 *   npx tsx scripts/backfill-curriculum-slides-lessons.ts --apply  # ghi DB
 *
 * Cần: DATABASE_URL
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { pgQuery } from '../src/lib/db/pg-query'
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

async function processSharedTable(apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const rows = await pgQuery<SharedRow>(
      `select curriculum_id, content_json from worksheet_slides order by curriculum_id limit $1 offset $2`,
      [PAGE_SIZE, offset]
    )
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.content_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.content_json)) continue
      changed += 1
      if (apply) {
        await pgQuery(`update worksheet_slides set content_json = $1 where curriculum_id = $2`, [nextJson, row.curriculum_id])
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function processOriginalTable(apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const rows = await pgQuery<OriginalRow>(
      `select curriculum_id, content_json from worksheet_slides_original order by curriculum_id limit $1 offset $2`,
      [PAGE_SIZE, offset]
    )
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.content_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.content_json)) continue
      changed += 1
      if (apply) {
        await pgQuery(`update worksheet_slides_original set content_json = $1 where curriculum_id = $2`, [
          nextJson,
          row.curriculum_id,
        ])
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function processPersonalTable(apply: boolean) {
  let offset = 0
  let scanned = 0
  let changed = 0
  for (;;) {
    const rows = await pgQuery<PersonalRow>(
      `select user_id, curriculum_id, slides_json from user_customized_slides order by user_id, curriculum_id limit $1 offset $2`,
      [PAGE_SIZE, offset]
    )
    if (rows.length === 0) break
    for (const row of rows) {
      scanned += 1
      const parsed = parseStoredCurriculumSlidesJson(row.slides_json)
      const nextJson = serializeStoredCurriculumSlidesJson(parsed.slides, parsed.curriculumInfographic)
      if (stable(nextJson) === stable(row.slides_json)) continue
      changed += 1
      if (apply) {
        await pgQuery(`update user_customized_slides set slides_json = $1 where user_id = $2 and curriculum_id = $3`, [
          nextJson,
          row.user_id,
          row.curriculum_id,
        ])
      }
    }
    if (rows.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return { scanned, changed }
}

async function main() {
  const apply = process.argv.includes('--apply')
  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  console.log(`[lesson-backfill] mode=${apply ? 'APPLY' : 'DRY-RUN'}`)

  const shared = await processSharedTable(apply)
  const original = await processOriginalTable(apply)
  const personal = await processPersonalTable(apply)

  console.log('[lesson-backfill] worksheet_slides:', shared)
  console.log('[lesson-backfill] worksheet_slides_original:', original)
  console.log('[lesson-backfill] user_customized_slides:', personal)
  console.log('[lesson-backfill] done')
}

main().catch((e) => {
  console.error('[lesson-backfill] failed:', e instanceof Error ? e.message : e)
  process.exit(1)
})

