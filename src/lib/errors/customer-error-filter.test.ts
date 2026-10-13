import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isExpectedCustomerMessage,
  isLikelyBotUserAgent,
  normalizeErrorForFingerprint,
  normalizePathForFingerprint,
} from './customer-error-filter'

describe('customer error filter', () => {
  it('skips low credit, login and missing-input prompts', () => {
    assert.equal(isExpectedCustomerMessage('Lỗi', 'Không đủ credits. Cần 2.'), true)
    assert.equal(isExpectedCustomerMessage('Error', 'Please sign in to continue.'), true)
    assert.equal(isExpectedCustomerMessage('Lỗi', 'Vui lòng tải lên ảnh của bạn và ít nhất một ảnh sản phẩm.'), true)
    assert.equal(isExpectedCustomerMessage('', ''), true)
  })

  it('keeps real failures even when they ask to retry', () => {
    assert.equal(
      isExpectedCustomerMessage('Tạo ảnh thất bại', 'OpenAI image lỗi HTTP 400: Duplicate parameter: image'),
      false
    )
    assert.equal(isExpectedCustomerMessage('Lỗi', 'Có lỗi xảy ra khi tạo ảnh. Vui lòng thử lại.'), false)
    assert.equal(isExpectedCustomerMessage('Image generation failed', 'GPT Image quá thời gian chờ.'), false)
  })

  it('ignores crawler user agents that execute JS and report chunk errors', () => {
    assert.equal(
      isLikelyBotUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 (compatible; meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler))'
      ),
      true
    )
    assert.equal(
      isLikelyBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Mobile/15E148 Safari/604.1'
      ),
      false
    )
  })

  it('merges errors that only differ by numbers, ids or urls', () => {
    const a = normalizeErrorForFingerprint('Job 123 failed for 37a7cb4b-1faf-44b7-9265-76f2e8dfe248 at https://cdn.x/a.png')
    const b = normalizeErrorForFingerprint('Job 98 failed for 56a8cf2e-1faf-44b7-9265-76f2e8dfe249 at https://cdn.x/b.jpg')
    assert.equal(a, b)
    assert.equal(normalizePathForFingerprint('/thu-do-online/123?x=1'), '/thu-do-online/:n')
  })
})
