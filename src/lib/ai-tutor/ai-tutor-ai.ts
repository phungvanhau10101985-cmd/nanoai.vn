import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { createGoogleGenerativeAIForUser } from '@/lib/ai/google-api-key-resolver'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { AI_TUTOR_CHECK_MODEL, AI_TUTOR_DRAFT_MODEL } from '@/lib/ai-tutor/ai-tutor-models'
import {
  bindLabelsToSaved,
  pickSavedTopicByTag,
  pickSavedTopicFromClassified,
  pickSavedTopicFromQuestion,
  type TutorTopicName,
} from '@/lib/ai-tutor/ai-tutor-match'
import { parseTutorCheck, parseTutorClassify, parseTutorDraft, tutorTopicKey } from '@/lib/ai-tutor/ai-tutor-parse'
import {
  appendTutorMessage,
  ensureTutorSession,
  fetchTutorTopic,
  listTutorTopicCatalog,
  listTutorTopicNames,
  rememberTutorTopic,
  touchTutorTopic,
} from '@/lib/ai-tutor/ai-tutor-store'
import type { TutorAnswer, TutorLabel } from '@/lib/ai-tutor/ai-tutor-types'

const LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
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

function languageName(locale: WebLocale): string {
  return LANGUAGE_NAME[locale] ?? LANGUAGE_NAME.vi
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

async function generateJson(input: {
  userId: string
  feature: string
  model: string
  maxOutputTokens: number
  prompt: string
}): Promise<unknown | null> {
  let genAI: GoogleGenerativeAI
  try {
    genAI = await createGoogleGenerativeAIForUser(input.userId)
  } catch (error) {
    console.warn('[ai-tutor] missing Gemini key', error instanceof Error ? error.message : error)
    return null
  }
  const model = genAI.getGenerativeModel({
    model: input.model,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: input.maxOutputTokens,
      responseMimeType: 'application/json',
    },
  })
  try {
    const result = (await model.generateContent(input.prompt)) as GeminiTextResult
    void trackFromUsageMetadata(result.response.usageMetadata, input.model, input.feature, input.userId).catch(
      () => undefined
    )
    const text = readGeminiText(result)
    if (!text) {
      const finish = result.response.candidates?.[0] as { finishReason?: string } | undefined
      console.warn('[ai-tutor] empty text', input.feature, finish?.finishReason ?? 'no-candidate')
      return null
    }
    return parseJsonObject(text)
  } catch (error) {
    console.warn('[ai-tutor] generate failed', error instanceof Error ? error.message : error)
    return null
  }
}

const BROAD_TOPIC =
  /^(toan|ngu-van|van|vat-ly|vat-ly-hoc|hoa|hoa-hoc|sinh|sinh-hoc|lich-su|dia-ly|tieng-anh|physics|math|maths|chemistry|biology|science|history|geography|english|khoa-hoc|tu-nhien)$/

function isBroadTopic(topicKey: string): boolean {
  return BROAD_TOPIC.test(topicKey)
}

function catalogBlock(rows: Array<{ topicKey: string; title: string }>): string {
  if (!rows.length) return '(none yet)'
  return rows.map((row) => `${row.topicKey} | ${row.title}`).join('\n')
}

function labelsExcept(labels: TutorLabel[], topicKey: string): TutorLabel[] {
  return labels.filter((label) => label.key !== topicKey).slice(0, 3)
}

