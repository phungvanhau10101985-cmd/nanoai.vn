export const APPLY_COSTS = { '2K': 1.5, '4K': 3 } as const
export const ANALYZE_CREDIT = 0.5

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
