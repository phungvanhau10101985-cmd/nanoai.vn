import { describe, expect, it } from 'vitest'
import {
  clampOverlayPct,
  clampPaddingPx,
  extractFirstCssUrl,
  inferVisualEditImageKind,
  replaceCssBackgroundUrl,
} from './visual-editor-css-url'
import { buildVisualEditorScript } from './build-visual-editor-script'

describe('visual-editor css url', () => {
  it('extracts url from hero gradient + image', () => {
    const css =
      "linear-gradient(90deg,rgba(249,115,22,.55),rgba(0,0,0,.25)),url('https://cdn.example/hero.jpg')"
    expect(extractFirstCssUrl(css)).toBe('https://cdn.example/hero.jpg')
  })

  it('replaces only the url() and keeps the gradient', () => {
    const css = "linear-gradient(#0000,#000),url(\"old.png\")"
    expect(replaceCssBackgroundUrl(css, 'https://cdn.example/new.jpg')).toBe(
      "linear-gradient(#0000,#000),url('https://cdn.example/new.jpg')"
    )
  })

  it('sets url when there is no existing background image', () => {
    expect(replaceCssBackgroundUrl('', 'https://cdn.example/a.png')).toBe(
      "url('https://cdn.example/a.png')"
    )
  })

  it('infers logo / banner / product kinds', () => {
    expect(inferVisualEditImageKind({ isLogo: true })).toEqual({ kind: 'logo', aspectRatio: '1:1' })
    expect(inferVisualEditImageKind({ isLogo: true, width: 160, height: 36 })).toEqual({
      kind: 'logo',
      aspectRatio: '4:1',
    })
    expect(inferVisualEditImageKind({ isBgImage: true, width: 1200, height: 400 })).toEqual({
      kind: 'banner',
      aspectRatio: '21:9',
    })
    expect(inferVisualEditImageKind({ width: 800, height: 400 })).toEqual({
      kind: 'banner',
      aspectRatio: '16:9',
    })
    expect(inferVisualEditImageKind({ width: 300, height: 480 })).toEqual({
      kind: 'product_photo',
      aspectRatio: '2:3',
    })
  })
})

describe('visual-editor runtime script', () => {
  it('includes click-to-edit hooks for images, buttons, and AI replace', () => {
    const s = buildVisualEditorScript('vi')
    expect(s).toContain('setHref')
    expect(s).toContain('isBtnEl')
    expect(s).toContain('isChromeBtn')
    expect(s).toContain('insertChromeBtn')
    expect(s).toContain('data-pw-device')
    expect(s).toContain("editDevice === 'mobile'")
    expect(s).toContain('insertText')
    expect(s).toContain('insertButton')
    expect(s).toContain('setChromeStyle')
    expect(s).toContain('setButtonStyle')
    expect(s).toContain('applyBtnStyle')
    expect(s).toContain('placeOverlayButton')
    expect(s).toContain('findBannerHost')
    expect(s).toContain('r.height / 2')
    expect(s).toContain('__nanoaiVeBound')
    expect(s).toContain('lastInsertButtonAt')
    expect(s).toContain('placeCaretAtPoint')
    expect(s).toContain('caretRangeFromPoint')
    expect(s).toContain('setButtonLabel')
    expect(s).toContain('setButtonColor')
    expect(s).toContain('setButtonBorder')
    expect(s).toContain('data-pw-btn-text')
    expect(s).toContain('data-pw-btn-border')
    expect(s).toContain('.pw-header-actions [data-pw-chrome-added]')
    expect(s).toContain('flex-direction:row!important')
    expect(s).toContain('deleteChromeBtn')
    expect(s).toContain('ensureChromeHost')
    expect(s).toContain('nanoai-ve-move-handle')
    expect(s).toContain('beginHandleDrag')
    expect(s).toContain('deleteSelectedUnit')
    expect(s).toContain('nanoai-ve-guide-h')
    expect(s).toContain('nanoai-ve-guide-v')
    expect(s).toContain('positionAlignGuides')
    expect(s).toContain('nudgeSelected')
    expect(s).toContain('selected.style.transform = \'translate(\' + (p.x + dx) + \'px,\' + (p.y + dy) + \'px)\'')
    expect(s).toContain('function nudgeSelected(dx, dy) {\n    if (!selected || !canDragEl(selected)) return\n    ensureDragDisplay(selected)\n    var p = parseTransform(selected)\n    selected.style.transform = \'translate(\' + (p.x + dx) + \'px,\' + (p.y + dy) + \'px)\'\n    positionAllHandles()')
    expect(s).toContain('stopImmediatePropagation')
    expect(s).toContain('isBgImageEl')
    expect(s).toContain('findBgImageEl')
    expect(s).toContain('if (bgHost) return bgHost')
    expect(s).toContain('nanoai-ve-layer-switch')
    expect(s).toContain('applyLayerMode')
    expect(s).toContain('heroImgIn')
    expect(s).toContain('data-pw-edit="heroImage"')
    expect(s).toContain('setLayerMode')
    expect(s).toContain('layerBlock')
    expect(s).toContain('Khối')
    expect(s).toContain('HISTORY_MAX = 30')
    expect(s).toContain('undoHistory')
    expect(s).toContain('redoHistory')
    expect(s).toContain("d.type === 'undo'")
    expect(s).toContain('(^|\\s)pw-(hero|section|')
    expect(s).not.toContain("new RegExp('pw-(hero|")
    expect(s).toContain('setImageSrc')
    expect(s).toContain('sampleSurroundingBg')
    expect(s).toContain('applyLogoToEl')
    expect(s).toContain('nanoai-ve-logo-btn')
    expect(s).toContain('logoCreate')
    expect(s).toContain('allSlots')
    expect(s).toContain('Tạo logo')
    expect(s).toContain('Tạo lại logo')
    expect(s).toContain('logoFaceOf')
    expect(s).toContain('recreateLogo')
    expect(s).toContain('startAddLogo')
    expect(s).toContain('data-pw-logo-added')
    expect(s).toContain('nanoai-ve-logo-rect')
    expect(s).toContain('finishAddLogo')
    expect(s).toContain('isTextEl(el)')
    expect(s).toContain('ensureDragDisplay')
    expect(s).toContain('hideBlock')
    expect(s).toContain('duplicateBlock')
    expect(s).toContain('setOverlay')
    expect(s).toContain('setPadding')
    expect(s).toContain('chromeSlotAtX')
    expect(s).toContain('chromeHostChildren')
    expect(s).toContain('pinChromeIconBadges')
  })
})

describe('visual-editor block clamps', () => {
  it('clamps overlay and padding', () => {
    expect(clampOverlayPct(-4)).toBe(0)
    expect(clampOverlayPct(99)).toBe(80)
    expect(clampOverlayPct(32.4)).toBe(32)
    expect(clampPaddingPx(200)).toBe(160)
    expect(clampPaddingPx(12.6)).toBe(13)
  })
})
