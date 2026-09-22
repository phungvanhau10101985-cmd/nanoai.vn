import type { OutfitSlotId } from '@/lib/partner-website/shop/pdp-outfit-roles'

export type OutfitPairFamily = string

export const OUTFIT_FAMILY_LABELS: Record<string, string> = {
  formal_shoe: 'giày tây',
  casual_shoe: 'giày lười / bệt',
  sport_shoe: 'sneaker',
  party_shoe: 'giày dự tiệc',
  boot: 'boot',
  formal_top: 'áo vest / sơ mi',
  casual_top: 'áo thun / hoodie',
  sport_top: 'áo thể thao',
  party_top: 'áo dự tiệc',
  formal_bottom: 'quần âu',
  casual_bottom: 'quần jean / short',
  sport_bottom: 'quần thể thao',
  skirt: 'chân váy',
  dress_casual: 'váy dạo phố',
  dress_formal: 'đầm công sở',
  dress_party: 'đầm dự tiệc',
  formal_bag: 'túi da công sở',
  casual_bag: 'túi tote / canvas',
  party_bag: 'túi dự tiệc',
  formal_acc: 'thắt lưng da',
  casual_acc: 'mũ / khăn',
  party_acc: 'trang sức',
}

const FAMILY_KEYS: Array<[string, readonly string[]]> = [
  ['party_shoe', ['cao gót', 'cao got', 'high heel', 'stiletto', 'sandal dự tiệc', 'sandal du tiec', 'giày dự tiệc', 'giay du tiec']],
  ['sport_shoe', ['sneaker', 'giày thể thao', 'giay the thao', 'giày chạy', 'giay chay', 'training', 'gym shoe']],
  ['formal_shoe', ['giày tây', 'giay tay', 'oxford', 'derby', 'monkstrap', 'monk strap', 'giày da công sở', 'giay da cong so', 'loafer công sở', 'loafer cong so']],
  ['boot', ['boot', 'bốt', 'bot co', 'bốt cổ']],
  ['casual_shoe', ['giày lười', 'giay luoi', 'slip-on', 'slip on', 'mule', 'sục', 'bệt', 'bet nu', 'búp bê', 'bup be', 'sandal', 'xăng đan', 'xang dan']],
  ['dress_party', ['đầm dự tiệc', 'dam du tiec', 'đầm dạ hội', 'dam da hoi', 'đầm cocktail', 'váy dự tiệc', 'vay du tiec']],
  ['dress_formal', ['đầm công sở', 'dam cong so', 'váy công sở', 'vay cong so']],
  ['dress_casual', ['váy liền', 'vay lien', 'váy ngắn', 'vay ngan', 'váy dài', 'váy midi', 'đầm', 'dam ', 'jumpsuit', 'maxi', 'midi dress']],
  ['party_top', ['áo dự tiệc', 'ao du tiec', 'kim sa', 'đính đá áo', 'dinh da ao']],
  ['formal_top', ['áo vest', 'ao vest', 'vest nam', 'blazer', 'sơ mi', 'so mi', 'áo công sở', 'ao cong so']],
  ['sport_top', ['áo thể thao', 'ao the thao', 'áo gym', 'ao gym', 'jersey']],
  ['casual_top', ['áo thun', 'ao thun', 'hoodie', 'polo', 'croptop', 'crop top', 'cardigan', 'áo khoác', 'ao khoac', 'tank']],
  ['formal_bottom', ['quần âu', 'quan au', 'quần tây', 'quan tay', 'quần vải', 'quan vai']],
  ['sport_bottom', ['jogger', 'quần thể thao', 'quan the thao', 'legging thể thao']],
  ['skirt', ['chân váy', 'chan vay', 'váy chữ a', 'vay chu a']],
  ['casual_bottom', ['jean', 'jeans', 'short', 'shorts', 'cargo', 'quần kaki', 'quan kaki']],
  ['party_bag', ['clutch', 'túi dự tiệc', 'tui du tiec', 'ví cầm tay', 'vi cam tay']],
  ['formal_bag', ['túi da', 'tui da', 'cặp da', 'cap da', 'briefcase', 'túi công sở', 'tui cong so', 'cặp công sở']],
  ['casual_bag', ['tote', 'canvas', 'balo', 'backpack', 'túi vải', 'tui vai']],
  ['party_acc', ['trang sức', 'trang suc', 'dây chuyền', 'day chuyen', 'bông tai', 'bong tai']],
  ['formal_acc', ['thắt lưng da', 'that lung da', 'cà vạt', 'ca vat', 'cavat', 'kẹp cà']],
  ['casual_acc', ['mũ', 'mu luoi trai', 'khăn', 'khan choang', 'kính râm', 'kinh ram']],
]

