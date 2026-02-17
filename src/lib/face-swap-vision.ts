/**
 * Hoán đổi khuôn mặt: Vision định vị mặt → xóa mặt ảnh đích → AI ghép mặt.
 * Dùng Google Cloud Vision API để định vị khuôn mặt trên ảnh đích.
 */

import sharp from 'sharp'
import { visionAnnotate, hasVisionConfig } from './vision-api'

const VISION_SUPPORTED = new Set(['jpeg', 'jpg', 'png', 'gif', 'bmp', 'webp'])

interface FaceVertex { x?: number; y?: number }
interface FaceAnnotation {
  boundingPoly?: { vertices?: FaceVertex[] }
  fdBoundingPoly?: { vertices?: FaceVertex[] }
}

interface VisionFaceResponse {
  responses?: Array<{ faceAnnotations?: FaceAnnotation[] }> 
}

export interface FaceBbox {
  x: number
  y: number
  w: number
  h: number
  /** Mô tả vị trí cho prompt (VD: "face at center, upper third") */
  positionHint: string
}

async function ensureVisionFormat(buffer: Buffer): Promise<Buffer> {
  const meta = await sharp(buffer).metadata()
  const fmt = (meta.format ?? '').toLowerCase()
  if (VISION_SUPPORTED.has(fmt)) return buffer
  return sharp(buffer).png().toBuffer()
}

/**
 * Định vị khuôn mặt trên ảnh đích bằng Vision API.
 * Trả về bbox mặt chính (lớn nhất) hoặc null nếu không có mặt / chưa cấu hình Vision.
 */
export async function detectFaceInTargetImage(targetBuffer: Buffer): Promise<FaceBbox | null> {
  if (!hasVisionConfig()) return null

  const buf = await ensureVisionFormat(targetBuffer)
  const data = await visionAnnotate(buf, [{ type: 'FACE_DETECTION', maxResults: 5 }]) as VisionFaceResponse
  const faces = data.responses?.[0]?.faceAnnotations ?? []
  if (!faces.length) {
    console.log('[FaceSwap-Vision] Không phát hiện mặt trong ảnh đích')
    return null
  }

  const meta = await sharp(buf).metadata()
  const imgW = meta.width ?? 0
  const imgH = meta.height ?? 0
  if (imgW <= 0 || imgH <= 0) return null

  // Chọn mặt lớn nhất (fdBoundingPoly chính xác hơn boundingPoly)
  let bestFace: FaceAnnotation | null = null
  let bestArea = 0

  for (const face of faces) {
    const poly = face.fdBoundingPoly ?? face.boundingPoly
    const verts = poly?.vertices ?? []
    if (verts.length < 3) continue

    const xs = verts.map((v) => v.x ?? 0).filter((x) => x >= 0)
    const ys = verts.map((v) => v.y ?? 0).filter((y) => y >= 0)
    if (!xs.length || !ys.length) continue

    const x1 = Math.max(0, Math.min(...xs) - 15)
    const x2 = Math.min(imgW, Math.max(...xs) + 15)
    const y1 = Math.max(0, Math.min(...ys) - 15)
    const y2 = Math.min(imgH, Math.max(...ys) + 15)
    const area = (x2 - x1) * (y2 - y1)
    if (area > bestArea) {
      bestArea = area
      bestFace = face
    }
  }

  if (!bestFace) return null

  const poly = bestFace.fdBoundingPoly ?? bestFace.boundingPoly
  const verts = poly?.vertices ?? []
  const xs = verts.map((v) => v.x ?? 0).filter((x) => x >= 0)
  const ys = verts.map((v) => v.y ?? 0).filter((y) => y >= 0)
  if (!xs.length || !ys.length) return null

  const padding = 20
  const x = Math.max(0, Math.min(...xs) - padding)
  const y = Math.max(0, Math.min(...ys) - padding)
  const x2 = Math.min(imgW, Math.max(...xs) + padding)
  const y2 = Math.min(imgH, Math.max(...ys) + padding)
  const w = x2 - x
  const h = y2 - y

  const centerX = (x + x2) / 2 / imgW
  const centerY = (y + y2) / 2 / imgH
  let positionHint = 'face at center'
  if (centerY < 0.35) positionHint = 'face in upper third, centered'
  else if (centerY < 0.55) positionHint = 'face in upper half, centered'
  else positionHint = 'face in lower half, centered'

  console.log('[FaceSwap-Vision] Phát hiện mặt:', { x, y, w, h, hint: positionHint })
  return { x, y, w, h, positionHint }
}

/**
 * Cắt lấy vùng mặt từ ảnh nguồn (ảnh cần ghép lên).
 * Trả về buffer ảnh chỉ chứa khuôn mặt, hoặc null nếu không phát hiện mặt.
 */
export async function extractFaceFromSourceImage(sourceBuffer: Buffer): Promise<Buffer | null> {
  if (!hasVisionConfig()) return null

  const buf = await ensureVisionFormat(sourceBuffer)
  const data = await visionAnnotate(buf, [{ type: 'FACE_DETECTION', maxResults: 5 }]) as VisionFaceResponse
  const faces = data.responses?.[0]?.faceAnnotations ?? []
  if (!faces.length) {
    console.log('[FaceSwap-Vision] Không phát hiện mặt trong ảnh nguồn')
    return null
  }

  const meta = await sharp(buf).metadata()
  const imgW = meta.width ?? 0
  const imgH = meta.height ?? 0
  if (imgW <= 0 || imgH <= 0) return null

  let bestFace: FaceAnnotation | null = null
  let bestArea = 0

  for (const face of faces) {
    const poly = face.fdBoundingPoly ?? face.boundingPoly
    const verts = poly?.vertices ?? []
    if (verts.length < 3) continue

    const xs = verts.map((v) => v.x ?? 0).filter((x) => x >= 0)
    const ys = verts.map((v) => v.y ?? 0).filter((y) => y >= 0)
    if (!xs.length || !ys.length) continue

    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    if (area > bestArea) {
      bestArea = area
      bestFace = face
    }
  }

  if (!bestFace) return null

  const poly = bestFace.fdBoundingPoly ?? bestFace.boundingPoly
  const verts = poly?.vertices ?? []
  const xs = verts.map((v) => v.x ?? 0).filter((x) => x >= 0)
  const ys = verts.map((v) => v.y ?? 0).filter((y) => y >= 0)
  if (!xs.length || !ys.length) return null

  const padding = 25
  const left = Math.max(0, Math.min(...xs) - padding)
  const top = Math.max(0, Math.min(...ys) - padding)
  const right = Math.min(imgW, Math.max(...xs) + padding)
  const bottom = Math.min(imgH, Math.max(...ys) + padding)
  const width = right - left
  const height = bottom - top

  if (width <= 0 || height <= 0) return null

  const cropped = await sharp(buf)
    .extract({ left, top, width, height })
    .png()
    .toBuffer()

  console.log('[FaceSwap-Vision] Đã cắt mặt từ ảnh nguồn:', { left, top, width, height })
  return cropped
}
