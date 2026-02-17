# Cấu hình SEO chuẩn 10 điểm

## 10 điểm chuẩn SEO đã áp dụng

| # | Hạng mục | Mô tả | Trạng thái |
|---|----------|-------|------------|
| 1 | **Title** | Unique, 50-60 ký tự, format `{title} \| Virtual Try-On` | ✅ |
| 2 | **Meta description** | 150-160 ký tự, mô tả hấp dẫn | ✅ |
| 3 | **Keywords** | Từ khóa liên quan từng trang | ✅ |
| 4 | **Canonical URL** | URL chuẩn, tránh trùng nội dung | ✅ |
| 5 | **Open Graph** | Facebook/social sharing (type, locale, images) | ✅ |
| 6 | **Twitter Card** | summary_large_image | ✅ |
| 7 | **JSON-LD** | Schema.org (WebApplication, Service, Organization) | ✅ |
| 8 | **Robots** | index/noindex, googleBot | ✅ |
| 9 | **Metadata base** | Base URL từ env | ✅ |
| 10 | **Locale** | vi_VN | ✅ |

## Cấu trúc file

- `src/lib/seo.ts` – Hàm `buildMetadata()`, `buildJsonLdService()`, `buildJsonLdWebApplication()`, `buildJsonLdOrganization()`
- `src/lib/seo-config.ts` – Cấu hình SEO tập trung (tham khảo)
- `src/components/seo-json-ld.tsx` – Component render JSON-LD

## Trang đã cấu hình SEO

### Trang công khai (index)
- `/` – Trang chủ
- `/thu-do-online/*` – Thử đồ
- `/phuc-dung-anh`, `/lam-net-anh`, `/ghep-anh`, `/tao-banner`, `/tao-anh-the`
- `/thiet-ke-logo`, `/che-anh`, `/xoa-vat-the`, `/thay-nen-san-pham`
- `/tao-anh-3d`, `/tao-mo-hinh-3d-tu-anh`, `/thiet-ke-noi-ngoai-that`
- `/tao-anh-chain-dung`, `/mo-rong-khung-hinh`, `/hoan-doi-khuon-mat`
- `/ke-chuyen-bang-hinh-anh`, `/tao-nhan-gian`, `/dich-anh-tai-lieu`

### Trang noIndex (nội bộ)
- `/auth/login`, `/auth/auth-code-error`
- `/dashboard`, `/dashboard/*`
- `/admin/*`
- `/wallet`, `/test`
- `/dich-anh-tai-lieu/tien-trinh`

## Sitemap & Robots

- `sitemap.xml` – Chứa các trang công khai
- `robots.txt` – Disallow: /api/, /admin/, /dashboard/, /auth/, /wallet, /test

## Cách dùng

```tsx
import { Metadata } from 'next'
import { buildMetadata, buildJsonLdService, SITE_URL } from '@/lib/seo'
import { JsonLd } from '@/components/seo-json-ld'

export const metadata: Metadata = buildMetadata({
  title: 'Tên trang',
  description: 'Mô tả 150-160 ký tự.',
  path: '/duong-dan',
  keywords: ['từ khóa 1', 'từ khóa 2'],
  noIndex: false, // true cho trang nội bộ
})

// Trong component:
const jsonLd = buildJsonLdService('Tên dịch vụ', 'Mô tả', `${SITE_URL}/duong-dan`)
return <><JsonLd data={jsonLd} />{children}</>
```
