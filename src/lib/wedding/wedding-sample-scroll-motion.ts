/** Một lượt rê chuột đi hết dải thiệp. Giữ tốc độ này khi rê lại giữa chừng. */
export const WEDDING_SAMPLE_SCROLL_MS = 42_000

export const WEDDING_SAMPLE_SCROLL_RETURN_MS = 450

export function weddingSampleScrollTravel(imageHeight: number, frameHeight: number) {
  if (!Number.isFinite(imageHeight) || !Number.isFinite(frameHeight)) return 0
  return Math.max(0, imageHeight - frameHeight)
}

/** Phần còn lại đi cùng tốc độ với một lượt đủ `fullTravel` pixel trong `fullMs`. */
export function weddingSampleScrollDuration(remainPx: number, fullTravel: number, fullMs = WEDDING_SAMPLE_SCROLL_MS) {
  if (!(fullTravel > 0) || !(remainPx > 0) || !(fullMs > 0)) return 0
  return (remainPx / fullTravel) * fullMs
}
