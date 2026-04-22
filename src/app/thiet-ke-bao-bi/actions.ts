'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { createPrintReadyPdf } from '@/lib/print-ready-pdf'
import { createBoxDielinePdf } from './lib/box-dieline-pdf'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { getAspectRatioFromDimensions } from '@/lib/aspect-ratio-from-dimensions'
import { GEMINI_ASPECT_RATIOS } from '@/lib/label-size-presets'
import { BAG_TYPE_OPTIONS, type BagType } from './bag-types'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'


const PACKAGING_COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = GEMINI_ASPECT_RATIOS
type PackagingAspectRatio = (typeof VALID_ASPECT_RATIOS)[number]
function isPackagingAspectRatio(s: string): s is PackagingAspectRatio {
  return (VALID_ASPECT_RATIOS as readonly string[]).includes(s)
}
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const DESIGN_TYPE_PROMPTS: Record<string, string> = {
  box: 'Product packaging box mockup. 3D carton/paper box for shipping goods. Photorealistic render. Premium aesthetic, professional lighting. The box is for packaging products, not a product itself.',
  bag: 'Flat bag / pouch packaging mockup. Stand-up pouch or flat bag for packaging products. Photorealistic. Premium aesthetic. The bag is for shipping/containing goods.',
}

const STYLE_PROMPTS: Record<string, string> = {
  modern: 'Modern minimalist design, clean lines, contemporary.',
  luxury: 'Luxury premium design, elegant, high-end.',
  natural: 'Natural organic style, eco-friendly, sustainable.',
  vibrant: 'Vibrant colorful, eye-catching, bold.',
}

/**
 * Tạo PDF Dieline chuẩn in: Layer Cut (đỏ) và Crease (xanh) tách biệt, bleed 3mm, 3 ảnh mặt ghép vào net.
 */
export async function generateBoxDielinePdf(params: {
  face1Url: string
  face2Url: string
  face3Url: string
  boxLength: number
  boxWidth: number
  boxHeight: number
}): Promise<{ pdfUrl: string } | { error: string }> {
  const { face1Url, face2Url, face3Url, boxLength, boxWidth, boxHeight } = params
  if (!face1Url || !face2Url || !face3Url) return { error: 'Thiếu đủ 3 ảnh bề mặt.' }
  if (boxLength < 10 || boxLength > 800 || boxWidth < 10 || boxWidth > 800 || boxHeight < 10 || boxHeight > 800) {
    return { error: 'Kích thước hộp phải từ 10–800 mm.' }
  }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const fetchBuffer = async (url: string): Promise<Buffer> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Fetch failed')
    const buf = await res.arrayBuffer()
    return Buffer.from(buf)
  }

  try {
    const [face1Buffer, face2Buffer, face3Buffer] = await Promise.all([
      fetchBuffer(face1Url),
      fetchBuffer(face2Url),
      fetchBuffer(face3Url),
    ])

    const pdfBuffer = await createBoxDielinePdf({
      face1Buffer,
      face2Buffer,
      face3Buffer,
      boxLength,
      boxWidth,
      boxHeight,
    })

    const pdfPath = `results/${user.id}/box_dieline_${Date.now()}.pdf`
    const { publicUrl: pdfPublicUrl } = await uploadTryOnImagePublic(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    return { pdfUrl: pdfPublicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Xuất Dieline thất bại: ${msg}` }
  }
}

/**
 * Tạo PDF chuẩn in từ ảnh base64 (cho net hộp client-generated).
 */
export async function generateBoxNetPdf(
  imageBase64: string,
  widthMm: number,
  heightMm: number
): Promise<{ pdfUrl: string } | { error: string }> {
  if (!imageBase64?.trim()) return { error: 'Thiếu dữ liệu ảnh.' }
  if (widthMm < 10 || widthMm > 800 || heightMm < 10 || heightMm > 800) {
    return { error: 'Kích thước phải từ 10–800 mm.' }
  }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const pdfBuffer = await createPrintReadyPdf(imageBuffer, { widthMm, heightMm })

    const pdfPath = `results/${user.id}/box_net_${Date.now()}.pdf`
    const { publicUrl: netPdfPublicUrl } = await uploadTryOnImagePublic(pdfPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

    return { pdfUrl: netPdfPublicUrl }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Xuất PDF thất bại: ${msg}` }
  }
}

export type PackagingDesignType = 'box' | 'bag'

export async function createPackagingDesignWithAI(formData: FormData): Promise<
  | { success: true; resultUrl: string }
  | { error: string }
