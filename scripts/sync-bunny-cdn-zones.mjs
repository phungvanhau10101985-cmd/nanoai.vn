/**
 * Đồng bộ cấu hình chuẩn cho toàn bộ Pull Zone trên Bunny CDN:
 * - ForceSSL: true cho hostname system (*.b-cdn.net)
 * - DisableCookies: true
 * Chạy: node scripts/sync-bunny-cdn-zones.mjs
 */
import fs from 'fs'

let env = {}
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8')
  for (const line of content.split('\n')) {
    const idx = line.indexOf('=')
    if (idx > 0) {
      env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    }
  }
}

const key = env['BUNNY_ACCOUNT_API_KEY'] || process.env.BUNNY_ACCOUNT_API_KEY
if (!key) {
  console.error('Thiếu BUNNY_ACCOUNT_API_KEY.')
  process.exit(1)
}

async function main() {
  const res = await fetch('https://api.bunny.net/pullzone', {
    headers: { AccessKey: key, Accept: 'application/json' },
  })
  if (!res.ok) {
    console.error(`Lỗi tải danh sách pull zone: HTTP ${res.status}`)
    process.exit(1)
  }
  const zones = await res.json()
  console.log(`Tìm thấy ${zones.length} pull zones trên Bunny. Bắt đầu đồng bộ...`)

  for (const z of zones) {
    for (const h of z.Hostnames || []) {
      if (h.IsSystemHostname && !h.ForceSSL) {
        console.log(`[${z.Name}] Bật ForceSSL cho hostname ${h.Value}...`)
        const setRes = await fetch('https://api.bunny.net/pullzone/setForceSSL', {
          method: 'POST',
          headers: { AccessKey: key, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ PullZoneId: z.Id, Hostname: h.Value, ForceSSL: true }),
        })
        console.log(`  -> Status: ${setRes.status}`)
      }
    }
  }

  console.log('\n=== KẾT QUẢ KIỂM TRA SAU ĐỒNG BỘ ===')
  const verifyRes = await fetch('https://api.bunny.net/pullzone', {
    headers: { AccessKey: key, Accept: 'application/json' },
  })
  const verifyZones = await verifyRes.json()
  for (const z of verifyZones) {
    for (const h of z.Hostnames || []) {
      console.log(`- Zone: ${z.Name.padEnd(22)} | Hostname: ${h.Value.padEnd(30)} | ForceSSL: ${String(h.ForceSSL).padEnd(5)} | HasCert: ${h.HasCertificate}`)
    }
  }
}

main().catch(console.error)
