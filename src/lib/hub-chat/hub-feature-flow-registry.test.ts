import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdvisoryPayload, tagWorkflowFlowMeta } from '@/lib/hub-chat/hub-advisory'
import {
  buildStandaloneFeatureEntries,
  matchFeatureFlowByMessage,
  resolveIdleFeatureMatch,
} from '@/lib/hub-chat/hub-feature-flow-registry'
import { buildHubFeatureCatalog, studioFeatureKey } from '@/lib/hub-chat/hub-feature-catalog'

test('matchFeatureFlowByMessage prefers studio preset over standalone href', () => {
  const match = matchFeatureFlowByMessage('tạo giao diện web cho spa', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'mobile_shop')
})

test('tạo web and thiết kế web app start mobile_shop not landing_page', () => {
  for (const phrase of ['tạo web', 'Tạo giao diện web', 'thiết kế web app', 'studio flow tạo web']) {
    const match = matchFeatureFlowByMessage(phrase, 'vi')
    assert.equal(match?.kind, 'studio', phrase)
    if (match?.kind === 'studio') assert.equal(match.presetId, 'mobile_shop', phrase)
  }
})

test('explicit landing / ladipage phrases start landing_page', () => {
  for (const phrase of ['tạo landing page', 'tạo ladipage', 'thiết kế landing', 'tạo ladipge']) {
    const match = matchFeatureFlowByMessage(phrase, 'vi')
    assert.equal(match?.kind, 'studio', phrase)
    if (match?.kind === 'studio') assert.equal(match.presetId, 'landing_page', phrase)
  }
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

test('tạo baner (typo) quảng cáo google maps to sale_banner studio not curriculum', () => {
  const match = matchFeatureFlowByMessage('tạo baner quảng cáo google', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'sale_banner')
})

test('bare tạo + unrelated topic does not suggest curriculum', () => {
  const match = matchFeatureFlowByMessage('tạo baner quảng cáo google', 'vi')
  assert.notEqual(match?.kind === 'standalone' && match.href === '/tao-giao-trinh', true)
})

test('banner quảng cáo maps to sale_banner studio not standalone page', () => {
  const match = matchFeatureFlowByMessage('tạo banner quảng cáo sale 50%', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'sale_banner')
})

test('standalone catalog excludes tools replaced by studio presets', () => {
  const entries = buildStandaloneFeatureEntries('vi')
  assert.ok(!entries.some((e) => e.href === '/tao-banner'))
})

test('thiết kế hộp giấy maps to packaging_kit studio not a dead redirect', () => {
  const match = matchFeatureFlowByMessage('thiết kế hộp giấy', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'packaging_kit')
})

test('standalone catalog covers nav tools and advisory extras', () => {
  const entries = buildStandaloneFeatureEntries('vi')
  assert.ok(entries.some((e) => e.href === '/lam-net-anh'))
  assert.ok(entries.some((e) => e.href === '/thiet-ke-tui-dung'))
  assert.ok(entries.some((e) => e.href === '/flow-nhac-video-veo'))
  assert.ok(entries.some((e) => e.href === '/tao-thiep-moi-cuoi-ai'))
})

test('tạo thiệp cưới maps to wedding invitation tool not online exam', () => {
  const match = matchFeatureFlowByMessage('tạo thiệp cưới', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('thiệp cưới online maps to wedding invitation tool', () => {
  const match = matchFeatureFlowByMessage('thiệp cưới online', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('thiết kế thiệp mời maps to wedding invitation tool', () => {
  const match = matchFeatureFlowByMessage('thiết kế thiệp mời', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('tạo thiệp mời maps to wedding invitation tool not online exam', () => {
  const match = matchFeatureFlowByMessage('tạo thiệp mời', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('bare thiệp mời maps to wedding invitation tool', () => {
  const match = matchFeatureFlowByMessage('thiệp mời', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('affirmative reply after wedding tool offer opens wedding feature', () => {
  const match = resolveIdleFeatureMatch(
    'có',
    'vi',
    'Bạn muốn thiết kế thiệp mời. Hiện tại, tôi có công cụ Tạo thiệp cưới AI có thể giúp bạn.'
  )
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-thiep-moi-cuoi-ai')
})

test('catalog no longer exposes wedding_invite studio preset', () => {
  const catalog = buildHubFeatureCatalog('vi')
  assert.ok(!catalog.some((e) => e.key === studioFeatureKey('wedding_invite')))
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

test('buildAdvisoryPayload injects wedding tool when user asks to create wedding invite', async () => {
  const result = await buildAdvisoryPayload({
    locale: 'vi',
    userId: 'user-1',
    threadId: 'thread-1',
    message: 'tạo thiệp cưới',
    hubRoute: 'consultation',
    workflowsRaw: [],
    planRaw: null,
  })
  assert.equal(result.workflows[0]?.href, '/tao-thiep-moi-cuoi-ai')
  assert.equal(result.workflows[0]?.requiresOpenConfirm, true)
})

test('buildAdvisoryPayload injects wedding tool for generic invitation design request', async () => {
  const result = await buildAdvisoryPayload({
    locale: 'vi',
    userId: 'user-1',
    threadId: 'thread-1',
    message: 'thiết kế thiệp mời',
    hubRoute: 'consultation',
    workflowsRaw: [],
    planRaw: null,
  })
  assert.equal(result.workflows[0]?.href, '/tao-thiep-moi-cuoi-ai')
  assert.equal(result.workflows[0]?.requiresOpenConfirm, true)
})

test('tagWorkflowFlowMeta marks catalog hrefs as requiring confirm', () => {
  const tagged = tagWorkflowFlowMeta(
    [
      {
        href: '/lam-net-anh',
        labelKey: 'enhance_image',
        label: 'Enhance',
        reason: 'test',
        prefillPrompt: 'sharpen',
        confidence: 0.8,
      },
    ],
    'vi'
  )
  assert.equal(tagged[0]?.requiresOpenConfirm, true)
  assert.equal(tagged[0]?.flowKind, 'standalone')
})
