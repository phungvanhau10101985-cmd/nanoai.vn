import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { attachOpenedCurriculumToAccount } from './attach-opened-curriculum'

describe('attachOpenedCurriculumToAccount', () => {
  it('rejects an id that is not a curriculum uuid', async () => {
    const result = await attachOpenedCurriculumToAccount(
      '11111111-1111-4111-8111-111111111111',
      'not-a-curriculum',
    )
    assert.equal(result.error, 'Mã giáo trình không hợp lệ.')
  })
})
