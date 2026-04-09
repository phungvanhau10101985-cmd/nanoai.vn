/**
 * Một lượt verify LẠI: mọi phiếu có ít nhất một câu đã từng có verified_at.
 * Chạy một lần từ máy có .env / .env.local (GOOGLE_API_KEY, DATABASE_URL).
 *
 * Dùng:
 *   npx tsx scripts/run-reverify-all-once.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { isPgConfigured } from '../src/lib/db/pool'
import { fetchWorksheetIdsForReverifyPg } from '../src/lib/db/worksheet-reverify-pg'
import { runWorksheetVerifyForSheet } from '../src/lib/worksheet-verify/run-worksheet-verify-for-sheet'

async function main() {
  if (!isPgConfigured()) {
    console.error('Thiếu DATABASE_URL')
    process.exit(1)
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) {
    console.error('Thiếu GOOGLE_API_KEY')
    process.exit(1)
  }

  let rows: { worksheet_id: string; worksheet_topic: string }[]
  try {
    rows = await fetchWorksheetIdsForReverifyPg()
  } catch (e) {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  }

  if (rows.length === 0) {
    console.log('Không có phiếu nào từng được verify — không cần chạy lại.')
    process.exit(0)
  }

  console.log(`Sẽ re-verify ${rows.length} phiếu (reverifyAll)…`)
  let fail = 0
  for (let i = 0; i < rows.length; i++) {
    const wid = rows[i].worksheet_id
    const topic = rows[i].worksheet_topic ?? ''
    process.stdout.write(`[${i + 1}/${rows.length}] ${wid} ${topic.slice(0, 40)}… `)
    const stats = await runWorksheetVerifyForSheet(wid, { reverifyAll: true })
    const bad = stats.errors.length > 0 && stats.markedVerified === 0 && stats.contentUpdates === 0
    if (bad) {
      fail++
      console.log('FAIL', stats.errors.join('; '))
    } else {
      console.log(
        `ok (+verify ${stats.markedVerified}, patch ${stats.contentUpdates}, skip ${stats.skippedInvalid})`
      )
    }
    if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 400))
  }

  console.log(`Xong. Phiếu lỗi hoàn toàn: ${fail}/${rows.length}`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
