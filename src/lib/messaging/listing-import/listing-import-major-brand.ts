/**
 * Khi cào 1688 / Taobao / Tmall, bỏ sản phẩm có tên (hoặc tên shop) chứa thương hiệu lớn.
 * Hàng trên các sàn này gắn tên nhãn hiệu quốc tế thường là hàng giả — không cào, không đăng.
 * Khớp cả chữ Latin và chữ Hán. Không khớp từ ngắn dễ trùng mã linh kiện (CK/MK/LV) trừ khi
 * tên có chữ Hán, ngữ cảnh thời trang, hoặc không còn từ Latin khác.
 */

export type ListingBrandNameFields = {
  title?: string | null
  name?: string | null
  chinese_name?: string | null
  shop_name?: string | null
  shop_name_chinese?: string | null
}

const FASHION_CTX =
  /包|袋|鞋|靴|衣|裤|褲|裙|帽|表|链|鏈|巾|袜|襪|箱|内衣|內衣|牛仔|皮带|皮帶|钱包|錢包|双肩|雙肩|handbag|sneaker|shoe|boot|wallet|belt|dress|shirt|hoodie|jacket|\bpants?\b/i

/** Thương hiệu → cụm Latin (chữ thường, không dấu). Cụm một từ phải dài từ 3 ký tự. */
const LATIN_BRANDS: Array<[string, string[]]> = [
  ['Nike', ['nike']],
  ['Adidas', ['adidas']],
  ['Jordan', ['air jordan', 'jordan']],
  ['Puma', ['puma']],
  ['New Balance', ['new balance']],
  ['Converse', ['converse']],
  ['Vans', ['vans']],
  ['Reebok', ['reebok']],
  ['Asics', ['asics']],
  ['Skechers', ['skechers']],
  ['Under Armour', ['under armour', 'under armor']],
  ['Fila', ['fila']],
  ['Kappa', ['kappa']],
  ['The North Face', ['the north face', 'north face']],
  ['Columbia', ['columbia']],
  ["Arc'teryx", ['arcteryx', "arc'teryx"]],
  ['Moncler', ['moncler']],
  ['Canada Goose', ['canada goose']],
  ['Patagonia', ['patagonia']],
  ['Lululemon', ['lululemon']],
  ['Champion', ['champion']],
  ['Uniqlo', ['uniqlo']],
  ['Zara', ['zara']],
  ['H&M', ['h&m', 'h and m']],
  ['Gap', ['gap']],
  ['Muji', ['muji']],
  ['Louis Vuitton', ['louis vuitton']],
  ['Gucci', ['gucci']],
  ['Chanel', ['chanel']],
  ['Hermès', ['hermes']],
  ['Dior', ['dior']],
  ['Prada', ['prada']],
  ['Burberry', ['burberry']],
  ['Versace', ['versace']],
  ['Armani', ['armani']],
  ['Balenciaga', ['balenciaga']],
  ['Fendi', ['fendi']],
  ['Givenchy', ['givenchy']],
  ['Saint Laurent', ['saint laurent', 'ysl']],
  ['Celine', ['celine']],
  ['Loewe', ['loewe']],
  ['Bottega Veneta', ['bottega veneta', 'bottega']],
  ['Valentino', ['valentino']],
  ['Chloé', ['chloe']],
  ['Miu Miu', ['miu miu']],
  ['Alexander McQueen', ['alexander mcqueen', 'mcqueen']],
  ['Coach', ['coach']],
  ['Michael Kors', ['michael kors']],
  ['Tory Burch', ['tory burch']],
  ['Longchamp', ['longchamp']],
  ['Goyard', ['goyard']],
  ['MCM', ['mcm']],
  ['Calvin Klein', ['calvin klein']],
  ['Tommy Hilfiger', ['tommy hilfiger']],
  ['Ralph Lauren', ['ralph lauren']],
  ['Lacoste', ['lacoste']],
  ["Levi's", ["levi's", 'levis']],
  ['Diesel', ['diesel']],
  ['Guess', ['guess']],
  ['Hugo Boss', ['hugo boss']],
  ['Rolex', ['rolex']],
  ['Cartier', ['cartier']],
  ['Tiffany', ['tiffany']],
  ['Bulgari', ['bulgari', 'bvlgari']],
  ['Swarovski', ['swarovski']],
  ['Pandora', ['pandora']],
  ['Ray-Ban', ['ray ban', 'rayban']],
  ['Oakley', ['oakley']],
  ['Vivienne Westwood', ['vivienne westwood']],
  ['Chrome Hearts', ['chrome hearts']],
  ['Off-White', ['off white', 'offwhite']],
  ['Supreme', ['supreme']],
  ['Bape', ['bape', 'a bathing ape']],
  ['Stussy', ['stussy']],
  ['Stone Island', ['stone island']],
  ['Fear of God', ['fear of god']],
  ['Maison Margiela', ['maison margiela', 'margiela']],
  ['Rick Owens', ['rick owens']],
  ['Acne Studios', ['acne studios']],
  ['Louboutin', ['louboutin']],
  ['Dr. Martens', ['dr martens', 'doc martens']],
  ['UGG', ['ugg', 'uggs']],
  ['Crocs', ['crocs']],
  ['Birkenstock', ['birkenstock']],
  ['Timberland', ['timberland']],
  ['Salomon', ['salomon']],
  ['Hoka', ['hoka']],
  ['Onitsuka Tiger', ['onitsuka']],
  ['Disney', ['disney']],
  ['Lego', ['lego']],
  ['Pokemon', ['pokemon']],
  ['Hello Kitty', ['hello kitty']],
  ['Barbie', ['barbie']],
  ['Marvel', ['marvel']],
  ['Star Wars', ['star wars']],
  ['Harry Potter', ['harry potter']],
  ['Apple', ['iphone', 'ipad', 'airpods', 'air pods', 'apple watch', 'apple']],
  ['Samsung', ['samsung']],
  ['Sony', ['sony']],
  ['Nintendo', ['nintendo']],
  ['PlayStation', ['playstation']],
  ['Dyson', ['dyson']],
  ['Bose', ['bose']],
  ['GoPro', ['gopro']],
  ['Canon', ['canon']],
  ['Nikon', ['nikon']],
  ['Logitech', ['logitech']],
  ['JBL', ['jbl']],
  ['Ferrari', ['ferrari']],
  ['Lamborghini', ['lamborghini']],
  ['Porsche', ['porsche']],
  ['Mercedes-Benz', ['mercedes benz', 'mercedes']],
  ['BMW', ['bmw']],
  ['Audi', ['audi']],
  ['Estée Lauder', ['estee lauder']],
  ['Lancôme', ['lancome']],
  ['SK-II', ['sk-ii', 'sk ii', 'skii']],
  ['La Mer', ['la mer']],
  ['Clinique', ['clinique']],
  ['Shiseido', ['shiseido']],
  ["Kiehl's", ["kiehl's", 'kiehls']],
  ['Tom Ford', ['tom ford']],
  ['Jo Malone', ['jo malone']],
]

