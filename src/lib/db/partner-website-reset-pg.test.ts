import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPgInvalidPageError,
  isPgJsonbTooLargeError,
  partnerWebsiteResetPgErrorMessage,
  resetTrashAndDeleteSql,
} from './partner-website-reset-pg'

test('reset trash maps XX001 invalid page, not a generic DB error', () => {
  assert.equal(isPgInvalidPageError({ code: 'XX001' }), true)
  assert.equal(isPgInvalidPageError({ message: 'invalid page in block 2445 of relation "base/1/2"' }), true)
  assert.equal(isPgInvalidPageError({ code: '57014' }), false)
  assert.match(partnerWebsiteResetPgErrorMessage({ code: 'XX001' }), /XX001/)
})

test('reset trash maps jsonb 256MB overflow from aggregating revision HTML', () => {
  const e = {
    code: '54000',
    message: 'total size of jsonb object elements exceeds the maximum of 268435455 bytes',
  }
  assert.equal(isPgJsonbTooLargeError(e), true)
  assert.equal(isPgJsonbTooLargeError({ message: e.message }), true)
  assert.match(partnerWebsiteResetPgErrorMessage(e), /quá lớn/)
})

test('reset trash maps statement timeout separately from jsonb overflow', () => {
  assert.match(partnerWebsiteResetPgErrorMessage({ code: '57014' }), /quá lâu/)
  assert.equal(
    partnerWebsiteResetPgErrorMessage({ code: 'XX000', message: 'other' }),
    'Không reset được website do lỗi cơ sở dữ liệu. Thử lại sau.'
  )
})

test('reset snapshot keeps current website and does not jsonb_agg revision HTML', () => {
  const sql = resetTrashAndDeleteSql(true)
  assert.match(sql, /'revisions', '\[\]'::jsonb/)
  assert.doesNotMatch(sql, /jsonb_agg\(to_jsonb\(r\)/)
  assert.match(sql, /messaging_partner_website_revisions/)
  assert.match(sql, /messaging_partner_website_preset_looks/)
  assert.match(resetTrashAndDeleteSql(false), /project_files_json/)
})
