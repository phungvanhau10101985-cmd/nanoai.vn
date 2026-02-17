'use client'

/** Xóa mặt người mẫu khỏi ảnh sản phẩm dùng MediaPipe Face Detection - chạy trên browser */

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

let faceDetectorPromise: Promise<import('@mediapipe/tasks-vision').FaceDetector> | null = null

async function getFaceDetector() {
  if (typeof window === 'undefined') return null
  if (!faceDetectorPromise) {
    faceDetectorPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision')
      const wasm = await vision.FilesetResolver.forVisionTasks(WASM_URL)
      return vision.FaceDetector.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: MODEL_URL },
        minDetectionConfidence: 0.25,
      })
    })()
  }
  return faceDetectorPromise
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không thể tải ảnh'))
    }
    img.src = url
  })
}

function blobToFile(blob: Blob, fileName: string, mimeType: string): File {
  return new File([blob], fileName, { type: mimeType })
}

/**
 * Cắt ảnh sản phẩm - chỉ giữ phần từ cổ xuống, bỏ hẳn phần mặt.
 * Nếu không nhận diện được mặt → fallback cắt 28% trên (vùng mặt thường nằm ở đây).
 */
export async function removeFaceFromImage(file: File): Promise<File> {
  if (typeof window === 'undefined') return file

  try {
    const detector = await getFaceDetector()
    if (!detector) return file

    const img = await loadImage(file)
    const result = detector.detect(img)

    const w = img.naturalWidth
    const h = img.naturalHeight

    let neckY: number
    if (result.detections?.length) {
      neckY = 0
      for (const det of result.detections) {
        const box = det.boundingBox
        if (!box) continue
        neckY = Math.max(neckY, box.originY + box.height)
      }
    } else {
      neckY = Math.floor(h * 0.28)
    }

    const cropH = h - neckY
    if (cropH <= 0) return file

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = cropH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(img, 0, neckY, w, cropH, 0, 0, w, cropH)

    const pngName = file.name.replace(/\.[^.]+$/i, '.png')
    return new Promise<File>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blobToFile(blob, pngName, 'image/png'))
          } else {
            resolve(file)
          }
        },
        'image/png',
        1
      )
    })
  } catch {
    return file
  }
}

/**
 * Xử lý nhiều ảnh, trả về ảnh đã xóa mặt (hoặc gốc nếu lỗi).
 */
export async function removeFaceFromImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(removeFaceFromImage))
}
