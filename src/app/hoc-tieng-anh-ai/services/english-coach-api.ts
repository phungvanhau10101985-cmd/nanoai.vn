type JsonResult<T> = { ok: boolean; status: number; data: T }

async function parseJsonSafe<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T
}

async function getJson<T>(url: string): Promise<JsonResult<T>> {
  const res = await fetch(url)
  const data = await parseJsonSafe<T>(res)
  return { ok: res.ok, status: res.status, data }
}

async function sendJson<T>(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<JsonResult<T>> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await parseJsonSafe<T>(res)
  return { ok: res.ok, status: res.status, data }
}

async function sendFormData<T>(url: string, formData: FormData): Promise<JsonResult<T>> {
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  })
  const data = await parseJsonSafe<T>(res)
  return { ok: res.ok, status: res.status, data }
}

export function listCustomTopics(params: {
  limit: number
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
}) {
  const query = new URLSearchParams({
    limit: String(params.limit),
    targetLanguage: params.targetLanguage,
    nativeLanguage: params.nativeLanguage,
    learnerLevel: String(params.learnerLevel),
  })
  return getJson<{ items?: unknown[] }>(`/api/english-coach/topic-normalize?${query.toString()}`)
}

export function normalizeCustomTopic(payload: {
  rawTopic: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
}) {
  return sendJson<{ topicId?: string; topicLabel?: string; topicDifficulty?: string; error?: string }>(
    '/api/english-coach/topic-normalize',
    'POST',
    payload
  )
}

export function createTopicCurriculum(payload: {
  topicId: string
  topicLabel: string
  topicDifficulty: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
}) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/topic-curriculum', 'POST', payload)
}

export function getReviewDue(limit: number) {
  return getJson<{ items?: unknown[] }>(`/api/english-coach/review-due?limit=${encodeURIComponent(String(limit))}`)
}

export function getHistorySessions(limit: number, scope: 'active' | 'learned' = 'active') {
  return getJson<{ sessions?: unknown[]; error?: string }>(
    `/api/english-coach/history?limit=${encodeURIComponent(String(limit))}&scope=${encodeURIComponent(scope)}`
  )
}

export function deleteHistorySession(sessionId: string) {
  return sendJson<{ ok?: boolean; error?: string }>(`/api/english-coach/history?sessionId=${encodeURIComponent(sessionId)}`, 'DELETE')
}

export function endHistorySession(
  sessionId: string,
  opts?: { qualityPassed?: boolean; completionReason?: string }
) {
  return sendJson<{ ok?: boolean; error?: string }>(
    '/api/english-coach/history/end',
    'POST',
    {
      sessionId,
      qualityPassed: opts?.qualityPassed,
      completionReason: opts?.completionReason,
    }
  )
}

export function snapshotCompletedLessonSession(sessionId: string) {
  return sendJson<{ ok?: boolean; error?: string }>(
    '/api/english-coach/history/end',
    'POST',
    { sessionId, markEnded: false, completionReason: 'timeline_completed_auto', qualityPassed: true }
  )
}

export function getHistorySession(sessionId: string) {
  return getJson<{ items?: unknown[]; error?: string }>(`/api/english-coach/history?sessionId=${encodeURIComponent(sessionId)}`)
}

export function updateMiniStageSnapshot(payload: {
  sessionId: string
  stage: 'idle' | 'writing' | 'speaking' | 'listening' | 'done'
}) {
  return sendJson<{ ok?: boolean; error?: string }>(
    '/api/english-coach/history/mini-stage',
    'POST',
    payload
  )
}

export function chargeEnglishCoachCredits(payload: {
  action: 'status' | 'charge_live_start' | 'charge_live_unlock' | 'charge_preset_start'
  sessionId: string
}) {
  return sendJson<Record<string, unknown> & { error?: string }>(
    '/api/english-coach/credits',
    'POST',
    payload
  )
}

export function getPreviousLessonWords(
  limit: number,
  filters?: { targetLanguage?: string; nativeLanguage?: string }
) {
  const query = new URLSearchParams({
    date: 'last',
    limit: String(limit),
  })
  const targetLanguage = String(filters?.targetLanguage || '').trim()
  const nativeLanguage = String(filters?.nativeLanguage || '').trim()
  if (targetLanguage) query.set('targetLanguage', targetLanguage)
  if (nativeLanguage) query.set('nativeLanguage', nativeLanguage)
  return getJson<{ items?: unknown[]; error?: string }>(`/api/english-coach/word-daily?${query.toString()}`)
}

export function cleanupIncompleteWords() {
  return sendJson<{ deleted?: number }>('/api/english-coach/word-daily?cleanup=incomplete', 'DELETE')
}

export function deleteWordById(id: string) {
  return sendJson<{ ok?: boolean; deleted?: number; error?: string }>(
    `/api/english-coach/word-daily?id=${encodeURIComponent(id)}`,
    'DELETE'
  )
}

