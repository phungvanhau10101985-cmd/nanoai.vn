import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { createGoogleGenerativeAIForUser } from '@/lib/ai/google-api-key-resolver'
import type { TutorTopicName } from '@/lib/ai-tutor/ai-tutor-match'
import { listTutorTopicCatalog, listTutorTopicNames } from '@/lib/ai-tutor/ai-tutor-store'
import { DEEPSEEK_CHAT_COMPLETIONS_URL, buildDeepSeekCompletionBody } from '@/lib/deepseek-api'
import { trackFromUsageMetadata, trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  fetchHomeworkPhotoCache,
  fetchHomeworkProblemCache,
  fetchHomeworkSolution,
  rememberHomeworkPhotoCache,
  rememberHomeworkProblem,
  rememberHomeworkSolution,
  touchHomeworkPhotoCache,
  touchHomeworkProblemCache,
} from '@/lib/homework-help/homework-help-cache'
import {
  HOMEWORK_DRAFT_CALL_MS,
  HOMEWORK_FLASH_CALL_MS,
  HOMEWORK_GEMINI_CALL_MS,
  HOMEWORK_GPT_CALL_MS,
  HOMEWORK_JUDGE_CALL_MS,
  homeworkCallTimeoutMs,
} from '@/lib/homework-help/homework-help-budget'
import {
  answersAgree,
  matchingDeepSeekAnswer,
  mergeAdjudicatedProblem,
  mergeCheckedProblem,
  parseHomeworkChecks,
  parseHomeworkSame,
  parseHomeworkSide,
  parseHomeworkStatements,
  parseIndexedDrafts,
  parseModelJson,
  type HomeworkProblemCheck,
  type HomeworkSideVerdict,
} from '@/lib/homework-help/homework-help-check'
import {
  homeworkPhotoCacheKey,
  homeworkReadIsThin,
  homeworkStatementFingerprint,
  splitTypedHomework,
} from '@/lib/homework-help/homework-help-fingerprint'
import { parseHomeworkSolution, type HomeworkGuide, type HomeworkProblem } from '@/lib/homework-help/homework-help-guide'
import {
  HOMEWORK_HELP_DRAFT_MAX_TOKENS,
  HOMEWORK_HELP_DRAFT_MODEL,
  HOMEWORK_HELP_FALLBACK_MAX_TOKENS,
  HOMEWORK_HELP_FALLBACK_MODEL,
  HOMEWORK_HELP_FALLBACK_THINKING_BUDGET,
  HOMEWORK_HELP_GPT_MAX_TOKENS,
  HOMEWORK_HELP_GPT_MODEL,
  HOMEWORK_HELP_JUDGE_MAX_TOKENS,
  HOMEWORK_HELP_JUDGE_THINKING_BUDGET,
  HOMEWORK_HELP_READ_MAX_TOKENS,
  HOMEWORK_HELP_READ_MODEL,
} from '@/lib/homework-help/homework-help-models'
import { attachHomeworkTags } from '@/lib/homework-help/homework-help-tags'
import { rememberHomeworkCompareEvents, homeworkAnswerCompareOutcome } from '@/lib/homework-help/homework-help-compare'
import { rememberHomeworkUnsolved } from '@/lib/homework-help/homework-help-unsolved'

const LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

export type HomeworkHelpErrorCode =
  | 'unauthorized'
  | 'missing_image'
  | 'too_large'
  | 'bad_type'
  | 'too_many'
  | 'ai_unavailable'
  | 'unreadable'
  | 'missing_text'
  | 'new_thread_failed'
  | 'payment_required'
  | 'insufficient_credits'
  | 'chat_closed'

export type HomeworkImagePart = {
  mimeType: string
  base64: string
}

