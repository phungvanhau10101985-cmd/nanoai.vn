export const APPLY_COSTS = { '2K': 1.5, '4K': 3 } as const
export const ANALYZE_CREDIT = 0.5
export type UiLocale = 'vi' | 'en' | 'zh' | 'ja' | 'ko'

/** Lựa chọn loại cửa – khách xác nhận giúp AI khi phân tích không rõ */
export const DOOR_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cửa nhà vệ sinh', label: 'Cửa nhà vệ sinh' },
  { value: 'cửa phòng ngủ', label: 'Cửa phòng ngủ' },
  { value: 'cửa chính', label: 'Cửa chính' },
  { value: 'cửa bếp', label: 'Cửa bếp' },
  { value: 'cửa đi ra ban công', label: 'Cửa đi ra ban công' },
  { value: 'cửa đi ra sân', label: 'Cửa đi ra sân' },
  { value: 'cửa đi ra vườn', label: 'Cửa đi ra vườn' },
  { value: 'cửa phòng tắm', label: 'Cửa phòng tắm' },
  { value: 'cửa tủ quần áo', label: 'Cửa tủ quần áo' },
  { value: 'cửa đi', label: 'Cửa đi (lối đi chung)' },
]

/** Lựa chọn loại cửa sổ */
export const WINDOW_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cửa sổ phòng khách', label: 'Cửa sổ phòng khách' },
  { value: 'cửa sổ phòng ngủ', label: 'Cửa sổ phòng ngủ' },
  { value: 'cửa sổ bếp', label: 'Cửa sổ bếp' },
  { value: 'cửa sổ bên trái', label: 'Cửa sổ bên trái' },
  { value: 'cửa sổ bên phải', label: 'Cửa sổ bên phải' },
  { value: 'cửa sổ giữa', label: 'Cửa sổ giữa' },
  { value: 'cửa sổ', label: 'Cửa sổ (chung)' },
]

/** Lựa chọn loại tường */
export const WALL_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tường ngăn phòng', label: 'Tường ngăn phòng (mỏng, có thể tủ âm)' },
  { value: 'tường chịu lực', label: 'Tường chịu lực (dày, không đục)' },
  { value: 'tường nhà vệ sinh', label: 'Tường nhà vệ sinh' },
  { value: 'tường bếp', label: 'Tường bếp' },
  { value: 'tường', label: 'Tường (chung)' },
]

/** Chủ đề kiến trúc thế giới - cho ngoại thất */
export const ARCH_THEMES: Record<string, string> = {
  'việt nam': 'Vietnamese traditional, tiled roof, wooden structure, tropical',
  'nhật bản': 'Japanese, minimal, wood, zen, traditional',
  'địa trung hải': 'Mediterranean, white walls, blue accents, terracotta',
  'bắc âu': 'Nordic Scandinavian, wood, clean, nature',
  'thuộc địa': 'Colonial, veranda, wooden shutters, tropical',
  'hiện đại': 'modern contemporary, glass, steel, clean lines',
  'tudor': 'Tudor English, half-timbered, steep roof',
  'victorian': 'Victorian, ornate, bay windows, decorative',
  'pháp': 'French, mansard roof, elegant, balconies',
  'đông nam á': 'Southeast Asian, tropical, open, natural materials',
  'maroc': 'Moroccan, arches, tile, courtyards',
  'phương đông': 'Eastern Asian, pagoda influence, harmony',
}

/** Màu chủ đạo không gian - cho nội thất & ngoại thất */
export const MAIN_COLORS: Record<string, string> = {
  'trắng': 'white, bright, clean',
  'be': 'beige, warm neutral, soft',
  'xám': 'gray, neutral, modern',
  'ấm': 'warm tones, cream, brown, cozy',
  'lạnh': 'cool tones, blue-gray, fresh',
  'tối': 'dark, charcoal, deep',
  'sáng': 'light, airy, bright',
  'pastel': 'pastel, soft colors',
  'tự nhiên': 'natural, wood tones, earth',
}