async function classifyQuestion(input: {
  userId: string
  locale: WebLocale
  text: string
  catalog: Array<{ topicKey: string; title: string }>
}): Promise<{ topicKey: string; title: string; reuse: boolean } | null> {
  const prompt = `Classify one student question into a school topic. The title must be in ${languageName(input.locale)}.
Existing topics, one per line as key | title:
${catalogBlock(input.catalog)}

Question:
${input.text}

Return ONLY JSON: {"topicKey":"","title":"","reuse":false}
Rules:
- topicKey is lowercase English kebab-case, 3 to 48 characters, and names the specific idea. "why is the sky blue" is "blue-sky", not "physics" or "vat-ly".
- Never use a school subject as the key or the title.
- reuse is true only when this question is the same idea as one existing topic. Then topicKey and title must be copied exactly from that line.
- title is a short specific lesson name a student would recognize, in ${languageName(input.locale)}, at most 6 words.
- Do not answer the question.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'ai-tutor-classify',
    model: AI_TUTOR_DRAFT_MODEL,
    maxOutputTokens: 2048,
    prompt,
  })
  return raw ? parseTutorClassify(raw) : null
}

async function draftLesson(input: {
  userId: string
  locale: WebLocale
  question: string
  title: string
  catalog: TutorTopicName[]
}): Promise<{ explanation: string; practice: string; labels: TutorLabel[] } | null> {
  const prompt = `You are a tutor in a private 1:1 chat with one student. Write entirely in ${languageName(input.locale)}.
Topic: ${input.title}
Student question:
${input.question}

Existing saved topics, one per line as key | title:
${catalogBlock(input.catalog)}

Return ONLY JSON:
{"explanation":"","practice":"","labels":[{"key":"","title":""}]}
Rules:
- explanation: 4 to 8 short sentences in everyday words. Define a term the first time you use it. Plain text, no markdown.
- practice: one real situation outside class, such as a kitchen, a market, a phone, a bus, or a sport. No invented statistics.
- labels: exactly 2 or 3 deeper related ideas. key is English kebab-case. title is in ${languageName(input.locale)}, at most 8 words.
- When a label is the same idea as an existing topic, copy that key and title exactly.
- Do not repeat the main topic as a label.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'ai-tutor-draft',
    model: AI_TUTOR_DRAFT_MODEL,
    maxOutputTokens: 8192,
    prompt,
  })
  return raw ? parseTutorDraft(raw) : null
}

async function checkLesson(input: {
  userId: string
  locale: WebLocale
  question: string
  explanation: string
  practice: string
  labels: TutorLabel[]
}): Promise<{ ok: boolean; explanation: string; practice: string; labels: TutorLabel[] } | null> {
  const labelLines = input.labels.map((label) => `- ${label.key}: ${label.title}`).join('\n')
  const prompt = `Cross-check a tutor note before other students reuse it. Write prose and label titles in ${languageName(input.locale)}.
Question:
${input.question}

Draft explanation:
${input.explanation}

Draft real-life situation:
${input.practice}

Draft labels:
${labelLines}

Return ONLY JSON:
{"ok":true,"explanation":"","practice":"","labels":[{"key":"","title":"","ok":true}]}
Rules:
- Solve the idea yourself. ok is true only when the explanation is factually right and the practice is a real situation.
- If a sentence is wrong, rewrite explanation and practice so they are right. Set ok false when you cannot make them right.
- A label ok is true only when it is a real deeper idea, not a repeat of the question. Keep 2 or 3 labels.
- Plain text. No markdown.`
  const raw = await generateJson({
    userId: input.userId,
    feature: 'ai-tutor-check',
    model: AI_TUTOR_CHECK_MODEL,
    maxOutputTokens: 8192,
    prompt,
  })
  return raw ? parseTutorCheck(raw) : null
}

async function recordTurn(input: {
  sessionId: string | null
  userId: string
  question: string
  kind: 'question' | 'label'
  answer: TutorAnswer
}): Promise<void> {
  if (!input.sessionId) return
  await appendTutorMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'user',
    body: input.question,
    topicKey: input.answer.topicKey,
    kind: input.kind,
    payload: {},
  })
  await appendTutorMessage({
    sessionId: input.sessionId,
    userId: input.userId,
    role: 'tutor',
    body: input.answer.explanation,
    topicKey: input.answer.topicKey,
    kind: 'answer',
    payload: input.answer,
  })
}

function withSavedTags(labels: TutorLabel[], saved: TutorTopicName[], parentTitle: string, parentKey: string): TutorLabel[] {
  const bound = bindLabelsToSaved(labelsExcept(labels, parentKey), saved, parentTitle)
  return bound.length >= 2 ? bound : labelsExcept(labels, parentKey)
}

