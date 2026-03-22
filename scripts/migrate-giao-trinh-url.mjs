import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..', 'src')

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name !== 'node_modules') walk(p, acc)
    } else if (/\.(tsx?|mdc)$/.test(ent.name)) acc.push(p)
  }
  return acc
}

let nfiles = 0
for (const f of walk(root)) {
  let s = fs.readFileSync(f, 'utf8')
  const orig = s
  s = s.replace(/\/tao-giao-trinh/g, (m, off, str) => {
    if (off >= 5 && str.slice(off - 5, off) === '@/app') return m
    if (off >= 3 && str.slice(off - 3, off) === '../') return m
    if (off >= 2 && str.slice(off - 2, off) === './') return m
    return '/giao-trinh'
  })
  if (s !== orig) {
    fs.writeFileSync(f, s, 'utf8')
    nfiles++
  }
}
console.log('updated files:', nfiles)
