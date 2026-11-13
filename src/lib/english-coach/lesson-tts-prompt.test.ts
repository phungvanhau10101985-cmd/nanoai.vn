import assert from 'node:assert/strict'
import test from 'node:test'
import { buildLessonTtsPrompt, lessonSpeechDeliveryForKey, teacherVoiceStyle } from './lesson-tts-prompt'

const base = {
  voiceStyle: 'Speak with a deep, warm masculine native Chinese (Mandarin) teacher voice.',
  voiceName: 'Orus',
  teacherGender: 'male',
  locale: 'zh-CN',
  targetLanguage: 'Chinese (Mandarin)',
  nativeLanguage: 'Vietnamese',
  text: 'Em nói câu này rất tốt.',
}

test('clip tiếng mẹ đẻ vẫn là thầy của tiếng đang học', () => {
  const prompt = buildLessonTtsPrompt({ ...base, readingLanguage: 'Vietnamese' })
  assert.match(prompt, /Selected voice: Orus/)
  assert.match(prompt, /Selected locale\/accent: zh-CN/)
  assert.match(prompt, /Chinese \(Mandarin\) teacher speaking Vietnamese/)
  assert.match(prompt, /Do not become a different native speaker of Vietnamese/)
  assert.doesNotMatch(prompt, /native Vietnamese speaker/)
  assert.doesNotMatch(prompt, /Do not read it with a Chinese accent/)
  assert.match(prompt, /Em nói câu này rất tốt\./)
})

test('ba ý cùng một thầy nhưng khác ngữ điệu', () => {
  const explain = buildLessonTtsPrompt({ ...base, delivery: 'explain', readingLanguage: 'Vietnamese' })
  const model = buildLessonTtsPrompt({ ...base, delivery: 'model', readingLanguage: '', text: '我不知道登机口在哪里。' })
  const reply = buildLessonTtsPrompt({
    ...base,
    delivery: 'reply',
    readingLanguage: '',
    text: '您的航班号是多少？',
  })
  for (const prompt of [explain, model, reply]) {
    assert.match(prompt, /Selected voice: Orus/)
    assert.match(prompt, /Do not switch speaker/)
  }
  assert.match(explain, /explaining a correction/)
  assert.doesNotMatch(explain, /rising question/)
  assert.match(model, /model sentence for the learner to repeat/)
  assert.match(model, /do not use a questioning tone/)
  assert.match(reply, /rising question intonation/)
  assert.match(reply, /您的航班号是多少？/)
})

test('tiếng Anh dùng giọng nam Anh trầm ấm', () => {
  const style = teacherVoiceStyle({ gender: 'male', locale: 'en-GB', languageLabel: 'English' })
  assert.match(style, /deep, warm British man/)
  assert.match(style, /not American/)
  const other = teacherVoiceStyle({ gender: 'male', locale: 'ja-JP', languageLabel: 'Japanese' })
  assert.match(other, /native Japanese/)
  assert.doesNotMatch(other, /British/)
})

test('khóa ý theo vai đọc', () => {
  assert.equal(lessonSpeechDeliveryForKey('m1__correction_note'), 'explain')
  assert.equal(lessonSpeechDeliveryForKey('m1__correction_note__sp2'), 'explain')
  assert.equal(lessonSpeechDeliveryForKey('m1__main'), 'model')
  assert.equal(lessonSpeechDeliveryForKey('m1__intent_answer'), 'reply')
})

test('clip tiếng đang học giữ locale của thầy', () => {
  const prompt = buildLessonTtsPrompt({ ...base, readingLanguage: '', text: '我很喜欢看电影。' })
  assert.match(prompt, /Selected locale\/accent: zh-CN/)
  assert.match(prompt, /Keep pronunciation consistent with selected locale\/accent zh-CN/)
  assert.match(prompt, /this same teacher voice/)
  assert.match(prompt, /我很喜欢看电影。/)
})
