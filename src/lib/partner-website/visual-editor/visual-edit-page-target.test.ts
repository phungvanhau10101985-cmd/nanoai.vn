import assert from 'node:assert/strict'
import test from 'node:test'
import {
  visualEditSelectValueFromTarget,
  visualEditTargetFromChromeKind,
  visualEditTargetFromHref,
  visualEditTargetFromSelection,
} from '@/lib/partner-website/visual-editor/visual-edit-page-target'

const SLUG = '188-com-vn-u560'

test('visual edit target from policy and custom page hrefs', () => {
  assert.deepEqual(visualEditTargetFromHref(`/site/${SLUG}/shipping`, SLUG), {
    kind: 'page',
    pageKey: 'shipping',
  })
  assert.deepEqual(visualEditTargetFromHref('/shipping', SLUG), {
    kind: 'page',
    pageKey: 'shipping',
  })
  assert.deepEqual(visualEditTargetFromHref(`/site/${SLUG}/size-guide`, SLUG), {
    kind: 'page',
    pageKey: 'size_guide',
  })
  assert.deepEqual(visualEditTargetFromHref(`/site/${SLUG}/pages/huong-dan-mua`, SLUG), {
    kind: 'cms',
    cmsSlug: 'huong-dan-mua',
  })
  assert.equal(visualEditTargetFromHref('#', SLUG), null)
  assert.equal(visualEditTargetFromHref('javascript:void(0)', SLUG), null)
  assert.equal(visualEditTargetFromHref('mailto:shop@example.com', SLUG), null)
})

test('chat / search / categories chrome do not jump pages', () => {
  assert.equal(visualEditTargetFromChromeKind('chat', SLUG), null)
  assert.equal(visualEditTargetFromChromeKind('search', SLUG), null)
  assert.equal(visualEditTargetFromChromeKind('categories', SLUG), null)
  assert.deepEqual(visualEditTargetFromChromeKind('about', SLUG), {
    kind: 'page',
    pageKey: 'about',
  })
  assert.equal(visualEditSelectValueFromTarget({ kind: 'page', pageKey: 'about' }), 'about')
})

test('selection prefers href then chrome kind', () => {
  assert.deepEqual(
    visualEditTargetFromSelection({
      href: `/site/${SLUG}/privacy`,
      chromeKind: 'chat',
      siteSlug: SLUG,
    }),
    { kind: 'page', pageKey: 'privacy' }
  )
  assert.deepEqual(
    visualEditTargetFromSelection({
      href: '#',
      chromeKind: 'shipping',
      siteSlug: SLUG,
    }),
    { kind: 'page', pageKey: 'shipping' }
  )
})

test('logo selection always opens homepage Sửa nhanh', () => {
  assert.deepEqual(
    visualEditTargetFromSelection({
      isLogo: true,
      href: '',
      siteSlug: SLUG,
    }),
    { kind: 'page', pageKey: 'home' }
  )
  assert.deepEqual(
    visualEditTargetFromSelection({
      isLogo: true,
      href: `/site/${SLUG}/shipping`,
      chromeKind: 'chat',
      siteSlug: SLUG,
    }),
    { kind: 'page', pageKey: 'home' }
  )
  assert.deepEqual(visualEditTargetFromSelection({ isLogo: true }), { kind: 'page', pageKey: 'home' })
  assert.equal(visualEditSelectValueFromTarget({ kind: 'page', pageKey: 'home' }), 'home')
})
