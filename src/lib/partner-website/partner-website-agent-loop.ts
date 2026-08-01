import {
  buildProjectCodeIndex,
  formatChunkWithLineNumbers,
  rankedFilesFromSearch,
  searchProjectCodeIndex,
  summarizeSearchHits,
  type CodeSearchHit,
} from '@/lib/partner-website/partner-website-code-index'
import { diffProjectByPath, type FileDiff } from '@/lib/partner-website/partner-website-line-diff'
import type { RankedProjectFile } from '@/lib/partner-website/partner-website-file-search'
import {
  buildPatchEditPrompt,
  buildPatchSuccessMessage,
  parseEditPayload,
  tryApplyPatchEdits,
  type PartnerWebsiteEditPayload,
} from '@/lib/partner-website/partner-website-patch-edit'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteModelId } from '@/lib/partner-website/partner-website-models'

export type AgentStepKind = 'search' | 'patch' | 'verify' | 'retry'

export type PartnerWebsiteAgentStep = {
  kind: AgentStepKind
  message: string
  files?: string[]
}

export type AgentGenerateFn = (
  prompt: string,
  systemPrompt: string
) => Promise<{ text: string | null }>

const PATCH_SYSTEM_PROMPT =
  'You are a precise code editor for static websites. Output only strict JSON with surgical search/replace patches. The search string must match the provided file content exactly.'

const MAX_AGENT_ROUNDS = 3

function projectFileMap(project: PartnerWebsiteProject): Record<string, string> {
  return Object.fromEntries(project.files.map((f) => [f.path, f.content]))
}

function verifyProject(project: PartnerWebsiteProject): string[] {
  const issues: string[] = []
  const html = project.files.find((f) => f.path === project.entryPath || f.kind === 'html')
  if (!html?.content.includes('<html')) issues.push('missing-html-root')
  if (html && !html.content.includes('</body>')) issues.push('missing-body-close')
  return issues
}

function buildPatchPromptWithChunks(input: {
  locale: string
  context: string
  userMessage: string
  history: string
  project: PartnerWebsiteProject
  rankedFiles: RankedProjectFile[]
  hits: CodeSearchHit[]
  retryNote?: string
}): string {
  const chunkBlock =
    input.hits.length > 0
      ? `RELEVANT CODE CHUNKS (semantic search — prefer editing these regions):
${input.hits
  .slice(0, 6)
  .map(
    (h) => `CHUNK: ${h.chunk.path} L${h.chunk.startLine}-${h.chunk.endLine} "${h.chunk.label}" score=${h.score}
\`\`\`
${formatChunkWithLineNumbers(h.chunk)}
\`\`\``
  )
  .join('\n\n')}`
      : ''

  const base = buildPatchEditPrompt({
    locale: input.locale,
    context: input.context,
    userMessage: input.userMessage,
    history: input.history,
    project: input.project,
    rankedFiles: input.rankedFiles,
  })

  return `${base}

${chunkBlock}

${input.retryNote ? `RETRY NOTE:\n${input.retryNote}\n` : ''}`
}

function agentMessage(locale: string, key: string, detail?: string): string {
  const vi: Record<string, string> = {
    search: `Đã quét codebase — tìm thấy vùng liên quan${detail ? `: ${detail}` : ''}.`,
    patch: `Đang áp dụng patch vào file${detail ? `: ${detail}` : ''}…`,
    verify: detail ? `Kiểm tra: ${detail}` : 'Kiểm tra kết quả…',
    retry: `Patch chưa khớp — thử lại lần ${detail ?? '2'}…`,
  }
  const en: Record<string, string> = {
    search: `Indexed codebase — matched regions${detail ? `: ${detail}` : ''}.`,
    patch: `Applying patches${detail ? ` to ${detail}` : ''}…`,
    verify: detail ? `Verify: ${detail}` : 'Verifying result…',
    retry: `Patch mismatch — retry ${detail ?? '2'}…`,
  }
  const table = locale === 'vi' ? vi : en
  return table[key] ?? key
}

export async function runPartnerWebsiteEditAgent(input: {
  locale: string
  context: string
  userMessage: string
  history: string
  project: PartnerWebsiteProject
  modelId: PartnerWebsiteModelId
  generate: AgentGenerateFn
}): Promise<{
  project: PartnerWebsiteProject
  appliedPaths: string[]
  failedPaths: string[]
  assistantMessage: string
  steps: PartnerWebsiteAgentStep[]
  fileDiffs: FileDiff[]
} | null> {
  const beforeMap = projectFileMap(input.project)
  const steps: PartnerWebsiteAgentStep[] = []
  let current = input.project

  const index = buildProjectCodeIndex(current)
  const hits = searchProjectCodeIndex(index, input.userMessage)
  const ranked = rankedFilesFromSearch(current, input.userMessage, hits)

  steps.push({
    kind: 'search',
    message: agentMessage(input.locale, 'search', summarizeSearchHits(hits)),
    files: ranked.map((r) => r.file.path),
  })

  let retryNote = ''
  let lastPayload: PartnerWebsiteEditPayload | null = null
  let appliedPaths: string[] = []
  let failedPaths: string[] = []

  for (let round = 1; round <= MAX_AGENT_ROUNDS; round++) {
    if (round > 1) {
      steps.push({
        kind: 'retry',
        message: agentMessage(input.locale, 'retry', String(round)),
        files: failedPaths,
      })
    }

    const prompt = buildPatchPromptWithChunks({
      locale: input.locale,
      context: input.context,
      userMessage: input.userMessage,
      history: input.history,
      project: current,
      rankedFiles: ranked,
      hits,
      retryNote,
    })

    steps.push({
      kind: 'patch',
      message: agentMessage(input.locale, 'patch', ranked.map((r) => r.file.path).join(', ')),
      files: ranked.map((r) => r.file.path),
    })

    const response = await input.generate(prompt, PATCH_SYSTEM_PROMPT)
    if (!response.text) break

    lastPayload = parseEditPayload(response.text)
    if (!lastPayload) {
      retryNote = 'Previous response was not valid JSON. Return strict JSON with edits[].'
      continue
    }

    const applied = tryApplyPatchEdits(current, lastPayload)
    if (!applied) {
      retryNote =
        'Patches did not apply — ensure search strings match file content EXACTLY (copy from numbered lines).'
      continue
    }

    current = applied.project
    appliedPaths = applied.appliedPaths
    failedPaths = applied.failedPaths

    const verifyIssues = verifyProject(current)
    steps.push({
      kind: 'verify',
      message: agentMessage(
        input.locale,
        'verify',
        verifyIssues.length ? verifyIssues.join(', ') : 'OK'
      ),
      files: appliedPaths,
    })

    if (failedPaths.length === 0 && verifyIssues.length === 0) break

    retryNote = [
      failedPaths.length ? `Failed files: ${failedPaths.join(', ')}.` : '',
      verifyIssues.length ? `Validation: ${verifyIssues.join(', ')}.` : '',
      'Fix only failed parts; keep successful edits.',
    ]
      .filter(Boolean)
      .join(' ')
  }

  if (!appliedPaths.length) return null

  const fileDiffs = diffProjectByPath(beforeMap, projectFileMap(current))
  const assistantMessage = buildPatchSuccessMessage(
    input.locale,
    appliedPaths,
    failedPaths,
    lastPayload?.assistantMessage
  )

  return {
    project: current,
    appliedPaths,
    failedPaths,
    assistantMessage,
    steps,
    fileDiffs,
  }
}
