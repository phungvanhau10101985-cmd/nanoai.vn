'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translateDocumentImage, startTranslateBatch, startTranslatePdfBatch, getPdfPageInfo, getCredits } from './actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { preloadImageUrl } from '@/lib/preload-image-url'

const LANG_VI = { vi: 'Tiếng Việt' }
const LANG_OTHERS: Record<string, string> = {
  en: 'English',
  ja: 'Japanese (Tiếng Nhật)',
  ko: 'Korean (Tiếng Hàn)',
  zh: 'Chinese (Tiếng Trung)',
  'zh-tw': 'Chinese Traditional (Tiếng Trung phồn thể)',
  th: 'Thai (Tiếng Thái)',
  id: 'Indonesian (Tiếng Indonesia)',
  ms: 'Malay (Tiếng Mã Lai)',
  fr: 'French (Tiếng Pháp)',
  de: 'German (Tiếng Đức)',
  es: 'Spanish (Tiếng Tây Ban Nha)',
  it: 'Italian (Tiếng Ý)',
  pt: 'Portuguese (Tiếng Bồ Đào Nha)',
  ru: 'Russian (Tiếng Nga)',
  ar: 'Arabic (Tiếng Ả Rập)',
  hi: 'Hindi (Tiếng Hindi)',
}

const SOURCE_LANG_VI = { vi: 'Tiếng Việt' }
const SOURCE_LANG_OTHERS: Record<string, string> = {
  en: 'English',
  ja: 'Japanese (Tiếng Nhật)',
  ko: 'Korean (Tiếng Hàn)',
  zh: 'Chinese (Tiếng Trung)',
  'zh-tw': 'Chinese Traditional (Tiếng Trung phồn thể)',
  th: 'Thai (Tiếng Thái)',
  id: 'Indonesian (Tiếng Indonesia)',
  ms: 'Malay (Tiếng Mã Lai)',
  fr: 'French (Tiếng Pháp)',
  de: 'German (Tiếng Đức)',
  es: 'Spanish (Tiếng Tây Ban Nha)',
  it: 'Italian (Tiếng Ý)',
  pt: 'Portuguese (Tiếng Bồ Đào Nha)',
  ru: 'Russian (Tiếng Nga)',
  ar: 'Arabic (Tiếng Ả Rập)',
  hi: 'Hindi (Tiếng Hindi)',
}

import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Input } from '@/components/ui/input'
import { Upload, Sparkles, RefreshCw, Link2, FileText, Plus, X, FolderOpen, FileSpreadsheet, FileArchive, FileDown } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { DownloadImageButton } from '@/components/download-image-button'
import { TranslateProgressPanel } from './tien-trinh/translate-progress-panel'
const MAX_BATCH = 50
const TRANSLATE_PROGRESS_STORAGE_KEY = 'lastTranslateBatchId'
const safeZipName = (name: string, index: number): string => {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '.png'
  const stem = base.replace(/\.[^.]+$/, '') || `image_${index + 1}`
  return `${stem}_dich${ext}`
}
const TRANSLATE_COSTS = { '2K': 3, '4K': 6 } as const
type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'

