import assert from 'node:assert/strict'
import test from 'node:test'

import { formatLandingCustomerBrief } from '@/lib/hub-chat/landing-page-ai-prompt-optimizer'
import { emptyStudioSession, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

test('formatLandingCustomerBrief includes discovery fields and section copy', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'landing_page',
    briefNotes: {
      product_name: 'Áo Polo Bamboo Cool Flex — 188 Official',
      value_prop: 'Pain: xù lông · Lợi ích: Bamboo mát · Giá: 350k',
      target_audience: 'Nam 22–40',
      style_mood: 'Nam tính, hiện đại',
      color_palette: 'Navy + trắng + cam',
    },
  }

  const brief = formatLandingCustomerBrief({
    locale: 'vi',
    session,
    sectionCopy: 'Hero mạnh + FAQ 4 câu',
  })

  assert.ok(brief.includes('Áo Polo Bamboo'))
  assert.ok(brief.includes('Pain: xù lông'))
  assert.ok(brief.includes('Hero mạnh'))
})

test('formatLandingCustomerBrief empty when no notes', () => {
  const session: HubStudioSession = {
    ...emptyStudioSession(),
    presetId: 'landing_page',
    briefNotes: {},
  }
  assert.equal(formatLandingCustomerBrief({ locale: 'en', session }), '')
})
