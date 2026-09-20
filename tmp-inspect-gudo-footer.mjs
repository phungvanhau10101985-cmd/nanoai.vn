import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Pool } from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '.')
for (const f of ['.env.local', '.env']) {
  const p = join(root, f)
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

function footerSnippet(html) {
  const m = String(html || '').match(/<footer\b[\s\S]{0,12000}<\/footer>/i)
  return m ? m[0] : ''
}

try {
  const rows = await pool.query(
    `select w.partner_id::text, w.site_slug, w.title, w.template_id,
            w.theme_json->>'slogan' as slogan,
            w.theme_json->>'look' as look,
            p.display_name, p.brand_name, p.contact_phone,
            d.hostname
       from public.messaging_partner_websites w
       join public.messaging_partners p on p.id = w.partner_id
       left join public.messaging_partner_custom_domains d
         on d.partner_id = w.partner_id and d.use_for_site = true
      where w.site_slug ilike '%gudo%'
         or coalesce(d.hostname, '') ilike '%gudo%'
         or coalesce(w.title, '') ilike '%gudo%'
         or coalesce(p.display_name, '') ilike '%gudo%'
         or coalesce(p.brand_name, '') ilike '%gudo%'
      order by w.updated_at desc`
  )
  console.log('matches', rows.rows.length)
  for (const r of rows.rows) console.log(JSON.stringify(r))

  const pick = rows.rows[0]
  if (!pick) {
    const all = await pool.query(
      `select hostname, partner_id::text from public.messaging_partner_custom_domains order by hostname`
    )
    console.log('all_domains', all.rows)
  } else {
    const paths = await pool.query(
      `select f->>'path' as path, length(coalesce(f->>'content','')) as len
         from public.messaging_partner_websites w,
              lateral jsonb_array_elements(
                case when jsonb_typeof(w.project_files_json->'files') = 'array'
                     then w.project_files_json->'files'
                     when jsonb_typeof(w.project_files_json) = 'array'
                     then w.project_files_json
                     else '[]'::jsonb end
              ) f
        where w.partner_id = $1::uuid
        order by f->>'path'`,
      [pick.partner_id]
    )
    console.log('html_paths', paths.rows)
    const home = await pool.query(
      `select f->>'path' as path, f->>'content' as content
         from public.messaging_partner_websites w,
              lateral jsonb_array_elements(
                case when jsonb_typeof(w.project_files_json->'files') = 'array'
                     then w.project_files_json->'files'
                     else '[]'::jsonb end
              ) f
        where w.partner_id = $1::uuid
          and f->>'path' in ('index.html', 'index.mobile.html')
        order by f->>'path'`,
      [pick.partner_id]
    )
    for (const row of home.rows) {
      console.log('---- footer', row.path, '----')
      console.log(footerSnippet(row.content).slice(0, 4500))
    }
  }
} catch (e) {
  console.error('ERR', e)
} finally {
  await pool.end()
}
