import { answerCardDownloadBase, answerCardPayload } from '@/lib/lop/answer-card'

export type AnswerCardExportItem = {
  cardNo: number
  name: string
  token: string
  /** Dòng đã dịch, ví dụ «Mã định danh TST00000001». */
  studentCodeLabel?: string
  /** Dòng đã dịch, ví dụ «Mật khẩu 123456». */
  loginCodeLabel?: string
}

function cardDetailLines(card: AnswerCardExportItem): string[] {
  const lines: string[] = []
  if (card.studentCodeLabel) lines.push(card.studentCodeLabel)
  if (card.loginCodeLabel) lines.push(card.loginCodeLabel)
  return lines
}

const LETTERS = [
  { letter: 'A', color: 'E11D48', rgb: [225, 29, 72] as const },
  { letter: 'B', color: '0284C7', rgb: [2, 132, 199] as const },
  { letter: 'C', color: 'D97706', rgb: [217, 119, 6] as const },
  { letter: 'D', color: '059669', rgb: [5, 150, 105] as const },
]

type QrOptions = { margin: number; width: number; errorCorrectionLevel: 'H' }

type QrEncoder = {
  toDataURL?: (text: string, options: QrOptions) => Promise<string>
  default?: { toDataURL?: (text: string, options: QrOptions) => Promise<string> }
}

async function encodeQr(payload: string): Promise<string> {
  const loaded = (await import('qrcode')) as QrEncoder
  const toDataURL = typeof loaded.toDataURL === 'function' ? loaded.toDataURL : loaded.default?.toDataURL
  if (!toDataURL) throw new Error('qr')
  return toDataURL(payload, { margin: 2, width: 720, errorCorrectionLevel: 'H' })
}

async function qrDataUrl(cardNo: number): Promise<string> {
  const payload = answerCardPayload(cardNo)
  if (!payload) throw new Error('qr')
  return encodeQr(payload)
}

const JOIN_QR_PAD = 6
const JOIN_QR_GAP = 3
const JOIN_QR_TOP = 2
const JOIN_QR_MIN = 22

export type ClassJoinQrBox = { x: number; y: number; size: number }

/** Ô mã QR lớp: dưới lời gấp, bên trái chữ, không đè dòng tên hay mã. */
export function classJoinQrBox(input: {
  cardX: number
  cardW: number
  hintBottom: number
  contentBottom: number
  glyphWidth: number
}): ClassJoinQrBox | null {
  const glyphWidth = input.glyphWidth
  if (glyphWidth <= 0) return null
  const roomH = input.contentBottom - input.hintBottom - JOIN_QR_TOP
  if (roomH < JOIN_QR_MIN) return null
  const innerLeft = input.cardX + JOIN_QR_PAD
  const glyphLeft = input.cardX + input.cardW / 2 - glyphWidth / 2
  const roomW = glyphLeft - JOIN_QR_GAP - innerLeft
  const size = Math.min(roomW, roomH)
  if (size < JOIN_QR_MIN) return null
  return { x: innerLeft, y: input.hintBottom + JOIN_QR_TOP, size }
}

export type ClassJoinTextOrigin = { x: number; y: number; width: number }

/** Khối tên và mã: giữa khoảng trống bên phải mã QR, cùng tầm cao với mã. */
export function classJoinTextOrigin(input: {
  cardX: number
  cardW: number
  join: ClassJoinQrBox
  blockHeight: number
  hintBottom: number
  contentBottom: number
}): ClassJoinTextOrigin | null {
  const columnLeft = input.join.x + input.join.size + JOIN_QR_GAP
  const columnRight = input.cardX + input.cardW - JOIN_QR_PAD
  const width = columnRight - columnLeft
  if (width < 36 || input.blockHeight <= 0) return null
  const low = input.hintBottom + JOIN_QR_TOP
  const high = input.contentBottom - input.blockHeight
  const centered = input.join.y + (input.join.size - input.blockHeight) / 2
  const y = Math.min(Math.max(centered, low), Math.max(low, high))
  return { x: columnLeft, y, width }
}

