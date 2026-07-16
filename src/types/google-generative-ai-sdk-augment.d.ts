/**
 * Gemini JS SDK types chưa khai báo đủ field mà API preview (ảnh / an toàn) thực tế hỗ trợ.
 * Augment để TypeScript không báo lỗi ở các route/actions gọi gemini-3-pro-image.
 */
import '@google/generative-ai'

declare module '@google/generative-ai' {
  export interface GenerationConfig {
    responseModalities?: string[] | readonly string[]
    imageConfig?: { imageSize?: string; aspectRatio?: string }
  }

  export interface SingleRequestOptions {
    safetySettings?: unknown
  }
}
