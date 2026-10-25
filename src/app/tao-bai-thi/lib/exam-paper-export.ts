import { latexToReadable } from '@/app/tao-giao-trinh/lib/latex-to-readable'
import { exportWorksheetToWord } from '@/app/tao-giao-trinh/lib/worksheet-export'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export type ExamPaperQuestion = {
  questionText: string
  options: string[]
  points: number
  minutes: number
  type?: 'quiz' | 'essay'
}

export function buildExamPaperMarkdown(exam: {
  title: string
  durationMinutes: number
  questions: ExamPaperQuestion[]
}): string {
  const lines: string[] = [
    `# ${exam.title}`,
    '',
    `**Thời gian: ${exam.durationMinutes} phút**`,
    '',
    '---',
    '',
  ]
  exam.questions.forEach((q, i) => {
    const points = Number.isFinite(q.points) ? q.points : 0
    const minutes = Number.isFinite(q.minutes) ? q.minutes : 0
    lines.push(`### Câu ${i + 1}. (${points} điểm · ${minutes} phút)`)
    lines.push('')
    lines.push(latexToReadable(q.questionText))
    lines.push('')
    const opts = Array.isArray(q.options) ? q.options : []
    if (opts.length > 0) {
      ;['A', 'B', 'C', 'D'].forEach((label, j) => {
        const opt = opts[j]
        if (opt) lines.push(`${label}. ${latexToReadable(opt)}`)
      })
    }
    lines.push('')
  })
  return lines.join('\n')
}

function markdownToSimpleHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:15px;font-weight:700;margin:16px 0 6px">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:700;margin:0 0 8px">$1</h1>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #cbd5e1;margin:10px 0"/>')
  const lines = html.split('\n')
  return lines
    .map((line) => {
      if (!line.trim()) return '<div style="height:8px"></div>'
      if (line.startsWith('<h') || line.startsWith('<hr')) return line
      return `<p style="margin:2px 0;line-height:1.45">${line}</p>`
    })
    .join('')
}

export async function exportExamPaperPdf(markdown: string, filename: string): Promise<void> {
  const div = document.createElement('div')
  div.style.width = '190mm'
  div.style.padding = '8mm'
  div.style.background = '#ffffff'
  div.style.color = '#111111'
  div.style.fontFamily = 'system-ui, sans-serif'
  div.style.fontSize = '13px'
  div.style.position = 'absolute'
  div.style.left = '-9999px'
  div.style.top = '0'
  div.innerHTML = markdownToSimpleHtml(markdown)
  document.body.appendChild(div)
  try {
    const canvas = await html2canvas(div, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 8
    const printableW = pageW - margin * 2
    const printableH = pageH - margin * 2
    const pxPerMm = canvas.width / printableW
    const pagePxH = Math.max(1, Math.floor(printableH * pxPerMm))
    let y = 0
    let page = 0
    while (y < canvas.height) {
      const sliceH = Math.min(pagePxH, canvas.height - y)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sliceH
      const ctx = slice.getContext('2d')
      if (!ctx) break
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      if (page > 0) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, printableW, sliceH / pxPerMm)
      y += sliceH
      page += 1
    }
    pdf.save(filename)
  } finally {
    document.body.removeChild(div)
  }
}

export async function exportExamPaperWord(markdown: string, filename: string): Promise<void> {
  await exportWorksheetToWord(markdown, filename)
}
