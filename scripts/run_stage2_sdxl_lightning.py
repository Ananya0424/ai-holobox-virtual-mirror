import os
import sys
import time
import gc
import psutil
import torch
from safetensors.torch import load_file
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer
from diffusers import AutoencoderKL, EulerDiscreteScheduler, UNet2DConditionModel, StableDiffusionXLPipeline
from PIL import Image

OUTPUT_DIR = "test_outputs"
OUTPUT_IMAGE = os.path.join(OUTPUT_DIR, "sdxl_astronaut_test.png")

PROMPT = (
    "Ultra-photorealistic full-body portrait of a professional astronaut wearing a highly detailed "
    "realistic white NASA-style spacesuit, standing upright facing the camera, complete body visible "
    "from helmet to boots, anatomically correct proportions, realistic human face visible through "
    "the helmet visor, detailed suit textures, natural studio lighting, pure white seamless background, "
    "professional cinematic photography, sharp focus, realistic shadows."
)

def get_ram_gb():
    vm = psutil.virtual_memory()
    return vm.available / (1024**3), vm.used / (1024**3), vm.total / (1024**3)

def get_vram_gb():
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / (1024**3)
        reserved = torch.cuda.memory_reserved() / (1024**3)
        max_allocated = torch.cuda.max_memory_allocated() / (1024**3)
        return allocated, reserved, max_allocated
    return 0.0, 0.0, 0.0

def main():
    print("=" * 70)
    print("STAGE 2: SDXL-LIGHTNING 4-STEP FIRST IMAGE GENERATION TEST")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Pre-execution Safety Telemetry
    avail_ram, used_ram, total_ram = get_ram_gb()
    alloc_vram, res_vram, _ = get_vram_gb()
    print(f"[PRE-CHECK TELEMETRY]")
    print(f"  Total RAM:     {total_ram:.2f} GB")
    print(f"  Used RAM:      {used_ram:.2f} GB")
    print(f"  Available RAM: {avail_ram:.2f} GB")
    print(f"  GPU Allocated: {alloc_vram:.2f} GB")

    if avail_ram < 2.0:
        print(f"[FATAL] Available RAM is critically low ({avail_ram:.2f} GB < 2.0 GB). Aborting.")
        sys.exit(1)

    # 2. Load Tokenizers & Scheduler
    print("\n[PHASE 1] Loading Tokenizers & Scheduler...")
    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer")
    tokenizer_2 = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer_2")
    scheduler = EulerDiscreteScheduler.from_pretrained(
        "models/sdxl/scheduler",
        timestep_spacing="trailing"
    )
    print(f"  Tokenizers & Scheduler loaded in {time.time() - t0:.2f}s")

    # 3. Load Text Encoders & VAE (FP16)
    print("\n[PHASE 2] Loading Text Encoders & Fixed VAE (FP16)...")
    t0 = time.time()
    text_encoder = CLIPTextModel.from_pretrained(
        "models/sdxl/text_encoder",
        torch_dtype=torch.float16,
        variant="fp16"
    )
    text_encoder_2 = CLIPTextModelWithProjection.from_pretrained(
        "models/sdxl/text_encoder_2",
        torch_dtype=torch.float16,
        variant="fp16"
    )
    vae = AutoencoderKL.from_pretrained(
        "models/sdxl/vae",
        torch_dtype=torch.float16
    )
    print(f"  Text Encoders & VAE loaded in {time.time() - t0:.2f}s")

    # Check RAM before UNet
    avail_ram, used_ram, _ = get_ram_gb()
    print(f"  Available RAM after Encoders+VAE: {avail_ram:.2f} GB")
    if avail_ram < 2.0:
        print("[FATAL] RAM dropped below 2.0 GB safety threshold. Aborting.")
        sys.exit(1)

    # 4. Load UNet Architecture & Assign Lightning Weights
    print("\n[PHASE 3] Loading SDXL-Lightning 4-step UNet (FP16 assign=True)...")
    t0 = time.time()
    unet = UNet2DConditionModel.from_config("models/sdxl/unet").to(dtype=torch.float16)

    ckpt_path = os.path.join("models", "sdxl", "unet", "sdxl_lightning_4step_unet.safetensors")
    print(f"  Loading state dictionary from: {ckpt_path}")
    state_dict = load_file(ckpt_path)
    unet.load_state_dict(state_dict, assign=True)
    del state_dict
    gc.collect()
    print(f"  UNet loaded and verified in {time.time() - t0:.2f}s")

    # 5. Assemble StableDiffusionXLPipeline
    print("\n[PHASE 4] Assembling StableDiffusionXLPipeline...")
    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )

    print("  Applying sequential CPU offloading and VAE tiling...")
    pipe.enable_sequential_cpu_offload()
    pipe.enable_vae_tiling()
    if hasattr(pipe, "enable_attention_slicing"):
        pipe.enable_attention_slicing(1)
    print("  Pipeline ready for inference!")

    # Check RAM before inference
    avail_ram, used_ram, _ = get_ram_gb()
    print(f"  Available RAM before inference: {avail_ram:.2f} GB")
    if avail_ram < 2.0:
        print("[FATAL] RAM dropped below 2.0 GB safety threshold. Aborting.")
        sys.exit(1)

    # Reset GPU max memory stats
    torch.cuda.reset_peak_memory_stats()

    # 6. Generate ONE Test Image
    print("\n[PHASE 5] Executing 4-step SDXL-Lightning Generation...")
    print(f"  Prompt: \"{PROMPT[:60]}...\"")
    print("  Resolution: 720 x 1280 (9:16 Portrait)")
    print("  Inference Steps: 4")
    print("  Guidance Scale: 0.0")

    gen_start = time.time()
    generator = torch.Generator(device="cpu").manual_seed(42)

    with torch.inference_mode():
        result = pipe(
            prompt=PROMPT,
            height=1280,
            width=720,
            num_inference_steps=4,
            guidance_scale=0.0,
            generator=generator,
        )

    gen_duration = time.time() - gen_start
    image = result.images[0]

    # Save output
    image.save(OUTPUT_IMAGE)
    print(f"\n[PHASE 6] Generation Complete in {gen_duration:.2f} seconds!")
    print(f"  Output saved to: {OUTPUT_IMAGE}")

    # 7. Verification & Post-execution Telemetry
    if os.path.exists(OUTPUT_IMAGE):
        saved_img = Image.open(OUTPUT_IMAGE)
        w, h = saved_img.size
        file_size = os.path.getsize(OUTPUT_IMAGE)
        print(f"  Verified Image Dimensions: {w} x {h}")
        print(f"  Verified File Size: {file_size:,} bytes")
    else:
        print("[FAIL] Output image was not created!")
        sys.exit(1)

    _, _, peak_vram = get_vram_gb()
    avail_ram_final, used_ram_final, _ = get_ram_gb()

    print("\n" + "=" * 70)
    print("STAGE 2 TEST REPORT: SUCCESS")
    print(f"  Generation Latency: {gen_duration:.2f} seconds")
    print(f"  Peak VRAM Consumed: {peak_vram:.2f} GB (RTX 3050 6GB)")
    print(f"  Final Available RAM: {avail_ram_final:.2f} GB")
    print(f"  Generated File: {OUTPUT_IMAGE}")
    print("=" * 70)

if __name__ == "__main__":
    main()
