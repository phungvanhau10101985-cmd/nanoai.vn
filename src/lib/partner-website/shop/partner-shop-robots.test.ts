import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRobotsPublicOrigin } from '@/lib/partner-website/shop/partner-shop-robots'

test('robots origin uses the shop host on a custom domain', () => {
  assert.equal(
    resolveRobotsPublicOrigin({ customDomainHost: 'gudo.vn', platformOrigin: 'https://nanoai.vn' }),
    'https://gudo.vn'
  )
  assert.equal(
    resolveRobotsPublicOrigin({ customDomainHost: 'www.gudo.vn', platformOrigin: 'https://nanoai.vn' }),
    'https://gudo.vn'
  )
})

test('robots origin reads the shop host when /robots.txt is not rewritten', () => {
  assert.equal(
    resolveRobotsPublicOrigin({
      customDomainHost: '',
      requestHost: 'gudo.vn',
      platformOrigin: 'https://nanoai.vn',
    }),
    'https://gudo.vn'
  )
  assert.equal(
    resolveRobotsPublicOrigin({
      customDomainHost: '',
      requestHost: 'www.gudo.vn:443',
      platformOrigin: 'https://nanoai.vn',
    }),
    'https://gudo.vn'
  )
})

test('robots origin stays on the platform when there is no custom domain', () => {
  assert.equal(
    resolveRobotsPublicOrigin({ customDomainHost: '', platformOrigin: 'https://nanoai.vn/' }),
    'https://nanoai.vn'
  )
  assert.equal(
    resolveRobotsPublicOrigin({ customDomainHost: null, platformOrigin: 'https://nanoai.vn' }),
    'https://nanoai.vn'
  )
  assert.equal(
    resolveRobotsPublicOrigin({
      customDomainHost: '',
      requestHost: 'nanoai.vn',
      platformOrigin: 'https://nanoai.vn',
    }),
    'https://nanoai.vn'
  )
  assert.equal(
    resolveRobotsPublicOrigin({
      customDomainHost: '',
      requestHost: 'localhost:3000',
      platformOrigin: 'http://localhost:3000',
    }),
    'http://localhost:3000'
  )
})
