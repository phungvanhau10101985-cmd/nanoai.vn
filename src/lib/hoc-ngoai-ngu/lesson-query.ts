import { LANGUAGE_PAIR_CODES, type LanguagePairCode } from '@/lib/hoc-ngoai-ngu/samples'

function asCode(value: string): LanguagePairCode | null {
  return (LANGUAGE_PAIR_CODES as readonly string[]).includes(value) ? (value as LanguagePairCode) : null
}

/** `?hoc=vi&me=en` trên phòng luyện. `hoc` là tiếng đang học, `me` là tiếng mẹ đẻ. */
export function readLessonLanguageQuery(params: { get(name: string): string | null }): {
  target: LanguagePairCode | null
  native: LanguagePairCode | null
} {
  const target = asCode(params.get('hoc') || '')
  const native = asCode(params.get('me') || '')
  if (target && native && target === native) return { target, native: null }
  return { target, native }
}
