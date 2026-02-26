import anyEn from './any__en.json'
import defaultConfig from './default.json'
import enJa from './en__ja.json'
import enKo from './en__ko.json'
import enZh from './en__zh.json'
import hiEn from './hi__en.json'
import jaEn from './ja__en.json'
import koEn from './ko__en.json'
import thJa from './th__ja.json'
import thEn from './th__en.json'
import viAny from './vi__any.json'
import viJa from './vi__ja.json'
import viKo from './vi__ko.json'
import viEn from './vi__en.json'
import viZh from './vi__zh.json'
import zhEn from './zh__en.json'
import type { CoachUiLocale, PairPromptConfig } from '../types'

const DEFAULT_PAIR_CONFIG = defaultConfig as PairPromptConfig

const pairConfigs: Record<string, PairPromptConfig> = {
  [DEFAULT_PAIR_CONFIG.key]: DEFAULT_PAIR_CONFIG,
  [viAny.key]: viAny as PairPromptConfig,
  [anyEn.key]: anyEn as PairPromptConfig,
  [viEn.key]: viEn as PairPromptConfig,
  [viZh.key]: viZh as PairPromptConfig,
  [viJa.key]: viJa as PairPromptConfig,
  [viKo.key]: viKo as PairPromptConfig,
  [enJa.key]: enJa as PairPromptConfig,
  [enKo.key]: enKo as PairPromptConfig,
  [enZh.key]: enZh as PairPromptConfig,
  [koEn.key]: koEn as PairPromptConfig,
  [jaEn.key]: jaEn as PairPromptConfig,
  [zhEn.key]: zhEn as PairPromptConfig,
  [thJa.key]: thJa as PairPromptConfig,
  [thEn.key]: thEn as PairPromptConfig,
  [hiEn.key]: hiEn as PairPromptConfig,
}

export function toLanguagePairKey(nativeLanguageCode: string, targetLanguageCode: string): string {
  return `${String(nativeLanguageCode || '').trim().toLowerCase()}__${String(targetLanguageCode || '').trim().toLowerCase()}`
}

export function getPairPromptConfig(nativeLanguageCode: string, targetLanguageCode: string): PairPromptConfig {
  const nativeCode = String(nativeLanguageCode || '').trim().toLowerCase()
  const targetCode = String(targetLanguageCode || '').trim().toLowerCase()
  const exactKey = toLanguagePairKey(nativeCode, targetCode)
  const nativeAnyKey = toLanguagePairKey(nativeCode, 'any')
  const anyTargetKey = toLanguagePairKey('any', targetCode)
  return pairConfigs[exactKey] || pairConfigs[nativeAnyKey] || pairConfigs[anyTargetKey] || DEFAULT_PAIR_CONFIG
}

export function getPairUiLocale(nativeLanguageCode: string): CoachUiLocale {
  const normalized = String(nativeLanguageCode || '').trim().toLowerCase()
  if (normalized === 'vi' || normalized === 'en' || normalized === 'zh' || normalized === 'ja' || normalized === 'ko' || normalized === 'th' || normalized === 'hi') {
    return normalized
  }
  return 'en'
}
