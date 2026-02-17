'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

import { APPLY_COSTS, ANALYZE_CREDIT, ARCH_THEMES, MAIN_COLORS, INTERIOR_STYLES, ROOM_STAGING_PROMPTS, FURNITURE_ITEMS, EXTERIOR_FURNITURE_ITEMS, FURNITURE_MATERIALS, FURNITURE_COLORS, FURNITURE_STYLE_OPTIONS, EXTERIOR_POSITION_OPTIONS, POOL_SHAPE_OPTIONS, POOL_ORIENTATION_OPTIONS } from './constants'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const IMAGE_COSTS = APPLY_COSTS
const ANALYZE_COST = ANALYZE_CREDIT
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const ANALYZE_PROMPT = `You are an interior design and architecture expert. Analyze this image and return pure JSON (no markdown). All text values in the JSON MUST be in Vietnamese.

Step 1 - Identify type:
  - "interior" = nội thất (phòng trong nhà)
  - "exterior-facade" = mặt tiền nhà (chủ yếu tường, mái, cửa, ban công – không có khoảng sân/vườn rõ ràng)
  - "exterior-landscape" = sân vườn, khoảng sân, sân bê tông, sân, vườn (có mặt đất, nền bê tông, cây xanh, thảm cỏ, lối đi, hồ nước, tiểu cảnh, sân trước/sau, sân thượng...). Nếu ảnh có sân bê tông hoặc khoảng sân → dùng "exterior-landscape".

Step 2 - If interior: Identify roomType in Vietnamese (phòng khách, phòng ngủ, bếp, phòng tắm, văn phòng, phòng ăn, hành lang...). If exterior: skip.

Step 3 - Lighting (lighting) in Vietnamese: "sáng" | "tối" | "tự nhiên" | "nhân tạo" | "hoàng hôn".

Step 4 - List ALL objects including STRUCTURE and FURNITURE. Each has item, color, material, status (New/Good/Worn/Old), position, structural (boolean). item, color, material, position must be in Vietnamese.
  - structural: true = kết cấu cố định: tường, cột, dầm, sàn, trần, cửa, cửa sổ, cửa đi, khoảng sân, sân bê tông, nền sân bê tông, lối đi bê tông...
  - structural: false = đồ có thể thay đổi: bàn, ghế, sofa, tủ, tranh, đèn (nội thất); cây xanh, thảm cỏ, chậu cảnh, hồ nước, tiểu cảnh (sân vườn)...
  - CRITICAL - Phải đặt tên CỤ THỂ cho kết cấu để AI thiết kế biết tránh sai:
    • Cửa: "cửa nhà vệ sinh", "cửa phòng ngủ", "cửa chính", "cửa đi ra ban công", "cửa đi ra sân", "cửa đi ra vườn", "cửa bếp" (KHÔNG chỉ "cửa")
    • Cửa sổ: "cửa sổ phòng khách", "cửa sổ bên trái" (KHÔNG chỉ "cửa sổ")
    • Tường: "tường ngăn phòng bếp", "tường nhà vệ sinh", "tường chịu lực bên trái" – phân biệt tường ngăn (mỏng, có thể có tủ âm) vs tường chịu lực (dày, không đục)
    • Sân ngoài trời: BẮT BUỘC nhận diện "sân bê tông" hoặc "nền sân bê tông" nếu ảnh có khoảng sân lát bê tông (dù trống hay có đồ). VD: item="sân bê tông", material="bê tông", position="giữa sân", structural=true
  - Duplicate items: Nếu nhiều vật giống nhau, tách riêng với vị trí khác nhau. VD: "cây bàng 1 - bên trái", "cây bàng 2 - bên phải".

Step 5 - If interior: dominantColor, fengShuiSuggestion in Vietnamese.

Step 6 - layoutGuidance (bắt buộc nếu interior): Chuỗi ngắn hướng dẫn AI thiết kế, VD: "Không đặt đồ chắn cửa nhà vệ sinh bên trái. Tường ngăn phòng bên phải là tường mỏng - không vẽ tủ âm vào. Cửa chính ở giữa - giữ lối đi thông thoáng."

JSON format: {"type":"interior"|"exterior-facade"|"exterior-landscape","roomType":"...","lighting":"...","dominantColor":"...","fengShuiSuggestion":"...","layoutGuidance":"...","objects":[{"item":"...","color":"...","material":"...","status":"...","position":"...","structural":true|false}]}`

