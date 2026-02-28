# i18n – Web đa ngôn ngữ

Dự án NanoAI là **web đa ngôn ngữ**. Mọi chuỗi hiển thị cho người dùng phải được dịch.

## Ngôn ngữ

| Phạm vi | Locales |
|--------|---------|
| Web UI | `vi`, `en`, `zh`, `ja`, `ko` |
| Học ngoại ngữ AI | `vi`, `en`, `zh`, `ja`, `ko`, `th`, `hi` |

**Lưu ý**: Ngôn ngữ mẹ đẻ (native language) **không cố định** – do người dùng chọn. Không giả định người dùng là người Việt; luôn dùng `nativeLanguageCode` từ state.

## Cách dùng

### Server Component
```tsx
import { getServerDictionary } from '@/lib/i18n/server'

const { locale, t } = await getServerDictionary()
return <span>{t.menu.dashboard}</span>
```

### Client Component
```tsx
import { getDictionary } from '@/lib/i18n/dictionaries'
import { getCurrentWebLocale } from '@/lib/i18n/server' // hoặc truyền locale từ props
```

### localText (UI động, nhiều ngôn ngữ)
```tsx
localText('Tiếng Việt', 'English')  // vi → tiếng Việt, còn lại → dịch từ en
```

### Metadata / SEO
```tsx
import { buildMetadata } from '@/lib/seo'
export const metadata = buildMetadata({ title: '...', path: '/...', ... })
```

## Thêm key mới

1. Thêm vào type `Dictionary` trong `dictionaries.ts`
2. Dịch đủ 5 ngôn ngữ: vi, en, zh, ja, ko

## Cursor Rule

File `.cursor/rules/multilingual-i18n.mdc` (alwaysApply) hướng dẫn AI luôn xử lý đúng chuẩn đa ngôn ngữ.
