import { existsSync, readFileSync } from 'node:fs'
import { executeOneListingImport } from './src/lib/messaging/listing-import/execute-one'
import { excelExportRowFromProductData } from './src/lib/messaging/listing-import/import-1688-excel-export-preview'
import { fetchListingImportDraftFromPg } from './src/lib/db/messaging-partner-listing-import-pg'

function loadEnv(name: string) {
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

const PARTNER_ID = process.env.GUDO_PARTNER_ID || '37a7cb4b-1faf-44b7-9265-76f2e8dfe248'
const URL = 'https://vipomall.vn/san-pham/1077421901676?platform_type=10'

async function main() {
  console.log('execute_gudo', { partner: PARTNER_ID, url: URL, db_host: (() => { try { return new URL(process.env.DATABASE_URL || '').host } catch { return '' } })() })
  const r = await executeOneListingImport({ partnerId: PARTNER_ID, url: URL })
  console.log('RESULT', r)
  if (!r.ok || !r.draft_id) process.exit(1)
  const draft = await fetchListingImportDraftFromPg(PARTNER_ID, r.draft_id)
  const pd = (draft?.product_data || {}) as Record<string, unknown>
  const row = excelExportRowFromProductData(pd)
  console.log('warnings', draft?.warnings)
  console.log('groups', {
    rating: pd.group_rating,
    question: pd.group_question,
    cats: [pd.category, pd.subcategory, pd.sub_subcategory],
    auto: pd._taxonomy_auto_created_levels,
    name: pd.name,
  })
  console.log('excel', {
    rating_group_id: row.rating_group_id,
    question_group_id: row.question_group_id,
    sizes: row.sizes,
    Variant: String(row.Variant || '').slice(0, 80),
    gallery: String(row.gallery_images || '').slice(0, 80),
    Style: row.Style,
    Material: row.Material,
    Color: row.Color,
    Occasion: row.Occasion,
    Features: row.Features,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
