import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdvisoryPayload, tagWorkflowFlowMeta } from '@/lib/hub-chat/hub-advisory'
import {
  buildStandaloneFeatureEntries,
  matchFeatureFlowByMessage,
} from '@/lib/hub-chat/hub-feature-flow-registry'

test('matchFeatureFlowByMessage prefers studio preset over standalone href', () => {
  const match = matchFeatureFlowByMessage('tạo giao diện web cho spa', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'landing_page')
})

test('matchFeatureFlowByMessage resolves standalone restore image tool', () => {
  const match = matchFeatureFlowByMessage('phục hồi ảnh cũ bị mờ', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/phuc-dung-anh')
})

test('tạo giáo trình maps to create curriculum tool not my curricula', () => {
  const match = matchFeatureFlowByMessage('tạo giáo trình', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-giao-trinh')
})

test('mở giáo trình maps to my curricula viewer', () => {
  const match = matchFeatureFlowByMessage('mở giáo trình', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/giao-trinh')
})

test('standalone catalog covers nav tools and advisory extras', () => {
  const entries = buildStandaloneFeatureEntries('vi')
  assert.ok(entries.some((e) => e.href === '/lam-net-anh'))
  assert.ok(entries.some((e) => e.href === '/thiet-ke-tui-dung'))
  assert.ok(entries.some((e) => e.href === '/flow-nhac-video-veo'))
})

test('buildAdvisoryPayload injects standalone workflow when message matches', async () => {
  const result = await buildAdvisoryPayload({
    locale: 'vi',
    userId: 'user-1',
    threadId: 'thread-1',
    message: 'phục hồi ảnh cũ bị mờ',
    hubRoute: 'consultation',
    workflowsRaw: [],
    planRaw: null,
  })
  assert.ok(result.workflows.some((w) => w.href === '/phuc-dung-anh'))
  assert.equal(result.workflows[0]?.requiresOpenConfirm, true)
})

test('tagWorkflowFlowMeta marks catalog hrefs as requiring confirm', () => {
  const tagged = tagWorkflowFlowMeta(
    [
      {
        href: '/tao-banner',
        labelKey: 'create_banner',
        label: 'Banner',
        reason: 'test',
        prefillPrompt: 'sale',
        confidence: 0.8,
      },
    ],
    'vi'
  )
  assert.equal(tagged[0]?.requiresOpenConfirm, true)
  assert.equal(tagged[0]?.flowKind, 'standalone')
})
