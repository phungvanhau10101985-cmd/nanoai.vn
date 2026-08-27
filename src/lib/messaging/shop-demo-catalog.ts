/**
 * 9 sản phẩm demo cho shop mua sắm (fashion) — 3 túi / 3 giày / 3 quần áo.
 * Nguồn: catalog 188.com.vn — đủ màu·size·ảnh; cột Excel/PDP map qua `shop-demo-catalog-188.ts`.
 * SKU `DEMO-188-*` để merchant xóa rồi tải lại mà không đụng hàng tự đăng.
 */

export const SHOP_DEMO_SKU_PREFIX = 'DEMO-188-'

export type ShopDemoKind = 'handbags' | 'shoes' | 'clothing'

export type ShopDemoColor = { name: string; img: string }

export type ShopDemoCategoryRef = {
  parent: { slug: string; name: string; nameEn: string }
  child: { slug: string; name: string; nameEn: string }
}

export type ShopDemoProduct = {
  kind: ShopDemoKind
  sku: string
  sourceSku: string
  sourceProductId: string
  name: string
  description: string
  consultNote: string
  material: string
  priceAmount: number
  stockQty: number
  colors: ShopDemoColor[]
  sizes: string[]
  mainImage: string
  galleryUrls: string[]
  detailImageUrls: string[]
  materialDetailImageUrl: string | null
  realUseImageUrl: string | null
  realUseImageUrl2: string | null
  category: ShopDemoCategoryRef
}

function demoSku(sourceSku: string): string {
  return `${SHOP_DEMO_SKU_PREFIX}${sourceSku}`
}

const CAT_BAG_W: ShopDemoCategoryRef['parent'] = {
  slug: 'tui-xach-nu',
  name: 'Túi xách Nữ',
  nameEn: "Women's bags",
}
const CAT_BAG_M: ShopDemoCategoryRef['parent'] = {
  slug: 'tui-xach-nam',
  name: 'Túi xách Nam',
  nameEn: "Men's bags",
}
const CAT_SHOE_W: ShopDemoCategoryRef['parent'] = {
  slug: 'giay-dep-nu',
  name: 'Giày dép Nữ',
  nameEn: "Women's shoes",
}
const CAT_APPAREL_W: ShopDemoCategoryRef['parent'] = {
  slug: 'thoi-trang-nu',
  name: 'Thời trang Nữ',
  nameEn: "Women's fashion",
}

