import Link from 'next/link'
import type { FeatureSeoData } from '@/lib/feature-seo'
import { JsonLd } from '@/components/seo-json-ld'
import { SITE_URL } from '@/lib/seo'
import { getCurrentWebLocale } from '@/lib/i18n/server'

interface FeatureSeoSectionProps {
  seo: FeatureSeoData
}

export function FeatureSeoSection({ seo }: FeatureSeoSectionProps) {
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi
  const relatedTools = [
    { href: '/xoa-nen-png', label: tr('Xóa nền PNG', 'Remove PNG background', '移除 PNG 背景', 'PNG背景削除', 'PNG 배경 제거') },
    { href: '/thay-nen-san-pham', label: tr('Thay nền sản phẩm', 'Replace product background', '替换商品背景', '商品背景置換', '상품 배경 교체') },
    { href: '/lam-dep-anh', label: tr('Làm đẹp ảnh', 'Beautify photo', '美化照片', '写真補正', '사진 보정') },
    { href: '/tao-anh-the', label: tr('Tạo ảnh thẻ', 'Create ID photo', '制作证件照', '証明写真作成', '증명사진 만들기') },
    { href: '/thu-do-online/1-nguoi', label: tr('Thử đồ 1 người', 'Try-on (1 person)', '单人试衣', '1人試着', '1인 가상피팅') },
    { href: '/tao-banner', label: tr('Tạo banner', 'Create banner', '创建横幅', 'バナー作成', '배너 만들기') },
    { href: '/phuc-dung-anh', label: tr('Phục dựng ảnh', 'Restore photo', '修复照片', '写真復元', '사진 복원') },
    { href: '/dich-anh-tai-lieu', label: tr('Dịch ảnh tài liệu', 'Translate document image', '文档图片翻译', '文書画像翻訳', '문서 이미지 번역') },
  ].filter((item) => item.href !== seo.path).slice(0, 6)

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: tr('Trang chủ', 'Home', '首页', 'ホーム', '홈'),
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
      <nav aria-label={tr('Breadcrumb', 'Breadcrumb', '面包屑', 'パンくず', '브레드크럼')} className="mx-auto mt-8 max-w-4xl text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              {tr('Trang chủ', 'Home', '首页', 'ホーム', '홈')}
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
            {tr('Công cụ trên NanoAI.vn được tối ưu để giúp bạn xử lý nhanh, giao diện dễ dùng và kết quả có thể áp dụng ngay vào công việc thực tế. Dù bạn là chủ shop, marketer, freelancer hay người dùng cá nhân, bạn đều có thể rút ngắn thời gian thao tác mà vẫn giữ chất lượng hình ảnh ổn định.', 'Tools on NanoAI.vn are optimized for speed, easy UI, and practical output. Whether you are a shop owner, marketer, freelancer, or personal user, you can reduce workflow time while maintaining stable image quality.', 'NanoAI.vn 的工具经过优化，可实现快速处理、易用界面和可直接落地的结果。无论你是店主、营销人员、自由职业者还是个人用户，都能缩短操作时间并保持稳定图像质量。', 'NanoAI.vnのツールは高速処理・使いやすいUI・実務で使える出力に最適化されています。ショップ運営者、マーケター、フリーランサー、個人ユーザーのいずれでも、画質を保ちながら作業時間を短縮できます。', 'NanoAI.vn 도구는 빠른 처리, 쉬운 UI, 실무 활용 결과에 최적화되어 있습니다. 쇼핑몰 운영자, 마케터, 프리랜서, 개인 사용자 모두 이미지 품질을 유지하면서 작업 시간을 줄일 수 있습니다.')}
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
            {tr('Nếu bạn đang cần một giải pháp nhanh, dễ áp dụng và có thể nhân rộng cho nhiều chiến dịch, đây là lựa chọn phù hợp để bắt đầu. Bạn có thể thử ngay trên ảnh thật của mình để đánh giá mức độ phù hợp với quy trình làm việc hiện tại.', 'If you need a fast, practical solution that can scale across campaigns, this is a great starting point. Try it on your real images to evaluate fit with your current workflow.', '如果你需要一个快速、易用且可扩展到多项目的方案，这是很好的起点。你可以直接用真实图片测试其与现有流程的适配度。', '高速で実用的、複数施策に展開しやすい解決策が必要なら、これは良い出発点です。実際の画像で試して現在の運用に合うか確認できます。', '빠르고 실용적이며 여러 캠페인에 확장 가능한 솔루션이 필요하다면 좋은 시작점입니다. 실제 이미지로 테스트해 현재 워크플로와의 적합성을 확인하세요.')}
          </p>
        </div>
      </section>

      <section className="mx-auto mt-6 max-w-4xl rounded-xl border bg-white/80 p-5 sm:p-7">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{tr('Câu hỏi thường gặp', 'Frequently asked questions', '常见问题', 'よくある質問', '자주 묻는 질문')}</h2>
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
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{tr('Công cụ liên quan', 'Related tools', '相关工具', '関連ツール', '관련 도구')}</h2>
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