export function getSessionWords(sessionId: string, limit: number, turnIndex?: number) {
  const params = new URLSearchParams({
    sessionId,
    limit: String(limit),
  })
  if (turnIndex !== undefined && turnIndex >= 0) params.set('turnIndex', String(turnIndex))
  return getJson<{ items?: unknown[]; error?: string }>(`/api/english-coach/word-daily?${params.toString()}`)
}

/** Lấy tất cả từ mới của học viên (không theo buổi học cụ thể). */
export function getAllWords(limit = 200, filters?: { targetLanguage?: string; nativeLanguage?: string }) {
  const params = new URLSearchParams({
    date: 'all',
    limit: String(limit),
  })
  const targetLanguage = String(filters?.targetLanguage || '').trim()
  const nativeLanguage = String(filters?.nativeLanguage || '').trim()
  if (targetLanguage) params.set('targetLanguage', targetLanguage)
  if (nativeLanguage) params.set('nativeLanguage', nativeLanguage)
  return getJson<{ items?: unknown[]; date?: string; error?: string }>(`/api/english-coach/word-daily?${params.toString()}`)
}

export function getListeningDistractors(params: {
  sessionId?: string
  turnIndex?: number
  exclude?: string[]
  limit?: number
  languageCode?: string
}) {
  const q = new URLSearchParams()
  if (params.sessionId) q.set('sessionId', params.sessionId)
  if (params.turnIndex !== undefined && params.turnIndex >= 0) q.set('turnIndex', String(params.turnIndex))
  if (params.exclude?.length) q.set('exclude', params.exclude.join(','))
  if (params.limit != null) q.set('limit', String(params.limit))
  if (params.languageCode) q.set('languageCode', params.languageCode)
  return getJson<{ words?: string[]; error?: string }>(`/api/english-coach/listening-distractors?${q.toString()}`)
}

export function saveWordDaily(payload: unknown) {
  return sendJson<{ error?: string }>('/api/english-coach/word-daily', 'POST', payload)
}

export function normalizeWordDailyStandard(limit?: number) {
  return sendJson<{ ok?: boolean; error?: string }>('/api/english-coach/word-daily', 'POST', {
    action: 'normalize_standard',
    limit: limit ?? 0,
  })
}

export function rescheduleReviewWords(payload: { words: Array<{ word: string; targetLanguage: string }> }) {
  return sendJson<unknown>('/api/english-coach/review-reschedule', 'POST', payload)
}

export function transliterateText(payload: { text: string; languageCode: string }) {
  return sendJson<{ transliteration?: string }>('/api/english-coach/transliterate', 'POST', payload)
}

export function saveLearningGoal(payload: unknown) {
  return sendJson<{ goal?: unknown; error?: string }>('/api/english-coach/goal', 'POST', payload)
}

export function recordProgress(payload: unknown) {
  return sendJson<unknown>('/api/english-coach/progress', 'POST', payload)
}

export function markReviewDue(payload: { id: string; score: number }) {
  return sendJson<unknown>('/api/english-coach/review-due', 'POST', payload)
}

export function runPlacementLevel(payload: unknown) {
  return sendJson<{ recommendedLevel?: number; confidence?: number; reason?: string; error?: string }>(
    '/api/english-coach/placement-level',
    'POST',
    payload
  )
}

export function runCefrAssessment(payload: unknown) {
  return sendJson<
    {
      assessment?: {
        id: string
        assessment_type: 'baseline' | 'checkpoint'
        cefr_level: string
        learner_level: number
        confidence: number
        overall_score: number
        speaking_score?: number | null
        listening_score?: number | null
        reading_score?: number | null
        writing_score?: number | null
        summary: string
      }
      error?: string
    }
  >('/api/english-coach/assessment', 'POST', payload)
}

export function evaluateWriting(payload: unknown) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/writing-eval', 'POST', payload)
}

export function generateTts(payload: unknown) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/tts', 'POST', payload)
}

export function getTtsCache(payload: unknown) {
  return sendJson<{ found?: boolean; audioBase64?: string; mimeType?: string }>('/api/english-coach/tts-cache', 'POST', payload)
}

export function saveHistoryMessage(payload: unknown) {
  return sendJson<{ id?: string; error?: string }>('/api/english-coach/history', 'POST', payload)
}

export function updateMessageTranslation(payload: {
  messageId: string
  sessionId?: string
  clientMessageId?: string
  translation?: string
  mainSentence?: string
  correctionNote?: string
  intentAnswer?: string
  tokensJson?: string
  audioUrl?: string
  writingTaskJson?: string
  aiPayloadJson?: string
}) {
  return sendJson<{ ok?: boolean; error?: string }>('/api/english-coach/history/update-translation', 'POST', payload)
}

export function uploadAudio(formData: FormData) {
  return sendFormData<{ audioUrl?: string; error?: string }>('/api/english-coach/audio-upload', formData)
}

export function explainIntent(payload: unknown) {
  return sendJson<{ explanation?: string; error?: string }>('/api/english-coach/intent-explain', 'POST', payload)
}

export function tokenizeSentence(payload: unknown) {
  return sendJson<{ tokens?: string[] }>('/api/english-coach/tokenize', 'POST', payload)
}

