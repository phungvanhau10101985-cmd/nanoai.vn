/**
 * Nhóm đánh giá / hỏi đáp sau scrape — luật từ-khóa 188 (product_rating_question_groups).
 */

const RATING_GROUPS: Array<[string, number]> = [
  ['áo da nam', 1],
  ['đồ ngủ nam', 2],
  ['áo giữ nhiệt nữ', 3],
  ['bikini nữ', 4],
  ['vest nam', 5],
  ['váy đầm đầm maxi nữ', 6],
  ['váy đầm maxi nữ', 6],
  ['áo phông nữ', 7],
  ['áo dài nữ', 8],
  ['áo da nữ', 9],
  ['vest nữ', 10],
  ['dép tăng chiều cao nữ', 11],
  ['áo jean nam', 12],
  ['dép xăng đan nam', 13],
  ['giày lười nữ', 14],
  ['giày lười nam', 15],
  ['dép lê nam', 16],
  ['quần jean nữ', 17],
  ['giày sneaker nam', 18],
  ['giày trung niên nữ', 19],
  ['martin nam', 20],
  ['giày dép nam', 21],
  ['sandal nam', 22],
  ['giày thể thao nam', 23],
  ['giày dép nữ', 24],
  ['quần jean nam', 25],
  ['dây lưng nam', 26],
  ['giày sneaker nữ', 27],
  ['giày da nữ', 28],
  ['áo sơ mi nam', 29],
  ['giày da nam', 30],
  ['boot nam', 30],
  ['áo lót nam', 31],
  ['giày tăng chiều cao nam', 32],
  ['martin nữ', 33],
  ['giày bệt nữ', 34],
  ['giày cao gót nữ', 35],
  ['giày thể thao nữ', 36],
  ['sandal nữ', 37],
  ['set đồ bộ nam', 38],
  ['đồ bộ nam', 38],
  ['áo lót nữ', 39],
  ['váy đầm liền thân dự tiệc nữ', 40],
  ['set đồ bộ nam nữ', 42],
  ['đồ bộ nam nữ', 61],
  ['áo len nam nữ', 43],
  ['quần nam nữ', 44],
  ['áo khoác nam nữ', 45],
  ['quần nam', 46],
  ['áo len nữ', 47],
  ['áo thun nữ', 48],
  ['áo khoác nam', 49],
  ['áo len nam', 50],
  ['áo thun nam', 51],
  ['túi xách nam', 52],
  ['ví nam', 53],
  ['chân váy đầm nữ', 54],
  ['đồ ngủ nữ', 55],
  ['áo gió nữ', 56],
  ['quần nữ', 57],
  ['áo sơ mi nữ', 58],
  ['váy đầm liền thân nữ', 59],
  ['áo khoác nữ', 60],
  ['set đồ bộ nữ', 61],
  ['đồ bộ nữ', 61],
  ['đồng hồ nữ nữ', 62],
  ['đồng hồ nam nam nữ', 63],
  ['đồng hồ nam nam', 64],
  ['dép lê nữ', 65],
  ['dép lê nam nữ', 65],
  ['boot nữ', 66],
  ['giày tăng chiều cao nữ', 67],
  ['ví nữ', 68],
  ['túi xách nữ', 69],
  ['lắc tay nữ', 70],
  ['lắc tay nam', 71],
  ['vòng cổ nữ', 72],
  ['vòng cổ nam', 73],
  ['mũ nữ', 74],
  ['nhẫn nữ', 75],
  ['trang sức nữ', 75],
  ['nhẫn nam', 76],
  ['nhẫn nam nữ', 77],
  ['bông tai nữ', 78],
  ['hàng sale', 79],
  ['áo lông nữ', 80],
  ['áo lông nam', 81],
  ['áo nỉ nam', 82],
  ['áo nỉ nữ', 83],
  ['áo lông nam nữ', 80],
  ['vest nam nữ', 5],
  ['áo sơ mi nam nữ', 29],
  ['giày thể thao nam nữ', 23],
  ['máy hút bụi', 84],
  ['áo hai dây nữ', 85],
  ['bóng golf', 88],
  ['cỏ nhân tạo', 89],
  ['găng tay chơi golf', 91],
  ['gậy đánh golf', 92],
  ['túi gậy golf', 93],
  ['vali túi du lịch', 94],
  ['ốp điện thoại', 95],
]

const RATING_ALIASES: Array<[string, number]> = [
  ['váy maxi nữ', 6],
  ['đầm maxi nữ', 6],
  ['sandal cao gót nữ', 35],
  ['giày sandal cao gót nữ', 35],
  ['sandal gót nữ', 35],
  ['dép sandal nữ', 37],
  ['sandal xỏ ngón nữ', 37],
  ['sandal quai hậu nữ', 37],
  ['giày sandal nữ', 37],
  ['sneaker nữ', 27],
  ['giày sneaker nữ', 27],
  ['sneaker nam', 18],
  ['boot cổ thấp nữ', 66],
  ['boot cổ cao nữ', 66],
  ['túi đeo chéo nữ', 69],
  ['balo nữ', 69],
  ['vali du lịch', 94],
  ['vali hành lý', 94],
  ['hành lý du lịch', 94],
  ['vali điện', 94],
  ['túi du lịch', 94],
  ['ốp lưng điện thoại', 95],
  ['case điện thoại', 95],
  ['ốp lưng', 95],
  ['gậy golf', 92],
  ['gậy chơi golf', 92],
  ['túi đựng gậy golf', 93],
  ['găng tay golf', 91],
  ['thảm cỏ nhân tạo', 89],
]

