/** NanoAI chat widget (nhúng site shop). NAVIGATE_TOP + session iframe — cache-bust: .../nanoai-chat-widget.js?v= */
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
    var widgetScriptOrigin = ''
    try {
      var _scriptSrc = String(script.getAttribute('src') || '').trim()
      if (_scriptSrc) widgetScriptOrigin = new URL(_scriptSrc, window.location.href).origin
    } catch (_) {}

    /** `data-chat-url` chỉ có path → neo vào **host script NanoAI**, không neo vào host trang shop. */
    function absoluteChatUrl(raw) {
      var t = String(raw || '').trim()
      if (!t) return ''
      try {
        if (/^https?:\/\//i.test(t)) return new URL(t).href
        if (t.indexOf('//') === 0) return new URL(window.location.protocol + t).href
        if (widgetScriptOrigin) return new URL(t, widgetScriptOrigin + '/').href
        return new URL(t, window.location.href).href
      } catch (_) {
        return t
      }
    }

    var chatUrl = absoluteChatUrl(getAttr('data-chat-url', ''))
    if (!chatUrl) return

    /** Tên thương hiệu / shop hiển thị trên thanh widget (thay «NanoAI»). */
    var shopNameRaw = getAttr('data-shop-name', '')
    var shopName = String(shopNameRaw || '').trim()
    if (!shopName) shopName = 'Chat'

    var logoUrl = getAttr('data-logo-url', '')
    var side = getAttr('data-side', 'right') === 'left' ? 'left' : 'right'
    var bottom = num(getAttr('data-bottom', '24'), 24, 0, 800)
    var offsetX = num(getAttr('data-offset-x', '16'), 16, 0, 300)
    var desktopWidth = num(getAttr('data-width', '340'), 340, 280, 1200)
    var desktopHeight = num(getAttr('data-height', '560'), 560, 320, 1200)
    var radius = num(getAttr('data-radius', '12'), 12, 0, 60)
    var mobileBreakpoint = num(getAttr('data-mobile-breakpoint', '768'), 768, 320, 1600)
    var bubbleSize = num(getAttr('data-bubble-size', '56'), 56, 40, 100)
    var mobileBubbleSize = num(getAttr('data-mobile-bubble-size', '52'), 52, 40, 100)
    var panelBottom = num(getAttr('data-panel-bottom', '12'), 12, 0, 120)
    var widgetId = getAttr('data-widget-id', 'nanoai-chat-widget-v1')
    var mode = getAttr('data-mode', 'floating').trim().toLowerCase() === 'inline' ? 'inline' : 'floating'
    var mountSel = getAttr('data-mount-selector', '').trim().slice(0, 512)
    var mountTarget = null
    if (mountSel) {
      try {
        mountTarget = document.querySelector(mountSel)
      } catch (_) {
        mountTarget = null
      }
    }
    /** Góc màn hình — floating và không có data-mount-selector. */
    var useCornerBubble = mode === 'floating' && !mountSel
    var primaryRaw = getAttr('data-primary', 'chat').trim().toLowerCase().replace(/-/g, '_')
    var primaryTryOn = primaryRaw === 'try_on'
    var tryOnBubbleLabel = String(getAttr('data-try-on-label', '').trim() || '')
    var inlineHost = null

    var existingRoot = document.getElementById(widgetId)
    if (existingRoot) {
      var hasMountedUi =
        !!existingRoot.querySelector('[data-nanoai-chat-bubble="1"]') ||
        !!existingRoot.querySelector('iframe') ||
        !!existingRoot.querySelector('button[aria-label="Open NanoAI chat"]')
      if (hasMountedUi) return
      if (existingRoot.parentNode) existingRoot.parentNode.removeChild(existingRoot)
    }
    if (!document.body) return

    var root = document.createElement('div')
    root.id = widgetId
    root.setAttribute('data-nanoai-ready', '1')
    if (useCornerBubble) {
      root.style.cssText =
        'position:fixed;z-index:2147483000;font-family:Arial,sans-serif;pointer-events:none;'
      document.body.appendChild(root)
    } else {
      inlineHost = document.createElement('div')
      inlineHost.className = 'nanoai-chat-inline-host'
      inlineHost.style.cssText = 'display:inline-block;max-width:100%;vertical-align:middle;'
      if (mountTarget) {
        mountTarget.appendChild(inlineHost)
      } else {
        script.parentNode && script.parentNode.insertBefore(inlineHost, script.nextSibling)
      }
      root.style.cssText =
        'position:fixed;z-index:2147483000;font-family:Arial,sans-serif;pointer-events:none;left:0;top:0;right:0;bottom:0;'
      document.body.appendChild(root)
    }

    var bubble = document.createElement('button')
    bubble.type = 'button'
    bubble.setAttribute('data-nanoai-chat-bubble', '1')
    var bubbleAriaDefault = 'Open NanoAI chat'
    var bubbleAria = primaryTryOn && tryOnBubbleLabel ? tryOnBubbleLabel : bubbleAriaDefault
    bubble.setAttribute('aria-label', bubbleAria)
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
        bubble.textContent = primaryTryOn && tryOnBubbleLabel ? tryOnBubbleLabel.slice(0, 12) : 'AI'
        bubble.style.color = '#fff'
        bubble.style.fontWeight = '700'
        if (primaryTryOn && tryOnBubbleLabel) bubble.style.fontSize = '11px'
      }
      logoMask.appendChild(logo)
      bubble.appendChild(logoMask)
    } else {
      bubble.textContent = primaryTryOn && tryOnBubbleLabel ? tryOnBubbleLabel.slice(0, 12) : 'AI'
      bubble.style.color = '#fff'
      bubble.style.fontWeight = '700'
      if (primaryTryOn && tryOnBubbleLabel) bubble.style.fontSize = '11px'
    }
    if (useCornerBubble) {
      root.appendChild(bubble)
    } else if (inlineHost) {
      inlineHost.appendChild(bubble)
    }

    var panel = document.createElement('div')
    panel.className = 'nanoai-chat-panel'
    panel.style.cssText =
      'pointer-events:auto;display:none;flex-direction:column;position:absolute;background:#fff;overflow:hidden;' +
      'box-shadow:0 16px 40px rgba(0,0,0,.28);border:1px solid #e5e7eb;touch-action:auto;-webkit-tap-highlight-color:transparent;box-sizing:border-box;'
    root.appendChild(panel)

    /** CSS scoped — tránh CSS trang shop (flex-wrap, position…) làm nút giỏ/đóng nhảy khỏi header mobile. */
    var scopedStyle = document.createElement('style')
    scopedStyle.textContent =
      '#' +
      widgetId +
      ' .nanoai-chat-panel{box-sizing:border-box;flex-direction:column;}' +
      '#' +
      widgetId +
      ' .nanoai-chat-header{box-sizing:border-box;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;position:relative!important;}' +
      '#' +
      widgetId +
      ' .nanoai-chat-header-actions{box-sizing:border-box;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;flex-shrink:0!important;margin-left:auto!important;position:relative!important;}' +
      '#' +
      widgetId +
      ' .nanoai-chat-header button,' +
      '#' +
      widgetId +
      ' .nanoai-chat-header select{box-sizing:border-box;margin:0!important;position:relative!important;float:none!important;vertical-align:middle;}'
    root.appendChild(scopedStyle)

    var header = document.createElement('div')
    header.className = 'nanoai-chat-header'
    header.style.cssText =
      'flex-shrink:0;background:#fff;border-bottom:1px solid #eee;display:flex;flex-direction:row;flex-wrap:nowrap;align-items:center;gap:4px;padding:5px 8px;pointer-events:auto;min-width:0;overflow:hidden;box-sizing:border-box;position:relative;'

    var headerMeta = document.createElement('div')
    headerMeta.style.cssText =
      'display:flex;flex:1 1 0;min-width:0;align-items:center;gap:4px;overflow:hidden;flex-wrap:nowrap;'

    var brandEl = document.createElement('div')
    brandEl.style.cssText =
      'font-weight:700;font-size:13px;line-height:1.2;color:#111;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
    brandEl.textContent = shopName

    var headerActions = document.createElement('div')
    headerActions.className = 'nanoai-chat-header-actions'
    headerActions.style.cssText =
      'display:flex;flex-shrink:0;flex-wrap:nowrap;align-items:center;gap:4px;margin-left:auto;position:relative;'

    var widgetBtnReset =
      'box-sizing:border-box;margin:0;padding:0;font:inherit;line-height:1;appearance:none;-webkit-appearance:none;position:relative;float:none;vertical-align:middle;'

    var closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.setAttribute('aria-label', 'Close chat')
    var iconBtnBase =
      widgetBtnReset +
      'width:32px;height:32px;min-width:32px;border:none;border-radius:9999px;cursor:pointer;background:#f3f4f6;color:#111;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
    closeBtn.style.cssText = iconBtnBase + 'font-size:17px;'
    closeBtn.textContent = '×'
    var expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.setAttribute('aria-label', 'Expand chat')
    expandBtn.style.cssText = iconBtnBase + 'padding:0;'
    function setExpandButtonIcon(expanded) {
      // Lucide maximize-2 / minimize-2 (góc chéo) — tránh icon «ô vuông» chỉ có rect.
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
    setExpandButtonIcon(false)

    var localeSelect = document.createElement('select')
    localeSelect.setAttribute('aria-label', 'Language')
    localeSelect.style.cssText =
      widgetBtnReset +
      'max-width:72px;width:auto;height:32px;flex-shrink:0;font-size:11px;padding:2px 6px;border-radius:6px;border:1px solid #e5e7eb;background:#fff;color:#111;cursor:pointer;touch-action:manipulation;'
    var LOCALE_CHOICES = [
      ['vi', 'VI'],
      ['en', 'EN'],
      ['zh', 'ZH'],
      ['ja', 'JA'],
      ['ko', 'KO'],
    ]
    var ordersLabelRaw = getAttr('data-orders-label', '')
    var ordersLabel = String(ordersLabelRaw || '').trim() || 'Đơn hàng'
    var cartLabelRaw = getAttr('data-cart-label', '')
    var cartLabel = String(cartLabelRaw || '').trim() || 'Giỏ hàng'
    var cartCount = 0
    var loyaltyBadge = document.createElement('span')
    loyaltyBadge.style.cssText =
      'display:none;flex-shrink:0;border:1px solid #fcd34d;background:#fffbeb;color:#78350f;border-radius:9999px;padding:3px 8px;font-size:10px;font-weight:700;line-height:1;box-shadow:0 1px 2px rgba(0,0,0,.08);white-space:nowrap;'

    function setLoyaltyStatus(status) {
      try {
        if (!status || status.enabled === false) {
          loyaltyBadge.style.display = 'none'
          loyaltyBadge.textContent = ''
          return
        }
        var label = String(status.tierName || status.tierCode || 'L1').trim() || 'L1'
        loyaltyBadge.textContent = label
        loyaltyBadge.style.display = 'inline-flex'
      } catch (_) {}
    }

    for (var li = 0; li < LOCALE_CHOICES.length; li += 1) {
      var opt = document.createElement('option')
      opt.value = LOCALE_CHOICES[li][0]
      opt.textContent = LOCALE_CHOICES[li][1]
      localeSelect.appendChild(opt)
    }

    var ordersBtn = document.createElement('button')
    ordersBtn.type = 'button'
    ordersBtn.setAttribute('aria-label', ordersLabel)
    ordersBtn.setAttribute('title', ordersLabel)
    ordersBtn.style.cssText =
      widgetBtnReset +
      'width:36px;height:36px;min-width:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid #c4b5fd;background:#f5f3ff;color:#1e1b4b;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex-shrink:0;'
    ordersBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>'

    var cartBtn = document.createElement('button')
    cartBtn.type = 'button'
    cartBtn.setAttribute('aria-label', cartLabel)
    cartBtn.setAttribute('title', cartLabel)
    cartBtn.style.cssText =
      widgetBtnReset +
      'width:36px;height:36px;min-width:36px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid #e5e7eb;background:#f9fafb;color:#111;cursor:pointer;flex-shrink:0;touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
    cartBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h8.96a2 2 0 0 0 1.95-1.57L21 8H5.12"/></svg><span class="nanoai-cart-count" style="display:none;position:absolute;right:-2px;top:-2px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#059669;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;"></span>'
    var cartBadge = cartBtn.querySelector('.nanoai-cart-count')
    function setCartCount(n) {
      cartCount = Math.max(0, parseInt(n, 10) || 0)
      if (!cartBadge) return
      if (cartCount > 0) {
        cartBadge.style.display = 'inline-block'
        cartBadge.textContent = cartCount > 99 ? '99+' : String(cartCount)
      } else {
        cartBadge.style.display = 'none'
        cartBadge.textContent = ''
      }
      cartBtn.setAttribute('aria-label', cartLabel + ' (' + cartCount + ')')
    }

    /** Đơn hàng + giỏ — luôn trên header widget (mobile & desktop). */
    function syncCommerceHeaderButtons() {
      ordersBtn.style.display = 'inline-flex'
      cartBtn.style.display = 'inline-flex'
    }

    headerMeta.appendChild(brandEl)
    headerMeta.appendChild(loyaltyBadge)
    headerActions.appendChild(localeSelect)
    headerActions.appendChild(ordersBtn)
    headerActions.appendChild(cartBtn)
    headerActions.appendChild(expandBtn)
    headerActions.appendChild(closeBtn)
    header.appendChild(headerMeta)
    header.appendChild(headerActions)

    panel.appendChild(header)

    var body = document.createElement('div')
    body.style.cssText =
      'flex:1;min-height:0;width:100%;pointer-events:auto;touch-action:auto;-webkit-overflow-scrolling:touch;'
    panel.appendChild(body)

    var iframe = null
    var pageContext = null
    var isExpanded = false

    /** Đồng bộ với `widget-embed-session.ts` / FloatingChatWidget — lưu URL iframe chat trên domain shop. */
    var RETURN_CHAT_SESSION_KEY = 'nanoai_return_chat_iframe_href_v1'
    var PERSIST_CHAT_SESSION_KEY = 'nanoai_persist_chat_iframe_href_v1'
    var GUEST_SESSION_KEY = 'nanoai_guest_session_id_v1'
    var GUEST_ACCOUNT_KEY = 'nanoai_guest_account_id_v1'
    var MSG_SOURCE = 'nanoai-widget'
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    function isAllowedHttpUrl(u) {
      try {
        var x = new URL(String(u || '').trim())
        return x.protocol === 'http:' || x.protocol === 'https:'
      } catch (_) {
        return false
      }
    }

    function readReturnChatHref() {
      try {
        var s = localStorage.getItem(PERSIST_CHAT_SESSION_KEY) || sessionStorage.getItem(RETURN_CHAT_SESSION_KEY)
        s = s ? String(s).trim() : ''
        return s && isAllowedHttpUrl(s) ? s : ''
      } catch (_) {
        return ''
      }
    }

    function writeReturnChatHref(href) {
      try {
        if (href && isAllowedHttpUrl(href)) {
          var next = String(href).trim()
          sessionStorage.setItem(RETURN_CHAT_SESSION_KEY, next)
          localStorage.setItem(PERSIST_CHAT_SESSION_KEY, next)
        }
      } catch (_) {}
    }

    function readStoredGuestIdentity() {
      try {
        var sid = String(localStorage.getItem(GUEST_SESSION_KEY) || '').trim()
        var aid = String(localStorage.getItem(GUEST_ACCOUNT_KEY) || '').trim()
        return {
          guestSessionId: UUID_RE.test(sid) ? sid : '',
          guestAccountId: UUID_RE.test(aid) ? aid : '',
        }
      } catch (_) {
        return { guestSessionId: '', guestAccountId: '' }
      }
    }

    function writeStoredGuestIdentity(payload) {
      try {
        if (payload && UUID_RE.test(String(payload.guestSessionId || '').trim())) {
          localStorage.setItem(GUEST_SESSION_KEY, String(payload.guestSessionId).trim())
        }
        if (payload && UUID_RE.test(String(payload.guestAccountId || '').trim())) {
          localStorage.setItem(GUEST_ACCOUNT_KEY, String(payload.guestAccountId).trim())
        }
      } catch (_) {}
    }

    /** iframe → cả tab shop: mở SP thay trang host (trước đây không có listener → chỉ iframe tự assign → lồng UI). */
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
          if (ret && isAllowedHttpUrl(ret)) writeReturnChatHref(ret)
          window.location.assign(nextUrl)
        } catch (_) {}
      },
      false
    )

    window.addEventListener(
      'message',
      function (e) {
        try {
          var d = e.data
          if (!d || d.source !== MSG_SOURCE) return
          if (!iframe || !iframe.contentWindow || e.source !== iframe.contentWindow) return
          if (d.type === 'GUEST_IDENTITY') {
            writeStoredGuestIdentity(d)
            if (iframe && iframe.src) writeReturnChatHref(iframe.src)
          }
          if (d.type === 'LOYALTY_STATUS') setLoyaltyStatus(d.status)
          if (d.type === 'CART_COUNT') setCartCount(d.count)
        } catch (_) {}
      },
      false
    )

    var pendingUiLocale = 'vi'
    try {
      var _u0 = new URL(chatUrl, window.location.href)
      var _pl = (_u0.searchParams.get('ui_locale') || 'vi').trim().toLowerCase()
      if (['vi', 'en', 'zh', 'ja', 'ko'].indexOf(_pl) >= 0) pendingUiLocale = _pl
    } catch (_) {}
    try {
      localeSelect.value = pendingUiLocale
    } catch (_) {}

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

    /** `data-src` ô video thường là .mp4; `src` mới là poster JPG — không dùng URL video làm ctx_image. */
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

    /**
     * Tuỳ chỉnh từ trang shop — gắn lên thẻ script đang chạy NanoAI (ưu tiên cao hơn quét DOM):
     * data-ctx-sku, data-ctx-image, data-ctx-image-2, data-ctx-product-url, data-ctx-inventory (UUID kho NanoAI)
     * Ví dụ Next.js: đặt các data-* = {product.sku} khi render layout sản phẩm.
     */
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

    function buildChatUrlWithContext(baseUrl, ctx, addOpenTryOn) {
      try {
        var u = new URL(baseUrl, window.location.href)
        var identity = readStoredGuestIdentity()
        if (identity.guestSessionId) u.searchParams.set('guest_session_id', identity.guestSessionId)
        if (identity.guestAccountId) u.searchParams.set('guest_account_id', identity.guestAccountId)
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
        if (addOpenTryOn) u.searchParams.set('open_try_on', '1')
        return u.toString()
      } catch (_) {
        return baseUrl
      }
    }

    function ensureIframe(ctx, opts) {
      opts = opts || {}
      var nextCtx = ctx || extractPageContext()
      pageContext = nextCtx
      // Giữ `ui_locale` (và query khác) sau khi khách đổi ngôn ngữ trong iframe — không ghi đè bằng data-chat-url gốc.
      var baseForBuild = iframe && iframe.src ? iframe.src : chatUrl
      if (!iframe) {
        var resumeForOpen = readReturnChatHref()
        if (resumeForOpen) baseForBuild = resumeForOpen
      }
      var injectTryOn = !iframe && Boolean(opts.openTryOn)
      try {
        var uLoc = new URL(baseForBuild, window.location.href)
        if (iframe) uLoc.searchParams.delete('open_try_on')
        uLoc.searchParams.set('ui_locale', pendingUiLocale)
        baseForBuild = uLoc.toString()
      } catch (_) {}
      var nextSrc = buildChatUrlWithContext(baseForBuild, nextCtx, injectTryOn)
      if (!iframe) {
        iframe = document.createElement('iframe')
        iframe.src = nextSrc
        iframe.loading = 'eager'
        iframe.referrerPolicy = 'no-referrer-when-downgrade'
        iframe.style.cssText =
          'width:100%;height:100%;border:0;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent;'
        iframe.title = shopName + ' — Chat'
        body.appendChild(iframe)
        return
      }
      if (iframe.src !== nextSrc) iframe.src = nextSrc
    }

    localeSelect.addEventListener('change', function () {
      pendingUiLocale = localeSelect.value
      if (iframe) ensureIframe(pageContext, {})
    })
    ordersBtn.addEventListener('click', function () {
      try {
        if (!iframe || !iframe.contentWindow) return
        var targetOrigin = new URL(iframe.src || chatUrl, window.location.href).origin
        iframe.contentWindow.postMessage({ source: 'nanoai-widget', type: 'OPEN_MY_ORDERS' }, targetOrigin)
      } catch (_) {}
    })
    cartBtn.addEventListener('click', function () {
      try {
        if (!iframe) ensureIframe(pageContext, {})
        if (!iframe || !iframe.contentWindow) return
        var targetOrigin = new URL(iframe.src || chatUrl, window.location.href).origin
        iframe.contentWindow.postMessage({ source: 'nanoai-widget', type: 'OPEN_CART' }, targetOrigin)
      } catch (_) {}
    })
    function extractGuestSlugFromChatUrl(urlStr) {
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
      if (iframe) iframe.title = dn + ' — Chat'
    }

    if (!String(shopNameRaw || '').trim()) {
      var slugBrand = extractGuestSlugFromChatUrl(chatUrl)
      if (slugBrand) {
        try {
          var bu = new URL(chatUrl, window.location.href)
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
      // Keep bubble visible even if integrator sets a very large bottom offset.
      var maxBottom = Math.max(8, viewportHeight() - sizePx - 8)
      return Math.min(bottom, maxBottom)
    }

    function postScrollChatBottom(delayMs) {
      try {
        if (!iframe || !iframe.contentWindow) return
        var targetOrigin = new URL(iframe.src || chatUrl, window.location.href).origin
        setTimeout(function () {
          try {
            iframe.contentWindow.postMessage({ source: 'nanoai-widget', type: 'SCROLL_CHAT_BOTTOM' }, targetOrigin)
          } catch (_) {}
        }, Math.max(0, parseInt(delayMs, 10) || 0))
      } catch (_) {}
    }

    /** `openTryOn`: chỉ bật panel thử đồ lần đầu tạo iframe — bubble try_on hoặc `data-nanoai-try-on`. Tư vấn nhắn tin không bật. */
    function openChat(opts) {
      opts = opts || {}
      var firstOpen = !iframe
      var wantTryOn = opts.openTryOn === true && firstOpen
      ensureIframe(extractPageContext(), { openTryOn: wantTryOn })
      panel.style.display = 'flex'
      bubble.style.display = 'none'
      applyLayout()
      postScrollChatBottom(0)
      postScrollChatBottom(firstOpen ? 700 : 120)
      postScrollChatBottom(firstOpen ? 1400 : 360)
    }
    function closeChat() {
      panel.style.display = 'none'
      bubble.style.display = 'flex'
    }
    bubble.addEventListener('click', function () {
      openChat({ openTryOn: primaryTryOn })
    })
    document.addEventListener(
      'click',
      function (ev) {
        try {
          var target = ev.target
          if (!target || !target.closest) return
          var trigger = target.closest(
            '[data-nanoai-open-chat],[data-nanoai-consult],[data-nanoai-chat-consult],[data-nanoai-try-on],a[href*="/messaging/p/"]'
          )
          if (!trigger) return
          var href = trigger.getAttribute && String(trigger.getAttribute('href') || '').trim()
          var isMessagingLink = href && href.indexOf('/messaging/p/') >= 0
          var isTryOnTrigger = trigger.hasAttribute('data-nanoai-try-on')
          var isExplicitTrigger =
            trigger.hasAttribute('data-nanoai-open-chat') ||
            trigger.hasAttribute('data-nanoai-consult') ||
            trigger.hasAttribute('data-nanoai-chat-consult') ||
            isTryOnTrigger
          if (!isMessagingLink && !isExplicitTrigger) return
          if (isMessagingLink || isExplicitTrigger) {
            ev.preventDefault()
            ev.stopPropagation()
            openChat({ openTryOn: isTryOnTrigger })
            postScrollChatBottom(0)
            postScrollChatBottom(700)
            postScrollChatBottom(1400)
          }
        } catch (_) {}
      },
      true
    )
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
      if (useCornerBubble) {
        bubble.style.position = 'absolute'
        bubble.style.bottom = safeBottom + 'px'
        if (side === 'left') {
          bubble.style.left = offsetX + 'px'
          bubble.style.right = 'auto'
        } else {
          bubble.style.right = offsetX + 'px'
          bubble.style.left = 'auto'
        }
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
      if (useCornerBubble) {
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
    function applyHeaderDensity() {
      var isMobile = window.innerWidth <= mobileBreakpoint
      var compact = isMobile ? '30px' : '36px'
      var iconCompact = isMobile ? '30px' : '32px'
      ordersBtn.style.width = compact
      ordersBtn.style.height = compact
      ordersBtn.style.minWidth = compact
      cartBtn.style.width = compact
      cartBtn.style.height = compact
      cartBtn.style.minWidth = compact
      closeBtn.style.width = iconCompact
      closeBtn.style.height = iconCompact
      closeBtn.style.minWidth = iconCompact
      expandBtn.style.width = iconCompact
      expandBtn.style.height = iconCompact
      expandBtn.style.minWidth = iconCompact
      localeSelect.style.maxWidth = isMobile ? '58px' : '72px'
      localeSelect.style.height = iconCompact
      header.style.gap = isMobile ? '3px' : '4px'
      headerActions.style.gap = isMobile ? '3px' : '4px'
    }

    function applyLayout() {
      if (window.innerWidth <= mobileBreakpoint) placeMobile()
      else placeDesktop()
      applyHeaderDensity()
      // Host root uses pointer-events:none so clicks pass through empty areas; panel/iframe must stay clickable (some browsers need this reinforced after layout).
      panel.style.pointerEvents = 'auto'
      body.style.pointerEvents = 'auto'
      if (iframe) iframe.style.pointerEvents = 'auto'
      syncCommerceHeaderButtons()
    }
    function onResize() {
      if (resizeTimer) window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(applyLayout, 100)
    }
    applyLayout()
    window.addEventListener('resize', onResize, { passive: true })

    if (mountSel && !mountTarget && inlineHost) {
      var relocateAttempts = 0
      function tryRelocateChatMount() {
        relocateAttempts += 1
        var el = null
        try {
          el = document.querySelector(mountSel)
        } catch (_) {
          el = null
        }
        if (el && inlineHost.parentNode !== el) {
          el.appendChild(inlineHost)
          applyLayout()
          return
        }
        if (relocateAttempts < 25) {
          window.setTimeout(tryRelocateChatMount, 200)
        }
      }
      window.setTimeout(tryRelocateChatMount, 0)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }
})()

