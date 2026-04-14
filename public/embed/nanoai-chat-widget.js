(function () {
  var script = document.currentScript
  if (!script) {
    var allScripts = document.getElementsByTagName('script')
    for (var i = allScripts.length - 1; i >= 0; i -= 1) {
      var s = allScripts[i]
      var src = String((s && s.getAttribute && s.getAttribute('src')) || '')
      var hasChatUrl = !!(s && s.getAttribute && s.getAttribute('data-chat-url'))
      if (src.indexOf('/embed/nanoai-chat-widget.js') >= 0 && hasChatUrl) {
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
    var chatUrl = getAttr('data-chat-url', '')
    if (!chatUrl) return

    var logoUrl = getAttr('data-logo-url', '')
    var side = getAttr('data-side', 'right') === 'left' ? 'left' : 'right'
    var bottom = num(getAttr('data-bottom', '24'), 24, 0, 800)
    var offsetX = num(getAttr('data-offset-x', '16'), 16, 0, 300)
    var desktopWidth = num(getAttr('data-width', '380'), 380, 280, 1200)
    var desktopHeight = num(getAttr('data-height', '560'), 560, 320, 1200)
    var radius = num(getAttr('data-radius', '12'), 12, 0, 60)
    var mobileBreakpoint = num(getAttr('data-mobile-breakpoint', '768'), 768, 320, 1600)
    var bubbleSize = num(getAttr('data-bubble-size', '56'), 56, 40, 100)
    var mobileBubbleSize = num(getAttr('data-mobile-bubble-size', '52'), 52, 40, 100)
    var panelBottom = num(getAttr('data-panel-bottom', '12'), 12, 0, 120)
    var widgetId = getAttr('data-widget-id', 'nanoai-chat-widget-v1')

    var existingRoot = document.getElementById(widgetId)
    if (existingRoot) {
      var hasMountedUi =
        !!existingRoot.querySelector('button[aria-label="Open NanoAI chat"]') ||
        !!existingRoot.querySelector('iframe')
      if (hasMountedUi) return
      if (existingRoot.parentNode) existingRoot.parentNode.removeChild(existingRoot)
    }
    if (!document.body) return

    var root = document.createElement('div')
    root.id = widgetId
    root.style.cssText =
      'position:fixed;z-index:2147483000;font-family:Arial,sans-serif;pointer-events:none;'
    document.body.appendChild(root)

    var bubble = document.createElement('button')
    bubble.type = 'button'
    bubble.setAttribute('aria-label', 'Open NanoAI chat')
    bubble.style.cssText =
      'pointer-events:auto;width:' +
      bubbleSize +
      'px;height:' +
      bubbleSize +
      'px;border:none;border-radius:9999px;cursor:pointer;' +
      'background:linear-gradient(135deg,#7c3aed,#6366f1);box-shadow:0 10px 24px rgba(0,0,0,.25);' +
      'display:flex;align-items:center;justify-content:center;padding:0;overflow:hidden;'

    if (logoUrl) {
      var logoMask = document.createElement('span')
      logoMask.style.cssText =
        'width:100%;height:100%;border-radius:9999px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#fff;'
      var logo = document.createElement('img')
      logo.src = logoUrl
      logo.alt = 'NanoAI'
      logo.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:9999px;'
      logo.onerror = function () {
        logoMask.style.display = 'none'
        bubble.textContent = 'AI'
        bubble.style.color = '#fff'
        bubble.style.fontWeight = '700'
      }
      logoMask.appendChild(logo)
      bubble.appendChild(logoMask)
    } else {
      bubble.textContent = 'AI'
      bubble.style.color = '#fff'
      bubble.style.fontWeight = '700'
    }
    root.appendChild(bubble)

    var panel = document.createElement('div')
    panel.style.cssText =
      'pointer-events:auto;display:none;position:absolute;background:#fff;overflow:hidden;' +
      'box-shadow:0 16px 40px rgba(0,0,0,.28);border:1px solid #e5e7eb;'
    root.appendChild(panel)
    root.setAttribute('data-nanoai-ready', '1')

    var header = document.createElement('div')
    header.style.cssText =
      'height:44px;background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;padding:0 10px;pointer-events:auto;'
    header.innerHTML = '<div style="font-weight:700;font-size:15px;color:#111">NanoAI</div>'
    panel.appendChild(header)

    var closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close chat')
    closeBtn.style.cssText =
      'width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;background:#f3f4f6;color:#111;font-size:18px;line-height:1;'
    closeBtn.textContent = '×'
    var expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.setAttribute('aria-label', 'Expand chat')
    expandBtn.style.cssText =
      'width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;background:#f3f4f6;color:#111;font-size:13px;line-height:1;display:flex;align-items:center;justify-content:center;'
    function setExpandButtonIcon(expanded) {
      // Use SVG icon to avoid font-dependent glyph issues on host sites.
      expandBtn.innerHTML = expanded
        ? '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 9h10v10" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M19 9v10H9" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
    }
    setExpandButtonIcon(false)
    var headerActions = document.createElement('div')
    headerActions.style.cssText = 'display:flex;align-items:center;gap:6px;'
    headerActions.appendChild(expandBtn)
    headerActions.appendChild(closeBtn)
    header.appendChild(headerActions)

    var body = document.createElement('div')
    body.style.cssText = 'width:100%;height:calc(100% - 44px);pointer-events:auto;'
    panel.appendChild(body)

    var iframe = null
    var pageContext = null
    var isExpanded = false

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

    function pickSkuFromText(raw) {
      var text = String(raw || '').replace(/\s+/g, ' ').trim()
      if (!text) return ''
      var m = text.match(/(?:m[aã]\s*sp|ma\s*sp|sku|model)\s*[:：\-]?\s*([A-Za-z0-9][A-Za-z0-9._/-]{1,95})/i)
      if (m && m[1]) return m[1].trim()
      var stripped = text.replace(/^(m[aã]\s*sp|ma\s*sp|sku|model)\s*[:：\-]?\s*/i, '').trim()
      var cands = stripped.match(/[A-Za-z0-9][A-Za-z0-9._/-]{1,95}/g) || []
      return cands.length ? cands[0].trim() : ''
    }

    function extractPageContext() {
      var out = {}
      try {
        var codeEl =
          document.getElementById('copy-code-product') ||
          document.querySelector('#copy-code-product,[id*="copy-code-product"],.copy-code-product')
        var codeText = codeEl ? String(codeEl.textContent || '').trim() : ''
        var sku = pickSkuFromText(codeText)
        if (sku) out.sku = sku
      } catch (_) {}

      try {
        var imgs = document.querySelectorAll(
          '.image_list img, .image-list img, [class*="image_list"] img, [class*="image-list"] img'
        )
        for (var i = 0; i < imgs.length; i += 1) {
          var img = imgs[i]
          var imgUrl = toHttpUrl(img.getAttribute('data-src') || img.getAttribute('src') || '')
          if (imgUrl) {
            out.imageUrl = imgUrl
            break
          }
        }
      } catch (_) {}

      try {
        var canonical = document.querySelector('link[rel="canonical"]')
        var canonicalUrl = canonical ? toHttpUrl(canonical.getAttribute('href')) : ''
        var pageUrl = toHttpUrl(window.location.href)
        if (canonicalUrl) out.productUrl = canonicalUrl
        else if (pageUrl) out.productUrl = pageUrl
      } catch (_) {}

      return out
    }

    function buildChatUrlWithContext(baseUrl, ctx) {
      try {
        var u = new URL(baseUrl, window.location.href)
        if (ctx && ctx.sku) u.searchParams.set('ctx_sku', ctx.sku)
        if (ctx && ctx.imageUrl) u.searchParams.set('ctx_image', ctx.imageUrl)
        if (ctx && ctx.productUrl) u.searchParams.set('ctx_product_url', ctx.productUrl)
        if (ctx && (ctx.sku || ctx.imageUrl || ctx.productUrl)) {
          u.searchParams.set('ctx_source', 'widget_page')
        }
        return u.toString()
      } catch (_) {
        return baseUrl
      }
    }

    function ensureIframe(ctx) {
      var nextCtx = ctx || extractPageContext()
      pageContext = nextCtx
      var nextSrc = buildChatUrlWithContext(chatUrl, nextCtx)
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.src = nextSrc
        iframe.title = 'Chat NanoAI'
        iframe.loading = 'lazy'
        iframe.referrerPolicy = 'no-referrer-when-downgrade'
        iframe.style.cssText = 'width:100%;height:100%;border:0;pointer-events:auto;'
        body.appendChild(iframe)
        return
      }
      if (iframe.src !== nextSrc) iframe.src = nextSrc
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
      // Keep bubble visible even if integrator sets a very large bottom offset.
      var maxBottom = Math.max(8, viewportHeight() - sizePx - 8)
      return Math.min(bottom, maxBottom)
    }

    function openChat() {
      ensureIframe(extractPageContext())
      panel.style.display = 'block'
      bubble.style.display = 'none'
      applyLayout()
    }
    function closeChat() {
      panel.style.display = 'none'
      bubble.style.display = 'flex'
    }
    bubble.addEventListener('click', openChat)
    closeBtn.addEventListener('click', closeChat)
    expandBtn.addEventListener('click', function () {
      isExpanded = !isExpanded
      setExpandButtonIcon(isExpanded)
      expandBtn.setAttribute('aria-label', isExpanded ? 'Restore chat size' : 'Expand chat')
      applyLayout()
    })

    function placeDesktop() {
      var safeBottom = clampBottomOffset(bubbleSize)
      var availableHeight = Math.max(220, viewportHeight() - panelBottom - 12)
      var finalHeight = Math.min(desktopHeight, availableHeight)

      root.style.top = '0'
      root.style.left = '0'
      root.style.right = '0'
      root.style.bottom = '0'
      bubble.style.position = 'absolute'
      bubble.style.bottom = safeBottom + 'px'
      panel.style.position = 'fixed'
      if (side === 'left') {
        bubble.style.left = offsetX + 'px'
        bubble.style.right = 'auto'
      } else {
        bubble.style.right = offsetX + 'px'
        bubble.style.left = 'auto'
      }
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
        panel.style.width = 'min(40vw,' + desktopWidth + 'px)'
        panel.style.height = finalHeight + 'px'
      }
      panel.style.borderRadius = radius + 'px'
      bubble.style.width = bubbleSize + 'px'
      bubble.style.height = bubbleSize + 'px'
      bubble.style.margin = '0'
      expandBtn.style.display = 'flex'
    }

    function placeMobile() {
      var safeBottom = clampBottomOffset(mobileBubbleSize)
      root.style.top = '0'
      root.style.left = '0'
      root.style.right = '0'
      root.style.bottom = '0'
      bubble.style.position = 'absolute'
      bubble.style.bottom = safeBottom + 'px'
      bubble.style.width = mobileBubbleSize + 'px'
      bubble.style.height = mobileBubbleSize + 'px'
      bubble.style.margin = '0'
      if (side === 'left') {
        bubble.style.left = offsetX + 'px'
        bubble.style.right = 'auto'
      } else {
        bubble.style.right = offsetX + 'px'
        bubble.style.left = 'auto'
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
      // Host root uses pointer-events:none so clicks pass through empty areas; panel/iframe must stay clickable (some browsers need this reinforced after layout).
      panel.style.pointerEvents = 'auto'
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

