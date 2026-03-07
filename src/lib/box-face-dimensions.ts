/** Trả về 3 mặt hộp (L×W, L×H, W×H) sắp xếp theo diện tích giảm dần: mặt 1 = lớn nhất, mặt 3 = nhỏ nhất */
export function getBoxFaceDimensions(boxLength: number, boxWidth: number, boxHeight: number): [number, number][] {
  const faces: { area: number; dims: [number, number] }[] = [
    { area: boxLength * boxWidth, dims: [boxLength, boxWidth] },
    { area: boxLength * boxHeight, dims: [boxLength, boxHeight] },
    { area: boxWidth * boxHeight, dims: [boxWidth, boxHeight] },
  ]
  faces.sort((a, b) => b.area - a.area)
  return faces.map((f) => f.dims)
}
