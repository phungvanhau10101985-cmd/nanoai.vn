import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  bunnyStorageHostCandidates,
  bunnyStorageHostForRegion,
  bunnyStorageObjectUrl,
  partnerBunnyStorageRegionCode,
  platformBunnyStorageRegionCode,
} from './bunny-storage-endpoint'

const originalShop = process.env.BUNNY_STORAGE_REGION
const originalPlatform = process.env.BUNNY_PLATFORM_STORAGE_REGION

afterEach(() => {
  if (originalShop == null) delete process.env.BUNNY_STORAGE_REGION
  else process.env.BUNNY_STORAGE_REGION = originalShop
  if (originalPlatform == null) delete process.env.BUNNY_PLATFORM_STORAGE_REGION
  else process.env.BUNNY_PLATFORM_STORAGE_REGION = originalPlatform
})

describe('bunny storage endpoint', () => {
  it('maps shop region SG to the Singapore API host', () => {
    assert.equal(bunnyStorageHostForRegion('SG'), 'sg.storage.bunnycdn.com')
    assert.equal(bunnyStorageHostForRegion('de'), 'storage.bunnycdn.com')
    assert.equal(bunnyStorageHostForRegion(''), 'storage.bunnycdn.com')
  })

  it('builds the object URL on the regional host', () => {
    assert.equal(
      bunnyStorageObjectUrl('sg.storage.bunnycdn.com', 'gudo-vn', 'localized-images/p/a.jpg'),
      'https://sg.storage.bunnycdn.com/gudo-vn/localized-images/p/a.jpg'
    )
  })

  it('tries the preferred host before other regions', () => {
    const hosts = bunnyStorageHostCandidates('sg.storage.bunnycdn.com')
    assert.equal(hosts[0], 'sg.storage.bunnycdn.com')
    assert.equal(hosts.filter((h) => h === 'sg.storage.bunnycdn.com').length, 1)
    assert.ok(hosts.includes('storage.bunnycdn.com'))
  })

  it('defaults shop zones to SG and the platform zone to Frankfurt', () => {
    delete process.env.BUNNY_STORAGE_REGION
    delete process.env.BUNNY_PLATFORM_STORAGE_REGION
    assert.equal(partnerBunnyStorageRegionCode(), 'SG')
    assert.equal(platformBunnyStorageRegionCode(), 'DE')
    assert.equal(bunnyStorageHostForRegion(partnerBunnyStorageRegionCode()), 'sg.storage.bunnycdn.com')
  })
})
