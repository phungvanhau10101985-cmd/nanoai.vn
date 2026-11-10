import { isValidUuidString } from '@/lib/validate-uuid'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export type WeddingReview = {
  id: string
  authorName: string
  rating: number
  body: string
  createdAt: string
}

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS public.wedding_card_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  author_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 12 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wedding_card_reviews_created
  ON public.wedding_card_reviews (created_at DESC);
`

/** Đánh giá mẫu, giọng người đã gửi thiệp. Hiện cùng đánh giá khách gửi. */
export const WEDDING_CARD_SEED_REVIEWS: WeddingReview[] = [
  { id: 'seed-01', authorName: 'Minh Quân', rating: 5, body: 'Gửi link riêng cho chú bên nội. Mở ra thấy «Chú Minh Quân», không phải một link chung. Chú bấm đi và ghi 2 người lớn.', createdAt: '2026-11-07T02:18:00.000Z' },
  { id: 'seed-02', authorName: 'Phương Thảo', rating: 5, body: 'Nhà gái một ngày, nhà trai một ngày. Hai địa điểm và hai link bản đồ. Khách không nhắn lại hỏi giờ.', createdAt: '2026-11-05T01:06:00.000Z' },
  { id: 'seed-03', authorName: 'Văn Khoa', rating: 4, body: 'Số người đi hiện riêng từng nhà. Một khách ghi 4 người rồi sửa thành 3, số trên danh sách đổi theo. Tôi vẫn nhắn lại cho chắc.', createdAt: '2026-11-03T08:41:00.000Z' },
  { id: 'seed-04', authorName: 'Kim Chi', rating: 5, body: 'Ba khách đầu mỗi bên không mất tiền. Hết thử tôi lấy gói 100 khách, 149.000đ. Nhà gái tính riêng nên mua sau.', createdAt: '2026-11-01T03:27:00.000Z' },
  { id: 'seed-05', authorName: 'Hoàng Long', rating: 5, body: 'Tên có dấu. «Nguyễn Ngọc» không bị rơi dấu như thiệp giấy lần trước. Khách mở trên điện thoại đọc được.', createdAt: '2026-10-30T11:14:00.000Z' },
  { id: 'seed-06', authorName: 'Ngọc Mai', rating: 4, body: 'Nhạc nền và hoa bung khi mở. Máy của cô tôi hơi cũ, hoa giật một nhịp rồi mới bung. Lời mời thì hiện ngay.', createdAt: '2026-10-28T13:52:00.000Z' },
  { id: 'seed-07', authorName: 'Thanh Tùng', rating: 5, body: 'Album ảnh cưới nằm trên thiệp. Họ hàng xem không cần tải app. Tôi gửi Zalo như gửi một link thường.', createdAt: '2026-10-26T04:09:00.000Z' },
  { id: 'seed-08', authorName: 'Mỹ Duyên', rating: 3, body: 'Một khách bảo không nghe nhạc. Máy họ đang tắt tiếng. Tôi ghi thêm một câu trong tin Zalo. Nút đi hoặc không đi thì vẫn bấm được.', createdAt: '2026-10-24T02:33:00.000Z' },
  { id: 'seed-09', authorName: 'Quốc Huy', rating: 5, body: 'Mã QR mừng cưới và số tài khoản nằm cùng trang với lời mời. Cô tôi xem xong rồi mới bấm số người đi.', createdAt: '2026-10-22T07:20:00.000Z' },
  { id: 'seed-10', authorName: 'Thu Hà', rating: 5, body: 'Lịch trình có đón khách, làm lễ, khai tiệc. Tôi sửa giờ khai tiệc bằng tay. Sửa tay không trừ credit.', createdAt: '2026-10-20T01:48:00.000Z' },
  { id: 'seed-11', authorName: 'Đức Minh', rating: 4, body: 'Dùng mẫu rồi OK, AI soạn lời mở đầu và câu chuyện. Một câu hơi văn mẫu. Tôi bấm Tối ưu AI đoạn đó, trừ 0,1 credit.', createdAt: '2026-10-18T10:05:00.000Z' },
  { id: 'seed-12', authorName: 'Lan Anh', rating: 5, body: 'Mỗi khách một link. Anh họ mở thấy tên mình, không thấy tên khách khác. Nhóm bạn không phải in thiệp giấy.', createdAt: '2026-10-16T03:16:00.000Z' },
  { id: 'seed-13', authorName: 'Hữu Phước', rating: 4, body: 'Gói 200 khách, 199.000đ, cho nhà trai. Danh sách đi và không đi tách nhau. 11 người chưa trả lời, tôi gọi đúng những người đó.', createdAt: '2026-10-14T12:27:00.000Z' },
  { id: 'seed-14', authorName: 'Thanh Hà', rating: 5, body: 'Khách chọn không đi vẫn còn trong danh sách. Tôi biết nhà nào vắng để khỏi giữ mâm.', createdAt: '2026-10-12T06:44:00.000Z' },
  { id: 'seed-15', authorName: 'Nhật Nam', rating: 3, body: 'Link bản đồ nhà gái tôi dán nhầm. Khách bấm ra sai chỗ. Sửa link rồi gửi lại. Không phải làm lại cả thiệp.', createdAt: '2026-10-10T02:11:00.000Z' },
  { id: 'seed-16', authorName: 'Bích Ngọc', rating: 5, body: 'Gọi đúng «cô» và «chị». Hai người cùng họ, mỗi người một lời. Họ gửi ảnh màn hình cho tôi xem.', createdAt: '2026-10-08T09:38:00.000Z' },
  { id: 'seed-17', authorName: 'Quang Dũng', rating: 5, body: 'Xem trước và xuất bản không trừ credit. Tôi sửa giờ đón khách ba lần trong buổi tối, số credit không đổi.', createdAt: '2026-10-06T04:55:00.000Z' },
  { id: 'seed-18', authorName: 'Hồng Nhung', rating: 4, body: 'Hoa văn nền tôi xem phóng to rồi mới chọn. Trên điện thoại khách, hoa không che tên. Chỗ quote hơi sát mép, tôi giảm cỡ chữ.', createdAt: '2026-10-04T13:02:00.000Z' },
  { id: 'seed-19', authorName: 'Tuấn Anh', rating: 5, body: 'Trẻ em và người lớn ghi riêng. Bên nội có nhà 2 người lớn, 1 trẻ. Tôi cộng cỗ người lớn theo số đó.', createdAt: '2026-10-02T01:29:00.000Z' },
  { id: 'seed-20', authorName: 'Diệu Linh', rating: 4, body: 'Gói không giới hạn 299.000đ vì họ nhà trai đông. Nhà gái để gói 100 khách. Hai bên không gộp một hóa đơn.', createdAt: '2026-09-30T08:17:00.000Z' },
  { id: 'seed-21', authorName: 'Công Danh', rating: 5, body: 'Khách chưa trả lời thì không nằm trong số người đi. Tôi không nấu nhầm cho người chưa gật.', createdAt: '2026-09-28T11:46:00.000Z' },
  { id: 'seed-22', authorName: 'Mai Phương', rating: 5, body: 'Gửi Facebook cho nhóm lớp. Link mở trên trình duyệt, không bảo ai cài app. Vài bạn bấm đi ngay trong tối.', createdAt: '2026-09-26T03:08:00.000Z' },
  { id: 'seed-23', authorName: 'Khánh Vy', rating: 3, body: 'Ảnh album thứ tư tải lâu trên 4G. Ba ảnh đầu thì hiện. Tôi nén ảnh đó rồi thay, sau đó mở được.', createdAt: '2026-09-24T07:33:00.000Z' },
  { id: 'seed-24', authorName: 'Đình Phong', rating: 5, body: 'Thiệp mẫu hoa mẫu đơn. Tôi giữ nền, đổi tên hai họ và ngày. Khách bảo giống thiệp giấy, nhưng bấm được trên máy.', createdAt: '2026-09-22T02:52:00.000Z' },
  { id: 'seed-25', authorName: 'Trúc Lam', rating: 4, body: 'Một khách chuyển tiếp link của mình. Người nhận thấy lời mời ghi tên khách đầu, không phải tên mình. Tôi thêm một dòng khách mới.', createdAt: '2026-09-20T14:21:00.000Z' },
  { id: 'seed-26', authorName: 'Sơn Tùng', rating: 5, body: 'Đếm nhà trai và nhà gái riêng. Sáng lễ nhà trai 86 người lớn, chiều nhà gái 74. Tôi đưa hai số cho bên nấu.', createdAt: '2026-09-18T04:14:00.000Z' },
  { id: 'seed-27', authorName: 'Hà My', rating: 4, body: 'Câu cảm ơn AI viết dùng được. Câu chuyện hai người tôi viết tay vì muốn đúng một kỷ niệm. Viết tay không trừ credit.', createdAt: '2026-09-16T09:07:00.000Z' },
  { id: 'seed-28', authorName: 'Bảo Trân', rating: 5, body: 'Mã QR trên thiệp để khách mở lời mời. Phần mừng cưới là mã chuyển khoản khác, cùng một trang. Tôi giải thích một lần trong họ là xong.', createdAt: '2026-09-14T01:36:00.000Z' },
  { id: 'seed-29', authorName: 'Việt Anh', rating: 4, body: 'Điện thoại để ngang, tên khách vẫn đọc được. Cánh hoa khi lướt trên máy tôi hơi nhiều. Khách bảo máy họ vừa.', createdAt: '2026-09-12T06:19:00.000Z' },
  { id: 'seed-30', authorName: 'Thu Trang', rating: 5, body: 'Ba khách thử mỗi bên đủ để gửi bố mẹ và một cô. Bố bấm đi, ghi 2 người lớn. Tôi thấy trên danh sách trước khi mua gói.', createdAt: '2026-09-10T12:48:00.000Z' },
  { id: 'seed-31', authorName: 'Minh Khang', rating: 5, body: 'Ngày nhà trai và nhà gái khác nhau. Thiệp không gộp một giờ. Khách bên ngoại không đến nhầm buổi.', createdAt: '2026-09-08T03:55:00.000Z' },
  { id: 'seed-32', authorName: 'Ngọc Anh', rating: 4, body: 'Tôi sửa danh xưng từ «ông» thành «chú» cho một người. Cùng link đó mở lại đã thấy chữ mới.', createdAt: '2026-09-06T08:02:00.000Z' },
  { id: 'seed-33', authorName: 'Đức Thành', rating: 3, body: 'Bài nhạc tôi chọn hơi dài. Khách nghe một đoạn rồi tắt. Lời mời và nút đi hoặc không đi không phụ thuộc nhạc.', createdAt: '2026-09-04T11:28:00.000Z' },
  { id: 'seed-34', authorName: 'Lan Phương', rating: 5, body: 'Không in thiệp. Tôi gửi link cho 40 khách trong một buổi chiều. Ai trả lời thì số người đi nhích lên.', createdAt: '2026-09-02T02:41:00.000Z' },
  { id: 'seed-35', authorName: 'Quang Minh', rating: 5, body: 'Chữ vẽ trên nền không phải tên khách. Tên do hệ thống sắp, nên dấu tiếng Việt còn. Tôi từng bị thiệp in mất dấu.', createdAt: '2026-08-31T07:13:00.000Z' },
  { id: 'seed-36', authorName: 'Hồng Ân', rating: 4, body: 'Gói 100 khách không thêm được người thứ 101. Khách đã có vẫn còn. Tôi lên gói 200 rồi thêm tiếp.', createdAt: '2026-08-27T13:37:00.000Z' },
  { id: 'seed-37', authorName: 'Thảo Vy', rating: 5, body: 'Khách chọn không đi. Số cỗ không cộng người đó. Lời chúc họ ghi trên thiệp thì tôi đọc được, không phải gọi hỏi.', createdAt: '2026-08-23T04:22:00.000Z' },
  { id: 'seed-38', authorName: 'Hùng Cường', rating: 4, body: 'Bản đồ là link Google Maps tôi dán, không có chỉ đường riêng trong thiệp. Họ ở tỉnh khác mở Maps là tới.', createdAt: '2026-08-19T01:58:00.000Z' },
  { id: 'seed-39', authorName: 'Yến Nhi', rating: 5, body: 'Xem mẫu không mất credit. Tôi mở bốn chủ đề, chọn một, rồi mới điền tên. Đổi ý thì chọn mẫu khác.', createdAt: '2026-08-14T09:26:00.000Z' },
  { id: 'seed-40', authorName: 'Tuấn Kiệt', rating: 4, body: 'Hôm lễ, số người đi khớp danh sách tôi chốt tối hôm trước. Có hai nhà đến thiếu một trẻ so với số đã ghi. Việc đó nằm ngoài thiệp.', createdAt: '2026-08-10T09:16:00.000Z' },
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
export function slideWeddingCardSeedReviews(now = new Date()): WeddingReview[] {
  const wall = vnWall(now.getTime())
  const newestMs = fromVnWall(wall.y, wall.m, wall.d - 3, wall.h, wall.min, wall.s)
  const oldestMs = fromVnWall(wall.y, wall.m - 3, wall.d, wall.h, wall.min, wall.s)
  const span = SEED_DATE_NEWEST_MS - SEED_DATE_OLDEST_MS
  return WEDDING_CARD_SEED_REVIEWS.map((review) => {
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

export async function listWeddingCardReviews(): Promise<WeddingReview[]> {
  let saved: WeddingReview[] = []
  try {
    if (await ensureTable()) {
      const result = await getPgPool().query<{
        id: string
        author_name: string
        rating: number
        body: string
        created_at: Date
      }>(`select id::text, author_name, rating, body, created_at
          from public.wedding_card_reviews
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
    console.error('[wedding-reviews] đọc đánh giá lỗi', error instanceof Error ? error.message : error)
  }
  return [...saved, ...slideWeddingCardSeedReviews()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function insertWeddingCardReview(input: {
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
      `insert into public.wedding_card_reviews (user_id, author_name, rating, body)
       values ($1::uuid, $2, $3, $4)`,
      [userId, input.authorName.slice(0, 80), input.rating, body]
    )
    return { ok: true }
  } catch (error) {
    console.error('[wedding-reviews] ghi đánh giá lỗi', error instanceof Error ? error.message : error)
    return { ok: false, error: 'db' }
  }
}
