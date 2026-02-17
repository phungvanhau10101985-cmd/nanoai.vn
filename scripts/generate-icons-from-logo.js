/**
 * Tạo các kích thước icon từ logo NanoAI
 * Chạy: node scripts/generate-icons-from-logo.js
 */
const fs = require('fs')
const path = require('path')

const LOGO_SOURCE = path.join(__dirname, '..', 'assets', 'logo-nanoai.png')

async function generateIcons() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.log('Đang cài sharp...')
    require('child_process').execSync('npm install sharp --no-save', { stdio: 'inherit' })
    sharp = require('sharp')
  }

  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error('Không tìm thấy logo tại:', LOGO_SOURCE)
    process.exit(1)
  }

  const publicDir = path.join(__dirname, '..', 'public')
  const iconsDir = path.join(publicDir, 'icons')
  const appDir = path.join(__dirname, '..', 'src', 'app')

  ;[iconsDir, appDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })

  const sourceBuffer = fs.readFileSync(LOGO_SOURCE)

  // PWA icons
  const pwaSizes = [
    { size: 192, name: 'icon-192x192.png' },
    { size: 512, name: 'icon-512x512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ]

  for (const { size, name } of pwaSizes) {
    const buffer = await sharp(sourceBuffer)
      .resize(size, size)
      .png()
      .toBuffer()
    const outPath = path.join(iconsDir, name)
    fs.writeFileSync(outPath, buffer)
    console.log('Đã tạo:', outPath)
  }

  // App icon (Next.js favicon) - 32x32
  const appIconBuffer = await sharp(sourceBuffer)
    .resize(32, 32)
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(appDir, 'icon.png'), appIconBuffer)
  console.log('Đã tạo: src/app/icon.png')

  // Favicon ico - 16, 32, 48
  const faviconSizes = [16, 32, 48]
  const faviconBuffers = await Promise.all(
    faviconSizes.map(s => sharp(sourceBuffer).resize(s, s).png().toBuffer())
  )
  // sharp can create ico from multiple sizes
  await sharp(faviconBuffers[1]) // 32x32 as primary
    .resize(32, 32)
    .toFormat('png')
    .toFile(path.join(publicDir, 'favicon.png'))
  console.log('Đã tạo: public/favicon.png')

  // OG image cho social sharing 1200x630 - logo centered trên nền trắng
  const ogWidth = 1200
  const ogHeight = 630
  const logoSize = 360
  const logoBuffer = await sharp(sourceBuffer).resize(logoSize, logoSize).png().toBuffer()
  const whiteBg = await sharp({
    create: { width: ogWidth, height: ogHeight, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).png().toBuffer()
  const compositeImg = await sharp(whiteBg)
    .composite([{
      input: logoBuffer,
      top: Math.round((ogHeight - logoSize) / 2),
      left: Math.round((ogWidth - logoSize) / 2),
    }])
    .png()
    .toBuffer()
  fs.writeFileSync(path.join(publicDir, 'og-image.png'), compositeImg)
  console.log('Đã tạo: public/og-image.png')

  console.log('\nHoàn tất! Tất cả icons đã được tạo từ logo NanoAI.')
}

generateIcons().catch(console.error)
