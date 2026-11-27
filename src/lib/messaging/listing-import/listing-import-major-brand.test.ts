import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getListingDraftPublishBlockers } from '@/lib/messaging/listing-import/listing-draft-publish-validation'
import {
  dropListingRowsWithMajorBrands,
  findMajorWorldBrand,
  findMajorWorldBrandInFields,
} from '@/lib/messaging/listing-import/listing-import-major-brand'

describe('listing import major brand block', () => {
  it('drops world-brand names in Latin and Chinese', () => {
    assert.equal(findMajorWorldBrand('Nike运动鞋男新款'), 'Nike')
    assert.equal(findMajorWorldBrand('耐克空军一号'), 'Nike')
    assert.equal(findMajorWorldBrand('阿迪达斯三叶草'), 'Adidas')
    assert.equal(findMajorWorldBrand('古驰女包'), 'Gucci')
    assert.equal(findMajorWorldBrand('路易威登老花'), 'Louis Vuitton')
    assert.equal(findMajorWorldBrand('新款LV女包'), 'Louis Vuitton')
    assert.equal(findMajorWorldBrand('H&M女装衬衫'), 'H&M')
    assert.equal(findMajorWorldBrand('aj1芝加哥'), 'Jordan')
    assert.equal(findMajorWorldBrand('Hermès 丝巾'), 'Hermès')
    assert.equal(findMajorWorldBrand('iPhone 15 手机壳'), 'Apple')
    assert.equal(findMajorWorldBrand('SK-II 神仙水'), 'SK-II')
    assert.equal(findMajorWorldBrand('北面冲锋衣'), 'The North Face')
    assert.equal(findMajorWorldBrand('哥伦比亚冲锋衣'), 'Columbia')
    assert.equal(findMajorWorldBrand('CK内裤男'), 'Calvin Klein')
  })

  it('keeps ordinary goods and lookalike words', () => {
    assert.equal(findMajorWorldBrand('棉麻连衣裙新款'), null)
    assert.equal(findMajorWorldBrand('碎花裙'), null)
    assert.equal(findMajorWorldBrand('工厂直销帆布鞋'), null)
    assert.equal(findMajorWorldBrand('pineapple print shirt'), null)
    assert.equal(findMajorWorldBrand('fresh milk'), null)
    assert.equal(findMajorWorldBrand('dog leash'), null)
    assert.equal(findMajorWorldBrand('channel cotton bag'), null)
    assert.equal(findMajorWorldBrand('diorama kit'), null)
    assert.equal(findMajorWorldBrand('luggage cover'), null)
    assert.equal(findMajorWorldBrand('canonical'), null)
    assert.equal(findMajorWorldBrand('北面料'), null)
    assert.equal(findMajorWorldBrand('哥伦比亚咖啡豆'), null)
    assert.equal(findMajorWorldBrand('苹果图案连衣裙'), null)
    assert.equal(findMajorWorldBrand('LV-12 voltage regulator'), null)
    assert.equal(findMajorWorldBrand('MK-204 power module'), null)
    assert.equal(findMajorWorldBrand(''), null)
  })

  it('reads the brand from the shop name when the title is generic', () => {
    assert.equal(
      findMajorWorldBrandInFields(['运动鞋', '耐克旗舰店']),
      'Nike',
    )
  })

  it('splits listing rows and lists the brands once', () => {
    const split = dropListingRowsWithMajorBrands([
      { title: '棉麻连衣裙', chinese_name: '棉麻连衣裙', shop_name: '广州女装' },
      { title: 'Nike Air', chinese_name: '耐克', shop_name: '某店' },
      { title: '古驰包', chinese_name: '古驰包', shop_name: '某店' },
      { title: '古驰腰带', chinese_name: '古驰腰带', shop_name: '某店' },
    ])
    assert.equal(split.kept.length, 1)
    assert.equal(split.dropped, 3)
    assert.deepEqual(split.brands, ['Nike', 'Gucci'])
  })

  it('blocks publish of a draft whose name is a major brand', () => {
    const issues = getListingDraftPublishBlockers({
      name: 'Giày Nike Air',
      chinese_name: '耐克运动鞋',
      shop_name_chinese: '店铺名',
      category: 'Thời trang Nam',
      subcategory: 'Giày',
      sub_subcategory: 'Sneaker',
      images: ['https://cdn.example/a.jpg'],
      gallery: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
      main_image: 'https://cdn.example/a.jpg',
      colors: [{ name: 'Đen' }],
      sizes: ['40', '41', '42'],
    })
    assert.ok(issues.some((m) => m.includes('Nike')))
  })
})
