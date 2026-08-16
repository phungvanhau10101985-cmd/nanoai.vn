import { describe, expect, it } from 'vitest'
import {
  PARTNER_SHOP_STICK_HEADER_ATTR,
  PARTNER_SHOP_STICK_HEADER_ON_CLASS,
  PARTNER_SHOP_STICK_HEADER_SCRIPT,
  PARTNER_SHOP_STICK_HEADER_SCRIPT_ID,
  PARTNER_SHOP_STICK_HEADER_SLOT_CLASS,
} from './stick-header-elements'

describe('stick-header live script', () => {
  it('pins marked elements under the shop header and can release before save', () => {
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT_ID).toBe('pw-shop-stick-header')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain(PARTNER_SHOP_STICK_HEADER_ATTR)
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('__pwStickHeaderSync')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('__pwStickHeaderRelease')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('__pwStickHeaderApply')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('__pwStickHeaderUnpin')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('__pwStickHeaderPaused')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain(PARTNER_SHOP_STICK_HEADER_ON_CLASS)
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain(PARTNER_SHOP_STICK_HEADER_SLOT_CLASS)
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).toContain('headerBottom')
    expect(PARTNER_SHOP_STICK_HEADER_SCRIPT).not.toContain('</script>')
  })
})
