'use server'

import { getUserForCreditAction } from '@/lib/auth'
import {
  deleteHouseBuildProjectForUserPg,
  getHouseBuildProjectForUserPg,
  insertHouseBuildProjectPg,
  listHouseBuildProjectsByUserIdPg,
  updateHouseBuildProjectForUserPg,
} from '@/lib/db/house-build-projects-pg'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { GEMINI_25_FLASH_TEXT_NO_THINKING, GEMINI_3_PRO_IMAGE } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { requireGoogleApiKeyForUser } from '@/lib/ai/google-api-key-resolver'

const COSTS = {
  floor_3d: 4,
  floor_plan: 4,
  structural: 4,
} as const

const toTenths = (v: number) => Math.round(v * 10)
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
  /** Alias khi import / dữ liệu cũ (mặt tiền) */
  houseFacadeWidth?: string
  /** Alias khi import / dữ liệu cũ (chiều sâu đất) */
  landDepthM?: string
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
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const inserted = await insertHouseBuildProjectPg({ userId: user.id })
  if (!inserted) {
    return { error: 'Không tạo được dự án. Kiểm tra DATABASE_URL và bảng house_build_projects.' }
  }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: inserted.id }
}

/** Lấy danh sách dự án */
export async function listHouseProjects() {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const projects = await listHouseBuildProjectsByUserIdPg(user.id)
  return { success: true, projects }
}

/** Xóa kết quả chia phòng tầng N để chia lại */
export async function clearFloorPlan(projectId: string, floorNum: number) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps[`floor_plan_${floorNum}`]
  delete steps[`structural_${floorNum}`]

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: `floor_plan_${floorNum}`,
  })
  if (!ok) return { error: 'Không xóa được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Xóa kết quả kết cấu tầng N để thiết kế lại */
export async function clearStructural(projectId: string, floorNum: number) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps[`structural_${floorNum}`]

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: `structural_${floorNum}`,
  })
  if (!ok) return { error: 'Không xóa được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Xóa dự án */
export async function deleteHouseProject(projectId: string) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const ok = await deleteHouseBuildProjectForUserPg(projectId, user.id)
  if (!ok) return { error: 'Không xóa được dự án.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Quay lại form mặt tiền - xóa ảnh 3D, giữ nguyên house_info đã nhập */
export async function clearFloor3D(projectId: string) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = { ...(project.steps as Record<string, unknown>) }
  delete steps.floor_3d

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: 'floor_3d',
  })
  if (!ok) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Cập nhật tên dự án */
export async function updateProjectName(projectId: string, name: string) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, { name: name.trim() || 'Dự án mới' })
  if (!ok) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước 1: Dựng 3D nhà - mỗi lần tạo ảnh = tạo dự án mới */
export async function step1Build3D(formData: FormData) {
  const result = await getUserForCreditAction()
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
  let openBalance = 0
  try {
    openBalance = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalance) < toTenths(COST)) {
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const flashModel = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
  const synthRes = await flashModel.generateContent(`${SYNTH_PROMPT}\n\nNội dung người dùng nhập:\n${userInput}`)
  trackFromUsageMetadata(synthRes.response.usageMetadata, 'gemini-2.5-flash', 'xay-nha-synth', user.id)
  let promptEn = (synthRes.response.text?.() || '').trim()
  if (!promptEn) promptEn = userInput

  const imageModel = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
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
  trackFromUsageMetadata(imgRes.response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'xay-nha-3d', user.id, '2K')

  const imgPart = imgRes.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được ảnh.' }

  const buf = Buffer.from((imgPart as { inlineData: { data: string } }).inlineData.data, 'base64')
  const path = `results/${user.id}/house3d_${Date.now()}.png`
  const { publicUrl: stepImagePublicUrl } = await uploadTryOnImagePublic(path, buf, {
    contentType: 'image/png',
    upsert: true,
  })

  const steps = { floor_3d: { imageUrl: stepImagePublicUrl, approved: false } }
  const sizeStr = houseInfo.houseDepth ? `${houseInfo.houseLength}x${houseInfo.houseDepth}m` : `${houseInfo.houseLength}m`
  const projectName = `Nhà ${sizeStr} ${houseInfo.designStyle} ${houseInfo.floors}t`

  const d = await deductUserCredits(user.id, COST, 'xay-nha-3d')
  if (!d.ok) {
    return { error: d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : d.error }
  }

  const newProject = await insertHouseBuildProjectPg({
    userId: user.id,
    name: projectName,
    house_info: houseInfo,
    steps,
    current_step: 'floor_3d',
  })

  if (!newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: stepImagePublicUrl }
}

