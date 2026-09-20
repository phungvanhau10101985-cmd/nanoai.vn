import fs from 'node:fs'
const html = fs.readFileSync(`${process.env.TEMP}/gudo-live3.html`, 'utf8')
const srcs = new Set()
for (const m of html.matchAll(/<(?:img|source)[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
  const s = m[1]
  if (/logo|favicon|chrome-chat|studio_/i.test(s) || /pw-chrome-chat-logo/.test(m[0]) || /data-pw-logo-slot/.test(m[0])) {
    srcs.add(s)
  }
}
for (const m of html.matchAll(/class="[^"]*pw-(?:logo|shop-footer-logo|chrome-chat-logo)[^"]*"[^>]*src=["']([^"']+)["']/gi)) srcs.add(m[1])
for (const m of html.matchAll(/src=["']([^"']+)["'][^>]*class="[^"]*pw-(?:logo|shop-footer-logo|chrome-chat-logo)/gi)) srcs.add(m[1])

console.log([...srcs].slice(0, 40).join('\n'))
console.log('count', srcs.size)
