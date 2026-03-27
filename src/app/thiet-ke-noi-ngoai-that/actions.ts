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
const INTERIOR_AI_TIMEOUT_MS = Number(process.env.INTERIOR_AI_TIMEOUT_MS || 90_000)
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    }),
  ])
}

const ANALYZE_PROMPT = `Bạn là chuyên gia nội thất và kiến trúc. Hãy phân tích ảnh và trả về JSON thuần (không markdown). Mọi giá trị văn bản trong JSON PHẢI là tiếng Việt.

Bước 1 - Xác định loại không gian:
  - "interior" = nội thất trong nhà
  - "exterior-facade" = mặt tiền công trình
  - "exterior-landscape" = ngoại thất sân vườn/sân bãi/cảnh quan

Bước 2 - Nếu là interior: xác định roomType bằng tiếng Việt (phòng khách, phòng ngủ, bếp, phòng tắm, văn phòng, phòng ăn, hành lang...). Nếu là exterior thì để trống.

Bước 3 - Xác định lighting bằng tiếng Việt: "sáng" | "tối" | "tự nhiên" | "nhân tạo" | "hoàng hôn".

Bước 4 - Liệt kê TẤT CẢ đối tượng gồm KẾT CẤU và NỘI THẤT. Mỗi đối tượng có: item, color, material, status, position, structural.
  - structural=true: phần kết cấu cố định (tường, cột, dầm, sàn, trần, cửa, cửa sổ, nền sân...)
  - structural=false: phần có thể thay đổi (bàn ghế, sofa, tủ, cây, tiểu cảnh...)
  - Bắt buộc đặt tên kết cấu cụ thể để tránh hiểu sai (ví dụ: "cửa phòng ngủ", "cửa sổ bên trái", "tường chịu lực bên phải"...)

Bước 5 - Nếu là interior: trả thêm dominantColor và fengShuiSuggestion bằng tiếng Việt.

Bước 6 - Nếu là interior: bắt buộc có layoutGuidance ngắn gọn để điều hướng thiết kế.

Định dạng JSON:
{"type":"interior"|"exterior-facade"|"exterior-landscape","roomType":"...","lighting":"...","dominantColor":"...","fengShuiSuggestion":"...","layoutGuidance":"...","objects":[{"item":"...","color":"...","material":"...","status":"...","position":"...","structural":true|false}]}`

export type ApplyInteriorChangesResult =
  | { error: string }
  | { success: true; resultUrl: string; resultUrls: string[] }

