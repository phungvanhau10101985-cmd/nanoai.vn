/** Icon variants for the search cluster (camera + magnifier). Engine-wide — not per shop. */

export const SEARCH_CAMERA_GLYPHS = ['camera', 'camera-simple', 'camera-plus', 'photo', 'scan'] as const
export const SEARCH_LENS_GLYPHS = ['lens', 'lens-thin', 'lens-plus', 'lens-spark', 'lens-circle'] as const

export type SearchCameraGlyph = (typeof SEARCH_CAMERA_GLYPHS)[number]
export type SearchLensGlyph = (typeof SEARCH_LENS_GLYPHS)[number]
export type SearchGlyphId = SearchCameraGlyph | SearchLensGlyph

const PATHS: Record<SearchGlyphId, string> = {
  camera:
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'camera-simple':
    '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.2"/><path d="M8 7 9.4 4.8A1 1 0 0 1 10.25 4h3.5a1 1 0 0 1 .85.48L16 7"/>',
  'camera-plus':
    '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><path d="M12 10.5v5"/><path d="M9.5 13h5"/>',
  photo:
    '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m21 16-5.2-5.2a2 2 0 0 0-2.8 0L6 18"/>',
  scan: '<path d="M8 4H5a1 1 0 0 0-1 1v3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M16 20h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/>',
  lens: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  'lens-thin': '<circle cx="11" cy="11" r="6.2"/><path d="m19.5 19.5-3.2-3.2"/>',
  'lens-plus':
    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8.5v5"/><path d="M8.5 11h5"/>',
  'lens-spark':
    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M19 5.2 19.7 7l1.8.3-1.4 1.3.4 1.8L19 9.4l-1.5 1 .4-1.8L16.5 7.3 18.3 7z"/>',
  'lens-circle':
    '<circle cx="12" cy="12" r="9"/><circle cx="11" cy="11" r="4.2"/><path d="m17.2 17.2-2.1-2.1"/>',
}

export function isSearchCameraGlyph(value: unknown): value is SearchCameraGlyph {
  return typeof value === 'string' && (SEARCH_CAMERA_GLYPHS as readonly string[]).includes(value)
}

export function isSearchLensGlyph(value: unknown): value is SearchLensGlyph {
  return typeof value === 'string' && (SEARCH_LENS_GLYPHS as readonly string[]).includes(value)
}

export function normalizeSearchGlyph(kind: 'camera' | 'lens', raw: unknown): SearchGlyphId {
  if (kind === 'camera') return isSearchCameraGlyph(raw) ? raw : 'camera'
  return isSearchLensGlyph(raw) ? raw : 'lens'
}

export function searchGlyphPath(id: SearchGlyphId): string {
  return PATHS[id]
}

export function searchGlyphSvg(id: SearchGlyphId, className = 'pw-shop-nav-icon'): string {
  const extra = id === 'lens' || id.startsWith('lens') ? ' pw-shop-search-submit-icon' : ''
  const cls = `${className}${extra}`.trim()
  return `<svg class="${cls}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>`
}

/** JS object literal for the visual-editor iframe script. */
export function searchGlyphPathsJs(): string {
  return JSON.stringify(PATHS)
}
