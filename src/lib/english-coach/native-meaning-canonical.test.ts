import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSpeechMeaningPrompt,
  buildTypedMeaningCanonicalPrompt,
  meaningCanonicalCacheKey,
  nativeFirstPerson,
  parseCanonicalMeaning,
} from './native-meaning-canonical'

test('tiếng Việt lấy ngôi Tôi', () => {
  assert.equal(nativeFirstPerson('vi', 'Vietnamese'), 'Tôi')
  assert.equal(nativeFirstPerson('', 'Tiếng Việt'), 'Tôi')
})

test('prompt dịch mic ra câu chuẩn, không bắt xưng em', () => {
  const prompt = buildSpeechMeaningPrompt({
    text: 'em muốn mua cà phê',
    nativeLanguage: 'Vietnamese',
    nativeLanguageCode: 'vi',
    targetLanguage: 'English',
  })
  assert.match(prompt, /Ngôi thứ nhất là "Tôi"/)
  assert.equal(prompt.includes('xưng "em"'), false)
  assert.match(prompt, /em muốn mua cà phê/)
})

test('prompt câu gõ viết lại thành câu chuẩn', () => {
  const prompt = buildTypedMeaningCanonicalPrompt({
    text: 'Mình muốn gọi một ly cà phê.',
    nativeLanguage: 'Vietnamese',
    nativeLanguageCode: 'vi',
  })
  assert.match(prompt, /Viết lại câu tiếng mẹ đẻ/)
  assert.match(prompt, /Không dùng em, mình/)
})

test('cùng câu chữ khác dấu câu dùng một khóa cache', () => {
  const a = meaningCanonicalCacheKey('vi', 'Em muốn mua cà phê.')
  const b = meaningCanonicalCacheKey('vi', 'em muốn mua cà phê')
  assert.equal(a, b)
  assert.notEqual(a, meaningCanonicalCacheKey('en', 'em muốn mua cà phê'))
})

test('đọc meaning trong JSON', () => {
  assert.equal(parseCanonicalMeaning('```json\n{"meaning":"Tôi muốn mua cà phê"}\n```'), 'Tôi muốn mua cà phê')
  assert.equal(parseCanonicalMeaning(''), '')
})
