/** Markdown tối giản → HTML — dùng chung cho slide giáo trình & phiếu bài tập */
export function slideMarkdownToHtml(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  const lines = html.split(/\n/)
  const out: string[] = []
  let inList = false
  for (const line of lines) {
    const bullet = line.match(/^[\-\*]\s+(.+)$/) || line.match(/^\d+\.\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        out.push('<ul class="list-disc pl-5 space-y-1 text-sm">')
        inList = true
      }
      out.push(`<li>${bullet[1]}</li>`)
    } else {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      if (line.trim()) {
        out.push(`<p class="leading-relaxed">${line}</p>`)
      }
    }
  }
  if (inList) out.push('</ul>')
  return out.join('') || ''
}
