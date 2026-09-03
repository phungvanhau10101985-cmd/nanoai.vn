import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

export type ProposedCategoryLevel = { matchId?: string; name: string }

export type ProposedCategoryPath = {
  l1?: ProposedCategoryLevel
  l2?: ProposedCategoryLevel
  l3?: ProposedCategoryLevel
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function productBrief(payload: ProductStudioJobPayload, name: string): string {
  const bits = [
    `name: ${name}`,
    payload.productType ? `type: ${payload.productType}` : '',
    payload.gender ? `gender: ${payload.gender}` : '',
    payload.material ? `material: ${payload.material}` : '',
    payload.style ? `style: ${payload.style}` : '',
  ].filter(Boolean)
  return bits.join(', ')
}

function toLevel(raw: unknown): ProposedCategoryLevel | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const name = String(o.name ?? '').trim()
  const matchId = typeof o.matchId === 'string' ? o.matchId.trim() : undefined
  if (!matchId && !name) return undefined
  return { matchId: matchId || undefined, name: name || '' }
}

/**
 * AI chọn nhánh L1/L2/L3: tái sử dụng node cùng ý định SEO, chỉ đề xuất tên mới khi không khớp.
 */
export async function proposeProductStudioCategoryPath(
  payload: ProductStudioJobPayload,
  productName: string,
  existingTree: PartnerCategoryRow[]
): Promise<ProposedCategoryPath | null> {
  const treeLines = existingTree
    .filter((c) => c.depth <= 3)
    .map((c) => `id=${c.id} depth=${c.depth} path="${c.path}" name="${c.name}"`)
    .join('\n')

  const system = `You are an e-commerce SEO taxonomist. Place ONE new product into a shop's
existing category tree (up to 3 levels: L1 > L2 > L3). REUSE an existing node when it has the
SAME search intent (synonym, translation, accent/case/spacing). Do NOT reuse when gender differs
(nam vs nữ) or when one name is generic and the other is gendered (Áo thun vs Áo thun nam).
Only propose a NEW category name at a level when nothing in the existing tree fits.
New names must be 2-4 words, generic enough for more products later — not this single SKU.`

  const user = `Product to classify: ${productBrief(payload, productName)}

Existing category tree for this shop (empty = shop has none yet):
${treeLines || '(empty — no categories yet, propose a sensible new 3-level branch)'}

Return ONLY this JSON: {"l1": {"matchId": "existing-id-or-omit", "name": "used only if creating new"},
"l2": {...}, "l3": {...}}. Omit "l3" entirely if not needed. Omit "matchId" when proposing a new category.`

  const r = await deepseekPartnerChat(system, user, { feature: 'product-studio-taxonomy-ai', userId: null })
  if (r.error || !r.text) {
    console.warn('[partner-category-taxonomy-propose] AI call failed', r.error)
    return null
  }
  const data = extractJsonObject(r.text)
  if (!data) return null
  return { l1: toLevel(data.l1), l2: toLevel(data.l2), l3: toLevel(data.l3) }
}
