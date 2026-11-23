import os
import sys
import time
import hashlib
import urllib.request

REPO = "h94/IP-Adapter-FaceID"
TARGET_DIR = os.path.join("models", "sdxl", "ip_adapter")

FILES = [
    (
        "ip-adapter-faceid-plusv2_sdxl.bin",
        1487555181,
        "c6945d82b543700cc3ccbb98d363b837e9c596281607857c74b713a876daf5fb"
    ),
    (
        "ip-adapter-faceid-plusv2_sdxl_lora.safetensors",
        371842896,
        "f24b4bb2dad6638a09c00f151cde84991baf374409385bcbab53c1871a30cb7b"
    )
]

def download_and_verify_file(filename, expected_size, expected_sha):
    os.makedirs(TARGET_DIR, exist_ok=True)
    target_path = os.path.join(TARGET_DIR, filename)
    temp_path = target_path + ".part"

    if os.path.exists(target_path):
        size = os.path.getsize(target_path)
        if size == expected_size:
            print(f"[EXISTS] {filename} found ({size:,} bytes). Computing SHA-256...")
            h = hashlib.sha256()
            with open(target_path, "rb") as f:
                while chunk := f.read(4 * 1024 * 1024):
                    h.update(chunk)
            digest = h.hexdigest().lower()
            if digest == expected_sha:
                print(f"[VERIFIED] {filename} matches official SHA-256 exactly.")
                return True, size, digest
            else:
                print(f"[MISMATCH] {filename} hash mismatch. Re-downloading.")
                os.remove(target_path)
        else:
            print(f"[MISMATCH] {filename} size mismatch ({size} != {expected_size}). Re-downloading.")
            os.remove(target_path)

    url = f"https://huggingface.co/{REPO}/resolve/main/{filename}"
    print(f"\n[DOWNLOADING] {filename} from {REPO}...")
    print(f"  URL: {url}")
    print(f"  Expected Size: {expected_size:,} bytes")
    print(f"  Expected SHA:  {expected_sha}")

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stage2FaceIDDownloader/1.0"}
    )

    start_time = time.time()
    sha_hash = hashlib.sha256()
    downloaded = 0
    last_log = time.time()

    with urllib.request.urlopen(req) as response, open(temp_path, "wb") as out_file:
        content_length = response.headers.get("Content-Length")
        total_size = int(content_length) if content_length else expected_size
        chunk_size = 4 * 1024 * 1024  # 4 MB chunks

        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            sha_hash.update(chunk)
            downloaded += len(chunk)

            now = time.time()
            if now - last_log >= 4.0 or downloaded == total_size:
                speed = (downloaded / (1024 * 1024)) / max(now - start_time, 0.001)
                pct = (downloaded / total_size) * 100.0 if total_size else 0
                print(f"  Progress: {downloaded:,} / {total_size:,} bytes ({pct:.1f}%) - Speed: {speed:.2f} MB/s")
                last_log = now

    if os.path.exists(target_path):
        os.remove(target_path)
    os.rename(temp_path, target_path)

    final_size = os.path.getsize(target_path)
    final_sha = sha_hash.hexdigest().lower()
    elapsed = time.time() - start_time
    avg_speed = (final_size / (1024 * 1024)) / max(elapsed, 0.001)

    print(f"[COMPLETE] {filename} downloaded in {elapsed:.2f}s (Avg Speed: {avg_speed:.2f} MB/s)")
    print(f"  Final Size:   {final_size:,} bytes")
    print(f"  Computed SHA: {final_sha}")
    print(f"  Expected SHA: {expected_sha}")

    if final_size != expected_size:
        print(f"[ERROR] Size mismatch: {final_size} != {expected_size}")
        return False, final_size, final_sha

    if final_sha != expected_sha:
        print(f"[ERROR] SHA-256 mismatch: {final_sha} != {expected_sha}")
        return False, final_size, final_sha

    print(f"[PASS] {filename} verified authentic and uncorrupted.\n")
    return True, final_size, final_sha

def main():
    print("=" * 70)
    print("SDXL IP-ADAPTER FACEID PLUSV2 ISOLATED DOWNLOAD")
    print("=" * 70)

    for filename, expected_size, expected_sha in FILES:
        success, size, sha = download_and_verify_file(filename, expected_size, expected_sha)
        if not success:
            print(f"[FATAL] Failed to verify {filename}. Halting.")
            sys.exit(1)

    print("=" * 70)
    print("ALL SDXL FACEID PLUSV2 COMPONENTS SUCCESSFULLY DOWNLOADED & VERIFIED")
    print("=" * 70)

if __name__ == "__main__":
    main()
