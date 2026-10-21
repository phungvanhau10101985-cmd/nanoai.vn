import assert from 'node:assert/strict'
import test from 'node:test'

import { homepageRecentKeys, personalizeHomepageGroups } from '@/lib/home-feature-order'
import { toolFeatureKey } from '@/lib/hub-chat/hub-feature-catalog'
import { NAV_GROUPS } from '@/lib/nav-config'

function hrefsOf(groups: { links: { href: string }[] }[]) {
  return groups.flatMap((group) => group.links.map((link) => link.href))
}

const catalogHrefs = hrefsOf(
  NAV_GROUPS.map((group) => ({
    links: group.links.filter((link) => link.showOnHomepage !== false),
  }))
)

test('homepage icons without history keep catalog order and hide links not shown on the home page', () => {
  const ranked = personalizeHomepageGroups(NAV_GROUPS, [])
  assert.deepEqual(hrefsOf(ranked), catalogHrefs)
  assert.equal(ranked[0]?.titleKey, 'try_on')
  assert.equal(hrefsOf(ranked).includes('/lop'), false)
  assert.equal(hrefsOf(ranked).includes('/giao-trinh'), false)
  assert.equal(hrefsOf(ranked).includes('/tao-bai-thi'), false)
})

test('chat threads move the used homepage group above the catalog, studio chats do not', () => {
  const keys = homepageRecentKeys({
    sessionKeys: ['studio:food_menu'],
    threads: [
      { presetId: 'food_menu', title: 'Thiết kế menu quán ăn' },
      { title: 'Hỗ trợ làm bài', firstUserMessage: 'giúp em làm bài tập này' },
    ],
    visitedHrefs: [],
    locale: 'vi',
  })
  const ranked = personalizeHomepageGroups(NAV_GROUPS, keys)
  assert.equal(ranked[0]?.titleKey, 'education')
  assert.equal(ranked[0]?.links[0]?.href, '/ho-tro-lam-bai')
  assert.equal(ranked[1]?.titleKey, 'try_on')
})

test('a recent try-on icon leads its family, ahead of a feature opened more often', () => {
  const ranked = personalizeHomepageGroups(
    NAV_GROUPS,
    ['/thu-do-online/2-nguoi'],
    { '/tao-bai-hat-lyria-3': 40, '/thu-do-online/2-nguoi': 1 }
  )
  assert.equal(ranked[0]?.titleKey, 'try_on')
  assert.deepEqual(
    ranked[0]?.links.map((link) => link.href),
    [
      '/thu-do-online/2-nguoi',
      '/thu-do-online/1-nguoi',
      '/thu-do-online/3-nguoi',
      '/thu-do-online/4-nguoi',
      '/thu-do-online/5-nguoi',
    ]
  )
  assert.equal(ranked[1]?.titleKey, 'music_ai')
  assert.equal(ranked[1]?.links[0]?.href, '/tao-bai-hat-lyria-3')
  assert.equal(ranked.slice(2).some((group) => group.titleKey === 'try_on'), false)
  const flat = hrefsOf(ranked)
  assert.equal(new Set(flat).size, flat.length)
  assert.equal(flat.length, catalogHrefs.length)
})

test('homework rises with the tutor inside the same education group, and that group leads', () => {
  const ranked = personalizeHomepageGroups(NAV_GROUPS, [toolFeatureKey('/ho-tro-lam-bai')])
  assert.equal(ranked[0]?.titleKey, 'education')
  assert.equal(ranked[0]?.links[0]?.href, '/ho-tro-lam-bai')
  assert.equal(ranked[0]?.links[1]?.href, '/gia-su-ai')
  assert.ok(ranked[0]?.links.some((link) => link.href === '/hoc-tieng-anh-ai'))
  assert.equal(ranked.filter((group) => group.titleKey === 'education').length, 1)
  assert.equal(ranked[1]?.titleKey, 'try_on')
})

test('a used design icon leads its own group above the catalog', () => {
  const ranked = personalizeHomepageGroups(NAV_GROUPS, ['/tao-thiep-moi-cuoi-ai'])
  assert.equal(ranked[0]?.titleKey, 'design_creative')
  assert.equal(ranked[0]?.links[0]?.href, '/tao-thiep-moi-cuoi-ai')
  assert.ok(ranked[0]?.links.some((link) => link.href === '/tao-banner'))
  assert.equal(ranked.filter((group) => group.titleKey === 'design_creative').length, 1)
  assert.equal(ranked[1]?.titleKey, 'try_on')
})

test('a used icon leads its section when the rest of that section follows immediately', () => {
  const ranked = personalizeHomepageGroups(
    NAV_GROUPS,
    ['/thu-do-online/2-nguoi'],
    { '/hoc-tieng-anh-ai': 4 }
  )
  const education = ranked.filter((group) => group.titleKey === 'education')
  assert.equal(education.length, 1)
  assert.equal(education[0]?.links[0]?.href, '/hoc-tieng-anh-ai')
  assert.equal(education[0]?.links[1]?.href, '/tao-giao-trinh')
  assert.ok(education[0]?.links.some((link) => link.href === '/gia-su-ai'))
})

test('a frequently opened feature with no recent list still leads its group', () => {
  const ranked = personalizeHomepageGroups(NAV_GROUPS, [], { '/hoc-tieng-anh-ai': 6, '/lam-dep-anh': 2 })
  assert.equal(ranked[0]?.titleKey, 'education')
  assert.equal(ranked[0]?.links[0]?.href, '/hoc-tieng-anh-ai')
  assert.equal(ranked[1]?.titleKey, 'image_edit')
  assert.equal(ranked[1]?.links[0]?.href, '/lam-dep-anh')
  assert.ok((ranked[1]?.links.length ?? 0) > 1)
  assert.equal(ranked[2]?.titleKey, 'try_on')
  assert.equal(new Set(ranked.map((group) => group.titleKey)).size, ranked.length)
})
