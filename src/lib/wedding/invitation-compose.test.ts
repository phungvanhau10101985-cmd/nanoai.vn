import assert from 'node:assert/strict'
import test from 'node:test'
import {
  invitationComposeBrief,
  invitationComposeNamesReady,
  invitationComposeRequiresSecondary,
} from './invitation-compose'
import { INVITATION_OCCASION_KEYS } from './invitation-occasion'
import { buildWeddingSampleComposePrompt } from './wedding-sample-compose'
import { buildWeddingPolishUserPrompt } from './wedding-text-polish-deepseek'

test('every occasion has a compose form and AI structure of its own', () => {
  for (const key of INVITATION_OCCASION_KEYS) {
    const brief = invitationComposeBrief(key)
    assert.equal(brief.occasionKey, key)
    assert.ok(brief.title.includes('Điền thông tin'))
    assert.ok(brief.needNames.trim())
    assert.ok(brief.dateLabel.trim())
    assert.ok(brief.introBrief.startsWith('coupleIntro:'))
    assert.ok(brief.quoteBrief.startsWith('loveQuote:'))
    assert.ok(brief.storyBrief.startsWith('storyText:'))
    assert.ok(brief.thanksBrief.startsWith('thankYouText:'))
    assert.ok(brief.suggestions.length > 0)
    assert.equal(brief.requireSecondary, invitationComposeRequiresSecondary(key))
  }
})

test('couple invitations need two names; single invitations need the primary name', () => {
  assert.equal(invitationComposeNamesReady({ occasionKey: 'wedding', primaryName: 'Minh', secondaryName: 'Lan' }), true)
  assert.equal(invitationComposeNamesReady({ occasionKey: 'wedding', primaryName: 'Minh', secondaryName: '' }), false)
  assert.equal(invitationComposeNamesReady({ occasionKey: 'engagement', primaryName: 'Minh', secondaryName: '' }), false)
  assert.equal(invitationComposeNamesReady({ occasionKey: 'birthday', primaryName: 'An', secondaryName: '' }), true)
  assert.equal(invitationComposeNamesReady({ occasionKey: 'grand_opening', primaryName: '', secondaryName: 'A' }), false)
})

test('birthday compose does not write a wedding and keeps birthday structure', () => {
  const prompt = buildWeddingSampleComposePrompt({
    groomName: 'An',
    brideName: '',
    storyNotes: 'Tuổi / cột mốc: 30',
    occasionKey: 'birthday',
  })
  assert.match(prompt, /Loại thiệp: Sinh nhật/)
  assert.match(prompt, /Không viết như thiệp cưới/)
  assert.match(prompt, /mừng sinh nhật/)
  assert.match(prompt, /Tuổi \/ cột mốc: 30/)
  assert.doesNotMatch(prompt, /duyên hạnh ngộ/)
})

test('grand opening compose asks for a shop, not a couple', () => {
  const prompt = buildWeddingSampleComposePrompt({
    groomName: 'Tiệm Hoa Sen',
    brideName: '',
    storyNotes: '',
    occasionKey: 'grand_opening',
  })
  assert.match(prompt, /Loại thiệp: Khai trương/)
  assert.match(prompt, /Cửa hàng: Tiệm Hoa Sen/)
  assert.match(prompt, /lễ khai trương/)
})

test('polish of a birthday draft stays on birthday', () => {
  const prompt = buildWeddingPolishUserPrompt({
    field: 'coupleIntro',
    draft: 'Mời bạn đến sinh nhật An.',
    groomName: 'An',
    weddingDate: '2026-12-01',
    occasionKey: 'birthday',
  })
  assert.match(prompt, /Loại thiệp: Sinh nhật/)
  assert.match(prompt, /Ngày sinh nhật: 2026-12-01/)
  assert.doesNotMatch(prompt, /Ngày cưới/)
})
