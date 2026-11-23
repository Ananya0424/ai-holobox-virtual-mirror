import os
import sys
import time
import gc
import psutil
import torch
import numpy as np
from PIL import Image
from transformers import (
    CLIPTextModel,
    CLIPTextModelWithProjection,
    CLIPTokenizer,
    CLIPImageProcessor,
    CLIPVisionModelWithProjection,
)
from diffusers import (
    AutoencoderKL,
    EulerDiscreteScheduler,
    UNet2DConditionModel,
    StableDiffusionXLPipeline,
)
from safetensors.torch import load_file

# Add scripts directory for local ArcFaceAnalyzer
sys.path.append(os.path.join(os.path.dirname(__file__)))
from face_identity import ArcFaceAnalyzer

INPUT_IMAGE_PATH = os.path.join("scripts", "doctor_verification", "1_original_input.png")
OUTPUT_DIR = "test_outputs"
OUTPUT_IMAGE_PATH = os.path.join(OUTPUT_DIR, "sdxl_astronaut_faceid_test.png")

# Concise 70-token prompt (well within CLIP 77 token limit)
PROMPT = (
    "Ultra-photorealistic full-body portrait of the person wearing a highly detailed white NASA-style "
    "spacesuit, standing upright facing camera, head-to-toe visible, clear face through open transparent "
    "helmet visor, natural skin texture, realistic human proportions, boots visible, natural studio lighting, "
    "pure white seamless background, professional cinematic photography, sharp focus."
)

def get_telemetry():
    vm = psutil.virtual_memory()
    ram_avail = vm.available / (1024**3)
    ram_used = vm.used / (1024**3)
    ram_total = vm.total / (1024**3)
    
    vram_alloc = 0.0
    vram_res = 0.0
    vram_max = 0.0
    if torch.cuda.is_available():
        vram_alloc = torch.cuda.memory_allocated() / (1024**3)
        vram_res = torch.cuda.memory_reserved() / (1024**3)
        vram_max = torch.cuda.max_memory_allocated() / (1024**3)
    return ram_avail, ram_used, ram_total, vram_alloc, vram_res, vram_max

