/**
 * SePay QR & Deeplink utilities
 * Tài liệu: https://qr.sepay.vn/img?acc=SO_TAI_KHOAN&bank=NGAN_HANG&amount=SO_TIEN&des=NOI_DUNG&template=TEMPLATE&download=DOWNLOAD
 *
 * acc: Số tài khoản (bắt buộc)
 * bank: Code ngân hàng hoặc Short_name (bắt buộc)
 * amount: Số tiền
 * des: Nội dung chuyển khoản
 * template: (tùy chọn) '' | 'compact' | 'qronly'
 * download: (tùy chọn) 'true' để tải về
 */

export type SePayTemplate = '' | 'compact' | 'qronly'

export interface SePayQrOptions {
  acc: string
  bank: string
  amount: number
  des: string
  template?: SePayTemplate
  download?: boolean
}

/**
 * Tạo link ảnh QR SePay để nhúng hoặc hiển thị
 * <img src='https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...'/>
 */
export function buildSePayQrImgUrl(options: SePayQrOptions): string {
  const url = new URL('https://qr.sepay.vn/img')
  url.searchParams.set('acc', options.acc)
  url.searchParams.set('bank', options.bank)
  url.searchParams.set('amount', String(options.amount))
  url.searchParams.set('des', options.des)
  if (options.template) url.searchParams.set('template', options.template)
  if (options.download) url.searchParams.set('download', 'true')
  return url.toString()
}

/**
 * URL hiển thị QR (đã có sẵn trên đơn) → thêm `download=true` để SePay trả ảnh dạng tải về khi bấm.
 */
export function sepayQrUrlForDownload(displayUrl: string): string {
  try {
    const u = new URL(displayUrl.trim())
    if (u.hostname !== 'qr.sepay.vn') return displayUrl.trim()
    u.searchParams.set('download', 'true')
    return u.toString()
  } catch {
    return displayUrl.trim()
  }
}

/**
 * Map mã ngân hàng nhận (SePay / VietQR) sang BIN NAPAS.
 * `ba` trên dl.vietqr.io là `{stk}@{bin ngân hàng thụ hưởng}`, không phải mã app người chuyển.
 */
const BANK_BIN_BY_KEY: Record<string, string> = {
  ICB: '970415',
  VIETINBANK: '970415',
  VTB: '970415',
  CTG: '970415',
  VCB: '970436',
  VIETCOMBANK: '970436',
  BIDV: '970418',
  VBA: '970405',
  AGRIBANK: '970405',
  OCB: '970448',
  MB: '970422',
  MBBANK: '970422',
  MBB: '970422',
  TCB: '970407',
  TECHCOMBANK: '970407',
  ACB: '970416',
  VPB: '970432',
  VPBANK: '970432',
  TPB: '970423',
  TPBANK: '970423',
  STB: '970403',
  SACOMBANK: '970403',
  HDB: '970437',
  HDBANK: '970437',
  VCCB: '970454',
  VIETCAPITALBANK: '970454',
  SCB: '970429',
  VIB: '970441',
  MYVIB: '970441',
  SHB: '970443',
  EIB: '970431',
  EXIMBANK: '970431',
  MSB: '970426',
  CAKE: '546034',
  TIMO: '963388',
  SGICB: '970400',
  SAIGONBANK: '970400',
  PVCB: '970412',
  PVCOMBANK: '970412',
  NCB: '970419',
  ABB: '970425',
  ABBANK: '970425',
  SEAB: '970440',
  SEABANK: '970440',
  LPB: '970449',
  LPBANK: '970449',
  LIENVIETPOSTBANK: '970449',
  MOMO: '971025',
}

/**
 * Map bank_id (SePay) sang appId VietQR của chính ngân hàng đó.
 * Nguồn: https://api.vietqr.io/v2/ios-app-deeplinks
 */
