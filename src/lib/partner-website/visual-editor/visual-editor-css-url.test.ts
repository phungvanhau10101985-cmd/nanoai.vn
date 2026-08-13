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
    expect(inferVisualEditImageKind({ isBgImage: true, width: 1200, height: 400 })).toEqual({
      kind: 'banner',
      aspectRatio: '16:9',
    })
    expect(inferVisualEditImageKind({ width: 800, height: 400 })).toEqual({
      kind: 'banner',
      aspectRatio: '16:9',
    })
    expect(inferVisualEditImageKind({ width: 300, height: 480 })).toEqual({
      kind: 'product_photo',
      aspectRatio: '3:4',
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
    expect(s).toContain('deleteChromeBtn')
    expect(s).toContain('ensureChromeHost')
    expect(s).toContain('nanoai-ve-move-handle')
    expect(s).toContain('beginHandleDrag')
    expect(s).toContain('deleteSelectedUnit')
    expect(s).toContain('nanoai-ve-guide-h')
    expect(s).toContain('nanoai-ve-guide-v')
    expect(s).toContain('positionAlignGuides')
    expect(s).toContain('nudgeSelected')
    expect(s).toContain('stopImmediatePropagation')
    expect(s).toContain('isBgImageEl')
    expect(s).toContain('setImageSrc')
    expect(s).toContain('isTextEl(el)')
    expect(s).toContain('ensureDragDisplay')
    expect(s).toContain('hideBlock')
    expect(s).toContain('duplicateBlock')
    expect(s).toContain('setOverlay')
    expect(s).toContain('setPadding')
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
