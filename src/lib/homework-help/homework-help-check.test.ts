import assert from 'node:assert/strict'
import test from 'node:test'
import {
  answersAgree,
  matchingDeepSeekAnswer,
  mergeAdjudicatedProblem,
  mergeCheckedProblem,
  mergeVisionPair,
  shownAnswerMark,
  alignSameVerdicts,
  alignSolverAnswers,
  parseHomeworkChecks,
  parseHomeworkPicks,
  parseHomeworkSame,
  parseHomeworkSide,
  parseModelJson,
} from '@/lib/homework-help/homework-help-check'
import {
  homeworkReadIsThin,
  homeworkStatementFingerprint,
  homeworkStatementNeedsPhoto,
  normalizeHomeworkStatement,
  splitTypedHomework,
} from '@/lib/homework-help/homework-help-fingerprint'

const draft = {
  statement: 'Giải 2x + 3 = 7',
  knowledge: ['Phương trình bậc nhất một ẩn', 'Nghiệm là 2'],
  thinking: ['Chuyển 3 sang vế kia', 'Ra x = 2'],
  hints: ['Vế kia còn 4'],
  answer: 'x = 2',
  tags: [
    { key: 'linear-equation', title: 'Phương trình bậc nhất' },
    { key: 'the-root', title: 'Nghiệm là 2' },
  ],
}

test('same problem text shares a fingerprint after numbering and spacing changes', () => {
  const left = normalizeHomeworkStatement('Câu 1. Giải 2x + 3 = 7.')
  const right = normalizeHomeworkStatement('1) giải 2x+3=7')
  assert.equal(left, right)
  assert.equal(homeworkStatementFingerprint('Câu 1. Giải 2x + 3 = 7.'), homeworkStatementFingerprint('1) giải 2x+3=7'))
  assert.notEqual(homeworkStatementFingerprint('Giải 2x + 3 = 7'), homeworkStatementFingerprint('Giải 2x + 3 = 8'))
})

test('typed homework splits blank lines and question labels, and matches a photo statement', () => {
  assert.deepEqual(splitTypedHomework('Giải 2x + 3 = 7'), ['Giải 2x + 3 = 7'])
  assert.deepEqual(splitTypedHomework('Giải 2x + 3 = 7\n\nTính 3 × 4'), ['Giải 2x + 3 = 7', 'Tính 3 × 4'])
  assert.deepEqual(splitTypedHomework('Câu 1. Giải 2x + 3 = 7\nCâu 2. Tính 3 × 4'), [
    'Câu 1. Giải 2x + 3 = 7',
    'Câu 2. Tính 3 × 4',
  ])
  assert.equal(
    homeworkStatementFingerprint(splitTypedHomework('Câu 1. Giải 2x + 3 = 7.')[0] ?? ''),
    homeworkStatementFingerprint('1) giải 2x+3=7')
  )
})

test('answers agree on spacing and on the value after equals', () => {
  assert.equal(answersAgree('x = 2', 'X=2'), true)
  assert.equal(answersAgree('x = 2', '2'), true)
  assert.equal(answersAgree('x = 2', 'x = 3'), false)
  assert.equal(answersAgree('', '2'), false)
  assert.equal(answersAgree('Fe(NO₃)₃', 'Fe(NO3)3'), true)
  assert.equal(answersAgree('FeCO3 5,695 g', 'FeCO3 5,70 g'), true)
  assert.equal(answersAgree('FeCO3 5,695 g', 'FeCO3 8 g'), false)
  assert.equal(
    answersAgree(
      'Fe(NO3)3 ; FeCO3 + 4HNO3 → Fe(NO3)3 + CO2 + NO2 + 2H2O | FeCO3 4,64 g; FeS2 0,96 g | 23,89 ml',
      'Fe(NO3)3 | FeCO3 4,64 g ; FeS2 0,96 g | 23,9 ml',
      'Hỗn hợp FeCO3 và FeS2 tác dụng HNO3 tạo CO2, NO2, H2O. 540 ml, 7,568 gam'
    ),
    true
  )
})