/** Loại phòng - cho nội thất (Full Redesign & Staging) */
export const ROOM_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'Tự động (AI nhận diện)' },
  { value: 'phong-khach', label: 'Phòng khách' },
  { value: 'phong-ngu', label: 'Phòng ngủ' },
  { value: 'phong-ngu-chinh', label: 'Phòng ngủ chính' },
  { value: 'phong-bep', label: 'Phòng bếp' },
  { value: 'phong-bep-lien-phong-an', label: 'Phòng bếp liền phòng ăn' },
  { value: 'phong-an', label: 'Phòng ăn' },
  { value: 'phong-tam', label: 'Phòng tắm' },
  { value: 'van-phong', label: 'Văn phòng' },
  { value: 'phong-lam-viec', label: 'Phòng làm việc tại nhà' },
  { value: 'phong-tre-em', label: 'Phòng trẻ em' },
  { value: 'phong-doc', label: 'Phòng đọc / Thư viện' },
  { value: 'hanh-lang', label: 'Hành lang' },
  { value: 'nha-kho', label: 'Nhà kho / Phòng chứa đồ' },
  { value: 'phong-khach-moi', label: 'Phòng khách (guest room)' },
  { value: 'ban-cong', label: 'Ban công / Sân thượng' },
  { value: 'khu-vuc-giao-nhau', label: 'Khu vực giao nhau (lối đi, lối ra ban công, cầu thang...)' },
]

/** Prompt staging chuẩn cho từng loại phòng - đồ đạc cơ bản */
export const ROOM_STAGING_PROMPTS: Record<string, string> = {
  'phong-khach': 'Living room with sofa, coffee table, TV unit or media console, plants, area rug, accent lighting.',
  'phong-ngu': 'Bedroom with bed, nightstands, soft bedding, wardrobe or closet, bedside lamps.',
  'phong-ngu-chinh': 'Master bedroom with king bed, nightstands, soft bedding, walk-in closet area, elegant lighting.',
  'phong-bep': 'Kitchen with island or counter, cabinets, bar stools, modern appliances (oven, fridge), backsplash.',
  'phong-bep-lien-phong-an': 'Open-plan kitchen and dining area: kitchen with island or counter, cabinets, appliances, seamlessly connected to dining table, chairs, pendant lighting. Unified, flowing space.',
  'phong-an': 'Dining room with dining table, chairs, centerpiece, pendant lighting, sideboard.',
  'phong-tam': 'Bathroom with vanity, mirror, shower or bathtub, tiles, fixtures, storage.',
  'van-phong': 'Office with desk, ergonomic chair, shelves, task lighting, filing storage.',
  'phong-lam-viec': 'Home office with desk, chair, shelves, plants, natural light, organized workspace.',
  'phong-tre-em': 'Kids room with bed, play area, storage, soft colors, safe furniture.',
  'phong-doc': 'Study or library with bookshelves, reading chair, desk, warm lighting.',
  'hanh-lang': 'Hallway with console table, mirror, lighting, minimal decor.',
  'nha-kho': 'Storage or utility room with shelves, organized storage, clean layout.',
  'phong-khach-moi': 'Guest room with bed, nightstand, simple decor, welcoming atmosphere.',
  'ban-cong': 'Balcony or terrace with outdoor furniture, plants, cozy seating.',
  'khu-vuc-giao-nhau': 'Transitional junction space – pathway to bedroom, balcony, stairs, living room. Not a specific room. Minimal decor: console table, mirror, plants, lighting. Keep flow clear – no furniture blocking passageways.',
}

/** Chế độ chọn đồ khi làm mới: AI tự quyết định | Khách chọn đồ */
export const FURNITURE_STAGING_MODES = [
  { value: 'ai', label: 'AI tự quyết định' },
  { value: 'custom', label: 'Khách chọn đồ' },
] as const

/** Chất liệu đồ nội thất – cho khách chọn */
export const FURNITURE_MATERIALS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'go-sang', label: 'Gỗ sáng', promptEn: 'light wood' },
  { value: 'go-toi', label: 'Gỗ tối', promptEn: 'dark wood' },
  { value: 'go-tu-nhien', label: 'Gỗ tự nhiên', promptEn: 'natural wood' },
  { value: 'da', label: 'Da', promptEn: 'leather' },
  { value: 'da-lon', label: 'Da lộn / Nỉ', promptEn: 'velvet, upholstered' },
  { value: 'vai', label: 'Vải bọc', promptEn: 'fabric upholstery' },
  { value: 'kim-loai', label: 'Kim loại', promptEn: 'metal' },
  { value: 'kinh', label: 'Kính', promptEn: 'glass' },
  { value: 'da-cam-thach', label: 'Đá cẩm thạch', promptEn: 'marble' },
  { value: 'da-granite', label: 'Đá granite', promptEn: 'granite' },
  { value: 'may-tre', label: 'Mây tre', promptEn: 'rattan, wicker' },
  { value: 'gom-su', label: 'Gốm sứ', promptEn: 'ceramic' },
]

