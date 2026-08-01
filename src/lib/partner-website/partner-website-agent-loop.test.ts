import { describe, expect, it } from 'vitest'
import { runPartnerWebsiteEditAgent } from '@/lib/partner-website/partner-website-agent-loop'
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
<section class="hero"><h1>Hero</h1></section>
</body>
</html>`,
    },
    {
      path: 'css/main.css',
      kind: 'css',
      content: `.hero { background: orange; color: white; }`,
    },
  ],
}

describe('runPartnerWebsiteEditAgent', () => {
  it('applies patch from mocked model and returns diffs', async () => {
    const result = await runPartnerWebsiteEditAgent({
      locale: 'vi',
      context: 'Shop test',
      userMessage: 'Đổi màu hero sang xanh',
      history: '',
      project: sampleProject,
      modelId: 'deepseek-v4-flash',
      generate: async () => ({
        text: JSON.stringify({
          assistantMessage: 'Đã đổi màu hero.',
          edits: [
            {
              path: 'css/main.css',
              patches: [{ search: 'background: orange', replace: 'background: blue' }],
            },
          ],
        }),
      }),
    })

    expect(result).not.toBeNull()
    expect(result!.appliedPaths).toContain('css/main.css')
    expect(result!.steps.some((s) => s.kind === 'search')).toBe(true)
    expect(result!.steps.some((s) => s.kind === 'patch')).toBe(true)
    expect(result!.fileDiffs.some((d) => d.path === 'css/main.css')).toBe(true)
    const css = result!.project.files.find((f) => f.path === 'css/main.css')?.content ?? ''
    expect(css).toContain('background: blue')
  })

  it('returns null when patches never apply', async () => {
    const result = await runPartnerWebsiteEditAgent({
      locale: 'en',
      context: 'Shop test',
      userMessage: 'Change hero color',
      history: '',
      project: sampleProject,
      modelId: 'deepseek-v4-flash',
      generate: async () => ({
        text: JSON.stringify({
          edits: [
            {
              path: 'css/main.css',
              patches: [{ search: 'nonexistent-string', replace: 'x' }],
            },
          ],
        }),
      }),
    })

    expect(result).toBeNull()
  })
})