/** Duyệt ảnh 3D và chuyển sang chia phòng tầng 1 */
export async function approveFloor3DAndContinue(projectId: string) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const st = steps.floor_3d as { imageUrl?: string; approved?: boolean } | undefined
  if (st) st.approved = true

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: 'floor_plan_1',
  })
  if (!ok) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước chia phòng tầng N - mỗi lần tạo ảnh = tạo dự án mới */
export async function stepFloorPlan(sourceProjectId: string, floorNum: number, formData: FormData, referenceImageUrl: string) {
  const result = await getUserForCreditAction()
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
  let openBalFp = 0
  try {
    openBalFp = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalFp) < toTenths(COST)) return { error: `Không đủ credits. Cần ${formatCredits(COST)}.` }

  const sourceProject = await getHouseBuildProjectForUserPg(sourceProjectId, user.id)
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

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const flashModel = genAI.getGenerativeModel(GEMINI_25_FLASH_TEXT_NO_THINKING)
  const synthRes = await flashModel.generateContent(`${FLOOR_PLAN_SYNTH}\n\nNội dung người dùng nhập:\n${userInput}`)
  trackFromUsageMetadata(synthRes.response.usageMetadata, 'gemini-2.5-flash', 'xay-nha-fp-synth', user.id)
  let promptEn = (synthRes.response.text?.() || '').trim()
  if (!promptEn) promptEn = userInput

  const imgRes = await fetch(referenceImageUrl)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = imgBuf.toString('base64')

  const imageModel = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
  })
  const fullPrompt = `${FLOOR_PLAN_IMAGE}\n\nYêu cầu: ${promptEn}\n\nChỉ trả về ảnh kết quả.`
  const resultImg = await imageModel.generateContent([
    fullPrompt,
    { inlineData: { data: base64, mimeType: 'image/png' } },
  ], { safetySettings: getSafetySettings() })
  trackFromUsageMetadata(resultImg.response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'xay-nha-floorplan', user.id, '2K')

  const imgPart = resultImg.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được bản vẽ chia phòng.' }

  const buf = Buffer.from((imgPart as { inlineData: { data: string } }).inlineData.data, 'base64')
  const path = `results/${user.id}/floorplan_${floorNum}_${Date.now()}.png`
  const { publicUrl: stepImagePublicUrl } = await uploadTryOnImagePublic(path, buf, {
    contentType: 'image/png',
    upsert: true,
  })

  const steps = { ...(sourceProject.steps as Record<string, unknown>) }
  const key = `floor_plan_${floorNum}` as const
  steps[key] = { imageUrl: stepImagePublicUrl, approved: false, input }

  const dFp = await deductUserCredits(user.id, COST, 'xay-nha-floorplan')
  if (!dFp.ok) return { error: dFp.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : dFp.error }

  const projectName = `${sourceProject.name || 'Dự án'} - Chia phòng t${floorNum}`
  const newProject = await insertHouseBuildProjectPg({
    userId: user.id,
    name: projectName,
    house_info: sourceProject.house_info,
    steps,
    current_step: `floor_plan_${floorNum}`,
  })

  if (!newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: stepImagePublicUrl }
}

/** Duyệt chia phòng tầng N và chuyển sang thiết kế kết cấu */
export async function approveFloorPlanAndContinue(projectId: string, floorNum: number) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const key = `floor_plan_${floorNum}` as const
  const fp = steps[key] as { imageUrl?: string; approved?: boolean; input?: FloorPlanInput } | undefined
  if (fp) fp.approved = true

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: `structural_${floorNum}`,
  })
  if (!ok) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}

