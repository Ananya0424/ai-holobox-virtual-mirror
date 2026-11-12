#!/usr/bin/env python3
"""
Phase 3, 4 & 7 Verification Runner:
Tests all 5 professions on a genuine full-body standing photo AND tests
webcam portrait input + consecutive timing/VRAM telemetry (single model load).
"""

import os
import sys
import time
from PIL import Image, ImageDraw

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from ai_transform import AIStudioEngine

OUTPUT_DIR = "scripts/profession_verifications"
os.makedirs(OUTPUT_DIR, exist_ok=True)

FULL_BODY_FEMALE = "public/Images/female employee.png"
FULL_BODY_MALE = "public/Images/Male Employee.png"
WEBCAM_BUST = "scripts/doctor_verification/1_original_input.png"

engine = AIStudioEngine(models_dir='models')
engine.load_models()
print(f"\n[TELEMETRY] Initial Model Load Time: {engine.model_load_time:.2f}s")

PROFESSIONS = ['doctor', 'pilot', 'police', 'astronaut', 'business']
results = []

# 1. Test all 5 professions on full-body female photo
for prof in PROFESSIONS:
    print(f"\n>>> FULL-BODY TEST ({prof.upper()}) <<<")
    out_file = os.path.join(OUTPUT_DIR, f"fullbody_{prof}.jpg")
    res = engine.transform(FULL_BODY_FEMALE, prof, 'female', out_file)
    results.append((prof, out_file, res))

# 2. Test full-body male photo on Pilot & Doctor
male_doc = os.path.join(OUTPUT_DIR, "fullbody_male_doctor.jpg")
res_mdoc = engine.transform(FULL_BODY_MALE, 'doctor', 'male', male_doc)

male_pilot = os.path.join(OUTPUT_DIR, "fullbody_male_pilot.jpg")
res_mpilot = engine.transform(FULL_BODY_MALE, 'pilot', 'male', male_pilot)

# 3. Test webcam close-up bust shot on Doctor (verify neck mask works for bust too)
webcam_doc = os.path.join(OUTPUT_DIR, "webcam_doctor.jpg")
res_wdoc = engine.transform(WEBCAM_BUST, 'doctor', 'female', webcam_doc)

# Build 6-panel Full-Body Master Gallery
PANEL_W, PANEL_H = 360, 640
orig_img = Image.open(FULL_BODY_FEMALE)
if orig_img.mode == 'RGBA':
    bg = Image.new('RGB', orig_img.size, (255, 255, 255))
    bg.paste(orig_img, mask=orig_img.split()[-1])
    orig_img = bg
else:
    orig_img = orig_img.convert('RGB')
orig_panel = Image.new('RGB', (PANEL_W, PANEL_H), (255, 255, 255))
s = min(PANEL_W / float(orig_img.width), PANEL_H / float(orig_img.height))
rw, rh = int(orig_img.width * s), int(orig_img.height * s)
orig_panel.paste(orig_img.resize((rw, rh), Image.Resampling.LANCZOS), ((PANEL_W - rw) // 2, (PANEL_H - rh) // 2))

panels = [("ORIGINAL INPUT", orig_panel)]
for prof, out_file, res in results:
    p_img = Image.open(out_file).resize((PANEL_W, PANEL_H), Image.Resampling.LANCZOS)
    panels.append((f"{prof.upper()} ({res['total_seconds']}s)", p_img))

sheet_w = PANEL_W * len(panels) + (len(panels) + 1) * 20
sheet_h = PANEL_H + 120
master_sheet = Image.new('RGB', (sheet_w, sheet_h), (15, 23, 42))
draw = ImageDraw.Draw(master_sheet)
draw.rectangle([0, 0, sheet_w, 60], fill=(2, 132, 199))
draw.text((28, 22), "HOLOBOX FULL-BODY AI TRANSFORMATION GALLERY (SD 1.5 INPAINTING + U2-NET STUDIO)", fill=(255, 255, 255))

for i, (label, p_img) in enumerate(panels):
    x = 20 + i * (PANEL_W + 20)
    y = 80
    master_sheet.paste(p_img, (x, y))
    draw.rectangle([x - 2, y - 2, x + PANEL_W + 2, y + PANEL_H + 2], outline=(51, 65, 85), width=2)
    draw.rectangle([x, y + PANEL_H + 6, x + PANEL_W, y + PANEL_H + 34], fill=(30, 41, 59))
    draw.text((x + 12, y + PANEL_H + 12), label, fill=(255, 255, 255))

gallery_path = os.path.join(OUTPUT_DIR, "master_5_profession_gallery.png")
master_sheet.save(gallery_path, quality=95)
print(f"\nSaved Full-Body Master Gallery: {gallery_path}")

# Also build Doctor Mask + Original + Generated Comparison Sheet (both Full-Body & Webcam)
doc_mask_path = os.path.join(OUTPUT_DIR, "fullbody_doctor_mask.png")
doc_mask = Image.open(doc_mask_path).convert('RGB').resize((PANEL_W, PANEL_H), Image.Resampling.LANCZOS)
doc_gen = Image.open(os.path.join(OUTPUT_DIR, "fullbody_doctor.jpg")).resize((PANEL_W, PANEL_H), Image.Resampling.LANCZOS)

comp_panels = [
    ("1. ORIGINAL FULL-BODY", orig_panel),
    ("2. DYNAMIC NECK+BODY MASK", doc_mask),
    ("3. GENERATED DOCTOR", doc_gen),
    ("4. MALE PILOT", Image.open(male_pilot).resize((PANEL_W, PANEL_H), Image.Resampling.LANCZOS)),
    ("5. WEBCAM DOCTOR", Image.open(webcam_doc).resize((PANEL_W, PANEL_H), Image.Resampling.LANCZOS)),
]
cw = PANEL_W * len(comp_panels) + (len(comp_panels) + 1) * 20
comp = Image.new('RGB', (cw, PANEL_H + 120), (15, 23, 42))
cd = ImageDraw.Draw(comp)
cd.rectangle([0, 0, cw, 60], fill=(2, 132, 199))
cd.text((28, 22), "HOLOBOX IDENTITY & MASK VERIFICATION (FULL-BODY + MALE + WEBCAM BUST)", fill=(255, 255, 255))
for i, (label, p_img) in enumerate(comp_panels):
    x = 20 + i * (PANEL_W + 20)
    comp.paste(p_img, (x, 80))
    cd.rectangle([x, 80 + PANEL_H + 6, x + PANEL_W, 80 + PANEL_H + 34], fill=(30, 41, 59))
    cd.text((x + 12, 80 + PANEL_H + 12), label, fill=(255, 255, 255))

comp_path = os.path.join(OUTPUT_DIR, "identity_mask_comparison.png")
comp.save(comp_path, quality=95)
print(f"Saved Identity & Mask Comparison: {comp_path}")
