import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import {
  partnerCategoryGenderToken,
  partnerCategoryIntentStem,
  partnerCategoryNameKey,
  partnerCategorySlugKey,
} from '@/lib/partner-website/category/partner-category-name-key'
import type { PartnerCategoryRow } from '@/lib/partner-website/category/partner-category-types'

/**
 * Khớp danh mục cùng ý định SEO dưới cùng một cha.
 * Thứ tự: đúng tên → đúng slug → nhóm đồng nghĩa + cùng giới tính → AI (khi còn anh em).
 * «Áo thun nam» ≠ «Áo thun nữ». «Áo thun» (không giới tính) ≠ «Áo thun nam».
 */

const INTENT_SYNONYM_GROUPS: string[][] = [
  ['ao thun', 'ao phong', 't shirt', 'tshirt', 'tee', 'ao tee'],
  ['quan jean', 'quan jeans', 'jeans', 'quan bo'],
  ['giay sneaker', 'giay the thao', 'sneakers', 'sneaker'],
  ['tui xach', 'handbag', 'handbags'],
  ['vay', 'dam', 'dress'],
]

function synonymGroupIndex(stem: string): number {
  const key = stem.trim()
  if (!key) return -1
  return INTENT_SYNONYM_GROUPS.findIndex((group) => group.includes(key))
}

export function siblingsUnderParent(
  rows: PartnerCategoryRow[],
  parentId: string | null
): PartnerCategoryRow[] {
  return rows.filter((c) => (c.parentId ?? null) === parentId)
}

export function findExactCategorySibling(
  rows: PartnerCategoryRow[],
  parentId: string | null,
  name: string
): PartnerCategoryRow | undefined {
  const key = partnerCategoryNameKey(name)
  const slug = partnerCategorySlugKey(name)
  return siblingsUnderParent(rows, parentId).find(
    (c) => partnerCategoryNameKey(c.name) === key || c.slug === slug
  )
}

export function findLocalSeoIntentSibling(
  rows: PartnerCategoryRow[],
  parentId: string | null,
  name: string
): PartnerCategoryRow | undefined {
  const exact = findExactCategorySibling(rows, parentId, name)
  if (exact) return exact

  const proposedGender = partnerCategoryGenderToken(name)
  const proposedStem = partnerCategoryIntentStem(name)
  const proposedGroup = synonymGroupIndex(proposedStem)
  if (!proposedStem) return undefined

  return siblingsUnderParent(rows, parentId).find((c) => {
    const existingGender = partnerCategoryGenderToken(c.name)
    if (proposedGender !== existingGender) return false
    const existingStem = partnerCategoryIntentStem(c.name)
    if (existingStem === proposedStem) return true
    if (proposedGroup >= 0 && synonymGroupIndex(existingStem) === proposedGroup) return true
    return false
  })
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

export async function askAiSeoIntentSibling(input: {
  proposedName: string
  siblings: PartnerCategoryRow[]
}): Promise<PartnerCategoryRow | null> {
  if (input.siblings.length === 0) return null
  const listed = input.siblings
    .slice(0, 40)
    .map((c) => `id=${c.id} name="${c.name}" path="${c.path}"`)
    .join('\n')
  const system = `You are an SEO taxonomist for a multi-tenant online shop.
Decide whether a proposed category name shares the SAME Google search intent as one existing sibling
(same parent). Same intent = synonyms, translation, accent/spacing/case only — users would expect
the SAME category page. Different intent = different product type, different gender market
(nam vs nữ), broader vs gendered (Áo thun vs Áo thun nam), or a real subtype (túi tote vs túi xách).
Be conservative: if unsure, do NOT match.`
  const user = `Proposed category name: ${input.proposedName}

Existing siblings:
${listed}

Return ONLY JSON: {"matchId":"existing-id"} if one sibling has the same SEO intent,
or {"matchId":null} if none match.`
  const r = await deepseekPartnerChat(system, user, {
    feature: 'partner-category-seo-intent',
    userId: null,
  })
  if (r.error || !r.text) return null
  const data = extractJsonObject(r.text)
  const matchId = typeof data?.matchId === 'string' ? data.matchId.trim() : ''
  if (!matchId) return null
  return input.siblings.find((c) => c.id === matchId) ?? null
}

export async function resolveCategorySiblingBySeoIntent(input: {
  rows: PartnerCategoryRow[]
  parentId: string | null
  name: string
  cache: Map<string, string | null>
}): Promise<PartnerCategoryRow | null> {
  const key = `${input.parentId ?? 'root'}::${partnerCategoryNameKey(input.name)}`
  if (input.cache.has(key)) {
    const id = input.cache.get(key)
    return id ? input.rows.find((c) => c.id === id) ?? null : null
  }
  const local = findLocalSeoIntentSibling(input.rows, input.parentId, input.name)
  if (local) {
    input.cache.set(key, local.id)
    return local
  }
  const siblings = siblingsUnderParent(input.rows, input.parentId)
  if (siblings.length === 0) {
    input.cache.set(key, null)
    return null
  }
  const ai = await askAiSeoIntentSibling({ proposedName: input.name, siblings })
  input.cache.set(key, ai?.id ?? null)
  return ai
}