def main():
    print("=" * 70)
    print("SDXL-LIGHTNING + IP-ADAPTER FACEID PLUSV2 PROOF-OF-CONCEPT")
    print("=" * 70)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Pre-execution Safety Telemetry
    r_avail, r_used, r_total, v_alloc, v_res, _ = get_telemetry()
    print(f"[PRE-RUN TELEMETRY]")
    print(f"  Available RAM: {r_avail:.2f} GB / {r_total:.2f} GB (Used: {r_used:.2f} GB)")
    print(f"  GPU Allocated: {v_alloc:.2f} GB, Reserved: {v_res:.2f} GB")

    if r_avail < 2.0:
        print(f"[FATAL] Available RAM is below 2.0 GB abort threshold. Aborting.")
        sys.exit(1)

    # 2. Extract Face Identity & OpenCLIP Embeddings from Input Photo
    print("\n[PHASE 1] Extracting Face Identity from Input Photo...")
    if not os.path.exists(INPUT_IMAGE_PATH):
        print(f"[FATAL] Input photo not found at: {INPUT_IMAGE_PATH}")
        sys.exit(1)

    orig_img = Image.open(INPUT_IMAGE_PATH).convert("RGB")
    print(f"  Input Image: {INPUT_IMAGE_PATH} ({orig_img.size[0]}x{orig_img.size[1]})")

    analyzer = ArcFaceAnalyzer(model_dir=os.path.join("models", "insightface", "buffalo_l"))
    face_info = analyzer.extract_identity(orig_img)
    if face_info is None or face_info.get("embedding") is None:
        print("[FATAL] No face detected in input image by ArcFaceAnalyzer.")
        sys.exit(1)

    input_emb = face_info["embedding"]
    det_score = face_info.get("det_score", 0.0)
    bbox = face_info["bbox"]
    print(f"  Face detected with confidence score: {det_score:.4f}")
    print(f"  Face Bounding Box: {bbox}")
    print(f"  ArcFace 512-d Embedding extracted.")

    # 3. Extract OpenCLIP ViT-H/14 Structural Tokens
    print("\n[PHASE 2] Extracting OpenCLIP ViT-H/14 Dense Face Tokens...")
    clip_processor = CLIPImageProcessor(size=224, crop_size=224)
    pixel_values = clip_processor(images=face_info["face_crop_224"], return_tensors="pt").pixel_values
    pixel_values = pixel_values.to(dtype=torch.float16)

    img_enc = CLIPVisionModelWithProjection.from_pretrained(
        "models/studio_sd15/image_encoder",
        torch_dtype=torch.float16
    )
    with torch.no_grad():
        clip_hidden = img_enc(pixel_values, output_hidden_states=True).hidden_states[-2]  # shape: (1, 257, 1280)

    # Delete image encoder to reclaim 2.5 GB RAM before assembling pipeline
    del img_enc
    gc.collect()
    print(f"  OpenCLIP ViT-H/14 face tokens extracted (shape: {clip_hidden.shape}).")
    print("  Image encoder unloaded from memory.")

    # Format tensors for pipeline (guidance_scale=0.0 -> batch size 1)
    id_embeds = torch.from_numpy(input_emb).reshape(1, 1, 512).to(dtype=torch.float16)
    clip_embeds = clip_hidden.unsqueeze(1)  # shape: (1, 1, 257, 1280)

    # 4. Assemble SDXL-Lightning Pipeline
    print("\n[PHASE 3] Assembling SDXL-Lightning Pipeline...")
    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer")
    tokenizer_2 = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer_2")
    text_encoder = CLIPTextModel.from_pretrained("models/sdxl/text_encoder", torch_dtype=torch.float16, variant="fp16")
    text_encoder_2 = CLIPTextModelWithProjection.from_pretrained("models/sdxl/text_encoder_2", torch_dtype=torch.float16, variant="fp16")
    vae = AutoencoderKL.from_pretrained("models/sdxl/vae", torch_dtype=torch.float16)
    scheduler = EulerDiscreteScheduler.from_pretrained("models/sdxl/scheduler", timestep_spacing="trailing")

    unet = UNet2DConditionModel.from_config("models/sdxl/unet").to(dtype=torch.float16)
    unet_state_dict = load_file(os.path.join("models", "sdxl", "unet", "sdxl_lightning_4step_unet.safetensors"))
    unet.load_state_dict(unet_state_dict, assign=True)
    del unet_state_dict
    gc.collect()

    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        text_encoder_2=text_encoder_2,
        tokenizer=tokenizer,
        tokenizer_2=tokenizer_2,
        unet=unet,
        scheduler=scheduler,
    )
    print(f"  Base SDXL-Lightning pipeline assembled in {time.time() - t0:.2f}s")

    # 5. Load IP-Adapter FaceID PlusV2 & Companion LoRA
    print("\n[PHASE 4] Loading IP-Adapter FaceID PlusV2 & Companion LoRA...")
    t0 = time.time()
    pipe.load_ip_adapter(
        "models/sdxl/ip_adapter",
        subfolder="",
        weight_name="ip-adapter-faceid-plusv2_sdxl.bin",
        image_encoder_folder=None,
    )
    print("  IP-Adapter cross-attention projection loaded.")

    pipe.load_lora_weights(
        "models/sdxl/ip_adapter",
        weight_name="ip-adapter-faceid-plusv2_sdxl_lora.safetensors",
        adapter_name="faceid_lora"
    )
    print("  FaceID companion LoRA loaded.")

    # Apply verified scales
    IP_SCALE = 0.60
    LORA_SCALE = 0.70
    pipe.set_adapters(["faceid_lora"], adapter_weights=[LORA_SCALE])
    pipe.set_ip_adapter_scale(IP_SCALE)
    print(f"  Adapters configured: FaceID LoRA Scale = {LORA_SCALE}, IP-Adapter Scale = {IP_SCALE}")

    # Set clip_embeds on the IP-Adapter projection layer
    ip_proj_layer = pipe.unet.encoder_hid_proj.image_projection_layers[0]
    ip_proj_layer.clip_embeds = clip_embeds
    print("  clip_embeds attached to IPAdapterFaceIDPlusImageProjection layer.")

    # Enable sequential CPU offloading and VAE tiling (Do NOT call enable_attention_slicing as it overrides IPAdapterAttnProcessor2_0!)
    print("  Applying sequential CPU offloading & VAE tiling...")
    pipe.enable_sequential_cpu_offload()
    pipe.enable_vae_tiling()
    print(f"  Pipeline setup complete in {time.time() - t0:.2f}s")

    # Check RAM before inference
    r_avail_inf, r_used_inf, _, _, _, _ = get_telemetry()
    print(f"  Available RAM before inference: {r_avail_inf:.2f} GB")
    if r_avail_inf < 2.0:
        print("[FATAL] RAM dropped below 2.0 GB safety threshold. Aborting.")
        sys.exit(1)

    torch.cuda.reset_peak_memory_stats()

    # 6. Execute 4-step Generation with Face Identity Conditioning
    print("\n[PHASE 5] Executing Face-Preserving 4-Step Astronaut Generation...")
    print(f"  Target Resolution: 720 x 1280 (9:16 Portrait)")
    print(f"  Inference Steps:   4")
    print(f"  Guidance Scale:    0.0")

    gen_start = time.time()
    generator = torch.Generator(device="cpu").manual_seed(42)

    with torch.inference_mode():
        result = pipe(
            prompt=PROMPT,
            height=1280,
            width=720,
            num_inference_steps=4,
            guidance_scale=0.0,
            ip_adapter_image_embeds=[id_embeds],
            generator=generator,
        )

    gen_duration = time.time() - gen_start
    gen_image = result.images[0]
    gen_image.save(OUTPUT_IMAGE_PATH)
    print(f"\n[PHASE 6] Generation Complete in {gen_duration:.2f} seconds!")
    print(f"  Output saved to: {OUTPUT_IMAGE_PATH}")

    # 7. Post-generation Evaluation & ArcFace Cosine Similarity
    print("\n[PHASE 7] Running Objective ArcFace Cosine Similarity Evaluation...")
    if not os.path.exists(OUTPUT_IMAGE_PATH):
        print(f"[FAIL] Output image {OUTPUT_IMAGE_PATH} was not created!")
        sys.exit(1)

    saved_img = Image.open(OUTPUT_IMAGE_PATH)
    w, h = saved_img.size
    print(f"  Verified Image Dimensions: {w} x {h}")
    print(f"  Verified File Size: {os.path.getsize(OUTPUT_IMAGE_PATH):,} bytes")

    gen_face_info = analyzer.extract_identity(saved_img)
    if gen_face_info is None or gen_face_info.get("embedding") is None:
        print("  [WARNING] No face detected in generated astronaut image by ArcFace detector.")
        cosine_sim = 0.0
        gen_det_score = 0.0
    else:
        gen_det_score = gen_face_info.get("det_score", 0.0)
        gen_emb = gen_face_info["embedding"]
        cosine_sim = float(analyzer.verify_similarity(input_emb, gen_emb))
        print(f"  Generated Face Detection Score: {gen_det_score:.4f}")
        print(f"  ArcFace Cosine Similarity:     {cosine_sim:.4f}")

    # Telemetry
    r_avail_end, r_used_end, _, v_alloc_end, _, v_max_end = get_telemetry()

    print("\n" + "=" * 70)
    print("STAGE 2 FACEID PROOF-OF-CONCEPT TEST REPORT")
    print("=" * 70)
    print(f"1. Generation Succeeded:        YES")
    print(f"2. Output Image Path:          {OUTPUT_IMAGE_PATH}")
    print(f"   Output Dimensions:          {w} x {h}")
    print(f"3. Input Face Detection Score:  {det_score:.4f}")
    print(f"   Output Face Detection Score: {gen_det_score:.4f}")
    print(f"   ArcFace Cosine Similarity:  {cosine_sim:.4f}")
    print(f"4. Pre-Run Available RAM:      {r_avail:.2f} GB")
    print(f"   Post-Run Available RAM:     {r_avail_end:.2f} GB")
    print(f"   Peak Dedicated VRAM Used:   {v_max_end:.2f} GB (RTX 3050 6GB)")
    print(f"5. Total Inference Latency:    {gen_duration:.2f} seconds")
    print(f"6. IP-Adapter & LoRA Status:   100% Native Diffusers Hooks Applied")
    print("=" * 70)

if __name__ == "__main__":
    main()
