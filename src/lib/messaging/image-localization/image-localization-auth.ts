import {
  imageLocAiExplicitOnly,
  imageLocAiJobsAllowed,
  imageLocDefaultGeminiMode,
  imageLocGeminiDefaultImageSize,
  imageLocGeminiImageModel,
  imageLocOpenaiDefaultQuality,
  imageLocOpenaiImageModel,
} from './image-localization-config'
import { deepseekOffPeakOnlyEnvDefault, deepseekPricingForAdmin } from './deepseek-pricing'
import { geminiApiAuth } from './gemini-adapter'
import { openaiApiAuth } from './openai-adapter'
import type { ImageLocAuthStatus } from './image-localization-types'

export function buildImageLocAuthStatus(offPeakOnlyEnabled: boolean): ImageLocAuthStatus {
  return {
    ai_image_jobs_allowed: imageLocAiJobsAllowed(),
    default_gemini_mode: imageLocDefaultGeminiMode(),
    image_model: imageLocGeminiImageModel(),
    gemini_api_default_image_size: imageLocGeminiDefaultImageSize(),
    openai_image_model: imageLocOpenaiImageModel(),
    openai_default_image_quality: imageLocOpenaiDefaultQuality(),
    ai_image_explicit_only: imageLocAiExplicitOnly(),
    gemini_api_image_sizes: ['2K', '4K'],
    openai_image_qualities: ['high', 'auto'],
    openai_image_sizes: ['auto', '1024x1792', '1792x1024', '1536x1024', '1024x1536'],
    api: geminiApiAuth(),
    openai: openaiApiAuth(),
    deepseek_pricing: deepseekPricingForAdmin({
      offPeakOnlyEnabled,
      envDefault: deepseekOffPeakOnlyEnvDefault(),
    }),
  }
}
