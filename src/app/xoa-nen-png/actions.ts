'use server'
import { deleteTryOnHistoryRowAndStorage } from '@/lib/storage/try-on-history-cleanup'

import { getUserForCreditAction } from '@/lib/auth'
import { insertTryOnHistoryProcessingPg, updateTryOnHistoryCompletedPg } from '@/lib/db/try-on-history-pg'
import { revalidatePath } from 'next/cache'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { getCreditBalanceByUserId } from '@/lib/db/credits-balance'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { generateGptImage } from '@/lib/ai/gpt-image'
import { stripBackground } from '@/lib/remove-background'
import { REMOVE_BG_PNG_CREDIT } from '@/lib/remove-background-png-prompts'
import { ensureBunnyWritableBeforeImageModel } from '@/lib/storage/partner-bunny-cdn'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import sharp from 'sharp'

const REMOVE_BG_COST = REMOVE_BG_PNG_CREDIT
const toTenths = (value: number) => Math.round(value * 10)
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

export async function removeBackgroundToTransparentPng(formData: FormData) {
  if (!formData || typeof formData.get !== 'function') {
    return { error: 'Dữ liệu không hợp lệ. Vui lòng thử lại.' }
  }
  const image = formData.get('image') as File
  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const COST = REMOVE_BG_COST
  const result = await getUserForCreditAction()
  if ('error' in result) return { error: result.error }
  const { user } = result

  let balanceBefore: number
  try {
    balanceBefore = await getCreditBalanceByUserId(user.id)
  } catch {
    return { error: 'Không đọc được số dư credits.' }
  }
  if (toTenths(balanceBefore) < toTenths(COST)) {
    return { error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(balanceBefore)}.` }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/remove_bg_${timestamp}.png`
  const { publicUrl: originalPublicUrl } = await uploadTryOnImagePublic(uploadPath, image, {
    contentType: image.type || 'image/png',
  })
  const historyItem = await insertTryOnHistoryProcessingPg({
    userId: user.id,
    originalImageUrl: originalPublicUrl,
    garmentImageUrl: originalPublicUrl,
    feature: 'xoa-nen-png',
  })
  if (!historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const inputBuffer = Buffer.from(await image.arrayBuffer())

  try {
    const bunnyReady = await ensureBunnyWritableBeforeImageModel()
    if (!bunnyReady.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return { error: bunnyReady.error }
    }
    const generated = await generateGptImage({
      prompt: [
        'Use the attached photo as the exact source.',
        'Keep the main subject unchanged: product, person, text, fur, and hair stay in place. Do not redraw or move it.',
        'Replace only the plain background with one flat solid color #F4F1EA. No gradient, no shadow, no new scene, no border.',
        'Do not cut a rectangle through the subject.',
      ].join(' '),
      quality: 'medium',
      size: 'auto',
      images: [{ bytes: inputBuffer, mimeType: image.type || 'image/png', filename: 'source.png' }],
    })
    await trackFromUsageMetadata(generated.usage, generated.usage.logModel, 'xoa-nen-png', user.id, generated.usage.logImageSize)
    const transparentPngBuffer = Buffer.from(await stripBackground(generated.buffer))
    const { data, info } = await sharp(transparentPngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let clear = 0
    const count = info.width * info.height
    for (let i = 3; i < data.length; i += 4) if (data[i] <= 16) clear += 1
    if (count < 1 || clear / count < 0.01) throw new Error('GPT Image không tách được nền trong suốt.')

    const resultPath = `results/${user.id}/remove_bg_${Date.now()}.png`
    const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, transparentPngBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

    const deduct = await deductUserCredits(user.id, COST, 'xoa-nen-png')
    if (!deduct.ok) {
      await deleteTryOnHistoryRowAndStorage(historyItem.id)
      return {
        error:
          deduct.code === 'INSUFFICIENT_CREDITS'
            ? 'Không đủ credits để hoàn tất.'
            : deduct.error || 'Không thể trừ credits.',
      }
    }
    await updateTryOnHistoryCompletedPg(historyItem.id, resultPublicUrl)

    revalidatePath('/xoa-nen-png')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: resultPublicUrl }
  } catch (e) {
    await deleteTryOnHistoryRowAndStorage(historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/no module named PIL|ModuleNotFoundError: No module named 'PIL'/i.test(msg)) {
      return { error: 'Thiếu thư viện Pillow trên server Python. Cài: pip install pillow' }
    }
    if (/AI không trả về ảnh mask hợp lệ/i.test(msg)) {
      return { error: msg }
    }
    if (/500|Internal Server Error|Internal error/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Thử lại sau ít phút.' }
    }
    return { error: `Xóa nền PNG thất bại: ${msg}` }
  }
}
