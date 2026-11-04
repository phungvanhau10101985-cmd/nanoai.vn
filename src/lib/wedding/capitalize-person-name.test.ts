import assert from 'node:assert/strict'
import test from 'node:test'
import { capitalizeInvitationPersonName } from './capitalize-person-name'

test('capitalizeInvitationPersonName writes each word of a proper name', () => {
  assert.equal(capitalizeInvitationPersonName('nguyễn châm'), 'Nguyễn Châm')
  assert.equal(capitalizeInvitationPersonName('văn khánh'), 'Văn Khánh')
  assert.equal(capitalizeInvitationPersonName('  NGUYỄN   CHÂM '), 'Nguyễn Châm')
  assert.equal(capitalizeInvitationPersonName('đặng'), 'Đặng')
  assert.equal(capitalizeInvitationPersonName('anh-thư'), 'Anh-Thư')
  assert.equal(capitalizeInvitationPersonName('Phùng Hậu'), 'Phùng Hậu')
  assert.equal(capitalizeInvitationPersonName('   '), '')
})
