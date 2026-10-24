import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { addCreditsToUser } from '@/lib/db/credits-balance'
import {
  CURRICULUM_AI_CHARGE_TYPES,
  isCurriculumAiCreditsDisabled,
  readUserCreditBalance,
  spendCurriculumAiCredits,
} from '@/lib/curriculum-ai-credits'
import { getVietnamDateYmd } from '@/lib/curriculum-vietnam-date'
import { isGuestTrialUser } from '@/lib/guest-credit-trial'
import {
  quoteSgkExtract,
  quoteWorksheetQuestionBatch,
  SGK_EXTRACT_REPEAT_CREDIT,
  WORKSHEET_EXTRA_QUESTION_CREDIT,
  type QuestionBatchQuote,
  type SgkExtractQuote,
} from '@/app/tao-giao-trinh/lib/worksheet-ai-quota'
import type { PoolClient } from 'pg'
import { randomUUID } from 'crypto'

export type WorksheetQuestionKind = 'quiz' | 'essay'

export type WorksheetAiQuotaSnapshot = {
  quizCurriculumCreated: number
  essayCurriculumCreated: number
  quizUserWaivedToday: number
  essayUserWaivedToday: number
  sgkCurriculumExtracts: number
  sgkUserWaivedToday: number
}

export class WorksheetCreditsError extends Error {
  readonly code = 'INSUFFICIENT_CREDITS' as const
  readonly required: number
  readonly balance: number
  readonly freeRemaining: number

  constructor(required: number, balance: number, freeRemaining: number) {
    super(`Không đủ credits. Cần ${required.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} credits.`)
    this.required = required
    this.balance = balance
    this.freeRemaining = freeRemaining
  }
}

const EMPTY_SNAPSHOT: WorksheetAiQuotaSnapshot = {
  quizCurriculumCreated: 0,
  essayCurriculumCreated: 0,
  quizUserWaivedToday: 0,
  essayUserWaivedToday: 0,
  sgkCurriculumExtracts: 0,
  sgkUserWaivedToday: 0,
}

type CurriculumRow = { quiz_created: number; essay_created: number; sgk_extracts: number }
type DailyRow = { quiz_waived: number; essay_waived: number; sgk_waived: number }

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function withLockedQuota(
  userId: string,
  curriculumId: string | null,
  run: (client: PoolClient, curriculum: CurriculumRow | null, daily: DailyRow, usageDate: string) => Promise<void>
): Promise<void> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')
  const usageDate = getVietnamDateYmd()
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    let curriculum: CurriculumRow | null = null
    if (curriculumId) {
      await client.query(
        `insert into public.curriculum_worksheet_ai_quota (curriculum_id)
         values ($1::uuid)
         on conflict (curriculum_id) do nothing`,
        [curriculumId]
      )
      const locked = await client.query<CurriculumRow>(
        `select quiz_created, essay_created, sgk_extracts
         from public.curriculum_worksheet_ai_quota
         where curriculum_id = $1::uuid
         for update`,
        [curriculumId]
      )
      const row = locked.rows[0]
      curriculum = row
        ? {
            quiz_created: num(row.quiz_created),
            essay_created: num(row.essay_created),
            sgk_extracts: num(row.sgk_extracts),
          }
        : { quiz_created: 0, essay_created: 0, sgk_extracts: 0 }
    }
    await client.query(
      `insert into public.curriculum_worksheet_ai_daily (user_id, usage_date)
       values ($1::uuid, $2::date)
       on conflict (user_id, usage_date) do nothing`,
      [userId, usageDate]
    )
    const dailyRes = await client.query<DailyRow>(
      `select quiz_waived, essay_waived, sgk_waived
       from public.curriculum_worksheet_ai_daily
       where user_id = $1::uuid and usage_date = $2::date
       for update`,
      [userId, usageDate]
    )
    const dailyRaw = dailyRes.rows[0]
    const daily: DailyRow = dailyRaw
      ? {
          quiz_waived: num(dailyRaw.quiz_waived),
          essay_waived: num(dailyRaw.essay_waived),
          sgk_waived: num(dailyRaw.sgk_waived),
        }
      : { quiz_waived: 0, essay_waived: 0, sgk_waived: 0 }
    await run(client, curriculum, daily, usageDate)
    await client.query('commit')
  } catch (error) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    throw error
  } finally {
    client.release()
  }
}

