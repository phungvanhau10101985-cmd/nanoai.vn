#!/usr/bin/env python3
"""
In nội dung file SQL và gợi ý chạy trên Postgres (SQL Editor, psql, pgAdmin).
Không nhúng URL hay key — dùng DATABASE_URL trong môi trường của bạn.

Usage:
  python run_migration.py
  python run_migration.py migrations/create_payments_table.sql
"""
from __future__ import annotations

import sys
from pathlib import Path

DEFAULT_SQL = Path("migrations/create_payments_table.sql")


def main() -> int:
    path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(DEFAULT_SQL).resolve()
    if not path.is_file():
        print(f"Không thấy file: {path}")
        return 1

    sql = path.read_text(encoding="utf-8")
    print("=" * 60)
    print("Chạy đoạn SQL dưới đây trên database của bạn.")
    print("Ví dụ (Unix):  psql \"$DATABASE_URL\" -f", path.name)
    print("(Đặt DATABASE_URL trong shell hoặc .env — không commit secret.)")
    print("=" * 60)
    print(sql.rstrip() + "\n")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
