import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { scrapeVipomallForImport } from './src/lib/messaging/listing-import/vipomall-scraper'
import { loadPartnerRatingGroupCatalog, applyListingImportRatingGroups } from './src/lib/messaging/listing-import/listing-import-rating-groups'
import { excelExportRowFromProductData } from './src/lib/messaging/listing-import/import-1688-excel-export-preview'
import { loadListingImportCookies } from './src/lib/messaging/listing-import/listing-import-cookies'

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

async function main() {
  const cookies = await loadListingImportCookies(PARTNER_ID)
  console.log('cookie_count', cookies.length, 'domains', [...new Set(cookies.map((c) => c.domain))].slice(0, 12))

  const catalog = await loadPartnerRatingGroupCatalog(PARTNER_ID)
  console.log('catalog groups', catalog.groupIds.length, 'phrases', catalog.phrases.length, 'q', catalog.questionGroupIds)
  const sneakerPhrases = catalog.phrases.filter(([p]) => p.toLowerCase().includes('sneaker') || p.toLowerCase().includes('chunky'))
  console.log('sneaker phrases sample', sneakerPhrases.slice(0, 20))

  const fake: Record<string, unknown> = {
    name: 'Giày sneaker nữ đế dày chunky lót khí thoáng khí chống trượt',
    category: 'Giày dép Nữ',
    subcategory: 'Sneaker & giày bệt Nữ',
    sub_subcategory: 'sneaker nữ chunky đế dày',
  }
  const warn: string[] = []
  await applyListingImportRatingGroups(fake, warn, { catalog })
  console.log('inferred groups from taxonomy only', { rating: fake.group_rating, question: fake.group_question, warn })

  console.log('scraping', URL)
  const scraped = await scrapeVipomallForImport(URL, PARTNER_ID)
  const raw = scraped.raw
  const pd = scraped.productData
  const summary = {
    page_url: raw.page_url,
    title: raw.title,
    document_title: raw.document_title,
    swatch_colors: Array.isArray(raw.swatch_colors) ? raw.swatch_colors.length : 0,
    colors: Array.isArray(raw.colors) ? raw.colors.length : 0,
    sizes: Array.isArray(raw.sizes) ? raw.sizes.length : 0,
    variant_rows: Array.isArray(raw.variant_rows) ? raw.variant_rows.length : 0,
    gallery_images: Array.isArray(raw.gallery_images) ? raw.gallery_images.length : 0,
    detail_images: Array.isArray(raw.detail_images) ? raw.detail_images.length : 0,
    info_texts: Array.isArray(raw.info_texts) ? raw.info_texts.length : 0,
    video_url: raw.video_url,
    body_len: String(raw.body_text_sample || '').length,
    body_head: String(raw.body_text_sample || '').slice(0, 400),
    gallery0: Array.isArray(raw.gallery_images) ? raw.gallery_images[0] : null,
    swatch0: Array.isArray(raw.swatch_colors) ? raw.swatch_colors[0] : null,
    variant0: Array.isArray(raw.variant_rows) ? raw.variant_rows[0] : null,
  }
  console.log('RAW', JSON.stringify(summary, null, 2))
  console.log('WARNINGS', scraped.warnings)
  console.log('PD keys', {
    colors: Array.isArray(pd.colors) ? (pd.colors as unknown[]).length : 0,
    sizes: Array.isArray(pd.sizes) ? (pd.sizes as unknown[]).length : 0,
    images: Array.isArray(pd.images) ? (pd.images as unknown[]).length : 0,
    gallery: Array.isArray(pd.gallery) ? (pd.gallery as unknown[]).length : 0,
    main_image: pd.main_image,
    color: pd.color,
    weight: pd.weight,
    name: pd.name,
  })
  writeFileSync('tmp-scrape-a107-raw.json', JSON.stringify({ raw, productData: pd, warnings: scraped.warnings }, null, 2))
  const row = excelExportRowFromProductData(pd)
  console.log('excel empty', Object.entries(row).filter(([, v]) => v === '' || v === '[]' || v === 0).map(([k]) => k))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
