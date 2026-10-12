import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  imageLocSheetKinds,
  imageLocSheetReuseMessage,
  isApparelImageLocProduct,
  normalizeImageLocSheetKey,
  resolveStoredImageLocSheet,
} from './sheet-cache'

describe('saved size and laundry sheets', () => {
  it('normalizes the Chinese shop and category key', () => {
    assert.equal(normalizeImageLocSheetKey('  旗舰店   '), '旗舰店')
    assert.equal(normalizeImageLocSheetKey(''), '')
  })

  it('reuses a stored sheet only when every kind on the image is already saved', () => {
    assert.equal(resolveStoredImageLocSheet(['size'], { size: 'https://cdn.example/size.jpg' }), 'https://cdn.example/size.jpg')
    assert.equal(resolveStoredImageLocSheet(['laundry'], { size: 'https://cdn.example/size.jpg' }), null)
    assert.equal(
      resolveStoredImageLocSheet(['size', 'laundry'], {
        size: 'https://cdn.example/both.jpg',
        laundry: 'https://cdn.example/both.jpg',
      }),
      'https://cdn.example/both.jpg'
    )
    assert.equal(
      resolveStoredImageLocSheet(['size', 'laundry'], { size: 'https://cdn.example/size.jpg' }),
      null
    )
  })

  it('treats dresses and tops as apparel and keeps shoes, bags, and other industries on the local path', () => {
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['女装', '连衣裙', '黑色连衣裙'] }),
      true
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: null, labels: ['Quần jean nữ'] }),
      true
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['女鞋', '半身裙'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['Giày tây nam', 'da bò'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['运动鞋', '厚底增高'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['Túi tote canvas'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['Đồng hồ nam'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'hotel', labels: ['Áo sơ mi'] }),
      false
    )
    assert.equal(
      isApparelImageLocProduct({ industryKey: 'fashion', labels: ['女装', '半身裙'] }),
      true
    )
  })

  it('marks a measurement table as size and a wash label as laundry', () => {
    assert.deepEqual(
      imageLocSheetKinds([
        { text: '尺码表', bbox: [0, 0, 10, 10] },
        { text: '胸围', bbox: [0, 20, 10, 10] },
        { text: '衣长', bbox: [0, 40, 10, 10] },
        { text: 'S', bbox: [20, 20, 10, 10] },
        { text: '82cm', bbox: [40, 20, 10, 10] },
        { text: '88cm', bbox: [40, 40, 10, 10] },
        { text: 'M', bbox: [20, 40, 10, 10] },
        { text: '90cm', bbox: [60, 20, 10, 10] },
      ]),
      ['size']
    )
    assert.deepEqual(
      imageLocSheetKinds([
        { text: '洗涤说明', bbox: [0, 0, 10, 10] },
        { text: '手洗', bbox: [0, 20, 10, 10] },
      ]),
      ['laundry']
    )
  })

  it('marks a product parameter index chart as params and leaves a plain spec table local', () => {
    const box: [number, number, number, number] = [0, 0, 10, 10]
    assert.deepEqual(
      imageLocSheetKinds([
        { text: 'PRODUCT PARAMETERS', bbox: box },
        { text: '商品参数', bbox: box },
        { text: '版型指数：', bbox: box },
        { text: '紧身', bbox: box },
        { text: '合体', bbox: box },
        { text: '宽松', bbox: box },
        { text: '柔软指数：', bbox: box },
        { text: '常规', bbox: box },
        { text: '柔软', bbox: box },
        { text: '超柔', bbox: box },
        { text: '厚度指数：', bbox: box },
        { text: '薄款', bbox: box },
        { text: '超薄', bbox: box },
        { text: '弹力指数：', bbox: box },
        { text: '无弹', bbox: box },
        { text: '弹力', bbox: box },
        { text: '超弹', bbox: box },
      ]),
      ['params']
    )
    assert.deepEqual(
      imageLocSheetKinds([
        { text: '商品参数', bbox: box },
        { text: '颜色', bbox: box },
        { text: '黑色', bbox: box },
        { text: '材质', bbox: box },
        { text: '棉', bbox: box },
      ]),
      []
    )
    assert.equal(
      resolveStoredImageLocSheet(['params'], { params: 'https://cdn.example/params.jpg' }),
      'https://cdn.example/params.jpg'
    )
    assert.equal(
      imageLocSheetReuseMessage(['params']),
      'Dùng ảnh thông số đã lưu cho cùng shop Trung Quốc, shop này và danh mục cấp 2'
    )
  })
})
