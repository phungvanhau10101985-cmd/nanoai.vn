'use client'

/** Hiển thị nội dung phiếu bài tập (Markdown đơn giản, LaTeX hiển thị dạng text). */
export default function WorksheetView({ content }: { content: string }) {
  const html = markdownToSimpleHtml(content)
  return (
    <article
      className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function markdownToSimpleHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const lines = html.split(/\n/)
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^### (.+)$/.test(line)) {
      out.push(`<h3 class="text-base font-semibold mt-4 mb-2">${line.replace(/^### (.+)$/, '$1')}</h3>`)
    } else if (/^## (.+)$/.test(line)) {
      out.push(`<h2 class="text-lg font-semibold mt-6 mb-2">${line.replace(/^## (.+)$/, '$1')}</h2>`)
    } else if (/^# (.+)$/.test(line)) {
      out.push(`<h1 class="text-xl font-bold mt-6 mb-2">${line.replace(/^# (.+)$/, '$1')}</h1>`)
    } else if (/^\d+\.\s+(.+)$/.test(line)) {
      out.push(`<p class="ml-2 my-1">${line.replace(/^\d+\.\s+/, '')}</p>`)
    } else if (/^-\s+(.+)$/.test(line)) {
      out.push(`<li class="ml-4">${line.replace(/^- /, '')}</li>`)
    } else if (line.trim()) {
      const formatted = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\$([^$]+)\$/g, '<code class="bg-muted px-1 rounded">$1</code>')
      out.push(`<p class="my-1">${formatted}</p>`)
    } else {
      out.push('<br/>')
    }
  }
  return `<div class="space-y-1">${out.join('')}</div>`
}
