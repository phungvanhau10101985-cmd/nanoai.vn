const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { Pool } = require('pg')

function loadEnv(dir) {
  for (const f of ['.env.local', '.env']) {
    const p = join(dir, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  }
}

loadEnv(process.cwd())
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
const PID = '37a7cb4b-1faf-44b7-9265-76f2e8dfe248'

function footerSnippet(html) {
  const m = String(html || '').match(/<footer\b[\s\S]{0,14000}<\/footer>/i)
  return m ? m[0] : ''
}

async function main() {
  const paths = await pool.query(
    `select f->>'path' as path, length(coalesce(f->>'content','')) as len,
            (f->>'content') ~* '<footer' as has_footer
       from messaging_partner_websites w,
            lateral jsonb_array_elements(
              case when jsonb_typeof(w.project_files_json->'files') = 'array'
                   then w.project_files_json->'files' else '[]'::jsonb end
            ) f
      where w.partner_id = $1::uuid
      order by f->>'path'`,
    [PID]
  )
  console.log('FILES', JSON.stringify(paths.rows))
  const homes = await pool.query(
    `select f->>'path' as path, f->>'content' as content
       from messaging_partner_websites w,
            lateral jsonb_array_elements(w.project_files_json->'files') f
      where w.partner_id = $1::uuid
        and f->>'path' in ('index.html','index.mobile.html','index.tablet.html','index.laptop.html')
      order by f->>'path'`,
    [PID]
  )
  for (const row of homes.rows) {
    console.log('\n====', row.path, '====')
    console.log(footerSnippet(row.content))
  }
  const theme = await pool.query(
    `select theme_json, length(coalesce(html_source,'')) as html_source_len
       from messaging_partner_websites where partner_id = $1::uuid`,
    [PID]
  )
  console.log('\nTHEME_KEYS', Object.keys(theme.rows[0].theme_json || {}))
  console.log('slogan', theme.rows[0].theme_json && theme.rows[0].theme_json.slogan)
  console.log('html_source_len', theme.rows[0].html_source_len)
  const pages = await pool.query(
    `select slug, title, left(coalesce(content,''), 180) as content_head
       from messaging_partner_static_pages
      where partner_id = $1::uuid
        and slug in ('company','contact','about')
      order by slug`,
    [PID]
  )
  console.log('CMS', JSON.stringify(pages.rows, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => pool.end())
