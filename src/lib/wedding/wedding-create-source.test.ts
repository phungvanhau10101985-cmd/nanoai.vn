import assert from 'node:assert/strict'
import { createContext, runInNewContext } from 'node:vm'
import { describe, it } from 'node:test'
import {
  WEDDING_CREATE_SOURCE_STORAGE_KEY,
  chooseWeddingCreateTouch,
  resolveWeddingCreateSource,
  weddingCreateSourceBootstrapJs,
  weddingCreateSourceView,
  type WeddingCreateTouch,
} from './wedding-create-source'

const NOW = 1_700_000_000_000

function touch(partial: Partial<WeddingCreateTouch> & Pick<WeddingCreateTouch, 'search' | 'referrer'>): WeddingCreateTouch {
  return {
    pageHost: 'nanoai.vn',
    at: NOW,
    ...partial,
  }
}

function runBootstrap(input: {
  search: string
  referrer: string
  pageHost: string
  stored?: string | null
  now?: number
}): string | null {
  const memory = new Map<string, string>()
  if (input.stored) memory.set(WEDDING_CREATE_SOURCE_STORAGE_KEY, input.stored)
  const now = input.now ?? NOW
  const context = {
    location: { search: input.search, hostname: input.pageHost },
    document: { referrer: input.referrer },
    localStorage: {
      getItem: (key: string) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key: string, value: string) => {
        memory.set(key, value)
      },
    },
    URL,
    URLSearchParams,
    JSON,
    Date: { now: () => now },
  }
  runInNewContext(weddingCreateSourceBootstrapJs(), createContext(context))
  return memory.get(WEDDING_CREATE_SOURCE_STORAGE_KEY) ?? null
}

describe('resolveWeddingCreateSource', () => {
  it('names the ad network and keeps the campaign, without the click id', () => {
    assert.deepEqual(resolveWeddingCreateSource('?fbclid=IwAR123&utm_source=facebook&utm_medium=cpc&utm_campaign=tet', '', 'nanoai.vn'), {
      source: 'facebook',
      detail: 'facebook · cpc · tet',
    })
    assert.deepEqual(resolveWeddingCreateSource('?ttclid=abc', 'https://www.tiktok.com/@a', 'nanoai.vn'), {
      source: 'tiktok',
      detail: '',
    })
    assert.deepEqual(resolveWeddingCreateSource('?gclid=EAIa&utm_source=google&utm_medium=cpc', '', 'nanoai.vn'), {
      source: 'google_ads',
      detail: 'google · cpc',
    })
    assert.equal(resolveWeddingCreateSource('?fbclid=1', '', 'nanoai.vn').detail.includes('fbclid'), false)
  })

  it('keeps a referring site that is not an ad, and treats a same-site visit as direct', () => {
    assert.deepEqual(resolveWeddingCreateSource('', 'https://www.google.com/search?q=thiep', 'nanoai.vn'), {
      source: 'other',
      detail: 'google.com',
    })
    assert.deepEqual(resolveWeddingCreateSource('?utm_source=zalo&utm_medium=chat', '', 'nanoai.vn'), {
      source: 'other',
      detail: 'zalo · chat',
    })
    assert.deepEqual(resolveWeddingCreateSource('', 'https://nanoai.vn/tao-thiep-moi-cuoi-ai', 'nanoai.vn'), {
      source: 'direct',
      detail: '',
    })
    assert.deepEqual(resolveWeddingCreateSource('', 'https://accounts.google.com/o/oauth2', 'nanoai.vn'), {
      source: 'direct',
      detail: '',
    })
    assert.deepEqual(resolveWeddingCreateSource('', '', 'nanoai.vn'), {
      source: 'direct',
      detail: '',
    })
  })
})

describe('weddingCreateSourceView', () => {
  it('turns a host or utm into a short name and keeps the campaign line', () => {
    assert.deepEqual(weddingCreateSourceView('other', 'google.com'), { kind: 'other', text: 'Google', extra: '' })
    assert.deepEqual(weddingCreateSourceView('other', 'zalo · chat'), {
      kind: 'other',
      text: 'Zalo',
      extra: 'zalo · chat',
    })
    assert.deepEqual(weddingCreateSourceView('facebook', 'facebook · cpc · tet'), {
      kind: 'facebook',
      text: '',
      extra: 'facebook · cpc · tet',
    })
    assert.deepEqual(weddingCreateSourceView('', ''), { kind: 'unknown', text: '', extra: '' })
  })
})

describe('chooseWeddingCreateTouch', () => {
  it('keeps the first referral, and lets a later ad click replace it', () => {
    const zalo = touch({ search: '?utm_source=zalo', referrer: '', at: NOW - 1000 })
    const google = touch({ search: '', referrer: 'https://www.google.com/', at: NOW })
    assert.equal(chooseWeddingCreateTouch(zalo, google, NOW), zalo)

    const direct = touch({ search: '', referrer: '', at: NOW })
    const facebook = touch({ search: '?fbclid=1', referrer: '', at: NOW - 5000 })
    assert.equal(chooseWeddingCreateTouch(facebook, direct, NOW), facebook)

    const ads = touch({ search: '?gclid=1', referrer: '', at: NOW })
    assert.equal(chooseWeddingCreateTouch(facebook, ads, NOW), ads)

    const expired = touch({ search: '?fbclid=1', referrer: '', at: NOW - 31 * 24 * 60 * 60 * 1000 })
    assert.equal(chooseWeddingCreateTouch(expired, direct, NOW), direct)
  })
})

describe('weddingCreateSourceBootstrapJs', () => {
  it('stores the same touch the page will read after hydration', () => {
    const cases = [
      { search: '', referrer: '', pageHost: 'nanoai.vn', stored: null },
      { search: '?fbclid=IwAR', referrer: 'https://l.facebook.com/l.php', pageHost: 'www.nanoai.vn', stored: null },
      { search: '?utm_source=zalo', referrer: '', pageHost: 'localhost', stored: null },
      {
        search: '',
        referrer: 'https://nanoai.vn/bang-gia',
        pageHost: 'nanoai.vn',
        stored: JSON.stringify(touch({ search: '?fbclid=keep', referrer: '', at: NOW - 1000 })),
      },
      {
        search: '?gclid=new',
        referrer: '',
        pageHost: 'nanoai.vn',
        stored: JSON.stringify(touch({ search: '?fbclid=old', referrer: '', at: NOW - 1000 })),
      },
    ]
    for (const item of cases) {
      const prev = item.stored ? (JSON.parse(item.stored) as WeddingCreateTouch) : null
      const next = touch({ search: item.search, referrer: item.referrer, pageHost: item.pageHost, at: NOW })
      const chosen = chooseWeddingCreateTouch(prev, next, NOW)
      const raw = runBootstrap(item)
      assert.ok(raw)
      const saved = JSON.parse(raw) as WeddingCreateTouch
      assert.equal(saved.search, chosen.search)
      assert.equal(saved.referrer, chosen.referrer)
      assert.equal(saved.pageHost, chosen.pageHost.toLowerCase())
    }
  })
})
