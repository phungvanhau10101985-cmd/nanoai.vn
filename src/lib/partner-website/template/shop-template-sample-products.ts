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

const INDUSTRIAL_IMAGES = [
  'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=800&q=80',
]

/** Demo machines for the GD09 gallery — not live inventory. */
export function getIndustrialShopTemplateSampleProducts(locale: WebLocale): ShopTemplateSampleProduct[] {
  const names =
    locale === 'vi'
      ? [
          'Máy phay CNC VMC-850',
          'Máy tiện vạn năng CA6140',
          'Máy xúc bánh xích',
          'Máy xúc lật',
          'Cần cẩu tự hành',
          'Máy cưa gỗ',
          'Máy nén khí',
          'Máy phát điện',
        ]
      : locale === 'zh'
        ? ['数控铣床 VMC-850', '普通车床 CA6140', '履带挖掘机', '装载机', '汽车起重机', '木工锯床', '空压机', '发电机']
        : locale === 'ja'
          ? ['CNCフライス VMC-850', '汎用旋盤 CA6140', '油圧ショベル', 'ホイールローダー', 'クレーン', '木材鋸盤', 'コンプレッサー', '発電機']
          : locale === 'ko'
            ? ['CNC 밀링 VMC-850', '범용 선반 CA6140', '굴삭기', '로더', '크레인', '목재 톱', '컴프레서', '발전기']
            : [
                'CNC mill VMC-850',
                'Lathe CA6140',
                'Crawler excavator',
                'Wheel loader',
                'Mobile crane',
                'Wood saw',
                'Air compressor',
                'Generator',
              ]
  const prices =
    locale === 'vi'
      ? ['550.000.000 đ', '120.000.000 đ', '890.000.000 đ', '640.000.000 đ', '1.200.000.000 đ', '85.000.000 đ', '42.000.000 đ', '76.000.000 đ']
      : ['550,000,000 VND', '120,000,000 VND', '890,000,000 VND', '640,000,000 VND', '1,200,000,000 VND', '85,000,000 VND', '42,000,000 VND', '76,000,000 VND']
  return names.map((name, i) => ({
    name,
    price: prices[i] || prices[0]!,
    imageUrl: INDUSTRIAL_IMAGES[i] || INDUSTRIAL_IMAGES[0]!,
    ctaText: locale === 'vi' ? 'Xem chi tiết' : locale === 'zh' ? '查看详情' : locale === 'ja' ? '詳細' : locale === 'ko' ? '상세 보기' : 'View details',
  }))
}

export function getIndustrialShopTemplateSampleCategories(locale: WebLocale): ShopTemplateSampleCategory[] {
  const names =
    locale === 'vi'
      ? ['Máy xây dựng', 'Máy cơ khí', 'Máy chế biến gỗ', 'Máy nông nghiệp', 'Vật tư', 'Phụ tùng', 'Nâng hạ', 'Động cơ']
      : locale === 'zh'
        ? ['工程机械', '机械加工', '木材加工', '农机', '物资', '配件', '起重', '动力']
        : locale === 'ja'
          ? ['建設機械', '工作機械', '木材加工', '農業機械', '資材', '部品', '揚重', '動力']
          : locale === 'ko'
            ? ['건설 기계', '공작 기계', '목재 가공', '농기계', '자재', '부품', '인양', '동력']
            : ['Construction', 'Machine tools', 'Woodworking', 'Farm machinery', 'Supplies', 'Spare parts', 'Lifting', 'Power']
  return names.map((name, i) => ({
    name,
    imageUrl: INDUSTRIAL_IMAGES[i] || INDUSTRIAL_IMAGES[0]!,
  }))
}

export function getIndustrialShopTemplateSampleBannerImages(): Record<
  'birthday' | 'sale' | 'warehouse' | 'regular',
  string
> {
  const wide = 'auto=format&fit=crop&w=2100&h=900&q=80'
  return {
    birthday: `https://images.unsplash.com/photo-1504307651254-35680f356dfd?${wide}`,
    sale: `https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?${wide}`,
    warehouse: `https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?${wide}`,
    regular: `https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?${wide}`,
  }
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
