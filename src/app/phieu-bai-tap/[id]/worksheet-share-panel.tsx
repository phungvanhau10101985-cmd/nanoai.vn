'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, FileDown, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { exportWorksheetToPdf, exportWorksheetToWord } from '@/app/tao-giao-trinh/lib/worksheet-export'

type ShareLabels = {
  title: string
  hint: string
  copy: string
  copied: string
  downloadMd: string
  downloadPdf: string
  downloadWord: string
  openWorksheet: string
}

export function WorksheetSharePanel({
  worksheetId,
  worksheetTopic,
  contentMarkdown,
  labels,
}: {
  worksheetId: string
  worksheetTopic: string
  contentMarkdown: string
  labels: ShareLabels
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const worksheetUrl = useMemo(() => `/phieu-bai-tap/${worksheetId}`, [worksheetId])

  useEffect(() => {
    QRCode.toDataURL(
      typeof window === 'undefined' ? worksheetUrl : `${window.location.origin}${worksheetUrl}`,
      { width: 200, margin: 2 }
    )
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [worksheetUrl])

  const downloadMd = () => {
    const blob = new Blob([contentMarkdown], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${worksheetTopic || 'worksheet'}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(contentMarkdown)
      // keep lightweight UX, avoid adding toast dependency
      window.alert(labels.copied)
    } catch {
      /* ignore */
    }
  }

  const exportPdf = async () => {
    await exportWorksheetToPdf(contentMarkdown, `${worksheetTopic || 'worksheet'}.pdf`, null)
  }

  const exportWord = async () => {
    await exportWorksheetToWord(contentMarkdown, `${worksheetTopic || 'worksheet'}.docx`)
  }

  return (
    <section className="mb-6 rounded-2xl border border-emerald-200/70 bg-emerald-50/55 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/25">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">{labels.title}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copyText}>
            <Copy className="mr-1 h-3.5 w-3.5" /> {labels.copy}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadMd}>
            <FileDown className="mr-1 h-3.5 w-3.5" /> {labels.downloadMd}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileDown className="mr-1 h-3.5 w-3.5" /> {labels.downloadPdf}
          </Button>
          <Button variant="outline" size="sm" onClick={exportWord}>
            <FileDown className="mr-1 h-3.5 w-3.5" /> {labels.downloadWord}
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-4 rounded-lg border border-emerald-200/80 bg-white/70 p-3 dark:border-emerald-700/50 dark:bg-black/10">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Worksheet QR" className="h-[96px] w-[96px] rounded border bg-white p-1" />
        ) : (
          <div className="flex h-[96px] w-[96px] items-center justify-center rounded border bg-white/80">
            <QrCode className="h-8 w-8 text-emerald-600/70" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">{labels.hint}</p>
        </div>
      </div>
    </section>
  )
}
