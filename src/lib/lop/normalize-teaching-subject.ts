import {
  fetchTeachingSubjectByIdPg,
  insertTeachingSubjectPg,
  type TeachingSubjectRow,
} from '@/lib/db/classes-pg'
import { fetchSubjectNameExtrasPg } from '@/lib/db/name-edit-votes'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import {
  isListedClassSubjectId,
  listedClassSubjects,
  subjectIdFromFreeLabel,
  teachingSubjectSlug,
} from '@/lib/lop/class-subject'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'

export type ResolvedTeachingSubject = { id: string; label: string }

function foldLabel(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

function listedFromId(id: string): ResolvedTeachingSubject | null {
  const found = listedClassSubjects().find((s) => s.id === id)
  if (!found) return null
  return { id: found.id, label: found.labelVi }
}

function listedFromFreeText(raw: string): ResolvedTeachingSubject | null {
  const id = subjectIdFromFreeLabel(raw)
  if (!isListedClassSubjectId(id)) return null
  return listedFromId(id)
}

function parseNormalizeJson(raw: string): { matchId: string | null; name: string } | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { matchId?: unknown; name?: unknown }
    const matchId = typeof parsed.matchId === 'string' ? parsed.matchId.trim() : ''
    const name = typeof parsed.name === 'string' ? parsed.name.replace(/\s+/g, ' ').trim() : ''
    return { matchId: matchId || null, name }
  } catch {
    return null
  }
}

async function askDeepseek(raw: string, userId: string): Promise<{ matchId: string | null; name: string } | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return null
  const catalog = listedClassSubjects().map((s) => `${s.id}: ${s.labelVi}`).join('\n')
  const prompt = `Giáo viên trường phổ thông Việt Nam gõ tên môn: "${raw}"
Danh sách môn có sẵn:
${catalog}
Nếu cụm chữ là một môn trong danh sách (viết tắt, thiếu dấu, tiếng Anh cũng tính), matchId là mã đó và name là tên tiếng Việt trong danh sách.
Nếu là môn học thật nhưng chưa có trong danh sách, matchId là null và name là tên môn chuẩn tiếng Việt, ngắn, không thêm chữ "môn", không dùng tên "Khác".
Một dòng JSON: {"matchId":null,"name":"..."}
Không giải thích.`
  const model = resolveDeepSeekChatModel()
  const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(
      buildDeepSeekCompletionBody('chat', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0,
      })
    ),
    signal: AbortSignal.timeout(20000),
  })
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  }
  const text = String(json.choices?.[0]?.message?.content ?? '')
  trackOpenAiStyleCompletionUsage({
    userId,
    model,
    feature: 'teaching-subject-normalize-deepseek',
    usage: json.usage,
    fallbackPromptChars: prompt.length,
    fallbackOutputChars: text.length,
  })
  if (!res.ok) return null
  return parseNormalizeJson(text)
}

async function saveCustomSubject(name: string, userId: string): Promise<ResolvedTeachingSubject | null> {
  const label = name.replace(/\s+/g, ' ').trim().slice(0, 80)
  if (label.length < 2) return null
  if (foldLabel(label) === 'khac' || foldLabel(label) === 'other') return null
  let id = teachingSubjectSlug(label)
  for (let i = 0; i < 6; i++) {
    const existing = await fetchTeachingSubjectByIdPg(id)
    if (existing?.label && foldLabel(existing.label) === foldLabel(label)) {
      return { id: existing.id, label: existing.label }
    }
    if (!existing) {
      const inserted = await insertTeachingSubjectPg({ id, label, createdBy: userId })
      if (inserted === 'inserted') return { id, label }
      if (inserted === null) return null
    }
    id = `${teachingSubjectSlug(label).slice(0, 34)}-${i + 2}`
  }
  return null
}

/** Deepseek đưa về một tên dùng chung. Môn có sẵn thì trả mã sẵn. Môn mới thì lưu teaching_subjects. */
export async function normalizeTeachingSubject(
  rawName: string,
  userId: string
): Promise<ResolvedTeachingSubject | 'empty' | 'rejected' | 'failed'> {
  const raw = rawName.replace(/\s+/g, ' ').trim()
  if (raw.length < 2) return 'empty'
  if (foldLabel(raw) === 'khac' || foldLabel(raw) === 'other') return 'rejected'

  let fromAi: { matchId: string | null; name: string } | null = null
  try {
    fromAi = await askDeepseek(raw, userId)
  } catch (e) {
    console.error('[normalize-teaching-subject]', e)
  }

  const matched = listedFromId(fromAi?.matchId ?? '') ?? listedFromFreeText(fromAi?.name || raw)
  if (matched) return matched

  const name = fromAi?.name?.trim() || ''
  if (foldLabel(name) === 'khac' || foldLabel(name) === 'other') return 'rejected'
  if (!process.env.DEEPSEEK_API_KEY?.trim() && !name) {
    const tidy = raw.charAt(0).toLocaleUpperCase('vi-VN') + raw.slice(1)
    const saved = await saveCustomSubject(tidy, userId)
    return saved ?? 'failed'
  }
  if (!name) return 'rejected'
  const saved = await saveCustomSubject(name, userId)
  return saved ?? 'failed'
}

export async function resolveStoredTeachingSubject(subjectId: string): Promise<TeachingSubjectRow | null> {
  if (!subjectId || subjectId === 'khac') return null
  const extras = await fetchSubjectNameExtrasPg()
  const override = extras.overrides.get(subjectId)
  if (override) return { id: subjectId, label: override }
  const listed = listedFromId(subjectId)
  if (listed) return listed
  return fetchTeachingSubjectByIdPg(subjectId)
}
