/**
 * Debug landing 1:4 image generation.
 * Usage: node scripts/test-landing-image-gen.mjs
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

const apiKey = process.env.GOOGLE_API_KEY?.trim()
if (!apiKey) {
  console.error('Missing GOOGLE_API_KEY')
  process.exit(1)
}

const { runStudioImagePipeline } = await import('../src/lib/hub-agent/studio-image-pipeline.ts')

const shortPrompt = `FULL landing page mockup — ONE tall vertical design image (1:4 portrait).
Project: Test Polo Landing
Hero headline: "Áo Polo Bamboo — Mát cả ngày"
Sub: Combo 2 áo 590k + Free Ship
Sections stacked: Hero, 3 pain points, 4 features, pricing, 2 reviews, FAQ, CTA footer.
Style: navy + white + orange accent. Logo in header (attached).
All UI text in Vietnamese. One finished mockup only.`

const userId = 'test-landing-debug'

for (const aspectRatio of ['1:4', '9:16']) {
  console.log(`\n--- Testing aspect ${aspectRatio} ---`)
  const t0 = Date.now()
  const result = await runStudioImagePipeline({
    userId,
    kind: 'banner',
    screenLabel: 'Full landing',
    screenKey: 'landing_full',
    brief: shortPrompt,
    aspectRatio,
    verbatimPrompt: true,
  })
  console.log('elapsed_ms:', Date.now() - t0)
  console.log('result:', result)
}
