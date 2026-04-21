import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import dynamic from "next/dynamic";
import Script from "next/script";
import { loadAdminIntegrationsValueJsonByKey } from "@/lib/db/admin-integrations-settings-pg";
import { fetchMessagingPartnerBySlugFromPg } from "@/lib/db/messaging-partners-pg";
import { isPgConfigured } from "@/lib/db/pool";
import { headers } from "next/headers";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { DepositCreditProvider } from "@/components/deposit-credit-context";
import { buildMetadata, buildJsonLdWebApplication, buildJsonLdOrganization, SITE_URL, SITE_NAME } from "@/lib/seo";
import { JsonLd } from "@/components/seo-json-ld";
import { readLoginNextFromHeaders } from '@/lib/auth/app-request-headers'
import { getCurrentWebLocale, getServerDictionary } from '@/lib/i18n/server'
import { FloatingChatWidget } from '@/components/messaging/floating-chat-widget'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'

const AnalyticsTracker = dynamic(
  () => import("@/components/analytics/analytics-tracker").then((m) => m.AnalyticsTracker),
  { ssr: false }
);
const MobileBottomBar = dynamic(
  () => import("@/components/layout/mobile-bottom-bar").then((m) => m.MobileBottomBar),
  { ssr: false }
);
const InstallPrompt = dynamic(
  () => import("@/components/pwa/install-prompt").then((m) => m.InstallPrompt),
  { ssr: false }
);
const PushNotificationPrompt = dynamic(
  () => import("@/components/pwa/push-notification-prompt").then((m) => m.PushNotificationPrompt),
  { ssr: false }
);
const SwUpdateReload = dynamic(
  () => import("@/components/pwa/sw-update-reload").then((m) => m.SwUpdateReload),
  { ssr: false }
);
const ReferralCapture = dynamic(
  () => import("@/components/referral/referral-capture").then((m) => m.ReferralCapture),
  { ssr: false }
);
const ReferralClaimRunner = dynamic(
  () => import("@/components/referral/referral-claim-runner").then((m) => m.ReferralClaimRunner),
  { ssr: false }
);
const GA_MEASUREMENT_ID = "G-1KZ2PKX887";
const INTEGRATIONS_KEY = "admin_integrations_config";

type DomainVerificationTag = {
  name?: string;
  code?: string;
};

type AdminIntegrationsSettings = {
  googleTagId?: string;
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  facebookPixelId?: string;
  webConsoleVerificationTag?: string;
  domainVerificationTags?: DomainVerificationTag[];
  /** Mã nhúng chat (tên mới). */
  chatEmbedCode?: string;
  /** Alias cũ trong JSON đã lưu — vẫn đọc khi chưa migrate. */
  nanoaiEmbedCode?: string;
};

type MetaTagPayload = {
  name?: string;
  property?: string;
  content: string;
};

type IframeEmbedPayload = {
  src: string;
  title: string;
  loading?: "lazy" | "eager";
  referrerPolicy?: React.IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"];
};

async function loadAdminIntegrationsSettings(): Promise<AdminIntegrationsSettings> {
  if (!isPgConfigured()) return {};
  const fromPg = await loadAdminIntegrationsValueJsonByKey(INTEGRATIONS_KEY);
  if (fromPg != null && typeof fromPg === "object" && !Array.isArray(fromPg)) {
    return fromPg as AdminIntegrationsSettings;
  }
  return {};
}