/** Áp dụng thay đổi: xóa món chọn, thay đổi món chọn theo phong cách. 1,5–3 credits. */
export async function applyInteriorChanges(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const imageInput = formData.get('image') as File | string
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const itemsToDelete = JSON.parse((formData.get('itemsToDelete') as string) || '[]') as string[]
  const itemsToReplaceRaw = JSON.parse((formData.get('itemsToReplace') as string) || '[]')
  const itemsToReplace = Array.isArray(itemsToReplaceRaw)
    ? itemsToReplaceRaw.map((x: unknown) => {
        if (typeof x === 'string') return { item: x, replaceWith: '' }
        const obj = x as { item?: string; replaceWith?: string }
        return { item: obj.item ?? '', replaceWith: obj.replaceWith?.trim() || '' }
      })
    : []
  const itemsToRearrangeRaw = JSON.parse((formData.get('itemsToRearrange') as string) || '[]')
  const itemsToRearrange = Array.isArray(itemsToRearrangeRaw)
    ? itemsToRearrangeRaw.map((x: unknown) => {
        if (typeof x === 'string') return { item: x, rearrangePrompt: '' }
        const obj = x as { item?: string; rearrangePrompt?: string }
        return { item: obj.item ?? '', rearrangePrompt: obj.rearrangePrompt?.trim() || '' }
      })
    : []
  const defaultStyle = (formData.get('style') as string)?.trim() || 'hiện đại'
  const addItemsPrompt = (formData.get('addItemsPrompt') as string)?.trim() || ''
  const spaceTypeRaw = (formData.get('spaceType') as string)?.trim() || 'interior'
  const spaceType = (spaceTypeRaw === 'exterior' ? 'exterior-facade' : spaceTypeRaw) as 'interior' | 'exterior-facade' | 'exterior-landscape'
  const archTheme = (formData.get('archTheme') as string)?.trim() || ''
  const mainColor = (formData.get('mainColor') as string)?.trim() || ''
  const secondaryColor = (formData.get('secondaryColor') as string)?.trim() || ''
  const timeOfDay = (formData.get('timeOfDay') as string)?.trim() || ''
  const roomType = (formData.get('roomType') as string)?.trim() || ''
  const furnitureStagingMode = (formData.get('furnitureStagingMode') as string)?.trim() || 'ai'
  const customFurnitureSelectionRaw = (formData.get('customFurnitureSelection') as string)?.trim() || '[]'
  const customFurnitureSelection = (() => {
    try {
      const arr = JSON.parse(customFurnitureSelectionRaw) as { id: string; material?: string; color?: string; style?: string; position?: string; shape?: string; orientation?: string }[]
      return Array.isArray(arr) ? arr.filter((x) => x?.id) : []
    } catch {
      return []
    }
  })()
  const customFurnitureForAddRaw = (formData.get('customFurnitureForAdd') as string)?.trim() || '[]'
  const customFurnitureForAdd = (() => {
    try {
      const arr = JSON.parse(customFurnitureForAddRaw) as { id: string; material?: string; color?: string; style?: string; position?: string; shape?: string; orientation?: string }[]
      return Array.isArray(arr) ? arr.filter((x) => x?.id) : []
    } catch {
      return []
    }
  })()
  const variantCount = Math.min(Math.max(parseInt((formData.get('variantCount') as string) || '1', 10) || 1, 1), 3)
  const referenceImage = formData.get('referenceImage') as File | null
  const rotationDirection = (formData.get('rotationDirection') as string)?.trim() || ''
  const rotationReferenceImage = formData.get('rotationReferenceImage') as File | null
  const expandExteriorDown = (formData.get('expandExteriorDown') as string)?.trim() || ''
  const layoutGuidance = (formData.get('layoutGuidance') as string)?.trim() || ''
  const isFullRedesign = (formData.get('mode') as string) === 'full'
  if (!imageInput) return { error: 'Cần ảnh không gian cần thiết kế.' }

  if (typeof imageInput === 'string' && imageInput.startsWith('blob:')) {
    return { error: 'Ảnh từ trình duyệt không thể dùng. Vui lòng tải ảnh lên lại hoặc chọn "Phân tích lại".' }
  }

  let imageBuffer: Buffer
  let mimeType = 'image/png'
  if (typeof imageInput === 'string') {
    const res = await fetch(imageInput)
    if (!res.ok) return { error: 'Không tải được ảnh.' }
    const ab = await res.arrayBuffer()
    imageBuffer = Buffer.from(ab)
    mimeType = res.headers.get('content-type') || 'image/png'
  } else {
    imageBuffer = Buffer.from(await imageInput.arrayBuffer())
    mimeType = imageInput.type
  }

  const isRotationOnly = !!rotationDirection && ['left', 'right', 'up', 'down'].includes(rotationDirection)
  const hasRotationReference = !!(rotationReferenceImage && rotationReferenceImage.size > 0)
  if (isRotationOnly && !hasRotationReference) return { error: 'Quay góc bắt buộc có ảnh tham chiếu. Vui lòng chọn ảnh góc tham chiếu.' }
  const isExpandExteriorDown = !!expandExteriorDown && spaceType === 'exterior-landscape'

  const deleteList = !isRotationOnly && !isExpandExteriorDown && itemsToDelete.length ? `REMOVE these items completely at their EXACT positions (delete, do not add anything, do not move other items): ${itemsToDelete.join(', ')}.` : ''
  const replaceParts = !isRotationOnly && !isExpandExteriorDown
    ? await Promise.all(itemsToReplace.filter((x) => x.item).map(async (x) => {
        const replaceWith = x.replaceWith?.trim()
        const replaceWithEn = replaceWith ? await normalizeToEnglish(replaceWith) : ''
        if (replaceWithEn) {
          return `REPLACE "${x.item}" with "${replaceWithEn}" at the EXACT SAME position – remove the original item completely and put the new item in its exact place. Do not move to another location.`
        }
        return `REPLACE "${x.item}" with another "${x.item}" (same type, different one) at the EXACT SAME position – remove the original and put a different item of the same type in its exact place.`
      }))
    : []
  const rearrangeParts = !isRotationOnly && !isExpandExteriorDown
    ? await Promise.all(itemsToRearrange.filter((x) => x.item && x.rearrangePrompt).map(async (x) => {
        const promptEn = await normalizeToEnglish(x.rearrangePrompt)
        return `MODIFY "${x.item}" at its EXACT position – keep the same item in place but apply these changes: ${promptEn}. Do not remove or move the item.`
      }))
    : []
  const replaceList = !isRotationOnly && !isExpandExteriorDown && replaceParts.length ? replaceParts.join(' ') : ''
  const rearrangeList = !isRotationOnly && !isExpandExteriorDown && rearrangeParts.length ? rearrangeParts.join(' ') : ''
  const furnitureItemsList = spaceType === 'exterior-landscape' ? EXTERIOR_FURNITURE_ITEMS : FURNITURE_ITEMS
  const buildFurnitureDesc = (sel: { id: string; material?: string; color?: string; style?: string; position?: string; shape?: string; orientation?: string }) => {
    const item = furnitureItemsList.find((f) => f.id === sel.id)
    if (!item) return ''
    const selType = (item as { selectionType?: string })?.selectionType ?? 'material'
    const itemEn = item?.promptEn || sel.id
    const parts: string[] = []
    if (spaceType === 'exterior-landscape' && sel.position) {
      const pos = EXTERIOR_POSITION_OPTIONS.find((p) => p.value === sel.position)
      if (pos?.promptEn) parts.push(pos.promptEn)
    }
    if (sel.id === 'be-boi') {
      if (sel.shape) {
        const sh = POOL_SHAPE_OPTIONS.find((p) => p.value === sel.shape)
        if (sh?.promptEn) parts.push(sh.promptEn)
      }
      if (sel.orientation) {
        const or = POOL_ORIENTATION_OPTIONS.find((p) => p.value === sel.orientation)
        if (or?.promptEn) parts.push(or.promptEn)
      }
    }
    if (selType === 'style') {
      const sty = sel.style ? FURNITURE_STYLE_OPTIONS.find((s) => s.value === sel.style) : null
      if (sty?.promptEn) parts.push(sty.promptEn)
    }
    if (selType === 'material') {
      const mat = sel.material ? FURNITURE_MATERIALS.find((m) => m.value === sel.material) : null
      const col = sel.color ? FURNITURE_COLORS.find((c) => c.value === sel.color) : null
      if (mat?.promptEn) parts.push(mat.promptEn)
      if (col?.promptEn) parts.push(col.promptEn)
    }
    return parts.length ? `${itemEn} (${parts.join(', ')})` : itemEn
  }
  const addItemsFromList = !isRotationOnly && !isExpandExteriorDown && customFurnitureForAdd.length > 0
    ? customFurnitureForAdd.map(buildFurnitureDesc).filter(Boolean).join(', ')
    : ''
  const addItemsCombined = [addItemsFromList, addItemsPrompt].filter(Boolean).join('; ')
  const addPartEn = addItemsCombined ? await normalizeToEnglish(addItemsCombined) : ''
  const noBlockDoors = 'CRITICAL: NEVER place furniture in front of doors or passageways – keep all access paths clear.'
  const noBlockViews = 'CRITICAL: NEVER block or cover windows, glass doors, or open spaces that allow viewing outside – keep all views and natural light openings clear.'
  const noModifyStructure = 'CRITICAL: Do NOT modify structure – no drilling into walls, no cutting walls, no built-in cabinets into walls. Do NOT add new walls or partitions. Keep existing walls, doors, windows exactly as they are.'
  const addPart = !isRotationOnly && !isExpandExteriorDown && addPartEn ? `ADD new items: "${addPartEn}".` : ''
  const layoutNote = layoutGuidance ? ` LAYOUT (follow): ${layoutGuidance}` : ''
  const keepPart = !isRotationOnly && !isExpandExteriorDown ? `Keep all other items exactly as in the original – same position, same appearance. Preserve structural elements (walls, columns, beams, floor, ceiling, doors, windows) – never remove, redesign, drill into, or add new walls/partitions. Execute delete/replace at their exact positions only; do not relocate other items. ${noBlockDoors} ${noBlockViews} ${noModifyStructure}${layoutNote}` : ''
  const scope = spaceType === 'exterior-facade'
    ? 'Exterior building facade – walls, roof, windows, doors, materials. Keep the SAME structure – do NOT drill into walls, do NOT add new walls.'
    : spaceType === 'exterior-landscape'
    ? 'Exterior landscape/garden – ground, plants, paths, water features. Bright daylight, natural sun.'
    : 'Interior/indoor room'
  const rotationPart = isRotationOnly
    ? {
        left: 'Image 1 is the MAIN image – apply its full completion level (materials, finishes, quality, details). Image 2 is only STRUCTURAL reference – use it to supplement structure/layout only. Keep walls and partitions EXACTLY as in Image 1 – do NOT add or remove walls. Output must have the SAME completion level as Image 1. Generate Image 1 rotated 30 degrees to the LEFT. No text.',
        right: 'Image 1 is the MAIN image – apply its full completion level (materials, finishes, quality, details). Image 2 is only STRUCTURAL reference – use it to supplement structure/layout only. Keep walls and partitions EXACTLY as in Image 1 – do NOT add or remove walls. Output must have the SAME completion level as Image 1. Generate Image 1 rotated 30 degrees to the RIGHT. No text.',
        up: 'Image 1 is the MAIN image – apply its full completion level (materials, finishes, quality, details). Image 2 is only STRUCTURAL reference – use it to supplement structure/layout only. Keep walls and partitions EXACTLY as in Image 1 – do NOT add or remove walls. Output must have the SAME completion level as Image 1. Generate Image 1 tilted 30 degrees UP. No text.',
        down: 'Image 1 is the MAIN image – apply its full completion level (materials, finishes, quality, details). Image 2 is only STRUCTURAL reference – use it to supplement structure/layout only. Keep walls and partitions EXACTLY as in Image 1 – do NOT add or remove walls. Output must have the SAME completion level as Image 1. Generate Image 1 tilted 30 degrees DOWN. No text.',
      }[rotationDirection] || ''
    : ''
  const expandExteriorPart = isExpandExteriorDown
    ? `Extend this exterior image EVENLY in all directions (left, right, up, down). Add ground, garden, lawn, landscaping around the building. Keep the building/facade exactly as shown. The new content must seamlessly connect to all edges. Expand evenly in all directions.${addPartEn ? ` ADD to the extended area: "${addPartEn}".` : ''} Photorealistic outdoor scene, no text.`
    : ''
  const themePart = !isRotationOnly && !isExpandExteriorDown && spaceType === 'exterior-facade' && archTheme
    ? ` Apply ${ARCH_THEMES[archTheme.toLowerCase()] || archTheme} architectural theme to the building/facade.`
    : ''
  const mainColorDesc = !isRotationOnly && !isExpandExteriorDown && mainColor ? (MAIN_COLORS[mainColor.toLowerCase()] || mainColor) : ''
  const secondaryColorDesc = !isRotationOnly && !isExpandExteriorDown && secondaryColor ? (MAIN_COLORS[secondaryColor.toLowerCase()] || secondaryColor) : ''
  const colorPart =
    mainColorDesc || secondaryColorDesc
      ? ` Color scheme: main color ${mainColorDesc || 'flexible'}, accent/secondary color ${secondaryColorDesc || 'flexible'}.`
      : ''
  const timePart = !isRotationOnly && !isExpandExteriorDown && timeOfDay
    ? { 'ban-ngay': 'Bright daylight, natural sun.', 'hoang-hon': 'Golden hour, warm sunset light.', 'dem': 'Night, artificial warm lighting, cozy.' }[timeOfDay] || `Lighting: ${timeOfDay}.`
    : ''
  const customFurnitureParts = !isRotationOnly && !isExpandExteriorDown && furnitureStagingMode === 'custom' && customFurnitureSelection.length > 0
    ? customFurnitureSelection.map(buildFurnitureDesc).filter(Boolean)
    : []
  const furniturePart = customFurnitureParts.length > 0
    ? ` Furniture: Include these items: ${customFurnitureParts.join(', ')}.`
    : roomType && ROOM_STAGING_PROMPTS[roomType]
    ? ` Furniture: ${ROOM_STAGING_PROMPTS[roomType]}`
    : ''
  const stagingPart = !isRotationOnly && !isExpandExteriorDown && roomType && ROOM_STAGING_PROMPTS[roomType] && customFurnitureParts.length === 0
    ? ` Staging: ${ROOM_STAGING_PROMPTS[roomType]} Apply the selected style.`
    : customFurnitureParts.length > 0
    ? ` Staging: Include these items: ${customFurnitureParts.join(', ')}. Apply the selected style.`
    : ''
  const refNote = !isRotationOnly && !isExpandExteriorDown && referenceImage ? ' Apply the style, colors, and mood from the reference image to this space.' : ''
  const cleanNote = 'Remove text. Output single realistic photo, no text overlay.'
  const fullRedesignPrompt = isFullRedesign
    ? `${scope} – Treat as EMPTY room (walls, floor, ceiling, windows, doors only). IGNORE any existing furniture – design from scratch. Keep the SAME structure – do NOT drill into walls, do NOT add new walls or partitions. Style: ${INTERIOR_STYLES[defaultStyle] || defaultStyle}.${furniturePart}${furniturePart ? '. ' : ''}${mainColorDesc || secondaryColorDesc ? ` Colors: main ${mainColorDesc || 'flexible'}, accent ${secondaryColorDesc || 'flexible'}.` : ''}${timePart ? ` ${timePart}` : ''}${archTheme && spaceType === 'exterior-facade' ? ` Theme: ${ARCH_THEMES[archTheme.toLowerCase()] || archTheme}.` : ''}${refNote}${addPartEn ? ` Add: ${addPartEn}.` : ''} ${noBlockDoors} ${noBlockViews} ${noModifyStructure}${layoutNote} Photorealistic. ${cleanNote}`
    : ''
  const basePrompt = isFullRedesign
    ? fullRedesignPrompt
    : isRotationOnly
    ? `${scope} ${rotationPart} ${cleanNote}`
    : isExpandExteriorDown
      ? `${scope} ${expandExteriorPart} ${cleanNote}`
      : `${scope} design edit. ${deleteList} ${replaceList} ${rearrangeList} ${addPart} ${keepPart}${themePart}${colorPart} ${timePart}${stagingPart}${refNote} ${cleanNote}`.replace(/\s+/g, ' ').trim()

  const COST_PER_IMAGE = IMAGE_COSTS[imageQuality]
  const actualVariantCount = isRotationOnly || isExpandExteriorDown ? 1 : variantCount
  const COST = COST_PER_IMAGE * actualVariantCount
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/interior_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(path, imageBuffer, { contentType: mimeType })
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(path)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
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
  let contentParts: Array<{ text?: string } | { inlineData: { data: string; mimeType: string } }> = [basePrompt]
  if (isRotationOnly && hasRotationReference) {
    contentParts.push({ inlineData: { data: imageBuffer.toString('base64'), mimeType } })
    const refBuffer = Buffer.from(await rotationReferenceImage.arrayBuffer())
    contentParts.push({ inlineData: { data: refBuffer.toString('base64'), mimeType: rotationReferenceImage.type } })
  } else {
    contentParts.push({ inlineData: { data: imageBuffer.toString('base64'), mimeType } })
  }
  if (!isRotationOnly && referenceImage && referenceImage.size > 0) {
    const refBuffer = Buffer.from(await referenceImage.arrayBuffer())
    contentParts.push({ inlineData: { data: refBuffer.toString('base64'), mimeType: referenceImage.type } })
  }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  const resultUrls: string[] = []
  try {
    for (let i = 0; i < actualVariantCount; i++) {
      const result = await model.generateContent(contentParts, { safetySettings })
      const response = result.response
      trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-noi-ngoai-that', user.id, imageQuality)
      const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
      if (!imagePartRes || !('inlineData' in imagePartRes)) {
        if (resultUrls.length === 0) {
          await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
          return { error: 'AI không trả về ảnh hợp lệ.' }
        }
        break
      }
      const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
      const resultPath = `results/${user.id}/interior_${Date.now()}_${i}.png`
      await adminSupabase.storage.from('try-on-images').upload(resultPath, resultBuffer, { contentType: 'image/png', upsert: true })
      const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)
      resultUrls.push(urlData.publicUrl)
    }
    if (resultUrls.length === 0) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    const actualCost = COST_PER_IMAGE * resultUrls.length
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(actualCost)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(actualCost))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: resultUrls[0], status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/thiet-ke-noi-ngoai-that')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultUrls[0], resultUrls }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) return { error: 'Hệ thống quá tải. Thử lại sau.' }
    return { error: `Xử lý thất bại: ${msg}` }
  }
}

