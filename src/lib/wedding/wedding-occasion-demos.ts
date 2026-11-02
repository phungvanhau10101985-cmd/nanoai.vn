/**
 * Mỗi loại thiệp có demo riêng. Trong một loại, nền, ảnh khách và hoa văn không trùng nhau.
 * Mẫu cưới / hỏi / kỷ niệm dùng thiệp đã có ảnh. Loại một người là mẫu alias: cùng bộ hoa của một nền, ảnh khách riêng.
 * Sinh nhật thêm mẫu nữ hoa hồng, kính hồng và mẫu nam.
 */
import type { InvitationOccasionKey } from '@/lib/wedding/invitation-occasion'
import { INVITATION_OCCASION_KEYS, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'
import type { WeddingSampleCard, WeddingSampleTitle } from '@/lib/wedding/wedding-sample-cards'

export const OCCASION_DEMO_IDS: Record<InvitationOccasionKey, readonly string[]> = {
  wedding: ['long-phung-do', 'sen-vang', 'vuon-kinh-hong', 'toi-gian-nau', 'hoa-moc-xanh'],
  engagement: ['hong-ngoc-trai', 'vuon-hong-troi', 'to-duyen-xanh', 'hoa-dao', 'lua-ao-dai'],
  anniversary: ['dem-vang', 'van-mieu', 'do-dam', 'bien', 'lang-bac'],
  full_month: ['day-thang-sen', 'day-thang-ngoc', 'day-thang-moc', 'day-thang-troi', 'day-thang-nau'],
  first_birthday: ['thoi-noi-dao', 'thoi-noi-tre', 'thoi-noi-vuon', 'thoi-noi-que', 'thoi-noi-lua'],
  birthday: ['sinh-nhat-hong', 'sinh-nhat-kinh', 'sinh-nhat-son', 'sinh-nhat-tre', 'sinh-nhat-dem', 'sinh-nhat-bien', 'sinh-nhat-lua', 'sinh-nhat-cho', 'sinh-nhat-hoa'],
  longevity: ['mung-tho-hy', 'mung-tho-son', 'mung-tho-chua', 'mung-tho-van', 'mung-tho-long'],
  grand_opening: ['khai-truong-son', 'khai-truong-dem', 'khai-truong-cho', 'khai-truong-hy', 'khai-truong-sen'],
  housewarming: ['tan-gia-duong', 'tan-gia-que', 'tan-gia-tre', 'tan-gia-lua', 'tan-gia-nau'],
  gathering: ['lien-hoan-bien', 'lien-hoan-troi', 'lien-hoan-dem', 'lien-hoan-moc', 'lien-hoan-tre'],
  graduation: ['tot-nghiep-van', 'tot-nghiep-lang', 'tot-nghiep-chua', 'tot-nghiep-moc', 'tot-nghiep-nau'],
  ceremony: ['su-kien-halong', 'su-kien-chua', 'su-kien-long', 'su-kien-dem', 'su-kien-van'],
}

type People = { groom: string; bride: string; groomAccount: string; brideAccount: string }

/** Tên mẫu khách. Mỗi demo một cặp tên, không dùng lại trong cùng loại. */
export const DEMO_PEOPLE: Record<string, People> = {
  'long-phung-do': { groom: 'Nguyễn Minh', bride: 'Trần Lan', groomAccount: 'NGUYEN VAN MINH', brideAccount: 'TRAN THI LAN' },
  'sen-vang': { groom: 'Lê Hoàng', bride: 'Phạm Hà', groomAccount: 'LE VAN HOANG', brideAccount: 'PHAM THI HA' },
  'vuon-kinh-hong': { groom: 'Đỗ Khôi', bride: 'Ngô Mai', groomAccount: 'DO VAN KHOI', brideAccount: 'NGO THI MAI' },
  'toi-gian-nau': { groom: 'Bùi An', bride: 'Lý Chi', groomAccount: 'BUI VAN AN', brideAccount: 'LY THI CHI' },
  'hoa-moc-xanh': { groom: 'Võ Nam', bride: 'Đặng Vy', groomAccount: 'VO VAN NAM', brideAccount: 'DANG THI VY' },
  'hong-ngoc-trai': { groom: 'Phan Khánh', bride: 'Trịnh My', groomAccount: 'PHAN VAN KHANH', brideAccount: 'TRINH THI MY' },
  'vuon-hong-troi': { groom: 'Huỳnh Lâm', bride: 'Tô Vy', groomAccount: 'HUYNH VAN LAM', brideAccount: 'TO THI VY' },
  'to-duyen-xanh': { groom: 'Dương Khang', bride: 'Mai Liên', groomAccount: 'DUONG VAN KHANG', brideAccount: 'MAI THI LIEN' },
  'hoa-dao': { groom: 'Trịnh Bảo', bride: 'Lưu Nhi', groomAccount: 'TRINH VAN BAO', brideAccount: 'LUU THI NHI' },
  'lua-ao-dai': { groom: 'Hồ Đạt', bride: 'Kiều An', groomAccount: 'HO VAN DAT', brideAccount: 'KIEU THI AN' },
  'dem-vang': { groom: 'Quách Huy', bride: 'Đoàn Hà', groomAccount: 'QUACH VAN HUY', brideAccount: 'DOAN THI HA' },
  'van-mieu': { groom: 'Tạ Minh', bride: 'Châu Linh', groomAccount: 'TA VAN MINH', brideAccount: 'CHAU THI LINH' },
  'do-dam': { groom: 'Lương Khôi', bride: 'Phùng Chi', groomAccount: 'LUONG VAN KHOI', brideAccount: 'PHUNG THI CHI' },
  bien: { groom: 'Hà Phong', bride: 'Tăng My', groomAccount: 'HA VAN PHONG', brideAccount: 'TANG THI MY' },
  'lang-bac': { groom: 'Đinh Khoa', bride: 'Vũ Lan', groomAccount: 'DINH VAN KHOA', brideAccount: 'VU THI LAN' },
  'day-thang-sen': { groom: 'Bé Lê An', bride: 'Chị Lê Hà', groomAccount: 'LE THI HA', brideAccount: 'LE VAN MINH' },
  'day-thang-ngoc': { groom: 'Bé Phạm Chi', bride: 'Chị Phạm My', groomAccount: 'PHAM THI MY', brideAccount: 'PHAM VAN NAM' },
  'day-thang-moc': { groom: 'Bé Ngô Đăng', bride: 'Chị Ngô Vy', groomAccount: 'NGO THI VY', brideAccount: 'NGO VAN AN' },
  'day-thang-troi': { groom: 'Bé Đỗ Khôi', bride: 'Chị Đỗ Lan', groomAccount: 'DO THI LAN', brideAccount: 'DO VAN KHOI' },
  'day-thang-nau': { groom: 'Bé Bùi Nhi', bride: 'Chị Bùi Mai', groomAccount: 'BUI THI MAI', brideAccount: 'BUI VAN NAM' },
  'thoi-noi-dao': { groom: 'Bé Trần Bình', bride: 'Anh Trần Khôi', groomAccount: 'TRAN VAN KHOI', brideAccount: 'TRAN THI HA' },
  'thoi-noi-tre': { groom: 'Bé Lý An', bride: 'Chị Lý Chi', groomAccount: 'LY THI CHI', brideAccount: 'LY VAN MINH' },
  'thoi-noi-vuon': { groom: 'Bé Võ Mai', bride: 'Anh Võ Nam', groomAccount: 'VO VAN NAM', brideAccount: 'VO THI MAI' },
  'thoi-noi-que': { groom: 'Bé Hoàng Vy', bride: 'Chị Hoàng Liên', groomAccount: 'HOANG THI LIEN', brideAccount: 'HOANG VAN AN' },
  'thoi-noi-lua': { groom: 'Bé Phan Đăng', bride: 'Anh Phan Khang', groomAccount: 'PHAN VAN KHANG', brideAccount: 'PHAN THI MY' },
  'sinh-nhat-hong': { groom: 'Phan My', bride: '', groomAccount: 'PHAN THI MY', brideAccount: '' },
  'sinh-nhat-kinh': { groom: 'Đặng Liên', bride: '', groomAccount: 'DANG THI LIEN', brideAccount: '' },
  'sinh-nhat-son': { groom: 'Trần Khôi', bride: '', groomAccount: 'TRAN VAN KHOI', brideAccount: '' },
  'sinh-nhat-tre': { groom: 'Lê Dũng', bride: '', groomAccount: 'LE VAN DUNG', brideAccount: '' },
  'sinh-nhat-dem': { groom: 'Ngô Quỳnh', bride: '', groomAccount: 'NGO THI QUYNH', brideAccount: '' },
  'sinh-nhat-bien': { groom: 'Trịnh Hà', bride: '', groomAccount: 'TRINH THI HA', brideAccount: '' },
  'sinh-nhat-lua': { groom: 'Mai Chi', bride: '', groomAccount: 'MAI THI CHI', brideAccount: '' },
  'sinh-nhat-cho': { groom: 'Lưu Vy', bride: '', groomAccount: 'LUU THI VY', brideAccount: '' },
  'sinh-nhat-hoa': { groom: 'Kiều My', bride: '', groomAccount: 'KIEU THI MY', brideAccount: '' },
  'mung-tho-hy': { groom: 'Bà Nguyễn Thị Lan', bride: 'Anh Nguyễn Minh', groomAccount: 'NGUYEN THI LAN', brideAccount: 'NGUYEN VAN MINH' },
  'mung-tho-son': { groom: 'Ông Trần Văn An', bride: 'Chị Trần Hà', groomAccount: 'TRAN VAN AN', brideAccount: 'TRAN THI HA' },
  'mung-tho-chua': { groom: 'Bà Lê Thị Bình', bride: 'Anh Lê Hoàng', groomAccount: 'LE THI BINH', brideAccount: 'LE VAN HOANG' },
  'mung-tho-van': { groom: 'Ông Phạm Văn Cường', bride: 'Chị Phạm My', groomAccount: 'PHAM VAN CUONG', brideAccount: 'PHAM THI MY' },
  'mung-tho-long': { groom: 'Bà Đỗ Thị Dung', bride: 'Anh Đỗ Khôi', groomAccount: 'DO THI DUNG', brideAccount: 'DO VAN KHOI' },
  'khai-truong-son': { groom: 'Tiệm Hoa Sen', bride: 'Chị Lê Hà', groomAccount: 'LE THI HA', brideAccount: 'LE VAN MINH' },
  'khai-truong-dem': { groom: 'Quán Đêm Vàng', bride: 'Anh Quách Huy', groomAccount: 'QUACH VAN HUY', brideAccount: 'QUACH THI HA' },
  'khai-truong-cho': { groom: 'Hiệu Bánh Chợ', bride: 'Chị Lưu Vy', groomAccount: 'LUU THI VY', brideAccount: 'LUU VAN NAM' },
  'khai-truong-hy': { groom: 'Nhà May Đỏ', bride: 'Anh Trần Khôi', groomAccount: 'TRAN VAN KHOI', brideAccount: 'TRAN THI LAN' },
  'khai-truong-sen': { groom: 'Studio Sen Vàng', bride: 'Chị Phạm Hà', groomAccount: 'PHAM THI HA', brideAccount: 'PHAM VAN HOANG' },
  'tan-gia-duong': { groom: 'Anh Hồ Đạt', bride: 'Chị Kiều An', groomAccount: 'HO VAN DAT', brideAccount: 'KIEU THI AN' },
  'tan-gia-que': { groom: 'Chị Mai Liên', bride: 'Anh Dương Khang', groomAccount: 'MAI THI LIEN', brideAccount: 'DUONG VAN KHANG' },
  'tan-gia-tre': { groom: 'Anh Võ Nam', bride: 'Chị Đặng Vy', groomAccount: 'VO VAN NAM', brideAccount: 'DANG THI VY' },
  'tan-gia-lua': { groom: 'Chị Lý Chi', bride: 'Anh Bùi An', groomAccount: 'LY THI CHI', brideAccount: 'BUI VAN AN' },
  'tan-gia-nau': { groom: 'Anh Tạ Minh', bride: 'Chị Châu Linh', groomAccount: 'TA VAN MINH', brideAccount: 'CHAU THI LINH' },
  'lien-hoan-bien': { groom: 'Tiệc biển Hà Phong', bride: 'Chị Tăng My', groomAccount: 'HA VAN PHONG', brideAccount: 'TANG THI MY' },
  'lien-hoan-troi': { groom: 'Liên hoan vườn', bride: 'Anh Huỳnh Lâm', groomAccount: 'HUYNH VAN LAM', brideAccount: 'TO THI VY' },
  'lien-hoan-dem': { groom: 'Tiệc tối Đêm Vàng', bride: 'Chị Đoàn Hà', groomAccount: 'DOAN THI HA', brideAccount: 'QUACH VAN HUY' },
  'lien-hoan-moc': { groom: 'Bàn tiệc lá xanh', bride: 'Anh Ngô An', groomAccount: 'NGO VAN AN', brideAccount: 'NGO THI VY' },
  'lien-hoan-tre': { groom: 'Liên hoan hiên tre', bride: 'Chị Phan My', groomAccount: 'PHAN THI MY', brideAccount: 'PHAN VAN KHANG' },
  'tot-nghiep-van': { groom: 'Nguyễn Khôi', bride: 'Bà Nguyễn Lan', groomAccount: 'NGUYEN VAN KHOI', brideAccount: 'NGUYEN THI LAN' },
  'tot-nghiep-lang': { groom: 'Trần Mai', bride: 'Ông Trần An', groomAccount: 'TRAN THI MAI', brideAccount: 'TRAN VAN AN' },
  'tot-nghiep-chua': { groom: 'Lê Vy', bride: 'Bà Lê Bình', groomAccount: 'LE THI VY', brideAccount: 'LE THI BINH' },
  'tot-nghiep-moc': { groom: 'Phạm Đăng', bride: 'Ông Phạm Cường', groomAccount: 'PHAM VAN DANG', brideAccount: 'PHAM VAN CUONG' },
  'tot-nghiep-nau': { groom: 'Đỗ Chi', bride: 'Bà Đỗ Dung', groomAccount: 'DO THI CHI', brideAccount: 'DO THI DUNG' },
  'su-kien-halong': { groom: 'Hội thảo Vịnh Xanh', bride: 'Chị Hà My', groomAccount: 'HA THI MY', brideAccount: 'HA VAN PHONG' },
  'su-kien-chua': { groom: 'Lễ sen chùa', bride: 'Anh Lê Hoàng', groomAccount: 'LE VAN HOANG', brideAccount: 'LE THI HA' },
  'su-kien-long': { groom: 'Lễ khai mạc đỏ', bride: 'Chị Trần Lan', groomAccount: 'TRAN THI LAN', brideAccount: 'TRAN VAN MINH' },
  'su-kien-dem': { groom: 'Đêm nhạc vàng', bride: 'Anh Quách Huy', groomAccount: 'QUACH VAN HUY', brideAccount: 'DOAN THI HA' },
  'su-kien-van': { groom: 'Hội nghị mùa mai', bride: 'Chị Châu Linh', groomAccount: 'CHAU THI LINH', brideAccount: 'TA VAN MINH' },
}

type Copy = {
  invitation: string
  invitationEn: string
  intro: string
  quote: string
  story: string
  thanks: string
  timeline: string
  venue: string
  parents: string
}

const COPY: Record<InvitationOccasionKey, Copy> = {
  wedding: {
    invitation: 'Trân trọng kính mời quý khách đến dự lễ thành hôn của {couple}.',
    invitationEn: 'We joyfully invite you to the wedding celebration of {couple}.',
    intro: 'Hai gia đình hân hoan báo tin lễ thành hôn của con chúng tôi.',
    quote: 'Có những yêu thương không cần quá ồn ào, chỉ cần đủ chân thành để cùng nhau đi hết cuộc đời.',
    story: '{groom} và {bride} gặp nhau một chiều cuối thu, rồi cùng đi qua những ngày bình thường bằng sự tử tế và tiếng cười. Hôm nay hai người mời quý khách chứng kiến lúc mình chính thức về chung một nhà.',
    thanks: '{couple} xin cảm ơn quý khách đã đến chung vui. Sự hiện diện và lời chúc của quý khách là món quà quý nhất của hai gia đình.',
    timeline: '17:00 | Đón khách\n17:30 | Lễ thành hôn\n18:00 | Khai tiệc\n19:30 | Cảm ơn và chia tay',
    venue: 'Số 12 phố Huế, Hai Bà Trưng, Hà Nội',
    parents: 'Hai gia đình',
  },
  engagement: {
    invitation: 'Trân trọng kính mời quý khách đến dự lễ đám hỏi của {couple}.',
    invitationEn: 'You are cordially invited to the engagement celebration of {couple}.',
    intro: 'Hai gia đình trân trọng báo tin lễ đám hỏi của con chúng tôi.',
    quote: 'Một lời hứa nhỏ, nói trước mặt hai nhà, đủ để bắt đầu những ngày sau này.',
    story: '{groom} và {bride} muốn lễ đám hỏi vừa đủ ấm, có mặt những người đã đi cùng hai gia đình. Trà, trầu và câu chuyện sẽ được kể chậm rãi trong buổi này.',
    thanks: '{couple} xin cảm ơn quý khách đã đến chung vui lễ đám hỏi. Lời chúc của quý khách theo hai gia đình về nhà.',
    timeline: '10:00 | Đón khách\n10:30 | Lễ đám hỏi\n11:30 | Tiệc thân mật\n13:00 | Cảm ơn và chia tay',
    venue: 'Số 18 phố Hàng Bạc, Hoàn Kiếm, Hà Nội',
    parents: 'Hai gia đình',
  },
  anniversary: {
    invitation: 'Trân trọng kính mời quý khách đến dự ngày kỷ niệm của {couple}.',
    invitationEn: 'You are invited to the anniversary celebration of {couple}.',
    intro: '{couple} mời quý khách cùng nhớ một cột mốc đã đi qua cùng nhau.',
    quote: 'Những năm đã qua không cần kể hết. Chỉ cần hôm nay có mặt những người mình quý.',
    story: '{groom} và {bride} chọn một bữa tối chậm để cảm ơn nhau và cảm ơn những người đã ngồi cùng bàn trong suốt chặng đường ấy.',
    thanks: '{couple} xin cảm ơn quý khách đã đến chung vui ngày kỷ niệm.',
    timeline: '18:00 | Đón khách\n18:30 | Nâng ly\n19:00 | Bữa tối\n21:00 | Cảm ơn và chia tay',
    venue: 'Số 5 phố Nguyễn Thái Học, Ba Đình, Hà Nội',
    parents: 'Gia đình',
  },
  full_month: {
    invitation: 'Trân trọng kính mời quý khách đến dự tiệc đầy tháng của {groom}.',
    invitationEn: 'You are invited to the full-month celebration of {groom}.',
    intro: 'Gia đình {bride} trân trọng mời quý khách đến thăm bé và dùng bữa đầy tháng.',
    quote: 'Một tháng đầu đời rất ngắn. Buổi tiệc này là để cảm ơn những người đã hỏi thăm bé.',
    story: 'Bé chào đời đủ tháng. Gia đình dọn một mâm nhỏ, nấu những món nhà quen, và muốn quý khách gặp bé trước khi bé kịp lớn thêm.',
    thanks: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc đầy tháng của bé.',
    timeline: '10:30 | Đón khách\n11:00 | Ra mắt bé\n11:30 | Tiệc trưa\n13:00 | Cảm ơn và chia tay',
    venue: 'Số 9 ngõ Thái Hà, Đống Đa, Hà Nội',
    parents: 'Bố mẹ bé',
  },
  first_birthday: {
    invitation: 'Trân trọng kính mời quý khách đến dự tiệc thôi nôi của {groom}.',
    invitationEn: 'You are invited to the first-birthday celebration of {groom}.',
    intro: 'Gia đình mời quý khách đến thôi nôi, xem bé chọn đồ và dùng bữa cùng nhà.',
    quote: 'Một tuổi rất ngắn với người lớn, và rất dài với một đứa bé đang tập đứng.',
    story: 'Đủ một năm, bé đã biết với tay về phía người thân. Gia đình bày mâm thôi nôi và muốn quý khách có mặt trong buổi bé được chọn món đồ đầu tiên.',
    thanks: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc thôi nôi.',
    timeline: '10:00 | Đón khách\n10:30 | Lễ thôi nôi\n11:30 | Tiệc trưa\n13:30 | Cảm ơn và chia tay',
    venue: 'Số 22 phố Láng Hạ, Đống Đa, Hà Nội',
    parents: 'Bố mẹ bé',
  },
  birthday: {
    invitation: 'Trân trọng kính mời quý khách đến dự tiệc sinh nhật của {groom}.',
    invitationEn: 'You are invited to the birthday celebration of {groom}.',
    intro: '{groom} mời quý khách một bữa sinh nhật vừa đủ bạn bè, không cần quá đông.',
    quote: 'Thêm một tuổi. Điều đáng giữ là những người vẫn ngồi lại sau khi nến tắt.',
    story: 'Buổi tiệc được dọn tại một bàn nhỏ. Có bánh, có nhạc thấp, và vài câu chuyện chưa kể hết từ năm trước.',
    thanks: '{groom} xin cảm ơn quý khách đã đến chung vui ngày sinh nhật.',
    timeline: '18:30 | Đón khách\n19:00 | Thổi nến\n19:30 | Bữa tối\n21:30 | Cảm ơn và chia tay',
    venue: 'Số 14 phố Tuệ Tĩnh, Hai Bà Trưng, Hà Nội',
    parents: 'Gia đình',
  },
  longevity: {
    invitation: 'Trân trọng kính mời quý khách đến dự lễ mừng thọ của {groom}.',
    invitationEn: 'You are respectfully invited to the longevity celebration of {groom}.',
    intro: 'Con cháu trong nhà kính mời quý khách đến mừng thọ, dùng cơm và nói chuyện cùng gia đình.',
    quote: 'Tuổi thêm không cần cờ hoa. Chỉ cần trong nhà còn chỗ ngồi cho người lớn tuổi và người đến thăm.',
    story: 'Gia đình dọn mâm theo cách nhà vẫn dọn ngày giỗ và ngày tết. Buổi mừng thọ lần này mời thêm những người đã đi lại với nhà nhiều năm.',
    thanks: 'Gia đình xin cảm ơn quý khách đã đến chung vui lễ mừng thọ.',
    timeline: '10:30 | Đón khách\n11:00 | Chúc thọ\n11:30 | Tiệc trưa\n13:30 | Cảm ơn và chia tay',
    venue: 'Số 7 phố Hàng Nón, Hoàn Kiếm, Hà Nội',
    parents: 'Con cháu',
  },
  grand_opening: {
    invitation: 'Trân trọng kính mời quý khách đến dự khai trương {groom}.',
    invitationEn: 'You are invited to the opening of {groom}.',
    intro: '{bride} thay mặt cửa hàng mời quý khách đến thăm ngày đầu mở cửa.',
    quote: 'Ngày khai trương chỉ là ngày cửa mở. Những ngày sau mới là lúc cửa hàng học cách đón người.',
    story: 'Cửa hàng được dọn xong sau nhiều tuần sửa đèn, kệ và biển hiệu. Buổi khai trương có trà, có vài món nhà làm, và một vòng xem không gian thật.',
    thanks: '{groom} xin cảm ơn quý khách đã đến chung vui ngày khai trương.',
    timeline: '09:00 | Mở cửa\n09:30 | Cắt băng\n10:00 | Mời khách tham quan\n11:30 | Cảm ơn và hẹn gặp lại',
    venue: 'Số 40 phố Huế, Hai Bà Trưng, Hà Nội',
    parents: 'Người đại diện',
  },
  housewarming: {
    invitation: 'Trân trọng kính mời quý khách đến dự tiệc tân gia của {groom}.',
    invitationEn: 'You are invited to the housewarming of {groom}.',
    intro: 'Nhà mới vừa kê xong bàn. {groom} mời quý khách đến ngồi chơi và dùng bữa.',
    quote: 'Nhà mới chỉ thật sự là nhà khi đã có người bước vào, cởi giày và ngồi lại.',
    story: 'Bữa tân gia nấu tại nhà, không thuê sảnh. Có canh, có món mặn, và một vòng xem các phòng còn thơm mùi gỗ mới.',
    thanks: 'Gia đình xin cảm ơn quý khách đã đến chung vui tiệc tân gia.',
    timeline: '11:00 | Đón khách\n11:30 | Xem nhà\n12:00 | Cơm trưa\n14:00 | Cảm ơn và chia tay',
    venue: 'Số 3 ngõ 68 Cầu Giấy, Cầu Giấy, Hà Nội',
    parents: 'Chủ nhà',
  },
  gathering: {
    invitation: 'Trân trọng kính mời quý khách đến dự {groom}.',
    invitationEn: 'You are invited to {groom}.',
    intro: 'Ban tổ chức mời mọi người một bữa liên hoan để gặp lại và ăn một bữa đủ no.',
    quote: 'Liên hoan không cần chương trình dài. Cần một bàn mà người ngồi còn nhận ra nhau.',
    story: 'Buổi tiệc xếp theo bàn tròn, món đưa lần lượt, nhạc vừa đủ để nói chuyện. Ai bận có thể đến muộn, bàn vẫn giữ chỗ.',
    thanks: 'Ban tổ chức xin cảm ơn quý khách đã đến chung vui buổi tiệc.',
    timeline: '18:00 | Đón khách\n18:30 | Khai tiệc\n19:30 | Giao lưu\n21:00 | Cảm ơn và chia tay',
    venue: 'Số 15 phố Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
    parents: 'Ban tổ chức',
  },
  graduation: {
    invitation: 'Trân trọng kính mời quý khách đến dự lễ tốt nghiệp của {groom}.',
    invitationEn: 'You are invited to the graduation celebration of {groom}.',
    intro: 'Gia đình mời quý khách đến mừng {groom} vừa học xong một chặng.',
    quote: 'Tấm bằng là một mốc. Bữa cơm này là để cảm ơn những người đã hỏi bài và hỏi thăm.',
    story: '{groom} kết thúc khóa học sau nhiều mùa thi. Gia đình dọn một bữa nhỏ, không sân khấu, để khách nhìn thấy mặt người tốt nghiệp chứ không chỉ thấy hoa.',
    thanks: 'Gia đình xin cảm ơn quý khách đã đến chung vui lễ tốt nghiệp.',
    timeline: '17:30 | Đón khách\n18:00 | Chụp ảnh\n18:30 | Tiệc tối\n20:30 | Cảm ơn và chia tay',
    venue: 'Số 26 phố Quốc Tử Giám, Đống Đa, Hà Nội',
    parents: 'Gia đình',
  },
  ceremony: {
    invitation: 'Trân trọng kính mời quý khách đến dự {groom}.',
    invitationEn: 'You are invited to {groom}.',
    intro: 'Ban tổ chức kính mời quý khách đến dự buổi lễ đúng giờ đã ghi trên thiệp.',
    quote: 'Một buổi lễ gọn khi khách đến đúng, nghe rõ và còn chỗ ngồi.',
    story: 'Chương trình có phần chào, phần trình bày và phần mời khách trao đổi. Không kê thêm tiết mục ngoài những mục đã in trong lịch.',
    thanks: 'Ban tổ chức xin cảm ơn quý khách đã đến tham dự.',
    timeline: '08:00 | Đón khách\n08:30 | Khai mạc\n10:00 | Thảo luận\n11:30 | Bế mạc',
    venue: 'Số 1 phố Hoàng Diệu, Ba Đình, Hà Nội',
    parents: 'Ban tổ chức',
  },
}

function fill(text: string, groom: string, bride: string) {
  const couple = bride ? `${groom} và ${bride}` : groom
  return text.replaceAll('{couple}', couple).replaceAll('{groom}', groom).replaceAll('{bride}', bride)
}

export function weddingSampleDemoFacts(sample: { id: string; occasionKey?: string }) {
  const people = DEMO_PEOPLE[sample.id]
  const occasion = normalizeInvitationOccasion(sample.occasionKey || 'wedding')
  if (!people && occasion === 'wedding') {
    return {
      groomName: 'Nguyễn Minh',
      brideName: 'Trần Lan',
      invitationText: 'Trân trọng kính mời quý khách đến dự lễ thành hôn của Nguyễn Minh và Trần Lan.',
      invitationTextEn: 'We joyfully invite you to the wedding celebration of Nguyen Minh and Tran Lan.',
      coupleIntro: 'Hai gia đình hân hoan báo tin lễ thành hôn của con chúng tôi.',
      loveQuote: 'Có những yêu thương không cần quá ồn ào, chỉ cần đủ chân thành để cùng nhau đi hết cuộc đời.',
      storyText: 'Minh và Lan gặp nhau một chiều cuối thu, rồi cùng đi qua những ngày bình thường bằng sự tử tế và tiếng cười. Hôm nay hai người mời quý khách chứng kiến lúc mình chính thức về chung một nhà.',
      thankYouText: 'Nguyễn Minh và Trần Lan xin cảm ơn quý khách đã đến chung vui. Sự hiện diện và lời chúc của quý khách là món quà quý nhất của hai gia đình.',
      eventTimeline: COPY.wedding.timeline,
      venue: COPY.wedding.venue,
      groomParents: 'Ông Nguyễn Văn An và Bà Lê Thị Bình',
      brideParents: 'Ông Trần Văn Cường và Bà Phạm Thị Dung',
      groomGiftAccountName: 'NGUYEN VAN MINH',
      brideGiftAccountName: 'TRAN THI LAN',
    }
  }
  const groom = people?.groom || 'Nguyễn Minh'
  const bride = people ? people.bride : 'Trần Lan'
  const copy = COPY[occasion]
  return {
    groomName: groom,
    brideName: bride,
    invitationText: fill(copy.invitation, groom, bride),
    invitationTextEn: fill(copy.invitationEn, groom, bride),
    coupleIntro: fill(copy.intro, groom, bride),
    loveQuote: copy.quote,
    storyText: fill(copy.story, groom, bride),
    thankYouText: fill(copy.thanks, groom, bride),
    eventTimeline: copy.timeline,
    venue: copy.venue,
    groomParents: copy.parents,
    brideParents: occasion === 'wedding' || occasion === 'engagement' ? 'Hai bên gia đình' : '',
    groomGiftAccountName: people?.groomAccount || 'NGUYEN VAN MINH',
    brideGiftAccountName: people ? people.brideAccount : 'TRAN THI LAN',
  }
}

function titles(vi: string, en: string, zh: string, ja: string, ko: string): WeddingSampleTitle {
  return { vi, en, zh, ja, ko }
}

function alias(input: {
  id: string
  backgroundPresetId: string
  occasionKey: InvitationOccasionKey
  titles: WeddingSampleTitle
  dressCode: string
  /** Sinh nhật một người không gắn ảnh thứ hai. */
  hideSecondPortrait?: boolean
}): WeddingSampleCard {
  const folder = `/wedding/samples/${input.id}`
  return {
    id: input.id,
    backgroundPresetId: input.backgroundPresetId,
    occasionKey: input.occasionKey,
    titles: input.titles,
    dressCode: input.dressCode,
    coverPhotoUrl: `${folder}/cover.png`,
    groomImageUrl: `${folder}/groom.png`,
    brideImageUrl: input.hideSecondPortrait ? '' : `${folder}/bride.png`,
    albumImageUrls: [`${folder}/album-1.png`, `${folder}/album-2.png`],
    coverPhotoPositionY: 0,
  }
}

/** Ảnh khách riêng cho loại một người. Nền và hoa lấy từ preset đã có. */
export const OCCASION_ALIAS_SAMPLES: readonly WeddingSampleCard[] = [
  alias({ id: 'day-thang-sen', backgroundPresetId: 'sen-vang', occasionKey: 'full_month', titles: titles('Sen kem', 'Cream lotus', '奶油莲', 'クリームの蓮', '크림 연꽃'), dressCode: 'Trang phục lịch sự, tông kem, trắng hoặc vàng sen.' }),
  alias({ id: 'day-thang-ngoc', backgroundPresetId: 'hong-ngoc-trai', occasionKey: 'full_month', titles: titles('Ngọc trai', 'Pearl', '珍珠', '真珠', '진주'), dressCode: 'Trang phục lịch sự, tông hồng phấn hoặc kem.' }),
  alias({ id: 'day-thang-moc', backgroundPresetId: 'hoa-moc-xanh', occasionKey: 'full_month', titles: titles('Lá xanh', 'Green leaves', '绿叶', '緑の葉', '초록 잎'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh lá nhạt.' }),
  alias({ id: 'day-thang-troi', backgroundPresetId: 'vuon-hong-troi', occasionKey: 'full_month', titles: titles('Trời hồng', 'Pink sky', '粉天', 'ピンクの空', '분홍 하늘'), dressCode: 'Trang phục lịch sự, tông hồng nhạt hoặc trắng.' }),
  alias({ id: 'day-thang-nau', backgroundPresetId: 'toi-gian-nau', occasionKey: 'full_month', titles: titles('Kem nâu', 'Warm cream', '暖米', '暖かい生成り', '따뜻한 크림'), dressCode: 'Trang phục lịch sự, tông kem hoặc be.' }),
  alias({ id: 'thoi-noi-dao', backgroundPresetId: 'hoa-dao', occasionKey: 'first_birthday', titles: titles('Hoa đào', 'Peach blossom', '桃花', '桃の花', '복숭아꽃'), dressCode: 'Trang phục lịch sự, tông hồng đào hoặc kem.' }),
  alias({ id: 'thoi-noi-tre', backgroundPresetId: 'tre-viet', occasionKey: 'first_birthday', titles: titles('Tre xanh', 'Bamboo', '翠竹', '青竹', '대나무'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh tre.' }),
  alias({ id: 'thoi-noi-vuon', backgroundPresetId: 'vuon-kinh-hong', occasionKey: 'first_birthday', titles: titles('Vườn hồng', 'Rose garden', '玫瑰园', 'バラ園', '장미 정원'), dressCode: 'Trang phục lịch sự, tông hồng phấn hoặc trắng.' }),
  alias({ id: 'thoi-noi-que', backgroundPresetId: 'que-nghe-an', occasionKey: 'first_birthday', titles: titles('Quê', 'Countryside', '乡野', '里山', '시골'), dressCode: 'Trang phục lịch sự, tông kem hoặc xanh cau.' }),
  alias({ id: 'thoi-noi-lua', backgroundPresetId: 'lua-ao-dai', occasionKey: 'first_birthday', titles: titles('Lụa', 'Silk', '丝绸', '絹', '비단'), dressCode: 'Trang phục lịch sự, tông trắng hoặc lụa ngà.' }),
  alias({ id: 'sinh-nhat-hong', backgroundPresetId: 'vuon-hong-troi', occasionKey: 'birthday', titles: titles('Hoa hồng', 'Roses', '玫瑰', 'バラ', '장미'), dressCode: 'Trang phục lịch sự, tông hồng phấn hoặc kem.', hideSecondPortrait: true }),
  alias({ id: 'sinh-nhat-kinh', backgroundPresetId: 'vuon-kinh-hong', occasionKey: 'birthday', titles: titles('Kính hồng', 'Glass roses', '玻璃玫瑰', 'ガラスのバラ', '유리 장미'), dressCode: 'Trang phục lịch sự, tông hồng hoặc trắng.', hideSecondPortrait: true }),
  alias({ id: 'sinh-nhat-son', backgroundPresetId: 'do-son', occasionKey: 'birthday', titles: titles('Đỏ son', 'Scarlet', '正红', '朱色', '진홍'), dressCode: 'Trang phục lịch sự, áo khoác tối, tông đỏ son hoặc đen.', hideSecondPortrait: true }),
  alias({ id: 'sinh-nhat-tre', backgroundPresetId: 'tre-viet', occasionKey: 'birthday', titles: titles('Tre', 'Bamboo', '翠竹', '青竹', '대나무'), dressCode: 'Trang phục lịch sự, áo linen hoặc khoác tối, tông xanh tre hoặc kem.', hideSecondPortrait: true }),
  alias({ id: 'sinh-nhat-dem', backgroundPresetId: 'dem-vang', occasionKey: 'birthday', titles: titles('Đêm vàng', 'Gold night', '金夜', '金の夜', '금빛 밤'), dressCode: 'Trang phục lịch sự, tông đen, kem hoặc vàng.' }),
  alias({ id: 'sinh-nhat-bien', backgroundPresetId: 'bien', occasionKey: 'birthday', titles: titles('Biển', 'Sea', '海', '海', '바다'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh biển.' }),
  alias({ id: 'sinh-nhat-lua', backgroundPresetId: 'lua-ao-dai', occasionKey: 'birthday', titles: titles('Lụa', 'Silk', '丝绸', '絹', '비단'), dressCode: 'Trang phục lịch sự, tông kem hoặc lụa ngà.' }),
  alias({ id: 'sinh-nhat-cho', backgroundPresetId: 'cho-ben-thanh', occasionKey: 'birthday', titles: titles('Sắc chợ', 'Market color', '市集色', '市場の色', '시장 색'), dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc đỏ đất.' }),
  alias({ id: 'sinh-nhat-hoa', backgroundPresetId: 'phong-bi-thu', occasionKey: 'birthday', titles: titles('Mẫu đơn', 'Peony', '牡丹', '牡丹', '모란'), dressCode: 'Trang phục lịch sự, tông đỏ đô, kem hoặc trắng.' }),
  alias({ id: 'mung-tho-hy', backgroundPresetId: 'song-hy-do', occasionKey: 'longevity', titles: titles('Đỏ truyền thống', 'Traditional red', '传统红', '伝統の赤', '전통 빨강'), dressCode: 'Trang phục lịch sự, tông đỏ, kem hoặc vàng.' }),
  alias({ id: 'mung-tho-son', backgroundPresetId: 'do-son', occasionKey: 'longevity', titles: titles('Đỏ son', 'Scarlet', '正红', '朱色', '진홍'), dressCode: 'Trang phục lịch sự, tông đỏ son hoặc kem.' }),
  alias({ id: 'mung-tho-chua', backgroundPresetId: 'chua-mot-cot', occasionKey: 'longevity', titles: titles('Sen chùa', 'Temple lotus', '寺莲', '寺の蓮', '절의 연꽃'), dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc vàng sen.' }),
  alias({ id: 'mung-tho-van', backgroundPresetId: 'van-mieu', occasionKey: 'longevity', titles: titles('Mai vàng', 'Apricot blossom', '黄梅', '梅', '매화'), dressCode: 'Trang phục lịch sự, tông kem, nâu hoặc vàng mai.' }),
  alias({ id: 'mung-tho-long', backgroundPresetId: 'long-phung-do', occasionKey: 'longevity', titles: titles('Long phụng', 'Dragon and phoenix', '龙凤', '龍鳳', '용봉'), dressCode: 'Trang phục lịch sự, tông đỏ đô hoặc vàng nhạt.' }),
  alias({ id: 'khai-truong-son', backgroundPresetId: 'do-son', occasionKey: 'grand_opening', titles: titles('Đỏ khai trương', 'Opening red', '开业红', '開店の赤', '개업 빨강'), dressCode: 'Trang phục lịch sự, tông đỏ hoặc kem.' }),
  alias({ id: 'khai-truong-dem', backgroundPresetId: 'dem-vang', occasionKey: 'grand_opening', titles: titles('Đêm vàng', 'Gold night', '金夜', '金の夜', '금빛 밤'), dressCode: 'Trang phục lịch sự, tông đen, kem hoặc vàng.' }),
  alias({ id: 'khai-truong-cho', backgroundPresetId: 'cho-ben-thanh', occasionKey: 'grand_opening', titles: titles('Phố chợ', 'Market street', '市场街', '市場通り', '시장 거리'), dressCode: 'Trang phục lịch sự, tông kem, vàng hoặc đỏ đất.' }),
  alias({ id: 'khai-truong-hy', backgroundPresetId: 'song-hy-do', occasionKey: 'grand_opening', titles: titles('Đỏ may', 'Lucky red', '喜庆红', '祝いの赤', '경사 빨강'), dressCode: 'Trang phục lịch sự, tông đỏ hoặc vàng.' }),
  alias({ id: 'khai-truong-sen', backgroundPresetId: 'sen-vang', occasionKey: 'grand_opening', titles: titles('Sen vàng', 'Gold lotus', '金莲', '金の蓮', '금색 연꽃'), dressCode: 'Trang phục lịch sự, tông kem hoặc vàng.' }),
  alias({ id: 'tan-gia-duong', backgroundPresetId: 'duong-lam', occasionKey: 'housewarming', titles: titles('Nhà cổ', 'Old house', '老屋', '古い家', '옛집'), dressCode: 'Trang phục lịch sự, tông kem hoặc nâu đất.' }),
  alias({ id: 'tan-gia-que', backgroundPresetId: 'que-nghe-an', occasionKey: 'housewarming', titles: titles('Sân quê', 'Country yard', '乡院', '田舎の庭', '시골 마당'), dressCode: 'Trang phục lịch sự, tông kem hoặc xanh cau.' }),
  alias({ id: 'tan-gia-tre', backgroundPresetId: 'tre-viet', occasionKey: 'housewarming', titles: titles('Hiên tre', 'Bamboo porch', '竹廊', '竹の縁側', '대나무 마루'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh tre.' }),
  alias({ id: 'tan-gia-lua', backgroundPresetId: 'lua-ao-dai', occasionKey: 'housewarming', titles: titles('Rèm lụa', 'Silk curtain', '绸帘', '絹のカーテン', '비단 커튼'), dressCode: 'Trang phục lịch sự, tông kem hoặc lụa ngà.' }),
  alias({ id: 'tan-gia-nau', backgroundPresetId: 'toi-gian-nau', occasionKey: 'housewarming', titles: titles('Nhà kem', 'Cream house', '米色的家', '生成りの家', '크림색 집'), dressCode: 'Trang phục lịch sự, tông kem hoặc be.' }),
  alias({ id: 'lien-hoan-bien', backgroundPresetId: 'bien', occasionKey: 'gathering', titles: titles('Tiệc biển', 'Sea dinner', '海边宴', '海の食事', '바닷가 만찬'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh biển.' }),
  alias({ id: 'lien-hoan-troi', backgroundPresetId: 'vuon-hong-troi', occasionKey: 'gathering', titles: titles('Vườn trời', 'Open garden', '天光花园', '空の庭', '하늘 정원'), dressCode: 'Trang phục lịch sự, tông hồng nhạt hoặc trắng.' }),
  alias({ id: 'lien-hoan-dem', backgroundPresetId: 'dem-vang', occasionKey: 'gathering', titles: titles('Tiệc tối', 'Evening party', '晚宴', '夜の宴', '저녁 파티'), dressCode: 'Trang phục lịch sự, tông đen, kem hoặc vàng.' }),
  alias({ id: 'lien-hoan-moc', backgroundPresetId: 'hoa-moc-xanh', occasionKey: 'gathering', titles: titles('Bàn lá', 'Leaf table', '叶桌', '葉の食卓', '잎 식탁'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh lá nhạt.' }),
  alias({ id: 'lien-hoan-tre', backgroundPresetId: 'tre-viet', occasionKey: 'gathering', titles: titles('Hiên tre', 'Bamboo porch', '竹廊', '竹の縁側', '대나무 마루'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh tre.' }),
  alias({ id: 'tot-nghiep-van', backgroundPresetId: 'van-mieu', occasionKey: 'graduation', titles: titles('Văn miếu', 'Temple of Literature', '文庙', '文廟', '문묘'), dressCode: 'Trang phục lịch sự, tông kem, nâu hoặc đen tốt nghiệp.' }),
  alias({ id: 'tot-nghiep-lang', backgroundPresetId: 'lang-bac', occasionKey: 'graduation', titles: titles('Sen hồ', 'Lake lotus', '湖莲', '湖の蓮', '호수 연꽃'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh lá nhạt.' }),
  alias({ id: 'tot-nghiep-chua', backgroundPresetId: 'chua-mot-cot', occasionKey: 'graduation', titles: titles('Sân chùa', 'Temple yard', '寺院', '寺の庭', '절 마당'), dressCode: 'Trang phục lịch sự, tông trắng hoặc kem.' }),
  alias({ id: 'tot-nghiep-moc', backgroundPresetId: 'hoa-moc-xanh', occasionKey: 'graduation', titles: titles('Lá xanh', 'Green leaves', '绿叶', '緑の葉', '초록 잎'), dressCode: 'Trang phục lịch sự, tông trắng hoặc xanh lá nhạt.' }),
  alias({ id: 'tot-nghiep-nau', backgroundPresetId: 'toi-gian-nau', occasionKey: 'graduation', titles: titles('Tối giản', 'Minimal', '极简', 'ミニマル', '미니멀'), dressCode: 'Trang phục lịch sự, tông kem, be hoặc đen.' }),
  alias({ id: 'su-kien-halong', backgroundPresetId: 'vinh-ha-long', occasionKey: 'ceremony', titles: titles('Vịnh', 'Bay', '海湾', '湾', '만'), dressCode: 'Trang phục lịch sự, tông trắng, kem hoặc xanh.' }),
  alias({ id: 'su-kien-chua', backgroundPresetId: 'chua-mot-cot', occasionKey: 'ceremony', titles: titles('Thềm sen', 'Lotus steps', '莲阶', '蓮の階段', '연꽃 계단'), dressCode: 'Trang phục lịch sự, tông trắng hoặc kem.' }),
  alias({ id: 'su-kien-long', backgroundPresetId: 'long-phung-do', occasionKey: 'ceremony', titles: titles('Đỏ lễ', 'Ceremony red', '典礼红', '式典の赤', '식전 빨강'), dressCode: 'Trang phục lịch sự, tông đỏ đô hoặc kem.' }),
  alias({ id: 'su-kien-dem', backgroundPresetId: 'dem-vang', occasionKey: 'ceremony', titles: titles('Đêm vàng', 'Gold night', '金夜', '金の夜', '금빛 밤'), dressCode: 'Trang phục lịch sự, tông đen, kem hoặc vàng.' }),
  alias({ id: 'su-kien-van', backgroundPresetId: 'van-mieu', occasionKey: 'ceremony', titles: titles('Hội trường', 'Hall', '会场', '会場', '행사장'), dressCode: 'Trang phục lịch sự, tông kem, nâu hoặc đen.' }),
]

export function occasionDemoIdList(): string[] {
  return INVITATION_OCCASION_KEYS.flatMap((key) => [...OCCASION_DEMO_IDS[key]])
}
