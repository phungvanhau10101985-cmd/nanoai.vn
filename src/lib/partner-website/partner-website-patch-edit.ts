import {
  formatFileWithLineNumbers,
  rankProjectFilesForQuery,
  summarizeRankedFiles,
} from '@/lib/partner-website/partner-website-file-search'
import {
  applyPartnerWebsiteEdits,
  type PartnerWebsiteEditPayload,
} from '@/lib/partner-website/partner-website-patch'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

export type { PartnerWebsiteEditPayload }

export function buildPatchEditPrompt(input: {
  locale: string
  context: string
  userMessage: string
  history: string
  project: PartnerWebsiteProject
  rankedFiles: ReturnType<typeof rankProjectFilesForQuery>
}): string {
  const fileBlocks = input.rankedFiles
    .map((row) => {
      return `FILE: ${row.file.path} (${row.file.kind})
RELEVANCE: ${row.reasons.join(', ') || 'selected'}
\`\`\`
${formatFileWithLineNumbers(row.file.content)}
\`\`\``
    })
    .join('\n\n')

  return `You are editing an existing static landing page. Apply ONLY the user request using surgical patches.

${input.context}

SELECTED FILES (only edit these unless you must add a new file):
${summarizeRankedFiles(input.rankedFiles)}

${fileBlocks}

CHAT HISTORY:
${input.history || '(none)'}

USER REQUEST:
${input.userMessage}

Rules:
- Prefer minimal patches — copy "search" text EXACTLY from the numbered file content above (without line numbers).
- Each patch replaces the first exact match of "search" with "replace".
- Use "content" (full file) only if patches are too large or structure changes heavily.
- Do NOT rewrite unrelated files.
- You may add "newFiles" for new assets if needed.
- UI copy language: ${input.locale}

Return ONLY valid JSON (no markdown fences):
{
  "assistantMessage": "Summary in ${input.locale}",
  "edits": [
    {
      "path": "index.html",
      "patches": [
        { "search": "exact snippet from file", "replace": "updated snippet" }
      ]
    }
  ],
  "newFiles": []
}`
}

export function parseEditPayload(text: string): PartnerWebsiteEditPayload | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fence?.[1]?.trim() || trimmed
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as PartnerWebsiteEditPayload
  } catch {
    return null
  }
}

export function tryApplyPatchEdits(
  project: PartnerWebsiteProject,
  payload: PartnerWebsiteEditPayload
): { project: PartnerWebsiteProject; appliedPaths: string[]; failedPaths: string[] } | null {
  if (!payload.edits?.length && !payload.newFiles?.length) return null
  const result = applyPartnerWebsiteEdits(project, payload)
  if (!result.appliedPaths.length) return null
  return result
}

export function buildPatchSuccessMessage(
  locale: string,
  appliedPaths: string[],
  failedPaths: string[],
  baseMessage?: string | null
): string {
  const filesLine =
    locale === 'vi'
      ? `Đã sửa file: ${appliedPaths.join(', ')}.`
      : `Edited files: ${appliedPaths.join(', ')}.`
  const failLine =
    failedPaths.length > 0
      ? locale === 'vi'
        ? ` Không áp dụng được: ${failedPaths.join(', ')}.`
        : ` Could not apply: ${failedPaths.join(', ')}.`
      : ''
  return `${baseMessage?.trim() || filesLine}${baseMessage ? ` ${filesLine}` : ''}${failLine}`.trim()
}