const BANK_TO_VIETQR_APP: Record<string, string> = {
  ICB: 'icb',
  VIETINBANK: 'icb',
  VTB: 'icb',
  VCB: 'vcb',
  VIETCOMBANK: 'vcb',
  MB: 'mb',
  MBBANK: 'mb',
  ACB: 'acb',
  VPB: 'vpb',
  VPBANK: 'vpb',
  BIDV: 'bidv',
  TCB: 'tcb',
  TECHCOMBANK: 'tcb',
  TPB: 'tpb',
  TPBANK: 'tpb',
  OCB: 'ocb',
  VBA: 'vba',
  AGRIBANK: 'vba',
  HDB: 'hdb',
  HDBANK: 'hdb',
  VIB: 'vib-2',
  SHB: 'shb',
  STB: 'scb',
  SACOMBANK: 'scb',
  SCB: 'scb',
  LPB: 'lpb',
  LPBANK: 'lpb',
  LIENVIETPOSTBANK: 'lpb',
  SEAB: 'seab',
  SEABANK: 'seab',
  TIMO: 'timo',
  VIETCAPITALBANK: 'timo',
}

export type QrPayPlatform = 'android' | 'ios' | 'other'

/**
 * App nhận chuỗi QR qua `scheme://path?targetPage=QRPay&qrContent=`.
 * Vietcombank và Agribank không có link công khai kèm mã — khách quét ảnh QR.
 */
export const QR_PAY_OPEN_APPS: ReadonlyArray<{
  appId: string
  name: string
  iconId?: string
  scheme: string
  path: string
  androidPackage: string
}> = [
  { appId: 'tcb', name: 'Techcombank', scheme: 'tcb', path: 'applink', androidPackage: 'vn.com.techcombank.bb.app' },
  { appId: 'mb', name: 'MB Bank', scheme: 'mbbank', path: 'applink', androidPackage: 'com.mbmobile' },
  { appId: 'bidv', name: 'BIDV', scheme: 'dl.bidvsmartbanking.vn', path: 'applink', androidPackage: 'com.vnpay.bidv' },
  { appId: 'acb', name: 'ACB ONE', scheme: 'acbone', path: 'applink', androidPackage: 'mobile.acb.com.vn' },
  { appId: 'icb', name: 'VietinBank', scheme: 'vietinbankipay', path: 'host.qrTransfer', androidPackage: 'com.vietinbank.ipay' },
  { appId: 'vpb', name: 'VPBank', scheme: 'vpbankneo', path: 'applink', androidPackage: 'com.vnpay.vpbankonline' },
  { appId: 'tpb', name: 'TPBank', scheme: 'hydro', path: 'applink', androidPackage: 'com.tpb.mb.gprsandroid' },
  { appId: 'ocb', name: 'OCB', scheme: 'newomni-app', path: 'applink', androidPackage: 'vn.com.ocb.awe' },
  { appId: 'hdb', name: 'HDBank', scheme: 'hdbankmobile', path: 'applink', androidPackage: 'com.vnpay.hdbank' },
  { appId: 'stb', name: 'Sacombank', scheme: 'sacombankpay', path: 'applink', androidPackage: 'com.sacombank.ewallet' },
  { appId: 'vib', name: 'VIB', iconId: 'vib-2', scheme: 'myvib2', path: 'applink', androidPackage: 'com.vib.myvib2' },
  { appId: 'shb', name: 'SHB', scheme: 'saha', path: 'applink', androidPackage: 'vn.shb.saha.mbanking' },
  { appId: 'msb', name: 'MSB', scheme: 'msbdigibank', path: 'applink', androidPackage: 'vn.com.msb.smartBanking' },
  { appId: 'seab', name: 'SeABank', scheme: 'seamobile', path: 'applink', androidPackage: 'vn.com.seabank.mb1' },
  { appId: 'eib', name: 'Eximbank', scheme: 'eximbankomnimobile', path: 'applink', androidPackage: 'com.vnpay.EximBankOmni' },
  { appId: 'lpb', name: 'LPBank', scheme: 'lv24h', path: 'applink', androidPackage: 'vn.com.lpbank.digibank' },
  { appId: 'cake', name: 'CAKE', scheme: 'cake.vn', path: 'applink', androidPackage: 'xyz.be.cake' },
  { appId: 'timo', name: 'Timo', scheme: 'timo', path: 'applink', androidPackage: 'io.lifestyle.plus' },
  { appId: 'pvcb', name: 'PVcomBank', scheme: 'pvcapp', path: 'applink', androidPackage: 'com.pvcombank.retail' },
  { appId: 'abb', name: 'ABBank', scheme: 'vn.abbank.retail', path: 'applink', androidPackage: 'vn.abbank.retail' },
]

