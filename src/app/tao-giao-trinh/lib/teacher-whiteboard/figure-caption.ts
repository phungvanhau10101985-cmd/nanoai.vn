export type FigureCaption = readonly [string, string, string, string, string]

let locale = 0

export function setFigureCaptionLocale(index: number) {
  locale = index >= 0 && index <= 4 ? Math.floor(index) : 0
}

export function figureCaptionLocale() {
  return locale
}

export function figureCaption(label: FigureCaption) {
  return label[locale] || label[0]
}

export function captionIndexFromProbe(probe: string) {
  if (probe === 'en') return 1
  if (probe === 'zh') return 2
  if (probe === 'ja') return 3
  if (probe === 'ko') return 4
  return 0
}