type GeminiTextResult = {
  response: {
    text: () => string
    usageMetadata?: {
      promptTokenCount?: number
      candidatesTokenCount?: number
      totalTokenCount?: number
    }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
}

function readGeminiText(result: GeminiTextResult): string {
  try {
    const direct = result.response.text()?.trim() || ''
    if (direct) return direct
  } catch {
    // text() throws when the candidate has no text part.
  }
  const parts = result.response.candidates?.[0]?.content?.parts || []
  return parts.map((part) => String(part.text || '')).join('').trim()
}


function languageName(locale: WebLocale): string {
  return LANGUAGE_NAME[locale] ?? LANGUAGE_NAME.vi
}

type GeminiCallStatus = 'ok' | 'parse' | 'transport' | 'budget'

function geminiCauseText(cause: unknown): string {
  if (!cause) return ''
  if (cause instanceof Error) {
    const code =
      'code' in cause && typeof (cause as { code?: unknown }).code === 'string'
        ? (cause as { code: string }).code
        : ''
    const nested = geminiCauseText(cause.cause)
    const head = code ? `${code} ${cause.message}` : cause.message
    return nested ? `${head} | ${nested}` : head
  }
  return String(cause)
}

function describeGeminiFailure(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = geminiCauseText(error.cause)
  return cause ? `${error.message} | ${cause}` : error.message
}

async function generateJson(input: {
  userId: string
  feature: string
  model: string
  temperature: number
  prompt: string
  images?: HomeworkImagePart[]
  startedAt: number
  preferredMs: number
  maxOutputTokens: number
  thinkingBudget?: number
}): Promise<{ status: GeminiCallStatus; value: unknown | null }> {
  const timeoutMs = homeworkCallTimeoutMs(input.startedAt, Date.now(), input.preferredMs)
  if (timeoutMs == null) {
    console.warn('[homework-help] budget spent', input.feature)
    return { status: 'budget', value: null }
  }
  let genAI: GoogleGenerativeAI
  try {
    genAI = await createGoogleGenerativeAIForUser(input.userId)
  } catch (error) {
    console.warn('[homework-help] missing Gemini key', error instanceof Error ? error.message : error)
    return { status: 'transport', value: null }
  }
  const generationConfig = {
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    responseMimeType: 'application/json',
    ...(input.thinkingBudget != null ? { thinkingConfig: { thinkingBudget: input.thinkingBudget } } : {}),
  } as GenerationConfig
  const model = genAI.getGenerativeModel({
    model: input.model,
    generationConfig,
  })
  const parts: Array<string | { inlineData: { mimeType: string; data: string } }> = [input.prompt]
  for (const image of input.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }
  const started = Date.now()
  try {
    const result = (await model.generateContent(parts, { timeout: timeoutMs })) as GeminiTextResult
    void trackFromUsageMetadata(result.response.usageMetadata, input.model, input.feature, input.userId)
    const value = parseModelJson(readGeminiText(result))
    if (value == null) return { status: 'parse', value: null }
    if (input.preferredMs >= HOMEWORK_GEMINI_CALL_MS) {
      console.warn('[homework-help] gemini pro ok', input.model, `${Date.now() - started}ms`)
    }
    return { status: 'ok', value }
  } catch (error) {
    console.warn(
      '[homework-help] generate failed',
      input.feature,
      input.model,
      `${Date.now() - started}ms`,
      describeGeminiFailure(error)
    )
    return { status: 'transport', value: null }
  }
}

async function generateReasonerJson(input: {
  userId: string
  feature: string
  model: string
  prompt: string
  startedAt: number
  preferredMs: number
  maxOutputTokens: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}): Promise<{ status: GeminiCallStatus; value: unknown | null }> {
  const timeoutMs = homeworkCallTimeoutMs(input.startedAt, Date.now(), input.preferredMs)
  if (timeoutMs == null) {
    console.warn('[homework-help] budget spent', input.feature)
    return { status: 'budget', value: null }
  }
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) {
    console.warn('[homework-help] missing DeepSeek key')
    return { status: 'transport', value: null }
  }
  const started = Date.now()
  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(
        buildDeepSeekCompletionBody('verify', {
          model: input.model,
          temperature: 0,
          max_tokens: input.maxOutputTokens,
          reasoning_effort: input.reasoningEffort ?? 'low',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Return only a JSON object. No markdown.' },
            { role: 'user', content: input.prompt },
          ],
        })
      ),
    })
    const rawBody = await res.text()
    const json = (() => {
      try {
        return JSON.parse(rawBody) as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          error?: { message?: string }
        }
      } catch {
        return null
      }
    })()
    if (!res.ok || !json) {
      console.warn(
        '[homework-help] generate failed',
        input.feature,
        input.model,
        `${Date.now() - started}ms`,
        res.status,
        json?.error?.message || rawBody.slice(0, 240) || res.statusText || 'DeepSeek error'
      )
      return { status: 'transport', value: null }
    }
    const text = json.choices?.[0]?.message?.content?.trim() || ''
    trackOpenAiStyleCompletionUsage({
      userId: input.userId,
      model: input.model,
      feature: input.feature,
      usage: json.usage,
      fallbackPromptChars: input.prompt.length,
      fallbackOutputChars: text.length,
    })
    const value = parseModelJson(text)
    if (value == null) return { status: 'parse', value: null }
    console.warn('[homework-help] draft ok', input.model, `${Date.now() - started}ms`)
    return { status: 'ok', value }
  } catch (error) {
    console.warn(
      '[homework-help] generate failed',
      input.feature,
      input.model,
      `${Date.now() - started}ms`,
      describeGeminiFailure(error)
    )
    return { status: 'transport', value: null }
  }
}

