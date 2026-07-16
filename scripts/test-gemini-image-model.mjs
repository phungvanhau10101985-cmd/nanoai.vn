import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
dotenv.config({ path: path.join(root, '.env.local') })
dotenv.config({ path: path.join(root, '.env') })

const apiKey = process.env.GOOGLE_API_KEY?.trim()
if (!apiKey) {
  console.error('FAIL: missing GOOGLE_API_KEY')
  process.exit(1)
}

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

async function testModel(modelId) {
  const started = Date.now()
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: '1K', aspectRatio: '1:1' },
      },
    })

    const result = await model.generateContent(
      'Generate a minimal flat icon: a solid red circle centered on a white square background. No text.',
      { safetySettings },
    )
    const response = result.response
    const parts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => 'inlineData' in p && p.inlineData?.data)
    const textPart = parts.find((p) => 'text' in p && p.text)

    return {
      ok: Boolean(imagePart),
      modelId,
      ms: Date.now() - started,
      hasImage: Boolean(imagePart),
      imageMime: imagePart && 'inlineData' in imagePart ? imagePart.inlineData?.mimeType ?? null : null,
      imageBytes:
        imagePart && 'inlineData' in imagePart && imagePart.inlineData?.data
          ? Buffer.from(imagePart.inlineData.data, 'base64').length
          : 0,
      textSnippet: textPart && 'text' in textPart ? String(textPart.text).slice(0, 120) : null,
      usage: response.usageMetadata ?? null,
      finishReason: response.candidates?.[0]?.finishReason ?? null,
      blockReason: response.promptFeedback?.blockReason ?? null,
    }
  } catch (err) {
    return {
      ok: false,
      modelId,
      ms: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

const models = ['gemini-3-pro-image', 'gemini-3-pro-image-preview']
console.log('Testing Gemini image models via generateContent...\n')

for (const modelId of models) {
  const r = await testModel(modelId)
  console.log(JSON.stringify(r, null, 2))
  console.log('')
}
