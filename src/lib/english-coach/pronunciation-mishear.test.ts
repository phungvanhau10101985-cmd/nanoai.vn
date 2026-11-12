import assert from 'node:assert/strict'
import test from 'node:test'
import { pronunciationMishearGuide, pronunciationMishears } from './pronunciation-mishear'

test('của khi nghĩa là tôi là wǒ bị nghe nhầm', () => {
  const hits = pronunciationMishears({
    transcript: 'của 还 喜欢 玩 游戏',
    meaning: 'Tôi cũng thích chơi game',
    targetLanguageCode: 'zh',
    nativeLanguageCode: 'vi',
  })
  assert.deepEqual(hits, [{ heard: 'của', meant: 'tôi', target: '我', reading: 'wǒ' }])
  const guide = pronunciationMishearGuide({
    transcript: 'của 还 喜欢 玩 游戏',
    meaning: 'Tôi cũng thích chơi game',
    targetLanguage: 'Chinese (Mandarin)',
    nativeLanguage: 'Vietnamese',
    targetLanguageCode: 'zh',
    nativeLanguageCode: 'vi',
  })
  assert.match(guide, /đọc wǒ/)
  assert.match(guide, /Cấm nói "của" không phải "tôi"/)
  assert.match(guide, /không phải học sinh cố chọn từ tiếng mẹ đẻ/)
})

test('câu đã nghe được 我 thì không coi của là lỗi', () => {
  const hits = pronunciationMishears({
    transcript: '我还喜欢玩游戏',
    meaning: 'Tôi cũng thích chơi game',
    targetLanguageCode: 'zh',
    nativeLanguageCode: 'vi',
  })
  assert.deepEqual(hits, [])
})

test('nghĩa thật sự có từ của thì giữ từ đó', () => {
  const hits = pronunciationMishears({
    transcript: 'của tôi',
    meaning: 'cái này của tôi',
    targetLanguageCode: 'zh',
    nativeLanguageCode: 'vi',
  })
  assert.deepEqual(hits, [])
})
