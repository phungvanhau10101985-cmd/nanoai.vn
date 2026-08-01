import type { PartnerWebsiteProject, PartnerWebsiteProjectFile } from '@/lib/partner-website/partner-website-types'
import { rankProjectFilesForQuery, type RankedProjectFile } from '@/lib/partner-website/partner-website-file-search'

export type CodeChunk = {
  id: string
  path: string
  kind: PartnerWebsiteProjectFile['kind']
  label: string
  startLine: number
  endLine: number
  text: string
  tokens: Set<string>
}

export type CodeSearchHit = {
  chunk: CodeChunk
  score: number
  reasons: string[]
}

export type ProjectCodeIndex = {
  project: PartnerWebsiteProject
  chunks: CodeChunk[]
}

const STOP_WORDS = new Set([
  'và',
  'the',
  'for',
  'with',
  'của',
  'cho',
  'trên',
  'vào',
  'một',
  'các',
  'this',
  'that',
  'from',
])

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
  return new Set(tokens)
}

function chunkHtmlFile(file: PartnerWebsiteProjectFile): CodeChunk[] {
  const lines = file.content.split('\n')
  const chunks: CodeChunk[] = []
  const markers = [
    /<section\b[^>]*>/gi,
    /<header\b[^>]*>/gi,
    /<footer\b[^>]*>/gi,
    /<nav\b[^>]*>/gi,
    /<main\b[^>]*>/gi,
  ]

  const starts = new Set<number>()
  for (const re of markers) {
    let m: RegExpExecArray | null
    const copy = new RegExp(re.source, re.flags)
    while ((m = copy.exec(file.content)) !== null) {
      const lineNo = file.content.slice(0, m.index).split('\n').length
      starts.add(lineNo)
    }
  }

  const startLines = [...starts].sort((a, b) => a - b)
  if (!startLines.length) {
    return [
      {
        id: `${file.path}:1-${lines.length}`,
        path: file.path,
        kind: file.kind,
        label: 'document',
        startLine: 1,
        endLine: lines.length,
        text: file.content,
        tokens: tokenize(file.content),
      },
    ]
  }

  for (let i = 0; i < startLines.length; i++) {
    const start = startLines[i]!
    const end = i + 1 < startLines.length ? startLines[i + 1]! - 1 : lines.length
    const slice = lines.slice(start - 1, end).join('\n')
    const tag = slice.match(/<(section|header|footer|nav|main)\b[^>]*(?:id|class)=["']([^"']+)["']/i)
    const label = tag?.[2] || tag?.[1] || `block-${start}`
    chunks.push({
      id: `${file.path}:${start}-${end}`,
      path: file.path,
      kind: file.kind,
      label,
      startLine: start,
      endLine: end,
      text: slice,
      tokens: tokenize(slice),
    })
  }

  return chunks
}

