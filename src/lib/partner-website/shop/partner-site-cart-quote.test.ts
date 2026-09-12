import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '../../../../')

test('cart quote route imports payment settings used for shipping/deposit', () => {
  const src = readFileSync(join(repoRoot, 'src/app/api/site/[slug]/cart/quote/route.ts'), 'utf8')
  assert.match(
    src,
    /import \{[\s\S]*fetchPartnerPaymentSettingsFromPg[\s\S]*\} from '@\/lib\/db\/messaging-partner-orders-pg'/
  )
  assert.match(src, /fetchPartnerPaymentSettingsFromPg\(shop\.partnerId\)/)
})

test('cart checkout button stays enabled without a live quote', () => {
  const src = readFileSync(
    join(repoRoot, 'src/components/partner-website/shop/partner-site-shop-cart-client.tsx'),
    'utf8'
  )
  assert.match(src, /disabled=\{checkoutBusy \|\| selectedItems\.length === 0\}/)
  assert.doesNotMatch(src, /disabled=\{checkoutBusy \|\| !quote \|\| selectedItems\.length === 0\}/)
})