async function readStatements(input: {
  userId: string
  locale: WebLocale
  images: HomeworkImagePart[]
  startedAt: number
}): Promise<{ note: string; statements: string[] } | null> {
  const prompt = `You transcribe homework from a photo. Write entirely in ${languageName(input.locale)}.
Return ONLY JSON: {"note":"","statements":["one full problem"]}
Rules:
- One string per exam item, at most 8, in page order.
- A data paragraph and its sub-questions 1. 2. 3. are ONE problem. Keep the whole paragraph, every formula, every equation, every number, every unit, and every sub-question in that same string.
- Transcribe. Do not summarize, do not solve, and do not add facts.
- Write formulas with plain letters and digits: FeCO3, HNO3, H2SO4, Ba(OH)2. Keep the printed numbers.
- Skip a question cut off at the edge when its data is not visible. Ignore student names.
- If the photo is not schoolwork, return an empty statements array and a short note.`
  const call = () =>
    generateJson({
      userId: input.userId,
      feature: 'homework-help-read',
      model: HOMEWORK_HELP_READ_MODEL,
      temperature: 0,
      prompt,
      images: input.images,
      startedAt: input.startedAt,
      preferredMs: HOMEWORK_FLASH_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_READ_MAX_TOKENS,
    })
  let raw = await call()
  let read = raw.status === 'ok' && raw.value != null ? parseHomeworkStatements(raw.value) : null
  if (!read && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] read parse failed, retry')
    raw = await call()
    read = raw.status === 'ok' && raw.value != null ? parseHomeworkStatements(raw.value) : null
  }
  return read
}

function tutorCatalogBlock(rows: TutorTopicName[]): string {
  if (!rows.length) return '(none yet)'
  return rows.map((row) => `${row.topicKey} | ${row.title}`).join('\n')
}

async function draftProblems(input: {
  userId: string
  locale: WebLocale
  statements: Array<{ index: number; statement: string }>
  catalog: TutorTopicName[]
  startedAt: number
}): Promise<Array<{ index: number; problem: HomeworkProblem }> | null> {
  const list = input.statements.map((item) => `[${item.index}] ${item.statement}`).join('\n')
  const prompt = `Write a study guide for these homework questions. Write entirely in ${languageName(input.locale)}.
${list}
Existing saved knowledge tags, one per line as key | title:
${tutorCatalogBlock(input.catalog)}
Return ONLY JSON:
{"problems":[{"index":0,"statement":"","knowledge":[],"thinking":[],"hints":[],"answer":"","tags":[{"key":"","title":""}]}]}
Rules:
- One object per listed index, same index numbers.
- statement: repeat that question.
- knowledge: 3 to 5 short related facts or rules.
- tags: 2 or 3 knowledge tags a student can open. key is English kebab-case. title is in ${languageName(input.locale)}, at most 8 words, and names the idea.
- When a tag is the same idea as a saved tag, copy that key and title exactly.
- thinking: ordered steps that show how to start. Do not finish the calculation or name the final choice.
- hints: up to 4 shorter nudges. Still no final result.
- answer: the final results only, one line. Join sub-questions with " | " in the same order as the problem. Each part is plain formulas and numbers with the units used in the problem (g, ml, mol). Example: "Cu(NO3)2 ; Cu + 4HNO3 → Cu(NO3)2 + 2NO2 + 2H2O | Cu 6,4 g | 40 ml". If a sub-question asks to complete equations, include each balanced equation with the smallest integers. No working, no "1." labels.
- Leave answer empty only when a needed number or formula is missing from the statement.
- Do not put the final number, option letter, formula of the result, or completed result inside knowledge, thinking, hints, or tag titles.`
  const call = () =>
    generateReasonerJson({
      userId: input.userId,
      feature: 'homework-help-draft',
      model: HOMEWORK_HELP_DRAFT_MODEL,
      prompt,
      startedAt: input.startedAt,
      preferredMs: HOMEWORK_DRAFT_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_DRAFT_MAX_TOKENS,
    })
  let raw = await call()
  let drafted = raw.status === 'ok' && raw.value != null ? parseIndexedDrafts(raw.value) : null
  if (!drafted?.length && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] draft parse failed, retry')
    raw = await call()
    drafted = raw.status === 'ok' && raw.value != null ? parseIndexedDrafts(raw.value) : null
  }
  if (!drafted?.length) return null
  return drafted
}

