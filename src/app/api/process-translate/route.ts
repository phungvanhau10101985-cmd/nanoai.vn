import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { translateOneImage } from '@/lib/translate-document-image'
import { applyPostCheckOcr } from '@/lib/translate-post-check'
import { fetchImageWith1688Bypass } from '@/lib/fetch-image-1688'
import { notifyTranslateImageJobDone, notifyTranslateImageSuccessSmart } from '@/lib/notifications/notify-job-events'
import { uploadTryOnImagePublic } from '@/lib/storage/try-on-public-upload'

const TRANSLATE_COSTS = { '2K': 3, '4K': 6 } as const
const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10

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
  let adminSupabase: SupabaseClient<Database> | null = null

  const safeUpdateFailed = async (errText: string) => {
    if (adminSupabase && historyId) {
      try {
        await adminSupabase!.from('try_on_history').update({ status: 'failed', error_message: errText }).eq('id', historyId)
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server config missing' }, { status: 500 })
  }

  adminSupabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  type JobRow = {
    id: string
    user_id: string
    history_id: string
    retry_round?: number
    source_lang?: string | null
    source_lang_2?: string | null
    target_lang?: string | null
    image_quality?: string | null
    cost?: number | null
    try_on_history: { original_image_url: string; result_image_url?: string | null }
  }
  let job: JobRow | null = null

  if (batchId) {
    const { data: historyList } = await adminSupabase.from('try_on_history').select('id').eq('batch_id', batchId)
    const historyIds = (historyList ?? []).map((h) => h.id)
    if (historyIds.length === 0) {
      return NextResponse.json({ error: 'No pending job for batch' }, { status: 404 })
    }
    /** Job chạy tối đa 120s (maxDuration). Nếu processing_started_at > 2.5 phút = chắc chắn crash/restart → reset về pending */
    const staleThreshold = new Date(Date.now() - 150 * 1000).toISOString()
    await adminSupabase.from('translate_jobs').update({ status: 'pending', processing_started_at: null }).in('history_id', historyIds).eq('status', 'processing').is('processing_started_at', null)
    await adminSupabase.from('translate_jobs').update({ status: 'pending', processing_started_at: null }).in('history_id', historyIds).eq('status', 'processing').lt('processing_started_at', staleThreshold)
    const { data: jobs } = await adminSupabase
      .from('translate_jobs')
      .select('*, try_on_history!inner(original_image_url, result_image_url)')
      .in('history_id', historyIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
    job = (jobs as unknown as JobRow[] | null)?.[0] ?? null
  } else {
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }
    const { data: j, error: jobError } = await adminSupabase
      .from('translate_jobs')
      .select('*, try_on_history!inner(original_image_url, result_image_url)')
      .eq('id', jobId)
      .eq('status', 'pending')
      .single()
    if (jobError || !j) {
      return NextResponse.json({ error: 'Job not found or already processed' }, { status: 404 })
    }
    job = j as unknown as JobRow
  }

  if (!job) {
    console.log('[process-translate] 404 – không có job pending cho batch', batchId || jobId)
    return NextResponse.json({ error: 'No pending job for batch' }, { status: 404 })
  }

  const resolvedJobId = job.id
  const retryRound = job.retry_round ?? 1
  const mem = process.memoryUsage()
  console.log('[process-translate] Chọn job', resolvedJobId, '| retryRound=', retryRound, '| heap:', Math.round(mem.heapUsed / 1024 / 1024), 'MB')
  const history = job.try_on_history
  const imageUrl = retryRound === 2 && history?.result_image_url ? history.result_image_url : history?.original_image_url
  const userId = job.user_id
  historyId = job.history_id
  if (!imageUrl || !userId || !historyId) {
    return NextResponse.json({ error: 'Invalid job data' }, { status: 400 })
  }

  const notifyTranslateFailed = async (errText: string) => {
    await safeUpdateFailed(errText)
    if (adminSupabase && historyId) {
      await notifyTranslateImageJobDone(adminSupabase, {
        userId,
        historyId,
        success: false,
        errorMessage: errText,
      })
    }
  }

  await adminSupabase.from('translate_jobs').update({ status: 'processing', processing_started_at: new Date().toISOString() }).eq('id', resolvedJobId)

  let imageBuffer: Buffer
  try {
    console.log('[process-translate] Đang tải ảnh...', retryRound === 2 ? '(ảnh kết quả lần 1 – dịch lại)' : '')
    imageBuffer = await fetchImageWith1688Bypass(imageUrl)
    console.log('[process-translate] Ảnh tải xong:', Math.round(imageBuffer.length / 1024), 'KB')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const errText = `Không tải ảnh: ${msg}`
    await adminSupabase.from('translate_jobs').update({ status: 'failed', error_message: errText }).eq('id', resolvedJobId)
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
    await adminSupabase.from('translate_jobs').update({ status: 'failed', error_message: errText }).eq('id', resolvedJobId)
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
    console.log('[process-translate] Gemini xong job', resolvedJobId, '| result:', resultBuffer?.length ? `${Math.round(resultBuffer.length / 1024)}KB` : 'empty', '| error:', translateError ?? 'none')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const errText = `Lỗi AI: ${msg}`
    console.error('[process-translate] translateOneImage CRASH:', msg)
    if (e instanceof Error) console.error('[process-translate] stack:', e.stack)
    await adminSupabase.from('translate_jobs').update({ status: 'failed', error_message: errText }).eq('id', resolvedJobId)
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
    await adminSupabase.from('translate_jobs').update({ status: 'failed', error_message: errText }).eq('id', resolvedJobId)
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
  const { publicUrl: resultPublicUrl } = await uploadTryOnImagePublic(adminSupabase, resultPath, finalBuffer, {
    contentType: 'image/png',
    upsert: true,
  })

  const { data: creditData } = await adminSupabase.from('credits').select('balance').eq('user_id', userId).single()
  if (!creditData || toTenths(creditData.balance) < toTenths(cost)) {
    const errText = 'Không đủ credits'
    await adminSupabase.from('translate_jobs').update({ status: 'failed', error_message: errText }).eq('id', resolvedJobId)
    await notifyTranslateFailed(errText)
    if (batchId) {
      const h: Record<string, string> = {}
      if (secret) h['x-process-secret'] = secret
      fetch(`${getBaseUrl()}/api/process-translate?batchId=${batchId}`, { headers: h }).catch(() => {})
    }
    return NextResponse.json({ error: errText }, { status: 402 })
  }

  const newBalance = fromTenths(toTenths(creditData.balance) - toTenths(cost))
  await adminSupabase.from('credits').update({ balance: newBalance }).eq('user_id', userId)
  await adminSupabase
    .from('try_on_history')
    .update({ result_image_url: resultPublicUrl, status: 'completed' })
    .eq('id', historyId)
  await adminSupabase.from('translate_jobs').update({ status: 'completed' }).eq('id', resolvedJobId)

  await notifyTranslateImageSuccessSmart(adminSupabase, {
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
