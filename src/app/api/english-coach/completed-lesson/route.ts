import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Payload = {
  action?: 'random_copy' | 'check_match'
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: number
  topicId?: string
  topicLabel?: string
  mode?: string
  learningMode?: 'review' | 'reflex'
  teacherLabel?: string
  teacherLocale?: string
  languageCode?: string
}

type PresetTurn = {
  reply: string
  expectedStudent?: string
  correctionNote?: string
  mainSentence?: string
  intentAnswer?: string
  mustKnowText?: string
  teacherLabel?: string
  teacherLocale?: string
  languageCode?: string
  targetLanguage?: string
}

type LearnerProfileLite = {
  name: string
  job: string
  city: string
  age: string
  gender: string
}

function buildPresetTurnsFromTranscript(transcript: Array<Record<string, unknown>>, learnerProfile: LearnerProfileLite): PresetTurn[] {
  const turns: PresetTurn[] = []
  let seenFirstTeacher = false
  let pendingExpectedStudent = ''
  for (const item of transcript) {
    const role = String(item.role || '').trim()
    if (role === 'student') {
      const text = personalizeTextForLearner(String(item.text || '').trim(), learnerProfile).trim()
      if (text) pendingExpectedStudent = text
      continue
    }
    if (role !== 'teacher') continue
    const reply = personalizeTextForLearner(String(item.text || '').trim(), learnerProfile).trim().slice(0, 4000)
    if (!reply) continue
    if (!seenFirstTeacher) {
      seenFirstTeacher = true
      continue
    }
    turns.push({
      reply,
      expectedStudent: pendingExpectedStudent || undefined,
      correctionNote: personalizeTextForLearner(String(item.correctionNote || '').trim(), learnerProfile) || undefined,
      mainSentence: personalizeTextForLearner(String(item.mainSentence || '').trim(), learnerProfile) || undefined,
      intentAnswer: personalizeTextForLearner(String(item.intentAnswer || '').trim(), learnerProfile) || undefined,
      mustKnowText: personalizeTextForLearner(String(item.mainSentence || item.intentAnswer || item.text || '').trim(), learnerProfile) || undefined,
      teacherLabel: String(item.teacherLabel || '').trim() || undefined,
      teacherLocale: String(item.teacherLocale || '').trim() || undefined,
      languageCode: String(item.languageCode || '').trim() || undefined,
      targetLanguage: String(item.targetLanguage || '').trim() || undefined,
    })
    pendingExpectedStudent = ''
  }
  return turns
}

function normalizeLookup(input: string): string {
  return String(input || '').trim().toLowerCase()
}

function hasPersonalizationSignals(text: string): boolean {
  const s = String(text || '').trim()
  if (!s) return false
  const patterns: RegExp[] = [
    /\bmy\s+name\b/i,
    /\bmy\s+name(?:\s+is|\s*'s)?\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /\bmy\s+name\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}(?:\s+[A-ZÀ-Ỹ][\wÀ-ỹ'.-]{1,}){0,3}\b/u,
    /(?:tên\s+(?:tôi|em|mình|anh|chị)\s+là)\s+[^\n,.!?;:]{1,80}/iu,
    /我叫[^\n。！？!?，,]{1,40}/u,
    /(?:私の名前は|僕の名前は|俺の名前は)[^\n。！？!?，,]{1,40}(?:です|だ)?/u,
    /(?:제\s*이름은|내\s*이름은)\s*[^\n.!?]{1,40}/u,
    /मेरा\s+नाम\s+[^\n।.!?]{1,40}/u,
    /\bhttps?:\/\//i,
    /\bwww\./i,
    /\b[a-z0-9-]+\s*(?:\.|\s+dot\s+|\s+chấm\s+)\s*(?:com|vn|net|org|io)\b/i,
    /\b\d{2,}\s*com\s*vn\b/i,
  ]
  return patterns.some((re) => re.test(s))
}

function transcriptHasPersonalizationSignals(transcriptRaw: string): boolean {
  try {
    const parsed = JSON.parse(String(transcriptRaw || '[]')) as unknown
    const rows = Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>>
      : []
    return rows.some((row) => {
      const fields = [
        String(row.text || '').trim(),
        String(row.mainSentence || row.main_sentence || '').trim(),
        String(row.correctionNote || row.correction_note || '').trim(),
        String(row.intentAnswer || row.intent_answer || '').trim(),
      ]
      return fields.some((field) => hasPersonalizationSignals(field))
    })
  } catch {
    return false
  }
}

