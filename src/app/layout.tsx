import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { DepositCreditProvider } from "@/components/deposit-credit-context";
import { buildMetadata, buildJsonLdWebApplication, buildJsonLdOrganization, SITE_URL, SITE_NAME } from "@/lib/seo";
import { JsonLd } from "@/components/seo-json-ld";

const MobileBottomBar = dynamic(
  () => import("@/components/layout/mobile-bottom-bar").then((m) => m.MobileBottomBar),
  { ssr: false }
);
const InstallPrompt = dynamic(
  () => import("@/components/pwa/install-prompt").then((m) => m.InstallPrompt),
  { ssr: false }
);

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "NanoAI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const webAppLd = buildJsonLdWebApplication(
    SITE_NAME,
    "NanoAI - Sáng tạo không giới hạn cùng AI. Thử đồ ảo, phục dựng ảnh, làm nét ảnh, ghép ảnh với AI.",
    SITE_URL
  );
  const orgLd = buildJsonLdOrganization();

  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen safe-area-pb`}
      >
        <JsonLd data={webAppLd} />
        <JsonLd data={orgLd} />
        <DepositCreditProvider>
          <Suspense fallback={<header className="h-14 border-b bg-background" />}>
            <Header />
          </Suspense>
          <main className="pb-16 md:pb-0">{children}</main>
          <MobileBottomBar />
          <InstallPrompt />
        </DepositCreditProvider>
      </body>
    </html>
  );
}