const ALLOWED: Record<string, Partial<Record<OutfitSlotId, readonly string[]>>> = {
  formal_shoe: { top: ['formal_top'], bottom: ['formal_bottom'], dress: ['dress_formal'], bag: ['formal_bag'], accessory: ['formal_acc'] },
  casual_shoe: {
    top: ['casual_top', 'formal_top'],
    bottom: ['casual_bottom', 'formal_bottom', 'skirt'],
    dress: ['dress_casual', 'dress_formal', 'skirt'],
    bag: ['casual_bag', 'formal_bag'],
    accessory: ['casual_acc', 'formal_acc'],
  },
  sport_shoe: {
    top: ['casual_top', 'sport_top'],
    bottom: ['casual_bottom', 'sport_bottom'],
    dress: ['dress_casual', 'skirt'],
    bag: ['casual_bag'],
    accessory: ['casual_acc'],
  },
  party_shoe: {
    top: ['party_top', 'formal_top'],
    bottom: ['formal_bottom', 'skirt'],
    dress: ['dress_party', 'dress_formal'],
    bag: ['party_bag', 'formal_bag'],
    accessory: ['party_acc', 'formal_acc'],
  },
  boot: {
    top: ['casual_top', 'formal_top'],
    bottom: ['casual_bottom', 'formal_bottom', 'skirt'],
    dress: ['dress_casual', 'dress_formal', 'skirt'],
    bag: ['casual_bag', 'formal_bag'],
    accessory: ['casual_acc', 'formal_acc'],
  },
  formal_top: { bottom: ['formal_bottom'], shoes: ['formal_shoe'], bag: ['formal_bag'], accessory: ['formal_acc'] },
  casual_top: {
    bottom: ['casual_bottom', 'skirt'],
    shoes: ['casual_shoe', 'sport_shoe'],
    bag: ['casual_bag'],
    accessory: ['casual_acc'],
    dress: ['dress_casual'],
  },
  sport_top: { bottom: ['sport_bottom', 'casual_bottom'], shoes: ['sport_shoe'], bag: ['casual_bag'], accessory: ['casual_acc'] },
  party_top: { bottom: ['formal_bottom', 'skirt'], shoes: ['party_shoe', 'formal_shoe'], bag: ['party_bag'], accessory: ['party_acc'] },
  formal_bottom: { top: ['formal_top'], shoes: ['formal_shoe'], bag: ['formal_bag'], accessory: ['formal_acc'] },
  casual_bottom: { top: ['casual_top', 'sport_top'], shoes: ['casual_shoe', 'sport_shoe'], bag: ['casual_bag'], accessory: ['casual_acc'] },
  sport_bottom: { top: ['sport_top', 'casual_top'], shoes: ['sport_shoe'], bag: ['casual_bag'], accessory: ['casual_acc'] },
  skirt: {
    top: ['formal_top', 'casual_top', 'party_top'],
    shoes: ['party_shoe', 'casual_shoe', 'formal_shoe'],
    bag: ['party_bag', 'casual_bag', 'formal_bag'],
    accessory: ['party_acc', 'casual_acc', 'formal_acc'],
  },
  dress_casual: { shoes: ['casual_shoe', 'party_shoe'], bag: ['casual_bag', 'party_bag'], accessory: ['casual_acc', 'party_acc'] },
  dress_formal: { shoes: ['formal_shoe', 'party_shoe', 'casual_shoe'], bag: ['formal_bag', 'party_bag'], accessory: ['formal_acc', 'party_acc'] },
  dress_party: { shoes: ['party_shoe', 'formal_shoe'], bag: ['party_bag', 'formal_bag'], accessory: ['party_acc', 'formal_acc'] },
  formal_bag: { top: ['formal_top'], bottom: ['formal_bottom'], dress: ['dress_formal'], shoes: ['formal_shoe'], accessory: ['formal_acc'] },
  casual_bag: { top: ['casual_top'], bottom: ['casual_bottom', 'skirt'], dress: ['dress_casual'], shoes: ['casual_shoe', 'sport_shoe'], accessory: ['casual_acc'] },
  party_bag: { top: ['party_top', 'formal_top'], dress: ['dress_party', 'dress_formal'], shoes: ['party_shoe', 'formal_shoe'], accessory: ['party_acc'] },
  formal_acc: { top: ['formal_top'], bottom: ['formal_bottom'], shoes: ['formal_shoe'], bag: ['formal_bag'], dress: ['dress_formal'] },
  casual_acc: { top: ['casual_top'], bottom: ['casual_bottom'], shoes: ['casual_shoe', 'sport_shoe'], bag: ['casual_bag'], dress: ['dress_casual'] },
  party_acc: { top: ['party_top', 'formal_top'], dress: ['dress_party'], shoes: ['party_shoe'], bag: ['party_bag'] },
}

