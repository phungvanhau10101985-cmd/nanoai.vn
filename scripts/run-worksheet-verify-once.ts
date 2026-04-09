/**
 * Chạy verify một phiếu — không cần Next dev server.
 * Dùng: npx tsx scripts/run-worksheet-verify-once.ts <worksheetId> [--reverify]
 * --reverify: chạy lại cả câu đã có verified_at (cùng logic với lượt migrate prompt).
 * Một lượt toàn DB: npm run reverify:worksheets-once
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { isPgConfigured } from '../src/lib/db/pool'
import { runWorksheetVerifyForSheet } from '../src/lib/worksheet-verify/run-worksheet-verify-for-sheet'

async function main() {
  const worksheetId = process.argv[2]?.trim()
  if (!worksheetId) {
    console.error('Usage: npx tsx scripts/run-worksheet-verify-once.ts <worksheetId>')
    process.exit(1)
  }
  if (!isPgConfigured()) {
    console.error('Thiếu DATABASE_URL trong .env / .env.local')
    process.exit(1)
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) {
    console.error('Thiếu GOOGLE_API_KEY')
    process.exit(1)
  }
  const reverifyAll = process.argv.includes('--reverify')
  console.log('Verifying worksheet', worksheetId, reverifyAll ? '(reverifyAll)' : '', '...')
  const stats = await runWorksheetVerifyForSheet(worksheetId, { reverifyAll })
  console.log(JSON.stringify(stats, null, 2))
  process.exit(stats.errors.length > 0 && stats.markedVerified === 0 && stats.contentUpdates === 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
