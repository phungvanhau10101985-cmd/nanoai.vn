/**
 * Quick connectivity test to DeepSeek Chat model used by partner messaging.
 * Usage:
 *   npx tsx scripts/test-deepseek-chat-once.ts
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { deepseekPartnerChat } from '../src/lib/messaging/partner-ai-llm'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

async function main() {
  const system = 'Bạn là trợ lý shop. Trả lời ngắn gọn.'
  const user = 'Khách cao 1m57 nặng 55kg mặc size gì?'
  const res = await deepseekPartnerChat(system, user)
  console.log({
    model: res.model ?? null,
    hasText: Boolean(res.text?.trim()),
    error: res.error ?? null,
    usage: res.usage ?? null,
    preview: res.text?.slice(0, 120) ?? null,
  })
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})

