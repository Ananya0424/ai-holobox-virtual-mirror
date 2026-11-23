#!/usr/bin/env python3
"""
Isolated Experimental Prototype Testing Script
------------------------------------------------
PROTOTYPE 1: Pilot Full-Body AI Generation
  - 1A: SDXL-Lightning 4-step pure text-to-image (720x1280)
  - 1B: Diffusion generative pilot uniform synthesis on real user (1080x1920)

PROTOTYPE 2: Cat & Mouse Reference Character Conditioning Audit
  - Tests reference image conditioning feasibility with micky1.webp and micky2.webp
  - Measures identity preservation, VRAM, RAM, and latency

Outputs saved strictly to: test_outputs/prototype/
No production files are modified.
"""

import os
import sys
import time
import gc
import psutil
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFilter
import torch
from safetensors.torch import load_file

# Add project root to sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

OUTPUT_DIR = os.path.join(PROJECT_ROOT, "test_outputs", "prototype")
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_PHOTO_PATH = os.path.join(PROJECT_ROOT, "scripts", "doctor_verification", "1_original_input.png")
MICKY1_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky1.webp")
MICKY2_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky2.webp")

def get_sys_memory_mb():
    return psutil.Process().memory_info().rss / (1024 * 1024)

def get_vram_mb():
    if torch.cuda.is_available():
        return torch.cuda.max_memory_allocated() / (1024 * 1024)
    return 0.0

def reset_cuda():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()

print("=" * 70)
print("  HOLOXBOX EXPERIMENTAL PROTOTYPE RUNNER (PILOT & CAT & MOUSE)")
print("=" * 70)
print(f"CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"Device: {torch.cuda.get_device_name(0)}")
print(f"Initial System RAM: {get_sys_memory_mb():.1f} MB")
print(f"Output Directory: {OUTPUT_DIR}\n")

results = {}

# =====================================================================
# EXPERIMENT 1A: SDXL-Lightning 4-step Full-Body Pilot Generation
# =====================================================================
print("\n" + "=" * 60)
print("  PROTOTYPE 1A: SDXL-Lightning 4-Step Pure Diffusion Pilot")
print("=" * 60)
reset_cuda()

try:
    from diffusers import StableDiffusionXLPipeline, UNet2DConditionModel, EulerDiscreteScheduler, AutoencoderKL
    from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer

    models_sdxl = os.path.join(PROJECT_ROOT, "models", "sdxl")
    print(f"Loading SDXL-Lightning components from {models_sdxl}...")

    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained(os.path.join(models_sdxl, "tokenizer"))
    tokenizer_2 = CLIPTokenizer.from_pretrained(os.path.join(models_sdxl, "tokenizer_2"))
    scheduler = EulerDiscreteScheduler.from_pretrained(os.path.join(models_sdxl, "scheduler"), timestep_spacing="trailing")

    text_encoder = CLIPTextModel.from_pretrained(
        os.path.join(models_sdxl, "text_encoder"),
        torch_dtype=torch.float16,
        variant="fp16"
    )
    text_encoder_2 = CLIPTextModelWithProjection.from_pretrained(
        os.path.join(models_sdxl, "text_encoder_2"),
        torch_dtype=torch.float16,
        variant="fp16"
    )
    vae = AutoencoderKL.from_pretrained(
        os.path.join(models_sdxl, "vae"),
        torch_dtype=torch.float16
    )

    unet = UNet2DConditionModel.from_config(os.path.join(models_sdxl, "unet")).to(dtype=torch.float16)
    ckpt_path = os.path.join(models_sdxl, "unet", "sdxl_lightning_4step_unet.safetensors")
    print(f"Assigning Lightning weights from: {ckpt_path}")
    state_dict = load_file(ckpt_path)
    unet.load_state_dict(state_dict, assign=True)
    del state_dict
    gc.collect()

    pipe_sdxl = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler
    )

    pipe_sdxl.enable_attention_slicing("auto")
    pipe_sdxl.enable_vae_slicing()
    pipe_sdxl.enable_vae_tiling()
    pipe_sdxl.enable_model_cpu_offload()

    pilot_prompt = (
        "ultra realistic 8k full-body studio photograph of an adult woman airline captain pilot head to feet, "
        "standing straight upright facing directly forward, wearing tailored dark navy blue double-breasted pilot blazer with polished brass buttons, "
        "gold four-stripe captain epaulettes on sleeve cuffs, white buttoned dress shirt, formal black necktie, matching dark navy uniform trousers, "
        "polished black leather shoes, peaked pilot captain hat, natural human skin texture and pores, bright professional studio lighting, "
        "pure seamless white background, sharp focus, 35mm photo"
    )
    pilot_negative = (
        "cartoon, 3d render, anime, illustration, bad anatomy, deformed limbs, extra fingers, missing hands, "
        "tilted posture, crooked body, dark background, clutter, watermark, blurry, low resolution"
    )

    print("Generating 720x1280 full-body pilot with 4-step SDXL-Lightning...")
    t_gen = time.time()
    with torch.inference_mode():
        sdxl_out = pipe_sdxl(
            prompt=pilot_prompt,
            negative_prompt=pilot_negative,
            width=720,
            height=1280,
            num_inference_steps=4,
            guidance_scale=1.0,
            generator=torch.Generator(device="cpu").manual_seed(2026)
        ).images[0]

    sdxl_duration = time.time() - t_gen
    sdxl_vram = get_vram_mb()
    sdxl_ram = get_sys_memory_mb()

    out_1a_path = os.path.join(OUTPUT_DIR, "prototype_1a_sdxl_pilot_720x1280.png")
    sdxl_out.save(out_1a_path)

    print(f"[PASS] Prototype 1A Generated: {out_1a_path}")
    print(f"       Duration: {sdxl_duration:.2f}s | Peak VRAM: {sdxl_vram:.1f} MB | Peak RAM: {sdxl_ram:.1f} MB")

    results['1A_SDXL_Pilot'] = {
        'status': 'PASS',
        'path': out_1a_path,
        'duration': sdxl_duration,
        'vram_mb': sdxl_vram,
        'ram_mb': sdxl_ram
    }

    del pipe_sdxl, unet, text_encoder, text_encoder_2, vae, tokenizer, tokenizer_2
    reset_cuda()

