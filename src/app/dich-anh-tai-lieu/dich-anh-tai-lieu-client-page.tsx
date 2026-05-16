'use client'

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useRef, ChangeEvent, useEffect, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { translateDocumentImage, startTranslateBatch, startTranslatePdfBatch, getPdfPageInfo } from './actions'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'

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
const TRANSLATE_COSTS = { '2K': 3, '4K': 6 } as const
type Step = 'UPLOAD' | 'GENERATING' | 'RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

function tr(uiLocale: UiLocale, vi: string, en: string, zh: string, ja: string, ko: string): string {
  if (uiLocale === 'en') return en
  if (uiLocale === 'zh') return zh
  if (uiLocale === 'ja') return ja
  if (uiLocale === 'ko') return ko
  return vi
}

type BatchModeType = 'single' | 'batch' | 'excel' | 'pdf'

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function DichAnhTaiLieuClientPage() {
  const searchParams = useSearchParams()
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
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
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/account/credits', { credentials: 'same-origin' })
      if (!res.ok) {
        setUserCredits(0)
        return
      }
      const j = (await res.json()) as { balance?: number }
      setUserCredits(Number(j.balance ?? 0))
    } catch {
      setUserCredits(0)
    }
  }
  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    window.addEventListener('focus', syncLocale)
    document.addEventListener('visibilitychange', syncLocale)
    return () => {
      window.removeEventListener('focus', syncLocale)
      document.removeEventListener('visibilitychange', syncLocale)
      window.clearInterval(timer)
    }
  }, [])
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
      toast({ title: tr(uiLocale, 'Đã thêm ảnh', 'Images added', '已添加图片', '画像を追加しました', '이미지를 추가했습니다'), description: tr(uiLocale, `Thêm ${newImages.length} ảnh.`, `Added ${newImages.length} images.`, `已添加 ${newImages.length} 张图片。`, `${newImages.length}枚追加しました。`, `${newImages.length}장 추가되었습니다.`), duration: 2000 })
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
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng chọn file PDF.', 'Please select a PDF file.', '请选择 PDF 文件。', 'PDFファイルを選択してください。', 'PDF 파일을 선택해 주세요.'), variant: 'destructive' })
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
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: res.error, variant: 'destructive' })
        setPdfFile(null)
      } else {
        setPdfPageCount(res.pageCount)
        setPdfPreviews(res.previews)
        toast({ title: tr(uiLocale, 'Đã phân tích PDF', 'PDF analyzed', '已分析 PDF', 'PDFを分析しました', 'PDF 분석 완료'), description: `${res.pageCount} ${tr(uiLocale, 'trang', 'pages', '页', 'ページ', '페이지')} • ${tr(uiLocale, 'Giá sơ bộ', 'Est. cost', '预估价格', '概算', '예상 비용')}: ${(res.pageCount * TRANSLATE_COSTS[imageQuality]).toLocaleString('vi-VN')} credits`, duration: 3000 })
      }
    } catch {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Không đọc được file PDF.', 'Could not read PDF file.', '无法读取 PDF 文件。', 'PDFファイルを読み込めませんでした。', 'PDF 파일을 읽을 수 없습니다.'), variant: 'destructive' })
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
        toast({ title: tr(uiLocale, 'Đã chọn file Excel', 'Excel file selected', '已选择 Excel 文件', 'Excelファイルを選択しました', 'Excel 파일 선택됨'), description: `${urls.length} ${tr(uiLocale, 'link ảnh', 'image links', '图片链接', '画像リンク', '이미지 링크')}.`, duration: 2000 })
      } catch {
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Không đọc được file Excel.', 'Could not read Excel file.', '无法读取 Excel 文件。', 'Excelファイルを読み込めませんでした。', 'Excel 파일을 읽을 수 없습니다.'), variant: 'destructive' })
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
      toast({ title: tr(uiLocale, 'Đã chọn thư mục', 'Folder selected', '已选择文件夹', 'フォルダを選択しました', '폴더 선택됨'), description: `${newImages.length} ${tr(uiLocale, 'ảnh', 'images', '张图片', '枚', '장')} (${tr(uiLocale, 'tối đa', 'max', '最多', '最大', '최대')} ${MAX_BATCH}).`, duration: 2000 })
    } else {
      toast({ title: tr(uiLocale, 'Không có ảnh', 'No images', '没有图片', '画像がありません', '이미지 없음'), description: tr(uiLocale, 'Thư mục không chứa ảnh hợp lệ.', 'Folder contains no valid images.', '文件夹中没有有效图片。', 'フォルダに有効な画像がありません。', '폴더에 유효한 이미지가 없습니다.'), variant: 'destructive' })
    }
    e.target.value = ''
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng dán link ảnh.', 'Please paste image URL.', '请粘贴图片链接。', '画像のURLを貼り付けてください。', '이미지 링크를 붙여넣어 주세요.'), variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Link không hợp lệ.', 'Invalid URL.', '链接无效。', '無効なURLです。', '잘못된 URL입니다.'), variant: 'destructive' })
      return
    }
    if (batchMode === 'batch' && batchImages.length >= MAX_BATCH) {
      toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, `Đã đủ tối đa ${MAX_BATCH} ảnh.`, `Maximum ${MAX_BATCH} images reached.`, `已达最大 ${MAX_BATCH} 张图片。`, `最大${MAX_BATCH}枚です。`, `최대 ${MAX_BATCH}장입니다.`), variant: 'destructive' })
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
      if (!blob.type.startsWith('image/')) throw new Error(tr(uiLocale, 'Không phải ảnh', 'Not an image', '不是图片', '画像ではありません', '이미지가 아닙니다'))
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      if (batchMode === 'batch') {
        setBatchImages((prev) => [...prev, { file, preview: URL.createObjectURL(file) }].slice(0, MAX_BATCH))
      } else {
        setImageFromFile(file, setImage)
      }
      setImageUrl('')
      toast({ title: tr(uiLocale, 'Đã tải ảnh', 'Image loaded', '已加载图片', '画像を読み込みました', '이미지 로드됨'), duration: 2000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : tr(uiLocale, 'Lỗi không xác định', 'Unknown error', '未知错误', '不明なエラー', '알 수 없는 오류')
      toast({ title: tr(uiLocale, 'Không tải được ảnh', 'Failed to load image', '无法加载图片', '画像の読み込みに失敗しました', '이미지 로드 실패'), description: msg, variant: 'destructive', duration: 5000 })
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
              toast({ title: tr(uiLocale, 'Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음'), duration: 2000 })
            } else if (batchMode === 'single' && setImageFromFile(file, setImage)) {
              toast({ title: tr(uiLocale, 'Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음'), duration: 2000 })
            }
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast, batchMode, batchImages.length, uiLocale])
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
        title: tr(uiLocale, 'Chưa chọn ngôn ngữ nguồn', 'Source language not selected', '未选择源语言', 'ソース言語を選択してください', '원본 언어를 선택해 주세요'),
        description: tr(uiLocale, 'Bắt buộc chọn Ngôn ngữ nguồn (tài liệu đang viết bằng) trước khi dịch.', 'Select source language (document language) before translating.', '翻译前请选择源语言（文档所用语言）。', '翻訳前にソース言語（文書の言語）を選択してください。', '번역 전에 원본 언어(문서 언어)를 선택해 주세요.'),
        variant: 'destructive',
        duration: 5000,
      })
      return
    }
    if (!targetLang.trim()) {
      toast({
        title: tr(uiLocale, 'Chưa chọn ngôn ngữ đích', 'Target language not selected', '未选择目标语言', 'ターゲット言語を選択してください', '대상 언어를 선택해 주세요'),
        description: tr(uiLocale, 'Bắt buộc chọn Ngôn ngữ đích (dịch sang) trước khi dịch.', 'Select target language (translate to) before translating.', '翻译前请选择目标语言（翻译成）。', '翻訳前にターゲット言語（翻訳先）を選択してください。', '번역 전에 대상 언어(번역할 언어)를 선택해 주세요.'),
        variant: 'destructive',
        duration: 5000,
      })
      return
    }
    if (batchMode === 'pdf') {
      if (!pdfFile) {
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng tải lên file PDF.', 'Please upload a PDF file.', '请上传 PDF 文件。', 'PDFファイルをアップロードしてください。', 'PDF 파일을 업로드해 주세요.'), variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      const fd = new FormData()
      fd.append('pdfFile', pdfFile)
      fd.append('sourceLang', sourceLang)
      fd.append('targetLang', targetLang)
      fd.append('imageQuality', imageQuality)
      const r = await startTranslatePdfBatch(fd)
      if ('error' in r) {
        setStep('UPLOAD')
        toast({ title: tr(uiLocale, 'Khởi tạo thất bại', 'Init failed', '初始化失败', '初期化に失敗しました', '초기화 실패'), description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: tr(uiLocale, 'Đã bắt đầu dịch PDF', 'PDF translation started', '已开始翻译 PDF', 'PDF翻訳を開始しました', 'PDF 번역 시작됨'), description: tr(uiLocale, 'Tiến trình đã hiển thị ngay trong trang này.', 'Progress is shown on this page.', '进度已显示在此页面。', '進捗はこのページに表示されます。', '진행 상황이 이 페이지에 표시됩니다.'), duration: 4000 })
      return
    } else if (batchMode === 'excel') {
      if (!excelFile || excelUrls.length === 0) {
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng tải lên file Excel có link ảnh ở cột A.', 'Please upload Excel file with image links in column A.', '请上传 A 列包含图片链接的 Excel 文件。', 'A列に画像リンクがあるExcelファイルをアップロードしてください。', 'A열에 이미지 링크가 있는 Excel 파일을 업로드해 주세요.'), variant: 'destructive' })
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
      if ('error' in r) {
        setStep('UPLOAD')
        toast({ title: tr(uiLocale, 'Khởi tạo thất bại', 'Init failed', '初始化失败', '初期化に失敗しました', '초기화 실패'), description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: tr(uiLocale, 'Đã bắt đầu dịch', 'Translation started', '已开始翻译', '翻訳を開始しました', '번역 시작됨'), description: tr(uiLocale, 'Tiến trình đã hiển thị ngay trong trang này.', 'Progress is shown on this page.', '进度已显示在此页面。', '進捗はこのページに表示されます。', '진행 상황이 이 페이지에 표시됩니다.'), duration: 4000 })
      return
    } else if (batchMode === 'batch') {
      if (batchImages.length === 0) {
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng tải lên ít nhất 1 ảnh hoặc chọn thư mục.', 'Please upload at least 1 image or select folder.', '请至少上传 1 张图片或选择文件夹。', '少なくとも1枚の画像をアップロードするかフォルダを選択してください。', '최소 1장의 이미지를 업로드하거나 폴더를 선택해 주세요.'), variant: 'destructive' })
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
      if ('error' in r) {
        setStep('UPLOAD')
        toast({ title: tr(uiLocale, 'Khởi tạo thất bại', 'Init failed', '初始化失败', '初期化に失敗しました', '초기화 실패'), description: r.error, variant: 'destructive', duration: 5000 })
        return
      }
      if (typeof window !== 'undefined') localStorage.setItem(TRANSLATE_PROGRESS_STORAGE_KEY, r.batchId)
      setActiveBatchId(r.batchId)
      setStep('UPLOAD')
      toast({ title: tr(uiLocale, 'Đã bắt đầu dịch', 'Translation started', '已开始翻译', '翻訳を開始しました', '번역 시작됨'), description: tr(uiLocale, 'Tiến trình đã hiển thị ngay trong trang này.', 'Progress is shown on this page.', '进度已显示在此页面。', '進捗はこのページに表示されます。', '진행 상황이 이 페이지에 표시됩니다.'), duration: 4000 })
      return
    } else {
      if (!image.file) {
        toast({ title: tr(uiLocale, 'Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr(uiLocale, 'Vui lòng tải lên ảnh tài liệu.', 'Please upload document image.', '请上传文档图片。', '文書画像をアップロードしてください。', '문서 이미지를 업로드해 주세요.'), variant: 'destructive' })
        return
      }
      setStep('GENERATING')
      await waitForNextPaintClient()
      const formData = new FormData()
      formData.append('image', image.file)
      formData.append('sourceLang', sourceLang)
      formData.append('targetLang', targetLang)
      formData.append('imageQuality', imageQuality)
      try {
        const result = await translateDocumentImage(formData)
        await finalizeStandardImageGenerationResult(result, {
          onServerErrorMessage: (message) => {
            setStep('UPLOAD')
            toast({
              title: tr(uiLocale, 'Dịch thất bại', 'Translation failed', '翻译失败', '翻訳に失敗しました', '번역 실패'),
              description: message,
              variant: 'destructive',
              duration: 5000,
            })
          },
          onSuccessWithUrl: (url) => {
            setResultUrl(url)
            setStep('RESULT')
            toast({
              title: tr(uiLocale, 'Thành công!', 'Success!', '成功！', '成功', '성공!'),
              description: tr(uiLocale, 'Đã dịch tài liệu thành ảnh.', 'Document translated to image.', '文档已翻译为图片。', '文書を画像に翻訳しました。', '문서가 이미지로 번역되었습니다.'),
              duration: 3000,
            })
          },
          onUnexpectedPayload: () => {
            setStep('UPLOAD')
            toast({
              title: tr(uiLocale, 'Dịch thất bại', 'Translation failed', '翻译失败', '翻訳に失敗しました', '번역 실패'),
              description: genClient.unexpectedNoUrl,
              variant: 'destructive',
              duration: 6000,
            })
          },
        })
      } catch (e) {
        setStep('UPLOAD')
        toast({
          title: tr(uiLocale, 'Dịch thất bại', 'Translation failed', '翻译失败', '翻訳に失敗しました', '번역 실패'),
          description: e instanceof Error ? e.message : genClient.clientFault,
          variant: 'destructive',
          duration: 6000,
        })
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
      <div className="tool-page-container">
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
            <FileText className="h-7 w-7 text-slate-600" /> {tr(uiLocale, 'Dịch ảnh tài liệu kỹ thuật', 'Translate technical document images', '翻译技术文档图片', '技術文書画像の翻訳', '기술 문서 이미지 번역')}
          </h1>
          <p className="text-muted-foreground mt-1">{tr(uiLocale, 'Dịch ảnh tài liệu thành ảnh mới (bản vẽ, sơ đồ, spec). 3–6 credits/ảnh. Hỗ trợ dịch nhiều ảnh.', 'Translate document images to new images (drawings, diagrams, spec). 3–6 credits/image. Batch supported.', '将文档图片翻译为新图片（图纸、图表、规格）。3–6 积分/张。支持批量。', '文書画像を新画像に翻訳（図面、図表、仕様）。3〜6クレジット/枚。一括対応。', '문서 이미지를 새 이미지로 번역(도면, 다이어그램, 스펙). 3–6 크레딧/장. 일괄 지원.')}</p>
        </div>

        {step === 'UPLOAD' && (
          <div className="grid lg:grid-cols-[1fr_220px] gap-4 items-start">
            <div className="min-w-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="h-4 w-4 text-slate-600" /> {tr(uiLocale, 'Tải ảnh tài liệu', 'Upload document images', '上传文档图片', '文書画像をアップロード', '문서 이미지 업로드')}
                  </CardTitle>
                  <CardDescription className="text-xs">{tr(uiLocale, 'Chọn ảnh, dán ảnh (Ctrl+V) hoặc dán link. Hỗ trợ bản vẽ, sơ đồ, spec, sổ tay.', 'Select image, paste (Ctrl+V) or paste link. Supports drawings, diagrams, spec, manuals.', '选择图片、粘贴 (Ctrl+V) 或粘贴链接。支持图纸、图表、规格、手册。', '画像を選択、貼り付け (Ctrl+V) またはリンクを貼り付け。図面、図表、仕様、マニュアル対応。', '이미지 선택, 붙여넣기 (Ctrl+V) 또는 링크 붙여넣기. 도면, 다이어그램, 스펙, 매뉴얼 지원.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  {batchMode === 'pdf' ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">{tr(uiLocale, 'Tải file PDF lên. Mỗi trang sẽ được chuyển thành ảnh, dịch bằng AI, rồi ghép lại thành PDF mới.', 'Upload PDF. Each page will be converted to image, translated by AI, then merged into new PDF.', '上传 PDF。每页将转为图片、由 AI 翻译、再合并为新 PDF。', 'PDFをアップロード。各ページは画像に変換され、AIで翻訳され、新しいPDFに結合されます。', 'PDF 업로드. 각 페이지가 이미지로 변환되고 AI가 번역한 뒤 새 PDF로 병합됩니다.')}</p>
                      <label className="block">
                        <span className="sr-only">{tr(uiLocale, 'Chọn file PDF', 'Select PDF file', '选择 PDF 文件', 'PDFファイルを選択', 'PDF 파일 선택')}</span>
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
                          {tr(uiLocale, 'Đang phân tích PDF, tách từng trang...', 'Analyzing PDF, splitting pages...', '正在分析 PDF，拆分页面...', 'PDFを分析中、ページを分割しています...', 'PDF 분석 중, 페이지 분할 중...')}
                        </p>
                      )}
                      {pdfFile && pdfPageCount !== null && !pdfLoading && (
                        <>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {pdfFile.name} – {pdfPageCount} {tr(uiLocale, 'trang', 'pages', '页', 'ページ', '페이지')}
                          </h4>
                          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                            {pdfPreviews.map((src, i) => (
                              <div key={i} className="relative aspect-[3/4] rounded-lg border overflow-hidden bg-slate-100">
                                <ImagePreview src={src} alt={`${tr(uiLocale, 'Trang', 'Page', '頁', 'ページ', '페이지')} ${i + 1}`} className="w-full h-full object-contain" />
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
                            {tr(uiLocale, 'Giá sơ bộ', 'Est. cost', '预估价格', '概算', '예상 비용')}: {(pdfPageCount * TRANSLATE_COSTS[imageQuality]).toLocaleString('vi-VN')} credits ({pdfPageCount} × {imageQuality === '2K' ? '3' : '6'}/{tr(uiLocale, 'trang', 'page', '页', 'ページ', '페이지')})
                          </p>
                          <p className="text-xs text-amber-600 font-medium">
                            → {tr(uiLocale, 'Chọn Ngôn ngữ nguồn và Ngôn ngữ đích bên cạnh, rồi bấm Dịch.', 'Select source and target language on the right, then click Translate.', '在右侧选择源语言和目标语言，然后点击翻译。', '右側でソース言語とターゲット言語を選択し、翻訳をクリックしてください。', '오른쪽에서 원본 및 대상 언어를 선택한 후 번역을 클릭하세요.')}
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              {tr(uiLocale, 'Thiếu credits. Cần', 'Insufficient credits. Need', '积分不足。需要', 'クレジット不足。必要', '크레딧 부족. 필요')} {estimatedCost.toLocaleString('vi-VN')}, {tr(uiLocale, 'hiện có', 'have', '当前', '現在', '현재')} {userCredits.toLocaleString('vi-VN')}. {tr(uiLocale, 'Nạp đủ mới bấm Dịch được.', 'Top up to translate.', '请充值后再翻译。', 'チャージしてから翻訳してください。', '충전 후 번역 가능합니다.')}
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
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Tải bảng mẫu', 'Download template', '下载模板', 'テンプレートをダウンロード', '템플릿 다운로드')}
                          </a>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">{tr(uiLocale, 'Dán link ảnh vào cột A, lưu file rồi tải lên.', 'Paste image links in column A, save, then upload.', '将图片链接粘贴到 A 列，保存后上传。', 'A列に画像リンクを貼り付け、保存してアップロード。', 'A열에 이미지 링크를 붙여넣고 저장 후 업로드하세요.')}</p>
                      <label className="block">
                        <span className="sr-only">{tr(uiLocale, 'Chọn file Excel', 'Select Excel file', '选择 Excel 文件', 'Excelファイルを選択', 'Excel 파일 선택')}</span>
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
                            {excelFile?.name || tr(uiLocale, 'File Excel', 'Excel file', 'Excel 文件', 'Excelファイル', 'Excel 파일')} – {excelUrls.length} {tr(uiLocale, 'link', 'links', '链接', 'リンク', '링크')} • {tr(uiLocale, 'Giá sơ bộ', 'Est. cost', '预估价格', '概算', '예상 비용')}: {estimatedCost.toLocaleString('vi-VN')} credits
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              {tr(uiLocale, 'Thiếu credits. Cần', 'Insufficient credits. Need', '积分不足。需要', 'クレジット不足。必要', '크레딧 부족. 필요')} {estimatedCost.toLocaleString('vi-VN')}, {tr(uiLocale, 'hiện có', 'have', '当前', '現在', '현재')} {userCredits.toLocaleString('vi-VN')}. {tr(uiLocale, 'Nạp đủ mới bấm Dịch được.', 'Top up to translate.', '请充值后再翻译。', 'チャージしてから翻訳してください。', '충전 후 번역 가능합니다.')}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  ) : batchMode === 'batch' ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr(uiLocale, 'Ảnh cần dịch', 'Images to translate', '待翻译图片', '翻訳する画像', '번역할 이미지')} ({batchImages.length}/{MAX_BATCH})</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {batchImages.map((img, i) => (
                          <div key={i} className="relative group aspect-square rounded-lg border overflow-hidden bg-slate-50">
                            <ImagePreview src={img.preview} alt={`${tr(uiLocale, 'Ảnh', 'Image', '图片', '画像', '이미지')} ${i + 1}`} className="w-full h-full object-contain" />
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
                              <p className="text-xs font-medium text-slate-700">{tr(uiLocale, 'Thêm ảnh', 'Add images', '添加图片', '画像を追加', '이미지 추가')}</p>
                            </label>
                            <label
                              htmlFor="dich-tai-lieu-folder-input"
                              className="aspect-square rounded-lg border-2 border-dashed border-slate-300 bg-slate-100 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 hover:bg-slate-200 transition-colors"
                            >
                              <FolderOpen className="h-10 w-10 text-slate-600" />
                              <p className="text-xs font-medium text-slate-700">{tr(uiLocale, 'Chọn thư mục', 'Select folder', '选择文件夹', 'フォルダを選択', '폴더 선택')}</p>
                            </label>
                          </>
                        )}
                      </div>
                      <input id="dich-tai-lieu-batch-input" ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addBatchImages} />
                      <input id="dich-tai-lieu-folder-input" ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFolderImages} />
                      {batchImages.length > 0 && (
                        <>
                          <p className="text-xs text-emerald-600 font-medium">
                            {tr(uiLocale, 'Giá sơ bộ', 'Est. cost', '预估价格', '概算', '예상 비용')}: {estimatedCost.toLocaleString('vi-VN')} credits ({batchImages.length} {tr(uiLocale, 'ảnh', 'images', '张图片', '枚', '장')} × {TRANSLATE_COSTS[imageQuality]})
                          </p>
                          {insufficientCredits && (
                            <p className="text-xs text-red-600 font-medium">
                              {tr(uiLocale, 'Thiếu credits. Cần', 'Insufficient credits. Need', '积分不足。需要', 'クレジット不足。必要', '크레딧 부족. 필요')} {estimatedCost.toLocaleString('vi-VN')}, {tr(uiLocale, 'hiện có', 'have', '当前', '現在', '현재')} {userCredits.toLocaleString('vi-VN')}. {tr(uiLocale, 'Nạp đủ mới bấm Dịch được.', 'Top up to translate.', '请充值后再翻译。', 'チャージしてから翻訳してください。', '충전 후 번역 가능합니다.')}
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
                          <ImagePreview src={image.preview} alt={tr(uiLocale, 'Xem trước', 'Preview', '预览', 'プレビュー', '미리보기')} className="w-full h-full object-contain rounded-lg" />
                        ) : (
                          <>
                            <Upload className="h-12 w-12 text-slate-500" />
                            <p className="text-sm text-muted-foreground font-medium">{tr(uiLocale, 'Chọn ảnh hoặc dán ảnh (Ctrl+V)', 'Select image or paste (Ctrl+V)', '选择图片或粘贴 (Ctrl+V)', '画像を選択または貼り付け (Ctrl+V)', '이미지 선택 또는 붙여넣기 (Ctrl+V)')}</p>
                          </>
                        )}
                      </label>
                      {batchMode === 'single' && image.preview && (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
                          <RefreshCw className="h-3.5 w-3.5" /> {tr(uiLocale, 'Chọn lại', 'Choose again', '重新选择', '再選択', '다시 선택')}
                        </button>
                      )}
                    </div>
                  )}
                  <input id="dich-tai-lieu-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  {batchMode !== 'excel' && batchMode !== 'pdf' && (
                    <div className="flex gap-2">
                      <Input
                        placeholder={tr(uiLocale, 'Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像URLを貼り付けて取得をクリック', '이미지 링크 붙여넣기 후 가져오기 클릭')}
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1 bg-slate-100 border-slate-300"
                      />
                      <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                        <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr(uiLocale, 'Đang tải...', 'Loading...', '加载中...', '読み込み中...', '로딩 중...') : tr(uiLocale, 'Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '이미지 가져오기')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <div className="lg:w-[220px] lg:shrink-0">
              <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60 h-full">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr(uiLocale, 'Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                  <CardDescription className="text-xs">{tr(uiLocale, 'Chọn ngôn ngữ nguồn và đích.', 'Select source and target language.', '选择源语言和目标语言。', 'ソース言語とターゲット言語を選択。', '원본 및 대상 언어를 선택하세요.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr(uiLocale, 'Chế độ', 'Mode', '模式', 'モード', '모드')}</h4>
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setBatchMode('single'); setBatchImages([]); setExcelFile(null); setExcelUrlCount(0); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'single' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        {tr(uiLocale, '1 ảnh', '1 image', '1 张图片', '1枚', '1장')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('batch'); setExcelFile(null); setExcelUrlCount(0); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'batch' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        {tr(uiLocale, 'Thư mục / nhiều ảnh (tối đa', 'Folder / multiple images (max', '文件夹/多张图片（最多', 'フォルダ/複数画像（最大', '폴더/여러 이미지 (최대')} {MAX_BATCH}{tr(uiLocale, ')', ')', '）', ')', ')')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('excel'); setBatchImages([]); setPdfFile(null) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'excel' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        {tr(uiLocale, 'File Excel (link ảnh cột A)', 'Excel file (image links in column A)', 'Excel 文件（A 列图片链接）', 'Excelファイル（A列画像リンク）', 'Excel 파일 (A열 이미지 링크)')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBatchMode('pdf'); setBatchImages([]); setExcelFile(null); setExcelUrlCount(0); setPdfPageCount(null); setPdfPreviews([]) }}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${batchMode === 'pdf' ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-500 bg-slate-400 text-slate-900 hover:bg-slate-500'}`}
                      >
                        {tr(uiLocale, 'File PDF (tối đa 50 trang)', 'PDF file (max 50 pages)', 'PDF 文件（最多 50 页）', 'PDFファイル（最大50ページ）', 'PDF 파일 (최대 50페이지)')}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr(uiLocale, 'Ngôn ngữ nguồn (tài liệu đang viết bằng)', 'Source language (document is written in)', '源语言（文档原文）', 'ソース言語（文書の原文）', '원본 언어 (문서 원문)')}</h4>
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm bg-slate-100 text-slate-800"
                    >
                      <option value="">{tr(uiLocale, 'Chọn ngôn ngữ nguồn...', 'Select source language...', '选择源语言...', 'ソース言語を選択...', '원본 언어 선택...')}</option>
                      <optgroup label={tr(uiLocale, 'Tiếng Việt', 'Vietnamese', '越南语', 'ベトナム語', '베트남어')}>
                        {Object.entries(SOURCE_LANG_VI).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                      <optgroup label={tr(uiLocale, 'Các ngôn ngữ khác', 'Other languages', '其他语言', 'その他の言語', '기타 언어')}>
                        {Object.entries(SOURCE_LANG_OTHERS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr(uiLocale, 'Dịch sang (ngôn ngữ đích)', 'Translate to (target language)', '翻译为（目标语言）', '翻訳先（ターゲット言語）', '번역 대상 언어')}</h4>
                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 text-sm bg-slate-100 text-slate-800"
                    >
                      <option value="">{tr(uiLocale, 'Chọn ngôn ngữ đích...', 'Select target language...', '选择目标语言...', 'ターゲット言語を選択...', '대상 언어 선택...')}</option>
                      <optgroup label={tr(uiLocale, 'Dịch ra tiếng Việt', 'Translate to Vietnamese', '翻译成越南语', 'ベトナム語に翻訳', '베트남어로 번역')}>
                        {Object.entries(LANG_VI).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                      <optgroup label={tr(uiLocale, 'Các ngôn ngữ khác', 'Other languages', '其他语言', 'その他の言語', '기타 언어')}>
                        {Object.entries(LANG_OTHERS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr(uiLocale, 'Chất lượng ảnh đầu ra', 'Output image quality', '输出图像质量', '出力画像の品質', '출력 이미지 품질')}</h4>
                    <p className="text-[10px] text-muted-foreground -mt-1">{tr(uiLocale, 'PDF: ảnh đầu vào luôn tách độ phân giải cao để AI đọc đúng.', 'PDF: input pages are extracted at high resolution so AI can read accurately.', 'PDF：输入页始终以高分辨率拆分，便于 AI 准确识别。', 'PDF: 入力ページはAIが正確に読めるよう常に高解像度で分割します。', 'PDF: AI가 정확히 읽도록 입력 페이지를 항상 고해상도로 분리합니다.')}</p>
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
                    <p className="text-xs text-muted-foreground">{tr(uiLocale, 'Số dư', 'Balance', '余额', '残高', '잔액')}: <span className="font-medium text-foreground">{userCredits.toLocaleString('vi-VN')}</span> credits</p>
                    {insufficientCredits && estimatedCost > 0 && (
                      <p className="text-xs text-red-600 font-medium text-center">
                        {tr(uiLocale, 'Cần', 'Need', '需要', '必要', '필요')} {estimatedCost.toLocaleString('vi-VN')} credits, {tr(uiLocale, 'hiện có', 'currently have', '当前有', '現在', '현재 보유')} {userCredits.toLocaleString('vi-VN')}. {tr(uiLocale, 'Nạp đủ mới bấm Dịch.', 'Top up first, then click Translate.', '请先充值，再点击翻译。', '先にチャージしてから翻訳してください。', '충전 후 번역을 눌러주세요.')}
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
                          ? `${tr(uiLocale, 'Thiếu credits. Cần', 'Insufficient credits. Need', '积分不足。需要', 'クレジット不足。必要', '크레딧 부족. 필요')} ${estimatedCost.toLocaleString('vi-VN')}, ${tr(uiLocale, 'hiện có', 'have', '当前', '現在', '현재')} ${userCredits.toLocaleString('vi-VN')}. ${tr(uiLocale, 'Nạp thêm để dịch.', 'Top up to translate.', '请充值后再翻译。', 'チャージしてから翻訳してください。', '충전 후 번역하세요.')}`
                          : !sourceLang.trim()
                            ? tr(uiLocale, 'Chọn Ngôn ngữ nguồn trước', 'Select source language first', '请先选择源语言', 'ソース言語を先に選択', '원본 언어를 먼저 선택하세요')
                            : !targetLang.trim()
                              ? tr(uiLocale, 'Chọn Ngôn ngữ đích (dịch sang) trước', 'Select target language first', '请先选择目标语言', 'ターゲット言語を先に選択', '대상 언어를 먼저 선택하세요')
                              : undefined
                      }
                      className="w-full max-w-[180px] h-9 shadow-md hover:shadow-lg transition-all text-sm bg-slate-700 hover:bg-slate-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Dịch', 'Translate', '翻译', '翻訳', '번역')} (
                      {batchMode === 'pdf'
                        ? `${imageQuality === '2K' ? '3' : '6'} credit/${tr(uiLocale, 'trang', 'page', '页', 'ページ', '페이지')}`
                        : `${batchMode === 'excel' && excelUrlCount ? `${excelUrlCount} × ` : batchMode === 'batch' && batchImages.length ? `${batchImages.length} × ` : ''}${imageQuality === '2K' ? '3' : '6'} credit`}
                      )
                    </Button>
                    <p className="text-[10px] text-center text-muted-foreground mt-2">* {tr(uiLocale, 'Thời gian: 15–45 giây. Credits trừ khi xong từng ảnh/trang.', 'Time: 15–45 sec. Credits deducted per completed image/page.', '时间：15–45 秒。每完成一张图片/页扣除积分。', '所要時間：15〜45秒。画像/ページごとにクレジットが差し引かれます。', '소요 시간: 15–45초. 이미지/페이지당 완료 시 크레딧 차감.')}</p>
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
                    ? `${tr(uiLocale, 'Đang dịch ảnh', 'Translating image', '正在翻译图片', '画像を翻訳中', '이미지 번역 중')} ${progress.done < progress.total ? progress.done + 1 : progress.total}/${progress.total}`
                    : batchMode === 'pdf'
                      ? tr(uiLocale, 'Đang dịch file PDF (từng trang)', 'Translating PDF (page by page)', '正在翻译 PDF（逐页）', 'PDFを翻訳中（ページごと）', 'PDF 번역 중 (페이지별)')
                      : batchMode === 'excel'
                        ? tr(uiLocale, 'Đang dịch ảnh từ link Excel', 'Translating images from Excel links', '正在从 Excel 链接翻译图片', 'Excelリンクから画像を翻訳中', 'Excel 링크에서 이미지 번역 중')
                        : batchMode === 'batch' && batchImages.length
                          ? `${tr(uiLocale, 'Đang dịch', 'Translating', '正在翻译', '翻訳中', '번역 중')} ${batchImages.length} ${tr(uiLocale, 'ảnh tài liệu', 'document images', '张文档图片', '枚の文書画像', '장의 문서 이미지')}`
                          : tr(uiLocale, 'Đang dịch tài liệu', 'Translating document', '正在翻译文档', '文書を翻訳中', '문서 번역 중')
                }
                description={
                  progress.total > 0
                    ? `${tr(uiLocale, 'Đã xong', 'Done', '已完成', '完了', '완료')} ${progress.done} ${tr(uiLocale, 'ảnh, đang xử lý ảnh tiếp theo...', ' images, processing next...', ' 张，正在处理下一张...', ' 枚完了、次を処理中...', ' 장 완료, 다음 처리 중...')}`
                    : batchMode === 'pdf'
                      ? tr(uiLocale, 'Đang tách trang, dịch từng trang bằng AI, rồi ghép lại PDF...', 'Splitting pages, translating each with AI, merging to PDF...', '正在拆分页面、AI 逐页翻译、合并为 PDF...', 'ページを分割、AIで各ページを翻訳、PDFに結合中...', '페이지 분할, AI로 각 페이지 번역, PDF 병합 중...')
                      : isBatchOrExcel
                        ? tr(uiLocale, 'Đang tải ảnh và xử lý từng ảnh, vui lòng đợi...', 'Loading and processing each image, please wait...', '正在加载并处理每张图片，请稍候...', '画像を読み込み各画像を処理中、お待ちください...', '이미지 로드 및 각 이미지 처리 중, 잠시만 기다려 주세요...')
                        : tr(uiLocale, 'AI đang đọc và dịch văn bản từ ảnh', 'AI is reading and translating text from image', 'AI 正在读取并翻译图片中的文字', 'AIが画像からテキストを読み取り翻訳しています', 'AI가 이미지에서 텍스트를 읽고 번역 중입니다')
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
                    {progress.done}/{progress.total} {tr(uiLocale, 'ảnh đã xong', 'images done', '张已完成', '枚完了', '장 완료')}
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
                <CardTitle>{tr(uiLocale, 'Kết quả dịch', 'Translation result', '翻译结果', '翻訳結果', '번역 결과')}</CardTitle>
                <CardDescription>
                  {resultPdfUrl ? tr(uiLocale, 'File PDF đã được dịch. Tải xuống bên dưới.', 'PDF has been translated. Download below.', 'PDF 已翻译完成。请在下方下载。', 'PDFが翻訳されました。下からダウンロードしてください。', 'PDF가 번역되었습니다. 아래에서 다운로드하세요.') : batchResults.length > 0 ? `${batchResults.length} ${tr(uiLocale, 'ảnh tài liệu đã được dịch.', 'document images translated.', '张文档图片已翻译。', '枚の文書画像が翻訳されました。', '장의 문서 이미지가 번역되었습니다.')}` : tr(uiLocale, 'Ảnh tài liệu đã được dịch sang ngôn ngữ đích.', 'Document image translated to target language.', '文档图片已翻译为目标语言。', '文書画像がターゲット言語に翻訳されました。', '문서 이미지가 대상 언어로 번역되었습니다.')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resultPdfUrl ? (
                  <div className="space-y-4 p-4 rounded-lg border bg-slate-50/50">
                    <p className="text-sm text-muted-foreground">{tr(uiLocale, 'File PDF đã dịch xong. Nhấn nút bên dưới để tải về.', 'PDF translation complete. Click the button below to download.', 'PDF 翻译完成。点击下方按钮下载。', 'PDF翻訳が完了しました。下のボタンをクリックしてダウンロードしてください。', 'PDF 번역 완료. 아래 버튼을 클릭하여 다운로드하세요.')}</p>
                    <Button asChild size="lg" className="bg-slate-700 hover:bg-slate-800 text-white">
                      <a href={resultPdfUrl} download="dich-tai-lieu.pdf" target="_blank" rel="noopener noreferrer">
                        <FileDown className="mr-2 h-4 w-4" /> {tr(uiLocale, 'Tải file PDF đã dịch', 'Download translated PDF', '下载已翻译的 PDF', '翻訳済みPDFをダウンロード', '번역된 PDF 다운로드')}
                      </a>
                    </Button>
                  </div>
                ) : batchResults.length > 0 ? (
                  <div className="space-y-6">
                    {batchResults.map((r, i) => (
                      <div key={i} className="grid md:grid-cols-2 gap-4 p-4 rounded-lg border bg-slate-50/50">
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-muted-foreground">{tr(uiLocale, 'Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')} {batchResults.length > 1 ? i + 1 : ''}</h3>
                          <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-white">
                            <ImagePreview src={r.originalUrl} alt={`${tr(uiLocale, 'Gốc', 'Original', '原', '元', '원본')} ${i + 1}`} className="w-full h-full object-contain" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-muted-foreground">{tr(uiLocale, 'Ảnh đã dịch', 'Translated image', '已翻译图片', '翻訳済み画像', '번역된 이미지')} {batchResults.length > 1 ? i + 1 : ''}</h3>
                          <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-white">
                            <ImagePreview src={r.resultUrl} alt={`${tr(uiLocale, 'Đã dịch', 'Translated', '已翻译', '翻訳済み', '번역됨')} ${i + 1}`} className="w-full h-full object-contain" />
                          </div>
                          <DownloadImageButton
                            imageUrl={r.resultUrl}
                            filename={`dich-tai-lieu-${i + 1}`}
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-800 text-white border-0"
                            printReady
                            printReadyInferFromImage
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6 min-w-0">
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr(uiLocale, 'Ảnh gốc', 'Original image', '原图', '元画像', '원본 이미지')}</h3>
                      {image.preview && (
                        <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-slate-50 min-h-0">
                          <ImagePreview src={image.preview} alt={tr(uiLocale, 'Gốc', 'Original', '原', '元', '원본')} className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr(uiLocale, 'Ảnh đã dịch', 'Translated image', '已翻译图片', '翻訳済み画像', '번역된 이미지')}</h3>
                      <div className="aspect-[4/3] rounded-lg border overflow-hidden bg-slate-50 min-h-0">
                        <ImagePreview src={resultUrl!} alt={tr(uiLocale, 'Đã dịch', 'Translated', '已翻译', '翻訳済み', '번역됨')} className="w-full h-full object-contain" />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-slate-300/60 lg:w-[220px] lg:shrink-0">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{tr(uiLocale, 'Thao tác', 'Actions', '操作', '操作', '작업')}</CardTitle>
                <CardDescription className="text-xs">{tr(uiLocale, 'Tải xuống hoặc dịch ảnh khác.', 'Download or translate another image.', '下载或翻译其他图片。', 'ダウンロードまたは別の画像を翻訳。', '다운로드 또는 다른 이미지 번역.')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-col gap-2">
                  {resultPdfUrl && (
                    <Button size="sm" asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                      <a href={resultPdfUrl} download="dich-tai-lieu.pdf" target="_blank" rel="noopener noreferrer">
                        <FileDown className="mr-2 h-3 w-3" /> {tr(uiLocale, 'Tải file PDF', 'Download PDF', '下载 PDF', 'PDFをダウンロード', 'PDF 다운로드')}
                      </a>
                    </Button>
                  )}
                  {batchZipUrl && (
                    <Button size="sm" asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                      <a href={batchZipUrl} download="dich-tai-lieu.zip" target="_blank" rel="noopener noreferrer">
                        <FileArchive className="mr-2 h-3 w-3" /> {tr(uiLocale, 'Tải file zip', 'Download zip', '下载 zip', 'zipをダウンロード', 'zip 다운로드')}
                      </a>
                    </Button>
                  )}
                  {batchResults.length === 0 && !resultPdfUrl && resultUrl && (
                    <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="dich-tai-lieu"
                    size="sm"
                    className="w-full bg-slate-700 hover:bg-slate-800 text-white border-0"
                    printReady
                    printReadyInferFromImage
                  />
                  )}
                  <Button size="sm" variant="outline" onClick={handleReset} className="w-full border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr(uiLocale, 'Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                  </Button>
                  <Button size="sm" variant="outline" asChild className="w-full border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200">
                    <Link href="/dashboard/history/translate">
                      <FileText className="mr-2 h-3 w-3" /> {tr(uiLocale, 'Lịch sử dịch ảnh', 'Translation history', '翻译历史', '翻訳履歴', '번역 기록')}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr(uiLocale, 'Tài liệu do AI xử lý tự động, có thể có sai sót, quý khách vui lòng kiểm tra kỹ nội dung và thông số trước khi công bố. Chúng tôi không chịu trách nhiệm về các lỗi phát sinh.', 'Documents are AI-processed automatically and may contain errors. Please verify content and specs before publishing. We are not liable for any errors.', '文档由 AI 自动处理，可能存在错误。发布前请仔细核对内容和规格。我们对产生的错误不承担责任。', '文書はAIで自動処理され、誤りが含まれる場合があります。公開前に内容と仕様をご確認ください。当社は発生した誤りについて責任を負いません。', '문서는 AI가 자동 처리하며 오류가 있을 수 있습니다. 공개 전 내용과 사양을 확인해 주세요. 발생한 오류에 대해 당사는 책임지지 않습니다.')}</p>
    </>
  )
}
