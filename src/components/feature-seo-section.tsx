import Link from 'next/link'
import type { FeatureSeoData } from '@/lib/feature-seo'
import { JsonLd } from '@/components/seo-json-ld'
import { SITE_URL } from '@/lib/seo'

interface FeatureSeoSectionProps {
  seo: FeatureSeoData
}

export function FeatureSeoSection({ seo }: FeatureSeoSectionProps) {
  const relatedTools = [
    { href: '/xoa-nen-png', label: 'Xóa nền PNG' },
    { href: '/thay-nen-san-pham', label: 'Thay nền sản phẩm' },
    { href: '/lam-dep-anh', label: 'Làm đẹp ảnh' },
    { href: '/tao-anh-the', label: 'Tạo ảnh thẻ' },
    { href: '/thu-do-online/1-nguoi', label: 'Thử đồ 1 người' },
    { href: '/tao-banner', label: 'Tạo banner' },
    { href: '/phuc-dung-anh', label: 'Phục dựng ảnh' },
    { href: '/dich-anh-tai-lieu', label: 'Dịch ảnh tài liệu' },
  ].filter((item) => item.href !== seo.path).slice(0, 6)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Trang chủ',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: seo.pageTitle,
        item: `${SITE_URL}${seo.path}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <nav aria-label="Breadcrumb" className="mx-auto mt-8 max-w-4xl text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              Trang chủ
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground font-medium">{seo.pageTitle}</li>
        </ol>
      </nav>

      <section className="mx-auto mt-10 max-w-4xl rounded-xl border bg-white/80 p-5 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{seo.h2}</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>{seo.overview}</p>
          <p>
            Công cụ trên trang này được tối ưu để giúp bạn xử lý nhanh, giao diện dễ dùng và kết quả có thể áp dụng ngay vào công việc thực tế.
            Dù bạn là chủ shop, marketer, freelancer hay người dùng cá nhân, bạn đều có thể rút ngắn thời gian thao tác mà vẫn giữ chất lượng
            hình ảnh ổn định.
          </p>
          <p>
            Những lợi ích nổi bật gồm: {seo.benefits[0]}; {seo.benefits[1]}; {seo.benefits[2]}. Nhờ đó, bạn không phải tốn quá nhiều công sức
            cho phần kỹ thuật mà vẫn có đầu ra phù hợp để đăng bán, chạy quảng cáo hoặc chia sẻ trên mạng xã hội.
          </p>
          <p>
            Một số tình huống sử dụng phổ biến: {seo.useCases[0]}; {seo.useCases[1]}; {seo.useCases[2]}. Đây là các kịch bản mang tính thực dụng
            cao, giúp đội nội dung và vận hành tăng tốc sản xuất hình ảnh trong ngày.
          </p>
          <p>
            Để kết quả tốt hơn, bạn nên lưu ý: {seo.tips[0]}; {seo.tips[1]}; {seo.tips[2]}. Chỉ cần chuẩn bị ảnh đầu vào gọn và rõ, chất lượng
            đầu ra sẽ ổn định hơn rõ rệt, đồng thời giảm thời gian phải xử lý lại nhiều lần.
          </p>
          <p>
            Nếu bạn đang cần một giải pháp nhanh, dễ áp dụng và có thể nhân rộng cho nhiều chiến dịch, đây là lựa chọn phù hợp để bắt đầu.
            Bạn có thể thử ngay trên ảnh thật của mình để đánh giá mức độ phù hợp với quy trình làm việc hiện tại.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-xl border bg-white/80 p-5 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Câu hỏi thường gặp</h2>
        <div className="mt-4 space-y-3">
          {seo.faqs.map((item) => (
            <details key={item.question} className="rounded-lg border bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-foreground">{item.question}</summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-xl border bg-white/80 p-5 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Công cụ liên quan</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {relatedTools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-lg border bg-white px-4 py-3 text-sm text-foreground hover:border-sky-300 hover:text-sky-700 transition-colors"
            >
              {tool.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

