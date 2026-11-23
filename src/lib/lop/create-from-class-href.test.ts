import assert from 'node:assert/strict'
import test from 'node:test'
import { pickClassIdForExamForm, resolveExamClassPreset } from './create-from-class-href'

const class12A = '4306b3dd-13f3-48d8-b5e7-03b47d56b170'
const tutoring = '345e22ce-95c2-45a5-a39b-8a791a73acf6'

test('tạo bài từ lớp đang mở, không lấy lớp học thêm mới nhất', () => {
  assert.equal(
    pickClassIdForExamForm({
      urlClassId: class12A,
      previousClassId: tutoring,
      classIds: [tutoring, class12A],
    }),
    class12A
  )
})

test('không có classId trên URL thì giữ lớp form đã nhớ', () => {
  assert.equal(
    pickClassIdForExamForm({
      urlClassId: '',
      previousClassId: tutoring,
      classIds: [tutoring, class12A],
    }),
    tutoring
  )
})

test('danh sách lớp chưa về thì không đổi sang lớp khác', () => {
  assert.equal(
    pickClassIdForExamForm({
      urlClassId: class12A,
      previousClassId: tutoring,
      classIds: [],
    }),
    class12A
  )
})

test('query trên thanh địa chỉ thắng props cũ và hook cũ', () => {
  const preset = resolveExamClassPreset({
    searchParams: {
      get: (name: string) => (name === 'classId' ? tutoring : ''),
    },
    windowSearch: `?classId=${class12A}&subject=toan&grade=lop-12`,
    fromProps: { classId: tutoring, subjectId: 'van', gradeLevelId: 'lop-10' },
  })
  assert.deepEqual(preset, { classId: class12A, subjectId: 'toan', gradeLevelId: 'lop-12' })
})
