#!/usr/bin/env python3
"""
Theme Fusion 2.0 - Cat & Mouse Isolated Prototype V3 (Two Friends Companion)
------------------------------------------------------------------------------
Implements all user requirements for the V3 correction:
1. Mickey Cat (micky1.webp) scaled to human-height companion (~880px, ~94% of human height).
2. Both human and Mickey stand directly BESIDE each other on the exact same floor plane and visual depth.
3. Mickey's right front paw rests visibly ON TOP of the human's shoulder, with a realistic contact shadow.
4. Independent paw layer ensures physical contact is visible in front of the human's shoulder cloth.
5. Mickey's entire body, face, ears, paws, and tail are preserved cleanly within canvas margins.
6. Authentic human face, hair, body, clothing, trousers, and sandals preserved 100%.
7. Brown Mouse (micky2.webp) positioned as a smaller foreground character near their feet.
8. Clean high-key studio cyclorama background with multi-stage contact shadows.
9. Produces a 720x1280 portrait output and generates a V2-vs-V3 comparison sheet.
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
V2_PATH = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v2.png")
U2NET_PATH = os.path.join(PROJECT_ROOT, "models", ".u2net", "u2net.onnx")

CANVAS_W, CANVAS_H = 720, 1280

print("=" * 65)
print("  THEME FUSION 2.0: CAT & MOUSE PROTOTYPE V3 (FRIENDS POSING)")
print(f"  Target Resolution: {CANVAS_W}x{CANVAS_H} Portrait")
print("=" * 65)

# ---------------------------------------------------------------------------
# 1. High-Precision User Extraction & De-fringed Edge Matting
# ---------------------------------------------------------------------------
print("\n[Step 1/6] Extracting authentic user cutout with de-fringed edges...")

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
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
matte_clean = cv2.morphologyEx(matte_full, cv2.MORPH_CLOSE, kernel)

ys, xs = np.where(matte_clean > 50)
y0, y1 = int(ys.min()), int(ys.max())
x0, x1 = int(xs.min()), int(xs.max())
user_w = x1 - x0 + 1
user_h = y1 - y0 + 1
print(f"  User bounding box: {user_w}x{user_h}")

user_crop = np.array(user_orig_pil)[y0:y1 + 1, x0:x1 + 1]
matte_crop = matte_clean[y0:y1 + 1, x0:x1 + 1]

# Bilateral smoothing & de-fringing
alpha_smooth = cv2.bilateralFilter(matte_crop, d=7, sigmaColor=50, sigmaSpace=50).astype(np.float32) / 255.0
alpha_smooth[alpha_smooth > 0.88] = 1.0
alpha_smooth[alpha_smooth < 0.05] = 0.0

edge_mask = (alpha_smooth > 0.05) & (alpha_smooth < 0.95)
user_crop_clean = user_crop.copy()
blurred_colors = cv2.medianBlur(user_crop, 5)
user_crop_clean[edge_mask] = (user_crop[edge_mask].astype(np.float32) * 0.4 + blurred_colors[edge_mask].astype(np.float32) * 0.6).astype(np.uint8)

# Subtle unsharp masking for optical crispness
gaussian = cv2.GaussianBlur(user_crop_clean, (0, 0), sigmaX=1.5)
sharp_user = cv2.addWeighted(user_crop_clean, 1.25, gaussian, -0.25, 0)
# Harmonize lighting
sharp_user[:, :, 0] = np.clip(sharp_user[:, :, 0].astype(np.float32) * 0.99, 0, 255).astype(np.uint8)
sharp_user[:, :, 2] = np.clip(sharp_user[:, :, 2].astype(np.float32) * 1.02, 0, 255).astype(np.uint8)

user_rgba = np.dstack([sharp_user, (alpha_smooth * 255).astype(np.uint8)])
user_pil = Image.fromarray(user_rgba)

# ---------------------------------------------------------------------------
# 2. Extract Mickey Cat & Articulate Outstretched Shoulder Paw
# ---------------------------------------------------------------------------
print("\n[Step 2/6] Extracting 3D characters and articulating shoulder paw...")

def extract_character_clean(image_path):
    img = cv2.imread(image_path)
    diff = 255 - np.min(img, axis=2).astype(np.float32)
    c_max = np.max(img, axis=2).astype(np.float32)
    c_min = np.min(img, axis=2).astype(np.float32)
    saturation = c_max - c_min
    
    solid = (diff > 16) | (saturation > 12)
    ys, xs = np.where(solid)
    
    pad = 8
    y_min = max(0, int(ys.min()) - pad)
    y_max = min(img.shape[0] - 1, int(ys.max()) + pad)
    x_min = max(0, int(xs.min()) - pad)
    x_max = min(img.shape[1] - 1, int(xs.max()) + pad)
    
    cropped = img[y_min:y_max+1, x_min:x_max+1]
    cropped_diff = diff[y_min:y_max+1, x_min:x_max+1]
    cropped_sat = saturation[y_min:y_max+1, x_min:x_max+1]
    
    alpha = np.zeros_like(cropped_diff, dtype=np.float32)
    c_solid = (cropped_diff > 16) | (cropped_sat > 12)
    alpha[c_solid] = 1.0
    soft = (~c_solid) & (cropped_diff > 4)
    alpha[soft] = (cropped_diff[soft] - 4.0) / 12.0
    alpha_uint8 = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    
    return np.dstack([cropped, alpha_uint8])

cat_full_rgba = extract_character_clean(MICKY1_PATH)
mouse_full_rgba = extract_character_clean(MICKY2_PATH)
cat_h, cat_w = cat_full_rgba.shape[:2]
mouse_h, mouse_w = mouse_full_rgba.shape[:2]
print(f"  Extracted Cat content size: {cat_w}x{cat_h}")
print(f"  Extracted Mouse content size: {mouse_w}x{mouse_h}")

# A. Isolate Paw Layer:
# In cat_full_rgba, the outstretched right arm and paw spans X: 470..cat_w, Y: 110..240
paw_rgba = np.zeros_like(cat_full_rgba)
paw_mask = np.zeros((cat_h, cat_w), dtype=np.float32)
paw_mask[115:235, 470:cat_w] = 1.0
paw_mask = cv2.GaussianBlur(paw_mask, (21, 21), 0)
paw_rgba[:, :, :3] = cat_full_rgba[:, :, :3]
paw_rgba[:, :, 3] = (cat_full_rgba[:, :, 3].astype(np.float32) * paw_mask).astype(np.uint8)

# B. Cat Body (without right arm) for under-layer:
cat_body_rgba = cat_full_rgba.copy()
body_mask = 1.0 - paw_mask
cat_body_rgba[:, :, 3] = (cat_full_rgba[:, :, 3].astype(np.float32) * np.clip(body_mask * 1.15, 0, 1)).astype(np.uint8)

cat_pil = Image.fromarray(cv2.cvtColor(cat_full_rgba, cv2.COLOR_BGRA2RGBA))
cat_body_pil = Image.fromarray(cv2.cvtColor(cat_body_rgba, cv2.COLOR_BGRA2RGBA))
paw_pil = Image.fromarray(cv2.cvtColor(paw_rgba, cv2.COLOR_BGRA2RGBA))
mouse_pil = Image.fromarray(cv2.cvtColor(mouse_full_rgba, cv2.COLOR_BGRA2RGBA))

# ---------------------------------------------------------------------------
# 3. Canvas Composition: Two Friends Standing Side-by-Side
# ---------------------------------------------------------------------------
print("\n[Step 3/6] Positioning Human and Mickey Cat side-by-side on same ground plane...")

# Shared Ground Floor Plane
TARGET_FEET_Y = 1180

# 1. Human Hero Subject (Right Side):
# Height = 950px (from Y=230 to Y=1180)
TARGET_USER_H = 950
user_scale = TARGET_USER_H / float(user_h)
scaled_user_w = int(round(user_w * user_scale))
scaled_user_h = TARGET_USER_H
scaled_user = user_pil.resize((scaled_user_w, scaled_user_h), Image.Resampling.LANCZOS)

# Position human on the right side
user_x = 365
user_y = TARGET_FEET_Y - scaled_user_h
print(f"  Human: {scaled_user_w}x{scaled_user_h} at ({user_x}, {user_y}) | Ground = {TARGET_FEET_Y}")

# Exact shoulder location on canvas:
# Human shoulder seam: user_x + int(scaled_user_w * 0.23) = 365 + 76 = 441px
# Shoulder height: user_y + int(scaled_user_h * 0.215) = 230 + 204 = 434px
shoulder_canvas_x = user_x + int(scaled_user_w * 0.23)
shoulder_canvas_y = user_y + int(scaled_user_h * 0.215)
print(f"  Target Shoulder Position: ({shoulder_canvas_x}, {shoulder_canvas_y})")

# 2. Mickey Cat (Human-Height Companion on the Left):
# Height = 880px (~93% of human height, head level with human's head at Y=300)
TARGET_CAT_H = 880
cat_scale = TARGET_CAT_H / float(cat_h)
scaled_cat_w = int(round(cat_w * cat_scale))
scaled_cat_h = TARGET_CAT_H

scaled_cat = cat_pil.resize((scaled_cat_w, scaled_cat_h), Image.Resampling.LANCZOS)
scaled_cat_body = cat_body_pil.resize((scaled_cat_w, scaled_cat_h), Image.Resampling.LANCZOS)
scaled_paw = paw_pil.resize((scaled_cat_w, scaled_cat_h), Image.Resampling.LANCZOS)

# Align Mickey so his outstretched right paw rests directly ON the human's shoulder!
# In raw cat, paw tip is at X = 595 / 627 = 0.949 of cat width, Y = 135 / 532 = 0.254 of cat height
paw_local_x = int(scaled_cat_w * 0.949)
paw_local_y = int(scaled_cat_h * 0.254)

# We position Mickey so paw_canvas_x matches shoulder_canvas_x!
cat_x = shoulder_canvas_x - paw_local_x
cat_y = shoulder_canvas_y - paw_local_y

# Ensure Mickey stands firmly on ground level (within 20px of TARGET_FEET_Y)
cat_feet_y = cat_y + scaled_cat_h
y_offset = TARGET_FEET_Y - cat_feet_y
cat_y += y_offset # Ground firmly on floor!

print(f"  Mickey Cat: {scaled_cat_w}x{scaled_cat_h} placed at ({cat_x}, {cat_y}) | Base = {cat_y + scaled_cat_h}")
actual_paw_x = cat_x + paw_local_x
actual_paw_y = cat_y + paw_local_y
print(f"  Mickey Paw Landing: ({actual_paw_x}, {actual_paw_y}) vs Shoulder ({shoulder_canvas_x}, {shoulder_canvas_y})")

# 3. Brown Mouse (Foreground Mascot):
TARGET_MOUSE_H = 260
mouse_scale = TARGET_MOUSE_H / float(mouse_h)
scaled_mouse_w = int(round(mouse_w * mouse_scale))
scaled_mouse_h = TARGET_MOUSE_H
scaled_mouse = mouse_pil.resize((scaled_mouse_w, scaled_mouse_h), Image.Resampling.LANCZOS)

# Position mouse near the center foreground at their feet
mouse_x = 245
mouse_y = TARGET_FEET_Y - scaled_mouse_h + 12
print(f"  Mouse: {scaled_mouse_w}x{scaled_mouse_h} at ({mouse_x}, {mouse_y}) | Grounded")

# ---------------------------------------------------------------------------
# 4. Seamless Studio Cyclorama Background
# ---------------------------------------------------------------------------
print("\n[Step 4/6] Generating clean white studio cyclorama background...")

bg_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
draw_bg = ImageDraw.Draw(bg_canvas)

FLOOR_Y = 960
for y in range(CANVAS_H):
    if y < FLOOR_Y:
        ratio = y / float(FLOOR_Y)
        v = int(255 - 4.0 * (ratio ** 1.3))
        color = (v, v, int(v * 0.998), 255)
    else:
        ratio = (y - FLOOR_Y) / float(CANVAS_H - FLOOR_Y)
        v = int(251 - 14.0 * (ratio ** 0.85))
        color = (v, v, int(v * 0.992), 255)
    draw_bg.line([(0, y), (CANVAS_W, y)], fill=color)

# Overhead softbox highlight
softbox = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sb = ImageDraw.Draw(softbox)
d_sb.ellipse([int(CANVAS_W * 0.05), int(CANVAS_H * 0.05), int(CANVAS_W * 0.95), int(CANVAS_H * 0.65)], fill=(255, 255, 255, 80))
softbox = softbox.filter(ImageFilter.GaussianBlur(95))
bg_canvas = Image.alpha_composite(bg_canvas, softbox)

# ---------------------------------------------------------------------------
# 5. Photorealistic Multi-Stage Ground & Shoulder Contact Shadows
# ---------------------------------------------------------------------------
print("\n[Step 5/6] Generating natural ground contact shadows and shoulder shadow...")

def build_contact_shadow(canvas_size, center_x, ground_y, width_rx, height_ry, opacity=110):
    shadow_img = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow_img)
    # Penumbra
    d.ellipse(
        [center_x - int(width_rx * 1.25), ground_y - int(height_ry * 1.1),
         center_x + int(width_rx * 1.25), ground_y + int(height_ry * 1.1)],
        fill=(35, 40, 52, int(opacity * 0.45))
    )
    s_soft = shadow_img.filter(ImageFilter.GaussianBlur(18))
    
    # Mid shadow
    s_mid = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d_m = ImageDraw.Draw(s_mid)
    d_m.ellipse(
        [center_x - width_rx, ground_y - height_ry,
         center_x + width_rx, ground_y + height_ry],
        fill=(25, 30, 42, int(opacity * 0.85))
    )
    s_mid = s_mid.filter(ImageFilter.GaussianBlur(10))
    
    # Umbra
    s_core = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d_c = ImageDraw.Draw(s_core)
    d_c.ellipse(
        [center_x - int(width_rx * 0.6), ground_y - int(height_ry * 0.4),
         center_x + int(width_rx * 0.6), ground_y + int(height_ry * 0.4)],
        fill=(15, 18, 25, int(opacity * 1.35))
    )
    s_core = s_core.filter(ImageFilter.GaussianBlur(3))
    
    res = Image.alpha_composite(s_soft, s_mid)
    return Image.alpha_composite(res, s_core)

shadow_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# A. Ground shadows for Human (two feet)
user_cx = user_x + scaled_user_w // 2
sh_u1 = build_contact_shadow((CANVAS_W, CANVAS_H), user_cx - 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
sh_u2 = build_contact_shadow((CANVAS_W, CANVAS_H), user_cx + 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_u1)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_u2)

# B. Ground shadows for Mickey Cat (feet + body base)
cat_cx = cat_x + int(scaled_cat_w * 0.50)
sh_cat = build_contact_shadow((CANVAS_W, CANVAS_H), cat_cx, TARGET_FEET_Y - 8, int(scaled_cat_w * 0.28), 16, opacity=95)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_cat)

# C. Ground shadow for Mouse
mouse_cx = mouse_x + int(scaled_mouse_w * 0.48)
sh_mouse = build_contact_shadow((CANVAS_W, CANVAS_H), mouse_cx, TARGET_FEET_Y + 14, int(scaled_mouse_w * 0.32), 10, opacity=110)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_mouse)

# Composite Background + Floor Shadows
composite = Image.alpha_composite(bg_canvas, shadow_canvas)

# ---------------------------------------------------------------------------
# 6. Multi-Layer Depth Compositing: Believable Shoulder Paw Contact
# ---------------------------------------------------------------------------
print("\n[Step 6/6] Compositing layers with realistic shoulder paw contact...")

# Layer 3: Mickey Cat Body Layer (Standing beside human on the left)
cat_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
cat_layer.paste(scaled_cat, (cat_x, cat_y), scaled_cat)
composite = Image.alpha_composite(composite, cat_layer)

# Layer 4: Authentic Hero User (Standing beside Mickey on the right)
user_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
user_layer.paste(scaled_user, (user_x, user_y), scaled_user)
composite = Image.alpha_composite(composite, user_layer)

# Layer 5: Shoulder Contact Shadow (cast by Mickey's paw directly onto the human's shoulder cloth)
shoulder_shadow_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sh = ImageDraw.Draw(shoulder_shadow_canvas)
d_sh.ellipse(
    [actual_paw_x - 35, actual_paw_y + 12, actual_paw_x + 35, actual_paw_y + 32],
    fill=(20, 24, 34, 120)
)
shoulder_shadow_canvas = shoulder_shadow_canvas.filter(ImageFilter.GaussianBlur(7))
composite = Image.alpha_composite(composite, shoulder_shadow_canvas)

# Layer 6: Mickey's Right Paw Contact Layer (Resting visibly ON TOP of the human's shoulder)
paw_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
paw_layer.paste(scaled_paw, (cat_x, cat_y), scaled_paw)
composite = Image.alpha_composite(composite, paw_layer)

# Layer 7: Brown Mouse (Foreground Mascot in front of their feet)
mouse_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
mouse_layer.paste(scaled_mouse, (mouse_x, mouse_y), scaled_mouse)
composite = Image.alpha_composite(composite, mouse_layer)

# ---------------------------------------------------------------------------
# 7. Final Output & V2-versus-V3 Comparison Sheet
# ---------------------------------------------------------------------------
final_v3 = composite.convert('RGB')
v3_output_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v3.png")
final_v3.save(v3_output_path, quality=98)
print(f"\n[SUCCESS] Improved V3 Prototype saved to: {v3_output_path}")

# Build V2-versus-V3 Comparison Sheet
if os.path.exists(V2_PATH):
    v2_img = Image.open(V2_PATH).convert('RGB')
    
    comp_w = CANVAS_W * 2 + 40
    comp_h = CANVAS_H + 90
    sheet = Image.new('RGB', (comp_w, comp_h), (245, 247, 250))
    d_sheet = ImageDraw.Draw(sheet)
    
    # Header bar
    d_sheet.rectangle([0, 0, comp_w, 75], fill=(15, 23, 42))
    
    # Paste V2 and V3
    sheet.paste(v2_img, (15, 80))
    sheet.paste(final_v3, (CANVAS_W + 25, 80))
    
    comp_sheet_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v2_vs_v3_comparison.png")
    sheet.save(comp_sheet_path, quality=96)
    print(f"[SUCCESS] V2 vs V3 Comparison sheet saved to: {comp_sheet_path}")

print("\n" + "=" * 65)
print("  THEME FUSION 2.0 V3 PROTOTYPE COMPLETE")
print("=" * 65)