const chemistryWithMarks =
  'Câu V (2,0 điểm) Hỗn hợp A gồm FeCO₃ và FeS₂. HNO₃ 63% (1,44 g/ml). FeCO₃ + HNO₃ → CO₂ + NO₂ + H₂O (1) FeS₂ + HNO₃ → H₂SO₄ + NO₂ + H₂O (2). Tỉ khối 1,425. 540 ml Ba(OH)₂ 0,2M. 7,568 gam BaSO₄. 1. X là muối gì? 2. Tính khối lượng. 3. Thể tích HNO₃.'
const chemistryPlain =
  'Hỗn hợp A gồm FeCO3 và FeS2. HNO3 63% (1.44 g/ml). FeCO3 + HNO3 → CO2 + NO2 + H2O FeS2 + HNO3 → H2SO4 + NO2 + H2O. Tỉ khối 1.425. 540 ml Ba(OH)2 0.2M. 7.568 gam BaSO4. X là muối gì? Tính khối lượng. Thể tích HNO3.'

test('the same chemistry problem matches after subscripts, scores, and question numbers change', () => {
  assert.equal(homeworkStatementFingerprint(chemistryWithMarks), homeworkStatementFingerprint(chemistryPlain))
  assert.notEqual(
    homeworkStatementFingerprint(chemistryPlain),
    homeworkStatementFingerprint(chemistryPlain.replace('7,568', '8,000').replace('7.568', '8.000'))
  )
  assert.notEqual(
    homeworkStatementFingerprint('X là muối gì? Hoàn thành các phương trình phản ứng (1) và (2).'),
    homeworkStatementFingerprint(chemistryPlain)
  )
})

test('a photo read of only the questions is thin', () => {
  assert.equal(
    homeworkReadIsThin([
      'X là muối gì? Hoàn thành các phương trình phản ứng (1) và (2).',
      'Tính khối lượng từng chất trong hỗn hợp A.',
      'Xác định thể tích dung dịch HNO3 đã dùng.',
    ]),
    true
  )
  assert.equal(homeworkReadIsThin([chemistryPlain]), false)
  assert.equal(homeworkReadIsThin(['Giải 2x + 3 = 7']), false)
})

test('a bare check array still parses', () => {
  const parsed = parseModelJson(
    '[{"index":0,"answer":"","knowledge":[{"index":0,"ok":true}]},{"index":1,"answer":"Fe(NO3)3","knowledge":[]}]'
  )
  const checks = parseHomeworkChecks(parsed)
  assert.equal(checks?.length, 2)
  assert.equal(checks?.[1]?.answer, 'Fe(NO3)3')
  assert.equal(checks?.[0]?.knowledge[0]?.ok, true)
})

test('a matching chemistry answer stays visible but steps do not spoil the new results', () => {
  const merged = mergeCheckedProblem(
    {
      statement: 'Hỗn hợp FeCO3',
      knowledge: ['HNO3 đặc oxi hóa Fe lên Fe(III)'],
      thinking: ['Muối X là Fe(NO3)3', 'Lập phương trình khí'],
      hints: ['Khối lượng FeCO3 là 4,64 g'],
      answer: 'Fe(NO3)3 | FeCO3 4,64 g',
      tags: [{ key: 'nitric-acid', title: 'HNO3 đặc' }],
    },
    {
      index: 0,
      answer: 'Fe(NO3)3 | FeCO3 4.64 g',
      knowledge: [{ index: 0, ok: true }],
    }
  )
  assert.equal(merged.cacheable, true)
  assert.equal(merged.problem.answer, 'Fe(NO3)3 | FeCO3 4,64 g')
  assert.deepEqual(merged.problem.knowledge, ['HNO3 đặc oxi hóa Fe lên Fe(III)'])
  assert.deepEqual(merged.problem.thinking, ['Lập phương trình khí'])
  assert.deepEqual(merged.problem.hints, [])
})

