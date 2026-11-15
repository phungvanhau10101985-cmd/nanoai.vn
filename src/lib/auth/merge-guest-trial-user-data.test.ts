import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MERGE_TARGETS } from './merge-guest-trial-user-data'
import { parseGuestCreationClaimItems } from './claim-guest-creations'

describe('guest trial merge targets', () => {
  it('moves chat, wedding, house, music and lessons onto the signed-in account', () => {
    const tables = MERGE_TARGETS.map((row) => row.table)
    for (const table of [
      'try_on_history',
      'hub_chat_threads',
      'wedding_cards',
      'house_build_projects',
      'music_generations',
      'homework_sessions',
      'language_coach_messages',
      'worksheet_curricula',
    ]) {
      assert.equal(tables.includes(table), true, table)
    }
  })
})

describe('parseGuestCreationClaimItems', () => {
  it('keeps https output files and drops other urls', () => {
    const items = parseGuestCreationClaimItems({
      items: [
        {
          resultUrls: [
            'https://cdn.nanoai.vn/results/u/studio_1.png',
            'http://cdn.nanoai.vn/results/u/studio_1.png',
            'https://example.com/logo.png',
          ],
          refs: { threadId: '11111111-1111-4111-8111-111111111111', cardId: 'not-a-uuid' },
          feature: 'home',
          route: '/',
          createdAt: 10,
        },
      ],
    })
    assert.equal(items.length, 1)
    assert.deepEqual(items[0]?.resultUrls, ['https://cdn.nanoai.vn/results/u/studio_1.png'])
    assert.equal(items[0]?.refs.threadId, '11111111-1111-4111-8111-111111111111')
    assert.equal(items[0]?.refs.cardId, undefined)
  })
})
