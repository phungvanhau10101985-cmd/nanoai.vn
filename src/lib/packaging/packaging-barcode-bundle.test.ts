import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPackagingQrPayload,
  normalizeBarcodeDataFields,
  packagingBarcodeIsReady,
} from './packaging-barcode-form'
import {
  inferBarcodeTypeForContent,
  normalizeBarcodeFormEntries,
  normalizeBarcodeFormEntry,
} from './packaging-barcode-bundle'

test('inferBarcodeTypeForContent upgrades URLs to QR when type is code128', () => {
  assert.equal(inferBarcodeTypeForContent('code128', 'https://example.com'), 'qrcode')
  assert.equal(inferBarcodeTypeForContent('qrcode', 'hello'), 'qrcode')
  assert.equal(inferBarcodeTypeForContent('code128', '1234567890123'), 'ean13')
  assert.equal(inferBarcodeTypeForContent('code128', '123456789012'), 'upca')
})

test('normalizeBarcodeFormEntry rejects empty content', () => {
  assert.equal(normalizeBarcodeFormEntry({ content: '   ' }), null)
})

test('buildPackagingQrPayload joins labeled fields for scan display', () => {
  const payload = buildPackagingQrPayload([
    { label: 'Website', content: 'https://brand.example' },
    { label: 'SKU', content: 'SKU-001' },
    { content: 'Made in Vietnam' },
  ])
  assert.match(payload, /Website: https:\/\/brand\.example/)
  assert.match(payload, /SKU: SKU-001/)
  assert.match(payload, /Made in Vietnam/)
})

test('normalizeBarcodeDataFields keeps non-empty rows only', () => {
  const rows = normalizeBarcodeDataFields([
    { label: 'Website', content: 'https://brand.example' },
    { label: 'SKU', content: '' },
    { content: 'Hotline: 1900' },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.label, 'Website')
  assert.equal(rows[1]?.content, 'Hotline: 1900')
})

test('normalizeBarcodeFormEntries still supports legacy typed rows', () => {
  const rows = normalizeBarcodeFormEntries([
    { type: 'qrcode', content: 'https://brand.example' },
    { type: 'code128', content: 'SKU-001', label: 'Product SKU' },
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0]?.type, 'qrcode')
})

test('packagingBarcodeIsReady accepts barcodeUrl or barcodeArtifacts', () => {
  assert.equal(packagingBarcodeIsReady(undefined), false)
  assert.equal(packagingBarcodeIsReady({ barcodeUrl: 'https://cdn/x.png' }), true)
  assert.equal(
    packagingBarcodeIsReady({
      barcodeArtifacts: [
        {
          id: '1',
          type: 'qrcode',
          content: 'Website: https://x',
          label: 'Product QR',
          url: 'https://cdn/x.png',
          fileName: 'x.png',
        },
      ],
    }),
    true
  )
})
