import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { createGoogleGenerativeAIForUser } from '@/lib/ai/google-api-key-resolver'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  fetchHomeworkPhotoCache,
  fetchHomeworkProblemCache,
  rememberHomeworkPhotoCache,
  rememberHomeworkProblem,
  touchHomeworkPhotoCache,
  touchHomeworkProblemCache,
} from '@/lib/homework-help/homework-help-cache'
import {
  mergeCheckedProblem,
  parseHomeworkChecks,
  parseHomeworkStatements,
  parseIndexedDrafts,
  type HomeworkProblemCheck,
} from '@/lib/homework-help/homework-help-check'
import {
  homeworkPhotoCacheKey,
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
  HOMEWORK_HELP_CHECK_MODEL,
  HOMEWORK_HELP_DRAFT_MODEL,
  HOMEWORK_HELP_READ_MODEL,
  HOMEWORK_HELP_REVIEW_MODEL,
} from '@/lib/homework-help/homework-help-models'

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

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

function languageName(locale: WebLocale): string {
  return LANGUAGE_NAME[locale] ?? LANGUAGE_NAME.vi
}

async function generateJson(input: {
  userId: string
  feature: string
  model: string
  temperature: number
  prompt: string
  images?: HomeworkImagePart[]
}): Promise<unknown | null> {
  let genAI: GoogleGenerativeAI
  try {
    genAI = await createGoogleGenerativeAIForUser(input.userId)
  } catch (error) {
    console.warn('[homework-help] missing Gemini key', error instanceof Error ? error.message : error)
    return null
  }
  const model = genAI.getGenerativeModel({
    model: input.model,
    generationConfig: {
      temperature: input.temperature,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  })
  const parts: Array<string | { inlineData: { mimeType: string; data: string } }> = [input.prompt]
  for (const image of input.images ?? []) {
    parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })
  }
  try {
    const result = (await model.generateContent(parts)) as GeminiTextResult
    void trackFromUsageMetadata(result.response.usageMetadata, input.model, input.feature, input.userId)
    return parseJsonObject(readGeminiText(result))
  } catch (error) {
    console.warn('[homework-help] generate failed', error instanceof Error ? error.message : error)
    return null
  }
}

async function readStatements(input: {
  userId: string
  locale: WebLocale
  images: HomeworkImagePart[]
}): Promise<{ note: string; statements: string[] } | null> {
  const prompt = `You read a homework photo. Write entirely in ${languageName(input.locale)}.
Return ONLY JSON: {"note":"","statements":["one school question"]}
Rules:
- One string per visible school question, at most 8, in page order.
- Copy the question in plain words. Do not solve it and do not add knowledge.
- Ignore names, scores, and page headers.
- If the photo is not schoolwork, return an empty statements array and a short note.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'homework-help-read',
    model: HOMEWORK_HELP_READ_MODEL,
    temperature: 0,
    prompt,
    images: input.images,
  })
  if (!raw) return null
  return parseHomeworkStatements(raw)
}

async function draftProblems(input: {
  userId: string
  locale: WebLocale
  statements: Array<{ index: number; statement: string }>
}): Promise<Array<{ index: number; problem: HomeworkProblem }> | null> {
  const list = input.statements.map((item) => `[${item.index}] ${item.statement}`).join('\n')
  const prompt = `Write a study guide for these homework questions. Write entirely in ${languageName(input.locale)}.
${list}
Return ONLY JSON:
{"problems":[{"index":0,"statement":"","knowledge":[],"thinking":[],"hints":[],"answer":""}]}
Rules:
- One object per listed index, same index numbers.
- statement: repeat that question.
- knowledge: 3 to 5 short related facts or rules.
- thinking: ordered steps that show how to start. Do not finish the calculation or name the final choice.
- hints: up to 4 shorter nudges. Still no final result.
- answer: the final result only, one short line. Leave empty if the question cannot be answered from the text.
- Do not put the final number, option letter, or completed result inside knowledge, thinking, or hints.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'homework-help-draft',
    model: HOMEWORK_HELP_DRAFT_MODEL,
    temperature: 0,
    prompt,
  })
  if (!raw) return null
  const drafted = parseIndexedDrafts(raw)
  if (!drafted || drafted.length === 0) return null
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
      },
    }
  })
}