function alignDrafts(
  pending: Array<{ index: number; statement: string }>,
  drafted: Array<{ index: number; problem: HomeworkProblem }> | null
): Array<{ index: number; problem: HomeworkProblem }> {
  const byIndex = new Map((drafted ?? []).map((item) => [item.index, item.problem]))
  const indexHits = pending.filter((item) => byIndex.has(item.index)).length
  const useIndex = drafted != null && indexHits === pending.length
  return pending.map((item, position) => {
    const row = useIndex ? byIndex.get(item.index) : drafted?.[position]?.problem
    return {
      index: item.index,
      problem: {
        statement: item.statement,
        knowledge: row?.knowledge ?? [],
        thinking: row?.thinking ?? [],
        hints: row?.hints ?? [],
        answer: row?.answer ?? '',
        tags: row?.tags ?? [],
      },
    }
  })
}

const ANSWER_RULES = `Rules:
- answer is your own final results, one line. Join sub-questions with " | " in problem order. Plain formulas and the units used in the problem, such as "Cu(NO3)2 ; Cu + 4HNO3 → Cu(NO3)2 + 2NO2 + 2H2O | Cu 6,4 g | 40 ml". If a sub-question asks to complete equations, include each balanced equation with the smallest integers. No "1." labels and no working.
- Leave answer empty only when a needed number or formula is missing from the statement.`

async function solveWithGemini(input: {
  userId: string
  locale: WebLocale
  statements: Array<{ index: number; statement: string }>
  startedAt: number
}): Promise<HomeworkProblemCheck[] | null> {
  const blocks = input.statements.map((item) => `[${item.index}] ${item.statement}`).join('\n')
  const prompt = `Solve each homework question yourself. Write entirely in ${languageName(input.locale)}.
You are not shown any other solution.
${blocks}
Return ONLY JSON:
{"problems":[{"index":0,"answer":""}]}
${ANSWER_RULES}`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'homework-help-fallback',
    model: HOMEWORK_HELP_FALLBACK_MODEL,
    temperature: 0,
    prompt,
    startedAt: input.startedAt,
    preferredMs: HOMEWORK_GEMINI_CALL_MS,
    maxOutputTokens: HOMEWORK_HELP_FALLBACK_MAX_TOKENS,
    thinkingBudget: HOMEWORK_HELP_FALLBACK_THINKING_BUDGET,
  })
  const solved = raw.status === 'ok' ? parseHomeworkChecks(raw.value) : null
  if (!solved?.length) {
    console.warn('[homework-help] gemini pro failed', raw.status)
    return null
  }
  return solved
}

async function solveWithGpt(input: {
  userId: string
  locale: WebLocale
  statements: Array<{ index: number; statement: string }>
  startedAt: number
}): Promise<HomeworkProblemCheck[] | null> {
  const timeoutMs = homeworkCallTimeoutMs(input.startedAt, Date.now(), HOMEWORK_GPT_CALL_MS)
  if (timeoutMs == null) {
    console.warn('[homework-help] budget spent', 'homework-help-gpt')
    return null
  }
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key) {
    console.warn('[homework-help] missing OpenAI key')
    return null
  }
  console.warn('[homework-help] answers differ, gpt', input.statements.length)
  const blocks = input.statements.map((item) => `[${item.index}] ${item.statement}`).join('\n')
  const prompt = `Solve each homework question yourself. Write entirely in ${languageName(input.locale)}.
You are not shown any other solution.
${blocks}
Return ONLY JSON:
{"problems":[{"index":0,"answer":""}]}
${ANSWER_RULES}`
  const model = HOMEWORK_HELP_GPT_MODEL
  const body: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Return only a JSON object. No markdown.' },
      { role: 'user', content: prompt },
    ],
  }
  if (model.startsWith('gpt-5') || model.startsWith('o')) {
    body.max_completion_tokens = HOMEWORK_HELP_GPT_MAX_TOKENS
  } else {
    body.temperature = 0
    body.max_tokens = HOMEWORK_HELP_GPT_MAX_TOKENS
  }
  const started = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    })
    const rawBody = await res.text()
    const json = (() => {
      try {
        return JSON.parse(rawBody) as {
          choices?: Array<{ message?: { content?: string | null } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          error?: { message?: string }
        }
      } catch {
        return null
      }
    })()
    if (!res.ok || !json) {
      console.warn('[homework-help] gpt failed', res.status, (json?.error?.message || rawBody).slice(0, 240))
      return null
    }
    const text = String(json.choices?.[0]?.message?.content ?? '').trim()
    trackOpenAiStyleCompletionUsage({
      userId: input.userId,
      model,
      feature: 'homework-help-gpt',
      usage: json.usage,
      fallbackPromptChars: prompt.length,
      fallbackOutputChars: text.length,
    })
    const solved = parseHomeworkChecks(parseModelJson(text))
    if (!solved?.length) {
      console.warn('[homework-help] gpt parse failed', `${Date.now() - started}ms`, text.slice(0, 180))
      return null
    }
    console.warn('[homework-help] gpt ok', `${Date.now() - started}ms`)
    return solved
  } catch (error) {
    console.warn('[homework-help] gpt failed', `${Date.now() - started}ms`, error instanceof Error ? error.message : error)
    return null
  }
}