/** Bước kết cấu tầng N - mỗi lần tạo ảnh = tạo dự án mới */
export async function stepStructural(sourceProjectId: string, floorNum: number, floorPlanImageUrl: string) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const COST = COSTS.structural
  let openBalSt = 0
  try {
    openBalSt = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(openBalSt) < toTenths(COST)) return { error: `Không đủ credits. Cần ${formatCredits(COST)}.` }

  const sourceProject = await getHouseBuildProjectForUserPg(sourceProjectId, user.id)
  if (!sourceProject) return { error: 'Không tìm thấy dự án.' }

  const imgRes = await fetch(floorPlanImageUrl)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  const base64 = imgBuf.toString('base64')

  const genAI = new GoogleGenerativeAI((await requireGoogleApiKeyForUser(user.id)).apiKey)
  const imageModel = genAI.getGenerativeModel({
    model: GEMINI_3_PRO_IMAGE.model,
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { imageSize: '2K', aspectRatio: '16:9' } },
  })
  const resultImg = await imageModel.generateContent([
    `${STRUCTURAL_PROMPT} Floor ${floorNum}.`,
    { inlineData: { data: base64, mimeType: 'image/png' } },
  ], { safetySettings: getSafetySettings() })
  trackFromUsageMetadata(resultImg.response.usageMetadata, GEMINI_3_PRO_IMAGE.model, 'xay-nha-structural', user.id, '2K')

  const imgPart = resultImg.response.candidates?.[0]?.content?.parts?.find((p) => 'inlineData' in p)
  if (!imgPart || !('inlineData' in imgPart)) return { error: 'AI không tạo được bản vẽ kết cấu.' }

  const buf = Buffer.from((imgPart as { inlineData: { data: string } }).inlineData.data, 'base64')
  const path = `results/${user.id}/structural_${floorNum}_${Date.now()}.png`
  const { publicUrl: stepImagePublicUrl } = await uploadTryOnImagePublic(path, buf, {
    contentType: 'image/png',
    upsert: true,
  })

  const steps = { ...(sourceProject.steps as Record<string, unknown>) }
  const key = `structural_${floorNum}` as const
  steps[key] = { imageUrl: stepImagePublicUrl, approved: false }

  const dSt = await deductUserCredits(user.id, COST, 'xay-nha-structural')
  if (!dSt.ok) return { error: dSt.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits.' : dSt.error }

  const projectName = `${sourceProject.name || 'Dự án'} - Kết cấu t${floorNum}`
  const newProject = await insertHouseBuildProjectPg({
    userId: user.id,
    name: projectName,
    house_info: sourceProject.house_info,
    steps,
    current_step: `structural_${floorNum}`,
  })

  if (!newProject) return { error: 'Không tạo được dự án mới.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true, projectId: newProject.id, imageUrl: stepImagePublicUrl }
}

/** Duyệt kết cấu tầng N và chuyển sang bước tiếp theo */
export async function approveStructuralAndContinue(projectId: string, floorNum: number) {
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  const project = await getHouseBuildProjectForUserPg(projectId, user.id)
  if (!project) return { error: 'Không tìm thấy dự án.' }

  const steps = (project.steps as Record<string, unknown>) || {}
  const key = `structural_${floorNum}` as const
  const st = steps[key] as { imageUrl?: string; approved?: boolean } | undefined
  if (st) st.approved = true

  const floors = parseInt((project.house_info as HouseInfo)?.floors || '1', 10) || 1
  const nextFloor = floorNum + 1
  const nextStep = nextFloor <= floors ? `floor_plan_${nextFloor}` : 'completed'

  const ok = await updateHouseBuildProjectForUserPg(projectId, user.id, {
    steps,
    current_step: nextStep,
  })
  if (!ok) return { error: 'Không cập nhật được.' }
  revalidatePath('/xay-nha-tu-dat-nen')
  return { success: true }
}