async function checkProblems(input: {
  userId: string
  locale: WebLocale
  drafts: Array<{ index: number; problem: HomeworkProblem }>
}): Promise<HomeworkProblemCheck[] | null> {
  const blocks = input.drafts
    .map((item) => {
      const lines = item.problem.knowledge.map((line, index) => `  [${index}] ${line}`).join('\n')
      return `[${item.index}] ${item.problem.statement}\n${lines || '  (no knowledge lines)'}`
    })
    .join('\n')
  const prompt = `Check school knowledge before a student sees it. Write entirely in ${languageName(input.locale)}.
Solve each question yourself. You are not shown any draft answer.
${blocks}
Return ONLY JSON:
{"problems":[{"index":0,"answer":"","knowledge":[{"index":0,"ok":true}]}]}
Rules:
- answer is your own final result, one short line. Leave empty if the text is not enough.
- knowledge lists every draft line index. ok is true only when that line is factually right for this question.
- A wrong rule, a wrong formula, or a line that states the final result is not ok.
- Do not add knowledge lines.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'homework-help-check',
    model: HOMEWORK_HELP_CHECK_MODEL,
    temperature: 0,
    prompt,
  })
  if (!raw) return null
  return parseHomeworkChecks(raw)
}

async function explainStatements(input: {
  userId: string
  locale: WebLocale
  note: string
  statements: string[]
}): Promise<{ guide: HomeworkGuide; everyProblemCacheable: boolean }> {
  const problems: Array<HomeworkProblem | null> = input.statements.map(() => null)
  const pending: Array<{ index: number; statement: string }> = []
  for (let index = 0; index < input.statements.length; index += 1) {
    const statement = input.statements[index] ?? ''
    const fingerprint = homeworkStatementFingerprint(statement)
    const cached = await fetchHomeworkProblemCache(fingerprint, input.locale)
    if (cached) {
      await touchHomeworkProblemCache(fingerprint, input.locale)
      problems[index] = cached
      continue
    }
    pending.push({ index, statement })
  }

  let everyProblemCacheable = pending.length === 0
  if (pending.length > 0) {
    let drafted = await draftProblems({ userId: input.userId, locale: input.locale, statements: pending })
    if (!drafted) {
      drafted = await draftProblems({ userId: input.userId, locale: input.locale, statements: pending })
    }
    const aligned = alignDrafts(pending, drafted)
    const checks = drafted
      ? await checkProblems({ userId: input.userId, locale: input.locale, drafts: aligned })
      : null
    everyProblemCacheable = Boolean(drafted && checks)
    for (const item of aligned) {
      const check = checks?.find((row) => row.index === item.index) ?? null
      const merged = mergeCheckedProblem(item.problem, check)
      const fingerprint = homeworkStatementFingerprint(item.problem.statement)
      problems[item.index] = merged.cacheable
        ? await rememberHomeworkProblem(fingerprint, input.locale, merged.problem)
        : merged.problem
      if (!merged.cacheable) everyProblemCacheable = false
    }
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
}): Promise<HomeworkGuide | null> {
  const photoKey = homeworkPhotoCacheKey(input.images)
  const cachedPhoto = await fetchHomeworkPhotoCache(photoKey, input.locale)
  if (cachedPhoto && cachedPhoto.problems.length > 0) {
    await touchHomeworkPhotoCache(photoKey, input.locale)
    return cachedPhoto
  }

  const read = await readStatements(input)
  if (!read) return null
  if (read.statements.length === 0) return { note: read.note, problems: [] }

  const explained = await explainStatements({
    userId: input.userId,
    locale: input.locale,
    note: read.note,
    statements: read.statements,
  })
  if (explained.everyProblemCacheable) {
    await rememberHomeworkPhotoCache(photoKey, input.locale, explained.guide)
  }
  return explained.guide
}

export async function explainHomeworkText(input: {
  userId: string
  locale: WebLocale
  text: string
}): Promise<HomeworkGuide | null> {
  const statements = splitTypedHomework(input.text)
  if (!statements.length) return { note: '', problems: [] }
  const explained = await explainStatements({
    userId: input.userId,
    locale: input.locale,
    note: '',
    statements,
  })
  return explained.guide
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
  const raw = await generateJson({
    userId: input.userId,
    feature: 'homework-help-review',
    model: HOMEWORK_HELP_REVIEW_MODEL,
    temperature: 0.2,
    prompt,
  })
  if (!raw) return null
  return parseHomeworkReview(raw)
}
