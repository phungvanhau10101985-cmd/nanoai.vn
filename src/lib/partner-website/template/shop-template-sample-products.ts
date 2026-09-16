import type { WebLocale } from '@/lib/i18n/config'

export type ShopTemplateSampleProduct = {
  name: string
  price: string
  imageUrl: string
  ctaText: string
  compareAtPrice?: string
  detailPath?: string
}

export type ShopTemplateSampleCategory = {
  name: string
  imageUrl: string
}

/** Demo catalog so template previews look complete before real inventory exists. */
export function getShopTemplateSampleProducts(locale: WebLocale): ShopTemplateSampleProduct[] {
  const cta =
    locale === 'vi'
      ? 'Thêm vào giỏ'
      : locale === 'zh'
        ? '加入购物车'
        : locale === 'ja'
          ? 'カートに追加'
          : locale === 'ko'
            ? '장바구니 담기'
            : 'ADD TO CART'

  const names =
    locale === 'vi'
      ? [
          'Đầm sequin vàng',
          'Túi tote da be',
          'Áo blazer nâu',
          'Giày cao gót kem',
          'Váy lụa cam',
          'Túi clutch đen',
          'Áo sơ mi trắng',
          'Sandal quai ngang',
          'Quần jeans ống rộng',
          'Áo khoác denim',
          'Túi đeo chéo nâu',
          'Giày sneaker trắng',
        ]
      : locale === 'zh'
        ? [
            '金色亮片连衣裙',
            '米色托特包',
            '棕色西装外套',
            '米色高跟鞋',
            '橙色丝绸裙',
            '黑色手拿包',
            '白色衬衫',
            '平底凉鞋',
            '阔腿牛仔裤',
            '牛仔外套',
            '棕色斜挎包',
            '白色运动鞋',
          ]
        : locale === 'ja'
          ? [
              'ゴールドスパンコールドレス',
              'ベージュトート',
              'ブラウンブレザー',
              'ベージュヒール',
              'オレンジシルクドレス',
              'ブラッククラッチ',
              'ホワイトシャツ',
              'フラットサンダル',
              'ワイドジーンズ',
              'デニムジャケット',
              'ブラウンショルダー',
              'ホワイトスニーカー',
            ]
          : locale === 'ko'
            ? [
                '골드 시퀸 드레스',
                '베이지 토트백',
                '브라운 블레이저',
                '베이지 힐',
                '오렌지 실크 드레스',
                '블랙 클러치',
                '화이트 셔츠',
                '플랫 샌들',
                '와이드 진',
                '데님 재킷',
                '브라운 크로스백',
                '화이트 스니커즈',
              ]
            : [
                'Gold Sequin Dress',
                'Beige Leather Tote',
                'Brown Blazer',
                'Cream Heels',
                'Orange Silk Dress',
                'Black Clutch',
                'White Shirt',
                'Flat Sandals',
                'Wide-leg Jeans',
                'Denim Jacket',
                'Brown Crossbody',
                'White Sneakers',
              ]

  const prices =
    locale === 'en'
      ? ['$89.00', '$120.00', '$75.00', '$95.00', '$110.00', '$65.00', '$45.00', '$70.00', '$58.00', '$82.00', '$79.00', '$64.00']
      : [
          '₫ 2.500.000',
          '₫ 1.890.000',
          '₫ 1.650.000',
          '₫ 1.250.000',
          '₫ 2.100.000',
          '₫ 990.000',
          '₫ 750.000',
          '₫ 1.150.000',
          '₫ 890.000',
          '₫ 1.350.000',
          '₫ 1.090.000',
          '₫ 980.000',
        ]

  const compareAt =
    locale === 'en'
      ? ['$112.00', '$150.00', '$95.00', '$120.00', '$138.00', '$82.00', '$58.00', '$88.00', '$72.00', '$105.00', '$99.00', '$80.00']
      : [
          '₫ 3.150.000',
          '₫ 2.390.000',
          '₫ 2.050.000',
          '₫ 1.590.000',
          '₫ 2.650.000',
          '₫ 1.250.000',
          '₫ 950.000',
          '₫ 1.450.000',
          '₫ 1.120.000',
          '₫ 1.690.000',
          '₫ 1.390.000',
          '₫ 1.250.000',
        ]

  const images = [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1591369822096-ffd240ec9916?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=800&q=80',
  ]

  return names.map((name, i) => ({
    name,
    price: prices[i] || prices[0]!,
    compareAtPrice: compareAt[i] || compareAt[0],
    imageUrl: images[i] || images[0]!,
    ctaText: cta,
  }))
}

/** Category tiles for the gallery sample — names + photos, not live inventory. */
export function getShopTemplateSampleCategories(locale: WebLocale): ShopTemplateSampleCategory[] {
  const names =
    locale === 'vi'
      ? ['Túi xách', 'Giày dép', 'Váy đầm', 'Áo sơ mi', 'Áo khoác', 'Quần dài', 'Sandal', 'Phụ kiện']
      : locale === 'zh'
        ? ['手袋', '鞋履', '连衣裙', '衬衫', '外套', '长裤', '凉鞋', '配饰']
        : locale === 'ja'
          ? ['バッグ', 'シューズ', 'ワンピース', 'シャツ', 'アウター', 'パンツ', 'サンダル', '小物']
          : locale === 'ko'
            ? ['가방', '신발', '원피스', '셔츠', '아우터', '팬츠', '샌들', '액세서리']
            : ['Bags', 'Shoes', 'Dresses', 'Shirts', 'Jackets', 'Trousers', 'Sandals', 'Accessories']
  const images = [
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1591369822096-ffd240ec9916?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80',
  ]
  return names.map((name, i) => ({
    name,
    imageUrl: images[i] || images[0]!,
  }))
}

/** 21:9 fashion photos for the four promo banner slots on the gallery sample. */
export function getShopTemplateSampleBannerImages(): Record<'birthday' | 'sale' | 'warehouse' | 'regular', string> {
  return {
    birthday:
      'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=2100&h=900&q=80',
    sale: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=2100&h=900&q=80',
    warehouse:
      'https://images.unsplash.com/photo-1445205170230-053f83030561?auto=format&fit=crop&w=2100&h=900&q=80',
    regular:
      'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=2100&h=900&q=80',
  }
}

/** Gallery slogan only — not frozen on the preset theme. */
export function getShopTemplateSampleSlogan(locale: WebLocale): string {
  return locale === 'vi'
    ? 'Thời trang mỗi ngày'
    : locale === 'zh'
      ? '每天都时尚'
      : locale === 'ja'
        ? '毎日のファッション'
        : locale === 'ko'
          ? '매일의 패션'
          : 'Fashion every day'
}

export function getShopTemplateSampleBrand(locale: WebLocale): string {
  return locale === 'vi' || locale === 'zh' || locale === 'ja' || locale === 'ko'
    ? '188.com.vn'
    : '188 Fashion'
}
