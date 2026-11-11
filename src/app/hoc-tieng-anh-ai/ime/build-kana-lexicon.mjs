// Builds public/ime/kana-lexicon.txt from Mozc dictionary_oss (BSD-3-Clause).
// node build-kana-lexicon.mjs <dict-dir> <id.def>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dictDir = process.argv[2]
const idFile = process.argv[3]
if (!dictDir || !idFile) {
  console.error('usage: node build-kana-lexicon.mjs <dict-dir> <id.def>')
  process.exit(1)
}

const id = fs.readFileSync(idFile, 'utf8').split(/\n/)
const posOf = (n) => (id[Number(n)] || '').split(' ').slice(1).join(' ')
const FUNC = /^(助詞|助動詞|感動詞|接続詞|記号|補助記号|副詞)/
const map = new Map()

for (const file of fs.readdirSync(dictDir)) {
  if (!file.endsWith('.txt')) continue
  const text = fs.readFileSync(path.join(dictDir, file), 'utf8')
  for (const line of text.split(/\n/)) {
    const parts = line.split('\t')
    if (parts.length < 5) continue
    const reading = parts[0]
    const mozc = Number(parts[3])
    const surface = parts[4]
    if (!reading || reading === 'っ' || !surface || !Number.isFinite(mozc) || mozc > 7200) continue
    if (!/^[ぁ-ゖー]+$/.test(reading)) continue
    if (!/^[ぁ-ゖァ-ヺー一-龯々]+$/.test(surface)) continue
    const pos = posOf(parts[1])
    if ((pos.startsWith('接頭詞') || pos.includes(',接尾,')) && !['さん', 'ちゃん', 'くん', 'さま', 'たち', '的'].includes(surface)) continue
    const list = map.get(reading) || []
    list.push({
      surface,
      mozc,
      func: FUNC.test(pos),
      pos,
      pure: /^[一-龯々]+$/.test(surface),
      kata: /^[ァ-ヺー]+$/.test(surface),
    })
    map.set(reading, list)
  }
}

function inject(reading, surface, mozc, pos) {
  const list = map.get(reading) || []
  list.push({ surface, mozc, func: true, pos, pure: false, kata: false })
  map.set(reading, list)
}

inject('ました', 'ました', 40, '助動詞')
inject('ません', 'ません', 40, '助動詞')
inject('ましょう', 'ましょう', 50, '助動詞')
inject('でした', 'でした', 30, '助動詞')
inject('じゃない', 'じゃない', 40, '助動詞')
inject('ください', 'ください', 5, '助動詞')
inject('ございます', 'ございます', 20, '助動詞')

function adjusted(entry, len) {
  let cost = entry.mozc - 520 * (len - 1)
  if (entry.pos.includes('固有名詞') && entry.mozc > 1600) cost += 2400
  if (len >= 2 && !entry.func && entry.mozc <= 6500) cost -= 800
  if (len >= 3 && entry.pure && !entry.pos.includes('固有名詞') && entry.mozc <= 5600) cost -= 2200
  if (len >= 4 && !entry.func && entry.mozc <= 5200) cost -= 900
  if (len >= 6 && entry.mozc <= 5000) cost -= 500 * len
  if (entry.pos.startsWith('感動詞')) cost -= 1600
  if (entry.pos.startsWith('感動詞') && len >= 5) cost -= 4000
  if (len === 1 && !entry.func) cost = Math.max(cost, 2800)
  return cost
}

function lowest(list) {
  return list.slice().sort((a, b) => a.mozc - b.mozc)[0]
}

function choose(list, len) {
  const bestMozc = Math.min(...list.map((entry) => entry.mozc))
  const usable = list.filter((entry) => !entry.pos.includes('固有名詞') || entry.mozc <= bestMozc + 500)
  const hiraEntry = lowest(usable.filter((entry) => /^[ぁ-ゖー]+$/.test(entry.surface)))
  const kanji = lowest(usable.filter((entry) => entry.pure))
  const mixed = lowest(usable.filter((entry) => !entry.pure && !entry.kata && !/^[ぁ-ゖー]+$/.test(entry.surface)))
  const kata = lowest(usable.filter((entry) => entry.kata))
  const verb = mixed && /動詞/.test(mixed.pos) && mixed.mozc <= 2300 ? mixed : null
  if (len === 1 && hiraEntry && hiraEntry.func && hiraEntry.mozc <= 120) return hiraEntry
  if (hiraEntry && hiraEntry.func && hiraEntry.mozc <= 2800 && /^(感動詞|副詞|助詞|接続詞|助動詞)/.test(hiraEntry.pos)) return hiraEntry
  if (verb && verb.mozc <= 400 && (!kanji || verb.mozc + 250 < kanji.mozc)) return verb
  if (hiraEntry && hiraEntry.mozc <= 50 && !(kanji && kanji.mozc <= 900) && !(verb && verb.mozc <= 400)) return hiraEntry
  if (verb && (!kanji || verb.mozc + 250 < kanji.mozc)) return verb
  if (hiraEntry && !/動詞/.test(hiraEntry.pos) && hiraEntry.mozc <= 1000 && (!kanji || hiraEntry.mozc + 700 < kanji.mozc)) return hiraEntry
  if (kanji && kanji.mozc <= 5400 && (!hiraEntry || kanji.mozc <= hiraEntry.mozc + (len >= 3 ? 4500 : 1800))) return kanji
  if (mixed && mixed.mozc <= 4000) return mixed
  return hiraEntry || kanji || mixed || kata
}

