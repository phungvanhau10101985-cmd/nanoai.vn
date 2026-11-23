import assert from 'node:assert/strict'
import test from 'node:test'
import { isStudentCode, normalizeStudentCode, parseRosterMatrix, rosterBirthToIso } from './class-roster'

test('student code folds spaces and case', () => {
  assert.equal(normalizeStudentCode(' hs 12 '), 'HS12')
  assert.equal(isStudentCode('HS12'), true)
  assert.equal(isStudentCode('AB'), false)
  assert.equal(isStudentCode('HS-1'), false)
})

test('birth dates accept day-first and excel serial', () => {
  assert.equal(rosterBirthToIso('15/03/2012'), '2012-03-15')
  assert.equal(rosterBirthToIso('2012-03-15'), '2012-03-15')
  assert.equal(rosterBirthToIso(40983), '2012-03-15')
})

test('import keeps the last row for one code and skips a missing code', () => {
  const parsed = parseRosterMatrix([
    ['STT', 'Họ và tên', 'Ngày tháng năm sinh', 'Mã định danh cá nhân'],
    [1, 'Nguyễn Văn An', '15/03/2012', 'HS0001'],
    [2, 'Trần Thị Bình', '01/01/2013', ''],
    [3, 'Nguyễn An Mới', '16/03/2012', 'hs0001'],
    [4, 'Lê', '02/02/2011', 'BAD'],
  ])
  assert.equal(parsed.rows.length, 1)
  assert.equal(parsed.rows[0]?.name, 'Nguyễn An Mới')
  assert.equal(parsed.rows[0]?.studentCode, 'HS0001')
  assert.equal(parsed.rows[0]?.sortNo, 3)
  assert.deepEqual(
    parsed.errors.map((item) => item.code),
    ['missing_code', 'bad_code']
  )
})

test('the short identifier header still maps to the code column', () => {
  const parsed = parseRosterMatrix([
    ['STT', 'Họ và tên', 'Ngày sinh', 'Mã định danh'],
    [1, 'Nguyễn Văn An', '15/03/2012', 'HS0001'],
  ])
  assert.equal(parsed.rows[0]?.studentCode, 'HS0001')
})

test('a sheet without the identifier column is rejected', () => {
  const parsed = parseRosterMatrix([['STT', 'Họ và tên'], [1, 'An']])
  assert.equal(parsed.rows.length, 0)
  assert.equal(parsed.errors[0]?.code, 'missing_code_column')
})
