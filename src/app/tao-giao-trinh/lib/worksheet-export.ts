/**
 * Xuất phiếu bài tập ra PDF và Word.
 */
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  convertInchesToTwip,
} from 'docx'
import { saveAs } from 'file-saver'

/** Xuất Markdown ra PDF (render HTML rồi chụp). */
export async function exportWorksheetToPdf(
  content: string,
  filename: string,
  containerRef: HTMLDivElement | null
): Promise<void> {
  if (!containerRef) {
    const div = document.createElement('div')
    div.className = 'p-6 max-w-[210mm] bg-white text-black text-sm leading-relaxed'
    div.style.width = '210mm'
    div.style.fontFamily = 'system-ui, sans-serif'
    div.innerHTML = markdownToSimpleHtml(content)
    div.style.position = 'absolute'
    div.style.left = '-9999px'
    div.style.top = '0'
    document.body.appendChild(div)
    try {
      const canvas = await html2canvas(div, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()
      const imgW = canvas.width
      const imgH = canvas.height
      const ratio = Math.min(pdfW / imgW, pdfH / imgH) * 0.95
      const w = imgW * ratio
      const h = imgH * ratio
      pdf.addImage(imgData, 'PNG', 10, 10, w, h)
      pdf.save(filename)
    } finally {
      document.body.removeChild(div)
    }
    return
  }
  const canvas = await html2canvas(containerRef, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pdfW = pdf.internal.pageSize.getWidth()
  const pdfH = pdf.internal.pageSize.getHeight()
  const imgW = canvas.width
  const imgH = canvas.height
  const ratio = Math.min(pdfW / imgW, pdfH / imgH) * 0.95
  const w = imgW * ratio
  const h = imgH * ratio
  pdf.addImage(imgData, 'PNG', 10, 10, w, h)
  pdf.save(filename)
}

function markdownToSimpleHtml(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:12px 0 6px">$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:600;margin:16px 0 8px">$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:20px 0 10px">$1</h1>')
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<p style="margin:4px 0 4px 12px">$1</p>')
  html = html.replace(/^-\s+(.+)$/gm, '<p style="margin:2px 0 2px 16px">• $1</p>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/\$([^$]+)\$/g, '<code style="background:#f0f0f0;padding:1px 4px;border-radius:2px">$1</code>')
  const lines = html.split(/\n\n+/)
  const wrapped = lines.map((line) => {
    if (line.startsWith('<h') || line.startsWith('<p') || line.startsWith('<li')) return line
    return `<p style="margin:6px 0">${line.replace(/\n/g, '<br/>')}</p>`
  })
  return wrapped.join('')
}

/** Xuất Markdown ra Word (.docx). */
export async function exportWorksheetToWord(content: string, filename: string): Promise<void> {
  const children: Paragraph[] = []
  const lines = content.split(/\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^# (.+)$/.test(line)) {
      children.push(
        new Paragraph({
          text: line.replace(/^# (.+)$/, '$1'),
          heading: HeadingLevel.TITLE,
          spacing: { after: 200 },
        })
      )
    } else if (/^## (.+)$/.test(line)) {
      children.push(
        new Paragraph({
          text: line.replace(/^## (.+)$/, '$1'),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 240, after: 120 },
        })
      )
    } else if (/^### (.+)$/.test(line)) {
      children.push(
        new Paragraph({
          text: line.replace(/^### (.+)$/, '$1'),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 180, after: 80 },
        })
      )
    } else if (/^\d+\.\s+(.+)$/.test(line)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line.replace(/^\d+\.\s+/, ''), size: 22 })],
          indent: { left: convertInchesToTwip(0.25) },
          spacing: { after: 80 },
        })
      )
    } else if (/^-\s+(.+)$/.test(line)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '• ' + line.replace(/^- /, ''), size: 22 })],
          indent: { left: convertInchesToTwip(0.25) },
          spacing: { after: 60 },
        })
      )
    } else if (line.trim()) {
      const text = line
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/\$([^$]+)\$/g, '$1')
      children.push(
        new Paragraph({
          children: [new TextRun({ text, size: 22 })],
          spacing: { after: 80 },
        })
      )
    }
    i++
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, filename)
}
