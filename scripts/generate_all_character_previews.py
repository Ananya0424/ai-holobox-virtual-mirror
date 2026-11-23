import os
import sys
import time
import gc
import torch
from safetensors.torch import load_file
from transformers import CLIPTextModel, CLIPTextModelWithProjection, CLIPTokenizer
from diffusers import AutoencoderKL, EulerDiscreteScheduler, UNet2DConditionModel, StableDiffusionXLPipeline
from PIL import Image

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "characters")
DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "dist", "characters")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DIST_DIR, exist_ok=True)

CHARACTERS = [
    {
        "id": "01_scifi",
        "name": "Sci-Fi Space Suit",
        "prompt": "Cinematic 3D render full-body portrait of a futuristic high-tech sci-fi astronaut in advanced white and grey composite powered armor, mechanical joint seals, glowing cyan chest core, helmet with subtle cyan HUD, standing upright against dark studio background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "02_nasa",
        "name": "NASA Astronaut",
        "prompt": "Cinematic 3D render full-body portrait of an authentic NASA astronaut in white EMU space suit, bulky thermal micrometeoroid garment, gold-coated reflective helmet visor, mission patch, standing upright against dark studio background, sharp focus, photorealistic, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "03_knight",
        "name": "Medieval Knight",
        "prompt": "Cinematic 3D render full-body portrait of a chivalric medieval knight in shining polished steel plate armor, engraved breastplate, chainmail, brass rivets, visor helm, dark studio background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "04_queen",
        "name": "Royal Queen",
        "prompt": "Cinematic 3D render full-body portrait of a majestic royal queen in luxurious crimson and gold imperial velvet dress, ornate lace collar, sparkling royal tiara crown with rubies and diamonds, dark elegant background, sharp focus, photorealistic, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "05_cyberpunk",
        "name": "Cyberpunk",
        "prompt": "Cinematic 3D render full-body portrait of a cyberpunk street mercenary in high-tech black tactical coat, glowing cyan and magenta cybernetic dermal implants and visor, dark neon city ambiance, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "06_chrome",
        "name": "Liquid Chrome",
        "prompt": "Cinematic 3D render full-body portrait of a futuristic liquid chrome humanoid entity made of seamless mirror-polished liquid mercury, fluid metallic ripples, studio specular reflections, dark background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "07_ocean",
        "name": "Ocean Guardian",
        "prompt": "Cinematic 3D render full-body portrait of an ethereal ocean guardian deep-sea humanoid with bioluminescent cyan markings, organic aquatic coral armor plates, subtle underwater bubbles, dark studio background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "08_galaxy",
        "name": "Galaxy Being",
        "prompt": "Cinematic 3D render full-body portrait of a cosmic galaxy being whose body is made of interstellar nebula clouds in violet and deep indigo with millions of twinkling stars, starlight aura, dark background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "09_lava",
        "name": "Lava Elemental",
        "prompt": "Cinematic 3D render full-body portrait of a volcanic lava elemental made of dark obsidian rock with glowing red and molten orange magma fissure veins, firelight embers, dark studio background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    },
    {
        "id": "10_crystal",
        "name": "Crystal Creature",
        "prompt": "Cinematic 3D render full-body portrait of a translucent crystal creature made of faceted sparkling emerald and diamond gemstone prisms, rainbow light refractions, dark studio background, sharp focus, 8k octane render",
        "negative": "cartoon, illustration, 2d, blurry, distorted, low quality"
    }
]

def main():
    print("=" * 60, flush=True)
    print("GENERATING 10 PHOTOREALISTIC 3D CHARACTER PREVIEWS FOR HOLOBOX", flush=True)
    print("=" * 60, flush=True)

    # Check which characters already exist
    pending = []
    for c in CHARACTERS:
        p_out = os.path.join(OUT_DIR, f"{c['id']}.png")
        if os.path.exists(p_out) and os.path.getsize(p_out) > 50000:
            print(f"  [EXISTS] {c['id']}.png ({round(os.path.getsize(p_out)/1024, 1)} KB)")
        else:
            pending.append(c)

    if not pending:
        print("[SUCCESS] All 10 character preview images are already present!", flush=True)
        return

    print(f"\n[PHASE 1] Loading SDXL-Lightning Pipeline for {len(pending)} character(s)...", flush=True)
    t0 = time.time()
    tokenizer = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer")
    tokenizer_2 = CLIPTokenizer.from_pretrained("models/sdxl/tokenizer_2")
    scheduler = EulerDiscreteScheduler.from_pretrained("models/sdxl/scheduler", timestep_spacing="trailing")
    text_encoder = CLIPTextModel.from_pretrained("models/sdxl/text_encoder", torch_dtype=torch.float16, variant="fp16")
    text_encoder_2 = CLIPTextModelWithProjection.from_pretrained("models/sdxl/text_encoder_2", torch_dtype=torch.float16, variant="fp16")
    vae = AutoencoderKL.from_pretrained("models/sdxl/vae", torch_dtype=torch.float16)

    unet = UNet2DConditionModel.from_config("models/sdxl/unet").to(dtype=torch.float16)
    ckpt_path = os.path.join("models", "sdxl", "unet", "sdxl_lightning_4step_unet.safetensors")
    state_dict = load_file(ckpt_path)
    unet.load_state_dict(state_dict, assign=True)
    del state_dict
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
    pipe.enable_sequential_cpu_offload()
    pipe.enable_vae_tiling()
    print(f"[READY] Pipeline initialized in {time.time() - t0:.2f}s", flush=True)

    for i, c in enumerate(pending, 1):
        print(f"\n[{i}/{len(pending)}] Generating {c['id']} ({c['name']})...", flush=True)
        t_gen = time.time()
        result = pipe(
            prompt=c["prompt"],
            negative_prompt=c["negative"],
            num_inference_steps=4,
            guidance_scale=1.5,
            width=512,
            height=640
        ).images[0]
        
        # Save to public and dist
        out_p = os.path.join(OUT_DIR, f"{c['id']}.png")
        dist_p = os.path.join(DIST_DIR, f"{c['id']}.png")
        result.save(out_p, "PNG")
        result.save(dist_p, "PNG")
        print(f"  --> Saved {c['id']}.png ({round(os.path.getsize(out_p)/1024, 1)} KB) in {time.time() - t_gen:.2f}s", flush=True)

    print("\n" + "=" * 60, flush=True)
    print("ALL CHARACTER PREVIEWS GENERATED SUCCESSFULLY!", flush=True)
    print("=" * 60, flush=True)

if __name__ == "__main__":
    main()
