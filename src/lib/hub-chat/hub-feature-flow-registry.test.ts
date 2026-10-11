import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdvisoryPayload, tagWorkflowFlowMeta } from '@/lib/hub-chat/hub-advisory'
import {
  buildStandaloneFeatureEntries,
  catalogSurfaceForHubTurn,
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

test('explicit landing / ladipage phrases do not start a hub', () => {
  for (const phrase of ['tạo landing page', 'tạo ladipage', 'thiết kế landing', 'tạo ladipge']) {
    const match = matchFeatureFlowByMessage(phrase, 'vi')
    assert.equal(match, null, phrase)
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

test('tạo baner (typo) quảng cáo google maps to the banner page not curriculum', () => {
  const match = matchFeatureFlowByMessage('tạo baner quảng cáo google', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-banner')
})

test('bare tạo + unrelated topic does not suggest curriculum', () => {
  const match = matchFeatureFlowByMessage('tạo baner quảng cáo google', 'vi')
  assert.notEqual(match?.kind === 'standalone' && match.href === '/tao-giao-trinh', true)
})

test('banner quảng cáo maps to the banner page', () => {
  const match = matchFeatureFlowByMessage('tạo banner quảng cáo sale 50%', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-banner')
})

test('banner page stays in the standalone catalog', () => {
  const entries = buildStandaloneFeatureEntries('vi')
  assert.ok(entries.some((e) => e.href === '/tao-banner'))
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

test('học ngoại ngữ opens the language learning page', () => {
  for (const phrase of ['Học ngoại ngữ', 'hoc ngoai ngu', 'học tiếng anh', 'learn a language']) {
    const match = matchFeatureFlowByMessage(phrase, 'vi')
    assert.equal(match?.kind, 'standalone', phrase)
    if (match?.kind === 'standalone') assert.equal(match.href, '/hoc-tieng-anh-ai', phrase)
  }
})

test('curriculum and preset lessons stay on their own pages', () => {
  const curriculum = matchFeatureFlowByMessage('tạo giáo trình học tiếng anh', 'vi')
  assert.equal(curriculum?.kind, 'standalone')
  if (curriculum?.kind === 'standalone') assert.equal(curriculum.href, '/tao-giao-trinh')

  const preset = matchFeatureFlowByMessage('bài học có sẵn', 'vi')
  assert.equal(preset?.kind, 'standalone')
  if (preset?.kind === 'standalone') assert.equal(preset.href, '/hoc-bai-hoc-co-san')
})

test('buildAdvisoryPayload sends an open button for học ngoại ngữ', async () => {
  const result = await buildAdvisoryPayload({
    locale: 'vi',
    userId: 'user-1',
    threadId: 'thread-1',
    message: 'Học ngoại ngữ',
    hubRoute: 'consultation',
    workflowsRaw: [],
    planRaw: null,
  })
  assert.equal(result.workflows[0]?.href, '/hoc-tieng-anh-ai')
  assert.equal(result.workflows[0]?.requiresOpenConfirm, true)
})

test('a feature name without the AI suffix still opens that tool page', () => {
  const video = matchFeatureFlowByMessage('Tạo video', 'vi')
  assert.equal(video?.kind, 'standalone')
  if (video?.kind === 'standalone') assert.equal(video.href, '/tao-video-tu-anh')

  const music = matchFeatureFlowByMessage('Video âm nhạc', 'vi')
  assert.equal(music?.kind, 'standalone')
  if (music?.kind === 'standalone') assert.equal(music.href, '/flow-nhac-video-veo')
})

test('an existing hub title is a hub flow, not a missing feature', () => {
  const match = matchFeatureFlowByMessage('App bán hàng', 'vi')
  assert.equal(match?.kind, 'studio')
  if (match?.kind === 'studio') assert.equal(match.presetId, 'mobile_shop')
})

test('a catalog page or hub preset means the ask already has a surface', () => {
  const page = catalogSurfaceForHubTurn({
    locale: 'vi',
    match: null,
    workflowsRaw: [{ href: '/lam-net-anh' }],
  })
  assert.equal(page.hasOwnPage, true)
  assert.equal(page.hasHubFlow, false)

  const hub = catalogSurfaceForHubTurn({
    locale: 'vi',
    match: null,
    suggestedPresetId: 'packaging_kit',
  })
  assert.equal(hub.hasOwnPage, false)
  assert.equal(hub.hasHubFlow, true)
})

test('amateur product photos for Facebook open the photo page', () => {
  const match = matchFeatureFlowByMessage('ảnh tự chụp nghiệp dư đăng facebook, không có web', 'vi')
  assert.equal(match?.kind, 'standalone')
  if (match?.kind === 'standalone') assert.equal(match.href, '/tao-anh-ban-hang')
})

test('hub catalog lists the facebook photo page and not the chat presets', () => {
  const catalog = buildHubFeatureCatalog('vi')
  assert.ok(catalog.some((entry) => entry.href === '/tao-anh-ban-hang' && entry.kind === 'standalone'))
  assert.equal(catalog.some((entry) => entry.presetId === 'catalog_photo_pack'), false)
  assert.equal(catalog.some((entry) => entry.presetId === 'product_listing'), false)
  assert.equal(catalog.find((entry) => entry.key === studioFeatureKey('catalog_photo_pack')), undefined)
  assert.equal(catalog.find((entry) => entry.key === studioFeatureKey('product_listing')), undefined)
})

test('every product photo phrase opens the photo page', () => {
  for (const phrase of [
    'ảnh sản phẩm',
    'TẠO ẢNH SẢN PHẨM',
    'ảnh sản phẩm shopee nền trắng',
    'sản phẩm shopee',
    'product photo white background',
    '产品图',
  ]) {
    const match = matchFeatureFlowByMessage(phrase, 'vi')
    assert.equal(match?.kind, 'standalone', phrase)
    if (match?.kind === 'standalone') assert.equal(match.href, '/tao-anh-ban-hang', phrase)
  }
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
