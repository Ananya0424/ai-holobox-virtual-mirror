import os
import sys
import time
import gc
import psutil
import torch
import numpy as np
from safetensors.torch import load_file
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer
from diffusers import AutoencoderKL, EulerDiscreteScheduler, UNet2DConditionModel, StableDiffusionXLPipeline
from PIL import Image

# Add scripts directory for local ArcFaceAnalyzer
sys.path.append(os.path.join(os.path.dirname(__file__)))
from face_identity import ArcFaceAnalyzer

INPUT_IMAGE_PATH = os.path.join("scripts", "doctor_verification", "1_original_input.png")
OUTPUT_DIR = "test_outputs"
OUTPUT_IMAGE = os.path.join(OUTPUT_DIR, "sdxl_astronaut_face_visible_test.png")

# Optimized full-body prompt with helmet held at side, bare uncovered head
PROMPT = (
    "Ultra-photorealistic full-body portrait of a person wearing a highly detailed white NASA astronaut suit, "
    "standing upright facing camera, head-to-toe visible from boots to head, astronaut helmet removed and held "
    "in hands at side, completely bare uncovered head, clear natural human face looking directly at camera, "
    "natural skin texture, realistic facial features, natural studio lighting, clean white seamless background, "
    "professional cinematic photography, sharp focus."
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
    print("=" * 70, flush=True)
    print("ISOLATED TEST: SDXL-LIGHTNING FULL-BODY ASTRONAUT (HELMET REMOVED)", flush=True)
    print("=" * 70, flush=True)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Pre-execution Safety Telemetry
    avail_ram, used_ram, total_ram = get_ram_gb()
    alloc_vram, res_vram, _ = get_vram_gb()
    print(f"[PRE-CHECK TELEMETRY]", flush=True)
    print(f"  Total RAM:     {total_ram:.2f} GB", flush=True)
    print(f"  Used RAM:      {used_ram:.2f} GB", flush=True)
    print(f"  Available RAM: {avail_ram:.2f} GB", flush=True)
    print(f"  GPU Allocated: {alloc_vram:.2f} GB", flush=True)

    if avail_ram < 2.0:
        print(f"[FATAL] Available RAM is critically low ({avail_ram:.2f} GB < 2.0 GB). Aborting.", flush=True)
        sys.exit(1)

    # 2. Load Tokenizers & Scheduler
    print("\n[PHASE 1] Loading Tokenizers & Scheduler...", flush=True)
    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer")
    tokenizer_2 = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer_2")
    scheduler = EulerDiscreteScheduler.from_pretrained(
        "models/sdxl/scheduler",
        timestep_spacing="trailing"
    )
    print(f"  Tokenizers & Scheduler loaded in {time.time() - t0:.2f}s", flush=True)

    # 3. Load Text Encoders & VAE (FP16)
    print("\n[PHASE 2] Loading Text Encoders & Fixed VAE (FP16)...", flush=True)
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
    print(f"  Text Encoders & VAE loaded in {time.time() - t0:.2f}s", flush=True)

    # 4. Load UNet Architecture & Assign Lightning Weights
    print("\n[PHASE 3] Loading SDXL-Lightning 4-step UNet (FP16 assign=True)...", flush=True)
    t0 = time.time()
    unet = UNet2DConditionModel.from_config("models/sdxl/unet").to(dtype=torch.float16)

    ckpt_path = os.path.join("models", "sdxl", "unet", "sdxl_lightning_4step_unet.safetensors")
    print(f"  Loading state dictionary from: {ckpt_path}", flush=True)
    state_dict = load_file(ckpt_path)
    unet.load_state_dict(state_dict, assign=True)
    del state_dict
    gc.collect()
    print(f"  UNet state dictionary assigned in {time.time() - t0:.2f}s", flush=True)

    # 5. Assemble StableDiffusionXLPipeline
    print("\n[PHASE 4] Assembling Pipeline & Configuring VRAM Safety...", flush=True)
    t0 = time.time()
    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )

    pipe.enable_sequential_cpu_offload()
    pipe.enable_vae_tiling()
    print(f"  Sequential CPU Offloading & VAE Tiling enabled in {time.time() - t0:.2f}s", flush=True)

    # 6. Execute Single 4-Step Generation
    print("\n[PHASE 5] Executing 4-Step Full-Body Generation (720x1280)...", flush=True)
    print(f"  Target Resolution: 720 x 1280", flush=True)
    print(f"  Inference Steps:   4", flush=True)
    print(f"  Guidance Scale:    0.0", flush=True)
    print(f"  Seed:              42", flush=True)

    torch.cuda.reset_peak_memory_stats()
    t_gen_start = time.time()
    generator = torch.Generator(device="cpu").manual_seed(42)

    with torch.inference_mode():
        image = pipe(
            prompt=PROMPT,
            height=1280,
            width=720,
            num_inference_steps=4,
            guidance_scale=0.0,
            generator=generator,
        ).images[0]

    gen_duration = time.time() - t_gen_start
    print(f"  Inference completed in {gen_duration:.2f} seconds!", flush=True)

    # 7. Save and Verify Output
    print("\n[PHASE 6] Saving Output Image...", flush=True)
    image.save(OUTPUT_IMAGE)
    print(f"  Image saved to: {OUTPUT_IMAGE}", flush=True)

    saved_img = Image.open(OUTPUT_IMAGE)
    w, h = saved_img.size
    fsize = os.path.getsize(OUTPUT_IMAGE)
    print(f"  Verified Image Dimensions: {w} x {h}", flush=True)
    print(f"  Verified File Size:       {fsize:,} bytes", flush=True)

    # 8. Unload Pipeline before ArcFace Analysis to free memory
    del pipe, unet, text_encoder, text_encoder_2, vae
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    # 9. ArcFace Face Detection & Cosine Similarity Verification
    print("\n[PHASE 7] Running Objective ArcFace Evaluation on Generated Face...", flush=True)
    analyzer = ArcFaceAnalyzer(model_dir=os.path.join("models", "insightface", "buffalo_l"))
    
    # Input face
    orig_img = Image.open(INPUT_IMAGE_PATH).convert("RGB")
    info_in = analyzer.extract_identity(orig_img)
    emb_in = info_in["embedding"] / np.linalg.norm(info_in["embedding"])
    print(f"  Input Photo Face Conf: {info_in['det_score']:.4f}", flush=True)

    # Output face
    info_out = analyzer.extract_identity(saved_img)
    if info_out is None:
        # Fallback to upper 45% region if needed
        head_roi = saved_img.crop((0, 0, w, int(h * 0.45)))
        info_out = analyzer.extract_identity(head_roi)

    if info_out is not None:
        bbox = info_out["bbox"]
        det_score = info_out["det_score"]
        emb_out = info_out["embedding"] / np.linalg.norm(info_out["embedding"])
        cosine_sim = float(np.dot(emb_in, emb_out))
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        print(f"  Generated Face Detected:   YES", flush=True)
        print(f"  Detection Confidence:      {det_score:.4f}", flush=True)
        print(f"  Face Bounding Box:         [{bbox[0]:.1f}, {bbox[1]:.1f}, {bbox[2]:.1f}, {bbox[3]:.1f}] -> {bw:.1f} x {bh:.1f} px", flush=True)
        print(f"  ArcFace Cosine Similarity: {cosine_sim:.4f} (Prompt-only baseline: no identity conditioning)", flush=True)
    else:
        print(f"  Generated Face Detected:   NO", flush=True)
        det_score = 0.0
        cosine_sim = 0.0
        bw, bh = 0.0, 0.0

    # 10. Post-Execution Telemetry
    avail_ram_end, used_ram_end, _ = get_ram_gb()
    alloc_vram_end, res_vram_end, max_vram_end = get_vram_gb()

    print("\n" + "=" * 70, flush=True)
    print("SDXL-LIGHTNING FULL-BODY ASTRONAUT (HELMET REMOVED) TEST REPORT", flush=True)
    print("=" * 70, flush=True)
    print(f"1. Generation Succeeded:        YES", flush=True)
    print(f"2. Output Image Path:          {OUTPUT_IMAGE}", flush=True)
    print(f"   Output Dimensions:          {w} x {h}", flush=True)
    print(f"   File Size:                  {fsize:,} bytes", flush=True)
    print(f"3. Face Detected:              {'YES' if info_out else 'NO'}", flush=True)
    print(f"   Face Detection Score:       {det_score:.4f}", flush=True)
    print(f"   Face Bounding Box Size:     {bw:.1f} x {bh:.1f} px", flush=True)
    print(f"   ArcFace Cosine Similarity:  {cosine_sim:.4f} (Unconditioned Prompt-Only)", flush=True)
    print(f"4. Pre-Run Available RAM:      {avail_ram:.2f} GB", flush=True)
    print(f"   Post-Run Available RAM:     {avail_ram_end:.2f} GB", flush=True)
    print(f"   Peak Dedicated VRAM Used:   {max_vram_end:.2f} GB (RTX 3050 6GB)", flush=True)
    print(f"5. Total Inference Latency:    {gen_duration:.2f} seconds", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()
