import assert from 'node:assert/strict'
import test from 'node:test'
import { canonicalGradeLevelId, teachClassesMatchingGrade } from './curriculum-subjects'

test('giáo trình lớp 6 chỉ ghép lớp khối 6', () => {
  const rows = [
    { classId: 'a', gradeLevelId: 'lop-6' },
    { classId: 'b', gradeLevelId: 'lop-7' },
    { classId: 'c', gradeLevelId: 'lop-6' },
    { classId: 'd', gradeLevelId: '' },
  ]
  const matched = teachClassesMatchingGrade(rows, 'lop-6')
  assert.deepEqual(matched.map((row) => row.classId), ['a', 'c'])
  assert.deepEqual(teachClassesMatchingGrade(rows, 'thcs').map((row) => row.classId), ['a', 'c'])
  assert.equal(canonicalGradeLevelId('thpt'), 'lop-12')
  assert.deepEqual(teachClassesMatchingGrade(rows, 'lop-10'), [])
  assert.deepEqual(teachClassesMatchingGrade(rows, '  '), [])
})