const SAME_RESULT_RULES = `Rules:
- The same result means the same substances, the same quantities, and the same required equations.
- Different notation of one molecule is still the same result. HCOO-CH2-CH(OCHO)-CH2-OCHO, CH2(OCHO)CH(OCHO)CH2(OCHO), and C3H5(OCOH)3 are one ester.
- Equivalent chemical tests are the same result. AgNO3/NH3 and Ag2O are both the silver-mirror test.
- A different number, a different compound, or a missing required part is not the same.
- Do not solve the question again.`

function answerLines(rows: Array<{ index: number; statement: string; first: string; second: string; third?: string }>): string {
  return rows
    .map((row) => {
      const lines = [`[${row.index}]`, `Question: ${row.statement}`, `First: ${row.first}`, `Second: ${row.second}`]
      if (row.third != null) lines.push(`Third: ${row.third}`)
      return lines.join('\n')
    })
    .join('\n\n')
}

/** Chữ đã khác. Hỏi một lần hai đáp án có cùng kết quả không. */
async function judgeSameAnswers(input: {
  userId: string
  rows: Array<{ index: number; statement: string; first: string; second: string }>
  startedAt: number
}): Promise<Set<number>> {
  if (!input.rows.length) return new Set()
  const prompt = `Compare these homework answers. Do not solve the questions.
${answerLines(input.rows)}
Return ONLY JSON:
{"problems":[{"index":0,"same":true}]}
${SAME_RESULT_RULES}`
  const call = () =>
    generateJson({
      userId: input.userId,
      feature: 'homework-help-judge',
      model: HOMEWORK_HELP_FALLBACK_MODEL,
      temperature: 0,
      prompt,
      startedAt: input.startedAt,
      preferredMs: HOMEWORK_JUDGE_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_JUDGE_MAX_TOKENS,
      thinkingBudget: HOMEWORK_HELP_JUDGE_THINKING_BUDGET,
    })
  let raw = await call()
  let judged = raw.status === 'ok' ? parseHomeworkSame(raw.value) : null
  if (!judged && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] judge parse failed, retry')
    raw = await call()
    judged = raw.status === 'ok' ? parseHomeworkSame(raw.value) : null
  }
  if (!judged) {
    console.warn('[homework-help] judge failed', raw.status)
    return new Set()
  }
  return new Set(judged.filter((row) => row.same).map((row) => row.index))
}

/** GPT đã giải riêng. Hỏi một lần GPT giống bên nào. Chữ trùng thì không hỏi. */
async function judgeGptSide(input: {
  userId: string
  rows: Array<{ index: number; statement: string; first: string; second: string; third: string }>
  startedAt: number
}): Promise<Map<number, HomeworkSideVerdict['side']>> {
  const sides = new Map<number, HomeworkSideVerdict['side']>()
  if (!input.rows.length) return sides
  const prompt = `A third answer was written without seeing the first two. Compare results. Do not solve the questions.
${answerLines(input.rows)}
Return ONLY JSON:
{"problems":[{"index":0,"side":"draft"}]}
Rules:
- side is draft when the third answer is the same result as the first. If it matches both, choose draft.
- side is check when the third answer is the same result as the second and not the first.
- side is none when it matches neither.
${SAME_RESULT_RULES}`
  const call = () =>
    generateJson({
      userId: input.userId,
      feature: 'homework-help-judge-side',
      model: HOMEWORK_HELP_FALLBACK_MODEL,
      temperature: 0,
      prompt,
      startedAt: input.startedAt,
      preferredMs: HOMEWORK_JUDGE_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_JUDGE_MAX_TOKENS,
      thinkingBudget: HOMEWORK_HELP_JUDGE_THINKING_BUDGET,
    })
  let raw = await call()
  let judged = raw.status === 'ok' ? parseHomeworkSide(raw.value) : null
  if (!judged && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] judge side parse failed, retry')
    raw = await call()
    judged = raw.status === 'ok' ? parseHomeworkSide(raw.value) : null
  }
  if (!judged) {
    console.warn('[homework-help] judge side failed', raw.status)
    return sides
  }
  for (const row of judged) sides.set(row.index, row.side)
  return sides
}

function withSharedTags(problem: HomeworkProblem, saved: TutorTopicName[]): HomeworkProblem {
  return { ...problem, tags: attachHomeworkTags(problem, saved) }
}