const lex = new Map()
for (const [reading, list] of map) {
  const best = choose(list, reading.length)
  if (!best) continue
  if (best.mozc > 5400 && reading.length < 4) continue
  if (best.mozc > 6400) continue
  const seen = new Set([best.surface])
  const alts = []
  for (const entry of list.slice().sort((a, b) => a.mozc - b.mozc)) {
    if (seen.has(entry.surface) || alts.length >= 3 || entry.mozc > 4800) continue
    seen.add(entry.surface)
    alts.push(entry.surface)
  }
  let cost = adjusted(best, reading.length)
  // って / った are real, but a cheap one must not hide 待っ+て or 買っ+た.
  if (reading.startsWith('っ') && /^[ぁ-ゖー]+$/.test(best.surface)) cost += 1800
  lex.set(reading, { surface: best.surface, cost, mozc: best.mozc, alts })
}

const SPLIT = 1100
function segment(kana) {
  const dp = Array(kana.length + 1)
  dp[0] = { cost: 0, text: '' }
  for (let i = 0; i < kana.length; i += 1) {
    const state = dp[i]
    if (!state) continue
    let any = false
    const limit = Math.min(18, kana.length - i)
    for (let len = 1; len <= limit; len += 1) {
      const word = lex.get(kana.slice(i, i + len))
      if (!word) continue
      any = true
      const cost = state.cost + word.cost + (i > 0 ? SPLIT : 0)
      const next = i + len
      if (!dp[next] || cost < dp[next].cost) dp[next] = { cost, text: state.text + word.surface }
    }
    if (!any) {
      const next = i + 1
      const cost = state.cost + 7200
      if (!dp[next] || cost < dp[next].cost) dp[next] = { cost, text: state.text + kana[i] }
    }
  }
  return dp[kana.length]
}

const expect = new Map([
  ['こんにちは', 'こんにちは'],
  ['こんばんは', 'こんばんは'],
  ['きょうは', '今日は'],
  ['にほんご', '日本語'],
  ['にほん', '日本'],
  ['がっこう', '学校'],
  ['みず', '水'],
  ['ひこうき', '飛行機'],
  ['なんじ', '何時'],
  ['いきます', '行きます'],
  ['たべました', '食べました'],
  ['かった', '買った'],
  ['わかりました', '分かりました'],
  ['ありがとうございます', 'ありがとうございます'],
  ['わたしのなまえは', '私の名前は'],
  ['すしをたべます', '寿司を食べます'],
  ['せんせい', '先生'],
  ['がくせい', '学生'],
  ['みずをください', '水をください'],
  ['すみません', 'すみません'],
  ['おねがいします', 'お願いします'],
  ['くるま', '車'],
  ['ともだち', '友達'],
  ['でんしゃ', '電車'],
  ['ねこ', '猫'],
  ['いぬ', '犬'],
  ['げんきですか', '元気ですか'],
  ['ちょっとまって', 'ちょっと待って'],
])

let failed = 0
for (const [kana, wanted] of expect) {
  const got = segment(kana)?.text || ''
  if (got !== wanted) {
    failed += 1
    const whole = lex.get(kana)
    console.error('FAIL', kana, '=>', got, 'wanted', wanted, whole ? `${whole.surface}@${Math.round(whole.cost)}` : 'no-whole')
    const raw = map.get(kana)
    if (raw) console.error('  ', raw.slice(0, 8).map((entry) => `${entry.surface}/${entry.mozc}`).join(' | '))
  }
}
if (failed) {
  console.error('failed', failed)
  process.exit(1)
}

const lines = []
for (const [reading, entry] of lex) {
  const alts = entry.alts.filter((alt) => alt && alt !== entry.surface)
  lines.push([reading, entry.surface, String(Math.round(entry.cost)), ...alts].join(' '))
}
lines.sort((a, b) => a.localeCompare(b, 'ja'))
const pack = lines.join('\n')
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../public/ime')
fs.mkdirSync(publicDir, { recursive: true })
const out = [
  '# Generated by build-kana-lexicon.mjs. Do not edit by hand.',
  '# Source: Mozc dictionary_oss (Copyright Google LLC, BSD-3-Clause).',
  pack,
  '',
].join('\n')
fs.writeFileSync(path.join(publicDir, 'kana-lexicon.txt'), out)
console.log('words', lex.size, 'bytes', out.length)
