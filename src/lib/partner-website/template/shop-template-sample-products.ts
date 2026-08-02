import type { WebLocale } from '@/lib/i18n/config'

export type ShopTemplateSampleProduct = {
  name: string
  price: string
  imageUrl: string
  ctaText: string
  detailPath?: string
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
        ]
      : locale === 'zh'
        ? ['金色亮片连衣裙', '米色托特包', '棕色西装外套', '米色高跟鞋', '橙色丝绸裙', '黑色手拿包', '白色衬衫', '平底凉鞋']
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
              ]

  const prices =
    locale === 'en'
      ? ['$89.00', '$120.00', '$75.00', '$95.00', '$110.00', '$65.00', '$45.00', '$70.00']
      : ['₫ 2.500.000', '₫ 1.890.000', '₫ 1.650.000', '₫ 1.250.000', '₫ 2.100.000', '₫ 990.000', '₫ 750.000', '₫ 1.150.000']

  const images = [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1591369822096-ffd240ec9916?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=800&q=80',
  ]

  return names.map((name, i) => ({
    name,
    price: prices[i] || prices[0]!,
    imageUrl: images[i] || images[0]!,
    ctaText: cta,
  }))
}

export function getShopTemplateSampleBrand(locale: WebLocale): string {
  return locale === 'vi' || locale === 'zh' || locale === 'ja' || locale === 'ko'
    ? '188.com.vn'
    : '188 Fashion'
}
