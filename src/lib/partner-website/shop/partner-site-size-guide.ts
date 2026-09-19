import type { WebLocale } from '@/lib/i18n/config'
import { inferOutfitGender, inferOutfitRole } from '@/lib/partner-website/shop/pdp-outfit-roles'

/** Nhóm L1 có bảng / đo size (slug 188 `/info/chon-size/{cat1}`). Không gồm túi / phụ kiện generic. */
export const PARTNER_SIZE_GUIDE_INDEX_KINDS = [
  'giay-dep-nam',
  'giay-dep-nu',
  'thoi-trang-nam',
  'thoi-trang-nu',
  'do-lot-nam',
  'do-lot-nu',
  'trang-phuc-bau-hau-san',
  'thoi-trang-tre-em',
  'the-thao-da-ngoai',
] as const

/** Nhóm con whitelist 188 `cat1/cat2` có bảng riêng. */
export const PARTNER_SIZE_GUIDE_L2_KINDS = [
  'thoi-trang-tre-em/giay-dep-tre-em',
  'do-lot-nam/quan-lot-boxer-brief-nam',
  'do-lot-nu/bra-ao-nguc-nu',
  'giay-dep-nu/giay-cao-got-nu',
  'giay-dep-nu/giay-cuoi-du-tiec-nu',
] as const

export const PARTNER_SIZE_GUIDE_KINDS = [
  ...PARTNER_SIZE_GUIDE_INDEX_KINDS,
  ...PARTNER_SIZE_GUIDE_L2_KINDS,
] as const

export type PartnerSizeGuideKind = (typeof PARTNER_SIZE_GUIDE_KINDS)[number]
export type PartnerSizeGuideIndexKind = (typeof PARTNER_SIZE_GUIDE_INDEX_KINDS)[number]
export type PartnerSizeGuideL2Kind = (typeof PARTNER_SIZE_GUIDE_L2_KINDS)[number]

const KIND_SET = new Set<string>(PARTNER_SIZE_GUIDE_KINDS)

const KIND_ALIASES: Record<string, PartnerSizeGuideKind> = {
  'giay-nam': 'giay-dep-nam',
  'giay-dep-nam': 'giay-dep-nam',
  'giay-nu': 'giay-dep-nu',
  'giay-dep-nu': 'giay-dep-nu',
  'quan-ao-nam': 'thoi-trang-nam',
  'thoi-trang-nam': 'thoi-trang-nam',
  'quan-ao-nu': 'thoi-trang-nu',
  'thoi-trang-nu': 'thoi-trang-nu',
  'do-lot-nam': 'do-lot-nam',
  'do-lot-nu': 'do-lot-nu',
  'quan-lot-boxer-brief-nam': 'do-lot-nam/quan-lot-boxer-brief-nam',
  'quan-lot-boxer': 'do-lot-nam/quan-lot-boxer-brief-nam',
  'do-lot-nam/quan-lot-boxer-brief-nam': 'do-lot-nam/quan-lot-boxer-brief-nam',
  'trang-phuc-bau-hau-san': 'trang-phuc-bau-hau-san',
  'thoi-trang-tre-em': 'thoi-trang-tre-em',
  'the-thao-da-ngoai': 'the-thao-da-ngoai',
  'the-thao': 'the-thao-da-ngoai',
  'giay-dep-tre-em': 'thoi-trang-tre-em/giay-dep-tre-em',
  'giay-tre-em': 'thoi-trang-tre-em/giay-dep-tre-em',
  'thoi-trang-tre-em/giay-dep-tre-em': 'thoi-trang-tre-em/giay-dep-tre-em',
  'bra-ao-nguc-nu': 'do-lot-nu/bra-ao-nguc-nu',
  'ao-nguc': 'do-lot-nu/bra-ao-nguc-nu',
  'do-lot-nu/bra-ao-nguc-nu': 'do-lot-nu/bra-ao-nguc-nu',
  'giay-cao-got-nu': 'giay-dep-nu/giay-cao-got-nu',
  'giay-dep-nu/giay-cao-got-nu': 'giay-dep-nu/giay-cao-got-nu',
  'giay-cuoi-du-tiec-nu': 'giay-dep-nu/giay-cuoi-du-tiec-nu',
  'giay-dep-nu/giay-cuoi-du-tiec-nu': 'giay-dep-nu/giay-cuoi-du-tiec-nu',
}

/** Chiều dài chân ↔ cỡ EU/VN — giày dép nam (188). */
export const SIZE_GUIDE_SHOE_MALE_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['23,6–24,0', '38'],
  ['24,1–24,5', '39'],
  ['24,6–25,0', '40'],
  ['25,1–25,5', '41'],
  ['25,6–26,0', '42'],
  ['26,1–26,5', '43'],
  ['26,6–27,0', '44'],
  ['27,1–27,5', '45'],
  ['27,6–28,0', '46'],
  ['28,1–28,5', '47'],
]

/** Chiều dài chân ↔ cỡ EU/VN — giày dép nữ (188). */
export const SIZE_GUIDE_SHOE_FEMALE_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['21,6–22,0', '34'],
  ['22,1–22,5', '35'],
  ['22,6–23,0', '36'],
  ['23,1–23,5', '37'],
  ['23,6–24,0', '38'],
  ['24,1–24,5', '39'],
  ['24,6–25,0', '40'],
  ['25,1–25,5', '41'],
  ['25,6–26,0', '42'],
  ['26,1–26,5', '43'],
]

/** Chiều dài chân ↔ cỡ tem nhí — giày dép trẻ em (188). */
export const SIZE_GUIDE_SHOE_KID_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['15,5', '24'],
  ['16,0', '24–25'],
  ['16,5', '25–26'],
  ['17,0', '26–27'],
  ['17,5', '27–28'],
  ['18,0', '28–29'],
  ['18,5', '29–30'],
  ['19,0', '30'],
  ['19,5', '31'],
  ['20,0', '31–32'],
  ['20,5', '32–33'],
  ['21,0', '33–34'],
  ['21,5', '34–35'],
  ['22,0', '35–36'],
  ['22,5', '36'],
  ['23,0', '36–37'],
  ['23,5', '37'],
  ['24,0', '37–38'],
]

/** Cỡ chữ VN (S–3XL) ↔ eo / hông (cm) — quần lót boxer nam (188). Không dùng số eo Mỹ 28–38. */
export const SIZE_GUIDE_BOXER_MALE_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ['S', '70–76', '88–94'],
  ['M', '76–82', '94–100'],
  ['L', '82–88', '100–106'],
  ['XL', '88–94', '106–112'],
  ['XXL', '94–100', '112–118'],
  ['3XL', '100–108', '118–126'],
]

/** Vòng ngực dưới ↔ cỡ vành bra (188). */
export const SIZE_GUIDE_BRA_BAND_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['63–67', '65'],
  ['68–72', '70'],
  ['73–77', '75'],
  ['78–82', '80'],
  ['83–87', '85'],
  ['88–92', '90'],
]

/** Tuổi / cao / cân / cỡ Á — quần áo trẻ em (188). */
export const SIZE_GUIDE_KIDS_APPAREL_ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['12–18 tháng', '78–83', '9–11', '92–98'],
  ['2–3 tuổi', '88–93', '12–13', '100–106'],
  ['4–5 tuổi', '98–109', '16–17', '110–118'],
  ['6–7 tuổi', '110–122', '19–21', '120–132'],
  ['8–9 tuổi', '123–134', '22–26', '135–146'],
  ['10–11 tuổi', '135–144', '28–34', '147–154'],
  ['12–13 tuổi', '145–158', '36–45', '155–166'],
]

/** Cỡ / ngực / vai / eo / mông (cm) — quần áo nam (188). */
export const SIZE_GUIDE_APPAREL_MALE_ROWS: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ['S', '86–90', '41–43', '70–76', '88–94'],
  ['M', '90–96', '43–45', '76–82', '94–100'],
  ['L', '96–102', '45–47', '82–88', '100–106'],
  ['XL', '102–108', '47–49', '88–94', '106–112'],
  ['XXL', '108–114', '49–51', '94–100', '112–118'],
  ['3XL', '114–122', '51–53', '100–108', '118–126'],
  ['4XL', '122–130', '53–55', '108–116', '126–134'],
  ['5XL', '130–138', '55–58', '116–126', '134–144'],
]