/** Màu đồ nội thất – cho khách chọn */
export const FURNITURE_COLORS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'trang', label: 'Trắng', promptEn: 'white' },
  { value: 'den', label: 'Đen', promptEn: 'black' },
  { value: 'xam', label: 'Xám', promptEn: 'gray' },
  { value: 'xam-nhat', label: 'Xám nhạt', promptEn: 'light gray' },
  { value: 'xam-dam', label: 'Xám đậm', promptEn: 'dark gray' },
  { value: 'be', label: 'Be', promptEn: 'beige' },
  { value: 'kem', label: 'Kem', promptEn: 'cream' },
  { value: 'nau', label: 'Nâu', promptEn: 'brown' },
  { value: 'nau-sang', label: 'Nâu sáng', promptEn: 'light brown' },
  { value: 'nau-dam', label: 'Nâu đậm', promptEn: 'dark brown' },
  { value: 'xanh-navy', label: 'Xanh navy', promptEn: 'navy blue' },
  { value: 'xanh-duong', label: 'Xanh dương', promptEn: 'blue' },
  { value: 'xanh-nhat', label: 'Xanh nhạt', promptEn: 'light blue' },
  { value: 'xanh-la', label: 'Xanh lá', promptEn: 'green' },
  { value: 'xanh-reu', label: 'Xanh rêu', promptEn: 'sage green' },
  { value: 'xanh-ngoc', label: 'Xanh ngọc', promptEn: 'teal' },
  { value: 'do', label: 'Đỏ', promptEn: 'red' },
  { value: 'do-tim', label: 'Đỏ tía / Burgundy', promptEn: 'burgundy, wine' },
  { value: 'vang', label: 'Vàng', promptEn: 'yellow' },
  { value: 'vang-gold', label: 'Vàng gold', promptEn: 'gold' },
  { value: 'cam', label: 'Cam', promptEn: 'orange' },
  { value: 'tim', label: 'Tím', promptEn: 'purple' },
  { value: 'pastel', label: 'Pastel', promptEn: 'pastel' },
  { value: 'tu-nhien', label: 'Tự nhiên (gỗ)', promptEn: 'natural wood tone' },
]

/** Phong cách cho công trình / tiểu cảnh (chòi, bể bơi, mái che...) – không chọn chất liệu */
export const FURNITURE_STYLE_OPTIONS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'hien-dai', label: 'Hiện đại', promptEn: 'modern, clean lines' },
  { value: 'toi-gian', label: 'Tối giản', promptEn: 'minimalist, simple' },
  { value: 'nhiet-doi', label: 'Nhiệt đới', promptEn: 'tropical, natural' },
  { value: 'dong-que', label: 'Đồng quê', promptEn: 'rustic, farmhouse' },
  { value: 'truyen-thong', label: 'Truyền thống', promptEn: 'traditional, classic' },
  { value: 'ven-bien', label: 'Ven biển', promptEn: 'coastal, beach-inspired' },
  { value: 'nhat-ban', label: 'Nhật Bản / Zen', promptEn: 'Japanese, zen, natural' },
]

/** Vị trí đặt đồ sân vườn */
export const EXTERIOR_POSITION_OPTIONS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'goc-trai', label: 'Góc trái', promptEn: 'left corner' },
  { value: 'goc-phai', label: 'Góc phải', promptEn: 'right corner' },
  { value: 'goc-trai-tren', label: 'Góc trái trên', promptEn: 'top left corner' },
  { value: 'goc-phai-tren', label: 'Góc phải trên', promptEn: 'top right corner' },
  { value: 'goc-trai-duoi', label: 'Góc trái dưới', promptEn: 'bottom left corner' },
  { value: 'goc-phai-duoi', label: 'Góc phải dưới', promptEn: 'bottom right corner' },
  { value: 'giua', label: 'Giữa', promptEn: 'center' },
  { value: 'giua-canh-trai', label: 'Giữa cạnh trái', promptEn: 'center left' },
  { value: 'giua-canh-phai', label: 'Giữa cạnh phải', promptEn: 'center right' },
  { value: 'canh-trai', label: 'Cạnh trái', promptEn: 'left side' },
  { value: 'canh-phai', label: 'Cạnh phải', promptEn: 'right side' },
  { value: 'canh-tren', label: 'Cạnh trên', promptEn: 'top' },
  { value: 'canh-duoi', label: 'Cạnh dưới', promptEn: 'bottom' },
]

/** Hình dạng bể bơi */
export const POOL_SHAPE_OPTIONS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'vuong', label: 'Vuông', promptEn: 'square' },
  { value: 'chu-nhat', label: 'Chữ nhật', promptEn: 'rectangular' },
  { value: 'hinh-thue', label: 'Hình thận / Thuê', promptEn: 'kidney-shaped' },
  { value: 'tron', label: 'Tròn', promptEn: 'round, circular' },
]

