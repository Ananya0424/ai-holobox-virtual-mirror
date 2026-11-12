#!/usr/bin/env python3
"""
Local Face Identity Conditioning & Pose Guidance Helpers
- Pure ONNX Runtime InsightFace (buffalo_l: det_10g.onnx + w600k_r50.onnx)
  requiring zero C++ compiler build tools on Windows.
- Exact 5-point ArcFace alignment (112x112) + expanded glasses/hair-safe crop (224x224).
- Closed-loop cosine similarity verification between input face and generated face.
- Full-body COCO-18 OpenPose skeleton generator (head-to-feet standing guidance).
"""

import os
import math
import numpy as np
import cv2
from PIL import Image, ImageDraw
import onnxruntime as ort

# Standard ArcFace 112x112 5-point destination template (left eye, right eye, nose, left mouth, right mouth)
ARCFACE_DST_112 = np.array([
    [38.2946, 51.6963],
    [73.5318, 51.5014],
    [56.0252, 71.7366],
    [41.5493, 92.3655],
    [70.7299, 92.2041],
], dtype=np.float32)

# Standard COCO-18 / OpenPose limb connections and BGR colors used by lllyasviel/control_v11p_sd15_openpose
OPENPOSE_LIMB_SEQ = [
    [1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7],
    [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13],
    [1, 0], [0, 14], [14, 16], [0, 15], [15, 17],
]
OPENPOSE_COLORS = [
    [255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0],
    [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85],
    [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255],
    [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255],
    [255, 0, 170], [255, 0, 85],
]