function personalizeTextForLearner(text: string, learnerProfile: LearnerProfileLite): string {
  const name = String(learnerProfile.name || '').trim()
  const job = String(learnerProfile.job || '').trim()
  const city = String(learnerProfile.city || '').trim()
  const age = String(learnerProfile.age || '').trim()
  const gender = String(learnerProfile.gender || '').trim().toLowerCase()
  const source = String(text || '')
  if (!name && !job && !city && !age && !gender) return source
  let out = source
  // Placeholder-based personalization (best quality if templates exist).
  out = out.replace(/\{name\}/gi, name || '{name}')
  out = out.replace(/\{job\}/gi, job || '{job}')
  out = out.replace(/\{city\}/gi, city || '{city}')
  out = out.replace(/\{age\}/gi, age || '{age}')
  out = out.replace(/\{gender\}/gi, gender || '{gender}')
  // Greeting line patterns used by lesson opening.
  if (name) {
    out = out.replace(/^(Hello|Hi)\s+[^!,.?]+([!,.?])/i, `$1 ${name}$2`)
    out = out.replace(/^Xin chào\s+[^!,.?]+([!,.?])/i, `Xin chào ${name}$1`)
    out = out.replace(/^你好，[^！!?。]+([！!?。])/u, `你好，${name}$1`)
    out = out.replace(/^こんにちは、[^。！？!?]+([。！？!?])/u, `こんにちは、${name}$1`)
    out = out.replace(/^안녕하세요,\s*[^!?.]+([!?.])/u, `안녕하세요, ${name}$1`)
    out = out.replace(/^สวัสดี\s+[^!?.]+([!?.])/u, `สวัสดี ${name}$1`)
    out = out.replace(/^नमस्ते\s+[^!?.]+([!?.])/u, `नमस्ते ${name}$1`)
  }
  // Self-introduction patterns.
  if (name) {
    out = out.replace(/\bMy name is\s+[^.,!?]+/i, `My name is ${name}`)
    out = out.replace(/(?:Tên em là|Tên tôi là|Tên mình là)\s+[^.,!?]+/iu, `Tên em là ${name}`)
    out = out.replace(/我叫[^。！？!?,，]+/u, `我叫${name}`)
    out = out.replace(/(?:私の名前は|僕の名前は|俺の名前は)[^。！？!?,，]+(?:です|だ)/u, `私の名前は${name}です`)
    out = out.replace(/(?:제 이름은|내 이름은)\s*[^.!?]+/u, `제 이름은 ${name}`)
    out = out.replace(/मेरा नाम\s+[^।.!?]+/u, `मेरा नाम ${name}`)
  }
  if (job) {
    out = out.replace(/\bI am an?\s+[^.,!?]+/i, `I am a ${job}`)
    out = out.replace(/\bI'm an?\s+[^.,!?]+/i, `I'm a ${job}`)
    out = out.replace(/(?:Em là|Tôi là|Mình là)\s+(?:một\s+)?[^.,!?]+/iu, `Em là ${job}`)
  }
  if (city) {
    out = out.replace(/\bI live in\s+[^.,!?]+/i, `I live in ${city}`)
    out = out.replace(/\bI am from\s+[^.,!?]+/i, `I am from ${city}`)
    out = out.replace(/(?:Em sống ở|Tôi sống ở|Mình sống ở)\s+[^.,!?]+/iu, `Em sống ở ${city}`)
  }
  if (age) {
    out = out.replace(/\bI am\s+\d{1,3}\s+years old\b/i, `I am ${age} years old`)
    out = out.replace(/\bI'm\s+\d{1,3}\b/i, `I'm ${age}`)
    out = out.replace(/(?:Em|Tôi|Mình)\s+\d{1,3}\s+tuổi/iu, `Em ${age} tuổi`)
  }
  return out
}

function parseTeacherRowsFromTranscript(
  transcriptRaw: string,
  fallbackMode: string
): Array<{
  text: string
  audioUrl: string | null
  translation: string | null
  languageCode: string | null
  targetLanguage: string | null
  teacherLabel: string | null
  teacherLocale: string | null
  mode: string
  mainSentence: string
  correctionNote: string
  intentAnswer: string
}> {
  let transcript: Array<Record<string, unknown>> = []
  try {
    const parsed = JSON.parse(String(transcriptRaw || '[]')) as unknown
    transcript = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>> : []
  } catch {
    transcript = []
  }
  return transcript
    .filter((item) => String(item.role || '').trim() === 'teacher')
    .map((item) => ({
      text: String(item.text || '').trim().slice(0, 4000),
      audioUrl: String(item.audioUrl || '').trim() || null,
      translation: String(item.translation || '').trim() || null,
      languageCode: String(item.languageCode || '').trim() || null,
      targetLanguage: String(item.targetLanguage || '').trim() || null,
      teacherLabel: String(item.teacherLabel || '').trim() || null,
      teacherLocale: String(item.teacherLocale || '').trim() || null,
      mode: String(item.mode || fallbackMode || 'chat').trim() || 'chat',
      mainSentence: String(item.mainSentence || '').trim(),
      correctionNote: String(item.correctionNote || '').trim(),
      intentAnswer: String(item.intentAnswer || '').trim(),
    }))
    .filter((x) => x.text)
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Payload
    const action = payload.action || 'random_copy'
    if (action !== 'random_copy' && action !== 'check_match') {
      return NextResponse.json({ error: 'Action không hợp lệ.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để dùng bài học có sẵn.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()
    const userMeta = user.user_metadata as {
      full_name?: string
      name?: string
      coach_job?: string
      coach_city?: string
      coach_age?: number | string
      coach_gender?: string
    } | undefined
    let resolvedLearnerName = String(userMeta?.full_name || userMeta?.name || '').trim()
    const resolvedJob = String(userMeta?.coach_job || '').trim()
    const resolvedCity = String(userMeta?.coach_city || '').trim()
    const resolvedAge = String(userMeta?.coach_age || '').trim()
    const resolvedGender = String(userMeta?.coach_gender || '').trim().toLowerCase()
    if (!resolvedLearnerName) {
      const { data: profileRow } = await adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      resolvedLearnerName = String((profileRow as { full_name?: string } | null)?.full_name || '').trim()
    }
    const resolvedLearnerProfile: LearnerProfileLite = {
      name: resolvedLearnerName,
      job: resolvedJob,
      city: resolvedCity,
      age: resolvedAge,
      gender: resolvedGender,
    }

    const targetLanguage = String(payload.targetLanguage || '').trim()
    const nativeLanguage = String(payload.nativeLanguage || '').trim()
    const learnerLevel = Number.isFinite(Number(payload.learnerLevel)) ? Math.max(0, Math.min(4, Math.round(Number(payload.learnerLevel)))) : 0
    const topicId = String(payload.topicId || '').trim()
    const topicLabel = String(payload.topicLabel || '').trim()
    const mode = String(payload.mode || 'chat').trim()
    const learningMode = payload.learningMode === 'reflex' ? 'reflex' : 'review'
    const teacherLabel = String(payload.teacherLabel || '').trim()
    const teacherLocale = String(payload.teacherLocale || '').trim()
    const languageCode = String(payload.languageCode || '').trim()

    const normalizedTarget = normalizeLookup(targetLanguage)
    const normalizedNative = normalizeLookup(nativeLanguage)
    const normalizedTopicId = normalizeLookup(topicId)
    const normalizedTopicLabel = normalizeLookup(topicLabel)
    const normalizedTeacherLabel = normalizeLookup(teacherLabel)
    const normalizedTeacherLocale = normalizeLookup(teacherLocale)
    const normalizedLanguageCode = normalizeLookup(languageCode)

    const { data: candidates, error: candidateError } = await adminSupabase
      .from('language_coach_completed_lessons')
      .select('id, target_language, native_language, learner_level, topic_id, topic_label, mode, learning_mode, language_code, teacher_label, teacher_locale, transcript_json, summary_json')
      .neq('user_id', user.id)
      .eq('learner_level', learnerLevel)
      .eq('learning_mode', learningMode)
      .eq('mode', mode)
      .order('ended_at', { ascending: false })
      .limit(240)

    if (candidateError) {
      return NextResponse.json({ error: candidateError.message || 'Không đọc được bài học có sẵn.' }, { status: 500 })
    }

    const rows = Array.isArray(candidates) ? candidates : []
    const personalizedRows = rows.filter((r) =>
      transcriptHasPersonalizationSignals(String((r as { transcript_json?: string }).transcript_json || '[]').trim())
    )
    if (personalizedRows.length > 0) {
      const idsToDelete = personalizedRows
        .map((r) => String((r as { id?: string }).id || '').trim())
        .filter(Boolean)
      if (idsToDelete.length > 0) {
        await adminSupabase
          .from('language_coach_completed_lessons')
          .delete()
          .in('id', idsToDelete)
      }
    }
    const cleanRows = rows.filter((r) => {
      const id = String((r as { id?: string }).id || '').trim()
      return !personalizedRows.some((p) => String((p as { id?: string }).id || '').trim() === id)
    })

    const strict = cleanRows.filter((r) => {
      const sameTarget = normalizeLookup(String(r.target_language || '')) === normalizedTarget
      const sameNative = normalizeLookup(String(r.native_language || '')) === normalizedNative
      const rowTopicId = normalizeLookup(String(r.topic_id || ''))
      const rowTopicLabel = normalizeLookup(String(r.topic_label || ''))
      const sameTopic =
        normalizedTopicId
          ? rowTopicId === normalizedTopicId
          : (normalizedTopicLabel ? rowTopicLabel === normalizedTopicLabel : false)
      const sameTeacherLabel = !normalizedTeacherLabel || normalizeLookup(String((r as { teacher_label?: string }).teacher_label || '')) === normalizedTeacherLabel
      const sameTeacherLocale = !normalizedTeacherLocale || normalizeLookup(String((r as { teacher_locale?: string }).teacher_locale || '')) === normalizedTeacherLocale
      const sameLanguageCode = !normalizedLanguageCode || normalizeLookup(String((r as { language_code?: string }).language_code || '')) === normalizedLanguageCode
      return sameTarget && sameNative && sameTopic && sameTeacherLabel && sameTeacherLocale && sameLanguageCode
    })
    const strictUsable = strict.filter((r) => {
      const transcriptRaw = String((r as { transcript_json?: string }).transcript_json || '[]').trim()
      const teacherRows = parseTeacherRowsFromTranscript(transcriptRaw, mode)
      return teacherRows.length > 0
    })

    if (action === 'check_match') {
      return NextResponse.json({
        found: strictUsable.length > 0,
        strictCount: strictUsable.length,
      })
    }

    const pool = strictUsable
    if (pool.length === 0) {
      return NextResponse.json({ found: false, strictMatched: false })
    }
    const picked = pool[Math.floor(Math.random() * pool.length)]
    const transcriptRaw = String((picked as { transcript_json?: string }).transcript_json || '[]').trim()
    const summaryRaw = String((picked as { summary_json?: string }).summary_json || '{}').trim()

    let transcript: Array<Record<string, unknown>> = []
    try {
      const parsed = JSON.parse(transcriptRaw) as unknown
      transcript = Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') as Array<Record<string, unknown>> : []
    } catch {
      transcript = []
    }
    if (transcript.length === 0) return NextResponse.json({ found: false })

    let runningSummary = ''
    let pinnedFactsJson = '{}'
    try {
      const parsed = JSON.parse(summaryRaw) as { runningSummary?: unknown; pinnedFactsJson?: unknown }
      runningSummary = String(parsed.runningSummary || '').trim()
      pinnedFactsJson = String(parsed.pinnedFactsJson || '{}').trim() || '{}'
    } catch {
      // keep defaults
    }

    const teacherRows = parseTeacherRowsFromTranscript(transcriptRaw, mode)

    if (teacherRows.length === 0) {
      return NextResponse.json({ found: false })
    }

    const firstTeacher = teacherRows[0]
    const presetTurns: PresetTurn[] = buildPresetTurnsFromTranscript(transcript, resolvedLearnerProfile)

    const newSessionId = randomUUID()
    const nowIso = new Date().toISOString()
    const openingRecord = {
      user_id: user.id,
      session_id: newSessionId,
      role: 'teacher' as const,
      text: personalizeTextForLearner(firstTeacher.text, resolvedLearnerProfile),
      audio_url: firstTeacher.audioUrl,
      translation: firstTeacher.translation,
      language_code: firstTeacher.languageCode,
      target_language: firstTeacher.targetLanguage,
      teacher_label: firstTeacher.teacherLabel,
      teacher_locale: firstTeacher.teacherLocale,
      mode: firstTeacher.mode,
      main_sentence: personalizeTextForLearner(firstTeacher.mainSentence || '', resolvedLearnerProfile) || null,
      correction_note: personalizeTextForLearner(firstTeacher.correctionNote || '', resolvedLearnerProfile) || null,
      intent_answer: personalizeTextForLearner(firstTeacher.intentAnswer || '', resolvedLearnerProfile) || null,
      tokens_json: null,
      writing_task_json: null,
    }

    const { error: insertError } = await adminSupabase
      .from('language_coach_messages')
      .insert(openingRecord)
    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Không copy được transcript bài có sẵn.' }, { status: 500 })
    }

    const parsedPinnedFacts = (() => {
      try {
        const obj = JSON.parse(pinnedFactsJson || '{}') as unknown
        return obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {}
      } catch {
        return {}
      }
    })()

    const { error: memoryError } = await adminSupabase
      .from('language_coach_session_memories')
      .upsert(
        {
          user_id: user.id,
          session_id: newSessionId,
          target_language: targetLanguage,
          native_language: nativeLanguage,
          learner_level: learnerLevel,
          topic_id: topicId || null,
          topic_label: topicLabel || null,
          learning_mode: learningMode,
          running_summary: runningSummary,
          pinned_facts_json: JSON.stringify({
            ...parsedPinnedFacts,
            preset_replay: {
              source_lesson_id: String(picked.id || ''),
              active: true,
              next_turn_index: 0,
              turns: presetTurns,
            },
          }),
          updated_at: nowIso,
        },
        { onConflict: 'user_id,session_id' }
      )
    if (memoryError) {
      return NextResponse.json({ error: memoryError.message || 'Không tạo được memory cho buổi copy.' }, { status: 500 })
    }

    return NextResponse.json({
      found: true,
      sessionId: newSessionId,
      sourceLessonId: String(picked.id || ''),
      strictMatched: strict.length > 0,
      scriptedTurns: presetTurns.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