/** Hướng bể bơi chữ nhật */
export const POOL_ORIENTATION_OPTIONS: { value: string; label: string; promptEn: string }[] = [
  { value: '', label: '— AI chọn —', promptEn: '' },
  { value: 'quay-ngang', label: 'Quay ngang', promptEn: 'horizontal orientation' },
  { value: 'quay-doc', label: 'Quay dọc', promptEn: 'vertical orientation' },
]

export type FurnitureSelectionType = 'material' | 'style' | 'none'

/** Danh sách đồ nội thất – khách chọn khi làm mới */
export const FURNITURE_ITEMS: { id: string; label: string; category: string; promptEn: string; selectionType?: FurnitureSelectionType }[] = [
  { id: 'sofa', label: 'Sofa / Ghế sofa', category: 'Phòng khách', promptEn: 'sofa', selectionType: 'material' },
  { id: 'ban-tra', label: 'Bàn trà', category: 'Phòng khách', promptEn: 'coffee table', selectionType: 'material' },
  { id: 'ke-tv', label: 'Kệ TV / Tủ TV', category: 'Phòng khách', promptEn: 'TV unit, media console', selectionType: 'material' },
  { id: 'ghe-don', label: 'Ghế đơn', category: 'Phòng khách', promptEn: 'armchair, accent chair', selectionType: 'material' },
  { id: 'ghe-sofa-goc', label: 'Ghế sofa góc', category: 'Phòng khách', promptEn: 'corner sofa, sectional', selectionType: 'material' },
  { id: 'tham', label: 'Thảm', category: 'Chung', promptEn: 'area rug', selectionType: 'material' },
  { id: 'cay-xanh', label: 'Cây xanh / Chậu cây', category: 'Chung', promptEn: 'indoor plants, potted plants', selectionType: 'none' },
  { id: 'den-dung', label: 'Đèn đứng / Đèn bàn', category: 'Chung', promptEn: 'floor lamp, table lamp', selectionType: 'material' },
  { id: 'den-treo', label: 'Đèn treo', category: 'Chung', promptEn: 'pendant lighting, chandelier', selectionType: 'material' },
  { id: 'giuong', label: 'Giường', category: 'Phòng ngủ', promptEn: 'bed', selectionType: 'material' },
  { id: 'tu-dau-giuong', label: 'Tủ đầu giường', category: 'Phòng ngủ', promptEn: 'nightstand, bedside table', selectionType: 'material' },
  { id: 'tu-quan-ao', label: 'Tủ quần áo', category: 'Phòng ngủ', promptEn: 'wardrobe, closet', selectionType: 'material' },
  { id: 'ban-an', label: 'Bàn ăn', category: 'Phòng ăn', promptEn: 'dining table', selectionType: 'material' },
  { id: 'ghe-an', label: 'Ghế ăn', category: 'Phòng ăn', promptEn: 'dining chairs', selectionType: 'material' },
  { id: 'tu-bep', label: 'Tủ bếp', category: 'Phòng bếp', promptEn: 'kitchen cabinets', selectionType: 'material' },
  { id: 'dao-bep', label: 'Đảo bếp / Bàn bếp', category: 'Phòng bếp', promptEn: 'kitchen island, counter', selectionType: 'material' },
  { id: 'ghe-bar', label: 'Ghế bar', category: 'Phòng bếp', promptEn: 'bar stools', selectionType: 'material' },
  { id: 'ban-lam-viec', label: 'Bàn làm việc', category: 'Văn phòng', promptEn: 'desk', selectionType: 'material' },
  { id: 'ghe-van-phong', label: 'Ghế văn phòng', category: 'Văn phòng', promptEn: 'office chair, ergonomic chair', selectionType: 'material' },
  { id: 'ke-sach', label: 'Kệ sách', category: 'Văn phòng', promptEn: 'bookshelf, shelving', selectionType: 'material' },
  { id: 'ban-console', label: 'Bàn console', category: 'Chung', promptEn: 'console table', selectionType: 'material' },
  { id: 'guong', label: 'Gương', category: 'Chung', promptEn: 'mirror', selectionType: 'material' },
  { id: 'tranh', label: 'Tranh / Nghệ thuật', category: 'Chung', promptEn: 'artwork, wall art', selectionType: 'material' },
  { id: 'tu-do', label: 'Tủ đồ / Kệ trang trí', category: 'Chung', promptEn: 'storage cabinet, display shelf', selectionType: 'material' },
  { id: 'bon-rua', label: 'Bồn rửa', category: 'Phòng tắm', promptEn: 'vanity, sink', selectionType: 'material' },
  { id: 'bon-tam', label: 'Bồn tắm', category: 'Phòng tắm', promptEn: 'bathtub', selectionType: 'material' },
  { id: 'voi-sen', label: 'Vòi sen', category: 'Phòng tắm', promptEn: 'shower', selectionType: 'material' },
  { id: 'rem', label: 'Rèm', category: 'Chung', promptEn: 'curtains, window treatment', selectionType: 'material' },
]