/** Lấy số dư credits của user */
export async function getCredits(): Promise<number> {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return 0
  const { user } = result
  const { data } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  return data?.balance ?? 0
}

const PROMPTS = {
  cleanup: `Interior Design Clean-up: Same room, perfectly tidy and organized. Keep same furniture and layout. CRITICAL: Never place furniture in front of doors or passageways. Remove text. Output single realistic photo. no text.`,
  redesign: `Interior Design Redesign: Same layout and furniture positions, CHANGE colors/materials/finishes only. CRITICAL: Never place furniture in front of doors or passageways. Remove text. Output single realistic photo. no text.`,
  staging: `Virtual Staging: Remove ALL furniture and decor. Leave only: empty floor, walls, windows, ceiling, doors. Clean, natural lighting. Remove text. Output single realistic photo. no text.`,
}


/** Phân tích nội thất - trả về JSON. 0,5 credit. */
export async function analyzeInterior(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const image = formData.get('image') as File
  if (!image || image.size === 0) return { error: 'Cần tải lên ảnh không gian cần thiết kế.' }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(ANALYZE_COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(ANALYZE_COST)} credits.` }
  }

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
    generationConfig: { responseModalities: ['TEXT'] },
  })
  const buffer = Buffer.from(await image.arrayBuffer())
  const imagePart = { inlineData: { data: buffer.toString('base64'), mimeType: image.type } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([ANALYZE_PROMPT, imagePart], { safetySettings })
    trackFromUsageMetadata(result.response.usageMetadata, 'gemini-3-flash-preview', 'thiet-ke-noi-ngoai-that-analyze', user.id)
    const text = result.response.text?.() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const analysisJson = jsonMatch ? jsonMatch[0] : text

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(ANALYZE_COST)) return { error: 'Không đủ credits.' }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(ANALYZE_COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    revalidatePath('/thiet-ke-noi-ngoai-that')
    return { success: true, analysis: analysisJson }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Phân tích thất bại: ${msg}` }
  }
}

