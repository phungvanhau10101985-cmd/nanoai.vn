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
 * Map bank_id (SePay format) sang VietQR appId để mở app ngân hàng trực tiếp.
 * VietQR dl.vietqr.io mở app; SePay qr.sepay.vn/dl chỉ mở trang web.
 * Nguồn: https://api.vietqr.io/v2/ios-app-deeplinks
 */
const BANK_TO_VIETQR_APP: Record<string, string> = {
  VietinBank: 'icb',
  VTB: 'icb',
  ICB: 'icb',
  Vietcombank: 'vcb',
  VCB: 'vcb',
  MBBank: 'mb',
  MB: 'mb',
  ACB: 'acb',
  VPBank: 'vpb',
  VPB: 'vpb',
  BIDV: 'bidv',
  Techcombank: 'tcb',
  TCB: 'tcb',
  TPBank: 'tpb',
  TPB: 'tpb',
  OCB: 'ocb',
  Agribank: 'vba',
  VBA: 'vba',
  HDBank: 'hdb',
  HDB: 'hdb',
  VIB: 'vib',
  SHB: 'shb',
  Sacombank: 'scb',
  SCB: 'scb',
  LienVietPostBank: 'lpb',
  LPB: 'lpb',
  SeABank: 'seab',
  VietCapitalBank: 'timo',
  Timo: 'timo',
}

/**
 * Tạo link mở app ngân hàng với autofill (số TK, tiền, nội dung).
 * VietQR format: https://dl.vietqr.io/pay?app=icb&ba=107000958284@icb&am=60000&tn=SEVQR+DH123&bn=Ten+Chu+TK
 * Autofill hỗ trợ: BIDV, ACB, OCB, VietinBank (icb)... Một số app khác có thể chưa hỗ trợ.
 */
export function buildSePayDeeplink(
  acc: string,
  bank: string,
  amount: number,
  des: string,
  accountHolderName?: string
): string {
  const key = bank.trim()
  const appId = BANK_TO_VIETQR_APP[key] ?? BANK_TO_VIETQR_APP[key.replace(/\s+/g, '')]
  if (appId) {
    const params = new URLSearchParams()
    params.set('app', appId)
    params.set('ba', `${acc}@${appId}`)
    params.set('am', String(amount))
    params.set('tn', des)
    if (accountHolderName?.trim()) {
      params.set('bn', accountHolderName.trim())
    }
    return `https://dl.vietqr.io/pay?${params.toString()}`
  }
  const url = new URL('https://qr.sepay.vn/dl')
  url.searchParams.set('acc', acc)
  url.searchParams.set('bank', bank)
  url.searchParams.set('amount', String(amount))
  url.searchParams.set('des', des)
  return url.toString()
}
