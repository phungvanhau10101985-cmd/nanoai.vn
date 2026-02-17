'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenAI } from '@google/genai'
import { trackApiUsage } from '@/lib/track-ai-usage'

/** 720p: 8 credit, 1080p: 16 credit (8 giây, chất lượng cao hơn) */
const VIDEO_COSTS = { '720p': 8, '1080p': 16 } as const
const toTenths = (v: number) => Math.round(v * 10)
const fromTenths = (v: number) => v / 10
const formatCredits = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const DEFAULT_PROMPT =
  'Animate this image with subtle, natural motion. Add gentle movement, ambient effects, or bring the scene to life. Cinematic, photorealistic, 8 seconds.'

/** Tạo video 8 giây từ ảnh bằng Veo 3.1. 2 chất lượng: 720p và 1080p. */
export async function createVideoFromImage(formData: FormData) {
  const image = formData.get('image') as File
  const resolution = (formData.get('resolution') as '720p' | '1080p') || '720p'
  const prompt = (formData.get('prompt') as string)?.trim() || DEFAULT_PROMPT

  if (!image || image.size === 0) return { error: 'Cần tải lên ít nhất một ảnh.' }

  const COST = VIDEO_COSTS[resolution]
  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser())
  if ('error' in result) return { error: result.error }
  const { user } = result

  const { data: creditData, error: creditError } = await supabase
    .from('credits')
    .select('balance')
    .eq('user_id', user.id)
    .single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(COST)) {
    return {
      error: `Không đủ credits. Cần ${formatCredits(COST)} credits, hiện có ${formatCredits(creditData?.balance || 0)}.`,
    }
  }

  const timestamp = Date.now()
  const uploadPath = `uploads/${user.id}/video_input_${timestamp}.png`
  await supabase.storage.from('try-on-images').upload(uploadPath, image)
  const { data: origUrl } = supabase.storage.from('try-on-images').getPublicUrl(uploadPath)

  const { data: historyItem, error: historyError } = await supabase
    .from('try_on_history')
    .insert({
      user_id: user.id,
      original_image_url: origUrl.publicUrl,
      garment_image_url: origUrl.publicUrl,
      status: 'processing',
      feature: 'video',
    })
    .select()
    .single()
  if (historyError || !historyItem) return { error: 'Không thể khởi tạo phiên xử lý.' }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) return { error: 'Thiếu cấu hình GOOGLE_API_KEY.' }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const buffer = Buffer.from(await image.arrayBuffer())
    const imageBase64 = buffer.toString('base64')
    const mimeType = image.type || 'image/png'

    const operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt,
      image: {
        imageBytes: imageBase64,
        mimeType,
      },
      config: {
        resolution,
        durationSeconds: 8,
        aspectRatio: '16:9',
        generateAudio: true,
      },
    })

    let op = operation
    const maxAttempts = 60
    for (let i = 0; i < maxAttempts; i++) {
      if (op.done) break
      await new Promise((r) => setTimeout(r, 10000))
      op = await ai.operations.getVideosOperation({ operation: op })
    }

    if (!op.done || !op.response?.generatedVideos?.[0]?.video) {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'AI không tạo được video. Vui lòng thử lại.' }
    }

    const genVideo = op.response.generatedVideos[0].video
    let videoBuffer: Buffer

    if (genVideo?.videoBytes) {
      videoBuffer = Buffer.from(genVideo.videoBytes, 'base64')
    } else if (genVideo?.uri) {
      const downloadResp = await fetch(genVideo.uri, {
        headers: { 'x-goog-api-key': apiKey },
      })
      if (!downloadResp.ok) throw new Error('Không tải được video.')
      const arrBuf = await downloadResp.arrayBuffer()
      videoBuffer = Buffer.from(arrBuf)
    } else {
      await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
      return { error: 'Không lấy được dữ liệu video.' }
    }

    const resultPath = `results/${user.id}/veo_${Date.now()}.mp4`
    await adminSupabase.storage
      .from('try-on-images')
      .upload(resultPath, videoBuffer, { contentType: 'video/mp4', upsert: true })
    const { data: urlData } = adminSupabase.storage.from('try-on-images').getPublicUrl(resultPath)

    const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(COST))
    await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', user.id)
    await adminSupabase
      .from('try_on_history')
      .update({ result_image_url: urlData.publicUrl, status: 'completed' })
      .eq('id', historyItem.id)

    trackApiUsage({
      userId: user.id,
      model: 'veo-3.1-generate-preview',
      feature: 'tao-video-tu-anh',
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 1,
    })

    revalidatePath('/tao-video-tu-anh')
    revalidatePath('/dashboard/history')
    return { success: true, resultUrl: urlData.publicUrl }
  } catch (e) {
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id)
    const msg = e instanceof Error ? e.message : String(e)
    if (/500|Internal Server Error|quota|limit/i.test(msg)) {
      return { error: 'Hệ thống quá tải. Vui lòng thử lại sau vài phút.' }
    }
    return { error: `Tạo video thất bại: ${msg}` }
  }
}
