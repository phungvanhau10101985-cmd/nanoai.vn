import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteProContent } from '@/lib/partner-website/pro/partner-website-pro-content'
import type { PartnerWebsiteSiteType } from '@/lib/partner-website/partner-website-studio-flow'

export type PartnerWebsiteProImageKey =
  | 'hero'
  | 'material'
  | 'product_1'
  | 'product_2'
  | 'product_3'
  | 'product_4'
  | 'lifestyle'

export type PartnerWebsiteProSectionImages = Partial<Record<PartnerWebsiteProImageKey, string>>

type ImageSpec = {
  key: PartnerWebsiteProImageKey
  kind: 'banner' | 'product_photo'
  aspectRatio: string
  screenLabel: string
  buildPrompt: (input: {
    locale: WebLocale
    title: string
    briefText: string
    content: PartnerWebsiteProContent
  }) => string
}

function imageSpecs(siteType: PartnerWebsiteSiteType): ImageSpec[] {
  const productSpecs: ImageSpec[] =
    siteType === 'web_shop'
      ? [1, 2, 3, 4].map((i) => ({
          key: `product_${i}` as PartnerWebsiteProImageKey,
          kind: 'product_photo' as const,
          aspectRatio: '1:1',
          screenLabel: `Product ${i} catalog photo`,
          buildPrompt: ({ title, content }) => {
            const p = content.products[i - 1]
            const name = p?.name ?? `Product ${i}`
            const color = p?.color ? ` Color: ${p.color}.` : ''
            return `Professional ecommerce product photo for ${title}: ${name}.${color}
Pure white or soft neutral studio background, photorealistic fabric texture, catalog quality for fashion ecommerce.
Single product centered, no text overlay, no watermark.`
          },
        }))
      : []

  return [
    {
      key: 'hero',
      kind: 'banner',
      aspectRatio: '16:9',
      screenLabel: 'Hero lifestyle banner',
      buildPrompt: ({ title, briefText, content }) =>
        `Photorealistic hero banner for ${title}. ${content.hero.subheadline}
${briefText.slice(0, 400)}
Lifestyle fashion photography: confident model wearing premium product, urban or elegant setting, cinematic lighting, warm premium mood.
Full-bleed hero suitable for website header background. No UI chrome, no browser frame, no text overlay.`,
    },
    {
      key: 'material',
      kind: 'banner',
      aspectRatio: '4:3',
      screenLabel: 'Material texture macro',
      buildPrompt: ({ title, content }) =>
        `Macro close-up texture photo for ${title}: ${content.material?.title ?? 'premium natural material'}.
${content.material?.body ?? ''}
Extreme detail, soft natural light, luxurious fabric/material fibers visible, photorealistic, no text.`,
    },
    ...productSpecs,
    {
      key: 'lifestyle',
      kind: 'banner',
      aspectRatio: '16:9',
      screenLabel: 'Lifestyle secondary banner',
      buildPrompt: ({ title, content }) =>
        `Secondary lifestyle banner for ${title}. Brand mood: ${content.hero.headline}.
Elegant lifestyle scene showing product in natural use context, warm tones, premium editorial photography. No text overlay.`,
    },
  ]
}

export async function generatePartnerWebsiteProSectionImages(input: {
  locale: WebLocale
  userId: string
  title: string
  briefText: string
  siteType: PartnerWebsiteSiteType
  content: PartnerWebsiteProContent
  approvedMockupUrl: string
  logoUrl?: string | null
  /** User product/lifestyle photos — steer Gemini toward real catalog look. */
  userReferenceImageUrls?: string[]
  /** When set, only generate these slot keys (from mockup analysis). */
  onlySlots?: Array<PartnerWebsiteProImageKey | string>
}): Promise<PartnerWebsiteProSectionImages | { error: string }> {
  const allowed = input.onlySlots?.length
    ? new Set(input.onlySlots.map((s) => String(s).trim()).filter(Boolean))
    : null
  const specs = imageSpecs(input.siteType).filter((s) => !allowed || allowed.has(s.key))
  // Always generate at least hero if mockup had images but filter emptied list
  const effectiveSpecs =
    specs.length > 0
      ? specs
      : imageSpecs(input.siteType).filter((s) => s.key === 'hero' || s.key.startsWith('product_'))
  const out: PartnerWebsiteProSectionImages = {}
  let styleAnchorUrl = input.approvedMockupUrl.trim()
  const logoUrl = input.logoUrl?.trim()
  const userRefs = (input.userReferenceImageUrls ?? [])
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 6)

  for (const spec of effectiveSpecs) {
    const brief = spec.buildPrompt({
      locale: input.locale,
      title: input.title,
      briefText: input.briefText,
      content: input.content,
    })

    const refUrls: string[] = []
    const refMeta: Array<{ screenKey: string; label?: string }> = []

    if (styleAnchorUrl) {
      refUrls.push(styleAnchorUrl)
      refMeta.push({
        screenKey: spec.key === 'hero' ? 'landing_full' : 'banner_style_anchor',
        label: spec.screenLabel,
      })
    }
    if (logoUrl && /^https?:\/\//i.test(logoUrl) && spec.key === 'hero') {
      refUrls.unshift(logoUrl)
      refMeta.unshift({ screenKey: 'landing_logo', label: 'Brand logo' })
    }
    // Product / lifestyle shots: prefer user catalog photos so the site matches uploads.
    if (spec.kind === 'product_photo' || spec.key === 'lifestyle' || spec.key === 'material') {
      for (const url of userRefs) {
        if (refUrls.includes(url)) continue
        refUrls.push(url)
        refMeta.push({ screenKey: 'product_ref', label: 'User product reference' })
        if (refUrls.length >= 4) break
      }
    }

    const gen = await runStudioImagePipeline({
      userId: input.userId,
      kind: spec.kind,
      screenLabel: spec.screenLabel,
      screenKey: spec.key,
      brief,
      projectTitle: input.title,
      aspectRatio: spec.aspectRatio,
      referenceImageUrls: refUrls,
      referenceImageMeta: refMeta,
      verbatimPrompt: true,
    })

    if (!gen.ok) {
      return {
        error:
          input.locale === 'vi'
            ? `Không tạo được ảnh «${spec.screenLabel}»: ${gen.error}`
            : `Could not generate «${spec.screenLabel}»: ${gen.error}`,
      }
    }

    out[spec.key] = gen.resultUrl
    if (spec.key === 'hero') {
      styleAnchorUrl = gen.resultUrl
    }
  }

  return out
}

export function formatSectionImagesForBuildPrompt(
  images: PartnerWebsiteProSectionImages | Record<string, string | undefined>
): string {
  return Object.entries(images)
    .filter(([, url]) => url?.trim())
    .map(([key, url]) => `- ${key}: ${url}`)
    .join('\n')
}
