import { describe, expect, it } from 'vitest'
import { rankProjectFilesForQuery } from '@/lib/partner-website/partner-website-file-search'
import { applyPartnerWebsiteEdits } from '@/lib/partner-website/partner-website-patch'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

const sampleProject: PartnerWebsiteProject = {
  entryPath: 'index.html',
  files: [
    {
      path: 'index.html',
      kind: 'html',
      content: `<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="css/main.css"></head>
<body>
<section class="hero"><h1>Hero</h1></section>
<section class="features"><h2>Features</h2></section>
</body>
</html>`,
    },
    {
      path: 'css/main.css',
      kind: 'css',
      content: `.hero { background: orange; color: white; }\n.features { padding: 2rem; }`,
    },
    {
      path: 'js/main.js',
      kind: 'js',
      content: `console.log('ready');`,
    },
  ],
}

describe('rankProjectFilesForQuery', () => {
  it('prefers css for color requests', () => {
    const ranked = rankProjectFilesForQuery(sampleProject, 'Đổi màu hero sang cam đậm hơn')
    expect(ranked[0]?.file.path).toBe('css/main.css')
  })

  it('prefers html for product list requests', () => {
    const ranked = rankProjectFilesForQuery(sampleProject, 'Thêm danh sách sản phẩm vào trang')
    expect(ranked.some((r) => r.file.path === 'index.html')).toBe(true)
  })
})

describe('applyPartnerWebsiteEdits', () => {
  it('applies search/replace patch in place', () => {
    const result = applyPartnerWebsiteEdits(sampleProject, {
      edits: [
        {
          path: 'css/main.css',
          patches: [{ search: 'background: orange', replace: 'background: #e65100' }],
        },
      ],
    })
    expect(result.appliedPaths).toContain('css/main.css')
    const css = result.project.files.find((f) => f.path === 'css/main.css')?.content ?? ''
    expect(css).toContain('#e65100')
  })

  it('inserts html section via patch', () => {
    const result = applyPartnerWebsiteEdits(sampleProject, {
      edits: [
        {
          path: 'index.html',
          patches: [
            {
              search: '<section class="features"><h2>Features</h2></section>',
              replace: `<section class="products"><h2>Sản phẩm</h2><div class="grid">...</div></section>
<section class="features"><h2>Features</h2></section>`,
            },
          ],
        },
      ],
    })
    expect(result.appliedPaths).toContain('index.html')
    const html = result.project.files.find((f) => f.path === 'index.html')?.content ?? ''
    expect(html).toContain('class="products"')
  })
})