const SLOT_QUERIES: Record<string, Partial<Record<OutfitSlotId, readonly string[]>>> = {
  formal_shoe: { top: ['áo vest', 'áo sơ mi', 'blazer'], bottom: ['quần âu'], dress: ['đầm công sở'], bag: ['túi da', 'cặp công sở'], accessory: ['thắt lưng da'] },
  casual_shoe: { top: ['áo thun', 'áo polo', 'sơ mi'], bottom: ['quần jean', 'quần short'], dress: ['váy liền', 'đầm', 'chân váy'], bag: ['túi tote'], accessory: ['mũ'] },
  sport_shoe: { top: ['áo thun', 'áo thể thao', 'hoodie'], bottom: ['quần jean', 'jogger', 'quần short'], dress: ['váy liền', 'chân váy'], bag: ['balo', 'túi tote'], accessory: ['mũ'] },
  party_shoe: { top: ['áo dự tiệc', 'áo vest'], bottom: ['chân váy', 'quần âu'], dress: ['đầm dự tiệc'], bag: ['túi dự tiệc', 'clutch'], accessory: ['trang sức'] },
  boot: { top: ['áo khoác', 'áo sơ mi', 'hoodie'], bottom: ['quần jean', 'quần âu'], dress: ['váy liền', 'đầm', 'chân váy'], bag: ['túi da', 'tote'], accessory: ['thắt lưng da'] },
  formal_top: { bottom: ['quần âu'], shoes: ['giày tây', 'oxford'], bag: ['túi da'], accessory: ['thắt lưng da'] },
  casual_top: { bottom: ['quần jean', 'quần short'], shoes: ['sneaker', 'giày lười'], bag: ['túi tote'], accessory: ['mũ'], dress: ['váy liền'] },
  sport_top: { bottom: ['jogger', 'quần thể thao'], shoes: ['sneaker'], bag: ['balo'], accessory: ['mũ'] },
  party_top: { bottom: ['chân váy', 'quần âu'], shoes: ['cao gót', 'giày tây'], bag: ['túi dự tiệc'], accessory: ['trang sức'] },
  formal_bottom: { top: ['áo vest', 'áo sơ mi', 'blazer'], shoes: ['giày tây'], bag: ['túi da'], accessory: ['thắt lưng da'] },
  casual_bottom: { top: ['áo thun', 'hoodie', 'polo'], shoes: ['sneaker', 'giày lười'], bag: ['túi tote'], accessory: ['mũ'] },
  sport_bottom: { top: ['áo thể thao', 'áo thun'], shoes: ['sneaker'], bag: ['balo'], accessory: ['mũ'] },
  skirt: { top: ['áo sơ mi', 'áo thun', 'áo vest'], shoes: ['cao gót', 'giày lười'], bag: ['túi xách'], accessory: ['trang sức'] },
  dress_casual: { shoes: ['giày lười', 'sandal'], bag: ['túi tote'], accessory: ['mũ', 'khăn'] },
  dress_formal: { shoes: ['giày lười', 'cao gót'], bag: ['túi da'], accessory: ['trang sức'] },
  dress_party: { shoes: ['cao gót'], bag: ['túi dự tiệc', 'clutch'], accessory: ['trang sức'] },
  formal_bag: { top: ['áo vest', 'áo sơ mi'], bottom: ['quần âu'], dress: ['đầm công sở'], shoes: ['giày tây'], accessory: ['thắt lưng da'] },
  casual_bag: { top: ['áo thun'], bottom: ['quần jean'], dress: ['váy liền'], shoes: ['sneaker'], accessory: ['mũ'] },
  party_bag: { top: ['áo dự tiệc'], dress: ['đầm dự tiệc'], shoes: ['cao gót'], accessory: ['trang sức'] },
  formal_acc: { top: ['áo vest', 'áo sơ mi'], bottom: ['quần âu'], shoes: ['giày tây'], bag: ['túi da'], dress: ['đầm công sở'] },
  casual_acc: { top: ['áo thun'], bottom: ['quần jean'], shoes: ['sneaker'], bag: ['túi tote'], dress: ['váy liền'] },
  party_acc: { top: ['áo dự tiệc'], dress: ['đầm dự tiệc'], shoes: ['cao gót'], bag: ['túi dự tiệc'] },
}