/** Chiều ngang chữ tối đa để vẫn còn một mã QR lớp quét được bên trái. */
export function classJoinGlyphLimit(cardW: number, roomH: number, minQr = 32): number | null {
  const qr = Math.min(minQr, roomH - JOIN_QR_TOP)
  if (qr < JOIN_QR_MIN) return null
  const glyphLeft = JOIN_QR_PAD + qr + JOIN_QR_GAP
  const half = cardW / 2 - glyphLeft
  if (half < 18) return null
  return half * 2
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

const TEXT_PX_PER_MM = 16

function hintLines(label: string, width: number, ctx: CanvasRenderingContext2D): string[] {
  const words = label.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > width && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

function textCanvas(widthMm: number, heightMm: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined' || widthMm <= 0 || heightMm <= 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(widthMm * TEXT_PX_PER_MM))
  canvas.height = Math.max(1, Math.round(heightMm * TEXT_PX_PER_MM))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  return { canvas, ctx }
}

function hintPng(label: string, widthMm: number, heightMm: number): string {
  if (!label.trim()) return ''
  const sheet = textCanvas(widthMm, heightMm)
  if (!sheet) return ''
  const { canvas, ctx } = sheet
  const pad = Math.round(TEXT_PX_PER_MM * 1.5)
  let size = Math.floor(canvas.height * 0.42)
  const font = (n: number) => `600 ${n}px "Segoe UI", Arial, sans-serif`
  ctx.font = font(size)
  let lines = hintLines(label, canvas.width - pad * 2, ctx)
  while (size > 18 && lines.length * size * 1.25 > canvas.height - pad) {
    size -= 2
    ctx.font = font(size)
    lines = hintLines(label, canvas.width - pad * 2, ctx)
  }
  const gap = size * 1.25
  let y = canvas.height / 2 - ((lines.length - 1) * gap) / 2
  for (const line of lines) {
    ctx.fillText(line, canvas.width / 2, y)
    y += gap
  }
  return canvas.toDataURL('image/png')
}

function labelFontSize(ctx: CanvasRenderingContext2D, label: string, widthPx: number, heightPx: number): number {
  const pad = Math.round(TEXT_PX_PER_MM)
  let size = Math.floor(heightPx * 0.72)
  const font = (n: number) => `600 ${n}px "Segoe UI", Arial, sans-serif`
  ctx.font = font(size)
  while (size > 16 && ctx.measureText(label).width > widthPx - pad * 2) {
    size -= 2
    ctx.font = font(size)
  }
  return size
}

function nameLabelPng(label: string, widthMm: number, heightMm: number): string {
  const sheet = textCanvas(widthMm, heightMm)
  if (!sheet || !label.trim()) return ''
  const { canvas, ctx } = sheet
  labelFontSize(ctx, label, canvas.width, canvas.height)
  ctx.fillText(label, canvas.width / 2, canvas.height / 2)
  return canvas.toDataURL('image/png')
}

function labelGlyphMm(label: string, widthMm: number, heightMm: number): number {
  const sheet = textCanvas(widthMm, heightMm)
  if (!sheet || !label.trim()) return 0
  const { canvas, ctx } = sheet
  labelFontSize(ctx, label, canvas.width, canvas.height)
  return ctx.measureText(label).width / TEXT_PX_PER_MM
}

async function saveBlob(blob: Blob, filename: string) {
  const loaded = await import('file-saver')
  const mod = loaded as {
    saveAs?: (data: Blob, name: string) => void
    default?: ((data: Blob, name: string) => void) | { saveAs?: (data: Blob, name: string) => void }
  }
  const saveAs = typeof mod.saveAs === 'function'
    ? mod.saveAs
    : typeof mod.default === 'function'
      ? mod.default
      : mod.default?.saveAs
  if (!saveAs) throw new Error('save')
  saveAs(blob, filename)
}

function exportBase(className: string, cards: AnswerCardExportItem[]) {
  if (cards.length === 1) {
    const no = String(cards[0].cardNo).padStart(2, '0')
    return answerCardDownloadBase(`${className}-${no}`)
  }
  return answerCardDownloadBase(className)
}

async function classJoinQrUrl(joinUrl: string): Promise<string> {
  const payload = joinUrl.trim()
  if (!payload.startsWith('https://')) return ''
  try {
    return await encodeQr(payload)
  } catch {
    return ''
  }
}

export async function answerCardsPdfBlob(
  className: string,
  cards: AnswerCardExportItem[],
  foldHint = '',
  placeLines: string[] = [],
  joinUrl = ''
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  pdf.setProperties({ title: className })
  const urls = await Promise.all(cards.map((card) => qrDataUrl(card.cardNo)))
  const joinQr = await classJoinQrUrl(joinUrl)
  for (let index = 0; index < cards.length; index += 1) {
    if (index > 0) pdf.addPage()
    const card = cards[index]
    if (!card) continue
    drawPdfPage(pdf, className, [card], [urls[index] ?? ''], foldHint, placeLines, joinQr)
  }
  if (cards.length === 0) drawPdfPage(pdf, className, [], [], foldHint, placeLines, joinQr)
  return new Blob([pdf.output('arraybuffer')], { type: 'application/pdf' })
}

function drawPdfPage(
  pdf: import('jspdf').jsPDF,
  className: string,
  cards: AnswerCardExportItem[],
  urls: string[],
  foldHint: string,
  placeLines: string[],
  joinQr: string
) {
  const title = nameLabelPng(className, 70, 6)
  const top = title ? 10 : 6
  if (title) pdf.addImage(title, 'PNG', 8, 2, 70, 6, undefined, 'NONE')
  if (cards.length === 0) return
  const marginX = 8
  const bottom = 6
  const gap = 4
  const cardW = 210 - marginX * 2
  const cardH = cards.length === 1 ? 297 - top - bottom : (297 - top - bottom - gap) / 2
  cards.forEach((card, slot) => {
    const y = top + slot * (cardH + gap)
    drawPdfCard(pdf, card, urls[slot] ?? '', marginX, y, cardW, cardH, foldHint, placeLines, joinQr)
  })
}

function drawPdfCard(
  pdf: import('jspdf').jsPDF,
  card: AnswerCardExportItem,
  qr: string,
  x: number,
  y: number,
  w: number,
  h: number,
  foldHint: string,
  placeLines: string[],
  joinQr: string
) {
  pdf.setDrawColor(15, 23, 42)
  pdf.setLineWidth(0.5)
  pdf.roundedRect(x, y, w, h, 2, 2, 'S')
  const lines = cardDetailLines(card)
  const place = placeLines.map((line) => line.trim()).filter(Boolean)
  const nameH = 6.2
  const lineH = 5
  const placeH = 5.6
  const hintH = foldHint ? 16 : 0
  const nameBlock = place.length * placeH + nameH + lines.length * lineH
  const infoH = 4 + hintH + 6 + nameBlock
  const letterMm = Math.max(12, Math.min(20, (h - infoH) * 0.16))
  const letterPt = letterMm / 0.3528
  const band = letterMm + 3
  const qrSize = Math.max(36, Math.min(w - letterMm * 2 - 6, h - infoH - band * 2))
  const qrX = x + (w - qrSize) / 2
  const qrY = y + band
  const foldY = qrY + qrSize + band
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(letterPt)
  const placeLetter = (letter: string, rgb: readonly [number, number, number], px: number, py: number) => {
    pdf.setTextColor(rgb[0], rgb[1], rgb[2])
    pdf.text(letter, px, py, { align: 'center', baseline: 'middle' })
  }
  const side = (w - qrSize) / 2
  placeLetter('A', LETTERS[0].rgb, x + w / 2, y + band / 2)
  placeLetter('D', LETTERS[3].rgb, x + side / 2, qrY + qrSize / 2)
  placeLetter('B', LETTERS[1].rgb, x + w - side / 2, qrY + qrSize / 2)
  placeLetter('C', LETTERS[2].rgb, x + w / 2, qrY + qrSize + band / 2)
  if (qr) pdf.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST')
  pdf.setDrawColor(100, 116, 139)
  pdf.setLineWidth(0.35)
  pdf.setLineDashPattern([1.6, 1.3], 0)
  pdf.line(x + 4, foldY, x + w - 4, foldY)
  pdf.setLineDashPattern([], 0)
  if (foldHint) {
    const boxY = foldY + 2.4
    pdf.setDrawColor(15, 23, 42)
    pdf.setLineWidth(0.4)
    pdf.roundedRect(x + 8, boxY, w - 16, hintH, 1.4, 1.4, 'S')
    const hintW = w - 20
    const hintBoxH = hintH - 2.4
    const hint = hintPng(foldHint, hintW, hintBoxH)
    if (hint) pdf.addImage(hint, 'PNG', x + 10, boxY + 1.2, hintW, hintBoxH, undefined, 'NONE')
  }
  let cursor = y + h - 4 - nameBlock
  const minCursor = foldY + 2.4 + hintH + 4
  if (cursor < minCursor) cursor = minCursor
  const textW = w - 12
  const labelH = nameH - 0.4
  const rows: Array<{ line: string; rowH: number; pngH: number }> = [
    ...place.map((line) => ({ line, rowH: placeH, pngH: placeH - 0.4 })),
    { line: `#${card.cardNo}  ${card.name}`, rowH: nameH, pngH: labelH },
    ...lines.map((line) => ({ line, rowH: lineH, pngH: lineH - 0.4 })),
  ]
  const hintBottom = foldHint ? foldY + 2.4 + hintH : foldY + 1.2
  const contentBottom = y + h - 4
  const widest = (widthMm: number) => {
    let max = 0
    for (const row of rows) max = Math.max(max, labelGlyphMm(row.line, widthMm, row.pngH))
    return max
  }
  let measureW = textW
  let glyph = widest(textW)
  let joinBox = joinQr ? classJoinQrBox({ cardX: x, cardW: w, hintBottom, contentBottom, glyphWidth: glyph }) : null
  if (joinQr && (!joinBox || joinBox.size < 32)) {
    const roomH = contentBottom - hintBottom
    const limit = classJoinGlyphLimit(w, roomH, 32)
    if (limit && limit < textW) {
      measureW = limit
      glyph = widest(limit)
      joinBox = classJoinQrBox({ cardX: x, cardW: w, hintBottom, contentBottom, glyphWidth: glyph || limit })
    }
  }
  const textOrigin = joinBox
    ? classJoinTextOrigin({
        cardX: x,
        cardW: w,
        join: joinBox,
        blockHeight: nameBlock,
        hintBottom,
        contentBottom,
      })
    : null
  const drawW = textOrigin?.width ?? measureW
  const drawX = textOrigin?.x ?? x + (w - drawW) / 2
  if (textOrigin) cursor = textOrigin.y
  for (const row of rows) {
    const png = nameLabelPng(row.line, drawW, row.pngH)
    if (png) pdf.addImage(png, 'PNG', drawX, cursor, drawW, row.pngH, undefined, 'NONE')
    cursor += row.rowH
  }
  if (joinQr && joinBox) {
    pdf.addImage(joinQr, 'PNG', joinBox.x, joinBox.y, joinBox.size, joinBox.size, undefined, 'FAST')
  }
}

export async function downloadAnswerCardsPdf(
  className: string,
  cards: AnswerCardExportItem[],
  foldHint = '',
  placeLines: string[] = [],
  joinUrl = ''
): Promise<void> {
  const blob = await answerCardsPdfBlob(className, cards, foldHint, placeLines, joinUrl)
  await saveBlob(blob, `${exportBase(className, cards)}.pdf`)
}

export async function answerCardsDocxBlob(
  className: string,
  cards: AnswerCardExportItem[],
  foldHint = '',
  placeLines: string[] = [],
  joinUrl = ''
): Promise<Blob> {
  const docx = await import('docx')
  const urls = await Promise.all(cards.map((card) => qrDataUrl(card.cardNo)))
  const joinQr = await classJoinQrUrl(joinUrl)
  const none = { style: docx.BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const edge = { style: docx.BorderStyle.SINGLE, size: 12, color: '0F172A' }
  const fold = { style: docx.BorderStyle.DASHED, size: 12, color: '64748B' }
  const box = { top: edge, bottom: edge, left: edge, right: edge }
  const open = { top: none, bottom: none, left: none, right: none }
  const tableClear = {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  }

  const letter = (text: string, color: string, size: number) =>
    new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      children: [new docx.TextRun({ text, bold: true, size, color, font: 'Arial' })],
    })

  const band = (text: string, color: string, size: number, width: number) =>
    new docx.TableCell({
      borders: open,
      verticalAlign: docx.VerticalAlignTable.CENTER,
      width: { size: width, type: docx.WidthType.DXA },
      children: [letter(text, color, size)],
    })

  const cardTable = (card: AnswerCardExportItem, url: string, large: boolean) => {
    const qrPx = large ? 430 : 290
    const letterSize = large ? 112 : 80
    const sideW = large ? 1800 : 1500
    const midW = 10800 - sideW * 2
    const center = new docx.TableCell({
      borders: open,
      verticalAlign: docx.VerticalAlignTable.CENTER,
      width: { size: midW, type: docx.WidthType.DXA },
      children: [
        new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          children: [
            new docx.ImageRun({
              type: 'png',
              data: dataUrlBytes(url),
              transformation: { width: qrPx, height: qrPx },
            }),
          ],
        }),
      ],
    })
    const hintBox = foldHint
      ? new docx.Table({
          width: { size: 10000, type: docx.WidthType.DXA },
          layout: docx.TableLayoutType.FIXED,
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  borders: box,
                  width: { size: 10000, type: docx.WidthType.DXA },
                  margins: { top: 80, bottom: 80, left: 120, right: 120 },
                  children: [
                    new docx.Paragraph({
                      alignment: docx.AlignmentType.CENTER,
                      children: [new docx.TextRun({ text: foldHint, bold: true, size: 22, font: 'Arial' })],
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      : null
    const infoParagraphs = [
      ...placeLines
        .map((line) => line.trim())
        .filter(Boolean)
        .map(
          (line, index) =>
            new docx.Paragraph({
              alignment: docx.AlignmentType.CENTER,
              spacing: { before: index === 0 ? (joinQr ? 40 : large ? 360 : 200) : 60 },
              children: [new docx.TextRun({ text: line, bold: true, size: 22, font: 'Arial' })],
            })
        ),
      new docx.Paragraph({
        alignment: docx.AlignmentType.CENTER,
        spacing: { before: placeLines.some((line) => line.trim()) ? 80 : joinQr ? 40 : large ? 360 : 200 },
        children: [
          new docx.TextRun({
            text: `#${card.cardNo} · ${card.name}`,
            bold: true,
            size: 22,
            font: 'Arial',
          }),
        ],
      }),
      ...cardDetailLines(card).map(
        (line) =>
          new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { before: 40 },
            children: [new docx.TextRun({ text: line, bold: true, size: 20, font: 'Arial' })],
          })
      ),
    ]
    const joinRow = joinQr
      ? new docx.Table({
          width: { size: 10400, type: docx.WidthType.DXA },
          layout: docx.TableLayoutType.FIXED,
          borders: tableClear,
          rows: [
            new docx.TableRow({
              children: [
                new docx.TableCell({
                  borders: open,
                  width: { size: 3200, type: docx.WidthType.DXA },
                  verticalAlign: docx.VerticalAlignTable.CENTER,
                  children: [
                    new docx.Paragraph({
                      alignment: docx.AlignmentType.CENTER,
                      children: [
                        new docx.ImageRun({
                          type: 'png',
                          data: dataUrlBytes(joinQr),
                          transformation: { width: 168, height: 168 },
                        }),
                      ],
                    }),
                  ],
                }),
                new docx.TableCell({
                  borders: open,
                  width: { size: 7200, type: docx.WidthType.DXA },
                  verticalAlign: docx.VerticalAlignTable.CENTER,
                  children: infoParagraphs,
                }),
              ],
            }),
          ],
        })
      : null
    const folded = new docx.TableCell({
      borders: { top: fold, bottom: none, left: none, right: none },
      columnSpan: 3,
      width: { size: 10800, type: docx.WidthType.DXA },
      margins: { top: 120, bottom: 80, left: 200, right: 200 },
      children: [...(hintBox ? [hintBox] : []), ...(joinRow ? [joinRow] : infoParagraphs)],
    })
    const inner = new docx.Table({
      width: { size: 10800, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
      borders: tableClear,
      rows: [
        new docx.TableRow({
          children: [band('', 'FFFFFF', letterSize, sideW), band('A', LETTERS[0].color, letterSize, midW), band('', 'FFFFFF', letterSize, sideW)],
        }),
        new docx.TableRow({
          children: [band('D', LETTERS[3].color, letterSize, sideW), center, band('B', LETTERS[1].color, letterSize, sideW)],
        }),
        new docx.TableRow({
          children: [band('', 'FFFFFF', letterSize, sideW), band('C', LETTERS[2].color, letterSize, midW), band('', 'FFFFFF', letterSize, sideW)],
        }),
        new docx.TableRow({ children: [folded] }),
      ],
    })
    return new docx.Table({
      width: { size: 10800, type: docx.WidthType.DXA },
      layout: docx.TableLayoutType.FIXED,
      borders: {
        top: edge,
        bottom: edge,
        left: edge,
        right: edge,
        insideHorizontal: none,
        insideVertical: none,
      },
      rows: [
        new docx.TableRow({
          cantSplit: true,
          children: [
            new docx.TableCell({
              borders: box,
              width: { size: 10800, type: docx.WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 60, right: 60 },
              children: [inner],
            }),
          ],
        }),
      ],
    })
  }

  const children: Array<InstanceType<typeof docx.Paragraph> | InstanceType<typeof docx.Table>> = []
  cards.forEach((card, index) => {
    const url = urls[index]
    if (!url) return
    if (index > 0) children.push(new docx.Paragraph({ pageBreakBefore: true, children: [] }))
    children.push(
      new docx.Paragraph({
        spacing: { after: 80 },
        children: [new docx.TextRun({ text: className, bold: true, size: 28, font: 'Arial' })],
      })
    )
    children.push(cardTable(card, url, true))
  })

  const doc = new docx.Document({
    title: className,
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 500, bottom: 400, left: 500, right: 500 },
          },
        },
        children,
      },
    ],
  })
  return docx.Packer.toBlob(doc)
}

export async function downloadAnswerCardsDocx(
  className: string,
  cards: AnswerCardExportItem[],
  foldHint = '',
  placeLines: string[] = [],
  joinUrl = ''
): Promise<void> {
  const blob = await answerCardsDocxBlob(className, cards, foldHint, placeLines, joinUrl)
  await saveBlob(blob, `${exportBase(className, cards)}.docx`)
}
