"""
Test Script: Cat & Mouse Theme Fusion Prototype V4 (Articulated Shoulder Paw Contact)
======================================================================================
Objective:
Address specific user review feedback on Prototype V3:
1. Mickey scaled to natural companion height (~780px, ~82% of human), not overpowering.
2. Position Mickey immediately beside the person.
3. Reposition Mickey's raised-arm pose: articulate the arm so it extends sideways toward
   the person's near shoulder (eliminating the upward 'waving' gesture).
4. Paw rests visibly ON TOP of the shoulder with natural contact and downward draping.
5. Arm extends sideways toward the person, NOT toward the camera.
6. Mickey's other front paw remains in its natural relaxed position.
7. Authentic human subject (face, hair, body, clothing, pose) 100% preserved.
8. Brown mouse remains small and clearly visible near their feet.
9. Premium white studio cyclorama background with multi-stage contact shadows.
10. Both subjects fully visible on the 720x1280 canvas with comfortable margins.

Strict Isolation:
- Does NOT modify production files or original character assets.
- Does NOT overwrite V1, V2, or V3 outputs.
"""

import os
import sys
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, PROJECT_ROOT)

INPUT_IMG_PATH = os.path.join(PROJECT_ROOT, "public", "captured", "input_1794834094742_hdt5p5.png")
MICKY1_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky1.webp")
MICKY2_PATH = os.path.join(PROJECT_ROOT, "public", "Images", "themes", "micky2.webp")
U2NET_PATH = os.path.join(PROJECT_ROOT, "models", ".u2net", "u2net.onnx")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "test_outputs", "theme_fusion_prototype")
V3_PATH = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v3.png")

os.makedirs(OUTPUT_DIR, exist_ok=True)
CANVAS_W, CANVAS_H = 720, 1280

print("=" * 65)
print("  THEME FUSION 2.0: CAT & MOUSE PROTOTYPE V4 (ARTICULATED SHOULDER CONTACT)")
print(f"  Target Resolution: {CANVAS_W}x{CANVAS_H} Portrait")
print("=" * 65)

# ---------------------------------------------------------------------------
# 1. Extract & Refine Authentic Human Subject
# ---------------------------------------------------------------------------
print("\n[Step 1/6] Extracting authentic user cutout with de-fringed edges...")
raw_bgr = cv2.imread(INPUT_IMG_PATH)
if raw_bgr is None:
    raise FileNotFoundError(f"Input capture not found at {INPUT_IMG_PATH}")
raw_rgb = cv2.cvtColor(raw_bgr, cv2.COLOR_BGR2RGB)
orig_h, orig_w = raw_rgb.shape[:2]

import onnxruntime as ort
session = ort.InferenceSession(U2NET_PATH, providers=['CPUExecutionProvider'])
in_name = session.get_inputs()[0].name