/** Dọn dẹp / Đổi phong cách / Virtual Staging - trả về ảnh. */
export async function processInteriorImage(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') return { error: 'Dữ liệu không hợp lệ.' }
  const image = formData.get('image') as File
  const mode = (formData.get('mode') as 'cleanup' | 'redesign' | 'staging') || 'cleanup'
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'
  const note = (formData.get('note') as string)?.trim() || ''
  if (!image || image.size === 0) return { error: 'Cần tải lên ảnh không gian cần thiết kế.' }
  if (!PROMPTS[mode]) return { error: 'Chế độ không hợp lệ.' }

  let prompt = PROMPTS[mode]
  if (note) {
    const noteEn = await normalizeToEnglish(note)
    prompt = prompt.replace('no text.', `STYLE NOTE: "${noteEn}". no text.`)
  }

  const COST = IMAGE_COSTS[imageQuality]
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits.` }
  }

  const timestamp = Date.now()
  const path = `uploads/${user.id}/interior_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(path, image)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(path)
  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({
    user_id: user.id,
    original_image_url: origUrl.publicUrl,
    garment_image_url: origUrl.publicUrl,
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
  const buffer = Buffer.from(await image.arrayBuffer())
  const imagePart = { inlineData: { data: buffer.toString('base64'), mimeType: image.type } }
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]

  try {
    const result = await model.generateContent([prompt, imagePart], { safetySettings })
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-noi-ngoai-that-process', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from(imagePartRes.inlineData.data, 'base64')
    const resultPath = `results/${user.id}/interior_${Date.now()}.png`
    await adminSupabase.storage.from('try-on-images').upload(resultPath, resultBuffer, { contentType: 'image/png', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(COST)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không đủ credits.' }
    }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase.from('try_on_history').update({ result_image_url: urlData.publicUrl, status: 'completed' }).eq('id', historyItem.id)

    revalidatePath('/thiet-ke-noi-ngoai-that')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|Internal error/i.test(msg)) return { error: 'Hệ thống quá tải. Thử lại sau.' }
    return { error: `Xử lý thất bại: ${msg}` }
  }
}