> {
  const designType = (formData.get('designType') as PackagingDesignType) || 'box'
  const brandName = (formData.get('brandName') as string)?.trim() || ''
  const productName = (formData.get('productName') as string)?.trim() || ''
  const companyAddress = (formData.get('companyAddress') as string)?.trim() || ''
  const website = (formData.get('website') as string)?.trim() || ''
  const email = (formData.get('email') as string)?.trim() || ''
  const hotline = (formData.get('hotline') as string)?.trim() || ''
  const countryOfOrigin = (formData.get('countryOfOrigin') as string)?.trim() || ''
  const storageInstructions = (formData.get('storageInstructions') as string)?.trim() || ''
  const warningAllergy = (formData.get('warningAllergy') as string)?.trim() || ''
  const volume = (formData.get('volume') as string)?.trim() || ''
  const registrationCode = (formData.get('registrationCode') as string)?.trim() || ''
  const socialLinks = (formData.get('socialLinks') as string)?.trim() || ''
  const contentBlocksRaw = (formData.get('contentBlocks') as string) || '[]'
  let contentBlocks: { label: string; content: string }[] = []
  try {
    contentBlocks = JSON.parse(contentBlocksRaw)
    if (!Array.isArray(contentBlocks)) contentBlocks = []
  } catch {
    contentBlocks = []
  }
  const style = (formData.get('style') as string) || 'modern'
  const aspectRatio = (formData.get('aspectRatio') as string) || '1:1'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const logoFile = formData.get('logo') as File | null
  const productImageFiles = (formData.getAll('productImage') as File[]).filter((f) => f?.size && f.size > 0).slice(0, 6)
  const hasProductImage = productImageFiles.length > 0
  const boxLength = Math.max(20, Math.min(500, Number(formData.get('boxLength')) || 200))
  const boxWidth = Math.max(20, Math.min(500, Number(formData.get('boxWidth')) || 150))
  const boxHeight = Math.max(20, Math.min(500, Number(formData.get('boxHeight')) || 100))
  const bagWidth = Math.max(20, Math.min(500, Number(formData.get('bagWidth')) || 200))
  const bagHeight = Math.max(20, Math.min(500, Number(formData.get('bagHeight')) || 280))
  const bagGusset = Math.max(10, Math.min(200, Number(formData.get('bagGusset')) || 60))
  const hasBorder = (formData.get('hasBorder') as string) === '1'
  const borderStyle = (formData.get('borderStyle') as string) || 'single'
  const backgroundType = (formData.get('backgroundType') as string) || 'transparent'
  const patternStyle = (formData.get('patternStyle') as string) || 'waves'

  if (!brandName && !productName && !hasProductImage) {
    return { error: 'Vui lòng nhập tên thương hiệu, tên sản phẩm hoặc tải ảnh sản phẩm.' }
  }
  if (!isPackagingAspectRatio(aspectRatio)) {
    return { error: 'Tỷ lệ khung hình không hợp lệ.' }
  }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: '',
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  let designPrompt = DESIGN_TYPE_PROMPTS[designType] || DESIGN_TYPE_PROMPTS.box
  if (designType === 'box') {
    designPrompt += ` Box dimensions: ${boxLength}mm (length) × ${boxWidth}mm (width) × ${boxHeight}mm (height). The mockup should reflect these proportions.`
  } else if (designType === 'bag') {
    designPrompt += ` Bag dimensions: ${bagWidth}mm (width) × ${bagHeight}mm (height). Gusset depth: ${bagGusset}mm. The mockup should reflect these proportions.`
  }
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
  const uiLocale = ((formData.get('uiLocale') as string) || 'vi') as 'vi' | 'en' | 'zh' | 'ja' | 'ko'
  const isVi = uiLocale === 'vi'
  const L = {
    brand: isVi ? 'Thương hiệu' : 'Brand',
    product: isVi ? 'Sản phẩm' : 'Product',
    companyAddress: isVi ? 'Địa chỉ công ty / Liên hệ' : 'Company address / Contact',
    website: isVi ? 'Website' : 'Website',
    email: isVi ? 'Email' : 'Email',
    hotline: isVi ? 'Hotline / SĐT' : 'Hotline / Phone',
    countryOfOrigin: isVi ? 'Nguồn gốc xuất xứ' : 'Country of origin',
    storageInstructions: isVi ? 'Hướng dẫn bảo quản' : 'Storage instructions',
    warningAllergy: isVi ? 'Cảnh báo / Allergy' : 'Warning / Allergy',
    volume: isVi ? 'Thể tích' : 'Volume',
    registrationCode: isVi ? 'Mã đăng ký' : 'Registration code',
    socialLinks: isVi ? 'Mạng xã hội' : 'Social media',
  }

  const textParts: string[] = []
  if (brandName.trim()) textParts.push(`${L.brand}: ${brandName.trim()}`)
  if (productName.trim()) textParts.push(`${L.product}: ${productName.trim()}`)
  if (companyAddress.trim()) textParts.push(`${L.companyAddress}: ${companyAddress.trim()}`)
  if (website.trim()) textParts.push(`${L.website}: ${website.trim()}`)
  if (email.trim()) textParts.push(`${L.email}: ${email.trim()}`)
  if (hotline.trim()) textParts.push(`${L.hotline}: ${hotline.trim()}`)
  if (countryOfOrigin.trim()) textParts.push(`${L.countryOfOrigin}: ${countryOfOrigin.trim()}`)
  if (storageInstructions.trim()) textParts.push(`${L.storageInstructions}: ${storageInstructions.trim()}`)
  if (warningAllergy.trim()) textParts.push(`${L.warningAllergy}: ${warningAllergy.trim()}`)
  if (volume.trim()) textParts.push(`${L.volume}: ${volume.trim()}`)
  if (registrationCode.trim()) textParts.push(`${L.registrationCode}: ${registrationCode.trim()}`)
  if (socialLinks.trim()) textParts.push(`${L.socialLinks}: ${socialLinks.trim()}`)
  for (const b of contentBlocks.filter((x) => x.label?.trim() || x.content?.trim())) {
    const label = b.label?.trim() || (isVi ? 'Nội dung' : 'Content')
    const content = b.content?.trim() || ''
    if (content) textParts.push(`Block "${label}": ${content}`)
  }
  const blocksInstruction = textParts.some((p) => p.startsWith('Block "')) ? 'Place each block in a separate, non-adjacent area. Display content exactly as provided.' : ''
  const leftAlignRule = 'All text on the packaging MUST be left-aligned. Tất cả chữ căn lề trái.'
  const textInstruction = textParts.length ? `Include these content blocks on the packaging: ${textParts.join('. ')}. ${blocksInstruction}. ${leftAlignRule}` : leftAlignRule

  let bagDesignHints = ''
  if (designType === 'bag') {
    const BORDER_HINTS: Record<string, string> = {
      single: 'Include a clean single-line border/frame around the design edge.',
      double: 'Include a double-line border/frame around the design edge.',
      dotted: 'Include a dotted border/frame around the design edge.',
      dashed: 'Include a dashed border/frame around the design edge.',
      rounded: 'Include a border with rounded corners framing the design.',
      decorative: 'Include an ornamental/decorative border/frame around the design.',
    }
    const PATTERN_HINTS: Record<string, string> = {
      waves: 'Patterned background with wave/flowing patterns. Subtle, elegant waves or curves.',
      geometric: 'Patterned background with geometric shapes (lines, triangles, hexagons).',
      traditional: 'Patterned background with traditional/ornamental motifs (Asian, floral, gold accents).',
      dots: 'Patterned background with dot/circle pattern. Polka-dot style.',
      floral: 'Patterned background with floral/botanical motifs.',
      stripes: 'Patterned background with stripes (horizontal, vertical, or diagonal).',
    }
    const BACKGROUND_HINTS: Record<string, string> = {
      transparent: 'Background: solid CARTON/KRAFT color. Use natural cardboard color: brown, beige, kraft paper tone. Areas without design MUST be filled with this solid carton color. Output PNG with SOLID background – NOT transparent.',
      ai: 'Use a solid background color that complements the design, brand and style. Choose the color yourself.',
      patterned: `Patterned background. ${PATTERN_HINTS[patternStyle] || PATTERN_HINTS.waves} Background should have a decorative pattern, not solid color.`,
      white: 'Solid white background (#FFFFFF).',
      offwhite: 'Solid off-white/ivory background. Slightly warm white.',
      cream: 'Solid cream background. Warm, soft tone.',
      beige: 'Solid beige/tan background. Warm neutral.',
      sand: 'Solid sand/tan background. Warm earthy tone.',
      lightgray: 'Solid light gray background. Cool, soft neutral.',
      lightblue: 'Solid light blue background. Soft, cool tone.',
      mint: 'Solid mint/teal background. Fresh, cool green-blue.',
      lightpink: 'Solid light pink/pastel pink background. Soft, gentle.',
      lavender: 'Solid lavender background. Soft purple.',
      lightyellow: 'Solid light yellow/pastel yellow background. Soft, warm.',
      lightgreen: 'Solid light green/pastel green background. Fresh, soft.',
      peach: 'Solid peach background. Warm, soft orange-pink.',
      charcoal: 'Solid charcoal/dark gray background. Sophisticated.',
      navy: 'Solid navy blue background. Deep, professional.',
      black: 'Solid black background (#000000).',
    }
    const borderHint = hasBorder && BORDER_HINTS[borderStyle] ? BORDER_HINTS[borderStyle] : 'No border. Design extends edge-to-edge, clean edges.'
    const backgroundHint = BACKGROUND_HINTS[backgroundType] || BACKGROUND_HINTS.transparent
    bagDesignHints = ` CRITICAL - Bag design surface (${bagWidth}mm × ${bagHeight}mm main face): ${backgroundHint} ${borderHint}`
  }

  let prompt = `Generate a single high-quality product packaging mockup image. ${designPrompt} ${stylePrompt}${bagDesignHints} ${textInstruction} Output only the image, no text overlay or watermark. Professional commercial quality.`

  const contentParts: object[] = []
  const hasLogo = logoFile?.size && logoFile.size > 0

  if (hasProductImage && productImageFiles.length > 0) {
    for (const f of productImageFiles) {
      contentParts.push({
        inlineData: { data: Buffer.from(await f.arrayBuffer()).toString('base64'), mimeType: f.type || 'image/png' },
      })
    }
    const imgCount = productImageFiles.length
    prompt += ` The ${imgCount} image(s) provided are product images to be printed on the packaging surface. Print/display these product images prominently on the box/bag surface as if it were real packaging. Integrate them naturally into the design.`
  }
  contentParts.unshift({ text: prompt })

  if (hasLogo && logoFile) {
    contentParts.push({
      inlineData: { data: Buffer.from(await logoFile.arrayBuffer()).toString('base64'), mimeType: logoFile.type || 'image/png' },
    })
    contentParts.push({ text: 'Integrate the provided logo naturally into the packaging design. Place it prominently and professionally.' })
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/packaging_${designType}_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Thiết kế thất bại: ${msg}` }
  }
}

/** Tạo ảnh bề mặt phẳng hộp. faceIndex 1–3: mặt 1=chính (lớn nhất), 2, 3= mặt bên. Mặt 1 không cần reference, mặt 2–3 dùng mặt 1 làm tham khảo style. */
export async function createBoxSurfaceImageWithAI(formData: FormData): Promise<
  | { success: true; resultUrl: string }
  | { error: string }
> {
  const faceIndex = Math.max(1, Math.min(3, Number(formData.get('faceIndex')) || 1))
  const referenceImageUrl = (formData.get('referenceImageUrl') as string)?.trim() || ''
  const referenceImageFile = formData.get('referenceImageFile') as File | null
  const surfaceLength = Math.max(20, Math.min(800, Number(formData.get('surfaceLength')) || 200))
  const surfaceWidth = Math.max(20, Math.min(800, Number(formData.get('surfaceWidth')) || 150))
  const boxLength = Math.max(20, Math.min(500, Number(formData.get('boxLength')) || surfaceLength))
  const boxWidth = Math.max(20, Math.min(500, Number(formData.get('boxWidth')) || surfaceWidth))
  const boxHeight = Math.max(20, Math.min(500, Number(formData.get('boxHeight')) || 100))
  const textOrientation = ((formData.get('textOrientation') as string) || 'horizontal') as 'horizontal' | 'vertical'
  const hasBorder = (formData.get('hasBorder') as string) === '1'
  const borderStyle = (formData.get('borderStyle') as string) || 'single'
  const backgroundType = (formData.get('backgroundType') as string) || 'transparent'
  const patternStyle = (formData.get('patternStyle') as string) || 'waves'
  const uiLocale = ((formData.get('uiLocale') as string) || 'vi') as 'vi' | 'en' | 'zh' | 'ja' | 'ko'
  const brandName = (formData.get('brandName') as string)?.trim() || ''
  const productName = (formData.get('productName') as string)?.trim() || ''
  const companyAddress = (formData.get('companyAddress') as string)?.trim() || ''
  const website = (formData.get('website') as string)?.trim() || ''
  const email = (formData.get('email') as string)?.trim() || ''
  const hotline = (formData.get('hotline') as string)?.trim() || ''
  const countryOfOrigin = (formData.get('countryOfOrigin') as string)?.trim() || ''
  const storageInstructions = (formData.get('storageInstructions') as string)?.trim() || ''
  const warningAllergy = (formData.get('warningAllergy') as string)?.trim() || ''
  const volume = (formData.get('volume') as string)?.trim() || ''
  const registrationCode = (formData.get('registrationCode') as string)?.trim() || ''
  const socialLinks = (formData.get('socialLinks') as string)?.trim() || ''
  const contentBlocksRaw = (formData.get('contentBlocks') as string) || '[]'
  let contentBlocks: { label: string; content: string }[] = []
  try {
    contentBlocks = JSON.parse(contentBlocksRaw)
    if (!Array.isArray(contentBlocks)) contentBlocks = []
  } catch {
    contentBlocks = []
  }
  const style = (formData.get('style') as string) || 'modern'
  const packagingQuantity = (formData.get('packagingQuantity') as string)?.trim() || ''
  const packagingWeight = (formData.get('packagingWeight') as string)?.trim() || ''
  const packagingShipping = (formData.get('packagingShipping') as string)?.trim() || ''
  const packagingOther = (formData.get('packagingOther') as string)?.trim() || ''
  const manufacturerMessage = (formData.get('manufacturerMessage') as string)?.trim() || ''
  const packagingBatchLot = (formData.get('packagingBatchLot') as string)?.trim() || ''
  const packagingProdDate = (formData.get('packagingProdDate') as string)?.trim() || ''
  const packagingExpiryDate = (formData.get('packagingExpiryDate') as string)?.trim() || ''
  const includeBoxDims = (formData.get('includeBoxDims') as string) === '1'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const logoFile = formData.get('logo') as File | null
  const productImageFiles = (formData.getAll('productImage') as File[]).filter((f) => f?.size && f.size > 0).slice(0, 6)
  const hasProductImage = productImageFiles.length > 0

  if (faceIndex >= 2 && !referenceImageUrl) return { error: 'Thiếu ảnh tham khảo (mặt trước).' }

  const aspectRatio = getAspectRatioFromDimensions(surfaceLength, surfaceWidth, textOrientation)

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: referenceImageUrl || '',
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  let referenceBase64: string | null = null
  if (faceIndex === 1 && referenceImageFile?.size && referenceImageFile.size > 0) {
    try {
      const buf = await referenceImageFile.arrayBuffer()
      referenceBase64 = Buffer.from(buf).toString('base64')
    } catch {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không thể đọc ảnh tham khảo.' }
    }
  } else if (referenceImageUrl) {
    try {
      const res = await fetch(referenceImageUrl)
      if (!res.ok) throw new Error('Fetch failed')
      const buf = await res.arrayBuffer()
      referenceBase64 = Buffer.from(buf).toString('base64')
    } catch {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'Không thể tải ảnh tham khảo.' }
    }
  }

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
  const isVi = uiLocale === 'vi'
  const L = {
    brand: isVi ? 'Thương hiệu' : 'Brand',
    product: isVi ? 'Sản phẩm' : 'Product',
    companyAddress: isVi ? 'Địa chỉ công ty / Liên hệ' : 'Company address / Contact',
    website: isVi ? 'Website' : 'Website',
    email: isVi ? 'Email' : 'Email',
    hotline: isVi ? 'Hotline / SĐT' : 'Hotline / Phone',
    countryOfOrigin: isVi ? 'Nguồn gốc xuất xứ' : 'Country of origin',
    storageInstructions: isVi ? 'Hướng dẫn bảo quản' : 'Storage instructions',
    warningAllergy: isVi ? 'Cảnh báo / Allergy' : 'Warning / Allergy',
    volume: isVi ? 'Thể tích' : 'Volume',
    registrationCode: isVi ? 'Mã đăng ký' : 'Registration code',
    socialLinks: isVi ? 'Mạng xã hội' : 'Social media',
    batchLot: isVi ? 'Số lô' : 'Batch/Lot number',
    prodDate: isVi ? 'Ngày sản xuất' : 'Production date',
    expiryDate: isVi ? 'Ngày hết hạn sử dụng' : 'Expiry/Use-by date',
    quantity: isVi ? 'Số lượng' : 'Quantity',
    weight: isVi ? 'Trọng lượng' : 'Weight',
    shipping: isVi ? 'Yêu cầu vận chuyển' : 'Shipping requirements',
    boxDims: isVi ? 'Kích thước hộp' : 'Box dimensions',
  }

  const textParts: string[] = []
  if (brandName.trim()) textParts.push(`${L.brand}: ${brandName.trim()}`)
  if (productName.trim()) textParts.push(`${L.product}: ${productName.trim()}`)
  if (companyAddress.trim()) textParts.push(`${L.companyAddress}: ${companyAddress.trim()}`)
  if (website.trim()) textParts.push(`${L.website}: ${website.trim()}`)
  if (email.trim()) textParts.push(`${L.email}: ${email.trim()}`)
  if (hotline.trim()) textParts.push(`${L.hotline}: ${hotline.trim()}`)
  if (countryOfOrigin.trim()) textParts.push(`${L.countryOfOrigin}: ${countryOfOrigin.trim()}`)
  if (storageInstructions.trim()) textParts.push(`${L.storageInstructions}: ${storageInstructions.trim()}`)
  if (warningAllergy.trim()) textParts.push(`${L.warningAllergy}: ${warningAllergy.trim()}`)
  if (volume.trim()) textParts.push(`${L.volume}: ${volume.trim()}`)
  if (registrationCode.trim()) textParts.push(`${L.registrationCode}: ${registrationCode.trim()}`)
  if (socialLinks.trim()) textParts.push(`${L.socialLinks}: ${socialLinks.trim()}`)
  for (const b of contentBlocks.filter((x) => x.label?.trim() || x.content?.trim())) {
    const label = b.label?.trim() || (isVi ? 'Nội dung' : 'Content')
    const content = b.content?.trim() || ''
    if (content) textParts.push(`Block "${label}": ${content}`)
  }
  if (packagingBatchLot) textParts.push(`${L.batchLot}: ${packagingBatchLot}`)
  if (packagingProdDate) {
    const [y, m, d] = packagingProdDate.split('-')
    const dateFormatted = d && m && y ? `${d}/${m}/${y}` : packagingProdDate
    textParts.push(`${L.prodDate}: ${dateFormatted}`)
  }
  if (packagingExpiryDate) {
    const [y, m, d] = packagingExpiryDate.split('-')
    const dateFormatted = d && m && y ? `${d}/${m}/${y}` : packagingExpiryDate
    textParts.push(`${L.expiryDate}: ${dateFormatted}`)
  }
  if (packagingQuantity) textParts.push(`${L.quantity}: ${packagingQuantity}`)
  if (packagingWeight) textParts.push(`${L.weight}: ${packagingWeight}`)
  if (packagingShipping) textParts.push(`${L.shipping}: ${packagingShipping}`)
  if (packagingOther) textParts.push(`Packaging specs: ${packagingOther}`)
  if (manufacturerMessage) textParts.push(`Display this message WITHOUT any label (no prefix, no "Packaging specs:", just the text as-is): "${manufacturerMessage}"`)
  if (includeBoxDims) textParts.push(`${L.boxDims}: ${boxLength}mm × ${boxWidth}mm × ${boxHeight}mm (L×W×H). CRITICAL: Display EXACTLY 3 numbers only - Length, Width, Height. Do NOT repeat any dimension.`)
  const leftAlignRule = 'CRITICAL: All text on the packaging MUST be left-aligned. Tất cả chữ căn lề trái.'
  const contentBlocksInstruction = textParts.some((p) => p.startsWith('Block "'))
    ? 'Place each content block in a SEPARATE, NON-ADJACENT area of the design (e.g. one block for ingredients in one corner, another for usage in another area). Blocks should be spaced apart, not clustered together.'
    : ''
  const textInstruction = textParts.length ? `Include ONLY these texts (do not add any other text): ${textParts.join('. ')}. ${contentBlocksInstruction}. ${leftAlignRule}` : leftAlignRule
  const packagingRule = !textParts.length
    ? 'CRITICAL: Do NOT add any packaging information (weight, quantity, dimensions, shipping requirements, net weight, etc.) to the design. Only include what the user explicitly provides. If nothing is provided, do not invent or add any such text.'
    : 'Only include the packaging/text information explicitly listed above. Do NOT add any other packaging specs. CRITICAL: Display quantity and weight EXACTLY as provided - do NOT convert numbers to words (e.g. 15 must show as 15, not "fifteen" or "Mười lăm"; 500g must show as 500g, not "Năm trăm gam"). Content as entered, no translation.'

  const textOrientationHint = textOrientation === 'horizontal'
    ? 'Text and content should be oriented horizontally along the longer dimension (landscape layout).'
    : 'Text and content should be oriented horizontally along the shorter dimension (portrait layout, text reads along the short side).'

  const BORDER_HINTS: Record<string, string> = {
    single: 'Include a clean single-line border/frame around the design edge.',
    double: 'Include a double-line border/frame around the design edge.',
    dotted: 'Include a dotted border/frame around the design edge.',
    dashed: 'Include a dashed border/frame around the design edge.',
    rounded: 'Include a border with rounded corners framing the design.',
    decorative: 'Include an ornamental/decorative border/frame around the design.',
  }
  const borderHint = hasBorder && BORDER_HINTS[borderStyle]
    ? BORDER_HINTS[borderStyle]
    : 'No border. Design extends edge-to-edge, full bleed, clean edges.'

  const PATTERN_HINTS: Record<string, string> = {
    waves: 'Patterned background with wave/flowing patterns. Subtle, elegant waves or curves.',
    geometric: 'Patterned background with geometric shapes (lines, triangles, hexagons).',
    traditional: 'Patterned background with traditional/ornamental motifs (Asian, floral, gold accents).',
    dots: 'Patterned background with dot/circle pattern. Polka-dot style.',
    floral: 'Patterned background with floral/botanical motifs.',
    stripes: 'Patterned background with stripes (horizontal, vertical, or diagonal).',
  }
  const patternHint = backgroundType === 'patterned' ? (PATTERN_HINTS[patternStyle] || PATTERN_HINTS.waves) : ''
  const BACKGROUND_HINTS: Record<string, string> = {
    transparent: 'Background: solid CARTON/KRAFT color. Use natural cardboard color: brown, beige, kraft paper tone (e.g. #C4A574, #D4A574). Areas without design MUST be filled with this solid carton color. Output PNG with SOLID background – NOT transparent, NO alpha. Màu bìa carton tự nhiên – nền solid.',
    ai: 'Use a solid background color that complements the design, brand and style. Choose the color yourself.',
    patterned: `Patterned background. ${patternHint} Background should have a decorative pattern, not solid color.`,
    white: 'Solid white background (#FFFFFF).',
    offwhite: 'Solid off-white/ivory background. Slightly warm white.',
    cream: 'Solid cream background. Warm, soft tone.',
    beige: 'Solid beige/tan background. Warm neutral.',
    sand: 'Solid sand/tan background. Warm earthy tone.',
    lightgray: 'Solid light gray background. Cool, soft neutral.',
    lightblue: 'Solid light blue background. Soft, cool tone.',
    mint: 'Solid mint/teal background. Fresh, cool green-blue.',
    lightpink: 'Solid light pink/pastel pink background. Soft, gentle.',
    lavender: 'Solid lavender background. Soft purple.',
    lightyellow: 'Solid light yellow/pastel yellow background. Soft, warm.',
    lightgreen: 'Solid light green/pastel green background. Fresh, soft.',
    peach: 'Solid peach background. Warm, soft orange-pink.',
    charcoal: 'Solid charcoal/dark gray background. Sophisticated.',
    navy: 'Solid navy blue background. Deep, professional.',
    black: 'Solid black background (#000000).',
  }
  const backgroundHint = BACKGROUND_HINTS[backgroundType] || BACKGROUND_HINTS.transparent

  const isMainFace = faceIndex === 1
  const faceTypeHint = isMainFace
    ? 'This is FACE 1 - the MAIN design panel, a reference/suggestion. All details must come from the user input (brand, product, content). Design it as the primary panel with the MOST DETAILS: prominent branding, rich visuals, product images, key information. Most elaborate and eye-catching.'
    : `This is FACE ${faceIndex} - a secondary panel. Use the reference image (Face 1) as style reference only (colors, layout, aesthetic). Create a flat artwork for Face ${faceIndex} that matches this style. Simpler and complementary to the main face.`

  let prompt: string
  const contentParts: object[] = []

  const dimensionRule = `Design dimensions: ${surfaceLength}mm × ${surfaceWidth}mm. Output image MUST match this aspect ratio (full bleed, edge-to-edge design).`
  const backgroundRule = `CRITICAL - Màu nền (background): ${backgroundHint} User's background choice MUST be applied.`
  if (faceIndex === 1 && referenceBase64) {
    prompt = `Generate a single flat 2D design artwork for print.

${dimensionRule}

CRITICAL - IMAGE 1 is STYLE REFERENCE ONLY. Do NOT copy it verbatim. Use it ONLY for colors, layout style, aesthetic. Create a COMPLETELY NEW design using user's information (brand, product, content below). Do NOT use customer product images when reference is provided.

${backgroundRule} ${borderHint} ${textOrientationHint} ${stylePrompt} ${textInstruction} ${packagingRule} Output only the image, no watermark. Professional print-ready quality.`
    contentParts.push({ text: prompt })
    contentParts.push({ inlineData: { data: referenceBase64, mimeType: 'image/png' } })
  } else if (faceIndex === 1) {
    prompt = `Generate a single flat 2D design artwork for print.

${dimensionRule}

${backgroundRule} ${borderHint} ${faceTypeHint} ${textOrientationHint} ${stylePrompt} ${textInstruction} ${packagingRule} Output only the image, no watermark. Professional print-ready quality.`
    contentParts.push({ text: prompt })
  } else {
    prompt = `Generate a single flat 2D design artwork for print.

${dimensionRule}

CRITICAL - IMAGE 1 (Face 1) is STYLE REFERENCE ONLY: Use for color palette, layout style. Create NEW design for Face ${faceIndex} from user input.

${backgroundRule} ${borderHint} ${textOrientationHint} ${stylePrompt} ${textInstruction} ${packagingRule} Output only the image, no watermark. Professional print-ready quality.`
    contentParts.push({ text: prompt })
    if (referenceBase64) contentParts.push({ inlineData: { data: referenceBase64, mimeType: 'image/png' } })
  }
  const hasLogo = logoFile?.size && logoFile.size > 0

  const useReferenceAsMainVisual = faceIndex === 1 && !!referenceBase64
  if (hasProductImage && productImageFiles.length > 0 && !useReferenceAsMainVisual) {
    for (const f of productImageFiles) {
      contentParts.push({
        inlineData: { data: Buffer.from(await f.arrayBuffer()).toString('base64'), mimeType: f.type || 'image/png' },
      })
    }
    contentParts.push({ text: 'Integrate the product images above into the flat design.' })
  }
  if (hasLogo && logoFile) {
    contentParts.push({
      inlineData: { data: Buffer.from(await logoFile.arrayBuffer()).toString('base64'), mimeType: logoFile.type || 'image/png' },
    })
    contentParts.push({ text: 'Integrate the logo into the design.' })
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent({
      contents: [{ role: 'user', parts: contentParts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: imageQuality, aspectRatio },
      },
      safetySettings,
    } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi-surface', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/box_surface_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo ảnh bề mặt thất bại: ${msg}` }
  }
}

/** Tạo ảnh phẳng túi (mặt in chính W×H). Quy trình giống hộp: ảnh phẳng → mockup 3D. */
export async function createBagSurfaceImageWithAI(formData: FormData): Promise<
  | { success: true; resultUrl: string }
  | { error: string }
> {
  const bagWidth = Math.max(20, Math.min(500, Number(formData.get('bagWidth')) || 200))
  const bagHeight = Math.max(20, Math.min(500, Number(formData.get('bagHeight')) || 280))
  const surfaceLength = bagWidth
  const surfaceWidth = bagHeight
  const textOrientation = ((formData.get('textOrientation') as string) || 'horizontal') as 'horizontal' | 'vertical'
  const hasBorder = (formData.get('hasBorder') as string) === '1'
  const borderStyle = (formData.get('borderStyle') as string) || 'single'
  const backgroundType = (formData.get('backgroundType') as string) || 'transparent'
  const patternStyle = (formData.get('patternStyle') as string) || 'waves'
  const uiLocale = ((formData.get('uiLocale') as string) || 'vi') as 'vi' | 'en' | 'zh' | 'ja' | 'ko'
  const brandName = (formData.get('brandName') as string)?.trim() || ''
  const productName = (formData.get('productName') as string)?.trim() || ''
  const companyAddress = (formData.get('companyAddress') as string)?.trim() || ''
  const website = (formData.get('website') as string)?.trim() || ''
  const email = (formData.get('email') as string)?.trim() || ''
  const hotline = (formData.get('hotline') as string)?.trim() || ''
  const countryOfOrigin = (formData.get('countryOfOrigin') as string)?.trim() || ''
  const storageInstructions = (formData.get('storageInstructions') as string)?.trim() || ''
  const warningAllergy = (formData.get('warningAllergy') as string)?.trim() || ''
  const volume = (formData.get('volume') as string)?.trim() || ''
  const registrationCode = (formData.get('registrationCode') as string)?.trim() || ''
  const socialLinks = (formData.get('socialLinks') as string)?.trim() || ''
  const contentBlocksRaw = (formData.get('contentBlocks') as string) || '[]'
  let contentBlocks: { label: string; content: string }[] = []
  try {
    contentBlocks = JSON.parse(contentBlocksRaw)
    if (!Array.isArray(contentBlocks)) contentBlocks = []
  } catch {
    contentBlocks = []
  }
  const style = (formData.get('style') as string) || 'modern'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const logoFile = formData.get('logo') as File | null
  const referenceImageFile = formData.get('referenceImageFile') as File | null
  const productImageFiles = (formData.getAll('productImage') as File[]).filter((f) => f?.size && f.size > 0).slice(0, 6)
  const hasProductImage = productImageFiles.length > 0
  const hasReferenceForBag = !!(referenceImageFile?.size && referenceImageFile.size > 0)

  const aspectRatio = getAspectRatioFromDimensions(surfaceLength, surfaceWidth, textOrientation)

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: '',
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
  const isVi = uiLocale === 'vi'
  const L = {
    brand: isVi ? 'Thương hiệu' : 'Brand',
    product: isVi ? 'Sản phẩm' : 'Product',
    companyAddress: isVi ? 'Địa chỉ công ty / Liên hệ' : 'Company address / Contact',
    website: isVi ? 'Website' : 'Website',
    email: isVi ? 'Email' : 'Email',
    hotline: isVi ? 'Hotline / SĐT' : 'Hotline / Phone',
    countryOfOrigin: isVi ? 'Nguồn gốc xuất xứ' : 'Country of origin',
    storageInstructions: isVi ? 'Hướng dẫn bảo quản' : 'Storage instructions',
    warningAllergy: isVi ? 'Cảnh báo / Allergy' : 'Warning / Allergy',
    volume: isVi ? 'Thể tích' : 'Volume',
    registrationCode: isVi ? 'Mã đăng ký' : 'Registration code',
    socialLinks: isVi ? 'Mạng xã hội' : 'Social media',
  }

  const textParts: string[] = []
  if (brandName.trim()) textParts.push(`${L.brand}: ${brandName.trim()}`)
  if (productName.trim()) textParts.push(`${L.product}: ${productName.trim()}`)
  if (companyAddress.trim()) textParts.push(`${L.companyAddress}: ${companyAddress.trim()}`)
  if (website.trim()) textParts.push(`${L.website}: ${website.trim()}`)
  if (email.trim()) textParts.push(`${L.email}: ${email.trim()}`)
  if (hotline.trim()) textParts.push(`${L.hotline}: ${hotline.trim()}`)
  if (countryOfOrigin.trim()) textParts.push(`${L.countryOfOrigin}: ${countryOfOrigin.trim()}`)
  if (storageInstructions.trim()) textParts.push(`${L.storageInstructions}: ${storageInstructions.trim()}`)
  if (warningAllergy.trim()) textParts.push(`${L.warningAllergy}: ${warningAllergy.trim()}`)
  if (volume.trim()) textParts.push(`${L.volume}: ${volume.trim()}`)
  if (registrationCode.trim()) textParts.push(`${L.registrationCode}: ${registrationCode.trim()}`)
  if (socialLinks.trim()) textParts.push(`${L.socialLinks}: ${socialLinks.trim()}`)
  for (const b of contentBlocks.filter((x) => x.label?.trim() || x.content?.trim())) {
    const label = b.label?.trim() || (isVi ? 'Nội dung' : 'Content')
    const content = b.content?.trim() || ''
    if (content) textParts.push(`Block "${label}": ${content}`)
  }
  const contentBlocksInstruction = textParts.some((p) => p.startsWith('Block "'))
    ? 'Place each content block in a SEPARATE, NON-ADJACENT area. Display content exactly as provided.'
    : ''
  const leftAlignRule = 'CRITICAL: All text on the packaging MUST be left-aligned.'
  const textInstruction = textParts.length ? `Include ONLY these texts: ${textParts.join('. ')}. ${contentBlocksInstruction}. ${leftAlignRule}` : leftAlignRule
  const packagingRule = !textParts.length
    ? 'CRITICAL: Do NOT add any packaging information. Only include what the user explicitly provides.'
    : 'Only include the information explicitly listed above. Do NOT add any other text.'

  const textOrientationHint = textOrientation === 'horizontal'
    ? 'Text and content should be oriented horizontally along the longer dimension (landscape layout).'
    : 'Text and content should be oriented horizontally along the shorter dimension (portrait layout).'

  const BORDER_HINTS: Record<string, string> = {
    single: 'Include a clean single-line border/frame around the design edge.',
    double: 'Include a double-line border/frame around the design edge.',
    dotted: 'Include a dotted border/frame around the design edge.',
    dashed: 'Include a dashed border/frame around the design edge.',
    rounded: 'Include a border with rounded corners framing the design.',
    decorative: 'Include an ornamental/decorative border/frame around the design.',
  }
  const borderHint = hasBorder && BORDER_HINTS[borderStyle] ? BORDER_HINTS[borderStyle] : 'No border. Design extends edge-to-edge, full bleed, clean edges.'

  const PATTERN_HINTS: Record<string, string> = {
    waves: 'Patterned background with wave/flowing patterns. Subtle, elegant waves or curves.',
    geometric: 'Patterned background with geometric shapes (lines, triangles, hexagons).',
    traditional: 'Patterned background with traditional/ornamental motifs (Asian, floral, gold accents).',
    dots: 'Patterned background with dot/circle pattern. Polka-dot style.',
    floral: 'Patterned background with floral/botanical motifs.',
    stripes: 'Patterned background with stripes (horizontal, vertical, or diagonal).',
  }
  const patternHint = backgroundType === 'patterned' ? (PATTERN_HINTS[patternStyle] || PATTERN_HINTS.waves) : ''
  const BACKGROUND_HINTS: Record<string, string> = {
    transparent: 'Background: solid CARTON/KRAFT color. Use natural cardboard color: brown, beige, kraft paper tone. Areas without design MUST be filled with this solid carton color. Output PNG with SOLID background – NOT transparent.',
    ai: 'Use a solid background color that complements the design, brand and style. Choose the color yourself.',
    patterned: `Patterned background. ${patternHint} Background should have a decorative pattern, not solid color.`,
    white: 'Solid white background (#FFFFFF).',
    offwhite: 'Solid off-white/ivory background. Slightly warm white.',
    cream: 'Solid cream background. Warm, soft tone.',
    beige: 'Solid beige/tan background. Warm neutral.',
    sand: 'Solid sand/tan background. Warm earthy tone.',
    lightgray: 'Solid light gray background. Cool, soft neutral.',
    lightblue: 'Solid light blue background. Soft, cool tone.',
    mint: 'Solid mint/teal background. Fresh, cool green-blue.',
    lightpink: 'Solid light pink/pastel pink background. Soft, gentle.',
    lavender: 'Solid lavender background. Soft purple.',
    lightyellow: 'Solid light yellow/pastel yellow background. Soft, warm.',
    lightgreen: 'Solid light green/pastel green background. Fresh, soft.',
    peach: 'Solid peach background. Warm, soft orange-pink.',
    charcoal: 'Solid charcoal/dark gray background. Sophisticated.',
    navy: 'Solid navy blue background. Deep, professional.',
    black: 'Solid black background (#000000).',
  }
  const backgroundHint = BACKGROUND_HINTS[backgroundType] || BACKGROUND_HINTS.transparent

  const dimensionRule = `Design dimensions: ${surfaceLength}mm × ${surfaceWidth}mm. This is a FLAT BAG design – the main print face for a paper bag/pouch. Output image MUST match this aspect ratio (full bleed, edge-to-edge design).`
  const backgroundRule = `CRITICAL - Màu nền (background): ${backgroundHint} User's background choice MUST be applied.`

  let referenceBase64: string | null = null
  if (hasReferenceForBag && referenceImageFile) {
    try {
      const buf = await referenceImageFile.arrayBuffer()
      referenceBase64 = Buffer.from(buf).toString('base64')
    } catch {
      return { error: 'Không thể đọc ảnh tham khảo.' }
    }
  }

  const useReferenceAsMainVisual = !!referenceBase64
  let prompt: string
  const contentParts: object[] = []

  if (useReferenceAsMainVisual) {
    prompt = `Generate a single flat 2D design artwork for a PAPER BAG / POUCH packaging. This design will be printed on the main face (front and back) of the bag.

${dimensionRule}

CRITICAL - IMAGE 1 is STYLE REFERENCE ONLY. Do NOT copy it verbatim. Use it ONLY for colors, layout style, aesthetic. Create a COMPLETELY NEW design using user's information (brand, product, content below). Do NOT use customer product images when reference is provided.

${backgroundRule} ${borderHint} ${textOrientationHint} ${stylePrompt} ${textInstruction} ${packagingRule} Output only the image, no watermark. Professional print-ready quality for bag packaging.`
    contentParts.push({ text: prompt })
    contentParts.push({ inlineData: { data: referenceBase64, mimeType: 'image/png' } })
  } else {
    prompt = `Generate a single flat 2D design artwork for a PAPER BAG / POUCH packaging. This design will be printed on the main face (front and back) of the bag.

${dimensionRule}

${backgroundRule} ${borderHint} ${textOrientationHint} ${stylePrompt} ${textInstruction} ${packagingRule} Output only the image, no watermark. Professional print-ready quality for bag packaging.`
    contentParts.push({ text: prompt })
  }

  const hasLogo = logoFile?.size && logoFile.size > 0
  if (hasProductImage && productImageFiles.length > 0 && !useReferenceAsMainVisual) {
    for (const f of productImageFiles) {
      contentParts.push({
        inlineData: { data: Buffer.from(await f.arrayBuffer()).toString('base64'), mimeType: f.type || 'image/png' },
      })
    }
    contentParts.push({ text: 'Integrate the product images above into the flat design.' })
  }
  if (hasLogo && logoFile) {
    contentParts.push({
      inlineData: { data: Buffer.from(await logoFile.arrayBuffer()).toString('base64'), mimeType: logoFile.type || 'image/png' },
    })
    contentParts.push({ text: 'Integrate the logo into the design.' })
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent({
      contents: [{ role: 'user', parts: contentParts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: imageQuality, aspectRatio },
      },
      safetySettings,
    } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi-bag-surface', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/bag_surface_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo ảnh phẳng túi thất bại: ${msg}` }
  }
}

/** Tạo mockup 3D hộp từ 3 ảnh bề mặt đã duyệt. face1= mặt chính (lớn nhất), face2, face3= mặt bên. */
export async function createBoxMockupFrom3Faces(formData: FormData): Promise<
  | { success: true; resultUrl: string }
  | { error: string }
> {
  const face1Url = (formData.get('face1Url') as string)?.trim() || ''
  const face2Url = (formData.get('face2Url') as string)?.trim() || ''
  const face3Url = (formData.get('face3Url') as string)?.trim() || ''
  const boxLength = Math.max(20, Math.min(500, Number(formData.get('boxLength')) || 200))
  const boxWidth = Math.max(20, Math.min(500, Number(formData.get('boxWidth')) || 150))
  const boxHeight = Math.max(20, Math.min(500, Number(formData.get('boxHeight')) || 100))
  const aspectRatio = (formData.get('aspectRatio') as string) || '1:1'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'

  if (!face1Url || !face2Url || !face3Url) return { error: 'Thiếu đủ 3 ảnh bề mặt.' }
  if (!isPackagingAspectRatio(aspectRatio)) return { error: 'Tỷ lệ khung hình không hợp lệ.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: face1Url,
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  const fetchBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Fetch failed')
    const buf = await res.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  }

  let face1Base64: string
  let face2Base64: string
  let face3Base64: string
  try {
    ;[face1Base64, face2Base64, face3Base64] = await Promise.all([
      fetchBase64(face1Url),
      fetchBase64(face2Url),
      fetchBase64(face3Url),
    ])
  } catch {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'Không thể tải ảnh bề mặt.' }
  }

  const prompt = `Create a photorealistic 3D cardboard box mockup. Box dimensions: ${boxLength}mm (length) × ${boxWidth}mm (width) × ${boxHeight}mm (height).

CRITICAL - You are given exactly 3 flat print designs. Apply EACH design to ONE face of the box. ALL 3 visible faces MUST show printed designs. NEVER leave any face as plain brown cardboard.

Mapping (strict):
- First image provided → TOP FACE (horizontal top surface). Print the full design on the top.
- Second image provided → FRONT FACE (vertical face facing viewer). Print the full design on the front.
- Third image provided → SIDE FACE (vertical left or right side). Print the full design on the side.

Result: a 3D box where top, front, and side all show the respective designs. Professional lighting, shadows, perspective. Output only the image, no watermark.`

  const contentParts: object[] = [
    { text: prompt },
    { inlineData: { data: face1Base64, mimeType: 'image/png' } },
    { inlineData: { data: face2Base64, mimeType: 'image/png' } },
    { inlineData: { data: face3Base64, mimeType: 'image/png' } },
  ]

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi-mockup', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/box_mockup_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo mockup 3D thất bại: ${msg}` }
  }
}

export type FaceSizeKey = 'LxW' | 'LxH' | 'WxH'

const FACE_ORDER: FaceSizeKey[] = ['LxW', 'LxH', 'WxH']
const FACE_LABELS: Record<FaceSizeKey, string> = { LxW: 'TOP/BOTTOM', LxH: 'FRONT/BACK', WxH: 'LEFT/RIGHT' }

/** Tạo mockup 3D từ 1–6 ảnh, mỗi ảnh có sizeKey (LxW, LxH, WxH). */
export async function createBoxMockupFromFaces(params: {
  faces: { url: string; sizeKey: FaceSizeKey }[]
  boxLength: number
  boxWidth: number
  boxHeight: number
  aspectRatio: string
  imageQuality: '2K' | '4K'
}): Promise<{ success: true; resultUrl: string } | { error: string }> {
  const { faces, boxLength, boxWidth, boxHeight, aspectRatio, imageQuality } = params
  if (!faces?.length || faces.length > 6) return { error: 'Cần 1–6 ảnh bề mặt.' }
  if (!isPackagingAspectRatio(aspectRatio)) return { error: 'Tỷ lệ khung hình không hợp lệ.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: faces[0]?.url || '',
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  const fetchBase64 = async (url: string): Promise<string> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error('Fetch failed')
    const buf = await res.arrayBuffer()
    return Buffer.from(buf).toString('base64')
  }

  const orderedFaces = [...faces].sort((a, b) => FACE_ORDER.indexOf(a.sizeKey) - FACE_ORDER.indexOf(b.sizeKey))
  const faceNames: Record<FaceSizeKey, string[]> = {
    LxW: ['TOP', 'BOTTOM'],
    LxH: ['FRONT', 'BACK'],
    WxH: ['LEFT', 'RIGHT'],
  }
  const faceDims: Record<FaceSizeKey, string> = {
    LxW: `${boxLength}×${boxWidth}mm`,
    LxH: `${boxLength}×${boxHeight}mm`,
    WxH: `${boxWidth}×${boxHeight}mm`,
  }
  const mapping: string[] = []
  const idxBySize: Record<FaceSizeKey, number> = { LxW: 0, LxH: 0, WxH: 0 }
  for (let i = 0; i < orderedFaces.length; i++) {
    const sk = orderedFaces[i].sizeKey
    const faceName = faceNames[sk][idxBySize[sk]] || faceNames[sk][0]
    idxBySize[sk]++
    mapping.push(`- Image ${i + 1} → ${faceName} FACE (${FACE_LABELS[sk]}). Face size: ${faceDims[sk]}. This image was created for ${faceDims[sk]} – apply it to this face WITHOUT stretching or distorting. Preserve aspect ratio.`)
  }

  let imagesBase64: string[]
  try {
    imagesBase64 = await Promise.all(orderedFaces.map((f) => fetchBase64(f.url)))
  } catch {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'Không thể tải ảnh bề mặt.' }
  }

  const ratioL = (boxLength / Math.min(boxLength, boxWidth, boxHeight)).toFixed(1)
  const ratioW = (boxWidth / Math.min(boxLength, boxWidth, boxHeight)).toFixed(1)
  const ratioH = (boxHeight / Math.min(boxLength, boxWidth, boxHeight)).toFixed(1)
  const prompt = `Create a photorealistic 3D cardboard box mockup.

CRITICAL - Box dimensions and proportions: ${boxLength}mm (L) × ${boxWidth}mm (W) × ${boxHeight}mm (H). The 3D box MUST have EXACT proportions: L:W:H = ${ratioL}:${ratioW}:${ratioH}. The visible faces must show correct aspect ratios: L×W face = ${boxLength}×${boxWidth}mm, L×H face = ${boxLength}×${boxHeight}mm, W×H face = ${boxWidth}×${boxHeight}mm. Do NOT render a cube or wrong proportions – the box shape must match these dimensions. Tỷ lệ hộp phải đúng kích thước.

CRITICAL - You are given ${orderedFaces.length} flat print design(s). Apply EACH image directly to its specified face. Match each image to its face by dimensions – do NOT stretch, squash, or distort. Preserve aspect ratio. Ốp thẳng ảnh lên từng mặt, kích thước ảnh khớp kích thước mặt.

Mapping (strict):
${mapping.join('\n')}

Result: a 3D box where the specified faces show the respective designs. Professional lighting, shadows, perspective. Output only the image, no watermark.`

  const contentParts: object[] = [{ text: prompt }, ...imagesBase64.map((d) => ({ inlineData: { data: d, mimeType: 'image/png' as const } }))]

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi-mockup', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/box_mockup_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo mockup 3D thất bại: ${msg}` }
  }
}

