/** NanoAI nút thử đồ nhúng site shop — mở cùng UI thử đồ trong chat (iframe ?embed=1&open_try_on=1). Cache-bust: .../nanoai-try-on-widget.js?v= */
(function () {
  var script = document.currentScript
  if (!script) {
    var allScripts = document.getElementsByTagName('script')
    for (var i = allScripts.length - 1; i >= 0; i -= 1) {
      var s = allScripts[i]
      var src = String((s && s.getAttribute && s.getAttribute('src')) || '')
      var hasTryOnUrl = !!(s && s.getAttribute && s.getAttribute('data-try-on-url'))
      if (src.indexOf('/embed/nanoai-try-on-widget.js') >= 0 && hasTryOnUrl) {
        script = s
        break
      }
    }
  }
  if (!script) return

  function num(v, fallback, min, max) {
    var n = parseInt(v, 10)
    if (!isFinite(n)) n = fallback
    if (typeof min === 'number' && n < min) n = min
    if (typeof max === 'number' && n > max) n = max
    return n
  }

  function getAttr(name, fallback) {
    var v = script.getAttribute(name)
    if (v == null || v === '') return fallback
    return String(v)
  }

  function mount() {
    var baseTryOnUrl = getAttr('data-try-on-url', '').trim()
    if (!baseTryOnUrl) return

    var shopNameRaw = getAttr('data-shop-name', '')
    var shopName = String(shopNameRaw || '').trim() || 'Thử đồ AI'

    var labelRaw = getAttr('data-label', '')
    var buttonLabel = String(labelRaw || '').trim() || 'Thử đồ'

    var logoUrl = getAttr('data-logo-url', '')
    var mode = getAttr('data-mode', 'floating').trim().toLowerCase() === 'inline' ? 'inline' : 'floating'

    var side = getAttr('data-side', 'right') === 'left' ? 'left' : 'right'
    var bottom = num(getAttr('data-bottom', '24'), 24, 0, 800)
    var offsetX = num(getAttr('data-offset-x', '16'), 16, 0, 300)
    var desktopWidth = num(getAttr('data-width', '380'), 380, 280, 1200)
    var desktopHeight = num(getAttr('data-height', '620'), 620, 320, 1200)
    var radius = num(getAttr('data-radius', '12'), 12, 0, 60)
    var mobileBreakpoint = num(getAttr('data-mobile-breakpoint', '768'), 768, 320, 1600)
    var bubbleSize = num(getAttr('data-bubble-size', '56'), 56, 40, 100)
    var mobileBubbleSize = num(getAttr('data-mobile-bubble-size', '52'), 52, 40, 100)
    var panelBottom = num(getAttr('data-panel-bottom', '12'), 12, 0, 120)
    var widgetId = getAttr('data-widget-id', 'nanoai-try-on-widget-v1')

    var uiLocaleRaw = getAttr('data-ui-locale', '').trim().toLowerCase()
    var uiLocale = ['vi', 'en', 'zh', 'ja', 'ko'].indexOf(uiLocaleRaw) >= 0 ? uiLocaleRaw : ''

    var inlineHost = null

    var existingRoot = document.getElementById(widgetId)
    if (existingRoot) {
      var hasUi =
        !!existingRoot.querySelector('[data-nanoai-try-on-trigger="1"]') ||
        !!existingRoot.querySelector('iframe')
      if (hasUi) return
      if (existingRoot.parentNode) existingRoot.parentNode.removeChild(existingRoot)
    }
    if (!document.body) return

    function toHttpUrl(raw) {
      var t = String(raw || '').trim()
      if (!t) return ''
      if (t.indexOf('//') === 0) t = window.location.protocol + t
      try {
        t = new URL(t, window.location.href).toString()
      } catch (_) {
        return ''
      }
      return /^https?:\/\//i.test(t) ? t : ''
    }

    function isLikelyVideoUrl(u) {
      var s = String(u || '').trim().toLowerCase()
      if (!s) return false
      var pathOnly = s.split(/[?#]/)[0] || s
      if (/\.(mp4|webm|m3u8|mov|mkv|ogv|ogg|avi)$/i.test(pathOnly)) return true
      if (/\.(mp4|webm|m3u8)([?&]|$)/i.test(s)) return true
      return false
    }

    function pickGalleryImgUrl(img) {
      var ds = toHttpUrl(img.getAttribute('data-src') || '')
      var sr = toHttpUrl(img.getAttribute('src') || '')
      if (ds && isLikelyVideoUrl(ds)) {
        if (sr && !isLikelyVideoUrl(sr)) return sr
        return ''
      }
      if (sr && !isLikelyVideoUrl(sr)) return sr
      if (ds && !isLikelyVideoUrl(ds)) return ds
      return sr || ds
    }

    function pickSkuFromText(raw) {
      var text = String(raw || '').replace(/\s+/g, ' ').trim()
      if (!text) return ''
      var m = text.match(/(?:m[aã]\s*sp|ma\s*sp|sku|model)\s*[:：\-]?\s*([A-Za-z0-9][A-Za-z0-9._/-]{1,95})/i)
      if (m && m[1]) return m[1].trim()
      var stripped = text.replace(/^(m[aã]\s*sp|ma\s*sp|sku|model)\s*[:：\-]?\s*/i, '').trim()
      var cands = stripped.match(/[A-Za-z0-9][A-Za-z0-9._/-]{1,95}/g) || []
      return cands.length ? cands[0].trim() : ''
    }

    function extractScriptTagContext() {
      var out = {}
      try {
        var skuRaw = getAttr('data-ctx-sku', '')
        var skuEl = document.getElementById('nanoai-ctx-sku')
        var skuFromHidden = skuEl ? String(skuEl.textContent || '').trim() : ''
        var sku = pickSkuFromText(skuRaw || skuFromHidden)
        if (!sku && skuRaw) sku = String(skuRaw).replace(/\s+/g, ' ').trim().slice(0, 128)
        if (sku) out.sku = sku
        var img1 = toHttpUrl(getAttr('data-ctx-image', ''))
        var img2 = toHttpUrl(getAttr('data-ctx-image-2', ''))
        if (img1 && !isLikelyVideoUrl(img1)) out.imageUrl = img1
        if (img2 && !isLikelyVideoUrl(img2)) out.imageUrl2 = img2
        var pu = toHttpUrl(getAttr('data-ctx-product-url', ''))
        if (pu) out.productUrl = pu
        var inv = String(getAttr('data-ctx-inventory', '')).trim()
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inv)) out.inventoryId = inv
      } catch (_) {}
      return out
    }

    function extractPageContext() {
      var out = extractScriptTagContext()
      try {
        var codeEl =
          document.getElementById('copy-code-product') ||
          document.querySelector('#copy-code-product,[id*="copy-code-product"],.copy-code-product')
        var codeText = codeEl ? String(codeEl.textContent || '').trim() : ''
        var sku = pickSkuFromText(codeText)
        if (sku && !out.sku) out.sku = sku
      } catch (_) {}

      try {
        var imgs = document.querySelectorAll(
          '.image_list img, .image-list img, [class*="image_list"] img, [class*="image-list"] img'
        )
        var urls = []
        for (var i = 0; i < imgs.length; i += 1) {
          var imgUrl = pickGalleryImgUrl(imgs[i])
          if (imgUrl && urls.indexOf(imgUrl) === -1) urls.push(imgUrl)
        }
        if (urls[0] && !out.imageUrl) out.imageUrl = urls[0]
        if (urls[1] && !out.imageUrl2) out.imageUrl2 = urls[1]
      } catch (_) {}

      try {
        var canonical = document.querySelector('link[rel="canonical"]')
        var canonicalUrl = canonical ? toHttpUrl(canonical.getAttribute('href')) : ''
        var pageUrl = toHttpUrl(window.location.href)
        if (canonicalUrl && !out.productUrl) out.productUrl = canonicalUrl
        else if (pageUrl && !out.productUrl) out.productUrl = pageUrl
      } catch (_) {}

      return out
    }

    function buildTryOnIframeUrl(baseUrl, ctx) {
      try {
        var u = new URL(baseUrl, window.location.href)
        u.searchParams.set('embed', '1')
        u.searchParams.set('open_try_on', '1')
        if (uiLocale) u.searchParams.set('ui_locale', uiLocale)
        if (ctx && ctx.sku) u.searchParams.set('ctx_sku', ctx.sku)
        if (ctx && ctx.imageUrl) u.searchParams.set('ctx_image', ctx.imageUrl)
        if (ctx && ctx.imageUrl2) u.searchParams.set('ctx_image_2', ctx.imageUrl2)
        if (ctx && ctx.productUrl) u.searchParams.set('ctx_product_url', ctx.productUrl)
        if (ctx && ctx.inventoryId) u.searchParams.set('ctx_inventory', ctx.inventoryId)
        if (
          ctx &&
          (ctx.sku || ctx.imageUrl || ctx.imageUrl2 || ctx.productUrl || ctx.inventoryId)
        ) {
          u.searchParams.set('ctx_source', 'widget_page')
        }
        return u.toString()
      } catch (_) {
        return baseUrl
      }
    }

    var MSG_SOURCE = 'nanoai-widget'
    var RETURN_SESSION_KEY = 'nanoai_return_tryon_iframe_href_v1'

    function isAllowedHttpUrl(u) {
      try {
        var x = new URL(String(u || '').trim())
        return x.protocol === 'http:' || x.protocol === 'https:'
      } catch (_) {
        return false
      }
    }

    function readReturnHref() {
      try {
        var s = sessionStorage.getItem(RETURN_SESSION_KEY)
        s = s ? String(s).trim() : ''
        return s && isAllowedHttpUrl(s) ? s : ''
      } catch (_) {
        return ''
      }
    }

    function writeReturnHref(href) {
      try {
        if (href && isAllowedHttpUrl(href)) sessionStorage.setItem(RETURN_SESSION_KEY, String(href).trim())
      } catch (_) {}
    }

    window.addEventListener(
      'message',
      function (e) {
        try {
          var d = e.data
          if (!d || d.source !== MSG_SOURCE || d.type !== 'NAVIGATE_TOP') return
          if (!iframe || !iframe.contentWindow || e.source !== iframe.contentWindow) return
          var nextUrl = String(d.url || '').trim()
          if (!isAllowedHttpUrl(nextUrl)) return
          var ret = typeof d.returnChatUrl === 'string' ? d.returnChatUrl.trim() : ''
          if (ret && isAllowedHttpUrl(ret)) writeReturnHref(ret)
          window.location.assign(nextUrl)
        } catch (_) {}
      },
      false
    )

    var root = document.createElement('div')
    root.id = widgetId
    root.setAttribute('data-nanoai-ready', '1')
    if (mode === 'floating') {
      root.style.cssText =
        'position:fixed;z-index:2147483000;font-family:Arial,sans-serif;pointer-events:none;'
      document.body.appendChild(root)
    } else {
      inlineHost = document.createElement('div')
      inlineHost.className = 'nanoai-try-on-inline-host'
      inlineHost.style.cssText = 'display:inline-block;max-width:100%;vertical-align:middle;'
      script.parentNode && script.parentNode.insertBefore(inlineHost, script.nextSibling)
      root.style.cssText =
        'position:fixed;z-index:2147483000;font-family:Arial,sans-serif;pointer-events:none;left:0;top:0;right:0;bottom:0;'
      document.body.appendChild(root)
    }

    var bubble = document.createElement('button')
    bubble.type = 'button'
    bubble.setAttribute('data-nanoai-try-on-trigger', '1')
    bubble.setAttribute('aria-label', buttonLabel)
    bubble.style.cssText =
      'pointer-events:auto;min-height:' +
      bubbleSize +
      'px;padding:0 14px;border:none;border-radius:9999px;cursor:pointer;font-weight:700;font-size:14px;' +
      'background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;box-shadow:0 10px 24px rgba(0,0,0,.25);' +
      'display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:normal;text-align:center;max-width:100%;'

    if (logoUrl && mode === 'floating') {
      var logo = document.createElement('img')
      logo.src = logoUrl
      logo.alt = ''
      logo.style.cssText = 'width:28px;height:28px;border-radius:9999px;object-fit:cover;flex-shrink:0;'
      logo.onerror = function () {
        logo.style.display = 'none'
      }
      bubble.appendChild(logo)
    }
    var lbl = document.createElement('span')
    lbl.textContent = buttonLabel
    bubble.appendChild(lbl)

    if (mode === 'floating') {
      root.appendChild(bubble)
    } else if (inlineHost) {
      inlineHost.appendChild(bubble)
    }

    var panel = document.createElement('div')
    panel.style.cssText =
      'pointer-events:none;display:none;position:absolute;background:#fff;overflow:hidden;' +
      'box-shadow:0 16px 40px rgba(0,0,0,.28);border:1px solid #e5e7eb;touch-action:auto;-webkit-tap-highlight-color:transparent;'
    root.appendChild(panel)

    var header = document.createElement('div')
    header.style.cssText =
      'height:44px;background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;gap:4px;padding:0 8px 0 10px;pointer-events:auto;'
    var brandEl = document.createElement('div')
    brandEl.style.cssText =
      'font-weight:700;font-size:15px;color:#111;min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    brandEl.textContent = shopName
    header.appendChild(brandEl)

    var closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Đóng')
    var iconBtnBase =
      'width:30px;height:30px;border:none;border-radius:9999px;cursor:pointer;background:#f3f4f6;color:#111;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0;'
    closeBtn.style.cssText = iconBtnBase + 'font-size:17px;padding:0;'
    closeBtn.textContent = '×'
    header.appendChild(closeBtn)
    panel.appendChild(header)

    var body = document.createElement('div')
    body.style.cssText =
      'width:100%;height:calc(100% - 44px);pointer-events:auto;touch-action:auto;-webkit-overflow-scrolling:touch;'
    panel.appendChild(body)

    var iframe = null
    var pageContext = null
    var isExpanded = false

    var expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.setAttribute('aria-label', 'Mở rộng')
    expandBtn.style.cssText = iconBtnBase + 'padding:0;margin-right:4px;'
    function setExpandIcon(expanded) {
      var g =
        '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
      expandBtn.innerHTML = expanded
        ? '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
          g +
          '<path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/></g></svg>'
        : '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
          g +
          '<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></g></svg>'
    }
    setExpandIcon(false)
    header.insertBefore(expandBtn, closeBtn)

    function ensureIframe(ctx) {
      var nextCtx = ctx || extractPageContext()
      pageContext = nextCtx
      var baseForBuild = iframe && iframe.src ? iframe.src : baseTryOnUrl
      if (!iframe) {
        var resume = readReturnHref()
        if (resume) baseForBuild = resume
      }
      try {
        var uLoc = new URL(baseForBuild, window.location.href)
        if (uiLocale && !uLoc.searchParams.get('ui_locale')) uLoc.searchParams.set('ui_locale', uiLocale)
        uLoc.searchParams.set('embed', '1')
        uLoc.searchParams.set('open_try_on', '1')
        baseForBuild = uLoc.toString()
      } catch (_) {}
      var nextSrc = buildTryOnIframeUrl(baseForBuild, nextCtx)
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.src = nextSrc
        iframe.loading = 'eager'
        iframe.referrerPolicy = 'no-referrer-when-downgrade'
        iframe.style.cssText =
          'width:100%;height:100%;border:0;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
        iframe.title = shopName
        body.appendChild(iframe)
        return
      }
      if (iframe.src !== nextSrc) iframe.src = nextSrc
    }

    function extractGuestSlugFromUrl(urlStr) {
      try {
        var u = new URL(urlStr, window.location.href)
        var m = u.pathname.match(/\/messaging\/p\/([^/]+)/)
        return m && m[1] ? decodeURIComponent(m[1]) : ''
      } catch (_) {
        return ''
      }
    }

    function applyResolvedShopName(name) {
      var dn = String(name || '').trim()
      if (!dn) return
      shopName = dn
      brandEl.textContent = dn
      if (iframe) iframe.title = dn
    }

    if (!String(shopNameRaw || '').trim()) {
      var slugBrand = extractGuestSlugFromUrl(baseTryOnUrl)
      if (slugBrand) {
        try {
          var bu = new URL(baseTryOnUrl, window.location.href)
          var brandFetchUrl = bu.origin + '/api/messaging/guest/' + encodeURIComponent(slugBrand) + '/brand'
          fetch(brandFetchUrl, { credentials: 'omit', mode: 'cors' })
            .then(function (r) {
              return r.ok ? r.json() : null
            })
            .then(function (j) {
              if (!j || typeof j.displayName !== 'string') return
              applyResolvedShopName(j.displayName)
            })
            .catch(function () {})
        } catch (_) {}
      }
    }

    function viewportHeight() {
      return (
        window.innerHeight ||
        document.documentElement.clientHeight ||
        document.body.clientHeight ||
        800
      )
    }

    function clampBottomOffset(sizePx) {
      var maxBottom = Math.max(8, viewportHeight() - sizePx - 8)
      return Math.min(bottom, maxBottom)
    }

    function openTryOn() {
      ensureIframe(extractPageContext())
      panel.style.display = 'block'
      panel.style.pointerEvents = 'auto'
      if (mode === 'floating') bubble.style.display = 'none'
      applyLayout()
    }

    function closeTryOn() {
      panel.style.display = 'none'
      panel.style.pointerEvents = 'none'
      if (mode === 'floating') bubble.style.display = 'inline-flex'
    }

    bubble.addEventListener('click', openTryOn)
    closeBtn.addEventListener('click', closeTryOn)
    expandBtn.addEventListener('click', function () {
      isExpanded = !isExpanded
      setExpandIcon(isExpanded)
      expandBtn.setAttribute('aria-label', isExpanded ? 'Thu nhỏ' : 'Mở rộng')
      applyLayout()
    })

    function placeDesktop() {
      var safeBottom = clampBottomOffset(mode === 'floating' ? bubbleSize : 24)
      var availableHeight = Math.max(220, viewportHeight() - panelBottom - 12)
      var finalHeight = Math.min(desktopHeight, availableHeight)

      root.style.top = '0'
      root.style.left = '0'
      root.style.right = '0'
      root.style.bottom = '0'

      if (mode === 'floating') {
        bubble.style.position = 'absolute'
        bubble.style.bottom = safeBottom + 'px'
        if (side === 'left') {
          bubble.style.left = offsetX + 'px'
          bubble.style.right = 'auto'
        } else {
          bubble.style.right = offsetX + 'px'
          bubble.style.left = 'auto'
        }
        bubble.style.width = 'auto'
        bubble.style.minHeight = bubbleSize + 'px'
      }

      panel.style.position = 'fixed'
      if (isExpanded) {
        panel.style.left = '8px'
        panel.style.right = '8px'
        panel.style.top = '8px'
        panel.style.bottom = '8px'
        panel.style.width = 'auto'
        panel.style.height = 'auto'
      } else {
        if (side === 'left') {
          panel.style.left = offsetX + 'px'
          panel.style.right = 'auto'
        } else {
          panel.style.right = offsetX + 'px'
          panel.style.left = 'auto'
        }
        panel.style.top = 'auto'
        panel.style.bottom = panelBottom + 'px'
        panel.style.width = 'min(34vw,' + desktopWidth + 'px)'
        panel.style.height = finalHeight + 'px'
      }
      panel.style.borderRadius = radius + 'px'
      if (mode === 'floating') {
        bubble.style.width = 'auto'
        bubble.style.minHeight = bubbleSize + 'px'
      }
      expandBtn.style.display = 'flex'
    }

    function placeMobile() {
      var safeBottom = clampBottomOffset(mode === 'floating' ? mobileBubbleSize : 24)
      root.style.top = '0'
      root.style.left = '0'
      root.style.right = '0'
      root.style.bottom = '0'

      if (mode === 'floating') {
        bubble.style.position = 'absolute'
        bubble.style.bottom = safeBottom + 'px'
        bubble.style.minHeight = mobileBubbleSize + 'px'
        if (side === 'left') {
          bubble.style.left = offsetX + 'px'
          bubble.style.right = 'auto'
        } else {
          bubble.style.right = offsetX + 'px'
          bubble.style.left = 'auto'
        }
      }

      panel.style.position = 'fixed'
      panel.style.left = '0'
      panel.style.right = '0'
      panel.style.top = '0'
      panel.style.bottom = '0'
      panel.style.width = '100vw'
      panel.style.height = '100dvh'
      panel.style.borderRadius = '0'
      expandBtn.style.display = 'none'
    }

    var resizeTimer = null
    function applyLayout() {
      if (window.innerWidth <= mobileBreakpoint) placeMobile()
      else placeDesktop()
      body.style.pointerEvents = 'auto'
      if (iframe) iframe.style.pointerEvents = 'auto'
    }
    function onResize() {
      if (resizeTimer) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(applyLayout, 100)
    }
    applyLayout()
    window.addEventListener('resize', onResize, { passive: true })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }
})()