test('cross-check keeps the knowledge lines and a matching answer', () => {
  const merged = mergeCheckedProblem(draft, {
    index: 0,
    answer: '2',
    knowledge: [],
  })
  assert.equal(merged.cacheable, true)
  assert.deepEqual(merged.problem.knowledge, ['Phương trình bậc nhất một ẩn', 'Nghiệm là 2'])
  assert.equal(merged.problem.answer, 'x = 2')
  assert.equal(merged.problem.thinking.length, 2)
  assert.deepEqual(merged.problem.tags, [{ key: 'linear-equation', title: 'Phương trình bậc nhất' }])
})

test('disagreement hides the answer and drops a step that leaks it', () => {
  const merged = mergeCheckedProblem(draft, {
    index: 0,
    answer: 'x = 5',
    knowledge: [],
  })
  assert.equal(merged.problem.answer, '')
  assert.deepEqual(merged.problem.thinking, ['Chuyển 3 sang vế kia'])
  assert.equal(merged.cacheable, false)
})

test('a failed check does not keep knowledge or an answer to cache', () => {
  const merged = mergeCheckedProblem(draft, null)
  assert.equal(merged.cacheable, false)
  assert.deepEqual(merged.problem.knowledge, [])
  assert.deepEqual(merged.problem.tags, [])
  assert.equal(merged.problem.answer, '')
  assert.equal(merged.problem.statement, draft.statement)
})

test('a judge that confirms the check answer shows that side and does not cache it', () => {
  const merged = mergeAdjudicatedProblem(
    draft,
    { index: 0, answer: 'x = 5', knowledge: [] },
    { index: 0, pick: 'check', answer: 'x = 5' }
  )
  assert.equal(merged.cacheable, false)
  assert.equal(merged.problem.answer, 'x = 5')
  assert.deepEqual(merged.problem.thinking, ['Chuyển 3 sang vế kia'])
  assert.deepEqual(merged.problem.knowledge, ['Phương trình bậc nhất một ẩn'])
  assert.deepEqual(merged.problem.tags, [{ key: 'linear-equation', title: 'Phương trình bậc nhất' }])
})

test('a judge that confirms the draft answer shows the draft wording', () => {
  const merged = mergeAdjudicatedProblem(
    draft,
    { index: 0, answer: 'x = 5', knowledge: [] },
    { index: 0, pick: 'draft', answer: '2' }
  )
  assert.equal(merged.problem.answer, 'x = 2')
  assert.equal(merged.cacheable, false)
  assert.deepEqual(merged.problem.thinking, ['Chuyển 3 sang vế kia'])
})

test('a judge that writes a third answer hides the result', () => {
  const merged = mergeAdjudicatedProblem(
    draft,
    { index: 0, answer: 'x = 5', knowledge: [] },
    { index: 0, pick: 'check', answer: 'x = 9' }
  )
  assert.equal(merged.problem.answer, '')
  assert.equal(merged.cacheable, false)
})

test('a judge that cannot choose hides the result', () => {
  const merged = mergeAdjudicatedProblem(draft, { index: 0, answer: 'x = 5', knowledge: [] }, {
    index: 0,
    pick: 'none',
    answer: '',
  })
  assert.equal(merged.problem.answer, '')
  assert.equal(merged.cacheable, false)
  assert.deepEqual(merged.problem.thinking, ['Chuyển 3 sang vế kia'])
})

test('a trusted check keeps the draft answer when the wording differs', () => {
  const merged = mergeCheckedProblem(draft, { index: 0, answer: 'C3H5(OCOH)3', knowledge: [] }, { trust: true })
  assert.equal(merged.cacheable, true)
  assert.equal(merged.problem.answer, draft.answer)
})

test('a trusted third answer is shown when it matches the other side', () => {
  const merged = mergeAdjudicatedProblem(
    draft,
    { index: 0, answer: 'x = 5', knowledge: [] },
    { index: 0, pick: 'check', answer: 'C3H5(OCOH)3' },
    { trust: true }
  )
  assert.equal(merged.problem.answer, 'C3H5(OCOH)3')
  assert.equal(merged.cacheable, false)
})

