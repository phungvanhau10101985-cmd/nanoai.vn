"""
Đục nền giấy phẳng của khung hoa theo mép cánh, kiểu Color Range + Refine Edge.
Giữ hoa (kể cả cánh trắng), xóa giấy ở lỗ giữa và mép ngoài. Không cắt hình chữ nhật.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

PAPER_BGR = np.array([234, 241, 244], dtype=np.float32)  # #F4F1EA


def lab_of(bgr: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)


def paper_lab(sample_bgr: np.ndarray) -> np.ndarray:
    return lab_of(sample_bgr.reshape(1, 1, 3))[0, 0]


def chroma(lab: np.ndarray) -> np.ndarray:
    return np.hypot(lab[:, :, 1] - 128.0, lab[:, :, 2] - 128.0)


def estimate_paper(lab: np.ndarray) -> np.ndarray:
    h, w = lab.shape[:2]
    cy, cx = h // 2, w // 2
    rh, rw = max(4, h // 18), max(4, w // 18)
    patch = lab[cy - rh : cy + rh, cx - rw : cx + rw].reshape(-1, 3)
    # Giấy gần như không màu. Bỏ điểm lệch (nhụy hoa rơi giữa).
    c = np.hypot(patch[:, 1] - 128.0, patch[:, 2] - 128.0)
    keep = patch[c < 14] if np.count_nonzero(c < 14) > 20 else patch
    return np.median(keep, axis=0)


def knock_paper(bgr: np.ndarray, flat_paper: bool = False) -> tuple[np.ndarray, dict]:
    h, w = bgr.shape[:2]
    lab = lab_of(bgr)
    paper = estimate_paper(lab)
    dist = np.sqrt(np.sum((lab - paper) ** 2, axis=2))
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    grad = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
    color = chroma(lab)

    if flat_paper:
        # Nền AI là một màu phẳng. Chỉ xóa đúng màu giấy, giữ cánh kể cả cánh trắng.
        paper_like = (dist < 12.0) | ((dist < 18.0) & (color < 8.0) & (grad < 3.5))
    else:
        # Giấy phẳng: gần màu giấy, ít biên, ít màu. Cánh trắng có biên hoặc nằm cạnh màu.
        flat = (dist < 16.0) & (grad < 9.0) & (color < 11.0)
        very_flat = (dist < 9.0) & (color < 14.0)
        paper_like = flat | very_flat
        # Nuốt quầng bóng mềm sát giấy, không ăn cánh có biên.
        fringe = (dist < 26.0) & (grad < 5.5) & (color < 9.0)
        paper_like = paper_like | fringe

    paper_u8 = paper_like.astype(np.uint8)
    # Khép lỗ kim trên giấy, không nối sang hoa.
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    paper_u8 = cv2.morphologyEx(paper_u8, cv2.MORPH_CLOSE, kernel, iterations=1)
    if flat_paper:
        # Ăn quầng giấy sát mép cánh. Không lan vào cánh có màu.
        fringe_ok = ((color < 16.0) & (dist < 34.0)).astype(np.uint8)
        grow = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        grown = cv2.dilate(paper_u8, grow, iterations=1)
        paper_u8 = np.where((grown > 0) & (fringe_ok > 0), np.uint8(1), paper_u8)

    num, labels = cv2.connectedComponents(paper_u8, connectivity=4)
    cy, cx = h // 2, w // 2
    remove = np.zeros((h, w), np.uint8)
    center_label = int(labels[cy, cx])
    if center_label != 0:
        remove[labels == center_label] = 255
    border_ids = np.unique(
        np.concatenate(
            [
                labels[0, :],
                labels[-1, :],
                labels[:, 0],
                labels[:, -1],
            ]
        )
    )
    for label_id in border_ids.tolist():
        if label_id:
            remove[labels == label_id] = 255

    # Lông vũ mép: 2px, không làm mờ cả cánh.
    keep = (remove == 0).astype(np.uint8)
    dist_keep = cv2.distanceTransform(keep, cv2.DIST_L2, 3)
    alpha = np.clip(dist_keep / 1.6, 0.0, 1.0)
    alpha[remove > 0] = 0.0
    alpha = cv2.GaussianBlur(alpha.astype(np.float32), (3, 3), 0.45)
    alpha = np.clip(alpha, 0.0, 1.0)
    alpha_u8 = (alpha * 255.0).astype(np.uint8)

    bgra = cv2.cvtColor(bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha_u8

    hole = measure_hole(alpha_u8)
    stats = {
        "width": w,
        "height": h,
        "paperLab": [round(float(v), 2) for v in paper.tolist()],
        "removedPct": round(float(np.mean(alpha_u8 < 16)) * 100, 2),
        "hole": hole,
    }
    return bgra, stats


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


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    flat_paper = "--flat" in sys.argv[3:]
    bgr = cv2.imread(str(src), cv2.IMREAD_COLOR)
    if bgr is None:
        raise SystemExit(f"Không đọc được {src}")
    bgra, stats = knock_paper(bgr, flat_paper=flat_paper)
    dst.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dst), bgra)
    preview = dst.with_name(dst.stem + "-on-rose.jpg")
    rose = np.full_like(bgr, (80, 60, 150))
    a = bgra[:, :, 3:4].astype(np.float32) / 255.0
    comp = (bgra[:, :, :3].astype(np.float32) * a + rose.astype(np.float32) * (1 - a)).astype(np.uint8)
    cv2.imwrite(str(preview), comp)
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
