import os
import sys
import time
import urllib.request
import shutil

BASE_REPO = "stabilityai/stable-diffusion-xl-base-1.0"
VAE_REPO = "madebyollin/sdxl-vae-fp16-fix"

DOWNLOAD_MANIFEST = [
    # Top-level & configs
    (BASE_REPO, "model_index.json", os.path.join("models", "sdxl", "model_index.json")),
    (BASE_REPO, "unet/config.json", os.path.join("models", "sdxl", "unet", "config.json")),
    (BASE_REPO, "scheduler/scheduler_config.json", os.path.join("models", "sdxl", "scheduler", "scheduler_config.json")),

    # Tokenizer 1
    (BASE_REPO, "tokenizer/tokenizer_config.json", os.path.join("models", "sdxl", "tokenizer", "tokenizer_config.json")),
    (BASE_REPO, "tokenizer/vocab.json", os.path.join("models", "sdxl", "tokenizer", "vocab.json")),
    (BASE_REPO, "tokenizer/merges.txt", os.path.join("models", "sdxl", "tokenizer", "merges.txt")),
    (BASE_REPO, "tokenizer/special_tokens_map.json", os.path.join("models", "sdxl", "tokenizer", "special_tokens_map.json")),

    # Tokenizer 2
    (BASE_REPO, "tokenizer_2/tokenizer_config.json", os.path.join("models", "sdxl", "tokenizer_2", "tokenizer_config.json")),
    (BASE_REPO, "tokenizer_2/vocab.json", os.path.join("models", "sdxl", "tokenizer_2", "vocab.json")),
    (BASE_REPO, "tokenizer_2/merges.txt", os.path.join("models", "sdxl", "tokenizer_2", "merges.txt")),
    (BASE_REPO, "tokenizer_2/special_tokens_map.json", os.path.join("models", "sdxl", "tokenizer_2", "special_tokens_map.json")),

    # Text Encoder 1 (CLIP-L FP16)
    (BASE_REPO, "text_encoder/config.json", os.path.join("models", "sdxl", "text_encoder", "config.json")),
    (BASE_REPO, "text_encoder/model.fp16.safetensors", os.path.join("models", "sdxl", "text_encoder", "model.fp16.safetensors")),

    # Text Encoder 2 (OpenCLIP-G FP16)
    (BASE_REPO, "text_encoder_2/config.json", os.path.join("models", "sdxl", "text_encoder_2", "config.json")),
    (BASE_REPO, "text_encoder_2/model.fp16.safetensors", os.path.join("models", "sdxl", "text_encoder_2", "model.fp16.safetensors")),

    # Fixed FP16 VAE (madebyollin)
    (VAE_REPO, "config.json", os.path.join("models", "sdxl", "vae", "config.json")),
    (VAE_REPO, "diffusion_pytorch_model.safetensors", os.path.join("models", "sdxl", "vae", "diffusion_pytorch_model.safetensors")),
]

def download_file(repo, subpath, target_path):
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    temp_path = target_path + ".part"

    url = f"https://huggingface.co/{repo}/resolve/main/{subpath}"
    
    # Check if already present and valid
    if os.path.exists(target_path):
        size = os.path.getsize(target_path)
        if size > 0:
            print(f"[EXISTS] {target_path} ({size:,} bytes) - Skipping.")
            return True, size

    print(f"\n[DOWNLOADING] {subpath} from {repo}...")
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Stage2Downloader/1.0"}
    )

    start_time = time.time()
    try:
        with urllib.request.urlopen(req) as response, open(temp_path, "wb") as out_file:
            content_length = response.headers.get("Content-Length")
            total_size = int(content_length) if content_length else 0
            
            downloaded = 0
            chunk_size = 2 * 1024 * 1024  # 2 MB buffer
            last_log = time.time()

            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                out_file.write(chunk)
                downloaded += len(chunk)

                now = time.time()
                if now - last_log >= 3.0 or downloaded == total_size:
                    speed = (downloaded / (1024 * 1024)) / max(now - start_time, 0.001)
                    pct = (downloaded / total_size) * 100.0 if total_size else 0
                    print(f"  Progress: {downloaded:,} / {total_size:,} bytes ({pct:.1f}%) - Speed: {speed:.2f} MB/s")
                    last_log = now

        if os.path.exists(target_path):
            os.remove(target_path)
        os.rename(temp_path, target_path)

        final_size = os.path.getsize(target_path)
        elapsed = time.time() - start_time
        print(f"[DONE] {target_path} ({final_size:,} bytes) in {elapsed:.2f}s")
        return True, final_size

    except Exception as e:
        print(f"[ERROR] Failed downloading {subpath}: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return False, 0

def run_auxiliary_download():
    print("=" * 70)
    print("STAGE 2 - AUXILIARY MODEL COMPONENT DOWNLOAD")
    print("=" * 70)

    total_downloaded_bytes = 0
    results = []

    os.makedirs("test_outputs", exist_ok=True)

    for repo, subpath, target_path in DOWNLOAD_MANIFEST:
        success, size = download_file(repo, subpath, target_path)
        if not success:
            print(f"\n[FATAL] Failed to download {subpath}. Halting.")
            return False, results
        results.append((target_path, size))
        total_downloaded_bytes += size

    print("\n" + "=" * 70)
    print(f"STAGE 2 DOWNLOAD COMPLETED: {len(results)} files verified.")
    print(f"Total Auxiliary Storage: {total_downloaded_bytes / (1024**3):.2f} GB ({total_downloaded_bytes:,} bytes)")
    print("=" * 70)
    return True, results

if __name__ == "__main__":
    success, res = run_auxiliary_download()
    sys.exit(0 if success else 1)
