#!/usr/bin/env python3
"""
Isolated Prototype: Theme Fusion 2.0 - Cat & Mouse
----------------------------------------------------
Composites an authentic full-body user capture with the exact supplied
3D Cat (micky1.webp) and Mouse (micky2.webp) character assets into a
cohesive, depth-layered 720x1280 portrait studio composition.

Execution rules:
- Strictly isolated: does NOT touch production files or overwrite test outputs.
- Uses U2-Net ONNX for user segmentation.
- Extracts clean RGBA mattes for micky1 & micky2.
- Respects gender composition references (Women Micky / Men Micky).
"""

import os
import sys
import math
import numpy as np
import cv2
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance

# Paths
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "test_outputs", "theme_fusion_prototype")
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_INPUT_PATH = os.path.join(PROJECT_ROOT, "public", "captured", "input_1794834094742_hdt5p5.png")
MICKY1_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky1.webp")
MICKY2_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky2.webp")
REF_WOMEN_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "Women Micky.webp")
U2NET_MODEL_PATH = os.path.join(PROJECT_ROOT, "models", ".u2net", "u2net.onnx")

CANVAS_W, CANVAS_H = 720, 1280

print("=" * 65)
print("  THEME FUSION 2.0: CAT & MOUSE ISOLATED PROTOTYPE")
print(f"  Target Resolution: {CANVAS_W}x{CANVAS_H} Portrait")
print("=" * 65)

# 1. Segment User with U2-Net ONNX
print("\n[Step 1/5] Extracting clean user matte using U2-Net ONNX...")
import onnxruntime as ort

