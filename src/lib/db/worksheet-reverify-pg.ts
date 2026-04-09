import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

const PAGE = 1000

function rpcMissingError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('get_worksheet_ids_for_reverify') ||
    m.includes('does not exist') ||
    m.includes('42883') ||
    m.includes('undefined_function')
  )
}

async function fetchVerifiedQuestionIdsPg(): Promise<Set<string>> {
  const set = new Set<string>()
  let from = 0
  for (;;) {
    const data = await pgQuery<{ id: string }>(
      `select id::text from public.worksheet_questions
       where verified_at is not null order by id asc limit $1 offset $2`,
      [PAGE, from]
    )
    if (!data?.length) break
    for (const r of data) {
      if (r.id) set.add(r.id)
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return set
}

async function fetchWorksheetsWithQuestionIdsPg(): Promise<
  Array<{ id: string; topic: string; question_ids: string[] }>
> {
  const out: Array<{ id: string; topic: string; question_ids: string[] }> = []
  let from = 0
  for (;;) {
    const data = await pgQuery<{ id: string; topic: string | null; question_ids: string[] | null }>(
      `select id::text, topic::text, question_ids from public.worksheet_worksheets order by id asc limit $1 offset $2`,
      [PAGE, from]
    )
    if (!data?.length) break
    for (const w of data) {
      const qids = (w.question_ids ?? []).filter(Boolean).map(String)
      if (qids.length) {
        out.push({
          id: w.id,
          topic: w.topic ?? '',
          question_ids: qids,
        })
      }
    }
    if (data.length < PAGE) break
    from += PAGE
  }
  return out
}

async function loadReverifyRowsFallbackPg(): Promise<
  Array<{ worksheet_id: string; worksheet_topic: string }>
> {
  const verified = await fetchVerifiedQuestionIdsPg()
  if (verified.size === 0) return []
  const sheets = await fetchWorksheetsWithQuestionIdsPg()
  const rows: { worksheet_id: string; worksheet_topic: string }[] = []
  for (const w of sheets) {
    if (w.question_ids.some((qid) => verified.has(qid))) {
      rows.push({ worksheet_id: w.id, worksheet_topic: w.topic })
    }
  }
  rows.sort((a, b) => a.worksheet_id.localeCompare(b.worksheet_id))
  return rows
}

/** Phiếu có ≥1 câu đã từng verify — script reverify. */
export async function fetchWorksheetIdsForReverifyPg(): Promise<
  Array<{ worksheet_id: string; worksheet_topic: string }>
> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')
  try {
    const rows = await pgQuery<{ worksheet_id: string; worksheet_topic: string }>(
      `select worksheet_id::text, worksheet_topic from public.get_worksheet_ids_for_reverify()`,
      []
    )
    return rows.map((r) => ({
      worksheet_id: r.worksheet_id,
      worksheet_topic: r.worksheet_topic ?? '',
    }))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (rpcMissingError(msg)) {
      console.warn(
        '[reverify] RPC get_worksheet_ids_for_reverify không gọi được — dùng liệt kê qua bảng (hoặc apply migration SQL).'
      )
      return loadReverifyRowsFallbackPg()
    }
    throw e
  }
}
