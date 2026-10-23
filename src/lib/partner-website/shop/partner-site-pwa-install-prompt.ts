import type { WebLocale } from '@/lib/i18n/config'

export type PwaInstallPromptCopy = {
  title: string
  lead: string
  leadNamed: string
  install: string
  later: string
  close: string
  iosTip: string
  manualTip: string
  failed: string
}

export const PWA_INSTALL_PROMPT_COPY: Record<WebLocale, PwaInstallPromptCopy> = {
  vi: {
    title: 'Cài web app',
    lead: 'Thêm cửa hàng vào màn hình chính để mở nhanh như một ứng dụng.',
    leadNamed: 'Thêm {shop} vào màn hình chính để mở nhanh như một ứng dụng.',
    install: 'Cài đặt',
    later: 'Để sau',
    close: 'Đóng',
    iosTip: 'Trên iPhone/iPad: chạm Share rồi chọn «Thêm vào Màn hình chính».',
    manualTip: 'Mở menu trình duyệt và chọn «Cài đặt ứng dụng» hoặc «Thêm vào màn hình chính».',
    failed: 'Không cài được ứng dụng. Thử lại từ menu trình duyệt, hoặc tải lại trang rồi bấm Cài đặt.',
  },
  en: {
    title: 'Install the web app',
    lead: 'Add this shop to your home screen so it opens like an app.',
    leadNamed: 'Add {shop} to your home screen so it opens like an app.',
    install: 'Install',
    later: 'Later',
    close: 'Close',
    iosTip: 'On iPhone/iPad: tap Share, then “Add to Home Screen”.',
    manualTip: 'Open the browser menu and choose “Install app” or “Add to Home Screen”.',
    failed: 'Could not install the app. Try again from the browser menu, or reload and tap Install.',
  },
  zh: {
    title: '安装网页应用',
    lead: '把店铺加到主屏幕，就能像应用一样打开。',
    leadNamed: '把 {shop} 加到主屏幕，就能像应用一样打开。',
    install: '安装',
    later: '以后再说',
    close: '关闭',
    iosTip: '在 iPhone/iPad：点分享，然后选「添加到主屏幕」。',
    manualTip: '打开浏览器菜单，选择「安装应用」或「添加到主屏幕」。',
    failed: '无法安装应用。请从浏览器菜单重试，或刷新页面后再点安装。',
  },
  ja: {
    title: 'ウェブアプリをインストール',
    lead: 'ホーム画面に追加すると、アプリのように開けます。',
    leadNamed: '{shop} をホーム画面に追加すると、アプリのように開けます。',
    install: 'インストール',
    later: 'あとで',
    close: '閉じる',
    iosTip: 'iPhone/iPad：共有をタップし、「ホーム画面に追加」を選びます。',
    manualTip: 'ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。',
    failed: 'インストールできませんでした。ブラウザのメニューから再試行するか、再読み込みしてインストールを押してください。',
  },
  ko: {
    title: '웹 앱 설치',
    lead: '홈 화면에 추가하면 앱처럼 바로 열 수 있습니다.',
    leadNamed: '{shop}을(를) 홈 화면에 추가하면 앱처럼 바로 열 수 있습니다.',
    install: '설치',
    later: '나중에',
    close: '닫기',
    iosTip: 'iPhone/iPad: 공유를 누른 다음 «홈 화면에 추가»를 선택하세요.',
    manualTip: '브라우저 메뉴에서 «앱 설치» 또는 «홈 화면에 추가»를 선택하세요.',
    failed: '앱을 설치하지 못했습니다. 브라우저 메뉴에서 다시 시도하거나, 새로고침 후 설치를 누르세요.',
  },
}

export function pwaInstallPromptLead(locale: WebLocale, shopTitle?: string | null): string {
  const copy = PWA_INSTALL_PROMPT_COPY[locale]
  const shop = String(shopTitle || '').trim()
  if (shop) return copy.leadNamed.replace(/\{shop\}/g, shop)
  return copy.lead
}

