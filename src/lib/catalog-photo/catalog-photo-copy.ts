import type { WebLocale } from '@/lib/i18n/config'

export type ProductStudioExportUi = {
  finish: string
  readyTitle: string
  nameLabel: string
  categoryLabel: string
  copy: string
  copied: string
  hint: string
  another: string
  intro: string
  libraryTitle: string
  libraryOpen: string
}

const COPY: Record<WebLocale, ProductStudioExportUi & { title: string; description: string }> = {
  vi: {
    title: 'Tạo ảnh đăng Facebook',
    description:
      'Tải ảnh sản phẩm tự chụp và chất liệu. AI đặt tên, phân loại và dựng bộ ảnh để bạn copy sang Facebook hoặc nền tảng khác. Không đăng lên web shop.',
    intro: 'Chỉ cần chất liệu và ảnh tự chụp. AI đặt tên và loại sản phẩm. Bộ ảnh không được đăng lên web shop nào.',
    finish: 'Lấy bộ ảnh',
    readyTitle: 'Bộ ảnh sẵn sàng để copy',
    nameLabel: 'Tên sản phẩm',
    categoryLabel: 'Loại',
    copy: 'Copy',
    copied: 'Đã copy',
    hint: 'Duyệt đủ ảnh màu, gallery và chất liệu rồi lấy bộ ảnh. Không tạo sản phẩm trên shop.',
    another: 'Tạo bộ khác',
    libraryTitle: 'Sản phẩm đã tạo',
    libraryOpen: 'Mở bộ ảnh',
  },
  en: {
    title: 'Create Facebook listing photos',
    description:
      'Upload amateur product photos and the material. AI names, classifies, and builds a photo set you can copy to Facebook or another platform. Nothing is published to a shop.',
    intro: 'Material and your own photos are enough. AI names and classifies the product. The set is not published to any shop.',
    finish: 'Get the photo set',
    readyTitle: 'Photo set ready to copy',
    nameLabel: 'Product name',
    categoryLabel: 'Category',
    copy: 'Copy',
    copied: 'Copied',
    hint: 'Approve color, gallery, and material photos, then get the set. No shop product is created.',
    another: 'Make another set',
    libraryTitle: 'Products you created',
    libraryOpen: 'Open photo set',
  },
  zh: {
    title: '制作 Facebook 卖货图',
    description: '上传自己拍的商品图和材质。AI 命名、分类并生成一组图片，方便复制到 Facebook 或其他平台。不会发布到任何网店。',
    intro: '只需材质和自拍图。AI 会命名并分类。图片不会发布到任何网店。',
    finish: '取出图片组',
    readyTitle: '图片组可以复制了',
    nameLabel: '商品名称',
    categoryLabel: '类别',
    copy: '复制',
    copied: '已复制',
    hint: '确认颜色、图集和材质图后取出图片组。不会在店铺创建商品。',
    another: '再做一组',
    libraryTitle: '已做的商品',
    libraryOpen: '打开图片组',
  },
  ja: {
    title: 'Facebook用の販売画像を作る',
    description:
      '自分で撮った商品写真と素材を入れると、AI が名前・分類・画像セットを作ります。Facebook など別の場所へコピーできます。ショップには公開しません。',
    intro: '素材と自分の写真だけで十分です。AI が名前と分類を付けます。ショップには公開しません。',
    finish: '画像セットを受け取る',
    readyTitle: 'コピーできる画像セット',
    nameLabel: '商品名',
    categoryLabel: '分類',
    copy: 'コピー',
    copied: 'コピーしました',
    hint: 'カラー、ギャラリー、素材画像を確定してから受け取ります。ショップ商品は作りません。',
    another: '別のセットを作る',
    libraryTitle: '作成済みの商品',
    libraryOpen: '画像セットを開く',
  },
  ko: {
    title: '페이스북 판매 이미지 만들기',
    description:
      '직접 찍은 상품 사진과 소재를 올리면 AI가 이름, 분류, 이미지 세트를 만듭니다. Facebook 등 다른 곳에 복사하세요. 쇼핑몰에는 올리지 않습니다.',
    intro: '소재와 직접 찍은 사진이면 됩니다. AI가 이름과 분류를 붙입니다. 어떤 쇼핑몰에도 올리지 않습니다.',
    finish: '이미지 세트 받기',
    readyTitle: '복사할 이미지 세트',
    nameLabel: '상품명',
    categoryLabel: '분류',
    copy: '복사',
    copied: '복사됨',
    hint: '색상, 갤러리, 소재 사진을 확정한 뒤 세트를 받으세요. 쇼핑몰 상품은 만들지 않습니다.',
    another: '다른 세트 만들기',
    libraryTitle: '만든 상품',
    libraryOpen: '이미지 세트 열기',
  },
}

export function catalogPhotoCopy(locale: WebLocale) {
  return COPY[locale] ?? COPY.vi
}
