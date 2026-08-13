import type { WebLocale } from '@/lib/i18n/config'

export const NANOAI_VE_MESSAGE = 'nanoai-visual-editor'

export type VisualEditorCopy = {
  selectHint: string
  sectionHint: string
}

const COPY: Record<WebLocale, VisualEditorCopy> = {
  vi: {
    selectHint: 'Bấm khối để chọn · Kéo icon di chuyển ở góc · Sửa chữ · Dấu + để xóa',
    sectionHint: 'Khối: ẩn / xóa / nhân bản · Banner: lớp phủ và khoảng cách',
  },
  en: {
    selectHint: 'Click a block · Drag the move icon in the corner · Edit text · Plus to delete',
    sectionHint: 'Blocks: hide / delete / duplicate · Banner: overlay and padding',
  },
  zh: {
    selectHint: '点击区块 · 拖动角落移动图标 · 编辑文字 · 加号删除',
    sectionHint: '区块：隐藏/删除/复制 · 横幅：遮罩与间距',
  },
  ja: {
    selectHint: 'ブロックをクリック · 角の移動アイコンをドラッグ · 文字を編集 · ＋で削除',
    sectionHint: 'ブロック：非表示/削除/複製 · バナー：オーバーレイと余白',
  },
  ko: {
    selectHint: '블록을 클릭 · 모서리 이동 아이콘을 드래그 · 텍스트 수정 · +로 삭제',
    sectionHint: '블록: 숨기기/삭제/복제 · 배너: 오버레이와 여백',
  },
}