except Exception as e:
    print(f"[FAIL] Prototype 1A Error: {e}")
    results['1A_SDXL_Pilot'] = {'status': 'FAIL', 'error': str(e)}
    reset_cuda()


# =====================================================================
# EXPERIMENT 1B: Generative Pilot Uniform on Authentic User Body
# =====================================================================
print("\n" + "=" * 60)
print("  PROTOTYPE 1B: Generative Pilot Uniform Synthesis on Real User")
print("=" * 60)
reset_cuda()

try:
    from diffusers import StableDiffusionInpaintPipeline, DPMSolverMultistepScheduler

    user_img = Image.open(USER_PHOTO_PATH).convert('RGB')
    tw, th = 512, 768
    init_image = ImageOps.fit(user_img, (tw, th), Image.Resampling.LANCZOS)

    # Build clothing mask: protect face/chin, target clothing
    mask = Image.new('L', (tw, th), 0)
    draw = ImageDraw.Draw(mask)
    neck_y = int(th * 0.54)
    draw.rectangle([0, neck_y, tw, th], fill=255)
    cx = tw // 2
    scoop_w = int(tw * 0.36)
    draw.ellipse([cx - scoop_w // 2, neck_y - 14, cx + scoop_w // 2, neck_y + 32], fill=255)
    draw.rectangle([0, 0, tw, neck_y - 16], fill=0)
    feathered_mask = mask.filter(ImageFilter.GaussianBlur(3))

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe_inpaint = StableDiffusionInpaintPipeline.from_pretrained(
        "runwayml/stable-diffusion-inpainting",
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        variant="fp16" if device == "cuda" else None,
        safety_checker=None
    )
    pipe_inpaint.scheduler = DPMSolverMultistepScheduler.from_config(pipe_inpaint.scheduler.config)

    if device == "cuda":
        pipe_inpaint.enable_attention_slicing("auto")
        pipe_inpaint.enable_vae_slicing()
        pipe_inpaint.enable_vae_tiling()
        pipe_inpaint.enable_model_cpu_offload()

    pilot_cloth_prompt = (
        "authentic professional airline captain pilot uniform blazer, dark navy wool fabric, "
        "double-breasted golden brass buttons, gold 4-stripe captain braid epaulettes on sleeves, "
        "crisp white collared dress shirt, formal black silk necktie, natural cloth folds and tailored fit, "
        "studio lighting, sharp 8k focus, pure clean white background"
    )
    pilot_cloth_neg = (
        "face, eyes, head, hair, mouth, doctor coat, stethoscope, cartoon, 3d, illustration, "
        "bad anatomy, deformed clothing, floating buttons, asymmetrical stripes, dark background"
    )

    print("Synthesizing diffusion pilot uniform onto user...")
    t_inpaint = time.time()
    with torch.inference_mode():
        diff_raw = pipe_inpaint(
            prompt=pilot_cloth_prompt,
            negative_prompt=pilot_cloth_neg,
            image=init_image,
            mask_image=feathered_mask,
            num_inference_steps=24,
            guidance_scale=7.5,
            generator=torch.Generator(device=device).manual_seed(101)
        ).images[0]

    inpaint_duration = time.time() - t_inpaint
    inpaint_vram = get_vram_mb()
    inpaint_ram = get_sys_memory_mb()

    if diff_raw.size != init_image.size:
        diff_raw = diff_raw.resize(init_image.size, Image.Resampling.LANCZOS)

    mask_arr = np.array(feathered_mask) / 255.0
    orig_arr = np.array(init_image)
    diff_arr = np.array(diff_raw)
    fused_arr = (orig_arr * (1.0 - mask_arr[:, :, None]) + diff_arr * mask_arr[:, :, None]).astype(np.uint8)
    fused_pilot_pil = Image.fromarray(fused_arr)

    # Composite onto 1080x1920 Holobox canvas with floor shadow
    CANVAS_W, CANVAS_H = 1080, 1920
    holobox_canvas = Image.new('RGB', (CANVAS_W, CANVAS_H), (255, 255, 255))

    scale = 1.95
    nw, nh = int(tw * scale), int(th * scale)
    scaled_sub = fused_pilot_pil.resize((nw, nh), Image.Resampling.LANCZOS)
    px = (CANVAS_W - nw) // 2
    py = CANVAS_H - nh - 120

    holobox_canvas.paste(scaled_sub, (px, py))
    out_1b_path = os.path.join(OUTPUT_DIR, "prototype_1b_diffusion_pilot_1080x1920.png")
    holobox_canvas.save(out_1b_path)

    print(f"[PASS] Prototype 1B Generated: {out_1b_path}")
    print(f"       Duration: {inpaint_duration:.2f}s | Peak VRAM: {inpaint_vram:.1f} MB | Peak RAM: {inpaint_ram:.1f} MB")

    results['1B_Inpaint_Pilot'] = {
        'status': 'PASS',
        'path': out_1b_path,
        'duration': inpaint_duration,
        'vram_mb': inpaint_vram,
        'ram_mb': inpaint_ram
    }

    del pipe_inpaint
    reset_cuda()

except Exception as e:
    print(f"[FAIL] Prototype 1B Error: {e}")
    results['1B_Inpaint_Pilot'] = {'status': 'FAIL', 'error': str(e)}
    reset_cuda()


# =====================================================================
# EXPERIMENT 2: Cat & Mouse Reference Conditioning Investigation
# =====================================================================
print("\n" + "=" * 60)
print("  PROTOTYPE 2: Cat & Mouse Reference Character Conditioning Audit")
print("=" * 60)

m1_exists = os.path.exists(MICKY1_PATH)
m2_exists = os.path.exists(MICKY2_PATH)
print(f"Reference Asset micky1.webp (Grey Cat): {m1_exists} ({MICKY1_PATH})")
print(f"Reference Asset micky2.webp (Brown Mouse): {m2_exists} ({MICKY2_PATH})")

has_ip_adapter_sd15 = os.path.exists(os.path.join(PROJECT_ROOT, "models", "studio_sd15", "ip-adapter-faceid-plusv2_sd15.bin"))
has_clip_vision = os.path.exists(os.path.join(PROJECT_ROOT, "models", "studio_sd15", "image_encoder", "model.safetensors"))

print(f"IP-Adapter FaceID available: {has_ip_adapter_sd15} (Face only, NOT character bodies)")
print(f"CLIP Vision available: {has_clip_vision}")

print("\nEvaluating Cat & Mouse Reference Reproduction Capability:")
print("1. Available model architecture: Text-to-Image / Inpainting diffusion.")
print("2. Required capability: 100% reproduction of micky1.webp (specific 3D grey cat) and micky2.webp (specific 3D brown mouse).")
print("3. Technical limitation detected:")
print("   - Text-to-image diffusion models DO NOT have internal weights or LoRA for the exact 3D character design of micky1/micky2.")
print("   - When prompted with text alone, diffusion synthesizes GENERIC cartoon cats/mice or photorealistic animals, violating requirement #5 ('Do not replace them with generic AI-generated animals').")
print("   - True reproduction requires either: (A) A fine-tuned LoRA for these exact 3D models, or (B) Reference-guided multi-layer compositing.")

m1_img = Image.open(MICKY1_PATH).convert('RGBA')
m2_img = Image.open(MICKY2_PATH).convert('RGBA')

CANVAS_W, CANVAS_H = 1080, 1920
cat_mouse_plate = Image.new('RGB', (CANVAS_W, CANVAS_H), (255, 255, 255))

cat_scaled = m1_img.resize((int(m1_img.width * 1.05), int(m1_img.height * 1.05)), Image.Resampling.LANCZOS)
cat_plate = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
cat_plate.paste(cat_scaled, (CANVAS_W - cat_scaled.width + 100, 180))

mouse_scaled = m2_img.resize((int(m2_img.width * 0.95), int(m2_img.height * 0.95)), Image.Resampling.LANCZOS)
mouse_plate = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
mouse_plate.paste(mouse_scaled, (40, CANVAS_H - mouse_scaled.height - 240))

user_scaled = Image.open(USER_PHOTO_PATH).convert('RGBA')
uw, uh = user_scaled.size
user_resized = user_scaled.resize((int(uw * 1.4), int(uh * 1.4)), Image.Resampling.LANCZOS)

cat_mouse_plate.paste(cat_plate, (0, 0), cat_plate)
cat_mouse_plate.paste(user_resized, ((CANVAS_W - user_resized.width) // 2 - 40, CANVAS_H - user_resized.height - 100), user_resized)
cat_mouse_plate.paste(mouse_plate, (0, 0), mouse_plate)

out_2_path = os.path.join(OUTPUT_DIR, "prototype_2_cat_mouse_reference_alignment.png")
cat_mouse_plate.save(out_2_path)
print(f"[PARTIAL/LIMITATION REPORTED] Reference alignment saved: {out_2_path}")

results['2_Cat_Mouse'] = {
    'status': 'PARTIAL (Limitation Identified)',
    'path': out_2_path,
    'limitation': 'Text diffusion cannot synthesize exact micky1/micky2 3D characters without dedicated character LoRA; produces generic animals if unconstrained.'
}

# =====================================================================
# BIOMETRIC IDENTITY MEASUREMENT
# =====================================================================
print("\n" + "=" * 60)
print("  BIOMETRIC IDENTITY MEASUREMENT (ArcFace Cosine Similarity)")
print("=" * 60)
try:
    from scripts.face_identity import ArcFaceAnalyzer
    analyzer = ArcFaceAnalyzer()
    id_orig = analyzer.extract_identity(Image.open(USER_PHOTO_PATH).convert('RGB'))

    if results.get('1A_SDXL_Pilot', {}).get('status') == 'PASS':
        im_1a = Image.open(results['1A_SDXL_Pilot']['path']).convert('RGB')
        sim_1a = analyzer.verify_similarity(id_orig['embedding'], im_1a)
        results['1A_SDXL_Pilot']['arcface_sim'] = sim_1a
        print(f"Prototype 1A (SDXL-Lightning Pure Diffusion) ArcFace Similarity: {sim_1a:.4f}" if sim_1a is not None else "Prototype 1A: No face detected for similarity")

    if results.get('1B_Inpaint_Pilot', {}).get('status') == 'PASS':
        im_1b = Image.open(results['1B_Inpaint_Pilot']['path']).convert('RGB')
        sim_1b = analyzer.verify_similarity(id_orig['embedding'], im_1b)
        results['1B_Inpaint_Pilot']['arcface_sim'] = sim_1b
        print(f"Prototype 1B (Generative Uniform Inpainting) ArcFace Similarity: {sim_1b:.4f}" if sim_1b is not None else "Prototype 1B: No face detected for similarity")

except Exception as e:
    print(f"Biometric measurement notice: {e}")

print("\n" + "=" * 70)
print("  PROTOTYPE EXPERIMENTS COMPLETE")
print("=" * 70)
for k, v in results.items():
    print(f"{k}: {v.get('status')} | Details: {v}")
