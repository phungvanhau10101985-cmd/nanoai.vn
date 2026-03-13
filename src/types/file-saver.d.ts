declare module 'file-saver' {
  export function saveAs(blob: Blob | File | string, filename?: string): void
}