class ArcFaceAnalyzer:
    """SCRFD face detector (det_10g.onnx) + ArcFace ResNet50 embedder (w600k_r50.onnx)."""

    def __init__(self, model_dir=None):
        if model_dir is None:
            root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            model_dir = os.path.join(root, "models", "insightface", "buffalo_l")
        det_path = os.path.join(model_dir, "det_10g.onnx")
        rec_path = os.path.join(model_dir, "w600k_r50.onnx")
        if not (os.path.exists(det_path) and os.path.exists(rec_path)):
            raise FileNotFoundError(f"Missing buffalo_l ONNX weights in {model_dir}")

        providers = ["CPUExecutionProvider"]
        self.det_sess = ort.InferenceSession(det_path, providers=providers)
        self.rec_sess = ort.InferenceSession(rec_path, providers=providers)
        self.det_input = self.det_sess.get_inputs()[0].name
        self.rec_input = self.rec_sess.get_inputs()[0].name
        self._center_cache = {}

    def _anchor_centers(self, h, w, stride, num_anchors=2):
        key = (h, w, stride)
        if key not in self._center_cache:
            ys, xs = np.mgrid[:h, :w]
            centers = np.stack([xs, ys], axis=-1).astype(np.float32)
            centers = (centers * stride).reshape((-1, 2))
            centers = np.stack([centers] * num_anchors, axis=1).reshape((-1, 2))
            self._center_cache[key] = centers
        return self._center_cache[key]

    @staticmethod
    def _nms(dets, thresh=0.4):
        x1, y1, x2, y2, scores = dets[:, 0], dets[:, 1], dets[:, 2], dets[:, 3], dets[:, 4]
        areas = np.maximum(0.0, x2 - x1 + 1.0) * np.maximum(0.0, y2 - y1 + 1.0)
        order = scores.argsort()[::-1]
        keep = []
        while order.size > 0:
            i = int(order[0])
            keep.append(i)
            xx1 = np.maximum(x1[i], x1[order[1:]])
            yy1 = np.maximum(y1[i], y1[order[1:]])
            xx2 = np.minimum(x2[i], x2[order[1:]])
            yy2 = np.minimum(y2[i], y2[order[1:]])
            inter = np.maximum(0.0, xx2 - xx1 + 1.0) * np.maximum(0.0, yy2 - yy1 + 1.0)
            ovr = inter / np.maximum(1e-6, areas[i] + areas[order[1:]] - inter)
            inds = np.where(ovr <= thresh)[0]
            order = order[inds + 1]
        return keep

    def detect_faces(self, rgb_img, det_size=640, thresh=0.40):
        """Detects faces and 5 landmarks; returns list of dicts sorted by largest/confident face."""
        if isinstance(rgb_img, Image.Image):
            arr_rgb = np.array(rgb_img.convert("RGB"))
        else:
            arr_rgb = rgb_img
        orig_h, orig_w = arr_rgb.shape[:2]

        scale = min(det_size / float(orig_w), det_size / float(orig_h))
        new_w, new_h = max(1, int(round(orig_w * scale))), max(1, int(round(orig_h * scale)))
        resized = cv2.resize(arr_rgb, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.zeros((det_size, det_size, 3), dtype=np.uint8)
        canvas[:new_h, :new_w] = resized

        # SCRFD det_10g expects BGR normalized (x - 127.5) / 128.0
        blob = cv2.dnn.blobFromImage(
            cv2.cvtColor(canvas, cv2.COLOR_RGB2BGR),
            scalefactor=1.0 / 128.0,
            size=(det_size, det_size),
            mean=(127.5, 127.5, 127.5),
            swapRB=False,
        )
        outs = self.det_sess.run(None, {self.det_input: blob})

        strides = [8, 16, 32]
        fmc = 3
        scores_list, bboxes_list, kpss_list = [], [], []
        for idx, stride in enumerate(strides):
            scores = outs[idx].reshape(-1)
            bbox_preds = outs[idx + fmc].reshape(-1, 4) * stride
            kps_preds = outs[idx + fmc * 2].reshape(-1, 10) * stride
            fh, fw = det_size // stride, det_size // stride
            centers = self._anchor_centers(fh, fw, stride, num_anchors=2)

            pos = np.where(scores >= thresh)[0]
            if len(pos) == 0:
                continue

            cx, cy = centers[pos, 0], centers[pos, 1]
            bb = bbox_preds[pos]
            x1 = cx - bb[:, 0]
            y1 = cy - bb[:, 1]
            x2 = cx + bb[:, 2]
            y2 = cy + bb[:, 3]
            boxes = np.stack([x1, y1, x2, y2], axis=1)

            kp = kps_preds[pos].reshape(-1, 5, 2)
            kp[:, :, 0] += cx[:, None]
            kp[:, :, 1] += cy[:, None]

            scores_list.append(scores[pos])
            bboxes_list.append(boxes)
            kpss_list.append(kp)

        if not scores_list:
            return []

        all_scores = np.concatenate(scores_list, axis=0)
        all_boxes = np.concatenate(bboxes_list, axis=0) / scale
        all_kps = np.concatenate(kpss_list, axis=0) / scale

        pre = np.hstack([all_boxes, all_scores[:, None]]).astype(np.float32)
        keep = self._nms(pre, thresh=0.4)
        faces = []
        for idx in keep:
            box = all_boxes[idx]
            area = max(0.0, (box[2] - box[0]) * (box[3] - box[1]))
            faces.append({
                "bbox": box,
                "score": float(all_scores[idx]),
                "kps": all_kps[idx],
                "area": float(area),
            })
        # Prefer dominant central face (weighted area * confidence)
        faces.sort(key=lambda f: f["area"] * f["score"], reverse=True)
        return faces

    def extract_identity(self, rgb_img, det_size=640):
        """
        Extracts normalized 512-d ArcFace embedding and aligned 224x224 PIL face crop
        (including glasses, forehead/hair & chin) for IP-Adapter FaceID Plus v2.
        """
        if isinstance(rgb_img, Image.Image):
            pil_rgb = rgb_img.convert("RGB")
        else:
            pil_rgb = Image.fromarray(rgb_img).convert("RGB")
        arr_rgb = np.array(pil_rgb)

        faces = self.detect_faces(arr_rgb, det_size=det_size, thresh=0.35)
        if not faces:
            return None

        face = faces[0]
        kps = face["kps"].astype(np.float32)

        # 1. Standard 112x112 similarity warp for w600k_r50 ArcFace embedding
        M112, _ = cv2.estimateAffinePartial2D(kps, ARCFACE_DST_112, method=cv2.LMEDS)
        aligned_112_rgb = cv2.warpAffine(arr_rgb, M112, (112, 112), borderValue=(255, 255, 255))

        rec_blob = cv2.dnn.blobFromImage(
            aligned_112_rgb,
            scalefactor=1.0 / 127.5,
            size=(112, 112),
            mean=(127.5, 127.5, 127.5),
            swapRB=False,  # aligned_112_rgb is RGB; w600k_r50 trained with swapRB=True on BGR == RGB
        )
        emb = self.rec_sess.run(None, {self.rec_input: rec_blob})[0][0].astype(np.float32)
        emb_norm = float(np.linalg.norm(emb))
        if emb_norm > 1e-6:
            emb = emb / emb_norm

        # 2. Expanded 224x224 face crop for CLIP ViT-H-14 (retains hair, glasses & jawline with replicate border)
        dst_224 = (ARCFACE_DST_112 * 1.38) + np.array([34.5, 42.0], dtype=np.float32)
        M224, _ = cv2.estimateAffinePartial2D(kps, dst_224, method=cv2.LMEDS)
        crop_224_rgb = cv2.warpAffine(arr_rgb, M224, (224, 224), borderMode=cv2.BORDER_REPLICATE)

        return {
            "embedding": emb,
            "face_crop_224": Image.fromarray(crop_224_rgb, mode="RGB"),
            "aligned_112": Image.fromarray(aligned_112_rgb, mode="RGB"),
            "bbox": face["bbox"],
            "kps": kps,
            "det_score": face["score"],
        }

    def verify_similarity(self, ref_embedding, generated_rgb, upper_crop_fallback=True):
        """
        Compares reference 512-d ArcFace embedding with the face detected in the generated
        full-body portrait. Returns float cosine similarity in [-1, 1] (or None if no face found).
        """
        if ref_embedding is None:
            return None
        if isinstance(generated_rgb, Image.Image):
            gen_pil = generated_rgb.convert("RGB")
        else:
            gen_pil = Image.fromarray(generated_rgb).convert("RGB")

        gen_id = self.extract_identity(gen_pil, det_size=640)
        if gen_id is None and upper_crop_fallback:
            # Upscale upper 42% portrait region so small full-body heads detect cleanly
            w, h = gen_pil.size
            head_roi = gen_pil.crop((0, 0, w, int(h * 0.42))).resize((w * 2, int(h * 0.42) * 2), Image.Resampling.LANCZOS)
            gen_id = self.extract_identity(head_roi, det_size=640)

        if gen_id is None:
            return None

        return float(np.dot(ref_embedding, gen_id["embedding"]))


def render_coco18_openpose(w, h, pts):
    """
    Renders a clean black-background COCO-18 OpenPose skeleton image for ControlNet OpenPose.
    pts: list of 18 (x, y) tuples or None.
    """
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    stickwidth = max(3, int(round(w / 128.0)))

    # Draw limbs
    for i, (idx_a, idx_b) in enumerate(OPENPOSE_LIMB_SEQ):
        p_a = pts[idx_a] if idx_a < len(pts) else None
        p_b = pts[idx_b] if idx_b < len(pts) else None
        if p_a is None or p_b is None:
            continue
        x1, y1 = float(p_a[0]), float(p_a[1])
        x2, y2 = float(p_b[0]), float(p_b[1])
        cur = canvas.copy()
        mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
        length = math.hypot(x2 - x1, y2 - y1)
        if length < 1.0:
            continue
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        poly = cv2.ellipse2Poly((int(round(mx)), int(round(my))), (int(round(length / 2.0)), stickwidth), int(round(angle)), 0, 360, 1)
        color = OPENPOSE_COLORS[i % len(OPENPOSE_COLORS)]
        cv2.fillConvexPoly(cur, poly, color)
        canvas = cv2.addWeighted(canvas, 0.4, cur, 0.6, 0)

    # Draw joints
    r = max(3, int(round(w / 110.0)))
    for i, p in enumerate(pts):
        if p is None:
            continue
        cv2.circle(canvas, (int(round(p[0])), int(round(p[1]))), r, OPENPOSE_COLORS[i % len(OPENPOSE_COLORS)], thickness=-1)

    return Image.fromarray(canvas, mode="RGB")


def build_standing_fullbody_openpose(w=512, h=768, fullbody_matte=None, gender="female"):
    """
    Builds a well-proportioned, slender standing head-to-feet COCO-18 OpenPose skeleton (512x768).
    If fullbody_matte is provided from an already head-to-feet capture, adapts horizontal
    center & vertical span to stay aligned with the person's real standing posture while
    guaranteeing full head-to-feet margins.
    """
    cx = w * 0.5
    top_y = h * 0.11   # ~84px (nose) -> leaves crown room above (~45px..84px)
    ankle_y = h * 0.89 # ~683px (ankles) -> shoes sit cleanly around 700..728px

    if fullbody_matte is not None:
        ys, xs = np.where(fullbody_matte > 100)
        if len(ys) > 300:
            bt, bb = int(ys.min()), int(ys.max())
            bh = bb - bt
            # Only anchor to source silhouette if feet/legs are present
            if bh > h * 0.55:
                top_y = max(h * 0.08, min(h * 0.16, bt + bh * 0.055))
                ankle_y = min(h * 0.91, max(h * 0.78, bb - bh * 0.045))
                upper_xs = xs[ys < bt + int(bh * 0.20)]
                if len(upper_xs) > 20:
                    cx = float(np.clip(np.mean(upper_xs), w * 0.35, w * 0.65))

    body_h = max(360.0, ankle_y - top_y)
    is_fem = "fem" in (gender or "female").lower()
    sh_w = body_h * (0.104 if is_fem else 0.120)     # slender natural shoulder half-width
    hip_w = body_h * (0.058 if is_fem else 0.064)    # slender hip half-width
    arm_out = body_h * (0.138 if is_fem else 0.152)  # arms tucked naturally close to waist

    # COCO-18 indices:
    # 0 Nose, 1 Neck, 2 RShoulder, 3 RElbow, 4 RWrist, 5 LShoulder, 6 LElbow, 7 LWrist,
    # 8 RHip, 9 RKnee, 10 RAnkle, 11 LHip, 12 LKnee, 13 LAnkle, 14 REye, 15 LEye, 16 REar, 17 LEar
    nose_y = top_y
    neck_y = top_y + body_h * 0.095
    sh_y = top_y + body_h * 0.155
    elbow_y = top_y + body_h * 0.335
    wrist_y = top_y + body_h * 0.495
    hip_y = top_y + body_h * 0.475
    knee_y = top_y + body_h * 0.735
    eye_y = top_y - body_h * 0.022
    ear_y = top_y - body_h * 0.012
    eye_dx = body_h * 0.022
    ear_dx = body_h * 0.048

    pts = [
        (cx, nose_y),                         # 0 Nose
        (cx, neck_y),                         # 1 Neck
        (cx - sh_w, sh_y),                    # 2 RShoulder
        (cx - arm_out * 0.94, elbow_y),       # 3 RElbow
        (cx - arm_out * 1.00, wrist_y),       # 4 RWrist
        (cx + sh_w, sh_y),                    # 5 LShoulder
        (cx + arm_out * 0.94, elbow_y),       # 6 LElbow
        (cx + arm_out * 1.00, wrist_y),       # 7 LWrist
        (cx - hip_w, hip_y),                  # 8 RHip
        (cx - hip_w * 0.95, knee_y),          # 9 RKnee
        (cx - hip_w * 0.95, ankle_y),         # 10 RAnkle
        (cx + hip_w, hip_y),                  # 11 LHip
        (cx + hip_w * 0.95, knee_y),          # 12 LKnee
        (cx + hip_w * 0.95, ankle_y),         # 13 LAnkle
        (cx - eye_dx, eye_y),                 # 14 REye
        (cx + eye_dx, eye_y),                 # 15 LEye
        (cx - ear_dx, ear_y),                 # 16 REar
        (cx + ear_dx, ear_y),                 # 17 LEar
    ]
    return render_coco18_openpose(w, h, pts)
