'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const COSTS = {
  floor_3d: 4,
  floor_plan: 4,
  structural: 4,
} as const

const toTenths = (v: number) => Math.round(v * 10)
const fromTenths = (v: number) => v / 10
const formatCredits = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const SYNTH_PROMPT = `Bạn là chuyên gia kiến trúc. Người dùng cung cấp thông tin nhà bằng tiếng Việt hoặc ngôn ngữ trộn. Nhiệm vụ: chuẩn hóa nội dung thành tiếng Việt rõ ràng, đầy đủ, phù hợp làm prompt tạo ảnh kiến trúc. Chỉ trả về prompt tiếng Việt, không giải thích thêm.`

const HOUSE_3D_PROMPT = `Tạo ảnh phối cảnh kiến trúc 3D chân thực cho mặt tiền nhà ở có sân vườn phía trước. AI được phép tự chọn thành phần sân vườn (cây, cỏ, tiểu cảnh...) phù hợp. Phong cách chuyên nghiệp, vật liệu chân thực. Trả về một ảnh chất lượng cao.`

const FLOOR_PLAN_SYNTH = `Bạn là kiến trúc sư. Người dùng cung cấp thông tin chia phòng bằng tiếng Việt hoặc ngôn ngữ trộn. Hãy chuẩn hóa toàn bộ nội dung thành tiếng Việt rõ ràng, có cấu trúc để dùng làm prompt tạo mặt bằng. Chỉ trả về prompt tiếng Việt, không giải thích thêm.`

const FLOOR_PLAN_IMAGE = `Tạo bản vẽ mặt bằng chia phòng chuyên nghiệp dựa trên ảnh tham chiếu và yêu cầu bố trí phòng bên dưới. Thể hiện: ranh giới phòng, cửa đi, cửa sổ, nhãn phòng. Nét vẽ kỹ thuật sạch, bố cục rõ ràng. Trả về một ảnh duy nhất.`

const STRUCTURAL_PROMPT = `Chuyển bản vẽ mặt bằng này thành bản vẽ kết cấu chuyên nghiệp. Thể hiện: móng, cột, dầm, tường chịu lực. Phong cách bản vẽ kỹ thuật sạch, nét đen trên nền trắng. Trả về một ảnh duy nhất.`

export interface HouseInfo {
  /** Chiều dài mặt tiền nhà (m) */
  houseLength: string
  /** Kích thước còn lại của nhà (m) - không phải mặt tiền, thường là chiều sâu */
  houseDepth: string
  /** Phong cách thiết kế */
  designStyle: string
  /** Số tầng */
  floors: string
  /** Có ban công mặt tiền */
  hasBalcony: boolean
  /** Số cửa chính */
  mainDoors: string
  /** Có ảnh gợi ý đính kèm */
  hasReferenceImage: boolean
}

export interface FloorPlanInput {
  /** Phòng khách */
  livingRooms: string
  /** Bếp */
  kitchens: string
  /** Số phòng vệ sinh */
  bathrooms: string
  /** Số phòng ngủ khép kín */
  masterBedrooms: string
  /** Số phòng ngủ thường */
  regularBedrooms: string
  diningRoom: string
  worshipRoom: boolean
  office: boolean
  entertainment: boolean
  garage: string
  /** Cầu thang bộ */
  hasStairs: boolean
  /** Cầu thang máy */
  hasElevator: boolean
  otherRooms: string
}

function getSafetySettings() {
  return [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ]
}

/** Tạo dự án mới */
export async function createHouseProject() {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data, error } = await supabase
    .from('house_build_projects')
    .insert({ user_id: user.id })
    .select()
    .single()

  if (error) {
    const msg = error.message || ''
    if (msg.includes('does not exist') || msg.includes('relation'))
      return { error: 'Bảng dự án chưa có. Vui lòng chạy migration: npx supabase db push' }
    if (msg.includes('permission') || msg.includes('policy') || msg.includes('RLS'))
      return { error: 'Không có quyền tạo dự án. Kiểm tra RLS policies.' }
    console.error('[createHouseProject]', error)
    return { error: `Không tạo được dự án: ${msg}` }
  }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: data.id }
}

/** Lấy danh sách dự án */
export async function listHouseProjects() {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data, error } = await supabase
    .from('house_build_projects')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })

  if (error) return { error: 'Không tải được danh sách.' }
  return { success: true, projects: data || [] }
}

