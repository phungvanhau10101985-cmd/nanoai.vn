import { isValidUuidString } from '@/lib/validate-uuid'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'

export type LanguageCoachReview = {
  id: string
  authorName: string
  rating: number
  body: string
  createdAt: string
}

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS public.language_coach_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  author_name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 12 AND 600),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.language_coach_reviews
  ADD COLUMN IF NOT EXISTS page_key text NOT NULL DEFAULT 'hoc-ngoai-ngu';
CREATE INDEX IF NOT EXISTS idx_language_coach_reviews_created
  ON public.language_coach_reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_language_coach_reviews_page
  ON public.language_coach_reviews (page_key, created_at DESC);
`

export const LANGUAGE_REVIEW_PAGE_KEYS = ['hoc-ngoai-ngu', 'hoc-tieng-viet', 'hoc-tieng-trung', 'hoc-tieng-nhat', 'hoc-tieng-han'] as const
export type LanguageReviewPageKey = (typeof LANGUAGE_REVIEW_PAGE_KEYS)[number]

export const LANGUAGE_REVIEW_PAGE_PATH: Record<LanguageReviewPageKey, string> = {
  'hoc-ngoai-ngu': '/hoc-tieng-anh-ai',
  'hoc-tieng-viet': '/hoc-tieng-viet',
  'hoc-tieng-trung': '/hoc-tieng-trung',
  'hoc-tieng-nhat': '/hoc-tieng-nhat',
  'hoc-tieng-han': '/hoc-tieng-han',
}

export function languageReviewPageKey(value: string): LanguageReviewPageKey {
  if ((LANGUAGE_REVIEW_PAGE_KEYS as readonly string[]).includes(value)) return value as LanguageReviewPageKey
  return 'hoc-ngoai-ngu'
}

/** Đánh giá mẫu của người đã luyện nói. Hiện cùng đánh giá khách gửi. */
export const LANGUAGE_COACH_SEED_REVIEWS: LanguageCoachReview[] = [
  { id: 'seed-01', authorName: 'Minh Châu', rating: 5, body: 'Buổi live tiếng Anh, tôi nói I go to the market. Giáo viên sửa thành I went ngay trong lượt đó. Tôi nghe lại được.', createdAt: '2026-11-07T02:10:00.000Z' },
  { id: 'seed-02', authorName: 'Quốc Bảo', rating: 5, body: 'Tôi để tiếng mẹ đẻ là tiếng Việt, tiếng học là tiếng Nhật. Câu 行きます bị sửa thành 行きました. Dễ hiểu.', createdAt: '2026-11-05T08:40:00.000Z' },
  { id: 'seed-03', authorName: 'Hồng Đào', rating: 4, body: 'Bài có sẵn 12.000đ một bài. Tôi mở bài chào hỏi, nói theo transcript. Không phải chờ người thật.', createdAt: '2026-11-02T03:15:00.000Z' },
  { id: 'seed-04', authorName: 'Thanh Sơn', rating: 4, body: 'Micro máy tính xin quyền một lần. Buổi sau vào là nói được. Câu dài tôi vẫn bị ngắt, phải nói chậm hơn.', createdAt: '2026-10-29T11:05:00.000Z' },
  { id: 'seed-05', authorName: 'Lan Phương', rating: 5, body: 'Học tiếng Hàn. Tôi nói 가요 cho việc sáng nay, được sửa thành 갔어요. Từ đó vào danh sách từ mới.', createdAt: '2026-10-26T01:48:00.000Z' },
  { id: 'seed-06', authorName: 'Đức Trí', rating: 3, body: 'Phòng hơi ồn nên máy nghe nhầm một câu. Tôi nói lại lần hai thì câu sửa đúng. Nên đeo tai nghe.', createdAt: '2026-10-22T07:22:00.000Z' },
  { id: 'seed-07', authorName: 'Mỹ Linh', rating: 5, body: '21.000đ một buổi live. Tôi luyện 15 phút trước cuộc họp với khách Nhật. Đủ để sửa mấy câu mở đầu.', createdAt: '2026-10-18T04:36:00.000Z' },
  { id: 'seed-08', authorName: 'Hoàng Nam', rating: 4, body: 'Tôi chọn tiếng mẹ đẻ tiếng Anh để học tiếng Việt. Câu thiếu đã được chỉ ra. Phù hợp người nước ngoài.', createdAt: '2026-10-14T09:11:00.000Z' },
  { id: 'seed-09', authorName: 'Thu Trang', rating: 5, body: 'Bài có sẵn giữ câu đã học. Buổi live thì hỏi việc mới. Tôi dùng bài có sẵn buổi tối, live khi cần nói thật.', createdAt: '2026-10-09T02:55:00.000Z' },
  { id: 'seed-10', authorName: 'Văn Khang', rating: 4, body: 'Từ mới nằm riêng, xem lại không bị trừ thêm. Tôi ôn mười từ tiếng Trung trước khi mở buổi mới.', createdAt: '2026-10-04T13:20:00.000Z' },
  { id: 'seed-11', authorName: 'Ngọc Ánh', rating: 5, body: 'Học tiếng Thái. Câu khiếm มา được thêm vào cho việc đã xảy ra. Tôi nhắc lại đúng một lần là qua.', createdAt: '2026-09-28T06:14:00.000Z' },
  { id: 'seed-12', authorName: 'Phúc An', rating: 4, body: 'Giọng giáo viên tiếng Anh chọn được nam hoặc nữ. Tôi để giọng nữ, nghe câu sửa rõ hơn trên loa laptop.', createdAt: '2026-09-20T10:42:00.000Z' },
]

/** Đánh giá của người nước ngoài đã luyện tiếng Việt. */
export const VIETNAMESE_COACH_SEED_REVIEWS: LanguageCoachReview[] = [
  { id: 'vi-seed-01', authorName: 'Anna Cole', rating: 5, body: 'I set English as my native language and learned Vietnamese. “Sáng nay tôi đi chợ” became “Sáng nay tôi đã đi chợ”. The note was in English.', createdAt: '2026-11-07T02:10:00.000Z' },
  { id: 'vi-seed-02', authorName: 'Wei Zhang', rating: 5, body: 'Tôi học tiếng Việt, tiếng mẹ đẻ là tiếng Trung. Câu thiếu đã đi được chỉ ra. Chú thích viết bằng tiếng Trung, tôi đọc được.', createdAt: '2026-11-04T08:40:00.000Z' },
  { id: 'vi-seed-03', authorName: 'Kenji Sato', rating: 4, body: 'Buổi live tiếng Việt 21.000đ. Tôi nói trước chuyến Hà Nội. Giáo viên sửa câu chào, chú thích bằng tiếng Nhật.', createdAt: '2026-11-01T03:15:00.000Z' },
  { id: 'vi-seed-04', authorName: 'Minji Park', rating: 5, body: 'Bài có sẵn 12.000đ. Tôi mở bài chào hỏi tiếng Việt và nói theo transcript. Không phải chờ người Việt thật.', createdAt: '2026-10-28T11:05:00.000Z' },
  { id: 'vi-seed-05', authorName: 'Suda Chai', rating: 4, body: 'Tiếng mẹ đẻ tôi để tiếng Thái. Câu “tôi đi chợ” khi việc đã xong được sửa thành “tôi đã đi chợ”.', createdAt: '2026-10-24T01:48:00.000Z' },
  { id: 'vi-seed-06', authorName: 'Priya Shah', rating: 4, body: 'Chú thích bằng tiếng Hindi giúp tôi hiểu vì sao phải thêm đã. Tôi nhắc lại đúng một lần là qua.', createdAt: '2026-10-20T07:22:00.000Z' },
  { id: 'vi-seed-07', authorName: 'Lucas Meyer', rating: 3, body: 'Phòng hơi ồn nên máy nghe nhầm một câu tiếng Việt. Tôi nói lại lần hai thì câu sửa đúng. Nên đeo tai nghe.', createdAt: '2026-10-15T04:36:00.000Z' },
  { id: 'vi-seed-08', authorName: 'Emma Brooks', rating: 5, body: 'Micro xin quyền một lần. Buổi sau vào là nói tiếng Việt được. Từ đã sửa nằm trong danh sách từ mới.', createdAt: '2026-10-10T09:11:00.000Z' },
  { id: 'vi-seed-09', authorName: 'Noah Kim', rating: 4, body: 'Xem từ tiếng Việt đã lưu không bị trừ thêm. Tôi ôn mười từ trước khi mở buổi live mới.', createdAt: '2026-10-04T13:20:00.000Z' },
  { id: 'vi-seed-10', authorName: 'Hana Ito', rating: 5, body: 'Tôi không phải người Việt. Trang giữ tiếng đang học là tiếng Việt, tôi chỉ đổi tiếng mẹ đẻ sang tiếng Nhật.', createdAt: '2026-09-20T10:42:00.000Z' },
]

/** Đánh giá của người đã luyện tiếng Trung. */
export const CHINESE_COACH_SEED_REVIEWS: LanguageCoachReview[] = [
  { id: 'zh-seed-01', authorName: 'Minh Anh', rating: 5, body: 'Tôi để tiếng mẹ đẻ là tiếng Việt. Câu 我今天早上去市场 được sửa thành 我今天早上去了市场. Trợ từ 了 được thêm ngay trong lượt đó.', createdAt: '2026-11-07T02:10:00.000Z' },
  { id: 'zh-seed-02', authorName: 'Quốc Huy', rating: 5, body: '21.000đ một buổi live tiếng Trung. Tôi luyện 15 phút trước cuộc họp với đối tác ở Thượng Hải. Câu chào được sửa rõ.', createdAt: '2026-11-04T08:40:00.000Z' },
  { id: 'zh-seed-03', authorName: 'Thu Hà', rating: 4, body: 'Bài có sẵn 12.000đ. Tôi mở bài chào hỏi tiếng Trung và nói theo transcript. Không phải chờ người Trung thật.', createdAt: '2026-11-01T03:15:00.000Z' },
  { id: 'zh-seed-04', authorName: 'Đức Anh', rating: 4, body: 'Micro máy tính xin quyền một lần. Buổi sau vào là nói tiếng Trung được. Câu dài tôi vẫn phải nói chậm hơn.', createdAt: '2026-10-28T11:05:00.000Z' },
  { id: 'zh-seed-05', authorName: 'Lan Chi', rating: 5, body: 'Chú thích bằng tiếng Việt giải thích vì sao câu thiếu 了. Tôi nhắc lại đúng một lần là qua.', createdAt: '2026-10-24T01:48:00.000Z' },
  { id: 'zh-seed-06', authorName: 'Hoàng Long', rating: 3, body: 'Phòng hơi ồn nên máy nghe nhầm một câu tiếng Trung. Tôi nói lại lần hai thì câu sửa đúng. Nên đeo tai nghe.', createdAt: '2026-10-20T07:22:00.000Z' },
  { id: 'zh-seed-07', authorName: 'Mỹ Duyên', rating: 5, body: 'Từ tiếng Trung đã lưu nằm riêng. Tôi ôn mười từ trước khi mở buổi live mới, không bị trừ thêm.', createdAt: '2026-10-15T04:36:00.000Z' },
  { id: 'zh-seed-08', authorName: 'Nhật Nam', rating: 4, body: 'Tôi đổi tiếng mẹ đẻ sang tiếng Anh. Tiếng đang học vẫn là tiếng Trung. Chú thích đổi theo tiếng Anh.', createdAt: '2026-10-10T09:11:00.000Z' },
  { id: 'zh-seed-09', authorName: 'Bảo Ngọc', rating: 5, body: 'Tôi nghe lại câu sửa được. Câu 去了 dễ nhớ hơn câu thiếu 了. Buổi tối tôi mở bài có sẵn để nhắc lại.', createdAt: '2026-10-04T13:20:00.000Z' },
  { id: 'zh-seed-10', authorName: 'Thanh Tùng', rating: 4, body: 'Trang giữ tiếng Trung, không nhảy sang tiếng Anh. Tôi chỉ chọn tiếng mẹ đẻ rồi nói. Giá 21.000đ một buổi live.', createdAt: '2026-09-20T10:42:00.000Z' },
]

/** Đánh giá của người đã luyện tiếng Nhật. */
export const JAPANESE_COACH_SEED_REVIEWS: LanguageCoachReview[] = [
  { id: 'ja-seed-01', authorName: 'Hà My', rating: 5, body: 'Tôi để tiếng mẹ đẻ là tiếng Việt. Câu 今朝、市場に行きます được sửa thành 今朝、市場に行きました. Thì quá khứ được đổi ngay trong lượt đó.', createdAt: '2026-11-07T02:10:00.000Z' },
  { id: 'ja-seed-02', authorName: 'Minh Khôi', rating: 5, body: '21.000đ một buổi live tiếng Nhật. Tôi luyện 15 phút trước cuộc họp với khách ở Tokyo. Câu chào được sửa rõ.', createdAt: '2026-11-04T08:40:00.000Z' },
  { id: 'ja-seed-03', authorName: 'Quỳnh Anh', rating: 4, body: 'Bài có sẵn 12.000đ. Tôi mở bài chào hỏi tiếng Nhật và nói theo transcript. Không phải chờ người Nhật thật.', createdAt: '2026-11-01T03:15:00.000Z' },
  { id: 'ja-seed-04', authorName: 'Tuấn Kiệt', rating: 4, body: 'Micro máy tính xin quyền một lần. Buổi sau vào là nói tiếng Nhật được. Câu dài tôi vẫn phải nói chậm hơn.', createdAt: '2026-10-28T11:05:00.000Z' },
  { id: 'ja-seed-05', authorName: 'Diệu Linh', rating: 5, body: 'Chú thích bằng tiếng Việt giải thích vì sao 行きます thành 行きました. Tôi nhắc lại đúng một lần là qua.', createdAt: '2026-10-24T01:48:00.000Z' },
  { id: 'ja-seed-06', authorName: 'Gia Bảo', rating: 3, body: 'Phòng hơi ồn nên máy nghe nhầm một câu tiếng Nhật. Tôi nói lại lần hai thì câu sửa đúng. Nên đeo tai nghe.', createdAt: '2026-10-20T07:22:00.000Z' },
  { id: 'ja-seed-07', authorName: 'Phương Thảo', rating: 5, body: 'Từ tiếng Nhật đã lưu nằm riêng. Tôi ôn mười từ trước khi mở buổi live mới, không bị trừ thêm.', createdAt: '2026-10-15T04:36:00.000Z' },
  { id: 'ja-seed-08', authorName: 'Anh Tuấn', rating: 4, body: 'Tôi đổi tiếng mẹ đẻ sang tiếng Anh. Tiếng đang học vẫn là tiếng Nhật. Chú thích đổi theo tiếng Anh.', createdAt: '2026-10-10T09:11:00.000Z' },
  { id: 'ja-seed-09', authorName: 'Khánh Vy', rating: 5, body: 'Tôi nghe lại câu sửa được. Câu 行きました dễ nhớ hơn câu 行きます. Buổi tối tôi mở bài có sẵn để nhắc lại.', createdAt: '2026-10-04T13:20:00.000Z' },
  { id: 'ja-seed-10', authorName: 'Đình Phong', rating: 4, body: 'Trang giữ tiếng Nhật, không nhảy sang tiếng Anh. Tôi chỉ chọn tiếng mẹ đẻ rồi nói. Giá 21.000đ một buổi live.', createdAt: '2026-09-20T10:42:00.000Z' },
]

/** Đánh giá của người đã luyện tiếng Hàn. */
export const KOREAN_COACH_SEED_REVIEWS: LanguageCoachReview[] = [
  { id: 'ko-seed-01', authorName: 'Mai Chi', rating: 5, body: 'Tôi để tiếng mẹ đẻ là tiếng Việt. Câu 오늘 아침에 시장에 가요 được sửa thành 오늘 아침에 시장에 갔어요. Thì quá khứ được đổi ngay trong lượt đó.', createdAt: '2026-11-07T02:10:00.000Z' },
  { id: 'ko-seed-02', authorName: 'Hoàng Phúc', rating: 5, body: '21.000đ một buổi live tiếng Hàn. Tôi luyện 15 phút trước cuộc gọi với đối tác ở Seoul. Câu chào được sửa rõ.', createdAt: '2026-11-04T08:40:00.000Z' },
  { id: 'ko-seed-03', authorName: 'Ngọc Lan', rating: 4, body: 'Bài có sẵn 12.000đ. Tôi mở bài chào hỏi tiếng Hàn và nói theo transcript. Không phải chờ người Hàn thật.', createdAt: '2026-11-01T03:15:00.000Z' },
  { id: 'ko-seed-04', authorName: 'Việt Anh', rating: 4, body: 'Micro máy tính xin quyền một lần. Buổi sau vào là nói tiếng Hàn được. Câu dài tôi vẫn phải nói chậm hơn.', createdAt: '2026-10-28T11:05:00.000Z' },
  { id: 'ko-seed-05', authorName: 'Thanh Mai', rating: 5, body: 'Chú thích bằng tiếng Việt giải thích vì sao 가요 thành 갔어요. Tôi nhắc lại đúng một lần là qua.', createdAt: '2026-10-24T01:48:00.000Z' },
  { id: 'ko-seed-06', authorName: 'Đức Huy', rating: 3, body: 'Phòng hơi ồn nên máy nghe nhầm một câu tiếng Hàn. Tôi nói lại lần hai thì câu sửa đúng. Nên đeo tai nghe.', createdAt: '2026-10-20T07:22:00.000Z' },
  { id: 'ko-seed-07', authorName: 'Hồng Nhung', rating: 5, body: 'Từ tiếng Hàn đã lưu nằm riêng. Tôi ôn mười từ trước khi mở buổi live mới, không bị trừ thêm.', createdAt: '2026-10-15T04:36:00.000Z' },
  { id: 'ko-seed-08', authorName: 'Quang Minh', rating: 4, body: 'Tôi đổi tiếng mẹ đẻ sang tiếng Nhật. Tiếng đang học vẫn là tiếng Hàn. Chú thích đổi theo tiếng Nhật.', createdAt: '2026-10-10T09:11:00.000Z' },
  { id: 'ko-seed-09', authorName: 'Thuý An', rating: 5, body: 'Tôi nghe lại câu sửa được. Câu 갔어요 dễ nhớ hơn câu 가요. Buổi tối tôi mở bài có sẵn để nhắc lại.', createdAt: '2026-10-04T13:20:00.000Z' },
  { id: 'ko-seed-10', authorName: 'Công Danh', rating: 4, body: 'Trang giữ tiếng Hàn, không nhảy sang tiếng Anh. Tôi chỉ chọn tiếng mẹ đẻ rồi nói. Giá 21.000đ một buổi live.', createdAt: '2026-09-20T10:42:00.000Z' },
]

const SEED_DATE_NEWEST_MS = Date.parse('2026-11-07T02:10:00.000Z')
const SEED_DATE_OLDEST_MS = Date.parse('2026-09-20T10:42:00.000Z')
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

/** Mốc trong mảng chỉ để giữ khoảng cách. Lúc hiển thị, mới nhất cách hôm nay 3 ngày, cũ nhất cách 3 tháng. */
export function slideSeedReviews(reviews: LanguageCoachReview[], now = new Date()): LanguageCoachReview[] {
  const wall = vnWall(now.getTime())
  const newestMs = fromVnWall(wall.y, wall.m, wall.d - 3, wall.h, wall.min, wall.s)
  const oldestMs = fromVnWall(wall.y, wall.m - 3, wall.d, wall.h, wall.min, wall.s)
  const span = SEED_DATE_NEWEST_MS - SEED_DATE_OLDEST_MS
  return reviews.map((review) => {
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

export function slideLanguageCoachSeedReviews(now = new Date()): LanguageCoachReview[] {
  return slideSeedReviews(LANGUAGE_COACH_SEED_REVIEWS, now)
}

export function slideVietnameseCoachSeedReviews(now = new Date()): LanguageCoachReview[] {
  return slideSeedReviews(VIETNAMESE_COACH_SEED_REVIEWS, now)
}

export function slideChineseCoachSeedReviews(now = new Date()): LanguageCoachReview[] {
  return slideSeedReviews(CHINESE_COACH_SEED_REVIEWS, now)
}

export function slideJapaneseCoachSeedReviews(now = new Date()): LanguageCoachReview[] {
  return slideSeedReviews(JAPANESE_COACH_SEED_REVIEWS, now)
}

export function slideKoreanCoachSeedReviews(now = new Date()): LanguageCoachReview[] {
  return slideSeedReviews(KOREAN_COACH_SEED_REVIEWS, now)
}

let tableReady = false

async function ensureTable(): Promise<boolean> {
  if (!isPgConfigured()) return false
  if (tableReady) return true
  await getPgPool().query(ENSURE_SQL)
  tableReady = true
  return true
}

export async function listLanguageCoachReviews(pageKey: LanguageReviewPageKey = 'hoc-ngoai-ngu'): Promise<LanguageCoachReview[]> {
  const seeds = pageKey === 'hoc-tieng-viet'
    ? slideVietnameseCoachSeedReviews()
    : pageKey === 'hoc-tieng-trung'
      ? slideChineseCoachSeedReviews()
      : pageKey === 'hoc-tieng-nhat'
        ? slideJapaneseCoachSeedReviews()
        : pageKey === 'hoc-tieng-han'
          ? slideKoreanCoachSeedReviews()
          : slideLanguageCoachSeedReviews()
  let saved: LanguageCoachReview[] = []
  try {
    if (await ensureTable()) {
      const result = await getPgPool().query<{
        id: string
        author_name: string
        rating: number
        body: string
        created_at: Date
      }>(`select id::text, author_name, rating, body, created_at
          from public.language_coach_reviews
          where page_key = $1
          order by created_at desc
          limit 40`, [pageKey])
      saved = result.rows.map((row) => ({
        id: row.id,
        authorName: row.author_name,
        rating: Number(row.rating),
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
      }))
    }
  } catch (error) {
    console.error('[hoc-ngoai-ngu-reviews] đọc đánh giá lỗi', error instanceof Error ? error.message : error)
  }
  return [...saved, ...seeds].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function insertLanguageCoachReview(input: {
  userId: string
  authorName: string
  rating: number
  body: string
  pageKey?: LanguageReviewPageKey
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const body = input.body.trim()
  if (body.length < 12 || body.length > 600) return { ok: false, error: 'short' }
  if (input.rating < 1 || input.rating > 5) return { ok: false, error: 'rating' }
  try {
    if (!(await ensureTable())) return { ok: false, error: 'db' }
    const userId = isValidUuidString(input.userId) ? input.userId : null
    await getPgPool().query(
      `insert into public.language_coach_reviews (user_id, author_name, rating, body, page_key)
       values ($1::uuid, $2, $3, $4, $5)`,
      [userId, input.authorName.slice(0, 80), input.rating, body, input.pageKey ?? 'hoc-ngoai-ngu'],
    )
    return { ok: true }
  } catch (error) {
    console.error('[hoc-ngoai-ngu-reviews] ghi đánh giá lỗi', error instanceof Error ? error.message : error)
    return { ok: false, error: 'db' }
  }
}
