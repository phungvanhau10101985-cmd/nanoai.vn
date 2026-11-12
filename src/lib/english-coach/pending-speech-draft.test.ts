import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findRestorablePendingSpeech,
  isDiscardedSpeechPayload,
  isUnansweredStudentTurn,
  newerDraftText,
  readPendingSpeechPayload,
  readStoredSpeechAnalysis,
  recordedTurnBypassesMiniHold,
  serializePendingSpeech,
  shouldApplyDraftRevision,
  draftRevisionPlan,
  shouldAttachLocalPendingDraft,
} from './pending-speech-draft'

const analysis = {
  targetTranscript: '我还喜欢游泳',
  nativeTranscript: '',
  mergedTranscript: '我还喜欢游泳',
  inferredMeaning: 'Em rất thích bơi lội',
  pronunciationIssues: [],
  pronunciationScore: 80,
  weakWords: [],
  pronunciationAccuracy: 80,
  pronunciationFluency: 70,
  pronunciationProsody: 70,
  wordScores: [],
}

function local(text: string, savedAt: number): StoredPendingSpeech {
  return {
    sessionId: 'session-1',
    messageId: 'client-1',
    text,
    originalText: '我还喜欢游泳',
    meaning: 'Em rất thích bơi lội',
    audioUrl: '',
    presetReplay: false,
    analysis,
    savedAt,
  }
}

test('bản nháp giữ câu gốc và câu đã sửa', () => {
  const raw = serializePendingSpeech({
    rev: 2,
    savedAt: 50,
    pending: true,
    originalText: '我还喜欢游泳',
    meaning: 'Em rất thích bơi lội',
    presetReplay: false,
    analysis,
  })
  const meta = readPendingSpeechPayload(raw)
  assert.equal(meta?.pending, true)
  assert.equal(meta?.discarded, false)
  assert.equal(meta?.originalText, '我还喜欢游泳')
  assert.equal(meta?.rev, 2)
  assert.equal(meta?.analysis?.mergedTranscript, '我还喜欢游泳')
})

test('câu đã bỏ khi nói lại không được mở lại', () => {
  const raw = serializePendingSpeech({
    rev: 3,
    savedAt: 60,
    pending: true,
    discarded: true,
    originalText: '我还喜欢游泳',
    meaning: '',
    presetReplay: false,
    analysis: null,
  })
  assert.equal(isDiscardedSpeechPayload(raw), true)
  assert.equal(findRestorablePendingSpeech([
    { id: 't1', role: 'teacher', text: 'Câu giáo viên' },
    { id: 's1', role: 'student', text: '我还喜欢游泳', aiPayloadJson: raw },
  ]), null)
})

test('chỉ khôi phục khi câu dở là tin cuối', () => {
  const raw = serializePendingSpeech({
    rev: 1,
    savedAt: 10,
    pending: true,
    originalText: '我还喜欢游泳',
    meaning: 'Em rất thích bơi lội',
    presetReplay: false,
    analysis: null,
  })
  const pending = { id: 's1', role: 'student', text: '我喜欢踢足球', aiPayloadJson: raw }
  assert.equal(findRestorablePendingSpeech([
    { id: 't1', role: 'teacher', text: 'Câu giáo viên' },
    pending,
  ])?.id, 's1')
  assert.equal(findRestorablePendingSpeech([
    pending,
    { id: 't2', role: 'teacher', text: 'Giáo viên đã trả lời' },
  ]), null)
})

test('bản trên máy mới hơn thì giữ câu đã sửa', () => {
  assert.equal(newerDraftText('我还喜欢游泳', 10, local('我喜欢踢足球', 20), 'session-1'), '我喜欢踢足球')
  assert.equal(newerDraftText('我还喜欢游泳', 30, local('我喜欢踢足球', 20), 'session-1'), '我还喜欢游泳')
  assert.equal(newerDraftText('我还喜欢游泳', 10, local('我喜欢踢足球', 20), 'session-2'), '我还喜欢游泳')
})

test('chưa có trên server thì gắn lại câu dở sau câu giáo viên', () => {
  const draft = local('我还喜欢游泳', 20)
  assert.equal(shouldAttachLocalPendingDraft([
    { id: 't1', role: 'teacher', text: 'Câu giáo viên' },
  ], draft), true)
  assert.equal(shouldAttachLocalPendingDraft([
    { id: 't1', role: 'teacher', text: 'Câu giáo viên' },
    { id: 's1', role: 'student', text: 'đã gửi' },
  ], draft), false)
})

test('bản cũ không ghi đè bản nháp mới hơn', () => {
  const older = serializePendingSpeech({
    rev: 2,
    savedAt: 10,
    pending: true,
    originalText: '我还喜欢游泳',
    meaning: '',
    presetReplay: false,
    analysis: null,
  })
  const newer = serializePendingSpeech({
    rev: 4,
    savedAt: 20,
    pending: true,
    originalText: '我还喜欢游泳',
    meaning: '',
    presetReplay: false,
    analysis: null,
  })
  assert.equal(shouldApplyDraftRevision(newer, older), false)
  assert.equal(shouldApplyDraftRevision(older, newer), true)
  assert.equal(shouldApplyDraftRevision(newer, null), false)
  assert.equal(shouldApplyDraftRevision(null, older), true)
  assert.equal(draftRevisionPlan(newer, null), 'text-only')
  assert.equal(draftRevisionPlan(newer, older), 'skip')
})

test('câu đã chốt vẫn thiếu lời thầy, bản nháp thì chưa gửi', () => {
  const pending = serializePendingSpeech({
    rev: 1,
    savedAt: 10,
    pending: true,
    originalText: '我很喜欢看电影',
    meaning: 'Em rất thích xem phim.',
    presetReplay: false,
    analysis,
  })
  const finalized = serializePendingSpeech({
    rev: 2,
    savedAt: 20,
    pending: false,
    originalText: '我很喜欢看电影',
    meaning: 'Em rất thích xem phim.',
    presetReplay: false,
    analysis,
  })
  assert.equal(isUnansweredStudentTurn({ role: 'student', text: '我很喜欢看电影', aiPayloadJson: finalized }), true)
  assert.equal(isUnansweredStudentTurn({ role: 'student', text: '我很喜欢看电影', aiPayloadJson: pending }), false)
  assert.equal(isUnansweredStudentTurn({ role: 'teacher', text: 'Câu giáo viên' }), false)
  assert.equal(isUnansweredStudentTurn({ role: 'student', text: '   ' }), false)
  assert.equal(readStoredSpeechAnalysis(finalized)?.inferredMeaning, 'Em rất thích bơi lội')
})

test('Tiếp trên câu đã nói không bị bài ôn mini của câu trước chặn', () => {
  assert.equal(recordedTurnBypassesMiniHold({ existingStudentMessageId: 'student-1' }), true)
  assert.equal(recordedTurnBypassesMiniHold({ existingStudentMessageId: 'student-1', silentDrill: true }), false)
  assert.equal(recordedTurnBypassesMiniHold({ existingStudentMessageId: 'student-1', drillSpeaking: true }), false)
  assert.equal(recordedTurnBypassesMiniHold({}), false)
  assert.equal(recordedTurnBypassesMiniHold(null), false)
})