function parseMetaTag(raw: string): MetaTagPayload | null {
  const source = raw.trim();
  if (!source) return null;

  const name = source.match(/name\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  const property = source.match(/property\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  const content = source.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  if (!content || (!name && !property)) return null;

  return { name, property, content };
}

function parseIframeEmbed(raw: string): IframeEmbedPayload | null {
  const source = raw.trim();
  if (!source) return null;
  const src = source.match(/src\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
  if (!src) return null;

  const title = source.match(/title\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() || "Chat widget";
  const loadingRaw = source.match(/loading\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  const referrerPolicy = source.match(/referrerpolicy\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();

  const loading = loadingRaw === "eager" ? "eager" : "lazy";
  return {
    src,
    title,
    loading,
    referrerPolicy: referrerPolicy as React.IframeHTMLAttributes<HTMLIFrameElement>["referrerPolicy"],
  };
}

function extractMessagingPartnerSlugFromChatUrl(chatUrl: string): string | null {
  try {
    const u = new URL(chatUrl);
    const m = u.pathname.match(/\/messaging\/p\/([^/]+)/);
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function normalizeShopName(title: string): string {
  const cleaned = title
    .replace(/^chat\s+/i, '')
    .replace(/\s+support\s+chat$/i, '')
    .trim()
  return cleaned || 'NanoAI'
}

function normalizeEmbedSrc(src: string, requestOrigin: string): string {
  try {
    const parsed = new URL(src);
    const isLocalHost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    if (isLocalHost && requestOrigin) {
      return `${requestOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return src;
  } catch {
    return src;
  }
}

/** Khi chưa có mã nhúng trong admin DB: dùng NEXT_PUBLIC_CHAT_WIDGET_EMBED hoặc NEXT_PUBLIC_CHAT_WIDGET_SLUG (slug phải tồn tại trong messaging partners, nếu không iframe báo 404). */
function envChatEmbedHtml(requestOrigin: string): string {
  const full = process.env.NEXT_PUBLIC_CHAT_WIDGET_EMBED?.trim();
  if (full) return full;
  const slug = process.env.NEXT_PUBLIC_CHAT_WIDGET_SLUG?.trim();
  if (!slug || !requestOrigin) return "";
  const u = `${requestOrigin.replace(/\/$/, "")}/messaging/p/${encodeURIComponent(slug)}?embed=1`;
  return `<iframe src="${u}" title="Chat" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  ...buildMetadata({
    title: "NanoAI - Sáng tạo không giới hạn cùng AI",
    description: "Trải nghiệm phòng thử đồ ảo với AI. Thử đồ 1-5 người, phục dựng ảnh, làm nét ảnh, ghép ảnh. Nhanh chóng, chính xác.",
    path: "/",
    keywords: ["NanoAI", "thử đồ online", "thử đồ ảo", "AI thử đồ", "phối đồ", "phục dựng ảnh", "làm nét ảnh", "ghép ảnh"],
  }),
  title: {
    default: "NanoAI - Sáng tạo không giới hạn cùng AI",
    template: "%s | NanoAI",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NanoAI",
  },
  formatDetection: {
    telephone: false,
    email: false,
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "NanoAI",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = headers();
  const forwardedProto = headerStore.get("x-forwarded-proto");
  const forwardedHost = headerStore.get("x-forwarded-host");
  const host = forwardedHost || headerStore.get("host") || "";
  const protocol = forwardedProto || (process.env.NODE_ENV === "development" ? "http" : "https");
  const requestOrigin = host ? `${protocol}://${host}` : "";
  const currentPathWithQuery = readLoginNextFromHeaders((name) => headerStore.get(name));
  const [currentPathname = ""] = currentPathWithQuery.split("?");
  const isMessagingGuestPage = currentPathname.startsWith("/messaging/p/");
  /** Trang chat khách: luôn layout tối giản (giống nhúng iframe) — tránh Header/thanh dưới + cuộn kép trên server. */
  const useMinimalEmbedLayout = isMessagingGuestPage;

  const settings = await loadAdminIntegrationsSettings();
  const locale = getCurrentWebLocale()
  const { t } = getServerDictionary()
  const webAppLd = buildJsonLdWebApplication(
    SITE_NAME,
    t.app.defaultDescription,
    SITE_URL
  );
  const orgLd = buildJsonLdOrganization();
  const legacyGoogleTag = String(settings.googleTagId || "").trim();
  const gaMeasurementId = String(settings.googleAnalyticsId || "").trim()
    || (legacyGoogleTag.startsWith("G-") ? legacyGoogleTag : "")
    || GA_MEASUREMENT_ID;
  const gtmContainerId = String(settings.googleTagManagerId || "").trim()
    || (legacyGoogleTag.startsWith("GTM-") ? legacyGoogleTag : "");
  const facebookPixelId = String(settings.facebookPixelId || '').trim()
  const metaTagCandidates = [
    String(settings.webConsoleVerificationTag || ""),
    ...((Array.isArray(settings.domainVerificationTags) ? settings.domainVerificationTags : [])
      .map((item) => String(item?.code || ""))),
  ];
  const metaTags = metaTagCandidates.map(parseMetaTag).filter((item): item is MetaTagPayload => Boolean(item));
  const embedFromDb = String(
    (settings.chatEmbedCode || "").trim() || settings.nanoaiEmbedCode || ""
  ).trim();
  const envEmbedExplicit =
    Boolean(process.env.NEXT_PUBLIC_CHAT_WIDGET_EMBED?.trim()) ||
    Boolean(process.env.NEXT_PUBLIC_CHAT_WIDGET_SLUG?.trim());
  const embedFromEnv = envChatEmbedHtml(requestOrigin);
  const embedIframeRaw = envEmbedExplicit
    ? embedFromEnv || embedFromDb
    : embedFromDb || embedFromEnv;
  const hostedChatIframe = parseIframeEmbed(embedIframeRaw);
  const hostedChatUrl = hostedChatIframe
    ? normalizeEmbedSrc(hostedChatIframe.src, requestOrigin)
    : "";

  /** Logo tròn trên nút nổi «Mở chat» (khi đóng); header khi mở: ưu tiên tên shop từ DB, không dùng «NanoAI» mặc định từ title iframe. */
  let widgetLauncherLogoUrl: string | null = null;
  let widgetShopName = normalizeShopName(hostedChatIframe?.title || "");
  // Widget toàn cục (FloatingChatWidget) là UI thời trang (có "Đơn hàng của tôi", "Thử đồ"...).
  // Nếu admin lỡ cấu hình `chatEmbedCode` trỏ tới một hotel partner thì KHÔNG render widget
  // trên site chính của NanoAI — workspace khách sạn có trải nghiệm/nhúng riêng, và site chính
  // không phải là website của khách chủ khách sạn.
  let globalEmbedIsHotelPartner = false;
  if (hostedChatUrl && isPgConfigured()) {
    const slug = extractMessagingPartnerSlugFromChatUrl(hostedChatUrl);
    if (slug && !isReservedMessagingGuestSlug(slug)) {
      const row = await fetchMessagingPartnerBySlugFromPg(slug);
      widgetLauncherLogoUrl = row?.logo_url?.trim() || null;
      const dn = row?.display_name?.trim();
      if (dn) widgetShopName = dn;
      if (row?.industry_key === 'hotel') globalEmbedIsHotelPartner = true;
    }
  }

  const widgetText = {
    openLabel:
      locale === 'en'
        ? 'Open chat'
        : locale === 'zh'
          ? '打开聊天'
          : locale === 'ja'
            ? 'チャットを開く'
            : locale === 'ko'
              ? '채팅 열기'
              : 'Mở chat',
    closeLabel:
      locale === 'en'
        ? 'Close'
        : locale === 'zh'
          ? '关闭'
          : locale === 'ja'
            ? '閉じる'
            : locale === 'ko'
              ? '닫기'
              : 'Đóng',
    openFullPageLabel:
      locale === 'en'
        ? 'Open full page'
        : locale === 'zh'
          ? '全页打开'
          : locale === 'ja'
            ? '全画面で開く'
            : locale === 'ko'
              ? '전체 페이지 열기'
              : 'Mở toàn trang',
    ordersButtonLabel:
      locale === 'en'
        ? 'My orders'
        : locale === 'zh'
          ? '我的订单'
          : locale === 'ja'
            ? '注文一覧'
            : locale === 'ko'
              ? '내 주문'
              : 'Đơn hàng của tôi',
  }
  const shouldRenderGlobalChatWidget =
    Boolean(hostedChatIframe && hostedChatUrl) &&
    !globalEmbedIsHotelPartner &&
    !currentPathname.startsWith("/messaging/p/") &&
    !currentPathname.startsWith("/support-chat") &&
    !currentPathname.startsWith("/hospitality/") &&
    !currentPathname.startsWith("/dashboard/hospitality");
  const shouldRenderGlobalMetaPixel =
    Boolean(facebookPixelId) &&
    !currentPathname.startsWith('/messaging/p/')

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {metaTags.map((tag, index) =>
          tag.name ? (
            <meta key={`meta-name-${index}`} name={tag.name} content={tag.content} />
          ) : (
            <meta key={`meta-property-${index}`} property={tag.property} content={tag.content} />
          )
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen safe-area-pb`}
        suppressHydrationWarning
      >
        {gtmContainerId ? (
          <>
            <Script id="google-tag-manager" strategy="afterInteractive">
              {`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${gtmContainerId}');
              `}
            </Script>
            <noscript>
              <iframe
                src={`https://www.googletagmanager.com/ns.html?id=${gtmContainerId}`}
                height="0"
                width="0"
                style={{ display: "none", visibility: "hidden" }}
              />
            </noscript>
          </>
        ) : null}
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                var __gaUa = (navigator.userAgent || '').trim();
                var __gaIsLikelyBot = /bot|crawler|spider|facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|slackbot|whatsapp|telegrambot|twitterbot|linkedinbot|bingbot|googlebot|yandex|duckduckbot|embedly|quora link preview|pinterest|discordbot|applebot/i.test(__gaUa);
                gtag('js', new Date());
                if (!__gaIsLikelyBot) {
                  gtag('config', '${gaMeasurementId}');
                }
              `}
            </Script>
          </>
        ) : null}
        {shouldRenderGlobalMetaPixel ? (
          <>
            <Script id="meta-pixel-base" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${facebookPixelId}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                alt=""
                src={`https://www.facebook.com/tr?id=${encodeURIComponent(
                  facebookPixelId
                )}&ev=PageView&noscript=1`}
              />
            </noscript>
          </>
        ) : null}
        <AnalyticsTracker />
        <ReferralCapture />
        <ReferralClaimRunner />
        <JsonLd data={webAppLd} />
        <JsonLd data={orgLd} />
        {/*
          - Không bọc Header/main trong Suspense: Next 14.2 + Server Component dùng cookies() trong children
            gây "could not finish this Suspense boundary" trên trang chủ và nhiều route.
          - Trang nào cần boundary cho useSearchParams hãy bọc cục bộ trong chính trang đó.
        */}
        {useMinimalEmbedLayout ? (
          <main>{children}</main>
        ) : (
          <>
            <Header />
            <DepositCreditProvider>
              <main className="pb-16 md:pb-0">{children}</main>
              <Footer />
              <MobileBottomBar />
              <InstallPrompt />
              <PushNotificationPrompt />
              <SwUpdateReload />
              {shouldRenderGlobalChatWidget ? (
                <FloatingChatWidget
                  chatUrl={hostedChatUrl}
                  title={hostedChatIframe?.title || 'Chat widget'}
                  shopName={widgetShopName}
                  launcherLogoUrl={widgetLauncherLogoUrl}
                  loading={hostedChatIframe?.loading || 'lazy'}
                  referrerPolicy={hostedChatIframe?.referrerPolicy}
                  openLabel={widgetText.openLabel}
                  closeLabel={widgetText.closeLabel}
                  openFullPageLabel={widgetText.openFullPageLabel}
                  ordersButtonLabel={widgetText.ordersButtonLabel}
                />
              ) : null}
            </DepositCreditProvider>
          </>
        )}
      </body>
    </html>
  );
}