async function explainStatements(input: {
  userId: string
  locale: WebLocale
  note: string
  statements: string[]
  startedAt: number
}): Promise<{ guide: HomeworkGuide; everyProblemCacheable: boolean } | null> {
  const savedTopics = await listTutorTopicNames(input.locale)
  const problems: Array<HomeworkProblem | null> = input.statements.map(() => null)
  const pending: Array<{ index: number; statement: string }> = []
  for (let index = 0; index < input.statements.length; index += 1) {
    const statement = input.statements[index] ?? ''
    const fingerprint = homeworkStatementFingerprint(statement)
    const cached = await fetchHomeworkProblemCache(fingerprint, input.locale)
    if (cached) {
      await touchHomeworkProblemCache(fingerprint, input.locale)
      problems[index] = withSharedTags({ ...cached, cached: true }, savedTopics)
      continue
    }
    pending.push({ index, statement })
  }

  let everyProblemCacheable = pending.length === 0
  if (pending.length > 0) {
    const catalog = await listTutorTopicCatalog(input.locale)
    const [drafted, geminiSolved] = await Promise.all([
      draftProblems({
        userId: input.userId,
        locale: input.locale,
        statements: pending,
        catalog,
        startedAt: input.startedAt,
      }),
      solveWithGemini({
        userId: input.userId,
        locale: input.locale,
        statements: pending,
        startedAt: input.startedAt,
      }),
    ])
    if (!drafted) {
      const kept = problems.filter((problem): problem is HomeworkProblem => Boolean(problem))
      if (!kept.length) return null
      return { guide: { note: input.note, problems: kept }, everyProblemCacheable: false }
    }
    const aligned = alignDrafts(pending, drafted)
    const geminiByIndex = new Map((geminiSolved ?? []).map((row) => [row.index, row.answer]))
    const textAgreed = new Set(
      aligned
        .filter((item) => {
          const geminiAnswer = geminiByIndex.get(item.index) ?? ''
          return (
            Boolean(item.problem.answer.trim()) &&
            Boolean(geminiAnswer.trim()) &&
            answersAgree(item.problem.answer, geminiAnswer, item.problem.statement)
          )
        })
        .map((item) => item.index)
    )
    const judgeRows = aligned.flatMap((item) => {
      if (textAgreed.has(item.index)) return []
      const geminiAnswer = geminiByIndex.get(item.index) ?? ''
      if (!item.problem.answer.trim() || !geminiAnswer.trim()) return []
      return [{ index: item.index, statement: item.problem.statement, first: item.problem.answer, second: geminiAnswer }]
    })
    const judgedSame = await judgeSameAnswers({
      userId: input.userId,
      rows: judgeRows,
      startedAt: input.startedAt,
    })
    const needsGpt = aligned.flatMap((item) => {
      if (textAgreed.has(item.index) || judgedSame.has(item.index)) return []
      return [{ index: item.index, statement: item.problem.statement }]
    })
    const gptSolved =
      needsGpt.length > 0
        ? await solveWithGpt({
            userId: input.userId,
            locale: input.locale,
            statements: needsGpt,
            startedAt: input.startedAt,
          })
        : null
    const gptByIndex = new Map((gptSolved ?? []).map((row) => [row.index, row.answer]))
    const draftByIndex = new Map(aligned.map((item) => [item.index, item.problem]))
    const sideByText = new Map<number, 'draft' | 'check'>()
    const sideJudgeRows: Array<{ index: number; statement: string; first: string; second: string; third: string }> = []
    for (const item of needsGpt) {
      const problem = draftByIndex.get(item.index)
      if (!problem) continue
      const geminiAnswer = geminiByIndex.get(item.index) ?? ''
      const gptAnswer = gptByIndex.get(item.index) ?? ''
      const byText = matchingDeepSeekAnswer(problem.answer, geminiAnswer, gptAnswer, problem.statement)
      if (byText) {
        sideByText.set(item.index, byText)
        continue
      }
      if (!gptAnswer.trim() || !problem.answer.trim() || !geminiAnswer.trim()) continue
      sideJudgeRows.push({
        index: item.index,
        statement: problem.statement,
        first: problem.answer,
        second: geminiAnswer,
        third: gptAnswer,
      })
    }
    const judgedSide = await judgeGptSide({
      userId: input.userId,
      rows: sideJudgeRows,
      startedAt: input.startedAt,
    })
    const gptIndexes = new Set(needsGpt.map((row) => row.index))
    everyProblemCacheable = true
    const unsolved: Array<{
      statement: string
      draftAnswer: string
      geminiAnswer: string
      gptAnswer: string
    }> = []
    const compareEvents: Array<{
      checkpoint: 'answer'
      outcome: 'agree' | 'gpt_deepseek' | 'gpt_gemini' | 'unmatched'
      fingerprint: string
    }> = []
    for (const item of aligned) {
      const geminiAnswer = geminiByIndex.get(item.index) ?? ''
      const gptAnswer = gptByIndex.get(item.index) ?? ''
      const agreed = textAgreed.has(item.index) || judgedSame.has(item.index)
      const judged = judgedSide.get(item.index)
      const side = gptIndexes.has(item.index) ? (sideByText.get(item.index) ?? (judged && judged !== 'none' ? judged : '')) : ''
      const geminiCheck = { index: item.index, answer: geminiAnswer, knowledge: [] }
      const merged = agreed
        ? mergeCheckedProblem(item.problem, geminiCheck, { trust: judgedSame.has(item.index) })
        : mergeAdjudicatedProblem(
            item.problem,
            geminiCheck,
            side
              ? {
                  index: item.index,
                  pick: side,
                  answer: side === 'draft' ? item.problem.answer : gptAnswer,
                }
              : { index: item.index, pick: 'none', answer: '' },
            { trust: Boolean(side) }
          )
      if (!merged.problem.answer.trim()) {
        unsolved.push({
          statement: item.problem.statement,
          draftAnswer: item.problem.answer,
          geminiAnswer,
          gptAnswer,
        })
      }
      const tagged = withSharedTags(merged.problem, savedTopics)
      const fingerprint = homeworkStatementFingerprint(item.problem.statement)
      compareEvents.push({
        checkpoint: 'answer',
        outcome: homeworkAnswerCompareOutcome({ agreed, side }),
        fingerprint,
      })
      const cacheable = Boolean(merged.problem.answer.trim()) && (merged.cacheable || Boolean(side))
      const verifyModel = side === 'check' || side === 'draft' ? HOMEWORK_HELP_GPT_MODEL : HOMEWORK_HELP_FALLBACK_MODEL
      problems[item.index] = cacheable
        ? await rememberHomeworkProblem(fingerprint, input.locale, tagged, agreed ? HOMEWORK_HELP_FALLBACK_MODEL : verifyModel)
        : tagged
      if (!cacheable) everyProblemCacheable = false
    }
    if (unsolved.length > 0) {
      await rememberHomeworkUnsolved({
        userId: input.userId,
        locale: input.locale,
        rows: unsolved,
      }).catch((error) =>
        console.warn('[homework-help] unsolved', error instanceof Error ? error.message : error)
      )
    }
    await rememberHomeworkCompareEvents({
      userId: input.userId,
      locale: input.locale,
      events: compareEvents,
    })
  }

  return {
    guide: {
      note: input.note,
      problems: problems.filter((problem): problem is HomeworkProblem => Boolean(problem)),
    },
    everyProblemCacheable,
  }
}

