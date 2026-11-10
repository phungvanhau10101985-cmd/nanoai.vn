import { isValidUuidString } from '@/lib/validate-uuid'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export type TranslateReview = {
  id: string
  authorName: string
  rating: number
  body: string
  createdAt: string
}

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS public.document_translate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  author_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 12 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_translate_reviews_created
  ON public.document_translate_reviews (created_at DESC);
`

/** Đánh giá mẫu, giọng người đã dùng dịch catalog. Hiện cùng đánh giá khách gửi. */
export const DOCUMENT_TRANSLATE_SEED_REVIEWS: TranslateReview[] = [
  { id: 'seed-01', authorName: 'Minh Quân', rating: 5, body: 'Mới dịch tờ thông số xe trộn. Nhãn vàng trên poster thành tiếng Việt, mã VTC-15 không bị đụng. Gửi xưởng được luôn.', createdAt: '2026-11-07T02:18:00.000Z' },
  { id: 'seed-02', authorName: 'Phương Thảo', rating: 5, body: 'Khách Trung Quốc gửi ảnh catalog lúc 8 giờ. Tôi để nguồn tự nhận, đích tiếng Việt. Khoảng nửa phút là có trang.', createdAt: '2026-11-06T01:06:00.000Z' },
  { id: 'seed-03', authorName: 'Văn Khoa', rating: 4, body: 'Đầu trang vàng và bảng đỏ còn đúng chỗ. Có một dòng chú thích tôi đọc lại vì câu hơi cụt.', createdAt: '2026-11-05T08:41:00.000Z' },
  { id: 'seed-04', authorName: 'Kim Chi', rating: 5, body: 'In A3 nên tôi lấy Gemini 2K cho nét. Bảng chữ dày thì vẫn quay lại GPT medium, chữ ít sai hơn.', createdAt: '2026-11-04T03:27:00.000Z' },
  { id: 'seed-05', authorName: 'Hoàng Long', rating: 5, body: 'Excel 15 link cột A chạy lần lượt. Ảnh nào xong mới trừ credit. Một link chết thì không bị trừ.', createdAt: '2026-11-03T11:14:00.000Z' },
  { id: 'seed-06', authorName: 'Ngọc Mai', rating: 4, body: 'Chụp menu quán bằng điện thoại. Tên món và giá nằm đúng ô. Ảnh hơi tối nên một món tôi sửa tay.', createdAt: '2026-11-02T13:52:00.000Z' },
  { id: 'seed-07', authorName: 'Thanh Tùng', rating: 5, body: 'Sáu nghìn một trang, rẻ hơn thuê người gõ catalog. Tôi vẫn soi số kW trước khi gửi khách.', createdAt: '2026-11-01T04:09:00.000Z' },
  { id: 'seed-08', authorName: 'Mỹ Duyên', rating: 3, body: 'Trang scan mờ, chữ 7pt. Medium ra một hàng sai. Làm lại GPT high thì đọc được, tốn thêm một lượt.', createdAt: '2026-10-31T02:33:00.000Z' },
  { id: 'seed-09', authorName: 'Quốc Huy', rating: 5, body: 'Tem dán trên cabin giữ nguyên chữ. Phần chú thích và bảng thì dịch. Đúng việc khi gửi catalog cho xưởng.', createdAt: '2026-10-30T07:20:00.000Z' },
  { id: 'seed-10', authorName: 'Thu Hà', rating: 5, body: 'PDF hợp đồng bảo trì 18 trang. Xong tôi tải một file PDF, không phải ngồi ghép từng ảnh.', createdAt: '2026-10-29T01:48:00.000Z' },
  { id: 'seed-11', authorName: 'Đức Minh', rating: 4, body: 'Bảng có nhiều số trong ngoặc. Số thì đúng, câu chú thích tôi đọc một lượt trước khi đăng web.', createdAt: '2026-10-28T10:05:00.000Z' },
  { id: 'seed-12', authorName: 'Lan Anh', rating: 4, body: 'Catalog máy 1,5 khối. Nhãn không dán trên máy được dịch. Có chỗ đơn vị tôi đổi lại cho giống cách xưởng hay ghi.', createdAt: '2026-10-27T03:16:00.000Z' },
  { id: 'seed-13', authorName: 'Hữu Phước', rating: 5, body: 'Tờ chào bán xe bơm, số điện thoại và tên hãng trên logo không bị dịch. Phần mô tả thì sang tiếng Việt.', createdAt: '2026-10-26T12:27:00.000Z' },
  { id: 'seed-14', authorName: 'Thanh Hà', rating: 4, body: 'Ảnh chụp hơi nghiêng. Trang ra thẳng, chữ vào đúng cột. Góc dưới một chữ bị dính, tôi xóa tay.', createdAt: '2026-10-25T06:44:00.000Z' },
  { id: 'seed-15', authorName: 'Nhật Nam', rating: 5, body: 'Dịch hướng dẫn vận hành từ tiếng Trung. Các bước còn đúng thứ tự, không bị đảo thành đoạn văn mới.', createdAt: '2026-10-24T02:11:00.000Z' },
  { id: 'seed-16', authorName: 'Bích Ngọc', rating: 5, body: 'Menu tiệc 2 mặt. Giá và tên món giữ ô. Tôi chọn ZIP vì chỉ cần gửi từng trang cho bếp.', createdAt: '2026-10-23T09:38:00.000Z' },
  { id: 'seed-17', authorName: 'Quang Dũng', rating: 4, body: 'Bản vẽ dày chữ nhỏ. GPT high đọc được hầu hết. Một ký hiệu đường kính tôi đối lại bản gốc.', createdAt: '2026-10-22T04:55:00.000Z' },
  { id: 'seed-18', authorName: 'Hồng Nhung', rating: 5, body: 'Khách gửi PDF tiếng Nhật 9 trang. Tôi để đích tiếng Việt, tải về một PDF. Bố cục đầu trang không chạy.', createdAt: '2026-10-21T13:02:00.000Z' },
  { id: 'seed-19', authorName: 'Tuấn Anh', rating: 3, body: 'Một poster nền tối, chữ trắng mỏng. Lần medium mất một dòng bán hàng. High làm lại thì đủ, nhưng mất thời gian.', createdAt: '2026-10-20T01:29:00.000Z' },
  { id: 'seed-20', authorName: 'Diệu Linh', rating: 5, body: 'Sổ bảo trì định kỳ. Cột ngày và số giờ máy không bị đổi. Chỉ câu hướng dẫn là tiếng Việt.', createdAt: '2026-10-19T08:17:00.000Z' },
  { id: 'seed-21', authorName: 'Công Danh', rating: 5, body: 'Bảng phụ tùng. Mã linh kiện kiểu chữ-số giữ nguyên. Tên gọi thì dịch. Xuất kho đỡ phải gõ lại.', createdAt: '2026-10-18T11:46:00.000Z' },
  { id: 'seed-22', authorName: 'Mai Phương', rating: 4, body: 'Gemini 2K nét, nhìn trên điện thoại đẹp. Chỗ bảng 6 cột thì GPT medium chắc chữ hơn, tôi dùng medium cho file đó.', createdAt: '2026-10-17T03:08:00.000Z' },
  { id: 'seed-23', authorName: 'Khánh Vy', rating: 5, body: 'Chụp tờ giá nhà cung cấp bằng máy. Các mức giá nằm đúng hàng. Tôi gửi khách trong buổi chiều.', createdAt: '2026-10-16T07:33:00.000Z' },
  { id: 'seed-24', authorName: 'Đình Phong', rating: 5, body: 'Catalog tiếng Hàn, bảng kích thước mm. Số không nhảy. Tiêu đề trang thành tiếng Việt, nhìn giống tờ in.', createdAt: '2026-10-15T02:52:00.000Z' },
  { id: 'seed-25', authorName: 'Trúc Lam', rating: 4, body: 'Có một tên thành phố trong câu giới thiệu bị viết hơi lạ. Bảng thông số thì ổn. Tôi sửa một chữ rồi đăng.', createdAt: '2026-10-14T14:21:00.000Z' },
  { id: 'seed-26', authorName: 'Sơn Tùng', rating: 5, body: 'Lô 30 trang PDF. Chạy lần lượt, không bị nhảy cóc trang. Tải một file PDF đúng thứ tự gốc.', createdAt: '2026-10-13T04:14:00.000Z' },
  { id: 'seed-27', authorName: 'Hà My', rating: 3, body: 'Ảnh bàn giấy có bóng đèn. Vài ô bị đọc nhầm số 8 thành 3. Tôi không gửi khách bản đó, chụp lại rồi dịch lần hai.', createdAt: '2026-10-12T09:07:00.000Z' },
  { id: 'seed-28', authorName: 'Bảo Trân', rating: 5, body: 'Tờ giới thiệu máy lạnh. Dòng công suất và gas giữ số. Câu mô tả thì tự nhiên, không bị dịch word-by-word.', createdAt: '2026-10-11T01:36:00.000Z' },
  { id: 'seed-29', authorName: 'Việt Anh', rating: 4, body: 'Tem trên thùng hàng không dịch, đúng ý. Nhãn thông số in trên tờ thì dịch. Một đơn vị tôi viết lại cho ngắn.', createdAt: '2026-10-10T06:19:00.000Z' },
  { id: 'seed-30', authorName: 'Thu Trang', rating: 5, body: 'Hướng dẫn lắp ráp 6 bước. Số bước không mất. Ảnh minh họa trong trang không bị vẽ thành hình khác.', createdAt: '2026-10-09T12:48:00.000Z' },
  { id: 'seed-31', authorName: 'Minh Khang', rating: 4, body: 'Trang song ngữ Trung-Anh. Máy dịch cả hai sang Việt. Có câu lặp ý, tôi xóa một dòng.', createdAt: '2026-10-08T03:55:00.000Z' },
  { id: 'seed-32', authorName: 'Ngọc Anh', rating: 5, body: 'Bảng so sánh 4 model. Tên model chữ Latin còn đó. Hàng tính năng thành tiếng Việt, cột không lệch.', createdAt: '2026-10-07T08:02:00.000Z' },
  { id: 'seed-33', authorName: 'Đức Thành', rating: 4, body: 'PDF 40 trang hơi lâu vì chạy từng trang. Kết quả ổn. Tôi tranh thủ làm việc khác, khoảng hơn nửa tiếng là xong.', createdAt: '2026-10-06T11:28:00.000Z' },
  { id: 'seed-34', authorName: 'Lan Phương', rating: 5, body: 'Phiếu kiểm tra xuất xưởng. Dấu mộc và chữ ký không bị xóa. Phần kết luận thì dịch được.', createdAt: '2026-10-04T02:41:00.000Z' },
  { id: 'seed-35', authorName: 'Quang Minh', rating: 5, body: 'Khách Ả Rập gửi poster máy. Logo và hotline giữ. Đoạn tình trạng máy và bảo trì sang tiếng Việt.', createdAt: '2026-10-03T07:13:00.000Z' },
  { id: 'seed-36', authorName: 'Hồng Ân', rating: 3, body: 'Chọn Gemini 4K cho tờ A2. Ảnh nét nhưng một tiêu đề bị diễn dài hơn ô, tràn nhẹ. Tôi crop rồi mới in.', createdAt: '2026-10-02T13:37:00.000Z' },
  { id: 'seed-37', authorName: 'Thảo Vy', rating: 5, body: 'Dịch thực đơn đồ uống. Tên riêng của món signature tôi muốn giữ thì vẫn còn, phần mô tả thì Việt.', createdAt: '2026-10-01T04:22:00.000Z' },
  { id: 'seed-38', authorName: 'Hùng Cường', rating: 4, body: 'Bảng moment và tải trọng. Số đúng. Có một thuật ngữ cơ khí tôi đổi lại cho thợ dễ hiểu.', createdAt: '2026-09-30T01:58:00.000Z' },
  { id: 'seed-39', authorName: 'Yến Nhi', rating: 5, body: 'Scan sổ tay từ máy photocopy. Viền đen còn, chữ trong bảng sạch. Đỡ phải gõ 4 trang.', createdAt: '2026-09-29T09:26:00.000Z' },
  { id: 'seed-40', authorName: 'Tuấn Kiệt', rating: 5, body: 'File ảnh Zalo khách gửi hơi nén. Vẫn đọc được bảng. Tôi khuyên khách gửi file gốc lần sau cho đỡ mờ.', createdAt: '2026-09-28T06:04:00.000Z' },
  { id: 'seed-41', authorName: 'Mỹ Linh', rating: 4, body: 'Hai trang liên tiếp, trang 2 bị lệch nhẹ cột cuối. Nội dung đúng. Tôi canh lại khi dàn PDF.', createdAt: '2026-09-27T12:15:00.000Z' },
  { id: 'seed-42', authorName: 'Đăng Khoa', rating: 5, body: 'Catalog bơm, chữ trên cần xe không dịch. Bảng tầm với và chiều cao thì dịch, số mét giữ nguyên.', createdAt: '2026-09-26T03:47:00.000Z' },
  { id: 'seed-43', authorName: 'Thuý An', rating: 5, body: 'Dịch điều khoản bảo hành. Các mốc tháng không đổi. Câu dễ hiểu hơn bản tôi tự dịch lúc trước.', createdAt: '2026-09-25T08:31:00.000Z' },
  { id: 'seed-44', authorName: 'Hoàng Nam', rating: 3, body: 'Một bảng có chữ viết tay. Máy bỏ qua gần hết chỗ viết tay. Chỗ đánh máy thì ổn. Đừng kỳ vọng chữ tay.', createdAt: '2026-09-24T14:09:00.000Z' },
  { id: 'seed-45', authorName: 'Kim Ngân', rating: 5, body: 'Tờ thông số lốp và dầu. 23.5-16, 65 l, 16 l còn đúng. Tôi chỉ việc gửi nhóm Zalo kỹ thuật.', createdAt: '2026-09-22T02:24:00.000Z' },
  { id: 'seed-46', authorName: 'Quốc Bảo', rating: 5, body: 'Chọn xuất ZIP vì designer cần từng PNG. Đặt tên theo số trang, khỏi tìm.', createdAt: '2026-09-21T05:53:00.000Z' },
  { id: 'seed-47', authorName: 'Diễm My', rating: 4, body: 'Tiếng Thái trên menu. Món chính đúng. Một món vùng tôi không chắc, hỏi lại đầu bếp rồi sửa.', createdAt: '2026-09-20T10:18:00.000Z' },
  { id: 'seed-48', authorName: 'Văn Hùng', rating: 5, body: 'Bản vẽ layout xưởng. Kích thước không bị làm tròn khác đi. Chú thích mũi tên thành tiếng Việt.', createdAt: '2026-09-19T01:42:00.000Z' },
  { id: 'seed-49', authorName: 'Ngọc Hân', rating: 5, body: 'Dịch tờ khai thông số cho hồ sơ thầu. Bố cục bảng giữ được nên không phải dàn lại trong Word.', createdAt: '2026-09-18T07:06:00.000Z' },
  { id: 'seed-50', authorName: 'Minh Tú', rating: 4, body: 'Medium với trang chữ to thì nhanh và đúng. Trang chú thích li ti tôi chuyển high. Nên tách file theo độ nhỏ của chữ.', createdAt: '2026-09-17T13:29:00.000Z' },
  { id: 'seed-51', authorName: 'Thanh Sơn', rating: 5, body: 'Ảnh chụp tờ rơi ngoài trời, nền hơi loang. Vẫn ra tiêu đề và 4 ý bán hàng. Đủ để đưa lên web.', createdAt: '2026-09-16T04:11:00.000Z' },
  { id: 'seed-52', authorName: 'Phương Linh', rating: 5, body: 'Hướng dẫn an toàn. Biển cảnh báo màu vàng còn. Câu cảnh báo dịch, không bị mất dấu chấm than.', createdAt: '2026-09-15T09:44:00.000Z' },
  { id: 'seed-53', authorName: 'Đức Huy', rating: 3, body: 'Trang có watermark chéo. Máy dịch luôn chữ mờ của watermark thành một câu lạ ở giữa. Tôi phải xóa.', createdAt: '2026-09-13T02:57:00.000Z' },
  { id: 'seed-54', authorName: 'Lan Chi', rating: 5, body: 'Bảng giá sỉ 3 cột. Chiết khấu phần trăm không đổi. Tên nhóm hàng sang tiếng Việt, nhìn sạch.', createdAt: '2026-09-12T06:38:00.000Z' },
  { id: 'seed-55', authorName: 'Quang Vinh', rating: 4, body: 'Model mã toàn chữ số thì yên tâm. Chỗ tên máy viết bằng chữ Trung trên bảng thì bị dịch, tôi muốn vậy nên ổn.', createdAt: '2026-09-10T11:12:00.000Z' },
  { id: 'seed-56', authorName: 'Hồng Hạnh', rating: 5, body: 'Dịch 7 ảnh chụp sổ. Không phải PDF mà là thư mục ảnh. Ra đủ 7, không sót trang cuối.', createdAt: '2026-09-09T03:21:00.000Z' },
  { id: 'seed-57', authorName: 'Tuấn Minh', rating: 5, body: 'Tờ specs máy phát. kVA, Hz, điện áp giữ số. Đoạn ứng dụng thì viết lại bằng tiếng Việt nghe được.', createdAt: '2026-09-07T08:49:00.000Z' },
  { id: 'seed-58', authorName: 'Bích Phượng', rating: 4, body: 'Có lần hết credit giữa chừng. Trang đã xong vẫn tải được, trang chưa chạy thì không mất tiền. Nạp thêm rồi chạy tiếp.', createdAt: '2026-09-06T14:03:00.000Z' },
  { id: 'seed-59', authorName: 'Nhật Huy', rating: 5, body: 'Catalog thang máy. Tên hãng trên logo không dịch. Bảng tải trọng và tốc độ thì Việt, số tầng đúng.', createdAt: '2026-09-04T01:17:00.000Z' },
  { id: 'seed-60', authorName: 'Mai Linh', rating: 5, body: 'Khách cần gấp buổi sáng. 11 trang PDF, tôi chọn medium. Trưa là có file gửi. Chữ to nên không cần high.', createdAt: '2026-09-03T04:36:00.000Z' },
  { id: 'seed-61', authorName: 'Hữu Nghĩa', rating: 4, body: 'Một ô «tùy cấu hình» bị dịch thành câu khác nghĩa. Tôi sửa lại trước khi in. Các ô số thì không sao.', createdAt: '2026-09-01T07:28:00.000Z' },
  { id: 'seed-62', authorName: 'Thanh Trúc', rating: 3, body: 'Ảnh chụp qua kính, phản quang. Máy đoán bừa một hàng. Chụp không có bóng thì lần sau ổn.', createdAt: '2026-08-30T02:45:00.000Z' },
  { id: 'seed-63', authorName: 'Văn Nam', rating: 5, body: 'Dịch nhãn quy cách đóng gói. Khối lượng tịnh và kích thước thùng giữ số. Câu xuất xứ trên nhãn dán thì tôi cố tình không đưa vào vùng cần dịch.', createdAt: '2026-08-28T10:14:00.000Z' },
  { id: 'seed-64', authorName: 'Diệu Hiền', rating: 4, body: 'Bảng dinh dưỡng. Số calo đúng. Tên chất thì có một từ tôi đổi cho giống nhãn mình hay dùng.', createdAt: '2026-08-26T05:09:00.000Z' },
  { id: 'seed-65', authorName: 'Công Minh', rating: 5, body: 'Sơ đồ đấu dây. Ký hiệu L, N, PE không bị viết thành từ. Chú thích bên cạnh thì dịch.', createdAt: '2026-08-24T13:41:00.000Z' },
  { id: 'seed-66', authorName: 'Khánh Linh', rating: 4, body: 'Trang đầu đẹp. Trang phụ lục chữ nhỏ hơn, medium hơi nhòe. Tôi tách phụ lục sang high.', createdAt: '2026-08-22T03:33:00.000Z' },
  { id: 'seed-67', authorName: 'Đình Khôi', rating: 5, body: 'Dịch báo giá tiếng Trung cho chủ đầu tư. Hạng mục và đơn vị tính sang Việt, đơn giá không lệch hàng.', createdAt: '2026-08-20T08:22:00.000Z' },
  { id: 'seed-68', authorName: 'Trúc Quỳnh', rating: 4, body: 'Poster có quá nhiều icon chữ. Phần chữ chạy được, icon thì đôi khi lệch một nhịp. Nhìn tổng thể vẫn dùng được.', createdAt: '2026-08-18T01:54:00.000Z' },
  { id: 'seed-69', authorName: 'Sơn Hà', rating: 3, body: 'File PDF scan nghiêng và tối. Ba trang đầu phải chụp lại. Trang nào rõ thì ra rất nhanh, đừng đưa bản photocopy mờ.', createdAt: '2026-08-16T06:47:00.000Z' },
  { id: 'seed-70', authorName: 'Hà Thanh', rating: 4, body: 'Dùng được vài tháng. Catalog máy công trình là chính. Vẫn phải đọc lại tên riêng, còn bảng số thì đỡ hơn ngồi gõ.', createdAt: '2026-08-10T09:16:00.000Z' },
]

const SEED_DATE_NEWEST_MS = Date.parse('2026-11-07T02:18:00.000Z')
const SEED_DATE_OLDEST_MS = Date.parse('2026-08-10T09:16:00.000Z')
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

function vnWall(ms: number) {
  const wall = new Date(ms + VN_OFFSET_MS)
  return {
    y: wall.getUTCFullYear(),
    m: wall.getUTCMonth(),
    d: wall.getUTCDate(),
    h: wall.getUTCHours(),
    min: wall.getUTCMinutes(),
    s: wall.getUTCSeconds(),
  }
}

function fromVnWall(y: number, m: number, d: number, h: number, min: number, s: number) {
  return Date.UTC(y, m, d, h, min, s) - VN_OFFSET_MS
}

/** Mốc trong mảng chỉ để giữ khoảng cách. Lúc hiển thị, mới nhất luôn cách hôm nay 3 ngày, cũ nhất luôn cách 3 tháng. */
export function slideDocumentTranslateSeedReviews(now = new Date()): TranslateReview[] {
  const wall = vnWall(now.getTime())
  const newestMs = fromVnWall(wall.y, wall.m, wall.d - 3, wall.h, wall.min, wall.s)
  const oldestMs = fromVnWall(wall.y, wall.m - 3, wall.d, wall.h, wall.min, wall.s)
  const span = SEED_DATE_NEWEST_MS - SEED_DATE_OLDEST_MS
  return DOCUMENT_TRANSLATE_SEED_REVIEWS.map((review) => {
    const stored = Date.parse(review.createdAt)
    const ratio = span === 0 ? 0 : Math.min(1, Math.max(0, (SEED_DATE_NEWEST_MS - stored) / span))
    const day = vnWall(newestMs - ratio * (newestMs - oldestMs))
    const clock = vnWall(stored)
    return {
      ...review,
      createdAt: new Date(fromVnWall(day.y, day.m, day.d, clock.h, clock.min, clock.s)).toISOString(),
    }
  })
}

let tableReady = false

async function ensureTable(): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (tableReady) return true
  await getPgPool().query(ENSURE_SQL)
  tableReady = true
  return true
}

export async function listDocumentTranslateReviews(): Promise<TranslateReview[]> {
  let saved: TranslateReview[] = []
  try {
    if (await ensureTable()) {
      const result = await getPgPool().query<{
        id: string
        author_name: string
        rating: number
        body: string
        created_at: Date
      }>(`select id::text, author_name, rating, body, created_at
          from public.document_translate_reviews
          order by created_at desc
          limit 40`)
      saved = result.rows.map((row) => ({
        id: row.id,
        authorName: row.author_name,
        rating: Number(row.rating),
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
      }))
    }
  } catch (error) {
    console.error('[dich-anh-reviews] đọc đánh giá lỗi', error instanceof Error ? error.message : error)
  }
  return [...saved, ...slideDocumentTranslateSeedReviews()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function insertDocumentTranslateReview(input: {
  userId: string
  authorName: string
  rating: number
  body: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = input.body.trim()
  if (body.length < 12 || body.length > 600) return { ok: false, error: 'short' }
  if (input.rating < 1 || input.rating > 5) return { ok: false, error: 'rating' }
  try {
    if (!(await ensureTable())) return { ok: false, error: 'db' }
    const userId = isValidUuidString(input.userId) ? input.userId : null
    await getPgPool().query(
      `insert into public.document_translate_reviews (user_id, author_name, rating, body)
       values ($1::uuid, $2, $3, $4)`,
      [userId, input.authorName.slice(0, 80), input.rating, body]
    )
    return { ok: true }
  } catch (error) {
    console.error('[dich-anh-reviews] ghi đánh giá lỗi', error instanceof Error ? error.message : error)
    return { ok: false, error: 'db' }
  }
}
