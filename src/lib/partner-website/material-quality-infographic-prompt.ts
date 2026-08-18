import type { WebLocale } from '@/lib/i18n/config'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'

/**
 * Prompt ảnh chất liệu dùng chung: đăng sản phẩm AI, gửi khách (inbox), Ladipage.
 * Bố cục khóa theo infographic thương mại: headline + 3 lợi ích, SP giữa + kính lúp vải,
 * 4 ô cận (vân / đường may / chi tiết / phom) + footer cam kết.
 */
export const MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO = '4:3' as const

export type MaterialQualityCalloutRole = 'texture' | 'stitch' | 'trim' | 'form'

export type MaterialQualityInfographicInput = {
  productName?: string | null
  material?: string | null
  description?: string | null
  consultNote?: string | null
  /** 4 nhãn ô cận (texture / stitch / trim / form). Thiếu thì pad từ fallback. */
  callouts?: string[] | null
  locale?: string | null
  extraNotes?: string | null
}

const LANGUAGE_NAME: Record<WebLocale, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

function localeOf(raw: string | null | undefined): WebLocale {
  return normalizeWebLocale(raw) ?? DEFAULT_WEB_LOCALE
}

function clean(s: string | null | undefined, max = 220): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function materialKey(material: string): string {
  return material.toLowerCase()
}

/** 4 nhãn ô cận — cùng thứ tự layout: trên-trái, trên-phải, dưới-trái, dưới-phải. */
export function fallbackMaterialQualityCallouts(material: string, locale: WebLocale = 'vi'): string[] {
  const m = materialKey(material)
  if (locale === 'vi') {
    if (/voan|chiffon|voile/.test(m)) {
      return ['Vân vải voan mỏng nhẹ', 'Đường may tinh xảo', 'Ren / chi tiết tinh tế', 'Phom dáng hoàn hảo']
    }
    if (/lụa|lua|silk|satin/.test(m)) {
      return ['Vân lụa óng ánh', 'Đường may tinh xảo', 'Chi tiết thanh lịch', 'Phom dáng hoàn hảo']
    }
    if (/da|leather|pu/.test(m)) {
      return ['Vân da rõ nét', 'Đường may chắc tay', 'Khóa / viền tinh tế', 'Phom dáng sang trọng']
    }
    if (/cotton|bông|bong/.test(m)) {
      return ['Vân vải mềm mịn', 'Đường may tinh xảo', 'Chi tiết gọn gàng', 'Phom dáng thoải mái']
    }
    if (/len|wool|knit|dệt kim|det kim/.test(m)) {
      return ['Sợi mềm không xù', 'Đường may giữ form', 'Chi tiết gọn', 'Phom dáng ấm áp']
    }
    return ['Vân chất liệu rõ nét', 'Đường may tinh xảo', 'Chi tiết tinh tế', 'Phom dáng hoàn hảo']
  }
  if (/chiffon|voile/.test(m)) {
    return ['Sheer airy chiffon', 'Exquisite stitching', 'Delicate trim detail', 'Perfect silhouette']
  }
  if (/silk|satin/.test(m)) {
    return ['Natural silk sheen', 'Fine stitching', 'Elegant trim', 'Flattering drape']
  }
  if (/leather|pu/.test(m)) {
    return ['Clear leather grain', 'Strong stitching', 'Refined hardware', 'Polished silhouette']
  }
  if (/cotton/.test(m)) {
    return ['Soft cotton texture', 'Clean stitching', 'Neat details', 'Comfortable shape']
  }
  return ['True material texture', 'Precise stitching', 'Refined details', 'Perfect form']
}