export async function readWorksheetAiQuotaSnapshot(
  userId: string,
  curriculumId: string | null
): Promise<WorksheetAiQuotaSnapshot> {
  if (isCurriculumAiCreditsDisabled() || !isPgConfigured()) return { ...EMPTY_SNAPSHOT }
  const usageDate = getVietnamDateYmd()
  const pool = getPgPool()
  const snapshot = { ...EMPTY_SNAPSHOT }
  if (curriculumId) {
    const curriculum = await pool.query<CurriculumRow>(
      `select quiz_created, essay_created, sgk_extracts
       from public.curriculum_worksheet_ai_quota
       where curriculum_id = $1::uuid`,
      [curriculumId]
    )
    const row = curriculum.rows[0]
    if (row) {
      snapshot.quizCurriculumCreated = num(row.quiz_created)
      snapshot.essayCurriculumCreated = num(row.essay_created)
      snapshot.sgkCurriculumExtracts = num(row.sgk_extracts)
    }
  }
  const daily = await pool.query<DailyRow>(
    `select quiz_waived, essay_waived, sgk_waived
     from public.curriculum_worksheet_ai_daily
     where user_id = $1::uuid and usage_date = $2::date`,
    [userId, usageDate]
  )
  const day = daily.rows[0]
  if (day) {
    snapshot.quizUserWaivedToday = num(day.quiz_waived)
    snapshot.essayUserWaivedToday = num(day.essay_waived)
    snapshot.sgkUserWaivedToday = num(day.sgk_waived)
  }
  return snapshot
}

export async function preflightWorksheetQuestions(input: {
  userId: string
  curriculumId: string | null
  kind: WorksheetQuestionKind
  count: number
}): Promise<{ ok: true; quote: QuestionBatchQuote } | { ok: false; required: number; balance: number; freeRemaining: number }> {
  if (isCurriculumAiCreditsDisabled()) {
    return {
      ok: true,
      quote: { free: input.count, paid: 0, credits: 0 },
    }
  }
  const snapshot = await readWorksheetAiQuotaSnapshot(input.userId, input.curriculumId)
  const quote = quoteWorksheetQuestionBatch({
    requested: input.count,
    curriculumCreated: input.kind === 'quiz' ? snapshot.quizCurriculumCreated : snapshot.essayCurriculumCreated,
    hasCurriculum: Boolean(input.curriculumId),
  })
  if (quote.credits <= 0) return { ok: true, quote }
  const balance = await readUserCreditBalance(input.userId)
  if (balance + 1e-9 < quote.credits) {
    return { ok: false, required: quote.credits, balance, freeRemaining: quote.free }
  }
  return { ok: true, quote }
}

export async function preflightSgkExtract(input: {
  userId: string
  curriculumId: string | null
}): Promise<{ ok: true; quote: SgkExtractQuote } | { ok: false; required: number; balance: number; freeRemaining: number }> {
  if (isCurriculumAiCreditsDisabled()) return { ok: true, quote: { waived: true, credits: 0 } }
  const snapshot = await readWorksheetAiQuotaSnapshot(input.userId, input.curriculumId)
  const quote = quoteSgkExtract({
    curriculumExtracts: snapshot.sgkCurriculumExtracts,
    hasCurriculum: Boolean(input.curriculumId),
  })
  if (quote.waived) return { ok: true, quote }
  const balance = await readUserCreditBalance(input.userId)
  if (balance + 1e-9 < quote.credits) {
    return { ok: false, required: quote.credits, balance, freeRemaining: 0 }
  }
  return { ok: true, quote }
}

