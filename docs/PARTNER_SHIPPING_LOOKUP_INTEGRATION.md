# Cổng API tra cứu vận chuyển — hướng dẫn tích hợp web shop

NanoAI gọi API này **server-to-server** khi khách chat gửi mã đơn, số điện thoại hoặc mã vận đơn. Web shop triển khai một endpoint; chủ shop dán URL + API key tại **Messaging → Cài đặt AI**.

Tham chiếu triển khai: `https://188.com.vn/api/v1/shipping/lookup`.

Không đưa API key vào frontend public. Không log key. SĐT chỉ đi kênh server.

## 1. Endpoint

Shop tự chọn path (khuyến nghị giữ `/api/v1/shipping/lookup`).

```
GET  https://YOUR-SHOP.com/api/v1/shipping/lookup
POST https://YOUR-SHOP.com/api/v1/shipping/lookup
```

Local ví dụ: `http://localhost:8001/api/v1/shipping/lookup` (NanoAI chỉ cho phép localhost khi `NODE_ENV=development`).

Production: bắt buộc **HTTPS công khai** (không RFC1918).

## 2. Xác thực

Bắt buộc. Không có key → HTTP 503. Sai key → HTTP 401.

Header (chọn một):

```
X-Api-Key: YOUR_SHIPPING_LOOKUP_API_KEY
```

hoặc

```
Authorization: Bearer YOUR_SHIPPING_LOOKUP_API_KEY
```

Nhiều đối tác: cách nhau bằng dấu phẩy trên phía shop. Để trống = tắt API.

## 3. Đầu vào — một endpoint, ba cách gọi

Ưu tiên trường tường minh (nếu gửi cùng lúc): `ems_code` > `order_code` > `phone` > `q`.

| Đầu vào | Hành vi |
|---|---|
| Mã đơn web (`DH042`, `DC009`) | Chi tiết đơn + mã vận + timeline shop + EMS (nếu có) |
| Số điện thoại khách | Đơn **gần nhất** (`created_at`) của SĐT đó, kèm vận chuyển |
| Mã EMS (`EH042737692VN`) | Tra live hãng vận: toàn bộ mốc + chi tiết đơn shop nếu đã ghép |

### GET

```
GET /api/v1/shipping/lookup?q=DH042
GET /api/v1/shipping/lookup?q=0901234567
GET /api/v1/shipping/lookup?q=EH042737692VN
GET /api/v1/shipping/lookup?order_code=DH042
GET /api/v1/shipping/lookup?phone=0901234567
GET /api/v1/shipping/lookup?ems_code=EH042737692VN
```

### POST JSON

```json
{ "q": "DH042" }
```

```json
{ "phone": "0901234567" }
```

```json
{ "ems_code": "EH042737692VN" }
```

`q` tự nhận diện:

- `DHxxx` / `DCxxx` → mã đơn web
- `09…` / `84…` / `+84…` → SĐT (đơn gần nhất)
- mã kết thúc `VN` (vd. EMS) → tra live + đơn

SĐT chuẩn hoá: `0901234567`, `84901234567`, `+84 901 234 567` cùng một khách.

## 4. Ví dụ curl

```bash
curl -sS -H "X-Api-Key: YOUR_KEY" \
  "https://YOUR-SHOP.com/api/v1/shipping/lookup?q=DH042"

curl -sS -H "X-Api-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234567"}' \
  "https://YOUR-SHOP.com/api/v1/shipping/lookup"

curl -sS -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ems_code":"EH042737692VN"}' \
  "https://YOUR-SHOP.com/api/v1/shipping/lookup"
```

## 5. Phản hồi thành công (HTTP 200)

`ok: true`. Các khối luôn có mặt; khối không có dữ liệu = `null` / `[]`.

Trường chatbot dùng ngay:

| Trường | Ý nghĩa |
|---|---|
| `query_type` | `order_code` / `phone` / `ems_code` |
| `is_latest_order` | `true` khi tra bằng SĐT (đơn mới nhất) |
| `tracking_number` | Mã vận đơn (ưu tiên EMS) |
| `order.status` + `order.status_label` | Trạng thái đơn shop |
| `order.items` | Sản phẩm, size, màu, giá |
| `ems_tracking.current_status_description` | Trạng thái hãng vận hiện tại |
| `ems_tracking.events` | Toàn bộ mốc, **mới nhất trước** |
| `shop_timeline.events` | Bước nội bộ shop (cọc → TQ → hải quan → nội địa) |

