(function () {
  var script = document.currentScript
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
    var widgetId = getAttr('data-widget-id', 'nanoai-chat-widget-v1')

    if (document.getElementById(widgetId)) return
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
      'display:flex;align-items:center;justify-content:center;padding:0;'

    if (logoUrl) {
      var logo = document.createElement('img')
      logo.src = logoUrl
      logo.alt = 'NanoAI'
      logo.style.cssText = 'width:30px;height:30px;object-fit:contain;display:block;'
      logo.onerror = function () {
        this.style.display = 'none'
        bubble.textContent = 'AI'
        bubble.style.color = '#fff'
        bubble.style.fontWeight = '700'
      }
      bubble.appendChild(logo)
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

    var header = document.createElement('div')
    header.style.cssText =
      'height:44px;background:#fff;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;padding:0 10px;'
    header.innerHTML = '<div style="font-weight:700;font-size:15px;color:#111">NanoAI</div>'
    panel.appendChild(header)

    var closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close chat')
    closeBtn.style.cssText =
      'width:28px;height:28px;border:none;border-radius:8px;cursor:pointer;background:#f3f4f6;color:#111;font-size:18px;line-height:1;'
    closeBtn.textContent = '×'
    header.appendChild(closeBtn)

    var body = document.createElement('div')
    body.style.cssText = 'width:100%;height:calc(100% - 44px);'
    panel.appendChild(body)

    var iframe = null
    var pageContext = null

    function extractPageContext() {
      var out = {}
      try {
        var codeEl = document.getElementById('copy-code-product')
        var codeText = codeEl ? String(codeEl.textContent || '').trim() : ''
        var skuMatch = codeText.match(/(?:m[aã]\s*sp|ma\s*sp|sku)\s*[:：]?\s*([A-Za-z0-9._-]{2,64})/i)
        if (skuMatch && skuMatch[1]) out.sku = skuMatch[1]
      } catch (_) {}

      try {
        var firstImg = document.querySelector('.image_list img[data-src], .image_list img[src]')
        if (firstImg) {
          var imgUrl = String(
            firstImg.getAttribute('data-src') || firstImg.getAttribute('src') || ''
          ).trim()
          if (/^https?:\/\//i.test(imgUrl)) out.imageUrl = imgUrl
        }
      } catch (_) {}

      try {
        var pageUrl = String(window.location.href || '').trim()
        if (/^https?:\/\//i.test(pageUrl)) out.productUrl = pageUrl
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

    function ensureIframe() {
      if (iframe) return
      if (!pageContext) pageContext = extractPageContext()
      iframe = document.createElement('iframe')
      iframe.src = buildChatUrlWithContext(chatUrl, pageContext)
      iframe.title = 'Chat NanoAI'
      iframe.loading = 'lazy'
      iframe.referrerPolicy = 'no-referrer-when-downgrade'
      iframe.style.cssText = 'width:100%;height:100%;border:0;'
      body.appendChild(iframe)
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
      ensureIframe()
      panel.style.display = 'block'
      bubble.style.display = 'none'
    }
    function closeChat() {
      panel.style.display = 'none'
      bubble.style.display = 'flex'
    }
    bubble.addEventListener('click', openChat)
    closeBtn.addEventListener('click', closeChat)

    function placeDesktop() {
      var safeBottom = clampBottomOffset(bubbleSize)
      var panelBottom = bubbleSize + 14
      // Reserve a small top margin so panel never gets pushed above viewport.
      var availableHeight = Math.max(220, viewportHeight() - safeBottom - panelBottom - 12)
      var finalHeight = Math.min(desktopHeight, availableHeight)

      root.style.top = ''
      root.style.left = ''
      root.style.right = ''
      root.style.bottom = safeBottom + 'px'
      if (side === 'left') {
        root.style.left = offsetX + 'px'
        root.style.right = 'auto'
        panel.style.position = 'absolute'
        panel.style.left = '0'
        panel.style.right = 'auto'
      } else {
        root.style.right = offsetX + 'px'
        root.style.left = 'auto'
        panel.style.position = 'absolute'
        panel.style.right = '0'
        panel.style.left = 'auto'
      }
      panel.style.top = ''
      panel.style.bottom = panelBottom + 'px'
      panel.style.width = 'min(40vw,' + desktopWidth + 'px)'
      panel.style.height = finalHeight + 'px'
      panel.style.borderRadius = radius + 'px'
      bubble.style.position = ''
      bubble.style.left = ''
      bubble.style.right = ''
      bubble.style.bottom = ''
      bubble.style.width = bubbleSize + 'px'
      bubble.style.height = bubbleSize + 'px'
      bubble.style.margin = '0'
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
    }

    var resizeTimer = null
    function applyLayout() {
      if (window.innerWidth <= mobileBreakpoint) placeMobile()
      else placeDesktop()
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