export type PwaInstallPromptOfferInput = {
  pending: boolean
  dismissed: boolean
  standalone: boolean
  loginPath: boolean
  editor: boolean
  authenticated: boolean
  rememberedInstalled: boolean
  nativePromptReady: boolean
  /** Ngày sinh / giỏ vừa thêm đang chiếm màn, hoặc phiên login chưa xử lý xong hộp đó. */
  blockedByOtherPrompt: boolean
}

/** Nhắc cài sau đăng nhập. Đã cài (standalone hoặc nhớ máy) thì im, trừ khi trình duyệt lại đưa được hộp cài. */
export function shouldOfferPartnerPwaInstallPrompt(input: PwaInstallPromptOfferInput): boolean {
  if (input.editor || input.loginPath || !input.authenticated) return false
  if (input.standalone || input.blockedByOtherPrompt) return false
  if (!input.pending || input.dismissed) return false
  if (input.rememberedInstalled && !input.nativePromptReady) return false
  return true
}

export function claimPartnerPwaInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false
  const win = window as Window & { __pwPwaInstallPromptClaimed?: boolean }
  if (win.__pwPwaInstallPromptClaimed) return false
  if (document.getElementById('pw-pwa-install-prompt')) return false
  win.__pwPwaInstallPromptClaimed = true
  return true
}

/**
 * Popup sau đăng nhập. z-index dưới hộp ngày sinh (100060) và trên giỏ đã thêm (100050)
 * chỉ khi hộp kia đã đóng — engine chờ chúng đóng rồi mới mở.
 */
export const PW_PWA_INSTALL_PROMPT_CSS = `
[data-pw-pwa-install-prompt]{position:fixed;inset:0;z-index:100058;display:flex;align-items:flex-end;justify-content:center;padding:0;box-sizing:border-box}
[data-pw-pwa-install-prompt][hidden],
[data-pw-pwa-install-tip][hidden],
[data-pw-pwa-install-error][hidden],
[data-pw-pwa-install-go][hidden]{display:none!important}
[data-pw-pwa-install-backdrop]{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,.45);border:0;padding:0;cursor:pointer}
[data-pw-pwa-install-card]{position:relative;z-index:1;width:100%;max-height:90vh;overflow:auto;border-radius:16px 16px 0 0;background:#fff;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);border:1px solid #f3f4f6;padding:16px;box-sizing:border-box}
[data-pw-pwa-install-title]{margin:0;font:700 18px/1.3 system-ui,sans-serif;color:#111827}
[data-pw-pwa-install-lead]{margin:4px 0 0;font:400 14px/1.45 system-ui,sans-serif;color:#4b5563}
[data-pw-pwa-install-tip],[data-pw-pwa-install-error]{margin:12px 0 0;font:400 14px/1.45 system-ui,sans-serif;color:#4b5563}
[data-pw-pwa-install-error]{color:#dc2626}
[data-pw-pwa-install-actions]{display:flex;flex-direction:column-reverse;gap:8px;padding-top:16px}
[data-pw-pwa-install-go],[data-pw-pwa-install-later]{width:100%;display:inline-flex;align-items:center;justify-content:center;padding:10px 12px;border-radius:8px;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer;box-sizing:border-box}
[data-pw-pwa-install-go]{background:var(--pw-buy);color:#fff;border:none}
[data-pw-pwa-install-go]:hover{filter:brightness(.92)}
[data-pw-pwa-install-later]{background:#fff;color:var(--pw-text,#1f2937);border:1px solid var(--pw-border,#e5e7eb)}
@media (min-width:640px){
  [data-pw-pwa-install-prompt]{align-items:center;padding:16px}
  [data-pw-pwa-install-card]{max-width:28rem;border-radius:16px;padding:20px}
  [data-pw-pwa-install-actions]{flex-direction:row}
  [data-pw-pwa-install-go],[data-pw-pwa-install-later]{flex:1}
}
`
