/**
 * Test DeepSeek V4 models via project helpers (post-migration from legacy aliases).
 * Usage: npx tsx scripts/test-deepseek-models.ts
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
  resolveDeepSeekVerifyModel,
} from '../src/lib/deepseek-api'

const cwd = process.cwd()
const envPath = resolve(cwd, '.env')
const localPath = resolve(cwd, '.env.local')
if (existsSync(envPath)) config({ path: envPath })
if (existsSync(localPath)) config({ path: localPath, override: true })

async function testMode(mode: 'chat' | 'verify') {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  const model = mode === 'chat' ? resolveDeepSeekChatModel() : resolveDeepSeekVerifyModel()
  if (!key) {
    console.log({ mode, model, ok: false, error: 'DEEPSEEK_API_KEY not configured' })
    return
  }
  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody(mode, {
          messages: [
            { role: 'system', content: 'Reply with JSON only: {"ok":true}' },
            { role: 'user', content: 'Say ok' },
          ],
          max_tokens: 64,
          temperature: 0,
        })
      ),
    })
    const json = (await res.json()) as {
      error?: { message?: string }
      choices?: Array<{ message?: { content?: string } }>
      usage?: { total_tokens?: number }
    }
    const text = json.choices?.[0]?.message?.content?.trim() ?? ''
    console.log({
      mode,
      model,
      ok: res.ok && Boolean(text),
      status: res.status,
      error: json.error?.message ?? null,
      preview: text.slice(0, 80) || null,
      tokens: json.usage?.total_tokens ?? null,
    })
  } catch (e) {
    console.log({
      mode,
      model,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}

async function main() {
  console.log('Resolved models:', {
    chat: resolveDeepSeekChatModel(),
    verify: resolveDeepSeekVerifyModel(),
  })
  await testMode('chat')
  await testMode('verify')
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
})