const CJK_BRANDS: Array<[string, RegExp]> = [
  ['Nike', /耐克/],
  ['Adidas', /阿迪达斯|阿迪達斯|阿迪(?!力)/],
  ['Jordan', /乔丹|喬丹/],
  ['Puma', /彪马|彪馬/],
  ['New Balance', /新百伦|新百倫/],
  ['Converse', /匡威/],
  ['Vans', /万斯|萬斯/],
  ['Reebok', /锐步|銳步/],
  ['Asics', /亚瑟士|亞瑟士/],
  ['Skechers', /斯凯奇|斯凱奇/],
  ['Under Armour', /安德玛|安德瑪/],
  ['Fila', /斐乐|斐樂/],
  ['Kappa', /卡帕/],
  ['The North Face', /北面(?!料)/],
  ['Columbia', /哥伦比亚|哥倫比亞/],
  ["Arc'teryx", /始祖鸟|始祖鳥/],
  ['Moncler', /蒙口|盟可睐|盟可睞/],
  ['Canada Goose', /加拿大鹅|加拿大鵝/],
  ['Patagonia', /巴塔哥尼亚|巴塔哥尼亞/],
  ['Lululemon', /露露乐蒙/],
  ['Uniqlo', /优衣库|優衣庫/],
  ['Muji', /无印良品|無印良品/],
  ['Louis Vuitton', /路易威登|路易·威登/],
  ['Gucci', /古驰|古馳/],
  ['Chanel', /香奈儿|香奈兒/],
  ['Hermès', /爱马仕|愛馬仕/],
  ['Dior', /迪奥|迪奧/],
  ['Prada', /普拉达|普拉達/],
  ['Burberry', /巴宝莉|巴寶莉|博柏利/],
  ['Versace', /范思哲|範思哲/],
  ['Armani', /阿玛尼|阿瑪尼/],
  ['Balenciaga', /巴黎世家/],
  ['Fendi', /芬迪/],
  ['Givenchy', /纪梵希|紀梵希/],
  ['Saint Laurent', /圣罗兰|聖羅蘭/],
  ['Celine', /思琳|赛琳|賽琳/],
  ['Loewe', /罗意威|羅意威/],
  ['Bottega Veneta', /葆蝶家/],
  ['Valentino', /华伦天奴|華倫天奴/],
  ['Chloé', /蔻依/],
  ['Miu Miu', /缪缪|繆繆/],
  ['Alexander McQueen', /亚历山大麦昆|亞歷山大麥昆/],
  ['Coach', /蔻驰|蔻馳/],
  ['Michael Kors', /迈克科尔斯|邁克科爾斯|迈克高仕|邁克高仕/],
  ['Tory Burch', /汤丽柏琦|湯麗柏琦/],
  ['Longchamp', /珑骧|瓏驤/],
  ['Goyard', /戈雅/],
  ['Calvin Klein', /卡尔文克莱因|卡爾文克萊因|卡尔文·克莱因|卡爾文·克萊因/],
  ['Tommy Hilfiger', /汤米希尔费格|湯米希爾費格/],
  ['Ralph Lauren', /拉夫劳伦|拉夫勞倫/],
  ['Lacoste', /拉科斯特/],
  ["Levi's", /李维斯|李維斯/],
  ['Diesel', /迪赛|迪賽/],
  ['Guess', /盖尔斯|蓋爾斯/],
  ['Hugo Boss', /雨果博斯/],
  ['Rolex', /劳力士|勞力士/],
  ['Omega', /欧米茄|歐米茄/],
  ['Cartier', /卡地亚|卡地亞/],
  ['Tiffany', /蒂芙尼/],
  ['Bulgari', /宝格丽|寶格麗/],
  ['Swarovski', /施华洛世奇|施華洛世奇/],
  ['Pandora', /潘多拉/],
  ['Ray-Ban', /雷朋/],
  ['Oakley', /欧克利|歐克利/],
  ['Vivienne Westwood', /西太后/],
  ['Chrome Hearts', /克罗心|克羅心/],
  ['Stone Island', /石头岛|石頭島/],
  ['Maison Margiela', /马吉拉|馬吉拉/],
  ['Louboutin', /路铂廷|路鉑廷/],
  ['Dr. Martens', /马汀博士|馬汀博士/],
  ['Crocs', /卡骆驰|卡駱馳/],
  ['Birkenstock', /勃肯/],
  ['Timberland', /添柏岚|添柏嵐/],
  ['Salomon', /萨洛蒙|薩洛蒙/],
  ['Onitsuka Tiger', /鬼冢虎|鬼塚虎/],
  ['Disney', /迪士尼|迪斯尼/],
  ['Lego', /乐高|樂高/],
  ['Pokemon', /宝可梦|寶可夢|口袋妖怪/],
  ['Hello Kitty', /凯蒂猫|凱蒂貓/],
  ['Barbie', /芭比/],
  ['Marvel', /漫威/],
  ['Star Wars', /星球大战|星球大戰/],
  ['Harry Potter', /哈利波特|哈利·波特/],
  ['Apple', /苹果手机|蘋果手機|苹果手表|蘋果手錶|苹果耳机|蘋果耳機/],
  ['Samsung', /三星手机|三星手機|三星耳机|三星耳機|三星平板/],
  ['Sony', /索尼/],
  ['Nintendo', /任天堂/],
  ['Dyson', /戴森/],
  ['Canon', /佳能/],
  ['Nikon', /尼康/],
  ['Logitech', /罗技|羅技/],
  ['Ferrari', /法拉利/],
  ['Lamborghini', /兰博基尼|蘭博基尼/],
  ['Porsche', /保时捷|保時捷/],
  ['Mercedes-Benz', /奔驰|奔馳/],
  ['BMW', /宝马|寶馬/],
  ['Audi', /奥迪|奧迪/],
  ['Estée Lauder', /雅诗兰黛|雅詩蘭黛/],
  ['Lancôme', /兰蔻|蘭蔻/],
  ['La Mer', /海蓝之谜|海藍之謎/],
  ['Clinique', /倩碧/],
  ['Shiseido', /资生堂|資生堂/],
  ["Kiehl's", /科颜氏|科顏氏/],
  ['Tom Ford', /汤姆福特|湯姆福特/],
  ['Jo Malone', /祖玛珑|祖瑪瓏/],
]

