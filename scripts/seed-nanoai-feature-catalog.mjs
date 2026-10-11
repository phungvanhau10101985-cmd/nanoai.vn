/**
 * Danh mục shop NanoAI trên server: mỗi tính năng đang mở cho khách = 1 sản phẩm đủ cột catalog.
 * Ảnh đại diện + ảnh chi tiết tải lên Bunny. Chạy trên VPS trong /var/www/Thu-do-online.
 *
 *   node scripts/seed-nanoai-feature-catalog.mjs
 */
import { createRequire } from 'node:module'
import { randomInt, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = process.env.APP_ROOT || '/var/www/Thu-do-online'
const require = createRequire(join(APP_ROOT, 'package.json'))
const sharp = require('sharp')
const { Pool } = require('pg')
const Redis = require('ioredis')

const PARTNER_ID = '00a07c00-a5f8-42a2-aa8e-c55d4ac428a5'
const SITE_SLUG = 'nanoai-ws-un9v'
const ORIGIN = 'https://nanoai.vn'
const CREDIT_VND = 6000
const STOCK = 9999
const BRAND = 'NanoAI'
const SKIP_IDS = new Set([0, 88, 99, 100, 888, 1000])

function loadEnv(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const k = trimmed.slice(0, eq).trim()
    let v = trimmed.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv(join(APP_ROOT, '.env.local'))
loadEnv(join(APP_ROOT, '.env'))

const GROUPS = {
  'thu-do': { vi: 'Thử đồ & Phối đồ', en: 'Try-on & Styling', zh: '试衣与穿搭', ja: '試着・コーデ', ko: '가상 피팅·스타일링', hue: '#E36A2C' },
  'giao-duc': { vi: 'Giáo dục & Đào tạo', en: 'Education & Training', zh: '教育与培训', ja: '教育・研修', ko: '교육·연수', hue: '#1F6B4A' },
  'anh': { vi: 'Chỉnh sửa ảnh', en: 'Image Editing', zh: '图片编辑', ja: '画像編集', ko: '이미지 편집', hue: '#2457C5' },
  'thiet-ke': { vi: 'Thiết kế & Sáng tạo', en: 'Design & Creative', zh: '设计与创意', ja: 'デザイン・クリエイティブ', ko: '디자인·크리에이티브', hue: '#7A3E9D' },
  '3d': { vi: '3D & Chuyên dụng', en: '3D & Specialized', zh: '3D 与专业工具', ja: '3D・専門ツール', ko: '3D·전문 도구', hue: '#0E7490' },
  'nhac': { vi: 'Âm nhạc AI', en: 'AI Music', zh: 'AI 音乐', ja: 'AI 音楽', ko: 'AI 음악', hue: '#B45309' },
  'video': { vi: 'Video AI', en: 'AI Video', zh: 'AI 视频', ja: 'AI動画', ko: 'AI 비디오', hue: '#BE123C' },
  'web': { vi: 'Website shop', en: 'Shop website', zh: '店铺网站', ja: 'ショップサイト', ko: '샵 웹사이트', hue: '#0F172A' },
}

/** key, group, href, vi, en, zh, ja, ko, credits, sizes, occasion, motif, what, features */
const ROWS = [
  ['thu-do-1-nguoi', 'thu-do', '/thu-do-online/1-nguoi', 'Thử đồ 1 người', 'Try-on 1 Person', '1 人试衣', '1人試着', '1인 피팅', 1, '2K|4K', 'Thử trang phục cho một người', 'person', 'Ghép quần áo lên ảnh một người, giữ mặt, dáng và chi tiết vải.', ['Giữ mặt và dáng', 'Giữ màu và họa tiết áo', 'Ảnh 2K hoặc 4K', 'Dùng trong chat hoặc trên web']],
  ['thu-do-2-nguoi', 'thu-do', '/thu-do-online/2-nguoi', 'Thử đồ 2 người', 'Try-on 2 People', '2 人试衣', '2人試着', '2인 피팅', 1.2, '2K|4K', 'Thử đồ cặp đôi', 'person', 'Thử cùng một bộ hoặc hai bộ lên ảnh hai người trong một khung.', ['Hai người một khung', 'Giữ khuôn mặt', 'Phối đồ cặp', 'Ảnh 2K hoặc 4K']],
  ['thu-do-3-nguoi', 'thu-do', '/thu-do-online/3-nguoi', 'Thử đồ 3 người', 'Try-on 3 People', '3 人试衣', '3人試着', '3인 피팅', 1.3, '2K|4K', 'Thử đồ nhóm ba người', 'person', 'Mặc trang phục mẫu lên nhóm ba người, không tách thành nhiều khung.', ['Nhóm 3 người', 'Một ảnh kết quả', 'Giữ bố cục gốc', 'Ảnh 2K hoặc 4K']],
  ['thu-do-4-nguoi', 'thu-do', '/thu-do-online/4-nguoi', 'Thử đồ 4 người', 'Try-on 4 People', '4 人试衣', '4人試着', '4인 피팅', 1.4, '2K|4K', 'Thử đồ nhóm bốn người', 'person', 'Thử đồ cho nhóm bốn người trên cùng một ảnh.', ['Nhóm 4 người', 'Giữ tư thế', 'Một ảnh kết quả', 'Ảnh 2K hoặc 4K']],
  ['thu-do-5-nguoi', 'thu-do', '/thu-do-online/5-nguoi', 'Thử đồ 5 người', 'Try-on 5 People', '5 人试衣', '5人試着', '5인 피팅', 1.5, '2K|4K', 'Thử đồ nhóm năm người', 'person', 'Thử đồ cho nhóm năm người, mức credit cao nhất trong phòng thử đồ.', ['Nhóm 5 người', 'Giữ khuôn mặt', 'Một ảnh kết quả', 'Ảnh 2K hoặc 4K']],

  ['tao-giao-trinh', 'giao-duc', '/giao-trinh', 'Tạo giáo trình', 'Create curriculum', '创建课程', 'カリキュラム作成', '교육과정 생성', 1, '1 lượt AI', 'Soạn bài giảng và slide', 'book', 'Tạo giáo trình, slide theo tiết và xem lại giáo trình đã lưu trên cùng một công cụ.', ['Tạo từ chủ đề hoặc ảnh', 'Slide theo tiết', 'Giáo trình của tôi', '1 credit mỗi lần tạo AI']],
  ['tao-bai-thi', 'giao-duc', '/tao-bai-thi', 'Tạo bài thi trực tuyến', 'Online exam (live session)', '在线考试（课堂）', 'オンライン試験（授業）', '온라인 시험(수업)', 1, '1 câu AI', 'Ra đề và tổ chức thi', 'exam', 'Tạo đề thi trực tuyến, câu trắc nghiệm và phiên làm bài cho lớp.', ['Đề trắc nghiệm', 'Phiên thi trực tuyến', '1 credit mỗi câu AI', 'Gắn với lớp học']],
  ['tao-bai-tap', 'giao-duc', '/tao-bai-tap-ve-nha', 'Tạo bài tập về nhà', 'Create homework', '创建家庭作业', '宿題を作成', '숙제 만들기', 1, '1 câu AI', 'Giao phiếu bài tập', 'exam', 'Tạo phiếu bài tập về nhà, câu hỏi và bài tự luận từ giáo trình hoặc ảnh SGK.', ['Phiếu bài tập', 'Trắc nghiệm và tự luận', '1 credit mỗi câu AI', 'Học sinh nộp bài online']],
  ['lop-hoc', 'giao-duc', '/lop', 'Lớp học', 'Classes', '班级', 'クラス', '수업', 0, 'Gói chuẩn', 'Quản lý lớp và học sinh', 'class', 'Tạo lớp, mời học sinh, giao phiếu và xem kết quả. Quản lý lớp không trừ credit.', ['Danh sách lớp', 'Mời học sinh', 'Giao bài', 'Xem kết quả']],
  ['hoc-ngoai-ngu', 'giao-duc', '/hoc-tieng-anh-ai', 'Học ngoại ngữ AI', 'AI Language Learning', 'AI 语言学习', 'AI 語学学習', 'AI 외국어 학습', 3.5, 'Buổi live', 'Luyện nói với AI', 'chat', 'Mở một buổi luyện nói trực tiếp với AI, có phản hồi hội thoại. Giá là credit mở buổi live.', ['Hội thoại trực tiếp', 'Nhiều ngôn ngữ', '3,5 credit mở buổi live', 'Phản hồi trong buổi học']],
  ['bai-hoc-co-san', 'giao-duc', '/hoc-bai-hoc-co-san', 'Bài học có sẵn theo lộ trình', 'Preset lessons', '现成课程', '用意されたレッスン', '준비된 레슨', 2, '1 bài', 'Ôn bài học đã soạn', 'book', 'Mở bài học có sẵn theo lộ trình, tách khỏi buổi live. Giá là credit mở một bài.', ['Lộ trình có sẵn', 'Tách khỏi buổi live', '2 credit mỗi bài', 'Luyện theo bài đã lưu']],
  ['ghi-am-hop', 'giao-duc', '/ghi-am-bao-cao-cuoc-hop', 'Ghi âm & báo cáo cuộc họp', 'Meeting recording & AI report', '会议录音与 AI 纪要', '会議録音とAI議事録', '회의 녹음·AI 회의록', 1, '5 phút', 'Biên bản cuộc họp', 'mic', 'Ghi âm trên trình duyệt không tính phí. Tạo báo cáo AI: 5 phút đầu 1 credit, mỗi phút sau thêm 0,2 credit.', ['Ghi âm miễn phí', 'Biên bản và tóm tắt', '1 credit cho 5 phút đầu', 'Phiên âm']],
  ['infographic-sach', 'giao-duc', '/tao-infographic-tu-sach', 'Infographic từ sách', 'Infographic from book', '书籍信息图', '教科書インフォグラフィック', '교과서 인포그래픽', 1.5, '2K|4K', 'Tóm tắt sách thành ảnh', 'chart', 'Đọc nội dung sách hoặc tài liệu và dựng một ảnh infographic.', ['Từ sách hoặc chữ', 'Một ảnh tóm tắt', '1,5 credit mức 2K', 'Dùng cho bài giảng']],
  ['ke-chuyen-anh', 'giao-duc', '/ke-chuyen-bang-hinh-anh', 'Kể chuyện bằng ảnh', 'Story with Images', '图像故事', '画像でストーリー作成', '이미지 스토리 만들기', 3, '2K|4K', 'Truyện tranh từ lời kể', 'story', 'Biến câu chuyện thành chuỗi ảnh minh họa. Mức chuẩn 3 credit cho ảnh 2K.', ['Ảnh minh họa truyện', 'Theo lời người dùng', '3 credit mức 2K', '4K gấp đôi credit']],
  ['dich-anh', 'giao-duc', '/dich-anh-tai-lieu', 'Dịch ảnh tài liệu', 'Translate Document Images', '文档图片翻译', '書類画像翻訳', '문서 이미지 번역', 3, '2K|4K', 'Dịch chữ trên ảnh tài liệu', 'translate', 'Dịch chữ trên ảnh tài liệu, giữ bố cục trang. Mức chuẩn 3 credit mỗi ảnh 2K.', ['Giữ bố cục trang', 'Dịch nhiều trang', '3 credit mỗi ảnh 2K', 'Tải kết quả']],

  ['phuc-dung-anh', 'anh', '/phuc-dung-anh', 'Phục dựng ảnh', 'Restore Image', '照片修复', '画像修復', '이미지 복원', 4, '2K|4K', 'Phục hồi ảnh cũ hoặc mờ', 'photo', 'Phục dựng ảnh cũ, mờ hoặc hỏng. Mức 2K là 4 credit, 4K là 8 credit.', ['Ảnh cũ và ảnh mờ', 'Giữ khuôn mặt', '4 credit mức 2K', '8 credit mức 4K']],
  ['lam-net-anh', 'anh', '/lam-net-anh', 'Làm nét ảnh', 'Enhance Image', '图片增强', '画像高画質化', '이미지 선명화', 1.5, '2K|4K', 'Làm rõ ảnh bị mờ', 'photo', 'Làm nét ảnh, tăng chi tiết mà không đổi nội dung. Mức 2K là 1,5 credit.', ['Tăng độ nét', 'Giữ nội dung', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['lam-dep-anh', 'anh', '/lam-dep-anh', 'Làm đẹp ảnh', 'Beautify Image', '图片美化', '画像補正', '이미지 보정', 1.5, '2K|4K', 'Chỉnh da và ánh sáng chân dung', 'face', 'Làm đẹp chân dung: da, ánh sáng, màu. Mức 2K là 1,5 credit.', ['Chân dung', 'Giữ nhận diện', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['ghep-anh', 'anh', '/ghep-anh', 'Ghép ảnh', 'Merge Images', '图片合成', '画像合成', '이미지 합성', 1.5, '2K|4K', 'Ghép nhiều ảnh thành một', 'merge', 'Ghép các ảnh thành một khung hoàn chỉnh. Mức 2K là 1,5 credit.', ['Nhiều ảnh vào', 'Một ảnh ra', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['xoa-vat-the', 'anh', '/xoa-vat-the', 'Xóa vật thể', 'Remove Object', '移除物体', 'オブジェクト削除', '객체 제거', 1.5, '2K|4K', 'Xóa chi tiết thừa trong ảnh', 'eraser', 'Xóa người, chữ hoặc vật thừa và lấp nền. Mức 2K là 1,5 credit.', ['Xóa vật chỉ định', 'Lấp nền', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['xoa-nen-png', 'anh', '/xoa-nen-png', 'Xóa nền PNG', 'Remove PNG Background', '去除 PNG 背景', 'PNG 背景削除', 'PNG 배경 제거', 1.5, 'PNG', 'Tách nền trong suốt', 'png', 'Xóa nền và xuất PNG trong suốt. Mỗi lần 1,5 credit.', ['Nền trong suốt', 'File PNG', '1,5 credit mỗi lần', 'Dùng cho logo và sản phẩm']],
  ['thay-nen', 'anh', '/thay-nen-san-pham', 'Thay nền ảnh', 'Replace Product Background', '替换商品背景', '商品背景置換', '상품 배경 교체', 1.5, '2K|4K', 'Đổi nền ảnh sản phẩm', 'bg', 'Giữ sản phẩm, thay nền studio hoặc nền theo mô tả. Mức 2K là 1,5 credit.', ['Giữ sản phẩm', 'Nền mới', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['sua-anh', 'anh', '/sua-anh-theo-yeu-cau', 'Sửa ảnh theo yêu cầu', 'Edit image by request', '按要求编辑图片', '要望に応じて画像編集', '요청 기반 이미지 편집', 1.5, '2K|4K', 'Sửa ảnh bằng câu mô tả', 'edit', 'Sửa ảnh theo câu chữ: thêm, bớt, đổi chi tiết. Mức 2K là 1,5 credit.', ['Sửa theo câu chữ', 'Giữ phần còn lại', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['mo-rong-khung', 'anh', '/mo-rong-khung-hinh', 'Mở rộng khung hình', 'Expand Frame', '扩展画幅', 'フレーム拡張', '프레임 확장', 1.5, '2K|4K', 'Nới khung ảnh', 'expand', 'Kéo rộng khung và vẽ phần ảnh mới cho khớp. Mức 2K là 1,5 credit.', ['Đổi tỉ lệ khung', 'Vẽ phần thêm', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['hoan-doi-mat', 'anh', '/hoan-doi-khuon-mat', 'Hoán đổi khuôn mặt', 'Face Swap', '换脸', '顔交換', '얼굴 교체', 1, '2K|4K', 'Đổi mặt giữa hai ảnh', 'face', 'Hoán đổi khuôn mặt giữa ảnh nguồn và ảnh đích. Mức 2K là 1 credit, 4K là 2 credit.', ['Hai ảnh vào', 'Giữ dáng ảnh đích', '1 credit mức 2K', '2 credit mức 4K']],

  ['tao-banner', 'thiet-ke', '/tao-banner', 'Tạo banner', 'Create Banner', '生成横幅', 'バナー作成', '배너 생성', 1.5, '2K|4K', 'Banner quảng cáo', 'banner', 'Tạo banner quảng cáo từ câu mô tả hoặc ảnh. Mức 2K là 1,5 credit.', ['Khổ banner', 'Chữ trên ảnh', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['anh-facebook', 'thiet-ke', '/tao-anh-ban-hang', 'Tạo ảnh đăng Facebook', 'Create Facebook listing photos', '制作 Facebook 卖货图', 'Facebook用の販売画像を作る', '페이스북 판매 이미지 만들기', 1.5, '2K|4K', 'Ảnh đăng bán', 'banner', 'Tạo bộ ảnh đăng bán cho Facebook từ sản phẩm. Mức chuẩn theo ảnh Gemini 2K là 1,5 credit.', ['Ảnh đăng bán', 'Nhiều khung', '1,5 credit mức 2K', 'Dùng cho bài đăng']],
  ['thiep-cuoi', 'thiet-ke', '/tao-thiep-moi-cuoi-ai', 'Tạo thiệp cưới AI', 'AI Wedding Invitation', 'AI 婚礼请柬', 'AI 結婚式招待状', 'AI 청첩장', 1, '1 thiệp', 'Thiệp cưới online', 'wedding', 'Tạo thiệp cưới AI, ảnh thiệp và trang mời khách. Mỗi ảnh thiệp 1 credit.', ['Ảnh thiệp', 'Trang khách mời', '1 credit mỗi ảnh', 'Link chia sẻ']],
  ['anh-tu-chu', 'thiet-ke', '/tao-anh-tu-chu', 'Tạo ảnh bằng ý tưởng', 'Create image from ideas', '用创意生成图片', 'アイデアから画像作成', '아이디어로 이미지 생성', 1.5, '2K|4K', 'Ảnh từ câu mô tả', 'spark', 'Tạo ảnh mới từ câu mô tả, không cần ảnh gốc. Mức 2K là 1,5 credit.', ['Từ câu chữ', 'Không cần ảnh gốc', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['anh-phac-thao', 'thiet-ke', '/du-anh-tu-phac-thao', 'Dựng ảnh từ phác thảo', 'Sketch to image', '草图生成图像', 'スケッチから画像', '스케치로 이미지', 1.5, '2K|4K', 'Phác thảo thành ảnh', 'sketch', 'Dựng ảnh hoàn chỉnh từ nét phác. Mức 2K là 1,5 credit.', ['Từ phác thảo', 'Giữ bố cục nét', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['anh-the', 'thiet-ke', '/tao-anh-the', 'Tạo ảnh thẻ', 'Create ID Photo', '制作证件照', '証明写真作成', '증명사진 생성', 1.5, '2K|4K', 'Ảnh thẻ hộ chiếu', 'id', 'Tạo ảnh thẻ nền chuẩn từ ảnh chân dung. Mức 2K là 1,5 credit.', ['Nền ảnh thẻ', 'Khung chuẩn', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['thiet-ke-logo', 'thiet-ke', '/thiet-ke-logo', 'Thiết kế logo', 'Design Logo', '设计 Logo', 'ロゴ作成', '로고 디자인', 1.5, '2K|4K', 'Logo thương hiệu', 'logo', 'Thiết kế logo theo tên và ngành. Mức 2K là 1,5 credit.', ['Theo tên thương hiệu', 'Nhiều phương án', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['nhan-gian', 'thiet-ke', '/tao-nhan-gian', 'Tạo nhãn gián', 'Create Sticker', '生成贴纸', 'ステッカー作成', '스티커 생성', 2, '2K|4K', 'Sticker và nhãn dán', 'sticker', 'Tạo nhãn dán, sticker. Mức 2K là 2 credit, 4K là 4 credit.', ['Sticker', 'Nền tách được', '2 credit mức 2K', '4 credit mức 4K']],
  ['nhan-san-pham', 'thiet-ke', '/tao-nhan-gioi-thieu-san-pham', 'Tạo nhãn giới thiệu sản phẩm', 'Create Product Label', '创建产品介绍标签', '商品紹介ラベル作成', '제품 소개 라벨 만들기', 1.5, '2K|4K', 'Nhãn chai lọ và hộp', 'label', 'Thiết kế nhãn giới thiệu sản phẩm và mockup. Mức 2K là 1,5 credit.', ['Mặt nhãn', 'Mockup chai hộp', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['tem-bao-hanh', 'thiet-ke', '/tao-tem-niem-phong-bao-hanh', 'Tạo tem niêm phong, bảo hành', 'Create seal & warranty label', '创建封条/保修标签', '封印・保証ラベル作成', '봉인·보증 라벨 만들기', 1.5, '2K|4K', 'Tem niêm phong', 'seal', 'Tạo tem niêm phong và tem bảo hành. Mức 2K là 1,5 credit.', ['Tem niêm phong', 'Tem bảo hành', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['con-dau', 'thiet-ke', '/thiet-ke-con-dau', 'Thiết kế con dấu', 'Design stamp', '设计印章', 'スタンプデザイン', '스탬프 디자인', 1.5, '2K|4K', 'Dấu tròn và dấu vuông', 'stamp', 'Thiết kế mặt con dấu theo tên đơn vị. Mức 2K là 1,5 credit.', ['Dấu tròn hoặc vuông', 'Chữ trên dấu', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['bao-bi', 'thiet-ke', '/thiet-ke-bao-bi', 'Thiết kế bao bì (hộp, túi)', 'Packaging Design (box, bag)', '包装设计（箱・袋）', '包装設計（箱・袋）', '포장 설계 (상자, 가방)', 1.5, '2K|4K', 'Hộp carton và túi', 'box', 'Thiết kế mặt bao bì hộp và túi. Mức chuẩn theo ảnh Gemini 2K là 1,5 credit.', ['Hộp và túi', 'Mặt in', '1,5 credit mức 2K', 'Xem trên công cụ bao bì']],
  ['tui-dung', 'thiet-ke', '/thiet-ke-tui-dung', 'Thiết kế túi đựng (mặt phẳng)', 'Flat bag design', '平面袋设计', '平面袋デザイン', '평면 가방 설계', 1.5, '2K|4K', 'Mặt túi phẳng', 'bag', 'Thiết kế mặt túi đựng trải phẳng. Mức chuẩn theo ảnh Gemini 2K là 1,5 credit.', ['Mặt túi phẳng', 'Vùng in', '1,5 credit mức 2K', 'Mở từ công cụ túi']],
  ['mockup-chai', 'thiet-ke', '/mockup-cylinder-wrap', 'Mockup nhãn chai / lon', 'Bottle / Can Label Mockup', '瓶子/罐子标签样机', 'ボトル・缶ラベルモックアップ', '병/캔 라벨 목업', 1.5, '2K|4K', 'Nhãn quấn chai lon', 'bottle', 'Dựng mockup nhãn quấn chai hoặc lon. Mức chuẩn theo ảnh Gemini 2K là 1,5 credit.', ['Nhãn quấn', 'Chai hoặc lon', '1,5 credit mức 2K', 'Xem trước 3D']],
  ['ma-vach', 'thiet-ke', '/tao-ma-vach', 'Tạo mã vạch & QR Code', 'Create Barcode & QR Code', '创建条形码和二维码', 'バーコード・QRコード作成', '바코드·QR 코드 만들기', 0, 'Mã vạch|QR', 'Mã hàng và mã QR', 'qr', 'Tạo mã vạch và QR trên trình duyệt. Công cụ này không trừ credit.', ['Mã vạch', 'QR Code', 'Không trừ credit', 'Tải ảnh mã']],
  ['che-anh', 'thiet-ke', '/che-anh', 'Chế ảnh', 'Meme Maker', '表情包制作', 'ミーム作成', '밈 만들기', 1.5, '2K|4K', 'Ảnh chế và meme', 'meme', 'Tạo ảnh chế từ ảnh và câu chữ. Mức 2K là 1,5 credit.', ['Ảnh chế', 'Chữ trên ảnh', '1,5 credit mức 2K', '3 credit mức 4K']],

  ['anh-3d', '3d', '/tao-anh-3d', 'Ảnh sản phẩm mẫu 3D', '3D Product Sample', '3D 商品样图', '3D 商品サンプル', '3D 상품 샘플', 1.5, '2K|4K', 'Ảnh mẫu sản phẩm 3D', 'cube', 'Dựng ảnh sản phẩm mẫu nhìn như phối 3D. Mức 2K là 1,5 credit.', ['Phối sản phẩm', 'Nền studio', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['mo-hinh-3d', '3d', '/tao-mo-hinh-3d-tu-anh', 'Mô hình 3D từ ảnh', '3D Model from Image', '从图片生成 3D 模型', '画像から 3D モデル生成', '이미지로 3D 모델 생성', 1.5, '2K|4K', 'Ảnh thành phối 3D', 'cube', 'Tạo phối mô hình 3D từ ảnh chụp. Mức 2K là 1,5 credit.', ['Từ ảnh chụp', 'Phối 3D', '1,5 credit mức 2K', '3 credit mức 4K']],
  ['noi-ngoai-that', '3d', '/thiet-ke-noi-ngoai-that', 'Nội ngoại thất', 'Interior & Exterior', '室内与室外', '内装・外装', '인테리어·익스테리어', 1.5, '2K|4K', 'Phối cảnh nội thất và mặt tiền', 'interior', 'Phối lại nội thất hoặc ngoại thất từ ảnh hiện trạng. Mức 2K là 1,5 credit mỗi ảnh. Phân tích ảnh 0,5 credit.', ['Nội thất', 'Ngoại thất', '1,5 credit mỗi ảnh 2K', 'Phân tích 0,5 credit']],
  ['xay-nha', '3d', '/xay-nha-tu-dat-nen', 'Kiểu nhà bạn muốn xây', 'Home style preview', '想建的房型', '建てたい家のイメージ', '짓고 싶은 집 스타일', 4, 'Phối cảnh|Mặt bằng|Kết cấu', 'Phối nhà ở', 'house', 'Dựng phối cảnh mặt tiền, mặt bằng phòng và bản kết cấu. Mỗi loại ảnh 4 credit.', ['Phối cảnh 3D', 'Mặt bằng', 'Bản kết cấu', '4 credit mỗi loại']],
  ['chan-dung', '3d', '/tao-anh-chain-dung', 'Ảnh chân dung', 'Portrait Photo', '人像照片', 'ポートレート写真', '인물 사진', 2, '2K|4K', 'Chân dung studio', 'portrait', 'Tạo ảnh chân dung studio từ ảnh gốc. Mức 2K là 2 credit, 4K là 4 credit.', ['Nền studio', 'Giữ nhận diện', '2 credit mức 2K', '4 credit mức 4K']],

  ['bai-nhac', 'nhac', '/tao-bai-hat-lyria-3', 'Tạo bài nhạc (có lời / không lời)', 'Create music (vocal or instrumental)', '制作乐曲（人声或纯音乐）', '楽曲を作成（ボーカル／インスト）', '음악 만들기 (보컬/인스트루멘탈)', 3, 'Có lời|Không lời', 'Nhạc nền và bài hát', 'music', 'Tạo một bài nhạc có lời hoặc không lời. Mỗi lần tạo 3 credit.', ['Có lời hoặc không lời', 'Tải file nhạc', '3 credit mỗi lần', 'Dùng làm nhạc nền']],
  ['video-nhac', 'nhac', '/flow-nhac-video-veo', 'Video âm nhạc AI (Flash + Veo)', 'AI music video (Flash + Veo)', 'AI 音乐视频（Flash+Veo）', 'AIミュージックビデオ（Flash+Veo）', 'AI 뮤직비디오 (Flash+Veo)', 9, '8 giây', 'Video nhạc có lời', 'video', 'Một đoạn gồm lời Flash (1 credit) và clip Veo khoảng 8 giây (8 credit). Giá niêm yết là một đoạn.', ['Lời theo đoạn', 'Clip khoảng 8 giây', '9 credit một đoạn', 'Nối thêm đoạn tính tiếp']],

  ['video-veo', 'video', '/tao-video-tu-anh', 'Tạo video AI (Veo)', 'AI video (Veo)', 'AI 视频（Veo）', 'AI動画（Veo）', 'AI 비디오 (Veo)', 8, '720p|1080p|4K', 'Video từ ảnh hoặc chữ', 'video', 'Tạo video từ ảnh hoặc câu chữ. Giá niêm yết là clip 720p khoảng 8 giây (8 credit). 1080p là 16 credit, 4K là 28 credit. Kéo dài clip thêm 8 credit.', ['Từ ảnh hoặc chữ', '720p 8 giây: 8 credit', '1080p: 16 credit', '4K: 28 credit']],

  ['kho-giao-dien', 'web', '/mau-giao-dien', 'Kho giao diện website shop', 'Shop template gallery', '店铺模板库', 'ショップテンプレート', '샵 템플릿 갤러리', 0, 'Gói chuẩn', 'Chọn mẫu website bán hàng', 'web', 'Xem mẫu website shop và chọn giao diện để dựng storefront, giỏ hàng và trang sản phẩm. Xem mẫu không trừ credit.', ['Mẫu giao diện shop', 'Storefront và giỏ hàng', 'Trang sản phẩm', 'Không trừ credit khi xem mẫu']],
  ['app-ban-hang', 'web', '/', 'App bán hàng', 'Mobile Shop App', '购物 App', '販売アプリ', '쇼핑 앱', 1.5, '2K|4K', 'Thiết kế app và website bán hàng', 'web', 'Thiết kế app hoặc website bán hàng từ brief đến logo và các trang mua hàng. Mức chuẩn mỗi ảnh 2K là 1,5 credit. Mở từ trang chủ NanoAI.', ['Brief thương hiệu', 'Logo', 'Trang chủ đến thanh toán', '1,5 credit mỗi ảnh 2K']],
  ['anh-san-pham', 'thiet-ke', '/', 'Ảnh sản phẩm', 'Product Photos', '产品图', '商品画像', '상품 사진', 1.5, '2K|4K', 'Bộ ảnh đăng sàn', 'photo', 'Tạo bộ ảnh sản phẩm cho sàn thương mại: nền trắng, lifestyle, chi tiết và banner. Mức chuẩn mỗi ảnh 2K là 1,5 credit. Mở từ trang chủ NanoAI.', ['Nền trắng', 'Ảnh lifestyle', 'Ảnh chi tiết', '1,5 credit mỗi ảnh 2K']],
  ['thiet-ke-menu', 'thiet-ke', '/', 'Thiết kế menu quán ăn', 'Restaurant menu design', '餐厅菜单设计', '飲食店メニュー', '음식점 메뉴', 1.5, 'A4|Bảng menu', 'Menu quán ăn và quán nước', 'menu', 'Thiết kế menu quán ăn, quán nước hoặc cafe từ tên quán và danh sách món. Mức chuẩn mỗi ảnh 2K là 1,5 credit. Mở từ trang chủ NanoAI.', ['Menu in A4', 'Menu bàn', 'Bảng menu', '1,5 credit mỗi ảnh 2K']],
]

function vnd(amount) {
  if (!amount) return 'Miễn phí'
  return String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'
}

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapName(name, max) {
  const words = String(name).split(/\s+/)
  const lines = []
  let cur = ''
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word
    if (next.length > max && cur) {
      lines.push(cur)
      cur = word
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 3)
}

function motifSvg(kind) {
  const ink = '#1c1917'
  const paper = '#fffaf3'
  switch (kind) {
    case 'person':
      return `<circle cx="500" cy="250" r="46" fill="${paper}"/><rect x="452" y="310" width="96" height="130" rx="28" fill="${paper}"/><rect x="430" y="340" width="36" height="90" rx="16" fill="${ink}" opacity="0.25"/><rect x="534" y="340" width="36" height="90" rx="16" fill="${ink}" opacity="0.25"/>`
    case 'book':
      return `<rect x="390" y="230" width="220" height="160" rx="12" fill="${paper}"/><path d="M500 230 v160" stroke="${ink}" stroke-width="6"/><path d="M430 280 h50 M430 310 h50 M530 280 h50 M530 310 h50" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`
    case 'exam':
      return `<rect x="400" y="220" width="200" height="180" rx="16" fill="${paper}"/><path d="M440 270 h120 M440 310 h90 M440 350 h120" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><circle cx="430" cy="270" r="8" fill="${ink}"/>`
    case 'class':
      return `<circle cx="430" cy="250" r="28" fill="${paper}"/><circle cx="500" cy="236" r="32" fill="${paper}"/><circle cx="570" cy="250" r="28" fill="${paper}"/><rect x="390" y="300" width="220" height="70" rx="24" fill="${paper}"/>`
    case 'chat':
      return `<rect x="390" y="220" width="220" height="140" rx="28" fill="${paper}"/><circle cx="460" cy="290" r="12" fill="${ink}"/><circle cx="500" cy="290" r="12" fill="${ink}"/><circle cx="540" cy="290" r="12" fill="${ink}"/>`
    case 'mic':
      return `<rect x="470" y="210" width="60" height="110" rx="30" fill="${paper}"/><path d="M440 300 v20 a60 60 0 0 0 120 0 v-20" fill="none" stroke="${paper}" stroke-width="12"/><path d="M500 380 v40" stroke="${paper}" stroke-width="12" stroke-linecap="round"/>`
    case 'chart':
      return `<rect x="410" y="300" width="40" height="90" fill="${paper}"/><rect x="470" y="250" width="40" height="140" fill="${paper}"/><rect x="530" y="210" width="40" height="180" fill="${paper}"/>`
    case 'story':
      return `<rect x="380" y="230" width="110" height="140" rx="12" fill="${paper}"/><rect x="510" y="230" width="110" height="140" rx="12" fill="${paper}" opacity="0.85"/>`
    case 'translate':
      return `<text x="430" y="310" font-family="DejaVu Sans" font-size="64" fill="${paper}" font-weight="700">A</text><text x="540" y="310" font-family="DejaVu Sans" font-size="64" fill="${paper}" font-weight="700">B</text>`
    case 'photo':
      return `<rect x="390" y="220" width="220" height="160" rx="16" fill="${paper}"/><circle cx="450" cy="270" r="18" fill="${ink}" opacity="0.35"/><path d="M400 350 l50-50 40 40 30-24 80 70" fill="none" stroke="${ink}" stroke-width="8"/>`
    case 'face':
      return `<circle cx="500" cy="290" r="90" fill="${paper}"/><circle cx="468" cy="275" r="10" fill="${ink}"/><circle cx="532" cy="275" r="10" fill="${ink}"/><path d="M470 320 q30 24 60 0" fill="none" stroke="${ink}" stroke-width="6"/>`
    case 'merge':
      return `<rect x="380" y="240" width="120" height="120" rx="16" fill="${paper}"/><rect x="500" y="240" width="120" height="120" rx="16" fill="${paper}" opacity="0.75"/>`
    case 'eraser':
      return `<rect x="430" y="250" width="160" height="70" rx="16" transform="rotate(-20 500 285)" fill="${paper}"/>`
    case 'png':
      return `<rect x="400" y="220" width="200" height="160" rx="16" fill="${paper}"/><path d="M450 300 h100" stroke="${ink}" stroke-width="10" stroke-dasharray="16 12"/>`
    case 'bg':
      return `<rect x="390" y="220" width="220" height="160" rx="16" fill="${paper}" opacity="0.45"/><rect x="450" y="260" width="100" height="80" rx="10" fill="${paper}"/>`
    case 'edit':
      return `<path d="M430 340 l120-120 40 40-120 120z" fill="${paper}"/><path d="M550 220 l40 40" stroke="${ink}" stroke-width="8"/>`
    case 'expand':
      return `<rect x="430" y="250" width="140" height="100" fill="none" stroke="${paper}" stroke-width="10"/><path d="M400 220 h40 v40 M600 220 h-40 v40 M400 380 h40 v-40 M600 380 h-40 v-40" fill="none" stroke="${paper}" stroke-width="8"/>`
    case 'banner':
      return `<rect x="360" y="260" width="280" height="90" rx="16" fill="${paper}"/><path d="M400 305 h200" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>`
    case 'wedding':
      return `<path d="M500 210 l18 40 44 4-34 28 10 42-38-22-38 22 10-42-34-28 44-4z" fill="${paper}"/>`
    case 'spark':
      return `<path d="M500 200 l22 70 70 22-70 22-22 70-22-70-70-22 70-22z" fill="${paper}"/>`
    case 'sketch':
      return `<path d="M400 340 C460 240 540 360 610 230" fill="none" stroke="${paper}" stroke-width="10" stroke-linecap="round"/>`
    case 'id':
      return `<rect x="400" y="220" width="200" height="160" rx="12" fill="${paper}"/><circle cx="460" cy="290" r="28" fill="${ink}" opacity="0.3"/><path d="M510 270 h60 M510 300 h50 M510 330 h40" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`
    case 'logo':
      return `<circle cx="500" cy="290" r="80" fill="none" stroke="${paper}" stroke-width="14"/><text x="500" y="306" text-anchor="middle" font-family="DejaVu Sans" font-size="48" fill="${paper}" font-weight="700">N</text>`
    case 'sticker':
      return `<circle cx="500" cy="290" r="80" fill="${paper}"/><circle cx="500" cy="290" r="46" fill="none" stroke="${ink}" stroke-width="8"/>`
    case 'label':
      return `<rect x="390" y="240" width="220" height="120" rx="8" fill="${paper}"/><path d="M420 280 h160 M420 310 h120" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>`
    case 'seal':
      return `<circle cx="500" cy="290" r="78" fill="none" stroke="${paper}" stroke-width="16" stroke-dasharray="8 10"/><circle cx="500" cy="290" r="28" fill="${paper}"/>`
    case 'stamp':
      return `<circle cx="500" cy="290" r="78" fill="${paper}"/><circle cx="500" cy="290" r="58" fill="none" stroke="${ink}" stroke-width="6"/>`
    case 'box':
      return `<path d="M420 300 l80-50 80 50 v90 l-80 40-80-40z" fill="${paper}"/><path d="M420 300 l80 40 80-40 M500 340 v90" fill="none" stroke="${ink}" stroke-width="4"/>`
    case 'bag':
      return `<path d="M430 280 h140 l-16 130 h-108z" fill="${paper}"/><path d="M460 280 v-30 a40 40 0 0 1 80 0 v30" fill="none" stroke="${paper}" stroke-width="12"/>`
    case 'bottle':
      return `<rect x="470" y="210" width="60" height="36" rx="8" fill="${paper}"/><rect x="440" y="250" width="120" height="140" rx="20" fill="${paper}"/>`
    case 'qr':
      return `<rect x="410" y="230" width="50" height="50" fill="${paper}"/><rect x="540" y="230" width="50" height="50" fill="${paper}"/><rect x="410" y="340" width="50" height="50" fill="${paper}"/><rect x="490" y="300" width="28" height="28" fill="${paper}"/><rect x="540" y="350" width="40" height="40" fill="${paper}"/>`
    case 'meme':
      return `<rect x="390" y="220" width="220" height="160" rx="16" fill="${paper}"/><text x="500" y="315" text-anchor="middle" font-family="DejaVu Sans" font-size="42" font-weight="700" fill="${ink}">Ha</text>`
    case 'cube':
      return `<path d="M500 210 l90 50 v100 l-90 50-90-50 v-100z" fill="${paper}"/><path d="M500 210 v100 l90 50 M500 310 l-90 50" fill="none" stroke="${ink}" stroke-width="4"/>`
    case 'interior':
      return `<path d="M380 340 h240 v-80 l-120-70-120 70z" fill="${paper}"/><rect x="470" y="290" width="50" height="50" fill="${ink}" opacity="0.25"/>`
    case 'house':
      return `<path d="M390 320 h220 v90 h-220z" fill="${paper}"/><path d="M370 320 l130-90 130 90" fill="${paper}"/><rect x="480" y="350" width="40" height="60" fill="${ink}" opacity="0.3"/>`
    case 'portrait':
      return `<rect x="420" y="200" width="160" height="200" rx="80" fill="${paper}"/><circle cx="500" cy="270" r="36" fill="${ink}" opacity="0.25"/>`
    case 'music':
      return `<circle cx="450" cy="340" r="28" fill="${paper}"/><circle cx="560" cy="310" r="28" fill="${paper}"/><path d="M478 340 V210 h110 v100" fill="none" stroke="${paper}" stroke-width="10"/>`
    case 'video':
      return `<rect x="380" y="240" width="200" height="130" rx="16" fill="${paper}"/><path d="M580 275 l50-24 v90 l-50-24z" fill="${paper}"/>`
    case 'web':
      return `<rect x="380" y="220" width="240" height="160" rx="16" fill="${paper}"/><path d="M380 260 h240" stroke="${ink}" stroke-width="8"/><circle cx="410" cy="240" r="6" fill="${ink}"/>`
    case 'menu':
      return `<rect x="400" y="210" width="200" height="200" rx="16" fill="${paper}"/><path d="M440 270 h120 M440 310 h90 M440 350 h120" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>`
    default:
      return `<circle cx="500" cy="290" r="70" fill="${paper}"/>`
  }
}

function coverSvg(product) {
  const lines = wrapName(product.name, 18)
  const start = 760 - (lines.length - 1) * 26
  const text = lines
    .map((line, i) => `<text x="500" y="${start + i * 52}" text-anchor="middle" font-family="DejaVu Sans" font-size="42" font-weight="700" fill="#fffaf3">${xml(line)}</text>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1000" height="1000" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1000" fill="#f4f1ea"/>
  <rect x="48" y="48" width="904" height="904" rx="48" fill="${product.hue}"/>
  ${motifSvg(product.motif)}
  ${text}
  <text x="500" y="900" text-anchor="middle" font-family="DejaVu Sans" font-size="28" fill="#fffaf3">${xml(product.priceHint)} · NanoAI</text>
</svg>`
}

function detailSvg(product) {
  const bullets = product.features
    .map((item, i) => `<text x="120" y="${520 + i * 70}" font-family="DejaVu Sans" font-size="32" fill="#1c1917">${xml(`${i + 1}. ${item}`)}</text>`)
    .join('')
  const title = wrapName(product.name, 28)
    .map((line, i) => `<text x="80" y="${180 + i * 58}" font-family="DejaVu Sans" font-size="46" font-weight="700" fill="#fffaf3">${xml(line)}</text>`)
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1440" viewBox="0 0 1080 1440" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1440" fill="#f4f1ea"/>
  <rect width="1080" height="420" fill="${product.hue}"/>
  ${title}
  <text x="80" y="360" font-family="DejaVu Sans" font-size="32" fill="#fffaf3">${xml(product.priceHint)} · ${xml(product.groupName)}</text>
  <text x="80" y="470" font-family="DejaVu Sans" font-size="28" fill="#44403c">${xml(product.what)}</text>
  ${bullets}
  <text x="80" y="980" font-family="DejaVu Sans" font-size="28" fill="#44403c">Xuất xứ: Việt Nam · Thương hiệu: NanoAI</text>
  <text x="80" y="1040" font-family="DejaVu Sans" font-size="28" fill="#44403c">Đơn vị: dịch vụ số, không giao hàng vật lý</text>
  <text x="80" y="1180" font-family="DejaVu Sans" font-size="30" font-weight="700" fill="${product.hue}">${xml(product.url)}</text>
</svg>`
}

const HOSTS = [
  'sg.storage.bunnycdn.com',
  'storage.bunnycdn.com',
  'uk.storage.bunnycdn.com',
  'ny.storage.bunnycdn.com',
  'la.storage.bunnycdn.com',
  'se.storage.bunnycdn.com',
  'br.storage.bunnycdn.com',
  'jh.storage.bunnycdn.com',
  'syd.storage.bunnycdn.com',
  'mi.storage.bunnycdn.com',
]

function preferredHost() {
  const region = String(process.env.BUNNY_PLATFORM_STORAGE_REGION || 'DE').trim().toUpperCase()
  const map = { DE: 'storage.bunnycdn.com', SG: 'sg.storage.bunnycdn.com', UK: 'uk.storage.bunnycdn.com', NY: 'ny.storage.bunnycdn.com', LA: 'la.storage.bunnycdn.com' }
  return map[region] || 'storage.bunnycdn.com'
}

let uploadHost = preferredHost()

async function putBunny(path, body) {
  const zone = process.env.BUNNY_STORAGE_ZONE.trim()
  const key = process.env.BUNNY_STORAGE_API_KEY.trim()
  const hosts = [uploadHost, ...HOSTS.filter((h) => h !== uploadHost)]
  let last = 'none'
  for (const host of hosts) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await fetch(`https://${host}/${encodeURIComponent(zone)}/${path}`, {
          method: 'PUT',
          headers: { AccessKey: key, 'Content-Type': 'image/png' },
          body,
        })
        last = String(res.status)
        if (res.status === 401) break
        if (!res.ok) {
          const hint = (await res.text()).slice(0, 180)
          last = `${res.status} ${hint}`
          if (res.status >= 500 && attempt < 3) continue
          throw new Error(`Bunny PUT ${res.status} ${path} ${hint}`)
        }
        uploadHost = host
        return
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        last = message
        if (attempt < 3) continue
        console.log(`bunny_retry host=${host} path=${path} ${message}`)
      }
    }
  }
  throw new Error(`Bunny PUT failed ${last} ${path}`)
}

function publicUrl(path) {
  const base = process.env.BUNNY_STORAGE_PUBLIC_BASE_URL.trim().replace(/\/$/, '')
  return `${base}/${path}`
}

function nextId(used) {
  let n = 101
  while (used.has(n) || SKIP_IDS.has(n)) n += 1
  used.add(n)
  return n
}

function buildProducts() {
  return ROWS.map((row, index) => {
    const [key, groupKey, href, vi, en, zh, ja, ko, credits, sizeRaw, occasion, motif, what, features] = row
    const group = GROUPS[groupKey]
    const amount = Math.round(Number(credits) * CREDIT_VND)
    const sizes = String(sizeRaw).split('|')
    const url = `${ORIGIN}${href}`
    const priceHint = vnd(amount)
    const creditLabel = Number(credits) === 0 ? '0' : String(credits).replace('.', ',')
    const description = [
      what,
      amount
        ? `Giá niêm yết ${priceHint} cho một lượt mức chuẩn (${creditLabel} credit, 1 credit = 6.000đ). Credit trừ trên ví NanoAI khi chạy công cụ.`
        : 'Mở công cụ không trừ credit.',
      `Gồm: ${features.join('; ')}.`,
      `Mở công cụ: ${url}`,
    ].join('\n\n')
    return {
      index,
      key,
      groupKey,
      href,
      name: vi,
      en,
      zh,
      ja,
      ko,
      credits: Number(credits),
      sizes,
      occasion,
      motif,
      what,
      features,
      hue: group.hue,
      groupName: group.vi,
      url,
      amount,
      priceHint,
      description,
      consult: `${vi} — ${what} Giá chuẩn ${priceHint}.`,
      material:
        'Dịch vụ số trên nanoai.vn. Không giao hàng vật lý, không có kích thước kiện. Kết quả tạo trên tài khoản NanoAI sau khi dùng credit theo bảng giá của công cụ.',
    }
  })
}

async function renderPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}

function assignLetter(used) {
  const free = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((letter) => !used.has(letter))
  if (!free.length) throw new Error('Hết chữ cái đầu SKU')
  return free[randomInt(0, free.length)]
}

async function main() {
  for (const name of ['DATABASE_URL', 'BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_API_KEY', 'BUNNY_STORAGE_PUBLIC_BASE_URL']) {
    if (!String(process.env[name] || '').trim()) throw new Error(`Thiếu ${name}`)
  }
  const products = buildProducts()
  console.log(`features=${products.length}`)

  const skipUpload = process.env.SEED_SKIP_UPLOAD === '1'
  const images = []
  for (const product of products) {
    const coverPath = `shop-catalog/${SITE_SLUG}/${product.key}-cover.png`
    const detailPath = `shop-catalog/${SITE_SLUG}/${product.key}-detail.png`
    const cover = skipUpload ? null : await renderPng(coverSvg(product))
    const detail = skipUpload ? null : await renderPng(detailSvg(product))
    images.push({ product, coverPath, detailPath, cover, detail })
  }
  if (!skipUpload) {
    console.log(`rendered=${images.length * 2}`)
    for (let i = 0; i < images.length; i += 4) {
      const chunk = images.slice(i, i + 4)
      await Promise.all(chunk.flatMap((item) => [putBunny(item.coverPath, item.cover), putBunny(item.detailPath, item.detail)]))
      console.log(`uploaded=${Math.min(i + 4, images.length)}/${images.length}`)
    }
  }

  const sample = images[0]
  const sampleUrl = publicUrl(sample.coverPath)
  const probe = await fetch(sampleUrl)
  if (!probe.ok) throw new Error(`Ảnh đại diện không mở được: HTTP ${probe.status}`)
  await probe.arrayBuffer()
  console.log(`image_ok key=${sample.product.key}`)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const client = await pool.connect()
  try {
    await client.query('begin')
    const prefixRow = await client.query(
      `select inventory_sku_prefix from public.messaging_partners where id = $1::uuid`,
      [PARTNER_ID]
    )
    let prefix = String(prefixRow.rows[0]?.inventory_sku_prefix || '').trim().toUpperCase()
    if (!/^[A-Z]$/.test(prefix)) {
      const used = await client.query(
        `select inventory_sku_prefix from public.messaging_partners where inventory_sku_prefix is not null and id <> $1::uuid`,
        [PARTNER_ID]
      )
      prefix = assignLetter(new Set(used.rows.map((row) => String(row.inventory_sku_prefix || '').toUpperCase())))
      await client.query(
        `update public.messaging_partners set inventory_sku_prefix = $2 where id = $1::uuid and inventory_sku_prefix is null`,
        [PARTNER_ID, prefix]
      )
    }

    const usedIds = await client.query(
      `select gid from (
         select rating_group_id as gid from public.messaging_partner_categories where rating_group_id is not null
         union all
         select rating_group_id from public.messaging_partner_inventory where rating_group_id is not null
         union all
         select question_group_id from public.messaging_partner_inventory where question_group_id is not null
       ) u where gid is not null`
    )
    const taken = new Set(usedIds.rows.map((row) => Number(row.gid)).filter((n) => Number.isFinite(n)))

    await client.query(
      `delete from public.messaging_partner_inventory_categories
       where inventory_id in (
         select id from public.messaging_partner_inventory
         where partner_id = $1::uuid and remarketing_id like 'feat:%'
       )`,
      [PARTNER_ID]
    )
    await client.query(
      `delete from public.messaging_partner_inventory
       where partner_id = $1::uuid and remarketing_id like 'feat:%'`,
      [PARTNER_ID]
    )
    await client.query(
      `delete from public.messaging_partner_categories
       where partner_id = $1::uuid and path like 'cong-cu-nanoai/%/%'`,
      [PARTNER_ID]
    )
    await client.query(
      `delete from public.messaging_partner_categories
       where partner_id = $1::uuid and path like 'cong-cu-nanoai/%'`,
      [PARTNER_ID]
    )
    await client.query(
      `delete from public.messaging_partner_categories
       where partner_id = $1::uuid and path = 'cong-cu-nanoai'`,
      [PARTNER_ID]
    )

    const l1Id = randomUUID()
    const l1Name = { vi: 'Công cụ NanoAI', en: 'NanoAI tools', zh: 'NanoAI 工具', ja: 'NanoAIツール', ko: 'NanoAI 도구' }
    await client.query(
      `insert into public.messaging_partner_categories (
        id, partner_id, parent_id, name, name_i18n, slug, path, depth, sort_order, is_active,
        image_url, description, description_i18n, seo_title, seo_description, seo_index, ai_generated
      ) values (
        $1::uuid, $2::uuid, null, $3, $4::jsonb, 'cong-cu-nanoai', 'cong-cu-nanoai', 1, 0, true,
        $5, $6, $7::jsonb, $8, $9, true, false
      )`,
      [
        l1Id,
        PARTNER_ID,
        l1Name.vi,
        JSON.stringify(l1Name),
        publicUrl(images[0].coverPath),
        'Toàn bộ tính năng NanoAI, mỗi tính năng một sản phẩm.',
        JSON.stringify(l1Name),
        'Công cụ NanoAI',
        'Danh mục tính năng NanoAI',
      ]
    )

    const l2Ids = new Map()
    let l2Order = 0
    for (const [groupKey, group] of Object.entries(GROUPS)) {
      const id = randomUUID()
      l2Ids.set(groupKey, id)
      const first = images.find((item) => item.product.groupKey === groupKey)
      await client.query(
        `insert into public.messaging_partner_categories (
          id, partner_id, parent_id, name, name_i18n, slug, path, depth, sort_order, is_active,
          image_url, description, description_i18n, seo_title, seo_description, seo_index, ai_generated
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7, 2, $8, true,
          $9, $4, $5::jsonb, $4, $4, true, false
        )`,
        [
          id,
          PARTNER_ID,
          l1Id,
          group.vi,
          JSON.stringify({ vi: group.vi, en: group.en, zh: group.zh, ja: group.ja, ko: group.ko }),
          groupKey,
          `cong-cu-nanoai/${groupKey}`,
          l2Order,
          publicUrl(first.coverPath),
        ]
      )
      l2Order += 1
    }

    const byGroup = new Map()
    for (const item of images) {
      const sku = `${prefix}f${String(item.product.index + 1).padStart(4, '0')}`
      item.product.sku = sku
      const list = byGroup.get(item.product.groupKey) || []
      list.push(item)
      byGroup.set(item.product.groupKey, list)
    }

    for (const item of images) {
      const product = item.product
      const coverUrl = publicUrl(item.coverPath)
      const detailUrl = publicUrl(item.detailPath)
      const siblings = byGroup.get(product.groupKey)
      const sorted = [...siblings].sort((a, b) => a.product.amount - b.product.amount)
      const low = sorted[0].product.sku
      const high = sorted[sorted.length - 1].product.sku
      const ratingId = nextId(taken)
      const questionId = nextId(taken)
      const l3Id = randomUUID()
      const names = { vi: product.name, en: product.en, zh: product.zh, ja: product.ja, ko: product.ko }
      await client.query(
        `insert into public.messaging_partner_categories (
          id, partner_id, parent_id, name, name_i18n, slug, path, depth, sort_order, is_active,
          image_url, description, description_i18n, seo_title, seo_description, seo_index, ai_generated, rating_group_id
        ) values (
          $1::uuid, $2::uuid, $3::uuid, $4, $5::jsonb, $6, $7, 3, $8, true,
          $9, $10, $11::jsonb, $4, $10, true, false, $12
        )`,
        [
          l3Id,
          PARTNER_ID,
          l2Ids.get(product.groupKey),
          product.name,
          JSON.stringify(names),
          product.key,
          `cong-cu-nanoai/${product.groupKey}/${product.key}`,
          product.index,
          coverUrl,
          product.what,
          JSON.stringify({ vi: product.what, en: product.en, zh: product.zh, ja: product.ja, ko: product.ko }),
          ratingId,
        ]
      )

      const inventoryId = randomUUID()
      const colors = [{ name: 'Chuẩn', img: coverUrl }]
      const productInfo = {
        product_info: {
          sku: product.sku,
          name: product.name,
          names,
          brand: BRAND,
          origin: 'Việt Nam',
          chinese_name: product.zh,
          category: { level_1: 'Công cụ NanoAI', level_2: product.groupName, level_3: product.name },
          tool_url: product.url,
        },
        specifications: {
          chat_lieu: 'Dịch vụ số AI',
          don_vi: '1 lượt sử dụng mức chuẩn',
          credit: product.credits,
          credit_vnd: CREDIT_VND,
          gia_niem_yet: product.priceHint,
          kich_co_goi: product.sizes,
          trong_luong: 'Số hóa',
        },
        variants: { colors: ['Chuẩn'], sizes: product.sizes, stock: STOCK },
        target_audience: {
          gender: 'Mọi người',
          age_range: 'Người dùng NanoAI',
          wearing_style: product.groupName,
          tinh_nang_noi_bat: product.features,
        },
        market_info: {
          main_sales_regions: 'Việt Nam',
          export_ready: true,
          season: 'Quanh năm',
          stock: STOCK,
          lead_time_days: 0,
        },
      }
      const snapshot = {
        product_id: product.sku,
        code: product.sku,
        origin: 'Việt Nam',
        brand_name: BRAND,
        name: product.name,
        description: product.description,
        price: product.amount,
        shop_name: BRAND,
        shop_id: PARTNER_ID,
        pro_lower_price: low,
        pro_high_price: high,
        group_rating: ratingId,
        group_question: questionId,
        sizes: product.sizes,
        colors,
        images: [coverUrl],
        gallery: [detailUrl],
        link_default: product.url,
        video_link: '',
        main_image: coverUrl,
        likes: 0,
        purchases: 0,
        rating_total: 0,
        question_total: 0,
        rating_point: 0,
        available: STOCK,
        deposit_require: false,
        category: 'Công cụ NanoAI',
        subcategory: product.groupName,
        sub_subcategory: product.name,
        raw_category: 'Công cụ NanoAI',
        raw_subcategory: product.groupName,
        raw_sub_subcategory: product.name,
        material: product.material,
        style: product.groupName,
        color: 'Chuẩn',
        occasion: product.occasion,
        features: product.features,
        weight: 'Số hóa',
        product_info: productInfo,
        chinese_name: product.zh,
        shop_name_chinese: BRAND,
        slug: product.key,
        cost_cny: null,
        cost_vnd: product.amount,
      }

      await client.query(
        `insert into public.messaging_partner_inventory (
          id, partner_id, sort_order, sku, name, description, stock_note, stock_qty, price_hint,
          image_url, product_url, product_video_url, consult_note, remarketing_id, is_active,
          created_at, updated_at, price_amount,
          catalog_json, brand_name, origin, source_origin, chinese_name, deposit_required,
          category_l1, category_l2, category_l3,
          likes_count, purchases_count, reviews_count, questions_count, rating_score,
          catalog_slug, style, color_summary, occasion, weight, features_json, product_info_json,
          source_shop_name, source_shop_id, source_shop_name_chinese,
          price_low_hint, price_high_hint, rating_group_id, question_group_id,
          colors_json, sizes_json, gallery_urls, detail_image_urls, material_note,
          material_detail_image_url, real_use_image_url, real_use_image_url_2,
          cost_vnd
        ) values (
          $1::uuid, $2::uuid, $3::int, $4, $5, $6, $7::text, $8::int, $9,
          $10, $11, '', $12, $13, true,
          now(), now(), $14::numeric,
          $15::jsonb, $16, 'manual', $17, $18, false,
          $19, $20, $21,
          0, 0, 0, 0, 0,
          $22, $23, $24, $25, $26, $27::jsonb, $28::jsonb,
          $16, $39, $16,
          $29, $30, $31::int, $32::int,
          $33::jsonb, $34::jsonb, $35::jsonb, $36::jsonb, $37,
          $38, $38, $10,
          $40::float8
        )`,
        [
          inventoryId,
          PARTNER_ID,
          product.index + 1,
          product.sku,
          product.name,
          product.description,
          JSON.stringify(colors),
          STOCK,
          product.priceHint,
          coverUrl,
          product.url,
          product.consult,
          `feat:${product.key}`,
          product.amount,
          JSON.stringify(snapshot),
          BRAND,
          'Việt Nam',
          product.zh,
          'Công cụ NanoAI',
          product.groupName,
          product.name,
          product.key,
          product.groupName,
          'Chuẩn',
          product.occasion,
          'Số hóa',
          JSON.stringify(product.features),
          JSON.stringify(productInfo),
          low,
          high,
          ratingId,
          questionId,
          JSON.stringify(colors),
          JSON.stringify(product.sizes),
          JSON.stringify([coverUrl]),
          JSON.stringify([detailUrl]),
          product.material,
          detailUrl,
          PARTNER_ID,
          product.amount,
        ]
      )
      await client.query(
        `insert into public.messaging_partner_inventory_categories (inventory_id, category_id, is_primary)
         values ($1::uuid, $2::uuid, true)`,
        [inventoryId, l3Id]
      )
    }

    const counted = await client.query(
      `select count(*)::int as n from public.messaging_partner_inventory
       where partner_id = $1::uuid and remarketing_id like 'feat:%' and is_active`,
      [PARTNER_ID]
    )
    const web = await client.query(
      `select site_slug, is_published from public.messaging_partner_websites where partner_id = $1::uuid limit 1`,
      [PARTNER_ID]
    )
    await client.query('commit')
    console.log(`inserted=${counted.rows[0].n} prefix=${prefix}`)
    if (web.rows[0]) console.log(`website slug=${web.rows[0].site_slug} published=${web.rows[0].is_published}`)
    else console.log('website=missing')
    console.log(products.map((p) => `${p.sku || ''} ${p.name}`).join('\n'))
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
    await pool.end()
  }

  const redisUrl = String(process.env.REDIS_URL || '').trim()
  if (redisUrl) {
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, connectTimeout: 8000 })
    await redis.ping()
    await redis.incr(`pw:inv:${PARTNER_ID}:ver`)
    await redis.incr(`pw:site:${SITE_SLUG}:ver`)
    await redis.quit()
    console.log('cache_bumped=1')
  } else {
    console.log('cache_bumped=0')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
