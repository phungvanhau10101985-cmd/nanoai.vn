import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { SITE_URL } from '@/lib/seo'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { WebLocale } from '@/lib/i18n/config'
import { BookOpen, QrCode, Sparkles } from 'lucide-react'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import WorksheetViewWithEdit from './worksheet-view-with-edit'
import { PresentWorksheetButton } from './present-worksheet-button'
import { WorksheetSharePanel } from './worksheet-share-panel'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'

const DATE_LOCALE: Record<WebLocale, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const locale = getCurrentWebLocale()
  const ws = getDictionary(locale).worksheetSolutionPage
  const { data } = await supabase
    .from('worksheet_worksheets')
    .select('topic')
    .eq('id', params.id)
    .single()
  const title = data?.topic ? `${ws.metaTitlePrefix}: ${data.topic}` : ws.metaTitleFallback
  return {
    title,
    description: ws.metaDescription,
    openGraph: {
      title,
      url: `${SITE_URL}/phieu-bai-tap/${params.id}`,
    },
  }
}

export default async function PhieuBaiTapPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { locale, t } = await getServerDictionary()
  const ws = t.worksheetSolutionPage
  const lt = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, content_markdown, question_ids, created_at')
    .eq('id', params.id)
    .single()

  if (error || !data) notFound()

  const questionIds = (data.question_ids ?? []) as string[]
  const displayMarkdown =
    questionIds.length > 0
      ? await worksheetDisplayMarkdownFromDb(supabase, data.content_markdown ?? '', questionIds)
      : (data.content_markdown ?? '')

  const updatedAt =
    data.created_at &&
    new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(data.created_at))

  return (
    <div className="app-shell min-h-screen">
      <CreationToolPageShell currentHref={`/phieu-bai-tap/${params.id}`}>
        <div className="relative min-h-[calc(100dvh-6rem)] overflow-x-hidden rounded-xl bg-gradient-to-b from-emerald-50/90 via-background to-background px-1 py-2 dark:from-emerald-950/25 dark:via-background dark:to-background sm:px-2 sm:py-4">
          <div
            className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
            <nav className="mb-6 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <span>{t.app.siteName}</span>
              </Link>
            </nav>

            <header className="mb-8 overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-lg shadow-emerald-950/5 backdrop-blur-md dark:bg-card/70 dark:shadow-black/20">
              <div className="border-b border-emerald-500/15 bg-gradient-to-r from-emerald-600/10 via-transparent to-teal-600/5 px-5 py-5 sm:px-8 sm:py-7 dark:from-emerald-500/10">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                      {ws.eyebrow}
                    </p>
                    <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                      <span className="text-emerald-800 dark:text-emerald-300">{ws.metaTitlePrefix}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>{data.topic}</span>
                    </h1>
                    <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
                      <QrCode className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600/70 dark:text-emerald-500/80" aria-hidden />
                      {ws.qrHint}
                    </p>
                    {updatedAt ? (
                      <p className="text-xs text-muted-foreground/80">
                        {ws.updatedLabel}: {updatedAt}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <PresentWorksheetButton worksheetId={data.id} locale={locale} />
                  </div>
                </div>
              </div>
            </header>

            <WorksheetSharePanel
              worksheetId={data.id}
              worksheetTopic={data.topic ?? 'worksheet'}
              contentMarkdown={displayMarkdown}
              labels={{
                title: lt(
                  'Chia sẻ & tải phiếu bài tập',
                  'Share & download worksheet',
                  '分享与下载练习',
                  'ワークシート共有・ダウンロード',
                  '워크시트 공유/다운로드'
                ),
                hint: ws.qrHint,
                copy: lt('Sao chép', 'Copy', '复制', 'コピー', '복사'),
                copied: lt(
                  'Đã sao chép nội dung phiếu bài tập.',
                  'Worksheet content copied.',
                  '练习内容已复制。',
                  'ワークシート内容をコピーしました。',
                  '워크시트 내용을 복사했습니다.'
                ),
                downloadMd: lt('Tải .md', 'Download .md', '下载 .md', '.md をダウンロード', '.md 다운로드'),
                downloadPdf: lt('Tải PDF', 'Download PDF', '下载 PDF', 'PDF をダウンロード', 'PDF 다운로드'),
                downloadWord: lt('Tải Word', 'Download Word', '下载 Word', 'Word をダウンロード', 'Word 다운로드'),
                openWorksheet: `/phieu-bai-tap/${data.id}`,
              }}
            />

            <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md dark:shadow-black/25">
              <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-5 py-3.5 sm:px-8">
                <BookOpen className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden />
                <h2 className="text-sm font-semibold text-foreground">{ws.cardTitle}</h2>
              </div>
              <div className="px-5 py-6 sm:px-8 sm:py-8">
                <WorksheetViewWithEdit
                  worksheetId={data.id}
                  initialMarkdown={displayMarkdown}
                  questionBadge={ws.questionBadge}
                  locale={locale}
                />
              </div>
            </section>

            <footer className="mt-10 pb-6 text-center text-xs text-muted-foreground">
              {t.app.siteName} · {ws.metaTitlePrefix}
            </footer>
          </div>
        </div>
      </CreationToolPageShell>
    </div>
  )
}
