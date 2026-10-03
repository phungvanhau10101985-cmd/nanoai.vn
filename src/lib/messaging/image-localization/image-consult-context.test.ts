import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  collectImageConsultSourceLines,
  formatImageConsultContextForPrompt,
  mergeImageConsultContext,
  normalizeExternalImageConsultContext,
  shouldAttachImageConsultContext,
} from './image-consult-context'
import type { ImageLocOcrBlock } from './image-localization-types'

function block(text: string, y: number, x = 0): ImageLocOcrBlock {
  return { text, bbox: [x, y, x + 40, y + 12] }
}

describe('image consult context filter', () => {
  it('keeps apparel specs and drops factory, contact, and price', () => {
    const lines = collectImageConsultSourceLines([
      block('实力工厂 广州', 0),
      block('胸围 88cm', 20),
      block('面料 95%棉', 40),
      block('手洗', 60),
      block('微信 wxshop123', 80),
      block('批发价 35元', 100),
    ])
    assert.deepEqual(lines, ['胸围 88cm', '面料 95%棉', '手洗'])
  })

  it('keeps machine specs the same way', () => {
    const lines = collectImageConsultSourceLines([
      block('功率 1500W', 0),
      block('电压 220V', 20),
      block('使用方法 先加水再通电', 40),
      block('厂家直供 品质保证', 60),
    ])
    assert.deepEqual(lines, ['功率 1500W', '电压 220V', '使用方法 先加水再通电'])
  })

  it('keeps the measurement when a line also mentions the factory', () => {
    const lines = collectImageConsultSourceLines([block('胸围 88cm 实力工厂', 0)])
    assert.deepEqual(lines, ['胸围 88cm'])
  })

  it('drops one-character OCR noise and duplicate lines', () => {
    const lines = collectImageConsultSourceLines([
      block('棉', 0),
      block('肩宽 39cm', 10),
      block('肩宽 39cm', 30),
    ])
    assert.deepEqual(lines, ['肩宽 39cm'])
  })
})

describe('image consult context merge', () => {
  it('keeps text from a deleted size image and from a skipped CDN image', () => {
    const first = mergeImageConsultContext({
      previous: null,
      language: 'vi',
      capturedAt: '2026-10-03T00:00:00Z',
      stillHostedUrls: ['https://cdn.shop/cover.jpg'],
      results: {
        'https://src.example/size.jpg': {
          consult_sources: ['胸围 88cm'],
          final_url: null,
        },
        'https://src.example/cover.jpg': {
          consult_sources: ['功率 1500W'],
          final_url: 'https://cdn.shop/cover.jpg',
        },
      },
    })
    assert.equal(first.touched, true)
    assert.equal(first.context?.images.some((image) => image.retained && image.lines[0]?.src === '胸围 88cm'), true)

    const second = mergeImageConsultContext({
      previous: first.context,
      language: 'vi',
      stillHostedUrls: ['https://cdn.shop/cover.jpg'],
      results: {
        'https://cdn.shop/cover.jpg': { final_url: 'https://cdn.shop/cover.jpg' },
      },
    })
    assert.equal(second.touched, false)
    const srcs = second.context?.images.flatMap((image) => image.lines.map((line) => line.src))
    assert.deepEqual(srcs?.sort(), ['功率 1500W', '胸围 88cm'])
  })
})

describe('image consult prompt', () => {
  it('attaches only for a single-product consult intent', () => {
    assert.equal(shouldAttachImageConsultContext('follow_up_current_product'), true)
    assert.equal(shouldAttachImageConsultContext('explicit_sku_consult'), true)
    assert.equal(shouldAttachImageConsultContext('card_consult_isolated'), true)
    assert.equal(shouldAttachImageConsultContext('purchase_or_order'), true)
    assert.equal(shouldAttachImageConsultContext('policy_or_order_support'), false)
    assert.equal(shouldAttachImageConsultContext('new_product_search'), false)
    assert.equal(shouldAttachImageConsultContext('similar_alternatives'), false)
  })

  it('formats stored lines and omits an empty payload', () => {
    const text = formatImageConsultContextForPrompt({
      captured_at: '2026-10-03T00:00:00Z',
      language: 'vi',
      images: [{ url: 'https://cdn.shop/a.jpg', lines: [{ src: '功率 1500W', vi: 'Công suất 1500W' }] }],
    })
    assert.match(text, /Công suất 1500W/)
    assert.match(text, /không bịa/)
    assert.equal(formatImageConsultContextForPrompt(null), '')
    assert.equal(formatImageConsultContextForPrompt({ images: [] }), '')
  })

  it('normalizes the customer-site lines contract and drops seller text', () => {
    const context = normalizeExternalImageConsultContext({
      language: 'vi',
      lines: [
        { src: '胸围 88cm', vi: 'Vòng ngực 88cm' },
        { src: '功率 1500W', vi: 'Công suất 1500W' },
        { src: '微信 wxshop123', vi: 'WeChat wxshop123' },
        { src: '批发价 35元', vi: 'Giá sỉ 35 tệ' },
      ],
    })
    assert.equal(context?.language, 'vi')
    assert.equal(context?.images.length, 1)
    assert.deepEqual(
      context?.images[0]?.lines.map((line) => line.vi || line.src),
      ['Vòng ngực 88cm', 'Công suất 1500W']
    )
    assert.equal(normalizeExternalImageConsultContext(null), null)
    assert.equal(normalizeExternalImageConsultContext({ lines: [] }), null)
    assert.equal(normalizeExternalImageConsultContext({ images: [] }), null)
  })

  it('keeps image urls when the customer payload sends lines and images together', () => {
    const context = normalizeExternalImageConsultContext({
      language: 'vi',
      lines: [{ src: '胸围88cm', vi: 'Vòng ngực 88cm' }],
      images: [
        {
          url: 'https://cdn.shop/size-chart.jpg',
          lines: [{ src: '胸围88cm', vi: 'Vòng ngực 88cm' }],
        },
      ],
    })
    assert.equal(context?.images.length, 1)
    assert.equal(context?.images[0]?.url, 'https://cdn.shop/size-chart.jpg')
    assert.deepEqual(context?.images[0]?.lines, [{ src: '胸围88cm', vi: 'Vòng ngực 88cm' }])
    assert.equal(Object.prototype.hasOwnProperty.call(context, 'lines'), false)
  })
})
