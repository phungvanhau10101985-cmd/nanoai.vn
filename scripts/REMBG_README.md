# rembg & Pillow – Tách nền (Tạo nhãn dán, Xóa nền PNG)

## Cài đặt

```bash
# Khuyến nghị: cài đủ cả rembg và Pillow
pip install -r scripts/requirements-rembg.txt

# Hoặc cài thủ công
pip install "rembg[cpu,cli]"
pip install pillow
```

**Yêu cầu:** Python 3.11+

## Kiểm tra

```bash
rembg --help
# hoặc
python -m rembg --help
```

## Xử lý lỗi

### "rembg lỗi" / spawn ENOENT

- **Windows:** Node có thể không tìm thấy `rembg` trong PATH. Code tự thử: `rembg` → `python -m rembg` → `py -m rembg`.
- **Override:** Thêm vào `.env.local`:
  ```
  REMBG_PYTHON=python
  # hoặc
  REMBG_PYTHON=py
  ```

### No module named 'rembg.__main__' (rembg 2.x)

rembg 2.x không còn `__main__.py`. Code đã dùng `python -m rembg.cli` thay vì `python -m rembg`.

### ModuleNotFoundError: No module named 'rembg'

```bash
pip install "rembg[cpu,cli]"
```

### Thiếu thư viện Pillow / No module named 'PIL' (Xóa nền PNG)

```bash
pip install pillow
```

### ModuleNotFoundError: No module named 'onnxruntime'

```bash
pip install onnxruntime
# hoặc cài lại rembg
pip install --force-reinstall "rembg[cpu,cli]"
```

### DLL load failed (Windows)

Cài [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist).

### Timeout

Mặc định 2 phút. Ảnh 4K có thể mất 30–60 giây. Lần chạy đầu rembg tải model (~176MB) nên chậm hơn.
