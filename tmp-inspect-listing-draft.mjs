import { readFileSync, existsSync } from 'fs'
import { Pool } from 'pg'

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

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

const offer = '1077421901676'

try {
  const partners = await pool.query(
    `select id, slug, display_name, brand_name, industry_key
     from messaging_partners
     where slug ilike '%188%' or display_name ilike '%188%' or brand_name ilike '%188%'
     limit 10`
  )
  console.log('partners', JSON.stringify(partners.rows, null, 2))

  const drafts = await pool.query(
    `select d.id, d.partner_id, d.status, d.message, d.warnings, d.errors, d.source,
            d.source_url, d.source_offer_id, d.updated_at,
            d.product_data->>'product_id' as pid,
            jsonb_array_length(coalesce(d.product_data->'sizes','[]'::jsonb)) as sizes_n,
            jsonb_array_length(coalesce(d.product_data->'colors','[]'::jsonb)) as colors_n,
            jsonb_array_length(coalesce(d.product_data->'images','[]'::jsonb)) as images_n,
            jsonb_array_length(coalesce(d.product_data->'gallery','[]'::jsonb)) as gallery_n,
            left(coalesce(d.product_data->>'main_image',''), 120) as main_image,
            d.product_data->>'group_rating' as group_rating,
            d.product_data->>'group_question' as group_question,
            d.product_data->>'category' as cat1,
            d.product_data->>'subcategory' as cat2,
            d.product_data->>'sub_subcategory' as cat3,
            d.product_data->>'_taxonomy_auto_created_levels' as auto_lv,
            left(coalesce(d.product_data->>'style',''), 80) as style,
            left(coalesce(d.product_data->>'color',''), 80) as color,
            left(coalesce(d.product_data->>'occasion',''), 80) as occasion,
            left(coalesce(d.product_data->>'weight',''), 80) as weight,
            left(coalesce(d.product_data->>'video_link',''), 80) as video
     from messaging_partner_listing_import_drafts d
     where d.product_data->>'product_id' ilike $1
        or d.source_offer_id ilike $1
        or d.source_url ilike $1
     order by d.updated_at desc
     limit 8`,
    [`%${offer}%`]
  )
  console.log('drafts', JSON.stringify(drafts.rows, null, 2))

  const pid = partners.rows[0]?.id
  if (pid) {
    const groups = await pool.query(
      `select rating_group_id, count(*)::int as n,
              min(category_l1) as l1, min(category_l2) as l2, min(category_l3) as l3
       from messaging_partner_inventory
       where partner_id = $1::uuid and coalesce(is_active,true)=true
         and rating_group_id > 0 and rating_group_id <> 888
       group by rating_group_id
       order by n desc
       limit 30`,
      [pid]
    )
    console.log('top rating groups', JSON.stringify(groups.rows, null, 2))
    const sneaker = await pool.query(
      `select rating_group_id, question_group_id, category_l1, category_l2, category_l3, name
       from messaging_partner_inventory
       where partner_id = $1::uuid
         and (category_l3 ilike '%sneaker%' or category_l3 ilike '%chunky%' or name ilike '%sneaker nữ%')
       limit 15`,
      [pid]
    )
    console.log('sneaker rows', JSON.stringify(sneaker.rows, null, 2))
    const qg = await pool.query(
      `select question_group_id, count(*)::int as n
       from messaging_partner_inventory
       where partner_id = $1::uuid and coalesce(is_active,true)=true
       group by 1 order by n desc`,
      [pid]
    )
    console.log('question groups', JSON.stringify(qg.rows, null, 2))
    const rev = await pool.query(
      `select import_group, count(*)::int as n
       from messaging_partner_product_reviews
       where partner_id = $1::uuid and coalesce(is_imported,false)=true
       group by 1 order by n desc limit 20`,
      [pid]
    )
    console.log('imported review groups', JSON.stringify(rev.rows, null, 2))
    const l3g = await pool.query(
      `select rating_group_id, count(*)::int as n
       from messaging_partner_inventory
       where partner_id = $1::uuid
         and category_l3 = 'sneaker nữ chunky đế dày'
         and coalesce(is_active,true)=true
       group by 1 order by n desc`,
      [pid]
    )
    console.log('chunky L3 groups', JSON.stringify(l3g.rows, null, 2))
    const cats = await pool.query(
      `select depth, name, path, seo_index
       from messaging_partner_categories
       where partner_id = $1::uuid
         and (name ilike '%sneaker%' or name ilike '%chunky%' or path ilike '%sneaker%')
       order by depth, name
       limit 20`,
      [pid]
    )
    console.log('cats', JSON.stringify(cats.rows, null, 2))
  }

  const queues = await pool.query(
    `select partner_id, queue_token, updated_at,
            left(payload_json::text, 240) as payload_head
     from messaging_partner_listing_import_queues
     where queue_token ilike '3d9f50453524%'
        or payload_json::text ilike $1
     order by updated_at desc
     limit 5`,
    [`%${offer}%`]
  )
  console.log('queues', JSON.stringify(queues.rows, null, 2))
} finally {
  await pool.end()
}