export type QuestionTurn =
  | { action: 'free'; undo: () => Promise<void> }
  | { action: 'pay' }
  | { action: 'stop'; balance: number; required: number }

async function bumpQuestionCounters(
  client: PoolClient,
  userId: string,
  curriculumId: string | null,
  kind: WorksheetQuestionKind,
  usageDate: string,
  delta: 1 | -1,
  includeDaily: boolean
): Promise<void> {
  const curriculumColumn = kind === 'quiz' ? 'quiz_created' : 'essay_created'
  const dailyColumn = kind === 'quiz' ? 'quiz_waived' : 'essay_waived'
  if (curriculumId) {
    await client.query(
      `update public.curriculum_worksheet_ai_quota
       set ${curriculumColumn} = greatest(${curriculumColumn} + $2, 0), updated_at = now()
       where curriculum_id = $1::uuid`,
      [curriculumId, delta]
    )
  }
  if (includeDaily) {
    await client.query(
      `update public.curriculum_worksheet_ai_daily
       set ${dailyColumn} = greatest(${dailyColumn} + $3, 0)
       where user_id = $1::uuid and usage_date = $2::date`,
      [userId, usageDate, delta]
    )
  }
}

/** Giữ suất miễn phí trước khi gọi AI. Hết suất thì chỉ cho đi tiếp khi còn đủ 0,5 credit. */
export async function beginQuestionTurn(
  userId: string,
  curriculumId: string | null,
  kind: WorksheetQuestionKind
): Promise<QuestionTurn> {
  if (isCurriculumAiCreditsDisabled()) return { action: 'free', undo: async () => {} }
  let turn: QuestionTurn = { action: 'stop', balance: 0, required: WORKSHEET_EXTRA_QUESTION_CREDIT }
  await withLockedQuota(userId, curriculumId, async (client, curriculum, _daily, usageDate) => {
    const created = kind === 'quiz' ? curriculum?.quiz_created ?? 0 : curriculum?.essay_created ?? 0
    const quote = quoteWorksheetQuestionBatch({
      requested: 1,
      curriculumCreated: created,
      hasCurriculum: Boolean(curriculumId),
    })
    if (quote.free > 0) {
      await bumpQuestionCounters(client, userId, curriculumId, kind, usageDate, 1, false)
      turn = {
        action: 'free',
        undo: async () => {
          await withLockedQuota(userId, curriculumId, async (undoClient, _c, _d, undoDate) => {
            await bumpQuestionCounters(undoClient, userId, curriculumId, kind, undoDate, -1, false)
          })
        },
      }
      return
    }
    const balance = await readUserCreditBalance(userId)
    if (balance + 1e-9 < WORKSHEET_EXTRA_QUESTION_CREDIT) {
      turn = { action: 'stop', balance, required: WORKSHEET_EXTRA_QUESTION_CREDIT }
      return
    }
    turn = { action: 'pay' }
  })
  return turn
}

export async function recordPaidWorksheetQuestion(
  curriculumId: string | null,
  kind: WorksheetQuestionKind
): Promise<void> {
  if (!curriculumId || isCurriculumAiCreditsDisabled()) return
  const column = kind === 'quiz' ? 'quiz_created' : 'essay_created'
  await getPgPool().query(
    `insert into public.curriculum_worksheet_ai_quota (curriculum_id, ${column})
     values ($1::uuid, 1)
     on conflict (curriculum_id) do update
     set ${column} = public.curriculum_worksheet_ai_quota.${column} + 1, updated_at = now()`,
    [curriculumId]
  )
}

export async function discardWorksheetQuestion(questionId: string): Promise<void> {
  if (!isPgConfigured()) return
  await getPgPool().query(`delete from public.worksheet_questions where id = $1::uuid`, [questionId])
}

