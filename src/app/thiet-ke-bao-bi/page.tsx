import Image from 'next/image'
import Link from 'next/link'
import { Metadata } from 'next'
import { JsonLd } from '@/components/seo-json-ld'
import { CreationToolPageShell } from '@/components/layout/creation-tool-page-shell'
import { Button } from '@/components/ui/button'
import { FeatureSeoSection } from '@/components/feature-seo-section'
import { getFeatureSeo, buildFeatureFaqJsonLd } from '@/lib/feature-seo'
import { hubStudioLaunchHref } from '@/lib/hub-chat/hub-studio-launch'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { buildJsonLdService, buildMetadata, SITE_URL } from '@/lib/seo'
import { ThietKeBaoBiArticleMockup3D } from './thiet-ke-bao-bi-article-mockup'

const seo = getFeatureSeo('thiet-ke-bao-bi')
const OG_IMAGE_PATH = '/og/thiet-ke-bao-bi-1200x630.png'
const ARTICLE_IMAGE_PATH = '/og/thiet-ke-bao-bi.png'
const DIELINE_IMAGE_PATH = '/og/thiet-ke-bao-bi-dieline.jpg'
const ogImageUrl = `${SITE_URL}${OG_IMAGE_PATH}`
const articleImageUrl = `${SITE_URL}${ARTICLE_IMAGE_PATH}`
const dielineImageUrl = `${SITE_URL}${DIELINE_IMAGE_PATH}`
const pageUrl = `${SITE_URL}${seo.path}`
const studioHref = hubStudioLaunchHref('packaging_kit')

export const metadata: Metadata = buildMetadata({
  title: seo.pageTitle,
  description: seo.pageDescription,
  path: seo.path,
  keywords: seo.keywords,
  ogImage: ogImageUrl,
})

