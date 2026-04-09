import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import LamBaiClientPage from './lam-bai-client-page'
import { getUserForAction } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getServerDictionary } from '@/lib/i18n/server'
import {
  DEFAULT_WEB_LOCALE,
  LOCALE_COOKIE_NAME,
  normalizeWebLocale,
  type WebLocale,
} from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { buildMetadata } from '@/lib/seo'
import { loadExamSessionForLamBaiMetadata } from '@/lib/exam-session/load-session-for-lam-bai-metadata'

function splitSeoKeywords(raw: string): string[] {
  return raw.split(',').map((k) => k.trim()).filter(Boolean)
}

const LAM_BAI_OG_LOCALE: Record<WebLocale, string> = {
  vi: 'vi_VN',
  en: 'en_US',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  const locale =
    normalizeWebLocale(cookies().get(LOCALE_COOKIE_NAME)?.value) ?? DEFAULT_WEB_LOCALE
  const t = getDictionary(locale)
  const path = `/lam-bai/${encodeURIComponent(code)}`
  const row = await loadExamSessionForLamBaiMetadata(code)
  const ogLocale = LAM_BAI_OG_LOCALE[locale]
  if (!row) {
    return buildMetadata({
      title: t.classes.lamBaiSeoFallbackTitle,
      description: t.classes.lamBaiSeoFallbackDescription,
      path,
      keywords: splitSeoKeywords(t.classes.lamBaiSeoFallbackKeywords),
      noIndex: true,
      locale: ogLocale,
    })
  }
  const suffix = row.practiceHomework
    ? t.classes.lamBaiSeoTitleSuffixHomework
    : t.classes.lamBaiSeoTitleSuffixExam
  const titleBase =
    row.title && row.title !== '—'
      ? row.title
      : row.practiceHomework
        ? t.createExamPage.defaultHomeworkTitle
        : t.createExamPage.defaultExamTitle
  const title = `${titleBase} | ${suffix}`
  const description = row.practiceHomework
    ? t.classes.lamBaiSeoDescriptionHomework
    : t.classes.lamBaiSeoDescriptionExam
  const keywordsRaw = row.practiceHomework
    ? t.classes.lamBaiSeoKeywordsHomework
    : t.classes.lamBaiSeoKeywordsExam
  return buildMetadata({
    title,
    description,
    path,
    keywords: splitSeoKeywords(keywordsRaw),
    noIndex: true,
    locale: ogLocale,
  })
}

export default async function LamBaiPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const auth = await getUserForAction()
  if ('error' in auth) {
    redirect(`/auth/force-login?next=${encodeURIComponent(`/lam-bai/${code}`)}`)
  }
  const { t } = await getServerDictionary()
  return <LamBaiClientPage code={code} t={t.classes} />
}
