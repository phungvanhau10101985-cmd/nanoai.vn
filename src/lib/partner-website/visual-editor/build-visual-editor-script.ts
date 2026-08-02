import type { WebLocale } from '@/lib/i18n/config'

export const NANOAI_VE_MESSAGE = 'nanoai-visual-editor'

export type VisualEditorCopy = {
  selectHint: string
  sectionHint: string
}

const COPY: Record<WebLocale, VisualEditorCopy> = {
  vi: {
    selectHint: 'Bấm text/ảnh để chỉnh · Shift+bấm vùng để đổi nền',
    sectionHint: 'Shift+bấm section/div để đổi màu nền',
  },
  en: {
    selectHint: 'Click text/image to edit · Shift+click area for background',
    sectionHint: 'Shift+click a section to change background color',
  },
  zh: {
    selectHint: '点击文字/图片编辑 · Shift+点击区域改背景',
    sectionHint: 'Shift+点击区块更改背景色',
  },
  ja: {
    selectHint: 'テキスト/画像をクリック · Shift+クリックで背景',
    sectionHint: 'Shift+クリックでセクション背景を変更',
  },
  ko: {
    selectHint: '텍스트/이미지 클릭 · Shift+클릭으로 배경 변경',
    sectionHint: 'Shift+클릭으로 섹션 배경색 변경',
  },
}

