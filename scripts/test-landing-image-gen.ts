import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'

const cwd = process.cwd()
if (existsSync(resolve(cwd, '.env'))) config({ path: resolve(cwd, '.env') })
if (existsSync(resolve(cwd, '.env.local'))) config({ path: resolve(cwd, '.env.local'), override: true })

import { getPgPool } from '../src/lib/db/pool'
import { runStudioImagePipeline } from '../src/lib/hub-agent/studio-image-pipeline'

async function main() {
  const pool = getPgPool()
  const r = await pool.query(
    'select user_id, balance from public.credits order by balance desc limit 1'
  )
  const uid = r.rows[0]?.user_id as string | undefined
  if (!uid) {
    console.error('No user with credits')
    process.exit(1)
  }
  console.log('user', uid, 'balance', r.rows[0]?.balance)

  const shortPrompt = `FULL landing page mockup — ONE tall vertical design image (1:4 portrait).
Hero: "Áo Polo Bamboo Cool Flex" — combo 590k free ship.
Stack: Hero, 3 pain points, 4 features, pricing table, 2 reviews, FAQ, CTA.
Colors: navy, white, orange. All text Vietnamese. One finished mockup.`

  for (const aspectRatio of ['1:4', '9:16'] as const) {
    const t0 = Date.now()
    const result = await runStudioImagePipeline({
      userId: uid,
      kind: 'banner',
      screenLabel: 'Full landing',
      screenKey: 'landing_full',
      brief: shortPrompt,
      aspectRatio,
      verbatimPrompt: true,
    })
    console.log(
      aspectRatio,
      `${Date.now() - t0}ms`,
      result.ok ? `OK ${result.resultUrl?.slice(0, 80)}` : result.error
    )
  }
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
