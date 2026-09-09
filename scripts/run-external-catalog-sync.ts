/**
 * Cron đồng bộ GET kho khách — chạy ngoài process Next.js (tránh OOM heap web).
 *   npx tsx scripts/run-external-catalog-sync.ts
 *   npx tsx scripts/run-external-catalog-sync.ts --partner=<partnerId>
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) {
  config({ path: envPath })
}
if (existsSync(localPath)) {
  config({ path: localPath, override: true })
}
if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/\r/g, '').trim()
}

function parsePartnerId(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--partner' || a === '-p') {
      return String(argv[i + 1] || '').trim()
    }
    if (a.startsWith('--partner=')) return a.slice('--partner='.length).trim()
  }
  return ''
}

async function main() {
  console.log('[catalog-sync] start', new Date().toISOString())
  const { isPgConfigured } = await import('../src/lib/db/pool')
  if (!isPgConfigured()) {
    console.error('[catalog-sync] DATABASE_URL is not configured.')
    process.exit(1)
  }

  const {
    runDuePartnerExternalCatalogSyncJobs,
    runPartnerExternalCatalogSyncJob,
  } = await import('../src/lib/messaging/partner-inventory-external-catalog-sync')

  const partnerId = parsePartnerId(process.argv.slice(2))
  if (partnerId) {
    const outcome = await runPartnerExternalCatalogSyncJob({
      partnerId,
      deferEmbeddings: true,
      reportSource: 'cron',
    })
    console.log('[catalog-sync] partner', partnerId, JSON.stringify(outcome))
    if (!outcome.ok) process.exit(1)
    return
  }

  const result = await runDuePartnerExternalCatalogSyncJobs()
  console.log('[catalog-sync] done', JSON.stringify(result))
  const failed = result.results.some((r) => !r.outcome.ok)
  if (failed) process.exit(1)
}

main().catch((e) => {
  console.error('[catalog-sync] fatal', e)
  process.exit(1)
})