export type HomeworkPhotoRead = {
  note: string
  statements: string[]
  photoKey: string
}

function statementKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Đọc chữ trên ảnh. Chưa chữa. `force` bỏ cache để đọc lại ảnh. */
export async function readHomeworkImages(input: {
  userId: string
  locale: WebLocale
  images: HomeworkImagePart[]
  force?: boolean
}): Promise<HomeworkPhotoRead | 'unreadable'> {
  const photoKey = homeworkPhotoCacheKey(input.images)
  if (!input.force) {
    const cachedPhoto = await fetchHomeworkPhotoCache(photoKey, input.locale)
    if (cachedPhoto && cachedPhoto.problems.length > 0) {
      return {
        note: cachedPhoto.note,
        statements: cachedPhoto.problems.map((problem) => problem.statement),
        photoKey,
      }
    }
  }

  const startedAt = Date.now()
  let read = await readStatements({ ...input, startedAt })
  if (!read) return 'unreadable'
  if (homeworkReadIsThin(read.statements) && Date.now() - startedAt < 20_000) {
    console.warn('[homework-help] thin read, retry')
    const again = await readStatements({ ...input, startedAt })
    if (again && !homeworkReadIsThin(again.statements)) read = again
  }
  return { note: read.note, statements: read.statements, photoKey }
}

