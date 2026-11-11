import assert from 'node:assert/strict'
import test from 'node:test'
import { WEDDING_COMMERCE_CONTENT_ID } from '@/lib/wedding/wedding-commerce-events'
import {
  NANOAI_FACEBOOK_DYNAMIC_EVENTS,
  buildNanoAiFacebookDynamicCustomData,
  readNanoAiFacebookSearchString,
  sanitizeNanoAiFacebookSearchString,
} from '@/lib/tracking/nanoai-facebook-dynamic-events'

test('catalog dynamic events all carry the feed id', () => {
  assert.deepEqual(
    [...NANOAI_FACEBOOK_DYNAMIC_EVENTS],
    ['ViewContent', 'Search', 'AddToCart', 'AddToWishlist', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase']
  )
  for (const event of NANOAI_FACEBOOK_DYNAMIC_EVENTS) {
    const data = buildNanoAiFacebookDynamicCustomData({
      contentId: WEDDING_COMMERCE_CONTENT_ID,
      contentName: 'Tạo thiệp cưới AI',
      valueVnd: 149000,
      searchString: event === 'Search' ? 'thiệp cưới' : '',
      orderId: event === 'Purchase' ? 'pay_123' : '',
    })
    assert.equal(data.content_ids[0], 'feature_tao_thiep_moi_cuoi_ai')
    assert.equal(data.content_type, 'product')
    assert.equal(data.currency, 'VND')
    assert.equal(data.value, 149000)
    assert.equal(data.contents[0]?.id, 'feature_tao_thiep_moi_cuoi_ai')
    assert.equal(data.contents[0]?.item_price, 149000)
    assert.equal(data.num_items, 1)
    if (event === 'Search') assert.equal(data.search_string, 'thiệp cưới')
    if (event === 'Purchase') assert.equal(data.order_id, 'pay_123')
  }
})

test('search without a catalog match does not invent a product id', () => {
  const data = buildNanoAiFacebookDynamicCustomData({
    contentId: '',
    contentName: 'thiệp cưới',
    valueVnd: 0,
    searchString: 'thiệp cưới',
  })
  assert.deepEqual(data.content_ids, [])
  assert.deepEqual(data.contents, [])
  assert.equal(data.search_string, 'thiệp cưới')
})

test('pixel queue receives every dynamic event', async () => {
  const calls: unknown[][] = []
  const store = new Map<string, string>()
  const win = {
    fbq: (...args: unknown[]) => {
      calls.push(args)
    },
    location: { href: 'https://nanoai.vn/tao-thiep-moi-cuoi-ai' },
    localStorage: { getItem: () => '' },
    sessionStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
    top: null as unknown,
  }
  win.top = win
  Object.assign(globalThis, {
    window: win,
    document: { cookie: '' },
    fetch: async () => ({ ok: true }),
  })
  const { fireNanoAiFacebookDynamicEvent } = await import('./nanoai-facebook-dynamic-events-client')
  for (const event of NANOAI_FACEBOOK_DYNAMIC_EVENTS) {
    const ok = fireNanoAiFacebookDynamicEvent({
      event,
      contentId: event === 'Search' ? '' : WEDDING_COMMERCE_CONTENT_ID,
      contentName: 'Tạo thiệp cưới AI',
      valueVnd: 149000,
      searchString: event === 'Search' ? 'thiệp cưới' : '',
      orderId: event === 'Purchase' || event === 'AddPaymentInfo' ? 'pay_1' : '',
      skipDedupe: true,
    })
    assert.equal(ok, true, event)
  }
  assert.deepEqual(
    calls.map((call) => call[1]),
    [...NANOAI_FACEBOOK_DYNAMIC_EVENTS]
  )
  for (const call of calls) {
    assert.equal(call[0], 'track')
    const data = call[2] as { content_type?: string; currency?: string; search_string?: string }
    assert.equal(data.content_type, 'product')
    assert.equal(data.currency, 'VND')
    const options = call[3] as { eventID?: string }
    assert.match(String(options.eventID || ''), /^[A-Za-z0-9._:-]{8,128}$/)
  }
  const search = calls.find((call) => call[1] === 'Search')
  const searchData = search?.[2] as { search_string?: string; content_ids?: string[] }
  assert.equal(searchData.search_string, 'thiệp cưới')
  assert.deepEqual(searchData.content_ids, [])
})

test('search string comes only from q or query', () => {
  assert.equal(readNanoAiFacebookSearchString('?q=thiệp cưới'), 'thiệp cưới')
  assert.equal(readNanoAiFacebookSearchString('?query=logo'), 'logo')
  assert.equal(readNanoAiFacebookSearchString('?email=a@b.com'), '')
  assert.equal(sanitizeNanoAiFacebookSearchString('  ao   dai \n'), 'ao dai')
  assert.equal(sanitizeNanoAiFacebookSearchString('x'.repeat(180)).length, 100)
})
