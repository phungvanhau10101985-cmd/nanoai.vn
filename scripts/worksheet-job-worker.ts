/**
 * Worker xử lý worksheet jobs – chạy ngầm, không phụ thuộc client.
 * Chạy: npm run worker
 * PM2: pm2 start "npm run worker" --name worksheet-worker
 * Cần: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_API_KEY (trong .env.local hoặc .env)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
// Load .env rồi .env.local (.env.local ghi đè)
config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })
import { createClient } from '@supabase/supabase-js'
import { runParseSgk } from '../src/lib/worksheet-job/parse-sgk-handler'
import { runSolveSgkEssays } from '../src/lib/worksheet-job/solve-sgk-essays-handler'
import { runStepByStep } from '../src/lib/worksheet-job/step-by-step-handler'

const POLL_INTERVAL_MS = 5000
const JOB_TIMEOUT_MS = 30 * 60 * 1000 // 30 phút

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. ' +
        'Tạo .env.local từ .env.example và điền Supabase credentials.'
    )
  }
  return createClient(url, key)
}

async function claimJob(supabase: ReturnType<typeof createClient>) {
  const { data: jobs } = await supabase
    .from('worksheet_jobs')
    .select('id, user_id, type, params')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)

  const job = jobs?.[0]
  if (!job) return null

  const { data: updated } = await supabase
    .from('worksheet_jobs')
    .update({
      status: 'processing',
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('id')
    .single()

  return updated ? job : null
}

async function processJob(supabase: ReturnType<typeof createClient>, job: { id: string; user_id: string; type: string; params: Record<string, unknown> }) {
  const { id, user_id, type, params } = job
  const userId = user_id

  try {
    if (type === 'parse_sgk_extract') {
      const p = params as {
        imageUrls?: string[]
        curriculumId?: string | null
        worksheetId?: string | null
        topic?: string
        subjectId?: string
        gradeLevelId?: string
        curriculumMarkdown?: string
      }
      const result = await runParseSgk(supabase, userId, {
        imageUrls: p.imageUrls ?? [],
        curriculumId: p.curriculumId ?? null,
        worksheetId: p.worksheetId ?? null,
        topic: p.topic ?? 'Phiếu bài tập',
        subjectId: p.subjectId ?? 'toan',
        gradeLevelId: p.gradeLevelId ?? 'lop-6',
        curriculumMarkdown: p.curriculumMarkdown ?? '',
      }, { solveMissingEssaySolutions: false })
      await supabase
        .from('worksheet_jobs')
        .update({
          status: 'completed',
          result: result,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    } else if (type === 'solve_sgk_essays') {
      const p = params as { worksheetId?: string; curriculumMarkdown?: string }
      const result = await runSolveSgkEssays(supabase, userId, {
        worksheetId: p.worksheetId ?? '',
        curriculumMarkdown: p.curriculumMarkdown ?? '',
      })
      await supabase
        .from('worksheet_jobs')
        .update({
          status: 'completed',
          result: result,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    } else if (type === 'step_by_step_quiz' || type === 'step_by_step_essay') {
      const p = params as {
        curriculumMarkdown?: string
        topic?: string
        subjectId?: string
        gradeLevelId?: string
        curriculumId?: string | null
        lessonTopics?: string[]
        count?: number
        difficulty?: string
        sessionQuizCountByDiff?: Record<string, number>
        sessionEssayCountByBloom?: Record<string, number>
      }
      const result = await runStepByStep(supabase, userId, {
        curriculumMarkdown: p.curriculumMarkdown ?? '',
        topic: p.topic ?? 'Phiếu bài tập',
        subjectId: p.subjectId ?? 'toan',
        gradeLevelId: p.gradeLevelId ?? 'lop-6',
        curriculumId: p.curriculumId ?? null,
        lessonTopics: p.lessonTopics,
        count: p.count ?? 1,
        difficulty: p.difficulty ?? (type === 'step_by_step_quiz' ? 'medium' : 'thong-hieu'),
        sessionQuizCountByDiff: p.sessionQuizCountByDiff,
        sessionEssayCountByBloom: p.sessionEssayCountByBloom,
      }, type === 'step_by_step_quiz' ? 'quiz' : 'essay')
      await supabase
        .from('worksheet_jobs')
        .update({
          status: 'completed',
          result: result,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
    } else {
      throw new Error(`Job type không hỗ trợ: ${type}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Job ${id} failed:`, msg)
    await supabase
      .from('worksheet_jobs')
      .update({
        status: 'failed',
        error_message: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
  }
}

async function markStaleJobsFailed(supabase: ReturnType<typeof createClient>) {
  const cutoff = new Date(Date.now() - JOB_TIMEOUT_MS).toISOString()
  await supabase
    .from('worksheet_jobs')
    .update({
      status: 'failed',
      error_message: 'Job timeout (quá 30 phút)',
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'processing')
    .lt('processing_started_at', cutoff)
}

async function run() {
  const supabase = getSupabase()
  console.log('[worksheet-worker] Started, polling every', POLL_INTERVAL_MS / 1000, 's')

  const loop = async () => {
    try {
      await markStaleJobsFailed(supabase)
      const job = await claimJob(supabase)
      if (job) {
        console.log('[worksheet-worker] Processing job', job.id, job.type)
        await processJob(supabase, job)
      }
    } catch (e) {
      console.error('[worksheet-worker] Error:', e)
    }
    setTimeout(loop, POLL_INTERVAL_MS)
  }

  loop()
}

run().catch((e) => {
  console.error('[worksheet-worker] Fatal:', e)
  process.exit(1)
})