export function analyzeWord(payload: unknown) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/word', 'POST', payload)
}

export function chatWithCoach(payload: unknown) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/chat', 'POST', payload)
}

export function createSessionFromRandomCompletedLesson(payload: {
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  topicId: string
  topicLabel: string
  mode: string
  learningMode: 'review' | 'reflex'
  teacherLabel?: string
  teacherLocale?: string
  languageCode?: string
}) {
  return sendJson<{ found?: boolean; sessionId?: string; sourceLessonId?: string; strictMatched?: boolean; error?: string }>(
    '/api/english-coach/completed-lesson',
    'POST',
    { action: 'random_copy', ...payload }
  )
}

export function checkCompletedLessonMatch(payload: {
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  topicId: string
  topicLabel: string
  mode: string
  learningMode: 'review' | 'reflex'
  teacherLabel?: string
  teacherLocale?: string
  languageCode?: string
}) {
  return sendJson<{ found?: boolean; strictCount?: number; error?: string }>(
    '/api/english-coach/completed-lesson',
    'POST',
    { action: 'check_match', ...payload }
  )
}

export function transcribeMixed(payload: unknown) {
  return sendJson<Record<string, unknown> & { error?: string }>('/api/english-coach/transcribe-mixed', 'POST', payload)
}

export function listLiveLessons(params?: {
  limit?: number
  mine?: boolean
  topicId?: string
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: number
  goalType?: string
  durationBucket?: 'short' | 'medium' | 'long'
}) {
  const query = new URLSearchParams()
  if (params?.limit != null) query.set('limit', String(params.limit))
  if (params?.mine) query.set('mine', '1')
  if (params?.topicId) query.set('topicId', params.topicId)
  if (params?.targetLanguage) query.set('targetLanguage', params.targetLanguage)
  if (params?.nativeLanguage) query.set('nativeLanguage', params.nativeLanguage)
  if (params?.learnerLevel != null) query.set('learnerLevel', String(params.learnerLevel))
  if (params?.goalType) query.set('goalType', params.goalType)
  if (params?.durationBucket) query.set('durationBucket', params.durationBucket)
  return getJson<{ items?: unknown[]; error?: string }>(
    `/api/english-coach/live-lesson${query.toString() ? `?${query.toString()}` : ''}`
  )
}

export function getLiveLessonDetail(lessonId: string) {
  return getJson<{ lesson?: unknown; turns?: unknown[]; error?: string }>(
    `/api/english-coach/live-lesson?lessonId=${encodeURIComponent(lessonId)}`
  )
}

export function createLiveLessonFromSession(payload: {
  sessionId: string
  title?: string
  topicId?: string
  topicLabel?: string
  targetLanguage?: string
  nativeLanguage?: string
  learnerLevel?: number
  goalType?: string
  estimatedMinutes?: number
  durationBucket?: 'short' | 'medium' | 'long'
  priceCredits?: number
}) {
  return sendJson<Record<string, unknown> & { error?: string }>(
    '/api/english-coach/live-lesson',
    'POST',
    { action: 'create_from_session', ...payload }
  )
}

export function publishLiveLesson(lessonId: string) {
  return sendJson<{ ok?: boolean; error?: string; issues?: string[] }>('/api/english-coach/live-lesson', 'POST', {
    action: 'publish',
    lessonId,
  })
}

export function validateLiveLessonPublish(lessonId: string) {
  return sendJson<{ ok?: boolean; issues?: string[]; stats?: Record<string, unknown>; error?: string }>(
    '/api/english-coach/live-lesson',
    'POST',
    {
      action: 'validate_publish',
      lessonId,
    }
  )
}

export function purchaseLiveLesson(lessonId: string) {
  return sendJson<{ ok?: boolean; purchased?: boolean; error?: string }>('/api/english-coach/live-lesson', 'POST', {
    action: 'purchase',
    lessonId,
  })
}

export function matchLiveLessonTurn(payload: {
  lessonId: string
  turnIndex: number
  answerText: string
  topicId: string
  targetLanguage: string
  nativeLanguage: string
  teacherGender?: 'male' | 'female' | 'unknown'
  teacherVoice?: string
  matchMode?: 'strict' | 'soft'
}) {
  return sendJson<Record<string, unknown> & { error?: string }>(
    '/api/english-coach/live-lesson',
    'POST',
    { action: 'match_turn', ...payload }
  )
}

export function assistLiveLessonWord(payload: {
  lessonId: string
  word: string
  contextSentence?: string
}) {
  return sendJson<Record<string, unknown> & { error?: string }>(
    '/api/english-coach/live-lesson',
    'POST',
    { action: 'assist_word', ...payload }
  )
}

export function pickRandomLiveLesson(payload: {
  topicId: string
  targetLanguage: string
  nativeLanguage: string
  learnerLevel: number
  goalType?: string
  durationBucket?: 'short' | 'medium' | 'long'
}) {
  return sendJson<Record<string, unknown> & { error?: string }>(
    '/api/english-coach/live-lesson',
    'POST',
    { action: 'pick_random', ...payload }
  )
}