export function vietQrBankAppIconUrl(appId: string): string {
  return `https://cdn.vietqr.io/bank-app-icon/${appId}-android.webp`
}

export function detectQrPayPlatform(userAgent: string | null | undefined): QrPayPlatform {
  const ua = userAgent || ''
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  return 'other'
}

function tlv(id: string, value: string): string {
  return `${id}${String(Array.from(value).length).padStart(2, '0')}${value}`
}

function crc16CcittFalse(text: string): string {
  let crc = 0xffff
  for (let i = 0; i < text.length; i += 1) {
    crc ^= text.charCodeAt(i) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Chuỗi EMV VietQR: BIN nhận, STK, số tiền, nội dung. */
export function buildVietQrPayload(transfer: QrPayTransfer): string | null {
  const bin = transfer.bin
  const account = transfer.accountNumber.replace(/\s/g, '')
  const amount = Math.round(transfer.amount)
  const note = transfer.description.trim().slice(0, 50)
  if (!/^\d{6}$/.test(bin)) return null
  if (!/^[A-Za-z0-9]{1,19}$/.test(account)) return null
  if (!Number.isSafeInteger(amount) || amount <= 0 || String(amount).length > 13) return null
  const merchant =
    tlv('00', 'A000000727') +
    tlv('01', tlv('00', bin) + tlv('01', account)) +
    tlv('02', 'QRIBFTTA')
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('38', merchant) +
    tlv('53', '704') +
    tlv('54', String(amount)) +
    tlv('58', 'VN') +
    (note ? tlv('62', tlv('08', note)) : '') +
    '6304'
  return body + crc16CcittFalse(body)
}

function bankLookupKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** BIN NAPAS của ngân hàng thụ hưởng. Nhận mã SePay (`MB`), tên (`Vietcombank`) hoặc BIN 6 số. */
export function resolveBeneficiaryBin(bank: string): string | null {
  const key = bankLookupKey(bank)
  if (!key) return null
  if (/^\d{6}$/.test(key)) return key
  return BANK_BIN_BY_KEY[key] ?? null
}

export type QrPayTransfer = {
  accountNumber: string
  bin: string
  amount: number
  description: string
  accountName: string
}

function readAmount(raw: string | null | undefined): number {
  const n = Math.round(Number(String(raw ?? '').replace(/[^\d.]/g, '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Đọc STK, ngân hàng nhận, số tiền, nội dung từ URL ảnh QR SePay hoặc VietQR. */
export function parseQrPayTransferFromUrl(qrUrl: string): Partial<QrPayTransfer> & { bankCode?: string } {
  const raw = String(qrUrl ?? '').trim()
  if (!raw || !/^https?:\/\//i.test(raw)) return {}
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host === 'qr.sepay.vn') {
      return {
        accountNumber: (u.searchParams.get('acc') || '').trim(),
        bankCode: (u.searchParams.get('bank') || '').trim(),
        amount: readAmount(u.searchParams.get('amount')),
        description: (u.searchParams.get('des') || '').trim(),
        accountName: (u.searchParams.get('accountName') || '').trim(),
      }
    }
    if (host === 'img.vietqr.io') {
      const pathSeg = u.pathname.replace(/^\/image\//, '')
      const m = pathSeg.match(/^(.+)-(.+)-(compact2|compact|print|qr_only)\.png$/i)
      const bankCode = m ? decodeURIComponent(m[1]).trim() : ''
      const accountNumber = m ? decodeURIComponent(m[2]).trim() : ''
      return {
        accountNumber,
        bankCode,
        amount: readAmount(u.searchParams.get('amount')),
        description: (u.searchParams.get('addInfo') || u.searchParams.get('des') || '').replace(/\+/g, ' ').trim(),
        accountName: (u.searchParams.get('accountName') || '').replace(/\+/g, ' ').trim(),
      }
    }
  } catch {
    return {}
  }
  return {}
}

export function resolveQrPayTransfer(input: {
  qrUrl?: string | null
  accountNumber?: string | null
  bankCode?: string | null
  amount?: number | null
  description?: string | null
  accountName?: string | null
}): QrPayTransfer | null {
  const parsed = input.qrUrl ? parseQrPayTransferFromUrl(input.qrUrl) : {}
  const explicitAccount = String(input.accountNumber || '').replace(/\s+/g, '')
  const parsedAccount = String(parsed.accountNumber || '').replace(/\s+/g, '')
  const accountNumber = /^\d{4,25}$/.test(explicitAccount) ? explicitAccount : parsedAccount
  const bin = resolveBeneficiaryBin(String(input.bankCode || '')) || resolveBeneficiaryBin(String(parsed.bankCode || ''))
  if (!accountNumber || !/^\d{4,25}$/.test(accountNumber) || !bin) return null
  const explicitAmount = input.amount == null ? 0 : readAmount(String(input.amount))
  const amount = explicitAmount > 0 ? explicitAmount : readAmount(String(parsed.amount || 0))
  const description = (String(input.description || '').trim() || String(parsed.description || '').trim()).slice(0, 50)
  const accountName = (String(input.accountName || '').trim() || String(parsed.accountName || '').trim()).slice(0, 50)
  return { accountNumber, bin, amount, description, accountName }
}

/**
 * Link mở app người chuyển kèm đúng chuỗi QR (số TK, số tiền, nội dung).
 * Không dùng dl.vietqr.io: trang đó thường chỉ mở app trống.
 */
export function buildVietQrAppPayUrl(
  appId: string,
  transfer: QrPayTransfer,
  platform: QrPayPlatform = 'other',
): string | null {
  const app = QR_PAY_OPEN_APPS.find((item) => item.appId === appId.trim().toLowerCase())
  const payload = buildVietQrPayload(transfer)
  if (!app || !payload) return null
  const query = `targetPage=QRPay&qrContent=${encodeURIComponent(payload)}`
  if (platform === 'android') {
    return `intent://${app.path}?${query}#Intent;scheme=${app.scheme};package=${app.androidPackage};end`
  }
  return `${app.scheme}://${app.path}?${query}`
}

/**
 * Mở app ngân hàng nhận kèm chuỗi QR khi app đó có link QR Pay.
 * Không có link thì trả về trang QR SePay để quét.
 */
export function buildSePayDeeplink(
  acc: string,
  bank: string,
  amount: number,
  des: string,
  accountHolderName?: string
): string {
  const transfer = resolveQrPayTransfer({
    accountNumber: acc,
    bankCode: bank,
    amount,
    description: des,
    accountName: accountHolderName,
  })
  const appId = BANK_TO_VIETQR_APP[bankLookupKey(bank)]
  if (transfer && appId) {
    const pay = buildVietQrAppPayUrl(appId, transfer)
    if (pay) return pay
  }
  const url = new URL('https://qr.sepay.vn/img')
  url.searchParams.set('acc', acc)
  url.searchParams.set('bank', bank)
  url.searchParams.set('amount', String(amount))
  url.searchParams.set('des', des)
  return url.toString()
}
