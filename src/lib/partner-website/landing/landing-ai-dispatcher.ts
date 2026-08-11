import {
  generateLandingFaqText,
  generateLandingHeroText,
  generateLandingHighlightsText,
  generateLandingMaterialText,
  generateLandingTrustCtaText,
} from '@/lib/partner-website/landing/landing-ai-content-generator'
import { generateLandingMaterialImage } from '@/lib/partner-website/landing/landing-ai-material-image'
import type {
  LandingAiContext,
  LandingAiSectionRow,
  LandingMaterialData,
  LandingSectionData,
} from '@/lib/partner-website/landing/landing-ai-types'

/**
 * L3.4 — dispatcher dùng chung cho tạo lần đầu + tạo lại từng section (mirror
 * `generate_or_regenerate_section` của 188, tổng quát hoá đa ngôn ngữ/đa tenant).
 * `target`: all | text | image. Trả `data` mới — caller (API route) lưu DB.
 */
export type LandingSectionGenerateTarget = 'all' | 'text' | 'image'

export async function generateOrRegenerateLandingSection(
  context: LandingAiContext,
  section: LandingAiSectionRow,
  opts: { target?: LandingSectionGenerateTarget; customPrompt?: string; partnerId: string } 
): Promise<LandingSectionData> {
  const target = opts.target ?? 'all'
  const current: Record<string, unknown> = { ...(section.data as Record<string, unknown>) }

  if (section.sectionType === 'hero') {
    if (target === 'all' || target === 'text') {
      const text = await generateLandingHeroText(context, opts.customPrompt)
      if (text) {
        Object.assign(current, text)
      } else if (target === 'text') {
        throw new Error('DeepSeek không trả nội dung hero hợp lệ.')
      } else {
        current.headline = current.headline || context.title || 'Sản phẩm nổi bật'
      }
    }
    if (target === 'all' || target === 'image') {
      const mainImage = context.products[0]?.imageUrl?.trim()
      if (mainImage) {
        current.imageUrl = mainImage
      } else if (target === 'image') {
        throw new Error('Không có ảnh sản phẩm để làm hero.')
      }
    }
    return current as LandingSectionData
  }

  if (section.sectionType === 'highlights') {
    const text = await generateLandingHighlightsText(context, opts.customPrompt)
    if (!text) throw new Error('DeepSeek không trả điểm mạnh hợp lệ.')
    return text
  }

  if (section.sectionType === 'material') {
    const material = context.materialFilter || context.dominantMaterial || 'chất liệu cao cấp'
    if (target === 'all' || target === 'text') {
      const text = await generateLandingMaterialText(context, material, opts.customPrompt)
      if (!text) throw new Error('DeepSeek không trả nội dung chất liệu hợp lệ.')
      current.body = text.body
      current.callouts = text.callouts
      current.material = material
    }
    if (target === 'all' || target === 'image') {
      const sourceImage = context.products[0]?.imageUrl?.trim()
      if (sourceImage) {
        const img = await generateLandingMaterialImage({
          partnerId: opts.partnerId,
          landingId: context.landingId,
          productImageUrl: sourceImage,
          material,
          callouts: (current.callouts as string[] | undefined) ?? [],
        })
        if (img) {
          current.imageUrl = img.imageUrl
          current.imageSource = 'ai'
        } else if (target === 'image') {
          throw new Error('Không tạo được ảnh chất liệu (kiểm tra GOOGLE_API_KEY / ảnh sản phẩm nguồn).')
        }
      } else if (target === 'image') {
        throw new Error('Không có ảnh sản phẩm nguồn để tạo ảnh chất liệu.')
      }
    }
    return current as LandingMaterialData as LandingSectionData
  }

  if (section.sectionType === 'trust_cta') {
    const text = await generateLandingTrustCtaText(context, opts.customPrompt)
    if (!text) throw new Error('DeepSeek không trả nội dung CTA hợp lệ.')
    return text
  }

  if (section.sectionType === 'faq') {
    const text = await generateLandingFaqText(context, opts.customPrompt)
    if (!text) throw new Error('DeepSeek không trả FAQ hợp lệ.')
    return text
  }

  if (section.sectionType === 'products_grid') {
    // Không phải nội dung AI — sản phẩm luôn resolve live khi render (L3.5).
    return {}
  }

  throw new Error(`Loại section không hỗ trợ: ${section.sectionType}`)
}