session = ort.InferenceSession(U2NET_MODEL_PATH, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name

user_orig_pil = Image.open(USER_INPUT_PATH).convert('RGB')
uw_orig, uh_orig = user_orig_pil.size
print(f"  Original capture size: {uw_orig}x{uh_orig}")

# Preprocess for U2-Net
prep = user_orig_pil.resize((320, 320), Image.Resampling.BILINEAR)
arr = np.array(prep, dtype=np.float32) / 255.0
arr = (arr - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
arr = arr.transpose((2, 0, 1))[np.newaxis, :]

outputs = session.run(None, {input_name: arr})
d1 = outputs[0][0, 0]
d1 = (d1 - d1.min()) / (d1.max() - d1.min() + 1e-8)
matte_320 = (d1 * 255).astype(np.uint8)

# Resize back to original
matte_pil = Image.fromarray(matte_320, mode='L').resize((uw_orig, uh_orig), Image.Resampling.LANCZOS)
matte_arr = np.array(matte_pil)

# Bounding box of user
ys, xs = np.where(matte_arr > 60)
y0, y1 = int(ys.min()), int(ys.max())
x0, x1 = int(xs.min()), int(xs.max())
user_w = x1 - x0 + 1
user_h = y1 - y0 + 1
print(f"  Segmented user bounding box: {user_w}x{user_h} (Y: {y0} to {y1})")

# Crop and create RGBA user cutout
user_crop = user_orig_pil.crop((x0, y0, x1 + 1, y1 + 1))
matte_crop = matte_arr[y0:y1 + 1, x0:x1 + 1]

# Feather edges cleanly
from scipy.ndimage import gaussian_filter
smooth_alpha = gaussian_filter(matte_crop.astype(np.float32) / 255.0, sigma=1.2)
solid_mask = matte_crop > 180
smooth_alpha[solid_mask] = 1.0
alpha_pil = Image.fromarray((np.clip(smooth_alpha, 0, 1) * 255).astype(np.uint8), mode='L')
user_rgba = user_crop.convert('RGBA')
user_rgba.putalpha(alpha_pil)

# Save intermediate cutout for verification
user_rgba.save(os.path.join(OUTPUT_DIR, "prototype_step1_user_cutout.png"))
print("  [Saved] user cutout -> prototype_step1_user_cutout.png")

# 2. Extract Clean RGBA Characters from micky1.webp & micky2.webp
print("\n[Step 2/5] Segmenting 3D Cat and Mouse assets from pure white background...")

def extract_character_rgba(image_path, thresh_high=252, thresh_low=230):
    img = cv2.imread(image_path)
    diff = 255 - np.min(img, axis=2).astype(np.float32)
    c_max = np.max(img, axis=2).astype(np.float32)
    c_min = np.min(img, axis=2).astype(np.float32)
    saturation = c_max - c_min
    
    alpha = np.zeros_like(diff, dtype=np.float32)
    solid = (diff > (255 - thresh_low)) | (saturation > 14)
    alpha[solid] = 1.0
    
    soft = (~solid) & (diff > (255 - thresh_high))
    alpha[soft] = diff[soft] / float(255 - thresh_low)
    
    alpha_uint8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha_uint8
    
    # Crop to non-transparent bbox
    ys, xs = np.where(alpha_uint8 > 10)
    cropped = rgba[ys.min():ys.max()+1, xs.min():xs.max()+1]
    return Image.fromarray(cropped)

cat_rgba = extract_character_rgba(MICKY1_PATH)
mouse_rgba = extract_character_rgba(MICKY2_PATH)

cat_rgba.save(os.path.join(OUTPUT_DIR, "prototype_step2_cat_rgba.png"))
mouse_rgba.save(os.path.join(OUTPUT_DIR, "prototype_step2_mouse_rgba.png"))
print(f"  [Saved] Cat asset extracted: {cat_rgba.size} -> prototype_step2_cat_rgba.png")
print(f"  [Saved] Mouse asset extracted: {mouse_rgba.size} -> prototype_step2_mouse_rgba.png")

# 3. Build Realistic High-Key Cyclorama Studio Background
print("\n[Step 3/5] Synthesizing high-key studio cyclorama background with soft floor perspective...")
bg_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
draw_bg = ImageDraw.Draw(bg_canvas)

# Vertical smooth gradient from bright studio top to soft floor
FLOOR_HORIZON_Y = int(CANVAS_H * 0.72) # ~920px

for y in range(CANVAS_H):
    if y < FLOOR_HORIZON_Y:
        # Subtle wall gradient: 254 to 248
        ratio = y / float(FLOOR_HORIZON_Y)
        v = int(255 - 7 * (ratio ** 1.2))
        color = (v, v, int(v * 0.995), 255)
    else:
        # Gentle floor transition: 248 down to 232 at bottom
        ratio = (y - FLOOR_HORIZON_Y) / float(CANVAS_H - FLOOR_HORIZON_Y)
        v = int(248 - 18 * (ratio ** 0.85))
        # Warm studio tone
        color = (v, v, int(v * 0.99), 255)
    draw_bg.line([(0, y), (CANVAS_W, y)], fill=color)

# Add subtle soft radial studio light vignette from center-top
light_overlay = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_light = ImageDraw.Draw(light_overlay)
cx_light, cy_light = CANVAS_W // 2, int(CANVAS_H * 0.35)
rx, ry = int(CANVAS_W * 0.75), int(CANVAS_H * 0.55)
d_light.ellipse([cx_light - rx, cy_light - ry, cx_light + rx, cy_light + ry], fill=(255, 255, 255, 60))
light_overlay = light_overlay.filter(ImageFilter.GaussianBlur(80))
bg_canvas = Image.alpha_composite(bg_canvas, light_overlay)

# 4. Composition Layout and Depth Layering (Anchored to Women Micky Reference)
print("\n[Step 4/5] Aligning composition and generating natural contact shadows...")
# Reference Geometry for Women Micky on 720x1280 Canvas:
# - Target Standing Ground: Y = 1205
# - User height: ~880px tall (stands at center-right: X_center ~ 430)
# - Cat height: ~640px tall (stands on left: X_center ~ 205, Y_base ~ 1180)
# - Mouse height: ~330px tall (stands on lower-right foreground: X_center ~ 560, Y_base ~ 1215)

TARGET_FEET_Y = 1205
target_user_h = 890
user_scale = target_user_h / float(user_h)
scaled_user_w = int(round(user_w * user_scale))
scaled_user_h = target_user_h
user_scaled_pil = user_rgba.resize((scaled_user_w, scaled_user_h), Image.Resampling.LANCZOS)

# Position User at Center-Right
user_x = 315
user_y = TARGET_FEET_Y - scaled_user_h

# Position Cat on Left (slight overlap behind user's left arm)
cat_target_h = 630
cat_scale = cat_target_h / float(cat_rgba.size[1])
scaled_cat_w = int(round(cat_rgba.size[0] * cat_scale))
scaled_cat_h = cat_target_h
cat_scaled_pil = cat_rgba.resize((scaled_cat_w, scaled_cat_h), Image.Resampling.LANCZOS)
cat_x = 40
cat_y = TARGET_FEET_Y - scaled_cat_h - 10 # slightly behind on depth plane

# Position Mouse in Foreground Right
mouse_target_h = 340
mouse_scale = mouse_target_h / float(mouse_rgba.size[1])
scaled_mouse_w = int(round(mouse_rgba.size[0] * mouse_scale))
scaled_mouse_h = mouse_target_h
mouse_scaled_pil = mouse_rgba.resize((scaled_mouse_w, scaled_mouse_h), Image.Resampling.LANCZOS)
mouse_x = 485
mouse_y = TARGET_FEET_Y - scaled_mouse_h + 10 # slightly forward in foreground

# Contact Shadows Generator
def create_contact_shadow(canvas_size, center_x, ground_y, width_rx, height_ry, opacity=110, blur_radius=14):
    shadow_img = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow_img)
    d.ellipse(
        [center_x - width_rx, ground_y - height_ry, center_x + width_rx, ground_y + height_ry],
        fill=(35, 38, 48, opacity)
    )
    # Inner denser core shadow
    d.ellipse(
        [center_x - int(width_rx * 0.55), ground_y - int(height_ry * 0.5),
         center_x + int(width_rx * 0.55), ground_y + int(height_ry * 0.5)],
        fill=(25, 28, 38, int(opacity * 1.4))
    )
    return shadow_img.filter(ImageFilter.GaussianBlur(blur_radius))

# 1. Cast Floor Shadows
shadow_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# Cat shadow
cat_shadow = create_contact_shadow((CANVAS_W, CANVAS_H), cat_x + scaled_cat_w // 2, TARGET_FEET_Y - 5, int(scaled_cat_w * 0.38), 18, opacity=95, blur_radius=16)
shadow_canvas = Image.alpha_composite(shadow_canvas, cat_shadow)

# User feet shadows (two foot contacts)
user_shadow = create_contact_shadow((CANVAS_W, CANVAS_H), user_x + scaled_user_w // 2, TARGET_FEET_Y - 2, int(scaled_user_w * 0.36), 14, opacity=115, blur_radius=12)
shadow_canvas = Image.alpha_composite(shadow_canvas, user_shadow)

# Mouse shadow
mouse_shadow = create_contact_shadow((CANVAS_W, CANVAS_H), mouse_x + scaled_mouse_w // 2, TARGET_FEET_Y + 14, int(scaled_mouse_w * 0.35), 12, opacity=110, blur_radius=10)
shadow_canvas = Image.alpha_composite(shadow_canvas, mouse_shadow)

# Composite Background + Shadows
composite = Image.alpha_composite(bg_canvas, shadow_canvas)

# 2. Paste Cat (Midground Left - Behind User's arm)
cat_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
cat_layer.paste(cat_scaled_pil, (cat_x, cat_y), cat_scaled_pil)
composite = Image.alpha_composite(composite, cat_layer)

# 3. Paste User (Center-Right - Preserving authentic person, face, clothes, sandals)
user_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
user_layer.paste(user_scaled_pil, (user_x, user_y), user_scaled_pil)
composite = Image.alpha_composite(composite, user_layer)

# 4. Paste Mouse (Foreground Lower-Right)
mouse_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
mouse_layer.paste(mouse_scaled_pil, (mouse_x, mouse_y), mouse_scaled_pil)
composite = Image.alpha_composite(composite, mouse_layer)

# 5. Save Final Result & Comparison
print("\n[Step 5/5] Finalizing output and generating side-by-side comparison...")
final_output = composite.convert('RGB')
final_output_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_720x1280.png")
final_output.save(final_output_path, quality=98)
print(f"  [SUCCESS] Generated Prototype saved to: {final_output_path}")

# Build Side-by-Side Comparison against Original Composition Reference (Women Micky.webp)
ref_img = Image.open(REF_WOMEN_PATH).convert('RGB')
ref_resized = ref_img.resize((CANVAS_W, CANVAS_H), Image.Resampling.LANCZOS)

comp_w = CANVAS_W * 2 + 30
comp_h = CANVAS_H + 80
comp_sheet = Image.new('RGB', (comp_w, comp_h), (250, 252, 255))
d_comp = ImageDraw.Draw(comp_sheet)

# Header
d_comp.rectangle([0, 0, comp_w, 65], fill=(30, 41, 59))
# Paste Reference & Prototype
comp_sheet.paste(ref_resized, (10, 75))
comp_sheet.paste(final_output, (CANVAS_W + 20, 75))

comp_path = os.path.join(OUTPUT_DIR, "prototype_comparison_reference_vs_prototype.png")
comp_sheet.save(comp_path, quality=95)
print(f"  [SUCCESS] Comparison sheet saved to: {comp_path}")

print("\n" + "=" * 65)
print("  PROTOTYPE EXECUTION COMPLETED CLEANLY")
print("=" * 65)
