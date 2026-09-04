import { describe, expect, it } from 'vitest'
import { buildVisualEditorScript } from './build-visual-editor-script'
import {
  PW_BG_CANVAS_INDEX,
  PW_BG_CLEARED_ATTR,
  PW_BG_CLEARED_CSS,
  PW_PAPER_ATTR,
  PW_PAPER_CSS,
  PW_PAPER_POS_X_ATTR,
  PW_LAST_MEDIA_SRC_ATTR,
  PW_MEDIA_HIDDEN_ATTR,
  PW_PAPER_SRC_ATTR,
  PW_PAPER_TILE_ATTR,
  PW_BG_HEADER_Z,
  PW_BG_INDEX_ATTR,
  PW_BG_REGION_ROLES,
  PW_BG_ROLE_ATTR,
  isPwBgLockedRole,
  isPwBgPaintZRole,
  isPwBgRegionRole,
  parsePwBgStack,
  paperImageNeedsTile,
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
    expect(isPwBgPaintZRole('content')).toBe(true)
    expect(isPwBgPaintZRole('gallery')).toBe(true)
    expect(isPwBgPaintZRole('pdp-info')).toBe(true)
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
    expect(s).toContain("role === 'gallery'")
    expect(s).toContain('growCanvasForAbsEl')
    expect(s).toContain('bakeTranslateToBox')
    expect(s).toContain('insertBgInFlow')
    expect(s).toContain('insertInFlowAtAnchor')
    expect(s).toContain('function applyMidInsertGap')
    expect(s).toContain('data-pw-mid-gap')
    expect(s).toContain('setBlockSize')
    expect(s).toContain('function stampAddedBgBox(')
    expect(s).toContain('--pw-added-bg-w')
    expect(s).toContain('--pw-added-bg-h')
    expect(s).toContain('data-pw-block-h')
    expect(s).toContain('listInsertGapUnits')
    expect(s).toContain('gapUnits')
    expect(s).toContain('applyInsertAnchorIndex')
    expect(s).toContain('data-pw-added-bg-slot')
    expect(s).toContain("place === 'before'")
    expect(s).toContain('startInsertBgPick')
    expect(s).toContain('cancelInsertBgPick')
    expect(s).toContain('finishInsertBgPick')
    expect(s).toContain('nanoai-ve-bg-pick')
    expect(s).toContain('paintInsertBgPickCursor')
    expect(s).toContain('nanoai-ve-bg-pick-cursor')
    expect(s).toContain('insertBgPickCursor')
    expect(s).toContain('Chọn phần tử mốc')
    expect(s).not.toContain('host.style.paddingLeft')
    expect(s).toContain('if (isAddedBg(el))')
    expect(s).toContain("var regionRoles = ['header', 'topbar', 'banner', 'categories'")
    expect(s).not.toContain("node.setAttribute('data-pw-bg-layer'")
    expect(s).toContain('canClearRegionFill')
    expect(s).toContain('regionFillTarget')
    expect(s).toContain('clearRegionFill')
    expect(s).toContain("d.type === 'clearRegionFill'")
    expect(s).toContain('canClearBg:')
    expect(s).toContain(PW_BG_CLEARED_ATTR)
    expect(s).toContain('isPaperHost')
    expect(s).toContain('fillHostOf')
    expect(s).toContain('if (isPaperHost(n)) return n')
    expect(s).toContain('if (isPaperHost(walk) && walk === el) return walk')
    expect(s).toContain('applyPaperImage')
    expect(s).toContain('hydratePaperTiles')
    expect(s).toContain('syncPaperTile')
    expect(s).toContain(PW_PAPER_TILE_ATTR)
    expect(s).toContain('applyPaperPan')
    expect(s).toContain('parsePaperPan')
    expect(s).toContain('clearPaperImage')
    expect(s).toContain(PW_PAPER_ATTR)
    expect(s).toContain(PW_PAPER_SRC_ATTR)
    expect(s).toContain(PW_LAST_MEDIA_SRC_ATTR)
    expect(s).toContain(PW_MEDIA_HIDDEN_ATTR)
    expect(s).toContain('function stashLastMedia(el)')
    expect(s).toContain('function restoreLastMedia(el)')
    expect(s).toContain("d.type === 'restoreLastMedia'")
    expect(s).toContain('lastMediaSrc:')
    expect(s).toContain(PW_PAPER_POS_X_ATTR)
    expect(s).toContain("d.type === 'setPaperWhite'")
    expect(s).toContain("d.type === 'setPaperPan'")
    expect(s).toContain('isPaper:')
    expect(s).toContain('paperMode:')
    expect(s).toContain('canDeleteRegionBlock')
    expect(s).toContain('removeSelectedRegionBlock')
    expect(s).toContain('topbarHostOf')
    expect(s).toContain('headerHostOf')
    expect(s).toContain('regionBlockHostOf')
  })

  it('cleared region fill css keeps the block and drops the color', () => {
    expect(PW_BG_CLEARED_ATTR).toBe('data-pw-bg-cleared')
    expect(PW_BG_CLEARED_CSS).toContain(`${PW_BG_CLEARED_ATTR}="1"`)
    expect(PW_BG_CLEARED_CSS).toContain('background-color:transparent!important')
    expect(PW_BG_CLEARED_CSS).toContain('[data-pw-region="header"]')
    expect(PW_BG_CLEARED_CSS).toContain('[data-pw-region="topbar"]')
    expect(PW_BG_CLEARED_CSS).toContain('[data-pw-region="footer"]')
    expect(PW_BG_CLEARED_CSS).toContain('.pw-footer')
  })

  it('content paper can be white or a cover image', () => {
    expect(PW_PAPER_ATTR).toBe('data-pw-paper')
    expect(PW_PAPER_SRC_ATTR).toBe('data-pw-paper-src')
    expect(PW_PAPER_CSS).toContain(`${PW_PAPER_ATTR}="image"`)
    expect(PW_PAPER_CSS).toContain('background-size:cover!important')
    expect(PW_PAPER_CSS).toContain('--pw-paper-pos-x')
    expect(PW_PAPER_CSS).toContain('var(--pw-paper-pos-x,50%)')
    expect(PW_PAPER_CSS).not.toContain('background-position:center center!important')
    expect(PW_PAPER_CSS).toContain(`${PW_PAPER_ATTR}="white"`)
    expect(PW_PAPER_CSS).toContain('background-image:none!important')
    expect(PW_LAST_MEDIA_SRC_ATTR).toBe('data-pw-last-media-src')
    expect(PW_MEDIA_HIDDEN_ATTR).toBe('data-pw-media-hidden')
    expect(PW_PAPER_CSS).toContain(`${PW_MEDIA_HIDDEN_ATTR}="1"`)
    expect(PW_PAPER_TILE_ATTR).toBe('data-pw-paper-tile')
    expect(PW_PAPER_CSS).toContain(`${PW_PAPER_TILE_ATTR}="1"`)
    expect(PW_PAPER_CSS).toContain('background-repeat:repeat!important')
    expect(paperImageNeedsTile(120, 80, 1440, 220)).toBe(true)
    expect(paperImageNeedsTile(400, 80, 1440, 80)).toBe(true)
    expect(paperImageNeedsTile(2000, 1200, 1440, 400)).toBe(false)
    expect(paperImageNeedsTile(0, 80, 1440, 220)).toBe(false)
  })
})