export const RATING_GROUP_ID_UNASSIGNED = 888

const GENERIC_RATING_PHRASES = new Set(['giày dép nam', 'giày dép nữ'])
const SPECIFICITY_DEBOOST_MAX_GAP = 2

const RATING_SORTED: Array<[string, number]> = (() => {
  const m = new Map<string, number>()
  for (const [phrase, gid] of [...RATING_ALIASES, ...RATING_GROUPS]) {
    const key = phrase.trim().toLocaleLowerCase()
    if (key) m.set(key, gid)
  }
  return [...m.entries()].sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0]))
})()

function normCtx(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function inferQuestionGroupIdFromProductName(productName: string): number {
  const t = normCtx(productName || '')
  if (!t) return 99
  if (t.includes('nam nữ')) return 99
  if (t.includes('nam')) return 100
  if (t.includes('nữ')) return 88
  return 99
}

export function inferRatingGroupIdFromText(context: string): number {
  const hay = normCtx(context)
  if (!hay) return 0
  const matched: Array<[string, number]> = []
  for (const [phrase, gid] of RATING_SORTED) {
    if (hay.includes(phrase)) matched.push([phrase, gid])
  }
  if (!matched.length) return 0
  const maxlen = Math.max(...matched.map((x) => x[0].length))
  const specifics = matched.filter((x) => !GENERIC_RATING_PHRASES.has(x[0]))
  if (specifics.length) {
    const bestSpecLen = Math.max(...specifics.map((x) => x[0].length))
    if (maxlen - bestSpecLen <= SPECIFICITY_DEBOOST_MAX_GAP) {
      return specifics.reduce((best, cur) =>
        cur[0].length > best[0].length || (cur[0].length === best[0].length && cur[0] > best[0]) ? cur : best
      )[1]
    }
  }
  return matched.reduce((best, cur) =>
    cur[0].length > best[0].length || (cur[0].length === best[0].length && cur[0] > best[0]) ? cur : best
  )[1]
}

function slugAsWords(slug: string): string {
  return (slug || '').replace(/[/\\_\-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function buildImportRatingContextText(productData: Record<string, unknown>): string {
  const parts: string[] = []
  const add = (val: unknown) => {
    const s = String(val || '').trim()
    if (s) parts.push(s)
  }
  for (const key of [
    'category',
    'subcategory',
    'sub_subcategory',
    'raw_category',
    'raw_subcategory',
    'raw_sub_subcategory',
    'name',
    'material',
    'style',
    'color',
    'occasion',
  ]) {
    add(productData[key])
  }
  for (const sk of ['slug_seo', 'full_slug', 'cat3_full_slug']) add(slugAsWords(String(productData[sk] || '')))
  const pi = productData.product_info
  if (pi && typeof pi === 'object') {
    const rec = pi as Record<string, unknown>
    const inner = rec.product_info
    if (inner && typeof inner === 'object') {
      const cat = (inner as Record<string, unknown>).category
      if (cat && typeof cat === 'object') {
        const c = cat as Record<string, unknown>
        add(c.level_1)
        add(c.level_2)
        add(c.level_3)
      }
    }
    const meta = rec.import_taxonomy_meta
    if (meta && typeof meta === 'object') add((meta as Record<string, unknown>).khach_hang_vi)
  }
  const cat1 = String(productData.category || '').trim()
  const cf1 = cat1.toLocaleLowerCase()
  let genderTail = ''
  if (cf1.endsWith(' nữ')) genderTail = 'nữ'
  else if (cf1.endsWith(' nam')) genderTail = 'nam'
  if (genderTail) {
    for (const key of ['subcategory', 'sub_subcategory', 'raw_subcategory', 'raw_sub_subcategory']) {
      const seg = String(productData[key] || '').trim()
      if (seg && !seg.toLocaleLowerCase().includes(genderTail)) parts.push(`${seg} ${genderTail}`)
    }
  }
  return parts.join(' ')
}

export function applyListingImportRatingGroups(
  productData: Record<string, unknown>,
  warnings: string[]
): void {
  const autoLv = String(productData._taxonomy_auto_created_levels || '').trim()
  if (autoLv) {
    productData.group_rating = RATING_GROUP_ID_UNASSIGNED
    productData.group_question = 0
    warnings.push(`import_groups: taxonomy vừa tạo cấp [${autoLv}] — để trống nhóm đánh giá (888) và nhóm câu hỏi (0).`)
    return
  }
  const pname = String(productData.name || '').trim()
  const ctx = buildImportRatingContextText(productData)
  let rid = inferRatingGroupIdFromText(ctx)
  const qid = inferQuestionGroupIdFromProductName(pname)
  if (rid <= 0) {
    warnings.push('import_groups: chưa khớp từ-khóa — giữ nhóm đánh giá 888.')
    rid = 0
  }
  productData.group_rating = rid > 0 ? rid : RATING_GROUP_ID_UNASSIGNED
  productData.group_question = qid
}