/** Tạo mockup 3D túi từ ảnh phẳng đã tạo. Ảnh phẳng in lên mặt trước/sau túi. */
export async function createBagMockupFromFlat(params: {
  flatImageUrl: string
  bagWidth: number
  bagHeight: number
  bagGusset: number
  bagType: BagType
  aspectRatio: string
  imageQuality: '2K' | '4K'
}): Promise<{ success: true; resultUrl: string } | { error: string }> {
  const { flatImageUrl, bagWidth, bagHeight, bagGusset, bagType, aspectRatio, imageQuality } = params
  if (!flatImageUrl?.trim()) return { error: 'Thiếu ảnh phẳng túi.' }
  if (!isPackagingAspectRatio(aspectRatio)) return { error: 'Tỷ lệ khung hình không hợp lệ.' }

  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = PACKAGING_COSTS[imageQuality]

  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(openBalance)}.` }
  }

  const historyRow = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: flatImageUrl,
    garmentImageUrl: '',
    feature: 'thiet-ke-bao-bi',
  })
  if (!historyRow) return { error: 'Không thể khởi tạo phiên xử lý.' }
  const historyItem = { id: historyRow.id }

  let flatBase64: string
  try {
    const res = await fetch(flatImageUrl)
    if (!res.ok) throw new Error('Fetch failed')
    const buf = await res.arrayBuffer()
    flatBase64 = Buffer.from(buf).toString('base64')
  } catch {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    return { error: 'Không thể tải ảnh phẳng túi.' }
  }

  const bagTypeDesc = BAG_TYPE_OPTIONS.find((o) => o.value === bagType)?.prompt ?? BAG_TYPE_OPTIONS[0].prompt
  const prompt = `Create a photorealistic 3D bag mockup. Bag type: ${bagTypeDesc}.