/** Xóa kết quả chia phòng tầng N để chia lại */
export async function clearFloorPlan(projectId: string, floorNum: number) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps[`floor_plan_${floorNum}`]
  delete steps[`structural_${floorNum}`]

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: `floor_plan_${floorNum}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không xóa được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Xóa kết quả kết cấu tầng N để thiết kế lại */
export async function clearStructural(projectId: string, floorNum: number) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps[`structural_${floorNum}`]

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: `structural_${floorNum}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không xóa được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Xóa dự án */
export async function deleteHouseProject(projectId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { error } = await supabase
    .from('house_build_projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không xóa được dự án.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Quay lại form mặt tiền - xóa ảnh 3D, giữ nguyên house_info đã nhập */
export async function clearFloor3D(projectId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps.floor_3d

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: 'floor_3d',
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Cập nhật tên dự án */
export async function updateProjectName(projectId: string, name: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { error } = await supabase
    .from('house_build_projects')
    .update({ name: name.trim() || 'Dự án mới', updated_at: new Date().toISOString() })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước 1: Dựng 3D nhà - mỗi lần tạo ảnh = tạo dự án mới */
export async function step1Build3D(formData: FormData) {
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const houseInfo: HouseInfo = {
    houseLength: (formData.get('houseLength') as string)?.trim() || '',
    houseDepth: (formData.get('houseDepth') as string)?.trim() || '',
    designStyle: (formData.get('designStyle') as string)?.trim() || 'hiện đại',
    floors: (formData.get('floors') as string)?.trim() || '1',
    hasBalcony: formData.get('hasBalcony') === 'true',
    mainDoors: (formData.get('mainDoors') as string)?.trim() || '1',
    hasReferenceImage: formData.get('hasReferenceImage') === 'true',
  }

  if (!houseInfo.houseLength.trim()) return { error: 'Vui lòng nhập chiều dài mặt tiền.' }

  const COST = COSTS.floor_3d
  const { data: creditData } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (!creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)}.` }
  }

  const userInput = [
    `Chiều dài mặt tiền nhà: ${houseInfo.houseLength}m`,
    houseInfo.houseDepth && `Kích thước còn lại của nhà (không phải mặt tiền): ${houseInfo.houseDepth}m`,
    `Phong cách: ${houseInfo.designStyle}`,
    houseInfo.hasBalcony && 'Có ban công mặt tiền',
    `Số cửa chính: ${houseInfo.mainDoors}`,
    `Số tầng: ${houseInfo.floors}`,
    houseInfo.hasReferenceImage && 'Có ảnh gợi ý đính kèm',
  ].filter(Boolean).join('. ')

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseModalities: ['TEXT'] } })
  const synthRes = await flashModel.generateContent(`${SYNTH_PROMPT}\n\nNội dung người dùng nhập:\n${userInput}`)
  trackFromUsageMetadata(synthRes.response.usageMetadata, 'gemini-2.5-flash', 'xay-nha-synth', user.id)
  let promptEn = (synthRes.response.text?.() || '').trim()
  if (!promptEn) promptEn = userInput

  const imageModel = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
  })
  const fullPrompt = `${HOUSE_3D_PROMPT}\n\n${promptEn}\n\nChỉ trả về ảnh kết quả.`

  const refFile = formData.get('referenceImage') as File | null
  let imgRes
  if (houseInfo.hasReferenceImage && refFile?.size && refFile.size > 0) {
    const buf = Buffer.from(await refFile.arrayBuffer())
    const base64 = buf.toString('base64')
    const mime = refFile.type || 'image/png'
    imgRes = await imageModel.generateContent(
      [fullPrompt + '\n\nDùng ảnh tham chiếu này để lấy cảm hứng phong cách và bố cục.', { inlineData: { data: base64, mimeType: mime } }],
      { safetySettings: getSafetySettings() }
    )
  } else {
    imgRes = await imageModel.generateContent(fullPrompt, { safetySettings: getSafetySettings() })
  }
  trackFromUsageMetadata(imgRes.response.usageMetadata, 'gemini-3-pro-image-preview', 'xay-nha-3d', user.id, '2K')

  const imgPart = imgRes.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được ảnh.' }

  const buf = Buffer.from(imgPart.inlineData.data, 'base64')
  const path = `results/${user.id}/house3d_${Date.now()}.png`
  await adminSupabase.storage.from('try-on-images').upload(path, buf, { contentType: 'image/png', upsert: true })
  const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(path)

  const steps = { floor_3d: { imageUrl: urlData.publicUrl, approved: false } }
  const sizeStr = houseInfo.houseDepth ? `${houseInfo.houseLength}x${houseInfo.houseDepth}m` : `${houseInfo.houseLength}m`
  const projectName = `Nhà ${sizeStr} ${houseInfo.designStyle} ${houseInfo.floors}t`

  const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(COST))
  await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

  const { data: newProject, error } = await supabase
    .from('house_build_projects')
    .insert({
      user_id: user.id,
      name: projectName,
      house_info: houseInfo,
      steps,
      current_step: 'floor_3d',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: urlData.publicUrl }
}

/** Duyệt ảnh 3D và chuyển sang chia phòng tầng 1 */
export async function approveFloor3DAndContinue(projectId: string) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const st = steps.floor_3d as { imageUrl?: string; approved?: boolean } | undefined
  if (st) st.approved = true

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: 'floor_plan_1',
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước chia phòng tầng N - mỗi lần tạo ảnh = tạo dự án mới */
export async function stepFloorPlan(sourceProjectId: string, floorNum: number, formData: FormData, referenceImageUrl: string) {
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const input: FloorPlanInput = {
    livingRooms: (formData.get('livingRooms') as string)?.trim() || '1',
    kitchens: (formData.get('kitchens') as string)?.trim() || '1',
    bathrooms: (formData.get('bathrooms') as string)?.trim() || '1',
    masterBedrooms: (formData.get('masterBedrooms') as string)?.trim() || '0',
    regularBedrooms: (formData.get('regularBedrooms') as string)?.trim() || '1',
    diningRoom: (formData.get('diningRoom') as string)?.trim() || 'chung',
    worshipRoom: formData.get('worshipRoom') === 'true',
    office: formData.get('office') === 'true',
    entertainment: formData.get('entertainment') === 'true',
    garage: (formData.get('garage') as string)?.trim() || '0',
    hasStairs: formData.get('hasStairs') === 'true',
    hasElevator: formData.get('hasElevator') === 'true',
    otherRooms: (formData.get('otherRooms') as string)?.trim() || '',
  }

  const COST = COSTS.floor_plan
  const { data: creditData } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (!creditData || toTenths(creditData.balance) < toTenths(COST)) return { error: `Không đủ credits. Cần ${formatCredits(COST)}.` }

  const { data: sourceProject } = await supabase.from('house_build_projects').select('*').eq('id', sourceProjectId).eq('user_id', user.id).single()
  if (!sourceProject) return { error: 'Không tìm thấy dự án.' }

  const userInput = [
    `Tầng ${floorNum}:`,
    `Phòng khách: ${input.livingRooms}`,
    `Bếp: ${input.kitchens}`,
    `Phòng ngủ khép kín: ${input.masterBedrooms}`,
    `Phòng ngủ thường: ${input.regularBedrooms}`,
    `Phòng ăn: ${input.diningRoom}`,
    `Phòng vệ sinh: ${input.bathrooms}`,
    input.worshipRoom && 'Phòng thờ',
    input.office && 'Phòng làm việc',
    input.entertainment && 'Phòng giải trí',
    input.garage !== '0' && `Gara ${input.garage} xe`,
    input.hasStairs && 'Cầu thang bộ',
    input.hasElevator && 'Cầu thang máy',
    input.otherRooms && input.otherRooms,
  ].filter(Boolean).join('. ')

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseModalities: ['TEXT'] } })
  const synthRes = await flashModel.generateContent(`${FLOOR_PLAN_SYNTH}\n\nNội dung người dùng nhập:\n${userInput}`)
  trackFromUsageMetadata(synthRes.response.usageMetadata, 'gemini-2.5-flash', 'xay-nha-fp-synth', user.id)
  let promptEn = (synthRes.response.text?.() || '').trim()
  if (!promptEn) promptEn = userInput

  const imgRes = await fetch(referenceImageUrl)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = imgBuf.toString('base64')

  const imageModel = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
  })
  const fullPrompt = `${FLOOR_PLAN_IMAGE}\n\nYêu cầu: ${promptEn}\n\nChỉ trả về ảnh kết quả.`
  const resultImg = await imageModel.generateContent([
    fullPrompt,
    { inlineData: { data: base64, mimeType: 'image/png' } },
  ], { safetySettings: getSafetySettings() })
  trackFromUsageMetadata(resultImg.response.usageMetadata, 'gemini-3-pro-image-preview', 'xay-nha-floorplan', user.id, '2K')

  const imgPart = resultImg.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được bản vẽ chia phòng.' }

  const buf = Buffer.from(imgPart.inlineData.data, 'base64')
  const path = `results/${user.id}/floorplan_${floorNum}_${Date.now()}.png`
  await adminSupabase.storage.from('try-on-images').upload(path, buf, { contentType: 'image/png', upsert: true })
  const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(path)

  const steps = { ...(sourceProject.steps as Record<string, unknown>) }
  const key = `floor_plan_${floorNum}` as const
  steps[key] = { imageUrl: urlData.publicUrl, approved: false, input }

  const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(COST))
  await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

  const projectName = `${sourceProject.name || 'Dự án'} - Chia phòng t${floorNum}`
  const { data: newProject, error } = await supabase
    .from('house_build_projects')
    .insert({
      user_id: user.id,
      name: projectName,
      house_info: sourceProject.house_info,
      steps,
      current_step: `floor_plan_${floorNum}`,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: urlData.publicUrl }
}

/** Duyệt chia phòng tầng N và chuyển sang thiết kế kết cấu */
export async function approveFloorPlanAndContinue(projectId: string, floorNum: number) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const key = `floor_plan_${floorNum}` as const
  const fp = steps[key] as { imageUrl?: string; approved?: boolean; input?: FloorPlanInput } | undefined
  if (fp) fp.approved = true

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: `structural_${floorNum}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước kết cấu tầng N - mỗi lần tạo ảnh = tạo dự án mới */
export async function stepStructural(sourceProjectId: string, floorNum: number, floorPlanImageUrl: string) {
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = COSTS.structural
  const { data: creditData } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (!creditData || toTenths(creditData.balance) < toTenths(COST)) return { error: `Không đủ credits. Cần ${formatCredits(COST)}.` }

  const { data: sourceProject } = await supabase.from('house_build_projects').select('*').eq('id', sourceProjectId).eq('user_id', user.id).single()
  if (!sourceProject) return { error: 'Không tìm thấy dự án.' }

  const imgRes = await fetch(floorPlanImageUrl)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = imgBuf.toString('base64')

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const imageModel = genAI.getGenerativeModel({
    model: 'gemini-3-pro-image-preview',
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
  })
  const resultImg = await imageModel.generateContent([
    `${STRUCTURAL_PROMPT} Floor ${floorNum}.`,
    { inlineData: { data: base64, mimeType: 'image/png' } },
  ], { safetySettings: getSafetySettings() })
  trackFromUsageMetadata(resultImg.response.usageMetadata, 'gemini-3-pro-image-preview', 'xay-nha-structural', user.id, '2K')

  const imgPart = resultImg.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được bản vẽ kết cấu.' }

  const buf = Buffer.from(imgPart.inlineData.data, 'base64')
  const path = `results/${user.id}/structural_${floorNum}_${Date.now()}.png`
  await adminSupabase.storage.from('try-on-images').upload(path, buf, { contentType: 'image/png', upsert: true })
  const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(path)

  const steps = { ...(sourceProject.steps as Record<string, unknown>) }
  const key = `structural_${floorNum}` as const
  steps[key] = { imageUrl: urlData.publicUrl, approved: false }

  const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(COST))
  await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)

  const projectName = `${sourceProject.name || 'Dự án'} - Kết cấu t${floorNum}`
  const { data: newProject, error } = await supabase
    .from('house_build_projects')
    .insert({
      user_id: user.id,
      name: projectName,
      house_info: sourceProject.house_info,
      steps,
      current_step: `structural_${floorNum}`,
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error || !newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: urlData.publicUrl }
}

/** Duyệt kết cấu tầng N và chuyển sang bước tiếp theo */
export async function approveStructuralAndContinue(projectId: string, floorNum: number) {
  const supabase = createClient()
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: project } = await supabase.from('house_build_projects').select('*').eq('id', projectId).eq('user_id', user.id).single()
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const key = `structural_${floorNum}` as const
  const st = steps[key] as { imageUrl?: string; approved?: boolean } | undefined
  if (st) st.approved = true

  const floors = parseInt((project.house_info as HouseInfo)?.floors || '1', 10) || 1
  const nextFloor = floorNum + 1
  const nextStep = nextFloor <= floors ? `floor_plan_${nextFloor}` : 'completed'

  const { error } = await supabase
    .from('house_build_projects')
    .update({
      steps,
      current_step: nextStep,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .eq('user_id', user.id)

  if (error) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}