export default function ThietKeBaoBiPage() {
  const locale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) =>
    locale === 'en' ? en : locale === 'zh' ? zh : locale === 'ja' ? ja : locale === 'ko' ? ko : vi

  const mockupAlt = tr(
    'Mockup hộp giấy 3D serum Vitamin C + B5 NanoAI Cosmetics — thiết kế bao bì AI',
    '3D paper box mockup for Vitamin C + B5 serum by NanoAI Cosmetics — AI packaging design',
    'NANOAI COSMETICS 维生素 C + B5 精华纸盒 3D 效果图 — AI 包装设计',
    'NANOAI COSMETICS ビタミンC+B5セラム紙箱の3Dモックアップ — AIパッケージデザイン',
    'NANOAI COSMETICS 비타민 C + B5 세럼 종이 상자 3D 목업 — AI 패키징 디자인',
  )
  const dielineAlt = tr(
    'Dieline hộp giấy serum Vitamin C + B5: 6 mặt in, tai dán, thành phần, công dụng và mã vạch',
    'Paper box dieline for Vitamin C + B5 serum: 6 printed faces, glue flaps, ingredients, benefits and barcode',
    '维生素 C + B5 精华纸盒刀版：6 个印刷面、粘口、成分、功效与条码',
    'ビタミンC+B5セラム紙箱のダイライン：6面、糊しろ、成分、効能、バーコード',
    '비타민 C + B5 세럼 종이 상자 다이라인: 6면, 접착 날개, 성분, 효능, 바코드',
  )

  const jsonLd = {
    ...buildJsonLdService(seo.serviceName, seo.serviceDescription, pageUrl),
    image: [ogImageUrl, articleImageUrl, dielineImageUrl],
    areaServed: 'VN',
  }
  const faqJsonLd = buildFeatureFaqJsonLd(seo)
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: tr(
      'Cách thiết kế hộp giấy bằng AI trên NanoAI',
      'How to design a paper box with AI on NanoAI',
      '如何在 NanoAI 用 AI 设计纸盒',
      'NanoAIでAI紙箱をデザインする方法',
      'NanoAI에서 AI로 종이 상자를 디자인하는 방법',
    ),
    description: seo.pageDescription,
    image: ogImageUrl,
    totalTime: 'PT15M',
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: tr('Nhập brief', 'Enter the brief', '填写简报', 'ブリーフを入力', '브리프 입력'),
        text: tr(
          'Nhập thương hiệu, tên sản phẩm, kích thước D×R×C mm và phong cách in.',
          'Enter brand, product name, L×W×H mm size and print style.',
          '输入品牌、产品名、长×宽×高毫米尺寸和印刷风格。',
          'ブランド、製品名、D×W×H mmサイズ、印刷スタイルを入力します。',
          '브랜드, 제품명, 가로×세로×높이 mm 치수와 인쇄 스타일을 입력합니다.',
        ),
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: tr('Tạo 6 mặt hộp', 'Generate 6 box faces', '生成 6 个盒面', '箱の6面を生成', '상자 6면 생성'),
        text: tr(
          'AI vẽ từng mặt (trên, trước, phải, dưới, sau, trái) cùng một bộ nhận diện.',
          'AI draws each face (top, front, right, bottom, back, left) in one visual system.',
          'AI 按同一套识别系统绘制每个面（顶、前、右、底、后、左）。',
          'AIが同一の世界観で各面（上・前・右・底・後・左）を描きます。',
          'AI가 하나의 아이덴티티로 각 면(위, 앞, 오른쪽, 아래, 뒤, 왼쪽)을 그립니다.',
        ),
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: tr('Xem mockup 3D', 'Review the 3D mockup', '查看 3D 效果图', '3Dモックアップを確認', '3D 목업 확인'),
        text: tr(
          'Kéo xoay hộp 3D để kiểm tra chữ, ảnh sản phẩm và màu trên mọi mặt.',
          'Drag to rotate the 3D box and check type, product photos and color on every face.',
          '拖动旋转 3D 盒，检查每一面的文字、产品图和颜色。',
          '3D箱を回転して文字・商品写真・色を全面で確認します。',
          '3D 상자를 회전해 모든 면의 문구, 제품 사진, 색을 확인합니다.',
        ),
      },
      {
        '@type': 'HowToStep',
        position: 4,
        name: tr('Xuất dieline PDF', 'Export the dieline PDF', '导出刀版 PDF', 'ダイラインPDFを書き出す', '다이라인 PDF 내보내기'),
        text: tr(
          'Tải net triển khai theo mm, có tai dán và đường cắt/gấp, gửi xưởng in hộp giấy nắp gài.',
          'Download the millimetre-accurate net with glue flaps and cut/fold lines for the printer.',
          '下载毫米精度的展开图（含粘口和模切/压痕线）交给纸盒工厂。',
          '糊しろとカット/折り線付きのmm精度ネットを書き出し、印刷所へ渡します。',
          '접착 날개와 재단/접힘선이 있는 mm 단위 전개도를 받아 인쇄소에 보냅니다.',
        ),
      },
    ],
  }

  const cta = (
    <Button asChild className="mt-5">
      <Link href={studioHref}>
        {tr('Bắt đầu thiết kế hộp giấy', 'Start paper box design', '开始设计纸盒', '紙箱デザインを開始', '종이 상자 디자인 시작')}
      </Link>
    </Button>
  )

  return (
    <div className="app-shell">
      <JsonLd data={jsonLd} />
      <JsonLd data={faqJsonLd} />
      <JsonLd data={howToJsonLd} />
      <CreationToolPageShell currentHref={seo.path}>
        <article className="mx-auto max-w-3xl rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm ring-1 ring-amber-100 sm:p-8">
          <p className="text-sm font-medium text-amber-700">
            {tr('Thiết kế hộp giấy AI', 'AI paper box design', 'AI 纸盒设计', 'AI紙箱デザイン', 'AI 종이 상자 디자인')}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 md:text-3xl">{seo.pageTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{seo.overview}</p>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            {tr('Mockup 3D hộp giấy — kéo để xoay', '3D paper box mockup — drag to rotate', '纸盒 3D 效果图 — 拖动旋转', '紙箱3Dモックアップ — ドラッグして回転', '종이 상자 3D 목업 — 드래그하여 회전')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {tr(
              'Hộp mẫu 400×200×200 mm: mặt trước sản phẩm, mặt hông slogan, mặt sau công dụng. Kéo để xem đủ 6 mặt in trước khi đặt xưởng.',
              'Sample box 400×200×200 mm: front product panel, side slogan, back benefits. Drag to inspect all 6 printed faces before production.',
              '样品盒 400×200×200 mm：正面产品、侧面口号、背面功效。拖动查看全部 6 个印刷面后再下单。',
              'サンプル箱 400×200×200 mm。表面・側面スローガン・裏面の効能を回転して確認してから発注します。',
              '샘플 상자 400×200×200 mm. 앞면, 옆 슬로건, 뒷면 효능을 회전해 본 뒤 발주하세요.',
            )}
          </p>
          <ThietKeBaoBiArticleMockup3D
            locale={locale}
            caption={tr(
              'Mockup 3D HTML hộp giấy 400×200×200 mm — kéo xoay, tạm dừng hoặc xem full màn hình.',
              'HTML 3D mockup of a 400×200×200 mm paper box — drag, pause, or open full screen.',
              '400×200×200 mm 纸盒 HTML 3D 效果图 — 可拖动、暂停或全屏。',
              '400×200×200 mm紙箱のHTML 3Dモック — ドラッグ、一時停止、全画面表示。',
              '400×200×200 mm 종이 상자 HTML 3D 목업 — 드래그, 일시정지, 전체 화면.',
            )}
          />

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            {tr('Ảnh hộp dựng 3D (mẫu mỹ phẩm)', 'Finished 3D box photo (cosmetics sample)', '完成后的 3D 盒效果图（化妆品样例）', '完成した3D箱写真（化粧品サンプル）', '완성된 3D 상자 사진 (화장품 샘플)')}
          </h2>
          <figure className="mt-3 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-amber-100/80">
            <Image
              src={ARTICLE_IMAGE_PATH}
              alt={mockupAlt}
              width={823}
              height={661}
              className="h-auto w-full"
              priority
            />
            <figcaption className="px-3 py-2 text-center text-xs leading-5 text-slate-500">
              {tr(
                'Hộp giấy NANOAI COSMETICS — Vitamin C + B5 Brightening & Repair Serum, 30 ml.',
                'NANOAI COSMETICS paper box — Vitamin C + B5 Brightening & Repair Serum, 30 ml.',
                'NANOAI COSMETICS 纸盒 — Vitamin C + B5 美白修护精华，30 ml。',
                'NANOAI COSMETICS紙箱 — Vitamin C + B5ブライトニング＆リペアセラム 30 ml。',
                'NANOAI COSMETICS 종이 상자 — Vitamin C + B5 브라이트닝 & 리페어 세럼, 30 ml.',
              )}
            </figcaption>
          </figure>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            {tr('Bản dieline / net triển khai hộp giấy', 'Paper box dieline / unfolded net', '纸盒刀版 / 展开图', '紙箱ダイライン / 展開図', '종이 상자 다이라인 / 전개도')}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {tr(
              'Net trải phẳng đủ 6 mặt, tai dán và đường cắt (nét đỏ). Có chỗ cho thành phần, công dụng, hướng dẫn dùng, bảo quản và mã vạch — đúng file xưởng cần để bế hộp nắp gài.',
              'The flat net shows all 6 faces, glue flaps and cut lines (red). It includes ingredients, benefits, usage, storage and barcode — the file a factory needs to die-cut a tuck-end box.',
              '展开图含 6 个面、粘口和红色模切线，并预留成分、功效、用法、储存与条码，供工厂模切插舌纸盒。',
              '展開図には6面・糊しろ・赤いカット線、成分・効能・使い方・保管・バーコードがあり、差込箱の型抜きに使います。',
              '전개도에 6면, 접착 날개, 빨간 재단선과 성분·효능·사용법·보관·바코드가 있어 끼움형 상자 톰슨에 사용합니다.',
            )}
          </p>
          <figure className="mt-3 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-amber-100/80">
            <Image
              src={DIELINE_IMAGE_PATH}
              alt={dielineAlt}
              width={1024}
              height={543}
              className="h-auto w-full"
            />
            <figcaption className="px-3 py-2 text-center text-xs leading-5 text-slate-500">
              {tr(
                'Dieline hộp giấy nắp gài: mặt in, tai dán, thành phần / INGREDIENTS, công dụng và mã vạch.',
                'Tuck-end paper box dieline: print panels, glue flaps, ingredients, benefits and barcode.',
                '插舌纸盒刀版：印刷面、粘口、成分、功效与条码。',
                '差込紙箱のダイライン：印刷面、糊しろ、成分、効能、バーコード。',
                '끼움형 종이 상자 다이라인: 인쇄면, 접착 날개, 성분, 효능, 바코드.',
              )}
            </figcaption>
          </figure>

          <h2 className="mt-8 text-lg font-semibold text-slate-900">
            {tr('Cách thiết kế hộp giấy trên NanoAI', 'How to design a paper box on NanoAI', '如何在 NanoAI 设计纸盒', 'NanoAIで紙箱をデザインする', 'NanoAI에서 종이 상자 디자인하기')}
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>
              {tr(
                'Nhập thương hiệu, sản phẩm, kích thước mm và phong cách in.',
                'Enter brand, product, millimetre size and print style.',
                '输入品牌、产品、毫米尺寸和印刷风格。',
                'ブランド、製品、mmサイズ、印刷スタイルを入力。',
                '브랜드, 제품, mm 치수, 인쇄 스타일을 입력합니다.',
              )}
            </li>
            <li>
              {tr(
                'AI tạo 6 mặt hộp cùng một bộ nhận diện (logo, màu, bố cục).',
                'AI generates 6 faces in one identity (logo, color, layout).',
                'AI 按同一套识别（标志、颜色、版式）生成 6 个面。',
                'AIが同一のロゴ・色・レイアウトで6面を生成。',
                'AI가 하나의 로고·색·레이아웃으로 6면을 생성합니다.',
              )}
            </li>
            <li>
              {tr(
                'Xem mockup 3D, kéo xoay kiểm tra chữ và ảnh trên mọi mặt.',
                'Open the 3D mockup and rotate to check type and photos on every face.',
                '打开 3D 效果图并旋转，检查每一面的文字和图片。',
                '3Dモックを回転し、全面の文字と写真を確認。',
                '3D 목업을 회전해 모든 면의 문구와 사진을 확인합니다.',
              )}
            </li>
            <li>
              {tr(
                'Xuất dieline PDF theo mm, gửi xưởng bế hộp giấy nắp gài.',
                'Export the millimetre dieline PDF and send it to the tuck-end box factory.',
                '导出毫米刀版 PDF，交给插舌纸盒工厂。',
                'mm精度のダイラインPDFを書き出し、差込箱の工場へ。',
                'mm 단위 다이라인 PDF를 보내 끼움형 상자 공장에 전달합니다.',
              )}
            </li>
          </ol>
          {cta}

          <p className="mt-6 text-sm leading-6 text-slate-600">
            {tr(
              'Cùng bộ đóng gói, bạn có thể làm thêm nhãn sản phẩm, tem niêm phong và mã vạch / QR.',
              'In the same packaging kit you can also make product labels, seal stickers and barcode / QR.',
              '同一套包装流程还可制作产品标签、封口贴和条码 / 二维码。',
              '同じ梱包フローで製品ラベル、封印シール、バーコード / QRも作成できます。',
              '같은 패키징 흐름에서 제품 라벨, 봉인 스티커, 바코드 / QR도 만들 수 있습니다.',
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/tao-nhan-gioi-thieu-san-pham"
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-amber-400"
            >
              {tr('Nhãn sản phẩm', 'Product label', '产品标签', '製品ラベル', '제품 라벨')}
            </Link>
            <Link
              href="/tao-tem-niem-phong-bao-hanh"
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-amber-400"
            >
              {tr('Tem niêm phong', 'Seal sticker', '封口贴', '封印シール', '봉인 스티커')}
            </Link>
            <Link
              href="/tao-ma-vach"
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-amber-400"
            >
              {tr('Mã vạch & QR', 'Barcode & QR', '条码和二维码', 'バーコードとQR', '바코드 & QR')}
            </Link>
          </div>
        </article>
      </CreationToolPageShell>
      <FeatureSeoSection seo={seo} />
    </div>
  )
}
