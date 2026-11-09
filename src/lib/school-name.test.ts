import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterSchoolSuggestions,
  resolveSchoolNameVote,
  schoolIdentityKey,
  schoolSuggestionContainsQuery,
  shouldSuggestMoreSchools,
} from './school-name'

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

test('đủ 7 phiếu cho tên vừa chọn thì giữ tên đó', () => {
  assert.equal(resolveSchoolNameVote(6, 1, 'original'), null)
  assert.equal(resolveSchoolNameVote(7, 1, 'original'), 'original')
  assert.equal(resolveSchoolNameVote(2, 7, 'edited'), 'edited')
  assert.equal(resolveSchoolNameVote(7, 7, 'edited'), 'edited')
})

test('viết tắt và viết đủ cùng cấp cùng tên riêng thì một khóa', () => {
  assert.equal(schoolIdentityKey('Trường THPT Quảng Oai'), 'thpt|quang oai')
  assert.equal(schoolIdentityKey('Trường Trung học phổ thông Quảng Oai'), 'thpt|quang oai')
  assert.equal(schoolIdentityKey('THPT Quảng Oai'), 'thpt|quang oai')
  assert.equal(schoolIdentityKey('Trường THPT huyện Quảng Oai'), 'thpt|quang oai')
  assert.equal(schoolIdentityKey('Trường THPT thành phố Quảng Oai'), 'thpt|quang oai')
  assert.equal(schoolIdentityKey('Trường THCS Quảng Oai'), 'thcs|quang oai')
  assert.equal(schoolIdentityKey('Trường Trung học cơ sở Quảng Oai'), 'thcs|quang oai')
  assert.equal(schoolIdentityKey('Trường Tiểu học Quảng Oai'), 'tieu hoc|quang oai')
  assert.equal(schoolIdentityKey('Trường TH Quảng Oai'), 'tieu hoc|quang oai')
  assert.equal(schoolIdentityKey('Trường Mầm non Hoa Mai'), 'mam non|hoa mai')
  assert.equal(schoolIdentityKey('Trường MN Hoa Mai'), 'mam non|hoa mai')
  assert.equal(schoolIdentityKey('Trường THPT chuyên Nguyễn Huệ'), 'thpt|chuyen nguyen hue')
  assert.notEqual(
    schoolIdentityKey('Trường THPT chuyên Nguyễn Huệ'),
    schoolIdentityKey('Trường THPT Nguyễn Huệ')
  )
  assert.equal(schoolIdentityKey('Trường THPT Hà Tĩnh'), 'thpt|ha tinh')
  assert.equal(schoolIdentityKey('Trường THPT tỉnh Hà Tĩnh'), 'thpt|ha tinh')
  assert.equal(schoolIdentityKey('Trường THPT Tĩnh Gia'), 'thpt|tinh gia')
  assert.notEqual(schoolIdentityKey('Trường TH An Khánh'), schoolIdentityKey('Trường Trần Hữu An Khánh'))
  assert.notEqual(schoolIdentityKey('Trường THPT An Dương'), schoolIdentityKey('Trường Trần Hoàng Phúc Thịnh An Dương'))
})

test('hai cách viết một trường chỉ hiện một dòng, khác cấp vẫn giữ', () => {
  const names = filterSchoolSuggestions(
    [
      'Trường THPT Quảng Oai',
      'Trường Trung học phổ thông Quảng Oai',
      'Trường THCS Quảng Oai',
      'Trường Tiểu học Quảng Oai',
    ],
    'quảng oai'
  )
  assert.deepEqual(names, [
    'Trường THPT Quảng Oai',
    'Trường THCS Quảng Oai',
    'Trường Tiểu học Quảng Oai',
  ])
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