/** IIFE body from visual-editor-runtime.js — injected into preview iframe. */
const RUNTIME_BODY = `(function (MSG, COPY) {
  var selected = null
  var drag = { active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 }
  var resize = { active: false, startX: 0, startW: 0 }
  function post(type, payload) {
    try { window.parent.postMessage(Object.assign({ source: MSG, type: type }, payload || {}), '*') } catch (e) {}
  }
  function cs(el) { return window.getComputedStyle(el) }
  function isTextEl(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName.toLowerCase()
    if (['script', 'style', 'link', 'meta', 'head', 'html', 'body', 'iframe', 'svg'].indexOf(tag) >= 0) return false
    if (tag === 'img') return false
    var text = (el.textContent || '').trim()
    if (text.length < 1 || text.length > 8000) return false
    if (tag === 'button' || tag === 'a') return text.length < 200 && !el.querySelector('img')
    if (el.querySelector && el.querySelector('img,section,article,header,footer,nav')) return false
    return true
  }
  function isImgEl(el) { return el && el.tagName && el.tagName.toLowerCase() === 'img' }
  var blockClassRe = new RegExp('hero|banner|section|feature|benefit|testimonial|cta|footer|header|material|story')
  function isBlockEl(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false
    var tag = el.tagName.toLowerCase()
    if (['section', 'header', 'footer', 'article', 'main', 'nav', 'aside'].indexOf(tag) >= 0) return true
    if (tag === 'div') {
      var cls = (el.className || '').toString().toLowerCase()
      if (blockClassRe.test(cls)) return true
      var r = el.getBoundingClientRect()
      if (r.height >= 80 && r.width >= 120) return true
    }
    return false
  }
  function findBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isBlockEl(el)) return el
      el = el.parentElement
    }
    return null
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
  function buildPayload(el) {
    var rect = el.getBoundingClientRect()
    return {
      tag: el.tagName.toLowerCase(),
      isText: isTextEl(el),
      isImage: isImgEl(el),
      isBlock: !isTextEl(el) && !isImgEl(el) && isBlockEl(el),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      textColor: cs(el).color || '',
      fontSize: parseFontSizePx(el),
      fontWeight: cs(el).fontWeight || '400',
      textAlign: cs(el).textAlign || 'left',
      bgColor: parseBgColor(el),
      src: isImgEl(el) ? el.getAttribute('src') || '' : '',
      imageWidth: isImgEl(el) ? parseImageWidthPct(el) : 100,
      transform: isImgEl(el) ? parseTransform(el) : null,
    }
  }
  function clearSelection() {
    if (selected) {
      selected.classList.remove('nanoai-ve-highlight')
      selected.removeAttribute('data-nanoai-ve-selected')
      if (selected.getAttribute('contenteditable') === 'true') selected.removeAttribute('contenteditable')
    }
    selected = null
    hideResizeHandle()
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
    selected = el
    selected.classList.add('nanoai-ve-highlight')
    selected.setAttribute('data-nanoai-ve-selected', '1')
    var payload = buildPayload(selected)
    if (payload.isText) {
      selected.setAttribute('contenteditable', 'true')
      selected.focus()
    }
    if (payload.isImage) showResizeHandle(selected)
    post('select', payload)
  }
  function onClick(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    var t = e.target
    if (t && t.closest && t.closest('.nanoai-ve-ignore')) return
    if (selected && selected.contains(t) && selected.getAttribute('contenteditable') === 'true') return
    e.preventDefault()
    e.stopPropagation()
    if (e.shiftKey) {
      var block = findBlockEl(t)
      if (block) { selectEl(block); return }
    }
    var el = t
    while (el && el !== document.body) {
      if (isImgEl(el)) { selectEl(el); return }
      if (isTextEl(el)) { selectEl(el); return }
      el = el.parentElement
    }
    clearSelection()
    post('deselect', {})
  }
  function onInput() {
    if (selected && selected.getAttribute('contenteditable') === 'true') post('dirty', {})
  }
  function onImgMouseDown(e) {
    if (!selected || !isImgEl(selected)) return
    if (e.target !== selected) return
    if (e.target.closest && e.target.closest('.nanoai-ve-resize-handle')) return
    e.preventDefault()
    var p = parseTransform(selected)
    drag.active = true
    drag.startX = e.clientX
    drag.startY = e.clientY
    drag.baseX = p.x
    drag.baseY = p.y
  }
  function onMouseMove(e) {
    if (resize.active && selected && isImgEl(selected)) {
      var dx = e.clientX - resize.startX
      var nw = Math.max(40, resize.startW + dx)
      selected.style.width = nw + 'px'
      selected.style.height = 'auto'
      selected.style.maxWidth = '100%'
      var h = document.querySelector('.nanoai-ve-resize-handle')
      if (h) positionResizeHandle(selected, h)
      post('dirty', {})
      return
    }
    if (!drag.active || !selected) return
    var dx2 = e.clientX - drag.startX
    var dy = e.clientY - drag.startY
    selected.style.transform = 'translate(' + (drag.baseX + dx2) + 'px,' + (drag.baseY + dy) + 'px)'
    var h2 = document.querySelector('.nanoai-ve-resize-handle')
    if (h2 && isImgEl(selected)) positionResizeHandle(selected, h2)
    post('dirty', {})
  }
  function onMouseUp() {
    if (resize.active) {
      resize.active = false
      if (selected && isImgEl(selected)) post('select', buildPayload(selected))
      return
    }
    if (!drag.active) return
    drag.active = false
    if (selected && isImgEl(selected)) post('select', buildPayload(selected))
  }
  function injectStyles() {
    if (document.getElementById('nanoai-visual-editor-styles')) return
    var s = document.createElement('style')
    s.id = 'nanoai-visual-editor-styles'
    s.textContent = '.nanoai-ve-active{cursor:crosshair!important}.nanoai-ve-highlight{outline:2px solid #2563eb!important;outline-offset:2px!important}[contenteditable=true]{cursor:text!important;min-width:1em;outline:none!important}.nanoai-ve-active img.nanoai-ve-highlight{cursor:move!important}.nanoai-ve-resize-handle{position:absolute;width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;z-index:99999;box-shadow:0 1px 4px rgba(0,0,0,.3)}'
    document.head.appendChild(s)
  }
  function activate() {
    injectStyles()
    document.body.classList.add('nanoai-ve-active')
    document.addEventListener('click', onClick, true)
    document.addEventListener('input', onInput, true)
    document.addEventListener('mousedown', onImgMouseDown, true)
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseup', onMouseUp, true)
    window.addEventListener('scroll', function () {
      var h = document.querySelector('.nanoai-ve-resize-handle')
      if (h && selected && isImgEl(selected)) positionResizeHandle(selected, h)
    }, true)
    post('ready', { hint: COPY.selectHint })
  }
  function deactivate() {
    document.body.classList.remove('nanoai-ve-active')
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('mousedown', onImgMouseDown, true)
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('mouseup', onMouseUp, true)
    clearSelection()
    post('inactive', {})
  }
  function refreshSelect() { if (selected) post('select', buildPayload(selected)) }
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
      var h = document.querySelector('.nanoai-ve-resize-handle')
      if (h) positionResizeHandle(selected, h)
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'resetImageTransform' && selected && isImgEl(selected)) {
      selected.style.transform = ''
      var h2 = document.querySelector('.nanoai-ve-resize-handle')
      if (h2) positionResizeHandle(selected, h2)
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setImageSrc' && selected && isImgEl(selected) && d.url) {
      selected.setAttribute('src', d.url)
      selected.style.transform = ''
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'serialize') { clearSelection(); post('html', { html: document.documentElement.outerHTML }) }
  })
  post('loaded', {})
})`

export function buildVisualEditorScript(locale: WebLocale): string {
  const copy = COPY[locale in COPY ? locale : 'en']
  return RUNTIME_BODY + '(' + JSON.stringify(NANOAI_VE_MESSAGE) + ',' + JSON.stringify(copy) + ');'
}
