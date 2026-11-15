/** Bản tạo khách vừa nhận trong response — URL file mới và id bản ghi. */

export type GuestCreationRefs = {
  threadId?: string
  projectId?: string
  cardId?: string
  historyId?: string
  curriculumId?: string
  jobId?: string
}

export type ExtractedGuestCreation = {
  resultUrls: string[]
  refs: GuestCreationRefs
}

const FRESH_MS = 30 * 60 * 1000
const MAX_URLS = 8
const OUTPUT_PATH = /\/(?:results|uploads|music-history|english-coach-history)\//
const URL_RE = /https?:\/\/[^\s"'<>\\]{12,1800}/g
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const REF_KEYS = ['threadId', 'projectId', 'cardId', 'weddingCardId', 'historyId', 'curriculumId', 'jobId'] as const

export function extractGuestCreation(
  text: string,
  opts?: { now?: number; route?: string }
): ExtractedGuestCreation {
  const now = opts?.now ?? Date.now()
  const route = opts?.route ?? ''
  const decoded = text.replace(/\\\//g, '/').replace(/\\u002f/gi, '/')
  const resultUrls = freshOutputUrls(decoded, now)
  const refs: GuestCreationRefs = {}
  for (const key of REF_KEYS) {
    if (key === 'jobId' && !/giao-trinh|worksheet/i.test(route)) continue
    const id = readRef(decoded, key === 'weddingCardId' ? 'weddingCardId' : key)
    if (!id) continue
    if (key === 'weddingCardId' || key === 'cardId') refs.cardId = refs.cardId || id
    else if (key === 'jobId') refs.jobId = id
    else if (key === 'threadId') refs.threadId = id
    else if (key === 'projectId') refs.projectId = id
    else if (key === 'historyId') refs.historyId = id
    else refs.curriculumId = id
  }
  return { resultUrls, refs }
}

export function guestCreationHasPayload(item: ExtractedGuestCreation): boolean {
  return item.resultUrls.length > 0 || Object.keys(item.refs).length > 0
}

export function isGuestCreationImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i.test(url)
}

export function isGuestCreationAudioUrl(url: string): boolean {
  return /\/music-history\/|\.(mp3|wav|ogg|m4a)(\?|#|$)/i.test(url)
}

function freshOutputUrls(text: string, now: number): string[] {
  const seen = new Set<string>()
  const found: { url: string; stamp: number }[] = []
  for (const match of text.matchAll(URL_RE)) {
    const url = trimUrl(match[0])
    if (!url || seen.has(url) || !OUTPUT_PATH.test(url)) continue
    const stamp = timestampInUrl(url)
    if (stamp == null || stamp < now - FRESH_MS || stamp > now + 60_000) continue
    seen.add(url)
    found.push({ url, stamp })
  }
  found.sort((a, b) => b.stamp - a.stamp)
  return found.slice(0, MAX_URLS).map((row) => row.url)
}

function timestampInUrl(url: string): number | null {
  const match = url.match(/(\d{13})/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

function trimUrl(raw: string): string {
  return raw.replace(/[),.;]+$/g, '')
}

function readRef(text: string, key: string): string | undefined {
  const re = new RegExp(`["']${key}["']\\s*[:,]\\s*["'](${UUID_RE.source})["']`, 'i')
  const match = text.match(re)
  return match?.[1]
}
