/**
 * Preview merged banner prompt (copy + image prompt in one Gemini call).
 * Usage: npx tsx scripts/preview-banner-prompt-188.ts
 */
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { buildBannerImageGenerationPrompt } from '../src/lib/hub-chat/banner-image-prompt-builder'
import { getBannerAdPresetLabel, getBannerAdPlatformHint } from '../src/lib/banner-ad-presets'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

const PRESET_ID = 'horizontal_display_ads' as const
const briefNotes: Record<string, string> = {
  domain_name: '188.com.vn',
  campaign_name: 'quảng cáo hàng ngày',
  product_offer: 'thời trang nam, túi xách nam, giày dép nam, phụ kiện nam',
  discount_cta: 'khám phá ngay',
  brand_style: 'sang',
  color_tone: 'cam chính xám phụ',
  banner_style: 'bối cảnh đời sống',
  banner_model: 'nam châu á',
}

const draft = [
  briefNotes.domain_name,
  briefNotes.campaign_name,
  briefNotes.product_offer,
  briefNotes.discount_cta,
]
  .filter(Boolean)
  .join(' · ')

async function main() {
  const googleKey = process.env.GOOGLE_API_KEY?.trim()
  if (!googleKey) {
    console.error('Missing GOOGLE_API_KEY')
    process.exit(1)
  }

  const adChannelLabel = getBannerAdPresetLabel(
    { id: PRESET_ID, aspectRatio: '16:9', labelKey: 'horizontal_display_ads', platform: 'google' },
    'vi'
  )
  const platformHint = getBannerAdPlatformHint(PRESET_ID, 'vi')

  console.log('=== Gemini merged (on-banner copy + image prompt) ===')
  const built = await buildBannerImageGenerationPrompt({
    apiKey: googleKey,
    userId: 'preview-script',
    locale: 'vi',
    briefNotes,
    draft,
    presetId: PRESET_ID,
    aspectRatio: '16:9',
    adChannelLabel,
    platformHint,
    hasReferenceImages: false,
    hasLogo: false,
  })

  if (!built.ok) {
    console.error('Prompt build failed:', built.error)
    process.exit(1)
  }

  console.log('\n--- On-banner copy (structured) ---')
  console.log(built.structuredCopy)
  console.log('\n--- imageCopy ---')
  console.log(built.imageCopy)
  console.log('\n--- Final image generation prompt ---')
  console.log(built.prompt)

  const outPath = resolve(cwd, 'scripts', 'preview-banner-prompt-188-output.txt')
  const full = [
    '# Brief notes',
    JSON.stringify(briefNotes, null, 2),
    '',
    '# Draft input',
    draft,
    '',
    '# On-banner copy (Gemini section 1)',
    built.structuredCopy,
    '',
    '# imageCopy',
    built.imageCopy,
    '',
    '# Final image generation prompt (Gemini section 2)',
    built.prompt,
  ].join('\n')
  writeFileSync(outPath, full, 'utf8')
  console.log(`\nSaved full output: ${outPath}`)
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