/** Danh sách đồ sân vườn / ngoại thất – khách chọn khi làm mới ngoại thất */
export const EXTERIOR_FURNITURE_ITEMS: { id: string; label: string; category: string; promptEn: string; selectionType: FurnitureSelectionType }[] = [
  { id: 'ghe-da', label: 'Ghế đá', category: 'Ghế & Bàn', promptEn: 'stone bench', selectionType: 'material' },
  { id: 'ghe-san-vuon', label: 'Ghế sân vườn', category: 'Ghế & Bàn', promptEn: 'garden chair', selectionType: 'material' },
  { id: 'ban-san-vuon', label: 'Bàn sân vườn', category: 'Ghế & Bàn', promptEn: 'garden table', selectionType: 'material' },
  { id: 'bo-ban-ghe-go', label: 'Bộ bàn ghế gỗ', category: 'Ghế & Bàn', promptEn: 'wooden outdoor furniture set', selectionType: 'material' },
  { id: 'xich-du', label: 'Xích đu', category: 'Ghế & Bàn', promptEn: 'swing, garden swing', selectionType: 'material' },
  { id: 'ghe-may', label: 'Ghế mây / Ghế mây tre', category: 'Ghế & Bàn', promptEn: 'rattan chair', selectionType: 'material' },
  { id: 'cuc-da', label: 'Cục đá / Đá trang trí', category: 'Đá & Đá cảnh', promptEn: 'decorative rocks, garden stones', selectionType: 'style' },
  { id: 'da-lat-duong', label: 'Đá lát đường / Sỏi', category: 'Đá & Đá cảnh', promptEn: 'stepping stones, gravel path', selectionType: 'style' },
  { id: 'non-bo', label: 'Non bộ / Đá cảnh', category: 'Đá & Đá cảnh', promptEn: 'rock garden, zen stones', selectionType: 'style' },
  { id: 'chau-cay-ngoai', label: 'Chậu cây / Chậu hoa', category: 'Cây cảnh', promptEn: 'potted plants, flower pots', selectionType: 'material' },
  { id: 'cay-canh', label: 'Cây cảnh / Cây bonsai', category: 'Cây cảnh', promptEn: 'ornamental plants, bonsai', selectionType: 'none' },
  { id: 'bui-cay-hoa', label: 'Bụi cây hoa', category: 'Cây cảnh', promptEn: 'flower bushes, flowering shrubs', selectionType: 'style' },
  { id: 'bui-chuoi', label: 'Bụi chuối', category: 'Cây cảnh', promptEn: 'banana plant, banana tree', selectionType: 'none' },
  { id: 'bui-tre', label: 'Bụi tre', category: 'Cây cảnh', promptEn: 'bamboo grove, bamboo cluster', selectionType: 'none' },
  { id: 'bui-truc', label: 'Bụi trúc', category: 'Cây cảnh', promptEn: 'bamboo cluster, small bamboo grove', selectionType: 'none' },
  { id: 'gian-hoa', label: 'Giàn hoa / Dây leo', category: 'Cây cảnh', promptEn: 'trellis, climbing plants', selectionType: 'style' },
  { id: 'thung-xanh', label: 'Thùng xanh / Chậu gỗ', category: 'Cây cảnh', promptEn: 'planter box, wooden planters', selectionType: 'material' },
  { id: 'den-san-vuon', label: 'Đèn sân vườn', category: 'Đèn & Trang trí', promptEn: 'garden lighting, outdoor lamp', selectionType: 'material' },
  { id: 'den-duong', label: 'Đèn đường / Đèn cột', category: 'Đèn & Trang trí', promptEn: 'path light, post lamp', selectionType: 'material' },
  { id: 'tuong-trang-tri', label: 'Tượng trang trí', category: 'Đèn & Trang trí', promptEn: 'garden statue, sculpture', selectionType: 'material' },
  { id: 'ho-nuoc', label: 'Hồ nước / Tiểu cảnh nước', category: 'Tiểu cảnh', promptEn: 'water feature, pond', selectionType: 'style' },
  { id: 'voi-phun-nuoc', label: 'Vòi phun nước', category: 'Tiểu cảnh', promptEn: 'fountain', selectionType: 'style' },
  { id: 'be-ca', label: 'Bể cá / Hồ cá', category: 'Tiểu cảnh', promptEn: 'fish pond, koi pond', selectionType: 'style' },
  { id: 'be-boi', label: 'Bể bơi', category: 'Tiểu cảnh', promptEn: 'swimming pool', selectionType: 'style' },
  { id: 'mai-che', label: 'Mái che / Ô dù', category: 'Che chắn', promptEn: 'pergola, umbrella, shade', selectionType: 'style' },
  { id: 'mai-tre-xe', label: 'Mái tre xe / Mái che xe', category: 'Che chắn', promptEn: 'carport, thatched roof shelter, bamboo shade for parking', selectionType: 'style' },
  { id: 'hang-rao', label: 'Hàng rào', category: 'Che chắn', promptEn: 'fence, garden fence', selectionType: 'material' },
  { id: 'choi-uong-nuoc', label: 'Chòi uống nước', category: 'Khác', promptEn: 'drinking water pavilion, water station gazebo', selectionType: 'style' },
  { id: 'bbq-ngoai-troi', label: 'Bếp BBQ / Khu vực nướng', category: 'Khác', promptEn: 'outdoor BBQ grill, barbecue area', selectionType: 'material' },
  { id: 'lo-suoi-ngoai', label: 'Lò sưởi ngoài trời', category: 'Khác', promptEn: 'outdoor fireplace, fire pit', selectionType: 'material' },
  { id: 'cau-thang-da', label: 'Cầu thang đá / Bậc đá', category: 'Khác', promptEn: 'stone steps', selectionType: 'material' },
]

