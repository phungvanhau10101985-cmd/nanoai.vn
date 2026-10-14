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
  rememberHomeworkPhotoCache,
  rememberHomeworkProblem,
  touchHomeworkPhotoCache,
  touchHomeworkProblemCache,
} from '@/lib/homework-help/homework-help-cache'
import {
  HOMEWORK_DRAFT_CALL_MS,
  HOMEWORK_FLASH_CALL_MS,
  HOMEWORK_GEMINI_CALL_MS,
  HOMEWORK_GPT_CALL_MS,
  homeworkCallTimeoutMs,
} from '@/lib/homework-help/homework-help-budget'
import {
  answersAgree,
  matchingDeepSeekAnswer,
  mergeAdjudicatedProblem,
  mergeCheckedProblem,
  parseHomeworkChecks,
  parseHomeworkStatements,
  parseIndexedDrafts,
  parseModelJson,
  type HomeworkProblemCheck,
} from '@/lib/homework-help/homework-help-check'
import {
  homeworkPhotoCacheKey,
  homeworkReadIsThin,
  homeworkStatementFingerprint,
  splitTypedHomework,
} from '@/lib/homework-help/homework-help-fingerprint'
import {
  parseHomeworkReview,
  type HomeworkGuide,
  type HomeworkProblem,
  type HomeworkReview,
} from '@/lib/homework-help/homework-help-guide'
import {
  HOMEWORK_HELP_DRAFT_MAX_TOKENS,
  HOMEWORK_HELP_DRAFT_MODEL,
  HOMEWORK_HELP_FALLBACK_MAX_TOKENS,
  HOMEWORK_HELP_FALLBACK_MODEL,
  HOMEWORK_HELP_FALLBACK_THINKING_BUDGET,
  HOMEWORK_HELP_GPT_MAX_TOKENS,
  HOMEWORK_HELP_GPT_MODEL,
  HOMEWORK_HELP_GRADE_MAX_TOKENS,
  HOMEWORK_HELP_GRADE_MODEL,
  HOMEWORK_HELP_READ_MAX_TOKENS,
  HOMEWORK_HELP_READ_MODEL,
  HOMEWORK_HELP_REVIEW_MAX_TOKENS,
  HOMEWORK_HELP_REVIEW_MODEL,
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
  | 'missing_attempt'
  | 'missing_text'
  | 'new_thread_failed'
  | 'payment_required'

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
          reasoning_effort: 'low',
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

async function gradeKnowledge(input: {
  userId: string
  locale: WebLocale
  rows: Array<{ index: number; statement: string; knowledge: string[] }>
  startedAt: number
}): Promise<HomeworkProblemCheck[] | null> {
  const blocks = input.rows
    .map((item) => {
      const lines = item.knowledge.map((line, index) => `  [${index}] ${line}`).join('\n')
      return `[${item.index}] ${item.statement}\n${lines}`
    })
    .join('\n')
  const prompt = `Mark school knowledge lines before a student sees them. Write entirely in ${languageName(input.locale)}.
${blocks}
Return ONLY JSON:
{"problems":[{"index":0,"knowledge":[{"index":0,"ok":true}]}]}
Rules:
- knowledge lists every line index shown above.
- ok is true only when that line is factually right for this question.
- A wrong rule, a wrong formula, or a line that states the final result is not ok.
- Do not add lines and do not write the solution.`
  const call = () =>
    generateJson({
      userId: input.userId,
      feature: 'homework-help-grade',
      model: HOMEWORK_HELP_GRADE_MODEL,
      temperature: 0,
      prompt,
      startedAt: input.startedAt,
      preferredMs: HOMEWORK_FLASH_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_GRADE_MAX_TOKENS,
    })
  let raw = await call()
  let grades = raw.status === 'ok' ? parseHomeworkChecks(raw.value) : null
  if (!grades?.length && raw.status !== 'transport' && raw.status !== 'budget') {
    console.warn('[homework-help] grade parse failed, retry')
    raw = await call()
    grades = raw.status === 'ok' ? parseHomeworkChecks(raw.value) : null
  }
  if (!grades?.length) return null
  return grades
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
    const needsGpt = aligned.flatMap((item) => {
      const geminiAnswer = geminiByIndex.get(item.index) ?? ''
      if (
        item.problem.answer.trim() &&
        geminiAnswer.trim() &&
        answersAgree(item.problem.answer, geminiAnswer, item.problem.statement)
      ) {
        return []
      }
      return [{ index: item.index, statement: item.problem.statement }]
    })
    const gradeRows = aligned
      .filter((item) => item.problem.knowledge.length > 0)
      .map((item) => ({
        index: item.index,
        statement: item.problem.statement,
        knowledge: item.problem.knowledge,
      }))
    const [grades, gptSolved] = await Promise.all([
      gradeRows.length > 0
        ? gradeKnowledge({
            userId: input.userId,
            locale: input.locale,
            rows: gradeRows,
            startedAt: input.startedAt,
          })
        : Promise.resolve(null),
      needsGpt.length > 0
        ? solveWithGpt({
            userId: input.userId,
            locale: input.locale,
            statements: needsGpt,
            startedAt: input.startedAt,
          })
        : Promise.resolve(null),
    ])
    const gradeByIndex = new Map((grades ?? []).map((row) => [row.index, row.knowledge]))
    const gptByIndex = new Map((gptSolved ?? []).map((row) => [row.index, row.answer]))
    const gptIndexes = new Set(needsGpt.map((row) => row.index))
    everyProblemCacheable = true
    const unsolved: Array<{
      statement: string
      draftAnswer: string
      geminiAnswer: string
      gptAnswer: string
    }> = []
    const compareEvents: Array<{
      checkpoint: 'answer' | 'knowledge'
      outcome: 'agree' | 'gpt_deepseek' | 'gpt_gemini' | 'unmatched' | 'ok' | 'not_ok'
      fingerprint: string
    }> = []
    for (const item of aligned) {
      const itemGrades = gradeByIndex.get(item.index) ?? []
      const geminiAnswer = geminiByIndex.get(item.index) ?? ''
      const gptAnswer = gptByIndex.get(item.index) ?? ''
      const agreed =
        Boolean(item.problem.answer.trim()) &&
        Boolean(geminiAnswer.trim()) &&
        answersAgree(item.problem.answer, geminiAnswer, item.problem.statement)
      const side = gptIndexes.has(item.index)
        ? matchingDeepSeekAnswer(item.problem.answer, geminiAnswer, gptAnswer, item.problem.statement)
        : ''
      const geminiCheck = { index: item.index, answer: geminiAnswer, knowledge: itemGrades }
      const merged = agreed
        ? mergeCheckedProblem(item.problem, geminiCheck)
        : mergeAdjudicatedProblem(
            item.problem,
            geminiCheck,
            side
              ? {
                  index: item.index,
                  pick: side,
                  answer: side === 'draft' ? item.problem.answer : geminiAnswer,
                }
              : { index: item.index, pick: 'none', answer: '' },
            itemGrades
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
      for (const grade of itemGrades) {
        compareEvents.push({
          checkpoint: 'knowledge',
          outcome: grade.ok ? 'ok' : 'not_ok',
          fingerprint,
        })
      }
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

export async function explainHomeworkImages(input: {
  userId: string
  locale: WebLocale
  images: HomeworkImagePart[]
}): Promise<HomeworkGuide | 'unreadable' | 'ai_unavailable'> {
  const photoKey = homeworkPhotoCacheKey(input.images)
  const cachedPhoto = await fetchHomeworkPhotoCache(photoKey, input.locale)
  if (cachedPhoto && cachedPhoto.problems.length > 0) {
    await touchHomeworkPhotoCache(photoKey, input.locale)
    const savedTopics = await listTutorTopicNames(input.locale)
    return {
      note: cachedPhoto.note,
      problems: cachedPhoto.problems.map((problem) => withSharedTags({ ...problem, cached: true }, savedTopics)),
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
  if (read.statements.length === 0) return { note: read.note, problems: [] }

  const explained = await explainStatements({
    userId: input.userId,
    locale: input.locale,
    note: read.note,
    statements: read.statements,
    startedAt,
  })
  if (!explained) return 'ai_unavailable'
  if (explained.everyProblemCacheable) {
    await rememberHomeworkPhotoCache(photoKey, input.locale, explained.guide)
  }
  return explained.guide
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

export async function reviewHomeworkAttempt(input: {
  userId: string
  locale: WebLocale
  statement: string
  attempt: string
}): Promise<HomeworkReview | null> {
  const fingerprint = homeworkStatementFingerprint(input.statement)
  const cached = await fetchHomeworkProblemCache(fingerprint, input.locale)
  if (cached) await touchHomeworkProblemCache(fingerprint, input.locale)
  const truth = cached?.answer.trim() ?? ''
  const truthLine = truth
    ? `Checked answer, private, never quote it or any equivalent form: ${truth}`
    : 'No checked answer is available. Judge the method only.'
  const prompt = `A student already tried this question. Judge their attempt. Write entirely in ${languageName(input.locale)}.
Question:
${input.statement}

Student attempt:
${input.attempt}

${truthLine}

Return ONLY JSON:
{"checks":[{"label":"","ok":true,"note":""}],"gap":""}
Rules:
- checks: 1 to 5 steps. ok is true only when that part of the attempt is sound.
- note explains why, without writing the correct final answer, option letter, or a worked solution.
- gap: one sentence on the idea to revisit. No final answer.`
  const startedAt = Date.now()
  const call = () =>
    generateJson({
      userId: input.userId,
      feature: 'homework-help-review',
      model: HOMEWORK_HELP_REVIEW_MODEL,
      temperature: 0.2,
      prompt,
      startedAt,
      preferredMs: HOMEWORK_FLASH_CALL_MS,
      maxOutputTokens: HOMEWORK_HELP_REVIEW_MAX_TOKENS,
    })
  let raw = await call()
  let review = raw.status === 'ok' && raw.value != null ? parseHomeworkReview(raw.value) : null
  if (!review && (raw.status === 'parse' || raw.status === 'ok')) {
    console.warn('[homework-help] review parse failed, retry')
    raw = await call()
    review = raw.status === 'ok' && raw.value != null ? parseHomeworkReview(raw.value) : null
  }
  return review
}
