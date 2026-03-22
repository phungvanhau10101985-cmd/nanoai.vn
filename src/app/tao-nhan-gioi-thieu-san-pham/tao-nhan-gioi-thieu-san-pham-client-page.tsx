'use client'

import { useState, useRef, ChangeEvent, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { createProductLabel, createLabelMockupOnProduct } from './actions'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Upload, Sparkles, RefreshCw, Plus, X, Check, Save, FolderOpen, Box, FileSpreadsheet, FileDown, Trash2, FileEdit } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { DepositCreditButton } from '@/components/deposit-credit-button'
import { useCredits } from '@/hooks/use-credits'
import { DownloadImageButton } from '@/components/download-image-button'
import { ImagePreview } from '@/components/ui/image-preview'
import { ImageProcessingLoader } from '@/components/image-processing-loader'
import { preloadImageUrl } from '@/lib/preload-image-url'
import { getClosestGeminiAspectRatio } from '@/lib/label-size-presets'

type Step = 'UPLOAD' | 'GENERATING' | 'RESULT' | 'MOCKUP_UPLOAD' | 'MOCKUP_GENERATING' | 'MOCKUP_RESULT'
type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

function getWebLocaleFromCookie(): UiLocale {
  if (typeof document === 'undefined') return 'vi'
  const cookieValue = document.cookie
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('nanoai_locale='))
    ?.split('=')[1]
    ?.trim()
    .toLowerCase()
  if (cookieValue === 'en' || cookieValue === 'zh' || cookieValue === 'ja' || cookieValue === 'ko') return cookieValue
  return 'vi'
}

const MAX_PRODUCT_IMAGES = 6

const MIN_LABEL_MM = 20
const MAX_LABEL_MM = 800

const STYLES = [
  { value: 'modern', labelVi: 'Hiện đại', labelEn: 'Modern' },
  { value: 'luxury', labelVi: 'Cao cấp', labelEn: 'Luxury' },
  { value: 'natural', labelVi: 'Tự nhiên', labelEn: 'Natural' },
  { value: 'vibrant', labelVi: 'Rực rỡ', labelEn: 'Vibrant' },
] as const

const BACKGROUND_OPTIONS = [
  { value: 'ai', labelVi: 'AI tự chọn', labelEn: 'AI chooses' },
  { value: 'white', labelVi: 'Trắng', labelEn: 'White' },
  { value: 'cream', labelVi: 'Kem', labelEn: 'Cream' },
  { value: 'beige', labelVi: 'Be', labelEn: 'Beige' },
  { value: 'lightgray', labelVi: 'Xám nhạt', labelEn: 'Light gray' },
  { value: 'lightblue', labelVi: 'Xanh nhạt', labelEn: 'Light blue' },
  { value: 'mint', labelVi: 'Bạc hà', labelEn: 'Mint' },
  { value: 'lightpink', labelVi: 'Hồng pastel', labelEn: 'Light pink' },
] as const

const BORDER_STYLES = [
  { value: 'single', labelVi: 'Viền đơn', labelEn: 'Single' },
  { value: 'double', labelVi: 'Viền đôi', labelEn: 'Double' },
  { value: 'rounded', labelVi: 'Bo góc', labelEn: 'Rounded' },
  { value: 'dotted', labelVi: 'Chấm', labelEn: 'Dotted' },
] as const

/** Icon thường có trên nhãn sản phẩm – khách chọn để AI vẽ lên nhãn */
const LABEL_ICONS = [
  { id: 'washing_care', labelVi: 'Nhãn giặt tẩy', labelEn: 'Washing care symbols' },
  { id: 'recycle', labelVi: 'Nhựa tái sinh', labelEn: 'Recyclable' },
  { id: 'plastic_pet', labelVi: 'Nhựa PET (1)', labelEn: 'PET plastic (1)' },
  { id: 'plastic_pp', labelVi: 'Nhựa PP (5)', labelEn: 'PP plastic (5)' },
  { id: 'vegan', labelVi: 'Vegan', labelEn: 'Vegan' },
  { id: 'cruelty_free', labelVi: 'Không thử nghiệm động vật', labelEn: 'Cruelty-free' },
  { id: 'organic', labelVi: 'Hữu cơ', labelEn: 'Organic' },
  { id: 'fsc', labelVi: 'FSC rừng bền vững', labelEn: 'FSC certified' },
  { id: 'compostable', labelVi: 'Có thể ủ phân', labelEn: 'Compostable' },
  { id: 'gluten_free', labelVi: 'Không gluten', labelEn: 'Gluten-free' },
  { id: 'halal', labelVi: 'Halal', labelEn: 'Halal' },
  { id: 'kosher', labelVi: 'Kosher', labelEn: 'Kosher' },
  { id: 'keep_dry', labelVi: 'Bảo vệ khỏi ẩm', labelEn: 'Keep dry' },
  { id: 'keep_sun', labelVi: 'Tránh ánh nắng', labelEn: 'Avoid sunlight' },
  { id: 'food_grade', labelVi: 'Thực phẩm', labelEn: 'Food grade' },
  { id: 'fragile', labelVi: 'Dễ vỡ', labelEn: 'Fragile' },
  { id: 'child_safe', labelVi: 'Để xa trẻ em', labelEn: 'Keep from children' },
] as const

const DRAFT_KEY = 'tao-nhan-gioi-thieu-san-pham-draft'
const PROJECTS_KEY = 'tao-nhan-gioi-thieu-san-pham-projects'
const PROJECTS_RETENTION_DAYS = 30

type ProjectItem = {
  id: string
  createdAt: number
  step: Step
  labelName: string
  productName: string
  brandName: string
  resultUrl: string | null
  mockupResultUrl: string | null
  labelWidthMm: string
  labelHeightMm: string
  aspectRatio: string
  imageQuality: '2K' | '4K'
  labelText: string
  productDescription: string
  ingredients: string
  usageInstructions: string
  companyAddress: string
  website: string
  email: string
  hotline: string
  storageInstructions: string
  warningAllergy: string
  warningOther: string
  volume: string
  registrationCode: string
  countryOfOrigin: string
  packagingProdDate: string
  packagingExpiryDate: string
  hasBarcode: boolean
  hasQrCode: boolean
  selectedLabelIcons: string[]
  style: string
  backgroundType: string
  borderStyle: string
  hasBorder: boolean
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

function saveProject(item: Omit<ProjectItem, 'id' | 'createdAt'>): string {
  if (typeof window === 'undefined') return ''
  try {
    const list = getProjects()
    const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newItem: ProjectItem = { ...item, id, createdAt: Date.now() }
    list.unshift(newItem)
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list))
    return id
  } catch {
    return ''
  }
}

