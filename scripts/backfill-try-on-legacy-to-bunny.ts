/**
 * Copy object bucket `try-on-images` từ Storage REST nguồn (legacy) sang Bunny và cập nhật URL trong DB.
 * Không đổi logic app — chỉ đổi storage + chuỗi URL; chức năng đọc/ghi/xóa ảnh vẫn qua code hiện tại.
 *
 * Mặc định: bảng `try_on_history`.
 * `--include-json-tables`: thêm mọi bảng có JSON / mảng chứa URL public legacy bucket `try-on-images`
 * (worksheet, slide share/quiz, xây nhà, job worksheet, báo cáo verify, inventory chat, sgk_image_urls…).
 *
 * DB: DATABASE_URL (Postgres).
 * Tải/xóa object nguồn (Storage REST cũ): STORAGE_LEGACY_* hoặc cặp URL + service role (xem `.env.example`).
 * Bunny: BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL
 *
 *   npx tsx scripts/backfill-try-on-legacy-to-bunny.ts
 *   npx tsx scripts/backfill-try-on-legacy-to-bunny.ts --apply
 *   npx tsx scripts/backfill-try-on-legacy-to-bunny.ts --apply --include-json-tables
 *   npx tsx scripts/backfill-try-on-legacy-to-bunny.ts --apply --include-json-tables --delete-source
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import { pgQuery } from '../src/lib/db/pg-query'
import { getStorageLegacyRestConfig } from '../src/lib/storage/storage-legacy-rest-config'
import { isLegacyPublicTryOnUrl } from '../src/lib/storage/try-on-public-upload'
import {
  collectLegacyTryOnUrlsFromJson,
  migrateLegacyTryOnUrlSet,
  replaceTryOnUrlsInJson,
  type TryOnBackfillContext,
} from '../src/lib/storage/try-on-backfill-shared'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const URL_PATTERN = '%/storage/v1/object/public/try-on-images/%'
const PAGE = 120

type HistoryRow = {
  id: string
  original_image_url: string
  garment_image_url: string
  result_image_url: string | null
}

const JSON_TABLES: { table: string; column: string }[] = [
  { table: 'worksheet_slides', column: 'content_json' },
  { table: 'worksheet_slides_original', column: 'content_json' },
  { table: 'worksheet_slide_edit_history', column: 'slides_json' },
  { table: 'worksheet_curriculum_lessons', column: 'lesson_json' },
  { table: 'worksheet_curriculum_lesson_slides', column: 'slides_json' },
  { table: 'user_customized_slides', column: 'slides_json' },
  { table: 'user_customized_slides_history', column: 'slides_json' },
  { table: 'worksheet_questions', column: 'content_json' },
  { table: 'house_build_projects', column: 'house_info' },
  { table: 'house_build_projects', column: 'steps' },
  { table: 'slide_share_sessions', column: 'slides' },
  { table: 'slide_quiz_sessions', column: 'quiz_data' },
  { table: 'worksheet_verify_batch_reports', column: 'progress' },
  { table: 'worksheet_verify_batch_reports', column: 'details' },
  { table: 'worksheet_jobs', column: 'params' },
  { table: 'worksheet_jobs', column: 'result' },
]

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
  return `"${name.replace(/"/g, '""')}"`
}

function makeContext(apply: boolean, deleteSource: boolean): TryOnBackfillContext {
  return {
    urlCache: new Map(),
    deletedPaths: new Set(),
    deleteSource,
    apply,
    stats: { uploads: 0, errors: 0 },
  }
}

async function backfillTryOnHistory(ctx: TryOnBackfillContext) {
  let scanned = 0
  let rowsNeedingMigrate = 0
  let rowsUpdated = 0
  let offset = 0

  console.log('\n--- try_on_history ---')

  for (;;) {
    let batch: HistoryRow[]
    try {
      batch = await pgQuery<HistoryRow>(
        `select id, original_image_url, garment_image_url, result_image_url
         from try_on_history
         where original_image_url ilike $1
            or garment_image_url ilike $1
            or result_image_url ilike $1
         order by id asc
         limit $2 offset $3`,
        [URL_PATTERN, PAGE, offset]
      )
    } catch (qErr) {
      console.error('[backfill] try_on_history:', qErr instanceof Error ? qErr.message : qErr)
      break
    }
    if (!batch.length) break

    for (const row of batch) {
      scanned += 1
      const cols = ['original_image_url', 'garment_image_url', 'result_image_url'] as const
      const oldUrls = [...new Set(cols.map((c) => row[c]).filter(Boolean) as string[])].filter((u) =>
        isLegacyPublicTryOnUrl(u)
      )
      if (oldUrls.length === 0) continue

      rowsNeedingMigrate += 1

      if (!ctx.apply) {
        console.log('[dry-run] try_on_history', row.id, oldUrls.length, 'URL legacy storage')
        continue
      }

      const map = await migrateLegacyTryOnUrlSet(oldUrls, ctx)
      const nextOriginal = map.get(row.original_image_url) ?? row.original_image_url
      const nextGarment = map.get(row.garment_image_url) ?? row.garment_image_url
      const nextResult =
        row.result_image_url && map.has(row.result_image_url)
          ? map.get(row.result_image_url)!
          : row.result_image_url

      if (nextOriginal === row.original_image_url && nextGarment === row.garment_image_url && nextResult === row.result_image_url) {
        continue
      }

      try {
        await pgQuery(
          `update try_on_history
           set original_image_url = $1, garment_image_url = $2, result_image_url = $3
           where id = $4`,
          [nextOriginal, nextGarment, nextResult, row.id]
        )
        rowsUpdated += 1
      } catch (upErr) {
        console.warn('[backfill] try_on_history update failed', row.id, upErr instanceof Error ? upErr.message : upErr)
        ctx.stats.errors += 1
      }
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  console.log(`try_on_history: hàng khớp lọc ${scanned}, cần chuyển ${rowsNeedingMigrate}${ctx.apply ? `, đã cập nhật ${rowsUpdated}` : ''}`)
}

async function backfillJsonTables(ctx: TryOnBackfillContext) {
  let rowsTouched = 0
  let rowsUpdated = 0

  for (const { table, column } of JSON_TABLES) {
    console.log(`\n--- ${table}.${column} ---`)
    let offset = 0
    const t = quoteIdent(table)
    const c = quoteIdent(column)

    for (;;) {
      let batch: { id: string; val: unknown }[]
      try {
        batch = await pgQuery<{ id: string; val: unknown }>(
          `select id, ${c} as val from ${t} order by id asc limit $1 offset $2`,
          [PAGE, offset]
        )
      } catch (error) {
        console.warn(`[backfill] ${table} read:`, error instanceof Error ? error.message : error)
        break
      }
      if (!batch.length) break

      for (const row of batch) {
        const raw = row.val
        if (raw === null || raw === undefined) continue

        const urls = collectLegacyTryOnUrlsFromJson(raw)
        if (urls.length === 0) continue

        rowsTouched += 1

        if (!ctx.apply) {
          console.log(`[dry-run] ${table}`, row.id, urls.length, 'URL trong JSON')
          continue
        }

        const map = await migrateLegacyTryOnUrlSet(urls, ctx)
        const nextJson = replaceTryOnUrlsInJson(raw, map)

        if (JSON.stringify(nextJson) === JSON.stringify(raw)) continue

        try {
          await pgQuery(`update ${t} set ${c} = $1 where id = $2`, [nextJson, row.id])
          rowsUpdated += 1
        } catch (upErr) {
          console.warn(`[backfill] ${table} update`, row.id, upErr instanceof Error ? upErr.message : upErr)
          ctx.stats.errors += 1
        }
      }

      if (batch.length < PAGE) break
      offset += PAGE
    }
  }

  console.log(
    `\nJSON tables: hàng có URL legacy storage ${rowsTouched}${ctx.apply ? `, đã cập nhật ${rowsUpdated}` : ''}`
  )
}

async function backfillSgkImageUrls(ctx: TryOnBackfillContext) {
  console.log('\n--- worksheet_worksheets.sgk_image_urls ---')
  let rowsTouched = 0
  let rowsUpdated = 0
  let offset = 0

  for (;;) {
    let batch: { id: string; sgk_image_urls: string[] | null }[]
    try {
      batch = await pgQuery<{ id: string; sgk_image_urls: string[] | null }>(
        `select id, sgk_image_urls from worksheet_worksheets
         where sgk_image_urls is not null and sgk_image_urls <> '{}'::text[]
         order by id asc limit $1 offset $2`,
        [PAGE, offset]
      )
    } catch (error) {
      console.warn('[backfill] worksheet_worksheets:', error instanceof Error ? error.message : error)
      return
    }
    if (!batch.length) break

    for (const row of batch) {
      const arr = row.sgk_image_urls
      if (!arr?.length) continue

      const urls = [...new Set(arr.filter((u) => isLegacyPublicTryOnUrl(u)))]
      if (urls.length === 0) continue

      rowsTouched += 1

      if (!ctx.apply) {
        console.log('[dry-run] worksheet_worksheets', row.id, urls.length, 'URL trong sgk_image_urls')
        continue
      }

      const map = await migrateLegacyTryOnUrlSet(urls, ctx)
      const nextArr = arr.map((u) => map.get(u) ?? u)

      if (JSON.stringify(nextArr) === JSON.stringify(arr)) continue

      try {
        await pgQuery(`update worksheet_worksheets set sgk_image_urls = $1 where id = $2`, [nextArr, row.id])
        rowsUpdated += 1
      } catch (upErr) {
        console.warn('[backfill] worksheet_worksheets update', row.id, upErr instanceof Error ? upErr.message : upErr)
        ctx.stats.errors += 1
      }
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  console.log(
    `worksheet_worksheets.sgk_image_urls: hàng có URL legacy storage ${rowsTouched}${ctx.apply ? `, đã cập nhật ${rowsUpdated}` : ''}`
  )
}

async function backfillMessagingInventoryUrls(ctx: TryOnBackfillContext) {
  console.log('\n--- messaging_partner_inventory.image_url ---')
  let scanned = 0
  let rowsUpdated = 0
  let offset = 0

  for (;;) {
    let batch: { id: string; image_url: string }[]
    try {
      batch = await pgQuery<{ id: string; image_url: string }>(
        `select id, image_url from messaging_partner_inventory
         where image_url ilike $1
         order by id asc limit $2 offset $3`,
        [URL_PATTERN, PAGE, offset]
      )
    } catch (error) {
      console.warn('[backfill] messaging_partner_inventory:', error instanceof Error ? error.message : error)
      return
    }
    if (!batch.length) break

    for (const row of batch) {
      scanned += 1
      const u = row.image_url?.trim() ?? ''
      if (!isLegacyPublicTryOnUrl(u)) continue

      if (!ctx.apply) {
        console.log('[dry-run] messaging_partner_inventory', row.id)
        continue
      }

      const map = await migrateLegacyTryOnUrlSet([u], ctx)
      const next = map.get(u) ?? u
      if (next === u) continue

      try {
        await pgQuery(`update messaging_partner_inventory set image_url = $1 where id = $2`, [next, row.id])
        rowsUpdated += 1
      } catch (upErr) {
        console.warn('[backfill] messaging_partner_inventory update', row.id, upErr instanceof Error ? upErr.message : upErr)
        ctx.stats.errors += 1
      }
    }

    if (batch.length < PAGE) break
    offset += PAGE
  }

  console.log(
    `messaging_partner_inventory: hàng khớp lọc ${scanned}${ctx.apply ? `, đã cập nhật ${rowsUpdated}` : ''}`
  )
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const apply = args.has('--apply')
  const deleteSource = args.has('--delete-source')
  const includeJson = args.has('--include-json-tables')

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Thiếu DATABASE_URL.')
    process.exit(1)
  }
  if (!getStorageLegacyRestConfig()) {
    console.error(
      'Thiếu cấu hình Storage REST nguồn (STORAGE_LEGACY_* hoặc NEXT_PUBLIC_LEGACY_HTTP_ORIGIN + LEGACY_HTTP_SERVICE_ROLE_KEY — xem .env.example).'
    )
    process.exit(1)
  }
  if (!process.env.BUNNY_STORAGE_ZONE || !process.env.BUNNY_STORAGE_API_KEY || !process.env.BUNNY_STORAGE_PUBLIC_BASE_URL) {
    console.error('Thiếu biến Bunny (BUNNY_STORAGE_ZONE, BUNNY_STORAGE_API_KEY, BUNNY_STORAGE_PUBLIC_BASE_URL).')
    process.exit(1)
  }

  const ctx = makeContext(apply, deleteSource)

  await backfillTryOnHistory(ctx)

  if (includeJson) {
    await backfillJsonTables(ctx)
    await backfillSgkImageUrls(ctx)
    await backfillMessagingInventoryUrls(ctx)
  }

  console.log('')
  console.log(apply ? 'Đã chạy với --apply.' : 'Dry-run (không ghi DB / không upload).')
  console.log(`  Tổng PUT lên Bunny (object): ${ctx.stats.uploads}`)
  if (deleteSource && apply) console.log('  Đã gỡ object trên Storage nguồn sau upload OK (--delete-source).')
  if (!apply) console.log('  Chạy với --apply để thực hiện. Thêm --include-json-tables nếu cần worksheet / kho ảnh chat.')
  if (ctx.stats.errors > 0) console.log(`  Lỗi / bỏ qua (ước lượng): ${ctx.stats.errors}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
