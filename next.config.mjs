import withPWAInit from '@ducanh2912/next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Bật lint/typecheck khi build — `tsc` và `next lint` đã xanh; bắt lỗi sớm trên CI.
    eslint: { ignoreDuringBuilds: false },
    allowedDevOrigins: ['*.ngrok-free.dev', '*.ngrok.io'],
    experimental: {
        serverComponentsExternalPackages: ['xlsx', 'pdf-to-img', 'pdfjs-dist', 'node-poppler', 'web-push'],
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    typescript: { ignoreBuildErrors: false },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'mxwfxudyeoqstgwmlupa.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'mxwfxudyeoqstgwmlupa.supabase.co',
                port: '',
                pathname: '/storage/v1/object/sign/**',
            },
            {
                protocol: 'https',
                hostname: 'img.vietqr.io',
                port: '',
                pathname: '/image/**',
            },
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
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
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
