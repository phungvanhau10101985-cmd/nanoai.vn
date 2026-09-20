'use client'

import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  parsePartnerInventoryExcelImportResponse,
  postPartnerInventoryExcelImport,
} from '@/lib/messaging/partner-inventory-excel-import-client'
import { CATEGORY_AUTO_CREATE_DISABLED_MESSAGE } from '@/lib/partner-website/category/partner-category-auto-create-copy'

type AiT = Dictionary['partnerMessagingAi']

export type PartnerInventoryExcelImportProgress = {
  message: string
  percent: number | null
}

export type PartnerInventoryExcelImportDetailPanel = {
  variant: 'err' | 'warn' | 'ok'
  title: string
  body: string
}

type ToastFn = (type: 'ok' | 'err', msg: string) => void

function mapImportError(code: string | undefined, detail: string | undefined, t: AiT): string {
  if (detail?.trim()) return detail.trim()
  if (code?.startsWith('INVALID_SIZE_JSON_ROW_')) {
    const row = code.slice('INVALID_SIZE_JSON_ROW_'.length)
    return `Dòng ${row}: cột Size phải là JSON mảng chuỗi, ví dụ ["38","39","40"].`
  }
  if (code?.startsWith('INVALID_COLOR_VARIANTS_JSON_ROW_')) {
    const row = code.slice('INVALID_COLOR_VARIANTS_JSON_ROW_'.length)
    return `Dòng ${row}: cột Màu sắc phải là JSON mảng object {name,img}, ví dụ [{"name":"Đen","img":"https://..."}].`
  }
  if (code?.startsWith('INVALID_PRICE_STRUCTURE_ROW_')) {
    const row = code.slice('INVALID_PRICE_STRUCTURE_ROW_'.length)
    return `Cấu trúc dữ liệu sai ở dòng ${row}: cột Giá đang chứa trạng thái tồn kho/size. Vui lòng chuyển nội dung này sang cột Ghi chú tồn kho.`
  }
  if (code?.startsWith('TOO_MANY_ROWS_')) {
    const max = code.slice('TOO_MANY_ROWS_'.length) || '100000'
    return t.inventoryErrTooManyRows.replace('{max}', max)
  }
  switch (code) {
    case 'INVALID_XLSX':
      return t.inventoryErrInvalidXlsx
    case 'EMPTY_WORKBOOK':
    case 'EMPTY_SHEET':
      return t.inventoryErrEmptySheet
    case 'MISSING_NAME_COLUMN':
      return t.inventoryErrMissingName
    case 'NO_DATA_ROWS':
      return t.inventoryErrNoRows
    case 'NO_FILE':
      return t.inventoryErrNoFile
    case 'FILE_TOO_LARGE':
      return t.inventoryErrFileTooLarge
    case 'CATEGORY_AUTO_CREATE_DISABLED':
      return CATEGORY_AUTO_CREATE_DISABLED_MESSAGE
    default:
      return code || t.inventoryImportFailed
  }
}

/** Khớp 188 `useAdminProductExcelImport` — chọn file .xlsx 41 cột, overwrite=false (upsert, listed=0 xóa). */
export function usePartnerInventoryExcelImport(opts: { partnerId: string; t: AiT; onToast: ToastFn }) {
  const { partnerId, t, onToast } = opts
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<PartnerInventoryExcelImportProgress | null>(null)
  const [importCancelBusy, setImportCancelBusy] = useState(false)
  const [importDetailPanel, setImportDetailPanel] = useState<PartnerInventoryExcelImportDetailPanel | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handleCancel = useCallback(() => {
    if (importCancelBusy) return
    setImportCancelBusy(true)
    abortRef.current?.abort()
    setImportCancelBusy(false)
  }, [importCancelBusy])

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setImporting(true)
      setImportDetailPanel(null)
      const szMb = file.size / (1024 * 1024)
      setImportProgress({
        message:
          szMb >= 2
            ? t.listingImportExcelUploadingLarge.replace('{mb}', szMb.toFixed(1))
            : t.listingImportExcelUploading,
        percent: null,
      })
      try {
        const fd = new FormData()
        fd.set('file', file)
        const url = `/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/import?overwrite=false`
        const { ok, text } = await postPartnerInventoryExcelImport(
          url,
          fd,
          (p) => {
            if (p.percent == null) {
              setImportProgress({ message: t.listingImportExcelProcessing, percent: null })
              return
            }
            setImportProgress({
              message: t.listingImportExcelUploadPct
                .replace('{pct}', String(p.percent))
                .replace('{loaded}', (file.size * (p.percent / 100) / (1024 * 1024)).toFixed(2))
                .replace('{total}', szMb.toFixed(2)),
              percent: Math.min(99, Math.max(1, p.percent)),
            })
          },
          ac.signal
        )
        if (ac.signal.aborted) return
        setImportProgress({ message: t.listingImportExcelProcessing, percent: null })
        const data = parsePartnerInventoryExcelImportResponse(text)
        if (!ok) {
          const body = mapImportError(data.error, data.detail, t)
          setImportDetailPanel({ variant: 'err', title: t.listingImportExcelFailedTitle, body })
          onToast('err', t.listingImportExcelFailedToast)
          return
        }
        const inserted = data.inserted ?? 0
        const updated = data.updated ?? 0
        const deleted = data.deleted ?? 0
        const warnCount = data.warnings_count ?? (Array.isArray(data.warnings) ? data.warnings.length : 0)
        const headline = t.inventoryImportSuccess
          .replace('{count}', String(data.count ?? 0))
          .replace('{inserted}', String(inserted))
          .replace('{updated}', String(updated))
          .replace('{deleted}', String(deleted))
        const deletedBit = deleted ? t.listingImportExcelSuccessDeleted.replace('{n}', String(deleted)) : ''
        const toastMsg = t.listingImportExcelSuccess
          .replace('{inserted}', String(inserted))
          .replace('{updated}', String(updated))
          .replace('{deleted}', deletedBit)
        if (warnCount > 0) {
          setImportDetailPanel({
            variant: 'warn',
            title: t.listingImportExcelDoneTitle,
            body: `${headline}\n\n${t.listingImportExcelWarnings.replace('{n}', String(warnCount))}`,
          })
        } else {
          setImportDetailPanel(null)
        }
        onToast('ok', toastMsg)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setImportDetailPanel({
            variant: 'warn',
            title: t.listingImportExcelCancelTitle,
            body: t.listingImportExcelCancelBody,
          })
          onToast('err', t.listingImportExcelCancelToast)
          return
        }
        const raw = err instanceof Error ? err.message : t.inventoryImportFailed
        setImportDetailPanel({ variant: 'err', title: t.listingImportExcelFailedTitle, body: raw })
        onToast('err', raw)
      } finally {
        setImporting(false)
        setImportProgress(null)
        abortRef.current = null
      }
    },
    [onToast, partnerId, t]
  )

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const hideTracking = useCallback(() => {
    setImporting(false)
    setImportProgress(null)
  }, [])

  return {
    importing,
    importProgress,
    importCancelBusy,
    importDetailPanel,
    setImportDetailPanel,
    hasActiveJob: importing,
    fileInputRef,
    handleFileChange,
    openPicker,
    handleCancel,
    hideTracking,
  }
}