function defaultHeadline(productName: string, material: string, locale: WebLocale): string {
  const name = (productName || material || '').trim()
  const title = name ? name.toUpperCase() : locale === 'vi' ? 'SẢN PHẨM PREMIUM' : 'PREMIUM PRODUCT'
  if (locale === 'vi') return `${title} — CHẤT LƯỢNG KHẲNG ĐỊNH ĐẲNG CẤP`
  if (locale === 'zh') return `${title} — 品质彰显档次`
  if (locale === 'ja') return `${title} — 品質が格を証明する`
  if (locale === 'ko') return `${title} — 품질이 품격을 증명한다`
  return `${title} — QUALITY THAT ASSERTS CLASS`
}

function defaultSubheadline(material: string, locale: WebLocale): string {
  const m = materialKey(material)
  if (locale === 'vi') {
    if (/voan|chiffon|voile/.test(m)) return 'Vải Mềm Mịn • Bay Bổng Tự Nhiên • Tôn Dáng Nữ Tính'
    if (/lụa|lua|silk|satin/.test(m)) return 'Óng Ánh Tự Nhiên • Mát Da Thanh Lịch • Tôn Dáng Mềm Mại'
    if (/da|leather|pu/.test(m)) return 'Vân Da Rõ Nét • Bền Chắc Tay • Sang Trọng Lâu Dài'
    if (/cotton|bông|bong/.test(m)) return 'Vải Mềm Mịn • Thoáng Khí Tự Nhiên • Dễ Chăm Sóc'
    if (/len|wool|knit/.test(m)) return 'Sợi Mềm Ấm Áp • Giữ Form • Mặc Cả Ngày'
    return 'Chất Liệu Cao Cấp • Cảm Nhận Rõ Từng Chi Tiết • Đáng Chọn Mỗi Ngày'
  }
  if (/chiffon|voile/.test(m)) return 'Soft Smooth Fabric • Naturally Airy • Figure-Flattering'
  if (/silk|satin/.test(m)) return 'Natural Sheen • Cool on Skin • Elegant Drape'
  if (/leather|pu/.test(m)) return 'Clear Grain • Durable Hand-Feel • Lasting Luxury'
  if (/cotton/.test(m)) return 'Soft & Smooth • Naturally Breathable • Easy Care'
  return 'Premium Material • True Texture • Worth Choosing'
}

function defaultTrustFooter(locale: WebLocale): string {
  if (locale === 'vi') return 'CAM KẾT: BAO ĐỔI TRẢ 7 NGÀY — CHO KIỂM TRA HÀNG'
  if (locale === 'zh') return '承诺：7天退换 — 支持先验货'
  if (locale === 'ja') return '約束：7日間返品・交換可 — 検品OK'
  if (locale === 'ko') return '약속: 7일 교환·반품 — 상품 확인 후 결정'
  return 'PROMISE: 7-DAY RETURNS — INSPECT ON DELIVERY'
}

export function padMaterialQualityCallouts(
  callouts: string[] | null | undefined,
  material: string,
  locale: WebLocale
): [string, string, string, string] {
  const fallback = fallbackMaterialQualityCallouts(material, locale)
  const out: string[] = []
  for (const raw of callouts ?? []) {
    const t = clean(raw, 48)
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 4) break
  }
  for (const f of fallback) {
    if (out.length >= 4) break
    if (!out.includes(f)) out.push(f)
  }
  while (out.length < 4) out.push(fallback[out.length] || fallback[0])
  return [out[0], out[1], out[2], out[3]]
}

function catalogContextBlock(input: MaterialQualityInfographicInput): string {
  const lines: string[] = []
  const name = clean(input.productName, 160)
  const material = clean(input.material, 160)
  const desc = clean(input.description, 400)
  const consult = clean(input.consultNote, 280)
  if (name) lines.push(`Product name: ${name}`)
  if (material) lines.push(`Declared material: ${material}`)
  if (desc) lines.push(`Description excerpt: ${desc}`)
  if (consult) lines.push(`Consult note excerpt: ${consult}`)
  if (!lines.length) return ''
  return `\nShop catalog context (on-image text must stay consistent with this — do not invent a different material type):\n${lines.join('\n')}`
}

