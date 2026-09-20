import { existsSync, readFileSync } from 'node:fs'
import pg from 'pg'

function loadEnv(name) {
  if (!existsSync(name)) return
  for (const line of readFileSync(name, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}
loadEnv('.env.local')
loadEnv('.env')

function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL).host
  } catch {
    return '(invalid DATABASE_URL)'
  }
}

const SQL_PARTNERS = `
select p.id::text as id,
       p.slug,
       coalesce(p.display_name, p.brand_name, '') as name,
       coalesce(d.hostname, '') as hostname,
       coalesce(w.site_slug, '') as site_slug
from public.messaging_partners p
left join public.messaging_partner_custom_domains d on d.partner_id = p.id
left join public.messaging_partner_websites w on w.partner_id = p.id
where p.purge_at is null
  and (
    coalesce(d.hostname, '') ilike '%gudo%'
    or p.slug ilike '%gudo%'
    or coalesce(p.display_name, '') ilike '%gudo%'
    or coalesce(p.brand_name, '') ilike '%gudo%'
    or coalesce(w.site_slug, '') ilike '%gudo%'
  )
order by p.created_at desc
`

async function summarize(client, partnerId) {
  const review = await client.query(
    `select import_group as gid, count(*)::int as n
     from public.messaging_partner_product_reviews
     where partner_id = $1::uuid
       and is_imported = true
       and is_active = true
       and import_group > 0
       and import_group <> 888
     group by 1
     order by 1`,
    [partnerId]
  )
  const questions = await client.query(
    `select import_group as gid, count(*)::int as n
     from public.messaging_partner_product_questions
     where partner_id = $1::uuid
       and is_imported = true
       and is_active = true
       and import_group > 0
       and import_group <> 888
     group by 1
     order by 1`,
    [partnerId]
  )
  const assignedRating = await client.query(
    `select rating_group_id as gid, count(*)::int as n
     from public.messaging_partner_inventory
     where partner_id = $1::uuid
       and coalesce(is_active, true) = true
       and rating_group_id > 0
       and rating_group_id <> 888
     group by 1
     order by n desc, gid`,
    [partnerId]
  )
  const assignedQuestion = await client.query(
    `select question_group_id as gid, count(*)::int as n
     from public.messaging_partner_inventory
     where partner_id = $1::uuid
       and coalesce(is_active, true) = true
       and question_group_id in (88, 99, 100)
     group by 1
     order by 1`,
    [partnerId]
  )
  const inv = await client.query(
    `select count(*)::int as products,
            count(*) filter (where rating_group_id is null or rating_group_id <= 0 or rating_group_id = 888)::int as rating_888,
            count(*) filter (where question_group_id in (88,99,100))::int as q_ok
     from public.messaging_partner_inventory
     where partner_id = $1::uuid and coalesce(is_active, true) = true`,
    [partnerId]
  )
  const cats = await client.query(
    `select count(*)::int as n,
            count(*) filter (where depth = 1)::int as l1,
            count(*) filter (where depth = 2)::int as l2,
            count(*) filter (where depth = 3)::int as l3
     from public.messaging_partner_categories
     where partner_id = $1::uuid`,
    [partnerId]
  )
  const drafts = await client.query(
    `select id::text,
            status,
            to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD HH24:MI:SS') as created_vn,
            product_data->>'name' as name,
            product_data->>'group_rating' as rating,
            product_data->>'group_question' as question,
            product_data->>'category' as l1,
            product_data->>'subcategory' as l2,
            product_data->>'sub_subcategory' as l3,
            left(coalesce(warnings::text, ''), 500) as warnings,
            source_url
     from public.messaging_partner_listing_import_drafts
     where partner_id = $1::uuid
     order by created_at desc
     limit 8`,
    [partnerId]
  )
  return {
    review_excel_groups: review.rows.length,
    review_excel: review.rows,
    question_excel_groups: questions.rows.length,
    question_excel: questions.rows,
    assigned_rating_groups: assignedRating.rows.length,
    assigned_rating_top: assignedRating.rows.slice(0, 20),
    assigned_question_groups: assignedQuestion.rows.length,
    assigned_question: assignedQuestion.rows,
    inventory: inv.rows[0],
    categories: cats.rows[0],
    recent_drafts: drafts.rows,
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
console.log('db_host', dbHost())
const partners = await client.query(SQL_PARTNERS)
console.log('partners', partners.rows)
if (!partners.rows.length) {
  const domains = await client.query(
    `select hostname, partner_id::text from public.messaging_partner_custom_domains order by hostname limit 40`
  )
  const slugs = await client.query(
    `select p.id::text, p.slug, coalesce(w.site_slug,'') as site_slug
     from public.messaging_partners p
     left join public.messaging_partner_websites w on w.partner_id = p.id
     where p.purge_at is null
     order by p.created_at desc
     limit 40`
  )
  console.log('custom_domains', domains.rows)
  console.log('partners_sample', slugs.rows)
}
for (const p of partners.rows) {
  const s = await summarize(client, p.id)
  console.log('---', p.slug, p.hostname, p.id)
  console.log(JSON.stringify(s, null, 2))
}
await client.end()
