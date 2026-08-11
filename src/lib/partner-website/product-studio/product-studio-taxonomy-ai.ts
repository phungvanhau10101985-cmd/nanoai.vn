import {
  fetchPartnerCategoriesFlatFromPg,
  insertPartnerCategoryFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'
import type { ProductStudioJobPayload } from '@/lib/partner-website/product-studio/product-studio-types'

/**
 * PS.8 — khi đăng sản phẩm, AI tự resolve/mở rộng cây danh mục của SHOP đó (không phải taxonomy
 * global như 188): khớp node có sẵn ở mỗi cấp L1/L2/L3 (tránh tạo trùng gần giống), chỉ tạo mới khi
 * không có node phù hợp. Mọi node mới đều đánh dấu `aiGenerated=true` — merchant tự xem lại/sửa/gộp
 * qua UI CRUD đã có (W4.4), không có gì mất kiểm soát.
 */

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
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

type LevelDecision = { matchId?: string; name: string }

async function askAiForCategoryPath(
  payload: ProductStudioJobPayload,
  productName: string,
  existingTree: PartnerCategoryRow[]
): Promise<{ l1?: LevelDecision; l2?: LevelDecision; l3?: LevelDecision } | null> {
  const treeLines = existingTree
    .filter((c) => c.depth <= 3)
    .map((c) => `id=${c.id} depth=${c.depth} path="${c.path}" name="${c.name}"`)
    .join('\n')

  const system = `You are an e-commerce catalog taxonomist. Your job: place ONE new product into a shop's
existing category tree (up to 3 levels: L1 > L2 > L3), REUSING existing categories whenever a good semantic
match exists (even if wording/case/spacing differs slightly) to avoid creating near-duplicate categories.
Only propose a NEW category name at a level when nothing in the existing tree fits reasonably.`

  const user = `Product to classify: ${productBrief(payload, productName)}

Existing category tree for this shop (empty = shop has none yet):
${treeLines || '(empty — no categories yet, propose a sensible new 3-level branch)'}

Task: decide category placement at up to 3 levels (L1 broad, L2 more specific, L3 most specific — L3 optional
if the product doesn't need that much depth, but prefer including it when a natural subtype exists).
For each level, EITHER reuse an existing node (by "id" from the list above, must be a real id shown) OR
propose a short new category name (2-4 words, generic enough to hold other similar products later, not a
name describing only this single product).
Return ONLY this JSON: {"l1": {"matchId": "existing-id-or-omit", "name": "used only if creating new"},
"l2": {...}, "l3": {...}}. Omit "l3" entirely if not needed. Omit "matchId" when proposing a new category.`

  const r = await deepseekPartnerChat(system, user, { feature: 'product-studio-taxonomy-ai', userId: null })
  if (r.error || !r.text) {
    console.warn('[product-studio-taxonomy-ai] AI call failed', r.error)
    return null
  }
  const data = extractJsonObject(r.text)
  if (!data) return null
  const toLevel = (raw: unknown): LevelDecision | undefined => {
    if (!raw || typeof raw !== 'object') return undefined
    const o = raw as Record<string, unknown>
    const name = String(o.name ?? '').trim()
    const matchId = typeof o.matchId === 'string' ? o.matchId.trim() : undefined
    if (!matchId && !name) return undefined
    return { matchId: matchId || undefined, name: name || '' }
  }
  return { l1: toLevel(data.l1), l2: toLevel(data.l2), l3: toLevel(data.l3) }
}

export async function resolveOrCreateProductStudioCategory(
  partnerId: string,
  payload: ProductStudioJobPayload,
  productName: string
): Promise<{ categoryId: string | null; warnings: string[] }> {
  const warnings: string[] = []
  const tree = await fetchPartnerCategoriesFlatFromPg(partnerId)
  if (tree === null) return { categoryId: null, warnings: ['taxonomy_ai: could not read category tree'] }

  const decision = await askAiForCategoryPath(payload, productName, tree)
  if (!decision || !decision.l1) {
    warnings.push('taxonomy_ai: AI did not return a usable category decision — product left unclassified')
    return { categoryId: null, warnings }
  }

  const byId = new Map(tree.map((c) => [c.id, c]))

  async function resolveLevel(
    level: LevelDecision | undefined,
    parent: PartnerCategoryRow | null,
    expectedDepth: number
  ): Promise<PartnerCategoryRow | null> {
    if (!level) return null
    if (level.matchId) {
      const existing = byId.get(level.matchId)
      const parentOk = expectedDepth === 1 ? existing?.parentId == null : existing?.parentId === parent?.id
      if (existing && existing.depth === expectedDepth && parentOk) {
        return existing
      }
      warnings.push(`taxonomy_ai: matchId "${level.matchId}" invalid at depth ${expectedDepth} — creating new instead`)
    }
    if (!level.name.trim()) return null
    const created = await insertPartnerCategoryFromPg({
      partnerId,
      parentId: parent?.id ?? null,
      name: level.name.trim(),
      aiGenerated: true,
    })
    if (!created.ok) {
      warnings.push(`taxonomy_ai: create category "${level.name}" failed (${created.error})`)
      return null
    }
    // Node mới có thể được các bước sau (l2/l3) tham chiếu như parent — thêm vào cache cục bộ.
    byId.set(created.row.id, created.row)
    return created.row
  }

  const l1 = await resolveLevel(decision.l1, null, 1)
  const l2 = l1 ? await resolveLevel(decision.l2, l1, 2) : null
  const l3 = l2 ? await resolveLevel(decision.l3, l2, 3) : null

  const leaf = l3 ?? l2 ?? l1
  return { categoryId: leaf?.id ?? null, warnings }
}
