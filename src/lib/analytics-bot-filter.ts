'use client'

const BOT_UA_RE =
  /bot|crawler|spider|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|slackbot|whatsapp|telegrambot|twitterbot|linkedinbot|bingbot|googlebot|yandex|duckduckbot|embedly|quora link preview|pinterest|discordbot|applebot/i

/** Basic client-side bot/prefetch heuristic for GA suppression. */
export function isLikelyBotTraffic(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = (navigator.userAgent || '').trim()
  if (!ua) return false
  return BOT_UA_RE.test(ua)
}
