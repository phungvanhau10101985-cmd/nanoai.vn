'use client'
/* eslint-disable @next/next/no-img-element -- packaging previews use generated/data/blob image URLs */

import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'

import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react'
import * as XLSX from 'xlsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useCredits } from '@/hooks/use-credits'
import { Toaster } from '@/components/ui/toaster'
import { Box, ShoppingBag, Sparkles, Upload, X, ImageIcon, LayoutTemplate, FileText, FileEdit, Eye, ChevronLeft, ChevronRight, Trash2, FolderOpen, Plus, Eraser, FileSpreadsheet, FileDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { createBoxSurfaceImageWithAI, createBoxMockupFromFaces, createBagSurfaceImageWithAI, createBagMockupFromFlat, generateBoxDielinePdf, type PackagingDesignType } from './actions'
import { type BagType } from './bag-types'
import { getDimensionsFromSizeKey, getSizeKeyLabel, FACE_SIZE_KEYS, type FaceSizeKey } from './lib/box-face-sizes'
import { useRouter } from 'next/navigation'

/** faceIndex 1–3 cho API: LxW=1, LxH=2, WxH=3 */
const FACE_ORDER: FaceSizeKey[] = ['LxW', 'LxH', 'WxH']
const getFaceIndexFromSizeKey = (sizeKey: FaceSizeKey) => FACE_ORDER.indexOf(sizeKey) + 1
import { getAspectRatioFromDimensions, GEMINI_ASPECT_RATIO_LIST } from '@/lib/aspect-ratio-from-dimensions'
import { GEMINI_ASPECT_RATIO_OPTIONS } from '@/lib/label-size-presets'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  finalizeStandardImageGenerationResult,
  waitForNextPaintClient,
} from '@/lib/client/finalize-standard-image-generation-result'

const DESIGN_TABS: { value: PackagingDesignType; icon: typeof Box }[] = [
  { value: 'box', icon: Box },
  { value: 'bag', icon: ShoppingBag },
]

/** Tỷ lệ khung hình – dùng chung với tao-nhan, đầy đủ từ label-size-presets */
const ASPECT_RATIOS = GEMINI_ASPECT_RATIO_OPTIONS

/** Không ràng buộc kích thước hộp và ảnh – nhập tự do, tất cả tạo được. */

const STYLES = [
  { value: 'modern', labelVi: 'Hiện đại', labelEn: 'Modern' },
  { value: 'luxury', labelVi: 'Cao cấp', labelEn: 'Luxury' },
  { value: 'natural', labelVi: 'Tự nhiên', labelEn: 'Natural' },
  { value: 'vibrant', labelVi: 'Rực rỡ', labelEn: 'Vibrant' },
]

const BORDER_STYLES: { value: string; labelVi: string; labelEn: string; labelZh: string; labelJa: string; labelKo: string }[] = [
  { value: 'single', labelVi: 'Viền đơn', labelEn: 'Single line', labelZh: '单线', labelJa: '単線', labelKo: '단선' },
  { value: 'double', labelVi: 'Viền đôi', labelEn: 'Double line', labelZh: '双线', labelJa: '二重線', labelKo: '이중선' },
  { value: 'dotted', labelVi: 'Viền chấm', labelEn: 'Dotted', labelZh: '点线', labelJa: '点線', labelKo: '점선' },
  { value: 'dashed', labelVi: 'Viền nét đứt', labelEn: 'Dashed', labelZh: '虚线', labelJa: '破線', labelKo: '파선' },
  { value: 'rounded', labelVi: 'Viền bo góc', labelEn: 'Rounded corners', labelZh: '圆角', labelJa: '角丸', labelKo: '모서리 둥글게' },
  { value: 'decorative', labelVi: 'Viền trang trí', labelEn: 'Decorative', labelZh: '装饰', labelJa: '装飾', labelKo: '장식' },
]

const BACKGROUND_OPTIONS: { value: string; labelVi: string; labelEn: string; labelZh: string; labelJa: string; labelKo: string }[] = [
  { value: 'transparent', labelVi: 'Màu bìa carton', labelEn: 'Carton color', labelZh: '纸板色', labelJa: '段ボール色', labelKo: '골판지색' },
  { value: 'ai', labelVi: 'AI tự chọn', labelEn: 'AI chooses', labelZh: 'AI选择', labelJa: 'AIが選択', labelKo: 'AI 선택' },
  { value: 'white', labelVi: 'Trắng', labelEn: 'White', labelZh: '白色', labelJa: '白', labelKo: '흰색' },
  { value: 'offwhite', labelVi: 'Trắng ngà', labelEn: 'Off-white', labelZh: '米白', labelJa: 'オフホワイト', labelKo: '아이보리' },
  { value: 'cream', labelVi: 'Kem', labelEn: 'Cream', labelZh: '奶油色', labelJa: 'クリーム', labelKo: '크림' },
  { value: 'beige', labelVi: 'Be', labelEn: 'Beige', labelZh: '米色', labelJa: 'ベージュ', labelKo: '베이지' },
  { value: 'sand', labelVi: 'Cát', labelEn: 'Sand', labelZh: '沙色', labelJa: 'サンド', labelKo: '샌드' },
  { value: 'lightgray', labelVi: 'Xám nhạt', labelEn: 'Light gray', labelZh: '浅灰', labelJa: 'ライトグレー', labelKo: '연한 회색' },
  { value: 'lightblue', labelVi: 'Xanh nhạt', labelEn: 'Light blue', labelZh: '浅蓝', labelJa: 'ライトブルー', labelKo: '연한 파랑' },
  { value: 'mint', labelVi: 'Bạc hà', labelEn: 'Mint', labelZh: '薄荷绿', labelJa: 'ミント', labelKo: '민트' },
  { value: 'lightpink', labelVi: 'Hồng pastel', labelEn: 'Light pink', labelZh: '浅粉', labelJa: 'ライトピンク', labelKo: '연한 분홍' },
  { value: 'lavender', labelVi: 'Oải hương', labelEn: 'Lavender', labelZh: '薰衣草', labelJa: 'ラベンダー', labelKo: '라벤더' },
  { value: 'lightyellow', labelVi: 'Vàng nhạt', labelEn: 'Light yellow', labelZh: '浅黄', labelJa: 'ライトイエロー', labelKo: '연한 노랑' },
  { value: 'lightgreen', labelVi: 'Xanh lá nhạt', labelEn: 'Light green', labelZh: '浅绿', labelJa: 'ライトグリーン', labelKo: '연한 초록' },
  { value: 'peach', labelVi: 'Đào', labelEn: 'Peach', labelZh: '桃色', labelJa: 'ピーチ', labelKo: '피치' },
  { value: 'charcoal', labelVi: 'Xám đậm', labelEn: 'Charcoal', labelZh: '深灰', labelJa: 'チャコール', labelKo: '차콜' },
  { value: 'navy', labelVi: 'Xanh navy', labelEn: 'Navy', labelZh: '藏青', labelJa: 'ネイビー', labelKo: '네이비' },
  { value: 'black', labelVi: 'Đen', labelEn: 'Black', labelZh: '黑色', labelJa: '黒', labelKo: '검정' },
  { value: 'patterned', labelVi: 'Nền hoa văn', labelEn: 'Patterned', labelZh: '图案背景', labelJa: '模様背景', labelKo: '패턴 배경' },
]

const BAG_TYPE_LABELS: { value: BagType; labelVi: string; labelEn: string; labelZh: string; labelJa: string; labelKo: string }[] = [
  { value: 'stand-up-pouch', labelVi: 'Túi đứng', labelEn: 'Stand-up pouch', labelZh: '立式袋', labelJa: 'スタンドパウチ', labelKo: '스탠드 파우치' },
  { value: 'flat-pouch', labelVi: 'Túi phẳng', labelEn: 'Flat pouch', labelZh: '平袋', labelJa: 'フラットパウチ', labelKo: '플랫 파우치' },
  { value: 'side-gusset', labelVi: 'Túi đáy bên', labelEn: 'Side gusset bag', labelZh: '侧边风琴袋', labelJa: 'サイドガセット袋', labelKo: '사이드 거셋 백' },
  { value: 'paper-bag', labelVi: 'Túi giấy có quai', labelEn: 'Paper bag with handles', labelZh: '纸袋带提手', labelJa: '紙袋（取っ手付き）', labelKo: '손잡이 종이백' },
  { value: 'pillow-pouch', labelVi: 'Túi gối', labelEn: 'Pillow pouch', labelZh: '枕形袋', labelJa: 'ピローパウチ', labelKo: '필로우 파우치' },
  { value: 'zipper-pouch', labelVi: 'Túi khóa kéo', labelEn: 'Zipper pouch', labelZh: '拉链袋', labelJa: 'ジッパーパウチ', labelKo: '지퍼 파우치' },
  { value: 'three-side-seal', labelVi: 'Túi 3 mép seal', labelEn: 'Three-side seal', labelZh: '三边封袋', labelJa: '三辺シール袋', labelKo: '3면 실 파우치' },
  { value: 'four-side-seal', labelVi: 'Túi 4 mép seal', labelEn: 'Four-side seal', labelZh: '四边封袋', labelJa: '四辺シール袋', labelKo: '4면 실 파우치' },
  { value: 'doypack', labelVi: 'Túi Doypack', labelEn: 'Doypack', labelZh: '自立袋', labelJa: 'ドイパック', labelKo: '도이팩' },
  { value: 'kraft-paper', labelVi: 'Túi kraft', labelEn: 'Kraft paper bag', labelZh: '牛皮纸袋', labelJa: 'クラフト紙袋', labelKo: '크라프트 종이백' },
  { value: 'mesh-bag', labelVi: 'Túi lưới', labelEn: 'Mesh bag', labelZh: '网袋', labelJa: 'メッシュ袋', labelKo: '메쉬 백' },
  { value: 'vacuum-bag', labelVi: 'Túi hút chân không', labelEn: 'Vacuum bag', labelZh: '真空袋', labelJa: '真空パック', labelKo: '진공 백' },
  { value: 'retort-pouch', labelVi: 'Túi retort', labelEn: 'Retort pouch', labelZh: '蒸煮袋', labelJa: 'レトルトパウチ', labelKo: '레토르트 파우치' },
  { value: 'window-pouch', labelVi: 'Túi có cửa sổ', labelEn: 'Window pouch', labelZh: '开窗袋', labelJa: '窓付きパウチ', labelKo: '윈도우 파우치' },
  { value: 'gusset-bottom', labelVi: 'Túi đáy gusset', labelEn: 'Gusset bottom', labelZh: '底风琴袋', labelJa: '底ガセット袋', labelKo: '바닥 거셋 백' },
  { value: 'flat-bottom', labelVi: 'Túi đáy phẳng', labelEn: 'Flat bottom', labelZh: '平底袋', labelJa: '平底袋', labelKo: '플랫 바닥 백' },
  { value: 'handle-bag', labelVi: 'Túi có quai', labelEn: 'Handle bag', labelZh: '提手袋', labelJa: '取っ手付き袋', labelKo: '손잡이 백' },
  { value: 'drawstring', labelVi: 'Túi rút dây', labelEn: 'Drawstring bag', labelZh: '抽绳袋', labelJa: '巾着袋', labelKo: '드로스트링 백' },
  { value: 'slider-pouch', labelVi: 'Túi slider', labelEn: 'Slider pouch', labelZh: '滑条袋', labelJa: 'スライダーパウチ', labelKo: '슬라이더 파우치' },
  { value: 'spout-pouch', labelVi: 'Túi có vòi', labelEn: 'Spout pouch', labelZh: '带嘴袋', labelJa: 'スポートパウチ', labelKo: '스파우트 파우치' },
]

const PATTERN_OPTIONS: { value: string; labelVi: string; labelEn: string; labelZh: string; labelJa: string; labelKo: string }[] = [
  { value: 'waves', labelVi: 'Sóng', labelEn: 'Waves', labelZh: '波浪', labelJa: '波', labelKo: '물결' },
  { value: 'geometric', labelVi: 'Hình học', labelEn: 'Geometric', labelZh: '几何', labelJa: '幾何学', labelKo: '기하학' },
  { value: 'traditional', labelVi: 'Truyền thống', labelEn: 'Traditional', labelZh: '传统', labelJa: '伝統', labelKo: '전통' },
  { value: 'dots', labelVi: 'Chấm tròn', labelEn: 'Dots', labelZh: '圆点', labelJa: 'ドット', labelKo: '도트' },
  { value: 'floral', labelVi: 'Hoa lá', labelEn: 'Floral', labelZh: '花卉', labelJa: '花柄', labelKo: '플로럴' },
  { value: 'stripes', labelVi: 'Sọc', labelEn: 'Stripes', labelZh: '条纹', labelJa: 'ストライプ', labelKo: '스트라이프' },
]

type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = readWebLocaleFromDocumentCookie()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

type Step =
  | 'INPUT'
  | 'FACE_INPUT'
  | 'FACE_GENERATING'
  | 'FACE_RESULT'
  | 'MOCKUP_INPUT'
  | 'MOCKUP_GENERATING'
  | 'MOCKUP_RESULT'
  | 'GENERATING'
  | 'RESULT'

const DRAFT_KEY = 'thiet-ke-bao-bi-draft'
const PROJECTS_KEY = 'thiet-ke-bao-bi-projects'
const PROJECTS_RETENTION_DAYS = 30

type CreatedFace = { id: string; sizeKey: FaceSizeKey; url: string }

type ProjectItem = {
  id: string
  createdAt: number
  designType: PackagingDesignType
  brandName: string
  productName: string
  companyAddress?: string
  website?: string
  email?: string
  hotline?: string
  countryOfOrigin?: string
  storageInstructions?: string
  warningAllergy?: string
  volume?: string
  registrationCode?: string
  socialLinks?: string
  faces: CreatedFace[]
  face1Url?: string | null
  face2Url?: string | null
  face3Url?: string | null
  mockupResultUrl: string | null
  resultUrl: string | null
  boxLength: number
  boxWidth: number
  boxHeight: number
  surfaceLength: number
  surfaceWidth: number
  textOrientation: 'horizontal' | 'vertical'
  hasBorder: boolean
  borderStyle: string
  backgroundType: string
  patternStyle: string
  style: string
  imageQuality: '2K' | '4K'
  aspectRatio: string
  bagWidth: number
  bagHeight: number
  bagGusset: number
  bagType?: BagType
  contentBlocks: { id: string; label: string; content: string }[]
  packagingQuantity: string
  packagingWeight: string
  packagingShipping: string
  packagingOther: string
  manufacturerMessage: string
  packagingBatchLot: string
  packagingProdDate: string
  packagingExpiryDate: string
  includeBoxDims: boolean
}

function getProjects(): ProjectItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as ProjectItem[]
    const cutoff = Date.now() - PROJECTS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    const filtered = list.filter((p) => p.createdAt >= cutoff)
    if (filtered.length !== list.length) {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(filtered))
    }
    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

