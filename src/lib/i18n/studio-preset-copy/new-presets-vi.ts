/** Studio preset copy — 7 new seamless flows (Vietnamese) */
export const NEW_PRESETS_VI = {
  packaging_kit: {
    title: 'Thiết kế hộp giấy',
    kickoff:
      'Thiết kế hộp carton kỹ thuật từ Logo → tạo tuần tự đủ 6 mặt trên|trước|phải|dưới|sau|trái → mockup 3D → Dieline PDF → nhãn → tem → mã vạch thật.',
    steps: {
      brand_name: 'Brief: Tên thương hiệu',
      product_type: 'Brief: Loại sản phẩm',
      box_size: 'Brief: Kích thước hộp',
      box_face_confirm: 'Brief: Xác nhận mặt',
      style_mood: 'Brief: Phong cách',
      color_palette: 'Brief: Màu sắc',
      face_print_style: 'Brief: Phong cách hình ảnh',
      logo: 'Logo',
      box_flat: 'Hộp phẳng (dieline)',
      face_top: 'Mặt trên (L×W)',
      body_strip: 'Thân hộp liền (trước|phải|sau|trái)',
      face_front: 'Mặt trước (L×H)',
      face_right: 'Mặt bên phải (W×H)',
      face_bottom: 'Mặt dưới (L×W)',
      face_back: 'Mặt sau (L×H)',
      face_left: 'Mặt bên trái (W×H)',
      face_lxw: 'Mặt L×W (nắp/đáy)',
      face_lxh: 'Mặt L×H (trước/sau)',
      face_wxh: 'Mặt W×H (hai hông)',
      box_dieline_pdf: 'Dieline PDF kỹ thuật',
      box_mockup_3d: 'Mockup 3D hộp',
      product_label: 'Nhãn sản phẩm',
      seal_sticker: 'Tem niêm phong',
      barcode_label: 'Nhãn mã vạch',
    },
    asks: {
      brand_name: '① Tên thương hiệu / sản phẩm?',
      product_type: '② Sản phẩm đóng gói là gì? (mỹ phẩm, thực phẩm, quà tặng…)',
      box_size: '③ Kích thước hộp? Nhập dài × rộng × cao (cm) tự do — form bên dưới hoặc chat. Mỗi mặt tạo ảnh tỷ lệ gần thực tế nhất.',
      box_face_confirm:
        '④ Xác nhận kích thước mặt đáy, mặt trước/sau và mặt bên ở trên — trả lời OK hoặc nhập lại Dài×Rộng×Cao nếu sai thứ tự.',
      style_mood: '⑤ Phong cách: organic / luxury / minimal / playful?',
      color_palette: '⑥ Bảng màu in ấn?',
      face_print_style:
        '⑦ Chọn phong cách hình ảnh dùng đồng bộ cho cả 6 mặt hộp.',
      logo: 'Mô tả logo cần tạo in trên bao bì (dựa trên brief) — hoặc bấm **Tải logo** nếu đã có file.',
      box_flat: 'Hộp phẳng: layout mặt trước/side, vị trí logo?',
      face_top:
        '⑧ Mặt trên L×W — **Tải ảnh mặt** từ máy, mô tả nội dung in hoặc **bỏ trống**. Ảnh **full viền** (tràn lề), không ghi kích thước mm trên ảnh.',
      body_strip:
        '⑨ Thiết kế một dải thân liền theo thứ tự **trước | phải | sau | trái**. Họa tiết phải chạy liên tục qua nếp gấp; không vẽ đường bế, đường cấn hoặc tai hộp.',
      face_front:
        '⑨ Mặt trước L×H — **Tải ảnh mặt** hoặc mô tả nội dung in hoặc **bỏ trống**. Ảnh đầu ra: **file in phẳng**, không hộp 3D.',
      face_right:
        '⑩ Mặt bên phải W×H — **Tải ảnh mặt** hoặc mô tả nội dung in hoặc **bỏ trống**. Ảnh đầu ra: **file in phẳng**, không hộp 3D.',
      face_bottom:
        '⑪ Mặt dưới L×W — **Tải ảnh**, **bỏ trống**, **giống mặt trên**, hoặc mô tả nội dung in riêng.',
      face_back:
        '⑫ Mặt sau L×H — **Tải ảnh**, **bỏ trống**, **giống mặt trước**, hoặc mô tả nội dung in riêng.',
      face_left:
        '⑬ Mặt bên trái W×H — **Tải ảnh mặt** hoặc mô tả nội dung in hoặc **bỏ trống**. Ảnh đầu ra: **file in phẳng vuông/tròn tỷ lệ mặt**, full viền, **không hộp 3D**, không chai/lọ đặt trên nền carton.',
      face_lxw:
        'Mặt nắp/đáy L×W — nhập **nội dung in trên mặt này** (logo, tên SP, họa tiết…). Hệ thống sẽ tạo ảnh thiết kế.',
      face_lxh:
        'Mặt trước/sau L×H — nhập **nội dung in trên mặt này** (tên SP, số công bố, thành phần, công dụng…).',
      face_wxh:
        'Mặt hông W×H — nhập **nội dung in trên mặt này** (HDSD, cảnh báo, thành phần phụ…).',
      box_dieline_pdf: 'Kiểm tra thông số sản xuất rồi xuất Dieline PDF tỷ lệ 1:1.',
      box_mockup_3d:
        'Gõ **tạo mockup 3d** để duyệt hộp trước khi xuất Dieline PDF.',
      product_label: 'Nhãn dán SP (đen trắng): chọn kiểu + tỷ lệ khung bên dưới + nội dung (tên SP, thành phần, HDSD…). Chỉ ghép logo.',
      seal_sticker: 'Tem niêm phong: chọn kiểu + tỷ lệ khung bên dưới + slogan/mô tả. Chỉ ghép logo — không dùng ảnh mặt hộp.',
      barcode_label: 'Mã vạch thật: tự lấy tên SP từ brief; mã SP (vd. mã SP: 188-SRM-001). Mặc định Code128 — hoặc ghi EAN-13/QR nếu cần.',
    },
  },

  bag_kit: {
    title: 'Thiết kế túi đựng',
    kickoff:
      'Thiết kế túi giấy: Logo → **mặt sau & mặt trước** (cùng R×C) → **preview 3D** → net PDF. Chiều dày túi chỉ để mô phỏng, không in.',
    steps: {
      brand_name: 'Brief: Tên thương hiệu',
      product_type: 'Brief: Loại sản phẩm',
      bag_size: 'Brief: Kích thước túi',
      bag_panel_confirm: 'Brief: Xác nhận mặt in',
      style_mood: 'Brief: Phong cách',
      color_palette: 'Brief: Màu sắc',
      face_print_style: 'Brief: Phong cách hình ảnh',
      logo: 'Logo',
      face_back: 'Mặt sau in (R×C)',
      face_front: 'Mặt trước in (R×C)',
      bag_mockup_3d: 'Preview 3D túi',
      bag_dieline_pdf: 'Net túi PDF chuẩn in',
    },
    asks: {
      brand_name: '① Tên thương hiệu / sản phẩm?',
      product_type: '② Sản phẩm đựng trong túi là gì? (thực phẩm, quà tặng, thời trang…)',
      bag_size:
        '③ Kích thước: **rộng × cao × chiều dày** (R×C×dày, cm hoặc mm). R×C là 2 mặt in bằng nhau; **chiều dày không in** — chỉ cho net/3D.',
      bag_panel_confirm:
        '④ Xác nhận: mặt sau & mặt trước cùng R×C; chiều dày chỉ cấu trúc — trả lời **OK** hoặc nhập lại kích thước.',
      style_mood: '⑤ Phong cách: organic / luxury / minimal / playful?',
      color_palette: '⑥ Bảng màu in ấn?',
      face_print_style: '⑦ Chọn phong cách hình ảnh đồng bộ cho **cả 2 mặt in**.',
      logo: 'Mô tả logo in trên túi — hoặc **Tải logo** nếu đã có file.',
      face_back:
        '⑧ Mặt sau R×C — **Tải ảnh** hoặc mô tả nội dung in hoặc **bỏ trống**. Full viền, không ghi mm trên ảnh.',
      face_front:
        '⑨ Mặt trước R×C (cùng kích thước mặt sau) — **Tải ảnh**, **bỏ trống**, **giống mặt sau**, hoặc mô tả riêng.',
      bag_mockup_3d:
        'Preview 3D: túi đứng chụp thật — ghép art mặt trước/sau đã duyệt, chiều dày túi theo brief.',
      bag_dieline_pdf: 'Kiểm tra net triển khai (tham khảo) rồi xuất PDF chuẩn in.',
    },
    askExamples: {
      brand_name: 'Cafe Sáng — specialty coffee',
      product_type: 'Cà phê hạt & phụ kiện pha chế',
      bag_size: '200 × 280 × 60 mm',
      bag_panel_confirm: 'OK',
      style_mood: 'Minimal luxury — kraft + logo vàng',
      color_tone: 'Nâu kraft, chữ đen, accent vàng đồng',
      face_print_style: 'Flat illustration — line art tối giản',
    },
  },
  food_menu: {
    title: 'Thiết kế menu quán ăn',
    kickoff:
      'Thiết kế menu / thực đơn cho quán ăn, quán nước, cafe. Trả lời brief phong cách trước — sau đó nhập danh sách món và tạo menu.',
    steps: {
      venue_name: 'Brief: Tên quán',
      menu_type: 'Brief: Kiểu menu',
      food_illustration: 'Brief: Ảnh món',
      menu_style: 'Brief: Phong cách',
      color_tone: 'Brief: Tông màu',
      menu_design: 'Thiết kế menu',
      menu_a4_portrait: 'Menu A4 dọc — in ấn / treo tường',
      menu_a4_landscape: 'Menu A4 ngang — bảng lớn / spread',
      menu_table_tent: 'Menu bàn — tent vuông',
      menu_board_vertical: 'Bảng menu dọc — màn hình / LED',
      menu_board_wide: 'Bảng menu ngang — TV / màn rộng',
    },
    asks: {
      venue_name: '① Tên quán / thương hiệu hiển thị trên menu? (vd: Phở Bò Hà Nội, Cafe Sáng)',
      menu_type:
        '② Kiểu menu: treo tường A4, menu cuốn, bảng đứng, menu bàn (tent), menu digital trên màn hình?',
      food_illustration:
        '③ Có ảnh món trên menu không? (Có — ảnh chụp thật của món / Không — chỉ chữ & trang trí)',
      menu_style:
        '④ Phong cách: vintage / hiện đại / tối giản / truyền thống Việt / rustic / luxury cafe?',
      color_tone: '⑤ Tông màu ưu tiên? (vd: nâu gỗ + kem, xanh lá + trắng, đen vàng sang)',
      menu_design:
        'Nhập tên quán/thương hiệu, tải logo, chọn kiểu menu, thêm từng món (STT, tên, đơn vị, giá VND) — rồi «Tạo menu».',
    },
    askExamples: {
      venue_name: 'Phở Bò Hà Nội — 123 Lê Lợi',
      menu_type: 'Menu treo tường A4 dọc — in 2 mặt',
      food_illustration: 'Có — ảnh chụp thật của món bên cạnh tên món',
      menu_style: 'Truyền thống Việt hiện đại — typography rõ, viền trang trí nhẹ',
      color_tone: 'Nâu gỗ + kem ấm, chữ đen',
      menu_design: 'Phở bò 65.000đ · Bún chả 55.000đ · Cà phê sữa 25.000đ',
    },
  },

  catalog_photo_pack: {
    title: 'Ảnh bán hàng từ ảnh tự chụp',
    kickoff:
      'Tải ảnh sản phẩm bạn tự chụp (nghiệp dư cũng được). Mình hỏi chất liệu và kiểu ảnh, rồi dựng từng ảnh trong chat để bạn duyệt. Cuối cùng có tên và loại để copy đăng Facebook hoặc web khác — không đăng lên shop NanoAI.',
    uploadHint: 'Tải ảnh sản phẩm tự chụp (1–4 ảnh)',
    steps: {
      material: 'Brief: Chất liệu',
      product_kind: 'Brief: Loại hàng',
      shot_look: 'Brief: Kiểu ảnh',
      color_main: 'Ảnh màu chính',
      gallery_2: 'Ảnh góc 2',
      gallery_3: 'Ảnh góc 3',
      detail_close: 'Ảnh chi tiết',
      material_card: 'Ảnh chất liệu',
    },
    asks: {
      material: '① Chất liệu là gì? (bắt buộc — vd: cotton, da, lụa)',
      product_kind: '② Loại hàng và giới tính? (vd: áo thun nữ, giày nam, túi)',
      shot_look: '③ Kiểu ảnh: studio / lifestyle / ngoài trời — có người mẫu không? (vd: studio, chỉ sản phẩm)',
      color_main:
        'Gõ **tạo** để dựng ảnh màu chính từ ảnh bạn đã tải. Có thể thêm ý (nền trắng, sáng hơn…).',
      gallery_2: 'Gõ **tạo** để dựng ảnh góc 2. Có thể mô tả góc (nghiêng, sau lưng…).',
      gallery_3: 'Gõ **tạo** để dựng ảnh góc 3.',
      detail_close: 'Gõ **tạo** để dựng ảnh cận chi tiết (cúc, đường may, logo…).',
      material_card: 'Gõ **tạo** để dựng thẻ chất liệu. Duyệt xong mình gửi tên và loại để bạn copy.',
    },
  },
} as const