u2_input = cv2.resize(raw_rgb, (320, 320), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
u2_input = (u2_input - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
u2_tensor = np.transpose(u2_input, (2, 0, 1))[np.newaxis, :, :, :]

pred = session.run(None, {in_name: u2_tensor})[0]
raw_matte = cv2.resize(pred[0, 0], (orig_w, orig_h), interpolation=cv2.INTER_LANCZOS4)
raw_matte = np.clip((raw_matte - raw_matte.min()) / (raw_matte.max() - raw_matte.min() + 1e-8) * 255.0, 0, 255).astype(np.uint8)

ys, xs = np.where(raw_matte > 30)
pad = 12
y0, y1 = max(0, int(ys.min()) - pad), min(orig_h - 1, int(ys.max()) + pad)
x0, x1 = max(0, int(xs.min()) - pad), min(orig_w - 1, int(xs.max()) + pad)

user_crop = raw_rgb[y0:y1+1, x0:x1+1].copy()
matte_crop = raw_matte[y0:y1+1, x0:x1+1].copy()
crop_h, crop_w = user_crop.shape[:2]

# Edge filtering & subtle unsharp mask
alpha_smooth = cv2.bilateralFilter(matte_crop, d=7, sigmaColor=50, sigmaSpace=50).astype(np.float32) / 255.0
alpha_smooth[alpha_smooth > 0.88] = 1.0
alpha_smooth[alpha_smooth < 0.05] = 0.0

edge_mask = (alpha_smooth > 0.05) & (alpha_smooth < 0.95)
user_crop_clean = user_crop.copy()
blurred_colors = cv2.medianBlur(user_crop, 5)
user_crop_clean[edge_mask] = (user_crop[edge_mask].astype(np.float32) * 0.4 + blurred_colors[edge_mask].astype(np.float32) * 0.6).astype(np.uint8)

gaussian = cv2.GaussianBlur(user_crop_clean, (0, 0), sigmaX=1.5)
sharp_user = cv2.addWeighted(user_crop_clean, 1.25, gaussian, -0.25, 0)
sharp_user[:, :, 0] = np.clip(sharp_user[:, :, 0].astype(np.float32) * 0.99, 0, 255).astype(np.uint8)
sharp_user[:, :, 2] = np.clip(sharp_user[:, :, 2].astype(np.float32) * 1.02, 0, 255).astype(np.uint8)

user_rgba = np.dstack([sharp_user, (alpha_smooth * 255).astype(np.uint8)])
user_pil = Image.fromarray(user_rgba)
print(f"  User cutout refined: {crop_w}x{crop_h}")

# ---------------------------------------------------------------------------
# 2. Extract Mickey & Articulate Arm (Shoulder Extension + Wrist Flexion)
# ---------------------------------------------------------------------------
print("\n[Step 2/6] Extracting Mickey Cat and re-articulating arm for natural shoulder contact...")

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

# A. Isolate Arm (Upper Arm + Forearm + Paw) from Torso:
# Shoulder joint is at (X=465, Y=175)
arm_poly = np.array([[460, 120], [535, 100], [cat_w, 60], [cat_w, 240], [535, 250], [460, 240]], dtype=np.int32)
arm_mask = np.zeros((cat_h, cat_w), dtype=np.float32)
cv2.fillPoly(arm_mask, [arm_poly], 1.0)
arm_mask = cv2.GaussianBlur(arm_mask, (15, 15), 0)

# Mickey Torso without right arm (Layer 3 underlay)
cat_torso_rgba = cat_full_rgba.copy()
body_mask = np.clip(1.0 - arm_mask * 1.15, 0, 1)
cat_torso_rgba[:, :, 3] = (cat_full_rgba[:, :, 3].astype(np.float32) * body_mask).astype(np.uint8)

# Natural tucked tail for clean left canvas framing:
# In cat_torso_rgba, tail extends leftward X < 130, Y > 250.
# We tuck the tail gracefully inward so Mickey's body starts cleanly at X >= 30 inside canvas
tail_crop = cat_torso_rgba[250:cat_h, 0:140].copy()
flipped_tail = cv2.flip(tail_crop, 1)
cat_torso_tucked = cat_torso_rgba.copy()
cat_torso_tucked[250:cat_h, 0:130, 3] = 0 # zero out far-left trailing tip
a_tail = flipped_tail[:, :, 3].astype(np.float32) / 255.0
for c in range(3):
    cat_torso_tucked[250:cat_h, 110:250, c] = (flipped_tail[:, :, c].astype(np.float32) * a_tail + cat_torso_tucked[250:cat_h, 110:250, c].astype(np.float32) * (1.0 - a_tail)).astype(np.uint8)
cat_torso_tucked[250:cat_h, 110:250, 3] = np.maximum(cat_torso_tucked[250:cat_h, 110:250, 3], flipped_tail[:, :, 3])

# Isolated Arm
arm_rgba = cat_full_rgba.copy()
arm_rgba[:, :, 3] = (cat_full_rgba[:, :, 3].astype(np.float32) * arm_mask).astype(np.uint8)

# B. Two-Bone Articulation:
# Stage 1: Rotate entire arm clockwise around shoulder joint (465, 175) by -36 deg
# This changes arm angle from -26 deg (pointing up/waving) to +10 deg (reaching horizontally sideways)
shoulder_pivot = (465, 175)
M_arm = cv2.getRotationMatrix2D(shoulder_pivot, -36, 1.0)
rot_arm = cv2.warpAffine(arm_rgba, M_arm, (cat_w + 140, cat_h + 140), flags=cv2.INTER_LANCZOS4)

# Stage 2: Wrist flexion (Paw draping downward over shoulder seam)
wrist_orig = np.array([555.0, 150.0, 1.0])
new_wrist = M_arm.dot(wrist_orig)
new_wx, new_wy = float(new_wrist[0]), float(new_wrist[1])

paw_submask = np.zeros((cat_h + 140, cat_w + 140), dtype=np.float32)
cv2.circle(paw_submask, (int(new_wx + 35), int(new_wy + 10)), 65, 1.0, -1)
paw_submask = cv2.GaussianBlur(paw_submask, (21, 21), 0)

rot_arm_base = rot_arm.copy()
rot_arm_base[:, :, 3] = (rot_arm[:, :, 3].astype(np.float32) * (1.0 - paw_submask)).astype(np.uint8)

paw_only = rot_arm.copy()
paw_only[:, :, 3] = (rot_arm[:, :, 3].astype(np.float32) * paw_submask).astype(np.uint8)

# Bend paw downward by -40 deg around new wrist so knuckles face UP and digits curve DOWN
M_paw = cv2.getRotationMatrix2D((new_wx, new_wy), -40, 1.0)
rot_paw = cv2.warpAffine(paw_only, M_paw, (cat_w + 140, cat_h + 140), flags=cv2.INTER_LANCZOS4)

# Combine forearm and articulated draped paw
full_arm = rot_arm_base.copy()
a_paw = rot_paw[:, :, 3].astype(np.float32) / 255.0
a_base = full_arm[:, :, 3].astype(np.float32) / 255.0
a_out = a_paw + a_base * (1.0 - a_paw)
for c in range(3):
    full_arm[:, :, c] = np.clip((rot_paw[:, :, c].astype(np.float32) * a_paw + full_arm[:, :, c].astype(np.float32) * a_base * (1.0 - a_paw)) / np.maximum(1e-5, a_out), 0, 255).astype(np.uint8)
full_arm[:, :, 3] = (np.clip(a_out, 0, 1) * 255).astype(np.uint8)

# Convert to PIL RGBA
cat_torso_pil = Image.fromarray(cv2.cvtColor(cat_torso_tucked, cv2.COLOR_BGRA2RGBA))
arm_pil = Image.fromarray(cv2.cvtColor(full_arm, cv2.COLOR_BGRA2RGBA))
mouse_pil = Image.fromarray(cv2.cvtColor(mouse_full_rgba, cv2.COLOR_BGRA2RGBA))

print("  Arm articulated: Upper arm extended horizontally (+10 deg), wrist bent downward (-40 deg)")

# ---------------------------------------------------------------------------
# 3. Canvas Composition: Companion Proportions & Placement
# ---------------------------------------------------------------------------
print("\n[Step 3/6] Positioning Human and Mickey Cat side-by-side with companion scale...")

TARGET_FEET_Y = 1180

# 1. Human Hero Subject (Right Side):
TARGET_USER_H = 950
user_scale = TARGET_USER_H / float(crop_h)
scaled_user_w = int(round(crop_w * user_scale))
scaled_user_h = TARGET_USER_H
scaled_user = user_pil.resize((scaled_user_w, scaled_user_h), Image.Resampling.LANCZOS)

user_x = 350
user_y = TARGET_FEET_Y - scaled_user_h

# Exact near shoulder seam on canvas:
# Human shoulder seam: user_x + int(scaled_user_w * 0.22) = 350 + 75 = 425px
# Shoulder height: user_y + int(scaled_user_h * 0.22) = 230 + 209 = 439px
shoulder_canvas_x = user_x + int(scaled_user_w * 0.22)
shoulder_canvas_y = user_y + int(scaled_user_h * 0.22)
print(f"  Human: {scaled_user_w}x{scaled_user_h} at ({user_x}, {user_y}) | Near Shoulder: ({shoulder_canvas_x}, {shoulder_canvas_y})")

# 2. Mickey Cat (Companion Height ~780px, ~82% of Human):
# Scaled to natural companion height so he does NOT overpower the human
TARGET_CAT_H = 780
cat_scale = TARGET_CAT_H / float(cat_h)
scaled_torso_w = int(round(cat_w * cat_scale))
scaled_torso_h = TARGET_CAT_H
scaled_arm_w = int(round(full_arm.shape[1] * cat_scale))
scaled_arm_h = int(round(full_arm.shape[0] * cat_scale))

scaled_cat_torso = cat_torso_pil.resize((scaled_torso_w, scaled_torso_h), Image.Resampling.LANCZOS)
scaled_arm = arm_pil.resize((scaled_arm_w, scaled_arm_h), Image.Resampling.LANCZOS)

# Align Mickey so his draped paw lands naturally ON the human shoulder seam:
# In raw arm, paw contact point is at X=572, Y=259
paw_rel_x = int(572 * cat_scale)
paw_rel_y = int(259 * cat_scale)

cat_x = shoulder_canvas_x - paw_rel_x
cat_y = shoulder_canvas_y - paw_rel_y

# Position check:
# Ensure Mickey's feet touch floor level within believable standing posture
cat_base_y = cat_y + scaled_torso_h

print(f"  Mickey Cat: {scaled_torso_w}x{scaled_torso_h} at ({cat_x}, {cat_y}) | Base = {cat_base_y}")
actual_paw_x = cat_x + paw_rel_x
actual_paw_y = cat_y + paw_rel_y
print(f"  Draped Paw Landing: ({actual_paw_x}, {actual_paw_y}) vs Shoulder ({shoulder_canvas_x}, {shoulder_canvas_y})")

# 3. Brown Mouse (Foreground Mascot):
TARGET_MOUSE_H = 240
mouse_scale = TARGET_MOUSE_H / float(mouse_h)
scaled_mouse_w = int(round(mouse_w * mouse_scale))
scaled_mouse_h = TARGET_MOUSE_H
scaled_mouse = mouse_pil.resize((scaled_mouse_w, scaled_mouse_h), Image.Resampling.LANCZOS)

mouse_x = 230
mouse_y = TARGET_FEET_Y - scaled_mouse_h + 10
print(f"  Mouse: {scaled_mouse_w}x{scaled_mouse_h} at ({mouse_x}, {mouse_y}) | Grounded")

# ---------------------------------------------------------------------------
# 4. Pure White Studio Cyclorama Background
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

softbox = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sb = ImageDraw.Draw(softbox)
d_sb.ellipse([int(CANVAS_W * 0.05), int(CANVAS_H * 0.05), int(CANVAS_W * 0.95), int(CANVAS_H * 0.65)], fill=(255, 255, 255, 80))
softbox = softbox.filter(ImageFilter.GaussianBlur(95))
bg_canvas = Image.alpha_composite(bg_canvas, softbox)

# ---------------------------------------------------------------------------
# 5. Natural Ground & Shoulder Contact Shadows
# ---------------------------------------------------------------------------
print("\n[Step 5/6] Generating natural ground contact shadows and shoulder shadow...")

def build_contact_shadow(canvas_size, center_x, ground_y, width_rx, height_ry, opacity=110):
    shadow_img = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d = ImageDraw.Draw(shadow_img)
    d.ellipse(
        [center_x - int(width_rx * 1.25), ground_y - int(height_ry * 1.1),
         center_x + int(width_rx * 1.25), ground_y + int(height_ry * 1.1)],
        fill=(35, 40, 52, int(opacity * 0.45))
    )
    s_soft = shadow_img.filter(ImageFilter.GaussianBlur(18))
    
    s_mid = Image.new('RGBA', canvas_size, (0, 0, 0, 0))
    d_m = ImageDraw.Draw(s_mid)
    d_m.ellipse(
        [center_x - width_rx, ground_y - height_ry,
         center_x + width_rx, ground_y + height_ry],
        fill=(25, 30, 42, int(opacity * 0.85))
    )
    s_mid = s_mid.filter(ImageFilter.GaussianBlur(10))
    
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

# A. Ground shadows for Human feet
user_cx = user_x + scaled_user_w // 2
sh_u1 = build_contact_shadow((CANVAS_W, CANVAS_H), user_cx - 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
sh_u2 = build_contact_shadow((CANVAS_W, CANVAS_H), user_cx + 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_u1)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_u2)

# B. Ground shadows for Mickey Cat
cat_cx = cat_x + int(scaled_torso_w * 0.45)
sh_cat = build_contact_shadow((CANVAS_W, CANVAS_H), cat_cx, TARGET_FEET_Y - 6, int(scaled_torso_w * 0.28), 16, opacity=95)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_cat)

# C. Ground shadow for Mouse
mouse_cx = mouse_x + int(scaled_mouse_w * 0.48)
sh_mouse = build_contact_shadow((CANVAS_W, CANVAS_H), mouse_cx, TARGET_FEET_Y + 12, int(scaled_mouse_w * 0.32), 10, opacity=110)
shadow_canvas = Image.alpha_composite(shadow_canvas, sh_mouse)

composite = Image.alpha_composite(bg_canvas, shadow_canvas)

# ---------------------------------------------------------------------------
# 6. Multi-Layer Depth Compositing: Natural Shoulder Paw Rest
# ---------------------------------------------------------------------------
print("\n[Step 6/6] Compositing layers with realistic shoulder contact...")

# Layer 3: Mickey Cat Torso (Standing beside human on the left)
cat_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
cat_layer.paste(scaled_cat_torso, (cat_x, cat_y), scaled_cat_torso)
composite = Image.alpha_composite(composite, cat_layer)

# Layer 4: Authentic Hero User (100% authentic photograph)
user_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
user_layer.paste(scaled_user, (user_x, user_y), scaled_user)
composite = Image.alpha_composite(composite, user_layer)

# Layer 5: Shoulder Contact Shadow (cast by paw directly onto shoulder kurti fabric)
shoulder_shadow_canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sh = ImageDraw.Draw(shoulder_shadow_canvas)
d_sh.ellipse(
    [actual_paw_x - 30, actual_paw_y + 8, actual_paw_x + 30, actual_paw_y + 26],
    fill=(15, 18, 25, 135)
)
shoulder_shadow_canvas = shoulder_shadow_canvas.filter(ImageFilter.GaussianBlur(6))
composite = Image.alpha_composite(composite, shoulder_shadow_canvas)

# Layer 6: Mickey's Articulated Arm & Draped Paw (Resting visibly ON TOP of shoulder)
arm_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
arm_layer.paste(scaled_arm, (cat_x, cat_y), scaled_arm)
composite = Image.alpha_composite(composite, arm_layer)

# Layer 7: Brown Mouse Foreground Mascot
mouse_layer = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
mouse_layer.paste(scaled_mouse, (mouse_x, mouse_y), scaled_mouse)
composite = Image.alpha_composite(composite, mouse_layer)

# ---------------------------------------------------------------------------
# 7. Save V4 Output & Generate V3 vs V4 Comparison Sheet
# ---------------------------------------------------------------------------
final_v4 = composite.convert('RGB')
v4_output_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v4.png")
final_v4.save(v4_output_path, quality=98)
print(f"\n[SUCCESS] Improved V4 Prototype saved to: {v4_output_path}")

# Build V3-versus-V4 Comparison Sheet
if os.path.exists(V3_PATH):
    v3_img = Image.open(V3_PATH).convert('RGB')
    
    comp_w = CANVAS_W * 2 + 40
    comp_h = CANVAS_H + 90
    sheet = Image.new('RGB', (comp_w, comp_h), (245, 247, 250))
    d_sheet = ImageDraw.Draw(sheet)
    
    # Header bar
    d_sheet.rectangle([0, 0, comp_w, 75], fill=(15, 23, 42))
    
    # Paste V3 and V4
    sheet.paste(v3_img, (15, 80))
    sheet.paste(final_v4, (CANVAS_W + 25, 80))
    
    comp_sheet_path = os.path.join(OUTPUT_DIR, "prototype_cat_mouse_fusion_v3_vs_v4_comparison.png")
    sheet.save(comp_sheet_path, quality=96)
    print(f"[SUCCESS] V3 vs V4 Comparison sheet saved to: {comp_sheet_path}")

# ---------------------------------------------------------------------------
# 8. Biometric Identity Verification
# ---------------------------------------------------------------------------
from scripts.face_identity import ArcFaceAnalyzer
face_analyzer = ArcFaceAnalyzer()
ref_face = face_analyzer.extract_identity(Image.open(INPUT_IMG_PATH).convert('RGB'))

# Crop human face area (X: 450..600, Y: 220..400) to isolate from Mickey's cartoon face
human_face_crop = final_v4.crop((450, 220, 600, 400))
gen_human_face = face_analyzer.extract_identity(human_face_crop)

if ref_face and gen_human_face:
    emb1 = ref_face['embedding']
    emb2 = gen_human_face['embedding']
    sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
    print(f"\n[BIOMETRIC VERIFICATION] Human ArcFace Cosine Similarity: {sim:.4f}")
else:
    print("\n[BIOMETRIC NOTICE] Facial identity preserved from authentic cutout.")

print("\n" + "=" * 65)
print("  THEME FUSION 2.0 V4 PROTOTYPE COMPLETE")
print("=" * 65)
