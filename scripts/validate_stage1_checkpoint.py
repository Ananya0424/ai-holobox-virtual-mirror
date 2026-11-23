import os
import sys
import time
import hashlib
import psutil
from safetensors import safe_open
import torch
from accelerate import init_empty_weights
from diffusers import UNet2DConditionModel

CHECKPOINT_PATH = os.path.join("models", "sdxl", "unet", "sdxl_lightning_4step_unet.safetensors")
OFFICIAL_SHA256 = "39a90a8a2a25c1372633c1e8eb1a96f85eab937bcb58cfc6ec9baf66242ec23c"
OFFICIAL_SIZE = 5135149736  # bytes

def get_process_ram_mb():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def get_system_avail_ram_gb():
    return psutil.virtual_memory().available / (1024**3)

def run_tier_a_validation():
    print("=" * 70)
    print("STAGE 1 - TIER A LOW-MEMORY VALIDATION REPORT")
    print("=" * 70)

    initial_ram = get_process_ram_mb()
    print(f"[MEMORY TELEMETRY] Initial Python Process Working Set: {initial_ram:.2f} MB")

    # 1. Physical File Verification
    if not os.path.exists(CHECKPOINT_PATH):
        print(f"[FAIL] Checkpoint not found at: {CHECKPOINT_PATH}")
        return False

    actual_size = os.path.getsize(CHECKPOINT_PATH)
    print(f"\n[1. FILE SIZE CHECK]")
    print(f"    Target Path:       {CHECKPOINT_PATH}")
    print(f"    Actual Size:       {actual_size:,} bytes ({actual_size / (1024**3):.3f} GB)")
    print(f"    Expected Size:     {OFFICIAL_SIZE:,} bytes ({OFFICIAL_SIZE / (1024**3):.3f} GB)")
    if actual_size != OFFICIAL_SIZE:
        print(f"    Result:            FAIL (Size mismatch)")
        return False
    print(f"    Result:            PASS (Exact byte match)")

    # 2. SHA-256 Integrity Verification (Chunked Streaming, 4 MB buffer)
    print(f"\n[2. OFFICIAL SHA-256 INTEGRITY CHECK]")
    print(f"    Expected (LFS):    {OFFICIAL_SHA256}")
    sha256_hash = hashlib.sha256()
    hash_start = time.time()
    with open(CHECKPOINT_PATH, "rb") as f:
        while chunk := f.read(4 * 1024 * 1024):
            sha256_hash.update(chunk)
    computed_sha256 = sha256_hash.hexdigest().lower()
    hash_time = time.time() - hash_start
    print(f"    Computed SHA-256:  {computed_sha256}")
    print(f"    Hashing Duration:  {hash_time:.2f} seconds")

    if computed_sha256 != OFFICIAL_SHA256:
        print(f"    Result:            FAIL (SHA-256 mismatch!)")
        return False
    print(f"    Result:            PASS (Exact cryptographic match)")

    ram_after_hash = get_process_ram_mb()
    print(f"[MEMORY TELEMETRY] Process RAM after SHA-256 streaming: {ram_after_hash:.2f} MB")

    # 3. Safetensors Header Inspection (Zero-tensor allocation)
    print(f"\n[3. SAFETENSORS HEADER & KEY INSPECTION]")
    with safe_open(CHECKPOINT_PATH, framework="pt", device="cpu") as f:
        ckpt_keys = set(f.keys())
        ckpt_shapes = {k: tuple(f.get_slice(k).get_shape()) for k in ckpt_keys}
        ckpt_dtypes = {k: str(f.get_slice(k).get_dtype()) for k in ckpt_keys}

    total_ckpt_keys = len(ckpt_keys)
    print(f"    Total Checkpoint Keys:        {total_ckpt_keys}")

    # Check for prefix signatures
    ldm_keys = [k for k in ckpt_keys if k.startswith("model.diffusion_model.")]
    unet_prefix_keys = [k for k in ckpt_keys if k.startswith("unet.")]
    direct_keys = [k for k in ckpt_keys if k.startswith("down_blocks.") or k.startswith("mid_block.") or k.startswith("up_blocks.") or k.startswith("conv_in.") or k.startswith("time_embedding.")]

    print(f"    Direct Native Diffusers Keys: {len(direct_keys)}")
    print(f"    Stability LDM Keys:           {len(ldm_keys)}")
    print(f"    'unet.' Prefixed Keys:        {len(unet_prefix_keys)}")

    if len(ldm_keys) > 0:
        format_type = "Stability LDM Format (Conversion Required)"
    elif len(direct_keys) > 0 and len(ldm_keys) == 0:
        format_type = "Native Diffusers Format (Direct 1:1 Mapping)"
    else:
        format_type = "Custom / Non-standard Format"
    print(f"    Detected Checkpoint Format:   {format_type}")

    # 4. Official SDXL UNet Meta-Device Graph Instantiation
    print(f"\n[4. OFFICIAL SDXL UNET ARCHITECTURE COMPARISON]")
    sdxl_config = {
        "sample_size": 128,
        "in_channels": 4,
        "out_channels": 4,
        "down_block_types": ("DownBlock2D", "CrossAttnDownBlock2D", "CrossAttnDownBlock2D"),
        "up_block_types": ("CrossAttnUpBlock2D", "CrossAttnUpBlock2D", "UpBlock2D"),
        "block_out_channels": (320, 640, 1280),
        "layers_per_block": 2,
        "transformer_layers_per_block": (1, 2, 10),
        "cross_attention_dim": 2048,
        "attention_head_dim": (5, 10, 20),
        "use_linear_projection": True,
        "addition_embed_type": "text_time",
        "addition_time_embed_dim": 256,
        "projection_class_embeddings_input_dim": 2816,
    }

    # Instantiate on meta device (0 bytes tensor RAM)
    with init_empty_weights():
        meta_unet = UNet2DConditionModel(**sdxl_config)

    meta_params = meta_unet.state_dict()
    official_keys = set(meta_params.keys())
    total_official_keys = len(official_keys)
    print(f"    Official SDXL Graph Parameter Count: {total_official_keys} tensors")

    # 5. Key-by-Key Semantic & Shape Matching
    print(f"\n[5. KEY-BY-KEY SEMANTIC & SHAPE AUDIT]")
    matching_keys = ckpt_keys.intersection(official_keys)
    missing_keys = official_keys - ckpt_keys
    unexpected_keys = ckpt_keys - official_keys
    shape_mismatches = []

    for k in matching_keys:
        expected_shape = tuple(meta_params[k].shape)
        actual_shape = ckpt_shapes[k]
        if expected_shape != actual_shape:
            shape_mismatches.append((k, expected_shape, actual_shape))

    match_percent = (len(matching_keys) / total_official_keys) * 100.0 if total_official_keys else 0.0

    print(f"    Total Official Keys Expected:  {total_official_keys}")
    print(f"    Total Checkpoint Keys Found:   {total_ckpt_keys}")
    print(f"    Identical Matching Keys:       {len(matching_keys)} ({match_percent:.2f}%)")
    print(f"    Missing Keys:                  {len(missing_keys)}")
    print(f"    Unexpected / Unmapped Keys:    {len(unexpected_keys)}")
    print(f"    Shape Mismatches:              {len(shape_mismatches)}")

    if missing_keys:
        print(f"    [SAMPLE MISSING KEYS]: {list(missing_keys)[:5]}")
    if unexpected_keys:
        print(f"    [SAMPLE UNEXPECTED KEYS]: {list(unexpected_keys)[:5]}")
    if shape_mismatches:
        print(f"    [SAMPLE SHAPE MISMATCHES]: {shape_mismatches[:5]}")

    # Check dtypes
    sample_dtypes = {k: ckpt_dtypes[k] for k in list(ckpt_keys)[:5]}
    print(f"    Sample Tensor Data Types:      {sample_dtypes}")

    # 6. Memory & Tier B Guardrail Verification
    peak_ram = get_process_ram_mb()
    system_available_ram = get_system_avail_ram_gb()

    print(f"\n[6. MEMORY ACCOUNTING & TIER B GUARDRAIL]")
    print(f"    Final Tier A Python Process RAM: {peak_ram:.2f} MB")
    print(f"    RAM Delta for Tier A Audit:      +{peak_ram - initial_ram:.2f} MB")
    print(f"    System Available Physical RAM:   {system_available_ram:.2f} GB")
    print(f"    Tier B Execution Blocked:        STRICTLY ENFORCED (Zero tensor deserialization)")

    # 7. Final Verdict
    pass_criteria = (
        actual_size == OFFICIAL_SIZE and
        computed_sha256 == OFFICIAL_SHA256 and
        len(missing_keys) == 0 and
        len(unexpected_keys) == 0 and
        len(shape_mismatches) == 0 and
        match_percent == 100.0
    )

    print("\n" + "=" * 70)
    if pass_criteria:
        print("STAGE 1 - TIER A FINAL VERDICT: PASS")
        print("Checkpoint is verified 100% authentic, uncorrupted, and directly compatible with Diffusers SDXL UNet.")
    else:
        print("STAGE 1 - TIER A FINAL VERDICT: FAIL")
    print("=" * 70)

    return pass_criteria

if __name__ == "__main__":
    success = run_tier_a_validation()
    sys.exit(0 if success else 1)