test('same and side judges parse only the listed problems', () => {
  const same = parseHomeworkSame({
    problems: [
      { index: 0, same: true },
      { index: 1, same: false },
      { index: 9, same: true },
    ],
  })
  assert.equal(same?.length, 2)
  assert.equal(same?.[0]?.same, true)
  assert.equal(same?.[1]?.same, false)
  const sides = parseHomeworkSide({
    problems: [
      { index: 0, side: 'Draft' },
      { index: 1, side: 'maybe' },
    ],
  })
  assert.equal(sides?.[0]?.side, 'draft')
  assert.equal(sides?.[1]?.side, 'none')
})

test('gemini pro keeps the deepseek answer it matches', () => {
  assert.equal(matchingDeepSeekAnswer('x = 2', 'x = 5', '2', draft.statement), 'draft')
  assert.equal(matchingDeepSeekAnswer('x = 2', 'x = 5', 'x = 5', draft.statement), 'check')
  assert.equal(matchingDeepSeekAnswer('x = 2', 'x = 5', 'x = 9', draft.statement), '')
  assert.equal(matchingDeepSeekAnswer('x = 2', 'x = 5', '', draft.statement), '')
  assert.equal(matchingDeepSeekAnswer('x = 2', 'x = 2', '2', draft.statement), 'draft')
})

test('judge parser keeps a side and drops an unknown index', () => {
  const picks = parseHomeworkPicks({
    problems: [
      { index: 0, pick: 'Check', answer: 'x = 5' },
      { index: 9, pick: 'draft', answer: '2' },
    ],
  })
  assert.equal(picks?.length, 1)
  assert.equal(picks?.[0]?.pick, 'check')
  assert.equal(picks?.[0]?.answer, 'x = 5')
})

test('the visible answer is marked with the model that wrote it', () => {
  assert.equal(shownAnswerMark({ pictured: true, visionAgreed: true, agreed: false, side: 'check', hasAnswer: true }), 'P')
  assert.equal(shownAnswerMark({ pictured: false, visionAgreed: false, agreed: true, side: '', hasAnswer: true }), 'D')
  assert.equal(shownAnswerMark({ pictured: false, visionAgreed: false, agreed: false, side: 'draft', hasAnswer: true }), 'D')
  assert.equal(shownAnswerMark({ pictured: false, visionAgreed: false, agreed: false, side: 'check', hasAnswer: true }), 'P')
  assert.equal(shownAnswerMark({ pictured: true, visionAgreed: false, agreed: false, side: '', hasAnswer: false }), '')
})

test('a same-result verdict keeps the asked index when the model copies the example index', () => {
  assert.deepEqual([...alignSameVerdicts([1], [{ index: 0, same: true }])], [1])
  assert.deepEqual([...alignSameVerdicts([1], [{ index: 1, same: true }])], [1])
  assert.deepEqual([...alignSameVerdicts([1], [{ index: 0, same: false }])], [])
  assert.deepEqual([...alignSameVerdicts([0, 2], [{ index: 0, same: true }, { index: 2, same: false }])], [0])
})

test('a figure problem shows the gpt write-up only when both vision models agree', () => {
  const guide = {
    statement: 'Mạch dao động (hình 1). Tính dòng cực đại.',
    knowledge: ['Năng lượng dao động bảo toàn'],
    thinking: ['Đổi vị trí khoá rồi viết chu kỳ'],
    hints: ['Năng lượng tụ và cuộn bằng nhau sau mỗi phần tư chu kỳ'],
    answer: 'I = 9 A',
    tags: [{ key: 'lc-circuit', title: 'Mạch dao động LC' }],
  }
  const agreed = mergeVisionPair(guide, 'x = 2', 'X = 2')
  assert.equal(agreed.agreed, true)
  assert.equal(agreed.cacheable, true)
  assert.equal(agreed.problem.answer, 'X = 2')
  assert.deepEqual(agreed.problem.knowledge, ['Năng lượng dao động bảo toàn'])
  assert.deepEqual(agreed.problem.thinking, ['Đổi vị trí khoá rồi viết chu kỳ'])

  const split = mergeVisionPair(guide, 'x = 2', 'x = 9')
  assert.equal(split.agreed, false)
  assert.equal(split.cacheable, false)
  assert.equal(split.problem.answer, '')
  assert.deepEqual(split.problem.knowledge, ['Năng lượng dao động bảo toàn'])

  const trusted = mergeVisionPair(guide, 'x = 2', 'hai', { trust: true })
  assert.equal(trusted.agreed, true)
  assert.equal(trusted.problem.answer, 'hai')
})