function chunkCssFile(file: PartnerWebsiteProjectFile): CodeChunk[] {
  const chunks: CodeChunk[] = []
  const parts = file.content.split(/(?=\.[#a-zA-Z[])/)
  let line = 1
  for (const part of parts) {
    if (!part.trim()) continue
    const startLine = line
    const partLines = part.split('\n')
    line += partLines.length
    const selector = part.match(/^([^{]+)/)?.[1]?.trim().slice(0, 80) || 'rule'
    chunks.push({
      id: `${file.path}:${startLine}-${line - 1}`,
      path: file.path,
      kind: file.kind,
      label: selector,
      startLine,
      endLine: line - 1,
      text: part.trim(),
      tokens: tokenize(part),
    })
  }
  if (!chunks.length) {
    return [
      {
        id: `${file.path}:all`,
        path: file.path,
        kind: file.kind,
        label: 'stylesheet',
        startLine: 1,
        endLine: file.content.split('\n').length,
        text: file.content,
        tokens: tokenize(file.content),
      },
    ]
  }
  return chunks
}

function chunkGenericFile(file: PartnerWebsiteProjectFile, size = 40): CodeChunk[] {
  const lines = file.content.split('\n')
  const chunks: CodeChunk[] = []
  for (let i = 0; i < lines.length; i += size) {
    const slice = lines.slice(i, i + size)
    const start = i + 1
    const end = i + slice.length
    chunks.push({
      id: `${file.path}:${start}-${end}`,
      path: file.path,
      kind: file.kind,
      label: `lines ${start}-${end}`,
      startLine: start,
      endLine: end,
      text: slice.join('\n'),
      tokens: tokenize(slice.join('\n')),
    })
  }
  return chunks
}

export function buildProjectCodeIndex(project: PartnerWebsiteProject): ProjectCodeIndex {
  const chunks: CodeChunk[] = []
  for (const file of project.files) {
    if (file.kind === 'html' || file.path.endsWith('.html')) {
      chunks.push(...chunkHtmlFile(file))
    } else if (file.kind === 'css' || file.path.endsWith('.css')) {
      chunks.push(...chunkCssFile(file))
    } else {
      chunks.push(...chunkGenericFile(file))
    }
  }
  return { project, chunks }
}

function scoreChunk(chunk: CodeChunk, queryTokens: Set<string>, query: string): CodeSearchHit {
  let score = 0
  const reasons: string[] = []
  const lowerQuery = query.toLowerCase()
  const lowerLabel = chunk.label.toLowerCase()
  const lowerText = chunk.text.toLowerCase()

  for (const token of queryTokens) {
    if (chunk.tokens.has(token)) {
      score += 5
      reasons.push(`token:${token}`)
    }
    if (lowerLabel.includes(token)) {
      score += 4
      reasons.push(`label:${token}`)
    }
    if (lowerText.includes(token)) {
      score += 2
    }
  }

  if (lowerQuery.includes(chunk.path.toLowerCase())) {
    score += 8
    reasons.push('path-match')
  }
  if (lowerQuery.includes(lowerLabel) && lowerLabel.length > 2) {
    score += 6
    reasons.push('label-match')
  }

  return { chunk, score, reasons }
}

export function searchProjectCodeIndex(
  index: ProjectCodeIndex,
  query: string,
  maxChunks = 8
): CodeSearchHit[] {
  const queryTokens = tokenize(query)
  return index.chunks
    .map((chunk) => scoreChunk(chunk, queryTokens, query))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks)
}

export function rankedFilesFromSearch(
  project: PartnerWebsiteProject,
  query: string,
  hits: CodeSearchHit[],
  maxFiles = 3
): RankedProjectFile[] {
  const fileScores = new Map<string, RankedProjectFile>()

  for (const hit of hits) {
    const file = project.files.find((f) => f.path === hit.chunk.path)
    if (!file) continue
    const existing = fileScores.get(file.path)
    const reasons = [...(existing?.reasons ?? []), `chunk:${hit.chunk.label}`, ...hit.reasons]
    fileScores.set(file.path, {
      file,
      score: (existing?.score ?? 0) + hit.score,
      reasons: [...new Set(reasons)],
    })
  }

  const fromHeuristic = rankProjectFilesForQuery(project, query, maxFiles)
  for (const row of fromHeuristic) {
    const existing = fileScores.get(row.file.path)
    if (existing) {
      existing.score += row.score
      existing.reasons.push(...row.reasons)
    } else {
      fileScores.set(row.file.path, row)
    }
  }

  return [...fileScores.values()].sort((a, b) => b.score - a.score).slice(0, maxFiles)
}

export function formatChunkWithLineNumbers(chunk: CodeChunk): string {
  const lines = chunk.text.split('\n')
  return lines
    .map((line, i) => `${String(chunk.startLine + i).padStart(4, ' ')}| ${line}`)
    .join('\n')
}

export function summarizeSearchHits(hits: CodeSearchHit[]): string {
  if (!hits.length) return '(no chunks matched)'
  return hits
    .slice(0, 6)
    .map((h) => `${h.chunk.path} L${h.chunk.startLine}-${h.chunk.endLine} "${h.chunk.label}" (${h.score})`)
    .join('; ')
}
