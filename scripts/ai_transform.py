#!/usr/bin/env python3
"""
AI-Powered Full-Body Identity-Preserving Transformation Engine
- Face identity conditioning: InsightFace buffalo_l (512-d ArcFace embedding)
  + OpenCLIP ViT-H-14 aligned face crop -> IP-Adapter-FaceID-PlusV2 (with FaceID LoRA).
- Full-body pose guidance: ControlNet OpenPose (head-to-feet COCO-18 skeleton).
- Photorealistic generator: Realistic Vision v5.1 FP16 (with sequential model CPU offload
  for reliable execution within RTX 3050 6GB VRAM).
- Closed-loop identity verification: compares generated face embedding against reference
  webcam face and retries/tunes conditioning if cosine similarity is low.
- High-res 1080x1920 pure white studio compositing with offline U2-Net segmentation.
"""

import os
import sys
import gc
import time
import base64
import io
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

try:
    from scripts.face_identity import (
        ArcFaceAnalyzer,
        build_standing_fullbody_openpose,
    )
except ImportError:
    from face_identity import (
        ArcFaceAnalyzer,
        build_standing_fullbody_openpose,
    )

# ---------------------------------------------------------------------------
# PROFESSION-SPECIFIC FULL-BODY PROMPT & DESIGN DEFINITIONS
# ---------------------------------------------------------------------------
UNIVERSAL_NEGATIVE_PROMPT = (
    "cgi, 3d render, plastic skin, airbrushed, smooth skin, doll, wax figure, mannequin, illustration, cartoon, anime, "
    "overweight, obese, fat, chubby, wide waist, bulky torso, baggy coat, puffy sleeves, swollen cheeks, "
    "deformed face, altered face, asymmetrical eyes, cross-eyed, extra head, duplicate person, extra arms, extra legs, "
    "extra fingers, deformed hands, missing feet, cut off legs, cropped, half body, waist up, bust shot, bad anatomy, "
    "lowres, blurry, artifacts, gray wall, outdoor clutter, watermark, text, logo, signature"
)

PROFESSION_CONFIGS = {
    'doctor': {
        'prompt': (
            "candid DSLR studio photograph shot on 85mm lens, full-length standing {gender_word} head to feet, "
            "natural skin texture and pores, crisp woven cotton white medical lab coat, stethoscope around neck, "
            "sky blue cotton scrubs, real white sneakers on bright seamless white studio floor, natural softbox light"
        ),
        'negative_prompt': UNIVERSAL_NEGATIVE_PROMPT + ", patterned, plaid, floral, polka dots, hospital gown, embroidery, badge text",
        'seed': 109,
    },
    'pilot': {
        'prompt': (
            "candid DSLR studio photograph shot on 85mm lens, full-length standing commercial pilot {gender_word} head to feet, "
            "natural skin texture and pores, tailored wool navy captain blazer jacket, gold shoulder epaulettes, white cotton shirt, "
            "navy tie, tailored navy trousers, real leather shoes on bright seamless white studio floor"
        ),
        'negative_prompt': UNIVERSAL_NEGATIVE_PROMPT + ", sequins, glitter, gold jacket, pilot helmet",
        'seed': 224,
    },
    'police': {
        'prompt': (
            "candid DSLR studio photograph shot on 85mm lens, full-length standing police officer {gender_word} head to feet, "
            "natural skin texture and pores, crisp navy cotton police uniform shirt with metal chest badge and epaulettes, "
            "black tie, leather duty belt, navy trousers, black leather boots on bright seamless white studio floor"
        ),
        'negative_prompt': UNIVERSAL_NEGATIVE_PROMPT,
        'seed': 312,
    },
    'astronaut': {
        'prompt': (
            "candid DSLR studio photograph shot on 85mm lens, full-length standing {gender_word} astronaut head to feet, "
            "natural skin texture and pores, uncovered bare hair, realistic heavy white woven NASA flight crew spacesuit with front zipper, "
            "embroidered patch, utility straps, boots standing on bright seamless white studio floor"
        ),
        'negative_prompt': UNIVERSAL_NEGATIVE_PROMPT + ", helmet, space helmet, visor, plastic suit, armor, toy suit",
        'seed': 416,
    },
    'business': {
        'prompt': (
            "candid DSLR studio photograph shot on 85mm lens, full-length standing executive {gender_word} head to feet, "
            "natural skin texture and pores, tailored charcoal wool suit jacket, crisp white cotton dress shirt, silk tie, "
            "charcoal trousers, polished leather dress shoes on bright seamless white studio floor"
        ),
        'negative_prompt': UNIVERSAL_NEGATIVE_PROMPT + ", polka dots, patterned suit, dress",
        'seed': 719,
    },
}

UNSAFE_PROMPT_TERMS = {
    'nude', 'naked', 'nsfw', 'lingerie', 'bikini', 'underwear', 'bra', 'panties',
    'topless', 'shirtless', 'explicit', 'porn', 'porno', 'erotic', 'sexual', 'sex',
    'fetish', 'blood', 'gore', 'violent', 'weapon', 'gun', 'rifle', 'knife',
    'kill', 'murder', 'terrorist', 'suicide', 'drugs', 'cocaine',
}


def validate_custom_prompt(prompt_text):
    """Validates custom outfit prompts against empty, oversized, or unsafe terms."""
    if not prompt_text or not isinstance(prompt_text, str):
        raise ValueError("Custom outfit description cannot be empty.")
    cleaned = prompt_text.strip()
    if len(cleaned) < 3:
        raise ValueError("Please describe your custom outfit in at least 3 characters.")
    if len(cleaned) > 200:
        raise ValueError("Custom outfit description is too long (maximum 200 characters).")
    import re
    words = set(re.findall(r"[a-zA-Z]+", cleaned.lower()))
    blocked = words & UNSAFE_PROMPT_TERMS
    if blocked:
        raise ValueError("That custom outfit prompt is not supported in this kiosk. Please choose appropriate attire.")
    return cleaned


