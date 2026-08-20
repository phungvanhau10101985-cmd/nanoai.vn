const EMPTY_GIF = /^data:image\/gif/i

function isLogoImgTag(tag: string): boolean {
  return /(?:\bclass=["'][^"']*\b(?:pw-logo|pw-shop-logo|pw-shop-footer-logo|site-logo)\b|\bdata-pw-logo-added=)/i.test(
    tag
  )
}

function readSrc(tag: string): string {
  return tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || ''
}

function isFilledLogoSrc(src: string): boolean {
  const s = String(src || '').trim()
  return /^https?:\/\//i.test(s) || /^data:image\/(?:png|jpe?g|webp)/i.test(s)
}

function isEmptyLogoTag(tag: string): boolean {
  const src = readSrc(tag)
  if (isFilledLogoSrc(src)) return false
  if (/\bdata-pw-logo-empty=/.test(tag)) return true
  return !src.trim() || EMPTY_GIF.test(src)
}

function readStylePx(markup: string, prop: string): number {
  const style = markup.match(/\bstyle=["']([^"']*)["']/i)?.[1] || ''
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([0-9.]+)px`, 'i').exec(style)
  return m ? Number(m[1]) : 0
}

/** Prefer the sized/floated editor logo over a leftover tiny copy. */
function logoKeepScore(markup: string): number {
  const area = readStylePx(markup, 'width') * readStylePx(markup, 'height')
  const isFrame = /pw-logo-frame|data-pw-logo-frame/.test(markup)
  const isFloat = /data-pw-logo-float/.test(markup)
  if (area > 0) return area + (isFloat ? 1 : 0)
  if (isFrame) return 8000 + (isFloat ? 1 : 0)
  return 1
}

function hideWordmarksInInner(inner: string): string {
  return inner.replace(/<span\b([^>]*\bpw-wordmark\b[^>]*)>/gi, (tag) =>
    /\bdata-pw-logo-wordmark-hidden=/.test(tag)
      ? tag
      : tag.replace(/>$/, ' data-pw-logo-wordmark-hidden="1" style="display:none">')
  )
}

function stripLogoNodesFromInner(inner: string): string {
  return inner
    .replace(/<span\b[^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => (isLogoImgTag(tag) ? '' : tag))
}

function pickFilledLogo(html: string): { full: string; seated: string } | null {
  const candidates: Array<{ full: string; seated: string; score: number }> = []
  const frameRe = /<span\b([^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*)>([\s\S]*?)<\/span>/gi
  let m: RegExpExecArray | null
  while ((m = frameRe.exec(html))) {
    const img = m[2].match(/<img\b[^>]*>/i)?.[0] || ''
    if (!isLogoImgTag(img) || !isFilledLogoSrc(readSrc(img))) continue
    candidates.push({ full: m[0], seated: unfloatLogoMarkup(m[0]), score: logoKeepScore(m[0]) })
  }
  if (!candidates.length) {
    const imgRe = /<img\b[^>]*>/gi
    while ((m = imgRe.exec(html))) {
      const tag = m[0]
      if (!isLogoImgTag(tag) || !isFilledLogoSrc(readSrc(tag))) continue
      candidates.push({ full: tag, seated: unfloatLogoMarkup(tag), score: logoKeepScore(tag) })
    }
  }
  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}

function unfloatLogoMarkup(html: string): string {
  return html
    .replace(/\s*data-pw-logo-float=["'][^"']*["']/gi, '')
    .replace(/\s*data-pw-logo-floated=["'][^"']*["']/gi, '')
    .replace(/\s*style=["']([^"']*)["']/i, (_all, style: string) => {
      const next = String(style)
        .replace(/(?:^|;)\s*position\s*:\s*[^;]+/gi, '')
        .replace(/(?:^|;)\s*left\s*:\s*[^;]+/gi, '')
        .replace(/(?:^|;)\s*top\s*:\s*[^;]+/gi, '')
        .replace(/(?:^|;)\s*transform\s*:\s*[^;]+/gi, '')
        .replace(/;{2,}/g, ';')
        .replace(/^;|;$/g, '')
        .trim()
      return next ? ` style="${next}"` : ''
    })
}

function isPositionedLogoMarkup(html: string): boolean {
  return (
    /\bdata-pw-logo-float=["']1["']/.test(html) &&
    /(?:^|[;"']\s*)(?:left|top)\s*:\s*-?[\d.]+px/i.test(html)
  )
}

function keepLogoMarkup(html: string): string {
  return isPositionedLogoMarkup(html) ? html : unfloatLogoMarkup(html)
}

/** Logo đã ghim left/top thì giữ nguyên. Logo mồ côi (không float) mới nhét lại brand. */
export function seatFilledLogoInBrandHtml(html: string): string {
  if (!html.trim()) return html
  const filled = pickFilledLogo(html)
  if (!filled) return html
  if (isPositionedLogoMarkup(filled.full)) return html

  if (
    isInsideBrandAnchor(html, filled.full) ||
    /<a\b[^>]*(?:pw-brand|pw-shop-brand|data-pw-logo-home)/i.test(filled.full)
  ) {
    return html.replace(filled.full, filled.seated)
  }

  const marker = '<!--pw-logo-seat-->'
  let next = html.replace(filled.full, marker)
  const brandRe = /<a\b([^>]*(?:pw-brand|pw-shop-brand|data-pw-logo-home)[^>]*)>([\s\S]*?)<\/a>/i
  const brand = next.match(brandRe)
  if (!brand) return html.replace(filled.full, filled.seated)
  if (brand[0].includes(marker)) {
    return next.replace(marker, filled.seated)
  }
  const inner = stripLogoNodesFromInner(brand[2].replace(marker, ''))
  next = next.replace(brand[0], `<a${brand[1]}>${filled.seated}${hideWordmarksInInner(inner)}</a>`)
  return next.replace(marker, '')
}

function isInsideBrandAnchor(html: string, snippet: string): boolean {
  const idx = html.indexOf(snippet)
  if (idx < 0) return false
  const before = html.slice(0, idx)
  const lastOpen = before.toLowerCase().lastIndexOf('<a')
  if (lastOpen < 0) return false
  const gt = html.indexOf('>', lastOpen)
  if (gt < 0 || gt > idx) return false
  const openTag = html.slice(lastOpen, gt + 1)
  if (!/\b(?:pw-brand|pw-shop-brand|data-pw-logo-home)\b/.test(openTag)) return false
  return !/<\/a>/i.test(html.slice(gt + 1, idx))
}

function stripOrphanHeaderLogoImgs(inner: string): string {
  const frameRe = /<span\b[^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*>[\s\S]*?<\/span>/gi
  const out: string[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = frameRe.exec(inner))) {
    out.push(inner.slice(last, m.index).replace(/<img\b[^>]*>/gi, (tag) => (isLogoImgTag(tag) ? '' : tag)))
    out.push(m[0])
    last = m.index + m[0].length
  }
  out.push(inner.slice(last).replace(/<img\b[^>]*>/gi, (tag) => (isLogoImgTag(tag) ? '' : tag)))
  return out.join('')
}

function collapseHeaderLogoInner(inner: string): string {
  const frameRe = /<span\b[^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*>[\s\S]*?<\/span>/gi
  const frames = inner.match(frameRe) || []
  const keepFrame = frames
    .filter((frame) => {
      const img = frame.match(/<img\b[^>]*>/i)?.[0] || ''
      return isLogoImgTag(img) && isFilledLogoSrc(readSrc(img))
    })
    .sort((a, b) => logoKeepScore(b) - logoKeepScore(a))[0]
  if (keepFrame) {
    let seen = false
    const next = inner.replace(frameRe, (frame) => {
      if (frame === keepFrame && !seen) {
        seen = true
        return keepLogoMarkup(frame)
      }
      return ''
    })
    return stripOrphanHeaderLogoImgs(next)
  }
  let keptImg = false
  return inner.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isLogoImgTag(tag)) return tag
    if (!isFilledLogoSrc(readSrc(tag))) return ''
    if (keptImg) return ''
    keptImg = true
    return keepLogoMarkup(tag)
  })
}

/** Một header chỉ giữ một logo ảnh — bỏ bản trùng chồng bên trái. */
export function dedupeHeaderLogosFromHtml(html: string): string {
  if (!html.trim()) return html
  let next = html.replace(/<header\b([^>]*)>([\s\S]*?)<\/header>/gi, (_full, attrs: string, inner: string) => {
    return `<header${attrs}>${collapseHeaderLogoInner(inner)}</header>`
  })
  next = next.replace(
    /<(div)([^>]*\b(?:pw-header|pw-shop-header)\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag: string, attrs: string, inner: string) => {
      if (/<header\b/i.test(full)) return full
      return `<${tag}${attrs}>${collapseHeaderLogoInner(inner)}</${tag}>`
    }
  )
  return next
}

function restoreWordmarksInBrandAnchors(html: string): string {
  if (pickFilledLogo(html)) {
    return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
      if (!/\b(?:pw-brand|pw-shop-brand|data-pw-logo-home)\b/.test(attrs)) return full
      return `<a${attrs}>${hideWordmarksInInner(inner)}</a>`
    })
  }
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs: string, inner: string) => {
    if (!/\b(?:pw-brand|pw-shop-brand|data-pw-logo-home)\b/.test(attrs)) return full
    if (/<img\b/i.test(inner)) return full
    const restored = inner
      .replace(/\s*data-pw-logo-wordmark-hidden=["'][^"']*["']/gi, '')
      .replace(/\s*style=["']display:\s*none;?["']/gi, '')
    return `<a${attrs}>${restored}</a>`
  })
}

/** Keep the first header logo frame in a brand cluster; drop the rest. */
export function dedupeHeaderLogoFramesFromHtml(html: string): string {
  if (!html.trim()) return html
  return html.replace(
    /<(div)([^>]*\b(?:pw-brand-cluster|pw-shop-brand-cluster)\b[^>]*)>([\s\S]*?)<\/\1>/gi,
    (_full, tag: string, attrs: string, inner: string) => {
      let kept = false
      const nextInner = inner.replace(
        /<span\b[^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*>[\s\S]*?<\/span>/gi,
        (frame) => {
          if (!/<img\b/i.test(frame)) return ''
          if (kept) return ''
          kept = true
          return frame
        }
      )
      return `<${tag}${attrs}>${nextInner}</${tag}>`
    }
  )
}

/** Remove drawn-but-empty logo slots so live/demo does not show leftover frames. */
export function stripEmptyLogoPlaceholdersFromHtml(html: string): string {
  if (!html.trim()) return html
  let next = seatFilledLogoInBrandHtml(html)
  next = next.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!isLogoImgTag(tag)) return tag
    if (isEmptyLogoTag(tag)) return ''
    return tag
      .replace(/\s*data-pw-logo-empty=["'][^"']*["']/gi, '')
      // Float belongs on frame/home-link — never on <img> (live wrap blew layout to 100%).
      .replace(/\s*data-pw-logo-float=["'][^"']*["']/gi, '')
      .replace(/\s*data-pw-logo-floated=["'][^"']*["']/gi, '')
  })
  next = next.replace(
    /<(span|div)\b[^>]*(?:pw-logo-frame|data-pw-logo-frame)[^>]*>\s*<\/\1>/gi,
    ''
  )
  // Drop empty floated home shells (no <img>) left after bad wraps.
  next = next.replace(
    /<a\b([^>]*(?:data-pw-logo-float|data-pw-logo-home)[^>]*)>([\s\S]*?)<\/a>/gi,
    (full, attrs: string, inner: string) => {
      if (/<img\b/i.test(inner)) return full
      if (!/\bdata-pw-logo-float=["']1["']/i.test(attrs)) return full
      return ''
    }
  )
  next = restoreWordmarksInBrandAnchors(next)
  next = dedupeHeaderLogoFramesFromHtml(next)
  return dedupeHeaderLogosFromHtml(next)
}
