import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveExactVisualHomepageHtml } from '@/lib/partner-website/compose-partner-website-html'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'

test('visual homepage uses saved htmlSource as-is, not project CSS compose', () => {
  const html = '<!DOCTYPE html><html><body><h1 data-ve="hero">Hello shop</h1></body></html>'
  const out = resolveExactVisualHomepageHtml({
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: true },
    htmlSource: html,
    project: {
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html', content: html },
        { path: 'styles.css', kind: 'css', content: 'body{background:red}' },
      ],
    },
  })
  assert.equal(out, html)
  assert.equal(out.includes('background:red'), false)
})

test('without useVisualHtml there is no visual homepage override', () => {
  const out = resolveExactVisualHomepageHtml({
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    htmlSource: '<!DOCTYPE html><html><body>saved</body></html>',
    project: { entryPath: 'index.html', files: [] },
  })
  assert.equal(out, '')
})

test('stale visual flags still serve homepage chrome after reset', () => {
  const html = `<!DOCTYPE html><html lang="vi"><body data-pw-page="home">
<header class="pw-header" data-pw-region="header"><nav class="pw-nav-main">Hàng mới</nav></header>
</body></html>`
  const out = resolveExactVisualHomepageHtml({
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    htmlSource: html,
    project: { entryPath: 'index.html', files: [] },
  })
  assert.equal(out, html)
})