/**
 * Prompt image-edit: 1 ảnh SP gốc → 1 infographic chất liệu (cùng SP, không đổi mẫu).
 */
export function buildMaterialQualityInfographicPrompt(input: MaterialQualityInfographicInput): string {
  const locale = localeOf(input.locale)
  const language = LANGUAGE_NAME[locale]
  const material = clean(input.material, 160) || 'as visible in the source photo'
  const productName = clean(input.productName, 160)
  const headline = defaultHeadline(productName, material, locale)
  const subheadline = defaultSubheadline(material, locale)
  const footer = defaultTrustFooter(locale)
  const [cTexture, cStitch, cTrim, cForm] = padMaterialQualityCallouts(input.callouts, material, locale)
  const notes = clean(input.extraNotes, 280)
  const noteBlock = notes ? `\nADMIN NOTE (high priority, do not override product identity): ${notes}` : ''

  return `You are an e-commerce creative assistant. The user attached EXACTLY ONE primary product photo (Image A) of ONE real product. Generate ONE photorealistic commercial MATERIAL QUALITY INFOGRAPHIC of that SAME product only.

Task: edit/compose Image A into a premium fashion listing sheet that looks like a professional studio infographic — not a random collage, not a comic, not 3D CGI.

LAYOUT (mandatory — match this structure):

1) TOP BANNER (full width, cream/off-white)
   - Headline, ${language}, uppercase, bold, 1 line (wrap only if needed):
     "${headline}"
   - Subheadline directly under it, title case, 3 short benefits separated by " • ":
     "${subheadline}"

2) MAIN BODY — 3-column cross (left stack | center hero | right stack)
   - CENTER (~42–50% of width): the full product as worn or displayed, derived from Image A (same silhouette, color, print, trims). If Image A shows a person, keep a similar crop (neck-down is OK). If Image A is a packshot, keep a packshot — do NOT invent a different garment or a different model wardrobe.
   - Overlay a circular MAGNIFYING-GLASS inset on the product, pointing at the real fabric/material texture (weave, chiffon mesh, leather grain, knit, etc. — only what exists on THIS item).
   - TOP-LEFT tile: macro of fabric/material texture (draped folds; light through layers if sheer). Caption + tiny circular icon.
   - TOP-RIGHT tile: macro of construction/stitching (neckline, seam, shoulder, edge). Caption + tiny circular icon.
   - BOTTOM-LEFT tile: macro of a distinctive trim/detail that actually exists on Image A (lace, zipper, hardware, buttons, piping, lining — pick what is visible). Caption + tiny circular icon.
   - BOTTOM-RIGHT tile: macro of silhouette / hem / drape / form. Caption + tiny circular icon.
   - Thin clean white gutters between tiles. Soft cream-beige studio interior (subtle wall molding OK). Bright, even commercial lighting; no harsh shadows.

3) FOOTER BANNER (full width, slightly deeper cream/taupe bar) with a small parcel/box icon:
   "${footer}"

ON-IMAGE LABELS — print verbatim in ${language}, uppercase, 2–8 words, high-contrast clean sans-serif, readable on mobile. Place each label on/near its tile, do not cover the fabric detail:
- Top-left (texture): "${cTexture}"
- Top-right (stitching): "${cStitch}"
- Bottom-left (trim/detail): "${cTrim}"
- Bottom-right (form): "${cForm}"
Tiny simple line icons only (texture / needle-thread / trim / silhouette) — no emoji, no fake brand logos.

RULES (strict):
- Image A is the only source of truth for product type, color, print, fabric, and hardware. Do NOT depict a different product or generic stock fabric.
- Corner tiles must read as camera zooms into regions of THIS item.
- Photorealistic, elegant, feminine/refined catalog quality. Landscape ${MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO}.
- No watermark, no prices, no medical/weight-loss claims, no other brand logos.
${catalogContextBlock(input)}${noteBlock}

Output only the generated image.`
}
