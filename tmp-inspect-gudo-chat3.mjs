import fs from 'node:fs'
const html = fs.readFileSync(`${process.env.TEMP}/gudo-live3.html`, 'utf8')

function count(re) {
  return (html.match(re) || []).length
}

console.log('scene-absolute', count(/data-pw-placement=["']scene-absolute["']/g))
console.log('added-text', count(/data-pw-added-text=["']1["']/g))
console.log('added-btn', count(/data-pw-added-btn=["']1["']/g))
console.log('chrome-added box-x', count(/data-pw-chrome-added=["']1["'][^>]*data-pw-box-x/g))
console.log('scene-origin', count(/data-pw-scene-origin/g))
console.log('pw-visual-desktop', count(/pw-visual-desktop/g))
console.log('live-chrome-scale', count(/data-pw-live-chrome-scale/g))

const i = html.indexOf('data-pw-chrome-float="1" data-nanoai-open-chat data-pw-chat-icon-logo')
const start = html.lastIndexOf('<button', i)
console.log('\nPARENT CONTEXT1', html.slice(Math.max(0, start - 500), start).replace(/\s+/g, ' ').slice(-400))

const kit = html.indexOf('class="pw-chrome-float-kit"')
console.log('\nKIT parent', html.slice(Math.max(0, kit - 300), kit).replace(/\s+/g, ' ').slice(-250))

console.log('\nlogo fetch next')
