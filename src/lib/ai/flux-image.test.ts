import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateFluxImage } from './flux-image'

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_KEY = process.env.BFL_API_KEY

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_KEY == null) delete process.env.BFL_API_KEY
  else process.env.BFL_API_KEY = ORIGINAL_KEY
})

describe('flux 3 client', () => {
  it('asks for 2k, polls, and downloads without sending the key to the image url', async () => {
    process.env.BFL_API_KEY = 'bfl-test-key-123456'
    const calls: Array<{ url: string; hasKey: boolean; body?: Record<string, unknown> }> = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      calls.push({
        url,
        hasKey: headers.has('x-key'),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      })
      if (url.endsWith('/flux-3-image')) {
        return new Response(
          JSON.stringify({ id: 'job-1', polling_url: 'https://api.bfl.ai/v1/get_result?id=job-1', cost: 10 }),
          { status: 200 },
        )
      }
      if (url.includes('get_result')) {
        return new Response(JSON.stringify({ status: 'Ready', result: { sample: 'https://cdn.example/sample.png' }, cost: 10 }), {
          status: 200,
        })
      }
      return new Response(Buffer.from('png-bytes'), { status: 200 })
    }) as typeof fetch

    const out = await generateFluxImage({
      prompt: 'flat box panel',
      quality: '2K',
      aspectRatio: '9:16',
      pollIntervalMs: 0,
    })
    assert.equal(out.buffer.toString(), 'png-bytes')
    assert.equal(out.cost, 10)
    assert.equal(out.usage.logModel, 'NanoAI F2K')
    assert.equal(out.usage.logImageSize, 'F2K')
    assert.equal(calls[0]?.body?.resolution, '2k')
    assert.equal(calls[0]?.body?.aspect_ratio, '9:16')
    assert.equal(calls[0]?.body?.width, undefined)
    assert.equal(calls[1]?.hasKey, true)
    assert.equal(calls[2]?.hasKey, false)
  })

  it('sends exact face pixels and skips resolution', async () => {
    process.env.BFL_API_KEY = 'bfl-test-key-123456'
    let body: Record<string, unknown> = {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/flux-3-image')) {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ id: 'job-2', polling_url: 'https://api.bfl.ai/v1/get_result?id=job-2', cost: 10 }), {
          status: 200,
        })
      }
      if (url.includes('get_result')) {
        return new Response(JSON.stringify({ status: 'Ready', result: { sample: 'https://cdn.example/face.png' } }), { status: 200 })
      }
      return new Response(Buffer.from('face'), { status: 200 })
    }) as typeof fetch
    const out = await generateFluxImage({
      prompt: 'front panel',
      quality: '4K',
      size: { width: 1216, height: 3296 },
      pollIntervalMs: 0,
    })
    assert.equal(body.width, 1216)
    assert.equal(body.height, 3296)
    assert.equal(body.resolution, undefined)
    assert.equal(body.aspect_ratio, undefined)
    assert.equal(out.usage.logModel, 'NanoAI F4K')
  })

  it('asks for 1.5k and logs NanoAI F1.5K', async () => {
    process.env.BFL_API_KEY = 'bfl-test-key-123456'
    let body: Record<string, unknown> = {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/flux-3-image')) {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>
        return new Response(JSON.stringify({ id: 'job-15', polling_url: 'https://api.bfl.ai/v1/get_result?id=job-15' }), {
          status: 200,
        })
      }
      if (url.includes('get_result')) {
        return new Response(JSON.stringify({ status: 'Ready', result: { sample: 'https://cdn.example/small.png' } }), { status: 200 })
      }
      return new Response(Buffer.from('small'), { status: 200 })
    }) as typeof fetch
    const out = await generateFluxImage({ prompt: 'draft panel', quality: '1.5K', aspectRatio: '1:1', pollIntervalMs: 0 })
    assert.equal(body.resolution, '1.5k')
    assert.equal(out.usage.logModel, 'NanoAI F1.5K')
    assert.equal(out.usage.logImageSize, 'F1.5K')
    assert.equal(out.usage.candidatesTokenCount, 7000)
  })

  it('tells the admin when credits are empty', async () => {
    process.env.BFL_API_KEY = 'bfl-test-key-123456'
    globalThis.fetch = (async () => new Response('payment required', { status: 402 })) as typeof fetch
    await assert.rejects(() => generateFluxImage({ prompt: 'x', quality: '2K', pollIntervalMs: 0 }), /nạp thêm/)
  })
})
