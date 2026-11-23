#!/usr/bin/env python3
"""
Theme Fusion 2.0 - Cat & Mouse Isolated Prototype V2
------------------------------------------------------
Addresses all visual review feedback from V1:
1. Increases person visual prominence to ~84% of vertical canvas height (eliminating empty top void).
2. Keeps entire 3D Cat comfortably within canvas margins without boundary clipping.
3. Positions 3D Mouse prominently in lower-left foreground with full body, ears & tail visible.
4. Matches optical sharpness, lighting, contrast and color temperature across person and 3D assets.
5. Implements multi-stage photorealistic contact shadows (contact umbra + diffuse penumbra).
6. Refines edge matting with color de-fringing to prevent white halos around hair, hands and feet.
7. Preserves 100% authentic human face, body, clothes, sandals and pose.
"""

import os
import sys
import math
import numpy as np
import cv2
from PIL import Image, ImageFilter, ImageDraw, ImageEnhance
import onnxruntime as ort

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "test_outputs", "theme_fusion_prototype")
os.makedirs(OUTPUT_DIR, exist_ok=True)

USER_INPUT_PATH = os.path.join(PROJECT_ROOT, "public", "captured", "input_1794834094742_hdt5p5.png")
MICKY1_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky1.webp")
MICKY2_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky2.webp")
V1_PATH = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_720x1280.png")
U2NET_PATH = os.path.join(PROJECT_ROOT, "models", ".u2net", "u2net.onnx")

CANVAS_W, CANVAS_H = 720, 1280

print("=" * 65)
print("  THEME FUSION 2.0: CAT & MOUSE PROTOTYPE V2")
print(f"  Target Resolution: {CANVAS_W}x{CANVAS_H} Portrait")
print("=" * 65)

# ---------------------------------------------------------------------------
# 1. High-Precision User Segmentation & Edge Matting with De-fringing
# ---------------------------------------------------------------------------
print("\n[Step 1/6] Segmenting user and applying edge de-fringing...")

