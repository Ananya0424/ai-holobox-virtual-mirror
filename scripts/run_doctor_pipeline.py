import os
import sys
import time
import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageDraw

def run_doctor_transformation_pipeline(user_image_path, output_dir='scripts/doctor_verification'):
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 65)
    print("AI DOCTOR CLOTHING TRANSFORMATION - FULL STUDIO PIPELINE")
    print("=" * 65)
    start_time = time.time()
    
    # ---------------------------------------------------------
    # 1. SAVE UNTOUCHED ORIGINAL INPUT
    # ---------------------------------------------------------
    print("[Step 1/6] Loading & saving untouched original input photo...")
    user_img = Image.open(user_image_path).convert('RGB')
    orig_path = os.path.join(output_dir, '1_original_input.png')
    user_img.save(orig_path)
    print(f"           Saved: {orig_path} (Size: {user_img.size})")
    
    # Target diffusion canvas size (512 x 768 for SD 1.5 inpainting)
    tw, th = 512, 768
    init_image = ImageOps.fit(user_img, (tw, th), Image.Resampling.LANCZOS)
    
    # ---------------------------------------------------------
    # 2. GENERATE SEPARATE CLOTHING & PROTECTION MASK
    # ---------------------------------------------------------
    print("[Step 2/6] Building high-precision clothing mask & facial protection...")
    mask = Image.new('L', (tw, th), 0)
    draw = ImageDraw.Draw(mask)
    
    # The neck / clavicle transition level (56% down the portrait)
    neck_y = int(th * 0.56)
    
    # Everything below the neck is target clothing region (WHITE = 255)
    draw.rectangle([0, neck_y, tw, th], fill=255)
    
    # Collar scoop around the neck
    cx = tw // 2
    scoop_w = int(tw * 0.38)
    draw.ellipse([cx - scoop_w // 2, neck_y - 16, cx + scoop_w // 2, neck_y + 36], fill=255)
    
    # STRICT PROTECTION: Absolute blackout of face, chin, lips, eyes, hair (0 = keep original untouched)
    draw.rectangle([0, 0, tw, neck_y - 18], fill=0)
    
    # Feather boundary slightly (3px) for smooth cloth-to-skin transition
    feathered_mask = mask.filter(ImageFilter.GaussianBlur(3))
    
    mask_path = os.path.join(output_dir, '2_clothing_mask.png')
    feathered_mask.save(mask_path)
    print(f"           Saved: {mask_path}")
    
    # ---------------------------------------------------------
    # 3. RUN STABLE DIFFUSION 1.5 INPAINTING ON RTX 3050 GPU
    # ---------------------------------------------------------
    print("[Step 3/6] Running Stable Diffusion 1.5 Inpainting on CUDA...")
    import torch
    from diffusers import StableDiffusionInpaintPipeline, DPMSolverMultistepScheduler
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"           GPU Active: {torch.cuda.get_device_name(0)}")
    torch.cuda.reset_peak_memory_stats()
    
    pipe = StableDiffusionInpaintPipeline.from_pretrained(
        "runwayml/stable-diffusion-inpainting",
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
        variant="fp16" if device == "cuda" else None,
        safety_checker=None
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    
    # 6GB VRAM safety settings
    if device == "cuda":
        pipe.enable_attention_slicing("auto")
        pipe.enable_vae_slicing()
        pipe.enable_vae_tiling()
        pipe.enable_model_cpu_offload()
    else:
        pipe.to(device)
        
    prompt = (
        "photorealistic crisp white medical doctor lab coat, medical stethoscope draped around shoulders, "
        "light blue hospital scrub shirt, detailed realistic cloth texture, natural fabric wrinkles and folds, "
        "professional hospital attire, soft studio lighting, sharp focus, 8k resolution, clean white background"
    )
    negative_prompt = (
        "face, head, hair, skin, mouth, teeth, eyes, duplicate person, extra head, floating collar, "
        "bad anatomy, deformed clothing, cartoon, 3d, illustration, low quality, dark background, text, watermark"
    )
    
    gen_start = time.time()
    with torch.inference_mode():
        diff_raw = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            image=init_image,
            mask_image=feathered_mask,
            num_inference_steps=25,
            guidance_scale=7.5,
            generator=torch.Generator(device=device).manual_seed(101)
        ).images[0]
        
    gen_time = time.time() - gen_start
    print(f"           Inference completed in {gen_time:.2f} seconds!")
    
    if diff_raw.size != init_image.size:
        diff_raw = diff_raw.resize(init_image.size, Image.Resampling.LANCZOS)
        
    # Strict original identity preservation composite
    mask_arr = np.array(feathered_mask) / 255.0
    orig_arr = np.array(init_image)
    diff_arr = np.array(diff_raw)
    
    fused_arr = (orig_arr * (1.0 - mask_arr[:, :, None]) + diff_arr * mask_arr[:, :, None]).astype(np.uint8)
    ai_doctor_img = Image.fromarray(fused_arr)
    
    ai_photo_path = os.path.join(output_dir, '3_ai_generated_doctor_photo.png')
    ai_doctor_img.save(ai_photo_path)
    print(f"           Saved: {ai_photo_path}")
    
    # ---------------------------------------------------------
    # 4. STUDIO MATTING & PURE WHITE BACKGROUND COMPOSITING
    # ---------------------------------------------------------
    print("[Step 4/6] Compositing subject onto pure white studio background with floor shadow...")
    # Clean background removal using local U2-Net so room clutter is eliminated
    os.environ['U2NET_HOME'] = os.path.abspath('models')
    import rembg
    session = rembg.new_session('u2net')
    cutout = rembg.remove(ai_doctor_img, session=session)
    
    # High-resolution Holobox 9:16 portrait canvas: 1080 x 1920
    CANVAS_W, CANVAS_H = 1080, 1920
    studio_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
    
    # Pure white background with subtle pearl vignette near bottom
    bg_draw = ImageDraw.Draw(studio_canvas)
    for y in range(CANVAS_H):
        if y > CANVAS_H * 0.74:
            ratio = (y - CANVAS_H * 0.74) / (CANVAS_H * 0.26)
            val = int(255 - ratio * 12)
            bg_draw.line([(0, y), (CANVAS_W, y)], fill=(val, val + 1, val + 3, 255))
        else:
            bg_draw.line([(0, y), (CANVAS_W, y)], fill=(255, 255, 255, 255))
            
    # Soft floor drop shadow
    shadow_w = int(CANVAS_W * 0.62)
    shadow_h = int(CANVAS_H * 0.05)
    shadow_x = (CANVAS_W - shadow_w) // 2
    shadow_y = int(CANVAS_H * 0.88)
    shadow_img = Image.new('RGBA', (shadow_w, shadow_h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow_img)
    s_draw.ellipse([0, 0, shadow_w, shadow_h], fill=(0, 0, 0, 52))
    shadow_blurred = shadow_img.filter(ImageFilter.GaussianBlur(18))
    studio_canvas.paste(shadow_blurred, (shadow_x, shadow_y), shadow_blurred)
    
    # Scale subject gracefully to fill frame
    subj_target_h = int(CANVAS_H * 0.82)
    subj_scale = subj_target_h / float(cutout.height)
    subj_w = int(cutout.width * subj_scale)
    cutout_scaled = cutout.resize((subj_w, subj_target_h), Image.Resampling.LANCZOS)
    
    subj_x = (CANVAS_W - subj_w) // 2
    subj_y = int(CANVAS_H * 0.12)
    studio_canvas.paste(cutout_scaled, (subj_x, subj_y), cutout_scaled)
    
    # ---------------------------------------------------------
    # 5. FLOATING 3D DOCTOR DECORATIONS (PERIPHERAL ONLY)
    # ---------------------------------------------------------
    print("[Step 5/6] Drawing small, elegant floating Doctor 3D elements around subject...")
    overlay_draw = ImageDraw.Draw(studio_canvas)
    
    # Helper to draw a sleek rounded badge with shadow
    def draw_badge(x, y, w, h, bg_color=(255, 255, 255, 240), border_color=(226, 232, 240, 255)):
        shadow = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle([4, 4, w + 12, h + 12], radius=16, fill=(15, 23, 42, 35))
        shadow_blur = shadow.filter(ImageFilter.GaussianBlur(6))
        studio_canvas.paste(shadow_blur, (x - 6, y - 6), shadow_blur)
        
        badge = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        bd = ImageDraw.Draw(badge)
        bd.rounded_rectangle([0, 0, w, h], radius=16, fill=bg_color, outline=border_color, width=2)
        studio_canvas.paste(badge, (x, y), badge)
        
    # Badge 1 (Top Left): Heartbeat ECG Line
    draw_badge(40, 240, 140, 80)
    # Draw red pulse line inside
    points = [(55, 280), (75, 280), (85, 260), (95, 300), (105, 265), (115, 280), (135, 280), (145, 270), (155, 280), (165, 280)]
    for i in range(len(points) - 1):
        overlay_draw.line([points[i], points[i+1]], fill=(239, 68, 68, 255), width=3)
        
    # Badge 2 (Top Right): 3D Medical Red Cross Sphere
    draw_badge(CANVAS_W - 170, 360, 130, 110)
    # Draw red sphere
    cx_s, cy_s = CANVAS_W - 105, 405
    overlay_draw.ellipse([cx_s - 26, cy_s - 26, cx_s + 26, cy_s + 26], fill=(239, 68, 68, 255), outline=(220, 38, 38, 255), width=2)
    # White cross
    overlay_draw.rectangle([cx_s - 6, cy_s - 18, cx_s + 6, cy_s + 18], fill=(255, 255, 255, 255))
    overlay_draw.rectangle([cx_s - 18, cy_s - 6, cx_s + 18, cy_s + 6], fill=(255, 255, 255, 255))
    
    # Badge 3 (Mid Left): Stethoscope Emblem
    draw_badge(30, 850, 120, 110)
    # Blue stethoscope circle
    cx_st, cy_st = 90, 905
    overlay_draw.ellipse([cx_st - 24, cy_st - 24, cx_st + 24, cy_st + 24], fill=(2, 132, 199, 255))
    overlay_draw.ellipse([cx_st - 16, cy_st - 16, cx_st + 16, cy_st + 16], fill=(255, 255, 255, 255))
    overlay_draw.ellipse([cx_st - 6, cy_st - 6, cx_st + 6, cy_st + 6], fill=(2, 132, 199, 255))
    
    # Badge 4 (Mid Right): Pharmaceutical Capsule
    draw_badge(CANVAS_W - 160, 1020, 120, 90)
    # Capsule half red / half white
    cap_x, cap_y = CANVAS_W - 100, 1065
    overlay_draw.rounded_rectangle([cap_x - 22, cap_y - 12, cap_x, cap_y + 12], radius=10, fill=(239, 68, 68, 255))
    overlay_draw.rounded_rectangle([cap_x, cap_y - 12, cap_x + 22, cap_y + 12], radius=10, fill=(241, 245, 249, 255), outline=(203, 213, 225, 255), width=1)
    
    # Badge 5 (Bottom Left): First Aid Kit
    draw_badge(45, 1450, 120, 100)
    cx_k, cy_k = 105, 1500
    overlay_draw.rounded_rectangle([cx_k - 24, cy_k - 18, cx_k + 24, cy_k + 18], radius=6, fill=(254, 242, 242, 255), outline=(220, 38, 38, 255), width=2)
    overlay_draw.rectangle([cx_k - 4, cy_k - 10, cx_k + 4, cy_k + 10], fill=(220, 38, 38, 255))
    overlay_draw.rectangle([cx_k - 10, cy_k - 4, cx_k + 10, cy_k + 4], fill=(220, 38, 38, 255))
    
    final_studio_path = os.path.join(output_dir, '4_final_white_studio_doctor.png')
    studio_rgb = studio_canvas.convert('RGB')
    studio_rgb.save(final_studio_path, quality=95)
    print(f"           Saved High-Res 1080x1920 Studio Portrait: {final_studio_path}")
    
    # ---------------------------------------------------------
    # 6. COMPLETE SIDE-BY-SIDE INSPECTION SHEET
    # ---------------------------------------------------------
    print("[Step 6/6] Generating comprehensive multi-stage inspection sheet...")
    # Side-by-side sheet: Original | Mask | AI Doctor Inpainted | Final Studio Presentation
    panel_w, panel_h = 420, 560
    
    p1 = user_img.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
    p2 = feathered_mask.resize((panel_w, panel_h), Image.Resampling.LANCZOS).convert('RGB')
    p3 = ai_doctor_img.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
    p4 = studio_rgb.resize((panel_w, panel_h), Image.Resampling.LANCZOS)
    
    sheet_w = panel_w * 4 + 50
    sheet_h = panel_h + 120
    sheet = Image.new('RGB', (sheet_w, sheet_h), (248, 250, 252))
    s_draw = ImageDraw.Draw(sheet)
    
    # Title bar
    s_draw.rectangle([0, 0, sheet_w, 60], fill=(15, 23, 42))
    
    # Paste panels
    sheet.paste(p1, (10, 80))
    sheet.paste(p2, (panel_w + 20, 80))
    sheet.paste(p3, (panel_w * 2 + 30, 80))
    sheet.paste(p4, (panel_w * 3 + 40, 80))
    
    sheet_path = os.path.join(output_dir, '5_complete_inspection_sheet.png')
    sheet.save(sheet_path)
    print(f"           Saved Inspection Sheet: {sheet_path}")
    
    total_time = time.time() - start_time
    peak_vram = torch.cuda.max_memory_allocated() / (1024**2)
    print("=" * 65)
    print(f"PIPELINE COMPLETE! Total Time: {total_time:.2f}s | Peak VRAM: {peak_vram:.1f} MB")
    print("=" * 65)
    
    return {
        'original': orig_path,
        'mask': mask_path,
        'ai_photo': ai_photo_path,
        'final_studio': final_studio_path,
        'inspection_sheet': sheet_path,
        'vram_mb': peak_vram,
        'gen_time_s': gen_time
    }

if __name__ == '__main__':
    test_photo = r'C:\Users\dell\.gemini\antigravity\brain\e182d9c9-1b53-418f-9fb6-2f89d88b013c\.user_uploaded\media_1793791603837_91e54451.png'
    if len(sys.argv) > 1:
        test_photo = sys.argv[1]
    run_doctor_transformation_pipeline(test_photo)