export type PartnerInventoryExcelImportCtrl = ReturnType<typeof usePartnerInventoryExcelImport>

export function PartnerInventoryExcelImportHiddenInput({ ctrl }: { ctrl: PartnerInventoryExcelImportCtrl }) {
  return (
    <input
      ref={ctrl.fileInputRef}
      type="file"
      accept=".xlsx,.xls"
      className="hidden"
      onChange={(e) => void ctrl.handleFileChange(e)}
      aria-hidden
      tabIndex={-1}
    />
  )
}

export function PartnerInventoryExcelImportButton({
  ctrl,
  t,
  className,
}: {
  ctrl: PartnerInventoryExcelImportCtrl
  t: AiT
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={ctrl.openPicker}
      disabled={ctrl.importing}
      className={
        className ??
        'px-3 py-1.5 rounded-md border border-teal-600 bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-40'
      }
      title={t.listingImportExcelButtonTitle}
      aria-label={t.listingImportExcelButton}
    >
      {ctrl.importing ? t.listingImportExcelButtonBusy : t.listingImportExcelButton}
    </button>
  )
}

export function PartnerInventoryExcelImportStatus({
  ctrl,
  t,
}: {
  ctrl: PartnerInventoryExcelImportCtrl
  t: AiT
}) {
  const { importing, importProgress, importDetailPanel, setImportDetailPanel, importCancelBusy, hasActiveJob } = ctrl

  return (
    <>
      {importing && importProgress ? (
        <div
          className="rounded-md border border-teal-200 bg-teal-50/80 px-3 py-2 space-y-1.5"
          role="status"
          aria-live="polite"
          aria-label={t.listingImportExcelButton}
        >
          <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
            {importProgress.percent != null ? (
              <div
                className="h-full rounded-full bg-teal-600 transition-[width] duration-300 ease-out"
                style={{ width: `${Math.min(100, importProgress.percent)}%` }}
              />
            ) : (
              <div className="h-full w-full bg-teal-500/70 animate-pulse rounded-full" />
            )}
          </div>
          <p className="text-xs text-slate-800 leading-snug">{importProgress.message}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
            <button
              type="button"
              onClick={() => ctrl.handleCancel()}
              disabled={importCancelBusy || !hasActiveJob}
              className="text-[11px] font-medium text-red-700 underline hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
              aria-label={t.listingImportExcelCancel}
            >
              {importCancelBusy ? t.listingImportExcelCancelling : t.listingImportExcelCancel}
            </button>
            <button
              type="button"
              onClick={ctrl.hideTracking}
              className="text-[11px] text-slate-500 underline hover:text-slate-700"
            >
              {t.listingImportExcelHideTrack}
            </button>
          </div>
        </div>
      ) : null}

      {importDetailPanel ? (
        <div
          className={`rounded-md border p-3 text-sm ${
            importDetailPanel.variant === 'err'
              ? 'border-red-300 bg-red-50 text-slate-900'
              : importDetailPanel.variant === 'warn'
                ? 'border-amber-300 bg-amber-50 text-slate-900'
                : 'border-sky-200 bg-sky-50 text-slate-900'
          }`}
          role="region"
          aria-label={importDetailPanel.title}
        >
          <div className="flex justify-between gap-2 items-start mb-2">
            <span className="font-semibold">{importDetailPanel.title}</span>
            <button
              type="button"
              onClick={() => setImportDetailPanel(null)}
              className="text-xs shrink-0 px-2 py-1 rounded border border-slate-400/60 hover:bg-white/80 text-slate-700"
            >
              {t.listingImportExcelClose}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words max-h-[22rem] overflow-y-auto font-mono text-xs leading-relaxed text-slate-800">
            {importDetailPanel.body}
          </pre>
        </div>
      ) : null}
    </>
  )
}