type CompiledBrand = { brand: string; re: RegExp; weight: number }

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function foldLatin(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '')
}

export function normalizeListingBrandText(raw: unknown): string {
  if (raw == null) return ''
  const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : ''
  if (!s.trim()) return ''
  return foldLatin(s.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').toLowerCase().replace(/[®™©]/g, ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function compileLatinPhrase(phrase: string): RegExp {
  const words = foldLatin(phrase.normalize('NFKC').toLowerCase())
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (words.length === 0) throw new Error(`empty brand phrase: ${phrase}`)
  if (words.length === 1 && words[0].length < 3) throw new Error(`brand token too short: ${phrase}`)
  const body = words.map(escapeReg).join('[^a-z0-9]{0,3}')
  return new RegExp(`(?:^|[^a-z0-9])${body}(?![a-z0-9])`, 'i')
}

const LATIN_RULES: CompiledBrand[] = LATIN_BRANDS.flatMap(([brand, phrases]) =>
  phrases.map((phrase) => ({
    brand,
    re: compileLatinPhrase(phrase),
    weight: phrase.replace(/[^a-z0-9]/gi, '').length,
  })),
).sort((a, b) => b.weight - a.weight)

function hasShortToken(text: string, token: string): boolean {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?![a-z0-9])`, 'i').test(text)
}

/** LV / CK / MK: từ 2 chữ dễ trùng mã hàng. Chỉ tính là thương hiệu khi tên thực sự đang gọi nhãn đó. */
function ambiguousShortBrand(text: string, token: string): boolean {
  if (!hasShortToken(text, token)) return false
  if (FASHION_CTX.test(text)) return true
  if (/[\u3400-\u9FFF]/.test(text)) return true
  const others = (text.match(/[a-z]{2,}/g) || []).filter((w) => w !== token)
  return others.length === 0
}

function specialBrand(text: string): string | null {
  if (ambiguousShortBrand(text, 'lv')) return 'Louis Vuitton'
  if (/(?:^|[^a-z0-9])aj[^a-z0-9]{0,2}[1-9]\d{0,2}(?![a-z0-9])/i.test(text)) return 'Jordan'
  if (ambiguousShortBrand(text, 'ck')) return 'Calvin Klein'
  if (ambiguousShortBrand(text, 'mk')) return 'Michael Kors'
  return null
}

function vetoBrand(brand: string, text: string): boolean {
  if (brand === 'Columbia' && /咖啡|可可|香蕉|翡翠|大学|大學|coffee|university/.test(text)) return true
  return false
}

export function findMajorWorldBrand(raw: unknown): string | null {
  const text = normalizeListingBrandText(raw)
  if (text.length < 2) return null
  const special = specialBrand(text)
  if (special && !vetoBrand(special, text)) return special
  for (const rule of LATIN_RULES) {
    if (rule.re.test(text) && !vetoBrand(rule.brand, text)) return rule.brand
  }
  for (const [brand, re] of CJK_BRANDS) {
    if (re.test(text) && !vetoBrand(brand, text)) return brand
  }
  return null
}

export function findMajorWorldBrandInFields(fields: unknown[]): string | null {
  for (const field of fields) {
    const hit = findMajorWorldBrand(field)
    if (hit) return hit
  }
  return null
}

function nestedProductInfo(pd: Record<string, unknown>): Record<string, unknown> | null {
  const pi = pd.product_info
  if (!pi || typeof pi !== 'object' || Array.isArray(pi)) return null
  const inner = (pi as Record<string, unknown>).product_info
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return null
  return inner as Record<string, unknown>
}

export function findMajorWorldBrandInProductData(pd: Record<string, unknown> | null | undefined): string | null {
  if (!pd) return null
  const inner = nestedProductInfo(pd)
  return findMajorWorldBrandInFields([
    pd.name,
    pd.chinese_name,
    pd.brand_name,
    pd.brand,
    pd.shop_name,
    pd.shop_name_chinese,
    inner?.name,
    inner?.name_original,
    inner?.brand,
  ])
}

export function listingImportMajorBrandBlockMessage(brand: string): string {
  return `Đã loại vì tên chứa thương hiệu «${brand}» — không cào để tránh chính sách hàng giả.`
}

export function dropListingRowsWithMajorBrands<T extends ListingBrandNameFields>(
  rows: T[],
): { kept: T[]; dropped: number; brands: string[] } {
  const kept: T[] = []
  const brands: string[] = []
  for (const row of rows) {
    const hit = findMajorWorldBrandInFields([
      row.title,
      row.name,
      row.chinese_name,
      row.shop_name,
      row.shop_name_chinese,
    ])
    if (hit) {
      brands.push(hit)
      continue
    }
    kept.push(row)
  }
  return { kept, dropped: rows.length - kept.length, brands: [...new Set(brands)] }
}
