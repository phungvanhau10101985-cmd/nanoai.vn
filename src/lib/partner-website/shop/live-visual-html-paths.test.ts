import assert from 'node:assert/strict'
import test from 'node:test'
import {
  liveVisualHtmlPathsForTarget,
  mergePartnerWebsiteProjectFiles,
  projectHasLiveVisualHtmlPaths,
} from '@/lib/partner-website/shop/live-visual-html-paths'
import { resolvePartnerVisualHtmlForDevice } from '@/lib/partner-website/shop/render-partner-visual-html'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { visualEditorHtmlPath } from '@/lib/partner-website/visual-editor/visual-editor-pages'

const mobileHome = `<!DOCTYPE html><html><body data-pw-page="home">
<header class="pw-header" data-pw-region="header">MobHead</header>
<main>Home mobile</main>
</body></html>`

test('liveVisualHtmlPathsForTarget maps one page + one machine', () => {
  assert.deepEqual(liveVisualHtmlPathsForTarget({ kind: 'page', pageKey: 'home' }, 'mobile'), [
    'index.mobile.html',
  ])
  assert.deepEqual(liveVisualHtmlPathsForTarget({ kind: 'page', pageKey: 'products' }, 'desktop'), [
    'products.html',
    'index.html',
  ])
  assert.deepEqual(liveVisualHtmlPathsForTarget({ kind: 'page', pageKey: 'product_detail' }, 'tablet'), [
    visualEditorHtmlPath('product_detail', 'tablet'),
    'index.tablet.html',
  ])
  const productPaths = liveVisualHtmlPathsForTarget(
    { kind: 'product', productId: '11111111-1111-4111-8111-111111111111' },
    'laptop'
  )
  assert.ok(productPaths.includes(visualEditorHtmlPath('product_detail', 'laptop')))
  assert.ok(productPaths.includes('index.laptop.html'))
  assert.equal(productPaths.length, 3)
})

test('projectHasLiveVisualHtmlPaths requires the viewed file only', () => {
  const project = {
    entryPath: 'index.mobile.html',
    files: [{ path: 'index.mobile.html', kind: 'html' as const, content: mobileHome }],
  }
  assert.equal(projectHasLiveVisualHtmlPaths(project, ['index.mobile.html']), true)
  assert.equal(projectHasLiveVisualHtmlPaths(project, ['index.html']), false)
  assert.equal(projectHasLiveVisualHtmlPaths({ entryPath: 'index.html', files: [] }, ['index.mobile.html']), false)
})

test('mergePartnerWebsiteProjectFiles keeps editor files and overlays the live file', () => {
  const merged = mergePartnerWebsiteProjectFiles(
    {
      entryPath: 'index.html',
      files: [{ path: 'index.html', kind: 'html', content: '<html>desk</html>' }],
    },
    {
      entryPath: 'index.mobile.html',
      files: [{ path: 'index.mobile.html', kind: 'html', content: mobileHome }],
    }
  )
  assert.equal(merged.files.length, 2)
  assert.ok(merged.files.some((file) => file.path === 'index.html'))
  assert.ok(merged.files.some((file) => file.path === 'index.mobile.html'))
})

test('live resolve uses the one loaded machine file — no sibling devices required', () => {
  const selected = resolvePartnerVisualHtmlForDevice(
    {
      theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualMobileHtml: true, visualPageKeys: ['home'] },
      project: {
        entryPath: 'index.mobile.html',
        files: [{ path: 'index.mobile.html', kind: 'html', content: mobileHome }],
      },
    },
    { kind: 'page', pageKey: 'home' },
    'mobile'
  )
  assert.ok(selected)
  assert.equal(selected?.sourceDevice, 'mobile')
  assert.match(selected?.html || '', /Home mobile/)
  assert.doesNotMatch(selected?.html || '', /data-pw-visual-device="desktop"/)
})
