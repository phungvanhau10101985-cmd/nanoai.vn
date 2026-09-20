/** POST multipart Excel kho — có % upload (fetch không hỗ trợ). Dùng chung trang cào + Kho hàng. */

export function postPartnerInventoryExcelImport(
  url: string,
  formData: FormData,
  onProgress: (info: { percent: number | null }) => void,
  signal?: AbortSignal
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    const onAbort = () => {
      xhr.abort()
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress({ percent: Math.min(99, Math.round((100 * ev.loaded) / ev.total)) })
      } else {
        onProgress({ percent: null })
      }
    }
    xhr.upload.onloadend = () => onProgress({ percent: null })
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText ?? '',
      })
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    xhr.send(formData)
  })
}

export type PartnerInventoryExcelImportResult = {
  ok?: boolean
  count?: number
  inserted?: number
  updated?: number
  deleted?: number
  warnings?: unknown[]
  warnings_count?: number
  error?: string
  detail?: string
}

export function parsePartnerInventoryExcelImportResponse(text: string): PartnerInventoryExcelImportResult {
  try {
    return JSON.parse(text) as PartnerInventoryExcelImportResult
  } catch {
    return {}
  }
}