/** Chữa các đề học sinh đã đọc lại và sửa tay. Model giải chỉ nhận chữ này, không nhận ảnh. */
export async function explainReviewedStatements(input: {
  userId: string
  locale: WebLocale
  note: string
  statements: string[]
  photoKey: string
}): Promise<HomeworkGuide | 'ai_unavailable'> {
  const statements = input.statements.map(statementKey).filter(Boolean).slice(0, 8)
  if (!statements.length) return { note: input.note, problems: [] }

  const photoKey = /^[a-f0-9]{64}$/.test(input.photoKey) ? input.photoKey : ''
  if (photoKey) {
    const cachedPhoto = await fetchHomeworkPhotoCache(photoKey, input.locale)
    const cachedStatements = cachedPhoto?.problems.map((problem) => statementKey(problem.statement)) ?? []
    const same =
      cachedPhoto != null &&
      cachedStatements.length === statements.length &&
      cachedStatements.every((item, index) => item === statements[index])
    if (cachedPhoto && same && cachedPhoto.problems.length > 0) {
      await touchHomeworkPhotoCache(photoKey, input.locale)
      const savedTopics = await listTutorTopicNames(input.locale)
      return {
        note: cachedPhoto.note || input.note,
        problems: cachedPhoto.problems.map((problem) => withSharedTags({ ...problem, cached: true }, savedTopics)),
      }
    }
  }

  const explained = await explainStatements({
    userId: input.userId,
    locale: input.locale,
    note: input.note,
    statements,
    startedAt: Date.now(),
  })
  if (!explained) return 'ai_unavailable'
  if (photoKey && explained.everyProblemCacheable) {
    await rememberHomeworkPhotoCache(photoKey, input.locale, explained.guide)
  }
  return explained.guide
}

export async function explainHomeworkImages(input: {
  userId: string
  locale: WebLocale
  images: HomeworkImagePart[]
}): Promise<HomeworkGuide | 'unreadable' | 'ai_unavailable'> {
  const read = await readHomeworkImages(input)
  if (read === 'unreadable') return 'unreadable'
  if (read.statements.length === 0) return { note: read.note, problems: [] }
  return explainReviewedStatements({
    userId: input.userId,
    locale: input.locale,
    note: read.note,
    statements: read.statements,
    photoKey: read.photoKey,
  })
}

export async function explainHomeworkText(input: {
  userId: string
  locale: WebLocale
  text: string
}): Promise<HomeworkGuide | 'ai_unavailable'> {
  const statements = splitTypedHomework(input.text)
  if (!statements.length) return { note: '', problems: [] }
  const explained = await explainStatements({
    userId: input.userId,
    locale: input.locale,
    note: '',
    statements,
    startedAt: Date.now(),
  })
  return explained?.guide ?? 'ai_unavailable'
}

/** Viết lời giải một lần rồi giữ trong cache. Không trừ credit ở đây. */
export async function writeHomeworkSolution(input: {
  userId: string
  locale: WebLocale
  statement: string
  answer: string
}): Promise<{ solution: string; cached: boolean } | null> {
  const statement = input.statement.trim()
  if (!statement) return null
  const fingerprint = homeworkStatementFingerprint(statement)
  const saved = await fetchHomeworkSolution(fingerprint, input.locale)
  if (saved) {
    await touchHomeworkProblemCache(fingerprint, input.locale)
    return { solution: saved, cached: true }
  }
  const answer = input.answer.trim()
  const answerLine = answer
    ? `Checked final answer. The working must arrive at this and must not replace it:\n${answer}`
    : 'No checked final answer was stored. Derive the result from the question.'
  const prompt = `Write the full worked solution for this homework question. Write entirely in ${languageName(input.locale)}.
Question:
${statement}

${answerLine}

Return ONLY JSON:
{"solution":""}
Rules:
- solution is the working a student reads after they chose to open it. Several short lines, separated by newline characters.
- Show each formula, rearrangement, and arithmetic step.
- The last line is the final result. When a checked answer is given above, repeat that result, unchanged.
- Do not stop at a hint. Do not omit the calculations.`
  const startedAt = Date.now()
  const call = () =>
    generateReasonerJson({
      userId: input.userId,
      feature: 'homework-help-solution',
      model: HOMEWORK_HELP_DRAFT_MODEL,
      prompt,
      startedAt,
      preferredMs: HOMEWORK_DRAFT_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_DRAFT_MAX_TOKENS,
      reasoningEffort: 'high',
    })
  let raw = await call()
  let solution = raw.status === 'ok' && raw.value != null ? parseHomeworkSolution(raw.value) : ''
  if (!solution && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] solution parse failed, retry')
    raw = await call()
    solution = raw.status === 'ok' && raw.value != null ? parseHomeworkSolution(raw.value) : ''
  }
  if (!solution) return null
  await rememberHomeworkSolution({
    fingerprint,
    locale: input.locale,
    statement,
    answer,
    solution,
  })
  const stored = await fetchHomeworkSolution(fingerprint, input.locale)
  if (stored && stored !== solution) return { solution: stored, cached: true }
  return { solution, cached: false }
}
