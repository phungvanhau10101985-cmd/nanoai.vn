'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getBatchProgress, cancelBatchTranslate, resumeBatchTranslate } from '../../actions'
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

const STORAGE_KEY = 'lastTranslateBatchId'
const CANCEL_CONFIRM_TEXT = 'HỦY'
const POLL_INTERVAL_MS = 4000
/** Gọi lại process-translate mỗi 30s khi còn job đang xử lý – phục hồi sau server restart */
const RESUME_INTERVAL_MS = 30000

export default function TranslateProgressPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const batchId = (params?.batchId as string) || ''
  const [data, setData] = useState<{ done: number; total: number; items: Array<{ id: string; status: string; original_image_url?: string; result_image_url?: string; error_message?: string | null; batch_type?: string }>; cancelled?: number; isCancelled?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [zipLoading, setZipLoading] = useState(false)
  const [originalZipLoading, setOriginalZipLoading] = useState(false)
  const [cachedUrls, setCachedUrls] = useState<{ zipUrl?: string; originalZipUrl?: string } | null>(null)
  const dataRef = useRef(data)

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
  dataRef.current = data

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
      if (msg.includes('fetch') || msg.includes('Failed')) {
        setError('Không kết nối được. Server có thể đang tắt hoặc khởi động lại. Vui lòng khởi động server và thử lại.')
      } else {
        setError(msg)
      }
    }
  }

  useEffect(() => {
    if (!batchId) return
    setCachedUrls(null)
    try {
      localStorage.setItem(STORAGE_KEY, batchId)
    } catch {
      //
    }
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

  if (!batchId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-red-700">Thiếu ID tiến trình.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dich-anh-tai-lieu')}>
          Quay lại dịch ảnh
        </Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => { setError(null); setData(null); fetchProgress(); }}>
                Thử lại
              </Button>
              <Button variant="outline" onClick={() => router.push('/dich-anh-tai-lieu')}>
                Quay lại dịch ảnh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[200px]">
        <Loader2 className="h-10 w-10 animate-spin text-slate-500" />
        <p className="mt-4 text-muted-foreground">Đang tải tiến trình...</p>
      </div>
    )
  }

  const { done, total, items, isCancelled } = data
  const failed = items.filter((x) => x.status === 'failed').length
  const cancelled = items.filter((x) => x.status === 'cancelled').length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && items.every((x) => x.status === 'completed' || x.status === 'failed' || x.status === 'cancelled')
  const hasProcessing = items.some((x) => x.status === 'processing')

  return (
    <>
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-slate-600" /> Tiến trình dịch ảnh
        </h1>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => router.push('/dich-anh-tai-lieu')}>
            Dịch ảnh mới
          </Button>
          {isComplete && (
            <Button size="sm" onClick={() => router.push('/dashboard/history/translate')}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Xem lịch sử
            </Button>
          )}
        </div>
      </div>

      <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {done}/{total} {data?.items?.some((x) => x.batch_type === 'pdf') ? 'trang' : 'ảnh'} đã xong
            </span>
            <span className="text-lg font-bold text-slate-800">{percent}%</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-600 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          {!isComplete && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-1 min-w-0">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Đang xử lý nền. Bạn có thể rời trang và quay lại xem tiến trình bất cứ lúc nào (lưu link trang này).</span>
              </p>
              {hasProcessing && (
                <Button variant="destructive" size="sm" className="shrink-0" onClick={() => { setCancelOpen(true); setCancelConfirm(''); setCancelError(null); }}>
                  <XCircle className="mr-2 h-4 w-4" /> Hủy tiến trình
                </Button>
              )}
            </div>
          )}
          {isComplete && (
            <>
              <p className="text-sm text-emerald-600 font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {cancelled > 0
                  ? `Đã hủy. ${done} ${data?.items?.some((x) => x.batch_type === 'pdf') ? 'trang' : 'ảnh'} đã xử lý xong, ${cancelled} đã hủy${failed > 0 ? `, ${failed} lỗi` : ''}.`
                  : failed > 0
                    ? `Hoàn tất: ${done} thành công, ${failed} lỗi.`
                    : 'Hoàn tất!'} Xem kết quả tại Lịch sử dịch ảnh.
              </p>
              {done > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    className="sm:w-auto"
                    disabled={zipLoading || originalZipLoading}
                    onClick={async () => {
                      if (cachedUrls?.zipUrl) {
                        downloadFile(cachedUrls.zipUrl, data?.items?.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
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
                          downloadFile(res.zipUrl, data?.items?.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
                        }
                      } finally {
                        setZipLoading(false)
                      }
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {zipLoading ? 'Đang tạo...' : 'Tải ảnh kết quả'}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="sm:w-auto"
                    disabled={zipLoading || originalZipLoading}
                    onClick={async () => {
                      if (cachedUrls?.originalZipUrl) {
                        downloadFile(cachedUrls.originalZipUrl, data?.items?.some((x) => x.batch_type === 'pdf') ? 'tai-lieu-goc.zip' : 'anh-goc.zip')
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
                          downloadFile(res.originalZipUrl, data?.items?.some((x) => x.batch_type === 'pdf') ? 'tai-lieu-goc.zip' : 'anh-goc.zip')
                        } else {
                          toast({ title: 'Lỗi', description: 'Không có ảnh gốc để tải.', variant: 'destructive' })
                        }
                      } finally {
                        setOriginalZipLoading(false)
                      }
                    }}
                  >
                    <Image className="mr-2 h-4 w-4" />
                    {originalZipLoading ? 'Đang tạo...' : 'Tải ảnh gốc'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="rounded-lg border overflow-hidden bg-slate-50"
              >
                <div className="relative aspect-square">
                  {(item.status === 'completed' && item.result_image_url ? item.result_image_url : item.original_image_url) ? (
                    <img
                      src={item.status === 'completed' && item.result_image_url ? item.result_image_url : item.original_image_url || ''}
                      alt={`Ảnh ${i + 1}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs">Ảnh {i + 1}</div>
                  )}
                  <span
                    className={`absolute top-1 right-1 text-xs px-2 py-0.5 rounded ${
                      item.status === 'completed' ? 'bg-emerald-500/90 text-white' : item.status === 'failed' ? 'bg-red-500/90 text-white' : item.status === 'cancelled' ? 'bg-slate-500/90 text-white' : 'bg-amber-500/90 text-white'
                    }`}
                  >
                    {item.status === 'completed' ? 'Xong' : item.status === 'failed' ? 'Lỗi' : item.status === 'cancelled' ? 'Đã hủy' : 'Đang xử lý'}
                  </span>
                  <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                    {i + 1}
                  </span>
                </div>
                {item.status === 'failed' && item.error_message && (
                  <div className="p-2 bg-red-50 border-t border-red-100">
                    <p className="text-xs font-medium text-red-700">Lỗi:</p>
                    <p className="text-xs text-red-600 break-words">{item.error_message}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {failed > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-800">Chi tiết lỗi ({failed} ảnh)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items
                  .filter((x) => x.status === 'failed')
                  .map((item, i) => (
                    <div key={item.id} className="text-sm">
                      <span className="font-medium text-red-700">Ảnh {items.indexOf(item) + 1}:</span>{' '}
                      <span className="text-red-600">{item.error_message || 'Không rõ nguyên nhân'}</span>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) { setCancelConfirm(''); setCancelError(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hủy tiến trình dịch</DialogTitle>
            <DialogDescription>
              Gõ chính xác <strong>{CANCEL_CONFIRM_TEXT}</strong> (viết hoa) để xác nhận. Sau khi hủy, bạn sẽ nhận file nén chứa các ảnh đã xử lý xong (nếu có).
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
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelLoading}>
              Đóng
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (cancelConfirm.trim().toUpperCase() !== CANCEL_CONFIRM_TEXT) {
                  setCancelError(`Gõ chính xác "${CANCEL_CONFIRM_TEXT}" để xác nhận.`)
                  return
                }
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
                if (res.zipUrl) downloadFile(res.zipUrl, data?.items?.some((x) => x.batch_type === 'pdf') ? 'dich-tai-lieu.zip' : 'dich-anh.zip')
                setData(null)
                const fresh = await getBatchProgress(batchId)
                if (!('error' in fresh)) setData(fresh)
              }}
              disabled={cancelLoading || cancelConfirm.trim().toUpperCase() !== CANCEL_CONFIRM_TEXT}
            >
              {cancelLoading ? 'Đang xử lý...' : 'Xác nhận hủy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    <Toaster />
    </>
  )
}
