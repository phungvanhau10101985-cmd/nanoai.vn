'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import {
  tryOnCostMap,
  buildSinglePersonPrompt,
  buildCouplePrompt,
  buildGroupPrompt,
  buildFourPersonPrompt,
  buildFivePersonPrompt,
} from '@/lib/try-on/try-on-prompts'
import { runVirtualTryOnPipeline } from '@/lib/try-on/run-virtual-try-on-pipeline'
import type { TryOnMode } from '@/lib/try-on/try-on-prompts'

const TRY_ON_MODES: readonly TryOnMode[] = ['single', 'couple', 'group', 'group4', 'group5']

function parseTryOnMode(raw: FormDataEntryValue | null): TryOnMode {
  const s = typeof raw === 'string' ? raw : ''
  return TRY_ON_MODES.includes(s as TryOnMode) ? (s as TryOnMode) : 'single'
}

export async function generateAiImage(formData: FormData) {
  const userImage = formData.get('userImage') as File
  const customPrompt = (formData.get('customPrompt') as string) || ''
  const tryOnMode = parseTryOnMode(formData.get('tryOnMode'))
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K'

  const garmentImages: File[] = []
  const leftGarmentImages: File[] = []
  const middleGarmentImages: File[] = []
  const rightGarmentImages: File[] = []
  const person1Images: File[] = [],
    person2Images: File[] = [],
    person3Images: File[] = [],
    person4Images: File[] = [],
    person5Images: File[] = []
  let prompt = ''

  if (tryOnMode === 'single') {
    const count = parseInt((formData.get('garmentCount') as string) || '0')
    for (let i = 0; i < count; i++) {
      const f = formData.get(`garmentImage${i}`)
      if (f instanceof File && f.size > 0) garmentImages.push(f)
    }
    if (!userImage || userImage.size === 0 || garmentImages.length === 0)
      return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm.' }
  } else if (tryOnMode === 'couple') {
    const leftCount = parseInt((formData.get('leftGarmentCount') as string) || '0')
    const rightCount = parseInt((formData.get('rightGarmentCount') as string) || '0')
    for (let i = 0; i < leftCount; i++) {
      const f = formData.get(`leftGarmentImage${i}`)
      if (f instanceof File && f.size > 0) leftGarmentImages.push(f)
    }
    for (let i = 0; i < rightCount; i++) {
      const f = formData.get(`rightGarmentImage${i}`)
      if (f instanceof File && f.size > 0) rightGarmentImages.push(f)
    }
    if (!userImage || userImage.size === 0 || (leftGarmentImages.length === 0 && rightGarmentImages.length === 0))
      return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong hai người.' }
  } else if (tryOnMode === 'group') {
    const leftCount = parseInt((formData.get('leftGarmentCount') as string) || '0')
    const middleCount = parseInt((formData.get('middleGarmentCount') as string) || '0')
    const rightCount = parseInt((formData.get('rightGarmentCount') as string) || '0')
    for (let i = 0; i < leftCount; i++) {
      const f = formData.get(`leftGarmentImage${i}`)
      if (f instanceof File && f.size > 0) leftGarmentImages.push(f)
    }
    for (let i = 0; i < middleCount; i++) {
      const f = formData.get(`middleGarmentImage${i}`)
      if (f instanceof File && f.size > 0) middleGarmentImages.push(f)
    }
    for (let i = 0; i < rightCount; i++) {
      const f = formData.get(`rightGarmentImage${i}`)
      if (f instanceof File && f.size > 0) rightGarmentImages.push(f)
    }
    if (
      !userImage ||
      userImage.size === 0 ||
      (leftGarmentImages.length === 0 && middleGarmentImages.length === 0 && rightGarmentImages.length === 0)
    )
      return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong ba người.' }
  } else if (tryOnMode === 'group4') {
    const p1Count = parseInt((formData.get('person1Count') as string) || '0')
    const p2Count = parseInt((formData.get('person2Count') as string) || '0')
    const p3Count = parseInt((formData.get('person3Count') as string) || '0')
    const p4Count = parseInt((formData.get('person4Count') as string) || '0')
    for (let i = 0; i < p1Count; i++) {
      const f = formData.get(`person1Image${i}`)
      if (f instanceof File && f.size > 0) person1Images.push(f)
    }
    for (let i = 0; i < p2Count; i++) {
      const f = formData.get(`person2Image${i}`)
      if (f instanceof File && f.size > 0) person2Images.push(f)
    }
    for (let i = 0; i < p3Count; i++) {
      const f = formData.get(`person3Image${i}`)
      if (f instanceof File && f.size > 0) person3Images.push(f)
    }
    for (let i = 0; i < p4Count; i++) {
      const f = formData.get(`person4Image${i}`)
      if (f instanceof File && f.size > 0) person4Images.push(f)
    }
    if (
      !userImage ||
      userImage.size === 0 ||
      (person1Images.length === 0 &&
        person2Images.length === 0 &&
        person3Images.length === 0 &&
        person4Images.length === 0)
    )
      return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong bốn người.' }
  } else if (tryOnMode === 'group5') {
    const p1Count = parseInt((formData.get('person1Count') as string) || '0')
    const p2Count = parseInt((formData.get('person2Count') as string) || '0')
    const p3Count = parseInt((formData.get('person3Count') as string) || '0')
    const p4Count = parseInt((formData.get('person4Count') as string) || '0')
    const p5Count = parseInt((formData.get('person5Count') as string) || '0')
    for (let i = 0; i < p1Count; i++) {
      const f = formData.get(`person1Image${i}`)
      if (f instanceof File && f.size > 0) person1Images.push(f)
    }
    for (let i = 0; i < p2Count; i++) {
      const f = formData.get(`person2Image${i}`)
      if (f instanceof File && f.size > 0) person2Images.push(f)
    }
    for (let i = 0; i < p3Count; i++) {
      const f = formData.get(`person3Image${i}`)
      if (f instanceof File && f.size > 0) person3Images.push(f)
    }
    for (let i = 0; i < p4Count; i++) {
      const f = formData.get(`person4Image${i}`)
      if (f instanceof File && f.size > 0) person4Images.push(f)
    }
    for (let i = 0; i < p5Count; i++) {
      const f = formData.get(`person5Image${i}`)
      if (f instanceof File && f.size > 0) person5Images.push(f)
    }
    if (
      !userImage ||
      userImage.size === 0 ||
      (person1Images.length === 0 &&
        person2Images.length === 0 &&
        person3Images.length === 0 &&
        person4Images.length === 0 &&
        person5Images.length === 0)
    )
      return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong năm người.' }
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const gender = (user.user_metadata?.gender as string) || 'male'
  const genderLabel = gender === 'female' ? 'female' : 'male'
  const customPromptEn = customPrompt?.trim() ? await normalizeToEnglish(customPrompt.trim()) : ''

  if (tryOnMode === 'single') {
    prompt = buildSinglePersonPrompt(genderLabel, customPromptEn, garmentImages.length)
  } else if (tryOnMode === 'couple') {
    prompt = buildCouplePrompt(customPromptEn, leftGarmentImages.length, rightGarmentImages.length)
  } else if (tryOnMode === 'group') {
    prompt = buildGroupPrompt(customPromptEn, leftGarmentImages.length, middleGarmentImages.length, rightGarmentImages.length)
  } else if (tryOnMode === 'group4') {
    prompt = buildFourPersonPrompt(
      customPromptEn,
      person1Images.length,
      person2Images.length,
      person3Images.length,
      person4Images.length
    )
  } else if (tryOnMode === 'group5') {
    prompt = buildFivePersonPrompt(
      customPromptEn,
      person1Images.length,
      person2Images.length,
      person3Images.length,
      person4Images.length,
      person5Images.length
    )
  }

  const baseCost = tryOnCostMap[tryOnMode]
  const cost = imageQuality === '4K' ? baseCost * 2.2 : baseCost

  const allGarmentImages = [
    ...garmentImages,
    ...leftGarmentImages,
    ...middleGarmentImages,
    ...rightGarmentImages,
    ...person1Images,
    ...person2Images,
    ...person3Images,
    ...person4Images,
    ...person5Images,
  ]

  const pipe = await runVirtualTryOnPipeline({
    adminSupabase,
    billingUserId: user.id,
    prompt,
    cost,
    imageQuality,
    userImage,
    garmentFilesOrdered: allGarmentImages,
  })

  if ('error' in pipe) {
    revalidatePath('/dashboard')
    return { error: pipe.error }
  }

  revalidatePath('/thu-do-online')
  revalidatePath('/dashboard/history')
  return { success: true, resultUrl: pipe.resultUrl }
}
