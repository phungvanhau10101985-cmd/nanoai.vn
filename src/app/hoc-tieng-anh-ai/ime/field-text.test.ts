import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyImeSession, imeCommitCandidate, imeComposition, imeFeed, primePinyinLexicon } from './engine'
import { committedFieldText, composeAtCaret, planImeEdit, spliceImeStep } from './field-text'

test('ô gõ bị viết thành câu khác thì lấy câu đang hiện', () => {
  const picked = committedFieldText('我喜欢踢足球', '我还喜欢游泳')
  assert.equal(picked.replacedByKeyboard, true)
  assert.equal(picked.text, '我喜欢踢足球')
})

test('pinyin chưa chốt thì không lấy chuỗi đang gõ dở', () => {
  const picked = committedFieldText('我还喜欢游泳ni', '我还喜欢游泳ni')
  assert.equal(picked.replacedByKeyboard, false)
  assert.equal(picked.text, '我还喜欢游泳ni')
})

test('pinyin đang gõ giữa câu không bị coi là viết đè cả ô', () => {
  const picked = committedFieldText('我hen喜欢', '我hen喜欢')
  assert.equal(picked.replacedByKeyboard, false)
  assert.equal(picked.text, '我hen喜欢')
})

test('chưa sửa thì giữ câu gốc', () => {
  const picked = committedFieldText('我还喜欢游泳', '我还喜欢游泳')
  assert.equal(picked.replacedByKeyboard, false)
  assert.equal(picked.text, '我还喜欢游泳')
})

test('chèn hen giữa 我 và 喜欢 thì nạp pinyin tại chỗ đó', () => {
  const plan = planImeEdit({ base: '我喜欢', composition: '', caret: 3, next: '我hen喜欢' })
  assert.deepEqual(plan, { kind: 'feed-at', caret: 1, text: 'hen' })
  assert.equal(composeAtCaret('我喜欢', 'hen', 1), '我hen喜欢')
})

test('gõ tiếp ở cuối câu vẫn nạp vào cuối', () => {
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: '', caret: 0, next: '我喜欢ni' }), {
    kind: 'feed-at',
    caret: 3,
    text: 'ni',
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'ni', caret: 3, next: '我喜欢nihao' }), {
    kind: 'feed',
    text: 'hao',
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'ni', caret: 3, next: '我喜欢n' }), {
    kind: 'backspace',
    times: 1,
  })
})

test('pinyin đang hiện giữa câu nhận thêm chữ và xóa từng chữ', () => {
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: '我henn喜欢' }), {
    kind: 'feed',
    text: 'n',
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: '我he喜欢' }), {
    kind: 'backspace',
    times: 1,
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: '我喜欢' }), {
    kind: 'backspace',
    times: 3,
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: '我han喜欢' }), {
    kind: 'rebuild-composition',
    text: 'han',
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: '我hen喜欢' }), {
    kind: 'noop',
  })
})

test('xóa chữ đã chốt không kéo theo pinyin đang gõ', () => {
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: '', caret: 2, next: '我欢' }), {
    kind: 'delete-range',
    start: 1,
    end: 2,
  })
  assert.deepEqual(planImeEdit({ base: '我喜欢', composition: 'hen', caret: 1, next: 'hen喜欢' }), {
    kind: 'delete-committed',
    start: 0,
    end: 1,
    caret: 0,
  })
})

test('chữ đã chốt chèn vào đúng con trỏ', () => {
  assert.deepEqual(spliceImeStep('我喜欢', 1, { commit: '很', replace: 0 }), { base: '我很喜欢', caret: 2 })
  assert.deepEqual(spliceImeStep('我喜欢', 2, { commit: '', replace: 1 }), { base: '我欢', caret: 1 })
})

test('chèn hen giữa câu rồi chọn chữ thì chữ nằm giữa', async () => {
  await primePinyinLexicon()
  const plan = planImeEdit({ base: '我喜欢', composition: '', caret: 99, next: '我hen喜欢' })
  assert.equal(plan.kind, 'feed-at')
  if (plan.kind !== 'feed-at') return
  const fed = imeFeed('zh', emptyImeSession(), plan.text)
  assert.equal(fed.session.raw, 'hen')
  assert.equal(composeAtCaret('我喜欢', imeComposition('zh', fed.session), plan.caret), '我hen喜欢')
  const picked = imeCommitCandidate('zh', fed.session, 0)
  const spliced = spliceImeStep('我喜欢', plan.caret, picked)
  assert.equal(spliced.base.includes('hen'), false)
  assert.equal(spliced.base.startsWith('我'), true)
  assert.equal(spliced.base.endsWith('喜欢'), true)
  assert.equal(spliced.base.length > '我喜欢'.length, true)
  assert.equal(spliced.caret, 1 + picked.commit.length)
})

test('romaji và hangul giữa câu cũng vào bộ gõ tại con trỏ', () => {
  const ja = planImeEdit({ base: '私は', composition: '', caret: 0, next: '私waは' })
  assert.deepEqual(ja, { kind: 'feed-at', caret: 1, text: 'wa' })
  const kana = imeFeed('ja', emptyImeSession(), 'wa')
  assert.equal(composeAtCaret('私は', imeComposition('ja', kana.session), 1), '私わは')

  const ko = planImeEdit({ base: '가나', composition: '', caret: 0, next: '가r나' })
  assert.deepEqual(ko, { kind: 'feed-at', caret: 1, text: 'r' })
  const hangul = imeFeed('ko', emptyImeSession(), 'r')
  assert.equal(composeAtCaret('가나', imeComposition('ko', hangul.session), 1), '가ㄱ나')

  const th = imeFeed('th', emptyImeSession(), 'a')
  assert.deepEqual(spliceImeStep('กข', 1, th), { base: 'กฟข', caret: 2 })
})
