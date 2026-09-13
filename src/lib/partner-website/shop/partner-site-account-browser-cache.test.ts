import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearPartnerSiteAccountBrowserCache,
  loginIdentityFromAccountCache,
  partnerSiteAccountBrowserCacheKey,
  readPartnerSiteAccountBrowserCache,
  sanitizePartnerSiteCachedAccountProfile,
  writePartnerSiteAccountBrowserCache,
  PW_ACCOUNT_BROWSER_CACHE_KEY_PREFIX,
} from '@/lib/partner-website/shop/partner-site-account-browser-cache'

function installMemoryStorage() {
  const store = new Map<string, string>()
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
  }
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage, dispatchEvent() {}, sessionStorage: { getItem() { return null } } },
    configurable: true,
  })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true })
  Object.defineProperty(globalThis, 'document', {
    value: { cookie: '' },
    configurable: true,
  })
  return store
}

test('cache key is per shop slug', () => {
  assert.equal(partnerSiteAccountBrowserCacheKey('188-Shop'), `${PW_ACCOUNT_BROWSER_CACHE_KEY_PREFIX}188-shop`)
})

test('sanitize profile keeps display fields and drops empty shells', () => {
  assert.equal(sanitizePartnerSiteCachedAccountProfile({}), null)
  const p = sanitizePartnerSiteCachedAccountProfile({
    email: 'mai@shop.test',
    customer_name: 'Mai Nguyễn',
    customer_phone: '0901234567',
    gender: 'female',
    date_of_birth: '1990-05-12',
    avatar_url: 'https://lh3.googleusercontent.com/a/x',
  })
  assert.equal(p?.email, 'mai@shop.test')
  assert.equal(p?.customer_name, 'Mai Nguyễn')
  assert.equal(p?.gender, 'female')
})

test('read/write cache is bound to the logged-in account id', () => {
  const store = installMemoryStorage()
  store.set('app_guest_account_id', 'acc-a')
  writePartnerSiteAccountBrowserCache('demo-shop', {
    profile: { email: 'a@x.com', customer_name: 'An', greeting_name: null, customer_phone: '0901', shipping_address: null, gender: null, date_of_birth: null, avatar_url: null, auth_mode: 'guest_account' },
    shopAdminHref: '/dashboard',
  })
  const cached = readPartnerSiteAccountBrowserCache('demo-shop')
  assert.equal(cached?.accountId, 'acc-a')
  assert.equal(cached?.profile?.customer_name, 'An')
  assert.equal(cached?.shopAdminHref, '/dashboard')
  store.set('app_guest_account_id', 'acc-b')
  assert.equal(readPartnerSiteAccountBrowserCache('demo-shop'), null)
  store.set('app_guest_account_id', 'acc-a')
  clearPartnerSiteAccountBrowserCache('demo-shop')
  assert.equal(readPartnerSiteAccountBrowserCache('demo-shop'), null)
})

test('login identity comes from cached profile immediately', () => {
  const identity = loginIdentityFromAccountCache({
    v: 1,
    accountId: 'acc',
    savedAt: Date.now(),
    profile: {
      email: 'mai.nguyen@gmail.com',
      greeting_name: null,
      customer_name: 'Nguyễn Văn A',
      customer_phone: null,
      shipping_address: null,
      gender: null,
      date_of_birth: null,
      avatar_url: 'https://cdn.example/a.png',
      auth_mode: 'linked_user',
    },
    shopAdminHref: null,
    orders: [],
    wallet: [],
    addresses: [],
    unreadNotifications: 0,
    notifications: [],
  })
  assert.equal(identity?.name, 'Nguyễn Văn A')
  assert.equal(identity?.avatarUrl, 'https://cdn.example/a.png')
})

test('partial profile writes merge into the existing cached profile', () => {
  const store = installMemoryStorage()
  store.set('app_guest_account_id', 'acc-a')
  writePartnerSiteAccountBrowserCache('demo-shop', {
    profile: {
      email: 'a@x.com',
      customer_name: 'An',
      customer_phone: '0901',
      greeting_name: null,
      shipping_address: 'Hà Nội',
      gender: 'female',
      date_of_birth: '1990-01-02',
      avatar_url: null,
      auth_mode: 'guest_account',
    },
  })
  writePartnerSiteAccountBrowserCache('demo-shop', {
    profile: { customer_name: 'An Phạm', avatar_url: 'https://cdn.example/a.png' },
  })
  const cached = readPartnerSiteAccountBrowserCache('demo-shop')
  assert.equal(cached?.profile?.customer_name, 'An Phạm')
  assert.equal(cached?.profile?.customer_phone, '0901')
  assert.equal(cached?.profile?.shipping_address, 'Hà Nội')
  assert.equal(cached?.profile?.avatar_url, 'https://cdn.example/a.png')
})

test('hub lite orders do not wipe product names from the orders page cache', () => {
  const store = installMemoryStorage()
  store.set('app_guest_account_id', 'acc-a')
  writePartnerSiteAccountBrowserCache('demo-shop', {
    orders: [
      { id: 'o1', status: 'paid_verified', product_name: 'Túi xách', product_image_url: 'https://cdn.example/t.jpg' },
    ],
  })
  writePartnerSiteAccountBrowserCache('demo-shop', {
    orders: [{ id: 'o1', status: 'paid_verified', shipping_status: 'packing', has_review: false }],
  })
  const cached = readPartnerSiteAccountBrowserCache('demo-shop')
  assert.equal(cached?.orders[0]?.product_name, 'Túi xách')
  assert.equal(cached?.orders[0]?.shipping_status, 'packing')
})