/** IIFE body injected into preview iframe. Avoid `${` — this is a JS template literal. */
const RUNTIME_BODY = `(function (MSG, COPY) {
  var selected = null
  var hoverEl = null
  var drag = { active: false, ready: false, startX: 0, startY: 0, baseX: 0, baseY: 0, mode: 'translate', dropTarget: null, dropBefore: true }
  var skipClick = false
  var resize = { active: false, startX: 0, startW: 0 }
  var TEXT_TAGS = {h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,p:1,span:1,li:1,label:1,figcaption:1,a:1,button:1,td:1,th:1,strong:1,em:1,small:1,blockquote:1,dt:1,dd:1,b:1,i:1,u:1}
  function post(type, payload) {
    try { window.parent.postMessage(Object.assign({ source: MSG, type: type }, payload || {}), '*') } catch (e) {}
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
    var cls = clsOf(el)
    if (cls.indexOf('logo') >= 0) return true
    var alt = (el.getAttribute('alt') || '').toLowerCase()
    if (alt.indexOf('logo') >= 0) return true
    var parentCls = el.parentElement ? clsOf(el.parentElement) : ''
    return parentCls.indexOf('brand') >= 0 || parentCls.indexOf('logo') >= 0
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
    if (cls.indexOf('pw-icon-btn') >= 0) return true
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
    return isChromeBtn(el) && clsOf(el).indexOf('pw-icon-btn') >= 0
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
  var blockClassRe = new RegExp('pw-(hero|section|categories|features|faq|gallery|footer|chat|lead|trust|testimonial|pricing|banner)')
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
  }
  function ensureChromeHost(place) {
    if (place === 'topbar') {
      var inner = document.querySelector('.pw-topbar-inner')
      if (inner) return inner
      var header = document.querySelector('header.pw-header') || document.querySelector('header')
      var bar = document.createElement('div')
      bar.className = 'pw-topbar'
      var wrapInner = document.createElement('div')
      wrapInner.className = 'pw-container pw-topbar-inner'
      bar.appendChild(wrapInner)
      if (header) header.insertBefore(bar, header.firstChild)
      else document.body.insertBefore(bar, document.body.firstChild)
      return wrapInner
    }
    var actions = document.querySelector('.pw-header-actions')
    if (actions) return actions
    var main = document.querySelector('.pw-header-main, header.pw-header, header')
    return main || document.body
  }
  function insertChromeBtn(kind, html, host) {
    var k = String(kind || '').replace(/[^a-z0-9-]/g, '')
    if (!k || !html) return
    var existing = document.querySelector('[data-pw-chrome-btn="' + k + '"]')
    if (existing) {
      selectEl(existing)
      return
    }
    var wrap = document.createElement('div')
    wrap.innerHTML = String(html)
    var node = wrap.firstElementChild
    if (!node) return
    var place = String(host || '') === 'topbar' ? 'topbar' : 'actions'
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
    ensureChromeHost(place).appendChild(node)
    selectEl(node)
    post('dirty', {})
    try { document.dispatchEvent(new CustomEvent('pw-cart-updated')) } catch (err) {}
  }
  function removeSelectedChrome() {
    deleteSelectedUnit()
  }
  function nudgeSelected(dx, dy) {
    if (!selected || !canDragEl(selected)) return
    ensureDragDisplay(selected)
    var p = parseTransform(selected)
    selected.style.transform = 'translate(' + (p.x + dx) + 'px,' + (p.y + dy) + 'px)'
    snapSelected()
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function onKeyDown(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
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
  function dragModeFor(el) {
    if (isContentBlockEl(el)) return 'reorder'
    if (isChromeBtn(el) || isHeaderWidget(el) || isBtnEl(el)) {
      var p = el.parentElement
      if (p && p.children && p.children.length >= 2) return 'reorder'
    }
    return 'translate'
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
    var parentBlock = blockSelf ? el : findContentBlockEl(el)
    var padEl = parentBlock ? paddingTarget(parentBlock) : null
    var overlayBlock = parentBlock && canOverlayBlock(parentBlock) ? parentBlock : (blockSelf && canOverlayBlock(el) ? el : null)
    return {
      tag: el.tagName.toLowerCase(),
      isText: canEditText(el),
      isImage: img,
      isBgImage: !img && Boolean(bgUrl),
      isLogo: isLogoImg(el),
      isButton: btn,
      isChrome: isChromeBtn(el),
      isBlock: blockSelf,
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
    var docW = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth)
    var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, window.innerHeight)
    h.style.left = '0px'
    h.style.width = docW + 'px'
    h.style.top = r.bottom + window.scrollY + 'px'
    v.style.top = '0px'
    v.style.height = docH + 'px'
    v.style.left = r.left + window.scrollX + 'px'
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
    h.style.left = r.left - 8 + window.scrollX + 'px'
    h.style.top = r.top - 8 + window.scrollY + 'px'
  }
  function positionDeleteHandle(el, h) {
    var r = el.getBoundingClientRect()
    h.style.left = r.right - 9 + window.scrollX + 'px'
    h.style.top = r.top - 9 + window.scrollY + 'px'
  }
  function positionAllHandles() {
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
    drag.dropBefore = true
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
  }
  function hideResizeHandle() {
    var h = document.querySelector('.nanoai-ve-resize-handle')
    if (h) h.remove()
  }
  function positionResizeHandle(img, h) {
    var r = img.getBoundingClientRect()
    h.style.left = r.right - 8 + window.scrollX + 'px'
    h.style.top = r.bottom - 8 + window.scrollY + 'px'
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
  function selectEl(el) {
    if (!el || el === document.documentElement || el === document.body) return
    clearSelection()
    if (hoverEl === el) {
      el.classList.remove('nanoai-ve-hover')
      hoverEl = null
    }
    selected = el
    selected.classList.add('nanoai-ve-highlight')
    selected.setAttribute('data-nanoai-ve-selected', '1')
    var payload = buildPayload(selected)
    if (canEditText(selected)) {
      selected.setAttribute('contenteditable', 'true')
      selected.focus()
    } else if (isChromeBtn(selected) || payload.isButton) {
      try { selected.focus() } catch (err) {}
    }
    showMoveHandle(selected)
    if (canDeleteEl(selected)) showDeleteHandle(selected)
    if (payload.isImage) showResizeHandle(selected)
    showAlignGuides(selected)
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
      if (isHeaderWidget(walk)) return walk
      if (isImgEl(walk)) return walk
      if (isBtnEl(walk)) return walk
      if (isTextEl(walk)) return walk
      walk = walk.parentElement
    }
    walk = el
    while (walk && walk !== document.body) {
      if (isBgImageEl(walk) || isContentBlockEl(walk)) return walk
      walk = walk.parentElement
    }
    return null
  }
  function onClick(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (skipClick) { skipClick = false; e.preventDefault(); e.stopPropagation(); return }
    var t = e.target
    if (isIgnored(t) || isOverlayNode(t)) return
    if (selected && selected.contains(t) && selected.getAttribute('contenteditable') === 'true' && !drag.active) return
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      var block = findContentBlockEl(t) || findBlockEl(t)
      if (block) { selectEl(block); return }
    }
    var found = findSelectable(t)
    if (found) { selectEl(found); return }
    var emptyBlock = findContentBlockEl(t)
    if (emptyBlock) { selectEl(emptyBlock); return }
    clearSelection()
    post('deselect', {})
  }
  function onInput() {
    if (selected && selected.getAttribute('contenteditable') === 'true') post('dirty', {})
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
        if (selected.getAttribute('contenteditable') === 'true') {
          try { selected.blur() } catch (err) {}
        }
      }
    }
    if (!drag.active || !selected) return
    e.preventDefault()
    var dx2 = e.clientX - drag.startX
    var dy = e.clientY - drag.startY
    selected.style.transform = 'translate(' + (drag.baseX + dx2) + 'px,' + (drag.baseY + dy) + 'px)'
    if (drag.mode === 'reorder') {
      selected.style.opacity = '0.55'
      updateDropTarget(e)
    } else {
      snapSelected()
    }
    positionAllHandles()
    post('dirty', {})
  }
  function onMouseUp() {
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
    if (wasDrag && selected && mode === 'reorder') {
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
      '.nanoai-ve-highlight{outline:2px solid #2563eb!important;outline-offset:2px!important}',
      '.nanoai-ve-hover{outline:1px dashed #2563eb!important;outline-offset:2px!important}',
      '[contenteditable=true]{cursor:text!important;min-width:1em;outline:none!important}',
      '.nanoai-ve-dragging,.nanoai-ve-dragging *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}',
      '.nanoai-ve-resize-handle{position:absolute;width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;z-index:99999;box-shadow:0 1px 4px rgba(0,0,0,.3)}',
      '.nanoai-ve-move-handle{position:absolute;z-index:99999;width:22px;height:22px;padding:0;border:2px solid #fff;border-radius:6px;background:#2563eb;color:#fff;cursor:grab;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.35)}',
      '.nanoai-ve-move-handle svg{display:block;pointer-events:none}',
      '.nanoai-ve-chrome-delete,.nanoai-ve-delete-handle{position:absolute;z-index:99999;width:18px;height:18px;padding:0;border:2px solid #fff;border-radius:999px;background:#ef4444;color:#fff;font:700 14px/14px system-ui,sans-serif;cursor:pointer;transform:rotate(45deg);box-shadow:0 1px 4px rgba(0,0,0,.35)}',
      '.nanoai-ve-drop-line{position:absolute;z-index:99998;background:#2563eb;pointer-events:none;border-radius:2px;box-shadow:0 0 0 1px #fff}',
      '.nanoai-ve-guides{position:absolute;left:0;top:0;z-index:99990;pointer-events:none}',
      '.nanoai-ve-guide-h{position:absolute;height:1px;background:repeating-linear-gradient(90deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-v{position:absolute;width:1px;background:repeating-linear-gradient(180deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-h.is-snap,.nanoai-ve-guide-v.is-snap{background:#2563eb;opacity:.85}',
      '.nanoai-ve-active [data-pw-hidden="1"]{display:revert!important;opacity:.45;outline:1px dashed #64748b!important}'
    ].join('')
    document.head.appendChild(s)
  }
  function activate() {
    injectStyles()
    document.body.classList.add('nanoai-ve-active')
    document.addEventListener('click', onClick, true)
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
    postHidden()
  }
  function deactivate() {
    document.body.classList.remove('nanoai-ve-active')
    document.removeEventListener('click', onClick, true)
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
  function applyImageUrl(url) {
    if (!selected || !url) return
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
    if (d.type === 'activate') activate()
    if (d.type === 'deactivate') deactivate()
    if (d.type === 'setColor' && selected && d.color) { selected.style.color = d.color; post('dirty', {}); refreshSelect() }
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
    if (d.type === 'setImageSrc' && d.url) applyImageUrl(d.url)
    if (d.type === 'setHref' && selected && typeof d.href === 'string') {
      var link = selected.tagName.toLowerCase() === 'a' ? selected : (selected.closest ? selected.closest('a') : null)
      if (link) {
        link.setAttribute('href', d.href)
        post('dirty', {})
        refreshSelect()
      }
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
    if (d.type === 'listHidden') postHidden()
    if (d.type === 'serialize') { clearHover(); clearSelection(); post('html', { html: document.documentElement.outerHTML }) }
  })
  post('loaded', {})
})`

export function buildVisualEditorScript(locale: WebLocale): string {
  const copy = COPY[locale in COPY ? locale : 'en']
  return RUNTIME_BODY + '(' + JSON.stringify(NANOAI_VE_MESSAGE) + ',' + JSON.stringify(copy) + ');'
}
