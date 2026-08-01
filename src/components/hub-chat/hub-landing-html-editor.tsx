'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Code2, Download, Loader2, RefreshCw, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import type { WebLocale } from '@/lib/i18n/config'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import {
  collectLandingPageSections,
  landingPageFilename,
  landingPageTitle,
} from '@/lib/hub-chat/landing-page-sections'
import { buildSemanticLandingPageHtml } from '@/lib/hub-chat/landing-page-html-builder'
import { downloadBlobFile } from '@/lib/packaging/mockup-share-html'

const COPY: Record<
  WebLocale,
  {
    title: string
    intro: string
    generate: string
    save: string
    saved: string
    download: string
    preview: string
    source: string
    generateDone: string
    downloadFailed: string
  }
> = {
  vi: {
    title: 'HTML landing thật',
    intro:
      'Chỉnh trực tiếp mã HTML semantic — preview bên phải cập nhật theo thời gian thực. Bấm «Tạo từ brief» để sinh HTML từ brief + mockup đã duyệt.',
    generate: 'Tạo HTML từ brief',
    save: 'Lưu HTML',
    saved: 'Đã lưu HTML vào phiên làm việc',
    download: 'Tải HTML',
    preview: 'Xem trước',
    source: 'Mã HTML',
    generateDone: 'Đã tạo HTML từ brief',
    downloadFailed: 'Không tải được HTML',
  },
  en: {
    title: 'Real landing HTML',
    intro:
      'Edit semantic HTML directly — live preview on the right. Tap «Generate from brief» to build HTML from your brief and approved mockups.',
    generate: 'Generate HTML from brief',
    save: 'Save HTML',
    saved: 'HTML saved to session',
    download: 'Download HTML',
    preview: 'Preview',
    source: 'HTML source',
    generateDone: 'HTML generated from brief',
    downloadFailed: 'Could not download HTML',
  },
  zh: {
    title: '真实落地页 HTML',
    intro: '直接编辑语义化 HTML — 右侧实时预览。点击「从 brief 生成」根据 brief 与已批准 mockup 生成。',
    generate: '从 brief 生成 HTML',
    save: '保存 HTML',
    saved: 'HTML 已保存到会话',
    download: '下载 HTML',
    preview: '预览',
    source: 'HTML 源码',
    generateDone: '已从 brief 生成 HTML',
    downloadFailed: '无法下载 HTML',
  },
  ja: {
    title: '本物のランディングHTML',
    intro:
      'セマンティックHTMLを直接編集 — 右側でライブプレビュー。「briefから生成」でbriefと承認済みモックアップからHTMLを作成。',
    generate: 'briefからHTML生成',
    save: 'HTMLを保存',
    saved: 'HTMLをセッションに保存しました',
    download: 'HTMLをダウンロード',
    preview: 'プレビュー',
    source: 'HTMLソース',
    generateDone: 'briefからHTMLを生成しました',
    downloadFailed: 'HTMLをダウンロードできません',
  },
  ko: {
    title: '실제 랜딩 HTML',
    intro:
      '시맨틱 HTML을 직접 편집 — 오른쪽에서 실시간 미리보기. «brief에서 생성»으로 brief와 승인된 목업에서 HTML 생성.',
    generate: 'brief에서 HTML 생성',
    save: 'HTML 저장',
    saved: 'HTML이 세션에 저장됨',
    download: 'HTML 다운로드',
    preview: '미리보기',
    source: 'HTML 소스',
    generateDone: 'brief에서 HTML 생성됨',
    downloadFailed: 'HTML을 다운로드할 수 없음',
  },
}

export function HubLandingHtmlEditor({
  locale,
  session,
  busy,
  onSaveHtml,
}: {
  locale: WebLocale
  session: HubStudioSession
  busy?: boolean
  onSaveHtml: (html: string) => void | Promise<void>
}) {
  const t = COPY[locale]
  const { toast } = useToast()
  const [html, setHtml] = useState(session.landingPage?.htmlSource ?? '')
  const [saving, setSaving] = useState(false)
  const title = useMemo(() => landingPageTitle(session), [session])

  useEffect(() => {
    setHtml(session.landingPage?.htmlSource ?? '')
  }, [session.landingPage?.htmlSource, session.currentStepKey])

  const previewKey = useMemo(() => html.length, [html])

  const onGenerate = useCallback(() => {
    const sections = collectLandingPageSections(session, locale)
    const next = buildSemanticLandingPageHtml({ session, locale, sections })
    setHtml(next)
    toast({ title: t.generateDone })
  }, [locale, session, t.generateDone, toast])

  const onSave = async () => {
    if (!html.trim()) return
    setSaving(true)
    try {
      await onSaveHtml(html)
      toast({ title: t.saved })
    } finally {
      setSaving(false)
    }
  }

  const onDownload = () => {
    try {
      const filename = `${landingPageFilename(title)}.html`
      downloadBlobFile(new Blob([html], { type: 'text/html;charset=utf-8' }), filename)
    } catch {
      toast({ title: t.downloadFailed, variant: 'destructive' })
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t.intro}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={onGenerate}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          {t.generate}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy || !html.trim()} onClick={() => void onSave()}>
          {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
          {t.save}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!html.trim()} onClick={onDownload}>
          <Download className="mr-1 h-3.5 w-3.5" />
          {t.download}
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="flex min-h-[320px] flex-col gap-1.5">
          <p className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Code2 className="h-3.5 w-3.5" />
            {t.source}
          </p>
          <Textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            disabled={busy}
            className="min-h-[300px] flex-1 resize-y font-mono text-[11px] leading-relaxed"
          />
        </div>
        <div className="flex min-h-[320px] flex-col gap-1.5">
          <p className="text-xs font-medium text-foreground">{t.preview}</p>
          <div className="flex-1 overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700">
            {html.trim() ? (
              <iframe
                key={previewKey}
                title={t.preview}
                srcDoc={html}
                sandbox="allow-same-origin"
                className="h-[min(52vh,480px)] w-full border-0 bg-white"
              />
            ) : (
              <div className="flex h-[min(52vh,480px)] items-center justify-center text-xs text-muted-foreground">
                —
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
