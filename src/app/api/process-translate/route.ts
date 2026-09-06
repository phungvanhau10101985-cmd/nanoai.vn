import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translateOneImage } from '@/lib/translate-document-image'
import { applyPostCheckOcr } from '@/lib/translate-post-check'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { notifyTranslateImageJobDone, notifyTranslateImageSuccessSmart } from '@/lib/notifications/notify-job-events'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchNextPendingTranslateJobWithHistoryPg,
  fetchPendingTranslateJobWithHistoryByIdPg,
  fetchTryOnHistoryIdsByBatchIdPg,
  markTranslateJobCompletedPg,
  markTranslateJobFailedPg,
  markTranslateJobProcessingPg,
  resetStaleTranslateJobsForHistoryIdsPg,
  updateTryOnHistoryFailedPg,
  updateTryOnHistoryResultCompletedPg,
  type ProcessTranslateJobRowPg,
} from '@/lib/db/translate-process-pg'

const TRANSLATE_COSTS = { '2K': 3, '4K': 6 } as const

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT || 3000}`
}

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    return await handleProcessTranslate(request)
  } catch (e) {
    console.error('[process-translate] Unhandled crash:', e)
    return NextResponse.json({ error: 'Lỗi nội bộ. Server có thể đã hết bộ nhớ.' }, { status: 500 })
  }
}

async function handleProcessTranslate(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId')
  const batchId = request.nextUrl.searchParams.get('batchId')
  console.log('[process-translate] GET', { jobId, batchId })
  if (!jobId && !batchId) {
    return NextResponse.json({ error: 'Missing jobId or batchId' }, { status: 400 })
  }

  let historyId: string | null = null

  const safeUpdateFailed = async (errText: string) => {
    if (historyId) {
      try {
        await updateTryOnHistoryFailedPg(historyId, errText)
      } catch (e) {
        console.error('[process-translate] Failed to update history:', e)
      }
    }
  }

  const secret = request.headers.get('x-process-secret')
  const expectedSecret = process.env.PROCESS_TRANSLATE_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu (DATABASE_URL).' }, { status: 503 })
  }

  let job: ProcessTranslateJobRowPg | null = null

  if (batchId) {
    const historyIds = await fetchTryOnHistoryIdsByBatchIdPg(batchId)
    if (historyIds === null) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (historyIds.length === 0) {
      return NextResponse.json({ error: 'No pending job for batch' }, { status: 404 })
    }
    const staleThreshold = new Date(Date.now() - 150 * 1000).toISOString()
    await resetStaleTranslateJobsForHistoryIdsPg(historyIds, staleThreshold)
    job = await fetchNextPendingTranslateJobWithHistoryPg(historyIds)
  } else {
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }
    job = await fetchPendingTranslateJobWithHistoryByIdPg(jobId)
    if (!job) {
      return NextResponse.json({ error: 'Job not found or already processed' }, { status: 404 })
    }
  }

  if (!job) {
    console.log('[process-translate] 404 – không có job pending cho batch', batchId || jobId)
    return NextResponse.json({ error: 'No pending job for batch' }, { status: 404 })
  }

  const resolvedJobId = job.id
  const retryRound = job.retry_round ?? 1
  const mem = process.memoryUsage()
  console.log('[process-translate] Chọn job', resolvedJobId, '| retryRound=', retryRound, '| heap:', Math.round(mem.heapUsed / 1024 / 1024), 'MB')

  const imageUrl =
    retryRound === 2 && job.result_image_url ? job.result_image_url : job.original_image_url
  const userId = job.user_id
  historyId = job.history_id
  if (!imageUrl || !userId || !historyId) {
    return NextResponse.json({ error: 'Invalid job data' }, { status: 400 })
  }

  const notifyTranslateFailed = async (errText: string) => {
    await safeUpdateFailed(errText)
    await notifyTranslateImageJobDone({
      userId,
      historyId,
      success: false,
      errorMessage: errText,
    })
  }

  await markTranslateJobProcessingPg(resolvedJobId)

  let imageBuffer: Buffer
  try {
    console.log('[process-translate] Đang tải ảnh...', retryRound === 2 ? '(ảnh kết quả lần 1 – dịch lại)' : '')
    imageBuffer = await fetchImageWith1688Bypass(imageUrl)
    console.log('[process-translate] Ảnh tải xong:', Math.round(imageBuffer.length / 1024), 'KB')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const errText = `Không tải ảnh: ${msg}`
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const sourceLang = String(job.source_lang || 'en')
  const sourceLang2 = job.source_lang_2 ?? null
  const targetLang = String(job.target_lang || 'vi')
  const imageQuality = (String(job.image_quality || '2K') as '2K' | '4K')
  const cost = Number(job.cost) || TRANSLATE_COSTS[imageQuality]

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    const errText = 'Thiếu GOOGLE_API_KEY trong cấu hình server'
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: errText }, { status: 500 })
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  console.log('[process-translate] Bắt đầu dịch job', resolvedJobId, '| lần=', retryRound, '| url:', imageUrl?.slice(0, 80) + '...')
  let resultBuffer: Buffer
  let translateError: string | undefined
  try {
    const result = await translateOneImage(
      genAI,
      imageBuffer,
      'image/png',
      sourceLang,
      targetLang,
      imageQuality,
      userId,
      sourceLang2,
      { retryRound, logPrefix: `[process-translate] job=${resolvedJobId}` }
    )
    resultBuffer = result.buffer
    translateError = result.error
    console.log(
      '[process-translate] Gemini xong job',
      resolvedJobId,
      '| result:',
      resultBuffer?.length ? `${Math.round(resultBuffer.length / 1024)}KB` : 'empty',
      '| error:',
      translateError ?? 'none'
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const errText = `Lỗi AI: ${msg}`
    console.error('[process-translate] translateOneImage CRASH:', msg)
    if (e instanceof Error) console.error('[process-translate] stack:', e.stack)
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: errText }, { status: 500 })
  }

  if (translateError || !resultBuffer.length) {
    const errText = translateError || 'AI không trả về ảnh'
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: translateError }, { status: 500 })
  }

  const finalBuffer = await applyPostCheckOcr(resultBuffer, genAI, {
    sourceLang,
    sourceLang2,
    targetLang,
    logPrefix: `[process-translate] job=${resolvedJobId}`,
    userId,
  })

  const resultPath = `results/${userId}/translate_bg_${Date.now()}.png`
  const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, finalBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const d = await deductUserCredits(userId, cost, 'dich-anh-tai-lieu')
  if (!d.ok) {
    const errText = d.code === 'INSUFFICIENT_CREDITS' ? 'Không đủ credits' : d.error
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: errText }, { status: 402 })
  }
  await updateTryOnHistoryResultCompletedPg(historyId, resultPublicUrl)
  await markTranslateJobCompletedPg(resolvedJobId)

  revalidatePath('/dashboard/history/translate')
  revalidatePath('/dich-anh-tai-lieu')

  await notifyTranslateImageSuccessSmart({
    userId,
    historyId,
  })

  const triggerNext = () => {
    if (batchId) {
      const headers: Record<string, string> = {}
      if (secret) headers['x-process-secret'] = secret
      setTimeout(() => fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers }).catch(() => {}), 3000)
    }
  }

  triggerNext()
  const memEnd = process.memoryUsage()
  console.log('[process-translate] Hoàn thành job', resolvedJobId, '| heap:', Math.round(memEnd.heapUsed / 1024 / 1024), 'MB')
  return NextResponse.json({ success: true, resultUrl: resultPublicUrl })
}