function cell(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function blob(...parts: unknown[]): string {
  let text = parts.map(cell).filter(Boolean).join(' | ')
  for (const [raw, repl] of [
    ['áo khoác & vest', 'áo khoác'],
    ['ao khoac & vest', 'ao khoac'],
    ['khoác & vest', 'khoác'],
    ['khoac & vest', 'khoac'],
  ] as const) {
    text = text.split(raw).join(repl)
  }
  return text
}

export function inferOutfitPairFamily(...labels: unknown[]): OutfitPairFamily | null {
  const text = blob(...labels)
  if (!text) return null
  for (const [family, keys] of FAMILY_KEYS) {
    if (keys.some((k) => text.includes(k))) return family
  }
  return null
}

export function allowedOutfitTargetFamilies(
  anchorFamily: OutfitPairFamily | null,
  slot: OutfitSlotId
): readonly string[] | null {
  if (!anchorFamily) return null
  const slotMap = ALLOWED[anchorFamily]
  if (!slotMap) return null
  return slotMap[slot] ?? null
}

export function outfitPairFamilyCompatible(
  anchorFamily: OutfitPairFamily | null,
  candidateFamily: OutfitPairFamily | null,
  slot: OutfitSlotId
): boolean {
  const allowed = allowedOutfitTargetFamilies(anchorFamily, slot)
  if (allowed == null) return true
  if (!candidateFamily) return true
  return allowed.includes(candidateFamily)
}

export function listingQueriesForOutfitFamily(
  anchorFamily: OutfitPairFamily | null,
  slot: OutfitSlotId
): string[] {
  if (!anchorFamily) return []
  return [...(SLOT_QUERIES[anchorFamily]?.[slot] ?? [])]
}

export function outfitFamilyPairReason(anchorFamily: OutfitPairFamily | null, slot: OutfitSlotId): string | null {
  const allowed = allowedOutfitTargetFamilies(anchorFamily, slot)
  if (!allowed?.length) return null
  const src = OUTFIT_FAMILY_LABELS[anchorFamily || ''] || ''
  const dest = OUTFIT_FAMILY_LABELS[allowed[0]] || ''
  if (src && dest) return `Phối ${dest} với ${src}`
  if (dest) return `Phối ${dest}`
  return null
}
