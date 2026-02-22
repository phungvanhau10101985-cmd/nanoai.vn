'use client'

import { useState, useRef, ChangeEvent, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { analyzeInterior, applyInteriorChanges, getCredits } from './actions'
import { ARCH_THEMES, MAIN_COLORS, APPLY_COSTS, ANALYZE_CREDIT, ROOM_TYPES, INTERIOR_STYLES, INTERIOR_STYLE_LABELS, DOOR_TYPE_OPTIONS, WINDOW_TYPE_OPTIONS, WALL_TYPE_OPTIONS, FURNITURE_STAGING_MODES, FURNITURE_ITEMS, EXTERIOR_FURNITURE_ITEMS, FURNITURE_MATERIALS, FURNITURE_COLORS, FURNITURE_STYLE_OPTIONS, EXTERIOR_POSITION_OPTIONS, POOL_SHAPE_OPTIONS, POOL_ORIENTATION_OPTIONS } from './constants'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, Download, RefreshCw, Link2, Home, Scan, Eraser, Brush, Check, Building2, Palette, Undo2, Save, FolderOpen, Sun, ImagePlus, Copy, FileDown, RotateCcw, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Maximize2, LayoutGrid } from 'lucide-react'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { CompareSlider } from '@/components/ui/compare-slider'
import { jsPDF } from 'jspdf'
import { preloadImageUrl } from '@/lib/preload-image-url'

