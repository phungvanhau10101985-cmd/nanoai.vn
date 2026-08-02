import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteProSectionImages } from '@/lib/partner-website/pro/partner-website-pro-images'

const INJECT_MARKER = 'data-pw-section-images-inject'

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function findHtmlFileIndex(project: PartnerWebsiteProject): number {
  const entry = project.entryPath?.replace(/^\//, '') || 'index.html'
  const byEntry = project.files.findIndex((f) => f.path === entry || f.path.endsWith(`/${entry}`))
  if (byEntry >= 0) return byEntry
  return project.files.findIndex(
    (f) => f.kind === 'html' || /\.html?$/i.test(f.path)
  )
}

function buildInjectBlock(
  missing: Array<[string, string]>,
  localeHint?: string
): string {
  // Never inject product_* collage cards — product grids load live shop inventory.
  const others = missing.filter(([k]) => !k.startsWith('product_'))
  if (!others.length) return ''
  const title =
    localeHint === 'vi' ? 'Hình ảnh bộ sưu tập' : 'Collection visuals'

  const otherBlocks = others
    .map(
      ([key, url]) => `<figure class="pw-ai-banner" data-pw-img-key="${escapeHtmlAttr(key)}">
  <img src="${escapeHtmlAttr(url)}" alt="${escapeHtmlAttr(key)}" loading="lazy" />
</figure>`
    )
    .join('\n')

  return `
<section ${INJECT_MARKER}="1" class="pw-ai-visuals" aria-label="${escapeHtmlAttr(title)}">
  <style>
    .pw-ai-visuals{padding:2.5rem 1.25rem;max-width:1200px;margin:0 auto}
    .pw-ai-visuals h2{margin:0 0 1.25rem;font-size:clamp(1.25rem,2.5vw,1.75rem)}
    .pw-ai-banner{margin:0 0 1.25rem;border-radius:16px;overflow:hidden}
    .pw-ai-banner img{display:block;width:100%;height:auto;object-fit:cover;aspect-ratio:16/9}
  </style>
  <h2>${escapeHtmlAttr(title)}</h2>
  ${otherBlocks}
</section>
`.trim()
}

/**
 * Force every generated section image URL into the entry HTML if the model omitted it.
 * Prevents sparse pages when vision only embeds 1–2 of many AI images.
 */
export function ensureSectionImagesInProject(
  project: PartnerWebsiteProject,
  sectionImages: PartnerWebsiteProSectionImages | Record<string, string | undefined> | undefined,
  options?: { locale?: string }
): PartnerWebsiteProject {
  if (!sectionImages) return project

  const entries = Object.entries(sectionImages).filter(
    (row): row is [string, string] =>
      Boolean(row[1]?.trim()) && /^https?:\/\//i.test(String(row[1]).trim())
  )
  if (!entries.length) return project

  const htmlIdx = findHtmlFileIndex(project)
  if (htmlIdx < 0) return project

  const file = project.files[htmlIdx]
  let html = file.content
  const missing = entries.filter(([, url]) => !html.includes(url.trim()))
  if (!missing.length) return project

  // Prefer hero as CSS background on first hero-like section if missing
  const hero = missing.find(([k]) => k === 'hero')
  if (hero && !/data-pw-hero-bg/i.test(html)) {
    const heroUrl = escapeHtmlAttr(hero[1].trim())
    const heroStyle = `<style data-pw-hero-bg="1">.hero,.pw-hero,[class*="hero"]{background-image:linear-gradient(rgba(0,0,0,.35),rgba(0,0,0,.35)),url("${heroUrl}")!important;background-size:cover;background-position:center}</style>`
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${heroStyle}\n</head>`)
    } else {
      html = `${heroStyle}\n${html}`
    }
  }

  const stillMissing = entries.filter(([, url]) => !html.includes(url.trim()))
  if (!stillMissing.length) {
    const files = [...project.files]
    files[htmlIdx] = { ...file, content: html }
    return { ...project, files }
  }

  // Drop product collage slots — live catalog fills product grids from inventory API.
  const injectable = stillMissing.filter(([k]) => !k.startsWith('product_'))
  if (!injectable.length) {
    const files = [...project.files]
    files[htmlIdx] = { ...file, content: html }
    return { ...project, files }
  }

  if (html.includes(INJECT_MARKER)) {
    const banners = injectable
      .map(
        ([key, url]) =>
          `<figure class="pw-ai-banner" data-pw-img-key="${escapeHtmlAttr(key)}"><img src="${escapeHtmlAttr(url.trim())}" alt="${escapeHtmlAttr(key)}" loading="lazy" /></figure>`
      )
      .join('\n')
    html = html.replace(
      new RegExp(`(<section[^>]*${INJECT_MARKER}[^>]*>)`, 'i'),
      `$1\n${banners}\n`
    )
  } else {
    const block = buildInjectBlock(
      injectable.map(([k, u]) => [k, u.trim()]),
      options?.locale
    )
    if (!block) {
      const files = [...project.files]
      files[htmlIdx] = { ...file, content: html }
      return { ...project, files }
    }
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${block}\n</body>`)
    } else if (/<footer\b/i.test(html)) {
      html = html.replace(/<footer\b/i, `${block}\n<footer`)
    } else {
      html = `${html}\n${block}`
    }
  }

  const files = [...project.files]
  files[htmlIdx] = { ...file, content: html }
  return { ...project, files }
}

export function collectSectionImageUrls(
  sectionImages: PartnerWebsiteProSectionImages | Record<string, string | undefined> | undefined
): string[] {
  if (!sectionImages) return []
  const seen = new Set<string>()
  const out: string[] = []
  const order = [
    'hero',
    'material',
    'lifestyle',
    'product_1',
    'product_2',
    'product_3',
    'product_4',
  ]
  for (const key of order) {
    const url = sectionImages[key as keyof typeof sectionImages]?.trim()
    if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url)
      out.push(url)
    }
  }
  for (const [key, raw] of Object.entries(sectionImages)) {
    if (order.includes(key)) continue
    const url = raw?.trim()
    if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url)
      out.push(url)
    }
  }
  return out
}
