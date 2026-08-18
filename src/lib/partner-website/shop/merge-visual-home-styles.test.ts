import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractVisualDocumentCssText,
  extractVisualDocumentStyles,
  mergeVisualHomeStylesIntoHtml,
  preferredVisualHomeStyleSource,
} from '@/lib/partner-website/shop/merge-visual-home-styles'

const home = `<!DOCTYPE html><html>
<head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro"/>
<style id="shop">.pw-shop-topbar{background:#c2410c;color:#fff}</style>
<style id="nanoai-visual-editor-styles">.nanoai-ve-selected{outline:2px solid red}</style>
<style id="pw-visual-device-split">.pw-visual-mobile{display:none}</style>
</head>
<body>
<header class="pw-shop-header">Head</header>
</body>
</html>`

test('extractVisualDocumentStyles keeps shop CSS and fonts, skips editor split', () => {
  const css = extractVisualDocumentStyles(home)
  assert.match(css, /pw-shop-topbar/)
  assert.match(css, /fonts\.googleapis/)
  assert.match(css, /data-pw-home-chrome-css="1"/)
  assert.equal(css.includes('nanoai-ve-selected'), false)
  assert.equal(css.includes('pw-visual-device-split'), false)
  assert.match(extractVisualDocumentCssText(home), /pw-shop-topbar/)
  assert.equal(extractVisualDocumentCssText(home).includes('<style'), false)
})

test('mergeVisualHomeStylesIntoHtml copies home CSS into target head', () => {
  const about = `<!DOCTYPE html><html><head><title>About</title></head><body>
<header class="pw-shop-header">AboutHead</header>
<main>About</main>
</body></html>`
  const out = mergeVisualHomeStylesIntoHtml(about, home)
  assert.match(out, /pw-shop-topbar/)
  assert.match(out, /<title>About<\/title>/)
  assert.match(out, /<main>About<\/main>/)
  const again = mergeVisualHomeStylesIntoHtml(out, home)
  assert.equal(again.match(/pw-shop-topbar/g)?.length, 1)
})

test('merge still injects into head when a hidden body host already has the stamp', () => {
  const about = `<!DOCTYPE html><html><head><title>About</title></head><body>
<div hidden data-pw-home-chrome-css-host="1"><style data-pw-home-chrome-css="1">.dead{color:red}</style></div>
<header class="pw-shop-header">AboutHead</header>
</body></html>`
  const out = mergeVisualHomeStylesIntoHtml(about, home)
  const head = out.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || ''
  assert.match(head, /pw-shop-topbar/)
  assert.match(head, /data-pw-home-chrome-css="1"/)
})

test('preferredVisualHomeStyleSource keeps the document that still has CSS', () => {
  const isolatedBody = `<!DOCTYPE html><html><body><header class="pw-header">H</header></body></html>`
  const picked = preferredVisualHomeStyleSource(isolatedBody, home)
  assert.equal(picked, home)
})
