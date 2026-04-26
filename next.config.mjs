import withPWAInit from '@ducanh2912/next-pwa';

/** Host cho ảnh URL cũ (Storage REST `/storage/v1/object/...`) — không hardcode domain trong repo. */
function hostnameFromEnvUrl(key) {
    const raw = process.env[key]?.trim();
    if (!raw) return null;
    try {
        return new URL(raw).hostname;
    } catch {
        return null;
    }
}

const legacyStorageRestHost =
    hostnameFromEnvUrl('NEXT_PUBLIC_STORAGE_LEGACY_REST_ORIGIN') ||
    hostnameFromEnvUrl('NEXT_PUBLIC_LEGACY_HTTP_ORIGIN');

const legacyStorageImagePatterns = legacyStorageRestHost
    ? [
          {
              protocol: 'https',
              hostname: legacyStorageRestHost,
              port: '',
              pathname: '/storage/v1/object/public/**',
          },
          {
              protocol: 'https',
              hostname: legacyStorageRestHost,
              port: '',
              pathname: '/storage/v1/object/sign/**',
          },
      ]
    : [];

/** Pull zone Bunny — hostname từ BUNNY_STORAGE_PUBLIC_BASE_URL (không hardcode CDN trong repo). */
const bunnyPullZoneHost = hostnameFromEnvUrl('BUNNY_STORAGE_PUBLIC_BASE_URL');
const bunnyImagePatterns = bunnyPullZoneHost
    ? [
          {
              protocol: 'https',
              hostname: bunnyPullZoneHost,
              port: '',
              pathname: '/**',
          },
      ]
    : [];

/** CDN công khai (ảnh kết quả / sticker) — dùng icon tính năng Giáo trình. */
const nanoaiBcdnImagePatterns = [
    {
        protocol: 'https',
        hostname: 'nanoai.b-cdn.net',
        port: '',
        pathname: '/**',
    },
];

/** VPS RAM thấp: SKIP_ESLINT_ON_BUILD=1 (mặc định qua `npm run build` → scripts/build-lowmem.mjs). */
const skipEslintOnBuild = process.env.SKIP_ESLINT_ON_BUILD === '1'
/** Chỉ bật trên VPS khi vẫn OOM ở bước TypeScript — ưu tiên thêm swap; CI nên dùng `npm run build:full`. */
const skipTypescriptOnBuild = process.env.NEXT_BUILD_SKIP_TYPECHECK === '1'

