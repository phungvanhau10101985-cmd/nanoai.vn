import type { WebLocale } from '@/lib/i18n/config'

export const NANOAI_VE_MESSAGE = 'nanoai-visual-editor'
/** Số bước hoàn tác trong một phiên sửa. 30 đủ dùng, HTML snapshot không quá nặng. */
export const VISUAL_EDITOR_HISTORY_MAX = 30

export type VisualEditorCopy = {
  selectHint: string
  sectionHint: string
  addTextPlaceholder: string
  addButtonLabel: string
  layerBlock: string
  layerImage: string
  createLogo: string
  recreateLogo: string
}

const COPY: Record<WebLocale, VisualEditorCopy> = {
  vi: {
    selectHint: 'Bấm chữ/nút để sửa · Trên banner bấm Khối hoặc Ảnh · Kéo icon để chuyển',
    sectionHint: 'Khối: ẩn / xóa / nhân bản · Banner: lớp phủ và khoảng cách',
    addTextPlaceholder: 'Nhập chữ',
    addButtonLabel: 'MUA NGAY',
    layerBlock: 'Khối',
    layerImage: 'Ảnh',
    createLogo: 'Tạo logo',
    recreateLogo: 'Tạo lại logo',
  },
  en: {
    selectHint: 'Click text/buttons · On a banner tap Block or Image · Drag the move icon',
    sectionHint: 'Blocks: hide / delete / duplicate · Banner: overlay and padding',
    addTextPlaceholder: 'Enter text',
    addButtonLabel: 'SHOP NOW',
    layerBlock: 'Block',
    layerImage: 'Image',
    createLogo: 'Create logo',
    recreateLogo: 'Recreate logo',
  },
  zh: {
    selectHint: '点击文字/按钮 · 横幅上点「区块」或「图片」 · 拖动移动图标',
    sectionHint: '区块：隐藏/删除/复制 · 横幅：遮罩与间距',
    addTextPlaceholder: '输入文字',
    addButtonLabel: '立即购买',
    layerBlock: '区块',
    layerImage: '图片',
    createLogo: '生成标志',
    recreateLogo: '重新生成标志',
  },
  ja: {
    selectHint: '文字/ボタンをクリック · バナーは「ブロック」か「画像」 · 移動アイコンをドラッグ',
    sectionHint: 'ブロック：非表示/削除/複製 · バナー：オーバーレイと余白',
    addTextPlaceholder: 'テキストを入力',
    addButtonLabel: '今すぐ購入',
    layerBlock: 'ブロック',
    layerImage: '画像',
    createLogo: 'ロゴを作成',
    recreateLogo: 'ロゴを再作成',
  },
  ko: {
    selectHint: '텍스트/버튼 클릭 · 배너에서 블록 또는 이미지 · 이동 아이콘을 드래그',
    sectionHint: '블록: 숨기기/삭제/복제 · 배너: 오버레이와 여백',
    addTextPlaceholder: '텍스트 입력',
    addButtonLabel: '바로 구매',
    layerBlock: '블록',
    layerImage: '이미지',
    createLogo: '로고 만들기',
    recreateLogo: '로고 다시 만들기',
  },
}