/** Nhãn hiển thị phong cách (tiếng Việt) */
export const INTERIOR_STYLE_LABELS: Record<string, string> = {
  'hiện đại': 'Hiện đại',
  'tối giản': 'Tối giản',
  'bắc âu': 'Bắc Âu (Scandinavian)',
  'cổ điển': 'Cổ điển',
  'công nghiệp': 'Công nghiệp',
  'nhiệt đới': 'Nhiệt đới',
  'phóng khoáng': 'Phóng khoáng (Bohemian)',
  'đồng quê': 'Đồng quê',
  'retro': 'Retro (Thập niên 60)',
  'sang trọng': 'Sang trọng',
  'ven biển': 'Ven biển',
  'nhật-bắc âu': 'Nhật - Bắc Âu (Japandi)',
  'art deco': 'Art Deco',
  'cổ điển phai màu': 'Cổ điển phai màu',
  'đương đại': 'Đương đại',
}

/** Phong cách nội thất - nhãn tiếng Việt cho người dùng, prompt tiếng Anh cho AI */
export const INTERIOR_STYLES: Record<string, string> = {
  'hiện đại': 'modern minimalist, clean lines, neutral colors, contemporary',
  'tối giản': 'minimalist, sparse, functional, monochrome',
  'bắc âu': 'Scandinavian, light wood, white, cozy, natural',
  'cổ điển': 'classic traditional, elegant, warm wood, ornate',
  'công nghiệp': 'industrial, exposed brick, metal, raw',
  'nhiệt đới': 'tropical, plants, natural materials, bright',
  'phóng khoáng': 'bohemian, eclectic, textiles, layered, artistic',
  'đồng quê': 'farmhouse, rustic wood, shiplap, cozy, country',
  'retro': 'mid-century modern, organic shapes, warm wood, retro',
  'sang trọng': 'luxury, high-end materials, marble, velvet, sophisticated',
  'ven biển': 'coastal, beach-inspired, light, airy, blue accents',
  'nhật-bắc âu': 'Japandi, Japanese minimalism meets Scandinavian, zen, natural',
  'art deco': 'Art Deco, geometric, bold, glamorous, gold accents',
  'cổ điển phai màu': 'shabby chic, distressed, vintage, soft pastels',
  'đương đại': 'contemporary, current trends, mixed materials, dynamic',
}

