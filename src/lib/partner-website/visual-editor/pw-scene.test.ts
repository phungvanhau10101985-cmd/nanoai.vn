import { describe, expect, it } from 'vitest'
import { buildVisualEditorScript } from './build-visual-editor-script'
import {
  pwSceneChromeZCss,
  pwSceneHeadStackCss,
  pwSceneHoistLayerChildZCss,
  pwSceneUnifiedStackCss,
  PW_SCENE_ATTR,
  PW_SCENE_BAND,
  PW_SCENE_CANVAS_WIDTH,
  PW_SCENE_DEFAULT_INDEX,
  PW_SCENE_DESIGN_WIDTH,
  PW_SCENE_HEAD_Z,
  PW_SCENE_LAYERS,
  PW_SCENE_LOCAL_MAX,
  PW_SCENE_LOGO_Z,
  PW_SCENE_MAX_INDEX,
  PW_SCENE_MIN_INDEX,
  PW_SCENE_TOPBAR_Z,
  PW_SCENE_Z_MAX,
  clampPwSceneIndex,
  isPwSceneIndex,
  PARTNER_SHOP_BANNER_LIVE_MATCH_CSS,
  PARTNER_SHOP_HROW_CSS,
  PARTNER_SHOP_STACK_FLOW_CSS,
  PARTNER_SHOP_IMAGE_ZOOM_SCRIPT,
  PARTNER_SHOP_SCENE_CENTER_SCRIPT,
  PW_SCENE_MEDIA_ZOOM_SEL,
  pwMediaZoomOriginYPct,
  pwSceneCanvasWidth,
  pwSceneCenterCss,
  pwSceneCssVars,
  pwSceneDesignWidth,
  pwHostPrefixCss,
  pwSceneChromeAddedVisibilityCss,
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
    expect(PW_SCENE_HEAD_Z).toBe(PW_SCENE_Z_MAX + 1)
    expect(PW_SCENE_HEAD_Z).toBeGreaterThan(pwSceneZ(4, PW_SCENE_LOCAL_MAX))
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
    expect(PW_SCENE_DESIGN_WIDTH.desktop).toBe(1440)
    expect(pwSceneDesignWidth('mobile')).toBe(390)
    expect(pwSceneDesignWidth('tablet')).toBe(768)
    expect(pwSceneDesignWidth('desktop')).toBe(1440)
    expect(pwSceneDesignWidth('laptop')).toBe(1280)
    expect(pwSceneDesignWidth(undefined)).toBe(1440)
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
    expect(pwSceneCenterCss()).toContain('min-resolution:1.25dppx')
    expect(pwSceneCenterCss()).toContain('html[data-pw-edit-device] body.nanoai-ve-active{width:var(--pw-scene-w)!important;min-width:var(--pw-scene-w)!important;max-width:none!important;margin-left:calc(50% - (var(--pw-scene-w) / 2))!important')
    expect(pwSceneCenterCss()).toContain('[data-pw-inline-visual-root]{width:var(--pw-scene-w)!important')
    expect(pwSceneCenterCss()).toContain('min-height:0!important;height:auto!important')
    expect(pwSceneCenterCss()).toContain('transform:none;display:block}')
    expect(pwSceneCenterCss()).toContain('html[data-pw-scene-zoomed="1"] [data-pw-inline-visual-root]{transform:scale(var(--pw-scene-zoom,1))}')
    expect(pwSceneCenterCss()).toContain('transform:scale(var(--pw-scene-zoom,1))')
    expect(pwSceneCenterCss()).toContain('transform-origin:top center')
    expect(pwSceneCenterCss()).not.toContain('transform-origin:top left')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-chrome]')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-chrome-scale]')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-chrome-ph]{display:none!important;height:0!important')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-dock]')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-dock]>.pw-bottom-nav')
    expect(pwSceneCenterCss()).toContain('html[data-pw-scene-lock="mobile"] [data-pw-live-dock]>.pw-bottom-nav')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-fixed-layer]')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-fixed-layer]{display:contents}')
    expect(pwSceneCenterCss()).not.toContain('[data-pw-live-fixed-layer]{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:210}')
    expect(pwSceneCenterCss()).not.toContain('[data-pw-live-fixed-layer]{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100}')
    expect(pwSceneCenterCss()).not.toContain('z-index:210')
    expect(pwSceneCenterCss()).toContain('[data-pw-live-fixed-layer]>[data-pw-scene="4"]{z-index:400!important}')
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
    expect(pwSceneLockFromWindowWidth(1280, { devicePixelRatio: 1.5 })).toBe('desktop')
    expect(pwSceneLockFromWindowWidth(1280, { devicePixelRatio: 2 })).toBe('laptop')
    expect(pwSceneLockFromWindowWidth(1440)).toBe('desktop')
    expect(pwSceneLockFromWindowWidth(1920)).toBe('desktop')
    expect(pwSceneLiveZoomScale(1920, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(1900, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(3840, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(3840, 3840, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(1200, 1220, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(960, 1920)).toBe(1)
    expect(pwSceneLiveZoomScale(1920, 1920, 1920, 1440)).toBe(1920 / 1440)
    expect(pwSceneLiveZoomScale(1366, 1366, 1366, 1440)).toBe(1366 / 1440)
    expect(pwSceneLiveZoomScale(390, 390, 390, 390)).toBe(1)
    expect(pwSceneLiveZoomScale(1152, 1440, 1920, 1440)).toBe(1)
    expect(pwSceneLiveZoomScale(1536, 1920, 1920, 1440)).toBe(1920 / 1440)
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('data-pw-banner-pan-y')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain("object-position")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain('translate(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('scale(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain("Math.round(z*100)+'% auto'")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain('scaleY(')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).not.toContain("'100% '+Math.round(z*100)+'%'")
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('visualViewport')
    expect(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT).toContain('/scale(?:Y)?\\(\\s*([\\d.]+)/')
    expect(() => new Function(PARTNER_SHOP_IMAGE_ZOOM_SCRIPT)).not.toThrow()
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-scene-lock')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('C.resolveDevice')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('devicePixelRatio:window.devicePixelRatio||0')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("style.setProperty('--pw-scene-w'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("style.setProperty('--pw-scene-zoom'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-scene-zoomed')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function zoomScale(scenePx,key){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('return 1;')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function hoistLiveChrome(root,scale){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('return outside||inside;')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function hoistLiveDock(root){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function pinPdpDockFaceLive(){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('.pw-pdp-sticky-ctas')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('header [data-pw-chrome-btn="try-on"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('header [data-pw-chrome-btn="favorite-product"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('main > .pw-shop-btn[data-pw-chrome-btn="try-on"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('.pw-pdp-actions-inline,.pw-pdp-actions')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('pinPdpDockFaceLive();')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('.pw-pdp-actions-inline')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain(':scope > .pw-pdp-sticky-nav')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function hoistLiveFloat(root){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function findLiveFloatKit(root){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('hoistLiveFloat(root)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('z>1&&h>0')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("root.style.removeProperty('margin-bottom')")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function hoistLiveOverlays(){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('var isPdp=(el.getAttribute&&el.getAttribute(\'data-pw-pdp-bottom\')===\'1\')')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-live-chrome')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-live-dock')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('[data-pw-chrome-kit="float"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("closest('header,.pw-header,.pw-shop-header,[data-pw-live-chrome],[data-pw-live-dock],[data-pw-chrome-kit=\"float\"],[data-pw-chrome-float-host=\"1\"],.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-actions,.pw-pdp-sticky,[data-pw-pdp-bottom]')")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('nanoai-ve-active')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-live-fixed-layer')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-canvas-x')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-canvas-xu')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("setAttribute('data-pw-edit-device'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('__pwSceneCenterApply')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).not.toContain('ratio>1.04')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("querySelector('.pw-visual-'+k+',[data-pw-visual-device=\"'+k+'\"]')")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function pick(preferred)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('[data-pw-added-bg="1"]')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("sc==='2'||sc==='3'||sc==='4'")
    expect(pwHostPrefixCss(['html[data-pw-edit-device="mobile"]'], '.pw-header-main{padding:8px}')).toBe(
      'html[data-pw-edit-device="mobile"] .pw-header-main{padding:8px}'
    )
    expect(pwSceneChromeAddedVisibilityCss()).toContain(
      'html[data-pw-edit-device="mobile"] [data-pw-chrome-added]'
    )
    expect(pwSceneChromeAddedVisibilityCss()).toContain(
      'html[data-pw-scene-lock="mobile"] [data-pw-chrome-added]'
    )
    expect(pwSceneChromeAddedVisibilityCss()).toContain('[data-pw-device="mobile"]')
    expect(pwSceneChromeAddedVisibilityCss()).toContain('[data-pw-device="desktop"]')
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
    expect(css).toContain('[data-pw-el="cat-toggle"][data-pw-scene="4"]')
    expect(css).toContain('.pw-cat-btn[data-pw-scene="4"]')
    expect(css).toContain(`z-index:${pwSceneZ(2)}!important`)
    expect(css).toContain(`z-index:${pwSceneZ(4)}!important`)
    expect(pwSceneZ(4)).toBeGreaterThan(100)
  })

  it('does not give the stay/live hoist host a blanket z above lớp nổi chrome', () => {
    const css = pwSceneHoistLayerChildZCss('[data-pw-stay-layer="1"]')
    expect(css).toContain('[data-pw-stay-layer="1"]>[data-pw-scene="1"]{z-index:100!important}')
    expect(css).toContain('[data-pw-stay-layer="1"]>[data-pw-scene="2"]{z-index:200!important}')
    expect(css).toContain('[data-pw-stay-layer="1"]>[data-pw-scene="4"]{z-index:400!important}')
    expect(css).not.toContain('z-index:210')
  })

  it('uses one scene stack with lớp nền as the baseline', () => {
    const css = pwSceneUnifiedStackCss()
    expect(css).toContain('[data-pw-scene="0"]{z-index:0!important}')
    expect(css).toContain('[data-pw-scene="4"]{z-index:400!important}')
    expect(css).toContain('[data-pw-scene="1"]:not([data-pw-added-bg])')
    expect(css).toContain('[data-pw-stay-scroll="1"][data-pw-scene="1"]{z-index:100!important}')
    expect(css).not.toContain('z-index:210')
  })

  it('keeps the whole head stack above mid-page lớp nổi', () => {
    const css = pwSceneHeadStackCss()
    expect(css).toContain(`.pw-header,.pw-shop-header{z-index:${PW_SCENE_HEAD_Z}!important}`)
    expect(css).toContain(`[data-pw-live-chrome]{z-index:${PW_SCENE_HEAD_Z}!important}`)
    expect(css).toContain(`.pw-bottom-nav,.pw-shop-bottom-nav,[data-pw-live-dock]{z-index:${PW_SCENE_HEAD_Z}!important}`)
    expect(pwSceneUnifiedStackCss()).toContain(css)
    expect(PW_SCENE_HEAD_Z).toBeGreaterThan(400)
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
    expect(script).toContain(`"headZ":${PW_SCENE_HEAD_Z}`)
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

  it('sizes added backgrounds and banners from edge handles and the floating panel', () => {
    expect(script).toContain('function stampAddedBgBox(')
    expect(script).toContain('function applyAddedBgSize(')
    expect(script).toContain('--pw-added-bg-w')
    expect(script).toContain(':not([data-pw-added-bg])')
    expect(script).toContain('function resizeDirsFor(')
    expect(script).toContain("return isInFlowAddedSlot(el) ? ['sl', 'sr'] : ['sl', 'sr', 'e', 'se']")
    expect(script).toContain("dir === 'sl' || dir === 'sr'")
    expect(script).toContain("if (isBannerHostEl(el) && layerMode === 'block') return ['s', 'e']")
    expect(script).toContain("resize.mode === 'surface-size'")
    expect(script).toContain('is-banner-height')
    expect(script).toContain('isAddedBgSlot: addedBg && isInFlowAddedSlot(el)')
    expect(PARTNER_SHOP_HROW_CSS).toContain('html [data-pw-hrow]>[data-pw-added-bg="1"]:not([data-pw-added-bg-slot]){flex:0 0 auto!important')
    expect(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS).toContain('text-transform:none!important')
    expect(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS).toContain('html[data-pw-edit-device="desktop"] .pw-hero')
    expect(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS).toContain('margin-top:0!important;border-radius:0!important')
  })

  it('moves the whole bottom navigation when a bottom nav item changes scene layer', () => {
    expect(script).toContain("unit.closest ? unit.closest('.pw-bottom-nav, .pw-shop-bottom-nav') : null")
    expect(script).toContain('if (bottomNav) return bottomNav')
  })

  it('treats the bottom dock as full-bleed chrome and strips leftover drag coords', () => {
    expect(script).toContain("cls.indexOf('pw-bottom-nav') >= 0 || cls.indexOf('pw-shop-bottom-nav') >= 0 || cls.indexOf('pw-pdp-sticky') >= 0")
    expect(script).toContain('.pw-bottom-nav,.pw-shop-bottom-nav,.pw-pdp-sticky,[data-pw-pdp-bottom]')
    expect(script).toContain('var isDock =')
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
      `.pw-topbar,.nanoai-ve-active .pw-shop-topbar,[data-pw-region="topbar"]{position:relative!important;z-index:${PW_SCENE_TOPBAR_Z}!important;display:block!important;width:100%!important;min-width:100%!important;max-width:none!important;left:auto!important`,
    )
    expect(script).toContain('.pw-logo-frame:not([data-pw-z])')
    expect(script).not.toContain('.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;z-index:160!important')
  })

  it('reapplies authored banner text layers after stamp so raised copy stays above the photo', () => {
    expect(script).toContain('restoreAuthoredLayers')
    expect(script).toContain('applyDefaultZ(el, 2)')
    expect(script).not.toContain("el.style.zIndex = '2'")
  })

  it('writes scene on the chrome widget itself and only lifts chrome dragged off header', () => {
    expect(script).toContain('sceneWriteHost')
    expect(script).toContain('applySceneToLooseChrome')
    expect(script).toContain('liftLooseElToSceneHost')
    expect(script).toContain('chromeLeftChromeHost')
    expect(script).toContain('rehomeInflowSceneChrome')
    expect(script).toContain('isInflowHeaderCat')
    expect(script).toContain('isInFlowFooterLink')
    expect(script).toContain('unstampFooterInFlowChrome')
    expect(script).toContain('function kindLockedScene(el)')
    expect(script).toContain('function setElementScene(index)')
    expect(script).toContain('function stepElementScene(dir)')
    expect(script).toContain('var locked = kindLockedScene(el)')
    expect(script).toContain(JSON.stringify(pwSceneUnifiedStackCss()))
    expect(script).not.toContain('sceneNeedsEscapeChromeHost')
    expect(script).toContain('[data-pw-chrome-btn][data-pw-scene=\\"4\\"]')
    expect(script).toContain(`z-index:${pwSceneZ(4)}!important`)
    expect(script).toContain("place === 'canvas'")
    expect(script).toContain('shouldSnapChromeToBar')
    expect(script).toContain('if (isAddedChrome(el)) return false')
    expect(script).toContain('writeSceneIndex(node, SCENE.defaultIndex)')
    expect(script).toContain('liftLooseElToSceneHost(node)')
    expect(script).toContain('isLooseAuthoredOverlay(el)')
    expect(script).toContain('function addedBgContentHost() {\n    return canonicalSceneRoot()')
    expect(script).toContain('function overlayRoot() {\n    return canonicalSceneRoot()')
    expect(script).toContain('ensureContentSceneRoot(visual)')
    expect(script).not.toContain('canonicalSceneRoot() || addedBgContentHost()')
    expect(script).not.toContain('canonicalSceneRoot() || document.body')
    expect(script).not.toContain('var top = Math.max(8, Math.round(-hr.top + 72))')
    expect(script).toContain('captureCanonicalPlacement(node, true)')
    expect(script).toContain('!isLogoTarget(selected) && !isAddedChrome(selected)')
    expect(script).toContain('immediately turn canvas widgets into their canonical scene box')
    expect(script).toContain('[data-pw-chrome-btn]:not([data-pw-scene])')
    expect(script).toContain('[data-pw-chrome-added]:not([data-pw-scene])')
  })

  it('binds canonical viewport placement during the live scene pass', () => {
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('if(!isEditor()){')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('bindSceneAbsolute(root);')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('bindFixed(root,z,px);')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('ensureContentSceneRoot(root)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('ensureContentSceneRoot(document.body)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("getAttribute('data-pw-scene-origin')==='content'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('ensureContentSceneRoot(root)')).toBeLessThan(
      PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('hoistLiveChrome(root,z)')
    )
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('hoistLiveChrome(root,z);')).toBeLessThan(
      PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('bindSceneAbsolute(root);')
    )
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('bindSceneAbsolute(root);')).toBeLessThan(
      PARTNER_SHOP_SCENE_CENTER_SCRIPT.indexOf('bindFixed(root,z,px);')
    )
  })

  it('keeps scene-absolute overlays on the scene-root origin instead of viewport 0', () => {
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function isInFlowCatalogChrome(el)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function isInFlowStackHost(el)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function reflowInFlowStackHosts(root)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function staysInCatalogRow(el,sceneRoot)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('if(isInFlowCatalogChrome(el)||staysInCatalogRow(el,sceneRoot))continue')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('reflowInFlowStackHosts(sceneCanvasOf(root))')
    expect(PARTNER_SHOP_STACK_FLOW_CSS).toContain('[data-pw-region="banner"]')
    expect(PARTNER_SHOP_STACK_FLOW_CSS).toContain('position:relative!important')
    expect(PARTNER_SHOP_STACK_FLOW_CSS).toContain('z-index:1!important')
    expect(pwSceneUnifiedStackCss()).toContain(
      '[data-pw-scene="2"]:not([data-pw-region="banner"]):not([data-pw-region="categories"])'
    )
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).not.toContain('blocks.sort(')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('if(isInFlowCatalogChrome(el))return false')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain(
      "if(el.getAttribute('data-pw-placement')==='scene-absolute')return false"
    )
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('originY:fr.top||0')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain(
      '[data-pw-placement="scene-absolute"],[data-pw-chrome-added="1"][data-pw-chrome-btn]:not([data-pw-chrome-kit])[data-pw-box-x]'
    )
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-live-chrome-ph')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain("querySelectorAll('[data-pw-live-chrome-ph]')")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).not.toContain("setAttribute('data-pw-live-chrome-ph'")
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).not.toContain('var spacerH=0')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function applySceneBox(el,x,y,w,h)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('data-pw-scene-origin')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('function ensureContentSceneRoot(root)')
    expect(PARTNER_SHOP_SCENE_CENTER_SCRIPT).toContain('isBodyOrVisualHost')
  })
})
