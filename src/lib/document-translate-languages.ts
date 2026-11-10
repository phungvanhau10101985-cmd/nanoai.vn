/** Ngôn ngữ trang dịch ảnh tài liệu. `promptName` là tên tiếng Anh gửi cho model ảnh. `label` là tên trên select. */

export type DocumentTranslateLanguage = {
  code: string
  promptName: string
  label: string
  popular?: boolean
}

export const DOCUMENT_TRANSLATE_LANGUAGES: DocumentTranslateLanguage[] = [
  { code: 'vi', promptName: 'Vietnamese', label: 'Tiếng Việt', popular: true },
  { code: 'en', promptName: 'English', label: 'English', popular: true },
  { code: 'zh', promptName: 'Chinese Simplified', label: '中文（简体）', popular: true },
  { code: 'zh-tw', promptName: 'Chinese Traditional', label: '中文（繁體）', popular: true },
  { code: 'ja', promptName: 'Japanese', label: '日本語', popular: true },
  { code: 'ko', promptName: 'Korean', label: '한국어', popular: true },
  { code: 'th', promptName: 'Thai', label: 'ไทย', popular: true },
  { code: 'id', promptName: 'Indonesian', label: 'Bahasa Indonesia', popular: true },
  { code: 'fr', promptName: 'French', label: 'Français', popular: true },
  { code: 'de', promptName: 'German', label: 'Deutsch', popular: true },
  { code: 'es', promptName: 'Spanish', label: 'Español', popular: true },
  { code: 'ru', promptName: 'Russian', label: 'Русский', popular: true },
  { code: 'ms', promptName: 'Malay', label: 'Bahasa Melayu' },
  { code: 'it', promptName: 'Italian', label: 'Italiano' },
  { code: 'pt', promptName: 'Portuguese', label: 'Português' },
  { code: 'ar', promptName: 'Arabic', label: 'العربية' },
  { code: 'hi', promptName: 'Hindi', label: 'हिन्दी' },
  { code: 'km', promptName: 'Khmer', label: 'ភាសាខ្មែរ' },
  { code: 'lo', promptName: 'Lao', label: 'ລາວ' },
  { code: 'my', promptName: 'Burmese', label: 'မြန်မာ' },
  { code: 'tl', promptName: 'Filipino', label: 'Filipino' },
  { code: 'nl', promptName: 'Dutch', label: 'Nederlands' },
  { code: 'pl', promptName: 'Polish', label: 'Polski' },
  { code: 'tr', promptName: 'Turkish', label: 'Türkçe' },
  { code: 'uk', promptName: 'Ukrainian', label: 'Українська' },
  { code: 'sv', promptName: 'Swedish', label: 'Svenska' },
  { code: 'cs', promptName: 'Czech', label: 'Čeština' },
  { code: 'ro', promptName: 'Romanian', label: 'Română' },
  { code: 'el', promptName: 'Greek', label: 'Ελληνικά' },
  { code: 'he', promptName: 'Hebrew', label: 'עברית' },
  { code: 'fa', promptName: 'Persian', label: 'فارسی' },
  { code: 'bn', promptName: 'Bengali', label: 'বাংলা' },
  { code: 'ur', promptName: 'Urdu', label: 'اردو' },
  { code: 'ta', promptName: 'Tamil', label: 'தமிழ்' },
  { code: 'ne', promptName: 'Nepali', label: 'नेपाली' },
]

const BY_CODE = new Map(DOCUMENT_TRANSLATE_LANGUAGES.map((row) => [row.code, row]))

export function documentTranslatePromptName(code: string | null | undefined): string {
  const key = String(code || '').trim()
  return BY_CODE.get(key)?.promptName || key
}

export function documentTranslateLanguagesByGroup(): {
  popular: DocumentTranslateLanguage[]
  other: DocumentTranslateLanguage[]
} {
  return {
    popular: DOCUMENT_TRANSLATE_LANGUAGES.filter((row) => row.popular),
    other: DOCUMENT_TRANSLATE_LANGUAGES.filter((row) => !row.popular),
  }
}
