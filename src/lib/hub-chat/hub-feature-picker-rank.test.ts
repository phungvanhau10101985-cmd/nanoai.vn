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

test('recent packaging features lead, siblings sit below unused features', () => {
  const bag = studioFeatureKey('bag_kit')
  const box = studioFeatureKey('packaging_kit')
  const menu = studioFeatureKey('food_menu')
  const shop = studioFeatureKey('mobile_shop')
  const language = toolFeatureKey('/hoc-tieng-anh-ai')
  const ranked = rankHubFeaturePickerGroups(groups, [bag, box])
  const flat = keysOf(ranked)
  assert.equal(new Set(flat).size, flat.length)
  assert.equal(flat.length, keysOf(groups).length)
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key), [bag, box])
  assert.equal(ranked[0]?.groupKey, 'studio_inline')
  assert.equal(ranked[1]?.groupKey, 'try_on')
  assert.ok(flat.indexOf(language) > flat.indexOf(bag))
  assert.ok(flat.indexOf(menu) > flat.indexOf(language))
  assert.deepEqual(ranked[ranked.length - 1]?.entries.map((entry) => entry.key), [shop, menu])
})

test('homework stays above unused tools; tutor and class sit below them', () => {
  const homework = toolFeatureKey('/ho-tro-lam-bai')
  const tutor = toolFeatureKey('/gia-su-ai')
  const classes = toolFeatureKey('/lop')
  const language = toolFeatureKey('/hoc-tieng-anh-ai')
  const ranked = rankHubFeaturePickerGroups(groups, [homework])
  const flat = keysOf(ranked)
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key), [homework])
  assert.equal(ranked[0]?.groupKey, 'education')
  const laterEducation = ranked.slice(1).find((group) => group.groupKey === 'education')
  assert.ok(laterEducation?.entries.some((entry) => entry.key === language))
  assert.equal(laterEducation?.entries.some((entry) => entry.key === homework), false)
  assert.equal(laterEducation?.entries.some((entry) => entry.key === tutor), false)
  assert.equal(ranked[1]?.groupKey, 'studio_inline')
  assert.deepEqual(ranked[ranked.length - 1]?.entries.map((entry) => entry.key), [tutor, classes])
  assert.ok(flat.indexOf(language) < flat.indexOf(tutor))
  assert.ok(flat.indexOf(tutor) < flat.indexOf(classes))
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

test('using one try-on count keeps that chip on top and the rest of the family below unused tools', () => {
  const first = toolFeatureKey('/thu-do-online/1-nguoi')
  const ranked = rankHubFeaturePickerGroups(groups, [first])
  const tryOnGroups = ranked.filter((group) => group.groupKey === 'try_on')
  assert.equal(ranked[0]?.groupKey, 'try_on')
  assert.deepEqual(ranked[0]?.entries.map((entry) => entry.key), [first])
  assert.equal(tryOnGroups.length, 2)
  assert.equal(tryOnGroups[1]?.entries.length, 4)
  assert.equal(tryOnGroups[1]?.entries.some((entry) => entry.key === first), false)
  const between = ranked.slice(1, ranked.indexOf(tryOnGroups[1]!))
  assert.equal(between.some((group) => group.groupKey === 'try_on'), false)
  assert.ok(between.length > 0)
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