test('only a problem that cites a printed figure needs the photo', () => {
  assert.equal(
    homeworkStatementNeedsPhoto(
      'Trong mạch dao động (hình 1) bộ tụ điện gồm hai tụ C1. Chuyển khoá K từ vị trí 1 sang vị trí 2.'
    ),
    true
  )
  assert.equal(homeworkStatementNeedsPhoto('Xem hình vẽ bên và tính cường độ dòng điện.'), true)
  assert.equal(homeworkStatementNeedsPhoto('As shown in the figure, find the current.'), true)
  assert.equal(
    homeworkStatementNeedsPhoto(
      'Điện tích dao động theo q = Q0 sinωt. Viết biểu thức năng lượng. Vẽ đồ thị phụ thuộc thời gian.'
    ),
    false
  )
  assert.equal(homeworkStatementNeedsPhoto('Giải phương trình 2x + 3 = 7.'), false)
  assert.equal(homeworkStatementNeedsPhoto('Phản ứng hình thành kết tủa AgCl.'), false)
})

test('solver answers stay on the requested index', () => {
  const aligned = alignSolverAnswers(
    [0, 1],
    [
      { index: 0, answer: 'x = 2', knowledge: [] },
      { index: 1, answer: '  ', knowledge: [] },
    ]
  )
  assert.equal(aligned.get(0), 'x = 2')
  assert.equal(aligned.has(1), false)
})

test('a 1-based batch shifts back when no requested index hit', () => {
  const aligned = alignSolverAnswers(
    [0, 1],
    [
      { index: 1, answer: 'W = 4 J', knowledge: [] },
      { index: 2, answer: 'I = 0,393 A', knowledge: [] },
    ]
  )
  assert.equal(aligned.get(0), 'W = 4 J')
  assert.equal(aligned.get(1), 'I = 0,393 A')
})

test('unrelated indexes follow answer order only when every requested index missed', () => {
  const aligned = alignSolverAnswers(
    [0, 1],
    [
      { index: 4, answer: 'first', knowledge: [] },
      { index: 5, answer: 'second', knowledge: [] },
    ]
  )
  assert.equal(aligned.get(0), 'first')
  assert.equal(aligned.get(1), 'second')
})

test('one answer at the second index stays there', () => {
  const aligned = alignSolverAnswers([0, 1], [{ index: 1, answer: 'only the second', knowledge: [] }])
  assert.equal(aligned.has(0), false)
  assert.equal(aligned.get(1), 'only the second')
})

test('one exact hit is kept and the other index is left blank for a retry', () => {
  const aligned = alignSolverAnswers(
    [0, 1],
    [
      { index: 0, answer: 'x = 2', knowledge: [] },
      { index: 5, answer: 'other', knowledge: [] },
    ]
  )
  assert.equal(aligned.get(0), 'x = 2')
  assert.equal(aligned.has(1), false)
})

test('check parser ignores a line the model did not mark', () => {
  const checks = parseHomeworkChecks({
    problems: [{ index: 1, answer: 'A', knowledge: [{ index: 0, ok: true }, { index: 9, ok: true }] }],
  })
  assert.equal(checks?.[0]?.index, 1)
  assert.equal(checks?.[0]?.knowledge.length, 1)
})
