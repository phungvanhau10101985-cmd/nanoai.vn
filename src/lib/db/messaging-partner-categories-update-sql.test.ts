import assert from 'node:assert/strict'
import test from 'node:test'
import { partnerCategoryUpdateByIdSql } from '@/lib/db/messaging-partner-categories-pg'

test('category update SQL binds the category id as $1', () => {
  const sql = partnerCategoryUpdateByIdSql('seo_title = $2, seo_description = $3')
  assert.match(sql, /where id = \$1::uuid/)
  assert.equal(sql.includes('is not null'), false)
  assert.equal(sql.includes('$2::uuid'), false)
  assert.match(sql, /seo_title = \$2/)
  assert.match(sql, /returning /)
})
