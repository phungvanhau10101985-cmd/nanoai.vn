'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const LABEL_COSTS = { '2K': 1.5, '4K': 3 } as const
const MOCKUP_COSTS = { '2K': 1.5, '4K': 3 } as const
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '9:21', '21:9'] as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const STYLE_PROMPTS: Record<string, string> = {
  modern: 'Phong cách hiện đại, tối giản.',
  luxury: 'Phong cách cao cấp, sang trọng.',
  natural: 'Phong cách tự nhiên, organic.',
  vibrant: 'Phong cách rực rỡ, nổi bật.',
}

const PROMPT_BASE = `Tạo nhãn giới thiệu sản phẩm chuyên nghiệp cho đóng gói. Đây là sản phẩm của khách hàng. Thiết kế nhãn hiện đại, thu hút, bố cục rõ ràng phù hợp in dán trên bao bì. Chữ/nội dung cần được dàn kiểu đẹp, hài hòa với thiết kế. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`

/** Tạo nhãn giới thiệu sản phẩm. 2K: 1,5 credit, 4K: 3 credit. */
export async function createProductLabel(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const aspectRatioRaw = (formData.get('aspectRatio') as string)?.trim() || '1:1'
  const aspectRatio = VALID_ASPECT_RATIOS.includes(aspectRatioRaw as (typeof VALID_ASPECT_RATIOS)[number])
    ? aspectRatioRaw
    : '1:1'
  const labelName = (formData.get('labelName') as string)?.trim() || ''
  const labelText = (formData.get('labelText') as string)?.trim() || ''
  const brandName = (formData.get('brandName') as string)?.trim() || ''
  const productName = (formData.get('productName') as string)?.trim() || ''
  const productDescription = (formData.get('productDescription') as string)?.trim() || ''
  const ingredients = (formData.get('ingredients') as string)?.trim() || ''
  const usageInstructions = (formData.get('usageInstructions') as string)?.trim() || ''
  const companyAddress = (formData.get('companyAddress') as string)?.trim() || ''
  const website = (formData.get('website') as string)?.trim() || ''
  const email = (formData.get('email') as string)?.trim() || ''
  const hotline = (formData.get('hotline') as string)?.trim() || ''
  const storageInstructions = (formData.get('storageInstructions') as string)?.trim() || ''
  const warningAllergy = (formData.get('warningAllergy') as string)?.trim() || ''
  const warningOther = (formData.get('warningOther') as string)?.trim() || ''
  const volume = (formData.get('volume') as string)?.trim() || ''
  const registrationCode = (formData.get('registrationCode') as string)?.trim() || ''
  const countryOfOrigin = (formData.get('countryOfOrigin') as string)?.trim() || ''
  const packagingProdDate = (formData.get('packagingProdDate') as string)?.trim() || ''
  const packagingExpiryDate = (formData.get('packagingExpiryDate') as string)?.trim() || ''
  const hasBarcode = (formData.get('hasBarcode') as string) === 'true'
  const hasQrCode = (formData.get('hasQrCode') as string) === 'true'
  let selectedLabelIcons: string[] = []
  try {
    const raw = formData.get('selectedLabelIcons') as string
    if (raw) selectedLabelIcons = JSON.parse(raw) as string[]
  } catch {
    /* ignore */
  }
  const style = (formData.get('style') as string)?.trim() || 'modern'
  const backgroundType = (formData.get('backgroundType') as string)?.trim() || 'ai'
  const borderStyle = (formData.get('borderStyle') as string)?.trim() || 'single'
  const hasBorder = (formData.get('hasBorder') as string) === 'true'
  const logo = formData.get('logo') as File | null
  const hasLogo = logo?.size && logo.size > 0
  const referenceImageFile = formData.get('referenceImageFile') as File | null
  const hasReferenceImage = !!(referenceImageFile?.size && referenceImageFile.size > 0)
  const images: File[] = []
  const removeBgList: boolean[] = []
  let i = 0
  while (true) {
    const img = formData.get(`image_${i}`) as File | null
    if (!img || img.size === 0) break
    images.push(img)
    removeBgList.push(formData.get(`image_${i}_removeBg`) === 'true')
    i++
  }
  if (images.length > 6) return { error: 'Tối đa 6 ảnh sản phẩm.' }

  let prompt = PROMPT_BASE
  const tachNenIndices = removeBgList.map((v, idx) => (v ? idx + 1 : 0)).filter((v) => v > 0)
  const khongTachIndices = removeBgList.map((v, idx) => (!v ? idx + 1 : 0)).filter((v) => v > 0)
  let bgInstruction = ''
  if (tachNenIndices.length && khongTachIndices.length) {
    bgInstruction = `Images ${tachNenIndices.join(', ')}: remove background, product only. Images ${khongTachIndices.join(', ')}: keep as-is. `
  } else if (tachNenIndices.length) {
    bgInstruction = 'Remove background from all product images before designing label, product only. '
  } else if (khongTachIndices.length) {
    bgInstruction = 'Do not remove background, use images as-is. '
  }
  if (bgInstruction) {
    prompt = prompt.replace('Đây là sản phẩm của khách hàng.', `Đây là sản phẩm của khách hàng. ${bgInstruction.trim()}`)
  }
  const labelNameEn = labelName ? await normalizeToEnglish(labelName) : ''
  if (labelNameEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `TÊN NHÃN SẢN PHẨM: "${labelNameEn}". Hiển thị tên nhãn nổi bật, dễ đọc. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const labelTextEn = labelText ? await normalizeToEnglish(labelText) : ''
  if (labelTextEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `NỘI DUNG GHI TRÊN NHÃN: "${labelTextEn}". Dùng typography đẹp, rõ ràng, phù hợp in ấn. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const brandNameEn = brandName ? await normalizeToEnglish(brandName) : ''
  if (brandNameEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `THƯƠNG HIỆU: "${brandNameEn}". Hiển thị tên thương hiệu nổi bật trên nhãn. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  if (hasLogo) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      'Ảnh cuối là logo thương hiệu. Hãy đặt logo lên nhãn chuyên nghiệp, nổi bật. Chỉ trả về ảnh kết quả, không chèn chữ phụ.'
    )
  }

  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.modern
  prompt = prompt.replace('Thiết kế nhãn hiện đại', `Thiết kế nhãn ${stylePrompt}`)
  if (hasReferenceImage) {
    prompt = `CRITICAL - The first image (if provided) is STYLE REFERENCE ONLY. Use it ONLY for colors, layout, aesthetic. Do NOT copy it verbatim. Create a COMPLETELY NEW design using the product images and content below. ${prompt}`
  }

  const productNameEn = productName ? await normalizeToEnglish(productName) : ''
  if (productNameEn && !labelNameEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `TÊN SẢN PHẨM: "${productNameEn}". Hiển thị nổi bật. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const productDescriptionEn = productDescription ? await normalizeToEnglish(productDescription) : ''
  if (productDescriptionEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `MÔ TẢ NGẮN: "${productDescriptionEn}". Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const ingredientsEn = ingredients ? await normalizeToEnglish(ingredients) : ''
  if (ingredientsEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `THÀNH PHẦN: "${ingredientsEn}". Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const usageInstructionsEn = usageInstructions ? await normalizeToEnglish(usageInstructions) : ''
  if (usageInstructionsEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `HƯỚNG DẪN SỬ DỤNG: "${usageInstructionsEn}". Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const countryOfOriginEn = countryOfOrigin ? await normalizeToEnglish(countryOfOrigin) : ''
  if (countryOfOriginEn) {
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `XUẤT XỨ: "${countryOfOriginEn}". Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }
  const ICON_PROMPTS: Record<string, string> = {
    washing_care: 'Nhãn giặt tẩy (washing tub, ironing, drying symbols – ISO/GINETEX style)',
    recycle: 'Biểu tượng tái chế (Mobius loop ♻)',
    plastic_pet: 'Mã nhựa PET (1) trong tam giác',
    plastic_pp: 'Mã nhựa PP (5) trong tam giác',
    vegan: 'Vegan / PETA approved',
    cruelty_free: 'Không thử nghiệm động vật (cruelty-free)',
    organic: 'Hữu cơ (organic certification)',
    fsc: 'FSC rừng bền vững',
    compostable: 'Có thể ủ phân (compostable)',
    gluten_free: 'Không gluten',
    halal: 'Halal',
    kosher: 'Kosher',
    keep_dry: 'Bảo vệ khỏi ẩm (keep dry)',
    keep_sun: 'Tránh ánh nắng (avoid sunlight)',
    food_grade: 'Thực phẩm (food grade)',
    fragile: 'Dễ vỡ (fragile)',
    child_safe: 'Để xa trẻ em (keep from children)',
  }
  if (selectedLabelIcons.length > 0) {
    const iconDescs = selectedLabelIcons
      .map((id) => ICON_PROMPTS[id])
      .filter(Boolean)
    if (iconDescs.length) {
      const iconEn = await normalizeToEnglish(iconDescs.join('. '))
      prompt = prompt.replace(
        'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
        `THÊM CÁC ICON TRÊN NHÃN: ${iconEn}. Vẽ các icon này chuẩn, chuyên nghiệp, dễ nhận diện. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
      )
    }
  }

  const extraInfos: string[] = []
  if (hasBarcode) extraInfos.push('Dành chỗ cho mã vạch (barcode)')
  if (hasQrCode) extraInfos.push('Dành chỗ cho QR code')
  if (companyAddress) extraInfos.push(`Địa chỉ: ${companyAddress}`)
  if (website) extraInfos.push(`Website: ${website}`)
  if (email) extraInfos.push(`Email: ${email}`)
  if (hotline) extraInfos.push(`Hotline: ${hotline}`)
  if (storageInstructions) extraInfos.push(`Bảo quản: ${storageInstructions}`)
  if (warningAllergy) extraInfos.push(`Cảnh báo dị ứng: ${warningAllergy}`)
  if (warningOther) extraInfos.push(`Cảnh báo khác: ${warningOther}`)
  if (volume) extraInfos.push(`Khối lượng: ${volume}`)
  if (registrationCode) extraInfos.push(`Mã đăng ký: ${registrationCode}`)
  if (packagingProdDate) extraInfos.push(`NSX: ${packagingProdDate}`)
  if (packagingExpiryDate) extraInfos.push(`HSD: ${packagingExpiryDate}`)
  if (extraInfos.length) {
    const extraEn = await normalizeToEnglish(extraInfos.join('. '))
    prompt = prompt.replace(
      'Chỉ trả về ảnh kết quả, không chèn chữ phụ.',
      `THÔNG TIN BỔ SUNG TRÊN NHÃN: "${extraEn}". Hiển thị rõ ràng, dễ đọc. Chỉ trả về ảnh kết quả, không chèn chữ phụ.`
    )
  }

  if (backgroundType && backgroundType !== 'ai') {
    const bgMap: Record<string, string> = {
      white: 'Nền trắng.',
      offwhite: 'Nền trắng ngà.',
      cream: 'Nền kem.',
      beige: 'Nền be.',
      lightgray: 'Nền xám nhạt.',
      lightblue: 'Nền xanh nhạt.',
      mint: 'Nền bạc hà.',
      lightpink: 'Nền hồng pastel.',
      lavender: 'Nền oải hương.',
    }
    const bgEn = bgMap[backgroundType] ? await normalizeToEnglish(bgMap[backgroundType]) : ''
    if (bgEn) prompt = prompt.replace('Chỉ trả về ảnh kết quả', `${bgEn} Chỉ trả về ảnh kết quả`)
  }

  if (hasBorder) {
    const borderMap: Record<string, string> = {
      single: 'Viền đơn, gọn gàng.',
      double: 'Viền đôi.',
      dotted: 'Viền chấm.',
      dashed: 'Viền nét đứt.',
      rounded: 'Viền bo góc.',
      decorative: 'Viền trang trí.',
    }
    const borderEn = borderMap[borderStyle] ? await normalizeToEnglish(borderMap[borderStyle]) : ''
    if (borderEn) prompt = prompt.replace('Chỉ trả về ảnh kết quả', `${borderEn} Chỉ trả về ảnh kết quả`)
  }

  const COST = LABEL_COSTS[imageQuality]

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/label_${timestamp}_0.png`
  let labelOriginalPublicUrl: string
  if (images.length > 0) {
    const { publicUrl } = await uploadTryOnImagePublic(supabase, path, images[0], {
      contentType: images[0].type || 'image/png',
    })
    labelOriginalPublicUrl = publicUrl
  } else {
    const placeholderPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const { publicUrl } = await uploadTryOnImagePublic(supabase, path, placeholderPng, { contentType: 'image/png' })
    labelOriginalPublicUrl = publicUrl
  }
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: labelOriginalPublicUrl,
    garment_image_url: labelOriginalPublicUrl,
    status: 'processing',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

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

  const productImageParts = await Promise.all(
    images.map(async (img) => ({
      inlineData: { data: Buffer.from(await img.arrayBuffer()).toString('base64'), mimeType: img.type },
    }))
  )
  const referenceImagePart = hasReferenceImage && referenceImageFile
    ? { inlineData: { data: Buffer.from(await referenceImageFile.arrayBuffer()).toString('base64'), mimeType: referenceImageFile.type || 'image/png' } }
    : null
  const logoPart = hasLogo && logo
    ? { inlineData: { data: Buffer.from(await logo.arrayBuffer()).toString('base64'), mimeType: logo.type } }
    : null
  const contentParts: object[] = [{ text: prompt }]
  if (referenceImagePart) contentParts.push(referenceImagePart)
  contentParts.push(...productImageParts)
  if (logoPart) contentParts.push(logoPart)

  try {
    const result = await model.generateContent(contentParts as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-nhan-gioi-thieu-san-pham', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/label_${Date.now()}.png`
    const { publicUrl: labelResultPublicUrl } = await uploadTryOnImagePublic(adminSupabase, resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: labelResultPublicUrl, status: 'completed', feature: 'tao-nhan-gioi-thieu-san-pham', aspect_ratio: aspectRatio }).eq('id', historyItem.id)

    revalidatePath('/tao-nhan-gioi-thieu-san-pham')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: labelResultPublicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo nhãn thất bại: ${msg}` }
  }
}

const MOCKUP_PROMPT = `Tạo mockup 3D chuyên nghiệp với HAI ảnh đầu vào.
- ẢNH 1: ảnh sản phẩm (chai, cốc, hộp, túi...).
- ẢNH 2: nhãn/logo in lên bề mặt sản phẩm.

Nhiệm vụ: đặt nhãn từ ẢNH 2 lên sản phẩm ở ẢNH 1. Nhãn phải bám đúng bề mặt, tỷ lệ tự nhiên, ánh sáng và phối cảnh 3D chân thực. Kết quả giống ảnh mockup sản phẩm thật. Chỉ trả về ảnh kết quả, không chèn chữ.`

/** Tạo mockup nhãn lên sản phẩm. Ảnh 1 = sản phẩm, Ảnh 2 = nhãn vừa thiết kế. 1,5–3 credit. */
export async function createLabelMockupOnProduct(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const labelImageUrl = (formData.get('labelImageUrl') as string)?.trim() || ''
  const productImage = formData.get('productImage') as File | null
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'

  if (!labelImageUrl || !/^https?:\/\//i.test(labelImageUrl)) {
    return { error: 'URL nhãn không hợp lệ.' }
  }
  if (!productImage || productImage.size === 0) {
    return { error: 'Cần tải ảnh sản phẩm để xem mockup.' }
  }

  const COST = MOCKUP_COSTS[imageQuality]
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.` }
  }

  let labelBuffer: Buffer
  try {
    const res = await fetch(labelImageUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const arr = await res.arrayBuffer()
    labelBuffer = Buffer.from(arr)
  } catch {
    return { error: 'Không tải được ảnh nhãn. Vui lòng thử lại.' }
  }

  const productBuffer = Buffer.from(await productImage.arrayBuffer())
  const productImagePart = { inlineData: { data: productBuffer.toString('base64'), mimeType: productImage.type } }
  const labelImagePart = { inlineData: { data: labelBuffer.toString('base64'), mimeType: 'image/png' } }

  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: labelImageUrl,
    garment_image_url: labelImageUrl,
    status: 'processing',
  }).select().single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: { imageSize: imageQuality },
    },
  })
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const genResult = await model.generateContent(
      [MOCKUP_PROMPT, productImagePart, labelImagePart],
      { safetySettings }
    )
    const response = genResult.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'tao-nhan-gioi-thieu-san-pham-mockup', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
    const resultPath = `results/${user.id}/label_mockup_${Date.now()}.png`
    const { publicUrl: mockupResultPublicUrl } = await uploadTryOnImagePublic(adminSupabase, resultPath, resultBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits để hoàn tất.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: mockupResultPublicUrl, status: 'completed', feature: 'tao-nhan-gioi-thieu-san-pham-mockup' }).eq('id', historyItem.id)

    revalidatePath('/tao-nhan-gioi-thieu-san-pham')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: mockupResultPublicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Tạo mockup thất bại: ${msg}` }
  }
}