const DRAFT_KEY = 'thiet-ke-noi-ngoai-that-draft'
const STYLES_FROM_CONSTANTS = Object.entries(INTERIOR_STYLES).map(([value]) => ({
  value,
  label: INTERIOR_STYLE_LABELS[value] || value,
}))

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

  const refreshCredits = useCallback(async () => {
    const bal = await getCredits()
    setCredits(bal)
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
      toast({ title: 'Lỗi', description: 'Vui lòng dán link ảnh.', variant: 'destructive' })
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      toast({ title: 'Lỗi', description: 'Link không hợp lệ.', variant: 'destructive' })
      return
    }
    setUrlLoading(true)
    try {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (!blob.type.startsWith('image/')) throw new Error('Không phải ảnh')
      const file = new File([blob], 'image-from-url.png', { type: blob.type || 'image/png' })
      setImageFromFile(file, setImage)
      setCurrentImageUrl(null)
      setFurnitureList([])
      setImageUrl('')
      toast({ title: 'Đã tải ảnh', description: 'Ảnh từ link đã được thêm.', duration: 2000 })
    } catch {
      toast({
        title: 'Không tải được ảnh',
        description: 'Link có thể bị chặn CORS. Thử tải ảnh lên trực tiếp.',
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
            toast({ title: 'Đã dán ảnh', description: 'Ảnh từ clipboard đã được thêm.', duration: 2000 })
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
      toast({ title: 'Lỗi', description: 'Vui lòng tải lên ảnh không gian cần thiết kế.', variant: 'destructive' })
      return
    }
    setStep('ANALYZING')
    const formData = new FormData()
    formData.append('image', img)
    const result = await analyzeInterior(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: 'Phân tích thất bại', description: result.error, variant: 'destructive', duration: 5000 })
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
        toast({ title: 'Thành công!', description: `Đã phân tích ${type === 'exterior-landscape' ? 'sân vườn' : type === 'exterior-facade' || type === 'exterior' ? 'mặt tiền nhà' : 'nội thất'}.`, duration: 3000 })
      } catch {
        setStep('UPLOAD')
        toast({ title: 'Lỗi', description: 'Không parse được kết quả.', variant: 'destructive' })
      }
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
    toast({ title: 'Đã quay lại', duration: 1500 })
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
      toast({ title: 'Đã lưu nháp', duration: 2000 })
    } catch {
      toast({ title: 'Không lưu được', variant: 'destructive' })
    }
  }

  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) {
        toast({ title: 'Chưa có nháp', variant: 'destructive' })
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
      toast({ title: 'Đã tải nháp', duration: 2000 })
    } catch {
      toast({ title: 'Nháp không hợp lệ', variant: 'destructive' })
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
      pdf.text('Trước', 10 + w / 2 - 5, 18)
      pdf.text('Sau', 150 + w / 2 - 5, 18)
      pdf.save('thiet-ke-noi-ngoai-that.pdf')
      toast({ title: 'Đã tải PDF', duration: 2000 })
    } catch {
      toast({ title: 'Xuất PDF thất bại', variant: 'destructive' })
    }
  }

  const copyShareLink = () => {
    if (!resultUrl) return
    navigator.clipboard.writeText(resultUrl)
    toast({ title: 'Đã copy link', duration: 2000 })
  }

  const handleApplyFullRedesign = async () => {
    const img = image.file
    const url = currentImageUrl
    if (!img && !url) {
      toast({ title: 'Lỗi', description: 'Không có ảnh để xử lý.', variant: 'destructive' })
      return
    }
    if ((spaceType === 'interior' || spaceType === 'exterior-landscape') && furnitureStagingMode === 'custom' && Object.keys(selectedFurniture).length === 0) {
      toast({ title: 'Lỗi', description: 'Chọn ít nhất 1 món đồ khi dùng "Khách chọn đồ".', variant: 'destructive' })
      return
    }
    setStep('GENERATING')
    const formData = new FormData()
    if (url?.startsWith('blob:') && img) {
      formData.append('image', img)
    } else if (url && !url.startsWith('blob:')) {
      formData.append('image', url)
    } else if (img) {
      formData.append('image', img)
    } else if (url) {
      formData.append('image', url)
    }
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
    if (referenceImage?.file) formData.append('referenceImage', referenceImage.file)
    const result = await applyInteriorChanges(formData)
    if (result.error) {
      setStep('FULL_REDESIGN')
      toast({ title: 'Xử lý thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setResultUrls(result.resultUrls || [result.resultUrl])
      setStep('RESULT')
      refreshCredits()
      toast({ title: 'Thành công!', description: 'Đã làm mới không gian.', duration: 3000 })
    }
  }

  const handleApply = async () => {
    const img = image.file
    const url = currentImageUrl
    if (!img && !url) {
      toast({ title: 'Lỗi', description: 'Không có ảnh để xử lý.', variant: 'destructive' })
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
      toast({ title: 'Lỗi', description: 'Chọn "Thay đổi kiểu sắp xếp" và nhập nội dung cho món đã chọn.', variant: 'destructive' })
      return
    }
    const hasAddFromList = Object.keys(selectedFurnitureForAdd).length > 0
    const needsEdit = toDelete.length > 0 || toReplace.length > 0 || toRearrange.length > 0 || addItemsPrompt || hasAddFromList || (spaceType === 'interior' && stagingRoomType)
    if (!needsEdit) {
      toast({ title: 'Lỗi', description: 'Chọn ít nhất một món để xóa/thay đổi, thêm đồ từ danh sách, nhập thêm đồ, hoặc chọn mẫu staging.', variant: 'destructive' })
      return
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    const formData = new FormData()
    if (url?.startsWith('blob:') && img) {
      formData.append('image', img)
    } else if (url && !url.startsWith('blob:')) {
      formData.append('image', url)
    } else if (img) {
      formData.append('image', img)
    } else if (url) {
      formData.append('image', url)
    }
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
    if (referenceImage?.file) formData.append('referenceImage', referenceImage.file)
    const result = await applyInteriorChanges(formData)
    if (result.error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({ title: 'Xử lý thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setResultUrls(result.resultUrls || [result.resultUrl])
      setStep('RESULT')
      refreshCredits()
      toast({ title: 'Thành công!', description: 'Đã áp dụng thay đổi.', duration: 3000 })
    }
  }

  const hasRotationReference = !!rotationReferenceImage

  const handleRotate = async (direction: 'left' | 'right' | 'up' | 'down', imageOverride?: string) => {
    const img = image.file
    const url = imageOverride ?? currentImageUrl
    if (!img && !url) {
      toast({ title: 'Lỗi', description: 'Không có ảnh để quay.', variant: 'destructive' })
      return
    }
    if (!hasRotationReference) {
      toast({ title: 'Bắt buộc có ảnh tham chiếu', description: 'Ảnh chính đang hiển thị. Chọn ảnh tham chiếu để bổ trợ kết cấu.', variant: 'destructive' })
      return
    }
    if (imageOverride) {
      setCurrentImageUrl(imageOverride)
      setImage({ file: null, preview: null })
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage || imageOverride!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    const formData = new FormData()
    if (url?.startsWith('blob:') && img) {
      formData.append('image', img)
    } else if (url && !url.startsWith('blob:')) {
      formData.append('image', url)
    } else if (img) {
      formData.append('image', img)
    }
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
    if (rotationReferenceImage?.file) formData.append('rotationReferenceImage', rotationReferenceImage.file)
    const result = await applyInteriorChanges(formData)
    if (result.error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({ title: 'Quay thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setResultUrls(result.resultUrls || [result.resultUrl])
      setRotationHistory((prev) => (prev.length === 0 ? [displayImage || currentImageUrl || '', result.resultUrl!] : [...prev, result.resultUrl!]))
      setRotationHistoryIndex((prev) => (prev === 0 ? 1 : prev + 1))
      setStep('RESULT')
      refreshCredits()
      const dirLabel = { left: 'trái', right: 'phải', up: 'lên', down: 'xuống' }[direction]
      toast({ title: 'Thành công!', description: `Đã quay 30° ${dirLabel}.`, duration: 3000 })
    }
  }

  const handleExpandExteriorDown = async (imageOverride?: string) => {
    const img = image.file
    const url = imageOverride ?? currentImageUrl
    if (!img && !url) {
      toast({ title: 'Lỗi', description: 'Không có ảnh để mở rộng.', variant: 'destructive' })
      return
    }
    if (spaceType !== 'exterior-landscape') {
      toast({ title: 'Chỉ sân vườn', description: 'Mở rộng sân vườn chỉ dùng cho chế độ Sân vườn.', variant: 'destructive' })
      return
    }
    if (imageOverride) {
      setCurrentImageUrl(imageOverride)
      setImage({ file: null, preview: null })
    }
    setUndoStack((prev) => [...prev.slice(-4), { displayImage: displayImage || imageOverride!, furnitureList: [...furnitureList], currentImageUrl }])
    setStep('GENERATING')
    const formData = new FormData()
    if (url?.startsWith('blob:') && img) {
      formData.append('image', img)
    } else if (url && !url.startsWith('blob:')) {
      formData.append('image', url)
    } else if (img) {
      formData.append('image', img)
    }
    formData.append('imageQuality', imageQuality)
    formData.append('itemsToDelete', '[]')
    formData.append('itemsToRedesign', '[]')
    formData.append('style', selectedStyle)
    formData.append('spaceType', 'exterior-landscape')
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
    const result = await applyInteriorChanges(formData)
    if (result.error) {
      setStep('EDITING')
      setUndoStack((prev) => prev.slice(0, -1))
      toast({ title: 'Mở rộng thất bại', description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setResultUrls(result.resultUrls || [result.resultUrl])
      setStep('RESULT')
      refreshCredits()
      toast({ title: 'Thành công!', description: 'Đã mở rộng sân vườn.', duration: 3000 })
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
    const res = await fetch(url)
    if (!res.ok) {
      setStep(fallbackStep)
      toast({ title: 'Lỗi', description: 'Không tải được ảnh.', variant: 'destructive' })
      return
    }
    const blob = await res.blob()
    const file = new File([blob], 'image.png', { type: blob.type || 'image/png' })
    const formData = new FormData()
    formData.append('image', file)
    const result = await analyzeInterior(formData)
    if (result.error) {
      setStep(fallbackStep)
      toast({ title: 'Phân tích thất bại', description: result.error, variant: 'destructive', duration: 5000 })
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
        toast({ title: 'Đã phân tích lại!', duration: 2000 })
      } catch {
        setStep(fallbackStep)
        toast({ title: 'Lỗi', description: 'Không parse được kết quả.', variant: 'destructive' })
      }
    }
  }

  const handleReanalyze = async (fallbackStep: Step = 'EDITING') => {
    const url = currentImageUrl || (resultUrl ?? undefined)
    if (!url) {
      toast({ title: 'Lỗi', description: 'Không có ảnh để phân tích lại.', variant: 'destructive' })
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
    UPLOAD: '1. Tải ảnh',
    FULL_REDESIGN: '2. Chọn style',
    ANALYZING: 'Đang phân tích',
    EDITING: '3. Chỉnh sửa',
    GENERATING: 'Đang xử lý',
    RESULT: 'Kết quả',
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
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Thiết kế nội thất & ngoại thất</h1>
              <p className="text-xs text-muted-foreground">Làm mới toàn bộ • Sửa từng món • Virtual Staging</p>
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
                  <Upload className="h-4 w-4 text-emerald-600" /> Ảnh phòng
                </CardTitle>
                <CardDescription className="text-xs">Tải lên hoặc dán link ảnh không gian cần thiết kế</CardDescription>
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
                      <p className="text-sm text-muted-foreground font-medium">Chọn ảnh không gian cần thiết kế</p>
                    </>
                  )}
                </label>
                <input id="interior-input" ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                <div className="flex gap-2">
                  <Input placeholder="Dán link ảnh rồi bấm Lấy ảnh" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="flex-1" />
                  <Button type="button" variant="outline" onClick={handleFetchFromUrl} disabled={urlLoading} className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                    <Link2 className="mr-2 h-4 w-4" /> {urlLoading ? 'Đang tải...' : 'Lấy ảnh'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Chọn chế độ</CardTitle>
                <CardDescription className="text-xs">Làm mới toàn bộ (chọn style/màu) hoặc Sửa từng món (phân tích 0,5 credit trước)</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex flex-wrap gap-2 items-center">
                <Button onClick={handleFullRedesign} disabled={!image.file} className="h-9 text-sm bg-sky-600 hover:bg-sky-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> Làm mới toàn bộ
                </Button>
                <Button onClick={() => checkCreditsAndProceed(ANALYZE_CREDIT, handleAnalyze)} disabled={!image.file} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Scan className="mr-2 h-4 w-4" /> Sửa từng món (0,5 credit)
                </Button>
                <Button onClick={handleReset} variant="outline" className="h-9 text-sm border-slate-300">
                  <ImagePlus className="mr-2 h-4 w-4" /> Bắt đầu mới
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'FULL_REDESIGN' && (
          <div className="space-y-4">
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Thiết lập thiết kế</CardTitle>
                <CardDescription className="text-xs">Chọn phong cách, màu sắc, mẫu. Xem lại rồi bấm nút bên dưới.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-4">
                {displayImage && (
                  <div className="aspect-video max-h-[280px] rounded-lg border overflow-hidden">
                    <ImagePreview src={displayImage} alt="Ảnh" className="w-full h-full object-contain" />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Loại không gian</label>
                    <div className="flex flex-col sm:flex-row gap-1">
                      <button type="button" onClick={() => setSpaceType('interior')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'interior' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <Home className="inline h-3 w-3 mr-1" /> Nội thất
                      </button>
                      <button type="button" onClick={() => setSpaceType('exterior-facade')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'exterior-facade' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                        <Building2 className="inline h-3 w-3 mr-1" /> Thay áo cho nhà
                      </button>
                      <button type="button" onClick={() => setSpaceType('exterior-landscape')} className={`flex-1 px-2 py-2 rounded-md border text-xs font-medium transition-colors ${spaceType === 'exterior-landscape' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`} title="Sân kết hợp với vườn">
                        <LayoutGrid className="inline h-3 w-3 mr-1" /> Sân vườn
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Phong cách</label>
                    <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      {STYLES_FROM_CONSTANTS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Màu chính</label>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Màu phụ</label>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      <option value="">— Không —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {spaceType === 'exterior-facade' && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Chủ đề kiến trúc</label>
                      <select value={selectedArchTheme} onChange={(e) => setSelectedArchTheme(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                        {Object.entries(ARCH_THEMES).map(([k]) => (
                          <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Thời gian</label>
                    <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                      <option value="">Mặc định</option>
                      <option value="ban-ngay">Ban ngày</option>
                      <option value="hoang-hon">Hoàng hôn</option>
                      <option value="dem">Đêm</option>
                    </select>
                  </div>
                  {spaceType === 'interior' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Loại phòng (staging)</label>
                      <select value={stagingRoomType} onChange={(e) => setStagingRoomType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                        {ROOM_TYPES.map((t) => (
                          <option key={t.value || 'none'} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && (
                  <div className="space-y-3">
                    <label className="text-xs font-medium text-muted-foreground">{spaceType === 'interior' ? 'Chọn đồ nội thất' : 'Chọn đồ sân vườn'}</label>
                    <div className="flex gap-2">
                      {FURNITURE_STAGING_MODES.map((m) => (
                        <button key={m.value} type="button" onClick={() => setFurnitureStagingMode(m.value as 'ai' | 'custom')} className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${furnitureStagingMode === m.value ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {furnitureStagingMode === 'custom' && (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">Chọn món từ danh sách thả xuống, thêm vào danh mục. Chất liệu và màu để &quot;— AI chọn —&quot; nếu không chỉ định.</p>
                        <div className="flex gap-2">
                          <select value={furnitureToAddId} onChange={(e) => setFurnitureToAddId(e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm bg-white">
                            <option value="">— Chọn món cần thêm —</option>
                            {(() => {
                              const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                              return Array.from(new Set(itemsList.map((f) => f.category))).map((cat) => {
                                const items = itemsList.filter((f) => f.category === cat && !(f.id in selectedFurniture))
                                if (items.length === 0) return null
                                return (
                                  <optgroup key={cat} label={cat}>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>{item.label}</option>
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
                          }} disabled={!furnitureToAddId} className="shrink-0">Thêm</Button>
                        </div>
                        {Object.keys(selectedFurniture).length > 0 && (
                          <div className="rounded-lg border border-slate-200 p-2 space-y-2">
                            <p className="text-[11px] font-medium text-slate-600">Danh mục sản phẩm cần thêm</p>
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
                                  <span className="font-medium min-w-[100px]">{item?.label || id}</span>
                                  {spaceType === 'exterior-landscape' && (
                                    <select value={position} onChange={(e) => setSelectedFurniture((s) => {
                                      const cur = s[id] || def
                                      return { ...s, [id]: { ...cur, position: e.target.value } }
                                    })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[110px]" title="Vị trí">
                                      {EXTERIOR_POSITION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                                    </select>
                                  )}
                                  {id === 'be-boi' && (
                                    <>
                                      <select value={shape} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, shape: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[100px]" title="Hình dạng">
                                        {POOL_SHAPE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                                      </select>
                                      <select value={orientation} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, orientation: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[100px]" title="Hướng">
                                        {POOL_ORIENTATION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                                      </select>
                                    </>
                                  )}
                                  {selType === 'material' && (
                                    <>
                                      <select value={material} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, material: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[120px]" title="Chất liệu">
                                        {FURNITURE_MATERIALS.map((m) => <option key={m.value || 'n'} value={m.value}>{m.label}</option>)}
                                      </select>
                                      <select value={color} onChange={(e) => setSelectedFurniture((s) => {
                                        const cur = s[id] || def
                                        return { ...s, [id]: { ...cur, color: e.target.value } }
                                      })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[110px]" title="Màu">
                                        {FURNITURE_COLORS.map((c) => <option key={c.value || 'n'} value={c.value}>{c.label}</option>)}
                                      </select>
                                    </>
                                  )}
                                  {selType === 'style' && (
                                    <select value={style} onChange={(e) => setSelectedFurniture((s) => {
                                      const cur = s[id] || def
                                      return { ...s, [id]: { ...cur, style: e.target.value } }
                                    })} className="px-2 py-1 rounded border border-slate-200 bg-white text-xs max-w-[130px]" title="Phong cách">
                                      {FURNITURE_STYLE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                                    </select>
                                  )}
                                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-600" onClick={() => setSelectedFurniture((s) => { const n = { ...s }; delete n[id]; return n })}>×</Button>
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
                    <label className="text-xs font-medium text-muted-foreground">Thêm đồ (tùy chọn)</label>
                    <Input placeholder="VD: thêm bộ sofa màu xám" value={addItemsPrompt} onChange={(e) => setAddItemsPrompt(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Ảnh tham khảo</label>
                    <div className="flex gap-2 items-center">
                      <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                      }} />
                      <Button type="button" variant="outline" size="sm" onClick={() => referenceInputRef.current?.click()} className="h-9 shrink-0">
                        <ImagePlus className="h-4 w-4 mr-1" /> Chọn ảnh
                      </Button>
                      {referenceImage && (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-10 h-10 rounded border overflow-hidden shrink-0">
                            <img src={referenceImage.preview} alt="Ref" className="w-full h-full object-cover" />
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setReferenceImage(null)} className="h-8 text-xs">Xóa</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Thao tác chính</CardTitle>
                <CardDescription className="text-xs">Chất lượng {imageQuality} • Phiên bản {variantCount} • {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">Chất lượng:</span>
                  <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '2K' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>2K</button>
                  <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '4K' ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 hover:bg-slate-50'}`}>4K</button>
                  <span className="text-xs font-medium text-muted-foreground ml-2">Phiên bản:</span>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 hover:bg-slate-200'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                <Button onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality] * variantCount, handleApplyFullRedesign)} disabled={!displayImage} className="h-9 text-sm bg-sky-600 hover:bg-sky-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> Làm mới ({(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit)
                </Button>
                <Button onClick={() => furnitureList.length ? setStep('EDITING') : (image.file ? checkCreditsAndProceed(ANALYZE_CREDIT, handleAnalyze) : checkCreditsAndProceed(ANALYZE_CREDIT, () => handleReanalyze('FULL_REDESIGN')))} disabled={!displayImage} variant="outline" className="h-9 text-sm">
                  <Scan className="mr-2 h-4 w-4" /> Sửa từng món{furnitureList.length ? '' : ' (0,5 credit)'}
                </Button>
                <Button onClick={handleReset} variant="outline" className="h-9 text-sm border-slate-300">
                  <ImagePlus className="mr-2 h-4 w-4" /> Bắt đầu mới
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setStep('UPLOAD')}>Quay lại</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'ANALYZING' && (
          <Card className="border border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="interior" title="Đang phân tích nội thất" description="AI đang đọc đồ đạc, chất liệu..." imagePreview={displayImage} />
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
                      <CardTitle className="text-sm font-medium">Ảnh chính</CardTitle>
                      <CardDescription className="text-xs">Chọn từng món: Giữ nguyên | Thay đổi | Xóa</CardDescription>
                      {(roomType || lighting) && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {roomType && `Loại: ${roomType}`} {lighting && ` | Ánh sáng: ${lighting}`}
                        </p>
                      )}
                      {fengShuiSuggestion && (
                        <p className="text-[10px] text-amber-700 mt-1 bg-amber-50/80 px-2 py-1 rounded">Phong thủy: {fengShuiSuggestion}</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${spaceType !== 'interior' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>
                      {spaceType === 'interior' ? <><Home className="inline h-3 w-3 mr-1" /> Nội thất</> : spaceType === 'exterior-facade' ? <><Building2 className="inline h-3 w-3 mr-1" /> Thay áo cho nhà</> : <><LayoutGrid className="inline h-3 w-3 mr-1" /> Sân vườn</>}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {displayImage && (
                    <div className="aspect-video rounded-lg border overflow-hidden">
                      <ImagePreview src={displayImage} alt="Ảnh" className="w-full h-full object-contain" />
                    </div>
                  )}
                </CardContent>
              </Card>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><RotateCcw className="h-3 w-3" /> Quay góc 30°</h4>
                <p className="text-[10px] text-muted-foreground">Ảnh chính = mức hoàn thiện áp dụng đầy đủ. Ảnh tham chiếu = bổ trợ kết cấu. Kết quả giữ mức hoàn thiện như ảnh chính. Mỗi lần quay: {APPLY_COSTS[imageQuality]} credit.</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input ref={rotationRefInputRef} type="file" accept="image/*" className="hidden" id="rotation-ref-input" onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setRotationReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                    }} />
                    <Button type="button" variant="outline" size="sm" onClick={() => rotationRefInputRef.current?.click()} className="shrink-0">
                      <ImagePlus className="h-4 w-4 mr-1" /> Ảnh tham chiếu (bổ trợ kết cấu)
                    </Button>
                    {rotationReferenceImage && (
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                          <img src={rotationReferenceImage.preview} alt="Ảnh tham chiếu" className="w-full h-full object-cover" />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setRotationReferenceImage(null)}>Xóa</Button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('left'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowLeft className="h-4 w-4 mr-1" /> Trái
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('right'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowRight className="h-4 w-4 mr-1" /> Phải
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('up'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowUp className="h-4 w-4 mr-1" /> Lên
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleRotate('down'))} disabled={!getImageForApply() || !hasRotationReference} className="shrink-0">
                      <ArrowDown className="h-4 w-4 mr-1" /> Xuống
                    </Button>
                  </div>
                </div>
              </div>
              {spaceType === 'exterior-landscape' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Maximize2 className="h-3 w-3" /> Mở rộng ảnh</h4>
                  <p className="text-[10px] text-muted-foreground">Mở rộng sân vườn đều các mặt (trái, phải, trên, dưới).</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality], () => handleExpandExteriorDown())} disabled={!getImageForApply()} className="shrink-0">
                    <Maximize2 className="h-4 w-4 mr-1" /> Mở rộng sân vườn ({APPLY_COSTS[imageQuality]} credit)
                  </Button>
                </div>
              )}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Thêm đồ (tùy chọn)</h4>
                <p className="text-[10px] text-muted-foreground">
                  {spaceType === 'exterior-facade' ? 'Nhập yêu cầu thay đổi mặt tiền (VD: ốp đá, sơn tường màu xanh).' : 'Chọn món từ danh sách thả xuống. Chất liệu và màu để "— AI chọn —" nếu không chỉ định. Hoặc nhập thêm bên dưới.'}
                </p>
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && (
                <div className="flex gap-2">
                  <select value={furnitureToAddIdEdit} onChange={(e) => setFurnitureToAddIdEdit(e.target.value)} className="flex-1 px-3 py-2 rounded-md border border-slate-200 text-sm bg-white/80">
                    <option value="">— Chọn món cần thêm —</option>
                    {(() => {
                      const itemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
                      return Array.from(new Set(itemsList.map((f) => f.category))).map((cat) => {
                        const items = itemsList.filter((f) => f.category === cat && !(f.id in selectedFurnitureForAdd))
                        if (items.length === 0) return null
                        return (
                          <optgroup key={cat} label={cat}>
                            {items.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
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
                  }} disabled={!furnitureToAddIdEdit} className="shrink-0">Thêm</Button>
                </div>
                )}
                {(spaceType === 'interior' || spaceType === 'exterior-landscape') && Object.keys(selectedFurnitureForAdd).length > 0 && (
                  <div className="rounded-lg border border-slate-200 p-2 space-y-1.5">
                    <p className="text-[10px] font-medium text-slate-600">Danh mục sản phẩm cần thêm</p>
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
                          <span className="font-medium min-w-[90px]">{item?.label || id}</span>
                          {spaceType === 'exterior-landscape' && (
                            <select value={position} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                              const cur = s[id] || def
                              return { ...s, [id]: { ...cur, position: e.target.value } }
                            })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[95px]" title="Vị trí">
                              {EXTERIOR_POSITION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                            </select>
                          )}
                          {id === 'be-boi' && (
                            <>
                              <select value={shape} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, shape: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[85px]" title="Hình dạng">
                                {POOL_SHAPE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                              </select>
                              <select value={orientation} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, orientation: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[85px]" title="Hướng">
                                {POOL_ORIENTATION_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                              </select>
                            </>
                          )}
                          {selType === 'material' && (
                            <>
                              <select value={material} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, material: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[100px]" title="Chất liệu">
                                {FURNITURE_MATERIALS.map((m) => <option key={m.value || 'n'} value={m.value}>{m.label}</option>)}
                              </select>
                              <select value={color} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                                const cur = s[id] || def
                                return { ...s, [id]: { ...cur, color: e.target.value } }
                              })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[90px]" title="Màu">
                                {FURNITURE_COLORS.map((c) => <option key={c.value || 'n'} value={c.value}>{c.label}</option>)}
                              </select>
                            </>
                          )}
                          {selType === 'style' && (
                            <select value={style} onChange={(e) => setSelectedFurnitureForAdd((s) => {
                              const cur = s[id] || def
                              return { ...s, [id]: { ...cur, style: e.target.value } }
                            })} className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] max-w-[110px]" title="Phong cách">
                              {FURNITURE_STYLE_OPTIONS.map((o) => <option key={o.value || 'n'} value={o.value}>{o.label}</option>)}
                            </select>
                          )}
                          <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-slate-500 hover:text-red-600 text-xs" onClick={() => setSelectedFurnitureForAdd((s) => { const n = { ...s }; delete n[id]; return n })}>×</Button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Input placeholder="VD: thêm bộ sofa màu xám (nhập thêm nếu cần)" value={addItemsPrompt} onChange={(e) => setAddItemsPrompt(e.target.value)} className="bg-white/80" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Sun className="h-3 w-3" /> Thời gian</h4>
                  <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    <option value="">Mặc định</option>
                    <option value="ban-ngay">Ban ngày</option>
                    <option value="hoang-hon">Hoàng hôn</option>
                    <option value="dem">Đêm</option>
                  </select>
                </div>
                {spaceType === 'interior' && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1"><ImagePlus className="h-3 w-3" /> Loại phòng (staging)</h4>
                  <select value={stagingRoomType} onChange={(e) => setStagingRoomType(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    {ROOM_TYPES.map((t) => (
                      <option key={t.value || 'none'} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                )}
              </div>
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ảnh tham khảo phong cách</h4>
                <div className="flex gap-2 items-center">
                  <input ref={referenceInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                  }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => referenceInputRef.current?.click()} className="shrink-0">
                    <ImagePlus className="h-4 w-4 mr-1" /> Chọn ảnh
                  </Button>
                  {referenceImage && (
                    <div className="flex-1 flex items-center gap-2">
                      <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                        <img src={referenceImage.preview} alt="Ref" className="w-full h-full object-cover" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setReferenceImage(null)}>Xóa</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Card className="border border-slate-200/80 shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Chọn hành động</CardTitle>
                <CardDescription className="text-xs">Áp dụng: 1,5–3 credits</CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {spaceType === 'exterior-facade' ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Building2 className="h-3 w-3" /> Chủ đề kiến trúc</h4>
                    <select value={selectedArchTheme} onChange={(e) => setSelectedArchTheme(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      {Object.entries(ARCH_THEMES).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground">Phong cách kiến trúc thế giới</p>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1 mt-2"><Palette className="h-3 w-3" /> Màu chính mặt tiền</h4>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— Không chọn —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">Màu phụ / điểm nhấn</h4>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— Không chọn —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Palette className="h-3 w-3" /> Màu chính không gian</h4>
                    <select value={selectedMainColor} onChange={(e) => setSelectedMainColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                    {detectedDominantColor && <p className="text-[10px] text-muted-foreground">AI phát hiện: {detectedDominantColor}</p>}
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">Màu phụ / điểm nhấn</h4>
                    <select value={selectedSecondaryColor} onChange={(e) => setSelectedSecondaryColor(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                      <option value="">— Không chọn —</option>
                      {Object.entries(MAIN_COLORS).map(([k]) => (
                        <option key={k} value={k}>{k.charAt(0).toUpperCase() + k.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phong cách mặc định</h4>
                  <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full px-3 py-2 rounded-md border border-gray-200 bg-white/80 text-sm">
                    {STYLES_FROM_CONSTANTS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">Phong cách không gian khi thêm đồ mới</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chất lượng & số phiên bản</h4>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImageQuality('2K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    2K (1,5)
                    </button>
                    <button type="button" onClick={() => setImageQuality('4K')} className={`flex-1 px-3 py-2 rounded-md border text-xs font-medium ${imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    4K (3)
                    </button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-muted-foreground">Phiên bản:</span>
                    {[1, 2, 3].map((n) => (
                      <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ước tính: {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credits</p>
                </div>
                {structuralItemsToConfirm.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kết cấu cần xác nhận</h4>
                    <p className="text-[10px] text-muted-foreground">AI chưa rõ loại – chọn giúp để thiết kế đúng</p>
                    <div className="space-y-2 max-h-[180px] overflow-y-auto">
                      {structuralItemsToConfirm.map((s) => {
                        const opts = s.category === 'door' ? DOOR_TYPE_OPTIONS : s.category === 'window' ? WINDOW_TYPE_OPTIONS : WALL_TYPE_OPTIONS
                        return (
                          <div key={s.id} className="p-2 rounded-lg border border-sky-200/80 bg-sky-50/50 text-sm">
                            <div className="font-medium text-sky-900">{s.item}</div>
                            {s.position && <div className="text-[10px] text-sky-700/80 mt-0.5">Vị trí: {s.position}</div>}
                            <select
                              value={s.userCorrectedType}
                              onChange={(e) => setStructuralItemCorrectedType(s.id, e.target.value)}
                              className="mt-1.5 w-full px-2 py-1.5 rounded border border-sky-200 bg-white text-xs"
                            >
                              {opts.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
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
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Đồ nội thất</h4>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAllItemsAction('keep')} className="px-2 py-0.5 text-[10px] rounded bg-emerald-100 text-emerald-800">Tất cả Giữ</button>
                      <button type="button" onClick={() => setAllItemsAction('redesign')} className="px-2 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">Tất cả Thay đổi</button>
                      <button type="button" onClick={() => setAllItemsAction('delete')} className="px-2 py-0.5 text-[10px] rounded bg-red-100 text-red-800">Tất cả Xóa</button>
                    </div>
                  </div>
                  {furnitureList.map((f) => (
                    <div key={f.id} className="p-3 rounded-lg border bg-muted/30 text-sm">
                      <div className="font-medium">{f.item}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {f.position && <span className="text-emerald-600/80">Vị trí: {f.position}</span>}
                        {f.position && (f.color || f.material) && ' • '}
                        {f.color && `Màu: ${f.color}`} {f.material && `| ${f.material}`}
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'keep')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'keep' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          Giữ
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'redesign')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'redesign' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          <Brush className="inline h-3 w-3 mr-0.5" /> Thay đổi
                        </button>
                        <button
                          type="button"
                          onClick={() => setItemAction(f.id, 'delete')}
                          className={`px-2 py-1 text-xs rounded ${f.action === 'delete' ? 'bg-red-100 text-red-800' : 'bg-gray-100 hover:bg-gray-200'}`}
                        >
                          <Eraser className="inline h-3 w-3 mr-0.5" /> Xóa
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
                              Thay bằng cái khác
                            </button>
                            <button
                              type="button"
                              onClick={() => setItemRedesignType(f.id, 'rearrange')}
                              className={`px-2 py-1 text-xs rounded ${f.redesignType === 'rearrange' ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 hover:bg-amber-100 border border-amber-200'}`}
                            >
                              Thay đổi kiểu sắp xếp
                            </button>
                          </div>
                          {f.redesignType === 'replace' && (
                            <>
                              <Input
                                placeholder="Để trống = thay bằng món cùng loại. Hoặc gõ cụ thể (VD: bàn gỗ, ghế sofa xám...)"
                                value={f.redesignReplaceWith ?? ''}
                                onChange={(e) => setItemRedesignReplaceWith(f.id, e.target.value)}
                                className="h-8 text-xs bg-amber-50/50 border-amber-200"
                              />
                              <p className="text-[10px] text-muted-foreground">Trống = thay bằng món khác cùng loại. Có nội dung = thay bằng món cụ thể.</p>
                            </>
                          )}
                          {f.redesignType === 'rearrange' && (
                            <>
                              <Input
                                placeholder="Mô tả thay đổi (VD: thêm trải bàn, đổi màu xám, sắp xếp lại gọn gàng...)"
                                value={f.redesignRearrangePrompt ?? ''}
                                onChange={(e) => setItemRedesignRearrangePrompt(f.id, e.target.value)}
                                className="h-8 text-xs bg-amber-50/50 border-amber-200"
                              />
                              <p className="text-[10px] text-muted-foreground">Giữ món đó, chỉ thay đổi cách sắp xếp/màu sắc/trang trí.</p>
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
                <CardTitle className="text-sm font-medium">Thao tác chính</CardTitle>
                <CardDescription className="text-xs">Ước tính {(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-medium text-muted-foreground">Chất lượng:</span>
                  <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'}`}>2K</button>
                  <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:bg-slate-50'}`}>4K</button>
                  <span className="text-xs font-medium text-muted-foreground ml-2">Phiên bản:</span>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setVariantCount(n)} className={`px-2 py-1 rounded text-xs font-medium ${variantCount === n ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 hover:bg-slate-200'}`}>{n}</button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                {undoStack.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleUndo} className="shrink-0">
                    <Undo2 className="h-3 w-3 mr-1" /> Undo
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={saveDraft} className="shrink-0"><Save className="h-3 w-3 mr-1" /> Lưu nháp</Button>
                <Button variant="outline" size="sm" onClick={loadDraft} className="shrink-0"><FolderOpen className="h-3 w-3 mr-1" /> Tải nháp</Button>
                <DepositCreditButton variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" />
                <Button onClick={() => checkCreditsAndProceed(APPLY_COSTS[imageQuality] * variantCount, handleApply)} disabled={!getImageForApply()} className="h-9 text-sm bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Sparkles className="mr-2 h-4 w-4" /> Tạo ({(APPLY_COSTS[imageQuality] * variantCount).toFixed(1)} credit)
                </Button>
                {currentImageUrl && (
                  <Button variant="outline" size="sm" onClick={() => checkCreditsAndProceed(ANALYZE_CREDIT, handleReanalyze)}>
                    <Scan className="mr-2 h-3 w-3" /> Phân tích lại ({ANALYZE_CREDIT} credit)
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleReset}>Bắt đầu mới</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'GENERATING' && (
            <Card className="border border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader mode="interior" title="Đang áp dụng thay đổi" description="AI đang xóa, thay đổi món chọn" imagePreview={displayImage} />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border border-slate-200/80 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-medium">Kết quả</CardTitle>
              <CardDescription className="text-xs">
                {rotationHistory.length > 1 ? 'Bấm Trước/Sau để xem các góc quay. Kéo thanh trượt để so sánh.' : 'Ảnh đã được áp dụng. Kéo thanh trượt để so sánh trước/sau.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rotationHistory.length > 1 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRotationHistoryIndex((i) => Math.max(0, i - 1))} disabled={rotationHistoryIndex <= 0}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Trước
                    </Button>
                    <span className="text-xs text-muted-foreground">Góc {rotationHistoryIndex + 1}/{rotationHistory.length}</span>
                    <Button variant="outline" size="sm" onClick={() => setRotationHistoryIndex((i) => Math.min(rotationHistory.length - 1, i + 1))} disabled={rotationHistoryIndex >= rotationHistory.length - 1}>
                      Sau <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  {rotationHistoryIndex > 0 && rotationHistory[rotationHistoryIndex - 1] && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">So sánh góc trước / góc hiện tại</h3>
                      <CompareSlider before={rotationHistory[rotationHistoryIndex - 1]} after={rotationHistory[rotationHistoryIndex]} className="max-h-[400px]" />
                    </div>
                  )}
                  {rotationHistoryIndex === 0 && (
                    <div className="aspect-video rounded-lg border overflow-hidden">
                      <ImagePreview src={rotationHistory[0]} alt="Góc gốc" className="w-full h-full object-contain" />
                    </div>
                  )}
                </div>
              ) : displayImage ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">So sánh trước / sau</h3>
                  <CompareSlider before={displayImage} after={resultUrl} className="max-h-[400px]" />
                </div>
              ) : null}
              {resultUrls.length > 1 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Các phiên bản ({resultUrls.length})</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {resultUrls.map((url, i) => (
                      <div key={i} className="space-y-1">
                        <div className="aspect-square rounded-lg border overflow-hidden">
                          <ImagePreview src={url} alt={`Kết quả ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleContinueEdit(url)}>
                            <Check className="h-3 w-3 mr-1" /> Dùng
                          </Button>
                          <DownloadImageButton imageUrl={url} filename={`interior-${i + 1}`} variant="outline" size="sm" showLabel={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleContinueEdit(displayImage || undefined)} disabled={!displayImage}>
                  <Check className="mr-2 h-3 w-3" /> Tiếp tục sửa với ảnh cũ
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleContinueEdit(resultUrl)}>
                  <Check className="mr-2 h-3 w-3" /> Tiếp tục sửa với ảnh mới
                </Button>
                {resultUrls.length === 1 && (
                  <DownloadImageButton imageUrl={resultUrl} filename="interior-result" variant="outline" size="sm" />
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={exportPdf}>
                  <FileDown className="mr-2 h-3 w-3" /> Xuất PDF
                </Button>
                <Button size="sm" variant="outline" onClick={copyShareLink}>
                  <Copy className="mr-2 h-3 w-3" /> Copy link
                </Button>
                <Button size="sm" variant="outline" onClick={handleReset}><RefreshCw className="mr-2 h-3 w-3" /> Bắt đầu mới</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Ảnh do AI tạo có thể có sai sót.</p>
    </>
  )
}
