import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSePayDeeplink,
  buildVietQrAppPayUrl,
  buildVietQrPayload,
  resolveBeneficiaryBin,
  resolveQrPayTransfer,
} from '@/lib/sepay-qr'

test('resolves SePay bank codes to NAPAS BIN', () => {
  assert.equal(resolveBeneficiaryBin('MB'), '970422')
  assert.equal(resolveBeneficiaryBin('Vietcombank'), '970436')
  assert.equal(resolveBeneficiaryBin('970407'), '970407')
  assert.equal(resolveBeneficiaryBin(''), null)
})

test('reads transfer fields from a SePay QR image URL', () => {
  const transfer = resolveQrPayTransfer({
    qrUrl: 'https://qr.sepay.vn/img?acc=0123456789&bank=VCB&amount=149000&des=SEVQR%20DH0001',
  })
  assert.ok(transfer)
  assert.equal(transfer.accountNumber, '0123456789')
  assert.equal(transfer.bin, '970436')
  assert.equal(transfer.amount, 149000)
  assert.equal(transfer.description, 'SEVQR DH0001')
})

test('builds a VietQR payload banks already accept', () => {
  const payload = buildVietQrPayload({
    accountNumber: '257678859',
    bin: '970416',
    amount: 1000,
    description: 'Chuyen tien',
    accountName: '',
  })
  assert.equal(
    payload,
    '00020101021238530010A0000007270123000697041601092576788590208QRIBFTTA5303704540410005802VN62150811Chuyen tien6304BBB8',
  )
})

test('opens the payer app with the QR payload, not an empty app launch', () => {
  const transfer = resolveQrPayTransfer({
    accountNumber: '0123456789',
    bankCode: 'TCB',
    amount: 60000,
    description: 'SEVQR DH1',
    accountName: 'NANOAI',
  })
  assert.ok(transfer)
  const url = buildVietQrAppPayUrl('mb', transfer, 'android')
  assert.ok(url)
  assert.match(url, /^intent:\/\/applink\?targetPage=QRPay&qrContent=000201/)
  assert.match(url, /scheme=mbbank;package=com\.mbmobile;end$/)
  const payload = decodeURIComponent(url.slice(url.indexOf('qrContent=') + 10, url.indexOf('#Intent')))
  assert.match(payload, /970407/)
  assert.match(payload, /0123456789/)
  assert.match(payload, /60000/)
  assert.match(payload, /SEVQR DH1/)
  assert.equal(buildVietQrAppPayUrl('vcb', transfer), null)
})

test('a display name that is not a bank code still uses the QR bank', () => {
  const transfer = resolveQrPayTransfer({
    qrUrl: 'https://qr.sepay.vn/img?acc=99887766&bank=MB&amount=10000&des=SEVQR%20DH9',
    bankCode: 'Ngân hàng TMCP Quân đội',
  })
  assert.ok(transfer)
  assert.equal(transfer.bin, '970422')
  assert.equal(transfer.accountNumber, '99887766')
})

test('receiving-bank deeplink carries the QR when that app accepts it', () => {
  const url = buildSePayDeeplink('107000958284', 'MB', 60000, 'SEVQR DH123', 'Nano AI')
  assert.match(url, /^mbbank:\/\/applink\?targetPage=QRPay&qrContent=/)
  const payload = decodeURIComponent(new URL(url).searchParams.get('qrContent') || '')
  assert.match(payload, /970422/)
  assert.match(payload, /107000958284/)
})

test('a bank without a QR link falls back to the SePay QR image', () => {
  const url = buildSePayDeeplink('107000958284', 'VCB', 60000, 'SEVQR DH123', 'Nano AI')
  const u = new URL(url)
  assert.equal(u.hostname, 'qr.sepay.vn')
  assert.equal(u.searchParams.get('bank'), 'VCB')
  assert.equal(u.searchParams.get('acc'), '107000958284')
})
