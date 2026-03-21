'use client'

import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'

/** HTML hiển thị (dùng chung cho phiếu + chế độ có nút sửa từng câu). */
export function worksheetMarkdownToHtml(markdown: string, questionBadge: string): string {
  const readable = latexToReadable(markdown)
  return markdownToSimpleHtml(readable, questionBadge)
}

/** Hiển thị nội dung phiếu bài tập (Markdown đơn giản, LaTeX chuyển sang ký hiệu đọc được). */
export default function WorksheetView({ content, questionBadge }: { content: string; questionBadge: string }) {
  const html = worksheetMarkdownToHtml(content, questionBadge)
  return (
    <article
      className="worksheet-prose prose prose-slate max-w-none text-[15px] leading-relaxed text-foreground dark:prose-invert prose-headings:scroll-mt-24 prose-headings:text-[15px] prose-headings:font-semibold prose-headings:leading-snug prose-headings:tracking-tight prose-h1:mb-2 prose-h1:mt-5 prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-1.5 prose-h1:first:mt-0 prose-h2:mb-2 prose-h2:mt-5 prose-h2:border-b prose-h2:border-border/50 prose-h2:pb-1.5 prose-h3:mb-2 prose-h3:mt-5 prose-h3:border-b prose-h3:border-border/50 prose-h3:pb-1.5 prose-p:my-2 prose-p:text-[15px] prose-p:leading-relaxed prose-strong:font-semibold prose-strong:text-foreground"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-foreground/90">$1</em>')
}

/** Cùng một cỡ chữ cho # / ## / ### để mọi “Bài 1”, “Bài 2”, phần trắc nghiệm/tự luận đồng đều. */
const WORKSHEET_HEADING_CLASS =
  'mt-5 mb-2 scroll-mt-24 border-b border-border/50 pb-1.5 text-[15px] font-semibold leading-snug tracking-tight text-foreground first:mt-0'

type LessonTone = {
  heading: string
  wrapper: string
  card: string
  badge: string
  bullet: string
  body: string
}

const LESSON_TONES: LessonTone[] = [
  {
    heading: 'text-emerald-800 dark:text-emerald-200',
    wrapper: 'border-emerald-300/75 bg-emerald-50/35 dark:border-emerald-700/45 dark:bg-emerald-950/18',
    card: 'border-emerald-400/80 bg-emerald-100/70 dark:border-emerald-600/60 dark:bg-emerald-900/35',
    badge: 'bg-emerald-700 dark:bg-emerald-500',
    bullet: 'before:text-emerald-700 dark:before:text-emerald-300',
    body: 'text-emerald-900 dark:text-emerald-100',
  },
  {
    heading: 'text-sky-800 dark:text-sky-200',
    wrapper: 'border-sky-300/75 bg-sky-50/35 dark:border-sky-700/45 dark:bg-sky-950/18',
    card: 'border-sky-400/80 bg-sky-100/70 dark:border-sky-600/60 dark:bg-sky-900/35',
    badge: 'bg-sky-700 dark:bg-sky-500',
    bullet: 'before:text-sky-700 dark:before:text-sky-300',
    body: 'text-sky-900 dark:text-sky-100',
  },
  {
    heading: 'text-violet-800 dark:text-violet-200',
    wrapper: 'border-violet-300/75 bg-violet-50/35 dark:border-violet-700/45 dark:bg-violet-950/18',
    card: 'border-violet-400/80 bg-violet-100/70 dark:border-violet-600/60 dark:bg-violet-900/35',
    badge: 'bg-violet-700 dark:bg-violet-500',
    bullet: 'before:text-violet-700 dark:before:text-violet-300',
    body: 'text-violet-900 dark:text-violet-100',
  },
  {
    heading: 'text-amber-800 dark:text-amber-200',
    wrapper: 'border-amber-300/75 bg-amber-50/35 dark:border-amber-700/45 dark:bg-amber-950/18',
    card: 'border-amber-400/80 bg-amber-100/70 dark:border-amber-600/60 dark:bg-amber-900/35',
    badge: 'bg-amber-700 dark:bg-amber-500',
    bullet: 'before:text-amber-700 dark:before:text-amber-300',
    body: 'text-amber-900 dark:text-amber-100',
  },
]

function isLessonHeading(text: string): boolean {
  return /^(bài|bai|lesson)\s*\d+\b/i.test(text.trim())
}

function markdownToSimpleHtml(md: string, questionBadge: string): string {
  const badge = escapeHtml(questionBadge)
  const html = escapeHtml(md)
  const lines = html.split(/\n/)
  const out: string[] = []
  const listBuf: string[] = []
  let lessonIndex = -1
  let currentTone = LESSON_TONES[0]
  let lessonSectionOpen = false

  const flushList = () => {
    if (listBuf.length === 0) return
    out.push(
      `<ul class="my-4 list-none space-y-2 border-l-2 border-emerald-500/35 py-1 pl-4 dark:border-emerald-400/30">${listBuf.join('')}</ul>`
    )
    listBuf.length = 0
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^### (.+)$/.test(line)) {
      flushList()
      const headingText = line.replace(/^### (.+)$/, '$1')
      if (isLessonHeading(headingText)) {
        if (lessonSectionOpen) out.push('</section>')
        lessonIndex += 1
        currentTone = LESSON_TONES[lessonIndex % LESSON_TONES.length]
        out.push(`<section class="my-4 rounded-xl border px-4 py-3 ${currentTone.wrapper}">`)
        lessonSectionOpen = true
      }
      const inner = formatInline(headingText)
      out.push(`<h3 class="${WORKSHEET_HEADING_CLASS} ${currentTone.heading}">${inner}</h3>`)
    } else if (/^## (.+)$/.test(line)) {
      flushList()
      const headingText = line.replace(/^## (.+)$/, '$1')
      if (isLessonHeading(headingText)) {
        if (lessonSectionOpen) out.push('</section>')
        lessonIndex += 1
        currentTone = LESSON_TONES[lessonIndex % LESSON_TONES.length]
        out.push(`<section class="my-4 rounded-xl border px-4 py-3 ${currentTone.wrapper}">`)
        lessonSectionOpen = true
      }
      const inner = formatInline(headingText)
      out.push(`<h2 class="${WORKSHEET_HEADING_CLASS} ${currentTone.heading}">${inner}</h2>`)
    } else if (/^# (.+)$/.test(line)) {
      flushList()
      const headingText = line.replace(/^# (.+)$/, '$1')
      if (isLessonHeading(headingText)) {
        if (lessonSectionOpen) out.push('</section>')
        lessonIndex += 1
        currentTone = LESSON_TONES[lessonIndex % LESSON_TONES.length]
        out.push(`<section class="my-4 rounded-xl border px-4 py-3 ${currentTone.wrapper}">`)
        lessonSectionOpen = true
      }
      const inner = formatInline(headingText)
      out.push(`<h1 class="${WORKSHEET_HEADING_CLASS} ${currentTone.heading}">${inner}</h1>`)
    } else if (/^(\d+)\.\s+(.+)$/.test(line)) {
      flushList()
      const m = line.match(/^(\d+)\.\s+(.+)$/)
      if (m) {
        const num = m[1]
        const rest = formatInline(m[2])
        out.push(
          `<div class="my-5 rounded-xl border p-4 shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.04] ${currentTone.card}">` +
            `<div class="mb-2 flex items-center gap-2">` +
            `<span class="inline-flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md px-2 text-xs font-bold text-white shadow-sm ${currentTone.badge}">${num}</span>` +
            `<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">${badge}</span>` +
            `</div>` +
            `<div class="text-[15px] leading-relaxed ${currentTone.body}">${rest}</div>` +
            `</div>`
        )
      } else {
        out.push(`<p class="my-2 pl-1">${line}</p>`)
      }
    } else if (/^-\s+(.+)$/.test(line)) {
      const inner = formatInline(line.replace(/^-\s+/, ''))
      listBuf.push(
        `<li class="relative pl-1 text-[15px] leading-relaxed ${currentTone.body} before:absolute before:-left-3 before:font-bold before:content-['·'] ${currentTone.bullet}">${inner}</li>`
      )
    } else if (line.trim()) {
      flushList()
      out.push(`<p class="my-2 text-[15px] leading-relaxed ${currentTone.body}">${formatInline(line)}</p>`)
    } else {
      flushList()
      out.push('<div class="h-2" aria-hidden="true"></div>')
    }
  }
  flushList()
  if (lessonSectionOpen) out.push('</section>')
  return `<div class="space-y-0">${out.join('')}</div>`
}
