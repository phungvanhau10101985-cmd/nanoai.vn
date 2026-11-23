'use server'

import { normalizeWebLocale } from '@/lib/i18n/config'
import { readStoredTeacherThinking } from '@/lib/homework-help/teacher-thinking-guide'

/** Gợi ý giáo viên: dùng hướng tư duy đã lưu lúc tạo câu. Chỉ tạo mới khi câu chưa có. */
export async function openTeacherHomeworkThinkingGuide(input: {
  locale: string
  examCode: string
  questionId: string
}): Promise<{ ok: true; lines: string[] } | { ok: false; code: 'unauthorized' | 'empty' | 'unavailable' }> {
  const stored = await readStoredTeacherThinking({
    examCode: input.examCode,
    questionId: input.questionId,
  })
  if (!stored.ok) return stored
  if (stored.lines.length > 0) return { ok: true, lines: stored.lines }
  const { openTeacherHomeworkThinking } = await import('@/lib/homework-help/homework-help-consult')
  return openTeacherHomeworkThinking({
    locale: normalizeWebLocale(input.locale) ?? 'vi',
    examCode: input.examCode,
    questionId: input.questionId,
  })
}
