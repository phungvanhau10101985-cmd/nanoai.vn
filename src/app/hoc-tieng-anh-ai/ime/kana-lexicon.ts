export type KanaWord = { surface: string; cost: number; alts: string[] }

export type KanaLexicon = Map<string, KanaWord>

let cache: KanaLexicon | null = null

export function parseKanaLexicon(pack: string): KanaLexicon {
  if (cache) return cache
  const map: KanaLexicon = new Map()
  for (const line of pack.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(' ')
    const reading = parts[0]
    const surface = parts[1]
    const cost = Number(parts[2])
    if (!reading || !surface || !Number.isFinite(cost)) continue
    map.set(reading, { surface, cost, alts: parts.slice(3).filter(Boolean) })
  }
  cache = map
  return map
}
