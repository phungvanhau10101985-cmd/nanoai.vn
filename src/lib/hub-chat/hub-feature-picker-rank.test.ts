import assert from 'node:assert/strict'
import test from 'node:test'

import { getCreationRelatedLinks, getExplicitCreationRelatedLinks } from '@/lib/creation-tool-sidebar-config'
import { groupHubFeatureCatalog, studioFeatureKey, toolFeatureKey } from '@/lib/hub-chat/hub-feature-catalog'
import {
  mergeRecentFeatureKeys,
  rankHubFeaturePickerGroups,
  recentFeatureKeysFromThreads,
} from '@/lib/hub-chat/hub-feature-picker-rank'

const groups = groupHubFeatureCatalog('vi')

function keysOf(rows: { entries: { key: string }[] }[]) {
  return rows.flatMap((group) => group.entries.map((entry) => entry.key))
}

test('banner keeps nav siblings for the mobile dock and a tight related list for the picker', () => {
  assert.equal(getExplicitCreationRelatedLinks('/tao-banner').length, 0)
  assert.ok(getCreationRelatedLinks('/tao-banner').length > 8)
  assert.ok(getExplicitCreationRelatedLinks('/ho-tro-lam-bai').some((item) => item.href === '/gia-su-ai'))
})

test('picker without history keeps the catalog order', () => {
  const ranked = rankHubFeaturePickerGroups(groups, [])
  assert.deepEqual(keysOf(ranked), keysOf(groups))
  assert.deepEqual(
    ranked.map((group) => group.groupKey),
    groups.map((group) => group.groupKey)
  )
})

test('recent packaging features lead, unused unrelated groups stay below', () => {
  const bag = studioFeatureKey('bag_kit')
  const box = studioFeatureKey('packaging_kit')
  const ranked = rankHubFeaturePickerGroups(groups, [bag, box])
  const flat = keysOf(ranked)
  assert.equal(new Set(flat).size, flat.length)
  assert.equal(flat.length, keysOf(groups).length)
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key).slice(0, 2), [bag, box])
  assert.equal(ranked[0]?.groupKey, 'studio_inline')
  assert.ok(ranked[0]!.entries.some((entry) => entry.key === studioFeatureKey('food_menu')))
  assert.equal(ranked[1]?.groupKey, 'try_on')
  assert.ok(flat.indexOf(toolFeatureKey('/hoc-tieng-anh-ai')) > flat.indexOf(bag))
})

test('homework rises with tutor and class; unrelated education tools stay in a lower group', () => {
  const homework = toolFeatureKey('/ho-tro-lam-bai')
  const tutor = toolFeatureKey('/gia-su-ai')
  const classes = toolFeatureKey('/lop')
  const language = toolFeatureKey('/hoc-tieng-anh-ai')
  const ranked = rankHubFeaturePickerGroups(groups, [homework])
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key), [homework, tutor, classes])
  assert.equal(ranked[0]?.groupKey, 'education')
  const laterEducation = ranked.slice(1).find((group) => group.groupKey === 'education')
  assert.ok(laterEducation?.entries.some((entry) => entry.key === language))
  assert.equal(laterEducation?.entries.some((entry) => entry.key === homework), false)
  assert.equal(ranked[1]?.groupKey, 'studio_inline')
})

test('a used design tool does not pull the whole design group up', () => {
  const invite = toolFeatureKey('/tao-thiep-moi-cuoi-ai')
  const banner = toolFeatureKey('/tao-banner')
  const ranked = rankHubFeaturePickerGroups(groups, [invite])
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key), [invite])
  const laterDesign = ranked.slice(1).find((group) => group.entries.some((entry) => entry.key === banner))
  assert.equal(laterDesign?.entries.some((entry) => entry.key === invite), false)
  assert.equal(ranked[1]?.groupKey, 'studio_inline')
})

test('an older tool in a large group stays below a newer feature from another group', () => {
  const infographic = toolFeatureKey('/tao-infographic-tu-sach')
  const story = toolFeatureKey('/ke-chuyen-bang-hinh-anh')
  const tryOn = toolFeatureKey('/thu-do-online/2-nguoi')
  const ranked = rankHubFeaturePickerGroups(groups, [infographic, tryOn, story])
  const flat = keysOf(ranked)
  assert.ok(flat.indexOf(infographic) < flat.indexOf(tryOn))
  assert.ok(flat.indexOf(tryOn) < flat.indexOf(story))
  assert.equal(ranked.find((group) => group.entries.some((entry) => entry.key === story))?.entries.length, 1)
})

test('using one try-on count brings the small try-on family up with it', () => {
  const first = toolFeatureKey('/thu-do-online/1-nguoi')
  const ranked = rankHubFeaturePickerGroups(groups, [first])
  assert.equal(ranked[0]?.groupKey, 'try_on')
  assert.equal(ranked[0]?.entries[0]?.key, first)
  assert.equal(ranked[0]?.entries.length, 5)
  assert.equal(ranked.slice(1).some((group) => group.groupKey === 'try_on'), false)
})

test('retired studio presets fall back to the standalone tool that replaced them', () => {
  const keys = recentFeatureKeysFromThreads(
    [
      { presetId: 'story_with_images', projectTitle: 'Kể chuyện bằng hình', title: 'Studio' },
      { presetId: 'interior_design', projectTitle: 'Nội thất / ngoại thất', title: 'Studio' },
      { presetId: 'design_recreate', projectTitle: 'Dựng lại thiết kế từ mẫu', title: 'Studio' },
    ],
    'vi'
  )
  assert.deepEqual(keys, [
    toolFeatureKey('/ke-chuyen-bang-hinh-anh'),
    toolFeatureKey('/thiet-ke-noi-ngoai-that'),
  ])
})

test('thread titles resolve to catalog keys, newest preset wins', () => {
  const keys = recentFeatureKeysFromThreads(
    [
      { presetId: 'bag_kit', title: 'Thiết kế hộp giấy' },
      { title: 'Thiết kế hộp giấy' },
      { title: 'thiết kế thiệp mời' },
      { title: 'làm bài tập', lastMessagePreview: 'Bạn muốn tôi hỗ trợ làm bài này' },
    ],
    'vi'
  )
  assert.deepEqual(keys, [
    studioFeatureKey('bag_kit'),
    studioFeatureKey('packaging_kit'),
    toolFeatureKey('/tao-thiep-moi-cuoi-ai'),
    toolFeatureKey('/ho-tro-lam-bai'),
  ])
})

test('merge keeps the newest chip, then chat history, then visited pages', () => {
  const entries = groups.flatMap((group) => group.entries)
  const keys = mergeRecentFeatureKeys({
    sessionKeys: [studioFeatureKey('bag_kit'), 'studio:missing'],
    threadKeys: [studioFeatureKey('packaging_kit'), studioFeatureKey('bag_kit')],
    visitedHrefs: ['/thu-do-online/1-nguoi', '/thiet-ke-bao-bi', '/thu-do-online/1-nguoi/extra'],
    entries,
  })
  assert.deepEqual(keys, [
    studioFeatureKey('bag_kit'),
    studioFeatureKey('packaging_kit'),
    toolFeatureKey('/thu-do-online/1-nguoi'),
  ])
})
