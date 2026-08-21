import type { WebLocale } from '@/lib/i18n/config'
import {
  PW_CHROME_COUNT_BADGE_HIDE_CSS,
  PW_CHROME_COUNT_BADGE_RUNTIME_JS,
} from '../shop/chrome-count-badges'
import {
  PARTNER_SHOP_CHROME_FLOAT_CSS,
  PARTNER_SHOP_CHROME_FLOAT_POS_JS,
  PW_CHROME_FLOAT_KINDS,
  PW_CHROME_FLOAT_Z_INDEX,
} from '../shop/chrome-float-widgets'
import {
  PW_SCENE_ATTR,
  PW_SCENE_BAND,
  PW_SCENE_DEFAULT_INDEX,
  PW_SCENE_LAYERS,
  PW_SCENE_LOCAL_MAX,
  PW_SCENE_LOGO_Z,
  PW_SCENE_MAX_INDEX,
  PW_SCENE_MIN_INDEX,
  PW_SCENE_TOPBAR_Z,
  PW_SCENE_Z_MAX,
} from './pw-scene'

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
  cropLogo: string
  cropHint: string
  cropDone: string
  cropCancel: string
  cropZoom: string
  infoSeoTitle: string
  infoSeoHint: string
  infoSeoPlaceholder: string
  infoSeoRewrite: string
  infoSeoBusy: string
  infoSeoSyncHint: string
  infoSeoUndo: string
  infoSeoInsertImage: string
  infoSeoColor: string
  infoSeoSize: string
  infoSeoMore: string
  infoSeoLess: string
}

const COPY: Record<WebLocale, VisualEditorCopy> = {
  vi: {
    selectHint: 'Bấm chữ, nút, ảnh hoặc khối — chọn cái gì sửa cái đó',
    sectionHint: 'Khối: ẩn / xóa / nhân bản · Banner: lớp phủ và khoảng cách',
    addTextPlaceholder: 'Nhập chữ',
    addButtonLabel: 'MUA NGAY',
    layerBlock: 'Khối',
    layerImage: 'Ảnh',
    createLogo: 'Tạo logo',
    recreateLogo: 'Tạo lại logo',
    cropLogo: 'Cắt ảnh',
    cropHint: 'Kéo ảnh theo chuột. Kéo nét đứt để đổi khung cắt. Ảnh giữ nguyên cỡ.',
    cropDone: 'Xong',
    cropCancel: 'Hủy',
    cropZoom: 'Zoom',
    infoSeoTitle: 'SEO / AI',
    infoSeoHint: 'Sửa chữ trong bài bên dưới. AI đổ thẳng vào bài.',
    infoSeoPlaceholder: 'Tuỳ chọn: giọng văn / điểm nhấn',
    infoSeoRewrite: 'AI viết lại',
    infoSeoBusy: 'Đang viết…',
    infoSeoSyncHint: 'Lưu để giữ bản này',
    infoSeoUndo: 'Quay lại',
    infoSeoInsertImage: 'Ảnh',
    infoSeoColor: 'Màu',
    infoSeoSize: 'Cỡ',
    infoSeoMore: 'Ghi chú',
    infoSeoLess: 'Thu gọn',
  },
  en: {
    selectHint: 'Click text, button, image or block — edit what you select',
    sectionHint: 'Blocks: hide / delete / duplicate · Banner: overlay and padding',
    addTextPlaceholder: 'Enter text',
    addButtonLabel: 'SHOP NOW',
    layerBlock: 'Block',
    layerImage: 'Image',
    createLogo: 'Create logo',
    recreateLogo: 'Recreate logo',
    cropLogo: 'Crop photo',
    cropHint: 'Drag the photo to choose what to keep. Drag the dashed line to resize the crop. The image stays the same size.',
    cropDone: 'Done',
    cropCancel: 'Cancel',
    cropZoom: 'Zoom',
    infoSeoTitle: 'SEO / AI',
    infoSeoHint: 'Edit the article below. AI fills it in place.',
    infoSeoPlaceholder: 'Optional: tone / emphasis',
    infoSeoRewrite: 'Rewrite with AI',
    infoSeoBusy: 'Writing…',
    infoSeoSyncHint: 'Save to keep this version',
    infoSeoUndo: 'Undo',
    infoSeoInsertImage: 'Image',
    infoSeoColor: 'Color',
    infoSeoSize: 'Size',
    infoSeoMore: 'Notes',
    infoSeoLess: 'Less',
  },
  zh: {
    selectHint: '点击文字、按钮、图片或区块 — 选中即可编辑',
    sectionHint: '区块：隐藏/删除/复制 · 横幅：遮罩与间距',
    addTextPlaceholder: '输入文字',
    addButtonLabel: '立即购买',
    layerBlock: '区块',
    layerImage: '图片',
    createLogo: '生成标志',
    recreateLogo: '重新生成标志',
    cropLogo: '裁切图片',
    cropHint: '拖动图片选择保留部分。拖动虚线调整裁切框。图片大小不变。',
    cropDone: '完成',
    cropCancel: '取消',
    cropZoom: '缩放',
    infoSeoTitle: 'SEO / AI',
    infoSeoHint: '在下方编辑正文。AI 会直接写入文章。',
    infoSeoPlaceholder: '可选：语气/重点',
    infoSeoRewrite: 'AI 重写',
    infoSeoBusy: '正在撰写…',
    infoSeoSyncHint: '保存以保留此版',
    infoSeoUndo: '撤销',
    infoSeoInsertImage: '图片',
    infoSeoColor: '颜色',
    infoSeoSize: '字号',
    infoSeoMore: '备注',
    infoSeoLess: '收起',
  },
  ja: {
    selectHint: '文字・ボタン・画像・ブロックをクリック — 選んだものを編集',
    sectionHint: 'ブロック：非表示/削除/複製 · バナー：オーバーレイと余白',
    addTextPlaceholder: 'テキストを入力',
    addButtonLabel: '今すぐ購入',
    layerBlock: 'ブロック',
    layerImage: '画像',
    createLogo: 'ロゴを作成',
    recreateLogo: 'ロゴを再作成',
    cropLogo: '画像を切り抜き',
    cropHint: '画像をドラッグして残す部分を選びます。破線をドラッグして枠を変えます。画像サイズはそのままです。',
    cropDone: '完了',
    cropCancel: 'キャンセル',
    cropZoom: 'ズーム',
    infoSeoTitle: 'SEO / AI',
    infoSeoHint: '下の本文を編集。AIは記事に直接反映。',
    infoSeoPlaceholder: '任意：トーン/強調',
    infoSeoRewrite: 'AIで書き直す',
    infoSeoBusy: '作成中…',
    infoSeoSyncHint: '保存でこの版を保持',
    infoSeoUndo: '戻す',
    infoSeoInsertImage: '画像',
    infoSeoColor: '色',
    infoSeoSize: 'サイズ',
    infoSeoMore: 'メモ',
    infoSeoLess: '閉じる',
  },
  ko: {
    selectHint: '텍스트, 버튼, 이미지 또는 블록 클릭 — 선택한 것을 수정',
    sectionHint: '블록: 숨기기/삭제/복제 · 배너: 오버레이와 여백',
    addTextPlaceholder: '텍스트 입력',
    addButtonLabel: '바로 구매',
    layerBlock: '블록',
    layerImage: '이미지',
    createLogo: '로고 만들기',
    recreateLogo: '로고 다시 만들기',
    cropLogo: '사진 자르기',
    cropHint: '사진을 끌어 남길 부분을 고르세요. 점선을 끌어 자르기 틀을 바꿉니다. 이미지 크기는 그대로입니다.',
    cropDone: '완료',
    cropCancel: '취소',
    cropZoom: '줌',
    infoSeoTitle: 'SEO / AI',
    infoSeoHint: '아래 본문을 수정하세요. AI가 글에 바로 반영합니다.',
    infoSeoPlaceholder: '선택: 문체/강조',
    infoSeoRewrite: 'AI로 다시 쓰기',
    infoSeoBusy: '작성 중…',
    infoSeoSyncHint: '저장하면 이 버전 유지',
    infoSeoUndo: '되돌리기',
    infoSeoInsertImage: '이미지',
    infoSeoColor: '색',
    infoSeoSize: '크기',
    infoSeoMore: '메모',
    infoSeoLess: '접기',
  },
}

/** IIFE body injected into preview iframe. Avoid `${` — this is a JS template literal. */
const RUNTIME_BODY = `(function (MSG, COPY, SCENE) {
  if (window.__nanoaiVeBound) return
  window.__nanoaiVeBound = 1
  var selected = null
  var lastInsertButtonAt = 0
  var lastInsertBgAt = 0
  var hoverEl = null
  var drag = { active: false, ready: false, startX: 0, startY: 0, lastX: 0, lastY: 0, baseX: 0, baseY: 0, mode: 'translate', dropTarget: null, dropHost: null, dropBefore: true }
  var skipClick = false
  var veListening = false
  var layerMode = 'block'
  /** Lớp không gian đang khoá để bấm được phần tử bị che. -1 = không khoá. */
  var sceneFocus = -1
  var logoLayerPicked = false
  var editDevice = 'desktop'
  var logoDraw = { on: false, dragging: false, x1: 0, y1: 0, x2: 0, y2: 0 }
  var logoCrop = { on: false, live: false, img: null, zoom: 1, panX: 0, panY: 0, startX: 0, startY: 0, baseX: 0, baseY: 0, dragging: false, resize: '', frameW: 80, frameH: 32, viewW: 280, viewH: 112, picW: 280, picH: 112, baseViewW: 280, baseViewH: 112, snap: null }
  var resize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0, startZoom: 1, startLeft: 0, startTop: 0, dir: 'se', mode: 'frame' }
  var HISTORY_MAX = 30
  var historyStack = []
  var historyIndex = -1
  var historyLock = false
  var historyTimer = null
  var infoPageActive = false
  var infoArticleUndoHtml = ''
  var infoArticleUndoMeta = null
  var TEXT_TAGS = {h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,p:1,span:1,li:1,label:1,figcaption:1,a:1,button:1,td:1,th:1,strong:1,em:1,small:1,blockquote:1,dt:1,dd:1,b:1,i:1,u:1}
  function post(type, payload) {
    try { window.parent.postMessage(Object.assign({ source: MSG, type: type }, payload || {}), '*') } catch (e) {}
    if (type === 'dirty' && !historyLock) scheduleHistoryPush()
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
    restoreAllChromeDupCenters()
    var clone = document.body.cloneNode(true)
    var kill = clone.querySelectorAll('#nanoai-visual-editor-script,#nanoai-visual-editor-styles,#nanoai-ve-guides,.nanoai-ve-ignore,[data-nanoai-ve-ignore],[data-pw-ve-chat-preview]')
    for (var i = 0; i < kill.length; i++) kill[i].remove()
    var marked = clone.querySelectorAll('.nanoai-ve-highlight,.nanoai-ve-hover,.nanoai-ve-dragging,.nanoai-ve-photo-edit,.nanoai-ve-chrome-dup')
    for (var j = 0; j < marked.length; j++) {
      marked[j].classList.remove('nanoai-ve-highlight', 'nanoai-ve-hover', 'nanoai-ve-dragging', 'nanoai-ve-photo-edit', 'nanoai-ve-chrome-dup')
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
    try { pwApplyDemoChromeCountBadges(document) } catch (errDemo) {}
    try { prepareImageLayerBlocks() } catch (err3) {}
    syncLayerSwitches()
    syncLogoButtons()
    if (infoPageActive) {
      try { ensureInfoArticle(); ensureInfoSeoCoach() } catch (errInfo) {}
    }
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
  function resetHistoryBaseline() {
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null }
    historyLock = false
    historyStack = [snapshotPage()]
    historyIndex = 0
    postHistory()
  }
  function cs(el) { return window.getComputedStyle(el) }
  function clsOf(el) { return (el.className || '').toString().toLowerCase() }
  function pwRegionOf(el) {
    var n = el
    while (n && n !== document.body) {
      var r = n.getAttribute ? n.getAttribute('data-pw-region') : ''
      if (r) return String(r)
      n = n.parentElement
    }
    return ''
  }
  function pwElOf(el) {
    if (!el || !el.getAttribute) return ''
    return String(el.getAttribute('data-pw-el') || '')
  }
  function setAttrIfEmpty(el, name, value) {
    if (!el || !el.getAttribute || !value) return
    if (el.getAttribute(name)) return
    el.setAttribute(name, value)
  }
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
  function absUrl(u) {
    var s = String(u || '').trim()
    if (!s) return ''
    if (/^(https?:|data:|blob:)/i.test(s)) return s
    try { return new URL(s, document.baseURI || window.location.href).href } catch (eAbs) { return s }
  }
  function imgSrcOf(img) {
    if (!img) return ''
    return absUrl(img.currentSrc || img.getAttribute('src') || '')
  }
  function photoSrcOf(el) {
    if (!el) return ''
    if (isImgEl(el)) return imgSrcOf(el)
    var host = isBgLayerEl(el) && el.parentElement ? el.parentElement : el
    var banner = bannerHostOf(host) || host
    var bg = extractBgUrl(banner)
    if (bg) return absUrl(bg)
    var photo = heroImgIn(banner)
    if (photo) return imgSrcOf(photo)
    if (banner !== host) {
      var bg2 = extractBgUrl(host)
      if (bg2) return absUrl(bg2)
      var photo2 = heroImgIn(host)
      if (photo2) return imgSrcOf(photo2)
    }
    return ''
  }
  function parseBannerZoom(host) {
    if (!host) return 1
    var raw = host.getAttribute && host.getAttribute('data-pw-banner-zoom')
    if (raw) {
      var z = parseFloat(raw)
      if (isFinite(z) && z > 0) return Math.max(0.5, Math.min(3, z))
    }
    var img = heroImgIn(host)
    if (img) {
      var iz = img.getAttribute && img.getAttribute('data-pw-banner-zoom')
      if (iz) {
        var z2 = parseFloat(iz)
        if (isFinite(z2) && z2 > 0) return Math.max(0.5, Math.min(3, z2))
      }
    }
    var bs = ''
    try { bs = host.style.backgroundSize || '' } catch (eZ) { bs = '' }
    var m = String(bs).match(/(\\d+(?:\\.\\d+)?)%/)
    if (m) {
      var z3 = parseFloat(m[1]) / 100
      if (isFinite(z3) && z3 > 0) return Math.max(0.5, Math.min(3, z3))
    }
    return 1
  }
  function parseBannerPan(host) {
    if (!host) return { x: 50, y: 50 }
    var ax = host.getAttribute && host.getAttribute('data-pw-banner-pan-x')
    var ay = host.getAttribute && host.getAttribute('data-pw-banner-pan-y')
    if (ax != null && ax !== '' && ay != null && ay !== '') {
      var px = parseFloat(ax)
      var py = parseFloat(ay)
      if (isFinite(px) && isFinite(py)) return { x: Math.max(0, Math.min(100, px)), y: Math.max(0, Math.min(100, py)) }
    }
    var img = heroImgIn(host)
    if (img) return parseObjectPos(img)
    var bg = ''
    try { bg = host.style.backgroundPosition || cs(host).backgroundPosition || '' } catch (eP) { bg = '' }
    var parts = String(bg).trim().split(/\\s+/)
    function pct(s, fallback) {
      if (!s) return fallback
      if (s.indexOf('%') >= 0) return parseFloat(s)
      if (s === 'left' || s === 'top') return 0
      if (s === 'right' || s === 'bottom') return 100
      if (s === 'center') return 50
      var n = parseFloat(s)
      return isFinite(n) ? n : fallback
    }
    var x = pct(parts[0], 50)
    var y = pct(parts[1], 50)
    return { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y }
  }
  function mediaZoomOriginY(el) {
    if (!el || !el.getBoundingClientRect) return 50
    var r = el.getBoundingClientRect()
    var viewH = window.innerHeight || document.documentElement.clientHeight || 0
    if (!(r.height > 0) || !(viewH > 0)) return 50
    return (viewH / 2 - r.top) / r.height * 100
  }
  function applyBannerPhoto(host, zoom, panX, panY) {
    if (!host) return
    var z = Math.max(0.5, Math.min(3, Number(zoom) || 1))
    var x = Math.max(0, Math.min(100, Number(panX)))
    var y = Math.max(0, Math.min(100, Number(panY)))
    if (!isFinite(x)) x = 50
    if (!isFinite(y)) y = 50
    host.setAttribute('data-pw-banner-zoom', String(Math.round(z * 100) / 100))
    host.setAttribute('data-pw-banner-pan-x', String(Math.round(x)))
    host.setAttribute('data-pw-banner-pan-y', String(Math.round(y)))
    host.style.overflow = 'hidden'
    var pos = Math.round(x) + '% ' + Math.round(y) + '%'
    var img = heroImgIn(host)
    var originBox = img || host
    var oy = Math.round(mediaZoomOriginY(originBox) * 100) / 100
    host.style.setProperty('--pw-zoom-oy', oy + '%')
    if (extractBgUrl(host)) {
      host.style.backgroundPosition = pos
      host.style.backgroundRepeat = 'no-repeat'
      host.style.backgroundSize = z === 1 ? 'cover' : ('100% ' + Math.round(z * 100) + '%')
    }
    if (img) {
      setAttrIfEmpty(img, 'data-pw-el', 'media')
      img.setAttribute('data-pw-banner-zoom', String(Math.round(z * 100) / 100))
      img.style.objectFit = 'cover'
      img.style.objectPosition = pos
      img.style.width = '100%'
      img.style.setProperty('--pw-zoom-oy', oy + '%')
      img.style.transformOrigin = '50% ' + oy + '%'
      img.style.transform = z === 1 ? 'none' : 'scaleY(' + z + ')'
      img.style.maxWidth = 'none'
      img.style.maxHeight = 'none'
      var wrap = img.parentElement
      if (wrap && wrap !== host && wrap !== document.body) {
        try {
          if (!cs(wrap).overflow || cs(wrap).overflow === 'visible') wrap.style.overflow = 'hidden'
        } catch (eW) {}
      }
    }
  }
  function panBannerPhoto(host, px, py) {
    applyBannerPhoto(host, parseBannerZoom(host), px, py)
  }
  function isBannerPhotoTarget(el) {
    if (!el || isBannerContentEl(el) || isMoveBlockEl(el) || isTextEl(el) || isBtnEl(el)) return false
    var host = bannerHostOf(el)
    if (!host) return false
    if (layerMode === 'block' && (el === host || isBannerHostEl(el))) return false
    return isBgLayerEl(el) || pwElOf(el) === 'media' || ((el === host || isBannerHostEl(el)) && layerMode === 'image')
  }
  function syncBannerPhotoEdit() {
    var nodes = document.querySelectorAll('[data-pw-region="banner"], .pw-hero, .pw-banner, .pw-shop-hero, .pw-shop-banner')
    var host = selected ? bannerHostOf(selected) : null
    var photoOn = !!(host && layerMode === 'image' && selected && !isBannerContentEl(selected) && !isMoveBlockEl(selected) && !isTextEl(selected) && !isBtnEl(selected))
    for (var i = 0; i < nodes.length; i++) {
      if (photoOn && nodes[i] === host) nodes[i].classList.add('nanoai-ve-photo-edit')
      else nodes[i].classList.remove('nanoai-ve-photo-edit')
    }
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
  function hasClassToken(el, name) {
    return (' ' + clsOf(el) + ' ').indexOf(' ' + name + ' ') >= 0
  }
  function isWordmarkEl(el) {
    if (!el || el.nodeType !== 1 || isImgEl(el)) return false
    return hasClassToken(el, 'pw-wordmark') || hasClassToken(el, 'pw-shop-brand') || hasClassToken(el, 'pw-shop-footer-name')
  }
  function isBrandLink(el) {
    if (!el || el.nodeType !== 1 || el.tagName.toLowerCase() !== 'a') return false
    return hasClassToken(el, 'pw-brand') || hasClassToken(el, 'pw-shop-brand')
  }
  function isLogoSlot(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-logo-added') === '1') return true
    if (el.getAttribute && el.getAttribute('data-pw-logo-frame') === '1') return true
    if (isLogoImg(el) || isWordmarkEl(el) || isBrandLink(el)) return true
    return false
  }
  function isLogoFrame(el) {
    return !!(el && ((el.getAttribute && el.getAttribute('data-pw-logo-frame') === '1') || hasClassToken(el, 'pw-logo-frame')))
  }
  function logoFrameOf(el) {
    if (!el) return null
    if (isLogoFrame(el)) return el
    return el.closest ? el.closest('[data-pw-logo-frame="1"], .pw-logo-frame') : null
  }
  function logoImgOf(el) {
    if (!el) return null
    if (isLogoImg(el)) return el
    var frame = logoFrameOf(el)
    if (frame && frame.querySelector) {
      return frame.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]')
    }
    return null
  }
  function parseLogoZoom(img) {
    var z = parseFloat(img && img.getAttribute ? (img.getAttribute('data-pw-logo-zoom') || '1') : '1')
    if (isNaN(z) || z < 0.2) return 1
    return z
  }
  function parseLogoPan(img) {
    var x = parseFloat(img && img.getAttribute ? (img.getAttribute('data-pw-logo-pan-x') || '0') : '0')
    var y = parseFloat(img && img.getAttribute ? (img.getAttribute('data-pw-logo-pan-y') || '0') : '0')
    if (isNaN(x)) x = 0
    if (isNaN(y)) y = 0
    return { x: x, y: y }
  }
  function logoPanLimit(img, zoom) {
    var w = 80
    var h = 40
    var frame = logoFrameOf(img)
    if (frame) {
      try {
        var r = frame.getBoundingClientRect()
        if (r.width) w = r.width
        if (r.height) h = r.height
      } catch (errLim) {}
    }
    var z = typeof zoom === 'number' ? zoom : parseLogoZoom(img)
    return {
      x: Math.max(80, Math.min(480, Math.round(w * Math.max(1, z) * 0.75))),
      y: Math.max(48, Math.min(480, Math.round(h * Math.max(1, z) * 0.75)))
    }
  }
  function applyLogoTransform(img, zoom, panX, panY) {
    if (!img) return 1
    var z = Math.max(0.3, Math.min(4, Number(zoom) || parseLogoZoom(img) || 1))
    z = Math.round(z * 100) / 100
    var x = Math.round(Number(panX))
    var y = Math.round(Number(panY))
    if (isNaN(x)) x = parseLogoPan(img).x
    if (isNaN(y)) y = parseLogoPan(img).y
    var lim = logoPanLimit(img, z)
    if (x > lim.x) x = lim.x
    if (x < -lim.x) x = -lim.x
    if (y > lim.y) y = lim.y
    if (y < -lim.y) y = -lim.y
    img.setAttribute('data-pw-logo-zoom', String(z))
    img.setAttribute('data-pw-logo-pan-x', String(x))
    img.setAttribute('data-pw-logo-pan-y', String(y))
    img.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')'
    img.style.transformOrigin = 'center center'
    return z
  }
  function applyLogoZoom(img, zoom) {
    var pan = parseLogoPan(img)
    return applyLogoTransform(img, zoom, pan.x, pan.y)
  }
  function applyLogoPan(img, x, y) {
    return applyLogoTransform(img, parseLogoZoom(img), x, y)
  }
  function parseLogoCrop(img) {
    var x = parseFloat(img && img.getAttribute ? (img.getAttribute('data-pw-logo-crop-x') || '0') : '0')
    var y = parseFloat(img && img.getAttribute ? (img.getAttribute('data-pw-logo-crop-y') || '0') : '0')
    if (isNaN(x)) x = 0
    if (isNaN(y)) y = 0
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }
  function applyLogoCrop(img, x, y) {
    if (!img) return
    var cur = parseLogoCrop(img)
    var cx = typeof x === 'number' && !isNaN(x) ? x : cur.x
    var cy = typeof y === 'number' && !isNaN(y) ? y : cur.y
    cx = Math.max(0, Math.min(100, cx))
    cy = Math.max(0, Math.min(100, cy))
    img.setAttribute('data-pw-logo-crop-x', String(Math.round(cx)))
    img.setAttribute('data-pw-logo-crop-y', String(Math.round(cy)))
    var ix = (cx / 100) * 40
    var iy = (cy / 100) * 40
    if (ix < 0.2 && iy < 0.2) img.style.removeProperty('clip-path')
    else img.style.clipPath = 'inset(' + iy.toFixed(2) + '% ' + ix.toFixed(2) + '% ' + iy.toFixed(2) + '% ' + ix.toFixed(2) + '%)'
  }
  function cropText(key, fallback) {
    return (COPY && COPY[key]) ? String(COPY[key]) : fallback
  }
  function clampLogoCropPan() {
    var limX = Math.max(48, Math.round(logoCrop.picW * Math.max(1, logoCrop.zoom) * 0.55))
    var limY = Math.max(32, Math.round(logoCrop.picH * Math.max(1, logoCrop.zoom) * 0.55))
    if (logoCrop.panX > limX) logoCrop.panX = limX
    if (logoCrop.panX < -limX) logoCrop.panX = -limX
    if (logoCrop.panY > limY) logoCrop.panY = limY
    if (logoCrop.panY < -limY) logoCrop.panY = -limY
  }
  function clampLogoCropView(w, h) {
    var maxW = Math.max(160, (window.innerWidth || 360) - 48)
    var maxH = Math.max(80, (window.innerHeight || 400) - 180)
    var nw = Math.max(80, Math.min(maxW, Math.round(w)))
    var nh = Math.max(48, Math.min(maxH, Math.round(h)))
    return { w: nw, h: nh }
  }
  function syncLogoCropView() {
    var stage = document.querySelector('#nanoai-ve-logo-crop .nanoai-ve-logo-crop-stage')
    var pic = document.getElementById('nanoai-ve-logo-crop-pic')
    var slider = document.getElementById('nanoai-ve-logo-crop-zoom')
    var label = document.getElementById('nanoai-ve-logo-crop-zoom-val')
    if (stage) {
      stage.style.width = Math.round(logoCrop.viewW) + 'px'
      stage.style.height = Math.round(logoCrop.viewH) + 'px'
    }
    if (pic) {
      pic.style.width = Math.round(logoCrop.picW) + 'px'
      pic.style.height = Math.round(logoCrop.picH) + 'px'
      pic.style.left = '50%'
      pic.style.top = '50%'
      pic.style.marginLeft = Math.round(-logoCrop.picW / 2) + 'px'
      pic.style.marginTop = Math.round(-logoCrop.picH / 2) + 'px'
      pic.style.transform = 'translate(' + Math.round(logoCrop.panX) + 'px,' + Math.round(logoCrop.panY) + 'px) scale(' + logoCrop.zoom + ')'
      pic.style.transformOrigin = 'center center'
    }
    if (slider) slider.value = String(Math.round(logoCrop.zoom * 100))
    if (label) label.textContent = Math.round(logoCrop.zoom * 100) + '%'
  }
  function onLogoCropMove(e) {
    if (!logoCrop.on) return
    if (logoCrop.resize) {
      e.preventDefault()
      var dx = e.clientX - logoCrop.startX
      var dy = e.clientY - logoCrop.startY
      var w = logoCrop.baseViewW
      var h = logoCrop.baseViewH
      var dir = logoCrop.resize
      if (dir.indexOf('e') >= 0) w += dx
      if (dir.indexOf('w') >= 0) w -= dx
      if (dir.indexOf('s') >= 0) h += dy
      if (dir.indexOf('n') >= 0) h -= dy
      var next = clampLogoCropView(w, h)
      logoCrop.viewW = next.w
      logoCrop.viewH = next.h
      syncLogoCropView()
      return
    }
    if (!logoCrop.dragging) return
    e.preventDefault()
    logoCrop.panX = logoCrop.baseX + (e.clientX - logoCrop.startX)
    logoCrop.panY = logoCrop.baseY + (e.clientY - logoCrop.startY)
    clampLogoCropPan()
    syncLogoCropView()
  }
  function onLogoCropUp() {
    logoCrop.dragging = false
    logoCrop.resize = ''
    var pic = document.getElementById('nanoai-ve-logo-crop-pic')
    if (pic) pic.style.cursor = 'grab'
  }
  function hideLogoCropUi() {
    bindLiveCropPointers(false)
    document.removeEventListener('pointermove', onLogoCropMove, true)
    document.removeEventListener('pointerup', onLogoCropUp, true)
    document.removeEventListener('mousemove', onLogoCropMove, true)
    document.removeEventListener('mouseup', onLogoCropUp, true)
    var ui = document.getElementById('nanoai-ve-logo-crop')
    if (ui) ui.remove()
    var bar = document.getElementById('nanoai-ve-logo-live-bar')
    if (bar) bar.remove()
    var handles = document.querySelectorAll('.nanoai-ve-logo-live-handle')
    for (var hi = 0; hi < handles.length; hi++) handles[hi].remove()
    var live = document.querySelectorAll('.nanoai-ve-logo-live-crop')
    for (var li = 0; li < live.length; li++) live[li].classList.remove('nanoai-ve-logo-live-crop')
    document.body.classList.remove('nanoai-ve-logo-cropping')
  }
  function restoreLiveLogoCrop() {
    var snap = logoCrop.snap
    var img = logoCrop.img
    if (!snap || !img) return
    applyLogoTransform(img, snap.zoom, snap.panX, snap.panY)
    var frame = logoFrameOf(img)
    if (frame) applyLogoFrameSize(frame, snap.w, snap.h)
    var unit = headerLogoUnit(img) || frame
    if (unit) {
      if (snap.left) unit.style.setProperty('left', snap.left, 'important')
      if (snap.top) unit.style.setProperty('top', snap.top, 'important')
      if (snap.transform) unit.style.transform = snap.transform
      else unit.style.removeProperty('transform')
    }
  }
  function positionLiveLogoCropBar() {
    var img = logoCrop.img
    var frame = img ? (logoFrameOf(img) || img) : null
    if (!frame) return
    var r = frame.getBoundingClientRect()
    var bar = document.getElementById('nanoai-ve-logo-live-bar')
    if (bar) {
      bar.style.left = Math.max(8, Math.round(r.left)) + 'px'
      bar.style.top = Math.max(8, Math.round(r.bottom + 8)) + 'px'
    }
  }
  function liveCropEdgeDir(x, y) {
    if (!logoCrop.img) return ''
    var frame = logoFrameOf(logoCrop.img) || logoCrop.img
    if (!frame) return ''
    var r = frame.getBoundingClientRect()
    var pad = 10
    var onL = x >= r.left - pad && x <= r.left + pad
    var onR = x >= r.right - pad && x <= r.right + pad
    var onT = y >= r.top - pad && y <= r.top + pad
    var onB = y >= r.bottom - pad && y <= r.bottom + pad
    var inX = x >= r.left - pad && x <= r.right + pad
    var inY = y >= r.top - pad && y <= r.bottom + pad
    var dir = ''
    if (onT && inX) dir += 'n'
    if (onB && inX) dir += 's'
    if (onL && inY) dir += 'w'
    if (onR && inY) dir += 'e'
    return dir
  }
  function isLiveCropNode(el) {
    if (!el || !logoCrop.live || !logoCrop.img) return false
    if (el.closest && el.closest('.nanoai-ve-logo-live-handle, #nanoai-ve-logo-live-bar')) return true
    var frame = logoFrameOf(logoCrop.img) || logoCrop.img
    if (!frame) return false
    if (el === frame || el === logoCrop.img) return true
    if (frame.contains && frame.contains(el)) return true
    if (logoCrop.img.contains && logoCrop.img.contains(el)) return true
    return false
  }
  function beginLiveCropPointer(e) {
    if (!logoCrop.live || !logoCrop.img) return false
    if (e.button != null && e.button !== 0) return false
    var t = e.target
    if (t && t.closest && t.closest('#nanoai-ve-logo-live-bar button, #nanoai-ve-logo-live-bar input')) return false
    var handle = liveCropEdgeDir(e.clientX, e.clientY)
    if (handle) {
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      var box = logoFrameOf(logoCrop.img) || logoCrop.img
      var host = headerLogoUnit(logoCrop.img) || box
      var br = box.getBoundingClientRect()
      logoCrop.resize = handle
      logoCrop.dragging = false
      logoCrop.startX = e.clientX
      logoCrop.startY = e.clientY
      logoCrop.baseViewW = br.width
      logoCrop.baseViewH = br.height
      logoCrop.baseX = parseFloat(host && host.style ? host.style.left : '') || 0
      logoCrop.baseY = parseFloat(host && host.style ? host.style.top : '') || 0
      try { if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId) } catch (errCap) {}
      return true
    }
    if (!isLiveCropNode(t)) return false
    e.preventDefault()
    e.stopPropagation()
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
    var pan = parseLogoPan(logoCrop.img)
    logoCrop.resize = ''
    logoCrop.dragging = true
    logoCrop.startX = e.clientX
    logoCrop.startY = e.clientY
    logoCrop.baseX = pan.x
    logoCrop.baseY = pan.y
    logoCrop.img.draggable = false
    logoCrop.img.style.cursor = 'grabbing'
    try { if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId) } catch (errCap2) {}
    return true
  }
  function moveLiveCropPointer(e) {
    if (!logoCrop.live || !logoCrop.img) return false
    if (logoCrop.resize) {
      e.preventDefault()
      var dx = e.clientX - logoCrop.startX
      var dy = e.clientY - logoCrop.startY
      var dir = logoCrop.resize
      var fw = logoCrop.baseViewW
      var fh = logoCrop.baseViewH
      if (dir.indexOf('e') >= 0) fw += dx
      if (dir.indexOf('w') >= 0) fw -= dx
      if (dir.indexOf('s') >= 0) fh += dy
      if (dir.indexOf('n') >= 0) fh -= dy
      fw = Math.max(24, Math.round(fw))
      fh = Math.max(18, Math.round(fh))
      var frame = logoFrameOf(logoCrop.img) || logoCrop.img
      var host = headerLogoUnit(logoCrop.img) || frame
      applyLogoFrameSize(frame, fw, fh, true)
      if (dir.indexOf('w') >= 0) host.style.setProperty('left', Math.round(logoCrop.baseX + (logoCrop.baseViewW - fw)) + 'px', 'important')
      if (dir.indexOf('n') >= 0) host.style.setProperty('top', Math.round(logoCrop.baseY + (logoCrop.baseViewH - fh)) + 'px', 'important')
      positionLiveLogoCropBar()
      positionAllHandles()
      post('dirty', {})
      return true
    }
    if (!logoCrop.dragging) return false
    e.preventDefault()
    applyLogoPan(logoCrop.img, logoCrop.baseX + (e.clientX - logoCrop.startX), logoCrop.baseY + (e.clientY - logoCrop.startY))
    positionLiveLogoCropBar()
    positionAllHandles()
    post('dirty', {})
    return true
  }
  function endLiveCropPointer() {
    if (!logoCrop.live) return
    logoCrop.dragging = false
    logoCrop.resize = ''
    if (logoCrop.img) logoCrop.img.style.cursor = 'grab'
  }
  function onLiveCropPointerDown(e) {
    if (beginLiveCropPointer(e)) return
  }
  function onLiveCropPointerMove(e) {
    moveLiveCropPointer(e)
  }
  function onLiveCropPointerUp() {
    endLiveCropPointer()
  }
  function bindLiveCropPointers(on) {
    var fn = on ? 'addEventListener' : 'removeEventListener'
    document[fn]('pointerdown', onLiveCropPointerDown, true)
    document[fn]('pointermove', onLiveCropPointerMove, true)
    document[fn]('pointerup', onLiveCropPointerUp, true)
    document[fn]('mousedown', onLiveCropPointerDown, true)
    document[fn]('mousemove', onLiveCropPointerMove, true)
    document[fn]('mouseup', onLiveCropPointerUp, true)
  }
  function closeLogoCrop(apply) {
    if (!apply) restoreLiveLogoCrop()
    hideLogoCropUi()
    if (apply && logoCrop.img) {
      post('dirty', {})
      refreshSelect()
      positionAllHandles()
    }
    logoCrop.on = false
    logoCrop.live = false
    logoCrop.img = null
    logoCrop.snap = null
    logoCrop.dragging = false
    logoCrop.resize = ''
  }
  function openLogoCropOverlay(img) {
    if (!img || !isImgEl(img)) return
    hideLogoCropUi()
    unlockLogoImage(img)
    ensureLogoFrame(img)
    var frame = logoFrameOf(img) || img
    var unit = headerLogoUnit(img) || frame
    var fr = { width: 80, height: 32 }
    try { fr = frame.getBoundingClientRect() } catch (errFr) {}
    var frSize = readLogoBoxSize(frame)
    var pan = parseLogoPan(img)
    logoCrop.img = img
    logoCrop.live = true
    logoCrop.on = false
    logoCrop.snap = {
      zoom: parseLogoZoom(img),
      panX: pan.x,
      panY: pan.y,
      w: frSize.w || fr.width || 80,
      h: frSize.h || fr.height || 32,
      left: unit && unit.style ? unit.style.left : '',
      top: unit && unit.style ? unit.style.top : '',
      transform: unit && unit.style ? unit.style.transform : ''
    }
    frame.classList.add('nanoai-ve-logo-live-crop')
    img.draggable = false
    img.style.cursor = 'grab'
    img.style.touchAction = 'none'
    frame.style.touchAction = 'none'
    var link = img.closest ? img.closest('a') : null
    if (link) {
      link.addEventListener('click', function (ev) {
        if (logoCrop.live) { ev.preventDefault(); ev.stopPropagation() }
      }, true)
    }
    var bar = document.createElement('div')
    bar.id = 'nanoai-ve-logo-live-bar'
    bar.className = 'nanoai-ve-ignore'
    bar.setAttribute('data-nanoai-ve-ignore', '1')
    bar.innerHTML = ''
      + '<span>' + cropText('cropHint', 'Kéo ảnh theo chuột. Kéo nét đứt để đổi khung cắt.') + '</span>'
      + '<span class="nanoai-ve-logo-live-actions">'
      + '<button type="button" class="nanoai-ve-logo-crop-cancel">' + cropText('cropCancel', 'Hủy') + '</button>'
      + '<button type="button" class="nanoai-ve-logo-crop-done">' + cropText('cropDone', 'Xong') + '</button>'
      + '</span>'
    document.body.appendChild(bar)
    var cancelBtn = bar.querySelector('.nanoai-ve-logo-crop-cancel')
    var doneBtn = bar.querySelector('.nanoai-ve-logo-crop-done')
    if (cancelBtn) cancelBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeLogoCrop(false) })
    if (doneBtn) doneBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeLogoCrop(true) })
    bindLiveCropPointers(true)
    positionLiveLogoCropBar()
    if (frame !== selected && img !== selected) selectEl(frame)
    else positionAllHandles()
  }
  function unlockLogoImage(img) {
    if (!img || !img.style) return
    // Float belongs on frame/home-link only. Marking the <img> breaks live
    // injectPartnerLogoHomeLinkScript (wraps img, copies transform, sets 100% → off-screen).
    img.style.setProperty('max-width', 'none', 'important')
    img.style.setProperty('max-height', 'none', 'important')
  }
  function logoZoomed(img) {
    return parseLogoZoom(img) > 1.02
  }
  function isLogoTarget(el) {
    return !!(el && (isLogoImg(el) || isLogoFrame(el) || logoFrameOf(el)))
  }
  function logoLayerNow() {
    return 'block'
  }
  function logoMoveEl(el) {
    if (!el) return null
    if (!isLogoSlot(el) && !logoFrameOf(el) && !logoImgOf(el) && !isLogoImg(el)) return null
    if (isInHeader(el)) {
      var unit = headerLogoUnit(el)
      if (unit) return unit
    }
    var frame = logoFrameOf(el)
    if (frame) return frame
    return logoImgOf(el) || (isLogoImg(el) ? el : el)
  }
  function isInHeader(el) {
    return !!(el && el.closest && el.closest('header, .pw-header, .pw-shop-header'))
  }
  function pwStampDevice() {
    return (editDevice === 'mobile' || editDevice === 'tablet' || editDevice === 'laptop') ? editDevice : 'desktop'
  }
  function isMobileEdit() {
    return editDevice === 'mobile' || editDevice === 'tablet' || (window.innerWidth || 400) < 900
  }
  function syncEditDeviceAttr() {
    var stamped = pwStampDevice()
    document.documentElement.setAttribute('data-pw-edit-device', stamped)
    if (document.body) {
      if (editDevice === 'mobile') document.body.classList.add('nanoai-ve-mobile')
      else document.body.classList.remove('nanoai-ve-mobile')
      if (editDevice === 'tablet') document.body.classList.add('nanoai-ve-tablet')
      else document.body.classList.remove('nanoai-ve-tablet')
    }
  }
  function headerLogoDeviceWidth() {
    if (editDevice === 'mobile') return 390
    if (editDevice === 'tablet') return 768
    return 1200
  }
  function headerLogoFreeCap() {
    var viewW = window.innerWidth || document.documentElement.clientWidth || 390
    var cap = Math.min(headerLogoDeviceWidth(), Math.round(viewW))
    return { w: Math.max(240, cap), h: 240 }
  }
  function headerLogoMaxBox() {
    return headerLogoFreeCap()
  }
  function headerLogoUnit(el) {
    if (!el) return null
    var homeFloat = el.closest ? el.closest('a[data-pw-logo-home][data-pw-logo-float="1"], a.pw-brand[data-pw-logo-float="1"], a.pw-shop-brand[data-pw-logo-float="1"]') : null
    if (homeFloat) return homeFloat
    var frame = logoFrameOf(el)
    if (frame) return frame
    var img = logoImgOf(el) || (isImgEl(el) ? el : null)
    return img || el
  }
  function releaseFloatedBrandLink(link) {
    if (!link || !link.getAttribute) return
    if (!(isBrandLink(link) || link.getAttribute('data-pw-logo-home') === '1')) return
    link.removeAttribute('data-pw-logo-float')
    link.removeAttribute('data-pw-logo-floated')
    link.style.removeProperty('position')
    link.style.removeProperty('left')
    link.style.removeProperty('top')
    link.style.removeProperty('width')
    link.style.removeProperty('height')
    link.style.removeProperty('display')
    link.style.removeProperty('z-index')
    link.style.removeProperty('max-width')
    link.style.removeProperty('max-height')
    link.style.removeProperty('margin')
    link.style.removeProperty('transform')
  }
  function pinHeaderLogoFloat(el, box) {
    if (!el) return false
    var header = el.closest ? el.closest('header, .pw-header, .pw-shop-header') : null
    if (!header) header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return false
    var host = headerMainOf(header) || header
    ensureHeaderLogoHostPos(host)
    var img = logoImgOf(el) || (isImgEl(el) ? el : null)
    if (img) {
      unlockLogoImage(img)
      try { ensureLogoFrame(img) } catch (errClip) {}
    }
    var unit = headerLogoUnit(el)
    if (!unit) return false
    if (unit.tagName && unit.tagName.toLowerCase() === 'a') {
      var homeOnly = unit.getAttribute && unit.getAttribute('data-pw-logo-home') === '1'
      var inner = logoImgOf(unit) || (unit.querySelector ? unit.querySelector('img.pw-logo, img.pw-shop-logo, [data-pw-logo-added]') : null)
      if (inner && !homeOnly) {
        releaseFloatedBrandLink(unit)
        unit = headerLogoUnit(inner) || inner
        img = inner
      }
    }
    var parentLink = unit.closest ? unit.closest('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]') : null
    var measure = img || unit
    var mr = measure.getBoundingClientRect()
    var hr = host.getBoundingClientRect()
    var beforeParent = unit.parentNode
    var beforeLeft = unit.style.left
    var beforeTop = unit.style.top
    var sameHost = unit.parentNode === host
    if (unit.parentNode !== host) host.appendChild(unit)
    if (parentLink && parentLink !== unit && !(parentLink.getAttribute && parentLink.getAttribute('data-pw-logo-home') === '1')) {
      releaseFloatedBrandLink(parentLink)
    }
    unit.setAttribute('data-pw-logo-float', '1')
    var already = unit.getAttribute('data-pw-logo-floated') === '1' && !box
    var left
    var top
    var w
    var h
    if (box && box.w >= 8 && box.h >= 8) {
      left = box.x - hr.left
      top = box.y - hr.top
      w = box.w
      h = box.h
      unit.style.removeProperty('transform')
    } else if (already && sameHost) {
      var kept = readLogoBoxSize(unit)
      var keptFrame = logoFrameOf(el)
      if (!(kept.w > 8 && kept.h > 8) && keptFrame) kept = readLogoBoxSize(keptFrame)
      w = kept.w || unit.getBoundingClientRect().width
      h = kept.h || unit.getBoundingClientRect().height
      left = parseFloat(unit.style.left)
      top = parseFloat(unit.style.top)
      if (!isFinite(left) || left < 0) left = 0
      if (!isFinite(top) || top < 0) top = 0
    } else {
      left = mr.left - hr.left
      top = mr.top - hr.top
      var measured = readLogoBoxSize(unit)
      w = measured.w || mr.width
      h = measured.h || mr.height
      unit.style.removeProperty('transform')
    }
    if (!box && hr.width && w >= hr.width * 0.72) {
      var aspect = h / Math.max(1, w)
      w = Math.min(180, Math.round(hr.width * 0.42))
      h = Math.max(18, Math.round(w * aspect))
      if (h > 64) {
        h = 64
        w = Math.max(24, Math.round(h / Math.max(0.08, aspect)))
      }
    }
    unit.style.setProperty('position', 'absolute', 'important')
    unit.style.setProperty('display', isImgEl(unit) ? 'block' : 'inline-block', 'important')
    unit.style.setProperty('left', Math.round(Math.max(0, isFinite(left) ? left : 0)) + 'px', 'important')
    unit.style.setProperty('top', Math.round(Math.max(0, isFinite(top) ? top : 0)) + 'px', 'important')
    applyDefaultZ(unit, ${PW_SCENE_LOGO_Z})
    unit.style.setProperty('margin', '0', 'important')
    unit.style.setProperty('max-width', 'none', 'important')
    unit.style.setProperty('max-height', 'none', 'important')
    unit.style.setProperty('overflow', 'hidden', 'important')
    unit.setAttribute('data-pw-logo-floated', '1')
    if (w && h) applyLogoFrameSize(unit, w, h, unit.getAttribute('data-pw-logo-user-size') === '1')
    var innerFrame = logoFrameOf(unit)
    if (innerFrame && innerFrame !== unit) {
      // Keep real px on the frame — never width/height 100% (parseFloat('100%') === 100 breaks later fits).
      applyLogoFrameSize(innerFrame, w, h, innerFrame.getAttribute('data-pw-logo-user-size') === '1' || unit.getAttribute('data-pw-logo-user-size') === '1')
      innerFrame.style.setProperty('position', 'relative', 'important')
      innerFrame.style.setProperty('left', '0', 'important')
      innerFrame.style.setProperty('top', '0', 'important')
    }
    if (img) {
      unlockLogoImage(img)
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = 'contain'
      img.style.position = 'relative'
      img.style.left = '0'
      img.style.top = '0'
      if (unit.getAttribute && (unit.getAttribute('data-pw-z') || unit.getAttribute(SCENE.attr))) {
        img.style.removeProperty('z-index')
      } else {
        applyDefaultZ(img, ${PW_SCENE_LOGO_Z})
      }
    }
    return beforeParent !== unit.parentNode || beforeLeft !== unit.style.left || beforeTop !== unit.style.top
  }
  function headerMainOf(header) {
    if (!header || !header.querySelector) return header || null
    return header.querySelector('.pw-header-main, .pw-shop-header-inner') || header
  }
  function headerLogoHost(el) {
    var header = (el && el.closest) ? el.closest('header, .pw-header, .pw-shop-header') : null
    if (!header) header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return null
    return headerMainOf(header) || header
  }
  function ensureHeaderLogoHostPos(host) {
    if (!host) return
    try {
      var pos = cs(host).position
      if (!pos || pos === 'static') host.style.position = 'relative'
    } catch (errHostPos) {}
  }
  function reflowHeaderChrome() {
    syncEditDeviceAttr()
    sanitizeHeaderLogoLayout()
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return false
    var changed = false
    var main = headerMainOf(header)
    var cluster = header.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster') || main
    var floatedLinks = header.querySelectorAll('a.pw-brand[data-pw-logo-float], a.pw-shop-brand[data-pw-logo-float], a[data-pw-logo-home][data-pw-logo-float]')
    var li
    for (li = 0; li < floatedLinks.length; li++) {
      if (floatedLinks[li].getAttribute && floatedLinks[li].getAttribute('data-pw-logo-home') === '1') continue
      releaseFloatedBrandLink(floatedLinks[li])
    }
    var logos = header.querySelectorAll('[data-pw-logo-added="1"], .pw-logo-frame, [data-pw-logo-frame="1"], img.pw-logo, img.pw-shop-logo')
    var i
    for (i = 0; i < logos.length; i++) {
      if (logos[i].closest && logos[i].closest('footer, .pw-footer, .pw-shop-footer')) continue
      if (pinHeaderLogoFloat(logos[i], null)) changed = true
    }
    var link = headerBrandLink(header)
    if (link && (logoImgOf(link) || (link.querySelector && link.querySelector('img.pw-logo, img.pw-shop-logo')))) hideBrandLinkText(link)
    var search = header.querySelector('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    if (search && main && isMobileEdit() && !isUserMoved(search) && !(search.getAttribute && search.getAttribute('data-nanoai-ve-selected'))) {
      ensureSearchVisible()
      search = header.querySelector('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
      var actions = header.querySelector('.pw-header-actions, .pw-shop-header-actions')
      var mainW = main.getBoundingClientRect().width || (window.innerWidth || 390)
      var used = 0
      if (cluster) used += cluster.getBoundingClientRect().width
      if (actions) used += actions.getBoundingClientRect().width
      var leftover = Math.max(96, Math.round(mainW - used - 12))
      var saved = parseFloat(search && search.getAttribute ? (search.getAttribute('data-pw-search-width') || '') : '')
      if (search) lockSearchBox(search, saved > 0 ? Math.min(saved, leftover) : leftover)
    }
    return changed
  }
  function defaultLogoFrameBox() {
    return { w: 140, h: 36 }
  }
  function isStretchedLogoBox(w, h, inHeader) {
    var nw = Number(w) || 0
    var nh = Number(h) || 0
    if (nw < 200) return false
    if (nh <= 8) return true
    if (inHeader) return nw >= 480 && nw / nh >= 4
    return nw / nh >= 3.2
  }
  function clampLogoStartBox(w, h, inHeader) {
    if (isStretchedLogoBox(w, h, inHeader) || !(Number(w) > 8) || !(Number(h) > 8)) return defaultLogoFrameBox()
    var cap = inHeader ? { w: 220, h: 64 } : { w: 180, h: 48 }
    var nw = Math.max(24, Math.round(Number(w) || 72))
    var nh = Math.max(18, Math.round(Number(h) || 28))
    if (nw > cap.w) nw = cap.w
    if (nh > cap.h) nh = cap.h
    return { w: nw, h: nh }
  }
  function clampLogoBox(w, h, inHeader) {
    var viewW = window.innerWidth || document.documentElement.clientWidth || 360
    var cap = inHeader ? headerLogoFreeCap() : { w: Math.max(80, Math.min(220, Math.round(viewW * 0.4))), h: 120 }
    var nw = Math.max(24, Math.round(Number(w) || 72))
    var nh = Math.max(18, Math.round(Number(h) || 28))
    if (nw > cap.w) nw = cap.w
    if (nh > cap.h) nh = cap.h
    return { w: nw, h: nh }
  }
  function parseStylePx(v) {
    if (v == null || v === '') return 0
    var s = String(v).trim()
    if (!s || s.indexOf('%') >= 0) return 0
    var n = parseFloat(s)
    return isFinite(n) && n > 0 ? n : 0
  }
  function readLogoBoxSize(el) {
    if (!el) return { w: 0, h: 0 }
    var w = parseStylePx(el.style && el.style.width)
    var h = parseStylePx(el.style && el.style.height)
    if (!(w > 0 && h > 0)) {
      try {
        var r = el.getBoundingClientRect()
        if (!(w > 0) && r.width) w = r.width
        if (!(h > 0) && r.height) h = r.height
      } catch (eReadBox) {}
    }
    return { w: w || 0, h: h || 0 }
  }
  function applyLogoFrameSize(frame, w, h, user) {
    if (!frame) return
    var stretched = isStretchedLogoBox(w, h, isInHeader(frame)) && frame.getAttribute('data-pw-logo-user-size') !== '1' && !user
    var box = stretched ? clampLogoStartBox(w, h, isInHeader(frame)) : clampLogoBox(w, h, isInHeader(frame))
    frame.style.setProperty('width', box.w + 'px', 'important')
    frame.style.setProperty('height', box.h + 'px', 'important')
    frame.style.setProperty('max-width', 'none', 'important')
    frame.style.setProperty('max-height', 'none', 'important')
    frame.style.setProperty('overflow', 'hidden', 'important')
    if (user) frame.setAttribute('data-pw-logo-user-size', '1')
  }
  function headingHostOf(el) {
    if (!el || !el.closest) return null
    return el.closest('h1, h2, h3, [data-pw-el="heading"], [data-pw-info-title]')
  }
  function liftLogoOutOfHeading(el) {
    if (!el || el.nodeType !== 1) return el
    var heading = headingHostOf(el)
    if (!heading || !heading.parentNode) return el
    var link = el.closest ? el.closest('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]') : null
    var unit = (link && heading.contains(link))
      ? link
      : ((isLogoFrame(el) || isLogoImg(el) || isBrandLink(el) || (el.getAttribute && el.getAttribute('data-pw-logo-home') === '1'))
        ? (headerLogoUnit(el) || logoFrameOf(el) || el)
        : el)
    if (!unit || unit === heading || !heading.contains(unit)) return el
    heading.parentNode.insertBefore(unit, heading)
    return unit
  }
  function logoUnitAtPoint(x, y) {
    if (!isFinite(x) || !isFinite(y)) return null
    var nodes = document.querySelectorAll('[data-pw-logo-frame="1"], .pw-logo-frame, img.pw-logo, img.pw-shop-logo, [data-pw-logo-added]')
    var best = null
    var bestArea = Infinity
    var i
    for (i = 0; i < nodes.length; i++) {
      var n = nodes[i]
      if (!pointInEl(n, x, y)) continue
      var r = n.getBoundingClientRect()
      var area = Math.max(1, r.width * r.height)
      if (area < bestArea) {
        best = n
        bestArea = area
      }
    }
    if (!best) return null
    var frame = logoFrameOf(best)
    if (frame && pointInEl(frame, x, y)) return frame
    if (isLogoFrame(best) || isLogoImg(best) || (best.getAttribute && best.getAttribute('data-pw-logo-added') === '1')) {
      return frame || best
    }
    return null
  }
  function pruneEmptyLogoFrames() {
    var nodes = document.querySelectorAll('[data-pw-logo-frame="1"], .pw-logo-frame')
    var i
    for (i = nodes.length - 1; i >= 0; i--) {
      var frame = nodes[i]
      var img = frame.querySelector ? frame.querySelector('img') : null
      if (img) continue
      if (frame.parentNode) frame.parentNode.removeChild(frame)
    }
  }
  function sanitizeLogoFrames() {
    pruneEmptyLogoFrames()
    var nodes = document.querySelectorAll('[data-pw-logo-frame="1"], .pw-logo-frame')
    var i
    for (i = 0; i < nodes.length; i++) {
      var frame = nodes[i]
      liftLogoOutOfHeading(frame)
      var size = readLogoBoxSize(frame)
      var w = size.w || 72
      var h = size.h || 28
      if (frame.getAttribute('data-pw-logo-user-size') === '1') applyLogoFrameSize(frame, w, h, true)
      else applyLogoFrameSize(frame, w, h)
    }
  }
  function ensureLogoFrame(img) {
    if (!isImgEl(img) || !isLogoImg(img)) return null
    var existing = logoFrameOf(img)
    if (existing) {
      liftLogoOutOfHeading(existing)
      var es = readLogoBoxSize(existing)
      var ew = es.w || 72
      var eh = es.h || 28
      applyLogoFrameSize(existing, ew, eh, existing.getAttribute('data-pw-logo-user-size') === '1')
      img.style.maxWidth = 'none'
      img.style.maxHeight = 'none'
      var pan = parseLogoPan(img)
      if (!img.getAttribute('data-pw-logo-pan-x')) {
        var leftover = parseTransform(img)
        if (leftover.x || leftover.y) {
          pan = leftover
        }
      }
      applyLogoTransform(img, parseLogoZoom(img), pan.x, pan.y)
      applyLogoCrop(img, parseLogoCrop(img).x, parseLogoCrop(img).y)
      return existing
    }
    var r = img.getBoundingClientRect()
    var box = clampLogoStartBox(r.width || 72, r.height || 28, isInHeader(img))
    var w = box.w
    var h = box.h
    var wrap = document.createElement('span')
    wrap.className = 'pw-logo-frame'
    wrap.setAttribute('data-pw-logo-frame', '1')
    wrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;overflow:hidden;width:' + w + 'px;height:' + h + 'px;max-width:none;max-height:none;flex-shrink:0;vertical-align:middle;position:relative;z-index:${PW_SCENE_LOGO_Z}'
    var parent = img.parentNode
    if (!parent) return null
    parent.insertBefore(wrap, img)
    wrap.appendChild(img)
    liftLogoOutOfHeading(wrap)
    var pos = ''
    try { pos = cs(img).position } catch (errPos) {}
    if (pos === 'absolute' || pos === 'fixed') {
      wrap.style.position = pos
      wrap.style.left = img.style.left || wrap.style.left
      wrap.style.top = img.style.top || wrap.style.top
      wrap.style.zIndex = img.style.zIndex || '160'
      img.style.position = 'relative'
      img.style.left = '0'
      img.style.top = '0'
    }
    img.style.maxWidth = 'none'
    img.style.maxHeight = 'none'
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'contain'
    applyLogoZoom(img, parseLogoZoom(img))
    applyLogoCrop(img, parseLogoCrop(img).x, parseLogoCrop(img).y)
    return wrap
  }
  function brandHostOf(el) {
    if (!el || !el.closest) return el
    return el.closest('a.pw-brand, a.pw-shop-brand, .pw-brand, .pw-shop-brand-cluster, .pw-brand-cluster, .pw-shop-footer-brand') || el
  }
  function hostHasLogoImg(host) {
    return !!(host && host.querySelector && host.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]'))
  }
  function hideSiblingWordmarks(el) {
    var host = brandHostOf(el)
    if (!host || !host.querySelectorAll) return
    var wms = host.querySelectorAll('.pw-wordmark')
    for (var i = 0; i < wms.length; i++) {
      wms[i].setAttribute('data-pw-logo-wordmark-hidden', '1')
      wms[i].style.display = 'none'
    }
  }
  function hideBrandLinkText(link) {
    if (!link) return
    hideSiblingWordmarks(link)
    var leftover = []
    for (var i = 0; i < link.childNodes.length; i++) {
      var n = link.childNodes[i]
      if (n.nodeType === 3 && String(n.textContent || '').replace(/\\s+/g, '').length) leftover.push(n)
    }
    if (!leftover.length) return
    var span = document.createElement('span')
    span.className = 'pw-wordmark'
    span.setAttribute('data-pw-logo-wordmark-hidden', '1')
    span.style.display = 'none'
    leftover[0].parentNode.insertBefore(span, leftover[0])
    for (var j = 0; j < leftover.length; j++) span.appendChild(leftover[j])
  }
  function restoreBrandWordmarks(host) {
    if (!host || !host.querySelectorAll) return
    var scope = host.closest ? (host.closest('header, .pw-header, .pw-shop-header, .pw-brand-cluster, .pw-shop-brand-cluster, a.pw-brand, a.pw-shop-brand') || host) : host
    var wms = scope.querySelectorAll('[data-pw-logo-wordmark-hidden="1"], .pw-wordmark')
    var i
    for (i = 0; i < wms.length; i++) {
      wms[i].removeAttribute('data-pw-logo-wordmark-hidden')
      wms[i].style.display = ''
    }
  }
  function clearHeaderLogoPaint(root) {
    var scope = root && root.querySelectorAll ? root : document
    var nodes = scope.querySelectorAll ? scope.querySelectorAll('header, .pw-header, .pw-shop-header, .pw-header-main, .pw-shop-header-inner, .pw-brand-cluster, .pw-shop-brand-cluster, a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home], .pw-logo-frame, [data-pw-logo-frame="1"]') : []
    var i
    for (i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (!el || !el.style) continue
      el.style.removeProperty('background-image')
      el.style.removeProperty('background-repeat')
      el.style.removeProperty('background-size')
      el.style.removeProperty('background-position')
      if (el.style.overflow === 'auto' || el.style.overflow === 'scroll' || el.style.overflowX === 'auto' || el.style.overflowX === 'scroll') {
        el.style.removeProperty('overflow')
        el.style.removeProperty('overflow-x')
      }
    }
  }
  function headerBrandLink(header) {
    if (!header || !header.querySelector) return null
    return header.querySelector('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]')
  }
  function dedupeHeaderLogos(keepEl) {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header || !header.querySelectorAll) return
    var imgs = header.querySelectorAll('img.pw-logo, img.pw-shop-logo, img.site-logo, [data-pw-logo-added]')
    var keep = keepEl && header.contains(keepEl) ? (isImgEl(keepEl) ? keepEl : (logoImgOf(keepEl) || keepEl)) : null
    var i
    if (!keep) {
      for (i = 0; i < imgs.length; i++) {
        if (isFilledLogo(imgs[i])) { keep = imgs[i]; break }
      }
    }
    if (!keep && imgs.length) keep = imgs[0]
    var keepFrame = keep ? (logoFrameOf(keep) || keep) : null
    var frames = header.querySelectorAll('.pw-logo-frame, [data-pw-logo-frame="1"]')
    for (i = 0; i < frames.length; i++) {
      if (frames[i] === keepFrame) continue
      if (keepFrame && keepFrame.contains && keepFrame.contains(frames[i])) continue
      if (frames[i].parentNode) frames[i].parentNode.removeChild(frames[i])
    }
    imgs = header.querySelectorAll('img.pw-logo, img.pw-shop-logo, img.site-logo, [data-pw-logo-added]')
    for (i = 0; i < imgs.length; i++) {
      if (imgs[i] === keep) continue
      if (keepFrame && keepFrame.contains && keepFrame.contains(imgs[i])) continue
      var frame = logoFrameOf(imgs[i])
      var gone = frame || imgs[i]
      if (gone.parentNode) gone.parentNode.removeChild(gone)
    }
    pruneEmptyLogoFrames()
  }
  function sanitizeHeaderLogoLayout() {
    clearHeaderLogoPaint(document)
    dedupeHeaderLogos()
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return
    var imgs = header.querySelectorAll('img.pw-logo, img.pw-shop-logo, img.site-logo, [data-pw-logo-added]')
    var i
    for (i = 0; i < imgs.length; i++) {
      imgs[i].style.backgroundRepeat = 'no-repeat'
      imgs[i].style.objectFit = 'contain'
      revealHeaderLogo(imgs[i])
    }
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
  function applyThemeVars(vars) {
    if (!vars || typeof vars !== 'object') return
    var names = Object.keys(vars)
    var i
    var style = document.getElementById('pw-theme-root')
    if (!style) {
      style = document.createElement('style')
      style.id = 'pw-theme-root'
      ;(document.head || document.documentElement).appendChild(style)
    }
    var body = []
    for (i = 0; i < names.length; i++) body.push(names[i] + ':' + vars[names[i]] + ' !important')
    style.textContent = ':root{' + body.join(';') + '}'
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
  function isLogoPlaceholderSrc(src) {
    var s = String(src || '').trim()
    return !s || s.indexOf('data:image/') === 0
  }
  function isFilledLogo(el) {
    if (!isImgEl(el)) return false
    if (el.getAttribute && el.getAttribute('data-pw-logo-empty') === '1') return false
    var src = (el.getAttribute('src') || '').trim()
    return src.length > 4 && !isLogoPlaceholderSrc(src)
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
    var texts = document.querySelectorAll('.pw-wordmark, a.pw-shop-brand, a.pw-brand, .pw-shop-footer-name')
    for (var t = 0; t < texts.length; t++) {
      var el = texts[t]
      if (!el || isIgnored(el)) continue
      if (el.getAttribute && el.getAttribute('data-pw-logo-wordmark-hidden') === '1') continue
      if (hostHasLogoImg(brandHostOf(el))) continue
      if (isBrandLink(el) && el.querySelector && el.querySelector('.pw-wordmark')) continue
      if (out.indexOf(el) >= 0) continue
      if (el.setAttribute) el.setAttribute('data-pw-logo-slot', logoSlotKind(el))
      out.push(el)
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
  function clearLogoSlotPaint(img) {
    if (!img) return
    var nodes = [img, logoFrameOf(img), headerLogoUnit(img)]
    var i
    for (i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      if (!node || !node.style) continue
      node.style.removeProperty('background')
      node.style.removeProperty('background-color')
      node.style.removeProperty('background-image')
      node.style.setProperty('background', 'transparent', 'important')
      node.style.setProperty('background-color', 'transparent', 'important')
    }
  }
  function resetLogoImageLayout(img) {
    if (!img || !img.style) return
    img.removeAttribute('data-pw-logo-zoom')
    img.removeAttribute('data-pw-logo-pan-x')
    img.removeAttribute('data-pw-logo-pan-y')
    img.removeAttribute('data-pw-logo-crop-x')
    img.removeAttribute('data-pw-logo-crop-y')
    img.removeAttribute('data-pw-logo-float')
    img.removeAttribute('data-pw-logo-floated')
    img.style.removeProperty('clip-path')
    img.style.removeProperty('transform')
    img.style.objectFit = 'contain'
  }
  function fitLogoFrameToImage(img) {
    if (!img || !isImgEl(img)) return null
    var nw = img.naturalWidth || 0
    var nh = img.naturalHeight || 0
    if (nw < 4 || nh < 4) return null
    var frame = logoFrameOf(img) || img
    var unit = isInHeader(img) ? (headerLogoUnit(img) || frame) : frame
    var inHeader = isInHeader(img)
    var cap = inHeader ? headerLogoFreeCap() : { w: Math.max(80, Math.min(220, Math.round((window.innerWidth || 360) * 0.4))), h: 120 }
    // At 100% zoom: frame matches image aspect so object-fit:contain fills the box (no letterbox from old crop).
    var preferLong = inHeader ? 160 : 140
    var long = Math.max(nw, nh)
    var scale = preferLong / long
    if (scale > 1) scale = 1
    var w = Math.max(24, Math.round(nw * scale))
    var h = Math.max(18, Math.round(nh * scale))
    if (w > cap.w || h > cap.h) {
      var fit = Math.min(cap.w / w, cap.h / h)
      w = Math.max(24, Math.round(w * fit))
      h = Math.max(18, Math.round(h * fit))
    }
    if (frame && frame.removeAttribute) frame.removeAttribute('data-pw-logo-user-size')
    if (unit && unit !== frame && unit.removeAttribute) unit.removeAttribute('data-pw-logo-user-size')
    applyLogoFrameSize(frame, w, h)
    if (unit && unit !== frame) applyLogoFrameSize(unit, w, h)
    applyLogoTransform(img, 1, 0, 0)
    img.removeAttribute('data-pw-logo-crop-x')
    img.removeAttribute('data-pw-logo-crop-y')
    img.style.removeProperty('clip-path')
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.objectFit = 'contain'
    img.style.backgroundColor = 'transparent'
    return { w: w, h: h }
  }
  function afterLogoImageReady(img, fn) {
    if (!img || typeof fn !== 'function') return
    var run = function () { try { fn() } catch (eReady) {} }
    var src = String(img.getAttribute('src') || img.src || '').trim()
    var real = src && !isLogoPlaceholderSrc(src) && img.complete && img.naturalWidth > 4
    if (real) {
      run()
      return
    }
    var done = false
    var finish = function () {
      if (done) return
      done = true
      img.removeEventListener('load', finish)
      img.removeEventListener('error', finish)
      run()
    }
    img.addEventListener('load', finish)
    img.addEventListener('error', finish)
  }
  function sealAppliedLogo(node) {
    if (!node) return node
    // ensureLogoHomeLink often returns <a> — always resolve to the img before sealing.
    var img = isImgEl(node)
      ? node
      : (logoImgOf(node) || (node.querySelector
        ? node.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]')
        : null))
    if (!img || !isImgEl(img)) return node
    resetLogoImageLayout(img)
    clearLogoSlotPaint(img)
    try { liftLogoOutOfHeading(img) } catch (eLift) {}
    try { ensureLogoFrame(img) } catch (eSeal) {}
    var sealFrame = logoFrameOf(img)
    if (sealFrame && sealFrame.removeAttribute) sealFrame.removeAttribute('data-pw-logo-user-size')
    var sealUnit = headerLogoUnit(img)
    if (sealUnit && sealUnit !== sealFrame && sealUnit.removeAttribute) sealUnit.removeAttribute('data-pw-logo-user-size')
    clearLogoSlotPaint(img)
    try { revealHeaderLogo(img) } catch (eRev) {}
    if (isInHeader(img)) {
      try { pinHeaderLogoFloat(img, null) } catch (ePin) {}
    }
    afterLogoImageReady(img, function () {
      clearLogoSlotPaint(img)
      var fitted = fitLogoFrameToImage(img)
      if (isInHeader(img)) {
        try {
          var unit = headerLogoUnit(img)
          var ur = { left: 0, top: 0 }
          try { if (unit) ur = unit.getBoundingClientRect() } catch (eUr) {}
          var fw = fitted && fitted.w ? fitted.w : 120
          var fh = fitted && fitted.h ? fitted.h : 36
          pinHeaderLogoFloat(img, { x: ur.left, y: ur.top, w: fw, h: fh })
        } catch (ePin2) {}
      }
      try { positionAllHandles() } catch (ePos) {}
      post('dirty', {})
      refreshSelect()
    })
    return img
  }
  function paintLogoSrc(img, url) {
    if (!img || !url) return img
    img.removeAttribute('srcset')
    img.removeAttribute('data-pw-logo-empty')
    resetLogoImageLayout(img)
    img.setAttribute('referrerpolicy', 'no-referrer')
    img.setAttribute('decoding', 'async')
    img.style.objectFit = 'contain'
    img.style.opacity = '1'
    img.style.visibility = 'visible'
    img.style.display = 'block'
    img.style.backgroundColor = 'transparent'
    if (img.src === url) {
      try { img.src = '' } catch (eClear) {}
    }
    img.setAttribute('src', url)
    try { img.src = url } catch (eSrc) {}
    return img
  }
  function applyLogoToEl(el, url) {
    if (!el || !url) return el
    if (isImgEl(el)) {
      paintLogoSrc(el, url)
      el.style.transform = ''
      if (el.setAttribute) el.setAttribute('data-pw-logo-slot', logoSlotKind(el))
      hideSiblingWordmarks(el)
      hideBrandLinkText(el.closest ? el.closest('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]') : null)
      try { ensureLogoHomeLink(el) } catch (eHome) {}
      return sealAppliedLogo(el) || el
    }
    if (hasClassToken(el, 'pw-shop-footer-name')) {
      var footHost = el.closest ? el.closest('.pw-shop-footer-brand') : el.parentNode
      var footTarget = footHost || el.parentNode
      if (footTarget && footTarget.querySelector) {
        var footImg = footTarget.querySelector('img.pw-shop-footer-logo, img.pw-logo, img.pw-shop-logo')
        if (footImg) {
          paintLogoSrc(footImg, url)
        } else {
          footImg = document.createElement('img')
          footImg.className = 'pw-shop-footer-logo pw-logo'
          footImg.setAttribute('data-pw-logo-slot', 'footer')
          footImg.setAttribute('alt', String(el.textContent || 'logo').replace(/\\s+/g, ' ').trim() || 'logo')
          paintLogoSrc(footImg, url)
          footTarget.insertBefore(footImg, el)
        }
        el.setAttribute('data-pw-logo-wordmark-hidden', '1')
        el.style.display = 'none'
        try { ensureLogoHomeLink(footImg) } catch (eFootHome) {}
        return sealAppliedLogo(footImg) || footImg
      }
    }
    var kind = logoSlotKind(el)
    var existing = brandHostOf(el)
    var hostImg = existing && existing.querySelector ? existing.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]') : null
    if (hostImg) {
      paintLogoSrc(hostImg, url)
      hideSiblingWordmarks(hostImg)
      hideBrandLinkText(isBrandLink(existing) ? existing : (hostImg.closest ? hostImg.closest('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]') : null))
      try { ensureLogoHomeLink(hostImg) } catch (eHostHome) {}
      return sealAppliedLogo(hostImg) || hostImg
    }
    var img = document.createElement('img')
    img.className = kind === 'footer' ? 'pw-shop-footer-logo pw-logo' : 'pw-logo pw-shop-logo'
    img.setAttribute('data-pw-logo-slot', kind)
    img.setAttribute('alt', String(el.textContent || 'logo').replace(/\\s+/g, ' ').trim() || 'logo')
    paintLogoSrc(img, url)
    var link = isBrandLink(el) ? el : (el.closest ? el.closest('a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home]') : null)
    if (clsOf(el).indexOf('pw-shop-footer-brand') >= 0) {
      el.insertBefore(img, el.firstChild)
      hideSiblingWordmarks(img)
      try { ensureLogoHomeLink(img) } catch (eInsHome) {}
      return sealAppliedLogo(img) || img
    }
    if (link) {
      if (isWordmarkEl(el) && el !== link) {
        el.setAttribute('data-pw-logo-wordmark-hidden', '1')
        el.style.display = 'none'
      }
      hideSiblingWordmarks(link)
      if (!link.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo')) {
        link.insertBefore(img, link.firstChild)
      }
      hideBrandLinkText(link)
      try { ensureLogoHomeLink(img) } catch (eLinkHome) {}
      return sealAppliedLogo(img) || img
    }
    if (el.parentNode) {
      var headingEl = headingHostOf(el)
      if (headingEl === el || (el.matches && el.matches('h1, h2, h3, [data-pw-el="heading"], [data-pw-info-title]'))) {
        el.parentNode.insertBefore(img, el)
      } else {
        el.parentNode.insertBefore(img, el)
        el.setAttribute('data-pw-logo-wordmark-hidden', '1')
        el.style.display = 'none'
      }
    }
    hideSiblingWordmarks(img)
    liftLogoOutOfHeading(img)
    try { ensureLogoHomeLink(img) } catch (eNewHome) {}
    return sealAppliedLogo(img) || img
  }
  function isBgImageEl(el) {
    if (!el || el.nodeType !== 1) return false
    var tag = el.tagName.toLowerCase()
    if (['script','style','img','svg','iframe','button','a','input'].indexOf(tag) >= 0) return false
    return Boolean(extractBgUrl(el))
  }
  function parseChromeIconSize(el) {
    if (!el || !el.getAttribute) return 22
    var attr = Number(el.getAttribute('data-pw-chrome-size'))
    if (attr >= 16 && attr <= 100) return Math.round(attr)
    try {
      var raw = cs(el).getPropertyValue('--pw-chrome-size')
      var n = parseFloat(raw)
      if (n >= 16 && n <= 100) return Math.round(n)
    } catch (errSize) {}
    return 22
  }
  function keepChromeIconCenter(el, before) {
    if (!el || !el.style || !before) return
    if (!(before.width > 0 || before.height > 0)) return
    // Float chrome is viewport-fixed. Recalculating left/top from the box
    // (or baking %) on every slider tick makes the icon jump around the page.
    if (isChromeFloatEl(el)) return
    if (el.getAttribute && el.getAttribute('data-pw-pin-screen') === '1') return
    var after = null
    try { after = el.getBoundingClientRect() } catch (errAfter) { return }
    if (!after) return
    var shiftX = (before.left + before.width / 2) - (after.left + after.width / 2)
    var shiftY = (before.top + before.height / 2) - (after.top + after.height / 2)
    if (Math.abs(shiftX) < 0.5 && Math.abs(shiftY) < 0.5) return
    var pos = ''
    try { pos = String(cs(el).position || '') } catch (errPos) { pos = '' }
    var leftRaw = String(el.style.left || '')
    var topRaw = String(el.style.top || '')
    var left = parseFloat(leftRaw)
    var top = parseFloat(topRaw)
    if (
      (pos === 'absolute' || pos === 'fixed') &&
      leftRaw.indexOf('px') >= 0 &&
      topRaw.indexOf('px') >= 0 &&
      isFinite(left) &&
      isFinite(top)
    ) {
      el.style.setProperty('left', Math.round(left + shiftX) + 'px', 'important')
      el.style.setProperty('top', Math.round(top + shiftY) + 'px', 'important')
      el.style.setProperty('right', 'auto', 'important')
      el.style.setProperty('bottom', 'auto', 'important')
      markUserMoved(el)
      return
    }
    var t = parseTransform(el)
    applyTranslatePx(el, t.x + shiftX, t.y + shiftY)
    markUserMoved(el)
  }
  function applyChromeIconSize(el, size) {
    if (!el || !el.setAttribute) return
    var n = Math.round(Number(size))
    if (!(n >= 16 && n <= 100)) n = 22
    var before = null
    try { before = el.getBoundingClientRect() } catch (errBefore) { before = null }
    el.setAttribute('data-pw-chrome-size', String(n))
    try { el.style.setProperty('--pw-chrome-size', n + 'px') } catch (errSetSize) {}
    try { sizeChromeIcons(el) } catch (errSizeIcons) {}
    try { keepChromeIconCenter(el, before) } catch (errKeepCenter) {}
  }
  function setChromeSize(size) {
    var el = selected
      ? (chromeBtnElOf(selected) || catToggleElOf(selected) || searchImageElOf(selected) || selected)
      : null
    if (!el) return
    applyChromeIconSize(el, size)
    try { positionAllHandles() } catch (errPosHandles) {}
    post('dirty', {})
    refreshSelect()
  }
  function chromeKindOf(el) {
    var host = chromeBtnElOf(el) || el
    if (!host || !host.getAttribute) return ''
    return String(host.getAttribute('data-pw-chrome-btn') || '').replace(/[^a-z0-9-]/g, '')
  }
  function isCatToggleEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwElOf(el) === 'cat-toggle') return true
    if (el.getAttribute && el.getAttribute('data-pw-cat-toggle') != null) return true
    return hasClassToken(el, 'pw-cat-btn') || hasClassToken(el, 'pw-shop-cat-btn')
  }
  function catToggleElOf(el) {
    if (!el || el.nodeType !== 1 || !el.closest) return null
    return el.closest('[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn')
  }
  function chromeBtnElOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (catToggleElOf(el)) return null
    if (searchSubmitElOf(el) || searchImageElOf(el)) return null
    if (isChromeBtn(el) || isAddedChrome(el)) return el
    var bottom = bottomNavItemOf(el)
    if (bottom) return bottom
    return el.closest ? el.closest('.pw-icon-btn,.pw-shop-icon-btn,[data-pw-chrome-btn],[data-pw-chrome-added]') : null
  }
  function isChromeChatBtn(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-chrome-btn') === 'chat') return true
    return !!(el.closest && el.closest('[data-pw-chrome-btn="chat"]'))
  }
  function chromeChatBtnOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.getAttribute && el.getAttribute('data-pw-chrome-btn') === 'chat') return el
    return el.closest ? el.closest('[data-pw-chrome-btn="chat"]') : null
  }
  function isChatEmbedLauncher(el) {
    if (!el || el.nodeType !== 1) return false
    if (isChromeChatBtn(el)) return false
    if (el.getAttribute && el.getAttribute('data-pw-chat-launcher') === '1') return true
    if (el.getAttribute && el.getAttribute('data-nanoai-chat-bubble') === '1') return true
    return hasClassToken(el, 'pw-fab-chat')
  }
  function chatEmbedLauncherOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (isChatEmbedLauncher(el)) return el
    return el.closest
      ? el.closest('[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')
      : null
  }
  function chatEmbedAtPoint(x, y) {
    var nodes = document.querySelectorAll('[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')
    for (var i = nodes.length - 1; i >= 0; i--) {
      var el = nodes[i]
      if (el.getAttribute && el.getAttribute('data-pw-hidden') === '1') continue
      if (pointInEl(el, x, y)) return el
    }
    return null
  }
  var chatLauncherHidden = true
  var chatPrepLogoUrl = ''
  var chatPrepDevice = 'desktop'
  function applyChatLogoToChromeBtn(btn, url, force) {
    if (!btn || !url || !/^https?:/i.test(String(url))) return
    if (!force && btn.getAttribute && btn.getAttribute('data-pw-chat-icon-logo') === '1') return
    var wrap = btn.querySelector ? btn.querySelector('.pw-chrome-icon-wrap') : null
    if (!wrap) return
    var img = wrap.querySelector ? wrap.querySelector('img.pw-chrome-chat-logo') : null
    if (!img) {
      var svgs = wrap.querySelectorAll ? wrap.querySelectorAll('svg') : []
      for (var si = 0; si < svgs.length; si++) svgs[si].parentNode && svgs[si].parentNode.removeChild(svgs[si])
      img = document.createElement('img')
      img.className = 'pw-chrome-chat-logo'
      img.alt = ''
      img.setAttribute('width', '22')
      img.setAttribute('height', '22')
      img.setAttribute('draggable', 'false')
      wrap.insertBefore(img, wrap.firstChild)
    }
    img.src = String(url)
    if (force) btn.setAttribute('data-pw-chat-icon-logo', '1')
  }
  function setChatIconLogo(url) {
    applyChatLogoToChromeButtons(url, true)
    post('dirty', {})
    refreshSelect()
  }
  function applyChatLogoToChromeButtons(url, force) {
    var u = String(url || '').trim()
    if (!u || !/^https?:/i.test(u)) return
    var nodes = document.querySelectorAll('[data-pw-chrome-btn="chat"]')
    for (var i = 0; i < nodes.length; i++) applyChatLogoToChromeBtn(nodes[i], u, force)
  }
  function stampChatEmbedLauncher(el) {
    if (!el || isChromeChatBtn(el)) return
    el.setAttribute('data-pw-chat-launcher', '1')
    try {
      el.style.pointerEvents = 'auto'
    } catch (errChatPe) {}
  }
  function neutralizeChatWidgetLauncher(el) {
    if (!el || !el.parentNode) return el
    var clone = el.cloneNode(true)
    el.parentNode.replaceChild(clone, el)
    stampChatEmbedLauncher(clone)
    return clone
  }
  function listChatEmbedLaunchers() {
    return document.querySelectorAll('[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')
  }
  function hideChatEmbedLaunchers() {
    chatLauncherHidden = true
    var nodes = listChatEmbedLaunchers()
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (el.getAttribute && el.getAttribute('data-pw-ve-chat-preview') === '1') {
        if (el.parentNode) el.parentNode.removeChild(el)
      } else {
        el.setAttribute('data-pw-hidden', '1')
      }
    }
    selected = null
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
    post('deselect', {})
    post('hideChatLauncher', { hidden: true })
    post('dirty', {})
    postHidden()
  }
  function restoreChatEmbedLauncher() {
    chatLauncherHidden = false
    var nodes = listChatEmbedLaunchers()
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].removeAttribute('data-pw-hidden')
      try { nodes[i].style.display = '' } catch (errChatShow) {}
    }
    injectChatEmbedPreview(chatPrepLogoUrl, chatPrepDevice)
    var next = document.querySelector('[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')
    if (next) selectEl(next)
    post('hideChatLauncher', { hidden: false })
    post('dirty', {})
    postHidden()
  }
  function injectChatEmbedPreview(logoUrl, device) {
    if (chatLauncherHidden) return
    if (document.querySelector('[data-pw-chrome-btn="chat"]')) return
    if (document.querySelector('[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')) return
    var btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pw-fab-chat pw-chat-embed-preview'
    stampChatEmbedLauncher(btn)
    btn.setAttribute('data-pw-ve-chat-preview', '1')
    btn.setAttribute('aria-label', 'Chat')
    var bottom = device === 'mobile' || device === 'tablet' ? '84px' : '16px'
    btn.style.cssText =
      'position:fixed;right:16px;bottom:' +
      bottom +
      ';z-index:2147483001;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;padding:0;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.2);background:var(--pw-accent,#6366f1);display:flex;align-items:center;justify-content:center;'
    var logo = String(logoUrl || '').trim()
    if (logo && /^https?:/i.test(logo)) {
      var img = document.createElement('img')
      img.src = logo
      img.alt = ''
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;pointer-events:none'
      btn.appendChild(img)
    } else {
      btn.textContent = '💬'
      btn.style.fontSize = '22px'
      btn.style.color = '#fff'
    }
    document.body.appendChild(btn)
  }
  function prepareChatEmbedForEditor(d) {
    d = d || {}
    var logoUrl = String(d.logoUrl || '').trim()
    var chatIconLogoUrl = String(d.chatIconLogoUrl || '').trim()
    var sharedChatIcon = chatIconLogoUrl && /^https?:/i.test(chatIconLogoUrl) ? chatIconLogoUrl : ''
    var device = d.device === 'mobile' || d.device === 'tablet' || d.device === 'laptop' ? d.device : 'desktop'
    chatPrepLogoUrl = sharedChatIcon || logoUrl
    chatPrepDevice = device
    chatLauncherHidden = d.hideChatLauncher !== false
    var roots = document.querySelectorAll('#nanoai-chat-widget-v1,[data-widget-id="nanoai-chat-widget-v1"]')
    for (var ri = 0; ri < roots.length; ri++) {
      var root = roots[ri]
      try { root.style.pointerEvents = 'none' } catch (errChatRoot) {}
      var panel = root.querySelector ? root.querySelector('.nanoai-chat-panel') : null
      if (panel) panel.style.display = 'none'
      var bubble = root.querySelector ? root.querySelector('[data-nanoai-chat-bubble="1"]') : null
      if (bubble) neutralizeChatWidgetLauncher(bubble)
    }
    var fabs = document.querySelectorAll('.pw-fab-chat')
    for (var fi = 0; fi < fabs.length; fi++) stampChatEmbedLauncher(fabs[fi])
    if (sharedChatIcon) applyChatLogoToChromeButtons(sharedChatIcon, true)
    else applyChatLogoToChromeButtons(logoUrl)
    if (chatLauncherHidden) {
      var hiddenNodes = listChatEmbedLaunchers()
      for (var hi = 0; hi < hiddenNodes.length; hi++) {
        if (isChromeChatBtn(hiddenNodes[hi])) continue
        if (hiddenNodes[hi].getAttribute && hiddenNodes[hi].getAttribute('data-pw-ve-chat-preview') === '1') {
          if (hiddenNodes[hi].parentNode) hiddenNodes[hi].parentNode.removeChild(hiddenNodes[hi])
        } else {
          hiddenNodes[hi].setAttribute('data-pw-hidden', '1')
        }
      }
      return
    }
  }
  function editKindOf(el) {
    if (!el) return 'other'
    if (chatEmbedLauncherOf(el)) return 'chat-embed'
    if (isAddedBg(el)) return 'added-bg'
    if (isWordmarkTextEl(el)) return 'wordmark'
    if (isLogoTarget(el) || isLogoFrame(el) || isLogoSlot(el) || isLogoImg(el)) return 'logo'
    if (searchSubmitElOf(el) && (isSearchSubmitEl(el) || el === searchSubmitElOf(el))) return 'search-submit'
    if (searchImageElOf(el) && (isSearchImageEl(el) || el === searchImageElOf(el))) return 'search-image'
    if (isSearchEl(el) || (searchElOf(el) && el === searchElOf(el))) return 'search'
    if (catToggleElOf(el)) return 'cat-toggle'
    if (dotsElOf(el) && (pwElOf(el) === 'dots' || el === dotsElOf(el))) return 'dots'
    if (fieldElOf(el) && el === fieldElOf(el)) return 'field'
    if (badgeElOf(el) && (pwElOf(el) === 'badge' || el === badgeElOf(el))) return 'badge'
    if (isAddedBtn(el)) return 'added-btn'
    if (isAddedText(el)) return 'added-text'
    if (chromeBtnElOf(el) || isAddedChrome(el)) return 'chrome'
    var role = pwElOf(el)
    if (role === 'cta' || role === 'cta-secondary') return 'cta'
    if (role === 'nav-link' || role === 'link' || role === 'crumb' || role === 'section-more' || role === 'menu-item') return 'nav-link'
    if (isImgEl(el)) return 'image'
    if (isBtnEl(el) && !chromeBtnElOf(el) && !isHeaderWidget(el)) return 'cta'
    if (el.tagName && el.tagName.toLowerCase() === 'a' && canSetHrefEl(el)) return 'nav-link'
    return 'other'
  }
  function isChromeBtn(el) {
    if (!el || el.nodeType !== 1) return false
    if (catToggleElOf(el) || isCatToggleEl(el)) return false
    if (searchSubmitElOf(el) === el || searchImageElOf(el) === el) return false
    if (el.getAttribute && (el.getAttribute('data-pw-chrome-btn') || el.getAttribute('data-pw-chrome-added'))) return true
    var cls = clsOf(el)
    if (cls.indexOf('pw-icon-btn') >= 0 || cls.indexOf('pw-account-btn') >= 0 || cls.indexOf('pw-shop-icon-btn') >= 0) return true
    if (bottomNavItemOf(el) === el) return true
    var host = el.closest ? el.closest('.pw-icon-btn,.pw-shop-icon-btn,[data-pw-chrome-btn],[data-pw-chrome-added]') : null
    return !!host && host === el
  }
  function isShopRegionHost(el) {
    if (!el || el.nodeType !== 1) return false
    var own = el.getAttribute ? el.getAttribute('data-pw-region') : ''
    if (own === 'header' || own === 'nav' || own === 'footer' || own === 'promo' || own === 'topbar') return true
    var tag = el.tagName.toLowerCase()
    if (tag === 'header' || tag === 'footer') return true
    var cls = clsOf(el)
    if (cls.indexOf('pw-header-main') >= 0 || cls.indexOf('pw-shop-header-inner') >= 0) return true
    if (cls.indexOf('pw-bottom-nav') >= 0 || cls.indexOf('pw-shop-bottom-nav') >= 0) return true
    if (cls.indexOf('pw-topbar') >= 0 || cls.indexOf('pw-shop-topbar') >= 0) return true
    if (cls.indexOf('pw-pdp-sticky') >= 0) return true
    return false
  }
  function isChromeBgHost(el) {
    if (!el || el.nodeType !== 1) return false
    if (isAddedBg(el)) return true
    var bgRole = el.getAttribute ? el.getAttribute('data-pw-bg-role') : ''
    if (bgRole && bgRole !== 'added') return true
    var tag = el.tagName.toLowerCase()
    if (tag === 'header' || tag === 'footer' || tag === 'body') return true
    var own = el.getAttribute ? el.getAttribute('data-pw-region') : ''
    if (own === 'header' || own === 'topbar' || own === 'footer' || own === 'nav') return true
    var cls = clsOf(el)
    if (cls.indexOf('pw-header') >= 0 && cls.indexOf('pw-header-') < 0) return true
    if (cls.indexOf('pw-shop-header') >= 0 && cls.indexOf('pw-shop-header-') < 0) return true
    if (cls.indexOf('pw-topbar') >= 0 || cls.indexOf('pw-shop-topbar') >= 0) return true
    if (cls.indexOf('pw-pdp-sticky') >= 0) return true
    if (cls.indexOf('pw-bottom-nav') >= 0 || cls.indexOf('pw-shop-bottom-nav') >= 0) return true
    return false
  }
  function chromeBgHostOf(el) {
    var walk = el
    while (walk && walk !== document.documentElement) {
      if (isChromeBgHost(walk) && !(walk.classList && (walk.classList.contains('pw-header-main') || walk.classList.contains('pw-shop-header-inner')))) return walk
      walk = walk.parentElement
    }
    return null
  }
  function isHeaderWidget(el) {
    if (!el || el.nodeType !== 1) return false
    if (isChromeBtn(el)) return true
    if (pwElOf(el) === 'cat-toggle') return true
    if (hasClassToken(el, 'pw-cat-btn') || hasClassToken(el, 'pw-shop-cat-btn')) return true
    if (hasClassToken(el, 'pw-account-btn') || hasClassToken(el, 'pw-brand') || hasClassToken(el, 'pw-shop-brand')) return true
    if (hasClassToken(el, 'pw-chrome-link')) return true
    if (el.closest && el.closest('.pw-topbar-inner') && el.tagName.toLowerCase() === 'a') return true
    return false
  }
  function isSearchEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwElOf(el) === 'search') return true
    var cls = clsOf(el)
    return cls.indexOf('pw-header-search') >= 0 || cls.indexOf('pw-shop-search-wrap') >= 0
  }
  function isHeaderChromeEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isSearchEl(el) || searchSubmitElOf(el) === el || searchImageElOf(el) === el) return true
    if (catToggleElOf(el) || isCatToggleEl(el)) return true
    if (isChromeBtn(el) || isAddedChrome(el) || isHeaderWidget(el)) return true
    return false
  }
  function chromeReorderUnit(el) {
    if (!el || el.nodeType !== 1) return el
    if (isSearchEl(el) || searchElOf(el) === el) return searchElOf(el) || el
    var accountWrap = el.closest ? el.closest('.pw-account-wrap, .pw-shop-account-wrap') : null
    if (accountWrap && (isChromeBtn(el) || isHeaderWidget(el) || pwElOf(el) === 'account')) return accountWrap
    return catToggleElOf(el) || chromeBtnElOf(el) || el
  }
  function headerChromeHitSelector() {
    return '[data-pw-el="search"],.pw-header-search,.pw-shop-search-wrap,[data-pw-el="account"],.pw-account-btn,[data-pw-account-toggle],[data-pw-el="cart"],[data-pw-chrome-btn],[data-pw-chrome-added],.pw-icon-btn,.pw-shop-icon-btn,[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,.pw-search-submit,.pw-shop-search-submit,[data-pw-image-search],.pw-search-image-btn'
  }
  function pointInElPad(el, x, y, pad) {
    if (!el || !isFinite(x) || !isFinite(y)) return false
    var extra = isFinite(pad) ? pad : 0
    try {
      var r = el.getBoundingClientRect()
      return x >= r.left - extra && x <= r.right + extra && y >= r.top - extra && y <= r.bottom + extra
    } catch (errPad) {
      return false
    }
  }
  function isVisibleSearchCandidate(el) {
    if (!el || el.nodeType !== 1) return false
    try {
      var st = cs(el)
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') return false
      var r = el.getBoundingClientRect()
      return r.width >= 8 && r.height >= 8
    } catch (errVisibleSearch) {
      return false
    }
  }
  function searchCandidatesIn(header, main) {
    var out = []
    var seen = []
    function addAll(root) {
      if (!root || !root.querySelectorAll) return
      var nodes = root.querySelectorAll('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
      for (var i = 0; i < nodes.length; i++) {
        if (seen.indexOf(nodes[i]) >= 0) continue
        seen.push(nodes[i])
        out.push(nodes[i])
      }
    }
    addAll(main)
    if (header && header !== main) addAll(header)
    return out
  }
  function searchAtPoint(header, main, x, y) {
    var nodes = searchCandidatesIn(header, main)
    var stamped = pwStampDevice()
    var fallback = null
    var deviceFallback = null
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i]
      if (!isVisibleSearchCandidate(node)) continue
      if (pointInElPad(node, x, y, isMobileEdit() ? 22 : 8)) return node
      if (!fallback) fallback = node
      var dev = node.getAttribute ? String(node.getAttribute('data-pw-device') || '') : ''
      if (!deviceFallback && (!dev || dev === stamped)) deviceFallback = node
    }
    return deviceFallback || fallback
  }
  function headerSearchSlotAtPoint(x, y) {
    if (!isFinite(x) || !isFinite(y)) return null
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return null
    var main = headerMainOf(header) || header
    var search = searchAtPoint(header, main, x, y)
    if (!search) return null
    if (pointInElPad(search, x, y, isMobileEdit() ? 22 : 8)) return search
    return null
  }
  function headerChromeAtPoint(x, y) {
    if (!isFinite(x) || !isFinite(y)) return null
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return null
    var searchHit = headerSearchSlotAtPoint(x, y)
    if (searchHit) return searchHit
    if (!pointInEl(header, x, y)) return null
    var nodes = header.querySelectorAll(headerChromeHitSelector())
    var best = null
    var bestArea = Infinity
    var i
    var n
    var r
    var area
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i]
      if (!pointInEl(n, x, y)) continue
      if (n.closest && n.closest('.pw-cat-panel, .pw-account-panel, .pw-shop-cat-panel, .pw-shop-account-panel')) continue
      try { r = n.getBoundingClientRect() } catch (errHit) { continue }
      area = Math.max(1, r.width * r.height)
      if (area < bestArea) {
        bestArea = area
        best = n
      }
    }
    if (!best) return null
    if (searchSubmitElOf(best)) return searchSubmitElOf(best)
    if (searchImageElOf(best)) return searchImageElOf(best)
    if (catToggleElOf(best)) return catToggleElOf(best)
    if (chromeBtnElOf(best) && !(searchElOf(best) && !best.closest('.pw-header-actions, .pw-shop-header-actions'))) {
      return chromeBtnElOf(best)
    }
    if (isSearchEl(best) || searchElOf(best)) return searchElOf(best) || best
    if (isChromeBtn(best) || isHeaderWidget(best) || isAddedChrome(best)) return chromeBtnElOf(best) || best
    return best
  }
  function searchElOf(el) {
    if (!el) return null
    if (isSearchEl(el)) return el
    return el.closest ? el.closest('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]') : null
  }
  function searchMoveEl(el) {
    return searchElOf(el) || el
  }
  function isSearchSubmitEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (hasClassToken(el, 'pw-search-submit') || hasClassToken(el, 'pw-shop-search-submit')) return true
    return !!(el.getAttribute && el.getAttribute('type') === 'submit' && searchElOf(el))
  }
  function searchSubmitElOf(el) {
    if (!el || !el.closest) return null
    var host = searchElOf(el)
    if (!host) return null
    if (isSearchSubmitEl(el)) return el
    var btn = el.closest('.pw-search-submit, .pw-shop-search-submit, button[type="submit"]')
    if (btn && host.contains(btn) && btn !== host) return btn
    return null
  }
  function isSearchImageEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-image-search') != null) return true
    return hasClassToken(el, 'pw-search-image-btn')
  }
  function searchImageElOf(el) {
    if (!el || !el.closest) return null
    var host = searchElOf(el)
    if (!host) return null
    if (isSearchImageEl(el)) return el
    var btn = el.closest('[data-pw-image-search], .pw-search-image-btn')
    if (btn && host.contains(btn) && btn !== host) return btn
    return null
  }
  function isWordmarkTextEl(el) {
    if (!el || el.nodeType !== 1 || isImgEl(el)) return false
    if (pwElOf(el) === 'wordmark') return true
    return hasClassToken(el, 'pw-wordmark') || hasClassToken(el, 'pw-shop-footer-name')
  }
  function bottomNavItemOf(el) {
    if (!el || !el.closest) return null
    var nav = el.closest('.pw-bottom-nav, .pw-shop-bottom-nav')
    if (!nav || el === nav) return null
    var node = el
    while (node && node !== nav) {
      var tag = node.tagName ? node.tagName.toLowerCase() : ''
      var chrome = node.getAttribute && (node.getAttribute('data-pw-chrome-btn') || node.getAttribute('data-pw-chrome-added'))
      if (node.parentNode === nav && (tag === 'a' || tag === 'button' || chrome || hasClassToken(node, 'pw-icon-btn') || hasClassToken(node, 'pw-shop-icon-btn'))) {
        return node
      }
      node = node.parentElement
    }
    return null
  }
  function dotsElOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (pwElOf(el) === 'dots') return el
    return el.closest ? el.closest('[data-pw-el="dots"], .pw-hero-dots, .pw-shop-lightbox-dots') : null
  }
  function fieldElOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (searchElOf(el) && !isSearchSubmitEl(el) && !isSearchImageEl(el)) {
      var t0 = el.tagName.toLowerCase()
      if (t0 === 'input' || t0 === 'textarea' || t0 === 'select') return null
    }
    if (pwElOf(el) === 'field') return el
    var tag = el.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return el
    return el.closest ? el.closest('[data-pw-el="field"]') : null
  }
  function badgeElOf(el) {
    if (!el || el.nodeType !== 1) return null
    if (pwElOf(el) === 'badge') return el
    return el.closest ? el.closest('[data-pw-el="badge"]') : null
  }
  function releasePinnedChrome(el) {
    if (!el || !el.style) return
    el.style.removeProperty('transform')
    el.style.removeProperty('left')
    el.style.removeProperty('top')
    el.style.removeProperty('right')
    el.style.removeProperty('bottom')
  }
  function pinSearchSlot(el) {
    if (!el || !el.style) return
    if (isUserMoved(el) || (el.getAttribute && el.getAttribute('data-nanoai-ve-selected'))) return
    el.style.setProperty('transform', 'none', 'important')
    el.style.setProperty('left', 'auto', 'important')
    el.style.setProperty('top', 'auto', 'important')
    el.style.setProperty('right', 'auto', 'important')
    el.style.setProperty('bottom', 'auto', 'important')
    el.style.setProperty('position', 'relative', 'important')
    el.style.setProperty('margin', '0', 'important')
    el.style.setProperty('opacity', '1', 'important')
    el.style.setProperty('visibility', 'visible', 'important')
  }
  function compactSearchMinWidth() {
    return editDevice === 'tablet' ? 120 : 96
  }
  function defaultSearchBoxWidth() {
    if (isMobileEdit()) return compactSearchMinWidth() + 38
    return 280
  }
  function searchPlaceholderText() {
    var existing = document.querySelector('.pw-header-search input, .pw-shop-search-wrap input, input[data-pw-search]')
    var ph = existing && (existing.getAttribute('placeholder') || existing.placeholder)
    if (ph) return String(ph)
    return 'Tìm sản phẩm...'
  }
  function searchSubmitIconSvg() {
    return '<svg class="pw-shop-nav-icon pw-shop-search-submit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>'
  }
  function ensureSearchSubmitIcon(scope) {
    var root = scope && scope.querySelectorAll ? scope : document
    var buttons = root.querySelectorAll('.pw-search-submit, .pw-shop-search-submit')
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i]
      if (btn.querySelector && btn.querySelector('.pw-shop-search-submit-icon')) continue
      var hold = document.createElement('span')
      hold.innerHTML = searchSubmitIconSvg()
      var icon = hold.firstChild
      if (icon) btn.insertBefore(icon, btn.firstChild)
    }
  }
  function createSearchCluster() {
    var wrap = document.createElement('div')
    wrap.className = 'pw-header-search pw-shop-search-wrap'
    wrap.setAttribute('data-pw-el', 'search')
    var ph = searchPlaceholderText().replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
    wrap.innerHTML = '<form class="pw-search-form pw-shop-search-form" data-pw-search-form role="search">' +
      '<input data-pw-search type="search" name="q" placeholder="' + ph + '" aria-label="' + ph + '" autocomplete="off"/>' +
      '<button type="button" class="pw-search-image-btn pw-shop-search-image" data-pw-image-search aria-label="Search image"></button>' +
      '<button type="submit" class="pw-search-submit pw-shop-search-submit" aria-label="Search">' + searchSubmitIconSvg() + '</button></form>'
    return wrap
  }
  function seatSearchInHeader(search, main) {
    if (!search || !main) return
    var actions = main.querySelector('.pw-header-actions, .pw-shop-header-actions')
    if (actions && actions.parentNode === main) {
      if (search.parentNode !== main || search.nextElementSibling !== actions) main.insertBefore(search, actions)
      return
    }
    if (search.parentNode !== main) main.appendChild(search)
  }
  function ensureSearchVisible() {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return
    var main = headerMainOf(header)
    if (!main) return
    var search = main.querySelector('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    if (!search) search = header.querySelector('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    if (!search) search = document.querySelector('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    if (!search) search = createSearchCluster()
    if (search.getAttribute && search.getAttribute('data-pw-hidden') === '1') search.removeAttribute('data-pw-hidden')
    if (search.setAttribute) search.setAttribute('data-pw-device', pwStampDevice())
    seatSearchInHeader(search, main)
    if (search.style) search.style.setProperty('display', 'flex', 'important')
    if (!isMobileEdit()) return
    if (isUserMoved(search) || (search.getAttribute && search.getAttribute('data-nanoai-ve-selected'))) return
    if (search.style) {
      search.style.removeProperty('transform')
      search.style.removeProperty('left')
      search.style.removeProperty('top')
      search.style.removeProperty('right')
      search.style.removeProperty('bottom')
      search.style.removeProperty('display')
      search.style.removeProperty('visibility')
      search.style.removeProperty('opacity')
      search.style.removeProperty('width')
      search.style.removeProperty('height')
      search.style.removeProperty('max-width')
    }
    pinSearchSlot(search)
    lockSearchBox(search, compactSearchMinWidth() + 38)
    ensureSearchSubmitIcon(search)
  }
  function lockSearchBox(el, widthPx) {
    if (!el) return
    var minW = isMobileEdit() ? compactSearchMinWidth() : 72
    var w = Math.max(minW, Math.min(360, Math.round(Number(widthPx) || defaultSearchBoxWidth())))
    var mobile = isMobileEdit()
    var pinnedMobile = mobile && !isUserMoved(el) && !(el.getAttribute && el.getAttribute('data-nanoai-ve-selected'))
    pinSearchSlot(el)
    el.style.setProperty('min-width', minW + 'px', 'important')
    el.setAttribute('data-pw-search-width', String(w))
    if (pinnedMobile) {
      el.style.setProperty('flex', '1 1 0%', 'important')
      el.style.setProperty('width', 'auto', 'important')
      el.style.setProperty('max-width', '100%', 'important')
    } else {
      el.style.setProperty('flex', '0 0 auto', 'important')
      el.style.setProperty('width', w + 'px', 'important')
      el.style.setProperty('max-width', 'none', 'important')
    }
  }
  ${PARTNER_SHOP_CHROME_FLOAT_POS_JS}
  function isChromeFloatKind(kind) {
    var kinds = ${JSON.stringify(PW_CHROME_FLOAT_KINDS)}
    return kinds.indexOf(String(kind || '')) >= 0
  }
  function isChromeFloatEl(el) {
    if (!el || !el.getAttribute) return false
    if (el.getAttribute('data-pw-chrome-float') === '1') return true
    return isChromeFloatKind(chromeKindOf(el))
  }
  function isChromeContactChatKind(kind) {
    return kind === 'chat' || kind === 'chat-zalo' || kind === 'chat-facebook'
  }
  function stampChromeFloat(el) {
    if (!el || !el.setAttribute || !isChromeFloatEl(el)) return
    el.setAttribute('data-pw-chrome-float', '1')
    if (el.style) el.style.setProperty('z-index', '${PW_CHROME_FLOAT_Z_INDEX}', 'important')
    // Đưa ra body — tránh bị header/main isolation che mất float.
    try {
      if (el.parentNode && el.parentNode !== document.body) document.body.appendChild(el)
    } catch (errHostFloat) {}
    if (!isUserMoved(el)) {
      try { pwChromeFloatSeatDefault(el) } catch (errSeatStamp) {}
    }
  }
  function releaseChromeFloatPin(el) {
    if (!el || !el.style || !isChromeFloatEl(el)) return
    stampChromeFloat(el)
    if (el.getAttribute && el.getAttribute('data-pw-user-move') === '1') return
    try {
      el.style.removeProperty('width')
      el.style.removeProperty('height')
      el.style.removeProperty('max-width')
      el.style.removeProperty('max-height')
    } catch (errRelFloat) {}
    try { pwChromeFloatSeatDefault(el) } catch (errSeatRel) {}
  }
  function pinExistingChromeFloat(el) {
    if (!el || !isChromeFloatEl(el)) return
    stampChromeFloat(el)
    var placed = el.getAttribute && el.getAttribute('data-pw-user-move') === '1'
    if (!placed) {
      releaseChromeFloatPin(el)
      return
    }
    pwChromeFloatRemap(el)
  }
  function chromeFloatOffViewport(el) {
    var r
    try { r = el.getBoundingClientRect() } catch (errOff) { return true }
    if (!r || r.width < 4 || r.height < 4) return true
    var viewW = window.innerWidth || 390
    var viewH = window.innerHeight || 640
    return r.right < 8 || r.left > viewW - 8 || r.bottom < 8 || r.top > viewH - 8
  }
  function revealChromeFloat(el) {
    if (!el || !isChromeFloatEl(el)) return
    try { el.removeAttribute('data-pw-hidden') } catch (errHid) {}
    stampChromeFloat(el)
    var kind = chromeKindOf(el)
    if (kind === 'topup' && el.classList) el.classList.add('pw-chrome-topup-on')
    var stuckOrigin = false
    try {
      var box = el.getBoundingClientRect()
      stuckOrigin = !!(box && box.top < 8 && box.left < 8 && box.bottom < 80)
    } catch (errBox) {}
    if (chromeFloatOffViewport(el) || stuckOrigin) {
      if (el.removeAttribute) el.removeAttribute('data-pw-user-move')
      releaseChromeFloatPin(el)
    }
  }
  function stampAllChromeFloats() {
    var kinds = ${JSON.stringify(PW_CHROME_FLOAT_KINDS)}
    for (var i = 0; i < kinds.length; i++) {
      var nodes = document.querySelectorAll('[data-pw-chrome-btn="' + kinds[i] + '"]')
      for (var j = 0; j < nodes.length; j++) pinExistingChromeFloat(nodes[j])
    }
  }
  function bakeChromeFloatPos(el) {
    if (!el || !el.style) return
    if (isChromeFloatEl(el)) {
      stampChromeFloat(el)
      markUserMoved(el)
      pwChromeFloatBakePct(el)
      return
    }
    if (el.getAttribute && el.getAttribute('data-pw-pin-screen') === '1') {
      markUserMoved(el)
      try {
        if (!isFullBleedChrome(el) && !isShopRegionHost(el) && el.parentNode && el.parentNode !== document.body) {
          document.body.appendChild(el)
        }
      } catch (errPinBake) {}
      pwChromeFloatBakePct(el)
    }
  }
  function isPinScreenOn(el) {
    if (!el || !el.getAttribute) return false
    if (el.getAttribute('data-pw-pin-screen') === '1') return true
    return isChromeFloatEl(el)
  }
  function canPinScreenEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false
    if (chatEmbedLauncherOf(el)) return false
    if (isOverlayNode(el)) return false
    if (isLockedCatalogEl(el) && !productActionChromeOf(el)) return false
    if (isProductCardEl(el) && !productActionChromeOf(el)) return false
    return canDragEl(el) || isAddedBg(el) || isAddedText(el) || isAddedBtn(el) || isAddedChrome(el) || isChromeBtn(el) || isHeaderWidget(el) || isSearchEl(el) || isLogoTarget(el)
  }
  function setPinScreen(on) {
    if (!selected || !canPinScreenEl(selected)) return
    var el = chromeBtnElOf(selected) || selected
    if (on) {
      if (el.getAttribute && el.getAttribute('data-pw-stick-header') === '1') {
        stickHeaderPause(1)
        stickHeaderUnpinEl(el)
        el.removeAttribute('data-pw-stick-header')
        if (el.classList) el.classList.remove('pw-stick-header-on')
        stickHeaderPause(0)
      }
      var keepHost = isFullBleedChrome(el) || isShopRegionHost(el)
      try {
        if (!keepHost && el.parentNode && el.parentNode !== document.body) document.body.appendChild(el)
      } catch (errPinOn) {}
      if (isChromeFloatKind(chromeKindOf(el))) {
        stampChromeFloat(el)
      } else {
        el.setAttribute('data-pw-pin-screen', '1')
      }
      markUserMoved(el)
      pwChromeFloatBakePct(el)
    } else {
      var r
      try { r = el.getBoundingClientRect() } catch (errPinOff) { r = null }
      if (isChromeFloatKind(chromeKindOf(el))) {
        try { el.removeAttribute('data-pw-chrome-float') } catch (errFloatOff) {}
      }
      try { el.removeAttribute('data-pw-pin-screen') } catch (errPinRm) {}
      var host = addedBgContentHost() || document.querySelector('main, .pw-shop-main, .pw-main') || document.body
      if (isFullBleedChrome(el) || isShopRegionHost(el)) host = el.parentElement || host
      else if (host && el.parentNode !== host) {
        try { host.appendChild(el) } catch (errHostPin) {}
      }
      if (r && el.style) {
        var hr = { left: 0, top: 0 }
        try { if (host && host.getBoundingClientRect) hr = host.getBoundingClientRect() } catch (errHr) {}
        el.style.setProperty('position', 'absolute', 'important')
        el.style.setProperty('left', Math.round(r.left - hr.left) + 'px', 'important')
        el.style.setProperty('top', Math.round(r.top - hr.top) + 'px', 'important')
        el.style.setProperty('right', 'auto', 'important')
        el.style.setProperty('bottom', 'auto', 'important')
        el.style.setProperty('transform', 'none', 'important')
      }
      markUserMoved(el)
    }
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function pinChromeFlowEl(el) {
    if (!el || !el.style) return
    if (el.classList && el.classList.contains('pw-stick-header-on')) return
    if (isChromeFloatEl(el)) return
    if (el.getAttribute && el.getAttribute('data-pw-pin-screen') === '1') return
    if (isUserMoved(el) || (el.getAttribute && el.getAttribute('data-nanoai-ve-selected'))) return
    if (el.closest && el.closest('.pw-cat-panel, .pw-account-panel, .pw-shop-cat-panel, .pw-shop-account-panel')) return
    el.style.setProperty('transform', 'none', 'important')
    el.style.setProperty('left', 'auto', 'important')
    el.style.setProperty('top', 'auto', 'important')
    el.style.setProperty('right', 'auto', 'important')
    el.style.setProperty('bottom', 'auto', 'important')
    el.style.setProperty('position', 'relative', 'important')
  }
  function pinHeaderChromeIcons() {
    var nodes = document.querySelectorAll(
      'header .pw-icon-btn, header .pw-shop-icon-btn, .pw-header .pw-icon-btn, .pw-shop-header .pw-icon-btn, ' +
        '.pw-header-actions [data-pw-chrome-btn], .pw-shop-header-actions [data-pw-chrome-btn], ' +
        '.pw-header-actions [data-pw-chrome-added], .pw-shop-header-actions [data-pw-chrome-added], ' +
        '.pw-cat-btn, .pw-shop-cat-btn, .pw-account-btn, ' +
        '.pw-bottom-nav > a, .pw-shop-bottom-nav > a, .pw-bottom-nav > button, .pw-shop-bottom-nav > button'
    )
    var i
    for (i = 0; i < nodes.length; i++) pinChromeFlowEl(nodes[i])
  }
  function chromeFlexHostOf(el) {
    if (!el || !el.closest) return null
    return el.closest(
      '.pw-header-actions, .pw-shop-header-actions, .pw-bottom-nav, .pw-shop-bottom-nav, .pw-topbar-inner, .pw-shop-topbar-inner, .pw-nav-main, .pw-shop-nav-row, .pw-brand-cluster, .pw-shop-brand-cluster, .pw-header-main, .pw-shop-header-inner'
    )
  }
  function applyTranslatePx(el, x, y) {
    if (!el || !el.style) return
    el.style.setProperty('transform', 'translate(' + x + 'px,' + y + 'px)', 'important')
  }
  function clampTranslateToViewport(el, x, y) {
    if (!el || !el.style) return
    applyTranslatePx(el, x, y)
    var b = el.getBoundingClientRect()
    var viewW = window.innerWidth || document.documentElement.clientWidth || 390
    var viewH = window.innerHeight || document.documentElement.clientHeight || 640
    var pad = 24
    var nx = x
    var ny = y
    if (b.right < pad) nx += pad - b.right
    if (b.left > viewW - pad) nx -= b.left - (viewW - pad)
    if (b.bottom < pad) ny += pad - b.bottom
    if (b.top > viewH - pad) ny -= b.top - (viewH - pad)
    if (nx !== x || ny !== y) applyTranslatePx(el, nx, ny)
  }
  function lockExistingSearchBoxes() {
    var nodes = document.querySelectorAll('.pw-header-search, .pw-shop-search-wrap, [data-pw-el="search"]')
    var i
    for (i = 0; i < nodes.length; i++) {
      var box = nodes[i]
      if (isUserMoved(box) || (box.getAttribute && box.getAttribute('data-nanoai-ve-selected'))) continue
      if (isMobileEdit()) {
        lockSearchBox(box, compactSearchMinWidth() + 38)
        continue
      }
      var saved = parseFloat(box.getAttribute('data-pw-search-width') || '')
      if (saved > 0) {
        lockSearchBox(box, saved)
        continue
      }
      if (!isMobileEdit()) {
        lockSearchBox(box, defaultSearchBoxWidth())
        continue
      }
      var r = box.getBoundingClientRect()
      lockSearchBox(box, r.width || defaultSearchBoxWidth())
    }
  }
  function isIconOnlyChrome(el) {
    if (!isChromeBtn(el)) return false
    var style = currentChromeStyle(el)
    return style === 'icon' || style === 'icon-square'
  }
  function chromeLabelEl(el) {
    if (!el || !el.querySelector) return null
    var host = chromeBtnElOf(el) || searchSubmitElOf(el) || el
    return host.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label, .pw-shop-search-submit-label')
  }
  function canEditChromeLabel(el) {
    if (!el || isIconOnlyChrome(el) || isSearchEl(el)) return false
    if (isSearchSubmitEl(el) || searchSubmitElOf(el) === el) return true
    if (isChromeBtn(el) || isHeaderWidget(el)) return Boolean(chromeLabelEl(el) || String(el.textContent || '').replace(/[0-9]+/g, '').trim())
    return false
  }
  function searchInputOf(el) {
    var host = isSearchEl(el) ? el : searchElOf(el)
    if (!host || !host.querySelector) return null
    return host.querySelector('[data-pw-search], input[type="search"], input[name="q"]')
  }
  function canEditText(el) {
    if (!el || isImgEl(el) || isIconOnlyChrome(el) || isContentBlockEl(el) || isLockedCatalogEl(el)) return false
    if (isAddedBg(el)) return false
    if (isSearchEl(el) && !isSearchSubmitEl(el) && searchSubmitElOf(el) !== el) return false
    if (canEditChromeLabel(el)) return true
    if (isAddedText(el) || isTextEl(el)) return true
    if (isHeaderWidget(el) && el.tagName.toLowerCase() === 'a') {
      return String(el.textContent || '').replace(/[0-9]+/g, '').trim().length > 0
    }
    return false
  }
  function isEditableTextTarget(el) {
    if (!el) return false
    if (isAddedText(el)) return true
    if (canEditChromeLabel(el)) return true
    if (isBtnEl(el) || isChromeBtn(el) || isHeaderWidget(el) || isAddedBtn(el)) return false
    return canEditText(el)
  }
  function applyChromeTypeStyle(el, prop, value) {
    var host = chromeBtnElOf(el) || searchSubmitElOf(el) || (isSearchEl(el) ? el : searchElOf(el)) || el
    var lab = chromeLabelEl(host)
    if (host && host.style) host.style.setProperty(prop, value, 'important')
    if (lab && lab.style) lab.style.setProperty(prop, value, 'important')
    if (isSearchSubmitEl(host) && !lab && host.style) host.style.setProperty(prop, value, 'important')
  }
  function markUserMoved(el) {
    if (!el || !el.setAttribute) return
    el.setAttribute('data-pw-user-move', '1')
  }
  function isUserMoved(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-user-move'))
  }
  function deletedChromeFeatureKey(el) {
    if (!el || !el.getAttribute) return ''
    var kind = chromeKindOf(el)
    if (kind) return 'btn:' + kind
    if (catToggleElOf(el)) return 'categories'
    if (searchImageElOf(el)) return 'search-image'
    if (searchSubmitElOf(el)) return 'search-submit'
    if (isSearchEl(el) || searchElOf(el)) return 'search'
    var href = String(el.getAttribute('href') || '').trim()
    return href && isAddedChrome(el) ? 'href:' + href : ''
  }
  function rememberDeletedChromeFeature(el) {
    var key = deletedChromeFeatureKey(el)
    if (!key || !document.body) return
    var markers = document.querySelectorAll('[data-pw-deleted-chrome-feature]')
    for (var i = 0; i < markers.length; i++) {
      if (markers[i].getAttribute('data-pw-deleted-chrome-feature') === key) return
    }
    var marker = document.createElement('span')
    marker.setAttribute('data-pw-deleted-chrome-feature', key)
    marker.setAttribute('data-pw-device', pwStampDevice())
    marker.setAttribute('hidden', '')
    marker.style.display = 'none'
    document.body.appendChild(marker)
  }
  function isChromeNav(el) {
    if (isChromeBtn(el)) return false
    return !!(el && el.closest && el.closest('.pw-bottom-nav,.pw-header-search,.pw-account-panel,.pw-cat-panel,.pw-nav-main,.pw-topbar'))
  }
  function isBtnEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isAddedText(el)) return false
    if (catToggleElOf(el) || isCatToggleEl(el)) return false
    if (isAddedBg(el)) return false
    if (isChromeBtn(el)) return true
    if (isChromeNav(el)) return false
    var tag = el.tagName.toLowerCase()
    var cls = clsOf(el)
    var role = pwElOf(el)
    if (role === 'cta' || role === 'cta-secondary' || role === 'card-cart' || role === 'card-buy' || role === 'buy' || role === 'submit' || role === 'checkout') {
      return !isLockedCatalogEl(el)
    }
    if (cls.indexOf('pw-brand') >= 0) return false
    if (cls.indexOf('pw-search') >= 0 || cls.indexOf('pw-cat-btn') >= 0 || cls.indexOf('pw-account-btn') >= 0) return false
    if (tag === 'button') return !isLockedCatalogEl(el)
    if (tag === 'a') {
      if (isLockedCatalogEl(el)) return false
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
  function isOverlayNode(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-overlay') === '1')
  }
  function ownPwRegion(el) {
    return el && el.getAttribute ? String(el.getAttribute('data-pw-region') || '') : ''
  }
  function isChromeBlock(el) {
    if (!el) return true
    var region = pwRegionOf(el)
    if (region === 'header' || region === 'nav' || region === 'topbar' || region === 'footer') return true
    return isChromeNav(el)
  }
  function isBlockEl(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) return false
    if (isOverlayNode(el)) return false
    if (ownPwRegion(el)) return true
    var tag = el.tagName.toLowerCase()
    return tag === 'section' || tag === 'article' || tag === 'footer' || tag === 'header'
  }
  function isHeroInnerOrCopy(el) {
    if (!el || el.nodeType !== 1) return false
    var role = pwElOf(el)
    return role === 'copy' || role === 'inner'
  }
  function isHeroBannerEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (ownPwRegion(el) === 'banner') return true
    var role = pwElOf(el)
    if (role === 'copy' || role === 'inner' || role === 'media' || role === 'cta' || role === 'cta-secondary' || role === 'title' || role === 'subtitle' || role === 'badge' || role === 'dots') {
      return pwRegionOf(el) === 'banner'
    }
    return false
  }
  function isHeroBannerContext(el) {
    return pwRegionOf(el) === 'banner'
  }
  function isNonBannerShopRegion(region) {
    return !!region && region !== 'banner'
  }
  function containsForeignShopRegion(el) {
    if (!el || !el.querySelector) return false
    var nodes = el.querySelectorAll('[data-pw-region]')
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getAttribute('data-pw-region')
      if (r && r !== 'banner') return true
    }
    return false
  }
  function looksLikeBannerHost(el) {
    if (!el || el.nodeType !== 1 || isChromeBlock(el)) return false
    if (isHeroInnerOrCopy(el) || isBgLayerEl(el) || isOverlayNode(el)) return false
    if (el.getAttribute && el.getAttribute('data-pw-move-block') === '1') return false
    if (pwElOf(el) === 'copy' || pwElOf(el) === 'inner' || pwElOf(el) === 'card') return false
    return ownPwRegion(el) === 'banner' && !containsForeignShopRegion(el)
  }
  function bannerHostOf(start) {
    var el = start
    while (el && el !== document.body) {
      var own = ownPwRegion(el)
      if (own && isNonBannerShopRegion(own)) return null
      if (own === 'banner' && !containsForeignShopRegion(el)) return el
      el = el.parentElement
    }
    return null
  }
  function isBannerHostEl(el) {
    return ownPwRegion(el) === 'banner' && !containsForeignShopRegion(el)
  }
  function isBannerContentRole(role) {
    return role === 'copy' || role === 'title' || role === 'subtitle' || role === 'cta' || role === 'cta-secondary' || role === 'badge'
  }
  function isBannerContentEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isBannerHostEl(el) || isBgLayerEl(el) || isOverlayNode(el)) return false
    var role = pwElOf(el)
    if (role === 'media' || role === 'dots' || role === 'inner') return false
    if (!bannerHostOf(el)) return false
    if (isBannerContentRole(role) || isMoveBlockEl(el)) return true
    if (el.getAttribute && (el.getAttribute('data-pw-added-btn') === '1' || el.getAttribute('data-pw-added-text') === '1')) return true
    return isTextEl(el) || isBtnEl(el)
  }
  function isBannerLeafEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isBannerHostEl(el) || isBgLayerEl(el) || isOverlayNode(el) || isMoveBlockEl(el)) return false
    var role = pwElOf(el)
    if (role === 'copy' || role === 'inner' || role === 'media') return false
    if (role === 'title' || role === 'subtitle' || role === 'cta' || role === 'cta-secondary' || role === 'badge' || role === 'dots') return true
    if (!bannerHostOf(el)) return false
    if (el.getAttribute && (el.getAttribute('data-pw-added-btn') === '1' || el.getAttribute('data-pw-added-text') === '1')) return true
    return isTextEl(el) || isBtnEl(el)
  }
  function bannerLayerTarget(host, mode) {
    if (!host || containsForeignShopRegion(host) || isNonBannerShopRegion(host.getAttribute && host.getAttribute('data-pw-region'))) return null
    setAttrIfEmpty(host, 'data-pw-region', 'banner')
    ensureImageLayer(host)
    if (mode === 'image') return ensureImageLayer(host) || imageTargetOf(host) || host
    var copy = ensureMoveBlock(host)
    if (copy) {
      setAttrIfEmpty(copy, 'data-pw-el', 'copy')
      copy.setAttribute('data-pw-banner-copy', '1')
    }
    return copy || host
  }
  function stampPwUiContract() {
    function markAll(root, sel, name, value) {
      var nodes = (root || document).querySelectorAll(sel)
      for (var i = 0; i < nodes.length; i++) setAttrIfEmpty(nodes[i], name, value)
    }
    markAll(document, 'header.pw-header, header.pw-shop-header, .pw-shop-header', 'data-pw-region', 'header')
    markAll(document, '.pw-hero, .pw-banner, .pw-shop-hero, .pw-shop-banner, [data-pw-hero-variants]', 'data-pw-region', 'banner')
    markAll(document, '[data-pw-catalog], section.pw-catalog, .pw-new-arrivals, .pw-best-sellers, .pw-fh-band', 'data-pw-region', 'catalog')
    markAll(document, 'footer.pw-footer, footer.pw-shop-footer, .pw-shop-footer', 'data-pw-region', 'footer')
    markAll(document, 'section.pw-categories, .pw-categories', 'data-pw-region', 'categories')
    markAll(document, '.pw-nav-main, .pw-shop-nav-row, .pw-bottom-nav, .pw-shop-bottom-nav', 'data-pw-region', 'nav')
    markAll(document, '.pw-topbar, .pw-shop-topbar', 'data-pw-region', 'topbar')
    markAll(document, '.pw-shop-breadcrumb, nav[aria-label="Breadcrumb"]', 'data-pw-region', 'breadcrumb')
    markAll(document, '.pw-shop-filters', 'data-pw-region', 'filters')
    markAll(document, '.pw-shop-toolbar', 'data-pw-region', 'toolbar')
    markAll(document, '.pw-shop-product-gallery', 'data-pw-region', 'gallery')
    markAll(document, '.pw-shop-pdp-info, .pw-shop-product-detail', 'data-pw-region', 'pdp-info')
    markAll(document, '.pw-shop-reviews', 'data-pw-region', 'reviews')
    markAll(document, '.pw-shop-cart-list', 'data-pw-region', 'cart-list')
    markAll(document, '.pw-shop-cart-summary', 'data-pw-region', 'cart-summary')
    markAll(document, '.pw-shop-form', 'data-pw-region', 'form')
    markAll(document, '.pw-shop-account-sidebar', 'data-pw-region', 'account-nav')
    markAll(document, '.pw-shop-account-content, .pw-shop-account-edit', 'data-pw-region', 'account-main')
    markAll(document, 'article.pw-shop-info, .pw-shop-info', 'data-pw-region', 'content')
    markAll(document, 'section.pw-features, section.pw-testimonials, section.pw-faq-wrap, .pw-faq-wrap', 'data-pw-region', 'content')
    markAll(document, 'section.pw-lead-form, .pw-lead-form, #lead-form', 'data-pw-region', 'form')
    markAll(document, 'section.pw-chat-cta, .pw-chat-cta, section.pw-trust-bar, .pw-trust-bar', 'data-pw-region', 'promo')
    markAll(document, '[data-lp-section="hero"]', 'data-pw-region', 'banner')
    markAll(document, '[data-lp-section="highlights"], [data-lp-section="material"], [data-lp-section="faq"]', 'data-pw-region', 'content')
    markAll(document, '[data-lp-section="products_grid"]', 'data-pw-region', 'catalog')
    markAll(document, '[data-lp-section="trust_cta"]', 'data-pw-region', 'promo')
    markClosestSection('.pw-gallery, .pw-pricing-grid', 'content')
    var landingRoots = document.querySelectorAll('.pw-lp')
    for (var lr = 0; lr < landingRoots.length; lr++) setAttrIfEmpty(landingRoots[lr], 'data-pw-page', 'landing')
    function markClosestSection(sel, region) {
      var nodes = document.querySelectorAll(sel)
      for (var i = 0; i < nodes.length; i++) {
        var host = nodes[i].closest ? nodes[i].closest('section') : null
        if (host) setAttrIfEmpty(host, 'data-pw-region', region)
      }
    }
    markClosestSection('[data-pw-edit="heroImage"], [data-pw-edit="heroTitle"], [data-pw-edit="heroSubtitle"], [data-pw-edit="heroCta"]', 'banner')
    markClosestSection('[data-pw-edit="categoriesTitle"], [data-pw-edit^="categoryImage"], [data-pw-edit^="categoryName"]', 'categories')
    markClosestSection('[data-pw-edit="newArrivalsTitle"], [data-pw-edit="bestSellersTitle"]', 'catalog')
    var banners = document.querySelectorAll('[data-pw-region="banner"]')
    for (var b = 0; b < banners.length; b++) {
      var banner = banners[b]
      markAll(banner, '.pw-hero-inner, .pw-banner-inner', 'data-pw-el', 'inner')
      var copy = banner.querySelector('.pw-hero-copy, .pw-banner-copy, [data-pw-el="copy"]')
      if (copy) setAttrIfEmpty(copy, 'data-pw-el', 'copy')
      var title = banner.querySelector('h1, [data-pw-edit="heroTitle"]')
      if (title) setAttrIfEmpty(title, 'data-pw-el', 'title')
      var sub = banner.querySelector('.pw-hero-sub, [data-pw-edit="heroSubtitle"]')
      if (sub) setAttrIfEmpty(sub, 'data-pw-el', 'subtitle')
      var cta = banner.querySelector('.pw-btn-hero, [data-pw-edit="heroCta"]')
      if (cta) setAttrIfEmpty(cta, 'data-pw-el', 'cta')
      var badge = banner.querySelector('.pw-hero-badge, [data-pw-edit="heroBadge"]')
      if (badge) setAttrIfEmpty(badge, 'data-pw-el', 'badge')
      var dots = banner.querySelector('.pw-hero-dots')
      if (dots) setAttrIfEmpty(dots, 'data-pw-el', 'dots')
      var media = banner.querySelector('img[data-pw-edit="heroImage"], img[data-pw-el="media"]')
      if (media) {
        setAttrIfEmpty(media, 'data-pw-el', 'media')
        var mediaWrap = media.parentElement
        if (mediaWrap && mediaWrap !== banner && !mediaWrap.querySelector('h1, [data-pw-el="title"], [data-pw-el="copy"]')) {
          setAttrIfEmpty(mediaWrap, 'data-pw-el', 'inner')
        }
      }
      if (!copy && title && title.parentElement && title.parentElement !== banner) {
        copy = title.parentElement
        setAttrIfEmpty(copy, 'data-pw-el', 'copy')
      }
      if (copy) copy.setAttribute('data-pw-banner-copy', '1')
      var links = banner.querySelectorAll('a, button')
      for (var li = 0; li < links.length; li++) {
        var L = links[li]
        if (pwElOf(L) || isChromeBtn(L) || isLogoSlot(L)) continue
        if (L.closest && L.closest('[data-pw-el="dots"], header, footer, nav')) continue
        if (cta && L === cta) continue
        if (copy && copy.contains && !copy.contains(L)) continue
        if (!cta) {
          setAttrIfEmpty(L, 'data-pw-el', 'cta')
          cta = L
        } else {
          setAttrIfEmpty(L, 'data-pw-el', 'cta-secondary')
        }
      }
    }
    markAll(document, 'img.pw-logo, img.pw-shop-logo, [data-pw-logo-added]', 'data-pw-el', 'logo')
    markAll(document, '.pw-wordmark, a.pw-shop-brand', 'data-pw-el', 'wordmark')
    markAll(document, '.pw-header-search, .pw-shop-search-wrap', 'data-pw-el', 'search')
    markAll(document, '.pw-cat-btn, .pw-shop-cat-btn', 'data-pw-el', 'cat-toggle')
    markAll(document, '.pw-account-btn, [data-pw-account-toggle]', 'data-pw-el', 'account')
    markAll(document, '[data-pw-chrome-btn="cart"]', 'data-pw-el', 'cart')
    function inferLegacyChromeKind(el) {
      if (!el || !el.getAttribute) return ''
      var existing = String(el.getAttribute('data-pw-chrome-btn') || '').trim().toLowerCase()
      if (existing) return existing
      if (catToggleElOf(el) || searchElOf(el) || isLogoSlot(el)) return ''
      var cls = clsOf(el).toLowerCase()
      var href = String(el.getAttribute('href') || '').toLowerCase()
      var label = String((el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.textContent || '')).replace(/\s+/g, ' ').trim().toLowerCase()
      if (cls.indexOf('account') >= 0 || href.indexOf('/account') >= 0 || label.indexOf('tài khoản') >= 0 || label.indexOf('tai khoan') >= 0 || label.indexOf('account') >= 0) return 'account'
      if (cls.indexOf('cart') >= 0 || href.indexOf('/cart') >= 0 || label.indexOf('giỏ') >= 0 || label.indexOf('gio hang') >= 0 || label.indexOf('cart') >= 0) return 'cart'
      if (cls.indexOf('notification') >= 0 || href.indexOf('/notifications') >= 0 || label.indexOf('thông báo') >= 0 || label.indexOf('thong bao') >= 0 || label.indexOf('notification') >= 0) return 'notifications'
      if (href.indexOf('/orders') >= 0 || label.indexOf('đơn hàng') >= 0 || label.indexOf('don hang') >= 0 || label.indexOf('orders') >= 0) return 'orders'
      if (href.indexOf('/wishlist') >= 0 || href.indexOf('/favorites') >= 0 || label.indexOf('yêu thích') >= 0 || label.indexOf('yeu thich') >= 0 || label.indexOf('wishlist') >= 0 || label.indexOf('favorite') >= 0) return 'wishlist'
      if (href.indexOf('/login') >= 0 || label.indexOf('đăng nhập') >= 0 || label.indexOf('dang nhap') >= 0 || label.indexOf('login') >= 0) return 'login'
      return ''
    }
    function normalizeLegacyChromeButtons() {
      var nodes = document.querySelectorAll('header a, header button, .pw-header a, .pw-header button, .pw-shop-header a, .pw-shop-header button, .pw-topbar a, .pw-shop-topbar a, .pw-bottom-nav a, .pw-bottom-nav button, .pw-shop-bottom-nav a, .pw-shop-bottom-nav button, .pw-icon-btn, .pw-shop-icon-btn, [data-pw-el="account"], [data-pw-el="cart"]')
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i]
        var kind = inferLegacyChromeKind(node)
        if (!kind) continue
        setAttrIfEmpty(node, 'data-pw-chrome-btn', kind)
        setAttrIfEmpty(node, 'data-pw-chrome-style', String(node.textContent || '').replace(/[0-9]+/g, '').trim() ? 'icon-label' : 'icon')
        if (kind === 'account') setAttrIfEmpty(node, 'data-pw-el', 'account')
        if (kind === 'cart') setAttrIfEmpty(node, 'data-pw-el', 'cart')
        if (kind === 'cart' || kind === 'wishlist' || kind === 'notifications') setAttrIfEmpty(node, 'data-pw-chrome-count', '1')
      }
    }
    normalizeLegacyChromeButtons()
    markAll(document, '.pw-bottom-nav > a, .pw-shop-bottom-nav > a', 'data-pw-el', 'nav-link')
    markAll(document, '.pw-search-submit, .pw-shop-search-submit', 'data-pw-el', 'submit')
    markAll(document, '.pw-topbar a, .pw-shop-topbar a', 'data-pw-el', 'link')
    markAll(document, '.pw-nav-main a, .pw-shop-nav-row a', 'data-pw-el', 'nav-link')
    markAll(document, '.pw-footer-col, .pw-shop-footer-col', 'data-pw-el', 'col')
    var footerHosts = document.querySelectorAll('[data-pw-region="footer"], footer.pw-footer, footer.pw-shop-footer, .pw-shop-footer')
    for (var ft = 0; ft < footerHosts.length; ft++) {
      var footLinks = footerHosts[ft].querySelectorAll('a')
      for (var fl = 0; fl < footLinks.length; fl++) {
        var fa = footLinks[fl]
        if (isBrandLink(fa) || isLogoSlot(fa) || isLogoImg(fa)) continue
        if (fa.querySelector && fa.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]')) continue
        if (pwElOf(fa) === 'logo' || pwElOf(fa) === 'wordmark' || pwElOf(fa) === 'nav-link') continue
        setAttrIfEmpty(fa, 'data-pw-el', 'link')
      }
    }
    var navLinks = document.querySelectorAll('.pw-nav-main a, .pw-shop-nav-row a, .pw-cat-panel a, .pw-shop-cat-panel a')
    for (var nl = 0; nl < navLinks.length; nl++) {
      var navEl = navLinks[nl]
      var navHref = String(navEl.getAttribute('href') || '').toLowerCase()
      var navCls = clsOf(navEl)
      var navText = String(navEl.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
      var saleHref = navHref.indexOf('/sale') >= 0 || navHref.indexOf('/khuyen-mai') >= 0 || navHref === 'sale'
      var saleText = navText === 'khuyến mãi' || navText === 'khuyen mai' || navText === 'sale' || navText === '促销' || navText === 'セール' || navText === '세일'
      if (navCls.indexOf('pw-nav-sale') >= 0 || navCls.indexOf('is-sale') >= 0 || saleHref || saleText) {
        navEl.classList.add('pw-nav-sale')
        navEl.classList.add('is-sale')
      }
    }
    markAll(document, '.pw-shop-breadcrumb a', 'data-pw-el', 'crumb')
    markAll(document, '[data-pw-grid], .pw-product-grid, .pw-shop-grid', 'data-pw-el', 'grid')
    markAll(document, '.pw-product-card, .pw-shop-card', 'data-pw-el', 'card')
    markAll(document, '.pw-product-card-media, .pw-shop-card-media', 'data-pw-el', 'card-media')
    var catalogs = document.querySelectorAll('[data-pw-region="catalog"]')
    for (var c = 0; c < catalogs.length; c++) {
      var cat = catalogs[c]
      var h2 = cat.querySelector('h1, h2, .pw-section-title')
      if (h2) setAttrIfEmpty(h2, 'data-pw-el', 'section-title')
      markAll(cat, 'article, .pw-product-card, .pw-shop-card', 'data-pw-el', 'card')
      markAll(cat, '.pw-price, .pw-shop-price', 'data-pw-el', 'card-price')
      markAll(cat, '.pw-btn-cart, [data-pw-add-cart]', 'data-pw-el', 'card-cart')
      markAll(cat, '.pw-shop-card .pw-shop-btn:not(.pw-btn-cart)', 'data-pw-el', 'card-buy')
    }
    var galleries = document.querySelectorAll('[data-pw-region="gallery"]')
    for (var g = 0; g < galleries.length; g++) {
      markAll(galleries[g], '.pw-shop-product-img, img.pw-shop-product-img', 'data-pw-el', 'main-image')
      markAll(galleries[g], '.pw-shop-product-thumb', 'data-pw-el', 'thumb')
    }
    var infos = document.querySelectorAll('[data-pw-region="pdp-info"]')
    for (var pi = 0; pi < infos.length; pi++) {
      var info = infos[pi]
      var pdpTitle = info.querySelector('h1')
      if (pdpTitle) setAttrIfEmpty(pdpTitle, 'data-pw-el', 'title')
      markAll(info, '.pw-shop-price', 'data-pw-el', 'price')
      markAll(info, '.pw-shop-btn-cart', 'data-pw-el', 'card-cart')
      markAll(info, '.pw-shop-btn-buy', 'data-pw-el', 'buy')
      markAll(info, '.pw-shop-product-detail-body', 'data-pw-el', 'desc')
    }
    var reviewBlocks = document.querySelectorAll('[data-pw-region="reviews"]')
    for (var rv = 0; rv < reviewBlocks.length; rv++) {
      var rev = reviewBlocks[rv]
      var revTitle = rev.querySelector('h2')
      if (revTitle) setAttrIfEmpty(revTitle, 'data-pw-el', 'section-title')
      markAll(rev, 'article', 'data-pw-el', 'card')
    }
    var cartLists = document.querySelectorAll('[data-pw-region="cart-list"]')
    for (var cl = 0; cl < cartLists.length; cl++) {
      var list = cartLists[cl]
      var cartTitle = list.querySelector('h1')
      if (cartTitle) setAttrIfEmpty(cartTitle, 'data-pw-el', 'section-title')
      markAll(list, '.pw-shop-cart-row', 'data-pw-el', 'line')
      markAll(list, '.pw-shop-cart-row img', 'data-pw-el', 'card-media')
      markAll(list, '.pw-shop-cart-row strong', 'data-pw-el', 'card-name')
      markAll(list, '.pw-shop-price', 'data-pw-el', 'card-price')
    }
    var cartSums = document.querySelectorAll('[data-pw-region="cart-summary"]')
    for (var cs = 0; cs < cartSums.length; cs++) {
      markAll(cartSums[cs], '.pw-shop-btn-buy', 'data-pw-el', 'checkout')
    }
    var accountNavs = document.querySelectorAll('[data-pw-region="account-nav"]')
    for (var an = 0; an < accountNavs.length; an++) {
      var navTitle = accountNavs[an].querySelector('h2')
      if (navTitle) setAttrIfEmpty(navTitle, 'data-pw-el', 'title')
      markAll(accountNavs[an], '.pw-shop-account-link-card', 'data-pw-el', 'menu-item')
    }
    var accountMains = document.querySelectorAll('[data-pw-region="account-main"]')
    for (var am = 0; am < accountMains.length; am++) {
      var mainTitle = accountMains[am].querySelector('h1, h2')
      if (mainTitle) setAttrIfEmpty(mainTitle, 'data-pw-el', 'heading')
    }
    var contents = document.querySelectorAll('[data-pw-region="content"]')
    for (var co = 0; co < contents.length; co++) {
      var content = contents[co]
      var contentH1 = content.querySelector('h1')
      if (contentH1) setAttrIfEmpty(contentH1, 'data-pw-el', 'heading')
      var contentH2 = content.querySelector('h2')
      if (contentH2) setAttrIfEmpty(contentH2, 'data-pw-el', 'title')
      markAll(content, 'details, details.pw-faq', 'data-pw-el', 'faq-item')
      markAll(content, '.pw-gallery img, .pw-gallery-item img', 'data-pw-el', 'image')
    }
    var forms = document.querySelectorAll('[data-pw-region="form"]')
    for (var fo = 0; fo < forms.length; fo++) {
      var form = forms[fo]
      var formTitle = form.querySelector('h1, h2')
      if (formTitle) setAttrIfEmpty(formTitle, 'data-pw-el', 'title')
      markAll(form, 'label', 'data-pw-el', 'label')
      markAll(form, 'input, textarea, select', 'data-pw-el', 'field')
      markAll(form, 'button[type="submit"]', 'data-pw-el', 'submit')
    }
    markAll(document, '.pw-chat-cta .pw-btn, .pw-chat-cta button', 'data-pw-el', 'cta')
    markAll(document, '.pw-fab-chat,[data-nanoai-chat-bubble="1"]', 'data-pw-region', 'chat')
    markAll(document, '.pw-fab-chat,[data-nanoai-chat-bubble="1"]', 'data-pw-el', 'launcher')
    markAll(document, '.pw-fab-chat,[data-nanoai-chat-bubble="1"]', 'data-pw-chat-launcher', '1')
    var bgRegions = {
      header: 1,
      banner: 1,
      categories: 1,
      catalog: 1,
      promo: 1,
      footer: 1,
      content: 1,
      form: 1,
      gallery: 1,
      'pdp-info': 1,
      reviews: 1,
      'cart-list': 1,
      'cart-summary': 1,
      'account-nav': 1,
      'account-main': 1
    }
    var regionHosts = document.querySelectorAll('[data-pw-region]')
    for (var rh = 0; rh < regionHosts.length; rh++) {
      var rr = regionHosts[rh].getAttribute('data-pw-region')
      if (rr && bgRegions[rr]) setAttrIfEmpty(regionHosts[rh], 'data-pw-bg-role', rr)
    }
  }
  function hasProductAction(el) {
    if (!el || !el.querySelector) return false
    if (isHeroBannerContext(el)) return false
    return !!el.querySelector('[data-pw-el="card-cart"], [data-pw-el="card-buy"], [data-pw-add-cart]')
  }
  function looksLikeProductCardShape(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwRegionOf(el) === 'banner' || pwRegionOf(el) === 'categories') return false
    return pwElOf(el) === 'card' && pwRegionOf(el) === 'catalog'
  }
  function siblingProductCardCount(el) {
    var p = el && el.parentElement
    if (!p) return 0
    var n = 0
    for (var i = 0; i < p.children.length; i++) {
      if (looksLikeProductCardShape(p.children[i]) || isNamedProductCard(p.children[i])) n++
    }
    return n
  }
  function isNamedProductCard(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwRegionOf(el) === 'banner' || pwRegionOf(el) === 'categories') return false
    return pwElOf(el) === 'card' && pwRegionOf(el) === 'catalog'
  }
  function isProductGridEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwRegionOf(el) === 'banner' || pwRegionOf(el) === 'categories') return false
    if (pwElOf(el) === 'grid') return true
    return !!(el.getAttribute && el.getAttribute('data-pw-grid') != null)
  }
  function isProductCardEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (pwRegionOf(el) === 'banner' || pwRegionOf(el) === 'categories' || isHeroBannerEl(el)) return false
    if (pwElOf(el) === 'card' && pwRegionOf(el) === 'catalog') return true
    return !!(el.getAttribute && el.getAttribute('data-pw-catalog-lock') === '1')
  }
  function isCatalogActionEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isHeroBannerEl(el) || isHeroBannerContext(el)) return false
    var role = pwElOf(el)
    if (role === 'card-cart' || role === 'card-buy') return true
    return !!(el.getAttribute && (el.getAttribute('data-pw-add-cart') || el.getAttribute('data-pw-favorite') || el.getAttribute('data-pw-inventory-id') || el.getAttribute('data-inventory-id')))
  }
  function isLockedCatalogEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (productActionChromeOf(el)) return false
    var region = pwRegionOf(el)
    if (!region || region === 'banner' || region === 'header' || region === 'nav' || region === 'footer' || region === 'categories') return false
    if (region === 'catalog') {
      var n = el
      while (n && n !== document.body) {
        var role = pwElOf(n)
        if (role === 'section-title' || role === 'section-more') return false
        if (ownPwRegion(n) === 'catalog') break
        n = n.parentElement
      }
      return true
    }
    var walk = el
    while (walk && walk !== document.body) {
      if (walk.getAttribute && walk.getAttribute('data-pw-catalog-lock') === '1') return true
      walk = walk.parentElement
    }
    return false
  }
  function stampCatalogLocks() {
    var catalogs = document.querySelectorAll('[data-pw-region="catalog"]')
    for (var i = 0; i < catalogs.length; i++) {
      var locked = catalogs[i].querySelectorAll('[data-pw-el="card"], [data-pw-el="grid"], [data-pw-el="card-media"], [data-pw-el="card-name"], [data-pw-el="card-price"], [data-pw-el="card-cart"], [data-pw-el="card-buy"]')
      for (var k = 0; k < locked.length; k++) locked[k].setAttribute('data-pw-catalog-lock', '1')
    }
  }
  function isContentBlockEl(el) {
    if (isProductCardEl(el) || isLockedCatalogEl(el)) return false
    return isBlockEl(el) && !isChromeBlock(el)
  }
  function findBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isProductCardEl(el) || isLockedCatalogEl(el)) {
        el = el.parentElement
        continue
      }
      if (isContentBlockEl(el) || isBlockEl(el)) return el
      el = el.parentElement
    }
    return null
  }
  function findContentBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isProductCardEl(el) || isLockedCatalogEl(el)) {
        el = el.parentElement
        continue
      }
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
    if (!el || isLockedCatalogEl(el) || isProductCardEl(el) || isHeroInnerOrCopy(el)) return false
    if (ownPwRegion(el) !== 'banner') return false
    if (containsForeignShopRegion(el)) return false
    if (el.matches && el.matches('[data-pw-el="card"], [data-pw-grid], [data-nanoai-inventory]')) return false
    return true
  }
  function isBgLayerEl(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-bg-layer') === '1')
  }
  function isAddedBg(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-added-bg') === '1')
  }
  function addedBgLayer(el) {
    var n = parseInt(el && el.getAttribute ? (el.getAttribute('data-pw-bg-index') || el.getAttribute('data-pw-layer') || '') : '', 10)
    if (!isFinite(n)) n = parseInt(el && el.style ? (el.style.zIndex || '') : '', 10)
    return isFinite(n) ? n : 1
  }
  function applyAddedBgLayer(el, n) {
    var z = Math.max(0, Math.min(170, Math.round(n)))
    el.setAttribute('data-pw-layer', String(z))
    el.setAttribute('data-pw-bg-index', String(z))
    el.setAttribute('data-pw-bg-role', 'added')
    el.style.zIndex = String(z)
  }
  function listAddedBgs() {
    var nodes = document.querySelectorAll('[data-pw-added-bg="1"]')
    var out = []
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute && nodes[i].getAttribute('data-pw-hidden') === '1') continue
      out.push(nodes[i])
    }
    out.sort(function (a, b) { return addedBgLayer(a) - addedBgLayer(b) })
    return out
  }
  function addedBgLayerPos(el) {
    var stack = listBgStack()
    var idx = -1
    var last = -1
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].locked) continue
      last = i
      if (stack[i].el === el) idx = i
    }
    if (idx < 0) return 'only'
    var first = -1
    for (var j = 0; j < stack.length; j++) if (!stack[j].locked) { first = j; break }
    if (first === last) return 'only'
    if (idx === first) return 'bottom'
    if (idx === last) return 'top'
    return 'middle'
  }
  function bgStackRoot() {
    return visibleVisualRoot() || document.body
  }
  function addedBgContentHost() {
    var root = bgStackRoot()
    var main = root ? root.querySelector('main, .pw-shop-main, .pw-main') : null
    return main || root
  }
  function detachAddedBgFromChrome(el) {
    var host = addedBgContentHost()
    if (!el || !host || el.parentNode === host) return
    var chrome = el.closest ? el.closest('header, .pw-header, .pw-shop-header, .pw-topbar, .pw-shop-topbar, footer, .pw-footer, .pw-bottom-nav, .pw-shop-bottom-nav') : null
    if (!chrome) return
    var er = el.getBoundingClientRect()
    var hr = host.getBoundingClientRect()
    host.appendChild(el)
    el.style.left = Math.round(er.left - hr.left) + 'px'
    el.style.top = Math.round(er.top - hr.top) + 'px'
    el.style.transform = 'none'
  }
  function bgRoleOrder(role) {
    var order = {
      canvas: 0,
      header: 1,
      banner: 2,
      categories: 3,
      catalog: 4,
      promo: 5,
      footer: 6,
      content: 7,
      form: 8,
      gallery: 9,
      'pdp-info': 10,
      reviews: 11,
      'cart-list': 12,
      'cart-summary': 13,
      'account-nav': 14,
      'account-main': 15,
      added: 50
    }
    return order[role] == null ? 99 : order[role]
  }
  function isBgLockedRole(role) {
    return role === 'canvas' || role === 'header'
  }
  function paintsBgZ(role) {
    return role === 'canvas' || role === 'header' || role === 'added' || role === 'banner' || role === 'categories' || role === 'catalog' || role === 'promo' || role === 'footer'
  }
  function paintBgSurface(item, index) {
    var el = item.el
    var role = item.role
    el.setAttribute('data-pw-bg-role', role)
    el.setAttribute('data-pw-bg-index', String(index))
    if (role === 'added') el.setAttribute('data-pw-layer', String(index))
    if (!paintsBgZ(role)) return
    if (role === 'canvas') {
      el.style.zIndex = '0'
      try {
        var bg = cs(el).backgroundColor
        if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
          if (!el.style.backgroundColor) el.style.backgroundColor = '#ffffff'
        }
      } catch (errCanvas) {}
      return
    }
    if (role === 'header') {
      el.style.zIndex = '200'
      return
    }
    try {
      var pos = cs(el).position
      if (!pos || pos === 'static') el.style.position = 'relative'
    } catch (errPos) {}
    el.style.zIndex = String(index)
  }
  function collectBgSurfaces() {
    var root = bgStackRoot()
    var items = []
    var canvas = root.querySelector('[data-pw-bg-role="canvas"]') || root
    canvas.setAttribute('data-pw-bg-role', 'canvas')
    items.push({ el: canvas, role: 'canvas' })
    var regionRoles = ['header', 'topbar', 'banner', 'categories', 'catalog', 'promo', 'footer', 'content', 'form', 'gallery', 'pdp-info', 'reviews', 'cart-list', 'cart-summary', 'account-nav', 'account-main']
    for (var i = 0; i < regionRoles.length; i++) {
      var role = regionRoles[i]
      var el = root.querySelector('[data-pw-region="' + role + '"]')
      if (!el || el === canvas) continue
      items.push({ el: el, role: role })
    }
    var added = listAddedBgs()
    for (var j = 0; j < added.length; j++) items.push({ el: added[j], role: 'added' })
    return items
  }
  function listBgStack() {
    var items = collectBgSurfaces()
    items.sort(function (a, b) {
      var ia = parseInt(a.el.getAttribute('data-pw-bg-index') || '', 10)
      var ib = parseInt(b.el.getAttribute('data-pw-bg-index') || '', 10)
      if (!isFinite(ia)) ia = bgRoleOrder(a.role)
      if (!isFinite(ib)) ib = bgRoleOrder(b.role)
      if (ia !== ib) return ia - ib
      return bgRoleOrder(a.role) - bgRoleOrder(b.role)
    })
    for (var i = 0; i < items.length; i++) {
      items[i].index = i
      items[i].locked = isBgLockedRole(items[i].role)
    }
    return items
  }
  function ensureBgStack() {
    var items = listBgStack()
    for (var i = 0; i < items.length; i++) paintBgSurface(items[i], i)
    return items
  }
  function serializeBgStack(current) {
    var items = listBgStack()
    var out = []
    for (var i = 0; i < items.length; i++) {
      out.push({
        index: items[i].index,
        role: items[i].role,
        locked: items[i].locked,
        current: !!(current && items[i].el === current)
      })
    }
    return out
  }
  function stepBgStack(dir) {
    if (!selected || !isAddedBg(selected)) return
    detachAddedBgFromChrome(selected)
    var items = ensureBgStack()
    var idx = -1
    for (var i = 0; i < items.length; i++) if (items[i].el === selected) idx = i
    if (idx < 0) return
    var swap = idx + (dir > 0 ? 1 : -1)
    while (swap >= 0 && swap < items.length && items[swap].locked) swap += dir > 0 ? 1 : -1
    if (swap < 0 || swap >= items.length || items[swap].locked) return
    var a = items[idx].index
    var b = items[swap].index
    items[idx].el.setAttribute('data-pw-bg-index', String(b))
    items[swap].el.setAttribute('data-pw-bg-index', String(a))
    ensureBgStack()
    post('dirty', {})
    refreshSelect()
  }
  function isMoveBlockEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (el.getAttribute && el.getAttribute('data-pw-ungrouped') === '1') return false
    if (el.getAttribute && el.getAttribute('data-pw-move-block') === '1') return true
    if (pwElOf(el) === 'copy') return true
    var cls = clsOf(el)
    return cls.indexOf('pw-hero-copy') >= 0 || cls.indexOf('pw-banner-copy') >= 0
  }
  function findMoveBlockEl(start) {
    var el = start
    while (el && el !== document.body) {
      if (isMoveBlockEl(el)) return el
      el = el.parentElement
    }
    return null
  }
  function imageTargetOf(block) {
    if (!block) return null
    var layer = block.querySelector ? block.querySelector('[data-pw-bg-layer="1"]') : null
    if (layer) return layer
    var img = heroImgIn(block)
    if (img) return img
    if (isBgImageEl(block)) return block
    return null
  }
  function ensureImageLayer(block) {
    if (!block) return null
    if (containsForeignShopRegion(block) || isNonBannerShopRegion(block.getAttribute && block.getAttribute('data-pw-region'))) return null
    var existing = block.querySelector ? block.querySelector('[data-pw-bg-layer="1"]') : null
    if (existing && existing.tagName && String(existing.tagName).toLowerCase() === 'img') {
      existing.removeAttribute('data-pw-bg-layer')
      existing = null
    }
    if (existing) return existing
    var url = extractBgUrl(block)
    var img = heroImgIn(block)
    if (img) setAttrIfEmpty(img, 'data-pw-el', 'media')
    if (!url && !img && !looksLikeBannerHost(block) && !canImageLayer(block)) return img
    var pos = ''
    try { pos = cs(block).position } catch (e) { pos = '' }
    if (!pos || pos === 'static') block.style.position = 'relative'
    var hit = document.createElement('div')
    hit.setAttribute('data-pw-bg-layer', '1')
    hit.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:auto;background:transparent'
    block.insertBefore(hit, block.firstChild)
    return hit
  }
  function stampMoveBlock(el) {
    if (!el) return null
    el.setAttribute('data-pw-move-block', '1')
    var pos = ''
    try { pos = cs(el).position } catch (e) { pos = '' }
    var authored = !!(el.getAttribute && (el.getAttribute('data-pw-z') || el.getAttribute(SCENE.attr)))
    if ((!pos || pos === 'static') && !authored) el.style.position = 'relative'
    applyDefaultZ(el, 2)
    return el
  }
  function isBannerMediaChild(n, host) {
    if (!n || n.nodeType !== 1) return true
    if (isBgLayerEl(n) || isOverlayNode(n) || isIgnored(n)) return true
    if (isImgEl(n)) {
      try {
        var r = n.getBoundingClientRect()
        var pr = (host || n.parentElement).getBoundingClientRect()
        if (r.width >= pr.width * 0.55 && r.height >= Math.min(140, pr.height * 0.4)) return true
      } catch (e) {}
    }
    return false
  }
  function ensureMoveBlock(block) {
    if (!block || !block.querySelector) return null
    if (isNonBannerShopRegion(block.getAttribute && block.getAttribute('data-pw-region'))) return null
    if (containsForeignShopRegion(block)) return null
    var copy = block.querySelector('[data-pw-el="copy"]')
    if (copy && copy.getAttribute('data-pw-ungrouped') !== '1') return stampMoveBlock(copy)
    var stamped = block.querySelector('[data-pw-move-block="1"]')
    if (stamped && stamped.getAttribute('data-pw-ungrouped') !== '1' && !isHeroInnerOrCopy(stamped)) return stamped
    var inner = block.querySelector(':scope > [data-pw-el="inner"]')
    if (inner && inner.getAttribute('data-pw-move-block') === '1') {
      try {
        var ir = inner.getBoundingClientRect()
        var br = block.getBoundingClientRect()
        if (ir.width >= br.width * 0.85) inner.removeAttribute('data-pw-move-block')
        else if (inner.getAttribute('data-pw-ungrouped') !== '1') return inner
      } catch (errInner) {
        inner.removeAttribute('data-pw-move-block')
      }
    }
    var host = inner || block
    var existingWrap = host.querySelector ? host.querySelector(':scope > [data-pw-move-block="1"]') : null
    if (existingWrap && existingWrap.getAttribute('data-pw-ungrouped') !== '1' && !isHeroInnerOrCopy(existingWrap)) return existingWrap
    var nodes = []
    var kids = host.children || []
    for (var i = 0; i < kids.length; i++) {
      if (isBannerMediaChild(kids[i], block)) continue
      if (isAddedOverlay(kids[i])) continue
      nodes.push(kids[i])
    }
    if (!nodes.length) return null
    if (nodes.length === 1) {
      try {
        var nr = nodes[0].getBoundingClientRect()
        var b2 = block.getBoundingClientRect()
        if (nr.width < b2.width * 0.85 && nodes[0].getAttribute('data-pw-ungrouped') !== '1') return stampMoveBlock(nodes[0])
      } catch (errOne) {}
    }
    var wrap = document.createElement('div')
    wrap.setAttribute('data-pw-move-block', '1')
    wrap.setAttribute('data-pw-banner-copy', '1')
    wrap.style.position = 'relative'
    wrap.style.zIndex = '2'
    wrap.style.display = 'inline-block'
    wrap.style.maxWidth = '560px'
    host.insertBefore(wrap, nodes[0])
    for (var w = 0; w < nodes.length; w++) wrap.appendChild(nodes[w])
    return wrap
  }
  function unwrapEditorWrap(wrap) {
    var parent = wrap && wrap.parentNode
    if (!parent) return
    while (wrap.firstChild) parent.insertBefore(wrap.firstChild, wrap)
    parent.removeChild(wrap)
  }
  function repairMisidentifiedBannerHosts() {
    var cats = document.querySelectorAll('[data-pw-region="categories"]')
    for (var i = 0; i < cats.length; i++) {
      var cat = cats[i]
      var layers = cat.querySelectorAll('[data-pw-bg-layer="1"]')
      for (var L = 0; L < layers.length; L++) layers[L].remove()
      var wraps = cat.querySelectorAll('[data-pw-banner-copy="1"], [data-pw-move-block="1"]')
      for (var w = wraps.length - 1; w >= 0; w--) {
        var wrap = wraps[w]
        var wcls = clsOf(wrap)
        if (wcls.indexOf('pw-hero-copy') >= 0 || wcls.indexOf('pw-banner-copy') >= 0) {
          wrap.removeAttribute('data-pw-move-block')
          wrap.removeAttribute('data-pw-banner-copy')
          continue
        }
        unwrapEditorWrap(wrap)
      }
      if (cat.style) {
        if (cat.style.maxWidth === '560px') cat.style.maxWidth = ''
        if (cat.style.display === 'inline-block') cat.style.display = ''
        if (cat.style.overflow === 'hidden') cat.style.overflow = ''
        cat.style.transform = ''
      }
    }
    var stamped = document.querySelectorAll('[data-pw-region="banner"]')
    for (var b = 0; b < stamped.length; b++) {
      var host = stamped[b]
      if (!containsForeignShopRegion(host)) continue
      host.removeAttribute('data-pw-region')
      host.classList.remove('nanoai-ve-photo-edit')
      host.removeAttribute('data-pw-banner-zoom')
      host.removeAttribute('data-pw-banner-pan-x')
      host.removeAttribute('data-pw-banner-pan-y')
      if (host.style) {
        host.style.transform = ''
        host.style.overflow = ''
        host.style.backgroundSize = ''
        host.style.backgroundPosition = ''
      }
      var extra = host.querySelectorAll(':scope > [data-pw-bg-layer="1"]')
      for (var e = 0; e < extra.length; e++) extra[e].remove()
      var topWraps = host.querySelectorAll(':scope > [data-pw-banner-copy="1"]')
      for (var tw = 0; tw < topWraps.length; tw++) {
        if (topWraps[tw].querySelector('[data-pw-region="categories"]')) unwrapEditorWrap(topWraps[tw])
      }
    }
    var orphans = document.querySelectorAll('[data-pw-bg-layer="1"]')
    for (var o = 0; o < orphans.length; o++) {
      var op = orphans[o].parentElement
      if (op && containsForeignShopRegion(op) && op.getAttribute('data-pw-region') !== 'banner') orphans[o].remove()
    }
    var lockedCats = document.querySelectorAll('[data-pw-region="categories"][data-pw-catalog-lock], [data-pw-region="categories"] [data-pw-catalog-lock]')
    for (var lc = 0; lc < lockedCats.length; lc++) lockedCats[lc].removeAttribute('data-pw-catalog-lock')
  }
  function prepareImageLayerBlocks() {
    try { stampPwUiContract() } catch (errStamp) {}
    try { stampCatalogLocks() } catch (errLock) {}
    try { repairMisidentifiedBannerHosts() } catch (errRepair) {}
    var junk = document.querySelectorAll('.pw-product-card [data-pw-bg-layer="1"], .pw-shop-card [data-pw-bg-layer="1"], .pw-product-grid [data-pw-bg-layer="1"], [data-pw-catalog-lock="1"] [data-pw-bg-layer="1"], [data-pw-region="categories"] [data-pw-bg-layer="1"], .pw-product-card [data-pw-move-block], .pw-shop-card [data-pw-move-block]')
    for (var j = 0; j < junk.length; j++) {
      if (junk[j].getAttribute('data-pw-bg-layer') === '1') junk[j].remove()
      else junk[j].removeAttribute('data-pw-move-block')
    }
    var blocks = listImageLayerBlocks()
    for (var i = 0; i < blocks.length; i++) {
      ensureImageLayer(blocks[i])
      ensureMoveBlock(blocks[i])
    }
    try { freeAddedTextOverlays() } catch (errFreeText) {}
    try { restoreAuthoredLayers() } catch (errZ) {}
  }
  function isAddedOverlay(n) {
    return !!(n && n.getAttribute && (n.getAttribute('data-pw-added-text') === '1' || n.getAttribute('data-pw-added-btn') === '1'))
  }
  function isGroupableLeaf(n) {
    if (!n || n.nodeType !== 1 || isIgnored(n) || isBgLayerEl(n) || isOverlayNode(n) || isLogoTarget(n) || isLockedCatalogEl(n)) return false
    if (isAddedOverlay(n)) return false
    return isTextEl(n) || isBtnEl(n)
  }
  function ungroupMoveBlock() {
    var el = selected && isMoveBlockEl(selected) ? selected : (selected ? findMoveBlockEl(selected) : null)
    if (!el) return
    el.removeAttribute('data-pw-move-block')
    el.setAttribute('data-pw-ungrouped', '1')
    clearSelection()
    post('deselect', {})
    post('dirty', {})
    syncLayerSwitches()
  }
  function groupIntoBlock() {
    var el = selected
    if (!el || isMoveBlockEl(el) || isContentBlockEl(el) || isBgLayerEl(el) || isImgEl(el) || isLogoTarget(el)) return
    var host = findContentBlockEl(el)
    if (!host) return
    var existing = findMoveBlockEl(el)
    if (existing) {
      existing.removeAttribute('data-pw-ungrouped')
      existing.setAttribute('data-pw-move-block', '1')
      selectEl(existing)
      post('dirty', {})
      return
    }
    var parent = el.parentNode
    if (!parent) return
    var kids = Array.prototype.slice.call(parent.children)
    var idx = kids.indexOf(el)
    var nodes = [el]
    var l = idx - 1
    while (l >= 0 && isGroupableLeaf(kids[l])) { nodes.unshift(kids[l]); l-- }
    var r = idx + 1
    while (r < kids.length && isGroupableLeaf(kids[r])) { nodes.push(kids[r]); r++ }
    var wrap = document.createElement('div')
    wrap.setAttribute('data-pw-move-block', '1')
    wrap.style.position = 'relative'
    wrap.style.zIndex = '2'
    wrap.style.display = 'inline-block'
    wrap.style.maxWidth = '100%'
    parent.insertBefore(wrap, nodes[0])
    for (var i = 0; i < nodes.length; i++) wrap.appendChild(nodes[i])
    selectEl(wrap)
    post('dirty', {})
  }
  function listImageLayerBlocks() {
    var all = document.querySelectorAll('[data-pw-region="banner"]')
    var out = []
    for (var i = 0; i < all.length; i++) {
      if (!canImageLayer(all[i])) continue
      var nested = false
      for (var j = 0; j < out.length; j++) {
        if (out[j].contains(all[i])) { nested = true; break }
      }
      if (!nested) out.push(all[i])
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
    s.textContent = '[data-pw-overlay="1"]~*:not([data-pw-z]):not([' + SCENE.attr + ']){position:relative;z-index:1}.pw-hero[data-pw-has-overlay]::after,.pw-banner[data-pw-has-overlay]::after{display:none!important}'
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
    if (selected && isAddedBg(selected)) {
      blockId(selected)
      selected.setAttribute('data-pw-hidden', '1')
      selected.style.display = 'none'
      clearSelection()
      post('deselect', {})
      post('dirty', {})
      postHidden()
      return
    }
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
    if (selected && isAddedBg(selected)) {
      deleteSelectedUnit()
      return
    }
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
    if (selected && isAddedBg(selected) && selected.parentNode) {
      var bgClone = selected.cloneNode(true)
      bgClone.classList.remove('nanoai-ve-highlight', 'nanoai-ve-hover', 'nanoai-ve-dragging')
      bgClone.removeAttribute('data-nanoai-ve-selected')
      bgClone.removeAttribute('data-pw-hidden')
      bgClone.style.display = ''
      bgClone.style.left = (parseFloat(selected.style.left) || 0) + 12 + 'px'
      bgClone.style.top = (parseFloat(selected.style.top) || 0) + 12 + 'px'
      applyAddedBgLayer(bgClone, addedBgLayer(selected) + 1)
      selected.parentNode.insertBefore(bgClone, selected.nextSibling)
      selectEl(bgClone)
      post('dirty', {})
      return
    }
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
          scope.querySelectorAll('.pw-icon-btn svg, [data-pw-chrome-btn] svg, [data-pw-chrome-added] svg, [data-pw-el="cat-toggle"] svg, [data-pw-cat-toggle] svg, [data-pw-image-search] svg')
        )
      } catch (err) {
        list = []
      }
    }
    for (var i = 0; i < list.length; i++) {
      var svg = list[i]
      var host = svg.closest ? (svg.closest('[data-pw-chrome-btn],[data-pw-chrome-added],.pw-icon-btn,.pw-shop-icon-btn,[data-pw-el="cat-toggle"],[data-pw-cat-toggle],[data-pw-image-search]') || svg.parentElement) : null
      var n = parseChromeIconSize(host)
      var px = n + 'px'
      svg.setAttribute('width', String(n))
      svg.setAttribute('height', String(n))
      svg.style.width = px
      svg.style.height = px
      svg.style.maxWidth = px
      svg.style.maxHeight = px
      svg.style.flexShrink = '0'
      if (svg.classList && svg.classList.contains('pw-chrome-brand-logo')) continue
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
  ${PW_CHROME_COUNT_BADGE_RUNTIME_JS}
  function activeVisualRoot() {
    var dev = pwStampDevice()
    var root = document.querySelector('[data-pw-visual-device="' + dev + '"]') || document.querySelector('.pw-visual-' + dev)
    if (root) return root
    return document
  }
  function scopedQuery(selector) {
    var root = activeVisualRoot()
    return root && root.querySelector ? root.querySelector(selector) : document.querySelector(selector)
  }
  function scopedQueryAll(selector) {
    var root = activeVisualRoot()
    return root && root.querySelectorAll ? root.querySelectorAll(selector) : document.querySelectorAll(selector)
  }
  function ensureChromeHost(place) {
    if (place === 'float') {
      return scopedQuery('header.pw-header, header.pw-shop-header, header') || document.body
    }
    if (place === 'topbar') {
      var inner = scopedQuery('.pw-topbar-inner, .pw-shop-topbar-inner')
      if (inner) return inner
      var header = scopedQuery('header.pw-header, header.pw-shop-header') || scopedQuery('header')
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
      var bottom = scopedQuery('.pw-bottom-nav, .pw-shop-bottom-nav')
      if (bottom) return bottom
    }
    if (place === 'mid') {
      var mid = scopedQuery('.pw-nav-main, .pw-shop-nav-row')
      if (mid) return mid
      var midHeader = scopedQuery('header.pw-header, header.pw-shop-header') || scopedQuery('header')
      var midNav = document.createElement('nav')
      midNav.className = 'pw-container pw-nav-main'
      midNav.setAttribute('aria-label', 'Shop')
      if (midHeader) midHeader.appendChild(midNav)
      else document.body.insertBefore(midNav, document.body.firstChild)
      return midNav
    }
    var actions = scopedQuery('.pw-header-actions, .pw-shop-header-actions')
    if (actions) return actions
    var main = scopedQuery('.pw-header-main, .pw-shop-header-inner')
    var header = scopedQuery('header.pw-header, header.pw-shop-header, header')
    if (!main) main = header
    if (main) {
      actions = document.createElement('div')
      actions.className = 'pw-header-actions'
      main.appendChild(actions)
      return actions
    }
    return document.body
  }
  function chromeAliasKinds(kind) {
    if (kind === 'wishlist' || kind === 'favorites-link') return ['wishlist', 'favorites-link']
    if (kind === 'orders' || kind === 'orders-link') return ['orders', 'orders-link']
    return [kind]
  }
  function collectChromeMatches(selector) {
    var seen = []
    var add = function (list) {
      if (!list) return
      for (var i = 0; i < list.length; i++) {
        var n = list[i]
        if (!n || seen.indexOf(n) >= 0) continue
        seen.push(n)
      }
    }
    add(scopedQueryAll(selector))
    add(document.querySelectorAll(selector))
    return seen
  }
  function pickChromeMatch(selector) {
    var nodes = collectChromeMatches(selector)
    var first = null
    for (var i = 0; i < nodes.length; i++) {
      if (!first) first = nodes[i]
      if (isShown(nodes[i])) return nodes[i]
    }
    return first
  }
  function findExistingChrome(kind) {
    var k = String(kind || '').replace(/[^a-z0-9-]/g, '')
    if (!k) return null
    if (k === 'categories') {
      return pickChromeMatch(
        '[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn="categories"]'
      )
    }
    if (k === 'account') {
      return pickChromeMatch('[data-pw-account-toggle],[data-pw-chrome-btn="account"],.pw-account-btn,[data-pw-el="account"]')
    }
    if (k === 'search') {
      return pickChromeMatch('[data-pw-el="search"],.pw-header-search,.pw-shop-search-wrap')
    }
    if (k === 'search-image') {
      return pickChromeMatch('[data-pw-image-search],.pw-search-image-btn,.pw-shop-search-image')
    }
    if (k === 'cart') {
      var cart = pickChromeMatch('[data-pw-chrome-btn="cart"],[data-pw-el="cart"]')
      if (cart) return cart
    }
    var aliases = chromeAliasKinds(k)
    for (var a = 0; a < aliases.length; a++) {
      var found = pickChromeMatch('[data-pw-chrome-btn="' + aliases[a] + '"]')
      if (found) return found
    }
    return null
  }
  function resetVisualScroll() {
    try { window.scrollTo(0, 0) } catch (errWin) {}
    var roots = [document.scrollingElement, document.documentElement, document.body]
    for (var i = 0; i < roots.length; i++) {
      var n = roots[i]
      if (!n) continue
      try { n.scrollLeft = 0 } catch (errX) {}
      try { n.scrollTop = 0 } catch (errY) {}
    }
  }
  function restoreChromeDupCenter(el) {
    if (!el || !el.getAttribute || el.getAttribute('data-pw-ve-dup-center') !== '1') return
    var left = el.getAttribute('data-pw-ve-dup-left')
    var top = el.getAttribute('data-pw-ve-dup-top')
    var pos = el.getAttribute('data-pw-ve-dup-pos')
    var z = el.getAttribute('data-pw-ve-dup-z')
    var tf = el.getAttribute('data-pw-ve-dup-tf')
    var mg = el.getAttribute('data-pw-ve-dup-mg')
    var right = el.getAttribute('data-pw-ve-dup-right')
    var bottom = el.getAttribute('data-pw-ve-dup-bottom')
    var hadMove = el.getAttribute('data-pw-ve-dup-had-move')
    el.removeAttribute('data-pw-ve-dup-center')
    el.removeAttribute('data-pw-ve-dup-left')
    el.removeAttribute('data-pw-ve-dup-top')
    el.removeAttribute('data-pw-ve-dup-pos')
    el.removeAttribute('data-pw-ve-dup-z')
    el.removeAttribute('data-pw-ve-dup-tf')
    el.removeAttribute('data-pw-ve-dup-mg')
    el.removeAttribute('data-pw-ve-dup-right')
    el.removeAttribute('data-pw-ve-dup-bottom')
    el.removeAttribute('data-pw-ve-dup-had-move')
    if (el.classList) el.classList.remove('nanoai-ve-chrome-dup')
    if (!el.style) return
    if (pos) el.style.position = pos
    else el.style.removeProperty('position')
    if (left) el.style.left = left
    else el.style.removeProperty('left')
    if (top) el.style.top = top
    else el.style.removeProperty('top')
    if (right) el.style.right = right
    else el.style.removeProperty('right')
    if (bottom) el.style.bottom = bottom
    else el.style.removeProperty('bottom')
    if (z) el.style.zIndex = z
    else el.style.removeProperty('z-index')
    if (tf) el.style.transform = tf
    else el.style.removeProperty('transform')
    if (mg) el.style.margin = mg
    else el.style.removeProperty('margin')
    if (hadMove !== '1') {
      try { el.removeAttribute('data-pw-user-move') } catch (errMove) {}
    }
  }
  function restoreAllChromeDupCenters() {
    var nodes = document.querySelectorAll('[data-pw-ve-dup-center="1"]')
    for (var i = 0; i < nodes.length; i++) restoreChromeDupCenter(nodes[i])
    try { window.clearTimeout(window.__nanoaiVeDupCenterT) } catch (errT) {}
  }
  function chromeViewportSize() {
    var viewW = window.innerWidth || document.documentElement.clientWidth || 0
    var viewH = window.innerHeight || document.documentElement.clientHeight || 0
    if (!(viewW > 8)) viewW = 390
    if (!(viewH > 8)) viewH = 640
    return { w: viewW, h: viewH }
  }
  function resetFullBleedChromePos() {
    var nodes = document.querySelectorAll(
      '.pw-topbar,.pw-shop-topbar,[data-pw-region="topbar"],header,.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-topbar-inner,.pw-shop-topbar-inner'
    )
    var i
    for (i = 0; i < nodes.length; i++) {
      var bar = nodes[i]
      if (!bar || !bar.style) continue
      var cls = clsOf(bar)
      var region = bar.getAttribute ? String(bar.getAttribute('data-pw-region') || '') : ''
      var isTopbar = region === 'topbar' || cls.indexOf('pw-topbar') >= 0 || cls.indexOf('pw-shop-topbar') >= 0
      if (!isTopbar && !isFullBleedChrome(bar) && !isShopRegionHost(bar)) continue
      bar.style.removeProperty('position')
      bar.style.removeProperty('left')
      bar.style.removeProperty('top')
      bar.style.removeProperty('right')
      bar.style.removeProperty('bottom')
      bar.style.removeProperty('transform')
      bar.style.removeProperty('width')
      bar.style.removeProperty('height')
      bar.style.removeProperty('max-width')
      bar.style.removeProperty('max-height')
      bar.style.removeProperty('min-width')
      bar.style.removeProperty('clip-path')
      bar.style.removeProperty('margin')
      bar.style.removeProperty('z-index')
      if (isTopbar) {
        bar.style.setProperty('position', 'relative', 'important')
        bar.style.setProperty('left', 'auto', 'important')
        bar.style.setProperty('right', 'auto', 'important')
        bar.style.setProperty('top', 'auto', 'important')
        bar.style.setProperty('bottom', 'auto', 'important')
        bar.style.setProperty('transform', 'none', 'important')
        bar.style.setProperty('width', '100%', 'important')
        bar.style.setProperty('min-width', '100%', 'important')
        bar.style.setProperty('max-width', 'none', 'important')
        bar.style.setProperty('height', 'auto', 'important')
      }
      try { bar.removeAttribute('data-pw-user-move') } catch (errBleedMove) {}
      if (bar.classList) bar.classList.remove('nanoai-ve-chrome-dup')
    }
  }
  function parkableChromeUnit(el, kind) {
    var unit = chromeReorderUnit(el) || el
    var k = String(kind || '').replace(/[^a-z0-9-]/g, '')
    function innerOf(host) {
      if (!host || !host.querySelector) return null
      if (k) {
        var named = host.querySelector('[data-pw-chrome-btn="' + k + '"]')
        if (named) return named
      }
      return host.querySelector('[data-pw-chrome-btn],.pw-icon-btn,.pw-shop-icon-btn,[data-pw-chrome-added]')
    }
    if (isFullBleedChrome(unit) || isShopRegionHost(unit)) return innerOf(unit)
    try {
      var box = unit.getBoundingClientRect()
      var view = chromeViewportSize()
      if (box && view && (box.width > view.w * 0.45 || box.height > Math.max(120, view.h * 0.35))) {
        return innerOf(unit) || unit
      }
    } catch (errParkable) {}
    return unit
  }
  function applyViewportCenterPos(el, w, h) {
    if (!el || !el.style) return
    var view = chromeViewportSize()
    var floating = isChromeFloatEl(el) || (el.parentNode === document.body)
    if (!floating) {
      el.style.removeProperty('position')
      el.style.removeProperty('left')
      el.style.removeProperty('top')
      el.style.removeProperty('right')
      el.style.removeProperty('bottom')
      el.style.removeProperty('width')
      el.style.removeProperty('height')
    }
    var r
    try { r = el.getBoundingClientRect() } catch (errBox) { r = null }
    var boxW = Math.max(24, (r && r.width) || w || 40)
    var boxH = Math.max(24, (r && r.height) || h || 40)
    var wantLeft = Math.round((view.w - boxW) / 2)
    var wantTop = Math.round((view.h - boxH) / 2)
    if (wantLeft < 24) wantLeft = 24
    if (wantTop < 24) wantTop = 24
    if (floating) {
      var leftPct = (wantLeft / view.w) * 100
      var topPct = (wantTop / view.h) * 100
      el.style.setProperty('position', 'fixed', 'important')
      el.style.setProperty('left', leftPct.toFixed(2) + '%', 'important')
      el.style.setProperty('top', topPct.toFixed(2) + '%', 'important')
      el.style.setProperty('right', 'auto', 'important')
      el.style.setProperty('bottom', 'auto', 'important')
      el.style.setProperty('transform', 'none', 'important')
      el.style.setProperty('margin', '0', 'important')
      return { left: wantLeft, top: wantTop, w: boxW, h: boxH, view: view, wantLeft: wantLeft, wantTop: wantTop }
    }
    var cur = parseTransform(el)
    var dx = wantLeft - (r && isFinite(r.left) ? r.left : 0)
    var dy = wantTop - (r && isFinite(r.top) ? r.top : 0)
    clampTranslateToViewport(el, cur.x + dx, cur.y + dy)
    return { left: wantLeft, top: wantTop, w: boxW, h: boxH, view: view, wantLeft: wantLeft, wantTop: wantTop }
  }
  function liftChromeToViewportCenter(el) {
    if (!el || !el.style) return
    if (el.getAttribute('data-pw-ve-dup-center') !== '1') {
      el.setAttribute('data-pw-ve-dup-center', '1')
      el.setAttribute('data-pw-ve-dup-left', el.style.left || '')
      el.setAttribute('data-pw-ve-dup-top', el.style.top || '')
      el.setAttribute('data-pw-ve-dup-right', el.style.right || '')
      el.setAttribute('data-pw-ve-dup-bottom', el.style.bottom || '')
      el.setAttribute('data-pw-ve-dup-pos', el.style.position || '')
      el.setAttribute('data-pw-ve-dup-z', el.style.zIndex || '')
      el.setAttribute('data-pw-ve-dup-tf', el.style.transform || '')
      el.setAttribute('data-pw-ve-dup-mg', el.style.margin || '')
      el.setAttribute('data-pw-ve-dup-had-move', isUserMoved(el) ? '1' : '0')
    }
    var r
    try { r = el.getBoundingClientRect() } catch (errBox) { r = null }
    applyViewportCenterPos(el, r && r.width ? r.width : 40, r && r.height ? r.height : 40)
    el.style.setProperty('z-index', '2147483002', 'important')
    if (el.classList) el.classList.add('nanoai-ve-chrome-dup')
  }
  function parkChromeAtViewportCenter(el, kind) {
    if (!el || !el.style) return
    restoreAllChromeDupCenters()
    resetFullBleedChromePos()
    resetVisualScroll()
    var unit = parkableChromeUnit(el, kind)
    if (!unit || !unit.style) return
    if (isFullBleedChrome(unit) || isShopRegionHost(unit)) {
      resetFullBleedChromePos()
      return
    }
    if (isChromeFloatEl(unit)) {
      revealChromeFloat(unit)
      try { sizeChromeIcons(unit) } catch (errSizePark) {}
      try { pinChromeIconBadges(unit) } catch (errPinPark) {}
    }
    var before
    try { before = unit.getBoundingClientRect() } catch (errBox) { before = null }
    var w = Math.max(24, before && before.width ? Math.min(before.width, 280) : 40)
    var h = Math.max(24, before && before.height ? Math.min(before.height, 120) : 40)
    markUserMoved(unit)
    applyViewportCenterPos(unit, w, h)
    var z = isChromeFloatEl(unit) ? '${PW_CHROME_FLOAT_Z_INDEX}' : '2147483002'
    unit.style.setProperty('z-index', z, 'important')
    if (unit.classList) unit.classList.add('nanoai-ve-chrome-dup')
    function verifyParked() {
      try {
        var after = unit.getBoundingClientRect()
        var viewNow = chromeViewportSize()
        var stuck = !!(after && after.top < 24 && after.left < 24)
        var off = !!(after && (after.right < 8 || after.left > viewNow.w - 8 || after.bottom < 8 || after.top > viewNow.h - 8))
        if (stuck || off) applyViewportCenterPos(unit, w, h)
      } catch (errVerifyPark) {}
      try { positionAllHandles() } catch (errPosPark2) {}
    }
    verifyParked()
    selectEl(unit)
    verifyParked()
    try {
      if (window.requestAnimationFrame) window.requestAnimationFrame(verifyParked)
      else window.setTimeout(verifyParked, 0)
    } catch (errRafPark) {}
    post('dirty', {})
  }
  function focusExistingChrome(el, kind) {
    if (!el) return
    parkChromeAtViewportCenter(el, kind)
  }
  function bringExistingChromeToCenter(kind) {
    var el = findExistingChrome(kind)
    if (!el) return
    focusExistingChrome(el, kind)
  }
  function pageFooterEl(){
    return document.querySelector('footer,.pw-footer,.pw-shop-footer')
  }
  function isAfterFooterEl(el){
    var footer=pageFooterEl()
    if(!el||!footer)return false
    try{return !!(el.compareDocumentPosition(footer)&2)}catch(eAf){return false}
  }
  function findHeadingHostBeforeFooter(){
    var heads=document.querySelectorAll('main h1, main [data-pw-el="heading"], main [data-pw-info-title], h1, [data-pw-el="heading"], [data-pw-info-title]')
    for(var i=0;i<heads.length;i++){
      var h=heads[i]
      if(!h||h.nodeType!==1)continue
      if(h.closest&&h.closest('header,footer,nav,.pw-header,.pw-shop-header,.pw-footer,.pw-shop-footer,.pw-bottom-nav,.pw-shop-bottom-nav'))continue
      if(isAfterFooterEl(h))continue
      var host=h.closest('article,section,[data-pw-region="content"],.pw-shop-info,div')
      if(host&&!(host.closest&&host.closest('header,.pw-header,footer,.pw-footer,.pw-shop-footer')))return host
    }
    return null
  }
  function removeStrayInfoArticles(keep){
    var footer=pageFooterEl()
    var list=document.querySelectorAll('[data-pw-info-article],[data-pw-region="content"][data-pw-text-article],[data-pw-info-body]')
    for(var i=0;i<list.length;i++){
      var el=list[i]
      if(!el||el===keep)continue
      if(keep&&keep.contains&&keep.contains(el))continue
      if(keep&&el.contains&&el.contains(keep))continue
      if(el.closest&&el.closest('header,footer,nav,.pw-header,.pw-shop-header,.pw-footer,.pw-shop-footer,.pw-bottom-nav,.pw-shop-bottom-nav'))continue
      var after=isAfterFooterEl(el)||(footer&&el===footer)
      var extraArticle=el.getAttribute&&(el.getAttribute('data-pw-info-article')==='1'||el.getAttribute('data-pw-text-article')==='1')
      if(after||(extraArticle&&keep&&el!==keep)){
        try{if(el.parentNode)el.parentNode.removeChild(el)}catch(eRm){}
      }
    }
  }
  function placeInfoRegionBeforeFooter(region){
    if(!region)return
    var footer=pageFooterEl()
    var host=document.querySelector('main')
    if(host&&host.contains(region)&&!isAfterFooterEl(region))return
    if(!host)host=footer&&footer.parentNode?footer.parentNode:document.body
    if(!host)return
    try{
      if(footer&&(footer.parentNode===host||host.contains(footer))){
        if(footer.parentNode===host)host.insertBefore(region,footer)
        else footer.parentNode.insertBefore(region,footer)
      }else host.appendChild(region)
    }catch(ePl){}
  }
  function findBestInfoContentRegion(){
    var list=document.querySelectorAll('main [data-pw-region="content"],main .pw-shop-info,main [data-pw-info-article],main [data-pw-text-article="1"],main [data-pw-info-body], [data-pw-region="content"],.pw-shop-info,[data-pw-info-article]')
    var best=null
    var bestScore=-1
    for(var i=0;i<list.length;i++){
      var el=list[i]
      if(!el||el.nodeType!==1)continue
      if(el.closest&&el.closest('header,footer,nav,.pw-header,.pw-shop-header,.pw-footer,.pw-shop-footer,.pw-bottom-nav,.pw-shop-bottom-nav'))continue
      if(isAfterFooterEl(el))continue
      var text=(el.textContent||'').replace(/\s+/g,' ').trim()
      var score=Math.min(4000,text.length)
      if(el.querySelector&&el.querySelector('h1,[data-pw-info-title],[data-pw-el="heading"]'))score+=800
      if(el.querySelector&&el.querySelector('[data-pw-info-body],p,li'))score+=400
      if(el.closest&&el.closest('main'))score+=2000
      if(el.getAttribute&&el.getAttribute('data-pw-info-article')==='1')score+=200
      if(el.getAttribute&&el.getAttribute('data-pw-text-article')==='1')score+=200
      // Cột trên (sớm hơn trong DOM) thắng cột dưới
      score+=Math.max(0,80-i)
      if(text.length<8)score-=500
      if(score>bestScore){bestScore=score;best=el}
    }
    if(best)return best
    return findHeadingHostBeforeFooter()
  }
  function ensureInfoArticle(){
    var region=findBestInfoContentRegion()
    if(!region){
      region=document.createElement('article')
      region.setAttribute('data-pw-region','content')
      placeInfoRegionBeforeFooter(region)
    } else {
      placeInfoRegionBeforeFooter(region)
    }
    region.setAttribute('data-pw-info-article','1')
    region.setAttribute('data-pw-text-article','1')
    var pageRoot=document.querySelector('[data-pw-page],body')
    if(pageRoot&&!pageRoot.getAttribute('data-pw-page'))pageRoot.setAttribute('data-pw-page','info')
    var h1=region.querySelector('h1,[data-pw-info-title],[data-pw-el="heading"]')
    if(!h1){
      h1=document.createElement('h1')
      region.insertBefore(h1,region.firstChild)
    }
    h1.setAttribute('data-pw-info-title','1')
    h1.setAttribute('data-pw-el','heading')
    var body=region.querySelector('[data-pw-info-body]')
    if(!body){
      body=document.createElement('div')
      body.setAttribute('data-pw-info-body','1')
      body.setAttribute('data-pw-el','body')
      var node=h1.nextSibling
      while(node){
        var nxt=node.nextSibling
        if(node.nodeType===1){
          var tag=String(node.tagName||'').toLowerCase()
          var reg=node.getAttribute?String(node.getAttribute('data-pw-region')||''):''
          if(tag==='header'||tag==='footer'||tag==='nav'||reg==='header'||reg==='footer'||reg==='nav'||reg==='topbar'){
            node=nxt
            continue
          }
          if(node.getAttribute&&(node.getAttribute('data-pw-seo-coach')==='1'||node.getAttribute('data-pw-article-editor')==='1')){
            node=nxt
            continue
          }
        }
        body.appendChild(node)
        node=nxt
      }
      if(h1.nextSibling)region.insertBefore(body,h1.nextSibling)
      else region.appendChild(body)
    }else{
      var bodyText=(body.textContent||'').replace(/\s+/g,' ').trim()
      if(bodyText.length<2){
        var walk=region.firstChild
        while(walk){
          var walkNext=walk.nextSibling
          if(walk===h1||walk===body){walk=walkNext;continue}
          if(walk.nodeType===1&&walk.getAttribute&&(walk.getAttribute('data-pw-article-editor')==='1'||walk.getAttribute('data-pw-seo-coach')==='1')){
            walk=walkNext
            continue
          }
          if(walk.nodeType===1||(walk.nodeType===3&&String(walk.textContent||'').trim())){
            body.appendChild(walk)
          }
          walk=walkNext
        }
      }
    }
    removeStrayInfoArticles(region)
    return {region:region,h1:h1,body:body}
  }
  function pinInfoArticleEditor(editor, parts){
    if(!editor||!parts||!parts.region)return
    var region=parts.region
    var h1=parts.h1
    var body=parts.body
    var mainHost=document.querySelector('main')
    var footer=document.querySelector('footer,.pw-footer,.pw-shop-footer')
    // Bài + thanh AI phải nằm trong main, trước chân trang
    if(mainHost&&(!mainHost.contains(region)||(footer&&region.compareDocumentPosition&&(region.compareDocumentPosition(footer)&2)))){
      try{
        if(footer&&footer.parentNode===mainHost)mainHost.insertBefore(region,footer)
        else mainHost.appendChild(region)
      }catch(eMoveMain){}
    }
    if(h1&&h1.parentNode!==region)region.insertBefore(h1,region.firstChild)
    if(body&&body.parentNode!==region)region.appendChild(body)
    if(editor.parentNode!==region)region.appendChild(editor)
    // Thứ tự: H1 → thanh AI gọn → đoạn văn
    if(h1){
      if(h1.nextSibling!==editor)region.insertBefore(editor,h1.nextSibling)
    }else if(body){
      region.insertBefore(editor,body)
    }
    if(body&&editor.nextSibling!==body)region.insertBefore(body,editor.nextSibling)
  }
  function removeInfoSeoCoach(){
    var nodes=document.querySelectorAll('[data-pw-seo-coach="1"],[data-pw-article-editor="1"]')
    for(var i=0;i<nodes.length;i++){
      if(nodes[i]&&nodes[i].parentNode)nodes[i].parentNode.removeChild(nodes[i])
    }
  }
  function snapshotInfoArticleForUndo(){
    var parts=ensureInfoArticle()
    if(!parts)return
    infoArticleUndoHtml=parts.body?String(parts.body.innerHTML||''):''
    infoArticleUndoMeta={
      title:parts.h1?String(parts.h1.textContent||''):'',
      seoDescription:parts.region?String(parts.region.getAttribute('data-pw-seo-description')||''):'',
      seoKeywords:parts.region?String(parts.region.getAttribute('data-pw-seo-keywords')||''):'',
      docTitle:document.title||''
    }
    updateInfoArticleUndoBtn()
  }
  function restoreInfoArticleUndo(){
    if(!infoArticleUndoHtml&&!(infoArticleUndoMeta&&infoArticleUndoMeta.title))return
    var parts=ensureInfoArticle()
    if(!parts||!parts.body)return
    parts.body.innerHTML=infoArticleUndoHtml||''
    if(infoArticleUndoMeta){
      if(infoArticleUndoMeta.title&&parts.h1)parts.h1.textContent=infoArticleUndoMeta.title
      if(parts.region){
        if(infoArticleUndoMeta.seoDescription)parts.region.setAttribute('data-pw-seo-description',infoArticleUndoMeta.seoDescription)
        if(infoArticleUndoMeta.seoKeywords)parts.region.setAttribute('data-pw-seo-keywords',infoArticleUndoMeta.seoKeywords)
      }
      if(infoArticleUndoMeta.docTitle)document.title=infoArticleUndoMeta.docTitle
    }
    infoArticleUndoHtml=''
    infoArticleUndoMeta=null
    updateInfoArticleUndoBtn()
    ensureInfoSeoCoach()
    post('dirty',{})
    refreshSelect()
  }
  function updateInfoArticleUndoBtn(){
    var btn=document.querySelector('[data-pw-seo-undo]')
    if(!btn)return
    var can=Boolean(infoArticleUndoHtml||(infoArticleUndoMeta&&infoArticleUndoMeta.title))
    btn.disabled=!can
    btn.style.opacity=can?'1':'0.45'
  }
  function pickArticleTextTarget(){
    var parts=ensureInfoArticle()
    if(!parts||!parts.body)return null
    if(selected&&parts.body.contains(selected)&&isTextEl(selected))return selected
    if(selected&&parts.h1&&(selected===parts.h1||parts.h1.contains(selected)))return parts.h1
    var p=parts.body.querySelector('p,[data-pw-el="body"],h2,h3,li')
    return p||parts.h1||parts.body
  }
  function setInfoSeoBusy(busy){
    var editor=document.querySelector('[data-pw-article-editor="1"],[data-pw-seo-coach="1"]')
    if(!editor)return
    var btn=editor.querySelector('[data-pw-seo-rewrite]')
    var ta=editor.querySelector('textarea')
    var undo=editor.querySelector('[data-pw-seo-undo]')
    var imgBtn=editor.querySelector('[data-pw-seo-insert-image]')
    if(btn){
      btn.disabled=!!busy
      btn.textContent=busy?(COPY.infoSeoBusy||'…'):(COPY.infoSeoRewrite||'AI')
    }
    if(ta)ta.disabled=!!busy
    if(undo)undo.disabled=!!busy||!(infoArticleUndoHtml||(infoArticleUndoMeta&&infoArticleUndoMeta.title))
    if(imgBtn)imgBtn.disabled=!!busy
  }
  function forceShowInfoArticleEditor(editor){
    if(!editor||!editor.style)return
    try{
      editor.style.setProperty('display','block','important')
      editor.style.setProperty('visibility','visible','important')
      editor.style.setProperty('height','auto','important')
      editor.style.setProperty('max-height','none','important')
      editor.style.setProperty('overflow','visible','important')
      editor.style.setProperty('opacity','1','important')
      editor.style.setProperty('margin','6px 0 8px','important')
      editor.style.setProperty('padding','6px 8px','important')
      editor.style.setProperty('border','1px solid #e2e8f0','important')
      editor.style.setProperty('background','#f8fafc','important')
      editor.style.setProperty('color','#0f172a','important')
      editor.style.setProperty('max-width','720px','important')
      editor.style.setProperty('width','100%','important')
      editor.style.setProperty('box-sizing','border-box','important')
      editor.style.setProperty('border-radius','8px','important')
      editor.style.setProperty('position','relative','important')
      editor.style.setProperty('z-index','5','important')
      editor.style.setProperty('box-shadow','none','important')
    }catch(eShow){}
  }
  function ensureInfoSeoCoach(){
    var parts=ensureInfoArticle()
    if(!parts)return null
    var region=parts.region
    var editor=document.querySelector('[data-pw-article-editor="1"]')
    if(!editor){
      removeInfoSeoCoach()
      editor=document.createElement('div')
      editor.setAttribute('data-pw-article-editor','1')
      editor.setAttribute('data-pw-seo-coach','1')
      editor.setAttribute('data-nanoai-ve-ignore','1')
      editor.setAttribute('role','region')
      editor.setAttribute('aria-label',COPY.infoSeoTitle||'SEO')
      editor.className='nanoai-ve-ignore pw-article-editor'
      var row=document.createElement('div')
      row.className='pw-article-editor-tools'
      var title=document.createElement('span')
      title.className='pw-seo-coach-title'
      title.textContent=COPY.infoSeoTitle||'SEO'
      title.setAttribute('title',COPY.infoSeoHint||'')
      var btnAi=document.createElement('button')
      btnAi.type='button'
      btnAi.setAttribute('data-pw-seo-rewrite','1')
      btnAi.textContent=COPY.infoSeoRewrite||'AI'
      btnAi.addEventListener('click',function(ev){
        try{ev.preventDefault();ev.stopPropagation()}catch(eBtn){}
        var notesEl=editor.querySelector('textarea')
        var notes=notesEl?String(notesEl.value||''):''
        region.setAttribute('data-pw-seo-notes',notes)
        snapshotInfoArticleForUndo()
        post('infoAiRewrite',{notes:notes})
      })
      var btnUndo=document.createElement('button')
      btnUndo.type='button'
      btnUndo.setAttribute('data-pw-seo-undo','1')
      btnUndo.className='pw-article-editor-secondary'
      btnUndo.textContent=COPY.infoSeoUndo||'Undo'
      btnUndo.addEventListener('click',function(ev){
        try{ev.preventDefault();ev.stopPropagation()}catch(eU){}
        restoreInfoArticleUndo()
      })
      var btnImg=document.createElement('button')
      btnImg.type='button'
      btnImg.setAttribute('data-pw-seo-insert-image','1')
      btnImg.className='pw-article-editor-secondary'
      btnImg.textContent=COPY.infoSeoInsertImage||'Image'
      btnImg.addEventListener('click',function(ev){
        try{ev.preventDefault();ev.stopPropagation()}catch(eI){}
        post('infoArticleInsertImage',{})
      })
      var colorWrap=document.createElement('label')
      colorWrap.className='pw-article-editor-field'
      colorWrap.appendChild(document.createTextNode((COPY.infoSeoColor||'Color')+' '))
      var colorInput=document.createElement('input')
      colorInput.type='color'
      colorInput.value='#111827'
      colorInput.addEventListener('input',function(){
        var target=pickArticleTextTarget()
        if(!target)return
        if(selected!==target)selectEl(target)
        target.style.color=colorInput.value
        post('dirty',{})
        refreshSelect()
      })
      colorWrap.appendChild(colorInput)
      var sizeWrap=document.createElement('label')
      sizeWrap.className='pw-article-editor-field'
      sizeWrap.appendChild(document.createTextNode((COPY.infoSeoSize||'Size')+' '))
      var sizeInput=document.createElement('input')
      sizeInput.type='range'
      sizeInput.min='12'
      sizeInput.max='48'
      sizeInput.value='16'
      sizeInput.addEventListener('input',function(){
        var target=pickArticleTextTarget()
        if(!target)return
        if(selected!==target)selectEl(target)
        target.style.fontSize=String(sizeInput.value)+'px'
        post('dirty',{})
        refreshSelect()
      })
      sizeWrap.appendChild(sizeInput)
      var btnMore=document.createElement('button')
      btnMore.type='button'
      btnMore.className='pw-article-editor-secondary'
      btnMore.setAttribute('data-pw-seo-notes-toggle','1')
      btnMore.textContent=COPY.infoSeoMore||'Notes'
      var more=document.createElement('div')
      more.className='pw-article-editor-more'
      more.setAttribute('data-pw-seo-notes-panel','1')
      more.hidden=true
      var ta=document.createElement('textarea')
      ta.setAttribute('rows','2')
      ta.setAttribute('placeholder',COPY.infoSeoPlaceholder||'')
      ta.value=String(region.getAttribute('data-pw-seo-notes')||'')
      ta.addEventListener('input',function(){
        region.setAttribute('data-pw-seo-notes',String(ta.value||''))
        post('infoSeoNotes',{notes:String(ta.value||'')})
      })
      more.appendChild(ta)
      btnMore.addEventListener('click',function(ev){
        try{ev.preventDefault();ev.stopPropagation()}catch(eM){}
        var open=!more.hidden
        more.hidden=open
        btnMore.textContent=open?(COPY.infoSeoMore||'Notes'):(COPY.infoSeoLess||'Less')
        if(!open){try{ta.focus()}catch(eF){}}
      })
      row.appendChild(title)
      row.appendChild(btnAi)
      row.appendChild(btnUndo)
      row.appendChild(btnImg)
      row.appendChild(colorWrap)
      row.appendChild(sizeWrap)
      row.appendChild(btnMore)
      editor.appendChild(row)
      editor.appendChild(more)
    }else{
      var ta2=editor.querySelector('textarea')
      if(ta2&&!String(ta2.value||'').trim()){
        ta2.value=String(region.getAttribute('data-pw-seo-notes')||'')
      }
      if(editor.querySelector('.pw-article-editor-head')||editor.querySelector('.pw-seo-coach-hint')||editor.querySelector('.pw-seo-coach-sync')){
        try{if(editor.parentNode)editor.parentNode.removeChild(editor)}catch(eKill){}
        return ensureInfoSeoCoach()
      }
    }
    pinInfoArticleEditor(editor, parts)
    forceShowInfoArticleEditor(editor)
    if(parts.body){
      parts.body.setAttribute('data-pw-article-box','1')
    }
    updateInfoArticleUndoBtn()
    post('infoSeoNotes',{notes:String(region.getAttribute('data-pw-seo-notes')||'')})
    return editor
  }
  function setInfoPageContent(d){
    d=d||{}
    var parts=ensureInfoArticle()
    if(!parts)return
    var title=String(d.title||'').trim()
    if(title)parts.h1.textContent=title
    var paras=Array.isArray(d.paragraphs)?d.paragraphs:[]
    if(paras.length){
      var html=''
      for(var i=0;i<paras.length;i++){
        var t=String(paras[i]||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        if(t)html+='<p data-pw-el="body">'+t+'</p>'
      }
      if(html)parts.body.innerHTML=html
    }
    var seoTitle=String(d.seoTitle||title||'').trim()
    var seoDesc=String(d.seoDescription||'').trim()
    if(seoTitle){
      var titleEl=document.querySelector('title')
      if(titleEl)titleEl.textContent=seoTitle
    }
    if(seoDesc){
      parts.region.setAttribute('data-pw-seo-description',seoDesc)
      var meta=document.querySelector('meta[name="description"]')
      if(!meta){
        meta=document.createElement('meta')
        meta.setAttribute('name','description')
        if(document.head)document.head.appendChild(meta)
      }
      meta.setAttribute('content',seoDesc)
    }
    var keywords=Array.isArray(d.keywords)?d.keywords:[]
    if(keywords.length){
      var kw=keywords.map(function(k){return String(k||'').trim()}).filter(Boolean).join(', ')
      if(kw){
        parts.region.setAttribute('data-pw-seo-keywords',kw)
        var metaKw=document.querySelector('meta[name="keywords"]')
        if(!metaKw){
          metaKw=document.createElement('meta')
          metaKw.setAttribute('name','keywords')
          if(document.head)document.head.appendChild(metaKw)
        }
        metaKw.setAttribute('content',kw)
      }
    }
    ensureInfoSeoCoach()
    updateInfoArticleUndoBtn()
    removeStrayInfoArticles(parts.region)
    post('dirty',{})
    refreshSelect()
  }
  function isProductActionChromeKind(kind) {
    return kind === 'try-on' || kind === 'favorite-product' || kind === 'add-cart' || kind === 'buy-now'
  }
  function isProductHostChromeKind(kind) {
    return kind === 'favorite-product' || kind === 'add-cart' || kind === 'buy-now'
  }
  function productActionChromeOf(el) {
    if (!el || !el.closest) return null
    return el.closest('[data-pw-chrome-btn="favorite-product"],[data-pw-chrome-btn="try-on"],[data-pw-chrome-btn="add-cart"],[data-pw-chrome-btn="buy-now"]')
  }
  function isProductPage() {
    var root = document.querySelector('[data-pw-page],body')
    if (root && root.getAttribute && root.getAttribute('data-pw-page') === 'product') return true
    return !!(document.querySelector('.pw-pdp, [data-pw-region="pdp-info"], [data-pw-region="gallery"]'))
  }
  function listProductCards() {
    var seen = []
    var nodes = scopedQueryAll(
      '[data-pw-region="catalog"] [data-pw-el="card"], [data-pw-catalog] [data-pw-el="card"], [data-pw-region="catalog"] .pw-product-card, [data-pw-catalog] .pw-product-card, [data-pw-region="catalog"] .pw-shop-card, [data-pw-catalog] .pw-shop-card'
    )
    for (var i = 0; i < nodes.length; i++) {
      if (seen.indexOf(nodes[i]) >= 0) continue
      seen.push(nodes[i])
    }
    return seen
  }
  function listCatalogHosts() {
    var seen = []
    var nodes = scopedQueryAll('[data-pw-catalog], [data-pw-region="catalog"]')
    for (var i = 0; i < nodes.length; i++) {
      if (seen.indexOf(nodes[i]) >= 0) continue
      seen.push(nodes[i])
    }
    return seen
  }
  function cloneWidgetNode(html) {
    var wrap = document.createElement('div')
    wrap.innerHTML = String(html || '')
    return wrap.firstElementChild
  }
  function productHostCardAttr(kind) {
    if (kind === 'favorite-product') return 'data-pw-card-favorite'
    if (kind === 'add-cart') return 'data-pw-card-add-cart'
    if (kind === 'buy-now') return 'data-pw-card-buy-now'
    return ''
  }
  function productHostPdpAttr(kind) {
    if (kind === 'favorite-product') return 'data-pw-pdp-favorite'
    if (kind === 'add-cart') return 'data-pw-pdp-add-cart'
    if (kind === 'buy-now') return 'data-pw-pdp-buy-now'
    return ''
  }
  function productHostTplAttr(kind) {
    if (kind === 'favorite-product') return 'data-pw-card-favorite-tpl'
    if (kind === 'add-cart') return 'data-pw-card-add-cart-tpl'
    if (kind === 'buy-now') return 'data-pw-card-buy-now-tpl'
    return ''
  }
  function seatFavoriteOnCard(card, node) {
    if (!card || !node) return
    var media = card.querySelector
      ? card.querySelector('[data-pw-el="card-media"], .pw-product-card-media, .pw-shop-card-media')
      : null
    var hostEl = media || card
    try {
      if (hostEl && hostEl.style && window.getComputedStyle(hostEl).position === 'static') hostEl.style.position = 'relative'
    } catch (errPos) {}
    hostEl.appendChild(node)
    var id = (card.getAttribute('data-inventory-id') || card.getAttribute('data-pw-inventory-id') || '').trim()
    if (id && node.setAttribute) node.setAttribute('data-inventory-id', id)
    if (node.setAttribute) node.setAttribute('data-pw-card-favorite', '1')
    sizeChromeIcons(node)
  }
  function seatProductActionOnCard(card, node, kind) {
    if (!card || !node) return
    if (kind === 'favorite-product') {
      seatFavoriteOnCard(card, node)
      return
    }
    var cardAttr = productHostCardAttr(kind)
    var actions = card.querySelector
      ? card.querySelector('.pw-shop-action-bar, [data-pw-el="card-cart"], [data-pw-el="card-buy"]')
      : null
    var hostEl = actions && actions.parentNode ? actions.parentNode : card
    hostEl.appendChild(node)
    var id = (card.getAttribute('data-inventory-id') || card.getAttribute('data-pw-inventory-id') || '').trim()
    if (id && node.setAttribute) node.setAttribute('data-inventory-id', id)
    if (cardAttr && node.setAttribute) node.setAttribute(cardAttr, '1')
    sizeChromeIcons(node)
  }
  function stampCatalogProductHost(catalog, widgetHtml, kind) {
    if (!catalog || !catalog.setAttribute) return
    var cardAttr = productHostCardAttr(kind)
    var tplAttr = productHostTplAttr(kind)
    if (cardAttr) catalog.setAttribute(cardAttr, '1')
    var tpl = catalog.querySelector && tplAttr ? catalog.querySelector('template[' + tplAttr + ']') : null
    if (!tpl) {
      tpl = document.createElement('template')
      if (tplAttr) tpl.setAttribute(tplAttr, '1')
      catalog.appendChild(tpl)
    }
    tpl.innerHTML = String(widgetHtml || '')
  }
  function unstampCatalogProductHost(kind) {
    var cardAttr = productHostCardAttr(kind)
    var tplAttr = productHostTplAttr(kind)
    var catalogs = listCatalogHosts()
    for (var i = 0; i < catalogs.length; i++) {
      if (cardAttr) catalogs[i].removeAttribute(cardAttr)
      var tpl = catalogs[i].querySelector && tplAttr ? catalogs[i].querySelector('template[' + tplAttr + ']') : null
      if (tpl && tpl.parentNode) tpl.parentNode.removeChild(tpl)
    }
  }
  function insertProductHostWidget(kind, html) {
    var cards = listProductCards()
    var pdp = isProductPage()
    if (!cards.length && !pdp) {
      post('favoriteNeedHost', {})
      return
    }
    var cardAttr = productHostCardAttr(kind)
    var pdpAttr = productHostPdpAttr(kind)
    var first = null
    if (cards.length) {
      var catalogs = listCatalogHosts()
      for (var c = 0; c < catalogs.length; c++) stampCatalogProductHost(catalogs[c], html, kind)
      var existingCardSel = '[data-pw-chrome-btn="' + kind + '"]' + (cardAttr ? '[' + cardAttr + '="1"]' : '')
      var existingCardBtns = document.querySelectorAll(existingCardSel)
      for (var r = 0; r < existingCardBtns.length; r++) {
        if (existingCardBtns[r].parentNode) existingCardBtns[r].parentNode.removeChild(existingCardBtns[r])
      }
      for (var i = 0; i < cards.length; i++) {
        var node = cloneWidgetNode(html)
        if (!node) continue
        if (node.setAttribute) node.setAttribute('data-pw-device', pwStampDevice())
        seatProductActionOnCard(cards[i], node, kind)
        if (!first) first = node
      }
    }
    if (pdp) {
      var existingPdp = pdpAttr ? document.querySelector('[data-pw-chrome-btn="' + kind + '"][' + pdpAttr + '="1"]') : null
      var pdpNode = cloneWidgetNode(html)
      if (pdpNode) {
        if (pdpNode.setAttribute) {
          pdpNode.setAttribute('data-pw-device', pwStampDevice())
          if (pdpAttr) pdpNode.setAttribute(pdpAttr, '1')
        }
        var info = scopedQuery('[data-pw-region="pdp-info"], .pw-pdp-actions, .pw-pdp-sticky-nav, .pw-pdp-sticky')
        if (info) info.appendChild(pdpNode)
        else document.body.appendChild(pdpNode)
        sizeChromeIcons(pdpNode)
        if (existingPdp && existingPdp.parentNode) existingPdp.parentNode.removeChild(existingPdp)
        parkChromeAtViewportCenter(pdpNode, kind)
        return
      }
    }
    if (first) {
      selectEl(first)
      post('dirty', {})
    }
  }
  function insertFavoriteProductWidget(html) {
    insertProductHostWidget('favorite-product', html)
  }
  function removeSyncedFavoriteProduct(el) {
    return removeSyncedProductHost(el)
  }
  function removeSyncedProductHost(el) {
    if (!el) return false
    var kind = chromeKindOf(el)
    if (!isProductHostChromeKind(kind)) return false
    var cardAttr = productHostCardAttr(kind)
    var pdpAttr = productHostPdpAttr(kind)
    var onCard = !!(el.closest && el.closest('[data-pw-el="card"], .pw-product-card, .pw-shop-card'))
    var pdp = el.getAttribute && pdpAttr && el.getAttribute(pdpAttr) === '1'
    if (onCard) {
      var cardSel = '[data-pw-chrome-btn="' + kind + '"]' + (cardAttr ? '[' + cardAttr + '="1"]' : '')
      var cardBtns = document.querySelectorAll(cardSel)
      for (var i = 0; i < cardBtns.length; i++) {
        if (cardBtns[i].parentNode) cardBtns[i].parentNode.removeChild(cardBtns[i])
      }
      unstampCatalogProductHost(kind)
      return true
    }
    if (pdp) {
      var pdpSel = '[data-pw-chrome-btn="' + kind + '"]' + (pdpAttr ? '[' + pdpAttr + '="1"]' : '')
      var pdpBtns = document.querySelectorAll(pdpSel)
      for (var j = 0; j < pdpBtns.length; j++) {
        if (pdpBtns[j].parentNode) pdpBtns[j].parentNode.removeChild(pdpBtns[j])
      }
      return true
    }
    return false
  }
  function insertChromeBtn(kind, html, host, opts) {
    var k = String(kind || '').replace(/[^a-z0-9-]/g, '')
    if (!k || !html) return
    if (isProductHostChromeKind(k)) {
      insertProductHostWidget(k, html)
      return
    }
    var force = !!(opts && (opts.force || opts.atCenter))
    var atCenter = !!(opts && opts.atCenter)
    var existingNow = findExistingChrome(k)
    if (existingNow && !force) {
      post('chromeDuplicateAsk', { kind: k })
      return
    }
    var wrap = document.createElement('div')
    wrap.innerHTML = String(html)
    var node = wrap.firstElementChild
    if (!node) return
    var place = String(host || '')
    if (place !== 'topbar' && place !== 'nav' && place !== 'mid' && place !== 'float') place = 'actions'
    if (isChromeFloatKind(k)) place = 'float'
    var hostEl = ensureChromeHost(place)
    if (k === 'categories') {
      if (place === 'actions') {
        var cluster = scopedQuery('.pw-brand-cluster, .pw-shop-brand-cluster')
        hostEl = cluster || scopedQuery('.pw-header-main, .pw-shop-header-inner') || hostEl
      }
      var panel = scopedQuery('#pw-shop-cat-panel, #pw-cat-panel, [data-pw-cat-panel], .pw-shop-cat-panel, .pw-cat-panel')
      var catBtn = node.querySelector
        ? node.querySelector(
            '[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn="categories"]'
          )
        : null
      if (
        !catBtn &&
        node.getAttribute &&
        (node.getAttribute('data-pw-cat-toggle') ||
          node.getAttribute('data-pw-el') === 'cat-toggle' ||
          node.getAttribute('data-pw-chrome-btn') === 'categories')
      ) {
        catBtn = node
      }
      if (panel && catBtn && catBtn.setAttribute) {
        catBtn.setAttribute('aria-controls', panel.id || 'pw-shop-cat-panel')
        var nestedPanel = node.querySelector
          ? node.querySelector('[data-pw-cat-panel],.pw-cat-panel,.pw-shop-cat-panel')
          : null
        if (nestedPanel && nestedPanel.parentNode) nestedPanel.parentNode.removeChild(nestedPanel)
      } else if (catBtn && catBtn.setAttribute && !panel) {
        var wrapPanel = node.querySelector
          ? node.querySelector('[data-pw-cat-panel],.pw-cat-panel,.pw-shop-cat-panel')
          : null
        if (wrapPanel && wrapPanel.id) catBtn.setAttribute('aria-controls', wrapPanel.id)
      }
    }
    if (k === 'account') {
      var accPanel = scopedQuery(
        '#pw-shop-account-panel, #pw-account-panel, [data-pw-account-panel], .pw-shop-account-panel, .pw-account-panel'
      )
      var accBtn = node.querySelector
        ? node.querySelector('[data-pw-account-toggle],[data-pw-chrome-btn="account"],.pw-account-btn')
        : null
      if (
        !accBtn &&
        node.getAttribute &&
        (node.getAttribute('data-pw-account-toggle') || node.getAttribute('data-pw-chrome-btn') === 'account')
      ) {
        accBtn = node
      }
      if (accPanel && accBtn && accBtn.setAttribute) {
        accBtn.setAttribute('aria-controls', accPanel.id || 'pw-shop-account-panel')
        var nestedAcc = node.querySelector
          ? node.querySelector('[data-pw-account-panel],.pw-account-panel,.pw-shop-account-panel')
          : null
        if (nestedAcc && nestedAcc.parentNode) nestedAcc.parentNode.removeChild(nestedAcc)
      }
    }
    if (k === 'search') {
      if (place === 'actions') {
        hostEl = scopedQuery('.pw-header-main, .pw-shop-header-inner') || hostEl
      }
    }
    var href = node.getAttribute ? (node.getAttribute('href') || '') : ''
    if (!force && place === 'topbar' && href) {
      var links = scopedQueryAll('.pw-topbar a, .pw-topbar-inner a')
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
    if (node.setAttribute) node.setAttribute('data-pw-device', pwStampDevice())
    if (isChromeFloatKind(k)) {
      try { document.body.appendChild(node) } catch (errFloatInsert) {}
      releaseChromeFloatPin(node)
      sizeChromeIcons(node)
      pinChromeIconBadges(node)
      if (k === 'topup' && node.classList) node.classList.add('pw-chrome-topup-on')
      if (atCenter) parkChromeAtViewportCenter(node, k)
      else {
        selectEl(node)
        post('dirty', {})
      }
      return
    }
    if (k === 'search') {
      var searchActions = hostEl.querySelector
        ? hostEl.querySelector('.pw-header-actions, .pw-shop-header-actions')
        : null
      if (searchActions && searchActions.parentNode === hostEl) hostEl.insertBefore(node, searchActions)
      else hostEl.appendChild(node)
    } else if (k === 'search-image') {
      var searchForm = scopedQuery('.pw-search-form, .pw-shop-search-form, form[data-pw-search-form]')
      if (searchForm) {
        var searchSubmit = searchForm.querySelector('.pw-search-submit, .pw-shop-search-submit, button[type="submit"]')
        if (searchSubmit) searchForm.insertBefore(node, searchSubmit)
        else searchForm.appendChild(node)
      } else {
        hostEl.appendChild(node)
      }
    } else {
      hostEl.appendChild(node)
    }
    sizeChromeIcons(node)
    pinChromeIconBadges(node)
    if (k === 'search') {
      ensureSearchSubmitIcon(node)
      lockSearchBox(node, defaultSearchBoxWidth())
      try { ensureSearchVisible() } catch (errSearchSeat) {}
    }
    if (k === 'chat') applyChatLogoToChromeBtn(node, chatPrepLogoUrl)
    try { pwApplyDemoChromeCountBadges(document) } catch (errDemoBtn) {}
    if (atCenter) parkChromeAtViewportCenter(node, k)
    else {
      selectEl(node)
      post('dirty', {})
    }
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
  function isChromeTextTrap(el) {
    if (!el) return false
    if (catToggleElOf(el) || isCatToggleEl(el) || chromeBtnElOf(el) || isChromeBtn(el) || isHeaderWidget(el) || isSearchEl(el)) return true
    return !!(el.closest && el.closest('[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn],header,.pw-header,.pw-shop-header'))
  }
  function insertTextHost() {
    var root = visibleVisualRoot()
    if (selected && isChromeTextTrap(selected)) return insertButtonHost()
    var fromSel = selected ? findContentBlockEl(selected) : null
    if (fromSel && root.contains(fromSel) && !isChromeBlock(fromSel) && !isChromeTextTrap(fromSel)) return fromSel
    return insertButtonHost()
  }
  function insertBgHost() {
    return addedBgContentHost()
  }
  function insertBg(opts) {
    var now = Date.now()
    var sharedAt = 0
    try { sharedAt = Number(window.__nanoaiVeInsertBgAt) || 0 } catch (eLock) { sharedAt = lastInsertBgAt }
    if (now - sharedAt < 800 || now - lastInsertBgAt < 800) return
    lastInsertBgAt = now
    try { window.__nanoaiVeInsertBgAt = now } catch (eSet) {}
    var host = insertBgHost()
    if (!host) return
    ensureOverlayHost(host)
    ensureBgStack()
    var color = opts && opts.color ? String(opts.color) : '#f3f4f6'
    if (!color) color = '#f3f4f6'
    var node = document.createElement('div')
    node.setAttribute('data-pw-added-bg', '1')
    node.setAttribute('data-pw-edit', '1')
    var hr = host.getBoundingClientRect()
    var hostW = Math.max(80, hr.width)
    var w = Math.max(80, Math.round(hostW * 0.7))
    var h = 120
    var left = Math.max(0, Math.round((hostW - w) / 2))
    var top = Math.max(8, Math.round(-hr.top + 72))
    if (top + h > hr.height - 8) top = Math.max(8, hr.height - h - 8)
    var twins = host.querySelectorAll('[data-pw-added-bg="1"]')
    for (var bgTwinI = 0; bgTwinI < twins.length; bgTwinI++) {
      var twin = twins[bgTwinI]
      if (Math.abs((parseFloat(twin.style.left) || 0) - left) > 2) continue
      if (Math.abs((parseFloat(twin.style.top) || 0) - top) > 2) continue
      if (Math.abs((parseFloat(twin.style.width) || 0) - w) > 2) continue
      if (Math.abs((parseFloat(twin.style.height) || 0) - h) > 2) continue
      return
    }
    var stack = listBgStack()
    for (var si = 0; si < stack.length; si++) {
      if (stack[si].index >= 1) stack[si].el.setAttribute('data-pw-bg-index', String(stack[si].index + 1))
    }
    applyAddedBgLayer(node, 1)
    node.style.position = 'absolute'
    node.style.left = left + 'px'
    node.style.top = top + 'px'
    node.style.width = w + 'px'
    node.style.height = h + 'px'
    node.style.background = color
    node.style.border = '0'
    node.style.pointerEvents = 'auto'
    node.style.boxSizing = 'border-box'
    host.appendChild(node)
    ensureBgStack()
    selectEl(node)
    post('dirty', {})
  }
  function bringAddedBgFront() {
    stepBgStack(1)
  }
  function sendAddedBgBack() {
    stepBgStack(-1)
  }
  function layerAddedBg(dir) {
    stepBgStack(dir)
  }
  function layerUnitOf(el) {
    if (!el) return null
    if (isAddedOverlay(el)) return el
    if (isAddedBg(el)) return el
    if (isLogoTarget(el) || isLogoFrame(el) || (el.getAttribute && el.getAttribute('data-pw-logo-float') === '1')) {
      return logoFrameOf(el) || headerLogoUnit(el) || logoImgOf(el) || el
    }
    if (isSearchEl(el)) return el
    return el
  }
  function isFullBleedChrome(el) {
    if (!el || !el.getAttribute) return false
    var cls = clsOf(el)
    if (cls.indexOf('pw-header-main') >= 0 || cls.indexOf('pw-shop-header-inner') >= 0) return true
    if (cls.indexOf('pw-topbar') >= 0 || cls.indexOf('pw-container') >= 0) return true
    if (el.matches && el.matches('header, .pw-header, .pw-shop-header, .pw-header-main, .pw-shop-header-inner, .pw-topbar, .pw-shop-topbar')) return true
    return false
  }
  function isLogoLayerUnit(el) {
    return !!(el && (isLogoTarget(el) || isLogoFrame(el) || (el.getAttribute && el.getAttribute('data-pw-logo-float') === '1')))
  }
  function layerPromoteHost(el) {
    var unit = layerUnitOf(el)
    if (!unit) return null
    if (isAddedOverlay(unit)) return unit
    if (isLogoLayerUnit(unit)) return unit
    if (isFullBleedChrome(unit)) return unit
    var bottomNav = unit.closest ? unit.closest('.pw-bottom-nav, .pw-shop-bottom-nav') : null
    if (bottomNav) return bottomNav
    var header = unit.closest ? unit.closest('header, .pw-header, .pw-shop-header') : null
    if (header) {
      var main = header.querySelector ? (header.querySelector('.pw-header-main, .pw-shop-header-inner') || header) : header
      var walk = unit
      while (walk && walk !== main && walk.parentElement && walk.parentElement !== main && walk.parentElement !== header) {
        walk = walk.parentElement
      }
      if (walk && walk !== main && walk !== header && !isFullBleedChrome(walk)) {
        var walkCls = clsOf(walk)
        if (walkCls.indexOf('pw-brand-cluster') >= 0 || walkCls.indexOf('pw-shop-brand-cluster') >= 0) return unit
        return walk
      }
    }
    var region = unit.closest ? unit.closest('[data-pw-region], .pw-hero, .pw-banner, footer, .pw-footer, main, .pw-shop-main') : null
    if (region && region !== unit && !isFullBleedChrome(region)) {
      var host = unit
      while (host && host.parentElement && host.parentElement !== region) host = host.parentElement
      if (host && host !== region && !isFullBleedChrome(host)) return host
    }
    return unit
  }
  function readUserZ(el) {
    if (!el) return 0
    var attr = el.getAttribute ? el.getAttribute('data-pw-z') : ''
    if (attr != null && String(attr).trim() !== '') {
      var n = parseInt(attr, 10)
      if (isFinite(n)) return n
    }
    try {
      var z = parseInt(cs(el).zIndex, 10)
      if (isFinite(z)) return z
    } catch (errZ) {}
    var inline = el.style ? parseInt(el.style.zIndex || '', 10) : NaN
    return isFinite(inline) ? inline : 0
  }
  function writeUserZ(el, z) {
    if (!el || isFullBleedChrome(el) || isChromeFloatEl(el)) return
    var n = Math.max(0, Math.min(SCENE.zMax, Math.round(Number(z) || 0)))
    el.setAttribute('data-pw-z', String(n))
    try {
      var pos = cs(el).position
      if (pos !== 'absolute' && pos !== 'fixed' && pos !== 'sticky' && (!pos || pos === 'static')) {
        el.style.position = 'relative'
      }
    } catch (errPos) {}
    el.style.setProperty('z-index', String(n), 'important')
  }
  function sceneClampIndex(index) {
    var n = Math.round(Number(index))
    if (!isFinite(n)) return SCENE.defaultIndex
    return Math.min(SCENE.maxIndex, Math.max(SCENE.minIndex, n))
  }
  function sceneIndexOfZ(z) {
    var n = Number(z)
    if (!isFinite(n)) return SCENE.defaultIndex
    return sceneClampIndex(Math.floor(Math.max(0, n) / SCENE.band))
  }
  function sceneLocalOfZ(z) {
    var n = Number(z)
    if (!isFinite(n) || n <= 0) return 0
    var capped = Math.min(SCENE.zMax, Math.round(n))
    return Math.min(SCENE.localMax, capped - sceneIndexOfZ(capped) * SCENE.band)
  }
  function sceneZ(index, local) {
    var l = Math.min(SCENE.localMax, Math.max(0, Math.round(Number(local) || 0)))
    return sceneClampIndex(index) * SCENE.band + l
  }
  /** Lớp của phần tử — theo cả trang, không theo vùng cha. */
  function readSceneIndex(el) {
    if (!el || !el.getAttribute) return SCENE.defaultIndex
    var raw = el.getAttribute(SCENE.attr)
    if (raw != null && String(raw).trim() !== '') {
      var n = parseInt(raw, 10)
      if (isFinite(n) && n >= SCENE.minIndex && n <= SCENE.maxIndex) return n
    }
    // Logo header dùng z-index 120 để xếp chồng chrome — không suy ra lớp không gian từ đó.
    if (isLogoLayerUnit(el) && isInHeader(el)) return SCENE.defaultIndex
    return sceneIndexOfZ(readUserZ(el))
  }
  function writeSceneIndex(el, index) {
    if (!el || isFullBleedChrome(el) || isChromeFloatEl(el)) return
    var i = sceneClampIndex(index)
    el.setAttribute(SCENE.attr, String(i))
    writeUserZ(el, sceneZ(i, sceneLocalOfZ(readUserZ(el))))
  }
  function sceneLayerPos(index) {
    var i = sceneClampIndex(index)
    // Lớp dưới (1) là thấp nhất phần tử được đặt — nền (0) không nhận phần tử rời.
    if (i <= SCENE.minIndex + 1) return 'bottom'
    if (i >= SCENE.maxIndex) return 'top'
    return 'middle'
  }
  /** Chọn lớp để bấm: chỉ phần tử trên lớp đó nhận chuột. */
  function sceneFocusAllows(el) {
    if (sceneFocus < SCENE.minIndex) return true
    if (!el) return false
    if (isLogoLayerUnit(el) && isInHeader(el)) return true
    return readSceneIndex(el) === sceneFocus
  }
  function setSceneFocus(index) {
    var n = Math.round(Number(index))
    sceneFocus = isFinite(n) && n >= SCENE.minIndex && n <= SCENE.maxIndex ? n : -1
    post('scene', { focus: sceneFocus })
  }
  function setElementScene(index) {
    if (!selected) return
    if (isChromeFloatEl(selected)) return
    var el = isAddedOverlay(selected) ? selected : layerPromoteHost(selected)
    if (!el || isChromeFloatEl(el)) return
    // Lớp nền (0) chỉ là mặt đất — không đặt phần tử rời lên đó.
    var i = sceneClampIndex(index)
    if (i <= SCENE.minIndex) i = SCENE.minIndex + 1
    writeSceneIndex(el, i)
    revealLayeredLogo(el)
    revealLayeredLogo(selected)
    post('dirty', {})
    refreshSelect()
  }
  function stepElementScene(dir) {
    if (!selected) return
    var el = isAddedOverlay(selected) ? selected : layerPromoteHost(selected)
    if (!el) return
    var next = readSceneIndex(el) + (Number(dir) > 0 ? 1 : -1)
    if (next <= SCENE.minIndex || next > SCENE.maxIndex) return
    setElementScene(next)
  }
  function revealLayeredLogo(el) {
    if (!isLogoLayerUnit(el)) return
    var unit = logoFrameOf(el) || headerLogoUnit(el) || el
    if (unit && unit.style) {
      unit.style.setProperty('opacity', '1', 'important')
      unit.style.setProperty('visibility', 'visible', 'important')
      if (cs(unit).display === 'none') unit.style.setProperty('display', 'inline-block', 'important')
      var host = headerLogoHost(unit)
      if (host) {
        if (unit.parentNode !== host) {
          try { pinHeaderLogoFloat(unit, null) } catch (errPinReveal) {}
        } else {
          host.appendChild(unit)
        }
      }
    }
    var img = logoImgOf(el) || (isLogoImg(el) ? el : null)
    if (img && img.style) {
      img.style.setProperty('opacity', '1', 'important')
      img.style.setProperty('visibility', 'visible', 'important')
      img.style.setProperty('display', 'block', 'important')
    }
  }
  function applyDefaultZ(el, fallback) {
    if (!el) return
    if (el.getAttribute && el.getAttribute('data-pw-z')) writeUserZ(el, readUserZ(el))
    else if (el.getAttribute && el.getAttribute(SCENE.attr)) writeSceneIndex(el, readSceneIndex(el))
    else el.style.setProperty('z-index', String(fallback), 'important')
  }
  /** Gắn lại z đã lưu sau stamp banner — không để editor CSS/z=2 che chữ nổi. */
  function restoreAuthoredLayers() {
    var nodes = document.querySelectorAll('[data-pw-z],[' + SCENE.attr + ']')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      if (!el || isFullBleedChrome(el)) continue
      if (el.getAttribute(SCENE.attr)) writeSceneIndex(el, readSceneIndex(el))
      else writeUserZ(el, readUserZ(el))
    }
  }
  function layerPeers(el) {
    if (!el) return []
    if (isAddedOverlay(el)) {
      var overlays = document.querySelectorAll('[data-pw-added-text="1"],[data-pw-added-btn="1"]')
      var only = []
      for (var o = 0; o < overlays.length; o++) {
        if (!overlays[o] || isIgnored(overlays[o])) continue
        only.push(overlays[o])
      }
      return only.length ? only : [el]
    }
    var header = el.closest ? el.closest('header, .pw-header, .pw-shop-header') : null
    if (header) {
      var main = header.querySelector ? (header.querySelector('.pw-header-main, .pw-shop-header-inner') || header) : header
      var out = []
      var kids = main.children || []
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i]
        if (!k || k.nodeType !== 1 || isIgnored(k) || isFullBleedChrome(k)) continue
        if (isLogoLayerUnit(el) && (k === el || (k.contains && k.contains(el)))) continue
        out.push(k)
      }
      var floats = header.querySelectorAll('[data-pw-logo-float="1"], [data-pw-logo-frame="1"], .pw-logo-frame')
      for (var f = 0; f < floats.length; f++) {
        if (isIgnored(floats[f]) || out.indexOf(floats[f]) >= 0) continue
        out.push(floats[f])
      }
      if (isLogoLayerUnit(el) && out.indexOf(el) < 0) out.push(el)
      return out.length ? out : [el]
    }
    var parent = el.parentElement
    if (!parent || !parent.children) return [el]
    var sibs = []
    var all = parent.children
    for (var s = 0; s < all.length; s++) {
      if (!all[s] || all[s].nodeType !== 1 || isIgnored(all[s]) || isFullBleedChrome(all[s])) continue
      sibs.push(all[s])
    }
    return sibs.length ? sibs : [el]
  }
  function listLayerPack(el) {
    var host = layerPromoteHost(el)
    if (!host) return { host: null, items: [], idx: -1 }
    var peers = layerPeers(host)
    var items = []
    for (var i = 0; i < peers.length; i++) {
      items.push({ el: peers[i], z: readUserZ(peers[i]), i: i })
    }
    items.sort(function (a, b) {
      if (a.z !== b.z) return a.z - b.z
      return a.i - b.i
    })
    var idx = -1
    for (var j = 0; j < items.length; j++) if (items[j].el === host) idx = j
    return { host: host, items: items, idx: idx }
  }
  function elementLayerPos(el) {
    var pack = listLayerPack(el)
    if (!pack.host || pack.items.length <= 1 || pack.idx < 0) return 'only'
    if (pack.idx === pack.items.length - 1) return 'top'
    if (pack.idx === 0) return 'bottom'
    return 'middle'
  }
  function peerZRange(el) {
    var peers = layerPeers(el)
    var min = readUserZ(el)
    var max = min
    for (var i = 0; i < peers.length; i++) {
      var z = readUserZ(peers[i])
      if (z < min) min = z
      if (z > max) max = z
    }
    return { min: min, max: max }
  }
  function stepElementLayer(dir) {
    if (!selected) return
    if (isAddedBg(selected)) {
      stepBgStack(dir)
      return
    }
    if (isAddedOverlay(selected)) {
      var cur = readUserZ(selected)
      var nextZ = dir > 0 ? Math.min(400, Math.max(40, cur) + 1) : Math.max(40, cur - 1)
      writeUserZ(selected, nextZ)
      post('dirty', {})
      refreshSelect()
      return
    }
    var pack = listLayerPack(selected)
    if (!pack.host || pack.idx < 0) return
    var swap = pack.idx + (dir > 0 ? 1 : -1)
    if (swap < 0 || swap >= pack.items.length) return
    var a = pack.items[pack.idx]
    var b = pack.items[swap]
    if (a.z === b.z) {
      writeUserZ(a.el, dir > 0 ? a.z + 1 : Math.max(0, a.z - 1))
      writeUserZ(b.el, dir > 0 ? a.z : a.z + 1)
    } else {
      writeUserZ(a.el, b.z)
      writeUserZ(b.el, a.z)
    }
    revealLayeredLogo(a.el)
    revealLayeredLogo(selected)
    post('dirty', {})
    refreshSelect()
  }
  function bringElementFront() {
    if (!selected) return
    if (isAddedBg(selected)) {
      for (var i = 0; i < 40; i++) {
        var pos = addedBgLayerPos(selected)
        if (pos === 'top' || pos === 'only') break
        stepBgStack(1)
      }
      return
    }
    if (isAddedOverlay(selected)) {
      writeUserZ(selected, nextAddedOverlayZ())
      post('dirty', {})
      refreshSelect()
      return
    }
    var el = layerPromoteHost(selected)
    if (!el) return
    var front = Math.max(220, peerZRange(el).max + 1)
    writeUserZ(el, front)
    post('dirty', {})
    refreshSelect()
  }
  function sendElementBack() {
    if (!selected) return
    if (isAddedBg(selected)) {
      for (var j = 0; j < 40; j++) {
        var posB = addedBgLayerPos(selected)
        if (posB === 'bottom' || posB === 'only') break
        stepBgStack(-1)
      }
      return
    }
    if (isAddedOverlay(selected)) {
      writeUserZ(selected, 40)
      post('dirty', {})
      refreshSelect()
      return
    }
    var el = layerPromoteHost(selected)
    if (!el) return
    writeUserZ(el, 0)
    post('dirty', {})
    refreshSelect()
  }
  function insertText() {
    if (infoPageActive) {
      var parts = ensureInfoArticle()
      if (parts && parts.body) {
        var label = (COPY && COPY.addTextPlaceholder) ? String(COPY.addTextPlaceholder) : 'Text'
        var p = document.createElement('p')
        p.setAttribute('data-pw-el', 'body')
        p.setAttribute('data-pw-edit', '1')
        p.textContent = label
        parts.body.appendChild(p)
        selectEl(p)
        post('dirty', {})
        return
      }
    }
    var host = insertTextHost()
    if (!host) return
    var label2 = (COPY && COPY.addTextPlaceholder) ? String(COPY.addTextPlaceholder) : 'Text'
    var node = document.createElement('p')
    node.setAttribute('data-pw-added-text', '1')
    node.setAttribute('data-pw-edit', '1')
    node.textContent = label2
    node.style.display = 'inline-block'
    node.style.width = 'auto'
    node.style.maxWidth = '100%'
    node.style.margin = '0'
    node.style.padding = '0'
    node.style.fontSize = '22px'
    node.style.fontWeight = '700'
    node.style.lineHeight = '1.25'
    node.style.whiteSpace = 'nowrap'
    node.style.color = 'inherit'
    placeOverlayText(node, host)
    selectEl(node)
    post('dirty', {})
  }
  function insertArticleImage(url) {
    var src = String(url || '').trim()
    if (!src) return
    var parts = ensureInfoArticle()
    if (!parts || !parts.body) return
    var fig = document.createElement('figure')
    fig.setAttribute('data-pw-el', 'image')
    fig.setAttribute('data-pw-info-image', '1')
    fig.style.margin = '12px 0'
    fig.style.maxWidth = '100%'
    var img = document.createElement('img')
    img.setAttribute('data-pw-el', 'image')
    img.setAttribute('src', src)
    img.setAttribute('alt', '')
    img.style.display = 'block'
    img.style.width = '100%'
    img.style.maxWidth = '720px'
    img.style.height = 'auto'
    img.style.borderRadius = '8px'
    fig.appendChild(img)
    parts.body.appendChild(fig)
    selectEl(img)
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
  function overlayRoot() {
    return visibleVisualRoot() || document.body
  }
  function nextAddedOverlayZ() {
    var nodes = document.querySelectorAll('[data-pw-added-text="1"],[data-pw-added-btn="1"]')
    var max = 249
    for (var i = 0; i < nodes.length; i++) {
      var z = readUserZ(nodes[i])
      if (z > max) max = z
    }
    return Math.min(400, max + 1)
  }
  function ensureOverlayHost(host) {
    try {
      var pos = cs(host).position
      if (!pos || pos === 'static') host.style.position = 'relative'
    } catch (err) {}
  }
  function placeOverlayButton(el, host) {
    placeOverlayNode(el, host, 'btn')
  }
  function placeOverlayText(el, host) {
    placeOverlayNode(el, host, 'text')
  }
  function placeOverlayNode(el, host, kind) {
    if (!el) return
    var root = overlayRoot()
    var place = findBannerHost(root) || host || root
    if (!place) place = root
    ensureOverlayHost(root)
    el.style.position = 'absolute'
    el.style.margin = '0'
    el.style.left = '0'
    el.style.top = '0'
    el.style.transform = 'none'
    if (el.parentNode !== root) root.appendChild(el)
    writeUserZ(el, nextAddedOverlayZ())
    var pr = place.getBoundingClientRect()
    var rr = root.getBoundingClientRect()
    var er = el.getBoundingClientRect()
    var sel = kind === 'text' ? '[data-pw-added-text]' : '[data-pw-added-btn]'
    var n = root.querySelectorAll(sel).length
    var step = kind === 'text' ? 36 : 18
    var offset = Math.max(0, n - 1) * step
    var left = Math.round(pr.left - rr.left + (pr.width - er.width) / 2 + offset)
    var top = Math.round(pr.top - rr.top + (pr.height - er.height) / 2 + (kind === 'text' ? Math.round(offset * 0.35) : offset))
    el.style.left = Math.max(0, left) + 'px'
    el.style.top = Math.max(0, top) + 'px'
  }
  function pinOverlayAtRect(el, host) {
    if (!el) return
    var root = host || overlayRoot()
    ensureOverlayHost(root)
    var er = el.getBoundingClientRect()
    var hr = root.getBoundingClientRect()
    if (el.parentNode !== root) root.appendChild(el)
    el.style.position = 'absolute'
    el.style.margin = '0'
    el.style.transform = 'none'
    el.style.left = Math.round(er.left - hr.left) + 'px'
    el.style.top = Math.round(er.top - hr.top) + 'px'
    if (!el.getAttribute || !el.getAttribute('data-pw-z')) writeUserZ(el, nextAddedOverlayZ())
  }
  function freeAddedTextOverlays() {
    var root = overlayRoot()
    var nodes = document.querySelectorAll('[data-pw-added-text="1"],[data-pw-added-btn="1"]')
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i]
      var wrap = el.parentElement
      if (!wrap) continue
      var chromeTrap = catToggleElOf(el) || chromeBtnElOf(el)
      var trapped = Boolean(chromeTrap) || isMoveBlockEl(wrap) || isHeroInnerOrCopy(wrap) || pwElOf(wrap) === 'copy'
      var inBanner = !!(el.closest && el.closest('.pw-hero, .pw-banner, .pw-shop-hero, .pw-shop-banner, [data-pw-region="banner"]'))
      var glued = false
      try {
        var pos = cs(el).position
        glued = pos !== 'absolute' && pos !== 'fixed'
      } catch (errPos) { glued = true }
      if (wrap === root && !trapped && !glued && !inBanner) continue
      pinOverlayAtRect(el, root)
    }
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
    if (attr === 'icon' || attr === 'icon-square' || attr === 'icon-label' || attr === 'icon-label-below' || attr === 'icon-label-left' || attr === 'text') return attr
    var cls = clsOf(el)
    if (cls.indexOf('pw-chrome-link') >= 0) return 'text'
    if (cls.indexOf('pw-chrome-icon-square') >= 0) return 'icon-square'
    if (cls.indexOf('pw-chrome-icon-only') >= 0) return 'icon'
    if (cls.indexOf('pw-chrome-label-below') >= 0) return 'icon-label-below'
    if (cls.indexOf('pw-chrome-label-left') >= 0) return 'icon-label-left'
    if (cls.indexOf('pw-chrome-has-label') >= 0) return 'icon-label'
    var lab = el.querySelector ? el.querySelector('.pw-account-btn-label, .pw-chrome-btn-label, .pw-shop-nav-label') : null
    if (!lab && el.querySelector) {
      lab = el.querySelector(':scope > span:not(.pw-cart-badge):not(.pw-shop-cart-badge):not(.pw-chrome-icon-wrap)')
    }
    if (lab) {
      try {
        if (cs(lab).display === 'none') return 'icon'
      } catch (err) {}
      return 'icon-label'
    }
    if (el.querySelector && el.querySelector('svg') && String(el.textContent || '').replace(/\s+/g, ' ').trim()) return 'icon-label'
    return 'icon'
  }
  function chromeLabelText(el) {
    var lab = chromeLabelEl(el) || (el.querySelector ? el.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label, .pw-shop-search-submit-label') : null)
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
    var next =
      style === 'icon' ||
      style === 'icon-square' ||
      style === 'text' ||
      style === 'icon-label-below' ||
      style === 'icon-label-left'
        ? style
        : 'icon-label'
    var el = selected
    var labelText = chromeLabelText(el)
    var isAccount = clsOf(el).indexOf('pw-account-btn') >= 0 || !!(el.getAttribute && el.getAttribute('data-pw-account-toggle'))
    ensureChromeIconWrap(el)
    var labelEl = el.querySelector('.pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label')
    if (!labelEl && next !== 'icon' && next !== 'icon-square') {
      labelEl = document.createElement('span')
      labelEl.className = isAccount ? 'pw-account-btn-label' : 'pw-shop-nav-label pw-chrome-btn-label'
      labelEl.textContent = labelText || ' '
      el.appendChild(labelEl)
    }
    if (labelEl && labelText) labelEl.textContent = labelText
    var wrap = el.querySelector('.pw-chrome-icon-wrap')
    el.setAttribute('data-pw-chrome-style', next)
    if (!isAccount) {
      el.classList.remove(
        'pw-chrome-link',
        'pw-chrome-has-label',
        'pw-chrome-icon-only',
        'pw-chrome-icon-square',
        'pw-chrome-label-below',
        'pw-chrome-label-left'
      )
      if (next === 'text') {
        el.classList.add('pw-chrome-link')
        el.classList.remove('pw-icon-btn', 'pw-shop-icon-btn')
      } else {
        el.classList.add('pw-icon-btn', 'pw-shop-icon-btn')
        if (next === 'icon-square') el.classList.add('pw-chrome-icon-only', 'pw-chrome-icon-square')
        else if (next === 'icon') el.classList.add('pw-chrome-icon-only')
        else {
          el.classList.add('pw-chrome-has-label')
          if (next === 'icon-label-below') el.classList.add('pw-chrome-label-below')
          if (next === 'icon-label-left') el.classList.add('pw-chrome-label-left')
        }
      }
    }
    if (wrap) wrap.style.display = next === 'text' ? 'none' : ''
    if (labelEl) labelEl.style.display = next === 'icon' || next === 'icon-square' ? 'none' : ''
    if (labelText) {
      el.setAttribute('aria-label', labelText)
      el.setAttribute('title', labelText)
    }
    sizeChromeIcons(el)
    pinChromeIconBadges(el)
    var keepIcon = el.getAttribute('data-pw-icon-color') || ''
    if (keepIcon) applyWidgetIconColor(el, keepIcon)
    var keepText = el.getAttribute('data-pw-btn-text') || ''
    if (keepText) applyWidgetTextColor(el, keepText)
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
  function isWidgetSurfaceEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (clsOf(el).indexOf('pw-brand') >= 0 || clsOf(el).indexOf('pw-shop-brand') >= 0) return false
    if (isSearchSubmitEl(el) || searchSubmitElOf(el) === el) return true
    if (isSearchImageEl(el) || searchImageElOf(el) === el) return true
    if (isSearchEl(el) || searchElOf(el) === el) return true
    if (catToggleElOf(el) || isCatToggleEl(el)) return true
    if (fieldElOf(el) === el) return true
    if (badgeElOf(el) === el) return true
    if (isChromeBtn(el) || isAddedChrome(el)) return true
    if (isHeaderWidget(el)) return true
    return false
  }
  function widgetSurfaceEl(el) {
    if (!el) return null
    if (searchSubmitElOf(el) === el || isSearchSubmitEl(el)) return searchSubmitElOf(el) || el
    if (searchImageElOf(el) === el || isSearchImageEl(el)) return searchImageElOf(el) || el
    if (fieldElOf(el) === el) return el
    if (badgeElOf(el) === el) return el
    var search = isSearchEl(el) ? el : (searchElOf(el) === el ? el : null)
    if (search) {
      var form = search.querySelector
        ? search.querySelector('.pw-search-form, .pw-shop-search-form, form[data-pw-search-form]')
        : null
      return form || search
    }
    return catToggleElOf(el) || chromeBtnElOf(el) || el
  }
  function stampWidgetAttr(el, name, color) {
    var c = String(color || '').trim()
    var host = searchSubmitElOf(el) === el || isSearchSubmitEl(el)
      ? (searchSubmitElOf(el) || el)
      : (searchImageElOf(el) === el || isSearchImageEl(el))
        ? (searchImageElOf(el) || el)
        : (fieldElOf(el) === el)
          ? el
          : (badgeElOf(el) === el)
            ? el
            : (catToggleElOf(el) || chromeBtnElOf(el) || (isSearchEl(el) ? el : searchElOf(el)) || el)
    var target = widgetSurfaceEl(el) || host
    if (!c) {
      if (host && host.removeAttribute) host.removeAttribute(name)
      if (target && target !== host && target.removeAttribute) target.removeAttribute(name)
    } else {
      if (host && host.setAttribute) host.setAttribute(name, c)
      if (target && target !== host && target.setAttribute) target.setAttribute(name, c)
    }
  }
  function ensureWidgetBorder(el) {
    if (!el || !el.style) return
    var w = el.style.borderWidth || ''
    var s = el.style.borderStyle || ''
    if (!w || w === '0' || w === '0px') el.style.setProperty('border-width', '1px')
    if (!s || s === 'none') el.style.setProperty('border-style', 'solid')
  }
  function applyWidgetBg(el, color) {
    var c = String(color || '').trim()
    var target = widgetSurfaceEl(el)
    if (!target) return
    stampWidgetAttr(el, 'data-pw-btn-color', c)
    if (!c) return
    target.style.setProperty('background', c, 'important')
    target.style.setProperty('background-color', c, 'important')
  }
  function applyWidgetBorder(el, color) {
    var c = String(color || '').trim()
    var target = widgetSurfaceEl(el)
    if (!target) return
    stampWidgetAttr(el, 'data-pw-btn-border', c)
    if (!c) return
    ensureWidgetBorder(target)
    target.style.setProperty('border-color', c, 'important')
  }
  function widgetIconNodes(el) {
    var host = catToggleElOf(el) || chromeBtnElOf(el) || el
    if (!host || !host.querySelectorAll) return []
    return Array.prototype.slice.call(host.querySelectorAll('svg'))
  }
  function paintSvgIconColor(svg, color) {
    var c = String(color || '').trim()
    var parts
    var j
    if (!svg) return
    if (c) {
      svg.style.setProperty('stroke', c, 'important')
      svg.style.setProperty('color', c)
      svg.style.setProperty('fill', 'none', 'important')
      svg.setAttribute('stroke', c)
      svg.setAttribute('fill', 'none')
      if (!svg.getAttribute('stroke-width')) svg.setAttribute('stroke-width', '2')
      if (!svg.getAttribute('stroke-linecap')) svg.setAttribute('stroke-linecap', 'round')
      parts = svg.querySelectorAll('path,circle,rect,line,polyline,polygon')
      for (j = 0; j < parts.length; j++) {
        parts[j].style.setProperty('stroke', c, 'important')
        parts[j].style.setProperty('fill', 'none', 'important')
      }
    } else {
      svg.style.removeProperty('stroke')
      svg.style.removeProperty('color')
      svg.setAttribute('stroke', 'currentColor')
      parts = svg.querySelectorAll('path,circle,rect,line,polyline,polygon')
      for (j = 0; j < parts.length; j++) parts[j].style.removeProperty('stroke')
    }
  }
  function applyWidgetIconColor(el, color) {
    var c = String(color || '').trim()
    var host = catToggleElOf(el) || chromeBtnElOf(el) || el
    stampWidgetAttr(host, 'data-pw-icon-color', c)
    var svgs = widgetIconNodes(host)
    var i
    for (i = 0; i < svgs.length; i++) paintSvgIconColor(svgs[i], c)
  }
  function applyWidgetTextColor(el, color) {
    var c = String(color || '').trim()
    if (isSearchSubmitEl(el) || searchSubmitElOf(el) === el || isSearchImageEl(el) || searchImageElOf(el) === el || fieldElOf(el) === el || badgeElOf(el) === el) {
      stampWidgetAttr(el, 'data-pw-btn-text', c)
      if (c) el.style.setProperty('color', c, 'important')
      return
    }
    var host = catToggleElOf(el) || chromeBtnElOf(el) || searchElOf(el) || el
    if (!host) return
    stampWidgetAttr(host, 'data-pw-btn-text', c)
    if (!c) return
    if ((isSearchEl(host) || searchElOf(host) === host) && !isSearchSubmitEl(host) && !isSearchImageEl(host)) {
      var input = host.querySelector
        ? host.querySelector('[data-pw-search], input[type="search"], input[name="q"]')
        : null
      if (input) input.style.setProperty('color', c, 'important')
      return
    }
    var labels = host.querySelectorAll
      ? host.querySelectorAll('span, .pw-chrome-btn-label, .pw-shop-nav-label, .pw-account-btn-label')
      : []
    var painted = false
    var i
    var lab
    for (i = 0; i < labels.length; i++) {
      lab = labels[i]
      if (lab.querySelector && lab.querySelector('svg')) continue
      if (clsOf(lab).indexOf('pw-cart-badge') >= 0 || clsOf(lab).indexOf('pw-shop-cart-badge') >= 0) continue
      if (clsOf(lab).indexOf('pw-chrome-icon-wrap') >= 0) continue
      lab.style.setProperty('color', c, 'important')
      painted = true
    }
    if (!painted) host.style.setProperty('color', c, 'important')
  }
  function applyDotsColor(el, color, which) {
    var host = dotsElOf(el)
    if (!host) return
    var c = String(color || '').trim()
    if (!c) return
    var attr = which === 'active' ? 'data-pw-dot-active' : 'data-pw-dot-color'
    host.setAttribute(attr, c)
    var spans = host.querySelectorAll ? host.querySelectorAll('span') : []
    var i
    var on
    for (i = 0; i < spans.length; i++) {
      on = clsOf(spans[i]).indexOf('is-active') >= 0
      if (which === 'active' ? on : !on) {
        spans[i].style.setProperty('background', c, 'important')
        spans[i].style.setProperty('background-color', c, 'important')
      }
    }
  }
  function applyPlaceholderColor(el, color) {
    var field = fieldElOf(el) || el
    if (!field) return
    var c = String(color || '').trim()
    if (!c) {
      field.removeAttribute('data-pw-ph')
      field.style.removeProperty('--pw-ph')
      return
    }
    field.setAttribute('data-pw-ph', c)
    field.style.setProperty('--pw-ph', c)
  }
  function readDotColor(el, which) {
    var host = dotsElOf(el)
    if (!host) return ''
    var attr = which === 'active' ? 'data-pw-dot-active' : 'data-pw-dot-color'
    var saved = host.getAttribute ? host.getAttribute(attr) || '' : ''
    if (saved) return saved
    var spans = host.querySelectorAll ? host.querySelectorAll('span') : []
    var i
    var on
    for (i = 0; i < spans.length; i++) {
      on = clsOf(spans[i]).indexOf('is-active') >= 0
      if (which === 'active' ? on : !on) {
        try { return cs(spans[i]).backgroundColor || '' } catch (errD) { return '' }
      }
    }
    return ''
  }
  function readPlaceholderColor(el) {
    var field = fieldElOf(el) || el
    if (!field || !field.getAttribute) return ''
    return field.getAttribute('data-pw-ph') || field.style.getPropertyValue('--pw-ph') || ''
  }
  function readWidgetIconColor(el) {
    var host = catToggleElOf(el) || chromeBtnElOf(el) || el
    if (host && host.getAttribute) {
      var saved = host.getAttribute('data-pw-icon-color') || ''
      if (saved) return saved
    }
    var svgs = widgetIconNodes(el)
    if (!svgs.length) return ''
    try {
      var st = cs(svgs[0]).stroke || ''
      if (st && st !== 'none' && st.indexOf('url(') < 0) return st
    } catch (err) {}
    return ''
  }
  function readWidgetBorder(el) {
    var host = catToggleElOf(el) || chromeBtnElOf(el) || searchElOf(el) || el
    if (host && host.getAttribute) {
      var saved = host.getAttribute('data-pw-btn-border') || ''
      if (saved) return saved
    }
    var target = widgetSurfaceEl(el) || el
    try {
      return cs(target).borderColor || ''
    } catch (errB) {
      return ''
    }
  }
  function isCtaPaintEl(el) {
    return !!(el && isBtnEl(el) && !catToggleElOf(el) && !isChromeBtn(el) && !isHeaderWidget(el) && !isSearchEl(el))
  }
  function restoreWidgetColors(root) {
    var scope = root && root.querySelectorAll ? root : document
    var nodes = []
    try {
      nodes = Array.prototype.slice.call(
        scope.querySelectorAll(
          '[data-pw-btn-color],[data-pw-btn-border],[data-pw-icon-color],[data-pw-btn-text],[data-pw-ph],[data-pw-dot-color],[data-pw-dot-active],[data-pw-el="cat-toggle"],[data-pw-cat-toggle],.pw-cat-btn,[data-pw-chrome-btn],[data-pw-chrome-added],.pw-icon-btn,.pw-account-btn,.pw-header-search,.pw-shop-search-wrap,.pw-search-submit,.pw-search-image-btn,[data-pw-image-search],[data-pw-el="field"],[data-pw-el="badge"],[data-pw-el="dots"],.pw-hero-dots,.pw-bottom-nav > a,.pw-shop-bottom-nav > a'
        )
      )
    } catch (errN) {
      nodes = []
    }
    var i
    var el
    var bg
    var border
    var icon
    var text
    for (i = 0; i < nodes.length; i++) {
      el = nodes[i]
      if (isWidgetSurfaceEl(el) || dotsElOf(el) === el) {
      bg = el.getAttribute('data-pw-btn-color') || ''
      border = el.getAttribute('data-pw-btn-border') || ''
      icon = el.getAttribute('data-pw-icon-color') || ''
      text = el.getAttribute('data-pw-btn-text') || ''
      if (bg) applyWidgetBg(el, bg)
      if (border) applyWidgetBorder(el, border)
      if (icon) applyWidgetIconColor(el, icon)
      if (text) applyWidgetTextColor(el, text)
      var ph = el.getAttribute('data-pw-ph') || ''
      if (ph) applyPlaceholderColor(el, ph)
      var dotIdle = el.getAttribute('data-pw-dot-color') || ''
      var dotOn = el.getAttribute('data-pw-dot-active') || ''
      if (dotIdle) applyDotsColor(el, dotIdle, 'idle')
      if (dotOn) applyDotsColor(el, dotOn, 'active')
      }
    }
  }
  function setButtonStyle(style) {
    if (!selected || catToggleElOf(selected) || !isBtnEl(selected) || isChromeBtn(selected)) return
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
  function setChromeLabel(text) {
    if (!selected) return
    if (clsOf(selected).indexOf('pw-brand') >= 0) return
    if (!(isChromeBtn(selected) || isHeaderWidget(selected) || isSearchSubmitEl(selected) || canEditChromeLabel(selected))) return
    var next = String(text || '').trim() || ' '
    var el = selected
    var isAccount = clsOf(el).indexOf('pw-account-btn') >= 0 || !!(el.getAttribute && el.getAttribute('data-pw-account-toggle'))
    var lab = chromeLabelEl(el)
    if (!lab) {
      lab = document.createElement('span')
      lab.className = isSearchSubmitEl(el) ? 'pw-shop-search-submit-label' : (isAccount ? 'pw-account-btn-label' : 'pw-shop-nav-label pw-chrome-btn-label')
      el.appendChild(lab)
    }
    lab.textContent = next
    el.setAttribute('aria-label', next)
    el.setAttribute('title', next)
    positionAllHandles()
    post('dirty', {})
  }
  function setButtonLabel(text) {
    if (!selected || catToggleElOf(selected)) return
    if (isChromeBtn(selected) || (isHeaderWidget(selected) && isInHeader(selected)) || isSearchSubmitEl(selected) || canEditChromeLabel(selected)) {
      setChromeLabel(text)
      return
    }
    if (!isBtnEl(selected)) return
    if (iframeTextFocused(selected)) return
    selected.textContent = String(text || '') || ' '
    positionAllHandles()
    post('dirty', {})
  }
  function setTextContent(text) {
    if (!selected || !canEditText(selected)) return
    if (isBtnEl(selected) && !isAddedText(selected)) return
    if (iframeTextFocused(selected)) return
    selected.textContent = String(text || '') || ' '
    positionAllHandles()
    post('dirty', {})
  }
  function setButtonColor(color) {
    if (!selected) return
    if (isWidgetSurfaceEl(selected)) applyWidgetBg(selected, color)
    else if (isCtaPaintEl(selected)) applyBtnColor(selected, color)
    else return
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setButtonBorder(color) {
    if (!selected) return
    if (isWidgetSurfaceEl(selected)) applyWidgetBorder(selected, color)
    else if (isCtaPaintEl(selected)) applyBtnBorderColor(selected, color)
    else return
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setIconColor(color) {
    if (!selected || !isWidgetSurfaceEl(selected)) return
    applyWidgetIconColor(selected, color)
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setDotColor(color) {
    if (!selected || !dotsElOf(selected)) return
    applyDotsColor(selected, color, 'idle')
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setDotActiveColor(color) {
    if (!selected || !dotsElOf(selected)) return
    applyDotsColor(selected, color, 'active')
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function setPlaceholderColor(color) {
    if (!selected || fieldElOf(selected) !== selected) return
    applyPlaceholderColor(selected, color)
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
  function isNudgeTypingTarget(el) {
    if (!el || !el.tagName) return false
    var t = String(el.tagName).toLowerCase()
    if (t !== 'input' && t !== 'textarea' && t !== 'select') return false
    if (selected && searchElOf(el) && (isSearchEl(selected) || (selected.contains && selected.contains(el)))) return false
    return true
  }
  function nudgeSelected(dx, dy) {
    if (!selected || !canDragEl(selected)) return
    if (isLogoTarget(selected)) {
      var frameTarget = (isInHeader(selected) && headerLogoUnit(selected)) || logoMoveEl(selected) || selected
      ensureDragDisplay(frameTarget)
      var fp = parseTransform(frameTarget)
      clampTranslateToViewport(frameTarget, fp.x + dx, fp.y + dy)
    } else if (isBannerContentEl(selected) || isMoveBlockEl(selected) || isTextEl(selected) || isBtnEl(selected)) {
      var contentTarget = selected
      ensureDragDisplay(contentTarget)
      var cp = parseTransform(contentTarget)
      clampTranslateToViewport(contentTarget, cp.x + dx, cp.y + dy)
    } else if (isBannerPhotoTarget(selected) && bannerHostOf(selected)) {
      var panHostB = bannerHostOf(selected)
      var prB = panHostB.getBoundingClientRect()
      var curB = parseBannerPan(panHostB)
      applyBannerPhoto(
        panHostB,
        parseBannerZoom(panHostB),
        Math.max(0, Math.min(100, curB.x - (dx / Math.max(1, prB.width)) * 80)),
        Math.max(0, Math.min(100, curB.y - (dy / Math.max(1, prB.height)) * 80))
      )
    } else if (isBgLayerEl(selected) && selected.parentElement && !isImgEl(selected)) {
      var panHost = selected.parentElement
      var pr = panHost.getBoundingClientRect()
      var cur = String(panHost.style.backgroundPosition || '50% 50%').split(/\s+/)
      var cx = parseFloat(cur[0])
      var cy = parseFloat(cur[1])
      if (!isFinite(cx)) cx = 50
      if (!isFinite(cy)) cy = 50
      var px = Math.max(0, Math.min(100, cx - (dx / Math.max(1, pr.width)) * 80))
      var py = Math.max(0, Math.min(100, cy - (dy / Math.max(1, pr.height)) * 80))
      panBannerPhoto(panHost, px, py)
    } else {
      var target = searchMoveEl(selected) || logoMoveEl(selected) || selected
      ensureDragDisplay(target)
      var p = parseTransform(target)
      clampTranslateToViewport(target, p.x + dx, p.y + dy)
    }
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function onKeyDown(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    var key = e.key || ''
    if (logoCrop.on && (key === 'Escape' || key === 'Esc')) {
      e.preventDefault()
      closeLogoCrop(false)
      return
    }
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
    if ((key === 'Delete' || key === 'Backspace') && selected && canDeleteEl(selected)) {
      if (selected.getAttribute && selected.getAttribute('contenteditable') === 'true') return
      var keyTag = e.target && e.target.tagName ? String(e.target.tagName).toLowerCase() : ''
      if (keyTag === 'input' || keyTag === 'textarea' || keyTag === 'select') return
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      deleteSelectedUnit()
      return
    }
    if (!selected || !canDragEl(selected)) return
    if (isNudgeTypingTarget(e.target)) return
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
  function canSetHrefEl(el) {
    if (!el) return false
    if (isAddedBg(el) || catToggleElOf(el) || isSearchEl(el) || chromeBtnElOf(el) || isLogoTarget(el) || isLogoFrame(el) || isLogoSlot(el) || isBrandLink(el)) return false
    var role = pwElOf(el)
    if (role === 'nav-link' || role === 'link' || role === 'crumb') return true
    if (isAddedBtn(el) || isAddedText(el)) return true
    if (el.tagName && el.tagName.toLowerCase() === 'a') return true
    return isBtnEl(el) && !isHeaderWidget(el)
  }
  function applyAddedTextHref(el, href) {
    if (!el || !isAddedText(el)) return el
    var url = String(href || '').trim()
    var node = el
    if (el.tagName.toLowerCase() !== 'a') {
      var a = document.createElement('a')
      if (el.attributes) {
        for (var i = 0; i < el.attributes.length; i++) {
          var at = el.attributes[i]
          if (at && at.name) a.setAttribute(at.name, at.value)
        }
      }
      a.style.cssText = el.style ? el.style.cssText : ''
      a.innerHTML = el.innerHTML
      if (el.parentNode) el.parentNode.replaceChild(a, el)
      if (selected === el) selected = a
      node = a
    }
    if (url) node.setAttribute('href', url)
    else node.removeAttribute('href')
    return node
  }
  function hrefOf(el) {
    if (!el) return ''
    if (el.tagName && el.tagName.toLowerCase() === 'a') return el.getAttribute('href') || ''
    var wrap = el.closest ? el.closest('a') : null
    return wrap ? (wrap.getAttribute('href') || '') : ''
  }
  function shopHomeHref() {
    try {
      var path = String(location.pathname || '')
      if (path.indexOf('/site/') === 0) {
        var rest2 = path.slice(6)
        var cut2 = rest2.search(/[/?#]/)
        var slug2 = cut2 < 0 ? rest2 : rest2.slice(0, cut2)
        if (slug2) return '/site/' + slug2
      }
    } catch (e) {}
    var brand = document.querySelector('a.pw-brand[href], a[data-pw-chrome-btn="home"][href], a[data-pw-logo-home][href]')
    if (brand) {
      var brandHref = String(brand.getAttribute('href') || '').trim()
      if (brandHref && brandHref !== '#') return brandHref
    }
    var links = document.querySelectorAll('a[href]')
    for (var i = 0; i < links.length; i++) {
      var href = String(links[i].getAttribute('href') || '').trim()
      if (href.indexOf('/site/') === 0) {
        var rest = href.slice(6)
        var cut = rest.search(/[/?#]/)
        var slug = cut < 0 ? rest : rest.slice(0, cut)
        if (slug) return '/site/' + slug
      }
    }
    return '/'
  }
  function isEmptyHref(h) {
    var s = String(h || '').trim()
    return !s || s === '#' || s.toLowerCase().indexOf('javascript:') === 0
  }
  function unwrapContentsLink(a) {
    if (!a || !a.parentNode) return
    while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a)
    a.parentNode.removeChild(a)
  }
  function logoHomeUnit(el) {
    if (!el || el.nodeType !== 1) return null
    if (el.getAttribute && (el.getAttribute('data-pw-logo-float') === '1' || el.getAttribute('data-pw-logo-home') === '1' || el.getAttribute('data-pw-logo-frame') === '1')) return el
    if (hasClassToken(el, 'pw-logo-frame')) return el
    var frame = logoFrameOf(el)
    if (frame) return frame
    return (isImgEl(el) ? el : (el.querySelector ? el.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]') : null)) || el
  }
  function ensureLogoHomeLink(el) {
    if (!el || el.nodeType !== 1) return el
    var unit = logoHomeUnit(el)
    if (!unit) return el
    var home = shopHomeHref()
    var tag = (unit.tagName || '').toLowerCase()
    if (tag === 'a') {
      unit.setAttribute('href', home)
      unit.setAttribute('data-pw-logo-home', '1')
      return unit
    }
    var existing = unit.closest ? unit.closest('a') : null
    var floated = unit.getAttribute && unit.getAttribute('data-pw-logo-float') === '1'
    if (existing && existing !== unit) {
      var disp = existing.style ? String(existing.style.display || '').toLowerCase() : ''
      if (disp === 'contents') unwrapContentsLink(existing)
      else if (floated) {
        if (existing.parentNode) existing.parentNode.insertBefore(unit, existing.nextSibling)
        if (isEmptyHref(existing.getAttribute('href'))) existing.setAttribute('href', home)
      } else {
        existing.setAttribute('href', home)
        if (isBrandLink(existing) || (existing.getAttribute && existing.getAttribute('data-pw-logo-home') === '1')) {
          existing.setAttribute('data-pw-logo-home', '1')
        }
        return existing
      }
    }
    if (!unit.parentNode) return unit
    var link = document.createElement('a')
    link.className = 'pw-brand'
    link.setAttribute('href', home)
    link.setAttribute('data-pw-logo-home', '1')
    unit.parentNode.insertBefore(link, unit)
    if (floated) {
      link.setAttribute('data-pw-logo-float', '1')
      var z = unit.getAttribute('data-pw-z')
      var scene = unit.getAttribute(SCENE.attr)
      if (z) link.setAttribute('data-pw-z', z)
      if (scene) link.setAttribute(SCENE.attr, scene)
      link.style.cssText = unit.style.cssText
      unit.removeAttribute('data-pw-logo-float')
      unit.style.setProperty('position', 'relative', 'important')
      unit.style.setProperty('left', '0', 'important')
      unit.style.setProperty('top', '0', 'important')
      // Keep frame size in px (copied to link above). Never width/height 100% — parseFloat('100%') === 100.
      unit.style.removeProperty('z-index')
    }
    link.appendChild(unit)
    liftLogoOutOfHeading(link)
    return link
  }
  function bakeHeaderLogoHomeLinks(scope) {
    var root = scope || document
    if (!root.querySelectorAll) return
    var nodes = root.querySelectorAll('[data-pw-logo-float="1"], .pw-logo-frame, [data-pw-logo-frame="1"], img.pw-logo, img.pw-shop-logo, [data-pw-logo-added]')
    var seen = typeof WeakSet === 'function' ? new WeakSet() : null
    var i
    for (i = 0; i < nodes.length; i++) {
      var unit = headerLogoUnit(nodes[i]) || nodes[i]
      if (!unit) continue
      if (seen) { if (seen.has(unit)) continue; seen.add(unit) }
      ensureLogoHomeLink(unit)
    }
  }
  function canDragEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false
    if (chatEmbedLauncherOf(el)) return false
    if (isOverlayNode(el) || (isLockedCatalogEl(el) && !productActionChromeOf(el)) || (isProductCardEl(el) && !productActionChromeOf(el))) return false
    if (isChromeBgHost(el) || isShopRegionHost(el)) return true
    return isAddedBg(el) || isAddedText(el) || isImgEl(el) || isLogoFrame(el) || isLogoTarget(el) || isBtnEl(el) || isTextEl(el) || isChromeBtn(el) || isHeaderWidget(el) || isSearchEl(el) || isContentBlockEl(el) || isBgImageEl(el) || isMoveBlockEl(el) || isBgLayerEl(el) || isBannerHostEl(el)
  }
  function canDeleteEl(el) {
    if (!el || el === document.body || el === document.documentElement) return false
    if (chatEmbedLauncherOf(el)) return true
    if ((isLockedCatalogEl(el) && !productActionChromeOf(el)) || (isProductCardEl(el) && !productActionChromeOf(el)) || isShopRegionHost(el)) return false
    var delCls = clsOf(el)
    if (delCls.indexOf('pw-topbar') >= 0 || delCls.indexOf('pw-shop-topbar') >= 0) return false
    if (isHeaderChromeEl(el) || searchElOf(el) || catToggleElOf(el) || isAddedChrome(el)) return true
    var tag = el.tagName.toLowerCase()
    if (tag === 'header' || tag === 'main' || tag === 'html' || tag === 'form') return false
    var cls = clsOf(el)
    if (cls.indexOf('pw-header-search') >= 0 || cls.indexOf('pw-shop-search-wrap') >= 0 || cls.indexOf('pw-header-main') >= 0) return false
    if (cls.indexOf('pw-brand-cluster') >= 0 || cls.indexOf('pw-shop-brand-cluster') >= 0) return false
    if (cls.indexOf('pw-header-actions') >= 0 || cls.indexOf('pw-shop-header-actions') >= 0) return false
    if (cls.indexOf('pw-nav-main') >= 0 || cls.indexOf('pw-shop-nav-row') >= 0) return false
    if (isBrandLink(el) && !isLogoImg(el) && !isLogoFrame(el)) return false
    if (cls.indexOf('pw-bottom-nav') >= 0) return false
    if (el.closest && el.closest('.pw-header-search, .pw-shop-search-wrap, form[data-pw-search-form]')) return false
    return isAddedBg(el) || isAddedText(el) || isAddedChrome(el) || isChromeBtn(el) || isImgEl(el) || isLogoFrame(el) || isBtnEl(el) || isTextEl(el) || isContentBlockEl(el) || isHeaderWidget(el) || isBgImageEl(el) || isMoveBlockEl(el)
  }
  function isAddedChrome(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-chrome-added'))
  }
  function dragModeFor(el) {
    if (isAddedBg(el)) return 'translate'
    if (isChromeBgHost(el) && !isHeaderChromeEl(el) && !isChromeBtn(el)) return 'translate'
    if (el && el.getAttribute && el.getAttribute('data-pw-added-btn') === '1') return 'translate'
    if (isLogoFrame(el) || isLogoImg(el)) return 'translate'
    if (isSearchEl(el)) return 'translate'
    if (pwElOf(el) === 'cat-toggle' || hasClassToken(el, 'pw-cat-btn') || hasClassToken(el, 'pw-shop-cat-btn')) {
      return 'translate'
    }
    if (isAddedChrome(el) || isChromeBtn(el) || isHeaderWidget(el)) {
      return 'translate'
    }
    var bHost = bannerHostOf(el)
    if (bHost) {
      if (isBannerLeafEl(el) || isTextEl(el) || isBtnEl(el)) return 'translate'
      if (isMoveBlockEl(el) || pwElOf(el) === 'copy') return 'translate'
      if (layerMode === 'image' || isBgLayerEl(el) || pwElOf(el) === 'media') return 'bg-pan'
      if (el === bHost || isBannerHostEl(el)) return 'translate'
    }
    if (isMoveBlockEl(el) || isImgEl(el)) return 'translate'
    if (isBgLayerEl(el)) return isImgEl(el) ? 'translate' : 'bg-pan'
    if (isContentBlockEl(el) && canImageLayer(el) && layerMode === 'block') return 'translate'
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
    if (!el || !host || isChromeFloatEl(el)) return
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
  function isAddedText(el) {
    return !!(el && el.getAttribute && el.getAttribute('data-pw-added-text') === '1')
  }
  function isAddedBtn(el) {
    if (!el || !el.getAttribute) return false
    if (catToggleElOf(el)) return false
    return el.getAttribute('data-pw-added-btn') === '1'
  }
  function canStickHeaderEl(el) {
    if (!el || el.nodeType !== 1) return false
    if (isChromeFloatEl(el)) return false
    // Chat mua / Zalo / Facebook luôn float trên màn — không gắn header.
    if (isChromeContactChatKind(chromeKindOf(el))) return false
    if (el.closest && el.closest('.pw-bottom-nav, .pw-shop-bottom-nav')) return false
    if (isSearchEl(el) || isLogoTarget(el) || isLogoFrame(el)) return false
    if (isFullBleedChrome(el) || isShopRegionHost(el)) return false
    if (isAddedBg(el) || isAddedBtn(el) || isAddedText(el) || isAddedChrome(el)) return true
    if (isBtnEl(el) && !isInHeader(el)) return true
    if (!(isChromeBtn(el) || isHeaderWidget(el))) return false
    if (!isInHeader(el)) return true
    var t = parseTransform(el)
    return Math.abs(t.x) > 2 || Math.abs(t.y) > 2
  }
  function isStickHeaderOn(el) {
    if (!el || !el.getAttribute) return false
    if (isChromeFloatEl(el)) return false
    if (isChromeContactChatKind(chromeKindOf(el))) return false
    if (el.getAttribute('data-pw-stick-header') === '1') return true
    return canStickHeaderEl(el) && isInHeader(el)
  }
  function clearChatStickHeader(el) {
    var host = chromeBtnElOf(el) || el
    if (!host || !isChromeContactChatKind(chromeKindOf(host))) return
    if (host.getAttribute('data-pw-stick-header') !== '1') return
    stickHeaderPause(1)
    stickHeaderUnpinEl(host)
    host.removeAttribute('data-pw-stick-header')
    host.classList.remove('pw-stick-header-on')
    stickHeaderPause(0)
  }
  function clearAllChatStickHeaders() {
    var nodes = document.querySelectorAll(
      '[data-pw-chrome-btn="chat"][data-pw-stick-header], [data-pw-chrome-btn="chat-zalo"][data-pw-stick-header], [data-pw-chrome-btn="chat-facebook"][data-pw-stick-header]'
    )
    for (var i = 0; i < nodes.length; i++) clearChatStickHeader(nodes[i])
  }
  function stickHeaderPause(on) {
    try { window.__pwStickHeaderPaused = on ? 1 : 0 } catch (ePause) {}
  }
  function stickHeaderUnpinEl(el) {
    try { if (window.__pwStickHeaderUnpin) window.__pwStickHeaderUnpin(el) } catch (eUnpin) {}
  }
  function stickHeaderApplyEl(el) {
    try { if (window.__pwStickHeaderApply) window.__pwStickHeaderApply(el) } catch (eApply) {}
  }
  function stickHeaderSync() {
    try { if (window.__pwStickHeaderSync) window.__pwStickHeaderSync() } catch (eSync) {}
  }
  function stickHeaderRelease() {
    try { if (window.__pwStickHeaderRelease) window.__pwStickHeaderRelease() } catch (eRel) {}
  }
  /** Stick-header must stay above page content — never demote to Nền (old default z=40). */
  function ensureStickHeaderFloatZ(el) {
    if (!el || !el.getAttribute) return
    var scene = readSceneIndex(el)
    var z = readUserZ(el)
    var hasScene = el.getAttribute(SCENE.attr) != null && String(el.getAttribute(SCENE.attr)).trim() !== ''
    var buried = scene <= SCENE.minIndex || (!hasScene && z > 0 && z < 100)
    if (!buried && (hasScene || z >= 100)) return
    writeSceneIndex(el, SCENE.maxIndex)
  }
  function detachForStickHeader(el) {
    if (!el || !isInHeader(el)) return
    if (el.closest && el.closest('.pw-bottom-nav, .pw-shop-bottom-nav')) return
    var r = el.getBoundingClientRect()
    var host = insertButtonHost() || document.body
    if (host && isInHeader(host)) {
      host = document.querySelector('main, .pw-shop-main, .pw-main') || document.body
    }
    if (!host) host = document.body
    ensureOverlayHost(host)
    var hr = host.getBoundingClientRect()
    if (el.parentNode !== host) host.appendChild(el)
    el.style.position = 'absolute'
    el.style.left = Math.round(r.left - hr.left) + 'px'
    el.style.top = Math.round(r.top - hr.top) + 'px'
    el.style.transform = 'none'
    el.style.margin = '0'
    ensureStickHeaderFloatZ(el)
  }
  function setStickHeader(on) {
    if (!selected || !canStickHeaderEl(selected)) return
    stickHeaderPause(1)
    stickHeaderUnpinEl(selected)
    if (on) {
      if (isInHeader(selected)) detachForStickHeader(selected)
      ensureStickHeaderFloatZ(selected)
      selected.setAttribute('data-pw-stick-header', '1')
      stickHeaderPause(0)
      stickHeaderApplyEl(selected)
    } else {
      selected.removeAttribute('data-pw-stick-header')
      if (isInHeader(selected)) detachForStickHeader(selected)
      stickHeaderPause(0)
      stickHeaderUnpinEl(selected)
      ensureStickHeaderFloatZ(selected)
    }
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function buildPayload(el) {
    var rect = el.getBoundingClientRect()
    var bgHost = isBgLayerEl(el) && !isImgEl(el) && el.parentElement ? el.parentElement : el
    var bgUrl = extractBgUrl(bgHost)
    var img = isImgEl(el)
    var btn = isBtnEl(el)
    var move = isMoveBlockEl(el)
    var bgLayer = isBgLayerEl(el)
    var blockSelf = !move && !bgLayer && !img && (isContentBlockEl(el) || (isBlockEl(el) && !btn && !isTextEl(el)))
    var parentBlock = blockSelf ? el : findContentBlockEl(el)
    var imageBlock = parentBlock && canImageLayer(parentBlock) ? parentBlock : (canImageLayer(el) ? el : null)
    var imgTarget = imageBlock ? imageTargetOf(imageBlock) : null
    var dual = blockSelf && imageBlock && imgTarget === el
    var asImage = bgLayer || (dual && layerMode !== 'block')
    var addedBg = isAddedBg(el)
    var chromeBg = isChromeBgHost(el) && !isHeaderChromeEl(el) && !isChromeBtn(el)
    var asBlock = (blockSelf && !asImage && !addedBg) || move || chromeBg
    var canUngroup = move
    var canGroup = !move && !blockSelf && !bgLayer && !addedBg && !img && !isLogoTarget(el) && Boolean(parentBlock) && (function () {
      var grouped = findMoveBlockEl(el)
      if (grouped) return grouped.getAttribute('data-pw-ungrouped') === '1'
      return Boolean(imageBlock)
    })()
    var padEl = parentBlock ? paddingTarget(parentBlock) : null
    var overlayBlock = parentBlock && canOverlayBlock(parentBlock) ? parentBlock : (blockSelf && canOverlayBlock(el) ? el : null)
    var themeColors = sampleThemeColors()
    return {
      tag: el.tagName.toLowerCase(),
      isText: canEditText(el),
      isImage: img,
      isBgImage: addedBg || img ? false : (asImage || bgLayer || (Boolean(bgUrl) && !move)),
      isMoveBlock: move,
      canUngroup: canUngroup,
      canGroup: canGroup,
      isLogo: isLogoSlot(el) || isLogoImg(el) || isLogoFrame(el),
      logoLayer: '',
      logoZoom: (function () {
        var logoImg = logoImgOf(el) || (isLogoImg(el) ? el : null)
        return logoImg ? Math.round(parseLogoZoom(logoImg) * 100) : 100
      })(),
      isBannerPhoto: (function () {
        var h = bannerHostOf(el)
        if (!h) return false
        if (isBannerLeafEl(el) || isMoveBlockEl(el) || isTextEl(el) || isBtnEl(el)) return false
        return isBgLayerEl(el) || pwElOf(el) === 'media' || el === h || (layerMode === 'image' && !isBannerContentEl(el))
      })(),
      bannerZoom: (function () {
        var h = bannerHostOf(el)
        return h ? Math.round(parseBannerZoom(h) * 100) : 100
      })(),
      logoFace: logoFaceOf(logoImgOf(el) || el),
      logoSlot: logoSlotKind(el),
      logoBg: parseBgColor(el) || sampleSurroundingBg(el),
      logoBgImage: sampleSurroundingBgImage(el),
      themePrimary: themeColors.themePrimary,
      themeAccent: themeColors.themeAccent,
      themeBuy: themeColors.themeBuy,
      logoSlotCount: listLogoSlots().length,
      logoFilledCount: countFilledLogoSlots(),
      logoCropX: (function () {
        var logoImg = logoImgOf(el) || (isLogoImg(el) ? el : null)
        if (logoImg && isLogoTarget(el)) return Math.round(parseLogoCrop(logoImg).x)
        return 0
      })(),
      logoCropY: (function () {
        var logoImgY = logoImgOf(el) || (isLogoImg(el) ? el : null)
        if (logoImgY && isLogoTarget(el)) return Math.round(parseLogoCrop(logoImgY).y)
        return 0
      })(),
      isAddedBg: addedBg,
      isAddedBtn: isAddedBtn(el),
      isCatToggle: Boolean(catToggleElOf(el)),
      isSearch: Boolean(isSearchEl(el) || searchElOf(el)),
      editKind: editKindOf(el),
      chromeKind: chromeKindOf(el),
      chromeSize: parseChromeIconSize(chromeBtnElOf(el) || el),
      isButton: !addedBg && !catToggleElOf(el) && !chromeBtnElOf(el) && (isAddedBtn(el) || (btn && !isHeaderWidget(el))),
      layerPos: addedBg ? addedBgLayerPos(el) : elementLayerPos(el),
      layerIndex: addedBg ? addedBgLayer(el) : (function () {
        var pack = listLayerPack(el)
        return pack.idx >= 0 ? pack.idx + 1 : 0
      })(),
      layerCount: addedBg ? listBgStack().length : listLayerPack(el).items.length,
      bgLayer: addedBg ? addedBgLayer(el) : 0,
      bgIndex: addedBg ? addedBgLayer(el) : 0,
      bgCount: addedBg ? listBgStack().length : 0,
      bgStack: addedBg ? serializeBgStack(el) : [],
      isChrome: isChromeBtn(el),
      chromeStyle: isChromeBtn(el) || isHeaderWidget(el) || searchImageElOf(el) || catToggleElOf(el) ? currentChromeStyle(el) : '',
      btnStyle: btn && !isChromeBtn(el) ? currentBtnStyle(el) : '',
      isBlock: asBlock && !move,
      hasImageLayer: Boolean(imageBlock) && !isLogoTarget(el),
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
      bgColor: parseBgColor(widgetSurfaceEl(el) || el),
      src: (function () {
        if (isChromeChatBtn(el)) {
          var chatBtnSrc = chromeChatBtnOf(el) || el
          var chatImg = chatBtnSrc.querySelector ? chatBtnSrc.querySelector('img.pw-chrome-chat-logo') : null
          if (chatImg) return photoSrcOf(chatImg) || (chatImg.getAttribute('src') || '')
        }
        var logoImgSrc = logoImgOf(el) || (isLogoImg(el) ? el : null)
        if (logoImgSrc) return photoSrcOf(logoImgSrc) || (logoImgSrc.getAttribute('src') || '')
        return photoSrcOf(el) || (img ? (el.getAttribute('src') || '') : bgUrl)
      })(),
      href: hrefOf(el),
      canDelete: canDeleteEl(el),
      text: (isChromeBtn(el) || isHeaderWidget(el) || isSearchSubmitEl(el) ? chromeLabelText(el) : String(el.textContent || '')).replace(/\s+/g, ' ').trim().slice(0, 200),
      placeholder: (function () {
        var ph = searchInputOf(el)
        return ph ? String(ph.getAttribute('placeholder') || ph.placeholder || '') : ''
      })(),
      btnColor: el.getAttribute ? (el.getAttribute('data-pw-btn-color') || '') : '',
      btnBorder: el.getAttribute ? (el.getAttribute('data-pw-btn-border') || readWidgetBorder(el)) : '',
      btnText: el.getAttribute ? (el.getAttribute('data-pw-btn-text') || '') : '',
      iconColor: readWidgetIconColor(el),
      placeholderColor: readPlaceholderColor(el),
      dotColor: readDotColor(el, 'idle'),
      dotActiveColor: readDotColor(el, 'active'),
      imageWidth: img ? parseImageWidthPct(el) : 100,
      transform: canDragEl(el) ? parseTransform(el) : null,
      canStickHeader: canStickHeaderEl(el),
      stickHeader: isStickHeaderOn(el),
      canPinScreen: canPinScreenEl(el),
      pinScreen: isPinScreenOn(el),
      scene: readSceneIndex(isAddedOverlay(el) ? el : (layerPromoteHost(el) || el)),
      scenePos: sceneLayerPos(readSceneIndex(isAddedOverlay(el) ? el : (layerPromoteHost(el) || el))),
      sceneCount: SCENE.maxIndex + 1,
      sceneFocus: sceneFocus,
    }
  }
  function clearHover() {
    if (hoverEl) {
      hoverEl.classList.remove('nanoai-ve-hover')
      hoverEl = null
    }
  }
  function clearLogoLayerVisual() {
    var frames = document.querySelectorAll('[data-pw-logo-frame="1"], .pw-logo-frame')
    for (var i = 0; i < frames.length; i++) {
      frames[i].classList.remove('nanoai-ve-logo-block-layer', 'nanoai-ve-logo-image-layer', 'nanoai-ve-highlight')
      frames[i].removeAttribute('data-nanoai-ve-selected')
    }
    var imgs = document.querySelectorAll('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]')
    for (var j = 0; j < imgs.length; j++) {
      imgs[j].classList.remove('nanoai-ve-logo-block-layer', 'nanoai-ve-logo-image-layer')
    }
  }
  function syncLogoLayerVisual() {
    clearLogoLayerVisual()
    if (!selected || !isLogoTarget(selected)) return
    var img = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
    var mark = img || selected
    mark.classList.add('nanoai-ve-highlight')
    mark.setAttribute('data-nanoai-ve-selected', '1')
  }
  function clearEditorMarks(el) {
    if (!el || el.nodeType !== 1) return
    restoreChromeDupCenter(el)
    el.classList.remove('nanoai-ve-highlight')
    el.classList.remove('nanoai-ve-chrome-dup')
    el.classList.remove('nanoai-ve-dragging')
    el.removeAttribute('data-nanoai-ve-selected')
    if (el.getAttribute('contenteditable') === 'true') el.removeAttribute('contenteditable')
    var labs = el.querySelectorAll ? el.querySelectorAll('[contenteditable="true"]') : []
    var li
    for (li = 0; li < labs.length; li++) labs[li].removeAttribute('contenteditable')
    finishSearchPlaceholderEdit(el)
  }
  function beginSearchPlaceholderEdit(host) {
    var searchField = searchInputOf(host)
    if (!searchField) return
    searchField.setAttribute('data-pw-edit-placeholder', '1')
    searchField.style.setProperty('pointer-events', 'auto', 'important')
    searchField.value = searchField.getAttribute('placeholder') || searchField.placeholder || ''
    try {
      if (searchField.focus) searchField.focus()
      if (searchField.select) searchField.select()
    } catch (errPh) {}
  }
  function finishSearchPlaceholderEdit(el) {
    var input = searchInputOf(el) || (el && el.getAttribute && el.getAttribute('data-pw-search') != null ? el : null)
    if (!input) return
    if (input.getAttribute('data-pw-edit-placeholder') !== '1') return
    var typed = String(input.value || '').trim()
    if (typed) input.setAttribute('placeholder', typed)
    input.value = ''
    input.removeAttribute('data-pw-edit-placeholder')
    input.style.removeProperty('pointer-events')
  }
  function clearForeignEditorMarks(keep) {
    var leftovers = document.querySelectorAll('[data-nanoai-ve-selected],.nanoai-ve-highlight,.nanoai-ve-chrome-dup')
    for (var i = 0; i < leftovers.length; i++) {
      if (leftovers[i] !== keep) clearEditorMarks(leftovers[i])
    }
  }
  function clearSelection() {
    if (selected) clearEditorMarks(selected)
    clearForeignEditorMarks(null)
    document.body.classList.remove('nanoai-ve-dragging')
    selected = null
    try { syncBannerPhotoEdit() } catch (errPhoto) {}
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
    clearLogoLayerVisual()
  }
  function hideMoveHandle() {
    var h = document.querySelector('.nanoai-ve-move-handle')
    if (h) h.remove()
  }
  function hideLayerSwitches() {
    var nodes = document.querySelectorAll('.nanoai-ve-layer-switch')
    for (var i = 0; i < nodes.length; i++) nodes[i].remove()
  }
  function stickyChromeBottom() {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return 0
    try {
      var pos = (cs(header).position || '').toLowerCase()
      if (pos !== 'sticky' && pos !== 'fixed') return 0
      var hr = header.getBoundingClientRect()
      if (pos === 'fixed' || hr.top <= 1) return Math.max(0, Math.round(hr.bottom))
      return 0
    } catch (e) {
      return 0
    }
  }
  function layerSwitchInView(r, clip, viewH, viewW) {
    if (!r) return false
    if (r.right < 8 || r.left > viewW - 8) return false
    var visibleTop = Math.max(r.top, clip)
    var visibleBottom = Math.min(r.bottom, viewH)
    return visibleBottom - visibleTop >= 28
  }
  function positionLayerSwitch(block, box) {
    var r = block.getBoundingClientRect()
    var clip = stickyChromeBottom()
    var viewH = window.innerHeight || document.documentElement.clientHeight || 0
    var viewW = window.innerWidth || document.documentElement.clientWidth || 0
    var boxH = box.offsetHeight || 30
    var boxW = box.offsetWidth || 80
    var gap = 6
    if (!layerSwitchInView(r, clip, viewH, viewW)) {
      box.setAttribute('data-ve-clipped', '1')
      return
    }
    var visibleTop = Math.max(r.top, clip)
    var visibleBottom = Math.min(r.bottom, viewH)
    var banner = looksLikeBannerHost(block) || isBannerHostEl(block)
    var top = banner ? Math.max(visibleTop + 4, r.top + 8) : (r.bottom + gap)
    if (banner) {
      if (top + boxH > visibleBottom - 4) top = Math.max(visibleTop + 4, visibleBottom - boxH - 4)
      if (top < visibleTop + 2) top = visibleTop + 4
    } else {
      if (top + boxH > viewH - 8) top = r.top - boxH - gap
      if (top < clip + 2) top = Math.min(r.bottom + gap, viewH - boxH - 8)
      if (top + boxH > viewH - 8) top = Math.max(clip + 4, viewH - boxH - 8)
      if (top < clip + 2) top = clip + 4
    }
    var left = Math.max(8, r.left + 18)
    if (left + boxW > viewW - 8) left = Math.max(8, viewW - boxW - 8)
    box.style.position = 'fixed'
    box.style.left = left + 'px'
    box.style.top = top + 'px'
    box.removeAttribute('data-ve-clipped')
  }
  function applyLayerMode(mode, block) {
    layerMode = mode === 'block' ? 'block' : 'image'
    if (selected && isLogoTarget(selected)) {
      hideLayerSwitches()
      return
    }
    if (!block) return
    var bannerHost = bannerHostOf(block) || (isBannerHostEl(block) ? block : null)
    var target = bannerHost
      ? (layerMode === 'image' ? bannerLayerTarget(bannerHost, 'image') : bannerHost)
      : (layerMode === 'image'
        ? (ensureImageLayer(block) || imageTargetOf(block) || block)
        : (ensureMoveBlock(block) || block))
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
      var logoOn = !!(selected && (isLogoImg(selected) || isLogoFrame(selected) || logoFrameOf(selected)) && (block === selected || block === logoFrameOf(selected)))
      var bannerHost = block && isBannerHostEl(block) ? block : null
      var insideContent = !!(selected && (isBannerContentEl(selected) || isMoveBlockEl(selected)))
      var insideImg = !!(imgTarget && selected && !insideContent && (selected === imgTarget || isBgLayerEl(selected) || pwElOf(selected) === 'media' || (imgTarget.contains && imgTarget.contains(selected))))
      var blockOn = logoOn
        ? layerMode === 'block'
        : !!(bannerHost
          ? (insideContent || (layerMode === 'block' && selected && (selected === bannerHost || (bannerHost.contains(selected) && !insideImg))))
          : (selected && block && layerMode === 'block' && block.contains(selected) && !insideImg))
      var imageOn = logoOn
        ? layerMode === 'image'
        : !!(!insideContent && (insideImg || (selected && block && imgTarget && layerMode === 'image')))
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
    if (selected && isLogoTarget(selected)) {
      hideLayerSwitches()
      return
    }
    var host = null
    if (selected) {
      host = bannerHostOf(selected)
      if (!host && canImageLayer(selected)) host = selected
      else if (!host) {
        var walkHost = selected
        while (walkHost && walkHost !== document.body) {
          if (canImageLayer(walkHost) || looksLikeBannerHost(walkHost)) { host = walkHost; break }
          walkHost = walkHost.parentElement
        }
        if (!host) host = findContentBlockEl(selected)
      }
    }
    if (host && (looksLikeBannerHost(host) || canImageLayer(host))) {
      try { ensureImageLayer(host); ensureMoveBlock(host) } catch (errHost) {}
    }
    if (!host || !(canImageLayer(host) || looksLikeBannerHost(host)) || isLockedCatalogEl(host) || isProductCardEl(host)) {
      hideLayerSwitches()
      return
    }
    var keep = {}
    var box = ensureLayerSwitch(host)
    keep[box.id] = 1
    positionLayerSwitch(host, box)
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
  function headerAtPoint(x, y) {
    var under = null
    try { under = document.elementFromPoint(x, y) } catch (e) { under = null }
    if (under && under.closest) {
      var hit = under.closest('header, .pw-header, .pw-shop-header')
      if (hit) return hit
    }
    var headers = document.querySelectorAll('header, .pw-header, .pw-shop-header')
    var i
    for (i = 0; i < headers.length; i++) {
      var r = headers[i].getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return headers[i]
    }
    return null
  }
  function logoInsertHost(box) {
    var header = headerAtPoint(box.x + box.w / 2, box.y + box.h / 2)
    if (!header) return { host: document.body, inHeader: false }
    var cluster = header.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster') || header.querySelector('.pw-header-main, .pw-shop-header-inner') || header
    return { host: cluster, inHeader: true, header: header }
  }
  function placeLogoInCluster(node, cluster) {
    if (!node) return
    var header = (cluster && cluster.closest) ? cluster.closest('header, .pw-header, .pw-shop-header') : null
    if (!header) header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    var host = (header && header.querySelector) ? (header.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster') || cluster) : cluster
    if (!host) return
    var hostCls = clsOf(host)
    if (hostCls.indexOf('pw-header-main') >= 0 || hostCls.indexOf('pw-shop-header-inner') >= 0) {
      var catHost = host.querySelector('.pw-cat-btn, .pw-shop-cat-btn')
      if (catHost && catHost.parentElement) host = catHost.parentElement
    }
    var link = headerBrandLink(header || host)
    if (!link) {
      link = document.createElement('a')
      link.className = 'pw-brand'
      link.setAttribute('data-pw-logo-home', '1')
      link.setAttribute('href', shopHomeHref())
      var catBtn = host.querySelector ? host.querySelector('.pw-cat-btn, .pw-shop-cat-btn') : null
      if (catBtn && catBtn.parentNode === host) {
        if (catBtn.nextSibling) host.insertBefore(link, catBtn.nextSibling)
        else host.appendChild(link)
      } else if (host !== header) {
        host.insertBefore(link, host.firstChild)
      } else {
        var main = headerMainOf(header)
        var search = main && main.querySelector ? main.querySelector('.pw-header-search, .pw-shop-search-wrap') : null
        if (search && search.parentNode) search.parentNode.insertBefore(link, search)
        else if (main) main.insertBefore(link, main.firstChild)
      }
    }
    if (link === node || (node.contains && node.contains(link))) {
      hideSiblingWordmarks(node)
      hideBrandLinkText(link)
      return
    }
    if (node.parentNode !== link) link.insertBefore(node, link.firstChild)
    hideSiblingWordmarks(node)
    hideBrandLinkText(link)
  }
  function revealHeaderLogo(img) {
    if (!img) return
    img.style.opacity = '1'
    img.style.visibility = 'visible'
    img.style.display = 'block'
    applyDefaultZ(img, ${PW_SCENE_LOGO_Z})
    img.removeAttribute('data-pw-logo-empty')
    var frame = logoFrameOf(img)
    if (frame) {
      frame.style.opacity = '1'
      frame.style.visibility = 'visible'
      applyDefaultZ(frame, ${PW_SCENE_LOGO_Z})
      frame.style.overflow = 'visible'
    }
  }
  function rescueHeaderLogos() {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return
    var cluster = header.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster') || header.querySelector('.pw-header-main, .pw-shop-header-inner') || header
    var hr = header.getBoundingClientRect()
    var logos = document.querySelectorAll('[data-pw-logo-added="1"]')
    var i
    for (i = 0; i < logos.length; i++) {
      var img = logos[i]
      if (header.contains(img)) {
        revealHeaderLogo(img)
        continue
      }
      var r = img.getBoundingClientRect()
      var cx = r.left + r.width / 2
      var cy = r.top + r.height / 2
      if (cx < hr.left - 8 || cx > hr.right + 8 || cy < hr.top - 8 || cy > hr.bottom + 8) continue
      var frame = logoFrameOf(img)
      var move = frame || img
      revealHeaderLogo(img)
      pinHeaderLogoFloat(move, null)
    }
    sanitizeHeaderLogoLayout()
  }
  function finishAddLogo() {
    var box = logoDrawBox()
    cancelAddLogo()
    if (box.w < 24 || box.h < 16) return
    var cx = box.x + box.w / 2
    var cy = box.y + box.h / 2
    var under = null
    try { under = document.elementFromPoint(cx, cy) } catch (e) { under = null }
    var reuse = null
    if (under && under.nodeType === 1) {
      if (isImgEl(under) && under.getAttribute && under.getAttribute('data-pw-logo-added') === '1') reuse = under
      else if (under.closest) {
        var reuseFrame = under.closest('[data-pw-logo-frame="1"], .pw-logo-frame')
        if (reuseFrame && reuseFrame.querySelector) reuse = reuseFrame.querySelector('img')
        if (!reuse) {
          var reuseAdded = under.closest('[data-pw-logo-added="1"]')
          if (isImgEl(reuseAdded)) reuse = reuseAdded
        }
      }
    }
    if (reuse) {
      var reuseSize = isStretchedLogoBox(box.w, box.h, isInHeader(reuse))
        ? clampLogoStartBox(box.w, box.h, isInHeader(reuse))
        : clampLogoBox(box.w, box.h, isInHeader(reuse))
      var reuseHost = ensureLogoFrame(reuse) || logoFrameOf(reuse) || reuse
      applyLogoFrameSize(reuseHost, reuseSize.w, reuseSize.h)
      reuse.style.width = reuseSize.w + 'px'
      reuse.style.height = reuseSize.h + 'px'
      reuse.setAttribute('data-pw-logo-added', '1')
      if (!isFilledLogo(reuse)) reuse.setAttribute('data-pw-logo-empty', '1')
      revealHeaderLogo(reuse)
      if (isInHeader(reuse)) pinHeaderLogoFloat(reuse, box)
      try { reflowHeaderChrome() } catch (errReuseFlow) {}
      selectEl(reuse)
      post('dirty', {})
      post('logoCreate', buildPayload(reuse))
      syncLogoButtons()
      return
    }
    var place = logoInsertHost(box)
    if (place.inHeader && place.header) {
      var existingHeader = place.header.querySelector('img.pw-logo, img.pw-shop-logo, [data-pw-logo-added="1"]')
      if (isImgEl(existingHeader)) {
        var existSize = isStretchedLogoBox(box.w, box.h, true)
          ? clampLogoStartBox(box.w, box.h, true)
          : clampLogoBox(box.w, box.h, true)
        var existHost = ensureLogoFrame(existingHeader) || logoFrameOf(existingHeader) || existingHeader
        applyLogoFrameSize(existHost, existSize.w, existSize.h)
        existingHeader.setAttribute('data-pw-logo-added', '1')
        if (!isFilledLogo(existingHeader)) existingHeader.setAttribute('data-pw-logo-empty', '1')
        pinHeaderLogoFloat(existingHeader, box)
        try { dedupeHeaderLogos(existingHeader); reflowHeaderChrome() } catch (errExist) {}
        selectEl(existingHeader)
        post('dirty', {})
        post('logoCreate', buildPayload(existingHeader))
        syncLogoButtons()
        return
      }
    }
    var bg = sampleSurroundingBg(under && under.nodeType === 1 ? under : document.body)
    var host = place.inHeader && place.header ? place.header : (place.host || document.body)
    try {
      if (cs(host).position === 'static') host.style.position = 'relative'
    } catch (err) {}
    var img = document.createElement('img')
    img.className = 'pw-logo pw-shop-logo'
    img.setAttribute('data-pw-logo-added', '1')
    img.setAttribute('data-pw-logo-empty', '1')
    img.setAttribute('data-pw-logo-slot', logoSlotKind(under && under.nodeType === 1 ? under : host))
    img.setAttribute('data-pw-device', pwStampDevice())
    img.setAttribute('alt', 'logo')
    img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    var slotSize = clampLogoStartBox(box.w, box.h, place.inHeader)
    img.style.width = slotSize.w + 'px'
    img.style.height = slotSize.h + 'px'
    img.style.objectFit = 'contain'
    img.style.backgroundColor = bg || 'transparent'
    img.style.zIndex = '160'
    host.appendChild(img)
    liftLogoOutOfHeading(ensureLogoHomeLink(img) || img)
    var frame = ensureLogoFrame(img)
    if (frame) applyLogoFrameSize(frame, slotSize.w, slotSize.h)
    revealHeaderLogo(img)
    if (place.inHeader) pinHeaderLogoFloat(img, box)
    else {
      var hr = host.getBoundingClientRect()
      var unit = headerLogoUnit(img) || frame || img
      unit.style.position = 'absolute'
      unit.style.left = (box.x - hr.left) + 'px'
      unit.style.top = (box.y - hr.top) + 'px'
    }
    try {
      dedupeHeaderLogos(img)
    } catch (errSanLogo) {}
    selectEl(img)
    post('dirty', {})
    post('logoCreate', buildPayload(img))
    syncLogoButtons()
  }
  function headerLogoStartBox(w, h) {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header) return null
    var host = headerMainOf(header) || header
    var hr = host.getBoundingClientRect()
    var cluster = header.querySelector('.pw-brand-cluster, .pw-shop-brand-cluster') || header.querySelector('.pw-cat-btn, .pw-shop-cat-btn')
    var cr = cluster ? cluster.getBoundingClientRect() : { right: hr.left + 44, top: hr.top, height: hr.height }
    return {
      x: Math.min(hr.right - w - 8, Math.max(hr.left + 8, cr.right + 6)),
      y: hr.top + Math.max(2, Math.round((hr.height - h) / 2)),
      w: w,
      h: h
    }
  }
  function placeHeaderLogoFromToolbar(d) {
    cancelAddLogo()
    var w = Math.max(24, Math.round(Number(d && d.width) || 120))
    var h = Math.max(18, Math.round(Number(d && d.height) || 32))
    var bg = String((d && d.bgColor) || '').trim()
    var box = headerLogoStartBox(w, h)
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!box || !header) return
    var existing = header.querySelector('img.pw-logo, img.pw-shop-logo, [data-pw-logo-added="1"]')
    if (isImgEl(existing)) {
      var existSize = clampLogoBox(box.w, box.h, true)
      var existHost = ensureLogoFrame(existing) || logoFrameOf(existing) || existing
      applyLogoFrameSize(existHost, existSize.w, existSize.h)
      existing.setAttribute('data-pw-logo-added', '1')
      if (bg) existing.style.backgroundColor = bg
      pinHeaderLogoFloat(existing, box)
      try { dedupeHeaderLogos(existing) } catch (errExist2) {}
      selectEl(existing)
      post('dirty', {})
      post('logoCreate', buildPayload(existing))
      syncLogoButtons()
      return
    }
    var img = document.createElement('img')
    img.className = 'pw-logo pw-shop-logo'
    img.setAttribute('data-pw-logo-added', '1')
    img.setAttribute('data-pw-logo-empty', '1')
    img.setAttribute('data-pw-logo-slot', 'header')
    img.setAttribute('data-pw-device', pwStampDevice())
    img.setAttribute('alt', 'logo')
    img.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')
    var slotSize = clampLogoBox(box.w, box.h, true)
    img.style.width = slotSize.w + 'px'
    img.style.height = slotSize.h + 'px'
    img.style.objectFit = 'contain'
    img.style.backgroundColor = bg || 'transparent'
    img.style.zIndex = '160'
    header.appendChild(img)
    ensureLogoHomeLink(img)
    var frame = ensureLogoFrame(img)
    if (frame) applyLogoFrameSize(frame, slotSize.w, slotSize.h)
    revealHeaderLogo(img)
    pinHeaderLogoFloat(img, box)
    try { dedupeHeaderLogos(img) } catch (errNew) {}
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
    var target = logoMoveEl(selected) || selected
    var r = target.getBoundingClientRect()
    var peers = alignmentPeers(target)
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
      var p = parseTransform(target)
      clampTranslateToViewport(target, p.x + dx, p.y + dy)
    }
  }
  function positionAlignGuides() {
    if (logoCrop.live) { hideAlignGuides(); return }
    if (!selected) { hideAlignGuides(); return }
    var box = ensureAlignGuides()
    var h = box.querySelector('.nanoai-ve-guide-h')
    var v = box.querySelector('.nanoai-ve-guide-v')
    if (!h || !v) return
    var guideEl = logoMoveEl(selected) || selected
    if (isLogoTarget(selected) && layerMode === 'image') guideEl = logoImgOf(selected) || selected
    var r = guideEl.getBoundingClientRect()
    var docW = Math.max(document.documentElement.clientWidth, window.innerWidth)
    var docH = Math.max(document.documentElement.clientHeight, window.innerHeight)
    h.style.left = '0px'
    h.style.width = docW + 'px'
    h.style.top = (r.top + r.height / 2) + 'px'
    v.style.top = '0px'
    v.style.height = docH + 'px'
    v.style.left = (r.left + r.width / 2) + 'px'
    var peers = alignmentPeers(guideEl)
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
    h.style.left = Math.max(4, r.left - 6) + 'px'
    h.style.top = Math.max(4, r.top - 6) + 'px'
    h.style.zIndex = '2147483646'
  }
  function positionDeleteHandle(el, h) {
    var r = el.getBoundingClientRect()
    h.style.position = 'fixed'
    h.style.left = Math.max(4, Math.min((window.innerWidth || 360) - 16, r.right - 7)) + 'px'
    h.style.top = Math.max(4, r.top - 7) + 'px'
    h.style.zIndex = '2147483646'
  }
  function positionAllHandles() {
    positionLayerSwitches()
    positionLogoButtons()
    if (!selected) return
    var boxEl = logoMoveEl(selected) || selected
    var mv = document.querySelector('.nanoai-ve-move-handle')
    if (mv) positionMoveHandle(boxEl, mv)
    var del = document.querySelector('.nanoai-ve-delete-handle,.nanoai-ve-chrome-delete')
    if (del) positionDeleteHandle(boxEl, del)
    var rs = document.querySelector('.nanoai-ve-resize-handle')
    if (rs && (isImgEl(selected) || isAddedBg(selected) || isBgLayerEl(selected) || isBannerPhotoTarget(selected) || isSearchEl(selected))) {
      var resizeEl = boxEl
      if (isSearchEl(selected)) resizeEl = selected
      else if (isLogoTarget(selected) && layerMode === 'image') resizeEl = logoImgOf(selected) || selected
      else if (isBannerPhotoTarget(selected)) resizeEl = bannerHostOf(selected) || selected
      positionResizeHandle(resizeEl, rs)
    }
    positionAlignGuides()
    if (logoCrop.live) positionLiveLogoCropBar()
  }
  function beginHandleDrag(e, forceMove) {
    if (!selected || !canDragEl(selected)) return
    if (!isLogoTarget(selected)) {
      var bHostDrag = bannerHostOf(selected)
      if (bHostDrag) {
        if (layerMode === 'image' && !isBannerLeafEl(selected) && !isTextEl(selected) && !isBtnEl(selected)) {
          var imgNow = bannerLayerTarget(bHostDrag, 'image')
          if (imgNow) selected = imgNow
        } else if (isBannerLeafEl(selected) || isTextEl(selected) || isBtnEl(selected) || isMoveBlockEl(selected) || pwElOf(selected) === 'copy') {
          layerMode = 'block'
        } else {
          layerMode = 'block'
          selected = bHostDrag
        }
      } else {
        var hostDrag = isContentBlockEl(selected) ? selected : findContentBlockEl(selected)
        if (hostDrag && canImageLayer(hostDrag) && !isBannerHostEl(hostDrag)) {
          var moveNow = isMoveBlockEl(selected) ? selected : ensureMoveBlock(hostDrag)
          if (moveNow) selected = moveNow
        }
      }
    }
    drag.ready = true
    drag.active = false
    drag.startX = e.clientX
    drag.startY = e.clientY
    drag.dropTarget = null
    drag.dropHost = null
    drag.dropBefore = true
    drag.lastX = e.clientX
    drag.lastY = e.clientY
    stickHeaderPause(1)
    stickHeaderUnpinEl(selected)
    if (isLogoTarget(selected)) {
      var zImg = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
      if (logoCrop.live && !forceMove && zImg) {
        drag.mode = 'logo-pan'
        var pan0 = parseLogoPan(zImg)
        drag.baseX = pan0.x
        drag.baseY = pan0.y
      } else {
        drag.mode = 'logo-box'
        var moveEl = (isInHeader(selected) && headerLogoUnit(selected)) || logoMoveEl(selected) || selected
        var p = parseTransform(moveEl)
        drag.baseX = p.x
        drag.baseY = p.y
      }
    } else {
      var moveEl2 = searchMoveEl(selected) || logoMoveEl(selected) || selected
      var p2 = parseTransform(moveEl2)
      drag.baseX = p2.x
      drag.baseY = p2.y
      drag.mode = dragModeFor(isSearchEl(moveEl2) ? moveEl2 : selected)
      if (drag.mode === 'bg-pan') {
        var panHost0 = bannerHostOf(selected) || (isBgLayerEl(selected) && selected.parentElement) || selected
        var pan0 = parseBannerPan(panHost0)
        drag.baseX = pan0.x
        drag.baseY = pan0.y
      }
    }
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
    h.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>'
    document.body.appendChild(h)
    positionMoveHandle(logoMoveEl(el) || el, h)
    h.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return
      beginHandleDrag(e, true)
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
    positionDeleteHandle(logoMoveEl(el) || el, h)
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
    if ((isAddedChrome(selected) || isChromeBtn(selected)) && !isSearchEl(selected) && searchElOf(selected) !== selected) {
      var host = chromeDropHostFromPoint(e.clientX, e.clientY)
      var unit = chromeReorderUnit(selected)
      drag.dropHost = host
      if (!host) {
        drag.dropTarget = null
        hideDropLine()
        return
      }
      var slot = chromeSlotAtX(host, e.clientX, unit)
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
  function removeOrphanCatPanelNear(el) {
    if (!el) return
    var cluster = el.closest ? el.closest('.pw-brand-cluster, .pw-shop-brand-cluster') : null
    var scope = cluster || el.parentElement
    if (!scope || !scope.querySelectorAll) return
    var panels = scope.querySelectorAll('#pw-cat-panel, #pw-shop-cat-panel, [data-pw-cat-panel], .pw-cat-panel, .pw-shop-cat-panel')
    var i
    for (i = panels.length - 1; i >= 0; i--) {
      var panel = panels[i]
      if (panel && panel.parentNode) panel.parentNode.removeChild(panel)
    }
  }
  function deleteSelectedUnit() {
    if (!selected || !canDeleteEl(selected)) return
    if (removeSyncedFavoriteProduct(selected)) {
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
      return
    }
    if (chatEmbedLauncherOf(selected)) {
      hideChatEmbedLaunchers()
      return
    }
    if (!selected.parentNode) return
    var removeEl = selected
    var frame = logoFrameOf(selected)
    var deletingLogo = isLogoImg(selected) || isLogoFrame(selected) || Boolean(frame)
    var deletingCat = catToggleElOf(selected) || isCatToggleEl(selected)
    var brandHost = deletingLogo ? brandHostOf(selected) : null
    if (frame && (isLogoImg(selected) || isLogoFrame(selected) || selected === frame)) removeEl = frame
    if (!removeEl || !removeEl.parentNode) return
    if (isHeaderChromeEl(selected) || isAddedChrome(selected)) rememberDeletedChromeFeature(selected)
    if (deletingCat) removeOrphanCatPanelNear(removeEl)
    removeEl.parentNode.removeChild(removeEl)
    selected = null
    try { pruneEmptyLogoFrames() } catch (errPrune) {}
    if (deletingLogo) {
      try {
        if (brandHost && !hostHasLogoImg(brandHost)) restoreBrandWordmarks(brandHost)
        reflowHeaderChrome()
      } catch (errLogoDel) {}
    }
    hideResizeHandle()
    hideDeleteHandle()
    hideMoveHandle()
    hideDropLine()
    hideAlignGuides()
    try { clearLogoLayerVisual() } catch (errLayer) {}
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
    h.style.top = isSearchEl(img) ? (r.top + r.height / 2 - 8) + 'px' : (r.bottom - 8) + 'px'
    h.style.zIndex = '2147483646'
  }
  function showResizeHandle(img) {
    hideResizeHandle()
    if (logoCrop.live) return
    if (!img || (!isImgEl(img) && !isAddedBg(img) && !isLogoFrame(img) && !isLogoTarget(img) && !isBgLayerEl(img) && !isBannerPhotoTarget(img) && !isSearchEl(img))) return
    var frame = isLogoTarget(img) ? ((isInHeader(img) && headerLogoUnit(img)) || logoFrameOf(img) || (isLogoFrame(img) ? img : null) || logoImgOf(img) || img) : null
    var bannerPhoto = !frame && isBannerPhotoTarget(img)
    var box = isSearchEl(img) ? img : (frame || (bannerPhoto ? (bannerHostOf(img) || img) : img))
    var h = document.createElement('div')
    h.className = 'nanoai-ve-resize-handle nanoai-ve-ignore'
    h.setAttribute('data-nanoai-ve-ignore', '1')
    if (isSearchEl(img)) h.classList.add('is-search-width')
    else if (frame) h.classList.add('is-logo-frame')
    else if (bannerPhoto) h.classList.add('is-banner-zoom')
    document.body.appendChild(h)
    positionResizeHandle(box, h)
    h.addEventListener('mousedown', function (e) {
      e.preventDefault()
      e.stopPropagation()
      var zoomImg = logoImgOf(img) || img
      var bHost = bannerPhoto ? (bannerHostOf(img) || img) : null
      resize.active = true
      resize.startX = e.clientX
      resize.startY = e.clientY
      resize.startW = box.getBoundingClientRect().width
      resize.startH = box.getBoundingClientRect().height
      resize.startZoom = isLogoTarget(img) ? parseLogoZoom(zoomImg) : (bHost ? parseBannerZoom(bHost) : 1)
      resize.dir = 'se'
      resize.startLeft = parseFloat(box.style.left) || 0
      resize.startTop = parseFloat(box.style.top) || 0
      resize.mode = isSearchEl(img) ? 'search-width' : (bannerPhoto ? 'banner-zoom' : 'frame')
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
    if (isLogoTarget(el) || isLogoFrame(el) || isLogoImg(el)) {
      try {
        liftLogoOutOfHeading(el)
        var selFrame = logoFrameOf(el) || (isLogoFrame(el) ? el : null)
        if (selFrame && selFrame.getAttribute('data-pw-logo-user-size') !== '1') {
          var selSize = readLogoBoxSize(selFrame)
          applyLogoFrameSize(selFrame, selSize.w || 72, selSize.h || 28)
        }
        el = logoFrameOf(el) || el
      } catch (errSelLogo) {}
    }
    var same = selected === el
    if (!same) clearSelection()
    else clearForeignEditorMarks(el)
    if (hoverEl === el) {
      el.classList.remove('nanoai-ve-hover')
      hoverEl = null
    }
    selected = el
    selected.classList.add('nanoai-ve-highlight')
    selected.setAttribute('data-nanoai-ve-selected', '1')
    try { clearChatStickHeader(selected) } catch (errClearChatStick) {}
    if (isChromeFloatEl(selected)) revealChromeFloat(selected)
    if (isHeaderChromeEl(selected) && !isLogoTarget(selected) && !isChromeFloatEl(selected)) markUserMoved(searchMoveEl(selected) || selected)
    var payload = buildPayload(selected)
    if (canEditChromeLabel(selected)) {
      var labelEdit = chromeLabelEl(selected) || (isSearchSubmitEl(selected) ? selected : null)
      if (!labelEdit && selected.childNodes) {
        var onlyText = true
        var ci
        for (ci = 0; ci < selected.childNodes.length; ci++) {
          if (selected.childNodes[ci].nodeType === 1) {
            onlyText = false
            break
          }
        }
        if (onlyText) labelEdit = selected
      }
      if (labelEdit) {
        labelEdit.setAttribute('contenteditable', 'true')
        try { labelEdit.focus() } catch (errLab) {}
        if (ev && typeof ev.clientX === 'number' && labelEdit === selected) placeCaretAtPoint(selected, ev.clientX, ev.clientY)
      }
    } else if (canEditText(selected) || selected.getAttribute('data-pw-added-btn') === '1') {
      selected.setAttribute('contenteditable', 'true')
      if (ev && typeof ev.clientX === 'number') placeCaretAtPoint(selected, ev.clientX, ev.clientY)
      else {
        try { selected.focus() } catch (errFocus) {}
      }
    } else if (payload.isButton) {
      try { selected.focus({ preventScroll: true }) } catch (err) {
        try { selected.focus() } catch (err2) {}
      }
    }
    showMoveHandle(selected)
    if (canDeleteEl(selected)) showDeleteHandle(selected)
    if (payload.isImage || isAddedBg(selected) || isLogoFrame(selected) || isLogoTarget(selected) || isBgLayerEl(selected) || isSearchEl(selected) || (isBannerPhotoTarget(selected) && layerMode === 'image')) showResizeHandle(selected)
    showAlignGuides(logoMoveEl(selected) || selected)
    syncLayerSwitches()
    syncLogoButtons()
    syncLogoLayerVisual()
    try { syncBannerPhotoEdit() } catch (errPhoto2) {}
    payload.picked = true
    post('select', payload)
  }
  function pointInEl(el, x, y) {
    if (!el) return false
    try {
      var r = el.getBoundingClientRect()
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
    } catch (ePt) { return false }
  }
  function isBrandClusterEl(el) {
    if (!el || el.nodeType !== 1) return false
    var cls = clsOf(el)
    return cls.indexOf('pw-brand-cluster') >= 0 || cls.indexOf('pw-shop-brand-cluster') >= 0
  }
  function isPointerPassthrough(el) {
    if (!el || el.nodeType !== 1) return false
    if (isBrandClusterEl(el)) return true
    try {
      if (String(cs(el).pointerEvents || '') === 'none') return true
    } catch (ePe) {}
    return false
  }
  function clusterChildAtPoint(cluster, x, y) {
    if (!cluster || !cluster.querySelectorAll || !isFinite(x) || !isFinite(y)) return null
    var header = cluster.closest ? cluster.closest('header, .pw-header, .pw-shop-header') : null
    var scope = header || cluster
    var kids = scope.querySelectorAll('[data-pw-added-text],[data-pw-added-btn],[data-pw-el="title"],[data-pw-el="subtitle"],h1,h2,h3,p,img.pw-logo, img.pw-shop-logo, [data-pw-el="logo"], [data-pw-el="wordmark"], [data-pw-logo-added], [data-pw-logo-float], .pw-logo-frame, [data-pw-logo-frame], .pw-wordmark, [data-pw-el="cat-toggle"], [data-pw-cat-toggle], .pw-cat-btn, .pw-shop-cat-btn, a.pw-brand, a.pw-shop-brand, a[data-pw-logo-home], svg, [data-pw-el="search"], .pw-header-search, .pw-shop-search-wrap, [data-pw-el="account"], .pw-account-btn, [data-pw-account-toggle], [data-pw-el="cart"], [data-pw-chrome-btn], [data-pw-chrome-added], .pw-icon-btn, .pw-shop-icon-btn, .pw-search-submit, .pw-shop-search-submit, [data-pw-image-search], .pw-search-image-btn')
    var hits = []
    var i
    for (i = 0; i < kids.length; i++) {
      if (pointInEl(kids[i], x, y)) hits.push(kids[i])
    }
    if (!hits.length) return null
    for (i = 0; i < hits.length; i++) {
      if (hits[i].getAttribute && hits[i].getAttribute('data-pw-added-text') === '1') return hits[i]
    }
    var stack = []
    try { stack = document.elementsFromPoint(x, y) || [] } catch (eHit) { stack = [] }
    var s
    for (s = 0; s < stack.length; s++) {
      var node = stack[s]
      if (!node || node.nodeType !== 1) continue
      if (isIgnored(node) || isPointerPassthrough(node) || isBrandClusterEl(node) || isShopRegionHost(node) || isBgLayerEl(node) || isOverlayNode(node)) continue
      for (i = 0; i < hits.length; i++) {
        if (node === hits[i] || (hits[i].contains && hits[i].contains(node)) || (node.contains && node.contains(hits[i]))) return hits[i]
      }
      continue
    }
    return hits[0]
  }
  function resolvePointerTarget(start, x, y) {
    var chatAt = chatEmbedAtPoint(x, y)
    if (chatAt) return chatAt
    var chromeAt = headerChromeAtPoint(x, y)
    if (chromeAt) return chromeAt
    var stack = []
    try { stack = document.elementsFromPoint(x, y) || [] } catch (eStack) { stack = [] }
    var sawContent = false
    for (var i = 0; i < stack.length; i++) {
      var n = stack[i]
      if (!n || n.nodeType !== 1) continue
      if (!sceneFocusAllows(n)) continue
      if (isIgnored(n) || isBgLayerEl(n) || isOverlayNode(n)) continue
      if (n.classList && (n.classList.contains('nanoai-ve-layer-switch') || n.classList.contains('nanoai-ve-move-handle') || n.classList.contains('nanoai-ve-resize-handle'))) continue
      if (isPointerPassthrough(n)) continue
      if (n.getAttribute && n.getAttribute('data-pw-added-text') === '1') return n
      if (isAddedText(n) || (isTextEl(n) && !isHeroInnerOrCopy(n) && !isBrandClusterEl(n) && !isShopRegionHost(n))) return n
      if (isBrandClusterEl(n) || isShopRegionHost(n) || isBannerHostEl(n) || isHeroInnerOrCopy(n)) {
        var clusterHit = clusterChildAtPoint(n, x, y)
        if (clusterHit) return clusterHit
        if (isChromeBgHost(n) || isShopRegionHost(n)) return n
        continue
      }
      if (isAddedBg(n) || (n.closest && n.closest('[data-pw-added-bg="1"]'))) {
        if (!sawContent) return n.closest ? (n.closest('[data-pw-added-bg="1"]') || n) : n
        continue
      }
      var ownRegion = ownPwRegion(n)
      if (ownRegion === 'catalog' || ownRegion === 'categories') return n
      if (ownRegion && isNonBannerShopRegion(ownRegion)) continue
      return n
    }
    return start
  }
  function findCategoriesSelectable(start) {
    var walk = start
    if (walk && walk.nodeType !== 1) walk = walk.parentElement
    while (walk && walk !== document.body) {
      if (isTextEl(walk) || isImgEl(walk)) return walk
      var role = pwElOf(walk)
      if (role === 'section-title' || role === 'card' || role === 'card-name' || role === 'card-media') return walk
      if (walk.getAttribute && walk.getAttribute('data-pw-region') === 'categories') return walk
      walk = walk.parentElement
    }
    return start
  }
  function findSelectable(start, x, y) {
    var chatAt = chatEmbedAtPoint(x, y)
    if (chatAt) return chatAt
    var chromeAt = headerChromeAtPoint(x, y)
    if (chromeAt) return chromeAt
    var logoAt = logoUnitAtPoint(x, y)
    if (logoAt) {
      liftLogoOutOfHeading(logoAt)
      return logoFrameOf(logoAt) || logoAt
    }
    var el = start
    if (el && el.nodeType !== 1) el = el.parentElement
    if (isBrandClusterEl(el) || isShopRegionHost(el)) {
      var fromHost = clusterChildAtPoint(el, x, y)
      if (fromHost) el = fromHost
      else if (isChromeBgHost(el) || isShopRegionHost(el)) return chromeBgHostOf(el) || el
    }
    if (isAddedBg(el) || (el && el.closest && el.closest('[data-pw-added-bg="1"]'))) {
      return el.closest ? (el.closest('[data-pw-added-bg="1"]') || el) : el
    }
    if (pwRegionOf(el) === 'categories') return findCategoriesSelectable(el)
    if (isLockedCatalogEl(el) || isProductCardEl(el)) return null
    var walk = el
    while (walk && walk !== document.body) {
      if (isBrandClusterEl(walk)) {
        walk = walk.parentElement
        continue
      }
      if (walk.getAttribute && walk.getAttribute('data-pw-added-text') === '1') return walk
      var catHost = catToggleElOf(walk)
      if (catHost) return catHost
      var searchSubmit = searchSubmitElOf(walk)
      if (searchSubmit) return searchSubmit
      var searchImage = searchImageElOf(walk)
      if (searchImage) return searchImage
      var dotsHost = dotsElOf(walk)
      if (dotsHost) return dotsHost
      var fieldHost = fieldElOf(walk)
      if (fieldHost) return fieldHost
      var badgeHost = badgeElOf(walk)
      if (badgeHost) return badgeHost
      if (isWordmarkTextEl(walk)) return walk
      var bottomItem = bottomNavItemOf(walk)
      if (bottomItem) return bottomItem
      if (isChromeBtn(walk) || isAddedChrome(walk) || (walk.closest && walk.closest('.pw-icon-btn,.pw-shop-icon-btn,[data-pw-chrome-btn],[data-pw-chrome-added]'))) {
        if (searchElOf(walk) && !(walk.closest && walk.closest('.pw-header-actions, .pw-shop-header-actions'))) {
          return searchElOf(walk)
        }
        return walk.closest ? (walk.closest('.pw-icon-btn,.pw-shop-icon-btn,[data-pw-chrome-btn],[data-pw-chrome-added]') || walk) : walk
      }
      if (isSearchEl(walk) || searchElOf(walk)) return searchElOf(walk) || walk
      if (walk.getAttribute && walk.getAttribute('data-pw-logo-added') === '1') return walk
      if (walk.getAttribute && walk.getAttribute('data-pw-logo-home') === '1') {
        var homeLogo = walk.querySelector ? walk.querySelector('img.pw-logo, img.pw-shop-logo, img.pw-shop-footer-logo, img.site-logo, [data-pw-logo-added]') : null
        if (homeLogo) return logoFrameOf(homeLogo) || homeLogo
      }
      if (isLogoFrame(walk)) return logoImgOf(walk) || walk
      if (isLogoImg(walk)) return walk
      var navHost = walk.closest ? walk.closest('[data-pw-el="nav-link"],[data-pw-el="link"],[data-pw-el="crumb"]') : null
      if (navHost) return navHost
      var footerLink = walk.tagName && walk.tagName.toLowerCase() === 'a' ? walk : (walk.closest ? walk.closest('a') : null)
      if (footerLink && pwRegionOf(footerLink) === 'footer' && canSetHrefEl(footerLink) && !isBrandLink(footerLink) && !isLogoSlot(footerLink)) return footerLink
      if (isLockedCatalogEl(walk) || isProductCardEl(walk)) {
        walk = walk.parentElement
        continue
      }
      if (isBgLayerEl(walk) || isOverlayNode(walk)) {
        walk = walk.parentElement
        continue
      }
      if (isHeaderWidget(walk)) return walk
      var ownRegion = walk.getAttribute && walk.getAttribute('data-pw-region')
      if (ownRegion === 'categories') return findCategoriesSelectable(el)
      if (ownRegion && isNonBannerShopRegion(ownRegion) && ownRegion !== 'catalog') {
        if (walk === el) return null
        walk = walk.parentElement
        continue
      }
      if (isBannerLeafEl(walk) || isTextEl(walk) || isBtnEl(walk)) return walk
      if (layerMode !== 'image' && (isMoveBlockEl(walk) || pwElOf(walk) === 'copy')) return walk
      var walkBanner = bannerHostOf(walk)
      if (walkBanner) {
        setAttrIfEmpty(walkBanner, 'data-pw-region', 'banner')
        if (layerMode === 'image') {
          ensureImageLayer(walkBanner)
          return bannerLayerTarget(walkBanner, 'image')
        }
        return walkBanner
      }
      if (isImgEl(walk)) return walk
      walk = walk.parentElement
    }
    walk = el
    while (walk && walk !== document.body) {
      if (isBgLayerEl(walk)) {
        var layerBanner = bannerHostOf(walk)
        if (layerBanner && layerMode === 'block') return layerBanner
        return walk
      }
      walk = walk.parentElement
    }
    var banner = bannerHostOf(el)
    if (banner) {
      setAttrIfEmpty(banner, 'data-pw-region', 'banner')
      ensureImageLayer(banner)
      if (layerMode === 'block') return banner
      return bannerLayerTarget(banner, 'image')
    }
    var bgHost = findBgImageEl(el)
    if (bgHost) {
      var layer = bgHost.querySelector ? bgHost.querySelector('[data-pw-bg-layer="1"]') : null
      return layer || bgHost
    }
    walk = el
    while (walk && walk !== document.body) {
      if (looksLikeBannerHost(walk) || canImageLayer(walk)) {
        ensureImageLayer(walk)
        ensureMoveBlock(walk)
        return ensureImageLayer(walk) || imageTargetOf(walk) || walk
      }
      if (isContentBlockEl(walk)) return walk
      walk = walk.parentElement
    }
    return closestEditable(el) || closestEditable(start)
  }
  function closestEditable(start) {
    var n = start
    if (n && n.nodeType !== 1) n = n.parentElement
    while (n && n !== document.body) {
      if (isIgnored(n) || isBgLayerEl(n) || isOverlayNode(n) || isPointerPassthrough(n) || isBrandClusterEl(n) || isShopRegionHost(n)) {
        n = n.parentElement
        continue
      }
      var cat = catToggleElOf(n)
      if (cat) return cat
      if (isLogoFrame(n) || isLogoImg(n) || (n.getAttribute && n.getAttribute('data-pw-logo-added') === '1')) return logoImgOf(n) || n
      var role = pwElOf(n)
      if (role === 'nav-link' || role === 'link' || role === 'crumb' || role === 'logo' || role === 'wordmark' || role === 'cat-toggle' || role === 'title' || role === 'subtitle' || role === 'cta' || role === 'cta-secondary' || role === 'badge' || role === 'search' || role === 'account' || role === 'cart') return n
      if (n.tagName && n.tagName.toLowerCase() === 'a' && n.closest && n.closest('.pw-nav-main, .pw-shop-nav-row, .pw-topbar, .pw-shop-topbar, .pw-cat-panel, .pw-shop-cat-panel')) return n
      if (isHeaderWidget(n) || isChromeBtn(n) || isSearchEl(n) || isTextEl(n) || isBtnEl(n) || isImgEl(n)) return n
      n = n.parentElement
    }
    return null
  }
  function resolveBannerClickTarget(found, host) {
    if (!found) return null
    if (isBannerLeafEl(found) || isTextEl(found) || isBtnEl(found)) return found
    if (layerMode === 'image' || isBgLayerEl(found) || pwElOf(found) === 'media') {
      return bannerLayerTarget(host, 'image') || found
    }
    if (isMoveBlockEl(found) || pwElOf(found) === 'copy') return found
    return host || found
  }
  function onMouseDown(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (e.button !== 0) return
    if (logoCrop.live && isLiveCropNode(e.target)) {
      beginLiveCropPointer(e)
      return
    }
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
    var chatHit = chatEmbedAtPoint(e.clientX, e.clientY)
    if (chatHit) {
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      if (selected !== chatHit) selectEl(chatHit, e)
      return
    }
    if (isIgnored(e.target) || isOverlayNode(e.target)) return
    var pointerTarget = resolvePointerTarget(e.target, e.clientX, e.clientY)
    var found = findSelectable(pointerTarget, e.clientX, e.clientY)
    if (found && isShopRegionHost(found)) {
      var hostChild = clusterChildAtPoint(found, e.clientX, e.clientY)
      if (hostChild) {
        found = hostChild
      } else {
        e.preventDefault()
        e.stopPropagation()
        if (e.stopImmediatePropagation) e.stopImmediatePropagation()
        var bgHost = chromeBgHostOf(found) || found
        if (selected !== bgHost) selectEl(bgHost, e)
        beginHandleDrag(e)
        return
      }
    }
    if (found && chatEmbedLauncherOf(found)) {
      e.preventDefault()
      e.stopPropagation()
      if (selected !== found) selectEl(found, e)
      return
    }
    if (found && isEditableTextTarget(found)) {
      return
    }
    if (found && selected && isAddedBg(selected) && (found === selected || (selected.contains && selected.contains(found)))) {
      beginHandleDrag(e)
      return
    }
    if (found && isHeaderChromeEl(found) && !isLogoTarget(found) && !logoCrop.live) {
      var typeTarget = e.target
      var labelHit = chromeLabelEl(found)
      var searchHost = searchElOf(found)
      if (searchHost && (isSearchEl(found) || found === searchHost)) {
        e.preventDefault()
        e.stopPropagation()
        if (e.stopImmediatePropagation) e.stopImmediatePropagation()
        if (selected !== searchHost) selectEl(searchHost, e)
        beginHandleDrag(e)
        return
      }
      if (labelHit && (typeTarget === labelHit || (labelHit.contains && labelHit.contains(typeTarget)))) {
        if (selected !== found) selectEl(found, e)
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (e.stopImmediatePropagation) e.stopImmediatePropagation()
      if (selected !== found) selectEl(found, e)
      beginHandleDrag(e)
      return
    }
    if (found && selected && isLogoTarget(selected) && (found === selected || logoFrameOf(found) === logoFrameOf(selected) || (selected.contains && selected.contains(found)) || (found.contains && found.contains(selected)))) {
      beginHandleDrag(e)
      return
    }
    if (found && selected && !isLogoTarget(selected)) {
      var selectedBanner = bannerHostOf(selected)
      var foundBanner = bannerHostOf(found)
      if (selectedBanner && foundBanner && selectedBanner === foundBanner && pointInEl(selectedBanner, e.clientX, e.clientY)) {
        var nextBanner = resolveBannerClickTarget(found, selectedBanner)
        if (nextBanner && nextBanner !== selected) return
        if (isBannerLeafEl(selected) || isTextEl(selected) || isBtnEl(selected) || isMoveBlockEl(selected) || pwElOf(selected) === 'copy') {
          layerMode = 'block'
        }
        beginHandleDrag(e)
        return
      }
      if (layerMode === 'image' || isBgLayerEl(selected) || isBgLayerEl(found)) {
        var imgPick2 = isBgLayerEl(found) ? found : (isBgLayerEl(selected) ? selected : null)
        var imgBanner = imgPick2 ? (bannerHostOf(imgPick2) || imgPick2.parentElement) : null
        if (imgPick2 && imgBanner && pointInEl(imgBanner, e.clientX, e.clientY) && (found === imgPick2 || found === selected || (selected.contains && selected.contains(found)))) {
          selected = imgPick2
          beginHandleDrag(e)
          return
        }
      } else {
        var dragHost = isContentBlockEl(selected) ? selected : findContentBlockEl(selected)
        var movePick = isMoveBlockEl(selected) ? selected : (dragHost ? ensureMoveBlock(dragHost) : null)
        if (movePick && (found === movePick || movePick.contains(found) || found === selected || (selected.contains && selected.contains(found)))) {
          selected = movePick
          beginHandleDrag(e)
          return
        }
        if (layerMode === 'block' && isContentBlockEl(selected) && canImageLayer(selected) && (found === selected || selected.contains(found))) {
          beginHandleDrag(e)
          return
        }
      }
    }
  }
  function onDblClick(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (isIgnored(e.target) || isOverlayNode(e.target)) return
    var pointerTarget = resolvePointerTarget(e.target, e.clientX, e.clientY)
    var found = findSelectable(pointerTarget, e.clientX, e.clientY)
    var host = found ? searchElOf(found) : null
    if (!host || !isSearchEl(host)) return
    e.preventDefault()
    e.stopPropagation()
    if (selected !== host) selectEl(host, e)
    beginSearchPlaceholderEdit(host)
  }
  function onClick(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (logoDraw.on) { e.preventDefault(); e.stopPropagation(); return }
    if (skipClick) { skipClick = false; e.preventDefault(); e.stopPropagation(); return }
    if (isIgnored(e.target) || isOverlayNode(e.target)) return
    var t = resolvePointerTarget(e.target, e.clientX, e.clientY)
    if (isIgnored(t) || isOverlayNode(t)) return
    var found = findSelectable(t, e.clientX, e.clientY)
    if (!found) found = closestEditable(t) || closestEditable(e.target)
    if (selected && selected.contains(t) && !drag.active) {
      var liveEdit = selected.getAttribute('contenteditable') === 'true' || (t.getAttribute && t.getAttribute('contenteditable') === 'true') || (t.getAttribute && t.getAttribute('data-pw-edit-placeholder') === '1')
      if (liveEdit && (!found || found === selected)) return
    }
    e.preventDefault()
    e.stopPropagation()
    if (e.stopImmediatePropagation) e.stopImmediatePropagation()
    if (found && productActionChromeOf(found)) {
      selectEl(productActionChromeOf(found), e)
      return
    }
    if (isLockedCatalogEl(t) || isProductCardEl(t)) {
      clearSelection()
      post('deselect', {})
      return
    }
    if (e.shiftKey) {
      var block = findContentBlockEl(t) || findBlockEl(t)
      if (block) { layerMode = 'block'; selectEl(block, e); return }
    }
    if (found) {
      if (selected === found && (isChromeBtn(found) || isHeaderWidget(found) || isAddedChrome(found))) {
        var again = buildPayload(found)
        again.picked = true
        post('select', again)
        return
      }
      if (isLogoTarget(found)) {
        selectEl(found, e)
        return
      }
      var foundHost = bannerHostOf(found)
      if (foundHost) {
        setAttrIfEmpty(foundHost, 'data-pw-region', 'banner')
        ensureImageLayer(foundHost)
        if (isBannerLeafEl(found) || isTextEl(found) || isBtnEl(found)) {
          layerMode = 'block'
          selectEl(found, e)
          return
        }
        if (layerMode === 'image') {
          selectEl(bannerLayerTarget(foundHost, 'image'), e)
          return
        }
        if (isMoveBlockEl(found) || pwElOf(found) === 'copy') {
          selectEl(found, e)
          return
        }
        selectEl(foundHost, e)
        return
      }
      selectEl(found, e)
      return
    }
    var emptyBlock = findContentBlockEl(t) || bannerHostOf(t)
    if (emptyBlock && (isBannerHostEl(emptyBlock) || looksLikeBannerHost(emptyBlock))) {
      setAttrIfEmpty(emptyBlock, 'data-pw-region', 'banner')
      ensureImageLayer(emptyBlock)
      if (layerMode === 'block') selectEl(emptyBlock, e)
      else selectEl(bannerLayerTarget(emptyBlock, 'image'), e)
      return
    }
    if (emptyBlock && canImageLayer(emptyBlock)) {
      ensureImageLayer(emptyBlock)
      if (layerMode === 'image') selectEl(ensureImageLayer(emptyBlock) || imageTargetOf(emptyBlock) || emptyBlock, e)
      else selectEl(emptyBlock, e)
      return
    }
    if (emptyBlock) { selectEl(emptyBlock, e); return }
    clearSelection()
    post('deselect', {})
  }
  function onInput(e) {
    if (!selected) return
    var t = e && e.target
    if (t && t.getAttribute && t.getAttribute('data-pw-edit-placeholder') === '1') {
      var typed = String(t.value || '').trim()
      if (typed) t.setAttribute('placeholder', typed)
      post('dirty', {})
      post('select', buildPayload(selected))
      return
    }
    var lab = chromeLabelEl(selected)
    var editing = (selected.getAttribute('contenteditable') === 'true') || (lab && lab.getAttribute('contenteditable') === 'true') || (t && t.getAttribute && t.getAttribute('contenteditable') === 'true')
    if (!editing) return
    if (lab && (t === lab || lab.getAttribute('contenteditable') === 'true')) {
      var next = String(lab.textContent || '').replace(/\s+/g, ' ').trim()
      if (next) {
        selected.setAttribute('aria-label', next)
        selected.setAttribute('title', next)
      }
    }
    post('dirty', {})
    post('select', buildPayload(selected))
  }
  function onMouseOver(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    var t = resolvePointerTarget(e.target, e.clientX, e.clientY)
    if (isIgnored(t)) return
    var found = findSelectable(t, e.clientX, e.clientY)
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
    if (logoCrop.on) return
    if (logoDraw.on && logoDraw.dragging) {
      e.preventDefault()
      logoDraw.x2 = e.clientX
      logoDraw.y2 = e.clientY
      showLogoDrawRect()
      return
    }
    if (resize.active && selected && (isSearchEl(selected) || isAddedBg(selected) || isImgEl(selected) || isLogoFrame(selected) || isLogoTarget(selected) || isBgLayerEl(selected) || isBannerPhotoTarget(selected))) {
      var dx = e.clientX - resize.startX
      var dy = e.clientY - resize.startY
      if (resize.mode === 'search-width' || isSearchEl(selected)) {
        markUserMoved(selected)
        lockSearchBox(selected, resize.startW + dx)
        positionAllHandles()
        post('dirty', {})
        return
      }
      var frame = logoFrameOf(selected)
      var zoomImg = logoImgOf(selected) || selected
      if (isLogoTarget(selected)) {
        var dir = resize.dir || 'se'
        var fw = resize.startW
        var fh = resize.startH
        if (dir.indexOf('e') >= 0) fw += dx
        if (dir.indexOf('w') >= 0) fw -= dx
        if (dir.indexOf('s') >= 0) fh += dy
        if (dir.indexOf('n') >= 0) fh -= dy
        fw = Math.max(24, Math.round(fw))
        fh = Math.max(18, Math.round(fh))
        frame = logoFrameOf(selected) || (zoomImg && logoFrameOf(zoomImg)) || frame
        var sizeEl = (isInHeader(selected) && headerLogoUnit(selected)) || frame || selected
        if (frame) applyLogoFrameSize(frame, fw, fh, true)
        else {
          sizeEl.style.setProperty('width', fw + 'px', 'important')
          sizeEl.style.setProperty('height', fh + 'px', 'important')
          if (sizeEl.setAttribute) sizeEl.setAttribute('data-pw-logo-user-size', '1')
        }
        if (dir.indexOf('w') >= 0) sizeEl.style.setProperty('left', Math.round(resize.startLeft + (resize.startW - fw)) + 'px', 'important')
        if (dir.indexOf('n') >= 0) sizeEl.style.setProperty('top', Math.round(resize.startTop + (resize.startH - fh)) + 'px', 'important')
      } else if (resize.mode === 'banner-zoom' || (isBannerPhotoTarget(selected) && !isImgEl(selected))) {
        var hostZ = bannerHostOf(selected) || selected.parentElement || selected
        var nextBannerZoom = resize.startZoom * Math.max(0.5, 1 + dx / 90 + dy / 90)
        var panZ = parseBannerPan(hostZ)
        applyBannerPhoto(hostZ, nextBannerZoom, panZ.x, panZ.y)
      } else if (isBgLayerEl(selected) && !isImgEl(selected)) {
        var hostR = selected.parentElement || selected
        var base = Math.max(1, resize.startW)
        var pct = Math.max(40, Math.min(220, Math.round((base + dx) / base * 100)))
        hostR.style.backgroundSize = '100% ' + pct + '%'
      } else {
        var nw = Math.max(24, resize.startW + dx)
        var nh = Math.max(18, resize.startH + dy)
        selected.style.width = nw + 'px'
        selected.style.height = nh + 'px'
        selected.style.maxWidth = 'none'
        selected.style.maxHeight = 'none'
      }
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
        if (isSearchEl(selected) || isHeaderChromeEl(selected)) markUserMoved(searchMoveEl(selected))
        if (isAddedChrome(selected) || isChromeBtn(selected) || isHeaderWidget(selected)) selected.style.pointerEvents = 'none'
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
    var logoDrag = drag.mode
    if (isLogoTarget(selected) && logoDrag !== 'logo-box' && logoDrag !== 'logo-pan') {
      logoDrag = logoCrop.live ? 'logo-pan' : 'logo-box'
    }
    if (logoDrag === 'logo-pan') {
      applyLogoPan(logoImgOf(selected) || selected, drag.baseX + dx2, drag.baseY + dy)
    } else if (logoDrag === 'logo-box') {
      var moveEl = (isInHeader(selected) && headerLogoUnit(selected)) || logoMoveEl(selected) || selected
      moveEl.style.transform = 'translate(' + (drag.baseX + dx2) + 'px,' + (drag.baseY + dy) + 'px)'
      clampTranslateToViewport(moveEl, drag.baseX + dx2, drag.baseY + dy)
      if (!isLogoTarget(selected)) snapSelected()
    } else if (drag.mode === 'bg-pan' || (layerMode === 'image' && bannerHostOf(selected) && !isBannerLeafEl(selected) && !isMoveBlockEl(selected) && !isTextEl(selected) && !isBtnEl(selected))) {
      var panHost2 = bannerHostOf(selected) || selected.parentElement || selected
      if (isBannerHostEl(selected)) selected.classList.remove('nanoai-ve-dragging')
      var pr2 = panHost2.getBoundingClientRect()
      var px2 = Math.max(0, Math.min(100, drag.baseX - (dx2 / Math.max(1, pr2.width)) * 80))
      var py2 = Math.max(0, Math.min(100, drag.baseY - (dy / Math.max(1, pr2.height)) * 80))
      applyBannerPhoto(panHost2, parseBannerZoom(panHost2), px2, py2)
    } else if (isBannerHostEl(selected)) {
      clampTranslateToViewport(selected, drag.baseX + dx2, drag.baseY + dy)
      snapSelected()
    } else if (drag.mode === 'search-slot') {
      return
    } else if (drag.mode === 'reorder') {
      selected.style.opacity = '0.55'
      updateDropTarget(e)
    } else {
      clampTranslateToViewport(searchMoveEl(selected) || selected, drag.baseX + dx2, drag.baseY + dy)
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
      if (selected && (isImgEl(selected) || isBgLayerEl(selected) || isSearchEl(selected))) post('select', buildPayload(selected))
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
      if ((isAddedChrome(selected) || isChromeBtn(selected)) && !isSearchEl(selected) && searchElOf(selected) !== selected) {
        var unitUp = chromeReorderUnit(selected)
        var host = chromeDropHostFromPoint(drag.lastX, drag.lastY) || drag.dropHost
        if (host) {
          var slot = chromeSlotAtX(host, drag.lastX, unitUp)
          snapChromeToHost(unitUp, host, slot.beforeEl, slot.before)
        }
      } else if (drag.dropTarget) applyReorder()
      selected.style.opacity = ''
      if (selected) selected.style.pointerEvents = ''
    } else if (wasDrag && selected) {
      selected.style.opacity = ''
      selected.style.pointerEvents = ''
      if (isChromeFloatEl(selected) || isPinScreenOn(selected)) bakeChromeFloatPos(chromeBtnElOf(selected) || selected)
      else if (mode === 'translate' && isHeaderChromeEl(selected)) markUserMoved(searchMoveEl(selected))
    }
    hideDropLine()
    drag.dropTarget = null
    if (wasDrag) skipClick = true
    stickHeaderPause(0)
    if (wasDrag && selected && isLogoTarget(selected) && isInHeader(selected)) {
      var bake = headerLogoUnit(selected)
      var bakeHeader = bake && bake.closest ? bake.closest('header, .pw-header, .pw-shop-header') : null
      if (bake && bakeHeader && bake.getAttribute('data-pw-logo-float') === '1') {
        var bakeHost = headerMainOf(bakeHeader) || bakeHeader
        ensureHeaderLogoHostPos(bakeHost)
        if (bake.parentNode !== bakeHost) bakeHost.appendChild(bake)
        var bakeHr = bakeHost.getBoundingClientRect()
        var bakeR = bake.getBoundingClientRect()
        bake.style.setProperty('left', Math.max(0, Math.round(bakeR.left - bakeHr.left)) + 'px', 'important')
        bake.style.setProperty('top', Math.max(0, Math.round(bakeR.top - bakeHr.top)) + 'px', 'important')
        bake.style.removeProperty('transform')
      }
    }
    if (wasDrag && selected && canDragEl(selected)) {
      stickHeaderApplyEl(selected)
      positionAllHandles()
      post('select', buildPayload(selected))
      post('dirty', {})
    } else {
      stickHeaderSync()
    }
  }
  function injectStyles() {
    var s = document.getElementById('nanoai-visual-editor-styles')
    if (!s) {
      s = document.createElement('style')
      s.id = 'nanoai-visual-editor-styles'
      if (document.head) document.head.appendChild(s)
      else document.documentElement.appendChild(s)
    }
    s.textContent = [
      '.nanoai-ve-active{cursor:crosshair!important}',
      '.nanoai-ve-logo-draw,.nanoai-ve-logo-draw *{cursor:crosshair!important}',
      '.nanoai-ve-logo-rect{position:fixed!important;z-index:2147483646!important;pointer-events:none;border:2px dashed #f59e0b;background:rgba(245,158,11,.14)}',
      '.nanoai-ve-highlight{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '@keyframes nanoai-ve-chrome-dup-pulse{0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.55)}50%{box-shadow:0 0 0 10px rgba(37,99,235,0)}}',
      '.nanoai-ve-chrome-dup{outline:2px solid #2563eb!important;outline-offset:2px!important;animation:nanoai-ve-chrome-dup-pulse .7s ease 2}',
      '.nanoai-ve-hover{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '.nanoai-ve-highlight[data-pw-bg-layer="1"],.nanoai-ve-hover[data-pw-bg-layer="1"]{outline:2px dashed #f59e0b!important}',
      'html,body{overflow-x:hidden!important;max-width:100%}',
      '.pw-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-shop-header .pw-icon-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-header-actions [data-pw-chrome-btn]:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]):not([data-pw-chrome-float]),.pw-cat-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]),.pw-account-btn:not(.pw-stick-header-on):not([data-pw-user-move]):not([data-nanoai-ve-selected]){transform:none!important;left:auto!important;top:auto!important}',
      '[data-pw-chrome-float="1"],[data-pw-pin-screen="1"]{position:fixed!important;z-index:${PW_CHROME_FLOAT_Z_INDEX}!important;isolation:isolate!important;pointer-events:auto!important}',
      ${JSON.stringify(PARTNER_SHOP_CHROME_FLOAT_CSS)},
      '.nanoai-ve-highlight[data-pw-region="banner"],.nanoai-ve-hover[data-pw-region="banner"]{outline:2px dashed #2563eb!important}',
      '.nanoai-ve-highlight[data-pw-move-block="1"],.nanoai-ve-hover[data-pw-move-block="1"]{outline:2px dashed #2563eb!important}',
      '[contenteditable=true]{cursor:text!important;min-width:0;outline:none!important}',
      '.nanoai-ve-active [data-pw-seo-coach="1"],.nanoai-ve-active .pw-seo-coach,.nanoai-ve-active [data-pw-article-editor="1"],.nanoai-ve-active .pw-article-editor{display:block!important;visibility:visible!important;height:auto!important;max-height:none!important;overflow:visible!important;opacity:1!important;margin:6px 0 8px!important;padding:6px 8px!important;border:1px solid #e2e8f0!important;border-radius:8px!important;background:#f8fafc!important;color:#0f172a!important;max-width:720px!important;width:100%!important;box-sizing:border-box!important;position:relative!important;z-index:5!important;box-shadow:none!important}',
      '.nanoai-ve-active [data-pw-article-box="1"],.nanoai-ve-active [data-pw-info-body="1"]{display:block!important;outline:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;max-width:720px;width:100%;box-sizing:border-box;min-height:0;background:#fff}',
      '[data-pw-info-article="1"],[data-pw-region="content"][data-pw-text-article="1"]{max-width:720px}',
      '.pw-article-editor-tools{display:flex!important;flex-wrap:wrap;align-items:center;gap:6px;margin:0}',
      '.pw-seo-coach-title{margin:0 4px 0 0;font-size:11px;font-weight:700;color:#334155;white-space:nowrap}',
      '.pw-article-editor-tools button{appearance:none;border:0;border-radius:6px;padding:5px 9px;background:#0f172a;color:#fff;font-size:11px;font-weight:600;cursor:pointer;line-height:1.2}',
      '.pw-article-editor-tools button.pw-article-editor-secondary{background:#fff;color:#0f172a;border:1px solid #cbd5e1}',
      '.pw-article-editor-tools button:disabled{opacity:.45;cursor:not-allowed}',
      '.pw-article-editor-field{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#64748b}',
      '.pw-article-editor-field input[type="color"]{width:22px;height:20px;padding:0;border:1px solid #cbd5e1;border-radius:4px;background:#fff}',
      '.pw-article-editor-field input[type="range"]{width:72px}',
      '.pw-article-editor-more{margin-top:6px}',
      '.pw-article-editor textarea,.pw-seo-coach textarea{display:block!important;width:100%;min-height:40px;margin:0;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:11px;line-height:1.4;resize:vertical;box-sizing:border-box;background:#fff;color:#0f172a}',
      '.pw-seo-coach-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.pw-seo-coach-row button{appearance:none;border:0;border-radius:8px;padding:8px 12px;background:#0f172a;color:#fff;font-size:12px;font-weight:600;cursor:pointer}',
      '.pw-seo-coach-row button:disabled{opacity:.6;cursor:wait}',
      '[contenteditable=true].nanoai-ve-highlight,[contenteditable=true].nanoai-ve-hover{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '.nanoai-ve-highlight.pw-btn,.nanoai-ve-highlight[data-pw-added-btn],.nanoai-ve-hover.pw-btn,.nanoai-ve-hover[data-pw-added-btn]{outline:1px dashed #2563eb!important;outline-offset:0!important}',
      '[data-pw-added-text]:not([data-pw-z]){display:inline-block!important;width:auto!important;max-width:100%;margin:0;padding:0;line-height:1.25;white-space:nowrap;z-index:250}',
      '[data-pw-added-btn]:not([data-pw-z]){display:inline-flex!important;width:max-content!important;max-width:100%;height:auto!important;margin:0;align-items:center;justify-content:center;white-space:nowrap;z-index:250}',
      '[data-pw-added-bg="1"]{position:absolute;box-sizing:border-box;pointer-events:auto;border:0}',
      '.nanoai-ve-highlight[data-pw-added-bg="1"],.nanoai-ve-hover[data-pw-added-bg="1"]{outline:2px dashed #2563eb!important}',
      '.pw-btn-outline{background:transparent;border-radius:12px;border-style:solid;border-width:2px}',
      '.nanoai-ve-dragging,.nanoai-ve-dragging *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}',
      '.nanoai-ve-resize-handle,.nanoai-ve-move-handle,.nanoai-ve-chrome-delete,.nanoai-ve-delete-handle,.nanoai-ve-drop-line,.nanoai-ve-guides,.nanoai-ve-logo-btn{position:fixed!important;z-index:2147483646!important;pointer-events:auto}',
      '.nanoai-ve-layer-switch{position:fixed!important;z-index:210!important;pointer-events:auto}',
      '.nanoai-ve-layer-switch[data-ve-logo-switch="1"]{z-index:210!important}',
      '.nanoai-ve-layer-switch[data-ve-clipped="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}',
      '.nanoai-ve-guides,.nanoai-ve-drop-line{pointer-events:none!important}',
      '.nanoai-ve-resize-handle{width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:2px;cursor:nwse-resize;box-shadow:0 1px 4px rgba(0,0,0,.3)}',
      '.nanoai-ve-resize-handle.is-logo-frame{background:#2563eb}',
      '.nanoai-ve-resize-handle.is-banner-zoom{background:#f59e0b;cursor:nwse-resize}',
      '.nanoai-ve-resize-handle.is-search-width{cursor:ew-resize;width:16px;height:16px;border-radius:999px}',
      '.nanoai-ve-highlight.pw-header-search,.nanoai-ve-highlight.pw-shop-search-wrap,.nanoai-ve-hover.pw-header-search,.nanoai-ve-hover.pw-shop-search-wrap{outline:2px dashed #2563eb!important}',
      '.nanoai-ve-active img.pw-logo.nanoai-ve-highlight,.nanoai-ve-active img.pw-shop-logo.nanoai-ve-highlight,.nanoai-ve-active img.pw-shop-footer-logo.nanoai-ve-highlight,.nanoai-ve-active [data-pw-logo-added].nanoai-ve-highlight{outline:2px solid #2563eb!important;outline-offset:1px!important;box-shadow:none!important;cursor:grab!important}',
      '.nanoai-ve-active [data-pw-logo-frame="1"].nanoai-ve-highlight,.nanoai-ve-active .pw-logo-frame.nanoai-ve-highlight{outline:2px solid #fff!important;outline-offset:0!important;box-shadow:0 0 0 2px #2563eb!important;cursor:grab!important;overflow:hidden!important}',
      '.nanoai-ve-active [data-pw-logo-frame="1"].nanoai-ve-highlight img,.nanoai-ve-active .pw-logo-frame.nanoai-ve-highlight img{cursor:grab!important}',
      '.nanoai-ve-move-handle{box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 16px!important;width:16px!important;height:16px!important;min-width:16px!important;max-width:16px!important;min-height:16px!important;max-height:16px!important;padding:0!important;border:1.5px solid #fff!important;border-radius:5px!important;background:#2563eb!important;color:#fff!important;cursor:grab!important;box-shadow:0 1px 3px rgba(0,0,0,.28)!important;appearance:none!important;-webkit-appearance:none!important;line-height:1!important;transform:none!important}',
      '.nanoai-ve-move-handle svg{display:block;width:10px!important;height:10px!important;pointer-events:none}',
      '.nanoai-ve-layer-switch{display:flex;gap:4px;padding:3px;border-radius:8px;background:#fff;border:1px solid #bfdbfe;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
      '.nanoai-ve-layer-switch button{border:0;border-radius:6px;padding:5px 9px;font:700 11px/1.2 system-ui,sans-serif;background:transparent;color:#1e3a8a;cursor:pointer}',
      '.nanoai-ve-layer-switch button.is-active{background:#2563eb;color:#fff}',
      '.nanoai-ve-logo-btn{display:flex;padding:3px;border-radius:8px;background:#fff;border:1px solid #fbbf24;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
      '.nanoai-ve-logo-btn button{border:0;border-radius:6px;padding:5px 9px;font:700 11px/1.2 system-ui,sans-serif;background:#f59e0b;color:#fff;cursor:pointer}',
      '.nanoai-ve-chrome-delete,.nanoai-ve-delete-handle{box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 16px!important;width:16px!important;height:16px!important;min-width:16px!important;max-width:16px!important;min-height:16px!important;max-height:16px!important;padding:0!important;border:1.5px solid #fff!important;border-radius:999px!important;background:#ef4444!important;color:#fff!important;font:700 11px/12px system-ui,sans-serif!important;cursor:pointer!important;transform:rotate(45deg)!important;box-shadow:0 1px 3px rgba(0,0,0,.28)!important;appearance:none!important;-webkit-appearance:none!important}',
      '.nanoai-ve-drop-line{background:#2563eb;border-radius:2px;box-shadow:0 0 0 1px #fff}',
      '.nanoai-ve-guides{left:0;top:0}',
      '.nanoai-ve-active .pw-bottom-nav,.nanoai-ve-active .pw-shop-bottom-nav,[data-pw-edit-device="tablet"] .pw-bottom-nav,[data-pw-edit-device="tablet"] .pw-shop-bottom-nav,.nanoai-ve-tablet .pw-bottom-nav,.nanoai-ve-tablet .pw-shop-bottom-nav{position:fixed!important;left:0;right:0;bottom:0;z-index:180!important;overflow:visible!important;isolation:isolate;background:#fff}',
      '.nanoai-ve-active #nanoai-chat-widget-v1,.nanoai-ve-active [data-widget-id="nanoai-chat-widget-v1"]{pointer-events:none!important}',
      '.nanoai-ve-active [data-pw-chat-launcher="1"],.nanoai-ve-active .pw-fab-chat,.nanoai-ve-active [data-nanoai-chat-bubble="1"]{pointer-events:auto!important;cursor:pointer!important;z-index:2147483001!important}',
      '.nanoai-ve-active #nanoai-chat-widget-v1 .nanoai-chat-panel,.nanoai-ve-active [data-widget-id="nanoai-chat-widget-v1"] .nanoai-chat-panel{display:none!important}',
      '.nanoai-ve-active [data-pw-chat-launcher="1"].nanoai-ve-highlight,.nanoai-ve-active .pw-fab-chat.nanoai-ve-highlight,.nanoai-ve-active [data-nanoai-chat-bubble="1"].nanoai-ve-highlight{outline:2px solid #2563eb!important;outline-offset:2px!important;box-shadow:none!important}',
      '.nanoai-ve-active .pw-header,.nanoai-ve-active .pw-shop-header{z-index:200!important;isolation:isolate}',
      '.pw-topbar,.nanoai-ve-active .pw-shop-topbar,[data-pw-region="topbar"]{position:relative!important;z-index:${PW_SCENE_TOPBAR_Z}!important;isolation:isolate;display:block!important;width:100%!important;min-width:100%!important;max-width:none!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;clip-path:none!important;overflow:visible!important;min-height:36px!important;height:auto!important;flex:0 0 auto!important;align-self:stretch!important;box-sizing:border-box}',
      '.nanoai-ve-active .pw-hero.nanoai-ve-photo-edit,.nanoai-ve-active .pw-banner.nanoai-ve-photo-edit,.nanoai-ve-active .pw-shop-hero.nanoai-ve-photo-edit,.nanoai-ve-active .pw-shop-banner.nanoai-ve-photo-edit,.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit{overflow:hidden!important}',
      '.nanoai-ve-active [data-pw-catalog-lock="1"],.nanoai-ve-active [data-pw-catalog-lock="1"] *{pointer-events:none!important;cursor:default!important}',
      '.nanoai-ve-active [data-pw-chrome-btn="favorite-product"],.nanoai-ve-active [data-pw-chrome-btn="favorite-product"] *,.nanoai-ve-active [data-pw-chrome-btn="try-on"],.nanoai-ve-active [data-pw-chrome-btn="try-on"] *,.nanoai-ve-active [data-pw-chrome-btn="add-cart"],.nanoai-ve-active [data-pw-chrome-btn="add-cart"] *,.nanoai-ve-active [data-pw-chrome-btn="buy-now"],.nanoai-ve-active [data-pw-chrome-btn="buy-now"] *{pointer-events:auto!important;cursor:grab!important}',
      '.pw-product-card-media,[data-pw-el="card-media"]{position:relative}',
      '.pw-product-card-media [data-pw-chrome-btn="favorite-product"],[data-pw-el="card-media"] [data-pw-chrome-btn="favorite-product"]{position:absolute;top:8px;right:8px;z-index:4;background:rgba(255,255,255,.92)!important}',
      '[data-pw-chrome-btn="favorite-product"].is-active svg,[data-pw-chrome-btn="favorite-product"][aria-pressed="true"] svg{fill:#e11d48;stroke:#e11d48}',
      '.nanoai-ve-active [data-pw-region="categories"],.nanoai-ve-active [data-pw-region="categories"] *,.nanoai-ve-active section.pw-categories,.nanoai-ve-active .pw-categories,.nanoai-ve-active .pw-cat-grid,.nanoai-ve-active .pw-cat-card{pointer-events:auto!important;position:relative;z-index:8}',
      '.nanoai-ve-active [data-pw-region="categories"][data-pw-catalog-lock="1"],.nanoai-ve-active [data-pw-region="categories"] [data-pw-catalog-lock="1"],.nanoai-ve-active [data-pw-region="categories"] [data-pw-catalog-lock="1"] *{pointer-events:auto!important;cursor:pointer!important}',
      '.nanoai-ve-active .pw-product-card,.nanoai-ve-active .pw-shop-card,.nanoai-ve-active .pw-product-grid,.nanoai-ve-active .pw-shop-grid,.nanoai-ve-active [data-pw-grid]{cursor:default!important}',
      '.nanoai-ve-active .pw-product-card .nanoai-ve-hover,.nanoai-ve-active .pw-shop-card .nanoai-ve-hover,.nanoai-ve-active .pw-btn-cart.nanoai-ve-hover,.nanoai-ve-active [data-pw-add-cart].nanoai-ve-hover{outline:none!important}',
      '.nanoai-ve-active div[data-pw-bg-layer]{position:absolute;inset:0;z-index:0;pointer-events:auto!important}',
      '.nanoai-ve-active .pw-hero-inner,.nanoai-ve-active .pw-banner-inner,.nanoai-ve-active .pw-hero > .pw-container,.nanoai-ve-active .pw-banner > .pw-container{pointer-events:none!important}',
      '.nanoai-ve-active [data-pw-move-block],.nanoai-ve-active .pw-hero-copy,.nanoai-ve-active .pw-banner-copy,[data-pw-banner-copy="1"],.nanoai-ve-active [data-pw-el="copy"]{pointer-events:auto!important}',
      '.nanoai-ve-active [data-pw-move-block]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active .pw-hero-copy:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active .pw-banner-copy:not([data-pw-z]):not([data-pw-scene]),[data-pw-banner-copy="1"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="copy"]:not([data-pw-z]):not([data-pw-scene]){position:relative;z-index:2}',
      '.nanoai-ve-active [data-pw-move-block] *,.nanoai-ve-active .pw-hero-copy *,.nanoai-ve-active .pw-banner-copy *,.nanoai-ve-active [data-pw-el="copy"] *,.nanoai-ve-active [data-pw-el="title"],.nanoai-ve-active [data-pw-el="subtitle"],.nanoai-ve-active [data-pw-el="cta"],.nanoai-ve-active [data-pw-el="cta-secondary"],.nanoai-ve-active [data-pw-el="badge"],.nanoai-ve-active [data-pw-el="dots"],.nanoai-ve-active [data-pw-el="field"]{pointer-events:auto!important}',
      '.nanoai-ve-active [data-pw-move-block] *:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active .pw-hero-copy *:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active .pw-banner-copy *:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="copy"] *:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="title"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="subtitle"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="cta"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="cta-secondary"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="badge"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="dots"]:not([data-pw-z]):not([data-pw-scene]),.nanoai-ve-active [data-pw-el="field"]:not([data-pw-z]):not([data-pw-scene]){position:relative;z-index:3}',
      '.nanoai-ve-active a,.nanoai-ve-active button,.nanoai-ve-active img:not([data-pw-bg-layer]),.nanoai-ve-active h1,.nanoai-ve-active h2,.nanoai-ve-active h3,.nanoai-ve-active p,.nanoai-ve-active [data-pw-added-text]{pointer-events:auto}',
      '.nanoai-ve-active [data-pw-chrome-added]:not(.pw-icon-btn):not([data-pw-chrome-btn]):not([data-pw-z]):not(.nanoai-ve-chrome-dup),.nanoai-ve-active [data-nanoai-ve-selected]:not([data-pw-bg-layer]):not([data-pw-added-bg]):not([data-pw-added-text]):not([data-pw-added-btn]):not([data-pw-logo-float]):not([data-pw-logo-frame]):not([data-pw-logo-added]):not(.pw-logo):not(.pw-shop-logo):not(.pw-logo-frame):not([data-pw-chrome-btn]):not(.pw-icon-btn):not([data-pw-z]):not(.nanoai-ve-chrome-dup){z-index:15!important;position:relative}',
      '.nanoai-ve-active .pw-header [data-pw-chrome-added]:not(.pw-icon-btn):not([data-pw-chrome-btn]),.nanoai-ve-active .pw-shop-header [data-pw-chrome-added]:not(.pw-icon-btn):not([data-pw-chrome-btn]),.nanoai-ve-active header [data-pw-chrome-added]:not(.pw-icon-btn):not([data-pw-chrome-btn]){z-index:90!important}',
      '[data-pw-edit-device="desktop"] .pw-visual-desktop,[data-pw-edit-device="laptop"] .pw-visual-laptop,[data-pw-edit-device="tablet"] .pw-visual-tablet,[data-pw-edit-device="mobile"] .pw-visual-mobile{display:block!important}',
      '[data-pw-edit-device="desktop"] .pw-visual-laptop,[data-pw-edit-device="desktop"] .pw-visual-tablet,[data-pw-edit-device="desktop"] .pw-visual-mobile,[data-pw-edit-device="laptop"] .pw-visual-desktop,[data-pw-edit-device="laptop"] .pw-visual-tablet,[data-pw-edit-device="laptop"] .pw-visual-mobile,[data-pw-edit-device="tablet"] .pw-visual-desktop,[data-pw-edit-device="tablet"] .pw-visual-laptop,[data-pw-edit-device="tablet"] .pw-visual-mobile,[data-pw-edit-device="mobile"] .pw-visual-desktop,[data-pw-edit-device="mobile"] .pw-visual-laptop,[data-pw-edit-device="mobile"] .pw-visual-tablet{display:none!important}',
      '[data-pw-edit-device="desktop"] [data-pw-chrome-added][data-pw-device="desktop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),[data-pw-edit-device="laptop"] [data-pw-chrome-added][data-pw-device="laptop"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),[data-pw-edit-device="tablet"] [data-pw-chrome-added][data-pw-device="tablet"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap),[data-pw-edit-device="mobile"] [data-pw-chrome-added][data-pw-device="mobile"]:not([data-pw-el="search"]):not(.pw-header-search):not(.pw-shop-search-wrap){display:inline-flex!important}',
      '[data-pw-edit-device="desktop"] .pw-bottom-nav [data-pw-chrome-added][data-pw-device="desktop"],[data-pw-edit-device="desktop"] .pw-shop-bottom-nav [data-pw-chrome-added][data-pw-device="desktop"],[data-pw-edit-device="laptop"] .pw-bottom-nav [data-pw-chrome-added][data-pw-device="laptop"],[data-pw-edit-device="laptop"] .pw-shop-bottom-nav [data-pw-chrome-added][data-pw-device="laptop"],[data-pw-edit-device="tablet"] .pw-bottom-nav [data-pw-chrome-added][data-pw-device="tablet"],[data-pw-edit-device="tablet"] .pw-shop-bottom-nav [data-pw-chrome-added][data-pw-device="tablet"]{display:flex!important}',
      '.nanoai-ve-active .pw-header a:focus,.nanoai-ve-active .pw-shop-header a:focus,.nanoai-ve-active header a:focus,.nanoai-ve-active .pw-header-actions a:focus,.nanoai-ve-active .pw-shop-header-actions a:focus{outline:none!important}',
      '.nanoai-ve-active .pw-header [data-pw-chrome-btn],.nanoai-ve-active .pw-shop-header [data-pw-chrome-btn],.nanoai-ve-active header [data-pw-chrome-btn],.nanoai-ve-active .pw-header-actions a,.nanoai-ve-active .pw-shop-header-actions a{cursor:grab!important}',
      '.nanoai-ve-guide-h{position:absolute;height:1px;background:repeating-linear-gradient(90deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-v{position:absolute;width:1px;background:repeating-linear-gradient(180deg,rgba(37,99,235,.42) 0 6px,transparent 6px 11px)}',
      '.nanoai-ve-guide-h.is-snap,.nanoai-ve-guide-v.is-snap{background:#2563eb;opacity:.85}',
      '.nanoai-ve-active [data-pw-hidden="1"]{display:none!important}',
      '.nanoai-ve-active .pw-cat-panel,.nanoai-ve-active .pw-shop-cat-panel,.nanoai-ve-active .pw-account-panel,.nanoai-ve-active .pw-shop-account-panel,.nanoai-ve-active [data-pw-cat-panel],.nanoai-ve-active [data-pw-account-panel],.nanoai-ve-active #pw-search-results,.nanoai-ve-active #pw-image-search-popover,.nanoai-ve-active #pw-lp-buy-modal{display:none!important;pointer-events:none!important;visibility:hidden!important}',
      '.nanoai-ve-active .pw-nav-main a,.nanoai-ve-active .pw-shop-nav-row a,.nanoai-ve-active .pw-topbar a,.nanoai-ve-active .pw-shop-topbar a,.nanoai-ve-active [data-pw-el="nav-link"],.nanoai-ve-active [data-pw-el="link"],.nanoai-ve-active [data-pw-el="cat-toggle"],.nanoai-ve-active .pw-cat-btn,.nanoai-ve-active .pw-shop-cat-btn{pointer-events:auto!important;position:relative;z-index:6}',
      '.pw-bottom-nav,.pw-shop-bottom-nav{display:flex!important;flex-wrap:nowrap;justify-content:space-around;align-items:stretch;grid-template-columns:none!important}',
      '[data-pw-edit-device="desktop"] .pw-bottom-nav,[data-pw-edit-device="desktop"] .pw-shop-bottom-nav,[data-pw-edit-device="laptop"] .pw-bottom-nav,[data-pw-edit-device="laptop"] .pw-shop-bottom-nav,[data-pw-edit-device="mobile"] .pw-bottom-nav,[data-pw-edit-device="mobile"] .pw-shop-bottom-nav,.nanoai-ve-mobile .pw-bottom-nav,.nanoai-ve-mobile .pw-shop-bottom-nav{display:none!important}',
      '.pw-bottom-nav a:not([data-pw-chrome-added]),.pw-shop-bottom-nav a:not([data-pw-chrome-added]),.pw-bottom-nav .pw-icon-btn:not([data-pw-chrome-added]),.pw-shop-bottom-nav .pw-icon-btn:not([data-pw-chrome-added]){flex:1 1 0;min-width:0;min-height:0;width:auto!important;height:auto!important;color:#6b7280!important;flex-direction:column;align-items:center;justify-content:center;background:transparent!important}',
      '.pw-bottom-nav [data-pw-chrome-added],.pw-shop-bottom-nav [data-pw-chrome-added]{flex:1 1 0;min-width:0;min-height:0;width:auto!important;height:auto!important;flex-direction:column;align-items:center;justify-content:center;background:transparent!important;cursor:grab}',
      '.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster{overflow:visible!important}',
      'html{--pw-block-w:min(calc(100% - 32px),var(--pw-content,1200px))}',
      'html .pw-header-main,html .pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;min-width:0;position:relative!important;max-width:var(--pw-block-w)!important;width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;align-self:center!important;box-sizing:border-box}',
      'html .pw-nav-main,html .pw-shop-nav-row,html .pw-hero,html .pw-banner,html .pw-shop-hero,html .pw-shop-banner,html [data-pw-region="banner"]{max-width:var(--pw-block-w)!important;width:var(--pw-block-w)!important;margin-left:auto!important;margin-right:auto!important;box-sizing:border-box}',
      '@media (min-width:900px){html .pw-header-main,html .pw-shop-header-inner{justify-content:center!important}html .pw-header-actions,html .pw-shop-header-actions{margin-left:0!important}}',
      '.pw-brand-cluster,.pw-shop-brand-cluster,.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){position:relative!important;z-index:120!important;flex:0 0 auto!important;overflow:visible!important}',
      '.pw-brand:not([data-pw-logo-float]),.pw-shop-brand:not([data-pw-logo-float]),a[data-pw-logo-home]:not([data-pw-logo-float]){display:inline-flex!important;align-items:center!important;width:max-content!important;max-width:100%!important;vertical-align:middle}',
      '.pw-brand-cluster,.pw-shop-brand-cluster{pointer-events:none!important}',
      '.pw-brand-cluster > *,.pw-shop-brand-cluster > *,.pw-brand-cluster a,.pw-shop-brand-cluster a,.pw-brand-cluster button,.pw-shop-brand-cluster button,.pw-brand-cluster img,.pw-shop-brand-cluster img,.pw-brand-cluster [data-pw-el],.pw-shop-brand-cluster [data-pw-el],.pw-brand-cluster .pw-logo-frame,.pw-shop-brand-cluster .pw-logo-frame,.pw-brand-cluster [data-pw-logo-frame],.pw-shop-brand-cluster [data-pw-logo-frame]{pointer-events:auto!important}',
      'header [data-pw-logo-float="1"],.pw-header [data-pw-logo-float="1"],.pw-shop-header [data-pw-logo-float="1"]{position:absolute!important;margin:0!important;max-width:none!important;max-height:none!important;overflow:visible!important}',
      'header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-header [data-pw-logo-float="1"]:not([data-pw-z]),.pw-shop-header [data-pw-logo-float="1"]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}',
      'header img.pw-logo,header img.pw-shop-logo,.pw-header img.pw-logo,.pw-shop-header img.pw-shop-logo,header [data-pw-logo-added],.pw-header [data-pw-logo-added],.pw-shop-header [data-pw-logo-added]{max-width:none!important;max-height:none!important}',
      'header img.pw-logo:not([data-pw-z]),header img.pw-shop-logo:not([data-pw-z]),.pw-header img.pw-logo:not([data-pw-z]),.pw-shop-header img.pw-shop-logo:not([data-pw-z]),header [data-pw-logo-added]:not([data-pw-z]),.pw-header [data-pw-logo-added]:not([data-pw-z]),.pw-shop-header [data-pw-logo-added]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}',
      '.nanoai-ve-active header img.pw-logo,.nanoai-ve-active header img.pw-shop-logo,.nanoai-ve-active header [data-pw-logo-added],.nanoai-ve-active .pw-header img.pw-logo,.nanoai-ve-active .pw-shop-header img.pw-shop-logo{max-width:none!important;max-height:none!important}',
      '.nanoai-ve-active header .pw-logo-frame img,.nanoai-ve-active header [data-pw-logo-frame="1"] img,.nanoai-ve-active header [data-pw-logo-added],.nanoai-ve-active .pw-header .pw-logo-frame img,.nanoai-ve-active .pw-shop-header .pw-logo-frame img,.nanoai-ve-active .pw-header [data-pw-logo-added],.nanoai-ve-active .pw-shop-header [data-pw-logo-added]{opacity:1!important;visibility:visible!important}',
      'header,.pw-header,.pw-shop-header,.pw-header-main,.pw-shop-header-inner,.pw-brand-cluster,.pw-shop-brand-cluster,a.pw-brand,a.pw-shop-brand{background-repeat:no-repeat!important}',
      '.pw-logo-frame,[data-pw-logo-frame="1"]{display:inline-flex!important;align-items:center;justify-content:center;overflow:hidden!important;flex-shrink:0;position:relative;vertical-align:middle;max-width:none!important;max-height:none!important}',
      '.pw-logo-frame:not([data-pw-z]),[data-pw-logo-frame="1"]:not([data-pw-z]){z-index:${PW_SCENE_LOGO_Z}!important}',
      'h1 .pw-logo-frame:not([data-pw-logo-user-size="1"]),h1 [data-pw-logo-frame="1"]:not([data-pw-logo-user-size="1"]),[data-pw-el="heading"] .pw-logo-frame:not([data-pw-logo-user-size="1"]),[data-pw-info-title] .pw-logo-frame:not([data-pw-logo-user-size="1"]),.pw-shop-info .pw-logo-frame:not([data-pw-logo-user-size="1"]):not([data-pw-logo-float="1"]),main .pw-logo-frame:not([data-pw-logo-user-size="1"]):not([data-pw-logo-float="1"]){max-width:180px!important}',
      'h1 a.pw-brand:not([data-pw-logo-float]),h1 a[data-pw-logo-home]:not([data-pw-logo-float]),[data-pw-el="heading"] a.pw-brand:not([data-pw-logo-float]),[data-pw-info-title] a.pw-brand:not([data-pw-logo-float]){width:max-content!important;max-width:180px!important}',
      '[data-pw-edit-device="mobile"] .pw-header-main,[data-pw-edit-device="mobile"] .pw-shop-header-inner,[data-pw-edit-device="tablet"] .pw-header-main,[data-pw-edit-device="tablet"] .pw-shop-header-inner,.nanoai-ve-mobile .pw-header-main,.nanoai-ve-mobile .pw-shop-header-inner,.nanoai-ve-tablet .pw-header-main,.nanoai-ve-tablet .pw-shop-header-inner,.nanoai-ve-active .pw-header-main,.nanoai-ve-active .pw-shop-header-inner{overflow:visible!important;min-width:0!important;padding:8px 10px!important}',
      '[data-pw-edit-device="mobile"] .pw-brand-cluster,[data-pw-edit-device="mobile"] .pw-shop-brand-cluster,[data-pw-edit-device="tablet"] .pw-brand-cluster,[data-pw-edit-device="tablet"] .pw-shop-brand-cluster,.nanoai-ve-mobile .pw-brand-cluster,.nanoai-ve-mobile .pw-shop-brand-cluster,.nanoai-ve-tablet .pw-brand-cluster,.nanoai-ve-tablet .pw-shop-brand-cluster{max-width:200px!important;overflow:visible!important}',
      '[data-pw-edit-device="mobile"] .pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),[data-pw-edit-device="mobile"] .pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.nanoai-ve-mobile .pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.nanoai-ve-mobile .pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]){flex:1 1 0%!important;min-width:96px!important;min-height:36px!important;width:auto!important;max-width:100%!important;margin:0!important;transform:none!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;position:relative!important;opacity:1!important;visibility:visible!important}',
      '[data-pw-edit-device="tablet"] .pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),[data-pw-edit-device="tablet"] .pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.nanoai-ve-tablet .pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.nanoai-ve-tablet .pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]){flex:1 1 0%!important;min-width:120px!important;min-height:36px!important;width:auto!important;max-width:100%!important;margin:0!important;transform:none!important;left:auto!important;top:auto!important;right:auto!important;bottom:auto!important;position:relative!important;opacity:1!important;visibility:visible!important}',
      '[data-pw-edit-device="mobile"] .pw-brand:has(img) .pw-wordmark,.nanoai-ve-mobile .pw-brand:has(img) .pw-wordmark,[data-pw-edit-device="tablet"] .pw-brand:has(img) .pw-wordmark,.nanoai-ve-tablet .pw-brand:has(img) .pw-wordmark,[data-pw-edit-device="mobile"] [data-pw-logo-wordmark-hidden="1"],.nanoai-ve-mobile [data-pw-logo-wordmark-hidden="1"],[data-pw-edit-device="tablet"] [data-pw-logo-wordmark-hidden="1"],.nanoai-ve-tablet [data-pw-logo-wordmark-hidden="1"]{display:none!important}',
      '@media (max-width:899px){.pw-brand-cluster,.pw-shop-brand-cluster{max-width:200px!important;overflow:visible!important}.pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]){flex:1 1 0%!important;min-width:96px!important;min-height:36px!important;width:auto!important;max-width:100%!important;transform:none!important;position:relative!important;left:auto!important;top:auto!important;opacity:1!important;visibility:visible!important}}',
      '.pw-logo-frame img,[data-pw-logo-frame="1"] img{max-width:none!important;max-height:none!important;width:100%!important;height:100%!important;object-fit:contain!important}',
      '@media (min-width:900px){.pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]){flex:0 0 auto!important;width:auto!important;max-width:360px!important}.pw-header-search[data-pw-search-width]:not([data-pw-user-move]),.pw-shop-search-wrap[data-pw-search-width]:not([data-pw-user-move]){flex:0 0 auto!important;max-width:none!important}}',
      '.pw-header-search,.pw-shop-search-wrap{flex:1 1 auto!important;min-width:72px!important;width:auto!important;margin:0!important;z-index:1}',
      '.nanoai-ve-active .pw-header-search,.nanoai-ve-active .pw-shop-search-wrap,.nanoai-ve-active [data-pw-el="search"]{z-index:170!important;pointer-events:auto!important;position:relative!important;cursor:pointer!important}',
      '[data-pw-edit-device="desktop"] .nanoai-ve-active .pw-header-search,[data-pw-edit-device="desktop"] .nanoai-ve-active .pw-shop-search-wrap{cursor:grab!important}',
      '.nanoai-ve-active .pw-header-search *,.nanoai-ve-active .pw-shop-search-wrap *{pointer-events:auto!important}',
      '.nanoai-ve-active .pw-header-search input[type="search"],.nanoai-ve-active .pw-shop-search-wrap input[type="search"],.nanoai-ve-active input[data-pw-search]{pointer-events:none!important;caret-color:transparent!important}',
      '.nanoai-ve-active input[data-pw-edit-placeholder="1"]{pointer-events:auto!important;caret-color:auto!important}',
      '.pw-header-search[data-pw-search-width],.pw-shop-search-wrap[data-pw-search-width]{min-width:72px!important}',
      '@media (min-width:900px){.pw-header-search[data-pw-search-width]:not([data-pw-user-move]),.pw-shop-search-wrap[data-pw-search-width]:not([data-pw-user-move]){flex:0 0 auto!important}}',
      '.pw-search-form,.pw-shop-search-form,form[data-pw-search-form]{display:flex!important;width:100%!important;min-width:0!important}',
      '.pw-search-form input[type="search"],.pw-shop-search-form input[type="search"],input[data-pw-search]{flex:1 1 auto!important;min-width:0!important;width:auto!important;max-width:none!important}',
      '[data-pw-ph]::placeholder,input[style*="--pw-ph"]::placeholder,textarea[style*="--pw-ph"]::placeholder{color:var(--pw-ph)!important}',
      '[data-pw-edit-device="mobile"] .pw-shop-search-submit-label,[data-pw-edit-device="tablet"] .pw-shop-search-submit-label,.nanoai-ve-mobile .pw-shop-search-submit-label,.nanoai-ve-tablet .pw-shop-search-submit-label{display:none!important}',
      '[data-pw-edit-device="mobile"] .pw-shop-search-submit-icon,[data-pw-edit-device="tablet"] .pw-shop-search-submit-icon,.nanoai-ve-mobile .pw-shop-search-submit-icon,.nanoai-ve-tablet .pw-shop-search-submit-icon{display:block!important;width:16px;height:16px}',
      '[data-pw-edit-device="desktop"] .pw-shop-search-submit-icon,[data-pw-edit-device="laptop"] .pw-shop-search-submit-icon,.nanoai-ve-desktop .pw-shop-search-submit-icon,.nanoai-ve-laptop .pw-shop-search-submit-icon{display:none!important}',
      '[data-pw-edit-device="mobile"] .pw-search-submit::before,[data-pw-edit-device="tablet"] .pw-search-submit::before,.nanoai-ve-mobile .pw-search-submit::before,.nanoai-ve-tablet .pw-search-submit::before{content:""!important;display:block!important;width:16px;height:16px;flex-shrink:0;background-color:currentColor!important;background-image:none!important;-webkit-mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%277%27/%3E%3Cpath d=%27m20 20-3.5-3.5%27/%3E%3C/svg%3E");mask:center/contain no-repeat url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27black%27 stroke-width=%272.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Ccircle cx=%2711%27 cy=%2711%27 r=%277%27/%3E%3Cpath d=%27m20 20-3.5-3.5%27/%3E%3C/svg%3E")}',
      '[data-pw-edit-device="mobile"] .pw-search-submit:has(.pw-shop-search-submit-icon)::before,[data-pw-edit-device="tablet"] .pw-search-submit:has(.pw-shop-search-submit-icon)::before,.nanoai-ve-mobile .pw-search-submit:has(.pw-shop-search-submit-icon)::before,.nanoai-ve-tablet .pw-search-submit:has(.pw-shop-search-submit-icon)::before{content:none!important;display:none!important}',
      '.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;margin-left:0!important;z-index:2}',
      '.nanoai-ve-active .pw-header-actions,.nanoai-ve-active .pw-shop-header-actions{z-index:170!important;pointer-events:auto!important;position:relative!important}',
      '.nanoai-ve-active .pw-header-actions > *,.nanoai-ve-active .pw-shop-header-actions > *,.nanoai-ve-active [data-pw-el="account"],.nanoai-ve-active .pw-account-btn,.nanoai-ve-active [data-pw-chrome-btn],.nanoai-ve-active [data-pw-chrome-added]{position:relative;z-index:171;pointer-events:auto!important}',
      '@media (max-width:899px){.nanoai-ve-active .pw-header-main,.nanoai-ve-active .pw-shop-header-inner{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;column-gap:6px!important;overflow:visible!important;min-width:0!important;max-width:100%!important;padding:8px 10px!important}.pw-brand-cluster,.pw-shop-brand-cluster{flex:0 0 auto!important;width:auto!important;max-width:200px!important;overflow:visible!important}.pw-header a.pw-brand:not([data-pw-logo-float]),.pw-shop-header a.pw-shop-brand:not([data-pw-logo-float]),.pw-header a[data-pw-logo-home]:not([data-pw-logo-float]),.pw-shop-header a[data-pw-logo-home]:not([data-pw-logo-float]){max-width:none!important}.pw-header-search:not([data-pw-user-move]):not([data-nanoai-ve-selected]),.pw-shop-search-wrap:not([data-pw-user-move]):not([data-nanoai-ve-selected]){flex:1 1 0%!important;min-width:96px!important;min-height:36px!important;width:auto!important;max-width:100%!important;margin:0!important;transform:none!important;position:relative!important;left:auto!important;top:auto!important;opacity:1!important;visibility:visible!important}.pw-header-actions,.pw-shop-header-actions{flex:0 0 auto!important;display:flex!important;flex-wrap:nowrap!important;width:auto!important;max-width:42%!important;margin-left:auto!important}}',
      '.nanoai-ve-active .pw-header-actions a,.nanoai-ve-active .pw-shop-header-actions a,.nanoai-ve-active header [data-pw-chrome-btn],.nanoai-ve-active header [data-pw-chrome-added]{cursor:grab!important}',
      '.pw-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added]:not(.pw-chrome-icon-only){display:inline-flex!important;flex:0 0 auto;flex-direction:row!important;align-items:center!important;justify-content:center!important;gap:var(--pw-chrome-gap,6px)!important;width:auto!important;height:auto!important;min-width:0;min-height:calc(var(--pw-chrome-size,22px) + 14px);padding:var(--pw-chrome-pad-y,4px) var(--pw-chrome-pad-x,12px)!important;font-size:var(--pw-chrome-label,13px)!important;font-weight:700;background:transparent!important;cursor:grab}',
      '.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below:not(.pw-chrome-icon-only),.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"]:not(.pw-chrome-icon-only){flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:var(--pw-chrome-pad-y,4px) 6px!important;border-radius:10px!important}',
      '.pw-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-left:not(.pw-chrome-icon-only),.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only),.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-left"]:not(.pw-chrome-icon-only){flex-direction:row!important}',
      '.pw-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-added] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added] .pw-shop-nav-label{display:inline!important;max-width:none!important;overflow:visible!important;white-space:nowrap!important;font-size:var(--pw-chrome-label,13px)!important;font-weight:700;line-height:1.2}',
      '.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added].pw-chrome-label-below .pw-shop-nav-label,.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-chrome-btn-label,.pw-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label,.pw-shop-header-actions [data-pw-chrome-added][data-pw-chrome-style="icon-label-below"] .pw-shop-nav-label{display:block!important;text-align:center!important;white-space:normal!important;max-width:4.8rem!important}',
      '.pw-nav-main [data-pw-chrome-added],.pw-shop-nav-row [data-pw-chrome-added]{display:inline-flex;align-items:center;justify-content:center;gap:var(--pw-chrome-gap,6px);width:auto!important;height:auto!important;background:transparent!important;cursor:grab}',
      '.pw-bottom-nav>a:not([data-pw-chrome-added]) svg,.pw-shop-bottom-nav>a:not([data-pw-chrome-added]) svg{width:22px!important;height:22px!important;max-width:22px!important;max-height:22px!important;stroke:currentColor!important;fill:none!important}',
      '.pw-bottom-nav [data-pw-chrome-added] svg,.pw-shop-bottom-nav [data-pw-chrome-added] svg{width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;max-width:var(--pw-chrome-size,22px)!important;max-height:var(--pw-chrome-size,22px)!important;stroke:currentColor!important;fill:none!important}',
      '.pw-bottom-nav>a:not([data-pw-chrome-added]) .pw-chrome-icon-wrap,.pw-shop-bottom-nav>a:not([data-pw-chrome-added]) .pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center;justify-content:center;width:22px!important;height:22px!important;overflow:visible!important}',
      '.pw-bottom-nav [data-pw-chrome-added] .pw-chrome-icon-wrap,.pw-shop-bottom-nav [data-pw-chrome-added] .pw-chrome-icon-wrap{position:relative!important;display:inline-flex!important;flex-direction:row!important;align-items:center;justify-content:center;width:var(--pw-chrome-size,22px)!important;height:var(--pw-chrome-size,22px)!important;overflow:visible!important}',
      '.pw-bottom-nav .pw-shop-icon-label,.pw-shop-bottom-nav .pw-shop-icon-label,.pw-bottom-nav .pw-chrome-btn-label,.pw-shop-bottom-nav .pw-chrome-btn-label,.pw-bottom-nav .pw-shop-nav-label,.pw-shop-bottom-nav .pw-shop-nav-label{display:block!important;max-width:100%!important;white-space:normal!important;overflow:visible!important;text-overflow:unset!important;color:inherit!important;text-align:center;line-height:1.15;overflow-wrap:break-word;word-break:break-word}',
      '.pw-chrome-label-below,[data-pw-chrome-style="icon-label-below"],.pw-header-actions .pw-chrome-label-below,.pw-shop-header-actions .pw-chrome-label-below,.pw-bottom-nav .pw-chrome-label-below,.pw-shop-bottom-nav .pw-chrome-label-below,[data-pw-chrome-added].pw-chrome-label-below{flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:var(--pw-chrome-pad-y,4px) 6px!important;border-radius:10px!important}',
      '.pw-chrome-label-below .pw-chrome-btn-label,.pw-chrome-label-below .pw-shop-nav-label,.pw-chrome-label-below .pw-shop-icon-label{display:block!important;text-align:center!important;white-space:normal!important;max-width:4.8rem!important}',
      '.pw-chrome-label-left,[data-pw-chrome-style="icon-label-left"],.pw-header-actions .pw-chrome-label-left,.pw-shop-header-actions .pw-chrome-label-left,.pw-bottom-nav .pw-chrome-label-left,.pw-shop-bottom-nav .pw-chrome-label-left,[data-pw-chrome-added].pw-chrome-label-left{flex-direction:row!important;align-items:center!important;justify-content:center!important}',
      '.pw-chrome-label-left .pw-chrome-btn-label,.pw-chrome-label-left .pw-shop-nav-label,.pw-chrome-label-left .pw-shop-icon-label{display:inline!important;white-space:nowrap!important;text-align:right!important;max-width:none!important}',
      '.pw-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge,.pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-cart-badge,.pw-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge,.pw-shop-bottom-nav .pw-chrome-icon-wrap .pw-shop-cart-badge{position:absolute!important;top:-5px!important;right:-9px!important;left:auto!important;bottom:auto!important;z-index:2}',
      ${JSON.stringify(PW_CHROME_COUNT_BADGE_HIDE_CSS)},
      '.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-bg-layer],.nanoai-ve-active .pw-hero.nanoai-ve-photo-edit [data-pw-bg-layer]{z-index:6!important;cursor:grab!important}',
      '.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="copy"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-move-block],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-banner-copy="1"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit .pw-hero-copy,.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit .pw-banner-copy,.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="title"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="subtitle"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="cta"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="cta-secondary"],.nanoai-ve-active [data-pw-region="banner"].nanoai-ve-photo-edit [data-pw-el="badge"]{pointer-events:none!important}',
      '#nanoai-ve-logo-crop{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px}',
      '.nanoai-ve-logo-crop-title{color:#fff;font:700 16px/1.3 system-ui,sans-serif;text-align:center}',
      '.nanoai-ve-logo-crop-hint{color:#cbd5e1;font:500 12px/1.4 system-ui,sans-serif;text-align:center;max-width:360px}',
      '.nanoai-ve-logo-crop-frame{position:relative;display:inline-block}',
      '.nanoai-ve-logo-crop-stage{position:relative;overflow:hidden;background:rgba(255,255,255,.06);border:2px solid #fff;box-shadow:0 0 0 2px #2563eb,0 16px 40px rgba(0,0,0,.45);border-radius:10px;cursor:grab;touch-action:none}',
      '.nanoai-ve-logo-crop-stage img{position:absolute;object-fit:contain;transform-origin:center center;pointer-events:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-user-drag:none}',
      '.nanoai-ve-logo-crop-handle{position:absolute;width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:2px;z-index:3;box-shadow:0 1px 4px rgba(0,0,0,.35)}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="nw"]{left:-7px;top:-7px;cursor:nwse-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="n"]{left:50%;top:-7px;margin-left:-7px;cursor:ns-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="ne"]{right:-7px;top:-7px;cursor:nesw-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="e"]{right:-7px;top:50%;margin-top:-7px;cursor:ew-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="se"]{right:-7px;bottom:-7px;cursor:nwse-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="s"]{left:50%;bottom:-7px;margin-left:-7px;cursor:ns-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="sw"]{left:-7px;bottom:-7px;cursor:nesw-resize}',
      '.nanoai-ve-logo-crop-handle[data-crop-handle="w"]{left:-7px;top:50%;margin-top:-7px;cursor:ew-resize}',
      '.nanoai-ve-logo-crop-bar{display:flex;align-items:center;gap:8px;color:#fff;font:600 12px/1.3 system-ui,sans-serif;width:min(360px,92vw)}',
      '.nanoai-ve-logo-crop-bar input{flex:1;accent-color:#60a5fa}',
      '.nanoai-ve-logo-crop-actions{display:flex;gap:8px}',
      '.nanoai-ve-logo-crop-actions button{border:0;border-radius:8px;padding:8px 16px;font:700 13px/1 system-ui,sans-serif;cursor:pointer}',
      '.nanoai-ve-logo-crop-done{background:#2563eb;color:#fff}',
      '.nanoai-ve-logo-crop-cancel{background:#fff;color:#0f172a}',
      '.nanoai-ve-logo-live-crop,.nanoai-ve-logo-live-crop.nanoai-ve-highlight{outline:none!important;border:1.5px dashed #2563eb!important;box-shadow:0 0 0 1px #fff,0 0 0 3px rgba(37,99,235,.28)!important;overflow:hidden!important;cursor:grab!important;background-clip:padding-box}',
      '.nanoai-ve-logo-live-crop img,.nanoai-ve-logo-live-crop img.nanoai-ve-highlight{outline:none!important;box-shadow:none!important;cursor:grab!important}',
      '#nanoai-ve-logo-live-bar{position:fixed;z-index:2147483646;display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:min(360px,calc(100vw - 16px));padding:6px 8px;border-radius:8px;background:rgba(15,23,42,.92);color:#fff;font:600 11px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
      '#nanoai-ve-logo-live-bar .nanoai-ve-logo-live-actions{display:flex;gap:6px;margin-left:auto}',
      '#nanoai-ve-logo-live-bar button{border:0;border-radius:6px;padding:6px 10px;font:700 12px/1 system-ui,sans-serif;cursor:pointer}',
      '.nanoai-ve-logo-live-handle{position:fixed;z-index:2147483646;width:18px;height:18px}'
    ].join('')
    if (s.parentNode !== document.head && s.parentNode !== document.documentElement) {
      if (document.head) document.head.appendChild(s)
      else document.documentElement.appendChild(s)
    }
  }
  function onWheel(e) {
    if (!document.body.classList.contains('nanoai-ve-active')) return
    if (logoCrop.on) return
    if (!selected || !isLogoTarget(selected)) return
    var img = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
    if (!img) return
    var box = logoFrameOf(img) || img
    if (!pointInEl(box, e.clientX, e.clientY)) return
    e.preventDefault()
    e.stopPropagation()
    var next = parseLogoZoom(img) + (e.deltaY < 0 ? 0.08 : -0.08)
    unlockLogoImage(img)
    ensureLogoFrame(img)
    applyLogoZoom(img, next)
    positionAllHandles()
    post('dirty', {})
    refreshSelect()
  }
  function onScrollVe() {
    positionAllHandles()
    stickHeaderSync()
  }
  function unbindVeListeners() {
    if (!veListening) return
    veListening = false
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('dblclick', onDblClick, true)
    document.removeEventListener('mousedown', onMouseDown, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('mouseup', onMouseUp, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.removeEventListener('wheel', onWheel, true)
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('scroll', onScrollVe, true)
  }
  function bindVeListeners() {
    unbindVeListeners()
    document.addEventListener('click', onClick, true)
    document.addEventListener('dblclick', onDblClick, true)
    document.addEventListener('mousedown', onMouseDown, true)
    document.addEventListener('input', onInput, true)
    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('wheel', onWheel, { capture: true, passive: false })
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScrollVe, true)
    veListening = true
  }
  function freezeLiveChromeForEditor() {
    var panels = document.querySelectorAll('.pw-cat-panel,.pw-shop-cat-panel,[data-pw-cat-panel],.pw-account-panel,.pw-shop-account-panel,[data-pw-account-panel]')
    for (var i = 0; i < panels.length; i++) panels[i].classList.remove('is-open')
    var btns = document.querySelectorAll('[data-pw-cat-toggle],[data-pw-el="cat-toggle"],.pw-cat-btn,.pw-shop-cat-btn,[data-pw-chrome-btn="categories"]')
    for (var j = 0; j < btns.length; j++) btns[j].setAttribute('aria-expanded', 'false')
    var pop = document.getElementById('pw-image-search-popover')
    if (pop) pop.hidden = true
  }
  function activate() {
    skipClick = false
    drag.active = false
    drag.ready = false
    var wasLive = document.body.classList.contains('nanoai-ve-active')
    historyLock = true
    injectStyles()
    syncEditDeviceAttr()
    try { sanitizeLogoFrames() } catch (errSan) {}
    try { rescueHeaderLogos() } catch (errRescue) {}
    try { reflowHeaderChrome() } catch (errHeadLogo) {}
    try { bakeHeaderLogoHomeLinks() } catch (errLogoHome) {}
    try { ensureSearchVisible() } catch (errSearchVis) {}
    try { ensureSearchSubmitIcon(document) } catch (errSearchIcon) {}
    try { lockExistingSearchBoxes() } catch (errSearch) {}
    try { stampAllChromeFloats() } catch (errFloatStamp) {}
    try { if (window.__pwChromeTopupSync) window.__pwChromeTopupSync() } catch (errTopupSync) {}
    try { clearAllChatStickHeaders() } catch (errChatStick) {}
    try { resetFullBleedChromePos() } catch (errBleedReset) {}
    try { pinHeaderChromeIcons() } catch (errChromePin) {}
    try { pinChromeIconBadges(document) } catch (errPin) {}
    try { pwApplyDemoChromeCountBadges(document) } catch (errDemo) {}
    try { restoreWidgetColors(document) } catch (errWidget) {}
    document.body.classList.add('nanoai-ve-active')
    try { freezeLiveChromeForEditor() } catch (errFreeze) {}
    try { hideLayerSwitches() } catch (errHide) {}
    try { stampPwUiContract() } catch (errStamp2) {}
    try { ensureBgStack() } catch (errBgStack) {}
    try { stampCatalogLocks() } catch (errLock2) {}
    try { prepareImageLayerBlocks() } catch (errPrep) {}
    bindVeListeners()
    historyLock = false
    post('ready', { hint: COPY.selectHint })
    if (!wasLive) {
      if (historyTimer) { clearTimeout(historyTimer); historyTimer = null }
      resetHistoryBaseline()
    }
    postHidden()
    syncLayerSwitches()
    syncLogoButtons()
    stickHeaderSync()
  }
  function deactivate() {
    if (historyTimer) { clearTimeout(historyTimer); historyTimer = null }
    hideLayerSwitches()
    hideLogoButtons()
    cancelAddLogo()
    closeLogoCrop(false)
    document.body.classList.remove('nanoai-ve-active')
    unbindVeListeners()
    clearHover()
    clearSelection()
    try { window.__nanoaiVeBound = 0 } catch (eBound) {}
    post('inactive', {})
  }
  function scheduleChatEmbedPrep(d) {
    try {
      prepareChatEmbedForEditor(d)
    } catch (errChat0) {}
    var tries = 0
    var timer = setInterval(function () {
      tries++
      try {
        prepareChatEmbedForEditor(d)
      } catch (errChat1) {}
      if (tries >= 24 || chatLauncherHidden || document.querySelector('[data-pw-chrome-btn="chat"],[data-pw-chat-launcher="1"],[data-nanoai-chat-bubble="1"],.pw-fab-chat')) {
        clearInterval(timer)
      }
    }, 250)
  }
  function detectTextArticlePage(d) {
    d = d || {}
    if (d.infoPage) return true
    var pk = String(d.pageKey || '').trim()
    // pageKey từ host — không phụ thuộc stamp HTML / catalog chrome
    if (pk === 'about' || pk === 'contact' || pk === 'faq' || pk === 'shipping' || pk === 'returns' || pk === 'payment' || pk === 'privacy' || pk === 'terms' || pk === 'thank_you' || pk === 'stores' || pk === 'size_guide' || pk === 'blog') return true
    if (String(d.cmsSlug || '').trim()) return true
    if (document.querySelector('[data-pw-text-article="1"]')) return true
    if (document.querySelector('[data-pw-page="info"]')) return true
    if (document.querySelector('[data-pw-info-article],[data-pw-info-title],[data-pw-info-body],.pw-shop-info')) return true
    var page = ''
    var root = document.querySelector('[data-pw-page]')
    if (root && root.getAttribute) page = String(root.getAttribute('data-pw-page') || '')
    if (page === 'home' || page === 'listing' || page === 'product' || page === 'cart' || page === 'account') return false
    // Chỉ coi là catalog khi LƯỚI SP nằm trong main (không nhầm nút giỏ header)
    var main = document.querySelector('main') || document.body
    if (main && main.querySelector && main.querySelector('[data-pw-catalog] .pw-product-grid,[data-pw-catalog] [data-pw-el="card-buy"],[data-pw-region="catalog"] [data-pw-el="card-cart"]')) return false
    return false
  }
  function stampTextArticleMarkers(kind) {
    var root = document.querySelector('[data-pw-page],body')
    if (!root || !root.setAttribute) return
    root.setAttribute('data-pw-page', 'info')
    root.setAttribute('data-pw-text-article', '1')
    if (kind) root.setAttribute('data-pw-article-kind', String(kind))
    var region = findBestInfoContentRegion()
    if (region && region.setAttribute) {
      region.setAttribute('data-pw-info-article', '1')
      region.setAttribute('data-pw-text-article', '1')
      if (kind) region.setAttribute('data-pw-article-kind', String(kind))
    }
  }
  function scheduleInfoArticleEditor() {
    var tries = 0
    var run = function () {
      tries++
      try {
        ensureInfoArticle()
        ensureInfoSeoCoach()
      } catch (errSch) {}
      if (tries < 6) setTimeout(run, tries * 80)
    }
    run()
  }
  function activateFromHost(d) {
    d = d || {}
    if (d.device === 'mobile' || d.device === 'tablet' || d.device === 'laptop' || d.device === 'desktop') editDevice = d.device
    activate()
    if (d.vars) applyThemeVars(d.vars)
    scheduleChatEmbedPrep(d)
    var isArticle = detectTextArticlePage(d)
    var pk = String(d.pageKey || '').trim()
    var hostSaidNo =
      d.infoPage === false ||
      pk === 'home' ||
      pk === 'products' ||
      pk === 'product_detail' ||
      pk === 'collection' ||
      pk === 'cart' ||
      pk === 'checkout' ||
      pk === 'account' ||
      pk === 'sale' ||
      pk === 'lookbook' ||
      pk === 'landing'
    if (isArticle) {
      infoPageActive = true
      var kind = 'policy'
      if (pk === 'blog') kind = 'blog'
      else if (pk === 'about') kind = 'about'
      else if (pk === 'contact') kind = 'contact'
      else if (pk === 'faq') kind = 'faq'
      else if (pk === 'size_guide' || pk === 'stores' || pk === 'thank_you') kind = 'guide'
      else if (String(d.cmsSlug || '').trim()) kind = 'cms'
      stampTextArticleMarkers(kind)
      scheduleInfoArticleEditor()
    } else if (hostSaidNo) {
      infoPageActive = false
      removeInfoSeoCoach()
    }
    // Boot rỗng {} / chưa rõ pageKey → giữ nguyên, chờ host activate đủ payload
  }
  try {
    window.__nanoaiVeActivate = activateFromHost
    window.__nanoaiVeDeactivate = deactivate
  } catch (eHost) {}
  function refreshSelect() { if (selected) post('select', buildPayload(selected)) }
  function firstFilledLogoUrl() {
    var slots = listLogoSlots()
    for (var i = 0; i < slots.length; i++) {
      if (isFilledLogo(slots[i])) return String(slots[i].getAttribute('src') || '').trim()
    }
    return ''
  }
  function applyLeftoverTextLogos(url) {
    var u = String(url || firstFilledLogoUrl() || '').trim()
    if (!u || u.indexOf('http') !== 0) return 0
    var n = 0
    var slots = listLogoSlots()
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i]
      if (isFilledLogo(el)) continue
      if (!(isWordmarkEl(el) || isBrandLink(el))) continue
      applyLogoToEl(el, u)
      n++
    }
    return n
  }
  function headerLogoImg() {
    var header = document.querySelector('header.pw-header, header.pw-shop-header, .pw-shop-header, header')
    if (!header || !header.querySelector) return null
    return header.querySelector('img.pw-logo, img.pw-shop-logo, [data-pw-logo-added]')
  }
  function applyLogoUrl(url, allSlots) {
    var u = String(url || '').trim()
    if (!u) return
    var img = headerLogoImg()
    if (!img && selected && (isLogoSlot(selected) || isLogoImg(selected) || isLogoFrame(selected))) {
      img = logoImgOf(selected) || (isImgEl(selected) ? selected : null)
    }
    if (!img) {
      placeHeaderLogoFromToolbar({ width: 140, height: 36, bgColor: 'transparent' })
      img = headerLogoImg()
    }
    if (!img) return
    var applyAll = allSlots !== false
    var next = img
    if (applyAll) {
      var slots = listLogoSlots()
      var i
      for (i = 0; i < slots.length; i++) {
        var applied = applyLogoToEl(slots[i], u)
        if (slots[i] === img || (img.contains && img.contains(slots[i])) || slots[i] === selected) next = applied
      }
      if (!slots.length) next = applyLogoToEl(img, u)
    } else {
      next = applyLogoToEl(canonicalLogoEl(img) || img, u)
      applyLeftoverTextLogos(u)
    }
    post('dirty', {})
    if (next) selectEl(next)
    else refreshSelect()
    syncLogoButtons()
  }
  function applyImageUrl(url, allSlots, asLogo) {
    if (!url) return
    if (asLogo) {
      applyLogoUrl(url, allSlots !== false)
      return
    }
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
        applyLeftoverTextLogos(url)
      }
      post('dirty', {})
      if (next && next !== selected) selectEl(next)
      else refreshSelect()
      syncLogoButtons()
      return
    }
    if (!selected) return
    if (isInHeader(selected) && !isLogoTarget(selected) && !isLogoSlot(selected) && !isImgEl(selected)) {
      var headerHost = selected.closest ? selected.closest('header, .pw-header, .pw-shop-header') : null
      var headerSlot = headerHost && headerHost.querySelector
        ? headerHost.querySelector('[data-pw-logo-added], img.pw-logo, img.pw-shop-logo, .pw-wordmark, a.pw-brand, a.pw-shop-brand')
        : null
      if (headerSlot) {
        applyLogoToEl(headerSlot, url)
        try { reflowHeaderChrome() } catch (errPaint) {}
        post('dirty', {})
        refreshSelect()
        syncLogoButtons()
        return
      }
      return
    }
    var bannerHost = bannerHostOf(selected)
    if (bannerHost && !isLogoTarget(selected)) {
      var photo = heroImgIn(bannerHost)
      if (photo) {
        photo.setAttribute('src', url)
        photo.removeAttribute('srcset')
      } else {
        var curB = ''
        try { curB = bannerHost.style.backgroundImage || cs(bannerHost).backgroundImage || '' } catch (eB) { curB = '' }
        bannerHost.style.backgroundImage = replaceBgUrl(curB, url)
      }
      post('dirty', {})
      refreshSelect()
      return
    }
    if (isImgEl(selected)) {
      selected.setAttribute('src', url)
      selected.removeAttribute('srcset')
      selected.style.transform = ''
    } else {
      var paint = isBgLayerEl(selected) && selected.parentElement ? selected.parentElement : selected
      var photo2 = heroImgIn(paint)
      if (photo2) {
        photo2.setAttribute('src', url)
        photo2.removeAttribute('srcset')
      } else {
        var cur = ''
        try { cur = paint.style.backgroundImage || cs(paint).backgroundImage || '' } catch (e) { cur = '' }
        paint.style.backgroundImage = replaceBgUrl(cur, url)
      }
    }
    post('dirty', {})
    refreshSelect()
  }
  function onVeMessage(ev) {
    var d = ev.data
    if (!d || d.source !== MSG) return
    if (d.type === 'activate') activateFromHost(d)
    if (d.type === 'restoreChatLauncher') restoreChatEmbedLauncher()
    if (d.type === 'setTheme' && d.vars) applyThemeVars(d.vars)
    if (d.type === 'deactivate') deactivate()
    if (d.type === 'startAddLogo') startAddLogo()
    if (d.type === 'cancelAddLogo') cancelAddLogo()
    if (d.type === 'placeHeaderLogo') placeHeaderLogoFromToolbar(d)
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
      if (isWidgetSurfaceEl(selected)) applyWidgetTextColor(selected, d.color)
      else if (isBtnEl(selected) && !isChromeBtn(selected)) applyBtnTextColor(selected, d.color)
      else selected.style.color = d.color
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setFontSize' && selected && d.size) {
      var fs = Math.max(10, Math.min(96, Number(d.size))) + 'px'
      if (isHeaderChromeEl(selected) || isWidgetSurfaceEl(selected)) applyChromeTypeStyle(selected, 'font-size', fs)
      else selected.style.fontSize = fs
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setFontWeight' && selected) {
      var w = selected.style.fontWeight === '700' || selected.style.fontWeight === 'bold' ? '400' : '700'
      if (d.bold === true) w = '700'
      if (d.bold === false) w = '400'
      if (isHeaderChromeEl(selected) || isWidgetSurfaceEl(selected)) applyChromeTypeStyle(selected, 'font-weight', w)
      else selected.style.fontWeight = w
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setTextAlign' && selected && d.align) { selected.style.textAlign = d.align; post('dirty', {}); refreshSelect() }
    if (d.type === 'setBgColor' && selected && d.color) {
      selected.style.background = d.color
      selected.style.backgroundColor = d.color
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setImageWidth' && selected && isImgEl(selected) && d.width) {
      selected.style.width = Math.max(20, Math.min(100, Number(d.width))) + '%'
      selected.style.height = 'auto'
      selected.style.maxWidth = '100%'
      positionAllHandles()
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'resetImageTransform' && selected && canDragEl(selected)) {
      var resetBanner = bannerHostOf(selected)
      if (resetBanner && isBannerPhotoTarget(selected)) {
        applyBannerPhoto(resetBanner, 1, 50, 50)
      } else if (isLogoImg(selected) || logoFrameOf(selected)) {
        var resetFrame = logoFrameOf(selected)
        if (resetFrame) resetFrame.style.transform = ''
        applyLogoTransform(logoImgOf(selected) || selected, 1, 0, 0)
      } else {
        selected.style.transform = ''
      }
      positionAllHandles()
      post('dirty', {})
      refreshSelect()
    }
    if (d.type === 'setImageSrc' && d.url) applyImageUrl(d.url, d.allSlots, d.asLogo)
    if (d.type === 'setLogoSrc' && d.url) applyLogoUrl(d.url, d.allSlots !== false)
    if (d.type === 'setBannerZoom' && selected) {
      var zoomHost = bannerHostOf(selected)
      if (zoomHost && (isBannerPhotoTarget(selected) || isBgLayerEl(selected) || layerMode === 'image')) {
        var zoomPan = parseBannerPan(zoomHost)
        applyBannerPhoto(zoomHost, Math.max(0.5, Math.min(3, (Number(d.zoom) || 100) / 100)), zoomPan.x, zoomPan.y)
        positionAllHandles()
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'openLogoCrop' && selected) {
      var cropOpen = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
      if (cropOpen && isLogoTarget(selected)) openLogoCropOverlay(cropOpen)
    }
    if (d.type === 'setLogoZoom' && selected) {
      var zoomTarget = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
      if (zoomTarget) {
        unlockLogoImage(zoomTarget)
        ensureLogoFrame(zoomTarget)
        applyLogoZoom(zoomTarget, (Number(d.zoom) || 100) / 100)
        positionAllHandles()
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setLogoReset' && selected) {
      var resetImg = logoImgOf(selected) || (isLogoImg(selected) ? selected : null)
      if (resetImg && isLogoTarget(selected)) {
        unlockLogoImage(resetImg)
        ensureLogoFrame(resetImg)
        applyLogoTransform(resetImg, 1, 0, 0)
        resetImg.removeAttribute('data-pw-logo-crop-x')
        resetImg.removeAttribute('data-pw-logo-crop-y')
        resetImg.style.removeProperty('clip-path')
        positionAllHandles()
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setLogoCrop' && selected) {
      var cropImg = logoImgOf(selected) || (isImgEl(selected) ? selected : null)
      if (cropImg && isLogoTarget(selected)) {
        unlockLogoImage(cropImg)
        ensureLogoFrame(cropImg)
        applyLogoCrop(cropImg, Number(d.x) || 0, Number(d.y) || 0)
        positionAllHandles()
        post('dirty', {})
        refreshSelect()
      } else if (isImgEl(selected)) {
        selected.style.objectFit = 'cover'
        selected.style.objectPosition = (Number(d.x) || 50) + '% ' + (Number(d.y) || 50) + '%'
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setHref' && selected && typeof d.href === 'string') {
      if (!canSetHrefEl(selected)) return
      if (isAddedText(selected)) {
        applyAddedTextHref(selected, d.href)
        post('dirty', {})
        refreshSelect()
        return
      }
      if ((isLogoSlot(selected) || isLogoImg(selected)) && !(selected.closest && selected.closest('a'))) {
        ensureLogoHomeLink(selected)
      }
      var link = selected.tagName.toLowerCase() === 'a' ? selected : (selected.closest ? selected.closest('a') : null)
      if (link) {
        link.setAttribute('href', d.href || shopHomeHref())
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setLayerMode' && d.mode) {
      if (selected && isLogoTarget(selected)) {
        applyLayerMode(d.mode, selected)
      } else {
        var layerHost = selected && canImageLayer(selected) ? selected : (selected ? findContentBlockEl(selected) : null)
        if (layerHost && canImageLayer(layerHost)) applyLayerMode(d.mode, layerHost)
      }
    }
    if (d.type === 'selectParentBlock') {
      var mb = selected && !isMoveBlockEl(selected) ? findMoveBlockEl(selected) : null
      if (mb && mb !== selected) selectEl(mb)
      else {
        var pb = selected ? findContentBlockEl(selected) : null
        if (pb) selectEl(pb)
      }
    }
    if (d.type === 'ungroupBlock') ungroupMoveBlock()
    if (d.type === 'groupBlock') groupIntoBlock()
    if (d.type === 'hideBlock') hideSelectedBlock()
    if (d.type === 'showHidden' && d.id) showHiddenBlock(d.id)
    if (d.type === 'deleteBlock') deleteSelectedBlock()
    if (d.type === 'duplicateBlock') duplicateSelectedBlock()
    if (d.type === 'setChatIconLogo') setChatIconLogo(d.url)
    if (d.type === 'insertChromeBtn') insertChromeBtn(d.kind, d.html, d.host, d)
    if (d.type === 'bringExistingChromeToCenter') bringExistingChromeToCenter(d.kind)
    if (d.type === 'setInfoPageContent') setInfoPageContent(d)
    if (d.type === 'stampInfoPage') {
      ensureInfoArticle()
      ensureInfoSeoCoach()
    }
    if (d.type === 'setInfoSeoBusy') setInfoSeoBusy(!!d.busy)
    if (d.type === 'setInfoSeoNotes') {
      var regionN = document.querySelector('[data-pw-info-article],[data-pw-region="content"],.pw-shop-info')
      var coachN = document.querySelector('[data-pw-seo-coach="1"] textarea')
      var notes = String(d.notes || '')
      if (regionN) regionN.setAttribute('data-pw-seo-notes', notes)
      if (coachN) coachN.value = notes
    }
    if (d.type === 'insertText') insertText()
    if (d.type === 'insertArticleImage' && d.url) insertArticleImage(d.url)
    if (d.type === 'insertButton') insertButton(d)
    if (d.type === 'insertBg') insertBg(d)
    if (d.type === 'bringBgFront') bringAddedBgFront()
    if (d.type === 'sendBgBack') sendAddedBgBack()
    if (d.type === 'layerBgUp') layerAddedBg(1)
    if (d.type === 'layerBgDown') layerAddedBg(-1)
    if (d.type === 'layerElUp') stepElementLayer(1)
    if (d.type === 'layerElDown') stepElementLayer(-1)
    if (d.type === 'setScene') setElementScene(d.scene)
    if (d.type === 'sceneUp') stepElementScene(1)
    if (d.type === 'sceneDown') stepElementScene(-1)
    if (d.type === 'setSceneFocus') setSceneFocus(d.scene)
    if (d.type === 'layerElFront') bringElementFront()
    if (d.type === 'layerElBack') sendElementBack()
    if (d.type === 'setChromeStyle') setChromeStyle(d.style)
    if (d.type === 'setChromeSize') setChromeSize(d.size)
    if (d.type === 'setButtonStyle') setButtonStyle(d.style)
    if (d.type === 'setButtonLabel') setButtonLabel(d.text)
    if (d.type === 'setSearchPlaceholder') {
      var phIn = selected ? searchInputOf(selected) : null
      if (phIn) {
        phIn.setAttribute('placeholder', String(d.text || ''))
        if (phIn.getAttribute('data-pw-edit-placeholder') === '1') phIn.value = String(d.text || '')
        post('dirty', {})
        refreshSelect()
      }
    }
    if (d.type === 'setTextContent') setTextContent(d.text)
    if (d.type === 'setButtonColor') setButtonColor(d.color)
    if (d.type === 'setButtonBorder') setButtonBorder(d.color)
    if (d.type === 'setIconColor') setIconColor(d.color)
    if (d.type === 'setDotColor') setDotColor(d.color)
    if (d.type === 'setDotActiveColor') setDotActiveColor(d.color)
    if (d.type === 'setPlaceholderColor') setPlaceholderColor(d.color)
    if (d.type === 'setStickHeader') setStickHeader(!!d.on)
    if (d.type === 'setPinScreen') setPinScreen(!!d.on)
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
    if (d.type === 'resetHistory') resetHistoryBaseline()
    if (d.type === 'listHidden') postHidden()
    if (d.type === 'serialize') {
      try {
        bakeHeaderLogoHomeLinks()
        stickHeaderRelease()
        hideLogoCropUi()
        logoCrop.live = false
        logoCrop.on = false
        logoCrop.img = null
        logoCrop.snap = null
        clearHover()
        clearSelection()
        hideLayerSwitches()
        hideLogoButtons()
        hideLogoDrawRect()
      } catch (eSer) {}
      post('html', { html: document.documentElement.outerHTML })
    }
  }
  try {
    if (window.__nanoaiVeOnMessage) window.removeEventListener('message', window.__nanoaiVeOnMessage)
  } catch (eRm) {}
  window.__nanoaiVeOnMessage = onVeMessage
  window.addEventListener('message', onVeMessage)
  try { sizeChromeIcons(document) } catch (err) {}
  try { restoreWidgetColors(document) } catch (errW) {}
  // Không activate rỗng — host gửi đủ pageKey/infoPage rồi mới bật ô AI
  post('loaded', {})
})`

/** Hằng số lớp không gian — runtime và server dùng chung một nguồn. */
const SCENE_RUNTIME = {
  attr: PW_SCENE_ATTR,
  band: PW_SCENE_BAND,
  localMax: PW_SCENE_LOCAL_MAX,
  minIndex: PW_SCENE_MIN_INDEX,
  maxIndex: PW_SCENE_MAX_INDEX,
  defaultIndex: PW_SCENE_DEFAULT_INDEX,
  zMax: PW_SCENE_Z_MAX,
  keys: PW_SCENE_LAYERS.map((layer) => layer.key),
}

export function buildVisualEditorScript(locale: WebLocale): string {
  const copy = COPY[locale in COPY ? locale : 'en']
  return (
    RUNTIME_BODY +
    '(' +
    JSON.stringify(NANOAI_VE_MESSAGE) +
    ',' +
    JSON.stringify(copy) +
    ',' +
    JSON.stringify(SCENE_RUNTIME) +
    ');'
  )
}
