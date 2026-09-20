import fs from 'node:fs'

const html = fs.readFileSync(`${process.env.TEMP}/gudo-live3.html`, 'utf8')

// first visible float chat button inner
const i = html.indexOf('data-pw-chrome-float="1" data-nanoai-open-chat data-pw-chat-icon-logo')
console.log('first float idx', i)
if (i >= 0) {
  const start = html.lastIndexOf('<button', i)
  const end = html.indexOf('</button>', i)
  console.log('INNER1', html.slice(start, end + 9).slice(0, 2500))
}

const i2 = html.indexOf('data-pw-chrome-float="1" data-nanoai-open-chat=""')
console.log('\nsecond float idx', i2)
if (i2 >= 0) {
  const start = html.lastIndexOf('<button', i2)
  const end = html.indexOf('</button>', i2)
  console.log('INNER2', html.slice(start, end + 9).slice(0, 2500))
}

const fab = html.match(/<(button|a|div)[^>]*(pw-fab-chat|nanoai-chat-bubble|data-pw-chat-launcher)[^>]*>[\s\S]{0,600}/i)
console.log('\nFAB', fab && fab[0].slice(0, 800))

console.log('\nCSP', html.match(/content-security-policy[^>]*>/i)?.[0])
console.log('referrerpolicy', (html.match(/referrerpolicy=/gi) || []).length)
console.log('crossorigin chat', /pw-chrome-chat-logo[^>]*crossorigin/.test(html))

const kitIdx = html.search(/<(aside|div)[^>]*data-pw-chrome-kit=["']float["']/)
console.log('\nkit tag idx', kitIdx)
if (kitIdx >= 0) {
  console.log('KIT TAG', html.slice(kitIdx, kitIdx + 500))
  const parentSlice = html.slice(Math.max(0, kitIdx - 400), kitIdx)
  console.log('BEFORE KIT', parentSlice.replace(/\s+/g, ' ').slice(-400))
}

console.log('\ninline-visual-root', html.includes('data-pw-inline-visual-root'))
console.log('scale', (html.match(/pw-scene-zoom|transform:scale|data-pw-live-chrome-scale/g) || []).slice(0, 10))
