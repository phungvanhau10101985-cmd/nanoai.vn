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
  assert.match(
    src,
    /import \{[\s\S]*resolvePartnerCustomerLoyaltyStatusFromPg[\s\S]*\} from '@\/lib\/db\/messaging-partner-loyalty-pg'/
  )
})

test('cart quote pins checkout SKUs into flash assignment', () => {
  const pricing = readFileSync(
    join(repoRoot, 'src/lib/db/messaging-partner-sale-pricing-pg.ts'),
    'utf8'
  )
  assert.match(pricing, /pinInventoryIds:\s*ids/)
  assert.match(pricing, /getPartnerFlashSaleAssignmentFromPg\(/)
})

test('PDP overlay pins the single product into the same flash assignment as cart', () => {
  const src = readFileSync(
    join(repoRoot, 'src/lib/db/messaging-partner-flash-sale-pg.ts'),
    'utf8'
  )
  assert.match(src, /input\.products\.length === 1/)
  assert.match(src, /pinPartnerFlashSaleProducts\(base, pinIds/)
})

test('cart checkout button stays enabled without a live quote', () => {
  const src = readFileSync(
    join(repoRoot, 'src/components/partner-website/shop/partner-site-shop-cart-client.tsx'),
    'utf8'
  )
  assert.match(src, /disabled=\{checkoutBusy \|\| selectedItems\.length === 0\}/)
  assert.doesNotMatch(src, /disabled=\{checkoutBusy \|\| !quote \|\| selectedItems\.length === 0\}/)
  assert.match(src, /inventoryId: item\.card\.inventory_id \|\| item\.id/)
  assert.match(src, /lineQuote\?\.priceKind === 'flash'/)
  assert.match(src, /saleT\.flashDiscount/)
})
