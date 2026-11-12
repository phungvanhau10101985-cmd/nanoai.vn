import assert from 'node:assert/strict'
import test from 'node:test'
import { applySpeechNativeMeaning, type SpeechTurnAnalysis } from './speech-turn-meaning'

const heard: SpeechTurnAnalysis = {
  targetTranscript: '还 喜欢 玩 游戏',
  nativeTranscript: 'của',
  mergedTranscript: 'của 还 喜欢 玩 游戏',
  inferredMeaning: 'Em thích chơi game',
  pronunciationIssues: ['của'],
  pronunciationScore: 62,
  weakWords: ['của'],
  pronunciationAccuracy: 60,
  pronunciationFluency: 70,
  pronunciationProsody: 55,
  wordScores: [{ word: '喜欢', score: 80, issueType: 'ok' }],
}

test('ô trống gửi câu nghe được và nghĩa máy đoán, giữ điểm phát âm', () => {
  const sent = applySpeechNativeMeaning(heard, {
    transcript: 'của 还 喜欢 玩 游戏',
    systemMeaning: 'Tôi cũng thích chơi game',
    learnerMeaning: '',
  })
  assert.equal(sent.studentText, 'của 还 喜欢 玩 游戏')
  assert.equal(sent.analysis.inferredMeaning, 'Tôi cũng thích chơi game')
  assert.equal(sent.analysis.nativeMeaningFromLearner, false)
  assert.equal(sent.analysis.pronunciationScore, 62)
  assert.deepEqual(sent.analysis.weakWords, ['của'])
  assert.equal(sent.studentText.includes('Tôi cũng thích'), false)
})

test('ô có chữ gửi nghĩa học sinh điền, câu nghe được không đổi', () => {
  const sent = applySpeechNativeMeaning(heard, {
    transcript: 'của 还 喜欢 玩 游戏',
    systemMeaning: 'Tôi cũng thích chơi game',
    learnerMeaning: 'Tôi cũng thích chơi điện tử',
  })
  assert.equal(sent.studentText, 'của 还 喜欢 玩 游戏')
  assert.equal(sent.analysis.inferredMeaning, 'Tôi cũng thích chơi điện tử')
  assert.equal(sent.analysis.nativeMeaningFromLearner, true)
  assert.equal(sent.analysis.pronunciationScore, 62)
})
