export const HUB_AUTO_RUN_HREFS = new Set(['/tao-banner', '/lam-net-anh', '/tao-bai-hat-lyria-3'])

export type HubAutoRunImageQuality = '2K' | '4K'

const IMAGE_STEP_COST: Record<HubAutoRunImageQuality, number> = { '2K': 1.5, '4K': 3 }
const LYRIA_COST = 3

export function canAutoRunPlan(steps: { href: string }[]): boolean {
  if (steps.length < 1 || steps.length > 4) return false
  return steps.every((s) => HUB_AUTO_RUN_HREFS.has(s.href))
}

export function planNeedsInputImages(steps: { href: string }[]): boolean {
  return steps.some((s) => s.href === '/tao-banner')
}

export function estimatePlanCredits(
  steps: { href: string }[],
  imageQuality: HubAutoRunImageQuality = '2K'
): number {
  let total = 0
  for (const s of steps) {
    if (s.href === '/tao-banner' || s.href === '/lam-net-anh') {
      total += IMAGE_STEP_COST[imageQuality]
    } else if (s.href === '/tao-bai-hat-lyria-3') {
      total += LYRIA_COST
    }
  }
  return total
}

export function normalizePlanHref(href: string): string {
  const h = href.trim()
  if (h.startsWith('/thu-do-online')) return h
  return h.split('?')[0] ?? h
}
