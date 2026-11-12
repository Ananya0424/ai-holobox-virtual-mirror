import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

os.makedirs('public/Images/outfits', exist_ok=True)

configs = {
    'Female pilot.png': {'top_clear': 196, 'scoop_y': 224, 'scoop_w': 80, 'name': 'female_pilot_outfit.png'},
    'female doctor.png': {'top_clear': 202, 'scoop_y': 234, 'scoop_w': 85, 'name': 'female_doctor_outfit.png'},
    'Female Astronout.png': {'top_clear': 210, 'scoop_y': 238, 'scoop_w': 95, 'name': 'female_astronaut_outfit.png'},
    'Female police.png': {'top_clear': 200, 'scoop_y': 228, 'scoop_w': 80, 'name': 'female_police_outfit.png'},
    'female employee.png': {'top_clear': 196, 'scoop_y': 224, 'scoop_w': 75, 'name': 'female_business_outfit.png'},
    'Male Pilot.png': {'top_clear': 205, 'scoop_y': 232, 'scoop_w': 85, 'name': 'male_pilot_outfit.png'},
    'Male Doctor.png': {'top_clear': 200, 'scoop_y': 228, 'scoop_w': 85, 'name': 'male_doctor_outfit.png'},
    'Male Astronout.png': {'top_clear': 210, 'scoop_y': 238, 'scoop_w': 100, 'name': 'male_astronaut_outfit.png'},
    'Male police.png': {'top_clear': 210, 'scoop_y': 238, 'scoop_w': 85, 'name': 'male_police_outfit.png'},
    'Male Employee.png': {'top_clear': 200, 'scoop_y': 228, 'scoop_w': 85, 'name': 'male_business_outfit.png'},
}

for src_name, cfg in configs.items():
    src_path = os.path.join('public/Images', src_name)
    im = Image.open(src_path).convert('RGBA')
    w, h = im.size
    
    # 255 = keep, 0 = erase
    mask = Image.new('L', (w, h), 255)
    draw = ImageDraw.Draw(mask)
    
    # 1. Erase head completely above top_clear
    top_clear = cfg['top_clear']
    draw.rectangle([0, 0, w, top_clear], fill=0)
    
    # 2. Carve smooth curved scoop down to scoop_y for neck
    scoop_y = cfg['scoop_y']
    scoop_w = cfg['scoop_w']
    cx = w / 2
    draw.ellipse([cx - scoop_w/2, top_clear - 25, cx + scoop_w/2, scoop_y + 6], fill=0)
    
    # 3. Soften edge slightly (1.2px blur) for natural anti-aliased edge
    mask_blurred = mask.filter(ImageFilter.GaussianBlur(1.2))
    
    arr_im = np.array(im)
    arr_mask = np.array(mask_blurred) / 255.0
    arr_im[:, :, 3] = (arr_im[:, :, 3] * arr_mask).astype(np.uint8)
    
    result = Image.fromarray(arr_im)
    out_path = os.path.join('public/Images/outfits', cfg['name'])
    result.save(out_path)
    print("Processed:", cfg['name'])

print("All 10 outfits processed successfully!")
