import { describe, expect, it } from 'vitest'
import { buildVisualEditorScript } from './build-visual-editor-script'
import {
  pwSceneChromeZCss,
  PW_SCENE_ATTR,
  PW_SCENE_BAND,
  PW_SCENE_CANVAS_WIDTH,
  PW_SCENE_DEFAULT_INDEX,
  PW_SCENE_DESIGN_WIDTH,
  PW_SCENE_LAYERS,
  PW_SCENE_LOCAL_MAX,
  PW_SCENE_LOGO_Z,
  PW_SCENE_MAX_INDEX,
  PW_SCENE_MIN_INDEX,
  PW_SCENE_TOPBAR_Z,
  PW_SCENE_Z_MAX,
  clampPwSceneIndex,
  isPwSceneIndex,
  PARTNER_SHOP_IMAGE_ZOOM_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
  PW_SCENE_MEDIA_ZOOM_SEL,
  pwMediaZoomOriginYPct,
  pwSceneCanvasWidth,
  pwSceneCenterCss,
  pwSceneCssVars,
  pwSceneDesignWidth,
  pwSceneDeviceVisibilityCss,
  pwSceneIndexOfZ,
  pwSceneLayer,
  pwSceneLayerPos,
  pwSceneLocalOfZ,
  pwSceneLockForAvailableHtml,
  pwSceneLockFromWindowWidth,
  pwSceneLiveZoomScale,
  pwSceneZ,
  resolvePwSceneIndex,
  stepPwSceneZ,
} from './pw-scene'

