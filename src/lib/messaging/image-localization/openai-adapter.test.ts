import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { openaiProcessImage } from './openai-adapter'

const ORIGINAL_FETCH = globalThis.fetch
const ORIGINAL_KEY = process.env.OPENAI_API_KEY

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  if (ORIGINAL_KEY == null) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL_KEY
})

function jsonResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } })
}

describe('openai image localization body', () => {
  it('reads a pretty-printed b64_json when the JSON is truncated after the image', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    const payload = Buffer.from('png-bytes')
    const b64 = payload.toString('base64')
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      return jsonResponse(
        `{\n  "data": [\n    {\n      "b64_json": "${b64}",\n      "generation_id": "gen-1"\n    }\n  ],\n  "usage": { "input_tokens": 11, "output_tokens": 22, "input_tokens_details": { "image_tokens": 8, "text_tokens": 3 } }\n`,
      )
    }) as typeof fetch
    const out = await openaiProcessImage({
      imageBytes: Buffer.from('source'),
      filename: 'size.jpg',
      language: 'vi',
      imageModel: 'gpt-image-2',
      imageQuality: 'medium',
      imageSize: 'auto',
      removeModel: true,
    })
    assert.equal(calls, 1)
    assert.equal(out.bytes.toString(), 'png-bytes')
  })

  it('retries once when the first 200 body has no image', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    const b64 = Buffer.from('png-bytes').toString('base64')
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      if (calls === 1) return jsonResponse('{"data":[]}')
      return jsonResponse(`{"data":[{"b64_json":"${b64}"}]}`)
    }) as typeof fetch
    const out = await openaiProcessImage({
      imageBytes: Buffer.from('source'),
      filename: 'size.jpg',
      language: 'vi',
      imageModel: 'gpt-image-2',
    })
    assert.equal(calls, 2)
    assert.equal(out.bytes.toString(), 'png-bytes')
  })

  it('stops without a second call when OpenAI reports a safety block', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      return jsonResponse(
        '{"error":{"message":"Your request was rejected as a result of our safety system.","code":"moderation_blocked"}}',
      )
    }) as typeof fetch
    await assert.rejects(
      () =>
        openaiProcessImage({
          imageBytes: Buffer.from('source'),
          filename: 'size.jpg',
          language: 'vi',
          imageModel: 'gpt-image-2',
        }),
      /safety system/,
    )
    assert.equal(calls, 1)
  })

  it('does not retry a 400', async () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-1234567890'
    let calls = 0
    globalThis.fetch = (async () => {
      calls += 1
      return jsonResponse('{"error":{"message":"invalid image"}}', 400)
    }) as typeof fetch
    await assert.rejects(
      () =>
        openaiProcessImage({
          imageBytes: Buffer.from('source'),
          filename: 'size.jpg',
          language: 'vi',
          imageModel: 'gpt-image-2',
        }),
      /HTTP 400: invalid image/,
    )
    assert.equal(calls, 1)
  })
})
