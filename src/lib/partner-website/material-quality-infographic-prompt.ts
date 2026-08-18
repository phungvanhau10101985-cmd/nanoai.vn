import type { WebLocale } from '@/lib/i18n/config'
import { DEFAULT_WEB_LOCALE, normalizeWebLocale } from '@/lib/i18n/config'

/**
 * Prompt ảnh chất liệu dùng chung: đăng sản phẩm AI, gửi khách (inbox), Ladipage.
 * Chỉ gửi ảnh sản phẩm + prompt — không đính kèm ảnh mẫu infographic (tránh AI lẫn SP).
 */
export const MATERIAL_QUALITY_INFOGRAPHIC_ASPECT_RATIO = '1:1' as const

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

function localeOf(raw: string | null | undefined): WebLocale {
  return normalizeWebLocale(raw) ?? DEFAULT_WEB_LOCALE
}

function clean(s: string | null | undefined, max = 220): string {
  return (s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function materialKey(material: string, productName = ''): string {
  return `${material} ${productName}`.toLowerCase()
}

const COLOR_LIST_RE =
  /\s*(?:màu|color|colours?)\s+.+$/i
const COLOR_ENUM_TAIL_RE =
  /,?\s*(?:trắng|đen|nâu|be|kem|hồng|đỏ|vàng|xám|navy|xanh rêu|xanh|white|black|brown|beige|pink|red|yellow|grey|gray|green|blue)(?:\s*,\s*(?:trắng|đen|nâu|be|kem|hồng|đỏ|vàng|xám|navy|xanh rêu|xanh|white|black|brown|beige|pink|red|yellow|grey|gray|green|blue))+\s*\.{0,3}$/i

/** Tiêu đề trên ảnh — ngắn như mẫu lookbook, không dump tên SEO / list màu. */
export function shortMaterialInfographicTitle(
  productName: string,
  material: string,
  locale: WebLocale = 'vi'
): string {
  let s = clean(productName, 160)
  s = s.replace(COLOR_LIST_RE, '').replace(COLOR_ENUM_TAIL_RE, '').replace(/\.{2,}$/, '').trim()
  const key = s.toLowerCase()
  if (locale === 'vi') {
    if (/váy\s+(dạ|dự)\s+tiệc|dam\s+tiec|party dress/.test(key)) return 'VÁY DẠ TIỆC CAO CẤP'
    if (/váy\s+chữ a|váy xòe|váy xoe/.test(key)) return 'VÁY CHỮ A CAO CẤP'
    if (/đầm|dam |váy/.test(key) && s.split(/\s+/).length > 4) return 'VÁY CAO CẤP'
    if (/áo khoác|ao khoac|bomber|jacket/.test(key)) {
      const words = s.split(/\s+/).filter(Boolean).slice(0, 4)
      return words.join(' ').toUpperCase()
    }
  }
  const words = s.split(/\s+/).filter(Boolean)
  if (words.length > 4) s = words.slice(0, 4).join(' ')
  if (s.length > 36) s = s.slice(0, 36).replace(/\s+\S*$/, '').trim()
  if (s) return s.toUpperCase()
  const m = clean(material, 32)
  if (locale === 'vi') return m ? `${m.toUpperCase()} PREMIUM` : 'SẢN PHẨM PREMIUM'
  return m ? `${m.toUpperCase()} PREMIUM` : 'PREMIUM PRODUCT'
}

export function qualityClaimLine(locale: WebLocale): string {
  if (locale === 'vi') return 'CHẤT LƯỢNG KHẲNG ĐỊNH ĐẲNG CẤP'
  if (locale === 'zh') return '品质彰显档次'
  if (locale === 'ja') return '品質が格を証明する'
  if (locale === 'ko') return '품질이 품격을 증명한다'
  return 'QUALITY THAT ASSERTS CLASS'
}

/** 4 nhãn ô cận — cùng thứ tự layout: trên-trái, trên-phải, dưới-trái, dưới-phải. */
export function fallbackMaterialQualityCallouts(
  material: string,
  locale: WebLocale = 'vi',
  productName = ''
): string[] {
  const m = materialKey(material, productName)
  if (locale === 'vi') {
    if (/giày|giay|shoe|sneaker|dép|sandal/.test(m)) {
      return ['Đế chống trượt', 'Đường khâu mũi giày', 'Lót giày êm ái', 'Chất liệu bề mặt']
    }
    if (/voan|chiffon|voile/.test(m)) {
      return ['Vân vải voan mỏng nhẹ', 'Đường may tinh xảo', 'Ren / chi tiết tinh tế', 'Phom dáng hoàn hảo']
    }
    if (/lụa|lua|silk|satin/.test(m)) {
      return ['Vân lụa óng ánh', 'Đường may tinh xảo', 'Chi tiết thanh lịch', 'Phom dáng hoàn hảo']
    }
    if (/(?:^|[\s,;/])da(?:\s|$)|leather|\bpu\b/.test(m) && !/đầm|dam |áo thun|ao thun|cotton/.test(m)) {
      return ['Vân da rõ nét', 'Đường may chắc tay', 'Khóa / viền tinh tế', 'Phom dáng sang trọng']
    }
    if (/cotton|bông|bong|áo thun|ao thun/.test(m)) {
      return ['Vân chất liệu rõ nét', 'Đường may tinh xảo', 'Chi tiết tinh tế', 'Phom dáng hoàn hảo']
    }
    if (/len|wool|knit|dệt kim|det kim/.test(m)) {
      return ['Sợi mềm không xù', 'Đường may giữ form', 'Chi tiết gọn', 'Phom dáng ấm áp']
    }
    return ['Vân chất liệu rõ nét', 'Đường may tinh xảo', 'Chi tiết tinh tế', 'Phom dáng hoàn hảo']
  }
  if (/shoe|sneaker|sandal/.test(m)) {
    return ['Non-slip outsole', 'Toe stitching', 'Cushioned insole', 'Upper material']
  }
  if (/chiffon|voile/.test(m)) {
    return ['Sheer airy chiffon', 'Exquisite stitching', 'Delicate trim detail', 'Perfect silhouette']
  }
  if (/silk|satin/.test(m)) {
    return ['Natural silk sheen', 'Fine stitching', 'Elegant trim', 'Flattering drape']
  }
  if (/leather|\bpu\b/.test(m)) {
    return ['Clear leather grain', 'Strong stitching', 'Refined hardware', 'Polished silhouette']
  }
  if (/cotton/.test(m)) {
    return ['Clear fabric grain', 'Exquisite stitching', 'Refined details', 'Perfect fit']
  }
  return ['True material texture', 'Precise stitching', 'Refined details', 'Perfect form']
}

function fallbackCalloutSubtitles(
  material: string,
  locale: WebLocale,
  productName: string
): [string, string, string, string] {
  const m = materialKey(material, productName)
  if (locale === 'vi') {
    if (/giày|giay|shoe|sneaker/.test(m)) {
      return [
        'Bám tốt, đi chắc chân',
        'Khâu đều, bền mũi giày',
        'Êm, không đau gót',
        'Rõ vân, đúng chất liệu',
      ]
    }
    if (/voan|chiffon|voile/.test(m)) {
      return [
        'Mỏng, nhẹ, thoáng khí, bay bổng tự nhiên',
        'Bền đẹp, tinh tế từng đường',
        'Tỉ mỉ, sang trọng từng chi tiết',
        'Xòe mềm, tôn dáng nữ tính',
      ]
    }
    if (/cotton|bông|áo thun|ao thun/.test(m)) {
      return [
        'Rõ vân, cảm nhận ngay từ ảnh',
        'Bền đẹp, tỉ mỉ từng đường',
        'Gọn gàng, chỉn chu từng mép',
        'Ôm dáng, mặc lên vừa vặn',
      ]
    }
    return [
      'Rõ vân, cảm nhận ngay từ ảnh',
      'Bền đẹp, tỉ mỉ từng đường',
      'Tinh tế, sang trọng chi tiết',
      'Tôn dáng, mặc lên vừa vặn',
    ]
  }
  return [
    'True grain you can see',
    'Clean, durable seams',
    'Refined finishing details',
    'Flattering, well-cut shape',
  ]
}

function defaultSubheadline(material: string, locale: WebLocale, productName: string): string {
  const m = materialKey(material, productName)
  if (locale === 'vi') {
    if (/váy|vay |đầm|dam |dress/.test(m)) return 'Ôm Dáng Sang Trọng • Lót Mềm Êm • Tôn Dáng Nữ Tính'
    if (/voan|chiffon|voile/.test(m)) return 'Vải Mềm Mịn • Bay Bổng Tự Nhiên • Tôn Dáng Nữ Tính'
    if (/lụa|lua|silk|satin/.test(m)) return 'Óng Ánh Tự Nhiên • Mát Da Thanh Lịch • Tôn Dáng Mềm Mại'
    if (/(?:^|[\s,;/])da(?:\s|$)|leather|\bpu\b/.test(m) && !/đầm|dam |áo thun|ao thun|cotton/.test(m)) {
      return 'Vân Da Rõ Nét • Bền Chắc Tay • Sang Trọng Lâu Dài'
    }
    if (/cotton|bông|bong|áo thun|ao thun/.test(m)) return 'Vải Mềm Mịn • Thoáng Khí Tự Nhiên • Dễ Chăm Sóc'
    if (/len|wool|knit/.test(m)) return 'Sợi Mềm Ấm Áp • Giữ Form • Mặc Cả Ngày'
    return 'Chất Liệu Cao Cấp • Cảm Nhận Rõ Từng Chi Tiết • Đáng Chọn Mỗi Ngày'
  }
  if (/chiffon|voile/.test(m)) return 'Soft Smooth Fabric • Naturally Airy • Figure-Flattering'
  if (/silk|satin/.test(m)) return 'Natural Sheen • Cool on Skin • Elegant Drape'
  if (/leather|\bpu\b/.test(m)) return 'Clear Grain • Durable Hand-Feel • Lasting Luxury'
  if (/cotton/.test(m)) return 'Soft & Smooth • Naturally Breathable • Easy Care'
  return 'Premium Material • Feel Every Detail • Worth Choosing'
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
  locale: WebLocale,
  productName = ''
): [string, string, string, string] {
  const fallback = fallbackMaterialQualityCallouts(material, locale, productName)
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
  if (name) lines.push(`Product name (for identity only — do NOT print this full SEO title): ${name}`)
  if (material) lines.push(`Declared material: ${material}`)
  if (desc) lines.push(`Description excerpt: ${desc}`)
  if (consult) lines.push(`Consult note excerpt: ${consult}`)
  if (!lines.length) return ''
  return `\nShop catalog context (macros must match this item — do not invent a different material type):\n${lines.join('\n')}`
}

function visualFeatureHints(material: string, productName: string): [string, string, string, string] {
  const m = materialKey(material, productName)
  if (/váy|vay |đầm|dam |dress/.test(m)) {
    return ['fabric surface grain of THIS garment', 'inner lining or V-neck construction', 'seam / stitching close-up', 'silhouette / hem / sleeve']
  }
  if (/giày|giay|shoe|sneaker/.test(m)) {
    return ['non-slip outsole / tread', 'toe box stitching', 'insole cushion', 'upper leather or fabric grain']
  }
  if (/túi|tui |bag|tote/.test(m)) {
    return ['leather or fabric grain', 'hardware / zipper', 'handle or strap join', 'silhouette / structure']
  }
  if (/voan|chiffon|voile/.test(m)) {
    return ['sheer chiffon drape and weave', 'lace or neckline trim', 'shoulder / seam stitching', 'hem / flared silhouette']
  }
  return ['fabric breathability texture', 'collar or main seam stitching', 'logo / trim / distinctive detail', 'cuff, hem, or drape']
}

function heroProductPhrase(productName: string, material: string): string {
  const name = clean(productName, 90)
  const mat = clean(material, 50)
  if (name && mat) return `${name} (${mat}), matching the attached product photo exactly`
  if (name) return `${name}, matching the attached product photo exactly`
  if (mat) return `the ${mat} product shown in the attached photo`
  return 'the exact product shown in the attached photo'
}

/**
 * Prompt image-edit: chỉ 1 ảnh SP gốc + prompt — infographic chất liệu cùng SP.
 * Template layout do merchant chốt (header / hero + kính lúp / 4 ô góc / footer cam kết), 1:1.
 */
export function buildMaterialQualityInfographicPrompt(input: MaterialQualityInfographicInput): string {
  const locale = localeOf(input.locale)
  const material = clean(input.material, 160) || 'as visible in the product photo'
  const productName = clean(input.productName, 160)
  const shortTitle = shortMaterialInfographicTitle(productName, material, locale)
  const headline = `${shortTitle} — ${qualityClaimLine(locale)}`
  const subheadline = defaultSubheadline(material, locale, productName)
  const footer = defaultTrustFooter(locale)
  const [c1, c2, c3, c4] = padMaterialQualityCallouts(input.callouts, material, locale, productName)
  const [s1, s2, s3, s4] = fallbackCalloutSubtitles(material, locale, productName)
  const [f1, f2, f3, f4] = visualFeatureHints(material, productName)
  const hero = heroProductPhrase(productName, material)
  const notes = clean(input.extraNotes, 280)
  const noteBlock = notes ? `\nADMIN NOTE (high priority, do not override product identity): ${notes}` : ''

  return `A professional high-converting e-commerce product feature infographic layout, 1:1 aspect ratio, clean cream studio aesthetic (plain warm wall). Commercial catalog graphic — not a luxury hotel interior.

The user attached EXACTLY ONE real product photo. Depict THAT exact garment only (same cut, color, fabric, neckline, sleeves, length). Keep sequins/sparkle only if they are already in the source photo.

[1. HEADER SECTION]:
- Solid cream rectangular banner occupying the TOP ~12% of the canvas. The model's head sits BELOW this banner — never behind the letters.
- Headline is 100% opaque black extra-bold, fully inside the banner, no letter cropped by the frame. Print exactly:
  "${headline}"
- Sub-headline underneath, smaller Title Case, fully visible on one line:
  "${subheadline}"
- FORBIDDEN: giant watermark letters; transparent overlay text; copying the source photo's doorway/gold furniture into the header.

[2. MAIN CENTER HERO IMAGE]:
- Center of the image features a high-resolution studio shot of a model wearing ${hero}.
- A realistic magnifying glass is placed over a specific detail on the product (such as the chest logo or fabric texture), pointing to a floating pop-up card that shows an extreme macro close-up view of the material structure.

[3. SURROUNDING DETAIL CARDS (4 CORNERS)]:
Each card MUST contain a real close-up photo filling most of the tile (never a blank/white empty card) plus a small icon and 2-line caption.
- Top Left Card: Close-up image of ${f1} with a small minimalist icon and text label "${c1.toUpperCase()} - ${s1}".
- Bottom Left Card: Close-up image of ${f2} with a text label "${c2.toUpperCase()} - ${s2}".
- Top Right Card: Close-up image of ${f3} with a needle icon and text label "${c3.toUpperCase()} - ${s3}".
- Bottom Right Card: Close-up image of ${f4} with an icon and text label "${c4.toUpperCase()} - ${s4}".
Spell Vietnamese exactly. The word for fabric grain is VÂN (circumflex A). Never write VẬN.

[4. FOOTER TRUST BANNER]:
- A prominent bottom banner with a delivery/trust icon and bold text: "${footer}".

Style: Ultra-sharp details, high contrast, commercial advertising graphic style, sharp Vietnamese typography rendering.

STRICT:
- 4 photo tiles, 0 empty tiles.
- Headline stays fully inside the top cream banner, not behind the model.
- Product identity = attached photo only.
- No watermark, prices, fake logos, medical claims.
${catalogContextBlock(input)}${noteBlock}

Output only the generated image.`
}
