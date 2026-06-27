'use client'
/* eslint-disable @next/next/no-img-element -- design canvas/previews use dynamic and blob image sources */

import { useWebLocaleFromDocumentCookie } from '@/hooks/use-web-locale-from-cookie'

import { useState, useRef, ChangeEvent, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { analyzeInterior, applyInteriorChanges, type ApplyInteriorChangesResult } from './actions'
import { ARCH_THEMES, MAIN_COLORS, APPLY_COSTS, ANALYZE_CREDIT, ROOM_TYPES, INTERIOR_STYLES, DOOR_TYPE_OPTIONS, WINDOW_TYPE_OPTIONS, WALL_TYPE_OPTIONS, FURNITURE_STAGING_MODES, FURNITURE_ITEMS, EXTERIOR_FURNITURE_ITEMS, FURNITURE_MATERIALS, FURNITURE_COLORS, FURNITURE_STYLE_OPTIONS, EXTERIOR_POSITION_OPTIONS, POOL_SHAPE_OPTIONS, POOL_ORIENTATION_OPTIONS, getMainColorLabel, getArchThemeLabel, getRoomTypeLabel, getInteriorStyleLabel, getFurnitureCategoryLabel, getOptionLabel, getFurnitureItemLabel } from './constants'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Link2, Home, Scan, Eraser, Brush, Check, Building2, Palette, Undo2, Save, FolderOpen, Sun, ImagePlus, Copy, FileDown, RotateCcw, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Maximize2, LayoutGrid } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { CompareSlider } from '@/components/ui/compare-slider'
import { jsPDF } from 'jspdf'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'
import { compressInteriorImageForAi } from '@/lib/interior-design-client-image'

const DRAFT_KEY = 'thiet-ke-noi-ngoai-that-draft'

/** Lớn hơn INTERIOR_AI_TIMEOUT_MS (300s mặc định server) để chừa phần tải FormData ảnh (điện thoại hay chật). */
const CLIENT_APPLY_INTERIOR_TIMEOUT_MS = 420_000

function interiorResultUrls(result: ApplyInteriorChangesResult, fallbackUrl: string): string[] {
  if ('resultUrls' in result && result.resultUrls.length > 0) return result.resultUrls
  return [fallbackUrl]
}

type Step = 'UPLOAD' | 'FULL_REDESIGN' | 'ANALYZING' | 'EDITING' | 'GENERATING' | 'RESULT'
type ItemAction = 'keep' | 'redesign' | 'delete'
type RedesignType = 'replace' | 'rearrange'

interface FurnitureItem {
  id: string
  item: string
  color?: string
  material?: string
  status?: string
  position?: string
  action: ItemAction
  redesignType?: RedesignType
  redesignReplaceWith?: string
  redesignRearrangePrompt?: string
}

type StructuralCategory = 'door' | 'window' | 'wall'
interface StructuralItemToConfirm {
  id: string
  item: string
  position?: string
  category: StructuralCategory
  userCorrectedType: string
}

function getStructuralCategory(item: string): StructuralCategory | null {
  const lower = (item || '').toLowerCase()
  if (lower.includes('cửa sổ')) return 'window'
  if (lower.includes('cửa')) return 'door'
  if (lower.includes('tường')) return 'wall'
  return null
}

function getDefaultOption(item: string, category: StructuralCategory): string {
  const lower = (item || '').toLowerCase()
  if (category === 'door') return DOOR_TYPE_OPTIONS[0]?.value || lower
  if (category === 'window') return WINDOW_TYPE_OPTIONS[0]?.value || lower
  if (category === 'wall') return WALL_TYPE_OPTIONS[0]?.value || lower
  return item || ''
}

type FurnitureSelection = { material: string; color: string; style: string; position: string; shape: string; orientation: string }
function normalizeFurnitureSelection(v: unknown): Record<string, FurnitureSelection> {
  if (!v || typeof v !== 'object') return {}
  const entries = Object.entries(v)
  const out: Record<string, FurnitureSelection> = {}
  for (const [id, val] of entries) {
    if (typeof val === 'object' && val) {
      const o = val as { material?: string; color?: string; style?: string; position?: string; shape?: string; orientation?: string }
      out[id] = {
        material: String(o.material ?? ''),
        color: String(o.color ?? ''),
        style: String(o.style ?? ''),
        position: String(o.position ?? ''),
        shape: String(o.shape ?? ''),
        orientation: String(o.orientation ?? ''),
      }
    } else if (typeof val === 'string') {
      out[id] = { material: val, color: '', style: '', position: '', shape: '', orientation: '' }
    }
  }
  return out
}

const setImageFromFile = (file: File, setImage: (v: { file: File; preview: string }) => void) => {
  if (!file.type.startsWith('image/')) return false
  setImage({ file, preview: URL.createObjectURL(file) })
  return true
}

