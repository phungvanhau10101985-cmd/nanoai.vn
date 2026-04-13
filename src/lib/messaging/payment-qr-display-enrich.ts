/**
 * Bổ sung STK / chủ TK / tên NH từ URL ảnh QR (VietQR / SePay) khi payload thiếu
 * nhưng ảnh QR vẫn chứa đủ thông tin.
 */

export type PaymentBankDisplay = {
  bank_name: string
  account_number: string
  account_holder: string
}

function bankLabelFromVietQrBin(bin: string): string {
  const b = bin.trim()
  const map: Record<string, string> = {
    '970436': 'Vietcombank',
    '970415': 'VietinBank',
    '970418': 'BIDV',
    '970405': 'Agribank',
    '970416': 'ACB',
    '970423': 'TPBank',
    '970407': 'Techcombank',
    '970422': 'MB Bank',
    '970432': 'VPBank',
    '970403': 'Sacombank',
    '970437': 'HDBank',
    '970440': 'SeABank',
    '970443': 'SHB',
    '970448': 'OCB',
  }
  return map[b] ?? `Ngân hàng (BIN ${b})`
}

export function enrichPaymentDisplayFromQrUrl(qrUrl: string, base: PaymentBankDisplay): PaymentBankDisplay {
  let bank_name = base.bank_name.trim()
  let account_number = base.account_number.trim()
  let account_holder = base.account_holder.trim()

  const raw = String(qrUrl ?? '').trim()
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return { bank_name, account_number, account_holder }
  }

  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    if (host === 'img.vietqr.io') {
      const nm = u.searchParams.get('accountName')
      if (nm?.trim() && !account_holder) {
        account_holder = nm.replace(/\+/g, ' ').trim()
      }
      const pathSeg = u.pathname.replace(/^\/image\//, '')
      const m = pathSeg.match(/^(.+)-(.+)-(compact2|compact)\.png$/i)
      if (m) {
        const binPart = decodeURIComponent(m[1]).trim()
        const accPart = decodeURIComponent(m[2]).trim()
        if (!account_number && accPart) account_number = accPart
        if (!bank_name && binPart) bank_name = bankLabelFromVietQrBin(binPart)
      }
    }

    if (host === 'qr.sepay.vn') {
      const acc = u.searchParams.get('acc')
      const bank = u.searchParams.get('bank')
      if (acc?.trim() && !account_number) account_number = acc.trim()
      if (bank?.trim() && !bank_name) bank_name = bank.trim()
    }
  } catch {
    /* ignore */
  }

  return { bank_name, account_number, account_holder }
}
