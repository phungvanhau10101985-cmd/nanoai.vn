/** 63 tỉnh/thành — dropdown sổ địa chỉ (cùng danh sách 188). Engine dùng chung mọi shop. */
export const VIETNAM_PROVINCES = [
  'An Giang',
  'Bà Rịa - Vũng Tàu',
  'Bạc Liêu',
  'Bắc Giang',
  'Bắc Kạn',
  'Bắc Ninh',
  'Bến Tre',
  'Bình Định',
  'Bình Dương',
  'Bình Phước',
  'Bình Thuận',
  'Cà Mau',
  'Cao Bằng',
  'Đắk Lắk',
  'Đắk Nông',
  'Điện Biên',
  'Đồng Nai',
  'Đồng Tháp',
  'Gia Lai',
  'Hà Giang',
  'Hà Nam',
  'Hà Tĩnh',
  'Hải Dương',
  'Hải Phòng',
  'Hậu Giang',
  'Hòa Bình',
  'Hưng Yên',
  'Khánh Hòa',
  'Kiên Giang',
  'Kon Tum',
  'Lai Châu',
  'Lâm Đồng',
  'Lạng Sơn',
  'Lào Cai',
  'Long An',
  'Nam Định',
  'Nghệ An',
  'Ninh Bình',
  'Ninh Thuận',
  'Phú Thọ',
  'Quảng Bình',
  'Quảng Nam',
  'Quảng Ngãi',
  'Quảng Ninh',
  'Quảng Trị',
  'Sóc Trăng',
  'Sơn La',
  'Tây Ninh',
  'Thái Bình',
  'Thái Nguyên',
  'Thanh Hóa',
  'Thừa Thiên Huế',
  'Tiền Giang',
  'Trà Vinh',
  'Tuyên Quang',
  'Vĩnh Long',
  'Vĩnh Phúc',
  'Yên Bái',
  'Phú Yên',
  'Cần Thơ',
  'Đà Nẵng',
  'Hà Nội',
  'Hồ Chí Minh',
] as const

export type VietnamProvince = (typeof VIETNAM_PROVINCES)[number]

const PROVINCE_SET = new Set<string>(VIETNAM_PROVINCES)

/** Bỏ dấu + gom khoảng trắng để khớp địa chỉ tự do / alias. */
export function normalizeVietnamProvinceKey(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(thanh pho|tp|tinh|province|city)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const PROVINCE_ALIASES: Record<string, VietnamProvince> = {
  hcm: 'Hồ Chí Minh',
  tphcm: 'Hồ Chí Minh',
  sg: 'Hồ Chí Minh',
  saigon: 'Hồ Chí Minh',
  'saigon city': 'Hồ Chí Minh',
  'ho chi minh': 'Hồ Chí Minh',
  'ho chi minh city': 'Hồ Chí Minh',
  hcmc: 'Hồ Chí Minh',
  hn: 'Hà Nội',
  hanoi: 'Hà Nội',
  'ha noi': 'Hà Nội',
  dn: 'Đà Nẵng',
  'da nang': 'Đà Nẵng',
  danang: 'Đà Nẵng',
  'can tho': 'Cần Thơ',
  hue: 'Thừa Thiên Huế',
  'thua thien hue': 'Thừa Thiên Huế',
  brvt: 'Bà Rịa - Vũng Tàu',
  'vung tau': 'Bà Rịa - Vũng Tàu',
  'ba ria vung tau': 'Bà Rịa - Vũng Tàu',
  'dak lak': 'Đắk Lắk',
  daklak: 'Đắk Lắk',
  daclak: 'Đắk Lắk',
  'dak nong': 'Đắk Nông',
  daknong: 'Đắk Nông',
}

function aliasProvince(key: string): VietnamProvince | null {
  const hit = PROVINCE_ALIASES[key]
  return hit || null
}

export function isVietnamProvinceName(raw: string): raw is VietnamProvince {
  return PROVINCE_SET.has(String(raw || '').trim())
}

/** Khớp tên tỉnh chuẩn, alias, hoặc chuỗi nằm trong địa chỉ giao hàng. */
export function matchVietnamProvince(raw: string | null | undefined): VietnamProvince | null {
  const text = String(raw || '').trim()
  if (!text) return null
  if (PROVINCE_SET.has(text)) return text as VietnamProvince
  const key = normalizeVietnamProvinceKey(text)
  if (!key) return null
  const aliased = aliasProvince(key)
  if (aliased) return aliased
  const tokens = key.split(' ').filter(Boolean)
  for (const token of tokens) {
    const hit = aliasProvince(token)
    if (hit) return hit
  }
  for (let n = Math.min(4, tokens.length); n >= 2; n--) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const hit = aliasProvince(tokens.slice(i, i + n).join(' '))
      if (hit) return hit
    }
  }
  for (const name of VIETNAM_PROVINCES) {
    if (normalizeVietnamProvinceKey(name) === key) return name
  }
  let best: VietnamProvince | null = null
  let bestLen = 0
  for (const name of VIETNAM_PROVINCES) {
    const nkey = normalizeVietnamProvinceKey(name)
    if (nkey.length < 4) continue
    if (!key.includes(nkey)) continue
    if (nkey.length > bestLen) {
      best = name
      bestLen = nkey.length
    }
  }
  return best
}
