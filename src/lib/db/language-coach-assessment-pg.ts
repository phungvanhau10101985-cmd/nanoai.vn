import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export type InsertedAssessmentRow = {
  id: string
  assessment_type: string
  cefr_level: string
  learner_level: number
  confidence: number
  overall_score: number
  speaking_score: number | null
  listening_score: number | null
  reading_score: number | null
  writing_score: number | null
  summary: string
}

export async function insertLanguageCoachAssessmentPg(input: {
  userId: string
  assessmentType: 'baseline' | 'checkpoint'
  targetLanguage: string
  nativeLanguage: string
  cefrLevel: string
  learnerLevel: number
  confidence: number
  overallScore: number
  speakingScore: number
  listeningScore: number
  readingScore: number
  writingScore: number
  samplesJson: string
  summary: string
  takenAtIso: string
}): Promise<{ ok: true; row: InsertedAssessmentRow } | { ok: false; message: string }> {
  if (!isPgConfigured()) return { ok: false, message: 'Database not configured' }
  try {
    const row = await pgQueryOne<InsertedAssessmentRow>(
      `insert into public.language_coach_assessments (
        user_id,
        assessment_type,
        target_language,
        native_language,
        cefr_level,
        learner_level,
        confidence,
        overall_score,
        speaking_score,
        listening_score,
        reading_score,
        writing_score,
        samples_json,
        summary,
        taken_at
      ) values (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::timestamptz
      )
      returning
        id::text,
        assessment_type,
        cefr_level,
        learner_level,
        confidence,
        overall_score,
        speaking_score,
        listening_score,
        reading_score,
        writing_score,
        summary`,
      [
        input.userId,
        input.assessmentType,
        input.targetLanguage,
        input.nativeLanguage,
        input.cefrLevel,
        input.learnerLevel,
        input.confidence,
        input.overallScore,
        input.speakingScore,
        input.listeningScore,
        input.readingScore,
        input.writingScore,
        input.samplesJson,
        input.summary,
        input.takenAtIso,
      ]
    )
    if (!row) return { ok: false, message: 'Không lưu được kết quả test.' }
    return { ok: true, row }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[language-coach-assessment-pg] insertLanguageCoachAssessmentPg', e)
    return { ok: false, message: msg || 'Không lưu được kết quả test.' }
  }
}
