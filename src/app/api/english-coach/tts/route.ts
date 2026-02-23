import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

type VoiceName =
  | 'Kore'
  | 'Puck'
  | 'Zephyr'
  | 'Autonoe'
  | 'Enceladus'
  | 'Sadachbia'

type Payload = {
  text?: string
  voiceName?: VoiceName
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Thiếu GOOGLE_API_KEY.' }, { status: 500 })
    }

    const payload = (await request.json()) as Payload
    const text = String(payload.text || '').trim()
    const voiceName = (payload.voiceName || 'Kore') as VoiceName
    if (!text) {
      return NextResponse.json({ error: 'Thiếu văn bản cần đọc.' }, { status: 400 })
    }

    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: text,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName,
            },
          },
        },
      },
    })

    const candidate = response?.candidates?.[0]
    const part = candidate?.content?.parts?.[0]
    const b64 = typeof part?.inlineData?.data === 'string' ? part.inlineData.data : ''
    if (!b64) {
      return NextResponse.json({ error: 'Không nhận được dữ liệu âm thanh từ Gemini TTS.' }, { status: 502 })
    }

    return NextResponse.json({
      audioBase64: b64,
      mimeType: part?.inlineData?.mimeType || 'audio/wav',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

