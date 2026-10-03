# Hợp đồng `image_consult_context` — web khách → NanoAI

Mỗi sản phẩm trong `GET /api/v1/products` (và incremental `updated_since`) có thể thêm một field. NanoAI ghi vào cột `messaging_partner_inventory.image_consult_context`. Cột này chỉ đưa vào prompt tư vấn đúng một SKU. Không hiện trên web, không vào tìm kiếm, không embed.

Đường dẫn mặc định trên bảng map: `image_consult_context`. Không nhét vào `product_info` / `consult_note`.

## Khi nào gửi

- Có chữ thông số sản phẩm đọc từ ảnh (chất liệu, size, cách chọn size, cách dùng, công suất, điện áp, dung tích, kích thước, phụ kiện, thành phần).
- Không có chữ thì **bỏ hẳn field** hoặc gửi `null`. NanoAI giữ nguyên cột đang có (kể cả chữ đã lưu lúc bản địa hóa trên NanoAI).
- Gửi `{ "lines": [] }` cũng không xóa cột cũ.

## JSON trên từng product

Web khách giữ chữ ở cột riêng (`consult_image_text`). API xuất ra field JSON `image_consult_context` ở gốc sản phẩm. NanoAI không đọc tên cột đó.

Khi object có cả `lines` và `images`, NanoAI lưu `images` (có URL ảnh). `lines` là bản phẳng cùng nội dung, không bị ghi thêm một lần nữa.

```json
{
  "product_id": "A976167321349a188b3630",
  "name": "Áo sơ mi nam",
  "image_consult_context": {
    "language": "vi",
    "lines": [
      { "src": "胸围88cm", "vi": "Vòng ngực 88cm" }
    ],
    "images": [
      {
        "url": "https://cdn.shop/size-chart.jpg",
        "lines": [
          { "src": "胸围88cm", "vi": "Vòng ngực 88cm" }
        ]
      }
    ]
  }
}
```

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `language` | Không | Mã ngôn ngữ của `vi`. Mặc định `vi`. Tối đa 12 ký tự. |
| `lines` | Có, nếu dùng dạng phẳng | Tối đa 40 dòng. Mỗi dòng tối đa 200 ký tự. Cả object sau khi NanoAI lọc phải dưới ~6000 ký tự. |
| `lines[].src` | Có | Chữ gốc trên ảnh. Số đo lấy từ đây. |
| `lines[].vi` | Không | Bản dịch sang ngôn ngữ shop. Trống thì NanoAI dùng `src` khi `src` không còn chữ Hán. |

`src` và `vi` là string. Không gửi HTML.

## Dạng đủ ảnh (tùy chọn)

Nếu web khách đã tách theo ảnh, gửi đúng shape NanoAI lưu. `url` là URL ảnh chữ được đọc ra.

```json
{
  "language": "vi",
  "captured_at": "2026-10-03T02:00:00Z",
  "images": [
    {
      "url": "https://cdn.shop/size-chart.jpg",
      "lines": [
        { "src": "胸围 88cm", "vi": "Vòng ngực 88cm" }
      ]
    }
  ]
}
```

`retained: true` chỉ khi ảnh đã gỡ khỏi gallery nhưng chữ bảng size vẫn phải giữ. Web khách thường không cần cờ này.

## Không gửi

Bỏ các dòng không phải thông số sản phẩm. NanoAI lọc lại lần nữa, nhưng web khách không nên đưa vào:

- Xưởng, địa chỉ sản xuất, xuất xứ nhà máy
- WeChat, số điện thoại, URL
- Giá in trên ảnh, giá sỉ, khuyến mãi
- Khẩu hiệu bán hàng

Một dòng vừa có số đo vừa có chữ xưởng: giữ phần số đo (`胸围 88cm 实力工厂` → `胸围 88cm`).

## Đồng bộ phía NanoAI

- Sản phẩm mới: ghi cột lúc insert.
- Sản phẩm đã có `product_id`: lần incremental sau vẫn cập nhật **riêng cột này** khi field có ít nhất một dòng hợp lệ. Các cột tên, giá, tồn kho không bị ghi đè.
- Field vắng hoặc không còn dòng hợp lệ: không đụng cột.