const MAIN_COLOR_LABELS: Record<string, Record<UiLocale, string>> = {
  'trắng': { vi: 'Trắng', en: 'White', zh: '白色', ja: '白', ko: '화이트' },
  be: { vi: 'Be', en: 'Beige', zh: '米色', ja: 'ベージュ', ko: '베이지' },
  'xám': { vi: 'Xám', en: 'Gray', zh: '灰色', ja: 'グレー', ko: '회색' },
  'ấm': { vi: 'Ấm', en: 'Warm', zh: '暖色', ja: '暖色', ko: '따뜻한 톤' },
  'lạnh': { vi: 'Lạnh', en: 'Cool', zh: '冷色', ja: '寒色', ko: '차가운 톤' },
  'tối': { vi: 'Tối', en: 'Dark', zh: '深色', ja: 'ダーク', ko: '다크' },
  'sáng': { vi: 'Sáng', en: 'Light', zh: '浅色', ja: 'ライト', ko: '라이트' },
  pastel: { vi: 'Pastel', en: 'Pastel', zh: '粉彩', ja: 'パステル', ko: '파스텔' },
  'tự nhiên': { vi: 'Tự nhiên', en: 'Natural', zh: '自然色', ja: 'ナチュラル', ko: '내추럴' },
}

const ARCH_THEME_LABELS: Record<string, Record<UiLocale, string>> = {
  'việt nam': { vi: 'Việt Nam', en: 'Vietnamese', zh: '越南', ja: 'ベトナム', ko: '베트남' },
  'nhật bản': { vi: 'Nhật Bản', en: 'Japanese', zh: '日式', ja: '日本式', ko: '일본식' },
  'địa trung hải': { vi: 'Địa Trung Hải', en: 'Mediterranean', zh: '地中海', ja: '地中海', ko: '지중해' },
  'bắc âu': { vi: 'Bắc Âu', en: 'Scandinavian', zh: '北欧', ja: '北欧', ko: '북유럽' },
  'thuộc địa': { vi: 'Thuộc địa', en: 'Colonial', zh: '殖民风', ja: 'コロニアル', ko: '콜로니얼' },
  'hiện đại': { vi: 'Hiện đại', en: 'Modern', zh: '现代', ja: 'モダン', ko: '모던' },
  tudor: { vi: 'Tudor', en: 'Tudor', zh: '都铎', ja: 'チューダー', ko: '튜더' },
  victorian: { vi: 'Victorian', en: 'Victorian', zh: '维多利亚', ja: 'ビクトリアン', ko: '빅토리안' },
  'pháp': { vi: 'Pháp', en: 'French', zh: '法式', ja: 'フレンチ', ko: '프렌치' },
  'đông nam á': { vi: 'Đông Nam Á', en: 'Southeast Asian', zh: '东南亚', ja: '東南アジア', ko: '동남아' },
  maroc: { vi: 'Maroc', en: 'Moroccan', zh: '摩洛哥', ja: 'モロッコ', ko: '모로코' },
  'phương đông': { vi: 'Phương Đông', en: 'Eastern', zh: '东方风', ja: '東洋風', ko: '동양풍' },
}

const ROOM_TYPE_LABELS: Record<string, Record<UiLocale, string>> = {
  '': { vi: 'Tự động (AI nhận diện)', en: 'Auto (AI detect)', zh: '自动（AI识别）', ja: '自動（AI認識）', ko: '자동 (AI 인식)' },
  'phong-khach': { vi: 'Phòng khách', en: 'Living room', zh: '客厅', ja: 'リビング', ko: '거실' },
  'phong-ngu': { vi: 'Phòng ngủ', en: 'Bedroom', zh: '卧室', ja: '寝室', ko: '침실' },
  'phong-ngu-chinh': { vi: 'Phòng ngủ chính', en: 'Master bedroom', zh: '主卧', ja: '主寝室', ko: '안방' },
  'phong-bep': { vi: 'Phòng bếp', en: 'Kitchen', zh: '厨房', ja: 'キッチン', ko: '주방' },
  'phong-bep-lien-phong-an': { vi: 'Bếp liền phòng ăn', en: 'Kitchen + dining', zh: '厨餐一体', ja: 'キッチン＋ダイニング', ko: '주방+다이닝' },
  'phong-an': { vi: 'Phòng ăn', en: 'Dining room', zh: '餐厅', ja: 'ダイニング', ko: '식당' },
  'phong-tam': { vi: 'Phòng tắm', en: 'Bathroom', zh: '浴室', ja: 'バスルーム', ko: '욕실' },
  'van-phong': { vi: 'Văn phòng', en: 'Office', zh: '办公室', ja: 'オフィス', ko: '사무실' },
  'phong-lam-viec': { vi: 'Phòng làm việc', en: 'Home office', zh: '家庭办公', ja: 'ホームオフィス', ko: '홈오피스' },
  'phong-tre-em': { vi: 'Phòng trẻ em', en: 'Kids room', zh: '儿童房', ja: '子ども部屋', ko: '어린이방' },
  'phong-doc': { vi: 'Phòng đọc / Thư viện', en: 'Study / library', zh: '书房/图书室', ja: '書斎/ライブラリ', ko: '서재/라이브러리' },
  'hanh-lang': { vi: 'Hành lang', en: 'Hallway', zh: '走廊', ja: '廊下', ko: '복도' },
  'nha-kho': { vi: 'Nhà kho / Phòng chứa đồ', en: 'Storage room', zh: '储物间', ja: '収納室', ko: '창고' },
  'phong-khach-moi': { vi: 'Phòng khách (guest room)', en: 'Guest room', zh: '客房', ja: 'ゲストルーム', ko: '게스트룸' },
  'ban-cong': { vi: 'Ban công / Sân thượng', en: 'Balcony / terrace', zh: '阳台/露台', ja: 'バルコニー/テラス', ko: '발코니/테라스' },
  'khu-vuc-giao-nhau': { vi: 'Khu vực giao nhau', en: 'Transition area', zh: '过渡区域', ja: '接続エリア', ko: '연결 구역' },
}

