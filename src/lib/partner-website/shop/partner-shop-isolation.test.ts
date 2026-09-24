import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPartnerIsolationChecklist,
  isolationUrlTiedToOtherProject,
  partnerIsolationProgress,
  type PartnerIsolationFacts,
} from '@/lib/partner-website/shop/partner-shop-isolation'

const partnerId = '11111111-1111-1111-1111-111111111111'
const otherId = '22222222-2222-2222-2222-222222222222'

const empty: PartnerIsolationFacts = {
  brandKey: '',
  brandShared: false,
  domainHost: '',
  domainShared: false,
  phoneKey: '',
  phoneShared: false,
  bankKey: '',
  bankShared: false,
  sepayKey: '',
  sepayShared: false,
  returnKey: '',
  returnShared: false,
  adsKey: '',
  adsShared: false,
  ga4Key: '',
  ga4Shared: false,
  gtmKey: '',
  gtmShared: false,
  metaKey: '',
  metaShared: false,
  tiktokKey: '',
  tiktokShared: false,
  inventoryCount: 0,
  foreignImageCount: 0,
  foreignBrandAsset: false,
  ack: {},
}

const readyFacts: PartnerIsolationFacts = {
  ...empty,
  brandKey: 'shop moi',
  domainHost: 'shopmoi.vn',
  phoneKey: '0901234567',
  bankKey: '0123456789',
  returnKey: '12 nguyen trai q1',
  adsKey: 'AW-999',
  ga4Key: 'G-NEW',
  gtmKey: 'GTM-NEW',
  inventoryCount: 4,
  ack: {
    ads_account: true,
    merchant_center: true,
    ads_billing: true,
    search_console: true,
    company_page: true,
  },
}

test('empty setup is not isolated', () => {
  const items = buildPartnerIsolationChecklist(empty)
  const progress = partnerIsolationProgress(items)
  assert.equal(progress.ready, false)
  assert.equal(progress.requiredDone, 0)
  assert.equal(items.find((item) => item.id === 'meta_pixel')?.state, 'unused')
  assert.equal(items.find((item) => item.id === 'meta_pixel')?.done, true)
})

test('shared ads id or foreign image blocks isolation', () => {
  const shared = buildPartnerIsolationChecklist({ ...readyFacts, adsShared: true })
  assert.equal(shared.find((item) => item.id === 'google_ads')?.state, 'shared')
  assert.equal(partnerIsolationProgress(shared).ready, false)

  const foreign = buildPartnerIsolationChecklist({ ...readyFacts, foreignImageCount: 2 })
  assert.equal(foreign.find((item) => item.id === 'images')?.state, 'shared')
  assert.equal(partnerIsolationProgress(foreign).ready, false)
})

test('filled unique facts plus operator acks are isolated', () => {
  const items = buildPartnerIsolationChecklist(readyFacts)
  assert.equal(partnerIsolationProgress(items).ready, true)
})

test('image and origin urls tied to another project are detected', () => {
  assert.equal(
    isolationUrlTiedToOtherProject('https://188comvn.b-cdn.net/a.jpg', partnerId),
    true
  )
  assert.equal(
    isolationUrlTiedToOtherProject('https://cdn.188.com.vn/p.jpg', partnerId),
    true
  )
  assert.equal(
    isolationUrlTiedToOtherProject(`https://cdn.example/messaging-partner/${otherId}/a.jpg`, partnerId),
    true
  )
  assert.equal(
    isolationUrlTiedToOtherProject(`https://cdn.example/messaging-partner/${partnerId}/a.jpg`, partnerId),
    false
  )
  assert.equal(isolationUrlTiedToOtherProject('https://shopmoi.vn/logo.png', partnerId), false)
})