Ưu tiên hiển thị: `ems_tracking.current_status_description` → `ems_tracking.events` → `order.status_label`.

Khi tra mã EMS: luôn gọi live hãng vận. Nếu chưa ghép đơn shop, `order` có thể `null` nhưng `ems_tracking` vẫn đủ hành trình.

Khi tra SĐT: **chỉ một đơn** — đơn tạo gần nhất của số đó.

NanoAI **không** nhắc lại SĐT / địa chỉ khách trong chat.

Ví dụ rút gọn:

```json
{
  "ok": true,
  "query": "DH042",
  "query_type": "order_code",
  "is_latest_order": false,
  "tracking_number": "EH042737692VN",
  "shipping_provider": "EMS",
  "order": {
    "order_code": "DH042",
    "status": "shipping",
    "status_label": "Đang giao hàng",
    "items": [
      {
        "product_name": "Áo thun",
        "product_sku": "C0156/XL",
        "selected_size": "XL",
        "selected_color_name": "Đen",
        "quantity": 2
      }
    ]
  },
  "shop_timeline": { "current_step_key": "domestic_shipping", "events": [] },
  "ems_record": {
    "ems_tracking_code": "EH042737692VN",
    "ems_phase": "out_for_delivery",
    "ems_phase_label": "Đang giao bưu tá"
  },
  "ems_tracking": {
    "available": true,
    "current_status_description": "Giao bưu tá phát hàng",
    "events": [
      {
        "description": "Giao bưu tá phát hàng",
        "address": "Hà Nội",
        "traced_at": "2026-08-12T08:10:00"
      }
    ]
  }
}
```

## 6. Lỗi

| HTTP | Khi nào |
|---|---|
| 400 | Thiếu `q` / `order_code` / `phone` / `ems_code` |
| 401 | Sai hoặc thiếu API key |
| 404 | Không tìm thấy đơn / SĐT / vận đơn |
| 429 | Vượt rate limit IP |
| 503 | API chưa bật |

Ví dụ 404: `{ "detail": "Không tìm thấy đơn hàng DH999." }`

Smoke test (sau khi bật): HTTP **200** (có đơn) hoặc **404** (không có đơn) = API đã bật. **401** = sai key. **503** = chưa nạp env.

## 7. Trạng thái đơn shop (`order.status`)

| status | status_label |
|---|---|
| pending | Chờ xác nhận |
| waiting_deposit | Chờ đặt cọc |
| deposit_paid | Đã đặt cọc |
| confirmed | Đã xác nhận |
| processing | Đang xử lý |
| shipping | Đang giao hàng |
| delivered | Đã nhận hàng |
| completed | Đã đánh giá |
| returned | Đơn hoàn đã trả shop |
| cancelled | Đã hủy |

## 8. Phase EMS đã cache (`ems_record.ems_phase`)

| ems_phase | ems_phase_label |
|---|---|
| posted | Đã chấp nhận gửi |
| in_transit | Đang vận chuyển |
| out_for_delivery | Đang giao bưu tá |
| delivered | Phát thành công |
| cod_collected | Đã thu COD |
| cod_settled | Đã đối soát COD |
| unknown | Chưa xác định |

`ems_record` là bản ghi shop đã import/đối soát. Hành trình realtime nằm ở `ems_tracking.events`.

## 9. NanoAI dùng dữ liệu thế nào

1. Shop điền URL + key tại Cài đặt AI (key không hiện lại).
2. Khách gửi ảnh mã đơn / tin «đơn DH349» / SĐT tra đơn → NanoAI `GET` với `X-Api-Key`.
3. Cache phía NanoAI khoảng 90 giây (shop cũng nên cache MyEMS ~120 giây).
4. Nếu lookup lỗi/404, chat vẫn trả lời theo OCR/ngữ cảnh (không bịa trạng thái).

Cấu hình UI: `/dashboard/messaging` → Cài đặt AI. Tài liệu trên dashboard: `/dashboard/api-integration#shipping-lookup`.
