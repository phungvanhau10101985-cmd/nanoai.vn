import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translateOneImage } from '@/lib/translate-document-image'
import {
  DOCUMENT_TRANSLATE_GEMINI_CREDITS,
  documentTranslateJobPlan,
} from '@/lib/document-translate-pricing'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { notifyTranslateImageJobDone, notifyTranslateImageSuccessSmart } from '@/lib/notifications/notify-job-events'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'
import { loadPdfPageMeta } from '@/lib/dich-anh-tai-lieu/pdf-job-files'
import { translatePdfPageFromParts } from '@/lib/dich-anh-tai-lieu/translate-pdf-page'
import { deductUserCredits } from '@/lib/music/deduct-user-credits'
import { isPgConfigured } from '@/lib/db/pool'
import {
  claimNextPendingTranslateJobPg,
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
import { TRANSLATE_JOB_STALE_MS } from '@/lib/dich-anh-tai-lieu/pdf-checkpoint'

const TRANSLATE_COSTS = DOCUMENT_TRANSLATE_GEMINI_CREDITS

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
    const staleThreshold = new Date(Date.now() - TRANSLATE_JOB_STALE_MS).toISOString()
    await resetStaleTranslateJobsForHistoryIdsPg(historyIds, staleThreshold)
    const claimed = await claimNextPendingTranslateJobPg(historyIds, batchId, staleThreshold)
    if (claimed == null) {
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (claimed.busy) {
      return NextResponse.json({ busy: true })
    }
    job = claimed.job
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
  const plan = documentTranslateJobPlan(job.image_quality, Number(job.cost) || 0)
  const imageQuality = plan.geminiSize
  const cost = Number(job.cost) || TRANSLATE_COSTS[imageQuality]
  const { engine, gptQuality } = plan
  if (engine === 'gpt' && gptQuality === 'low') {
    const errText = 'Trang này không dùng NanoAI 2L. Chọn NanoAI 2M hoặc NanoAI 2H.'
    await markTranslateJobFailedPg(resolvedJobId, errText)
    await notifyTranslateFailed(errText)
    return NextResponse.json({ error: errText }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (engine !== 'gpt' && !apiKey) {
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

  const genAI = new GoogleGenerativeAI(apiKey || 'unused')
  console.log('[process-translate] Bắt đầu dịch job', resolvedJobId, '| lần=', retryRound, '| url:', imageUrl?.slice(0, 80) + '...')
  let resultBuffer: Buffer
  let translateError: string | undefined
  let pdfLines: string[] = []
  let pdfVector: Buffer | undefined
  let pdfWidthPt = 0
  let pdfHeightPt = 0
  try {
    const pageMeta = job.original_image_url ? await loadPdfPageMeta(job.original_image_url) : null
    if (pageMeta) {
      pdfWidthPt = pageMeta.widthPt
      pdfHeightPt = pageMeta.heightPt
      const prepared = await translatePdfPageFromParts({
        genAI,
        userId,
        sourceLang,
        targetLang,
        sourceLang2,
        imageQuality,
        engine,
        gptQuality,
        retryRound,
        logPrefix: `[process-translate] job=${resolvedJobId}`,
        png: imageBuffer,
        meta: pageMeta,
      })
      resultBuffer = prepared.png
      translateError = prepared.error
      pdfLines = prepared.lines
      pdfVector = prepared.vectorPdf
    } else {
      const result = await translateOneImage(
        genAI,
        imageBuffer,
        'image/png',
        sourceLang,
        targetLang,
        imageQuality,
        userId,
        sourceLang2,
        { retryRound, logPrefix: `[process-translate] job=${resolvedJobId}`, engine, gptQuality }
      )
      resultBuffer = result.buffer
      translateError = result.error
    }
    console.log(
      '[process-translate] Model xong job',
      resolvedJobId,
      '| engine:',
      engine,
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

  const resultPath = `results/${userId}/translate_bg_${Date.now()}.png`
  const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(resultPath, resultBuffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (pdfVector && pdfVector.length > 0) {
    await uploadTryOnImagePublic(resultPath.replace(/\.png$/i, '.pdf'), pdfVector, {
      contentType: 'application/pdf',
      upsert: true,
    }).catch((error) => console.warn('[process-translate] Không lưu PDF vector:', error))
  }
  if (pdfLines.length > 0 && pdfWidthPt > 0 && pdfHeightPt > 0) {
    await uploadTryOnImagePublic(
      resultPath.replace(/\.png$/i, '.lines.json'),
      Buffer.from(JSON.stringify({ lines: pdfLines, widthPt: pdfWidthPt, heightPt: pdfHeightPt })),
      { contentType: 'application/json', upsert: true }
    ).catch((error) => console.warn('[process-translate] Không lưu lớp chữ:', error))
  }

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