/** Cỡ / cao / cân — nam (188). */
export const SIZE_GUIDE_APPAREL_MALE_HW_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ['S', '155–165', '45–55'],
  ['M', '160–170', '55–63'],
  ['L', '165–175', '63–72'],
  ['XL', '170–180', '72–82'],
  ['XXL', '175–185', '82–92'],
  ['3XL', '178–188', '92–105'],
  ['4XL', '180–192', '105–118'],
  ['5XL', '185–196', '118–130'],
]

/** Cỡ / ngực / eo / mông (cm) — quần áo nữ (188). */
export const SIZE_GUIDE_APPAREL_FEMALE_ROWS: ReadonlyArray<readonly [string, string, string, string]> = [
  ['XS', '78–82', '60–66', '84–90'],
  ['S', '82–86', '66–70', '88–94'],
  ['M', '86–90', '70–74', '92–98'],
  ['L', '90–95', '74–80', '96–104'],
  ['XL', '95–101', '80–86', '102–110'],
  ['XXL', '101–108', '86–94', '108–116'],
  ['3XL', '108–116', '94–104', '116–126'],
]

/** Cỡ / cao / cân — nữ (188). */
export const SIZE_GUIDE_APPAREL_FEMALE_HW_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ['XS', '145–155', '38–45'],
  ['S', '150–160', '43–50'],
  ['M', '155–165', '50–56'],
  ['L', '158–168', '56–63'],
  ['XL', '160–170', '63–72'],
  ['XXL', '162–172', '72–82'],
  ['3XL', '165–175', '82–92'],
]

export type PartnerSizeGuideCopy = {
  indexTitle: string
  indexLead: string
  indexL2Title: string
  backToIndex: string
  footnote: string
  cardTitle: Record<PartnerSizeGuideKind, string>
  heading: Record<PartnerSizeGuideKind, string>
  measureShoes: string
  measureShoesFemale: string
  noteShoesMale: string
  noteShoesFemale: string
  measureApparelMale: string
  measureApparelFemale: string
  hwMaleTitle: string
  hwMaleLead: string
  hwFemaleTitle: string
  hwFemaleLead: string
  noteApparelMale: string
  noteApparelFemale: string
  shoeCm: string
  shoeMaleSize: string
  shoeFemaleSize: string
  shoeKidSize: string
  sizeCol: string
  chest: string
  shoulder: string
  waist: string
  hip: string
  height: string
  weight: string
  ageCol: string
  asianSize: string
  braUnderbust: string
  braBand: string
  measureKids: string
  noteKids: string
  noteKidsShoesLink: string
  measureKidsShoes: string
  noteKidsShoes: string
  noteKidsShoesGrow: string
  measureUnderwear: string
  noteUnderwear: string
  sizeVnCol: string
  hipBoxer: string
  measureBoxer: string
  noteBoxer: string
  measureBra: string
  measureBraBand: string
  measureBraCup: string
  braCupItems: readonly [string, string, string, string]
  noteBra: string
  measureMaternity: string
  noteMaternity: string
  measureSports: string
  hwSportsLead: string
  noteSports: string
  measureHeels: string
  measureWedding: string
  noteHeels: string
}

