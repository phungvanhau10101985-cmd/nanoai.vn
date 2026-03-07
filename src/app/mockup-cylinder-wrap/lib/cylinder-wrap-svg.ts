/**
 * Tạo SVG nhãn phẳng cho chai/lon (cylinder wrap).
 * Chiều rộng = chu vi (π × đường kính), chiều cao = chiều cao chai.
 */

export interface CylinderDimensions {
  diameterMm: number  // Đường kính (mm)
  heightMm: number   // Chiều cao (mm)
}

export interface LabelBounds {
  widthMm: number
  heightMm: number
}

const PI = Math.PI

export function getLabelBounds(d: CylinderDimensions): LabelBounds {
  const circumferenceMm = PI * d.diameterMm
  return { widthMm: circumferenceMm, heightMm: d.heightMm }
}

/**
 * Tạo SVG nhãn phẳng - khung + thông số kích thước.
 */
export function generateLabelSvg(d: CylinderDimensions, imageUrl?: string): string {
  const { diameterMm: D, heightMm: H } = d
  const W = PI * D
  const pad = 2
  const stroke = 0.4
  const fs = Math.max(2, Math.min(D, H) * 0.08)

  const svgW = W + pad * 2
  const svgH = H + pad * 2

  const rectContent = imageUrl
    ? `<image href="${imageUrl}" x="${pad}" y="${pad}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="0.5"/>`

  const dimText = `Ø ${D} × H ${H} mm · Chu vi ${Math.round(W)} mm`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" preserveAspectRatio="xMidYMid meet" style="max-width:100%;height:auto">
  <rect width="100%" height="100%" fill="#fff"/>
  ${rectContent}
  <rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="none" stroke="#dc2626" stroke-width="${stroke}"/>
  <text x="${pad + W / 2}" y="${pad + H / 2}" text-anchor="middle" dominant-baseline="middle" font-size="${fs}" fill="#64748b" font-family="sans-serif">${dimText}</text>
</svg>`
}
