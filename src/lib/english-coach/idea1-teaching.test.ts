import assert from 'node:assert/strict'
import test from 'node:test'
import { idea1Teaches } from './idea1-teaching'

const fluff = 'Nghĩa bạn gửi "Tôi muốn mua đồ ăn" là hoàn toàn chính xác. Để có thể gọi món dễ dàng hơn khi đi nhà hàng hay siêu thị, mình cùng học cách nói câu này bằng tiếng Hàn nhé!'

const taught = `Chú ý: -고 싶어요 = muốn làm gì. 사다 thành 사고 싶어요. 을 đi sau phụ âm.
Từ: 음식 = đồ ăn.
Ví dụ: 빵을 사고 싶어요 = muốn mua bánh mì. 책을 사고 싶어요 = muốn mua sách.`

const lecture = `Chú ý: Câu được hình thành với cấu trúc danh từ cộng trợ từ tân ngữ rồi động từ bỏ đuôi và thêm cấu trúc muốn, đuôi này thể hiện sự lịch sự thân mật khi nói với người phục vụ trong nhà hàng hoặc siêu thị.
Từ: 음식 = đồ ăn, là danh từ chỉ thức ăn nói chung, dùng khi gọi món, khi đi chợ và khi nói mình đang đói.
Ví dụ: 빵을 사고 싶어요 = muốn mua bánh mì khi đang đói. 책을 사고 싶어요 = muốn mua sách ở siêu thị vào ngày mai.`

test('lời khen không tính là ý 1 đã dạy', () => {
  assert.equal(idea1Teaches(fluff, 'vi'), false)
  assert.equal(idea1Teaches('Chú ý: Câu em nói đúng nghĩa và rất tự nhiên.\nTừ: 음식 = đồ ăn.\nVí dụ: 책을 사고 싶어요 = muốn mua sách.', 'vi'), false)
})

test('ý 1 ngắn đủ chú ý, từ và ví dụ', () => {
  assert.equal(idea1Teaches(taught, 'vi'), true)
})

test('bài giảng dài không được giữ', () => {
  assert.equal(idea1Teaches(lecture, 'vi'), false)
})

test('thiếu một phần thì chưa tính là đã dạy', () => {
  assert.equal(idea1Teaches(taught.replace('Ví dụ:', ''), 'vi'), false)
})

test('nhãn theo tiếng mẹ đẻ của học viên', () => {
  const english = 'Watch: want to. Word: food = đồ ăn. Example: buy bread.'
  assert.equal(idea1Teaches(english, 'en'), true)
  assert.equal(idea1Teaches(taught, 'en'), false)
})