const COPY: Record<WebLocale, PartnerSizeGuideCopy> = {
  vi: {
    indexTitle: 'Chọn size theo nhóm hàng',
    indexLead:
      'Chọn nhóm hàng dưới đây để xem bảng tham khảo đo (cm) và gợi ý chọn cỡ. Trên từng trang sản phẩm, luôn ưu tiên mô tả và bảng biến thể do shop đăng.',
    indexL2Title: 'Nhóm con có bảng riêng',
    backToIndex: 'Danh sách hướng dẫn theo nhóm hàng',
    footnote:
      'Thông tin chỉ mang tính tham khảo, không thay cho mô tả và chính sách đổi trả của từng sản phẩm.',
    cardTitle: {
      'giay-dep-nam': 'Giày dép Nam',
      'giay-dep-nu': 'Giày dép Nữ',
      'thoi-trang-nam': 'Thời trang Nam',
      'thoi-trang-nu': 'Thời trang Nữ',
      'do-lot-nam': 'Đồ lót Nam',
      'do-lot-nu': 'Đồ lót Nữ',
      'trang-phuc-bau-hau-san': 'Trang phục bầu & hậu sản',
      'thoi-trang-tre-em': 'Thời trang trẻ em',
      'the-thao-da-ngoai': 'Thể thao & dã ngoại',
      'thoi-trang-tre-em/giay-dep-tre-em': 'Giày dép trẻ em',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'Quần lót boxer Nam',
      'do-lot-nu/bra-ao-nguc-nu': 'Bra áo ngực Nữ',
      'giay-dep-nu/giay-cao-got-nu': 'Giày cao gót Nữ',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'Giày cưới & dự tiệc Nữ',
    },
    heading: {
      'giay-dep-nam': 'Hướng dẫn đo và chọn size giày dép nam',
      'giay-dep-nu': 'Hướng dẫn chọn size giày dép nữ',
      'thoi-trang-nam': 'Size quần áo nam (tham khảo)',
      'thoi-trang-nu': 'Size quần áo nữ (tham khảo)',
      'do-lot-nam': 'Đồ lót — căn vào cm vòng',
      'do-lot-nu': 'Đồ lót — căn vào cm vòng',
      'trang-phuc-bau-hau-san': 'Bầu & sau sinh',
      'thoi-trang-tre-em': 'Trẻ em — tuổi, cao và cỡ Á',
      'the-thao-da-ngoai': 'Đồ thể thao & dã ngoại',
      'thoi-trang-tre-em/giay-dep-tre-em': 'Giày dép trẻ em — đo chiều dài chân (cm)',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'Quần lót boxer brief Nam — eo và hông (cỡ VN)',
      'do-lot-nu/bra-ao-nguc-nu': 'Bra áo ngực Nữ — vòng vành (band) và cup',
      'giay-dep-nu/giay-cao-got-nu': 'Giày cao gót Nữ — cỡ và độ ôm',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'Giày cưới & dự tiệc Nữ — cỡ và độ ôm',
    },
    measureShoes:
      'Đo chiều dài bàn chân (cm): từ gót đến ngón dài nhất, hai chân nên đứng; đo buổi tối, mang đúng loại tất như khi mang giày.',
    measureShoesFemale: 'Đo như nam: gót đến ngón dài nhất (cm).',
    noteShoesMale:
      'Giữa hai cỡ: giày thể thao hoặc giày bít mũi nên chọn cỡ lớn hơn; dép lê/dép quai ngang có thể giữ đúng cỡ nếu chân thon. Chân bè, mu chân cao hoặc thích mang tất dày nên tăng 1 size.',
    noteShoesFemale:
      'Giày cao gót, mũi nhọn hoặc boot ôm nên nghiêng lớn hơn 1 size nếu ở giữa hai cỡ. Sandal/dép quai mảnh giữ đúng size khi chân thon; chân bè hoặc mu cao nên tăng 1 size.',
    measureApparelMale: 'Ưu tiên đo thước dây: ngực, vai, eo, mông — so với dải (cm) của bạn rồi chọn cỡ gần nhất.',
    measureApparelFemale: 'Đo ngực, eo, hông (cm); chọn cỡ vừa khít nhất so với số đo của bạn.',
    hwMaleTitle: 'Gợi ý cỡ theo chiều cao & cân nặng (nam)',
    hwMaleLead:
      'Dùng khi chưa đo được thước: dải này hợp vóc dáng nam Việt hơn. Người vai rộng / bụng lớn nên nghiêng cỡ lớn hơn hoặc căn bảng cm phía trên.',
    hwFemaleTitle: 'Gợi ý cỡ theo chiều cao & cân nặng (nữ)',
    hwFemaleLead:
      'Tham khảo nhanh khi mua online theo vóc dáng nữ Việt; ngực / eo / hông khác biệt lớn so với cùng chiều cao nên luôn ưu tiên bảng đo cm phía trên.',
    noteApparelMale: 'Form oversize có thể giảm 1 cỡ nếu thích vừa người; form slim/ôm hoặc bụng lớn nên tăng 1 cỡ.',
    noteApparelFemale:
      'Đầm ôm ưu tiên vai–ngực–eo; quần và chân váy ưu tiên eo và hông. Form oversize có thể giảm 1 cỡ nếu muốn gọn.',
    shoeCm: 'Chiều dài chân (cm)',
    shoeMaleSize: 'Cỡ giày dép nam (EU/VN)',
    shoeFemaleSize: 'Cỡ giày dép nữ (EU/VN)',
    shoeKidSize: 'Cỡ tem (tham khảo nhị / học sinh nhỏ)',
    sizeCol: 'Cỡ',
    chest: 'Ngực (cm)',
    shoulder: 'Vai (cm)',
    waist: 'Eo (cm)',
    hip: 'Mông (cm)',
    height: 'Chiều cao (cm)',
    weight: 'Cân nặng (kg)',
    ageCol: 'Tuổi (tham khảo)',
    asianSize: 'Cỡ Á (hay gặp)',
    braUnderbust: 'Vòng ngực dưới (ôm sát ngang xương, cm)',
    braBand: 'Cỡ vành hay gặp (band)',
    measureKids: 'Tham khảo thường dùng trong shop Việt Nam (mỗi hãng có thể khác):',
    noteKids: 'Trẻ lớn nhanh — ưu tiên khớp chiều cao và cân nặng hơn đúng số tuổi trên nhãn.',
    noteKidsShoesLink: 'Riêng giày dép trẻ em nên căn chiều dài chân (cm): xem nhóm «Giày dép trẻ em».',
    measureKidsShoes:
      'Trẻ mỗi năm tăng nhanh: nên đo lại chiều dài chân (gót → ngón dài nhất) khi mua giày mới; đặt hai bàn chân đứng; đo buổi chiều tối và chừng 0,3–0,5 cm không chạm vách đầu mũi nếu mô tả không nói rõ ôm chặt.',
    noteKidsShoes:
      'Bảng trên là quy đổi tham khảo theo cỡ tem phổ biến; từng hãng (đặc biệt sneakers) có thể lệch 1 cỡ — luôn đọc bảng trên trang sản phẩm của từng mã.',
    noteKidsShoesGrow:
      'Bé lớn dần hết bảng trên có thể đo chiều dài chân và so với bảng giày nữ cỡ nhỏ (thường từ 35+) trên từng sản phẩm.',
    measureUnderwear:
      'Đo vòng eo thường mặc (cm) và vòng hông chỗ lớn nhất; so với bảng trên từng sản phẩm. Giữa hai cỡ chọn vừa, tránh siết quá eo.',
    noteUnderwear: 'Áo bra: xem thêm cỡ vành + cup tại nhóm «Bra áo ngực Nữ».',
    sizeVnCol: 'Cỡ VN',
    hipBoxer: 'Hông (cm)',
    measureBoxer:
      'Đo vòng eo chỗ cạp quần lót (ôm vừa) và vòng hông chỗ lớn nhất. Chọn cỡ chữ Việt Nam (S–3XL), không dùng số eo Mỹ 28–38. Chọn cỡ vừa, không siết eo — vải co giãn sẽ ôm thêm khi mặc.',
    noteBoxer:
      'Boxer brief ôm đùi: nếu đùi to, tăng 1 cỡ dù eo còn trong dải. Brief/sịp tam giác thường trùng bảng eo. Giữa hai cỡ chọn vừa, tránh căng cạp.',
    measureBra:
      'Bước 1 — đo vòng ngực dưới: ôm sát nhưng không siết ngang đường chân núm sau lưng; thở nhẹ và giữ chỉ của thước ngang. Bước 2 — đo ngang ngực trọn chỗ nhô nhất (thường qua núm) nhưng vẫn giữ chỉ không siết.',
    measureBraBand: 'Cỡ vành hay gặp (70, 75, 80…) tương ứng vòng dưới khoảng như sau (mỗi hãng có thể lệch 1 size):',
    measureBraCup: 'Cup (A/B/C…): là hiệu giữa số đo ngực trọn và ngực dưới (cm), quy chiếu sơ bộ:',
    braCupItems: [
      '< 10 cm: có thể AA hoặc A nhỏ tùy nhãn',
      '≈10–13 cm: thường A–B',
      '≈13–15 cm: thường C',
      '> 15 cm và form nặng: D trở lên — ưu tiên bảng nhãn từng mặt hàng.',
    ],
    noteBra: 'Một nhãn dùng một mã («75B»); khi chỉ có S/M/L hãy ưu tiên bảng cm trên trang sản phẩm.',
    measureMaternity:
      'Ưu tiên vòng ngực và bụng (cm), chiều cao, giai đoạn bầu hoặc sau sinh. Ưu tiên chất co giãn, dáng ôm vừa.',
    noteMaternity: 'Bụng phát triển lệch bảng có thể chọn cỡ lớn hơn hoặc kiểu ô thoáng bụng của shop.',
    measureSports:
      'Quần áo: đo ngực — eo — hông (cm) rồi so bảng của từng sản phẩm. Găng, mũ, bó: xem cỡ tay, chu vi đầu hoặc chiều dài dây trong mô tả.',
    hwSportsLead: 'Áp dụng tương tự thời trang nam; đồ thể thao co giãn có thể trùng nhiều cỡ — ưu tiên bảng shop từng mã.',
    noteSports: 'Hàng co giãn ôm người có thể cần cỡ lớn hơn nếu vai rộng hoặc tay dài — đọc chi tiết từng mẫu.',
    measureHeels:
      'Vẫn căn vào chiều dài chân (cm) như giày bệt. Gót và mũi nhọn thường khiến cổ chân và ngón bị ôm hơn: nếu bàn chân bè, mu chân cao hoặc ít đi cao gót, nên nghiêng lớn hơn 1 size.',
    measureWedding:
      'Giày tiệc thường đi trong thời gian dài: ưu tiên form ổn gót và test đứng/ngồi; nếu mua online, căn chừng vào cỡ đang mang giày bệt cùng hãng (nếu có) và chiều ngang họng giày.',
    noteHeels:
      'Độ cao gót (cm trong mô tả) ảnh hưởng lực bàn chân trước. Giày mũi nhọn nên chọn vừa thoáng; sandal quai mảnh nếu chân gầy có thể giữ đúng size, chân bè nên tăng 1 size. Luôn ưu tiên bảng kích cỡ trên từng sản phẩm.',
  },
  en: {
    indexTitle: 'Size guide by product group',
    indexLead:
      'Pick a group below for measurement charts (cm) and fit tips. On each product page, always prefer the seller’s description and variant chart.',
    indexL2Title: 'Sub-groups with their own charts',
    backToIndex: 'Size guides by product group',
    footnote: 'Reference only — it does not replace each product’s description or return policy.',
    cardTitle: {
      'giay-dep-nam': 'Men’s shoes',
      'giay-dep-nu': 'Women’s shoes',
      'thoi-trang-nam': 'Men’s apparel',
      'thoi-trang-nu': 'Women’s apparel',
      'do-lot-nam': 'Men’s underwear',
      'do-lot-nu': 'Women’s underwear',
      'trang-phuc-bau-hau-san': 'Maternity & postpartum',
      'thoi-trang-tre-em': 'Kids’ apparel',
      'the-thao-da-ngoai': 'Sports & outdoor',
      'thoi-trang-tre-em/giay-dep-tre-em': 'Kids’ shoes',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'Men’s boxer briefs',
      'do-lot-nu/bra-ao-nguc-nu': 'Women’s bras',
      'giay-dep-nu/giay-cao-got-nu': 'Women’s heels',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'Wedding & party shoes',
    },
    heading: {
      'giay-dep-nam': 'How to measure and pick men’s shoe size',
      'giay-dep-nu': 'How to pick women’s shoe size',
      'thoi-trang-nam': 'Men’s clothing sizes (reference)',
      'thoi-trang-nu': 'Women’s clothing sizes (reference)',
      'do-lot-nam': 'Underwear — use body cm',
      'do-lot-nu': 'Underwear — use body cm',
      'trang-phuc-bau-hau-san': 'Maternity & postpartum',
      'thoi-trang-tre-em': 'Kids — age, height and Asian size',
      'the-thao-da-ngoai': 'Sports & outdoor wear',
      'thoi-trang-tre-em/giay-dep-tre-em': 'Kids’ shoes — measure foot length (cm)',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'Men’s boxer briefs — waist and hips (VN size)',
      'do-lot-nu/bra-ao-nguc-nu': 'Bras — band and cup',
      'giay-dep-nu/giay-cao-got-nu': 'Heels — size and fit',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'Wedding & party shoes — size and fit',
    },
    measureShoes:
      'Measure foot length (cm) from heel to longest toe, standing; measure in the evening, wearing the same socks you will wear with the shoes.',
    measureShoesFemale: 'Same as men’s: heel to longest toe (cm).',
    noteShoesMale:
      'Between sizes: sneakers or closed shoes should go up; slides/sandals can stay true if your foot is slim. Wide feet, high instep, or thick socks: go up one size.',
    noteShoesFemale:
      'Heels, pointed toes, or snug boots: go up one size if you are between sizes. Thin-strap sandals stay true on slim feet; wide feet or high instep: go up one size.',
    measureApparelMale: 'Prefer a tape: chest, shoulder, waist, hips — pick the closest range (cm).',
    measureApparelFemale: 'Measure bust, waist, and hips (cm); pick the closest match.',
    hwMaleTitle: 'Size by height & weight (men)',
    hwMaleLead:
      'Use this when you cannot measure: it fits typical Vietnamese male builds. Broad shoulders / larger waist: go up or use the cm chart above.',
    hwFemaleTitle: 'Size by height & weight (women)',
    hwFemaleLead:
      'Quick reference for online orders; if bust / waist / hips differ a lot from the same height, always prefer the cm chart above.',
    noteApparelMale: 'Oversized fits can go down one size; slim fits or a larger waist should go up one size.',
    noteApparelFemale:
      'Fitted dresses: shoulders–bust–waist; pants and skirts: waist and hips. Oversized fits can go down one size for a neater look.',
    shoeCm: 'Foot length (cm)',
    shoeMaleSize: 'Men’s shoe size (EU/VN)',
    shoeFemaleSize: 'Women’s shoe size (EU/VN)',
    shoeKidSize: 'Insole label (toddler / small school size)',
    sizeCol: 'Size',
    chest: 'Chest (cm)',
    shoulder: 'Shoulder (cm)',
    waist: 'Waist (cm)',
    hip: 'Hips (cm)',
    height: 'Height (cm)',
    weight: 'Weight (kg)',
    ageCol: 'Age (reference)',
    asianSize: 'Asian size (common)',
    braUnderbust: 'Underbust (snug across the rib, cm)',
    braBand: 'Common band size',
    measureKids: 'Common reference in Vietnamese shops (brands may differ):',
    noteKids: 'Kids grow fast — match height and weight rather than the age printed on the tag.',
    noteKidsShoesLink: 'For kids’ shoes, use foot length (cm): see «Kids’ shoes».',
    measureKidsShoes:
      'Kids grow quickly: re-measure foot length (heel → longest toe) for each new pair; stand on both feet; measure in the evening and leave about 0.3–0.5 cm at the toe unless the listing says a snug fit.',
    noteKidsShoes:
      'The chart converts common insole labels; sneakers especially can run a size off — always read the product’s own chart.',
    noteKidsShoesGrow:
      'When a child outgrows this chart, measure foot length and compare with the smaller women’s shoe sizes (often from 35+) on each listing.',
    measureUnderwear:
      'Measure the waist you usually wear (cm) and the fullest hip; compare with each product chart. Between sizes, pick the roomier one — do not cinch the waist.',
    noteUnderwear: 'Bras: see band + cup in «Women’s bras».',
    sizeVnCol: 'VN size',
    hipBoxer: 'Hips (cm)',
    measureBoxer:
      'Measure the waist at the underwear band (comfortable, not tight) and the fullest hip. Use Vietnamese letter sizes (S–3XL), not US waist numbers 28–38. Pick a comfortable size — stretch fabric will hug more when worn.',
    noteBoxer:
      'Boxer briefs that hug the thigh: if thighs are large, go up one size even if the waist still fits. Triangle briefs usually follow the same waist ranges. Between sizes, pick the roomier one — do not stretch the waistband.',
    measureBra:
      'Step 1 — measure underbust: snug but not tight across the rib, behind the bust; breathe lightly and keep the tape level. Step 2 — measure around the fullest bust (usually over the nipples) without pulling tight.',
    measureBraBand: 'Common bands (70, 75, 80…) map roughly to underbust as below (brands may differ by 1 size):',
    measureBraCup: 'Cup (A/B/C…): the difference between full bust and underbust (cm), roughly:',
    braCupItems: [
      '< 10 cm: often AA or a small A, depending on the label',
      '≈10–13 cm: usually A–B',
      '≈13–15 cm: usually C',
      '> 15 cm or a fuller shape: D and up — prefer each product’s chart.',
    ],
    noteBra: 'Some labels use one code («75B»); if you only see S/M/L, prefer the cm chart on the product page.',
    measureMaternity:
      'Prefer bust and bump (cm), height, and whether you are pregnant or postpartum. Stretch fabrics and a comfortable fit work best.',
    noteMaternity: 'If the bump outgrows the chart, size up or pick a shop style with extra room at the belly.',
    measureSports:
      'Apparel: measure chest — waist — hips (cm) then compare each product chart. Gloves, hats, braces: check hand, head, or strap length in the listing.',
    hwSportsLead: 'Same idea as men’s apparel; stretch sportswear can span sizes — prefer each SKU’s chart.',
    noteSports: 'Close-fitting stretch pieces may need a larger size if shoulders are broad or arms are long.',
    measureHeels:
      'Still use foot length (cm) like flats. Heels and pointed toes hug the ankle and toes more: wide feet, high instep, or little heel experience — go up one size.',
    measureWedding:
      'Party shoes are worn for hours: prefer a stable heel and test standing/sitting; online, start from the flat size you wear from the same brand (if any) and the shoe opening width.',
    noteHeels:
      'Heel height (cm in the listing) shifts weight onto the forefoot. Pointed toes should feel roomy; thin-strap sandals can stay true on slim feet, go up one size if wide. Always prefer each product’s chart.',
  },
  zh: {
    indexTitle: '按品类选择尺码',
    indexLead: '选择下方品类查看测量对照表（厘米）与选码建议。商品页请优先以商家描述和规格表为准。',
    indexL2Title: '有独立对照表的子品类',
    backToIndex: '按品类查看尺码指南',
    footnote: '仅供参考，不能替代各商品的说明与退换政策。',
    cardTitle: {
      'giay-dep-nam': '男鞋',
      'giay-dep-nu': '女鞋',
      'thoi-trang-nam': '男装',
      'thoi-trang-nu': '女装',
      'do-lot-nam': '男式内衣',
      'do-lot-nu': '女式内衣',
      'trang-phuc-bau-hau-san': '孕产服装',
      'thoi-trang-tre-em': '童装',
      'the-thao-da-ngoai': '运动户外',
      'thoi-trang-tre-em/giay-dep-tre-em': '童鞋',
      'do-lot-nam/quan-lot-boxer-brief-nam': '男士平角内裤',
      'do-lot-nu/bra-ao-nguc-nu': '女式文胸',
      'giay-dep-nu/giay-cao-got-nu': '女高跟鞋',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': '婚宴女鞋',
    },
    heading: {
      'giay-dep-nam': '男鞋测量与选码',
      'giay-dep-nu': '女鞋选码指南',
      'thoi-trang-nam': '男装尺码（参考）',
      'thoi-trang-nu': '女装尺码（参考）',
      'do-lot-nam': '内衣 — 按厘米围度',
      'do-lot-nu': '内衣 — 按厘米围度',
      'trang-phuc-bau-hau-san': '孕产选码',
      'thoi-trang-tre-em': '童装 — 年龄、身高与亚码',
      'the-thao-da-ngoai': '运动户外服装',
      'thoi-trang-tre-em/giay-dep-tre-em': '童鞋 — 测量脚长（厘米）',
      'do-lot-nam/quan-lot-boxer-brief-nam': '男士平角内裤 — 腰围与臀围（越南码）',
      'do-lot-nu/bra-ao-nguc-nu': '文胸 — 底围与罩杯',
      'giay-dep-nu/giay-cao-got-nu': '高跟鞋 — 尺码与贴合',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': '婚宴女鞋 — 尺码与贴合',
    },
    measureShoes: '测量脚长（厘米）：脚跟到最长趾，站立测量；建议傍晚、穿着实际搭配的袜子测量。',
    measureShoesFemale: '与男鞋相同：脚跟到最长趾（厘米）。',
    noteShoesMale: '两码之间：运动鞋或包头鞋建议选大一码；脚瘦可按原码选拖鞋。脚宽、足背高或厚袜请加大一码。',
    noteShoesFemale: '高跟鞋、尖头或紧靴若介于两码请选大一码。细带凉鞋脚瘦可按原码；脚宽或足背高请加大一码。',
    measureApparelMale: '优先用软尺测量胸围、肩宽、腰围、臀围，对照厘米区间选择最接近的码。',
    measureApparelFemale: '测量胸围、腰围、臀围（厘米），选择最贴合的码。',
    hwMaleTitle: '按身高体重参考（男）',
    hwMaleLead: '无法测量时使用。肩宽或腰围较大请选大一码，或以厘米表为准。',
    hwFemaleTitle: '按身高体重参考（女）',
    hwFemaleLead: '网购快速参考；胸腰臀与同身高差异较大时，请优先对照厘米表。',
    noteApparelMale: '宽松版型可小一码；修身或腰围较大请大一码。',
    noteApparelFemale: '修身连衣裙看肩胸腰；裤裙看腰臀。宽松版想更利落可小一码。',
    shoeCm: '脚长（厘米）',
    shoeMaleSize: '男鞋码（EU/VN）',
    shoeFemaleSize: '女鞋码（EU/VN）',
    shoeKidSize: '鞋垫标码（幼童 / 小学生）',
    sizeCol: '尺码',
    chest: '胸围（厘米）',
    shoulder: '肩宽（厘米）',
    waist: '腰围（厘米）',
    hip: '臀围（厘米）',
    height: '身高（厘米）',
    weight: '体重（公斤）',
    ageCol: '年龄（参考）',
    asianSize: '亚码（常见）',
    braUnderbust: '下胸围（贴合肋骨，厘米）',
    braBand: '常见底围',
    measureKids: '越南店铺常用参考（各品牌可能不同）：',
    noteKids: '儿童长得快 — 优先对照身高体重，而不是吊牌年龄。',
    noteKidsShoesLink: '童鞋请按脚长（厘米）：见「童鞋」。',
    measureKidsShoes:
      '儿童每年脚长变化快：买新鞋请重测脚长（脚跟→最长趾）；双脚站立；傍晚测量，鞋头预留约 0.3–0.5 厘米（除非说明偏紧）。',
    noteKidsShoes: '上表为常见鞋垫标码换算；运动鞋尤其可能差一码 — 请以商品页表格为准。',
    noteKidsShoesGrow: '超出本表后，可测脚长并对照女鞋较小码（常从 35 起）的商品表。',
    measureUnderwear: '测量常穿腰围（厘米）和最丰满臀围，对照各商品表。两码之间选较宽松，勿勒腰。',
    noteUnderwear: '文胸：见「女式文胸」的底围与罩杯。',
    sizeVnCol: '越南码',
    hipBoxer: '臀围（厘米）',
    measureBoxer:
      '在内裤腰头处测量腰围（舒适、不勒）和最丰满臀围。使用越南字母码（S–3XL），不要用美式腰围数字 28–38。选舒适码 — 弹性面料上身会更贴。',
    noteBoxer:
      '贴大腿的平角裤：大腿粗即使腰围仍在区间也请加大一码。三角内裤通常沿用同一腰围表。两码之间选较松，勿撑腰带。',
    measureBra:
      '第一步测下胸围：贴合但不勒，沿肋骨绕至后背，尺子保持水平。第二步绕过最丰满处（通常经乳头）测量，不要拉紧。',
    measureBraBand: '常见底围（70、75、80…）与下胸围大致对应如下（品牌可能差一码）：',
    measureBraCup: '罩杯（A/B/C…）约为全胸围减去下胸围（厘米）：',
    braCupItems: [
      '< 10 厘米：多为 AA 或偏小 A，视品牌而定',
      '≈10–13 厘米：多为 A–B',
      '≈13–15 厘米：多为 C',
      '> 15 厘米或较丰满：D 及以上 — 请以各商品表为准。',
    ],
    noteBra: '有的品牌用一个编码（「75B」）；若只有 S/M/L，请优先看商品页厘米表。',
    measureMaternity: '优先胸围与腹围（厘米）、身高，以及孕期或产后阶段。弹性面料、宽松适中更合适。',
    noteMaternity: '腹部超出对照表时可加大一码，或选择腹部更宽松的款式。',
    measureSports: '服装：测胸—腰—臀（厘米）再对照各商品。手套、帽子、护具请看手围、头围或绑带长度。',
    hwSportsLead: '与男装思路相同；弹性运动服可能跨码 — 请以各 SKU 表格为准。',
    noteSports: '贴身弹性款若肩宽或臂长，可能需要加大一码。',
    measureHeels: '仍按脚长（厘米）如平底鞋。高跟与尖头更贴脚踝和脚趾：脚宽、足背高或少穿高跟建议大一码。',
    measureWedding: '宴鞋需长时间穿着：优先稳跟并试站/坐；网购可参考同品牌平底码及鞋口宽度。',
    noteHeels: '跟高（厘米）会把重量压到前掌。尖头应略留空间；细带凉鞋脚瘦可按原码，脚宽加大一码。请以各商品表为准。',
  },
  ja: {
    indexTitle: 'カテゴリ別サイズガイド',
    indexLead:
      '下のグループから採寸表（cm）と選び方を確認できます。商品ページでは出品者の説明とバリエーション表を優先してください。',
    indexL2Title: '専用表があるサブグループ',
    backToIndex: 'カテゴリ別サイズガイド一覧',
    footnote: '参考情報です。各商品の説明・返品ポリシーに代わるものではありません。',
    cardTitle: {
      'giay-dep-nam': 'メンズシューズ',
      'giay-dep-nu': 'レディースシューズ',
      'thoi-trang-nam': 'メンズアパレル',
      'thoi-trang-nu': 'レディースアパレル',
      'do-lot-nam': 'メンズアンダーウェア',
      'do-lot-nu': 'レディースアンダーウェア',
      'trang-phuc-bau-hau-san': 'マタニティ・産後',
      'thoi-trang-tre-em': 'キッズアパレル',
      'the-thao-da-ngoai': 'スポーツ・アウトドア',
      'thoi-trang-tre-em/giay-dep-tre-em': 'キッズシューズ',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'メンズボクサー',
      'do-lot-nu/bra-ao-nguc-nu': 'ブラジャー',
      'giay-dep-nu/giay-cao-got-nu': 'ヒール',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'ウェディング・パーティーシューズ',
    },
    heading: {
      'giay-dep-nam': 'メンズ靴の測り方とサイズ選び',
      'giay-dep-nu': 'レディース靴のサイズ選び',
      'thoi-trang-nam': 'メンズ衣料サイズ（参考）',
      'thoi-trang-nu': 'レディース衣料サイズ（参考）',
      'do-lot-nam': 'アンダーウェア — 周径cm',
      'do-lot-nu': 'アンダーウェア — 周径cm',
      'trang-phuc-bau-hau-san': 'マタニティ・産後',
      'thoi-trang-tre-em': 'キッズ — 年齢・身長・アジアサイズ',
      'the-thao-da-ngoai': 'スポーツ・アウトドアウェア',
      'thoi-trang-tre-em/giay-dep-tre-em': 'キッズシューズ — 足長（cm）',
      'do-lot-nam/quan-lot-boxer-brief-nam': 'メンズボクサー — ウエストとヒップ（ベトナムサイズ）',
      'do-lot-nu/bra-ao-nguc-nu': 'ブラ — バンドとカップ',
      'giay-dep-nu/giay-cao-got-nu': 'ヒール — サイズとフィット',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': 'ウェディング・パーティーシューズ — サイズとフィット',
    },
    measureShoes:
      '足長（cm）をかかとから一番長い指まで、立った状態で測ります。夕方、実際に履く靴下で測ってください。',
    measureShoesFemale: 'メンズと同様：かかとから一番長い指まで（cm）。',
    noteShoesMale:
      '中間サイズはスニーカーや閉じた靴なら大きめを。細い足ならサンダルはそのまま。幅広・甲高・厚手ソックスは1サイズアップ。',
    noteShoesFemale:
      'ヒール・先の細い靴・フィットブーツは中間なら1サイズアップ。細いストラップは細い足ならそのまま、幅広・甲高は1サイズアップ。',
    measureApparelMale: '胸・肩・ウエスト・ヒップをメジャーで測り、最も近いcmレンジを選びます。',
    measureApparelFemale: 'バスト・ウエスト・ヒップ（cm）を測り、最も近いサイズを選びます。',
    hwMaleTitle: '身長・体重からの目安（メンズ）',
    hwMaleLead: '採寸できないときの目安です。肩幅やウエストが大きい場合は上のcm表を優先し、大きめを選んでください。',
    hwFemaleTitle: '身長・体重からの目安（レディース）',
    hwFemaleLead: 'オンライン購入の早見です。同じ身長でもバスト/ウエスト/ヒップ差が大きい場合はcm表を優先。',
    noteApparelMale: 'オーバーサイズは1つ下でも可。スリムやウエストが大きい場合は1つ上。',
    noteApparelFemale: 'フィットワンピースは肩・バスト・ウエスト、パンツ/スカートはウエストとヒップ。オーバーサイズは1つ下でも可。',
    shoeCm: '足長 (cm)',
    shoeMaleSize: 'メンズ靴サイズ (EU/VN)',
    shoeFemaleSize: 'レディース靴サイズ (EU/VN)',
    shoeKidSize: '中敷き表示（幼児／小学生）',
    sizeCol: 'サイズ',
    chest: '胸囲 (cm)',
    shoulder: '肩幅 (cm)',
    waist: 'ウエスト (cm)',
    hip: 'ヒップ (cm)',
    height: '身長 (cm)',
    weight: '体重 (kg)',
    ageCol: '年齢（参考）',
    asianSize: 'アジアサイズ（よくある表示）',
    braUnderbust: 'アンダーバスト（肋骨まわり、cm）',
    braBand: 'よくあるバンドサイズ',
    measureKids: 'ベトナム店舗でよく使う目安です（ブランド差あり）：',
    noteKids: '子どもはすぐに大きくなります。タグの年齢より身長・体重を優先してください。',
    noteKidsShoesLink: 'キッズシューズは足長（cm）で：「キッズシューズ」を参照。',
    measureKidsShoes:
      '成長が速いので買い替えのたびに足長（かかと→最長指）を測り直してください。両足で立ち、夕方に測り、つま先に約0.3–0.5cmの余裕を（タイト指定がなければ）。',
    noteKidsShoes: '上表はよくある中敷き表示の換算です。スニーカーは1サイズ違うことがあります。商品ページの表を優先。',
    noteKidsShoesGrow: 'この表を超えたら足長を測り、レディース小さめサイズ（多くは35〜）の商品表と照合。',
    measureUnderwear: '普段のウエスト（cm）とヒップ最大部を測り、各商品表と照合。中間ならゆったりめを。ウエストを締めすぎない。',
    noteUnderwear: 'ブラは「ブラジャー」のバンド＋カップを参照。',
    sizeVnCol: 'ベトナムサイズ',
    hipBoxer: 'ヒップ (cm)',
    measureBoxer:
      'パンツの履き口でウエスト（きつくなく）とヒップ最大部を測ります。ベトナムのレターサイズ（S–3XL）を使い、米国のウエスト数字 28–38 は使いません。楽なサイズを。ストレッチは着るとよりフィットします。',
    noteBoxer:
      '太ももにフィットするボクサーは、ウエストが範囲内でも太ももが大きいなら1サイズアップ。三角ブリーフは同じウエスト表。中間ならゆったりめを。履き口を伸ばしすぎない。',
    measureBra:
      '1) アンダー：肋骨まわりをきつくなく水平に。2) バストトップ（通常は乳首まわり）を締めすぎず測る。',
    measureBraBand: 'よくあるバンド（70、75、80…）とアンダーの目安（ブランドで1サイズ差あり）：',
    measureBraCup: 'カップ（A/B/C…）はバストとアンダーの差（cm）の目安：',
    braCupItems: [
      '< 10cm：AAまたは小さめAが多い',
      '≈10–13cm：通常 A–B',
      '≈13–15cm：通常 C',
      '> 15cm またはボリューム多め：D以上 — 各商品表を優先。',
    ],
    noteBra: '「75B」のような一つの記号のブランドもあります。S/M/Lのみなら商品ページのcm表を優先。',
    measureMaternity: 'バストとお腹（cm）、身長、妊娠中か産後かを優先。ストレッチ素材で無理のないフィットを。',
    noteMaternity: 'お腹が表を超えたらサイズアップ、またはお腹に余裕のある型を。',
    measureSports: 'ウェアは胸・ウエスト・ヒップ（cm）。手袋・帽子・サポーターは手・頭・ストラップ長を商品説明で確認。',
    hwSportsLead: 'メンズ衣料と同じ考え方。ストレッチはサイズが跨ることがあるのでSKU表を優先。',
    noteSports: '密着ストレッチは肩幅や腕が長い場合、1つ上が必要なことがあります。',
    measureHeels:
      '足長（cm）はフラットと同じ。ヒールや先の細い靴は足首と指がよりフィットします。幅広・甲高・ヒール慣れが少ない場合は1サイズアップ。',
    measureWedding: 'パーティー靴は長時間履きます。かかとが安定するものを。同じブランドのフラットサイズと開口幅も参考に。',
    noteHeels:
      'ヒールの高さ（cm）は前足部に荷重します。先細は余裕を。細いストラップは細い足ならそのまま、幅広は1サイズアップ。各商品表を優先。',
  },
  ko: {
    indexTitle: '상품 그룹별 사이즈 가이드',
    indexLead:
      '아래 그룹을 선택해 측정표(cm)와 선택 팁을 확인하세요. 각 상품 페이지에서는 판매자 설명과 옵션 표를 우선하세요.',
    indexL2Title: '별도 표가 있는 하위 그룹',
    backToIndex: '그룹별 사이즈 가이드 목록',
    footnote: '참고용이며 각 상품의 설명·반품 정책을 대체하지 않습니다.',
    cardTitle: {
      'giay-dep-nam': '남성 신발',
      'giay-dep-nu': '여성 신발',
      'thoi-trang-nam': '남성 의류',
      'thoi-trang-nu': '여성 의류',
      'do-lot-nam': '남성 속옷',
      'do-lot-nu': '여성 속옷',
      'trang-phuc-bau-hau-san': '임부·산후',
      'thoi-trang-tre-em': '아동 의류',
      'the-thao-da-ngoai': '스포츠·아웃도어',
      'thoi-trang-tre-em/giay-dep-tre-em': '아동 신발',
      'do-lot-nam/quan-lot-boxer-brief-nam': '남성 드로즈',
      'do-lot-nu/bra-ao-nguc-nu': '여성 브라',
      'giay-dep-nu/giay-cao-got-nu': '여성 힐',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': '웨딩·파티 슈즈',
    },
    heading: {
      'giay-dep-nam': '남성 신발 측정과 사이즈 선택',
      'giay-dep-nu': '여성 신발 사이즈 선택',
      'thoi-trang-nam': '남성 의류 사이즈 (참고)',
      'thoi-trang-nu': '여성 의류 사이즈 (참고)',
      'do-lot-nam': '속옷 — 둘레 cm',
      'do-lot-nu': '속옷 — 둘레 cm',
      'trang-phuc-bau-hau-san': '임부·산후',
      'thoi-trang-tre-em': '아동 — 나이, 키, 아시아 사이즈',
      'the-thao-da-ngoai': '스포츠·아웃도어 의류',
      'thoi-trang-tre-em/giay-dep-tre-em': '아동 신발 — 발 길이(cm)',
      'do-lot-nam/quan-lot-boxer-brief-nam': '남성 드로즈 — 허리와 엉덩이 (베트남 사이즈)',
      'do-lot-nu/bra-ao-nguc-nu': '브라 — 밴드와 컵',
      'giay-dep-nu/giay-cao-got-nu': '힐 — 사이즈와 핏',
      'giay-dep-nu/giay-cuoi-du-tiec-nu': '웨딩·파티 슈즈 — 사이즈와 핏',
    },
    measureShoes: '발 길이(cm)를 뒤꿈치에서 가장 긴 발가락까지, 선 채로 잽니다. 저녁에 실제 신을 양말로 재세요.',
    measureShoesFemale: '남성과 동일: 뒤꿈치에서 가장 긴 발가락까지(cm).',
    noteShoesMale:
      '중간 사이즈는 스니커/막힌 신발이 한 치수 위. 발 얇으면 슬리퍼는 그대로. 발 넓거나 발등 높거나 두꺼운 양말은 한 치수 업.',
    noteShoesFemale:
      '힐·뾰족코·꼭 끼는 부츠는 중간이면 한 치수 업. 얇은 스트랩은 발 얇으면 그대로, 발 넓거나 발등 높으면 한 치수 업.',
    measureApparelMale: '줄자로 가슴·어깨·허리·엉덩이를 재고 가장 가까운 cm 구간을 고르세요.',
    measureApparelFemale: '가슴·허리·엉덩이(cm)를 재고 가장 가까운 사이즈를 고르세요.',
    hwMaleTitle: '키·몸무게 참고 (남성)',
    hwMaleLead: '줄자가 없을 때 사용. 어깨가 넓거나 허리가 크면 위 cm 표를 우선하고 한 치수 업.',
    hwFemaleTitle: '키·몸무게 참고 (여성)',
    hwFemaleLead: '온라인 구매 빠른 참고. 같은 키라도 가슴/허리/엉덩이 차이가 크면 cm 표를 우선하세요.',
    noteApparelMale: '오버사이즈는 한 치수 다운 가능. 슬림하거나 허리가 크면 한 치수 업.',
    noteApparelFemale: '핏 원피스는 어깨·가슴·허리, 바지/스커트는 허리와 엉덩이. 오버사이즈는 한 치수 다운 가능.',
    shoeCm: '발 길이 (cm)',
    shoeMaleSize: '남성 신발 사이즈 (EU/VN)',
    shoeFemaleSize: '여성 신발 사이즈 (EU/VN)',
    shoeKidSize: '깔창 표기 (유아 / 초등)',
    sizeCol: '사이즈',
    chest: '가슴 (cm)',
    shoulder: '어깨 (cm)',
    waist: '허리 (cm)',
    hip: '엉덩이 (cm)',
    height: '키 (cm)',
    weight: '몸무게 (kg)',
    ageCol: '나이 (참고)',
    asianSize: '아시아 사이즈 (흔함)',
    braUnderbust: '밑가슴 둘레 (갈비뼈, cm)',
    braBand: '흔한 밴드 사이즈',
    measureKids: '베트남 매장에서 흔한 참고입니다(브랜드마다 다를 수 있음):',
    noteKids: '아이는 빨리 자랍니다. 택의 나이보다 키·몸무게를 맞추세요.',
    noteKidsShoesLink: '아동 신발은 발 길이(cm): «아동 신발»을 보세요.',
    measureKidsShoes:
      '매년 발이 커지므로 새 신을 살 때마다 발 길이(뒤꿈치→가장 긴 발가락)를 다시 재세요. 두 발로 서고, 저녁에 재며, 앞코에 약 0.3–0.5cm 여유(타이트 표기가 아니면).',
    noteKidsShoes: '위 표는 흔한 깔창 표기 환산입니다. 스니커는 한 치수 차이 날 수 있으니 상품 표를 우선하세요.',
    noteKidsShoesGrow: '이 표를 넘으면 발 길이를 재고 여성 작은 사이즈(보통 35+) 상품 표와 맞추세요.',
    measureUnderwear: '평소 허리(cm)와 엉덩이 가장 넓은 곳을 재고 각 상품 표와 비교. 중간이면 여유 있는 쪽. 허리를 조이지 마세요.',
    noteUnderwear: '브라는 «여성 브라»의 밴드+컵을 보세요.',
    sizeVnCol: '베트남 사이즈',
    hipBoxer: '엉덩이 (cm)',
    measureBoxer:
      '속옷 허리단에서 허리(편하고 조이지 않게)와 엉덩이 가장 넓은 곳을 재세요. 베트남 문자 사이즈(S–3XL)를 쓰고 미국 허리 숫자 28–38은 쓰지 마세요. 편한 사이즈를 — 신축 원단은 입으면 더 밀착됩니다.',
    noteBoxer:
      '허벅지를 감싸는 드로즈는 허리가 구간에 있어도 허벅지가 굵으면 한 치수 업. 삼각 브리프는 같은 허리 표. 중간이면 여유 있는 쪽. 허리밴드를 늘리지 마세요.',
    measureBra:
      '1단계 밑가슴: 갈비뼈를 따라 너무 조이지 않게 수평으로. 2단계 가슴 가장 볼록한 곳(보통 유두)을 조이지 않고 잽니다.',
    measureBraBand: '흔한 밴드(70, 75, 80…)와 밑가슴 대략 대응(브랜드는 1사이즈 차이날 수 있음):',
    measureBraCup: '컵(A/B/C…)은 윗가슴에서 밑가슴을 뺀 값(cm) 대략:',
    braCupItems: [
      '< 10cm: AA 또는 작은 A인 경우가 많음',
      '≈10–13cm: 보통 A–B',
      '≈13–15cm: 보통 C',
      '> 15cm 또는 볼륨 많음: D 이상 — 각 상품 표를 우선.',
    ],
    noteBra: '일부 브랜드는 «75B»처럼 한 코드. S/M/L만 있으면 상품 페이지 cm 표를 우선하세요.',
    measureMaternity: '가슴·배(cm), 키, 임신/산후 단계를 우선. 신축 소재와 편안한 핏이 좋습니다.',
    noteMaternity: '배가 표를 넘으면 한 치수 업 또는 배에 여유가 있는 스타일.',
    measureSports: '의류는 가슴·허리·엉덩이(cm). 장갑·모자·보호대는 손·머리·스트랩 길이를 상품 설명에서 확인.',
    hwSportsLead: '남성 의류와 같은 방식. 신축 스포츠웨어는 사이즈가 겹칠 수 있으니 SKU 표를 우선.',
    noteSports: '밀착 신축 제품은 어깨가 넓거나 팔이 길면 한 치수 업이 필요할 수 있습니다.',
    measureHeels:
      '발 길이(cm)는 플랫과 같습니다. 힐·뾰족코는 발목과 발가락이 더 밀착됩니다. 발 넓거나 발등 높거나 힐에 익숙하지 않으면 한 치수 업.',
    measureWedding: '파티 슈즈는 오래 신습니다. 굽이 안정적인 것을. 같은 브랜드 플랫 사이즈와 입구 너비도 참고.',
    noteHeels:
      '굽 높이(cm)는 앞발로 무게를 옮깁니다. 뾰족코는 여유가 있어야 합니다. 얇은 스트랩은 발 얇으면 그대로, 넓으면 한 치수 업. 각 상품 표를 우선하세요.',
  },
}

