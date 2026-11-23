import os
import sys
import time
import hashlib
import urllib.request

REPO = "ByteDance/SDXL-Lightning"
FILENAME = "sdxl_lightning_4step_unet.safetensors"
URL = f"https://huggingface.co/{REPO}/resolve/main/{FILENAME}"
EXPECTED_SHA256 = "39a90a8a2a25c1372633c1e8eb1a96f85eab937bcb58cfc6ec9baf66242ec23c"
EXPECTED_SIZE = 5135149736  # bytes

TARGET_DIR = os.path.join("models", "sdxl", "unet")
TARGET_PATH = os.path.join(TARGET_DIR, FILENAME)
TEMP_PATH = TARGET_PATH + ".part"

def download_and_verify():
    os.makedirs(TARGET_DIR, exist_ok=True)
    
    # Check if already downloaded and verified
    if os.path.exists(TARGET_PATH):
        local_size = os.path.getsize(TARGET_PATH)
        if local_size == EXPECTED_SIZE:
            print(f"[STAGE 1] Existing file found at {TARGET_PATH} ({local_size} bytes). Computing SHA-256...")
            h = hashlib.sha256()
            with open(TARGET_PATH, "rb") as f:
                while chunk := f.read(4 * 1024 * 1024):
                    h.update(chunk)
            digest = h.hexdigest().lower()
            if digest == EXPECTED_SHA256:
                print(f"[STAGE 1] Existing file matches official SHA-256 exactly: {digest}")
                return True, TARGET_PATH, local_size, digest
            else:
                print(f"[STAGE 1] Existing file hash mismatch ({digest} != {EXPECTED_SHA256}). Re-downloading.")
                os.remove(TARGET_PATH)
        else:
            print(f"[STAGE 1] Existing file size mismatch ({local_size} != {EXPECTED_SIZE}). Re-downloading.")
            os.remove(TARGET_PATH)

    print(f"[STAGE 1] Initiating download from: {URL}")
    print(f"[STAGE 1] Target destination: {TARGET_PATH}")
    print(f"[STAGE 1] Expected size: {EXPECTED_SIZE:,} bytes (~5.14 GB)")
    print(f"[STAGE 1] Expected SHA-256: {EXPECTED_SHA256}")

    req = urllib.request.Request(
        URL,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stage1Validator/1.0"}
    )

    start_time = time.time()
    last_log_time = start_time
    downloaded_bytes = 0
    sha256_hash = hashlib.sha256()

    with urllib.request.urlopen(req) as response, open(TEMP_PATH, "wb") as out_file:
        content_length = response.headers.get("Content-Length")
        total_size = int(content_length) if content_length else EXPECTED_SIZE
        print(f"[STAGE 1] Remote response received. Content-Length: {total_size:,} bytes.")

        chunk_size = 4 * 1024 * 1024  # 4 MB chunks (low RAM overhead)
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            sha256_hash.update(chunk)
            downloaded_bytes += len(chunk)

            now = time.time()
            if now - last_log_time >= 5.0 or downloaded_bytes == total_size:
                elapsed = now - start_time
                speed_mb = (downloaded_bytes / (1024 * 1024)) / max(elapsed, 0.001)
                percent = (downloaded_bytes / total_size) * 100.0 if total_size else 0
                print(f"[STAGE 1] Progress: {downloaded_bytes:,} / {total_size:,} bytes ({percent:.1f}%) - Speed: {speed_mb:.2f} MB/s")
                last_log_time = now

    if os.path.exists(TARGET_PATH):
        os.remove(TARGET_PATH)
    os.rename(TEMP_PATH, TARGET_PATH)

    final_size = os.path.getsize(TARGET_PATH)
    final_digest = sha256_hash.hexdigest().lower()
    total_time = time.time() - start_time
    avg_speed = (final_size / (1024 * 1024)) / max(total_time, 0.001)

    print("\n" + "=" * 60)
    print("[STAGE 1] DOWNLOAD COMPLETE")
    print(f"Total Time:    {total_time:.2f} seconds")
    print(f"Average Speed: {avg_speed:.2f} MB/s")
    print(f"Final Size:    {final_size:,} bytes")
    print(f"Expected Size: {EXPECTED_SIZE:,} bytes")
    print(f"Computed SHA:  {final_digest}")
    print(f"Expected SHA:  {EXPECTED_SHA256}")
    print("=" * 60)

    if final_size != EXPECTED_SIZE:
        print(f"[ERROR] Size mismatch: {final_size} != {EXPECTED_SIZE}")
        return False, TARGET_PATH, final_size, final_digest

    if final_digest != EXPECTED_SHA256:
        print(f"[ERROR] Hash mismatch: {final_digest} != {EXPECTED_SHA256}")
        return False, TARGET_PATH, final_size, final_digest

    print("[SUCCESS] SHA-256 and file size verified exactly.")
    return True, TARGET_PATH, final_size, final_digest

if __name__ == "__main__":
    success, path, size, digest = download_and_verify()
    if not success:
        sys.exit(1)