export const SHOP_DEMO_PRODUCTS: ShopDemoProduct[] = [
  {
    kind: 'handbags',
    sku: demoSku('L4701'),
    sourceSku: 'L4701',
    sourceProductId: 'M2608081610193E206F',
    name: 'Túi xách nữ da bò form hộp chữ V đính hạt',
    description:
      'Túi xách nữ da bò cao cấp là phụ kiện không thể thiếu cho những cô nàng yêu thích sự tinh tế và sang trọng.\n\n' +
      'Với thiết kế form hộp chữ V độc đáo, chiếc túi không chỉ tôn lên vẻ đẹp hiện đại mà còn giúp bạn dễ dàng phối đồ trong nhiều hoàn cảnh khác nhau. Chất liệu da bò cao cấp mang lại độ bền vượt trội, bề mặt mềm mại, dễ lau chùi, giữ form dáng chuẩn theo thời gian.\n\n' +
      'Điểm nhấn của túi là phần đính hạt tỉ mỉ, tạo hiệu ứng lấp lánh tinh tế, giúp bạn nổi bật giữa đám đông. Màu bạc sang trọng dễ dàng kết hợp với trang phục công sở, dạ tiệc hay các buổi gặp gỡ bạn bè.\n\n' +
      'Túi có kích thước vừa phải, đủ rộng để đựng điện thoại, ví, son phấn và các vật dụng cần thiết khác. Quai xách chắc chắn, dễ cầm nắm, tạo cảm giác thoải mái khi di chuyển.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, phong cách thanh lịch, sang trọng. Da bò, form hộp chữ V đính hạt.',
    material: 'Da bò',
    priceAmount: 200000,
    stockQty: 80,
    colors: [
      {
        name: 'Bạc',
        img: 'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-1-a1-1786205457-b2e225e5a4.jpg',
      },
      {
        name: 'Đỏ',
        img: 'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-2-a1-1786205505-178d24a38c.jpg',
      },
      {
        name: 'Đen',
        img: 'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-3-a1-1786205862-6ae4831af3.jpg',
      },
    ],
    sizes: [],
    mainImage:
      'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-1-a1-1786205457-b2e225e5a4.jpg',
    galleryUrls: [
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01ivjfck1qzvekhqddm___2219537821991-0-cib_5748cc5e7859.jpg',
      'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-1-a1-1786205457-b2e225e5a4.jpg',
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01lo6yzz1qzvem6mtki___2219537821991-0-cib_33b6f93ed940.jpg',
      'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-2-a1-1786205505-178d24a38c.jpg',
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01u6rttb1qzvelhgbfv___2219537821991-0-cib_c923604dc0ff.jpg',
      'https://cdn.188.com.vn/site/manual-products/M2608081610193E206F/20260808/color-3-a1-1786205862-6ae4831af3.jpg',
    ],
    detailImageUrls: [
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01ivjfck1qzvekhqddm___2219537821991-0-cib_5748cc5e7859.jpg',
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01lo6yzz1qzvem6mtki___2219537821991-0-cib_33b6f93ed940.jpg',
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01u6rttb1qzvelhgbfv___2219537821991-0-cib_c923604dc0ff.jpg',
    ],
    materialDetailImageUrl:
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01lo6yzz1qzvem6mtki___2219537821991-0-cib_33b6f93ed940.jpg',
    realUseImageUrl:
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01ivjfck1qzvekhqddm___2219537821991-0-cib_5748cc5e7859.jpg',
    realUseImageUrl2:
      'https://cdn.188.com.vn/site/manual-products/refs/20260808/o1cn01u6rttb1qzvelhgbfv___2219537821991-0-cib_c923604dc0ff.jpg',
    category: {
      parent: CAT_BAG_W,
      child: { slug: 'tui-xach-tay-satchel-nu', name: 'Túi xách tay & satchel Nữ', nameEn: 'Handbags & satchels' },
    },
  },
  {
    kind: 'handbags',
    sku: demoSku('H9090'),
    sourceSku: 'H9090',
    sourceProductId: 'A726321045415a188H9090',
    name: 'Cặp công sở nam vải Oxford chống thấm, nhiều ngăn đựng laptop 15 inch',
    description:
      'Cặp công sở nam được làm từ vải Oxford cao cấp, có khả năng chống thấm nước tốt, bảo vệ tài liệu và laptop khỏi ẩm ướt.\n' +
      'Thiết kế nhiều ngăn rộng rãi, bao gồm ngăn đệm riêng cho laptop 15 inch, ngăn đựng tài liệu A4, túi phụ kiện nhỏ, giúp sắp xếp đồ đạc gọn gàng, khoa học.\n' +
      'Phù hợp cho nam giới đi làm, hội họp, công tác, mang phong cách lịch lãm, chuyên nghiệp. Quai xách chắc chắn, dây đeo vai có đệm êm, tiện lợi khi di chuyển.',
    consultNote: 'Phù hợp Nam 25–45 tuổi, dân văn phòng. Vải Oxford chống thấm, ngăn laptop 15 inch.',
    material: 'Vải Oxford chống thấm',
    priceAmount: 1210000,
    stockQty: 40,
    colors: [
      {
        name: 'Đen',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01nPt7Vn1hjrTu6Wqmq_!!2209094504314-0-cib.jpg',
      },
      {
        name: 'Xanh',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01gXPTkq1hjrjoAWi85_!!2209094504314-0-cib.jpg',
      },
      {
        name: 'Hồng',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01VIp3Lz1hjrjoAXmhR_!!2209094504314-0-cib.jpg',
      },
      {
        name: 'Nâu',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01bRcXvr1hjrjnO6Qj1_!!2209094504314-0-cib.jpg',
      },
    ],
    sizes: [],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A726321045415a188H9090/A726321045415a188H9090-vi-1780654368-d8084c664325.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A726321045415a188H9090/A726321045415a188H9090-vi-1780654368-d8084c664325.jpg',
      'https://188comvn.b-cdn.net/site/localized-images/A726321045415a188H9090/A726321045415a188H9090-vi-1780654376-beab3fc40623.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01YfXvQp1hjrTvAri6K_!!2209094504314-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01vPnqyx1hjrTziXGIk_!!2209094504314-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01JVR9aH1hjrTyu85UI_!!2209094504314-0-cib.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/O1CN01YfXvQp1hjrTvAri6K_!!2209094504314-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01vPnqyx1hjrTziXGIk_!!2209094504314-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01JVR9aH1hjrTyu85UI_!!2209094504314-0-cib.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/O1CN01YfXvQp1hjrTvAri6K_!!2209094504314-0-cib.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A726321045415a188H9090/A726321045415a188H9090-vi-1780654368-d8084c664325.jpg',
    realUseImageUrl2:
      'https://188comvn.b-cdn.net/site/localized-images/A726321045415a188H9090/A726321045415a188H9090-vi-1780654376-beab3fc40623.jpg',
    category: {
      parent: CAT_BAG_M,
      child: { slug: 'cap-cong-so-briefcase-nam', name: 'Cặp công sở & briefcase Nam', nameEn: 'Briefcases' },
    },
  },
  {
    kind: 'handbags',
    sku: demoSku('G3817'),
    sourceSku: 'G3817',
    sourceProductId: 'A634158335141a188G3817',
    name: 'Túi đeo chéo nữ da cá sấu dây xích phối kim tuyến',
    description:
      'Túi đeo chéo nữ thiết kế thời trang, chất liệu da cá sấu cao cấp tạo vẻ sang trọng và cá tính.\n' +
      'Phối kim tuyến nổi bật, phù hợp cho các buổi dạo phố, đi chơi hay dự tiệc nhẹ.\n' +
      'Kiểu dáng đa năng: có thể xách tay, đeo chéo hoặc đeo một bên vai nhờ dây xích kim loại chắc chắn.\n' +
      'Kích thước 30x23.5x13.5 cm vừa đựng điện thoại, ví, son và các vật dụng cá nhân cần thiết.\n' +
      'Màu sắc đa dạng: Đỏ rượu, Đen, Xanh lá, Đỏ – dễ dàng phối đồ.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, phong cách thời trang, cá tính. Da cá sấu giả, dây xích kim loại.',
    material: 'Da cá sấu (giả da cao cấp), dây xích kim loại, kim tuyến',
    priceAmount: 10570000,
    stockQty: 24,
    colors: [
      {
        name: 'Đỏ rượu',
        img: 'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477009-c4fdd96e4f41.jpg',
      },
      {
        name: 'Đen',
        img: 'https://cbu01.alicdn.com/img/ibank/23575505290_1903357852.jpg',
      },
      {
        name: 'Xanh lá',
        img: 'https://cbu01.alicdn.com/img/ibank/23575496605_1903357852.jpg',
      },
      {
        name: 'Đỏ',
        img: 'https://cbu01.alicdn.com/img/ibank/23390751900_1903357852.jpg',
      },
    ],
    sizes: [],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477009-c4fdd96e4f41.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477009-c4fdd96e4f41.jpg',
      'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477011-7d84ab97dddb.jpg',
      'https://cbu01.alicdn.com/img/ibank/23477065107_1903357852.jpg',
      'https://cbu01.alicdn.com/img/ibank/23575508066_1903357852.jpg',
      'https://cbu01.alicdn.com/img/ibank/23575469922_1903357852.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/23477065107_1903357852.jpg',
      'https://cbu01.alicdn.com/img/ibank/23575508066_1903357852.jpg',
      'https://cbu01.alicdn.com/img/ibank/23575469922_1903357852.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/23477065107_1903357852.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477009-c4fdd96e4f41.jpg',
    realUseImageUrl2:
      'https://188comvn.b-cdn.net/site/localized-images/A634158335141a188G3817/A634158335141a188G3817-vi-1780477011-7d84ab97dddb.jpg',
    category: {
      parent: CAT_BAG_W,
      child: { slug: 'tui-deo-cheo-bucket-nu', name: 'Túi đeo chéo & bucket Nữ', nameEn: 'Crossbody & bucket bags' },
    },
  },
  {
    kind: 'shoes',
    sku: demoSku('O3837'),
    sourceSku: 'O3837',
    sourceProductId: 'A822894254775a188O3837',
    name: 'Giày boot nữ cổ ngắn đế dày phong cách Martin, lót lông ấm mùa đông',
    description:
      'Giày boot nữ cổ ngắn đế dày phong cách Martin là item không thể thiếu trong tủ đồ mùa đông của các cô nàng cá tính. Thiết kế form dáng khỏe khoắn, chất liệu da PU mềm mại kết hợp lót lông nhung ấm áp, giúp bạn tự tin sải bước trong những ngày trời lạnh.\n' +
      'Đế giày cao khoảng 4-5 cm tạo cảm giác chắc chắn, êm ái khi di chuyển. Kiểu dáng cổ ngắn ôm nhẹ cổ chân, dễ dàng phối với quần jean, quần tây ống ôm hay chân váy đều rất thời trang.\n' +
      'Sản phẩm phù hợp đi làm, đi chơi, dạo phố hay những chuyến du lịch mùa đông. Với nhiều màu sắc và kích cỡ từ 35-40, bạn có thể dễ dàng chọn cho mình đôi ưng ý.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, phong cách cá tính. Size 35–40, đế dày 4–5 cm, có bản lót nhung.',
    material: 'Da PU, lót lông nhung',
    priceAmount: 920000,
    stockQty: 60,
    colors: [
      {
        name: 'Vàng lót nhung',
        img: 'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144183-44271376062b.jpg',
      },
      {
        name: 'Vàng một lớp',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01M3uZMa2C851Mx6aSK_!!2212570748428-0-cib.jpg',
      },
      {
        name: 'Kaki lót nhung',
        img: 'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144185-5ba423950ed6.jpg',
      },
      {
        name: 'Đen một lớp',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01q4PBwC2C851PnwT7M_!!2212570748428-0-cib.jpg',
      },
      {
        name: 'Kaki một lớp',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01BxJOfo2C851NPN7tz_!!2212570748428-0-cib.jpg',
      },
    ],
    sizes: ['35', '36', '37', '38', '39', '40'],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144188-115f8bf2ff44.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144188-115f8bf2ff44.jpg',
      'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144191-4319e353d461.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01535jnv2C851PmFP91_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01WpOi2k2C851Fv10MG_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN016dKBLO2C851PmEGXt_!!2212570748428-0-cib.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/O1CN01535jnv2C851PmFP91_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01WpOi2k2C851Fv10MG_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN016dKBLO2C851PmEGXt_!!2212570748428-0-cib.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/O1CN01WpOi2k2C851Fv10MG_!!2212570748428-0-cib.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144188-115f8bf2ff44.jpg',
    realUseImageUrl2:
      'https://188comvn.b-cdn.net/site/localized-images/A822894254775a188O3837/A822894254775a188O3837-vi-1781144191-4319e353d461.jpg',
    category: {
      parent: CAT_SHOE_W,
      child: { slug: 'boot-nu', name: 'Boot Nữ', nameEn: "Women's boots" },
    },
  },
  {
    kind: 'shoes',
    sku: demoSku('P9508'),
    sourceSku: 'P9508',
    sourceProductId: 'A1041748222971a188P9508',
    name: 'Giày sneaker nữ đế dày tăng chiều cao lưới thoáng khí mùa hè',
    description:
      'Giày sneaker nữ đế dày tăng chiều cao thiết kế theo phong cách thể thao năng động, phù hợp cho các bạn nữ yêu thích sự thoải mái và muốn cải thiện vóc dáng.\n' +
      'Phần thân giày được làm từ chất liệu vải lưới mesh cao cấp, giúp thoáng khí tối ưu, giữ chân khô ráo ngay cả trong những ngày hè oi bức. Đế giày dày khoảng 5–6 cm tạo hiệu ứng tăng chiều cao tự nhiên, đồng thời mang lại cảm giác êm ái khi di chuyển.\n' +
      'Kiểu dáng sneaker chunky đế dày đang là xu hướng thời trang đường phố, dễ dàng kết hợp với quần jean, chân váy hay quần short. Sản phẩm phù hợp đi chơi, dạo phố, du lịch hoặc hoạt động nhẹ nhàng hằng ngày.',
    consultNote: 'Phù hợp Nữ 18–30 tuổi, năng động. Size 33–40, đế dày 5–6 cm, lưới mesh thoáng khí.',
    material: 'Vải lưới mesh thoáng khí, đế cao su tổng hợp',
    priceAmount: 970000,
    stockQty: 72,
    colors: [
      {
        name: 'Vàng kem',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01LjpmsU2C85AxxnOF9_!!2212570748428-0-cib.jpg',
      },
      {
        name: 'Xám kem',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01U0Q4wY2C85AyNDtOy_!!2212570748428-0-cib.jpg',
      },
      {
        name: 'Xám',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01EOU8Kc2C85B68Qk9f_!!2212570748428-0-cib.jpg',
      },
    ],
    sizes: ['33', '34', '35', '36', '37', '38', '39', '40'],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A1041748222971a188P9508/A1041748222971a188P9508-vi-1781143192-abed52262331.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A1041748222971a188P9508/A1041748222971a188P9508-vi-1781143192-abed52262331.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01QMDlMN2C85AxeSIXM_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01DNNGzA2C85AxjOXbF_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Zp7oha2C85B1JjlmV_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN019V2EN02C85Ay3bZxc_!!2212570748428-0-cib.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/O1CN01QMDlMN2C85AxeSIXM_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01DNNGzA2C85AxjOXbF_!!2212570748428-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Zp7oha2C85B1JjlmV_!!2212570748428-0-cib.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/O1CN01DNNGzA2C85AxjOXbF_!!2212570748428-0-cib.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A1041748222971a188P9508/A1041748222971a188P9508-vi-1781143192-abed52262331.jpg',
    realUseImageUrl2: 'https://cbu01.alicdn.com/img/ibank/O1CN019V2EN02C85Ay3bZxc_!!2212570748428-0-cib.jpg',
    category: {
      parent: CAT_SHOE_W,
      child: { slug: 'sneaker-giay-bet-nu', name: 'Sneaker & giày bệt Nữ', nameEn: 'Sneakers & flats' },
    },
  },
  {
    kind: 'shoes',
    sku: demoSku('Q0927'),
    sourceSku: 'Q0927',
    sourceProductId: 'A745627686900a188Q0927',
    name: 'Boot Chelsea nữ đế bằng cổ thun tôn dáng mùa đông',
    description:
      'Boot Chelsea nữ đế bằng cổ thun là item thời trang không thể thiếu trong tủ giày mùa đông. Thiết kế cổ điển, đa năng, dễ dàng phối với quần jean, chân váy hay quần tây.\n' +
      'Phần cổ thun co giãn giúp xỏ vào nhanh chóng, ôm sát cổ chân tạo cảm giác thoải mái. Đế bằng cao su nhẹ, chống trượt, phù hợp di chuyển cả ngày dài.\n' +
      'Kiểu dáng tôn dáng, kéo dài chân, phù hợp nữ yêu thích phong cách casual, công sở hoặc dạo phố. Sản phẩm có sẵn màu đen và màu cà phê, size 35–40.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, casual / công sở. Size 35–40, đế bằng, cổ thun dễ xỏ.',
    material: 'Da PU tổng hợp, lót trong chất liệu vải mềm',
    priceAmount: 2270000,
    stockQty: 36,
    colors: [
      {
        name: 'Đen',
        img: 'https://188comvn.b-cdn.net/site/localized-images/A745627686900a188Q0927/A745627686900a188Q0927-vi-1781059083-0fe282613fd1.jpg',
      },
      {
        name: 'Cà phê',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01Q6Sziy1z2xbjHWMld_!!963166657-0-cib.jpg',
      },
    ],
    sizes: ['35', '36', '37', '38', '39', '40'],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A745627686900a188Q0927/A745627686900a188Q0927-vi-1781059083-0fe282613fd1.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A745627686900a188Q0927/A745627686900a188Q0927-vi-1781059083-0fe282613fd1.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Q6Sziy1z2xbjHWMld_!!963166657-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN018hJGGl1z2xbgmj3s5_!!963166657-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN011SRiFg1z2xbdtQs9S_!!963166657-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01pDm1Ze1z2xbhpMsZG_!!963166657-0-cib.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/O1CN018hJGGl1z2xbgmj3s5_!!963166657-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN011SRiFg1z2xbdtQs9S_!!963166657-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01pDm1Ze1z2xbhpMsZG_!!963166657-0-cib.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/O1CN018hJGGl1z2xbgmj3s5_!!963166657-0-cib.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A745627686900a188Q0927/A745627686900a188Q0927-vi-1781059083-0fe282613fd1.jpg',
    realUseImageUrl2: 'https://cbu01.alicdn.com/img/ibank/O1CN01Q6Sziy1z2xbjHWMld_!!963166657-0-cib.jpg',
    category: {
      parent: CAT_SHOE_W,
      child: { slug: 'boot-nu', name: 'Boot Nữ', nameEn: "Women's boots" },
    },
  },
  {
    kind: 'clothing',
    sku: demoSku('O7073'),
    sourceSku: 'O7073',
    sourceProductId: 'M260809034359C724D5',
    name: 'Đầm voan trễ vai tiểu thư họa tiết hoa thêu',
    description:
      'Chiếc đầm voan trễ vai này là lựa chọn hoàn hảo cho các nàng tiểu thư yêu thích sự dịu dàng, nữ tính. Thiết kế trễ vai khoe trọn bờ vai thon gợi cảm, kết hợp cùng chất liệu voan mềm mại, bồng bềnh tạo nên vẻ ngoài ngọt ngào và thanh lịch. Họa tiết hoa thêu tinh tế trên nền vải kem càng làm tăng thêm nét duyên dáng, sang trọng cho người mặc.\n\n' +
      'Đầm có dáng xòe nhẹ nhàng, giúp che khuyết điểm vòng eo và tôn lên đường cong cơ thể một cách khéo léo. Chất liệu voan cao cấp không chỉ mang lại cảm giác thoải mái, dễ chịu khi mặc mà còn giúp bạn tự tin diện cả ngày dài. Sản phẩm phù hợp với nhiều vóc dáng, từ người mảnh mai đến người đầy đặn, đều có thể chọn được size ưng ý.\n\n' +
      'Với thiết kế thanh lịch và màu sắc trang nhã, chiếc đầm này rất thích hợp để bạn diện trong các dịp dự tiệc, dạo phố, hẹn hò hay đi làm.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, phong cách nữ tính, dịu dàng. Size S–XL, voan thêu hoa.',
    material: 'Lụa tơ tằm / voan',
    priceAmount: 200000,
    stockQty: 50,
    colors: [
      {
        name: 'Kem',
        img: 'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/color-1-a1-1786247163-ed685c609e.jpg',
      },
      {
        name: 'Trắng',
        img: 'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/color-2-a2-1786247316-246a377c10.jpg',
      },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    mainImage:
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/color-1-a1-1786247163-ed685c609e.jpg',
    galleryUrls: [
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-1-a2-1786247712-b45667f642.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-2-a1-1786247762-5d5c08fb8c.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-4-a2-1786249733-13c78ee3fe.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-5-a1-1786249769-ed1f065f7f.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/color-1-a1-1786247163-ed685c609e.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/color-2-a2-1786247316-246a377c10.jpg',
    ],
    detailImageUrls: [
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-4-a2-1786249733-13c78ee3fe.jpg',
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-5-a1-1786249769-ed1f065f7f.jpg',
    ],
    materialDetailImageUrl:
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/material-1-a3-1786251749-b5707ab23f.jpg',
    realUseImageUrl:
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-1-a2-1786247712-b45667f642.jpg',
    realUseImageUrl2:
      'https://cdn.188.com.vn/site/manual-products/M260809034359C724D5/20260809/gallery-2-a1-1786247762-5d5c08fb8c.jpg',
    category: {
      parent: CAT_APPAREL_W,
      child: { slug: 'dam-nu', name: 'Đầm Nữ', nameEn: 'Dresses' },
    },
  },
  {
    kind: 'clothing',
    sku: demoSku('Z2008'),
    sourceSku: 'Z2008',
    sourceProductId: 'M26081108315352A555',
    name: 'Áo thun nữ cổ thuyền cut-out vạt chéo',
    description:
      'Chiếc áo thun nữ với thiết kế cổ thuyền cut-out và vạt chéo độc đáo sẽ là điểm nhấn thanh lịch cho tủ đồ của bạn. Kiểu dáng này không chỉ tôn lên vẻ đẹp dịu dàng, nữ tính mà còn mang đến sự mới mẻ, phá cách, giúp bạn tự tin tỏa sáng ở cả nơi công sở lẫn những buổi dạo phố.\n\n' +
      'Áo được may từ chất liệu cotton mềm mại, thoáng mát, thấm hút mồ hôi tốt, mang lại cảm giác dễ chịu suốt cả ngày dài. Thiết kế tay ngắn, cổ thuyền cut-out tinh tế khoe khéo bờ vai và xương quai xanh, tạo nên vẻ quyến rũ nhẹ nhàng. Vạt chéo giúp tôn dáng, che khuyết điểm vòng eo một cách khéo léo.\n\n' +
      'Sản phẩm phù hợp với những cô nàng yêu thích phong cách thanh lịch, hiện đại nhưng vẫn muốn thể hiện cá tính riêng. Dễ dàng kết hợp với quần âu, chân váy để đi làm, hoặc quần jeans, shorts cho ngày dạo phố năng động.',
    consultNote: 'Phù hợp Nữ 18–35 tuổi, công sở / dạo phố. Cotton, size S–L, cổ thuyền cut-out.',
    material: 'Cotton',
    priceAmount: 200000,
    stockQty: 64,
    colors: [
      {
        name: 'Tím',
        img: 'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/color-1-a1-1786437168-65fcce0d84.jpg',
      },
      {
        name: 'Nâu đậm',
        img: 'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/color-2-a1-1786437208-96bc7a3d77.jpg',
      },
    ],
    sizes: ['S', 'M', 'L'],
    mainImage:
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/color-1-a1-1786437168-65fcce0d84.jpg',
    galleryUrls: [
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-1-a1-1786437560-8edfa846c6.jpg',
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-2-a1-1786437632-5ec026d3b8.jpg',
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-3-a2-1786437752-775c1e05cf.jpg',
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/color-1-a1-1786437168-65fcce0d84.jpg',
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/color-2-a1-1786437208-96bc7a3d77.jpg',
    ],
    detailImageUrls: [
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-2-a1-1786437632-5ec026d3b8.jpg',
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-3-a2-1786437752-775c1e05cf.jpg',
    ],
    materialDetailImageUrl:
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/material-1-a1-1786437812-a059b8c298.jpg',
    realUseImageUrl:
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-1-a1-1786437560-8edfa846c6.jpg',
    realUseImageUrl2:
      'https://cdn.188.com.vn/site/manual-products/M26081108315352A555/20260811/gallery-3-a2-1786437752-775c1e05cf.jpg',
    category: {
      parent: CAT_APPAREL_W,
      child: { slug: 'ao-thun-kieu-nu', name: 'Áo thun & kiểu Nữ', nameEn: 'Tops & tees' },
    },
  },
  {
    kind: 'clothing',
    sku: demoSku('Q7349'),
    sourceSku: 'Q7349',
    sourceProductId: 'A1039127660576a188Q7349',
    name: 'Bộ quần áo hai mảnh nữ ramie thêu hoa, áo sơ mi phối quần ống rộng',
    description:
      'Bộ quần áo hai mảnh nữ chất liệu ramie cao cấp, gồm áo sơ mi thêu hoa tinh tế và quần ống rộng thoải mái. Thiết kế phong cách Hàng Châu mang đến vẻ đẹp thanh lịch, nhẹ nhàng, phù hợp cho mùa hè.\n\n' +
      'Áo sơ mi có cổ đức, tay ngắn, họa tiết thêu hoa nổi bật, tạo điểm nhấn duyên dáng. Quần ống rộng cạp cao giúp kéo dài chân, che khuyết điểm vòng eo và đùi, mang lại dáng vẻ thon gọn. Chất liệu ramie thoáng mát, thấm hút mồ hôi tốt, rất thích hợp cho thời tiết nóng.\n\n' +
      'Bộ trang phục này phù hợp để đi làm, dạo phố, gặp gỡ bạn bè hay các buổi tiệc nhẹ. Dễ dàng phối với giày bệt, sandal hoặc giày cao gót để thay đổi phong cách.',
    consultNote: 'Phù hợp Nữ 25–40 tuổi, thanh lịch. Ramie pha cotton, size M–XL, áo + quần ống rộng.',
    material: 'Ramie (sợi đay) pha cotton',
    priceAmount: 2870000,
    stockQty: 28,
    colors: [
      {
        name: 'Hồng',
        img: 'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029202-24196df71f82.jpg',
      },
      {
        name: 'Trắng',
        img: 'https://cbu01.alicdn.com/img/ibank/O1CN01D2h1L01GCtcaSkfJZ_!!2417950587-0-cib.jpg',
      },
    ],
    sizes: ['M', 'L', 'XL'],
    mainImage:
      'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029206-4b46b526250b.jpg',
    galleryUrls: [
      'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029206-4b46b526250b.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Eb3yJ31GCtcaq1XBR_!!2417950587-0-cib.jpg',
      'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029212-cd3a0c9a8fee.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Y72cKo1GCtcaZ2ath_!!2417950587-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01HYjbaH1GCtcavQz2n_!!2417950587-0-cib.jpg',
    ],
    detailImageUrls: [
      'https://cbu01.alicdn.com/img/ibank/O1CN01Eb3yJ31GCtcaq1XBR_!!2417950587-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01Y72cKo1GCtcaZ2ath_!!2417950587-0-cib.jpg',
      'https://cbu01.alicdn.com/img/ibank/O1CN01HYjbaH1GCtcavQz2n_!!2417950587-0-cib.jpg',
    ],
    materialDetailImageUrl: 'https://cbu01.alicdn.com/img/ibank/O1CN01Y72cKo1GCtcaZ2ath_!!2417950587-0-cib.jpg',
    realUseImageUrl:
      'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029206-4b46b526250b.jpg',
    realUseImageUrl2:
      'https://188comvn.b-cdn.net/site/localized-images/A1039127660576a188Q7349/A1039127660576a188Q7349-vi-1781029212-cd3a0c9a8fee.jpg',
    category: {
      parent: CAT_APPAREL_W,
      child: { slug: 'quan-dai-legging-nu', name: 'Quần dài & legging Nữ', nameEn: 'Pants & leggings' },
    },
  },
]

export function shopDemoSkuList(): string[] {
  return SHOP_DEMO_PRODUCTS.map((p) => p.sku)
}

export function isShoppingShopIndustry(industryKey: string | null | undefined): boolean {
  return (industryKey || 'fashion').trim().toLowerCase() === 'fashion'
}