type BatchModeType = 'single' | 'batch' | 'excel' | 'pdf'

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function DichAnhTaiLieuClientPage() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<Step>('UPLOAD')
  const [batchMode, setBatchMode] = useState<BatchModeType>('single')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [batchImages, setBatchImages] = useState<Array<{ file: File; preview: string }>>([])
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [excelUrls, setExcelUrls] = useState<string[]>([])
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null)
  const [pdfPreviews, setPdfPreviews] = useState<string[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [resultPdfUrl, setResultPdfUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [sourceLang, setSourceLang] = useState('')
  const [targetLang, setTargetLang] = useState('vi')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<Array<{ originalUrl: string; resultUrl: string }>>([])
  const [batchZipUrl, setBatchZipUrl] = useState<string | null>(null)
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null)
  const [userCredits, setUserCredits] = useState<number>(0)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()

  const fetchCredits = async () => {
    const bal = await getCredits()
    setUserCredits(bal)
  }
  useEffect(() => {
    fetchCredits()
    const onUpdated = () => fetchCredits()
    window.addEventListener('credits-updated', onUpdated)
    return () => window.removeEventListener('credits-updated', onUpdated)
  }, [])
  useEffect(() => {
    const batchIdFromQuery = searchParams.get('batchId')
    if (batchIdFromQuery) {
      setActiveBatchId(batchIdFromQuery)
      try {
        localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, batchIdFromQuery)
      } catch {
        //
      }
      return
    }
    try {
      const lastBatchId = localStorage.getItem(TRANSLATE_PROGRESS_STORAGE_KEY)
      if (lastBatchId) setActiveBatchId(lastBatchId)
    } catch {
      //
    }
  }, [searchParams])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const batchInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = folderInputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [batchMode])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImageFromFile(file, setImage)
  }

  const addBatchImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: Array<{ file: File; preview: string }> = []
    for (let i = 0; i < files.length && batchImages.length + newImages.length < MAX_BATCH; i++) {
      const f = files[i]
      if (f.type.startsWith('image/')) newImages.push({ file: f, preview: URL.createObjectURL(f) })
    }
    if (newImages.length) {
      setBatchImages((prev) => [...prev, ...newImages].slice(0, MAX_BATCH))
      toast({ title: 'Đã thêm ảnh', description: `Thêm ${newImages.length} ảnh.`, duration: 2000 })
    }
    e.target.value = ''
  }

  const removeBatchImage = (idx: number) => {
    setBatchImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handlePdfSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn file PDF.', variant: 'destructive' })
      return
    }
    setPdfFile(file)
    setPdfPageCount(null)
    setPdfPreviews([])
    setPdfLoading(true)
    e.target.value = ''
    try {
      const fd = new FormData()
      fd.append('pdfFile', file)
      const res = await getPdfPageInfo(fd)
      if (res.error) {
        toast({ title: 'Lỗi', description: res.error, variant: 'destructive' })
        setPdfFile(null)
      } else {
        setPdfPageCount(res.pageCount)
        setPdfPreviews(res.previews)
        toast({ title: 'Đã phân tích PDF', description: `${res.pageCount} trang • Giá sơ bộ: ${(res.pageCount * TRANSLATE_COSTS[imageQuality]).toLocaleString('vi-VN')} credits`, duration: 3000 })
      }
    } catch {
      toast({ title: 'Lỗi', description: 'Không đọc được file PDF.', variant: 'destructive' })
      setPdfFile(null)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleExcelSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) return
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        if (!ws) return
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })
        const urls: string[] = []
        for (let r = 1; r < rows.length; r++) {
          const cell = rows[r]?.[0]
          const s = (typeof cell === 'string' ? cell : String(cell ?? '')).trim()
          if (s && /^https?:\/\//i.test(s)) urls.push(s)
        }
        setExcelUrlCount(urls.length)
        setExcelUrls(urls.slice(0, MAX_BATCH))
        setExcelFile(file)
        toast({ title: 'Đã chọn file Excel', description: `${urls.length} link ảnh.`, duration: 2000 })
      } catch {
        toast({ title: 'Lỗi', description: 'Không đọc được file Excel.', variant: 'destructive' })
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const addFolderImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    imageFiles.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name))
    const newImages = imageFiles.slice(0, MAX_BATCH).map((f) => ({ file: f, preview: URL.createObjectURL(f) }))
    if (newImages.length) {
      setBatchImages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.preview))
        return newImages
      })
      toast({ title: 'Đã chọn thư mục', description: `${newImages.length} ảnh (tối đa ${MAX_BATCH}).`, duration: 2000 })
    } else {
      toast({ title: 'Không có ảnh', description: 'Thư mục không chứa ảnh hợp lệ.', variant: 'destructive' })
    }
    e.target.value = ''
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: 'Lỗi', description: 'Vui lòng dán link ảnh.', variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Lỗi', description: 'Link không hợp lệ.', variant: 'destructive' })
      return
    }
    if (batchMode === 'batch' && batchImages.length >= MAX_BATCH) {
      toast({ title: 'Lỗi', description: `Đã đủ tối đa ${MAX_BATCH} ảnh.`, variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      // Dùng proxy API để vượt chặn 1688/alibaba (CORS)
      const proxyUrl = `/api/fetch-image?url=${encodeURIComponent(url)}`
      const res = await fetch(proxyUrl)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Không phải ảnh')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      if (batchMode === 'batch') {
        setBatchImages((prev) => [...prev, { file, preview: URL.createObjectURL(file) }].slice(0, MAX_BATCH))
      } else {
        setImageFromFile(file, setImage)
      }
      setImageUrl('')
      toast({ title: 'Đã tải ảnh', duration: 2000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi không xác định'
      toast({ title: 'Không tải được ảnh', description: msg, variant: 'destructive', duration: 5000 })
    } finally {
      setUrlLoading(false)
    }
  }

  useEffect(() => {
    const fn = (e: globalThis.ClipboardEvent) => {
      if (step !== 'UPLOAD') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            if ((batchMode === 'batch' || batchMode === 'excel') && batchImages.length < MAX_BATCH) {
              setBatchImages((prev) => [...prev, { file, preview: URL.createObjectURL(file) }].slice(0, MAX_BATCH))
              toast({ title: 'Đã dán ảnh', duration: 2000 })
            } else if (batchMode === 'single' && setImageFromFile(file, setImage)) {
              toast({ title: 'Đã dán ảnh', duration: 2000 })
            }
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast, batchMode, batchImages.length])
  const [excelUrlCount, setExcelUrlCount] = useState(0)
  const isBatchOrExcel = batchMode === 'batch' || batchMode === 'excel'
  const imageCount = batchMode === 'excel' ? excelUrlCount : batchImages.length
  const estimatedCost =
    batchMode === 'pdf' && pdfPageCount
      ? pdfPageCount * TRANSLATE_COSTS[imageQuality]
      : isBatchOrExcel && imageCount > 0
        ? imageCount * TRANSLATE_COSTS[imageQuality]
        : batchMode === 'single' && image.file
          ? TRANSLATE_COSTS[imageQuality]
          : 0
  const insufficientCredits = estimatedCost > 0 && userCredits < estimatedCost

  const handleSubmit = async () => {
    if (!sourceLang.trim()) {
      toast({
        title: 'Chưa chọn ngôn ngữ nguồn',
        description: 'Bắt buộc chọn Ngôn ngữ nguồn (tài liệu đang viết bằng) trước khi dịch.',
        variant: 'destructive',
        duration: 5000,
      })
      return
    }
    if (!targetLang.trim()) {
      toast({
        title: 'Chưa chọn ngôn ngữ đích',
        description: 'Bắt buộc chọn Ngôn ngữ đích (dịch sang) trước khi dịch.',
        variant: 'destructive',
        duration: 5000,
      })
      return
    }
    if (batchMode === 'pdf') {
      if (!pdfFile) {
        toast({ title: 'Lỗi', description: 'Vui lòng tải lên file PDF.', variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      const fd = new FormData()
      fd.append('pdfFile', pdfFile)
      fd.append('sourceLang', sourceLang)
      fd.append('targetLang', targetLang)
      fd.append('imageQuality', imageQuality)
      const r = await startTranslatePdfBatch(fd)
      if (r.error) {
        setStep('UPLOAD')
        toast({ title: 'Khởi tạo thất bại', description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: 'Đã bắt đầu dịch PDF', description: 'Tiến trình đã hiển thị ngay trong trang này.', duration: 4000 })
      return
    } else if (batchMode === 'excel') {
      if (!excelFile || excelUrls.length === 0) {
        toast({ title: 'Lỗi', description: 'Vui lòng tải lên file Excel có link ảnh ở cột A.', variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      setProgress({ done: 0, total: excelUrls.length })
      const fd = new FormData()
      fd.append('excelFile', excelFile)
      fd.append('sourceLang', sourceLang)
      fd.append('targetLang', targetLang)
      fd.append('imageQuality', imageQuality)
      fd.append('mode', 'excel')
      const r = await startTranslateBatch(fd)
      if (r.error) {
        setStep('UPLOAD')
        toast({ title: 'Khởi tạo thất bại', description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: 'Đã bắt đầu dịch', description: 'Tiến trình đã hiển thị ngay trong trang này.', duration: 4000 })
      return
    } else if (batchMode === 'batch') {
      if (batchImages.length === 0) {
        toast({ title: 'Lỗi', description: 'Vui lòng tải lên ít nhất 1 ảnh hoặc chọn thư mục.', variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      setProgress({ done: 0, total: batchImages.length })
      const fd = new FormData()
      batchImages.forEach((img, i) => fd.append(`image_${i}`, img.file))
      fd.append('sourceLang', sourceLang)
      fd.append('targetLang', targetLang)
      fd.append('imageQuality', imageQuality)
      fd.append('mode', 'batch')
      const r = await startTranslateBatch(fd)
      if (r.error) {
        setStep('UPLOAD')
        toast({ title: 'Khởi tạo thất bại', description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: 'Đã bắt đầu dịch', description: 'Tiến trình đã hiển thị ngay trong trang này.', duration: 4000 })
      return
    } else {
      if (!image.file) {
        toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh tài liệu.', variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      const formData = new FormData()
      formData.append('image', image.file)
      formData.append('sourceLang', sourceLang)
      formData.append('targetLang', targetLang)
      formData.append('imageQuality', imageQuality)
      const result = await translateDocumentImage(formData)
      if (result.error) {
        setStep('UPLOAD')
        toast({ title: 'Dịch thất bại', description: result.error, variant: 'destructive', duration: 5000 })
      } else if (result.success && result.resultUrl) {
        await preloadImageUrl(result.resultUrl)
        setResultUrl(result.resultUrl)
        setStep('RESULT')
        toast({ title: 'Thành công!', description: 'Đã dịch tài liệu thành ảnh.', duration: 3000 })
      }
    }
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setBatchImages([])
    setExcelFile(null)
    setExcelUrls([])
    setExcelUrlCount(0)
    setPdfFile(null)
    setPdfPageCount(null)
    setPdfPreviews([])
    setProgress({ done: 0, total: 0 })
    setResultUrl(null)
    setResultPdfUrl(null)
    setBatchResults([])
    setBatchZipUrl(null)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {activeBatchId && (
          <TranslateProgressPanel
            batchId={activeBatchId}
            embedded
            onClose={() => {
              setActiveBatchId(null)
              try {
                localStorage.removeItem(TRANSLATE_PROGRESS_STORAGE_KEY)
              } catch {
                //
              }
            }}
          />
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2">
            <FileText className="h-7 w-7 text-slate-600" /> Dịch ảnh tài liệu kỹ thuật
          </h1>
          <p className="text-muted-foreground mt-1">Dịch ảnh tài liệu thành ảnh mới (bản vẽ, sơ đồ, spec). 3–6 credits/ảnh. Hỗ trợ dịch nhiều ảnh.</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-slate-600" /> Tải ảnh tài liệu
                  </CardTitle>
                  <CardDescription className="text-xs">Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link. Hỗ trợ bản vẽ, sơ đồ, spec, sổ tay.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {batchMode === 'pdf' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">Tải file PDF lên. Mỗi trang sẽ được chuyển thành ảnh, dịch bằng AI, rồi ghép lại thành PDF mới.</p>
                      <label className="block">
                        <span className="sr-only">Chọn file PDF</span>
                        <input
                          type="file"
                          accept="application/pdf"
                          disabled={pdfLoading}
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-600 file:text-white hover:file:bg-slate-700 file:cursor-pointer disabled:opacity-50"
                          onChange={handlePdfSelect}
                        />
                      </label>
                      {pdfLoading && (
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-2">
                          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                          Đang phân tích PDF, tách từng trang...
                        </p>
                      )}
                      {pdfFile && pdfPageCount !== null && !pdfLoading && (
                        <>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {pdfFile.name} – {pdfPageCount} trang
                          </h4>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                            {pdfPreviews.map((src, i) => (
                              <div key={i} className="relative aspect-[3/4] rounded-lg border overflow-hidden bg-slate-100">
                                <ImagePreview src={src} alt={`Trang ${i + 1}`} className="w-full h-full object-contain" />
                                <span className="absolute bottom-0.5 left-0.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                                  {i + 1}
                                </span>
                              </div>
                            ))}
                            {pdfPageCount > pdfPreviews.length && (
                              <div className="aspect-[3/4] rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-xs text-muted-foreground">
                                +{pdfPageCount - pdfPreviews.length}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-emerald-600 font-medium">
                            Giá sơ bộ: {(pdfPageCount * TRANSLATE_COSTS[imageQuality]).toLocaleString('vi-VN')} credits ({pdfPageCount} × {imageQuality === '2K' ? '3' : '6'}/trang)
                          </p>
                          <p className="text-xs text-amber-600 font-medium">
                            → Chọn Ngôn ngữ nguồn và Ngôn ngữ đích bên cạnh, rồi bấm Dịch.
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              Thiếu credits. Cần {estimatedCost.toLocaleString('vi-VN')}, hiện có {userCredits.toLocaleString('vi-VN')}. Nạp đủ mới bấm Dịch được.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : batchMode === 'excel' ? (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" asChild className="border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200">
                          <a href="/api/dich-tai-lieu-mau" download="dich-tai-lieu-mau.xlsx">
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> Tải bảng mẫu
                          </a>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Dán link ảnh vào cột A, lưu file rồi tải lên.</p>
                      <label className="block">
                        <span className="sr-only">Chọn file Excel</span>
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-slate-600 file:text-white hover:file:bg-slate-700 file:cursor-pointer"
                          onChange={handleExcelSelect}
                        />
                      </label>
                      {excelUrls.length > 0 && (
                        <>
                          <p className="text-xs text-emerald-600 font-medium">
                            {excelFile?.name || 'File Excel'} – {excelUrls.length} link • Giá sơ bộ: {estimatedCost.toLocaleString('vi-VN')} credits
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              Thiếu credits. Cần {estimatedCost.toLocaleString('vi-VN')}, hiện có {userCredits.toLocaleString('vi-VN')}. Nạp đủ mới bấm Dịch được.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : batchMode === 'batch' ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ảnh cần dịch ({batchImages.length}/{MAX_BATCH})</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {batchImages.map((img, i) => (
                          <div key={i} className="relative group aspect-square rounded-lg border overflow-hidden bg-slate-50">
                            <ImagePreview src={img.preview} alt={`Ảnh ${i + 1}`} className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={() => removeBatchImage(i)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500/90 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded">{i + 1}</span>
                          </div>
                        ))}
                        {batchImages.length < MAX_BATCH && (
                          <>
                            <label
                              htmlFor="dich-tai-lieu-batch-input"
                              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 hover:bg-slate-200 transition-colors"
                            >
                              <Plus className="h-10 w-10 text-slate-600" />
                              <p className="text-xs font-medium text-slate-700">Thêm ảnh</p>
                            </label>
                            <label
                              htmlFor="dich-tai-lieu-folder-input"
                              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 hover:bg-slate-200 transition-colors"
                            >
                              <FolderOpen className="h-10 w-10 text-slate-600" />
                              <p className="text-xs font-medium text-slate-700">Chọn thư mục</p>
                            </label>
                          </>
                        )}
                      </div>
                      <input id="dich-tai-lieu-batch-input" ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addBatchImages} />
                      <input id="dich-tai-lieu-folder-input" ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFolderImages} />
                      {batchImages.length > 0 && (
                        <>
                          <p className="text-xs text-emerald-600 font-medium">
                            Giá sơ bộ: {estimatedCost.toLocaleString('vi-VN')} credits ({batchImages.length} ảnh × {TRANSLATE_COSTS[imageQuality]})
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              Thiếu credits. Cần {estimatedCost.toLocaleString('vi-VN')}, hiện có {userCredits.toLocaleString('vi-VN')}. Nạp đủ mới bấm Dịch được.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg">
                      <label
                        htmlFor="dich-tai-lieu-input"
                        className="block w-full aspect-[4/3] max-h-[380px] rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 hover:bg-slate-200 transition-colors"
                      >
                        {image.preview ? (
                          <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <>
                            <Upload className="h-12 w-12 text-slate-500" />
                            <p className="text-sm text-muted-foreground font-medium">Chọn ảnh hoặc dán ảnh (Ctrl+V)</p>
                          </>
                        )}
                      </label>
                      {batchMode === 'single' && image.preview && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
                          <RefreshCw className="h-3.5 w-3.5" /> Chọn lại
                        </button>
                      )}
                    </div>
                  )}
                  <input id="dich-tai-lieu-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {batchMode !== 'excel' && batchMode !== 'pdf' && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Dán link ảnh rồi bấm Lấy ảnh"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 bg-slate-100 border-slate-300"
                      />
                      <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                        <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">Tùy chọn</CardTitle>
                  <CardDescription className="text-xs">Chọn ngôn ngữ nguồn và đích.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chế độ</h4>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setBatchMode('single'); setBatchImages([]); setExcelFile(null); setExcelUrlCount(0); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'single' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        1 ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('batch'); setExcelFile(null); setExcelUrlCount(0); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'batch' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        Thư mục / nhiều ảnh (tối đa {MAX_BATCH})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('excel'); setBatchImages([]); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'excel' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        File Excel (link cột A)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('pdf'); setBatchImages([]); setExcelFile(null); setExcelUrlCount(0); setPdfPageCount(null); setPdfPreviews([]) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'pdf' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        File PDF (tối đa 50 trang)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ngôn ngữ nguồn (tài liệu đang viết bằng)</h4>
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm bg-slate-100 text-slate-800"
                    >
                      <option value="">Chọn ngôn ngữ nguồn...</option>
                      <optgroup label="Tiếng Việt">
                        {Object.entries(SOURCE_LANG_VI).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Các ngôn ngữ khác">
                        {Object.entries(SOURCE_LANG_OTHERS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dịch sang (ngôn ngữ đích)</h4>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm bg-slate-100 text-slate-800"
                    >
                      <option value="">Chọn ngôn ngữ đích...</option>
                      <optgroup label="Dịch ra tiếng Việt">
                        {Object.entries(LANG_VI).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Các ngôn ngữ khác">
                        {Object.entries(LANG_OTHERS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng ảnh đầu ra</h4>
                    <p className="text-[10px] text-muted-foreground -mt-1">PDF: ảnh đầu vào luôn tách độ phân giải cao để AI đọc đúng.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '2K' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        2K (3)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium transition-colors ${imageQuality === '4K' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        4K (6)
                      </button>
                    </div>
                  </div>
                  <div className="pt-4 border-t space-y-2 flex flex-col items-center">
                    <p className="text-xs text-muted-foreground">Số dư: <span className="font-medium text-foreground">{userCredits.toLocaleString('vi-VN')}</span> credits</p>
                    {insufficientCredits && estimatedCost > 0 && (
                      <p className="text-xs text-red-600 font-medium text-center">
                        Cần {estimatedCost.toLocaleString('vi-VN')} credits, hiện có {userCredits.toLocaleString('vi-VN')}. Nạp đủ mới bấm Dịch.
                      </p>
                    )}
                    <DepositCreditButton variant="outline" size="sm" className="w-full max-w-[180px] border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200" onCreditsUpdated={fetchCredits} />
                    <Button
                      onClick={() => checkCreditsAndProceed(estimatedCost, handleSubmit)}
                      disabled={
                        !sourceLang.trim() ||
                        !targetLang.trim() ||
                        (batchMode === 'pdf' ? !pdfFile || !pdfPageCount || pdfPageCount === 0 : batchMode === 'excel' ? excelUrls.length === 0 : batchMode === 'batch' ? batchImages.length === 0 : !image.file)
                      }
                      title={
                        insufficientCredits
                          ? `Thiếu credits. Cần ${estimatedCost.toLocaleString('vi-VN')}, hiện có ${userCredits.toLocaleString('vi-VN')}. Nạp thêm để dịch.`
                          : !sourceLang.trim()
                            ? 'Chọn Ngôn ngữ nguồn trước'
                            : !targetLang.trim()
                              ? 'Chọn Ngôn ngữ đích (dịch sang) trước'
                              : undefined
                      }
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Dịch (
                      {batchMode === 'pdf'
                        ? `${imageQuality === '2K' ? '3' : '6'} credit/trang`
                        : `${batchMode === 'excel' && excelUrlCount ? `${excelUrlCount} × ` : batchMode === 'batch' && batchImages.length ? `${batchImages.length} × ` : ''}${imageQuality === '2K' ? '3' : '6'} credit`}
                      )
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* Thời gian: 15–45 giây. Credits trừ khi xong từng ảnh/trang.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="sharpen"
                title={
                  progress.total > 0
                    ? `Đang dịch ảnh ${progress.done < progress.total ? progress.done + 1 : progress.total}/${progress.total}`
                    : batchMode === 'pdf'
                      ? 'Đang dịch file PDF (từng trang)'
                      : batchMode === 'excel'
                        ? 'Đang dịch ảnh từ link Excel'
                        : batchMode === 'batch' && batchImages.length
                          ? `Đang dịch ${batchImages.length} ảnh tài liệu`
                          : 'Đang dịch tài liệu'
                }
                description={
                  progress.total > 0
                    ? `Đã xong ${progress.done} ảnh, đang xử lý ảnh tiếp theo...`
                    : batchMode === 'pdf'
                      ? 'Đang tách trang, dịch từng trang bằng AI, rồi ghép lại PDF...'
                      : isBatchOrExcel
                        ? 'Đang tải ảnh và xử lý từng ảnh, vui lòng đợi...'
                        : 'AI đang đọc và dịch văn bản từ ảnh'
                }
                imagePreview={batchMode === 'pdf' ? null : batchMode === 'batch' ? batchImages[0]?.preview : image.preview}
              />
              {progress.total > 0 && (
                <div className="mt-4 w-full max-w-xs">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-600 transition-all duration-300"
                      style={{ width: `${(progress.done / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {progress.done}/{progress.total} ảnh đã xong
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && (resultUrl || resultPdfUrl || batchResults.length > 0) && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start min-w-0 overflow-hidden">
            <Card className="border shadow-sm bg-white/80 backdrop-blur min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>Kết quả dịch</CardTitle>
                <CardDescription>
                  {resultPdfUrl ? 'File PDF đã được dịch. Tải xuống bên dưới.' : batchResults.length > 0 ? `${batchResults.length} ảnh tài liệu đã được dịch.` : 'Ảnh tài liệu đã được dịch sang ngôn ngữ đích.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resultPdfUrl ? (
                  <div className="space-y-4 p-4 rounded-lg border bg-slate-50/50">
                    <p className="text-sm text-muted-foreground">File PDF đã dịch xong. Nhấn nút bên dưới để tải về.</p>
                    <Button asChild size="lg" className="bg-slate-700 hover:bg-slate-800 text-white">
                      <a href={resultPdfUrl} download="dich-tai-lieu.pdf" target="_blank" rel="noopener noreferrer">
                        <FileDown className="mr-2 h-4 w-4" /> Tải file PDF đã dịch
                      </a>
                    </Button>
                  </div>
                ) : batchResults.length > 0 ? (
                  <div className="space-y-6">
                    {batchResults.map((r, i) => (
                      <div key={i} className="grid md:grid-cols-2 gap-4 p-4 rounded-lg border bg-slate-50/50">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-muted-foreground">Ảnh gốc {batchResults.length > 1 ? i + 1 : ''}</h3>
                          <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-white">
                            <ImagePreview src={r.originalUrl} alt={`Gốc ${i + 1}`} className="w-full h-full object-contain" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-muted-foreground">Ảnh đã dịch {batchResults.length > 1 ? i + 1 : ''}</h3>
                          <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-white">
                            <ImagePreview src={r.resultUrl} alt={`Đã dịch ${i + 1}`} className="w-full h-full object-contain" />
                          </div>
                          <DownloadImageButton imageUrl={r.resultUrl} filename={`dich-tai-lieu-${i + 1}`} size="sm" className="bg-slate-700 hover:bg-slate-800 text-white border-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium text-muted-foreground">Ảnh gốc</h3>
                      {image.preview && (
                        <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-slate-50 min-h-0">
                          <ImagePreview src={image.preview} alt="Gốc" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium text-muted-foreground">Ảnh đã dịch</h3>
                      <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-slate-50 min-h-0">
                        <ImagePreview src={resultUrl!} alt="Đã dịch" className="w-full h-full object-contain" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60 lg:w-[220px] lg:shrink-0">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">Thao tác</CardTitle>
                <CardDescription className="text-xs">Tải xuống hoặc dịch ảnh khác.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-2">
                  {resultPdfUrl && (
                    <Button size="sm" asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                      <a href={resultPdfUrl} download="dich-tai-lieu.pdf" target="_blank" rel="noopener noreferrer">
                        <FileDown className="mr-2 h-3 w-3" /> Tải file PDF
                      </a>
                    </Button>
                  )}
                  {batchZipUrl && (
                    <Button size="sm" asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                      <a href={batchZipUrl} download="dich-tai-lieu.zip" target="_blank" rel="noopener noreferrer">
                        <FileArchive className="mr-2 h-3 w-3" /> Tải file zip
                      </a>
                    </Button>
                  )}
                  {batchResults.length === 0 && !resultPdfUrl && resultUrl && (
                    <DownloadImageButton imageUrl={resultUrl} filename="dich-tai-lieu" size="sm" className="w-full bg-slate-700 hover:bg-slate-800 text-white border-0" />
                  )}
                  <Button size="sm" variant="outline" onClick={handleReset} className="w-full border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    <RefreshCw className="mr-2 h-3 w-3" /> Thử lại
                  </Button>
                  <Button size="sm" variant="outline" asChild className="w-full border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    <Link href="/dashboard/history/translate">
                      <FileText className="mr-2 h-3 w-3" /> Lịch sử dịch ảnh
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Tài liệu do AI xử lý tự động, có thể có sai sót, quý khách vui lòng kiểm tra kỹ nội dung và thông số trước khi công bố. Chúng tôi không chịu trách nhiệm về các lỗi phát sinh.</p>
    </>
  )
}
