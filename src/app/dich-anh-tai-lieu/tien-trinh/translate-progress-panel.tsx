'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getBatchProgress, cancelBatchTranslate, resumeBatchTranslate } from '../actions'
import { FileText, CheckCircle2, Loader2, XCircle, Download, Image as ImageIcon } from 'lucide-react'
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
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

interface TranslateProgressPanelProps {
  batchId: string
  embedded?: boolean
  onClose?: () => void
}

export function TranslateProgressPanel({ batchId, embedded = false, onClose }: TranslateProgressPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const tr = useCallback((vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }, [uiLocale])

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

  const fetchProgress = useCallback(async () => {
    try {
      const res = await getBatchProgress(batchId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setData(res)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr('Lỗi tải tiến trình', 'Failed to load progress', '加载进度失败', '進捗の読み込みに失敗しました', '진행 상태 로드 실패')
      setError(msg.includes('fetch') || msg.includes('Failed') ? tr('Không kết nối được tới server.', 'Cannot connect to server.', '无法连接到服务器。', 'サーバーに接続できません。', '서버에 연결할 수 없습니다.') : msg)
    }
  }, [batchId, tr])

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    if (!batchId) return
    try {
      localStorage.setItem(STORAGE_KEY, batchId)
    } catch {
      //
    }
    setCachedUrls(null)
    resumeBatchTranslate(batchId)
    void fetchProgress()
    const interval = setInterval(() => { void fetchProgress() }, POLL_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [batchId, fetchProgress])

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
              {tr('Thử lại', 'Retry', '重试', '再試行', '다시 시도')}
            </Button>
            {!embedded && (
              <Button variant="outline" onClick={() => router.back()}>
                {tr('Quay lại dịch ảnh', 'Back to translator', '返回翻译页', '翻訳ページへ戻る', '번역 페이지로 돌아가기')}
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
        <p className="mt-3 text-muted-foreground text-sm">{tr('Đang tải tiến trình...', 'Loading progress...', '正在加载进度...', '進捗を読み込み中...', '진행 상태 불러오는 중...')}</p>
      </div>
    )
  }

  const { done, total, items } = data
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && items.every((x) => x.status === 'completed' || x.status === 'failed' || x.status === 'cancelled')
  const hasProcessing = items.some((x) => x.status === 'processing')

  return (
    <>
      <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" /> {tr('Tiến trình dịch ảnh', 'Image translation progress', '图片翻译进度', '画像翻訳の進捗', '이미지 번역 진행 상황')}
            </CardTitle>
            <span className="text-lg font-bold text-slate-800">{percent}%</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {done}/{total} {items.some((x) => x.batch_type === 'pdf') ? tr('trang', 'pages', '页', 'ページ', '페이지') : tr('ảnh', 'images', '张', '枚', '장')} {tr('đã xong', 'completed', '已完成', '完了', '완료')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-slate-600 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            {!isComplete && hasProcessing && (
              <Button variant="destructive" size="sm" onClick={() => { setCancelOpen(true); setCancelConfirm(''); setCancelError(null) }}>
                <XCircle className="mr-2 h-4 w-4" /> {tr('Hủy tiến trình', 'Cancel progress', '取消进度', '進行をキャンセル', '진행 취소')}
              </Button>
            )}
            {embedded && onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>{tr('Ẩn tiến trình', 'Hide progress', '隐藏进度', '進捗を隠す', '진행 숨기기')}</Button>
            )}
            {!embedded && (
              <Button variant="outline" size="sm" onClick={() => router.push('/dich-anh-tai-lieu')}>
                {tr('Dịch ảnh mới', 'New translation', '新建翻译', '新しい翻訳', '새 번역')}
              </Button>
            )}
            {isComplete && (
              <Button size="sm" onClick={() => router.push('/dashboard/history/translate')}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {tr('Xem lịch sử', 'View history', '查看历史', '履歴を見る', '기록 보기')}
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
                      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error || tr('Không tạo được file.', 'Cannot create file.', '无法创建文件。', 'ファイルを作成できません。', '파일을 생성할 수 없습니다.'), variant: 'destructive' })
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
                <Download className="mr-2 h-4 w-4" /> {zipLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tải ảnh kết quả', 'Download results', '下载结果图片', '結果画像をダウンロード', '결과 이미지 다운로드')}
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
                      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error || tr('Không tạo được file.', 'Cannot create file.', '无法创建文件。', 'ファイルを作成できません。', '파일을 생성할 수 없습니다.'), variant: 'destructive' })
                      return
                    }
                    if (res.originalZipUrl) {
                      setCachedUrls((p) => ({ ...p, zipUrl: res.zipUrl, originalZipUrl: res.originalZipUrl }))
                      downloadFile(res.originalZipUrl, items.some((x) => x.batch_type === 'pdf') ? 'tai-lieu-goc.zip' : 'anh-goc.zip')
                    } else {
                      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh gốc để tải.', 'No original images to download.', '没有可下载的原图。', 'ダウンロードする元画像がありません。', '다운로드할 원본 이미지가 없습니다.'), variant: 'destructive' })
                    }
                  } finally {
                    setOriginalZipLoading(false)
                  }
                }}
              >
                <ImageIcon className="mr-2 h-4 w-4" aria-hidden /> {originalZipLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tải ảnh gốc', 'Download originals', '下载原图', '元画像をダウンロード', '원본 다운로드')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={cancelOpen} onOpenChange={(open) => { setCancelOpen(open); if (!open) { setCancelConfirm(''); setCancelError(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('Hủy tiến trình dịch', 'Cancel translation progress', '取消翻译进度', '翻訳進行をキャンセル', '번역 진행 취소')}</DialogTitle>
            <DialogDescription>
              {tr('Gõ chính xác', 'Type exactly', '请准确输入', '正確に入力', '정확히 입력')} <strong>{CANCEL_CONFIRM_TEXT}</strong> {tr('để xác nhận.', 'to confirm.', '以确认。', 'して確認。', '하여 확인하세요.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder={`${tr('Gõ', 'Type', '输入', '入力', '입력')} "${CANCEL_CONFIRM_TEXT}" ${tr('để xác nhận', 'to confirm', '以确认', 'して確認', '하여 확인')}`}
              value={cancelConfirm}
              onChange={(e) => setCancelConfirm(e.target.value)}
              className="font-mono uppercase"
              disabled={cancelLoading}
            />
            {cancelError && <p className="text-sm text-red-600">{cancelError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelLoading}>{tr('Đóng', 'Close', '关闭', '閉じる', '닫기')}</Button>
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
              {cancelLoading ? tr('Đang xử lý...', 'Processing...', '处理中...', '処理中...', '처리 중...') : tr('Xác nhận hủy', 'Confirm cancel', '确认取消', 'キャンセル確認', '취소 확인')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </>
  )
}

