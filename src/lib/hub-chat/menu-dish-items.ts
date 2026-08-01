export type MenuDishItem = {
  id: string
  order: string
  name: string
  unit: string
  priceVnd: string
}

export function createEmptyMenuDish(id?: string): MenuDishItem {
  const fallbackId = `dish-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id: id ?? fallbackId,
    order: '',
    name: '',
    unit: '',
    priceVnd: '',
  }
}

export function normalizeMenuDishes(raw: unknown): MenuDishItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const r = row as Record<string, unknown>
      const order = String(r.order ?? '').trim()
      const name = String(r.name ?? '').trim()
      const unit = String(r.unit ?? '').trim()
      const priceVnd = String(r.priceVnd ?? r.price ?? '').trim()
      if (!order && !name && !unit && !priceVnd) return null
      return {
        id: String(r.id ?? `dish-${index}`),
        order,
        name,
        unit,
        priceVnd,
      }
    })
    .filter((row): row is MenuDishItem => row !== null)
}

export function menuDishesHaveContent(dishes: MenuDishItem[]): boolean {
  return dishes.some((d) => d.name.trim() && d.priceVnd.trim())
}

export function menuInputHasContent(dishes: MenuDishItem[], bulkText?: string): boolean {
  return menuDishesHaveContent(dishes) || Boolean(bulkText?.trim())
}

export function formatMenuDishesForPrompt(dishes: MenuDishItem[]): string {
  const rows = dishes
    .filter((d) => d.name.trim())
    .map((d) => {
      const order = d.order.trim() || '—'
      const unit = d.unit.trim() ? ` / ${d.unit.trim()}` : ''
      const price = d.priceVnd.trim()
      const priceLabel = price ? `${price} VND` : ''
      return `${order}. ${d.name.trim()}${unit}${priceLabel ? ` — ${priceLabel}` : ''}`
    })
  return rows.join('\n')
}

export function formatMenuDishesFlat(dishes: MenuDishItem[]): string {
  return dishes
    .filter((d) => d.name.trim())
    .map((d) => {
      const parts = [d.order.trim(), d.name.trim(), d.unit.trim(), d.priceVnd.trim()].filter(Boolean)
      return parts.join(' · ')
    })
    .join(' | ')
}

/** Gộp văn bản dán + bảng từng dòng để đưa vào prompt AI. */
export function formatMenuInputForPrompt(dishes: MenuDishItem[], bulkText?: string): string {
  const parts: string[] = []
  const bulk = bulkText?.trim()
  if (bulk) {
    parts.push(`Free-form menu text (user pasted — interpret layout, categories, names, units, prices):\n${bulk}`)
  }
  const rows = formatMenuDishesForPrompt(dishes)
  if (rows.trim()) {
    parts.push(`Structured dish rows (order · name · unit · price VND):\n${rows}`)
  }
  return parts.join('\n\n')
}
