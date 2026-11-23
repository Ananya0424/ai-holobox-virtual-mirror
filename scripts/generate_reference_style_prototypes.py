"""
Script: Generate Reference-Style Group Composition Prototypes for All 3 Themes
==============================================================================
Themes Generated:
1. Dragon Kingdom: dragon_kingdom_reference_style.png
2. Horror Ghost:   horror_ghost_reference_style.png
3. Cartoon Friends: cartoon_friends_reference_style.png
Plus Comparison Sheet: prototype_themes_reference_style_comparison.png

Common Composition Rules:
- Real captured human in the DEAD CENTER from head to toe.
- Authentic face, hair, body, original clothing 100% preserved.
- Large, recognizable theme characters surrounding the human on both left and right sides.
- Different character heights and depths creating a rich group composition.
- Foreground characters near feet.
- Clean pure-white studio cyclorama background with multi-stage floor contact shadows.
- Consistent lighting, perspective, scale, and image sharpness.
- Exact 720x1280 portrait resolution.
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
THEME_DIR = os.path.join(PROJECT_ROOT, "public", "Images", "themes")
U2NET_PATH = os.path.join(PROJECT_ROOT, "models", ".u2net", "u2net.onnx")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "test_outputs", "theme_fusion_prototype")
os.makedirs(OUTPUT_DIR, exist_ok=True)

CANVAS_W, CANVAS_H = 720, 1280
TARGET_FEET_Y = 1180
TARGET_USER_H = 950

print("=" * 65)
print("  GENERATING REFERENCE-STYLE THEME PROTOTYPES (3 THEMES)")
print(f"  Target Resolution: {CANVAS_W}x{CANVAS_H} Portrait")
print("=" * 65)

# ---------------------------------------------------------------------------
# 1. Extract & Refine Authentic Human Subject (Centered Hero)
# ---------------------------------------------------------------------------
print("\n[Step 1/5] Extracting & refining authentic human cutout...")
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

# Scale human to 950px height and center horizontally
user_scale = TARGET_USER_H / float(crop_h)
scaled_user_w = int(round(crop_w * user_scale))
scaled_user_h = TARGET_USER_H
scaled_user = user_pil.resize((scaled_user_w, scaled_user_h), Image.Resampling.LANCZOS)

user_x = (CANVAS_W - scaled_user_w) // 2 # Exact center at X = 188
user_y = TARGET_FEET_Y - scaled_user_h  # Y = 230
print(f"  Human hero placed in DEAD CENTER: {scaled_user_w}x{scaled_user_h} at ({user_x}, {user_y}) | Ground = {TARGET_FEET_Y}")

# ---------------------------------------------------------------------------
# Helper Functions: Character Extraction & Contact Shadows
# ---------------------------------------------------------------------------
def extract_clean_rgba(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Asset not found at {image_path}")
    diff = 255 - np.min(img, axis=2).astype(np.float32)
    sat = np.max(img, axis=2).astype(np.float32) - np.min(img, axis=2).astype(np.float32)
    solid = (diff > 16) | (sat > 12)
    ys, xs = np.where(solid)
    if not len(xs):
        return None
    pad = 6
    y_min = max(0, int(ys.min()) - pad)
    y_max = min(img.shape[0] - 1, int(ys.max()) + pad)
    x_min = max(0, int(xs.min()) - pad)
    x_max = min(img.shape[1] - 1, int(xs.max()) + pad)
    
    crop = img[y_min:y_max+1, x_min:x_max+1]
    c_diff = diff[y_min:y_max+1, x_min:x_max+1]
    c_sat = sat[y_min:y_max+1, x_min:x_max+1]
    
    alpha = np.zeros(crop.shape[:2], dtype=np.float32)
    c_solid = (c_diff > 16) | (c_sat > 12)
    alpha[c_solid] = 1.0
    soft = (~c_solid) & (c_diff > 4)
    alpha[soft] = (c_diff[soft] - 4.0) / 12.0
    alpha = (np.clip(alpha, 0, 1) * 255).astype(np.uint8)
    
    rgba = np.dstack([crop, alpha])
    return Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA))

def build_studio_cyclorama():
    bg = Image.new('RGBA', (CANVAS_W, CANVAS_H), (255, 255, 255, 255))
    draw_bg = ImageDraw.Draw(bg)
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
    return Image.alpha_composite(bg, softbox)

def add_contact_shadow(shadow_canvas, center_x, ground_y, width_rx, height_ry, opacity=110):
    s_img = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(s_img)
    # Penumbra
    d.ellipse(
        [center_x - int(width_rx * 1.3), ground_y - int(height_ry * 1.1),
         center_x + int(width_rx * 1.3), ground_y + int(height_ry * 1.1)],
        fill=(35, 40, 52, int(opacity * 0.45))
    )
    s_soft = s_img.filter(ImageFilter.GaussianBlur(18))
    
    # Mid
    s_mid = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    d_m = ImageDraw.Draw(s_mid)
    d_m.ellipse(
        [center_x - width_rx, ground_y - height_ry,
         center_x + width_rx, ground_y + height_ry],
        fill=(25, 30, 42, int(opacity * 0.85))
    )
    s_mid = s_mid.filter(ImageFilter.GaussianBlur(10))
    
    # Umbra
    s_core = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    d_c = ImageDraw.Draw(s_core)
    d_c.ellipse(
        [center_x - int(width_rx * 0.6), ground_y - int(height_ry * 0.4),
         center_x + int(width_rx * 0.6), ground_y + int(height_ry * 0.4)],
        fill=(15, 18, 25, int(opacity * 1.35))
    )
    s_core = s_core.filter(ImageFilter.GaussianBlur(3))
    
    res = Image.alpha_composite(s_soft, s_mid)
    combined = Image.alpha_composite(res, s_core)
    return Image.alpha_composite(shadow_canvas, combined)

# ---------------------------------------------------------------------------
# 2. Theme 1: Dragon Kingdom
# ---------------------------------------------------------------------------
print("\n[Step 2/5] Synthesizing Theme 1: Dragon Kingdom...")
d1_img = extract_clean_rgba(os.path.join(THEME_DIR, "Dragon1.webp")) # Gold dragon
d2_img = extract_clean_rgba(os.path.join(THEME_DIR, "dragon2.webp")) # Blue winged dragon
d3_img = extract_clean_rgba(os.path.join(THEME_DIR, "dragon3.webp")) # Red crested dragon

# Composition Layout:
# 1. Left Winged Dragon (d2): Scale H=620, placed on left (X=-60..300, Y=260..880)
#    Its massive wing arches behind the human's left shoulder to create a fantasy frame!
d2_h = 620
d2_w = int(round(d2_img.size[0] * (d2_h / float(d2_img.size[1]))))
d2_scaled = d2_img.resize((d2_w, d2_h), Image.Resampling.LANCZOS)
d2_x, d2_y = -30, 260

# 2. Right Gold Dragon (d1): Scale H=760, placed on right (X=360..700, Y=420..1180)
#    Stands beside the human's right side, looking inward toward her!
d1_h = 760
d1_w = int(round(d1_img.size[0] * (d1_h / float(d1_img.size[1]))))
d1_scaled = d1_img.resize((d1_w, d1_h), Image.Resampling.LANCZOS)
d1_x = CANVAS_W - int(d1_w * 0.70) # Comfortably framed on the right
d1_y = TARGET_FEET_Y - d1_h + 10

# 3. Foreground Red Dragon (d3): Scale H=280, placed near feet on the left/center
d3_h = 280
d3_w = int(round(d3_img.size[0] * (d3_h / float(d3_img.size[1]))))
d3_scaled = d3_img.resize((d3_w, d3_h), Image.Resampling.LANCZOS)
d3_x, d3_y = 100, TARGET_FEET_Y - d3_h + 15

# Composite Dragon Kingdom
dragon_canvas = build_studio_cyclorama()
d_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# Ground shadows: Human + Gold Dragon + Foreground Dragon
user_cx = user_x + scaled_user_w // 2
d_shadow = add_contact_shadow(d_shadow, user_cx - 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
d_shadow = add_contact_shadow(d_shadow, user_cx + 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
d_shadow = add_contact_shadow(d_shadow, d1_x + int(d1_w * 0.45), TARGET_FEET_Y - 6, 80, 18, opacity=100)
d_shadow = add_contact_shadow(d_shadow, d3_x + int(d3_w * 0.50), TARGET_FEET_Y + 10, 45, 12, opacity=110)

dragon_canvas = Image.alpha_composite(dragon_canvas, d_shadow)

# Layer 3: Left Winged Dragon (Frames behind human on left)
dragon_canvas.paste(d2_scaled, (d2_x, d2_y), d2_scaled)

# Layer 4: Right Gold Dragon (Standing beside human on right)
dragon_canvas.paste(d1_scaled, (d1_x, d1_y), d1_scaled)

# Layer 5: Authentic Central Human Hero
dragon_canvas.paste(scaled_user, (user_x, user_y), scaled_user)

# Layer 6: Foreground Red Dragon Mascot
dragon_canvas.paste(d3_scaled, (d3_x, d3_y), d3_scaled)

dragon_output_path = os.path.join(OUTPUT_DIR, "dragon_kingdom_reference_style.png")
dragon_canvas.convert('RGB').save(dragon_output_path, quality=98)
print(f"  [SUCCESS] Dragon Kingdom saved to: {dragon_output_path}")

# ---------------------------------------------------------------------------
# 3. Theme 2: Horror Ghost
# ---------------------------------------------------------------------------
print("\n[Step 3/5] Synthesizing Theme 2: Horror Ghost...")
h1_img = extract_clean_rgba(os.path.join(THEME_DIR, "horror1.webp")) # Tall shrouded reaper
h2_img = extract_clean_rgba(os.path.join(THEME_DIR, "horror2.webp")) # Tall ghost
h3_img = extract_clean_rgba(os.path.join(THEME_DIR, "horror3.webp")) # Lurking ghost left
h4_img = extract_clean_rgba(os.path.join(THEME_DIR, "horror4.webp")) # Horror doll creatures

# Composition Layout:
# 1. Tall Right Ghost (h2): Scale H=820, placed on right behind shoulder (X=360..680, Y=200..1020)
h2_h = 820
h2_w = int(round(h2_img.size[0] * (h2_h / float(h2_img.size[1]))))
h2_scaled = h2_img.resize((h2_w, h2_h), Image.Resampling.LANCZOS)
h2_x = CANVAS_W - int(h2_w * 0.90)
h2_y = 200

# 2. Left Lurking Ghost (h3): Scale H=780, placed on left beside shoulder (X=40..340, Y=240..1020)
h3_h = 780
h3_w = int(round(h3_img.size[0] * (h3_h / float(h3_img.size[1]))))
h3_scaled = h3_img.resize((h3_w, h3_h), Image.Resampling.LANCZOS)
h3_x = 20
h3_y = 240

# 3. Foreground Horror Creatures (h4): Scale H=300, placed near feet
h4_h = 300
h4_w = int(round(h4_img.size[0] * (h4_h / float(h4_img.size[1]))))
h4_scaled = h4_img.resize((h4_w, h4_h), Image.Resampling.LANCZOS)
h4_x = (CANVAS_W - h4_w) // 2
h4_y = TARGET_FEET_Y - h4_h + 15

horror_canvas = build_studio_cyclorama()
h_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# Shadows
h_shadow = add_contact_shadow(h_shadow, user_cx - 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
h_shadow = add_contact_shadow(h_shadow, user_cx + 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
h_shadow = add_contact_shadow(h_shadow, h2_x + h2_w // 2, TARGET_FEET_Y - 4, 75, 16, opacity=85)
h_shadow = add_contact_shadow(h_shadow, h3_x + h3_w // 2, TARGET_FEET_Y - 4, 70, 16, opacity=85)
h_shadow = add_contact_shadow(h_shadow, h4_x + h4_w // 2, TARGET_FEET_Y + 12, 60, 12, opacity=120)

horror_canvas = Image.alpha_composite(horror_canvas, h_shadow)

# Layer 3: Left Lurking Ghost
horror_canvas.paste(h3_scaled, (h3_x, h3_y), h3_scaled)

# Layer 4: Right Shrouded Ghost
horror_canvas.paste(h2_scaled, (h2_x, h2_y), h2_scaled)

# Layer 5: Authentic Central Human Hero
horror_canvas.paste(scaled_user, (user_x, user_y), scaled_user)

# Layer 6: Ghost spectral contact shadow on shoulder
sh_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
d_sh = ImageDraw.Draw(sh_shadow)
d_sh.ellipse([user_x + scaled_user_w - 90, user_y + 190, user_x + scaled_user_w - 30, user_y + 225], fill=(20, 25, 35, 125))
sh_shadow = sh_shadow.filter(ImageFilter.GaussianBlur(6))
horror_canvas = Image.alpha_composite(horror_canvas, sh_shadow)

# Layer 7: Foreground Horror Creatures
horror_canvas.paste(h4_scaled, (h4_x, h4_y), h4_scaled)

horror_output_path = os.path.join(OUTPUT_DIR, "horror_ghost_reference_style.png")
horror_canvas.convert('RGB').save(horror_output_path, quality=98)
print(f"  [SUCCESS] Horror Ghost saved to: {horror_output_path}")

# ---------------------------------------------------------------------------
# 4. Theme 3: Cartoon Friends
# ---------------------------------------------------------------------------
print("\n[Step 4/5] Synthesizing Theme 3: Cartoon Friends...")
c1_img = extract_clean_rgba(os.path.join(THEME_DIR, "Cartoon1.webp"))
c2_img = extract_clean_rgba(os.path.join(THEME_DIR, "Cartoon2.webp"))
c3_img = extract_clean_rgba(os.path.join(THEME_DIR, "Cartoon3.webp"))

# Composition Layout:
# 1. Right Cartoon Mascot (c1): Scale H=760, placed on right side (X=360..680, Y=420..1180)
c1_h = 760
c1_w = int(round(c1_img.size[0] * (c1_h / float(c1_img.size[1]))))
c1_scaled = c1_img.resize((c1_w, c1_h), Image.Resampling.LANCZOS)
c1_x = CANVAS_W - int(c1_w * 0.70)
c1_y = TARGET_FEET_Y - c1_h + 10

# 2. Left Playful Companion (c2): Scale H=740, placed on left side (X=30..340, Y=440..1180)
c2_h = 740
c2_w = int(round(c2_img.size[0] * (c2_h / float(c2_img.size[1]))))
c2_scaled = c2_img.resize((c2_w, c2_h), Image.Resampling.LANCZOS)
c2_x = 20
c2_y = TARGET_FEET_Y - c2_h + 10

# 3. Foreground Mascot Critters (c3): Scale H=260, placed near feet in center
c3_h = 260
c3_w = int(round(c3_img.size[0] * (c3_h / float(c3_img.size[1]))))
c3_scaled = c3_img.resize((c3_w, c3_h), Image.Resampling.LANCZOS)
c3_x = (CANVAS_W - c3_w) // 2
c3_y = TARGET_FEET_Y - c3_h + 12

cartoon_canvas = build_studio_cyclorama()
c_shadow = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

# Shadows
c_shadow = add_contact_shadow(c_shadow, user_cx - 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
c_shadow = add_contact_shadow(c_shadow, user_cx + 42, TARGET_FEET_Y - 2, 42, 12, opacity=115)
c_shadow = add_contact_shadow(c_shadow, c1_x + int(c1_w * 0.45), TARGET_FEET_Y - 6, 75, 16, opacity=95)
c_shadow = add_contact_shadow(c_shadow, c2_x + int(c2_w * 0.50), TARGET_FEET_Y - 6, 75, 16, opacity=95)
c_shadow = add_contact_shadow(c_shadow, c3_x + c3_w // 2, TARGET_FEET_Y + 10, 50, 12, opacity=110)

cartoon_canvas = Image.alpha_composite(cartoon_canvas, c_shadow)

# Layer 3: Left Playful Cartoon Companion
cartoon_canvas.paste(c2_scaled, (c2_x, c2_y), c2_scaled)

# Layer 4: Right Cartoon Mascot
cartoon_canvas.paste(c1_scaled, (c1_x, c1_y), c1_scaled)

# Layer 5: Authentic Central Human Hero
cartoon_canvas.paste(scaled_user, (user_x, user_y), scaled_user)

# Layer 6: Foreground Mascot Critters
cartoon_canvas.paste(c3_scaled, (c3_x, c3_y), c3_scaled)

cartoon_output_path = os.path.join(OUTPUT_DIR, "cartoon_friends_reference_style.png")
cartoon_canvas.convert('RGB').save(cartoon_output_path, quality=98)
print(f"  [SUCCESS] Cartoon Friends saved to: {cartoon_output_path}")

# ---------------------------------------------------------------------------
# 5. Build 3-Theme Comparison Sheet & Biometric Verification
# ---------------------------------------------------------------------------
print("\n[Step 5/5] Building 3-Theme Comparison Sheet & Verifying Identity...")

comp_w = CANVAS_W * 3 + 60
comp_h = CANVAS_H + 90
sheet = Image.new('RGB', (comp_w, comp_h), (245, 247, 250))
d_sheet = ImageDraw.Draw(sheet)

# Header bar
d_sheet.rectangle([0, 0, comp_w, 75], fill=(15, 23, 42))

# Labels
font_scale = 1
# Paste 3 theme prototypes side by side
sheet.paste(Image.open(dragon_output_path), (15, 80))
sheet.paste(Image.open(horror_output_path), (CANVAS_W + 30, 80))
sheet.paste(Image.open(cartoon_output_path), (CANVAS_W * 2 + 45, 80))

comp_sheet_path = os.path.join(OUTPUT_DIR, "prototype_themes_reference_style_comparison.png")
sheet.save(comp_sheet_path, quality=96)
print(f"  [SUCCESS] 3-Theme Comparison Sheet saved to: {comp_sheet_path}")

# Biometric Verification on all 3 outputs
from scripts.face_identity import ArcFaceAnalyzer
face_analyzer = ArcFaceAnalyzer()
ref_face = face_analyzer.extract_identity(Image.open(INPUT_IMG_PATH).convert('RGB'))

# Crop human face area (X: 250..470, Y: 220..390)
crop_box = (250, 220, 470, 390)
for theme_name, out_path in [("Dragon Kingdom", dragon_output_path), ("Horror Ghost", horror_output_path), ("Cartoon Friends", cartoon_output_path)]:
    theme_pil = Image.open(out_path)
    h_face = face_analyzer.extract_identity(theme_pil.crop(crop_box))
    if ref_face and h_face:
        emb1 = ref_face['embedding']
        emb2 = h_face['embedding']
        sim = float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
        print(f"  [BIOMETRIC VERIFICATION] {theme_name:18s} ArcFace Cosine Similarity: {sim:.4f}")

print("\n" + "=" * 65)
print("  ALL 3 REFERENCE-STYLE PROTOTYPES GENERATED SUCCESSFULLY")
print("=" * 65)
