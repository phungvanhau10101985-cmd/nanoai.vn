import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PARTNER_LIVE_HOIST_HOST_SEL,
  dedupePartnerShopLiveHeaders,
  stripPartnerLiveChromeHosts,
  stripPartnerLiveHoistHosts,
} from '@/lib/partner-website/shop/strip-partner-live-hoist-hosts'

function fakeEl() {
  return {
    removed: false,
    remove() {
      this.removed = true
    },
  }
}

function fakeDoc(bySel: Record<string, Array<ReturnType<typeof fakeEl>>>) {
  return {
    querySelectorAll(sel: string) {
      return sel
        .split(',')
        .flatMap((part) => bySel[part.trim()] || [])
    },
  } as unknown as ParentNode
}

test('stripPartnerLiveHoistHosts removes leftover visual-home chrome hosts', () => {
  const chrome = fakeEl()
  const dock = fakeEl()
  const floatLayer = fakeEl()
  stripPartnerLiveHoistHosts(
    fakeDoc({
      '[data-pw-live-chrome]': [chrome],
      '[data-pw-live-dock]': [dock],
      '[data-pw-live-fixed-layer]': [floatLayer],
    })
  )
  assert.equal(PARTNER_LIVE_HOIST_HOST_SEL, '[data-pw-live-chrome],[data-pw-live-dock],[data-pw-live-fixed-layer]')
  assert.equal(chrome.removed, true)
  assert.equal(dock.removed, true)
  assert.equal(floatLayer.removed, true)
})

test('stripPartnerLiveChromeHosts keeps dock and float layers', () => {
  const chrome = fakeEl()
  const floatLayer = fakeEl()
  stripPartnerLiveChromeHosts(
    fakeDoc({
      '[data-pw-live-chrome]': [chrome],
      '[data-pw-live-fixed-layer]': [floatLayer],
    })
  )
  assert.equal(chrome.removed, true)
  assert.equal(floatLayer.removed, false)
})

test('dedupePartnerShopLiveHeaders keeps the React shop header and drops extras', () => {
  const keep = fakeEl() as ReturnType<typeof fakeEl> & {
    closest?: (sel: string) => object | null
    querySelectorAll?: (sel: string) => unknown[]
  }
  const extra = fakeEl() as ReturnType<typeof fakeEl> & {
    closest?: (sel: string) => object | null
    querySelectorAll?: (sel: string) => unknown[]
  }
  keep.closest = (sel: string) => (sel === '.pw-shop' ? keep : null)
  keep.querySelectorAll = () => []
  extra.closest = (sel: string) => (sel === '[data-pw-live-chrome]' ? extra : null)
  extra.querySelectorAll = () => []
  const shopHeaders = [keep, extra]
  dedupePartnerShopLiveHeaders(
    fakeDoc({
      'header.pw-header': shopHeaders,
      'header.pw-shop-header': [],
      '.pw-header[data-pw-region="header"]': [],
      '.pw-shop-header[data-pw-region="header"]': [],
    })
  )
  assert.equal(keep.removed, false)
  assert.equal(extra.removed, true)
})
