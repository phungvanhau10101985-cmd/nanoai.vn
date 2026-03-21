/**
 * Một lượt verify LẠI: mọi phiếu có ít nhất một câu đã từng có verified_at.
 * Chạy một lần từ máy có .env / .env.local (GOOGLE_API_KEY, Supabase service role).
 *
 * Ưu tiên RPC get_worksheet_ids_for_reverify (migration 20260328120000...).
 * Nếu RPC chưa apply trên Supabase → script tự liệt kê phiếu bằng query (có phân trang).
 *
 * Dùng:
 *   npx tsx scripts/run-reverify-all-once.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { runWorksheetVerifyForSheet } from '../src/lib/worksheet-verify/run-worksheet-verify-for-sheet'

const PAGE = 1000

function rpcMissingError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('get_worksheet_ids_for_reverify') ||
    m.includes('schema cache') ||
    m.includes('could not find the function')
  )
}

async function fetchVerifiedQuestionIds(admin: SupabaseClient): Promise<Set<string>> {
  const set = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('worksheet_questions')
      .select('id')
      .not('verified_at', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const r of data) {
      if (r.id) set.add(String(r.id))
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return set
}

async function fetchWorksheetsWithQuestionIds(
  admin: SupabaseClient
): Promise<Array<{ id: string; topic: string; question_ids: string[] }>> {
  const out: Array<{ id: string; topic: string; question_ids: string[] }> = []
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('worksheet_worksheets')
      .select('id, topic, question_ids')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const w of data) {
      const qids = ((w as { question_ids?: string[] | null }).question_ids ?? []).filter(Boolean)
      if (qids.length) {
        out.push({
          id: String((w as { id: string }).id),
          topic: String((w as { topic?: string | null }).topic ?? ''),
          question_ids: qids,
        })
      }
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

/** Fallback khi chưa chạy migration RPC trên Supabase. */
async function loadReverifyRowsFallback(
  admin: SupabaseClient
): Promise<{ worksheet_id: string; worksheet_topic: string }[]> {
  const verified = await fetchVerifiedQuestionIds(admin)
  if (verified.size === 0) return []
  const sheets = await fetchWorksheetsWithQuestionIds(admin)
  const rows: { worksheet_id: string; worksheet_topic: string }[] = []
  for (const w of sheets) {
    if (w.question_ids.some((qid) => verified.has(qid))) {
      rows.push({ worksheet_id: w.id, worksheet_topic: w.topic })
    }
  }
  rows.sort((a, b) => a.worksheet_id.localeCompare(b.worksheet_id))
  return rows
}

async function loadReverifyWorksheetRows(
  admin: SupabaseClient
): Promise<{ worksheet_id: string; worksheet_topic: string }[]> {
  const { data, error } = await admin.rpc('get_worksheet_ids_for_reverify')
  if (!error && data != null) {
    return (data as { worksheet_id: string; worksheet_topic: string }[]) ?? []
  }
  const msg = error?.message ?? ''
  if (error && !rpcMissingError(msg)) {
    throw new Error(`RPC get_worksheet_ids_for_reverify: ${msg}`)
  }
  console.warn(
    '[reverify] RPC chưa có trên DB — dùng liệt kê qua bảng (hoặc apply migration supabase/migrations/20260328120000_get_worksheet_ids_for_reverify.sql).'
  )
  return loadReverifyRowsFallback(admin)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!process.env.GOOGLE_API_KEY?.trim()) {
    console.error('Thiếu GOOGLE_API_KEY')
    process.exit(1)
  }

  const admin = createClient(url, key)
  let rows: { worksheet_id: string; worksheet_topic: string }[]
  try {
    rows = await loadReverifyWorksheetRows(admin)
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
    const stats = await runWorksheetVerifyForSheet(admin, wid, { reverifyAll: true })
    const bad =
      stats.errors.length > 0 && stats.markedVerified === 0 && stats.contentUpdates === 0
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