export function partnerSizeGuideCopy(locale: WebLocale): PartnerSizeGuideCopy {
  return COPY[locale] || COPY.en
}

export function partnerSizeGuideKindTitle(kind: PartnerSizeGuideKind, locale: WebLocale): string {
  return partnerSizeGuideCopy(locale).cardTitle[kind]
}

export function partnerSizeGuidePageTitle(kind: PartnerSizeGuideKind | null, locale: WebLocale, shopName?: string | null): string {
  const copy = partnerSizeGuideCopy(locale)
  const shop = String(shopName || '').trim()
  const base = kind ? `${copy.heading[kind]} — ${copy.cardTitle[kind]}` : copy.indexTitle
  return shop ? `${shop} — ${base}` : base
}

export function partnerSizeGuideKindPathTail(kind: PartnerSizeGuideKind | string | null | undefined): string {
  return String(kind || '')
    .split('/')
    .map((s) => normalizePartnerSizeGuideSegment(s))
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
    .join('/')
}

export function normalizePartnerSizeGuideSegment(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/%2f/gi, '/')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
}

export function isPartnerSizeGuideKind(value: string | null | undefined): value is PartnerSizeGuideKind {
  const parsed = parsePartnerSizeGuideKind(value)
  return parsed != null
}

export function parsePartnerSizeGuideKind(raw: string | null | undefined): PartnerSizeGuideKind | null {
  const n = normalizePartnerSizeGuideSegment(raw)
  if (!n) return null
  if (KIND_ALIASES[n]) return KIND_ALIASES[n]
  if (KIND_SET.has(n)) return n as PartnerSizeGuideKind
  return null
}

