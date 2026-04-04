import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { AdminIntegrationsClient } from './integrations-client'

export default function AdminIntegrationsPage() {
  const uiLocale = getCurrentWebLocale()
  const tr = (vi: string, en: string, zh: string, ja: string, ko: string) => {
    if (uiLocale === 'en') return en
    if (uiLocale === 'zh') return zh
    if (uiLocale === 'ja') return ja
    if (uiLocale === 'ko') return ko
    return vi
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const nanoaiEmbedCodeDefault = `<iframe src="${baseUrl.replace(/\/$/, '')}/messaging/p/nanoai-ws-wdh5?embed=1" title="Chat NanoAI" width="100%" height="560" style="border:0;border-radius:12px;max-width:100%" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild className="gap-1.5">
          <Link href="/admin">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {tr('Về trang quản trị', 'Back to admin', '返回管理页', '管理ページへ戻る', '관리로 돌아가기')}
          </Link>
        </Button>
      </div>

      <AdminIntegrationsClient
        title={tr('Tích hợp thẻ & mã nhúng', 'Tags & embed integrations', '标签与嵌入集成', 'タグ・埋め込み連携', '태그·임베드 연동')}
        description={tr(
          'Khu vực quản trị để cấu hình Google/Facebook và mã nhúng chat (NanoAI, Facebook, Zalo). Bạn có thể điền trực tiếp toàn bộ đoạn mã nhúng.',
          'Admin area to configure Google/Facebook tags and chat embed code (NanoAI, Facebook, Zalo). You can directly edit the full embed snippet.',
          '用于配置 Google/Facebook 标签及聊天嵌入代码（NanoAI、Facebook、Zalo）的管理区域。你可以直接编辑完整嵌入代码。',
          'Google/Facebook タグとチャット埋め込みコード（NanoAI / Facebook / Zalo）を設定する管理エリアです。埋め込みコード全体を直接編集できます。',
          'Google/Facebook 태그 및 채팅 임베드 코드(NanoAI/Facebook/Zalo)를 설정하는 관리자 영역입니다. 전체 임베드 코드를 직접 수정할 수 있습니다.'
        )}
        googleAnalyticsLabel={tr(
          'Google Analytics ID (GA4)',
          'Google Analytics ID (GA4)',
          'Google Analytics ID（GA4）',
          'Google Analytics ID（GA4）',
          'Google Analytics ID (GA4)'
        )}
        googleAnalyticsPlaceholder={tr(
          'Ví dụ: G-ABC123XYZ9',
          'Example: G-ABC123XYZ9',
          '例如：G-ABC123XYZ9',
          '例: G-ABC123XYZ9',
          '예: G-ABC123XYZ9'
        )}
        googleTagManagerLabel={tr(
          'Google Tag Manager Container ID',
          'Google Tag Manager Container ID',
          'Google Tag Manager 容器 ID',
          'Google Tag Manager コンテナ ID',
          'Google Tag Manager 컨테이너 ID'
        )}
        googleTagManagerPlaceholder={tr(
          'Ví dụ: GTM-XXXXXXX',
          'Example: GTM-XXXXXXX',
          '例如：GTM-XXXXXXX',
          '例: GTM-XXXXXXX',
          '예: GTM-XXXXXXX'
        )}
        facebookPixelLabel={tr('Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel', 'Facebook Pixel / Meta Pixel')}
        facebookPixelPlaceholder={tr(
          'Ví dụ: 123456789012345',
          'Example: 123456789012345',
          '例如：123456789012345',
          '例: 123456789012345',
          '예: 123456789012345'
        )}
        webConsoleVerificationLabel={tr(
          'Thẻ xác minh Google Search Console',
          'Google Search Console verification tag',
          'Google Search Console 验证标签',
          'Google Search Console 検証タグ',
          'Google Search Console 인증 태그'
        )}
        webConsoleVerificationPlaceholder={tr(
          'Dán meta tag xác minh, ví dụ: <meta name="google-site-verification" content="..." />',
          'Paste verification meta tag, e.g. <meta name="google-site-verification" content="..." />',
          '粘贴验证 meta 标签，例如：<meta name="google-site-verification" content="..." />',
          '検証用 meta タグを貼り付け（例: <meta name="google-site-verification" content="..." />）',
          '인증 메타 태그를 붙여 넣으세요. 예: <meta name="google-site-verification" content="..." />'
        )}
        domainVerificationTitle={tr(
          'Danh sách thẻ xác minh tên miền (thêm nhiều)',
          'Domain verification tags list (multiple)',
          '域名验证标签列表（可添加多个）',
          'ドメイン検証タグ一覧（複数追加可）',
          '도메인 인증 태그 목록(여러 개 추가)'
        )}
        domainVerificationNameLabel={tr('Tên dịch vụ', 'Service name', '服务名称', 'サービス名', '서비스 이름')}
        domainVerificationCodeLabel={tr('Mã xác minh', 'Verification code/tag', '验证代码/标签', '検証コード/タグ', '인증 코드/태그')}
        domainVerificationNamePlaceholder={tr(
          'Ví dụ: Zalo OA, Google Merchant Center',
          'Example: Zalo OA, Google Merchant Center',
          '例如：Zalo OA、Google Merchant Center',
          '例: Zalo OA、Google Merchant Center',
          '예: Zalo OA, Google Merchant Center'
        )}
        domainVerificationCodePlaceholder={tr(
          'Dán thẻ/meta/script xác minh tại đây…',
          'Paste verification tag/meta/script here…',
          '在此粘贴验证标签/meta/script…',
          '検証用タグ/meta/script をここに貼り付け…',
          '인증 태그/meta/script를 여기에 붙여 넣으세요…'
        )}
        addDomainVerificationButton={tr(
          'Thêm thẻ xác minh',
          'Add verification tag',
          '添加验证标签',
          '検証タグを追加',
          '인증 태그 추가'
        )}
        removeDomainVerificationButton={tr(
          'Xóa',
          'Remove',
          '删除',
          '削除',
          '삭제'
        )}
        nanoaiEmbedCodeLabel={tr('Mã nhúng chat NanoAI', 'NanoAI chat embed code', 'NanoAI 聊天嵌入代码', 'NanoAI チャット埋め込みコード', 'NanoAI 채팅 임베드 코드')}
        facebookChatEmbedCodeLabel={tr('Mã nhúng chat Facebook', 'Facebook chat embed code', 'Facebook 聊天嵌入代码', 'Facebook チャット埋め込みコード', 'Facebook 채팅 임베드 코드')}
        zaloChatEmbedCodeLabel={tr('Mã nhúng chat Zalo', 'Zalo chat embed code', 'Zalo 聊天嵌入代码', 'Zalo チャット埋め込みコード', 'Zalo 채팅 임베드 코드')}
        embedCodePlaceholder={tr(
          'Dán script/iframe/plugin code vào đây…',
          'Paste script/iframe/plugin code here…',
          '在此粘贴 script / iframe / 插件代码…',
          'script / iframe / プラグインコードをここに貼り付け…',
          'script / iframe / 플러그인 코드를 여기에 붙여 넣으세요…'
        )}
        copyNanoaiEmbedButton={tr('Sao chép mã chat NanoAI', 'Copy NanoAI chat code', '复制 NanoAI 聊天代码', 'NanoAI チャットコードをコピー', 'NanoAI 채팅 코드 복사')}
        copyFacebookChatEmbedButton={tr('Sao chép mã Facebook chat', 'Copy Facebook chat code', '复制 Facebook 聊天代码', 'Facebook チャットコードをコピー', 'Facebook 채팅 코드 복사')}
        copyZaloChatEmbedButton={tr('Sao chép mã Zalo chat', 'Copy Zalo chat code', '复制 Zalo 聊天代码', 'Zalo チャットコードをコピー', 'Zalo 채팅 코드 복사')}
        copiedToast={tr('Đã sao chép', 'Copied', '已复制', 'コピーしました', '복사됨')}
        nanoaiEmbedCodeDefault={nanoaiEmbedCodeDefault}
        saveButtonLabel={tr('Lưu cấu hình', 'Save configuration', '保存配置', '設定を保存', '설정 저장')}
        saveOkToast={tr('Đã lưu cấu hình tích hợp.', 'Integration configuration saved.', '集成配置已保存。', '連携設定を保存しました。', '연동 설정이 저장되었습니다.')}
        invalidGoogleAnalyticsToast={tr(
          'Google Analytics ID không hợp lệ. Đúng định dạng: G-XXXXXXXXXX',
          'Invalid Google Analytics ID. Expected format: G-XXXXXXXXXX',
          'Google Analytics ID 无效。正确格式：G-XXXXXXXXXX',
          'Google Analytics ID が無効です。形式: G-XXXXXXXXXX',
          'Google Analytics ID 형식이 올바르지 않습니다. 형식: G-XXXXXXXXXX'
        )}
        invalidGoogleTagManagerToast={tr(
          'Google Tag Manager ID không hợp lệ. Đúng định dạng: GTM-XXXXXXX',
          'Invalid Google Tag Manager ID. Expected format: GTM-XXXXXXX',
          'Google Tag Manager ID 无效。正确格式：GTM-XXXXXXX',
          'Google Tag Manager ID が無効です。形式: GTM-XXXXXXX',
          'Google Tag Manager ID 형식이 올바르지 않습니다. 형식: GTM-XXXXXXX'
        )}
      />
    </div>
  )
}

