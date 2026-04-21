import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const hospitalityRoots = [
  'src/lib/hospitality',
  'src/features/hospitality',
  'src/app/api/hospitality',
  'src/app/hospitality',
  'src/app/dashboard/hospitality',
]

const fashionRoots = [
  'src/lib/messaging',
  'src/app/messaging',
  'src/app/api/messaging',
]

const allowedFashionFiles = new Set([
  'src/app/api/messaging/guest/[slug]/route.ts',
])

// Hospitality wrapper modules are the ONLY place allowed to reach into
// `@/lib/messaging/*` shared plumbing. Everything else under the hospitality
// tree must consume those wrappers instead.
const allowedHospitalityFiles = new Set([
  'src/lib/hospitality/hospitality-partner-resolver.ts',
  'src/lib/hospitality/hospitality-partner-auth.ts',
  'src/lib/hospitality/hospitality-guest-identity.ts',
  'src/lib/hospitality/hospitality-conversation-service.ts',
])

const hospitalityForbiddenNeedles = [
  "from '@/lib/messaging/widget-guest-post'",
  "from '@/lib/messaging/guest-chat-ordering'",
  "from '@/lib/messaging/partner-ai-",
  "from '@/lib/messaging/partner-inventory-ai-search'",
  "from '@/lib/messaging/partner-inventory-text-embedding'",
  "from '@/lib/messaging/partner-gemini-image-search'",
  "from '@/lib/messaging/resolve-widget-order-thread'",
  "from '@/lib/messaging/resolve-active-messaging-partner'",
  "from '@/lib/messaging/partner-inventory-route-auth'",
  "from '@/lib/messaging/guest-auth-session'",
  "from '@/lib/messaging/guest-widget-identity'",
  "from '@/lib/customer-care/conversation-service'",
  "from '@/lib/db/customer-care-pg'",
]

const fashionForbiddenNeedles = [
  "from '@/lib/hospitality/",
  "from '@/features/hospitality/",
]

function listFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()
    if (!cur) continue
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const abs = path.join(cur, entry.name)
      if (entry.isDirectory()) {
        stack.push(abs)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      out.push(abs)
    }
  }
  return out
}

function rel(absPath) {
  return path.relative(root, absPath).replace(/\\/g, '/')
}

function checkNeedles(files, needles, label, allowlist = new Set()) {
  const violations = []
  for (const absPath of files) {
    const fileRel = rel(absPath)
    if (allowlist.has(fileRel)) continue
    const content = fs.readFileSync(absPath, 'utf8')
    for (const needle of needles) {
      if (content.includes(needle)) {
        violations.push(`${label}: ${fileRel} -> ${needle}`)
      }
    }
  }
  return violations
}

const hospitalityFiles = hospitalityRoots.flatMap((p) => listFiles(path.join(root, p)))
const fashionFiles = fashionRoots.flatMap((p) => listFiles(path.join(root, p)))

const violations = [
  ...checkNeedles(hospitalityFiles, hospitalityForbiddenNeedles, 'HospitalityBoundary', allowedHospitalityFiles),
  ...checkNeedles(fashionFiles, fashionForbiddenNeedles, 'FashionBoundary', allowedFashionFiles),
]

if (violations.length > 0) {
  console.error('Vertical boundary smoke failed:')
  for (const v of violations) console.error(`- ${v}`)
  process.exit(1)
}

console.log('Vertical boundary smoke passed.')