function updateProject(id: string, updates: Partial<ProjectItem>): void {
  if (typeof window === 'undefined') return
  try {
    const list = getProjects().map((p) => (p.id === id ? { ...p, ...updates } : p))
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

export default function TaoNhanGioiThieuSanPhamClientPage() {
  const [uiLocale, setUiLocale] = useState<UiLocale>('vi')
  const [step, setStep] = useState<Step>('UPLOAD')
  const [labelName, setLabelName] = useState('')
  const [labelText, setLabelText] = useState('')
  const [brandName, setBrandName] = useState('')
  const [productName, setProductName] = useState('')
  const [productDescription, setProductDescription] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [usageInstructions, setUsageInstructions] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [hotline, setHotline] = useState('')
  const [storageInstructions, setStorageInstructions] = useState('')
  const [warningAllergy, setWarningAllergy] = useState('')
  const [warningOther, setWarningOther] = useState('')
  const [volume, setVolume] = useState('')
  const [registrationCode, setRegistrationCode] = useState('')
  const [countryOfOrigin, setCountryOfOrigin] = useState('')
  const [packagingProdDate, setPackagingProdDate] = useState('')
  const [packagingExpiryDate, setPackagingExpiryDate] = useState('')
  const [hasBarcode, setHasBarcode] = useState(false)
  const [hasQrCode, setHasQrCode] = useState(false)
  const [selectedLabelIcons, setSelectedLabelIcons] = useState<string[]>([])
  const [style, setStyle] = useState('modern')
  const [backgroundType, setBackgroundType] = useState('ai')
  const [borderStyle, setBorderStyle] = useState('single')
  const [hasBorder, setHasBorder] = useState(false)
  const [logo, setLogo] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [referenceImage, setReferenceImage] = useState<{ file: File | null; preview: string | null }>({ file: null, preview: null })
  const [images, setImages] = useState<{ file: File; preview: string; removeBackground: boolean }[]>([])
  const [imageQuality, setImageQuality] = useState<'2K' | '4K'>('2K')
  const [labelWidthMm, setLabelWidthMm] = useState('100')
  const [labelHeightMm, setLabelHeightMm] = useState('100')
  const aspectRatio = (() => {
    const w = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelWidthMm) || 100))
    const h = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelHeightMm) || 100))
    return getClosestGeminiAspectRatio(w, h)
  })()
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [mockupProductImage, setMockupProductImage] = useState<{ file: File; preview: string } | null>(null)
  const [mockupResultUrl, setMockupResultUrl] = useState<string | null>(null)
  const { toast } = useToast()
  const { checkCreditsAndProceed } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const referenceImageInputRef = useRef<HTMLInputElement>(null)
  const mockupProductInputRef = useRef<HTMLInputElement>(null)
  const excelImportRef = useRef<HTMLInputElement>(null)
  const stepContentRef = useRef<HTMLDivElement>(null)
  const currentProjectIdRef = useRef<string>('')
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const cost = imageQuality === '2K' ? 1.5 : 3
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
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
    if (step === 'GENERATING' || step === 'MOCKUP_GENERATING') {
      stepContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  const refreshProjects = () => setProjects(getProjects())
  useEffect(() => {
    refreshProjects()
  }, [])

  const handleAddImages = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const newImages: { file: File; preview: string; removeBackground: boolean }[] = []
    for (let i = 0; i < files.length && images.length + newImages.length < MAX_PRODUCT_IMAGES; i++) {
      const file = files[i]
      if (file.type.startsWith('image/')) {
        newImages.push({ file, preview: URL.createObjectURL(file), removeBackground: true })
      }
    }
    if (newImages.length) {
      setImages((prev) => [...prev, ...newImages].slice(0, MAX_PRODUCT_IMAGES))
      toast({ title: tr('Đã thêm ảnh', 'Images added', '已添加图片', '画像を追加しました', '이미지를 추가했습니다'), description: tr(`Thêm ${newImages.length} ảnh sản phẩm.`, `Added ${newImages.length} product images.`, `已添加 ${newImages.length} 张产品图片。`, `${newImages.length}枚の商品画像を追加しました。`, `${newImages.length}장의 제품 이미지를 추가했습니다.`), duration: 2000 })
    }
    e.target.value = ''
  }

  const handleRemove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setStep('GENERATING')
    const formData = new FormData()
    formData.append('imageQuality', imageQuality)
    formData.append('aspectRatio', aspectRatio)
    formData.append('labelName', labelName)
    formData.append('labelText', labelText)
    formData.append('brandName', brandName)
    formData.append('productName', productName)
    formData.append('productDescription', productDescription)
    formData.append('ingredients', ingredients)
    formData.append('usageInstructions', usageInstructions)
    formData.append('companyAddress', companyAddress)
    formData.append('website', website)
    formData.append('email', email)
    formData.append('hotline', hotline)
    formData.append('storageInstructions', storageInstructions)
    formData.append('warningAllergy', warningAllergy)
    formData.append('warningOther', warningOther)
    formData.append('volume', volume)
    formData.append('registrationCode', registrationCode)
    formData.append('countryOfOrigin', countryOfOrigin)
    formData.append('packagingProdDate', packagingProdDate)
    formData.append('packagingExpiryDate', packagingExpiryDate)
    formData.append('hasBarcode', String(hasBarcode))
    formData.append('hasQrCode', String(hasQrCode))
    formData.append('selectedLabelIcons', JSON.stringify(selectedLabelIcons))
    formData.append('style', style)
    formData.append('backgroundType', backgroundType)
    formData.append('borderStyle', borderStyle)
    formData.append('hasBorder', String(hasBorder))
    if (logo.file) formData.append('logo', logo.file)
    if (referenceImage.file) formData.append('referenceImageFile', referenceImage.file)
    images.forEach((img, i) => {
      formData.append(`image_${i}`, img.file)
      formData.append(`image_${i}_removeBg`, String(img.removeBackground))
    })
    const result = await createProductLabel(formData)
    if (result.error) {
      setStep('UPLOAD')
      toast({ title: tr('Tạo nhãn thất bại', 'Create label failed', '创建标签失败', 'ラベル作成に失敗しました', '라벨 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setResultUrl(result.resultUrl)
      setStep('RESULT')
      const projId = saveProject({
        step: 'RESULT',
        labelName,
        productName,
        brandName,
        resultUrl: result.resultUrl,
        mockupResultUrl: null,
        labelWidthMm,
        labelHeightMm,
        aspectRatio,
        imageQuality,
        labelText,
        productDescription,
        ingredients,
        usageInstructions,
        companyAddress,
        website,
        email,
        hotline,
        storageInstructions,
        warningAllergy,
        warningOther,
        volume,
        registrationCode,
        countryOfOrigin,
        packagingProdDate,
        packagingExpiryDate,
        hasBarcode,
        hasQrCode,
        selectedLabelIcons,
        style,
        backgroundType,
        borderStyle,
        hasBorder,
      })
      currentProjectIdRef.current = projId
      refreshProjects()
      window.dispatchEvent(new Event('credits-updated'))
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Nhãn sản phẩm đã được tạo.', 'Product label has been created.', '产品标签已创建。', '商品ラベルを作成しました。', '제품 라벨이 생성되었습니다.'), duration: 3000 })
    }
  }

  const handleReset = () => {
    currentProjectIdRef.current = ''
    setStep('UPLOAD')
    setLabelName('')
    setLabelText('')
    setBrandName('')
    setProductName('')
    setProductDescription('')
    setIngredients('')
    setUsageInstructions('')
    setCompanyAddress('')
    setWebsite('')
    setEmail('')
    setHotline('')
    setStorageInstructions('')
    setWarningAllergy('')
    setWarningOther('')
    setVolume('')
    setRegistrationCode('')
    setCountryOfOrigin('')
    setPackagingProdDate('')
    setPackagingExpiryDate('')
    setHasBarcode(false)
    setHasQrCode(false)
    setSelectedLabelIcons([])
    setLogo({ file: null, preview: null })
    setReferenceImage({ file: null, preview: null })
    setImages([])
    setLabelWidthMm('100')
    setLabelHeightMm('100')
    setResultUrl(null)
    setMockupProductImage(null)
    setMockupResultUrl(null)
  }

  const [draftExists, setDraftExists] = useState(false)
  useEffect(() => {
    setDraftExists(!!localStorage.getItem(DRAFT_KEY))
  }, [])

  const loadProject = (p: ProjectItem) => {
    currentProjectIdRef.current = p.id
    setLabelName(p.labelName || '')
    setLabelText(p.labelText || '')
    setBrandName(p.brandName || '')
    setProductName(p.productName || '')
    setProductDescription(p.productDescription || '')
    setIngredients(p.ingredients || '')
    setUsageInstructions(p.usageInstructions || '')
    setCompanyAddress(p.companyAddress || '')
    setWebsite(p.website || '')
    setEmail(p.email || '')
    setHotline(p.hotline || '')
    setStorageInstructions(p.storageInstructions || '')
    setWarningAllergy(p.warningAllergy || '')
    setWarningOther(p.warningOther || '')
    setVolume(p.volume || '')
    setRegistrationCode(p.registrationCode || '')
    setCountryOfOrigin(p.countryOfOrigin || '')
    setPackagingProdDate(p.packagingProdDate || '')
    setPackagingExpiryDate(p.packagingExpiryDate || '')
    setHasBarcode(p.hasBarcode || false)
    setHasQrCode(p.hasQrCode || false)
    setSelectedLabelIcons(p.selectedLabelIcons || [])
    setStyle(p.style || 'modern')
    setBackgroundType(p.backgroundType || 'ai')
    setBorderStyle(p.borderStyle || 'single')
    setHasBorder(p.hasBorder || false)
    setLabelWidthMm(p.labelWidthMm || '100')
    setLabelHeightMm(p.labelHeightMm || '100')
    setImageQuality(p.imageQuality || '2K')
    setResultUrl(p.resultUrl || null)
    setMockupResultUrl(p.mockupResultUrl || null)
    setStep(p.step)
    stepContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    toast({ title: tr('Đã mở dự án', 'Project opened', '已打开项目', 'プロジェクトを開きました', '프로젝트 열림'), duration: 2000 })
  }

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProject(id)
    refreshProjects()
    if (currentProjectIdRef.current === id) {
      handleReset()
    }
    toast({ title: tr('Đã xóa khỏi danh sách', 'Removed from list', '已从列表删除', 'リストから削除しました', '목록에서 삭제됨'), duration: 2000 })
  }

  const handleMockupSubmit = async () => {
    if (!resultUrl || !mockupProductImage) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Cần tải ảnh sản phẩm.', 'Need to upload product image.', '需要上传产品图片。', '商品画像をアップロードしてください。', '제품 이미지를 업로드해 주세요.'), variant: 'destructive' })
      return
    }
    setStep('MOCKUP_GENERATING')
    const formData = new FormData()
    formData.append('labelImageUrl', resultUrl)
    formData.append('productImage', mockupProductImage.file)
    formData.append('imageQuality', imageQuality)
    const result = await createLabelMockupOnProduct(formData)
    if (result.error) {
      setStep('MOCKUP_UPLOAD')
      toast({ title: tr('Tạo mockup thất bại', 'Create mockup failed', '创建模型失败', 'モックアップ作成に失敗しました', '목업 생성 실패'), description: result.error, variant: 'destructive', duration: 5000 })
    } else if (result.success && result.resultUrl) {
      await preloadImageUrl(result.resultUrl)
      setMockupResultUrl(result.resultUrl)
      setStep('MOCKUP_RESULT')
      if (currentProjectIdRef.current) {
        updateProject(currentProjectIdRef.current, { step: 'MOCKUP_RESULT', mockupResultUrl: result.resultUrl })
      } else {
        saveProject({
          step: 'MOCKUP_RESULT',
          labelName,
          productName,
          brandName,
          resultUrl,
          mockupResultUrl: result.resultUrl,
          labelWidthMm,
          labelHeightMm,
          aspectRatio,
          imageQuality,
          labelText,
          productDescription,
          ingredients,
          usageInstructions,
          companyAddress,
          website,
          email,
          hotline,
          storageInstructions,
          warningAllergy,
          warningOther,
          volume,
          registrationCode,
          countryOfOrigin,
          packagingProdDate,
          packagingExpiryDate,
          hasBarcode,
          hasQrCode,
          selectedLabelIcons,
          style,
          backgroundType,
          borderStyle,
          hasBorder,
        })
      }
      refreshProjects()
      window.dispatchEvent(new Event('credits-updated'))
      toast({ title: tr('Thành công!', 'Success!', '成功！', '成功', '성공!'), description: tr('Mockup nhãn trên sản phẩm đã được tạo.', 'Label mockup on product has been created.', '产品标签模型已创建。', '商品ラベルのモックアップを作成しました。', '제품 라벨 목업이 생성되었습니다.'), duration: 3000 })
    }
  }

  const saveDraft = () => {
    if (typeof window === 'undefined') return
    try {
      const draft = {
        labelName,
        labelText,
        brandName,
        productName,
        productDescription,
        ingredients,
        usageInstructions,
        companyAddress,
        website,
        email,
        hotline,
        storageInstructions,
        warningAllergy,
        warningOther,
        volume,
        registrationCode,
        countryOfOrigin,
        packagingProdDate,
        packagingExpiryDate,
        hasBarcode,
        hasQrCode,
        selectedLabelIcons,
        style,
        backgroundType,
        borderStyle,
        hasBorder,
        labelWidthMm,
        labelHeightMm,
        imageQuality,
        resultUrl,
        mockupResultUrl,
        updatedAt: Date.now(),
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      saveProject({
        step: resultUrl ? (mockupResultUrl ? 'MOCKUP_RESULT' : 'RESULT') : 'UPLOAD',
        labelName,
        productName,
        brandName,
        resultUrl,
        mockupResultUrl,
        labelWidthMm,
        labelHeightMm,
        aspectRatio,
        imageQuality,
        labelText,
        productDescription,
        ingredients,
        usageInstructions,
        companyAddress,
        website,
        email,
        hotline,
        storageInstructions,
        warningAllergy,
        warningOther,
        volume,
        registrationCode,
        countryOfOrigin,
        packagingProdDate,
        packagingExpiryDate,
        hasBarcode,
        hasQrCode,
        selectedLabelIcons,
        style,
        backgroundType,
        borderStyle,
        hasBorder,
      })
      refreshProjects()
      setDraftExists(true)
      toast({ title: tr('Đã lưu nháp', 'Draft saved', '草稿已保存', '下書きを保存しました', '초안 저장됨'), duration: 2000 })
    } catch {
      toast({ title: tr('Lỗi lưu nháp', 'Failed to save draft', '保存草稿失败', '下書きの保存に失敗しました', '초안 저장 실패'), variant: 'destructive' })
    }
  }

  const loadDraft = () => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      setLabelName(draft.labelName || '')
      setLabelText(draft.labelText || '')
      setBrandName(draft.brandName || '')
      setProductName(draft.productName || '')
      setProductDescription(draft.productDescription || '')
      setIngredients(draft.ingredients || '')
      setUsageInstructions(draft.usageInstructions || '')
      setCompanyAddress(draft.companyAddress || '')
      setWebsite(draft.website || '')
      setEmail(draft.email || '')
      setHotline(draft.hotline || '')
      setStorageInstructions(draft.storageInstructions || '')
      setWarningAllergy(draft.warningAllergy || '')
      setWarningOther(draft.warningOther || '')
      setVolume(draft.volume || '')
      setRegistrationCode(draft.registrationCode || '')
      setCountryOfOrigin(draft.countryOfOrigin || '')
      setPackagingProdDate(draft.packagingProdDate || '')
      setPackagingExpiryDate(draft.packagingExpiryDate || '')
      setHasBarcode(draft.hasBarcode || false)
      setHasQrCode(draft.hasQrCode || false)
      setSelectedLabelIcons(Array.isArray(draft.selectedLabelIcons) ? draft.selectedLabelIcons : [])
      setStyle(draft.style || 'modern')
      setBackgroundType(draft.backgroundType || 'ai')
      setBorderStyle(draft.borderStyle || 'single')
      setHasBorder(draft.hasBorder || false)
      setLabelWidthMm(draft.labelWidthMm || '100')
      setLabelHeightMm(draft.labelHeightMm || '100')
      setImageQuality(draft.imageQuality || '2K')
      setResultUrl(draft.resultUrl || null)
      setMockupResultUrl(draft.mockupResultUrl || null)
      setStep(draft.resultUrl ? 'RESULT' : 'UPLOAD')
      toast({ title: tr('Đã tải nháp', 'Draft loaded', '已加载草稿', '下書きを読み込みました', '초안 로드됨'), duration: 2000 })
    } catch {
      toast({ title: tr('Không có nháp', 'No draft', '没有草稿', '下書きがありません', '초안 없음'), variant: 'destructive' })
    }
  }

  const handleImportExcel = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast({ title: tr('Lỗi', 'Error', '错误', 'エラー', '오류'), description: tr('Chọn file Excel (.xlsx, .xls, .csv)', 'Select Excel file (.xlsx, .xls, .csv)', '选择 Excel 文件', 'Excelファイルを選択', 'Excel 파일 선택'), variant: 'destructive' })
      if (excelImportRef.current) excelImportRef.current.value = ''
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
        const setBool = (k: string, fn: (v: boolean) => void) => { if (map[k] != null) fn(['1', 'true', 'yes', 'có'].includes(String(map[k]).toLowerCase())) }
        set('labelName', setLabelName)
        set('brandName', setBrandName)
        set('labelText', setLabelText)
        set('productName', setProductName)
        set('productDescription', setProductDescription)
        set('ingredients', setIngredients)
        set('usageInstructions', setUsageInstructions)
        set('companyAddress', setCompanyAddress)
        set('website', setWebsite)
        set('email', setEmail)
        set('hotline', setHotline)
        set('storageInstructions', setStorageInstructions)
        set('warningAllergy', setWarningAllergy)
        set('warningOther', setWarningOther)
        set('volume', setVolume)
        set('registrationCode', setRegistrationCode)
        set('countryOfOrigin', setCountryOfOrigin)
        set('packagingProdDate', setPackagingProdDate)
        set('packagingExpiryDate', setPackagingExpiryDate)
        setBool('hasBarcode', setHasBarcode)
        setBool('hasQrCode', setHasQrCode)
        if (map['labelIcons']) {
          const val = String(map['labelIcons']).trim()
          if (val) {
            const ids = val.split(/[,;|]/).map((s) => s.trim().toLowerCase()).filter(Boolean)
            const validIds = new Set<string>(LABEL_ICONS.map((i) => i.id))
            setSelectedLabelIcons(ids.filter((id) => validIds.has(id)))
          }
        }
        toast({ title: tr('Đã import Excel', 'Excel imported', '已导入 Excel', 'Excelをインポートしました', 'Excel 가져옴'), duration: 2000 })
      } catch (err) {
        toast({ title: tr('Lỗi đọc Excel', 'Excel read error', '读取 Excel 失败', 'Excel読み込みエラー', 'Excel 읽기 오류'), description: String(err), variant: 'destructive' })
      }
      if (excelImportRef.current) excelImportRef.current.value = ''
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <Toaster />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-foreground">{tr('Tạo nhãn giới thiệu sản phẩm', 'Create product intro label', '创建产品介绍标签', '商品紹介ラベルを作成', '제품 소개 라벨 만들기')}</h1>
            <p className="text-muted-foreground mt-1">{tr('Tải 1–6 ảnh sản phẩm, nhập nội dung ghi trên nhãn. AI tạo nhãn chuyên nghiệp cho đóng gói. 1,5 credit (2K) / 3 credit (4K) mỗi lượt.', 'Upload 1–6 product images, enter label text. AI creates professional packaging labels. 1.5 credits (2K) / 3 credits (4K) per creation.', '上传 1–6 张产品图片，输入标签内容。AI 创建专业包装标签。每次 1.5 积分 (2K) / 3 积分 (4K)。', '1〜6枚の商品画像をアップロードし、ラベル内容を入力。AIがプロの包装ラベルを作成。1回 1.5 クレジット (2K) / 3 クレジット (4K)。', '1–6장의 제품 이미지를 업로드하고 라벨 내용을 입력하세요. AI가 전문 포장 라벨을 생성합니다. 1회 1.5 크레딧 (2K) / 3 크레딧 (4K).')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 shrink-0 self-center">
            <Plus className="h-4 w-4" />
            {tr('Tạo mới', 'Create new', '新建', '新規作成', '새로 만들기')}
          </Button>
        </div>

        {(step === 'UPLOAD' && draftExists) || projects.length > 0 ? (
          <div className="space-y-4">
            {step === 'UPLOAD' && draftExists && (
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
                    {tr('Đã làm & đang làm (30 ngày)', 'Done & in progress (30 days)', '已完成和进行中（30天）', '作成済み・進行中（30日間）', '완료·진행중 (30일)')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tr('Bấm để mở lại hoặc xem. Tự xóa sau 30 ngày không mở.', 'Click to reopen or view. Auto-removed after 30 days.', '点击重新打开或查看。30天后自动删除。', 'クリックで開く。30日後に自動削除。', '클릭하여 다시 열기. 30일 후 자동 삭제.')}
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
                          ) : (
                            <Box className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{p.productName || p.labelName || p.brandName || tr('Không tên', 'Untitled', '无标题', '無題', '제목 없음')}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.resultUrl
                              ? p.mockupResultUrl
                                ? tr('Nhãn + Mockup', 'Label + Mockup', '标签+模型', 'ラベル+モックアップ', '라벨+목업')
                                : tr('Nhãn', 'Label', '标签', 'ラベル', '라벨')
                              : tr('Đang làm', 'In progress', '进行中', '進行中', '진행중')}
                            {' · '}
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

        <div ref={stepContentRef}>
        {step === 'UPLOAD' && (
          <div className="space-y-6">
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{tr('Tùy chọn', 'Options', '选项', 'オプション', '옵션')}</CardTitle>
                <CardDescription className="text-xs">{tr('Nhập kích thước mm tùy ý, tỷ lệ tự chọn phù hợp.', 'Enter any mm size, ratio auto-selected.', '输入任意 mm 尺寸，自动选择比例。', '任意のmmサイズを入力、比率は自動選択。', '원하는 mm 크기 입력, 비율 자동 선택.')}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-end gap-6">
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Kích thước nhãn (mm)', 'Label size (mm)', '标签尺寸 (mm)', 'ラベルサイズ (mm)', '라벨 크기 (mm)')} <span className="text-red-500">*</span></h4>
                    <p className="text-[10px] text-muted-foreground">{tr('Nhập kích thước tùy ý → tỷ lệ tự chọn phù hợp Gemini.', 'Enter any size → auto-select best Gemini ratio.', '输入任意尺寸→自动选择最佳 Gemini 比例。', '任意のサイズを入力→Gemini最適比率を自動選択。', '원하는 크기 입력→Gemini 최적 비율 자동 선택.')}</p>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        type="number"
                        min={MIN_LABEL_MM}
                        max={MAX_LABEL_MM}
                        placeholder={tr('Rộng', 'Width', '宽', '幅', '너비')}
                        value={labelWidthMm}
                        onChange={(e) => setLabelWidthMm(e.target.value)}
                        className="bg-white text-xs w-20"
                      />
                      <span className="text-muted-foreground text-xs">×</span>
                      <Input
                        type="number"
                        min={MIN_LABEL_MM}
                        max={MAX_LABEL_MM}
                        placeholder={tr('Cao', 'Height', '高', '高さ', '높이')}
                        value={labelHeightMm}
                        onChange={(e) => setLabelHeightMm(e.target.value)}
                        className="bg-white text-xs w-20"
                      />
                      <span className="text-muted-foreground text-xs">mm</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const w = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelWidthMm) || 100))
                          const h = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelHeightMm) || 100))
                          setLabelWidthMm(String(Math.max(w, h)))
                          setLabelHeightMm(String(Math.min(w, h)))
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          Number(labelWidthMm || 0) >= Number(labelHeightMm || 0)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Quay ngang', 'Landscape', '横向', '横', '가로')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const w = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelWidthMm) || 100))
                          const h = Math.max(MIN_LABEL_MM, Math.min(MAX_LABEL_MM, Number(labelHeightMm) || 100))
                          setLabelWidthMm(String(Math.min(w, h)))
                          setLabelHeightMm(String(Math.max(w, h)))
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                          Number(labelWidthMm || 0) < Number(labelHeightMm || 0)
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        {tr('Quay dọc', 'Portrait', '纵向', '縦', '세로')}
                      </button>
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium">
                      {tr('Tỷ lệ:', 'Ratio:', '比例:', '比率:', '비율:')} {aspectRatio}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={saveDraft} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <Save className="h-3.5 w-3.5 mr-1" /> {tr('Lưu nháp', 'Save draft', '保存草稿', '下書き保存', '초안 저장')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={loadDraft} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <FolderOpen className="h-3.5 w-3.5 mr-1" /> {tr('Tải nháp', 'Load draft', '加载草稿', '下書き読込', '초안 불러오기')}
                    </Button>
                    <a href="/api/tao-nhan-gioi-thieu-san-pham-mau" download="tao-nhan-mau.xlsx">
                      <Button type="button" variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <FileDown className="h-3.5 w-3.5 mr-1" /> {tr('Tải file mẫu', 'Download template', '下载模板', 'テンプレートをダウンロード', '템플릿 다운로드')}
                      </Button>
                    </a>
                    <Button type="button" variant="outline" size="sm" onClick={() => excelImportRef.current?.click()} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> {tr('Import Excel', 'Import Excel', '导入 Excel', 'Excelをインポート', 'Excel 가져오기')}
                    </Button>
                    <input ref={excelImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
                    <DepositCreditButton variant="outline" size="sm" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{tr('Thông tin nhãn', 'Label information', '标签信息', 'ラベル情報', '라벨 정보')}</CardTitle>
                  <CardDescription className="text-xs">{tr('Nhập thông tin và tải ảnh sản phẩm để tạo nhãn đóng gói.', 'Enter info and upload product images for packaging labels.', '输入信息并上传产品图片以创建包装标签。', '情報を入力し、商品画像をアップロードして包装ラベルを作成。', '정보를 입력하고 제품 이미지를 업로드하여 포장 라벨을 만듭니다.')}</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tên nhãn dán (tùy chọn)', 'Label name (optional)', '标签名称（可选）', 'ラベル名（任意）', '라벨 이름 (선택)')}</h4>
                    <Input
                      placeholder={tr('VD: Nước lau sàn Sunlight', 'e.g. Sunlight Floor Cleaner', '例如：Sunlight地板清洁剂', '例: サンライト床用洗剤', '예: 선라이트 바닥 세제')}
                      value={labelName}
                      onChange={(e) => setLabelName(e.target.value)}
                      className="bg-white/80 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Thương hiệu (tùy chọn)', 'Brand (optional)', '品牌（可选）', 'ブランド（任意）', '브랜드 (선택)')}</h4>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Input
                        placeholder={tr('Tên thương hiệu', 'Brand name', '品牌名称', 'ブランド名', '브랜드명')}
                        value={brandName}
                        onChange={(e) => setBrandName(e.target.value)}
                        className="bg-white/80 text-xs flex-1"
                      />
                      <label
                        htmlFor="label-logo-input"
                        className="inline-flex w-24 h-24 rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors shrink-0"
                      >
                        {logo.preview ? (
                          <div className="relative w-full h-full flex items-center justify-center p-2">
                            <ImagePreview src={logo.preview} alt={tr('Logo', 'Logo', 'Logo', 'ロゴ', '로고')} className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setLogo({ file: null, preview: null })
                              }}
                              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500/90 text-white hover:bg-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-emerald-500" />
                            <p className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{tr('Logo', 'Logo', '标志', 'ロゴ', '로고')}</p>
                          </>
                        )}
                      </label>
                      <input
                        id="label-logo-input"
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f?.type.startsWith('image/')) {
                            setLogo({ file: f, preview: URL.createObjectURL(f) })
                          }
                          e.target.value = ''
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Nội dung ghi trên nhãn (tùy chọn)', 'Label text (optional)', '标签内容（可选）', 'ラベル内容（任意）', '라벨 내용 (선택)')}</h4>
                    <Textarea
                      placeholder={tr('Ví dụ: Tên sản phẩm, thành phần, hạn sử dụng, thông tin thương hiệu...', 'e.g. Product name, ingredients, expiry date, brand info...', '例如：产品名称、成分、保质期、品牌信息...', '例: 商品名、成分、賞味期限、ブランド情報...', '예: 제품명, 성분, 유통기한, 브랜드 정보...')}
                      value={labelText}
                      onChange={(e) => setLabelText(e.target.value)}
                      className="bg-white/80 text-xs h-16 min-h-[64px] resize-y"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">{tr('Các mục dưới đây đều tùy chọn.', 'All fields below are optional.', '以下项目均为可选。', '以下の項目はすべて任意です。', '아래 항목은 모두 선택입니다.')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Tên sản phẩm (tùy chọn)', 'Product name (optional)', '产品名称（可选）', '商品名（任意）', '제품명 (선택)')}</label>
                      <Input placeholder={tr('VD: Nước lau sàn', 'e.g. Floor cleaner', '例如：地板清洁剂', '例: 床用洗剤', '예: 바닥 세제')} value={productName} onChange={(e) => setProductName(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Mô tả ngắn (tùy chọn)', 'Short description (optional)', '简短描述（可选）', '簡単な説明（任意）', '간단한 설명 (선택)')}</label>
                      <Input placeholder={tr('Công dụng, đặc điểm', 'Uses, features', '用途、特点', '用途、特徴', '용도, 특징')} value={productDescription} onChange={(e) => setProductDescription(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Thành phần (tùy chọn)', 'Ingredients (optional)', '成分（可选）', '成分（任意）', '성분 (선택)')}</label>
                      <Input placeholder={tr('Nguyên liệu, hàm lượng', 'Ingredients, content', '原料、含量', '原材料、含有量', '원료, 함량')} value={ingredients} onChange={(e) => setIngredients(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Hướng dẫn sử dụng (tùy chọn)', 'Usage instructions (optional)', '使用说明（可选）', '使用方法（任意）', '사용 방법 (선택)')}</label>
                      <Input placeholder={tr('Cách dùng, liều lượng', 'How to use, dosage', '用法、用量', '使い方、用量', '사용법, 용량')} value={usageInstructions} onChange={(e) => setUsageInstructions(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Địa chỉ (tùy chọn)', 'Address (optional)', '地址（可选）', '住所（任意）', '주소 (선택)')}</label>
                      <Input placeholder={tr('Địa chỉ công ty', 'Company address', '公司地址', '会社住所', '회사 주소')} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Website (tùy chọn)', 'Website (optional)', '网站（可选）', 'ウェブサイト（任意）', '웹사이트 (선택)')}</label>
                      <Input placeholder="https://..." value={website} onChange={(e) => setWebsite(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Email (tùy chọn)', 'Email (optional)', '邮箱（可选）', 'メール（任意）', '이메일 (선택)')}</label>
                      <Input placeholder="email@..." value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Hotline (tùy chọn)', 'Hotline (optional)', '热线（可选）', 'ホットライン（任意）', '핫라인 (선택)')}</label>
                      <Input placeholder="1900..." value={hotline} onChange={(e) => setHotline(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Bảo quản (tùy chọn)', 'Storage (optional)', '储存（可选）', '保存（任意）', '보관 (선택)')}</label>
                      <Input placeholder={tr('Nơi khô ráo, thoáng mát', 'Cool, dry place', '阴凉干燥处', '涼しい乾燥した場所', '서늘하고 건조한 곳')} value={storageInstructions} onChange={(e) => setStorageInstructions(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Cảnh báo dị ứng (tùy chọn)', 'Allergy warning (optional)', '过敏警告（可选）', 'アレルギー警告（任意）', '알레르기 경고 (선택)')}</label>
                      <Input placeholder={tr('Có thể chứa...', 'May contain...', '可能含有...', '含む可能性...', '포함될 수 있음...')} value={warningAllergy} onChange={(e) => setWarningAllergy(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Cảnh báo khác (tùy chọn)', 'Other warning (optional)', '其他警告（可选）', 'その他の警告（任意）', '기타 경고 (선택)')}</label>
                      <Input placeholder={tr('VD: Để xa tầm tay trẻ em', 'e.g. Keep out of reach of children', '如：远离儿童', '例：子供の手の届かない所に', '예: 어린이 손이 닿지 않는 곳에')} value={warningOther} onChange={(e) => setWarningOther(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Khối lượng (tùy chọn)', 'Weight/Volume (optional)', '重量/体积（可选）', '重量/容量（任意）', '중량/용량 (선택)')}</label>
                      <Input placeholder={tr('VD: 500ml, 1kg', 'e.g. 500ml, 1kg', '如：500ml、1kg', '例: 500ml、1kg', '예: 500ml, 1kg')} value={volume} onChange={(e) => setVolume(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Mã đăng ký (tùy chọn)', 'Reg. code (optional)', '注册码（可选）', '登録番号（任意）', '등록번호 (선택)')}</label>
                      <Input placeholder={tr('Số đăng ký', 'Registration number', '注册号', '登録番号', '등록번호')} value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('Xuất xứ (tùy chọn)', 'Country of origin (optional)', '原产国（可选）', '原産国（任意）', '원산지 (선택)')}</label>
                      <Input placeholder={tr('VD: Việt Nam', 'e.g. Vietnam', '如：越南', '例: ベトナム', '예: 베트남')} value={countryOfOrigin} onChange={(e) => setCountryOfOrigin(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('NSX (tùy chọn)', 'Prod. date (optional)', '生产日期（可选）', '製造日（任意）', '제조일 (선택)')}</label>
                      <Input placeholder={tr('Ngày sản xuất', 'Production date', '生产日期', '製造日', '제조일')} value={packagingProdDate} onChange={(e) => setPackagingProdDate(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{tr('HSD (tùy chọn)', 'Exp. date (optional)', '保质期（可选）', '賞味期限（任意）', '유통기한 (선택)')}</label>
                      <Input placeholder={tr('Hạn sử dụng', 'Expiry date', '保质期', '賞味期限', '유통기한')} value={packagingExpiryDate} onChange={(e) => setPackagingExpiryDate(e.target.value)} className="bg-white/80 text-xs" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2 flex flex-wrap items-end gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={hasBarcode} onChange={(e) => setHasBarcode(e.target.checked)} className="rounded" />
                        {tr('Có mã vạch (tùy chọn)', 'Has barcode (optional)', '有条形码（可选）', 'バーコードあり（任意）', '바코드 있음 (선택)')}
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={hasQrCode} onChange={(e) => setHasQrCode(e.target.checked)} className="rounded" />
                        {tr('Có QR code (tùy chọn)', 'Has QR code (optional)', '有二维码（可选）', 'QRコードあり（任意）', 'QR 코드 있음 (선택)')}
                      </label>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Icon trên nhãn (tùy chọn)', 'Label icons (optional)', '标签图标（可选）', 'ラベルアイコン（任意）', '라벨 아이콘 (선택)')}</h4>
                      <p className="text-[10px] text-muted-foreground">{tr('Chọn icon thường có trên nhãn. AI sẽ vẽ lên nhãn.', 'Select common label icons. AI will draw them on the label.', '选择常见标签图标。AI 会绘制到标签上。', 'よくあるラベルアイコンを選択。AIがラベルに描画。', '자주 쓰는 라벨 아이콘 선택. AI가 라벨에 그립니다.')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {LABEL_ICONS.map((icon) => {
                          const isSelected = selectedLabelIcons.includes(icon.id)
                          return (
                            <button
                              key={icon.id}
                              type="button"
                              onClick={() => {
                                setSelectedLabelIcons((prev) =>
                                  isSelected ? prev.filter((id) => id !== icon.id) : [...prev, icon.id]
                                )
                              }}
                              className={`px-2 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {uiLocale === 'en' ? icon.labelEn : icon.labelVi}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh tham khảo phong cách', 'Style reference image', '风格参考图', 'スタイル参考画像', '스타일 참조 이미지')}</h4>
                    <p className="text-[10px] text-muted-foreground">{tr('AI lấy phong cách (màu sắc, bố cục) từ ảnh này. Không copy nguyên ảnh. Vẫn dùng ảnh sản phẩm và nội dung của bạn.', 'AI uses style (colors, layout) from this image. Do not copy verbatim. Still uses your product images and content.', 'AI从此图获取风格（颜色、布局）。不原样复制。仍使用您的产品图和内容。', 'AIがこの画像からスタイル（色・レイアウト）を参考。そのままコピーしない。商品画像と内容は使用。', 'AI가 이 이미지에서 스타일(색·레이아웃) 참조. 그대로 복사 안 함. 상품 이미지와 내용 사용.')}</p>
                    <div className="flex items-center gap-3">
                      <input ref={referenceImageInputRef} type="file" accept="image/*" onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f?.type.startsWith('image/')) {
                          if (referenceImage.preview) URL.revokeObjectURL(referenceImage.preview)
                          setReferenceImage({ file: f, preview: URL.createObjectURL(f) })
                        }
                        e.target.value = ''
                      }} className="hidden" />
                      <Button variant="outline" size="sm" type="button" onClick={() => referenceImageInputRef.current?.click()} className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                        <Upload className="h-3 w-3 mr-2" />
                        {tr('Chọn ảnh tham khảo', 'Choose reference image', '选择参考图', '参考画像を選択', '참조 이미지 선택')}
                      </Button>
                      {referenceImage.preview && (
                        <div className="relative inline-block">
                          <img src={referenceImage.preview} alt="Reference" className="h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-lg border-2 border-emerald-200 bg-white" />
                          <button
                            type="button"
                            onClick={() => {
                              if (referenceImage.preview) URL.revokeObjectURL(referenceImage.preview)
                              setReferenceImage({ file: null, preview: null })
                            }}
                            className="absolute -top-1 -right-1 p-0.5 rounded-full bg-red-500/90 text-white hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Tùy chọn thiết kế', 'Design options', '设计选项', 'デザインオプション', '디자인 옵션')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {STYLES.map((s) => (
                        <button key={s.value} type="button" onClick={() => setStyle(s.value)} className={`px-2 py-1.5 rounded-md border text-xs font-medium ${style === s.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                          {uiLocale === 'en' ? s.labelEn : s.labelVi}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {BACKGROUND_OPTIONS.map((b) => (
                        <button key={b.value} type="button" onClick={() => setBackgroundType(b.value)} className={`px-2 py-1 rounded-md border text-[10px] font-medium ${backgroundType === b.value ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                          {uiLocale === 'en' ? b.labelEn : b.labelVi}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setHasBorder(!hasBorder)} className={`px-2 py-1.5 rounded-md border text-xs font-medium ${hasBorder ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'}`}>
                        {tr('Có viền', 'With border', '有边框', '枠あり', '테두리 있음')}
                      </button>
                      {hasBorder && (
                        <div className="flex gap-1">
                          {BORDER_STYLES.map((b) => (
                            <button key={b.value} type="button" onClick={() => setBorderStyle(b.value)} className={`px-2 py-1 rounded-md border text-[10px] ${borderStyle === b.value ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'}`}>
                              {uiLocale === 'en' ? b.labelEn : b.labelVi}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tr('Ảnh sản phẩm (1–6 ảnh)', 'Product images (1–6)', '产品图片（1–6 张）', '商品画像（1〜6枚）', '제품 이미지 (1–6장)')}</h4>
                    <p className="text-[10px] text-muted-foreground">{tr('Tùy chọn. Chọn tách nền từng ảnh bên dưới.', 'Optional. Set background removal per image below.', '可选。可为每张选择抠图。', '任意。画像ごとに背景除去を選択。', '선택. 각 이미지별 배경제거 선택.')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {images.map((img, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="relative group aspect-square rounded-lg border overflow-hidden bg-emerald-50/60">
                            <ImagePreview src={img.preview} alt={`${tr('Sản phẩm', 'Product', '产品', '商品', '제품')} ${i + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemove(i)}
                              className="absolute top-1 right-1 p-1 rounded-full bg-red-500/90 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded">
                              {i + 1}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: true } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                img.removeBackground ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Tách nền', 'Remove background', '去背景', '背景除去', '배경 제거')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setImages((prev) => prev.map((im, j) => (j === i ? { ...im, removeBackground: false } : im)))}
                              className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[10px] font-medium transition-colors ${
                                !img.removeBackground ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                              }`}
                            >
                              {!img.removeBackground && <Check className="h-3 w-3 shrink-0" />}
                              {tr('Không tách', 'Keep background', '保留背景', '背景維持', '배경 유지')}
                            </button>
                          </div>
                        </div>
                      ))}
                      {images.length < MAX_PRODUCT_IMAGES && (
                        <label
                          htmlFor="label-input"
                          className="aspect-square rounded-lg border-2 border-dashed border-emerald-200 bg-emerald-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors"
                        >
                          <Plus className="h-10 w-10 text-emerald-500" />
                          <p className="text-xs text-muted-foreground font-medium">{tr('Thêm ảnh', 'Add image', '添加图片', '画像を追加', '이미지 추가')}</p>
                        </label>
                      )}
                    </div>
                    <input
                      id="label-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleAddImages}
                    />
                  </div>
                  <div className="pt-6 mt-6 border-t space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">{tr('Chất lượng:', 'Quality:', '质量:', '品質:', '품질:')}</span>
                      <button
                        type="button"
                        onClick={() => setImageQuality('2K')}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '2K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        2K (1,5 credit)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageQuality('4K')}
                        className={`px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          imageQuality === '4K' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white hover:bg-gray-50 text-muted-foreground'
                        }`}
                      >
                        4K (3 credit)
                      </button>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <Button
                        onClick={() => checkCreditsAndProceed(cost, handleSubmit)}
                        className="w-full sm:w-auto min-w-[200px] h-10 shadow-md hover:shadow-lg transition-all text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo nhãn', 'Create label', '创建标签', 'ラベルを作成', '라벨 만들기')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                      </Button>
                      <p className="text-[10px] text-muted-foreground">{tr('* Thời gian: 15–45 giây', '* Time: 15–45 seconds', '* 时长：15–45 秒', '* 所要時間: 15〜45秒', '* 소요 시간: 15–45초')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
          </div>
        )}

        {step === 'GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-emerald-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="banner"
                title={tr('Đang tạo nhãn', 'Creating label', '正在创建标签', 'ラベル作成中', '라벨 생성 중')}
                description={tr('AI đang thiết kế nhãn sản phẩm', 'AI is designing product label', 'AI 正在设计产品标签', 'AIが商品ラベルをデザイン中', 'AI가 제품 라벨을 디자인 중')}
                imagePreviews={images.map((img) => img.preview)}
              />
            </CardContent>
          </Card>
        )}

        {step === 'RESULT' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Kết quả nhãn', 'Label result', '标签结果', 'ラベル結果', '라벨 결과')}</CardTitle>
              <CardDescription>{tr('Nhãn sản phẩm đã được tạo. Tải ảnh sản phẩm để xem mockup thực tế.', 'Product label created. Upload product image to see mockup.', '产品标签已创建。上传产品图片查看模型。', '商品ラベルを作成しました。商品画像をアップロードしてモックアップを確認。', '제품 라벨이 생성되었습니다. 제품 이미지를 업로드하여 목업을 확인하세요.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-sm font-medium text-muted-foreground">{tr('Kết quả', 'Result', '结果', '結果', '결과')}</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="default" onClick={() => setStep('MOCKUP_UPLOAD')} className="bg-cyan-600 hover:bg-cyan-700">
                    <Box className="mr-2 h-3 w-3" /> {tr('Xem mockup trên sản phẩm', 'Preview on product', '在产品上预览', '商品でプレビュー', '제품에서 미리보기')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleReset}>
                    <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử lại', 'Try again', '重试', '再試行', '다시 시도')}
                  </Button>
                  <DownloadImageButton
                    imageUrl={resultUrl}
                    filename="product-label"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                    printReady
                    printReadyAspectRatio={aspectRatio}
                    printReadyLabel={tr('Tải PDF chuẩn in', 'Download print-ready PDF', '下载印刷用PDF', '印刷用PDFをダウンロード', '인쇄용 PDF 다운로드')}
                    printReadySuccessToast={tr('Đã tạo PDF chuẩn in. Bleed 3mm, crop marks.', 'Print-ready PDF created. Bleed 3mm, crop marks.', '已生成印刷用PDF。出血3mm，裁切线。', '印刷用PDFを作成しました。塗り足し3mm、トンボ付き。', '인쇄용 PDF 생성됨. 블리드 3mm, 크롭 마크.')}
                  />
                </div>
              </div>
              <div
                className="max-w-2xl mx-auto rounded-lg border overflow-hidden"
                style={{ aspectRatio: aspectRatio.replace(':', '/') }}
              >
                <ImagePreview src={resultUrl} alt={tr('Nhãn sản phẩm', 'Product label', '产品标签', '商品ラベル', '제품 라벨')} className="w-full h-full object-contain" printReadyAspectRatio={aspectRatio} />
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'MOCKUP_UPLOAD' && resultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
            <CardHeader>
              <CardTitle>{tr('Xem mockup nhãn trên sản phẩm', 'Preview label on product', '在产品上预览标签', '商品でラベルをプレビュー', '제품에서 라벨 미리보기')}</CardTitle>
              <CardDescription>{tr('Tải ảnh sản phẩm (chai, cốc, hộp...) để xem nhãn vừa thiết kế in lên thực tế. 1,5–3 credits.', 'Upload product image (bottle, cup, box...) to see the designed label on it. 1.5–3 credits.', '上传产品图片（瓶、杯、盒...）查看设计标签效果。1.5–3 积分。', '商品画像（ボトル、カップ、箱...）をアップロードしてラベルを確認。1.5〜3クレジット。', '제품 이미지(병, 컵, 상자...)를 업로드하여 라벨 효과를 확인하세요. 1.5–3 크레딧.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">{tr('Nhãn đã thiết kế', 'Designed label', '已设计标签', 'デザイン済みラベル', '디자인된 라벨')}</h4>
                  <div className="rounded-lg border overflow-hidden" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                    <ImagePreview src={resultUrl} alt="Label" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">{tr('Ảnh sản phẩm', 'Product image', '产品图片', '商品画像', '제품 이미지')}</h4>
                  <label
                    htmlFor="mockup-product-input"
                    className="block w-full aspect-[4/3] rounded-lg border-2 border-dashed border-cyan-200 bg-cyan-50/60 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-cyan-300"
                  >
                    {mockupProductImage?.preview ? (
                      <ImagePreview src={mockupProductImage.preview} alt="Product" className="w-full h-full object-contain rounded-lg" />
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-cyan-500" />
                        <p className="text-sm text-muted-foreground">{tr('Chọn ảnh sản phẩm', 'Select product image', '选择产品图片', '商品画像を選択', '제품 이미지 선택')}</p>
                      </>
                    )}
                  </label>
                  <input
                    id="mockup-product-input"
                    ref={mockupProductInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f?.type.startsWith('image/')) setMockupProductImage({ file: f, preview: URL.createObjectURL(f) })
                      e.target.value = ''
                    }}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('RESULT')}>{tr('Quay lại', 'Back', '返回', '戻る', '뒤로')}</Button>
                <Button onClick={() => checkCreditsAndProceed(cost, handleMockupSubmit)} disabled={!mockupProductImage} className="bg-cyan-600 hover:bg-cyan-700">
                  <Sparkles className="mr-2 h-4 w-4" /> {tr('Tạo mockup', 'Create mockup', '创建模型', 'モックアップ作成', '목업 만들기')} ({imageQuality === '2K' ? '1,5' : '3'} credit)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'MOCKUP_GENERATING' && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur border-cyan-200/60">
            <CardContent className="flex flex-col items-center py-8">
              <ImageProcessingLoader
                mode="mockup3d"
                title={tr('Đang tạo mockup', 'Creating mockup', '正在创建模型', 'モックアップ作成中', '목업 생성 중')}
                description={tr('AI đang in nhãn lên sản phẩm', 'AI is applying label onto product', 'AI 正在将标签印到产品上', 'AIが商品にラベルを印刷中', 'AI가 제품에 라벨을 인쇄 중')}
                imagePreview={mockupProductImage?.preview}
              />
            </CardContent>
          </Card>
        )}

        {step === 'MOCKUP_RESULT' && mockupResultUrl && (
          <Card className="border shadow-sm bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>{tr('Mockup nhãn trên sản phẩm', 'Label mockup on product', '产品标签模型', '商品ラベルモックアップ', '제품 라벨 목업')}</CardTitle>
              <CardDescription>{tr('Nhãn đã được in lên sản phẩm.', 'Label has been applied to product.', '标签已印到产品上。', 'ラベルを商品に印刷しました。', '라벨이 제품에 인쇄되었습니다.')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setMockupResultUrl(null); setStep('MOCKUP_UPLOAD') }}>
                  <RefreshCw className="mr-2 h-3 w-3" /> {tr('Thử sản phẩm khác', 'Try different product', '尝试其他产品', '別の商品で試す', '다른 제품으로 시도')}
                </Button>
                <Button variant="outline" onClick={() => setStep('RESULT')}>{tr('Quay lại nhãn', 'Back to label', '返回标签', 'ラベルに戻る', '라벨로 돌아가기')}</Button>
                <DownloadImageButton imageUrl={mockupResultUrl} filename="label-mockup" size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white border-0" printReady printReadyInferFromImage />
              </div>
              <div className="rounded-lg border overflow-hidden">
                <ImagePreview src={mockupResultUrl} alt={tr('Mockup', 'Mockup', '模型', 'モックアップ', '목업')} className="w-full max-h-[70vh] object-contain" />
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">{tr('Ảnh do AI tạo có thể có sai sót.', 'AI-generated image may contain inaccuracies.', 'AI 生成的图片可能存在误差。', 'AI生成画像には誤りが含まれる場合があります。', 'AI 생성 이미지는 오류가 있을 수 있습니다.')}</p>
    </>
  )
}
