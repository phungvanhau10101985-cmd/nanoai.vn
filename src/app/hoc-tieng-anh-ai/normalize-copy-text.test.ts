import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCopyText } from './normalize-copy-text'

test('chinese mini writing accepts any period or comma', () => {
  const expected = '今天天气很好。'
  assert.equal(normalizeCopyText('今天天气很好.', 'zh'), normalizeCopyText(expected, 'zh'))
  assert.equal(normalizeCopyText('今天天气很好,', 'zh'), normalizeCopyText(expected, 'zh'))
  assert.equal(normalizeCopyText('今天天气很好', 'zh'), normalizeCopyText(expected, 'zh'))
  assert.equal(normalizeCopyText('你好，世界。', 'zh'), normalizeCopyText('你好,世界.', 'zh'))
  assert.equal(normalizeCopyText('你好，世界。', 'zh'), normalizeCopyText('你好世界', 'zh'))
  assert.equal(normalizeCopyText('「你好。」', 'zh'), normalizeCopyText('你好', 'zh'))
  assert.notEqual(normalizeCopyText('你好吗', 'zh'), normalizeCopyText('你好啊。', 'zh'))
})

test('other languages ignore sentence marks and still compare letters', () => {
  assert.equal(normalizeCopyText('こんにちは。', 'ja'), normalizeCopyText('こんにちは.', 'ja'))
  assert.equal(normalizeCopyText('안녕하세요!', 'ko'), normalizeCopyText('안녕하세요.', 'ko'))
  assert.equal(normalizeCopyText('สวัสดีครับ.', 'th'), normalizeCopyText('สวัสดีครับ', 'th'))
  assert.equal(normalizeCopyText('नमस्ते।', 'hi'), normalizeCopyText('नमस्ते.', 'hi'))
  assert.equal(normalizeCopyText('Hello, world.', 'en'), normalizeCopyText('Hello world', 'en'))
  assert.notEqual(normalizeCopyText('Hello world', 'en'), normalizeCopyText('Helloworld', 'en'))
  assert.equal(normalizeCopyText("I don't know.", 'en'), normalizeCopyText("I don't know", 'en'))
  assert.notEqual(normalizeCopyText("I don't know.", 'en'), normalizeCopyText('I dont know.', 'en'))
  assert.equal(normalizeCopyText('Xin chào.', 'vi'), normalizeCopyText('Xin chào', 'vi'))
})
