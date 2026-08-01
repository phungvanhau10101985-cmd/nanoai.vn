import type { PartnerWebsiteProject, PartnerWebsiteProjectFile } from '@/lib/partner-website/partner-website-types'

export type RankedProjectFile = {
  file: PartnerWebsiteProjectFile
  score: number
  reasons: string[]
}

const HTML_HINTS =
  /\b(hero|header|footer|section|faq|product|sản phẩm|danh sách|landing|html|nav|menu|form|nút|button|tiêu đề|headline|cta|liên hệ|contact|gallery|grid|card|ảnh|image|logo|content|nội dung|bố cục|layout|thêm section|add section)\b/i

const CSS_HINTS =
  /\b(màu|color|css|style|font|typography|background|responsive|mobile|tablet|padding|margin|hero|gradient|theme|palette|xám|cam|orange|gray|grey|đẹp hơn|spacing|width|height|border|shadow)\b/i

const JS_HINTS =
  /\b(javascript|js|script|click|scroll|animation|slider|carousel|toggle|event|interactive|form submit|validate)\b/i

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

function scoreFileForQuery(file: PartnerWebsiteProjectFile, query: string, tokens: string[]): RankedProjectFile {
  const reasons: string[] = []
  let score = 0
  const lowerPath = file.path.toLowerCase()
  const lowerContent = file.content.toLowerCase()
  const lowerQuery = query.toLowerCase()

  if (file.kind === 'html' || lowerPath.endsWith('.html')) {
    score += 2
    if (HTML_HINTS.test(query)) {
      score += 8
      reasons.push('html-intent')
    }
  }
  if (file.kind === 'css' || lowerPath.endsWith('.css')) {
    if (CSS_HINTS.test(query)) {
      score += 10
      reasons.push('css-intent')
    } else {
      score += 1
    }
  }
  if (file.kind === 'js' || lowerPath.endsWith('.js')) {
    if (JS_HINTS.test(query)) {
      score += 10
      reasons.push('js-intent')
    }
  }

  if (lowerPath.includes('index.html')) score += 3
  if (lowerPath.includes('main.css')) score += 2

  for (const token of tokens) {
    if (lowerPath.includes(token)) {
      score += 4
      reasons.push(`path:${token}`)
    }
    const contentHits = lowerContent.split(token).length - 1
    if (contentHits > 0) {
      score += Math.min(6, contentHits * 2)
      reasons.push(`content:${token}`)
    }
  }

  if (lowerQuery.includes(file.path.toLowerCase())) {
    score += 12
    reasons.push('path-explicit')
  }

  return { file, score, reasons }
}

export function rankProjectFilesForQuery(
  project: PartnerWebsiteProject,
  query: string,
  maxFiles = 3
): RankedProjectFile[] {
  const tokens = tokenizeQuery(query)
  const ranked = project.files
    .map((file) => scoreFileForQuery(file, query, tokens))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  const picked: RankedProjectFile[] = []
  const seen = new Set<string>()

  for (const row of ranked) {
    if (picked.length >= maxFiles) break
    if (seen.has(row.file.path)) continue
    picked.push(row)
    seen.add(row.file.path)
  }

  const indexHtml = project.files.find((f) => f.path === project.entryPath || f.path === 'index.html')
  if (indexHtml && !seen.has(indexHtml.path) && picked.length < maxFiles) {
    picked.push({ file: indexHtml, score: 1, reasons: ['entry-fallback'] })
  }

  if (!picked.length && project.files.length) {
    const first = project.files[0]!
    picked.push({ file: first, score: 0, reasons: ['default'] })
  }

  return picked
}

export function formatFileWithLineNumbers(content: string, maxLines = 400): string {
  const lines = content.split('\n')
  const slice = lines.length > maxLines ? lines.slice(0, maxLines) : lines
  const numbered = slice.map((line, i) => `${String(i + 1).padStart(4, ' ')}| ${line}`)
  if (lines.length > maxLines) {
    numbered.push(`     | ... (${lines.length - maxLines} more lines truncated)`)
  }
  return numbered.join('\n')
}

export function summarizeRankedFiles(rows: RankedProjectFile[]): string {
  return rows.map((r) => `${r.file.path} (score ${r.score})`).join(', ')
}
