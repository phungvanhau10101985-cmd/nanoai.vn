import { describe, expect, it } from 'vitest'
import { buildVisualEditorScript } from './build-visual-editor-script'
import {
  PW_BG_CANVAS_INDEX,
  PW_BG_HEADER_Z,
  PW_BG_INDEX_ATTR,
  PW_BG_REGION_ROLES,
  PW_BG_ROLE_ATTR,
  isPwBgLockedRole,
  isPwBgPaintZRole,
  isPwBgRegionRole,
  parsePwBgStack,
  pwBgPaintZ,
  pwBgRoleOrder,
} from './pw-bg-stack'

describe('pw bg stack', () => {
  it('keeps canvas at layer 0 and header chrome above content', () => {
    expect(PW_BG_CANVAS_INDEX).toBe(0)
    expect(pwBgPaintZ('canvas', 0)).toBe(0)
    expect(pwBgPaintZ('header', 1)).toBe(PW_BG_HEADER_Z)
    expect(pwBgPaintZ('banner', 2)).toBe(2)
    expect(pwBgPaintZ('added', 1)).toBe(1)
    expect(isPwBgLockedRole('canvas')).toBe(true)
    expect(isPwBgLockedRole('header')).toBe(true)
    expect(isPwBgLockedRole('added')).toBe(false)
    expect(pwBgRoleOrder('canvas')).toBeLessThan(pwBgRoleOrder('banner'))
    expect(pwBgRoleOrder('footer')).toBeLessThan(pwBgRoleOrder('content'))
    expect(isPwBgRegionRole('gallery')).toBe(true)
    expect(isPwBgRegionRole('nav')).toBe(false)
    expect(isPwBgPaintZRole('banner')).toBe(true)
    expect(isPwBgPaintZRole('content')).toBe(false)
    expect(PW_BG_REGION_ROLES).toContain('content')
    expect(PW_BG_REGION_ROLES).toContain('cart-list')
  })

  it('parses stack rows from the editor payload', () => {
    const stack = parsePwBgStack([
      { index: 2, role: 'banner' },
      { index: 0, role: 'canvas', locked: true },
      { index: 1, role: 'added', current: true },
      { index: 9, role: 'nope' },
    ])
    expect(stack.map((row) => row.role)).toEqual(['canvas', 'added', 'banner'])
    expect(stack[1]?.current).toBe(true)
    expect(stack[0]?.locked).toBe(true)
  })

  it('editor stamps and steps the shared stack', () => {
    const s = buildVisualEditorScript('vi')
    expect(s).toContain('ensureBgStack')
    expect(s).toContain('stepBgStack')
    expect(s).toContain(PW_BG_INDEX_ATTR)
    expect(s).toContain(PW_BG_ROLE_ATTR)
    expect(s).toContain('data-pw-bg-role="canvas"')
    expect(s).toContain("role === 'added'")
    expect(s).toContain('bgStack:')
    expect(s).toContain('stepElementLayer')
    expect(s).toContain('data-pw-z')
    expect(s).toContain('[data-pw-region="\' + role + \'"]')
    expect(s).toContain("bgRegions[rr]")
    expect(s).toContain('paintsBgZ')
    expect(s).toContain("var regionRoles = ['header', 'banner', 'categories'")
    expect(s).not.toContain("node.setAttribute('data-pw-bg-layer'")
  })
})
