/**
 * Điền topic_normalized cho giáo trình đã lưu, cùng hàm lúc tạo bài mới.
 *   npx tsx scripts/backfill-curriculum-topic-normalized.ts
 *   npx tsx scripts/backfill-curriculum-topic-normalized.ts --apply
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'
import { normalizeTopicForSearch } from '../src/app/tao-giao-trinh/lib/topic-normalize'

function curriculumTopicCacheKey(topic: string): string | null {
  const key = normalizeTopicForSearch(topic)
  return key.length >= 2 ? key : null
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(name: string) {
  const path = join(root, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  const apply = process.argv.includes('--apply')
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: dsn })
  const rows = await pool.query<{ id: string; topic: string; topic_normalized: string | null }>(
    `select id::text as id, topic, topic_normalized
     from public.worksheet_curricula
     where lesson_number is null`
  )
  let changed = 0
  for (const row of rows.rows) {
    const next = curriculumTopicCacheKey(row.topic)
    if ((row.topic_normalized ?? null) === next) continue
    changed += 1
    console.log(`${row.id} ${JSON.stringify(row.topic)} -> ${JSON.stringify(next)}`)
    if (apply) {
      await pool.query(
        `update public.worksheet_curricula set topic_normalized = $2 where id = $1::uuid`,
        [row.id, next]
      )
    }
  }
  console.log(`${apply ? 'updated' : 'would update'} ${changed} / ${rows.rows.length}`)
  await pool.end()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
