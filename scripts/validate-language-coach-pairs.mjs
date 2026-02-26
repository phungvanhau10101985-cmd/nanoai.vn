import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const localeDir = path.join(root, 'src', 'app', 'hoc-tieng-anh-ai', 'i18n', 'locales')
const pairDir = path.join(root, 'src', 'app', 'hoc-tieng-anh-ai', 'i18n', 'pairs')

const requiredLocaleKeys = [
  'Required new-word practice',
  'Listen and type the word correctly 3 times, then choose the correct meaning each round.',
  'Current word:',
  'You are doing great! Complete 3/3 and you can continue right away.',
  'Progress:',
  'Replay new word',
  'Type the exact word:',
  'Type the new word...',
  'Choose the correct meaning:',
]

const requiredPairFields = [
  'key',
  'nativeLanguageCode',
  'targetLanguageCode',
  'uiTone',
  'enforceStrictPair',
  'nativeFirstExplanation',
  'maxReplyCharsConcise',
  'maxReplyCharsDetailed',
  'conversationFocus',
  'correctionFocus',
  'lexicalFocus',
  'avoidPatterns',
  'extraSystemRules',
]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

const localeFiles = ['zh.json', 'ja.json', 'ko.json', 'th.json', 'hi.json']
for (const file of localeFiles) {
  const json = readJson(path.join(localeDir, file))
  for (const key of requiredLocaleKeys) {
    if (!json[key]) {
      throw new Error(`[locale] Missing key "${key}" in ${file}`)
    }
  }
}

const pairFiles = fs
  .readdirSync(pairDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
for (const file of pairFiles) {
  const json = readJson(path.join(pairDir, file))
  for (const field of requiredPairFields) {
    if (!(field in json)) {
      throw new Error(`[pair] Missing field "${field}" in ${file}`)
    }
  }
}

console.log(`[ok] Locale files validated: ${localeFiles.length}`)
console.log(`[ok] Pair configs validated: ${pairFiles.length}`)