function saveProject(item: Omit<ProjectItem, 'id' | 'createdAt'>): void {
  if (typeof window === 'undefined') return
  try {
    const list = getProjects()
    const newItem: ProjectItem = {
      ...item,
      id: `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    }
    list.unshift(newItem)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function removeProject(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const list = getProjects().filter((p) => p.id !== id)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

type DraftState = {
  step: Step
  designType: PackagingDesignType
  brandName: string
  productName: string
  companyAddress?: string
  website?: string
  email?: string
  hotline?: string
  countryOfOrigin?: string
  storageInstructions?: string
  warningAllergy?: string
  volume?: string
  registrationCode?: string
  socialLinks?: string
  contentBlocks: { id: string; label: string; content: string }[]
  faces: CreatedFace[]
  face1Url?: string | null
  face2Url?: string | null
  face3Url?: string | null
  mockupResultUrl: string | null
  resultUrl: string | null
  boxLength: number
  boxWidth: number
  boxHeight: number
  surfaceLength: number
  surfaceWidth: number
  textOrientation: 'horizontal' | 'vertical'
  hasBorder: boolean
  borderStyle: string
  backgroundType: string
  patternStyle: string
  packagingQuantity: string
  packagingWeight: string
  packagingShipping: string
  packagingOther: string
  manufacturerMessage: string
  packagingBatchLot: string
  packagingProdDate: string
  packagingExpiryDate: string
  includeBoxDims: boolean
  style: string
  imageQuality: '2K' | '4K'
  aspectRatio: string
  bagWidth: number
  bagHeight: number
  bagGusset: number
  bagType: BagType
  updatedAt: number
}

export default function ThietKeBaoBiClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('INPUT')
  const [designType, setDesignType] = useState<PackagingDesignType>('box')
  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [hotline, setHotline] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('')
  const [storageInstructions, setStorageInstructions] = useState('')
  const [warningAllergy, setWarningAllergy] = useState('')
  const [volume, setVolume] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [socialLinks, setSocialLinks] = useState('')
  type ContentBlock = { id: string; label: string; content: string }
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(() => [{ id: `cb-${Date.now()}`, label: '', content: '' }])
  const [style, setStyle] = useState('modern')
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  /** Ảnh tham khảo kiểu mẫu (chỉ face 1). Khi có vẫn hiển thị chọn màu nền và khung viền. */
  const [referenceImage, setReferenceImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [productImages, setProductImages] = useState<{ file: File; preview: string }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [aspectRatio, setAspectRatio] = useState('1:1')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  // Box: L×W×H mm – nhập tự do, không ràng buộc tỷ lệ
  const [boxLength, setBoxLength] = useState(200)
  const [boxWidth, setBoxWidth] = useState(150)
  const [boxHeight, setBoxHeight] = useState(100)
  const [boxWidthInput, setBoxWidthInput] = useState('150')
  const [boxHeightInput, setBoxHeightInput] = useState('100')
  // Box flow: 1–6 faces + mockup
  const [faces, setFaces] = useState<CreatedFace[]>([])
  const [selectedFaceSize, setSelectedFaceSize] = useState<FaceSizeKey | null>('LxW')
  const [lastCreatedFace, setLastCreatedFace] = useState<CreatedFace | null>(null)
  const [mockupResultUrl, setMockupResultUrl] = useState<string | null>(null)
  const router = useRouter()
  /** Khi sửa ảnh từ MOCKUP_INPUT/MOCKUP_RESULT, Back quay về đúng bước đó */
  const [returnToStep, setReturnToStep] = useState<'MOCKUP_INPUT' | 'MOCKUP_RESULT' | 'FACE_RESULT' | null>(null)
  /** Khi sửa ảnh, lưu sizeKey cần thay thế – ảnh mới tạo ra sẽ thay đúng vị trí */
  const [editingFaceSizeKey, setEditingFaceSizeKey] = useState<FaceSizeKey | null>(null)
  // Surface: 2 dims (flat face) - derived from selectedFaceSize
  const [surfaceLength, setSurfaceLength] = useState(200)
  const [surfaceWidth, setSurfaceWidth] = useState(150)
  const [textOrientation, setTextOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [hasBorder, setHasBorder] = useState(false)
  const [borderStyle, setBorderStyle] = useState<string>('single')
  const [backgroundType, setBackgroundType] = useState<string>('transparent')
  const [patternStyle, setPatternStyle] = useState<string>('waves')
  // Optional packaging info - only include in design when provided
  const [packagingQuantity, setPackagingQuantity] = useState('')
  const [packagingWeight, setPackagingWeight] = useState('')
  const [packagingShipping, setPackagingShipping] = useState('')
  const [packagingOther, setPackagingOther] = useState('')
  const [manufacturerMessage, setManufacturerMessage] = useState('')
  const [packagingBatchLot, setPackagingBatchLot] = useState('')
  const [packagingProdDate, setPackagingProdDate] = useState('')
  const [packagingExpiryDate, setPackagingExpiryDate] = useState('')
  const [includeBoxDims, setIncludeBoxDims] = useState(false)
  // Bag: W×H×G mm
  const [bagWidth, setBagWidth] = useState(200)
  const [bagHeight, setBagHeight] = useState(280)
  const [bagGusset, setBagGusset] = useState(60)
  const [bagType, setBagType] = useState<BagType>('stand-up-pouch')
  const [dielineLoading, setDielineLoading] = useState(false)
  const [quickViewFlatOpen, setQuickViewFlatOpen] = useState(false)
  const [quickView3dOpen, setQuickView3dOpen] = useState(false)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const logoInputRef = useRef<HTMLInputElement>(null)
  const referenceImageInputRef = useRef<HTMLInputElement>(null)
  const productImageInputRef = useRef<HTMLInputElement>(null)
  const excelImportRef = useRef<HTMLInputElement>(null)
  const stepContentRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const cost = imageQuality === '2K' ? 1.5 : 3

  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }
  const genClient = useMemo(() => getDictionary(uiLocale).imageGenerationClient, [uiLocale])

  const tabLabel = (type: PackagingDesignType) => {
    if (type === 'box') return tr('Hộp carton', 'Carton box', '纸箱', '段ボール箱', '골판지 상자')
    return tr('Túi đựng', 'Flat bag', '平面袋', '平面袋', '평면 가방')
  }
  const opt = tr(' (tùy chọn)', ' (optional)', '（可选）', '（任意）', ' (선택)')
  const getBgLabel = (b: (typeof BACKGROUND_OPTIONS)[number]) => {
    if (uiLocale === 'en') return b.labelEn
    if (uiLocale === 'zh') return b.labelZh
    if (uiLocale === 'ja') return b.labelJa
    if (uiLocale === 'ko') return b.labelKo
    return b.labelVi
  }
  const getBorderLabel = (b: (typeof BORDER_STYLES)[number]) => {
    if (uiLocale === 'en') return b.labelEn
    if (uiLocale === 'zh') return b.labelZh
    if (uiLocale === 'ja') return b.labelJa
    if (uiLocale === 'ko') return b.labelKo
    return b.labelVi
  }
  const getPatternLabel = (p: (typeof PATTERN_OPTIONS)[number]) => {
    if (uiLocale === 'en') return p.labelEn
    if (uiLocale === 'zh') return p.labelZh
    if (uiLocale === 'ja') return p.labelJa
    if (uiLocale === 'ko') return p.labelKo
    return p.labelVi
  }
  const getBagTypeLabel = (b: (typeof BAG_TYPE_LABELS)[number]) => {
    if (uiLocale === 'en') return b.labelEn
    if (uiLocale === 'zh') return b.labelZh
    if (uiLocale === 'ja') return b.labelJa
    if (uiLocale === 'ko') return b.labelKo
    return b.labelVi
  }

  useEffect(() => {
    const syncLocale = () => setUiLocale(getWebLocaleFromCookie())
    syncLocale()
    const timer = window.setInterval(syncLocale, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const refreshProjects = () => setProjects(getProjects())

  useEffect(() => {
    refreshProjects()
  }, [])

  const saveDraft = () => {
    if (typeof window === 'undefined') return
    const draft: DraftState = {
      step,
      designType,
      brandName,
      productName,
      companyAddress,
      website,
      email,
      hotline,
      countryOfOrigin,
      storageInstructions,
      warningAllergy,
      volume,
      registrationCode,
      socialLinks,
      contentBlocks,
      faces,
      mockupResultUrl,
      resultUrl,
      boxLength,
      boxWidth,
      boxHeight,
      surfaceLength,
      surfaceWidth,
      textOrientation,
      hasBorder,
      borderStyle,
      backgroundType,
      patternStyle,
      packagingQuantity,
      packagingWeight,
      packagingShipping,
      packagingOther,
      manufacturerMessage,
      packagingBatchLot,
      packagingProdDate,
      packagingExpiryDate,
      includeBoxDims,
      style,
      imageQuality,
      aspectRatio,
      bagWidth,
      bagHeight,
      bagGusset,
      bagType,
      updatedAt: Date.now(),
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setDraftExists(true)
    } catch {
      /* ignore */
    }
  }

  const loadDraft = () => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as DraftState & { face1Url?: string; face2Url?: string; face3Url?: string }
      const loadedFaces: CreatedFace[] = draft.faces?.length ? draft.faces : []
      if (loadedFaces.length === 0 && (draft.face1Url || draft.face2Url || draft.face3Url)) {
        if (draft.face1Url) loadedFaces.push({ id: `f-1`, sizeKey: 'LxW', url: draft.face1Url })
        if (draft.face2Url) loadedFaces.push({ id: `f-2`, sizeKey: 'LxH', url: draft.face2Url })
        if (draft.face3Url) loadedFaces.push({ id: `f-3`, sizeKey: 'WxH', url: draft.face3Url })
      }
      let stepToLoad: Step = draft.step
      if (draft.resultUrl && draft.designType === 'bag') {
        stepToLoad = 'RESULT'
      } else if (draft.mockupResultUrl) {
        stepToLoad = 'MOCKUP_RESULT'
      } else if (loadedFaces.length >= 1) {
        stepToLoad = loadedFaces.length >= 6 ? 'MOCKUP_INPUT' : 'FACE_INPUT'
      }
      setStep(stepToLoad)
      setFaces(loadedFaces)
      setSelectedFaceSize('LxW')
      setLastCreatedFace(loadedFaces[loadedFaces.length - 1] ?? null)
      setEditingFaceSizeKey(null)
      setDesignType(draft.designType)
      setBrandName(draft.brandName)
      setProductName(draft.productName)
      setCompanyAddress(draft.companyAddress ?? '')
      setWebsite(draft.website ?? '')
      setEmail(draft.email ?? '')
      setHotline(draft.hotline ?? '')
      setCountryOfOrigin(draft.countryOfOrigin ?? '')
      setStorageInstructions(draft.storageInstructions ?? '')
      setWarningAllergy(draft.warningAllergy ?? '')
      setVolume(draft.volume ?? '')
      setRegistrationCode(draft.registrationCode ?? '')
      setSocialLinks(draft.socialLinks ?? '')
      setContentBlocks(draft.contentBlocks?.length ? draft.contentBlocks : [{ id: `cb-${Date.now()}`, label: '', content: '' }])
      setMockupResultUrl(draft.mockupResultUrl)
      setResultUrl(draft.resultUrl)
      setBoxLength(draft.boxLength ?? 200)
      setBoxLengthInput(String(draft.boxLength ?? 200))
      setBoxWidth(draft.boxWidth ?? 150)
      setBoxHeight(draft.boxHeight ?? 100)
      setBoxWidthInput(String(draft.boxWidth ?? 150))
      setBoxHeightInput(String(draft.boxHeight ?? 100))
      setSurfaceLength(draft.surfaceLength ?? 200)
      setSurfaceWidth(draft.surfaceWidth ?? 150)
      setTextOrientation(draft.textOrientation ?? 'horizontal')
      setHasBorder(draft.hasBorder ?? false)
      setBorderStyle(draft.borderStyle ?? 'single')
      setBackgroundType(draft.backgroundType ?? 'transparent')
      setPatternStyle(draft.patternStyle ?? 'waves')
      setPackagingQuantity(draft.packagingQuantity ?? '')
      setPackagingWeight(draft.packagingWeight ?? '')
      setPackagingShipping(draft.packagingShipping ?? '')
      setPackagingOther(draft.packagingOther ?? '')
      setManufacturerMessage(draft.manufacturerMessage ?? '')
      setPackagingBatchLot(draft.packagingBatchLot ?? '')
      setPackagingProdDate(draft.packagingProdDate ?? '')
      setPackagingExpiryDate(draft.packagingExpiryDate ?? '')
      setIncludeBoxDims(draft.includeBoxDims ?? false)
      setStyle(draft.style ?? 'modern')
      setImageQuality(draft.imageQuality ?? '2K')
      setAspectRatio(draft.aspectRatio ?? '1:1')
      setBagWidth(draft.bagWidth ?? 200)
      setBagHeight(draft.bagHeight ?? 280)
      setBagGusset(draft.bagGusset ?? 60)
      setBagType(draft.bagType ?? 'stand-up-pouch')
      setReturnToStep(null)
    } catch {
      /* ignore */
    }
  }

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chọn file Excel (.xlsx, .xls, .csv)', 'Select Excel file (.xlsx, .xls, .csv)', '选择 Excel 文件', 'Excelファイルを選択', 'Excel 파일 선택'), variant: 'destructive' })
      e.target.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        if (!data) return
        const wb = XLSX.read(data, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as (string | number)[][]
        const map: Record<string, string> = {}
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i]
          const key = String(row[0] ?? '').trim()
          const val = row[1] != null ? String(row[1]).trim() : ''
          if (key) map[key] = val
        }
        const set = (k: string, fn: (v: string) => void) => { if (map[k] != null) fn(map[k]) }
        set('brandName', setBrandName)
        set('productName', setProductName)
        set('companyAddress', setCompanyAddress)
        set('website', setWebsite)
        set('email', setEmail)
        set('hotline', setHotline)
        set('countryOfOrigin', setCountryOfOrigin)
        set('storageInstructions', setStorageInstructions)
        set('warningAllergy', setWarningAllergy)
        set('volume', setVolume)
        set('registrationCode', setRegistrationCode)
        set('socialLinks', setSocialLinks)
        set('packagingQuantity', setPackagingQuantity)
        set('packagingWeight', setPackagingWeight)
        set('packagingShipping', setPackagingShipping)
        set('packagingOther', setPackagingOther)
        set('packagingBatchLot', setPackagingBatchLot)
        set('packagingProdDate', setPackagingProdDate)
        set('packagingExpiryDate', setPackagingExpiryDate)
        set('manufacturerMessage', setManufacturerMessage)
        toast({ title: tr('Đã import Excel', 'Excel imported', '已导入 Excel', 'Excelをインポートしました', 'Excel 가져옴'), duration: 2000 })
      } catch (err) {
        toast({ title: tr('Lỗi đọc Excel', 'Excel read error', '读取 Excel 失败', 'Excel読み込みエラー', 'Excel 읽기 오류'), description: String(err), variant: 'destructive' })
      }
      if (excelImportRef.current) excelImportRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  const [draftExists, setDraftExists] = useState(false)
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(DRAFT_KEY) : null
      if (!raw) {
        setDraftExists(false)
        return
      }
      const d = JSON.parse(raw) as DraftState
      setDraftExists(!!(d.faces?.length || d.face1Url || d.face2Url || d.face3Url || d.mockupResultUrl || d.resultUrl))
    } catch {
      setDraftExists(false)
    }
  }, [step, faces, mockupResultUrl, resultUrl])

  /** Lưu draft khi state thay đổi – làm đến đâu lưu đúng đến đó */
  useEffect(() => {
    const hasData = !!(faces.length || mockupResultUrl || resultUrl)
    if (!hasData) return
    saveDraft()
  }, [
    step,
    designType,
    brandName,
    productName,
    companyAddress,
    website,
    email,
    hotline,
    countryOfOrigin,
    storageInstructions,
    warningAllergy,
    volume,
    registrationCode,
    socialLinks,
    contentBlocks,
    faces,
    mockupResultUrl,
    resultUrl,
    boxLength,
    boxWidth,
    boxHeight,
    surfaceLength,
    surfaceWidth,
    textOrientation,
    hasBorder,
    borderStyle,
    backgroundType,
    patternStyle,
    packagingQuantity,
    packagingWeight,
    packagingShipping,
    packagingOther,
    manufacturerMessage,
    packagingBatchLot,
    packagingProdDate,
    packagingExpiryDate,
    includeBoxDims,
    style,
    imageQuality,
    aspectRatio,
    bagWidth,
    bagHeight,
    bagGusset,
    bagType,
  ])

  /** Chuỗi nhập chiều dài – cập nhật khi blur để tránh nhảy số khi gõ. */
  const [boxLengthInput, setBoxLengthInput] = useState('200')

  useEffect(() => {
    if (selectedFaceSize) {
      const [len, wid] = getDimensionsFromSizeKey(selectedFaceSize, boxLength, boxWidth, boxHeight)
      setSurfaceLength(len)
      setSurfaceWidth(wid)
    }
  }, [selectedFaceSize, boxLength, boxWidth, boxHeight])

  useEffect(() => {
    if (['FACE_GENERATING', 'FACE_RESULT', 'MOCKUP_INPUT', 'MOCKUP_GENERATING', 'MOCKUP_RESULT', 'GENERATING', 'RESULT'].includes(step)) {
      stepContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  const handleSubmit = async () => {
    if (designType === 'box') {
      setSelectedFaceSize(selectedFaceSize || 'LxW')
      handleFaceSubmit(selectedFaceSize || 'LxW')
      return
    }
    handleBagFaceSubmit()
  }

  const handleBagFaceSubmit = async () => {
    setStep('FACE_GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('bagWidth', String(Math.max(20, Math.min(500, bagWidth))))
    formData.append('bagHeight', String(Math.max(20, Math.min(500, bagHeight))))
    formData.append('bagGusset', String(Math.max(10, Math.min(200, bagGusset))))
    formData.append('textOrientation', textOrientation)
    formData.append('hasBorder', hasBorder ? '1' : '0')
    formData.append('borderStyle', borderStyle)
    formData.append('backgroundType', backgroundType)
    if (backgroundType === 'patterned') formData.append('patternStyle', patternStyle)
    formData.append('brandName', brandName.trim())
    formData.append('productName', productName.trim())
    formData.append('companyAddress', companyAddress.trim())
    if (website.trim()) formData.append('website', website.trim())
    if (email.trim()) formData.append('email', email.trim())
    if (hotline.trim()) formData.append('hotline', hotline.trim())
    if (countryOfOrigin.trim()) formData.append('countryOfOrigin', countryOfOrigin.trim())
    if (storageInstructions.trim()) formData.append('storageInstructions', storageInstructions.trim())
    if (warningAllergy.trim()) formData.append('warningAllergy', warningAllergy.trim())
    if (volume.trim()) formData.append('volume', volume.trim())
    if (registrationCode.trim()) formData.append('registrationCode', registrationCode.trim())
    if (socialLinks.trim()) formData.append('socialLinks', socialLinks.trim())
    formData.append('contentBlocks', JSON.stringify(contentBlocks.filter((b) => b.label.trim() || b.content.trim())))
    formData.append('uiLocale', uiLocale)
    formData.append('style', style)
    formData.append('imageQuality', imageQuality)
    if (logo.file) formData.append('logo', logo.file)
    if (referenceImage.file) formData.append('referenceImageFile', referenceImage.file)
    productImages.forEach((p) => formData.append('productImage', p.file))
    try {
      const result = await createBagSurfaceImageWithAI(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('INPUT')
          toast({
            title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          const newFace: CreatedFace = { id: `f-${Date.now()}`, sizeKey: 'WxH', url }
          setFaces([newFace])
          setLastCreatedFace(newFace)
          setStep('FACE_RESULT')
          window.dispatchEvent(new Event('credits-updated'))
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Ảnh phẳng túi đã được tạo.', 'Bag flat design has been created.', '袋子平面图已创建。', '袋の平面デザインを作成しました。', '가방 평면 디자인이 생성되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('INPUT')
          toast({
            title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('INPUT')
      toast({
        title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleOpenRemoveBg = () => {
    const items = faces.map((f) => ({
      url: f.url,
      label: designType === 'bag' ? `W×H (${bagWidth}×${bagHeight} mm)` : getSizeKeyLabel(f.sizeKey, boxLength, boxWidth, boxHeight),
    }))
    try {
      sessionStorage.setItem('xoa_nen_source_images', JSON.stringify(items))
      router.push('/xoa-nen-png?from=bao-bi')
    } catch {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Không thể mở trang tách nền.', 'Cannot open remove BG page.', '无法打开抠图页面。', '背景削除ページを開けません。', '배경 제거 페이지를 열 수 없습니다.'), variant: 'destructive' })
    }
  }

  const handleReset = () => {
    setStep('INPUT')
    setReturnToStep(null)
    setEditingFaceSizeKey(null)
    if (referenceImage.preview) URL.revokeObjectURL(referenceImage.preview)
    setReferenceImage({ file: null, preview: null })
    setResultUrl(null)
    try {
      localStorage.removeItem(DRAFT_KEY)
      setDraftExists(false)
    } catch {
      /* ignore */
    }
    setFaces([])
    setLastCreatedFace(null)
    setSelectedFaceSize('LxW')
    setMockupResultUrl(null)
    setDesignType('box')
    setBrandName('')
    setProductName('')
    setCompanyAddress('')
    setWebsite('')
    setEmail('')
    setHotline('')
    setCountryOfOrigin('')
    setStorageInstructions('')
    setWarningAllergy('')
    setVolume('')
    setRegistrationCode('')
    setSocialLinks('')
    setPackagingQuantity('')
    setPackagingWeight('')
    setPackagingShipping('')
    setPackagingOther('')
    setManufacturerMessage('')
    setPackagingBatchLot('')
    setPackagingProdDate('')
    setPackagingExpiryDate('')
    setIncludeBoxDims(false)
    setContentBlocks([{ id: `cb-${Date.now()}`, label: '', content: '' }])
    setPatternStyle('waves')
    setBagType('stand-up-pouch')
    clearLogo()
    clearAllProductImages()
  }

  const loadProject = (p: ProjectItem) => {
    setDesignType(p.designType)
    setBrandName(p.brandName)
    setProductName(p.productName)
    setCompanyAddress(p.companyAddress ?? '')
    setWebsite(p.website ?? '')
    setEmail(p.email ?? '')
    setHotline(p.hotline ?? '')
    setCountryOfOrigin(p.countryOfOrigin ?? '')
    setStorageInstructions(p.storageInstructions ?? '')
    setWarningAllergy(p.warningAllergy ?? '')
    setVolume(p.volume ?? '')
    setRegistrationCode(p.registrationCode ?? '')
    setSocialLinks(p.socialLinks ?? '')
    let loadedFaces: CreatedFace[] = p.faces?.length ? [...p.faces] : []
    if (loadedFaces.length === 0 && (p.face1Url || p.face2Url || p.face3Url)) {
      loadedFaces = []
      if (p.face1Url) loadedFaces.push({ id: `f-1`, sizeKey: 'LxW', url: p.face1Url })
      if (p.face2Url) loadedFaces.push({ id: `f-2`, sizeKey: 'LxH', url: p.face2Url })
      if (p.face3Url) loadedFaces.push({ id: `f-3`, sizeKey: 'WxH', url: p.face3Url })
    }
    setFaces(loadedFaces)
    setLastCreatedFace(loadedFaces[loadedFaces.length - 1] ?? null)
    setSelectedFaceSize('LxW')
    setMockupResultUrl(p.mockupResultUrl)
    setResultUrl(p.resultUrl)
    setBoxLength(p.boxLength ?? 200)
    setBoxLengthInput(String(p.boxLength ?? 200))
    setBoxWidth(p.boxWidth ?? 150)
    setBoxHeight(p.boxHeight ?? 100)
    setBoxWidthInput(String(p.boxWidth ?? 150))
    setBoxHeightInput(String(p.boxHeight ?? 100))
    setSurfaceLength(p.surfaceLength ?? 200)
    setSurfaceWidth(p.surfaceWidth ?? 150)
    setTextOrientation(p.textOrientation ?? 'horizontal')
    setHasBorder(p.hasBorder ?? false)
    setBorderStyle(p.borderStyle ?? 'single')
    setBackgroundType(p.backgroundType ?? 'transparent')
    setPatternStyle(p.patternStyle ?? 'waves')
    setStyle(p.style ?? 'modern')
    setImageQuality(p.imageQuality ?? '2K')
    setAspectRatio(p.aspectRatio ?? '1:1')
    setBagWidth(p.bagWidth ?? 200)
    setBagHeight(p.bagHeight ?? 280)
    setBagGusset(p.bagGusset ?? 60)
    setBagType(p.bagType ?? 'stand-up-pouch')
    setContentBlocks(p.contentBlocks?.length ? p.contentBlocks : [{ id: `cb-${Date.now()}`, label: '', content: '' }])
    setPackagingQuantity(p.packagingQuantity ?? '')
    setPackagingWeight(p.packagingWeight ?? '')
    setPackagingShipping(p.packagingShipping ?? '')
    setPackagingOther(p.packagingOther ?? '')
    setManufacturerMessage(p.manufacturerMessage ?? '')
    setPackagingBatchLot(p.packagingBatchLot ?? '')
    setPackagingProdDate(p.packagingProdDate ?? '')
    setPackagingExpiryDate(p.packagingExpiryDate ?? '')
    setIncludeBoxDims(p.includeBoxDims ?? false)
    setReturnToStep(null)
    setEditingFaceSizeKey(null)
    if (p.designType === 'bag' && p.resultUrl && !p.mockupResultUrl) {
      setMockupResultUrl(p.resultUrl)
      setStep('MOCKUP_RESULT')
    } else if (p.mockupResultUrl) {
      setStep('MOCKUP_RESULT')
    } else if (loadedFaces.length >= 6) {
      setStep('MOCKUP_INPUT')
    } else if (loadedFaces.length >= 1) {
      setStep('FACE_INPUT')
    } else {
      setStep('INPUT')
    }
  }

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProject(id)
    refreshProjects()
  }

  const handleFaceSubmit = async (overrideSize?: FaceSizeKey) => {
    const sizeKey = (overrideSize ?? selectedFaceSize) as FaceSizeKey
    if (!sizeKey) return
    if (faces.length >= 6 && !editingFaceSizeKey) return
    setStep('FACE_GENERATING')
    await waitForNextPaintClient()
    const formData = new FormData()
    formData.append('faceIndex', String(getFaceIndexFromSizeKey(sizeKey)))
    if (faces.length >= 1) formData.append('referenceImageUrl', faces[0].url)
    else if (referenceImage.file) formData.append('referenceImageFile', referenceImage.file)
    formData.append('surfaceLength', String(Math.max(20, Math.min(800, surfaceLength))))
    formData.append('surfaceWidth', String(Math.max(20, Math.min(800, surfaceWidth))))
    formData.append('boxLength', String(boxLength))
    formData.append('boxWidth', String(boxWidth))
    formData.append('boxHeight', String(boxHeight))
    formData.append('textOrientation', textOrientation)
    formData.append('hasBorder', hasBorder ? '1' : '0')
    formData.append('borderStyle', borderStyle)
    formData.append('backgroundType', backgroundType)
    formData.append('uiLocale', uiLocale)
    if (backgroundType === 'patterned') formData.append('patternStyle', patternStyle)
    formData.append('brandName', brandName.trim())
    formData.append('productName', productName.trim())
    formData.append('companyAddress', companyAddress.trim())
    if (website.trim()) formData.append('website', website.trim())
    if (email.trim()) formData.append('email', email.trim())
    if (hotline.trim()) formData.append('hotline', hotline.trim())
    if (countryOfOrigin.trim()) formData.append('countryOfOrigin', countryOfOrigin.trim())
    if (storageInstructions.trim()) formData.append('storageInstructions', storageInstructions.trim())
    if (warningAllergy.trim()) formData.append('warningAllergy', warningAllergy.trim())
    if (volume.trim()) formData.append('volume', volume.trim())
    if (registrationCode.trim()) formData.append('registrationCode', registrationCode.trim())
    if (socialLinks.trim()) formData.append('socialLinks', socialLinks.trim())
    formData.append('contentBlocks', JSON.stringify(contentBlocks.filter((b) => b.label.trim() || b.content.trim())))
    formData.append('style', style)
    formData.append('imageQuality', imageQuality)
    if (logo.file) formData.append('logo', logo.file)
    productImages.forEach((p) => formData.append('productImage', p.file))
    if (packagingQuantity.trim()) formData.append('packagingQuantity', packagingQuantity.trim())
    if (packagingWeight.trim()) formData.append('packagingWeight', packagingWeight.trim())
    if (packagingShipping.trim()) formData.append('packagingShipping', packagingShipping.trim())
    if (packagingOther.trim()) formData.append('packagingOther', packagingOther.trim())
    if (manufacturerMessage.trim()) formData.append('manufacturerMessage', manufacturerMessage.trim())
    if (packagingBatchLot.trim()) formData.append('packagingBatchLot', packagingBatchLot.trim())
    if (packagingProdDate.trim()) formData.append('packagingProdDate', packagingProdDate.trim())
    if (packagingExpiryDate.trim()) formData.append('packagingExpiryDate', packagingExpiryDate.trim())
    formData.append('includeBoxDims', includeBoxDims ? '1' : '0')
    try {
      const result = await createBoxSurfaceImageWithAI(formData)
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('FACE_INPUT')
          toast({
            title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          const newFace: CreatedFace = { id: `f-${Date.now()}`, sizeKey: sizeKey!, url }
          setFaces((prev) => {
            const next = editingFaceSizeKey
              ? prev.filter((f) => f.sizeKey !== editingFaceSizeKey).concat([newFace])
              : [...prev, newFace]
            return next.sort((a, b) => FACE_ORDER.indexOf(a.sizeKey) - FACE_ORDER.indexOf(b.sizeKey))
          })
          setEditingFaceSizeKey(null)
          setLastCreatedFace(newFace)
          setStep('FACE_RESULT')
          window.dispatchEvent(new Event('credits-updated'))
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description: tr('Ảnh phẳng đã được tạo.', 'Flat design has been created.', '平面图已创建。', '平面デザインを作成しました。', '평면 디자인이 생성되었습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('FACE_INPUT')
          toast({
            title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('FACE_INPUT')
      toast({
        title: tr('Tạo ảnh phẳng thất bại', 'Create flat design failed', '创建平面图失败', '平面デザイン作成に失敗', '평면 디자인 생성 실패'),
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  const handleFaceApprove = () => {
    setEditingFaceSizeKey(null)
    setStep('FACE_INPUT')
  }

  /** Quay lại form để tạo ảnh mới (không phải sửa) */
  const handleAddNewFace = () => {
    setEditingFaceSizeKey(null)
    setStep('FACE_INPUT')
  }

  /** Làm lại ảnh hiện tại – xóa ảnh vừa tạo, quay về form với cùng size. */
  const handleFaceRedo = () => {
    if (lastCreatedFace) {
      setFaces((prev) => prev.filter((f) => f.id !== lastCreatedFace!.id))
      setSelectedFaceSize(lastCreatedFace.sizeKey)
      setLastCreatedFace(null)
    }
    setEditingFaceSizeKey(null)
    setStep(designType === 'bag' ? 'INPUT' : 'FACE_INPUT')
  }

  const handleMockupSubmit = async () => {
    if (faces.length < 1) return
    setStep('MOCKUP_GENERATING')
    await waitForNextPaintClient()
    try {
      const result =
        designType === 'bag'
          ? await createBagMockupFromFlat({
              flatImageUrl: faces[0].url,
              bagWidth,
              bagHeight,
              bagGusset,
              bagType,
              aspectRatio: getAspectRatioFromDimensions(bagWidth, bagHeight, textOrientation),
              imageQuality,
            })
          : await createBoxMockupFromFaces({
              faces: faces.map((f) => ({ url: f.url, sizeKey: f.sizeKey })),
              boxLength,
              boxWidth,
              boxHeight,
              aspectRatio,
              imageQuality,
            })
      await finalizeStandardImageGenerationResult(result, {
        onServerErrorMessage: (message) => {
          setStep('MOCKUP_INPUT')
          toast({
            title: tr('In lên hộp 3D thất bại', 'Print onto 3D box failed', '印到3D盒子失败', '3D箱への印刷に失敗', '3D 상자 인쇄 실패'),
            description: message,
            variant: 'destructive',
            duration: 5000,
          })
        },
        onSuccessWithUrl: (url) => {
          setMockupResultUrl(url)
          setStep('MOCKUP_RESULT')
          saveProject({
            designType,
            brandName,
            productName,
            companyAddress,
            website,
            email,
            hotline,
            countryOfOrigin,
            storageInstructions,
            warningAllergy,
            volume,
            registrationCode,
            socialLinks,
            faces,
            mockupResultUrl: url,
            resultUrl: null,
            boxLength,
            boxWidth,
            boxHeight,
            surfaceLength,
            surfaceWidth,
            textOrientation,
            hasBorder,
            borderStyle,
            backgroundType,
            patternStyle,
            style,
            imageQuality,
            aspectRatio,
            bagWidth,
            bagHeight,
            bagGusset,
            bagType,
            contentBlocks,
            packagingQuantity,
            packagingWeight,
            packagingShipping,
            packagingOther,
            manufacturerMessage,
            packagingBatchLot,
            packagingProdDate,
            packagingExpiryDate,
            includeBoxDims,
          })
          refreshProjects()
          window.dispatchEvent(new Event('credits-updated'))
          toast({
            title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'),
            description:
              designType === 'bag'
                ? tr('Đã in ảnh phẳng lên túi 3D.', 'Flat design printed onto 3D bag.', '已将平面图印到3D袋子上。', '平面デザインを3D袋に印刷しました。', '평면 디자인을 3D 가방에 인쇄했습니다.')
                : tr('Đã in 3 ảnh phẳng lên hộp 3D.', '3 flat designs printed onto 3D box.', '已将3张平面图印到3D盒子上。', '3枚の平面デザインを3D箱に印刷しました。', '3장 평면 디자인을 3D 상자에 인쇄했습니다.'),
            duration: 3000,
          })
        },
        onUnexpectedPayload: () => {
          setStep('MOCKUP_INPUT')
          toast({
            title: tr('In lên hộp 3D thất bại', 'Print onto 3D box failed', '印到3D盒子失败', '3D箱への印刷に失敗', '3D 상자 인쇄 실패'),
            description: genClient.unexpectedNoUrl,
            variant: 'destructive',
            duration: 6000,
          })
        },
      })
    } catch (e) {
      setStep('MOCKUP_INPUT')
      toast({
        title: tr('In lên hộp 3D thất bại', 'Print onto 3D box failed', '印到3D盒子失败', '3D箱への印刷に失敗', '3D 상자 인쇄 실패'),
        description: e instanceof Error ? e.message : genClient.clientFault,
        variant: 'destructive',
        duration: 6000,
      })
    }
  }

  /** Sửa ảnh: quay FACE_INPUT (hộp) hoặc INPUT (túi), giữ ảnh cũ. Khi tạo xong ảnh mới sẽ thay đúng vị trí. */
  const handleEditFace = (face: CreatedFace, fromStep?: 'MOCKUP_INPUT' | 'MOCKUP_RESULT') => {
    setEditingFaceSizeKey(face.sizeKey)
    setSelectedFaceSize(face.sizeKey)
    setReturnToStep(fromStep ?? null)
    if (designType === 'bag') {
      setStep('INPUT')
    } else {
      setStep('FACE_INPUT')
    }
  }

  const handleDielineDownload = async () => {
    const f1 = faces.find((f) => f.sizeKey === 'LxW')
    const f2 = faces.find((f) => f.sizeKey === 'LxH')
    const f3 = faces.find((f) => f.sizeKey === 'WxH')
    if (!f1 || !f2 || !f3) {
      toast({
        title: tr('Cần ít nhất 1 ảnh mỗi kích thước', 'Need at least 1 image per size', '每种尺寸至少需要1张', '各サイズ1枚以上必要', '각 크기당 최소 1장 필요'),
        description: tr('Dieline cần L×W, L×H, W×H. Tạo thêm ảnh nếu thiếu.', 'Dieline needs L×W, L×H, W×H. Create more if missing.', 'Dieline需要L×W、L×H、W×H。缺少请创建。', 'DielineにはL×W、L×H、W×Hが必要。', 'Dieline에 L×W, L×H, W×H 필요.'),
        variant: 'destructive',
      })
      return
    }
    setDielineLoading(true)
    try {
      const result = await generateBoxDielinePdf({
        face1Url: f1.url,
        face2Url: f2.url,
        face3Url: f3.url,
        boxLength,
        boxWidth,
        boxHeight,
      })
      if ('error' in result) {
        toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: result.error, variant: 'destructive' })
      } else {
        const a = document.createElement('a')
        a.href = result.pdfUrl
        a.download = `box-dieline-${boxLength}x${boxWidth}x${boxHeight}mm.pdf`
        a.target = '_blank'
        a.click()
        toast({
          title: tr('Đã tạo Dieline chuẩn in. Cut (đỏ) + Crease (xanh), bleed 3mm.', 'Print-ready Dieline created. Cut (red) + Crease (green), bleed 3mm.', '已生成印刷用Dieline。裁切(红)+压痕(绿)，出血3mm。', '印刷用Dielineを作成。カット(赤)+折り(緑)、塗り足し3mm。', '인쇄용 Dieline 생성. 절단(빨강)+접힘(초록), 블리드 3mm.'),
          duration: 3000,
        })
      }
    } finally {
      setDielineLoading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setLogo({ file: f, preview: URL.createObjectURL(f) })
  }
  const clearLogo = () => {
    if (logo.preview) URL.revokeObjectURL(logo.preview)
    setLogo({ file: null, preview: null })
    if (logoInputRef.current) logoInputRef.current.value = ''
  }
  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (referenceImage.preview) URL.revokeObjectURL(referenceImage.preview)
    setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
  }
  const clearReferenceImage = () => {
    if (referenceImage.preview) URL.revokeObjectURL(referenceImage.preview)
    setReferenceImage({ file: null, preview: null })
    if (referenceImageInputRef.current) referenceImageInputRef.current.value = ''
  }
  const MAX_PRODUCT_IMAGES = 6
  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newItems = files.slice(0, MAX_PRODUCT_IMAGES - productImages.length).map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
    }))
    setProductImages((prev) => [...prev, ...newItems].slice(0, MAX_PRODUCT_IMAGES))
    if (productImageInputRef.current) productImageInputRef.current.value = ''
  }
  const removeProductImage = (idx: number) => {
    setProductImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (prev[idx]?.preview) URL.revokeObjectURL(prev[idx].preview)
      return next
    })
  }
  const clearAllProductImages = () => {
    productImages.forEach((p) => URL.revokeObjectURL(p.preview))
    setProductImages([])
    if (productImageInputRef.current) productImageInputRef.current.value = ''
  }

  const addContentBlock = () => {
    setContentBlocks((prev) => [...prev, { id: `cb-${Date.now()}`, label: '', content: '' }])
  }
  const removeContentBlock = (id: string) => {
    setContentBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((b) => b.id !== id)))
  }
  const updateContentBlock = (id: string, field: 'label' | 'content', value: string) => {
    setContentBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)))
  }

  return (
    <>
      <Toaster />
      <div className="tool-page-container">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-foreground">
              {tr('Thiết kế bao bì AI - Hộp carton, túi đựng', 'AI Packaging Design - Carton box, flat bag', 'AI包装设计 - 纸箱、袋子', 'AIパッケージデザイン - 段ボール箱・平面袋', 'AI 패키징 디자인 - 골판지 상자, 평면 가방')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {tr('Tải ảnh sản phẩm in lên hộp/túi, nhập thương hiệu & sản phẩm. AI tạo mockup chuyên nghiệp, thẩm mỹ cao. 1,5–3 credits/lượt.', 'Upload product image to print on box/bag, enter brand & product. AI creates professional, high-aesthetic mockup. 1.5–3 credits/creation.', '上传产品图片打印到包装上，输入品牌和产品。AI 生成专业高美学样机。1.5–3 积分/次。', '商品画像をアップロードして箱・袋に印刷、ブランド・商品を入力。AIがプロ品質のモックアップを生成。1.5〜3クレジット/回。', '상품 이미지 업로드하여 상자/가방에 인쇄, 브랜드·상품 입력. AI가 전문적 고품질 목업 생성. 1.5–3 크레딧/회.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 shrink-0 self-center">
            <Plus className="h-4 w-4" />
            {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
          </Button>
        </div>

        {(step === 'INPUT' && draftExists) || projects.length > 0 ? (
          <div className="space-y-4">
            {step === 'INPUT' && draftExists && (
              <Card className="border-amber-300 bg-amber-50 shadow-sm ring-1 ring-amber-200/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                    <FileEdit className="h-4 w-4" />
                    {tr('Bản nháp chưa hoàn thành', 'Unfinished draft', '未完成的草稿', '未完成の下書き', '미완성 초안')}
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-800/80">
                    {tr('Có bản nháp đã lưu. Tiếp tục chỉnh sửa?', 'Draft saved. Continue editing?', '有已保存的草稿。继续编辑？', '下書きが保存されています。続けて編集しますか？', '저장된 초안이 있습니다. 계속 편집할까요?')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="default" size="sm" onClick={loadDraft} className="bg-amber-600 hover:bg-amber-700">
                    {tr('Tiếp tục bản nháp', 'Continue draft', '继续草稿', '下書きを続ける', '초안 계속')}
                  </Button>
                </CardContent>
              </Card>
            )}

            {projects.length > 0 && (
          <Card className="border-slate-200/80">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FolderOpen className="h-4 w-4" />
                {tr('Dự án đã tạo (30 ngày)', 'Created projects (30 days)', '已创建项目（30天）', '作成済み（30日間）', '생성된 프로젝트 (30일)')}
              </CardTitle>
              <CardDescription className="text-xs">
                {tr('Bấm để mở lại. Tự động xóa sau 30 ngày hoặc khi bạn xóa.', 'Click to reopen. Auto-removed after 30 days or when you delete.', '点击重新打开。30天后自动删除或您手动删除。', 'クリックで開く。30日後に自動削除、または手動で削除。', '클릭하여 다시 열기. 30일 후 자동 삭제 또는 수동 삭제.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-3">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => loadProject(p)}
                    className="group flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50 transition-colors text-left min-w-0 max-w-[200px]"
                  >
                    <div className="shrink-0 w-12 h-12 rounded border bg-muted/30 overflow-hidden flex items-center justify-center">
                      {p.mockupResultUrl ? (
                        <img src={p.mockupResultUrl} alt="" className="w-full h-full object-cover" />
                      ) : p.resultUrl ? (
                        <img src={p.resultUrl} alt="" className="w-full h-full object-cover" />
                      ) : (p.faces?.length ? p.faces[0].url : p.face1Url) ? (
                        <img src={p.faces?.length ? p.faces[0].url : p.face1Url!} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Box className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{p.productName || p.brandName || tr('Không tên', 'Untitled', '无标题', '無題', '제목 없음')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString(uiLocale === 'vi' ? 'vi-VN' : uiLocale === 'zh' ? 'zh-CN' : uiLocale === 'ja' ? 'ja-JP' : uiLocale === 'ko' ? 'ko-KR' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-60 hover:opacity-100 hover:text-destructive"
                      onClick={(e) => handleDeleteProject(e, p.id)}
                      title={tr('Xóa khỏi danh sách', 'Remove from list', '从列表删除', 'リストから削除', '목록에서 삭제')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
            )}
          </div>
        ) : null}

        {(designType === 'box' || designType === 'bag') && ['FACE_INPUT', 'FACE_RESULT', 'MOCKUP_INPUT', 'MOCKUP_RESULT'].includes(step) && (
          <Card className="border-slate-200/80">
            <CardContent className="py-3">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground mr-1">
                  {tr('Điều hướng:', 'Navigate:', '导航:', 'ナビ:', '이동:')}
                </span>
                {faces.length >= 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickViewFlatOpen(true)}
                    className="gap-1.5"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {tr('Xem nhanh ảnh phẳng', 'Quick view flat designs', '快速查看平面图', '平面図を表示', '평면 디자인 보기')}
                  </Button>
                )}
                {faces.length >= 1 && step !== 'MOCKUP_INPUT' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('MOCKUP_INPUT')}
                    className="gap-1.5"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    {tr('Bước 3: Chuẩn bị in 3D', 'Step 3: Prepare 3D print', '步骤3：准备3D印刷', 'ステップ3：3D印刷準備', '3단계: 3D 인쇄 준비')}
                  </Button>
                )}
                {mockupResultUrl && step !== 'MOCKUP_RESULT' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickView3dOpen(true)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {tr('Xem nhanh kết quả 3D', 'Quick view 3D result', '快速查看3D结果', '3D結果を表示', '3D 결과 보기')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep('MOCKUP_RESULT')}
                      className="gap-1.5"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      {tr('Bước 4: Kết quả 3D', 'Step 4: 3D result', '步骤4：3D结果', 'ステップ4：3D結果', '4단계: 3D 결과')}
                    </Button>
                  </>
                )}
                {step === 'MOCKUP_RESULT' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('MOCKUP_INPUT')}
                    className="gap-1.5"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    {tr('Quay lại bước 3', 'Back to step 3', '返回步骤3', 'ステップ3に戻る', '3단계로 돌아가기')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Dialog open={quickViewFlatOpen} onOpenChange={setQuickViewFlatOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {tr('Ảnh phẳng', 'Flat designs', '平面图', '平面デザイン', '평면 디자인')} (1–6)
              </DialogTitle>
            </DialogHeader>
            {faces.length >= 1 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
                {faces.map((f, i) => {
                  const [len, wid] = designType === 'bag' ? getDimensionsFromSizeKey(f.sizeKey, 0, bagWidth, bagHeight) : getDimensionsFromSizeKey(f.sizeKey, boxLength, boxWidth, boxHeight)
                  const sizeLabel = designType === 'bag' ? `W×H (${bagWidth}×${bagHeight} mm)` : getSizeKeyLabel(f.sizeKey, boxLength, boxWidth, boxHeight)
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        {tr('Ảnh', 'Image', '图', '画像', '이미지')} {i + 1} – {sizeLabel}
                      </p>
                      <div className="w-full aspect-square rounded border bg-muted/30 overflow-hidden">
                        <ImagePreview src={f.url} alt="" className="w-full h-full" asImg />
                      </div>
                      <div className="flex gap-1 mt-1">
                        <DownloadImageButton
                          imageUrl={f.url}
                          filename={`${designType}-flat-${f.sizeKey}-${i + 1}-${Date.now()}.png`}
                          printReady
                          printReadyAspectRatio={getAspectRatioFromDimensions(len, wid, textOrientation)}
                          printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                          size="sm"
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={handleOpenRemoveBg} className="gap-1 shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50">
                          <Eraser className="h-3.5 w-3.5" />
                          {tr('Tách nền', 'Remove BG', '抠图', '背景削除', '배경 제거')}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={quickView3dOpen} onOpenChange={setQuickView3dOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {tr('Kết quả 3D', '3D result', '3D结果', '3D結果', '3D 결과')}
              </DialogTitle>
            </DialogHeader>
            {mockupResultUrl && (
              <div className="mt-2 space-y-3">
                <div className="w-full aspect-video max-h-[60vh] rounded overflow-hidden border bg-muted/30">
                  <ImagePreview
                    src={mockupResultUrl}
                    alt={tr('Hộp 3D', '3D box', '3D盒子', '3D箱', '3D 상자')}
                    className="w-full h-full object-contain"
                    asImg
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setQuickView3dOpen(false)
                    setStep('MOCKUP_RESULT')
                  }}
                >
                  {tr('Mở bước 4 đầy đủ', 'Open full step 4', '打开完整步骤4', 'ステップ4を開く', '4단계 전체 열기')}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <div ref={stepContentRef}>
        {step === 'GENERATING' && (
          <div className="flex flex-col items-center justify-center py-12">
            <ImageProcessingLoader
              mode="seal"
              title={String(tr('Đang tạo mockup', 'Creating mockup', '正在创建样机', 'モックアップ作成中', '목업 생성 중'))}
              description={`${tr('AI đang thiết kế bao bì chuyên nghiệp', 'AI is designing professional packaging', 'AI 正在设计专业包装', 'AIがプロのパッケージをデザイン中', 'AI가 전문 패키징 디자인 중')}${designType === 'bag' ? ` – W×H (${bagWidth}×${bagHeight} mm)` : ''}`}
            />
          </div>
        )}

        {step === 'FACE_GENERATING' && (
          <div className="flex flex-col items-center justify-center py-12">
            <ImageProcessingLoader
              mode="seal"
              title={String(tr('Đang tạo ảnh phẳng', 'Creating flat design', '正在创建平面图', '平面デザイン作成中', '평면 디자인 생성 중'))}
              description={`${tr('AI đang tạo ảnh thiết kế phẳng', 'AI is creating flat design', 'AI 正在创建平面设计', 'AIが平面デザインを作成中', 'AI가 평면 디자인 생성 중')}${designType === 'bag' ? ` – W×H (${bagWidth}×${bagHeight} mm)` : selectedFaceSize ? ` – ${getSizeKeyLabel(selectedFaceSize, boxLength, boxWidth, boxHeight)}` : ''}`}
            />
          </div>
        )}

        {step === 'FACE_RESULT' && lastCreatedFace && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  {tr('Ảnh', 'Image', '图', '画像', '이미지')} {faces.length} – {designType === 'bag' ? `W×H (${bagWidth}×${bagHeight} mm)` : getSizeKeyLabel(lastCreatedFace.sizeKey, boxLength, boxWidth, boxHeight)}
                </p>
                <div className="flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4 min-h-[200px]">
                  <FaceResultImage
                    src={lastCreatedFace.url}
                    alt={tr('Ảnh phẳng', 'Flat design', '平面图', '平面デザイン', '평면 디자인')}
                    onErrorRetry={handleFaceRedo}
                    tr={tr}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <DownloadImageButton
                    imageUrl={lastCreatedFace.url}
                    filename={`${designType}-flat-${lastCreatedFace.sizeKey}-${Date.now()}.png`}
                    printReady
                    printReadyAspectRatio={getAspectRatioFromDimensions(designType === 'bag' ? bagWidth : surfaceLength, designType === 'bag' ? bagHeight : surfaceWidth, textOrientation)}
                    printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                  />
                  {designType === 'box' && (
                    <Button variant="default" size="sm" onClick={handleFaceApprove} className="gap-2">
                      {tr('Tiếp tục tạo ảnh', 'Continue creating', '继续创建', '続けて作成', '계속 생성')}
                    </Button>
                  )}
                  <Button variant="default" size="sm" onClick={() => setStep('MOCKUP_INPUT')} className="gap-2">
                    {tr('Chuyển sang Mockup 3D', 'Go to 3D Mockup', '转到3D样机', '3Dモックアップへ', '3D 목업으로')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFaceRedo}>
                    {tr('Làm lại', 'Redo', '重做', 'やり直す', '다시 하기')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'MOCKUP_INPUT' && faces.length >= 1 && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutTemplate className="h-4 w-4 text-amber-600" />
                {designType === 'bag'
                  ? tr('In ảnh phẳng lên túi 3D', 'Print flat design onto 3D bag', '将平面图印到3D袋子上', '平面デザインを3D袋に印刷', '평면 디자인을 3D 가방에 인쇄')
                  : tr('In 1–6 ảnh phẳng lên hộp 3D', 'Print 1–6 flat designs onto 3D box', '将1–6张平面图印到3D盒子上', '1–6枚の平面デザインを3D箱に印刷', '1–6장 평면 디자인을 3D 상자에 인쇄')}
              </CardTitle>
              <CardDescription>
                {designType === 'bag'
                  ? tr('Đã có ảnh phẳng túi. Bước này ghép in lên túi 3D.', 'Bag flat design ready. This step prints it onto the 3D bag.', '袋子平面图已就绪。此步骤将其印到3D袋子上。', '袋の平面デザイン準備完了。このステップで3D袋に印刷。', '가방 평면 디자인 준비 완료. 이 단계에서 3D 가방에 인쇄.')
                  : tr('Đã có ảnh phẳng. Bước này ghép in lên hộp 3D.', 'Flat designs ready. This step prints them onto the 3D box.', '已有平面设计。此步骤将其印到3D盒子上。', '平面デザイン準備完了。このステップで3D箱に印刷。', '평면 디자인 준비 완료. 이 단계에서 3D 상자에 인쇄.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {faces.map((f, i) => {
                  const [len, wid] =
                    designType === 'bag'
                      ? getDimensionsFromSizeKey(f.sizeKey, 0, bagWidth, bagHeight)
                      : getDimensionsFromSizeKey(f.sizeKey, boxLength, boxWidth, boxHeight)
                  const sizeLabel =
                    designType === 'bag' ? `W×H (${bagWidth} x ${bagHeight} mm)` : getSizeKeyLabel(f.sizeKey, boxLength, boxWidth, boxHeight)
                  return (
                    <div key={f.id} className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {tr('Ảnh phẳng', 'Flat design', '平面图', '平面デザイン', '평면 디자인')} {i + 1} – {sizeLabel}
                      </p>
                      <div className="w-full aspect-square rounded border overflow-hidden">
                        <ImagePreview src={f.url} alt="" className="w-full h-full" asImg />
                      </div>
                      <div className="flex gap-1">
                        <DownloadImageButton
                          imageUrl={f.url}
                          filename={`${designType}-flat-${f.sizeKey}-${i + 1}-${Date.now()}.png`}
                          printReady
                          printReadyAspectRatio={getAspectRatioFromDimensions(len, wid, textOrientation)}
                          printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                          size="sm"
                          className="flex-1"
                        />
                        <Button variant="outline" size="sm" onClick={handleOpenRemoveBg} className="gap-1 shrink-0 border-teal-200 text-teal-700 hover:bg-teal-50">
                          <Eraser className="h-3.5 w-3.5" />
                          {tr('Tách nền', 'Remove BG', '抠图', '背景削除', '배경 제거')}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {designType === 'bag' && (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tr('Loại túi', 'Bag type', '袋子类型', '袋の種類', '가방 유형')}</label>
                  <Select value={bagType} onValueChange={(v) => setBagType(v as BagType)}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BAG_TYPE_LABELS.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {getBagTypeLabel(b)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tr('Tỷ lệ', 'Aspect ratio', '比例', '比率', '비율')}{opt}</label>
                  <div className="flex gap-2">
                    {ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setAspectRatio(r.value)}
                        className={`px-2 py-1 rounded text-sm ${aspectRatio === r.value ? 'border-amber-500 bg-amber-50' : 'border'}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{tr('Chất lượng', 'Quality', '质量', '画質', '품질')}{opt}</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setImageQuality('2K')} className={`px-2 py-1 rounded text-sm ${imageQuality === '2K' ? 'border-amber-500 bg-amber-50' : 'border'}`}>
                      2K
                    </button>
                    <button type="button" onClick={() => setImageQuality('4K')} className={`px-2 py-1 rounded text-sm ${imageQuality === '4K' ? 'border-amber-500 bg-amber-50' : 'border'}`}>
                      4K
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => checkCreditsAndProceed(cost, () => void handleMockupSubmit())} className="flex-1 min-h-[44px]" size="lg">
                  <Sparkles className="h-4 w-4 mr-2" />
                  {designType === 'bag'
                    ? tr('In lên túi 3D', 'Print onto 3D bag', '印到3D袋子上', '3D袋に印刷', '3D 가방에 인쇄')
                    : tr('In lên hộp 3D', 'Print onto 3D box', '印到3D盒子上', '3D箱に印刷', '3D 상자에 인쇄')}{' '}
                  ({formatCredits(cost)} {tr('credits', 'credits', '积分', 'クレジット', '크레딧')})
                </Button>
                {designType === 'box' && faces.length < 6 && (
                  <Button variant="outline" size="lg" onClick={handleAddNewFace} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {tr('Quay lại tạo ảnh phẳng tiếp theo', 'Back to create more flat designs', '返回创建更多平面图', '戻って平面デザインを追加', '돌아가서 평면 디자인 추가')}
                  </Button>
                )}
                {faces.map((f, i) => (
                  <Button key={f.id} variant="outline" size="lg" onClick={() => handleEditFace(f, 'MOCKUP_INPUT')}>
                    {tr('Sửa ảnh', 'Edit image', '编辑图', '画像を編集', '이미지 편집')} {i + 1}
                  </Button>
                ))}
                <Button variant="outline" size="lg" onClick={handleReset}>
                  {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'MOCKUP_GENERATING' && (
          <div className="flex flex-col items-center justify-center py-12">
            <ImageProcessingLoader
              mode="seal"
              title={String(designType === 'bag' ? tr('Đang in ảnh phẳng lên túi 3D', 'Printing flat design onto 3D bag', '正在将平面图印到3D袋子上', '平面デザインを3D袋に印刷中', '평면 디자인을 3D 가방에 인쇄 중') : tr('Đang in ảnh phẳng lên hộp 3D', 'Printing flat designs onto 3D box', '正在将平面图印到3D盒子上', '平面デザインを3D箱に印刷中', '평면 디자인을 3D 상자에 인쇄 중'))}
              description={String(designType === 'bag' ? tr('AI đang ghép in ảnh thiết kế lên túi 3D', 'AI is printing design onto 3D bag', 'AI 正在将设计印到3D袋子上', 'AIがデザインを3D袋に印刷中', 'AI가 디자인을 3D 가방에 인쇄 중') : tr('AI đang ghép in ảnh thiết kế lên hộp carton 3D', 'AI is printing designs onto 3D carton box', 'AI 正在将设计印到3D纸箱上', 'AIがデザインを3D段ボール箱に印刷中', 'AI가 디자인을 3D 골판지 상자에 인쇄 중'))}
            />
          </div>
        )}

        {step === 'MOCKUP_RESULT' && mockupResultUrl && (
          <div className="max-w-2xl mx-auto space-y-4">
            <Card className="border shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-center bg-[repeating-conic-gradient(#e5e7eb_0%_25%,#f9fafb_0%_50%)] bg-[length:12px_12px] rounded-lg border p-4">
                  <div className="w-full max-w-full aspect-video max-h-[400px] rounded overflow-hidden">
                    <ImagePreview
                      src={mockupResultUrl}
                      alt={designType === 'bag' ? tr('Túi 3D đã in ảnh phẳng', '3D bag with flat design printed', '已印平面图的3D袋子', '平面デザインを印刷した3D袋', '평면 디자인 인쇄된 3D 가방') : tr('Hộp 3D đã in 3 ảnh phẳng', '3D box with 3 flat designs printed', '已印3张平面图的3D盒子', '3枚の平面デザインを印刷した3D箱', '3장 평면 디자인 인쇄된 3D 상자')}
                      className="w-full h-full object-contain rounded shadow"
                      asImg
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  <div className="flex flex-wrap gap-2">
                    <DownloadImageButton
                      imageUrl={mockupResultUrl}
                      filename={`${designType}-mockup-3d-${Date.now()}.png`}
                      printReady
                      printReadyAspectRatio={aspectRatio}
                      printReadyInferFromImage
                      printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                    />
                    <Button variant="outline" size="sm" onClick={handleReset}>
                      {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{tr('Tải ảnh phẳng', 'Download flat designs', '下载平面图', '平面デザインをダウンロード', '평면 디자인 다운로드')}</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {faces.map((f, i) => {
                        const [len, wid] = designType === 'bag' ? getDimensionsFromSizeKey(f.sizeKey, 0, bagWidth, bagHeight) : getDimensionsFromSizeKey(f.sizeKey, boxLength, boxWidth, boxHeight)
                        return (
                          <DownloadImageButton
                            key={f.id}
                            imageUrl={f.url}
                            filename={`${designType}-flat-${f.sizeKey}-${i + 1}-${Date.now()}.png`}
                            printReady
                            printReadyAspectRatio={getAspectRatioFromDimensions(len, wid, textOrientation)}
                            printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                            size="sm"
                          />
                        )
                      })}
                      <Button variant="outline" size="sm" onClick={handleOpenRemoveBg} className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50">
                        <Eraser className="h-3.5 w-3.5" />
                        {tr('Tách nền', 'Remove BG', '抠图', '背景削除', '배경 제거')}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{tr('Sửa / Làm lại ảnh phẳng', 'Edit / Redo flat design', '编辑/重做平面图', '編集・やり直し', '편집/다시 하기')}</p>
                    <div className="flex flex-wrap gap-2">
                      {designType === 'box' && faces.length < 6 && (
                        <Button variant="outline" size="sm" onClick={handleAddNewFace} className="gap-1.5">
                          <Plus className="h-3.5 w-3.5" />
                          {tr('Quay lại tạo ảnh phẳng tiếp theo', 'Back to create more flat designs', '返回创建更多平面图', '戻って平面デザインを追加', '돌아가서 평면 디자인 추가')}
                        </Button>
                      )}
                      {faces.map((f, i) => (
                        <Button key={f.id} variant="outline" size="sm" onClick={() => handleEditFace(f, 'MOCKUP_RESULT')}>
                          {tr('Sửa / Làm lại ảnh', 'Edit / Redo image', '编辑/重做图', '画像を編集・やり直す', '이미지 편집/다시 하기')} {i + 1}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tr('Chọn ảnh cần sửa/làm lại. Quay về form, chỉnh rồi tạo lại. Các ảnh khác giữ nguyên.', 'Select image to edit/redo. Return to form, adjust and regenerate. Other images stay unchanged.', '选择要编辑/重做的图片。返回表单修改后重新生成。其他图片保持不变。', '編集・やり直す画像を選択。フォームに戻り、修正して再生成。他はそのまま。', '편집/다시 할 이미지 선택. 폼으로 돌아가 수정 후 재생성. 다른 이미지는 유지.')}
                    </p>
                  </div>
                  {designType === 'box' && (
                    <Card className="border-emerald-200/60 bg-emerald-50/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-emerald-600" />
                          {tr('Bản vẽ Dieline chuẩn in', 'Print-ready Dieline', '印刷用Dieline', '印刷用Dieline', '인쇄용 Dieline')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {tr('Layer đường cắt (Cut, đỏ) và đường cấn (Crease, xanh) tách biệt cho máy bế. Bleed 3mm. PDF chất lượng cao.', 'Cut (red) and Crease (green) layers separated for die-cutting. Bleed 3mm. High-quality PDF.', '裁切(红)与压痕(绿)分层，便于模切。出血3mm。高质量PDF。', 'カット(赤)と折り(緑)を分離。塗り足し3mm。高品質PDF。', '절단(빨강)과 접힘(초록) 레이어 분리. 블리드 3mm. 고품질 PDF.')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={handleDielineDownload}
                          disabled={dielineLoading || !faces.find((f) => f.sizeKey === 'LxW') || !faces.find((f) => f.sizeKey === 'LxH') || !faces.find((f) => f.sizeKey === 'WxH')}
                          className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <FileText className="h-3 w-3" />
                          {dielineLoading
                            ? tr('Đang tạo...', 'Creating...', '生成中...', '作成中...', '생성 중...')
                            : tr('Tải Bản vẽ Dieline chuẩn', 'Download Dieline PDF', '下载Dieline PDF', 'Dieline PDFをダウンロード', 'Dieline PDF 다운로드')}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        </div>

        {step === 'INPUT' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-amber-600" />
                {tr('Thiết kế bằng AI', 'Design with AI', 'AI 设计', 'AIでデザイン', 'AI로 디자인')}
              </CardTitle>
              <CardDescription>
                {tr('Chọn loại bao bì, nhập thông tin. AI tạo mockup đẹp, chuyên nghiệp.', 'Select packaging type, enter info. AI creates beautiful, professional mockup.', '选择包装类型，输入信息。AI 生成美观专业的样机。', '包装タイプを選択、情報を入力。AIが美しいプロ品質のモックアップを生成。', '포장 유형 선택, 정보 입력. AI가 아름답고 전문적인 목업 생성.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <a href="/api/thiet-ke-bao-bi-mau" download="thiet-ke-bao-bi-mau.xlsx">
                  <Button type="button" variant="outline" size="sm" className="border-amber-200 text-amber-700 hover:bg-amber-50">
                    <FileDown className="h-3.5 w-3.5 mr-1" /> {tr('Tải file mẫu', 'Download template', '下载模板', 'テンプレートをダウンロード', '템플릿 다운로드')}
                  </Button>
                </a>
                <Button type="button" variant="outline" size="sm" onClick={() => excelImportRef.current?.click()} className="border-amber-200 text-amber-700 hover:bg-amber-50">
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> {tr('Import Excel', 'Import Excel', '导入 Excel', 'Excelをインポート', 'Excel 가져오기')}
                </Button>
                <input ref={excelImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Loại bao bì', 'Packaging type', '包装类型', '包装タイプ', '포장 유형')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  {DESIGN_TABS.map((t) => {
                    const Icon = t.icon
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setDesignType(t.value)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all min-h-[44px] touch-manipulation ${
                          designType === t.value
                            ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-sm'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tabLabel(t.value)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {designType === 'box' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước hộp (mm)', 'Box dimensions (mm)', '盒子尺寸（毫米）', '箱のサイズ（mm）', '상자 크기 (mm)')} <span className="text-red-500">*</span></label>
                    <p className="text-xs text-muted-foreground">
                      {tr('Nhập tự do L×W×H. Không ràng buộc tỷ lệ.', 'Free input L×W×H. No ratio constraints.', '自由输入L×W×H。无比例限制。', 'L×W×Hを自由入力。比率制限なし。', 'L×W×H 자유 입력. 비율 제한 없음.')}
                    </p>
                    <div className="flex flex-wrap gap-4 items-end">
                      <div className="space-y-1 min-w-[100px]">
                        <label className="text-xs text-muted-foreground">{tr('Chiều dài (L)', 'Length (L)', '长度（L）', '長さ（L）', '길이 (L)')} mm</label>
                        <Input
                          type="number"
                          min={20}
                          max={500}
                          value={boxLengthInput}
                          onChange={(e) => setBoxLengthInput(e.target.value)}
                          onBlur={() => {
                            const n = Math.max(20, Math.min(500, parseInt(boxLengthInput, 10) || 20))
                            setBoxLength(n)
                            setBoxLengthInput(String(n))
                          }}
                          placeholder="200"
                        />
                      </div>
                      <div className="space-y-1 min-w-[100px]">
                        <label className="text-xs text-muted-foreground">{tr('Chiều rộng (W)', 'Width (W)', '宽度（W）', '幅（W）', '너비 (W)')} mm</label>
                        <Input
                          type="number"
                          min={20}
                          max={500}
                          value={boxWidthInput}
                          onChange={(e) => setBoxWidthInput(e.target.value)}
                          onBlur={() => {
                            const n = Math.max(20, Math.min(500, parseInt(boxWidthInput, 10) || 20))
                            setBoxWidth(n)
                            setBoxWidthInput(String(n))
                          }}
                          placeholder="150"
                        />
                      </div>
                      <div className="space-y-1 min-w-[100px]">
                        <label className="text-xs text-muted-foreground">{tr('Chiều cao (H)', 'Height (H)', '高度（H）', '高さ（H）', '높이 (H)')} mm</label>
                        <Input
                          type="number"
                          min={20}
                          max={500}
                          value={boxHeightInput}
                          onChange={(e) => setBoxHeightInput(e.target.value)}
                          onBlur={() => {
                            const n = Math.max(20, Math.min(500, parseInt(boxHeightInput, 10) || 20))
                            setBoxHeight(n)
                            setBoxHeightInput(String(n))
                          }}
                          placeholder="100"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground pb-2">{boxLength}×{boxWidth}×{boxHeight} mm</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước ảnh đầu tiên', 'First image size', '首张图片尺寸', '1枚目の画像サイズ', '첫 이미지 크기')} <span className="text-red-500">*</span></label>
                    <p className="text-xs text-muted-foreground">
                      {tr('Chọn trước khi nhập thông tin khác. Ảnh 1 sẽ có kích thước:', 'Choose before entering other info. Image 1 will be:', '先选择再填其他信息。图1尺寸：', '他の情報入力前に選択。画像1のサイズ：', '다른 정보 입력 전 선택. 이미지 1 크기:')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {FACE_SIZE_KEYS.map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSelectedFaceSize(k)}
                          className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                            selectedFaceSize === k ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {getSizeKeyLabel(k, boxLength, boxWidth, boxHeight)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh tham khảo phong cách', 'Style reference image', '风格参考图', 'スタイル参考画像', '스타일 참조 이미지')}{opt}</label>
                    <p className="text-xs text-muted-foreground">
                      {tr('AI lấy thông tin của bạn (thương hiệu, sản phẩm...) và tùy biến theo style ảnh này. Không bê nguyên ảnh tham khảo. Khi có ảnh này, không dùng ảnh sản phẩm. Vẫn chọn màu nền và viền bên dưới.', 'AI uses your info (brand, product...) and customizes to match this style. Do not copy reference verbatim. When set, product images are not used. Still choose background and border below.', 'AI使用您的信息（品牌、产品等）并按此风格定制。不原样复制参考图。设置后不使用产品图。下方仍可选择背景和边框。', 'AIがあなたの情報（ブランド・商品など）を使い、このスタイルに合わせてカスタマイズ。参考画像をそのままコピーしない。設定時は商品画像を使用しない。下で背景・枠を選択可能。', 'AI가 귀하의 정보(브랜드·상품 등)를 사용해 이 스타일에 맞춤. 참조 이미지 그대로 복사 안 함. 설정 시 상품 이미지 미사용. 아래에서 배경·테두리 선택 가능.')}
                    </p>
                    <div className="flex items-center gap-3">
                      <input ref={referenceImageInputRef} type="file" accept="image/*" onChange={handleReferenceImageChange} className="hidden" />
                      <Button variant="outline" size="sm" type="button" onClick={() => referenceImageInputRef.current?.click()} className="shrink-0">
                        <Upload className="h-3 w-3 mr-2" />
                        {tr('Chọn ảnh tham khảo', 'Choose reference image', '选择参考图', '参考画像を選択', '참조 이미지 선택')}
                      </Button>
                      {referenceImage.preview && (
                        <div className="relative inline-block">
                          <img src={referenceImage.preview} alt="Reference" className="h-24 w-24 sm:h-32 sm:w-32 object-contain rounded-lg border-2 border-amber-200 bg-white shadow-sm" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 absolute -top-1 -right-1 bg-white rounded-full shadow border hover:bg-muted" onClick={clearReferenceImage}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {referenceImage.preview && (
                    <p className="text-xs font-medium text-amber-700">
                      {tr('Vẫn chọn khung viền và màu nền bên dưới:', 'Still choose border and background below:', '仍可选择下方边框和背景：', '下で枠と背景を選択：', '아래에서 테두리와 배경 선택:')}
                    </p>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Khung viền ảnh phẳng', 'Flat image border', '平面图边框', '平面画像の枠', '평면 이미지 테두리')}{opt}</label>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setHasBorder(false)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                            !hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {tr('Không có', 'None', '无', 'なし', '없음')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHasBorder(true)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                            hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                          }`}
                        >
                          {tr('Có khung viền', 'With border', '有边框', 'あり', '있음')}
                        </button>
                      </div>
                      {hasBorder && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground mb-2">{tr('Kiểu viền:', 'Border style:', '边框样式:', '枠のスタイル:', '테두리 스타일:')}{opt}</p>
                          <Select value={borderStyle} onValueChange={setBorderStyle}>
                            <SelectTrigger className="w-full max-w-xs">
                              <SelectValue placeholder={tr('Chọn kiểu viền', 'Select border style', '选择边框样式', '枠のスタイルを選択', '테두리 스타일 선택')} />
                            </SelectTrigger>
                            <SelectContent>
                              {BORDER_STYLES.map((b) => (
                                <SelectItem key={b.value} value={b.value}>
                                  {getBorderLabel(b)}
                                </SelectItem>
                              ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Màu nền ảnh phẳng', 'Flat image background', '平面图背景色', '平面画像の背景色', '평면 이미지 배경색')}{opt}</label>
                    <Select value={backgroundType} onValueChange={setBackgroundType}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder={tr('Chọn màu nền', 'Select background', '选择背景色', '背景色を選択', '배경색 선택')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BACKGROUND_OPTIONS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {getBgLabel(b)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {backgroundType === 'patterned' && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-2">{tr('Kiểu hoa văn:', 'Pattern style:', '图案样式:', '模様のスタイル:', '패턴 스타일:')}</p>
                        <div className="flex flex-wrap gap-2">
                          {PATTERN_OPTIONS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setPatternStyle(p.value)}
                              className={`px-3 py-2 rounded-md border text-sm font-medium ${patternStyle === p.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}
                            >
                              {getPatternLabel(p)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-medium text-muted-foreground">
                      {tr('Thông tin đóng gói (tùy chọn – để trống nếu không cần)', 'Packaging info (optional – leave blank if not needed)', '包装信息（可选–不需要则留空）', '包装情報（任意・不要なら空欄）', '포장 정보 (선택·불필요 시 비움)')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{tr('Số lượng', 'Quantity', '数量', '数量', '수량')}{opt}</label>
                        <Input placeholder="VD: 12 gói" value={packagingQuantity} onChange={(e) => setPackagingQuantity(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{tr('Trọng lượng', 'Weight', '重量', '重量', '중량')}{opt}</label>
                        <Input placeholder="VD: 120g, NET WT. 4.23 OZ" value={packagingWeight} onChange={(e) => setPackagingWeight(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{tr('Số lô', 'Batch/Lot no.', '批号', 'ロット番号', '로트 번호')}{opt}</label>
                        <Input placeholder="VD: Lô 001" value={packagingBatchLot} onChange={(e) => setPackagingBatchLot(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{tr('Ngày sản xuất', 'Production date', '生产日期', '製造日', '제조일')}{opt}</label>
                        <Input type="date" value={packagingProdDate} onChange={(e) => setPackagingProdDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{tr('Ngày hết hạn sử dụng', 'Expiry date', '保质期至', '賞味期限', '유통기한')}{opt}</label>
                        <Input type="date" value={packagingExpiryDate} onChange={(e) => setPackagingExpiryDate(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">{tr('Yêu cầu vận chuyển', 'Shipping requirements', '运输要求', '輸送要件', '운송 요건')}{opt}</label>
                        <Input placeholder="VD: Fragile, Keep dry" value={packagingShipping} onChange={(e) => setPackagingShipping(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">{tr('Quy cách đóng gói khác', 'Other packaging specs', '其他包装规格', 'その他包装仕様', '기타 포장 규격')}{opt}</label>
                        <Input placeholder="VD: hạn dùng..." value={packagingOther} onChange={(e) => setPackagingOther(e.target.value)} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-xs text-muted-foreground">{tr('Thông điệp nhà sản xuất (in lên hộp không kèm nhãn)', 'Manufacturer message (printed without label)', '制造商信息（印刷无标签）', '製造者メッセージ（ラベルなしで印刷）', '제조사 메시지 (라벨 없이 인쇄)')}{opt}</label>
                        <Input placeholder={tr('VD: Mỳ ngon hảo hạng', 'e.g. Premium delicious noodles', '例如：优质美味面条', '例：プレミアム美味麺', '예: 프리미엄 맛있는 국수')} value={manufacturerMessage} onChange={(e) => setManufacturerMessage(e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <button
                          type="button"
                          onClick={() => setIncludeBoxDims((v) => !v)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${includeBoxDims ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}
                        >
                          {includeBoxDims ? '✓' : ''} {tr('Thêm kích thước hộp L×W×H', 'Include box dimensions L×W×H', '添加盒子尺寸', '箱サイズを追加', '상자 크기 L×W×H 추가')}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {designType === 'bag' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh tham khảo phong cách', 'Style reference image', '风格参考图', 'スタイル参考画像', '스타일 참조 이미지')}{opt}</label>
                    <p className="text-xs text-muted-foreground">
                      {tr('AI lấy thông tin của bạn (thương hiệu, sản phẩm...) và tùy biến theo style ảnh này. Không bê nguyên ảnh tham khảo. Khi có ảnh này, không dùng ảnh sản phẩm. Vẫn chọn màu nền và viền bên dưới.', 'AI uses your info (brand, product...) and customizes to match this style. Do not copy reference verbatim. When set, product images are not used. Still choose background and border below.', 'AI使用您的信息（品牌、产品等）并按此风格定制。不原样复制参考图。设置后不使用产品图。下方仍可选择背景和边框。', 'AIがあなたの情報（ブランド・商品など）を使い、このスタイルに合わせてカスタマイズ。参考画像をそのままコピーしない。設定時は商品画像を使用しない。下で背景・枠を選択可能。', 'AI가 귀하의 정보(브랜드·상품 등)를 사용해 이 스타일에 맞춤. 참조 이미지 그대로 복사 안 함. 설정 시 상품 이미지 미사용. 아래에서 배경·테두리 선택 가능.')}
                    </p>
                    <div className="flex items-center gap-3">
                      <input ref={referenceImageInputRef} type="file" accept="image/*" onChange={handleReferenceImageChange} className="hidden" />
                      <Button variant="outline" size="sm" type="button" onClick={() => referenceImageInputRef.current?.click()} className="shrink-0">
                        <Upload className="h-3 w-3 mr-2" />
                        {tr('Chọn ảnh tham khảo', 'Choose reference image', '选择参考图', '参考画像を選択', '참조 이미지 선택')}
                      </Button>
                      {referenceImage.preview && (
                        <div className="relative inline-block">
                          <img src={referenceImage.preview} alt="Reference" className="h-24 w-24 sm:h-32 sm:w-32 object-contain rounded-lg border-2 border-amber-200 bg-white shadow-sm" />
                          <Button variant="ghost" size="icon" className="h-7 w-7 absolute -top-1 -right-1 bg-white rounded-full shadow border hover:bg-muted" onClick={clearReferenceImage}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {referenceImage.preview && (
                    <p className="text-xs font-medium text-amber-700">
                      {tr('Vẫn chọn khung viền và màu nền bên dưới:', 'Still choose border and background below:', '仍可选择下方边框和背景：', '下で枠と背景を選択：', '아래에서 테두리와 배경 선택:')}
                    </p>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước túi (mm)', 'Bag dimensions (mm)', '袋子尺寸（毫米）', '袋のサイズ（mm）', '가방 크기 (mm)')} <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">W</label>
                        <Input type="number" min={20} max={500} value={bagWidth} onChange={(e) => setBagWidth(Number(e.target.value) || 20)} placeholder="200" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">H</label>
                        <Input type="number" min={20} max={500} value={bagHeight} onChange={(e) => setBagHeight(Number(e.target.value) || 20)} placeholder="280" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">G</label>
                        <Input type="number" min={10} max={200} value={bagGusset} onChange={(e) => setBagGusset(Number(e.target.value) || 10)} placeholder="60" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{tr('Rộng × Cao × Hông (gusset) mm', 'Width × Height × Gusset (mm)', '宽×高×侧边（毫米）', '幅×高さ×ガセット（mm）', '너비×높이×가셋 (mm)')}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước ảnh đang tạo', 'Image size being created', '正在创建的图片尺寸', '作成中の画像サイズ', '생성 중인 이미지 크기')}{opt}</label>
                    <p className="text-xs text-muted-foreground">
                      {tr('Mặt in chính túi (W×H):', 'Main print face (W×H):', '主印刷面（宽×高）：', '主印刷面（幅×高さ）：', '주 인쇄면 (W×H):')}
                    </p>
                    <p className="text-sm font-medium text-amber-800">
                      W×H ({bagWidth}×{bagHeight} mm)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Khung viền ảnh phẳng', 'Flat image border', '平面图边框', '平面画像の枠', '평면 이미지 테두리')}{opt}</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setHasBorder(false)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          !hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Không có', 'None', '无', 'なし', '없음')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasBorder(true)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Có khung viền', 'With border', '有边框', 'あり', '있음')}
                      </button>
                    </div>
                    {hasBorder && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-2">{tr('Kiểu viền:', 'Border style:', '边框样式:', '枠のスタイル:', '테두리 스타일:')}{opt}</p>
                        <Select value={borderStyle} onValueChange={setBorderStyle}>
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder={tr('Chọn kiểu viền', 'Select border style', '选择边框样式', '枠のスタイルを選択', '테두리 스타일 선택')} />
                          </SelectTrigger>
                          <SelectContent>
                            {BORDER_STYLES.map((b) => (
                              <SelectItem key={b.value} value={b.value}>
                                {getBorderLabel(b)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Màu nền ảnh phẳng', 'Flat image background', '平面图背景色', '平面画像の背景色', '평면 이미지 배경색')}{opt}</label>
                    <Select value={backgroundType} onValueChange={setBackgroundType}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder={tr('Chọn màu nền', 'Select background', '选择背景色', '背景色を選択', '배경색 선택')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BACKGROUND_OPTIONS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {getBgLabel(b)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {backgroundType === 'patterned' && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-2">{tr('Kiểu hoa văn:', 'Pattern style:', '图案样式:', '模様のスタイル:', '패턴 스타일:')}</p>
                        <div className="flex flex-wrap gap-2">
                          {PATTERN_OPTIONS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => setPatternStyle(p.value)}
                              className={`px-3 py-2 rounded-md border text-sm font-medium ${patternStyle === p.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}
                            >
                              {getPatternLabel(p)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <p className="text-xs text-muted-foreground">{tr('Tất cả tùy chọn trừ kích thước.', 'All optional except dimensions.', '除尺寸外均为可选。', 'サイズ以外は任意。', '크기 외 모두 선택.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Tên thương hiệu', 'Brand name', '品牌名', 'ブランド名', '브랜드명')}{opt}</label>
                  <Input
                    placeholder={tr('VD: NanoAI', 'e.g. NanoAI', '例如：NanoAI', '例：NanoAI', '예: NanoAI')}
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Tên sản phẩm', 'Product name', '产品名', '商品名', '상품명')}{opt}</label>
                  <Input
                    placeholder={tr('VD: Sữa rửa mặt', 'e.g. Face wash', '例如：洗面奶', '例：洗顔料', '예: 세안제')}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Địa chỉ công ty / Thông tin liên hệ', 'Company address / Contact info', '公司地址/联系方式', '会社住所・連絡先', '회사 주소/연락처')}{opt}</label>
                <Input
                  placeholder={tr('VD: 123 Đường ABC, Q.1, TP.HCM - 0901234567', 'e.g. 123 ABC St, District 1, HCMC - +84 901234567', '例如：123 ABC街，第1区，胡志明市 - 0901234567', '例：123 ABC通り、1区、HCMC - 0901234567', '예: 123 ABC거리, 1구, HCMC - 0901234567')}
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="sm:col-span-2"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tr('Thông tin bổ sung (tùy chọn – để trống nếu không cần)', 'Additional info (optional – leave blank if not needed)', '补充信息（可选）', '追加情報（任意）', '추가 정보 (선택)')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Website', 'Website', '网站', 'ウェブサイト', '웹사이트')}{opt}</label>
                    <Input placeholder="VD: www.example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Email', 'Email', '邮箱', 'メール', '이메일')}{opt}</label>
                    <Input placeholder="VD: contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Hotline / SĐT', 'Hotline / Phone', '热线/电话', 'ホットライン', '홀라인/전화')}{opt}</label>
                    <Input placeholder="VD: 1900 1234" value={hotline} onChange={(e) => setHotline(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Nguồn gốc xuất xứ', 'Country of origin', '原产地', '原産国', '원산지')}{opt}</label>
                    <Input placeholder="VD: Sản xuất tại Việt Nam" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Hướng dẫn bảo quản', 'Storage instructions', '保存方法', '保存方法', '보관 방법')}{opt}</label>
                    <Input placeholder="VD: Bảo quản nơi khô ráo, tránh ánh nắng" value={storageInstructions} onChange={(e) => setStorageInstructions(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Cảnh báo / Allergy', 'Warning / Allergy', '警示/过敏', '警告・アレルギー', '경고/알레르기')}{opt}</label>
                    <Input placeholder="VD: Tránh xa tầm tay trẻ em | Có thể gây dị ứng" value={warningAllergy} onChange={(e) => setWarningAllergy(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Thể tích', 'Volume', '体积', '容量', '용량')}{opt}</label>
                    <Input placeholder="VD: 500ml, 1L" value={volume} onChange={(e) => setVolume(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Mã đăng ký', 'Registration code', '注册号', '登録番号', '등록번호')}{opt}</label>
                    <Input placeholder="VD: Mã số ĐKSP, Đăng ký ATVSTP" value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Link mạng xã hội', 'Social media links', '社交媒体', 'SNS', '소셜 미디어')}{opt}</label>
                    <Input placeholder="VD: facebook.com/ten-trang | instagram.com/ten-trang" value={socialLinks} onChange={(e) => setSocialLinks(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Các ô nội dung sản phẩm', 'Product content blocks', '产品信息区块', '商品情報ブロック', '상품 정보 블록')}{opt}</label>
                <div className="space-y-3">
                  {contentBlocks.map((block) => (
                    <div key={block.id} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-muted/30">
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder={tr('Tiêu đề (VD: Thành phần)', 'Title (e.g. Ingredients)', '标题（如：成分）', '見出し（例：成分）', '제목 (예: 성분)')}
                          value={block.label}
                          onChange={(e) => updateContentBlock(block.id, 'label', e.target.value)}
                          className="sm:w-36 shrink-0"
                        />
                        <textarea
                          placeholder={tr('Nội dung...', 'Content...', '内容...', '内容...', '내용...')}
                          value={block.content}
                          onChange={(e) => updateContentBlock(block.id, 'content', e.target.value)}
                          className="flex-1 min-h-[50px] px-3 py-2 text-sm border rounded-md bg-background resize-y"
                          rows={2}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground" onClick={() => removeContentBlock(block.id)} disabled={contentBlocks.length <= 1}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addContentBlock} className="w-full sm:w-auto">
                    + {tr('Thêm ô', 'Add block', '添加区块', 'ブロック追加', '블록 추가')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStyle(s.value)}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        style === s.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                      }`}
                    >
                      {uiLocale === 'en' ? s.labelEn : s.labelVi}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh sản phẩm (in lên hộp/túi)', 'Product images (print on box/bag)', '产品图片（打印到包装上）', '商品画像（箱・袋に印刷）', '상품 이미지 (상자/가방에 인쇄)')}{opt}</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    ref={productImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleProductImageChange}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => productImageInputRef.current?.click()}
                    className="shrink-0"
                    disabled={productImages.length >= MAX_PRODUCT_IMAGES}
                  >
                    <ImageIcon className="h-3 w-3 mr-2" />
                    {tr('Chọn ảnh sản phẩm', 'Choose product images', '选择产品图片', '商品画像を選択', '상품 이미지 선택')} ({productImages.length}/{MAX_PRODUCT_IMAGES})
                  </Button>
                  {productImages.length > 0 && (
                    <Button variant="ghost" size="sm" type="button" onClick={clearAllProductImages} className="text-muted-foreground">
                      <X className="h-3 w-3 mr-1" />
                      {tr('Xóa tất cả', 'Clear all', '清除全部', 'すべて削除', '모두 삭제')}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {productImages.map((p, idx) => (
                    <div key={idx} className="relative group">
                      <img src={p.preview} alt={tr('Ảnh sản phẩm', 'Product image', '产品图片', '商品画像', '상품 이미지')} className="h-16 w-16 object-contain rounded border" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-90 group-hover:opacity-100"
                        onClick={() => removeProductImage(idx)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr('Tối đa 6 ảnh. Ảnh sẽ được in lên mặt hộp/túi trong mockup.', 'Max 6 images. Images will be printed on box/bag surface in mockup.', '最多 6 张图片。图片将打印在包装表面。', '最大6枚。画像は箱・袋の表面に印刷されます。', '최대 6장. 이미지는 목업의 상자/가방 표면에 인쇄됩니다.')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')}{opt}</label>
                <div className="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                  <Button variant="outline" size="sm" type="button" onClick={() => logoInputRef.current?.click()} className="shrink-0">
                    <Upload className="h-3 w-3 mr-2" />
                    {tr('Chọn logo', 'Choose logo', '选择 Logo', 'ロゴを選択', '로고 선택')}
                  </Button>
                  {logo.preview && (
                    <div className="relative flex items-center gap-2 shrink-0">
                      <img src={logo.preview} alt="Logo" className="h-12 w-12 object-contain rounded border" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearLogo}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Hướng chữ', 'Text orientation', '文字方向', '文字の向き', '텍스트 방향')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTextOrientation('horizontal')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      textOrientation === 'horizontal' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                    }`}
                  >
                    {tr('Quay ngang', 'Horizontal', '横向', '横', '가로')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextOrientation('vertical')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      textOrientation === 'vertical' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                    }`}
                  >
                    {tr('Quay dọc', 'Vertical', '纵向', '縦', '세로')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr('Tỷ lệ khung hình tự động theo kích thước và hướng chữ.', 'Aspect ratio auto from dimensions and text orientation.', '宽高比根据尺寸和文字方向自动计算。', 'アスペクト比はサイズと文字の向きから自動。', '화면 비율은 크기와 텍스트 방향에 따라 자동.')}{' '}
                  <span className="font-medium">
                    {tr('Tỷ lệ:', 'Ratio:', '比例:', '比率:', '비율:')}{' '}
                    {designType === 'box'
                      ? getAspectRatioFromDimensions(surfaceLength, surfaceWidth, textOrientation)
                      : getAspectRatioFromDimensions(bagWidth, bagHeight, textOrientation)}
                  </span>
                  <span className="text-muted-foreground"> ({GEMINI_ASPECT_RATIO_LIST.join(', ')})</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Chất lượng ảnh', 'Image quality', '图像质量', '画質', '이미지 품질')}{opt}</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImageQuality('2K')}
                      className={`px-3 py-2 rounded-md border text-sm font-medium ${
                        imageQuality === '2K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      2K ({tr('1,5 credits', '1.5 credits', '1.5 积分', '1.5クレジット', '1.5 크레딧')})
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageQuality('4K')}
                      className={`px-3 py-2 rounded-md border text-sm font-medium ${
                        imageQuality === '4K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      4K (3 credits)
                    </button>
                  </div>
                </div>
              </div>

              <Button onClick={() => checkCreditsAndProceed(cost, () => void handleSubmit())} className="w-full min-h-[44px] touch-manipulation" size="lg">
                <Sparkles className="h-4 w-4 mr-2" />
                {designType === 'box'
                  ? tr('Bắt đầu - Tạo ảnh phẳng 1', 'Start - Create flat design 1', '开始 - 创建平面图1', '開始 - 平面デザイン1を作成', '시작 - 평면 디자인 1 생성')
                  : tr('Bắt đầu - Tạo ảnh phẳng túi', 'Start - Create bag flat design', '开始 - 创建袋子平面图', '開始 - 袋の平面デザインを作成', '시작 - 가방 평면 디자인 생성')}{' '}
                ({formatCredits(cost)} {tr('credits', 'credits', '积分', 'クレジット', '크레딧')})
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 'FACE_INPUT' && designType === 'box' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-amber-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LayoutTemplate className="h-4 w-4 text-amber-600" />
                {tr('Tạo ảnh phẳng', 'Create flat design', '创建平面图', '平面デザインを作成', '평면 디자인 생성')} (1–6)
              </CardTitle>
              <CardDescription>
                {tr('Chọn kích thước L×W, L×H hoặc W×H. Tối đa 6 ảnh. Có thể chuyển Mockup 3D bất kỳ lúc nào.', 'Choose size L×W, L×H or W×H. Max 6 images. Go to 3D Mockup anytime.', '选择尺寸L×W、L×H或W×H。最多6张。可随时转3D样机。', 'L×W、L×H、W×Hを選択。最大6枚。いつでも3Dモックアップへ。', 'L×W, L×H, W×H 선택. 최대 6장. 언제든 3D 목업으로.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Kích thước ảnh sắp tạo', 'Size for next image', '下一张尺寸', '次の画像サイズ', '다음 이미지 크기')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  {FACE_SIZE_KEYS.map((k) => {
                    const count = faces.filter((f) => f.sizeKey === k).length
                    const disabled = faces.length >= 6
                    return (
                      <button
                        key={k}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedFaceSize(k)}
                        className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                          selectedFaceSize === k ? 'border-amber-500 bg-amber-50 text-amber-800' : disabled ? 'border-gray-200 bg-gray-50 text-muted-foreground cursor-not-allowed' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        {getSizeKeyLabel(k, boxLength, boxWidth, boxHeight)} ({count})
                      </button>
                    )
                  })}
                </div>
                {selectedFaceSize && (
                  <p className="text-xs text-amber-700 font-medium">
                    {tr('Ảnh số', 'Image', '图', '画像', '이미지')} {faces.length + 1} {tr('sẽ là', 'will be', '将是', 'は', '는')}: {getSizeKeyLabel(selectedFaceSize, boxLength, boxWidth, boxHeight)}
                  </p>
                )}
              </div>

              {faces.length >= 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh đã tạo', 'Created images', '已创建', '作成済み', '생성된 이미지')} ({faces.length}/6)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {faces.map((f, i) => {
                      const [len, wid] = getDimensionsFromSizeKey(f.sizeKey, boxLength, boxWidth, boxHeight)
                      return (
                        <div key={f.id} className="relative group space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {tr('Ảnh', 'Image', '图', '画像', '이미지')} {i + 1} – {getSizeKeyLabel(f.sizeKey, boxLength, boxWidth, boxHeight)}
                          </p>
                          <div className="w-full aspect-square rounded border bg-muted/30 overflow-hidden">
                            <ImagePreview src={f.url} alt="" className="w-full h-full" asImg />
                          </div>
                          <DownloadImageButton
                            imageUrl={f.url}
                            filename={`box-flat-${f.sizeKey}-${i + 1}-${Date.now()}.png`}
                            printReady
                            printReadyAspectRatio={getAspectRatioFromDimensions(len, wid, textOrientation)}
                            printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                            size="sm"
                            className="w-full"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {faces.length >= 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh tham khảo style', 'Style reference', '风格参考', 'スタイル参考', '스타일 참조')}</label>
                  <div className="flex justify-center">
                    <img src={faces[0].url} alt="" className="max-h-24 object-contain rounded border" />
                  </div>
                  <p className="text-xs font-medium text-amber-700">
                    {tr('Vẫn chọn khung viền và màu nền bên dưới.', 'Still choose border and background below.', '仍可选择下方边框和背景。', '下で枠と背景を選択。', '아래에서 테두리와 배경 선택.')}
                  </p>
                </div>
              )}

              {faces.length === 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh tham khảo phong cách', 'Style reference image', '风格参考图', 'スタイル参考画像', '스타일 참조 이미지')}{opt}</label>
                  <p className="text-xs text-muted-foreground">
                    {tr('AI lấy thông tin của bạn (thương hiệu, sản phẩm...) và tùy biến theo style ảnh này. Không bê nguyên ảnh tham khảo. Khi có ảnh này, không dùng ảnh sản phẩm. Vẫn chọn màu nền và viền bên dưới.', 'AI uses your info (brand, product...) and customizes to match this style. Do not copy reference verbatim. When set, product images are not used. Still choose background and border below.', 'AI使用您的信息（品牌、产品等）并按此风格定制。不原样复制参考图。设置后不使用产品图。下方仍可选择背景和边框。', 'AIがあなたの情報（ブランド・商品など）を使い、このスタイルに合わせてカスタマイズ。参考画像をそのままコピーしない。設定時は商品画像を使用しない。下で背景・枠を選択可能。', 'AI가 귀하의 정보(브랜드·상품 등)를 사용해 이 스타일에 맞춤. 참조 이미지 그대로 복사 안 함. 설정 시 상품 이미지 미사용. 아래에서 배경·테두리 선택 가능.')}
                  </p>
                  <div className="flex items-center gap-3">
                    <input ref={referenceImageInputRef} type="file" accept="image/*" onChange={handleReferenceImageChange} className="hidden" />
                    <Button variant="outline" size="sm" type="button" onClick={() => referenceImageInputRef.current?.click()} className="shrink-0">
                      <Upload className="h-3 w-3 mr-2" />
                      {tr('Chọn ảnh tham khảo', 'Choose reference image', '选择参考图', '参考画像を選択', '참조 이미지 선택')}
                    </Button>
                    {referenceImage.preview && (
                      <div className="relative inline-block">
                        <img src={referenceImage.preview} alt="Reference" className="h-24 w-24 sm:h-32 sm:w-32 object-contain rounded-lg border-2 border-amber-200 bg-white shadow-sm" />
                        <Button variant="ghost" size="icon" className="h-7 w-7 absolute -top-1 -right-1 bg-white rounded-full shadow border hover:bg-muted" onClick={clearReferenceImage}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {referenceImage.preview && (
                    <p className="text-xs font-medium text-amber-700">
                      {tr('Vẫn chọn khung viền và màu nền bên dưới.', 'Still choose border and background below.', '仍可选择下方边框和背景。', '下で枠と背景を選択。', '아래에서 테두리와 배경 선택.')}
                    </p>
                  )}
                </div>
              )}

              <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 p-4 space-y-4">
                <p className="text-xs font-medium text-amber-800">
                  {(faces.length >= 1 || referenceImage.preview) ? tr('Khung viền và màu nền (vẫn áp dụng khi có ảnh tham khảo)', 'Border and background (still apply with reference)', '边框和背景（有参考图时仍适用）', '枠と背景（参考ありでも適用）', '테두리·배경 (참조 시에도 적용)') : tr('Khung viền và màu nền', 'Border and background', '边框和背景', '枠と背景', '테두리와 배경')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Khung viền ảnh', 'Image border', '图片边框', '画像の枠', '이미지 테두리')}{opt}</label>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setHasBorder(false)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          !hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Không có', 'None', '无', 'なし', '없음')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasBorder(true)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          hasBorder ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Có khung viền', 'With border', '有边框', 'あり', '있음')}
                      </button>
                    </div>
                    {hasBorder && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground mb-2">{tr('Kiểu viền:', 'Border style:', '边框样式:', '枠のスタイル:', '테두리 스타일:')}{opt}</p>
                        <Select value={borderStyle} onValueChange={setBorderStyle}>
                          <SelectTrigger className="w-full max-w-xs">
                            <SelectValue placeholder={tr('Chọn kiểu viền', 'Select border style', '选择边框样式', '枠のスタイルを選択', '테두리 스타일 선택')} />
                          </SelectTrigger>
                          <SelectContent>
                            {BORDER_STYLES.map((b) => (
                              <SelectItem key={b.value} value={b.value}>
                                {getBorderLabel(b)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">{tr('Màu nền', 'Background', '背景色', '背景色', '배경색')}{opt}</label>
                    <Select value={backgroundType} onValueChange={setBackgroundType}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder={tr('Chọn màu nền', 'Select background', '选择背景色', '背景色を選択', '배경색 선택')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BACKGROUND_OPTIONS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {getBgLabel(b)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {backgroundType === 'patterned' && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {PATTERN_OPTIONS.map((p) => (
                          <button key={p.value} type="button" onClick={() => setPatternStyle(p.value)} className={`px-3 py-2 rounded-md border text-sm ${patternStyle === p.value ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                            {getPatternLabel(p)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Hướng chữ', 'Text orientation', '文字方向', '文字の向き', '텍스트 방향')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTextOrientation('horizontal')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      textOrientation === 'horizontal' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                    }`}
                  >
                    {tr('Quay ngang', 'Horizontal', '横向', '横', '가로')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextOrientation('vertical')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      textOrientation === 'vertical' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                    }`}
                  >
                    {tr('Quay dọc', 'Vertical', '纵向', '縦', '세로')}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {textOrientation === 'horizontal'
                    ? tr('Chữ nằm ngang theo chiều dài ảnh.', 'Text horizontal along image length.', '文字沿图像长度横向排列。', '文字は画像の長辺に沿って横。', '텍스트는 이미지 길이 방향으로 가로.')
                    : tr('Chữ nằm ngang theo chiều ngắn ảnh.', 'Text horizontal along image width.', '文字沿图像短边横向排列。', '文字は画像の短辺に沿って横。', '텍스트는 이미지 짧은 변 방향으로 가로.')}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
                {tr('Tỷ lệ theo kích thước đã chọn:', 'Ratio from selection:', '根据所选尺寸比例:', '選択サイズの比率:', '선택 크기 비율:')}{' '}
                <span className="font-medium text-foreground">{getAspectRatioFromDimensions(surfaceLength, surfaceWidth, textOrientation)}</span>
                <span className="text-muted-foreground"> ({GEMINI_ASPECT_RATIO_LIST.join(', ')})</span>
              </p>

              <div className="space-y-2 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground">{tr('Thông tin đóng gói (tùy chọn)', 'Packaging info (optional)', '包装信息（可选）', '包装情報（任意）', '포장 정보 (선택)')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Số lô', 'Batch/Lot', '批号', 'ロット', '로트')}{opt}</label>
                    <Input placeholder="VD: Lô 001" value={packagingBatchLot} onChange={(e) => setPackagingBatchLot(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Ngày SX', 'Prod. date', '生产日期', '製造日', '제조일')}{opt}</label>
                    <Input type="date" value={packagingProdDate} onChange={(e) => setPackagingProdDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Hạn dùng', 'Expiry date', '保质期', '賞味期限', '유통기한')}{opt}</label>
                    <Input type="date" value={packagingExpiryDate} onChange={(e) => setPackagingExpiryDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Số lượng', 'Quantity', '数量', '数量', '수량')}{opt}</label>
                    <Input placeholder={tr('Số lượng', 'Quantity', '数量', '数量', '수량')} value={packagingQuantity} onChange={(e) => setPackagingQuantity(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Trọng lượng', 'Weight', '重量', '重量', '중량')}{opt}</label>
                    <Input placeholder={tr('Trọng lượng', 'Weight', '重量', '重量', '중량')} value={packagingWeight} onChange={(e) => setPackagingWeight(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Yêu cầu vận chuyển', 'Shipping', '运输要求', '輸送要件', '운송')}{opt}</label>
                    <Input placeholder={tr('Yêu cầu vận chuyển', 'Shipping', '运输要求', '輸送要件', '운송')} value={packagingShipping} onChange={(e) => setPackagingShipping(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Quy cách khác', 'Other specs', '其他规格', 'その他', '기타')}{opt}</label>
                    <Input placeholder={tr('Quy cách khác', 'Other specs', '其他规格', 'その他', '기타')} value={packagingOther} onChange={(e) => setPackagingOther(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Thông điệp nhà sản xuất (in không nhãn)', 'Manufacturer message (no label)', '制造商信息（无标签）', '製造者メッセージ（ラベルなし）', '제조사 메시지 (라벨 없음)')}{opt}</label>
                    <Input placeholder={tr('VD: Mỳ ngon hảo hạng', 'e.g. Premium noodles', '例如：优质面条', '例：プレミアム麺', '예: 프리미엄 국수')} value={manufacturerMessage} onChange={(e) => setManufacturerMessage(e.target.value)} />
                  </div>
                  <button type="button" onClick={() => setIncludeBoxDims((v) => !v)} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm sm:col-span-2 ${includeBoxDims ? 'border-amber-500 bg-amber-50' : 'border-gray-200'}`}>
                    {includeBoxDims ? '✓' : ''} {tr('Thêm kích thước hộp L×W×H', 'Include box dimensions', '添加盒子尺寸', '箱サイズ追加', '상자 크기 추가')}{opt}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Tên thương hiệu', 'Brand name', '品牌名', 'ブランド名', '브랜드명')}{opt}</label>
                  <Input placeholder={tr('VD: NanoAI', 'e.g. NanoAI', '例如：NanoAI', '例：NanoAI', '예: NanoAI')} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">{tr('Tên sản phẩm', 'Product name', '产品名', '商品名', '상품명')}{opt}</label>
                  <Input placeholder={tr('VD: Sữa rửa mặt', 'e.g. Face wash', '例如：洗面奶', '例：洗顔料', '예: 세안제')} value={productName} onChange={(e) => setProductName(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Địa chỉ công ty / Thông tin liên hệ', 'Company address / Contact info', '公司地址/联系方式', '会社住所・連絡先', '회사 주소/연락처')}{opt}</label>
                <Input
                  placeholder={tr('VD: 123 Đường ABC, Q.1, TP.HCM - 0901234567', 'e.g. 123 ABC St, District 1, HCMC - +84 901234567', '例如：123 ABC街，第1区，胡志明市 - 0901234567', '例：123 ABC通り、1区、HCMC - 0901234567', '예: 123 ABC거리, 1구, HCMC - 0901234567')}
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tr('Thông tin bổ sung (tùy chọn)', 'Additional info (optional)', '补充信息（可选）', '追加情報（任意）', '추가 정보 (선택)')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Website', 'Website', '网站', 'ウェブサイト', '웹사이트')}{opt}</label>
                    <Input placeholder="www.example.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Email', 'Email', '邮箱', 'メール', '이메일')}{opt}</label>
                    <Input placeholder="contact@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Hotline', 'Hotline', '热线', 'ホットライン', '홀라인')}{opt}</label>
                    <Input placeholder="1900 1234" value={hotline} onChange={(e) => setHotline(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Nguồn gốc', 'Origin', '原产地', '原産国', '원산지')}{opt}</label>
                    <Input placeholder="Sản xuất tại VN" value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Bảo quản', 'Storage', '保存', '保存', '보관')}{opt}</label>
                    <Input placeholder="VD: Nơi khô ráo, tránh ánh nắng" value={storageInstructions} onChange={(e) => setStorageInstructions(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Cảnh báo / Allergy', 'Warning / Allergy', '警示', '警告', '경고')}{opt}</label>
                    <Input placeholder="VD: Tránh xa trẻ em" value={warningAllergy} onChange={(e) => setWarningAllergy(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Thể tích', 'Volume', '体积', '容量', '용량')}{opt}</label>
                    <Input placeholder="500ml" value={volume} onChange={(e) => setVolume(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{tr('Mã ĐK', 'Reg. code', '注册号', '登録番号', '등록번호')}{opt}</label>
                    <Input placeholder="Mã số ĐKSP" value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs text-muted-foreground">{tr('Mạng xã hội', 'Social media', '社交媒体', 'SNS', '소셜')}{opt}</label>
                    <Input placeholder="facebook.com/..." value={socialLinks} onChange={(e) => setSocialLinks(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Các ô nội dung sản phẩm', 'Product content blocks', '产品信息区块', '商品情報ブロック', '상품 정보 블록')}{opt}</label>
                <p className="text-xs text-muted-foreground">
                  {tr('Mỗi ô hiển thị ở vị trí khác nhau trên ảnh. VD: Thành phần, Hướng dẫn sử dụng, Công dụng...', 'Each block displays in a different area. e.g. Ingredients, Usage, Benefits...', '每个区块显示在不同位置。如：成分、用法、功效...', '各ブロックは別の位置に表示。例：成分、使用方法、効能...', '각 블록은 다른 위치에 표시. 예: 성분, 사용법, 효능...')}
                </p>
                <div className="space-y-3">
                  {contentBlocks.map((block) => (
                    <div key={block.id} className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border bg-muted/30">
                      <div className="flex gap-2 flex-1">
                        <Input
                          placeholder={tr('Tiêu đề ô (VD: Thành phần)', 'Block title (e.g. Ingredients)', '区块标题（如：成分）', 'ブロック見出し（例：成分）', '블록 제목 (예: 성분)')}
                          value={block.label}
                          onChange={(e) => updateContentBlock(block.id, 'label', e.target.value)}
                          className="sm:w-40 shrink-0"
                        />
                        <textarea
                          placeholder={tr('Nội dung...', 'Content...', '内容...', '内容...', '내용...')}
                          value={block.content}
                          onChange={(e) => updateContentBlock(block.id, 'content', e.target.value)}
                          className="flex-1 min-h-[60px] px-3 py-2 text-sm border rounded-md bg-background resize-y"
                          rows={2}
                        />
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-muted-foreground" onClick={() => removeContentBlock(block.id)} disabled={contentBlocks.length <= 1}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addContentBlock} className="w-full sm:w-auto">
                    + {tr('Thêm ô', 'Add block', '添加区块', 'ブロック追加', '블록 추가')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Phong cách', 'Style', '风格', 'スタイル', '스타일')}{opt}</label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setStyle(s.value)}
                      className={`px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                        style === s.value ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                      }`}
                    >
                      {uiLocale === 'en' ? s.labelEn : s.labelVi}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Ảnh sản phẩm (in lên hộp/túi)', 'Product images (print on box/bag)', '产品图片（打印到包装上）', '商品画像（箱・袋に印刷）', '상품 이미지 (상자/가방에 인쇄)')}{opt}</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={productImageInputRef} type="file" accept="image/*" multiple onChange={handleProductImageChange} className="hidden" />
                  <Button variant="outline" size="sm" type="button" onClick={() => productImageInputRef.current?.click()} className="shrink-0" disabled={productImages.length >= MAX_PRODUCT_IMAGES}>
                    <ImageIcon className="h-3 w-3 mr-2" />
                    {tr('Chọn ảnh sản phẩm', 'Choose product images', '选择产品图片', '商品画像を選択', '상품 이미지 선택')} ({productImages.length}/{MAX_PRODUCT_IMAGES})
                  </Button>
                  {productImages.length > 0 && (
                    <Button variant="ghost" size="sm" type="button" onClick={clearAllProductImages} className="text-muted-foreground">
                      <X className="h-3 w-3 mr-1" />
                      {tr('Xóa tất cả', 'Clear all', '清除全部', 'すべて削除', '모두 삭제')}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {productImages.map((p, idx) => (
                    <div key={idx} className="relative group">
                      <img src={p.preview} alt="" className="h-16 w-16 object-contain rounded border" />
                      <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-90" onClick={() => removeProductImage(idx)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')}{opt}</label>
                <div className="flex items-center gap-3">
                  <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                  <Button variant="outline" size="sm" type="button" onClick={() => logoInputRef.current?.click()} className="shrink-0">
                    <Upload className="h-3 w-3 mr-2" />
                    {tr('Chọn logo', 'Choose logo', '选择 Logo', 'ロゴを選択', '로고 선택')}
                  </Button>
                  {logo.preview && (
                    <div className="relative flex items-center gap-2 shrink-0">
                      <img src={logo.preview} alt="Logo" className="h-12 w-12 object-contain rounded border" />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearLogo}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">{tr('Chất lượng ảnh', 'Image quality', '图像质量', '画質', '이미지 품질')}{opt}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setImageQuality('2K')} className={`px-3 py-2 rounded-md border text-sm font-medium ${imageQuality === '2K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    2K ({tr('1,5 credits', '1.5 credits', '1.5 积分', '1.5クレジット', '1.5 크레딧')})
                  </button>
                  <button type="button" onClick={() => setImageQuality('4K')} className={`px-3 py-2 rounded-md border text-sm font-medium ${imageQuality === '4K' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    4K (3 credits)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => checkCreditsAndProceed(cost, () => void handleFaceSubmit())}
                  className="flex-1 min-h-[44px] touch-manipulation"
                  size="lg"
                  disabled={!selectedFaceSize || faces.length >= 6}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {tr('Tạo ảnh phẳng', 'Create flat design', '创建平面图', '平面デザイン作成', '평면 디자인 생성')} ({formatCredits(cost)} {tr('credits', 'credits', '积分', 'クレジット', '크레딧')})
                </Button>
                {faces.length >= 1 && (
                  <Button variant="default" size="lg" onClick={() => setStep('MOCKUP_INPUT')}>
                    {tr('Chuyển sang Mockup 3D', 'Go to 3D Mockup', '转到3D样机', '3Dモックアップへ', '3D 목업으로')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (returnToStep) {
                      setStep(returnToStep)
                      setReturnToStep(null)
                    } else {
                      setStep('INPUT')
                    }
                  }}
                >
                  {tr('Quay lại', 'Back', '返回', '戻る', '돌아가기')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function formatCredits(n: number) {
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 1 })
}

function FaceResultImage({
  src,
  alt,
  onErrorRetry,
  tr,
}: {
  src: string
  alt: string
  onErrorRetry: () => void
  tr: (vi: string, en: string, zh: string, ja: string, ko: string) => string
}) {
  const [loadError, setLoadError] = useState(false)
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {tr('Ảnh tải không thành công', 'Image failed to load', '图像加载失败', '画像の読み込みに失敗しました', '이미지 로드 실패')}
        </p>
        <Button variant="outline" size="sm" onClick={onErrorRetry}>
          {tr('Thử lại', 'Retry', '重试', '再試行', '다시 시도')}
        </Button>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      className="max-w-full max-h-[400px] object-contain rounded shadow"
      onError={() => setLoadError(true)}
    />
  )
}
