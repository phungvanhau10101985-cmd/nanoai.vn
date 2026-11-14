'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { goToPreviousPage } from '@/components/navigation/browser-back-control'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getBatchProgress, resumeBatchTranslate, pauseBatchTranslate, continueBatchTranslate } from '../actions'
import { pdfPageNumberFromUrl } from '@/lib/dich-anh-tai-lieu/pdf-page-selection'
import { FileText, CheckCircle2, Loader2, Download, Image as ImageIcon, Pause, Play } from 'lucide-react'
import { TranslateImageEditor, type TranslateEditPage } from '@/components/dich-anh-tai-lieu/translate-image-editor'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'

const POLL_INTERVAL_MS = 4000
const RESUME_INTERVAL_MS = 30000
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

interface TranslateProgressPanelProps {
  batchId: string
  startedAt?: string | null
  memberIds?: string[]
  embedded?: boolean
  onClose?: () => void
}

export function TranslateProgressPanel({ batchId, startedAt = null, memberIds, embedded = false, onClose }: TranslateProgressPanelProps) {
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
      batch_type?: string | null
      job_status?: string | null
    }>
    cancelled?: number
    isCancelled?: boolean
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pauseLoading, setPauseLoading] = useState(false)
  const [zipLoading, setZipLoading] = useState(false)
  const [originalZipLoading, setOriginalZipLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [retryLoading, setRetryLoading] = useState(false)
  const [editorIndex, setEditorIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const seenDoneRef = useRef(new Set<string>())
  const memberIdsRef = useRef(memberIds)
  memberIdsRef.current = memberIds
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
    resumeBatchTranslate(batchId)
    void fetchProgress()
    const interval = setInterval(() => {
      const rows = dataRef.current?.items ?? []
      const settled = rows.length > 0 && rows.every((item) => item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled')
      if (!settled) void fetchProgress()
    }, POLL_INTERVAL_MS)
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
      const items = dataRef.current?.items ?? []
      const running = items.some((item) => item.job_status === 'processing')
      const pending = items.some((item) => item.job_status === 'pending')
      if (pending && !running) resumeBatchTranslate(batchId)
    }, RESUME_INTERVAL_MS)
    return () => clearInterval(resumeInterval)
  }, [batchId])

  useEffect(() => {
    const allow = memberIdsRef.current && memberIdsRef.current.length > 0 ? new Set(memberIdsRef.current) : null
    const fresh = (data?.items ?? []).filter((item) => (!allow || allow.has(item.id)) && item.status === 'completed' && item.result_image_url && !seenDoneRef.current.has(item.id))
    if (fresh.length === 0) return
    for (const item of fresh) seenDoneRef.current.add(item.id)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const item of fresh) next.add(item.id)
      return next
    })
  }, [data])

  function toggleSelected(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function downloadPicked(kind: 'pdf' | 'zip' | 'original', ids: string[]) {
    if (ids.length === 0) {
      toast({
        title: tr('Chưa chọn trang', 'No pages selected', '未选择页面', 'ページが未選択です', '페이지를 선택하지 않았습니다'),
        description: tr('Chọn ảnh đã xong rồi hãy tải.', 'Select finished images, then download.', '请选择已完成的图片再下载。', '完了した画像を選んでからダウンロードしてください。', '끝난 이미지를 고른 뒤 받으세요.'),
        variant: 'destructive',
      })
      return
    }
    const params = new URLSearchParams({ batchId, ids: ids.join(',') })
    if (kind === 'pdf') params.set('format', 'pdf')
    if (kind === 'pdf') setPdfLoading(true)
    else if (kind === 'zip') setZipLoading(true)
    else setOriginalZipLoading(true)
    try {
      const r = await fetch(`/api/dich-anh-tai-lieu/batch-download?${params.toString()}`)
      const res = await r.json()
      if (!r.ok || res.error) {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: res.error || tr('Không tạo được file.', 'Cannot create file.', '无法创建文件。', 'ファイルを作成できません。', '파일을 생성할 수 없습니다.'),
          variant: 'destructive',
        })
        return
      }
      const rowsNow = dataRef.current?.items ?? []
      const pdfBatch = rowsNow.some((item) => item.batch_type === 'pdf' || pdfPageNumberFromUrl(item.original_image_url) != null)
      const pdfName = 'dich-tai-lieu.pdf'
      const zipName = pdfBatch ? 'dich-tai-lieu.zip' : 'dich-anh.zip'
      const originalName = pdfBatch ? 'tai-lieu-goc.zip' : 'anh-goc.zip'
      if (kind === 'pdf' && res.pdfUrl) downloadFile(res.pdfUrl, pdfName)
      else if (kind === 'zip' && res.zipUrl) downloadFile(res.zipUrl, zipName)
      else if (kind === 'original' && res.originalZipUrl) downloadFile(res.originalZipUrl, originalName)
      else {
        toast({
          title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'),
          description: tr('Không có ảnh để tải.', 'No images to download.', '没有可下载的图片。', 'ダウンロードする画像がありません。', '다운로드할 이미지가 없습니다.'),
          variant: 'destructive',
        })
      }
    } finally {
      setPdfLoading(false)
      setZipLoading(false)
      setOriginalZipLoading(false)
    }
  }

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
              <Button variant="outline" onClick={() => goToPreviousPage('/dich-anh-tai-lieu/xu-ly')}>
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

  const allowIds = memberIds && memberIds.length > 0 ? new Set(memberIds) : null
  const items = allowIds ? data.items.filter((item) => allowIds.has(item.id)) : data.items
  const done = items.filter((item) => item.status === 'completed').length
  const total = items.length
  const pickedIds = items.filter((item) => selected.has(item.id)).map((item) => item.id)
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = total > 0 && items.every((x) => x.status === 'completed')
  const running = items.some((item) => item.job_status === 'processing')
  const canPause = items.some((item) => item.job_status === 'pending' || item.job_status === 'processing')
  const canContinue = !running && items.some((item) => item.status !== 'completed' && item.job_status !== 'processing')
  const isPdfBatch = items.some((item) => item.batch_type === 'pdf' || pdfPageNumberFromUrl(item.original_image_url) != null)
  const editPages: TranslateEditPage[] = [...items]
    .map((item, index) => ({
      id: item.id,
      src: item.result_image_url || '',
      page: pdfPageNumberFromUrl(item.original_image_url) ?? index + 1,
    }))
    .filter((item) => item.src)
    .sort((a, b) => a.page - b.page)
    .map((item) => ({
      id: item.id,
      src: item.src,
      label: `${isPdfBatch ? tr('Trang', 'Page', '页', 'ページ', '페이지') : tr('Ảnh', 'Image', '图片', '画像', '이미지')} ${item.page}`,
    }))

  return (
    <>
      <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" /> {tr('Đợt dịch', 'Translation run', '翻译批次', '翻訳の回', '번역 회차')}
              {startedAt ? <span className="text-sm font-normal text-muted-foreground">{new Date(startedAt).toLocaleString(uiLocale === 'vi' ? 'vi-VN' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'en-US')}</span> : null}
            </CardTitle>
            <span className="text-lg font-bold text-slate-800">{percent}%</span>
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {total === 0
              ? tr('Đang xếp trang vào hàng chờ...', 'Queuing pages...', '正在把页面排入队列...', 'ページを順番待ちに入れています...', '페이지를 대기열에 넣는 중...')
              : `${done}/${total} ${isPdfBatch ? tr('trang', 'pages', '页', 'ページ', '페이지') : tr('ảnh', 'images', '张', '枚', '장')} ${tr('đã xong', 'completed', '已完成', '完了', '완료')}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {tr(
              'Trang nào xong thì được lưu ngay. Dừng rồi bấm Chạy tiếp sẽ đi từ trang chưa xong, không dịch lại từ đầu.',
              'Each finished page is saved immediately. Stop, then Continue, resumes at the unfinished page.',
              '完成一页就保存一页。停止后再点继续，会从还没完成的页接着跑。',
              '終わったページはその場で保存されます。停止してから続行すると、未完了のページから再開します。',
              '끝난 페이지는 바로 저장됩니다. 멈춘 뒤 계속을 누르면 아직 안 끝난 페이지부터 이어집니다.'
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-slate-600 transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>

          <div className="flex flex-wrap gap-2">
            {canPause && (
              <Button
                variant="outline"
                size="sm"
                disabled={pauseLoading || retryLoading}
                onClick={async () => {
                  setPauseLoading(true)
                  const res = await pauseBatchTranslate(batchId)
                  setPauseLoading(false)
                  if ('error' in res) {
                    toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
                    return
                  }
                  toast({
                    title: tr('Đã dừng', 'Stopped', '已停止', '停止しました', '멈춤'),
                    description: tr(
                      'Trang đang dịch vẫn được lưu khi xong. Bấm Chạy tiếp để đi tiếp.',
                      'The page already running is still saved when it finishes. Continue picks up the rest.',
                      '正在翻译的页完成后仍会保存。点继续接着跑。',
                      '実行中のページは完了時に保存されます。続行で残りを進めます。',
                      '이미 돌아가던 페이지는 끝나면 저장됩니다. 계속을 눌러 나머지를 진행하세요.'
                    ),
                  })
                  void fetchProgress()
                }}
              >
                <Pause className="mr-2 h-4 w-4" /> {pauseLoading ? tr('Đang dừng...', 'Stopping...', '正在停止...', '停止しています...', '멈추는 중...') : tr('Dừng', 'Stop', '停止', '停止', '멈춤')}
              </Button>
            )}
            {canContinue && (
              <Button
                size="sm"
                disabled={pauseLoading || retryLoading}
                onClick={async () => {
                  setRetryLoading(true)
                  const res = await continueBatchTranslate(batchId)
                  setRetryLoading(false)
                  if ('error' in res) {
                    toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
                    return
                  }
                  toast({
                    title: tr('Đang chạy tiếp', 'Continuing', '正在继续', '続行しています', '이어서 실행'),
                    description: `${res.retried} ${tr('trang chưa xong', 'unfinished pages', '个未完成页', '未完了ページ', '미완료 페이지')}`,
                  })
                  setData(null)
                  void fetchProgress()
                }}
              >
                <Play className="mr-2 h-4 w-4" /> {retryLoading ? tr('Đang mở lại...', 'Resuming...', '正在继续...', '再開しています...', '다시 여는 중...') : tr('Chạy tiếp', 'Continue', '继续', '続行', '계속')}
              </Button>
            )}
            {embedded && onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>{tr('Ẩn tiến trình', 'Hide progress', '隐藏进度', '進捗を隠す', '진행 숨기기')}</Button>
            )}
            {!embedded && (
              <Button variant="outline" size="sm" onClick={() => router.push('/dich-anh-tai-lieu/xu-ly')}>
                {tr('Dịch ảnh mới', 'New translation', '新建翻译', '新しい翻訳', '새 번역')}
              </Button>
            )}
            {isComplete && (
              <Button size="sm" onClick={() => router.push('/dashboard/history/translate')}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> {tr('Xem lịch sử', 'View history', '查看历史', '履歴を見る', '기록 보기')}
              </Button>
            )}
          </div>

          {done > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {tr(
                  `Đã chọn ${pickedIds.length} ảnh. Bỏ chọn những trang không muốn đưa vào PDF hoặc ZIP.`,
                  `${pickedIds.length} images selected. Uncheck pages you do not want in the PDF or ZIP.`,
                  `已选 ${pickedIds.length} 张。取消不想放进 PDF 或 ZIP 的页。`,
                  `${pickedIds.length} 枚を選択中。PDF や ZIP に入れないページは外してください。`,
                  `${pickedIds.length}장 선택됨. PDF나 ZIP에 넣지 않을 페이지는 해제하세요.`
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {isPdfBatch && (
                  <Button size="sm" disabled={zipLoading || pdfLoading || originalZipLoading || pickedIds.length === 0} onClick={() => void downloadPicked('pdf', pickedIds)}>
                    <Download className="mr-2 h-4 w-4" /> {pdfLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tạo PDF đã chọn', 'Create selected PDF', '生成所选 PDF', '選択したPDFを作成', '선택한 PDF 만들기')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isPdfBatch ? 'outline' : 'default'}
                  disabled={zipLoading || pdfLoading || originalZipLoading || pickedIds.length === 0}
                  onClick={() => void downloadPicked('zip', pickedIds)}
                >
                  <Download className="mr-2 h-4 w-4" /> {zipLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tải ZIP đã chọn', 'Download selected ZIP', '下载所选 ZIP', '選択したZIP', '선택한 ZIP')}
                </Button>
                <Button size="sm" variant="outline" disabled={zipLoading || pdfLoading || originalZipLoading || pickedIds.length === 0} onClick={() => void downloadPicked('original', pickedIds)}>
                  <ImageIcon className="mr-2 h-4 w-4" aria-hidden /> {originalZipLoading ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...') : tr('Tải ảnh gốc đã chọn', 'Download selected originals', '下载所选原图', '選択した元画像', '선택한 원본')}
                </Button>
              </div>
            </div>
          )}
          {isPdfBatch && (
            <div className="max-h-96 space-y-1 overflow-auto rounded border border-slate-200 p-2">
              {[...items]
                .map((item, index) => ({ item, index, page: pdfPageNumberFromUrl(item.original_image_url) ?? index + 1 }))
                .sort((a, b) => a.page - b.page)
                .map(({ item, page }) => {
                  const state = item.status === 'completed'
                    ? 'done'
                    : item.job_status === 'processing'
                      ? 'running'
                      : item.job_status === 'paused' || item.job_status === 'cancelled' || item.status === 'cancelled'
                        ? 'paused'
                        : item.job_status === 'failed' || item.status === 'failed'
                          ? 'failed'
                          : 'queued'
                  const label = state === 'done'
                    ? tr('Xong', 'Done', '完成', '完了', '완료')
                    : state === 'running'
                      ? tr('Đang dịch', 'Translating', '翻译中', '翻訳中', '번역 중')
                      : state === 'paused'
                        ? tr('Đã dừng', 'Stopped', '已停止', '停止', '멈춤')
                        : state === 'failed'
                          ? tr('Lỗi', 'Failed', '失败', '失敗', '실패')
                          : tr('Chờ', 'Waiting', '等待', '待機', '대기')
                  const preview = item.result_image_url || item.original_image_url
                  return (
                    <div key={item.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0"
                        aria-label={tr(`Chọn trang ${page}`, `Select page ${page}`, `选择第 ${page} 页`, `${page}ページを選ぶ`, `${page}페이지 선택`)}
                        disabled={state !== 'done'}
                        checked={selected.has(item.id)}
                        onChange={(event) => toggleSelected(item.id, event.target.checked)}
                      />
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element -- ảnh CDN của trang đã dịch
                        <img src={preview} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded border bg-slate-50 object-contain" />
                      ) : (
                        <span className="h-14 w-20 shrink-0 rounded border bg-slate-100" />
                      )}
                      <span className="min-w-0 flex-1">
                        {tr('Trang', 'Page', '页', 'ページ', '페이지')} {page}
                        <span className={state === 'failed' ? 'ml-2 text-red-600' : 'ml-2 text-muted-foreground'}>{label}</span>
                      </span>
                      {state === 'done' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const index = editPages.findIndex((pageItem) => pageItem.id === item.id)
                            if (index >= 0) setEditorIndex(index)
                          }}
                        >
                          {tr('Sửa ảnh', 'Edit image', '编辑图片', '画像を編集', '이미지 편집')}
                        </Button>
                      ) : state === 'failed' && item.error_message ? (
                        <span className="max-w-[14rem] truncate text-xs text-red-600">{item.error_message}</span>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          )}
          {!isPdfBatch && editPages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {editPages.map((page, index) => (
                <figure key={page.id} className="min-w-0">
                  <figcaption className="mb-1 flex items-center gap-2 text-xs font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={tr(`Chọn ${page.label}`, `Select ${page.label}`, `选择 ${page.label}`, `${page.label}を選ぶ`, `${page.label} 선택`)}
                      checked={selected.has(page.id)}
                      onChange={(event) => toggleSelected(page.id, event.target.checked)}
                    />
                    {page.label}
                  </figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh CDN của khách */}
                  <img src={page.src} alt="" loading="lazy" className="max-h-64 w-full rounded border bg-slate-50 object-contain" />
                  <Button type="button" size="sm" variant="outline" className="mt-1 w-full" onClick={() => setEditorIndex(index)}>
                    {tr('Sửa ảnh', 'Edit image', '编辑图片', '画像を編集', '이미지 편집')}
                  </Button>
                </figure>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
      {editorIndex != null && editPages[editorIndex] ? (
        <TranslateImageEditor
          pages={editPages}
          startIndex={editorIndex}
          locale={uiLocale}
          onClose={() => setEditorIndex(null)}
        />
      ) : null}
      {embedded ? null : <Toaster />}
    </>
  )
}

