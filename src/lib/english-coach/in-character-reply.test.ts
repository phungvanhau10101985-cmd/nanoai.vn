import assert from 'node:assert/strict'
import test from 'node:test'
import { appendOpeningQuestion, hasOpeningQuestion, keepInCharacterReply } from './in-character-reply'

test('bỏ câu bảo học sinh nói thêm một câu tiếng Anh', () => {
  assert.equal(
    keepInCharacterReply("Great, let's continue. Can you say one more sentence in English to continue this conversation?"),
    '',
  )
})

test('giữ lời chào trong vai và bỏ câu luyện phía sau', () => {
  assert.equal(
    keepInCharacterReply('Nice to meet you. Can you say one more sentence in English to continue this conversation?'),
    'Nice to meet you.',
  )
})

test('giữ câu hỏi đúng việc trong tình huống', () => {
  assert.equal(
    keepInCharacterReply('What would you like to drink?'),
    'What would you like to drink?',
  )
})

test('câu kể đúng vai chưa có câu hỏi mở chuyện', () => {
  const reply = "It's about £15, depending on traffic."
  assert.equal(hasOpeningQuestion(reply), false)
  assert.equal(
    appendOpeningQuestion(reply, 'What are you going there for?'),
    "It's about £15, depending on traffic. What are you going there for?",
  )
})

test('đã có câu hỏi thì giữ nguyên, câu giao bài không được gắn thêm', () => {
  assert.equal(hasOpeningQuestion('那里你去做什么？'), true)
  assert.equal(
    appendOpeningQuestion('What would you like to drink?', 'Where are you going?'),
    'What would you like to drink?',
  )
  assert.equal(
    appendOpeningQuestion(
      "It's about £15, depending on traffic.",
      'Can you say one more sentence in English to continue this conversation?',
    ),
    "It's about £15, depending on traffic.",
  )
})

test('mọi ngôn ngữ đều bỏ câu mẫu bảo nói tiếp', () => {
  assert.equal(keepInCharacterReply('你可以再用一句话说说你今天的计划吗？'), '')
  assert.equal(keepInCharacterReply('次は、今日の予定を一文で言ってみましょうか？'), '')
  assert.equal(keepInCharacterReply('다음으로 오늘 계획을 한 문장으로 말해 볼까요?'), '')
  assert.equal(keepInCharacterReply('ต่อไปลองพูดแผนวันนี้ของคุณหนึ่งประโยคได้ไหม?'), '')
  assert.equal(keepInCharacterReply('क्या आप आज की अपनी योजना एक वाक्य में बता सकते हैं?'), '')
  assert.equal(keepInCharacterReply('Bạn có thể nói thêm một câu về kế hoạch hôm nay không?'), '')
  assert.equal(keepInCharacterReply('Tốt lắm, mình tiếp tục nhé.'), '')
  assert.equal(keepInCharacterReply('Em có thể thêm một chi tiết nữa vào câu vừa rồi không?'), '')
})
