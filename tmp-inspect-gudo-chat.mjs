import fs from 'node:fs'

const html = fs.readFileSync(`${process.env.TEMP}/gudo-live3.html`, 'utf8')
if (!html || html.length < 1000) {
  console.log('need fresh dump, existing len', html?.length)
}

function around(idx, n = 400) {
  return html.slice(Math.max(0, idx - 80), Math.min(html.length, idx + n)).replace(/\s+/g, ' ')
}

const chatBtns = [...html.matchAll(/<(a|button)[^>]*data-pw-chrome-btn=["']chat["'][^>]*>/gi)]
console.log('chat open tags', chatBtns.length)
for (const m of chatBtns.slice(0, 8)) {
  console.log('\nCHAT TAG', m[0].slice(0, 1200))
}

const logos = [...html.matchAll(/<img[^>]*pw-chrome-chat-logo[^>]*>/gi)]
console.log('\nchat logos', logos.length)
for (const m of logos.slice(0, 6)) console.log(m[0].slice(0, 500))

const float = html.match(/<(aside|div|nav)[^>]*data-pw-chrome-kit=["']float["'][^>]*>/i)
console.log('\nFLOAT HOST', float && float[0].slice(0, 800))

const hidden = [...html.matchAll(/data-pw-chrome-btn=["']chat["'][^>]{0,400}/gi)]
console.log('\nhidden?', hidden.slice(0, 4).map((m) => /data-pw-hidden/.test(m[0])))

console.log('\nlive-fixed-layer', html.includes('data-pw-live-fixed-layer'))
console.log('nanoai-open-chat', (html.match(/data-nanoai-open-chat/g) || []).length)
console.log('pw-fab-chat', html.includes('pw-fab-chat'))
console.log('hideChat', html.includes('hideLauncher') || html.includes('hide-chat'))

const idx = html.search(/data-pw-chrome-kit=["']float["']/)
if (idx >= 0) {
  const chunk = html.slice(idx, idx + 4500)
  const text = chunk.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  console.log('\nFLOAT CHUNK TEXT', text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 600))
  console.log('\nFLOAT CHUNK HTML', chunk.slice(0, 2500))
}
