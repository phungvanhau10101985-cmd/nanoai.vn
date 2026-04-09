/**
 * Worker xử lý worksheet jobs – chạy ngầm, không phụ thuộc client.
 * Chạy: npm run worker
 * PM2: pm2 start "npm run worker" --name worksheet-worker
 * Cần: DATABASE_URL, GOOGLE_API_KEY (trong .env.local hoặc .env)
 */
import { config } from 'dotenv'
import { resolve } from 'path'
// Load .env rồi .env.local (.env.local ghi đè)
config({ path: resolve(process.cwd(), '.env') })
config({ path: resolve(process.cwd(), '.env.local') })

import { isPgConfigured } from '../src/lib/db/pool'
import {
  claimNextWorksheetJobPg,
  markStaleWorksheetJobsProcessingPg,
  updateWorksheetJobCompletedPg,
  updateWorksheetJobFailedPg,
} from '../src/lib/db/worksheet-jobs-pg'
import { runParseSgk } from '../src/lib/worksheet-job/parse-sgk-handler'
import { runSolveSgkEssays } from '../src/lib/worksheet-job/solve-sgk-essays-handler'
import { runStepByStep } from '../src/lib/worksheet-job/step-by-step-handler'
import { notifyWorksheetJobOutcome } from '../src/lib/notifications/notify-job-events'

const POLL_INTERVAL_MS = 5000
const JOB_TIMEOUT_MS = 30 * 60 * 1000 // 30 phút

function requirePg() {
  if (!isPgConfigured()) {
    throw new Error(
      'Thiếu DATABASE_URL. Tạo .env.local từ .env.example và cấu hình kết nối Postgres.'
    )
  }
}

async function processJob(job: { id: string; user_id: string; type: string; params: Record<string, unknown> }) {
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
      const result = await runParseSgk(
        userId,
        {
          imageUrls: p.imageUrls ?? [],
          curriculumId: p.curriculumId ?? null,
          worksheetId: p.worksheetId ?? null,
          topic: p.topic ?? 'Phiếu bài tập',
          subjectId: p.subjectId ?? 'toan',
          gradeLevelId: p.gradeLevelId ?? 'lop-6',
          curriculumMarkdown: p.curriculumMarkdown ?? '',
        },
        { solveMissingEssaySolutions: false }
      )
      await updateWorksheetJobCompletedPg(id, result)
      await notifyWorksheetJobOutcome({
        userId,
        jobId: id,
        jobType: type,
        success: true,
      })
    } else if (type === 'solve_sgk_essays') {
      const p = params as { worksheetId?: string; curriculumMarkdown?: string }
      const result = await runSolveSgkEssays(userId, {
        worksheetId: p.worksheetId ?? '',
        curriculumMarkdown: p.curriculumMarkdown ?? '',
      })
      await updateWorksheetJobCompletedPg(id, result)
      await notifyWorksheetJobOutcome({
        userId,
        jobId: id,
        jobType: type,
        success: true,
      })
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
      const result = await runStepByStep(
        userId,
        {
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
        },
        type === 'step_by_step_quiz' ? 'quiz' : 'essay'
      )
      await updateWorksheetJobCompletedPg(id, result)
      await notifyWorksheetJobOutcome({
        userId,
        jobId: id,
        jobType: type,
        success: true,
      })
    } else {
      throw new Error(`Job type không hỗ trợ: ${type}`)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Job ${id} failed:`, msg)
    await updateWorksheetJobFailedPg(id, msg)
    await notifyWorksheetJobOutcome({
      userId,
      jobId: id,
      jobType: type,
      success: false,
      errorMessage: msg,
    })
  }
}

async function markStaleJobsFailed() {
  const cutoff = new Date(Date.now() - JOB_TIMEOUT_MS).toISOString()
  const timeoutMsg = 'Job timeout (quá 30 phút)'
  const staleRows = await markStaleWorksheetJobsProcessingPg(cutoff, timeoutMsg)

  for (const r of staleRows) {
    await notifyWorksheetJobOutcome({
      userId: r.user_id,
      jobId: r.id,
      jobType: r.type,
      success: false,
      errorMessage: timeoutMsg,
    })
  }
}

async function run() {
  requirePg()
  console.log('[worksheet-worker] Started (Postgres), polling every', POLL_INTERVAL_MS / 1000, 's')

  const loop = async () => {
    try {
      await markStaleJobsFailed()
      const job = await claimNextWorksheetJobPg()
      if (job) {
        console.log('[worksheet-worker] Processing job', job.id, job.type)
        await processJob(job)
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