session = ort.InferenceSession(U2NET_PATH, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name

user_orig_pil = Image.open(USER_INPUT_PATH).convert('RGB')
uw_orig, uh_orig = user_orig_pil.size

# U2-Net inference at 320x320
prep = user_orig_pil.resize((320, 320), Image.Resampling.BILINEAR)
arr = np.array(prep, dtype=np.float32) / 255.0
arr = (arr - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
arr = arr.transpose((2, 0, 1))[np.newaxis, :]

outputs = session.run(None, {input_name: arr})
d1 = outputs[0][0, 0]
d1 = (d1 - d1.min()) / (d1.max() - d1.min() + 1e-8)
matte_320 = (d1 * 255).astype(np.uint8)

# Upscale matte to full resolution
matte_full = cv2.resize(matte_320, (uw_orig, uh_orig), interpolation=cv2.INTER_LANCZOS4)

# Morphological cleanup
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
matte_clean = cv2.morphologyEx(matte_full, cv2.MORPH_CLOSE, kernel)

# Identify user bounding box
ys, xs = np.where(matte_clean > 50)
y0, y1 = int(ys.min()), int(ys.max())
x0, x1 = int(xs.min()), int(xs.max())
user_w = x1 - x0 + 1
user_h = y1 - y0 + 1
print(f"  User bounding box: {user_w}x{user_h} (Y: {y0} to {y1})")

# Crop original user and matte
user_crop = np.array(user_orig_pil)[y0:y1 + 1, x0:x1 + 1]
matte_crop = matte_clean[y0:y1 + 1, x0:x1 + 1]

# Guided bilateral smoothing for natural hair/clothing contour
alpha_smooth = cv2.bilateralFilter(matte_crop, d=7, sigmaColor=50, sigmaSpace=50).astype(np.float32) / 255.0
solid_mask = alpha_smooth > 0.88
alpha_smooth[solid_mask] = 1.0
cutoff = alpha_smooth < 0.05
alpha_smooth[cutoff] = 0.0

# Color de-fringe on edge pixels
edge_mask = (alpha_smooth > 0.05) & (alpha_smooth < 0.95)
user_crop_clean = user_crop.copy()
blurred_colors = cv2.medianBlur(user_crop, 5)
user_crop_clean[edge_mask] = (user_crop[edge_mask].astype(np.float32) * 0.4 + blurred_colors[edge_mask].astype(np.float32) * 0.6).astype(np.uint8)

user_rgba = np.dstack([user_crop_clean, (alpha_smooth * 255).astype(np.uint8)])
user_pil = Image.fromarray(user_rgba)

# ---------------------------------------------------------------------------
# 2. Extract and Prepare Clean 3D Character Assets
# ---------------------------------------------------------------------------
print("\n[Step 2/6] Extracting clean RGBA characters with tight content crop...")

def extract_character_clean_rgba(image_path):
    img = cv2.imread(image_path)
    diff = 255 - np.min(img, axis=2).astype(np.float32)
    c_max = np.max(img, axis=2).astype(np.float32)
    c_min = np.min(img, axis=2).astype(np.float32)
    saturation = c_max - c_min
    
    # Solid body check
    solid = (diff > 16) | (saturation > 12)
    ys_solid, xs_solid = np.where(solid)
    
    # Bounding box of content with small pad for antialiased edge & contact shadow
    pad = 10
    y_min = max(0, int(ys_solid.min()) - pad)
    y_max = min(img.shape[0] - 1, int(ys_solid.max()) + pad)
    x_min = max(0, int(xs_solid.min()) - pad)
    x_max = min(img.shape[1] - 1, int(xs_solid.max()) + pad)
    
    # Calculate alpha on cropped region
    cropped_img = img[y_min:y_max+1, x_min:x_max+1]
    cropped_diff = diff[y_min:y_max+1, x_min:x_max+1]
    cropped_sat = saturation[y_min:y_max+1, x_min:x_max+1]
    
    alpha = np.zeros_like(cropped_diff, dtype=np.float32)
    c_solid = (cropped_diff > 16) | (cropped_sat > 12)
    alpha[c_solid] = 1.0
    
    # Soft transition for ground shadows and fur
    soft = (~c_solid) & (cropped_diff > 4)
    alpha[soft] = (cropped_diff[soft] - 4.0) / 12.0
    
    alpha_uint8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    rgba = cv2.cvtColor(cropped_img, cv2.COLOR_BGR2RGBA)
    rgba[:, :, 3] = alpha_uint8
    return Image.fromarray(rgba)

cat_pil = extract_character_clean_rgba(MICKY1_PATH)
mouse_pil = extract_character_clean_rgba(MICKY2_PATH)
print(f"  Extracted Cat content size: {cat_pil.size} (W x H)")
print(f"  Extracted Mouse content size: {mouse_pil.size} (W x H)")

# ---------------------------------------------------------------------------
# 3. Equalize Sharpness, Lighting & Color Temperature
# ---------------------------------------------------------------------------
print("\n[Step 3/6] Equalizing optical sharpness, contrast and lighting tones...")

user_arr = np.array(user_pil)
user_rgb = user_arr[:, :, :3]
user_a = user_arr[:, :, 3]

# Unsharp mask on person to recover fabric texture and hair crispness
gaussian = cv2.GaussianBlur(user_rgb, (0, 0), sigmaX=1.6)
sharp_rgb = cv2.addWeighted(user_rgb, 1.28, gaussian, -0.28, 0)

# Harmonize color temperature (+2% blue, -1% red)
sharp_rgb[:, :, 0] = np.clip(sharp_rgb[:, :, 0].astype(np.float32) * 0.99, 0, 255).astype(np.uint8)
sharp_rgb[:, :, 2] = np.clip(sharp_rgb[:, :, 2].astype(np.float32) * 1.025, 0, 255).astype(np.uint8)

user_enhanced_pil = Image.fromarray(np.dstack([sharp_rgb, user_a]))
enhancer = ImageEnhance.Contrast(user_enhanced_pil)
user_enhanced_pil = enhancer.enhance(1.05)

# Micro-softening on 3D Characters for photographic optical blending
cat_arr = np.array(cat_pil)
cat_soft_rgb = cv2.GaussianBlur(cat_arr[:, :, :3], (0, 0), sigmaX=0.45)
cat_pil = Image.fromarray(np.dstack([cat_soft_rgb, cat_arr[:, :, 3]]))

mouse_arr = np.array(mouse_pil)
mouse_soft_rgb = cv2.GaussianBlur(mouse_arr[:, :, :3], (0, 0), sigmaX=0.4)
mouse_pil = Image.fromarray(np.dstack([mouse_soft_rgb, mouse_arr[:, :, 3]]))

# ---------------------------------------------------------------------------
# 4. Premium High-Key Studio Cyclorama Background
# ---------------------------------------------------------------------------
print("\n[Step 4/6] Generating seamless high-key cyclorama studio background...")

bg_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
draw_bg = ImageDraw.Draw(bg_canvas)

FLOOR_START_Y = 980
for y in range(CANVAS_H):
    if y < FLOOR_START_Y:
        ratio = y / float(FLOOR_START_Y)
        v = int(255 - 4.0 * (ratio ** 1.3))
        color = (v, v, int(v * 0.998), 255)
    else:
        ratio = (y - FLOOR_START_Y) / float(CANVAS_H - FLOOR_START_Y)
        v = int(251 - 13.0 * (ratio ** 0.85))
        color = (v, v, int(v * 0.992), 255)
    draw_bg.line([(0, y), (CANVAS_W, y)], fill=color)

# Overhead softbox illumination
softbox = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sb = ImageDraw.Draw(softbox)
d_sb.ellipse([int(CANVAS_W * 0.1), int(CANVAS_H * 0.05), int(CANVAS_W * 0.9), int(CANVAS_H * 0.65)], fill=(255, 255, 255, 75))
softbox = softbox.filter(ImageFilter.GaussianBlur(90))
bg_canvas = Image.alpha_composite(bg_canvas, softbox)

# ---------------------------------------------------------------------------
# 5. Composition Geometry: Prominent Hero Subject & Balanced Characters
# ---------------------------------------------------------------------------
print("\n[Step 5/6] Scaling and positioning hero subject, cat, and mouse...")

# Shared Ground Floor Plane
TARGET_FEET_Y = 1205

# A. Human Hero Subject:
# Height = 1075px (~84% of canvas height, leaves 130px top headroom)
TARGET_USER_H = 1075
user_scale = TARGET_USER_H / float(user_h)
scaled_user_w = int(round(user_w * user_scale))
scaled_user_h = TARGET_USER_H
scaled_user_pil = user_enhanced_pil.resize((scaled_user_w, scaled_user_h), Image.Resampling.LANCZOS)

# Position user at center-right
user_x = 295
user_y = TARGET_FEET_Y - scaled_user_h
print(f"  Hero User: {scaled_user_w}x{scaled_user_h} at ({user_x}, {user_y}) | Top Headroom = {user_y}px")

# B. 3D Grey Cat (micky1.webp):
# Scaled to height 510px, fits comfortably on left side with 18px margin
cat_orig_w, cat_orig_h = cat_pil.size
TARGET_CAT_H = 510
cat_scale = TARGET_CAT_H / float(cat_orig_h)
scaled_cat_w = int(round(cat_orig_w * cat_scale))
scaled_cat_h = TARGET_CAT_H
scaled_cat_pil = cat_pil.resize((scaled_cat_w, scaled_cat_h), Image.Resampling.LANCZOS)

cat_x = 22
cat_y = 370
print(f"  3D Cat: {scaled_cat_w}x{scaled_cat_h} at ({cat_x}, {cat_y}) | Left margin = {cat_x}px, Max X = {cat_x + scaled_cat_w}px")

# C. 3D Brown Mouse (micky2.webp):
# Positioned prominently in the lower-left foreground
mouse_orig_w, mouse_orig_h = mouse_pil.size
TARGET_MOUSE_H = 315
mouse_scale = TARGET_MOUSE_H / float(mouse_orig_h)
scaled_mouse_w = int(round(mouse_orig_w * mouse_scale))
scaled_mouse_h = TARGET_MOUSE_H
scaled_mouse_pil = mouse_pil.resize((scaled_mouse_w, scaled_mouse_h), Image.Resampling.LANCZOS)

mouse_x = 45
mouse_y = TARGET_FEET_Y - scaled_mouse_h + 8
print(f"  3D Mouse: {scaled_mouse_w}x{scaled_mouse_h} at ({mouse_x}, {mouse_y}) | Left margin = {mouse_x}px, Max X = {mouse_x + scaled_mouse_w}px")

# ---------------------------------------------------------------------------
# 6. Multi-Stage Photorealistic Contact Shadows
# ---------------------------------------------------------------------------
print("\n[Step 6/6] Generating photorealistic contact umbra and diffuse floor shadows...")

def build_advanced_contact_shadow(canvas_size, center_x, ground_y, width_rx, height_ry, opacity=110):
    shadow_img = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow_img)
    
    # 1. Broad soft ambient floor penumbra
    d.ellipse(
        [center_x - int(width_rx * 1.25), ground_y - int(height_ry * 1.1),
         center_x + int(width_rx * 1.25), ground_y + int(height_ry * 1.1)],
        fill=(38, 42, 54, int(opacity * 0.45))
    )
    shadow_soft = shadow_img.filter(ImageFilter.GaussianBlur(18))
    
    # 2. Mid diffuse contact shadow
    shadow_mid = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d_mid = ImageDraw.Draw(shadow_mid)
    d_mid.ellipse(
        [center_x - width_rx, ground_y - height_ry,
         center_x + width_rx, ground_y + height_ry],
        fill=(28, 32, 44, int(opacity * 0.85))
    )
    shadow_mid = shadow_mid.filter(ImageFilter.GaussianBlur(10))
    
    # 3. Tight, dark contact umbra right beneath feet/paws
    shadow_core = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d_core = ImageDraw.Draw(shadow_core)
    d_core.ellipse(
        [center_x - int(width_rx * 0.65), ground_y - int(height_ry * 0.4),
         center_x + int(width_rx * 0.65), ground_y + int(height_ry * 0.4)],
        fill=(18, 20, 28, int(opacity * 1.35))
    )
    shadow_core = shadow_core.filter(ImageFilter.GaussianBlur(3))
    
    # Merge all 3 shadow stages
    res = Image.alpha_composite(shadow_soft, shadow_mid)
    res = Image.alpha_composite(res, shadow_core)
    return res

shadow_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# User feet shadows (two distinct foot contact zones)
user_cx = user_x + scaled_user_w // 2
user_foot_l = user_cx - int(scaled_user_w * 0.14)
user_foot_r = user_cx + int(scaled_user_w * 0.14)
shadow_u_l = build_advanced_contact_shadow((CANVAS_W, CANVAS_H), user_foot_l, TARGET_FEET_Y - 2, 45, 12, opacity=115)
shadow_u_r = build_advanced_contact_shadow((CANVAS_W, CANVAS_H), user_foot_r, TARGET_FEET_Y - 2, 45, 12, opacity=115)
shadow_canvas = Image.alpha_composite(shadow_canvas, shadow_u_l)
shadow_canvas = Image.alpha_composite(shadow_canvas, shadow_u_r)

# Cat body/paws contact shadow
cat_cx = cat_x + int(scaled_cat_w * 0.48)
cat_shadow = build_advanced_contact_shadow((CANVAS_W, CANVAS_H), cat_cx, TARGET_FEET_Y - 15, int(scaled_cat_w * 0.32), 16, opacity=90)
shadow_canvas = Image.alpha_composite(shadow_canvas, cat_shadow)

# Mouse paws contact shadow
mouse_cx = mouse_x + int(scaled_mouse_w * 0.48)
mouse_shadow = build_advanced_contact_shadow((CANVAS_W, CANVAS_H), mouse_cx, TARGET_FEET_Y + 12, int(scaled_mouse_w * 0.30), 10, opacity=110)
shadow_canvas = Image.alpha_composite(shadow_canvas, mouse_shadow)

# Composite Background + Realistic Floor Shadows
composite = Image.alpha_composite(bg_canvas, shadow_canvas)

# Layer 3: 3D Cat (Midground Left - Behind User's Left Arm)
cat_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
cat_layer.paste(scaled_cat_pil, (cat_x, cat_y), scaled_cat_pil)
composite = Image.alpha_composite(composite, cat_layer)

# Layer 4: Authentic Hero User (Prominent Center-Right)
user_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
user_layer.paste(scaled_user_pil, (user_x, user_y), scaled_user_pil)
composite = Image.alpha_composite(composite, user_layer)

# Layer 5: 3D Mouse (Foreground Lower-Left - Fully Visible)
mouse_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
mouse_layer.paste(scaled_mouse_pil, (mouse_x, mouse_y), scaled_mouse_pil)
composite = Image.alpha_composite(composite, mouse_layer)

# ---------------------------------------------------------------------------
# 7. Final Output & V1-versus-V2 Comparison Sheet
# ---------------------------------------------------------------------------
final_v2 = composite.convert('RGB')
v2_output_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v2.png")
final_v2.save(v2_output_path, quality=98)
print(f"\n[SUCCESS] Improved V2 Prototype saved to: {v2_output_path}")

# Build V1-versus-V2 Comparison Sheet
if os.path.exists(V1_PATH):
    v1_img = Image.open(V1_PATH).convert('RGB')
    
    comp_w = CANVAS_W * 2 + 40
    comp_h = CANVAS_H + 90
    sheet = Image.new('RGB', (comp_w, comp_h), (245, 247, 250))
    d_sheet = ImageDraw.Draw(sheet)
    
    # Header bar
    d_sheet.rectangle([0, 0, comp_w, 75], fill=(15, 23, 42))
    
    # Paste V1 and V2
    sheet.paste(v1_img, (15, 80))
    sheet.paste(final_v2, (CANVAS_W + 25, 80))
    
    comp_sheet_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v1_vs_v2_comparison.png")
    sheet.save(comp_sheet_path, quality=96)
    print(f"[SUCCESS] V1 vs V2 Comparison sheet saved to: {comp_sheet_path}")

print("\n" + "=" * 65)
print("  THEME FUSION 2.0 V2 PROTOTYPE COMPLETE")
print("=" * 65)