def clean_profession_key(prof_raw):
    """Normalizes profession string to one of the 5 canonical keys."""
    prof = (prof_raw or 'doctor').lower().strip()
    if 'doc' in prof or 'medic' in prof or 'health' in prof:
        return 'doctor'
    if 'pil' in prof or 'avia' in prof or 'cap' in prof or 'flight' in prof:
        return 'pilot'
    if 'pol' in prof or 'cop' in prof or 'law' in prof or 'offic' in prof:
        return 'police'
    if 'ast' in prof or 'spa' in prof or 'cosmo' in prof:
        return 'astronaut'
    if 'bus' in prof or 'exec' in prof or 'corp' in prof or 'suit' in prof or 'emp' in prof:
        return 'business'
    return 'doctor'


class AIStudioEngine:
    """
    Reusable AI Studio Engine holding:
    - CPU ONNX U2-Net segmentation + InsightFace buffalo_l ArcFace embedder
    - CPU/on-demand GPU OpenCLIP ViT-H-14 face-crop encoder
    - GPU offloaded SD 1.5 Realistic Vision v5.1 + ControlNet OpenPose + IP-Adapter FaceID Plus v2
    """

    def __init__(self, models_dir='models'):
        self.models_dir = models_dir
        self.u2net_session = None
        self.face_analyzer = None
        self.clip_image_encoder = None
        self.clip_processor = None
        self.gen_pipe = None
        self.sd_pipe = None
        self.refine_pipe = None
        self.device = 'cpu'
        self.dtype = None
        self.model_load_time = 0.0

    def _resolve_local_dir(self, local_subpath, hf_repo_id):
        """Returns verified local models directory if complete, else HF repo id."""
        local_dir = os.path.join(self.models_dir, 'studio_sd15', local_subpath)
        if os.path.isdir(local_dir) and len(os.listdir(local_dir)) > 0:
            return local_dir
        return hf_repo_id

    def load_models(self):
        """Loads all vision, identity, pose, and diffusion components once into memory."""
        if self.gen_pipe is not None and self.face_analyzer is not None and self.u2net_session is not None:
            return

        t0 = time.time()
        import onnxruntime as ort
        import torch
        from transformers import CLIPVisionModelWithProjection, CLIPImageProcessor
        from diffusers import (
            ControlNetModel,
            StableDiffusionControlNetPipeline,
            StableDiffusionImg2ImgPipeline,
            DPMSolverSinglestepScheduler,
        )

        # 1. Offline U2-Net ONNX (CPU -> 0 MB VRAM)
        u2net_path = os.path.join(self.models_dir, '.u2net', 'u2net.onnx')
        if not os.path.exists(u2net_path):
            u2net_path = os.path.join(self.models_dir, 'models', 'u2net', 'u2net.onnx')
        if not os.path.exists(u2net_path):
            raise FileNotFoundError(f"Offline u2net.onnx not found in {self.models_dir}")
        self.u2net_session = ort.InferenceSession(u2net_path, providers=['CPUExecutionProvider'])

        # 2. Offline InsightFace buffalo_l ONNX (CPU -> 0 MB VRAM)
        ins_dir = os.path.join(self.models_dir, 'insightface', 'buffalo_l')
        self.face_analyzer = ArcFaceAnalyzer(model_dir=ins_dir)

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32

        # 3. OpenCLIP ViT-H-14 Image Encoder (kept on CPU until encoding single face crop -> 0 MB denoising VRAM)
        enc_local = os.path.join(self.models_dir, 'studio_sd15', 'image_encoder')
        if os.path.exists(os.path.join(enc_local, 'model.safetensors')):
            self.clip_image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                enc_local,
                torch_dtype=self.dtype,
                local_files_only=True,
            )
        else:
            self.clip_image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                "h94/IP-Adapter",
                subfolder="models/image_encoder",
                torch_dtype=self.dtype,
                local_files_only=True,
            )
        self.clip_processor = CLIPImageProcessor(size=224, crop_size=224)

        # 4. ControlNet OpenPose FP16
        cn_src = self._resolve_local_dir('controlnet_openpose', 'lllyasviel/control_v11p_sd15_openpose')
        controlnet = ControlNetModel.from_pretrained(
            cn_src,
            torch_dtype=self.dtype,
            variant="fp16" if self.device == "cuda" else None,
            local_files_only=True,
        )

        # 5. Realistic Vision v5.1 Base Pipeline + ControlNet
        rv_src = self._resolve_local_dir('rv51', 'stablediffusionapi/realistic-vision-v51')
        self.gen_pipe = StableDiffusionControlNetPipeline.from_pretrained(
            rv_src,
            controlnet=controlnet,
            torch_dtype=self.dtype,
            safety_checker=None,
            requires_safety_checker=False,
            local_files_only=True,
        )
        self.gen_pipe.scheduler = DPMSolverSinglestepScheduler.from_config(
            self.gen_pipe.scheduler.config,
            use_karras_sigmas=True,
        )

        # 6. Load IP-Adapter-FaceID-PlusV2 (512-d ArcFace + ViT-H-14 face crop + FaceID LoRA)
        ipa_local = os.path.join(self.models_dir, 'studio_sd15', 'ip-adapter-faceid-plusv2_sd15.bin')
        if os.path.exists(ipa_local):
            self.gen_pipe.load_ip_adapter(
                os.path.dirname(ipa_local),
                subfolder=None,
                weight_name=os.path.basename(ipa_local),
                image_encoder_folder=None,
                local_files_only=True,
            )
        else:
            self.gen_pipe.load_ip_adapter(
                "h94/IP-Adapter-FaceID",
                subfolder=None,
                weight_name="ip-adapter-faceid-plusv2_sd15.bin",
                image_encoder_folder=None,
                local_files_only=True,
            )

        proj_layer = self.gen_pipe.unet.encoder_hid_proj.image_projection_layers[0]
        proj_layer.shortcut = True
        proj_layer.shortcut_scale = 1.0

        # Apply FaceID Plus v2 LoRA if present locally (sharpens facial structure & jawline likeness)
        lora_local = os.path.join(self.models_dir, 'studio_sd15', 'ip-adapter-faceid-plusv2_sd15_lora.safetensors')
        if os.path.exists(lora_local):
            self.gen_pipe.load_lora_weights(
                os.path.dirname(lora_local),
                weight_name=os.path.basename(lora_local),
                adapter_name="faceid_lora",
            )
            self.gen_pipe.set_adapters(["faceid_lora"], adapter_weights=[0.80])

        # 7. Sequential CPU offloading + VAE slicing (do NOT call enable_attention_slicing as it overwrites IPAdapterAttnProcessor)
        if self.device == "cuda":
            self.gen_pipe.enable_vae_slicing()
            self.gen_pipe.enable_vae_tiling()
            self.gen_pipe.enable_model_cpu_offload()
        else:
            self.gen_pipe.to(self.device)

        # Share exact loaded UNet/VAE/TextEncoder/IP-Adapter/LoRA weights (0 extra VRAM) for crisp Stage-2 face refinement
        self.refine_pipe = StableDiffusionImg2ImgPipeline(
            vae=self.gen_pipe.vae,
            text_encoder=self.gen_pipe.text_encoder,
            tokenizer=self.gen_pipe.tokenizer,
            unet=self.gen_pipe.unet,
            scheduler=self.gen_pipe.scheduler,
            safety_checker=None,
            feature_extractor=None,
            requires_safety_checker=False,
        )
        self.sd_pipe = self.gen_pipe

        self.model_load_time = time.time() - t0
        gpu_name = torch.cuda.get_device_name(0) if self.device == "cuda" else "CPU"
        print(f"[AIStudioEngine] FaceID+OpenPose pipeline ready on {gpu_name} in {self.model_load_time:.2f}s")

    def extract_person_matte(self, rgb_img):
        """Runs offline U2-Net ONNX segmentation; returns uint8 grayscale alpha array (H, W)."""
        if self.u2net_session is None:
            self.load_models()

        w, h = rgb_img.size
        im_res = rgb_img.resize((320, 320), Image.Resampling.BILINEAR)
        arr = np.array(im_res, dtype=np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        inp = np.transpose(arr, (2, 0, 1))[None, ...]

        input_name = self.u2net_session.get_inputs()[0].name
        pred = self.u2net_session.run(None, {input_name: inp})[0][0, 0]
        p_min, p_max = float(pred.min()), float(pred.max())
        if p_max - p_min > 1e-6:
            pred = (pred - p_min) / (p_max - p_min)
        else:
            pred = np.ones_like(pred)

        matte_img = Image.fromarray((pred * 255).astype(np.uint8), mode='L').resize((w, h), Image.Resampling.BICUBIC)
        return np.array(matte_img, dtype=np.uint8)

    def _compute_faceid_plusv2_embeds(self, face_info):
        """
        Builds (2, 1, 512) ArcFace embeds + (2, 1, 257, 1280) OpenCLIP face-crop hidden states.
        Temporarily uses GPU for OpenCLIP (<50ms) and offloads back to CPU to save VRAM.
        """
        import torch

        pos_id = torch.from_numpy(face_info["embedding"]).reshape(1, 1, 512).to(dtype=self.dtype)
        neg_id = torch.zeros_like(pos_id)
        combined_id = torch.cat([neg_id, pos_id], dim=0)

        pix = self.clip_processor(images=face_info["face_crop_224"], return_tensors="pt").pixel_values
        pix = pix.to(device=self.device, dtype=self.dtype)
        if self.device == "cuda":
            self.clip_image_encoder.to("cuda")
        with torch.inference_mode():
            pos_clip = self.clip_image_encoder(pix, output_hidden_states=True).hidden_states[-2]
            neg_clip = self.clip_image_encoder(torch.zeros_like(pix), output_hidden_states=True).hidden_states[-2]
        if self.device == "cuda":
            self.clip_image_encoder.to("cpu")
            torch.cuda.empty_cache()

        combined_clip = torch.cat([neg_clip, pos_clip], dim=0).unsqueeze(1).to(device=self.device, dtype=self.dtype)
        return combined_id, combined_clip

    def _classify_input_framing_and_pose(self, orig_rgb, orig_alpha_arr, face_info, gender="female"):
        """
        Determines whether input is 'face_only', 'head_and_shoulders', or 'full_body'
        and returns the corresponding 512x768 OpenPose standing skeleton image.
        """
        TARGET_W, TARGET_H = 512, 768
        src_w, src_h = orig_rgb.size
        scale = min((TARGET_W - 24) / float(src_w), (TARGET_H - 24) / float(src_h))
        fit_w = max(64, int(round(src_w * scale)))
        fit_h = max(64, int(round(src_h * scale)))
        resized_rgb = orig_rgb.resize((fit_w, fit_h), Image.Resampling.LANCZOS)

        if orig_alpha_arr is not None and np.mean(orig_alpha_arr < 20) > 0.15:
            matte_fit = np.array(
                Image.fromarray(orig_alpha_arr, mode='L').resize((fit_w, fit_h), Image.Resampling.LANCZOS)
            )
        else:
            matte_fit = self.extract_person_matte(resized_rgb)

        _, fy1, _, fy2 = face_info["bbox"]
        face_h_frac = (fy2 - fy1) / float(max(1, src_h))

        bin_fit = matte_fit > 100
        bys, bxs = np.where(bin_fit)
        is_full_body = False
        full_matte = None

        if len(bys) > 200:
            b_h = max(1, int(bys.max()) - int(bys.min()))
            b_w = max(1, int(bxs.max()) - int(bxs.min()))
            aspect = b_h / float(b_w)
            is_full_body = (aspect >= 2.00) and (b_h > fit_h * 0.55) and (face_h_frac < 0.22)
            if is_full_body:
                full_matte = np.zeros((TARGET_H, TARGET_W), dtype=np.uint8)
                px = (TARGET_W - fit_w) // 2
                py = (TARGET_H - fit_h) // 2
                full_matte[py:py + fit_h, px:px + fit_w] = matte_fit

        if is_full_body:
            framing = 'full_body'
        elif face_h_frac < 0.48:
            framing = 'head_and_shoulders'
        else:
            framing = 'face_only'

        openpose_img = build_standing_fullbody_openpose(TARGET_W, TARGET_H, fullbody_matte=full_matte, gender=gender)
        return framing, openpose_img

    def _refine_fullbody_hires(
        self,
        gen_pil,
        prompt,
        neg_prompt,
        combined_id_embeds,
        combined_clip_embeds,
        ip_scale,
        shortcut_scale,
        seed,
    ):
        """
        Stage-2 Full-Body Hires-Fix at 768x1152 using DPM++ SDE Karras.
        Adds authentic woven cloth texture, realistic folds, stitching, and hand/shoe sharpness
        across the entire figure so clothing never looks waxy or upscaled at 1080x1920.
        """
        import torch

        hires_init = gen_pil.resize((768, 1152), Image.Resampling.LANCZOS)
        proj_layer = self.refine_pipe.unet.encoder_hid_proj.image_projection_layers[0]
        proj_layer.shortcut = True
        proj_layer.shortcut_scale = shortcut_scale
        proj_layer.clip_embeds = combined_clip_embeds
        self.refine_pipe.set_ip_adapter_scale(ip_scale)

        try:
            with torch.inference_mode():
                return self.refine_pipe(
                    prompt=prompt,
                    negative_prompt=neg_prompt,
                    image=hires_init,
                    ip_adapter_image_embeds=[combined_id_embeds],
                    strength=0.36,
                    num_inference_steps=16,
                    guidance_scale=4.4,
                    generator=torch.Generator(device="cpu").manual_seed(seed),
                ).images[0]
        except Exception as err:
            print(f"[AIStudioEngine] Body hires pass skipped cleanly: {err}")
            return hires_init

    def _refine_face_identity(
        self,
        hi_pil,
        combined_id_embeds,
        combined_clip_embeds,
        gender_word,
        ip_scale,
        shortcut_scale,
        seed,
        orig_rgb=None,
        face_orig=None,
    ):
        """
        Stage-3 512x512 DSLR identity-anchored harmonization pass:
        1. Aligns the user's real camera face via 5-landmark similarity transform onto the generated head.
        2. Matches inner-face LAB luminance & white-studio exposure cleanly into the generated skin tone.
        3. Runs low-CFG FaceID-PlusV2 diffusion harmonization (strength 0.36) so pores, shadows,
           eyeglasses, nose, lips, and skin blend into a seamless studio photograph with zero sticker edge.
        """
        import cv2
        import torch

        faces = self.face_analyzer.detect_faces(hi_pil, det_size=640, thresh=0.35)
        if not faces:
            return hi_pil

        gf = faces[0]
        x1, y1, x2, y2 = gf["bbox"]
        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        side = max(240, int(round(max(x2 - x1, y2 - y1) * 1.95)))
        hw = side // 2
        W, H = hi_pil.size
        bx0 = max(0, min(W - side, int(round(cx - hw))))
        by0 = max(0, min(H - side, int(round(cy - hw))))
        bx1 = min(W, bx0 + side)
        by1 = min(H, by0 + side)
        cw = bx1 - bx0
        ch = by1 - by0

        crop = hi_pil.crop((bx0, by0, bx1, by1))
        has_landmark_anchor = (
            orig_rgb is not None
            and face_orig is not None
            and face_orig.get("kps") is not None
            and gf.get("kps") is not None
        )

        strength_val = 0.56
        steps_val = 18
        crop_input = crop

        matched_orig_crop = None
        core_blend_mask = None

        if has_landmark_anchor:
            dst_kps_local = gf["kps"].astype(np.float32) - np.array([bx0, by0], dtype=np.float32)
            M, _ = cv2.estimateAffinePartial2D(
                face_orig["kps"].astype(np.float32),
                dst_kps_local,
                method=cv2.LMEDS,
            )
            if M is not None:
                orig_arr = np.array(orig_rgb)
                gen_crop_arr = np.array(crop)
                warped_orig = cv2.warpAffine(
                    orig_arr,
                    M,
                    (cw, ch),
                    flags=cv2.INTER_LANCZOS4,
                    borderMode=cv2.BORDER_REPLICATE,
                )

                # Jaw-tapered inner-face mask strictly inside cheekbones/brows/jawline
                eye_dist = float(np.linalg.norm(dst_kps_local[1] - dst_kps_local[0]))
                face_rx = max(24.0, eye_dist * 1.14)
                face_ry = max(32.0, eye_dist * 1.62)
                fcx = float((dst_kps_local[0, 0] + dst_kps_local[1, 0]) * 0.5)
                fcy = float(dst_kps_local[2, 1]) - face_ry * 0.06

                yy, xx = np.ogrid[:ch, :cw]
                taper = np.where(
                    yy <= fcy,
                    1.0,
                    np.maximum(0.65, 1.0 - 0.36 * np.clip((yy - fcy) / face_ry, 0.0, 1.0)),
                )
                ell = ((xx - fcx) / (face_rx * taper)) ** 2 + ((yy - fcy) / face_ry) ** 2
                inner_mask = np.clip(1.0 - np.clip((ell - 0.36) / 0.64, 0.0, 1.0), 0.0, 1.0)
                inner_mask = cv2.GaussianBlur(inner_mask.astype(np.float32), (0, 0), max(5.0, cw * 0.04))

                # Gently denoise webcam ISO grain while preserving crisp eye/glass/lip edges before LAB relighting
                warped_clean = cv2.bilateralFilter(warped_orig, d=5, sigmaColor=22, sigmaSpace=22)
                lab_src = cv2.cvtColor(warped_clean, cv2.COLOR_RGB2LAB).astype(np.float32)
                lab_tgt = cv2.cvtColor(gen_crop_arr, cv2.COLOR_RGB2LAB).astype(np.float32)
                core = ell <= 0.65
                if np.any(core):
                    for c_idx in range(3):
                        s_m = float(lab_src[core, c_idx].mean())
                        s_s = max(1e-3, float(lab_src[core, c_idx].std()))
                        t_m = float(lab_tgt[core, c_idx].mean())
                        t_s = max(1e-3, float(lab_tgt[core, c_idx].std()))
                        w_s = 0.80 if c_idx == 0 else 0.55
                        new_m = s_m * (1.0 - w_s) + t_m * w_s
                        new_std = s_s * (1.0 - w_s) + t_s * w_s
                        lab_src[:, :, c_idx] = np.clip((lab_src[:, :, c_idx] - s_m) * (new_std / s_s) + new_m, 0, 255)
                matched_orig = cv2.cvtColor(lab_src.astype(np.uint8), cv2.COLOR_LAB2RGB)
                matched_orig_crop = matched_orig

                # Lightly anchor crisp eyes/glasses/nose/mouth core while keeping clean studio skin pores
                core_blend = np.clip(1.0 - np.clip((ell - 0.22) / 0.36, 0.0, 1.0), 0.0, 1.0)
                core_blend = cv2.GaussianBlur(core_blend.astype(np.float32), (0, 0), max(4.0, cw * 0.03))
                core_blend_mask = (core_blend * 0.30)[:, :, None]

                pre_harm = np.clip(
                    gen_crop_arr.astype(np.float32) * (1.0 - inner_mask[:, :, None])
                    + matched_orig.astype(np.float32) * inner_mask[:, :, None],
                    0,
                    255,
                ).astype(np.uint8)
                crop_input = Image.fromarray(pre_harm)
                strength_val = 0.26
                steps_val = 26
                ip_scale = max(ip_scale, 0.92)
                shortcut_scale = max(shortcut_scale, 1.40)

        crop_512 = crop_input.resize((512, 512), Image.Resampling.LANCZOS)

        proj_layer = self.refine_pipe.unet.encoder_hid_proj.image_projection_layers[0]
        proj_layer.shortcut = True
        proj_layer.shortcut_scale = shortcut_scale
        proj_layer.clip_embeds = combined_clip_embeds
        self.refine_pipe.set_ip_adapter_scale(ip_scale)

        prompt = (
            f"candid DSLR studio portrait photograph of a real {gender_word}, "
            "natural human skin pores and subtle texture, unretouched natural features, crisp real eyes, soft diffused daylight"
        )
        neg = (
            "plastic skin, airbrushed, smooth skin, beauty filter, doll, wax, cgi, 3d render, makeup heavy, "
            "deformed face, altered face, asymmetrical eyes, cross-eyed, blurry, cartoon"
        )
        try:
            with torch.inference_mode():
                ref_512 = self.refine_pipe(
                    prompt=prompt,
                    negative_prompt=neg,
                    image=crop_512,
                    ip_adapter_image_embeds=[combined_id_embeds],
                    strength=strength_val,
                    num_inference_steps=steps_val,
                    guidance_scale=3.8,
                    generator=torch.Generator(device="cpu").manual_seed(seed),
                ).images[0]
        except Exception as ref_err:
            print(f"[AIStudioEngine] Face refine skipped due to error: {ref_err}")
            return hi_pil

        ref_resized = ref_512.resize((cw, ch), Image.Resampling.LANCZOS)
        if matched_orig_crop is not None and core_blend_mask is not None:
            ref_arr = np.array(ref_resized, dtype=np.float32)
            blended_arr = np.clip(
                ref_arr * (1.0 - core_blend_mask) + matched_orig_crop.astype(np.float32) * core_blend_mask,
                0,
                255,
            ).astype(np.uint8)
            ref_resized = Image.fromarray(blended_arr)

        # Smooth radial oval feather inside crop so outer collar/white backdrop transitions invisibly
        mask = Image.new("L", (cw, ch), 0)
        m_draw = ImageDraw.Draw(mask)
        mx0, my0 = int(cw * 0.14), int(ch * 0.12)
        m_draw.ellipse([mx0, my0, cw - mx0, ch - my0], fill=255)
        mask_blur = mask.filter(ImageFilter.GaussianBlur(max(14, cw // 9)))

        out_pil = hi_pil.copy()
        out_pil.paste(ref_resized, (bx0, by0), mask_blur)
        return out_pil

    def _build_prompts(self, profession, gender, custom_prompt):
        """Constructs full-length standing studio positive/negative prompts & deterministic seed."""
        gender_word = "woman" if "fem" in (gender or "female").lower() else "man"
        if custom_prompt and str(custom_prompt).strip():
            clean_custom = validate_custom_prompt(str(custom_prompt))
            final_prompt = (
                f"RAW photo, full-length full body studio photograph of a standing {gender_word} seen head to feet wearing {clean_custom}, "
                "complete outfit with matching footwear standing on studio floor, natural arms and hands at sides, "
                "sharp facial details, DSLR 85mm lens, soft studio lighting, pure white seamless background"
            )
            neg_prompt = UNIVERSAL_NEGATIVE_PROMPT + ", gray background, outdoor"
            chosen_seed = 600 + (sum(ord(c) for c in clean_custom) % 300)
        else:
            cfg = PROFESSION_CONFIGS[profession]
            final_prompt = cfg['prompt'].format(gender_word=gender_word) + ", slim natural proportions, slender tailored fit"
            neg_prompt = cfg['negative_prompt']
            chosen_seed = cfg['seed']
        return final_prompt, neg_prompt, chosen_seed

    def _composite_studio_1080x1920(self, gen_pil, output_path):
        """
        Places the high-res full-body photograph cleanly onto a 1080x1920 seamless pure-white
        Holobox canvas while preserving natural coat hems, edge antialiasing, and real floor shadows
        without harsh binary cutout halos or synthetic ellipse shadows.
        """
        from scipy.ndimage import binary_fill_holes, binary_dilation, gaussian_filter

        CANVAS_W, CANVAS_H = 1080, 1920
        studio_canvas = Image.new('RGB', (CANVAS_W, CANVAS_H), (255, 255, 255))

        gen_matte = self.extract_person_matte(gen_pil)
        fg_bin = gen_matte > 75
        ny, nx = np.where(fg_bin)
        if len(ny) > 300:
            gw, gh = gen_pil.size
            # Generous padding keeps natural floor contact shadow beneath shoes & full white coat silhouette
            crop_top = max(0, int(ny.min()) - int(gh * 0.03))
            crop_bot = min(gh, int(ny.max()) + int(gh * 0.045))
            crop_left = max(0, int(nx.min()) - int(gw * 0.05))
            crop_right = min(gw, int(nx.max()) + int(gw * 0.05))
            subj_crop = gen_pil.crop((crop_left, crop_top, crop_right, crop_bot))
            matte_crop = gen_matte[crop_top:crop_bot, crop_left:crop_right]
        else:
            subj_crop = gen_pil
            matte_crop = gen_matte

        max_subj_w = int(CANVAS_W * 0.88)
        max_subj_h = int(CANVAS_H * 0.84)
        subj_scale = min(max_subj_w / float(subj_crop.width), max_subj_h / float(subj_crop.height))
        draw_w = int(subj_crop.width * subj_scale)
        draw_h = int(subj_crop.height * subj_scale)
        subj_scaled = subj_crop.resize((draw_w, draw_h), Image.Resampling.LANCZOS)
        matte_scaled = np.array(
            Image.fromarray(matte_crop, mode='L').resize((draw_w, draw_h), Image.Resampling.BILINEAR)
        )

        # Preserve 100% of person/white coats & natural shoe contact shadow; lift seamless studio wall cleanly to #ffffff
        arr = np.array(subj_scaled, dtype=np.float32)
        min_rgb = arr.min(axis=2)
        fg_guard = binary_fill_holes(binary_dilation(matte_scaled > 65, iterations=12))

        # Protect smooth elliptical shoe contact shadow at bottom (no sharp rectangular shadow box)
        floor_band = np.zeros_like(fg_guard)
        yy, xx = np.ogrid[:draw_h, :draw_w]
        fy_c, fx_c = draw_h * 0.92, draw_w * 0.50
        fy_r, fx_r = max(12.0, draw_h * 0.055), max(40.0, draw_w * 0.26)
        floor_band = (((yy - fy_c) / fy_r) ** 2 + ((xx - fx_c) / fx_r) ** 2) <= 1.0

        # Estimate studio wall gray tone from top corners so any uniform studio sweep (e.g. RGB ~215..245) lifts 100% to 255
        corner_lum = min(float(min_rgb[:20, :20].mean()), float(min_rgb[:20, -20:].mean()))
        bg_thresh = max(145.0, min(210.0, corner_lum - 32.0))

        bg_candidate = (~fg_guard) & (~floor_band)
        white_lift = np.clip((min_rgb - bg_thresh) / 28.0, 0.0, 1.0)
        far_bg_alpha = gaussian_filter(bg_candidate.astype(np.float32) * white_lift, sigma=5.0)
        # Ensure far perimeter margin (> 26px from person) reaches pure white 1.0 cleanly
        outer_halo = ~binary_dilation(fg_guard | floor_band, iterations=14)
        far_bg_alpha = np.where(outer_halo & (min_rgb > 165.0), 1.0, far_bg_alpha)
        far_bg_alpha = gaussian_filter(far_bg_alpha, sigma=3.0)

        cleaned = arr * (1.0 - far_bg_alpha[:, :, None]) + 255.0 * far_bg_alpha[:, :, None]

        # Gentle edge taper ONLY if studio floor shadow reaches near outer frame borders
        edge_alpha = np.ones((draw_h, draw_w), dtype=np.float32)
        fade_px = 28
        for i in range(fade_px):
            t = (i + 1) / float(fade_px)
            edge_alpha[i, :] = np.minimum(edge_alpha[i, :], t)
            edge_alpha[draw_h - 1 - i, :] = np.minimum(edge_alpha[draw_h - 1 - i, :], t)
            edge_alpha[:, i] = np.minimum(edge_alpha[:, i], t)
            edge_alpha[:, draw_w - 1 - i] = np.minimum(edge_alpha[:, draw_w - 1 - i], t)

        # Fade floor tint toward pure white proportionally to luminance so contact shadows stay soft without a box border
        floor_soft = np.where(min_rgb > corner_lum - 14.0, 1.0 - np.clip((255.0 - min_rgb) / 48.0, 0.0, 1.0), 0.0)
        blended = cleaned * edge_alpha[:, :, None] + 255.0 * (1.0 - edge_alpha[:, :, None])
        # Lift very light pale background floor gray (> corner_lum - 8) softly outside body guard
        very_light_bg = (~fg_guard) & (min_rgb >= (corner_lum - 10.0))
        blended[very_light_bg] = (
            blended[very_light_bg] * (1.0 - floor_soft[very_light_bg, None] * 0.85)
            + 255.0 * (floor_soft[very_light_bg, None] * 0.85)
        )
        subj_clean = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8), mode='RGB')

        subj_x = (CANVAS_W - draw_w) // 2
        subj_y = int(CANVAS_H * 0.08) + max(0, (max_subj_h - draw_h) // 2)
        studio_canvas.paste(subj_clean, (subj_x, subj_y))

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        studio_canvas.save(output_path, 'JPEG', quality=95)

    def transform(
        self,
        input_source,
        profession_raw,
        gender,
        output_path,
        custom_prompt=None,
        progress_callback=None,
    ):
        """
        Executes full identity-conditioned + OpenPose full-body generation with
        closed-loop ArcFace cosine verification and writes 1080x1920 studio portrait.
        """
        import torch

        t_start = time.time()
        self.load_models()
        profession = clean_profession_key(profession_raw)

        if progress_callback:
            progress_callback(10, "Extracting facial identity & pose skeleton...")

        # 1. Load source image
        if isinstance(input_source, str) and input_source.startswith('data:image'):
            _, encoded = input_source.split(',', 1)
            orig_pil = Image.open(io.BytesIO(base64.b64decode(encoded)))
        elif isinstance(input_source, str) and os.path.exists(input_source):
            orig_pil = Image.open(input_source)
        else:
            raise ValueError("Invalid input image source")

        has_alpha = orig_pil.mode in ('RGBA', 'LA') or (orig_pil.mode == 'P' and 'transparency' in orig_pil.info)
        if has_alpha:
            orig_rgba = orig_pil.convert('RGBA')
            orig_alpha_arr = np.array(orig_rgba.split()[-1])
            orig_rgb = Image.new('RGB', orig_rgba.size, (255, 255, 255))
            orig_rgb.paste(orig_rgba, mask=orig_rgba.split()[-1])
        else:
            orig_rgb = orig_pil.convert('RGB')
            orig_alpha_arr = None

        # 2. Extract ArcFace 512-d identity + 224x224 face crop for FaceID Plus v2
        face_info = self.face_analyzer.extract_identity(orig_rgb)
        if face_info is None:
            raise ValueError("No clear face detected. Please stand centered facing the Holobox camera and try again.")

        combined_id_embeds, combined_clip_embeds = self._compute_faceid_plusv2_embeds(face_info)
        framing_type, openpose_img = self._classify_input_framing_and_pose(orig_rgb, orig_alpha_arr, face_info, gender=gender)
        final_prompt, neg_prompt, base_seed = self._build_prompts(profession, gender, custom_prompt)

        proj_layer = self.gen_pipe.unet.encoder_hid_proj.image_projection_layers[0]
        proj_layer.shortcut = True
        proj_layer.clip_embeds = combined_clip_embeds

        # Lower CFG (4.2-4.6) lets IP-Adapter FaceID + realistic textures dominate over plastic glamour bias
        ATTEMPT_CONFIGS = [
            {'ip_scale': 0.78, 'shortcut_scale': 1.15, 'cn_scale': 0.88, 'cfg': 4.6, 'steps': 24, 'seed_off': 0},
            {'ip_scale': 0.88, 'shortcut_scale': 1.30, 'cn_scale': 0.92, 'cfg': 4.2, 'steps': 26, 'seed_off': 137},
            {'ip_scale': 0.96, 'shortcut_scale': 1.42, 'cn_scale': 0.95, 'cfg': 3.9, 'steps': 26, 'seed_off': 271},
        ]

        if self.device == "cuda":
            torch.cuda.reset_peak_memory_stats()

        TARGET_W, TARGET_H = 512, 768
        best_result = None
        total_gen_latency = 0.0
        attempts_used = 0
        gender_word = "woman" if "fem" in (gender or "female").lower() else "man"

        for idx, cfg_try in enumerate(ATTEMPT_CONFIGS):
            attempts_used = idx + 1
            base_pct = 20 + idx * 24
            if progress_callback:
                progress_callback(base_pct, f"Generating full-body {profession} portrait (pass {attempts_used})...")

            self.gen_pipe.set_ip_adapter_scale(cfg_try['ip_scale'])
            proj_layer.shortcut_scale = cfg_try['shortcut_scale']
            total_steps = cfg_try['steps']

            def step_cb(_pipe, step_idx, _timestep, callback_kwargs, b_pct=base_pct, t_st=total_steps):
                if progress_callback:
                    pct = min(88, b_pct + int(((step_idx + 1) / float(t_st)) * 22))
                    progress_callback(pct, f"AI Diffusion step {step_idx + 1}/{t_st}...")
                return callback_kwargs

            t_inf = time.time()
            try:
                with torch.inference_mode():
                    gen_pil = self.gen_pipe(
                        prompt=final_prompt,
                        negative_prompt=neg_prompt,
                        image=openpose_img,
                        controlnet_conditioning_scale=cfg_try['cn_scale'],
                        ip_adapter_image_embeds=[combined_id_embeds],
                        width=TARGET_W,
                        height=TARGET_H,
                        num_inference_steps=total_steps,
                        guidance_scale=cfg_try['cfg'],
                        generator=torch.Generator(device="cpu").manual_seed(base_seed + cfg_try['seed_off']),
                        callback_on_step_end=step_cb,
                    ).images[0]
            except torch.cuda.OutOfMemoryError as oom_err:
                gc.collect()
                torch.cuda.empty_cache()
                raise RuntimeError(f"CUDA out of memory during generation: {oom_err}")

            # Stage-2 Full-Body Hires Texture Pass (768x1152 cloth stitching, skin & hands sharpness)
            if progress_callback:
                progress_callback(min(89, base_pct + 18), "Enhancing photographic fabric & studio lighting...")
            hires_body_pil = self._refine_fullbody_hires(
                gen_pil,
                prompt=final_prompt,
                neg_prompt=neg_prompt,
                combined_id_embeds=combined_id_embeds,
                combined_clip_embeds=combined_clip_embeds,
                ip_scale=max(0.68, cfg_try['ip_scale'] - 0.06),
                shortcut_scale=cfg_try['shortcut_scale'],
                seed=base_seed + cfg_try['seed_off'] + 29,
            )

            # Stage-3 Face-Crop DSLR Skin & Identity Refine (1024x1536 target)
            hi_pil = hires_body_pil.resize((1024, 1536), Image.Resampling.LANCZOS)
            hi_pil = self._refine_face_identity(
                hi_pil,
                combined_id_embeds=combined_id_embeds,
                combined_clip_embeds=combined_clip_embeds,
                gender_word=gender_word,
                ip_scale=min(0.96, cfg_try['ip_scale'] + 0.12),
                shortcut_scale=min(1.45, cfg_try['shortcut_scale'] + 0.16),
                seed=base_seed + cfg_try['seed_off'] + 55,
                orig_rgb=orig_rgb,
                face_orig=face_info,
            )

            total_gen_latency += (time.time() - t_inf)

            # Closed-loop identity + full-body head-to-feet verification
            sim = self.face_analyzer.verify_similarity(face_info["embedding"], hi_pil)
            gen_matte = self.extract_person_matte(gen_pil)
            ys, _ = np.where(gen_matte > 90)
            fullbody_ok = (
                len(ys) > 500
                and (int(ys.min()) <= int(TARGET_H * 0.16))
                and (int(ys.max()) >= int(TARGET_H * 0.80))
            )
            score = (1.5 if fullbody_ok else 0.0) + (sim if sim is not None else -1.0)
            print(
                f"[AIStudioEngine] Pass {attempts_used} | Framing={framing_type} | "
                f"CosineSim={f'{sim:.4f}' if sim is not None else 'None'} | FullBodyOK={fullbody_ok}"
            )

            if best_result is None or score > best_result['score']:
                best_result = {
                    'image': hi_pil,
                    'sim': sim,
                    'fullbody_ok': fullbody_ok,
                    'score': score,
                }

            # Early stop as soon as face similarity and full-body bounds satisfy quality target
            if fullbody_ok and sim is not None and sim >= 0.48:
                break

        if progress_callback:
            progress_callback(92, "Compositing clean 1080x1920 white studio portrait...")

        self._composite_studio_1080x1920(best_result['image'], output_path)

        total_time = time.time() - t_start
        peak_vram = torch.cuda.max_memory_allocated() / (1024 * 1024) if self.device == "cuda" else 0.0

        if progress_callback:
            progress_callback(100, "Studio transformation complete!")

        best_sim = best_result['sim']
        print(
            f"[AIStudioEngine] {profession.upper()} complete | Framing={framing_type} | "
            f"Sim={f'{best_sim:.4f}' if best_sim is not None else 'None'} | Attempts={attempts_used} | "
            f"Inference={total_gen_latency:.2f}s | Total={total_time:.2f}s | PeakVRAM={peak_vram:.1f} MB"
        )
        return {
            'output_path': output_path,
            'profession': profession,
            'input_framing': framing_type,
            'identity_similarity': round(best_sim, 4) if best_sim is not None else None,
            'fullbody_verified': bool(best_result['fullbody_ok']),
            'attempts': attempts_used,
            'inference_seconds': round(total_gen_latency, 2),
            'total_seconds': round(total_time, 2),
            'peak_vram_mb': round(peak_vram, 1),
        }


_ENGINE = None


def transform_user_photo(input_source, profession_raw, gender, output_path, custom_prompt=None):
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = AIStudioEngine()
    return _ENGINE.transform(input_source, profession_raw, gender, output_path, custom_prompt=custom_prompt)


if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python ai_transform.py <inputPath> <profession> <gender> <outputPath> [customPrompt]")
        sys.exit(1)

    in_path = sys.argv[1]
    prof = sys.argv[2]
    gend = sys.argv[3]
    out_path = sys.argv[4]
    c_prompt = sys.argv[5] if len(sys.argv) > 5 else None

    try:
        transform_user_photo(in_path, prof, gend, out_path, custom_prompt=c_prompt)
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
