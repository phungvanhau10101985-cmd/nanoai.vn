#!/usr/bin/env python3
"""
Import Viet-Doc-VQA-flash2 từ Hugging Face vào worksheet_official_questions.
Dùng Postgres trực tiếp qua DATABASE_URL (thư viện psycopg2).

Cài đặt: pip install -r scripts/requirements-import-viet-doc-vqa.txt
Chạy: python scripts/import-viet-doc-vqa.py

Yêu cầu: .env.local có HUGGINGFACE_TOKEN và DATABASE_URL (cùng chuỗi kết nối như app Next).
Bước 1: Chấp nhận điều khoản tại https://huggingface.co/datasets/5CD-AI/Viet-Doc-VQA-flash2
"""

import os
import re
import json
import tempfile
from pathlib import Path

# Load .env.local
env_path = Path(__file__).resolve().parent.parent / ".env.local"
if not env_path.exists():
    print("Không tìm thấy .env.local")
    exit(1)

env = {}
with open(env_path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            v = v.strip().strip('"\'')
            env[k.strip()] = v

hf_token = env.get("HUGGINGFACE_TOKEN", "").strip()
database_url = env.get("DATABASE_URL", "").strip()

if not hf_token:
    print("Thiếu HUGGINGFACE_TOKEN trong .env.local")
    exit(1)
if not database_url:
    print("Thiếu DATABASE_URL trong .env.local (Postgres trực tiếp, giống app).")
    exit(1)

import requests
import pyarrow.parquet as pq
import psycopg2
from psycopg2.extras import Json

INSERT_SQL = """
INSERT INTO public.worksheet_official_questions (
  subject_id, grade_level_id, textbook_set_id, lesson_order,
  question_text, options, correct_index, explanation, source, external_id
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (source, external_id) DO NOTHING
"""


def insert_official_question(cur, rec: dict) -> bool:
    """Trả True nếu insert được 1 dòng mới."""
    cur.execute(
        INSERT_SQL,
        (
            rec["subject_id"],
            rec["grade_level_id"],
            rec["textbook_set_id"],
            rec["lesson_order"],
            rec["question_text"],
            Json(rec["options"]),
            rec["correct_index"],
            rec["explanation"],
            rec["source"],
            rec["external_id"],
        ),
    )
    return cur.rowcount > 0

REPO = "5CD-AI/Viet-Doc-VQA-flash2"
HF_API = "https://huggingface.co/api"
HF_CDN = "https://huggingface.co/datasets"
MAX_ROWS = int(os.environ.get("VIET_DOC_VQA_MAX_ROWS", "5000"))
DRY_RUN = "--dry-run" in os.sys.argv


def infer_subject(text: str) -> str:
    t = text.lower()
    if re.search(r"\b(toán|số|phương trình|hàm|tích phân|đạo hàm)\b", t):
        return "toan"
    if re.search(r"\b(vật lý|lực|điện|quang)\b", t):
        return "vat-ly"
    if re.search(r"\b(hóa học|phản ứng|nguyên tố)\b", t):
        return "hoa-hoc"
    if re.search(r"\b(sinh học|tế bào|di truyền)\b", t):
        return "sinh-hoc"
    if re.search(r"\b(lịch sử|chiến tranh|triều đại)\b", t):
        return "lich-su"
    if re.search(r"\b(địa lý|bản đồ|khí hậu)\b", t):
        return "dia-ly"
    if re.search(r"\b(tiếng anh|english|verb|noun)\b", t):
        return "tieng-anh"
    if re.search(r"\b(ngữ văn|văn học|thơ|truyện)\b", t):
        return "ngu-van"
    return "khac"


def extract_qa_pairs(conversations):
    pairs = []
    if not isinstance(conversations, (list, tuple)):
        return pairs
    last_user = None
    for turn in conversations:
        if not isinstance(turn, dict):
            continue
        role = (turn.get("role") or turn.get("from") or "").lower()
        content = str(turn.get("content") or turn.get("value") or "").strip()
        if not content:
            continue
        if role in ("user", "human"):
            last_user = content
        elif role in ("assistant", "gpt") and last_user:
            pairs.append({"question": last_user, "answer": content})
            last_user = None
    return pairs


def list_repo_files(repo: str) -> list:
    """Liệt kê file parquet trong repo qua HF API."""
    def _list(path: str) -> list:
        url = f"{HF_API}/datasets/{repo}/tree/main"
        if path:
            url += f"/{path}"
        r = requests.get(url, headers={"Authorization": f"Bearer {hf_token}"}, timeout=30)
        if r.status_code != 200:
            return []
        out = []
        for item in r.json():
            p = f"{path}/{item['path']}" if path else item["path"]
            if item.get("type") == "directory":
                out.extend(_list(p))
            elif p.endswith(".parquet"):
                out.append(p)
        return out
    return _list("")


def download_parquet(repo: str, path: str) -> bytes:
    url = f"{HF_CDN}/{repo}/resolve/main/{path}"
    r = requests.get(url, headers={"Authorization": f"Bearer {hf_token}"}, timeout=120)
    if r.status_code != 200:
        raise Exception(f"Download {path} failed: {r.status_code}")
    return r.content


def main():
    print("Đang tải Viet-Doc-VQA-flash2 từ Hugging Face (gated)...")
    if DRY_RUN:
        print("  [DRY-RUN] Chỉ xem cấu trúc, không insert.")

    try:
        files = list_repo_files(REPO)
    except Exception as e:
        print(f"Lỗi: {e}")
        print("Kiểm tra: 1) Đã chấp nhận điều khoản chưa? 2) Token còn hiệu lực?")
        exit(1)

    parquet_files = [f for f in files if f.endswith(".parquet")]
    if not parquet_files:
        print("API không trả parquet. Thử đường dẫn mặc định...")
        parquet_files = [
            "data/train-00000-of-00001.parquet",
            "train-00000-of-00001.parquet",
            "train/0000.parquet",
        ]

    print(f"Tìm thấy {len(parquet_files)} file parquet.")

    imported = 0
    skipped = 0
    row_count = 0

    conn = None
    cur = None
    if not DRY_RUN:
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        try:
            cur.execute("SET LOCAL row_security = off")
        except Exception:
            pass

    for pf in parquet_files:
        if row_count >= MAX_ROWS:
            break
        try:
            content = download_parquet(REPO, pf)
        except Exception as e:
            print(f"  Bỏ qua {pf}: {e}")
            continue

        with tempfile.NamedTemporaryFile(suffix=".parquet", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            table = pq.read_table(tmp_path)
            df = table.to_pandas()
        finally:
            os.unlink(tmp_path)

        col_conv = "conversations" if "conversations" in df.columns else "QnA"
        if col_conv not in df.columns:
            cols = [c for c in df.columns if "conversation" in c.lower() or "qn" in c.lower()]
            col_conv = cols[0] if cols else None
        if not col_conv:
            print(f"  Bỏ qua {pf}: không có cột Q&A. Cột: {list(df.columns)}")
            continue

        col_desc = "description" if "description" in df.columns else "Description"
        if col_desc not in df.columns:
            col_desc = None

        for idx, row in df.iterrows():
            if row_count >= MAX_ROWS:
                break

            conv = row.get(col_conv)
            if isinstance(conv, str):
                try:
                    conv = json.loads(conv)
                except json.JSONDecodeError:
                    skipped += 1
                    continue

            desc = str(row.get(col_desc, "") or "").strip() if col_desc else ""
            pairs = extract_qa_pairs(conv)

            for i, pair in enumerate(pairs):
                q = pair.get("question", "").strip()
                a = pair.get("answer", "").strip()
                if not q or not a or len(q) < 10:
                    skipped += 1
                    continue

                subject = infer_subject(q + " " + desc)
                external_id = f"viet_doc_vqa_{pf.replace('/', '_')}_{idx}_{i}"

                rec = {
                    "subject_id": subject,
                    "grade_level_id": "lop-6",
                    "textbook_set_id": "ket-noi-tri-thuc",
                    "lesson_order": None,
                    "question_text": q,
                    "options": [a],
                    "correct_index": 0,
                    "explanation": None,
                    "source": "viet_doc_vqa",
                    "external_id": external_id,
                }

                if DRY_RUN and imported == 0:
                    print("Mẫu record:", json.dumps(rec, ensure_ascii=False, indent=2))

                if not DRY_RUN and cur is not None:
                    try:
                        if insert_official_question(cur, rec):
                            imported += 1
                        else:
                            skipped += 1
                    except Exception as ex:
                        if "23505" not in str(ex):
                            print(f"  Lỗi: {ex}")
                        skipped += 1
                elif DRY_RUN:
                    imported += 1

            row_count += 1
            if row_count % 500 == 0:
                print(f"  Đã xử lý {row_count} dòng, import {imported}, bỏ qua {skipped}")

    if conn is not None:
        conn.commit()
        cur.close()
        conn.close()

    print(f"\nHoàn thành. Tổng import: {imported}, bỏ qua: {skipped}")
    if DRY_RUN:
        print("Chạy không có --dry-run để thực sự import.")


if __name__ == "__main__":
    main()
