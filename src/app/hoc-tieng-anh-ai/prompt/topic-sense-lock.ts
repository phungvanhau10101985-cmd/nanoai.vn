/**
 * Từ đa nghĩa trong câu học sinh phải theo chủ đề buổi học và hội thoại.
 * Ví dụ chủ đề gọi đồ uống: "nước" = đồ uống, không phải quốc gia.
 */

export type TopicSenseFields = {
  topicLabel?: string
  topicRole?: string
  topicObjective?: string
  topicKeywords?: string[]
  studentText?: string
  candidateText?: string
}

export function foldCoachText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
}

/** Khối prompt dùng chung mọi lượt sửa câu, mọi chủ đề. */
export function topicSenseLockGuide(targetLanguage: string): string {
  const lang = String(targetLanguage || '').trim() || 'ngôn ngữ đang học'
  return `KHÓA NGHĨA TỪ ĐA NGHĨA THEO CHỦ ĐỀ (áp dụng MỌI chủ đề, mọi cặp ngôn ngữ):
- Trước khi dịch câu học sinh sang ${lang}, đọc chủ đề buổi học (topicLabel, vai, mục tiêu, từ khóa) và lịch sử hội thoại.
- Từ có nhiều nghĩa thì CHỌN nghĩa thuộc đúng việc đang nói. Thứ tự: hội thoại vừa rồi > chủ đề buổi học > nghĩa từ điển đứng riêng.
- mainSentence, corrections.fixed và câu trả lời trực tiếp phải cùng một nghĩa. Cấm sửa câu học sinh sang một chủ đề khác.
- Khi chủ đề hoặc hội thoại là gọi đồ uống, gọi món, quán cà phê, nhà hàng: "nước" = đồ uống, không phải quốc gia. "ở đây có những nước gì" nghĩa là hỏi quán đang có những đồ uống nào. Viết câu đó bằng ${lang}.
  Mẫu nghĩa (chỉ để khóa nghĩa, câu trả về phải bằng ${lang}):
  • Trung: 这里有什么饮料？
  • Anh: What drinks do you have here?
  • Nhật: こちらにはどんな飲み物がありますか？
  • Hàn: 여기 어떤 음료가 있어요?
  CẤM nghĩa "có những quốc gia gì": 这里有什么国家？ / What countries are there here?
- Cùng quy tắc cho mọi chủ đề khác, không chỉ đồ uống:
  • Gọi món, đồ uống: "gọi" = gọi món (không phải gọi điện), "đá" = nước đá, "nóng/lạnh" = đồ uống nóng hoặc có đá, "ly/cốc" = ly uống.
  • Du lịch, địa lý, quốc gia: "nước" = quốc gia.
  • Điện thoại, liên lạc: "gọi" = gọi điện.
  • Mua sắm: "trả" = thanh toán.
  • Khách sạn: "đặt" = đặt phòng, "phòng" = phòng nghỉ.
  • Khám bệnh: "thuốc" = thuốc chữa, "đau" = chỗ đau trên cơ thể.
  • Sân bay: "chuyến" = chuyến bay, "cửa" = cửa ra máy bay.
  • Họp, phỏng vấn: "bàn" = bàn bạc.
- Câu thiếu từ hoặc lệch ngữ pháp nhưng ý đã rõ theo chủ đề thì viết thành câu tự nhiên đúng ý đó.`
}

function topicBlob(input: TopicSenseFields): string {
  return foldCoachText(
    [input.topicLabel, input.topicRole, input.topicObjective, ...(input.topicKeywords || [])]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join(' ')
  )
}

const DRINK_TOPIC = /do uong|nuoc uong|quan nuoc|goi nuoc|ca phe|cafe|coffee|tra sua|beverage|\bdrinks?\b|thuc uong/
const FOOD_TOPIC = /goi mon|nha hang|quan an|thuc don|dat mon|mon an|thuc an|quan cafe|quan ca phe/
const COUNTRY_TOPIC = /quoc gia|dia ly|quoc tich|\bcountries\b|\bcountry\b|nuoc ngoai|dat nuoc/
const PHONE_TOPIC = /goi dien|dien thoai|cuoc goi|phone call|lien lac/

function mentionsNuoc(folded: string): boolean {
  return /(^|[^a-z])nuoc([^a-z]|$)/.test(folded)
}

/** "của nước nào", "xuất xứ" — học sinh đang hỏi nguồn gốc, không hỏi đồ uống. */
function nuocIsOriginQuestion(folded: string): boolean {
  return /cua nuoc|nuoc nao|xuat xu|den tu|o nuoc|nguoi nuoc|tu nuoc|dat nuoc|nuoc ngoai|quoc gia/.test(folded)
}

function hasCountrySense(raw: string): boolean {
  const folded = foldCoachText(raw)
  return /国家|哪个国家|什么国家|どんな国|どの国|何の国|나라/.test(raw)
    || /\bcountr(?:y|ies)\b/.test(folded)
    || /(^|[^a-z])quoc gia([^a-z]|$)/.test(folded)
}

function hasDrinkSense(raw: string): boolean {
  const folded = foldCoachText(raw)
  return /饮料|喝的|飲み物|飲みもの|음료/.test(raw)
    || /\bdrinks?\b/.test(folded)
    || /\bbeverages?\b/.test(folded)
    || /nuoc uong|do uong|thuc uong/.test(folded)
}

function mentionsGoi(folded: string): boolean {
  return /(^|[^a-z])goi([^a-z]|$)/.test(folded)
}

function goiIsPhone(folded: string): boolean {
  return /goi dien|dien thoai|cuoc goi|\balo\b/.test(folded)
}

function goiIsOrder(folded: string): boolean {
  return /goi mon|goi do an|goi nuoc|goi ly|goi coc|goi mot/.test(folded)
}

function hasPhoneSense(raw: string): boolean {
  const folded = foldCoachText(raw)
  return /打电话|通話|전화를/.test(raw) || /phone call|goi dien|cuoc goi/.test(folded)
}

function hasFoodOrderSense(raw: string): boolean {
  const folded = foldCoachText(raw)
  return /点餐|点菜|注文|주문/.test(raw) || /goi mon/.test(folded)
}

/**
 * true khi câu sửa nhảy sang lĩnh vực khác với chủ đề.
 * Dùng để bỏ cache replay cũ và viết lại câu, không thay prompt.
 */
export function topicSenseClash(input: TopicSenseFields): boolean {
  const blob = topicBlob(input)
  const student = foldCoachText(input.studentText || '')
  const candidate = String(input.candidateText || '')
  if (!blob || !student || !candidate.trim()) return false

  const drinkOrFood = DRINK_TOPIC.test(blob) || FOOD_TOPIC.test(blob)
  const countryTopic = COUNTRY_TOPIC.test(blob) && !drinkOrFood
  const phoneTopic = PHONE_TOPIC.test(blob) && !drinkOrFood

  if (mentionsNuoc(student) && !nuocIsOriginQuestion(student)) {
    if (drinkOrFood && hasCountrySense(candidate) && !hasDrinkSense(candidate)) return true
    if (countryTopic && hasDrinkSense(candidate) && !hasCountrySense(candidate)) return true
  }

  if (mentionsGoi(student)) {
    if (drinkOrFood && !goiIsPhone(student) && hasPhoneSense(candidate) && !hasFoodOrderSense(candidate)) return true
    if (phoneTopic && !goiIsOrder(student) && hasFoodOrderSense(candidate) && !hasPhoneSense(candidate)) return true
  }

  return false
}
