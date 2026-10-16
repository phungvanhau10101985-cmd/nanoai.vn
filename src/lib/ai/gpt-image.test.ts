import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateGptImage, runImageContent } from './gpt-image'

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_KEY = process.env.OPENAI_API_KEY

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_KEY == null) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY
})

function pngResponse(): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('gpt image endpoints', () => {
  it('sends text-only jobs to images/generations without input_fidelity', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let url = ''
    let body: { model?: string; quality?: string; size?: string; input_fidelity?: string } = {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input)
      body = JSON.parse(String(init?.body))
      return pngResponse()
    }) as typeof fetch
    const out = await generateGptImage({ prompt: 'a red bowl', quality: 'low', aspectRatio: '1:1' })
    assert.equal(url, 'https://api.openai.com/v1/images/generations')
    assert.equal(body.model, 'gpt-image-2')
    assert.equal(body.quality, 'low')
    assert.equal(body.size, '1024x1024')
    assert.equal(body.input_fidelity, undefined)
    assert.equal(out.buffer.toString(), 'png-bytes')
    assert.equal(out.usage.logModel, 'gpt-image-2')
    assert.equal(out.usage.logImageSize, 'gpt-low')
    assert.equal(out.usage.candidatesTokenCount, 200)
  })

  it('sends an input image to images/edits and keeps low quality', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let url = ''
    let form: FormData | null = null
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      url = String(input)
      form = init?.body instanceof FormData ? init.body : null
      return pngResponse()
    }) as typeof fetch
    await generateGptImage({
      prompt: 'edit this',
      quality: 'medium',
      images: [
        { bytes: Buffer.from('a'), mimeType: 'image/png', filename: 'a.png' },
        { bytes: Buffer.from('b'), mimeType: 'image/jpeg', filename: 'b.jpg' },
      ],
    })
    assert.equal(url, 'https://api.openai.com/v1/images/edits')
    assert.ok(form)
    const fields = form as FormData
    assert.equal(fields.get('model'), 'gpt-image-2')
    assert.equal(fields.get('quality'), 'medium')
    assert.equal(fields.get('size'), 'auto')
    assert.equal(fields.get('input_fidelity'), null)
    assert.equal(fields.getAll('image').length, 0)
    assert.equal(fields.getAll('image[]').length, 2)
  })

  it('keeps a single input image on the plain image field', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let form: FormData | null = null
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      form = init?.body instanceof FormData ? init.body : null
      return pngResponse()
    }) as typeof fetch
    await generateGptImage({
      prompt: 'edit this',
      quality: 'low',
      images: [{ bytes: Buffer.from('a'), mimeType: 'image/png', filename: 'a.png' }],
    })
    const fields = form as unknown as FormData
    assert.equal(fields.getAll('image').length, 1)
    assert.equal(fields.getAll('image[]').length, 0)
  })

  it('sends an explicit portrait size instead of the 1024x1536 bucket', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let body: { size?: string } = {}
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      body = JSON.parse(String(init?.body))
      return pngResponse()
    }) as typeof fetch
    await runImageContent({
      engine: 'gpt',
      gptQuality: 'low',
      aspectRatio: '9:16',
      gptSize: '1104x3312',
      parts: ['tall wedding plate'],
      gemini: async () => {
        throw new Error('gemini should not run')
      },
    })
    assert.equal(body.size, '1104x3312')
  })

  it('puts billable GPT usage on the Gemini-shaped response', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }],
          usage: {
            input_tokens: 600,
            output_tokens: 7033,
            input_tokens_details: { text_tokens: 100, image_tokens: 500 },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )) as typeof fetch
    const out = await runImageContent({
      engine: 'gpt',
      gptQuality: 'high',
      aspectRatio: '1:1',
      parts: ['a red bowl'],
      gemini: async () => {
        throw new Error('gemini should not run')
      },
    })
    const usage = (out as { response: { usageMetadata: { logModel: string; logImageSize: string; promptTokenCount: number; candidatesTokenCount: number } } }).response.usageMetadata
    assert.equal(usage.logModel, 'gpt-image-2')
    assert.equal(usage.logImageSize, 'gpt-high')
    assert.equal(usage.promptTokenCount, 900)
    assert.equal(usage.candidatesTokenCount, 7033)
  })

  it('uses the Gemini callback and does not call OpenAI', async () => {
    let called = false
    globalThis.fetch = (async () => {
      called = true
      throw new Error('should not fetch')
    }) as typeof fetch
    const out = await runImageContent({
      engine: 'gemini',
      gptQuality: 'high',
      parts: ['keep gemini'],
      gemini: async () => ({ via: 'gemini' as const }),
    })
    assert.deepEqual(out, { via: 'gemini' })
    assert.equal(called, false)
  })

  it('refuses GPT when the API key is missing', async () => {
    delete process.env.OPENAI_API_KEY
    await assert.rejects(
      () => generateGptImage({ prompt: 'x', quality: 'high' }),
      /OPENAI_API_KEY/,
    )
  })
})
