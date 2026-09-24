function svg(paths: string): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
}

/** Icon điểm nổi bật — vòng theo thứ tự thẻ. */
export const PDP_LP_HIGHLIGHT_ICONS = [
  svg('<path d="M12 3.2l1.15 3.45L16.7 8l-3.55 1.35L12 12.8l-1.15-3.45L7.3 8l3.55-1.35L12 3.2z"/><path d="M18.2 13.6l.55 1.65 1.7.55-1.7.6-.55 1.7-.55-1.7-1.7-.6 1.7-.55.55-1.65z"/>'),
  svg('<circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="2.4"/><path d="M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1"/>'),
  svg('<path d="M12 3.2l7 2.8v5.6c0 4.2-2.9 7.1-7 8.6-4.1-1.5-7-4.4-7-8.6V6l7-2.8z"/><path d="M9 12.1l2.1 2.1 4-4.2"/>'),
  svg('<path d="M12 3.4l2.15 4.45 4.9.7-3.55 3.4.85 4.9L12 14.6 7.65 16.85l.85-4.9L4.95 8.55l4.9-.7L12 3.4z"/>'),
  svg('<path d="M13 2.4L4.2 13.2h6.2L9.2 21.6 19.8 10.2h-6.2L13 2.4z"/>'),
  svg('<circle cx="12" cy="8.2" r="3.4"/><path d="M7.6 14.2L6 20.4l6-2.6 6 2.6-1.6-6.2"/>'),
]

/** Icon dải tin cậy: chọn kỹ, đặt nhanh, hỗ trợ. */
export const PDP_LP_TRUST_ICONS = [
  svg('<circle cx="12" cy="12" r="8"/><path d="M8.4 12.2l2.3 2.3 4.8-5"/>'),
  svg('<path d="M4.5 12h12.2"/><path d="M12.8 7.2L18 12.2l-5.2 5"/>'),
  svg('<path d="M12 19.6s-6.4-3.8-6.4-8.2a3.7 3.7 0 016.4-2.4 3.7 3.7 0 016.4 2.4c0 4.4-6.4 8.2-6.4 8.2z"/>'),
]
