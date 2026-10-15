import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import { buildPartnerSiteAgentTreeScript } from './partner-site-agent-tree'

function runAgentTree(html: string): Document {
  const { window, document } = parseHTML(html)
  const view = window as unknown as { MutationObserver?: typeof MutationObserver }
  if (typeof view.MutationObserver !== 'function') {
    view.MutationObserver = class {
      observe() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    } as unknown as typeof MutationObserver
  }
  const js = buildPartnerSiteAgentTreeScript()
    .replace(/^<script[^>]*>/, '')
    .replace(/<\/script>$/, '')
  new Function('window', 'document', 'MutationObserver', js)(window, document, view.MutationObserver)
  return document
}

test('header logo link uses the hidden shop name when the wordmark is not in the accessibility tree', () => {
  const document = runAgentTree(`<!doctype html><html lang="vi"><head><title>188</title></head><body>
    <header class="pw-header"><div class="pw-container"><div class="pw-brand-cluster">
      <a class="pw-brand" href="/" data-pw-logo-home="1" style="--pw-logo-y:-2px" data-pw-logo-y="-2">
        <img class="pw-logo" alt="" src="https://cdn.example/logo.png">
        <span class="pw-wordmark">188</span>
      </a>
    </div></div></header>
  </body></html>`)
  assert.equal(document.querySelector('a.pw-brand')?.getAttribute('aria-label'), '188')
})

test('header logo link with only an empty image alt is named Trang chủ', () => {
  const document = runAgentTree(`<!doctype html><html lang="vi"><head><title>Shop</title></head><body>
    <header class="pw-header"><div class="pw-brand-cluster">
      <a class="pw-brand" href="/" data-pw-logo-home="1"><img class="pw-logo" alt="" src="https://cdn.example/logo.png"></a>
    </div></header>
  </body></html>`)
  assert.equal(document.querySelector('a.pw-brand')?.getAttribute('aria-label'), 'Trang chủ')
})

test('a visible wordmark and a text link keep their own names', () => {
  const document = runAgentTree(`<!doctype html><html lang="vi"><head><title>Shop</title></head><body>
    <header class="pw-header"><div class="pw-brand-cluster">
      <a class="pw-brand" href="/"><img class="pw-logo" data-pw-logo-empty="1" alt=""><span class="pw-wordmark">188</span></a>
      <a href="/cart">Giỏ hàng</a>
    </div></header>
  </body></html>`)
  assert.equal(document.querySelector('a.pw-brand')?.getAttribute('aria-label'), null)
  assert.equal(document.querySelector('a[href="/cart"]')?.getAttribute('aria-label'), null)
})