/** IIFE body injected into preview iframe. Avoid `${` — this is a JS template literal. */
const RUNTIME_BODY = `(function (MSG, COPY) {
  if (window.__nanoaiVeBound) return
  window.__nanoaiVeBound = 1
  var selected = null
  var lastInsertButtonAt = 0
  var hoverEl = null
  var drag = { active: false, ready: false, startX: 0, startY: 0, lastX: 0, lastY: 0, baseX: 0, baseY: 0, mode: 'translate', dropTarget: null, dropHost: null, dropBefore: true }
  var skipClick = false
  var layerMode = 'image'
  var editDevice = 'desktop'
  var logoDraw = { on: false, dragging: false, x1: 0, y1: 0, x2: 0, y2: 0 }
  var resize = { active: false, startX: 0, startW: 0 }
  var HISTORY_MAX = 30
  var historyStack = []
  var historyIndex = -1
  var historyLock = false
  var historyTimer = null
  var TEXT_TAGS = {h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,p:1,span:1,li:1,label:1,figcaption:1,a:1,button:1,td:1,th:1,strong:1,em:1,small:1,blockquote:1,dt:1,dd:1,b:1,i:1,u:1}
  function post(type, payload) {
    try { window.parent.postMessage(Object.assign({ source: MSG, type: type }, payload || {}), '*') } catch (e) {}
    if (type === 'dirty') scheduleHistoryPush()
  }
  function postHistory() {
    post('history', {
      canUndo: historyIndex > 0,
      canRedo: historyIndex >= 0 && historyIndex < historyStack.length - 1,
      dirty: historyIndex > 0
    })
  }
  function isEditorChromeNode(n) {
    if (!n || n.nodeType !== 1) return false
    if (n.id === 'nanoai-visual-editor-script' || n.id === 'nanoai-visual-editor-styles') return true
    if (n.classList && n.classList.contains('nanoai-ve-ignore')) return true
    if (n.getAttribute && n.getAttribute('data-nanoai-ve-ignore')) return true
    return false
  }
  function snapshotPage() {
    var clone = document.body.cloneNode(true)
    var kill = clone.querySelectorAll('#nanoai-visual-editor-script,#nanoai-visual-editor-styles,#nanoai-ve-guides,.nanoai-ve-ignore,[data-nanoai-ve-ignore]')
    for (var i = 0; i < kill.length; i++) kill[i].remove()
    var marked = clone.querySelectorAll('.nanoai-ve-highlight,.nanoai-ve-hover,.nanoai-ve-dragging')
    for (var j = 0; j < marked.length; j++) {
      marked[j].classList.remove('nanoai-ve-highlight', 'nanoai-ve-hover', 'nanoai-ve-dragging')
      marked[j].removeAttribute('data-nanoai-ve-selected')
      marked[j].removeAttribute('contenteditable')
    }
    return clone.innerHTML
  }
  function pushHistory() {
    if (historyLock) return
    var html = snapshotPage()
    if (historyIndex >= 0 && historyStack[historyIndex] === html) {
      postHistory()
      return
    }
    historyStack = historyStack.slice(0, historyIndex + 1)
    historyStack.push(html)
    if (historyStack.length > HISTORY_MAX) historyStack.shift()
    historyIndex = historyStack.length - 1
    postHistory()
  }
  function scheduleHistoryPush() {
    if (historyLock) return
    if (historyTimer) clearTimeout(historyTimer)
    historyTimer = setTimeout(function () {
      historyTimer = null
      pushHistory()
    }, 400)
  }
  function restorePage(html) {
    historyLock = true
    clearHover()
    clearSelection()
    hideLayerSwitches()
    var script = document.getElementById('nanoai-visual-editor-script')
    var kids = Array.prototype.slice.call(document.body.childNodes)
    for (var i = 0; i < kids.length; i++) {
      if (isEditorChromeNode(kids[i])) continue
      document.body.removeChild(kids[i])
    }
    var tmp = document.createElement('div')
    tmp.innerHTML = html
    while (tmp.firstChild) {
      if (script) document.body.insertBefore(tmp.firstChild, script)
      else document.body.appendChild(tmp.firstChild)
    }
    try { sizeChromeIcons(document) } catch (err) {}
    try { pinChromeIconBadges(document) } catch (err2) {}
    syncLayerSwitches()
    syncLogoButtons()
    postHidden()
    historyLock = false
  }
  function undoHistory() {
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null; pushHistory() }
    if (historyIndex <= 0) { postHistory(); return }
    historyIndex -= 1
    restorePage(historyStack[historyIndex])
    postHistory()
  }
  function redoHistory() {
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null; pushHistory() }
    if (historyIndex < 0 || historyIndex >= historyStack.length - 1) { postHistory(); return }
    historyIndex += 1
    restorePage(historyStack[historyIndex])
    postHistory()
  }
  function cs(el) { return window.getComputedStyle(el) }
  function clsOf(el) { return (el.className || '').toString().toLowerCase() }
  function isIgnored(el) {
    return !!(el && el.closest && el.closest('.nanoai-ve-ignore,[data-nanoai-ve-ignore]'))
  }
  function extractBgUrl(el) {
    var bg = ''
    try { bg = (el.style && el.style.backgroundImage) || cs(el).backgroundImage || '' } catch (e) { bg = '' }
    var m = String(bg).match(/url\\(\\s*(['"]?)([^"')]+)\\1\\s*\\)/i)
    return m ? String(m[2] || '').trim() : ''
  }
  function replaceBgUrl(cssValue, nextUrl) {
    var safe = String(nextUrl || '').replace(/['")]/g, '').trim()
    var wrapped = "url('" + safe + "')"
    if (!String(cssValue || '').trim() || !/url\\(/i.test(cssValue)) return wrapped
    return String(cssValue).replace(/url\\(\\s*(['"]?)([^"')]+)\\1\\s*\\)/gi, wrapped)
  }
  function isImgEl(el) { return !!(el && el.tagName && el.tagName.toLowerCase() === 'img') }
  function isLogoImg(el) {
    if (!isImgEl(el)) return false
    if (el.getAttribute && el.getAttribute('data-pw-logo-added') === '1') return true
    var cls = clsOf(el)
    if (cls.indexOf('logo') >= 0) return true
    var alt = (el.getAttribute('alt') || '').toLowerCase()
    if (alt.indexOf('logo') >= 0) return true
    return false
  }
  function isWordmarkEl(el) {
    if (!el || el.nodeType !== 1 || isImgEl(el)) return false
    var cls = clsOf(el)
    return cls.indexOf('pw-wordmark') >= 0 || cls.indexOf('pw-shop-brand') >= 0
  }
  function isLogoSlot(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-logo-added') === '1') return true
    return isLogoImg(el)
  }
  function logoSlotKind(el) {
    if (!el) return 'other'
    var stamped = el.getAttribute ? el.getAttribute('data-pw-logo-slot') : ''
    if (stamped === 'header' || stamped === 'footer') return stamped
    if (el.closest && el.closest('footer, .pw-footer, .pw-shop-footer')) return 'footer'
    if (el.closest && el.closest('header, .pw-header, .pw-shop-header, .site-header')) return 'header'
    return 'other'
  }
  function canonicalLogoEl(el) {
    if (!el) return null
    var host = el.closest
      ? (el.closest('.pw-brand, .pw-shop-brand-cluster, .pw-brand-cluster, .pw-shop-footer-brand') || el)
      : el
    if (host && host.querySelector) {
      var img = host.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo')
      if (img && !isIgnored(img)) return img
      var wm = host.querySelector('.pw-wordmark')
      if (wm && wm.getAttribute('data-pw-logo-wordmark-hidden') !== '1') return wm
      var hostCls = clsOf(host)
      if (hostCls.indexOf('pw-shop-footer-brand') >= 0 || hostCls.indexOf('brand-cluster') >= 0 || hostCls.indexOf('pw-brand') >= 0) {
        return host
      }
    }
    if (isLogoImg(el) || isWordmarkEl(el) || isLogoSlot(el)) return el
    return null
  }
  function logoFaceOf(el) {
    if (!el) return 'empty'
    if (isFilledLogo(el)) return 'image'
    if (isImgEl(el)) return 'empty'
    if (isWordmarkEl(el)) return 'text'
    var cls = clsOf(el)
    if ((cls.indexOf('pw-shop-brand') >= 0 || cls.indexOf('pw-wordmark') >= 0) && !el.querySelector('img')) {
      return String(el.textContent || '').replace(/\\s+/g, ' ').trim() ? 'text' : 'empty'
    }
    return 'empty'
  }
  function logoButtonLabel(el) {
    if (logoFaceOf(el) === 'text') return (COPY && COPY.createLogo) ? String(COPY.createLogo) : 'Tạo logo'
    return (COPY && COPY.recreateLogo) ? String(COPY.recreateLogo) : 'Tạo lại logo'
  }
  function sampleSurroundingBg(el) {
    var walk = el ? el.parentElement : null
    while (walk && walk !== document.documentElement) {
      var c = parseBgColor(walk)
      if (c) return c
      walk = walk.parentElement
    }
    return 'rgb(255, 255, 255)'
  }
  function sampleSurroundingBgImage(el) {
    var walk = el ? el.parentElement : null
    while (walk && walk !== document.documentElement) {
      var url = extractBgUrl(walk)
      if (url) return url
      walk = walk.parentElement
    }
    return ''
  }
  function readThemeVar(name) {
    try { return String(cs(document.documentElement).getPropertyValue(name) || '').trim() } catch (e) { return '' }
  }
  function sampleThemeColors() {
    var primary = readThemeVar('--pw-primary')
    return {
      themePrimary: primary,
      themeAccent: readThemeVar('--pw-accent') || primary,
      themeBuy: readThemeVar('--pw-buy') || primary
    }
  }
  function captureLogoContextPng(el, done) {
    var w = 512
    var h = 160
    var canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    var ctx = canvas.getContext('2d')
    var theme = sampleThemeColors()
    var bg = parseBgColor(el) || sampleSurroundingBg(el)
    var bgImg = sampleSurroundingBgImage(el)
    function paintSwatches() {
      if (!ctx) { done('', theme, bg, bgImg); return }
      ctx.fillStyle = theme.themePrimary || '#111827'
      ctx.fillRect(360, 0, 152, 54)
      ctx.fillStyle = theme.themeAccent || theme.themePrimary || '#111827'
      ctx.fillRect(360, 54, 152, 53)
      ctx.fillStyle = theme.themeBuy || theme.themePrimary || '#111827'
      ctx.fillRect(360, 107, 152, 53)
      var dataUrl = ''
      try { dataUrl = canvas.toDataURL('image/png') } catch (e) { dataUrl = '' }
      done(dataUrl, theme, bg, bgImg)
    }
    if (!ctx) { done('', theme, bg, bgImg); return }
    ctx.fillStyle = bg || '#ffffff'
    ctx.fillRect(0, 0, 360, h)
    if (!bgImg) { paintSwatches(); return }
    var img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = function () {
      try { ctx.drawImage(img, 0, 0, 360, h) } catch (e) {}
      paintSwatches()
    }
    img.onerror = function () { paintSwatches() }
    img.src = bgImg
  }
  function parseObjectPos(el) {
    var p = ''
    try { p = cs(el).objectPosition || '' } catch (e) { p = '' }
    var parts = String(p).trim().split(/\\s+/)
    function pct(s, fallback) {
      if (!s) return fallback
      if (s.indexOf('%') >= 0) return parseFloat(s)
      if (s === 'left' || s === 'top') return 0
      if (s === 'right' || s === 'bottom') return 100
      if (s === 'center') return 50
      return fallback
    }
    return { x: isNaN(pct(parts[0], 50)) ? 50 : pct(parts[0], 50), y: isNaN(pct(parts[1], 50)) ? 50 : pct(parts[1], 50) }
  }
  function isFilledLogo(el) {
    if (!isImgEl(el)) return false
    if (el.getAttribute && el.getAttribute('data-pw-logo-empty') === '1') return false
    var src = (el.getAttribute('src') || '').trim()
    return src.length > 4 && src.indexOf('data:image/') !== 0
  }
  function listLogoSlots() {
    var out = []
    var nodes = document.querySelectorAll('[data-pw-logo-added], img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo')
    for (var i = 0; i < nodes.length; i++) {
      var slot = nodes[i]
      if (!slot || isIgnored(slot)) continue
      if (!isImgEl(slot) && slot.getAttribute('data-pw-logo-added') !== '1') continue
      if (out.indexOf(slot) >= 0) continue
      if (slot.setAttribute) slot.setAttribute('data-pw-logo-slot', logoSlotKind(slot))
      out.push(slot)
    }
    return out
  }
  function countFilledLogoSlots() {
    var slots = listLogoSlots()
    var n = 0
    for (var i = 0; i < slots.length; i++) {
      if (isFilledLogo(slots[i])) n++
    }
    return n
  }
  function applyLogoToEl(el, url) {
    if (!el || !url) return el
    if (isImgEl(el)) {
      el.setAttribute('src', url)
      el.removeAttribute('srcset')
      el.style.transform = ''
      el.style.objectFit = el.style.objectFit || 'contain'
      if (el.setAttribute) {
      el.setAttribute('data-pw-logo-slot', logoSlotKind(el))
      el.removeAttribute('data-pw-logo-empty')
    }
      return el
    }
    var kind = logoSlotKind(el)
    var img = document.createElement('img')
    img.className = kind === 'footer' ? 'pw-shop-footer-logo pw-logo' : 'pw-logo pw-shop-logo'
    img.setAttribute('data-pw-logo-slot', kind)
    img.setAttribute('alt', String(el.textContent || 'logo').replace(/\\s+/g, ' ').trim() || 'logo')
    img.setAttribute('src', url)
    img.style.objectFit = 'contain'
    if (clsOf(el).indexOf('pw-shop-footer-brand') >= 0) {
      el.insertBefore(img, el.firstChild)
      return img
    }
    if (el.parentNode) {
      el.parentNode.insertBefore(img, el)
      el.setAttribute('data-pw-logo-wordmark-hidden', '1')
      el.style.display = 'none'
    }
    return img
  }
  function isBgImageEl(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName.toLowerCase()
    if (['script','style','img','svg','iframe','button','a','input'].indexOf(tag) >= 0) return false
    return Boolean(extractBgUrl(el))
  }
  function isChromeBtn(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-chrome-btn')) return true
    var cls = clsOf(el)
    if (cls.indexOf('pw-icon-btn') >= 0 || cls.indexOf('pw-account-btn') >= 0) return true
    var host = el.closest ? el.closest('.pw-icon-btn,[data-pw-chrome-btn]') : null
    return !!host && host === el
  }
  function isHeaderWidget(el) {
    if (!el || el.nodeType !== 1) return false
    if (isChromeBtn(el)) return true
    var cls = clsOf(el)
    if (cls.indexOf('pw-account-btn') >= 0 || cls.indexOf('pw-brand') >= 0) return true
    if (cls.indexOf('pw-chrome-link') >= 0) return true
    if (el.closest && el.closest('.pw-topbar-inner') && el.tagName.toLowerCase() === 'a') return true
    return false
  }
  function isIconOnlyChrome(el) {
    if (!isChromeBtn(el)) return false
    var style = currentChromeStyle(el)
    return style === 'icon'
  }
  function canEditText(el) {
    if (!el || isImgEl(el) || isIconOnlyChrome(el) || isContentBlockEl(el)) return false
    if (isTextEl(el)) return true
    if (isHeaderWidget(el) && el.tagName.toLowerCase() === 'a') {
      return String(el.textContent || '').replace(/[0-9]+/g, '').trim().length > 0
    }
    return false
  }
  function isChromeNav(el) {
    if (isChromeBtn(el)) return false
    return !!(el && el.closest && el.closest('.pw-bottom-nav,.pw-header-search,.pw-account-panel,.pw-cat-panel,.pw-nav-main,.pw-topbar'))
  }
  function isBtnEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isChromeBtn(el)) return true
    if (isChromeNav(el)) return false
    var tag = el.tagName.toLowerCase()
    var cls = clsOf(el)
    if (cls.indexOf('pw-brand') >= 0) return false
    if (cls.indexOf('pw-search') >= 0 || cls.indexOf('pw-cat-btn') >= 0 || cls.indexOf('pw-account-btn') >= 0) return false
    if (tag === 'button') return true
    if (tag === 'a') {
      if (cls.indexOf('pw-btn') >= 0) return true
      if (/\\b(btn|cta)\\b/.test(cls)) return true
    }
    return false
  }
  function isTextEl(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName.toLowerCase()
    if (['script','style','link','meta','head','html','body','iframe','svg','img','input','textarea','select'].indexOf(tag) >= 0) return false
    if (!TEXT_TAGS[tag]) {
      if ((tag === 'div' || tag === 'section') && el.children && el.children.length === 0) {
        /* text-only box */
      } else return false
    }
    var text = (el.textContent || '').trim()
    if (text.length < 1 || text.length > 8000) return false
    if (el.querySelector && el.querySelector('img,section,article,header,footer,nav,video')) return false
    if (tag === 'button' || tag === 'a') return text.length < 400
    return true
  }
  var blockClassRe = /(^|\\s)pw-(hero|section|categories|features|faq|gallery|footer|chat|lead|trust|testimonial|pricing|banner)(\\s|$)/
  function isOverlayNode(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-overlay') === '1')
  }
  function isChromeBlock(el) {
    if (!el) return true
    var tag = el.tagName.toLowerCase()
    var cls = clsOf(el)
    if (tag === 'header' || cls.indexOf('pw-header') >= 0) return true
    if (cls.indexOf('pw-bottom-nav') >= 0 || cls.indexOf('pw-topbar') >= 0) return true
    return isChromeNav(el)
  }
  function isBlockEl(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false
    if (isOverlayNode(el)) return false
    var tag = el.tagName.toLowerCase()
    if (tag === 'section' || tag === 'article' || tag === 'footer') return true
    if (tag === 'header') return true
    if (tag === 'div' && blockClassRe.test(clsOf(el))) return true
    return false
  }
  function isContentBlockEl(el) {
    return isBlockEl(el) && !isChromeBlock(el)
  }
  function findBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isContentBlockEl(el) || isBlockEl(el)) return el
      el = el.parentElement
    }
    return null
  }
  function findContentBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isContentBlockEl(el)) return el
      el = el.parentElement
    }
    return null
  }
  function findBgImageEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isBgImageEl(el)) return el
      el = el.parentElement
    }
    return null
  }
  function heroImgIn(el) {
    if (!el || !el.querySelector) return null
    var marked = el.querySelector('img[data-pw-edit="heroImage"], img[data-pw-edit*="hero"], img[data-pw-edit*="banner"]')
    if (marked) return marked
    var imgs = el.querySelectorAll('img')
    var br = null
    try { br = el.getBoundingClientRect() } catch (e) { br = null }
    for (var i = 0; i < imgs.length; i++) {
      if (isLogoImg(imgs[i])) continue
      if (!br) return imgs[i]
      var r = imgs[i].getBoundingClientRect()
      if (r.width >= br.width * 0.55 && r.height >= Math.min(140, br.height * 0.4)) return imgs[i]
    }
    return null
  }
  function canImageLayer(el) {
    if (!el || !isContentBlockEl(el)) return false
    if (isBgImageEl(el)) return true
    var cls = clsOf(el)
    if (/(^|\\s)pw-(hero|banner|shop-hero|shop-banner)(\\s|$)/.test(cls)) return true
    if (cls.indexOf('hero') >= 0 || cls.indexOf('banner') >= 0) return true
    return Boolean(heroImgIn(el))
  }
  function imageTargetOf(block) {
    if (!block) return null
    var img = heroImgIn(block)
    if (img) return img
    if (isBgImageEl(block)) return block
    return block
  }
  function listImageLayerBlocks() {
    var all = document.querySelectorAll('section, article, footer, div')
    var out = []
    for (var i = 0; i < all.length; i++) {
      if (canImageLayer(all[i])) out.push(all[i])
    }
    return out
  }
  function blockId(el) {
    var id = el.getAttribute('data-pw-block-id')
    if (id) return id
    id = 'blk-' + Math.random().toString(36).slice(2, 10)
    el.setAttribute('data-pw-block-id', id)
    return id
  }
  function blockLabel(el) {
    var h = el.querySelector ? el.querySelector('h1,h2,h3') : null
    var t = ((h && h.textContent) || el.getAttribute('aria-label') || clsOf(el) || el.tagName || '').replace(/\\s+/g, ' ').trim()
    if (t.length > 42) t = t.slice(0, 42) + '...'
    return t || el.tagName.toLowerCase()
  }
  function paddingTarget(el) {
    if (!el || !el.querySelector) return el
    var inner = el.querySelector(':scope > .pw-hero-inner, :scope > .pw-container')
    return inner || el
  }
  function parsePad(el, prop) {
    var inline = el.style && el.style[prop] ? parseFloat(el.style[prop]) : NaN
    if (!isNaN(inline)) return Math.round(inline)
    var v = parseFloat(cs(el)[prop] || '0')
    return isNaN(v) ? 0 : Math.round(v)
  }
  function overlayNode(block) {
    if (!block || !block.querySelector) return null
    return block.querySelector(':scope > [data-pw-overlay="1"]')
  }
  function canOverlayBlock(el) {
    if (!el) return false
    var cls = clsOf(el)
    return isBgImageEl(el) || cls.indexOf('hero') >= 0 || cls.indexOf('banner') >= 0
  }
  function parseOverlayPct(block) {
    var o = overlayNode(block)
    if (!o) return 0
    var op = parseFloat(o.style.opacity)
    if (isNaN(op)) op = parseFloat(cs(o).opacity || '0')
    if (isNaN(op)) return 0
    var pct = Math.round(op * 100)
    if (pct < 0) return 0
    if (pct > 80) return 80
    return pct
  }
  function ensureOverlayStyle() {
    if (document.getElementById('nanoai-pw-overlay-style')) return
    var s = document.createElement('style')
    s.id = 'nanoai-pw-overlay-style'
    s.textContent = '[data-pw-overlay="1"]~*{position:relative;z-index:1}.pw-hero[data-pw-has-overlay]::after,.pw-banner[data-pw-has-overlay]::after{display:none!important}'
    document.head.appendChild(s)
  }
  function setOverlayPct(block, pct) {
    if (!block) return
    var n = Number(pct)
    if (isNaN(n) || n < 0) n = 0
    if (n > 80) n = 80
    n = Math.round(n)
    if (n <= 0) {
      var old = overlayNode(block)
      if (old) old.remove()
      block.removeAttribute('data-pw-has-overlay')
      return
    }
    ensureOverlayStyle()
    var pos = ''
    try { pos = cs(block).position } catch (e) { pos = '' }
    if (!pos || pos === 'static') block.style.position = 'relative'
    var o = overlayNode(block)
    if (!o) {
      o = document.createElement('div')
      o.setAttribute('data-pw-overlay', '1')
      o.setAttribute('aria-hidden', 'true')
      o.style.cssText = 'position:absolute;inset:0;background:#000;pointer-events:none;z-index:0'
      block.insertBefore(o, block.firstChild)
    }
    o.style.opacity = String(n / 100)
    block.setAttribute('data-pw-has-overlay', '1')
  }
  function listHiddenBlocks() {
    var nodes = document.querySelectorAll('[data-pw-hidden="1"]')
    var out = []
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      out.push({ id: blockId(el), label: blockLabel(el) })
    }
    return out
  }
  function postHidden() { post('hidden', { hidden: listHiddenBlocks() }) }
  function hideSelectedBlock() {
    var block = selected && isContentBlockEl(selected) ? selected : findContentBlockEl(selected)
    if (!block) return
    blockId(block)
    block.setAttribute('data-pw-hidden', '1')
    block.style.display = 'none'
    clearSelection()
    post('deselect', {})
    post('dirty', {})
    postHidden()
    syncLayerSwitches()
  }
  function showHiddenBlock(id) {
    if (!id) return
    var el = document.querySelector('[data-pw-block-id="' + String(id).replace(/"/g, '') + '"]')
    if (!el) return
    el.removeAttribute('data-pw-hidden')
    el.style.display = ''
    selectEl(el)
    post('dirty', {})
    postHidden()
  }
  function deleteSelectedBlock() {
    var block = selected && isContentBlockEl(selected) ? selected : findContentBlockEl(selected)
    if (!block || !block.parentNode) return
    block.parentNode.removeChild(block)
    selected = null
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
    post('deselect', {})
    post('dirty', {})
    postHidden()
    syncLayerSwitches()
  }
  function duplicateSelectedBlock() {
    var block = selected && isContentBlockEl(selected) ? selected : findContentBlockEl(selected)
    if (!block || !block.parentNode) return
    var clone = block.cloneNode(true)
    clone.classList.remove('nanoai-ve-highlight', 'nanoai-ve-hover', 'nanoai-ve-dragging')
    clone.removeAttribute('data-nanoai-ve-selected')
    clone.removeAttribute('contenteditable')
    clone.removeAttribute('data-pw-block-id')
    clone.removeAttribute('data-pw-hidden')
    clone.style.display = ''
    if (clone.id) clone.id = clone.id + '-copy'
    block.parentNode.insertBefore(clone, block.nextSibling)
    blockId(clone)
    selectEl(clone)
    post('dirty', {})
    postHidden()
    syncLayerSwitches()
  }
  function sizeChromeIcons(root) {
    var scope = root && root.querySelectorAll ? root : document
    var list = []
    if (root && root.tagName && String(root.tagName).toLowerCase() === 'svg') list = [root]
    else {
      try {
        list = Array.prototype.slice.call(
          scope.querySelectorAll('.pw-icon-btn svg, [data-pw-chrome-btn] svg, [data-pw-chrome-added] svg')
        )
      } catch (err) {
        list = []
      }
    }
    for (var i = 0; i < list.length; i++) {
      var svg = list[i]
      svg.setAttribute('width', '20')
      svg.setAttribute('height', '20')
      svg.style.width = '20px'
      svg.style.height = '20px'
      svg.style.maxWidth = '20px'
      svg.style.maxHeight = '20px'
      svg.style.flexShrink = '0'
      if (!svg.getAttribute('fill')) svg.setAttribute('fill', 'none')
      if (!svg.getAttribute('stroke')) svg.setAttribute('stroke', 'currentColor')
    }
  }
  function pinChromeIconBadges(root) {
    var scope = root && root.querySelectorAll ? root : document
    var buttons = []
    try {
      buttons = Array.prototype.slice.call(
        scope.querySelectorAll('[data-pw-chrome-btn], .pw-shop-bottom-nav a, .pw-bottom-nav a, .pw-shop-icon-btn, .pw-icon-btn')
      )
    } catch (err) { buttons = [] }
    for (var i = 0; i < buttons.length; i++) {
      var el = buttons[i]
      var badge = el.querySelector('[data-pw-chrome-badge], .pw-cart-badge, .pw-shop-cart-badge')
      if (!badge) continue
      var owner = badge.closest ? badge.closest('a,button,[data-pw-chrome-btn],.pw-icon-btn,.pw-shop-icon-btn') : null
      if (owner && owner !== el) continue
      var wrap = el.querySelector(':scope > .pw-chrome-icon-wrap')
      if (!wrap) {
        var svg = el.querySelector(':scope > svg') || el.querySelector('svg')
        if (!svg) continue
        var existing = svg.closest ? svg.closest('.pw-chrome-icon-wrap') : null
        if (existing && el.contains(existing)) wrap = existing
        else {
          wrap = document.createElement('span')
          wrap.className = 'pw-chrome-icon-wrap'
          if (svg.parentNode) svg.parentNode.insertBefore(wrap, svg)
          wrap.appendChild(svg)
        }
      }
      if (badge.parentNode !== wrap) wrap.appendChild(badge)
    }
  }
  function ensureChromeHost(place) {
    if (place === 'topbar') {
      var inner = document.querySelector('.pw-topbar-inner, .pw-shop-topbar-inner')
      if (inner) return inner
      var header = document.querySelector('header.pw-header, header.pw-shop-header') || document.querySelector('header')
      var bar = document.createElement('div')
      bar.className = 'pw-topbar'
      var wrapInner = document.createElement('div')
      wrapInner.className = 'pw-container pw-topbar-inner'
      bar.appendChild(wrapInner)
      if (header) header.insertBefore(bar, header.firstChild)
      else document.body.insertBefore(bar, document.body.firstChild)
      return wrapInner
    }
    if (place === 'nav') {
      var bottom = document.querySelector('.pw-bottom-nav, .pw-shop-bottom-nav')
      if (bottom) return bottom
    }
    if (place === 'mid') {
      var mid = document.querySelector('.pw-nav-main, .pw-shop-nav-row')
      if (mid) return mid
      var midHeader = document.querySelector('header.pw-header, header.pw-shop-header') || document.querySelector('header')
      var midNav = document.createElement('nav')
      midNav.className = 'pw-container pw-nav-main'
      midNav.setAttribute('aria-label', 'Shop')
      if (midHeader) midHeader.appendChild(midNav)
      else document.body.insertBefore(midNav, document.body.firstChild)
      return midNav
    }
    var actions = document.querySelector('.pw-header-actions, .pw-shop-header-actions')
    if (actions) return actions
    var main = document.querySelector('.pw-header-main, header.pw-header, header.pw-shop-header, header')
    return main || document.body
  }
  function insertChromeBtn(kind, html, host) {
    var k = String(kind || '').replace(/[^a-z0-9-]/g, '')
    if (!k || !html) return
    var wrap = document.createElement('div')
    wrap.innerHTML = String(html)
    var node = wrap.firstElementChild
    if (!node) return
    var place = String(host || '')
    if (place !== 'topbar' && place !== 'nav' && place !== 'mid') place = 'actions'
    var hostEl = ensureChromeHost(place)
    var existing = hostEl.querySelector('[data-pw-chrome-btn="' + k + '"]')
    if (existing) {
      if (existing.setAttribute) existing.setAttribute('data-pw-device', editDevice === 'mobile' ? 'mobile' : 'desktop')
      selectEl(existing)
      return
    }
    var href = node.getAttribute ? (node.getAttribute('href') || '') : ''
    if (place === 'topbar' && href) {
      var links = document.querySelectorAll('.pw-topbar a, .pw-topbar-inner a')
      for (var i = 0; i < links.length; i++) {
        var a = links[i]
        if (a.getAttribute('data-pw-chrome-btn')) continue
        if ((a.getAttribute('href') || '') === href) {
          a.setAttribute('data-pw-chrome-btn', k)
          a.setAttribute('draggable', 'false')
          selectEl(a)
          post('dirty', {})
          return
        }
      }
    }
    if (node.setAttribute) node.setAttribute('data-pw-device', editDevice === 'mobile' ? 'mobile' : 'desktop')
    ensureChromeHost(place).appendChild(node)
    sizeChromeIcons(node)
    pinChromeIconBadges(node)
    selectEl(node)
    post('dirty', {})
    try { document.dispatchEvent(new CustomEvent('pw-cart-updated')) } catch (err) {}
  }
  function isShown(el) {
    if (!el) return false
    try {
      if (cs(el).display === 'none' || cs(el).visibility === 'hidden') return false
      var rects = el.getClientRects()
      return !!(rects && rects.length)
    } catch (err) {
      return false
    }
  }
  function visibleVisualRoot() {
    var mobile = document.querySelector('.pw-visual-mobile')
    var desktop = document.querySelector('.pw-visual-desktop')
    if (isShown(desktop) && !isShown(mobile)) return desktop
    if (isShown(mobile) && !isShown(desktop)) return mobile
    if (isShown(desktop)) return desktop
    if (isShown(mobile)) return mobile
    return document.body
  }
  function insertTextHost() {
    var root = visibleVisualRoot()
    var fromSel = selected ? findContentBlockEl(selected) : null
    if (fromSel && root.contains(fromSel)) return fromSel
    var hero = root.querySelector('.pw-hero, .pw-banner, .pw-shop-hero, [class*="hero"], [class*="banner"]')
    if (hero) return hero
    var main = root.querySelector('main, .pw-shop-main, .pw-main')
    if (main) return main
    return root
  }
  function insertText() {
    var host = insertTextHost()
    if (!host) return
    var label = (COPY && COPY.addTextPlaceholder) ? String(COPY.addTextPlaceholder) : 'Text'
    var node = document.createElement('p')
    node.setAttribute('data-pw-added-text', '1')
    node.setAttribute('data-pw-edit', '1')
    node.textContent = label
    node.style.display = 'inline-block'
    node.style.width = 'auto'
    node.style.maxWidth = '100%'
    node.style.margin = '6px 8px'
    node.style.padding = '0'
    node.style.fontSize = '22px'
    node.style.fontWeight = '700'
    node.style.lineHeight = '1.25'
    node.style.color = 'inherit'
    host.appendChild(node)
    selectEl(node)
    post('dirty', {})
  }
  function isTinyBannerHost(el) {
    var cls = clsOf(el)
    if (cls.indexOf('copy') >= 0 || cls.indexOf('inner') >= 0 || cls.indexOf('dot') >= 0) return true
    if (cls.indexOf('sub') >= 0 || cls.indexOf('btn') >= 0) return true
    return false
  }
  function findBannerHost(root) {
    if (!root) return null
    var nodes = root.querySelectorAll('.pw-hero, .pw-shop-hero, .pw-banner, .pw-shop-banner, [class*="hero"], [class*="banner"]')
    var best = null
    var bestArea = 0
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (isTinyBannerHost(el)) continue
      var r = el.getBoundingClientRect()
      var area = Math.max(0, r.width) * Math.max(0, r.height)
      if (area > bestArea) {
        bestArea = area
        best = el
      }
    }
    return best
  }
  function insertButtonHost() {
    var root = visibleVisualRoot()
    var hero = findBannerHost(root)
    if (hero) return hero
    var main = root.querySelector('main, .pw-shop-main, .pw-main')
    return main || root
  }
  function ensureOverlayHost(host) {
    try {
      var pos = cs(host).position
      if (!pos || pos === 'static') host.style.position = 'relative'
    } catch (err) {}
  }
  function placeOverlayButton(el, host) {
    if (!el || !host) return
    ensureOverlayHost(host)
    el.style.position = 'absolute'
    el.style.zIndex = '40'
    el.style.margin = '0'
    el.style.left = '0'
    el.style.top = '0'
    el.style.transform = 'none'
    if (el.parentNode !== host) host.appendChild(el)
    var hr = host.getBoundingClientRect()
    var er = el.getBoundingClientRect()
    var n = host.querySelectorAll('[data-pw-added-btn]').length
    var offset = Math.max(0, n - 1) * 18
    var left = Math.round((hr.width - er.width) / 2 + offset)
    var top = Math.round((hr.height - er.height) / 2 + offset)
    el.style.left = Math.max(0, left) + 'px'
    el.style.top = Math.max(0, top) + 'px'
  }
  function defaultCtaHref() {
    var root = visibleVisualRoot()
    var selectors = ['a.pw-btn-hero[href]', 'a.pw-btn[href*="/products"]', 'a[href*="/products"]', 'a[href*="/sale"]']
    for (var i = 0; i < selectors.length; i++) {
      var a = root.querySelector(selectors[i])
      if (!a) continue
      var href = a.getAttribute('href') || ''
      if (href && href !== '#') return href
    }
    return '#'
  }
  function currentChromeStyle(el) {
    if (!el || !el.getAttribute) return 'icon'
    var attr = el.getAttribute('data-pw-chrome-style')
    if (attr === 'icon' || attr === 'icon-label' || attr === 'text') return attr
    var cls = clsOf(el)
    if (cls.indexOf('pw-chrome-link') >= 0) return 'text'
    if (cls.indexOf('pw-chrome-icon-only') >= 0) return 'icon'
    if (cls.indexOf('pw-chrome-has-label') >= 0) return 'icon-label'
    var lab = el.querySelector ? el.querySelector('.pw-account-btn-label, .pw-chrome-btn-label, .pw-shop-nav-label') : null
    if (lab) {
      try {
        if (cs(lab).display === 'none') return 'icon'
      } catch (err) {}
      return 'icon-label'
    }
    return 'icon'
  }
  function chromeLabelText(el) {
    var lab = el.querySelector ? el.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label') : null
    if (lab && String(lab.textContent || '').trim()) return String(lab.textContent || '').trim()
    var aria = String(el.getAttribute('aria-label') || el.getAttribute('title') || '').trim()
    if (aria) return aria
    return String(el.textContent || '').replace(/\s+/g, ' ').trim()
  }
  function ensureChromeIconWrap(el) {
    var wrap = el.querySelector ? el.querySelector('.pw-chrome-icon-wrap') : null
    if (wrap) return wrap
    var svg = el.querySelector ? el.querySelector('svg') : null
    if (!svg) return null
    wrap = document.createElement('span')
    wrap.className = 'pw-chrome-icon-wrap'
    if (svg.parentNode) svg.parentNode.insertBefore(wrap, svg)
    wrap.appendChild(svg)
    var badge = el.querySelector('.pw-cart-badge, .pw-shop-cart-badge')
    if (badge && badge.parentNode !== wrap) wrap.appendChild(badge)
    return wrap
  }
  function setChromeStyle(style) {
    if (!selected || (!isChromeBtn(selected) && !isHeaderWidget(selected))) return
    if (clsOf(selected).indexOf('pw-brand') >= 0) return
    var next = style === 'icon' || style === 'text' ? style : 'icon-label'
    var el = selected
    var labelText = chromeLabelText(el)
    var isAccount = clsOf(el).indexOf('pw-account-btn') >= 0 || !!(el.getAttribute && el.getAttribute('data-pw-account-toggle'))
    ensureChromeIconWrap(el)
    var labelEl = el.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label')
    if (!labelEl && next !== 'icon') {
      labelEl = document.createElement('span')
      labelEl.className = isAccount ? 'pw-account-btn-label' : 'pw-shop-nav-label pw-chrome-btn-label'
      labelEl.textContent = labelText || ' '
      el.appendChild(labelEl)
    }
    if (labelEl && labelText) labelEl.textContent = labelText
    var wrap = el.querySelector('.pw-chrome-icon-wrap')
    el.setAttribute('data-pw-chrome-style', next)
    if (!isAccount) {
      el.classList.remove('pw-chrome-link', 'pw-chrome-has-label', 'pw-chrome-icon-only')
      if (next === 'text') {
        el.classList.add('pw-chrome-link')
        el.classList.remove('pw-icon-btn', 'pw-shop-icon-btn')
      } else {
        el.classList.add('pw-icon-btn', 'pw-shop-icon-btn')
        el.classList.add(next === 'icon' ? 'pw-chrome-icon-only' : 'pw-chrome-has-label')
      }
    }
    if (wrap) wrap.style.display = next === 'text' ? 'none' : ''
    if (labelEl) labelEl.style.display = next === 'icon' ? 'none' : ''
    if (labelText) {
      el.setAttribute('aria-label', labelText)
      el.setAttribute('title', labelText)
    }
    sizeChromeIcons(el)
    pinChromeIconBadges(el)
    selectEl(el)
    post('dirty', {})
  }
  function currentBtnStyle(el) {
    if (!el || !el.getAttribute) return 'hero'
    var attr = el.getAttribute('data-pw-btn-style')
    if (attr === 'hero' || attr === 'primary' || attr === 'outline') return attr
    var cls = clsOf(el)
    if (cls.indexOf('pw-btn-outline') >= 0) return 'outline'
    if (cls.indexOf('pw-btn-accent') >= 0 || cls.indexOf('pw-btn-cart') >= 0) return 'primary'
    if (cls.indexOf('pw-btn-hero') >= 0) return 'hero'
    return 'hero'
  }
  function applyBtnStyle(el, style) {
    var kind = style === 'primary' || style === 'outline' ? style : 'hero'
    el.classList.add('pw-btn')
    el.classList.remove('pw-btn-hero', 'pw-btn-accent', 'pw-btn-outline')
    el.setAttribute('data-pw-btn-style', kind)
    el.style.display = 'inline-flex'
    el.style.width = 'auto'
    el.style.alignItems = 'center'
    el.style.justifyContent = 'center'
    el.style.padding = '10px 22px'
    el.style.fontWeight = '700'
    el.style.textDecoration = 'none'
    el.style.fontSize = '14px'
    el.style.whiteSpace = 'nowrap'
    var fill = el.getAttribute('data-pw-btn-color') || ''
    var text = el.getAttribute('data-pw-btn-text') || ''
    var border = el.getAttribute('data-pw-btn-border') || ''
    if (kind === 'outline') {
      el.classList.add('pw-btn-outline')
      el.style.background = 'transparent'
      el.style.color = text || '#fff'
      el.style.border = '2px solid ' + (border || '#fff')
      el.style.borderRadius = '12px'
    } else if (kind === 'primary') {
      el.classList.add('pw-btn-accent')
      el.style.background = fill || 'var(--pw-buy, var(--pw-primary))'
      el.style.color = text || '#fff'
      el.style.border = border ? '2px solid ' + border : 'none'
      el.style.borderRadius = '999px'
    } else {
      el.classList.add('pw-btn-hero')
      el.style.background = fill || '#fff'
      el.style.color = text || 'var(--pw-primary)'
      el.style.border = border ? '2px solid ' + border : 'none'
      el.style.borderRadius = '999px'
    }
  }
  function applyBtnColor(el, color) {
    var c = String(color || '').trim()
    if (!c) {
      el.removeAttribute('data-pw-btn-color')
    } else {
      el.setAttribute('data-pw-btn-color', c)
    }
    applyBtnStyle(el, currentBtnStyle(el))
  }
  function applyBtnTextColor(el, color) {
    var c = String(color || '').trim()
    if (!c) el.removeAttribute('data-pw-btn-text')
    else el.setAttribute('data-pw-btn-text', c)
    if (c) el.style.color = c
    else applyBtnStyle(el, currentBtnStyle(el))
  }
  function applyBtnBorderColor(el, color) {
    var c = String(color || '').trim()
    if (!c) el.removeAttribute('data-pw-btn-border')
    else el.setAttribute('data-pw-btn-border', c)
    applyBtnStyle(el, currentBtnStyle(el))
  }
  function setButtonStyle(style) {
    if (!selected || !isBtnEl(selected) || isChromeBtn(selected)) return
    applyBtnStyle(selected, style)
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function iframeTextFocused(el) {
    try {
      return !!(el && document.activeElement === el && el.getAttribute('contenteditable') === 'true')
    } catch (err) {
      return false
    }
  }
  function setButtonLabel(text) {
    if (!selected || !isBtnEl(selected) || isChromeBtn(selected)) return
    if (iframeTextFocused(selected)) return
    selected.textContent = String(text || '') || ' '
    positionAllHandles()
    post('dirty', {})
  }
  function setButtonColor(color) {
    if (!selected || !isBtnEl(selected) || isChromeBtn(selected)) return
    applyBtnColor(selected, color)
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setButtonBorder(color) {
    if (!selected || !isBtnEl(selected) || isChromeBtn(selected)) return
    applyBtnBorderColor(selected, color)
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function insertButton(opts) {
    var now = Date.now()
    if (now - lastInsertButtonAt < 600) return
    lastInsertButtonAt = now
    var host = insertButtonHost()
    if (!host) return
    var style = opts && typeof opts === 'object' ? opts.style : opts
    var label = opts && opts.label
      ? String(opts.label)
      : ((COPY && COPY.addButtonLabel) ? String(COPY.addButtonLabel) : 'CTA')
    var node = document.createElement('a')
    node.setAttribute('data-pw-added-btn', '1')
    node.setAttribute('data-pw-edit', '1')
    node.setAttribute('href', opts && opts.href ? String(opts.href) : defaultCtaHref())
    node.textContent = label
    applyBtnStyle(node, style)
    if (opts && opts.color) applyBtnColor(node, opts.color)
    placeOverlayButton(node, host)
    selectEl(node)
    post('dirty', {})
  }
  function removeSelectedChrome() {
    deleteSelectedUnit()
  }
  function nudgeSelected(dx, dy) {
    if (!selected || !canDragEl(selected)) return
    ensureDragDisplay(selected)
    var p = parseTransform(selected)
    selected.style.transform = 'translate(' + (p.x + dx) + 'px,' + (p.y + dy) + 'px)'
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function onKeyDown(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    var key = e.key || ''
    if (logoDraw.on && (key === 'Escape' || key === 'Esc')) {
      e.preventDefault()
      cancelAddLogo()
      return
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'Z')) {
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      if (e.shiftKey) redoHistory()
      else undoHistory()
      return
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'y' || key === 'Y')) {
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      redoHistory()
      return
    }
    if (!selected || !canDragEl(selected)) return
    var tag = e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : ''
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return
    var step = e.shiftKey ? 10 : 1
    var dx = 0
    var dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return
    e.preventDefault()
    e.stopPropagation()
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
    nudgeSelected(dx, dy)
  }
  var translateRe = new RegExp('translate\\\\(([-\\\\d.]+)px,\\\\s*([-.\\\\d.]+)px\\\\)')
  function parseTransform(el) {
    var t = el.style.transform || ''
    var m = t.match(translateRe)
    return { x: m ? parseFloat(m[1]) : 0, y: m ? parseFloat(m[2]) : 0 }
  }
  function parseFontSizePx(el) {
    var px = parseFloat(cs(el).fontSize || '16')
    return isNaN(px) ? 16 : Math.round(px)
  }
  function parseBgColor(el) {
    var bg = cs(el).backgroundColor || ''
    return bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' ? bg : ''
  }
  function parseImageWidthPct(el) {
    var w = el.style.width || ''
    if (w.indexOf('%') >= 0) return parseFloat(w) || 100
    var r = el.getBoundingClientRect()
    var pr = el.parentElement ? el.parentElement.getBoundingClientRect().width : 0
    if (pr > 0) return Math.round((r.width / pr) * 100)
    return 100
  }
  function hrefOf(el) {
    if (!el) return ''
    if (el.tagName && el.tagName.toLowerCase() === 'a') return el.getAttribute('href') || ''
    var a = el.closest ? el.closest('a') : null
    return a ? (a.getAttribute('href') || '') : ''
  }
  function canDragEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false
    if (isOverlayNode(el)) return false
    return isImgEl(el) || isBtnEl(el) || isTextEl(el) || isChromeBtn(el) || isHeaderWidget(el) || isContentBlockEl(el) || isBgImageEl(el)
  }
  function canDeleteEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false
    var tag = el.tagName.toLowerCase()
    if (tag === 'header' || tag === 'main' || tag === 'html' || tag === 'form') return false
    var cls = clsOf(el)
    if (cls.indexOf('pw-header-search') >= 0 || cls.indexOf('pw-header-main') >= 0) return false
    if (cls.indexOf('pw-bottom-nav') >= 0) return false
    if (tag === 'header') return false
    return isChromeBtn(el) || isImgEl(el) || isBtnEl(el) || isTextEl(el) || isContentBlockEl(el) || isHeaderWidget(el) || isBgImageEl(el)
  }
  function isAddedChrome(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-chrome-added'))
  }
  function dragModeFor(el) {
    if (el && el.getAttribute && el.getAttribute('data-pw-added-btn') === '1') return 'translate'
    if (isAddedChrome(el)) return 'translate'
    if (isContentBlockEl(el)) return 'reorder'
    if (isChromeBtn(el) || isHeaderWidget(el) || isBtnEl(el)) {
      var p = el.parentElement
      if (p && p.children && p.children.length >= 2) return 'reorder'
    }
    return 'translate'
  }
  function chromeDropHostFromPoint(x, y) {
    var nodes = document.querySelectorAll('.pw-header-actions, .pw-shop-header-actions, .pw-bottom-nav, .pw-shop-bottom-nav, .pw-topbar-inner, .pw-shop-topbar-inner, .pw-nav-main, .pw-shop-nav-row')
    var best = null
    var bestDist = 48
    for (var i = 0; i < nodes.length; i++) {
      var host = nodes[i]
      var r = host.getBoundingClientRect()
      if (r.width < 8 || r.height < 8) continue
      try {
        if (cs(host).display === 'none' || cs(host).visibility === 'hidden') continue
      } catch (err) {}
      var dx = 0
      var dy = 0
      if (x < r.left) dx = r.left - x
      else if (x > r.right) dx = x - r.right
      if (y < r.top) dy = r.top - y
      else if (y > r.bottom) dy = y - r.bottom
      var d = Math.sqrt(dx * dx + dy * dy)
      if (d < bestDist) {
        bestDist = d
        best = host
      }
    }
    return best
  }
  function chromeHostChildren(host, skip) {
    var out = []
    if (!host) return out
    for (var i = 0; i < host.children.length; i++) {
      var c = host.children[i]
      if (c === skip || c.nodeType !== 1) continue
      if (isIgnored(c)) continue
      out.push(c)
    }
    return out
  }
  function chromeSlotAtX(host, x, skip) {
    var kids = chromeHostChildren(host, skip)
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect()
      if (x < r.left + r.width / 2) return { beforeEl: kids[i], before: true }
    }
    return { beforeEl: kids.length ? kids[kids.length - 1] : null, before: false }
  }
  function snapChromeToHost(el, host, beforeEl, before) {
    if (!el || !host) return
    if (beforeEl && beforeEl.parentNode === host && beforeEl !== el) {
      if (before) host.insertBefore(el, beforeEl)
      else host.insertBefore(el, beforeEl.nextSibling)
    } else if (!beforeEl) {
      host.appendChild(el)
    }
    el.style.transform = ''
    el.style.opacity = ''
    el.style.pointerEvents = ''
  }
  function ensureDragDisplay(el) {
    try {
      if (cs(el).display === 'inline') el.style.display = 'inline-block'
    } catch (e) {}
  }
  function buildPayload(el) {
    var rect = el.getBoundingClientRect()
    var bgUrl = extractBgUrl(el)
    var img = isImgEl(el)
    var btn = isBtnEl(el)
    var blockSelf = isContentBlockEl(el) || (isBlockEl(el) && !img && !btn && !isTextEl(el))
    var dual = isContentBlockEl(el) && canImageLayer(el)
    var asImage = dual && layerMode !== 'block'
    var asBlock = blockSelf && (!dual || layerMode === 'block')
    var parentBlock = blockSelf ? el : findContentBlockEl(el)
    var imageBlock = dual ? el : (parentBlock && canImageLayer(parentBlock) ? parentBlock : null)
    var padEl = parentBlock ? paddingTarget(parentBlock) : null
    var overlayBlock = parentBlock && canOverlayBlock(parentBlock) ? parentBlock : (blockSelf && canOverlayBlock(el) ? el : null)
    var themeColors = sampleThemeColors()
    return {
      tag: el.tagName.toLowerCase(),
      isText: canEditText(el),
      isImage: img,
      isBgImage: img ? false : (asImage || (!dual && Boolean(bgUrl))),
      isLogo: isLogoSlot(el) || isLogoImg(el),
      logoFace: logoFaceOf(el),
      logoSlot: logoSlotKind(el),
      logoBg: parseBgColor(el) || sampleSurroundingBg(el),
      logoBgImage: sampleSurroundingBgImage(el),
      themePrimary: themeColors.themePrimary,
      themeAccent: themeColors.themeAccent,
      themeBuy: themeColors.themeBuy,
      logoSlotCount: listLogoSlots().length,
      logoFilledCount: countFilledLogoSlots(),
      logoCropX: img ? parseObjectPos(el).x : 50,
      logoCropY: img ? parseObjectPos(el).y : 50,
      isButton: btn,
      isChrome: isChromeBtn(el),
      chromeStyle: isChromeBtn(el) || isHeaderWidget(el) ? currentChromeStyle(el) : '',
      btnStyle: btn && !isChromeBtn(el) ? currentBtnStyle(el) : '',
      isBlock: asBlock,
      hasImageLayer: Boolean(imageBlock),
      hasParentBlock: !blockSelf && Boolean(parentBlock),
      canOverlay: Boolean(overlayBlock),
      overlay: overlayBlock ? parseOverlayPct(overlayBlock) : 0,
      paddingY: padEl ? Math.round((parsePad(padEl, 'paddingTop') + parsePad(padEl, 'paddingBottom')) / 2) : 0,
      paddingX: padEl ? Math.round((parsePad(padEl, 'paddingLeft') + parsePad(padEl, 'paddingRight')) / 2) : 0,
      blockLabel: parentBlock ? blockLabel(parentBlock) : '',
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      textColor: cs(el).color || '',
      fontSize: parseFontSizePx(el),
      fontWeight: cs(el).fontWeight || '400',
      textAlign: cs(el).textAlign || 'left',
      bgColor: parseBgColor(el),
      src: img ? (el.getAttribute('src') || '') : bgUrl,
      href: hrefOf(el),
      text: String(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      btnColor: el.getAttribute ? (el.getAttribute('data-pw-btn-color') || '') : '',
      btnBorder: el.getAttribute ? (el.getAttribute('data-pw-btn-border') || '') : '',
      btnText: el.getAttribute ? (el.getAttribute('data-pw-btn-text') || '') : '',
      imageWidth: img ? parseImageWidthPct(el) : 100,
      transform: canDragEl(el) ? parseTransform(el) : null,
    }
  }
  function clearHover() {
    if (hoverEl) {
      hoverEl.classList.remove('nanoai-ve-hover')
      hoverEl = null
    }
  }
  function clearSelection() {
    if (selected) {
      selected.classList.remove('nanoai-ve-highlight')
      selected.classList.remove('nanoai-ve-dragging')
      selected.removeAttribute('data-nanoai-ve-selected')
      if (selected.getAttribute('contenteditable') === 'true') selected.removeAttribute('contenteditable')
    }
    document.body.classList.remove('nanoai-ve-dragging')
    selected = null
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
  }
  function hideMoveHandle() {
    var h = document.querySelector('.nanoai-ve-move-handle')
    if (h) h.remove()
  }
  function hideLayerSwitches() {
    var nodes = document.querySelectorAll('.nanoai-ve-layer-switch')
    for (var i = 0; i < nodes.length; i++) nodes[i].remove()
  }
  function positionLayerSwitch(block, box) {
    var r = block.getBoundingClientRect()
    box.style.position = 'fixed'
    box.style.left = Math.max(8, r.left + 18) + 'px'
    box.style.top = Math.max(8, r.top - 8) + 'px'
    box.style.zIndex = '2147483646'
  }
  function applyLayerMode(mode, block) {
    layerMode = mode === 'block' ? 'block' : 'image'
    if (!block) return
    var target = layerMode === 'image' ? (imageTargetOf(block) || block) : block
    selectEl(target)
  }
  function ensureLayerSwitch(block) {
    var bid = blockId(block)
    var id = 'nanoai-ve-layer-' + bid
    var box = document.getElementById(id)
    if (box) return box
    box = document.createElement('div')
    box.id = id
    box.className = 'nanoai-ve-layer-switch nanoai-ve-ignore'
    box.setAttribute('data-nanoai-ve-ignore', '1')
    box.setAttribute('data-ve-block-id', bid)
    var b1 = document.createElement('button')
    b1.type = 'button'
    b1.setAttribute('data-ve-layer', 'block')
    b1.textContent = COPY.layerBlock
    var b2 = document.createElement('button')
    b2.type = 'button'
    b2.setAttribute('data-ve-layer', 'image')
    b2.textContent = COPY.layerImage
    box.appendChild(b1)
    box.appendChild(b2)
    document.body.appendChild(box)
    box.addEventListener('mousedown', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    box.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      var btn = e.target && e.target.closest ? e.target.closest('[data-ve-layer]') : null
      if (!btn) return
      var host = document.querySelector('[data-pw-block-id="' + box.getAttribute('data-ve-block-id') + '"]')
      if (!host) return
      applyLayerMode(btn.getAttribute('data-ve-layer'), host)
    })
    return box
  }
  function syncLayerSwitchState() {
    var nodes = document.querySelectorAll('.nanoai-ve-layer-switch')
    for (var i = 0; i < nodes.length; i++) {
      var box = nodes[i]
      var bid = box.getAttribute('data-ve-block-id')
      var block = bid ? document.querySelector('[data-pw-block-id="' + bid + '"]') : null
      var imgTarget = block ? imageTargetOf(block) : null
      var blockOn = !!(selected && block && selected === block && layerMode === 'block')
      var imageOn = !!(selected && block && layerMode === 'image' && (selected === imgTarget || selected === block))
      var btns = box.querySelectorAll('[data-ve-layer]')
      for (var j = 0; j < btns.length; j++) {
        var mode = btns[j].getAttribute('data-ve-layer')
        btns[j].className = (mode === 'block' ? blockOn : imageOn) ? 'is-active' : ''
      }
    }
  }
  function syncLayerSwitches() {
    if (!document.body.classList.contains('nanoai-ve-active')) {
      hideLayerSwitches()
      return
    }
    var blocks = listImageLayerBlocks()
    var keep = {}
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i]
      var box = ensureLayerSwitch(block)
      keep[box.id] = 1
      positionLayerSwitch(block, box)
    }
    var nodes = document.querySelectorAll('.nanoai-ve-layer-switch')
    for (var k = 0; k < nodes.length; k++) {
      if (!keep[nodes[k].id]) nodes[k].remove()
    }
    syncLayerSwitchState()
  }
  function hideLogoButtons() {
    var nodes = document.querySelectorAll('.nanoai-ve-logo-btn')
    for (var i = 0; i < nodes.length; i++) nodes[i].remove()
  }
  function positionLogoButton(slot, box) {
    var r = slot.getBoundingClientRect()
    box.style.position = 'fixed'
    box.style.left = Math.max(8, r.left) + 'px'
    box.style.top = Math.max(8, r.bottom + 4) + 'px'
    box.style.zIndex = '2147483646'
  }
  function ensureLogoButton(slot, idx) {
    var id = 'nanoai-ve-logo-' + logoSlotKind(slot) + '-' + idx
    var box = document.getElementById(id)
    if (!box) {
      box = document.createElement('div')
      box.id = id
      box.className = 'nanoai-ve-logo-btn nanoai-ve-ignore'
      box.setAttribute('data-nanoai-ve-ignore', '1')
      var b = document.createElement('button')
      b.type = 'button'
      b.textContent = logoButtonLabel(slot)
      box.appendChild(b)
      document.body.appendChild(box)
      box.addEventListener('mousedown', function (e) {
        e.preventDefault()
        e.stopPropagation()
      })
      box.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        var i = Number(box.getAttribute('data-ve-logo-idx') || 0)
        var slotsNow = listLogoSlots()
        var target = slotsNow[i] || slotsNow[0]
        if (!target) return
        selectEl(target)
        post('logoCreate', buildPayload(target))
      })
    }
    box.setAttribute('data-ve-logo-idx', String(idx))
    var labelBtn = box.querySelector('button')
    if (labelBtn) labelBtn.textContent = logoButtonLabel(slot)
    return box
  }
  function syncLogoButtons() {
    hideLogoButtons()
  }
  function positionLogoButtons() {
    var slots = listLogoSlots()
    var nodes = document.querySelectorAll('.nanoai-ve-logo-btn')
    for (var i = 0; i < nodes.length && i < slots.length; i++) {
      positionLogoButton(slots[i], nodes[i])
    }
  }
  function hideLogoDrawRect() {
    var el = document.getElementById('nanoai-ve-logo-rect')
    if (el) el.remove()
  }
  function logoDrawBox() {
    var x = Math.min(logoDraw.x1, logoDraw.x2)
    var y = Math.min(logoDraw.y1, logoDraw.y2)
    var w = Math.abs(logoDraw.x2 - logoDraw.x1)
    var h = Math.abs(logoDraw.y2 - logoDraw.y1)
    return { x: x, y: y, w: w, h: h }
  }
  function showLogoDrawRect() {
    var box = logoDrawBox()
    var el = document.getElementById('nanoai-ve-logo-rect')
    if (!el) {
      el = document.createElement('div')
      el.id = 'nanoai-ve-logo-rect'
      el.className = 'nanoai-ve-logo-rect nanoai-ve-ignore'
      el.setAttribute('data-nanoai-ve-ignore', '1')
      document.body.appendChild(el)
    }
    el.style.left = box.x + 'px'
    el.style.top = box.y + 'px'
    el.style.width = box.w + 'px'
    el.style.height = box.h + 'px'
  }
  function cancelAddLogo() {
    logoDraw.on = false
    logoDraw.dragging = false
    document.body.classList.remove('nanoai-ve-logo-draw')
    hideLogoDrawRect()
    post('logoDrawEnd', {})
  }
  function startAddLogo() {
    logoDraw.on = true
    logoDraw.dragging = false
    document.body.classList.add('nanoai-ve-logo-draw')
    hideLogoDrawRect()
    post('logoDrawStart', {})
  }
  function finishAddLogo() {
    var box = logoDrawBox()
    cancelAddLogo()
    if (box.w < 24 || box.h < 16) return
    var cx = box.x + box.w / 2
    var cy = box.y + box.h / 2
    var under = null
    try { under = document.elementFromPoint(cx, cy) } catch (e) { under = null }
    var bg = sampleSurroundingBg(under && under.nodeType === 1 ? under : document.body)
    var host = document.body
    try {
      if (cs(host).position === 'static') host.style.position = 'relative'
    } catch (err) {}
    var hr = host.getBoundingClientRect()
    var img = document.createElement('img')
    img.className = 'pw-logo pw-shop-logo'
    img.setAttribute('data-pw-logo-added', '1')
    img.setAttribute('data-pw-logo-empty', '1')
    img.setAttribute('data-pw-logo-slot', logoSlotKind(under && under.nodeType === 1 ? under : host))
    img.setAttribute('data-pw-device', editDevice === 'mobile' ? 'mobile' : 'desktop')
    img.setAttribute('alt', 'logo')
    img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    img.style.position = 'absolute'
    img.style.left = (box.x - hr.left) + 'px'
    img.style.top = (box.y - hr.top) + 'px'
    img.style.width = Math.round(box.w) + 'px'
    img.style.height = Math.round(box.h) + 'px'
    img.style.objectFit = 'contain'
    img.style.backgroundColor = bg || '#ffffff'
    img.style.zIndex = '40'
    host.appendChild(img)
    selectEl(img)
    post('dirty', {})
    post('logoCreate', buildPayload(img))
    syncLogoButtons()
  }
  function positionLayerSwitches() {
    var nodes = document.querySelectorAll('.nanoai-ve-layer-switch')
    for (var i = 0; i < nodes.length; i++) {
      var box = nodes[i]
      var bid = box.getAttribute('data-ve-block-id')
      var block = bid ? document.querySelector('[data-pw-block-id="' + bid + '"]') : null
      if (block) positionLayerSwitch(block, box)
    }
  }
  function hideDeleteHandle() {
    var d = document.querySelector('.nanoai-ve-delete-handle,.nanoai-ve-chrome-delete')
    if (d) d.remove()
  }
  function hideChromeDelete() { hideDeleteHandle() }
  function hideDropLine() {
    var el = document.querySelector('.nanoai-ve-drop-line')
    if (el) el.remove()
  }
  function hideAlignGuides() {
    var box = document.getElementById('nanoai-ve-guides')
    if (box) box.remove()
  }
  function ensureAlignGuides() {
    var box = document.getElementById('nanoai-ve-guides')
    if (box) return box
    box = document.createElement('div')
    box.id = 'nanoai-ve-guides'
    box.className = 'nanoai-ve-guides nanoai-ve-ignore'
    box.setAttribute('data-nanoai-ve-ignore', '1')
    box.innerHTML = '<div class="nanoai-ve-guide-h"></div><div class="nanoai-ve-guide-v"></div>'
    document.body.appendChild(box)
    return box
  }
  function alignmentPeers(el) {
    var out = []
    var p = el && el.parentElement
    if (!p) return out
    for (var i = 0; i < p.children.length; i++) {
      var kid = p.children[i]
      if (kid === el || kid.nodeType !== 1) continue
      if (isIgnored(kid)) continue
      out.push(kid)
    }
    return out
  }
  function snapSelected() {
    if (!selected) return
    var r = selected.getBoundingClientRect()
    var peers = alignmentPeers(selected)
    var SNAP = 4
    var dx = 0
    var dy = 0
    var i
    for (i = 0; i < peers.length; i++) {
      var o = peers[i].getBoundingClientRect()
      if (!dy) {
        if (Math.abs(r.bottom - o.bottom) <= SNAP) dy = o.bottom - r.bottom
        else if (Math.abs(r.top - o.top) <= SNAP) dy = o.top - r.top
      }
      if (!dx) {
        if (Math.abs(r.left - o.left) <= SNAP) dx = o.left - r.left
        else if (Math.abs(r.right - o.right) <= SNAP) dx = o.right - r.right
        else if (Math.abs(r.left + r.width / 2 - (o.left + o.width / 2)) <= SNAP) {
          dx = o.left + o.width / 2 - (r.left + r.width / 2)
        }
      }
    }
    if (dx || dy) {
      var p = parseTransform(selected)
      selected.style.transform = 'translate(' + (p.x + dx) + 'px,' + (p.y + dy) + 'px)'
    }
  }
  function positionAlignGuides() {
    if (!selected) { hideAlignGuides(); return }
    var box = ensureAlignGuides()
    var h = box.querySelector('.nanoai-ve-guide-h')
    var v = box.querySelector('.nanoai-ve-guide-v')
    if (!h || !v) return
    var r = selected.getBoundingClientRect()
    var docW = Math.max(document.documentElement.clientWidth, window.innerWidth)
    var docH = Math.max(document.documentElement.clientHeight, window.innerHeight)
    h.style.left = '0px'
    h.style.width = docW + 'px'
    h.style.top = (r.top + r.height / 2) + 'px'
    v.style.top = '0px'
    v.style.height = docH + 'px'
    v.style.left = (r.left + r.width / 2) + 'px'
    var peers = alignmentPeers(selected)
    var snapH = false
    var snapV = false
    for (var i = 0; i < peers.length; i++) {
      var o = peers[i].getBoundingClientRect()
      if (Math.abs(r.bottom - o.bottom) <= 1 || Math.abs(r.top - o.top) <= 1) snapH = true
      if (Math.abs(r.left - o.left) <= 1 || Math.abs(r.right - o.right) <= 1) snapV = true
    }
    h.className = 'nanoai-ve-guide-h' + (snapH ? ' is-snap' : '')
    v.className = 'nanoai-ve-guide-v' + (snapV ? ' is-snap' : '')
  }
  function showAlignGuides(el) {
    if (!el) { hideAlignGuides(); return }
    ensureAlignGuides()
    positionAlignGuides()
  }
  function positionMoveHandle(el, h) {
    var r = el.getBoundingClientRect()
    h.style.position = 'fixed'
    h.style.left = r.left - 8 + 'px'
    h.style.top = r.top - 8 + 'px'
    h.style.zIndex = '2147483646'
  }
  function positionDeleteHandle(el, h) {
    var r = el.getBoundingClientRect()
    h.style.position = 'fixed'
    h.style.left = r.right - 9 + 'px'
    h.style.top = r.top - 9 + 'px'
    h.style.zIndex = '2147483646'
  }
  function positionAllHandles() {
    positionLayerSwitches()
    positionLogoButtons()
    if (!selected) return
    var mv = document.querySelector('.nanoai-ve-move-handle')
    if (mv) positionMoveHandle(selected, mv)
    var del = document.querySelector('.nanoai-ve-delete-handle,.nanoai-ve-chrome-delete')
    if (del) positionDeleteHandle(selected, del)
    var rs = document.querySelector('.nanoai-ve-resize-handle')
    if (rs && isImgEl(selected)) positionResizeHandle(selected, rs)
    positionAlignGuides()
  }
  function beginHandleDrag(e) {
    if (!selected || !canDragEl(selected)) return
    var p = parseTransform(selected)
    drag.ready = true
    drag.active = false
    drag.startX = e.clientX
    drag.startY = e.clientY
    drag.baseX = p.x
    drag.baseY = p.y
    drag.mode = dragModeFor(selected)
    drag.dropTarget = null
    drag.dropHost = null
    drag.dropBefore = true
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    e.preventDefault()
    e.stopPropagation()
    if (selected.getAttribute('contenteditable') === 'true') {
      try { selected.blur() } catch (err) {}
    }
  }
  function showMoveHandle(el) {
    hideMoveHandle()
    if (!el || !canDragEl(el)) return
    var h = document.createElement('button')
    h.type = 'button'
    h.className = 'nanoai-ve-move-handle nanoai-ve-ignore'
    h.setAttribute('data-nanoai-ve-ignore', '1')
    h.setAttribute('aria-label', 'Move')
    h.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>'
    document.body.appendChild(h)
    positionMoveHandle(el, h)
    h.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return
      beginHandleDrag(e)
    })
  }
  function showDeleteHandle(el) {
    hideDeleteHandle()
    if (!el || !canDeleteEl(el)) return
    var h = document.createElement('button')
    h.type = 'button'
    h.className = 'nanoai-ve-delete-handle nanoai-ve-chrome-delete nanoai-ve-ignore'
    h.setAttribute('data-nanoai-ve-ignore', '1')
    h.setAttribute('aria-label', 'Remove')
    h.textContent = '+'
    document.body.appendChild(h)
    positionDeleteHandle(el, h)
    h.addEventListener('mousedown', function (e) {
      e.preventDefault()
      e.stopPropagation()
    })
    h.addEventListener('click', function (e) {
      e.preventDefault()
      e.stopPropagation()
      deleteSelectedUnit()
    })
  }
  function showDropLine(target, before, horizontal) {
    hideDropLine()
    if (!target) return
    var r = target.getBoundingClientRect()
    var line = document.createElement('div')
    line.className = 'nanoai-ve-drop-line nanoai-ve-ignore'
    line.setAttribute('data-nanoai-ve-ignore', '1')
    if (horizontal) {
      line.style.left = (before ? r.left : r.right) - 2 + window.scrollX + 'px'
      line.style.top = r.top + window.scrollY + 'px'
      line.style.width = '4px'
      line.style.height = r.height + 'px'
    } else {
      line.style.left = r.left + window.scrollX + 'px'
      line.style.top = (before ? r.top : r.bottom) - 2 + window.scrollY + 'px'
      line.style.width = r.width + 'px'
      line.style.height = '4px'
    }
    document.body.appendChild(line)
  }
  function isRowParent(el) {
    var p = el && el.parentElement
    if (!p) return false
    try {
      var fd = cs(p).flexDirection || ''
      return fd === 'row' || fd === 'row-reverse'
    } catch (err) { return false }
  }
  function updateDropTarget(e) {
    if (!selected) return
    if (isAddedChrome(selected)) {
      var host = chromeDropHostFromPoint(e.clientX, e.clientY)
      drag.dropHost = host
      if (!host) {
        drag.dropTarget = null
        hideDropLine()
        return
      }
      var slot = chromeSlotAtX(host, e.clientX, selected)
      drag.dropTarget = slot.beforeEl
      drag.dropBefore = slot.before
      if (slot.beforeEl) showDropLine(slot.beforeEl, slot.before, true)
      else hideDropLine()
      return
    }
    var parent = selected.parentElement
    var stack = []
    try { stack = document.elementsFromPoint(e.clientX, e.clientY) || [] } catch (err) { stack = [] }
    var hit = null
    for (var i = 0; i < stack.length; i++) {
      var node = stack[i]
      if (isIgnored(node) || node === selected) continue
      if (isContentBlockEl(selected)) {
        var b = isContentBlockEl(node) ? node : findContentBlockEl(node)
        if (b && b !== selected) { hit = b; break }
      } else if (parent) {
        var walk = node
        while (walk && walk.parentElement !== parent) walk = walk.parentElement
        if (walk && walk !== selected && walk.parentElement === parent) { hit = walk; break }
      }
    }
    drag.dropTarget = hit
    if (!hit) { hideDropLine(); return }
    var r = hit.getBoundingClientRect()
    var horizontal = isRowParent(selected)
    drag.dropBefore = horizontal ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2
    showDropLine(hit, drag.dropBefore, horizontal)
  }
  function applyReorder() {
    var target = drag.dropTarget
    if (!selected || !target || target === selected || !target.parentNode) return
    if (drag.dropBefore) target.parentNode.insertBefore(selected, target)
    else target.parentNode.insertBefore(selected, target.nextSibling)
    selected.style.transform = ''
    selected.style.opacity = ''
  }
  function deleteSelectedUnit() {
    if (!selected || !selected.parentNode || !canDeleteEl(selected)) return
    selected.parentNode.removeChild(selected)
    selected = null
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
    post('deselect', {})
    post('dirty', {})
    postHidden()
    syncLayerSwitches()
  }
  function hideResizeHandle() {
    var h = document.querySelector('.nanoai-ve-resize-handle')
    if (h) h.remove()
  }
  function positionResizeHandle(img, h) {
    var r = img.getBoundingClientRect()
    h.style.position = 'fixed'
    h.style.left = r.right - 8 + 'px'
    h.style.top = r.bottom - 8 + 'px'
    h.style.zIndex = '2147483646'
  }
  function showResizeHandle(img) {
    hideResizeHandle()
    if (!img || !isImgEl(img)) return
    var h = document.createElement('div')
    h.className = 'nanoai-ve-resize-handle nanoai-ve-ignore'
    h.setAttribute('data-nanoai-ve-ignore', '1')
    document.body.appendChild(h)
    positionResizeHandle(img, h)
    h.addEventListener('mousedown', function (e) {
      e.preventDefault()
      e.stopPropagation()
      resize.active = true
      resize.startX = e.clientX
      resize.startW = img.getBoundingClientRect().width
    })
  }
  function placeCaretAtPoint(el, clientX, clientY) {
    if (!el) return
    el.setAttribute('contenteditable', 'true')
    try { el.focus() } catch (err) {}
    try {
      var sel = window.getSelection()
      if (!sel) return
      if (document.caretRangeFromPoint) {
        var range = document.caretRangeFromPoint(clientX, clientY)
        if (range && el.contains(range.startContainer)) {
          sel.removeAllRanges()
          sel.addRange(range)
          return
        }
      }
      if (document.caretPositionFromPoint) {
        var pos = document.caretPositionFromPoint(clientX, clientY)
        if (pos && pos.offsetNode && el.contains(pos.offsetNode)) {
          var range2 = document.createRange()
          range2.setStart(pos.offsetNode, pos.offset)
          range2.collapse(true)
          sel.removeAllRanges()
          sel.addRange(range2)
        }
      }
    } catch (err2) {}
  }
  function selectEl(el, ev) {
    if (!el || el === document.documentElement || el === document.body) return
    var same = selected === el
    if (!same) clearSelection()
    if (hoverEl === el) {
      el.classList.remove('nanoai-ve-hover')
      hoverEl = null
    }
    selected = el
    selected.classList.add('nanoai-ve-highlight')
    selected.setAttribute('data-nanoai-ve-selected', '1')
    var payload = buildPayload(selected)
    if (canEditText(selected) || selected.getAttribute('data-pw-added-btn') === '1') {
      selected.setAttribute('contenteditable', 'true')
      if (ev && typeof ev.clientX === 'number') placeCaretAtPoint(selected, ev.clientX, ev.clientY)
    } else if (isChromeBtn(selected) || payload.isButton) {
      try { selected.focus() } catch (err) {}
    }
    showMoveHandle(selected)
    if (canDeleteEl(selected)) showDeleteHandle(selected)
    if (payload.isImage) showResizeHandle(selected)
    showAlignGuides(selected)
    syncLayerSwitches()
    syncLogoButtons()
    post('select', payload)
  }
  function findSelectable(start) {
    var el = start
    if (el && el.nodeType !== 1) el = el.parentElement
    var walk = el
    while (walk && walk !== document.body) {
      if (isChromeBtn(walk) || (walk.closest && walk.closest('.pw-icon-btn,[data-pw-chrome-btn]'))) {
        return walk.closest ? (walk.closest('.pw-icon-btn,[data-pw-chrome-btn]') || walk) : walk
      }
      if (walk.getAttribute && walk.getAttribute('data-pw-logo-added') === '1') return walk
      if (isLogoImg(walk)) return walk
      if (isHeaderWidget(walk)) return walk
      if (isImgEl(walk)) return walk
      if (isBtnEl(walk)) return walk
      if (isTextEl(walk)) return walk
      walk = walk.parentElement
    }
    var bgHost = findBgImageEl(el)
    if (bgHost) return bgHost
    walk = el
    while (walk && walk !== document.body) {
      if (isContentBlockEl(walk)) return walk
      walk = walk.parentElement
    }
    return null
  }
  function onMouseDown(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (e.button !== 0) return
    if (logoDraw.on) {
      e.preventDefault()
      e.stopPropagation()
      logoDraw.dragging = true
      logoDraw.x1 = e.clientX
      logoDraw.y1 = e.clientY
      logoDraw.x2 = e.clientX
      logoDraw.y2 = e.clientY
      showLogoDrawRect()
      return
    }
    if (isIgnored(e.target) || isOverlayNode(e.target)) return
    var found = findSelectable(e.target)
    if (!found || !isAddedChrome(found) || !canDragEl(found)) return
    if (selected !== found) selectEl(found)
    beginHandleDrag(e)
  }
  function onClick(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (logoDraw.on) { e.preventDefault(); e.stopPropagation(); return }
    if (skipClick) { skipClick = false; e.preventDefault(); e.stopPropagation(); return }
    var t = e.target
    if (isIgnored(t) || isOverlayNode(t)) return
    if (selected && selected.contains(t) && selected.getAttribute('contenteditable') === 'true' && !drag.active) {
      e.preventDefault()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      var block = findContentBlockEl(t) || findBlockEl(t)
      if (block) { selectEl(block, e); return }
    }
    var found = findSelectable(t)
    if (found) {
      if (canImageLayer(found) && !isTextEl(t) && !isBtnEl(t) && !isImgEl(t)) {
        layerMode = 'image'
        selectEl(imageTargetOf(found) || found, e)
        return
      }
      selectEl(found, e)
      return
    }
    var emptyBlock = findContentBlockEl(t)
    if (emptyBlock) { selectEl(emptyBlock, e); return }
    clearSelection()
    post('deselect', {})
  }
  function onInput() {
    if (!selected || selected.getAttribute('contenteditable') !== 'true') return
    post('dirty', {})
    post('select', buildPayload(selected))
  }
  function onMouseOver(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    var t = e.target
    if (isIgnored(t)) return
    var found = findSelectable(t)
    if (!found || found === selected) {
      if (hoverEl && hoverEl !== found) {
        hoverEl.classList.remove('nanoai-ve-hover')
        hoverEl = null
      }
      return
    }
    if (hoverEl && hoverEl !== found) hoverEl.classList.remove('nanoai-ve-hover')
    hoverEl = found
    found.classList.add('nanoai-ve-hover')
  }
  function onMouseMove(e) {
    if (logoDraw.on && logoDraw.dragging) {
      e.preventDefault()
      logoDraw.x2 = e.clientX
      logoDraw.y2 = e.clientY
      showLogoDrawRect()
      return
    }
    if (resize.active && selected && isImgEl(selected)) {
      var dx = e.clientX - resize.startX
      var nw = Math.max(40, resize.startW + dx)
      selected.style.width = nw + 'px'
      selected.style.height = 'auto'
      selected.style.maxWidth = '100%'
      positionAllHandles()
      post('dirty', {})
      return
    }
    if (drag.ready && !drag.active && selected) {
      var adx = Math.abs(e.clientX - drag.startX)
      var ady = Math.abs(e.clientY - drag.startY)
      if (adx + ady > 6) {
        drag.active = true
        ensureDragDisplay(selected)
        selected.classList.add('nanoai-ve-dragging')
        document.body.classList.add('nanoai-ve-dragging')
        if (isAddedChrome(selected)) selected.style.pointerEvents = 'none'
        if (selected.getAttribute('contenteditable') === 'true') {
          try { selected.blur() } catch (err) {}
        }
      }
    }
    if (!drag.active || !selected) return
    e.preventDefault()
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    var dx2 = e.clientX - drag.startX
    var dy = e.clientY - drag.startY
    selected.style.transform = 'translate(' + (drag.baseX + dx2) + 'px,' + (drag.baseY + dy) + 'px)'
    if (drag.mode === 'reorder' || isAddedChrome(selected)) {
      selected.style.opacity = '0.55'
      updateDropTarget(e)
    } else {
      snapSelected()
    }
    positionAllHandles()
    post('dirty', {})
  }
  function onMouseUp() {
    if (logoDraw.on && logoDraw.dragging) {
      logoDraw.dragging = false
      finishAddLogo()
      skipClick = true
      return
    }
    if (resize.active) {
      resize.active = false
      if (selected && isImgEl(selected)) post('select', buildPayload(selected))
      positionAllHandles()
      return
    }
    var wasDrag = drag.active
    var mode = drag.mode
    drag.ready = false
    drag.active = false
    document.body.classList.remove('nanoai-ve-dragging')
    if (selected) selected.classList.remove('nanoai-ve-dragging')
    if (wasDrag && selected && isAddedChrome(selected)) {
      var host = chromeDropHostFromPoint(drag.lastX, drag.lastY) || drag.dropHost
      if (host) {
        var slot = chromeSlotAtX(host, drag.lastX, selected)
        snapChromeToHost(selected, host, slot.beforeEl, slot.before)
      } else {
        selected.style.opacity = ''
        selected.style.pointerEvents = ''
      }
    } else if (wasDrag && selected && mode === 'reorder') {
      if (drag.dropTarget) applyReorder()
      selected.style.opacity = ''
    }
    hideDropLine()
    drag.dropTarget = null
    if (wasDrag) skipClick = true
    if (wasDrag && selected && canDragEl(selected)) {
      positionAllHandles()
      post('select', buildPayload(selected))
      post('dirty', {})
    }
  }
  function injectStyles() {
    if (document.getElementById('nanoai-visual-editor-styles')) return
    var s = document.createElement('style')
    s.id = 'nanoai-visual-editor-styles'
    s.textContent = [
      '.nanoai-ve-active{cursor:crosshair!important}',
      '.nanoai-ve-logo-draw,.nanoai-ve-logo-draw *{cursor:crosshair!important}',
      '.nanoai-ve-logo-rect{position:fixed!important;z-index:2147483646!important;pointer-events:none;border:2px dashed #f59e0b;background:rgba(245,158,11,.14)}',
      '.nanoai-ve-highlight{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '.nanoai-ve-hover{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '[contenteditable=true]{cursor:text!important;min-width:0;outline:none!important}',
      '[contenteditable=true].nanoai-ve-highlight,[contenteditable=true].nanoai-ve-hover{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '.nanoai-ve-highlight.pw-btn,.nanoai-ve-highlight[data-pw-added-btn],.nanoai-ve-hover.pw-btn,.nanoai-ve-hover[data-pw-added-btn]{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '[data-pw-added-text]{display:inline-block!important;width:auto!important;max-width:100%;margin:6px 8px;padding:0;line-height:1.25}',
      '[data-pw-added-btn]{display:inline-flex!important;width:max-content!important;max-width:100%;height:auto!important;margin:0;align-items:center;justify-content:center;white-space:nowrap;z-index:40}',
      '.pw-btn-outline{background:transparent;border-radius:12px;border-style:solid;border-width:2px}',
      '.nanoai-ve-dragging,.nanoai-ve-dragging *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}',
      '.nanoai-ve-resize-handle,.nanoai-ve-move-handle,.nanoai-ve-chrome-delete,.nanoai-ve-delete-handle,.nanoai-ve-drop-line,.nanoai-ve-guides,.nanoai-ve-layer-switch,.nanoai-ve-logo-btn{position:fixed!important;z-index:2147483646!important;pointer-events:auto}',
      '.nanoai-ve-guides,.nanoai-ve-drop-line{pointer-events:none!important}',
      '.nanoai-ve-resize-handle{width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;box-shadow:0 1px 4px rgba(0,0,0,.3)}',
      '.nanoai-ve-move-handle{width:22px;height:22px;padding:0;border:2px solid #fff;border-radius:6px;background:#2563eb;color:#fff;cursor:grab;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35)}',
      '.nanoai-ve-move-handle svg{display:block;pointer-events:none}',
      '.nanoai-ve-layer-switch{display:flex;gap:4px;padding:3px;border-radius:8px;background:#fff;border:1px solid #bfdbfe;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
      '.nanoai-ve-layer-switch button{border:0;border-radius:6px;padding:5px 9px;font:700 11px/1.2 system-ui,sans-serif;background:transparent;color:#1e3a8a;cursor:pointer}',
      '.nanoai-ve-layer-switch button.is-active{background:#2563eb;color:#fff}',
      '.nanoai-ve-logo-btn{display:flex;padding:3px;border-radius:8px;background:#fff;border:1px solid #fbbf24;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
      '.nanoai-ve-logo-btn button{border:0;border-radius:6px;padding:5px 9px;font:700 11px/1.2 system-ui,sans-serif;background:#f59e0b;color:#fff;cursor:pointer}',
      '.nanoai-ve-chrome-delete,.nanoai-ve-delete-handle{width:18px;height:18px;padding:0;border:2px solid #fff;border-radius:999px;background:#ef4444;color:#fff;font:700 14px/14px system-ui,sans-serif;cursor:pointer;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.35)}',
      '.nanoai-ve-drop-line{background:#2563eb;border-radius:2px;box-shadow:0 0 0 1px #fff}',
      '.nanoai-ve-guides{left:0;top:0}',
      '.nanoai-ve-active .pw-bottom-nav,.nanoai-ve-active .pw-shop-bottom-nav{z-index:1!important;overflow:visible!important}',
      '.nanoai-ve-active [data-pw-chrome-added],.nanoai-ve-active [data-nanoai-ve-selected]{z-index:80!important;position:relative}',
      '.nanoai-ve-guide-h{position:absolute;height:1px;background:repeating-linear-gradient(90deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-v{position:absolute;width:1px;background:repeating-linear-gradient(180deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-h.is-snap,.nanoai-ve-guide-v.is-snap{background:#2563eb;opacity:.85}',
      '.nanoai-ve-active [data-pw-hidden="1"]{display:revert!important;opacity:.45;outline:1px dashed #64748b!important}',
      '.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap;justify-content:space-around;align-items:stretch;grid-template-columns:none!important}',
      '.pw-bottom-nav a:not([data-pw-chrome-added]),.pw-shop-bottom-nav a:not([data-pw-chrome-added]),.pw-bottom-nav .pw-icon-btn:not([data-pw-chrome-added]),.pw-shop-bottom-nav .pw-icon-btn:not([data-pw-chrome-added]){flex:1 1 0;min-width:0;min-height:0;width:auto!important;height:auto!important;color:#6b7280!important;flex-direction:column;align-items:center;justify-content:center;background:transparent!important}',
      '.pw-bottom-nav [data-pw-chrome-added],.pw-shop-bottom-nav [data-pw-chrome-added]{flex:1 1 0;min-width:0;min-height:0;width:auto!important;height:auto!important;flex-direction:column;align-items:center;justify-content:center;background:transparent!important;cursor:grab}',
      '.pw-header-actions [data-pw-chrome-added],.pw-shop-header-actions [data-pw-chrome-added]{display:inline-flex!important;flex:0 0 auto;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:auto!important;height:auto!important;min-width:0;min-height:36px;padding:0 10px;font-size:13px;font-weight:700;background:transparent!important;cursor:grab}',
      '.pw-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-added] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-shop-nav-label{display:inline!important;max-width:none!important;overflow:visible!important;white-space:nowrap!important;font-size:13px!important;font-weight:700;line-height:1.2}',
      '.pw-nav-main [data-pw-chrome-added],.pw-shop-nav-row [data-pw-chrome-added]{display:inline-flex;align-items:center;justify-content:center;gap:6px;width:auto!important;height:auto!important;background:transparent!important;cursor:grab}',
      '.pw-bottom-nav svg,.pw-shop-bottom-nav svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;stroke:currentColor!important;fill:none!important}',
      '.pw-bottom-nav .pw-chrome-icon-wrap,.pw-shop-bottom-nav .pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center;justify-content:center;width:22px!important;height:22px!important;overflow:visible!important}',
      '.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label{display:block!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important;color:inherit!important;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word}',
      '.pw-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge,.pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge,.pw-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge,.pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;z-index:2}'
    ].join('')
    document.head.appendChild(s)
  }
  function activate() {
    injectStyles()
    pinChromeIconBadges(document)
    document.body.classList.add('nanoai-ve-active')
    document.addEventListener('click', onClick, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('input', onInput, true)
    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', function () {
      positionAllHandles()
    }, true)
    post('ready', { hint: COPY.selectHint })
    historyStack = []
    historyIndex = -1
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null }
    postHidden()
    syncLayerSwitches()
    syncLogoButtons()
    pushHistory()
  }
  function deactivate() {
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null }
    hideLayerSwitches()
    hideLogoButtons()
    cancelAddLogo()
    document.body.classList.remove('nanoai-ve-active')
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('mouseup', onMouseUp, true)
    document.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('keydown', onKeyDown, true)
    clearHover()
    clearSelection()
    post('inactive', {})
  }
  function refreshSelect() { if (selected) post('select', buildPayload(selected)) }
  function applyImageUrl(url, allSlots) {
    if (!url) return
    if (selected && (isLogoSlot(selected) || isLogoImg(selected))) {
      var filled = countFilledLogoSlots()
      var applyAll = allSlots === true || (allSlots !== false && filled === 0)
      var next = selected
      if (applyAll) {
        var slots = listLogoSlots()
        for (var i = 0; i < slots.length; i++) {
          var applied = applyLogoToEl(slots[i], url)
          if (slots[i] === selected || (selected.contains && selected.contains(slots[i]))) next = applied
        }
      } else {
        next = applyLogoToEl(canonicalLogoEl(selected) || selected, url)
      }
      post('dirty', {})
      if (next && next !== selected) selectEl(next)
      else refreshSelect()
      syncLogoButtons()
      return
    }
    if (!selected) return
    if (isImgEl(selected)) {
      selected.setAttribute('src', url)
      selected.removeAttribute('srcset')
      selected.style.transform = ''
    } else {
      var cur = ''
      try { cur = selected.style.backgroundImage || cs(selected).backgroundImage || '' } catch (e) { cur = '' }
      selected.style.backgroundImage = replaceBgUrl(cur, url)
    }
    post('dirty', {})
    refreshSelect()
  }
  window.addEventListener('message', function (ev) {
    var d = ev.data
    if (!d || d.source !== MSG) return
    if (d.type === 'activate') {
      if (d.device === 'mobile' || d.device === 'desktop') editDevice = d.device
      activate()
    }
    if (d.type === 'deactivate') deactivate()
    if (d.type === 'startAddLogo') startAddLogo()
    if (d.type === 'cancelAddLogo') cancelAddLogo()
    if (d.type === 'captureLogoContext') {
      var ctxEl = selected
      if (!ctxEl) {
        post('logoContext', { requestId: d.requestId || '', dataUrl: '' })
      } else {
        captureLogoContextPng(ctxEl, function (dataUrl, theme, bg, bgImg) {
          post('logoContext', {
            requestId: d.requestId || '',
            dataUrl: dataUrl,
            bgColor: bg,
            bgImageUrl: bgImg,
            themePrimary: theme.themePrimary,
            themeAccent: theme.themeAccent,
            themeBuy: theme.themeBuy
          })
        })
      }
    }
    if (d.type === 'setColor' && selected && d.color) {
      if (isBtnEl(selected) && !isChromeBtn(selected)) applyBtnTextColor(selected, d.color)
      else selected.style.color = d.color
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setFontSize' && selected && d.size) { selected.style.fontSize = Math.max(10, Math.min(96, Number(d.size))) + 'px'; post('dirty', {}); refreshSelect() }
    if (d.type === 'setFontWeight' && selected) {
      var w = selected.style.fontWeight === '700' || selected.style.fontWeight === 'bold' ? '400' : '700'
      if (d.bold === true) w = '700'
      if (d.bold === false) w = '400'
      selected.style.fontWeight = w
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setTextAlign' && selected && d.align) { selected.style.textAlign = d.align; post('dirty', {}); refreshSelect() }
    if (d.type === 'setBgColor' && selected && d.color) { selected.style.backgroundColor = d.color; post('dirty', {}); refreshSelect() }
    if (d.type === 'setImageWidth' && selected && isImgEl(selected) && d.width) {
      selected.style.width = Math.max(20, Math.min(100, Number(d.width))) + '%'
      selected.style.height = 'auto'
      selected.style.maxWidth = '100%'
      positionAllHandles()
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'resetImageTransform' && selected && canDragEl(selected)) {
      selected.style.transform = ''
      positionAllHandles()
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setImageSrc' && d.url) applyImageUrl(d.url, d.allSlots)
    if (d.type === 'setLogoCrop' && selected && isImgEl(selected)) {
      selected.style.objectFit = 'cover'
      selected.style.objectPosition = (Number(d.x) || 50) + '% ' + (Number(d.y) || 50) + '%'
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setHref' && selected && typeof d.href === 'string') {
      var link = selected.tagName.toLowerCase() === 'a' ? selected : (selected.closest ? selected.closest('a') : null)
      if (link) {
        link.setAttribute('href', d.href)
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setLayerMode' && d.mode) {
      var layerHost = selected && canImageLayer(selected) ? selected : (selected ? findContentBlockEl(selected) : null)
      if (layerHost && canImageLayer(layerHost)) applyLayerMode(d.mode, layerHost)
    }
    if (d.type === 'selectParentBlock') {
      var pb = selected ? findContentBlockEl(selected) : null
      if (pb) selectEl(pb)
    }
    if (d.type === 'hideBlock') hideSelectedBlock()
    if (d.type === 'showHidden' && d.id) showHiddenBlock(d.id)
    if (d.type === 'deleteBlock') deleteSelectedBlock()
    if (d.type === 'duplicateBlock') duplicateSelectedBlock()
    if (d.type === 'insertChromeBtn') insertChromeBtn(d.kind, d.html, d.host)
    if (d.type === 'insertText') insertText()
    if (d.type === 'insertButton') insertButton(d)
    if (d.type === 'setChromeStyle') setChromeStyle(d.style)
    if (d.type === 'setButtonStyle') setButtonStyle(d.style)
    if (d.type === 'setButtonLabel') setButtonLabel(d.text)
    if (d.type === 'setButtonColor') setButtonColor(d.color)
    if (d.type === 'setButtonBorder') setButtonBorder(d.color)
    if (d.type === 'deleteChromeBtn') deleteSelectedUnit()
    if (d.type === 'deleteUnit') deleteSelectedUnit()
    if (d.type === 'nudge') nudgeSelected(Number(d.dx) || 0, Number(d.dy) || 0)
    if (d.type === 'setOverlay') {
      var ob = selected && canOverlayBlock(selected) ? selected : (selected ? findContentBlockEl(selected) : null)
      if (ob && canOverlayBlock(ob)) {
        setOverlayPct(ob, d.value)
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setPadding') {
      var blk = selected && (isContentBlockEl(selected) || isBlockEl(selected)) ? selected : (selected ? findContentBlockEl(selected) : null)
      if (blk) {
        var target = paddingTarget(blk)
        if (typeof d.y === 'number') {
          var y = Math.max(0, Math.min(160, Math.round(Number(d.y))))
          target.style.paddingTop = y + 'px'
          target.style.paddingBottom = y + 'px'
        }
        if (typeof d.x === 'number') {
          var x = Math.max(0, Math.min(160, Math.round(Number(d.x))))
          target.style.paddingLeft = x + 'px'
          target.style.paddingRight = x + 'px'
        }
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'undo') undoHistory()
    if (d.type === 'redo') redoHistory()
    if (d.type === 'listHidden') postHidden()
    if (d.type === 'serialize') { clearHover(); clearSelection(); hideLayerSwitches(); hideLogoButtons(); hideLogoDrawRect(); post('html', { html: document.documentElement.outerHTML }) }
  })
  try { sizeChromeIcons(document) } catch (err) {}
  post('loaded', {})
})`

export function buildVisualEditorScript(locale: WebLocale): string {
  const copy = COPY[locale in COPY ? locale : 'en']
  return RUNTIME_BODY + '(' + JSON.stringify(NANOAI_VE_MESSAGE) + ',' + JSON.stringify(copy) + ');'
}