function slugifyLabel(raw: string): string {
  return normalizePartnerSizeGuideSegment(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function joinGuideLabels(...parts: unknown[]): string {
  return parts
    .map((p) => String(p ?? '').trim())
    .filter(Boolean)
    .join(' | ')
}

function blobMatches(blob: string, keys: readonly string[]): boolean {
  const raw = ` ${blob.toLowerCase()} `
  const slug = ` ${slugifyLabel(blob)} `
  return keys.some((k) => {
    const needle = k.toLowerCase()
    if (raw.includes(needle)) return true
    const s = slugifyLabel(k)
    return s ? slug.includes(` ${s} `) || slug.includes(`/${s}/`) || slug.includes(`-${s}-`) || slug.includes(` ${s}/`) || slug.endsWith(` ${s} `) : false
  })
}

const KIDS_KEYS = [
  'trẻ em',
  'tre em',
  'bé trai',
  'be trai',
  'bé gái',
  'be gai',
  'kids',
  'kid ',
  'toddler',
  'children',
  'nhí',
  'học sinh nhỏ',
  '童',
  'キッズ',
  '아동',
]
const KIDS_SHOE_KEYS = ['giày dép trẻ', 'giay dep tre', 'giày trẻ', 'giay tre', 'dép trẻ', 'dep tre', 'kids shoe', 'kid shoe']
const BRA_KEYS = ['áo ngực', 'ao nguc', 'áo lót ngực', 'bralette', 'bra-ao-nguc', '文胸', 'ブラ', '브라']
const BOXER_KEYS = [
  'boxer',
  'boxer brief',
  'quần lót boxer',
  'quan lot boxer',
  'sịp đùi',
  'sip dui',
  'quần sịp đùi',
  'quan sip dui',
  '平角',
  'ボクサー',
  '드로즈',
]
const HEEL_KEYS = ['cao gót', 'cao got', 'stiletto', 'high heel', 'high-heel', 'kitten heel', 'giày gót', 'giay got']
const WEDDING_SHOE_KEYS = [
  'giày cưới',
  'giay cuoi',
  'cưới & dự tiệc',
  'cuoi du tiec',
  'dự tiệc',
  'du tiec',
  'wedding shoe',
  'bridal shoe',
  'party shoe',
]
const UNDERWEAR_KEYS = [
  'đồ lót',
  'do lot',
  'quần lót',
  'quan lot',
  'áo lót',
  'ao lot',
  'underwear',
  'panty',
  'panties',
  'brief',
  'boxer',
  'quần sịp',
  'quan sip',
  '内衣',
  'アンダー',
  '속옷',
]
const MATERNITY_KEYS = [
  'bầu',
  'bau ',
  'maternity',
  'pregnant',
  'sau sinh',
  'hậu sản',
  'hau san',
  'nursing',
  '孕妇',
  'マタニ',
  '임부',
]
const SPORTS_KEYS = [
  'thể thao',
  'the thao',
  'dã ngoại',
  'da ngoai',
  'gym',
  'yoga',
  'outdoor',
  'sports',
  '运动',
  'スポーツ',
  '스포츠',
]

function looksLikeBra(blob: string): boolean {
  const raw = ` ${blob.toLowerCase()} `
  if (/\bbra\b/.test(raw) && !raw.includes('bracelet')) return true
  return blobMatches(blob, BRA_KEYS)
}

function remapApparelKindIfShoes(
  kind: PartnerSizeGuideKind,
  role: ReturnType<typeof inferOutfitRole>,
  female: boolean,
  male: boolean
): PartnerSizeGuideKind {
  if (role !== 'shoes') return kind
  if (kind === 'thoi-trang-tre-em' || kind === 'thoi-trang-tre-em/giay-dep-tre-em') {
    return 'thoi-trang-tre-em/giay-dep-tre-em'
  }
  if (
    kind === 'thoi-trang-nam' ||
    kind === 'thoi-trang-nu' ||
    kind === 'the-thao-da-ngoai' ||
    kind === 'trang-phuc-bau-hau-san'
  ) {
    if (female) return 'giay-dep-nu'
    if (male) return 'giay-dep-nam'
  }
  return kind
}

/**
 * Map PDP / listing category → a size chart kind.
 * Bags / accessories / unknown → null (index page, no single table).
 */
export function resolvePartnerSizeGuideKind(input: {
  categoryPath?: string | null
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  name?: string | null
}): PartnerSizeGuideKind | null {
  const pathSegs = String(input.categoryPath || '')
    .split('/')
    .map((s) => normalizePartnerSizeGuideSegment(s))
    .filter(Boolean)
  for (let i = 0; i < pathSegs.length - 1; i += 1) {
    const pair = parsePartnerSizeGuideKind(`${pathSegs[i]}/${pathSegs[i + 1]}`)
    if (pair && pair.includes('/')) return pair
  }

  const l1s = slugifyLabel(String(input.categoryL1 || ''))
  const l2s = slugifyLabel(String(input.categoryL2 || ''))
  if (l1s && l2s) {
    const pair = parsePartnerSizeGuideKind(`${l1s}/${l2s}`)
    if (pair && pair.includes('/')) return pair
  }

  const blob = joinGuideLabels(input.categoryPath, input.categoryL1, input.categoryL2, input.categoryL3, input.name)
  const role = inferOutfitRole(blob)
  if (role === 'bag' || role === 'accessory') {
    // Category L1 may still be a real size group (e.g. mis-tagged). Prefer explicit L1 below.
  }
  const gender = inferOutfitGender(blob)
  const female = gender === 'female'
  const male = gender === 'male'
  const kids = blobMatches(blob, KIDS_KEYS)

  if (looksLikeBra(blob)) return 'do-lot-nu/bra-ao-nguc-nu'
  if (blobMatches(blob, BOXER_KEYS)) return 'do-lot-nam/quan-lot-boxer-brief-nam'
  if (blobMatches(blob, KIDS_SHOE_KEYS) || (kids && role === 'shoes')) {
    return 'thoi-trang-tre-em/giay-dep-tre-em'
  }
  if (blobMatches(blob, WEDDING_SHOE_KEYS) && (role === 'shoes' || /giay|giày|shoe|靴|신발/.test(blob.toLowerCase()))) {
    return 'giay-dep-nu/giay-cuoi-du-tiec-nu'
  }
  if (blobMatches(blob, HEEL_KEYS) && role !== 'bag') {
    return 'giay-dep-nu/giay-cao-got-nu'
  }

  for (const seg of pathSegs) {
    const hit = parsePartnerSizeGuideKind(seg)
    if (hit) return remapApparelKindIfShoes(hit, role, female, male)
  }
  const labels = [input.categoryL1, input.categoryL2, input.categoryL3]
  for (const label of labels) {
    const hit = parsePartnerSizeGuideKind(slugifyLabel(String(label || '')))
    if (hit) return remapApparelKindIfShoes(hit, role, female, male)
  }

  if (kids) {
    if (role === 'shoes') return 'thoi-trang-tre-em/giay-dep-tre-em'
    return 'thoi-trang-tre-em'
  }
  if (blobMatches(blob, MATERNITY_KEYS)) return 'trang-phuc-bau-hau-san'
  if (blobMatches(blob, UNDERWEAR_KEYS)) {
    if (male) return 'do-lot-nam'
    return 'do-lot-nu'
  }
  if (blobMatches(blob, SPORTS_KEYS) && role !== 'shoes') return 'the-thao-da-ngoai'

  if (role === 'bag' || role === 'accessory') return null

  if (role === 'shoes') {
    if (female) return 'giay-dep-nu'
    if (male) return 'giay-dep-nam'
    return null
  }
  if (role === 'top' || role === 'bottom' || role === 'dress') {
    if (female) return 'thoi-trang-nu'
    if (male) return 'thoi-trang-nam'
    if (role === 'dress') return 'thoi-trang-nu'
    return null
  }
  return null
}

export function partnerHasProductSizes(sizes: unknown): boolean {
  if (!Array.isArray(sizes)) return false
  return sizes.some((s) => String(s || '').trim())
}
