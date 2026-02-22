'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getBatchProgress, cancelBatchTranslate, resumeBatchTranslate } from '../actions'
import { FileText, CheckCircle2, Loader2, XCircle, Download, Image } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

const CANCEL_CONFIRM_TEXT = 'HỦY'
const POLL_INTERVAL_MS = 4000
const RESUME_INTERVAL_MS = 30000
const STORAGE_KEY = 'lastTranslateBatchId'

interface TranslateProgressPanelProps {
  batchId: string
  embedded?: boolean
  onClose?: () => void
}

export function TranslateProgressPanel({ batchId, embedded = false, onClose }: TranslateProgressPanelProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [data, setData] = useState<{
    done: number
    total: number
    items: Array<{
      id: string
      status: string
      original_image_url?: string
      result_image_url?: string
      error_message?: string | null
      batch_type?: string
    }>
    cancelled?: number
    isCancelled?: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [originalZipLoading, setOriginalZipLoading] = useState(false)
  const [cachedUrls, setCachedUrls] = useState<{ zipUrl?: string; originalZipUrl?: string } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  const downloadFile = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const fetchProgress = async () => {
    try {
      const res = await getBatchProgress(batchId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setData(res)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi tải tiến trình'
      setError(msg.includes('fetch') || msg.includes('Failed') ? 'Không kết nối được tới server.' : msg)
    }
  }

  useEffect(() => {
    if (!batchId) return
    try {
      localStorage.setItem(STORAGE_KEY, batchId)
    } catch {
      //
    }
    setCachedUrls(null)
    resumeBatchTranslate(batchId)
    fetchProgress()
    const interval = setInterval(fetchProgress, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [batchId])

  useEffect(() => {
    if (!batchId) return
    const resumeInterval = setInterval(() => {
      const d = dataRef.current
      if (d?.items?.some((x) => x.status === 'processing')) resumeBatchTranslate(batchId)
    }, RESUME_INTERVAL_MS)
    return () => clearInterval(resumeInterval)
  }, [batchId])

  if (!batchId) return null

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <p className="text-red-700">{error}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => { setError(null); setData(null); fetchProgress() }}>
              Thử lại
            </Button>
            {!embedded && (
              <Button variant="outline" onClick={() => router.push('/dich-anh-tai-lieu')}>
                Quay lại dịch ảnh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[160px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        <p className="mt-3 text-muted-foreground text-sm">Đang tải tiến trình...</p>
      </div>
    )
  }

  const { done, total, items } = data
  const failed = items.filter((x) => x.status === 'failed').length
  const cancelled = items.filter((x) => x.status === 'cancelled').length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && items.every((x) => x.status === 'completed' || x.status === 'failed' || x.status === 'cancelled')
  const hasProcessing = items.some((x) => x.status === 'processing')

  return (
    <>
      <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" /> Tiến trình dịch ảnh
            </CardTitle>
            <span className="text-lg font-bold text-slate-800">{percent}%</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {done}/{total} {items.some((x) => x.batch_type === 'pdf') ? 'trang' : 'ảnh'} đã xong
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-slate-600 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            {!isComplete && hasProcessing && (
              <Button variant="destructive" size="sm" onClick={() => { setCancelOpen(true); setCancelConfirm(''); setCancelError(null) }}>
                <XCircle className="mr-2 h-4 w-4" /> Hủy tiến trình
              </Button>
            )}
            {embedded && onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>Ẩn tiến trình</Button>
            )}
            {!embedded && (
              <Button variant="outline" size="sm" onClick={() => router.push('/dich-anh-tai-lieu')}>
                Dịch ảnh mới
              </Button>
            )}
            {isComplete && (
              <Button size="sm" onClick={() => router.push('/dashboard/history/translate')}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Xem lịch sử
              </Button>
            )}
          </div>

          {isComplete && done > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={zipLoading || originalZipLoading}
                onClick={async () => {
                  if (cachedUrls?.zipUrl) {
                    downloadFile(cachedUrls.zipUrl, items.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
                    return
                  }
                  setZipLoading(true)
                  try {
                    const r = await fetch(`/api/dich-anh-tai-lieu/batch-download?batchId=${encodeURIComponent(batchId)}`)
                    const res = await r.json()
                    if (!r.ok || res.error) {
                      toast({ title: 'Lỗi', description: res.error || 'Không tạo được file.', variant: 'destructive' })
                      return
                    }
                    if (res.zipUrl) {
                      setCachedUrls((p) => ({ ...p, zipUrl: res.zipUrl, originalZipUrl: res.originalZipUrl }))
                      downloadFile(res.zipUrl, items.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
                    }
                  } finally {
                    setZipLoading(false)
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" /> {zipLoading ? 'Đang tạo...' : 'Tải ảnh kết quả'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={zipLoading || originalZipLoading}
                onClick={async () => {
                  if (cachedUrls?.originalZipUrl) {
                    downloadFile(cachedUrls.originalZipUrl, items.some((x) => x.batch_type === 'pdf') ? 'tai-lieu-goc.zip' : 'anh-goc.zip')
                    return
                  }
                  setOriginalZipLoading(true)
                  try {
                    const r = await fetch(`/api/dich-anh-tai-lieu/batch-download?batchId=${encodeURIComponent(batchId)}`)
                    const res = await r.json()
                    if (!r.ok || res.error) {
                      toast({ title: 'Lỗi', description: res.error || 'Không tạo được file.', variant: 'destructive' })
                      return
                    }
                    if (res.originalZipUrl) {
                      setCachedUrls((p) => ({ ...p, zipUrl: res.zipUrl, originalZipUrl: res.originalZipUrl }))
                      downloadFile(res.originalZipUrl, items.some((x) => x.batch_type === 'pdf') ? 'tai-lieu-goc.zip' : 'anh-goc.zip')
                    } else {
                      toast({ title: 'Lỗi', description: 'Không có ảnh gốc để tải.', variant: 'destructive' })
                    }
                  } finally {
                    setOriginalZipLoading(false)
                  }
                }}
              >
                <Image className="mr-2 h-4 w-4" /> {originalZipLoading ? 'Đang tạo...' : 'Tải ảnh gốc'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) { setCancelConfirm(''); setCancelError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy tiến trình dịch</DialogTitle>
            <DialogDescription>
              Gõ chính xác <strong>{CANCEL_CONFIRM_TEXT}</strong> để xác nhận.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder={`Gõ "${CANCEL_CONFIRM_TEXT}" để xác nhận`}
              value={cancelConfirm}
              onChange={(e) => setCancelConfirm(e.target.value)}
              className="font-mono uppercase"
              disabled={cancelLoading}
            />
            {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelLoading}>Đóng</Button>
            <Button
              variant="destructive"
              disabled={cancelLoading || cancelConfirm.trim().toUpperCase() !== CANCEL_CONFIRM_TEXT}
              onClick={async () => {
                setCancelLoading(true)
                setCancelError(null)
                const res = await cancelBatchTranslate(batchId, cancelConfirm)
                setCancelLoading(false)
                if ('error' in res) {
                  setCancelError(res.error)
                  if ('cancelled' in res && res.cancelled) {
                    setCancelOpen(false)
                    setData(null)
                    const fresh = await getBatchProgress(batchId)
                    if (!('error' in fresh)) setData(fresh)
                  }
                  return
                }
                setCancelOpen(false)
                if (res.zipUrl) downloadFile(res.zipUrl, items.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
                setData(null)
                const fresh = await getBatchProgress(batchId)
                if (!('error' in fresh)) setData(fresh)
              }}
            >
              {cancelLoading ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  )
}

