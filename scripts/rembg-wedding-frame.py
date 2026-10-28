"""Xóa nền giấy của khung hoa bằng rembg, giữ mép cánh. In thống kê lỗ giữa."""
from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rembg import remove
from scipy import ndimage


def measure_hole(alpha: np.ndarray) -> dict | None:
    h, w = alpha.shape[:2]
    clear = alpha <= 28
    cx, cy = w // 2, h // 2
    if not clear[cy, cx]:
        return None
    seen = np.zeros((h, w), np.uint8)
    stack = [(cx, cy)]
    seen[cy, cx] = 1
    minx = maxx = cx
    miny = maxy = cy
    touches = False
    count = 0
    while stack:
        x, y = stack.pop()
        count += 1
        if x < minx:
            minx = x
        if x > maxx:
            maxx = x
        if y < miny:
            miny = y
        if y > maxy:
            maxy = y
        if x == 0 or y == 0 or x == w - 1 or y == h - 1:
            touches = True
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h or seen[ny, nx] or not clear[ny, nx]:
                continue
            seen[ny, nx] = 1
            stack.append((nx, ny))
    box_w = (maxx - minx + 1) / w * 100
    box_h = (maxy - miny + 1) / h * 100
    return {
        "x": round(minx / w * 100, 2),
        "y": round(miny / h * 100, 2),
        "w": round(box_w, 2),
        "h": round(box_h, 2),
        "areaPct": round(count / (w * h) * 100, 2),
        "enclosed": (not touches) and box_w >= 18 and box_h >= 18 and count / (w * h) < 0.78,
    }


def seal_pinholes(alpha: np.ndarray) -> np.ndarray:
    """Khép khe hở mỏng trên vòng hoa để lỗ giữa không thủng ra mép. Không cắt chữ nhật."""
    out = alpha
    for radius in (3, 5, 9):
        keep = out > 28
        closed = ndimage.binary_closing(keep, structure=np.ones((radius, radius), dtype=bool))
        nxt = out.copy()
        nxt[closed & ~keep] = 255
        hole = measure_hole(nxt)
        out = nxt
        if hole and hole.get("enclosed"):
            break
    return out


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    raw = src.read_bytes()
    cut = remove(raw)
    image = Image.open(io.BytesIO(cut)).convert("RGBA")
    arr = np.array(image)
    arr[:, :, 3] = seal_pinholes(arr[:, :, 3])
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr, "RGBA").save(dst)
    hole = measure_hole(arr[:, :, 3])
    stats = {
        "width": int(arr.shape[1]),
        "height": int(arr.shape[0]),
        "removedPct": round(float(np.mean(arr[:, :, 3] < 16)) * 100, 2),
        "hole": hole,
    }
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
