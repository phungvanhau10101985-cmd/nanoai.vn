import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { inertPartnerInlineVisualScripts } from '../../../app/site/[slug]/partner-site-public-client'

test('inline visual runtime scripts stay inert until React hydration completes', () => {
  const html =
    '<main>Shop</main><script>window.a=1</script><script type="module" src="/runtime.js"></script>'
  const inert = inertPartnerInlineVisualScripts(html)

  assert.match(inert, /type="application\/x-pw-runtime"/)
  assert.match(inert, /data-pw-script-inert="1"/)
  assert.match(inert, /data-pw-script-original-type="module"/)
  assert.match(inert, /src="\/runtime\.js"/)
  assert.doesNotMatch(inert, /<script>window\.a=1/)
})

test('inline visual JSON-LD remains non-executable metadata', () => {
  const html = '<script type="application/ld+json">{"@type":"WebSite"}</script>'
  assert.equal(inertPartnerInlineVisualScripts(html), html)
})

test('public storefront does not use a Suspense fallback that can consume the first click', async () => {
  const source = await readFile(
    new URL('../../../app/site/[slug]/partner-site-public-client.tsx', import.meta.url),
    'utf8'
  )
  assert.doesNotMatch(source, /useSearchParams/)
  assert.doesNotMatch(source, /<Suspense/)
  assert.match(source, /inertPartnerInlineVisualScripts\(extractVisualHtmlBodyMarkup\(previewHtml\)\)/)
})
