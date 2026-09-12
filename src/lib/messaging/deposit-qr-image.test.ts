import assert from 'node:assert/strict'
import test from 'node:test'
import { depositQrDownloadFilename, isAllowedDepositQrImageUrl } from '@/lib/messaging/deposit-qr-image'

test('allows SePay and VietQR https QR hosts', () => {
  assert.equal(
    isAllowedDepositQrImageUrl('https://qr.sepay.vn/img?acc=1&bank=VCB&amount=1&des=SEVQR%20DH1'),
    true
  )
  assert.equal(
    isAllowedDepositQrImageUrl('https://img.vietqr.io/image/VCB-123-compact2.png?amount=1'),
    true
  )
})

test('rejects open-then-preview traps and private URLs', () => {
  assert.equal(isAllowedDepositQrImageUrl('http://qr.sepay.vn/img'), false)
  assert.equal(isAllowedDepositQrImageUrl('https://127.0.0.1/qr.png'), false)
  assert.equal(isAllowedDepositQrImageUrl('https://192.168.1.8/qr.png'), false)
  assert.equal(isAllowedDepositQrImageUrl('https://10.0.0.8/qr.png'), false)
  assert.equal(isAllowedDepositQrImageUrl('javascript:alert(1)'), false)
})

test('allows https CDN hostnames used for ewallet QR', () => {
  assert.equal(isAllowedDepositQrImageUrl('https://cdn.example.com/uploads/ewallet-qr.png'), true)
})

test('sanitizes QR download filename', () => {
  assert.equal(depositQrDownloadFilename('188COMVN01'), 'qr-chuyen-khoan-188COMVN01.png')
  assert.equal(depositQrDownloadFilename('DH 01/a'), 'qr-chuyen-khoan-DH_01_a.png')
})
