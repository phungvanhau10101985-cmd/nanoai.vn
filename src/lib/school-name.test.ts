import assert from 'node:assert/strict'
import test from 'node:test'
import { filterSchoolSuggestions, schoolSuggestionContainsQuery, shouldSuggestMoreSchools } from './school-name'

test('đề xuất phải chứa cụm giáo viên gõ, bỏ tên không có cụm đó', () => {
  const names = filterSchoolSuggestions(
    [
      'Trường THPT Quảng Oai',
      'Trường THCS Quảng Oai',
      'Trường Tiểu học Quảng Oai',
      'Trường THPT Chu Văn An',
      'Trường THPT Quảng Oai',
    ],
    'quảng oai'
  )
  assert.deepEqual(names, [
    'Trường THPT Quảng Oai',
    'Trường THCS Quảng Oai',
    'Trường Tiểu học Quảng Oai',
  ])
})

test('cụm không có trong tên thì không giữ', () => {
  assert.equal(schoolSuggestionContainsQuery('Trường Chu Văn An', 'quảng oai'), false)
  assert.equal(schoolSuggestionContainsQuery('THPT Quang Oai', 'Quảng Oai'), true)
})

test('một trường khác cụm đang gõ thì vẫn đề xuất thêm, đủ hai trường thì thôi', () => {
  assert.equal(shouldSuggestMoreSchools([], 'quảng oai'), true)
  assert.equal(shouldSuggestMoreSchools(['Trường THPT Quảng Oai'], 'quảng oai'), true)
  assert.equal(shouldSuggestMoreSchools(['Trường THPT Quảng Oai'], 'Trường THPT Quảng Oai'), false)
  assert.equal(
    shouldSuggestMoreSchools(['Tiểu học Quảng Oai', 'THCS Quảng Oai'], 'quảng oai'),
    false
  )
})
