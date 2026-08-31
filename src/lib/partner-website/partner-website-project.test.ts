import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composeStandaloneHtml,
  defaultProjectFromHtml,
  extractIndexHtml,
  normalizePartnerWebsiteProject,
} from '@/lib/partner-website/partner-website-project'
import { validatePartnerWebsiteSlug } from '@/lib/partner-website/partner-website-slug'

test('validatePartnerWebsiteSlug rejects reserved', () => {
  assert.ok(validatePartnerWebsiteSlug('nanoai'))
  assert.equal(validatePartnerWebsiteSlug('my-boutique'), null)
})

test('normalizePartnerWebsiteProject parses files', () => {
  const project = normalizePartnerWebsiteProject({
    entryPath: 'index.html',
    files: [
      { path: 'index.html', kind: 'html', content: '<!DOCTYPE html><html><head></head><body>Hi</body></html>' },
      { path: 'css/main.css', kind: 'css', content: 'body{margin:0}' },
    ],
  })
  assert.ok(project)
  assert.equal(project!.files.length, 2)
  const html = composeStandaloneHtml(project!)
  assert.ok(html?.includes('body{margin:0}'))
})

test('defaultProjectFromHtml wraps single file', () => {
  const p = defaultProjectFromHtml('<html></html>', 'Shop')
  assert.equal(p.entryPath, 'index.html')
  assert.ok(p.files.some((f) => f.path === 'index.html'))
})

test('extractIndexHtml does not fall back to another device file', () => {
  assert.equal(
    extractIndexHtml({
      entryPath: 'index.html',
      files: [
        {
          path: 'index.mobile.html',
          kind: 'html',
          content: '<!DOCTYPE html><html><body>Mobile only</body></html>',
        },
      ],
    }),
    null
  )
  assert.match(
    extractIndexHtml({
      entryPath: 'index.html',
      files: [
        { path: 'index.html', kind: 'html', content: '<!DOCTYPE html><html><body>Desktop</body></html>' },
        { path: 'index.mobile.html', kind: 'html', content: '<!DOCTYPE html><html><body>Mobile</body></html>' },
      ],
    }) || '',
    /Desktop/
  )
})
