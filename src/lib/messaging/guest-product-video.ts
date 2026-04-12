/** Phát video sản phẩm trên chat khách (YouTube hoặc URL trực tiếp .mp4 / tương tự). */

const HTTPS_RE = /^https?:\/\//i

export function youtubeVideoIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim())
    const h = u.hostname.replace(/^www\./, '')
    if (h === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id && /^[\w-]{6,}$/.test(id) ? id : null
    }
    if (
      h === 'youtube.com' ||
      h === 'm.youtube.com' ||
      h === 'music.youtube.com' ||
      h === 'www.youtube-nocookie.com' ||
      h === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{6,}$/.test(v)) return v
      const embed = u.pathname.match(/\/embed\/([\w-]{6,})/)
      if (embed?.[1]) return embed[1]
      const shorts = u.pathname.match(/\/shorts\/([\w-]{6,})/)
      if (shorts?.[1]) return shorts[1]
    }
  } catch {
    return null
  }
  return null
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoIdFromUrl(url)
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null
}

/** URL iframe embed (autoplay khi mở dialog). */
export function youtubeEmbedUrlFromWatchUrl(url: string): string | null {
  const id = youtubeVideoIdFromUrl(url)
  return id
    ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`
    : null
}

export function isLikelyDirectVideoFileUrl(url: string): boolean {
  return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url.trim())
}

export type GuestProductVideoPlayback =
  | { kind: 'youtube'; embedUrl: string }
  | { kind: 'video'; src: string }

export function resolveGuestProductVideoPlayback(rawUrl: string): GuestProductVideoPlayback | null {
  const url = rawUrl.trim()
  if (!url || !HTTPS_RE.test(url)) return null
  const embed = youtubeEmbedUrlFromWatchUrl(url)
  if (embed) return { kind: 'youtube', embedUrl: embed }
  if (isLikelyDirectVideoFileUrl(url)) return { kind: 'video', src: url }
  return null
}