describe('pw scene layers', () => {
  it('stacks five page-wide layers with the base at the bottom', () => {
    expect(PW_SCENE_LAYERS).toHaveLength(5)
    expect(PW_SCENE_MIN_INDEX).toBe(0)
    expect(PW_SCENE_MAX_INDEX).toBe(4)
    expect(PW_SCENE_LAYERS[0]?.base).toBe(true)
    expect(PW_SCENE_LAYERS.slice(1).every((layer) => !layer.base)).toBe(true)
    expect(PW_SCENE_LAYERS.map((layer) => layer.z)).toEqual([0, 100, 200, 300, 400])
    expect(PW_SCENE_LAYERS.map((layer) => layer.index)).toEqual([0, 1, 2, 3, 4])
    expect(new Set(PW_SCENE_LAYERS.map((layer) => layer.key)).size).toBe(PW_SCENE_LAYERS.length)
    expect(PW_SCENE_Z_MAX).toBe(PW_SCENE_MAX_INDEX * PW_SCENE_BAND + PW_SCENE_LOCAL_MAX)
    expect(PW_SCENE_TOPBAR_Z).toBeGreaterThan(PW_SCENE_LAYERS[1]!.z)
    expect(PW_SCENE_TOPBAR_Z).toBeLessThan(PW_SCENE_LOGO_Z)
    expect(PW_SCENE_LOGO_Z).toBeLessThan(PW_SCENE_LAYERS[2]!.z)
  })

  it('clamps any index into the layer range', () => {
    expect(clampPwSceneIndex(3)).toBe(3)
    expect(clampPwSceneIndex(-4)).toBe(PW_SCENE_MIN_INDEX)
    expect(clampPwSceneIndex(99)).toBe(PW_SCENE_MAX_INDEX)
    expect(clampPwSceneIndex('2')).toBe(2)
    expect(clampPwSceneIndex('abc')).toBe(PW_SCENE_DEFAULT_INDEX)
    expect(clampPwSceneIndex(null)).toBe(PW_SCENE_MIN_INDEX)
    expect(isPwSceneIndex(0)).toBe(true)
    expect(isPwSceneIndex(4)).toBe(true)
    expect(isPwSceneIndex(5)).toBe(false)
    expect(isPwSceneIndex(1.5)).toBe(false)
    expect(isPwSceneIndex('')).toBe(false)
    expect(pwSceneLayer(2).key).toBe('giua')
    expect(pwSceneLayer(77).index).toBe(PW_SCENE_MAX_INDEX)
  })

  it('derives the layer from legacy data-pw-z so old HTML needs no migration', () => {
    expect(pwSceneIndexOfZ(0)).toBe(0)
    expect(pwSceneIndexOfZ(15)).toBe(0)
    expect(pwSceneIndexOfZ(160)).toBe(1)
    expect(pwSceneIndexOfZ(200)).toBe(2)
    expect(pwSceneIndexOfZ(250)).toBe(2)
    expect(pwSceneIndexOfZ(400)).toBe(4)
    expect(pwSceneIndexOfZ(9999)).toBe(PW_SCENE_MAX_INDEX)
    expect(pwSceneIndexOfZ(-20)).toBe(0)
    expect(pwSceneLocalOfZ(250)).toBe(50)
    expect(pwSceneLocalOfZ(160)).toBe(60)
    expect(pwSceneLocalOfZ(0)).toBe(0)
    expect(pwSceneLocalOfZ(-9)).toBe(0)
    expect(pwSceneLocalOfZ(9999)).toBe(PW_SCENE_LOCAL_MAX)
  })

  it('round-trips layer plus local order through z', () => {
    for (const layer of PW_SCENE_LAYERS) {
      for (const local of [0, 1, 42, PW_SCENE_LOCAL_MAX]) {
        const z = pwSceneZ(layer.index, local)
        expect(pwSceneIndexOfZ(z)).toBe(layer.index)
        expect(pwSceneLocalOfZ(z)).toBe(local)
      }
    }
    expect(pwSceneZ(2, 50)).toBe(250)
    expect(pwSceneZ(2, 999)).toBe(299)
    expect(pwSceneZ(9, 0)).toBe(400)
    expect(pwSceneZ(-3, 10)).toBe(10)
  })

  it('reads the explicit layer attribute before falling back to z', () => {
    expect(resolvePwSceneIndex(3, 250)).toBe(3)
    expect(resolvePwSceneIndex('1', 250)).toBe(1)
    expect(resolvePwSceneIndex('noi', 0)).toBe(4)
    expect(resolvePwSceneIndex('nen', 250)).toBe(0)
    expect(resolvePwSceneIndex('', 250)).toBe(2)
    expect(resolvePwSceneIndex(null, 160)).toBe(1)
    expect(resolvePwSceneIndex(null, null)).toBe(PW_SCENE_DEFAULT_INDEX)
    expect(resolvePwSceneIndex('', '')).toBe(PW_SCENE_DEFAULT_INDEX)
  })

  it('moves an element one layer at a time and keeps its order inside the layer', () => {
    expect(stepPwSceneZ(250, 1)).toBe(350)
    expect(stepPwSceneZ(250, -1)).toBe(150)
    expect(pwSceneLocalOfZ(stepPwSceneZ(250, 1) as number)).toBe(50)
    expect(stepPwSceneZ(400, 1)).toBeNull()
    expect(stepPwSceneZ(150, -1)).toBeNull()
    expect(stepPwSceneZ(30, -1)).toBeNull()
    expect(stepPwSceneZ(430, 1)).toBeNull()
  })

  it('reports where the element sits in the stack', () => {
    expect(pwSceneLayerPos(0)).toBe('bottom')
    expect(pwSceneLayerPos(1)).toBe('bottom')
    expect(pwSceneLayerPos(2)).toBe('middle')
    expect(pwSceneLayerPos(4)).toBe('top')
    expect(pwSceneLayerPos(99)).toBe('top')
  })

  // Ba số này phải trùng VISUAL_*_PREVIEW_PX — visual-editor-pages.test.ts khoá lại quan hệ đó.
  it('pins each layer to the same fixed width as the Sửa nhanh iframe', () => {
    expect(PW_SCENE_DESIGN_WIDTH.mobile).toBe(390)
    expect(PW_SCENE_DESIGN_WIDTH.tablet).toBe(768)
    expect(PW_SCENE_DESIGN_WIDTH.laptop).toBe(1280)
    expect(PW_SCENE_DESIGN_WIDTH.desktop).toBe(1280)
    expect(pwSceneDesignWidth('mobile')).toBe(390)
    expect(pwSceneDesignWidth('tablet')).toBe(768)
    expect(pwSceneDesignWidth('desktop')).toBe(1280)
    expect(pwSceneDesignWidth('laptop')).toBe(1280)
    expect(pwSceneDesignWidth(undefined)).toBe(1280)
    expect(pwSceneCssVars('mobile')).toBe('--pw-scene-w:390px')
    expect(pwSceneCssVars('laptop')).toBe('--pw-scene-w:1280px')
    expect(pwSceneCssVars('desktop')).toBe('--pw-scene-w:1440px')
    expect(PW_SCENE_CANVAS_WIDTH.mobile).toBe(390)
    expect(PW_SCENE_CANVAS_WIDTH.tablet).toBe(768)
    expect(PW_SCENE_CANVAS_WIDTH.laptop).toBe(1280)
    expect(PW_SCENE_CANVAS_WIDTH.desktop).toBe(1440)
    expect(pwSceneCanvasWidth('desktop')).toBe(1440)
    expect(pwSceneCenterCss()).toContain('html[data-pw-edit-device="mobile"],html[data-pw-scene-lock="mobile"]{--pw-scene-w:390px}')
    expect(pwSceneCenterCss()).toContain('html[data-pw-edit-device="laptop"],html[data-pw-scene-lock="laptop"]{--pw-scene-w:1280px}')
    expect(pwSceneCenterCss()).toContain('html[data-pw-edit-device] body{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important')
    expect(pwSceneCenterCss()).toContain('[data-pw-inline-visual-root]{width:var(--pw-scene-w)!important')
    expect(pwSceneCenterCss()).toContain('transform:scale(var(--pw-scene-zoom,1))')
    expect(pwSceneCenterCss()).toContain('main:has([data-pw-inline-visual-root]){width:100%!important')
    expect(pwSceneCenterCss()).toContain('transform-origin:top center')
    expect(pwSceneCenterCss()).toContain(PW_SCENE_MEDIA_ZOOM_SEL)
    expect(pwSceneCenterCss()).toContain('transform-origin:50% var(--pw-zoom-oy,50%)')
    expect(pwMediaZoomOriginYPct(0, 400, 800)).toBe(100)
    expect(pwMediaZoomOriginYPct(0, 400, 400)).toBe(50)
    expect(pwSceneLockFromWindowWidth(390)).toBe('mobile')
    expect(pwSceneLockFromWindowWidth(767)).toBe('mobile')
    expect(pwSceneLockFromWindowWidth(768)).toBe('tablet')
    expect(pwSceneLockFromWindowWidth(1279)).toBe('tablet')
    expect(pwSceneLockFromWindowWidth(1280)).toBe('laptop')
    expect(pwSceneLockFromWindowWidth(1439)).toBe('laptop')
    expect(pwSceneLockFromWindowWidth(1440)).toBe('desktop')
    expect(pwSceneLockFromWindowWidth(1920)).toBe('desktop')
    expect(pwSceneLiveZoomScale(1920, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(1900, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(3840, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(3840, 3840, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(1200, 1220, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(960, 1920)).toBe(1)
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('data-pw-banner-pan-y')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain("object-position")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain('translate(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('scale(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain("Math.round(z*100)+'% auto'")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain('scaleY(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain("'100% '+Math.round(z*100)+'%'")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('visualViewport')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-scene-lock')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('Math.max(outer,inner)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("style.setProperty('--pw-scene-w'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("style.setProperty('--pw-scene-zoom'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function zoomScale(){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('return 1;')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).not.toContain('ratio>1.04')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("querySelector('.pw-visual-'+k+',[data-pw-visual-device=\"'+k+'\"]')")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function pick(preferred)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('[data-pw-added-bg="1"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("sc==='2'||sc==='3'||sc==='4'")
    expect(pwSceneDeviceVisibilityCss()).toContain(
      'html[data-pw-scene-lock="laptop"]:has(.pw-visual-laptop) .pw-visual-desktop'
    )
    expect(pwSceneDeviceVisibilityCss()).toContain(
      'html[data-pw-scene-lock="laptop"]:has(.pw-visual-laptop) .pw-visual-tablet'
    )
    expect(pwSceneDeviceVisibilityCss()).not.toContain(
      'html[data-pw-scene-lock="laptop"]:has(.pw-visual-laptop) .pw-visual-desktop,.pw-visual-tablet'
    )
    expect(pwSceneLockForAvailableHtml('laptop', {
      querySelector: (sel: string) => (sel.includes('pw-visual-desktop') ? {} : null),
    })).toBe('desktop')
    expect(pwSceneLockForAvailableHtml('laptop', {
      querySelector: (sel: string) => (sel.includes('pw-visual-laptop') ? {} : null),
    })).toBe('laptop')
    expect(pwSceneLockForAvailableHtml('tablet', {
      querySelector: (sel: string) =>
        sel.includes('pw-visual-desktop') || sel.includes('pw-visual-mobile') ? {} : null,
    })).toBe('desktop')
    expect(pwSceneLockForAvailableHtml('mobile', {
      querySelector: (sel: string) =>
        sel.includes('pw-visual-desktop') || sel.includes('pw-visual-mobile') ? {} : null,
    })).toBe('mobile')
    expect(pwSceneLockForAvailableHtml('laptop', { querySelector: () => null })).toBe(null)
  })

  it('keeps the attribute name away from the background stack attributes', () => {
    expect(PW_SCENE_ATTR).toBe('data-pw-scene')
    expect(PW_SCENE_ATTR).not.toBe('data-pw-layer')
    expect(PW_SCENE_ATTR).not.toBe('data-pw-bg-index')
    expect(PW_SCENE_ATTR).not.toBe('data-pw-bg-layer')
  })

  it('gives chrome widgets on lớp nổi a scene-band z above lớp dưới backgrounds', () => {
    const css = pwSceneChromeZCss()
    expect(css).toContain('[data-pw-chrome-btn][data-pw-scene="4"]')
    expect(css).toContain('[data-pw-chrome-added][data-pw-scene="4"]')
    expect(css).toContain(`z-index:${pwSceneZ(2)}!important`)
    expect(css).toContain(`z-index:${pwSceneZ(4)}!important`)
    expect(pwSceneZ(4)).toBeGreaterThan(100)
  })
})

describe('scene layers inside the editor runtime', () => {
  const script = buildVisualEditorScript('vi')

  it('receives the shared layer constants instead of copying the numbers', () => {
    expect(script).toContain('(function (MSG, COPY, SCENE)')
    expect(script).toContain(`"attr":"${PW_SCENE_ATTR}"`)
    expect(script).toContain(`"band":${PW_SCENE_BAND}`)
    expect(script).toContain(`"maxIndex":${PW_SCENE_MAX_INDEX}`)
    expect(script).toContain(`"zMax":${PW_SCENE_Z_MAX}`)
    expect(script).toContain(`"defaultIndex":${PW_SCENE_DEFAULT_INDEX}`)
    expect(script).toContain('"keys":["nen","duoi","giua","tren","noi"]')
    // Dải z cũ khoá cứng ở 400 sẽ cắt mất lớp trên cùng.
    expect(script).not.toContain('Math.min(400, Math.round(Number(z) || 0))')
  })

  it('handles the layer commands and reports the layer on select', () => {
    expect(script).toContain('readSceneIndex')
    expect(script).toContain('writeSceneIndex')
    expect(script).toContain('setElementScene')
    expect(script).toContain('stepElementScene')
    expect(script).toContain("d.type === 'setScene'")
    expect(script).toContain("d.type === 'sceneUp'")
    expect(script).toContain("d.type === 'sceneDown'")
    expect(script).toContain("d.type === 'setSceneFocus'")
    expect(script).toContain('scene: readSceneIndex(')
    expect(script).toContain('sceneFocus: sceneFocus')
  })

  it('moves the whole bottom navigation when a bottom nav item changes scene layer', () => {
    expect(script).toContain("unit.closest ? unit.closest('.pw-bottom-nav, .pw-shop-bottom-nav') : null")
    expect(script).toContain('if (bottomNav) return bottomNav')
  })

  it('filters clicks to the selected scene layer', () => {
    expect(script).toContain('sceneFocusAllows')
    expect(script).toContain('if (!sceneFocusAllows(n)) continue')
    expect(script).toContain('return readSceneIndex(el) === sceneFocus')
    expect(script).toContain('var sceneFocus = -1')
  })

  it('keeps the existing per-region z order working alongside the page-wide layers', () => {
    expect(script).toContain('stepElementLayer')
    expect(script).toContain('data-pw-z')
    expect(script).toContain("d.type === 'layerElUp'")
    expect(script).toContain("d.type === 'layerElDown'")
  })

  it('puts the orange topbar above lớp dưới so a lowered logo sits behind the bar', () => {
    expect(script).toContain(
      `.pw-topbar,.nanoai-ve-active .pw-shop-topbar,[data-pw-region="topbar"]{position:relative!important;z-index:${PW_SCENE_TOPBAR_Z}!important;isolation:isolate;display:block!important;width:100%!important;min-width:100%!important;max-width:none!important;left:auto!important`,
    )
    expect(script).toContain('.pw-logo-frame:not([data-pw-z])')
    expect(script).not.toContain('.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;z-index:160!important')
  })

  it('reapplies authored banner text layers after stamp so raised copy stays above the photo', () => {
    expect(script).toContain('restoreAuthoredLayers')
    expect(script).toContain('applyDefaultZ(el, 2)')
    expect(script).not.toContain("el.style.zIndex = '2'")
  })

  it('writes scene on the chrome widget itself and lifts it out of header isolation', () => {
    expect(script).toContain('sceneWriteHost')
    expect(script).toContain('applySceneToLooseChrome')
    expect(script).toContain('liftLooseElToSceneHost')
    expect(script).toContain('chromeLeftChromeHost')
    expect(script).toContain('isInFlowFooterLink')
    expect(script).toContain('unstampFooterInFlowChrome')
    expect(script).toContain('var el = sceneWriteHost(selected)')
    expect(script).toContain(JSON.stringify(pwSceneChromeZCss()))
    expect(script).toContain('[data-pw-chrome-btn][data-pw-scene=\\"4\\"]')
    expect(script).toContain(`z-index:${pwSceneZ(4)}!important`)
    expect(script).toContain("place === 'canvas'")
    expect(script).toContain('shouldSnapChromeToBar')
    expect(script).toContain('if (isAddedChrome(el)) return false')
    expect(script).toContain('writeSceneIndex(node, SCENE.defaultIndex)')
    expect(script).toContain('liftLooseElToSceneHost(node)')
    expect(script).toContain('[data-pw-chrome-btn]:not([data-pw-scene])')
    expect(script).toContain('[data-pw-chrome-added]:not([data-pw-scene])')
  })
})