const FURNITURE_CATEGORY_LABELS: Record<string, Record<UiLocale, string>> = {
  'Phòng khách': { vi: 'Phòng khách', en: 'Living room', zh: '客厅', ja: 'リビング', ko: '거실' },
  'Chung': { vi: 'Chung', en: 'General', zh: '通用', ja: '共通', ko: '공통' },
  'Phòng ngủ': { vi: 'Phòng ngủ', en: 'Bedroom', zh: '卧室', ja: '寝室', ko: '침실' },
  'Phòng ăn': { vi: 'Phòng ăn', en: 'Dining room', zh: '餐厅', ja: 'ダイニング', ko: '식당' },
  'Phòng bếp': { vi: 'Phòng bếp', en: 'Kitchen', zh: '厨房', ja: 'キッチン', ko: '주방' },
  'Văn phòng': { vi: 'Văn phòng', en: 'Office', zh: '办公室', ja: 'オフィス', ko: '사무실' },
  'Phòng tắm': { vi: 'Phòng tắm', en: 'Bathroom', zh: '浴室', ja: 'バスルーム', ko: '욕실' },
  'Ghế & Bàn': { vi: 'Ghế & Bàn', en: 'Chairs & Tables', zh: '桌椅', ja: '椅子・テーブル', ko: '의자·테이블' },
  'Đá & Đá cảnh': { vi: 'Đá & Đá cảnh', en: 'Rocks', zh: '景石', ja: '石材', ko: '돌/암석' },
  'Cây cảnh': { vi: 'Cây cảnh', en: 'Plants', zh: '植物', ja: '植物', ko: '식물' },
  'Đèn & Trang trí': { vi: 'Đèn & Trang trí', en: 'Lighting & Decor', zh: '灯光与装饰', ja: '照明・装飾', ko: '조명·장식' },
  'Tiểu cảnh': { vi: 'Tiểu cảnh', en: 'Landscape features', zh: '景观元素', ja: '景観要素', ko: '조경 요소' },
  'Che chắn': { vi: 'Che chắn', en: 'Cover & shade', zh: '遮挡', ja: '日よけ', ko: '차양/가림' },
  'Khác': { vi: 'Khác', en: 'Other', zh: '其他', ja: 'その他', ko: '기타' },
}

export function getMainColorLabel(key: string, locale: UiLocale): string {
  return MAIN_COLOR_LABELS[key]?.[locale] || MAIN_COLOR_LABELS[key]?.en || key
}

export function getArchThemeLabel(key: string, locale: UiLocale): string {
  return ARCH_THEME_LABELS[key]?.[locale] || ARCH_THEME_LABELS[key]?.en || key
}

export function getRoomTypeLabel(value: string, locale: UiLocale): string {
  return ROOM_TYPE_LABELS[value]?.[locale] || ROOM_TYPE_LABELS[value]?.en || value
}

export function getInteriorStyleLabel(value: string, locale: UiLocale): string {
  if (locale === 'vi') return INTERIOR_STYLE_LABELS[value] || value
  return value
}

export function getFurnitureCategoryLabel(category: string, locale: UiLocale): string {
  return FURNITURE_CATEGORY_LABELS[category]?.[locale] || FURNITURE_CATEGORY_LABELS[category]?.en || category
}

export function getOptionLabel(
  option: { value: string; label: string; promptEn?: string },
  locale: UiLocale
): string {
  if (locale === 'vi') return option.label
  return option.promptEn || option.label
}

export function getFurnitureItemLabel(
  item: { label: string; promptEn: string },
  locale: UiLocale
): string {
  return locale === 'vi' ? item.label : item.promptEn
}
