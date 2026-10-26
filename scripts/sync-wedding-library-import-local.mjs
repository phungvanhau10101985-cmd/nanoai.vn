/**
 * Ghi kho nền thiệp và kho khung từ JSON (dump VPS) vào DATABASE_URL local.
 * Trùng image_url thì cập nhật, không xóa dòng local khác.
 *
 *   node scripts/sync-wedding-library-import-local.mjs --dir backups/wedding-library-...
 */
import { readFileSync, existsSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvFile(name) {
  const p = join(root, name)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

function readArg(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : ''
}

function readJson(path) {
  const raw = readFileSync(path, 'utf8').trim()
  if (!raw) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : []
}

async function main() {
  loadEnvFile('.env.local')
  loadEnvFile('.env')
  const dsn = process.env.DATABASE_URL?.trim()
  if (!dsn) {
    console.error('Thiếu DATABASE_URL trong .env.local')
    process.exit(1)
  }
  const dir = resolve(readArg('--dir') || '')
  const backgrounds = readJson(join(dir, 'backgrounds.json'))
  const frames = readJson(join(dir, 'frames.json'))
  const client = new pg.Client({ connectionString: dsn })
  await client.connect()
  try {
    await client.query('begin')
    let bgUpsert = 0
    for (const row of backgrounds) {
      const imageUrl = String(row.image_url || '').trim()
      if (!imageUrl) continue
      await client.query(
        `insert into public.wedding_background_library (id, image_url, image_type, reference_image_url, created_at)
         values ($1::uuid, $2, $3, $4, $5::timestamptz)
         on conflict (image_url) do update set
           image_type = excluded.image_type,
           reference_image_url = case
             when excluded.reference_image_url <> '' then excluded.reference_image_url
             else public.wedding_background_library.reference_image_url
           end`,
        [
          String(row.id),
          imageUrl.slice(0, 2000),
          String(row.image_type || 'master'),
          String(row.reference_image_url || '').slice(0, 2000),
          row.created_at || new Date().toISOString(),
        ],
      )
      bgUpsert += 1
    }
    let frameUpsert = 0
    for (const row of frames) {
      const imageUrl = String(row.image_url || '').trim()
      const hole = row.hole && typeof row.hole === 'object' ? row.hole : null
      if (!imageUrl || !hole) continue
      await client.query(
        `insert into public.wedding_cover_frame_library (id, image_url, hole, panel, ink, reference_image_url, created_at)
         values ($1::uuid, $2, $3::jsonb, $4, $5, $6, $7::timestamptz)
         on conflict (image_url) do update set
           hole = excluded.hole,
           panel = excluded.panel,
           ink = excluded.ink,
           reference_image_url = case
             when excluded.reference_image_url <> '' then excluded.reference_image_url
             else public.wedding_cover_frame_library.reference_image_url
           end`,
        [
          String(row.id),
          imageUrl.slice(0, 2000),
          JSON.stringify(hole),
          /^#[0-9a-fA-F]{6}$/.test(String(row.panel || '')) ? String(row.panel) : '#fffaf2',
          row.ink === 'light' ? 'light' : 'dark',
          String(row.reference_image_url || '').slice(0, 2000),
          row.created_at || new Date().toISOString(),
        ],
      )
      frameUpsert += 1
    }
    await client.query('commit')
    const counts = await client.query(
      `select
         (select count(*)::int from public.wedding_background_library) as backgrounds,
         (select count(*)::int from public.wedding_cover_frame_library) as frames`,
    )
    console.log(
      JSON.stringify({
        importedBackgrounds: bgUpsert,
        importedFrames: frameUpsert,
        localBackgrounds: counts.rows[0].backgrounds,
        localFrames: counts.rows[0].frames,
      }),
    )
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