async function serveSaved(input: {
  sessionId: string | null
  userId: string
  locale: string
  question: string
  kind: 'question' | 'label'
  topicKey: string
}): Promise<TutorAnswer | null> {
  const existing = await fetchTutorTopic(input.topicKey, input.locale)
  if (!existing) return null
  await touchTutorTopic(existing.topicKey, input.locale)
  await recordTurn({
    sessionId: input.sessionId,
    userId: input.userId,
    question: input.question,
    kind: input.kind,
    answer: existing,
  })
  return existing
}

async function composeFresh(input: {
  userId: string
  locale: WebLocale
  question: string
  topicKey: string
  title: string
  saved: TutorTopicName[]
  catalog: TutorTopicName[]
}): Promise<TutorAnswer | null> {
  let drafted = await draftLesson(input)
  if (!drafted) drafted = await draftLesson(input)
  if (!drafted) return null
  const draftLabels = withSavedTags(drafted.labels, input.saved, input.title, input.topicKey)
  const checked = await checkLesson({
    userId: input.userId,
    locale: input.locale,
    question: input.question,
    explanation: drafted.explanation,
    practice: drafted.practice,
    labels: draftLabels.length >= 2 ? draftLabels : drafted.labels,
  })
  const checkedLabels = withSavedTags(checked?.labels ?? [], input.saved, input.title, input.topicKey)
  if (checked?.ok && checkedLabels.length >= 2) {
    const saved = await rememberTutorTopic({
      topicKey: input.topicKey,
      locale: input.locale,
      title: input.title,
      explanation: checked.explanation,
      practice: checked.practice,
      labels: checkedLabels,
      draftModel: AI_TUTOR_DRAFT_MODEL,
      checkModel: AI_TUTOR_CHECK_MODEL,
    })
    if (saved) return saved
    return {
      topicKey: input.topicKey,
      title: input.title,
      explanation: checked.explanation,
      practice: checked.practice,
      labels: checkedLabels,
      share: 'private',
    }
  }
  return {
    topicKey: input.topicKey,
    title: input.title,
    explanation: drafted.explanation,
    practice: drafted.practice,
    labels: draftLabels,
    share: 'private',
  }
}

export async function askTutor(input: {
  userId: string
  locale: WebLocale
  text: string
}): Promise<TutorAnswer | null> {
  const text = input.text.trim().slice(0, 2000)
  if (!text) return null
  const sessionId = await ensureTutorSession(input.userId, input.locale)
  const saved = await listTutorTopicNames(input.locale)
  const named = pickSavedTopicFromQuestion(text, saved)
  if (named) {
    const hit = await serveSaved({
      sessionId,
      userId: input.userId,
      locale: input.locale,
      question: text,
      kind: 'question',
      topicKey: named.topicKey,
    })
    if (hit) return hit
  }

  const catalog = await listTutorTopicCatalog(input.locale)
  let classified = await classifyQuestion({ ...input, text, catalog })
  if (!classified) classified = await classifyQuestion({ ...input, text, catalog })
  if (classified && isBroadTopic(classified.topicKey)) {
    const narrower = await classifyQuestion({ ...input, text, catalog })
    if (narrower && !isBroadTopic(narrower.topicKey)) classified = narrower
  }
  if (!classified) return null

  const resolved = pickSavedTopicFromClassified(classified, saved)
  if (resolved) {
    const hit = await serveSaved({
      sessionId,
      userId: input.userId,
      locale: input.locale,
      question: text,
      kind: 'question',
      topicKey: resolved.topicKey,
    })
    if (hit) return hit
  }

  const fresh = await composeFresh({
    userId: input.userId,
    locale: input.locale,
    question: text,
    topicKey: classified.topicKey,
    title: classified.title,
    saved,
    catalog,
  })
  if (!fresh) return null
  await recordTurn({
    sessionId,
    userId: input.userId,
    question: text,
    kind: 'question',
    answer: fresh,
  })
  return fresh
}

