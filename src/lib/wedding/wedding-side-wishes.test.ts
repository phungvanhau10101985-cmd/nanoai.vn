import assert from 'node:assert/strict'
import test from 'node:test'
import { mergePublishedGuestWishesBySide } from './wedding-side-wishes'

test('guest wishes stay on the invited side', () => {
  const groups = mergePublishedGuestWishesBySide(
    [
      {
        id: 'g1',
        guestHonorific: 'Bạn',
        guestName: 'Đông',
        inviteVenue: 'groom_home',
        wishMessage: 'Chúc nhà trai hạnh phúc.',
      },
      {
        id: 'b1',
        guestHonorific: 'Chị',
        guestName: 'Lan',
        inviteVenue: 'bride_home',
        wishMessage: 'Chúc nhà gái trăm năm.',
      },
    ],
    [],
  )
  assert.deepEqual(
    groups.groom.map((wish) => wish.guestName),
    ['Bạn Đông'],
  )
  assert.equal(groups.groom[0]?.message, 'Chúc nhà trai hạnh phúc.')
  assert.deepEqual(
    groups.bride.map((wish) => wish.guestName),
    ['Chị Lan'],
  )
  assert.equal(groups.other.length, 0)
})

test('a public wish is attached to the matching invited guest side', () => {
  const groups = mergePublishedGuestWishesBySide(
    [
      {
        id: 'g1',
        guestHonorific: 'Bạn',
        guestName: 'Đông',
        inviteVenue: 'groom_home',
        wishMessage: '',
      },
    ],
    [{ id: 'w1', guestName: 'Bạn Đông', message: 'Vạn sự như ý.' }],
  )
  assert.equal(groups.groom.length, 1)
  assert.equal(groups.groom[0]?.message, 'Vạn sự như ý.')
  assert.equal(groups.bride.length, 0)
  assert.equal(groups.other.length, 0)
})

test('the same wish is not listed twice when the guest row already has it', () => {
  const groups = mergePublishedGuestWishesBySide(
    [
      {
        id: 'b1',
        guestHonorific: '',
        guestName: 'Lan',
        inviteVenue: 'bride_home',
        wishMessage: 'Hạnh phúc.',
      },
    ],
    [{ id: 'w1', guestName: 'Lan', message: 'Hạnh phúc.' }],
  )
  assert.equal(groups.bride.length, 1)
  assert.equal(groups.other.length, 0)
})
