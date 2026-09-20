import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { executeOneListingImport } from './src/lib/messaging/listing-import/execute-one'
import { excelExportRowFromProductData } from './src/lib/messaging/listing-import/import-1688-excel-export-preview'
import { listingImportProductsXlsxBuffer } from './src/lib/messaging/listing-import/listing-import-xlsx'
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

const PARTNER_ID = '02770565-2cbe-4ff1-a63e-77c10d7de584'
const URL = 'https://vipomall.vn/san-pham/1077421901676?platform_type=10'
const OUT = 'C:\\Users\\Mr Hau\\Downloads\\listing_queue_products_A1077421901676.xlsx'

async function main() {
  console.log('execute', URL)
  const r = await executeOneListingImport({ partnerId: PARTNER_ID, url: URL })
  console.log('RESULT', r)
  if (!r.ok || !r.draft_id) {
    process.exit(1)
  }
  const draft = await fetchListingImportDraftFromPg(PARTNER_ID, r.draft_id)
  const pd = (draft?.product_data || {}) as Record<string, unknown>
  const row = excelExportRowFromProductData(pd)
  const filled = Object.entries(row).filter(([, v]) => v !== '' && v !== '[]' && v !== 0)
  const empty = Object.entries(row).filter(([, v]) => v === '' || v === '[]' || v === 0).map(([k]) => k)
  console.log('warnings', draft?.warnings)
  console.log('groups', { rating: pd.group_rating, question: pd.group_question, cats: [pd.category, pd.subcategory, pd.sub_subcategory], auto: pd._taxonomy_auto_created_levels })
  console.log('excel filled', filled.map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 80) : v]))
  console.log('excel empty', empty)
  writeFileSync(OUT, listingImportProductsXlsxBuffer([pd]))
  console.log('wrote', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
