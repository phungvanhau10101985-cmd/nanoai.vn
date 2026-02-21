/**
 * Script tạo icons PWA từ SVG
 * Chạy: node scripts/generate-pwa-icons.js
 */
const fs = require('fs')
const path = require('path')
const PNG_OPTS = { compressionLevel: 9, effort: 10, palette: true, quality: 80 }

async function generateIcons() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.log('Đang cài sharp...')
    require('child_process').execSync('npm install sharp --no-save', { stdio: 'inherit' })
    sharp = require('sharp')
  }

  const iconsDir = path.join(__dirname, '..', 'public', 'icons')
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true })
  }

  // SVG icon đơn giản - áo thời trang với gradient
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <linearGradient id="shirt" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#ffffff"/>
      <stop offset="100%" style="stop-color:#e0e7ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#bg)"/>
  <path d="M256 120 L200 200 L200 380 L312 380 L312 200 Z" fill="url(#shirt)" opacity="0.95"/>
  <circle cx="256" cy="140" r="50" fill="url(#shirt)" opacity="0.95"/>
  <path d="M180 200 L180 380 M332 200 L332 380" stroke="url(#shirt)" stroke-width="24" stroke-linecap="round" opacity="0.8"/>
</svg>
  `.trim()

  const sizes = [192, 512]
  for (const size of sizes) {
    const buffer = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png(PNG_OPTS)
      .toBuffer()
    const outPath = path.join(iconsDir, `icon-${size}x${size}.png`)
    fs.writeFileSync(outPath, buffer)
    console.log(`Đã tạo: ${outPath}`)
  }

  // Apple touch icon 180x180
  const appleBuffer = await sharp(Buffer.from(svg))
    .resize(180, 180)
    .png(PNG_OPTS)
    .toBuffer()
  fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), appleBuffer)
  console.log('Đã tạo: apple-touch-icon.png')

  console.log('Hoàn tất! Icons đã được tạo trong public/icons/')
}

generateIcons().catch(console.error)