CRITICAL - Bag dimensions: ${bagWidth}mm (width) × ${bagHeight}mm (height). Gusset depth: ${bagGusset}mm. The 3D bag MUST reflect these proportions. The bag is for packaging products.

CRITICAL - You are given 1 flat print design. This design is for the MAIN FACE (front and back) of the bag. Apply this design to the visible front face of the bag. The design was created for ${bagWidth}mm × ${bagHeight}mm – apply it to the bag surface WITHOUT stretching or distorting. Preserve aspect ratio. The printed design should wrap naturally onto the 3D bag shape.

Result: a 3D bag/pouch mockup where the front face shows the provided design. Professional lighting, shadows, perspective. Output only the image, no watermark.`

  const contentParts: object[] = [{ text: prompt }, { inlineData: { data: flatBase64, mimeType: 'image/png' as const } }]

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality, aspectRatio },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-bao-bi-bag-mockup', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: 'AI không trả về ảnh. Vui lòng thử lại (đôi khi AI tạm thời không tạo được ảnh).' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/bag_mockup_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const d = await deductUserCredits(user.id, COST)
    if (!d.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits để hoàn tất.' : d.error }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl, { aspect_ratio: aspectRatio })

    revalidatePath('/thiet-ke-bao-bi')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo mockup 3D túi thất bại: ${msg}` }
  }
}
