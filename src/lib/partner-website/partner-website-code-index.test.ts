import { describe, expect, it } from 'vitest'
import {
  buildProjectCodeIndex,
  searchProjectCodeIndex,
  rankedFilesFromSearch,
} from '@/lib/partner-website/partner-website-code-index'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

const sampleProject: PartnerWebsiteProject = {
  entryPath: 'index.html',
  files: [
    {
      path: 'index.html',
      kind: 'html',
      content: `<!DOCTYPE html>
<html>
<body>
<section class="hero"><h1>Hero title</h1></section>
<section class="features"><h2>Features</h2></section>
</body>
</html>`,
    },
    {
      path: 'css/main.css',
      kind: 'css',
      content: `.hero { background: orange; color: white; }\n.features { padding: 2rem; }`,
    },
  ],
}

describe('buildProjectCodeIndex', () => {
  it('chunks html sections and css rules', () => {
    const index = buildProjectCodeIndex(sampleProject)
    expect(index.chunks.some((c) => c.path === 'index.html' && c.label.includes('hero'))).toBe(true)
    expect(index.chunks.some((c) => c.path === 'css/main.css')).toBe(true)
  })
})

describe('searchProjectCodeIndex', () => {
  it('ranks hero chunk for hero color query', () => {
    const index = buildProjectCodeIndex(sampleProject)
    const hits = searchProjectCodeIndex(index, 'Đổi màu hero sang cam')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.chunk.path === 'css/main.css' || h.chunk.label.includes('hero'))).toBe(
      true
    )
  })
})

describe('rankedFilesFromSearch', () => {
  it('merges semantic hits with heuristic ranking', () => {
    const index = buildProjectCodeIndex(sampleProject)
    const hits = searchProjectCodeIndex(index, 'hero background color')
    const ranked = rankedFilesFromSearch(sampleProject, 'hero background color', hits)
    expect(ranked.length).toBeGreaterThan(0)
    expect(ranked[0]?.file.path).toBeDefined()
  })
})
