import {
  DEFAULT_WEB_LOCALE,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'

const DEFAULTS: Record<WebLocale, { exam: string; homework: string }> = {
  vi: { exam: 'Bài thi', homework: 'Bài tập về nhà' },
  en: { exam: 'Exam', homework: 'Homework' },
  zh: { exam: '测验', homework: '家庭作业' },
  ja: { exam: 'テスト', homework: '宿題' },
  ko: { exam: '시험', homework: '숙제' },
}

export function resolveDefaultExamSessionTitle(
  locale: WebLocale | null | undefined,
  practiceHomework: boolean
): string {
  const l = normalizeWebLocale(String(locale)) ?? DEFAULT_WEB_LOCALE
  const row = DEFAULTS[l]
  return practiceHomework ? row.homework : row.exam
}