export default function ThietKeNoiNgoaiThatClientPage() {
  const uiLocale = useWebLocaleFromDocumentCookie()
  const [step, setStep] = useState<Step>('UPLOAD')
  const [image, setImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const [furnitureList, setFurnitureList] = useState<FurnitureItem[]>([])
  const [structuralItemsToConfirm, setStructuralItemsToConfirm] = useState<StructuralItemToConfirm[]>([])
  const [selectedStyle, setSelectedStyle] = useState('hiện đại')
  const [spaceType, setSpaceType] = useState<'interior' | 'exterior-facade' | 'exterior-landscape'>('interior')
  const [detectedDominantColor, setDetectedDominantColor] = useState('')
  const [selectedArchTheme, setSelectedArchTheme] = useState('')
  const [selectedMainColor, setSelectedMainColor] = useState('')
  const [selectedSecondaryColor, setSelectedSecondaryColor] = useState('')
  const [addItemsPrompt, setAddItemsPrompt] = useState('')
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [imageUrl, setImageUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultUrls, setResultUrls] = useState<string[]>([])
  const [credits, setCredits] = useState<number>(0)
  const [roomType, setRoomType] = useState('')
  const [lighting, setLighting] = useState('')
  const [fengShuiSuggestion, setFengShuiSuggestion] = useState('')
  const [layoutGuidance, setLayoutGuidance] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [stagingRoomType, setStagingRoomType] = useState('')
  const [furnitureStagingMode, setFurnitureStagingMode] = useState<'ai' | 'custom'>('ai')
  const [selectedFurniture, setSelectedFurniture] = useState<Record<string, FurnitureSelection>>({})
  const [selectedFurnitureForAdd, setSelectedFurnitureForAdd] = useState<Record<string, FurnitureSelection>>({})
  const [furnitureToAddId, setFurnitureToAddId] = useState('')
  const [furnitureToAddIdEdit, setFurnitureToAddIdEdit] = useState('')
  const [variantCount, setVariantCount] = useState(1)
  const [referenceImage, setReferenceImage] = useState<{ file: File; preview: string } | null>(null)
  const [rotationReferenceImage, setRotationReferenceImage] = useState<{ file: File; preview: string } | null>(null)
  const [rotationHistory, setRotationHistory] = useState<string[]>([])
  const [rotationHistoryIndex, setRotationHistoryIndex] = useState(0)
  const [undoStack, setUndoStack] = useState<{ displayImage: string; furnitureList: FurnitureItem[]; currentImageUrl: string | null }[]>([])
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const rotationRefInputRef = useRef<HTMLInputElement>(null)

  const displayImage = currentImageUrl || image.preview

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

  const appendInteriorMainToFormData = useCallback(
    async (formData: FormData, img: File | null, url: string | null) => {
      if (url?.startsWith('blob:') && img) {
        formData.append('image', await compressInteriorImageForAi(img, { imageQuality }))
      } else if (url && !url.startsWith('blob:')) {
        formData.append('image', url)
      } else if (img) {
        formData.append('image', await compressInteriorImageForAi(img, { imageQuality }))
      } else if (url) {
        formData.append('image', url)
      }
    },
    [imageQuality]
  )

  const appendCompressedInteriorFile = useCallback(
    async (formData: FormData, key: string, file: File | null | undefined) => {
      if (!file) return
      formData.append(key, await compressInteriorImageForAi(file, { imageQuality }))
    },
    [imageQuality]
  )

  /** Gọi server action + timeout + bắt lỗi mạng (mobile hay reset kết nối giữa chừng). */
  const timedApplyInteriorChanges = async (formData: FormData): Promise<Awaited<ReturnType<typeof applyInteriorChanges>>> => {
    return (await Promise.race([
      applyInteriorChanges(formData),
      new Promise<{ error: string }>((resolve) => {
        setTimeout(() => {
          resolve({
            error: tr(
              'Hết thời gian chờ xử lý (~7 phút). Ảnh điện thoại thường rất nặng — thử Wi‑Fi, thu nhỏ ảnh trước khi tải, hoặc thử lại.',
              'Processing timed out (~7 min). Phone photos are often very large — try Wi‑Fi, resize before upload, or retry.',
              '处理超时（约7分钟）。手机照片通常很大—请尝试 Wi‑Fi、上传前缩小图片或重试。',
              '処理がタイムアウトしました（約7分）。スマホ写真は容量が大きいことが多いです。Wi‑Fi利用・縮小してから再試行してください。',
              '처리 시간이 초과되었습니다(약 7분). 휴대폰 사진은 용량이 큰 경우가 많습니다. Wi‑Fi 사용, 업로드 전 축소, 또는 재시도해 보세요.'
            ),
          })
        }, CLIENT_APPLY_INTERIOR_TIMEOUT_MS)
      }),
    ])) as Awaited<ReturnType<typeof applyInteriorChanges>>
  }

  const stylesFromConstants = Object.entries(INTERIOR_STYLES).map(([value]) => ({
    value,
    label: getInteriorStyleLabel(value, uiLocale),
  }))

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch('/api/account/credits', { credentials: 'same-origin' })
      if (!res.ok) {
        setCredits(0)
        return
      }
      const j = (await res.json()) as { balance?: number }
      setCredits(Number(j.balance ?? 0))
    } catch {
      setCredits(0)
    }
  }, [])

  useEffect(() => {
    refreshCredits()
  }, [refreshCredits, step])

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFromFile(file, setImage)
      setCurrentImageUrl(null)
      setFurnitureList([])
      setResultUrl(null)
    }
  }

  const handleFetchFromUrl = async () => {
    const url = imageUrl.trim()
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng dán link ảnh.', 'Please paste image URL.', '请粘贴图片链接。', '画像のURLを貼り付けてください。', '이미지 링크를 붙여넣어 주세요.'), variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Link không hợp lệ.', 'Invalid URL.', '链接无效。', '無効なURLです。', '잘못된 URL입니다.'), variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error(tr('Không phải ảnh', 'Not an image', '不是图片', '画像ではありません', '이미지가 아닙니다'))
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setCurrentImageUrl(null)
      setFurnitureList([])
      setImageUrl('')
      toast({ title: tr('Đã tải ảnh', 'Image loaded', '已加载图片', '画像を読み込みました', '이미지 로드됨'), description: tr('Ảnh từ link đã được thêm.', 'Image from URL has been added.', '已从链接添加图片。', 'URLから画像を追加しました。', 'URL에서 이미지가 추가되었습니다.'), duration: 2000 })
    } catch {
      toast({
        title: tr('Không tải được ảnh', 'Failed to load image', '无法加载图片', '画像の読み込みに失敗しました', '이미지 로드 실패'),
        description: tr('Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.', 'URL may be CORS-blocked. Try uploading directly.', '链接可能被 CORS 阻止。请直接上传。', 'CORSでブロックされている可能性があります。直接アップロードしてください。', 'CORS로 차단되었을 수 있습니다. 직접 업로드해 보세요.'),
        variant: 'destructive',
        duration: 5000,
      })
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
          if (file && setImageFromFile(file, setImage)) {
            e.preventDefault()
            toast({ title: tr('Đã dán ảnh', 'Image pasted', '已粘贴图片', '画像を貼り付けました', '이미지 붙여넣음'), description: tr('Ảnh từ clipboard đã được thêm.', 'Image from clipboard has been added.', '已从剪贴板添加图片。', 'クリップボードから画像を追加しました。', '클립보드에서 이미지가 추가되었습니다.'), duration: 2000 })
          }
          break
        }
      }
    }
    document.addEventListener('paste', fn)
    return () => document.removeEventListener('paste', fn)
  }, [step, toast])

  const handleFullRedesign = () => {
    if (!image.file) return
    setSelectedMainColor((s) => s || 'trắng')
    setStep('FULL_REDESIGN')
  }

  const handleAnalyze = async () => {
    const img = image.file
    if (!img) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Vui lòng tải lên ảnh không gian cần thiết kế.', 'Please upload space image to design.', '请上传需要设计的空间图片。', 'デザインする空間画像をアップロードしてください。', '설계할 공간 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('ANALYZING')
    try {
      const formData = new FormData()
      formData.append('image', await compressInteriorImageForAi(img, { imageQuality }))
      const result = (await Promise.race([
        analyzeInterior(formData),
        new Promise<{ error: string }>((resolve) => {
          setTimeout(() => {
            resolve({
              error: tr(
                'Hết thời gian chờ phân tích (5 phút). Vui lòng thử lại.',
                'Analysis timed out after 5 minutes. Please try again.',
                '分析等待超时（5分钟），请重试。',
                '分析がタイムアウトしました（5分）。再試行してください。',
                '분석 대기 시간이 초과되었습니다(5분). 다시 시도해 주세요.'
              ),
            })
          }, 300_000)
        }),
      ])) as Awaited<ReturnType<typeof analyzeInterior>> | { error: string }
      if ('error' in result) {
        setStep('UPLOAD')
        toast({ title: tr('Phân tích thất bại', 'Analysis failed', '分析失败', '分析に失敗しました', '분석 실패'), description: result.error, variant: 'destructive', duration: 5000 })
      } else if (result.success && result.analysis) {
        try {
          const parsed = JSON.parse(result.analysis)
          const objs = parsed?.objects || []
          const type = (parsed?.type || 'interior').toLowerCase()
          const dominant = (parsed?.dominantColor || '').trim()
          setSpaceType(type === 'exterior-landscape' ? 'exterior-landscape' : type === 'exterior-facade' || type === 'exterior' ? 'exterior-facade' : 'interior')
          setDetectedDominantColor(dominant)
          setRoomType((parsed?.roomType || '').trim())
          setLighting((parsed?.lighting || '').trim())
          setFengShuiSuggestion((parsed?.fengShuiSuggestion || '').trim())
          setLayoutGuidance((parsed?.layoutGuidance || '').trim())
          const colorKey = Object.keys(MAIN_COLORS).find((k) => k.toLowerCase() === dominant.toLowerCase()) || 'trắng'
          setSelectedMainColor(colorKey)
          setSelectedArchTheme(type === 'exterior-facade' || type === 'exterior' ? 'việt nam' : '')
          setFurnitureList(objs
            .filter((o: { structural?: boolean }) => !o.structural)
            .map((o: { item?: string; color?: string; material?: string; status?: string; position?: string }, i: number) => ({
              id: `item-${i}-${Date.now()}`,
              item: o.item || '—',
              color: o.color,
              material: o.material,
              status: o.status,
              position: o.position,
              action: 'keep' as ItemAction,
            })))
          const structObjs = objs.filter((o: { structural?: boolean }) => o.structural) as { item?: string; position?: string }[]
          const structToConfirm: StructuralItemToConfirm[] = []
          structObjs.forEach((o: { item?: string; position?: string }, i: number) => {
            const cat = getStructuralCategory(o.item || '')
            if (cat) {
              const opts = cat === 'door' ? DOOR_TYPE_OPTIONS : cat === 'window' ? WINDOW_TYPE_OPTIONS : WALL_TYPE_OPTIONS
              const aiItem = o.item || '—'
              const matchOpt = opts.find((opt) => opt.value.toLowerCase() === aiItem.toLowerCase())
              structToConfirm.push({
                id: `struct-${i}-${Date.now()}`,
                item: aiItem,
                position: o.position,
                category: cat,
                userCorrectedType: matchOpt ? matchOpt.value : getDefaultOption(aiItem, cat),
              })
            }
          })
          setStructuralItemsToConfirm(structToConfirm)
          setStep('EDITING')
          const analyzedDesc = type === 'exterior-landscape' ? tr('Đã phân tích sân vườn.', 'Analyzed garden/landscape.', '已分析花园/景观。', '庭園・景観を分析しました。', '정원/조경을 분석했습니다.') : type === 'exterior-facade' || type === 'exterior' ? tr('Đã phân tích mặt tiền nhà.', 'Analyzed facade.', '已分析建筑立面。', '外観を分析しました。', '외관을 분석했습니다.') : tr('Đã phân tích nội thất.', 'Analyzed interior.', '已分析室内。', 'インテリアを分析しました。', '실내를 분석했습니다.')
          toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: analyzedDesc, duration: 3000 })
        } catch {
          setStep('UPLOAD')
          toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không parse được kết quả.', 'Could not parse result.', '无法解析结果。', '結果を解析できませんでした。', '결과를 파싱할 수 없습니다.'), variant: 'destructive' })
        }
      }
    } catch (error) {
      setStep('UPLOAD')
      const msg = error instanceof Error ? error.message : String(error)
      toast({
        title: tr('Phân tích thất bại', 'Analysis failed', '分析失败', '分析に失敗しました', '분석 실패'),
        description: msg || tr('Lỗi kết nối tới máy chủ.', 'Connection error to server.', '连接服务器失败。', 'サーバー接続エラー。', '서버 연결 오류입니다.'),
        variant: 'destructive',
        duration: 5000,
      })
    }
  }

  const setItemAction = (id: string, action: ItemAction) => {
    setFurnitureList((prev) => prev.map((f) => (f.id === id ? { ...f, action, redesignType: action === 'redesign' ? f.redesignType : undefined, redesignReplaceWith: action === 'redesign' ? f.redesignReplaceWith : undefined, redesignRearrangePrompt: action === 'redesign' ? f.redesignRearrangePrompt : undefined } : f)))
  }

  const setItemRedesignType = (id: string, type: RedesignType) => {
    setFurnitureList((prev) => prev.map((f) => (f.id === id ? { ...f, redesignType: type, redesignReplaceWith: type === 'replace' ? f.redesignReplaceWith : undefined, redesignRearrangePrompt: type === 'rearrange' ? f.redesignRearrangePrompt : undefined } : f)))
  }

  const setItemRedesignReplaceWith = (id: string, replaceWith: string) => {
    setFurnitureList((prev) => prev.map((f) => (f.id === id ? { ...f, redesignReplaceWith: replaceWith } : f)))
  }

  const setItemRedesignRearrangePrompt = (id: string, prompt: string) => {
    setFurnitureList((prev) => prev.map((f) => (f.id === id ? { ...f, redesignRearrangePrompt: prompt } : f)))
  }

  const setStructuralItemCorrectedType = (id: string, userCorrectedType: string) => {
    setStructuralItemsToConfirm((prev) => prev.map((s) => (s.id === id ? { ...s, userCorrectedType } : s)))
  }

  const getEffectiveLayoutGuidance = () => {
    const parts: string[] = []
    if (layoutGuidance) parts.push(layoutGuidance)
    if (structuralItemsToConfirm.length > 0) {
      const userParts = structuralItemsToConfirm.map((s) => {
        const pos = s.position ? ` (${s.position})` : ''
        return `${s.item}${pos} là ${s.userCorrectedType}`
      })
      parts.push('Khách xác nhận: ' + userParts.join('. '))
    }
    return parts.join(' ')
  }

  const setAllItemsAction = (action: ItemAction) => {
    setFurnitureList((prev) => prev.map((f) => ({ ...f, action, redesignType: action === 'redesign' ? f.redesignType : undefined, redesignReplaceWith: action === 'redesign' ? f.redesignReplaceWith : undefined, redesignRearrangePrompt: action === 'redesign' ? f.redesignRearrangePrompt : undefined })))
  }

  const handleUndo = () => {
    const last = undoStack[undoStack.length - 1]
    if (!last) return
    setCurrentImageUrl(last.currentImageUrl)
    setImage({ file: null, preview: last.displayImage })
    setFurnitureList(last.furnitureList)
    setUndoStack((prev) => prev.slice(0, -1))
    toast({ title: tr('Đã quay lại', 'Went back', '已返回', '戻りました', '뒤로 이동됨'), duration: 1500 })
  }

  const saveDraft = () => {
    const draft = {
      currentImageUrl,
      imagePreview: displayImage,
      furnitureList,
      structuralItemsToConfirm,
      selectedStyle,
      selectedArchTheme,
      selectedMainColor,
      selectedSecondaryColor,
      addItemsPrompt,
      selectedFurnitureForAdd,
      spaceType,
      roomType,
      stagingRoomType,
      lighting,
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      toast({ title: tr('Đã lưu nháp', 'Draft saved', '草稿已保存', '下書きを保存しました', '초안이 저장되었습니다'), duration: 2000 })
    } catch {
      toast({ title: tr('Không lưu được', 'Save failed', '保存失败', '保存に失敗しました', '저장 실패'), variant: 'destructive' })
    }
  }

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) {
        toast({ title: tr('Chưa có nháp', 'No draft yet', '暂无草稿', '下書きがありません', '초안이 없습니다'), variant: 'destructive' })
        return
      }
      const draft = JSON.parse(raw)
      setCurrentImageUrl(draft.currentImageUrl || null)
      setImage({ file: null, preview: draft.imagePreview || null })
      setFurnitureList((draft.furnitureList || []).filter((f: { structural?: boolean }) => !f.structural))
      setStructuralItemsToConfirm(draft.structuralItemsToConfirm || [])
      setSelectedStyle(draft.selectedStyle || 'hiện đại')
      setSelectedArchTheme(draft.selectedArchTheme || '')
      setSelectedMainColor(draft.selectedMainColor || 'trắng')
      setSelectedSecondaryColor(draft.selectedSecondaryColor || '')
      setAddItemsPrompt(draft.addItemsPrompt || '')
      setSelectedFurnitureForAdd(normalizeFurnitureSelection(draft.selectedFurnitureForAdd))
      setSpaceType(draft.spaceType || 'interior')
      setRoomType(draft.roomType || '')
      setStagingRoomType(draft.stagingRoomType || '')
      setLighting(draft.lighting || '')
      setStep('EDITING')
      toast({ title: tr('Đã tải nháp', 'Draft loaded', '草稿已加载', '下書きを読み込みました', '초안 로드됨'), duration: 2000 })
    } catch {
      toast({ title: tr('Nháp không hợp lệ', 'Invalid draft', '草稿无效', '無効な下書きです', '잘못된 초안'), variant: 'destructive' })
    }
  }

  const exportPdf = async () => {
    if (!displayImage || !resultUrl) return
    try {
      const [beforeRes, afterRes] = await Promise.all([fetch(displayImage), fetch(resultUrl)])
      const [beforeBlob, afterBlob] = await Promise.all([beforeRes.blob(), afterRes.blob()])
      const beforeDataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.readAsDataURL(beforeBlob)
      })
      const afterDataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.readAsDataURL(afterBlob)
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const w = 140
      const h = 94
      pdf.addImage(beforeDataUrl, 'JPEG', 10, 20, w, h)
      pdf.addImage(afterDataUrl, 'JPEG', 150, 20, w, h)
      pdf.setFontSize(10)
      pdf.text(tr('Trước', 'Before', '之前', '前', '이전'), 10 + w / 2 - 5, 18)
      pdf.text(tr('Sau', 'After', '之后', '後', '이후'), 150 + w / 2 - 5, 18)
      pdf.save('thiet-ke-noi-ngoai-that.pdf')
      toast({ title: tr('Đã tải PDF', 'PDF downloaded', 'PDF已下载', 'PDFをダウンロードしました', 'PDF 다운로드됨'), duration: 2000 })
    } catch {
      toast({ title: tr('Xuất PDF thất bại', 'PDF export failed', 'PDF导出失败', 'PDFのエクスポートに失敗しました', 'PDF 내보내기 실패'), variant: 'destructive' })
    }
  }

  const copyShareLink = () => {
    if (!resultUrl) return
    navigator.clipboard.writeText(resultUrl)
    toast({ title: tr('Đã copy link', 'Link copied', '链接已复制', 'リンクをコピーしました', '링크 복사됨'), duration: 2000 })
  }

  const handleApplyFullRedesign = async () => {
    const img = image.file
    const url = currentImageUrl
    if (!img && !url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh để xử lý.', 'No image to process.', '没有可处理的图片。', '処理する画像がありません。', '처리할 이미지가 없습니다.'), variant: 'destructive' })
      return
    }
    if ((spaceType === 'interior' || spaceType === 'exterior-landscape') && furnitureStagingMode === 'custom' && Object.keys(selectedFurniture).length === 0) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chọn ít nhất 1 món đồ khi dùng "Khách chọn đồ".', 'Select at least 1 item when using "Custom selection".', '使用「自定义选择」时请至少选择1件物品。', '「カスタム選択」使用時は1つ以上選択してください。', '"맞춤 선택" 사용 시 최소 1개 이상 선택하세요.'), variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    await appendInteriorMainToFormData(formData, img, url)
    formData.append('mode', 'full')
    formData.append('imageQuality', imageQuality)
    formData.append('itemsToDelete', '[]')
    formData.append('itemsToReplace', '[]')
    formData.append('itemsToRearrange', '[]')
    formData.append('style', selectedStyle)
    formData.append('spaceType', spaceType)
    formData.append('archTheme', selectedArchTheme)
    formData.append('mainColor', selectedMainColor)
    formData.append('secondaryColor', selectedSecondaryColor)
    formData.append('addItemsPrompt', addItemsPrompt)
    formData.append('timeOfDay', timeOfDay)
    formData.append('roomType', stagingRoomType)
    formData.append('furnitureStagingMode', furnitureStagingMode)
    formData.append('customFurnitureSelection', JSON.stringify(Object.entries(selectedFurniture).map(([id, { material, color, style, position, shape, orientation }]) => ({ id, material, color, style, position, shape, orientation }))))
    formData.append('variantCount', String(variantCount))
    const effectiveLayout = getEffectiveLayoutGuidance()
    if (effectiveLayout) formData.append('layoutGuidance', effectiveLayout)
    await appendCompressedInteriorFile(formData, 'referenceImage', referenceImage?.file)
    try {
      const result = await timedApplyInteriorChanges(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('FULL_REDESIGN')
          toast({
            title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setResultUrls(interiorResultUrls(result, url))
          setStep('RESULT')
          refreshCredits()
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Đã làm mới không gian.', 'Space refreshed.', '空间已刷新。', '空間をリフレッシュしました。', '공간이 새로고침되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('FULL_REDESIGN')
          toast({
            title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (error) {
      setStep('FULL_REDESIGN')
      toast({
        title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
        description: error instanceof Error ? error.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleApply = async () => {
    const img = image.file
    const url = currentImageUrl
    if (!img && !url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh để xử lý.', 'No image to process.', '没有可处理的图片。', '処理する画像がありません。', '처리할 이미지가 없습니다.'), variant: 'destructive' })
      return
    }
    const toDelete = furnitureList.filter((f) => f.action === 'delete').map((f) => f.item)
    const toReplace = furnitureList.filter((f) => f.action === 'redesign' && f.redesignType === 'replace').map((f) => ({
      item: f.item,
      replaceWith: f.redesignReplaceWith?.trim() || '',
    }))
    const toRearrange = furnitureList.filter((f) => f.action === 'redesign' && f.redesignType === 'rearrange' && f.redesignRearrangePrompt?.trim()).map((f) => ({
      item: f.item,
      rearrangePrompt: f.redesignRearrangePrompt!.trim(),
    }))
    const redesignWithoutContent = furnitureList.filter((f) =>
      f.action === 'redesign' && (
        (f.redesignType === 'rearrange' && !f.redesignRearrangePrompt?.trim()) ||
        !f.redesignType
      )
    )
    if (redesignWithoutContent.length > 0) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chọn "Thay đổi kiểu sắp xếp" và nhập nội dung cho món đã chọn.', 'Select "Rearrange" and enter content for the selected item.', '选择「重新排列」并为所选项目输入内容。', '「配置変更」を選択し、選択した項目の内容を入力してください。', '"배치 변경"을 선택하고 선택한 항목의 내용을 입력하세요.'), variant: 'destructive' })
      return
    }
    const hasAddFromList = Object.keys(selectedFurnitureForAdd).length > 0
    const needsEdit = toDelete.length > 0 || toReplace.length > 0 || toRearrange.length > 0 || addItemsPrompt || hasAddFromList || (spaceType === 'interior' && stagingRoomType)
    if (!needsEdit) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chọn ít nhất một món để xóa/thay đổi, thêm đồ từ danh sách, nhập thêm đồ, hoặc chọn mẫu staging.', 'Select at least one item to delete/change, add from list, enter additional items, or choose staging template.', '请至少选择一项删除/更改、从列表添加、输入额外物品或选择布置模板。', '削除/変更、リストから追加、追加入力、またはステージングテンプレートを選択してください。', '삭제/변경, 목록에서 추가, 추가 입력 또는 스테이징 템플릿을 선택하세요.'), variant: 'destructive' })
      return
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    await appendInteriorMainToFormData(formData, img, url)
    formData.append('imageQuality', imageQuality)
    formData.append('mode', 'edit')
    formData.append('itemsToDelete', JSON.stringify(toDelete))
    formData.append('itemsToReplace', JSON.stringify(toReplace))
    formData.append('itemsToRearrange', JSON.stringify(toRearrange))
    formData.append('style', selectedStyle)
    formData.append('spaceType', spaceType)
    formData.append('archTheme', selectedArchTheme)
    formData.append('mainColor', selectedMainColor)
    formData.append('secondaryColor', selectedSecondaryColor)
    formData.append('addItemsPrompt', addItemsPrompt)
    formData.append('customFurnitureForAdd', JSON.stringify(Object.entries(selectedFurnitureForAdd).map(([id, { material, color, style, position, shape, orientation }]) => ({ id, material, color, style, position, shape, orientation }))))
    formData.append('timeOfDay', timeOfDay)
    formData.append('roomType', stagingRoomType)
    formData.append('variantCount', String(variantCount))
    const effectiveLayout = getEffectiveLayoutGuidance()
    if (effectiveLayout) formData.append('layoutGuidance', effectiveLayout)
    await appendCompressedInteriorFile(formData, 'referenceImage', referenceImage?.file)
    try {
      const result = await timedApplyInteriorChanges(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setResultUrls(interiorResultUrls(result, url))
          setStep('RESULT')
          refreshCredits()
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Đã áp dụng thay đổi.', 'Changes have been applied.', '更改已应用。', '変更を適用しました。', '변경이 적용되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({
        title: tr('Xử lý thất bại', 'Processing failed', '处理失败', '処理に失敗しました', '처리 실패'),
        description: error instanceof Error ? error.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const hasRotationReference = !!rotationReferenceImage

  const handleRotate = async (direction: 'left' | 'right' | 'up' | 'down', imageOverride?: string) => {
    const img = image.file
    const url = imageOverride ?? currentImageUrl
    if (!img && !url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh để quay.', 'No image to rotate.', '没有可旋转的图片。', '回転する画像がありません。', '회전할 이미지가 없습니다.'), variant: 'destructive' })
      return
    }
    if (!hasRotationReference) {
      toast({ title: tr('Bắt buộc có ảnh tham chiếu', 'Reference image required', '需要参考图片', '参照画像が必要です', '참조 이미지 필요'), description: tr('Ảnh chính đang hiển thị. Chọn ảnh tham chiếu để bổ trợ kết cấu.', 'Main image is displayed. Select reference image for texture support.', '主图已显示。选择参考图片以辅助纹理。', 'メイン画像を表示中。テクスチャ補助のため参照画像を選択してください。', '메인 이미지가 표시됩니다. 텍스처 보조를 위해 참조 이미지를 선택하세요.'), variant: 'destructive' })
      return
    }
    if (imageOverride) {
      setCurrentImageUrl(imageOverride)
      setImage({ file: null, preview: null })
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage || imageOverride!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    await appendInteriorMainToFormData(formData, img, url)
    formData.append('imageQuality', imageQuality)
    formData.append('itemsToDelete', '[]')
    formData.append('itemsToRedesign', '[]')
    formData.append('style', selectedStyle)
    formData.append('spaceType', spaceType)
    formData.append('archTheme', selectedArchTheme)
    formData.append('mainColor', selectedMainColor)
    formData.append('secondaryColor', selectedSecondaryColor)
    formData.append('addItemsPrompt', '')
    formData.append('timeOfDay', '')
    formData.append('roomType', '')
    formData.append('variantCount', '1')
    formData.append('rotationDirection', direction)
    const effectiveLayout = getEffectiveLayoutGuidance()
    if (effectiveLayout) formData.append('layoutGuidance', effectiveLayout)
    await appendCompressedInteriorFile(formData, 'rotationReferenceImage', rotationReferenceImage?.file)
    try {
      const result = await timedApplyInteriorChanges(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Quay thất bại', 'Rotation failed', '旋转失败', '回転に失敗しました', '회전 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setResultUrls(interiorResultUrls(result, url))
          setRotationHistory((prev) => (prev.length === 0 ? [displayImage || currentImageUrl || '', url] : [...prev, url]))
          setRotationHistoryIndex((prev) => (prev === 0 ? 1 : prev + 1))
          setStep('RESULT')
          refreshCredits()
          const dirLabel = { left: tr('trái', 'left', '左', '左', '왼쪽'), right: tr('phải', 'right', '右', '右', '오른쪽'), up: tr('lên', 'up', '上', '上', '위'), down: tr('xuống', 'down', '下', '下', '아래') }[direction]
          toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Đã quay 30°', 'Rotated 30°', '已旋转30°', '30°回転しました', '30° 회전됨') + ` ${dirLabel}.`, duration: 3000 })
        },
        onUnexpectedPayload: () => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Quay thất bại', 'Rotation failed', '旋转失败', '回転に失敗しました', '회전 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({
        title: tr('Quay thất bại', 'Rotation failed', '旋转失败', '回転に失敗しました', '회전 실패'),
        description: error instanceof Error ? error.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleExpandExteriorDown = async (imageOverride?: string) => {
    const img = image.file
    const url = imageOverride ?? currentImageUrl
    if (!img && !url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh để mở rộng.', 'No image to expand.', '没有可扩展的图片。', '拡張する画像がありません。', '확장할 이미지가 없습니다.'), variant: 'destructive' })
      return
    }
    if (spaceType !== 'exterior-landscape') {
      toast({ title: tr('Chỉ sân vườn', 'Garden only', '仅限花园', '庭園のみ', '정원만'), description: tr('Mở rộng sân vườn chỉ dùng cho chế độ Sân vườn.', 'Expand garden is only for Garden mode.', '花园扩展仅适用于花园模式。', '庭園拡張は庭園モード専用です。', '정원 확장은 정원 모드 전용입니다.'), variant: 'destructive' })
      return
    }
    if (imageOverride) {
      setCurrentImageUrl(imageOverride)
      setImage({ file: null, preview: null })
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage || imageOverride!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    await appendInteriorMainToFormData(formData, img, url)
    formData.append('imageQuality', imageQuality)
    formData.append('itemsToDelete', '[]')
    formData.append('itemsToRedesign', '[]')
    formData.append('style', selectedStyle)
    formData.append('spaceType', spaceType)
    formData.append('archTheme', selectedArchTheme)
    formData.append('mainColor', selectedMainColor)
    formData.append('secondaryColor', selectedSecondaryColor)
    formData.append('addItemsPrompt', addItemsPrompt)
    formData.append('timeOfDay', '')
    formData.append('roomType', '')
    formData.append('variantCount', '1')
    formData.append('expandExteriorDown', '1')
    const effectiveLayout = getEffectiveLayoutGuidance()
    if (effectiveLayout) formData.append('layoutGuidance', effectiveLayout)
    try {
      const result = await timedApplyInteriorChanges(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Mở rộng thất bại', 'Expand failed', '扩展失败', '拡張に失敗しました', '확장 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setResultUrl(url)
          setResultUrls(interiorResultUrls(result, url))
          setStep('RESULT')
          refreshCredits()
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Đã mở rộng sân vườn.', 'Garden expanded.', '花园已扩展。', '庭園を拡張しました。', '정원이 확장되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('EDITING')
          setUndoStack((prev) => prev.slice(0, -1))
          toast({
            title: tr('Mở rộng thất bại', 'Expand failed', '扩展失败', '拡張に失敗しました', '확장 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({
        title: tr('Mở rộng thất bại', 'Expand failed', '扩展失败', '拡張に失敗しました', '확장 실패'),
        description: error instanceof Error ? error.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleContinueEdit = async (url?: string) => {
    const target = url || resultUrl
    if (!target) return
    const isOldImage = url === displayImage
    const savedState = undoStack[undoStack.length - 1]
    setCurrentImageUrl(target)
    if (!target.startsWith('blob:') || !image.file) {
      setImage({ file: null, preview: null })
    }
    setRotationHistory([])
    setRotationHistoryIndex(0)
    setRotationReferenceImage(null)
    setResultUrl(null)
    setResultUrls([])
    setAddItemsPrompt('')
    if (isOldImage && savedState?.furnitureList?.length) {
      setFurnitureList(savedState.furnitureList.map((f) => ({
        ...f,
        action: 'keep' as ItemAction,
        redesignType: undefined,
        redesignReplaceWith: undefined,
        redesignRearrangePrompt: undefined,
      })))
    } else {
      setFurnitureList([])
    }
    setStep('FULL_REDESIGN')
  }

  const handleReanalyzeWithUrl = async (url: string, fallbackStep: Step = 'EDITING') => {
    setStep('ANALYZING')
    try {
      const res = await fetch(url)
      if (!res.ok) {
        setStep(fallbackStep)
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không tải được ảnh.', 'Could not load image.', '无法加载图片。', '画像を読み込めませんでした。', '이미지를 불러올 수 없습니다.'), variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const file = new File([blob], 'image.png', { type: blob.type || 'image/png' })
      const formData = new FormData()
      formData.append('image', await compressInteriorImageForAi(file, { imageQuality }))
      const result = (await Promise.race([
        analyzeInterior(formData),
        new Promise<{ error: string }>((resolve) => {
          setTimeout(() => {
            resolve({
              error: tr(
                'Hết thời gian chờ phân tích (5 phút). Vui lòng thử lại.',
                'Analysis timed out after 5 minutes. Please try again.',
                '分析等待超时（5分钟），请重试。',
                '分析がタイムアウトしました（5分）。再試行してください。',
                '분석 대기 시간이 초과되었습니다(5분). 다시 시도해 주세요.'
              ),
            })
          }, 300_000)
        }),
      ])) as Awaited<ReturnType<typeof analyzeInterior>> | { error: string }
      if ('error' in result) {
        setStep(fallbackStep)
        toast({ title: tr('Phân tích thất bại', 'Analysis failed', '分析失败', '分析に失敗しました', '분석 실패'), description: result.error, variant: 'destructive', duration: 5000 })
      } else if (result.success && result.analysis) {
        try {
          const parsed = JSON.parse(result.analysis)
          const objs = parsed?.objects || []
          const type = (parsed?.type || 'interior').toLowerCase()
          const dominant = (parsed?.dominantColor || '').trim()
          setSpaceType(type === 'exterior-landscape' ? 'exterior-landscape' : type === 'exterior-facade' || type === 'exterior' ? 'exterior-facade' : 'interior')
          setDetectedDominantColor(dominant)
          setRoomType((parsed?.roomType || '').trim())
          setLighting((parsed?.lighting || '').trim())
          setFengShuiSuggestion((parsed?.fengShuiSuggestion || '').trim())
          setLayoutGuidance((parsed?.layoutGuidance || '').trim())
          const colorKey = Object.keys(MAIN_COLORS).find((k) => k.toLowerCase() === dominant.toLowerCase()) || 'trắng'
          setSelectedMainColor(colorKey)
          setSelectedArchTheme(type === 'exterior-facade' || type === 'exterior' ? 'việt nam' : '')
          setFurnitureList(objs
            .filter((o: { structural?: boolean }) => !o.structural)
            .map((o: { item?: string; color?: string; material?: string; status?: string; position?: string }, i: number) => ({
              id: `item-${i}-${Date.now()}`,
              item: o.item || '—',
              color: o.color,
              material: o.material,
              status: o.status,
              position: o.position,
              action: 'keep' as ItemAction,
            })))
          const structObjs = objs.filter((o: { structural?: boolean }) => o.structural) as { item?: string; position?: string }[]
          const structToConfirm: StructuralItemToConfirm[] = []
          structObjs.forEach((o: { item?: string; position?: string }, i: number) => {
            const cat = getStructuralCategory(o.item || '')
            if (cat) {
              const opts = cat === 'door' ? DOOR_TYPE_OPTIONS : cat === 'window' ? WINDOW_TYPE_OPTIONS : WALL_TYPE_OPTIONS
              const aiItem = o.item || '—'
              const matchOpt = opts.find((opt) => opt.value.toLowerCase() === aiItem.toLowerCase())
              structToConfirm.push({
                id: `struct-${i}-${Date.now()}`,
                item: aiItem,
                position: o.position,
                category: cat,
                userCorrectedType: matchOpt ? matchOpt.value : getDefaultOption(aiItem, cat),
              })
            }
          })
          setStructuralItemsToConfirm(structToConfirm)
          setStep('EDITING')
          toast({ title: tr('Đã phân tích lại!', 'Re-analyzed!', '已重新分析！', '再分析しました！', '재분석 완료!'), duration: 2000 })
        } catch {
          setStep(fallbackStep)
          toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không parse được kết quả.', 'Could not parse result.', '无法解析结果。', '結果を解析できませんでした。', '결과를 파싱할 수 없습니다.'), variant: 'destructive' })
        }
      }
    } catch (error) {
      setStep(fallbackStep)
      const msg = error instanceof Error ? error.message : String(error)
      toast({
        title: tr('Phân tích thất bại', 'Analysis failed', '分析失败', '分析に失敗しました', '분석 실패'),
        description: msg || tr('Lỗi kết nối tới máy chủ.', 'Connection error to server.', '连接服务器失败。', 'サーバー接続エラー。', '서버 연결 오류입니다.'),
        variant: 'destructive',
        duration: 5000,
      })
    }
  }

  const handleReanalyze = async (fallbackStep: Step = 'EDITING') => {
    const url = currentImageUrl || (resultUrl ?? undefined)
    if (!url) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không có ảnh để phân tích lại.', 'No image to re-analyze.', '没有可重新分析的图片。', '再分析する画像がありません。', '재분석할 이미지가 없습니다.'), variant: 'destructive' })
      return
    }
    await handleReanalyzeWithUrl(url, fallbackStep)
  }

  const handleReset = () => {
    setStep('UPLOAD')
    setImage({ file: null, preview: null })
    setCurrentImageUrl(null)
    setFurnitureList([])
    setResultUrl(null)
    setResultUrls([])
    setAddItemsPrompt('')
    setSpaceType('interior')
    setDetectedDominantColor('')
    setSelectedArchTheme('')
    setSelectedMainColor('')
    setSelectedSecondaryColor('')
    setRoomType('')
    setLighting('')
    setFengShuiSuggestion('')
    setLayoutGuidance('')
    setStructuralItemsToConfirm([])
    setTimeOfDay('')
    setStagingRoomType('')
    setFurnitureStagingMode('ai')
    setSelectedFurniture({})
    setSelectedFurnitureForAdd({})
    setFurnitureToAddId('')
    setFurnitureToAddIdEdit('')
    setVariantCount(1)
    setReferenceImage(null)
    setRotationReferenceImage(null)
    setRotationHistory([])
    setRotationHistoryIndex(0)
    setUndoStack([])
  }

  const getImageForApply = (): File | string | null => {
    if (currentImageUrl) return currentImageUrl
    if (image.file) return image.file
    return null
  }

  const stepLabels: Record<Step, string> = {
    UPLOAD: tr('1. Tải ảnh', '1. Upload image', '1. 上传图片', '1. 画像をアップロード', '1. 이미지 업로드'),
    FULL_REDESIGN: tr('2. Chọn style', '2. Choose style', '2. 选择风格', '2. スタイルを選択', '2. 스타일 선택'),
    ANALYZING: tr('Đang phân tích', 'Analyzing', '分析中', '分析中', '분석 중'),
    EDITING: tr('3. Chỉnh sửa', '3. Edit', '3. 编辑', '3. 編集', '3. 편집'),
    GENERATING: tr('Đang xử lý', 'Processing', '处理中', '処理中', '처리 중'),
    RESULT: tr('Kết quả', 'Result', '结果', '結果', '결과'),
  }

  return (
    <>
      <Toaster />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
              <LayoutGrid className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{tr('Thiết kế nội thất & ngoại thất', 'Interior & Exterior Design', '室内外设计', 'インテリア・外観デザイン', '실내외 디자인')}</h1>
              <p className="text-xs text-muted-foreground">{tr('Làm mới toàn bộ • Sửa từng món • Virtual Staging', 'Full refresh • Edit items • Virtual Staging', '全面刷新 • 逐项编辑 • 虚拟布置', '全面リフレッシュ • 個別編集 • バーチャルステージング', '전체 새로고침 • 개별 편집 • 가상 스테이징')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {stepLabels[step]}
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-medium">
              <span className="text-muted-foreground">Credits</span>
              <span className="text-emerald-600">{credits.toFixed(1)}</span>
            </div>
            <DepositCreditButton variant="outline" size="sm" className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50" />
          </div>
        </header>

        {step === 'UPLOAD' && (
          <div className="space-y-4">
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Upload className="h-4 w-4 text-emerald-600" /> {tr('Ảnh phòng', 'Room image', '房间图片', '部屋画像', '방 이미지')}
                </CardTitle>
                <CardDescription className="text-xs">{tr('Tải lên hoặc dán link ảnh không gian cần thiết kế', 'Upload or paste link of space image to design', '上传或粘贴需要设计的空间图片链接', 'デザインする空間画像をアップロードまたはURL貼り付け', '설계할 공간 이미지 업로드 또는 링크 붙여넣기')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <label
                  htmlFor="interior-input"
                  className="block w-full aspect-[4/3] max-h-[400px] rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors"
                >
                  {image.preview ? (
                    <ImagePreview src={image.preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <>
                      <Upload className="h-12 w-12 text-emerald-500" />
                      <p className="text-sm text-muted-foreground font-medium">{tr('Chọn ảnh không gian cần thiết kế', 'Select space image to design', '选择需要设计的空间图片', 'デザインする空間画像を選択', '설계할 공간 이미지 선택')}</p>
                    </>
                  )}
                </label>
                <input id="interior-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <div className="flex gap-2">
                  <Input placeholder={tr('Dán link ảnh rồi bấm Lấy ảnh', 'Paste image URL then click Fetch', '粘贴图片链接后点击获取', '画像URLを貼り付けて取得をクリック', '이미지 링크 붙여넣기 후 가져오기 클릭')} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? tr('Đang tải...', 'Loading...', '加载中...', '読み込み中...', '불러오는 중...') : tr('Lấy ảnh', 'Fetch image', '获取图片', '画像を取得', '이미지 가져오기')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{tr('Chọn chế độ', 'Choose mode', '选择模式', 'モードを選択', '모드 선택')}</CardTitle>
                <CardDescription className="text-xs">{tr('Làm mới toàn bộ (chọn style/màu) hoặc Sửa từng món (phân tích 0,5 credit trước)', 'Full refresh (choose style/color) or Edit items (0.5 credit analysis first)', '全面刷新（选择风格/颜色）或逐项编辑（先 0.5 积分分析）', '全面リフレッシュ（スタイル/色選択）または個別編集（0.5クレジット分析後）', '전체 새로고침(스타일/색상 선택) 또는 개별 편집(0.5 크레딧 분석 먼저)')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-2 items-center">
                <Button onClick={handleFullRedesign} disabled={!image.file} className="h-9 text-sm bg-sky-600 hover:bg-sky-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Làm mới toàn bộ', 'Full refresh', '全面刷新', '全面リフレッシュ', '전체 새로고침')}
                </Button>
                <Button onClick={() => checkCreditsAndProceed(ANALYZE_CREDIT, handleAnalyze)} disabled={!image.file} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Scan className="mr-2 h-4 w-4" /> {tr('Sửa từng món (0,5 credit)', 'Edit items (0.5 credit)', '逐项编辑（0.5 积分）', '個別編集（0.5クレジット）', '개별 편집 (0.5 크레딧)')}
                </Button>
                <Button onClick={handleReset} variant="outline" className="h-9 text-sm border-slate-300">
                  <ImagePlus className="mr-2 h-4 w-4" /> {tr('Bắt đầu mới', 'Start over', '重新开始', '最初から', '처음부터')}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'FULL_REDESIGN' && (
          <div className="space-y-4">
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{tr('Thiết lập thiết kế', 'Design settings', '设计设置', 'デザイン設定', '디자인 설정')}</CardTitle>
                <CardDescription className="text-xs">{tr('Chọn phong cách, màu sắc, mẫu. Xem lại rồi bấm nút bên dưới.', 'Choose style, colors, samples. Review then click button below.', '选择风格、颜色、样本。查看后点击下方按钮。', 'スタイル、色、サンプルを選択。確認して下のボタンをクリック。', '스타일, 색상, 샘플 선택. 확인 후 아래 버튼 클릭.')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {displayImage && (
                  <div className="aspect-video max-h-[280px] rounded-lg border overflow-hidden">
                    <ImagePreview src={displayImage} alt={tr('Ảnh', 'Image', '图片', '画像', '이미지')} className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Loại không gian', 'Space type', '空间类型', '空間タイプ', '공간 유형')}</label>
                    <div className="flex flex-col sm:flex-row gap-1">
                      <button type="button" onClick={() => setSpaceType('interior')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'interior' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <Home className="inline h-3 w-3 mr-1" /> {tr('Nội thất', 'Interior', '室内', 'インテリア', '실내')}
                      </button>
                      <button type="button" onClick={() => setSpaceType('exterior-facade')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'exterior-facade' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <Building2 className="inline h-3 w-3 mr-1" /> {tr('Thay áo cho nhà', 'Facade redesign', '建筑立面改造', '外観リデザイン', '외관 리디자인')}
                      </button>
                      <button type="button" onClick={() => setSpaceType('exterior-landscape')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'exterior-landscape' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`} title={tr('Sân kết hợp với vườn', 'Garden with yard', '庭院花园', '庭と庭園', '정원과 마당')}>
                        <LayoutGrid className="inline h-3 w-3 mr-1" /> {tr('Sân vườn', 'Garden', '花园', '庭園', '정원')}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}</label>
                    <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      {stylesFromConstants.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Màu chính', 'Main color', '主色', 'メインカラー', '메인 색상')}</label>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Màu phụ', 'Secondary color', '辅色', 'サブカラー', '보조 색상')}</label>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      <option value="">— {tr('Không', 'None', '无', 'なし', '없음')} —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {spaceType === 'exterior-facade' && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Chủ đề kiến trúc', 'Architecture theme', '建筑主题', '建築テーマ', '건축 테마')}</label>
                      <select value={selectedArchTheme} onChange={(e) => setSelectedArchTheme(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                        {Object.entries(ARCH_THEMES).map(([k]) => (
                          <option key={k} value={k}>{getArchThemeLabel(k, uiLocale)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Thời gian', 'Time of day', '时间', '時間帯', '시간대')}</label>
                    <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      <option value="">{tr('Mặc định', 'Default', '默认', 'デフォルト', '기본')}</option>
                      <option value="ban-ngay">{tr('Ban ngày', 'Daytime', '白天', '日中', '낮')}</option>
                      <option value="hoang-hon">{tr('Hoàng hôn', 'Sunset', '黄昏', '夕暮れ', '석양')}</option>
                      <option value="dem">{tr('Đêm', 'Night', '夜晚', '夜', '밤')}</option>
                    </select>
                  </div>
                  {spaceType === 'interior' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Loại phòng (staging)', 'Room type (staging)', '房间类型（布置）', '部屋タイプ（ステージング）', '방 유형 (스테이징)')}</label>
                      <select value={stagingRoomType} onChange={(e) => setStagingRoomType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                        {ROOM_TYPES.map((t) => (
                          <option key={t.value || 'none'} value={t.value}>{getRoomTypeLabel(t.value, uiLocale)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && (
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-muted-foreground">{spaceType === 'interior' ? tr('Chọn đồ nội thất', 'Select furniture', '选择家具', '家具を選択', '가구 선택') : tr('Chọn đồ sân vườn', 'Select garden items', '选择花园物品', '庭園アイテムを選択', '정원 아이템 선택')}</label>
                    <div className="flex gap-2">
                      {FURNITURE_STAGING_MODES.map((m) => (
                        <button key={m.value} type="button" onClick={() => setFurnitureStagingMode(m.value as 'ai' | 'custom')} className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${furnitureStagingMode === m.value ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                          {getOptionLabel(m, uiLocale)}
                        </button>
                      ))}
                    </div>
                    {furnitureStagingMode === 'custom' && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">{tr('Chọn món từ danh sách thả xuống, thêm vào danh mục. Chất liệu và màu để "— AI chọn —" nếu không chỉ định.', 'Select items from dropdown, add to list. Leave material/color as "— AI choose —" if unspecified.', '从下拉列表选择物品并添加。如未指定，材质和颜色留为「— AI选择 —」。', 'ドロップダウンから選択して追加。未指定の場合は材質・色は「— AI選択 —」のまま。', '드롭다운에서 선택해 추가. 미지정 시 재질/색상은 "— AI 선택 —" 유지.')}</p>
                        <div className="flex gap-2">
                          <select value={furnitureToAddId} onChange={(e) => setFurnitureToAddId(e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                            <option value="">— {tr('Chọn món cần thêm', 'Select item to add', '选择要添加的物品', '追加するアイテムを選択', '추가할 항목 선택')} —</option>
                            {(() => {
                              const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                              return Array.from(new Set(itemsList.map((f) => f.category))).map((cat) => {
                                const items = itemsList.filter((f) => f.category === cat && !(f.id in selectedFurniture))
                                if (items.length === 0) return null
                                return (
                                  <optgroup key={cat} label={getFurnitureCategoryLabel(cat, uiLocale)}>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>{getFurnitureItemLabel(item, uiLocale)}</option>
                                    ))}
                                  </optgroup>
                                )
                              })
                            })()}
                          </select>
                          <Button type="button" variant="outline" size="sm" onClick={() => {
                            const idToAdd = furnitureToAddId
                            if (idToAdd) {
                              setSelectedFurniture((prev) => {
                                const next: Record<string, FurnitureSelection> = {}
                                for (const [k, v] of Object.entries(prev)) {
                                  next[k] = { material: v.material ?? '', color: v.color ?? '', style: v.style ?? '', position: v.position ?? '', shape: v.shape ?? '', orientation: v.orientation ?? '' }
                                }
                                next[idToAdd] = { material: '', color: '', style: '', position: '', shape: '', orientation: '' }
                                return next
                              })
                              setFurnitureToAddId('')
                            }
                          }} disabled={!furnitureToAddId} className="shrink-0">{tr('Thêm', 'Add', '添加', '追加', '추가')}</Button>
                        </div>
                        {Object.keys(selectedFurniture).length > 0 && (
                          <div className="rounded-lg border border-slate-200 p-2 space-y-2">
                            <p className="text-[11px] font-medium text-slate-600">{tr('Danh mục sản phẩm cần thêm', 'Items to add', '待添加物品', '追加するアイテム', '추가할 항목')}</p>
                            {Object.entries(selectedFurniture).map(([id, val]) => {
                              const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                              const item = itemsList.find((f) => f.id === id)
                              const selType = (item as { selectionType?: string })?.selectionType ?? 'material'
                              const material = val?.material ?? ''
                              const color = val?.color ?? ''
                              const style = val?.style ?? ''
                              const position = val?.position ?? ''
                              const shape = val?.shape ?? ''
                              const orientation = val?.orientation ?? ''
                              const def = { material: '', color: '', style: '', position: '', shape: '', orientation: '' }
                              return (
                                <div key={id} className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 rounded px-2 py-1.5">
                                  <span className="font-medium min-w-[100px]">{item ? getFurnitureItemLabel(item, uiLocale) : id}</span>
                                  {spaceType === 'exterior-landscape' && (
                                    <select value={position} onChange={(e) => setSelectedFurniture((s) => {
                                      const cur = s[id] || def
                                      return { ...s, [id]: { ...cur, position: e.target.value } }
                                    })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[110px]" title={tr('Vị trí', 'Position', '位置', '位置', '위치')}>
                                      {EXTERIOR_POSITION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                                    </select>
                                  )}
                                  {id === 'be-boi' && (
                                    <>
                                      <select value={shape} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, shape: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[100px]" title={tr('Hình dạng', 'Shape', '形状', '形状', '형태')}>
                                        {POOL_SHAPE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                                      </select>
                                      <select value={orientation} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, orientation: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[100px]" title={tr('Hướng', 'Orientation', '朝向', '向き', '방향')}>
                                        {POOL_ORIENTATION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                                      </select>
                                    </>
                                  )}
                                  {selType === 'material' && (
                                    <>
                                      <select value={material} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, material: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[120px]" title={tr('Chất liệu', 'Material', '材质', '素材', '재질')}>
                                        {FURNITURE_MATERIALS.map((m) => <option key={m.value || 'n'} value={m.value}>{getOptionLabel(m, uiLocale)}</option>)}
                                      </select>
                                      <select value={color} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, color: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[110px]" title={tr('Màu', 'Color', '颜色', '色', '색상')}>
                                        {FURNITURE_COLORS.map((c) => <option key={c.value || 'n'} value={c.value}>{getOptionLabel(c, uiLocale)}</option>)}
                                      </select>
                                    </>
                                  )}
                                  {selType === 'style' && (
                                    <select value={style} onChange={(e) => setSelectedFurniture((s) => {
                                      const cur = s[id] || def
                                      return { ...s, [id]: { ...cur, style: e.target.value } }
                                    })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[130px]" title={tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}>
                                      {FURNITURE_STYLE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                                    </select>
                                  )}
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-600" title={tr('Xóa', 'Remove', '删除', '削除', '삭제')} aria-label={tr('Xóa', 'Remove', '删除', '削除', '삭제')} onClick={() => setSelectedFurniture((s) => { const n = { ...s }; delete n[id]; return n })}>×</Button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Thêm đồ (tùy chọn)', 'Add items (optional)', '添加物品（可选）', 'アイテム追加（任意）', '아이템 추가 (선택)')}</label>
                    <Input placeholder={tr('VD: thêm bộ sofa màu xám', 'e.g. add gray sofa set', '例如：添加灰色沙发套装', '例：グレーのソファセットを追加', '예: 회색 소파 세트 추가')} value={addItemsPrompt} onChange={(e) => setAddItemsPrompt(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh tham khảo', 'Reference image', '参考图片', '参照画像', '참조 이미지')}</label>
                    <div className="flex gap-2 items-center">
                      <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                      }} />
                      <Button type="button" variant="outline" size="sm" onClick={() => referenceInputRef.current?.click()} className="h-9 shrink-0">
                        <ImagePlus className="h-4 w-4 mr-1" /> {tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}
                      </Button>
                      {referenceImage && (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded border overflow-hidden shrink-0">
                            <img src={referenceImage.preview} alt="Ref" className="w-full h-full object-cover" />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setReferenceImage(null)} className="h-8 text-xs">{tr('Xóa', 'Remove', '删除', '削除', '삭제')}</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{tr('Thao tác chính', 'Main actions', '主要操作', 'メイン操作', '주요 작업')}</CardTitle>
                <CardDescription className="text-xs">{tr('Chất lượng', 'Quality', '质量', '画質', '화질')} {imageQuality} • {tr('Phiên bản', 'Variants', '版本', 'バリアント', '버전')} {variantCount} • {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">{tr('Chất lượng', 'Quality', '质量', '画質', '화질')}:</span>
                  <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '2K' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>2K</button>
                  <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '4K' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>4K</button>
                  <span className="text-xs font-medium text-muted-foreground ml-2">{tr('Phiên bản', 'Variants', '版本', 'バリアント', '버전')}:</span>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 hover:bg-slate-200'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                <Button onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality] * variantCount, handleApplyFullRedesign)} disabled={!displayImage} className="h-9 text-sm bg-sky-600 hover:bg-sky-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Làm mới', 'Refresh', '刷新', 'リフレッシュ', '새로고침')} ({(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit)
                </Button>
                <Button onClick={() => furnitureList.length ? setStep('EDITING') : (image.file ? checkCreditsAndProceed(ANALYZE_CREDIT, handleAnalyze) : checkCreditsAndProceed(ANALYZE_CREDIT, () => handleReanalyze('FULL_REDESIGN')))} disabled={!displayImage} variant="outline" className="h-9 text-sm">
                  <Scan className="mr-2 h-4 w-4" /> {tr('Sửa từng món', 'Edit items', '逐项编辑', '個別編集', '개별 편집')}{furnitureList.length ? '' : ` (0,5 credit)`}
                </Button>
                <Button onClick={handleReset} variant="outline" className="h-9 text-sm border-slate-300">
                  <ImagePlus className="mr-2 h-4 w-4" /> {tr('Bắt đầu mới', 'Start over', '重新开始', '最初から', '처음부터')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStep('UPLOAD')}>{tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'ANALYZING' && (
          <Card className="border border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="interior" title={tr('Đang phân tích nội thất', 'Analyzing interior', '正在分析室内', 'インテリア分析中', '실내 분석 중')} description={tr('AI đang đọc đồ đạc, chất liệu...', 'AI is reading furniture, materials...', 'AI正在识别家具、材质...', 'AIが家具・材質を読み取っています...', 'AI가 가구, 재질을 읽는 중...')} imagePreview={displayImage} />
            </CardContent>
          </Card>
        )}

        {step === 'EDITING' && (
          <div className="space-y-4">
          <div className="grid lg:grid-cols-[1fr_280px] gap-4 items-start">
            <div className="space-y-4">
              <Card className="border border-slate-200/80 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="text-sm font-medium">{tr('Ảnh chính', 'Main image', '主图', 'メイン画像', '메인 이미지')}</CardTitle>
                      <CardDescription className="text-xs">{tr('Chọn từng món: Giữ nguyên | Thay đổi | Xóa', 'Per item: Keep | Change | Delete', '逐项：保留 | 更改 | 删除', '項目ごと：保持 | 変更 | 削除', '항목별: 유지 | 변경 | 삭제')}</CardDescription>
                      {(roomType || lighting) && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {roomType && `${tr('Loại', 'Type', '类型', 'タイプ', '유형')}: ${roomType}`} {lighting && ` | ${tr('Ánh sáng', 'Lighting', '光照', '照明', '조명')}: ${lighting}`}
                        </p>
                      )}
                      {fengShuiSuggestion && (
                        <p className="text-[10px] text-amber-700 mt-1 bg-amber-50/80 px-2 py-1 rounded">{tr('Phong thủy', 'Feng shui', '风水', '風水', '풍수')}: {fengShuiSuggestion}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${spaceType !== 'interior' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                      {spaceType === 'interior' ? <><Home className="inline h-3 w-3 mr-1" /> {tr('Nội thất', 'Interior', '室内', 'インテリア', '실내')}</> : spaceType === 'exterior-facade' ? <><Building2 className="inline h-3 w-3 mr-1" /> {tr('Thay áo cho nhà', 'Facade redesign', '建筑立面改造', '外観リデザイン', '외관 리디자인')}</> : <><LayoutGrid className="inline h-3 w-3 mr-1" /> {tr('Sân vườn', 'Garden', '花园', '庭園', '정원')}</>}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {displayImage && (
                    <div className="aspect-video rounded-lg border overflow-hidden">
                      <ImagePreview src={displayImage} alt={tr('Ảnh', 'Image', '图片', '画像', '이미지')} className="w-full h-full object-contain" />
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><RotateCcw className="h-3 w-3" /> {tr('Quay góc 30°', 'Rotate 30°', '旋转30°', '30°回転', '30° 회전')}</h4>
                <p className="text-[10px] text-muted-foreground">{tr('Ảnh chính = mức hoàn thiện áp dụng đầy đủ. Ảnh tham chiếu = bổ trợ kết cấu. Kết quả giữ mức hoàn thiện như ảnh chính. Mỗi lần quay:', 'Main image = full finish. Reference = texture support. Result keeps main image finish. Per rotation:', '主图=完整效果。参考图=纹理辅助。结果保持主图效果。每次旋转：', 'メイン画像=仕上げ。参照=テクスチャ補助。結果はメイン画像の仕上げを維持。回転ごと：', '메인 이미지=완성도. 참조=텍스처 보조. 결과는 메인 이미지 완성도 유지. 회전당:')} {APPLY_COSTS[imageQuality]} credit.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input ref={rotationRefInputRef} type="file" accept="image/*" className="hidden" id="rotation-ref-input" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setRotationReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                    }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => rotationRefInputRef.current?.click()} className="shrink-0">
                      <ImagePlus className="h-4 w-4 mr-1" /> {tr('Ảnh tham chiếu (bổ trợ kết cấu)', 'Reference image (texture support)', '参考图（纹理辅助）', '参照画像（テクスチャ補助）', '참조 이미지 (텍스처 보조)')}
                    </Button>
                    {rotationReferenceImage && (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                          <img src={rotationReferenceImage.preview} alt={tr('Ảnh tham chiếu', 'Reference image', '参考图片', '参照画像', '참조 이미지')} className="w-full h-full object-cover" />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRotationReferenceImage(null)}>{tr('Xóa', 'Remove', '删除', '削除', '삭제')}</Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('left'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowLeft className="h-4 w-4 mr-1" /> {tr('Trái', 'Left', '左', '左', '왼쪽')} ({APPLY_COSTS[imageQuality]} credit)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('right'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowRight className="h-4 w-4 mr-1" /> {tr('Phải', 'Right', '右', '右', '오른쪽')} ({APPLY_COSTS[imageQuality]} credit)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('up'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowUp className="h-4 w-4 mr-1" /> {tr('Lên', 'Up', '上', '上', '위')} ({APPLY_COSTS[imageQuality]} credit)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('down'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowDown className="h-4 w-4 mr-1" /> {tr('Xuống', 'Down', '下', '下', '아래')} ({APPLY_COSTS[imageQuality]} credit)
                    </Button>
                  </div>
                </div>
              </div>
              {spaceType === 'exterior-landscape' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Maximize2 className="h-3 w-3" /> {tr('Mở rộng ảnh', 'Expand image', '扩展图片', '画像を拡張', '이미지 확장')}</h4>
                  <p className="text-[10px] text-muted-foreground">{tr('Mở rộng sân vườn đều các mặt (trái, phải, trên, dưới).', 'Expand garden on all sides (left, right, top, bottom).', '向四周扩展花园（左、右、上、下）。', '庭園を四方に拡張（左・右・上・下）。', '정원을 사방으로 확장 (좌, 우, 상, 하).')}</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleExpandExteriorDown())} disabled={!getImageForApply()} className="shrink-0">
                    <Maximize2 className="h-4 w-4 mr-1" /> {tr('Mở rộng sân vườn', 'Expand garden', '扩展花园', '庭園を拡張', '정원 확장')} ({APPLY_COSTS[imageQuality]} credit)
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Thêm đồ (tùy chọn)', 'Add items (optional)', '添加物品（可选）', 'アイテム追加（任意）', '아이템 추가 (선택)')}</h4>
                <p className="text-[10px] text-muted-foreground">
                  {spaceType === 'exterior-facade' ? tr('Nhập yêu cầu thay đổi mặt tiền (VD: ốp đá, sơn tường màu xanh).', 'Enter facade change request (e.g. stone cladding, blue wall paint).', '输入立面改造要求（例如：贴石、刷蓝墙）。', '外観変更の要望を入力（例：石張り、青い壁塗装）。', '외관 변경 요청 입력 (예: 석재 마감, 파란색 벽 페인트).') : tr('Chọn món từ danh sách thả xuống. Chất liệu và màu để "— AI chọn —" nếu không chỉ định. Hoặc nhập thêm bên dưới.', 'Select from dropdown. Leave material/color as "— AI choose —" if unspecified. Or type below.', '从下拉选择。未指定时材质/颜色留为「— AI选择 —」。或下方输入。', 'ドロップダウンから選択。未指定は「— AI選択 —」。または下に入力。', '드롭다운에서 선택. 미지정 시 "— AI 선택 —". 또는 아래 입력.')}
                </p>
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && (
                <div className="flex gap-2">
                  <select value={furnitureToAddIdEdit} onChange={(e) => setFurnitureToAddIdEdit(e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm bg-white/80">
                    <option value="">— {tr('Chọn món cần thêm', 'Select item to add', '选择要添加的物品', '追加するアイテムを選択', '추가할 항목 선택')} —</option>
                    {(() => {
                      const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                      return Array.from(new Set(itemsList.map((f) => f.category))).map((cat) => {
                        const items = itemsList.filter((f) => f.category === cat && !(f.id in selectedFurnitureForAdd))
                        if (items.length === 0) return null
                        return (
                          <optgroup key={cat} label={getFurnitureCategoryLabel(cat, uiLocale)}>
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>{getFurnitureItemLabel(item, uiLocale)}</option>
                            ))}
                          </optgroup>
                        )
                      })
                    })()}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const idToAdd = furnitureToAddIdEdit
                    if (idToAdd) {
                      setSelectedFurnitureForAdd((prev) => {
                        const next: Record<string, FurnitureSelection> = {}
                        for (const [k, v] of Object.entries(prev)) {
                          next[k] = { material: v.material ?? '', color: v.color ?? '', style: v.style ?? '', position: v.position ?? '', shape: v.shape ?? '', orientation: v.orientation ?? '' }
                        }
                        next[idToAdd] = { material: '', color: '', style: '', position: '', shape: '', orientation: '' }
                        return next
                      })
                      setFurnitureToAddIdEdit('')
                    }
                  }} disabled={!furnitureToAddIdEdit} className="shrink-0">{tr('Thêm', 'Add', '添加', '追加', '추가')}</Button>
                </div>
                )}
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && Object.keys(selectedFurnitureForAdd).length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-2 space-y-1.5">
                    <p className="text-[10px] font-medium text-slate-600">{tr('Danh mục sản phẩm cần thêm', 'Items to add', '待添加物品', '追加するアイテム', '추가할 항목')}</p>
                    {Object.entries(selectedFurnitureForAdd).map(([id, val]) => {
                      const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                      const item = itemsList.find((f) => f.id === id)
                      const selType = (item as { selectionType?: string })?.selectionType ?? 'material'
                      const material = val?.material ?? ''
                      const color = val?.color ?? ''
                      const style = val?.style ?? ''
                      const position = val?.position ?? ''
                      const shape = val?.shape ?? ''
                      const orientation = val?.orientation ?? ''
                      const def = { material: '', color: '', style: '', position: '', shape: '', orientation: '' }
                      return (
                        <div key={id} className="flex items-center gap-1.5 flex-wrap text-[11px] bg-slate-50 rounded px-2 py-1">
                          <span className="font-medium min-w-[90px]">{item ? getFurnitureItemLabel(item, uiLocale) : id}</span>
                          {spaceType === 'exterior-landscape' && (
                            <select value={position} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                              const cur = s[id] || def
                              return { ...s, [id]: { ...cur, position: e.target.value } }
                            })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[95px]" title={tr('Vị trí', 'Position', '位置', '位置', '위치')}>
                              {EXTERIOR_POSITION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                            </select>
                          )}
                          {id === 'be-boi' && (
                            <>
                              <select value={shape} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, shape: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[85px]" title={tr('Hình dạng', 'Shape', '形状', '形状', '형태')}>
                                {POOL_SHAPE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                              </select>
                              <select value={orientation} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, orientation: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[85px]" title={tr('Hướng', 'Orientation', '朝向', '向き', '방향')}>
                                {POOL_ORIENTATION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                              </select>
                            </>
                          )}
                          {selType === 'material' && (
                            <>
                              <select value={material} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, material: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[100px]" title={tr('Chất liệu', 'Material', '材质', '素材', '재질')}>
                                {FURNITURE_MATERIALS.map((m) => <option key={m.value || 'n'} value={m.value}>{getOptionLabel(m, uiLocale)}</option>)}
                              </select>
                              <select value={color} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, color: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[90px]" title={tr('Màu', 'Color', '颜色', '色', '색상')}>
                                {FURNITURE_COLORS.map((c) => <option key={c.value || 'n'} value={c.value}>{getOptionLabel(c, uiLocale)}</option>)}
                              </select>
                            </>
                          )}
                          {selType === 'style' && (
                            <select value={style} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                              const cur = s[id] || def
                              return { ...s, [id]: { ...cur, style: e.target.value } }
                            })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[110px]" title={tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}>
                              {FURNITURE_STYLE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{getOptionLabel(o, uiLocale)}</option>)}
                            </select>
                          )}
                          <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-slate-500 hover:text-red-600 text-xs" title={tr('Xóa', 'Remove', '删除', '削除', '삭제')} aria-label={tr('Xóa', 'Remove', '删除', '削除', '삭제')} onClick={() => setSelectedFurnitureForAdd((s) => { const n = { ...s }; delete n[id]; return n })}>×</Button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Input placeholder={tr('VD: thêm bộ sofa màu xám (nhập thêm nếu cần)', 'e.g. add gray sofa set (type more if needed)', '例如：添加灰色沙发（如需可继续输入）', '例：グレーソファ追加（必要なら追加入力）', '예: 회색 소파 추가 (필요시 추가 입력)')} value={addItemsPrompt} onChange={(e) => setAddItemsPrompt(e.target.value)} className="bg-white/80" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Sun className="h-3 w-3" /> {tr('Thời gian', 'Time of day', '时间', '時間帯', '시간대')}</h4>
                  <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    <option value="">{tr('Mặc định', 'Default', '默认', 'デフォルト', '기본')}</option>
                    <option value="ban-ngay">{tr('Ban ngày', 'Daytime', '白天', '日中', '낮')}</option>
                    <option value="hoang-hon">{tr('Hoàng hôn', 'Sunset', '黄昏', '夕暮れ', '석양')}</option>
                    <option value="dem">{tr('Đêm', 'Night', '夜晚', '夜', '밤')}</option>
                  </select>
                </div>
                {spaceType === 'interior' && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ImagePlus className="h-3 w-3" /> {tr('Loại phòng (staging)', 'Room type (staging)', '房间类型（布置）', '部屋タイプ（ステージング）', '방 유형 (스테이징)')}</h4>
                  <select value={stagingRoomType} onChange={(e) => setStagingRoomType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    {ROOM_TYPES.map((t) => (
                      <option key={t.value || 'none'} value={t.value}>{getRoomTypeLabel(t.value, uiLocale)}</option>
                    ))}
                  </select>
                </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh tham khảo phong cách', 'Style reference image', '风格参考图', 'スタイル参照画像', '스타일 참조 이미지')}</h4>
                <div className="flex gap-2 items-center">
                  <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                  }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => referenceInputRef.current?.click()} className="shrink-0">
                    <ImagePlus className="h-4 w-4 mr-1" /> {tr('Chọn ảnh', 'Select image', '选择图片', '画像を選択', '이미지 선택')}
                  </Button>
                  {referenceImage && (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                        <img src={referenceImage.preview} alt="Ref" className="w-full h-full object-cover" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReferenceImage(null)}>{tr('Xóa', 'Remove', '删除', '削除', '삭제')}</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{tr('Chọn hành động', 'Choose action', '选择操作', '操作を選択', '작업 선택')}</CardTitle>
                <CardDescription className="text-xs">{tr('Áp dụng', 'Apply', '应用', '適用', '적용')}: 1,5–3 credits</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {spaceType === 'exterior-facade' ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Building2 className="h-3 w-3" /> {tr('Chủ đề kiến trúc', 'Architecture theme', '建筑主题', '建築テーマ', '건축 테마')}</h4>
                    <select value={selectedArchTheme} onChange={(e) => setSelectedArchTheme(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      {Object.entries(ARCH_THEMES).map(([k]) => (
                        <option key={k} value={k}>{getArchThemeLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">{tr('Phong cách kiến trúc thế giới', 'World architecture styles', '世界建筑风格', '世界の建築スタイル', '세계 건축 스타일')}</p>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mt-2"><Palette className="h-3 w-3" /> {tr('Màu chính mặt tiền', 'Facade main color', '立面主色', '外観メインカラー', '외관 메인 색상')}</h4>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— {tr('Không chọn', 'None', '不选', '選択なし', '선택 안 함')} —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">{tr('Màu phụ / điểm nhấn', 'Secondary color / accent', '辅色/点缀', 'サブカラー/アクセント', '보조 색상/포인트')}</h4>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— {tr('Không chọn', 'None', '不选', '選択なし', '선택 안 함')} —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Palette className="h-3 w-3" /> {tr('Màu chính không gian', 'Space main color', '空间主色', '空間メインカラー', '공간 메인 색상')}</h4>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                    {detectedDominantColor && <p className="text-[10px] text-muted-foreground">{tr('AI phát hiện', 'AI detected', 'AI检测', 'AI検出', 'AI 감지')}: {detectedDominantColor}</p>}
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">{tr('Màu phụ / điểm nhấn', 'Secondary color / accent', '辅色/点缀', 'サブカラー/アクセント', '보조 색상/포인트')}</h4>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— {tr('Không chọn', 'None', '不选', '選択なし', '선택 안 함')} —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{getMainColorLabel(k, uiLocale)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Phong cách mặc định', 'Default style', '默认风格', 'デフォルトスタイル', '기본 스타일')}</h4>
                  <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    {stylesFromConstants.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">{tr('Phong cách không gian khi thêm đồ mới', 'Space style when adding new items', '添加新物品时的空间风格', '新規アイテム追加時の空間スタイル', '새 항목 추가 시 공간 스타일')}</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Chất lượng & số phiên bản', 'Quality & variant count', '质量与版本数', '画質とバリアント数', '화질 및 버전 수')}</h4>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    2K (1,5)
                    </button>
                    <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    4K (3)
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">{tr('Phiên bản', 'Variants', '版本', 'バリアント', '버전')}:</span>
                    {[1, 2, 3].map((n) => (
                      <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{tr('Ước tính', 'Estimate', '预估', '見積もり', '예상')}: {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credits</p>
                </div>
                {structuralItemsToConfirm.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Kết cấu cần xác nhận', 'Structure to confirm', '待确认结构', '確認する構造', '확인할 구조')}</h4>
                    <p className="text-[10px] text-muted-foreground">{tr('AI chưa rõ loại – chọn giúp để thiết kế đúng', 'AI unclear on type – please select for correct design', 'AI类型不明–请选择以正确设计', 'AIが種類不明–正しいデザインのため選択してください', 'AI가 유형 불명–올바른 디자인을 위해 선택해 주세요')}</p>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {structuralItemsToConfirm.map((s) => {
                        const opts = s.category === 'door' ? DOOR_TYPE_OPTIONS : s.category === 'window' ? WINDOW_TYPE_OPTIONS : WALL_TYPE_OPTIONS
                        return (
                          <div key={s.id} className="p-2 rounded-lg border border-sky-200/80 bg-sky-50/50 text-sm">
                            <div className="font-medium text-sky-900">{s.item}</div>
                            {s.position && <div className="text-[10px] text-sky-700/80 mt-0.5">{tr('Vị trí', 'Position', '位置', '位置', '위치')}: {s.position}</div>}
                            <select
                              value={s.userCorrectedType}
                              onChange={(e) => setStructuralItemCorrectedType(s.id, e.target.value)}
                              className="mt-1.5 w-full px-2 py-1.5 rounded border border-sky-200 bg-white text-xs"
                            >
                              {opts.map((o) => (
                                <option key={o.value} value={o.value}>{getOptionLabel(o, uiLocale)}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Đồ nội thất', 'Furniture', '家具', '家具', '가구')}</h4>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAllItemsAction('keep')} className="px-2 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800">{tr('Tất cả Giữ', 'All Keep', '全部保留', 'すべて保持', '전체 유지')}</button>
                      <button type="button" onClick={() => setAllItemsAction('redesign')} className="px-2 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">{tr('Tất cả Thay đổi', 'All Change', '全部更改', 'すべて変更', '전체 변경')}</button>
                      <button type="button" onClick={() => setAllItemsAction('delete')} className="px-2 py-0.5 text-[10px] rounded bg-red-100 text-red-800">{tr('Tất cả Xóa', 'All Delete', '全部删除', 'すべて削除', '전체 삭제')}</button>
                    </div>
                  </div>
                  {furnitureList.map((f) => (
                    <div key={f.id} className="p-3 rounded-lg border bg-muted/30 text-sm">
                      <div className="font-medium">{f.item}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {f.position && <span className="text-emerald-600/80">{tr('Vị trí', 'Position', '位置', '位置', '위치')}: {f.position}</span>}
                        {f.position && (f.color || f.material) && ' • '}
                        {f.color && `${tr('Màu', 'Color', '颜色', '色', '색상')}: ${f.color}`} {f.material && `| ${f.material}`}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'keep')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'keep' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          {tr('Giữ', 'Keep', '保留', '保持', '유지')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'redesign')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'redesign' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          <Brush className="inline h-3 w-3 mr-0.5" /> {tr('Thay đổi', 'Change', '更改', '変更', '변경')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'delete')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'delete' ? 'bg-red-100 text-red-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          <Eraser className="inline h-3 w-3 mr-0.5" /> {tr('Xóa', 'Delete', '删除', '削除', '삭제')}
                        </button>
                      </div>
                      {f.action === 'redesign' && (
                        <div className="mt-3 pt-3 border-t border-amber-200/50 space-y-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setItemRedesignType(f.id, 'replace')}
                              className={`px-2 py-1 text-xs rounded ${f.redesignType === 'replace' ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}
                            >
                              {tr('Thay bằng cái khác', 'Replace with other', '替换为其他', '別のものに置換', '다른 것으로 교체')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemRedesignType(f.id, 'rearrange')}
                              className={`px-2 py-1 text-xs rounded ${f.redesignType === 'rearrange' ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}
                            >
                              {tr('Thay đổi kiểu sắp xếp', 'Rearrange', '重新排列', '配置変更', '배치 변경')}
                            </button>
                          </div>
                          {f.redesignType === 'replace' && (
                            <>
                              <Input
                                placeholder={tr('Để trống = thay bằng món cùng loại. Hoặc gõ cụ thể (VD: bàn gỗ, ghế sofa xám...)', 'Empty = replace with same type. Or type specific (e.g. wood table, gray sofa...)', '留空=同类型替换。或输入具体（如：木桌、灰色沙发...）', '空=同種に置換。または具体的に入力（例：木製テーブル、グレーソファ...）', '비움=같은 유형으로 교체. 또는 구체적 입력 (예: 나무 테이블, 회색 소파...)')}
                                value={f.redesignReplaceWith ?? ''}
                                onChange={(e) => setItemRedesignReplaceWith(f.id, e.target.value)}
                                className="h-8 text-xs bg-amber-50/50 border-amber-200"
                              />
                              <p className="text-[10px] text-muted-foreground">{tr('Trống = thay bằng món khác cùng loại. Có nội dung = thay bằng món cụ thể.', 'Empty = replace with same type. With content = replace with specific item.', '留空=同类型替换。有内容=具体物品替换。', '空=同種に置換。内容あり=具体的に置換。', '비움=같은 유형 교체. 내용 있음=구체적 항목 교체.')}</p>
                            </>
                          )}
                          {f.redesignType === 'rearrange' && (
                            <>
                              <Input
                                placeholder={tr('Mô tả thay đổi (VD: thêm trải bàn, đổi màu xám, sắp xếp lại gọn gàng...)', 'Describe change (e.g. add tablecloth, change to gray, rearrange neatly...)', '描述更改（如：加桌布、改灰色、整齐重排...）', '変更を説明（例：テーブルクロス追加、グレーに変更、きれいに並べ替え...）', '변경 설명 (예: 테이블보 추가, 회색으로 변경, 깔끔하게 재배치...)')}
                                value={f.redesignRearrangePrompt ?? ''}
                                onChange={(e) => setItemRedesignRearrangePrompt(f.id, e.target.value)}
                                className="h-8 text-xs bg-amber-50/50 border-amber-200"
                              />
                              <p className="text-[10px] text-muted-foreground">{tr('Giữ món đó, chỉ thay đổi cách sắp xếp/màu sắc/trang trí.', 'Keep item, only change arrangement/color/decoration.', '保留物品，仅更改排列/颜色/装饰。', 'アイテムは保持、配置・色・装飾のみ変更。', '항목 유지, 배치/색상/장식만 변경.')}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">{tr('Thao tác chính', 'Main actions', '主要操作', 'メイン操作', '주요 작업')}</CardTitle>
                <CardDescription className="text-xs">{tr('Ước tính', 'Estimate', '预估', '見積もり', '예상')} {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">{tr('Chất lượng', 'Quality', '质量', '画質', '화질')}:</span>
                  <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'}`}>2K</button>
                  <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'}`}>4K</button>
                  <span className="text-xs font-medium text-muted-foreground ml-2">{tr('Phiên bản', 'Variants', '版本', 'バリアント', '버전')}:</span>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 hover:bg-slate-200'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                {undoStack.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleUndo} className="shrink-0">
                    <Undo2 className="h-3 w-3 mr-1" /> {tr('Hoàn tác', 'Undo', '撤销', '元に戻す', '되돌리기')}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={saveDraft} className="shrink-0"><Save className="h-3 w-3 mr-1" /> {tr('Lưu nháp', 'Save draft', '保存草稿', '下書き保存', '초안 저장')}</Button>
                <Button variant="outline" size="sm" onClick={loadDraft} className="shrink-0"><FolderOpen className="h-3 w-3 mr-1" /> {tr('Tải nháp', 'Load draft', '加载草稿', '下書き読み込み', '초안 불러오기')}</Button>
                <DepositCreditButton variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" />
                <Button onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality] * variantCount, handleApply)} disabled={!getImageForApply()} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo', 'Apply', '应用', '適用', '적용')} ({(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit)
                </Button>
                {currentImageUrl && (
                  <Button variant="outline" size="sm" onClick={() => checkCreditsAndProceed(ANALYZE_CREDIT, handleReanalyze)}>
                    <Scan className="mr-2 h-3 w-3" /> {tr('Phân tích lại', 'Re-analyze', '重新分析', '再分析', '재분석')} ({ANALYZE_CREDIT} credit)
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset}>{tr('Bắt đầu mới', 'Start over', '重新开始', '最初から', '처음부터')}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'GENERATING' && (
            <Card className="border border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="interior" title={tr('Đang áp dụng thay đổi', 'Applying changes', '正在应用更改', '変更を適用中', '변경 적용 중')} description={tr('AI đang xóa, thay đổi món chọn', 'AI is removing, changing selected items', 'AI正在删除、更改所选物品', 'AIが選択アイテムを削除・変更しています', 'AI가 선택 항목 삭제·변경 중')} imagePreview={displayImage} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border border-slate-200/80 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</CardTitle>
              <CardDescription className="text-xs">
                {rotationHistory.length > 1 ? tr('Bấm Trước/Sau để xem các góc quay. Kéo thanh trượt để so sánh.', 'Click Prev/Next to view rotation angles. Drag slider to compare.', '点击前/后查看旋转角度。拖动滑块比较。', '前/次で回転角度を表示。スライダーをドラッグして比較。', '이전/다음 클릭으로 회전 각도 보기. 슬라이더 드래그로 비교.') : tr('Ảnh đã được áp dụng. Kéo thanh trượt để so sánh trước/sau.', 'Image applied. Drag slider to compare before/after.', '图片已应用。拖动滑块比较前后。', '画像を適用しました。スライダーで前後比較。', '이미지 적용됨. 슬라이더로 전후 비교.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rotationHistory.length > 1 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRotationHistoryIndex((i) => Math.max(0, i - 1))} disabled={rotationHistoryIndex <= 0}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> {tr('Trước', 'Prev', '前', '前', '이전')}
                    </Button>
                    <span className="text-xs text-muted-foreground">{tr('Góc', 'Angle', '角度', '角度', '각도')} {rotationHistoryIndex + 1}/{rotationHistory.length}</span>
                    <Button variant="outline" size="sm" onClick={() => setRotationHistoryIndex((i) => Math.min(rotationHistory.length - 1, i + 1))} disabled={rotationHistoryIndex >= rotationHistory.length - 1}>
                      {tr('Sau', 'Next', '后', '次', '다음')} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  {rotationHistoryIndex > 0 && rotationHistory[rotationHistoryIndex - 1] && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{tr('So sánh góc trước / góc hiện tại', 'Compare previous / current angle', '比较前一/当前角度', '前の角度と現在の角度を比較', '이전/현재 각도 비교')}</h3>
                      <CompareSlider before={rotationHistory[rotationHistoryIndex - 1]} after={rotationHistory[rotationHistoryIndex]} className="max-h-[400px]" />
                    </div>
                  )}
                  {rotationHistoryIndex === 0 && (
                    <div className="aspect-video rounded-lg border overflow-hidden">
                      <ImagePreview src={rotationHistory[0]} alt={tr('Góc gốc', 'Original angle', '原始角度', '元の角度', '원본 각도')} className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              ) : displayImage ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('So sánh trước / sau', 'Compare before / after', '比较前后', '前後比較', '전후 비교')}</h3>
                  <CompareSlider before={displayImage} after={resultUrl} className="max-h-[400px]" />
                </div>
              ) : null}
              {resultUrls.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">{tr('Các phiên bản', 'Variants', '各版本', 'バリアント', '버전')} ({resultUrls.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {resultUrls.map((url, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square rounded-lg border overflow-hidden">
                          <ImagePreview src={url} alt={`${tr('Kết quả', 'Result', '结果', '結果', '결과')} ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleContinueEdit(url)}>
                            <Check className="h-3 w-3 mr-1" /> {tr('Dùng', 'Use', '使用', '使用', '사용')}
                          </Button>
                          <DownloadImageButton
                            imageUrl={url}
                            filename={`interior-${i + 1}`}
                            variant="outline"
                            size="sm"
                            showLabel={false}
                            printReady
                            printReadyInferFromImage
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleContinueEdit(displayImage || undefined)} disabled={!displayImage}>
                  <Check className="mr-2 h-3 w-3" /> {tr('Tiếp tục sửa với ảnh cũ', 'Continue edit with old image', '使用旧图继续编辑', '元の画像で編集続行', '이전 이미지로 편집 계속')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleContinueEdit(resultUrl)}>
                  <Check className="mr-2 h-3 w-3" /> {tr('Tiếp tục sửa với ảnh mới', 'Continue edit with new image', '使用新图继续编辑', '新しい画像で編集続行', '새 이미지로 편집 계속')}
                </Button>
                {resultUrls.length === 1 && (
                  <DownloadImageButton
                  imageUrl={resultUrl}
                  filename="interior-result"
                  variant="outline"
                  size="sm"
                  printReady
                  printReadyInferFromImage
                />
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={exportPdf}>
                  <FileDown className="mr-2 h-3 w-3" /> {tr('Xuất PDF', 'Export PDF', '导出PDF', 'PDFエクスポート', 'PDF 내보내기')}
                </Button>
                <Button size="sm" variant="outline" onClick={copyShareLink}>
                  <Copy className="mr-2 h-3 w-3" /> {tr('Copy link', 'Copy link', '复制链接', 'リンクをコピー', '링크 복사')}
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> {tr('Bắt đầu mới', 'Start over', '重新开始', '最初から', '처음부터')}</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated images may have errors.', 'AI生成的图片可能有误差。', 'AI生成画像には誤りがある場合があります。', 'AI 생성 이미지에 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