export async function chargeWorksheetQuestion(input: {
  userId: string
  curriculumId: string | null
  kind: WorksheetQuestionKind
  questionId: string
}): Promise<{ ok: true } | { ok: false; balance: number }> {
  const spent = await spendCurriculumAiCredits({
    userId: input.userId,
    amount: WORKSHEET_EXTRA_QUESTION_CREDIT,
    chargeType: CURRICULUM_AI_CHARGE_TYPES.worksheetQuestion,
    eventKey: randomUUID(),
    metadata: {
      curriculumId: input.curriculumId,
      kind: input.kind,
      questionId: input.questionId,
    },
  })
  if (!spent.ok) return { ok: false, balance: spent.newBalance }
  await recordPaidWorksheetQuestion(input.curriculumId, input.kind)
  return { ok: true }
}

export type SgkExtractBilling = {
  mode: 'free' | 'paid' | 'skipped'
  commit: () => Promise<void>
  rollback: () => Promise<void>
}

export async function beginSgkExtractBilling(
  userId: string,
  curriculumId: string | null
): Promise<SgkExtractBilling> {
  if (isCurriculumAiCreditsDisabled()) {
    return { mode: 'skipped', commit: async () => {}, rollback: async () => {} }
  }
  const snapshot = await readWorksheetAiQuotaSnapshot(userId, curriculumId)
  const quote = quoteSgkExtract({
    curriculumExtracts: snapshot.sgkCurriculumExtracts,
    hasCurriculum: Boolean(curriculumId),
  })
  if (quote.waived) {
    let committed = false
    await withLockedQuota(userId, curriculumId, async (client, curriculum) => {
      const again = quoteSgkExtract({
        curriculumExtracts: curriculum?.sgk_extracts ?? 0,
        hasCurriculum: Boolean(curriculumId),
      })
      if (!again.waived) {
        quote.waived = false
        quote.credits = again.credits
        return
      }
      if (curriculumId) {
        await client.query(
          `update public.curriculum_worksheet_ai_quota
           set sgk_extracts = sgk_extracts + 1, updated_at = now()
           where curriculum_id = $1::uuid`,
          [curriculumId]
        )
      }
      committed = true
    })
    if (committed) {
      return {
        mode: 'free',
        commit: async () => {},
        rollback: async () => {
          await withLockedQuota(userId, curriculumId, async (client) => {
            if (!curriculumId) return
            await client.query(
              `update public.curriculum_worksheet_ai_quota
               set sgk_extracts = greatest(sgk_extracts - 1, 0), updated_at = now()
               where curriculum_id = $1::uuid`,
              [curriculumId]
            )
          })
        },
      }
    }
  }

  const balance = await readUserCreditBalance(userId)
  if (balance + 1e-9 < SGK_EXTRACT_REPEAT_CREDIT) {
    throw new WorksheetCreditsError(SGK_EXTRACT_REPEAT_CREDIT, balance, 0)
  }
  const eventKey = randomUUID()
  const spent = await spendCurriculumAiCredits({
    userId,
    amount: SGK_EXTRACT_REPEAT_CREDIT,
    chargeType: CURRICULUM_AI_CHARGE_TYPES.worksheetSgkExtract,
    eventKey,
    metadata: { curriculumId },
  })
  if (!spent.ok) throw new WorksheetCreditsError(SGK_EXTRACT_REPEAT_CREDIT, spent.newBalance, 0)
  let settled = false
  return {
    mode: 'paid',
    commit: async () => {
      if (settled) return
      if (curriculumId) {
        await getPgPool().query(
          `insert into public.curriculum_worksheet_ai_quota (curriculum_id, sgk_extracts)
           values ($1::uuid, 1)
           on conflict (curriculum_id) do update
           set sgk_extracts = public.curriculum_worksheet_ai_quota.sgk_extracts + 1, updated_at = now()`,
          [curriculumId]
        )
      }
      settled = true
    },
    rollback: async () => {
      if (settled) return
      settled = true
      if (await isGuestTrialUser(userId)) return
      await addCreditsToUser(userId, SGK_EXTRACT_REPEAT_CREDIT)
    },
  }
}
