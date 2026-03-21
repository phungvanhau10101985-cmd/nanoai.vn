/**
 * Chạy verify một phiếu (service role) — không cần Next dev server.
 * Dùng: npx tsx scripts/run-worksheet-verify-once.ts <worksheetId> [--reverify]
 * --reverify: chạy lại cả câu đã có verified_at (cùng logic với lượt migrate prompt).
 * Một lượt toàn DB: npm run reverify:worksheets-once
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import { runWorksheetVerifyForSheet } from '../src/lib/worksheet-verify/run-worksheet-verify-for-sheet'

async function main() {
  const worksheetId = process.argv[2]?.trim()
  if (!worksheetId) {
    console.error('Usage: npx tsx scripts/run-worksheet-verify-once.ts <worksheetId>')
    process.exit(1)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local')
    process.exit(1)
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) {
    console.error('Thiếu GOOGLE_API_KEY')
    process.exit(1)
  }
  const admin = createClient(url, key)
  console.log('Verifying worksheet', worksheetId, reverifyAll ? '(reverifyAll)' : '', '...')
  const stats = await runWorksheetVerifyForSheet(admin, worksheetId, { reverifyAll })
  console.log(JSON.stringify(stats, null, 2))
  process.exit(stats.errors.length > 0 && stats.markedVerified === 0 && stats.contentUpdates === 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