/** Áp dụng thay đổi: xóa món chọn, thay đổi món chọn theo phong cách. 1,5–3 credits. */
export async function applyInteriorChanges(formData: FormData): Promise<ApplyInteriorChangesResult> {
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

  const deleteList = !isRotationOnly && !isExpandExteriorDown && itemsToDelete.length ? `XÓA hoàn toàn các món này tại ĐÚNG vị trí hiện tại (chỉ xóa, không thêm món khác, không di chuyển món khác): ${itemsToDelete.join(', ')}.` : ''
  const replaceParts = !isRotationOnly && !isExpandExteriorDown
    ? await Promise.all(itemsToReplace.filter((x) => x.item).map(async (x) => {
        const replaceWith = x.replaceWith?.trim()
        const replaceWithEn = replaceWith ? await normalizeToEnglish(replaceWith) : ''
        if (replaceWithEn) {
          return `THAY "${x.item}" bằng "${replaceWithEn}" tại ĐÚNG CÙNG vị trí - xóa hẳn món cũ và đặt món mới vào đúng chỗ đó. Không được chuyển sang vị trí khác.`
        }
        return `THAY "${x.item}" bằng một "${x.item}" khác (cùng loại nhưng khác món) tại ĐÚNG CÙNG vị trí - xóa món cũ và đặt món mới cùng loại vào đúng chỗ đó.`
      }))
    : []
  const rearrangeParts = !isRotationOnly && !isExpandExteriorDown
    ? await Promise.all(itemsToRearrange.filter((x) => x.item && x.rearrangePrompt).map(async (x) => {
        const promptEn = await normalizeToEnglish(x.rearrangePrompt)
        return `CHỈNH SỬA "${x.item}" tại ĐÚNG vị trí hiện tại - giữ nguyên món đó ở đúng chỗ, áp dụng thay đổi sau: ${promptEn}. Không xóa và không di chuyển món.`
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
  const noBlockDoors = 'QUAN TRỌNG: KHÔNG đặt nội thất che cửa hoặc lối đi - phải giữ đường lưu thông thông thoáng.'
  const noBlockViews = 'QUAN TRỌNG: KHÔNG che cửa sổ, cửa kính hoặc khoảng mở nhìn ra ngoài - phải giữ thoáng tầm nhìn và ánh sáng tự nhiên.'
  const noModifyStructure = 'QUAN TRỌNG: KHÔNG thay đổi kết cấu - không khoan/cắt tường, không làm tủ âm tường mới, không thêm tường/vách mới. Giữ nguyên tường, cửa đi, cửa sổ hiện có.'
  const addPart = !isRotationOnly && !isExpandExteriorDown && addPartEn ? `THÊM món mới: "${addPartEn}".` : ''
  const layoutNote = layoutGuidance ? ` BỐ CỤC (phải theo): ${layoutGuidance}` : ''
  const keepPart = !isRotationOnly && !isExpandExteriorDown ? `Giữ nguyên toàn bộ món còn lại như ảnh gốc - cùng vị trí, cùng ngoại quan. Giữ nguyên kết cấu (tường, cột, dầm, sàn, trần, cửa đi, cửa sổ) - không xóa, không thiết kế lại kết cấu, không khoan đục, không thêm tường/vách. Mọi thao tác xóa/thay chỉ thực hiện đúng vị trí chỉ định; không được dời món khác. ${noBlockDoors} ${noBlockViews} ${noModifyStructure}${layoutNote}` : ''
  const scope = spaceType === 'exterior-facade'
    ? 'Ngoại thất mặt tiền công trình - tường, mái, cửa sổ, cửa đi, vật liệu. Giữ NGUYÊN kết cấu hiện có - không khoan tường, không thêm tường mới.'
    : spaceType === 'exterior-landscape'
    ? 'Ngoại thất sân vườn - nền, cây xanh, lối đi, tiểu cảnh nước. Ánh sáng ban ngày tự nhiên.'
    : 'Không gian nội thất trong nhà'
  const rotationPart = isRotationOnly
    ? {
        left: 'Ảnh 1 là ảnh CHÍNH - giữ mức độ hoàn thiện đầy đủ (vật liệu, hoàn thiện, chất lượng, chi tiết). Ảnh 2 chỉ là ảnh tham chiếu KẾT CẤU - chỉ dùng bổ sung bố cục/kết cấu. Giữ tường và vách ĐÚNG như Ảnh 1 - không thêm, không bớt tường. Kết quả phải có mức độ hoàn thiện tương đương Ảnh 1. Tạo góc nhìn xoay 30 độ sang TRÁI. Không chữ.',
        right: 'Ảnh 1 là ảnh CHÍNH - giữ mức độ hoàn thiện đầy đủ (vật liệu, hoàn thiện, chất lượng, chi tiết). Ảnh 2 chỉ là ảnh tham chiếu KẾT CẤU - chỉ dùng bổ sung bố cục/kết cấu. Giữ tường và vách ĐÚNG như Ảnh 1 - không thêm, không bớt tường. Kết quả phải có mức độ hoàn thiện tương đương Ảnh 1. Tạo góc nhìn xoay 30 độ sang PHẢI. Không chữ.',
        up: 'Ảnh 1 là ảnh CHÍNH - giữ mức độ hoàn thiện đầy đủ (vật liệu, hoàn thiện, chất lượng, chi tiết). Ảnh 2 chỉ là ảnh tham chiếu KẾT CẤU - chỉ dùng bổ sung bố cục/kết cấu. Giữ tường và vách ĐÚNG như Ảnh 1 - không thêm, không bớt tường. Kết quả phải có mức độ hoàn thiện tương đương Ảnh 1. Tạo góc nhìn ngẩng lên 30 độ. Không chữ.',
        down: 'Ảnh 1 là ảnh CHÍNH - giữ mức độ hoàn thiện đầy đủ (vật liệu, hoàn thiện, chất lượng, chi tiết). Ảnh 2 chỉ là ảnh tham chiếu KẾT CẤU - chỉ dùng bổ sung bố cục/kết cấu. Giữ tường và vách ĐÚNG như Ảnh 1 - không thêm, không bớt tường. Kết quả phải có mức độ hoàn thiện tương đương Ảnh 1. Tạo góc nhìn hạ xuống 30 độ. Không chữ.',
      }[rotationDirection] || ''
    : ''
  const expandExteriorPart = isExpandExteriorDown
    ? `Mở rộng ảnh ngoại thất này ĐỀU ra bốn phía (trái, phải, trên, dưới). Bổ sung nền đất, sân vườn, thảm cỏ, cảnh quan xung quanh công trình. Giữ nguyên công trình/mặt tiền như ảnh gốc. Nội dung mới phải nối liền mạch ở mọi biên. Mở rộng đồng đều các hướng.${addPartEn ? ` THÊM vào vùng mở rộng: "${addPartEn}".` : ''} Cảnh ngoài trời chân thực, không chữ.`
    : ''
  const themePart = !isRotationOnly && !isExpandExteriorDown && spaceType === 'exterior-facade' && archTheme
    ? ` Áp dụng chủ đề kiến trúc ${ARCH_THEMES[archTheme.toLowerCase()] || archTheme} cho công trình/mặt tiền.`
    : ''
  const mainColorDesc = !isRotationOnly && !isExpandExteriorDown && mainColor ? (MAIN_COLORS[mainColor.toLowerCase()] || mainColor) : ''
  const secondaryColorDesc = !isRotationOnly && !isExpandExteriorDown && secondaryColor ? (MAIN_COLORS[secondaryColor.toLowerCase()] || secondaryColor) : ''
  const colorPart =
    mainColorDesc || secondaryColorDesc
      ? ` Bảng màu: màu chủ đạo ${mainColorDesc || 'linh hoạt'}, màu nhấn/phụ ${secondaryColorDesc || 'linh hoạt'}.`
      : ''
  const timePart = !isRotationOnly && !isExpandExteriorDown && timeOfDay
    ? { 'ban-ngay': 'Ánh sáng ban ngày rõ, nắng tự nhiên.', 'hoang-hon': 'Ánh sáng hoàng hôn ấm (golden hour).', 'dem': 'Bối cảnh ban đêm, ánh sáng nhân tạo ấm, cảm giác ấm cúng.' }[timeOfDay] || `Ánh sáng: ${timeOfDay}.`
    : ''
  const customFurnitureParts = !isRotationOnly && !isExpandExteriorDown && furnitureStagingMode === 'custom' && customFurnitureSelection.length > 0
    ? customFurnitureSelection.map(buildFurnitureDesc).filter(Boolean)
    : []
  const furniturePart = customFurnitureParts.length > 0
    ? ` Nội thất: bao gồm các món sau: ${customFurnitureParts.join(', ')}.`
    : roomType && ROOM_STAGING_PROMPTS[roomType]
    ? ` Nội thất: ${ROOM_STAGING_PROMPTS[roomType]}`
    : ''
  const stagingPart = !isRotationOnly && !isExpandExteriorDown && roomType && ROOM_STAGING_PROMPTS[roomType] && customFurnitureParts.length === 0
    ? ` Dàn dựng: ${ROOM_STAGING_PROMPTS[roomType]} Áp dụng đúng phong cách đã chọn.`
    : customFurnitureParts.length > 0
    ? ` Dàn dựng: bao gồm các món sau: ${customFurnitureParts.join(', ')}. Áp dụng đúng phong cách đã chọn.`
    : ''
  const refNote = !isRotationOnly && !isExpandExteriorDown && referenceImage ? ' Áp dụng phong cách, màu sắc và cảm xúc từ ảnh tham chiếu cho không gian này.' : ''
  const cleanNote = 'Xóa chữ. Trả về một ảnh chân thực duy nhất, không chèn chữ.'
  const fullRedesignPrompt = isFullRedesign
    ? `${scope} - Xem như không gian TRỐNG (chỉ còn tường, sàn, trần, cửa sổ, cửa đi). BỎ QUA nội thất hiện có, thiết kế lại từ đầu. Giữ NGUYÊN kết cấu - không khoan tường, không thêm tường/vách mới. Phong cách: ${INTERIOR_STYLES[defaultStyle] || defaultStyle}.${furniturePart}${furniturePart ? '. ' : ''}${mainColorDesc || secondaryColorDesc ? ` Màu sắc: chủ đạo ${mainColorDesc || 'linh hoạt'}, nhấn ${secondaryColorDesc || 'linh hoạt'}.` : ''}${timePart ? ` ${timePart}` : ''}${archTheme && spaceType === 'exterior-facade' ? ` Chủ đề: ${ARCH_THEMES[archTheme.toLowerCase()] || archTheme}.` : ''}${refNote}${addPartEn ? ` Thêm: ${addPartEn}.` : ''} ${noBlockDoors} ${noBlockViews} ${noModifyStructure}${layoutNote} Phong cách ảnh chân thực. ${cleanNote}`
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
  const contentParts: Array<{ text?: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: basePrompt }]
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
      const genResult = await model.generateContent(contentParts as never, { safetySettings } as never)
      const response = genResult.response
      trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-noi-ngoai-that', user.id, imageQuality)
      const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
      if (!imagePartRes || !('inlineData' in imagePartRes)) {
        if (resultUrls.length === 0) {
          await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
          return { error: 'AI không trả về ảnh hợp lệ.' }
        }
        break
      }
      const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
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
  cleanup: `Dọn dẹp không gian nội thất: vẫn là cùng căn phòng, sạch sẽ và gọn gàng hơn. Giữ nguyên đồ nội thất và bố cục hiện có. QUAN TRỌNG: không đặt đồ chặn cửa hoặc lối đi. Xóa mọi chữ trên ảnh. Trả về một ảnh chân thực duy nhất, không chữ.`,
  redesign: `Thiết kế lại nội thất: giữ nguyên bố cục và vị trí đồ đạc, CHỈ thay đổi màu sắc/chất liệu/bề mặt hoàn thiện. QUAN TRỌNG: không đặt đồ chặn cửa hoặc lối đi. Xóa mọi chữ trên ảnh. Trả về một ảnh chân thực duy nhất, không chữ.`,
  staging: `Dàn dựng không gian trống: xóa TOÀN BỘ nội thất và đồ trang trí. Chỉ giữ: sàn trống, tường, cửa sổ, trần, cửa đi. Ánh sáng tự nhiên, sạch. Xóa chữ. Trả về một ảnh chân thực duy nhất, không chữ.`,
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
    console.info('[interior-analyze] started', { userId: user.id, timeoutMs: INTERIOR_AI_TIMEOUT_MS })
    const result = await withTimeout(
      model.generateContent([ANALYZE_PROMPT, imagePart] as never, { safetySettings } as never),
      INTERIOR_AI_TIMEOUT_MS,
      `AI timeout after ${Math.round(INTERIOR_AI_TIMEOUT_MS / 1000)}s`
    )
    trackFromUsageMetadata(result.response.usageMetadata, 'gemini-3-flash-preview', 'thiet-ke-noi-ngoai-that-analyze', user.id)
    const text = result.response.text?.() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const analysisJson = jsonMatch ? jsonMatch[0] : text

    const { data: latestCredit } = await adminSupabase.from('credits').select('balance').eq('user_id', user.id).single()
    if (!latestCredit || toTenths(latestCredit.balance) < toTenths(ANALYZE_COST)) return { error: 'Không đủ credits.' }
    const newBalance = fromTenths(toTenths(latestCredit.balance) - toTenths(ANALYZE_COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

    revalidatePath('/thiet-ke-noi-ngoai-that')
    console.info('[interior-analyze] completed', { userId: user.id })
    return { success: true, analysis: analysisJson }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[interior-analyze] failed', { userId: user.id, error: msg })
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
    const result = await model.generateContent([prompt, imagePart] as never, { safetySettings } as never)
    const response = result.response
    trackFromUsageMetadata(response.usageMetadata, 'gemini-3-pro-image-preview', 'thiet-ke-noi-ngoai-that-process', user.id, imageQuality)
    const imagePartRes = response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
    if (!imagePartRes || !('inlineData' in imagePartRes)) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không trả về ảnh hợp lệ.' }
    }
    const resultBuffer = Buffer.from((imagePartRes as { inlineData: { data: string } }).inlineData.data, 'base64')
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