/** Bật sourcemap server trong production (giúp đọc stack trace) — không tăng bundle size client. */
const enableServerSourceMaps = process.env.PROD_SERVER_SOURCE_MAPS === '1'

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: { ignoreDuringBuilds: skipEslintOnBuild },
    allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok.io'],
    /** Sourcemap không build cho client (giảm dung lượng tải); chỉ build server-side khi bật flag. */
    productionBrowserSourceMaps: false,
    experimental: {
        serverComponentsExternalPackages: ['xlsx', 'pdf-to-img', 'pdfjs-dist', 'node-poppler', 'web-push'],
        serverActions: {
            bodySizeLimit: '10mb',
            /**
             * Encryption key cố định cho Server Action ID. Nếu không đặt, mỗi `npm run build`
             * sẽ sinh ID ngẫu nhiên → browser cache JS cũ → lỗi:
             *   "Failed to find Server Action 'x'. This request might be from an older or newer deployment."
             *
             * Cấu hình:
             *   1) Sinh key 1 lần: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
             *   2) Đặt vào file `.env` server: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<hex 64 ký tự>`
             *   3) Build/deploy lại → Server Action ID giữ nguyên giữa các deploy.
             *
             * Lưu ý: KHÔNG hardcode key trong code (bảo mật). Dùng env var.
             */
            encryptionKey: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
        },
        /**
         * Bật sourcemap cho server bundle (Node.js) khi đặt `PROD_SERVER_SOURCE_MAPS=1`.
         * Giúp stack trace có tên function/file gốc thay vì tên minify (`r$`, `rT`...).
         * Tốn ~10-20% dung lượng `.next/server` nhưng không ảnh hưởng client.
         */
        ...(enableServerSourceMaps ? { serverSourceMaps: true } : {}),
    },
    typescript: { ignoreBuildErrors: skipTypescriptOnBuild },
    images: {
        remotePatterns: [
            ...legacyStorageImagePatterns,
            {
                protocol: 'https',
                hostname: 'img.vietqr.io',
                port: '',
                pathname: '/image/**',
            },
            ...bunnyImagePatterns,
            ...nanoaiBcdnImagePatterns,
        ],
    },
    // Tắt webpack cache có thể gây lỗi clientModules trên Windows
    webpack: (config, { dev }) => {
        if (dev) {
            config.cache = false;
        }
        return config;
    },
    async headers() {
        const headers = [
            {
                // Hosted guest chat pages are intentionally embeddable on partner sites.
                source: '/messaging/p/:slug',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
                ],
            },
            {
                // Keep SAMEORIGIN framing protection for every other route.
                source: '/((?!messaging/p/).*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                ],
            },
            {
                source: '/sw.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
            {
                source: '/_next/static/:buildId/_buildManifest.js',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
            {
                source: '/_next/static/:buildId/_ssgManifest.js',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            },
            {
                // Embed widget script must refresh immediately after deploy on partner sites.
                source: '/embed/nanoai-chat-widget.js',
                headers: [
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Pragma', value: 'no-cache' },
                    { key: 'Expires', value: '0' },
                ],
            },
        ];

        // In dev, disable static asset caching to avoid stale client chunks/hot-update mismatch.
        if (process.env.NODE_ENV === 'development') {
            headers.push({
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                ],
            });
        }

        return headers;
    },
    /** URL công khai mới: /giao-trinh (thay /tao-giao-trinh). Giữ thư mục app tao-giao-trinh + redirect 301. */
    async redirects() {
        return [
            { source: '/nhac-nen-ai', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/nhac-nen-ai/:path*', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/ai-dj', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/ai-dj/:path*', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/nhac-theo-cam-xuc-anh', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/nhac-theo-cam-xuc-anh/:path*', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/dieu-khien-nhac-realtime', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/dieu-khien-nhac-realtime/:path*', destination: '/tao-bai-hat-lyria-3', permanent: true },
            { source: '/tao-de-trac-nghiem', destination: '/tao-bai-thi', permanent: true },
            { source: '/tao-giao-trinh', destination: '/giao-trinh', permanent: true },
            { source: '/tao-giao-trinh/:path*', destination: '/giao-trinh/:path*', permanent: true },
            { source: '/api/tao-giao-trinh/:path*', destination: '/api/giao-trinh/:path*', permanent: true },
        ];
    },
    async rewrites() {
        return [
            { source: '/giao-trinh', destination: '/tao-giao-trinh' },
            { source: '/giao-trinh/:path*', destination: '/tao-giao-trinh/:path*' },
            { source: '/api/giao-trinh/:path*', destination: '/api/tao-giao-trinh/:path*' },
        ];
    },
};

const withPWA = withPWAInit({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    /** Tránh precache `/` — mỗi build mới vẫn có thể phục vụ shell HTML cũ từ precache. */
    cacheStartUrl: false,
    workboxOptions: {
        importScripts: ['/push-sw.js'],
    },
    runtimeCaching: [
        {
            // Never cache navigation HTML in SW to avoid stale buildId references after deploy.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkOnly',
        },
        {
            // Manifest files must always come from network; stale SW cache causes 404 loop on new builds.
            urlPattern: /\/_next\/static\/[^/]+\/(?:_buildManifest|_ssgManifest)\.js$/i,
            handler: 'NetworkOnly',
        },
        {
            urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
        },
        {
            urlPattern: /^https?:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'images',
                expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
        },
    ],
});

export default withPWA(nextConfig);