async function readPhotoQuestion(input: {
  userId: string
  locale: WebLocale
  images: Array<{ mimeType: string; base64: string }>
}): Promise<string | null> {
  if (!input.images.length) return null
  let genAI: GoogleGenerativeAI
  try {
    genAI = await createGoogleGenerativeAIForUser(input.userId)
  } catch (error) {
    console.warn('[ai-tutor] missing Gemini key', error instanceof Error ? error.message : error)
    return null
  }
  const model = genAI.getGenerativeModel({
    model: AI_TUTOR_DRAFT_MODEL,
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1500,
      responseMimeType: 'application/json',
    },
  })
  const prompt = `You read a photo a student pasted into a tutor chat. Write in ${languageName(input.locale)}.
Return ONLY JSON: {"question":"..."}
Rules:
- If the photo shows a school problem, transcribe that problem in full as the question. Keep every formula, number, and unit.
- If the photo is a diagram or a page of notes, write the question the student needs explained.
- Do not solve it.
- If the photo has no question, return an empty question.`
  const parts: Array<string | { inlineData: { mimeType: string; data: string } }> = [
    prompt,
    ...input.images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.base64 } })),
  ]
  try {
    const result = (await model.generateContent(parts)) as GeminiTextResult
    void trackFromUsageMetadata(result.response.usageMetadata, AI_TUTOR_DRAFT_MODEL, 'ai-tutor-photo', input.userId).catch(
      () => undefined
    )
    const parsed = parseJsonObject(readGeminiText(result)) as { question?: unknown } | null
    const question = typeof parsed?.question === 'string' ? parsed.question.trim() : ''
    return question || null
  } catch (error) {
    console.warn('[ai-tutor] photo read failed', error instanceof Error ? error.message : error)
    return null
  }
}

/** Ảnh dán vào chat gia sư được đọc thành câu hỏi, rồi đi cùng luồng chữ. */
export async function askTutorAboutPhoto(input: {
  userId: string
  locale: WebLocale
  text: string
  images: Array<{ mimeType: string; base64: string }>
}): Promise<TutorAnswer | 'unreadable' | null> {
  const caption = input.text.trim()
  const seen = await readPhotoQuestion(input)
  const question = [caption, seen ?? ''].map((part) => part.trim()).filter(Boolean).join('\n\n').slice(0, 2000)
  if (!question) return seen == null && input.images.length ? 'unreadable' : null
  return askTutor({ userId: input.userId, locale: input.locale, text: question })
}

/** Đọc hoặc soạn một nhãn trong kho chủ đề. Không ghi vào chat gia sư. Bài tập và gia sư dùng chung hàm này. */
export async function resolveSharedTutorTopic(input: {
  userId: string
  locale: WebLocale
  labelKey: string
  title: string
}): Promise<TutorAnswer | null> {
  const topicKey = tutorTopicKey(input.labelKey)
  const title = input.title.trim().slice(0, 80)
  if (!topicKey || !title) return null
  const saved = await listTutorTopicNames(input.locale)
  const tag = pickSavedTopicByTag({ key: topicKey, title }, saved)
  if (tag) {
    const existing = await fetchTutorTopic(tag.topicKey, input.locale)
    if (existing) {
      await touchTutorTopic(existing.topicKey, input.locale)
      return existing
    }
  }
  const catalog = await listTutorTopicCatalog(input.locale)
  return composeFresh({
    userId: input.userId,
    locale: input.locale,
    question: title,
    topicKey: tag?.topicKey || topicKey,
    title: tag?.title || title,
    saved,
    catalog,
  })
}

export async function openTutorLabel(input: {
  userId: string
  locale: WebLocale
  labelKey: string
  title: string
}): Promise<TutorAnswer | null> {
  const title = input.title.trim().slice(0, 80)
  if (!tutorTopicKey(input.labelKey) || !title) return null
  const sessionId = await ensureTutorSession(input.userId, input.locale)
  const answer = await resolveSharedTutorTopic(input)
  if (!answer) return null
  await recordTurn({
    sessionId,
    userId: input.userId,
    question: title,
    kind: 'label',
    answer,
  })
  return answer
}
