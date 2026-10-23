import os
import io
import sys
import re
import base64
import json
import subprocess
import multiprocessing

# Safe stdout/stderr initialization for Windows --noconsole execution
class _SafeStream:
    def __init__(self, target_file=None):
        self.target_file = target_file
    def write(self, s):
        if self.target_file:
            try:
                self.target_file.write(str(s))
                self.target_file.flush()
            except Exception:
                pass
    def flush(self):
        if self.target_file:
            try:
                self.target_file.flush()
            except Exception:
                pass
    def isatty(self):
        return False
    @property
    def buffer(self):
        return self

is_frozen = getattr(sys, 'frozen', False)
if is_frozen or sys.stdout is None or sys.stderr is None:
    _log_f = None
    try:
        _log_p = os.path.join(os.environ.get('TEMP', os.path.expanduser('~')), 'cybercafe_backend.log')
        _log_f = open(_log_p, 'a', encoding='utf-8', errors='replace')
    except Exception:
        pass
    _safe_stream = _SafeStream(_log_f)
    if is_frozen or sys.stdout is None:
        sys.stdout = _safe_stream
    if is_frozen or sys.stderr is None:
        sys.stderr = _safe_stream

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from PIL import Image, ImageEnhance, ImageDraw, ImageOps
import cv2
import numpy as np

if getattr(sys, 'frozen', False):
    APP_ROOT = os.path.dirname(sys.executable)
else:
    APP_ROOT = os.path.dirname(os.path.abspath(__file__))

def get_resource_path(subpath):
    p1 = os.path.join(APP_ROOT, subpath)
    if os.path.exists(p1):
        return p1
    p2 = os.path.join(os.path.dirname(APP_ROOT), subpath)
    if os.path.exists(p2):
        return p2
    p3 = os.path.join(APP_ROOT, 'backend', subpath)
    if os.path.exists(p3):
        return p3
    return p1

def get_cascade_path(cname):
    candidates = []
    meipass = getattr(sys, '_MEIPASS', None)
    if meipass:
        candidates.append(os.path.join(meipass, 'cv2', 'data', cname))
        candidates.append(os.path.join(meipass, cname))
    if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades') and cv2.data.haarcascades:
        candidates.append(os.path.join(cv2.data.haarcascades, cname))
    candidates.append(os.path.join(APP_ROOT, 'cv2', 'data', cname))
    candidates.append(os.path.join(APP_ROOT, 'models', cname))
    candidates.append(os.path.join(os.path.dirname(APP_ROOT), 'cv2', 'data', cname))
    for p in candidates:
        if os.path.exists(p):
            return p
    return candidates[0] if candidates else cname

# Configure offline model cache for rembg (IS-Net / U2Net ONNX Engine) before rembg import
local_models = get_resource_path('models')
if os.path.exists(local_models):
    os.environ['U2NET_HOME'] = local_models

REMBG_INIT_ERROR = None

# Rembg session initialization: IS-Net (isnet-general-use) for fine hair, ear, and body delineation
try:
    from rembg import remove, new_session
    REMBG_AVAILABLE = True
    try:
        rembg_session = new_session("isnet-general-use")
        print("Loaded rembg model: isnet-general-use (IS-Net)")
    except Exception as e_isnet:
        REMBG_INIT_ERROR = f"IS-Net error: {e_isnet}"
        print(f"IS-Net load notice: {e_isnet}, fallback to u2net", file=sys.stderr)
        try:
            rembg_session = new_session("u2net")
        except Exception as e_u2:
            rembg_session = None
            REMBG_INIT_ERROR += f" | U2Net error: {e_u2}"
except Exception as e:
    REMBG_AVAILABLE = False
    rembg_session = None
    REMBG_INIT_ERROR = f"Rembg import error: {e}"
    print(f"Warning: rembg initialization error: {e}", file=sys.stderr)

# Native Windows Print Spooler Integration (pywin32)
try:
    import win32print
    import win32ui
    import win32gui
    import win32con
    from PIL import ImageWin
    WIN32_PRINT_AVAILABLE = True
except Exception as e_w32:
    WIN32_PRINT_AVAILABLE = False
    print(f"Notice: pywin32 print integration not available: {e_w32}", file=sys.stderr)

DIST_DIR = get_resource_path('dist')
if not os.path.exists(DIST_DIR):
    DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'dist'))

app = Flask(__name__, static_folder=DIST_DIR, static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = 64 * 1024 * 1024  # 64 MB
CORS(app)

PORT = int(os.environ.get('PORT', 5005))

@app.route('/')
def serve_index():
    index_file = os.path.join(DIST_DIR, 'index.html')
    if os.path.exists(index_file):
        return send_file(index_file)
    return "<h2>Digital Cyber Cafe Backend Ready</h2>"

@app.route('/<path:path>')
def serve_static(path):
    if path.startswith('api/'):
        return jsonify({"error": f"API endpoint not found: /{path}"}), 404
    file_path = os.path.join(DIST_DIR, path)
    if os.path.exists(file_path):
        return send_file(file_path)
    index_file = os.path.join(DIST_DIR, 'index.html')
    if os.path.exists(index_file):
        return send_file(index_file)
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": f"API endpoint not found: {request.path}"}), 404
    index_file = os.path.join(DIST_DIR, 'index.html')
    if os.path.exists(index_file):
        return send_file(index_file)
    return "Not found", 404

@app.errorhandler(405)
def handle_405(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": f"Method {request.method} not allowed for {request.path}"}), 405
    return "Method not allowed", 405

@app.errorhandler(413)
def handle_413(e):
    return jsonify({"error": "File size exceeds 64MB limit"}), 413

@app.errorhandler(500)
def handle_500(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Internal server error"}), 500
    return "Internal server error", 500

def decode_base64_image(image_data_uri):
    """Decode base64 data URI to PIL Image"""
    if ',' in image_data_uri:
        image_data_uri = image_data_uri.split(',', 1)[1]
    image_data_uri = image_data_uri.strip()
    image_data_uri += '=' * (-len(image_data_uri) % 4)
    image_bytes = base64.b64decode(image_data_uri)
    image = Image.open(io.BytesIO(image_bytes))
    return image.convert("RGBA")

def encode_pil_to_base64(pil_img, format="PNG"):
    """Encode PIL Image to base64 data URI"""
    buffered = io.BytesIO()
    pil_img.save(buffered, format=format)
    img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
    mime = "image/png" if format == "PNG" else "image/jpeg"
    return f"data:{mime};base64,{img_b64}"

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "rembg_available": (rembg_session is not None),
        "rembg_error": REMBG_INIT_ERROR,
        "engine": "IS-Net ONNX + High-Precision CV Detail Restoration",
        "port": PORT
    })

@app.route('/api/remove-bg', methods=['POST'])
def remove_background():
    try:
        data = request.json or {}
        image_str = data.get('image')
        bg_color = data.get('bgColor', '#2b7fff') # Default blue passport background
        
        if not image_str:
            return jsonify({"error": "No image provided"}), 400

        # Strip data URL header if present and dynamically fix padding
        if ',' in image_str:
            image_str = image_str.split(',', 1)[1]
        image_str = image_str.strip()
        image_str += '=' * (-len(image_str) % 4)

        pil_img = decode_base64_image(image_str)

        # High-accuracy IS-Net background removal with hair & ear edge preservation
        if REMBG_AVAILABLE:
            global rembg_session
            if rembg_session is None:
                try:
                    rembg_session = new_session("isnet-general-use")
                except Exception:
                    try:
                        rembg_session = new_session("u2net")
                    except Exception:
                        rembg_session = None

            try:
                # With IS-Net, native fine boundary delineation avoids chopping fine hair and ears
                if rembg_session:
                    cutout = remove(pil_img, session=rembg_session)
                else:
                    cutout = remove(pil_img)
            except Exception as re:
                print(f"Rembg IS-Net processing notice: {re}")
                try:
                    cutout = remove(pil_img)
                except Exception:
                    cutout = pil_img
        else:
            cutout = pil_img

        # Apply background color if specified (or transparent if 'transparent')
        if bg_color and bg_color.lower() != 'transparent':
            # Hex to RGB
            hex_c = bg_color.lstrip('#')
            if len(hex_c) == 6:
                r, g, b = tuple(int(hex_c[i:i+2], 16) for i in (0, 2, 4))
                bg = Image.new("RGBA", cutout.size, (r, g, b, 255))
                # Paste cutout on background with alpha mask
                bg.paste(cutout, (0, 0), cutout)
                result_img = bg
            else:
                result_img = cutout
        else:
            result_img = cutout

        result_b64 = encode_pil_to_base64(result_img, "PNG")
        return jsonify({
            "success": True,
            "image": result_b64
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def detect_idcard_face(bgr_img):
    """
    Step A: Face Detection
    Detects the exact bounding box of the face on an ID card or portrait photo.
    Returns (x, y, w, h) or None.
    """
    h, w = bgr_img.shape[:2]
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)
    
    # Try OpenCV Haar Cascades
    cascade_names = [
        'haarcascade_frontalface_default.xml',
        'haarcascade_frontalface_alt2.xml',
        'haarcascade_frontalface_alt.xml',
        'haarcascade_profileface.xml'
    ]
    
    best_face = None
    max_area = 0
    
    if hasattr(cv2, 'CascadeClassifier'):
        for cname in cascade_names:
            try:
                cascade_path = get_cascade_path(cname)
                if not os.path.exists(cascade_path):
                    continue
                classifier = cv2.CascadeClassifier(cascade_path)
                if classifier is None or classifier.empty():
                    continue
                faces = classifier.detectMultiScale(
                    gray,
                    scaleFactor=1.1,
                    minNeighbors=3,
                    minSize=(int(w * 0.08), int(h * 0.10)),
                    maxSize=(int(w * 0.85), int(h * 0.90))
                )
                for (fx, fy, fw, fh) in faces:
                    area = fw * fh
                    if area > max_area:
                        max_area = area
                        best_face = (int(fx), int(fy), int(fw), int(fh))
                if best_face is not None:
                    break
            except Exception as e_cascade:
                print(f"[Cascade Notice] {cname} detection skip: {e_cascade}")

    # If Haar didn't detect, check if it's already a cropped passport face (portrait aspect ~ 0.65 - 0.95)
    if best_face is None:
        aspect = w / max(1, h)
        if 0.65 <= aspect <= 0.95:
            # Whole photo is a passport portrait face
            best_face = (0, 0, w, h)
        elif 1.3 <= aspect <= 1.8:
            # Standard Aadhaar/CR80 ID card layout: photo is situated on the right side
            def_x = int(w * 0.60)
            def_y = int(h * 0.16)
            def_w = int(w * 0.32)
            def_h = int(h * 0.54)
            best_face = (def_x, def_y, def_w, def_h)

    return best_face

def enhance_cropped_face(face_bgr, weight=0.60):
    """
    High-Precision Anti-Pimple Beautification & Multi-Click Safe Facial Restoration:
    1. Pre-Processing Noise Gate: Bilateral Filter (d=9, sigmaColor=75, sigmaSpace=75) melts away
       skin pores, sensor noise, pimples, and acne fragments while strictly preserving contours (eyes, lips).
    2. Feature Detail Restoration: Operates on the noise-gated base so detailEnhance highlights
       eyes, eyebrows, eyelashes, lips, and nostrils WITHOUT turning skin noise into grainy artifacts.
    3. Natural Skin Tone Preservation: LAB CLAHE on Luminance (L) channel maintains authentic skin warmth.
    4. Controlled Unsharp Masking: Crisp clarity on structural facial landmarks.
    5. Post-Processing Blend (Anti-Over-Sharpening): 60% AI Enhanced + 40% Smoothed Original.
       Guarantees that even if user clicks 3+ times consecutively, the image stays naturally soft,
       beautified, and strictly free of structural distortion or pimple accumulation.
    6. Studio Print-Ready Finish: Subtle studio contrast/brightness calibration for cyber cafe photo printing.
    """
    try:
        # Step 1: Pre-Processing Noise Gate (Beautification & Anti-Pimple Layer)
        # d=9, sigmaColor=75, sigmaSpace=75 completely suppresses skin pores and noise runaway
        smoothed_original = cv2.bilateralFilter(face_bgr, d=9, sigmaColor=75, sigmaSpace=75)

        # Step 2: Facial Feature Clarity & Restoration on smoothed base
        detailed = cv2.detailEnhance(smoothed_original, sigma_s=8, sigma_r=0.08)

        # Step 3: Natural Skin Tone LAB CLAHE (Contrast Limited Adaptive Histogram Equalization)
        lab = cv2.cvtColor(detailed, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8))
        l_boost = clahe.apply(l)
        enhanced_ai = cv2.cvtColor(cv2.merge((l_boost, a, b)), cv2.COLOR_LAB2BGR)

        # Step 4: Gentle Unsharp Mask for crisp clarity
        gaussian = cv2.GaussianBlur(enhanced_ai, (0, 0), 1.2)
        sharp_ai = cv2.addWeighted(enhanced_ai, 1.15, gaussian, -0.15, 0)

        # Step 5: Post-Processing Blend (Anti-Over-Sharpening: 60% AI + 40% Smoothed Original)
        ai_w = max(0.2, min(0.85, float(weight))) if weight is not None else 0.60
        orig_w = 1.0 - ai_w
        blended_face = cv2.addWeighted(sharp_ai, ai_w, smoothed_original, orig_w, 0)

        # Step 6: Professional Studio Print Polish
        studio_face = cv2.convertScaleAbs(blended_face, alpha=1.02, beta=1)
        return studio_face
    except Exception as e:
        print(f"Face enhancement fallback: {e}", file=sys.stderr)
        return face_bgr

@app.route('/api/enhance-photo', methods=['POST'])
@app.route('/api/idcard/enhance-card-face', methods=['POST'])
@app.route('/api/ai-hd-clean', methods=['POST'])
def enhance_photo():
    """
    Targeted Face Beautification & Restoration for ID Cards & Passport Photos:
    - Step A (Face Detection & Expansion): Detects face and generously expands to hairline, cheeks, and neck.
    - Step B (Anti-Pimple Beautification): Suppresses grain/blemishes and restores facial details.
    - Step C (Seamless Feathered Alpha Blending): Uses distance-transform Hermite smoothstep mask so
      there is ZERO bounding box seam or square artifact around chin, neck, or forehead.
    - Step D (Studio Polish): Calibrates final studio contrast/brightness for sharp, print-ready output.
    """
    try:
        data = request.json or {}
        image_str = data.get('image')
        weight = float(data.get('weight', 0.70))

        if not image_str:
            return jsonify({"error": "No image provided"}), 400

        pil_img = decode_base64_image(image_str)
        orig_mode = pil_img.mode
        alpha = pil_img.split()[3] if orig_mode == 'RGBA' else None

        rgb_img = pil_img.convert("RGB")
        bgr_img = cv2.cvtColor(np.array(rgb_img), cv2.COLOR_RGB2BGR)
        img_h, img_w = bgr_img.shape[:2]

        # Step A: Face Detection
        face_box = detect_idcard_face(bgr_img)
        result_bgr = bgr_img.copy()

        if face_box is not None:
            fx, fy, fw, fh = face_box

            # Check if whole photo is detected as face (already tightly cropped passport photo)
            if fx == 0 and fy == 0 and fw == img_w and fh == img_h:
                result_bgr = enhance_cropped_face(bgr_img, weight=weight)
            else:
                # Expand bounding box generously to include hairline, ears/cheeks, and under chin/neck
                pad_top = int(fh * 0.20)
                pad_bottom = int(fh * 0.35)  # extends naturally down to neck
                pad_sides = int(fw * 0.20)   # extends across cheeks and ears

                x1 = max(0, fx - pad_sides)
                y1 = max(0, fy - pad_top)
                x2 = min(img_w, fx + fw + pad_sides)
                y2 = min(img_h, fy + fh + pad_bottom)
                crop_w = x2 - x1
                crop_h = y2 - y1

                if crop_w > 16 and crop_h > 16:
                    # Step B: Crop expanded facial region
                    face_crop = bgr_img[y1:y2, x1:x2].copy()

                    # Enhance & beautify cropped face
                    enhanced_face = enhance_cropped_face(face_crop, weight=weight)

                    if enhanced_face.shape[:2] != (crop_h, crop_w):
                        enhanced_face = cv2.resize(enhanced_face, (crop_w, crop_h), interpolation=cv2.INTER_LANCZOS4)

                    # Step C: Seamless Feathered Alpha Mask Blending (Zero Bounding Box Seam)
                    mask = np.zeros((crop_h, crop_w), dtype=np.float32)
                    axes = (int(crop_w * 0.40), int(crop_h * 0.42))
                    cv2.ellipse(mask, (crop_w // 2, crop_h // 2), axes, 0, 0, 360, 1.0, -1)

                    # Distance transform with Hermite smoothstep for C1-continuous falloff
                    dist = cv2.distanceTransform((mask * 255).astype(np.uint8), cv2.DIST_L2, 5)
                    if dist.max() > 0:
                        dist = dist / dist.max()
                    smooth_mask = dist * dist * (3.0 - 2.0 * dist)

                    # Strictly zero out perimeter boundary pixels so edge difference is mathematically 0
                    border = max(4, int(min(crop_w, crop_h) * 0.05))
                    smooth_mask[:border, :] = 0
                    smooth_mask[-border:, :] = 0
                    smooth_mask[:, :border] = 0
                    smooth_mask[:, -border:] = 0

                    smooth_mask = cv2.GaussianBlur(smooth_mask, (15, 15), 0)
                    smooth_mask[:2, :] = 0
                    smooth_mask[-2:, :] = 0
                    smooth_mask[:, :2] = 0
                    smooth_mask[:, -2:] = 0

                    mask_3d = np.repeat(np.clip(smooth_mask, 0.0, 1.0)[:, :, np.newaxis], 3, axis=2)
                    blended_crop = (enhanced_face.astype(np.float32) * mask_3d + face_crop.astype(np.float32) * (1.0 - mask_3d)).astype(np.uint8)

                    # Seamless paste back into canvas
                    result_bgr[y1:y2, x1:x2] = blended_crop
                else:
                    result_bgr = enhance_cropped_face(bgr_img, weight=weight)
        else:
            # Fallback if no face could be isolated
            result_bgr = enhance_cropped_face(bgr_img, weight=weight)

        # Step D: Studio Print Polish (Subtle brightness & contrast calibration)
        result_bgr = cv2.convertScaleAbs(result_bgr, alpha=1.02, beta=2)

        restored_rgb = cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB)
        result_pil = Image.fromarray(restored_rgb)

        if alpha is not None:
            r, g, b = result_pil.split()
            if result_pil.size != alpha.size:
                alpha = alpha.resize(result_pil.size, Image.Resampling.LANCZOS)
            result_pil = Image.merge("RGBA", (r, g, b, alpha))

        result_b64 = encode_pil_to_base64(result_pil, "PNG")
        return jsonify({
            "success": True,
            "image": result_b64,
            "hasFaceDetection": face_box is not None
        })
    except Exception as e:
        print(f"enhance_photo error: {e}", file=sys.stderr)
        return jsonify({"error": str(e)}), 500

@app.route('/api/adjust', methods=['POST'])
def adjust_image():
    try:
        data = request.json or {}
        image_str = data.get('image')
        brightness = float(data.get('brightness', 1.0))
        contrast = float(data.get('contrast', 1.0))
        sharpness = float(data.get('sharpness', 1.0))
        color = float(data.get('color', 1.0))

        if not image_str:
            return jsonify({"error": "No image provided"}), 400

        img = decode_base64_image(image_str)
        rgb_img = img.convert("RGB")

        # Apply adjustments
        if brightness != 1.0:
            rgb_img = ImageEnhance.Brightness(rgb_img).enhance(brightness)
        if contrast != 1.0:
            rgb_img = ImageEnhance.Contrast(rgb_img).enhance(contrast)
        if color != 1.0:
            rgb_img = ImageEnhance.Color(rgb_img).enhance(color)
        if sharpness != 1.0:
            rgb_img = ImageEnhance.Sharpness(rgb_img).enhance(sharpness)

        # Restore alpha channel if original had transparency
        if img.mode == 'RGBA':
            r, g, b = rgb_img.split()
            a = img.split()[3]
            result_img = Image.merge("RGBA", (r, g, b, a))
        else:
            result_img = rgb_img

        return jsonify({
            "success": True,
            "image": encode_pil_to_base64(result_img, "PNG")
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-sheet', methods=['POST'])
def generate_sheet():
    """
    Generates high-resolution 300 DPI A4 page with sequentially stacked passport photos.
    A4 Dimensions at 300 DPI: 2480 x 3508 pixels.
    Standard Photo: 3.5cm x 4.5cm -> ~413 x 531 pixels.
    Can accommodate up to 5-6 photos horizontally, 6 rows vertically = 30-36 photos per A4 page!
    """
    try:
        data = request.json or {}
        items = data.get('items', []) # List of { id, customerCode, image, count }
        output_format = data.get('format', 'PNG').upper() # PNG or PDF
        add_cut_border = data.get('addBorder', True)
        
        # A4 Canvas at 300 DPI (2480 x 3508)
        SHEET_W = 2480
        SHEET_H = 3508
        sheet = Image.new("RGB", (SHEET_W, SHEET_H), (255, 255, 255))
        draw = ImageDraw.Draw(sheet)

        # Standard Indian Passport 3.5cm x 4.5cm proportions for 6 columns
        COLS = 6
        ROWS = 6
        max_slots = COLS * ROWS

        # Dynamic margins passed from frontend (scaled for 300 DPI)
        raw_margin_x = float(data.get('marginX', 16)) # e.g. 16px in preview
        raw_margin_y = float(data.get('marginY', 24)) # e.g. 24px in preview
        scale_factor = SHEET_W / 420.0 # preview width ~420px

        margin_x = max(int(raw_margin_x * scale_factor * 0.45), 50)
        margin_y = max(int(raw_margin_y * scale_factor * 0.45), 80)

        # Calculate photo size and spacing to fit exactly 6 columns
        available_w = SHEET_W - (2 * margin_x)
        gap_x = 24
        PHOTO_W = int((available_w - ((COLS - 1) * gap_x)) / COLS)
        PHOTO_H = int(PHOTO_W * (4.5 / 3.5)) # Maintain 3.5 x 4.5 passport aspect ratio
        gap_y = 35

        current_idx = 0

        for item in items:
            img_b64 = item.get('image')
            count = int(item.get('count', 6))
            if not img_b64 or count <= 0:
                continue

            try:
                raw_photo = decode_base64_image(img_b64).convert("RGB")
                passport_photo = raw_photo.resize((PHOTO_W, PHOTO_H), Image.Resampling.LANCZOS)
                
                # Add clean cutting border in balanced medium gray (#808080)
                if add_cut_border:
                    p_draw = ImageDraw.Draw(passport_photo)
                    p_draw.rectangle([0, 0, PHOTO_W - 1, PHOTO_H - 1], outline=(128, 128, 128), width=1)

                for _ in range(count):
                    if current_idx >= max_slots:
                        break
                    
                    row = current_idx // COLS
                    col = current_idx % COLS

                    x = margin_x + col * (PHOTO_W + gap_x)
                    y = margin_y + row * (PHOTO_H + gap_y)

                    sheet.paste(passport_photo, (int(x), int(y)))
                    current_idx += 1

            except Exception as item_err:
                print(f"Error rendering item: {item_err}")
                continue

        # Export result
        buffered = io.BytesIO()
        if output_format == 'PDF':
            sheet.save(buffered, format='PDF', resolution=300.0)
            mime = "application/pdf"
            ext = "pdf"
        elif output_format in ['DOCX', 'WORD']:
            try:
                import docx
                from docx.shared import Mm, Pt
                from docx.enum.text import WD_ALIGN_PARAGRAPH
                from docx.enum.table import WD_TABLE_ALIGNMENT

                doc = docx.Document()
                sec = doc.sections[0]
                sec.page_width = Mm(210)
                sec.page_height = Mm(297)
                sec.top_margin = Mm(max(raw_margin_y * 0.35, 6))
                sec.bottom_margin = Mm(max(raw_margin_y * 0.35, 6))
                sec.left_margin = Mm(max(raw_margin_x * 0.35, 6))
                sec.right_margin = Mm(max(raw_margin_x * 0.35, 6))

                # Collect all photos with black cutting borders
                all_photos = []
                for item in items:
                    img_b64 = item.get('image')
                    count = int(item.get('count', 6))
                    if not img_b64 or count <= 0:
                        continue
                    try:
                        p_img = decode_base64_image(img_b64).convert("RGB")
                        p_img = p_img.resize((PHOTO_W, PHOTO_H), Image.Resampling.LANCZOS)
                        if add_cut_border:
                            p_draw = ImageDraw.Draw(p_img)
                            p_draw.rectangle([0, 0, PHOTO_W - 1, PHOTO_H - 1], outline=(128, 128, 128), width=1)
                        p_buf = io.BytesIO()
                        p_img.save(p_buf, format="JPEG", quality=95)
                        photo_bytes = p_buf.getvalue()
                        for _ in range(count):
                            all_photos.append(photo_bytes)
                    except Exception as pe:
                        print(f"Error preparing docx photo: {pe}")

                # Build 6-column table
                num_rows = (len(all_photos) + 5) // 6
                if num_rows > 0:
                    table = doc.add_table(rows=num_rows, cols=6)
                    table.alignment = WD_TABLE_ALIGNMENT.CENTER
                    for idx, p_data in enumerate(all_photos):
                        r = idx // 6
                        c = idx % 6
                        if r < num_rows:
                            cell = table.cell(r, c)
                            cell_p = cell.paragraphs[0]
                            cell_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            cell_p.paragraph_format.space_before = Pt(0.5)
                            cell_p.paragraph_format.space_after = Pt(0.5)
                            cell_run = cell_p.add_run()
                            cell_run.add_picture(io.BytesIO(p_data), width=Mm(31.5), height=Mm(40.5))

                doc.save(buffered)
                mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ext = "docx"
            except Exception as de:
                print(f"DOCX generation fallback to PNG: {de}")
                sheet.save(buffered, format='PNG', dpi=(300, 300))
                mime = "image/png"
                ext = "png"
        else:
            sheet.save(buffered, format='PNG', dpi=(300, 300))
            mime = "image/png"
            ext = "png"

        b64_content = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({
            "success": True,
            "format": ext,
            "mime": mime,
            "dataUrl": f"data:{mime};base64,{b64_content}",
            "totalPhotosPlaced": current_idx,
            "capacity": max_slots
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export-single-photo', methods=['POST'])
def export_single_photo():
    """Export single active passport photo with custom dimension, format, and DPI"""
    try:
        data = request.json or {}
        img_b64 = data.get('image')
        target_w = int(data.get('width', 350))
        target_h = int(data.get('height', 450))
        img_format = data.get('format', 'JPG').upper()
        dpi = int(data.get('dpi', 300))
        add_cut_border = data.get('addBorder', True)

        if not img_b64:
            return jsonify({"error": "No image provided"}), 400

        img = decode_base64_image(img_b64)

        max_kb = data.get('maxKb')
        target_bytes = int(max_kb) * 1024 if max_kb and int(max_kb) > 0 else None

        if img_format in ['JPG', 'JPEG']:
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                rgb_img.paste(img, (0, 0), img)
            else:
                rgb_img = img.convert("RGB")
            resized = rgb_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            if add_cut_border:
                p_draw = ImageDraw.Draw(resized)
                p_draw.rectangle([0, 0, target_w - 1, target_h - 1], outline=(128, 128, 128), width=1)
            
            buffered = io.BytesIO()
            quality = 95
            resized.save(buffered, format="JPEG", quality=quality, dpi=(dpi, dpi))

            if target_bytes:
                while buffered.tell() > target_bytes and quality > 15:
                    quality -= 5
                    buffered = io.BytesIO()
                    resized.save(buffered, format="JPEG", quality=quality, dpi=(dpi, dpi))

            mime = "image/jpeg"
            ext = "jpeg" if img_format == 'JPEG' else "jpg"
        else:
            resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
            if add_cut_border:
                p_draw = ImageDraw.Draw(resized)
                p_draw.rectangle([0, 0, target_w - 1, target_h - 1], outline=(128, 128, 128), width=1)
            buffered = io.BytesIO()
            resized.save(buffered, format="PNG", dpi=(dpi, dpi))
            mime = "image/png"
            ext = "png"

        b64_content = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({
            "success": True,
            "dataUrl": f"data:{mime};base64,{b64_content}",
            "format": ext,
            "mime": mime
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def extract_aadhaar_gender_box_from_pdf(doc, page_num, pix, detected_doc_type):
    """Accurately extracts gender bounding box (Male / Female) strictly relative to the cropped Front Aadhaar Card"""
    if detected_doc_type not in ["aadhaar", "other"]:
        return None
    try:
        p0 = doc.load_page(page_num)
        scale_x = pix.width / max(1.0, float(p0.rect.width))
        scale_y = pix.height / max(1.0, float(p0.rect.height))

        np_pix = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        if pix.n == 4:
            bgr_pix = cv2.cvtColor(np_pix, cv2.COLOR_RGBA2BGR)
        elif pix.n == 3:
            bgr_pix = cv2.cvtColor(np_pix, cv2.COLOR_RGB2BGR)
        else:
            bgr_pix = cv2.cvtColor(np_pix, cv2.COLOR_GRAY2BGR)

        fc, _ = detect_aadhaar_dual_cards(bgr_pix)
        fx, fy, fw, fh = fc['x'], fc['y'], fc['width'], fc['height']

        card_hits = []
        for term in ['FEMALE', 'Female', 'MALE', 'Male']:
            for h in p0.search_for(term):
                px0, py0 = h.x0 * scale_x, h.y0 * scale_y
                px1, py1 = h.x1 * scale_x, h.y1 * scale_y
                if fx <= px0 <= fx + fw and fy <= py0 <= fy + fh:
                    card_hits.append((px0, py0, px1, py1, term))

        if not card_hits:
            return None

        # Filter hits in the upper-middle section of the front card where gender is printed (y: 25% - 50%)
        valid_line_hits = [h for h in card_hits if 0.25 <= (h[1] - fy) / fh <= 0.50] or card_hits
        base_py0 = valid_line_hits[0][1]

        # All hits on the same line (within 25px)
        line_hits = [h for h in valid_line_hits if abs(h[1] - base_py0) < 25]
        max_px1 = max(h[2] for h in line_hits)
        min_px0 = min(h[0] for h in line_hits)
        min_py0 = min(h[1] for h in line_hits)
        max_py1 = max(h[3] for h in line_hits)

        card_x = (min_px0 - fx) / fw * 100.0
        card_y = (min_py0 - fy) / fh * 100.0
        end_x = (max_px1 - fx) / fw * 100.0
        card_w = (max_px1 - min_px0) / fw * 100.0
        card_h = (max_py1 - min_py0) / fh * 100.0

        return {
            "x": round(card_x, 2),
            "y": round(card_y, 2),
            "width": round(card_w, 2),
            "height": round(card_h, 2),
            "endX": round(end_x, 2),
            "term": line_hits[0][4]
        }
    except Exception as e:
        print(f"extract_aadhaar_gender_box_from_pdf error: {e}", file=sys.stderr)
        return None

@app.route('/api/idcard/convert-pdf', methods=['POST'])
def convert_pdf():
    """Convert uploaded PDF page into high-res PNG image using PyMuPDF"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        pdf_b64 = data.get('pdfData')
        page_num = int(data.get('pageNumber', 0))
        dpi = int(data.get('dpi', 300))
        password = data.get('password', None)

        if not pdf_b64:
            return jsonify({"error": "No PDF data provided"}), 400

        if ',' in pdf_b64:
            pdf_b64 = pdf_b64.split(',', 1)[1]
        pdf_bytes = base64.b64decode(pdf_b64)

        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        if doc.is_encrypted:
            if password:
                authenticated = doc.authenticate(password)
                if not authenticated:
                    return jsonify({"error": "Incorrect PDF password. Please verify and try again."}), 401
            else:
                return jsonify({"error": "This PDF is password-protected. Please enter the password (e.g. Aadhaar: First 4 name letters in CAPITAL + Birth Year)."}), 401

        if len(doc) == 0:
            return jsonify({"error": "PDF has no pages"}), 400

        page_num = min(max(0, page_num), len(doc) - 1)
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=dpi, annots=True)
        png_bytes = pix.tobytes("png")
        b64_img = base64.b64encode(png_bytes).decode('utf-8')
        # Render up to 2 pages (for multi-page ID cards like Ayushman PM-JAY)
        pages_b64 = []
        for i in range(min(2, len(doc))):
            p = doc.load_page(i)
            pix_p = p.get_pixmap(dpi=dpi, annots=True)
            b64 = base64.b64encode(pix_p.tobytes("png")).decode('utf-8')
            pages_b64.append(f"data:image/png;base64,{b64}")

        total_pages = len(doc)

        # Extract 10-digit mobile number from PDF text & identify document type
        extracted_mobile = None
        detected_doc_type = None
        user_card_type = data.get('cardType', '').lower()
        try:
            full_text = ""
            for p in doc:
                full_text += p.get_text("text") + "\n"
            full_lower = full_text.lower()
            if any(k in full_lower for k in ["aadhaar", "uidai", "mera aadhaar", "unique identification authority", "resident details"]):
                detected_doc_type = "aadhaar"
            elif any(k in full_lower for k in ["voter", "voters", "epic", "e-epic", "election commission", "nirvachan aayog", "elector photo", "मतदाता", "निर्वाचन आयोग"]):
                detected_doc_type = "voter"
            elif any(k in full_lower for k in ["divyang", "divyangjan", "railway's divyangjan", "railway divyangjan", "concession-card", "concession card"]):
                detected_doc_type = "other"
            elif any(k in full_lower for k in ["ayushman", "pm-jay", "pmjay", "national health authority", "abha", "abdm"]):
                detected_doc_type = "ayushman"
            elif "income tax department" in full_lower or "permanent account number" in full_lower:
                detected_doc_type = "pan"
            elif any(k in full_lower for k in ["driving licence", "driving license", "union driving licence", "licensing authority", "form 7", "dl no", "adpveh"]):
                detected_doc_type = "dl"
            elif any(k in full_lower for k in ["ration", "खाद्य", "fso", "fps", "सुरक्षा काड", "सुरक्षा कार्ड", "एफ.एस.ओ", "एफ.पी.एस", "food security", "khadya", "खाद्य सुरक्षा"]):
                detected_doc_type = "ration"
            elif user_card_type:
                detected_doc_type = user_card_type

            # Extract mobile number for documents where resident mobile is printed (Aadhaar, Voter ID, or Divyangjan in Other)
            if detected_doc_type in ["aadhaar", "other", "voter"]:
                matches = re.findall(r'(?:Mobile|Mob|Phone|Mo\.?|M)?[:\s\-]*([6-9]\d{9})\b|\b([6-9]\d{9})\b', full_text, re.IGNORECASE)
                for m in matches:
                    num = m[0] or m[1]
                    if num and len(num) == 10:
                        extracted_mobile = num
                        break

            # Search for gender bounding box strictly relative to Front Card
            gender_box = extract_aadhaar_gender_box_from_pdf(doc, page_num, pix, detected_doc_type)
        except Exception as tex_err:
            print(f"Mobile regex scan error: {tex_err}")

        doc.close()

        return jsonify({
            "success": True,
            "dataUrl": pages_b64[0] if pages_b64 else f"data:image/png;base64,{b64_img}",
            "pages": pages_b64,
            "totalPages": total_pages,
            "extractedMobile": extracted_mobile,
            "detectedDocType": detected_doc_type,
            "genderBox": gender_box
        })
    except Exception as e:
        print(f"PDF conversion error: {e}")
        return jsonify({"error": f"Failed to render PDF: {str(e)}"}), 500

def detect_aadhaar_dual_cards(np_img):
    """Accurately detect Front (Left) and Back (Right) Aadhaar card bounding boxes from an A4 document.
    Scans for horizontal scissor cut lines and ensures the entire bottom patti
    ('Mera Aadhaar, Meri Pehchaan' and '1947 helpline') with solid black border is 100% INCLUDED."""
    import cv2
    import numpy as np

    h_img, w_img = np_img.shape[:2]
    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)

    # 1. Search for Top Horizontal Scissor Cut Line in range [0.700 * H, 0.745 * H]
    # In official e-Aadhaar, the bottom cuttable card starts at ~0.722 * H
    y1_range_start = int(h_img * 0.700)
    y1_range_end = int(h_img * 0.745)
    sub_top = gray[y1_range_start:y1_range_end, :]
    sobel_top = cv2.Sobel(sub_top, cv2.CV_64F, 0, 1, ksize=3)
    top_intensities = np.mean(np.abs(sobel_top), axis=1)
    if len(top_intensities) > 0 and np.max(top_intensities) > 0:
        top_y = y1_range_start + int(np.argmax(top_intensities))
    else:
        top_y = int(h_img * 0.722)

    # Sanity clamp top_y to [0.710 * H, 0.740 * H]
    if top_y < int(h_img * 0.710) or top_y > int(h_img * 0.740):
        top_y = int(h_img * 0.722)

    # 2. Search for Bottom Horizontal Cut Line in range [0.920 * H, 0.955 * H]
    # In official e-Aadhaar, the bottom card ends at ~0.934 * H (right below 'Mera Aadhaar, Meri Pehchaan')
    y2_range_start = int(h_img * 0.920)
    y2_range_end = int(h_img * 0.955)
    sub_bot = gray[y2_range_start:y2_range_end, :]
    sobel_bot = cv2.Sobel(sub_bot, cv2.CV_64F, 0, 1, ksize=3)
    bot_intensities = np.mean(np.abs(sobel_bot), axis=1)
    if len(bot_intensities) > 0 and np.max(bot_intensities) > 0:
        bot_y = y2_range_start + int(np.argmax(bot_intensities))
    else:
        bot_y = int(h_img * 0.934)

    # Sanity clamp bot_y to [0.925 * H, 0.950 * H]
    if bot_y < int(h_img * 0.925) or bot_y > int(h_img * 0.950):
        bot_y = int(h_img * 0.934)

    # 3. Search for Vertical Divider between Front & Back in range [0.485 * W, 0.515 * W]
    mid_range_start = int(w_img * 0.485)
    mid_range_end = int(w_img * 0.515)
    sub_mid = gray[top_y:bot_y, mid_range_start:mid_range_end]
    sobel_mid = cv2.Sobel(sub_mid, cv2.CV_64F, 1, 0, ksize=3)
    mid_intensities = np.mean(np.abs(sobel_mid), axis=0)
    if len(mid_intensities) > 0 and np.max(mid_intensities) > 0:
        mid_x = mid_range_start + int(np.argmax(mid_intensities))
    else:
        mid_x = int(w_img * 0.500)

    if mid_x < int(w_img * 0.490) or mid_x > int(w_img * 0.510):
        mid_x = int(w_img * 0.500)

    # 4. Search for Front Card True Left Border in range [0.050 * W, 0.095 * W]
    # The actual card begins at a solid vertical black border line with 'Aadhaar no. issued: ...'
    # Previously searching [0.025 * W, 0.050 * W] picked up the outer page scissor icon, leaving ~100px of white space on the left!
    left_range_start = int(w_img * 0.050)
    left_range_end = int(w_img * 0.095)
    sub_left = gray[top_y:bot_y, left_range_start:left_range_end]
    sobel_left = cv2.Sobel(sub_left, cv2.CV_64F, 1, 0, ksize=3)
    left_intensities = np.mean(np.abs(sobel_left), axis=0)
    if len(left_intensities) > 0 and np.max(left_intensities) > 0:
        left_x = left_range_start + int(np.argmax(left_intensities))
    else:
        left_x = int(w_img * 0.072)

    if left_x < int(w_img * 0.055) or left_x > int(w_img * 0.090):
        left_x = int(w_img * 0.072)

    # 5. Search for Back Card True Right Border in range [0.905 * W, 0.950 * W]
    # The actual back card ends at a solid vertical black border around ~0.928 * W
    # Previously searching [0.950 * W, 0.975 * W] picked up the outer page scissor icon, leaving ~100px of white space on the right!
    right_range_start = int(w_img * 0.905)
    right_range_end = int(w_img * 0.950)
    sub_right = gray[top_y:bot_y, right_range_start:right_range_end]
    sobel_right = cv2.Sobel(sub_right, cv2.CV_64F, 1, 0, ksize=3)
    right_intensities = np.mean(np.abs(sobel_right), axis=0)
    if len(right_intensities) > 0 and np.max(right_intensities) > 0:
        right_x = right_range_start + int(np.argmax(right_intensities))
    else:
        right_x = int(w_img * 0.928)

    if right_x < int(w_img * 0.910) or right_x > int(w_img * 0.945):
        right_x = int(w_img * 0.928)

    # Card borders: Front card starts right on left black border, Back card ends right on right black border
    pad_x = int(w_img * 0.001)
    pad_y = int(h_img * 0.001)
    fx1 = max(0, left_x - pad_x)
    fx2 = min(w_img, mid_x)
    bx1 = max(0, mid_x)
    bx2 = min(w_img, right_x + pad_x)
    cy1 = max(0, top_y - pad_y)
    cy2 = min(h_img, bot_y + pad_y)

    front_crop = {"x": fx1, "y": cy1, "width": fx2 - fx1, "height": cy2 - cy1}
    back_crop = {"x": bx1, "y": cy1, "width": bx2 - bx1, "height": cy2 - cy1}

    return front_crop, back_crop

def detect_ayushman_dual_cards(np_img):
    """Accurately detect Front (Top) and Back (Bottom) cards for Ayushman Bharat PM-JAY / ABHA cards.
    In NHA ABHA / Ayushman layout, the Front Side is the UPPER card and Back Side is the LOWER card."""
    import cv2
    import numpy as np

    h_img, w_img = np_img.shape[:2]
    total_area = w_img * h_img

    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 25, 120)
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, k_close)
    contours, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    top_cards = []
    bot_cards = []
    mid_y_split = int(h_img * 0.48)

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        aspect = float(w) / h if h > 0 else 0
        # Card should be between 3.5% and 45% of page area, with horizontal aspect ratio (1.15 to 2.20)
        if (total_area * 0.035) < area < (total_area * 0.45) and (1.15 <= aspect <= 2.20):
            card_info = {"x": x, "y": y, "w": w, "h": h, "area": area, "aspect": aspect}
            if (y + h // 2) < mid_y_split:
                top_cards.append(card_info)
            else:
                bot_cards.append(card_info)

    if top_cards and bot_cards:
        top_card = max(top_cards, key=lambda c: c["area"])
        bot_card = max(bot_cards, key=lambda c: c["area"])

        pad_x = int(top_card["w"] * 0.01)
        pad_y = int(top_card["h"] * 0.01)

        front_crop = {
            "x": max(0, top_card["x"] - pad_x),
            "y": max(0, top_card["y"] - pad_y),
            "width": min(w_img - max(0, top_card["x"] - pad_x), top_card["w"] + 2 * pad_x),
            "height": min(h_img - max(0, top_card["y"] - pad_y), top_card["h"] + 2 * pad_y)
        }
        back_crop = {
            "x": max(0, bot_card["x"] - pad_x),
            "y": max(0, bot_card["y"] - pad_y),
            "width": min(w_img - max(0, bot_card["x"] - pad_x), bot_card["w"] + 2 * pad_x),
            "height": min(h_img - max(0, bot_card["y"] - pad_y), bot_card["h"] + 2 * pad_y)
        }
        return front_crop, back_crop

    # Standard NHA ABHA / Ayushman Top-Bottom Geometry Fallback
    card_w = int(w_img * 0.88)
    card_h = int(card_w / 1.585)
    card_x = int((w_img - card_w) / 2)

    top_y = int(h_img * 0.08)
    bot_y = int(h_img * 0.52)

    front_crop = {"x": card_x, "y": top_y, "width": card_w, "height": min(card_h, int(h_img * 0.38))}
    back_crop = {"x": card_x, "y": bot_y, "width": card_w, "height": min(card_h, int(h_img * 0.38))}
    return front_crop, back_crop

def detect_dl_dual_cards(np_img):
    """Accurately detect Front (Left) and Back (Right) Driving Licence cards from an A4 sheet.
    Indian Union Driving Licence (Form 7) places both Front & Back side-by-side in the top half."""
    h_img, w_img = np_img.shape[:2]

    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
    
    # 1. Search for black border contours in the upper portion of the page
    upper_limit = int(h_img * 0.45)
    upper_gray = gray[:upper_limit, :]

    # Threshold for dark card borders
    _, thresh = cv2.threshold(upper_gray, 60, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    left_candidates = []
    right_candidates = []
    mid_split_x = w_img // 2

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        aspect = float(w) / h if h > 0 else 0
        area = w * h
        # Standard CR80 card width: 38% to 52% of page width, height: 16% to 28% of page height, aspect: 1.35 to 1.80
        if (0.38 * w_img <= w <= 0.52 * w_img) and (0.16 * h_img <= h <= 0.28 * h_img) and (1.35 <= aspect <= 1.80):
            card_data = {'x': x, 'y': y, 'width': w, 'height': h, 'area': area}
            if (x + w // 2) < mid_split_x:
                left_candidates.append(card_data)
            else:
                right_candidates.append(card_data)

    if left_candidates and right_candidates:
        front_crop = max(left_candidates, key=lambda c: c['area'])
        back_crop = max(right_candidates, key=lambda c: c['area'])
        return front_crop, back_crop

    # Fallback to standard Indian Union Driving Licence (Form 7) layout
    card_w = int(w_img * 0.469)
    card_h = int(card_w / 1.585)
    top_y = int(h_img * 0.0535)
    fx = int(w_img * 0.025)
    bx = int(w_img * 0.508)

    front_crop = {'x': fx, 'y': top_y, 'width': card_w, 'height': card_h}
    back_crop = {'x': bx, 'y': top_y, 'width': card_w, 'height': card_h}
    return front_crop, back_crop

def detect_pan_dual_cards(np_img):
    """Accurately detect Front (Left) and Back (Right) cards for e-PAN (Income Tax Department / NSDL / UTIITSL).
    In official Indian e-PAN A4 layout, Front Card is on the bottom-left and Back Card is on the bottom-right."""
    import cv2
    import numpy as np

    h_img, w_img = np_img.shape[:2]

    # Search in bottom region of the A4 page (y from 0.65 * h_img to 0.98 * h_img)
    y_start = int(h_img * 0.65)
    bottom_crop = np_img[y_start:, :]

    # 1. Primary method: Blue-Red color difference (e-PAN cards feature distinct cyan/blue background)
    b, g, r = cv2.split(bottom_crop)
    diff = b.astype(int) - r.astype(int)
    mask = (diff > 10).astype(np.uint8) * 255

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    found_cards = []
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        aspect = float(cw) / ch if ch > 0 else 0
        area = cw * ch
        # CR80 card: width ~25-50% of page, height ~10-25% of page, aspect 1.30-1.85
        if (w_img * 0.25 <= cw <= w_img * 0.50) and (h_img * 0.10 <= ch <= h_img * 0.25) and (1.30 <= aspect <= 1.85):
            found_cards.append({
                'x': x,
                'y': y_start + y,
                'width': cw,
                'height': ch,
                'aspect': aspect,
                'area': area
            })

    # 2. Secondary fallback: Edge / Contour detection if color mask didn't detect both cards
    if len(found_cards) < 2:
        gray_sub = cv2.cvtColor(bottom_crop, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray_sub, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
        edge_contours, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        for c in edge_contours:
            x, y, cw, ch = cv2.boundingRect(c)
            aspect = float(cw) / ch if ch > 0 else 0
            if (w_img * 0.25 <= cw <= w_img * 0.50) and (h_img * 0.10 <= ch <= h_img * 0.25) and (1.30 <= aspect <= 1.85):
                if not any(abs(fc['x'] - x) < 30 and abs(fc['y'] - (y_start + y)) < 30 for fc in found_cards):
                    found_cards.append({
                        'x': x,
                        'y': y_start + y,
                        'width': cw,
                        'height': ch,
                        'aspect': aspect,
                        'area': cw * ch
                    })

    # Sort candidates left to right
    found_cards.sort(key=lambda item: item['x'])

    if len(found_cards) >= 2:
        front_card = found_cards[0]
        back_card = found_cards[1]
        front_crop = {
            'x': front_card['x'],
            'y': front_card['y'],
            'width': front_card['width'],
            'height': front_card['height']
        }
        back_crop = {
            'x': back_card['x'],
            'y': back_card['y'],
            'width': back_card['width'],
            'height': back_card['height']
        }
        return front_crop, back_crop

    # 3. Geometric fallback to standard Indian e-PAN (Income Tax Department / NSDL / Protean) coordinates
    card_w = int(w_img * 0.394)
    card_h = int(card_w * (54.0 / 85.6))
    card_y = int(h_img * 0.773)
    fx = int(w_img * 0.115)
    bx = int(w_img * 0.518)

    front_crop = {'x': fx, 'y': card_y, 'width': card_w, 'height': card_h}
    back_crop = {'x': bx, 'y': card_y, 'width': card_w, 'height': card_h}
    return front_crop, back_crop

def detect_ration_dual_cards(np_img):
    """Accurately detect Front (Top) and Back (Bottom) Ration card bounding boxes from an A4 document.
    Ration cards (e.g. Delhi, UP, Bihar e-Ration) have Front and Back cards vertically stacked in the top half of the A4 page."""
    import cv2
    import numpy as np

    h_img, w_img = np_img.shape[:2]
    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 100)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    top_candidates = []
    bot_candidates = []

    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        aspect = float(cw) / ch if ch > 0 else 0
        area = cw * ch
        # Cards typically span 35% to 65% width and 15% to 35% height with aspect ratio 1.20 to 1.85
        if (w_img * 0.35 <= cw <= w_img * 0.65) and (h_img * 0.15 <= ch <= h_img * 0.35) and (1.20 <= aspect <= 1.85):
            card_info = {'x': x, 'y': y, 'width': cw, 'height': ch, 'aspect': aspect, 'area': area}
            if y < int(h_img * 0.25):
                top_candidates.append(card_info)
            elif int(h_img * 0.20) <= y <= int(h_img * 0.55):
                bot_candidates.append(card_info)

    if top_candidates and bot_candidates:
        top_card = max(top_candidates, key=lambda c: c['area'])
        bot_card = max(bot_candidates, key=lambda c: c['area'])

        sub_f = gray[max(0, top_card['y']-10):min(h_img, top_card['y']+top_card['height']+10), max(0, top_card['x']-10):min(w_img, top_card['x']+top_card['width']+10)]
        pts_f = cv2.findNonZero((sub_f < 250).astype(np.uint8))
        if pts_f is not None:
            fx, fy, fw, fh = cv2.boundingRect(pts_f)
            front_crop = {'x': max(0, top_card['x']-10) + fx, 'y': max(0, top_card['y']-10) + fy, 'width': fw, 'height': fh}
        else:
            front_crop = {'x': top_card['x'], 'y': top_card['y'], 'width': top_card['width'], 'height': top_card['height']}

        sub_b = gray[max(0, bot_card['y']-10):min(h_img, bot_card['y']+bot_card['height']+10), max(0, bot_card['x']-10):min(w_img, bot_card['x']+bot_card['width']+10)]
        pts_b = cv2.findNonZero((sub_b < 250).astype(np.uint8))
        if pts_b is not None:
            bx, by, bw, bh = cv2.boundingRect(pts_b)
            back_crop = {'x': max(0, bot_card['x']-10) + bx, 'y': max(0, bot_card['y']-10) + by, 'width': bw, 'height': bh}
        else:
            back_crop = {'x': bot_card['x'], 'y': bot_card['y'], 'width': bot_card['width'], 'height': bot_card['height']}

        return front_crop, back_crop

    # Geometric fallback for e-Ration A4
    card_w = int(w_img * 0.470)
    card_h = int(card_w / 1.55)
    front_crop = {'x': int(w_img * 0.264), 'y': int(h_img * 0.033), 'width': card_w, 'height': card_h}
    back_crop = {'x': int(w_img * 0.264), 'y': int(h_img * 0.260), 'width': card_w, 'height': card_h}
    return front_crop, back_crop

def detect_voter_dual_cards(np_img):
    """Accurately detect Front (Left) and Back (Right) Voter ID Cards (e-EPIC / Election Commission of India).
    Official e-EPIC documents feature two side-by-side CR80 cards in the bottom half of the A4 sheet."""
    import cv2
    import numpy as np

    h_img, w_img = np_img.shape[:2]
    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)

    # 1. Search in bottom half of the A4 page (y >= 0.45 * h_img)
    y_start = int(h_img * 0.45)
    bottom_gray = gray[y_start:, :]

    # Edge and threshold detection for card boundaries
    blurred = cv2.GaussianBlur(bottom_gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 30, 120)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    mid_split_x = w_img // 2
    left_candidates = []
    right_candidates = []

    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        aspect = float(w) / h if h > 0 else 0
        area = w * h
        # Standard CR80 card width: 36% to 52% of page, height: 15% to 30% of page, aspect: 1.30 to 1.85
        if (0.36 * w_img <= w <= 0.52 * w_img) and (0.15 * h_img <= h <= 0.30 * h_img) and (1.30 <= aspect <= 1.85):
            card_data = {'x': x, 'y': y_start + y, 'width': w, 'height': h, 'area': area}
            if (x + w // 2) < mid_split_x:
                left_candidates.append(card_data)
            else:
                right_candidates.append(card_data)

    if left_candidates and right_candidates:
        front_crop = max(left_candidates, key=lambda c: c['area'])
        back_crop = max(right_candidates, key=lambda c: c['area'])
        pad = int(w_img * 0.002)
        return (
            {
                'x': max(0, front_crop['x'] - pad),
                'y': max(0, front_crop['y'] - pad),
                'width': min(w_img - max(0, front_crop['x'] - pad), front_crop['width'] + 2 * pad),
                'height': min(h_img - max(0, front_crop['y'] - pad), front_crop['height'] + 2 * pad)
            },
            {
                'x': max(0, back_crop['x'] - pad),
                'y': max(0, back_crop['y'] - pad),
                'width': min(w_img - max(0, back_crop['x'] - pad), back_crop['width'] + 2 * pad),
                'height': min(h_img - max(0, back_crop['y'] - pad), back_crop['height'] + 2 * pad)
            }
        )

    # 2. Whole page scan fallback (in case cards are in upper or middle area)
    edges_all = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 30, 120)
    closed_all = cv2.morphologyEx(edges_all, cv2.MORPH_CLOSE, kernel)
    cnts_all, _ = cv2.findContours(closed_all, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    all_cards = []
    for c in cnts_all:
        x, y, w, h = cv2.boundingRect(c)
        aspect = float(w) / h if h > 0 else 0
        if (0.35 * w_img <= w <= 0.52 * w_img) and (0.15 * h_img <= h <= 0.30 * h_img) and (1.30 <= aspect <= 1.85):
            all_cards.append({'x': x, 'y': y, 'width': w, 'height': h, 'area': w * h})

    all_cards = sorted(all_cards, key=lambda item: item['x'])
    if len(all_cards) >= 2:
        return all_cards[0], all_cards[1]

    # Standard ECI e-EPIC A4 geometry fallback
    card_w = int(w_img * 0.440)
    card_h = int(card_w / 1.585)
    top_y = int(h_img * 0.655)
    fx = int(w_img * 0.045)
    bx = int(w_img * 0.515)
    return {'x': fx, 'y': top_y, 'width': card_w, 'height': card_h}, {'x': bx, 'y': top_y, 'width': card_w, 'height': card_h}

def check_is_divyang_card(np_img):
    """Check if image contains an Indian Railway's Divyangjan Identity Card in the upper-left quadrant."""
    import cv2
    import numpy as np
    h_img, w_img = np_img.shape[:2]
    quad_w = int(w_img * 0.55)
    quad_h = int(h_img * 0.45)
    quadrant = np_img[:quad_h, :quad_w]

    diff = np.max(255 - quadrant, axis=2)
    card_mask = (diff > 12).astype(np.uint8) * 255

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    closed = cv2.morphologyEx(card_mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        aspect = cw / float(ch) if ch > 0 else 0
        if (0.28 * w_img <= cw <= 0.48 * w_img) and (0.28 * h_img <= ch <= 0.45 * h_img) and (0.65 <= aspect <= 0.90):
            # Check for characteristic teal banner
            sub_card = quadrant[y:y+ch, x:x+cw]
            b, g, r = cv2.split(sub_card[:int(ch * 0.35), :])
            teal_pixels = np.sum((r < 80) & (g > 85) & (b > 85))
            if teal_pixels > 400:
                card_box = {
                    'x': max(0, x - 3),
                    'y': max(0, y - 3),
                    'width': min(w_img - max(0, x - 3), cw + 6),
                    'height': min(h_img - max(0, y - 3), ch + 6)
                }
                return True, card_box

    return False, None

def detect_divyang_card(np_img):
    """Accurately detect Indian Railway's Divyangjan Identity Card bounding box from an A4 sheet.
    Crucial requirement: Both the upper card details and the lower medical certificate / QR code
    form ONE single card ('both side in front side') bounded by the outer blue border."""
    import cv2
    import numpy as np

    is_div, div_box = check_is_divyang_card(np_img)
    if is_div and div_box:
        return div_box, div_box

    h_img, w_img = np_img.shape[:2]
    quad_w = int(w_img * 0.55)
    quad_h = int(h_img * 0.45)
    quadrant = np_img[:quad_h, :quad_w]

    diff = np.max(255 - quadrant, axis=2)
    card_mask = (diff > 12).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25))
    closed = cv2.morphologyEx(card_mask, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        aspect = cw / float(ch) if ch > 0 else 0
        area = cw * ch
        if (0.28 * w_img <= cw <= 0.48 * w_img) and (0.28 * h_img <= ch <= 0.45 * h_img) and (0.65 <= aspect <= 0.90):
            candidates.append({'x': x, 'y': y, 'width': cw, 'height': ch, 'area': area, 'aspect': aspect})

    if candidates:
        best_card = max(candidates, key=lambda item: item['area'])
        pad = int(w_img * 0.001)
        card_box = {
            'x': max(0, best_card['x'] - pad),
            'y': max(0, best_card['y'] - pad),
            'width': min(w_img - max(0, best_card['x'] - pad), best_card['width'] + 2 * pad),
            'height': min(h_img - max(0, best_card['y'] - pad), best_card['height'] + 2 * pad)
        }
        return card_box, card_box

    # Fallback to standard Indian Railway's Divyangjan Identity Card geometry
    cw = int(w_img * 0.410)
    ch = int(h_img * 0.378)
    cx = int(w_img * 0.011)
    cy = int(h_img * 0.008)
    def_crop = {'x': cx, 'y': cy, 'width': cw, 'height': ch}
    return def_crop, def_crop

def detect_other_cards(np_img):
    """Detect general / other ID cards (Voter ID, Student ID, Work ID, Divyangjan Railway ID, etc.) from an image or scanned document."""
    import cv2
    import numpy as np

    # 1. First check if the document is an Indian Railway's Divyangjan Identity Card
    is_div, div_box = check_is_divyang_card(np_img)
    if is_div and div_box:
        return div_box, div_box

    h_img, w_img = np_img.shape[:2]
    total_area = w_img * h_img

    gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 25, 120)
    k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, k_close)
    contours, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    valid_cards = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        aspect = float(w) / h if h > 0 else 0
        area = w * h
        if (total_area * 0.02) <= area <= (total_area * 0.75) and ((1.10 <= aspect <= 2.20) or (0.45 <= aspect <= 0.90)):
            valid_cards.append({'x': x, 'y': y, 'width': w, 'height': h, 'area': area, 'aspect': aspect})

    valid_cards = sorted(valid_cards, key=lambda c: c['area'], reverse=True)

    filtered = []
    for c in valid_cards:
        overlap = False
        for f in filtered:
            ix1 = max(c['x'], f['x'])
            iy1 = max(c['y'], f['y'])
            ix2 = min(c['x'] + c['width'], f['x'] + f['width'])
            iy2 = min(c['y'] + c['height'], f['y'] + f['height'])
            if ix2 > ix1 and iy2 > iy1:
                int_area = (ix2 - ix1) * (iy2 - iy1)
                if int_area > 0.35 * c['area']:
                    overlap = True
                    break
        if not overlap:
            filtered.append(c)

    if len(filtered) >= 2:
        c1, c2 = filtered[0], filtered[1]
        if abs(c1['y'] - c2['y']) > abs(c1['x'] - c2['x']):
            front_card = c1 if c1['y'] < c2['y'] else c2
            back_card = c2 if c1['y'] < c2['y'] else c1
        else:
            front_card = c1 if c1['x'] < c2['x'] else c2
            back_card = c2 if c1['x'] < c2['x'] else c1
        return front_card, back_card
    elif len(filtered) == 1:
        return filtered[0], filtered[0]

    cw = int(w_img * 0.45)
    ch = int(cw / 1.58)
    cx = int((w_img - cw) / 2)
    cy = int((h_img - ch) / 2)
    def_crop = {'x': cx, 'y': cy, 'width': cw, 'height': ch}
    return def_crop, def_crop

def detect_id_photo(front_bgr):
    """Detect resident photo on the front ID card using Haar cascade with geometry fallback"""
    import cv2
    h, w = front_bgr.shape[:2]
    try:
        gray = cv2.cvtColor(front_bgr, cv2.COLOR_BGR2GRAY)
        if hasattr(cv2, 'CascadeClassifier'):
            cascade_path = get_cascade_path('haarcascade_frontalface_default.xml')
            if os.path.exists(cascade_path):
                face_cascade = cv2.CascadeClassifier(cascade_path)
                if face_cascade and not face_cascade.empty():
                    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.05, minNeighbors=3, minSize=(int(h * 0.08), int(h * 0.08)))
                    if len(faces) > 0:
                        best_face = max(faces, key=lambda f: f[2] * f[3])
                        fx, fy, fw, fh = best_face
                        cx = fx + fw / 2.0
                        photo_w = fw * 1.65
                        photo_h = fh * 2.1
                        px1 = max(0, int(cx - photo_w / 2.0))
                        py1 = max(0, int(fy - fh * 0.35))
                        px2 = min(w, int(px1 + photo_w))
                        py2 = min(h, int(py1 + photo_h))
                        return {
                            "x": round((px1 / float(w)) * 100.0, 1),
                            "y": round((py1 / float(h)) * 100.0, 1),
                            "width": round(((px2 - px1) / float(w)) * 100.0, 1),
                            "height": round(((py2 - py1) / float(h)) * 100.0, 1)
                        }
    except Exception as e:
        print(f"Face photo detection error: {e}")
        
    # Standard official Aadhaar Front Card Photo Geometry fallback:
    # Photo sits on left side: X ≈ 7.5%, Y ≈ 27.0%, Width ≈ 22.0%, Height ≈ 36.5%
    return {
        "x": 7.5,
        "y": 27.0,
        "width": 22.0,
        "height": 36.5
    }

def enhance_card_text(cropped_bgr):
    """Enhance text contrast and sharpness so Name, DOB, Gender, and barcode appear dark, bold, and crisp"""
    try:
        cropped_rgba = cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGBA)
        pil_card = Image.fromarray(cropped_rgba)
        enhancer_s = ImageEnhance.Sharpness(pil_card)
        sharp_card = enhancer_s.enhance(1.35)
        enhancer_c = ImageEnhance.Contrast(sharp_card)
        enhanced_card = enhancer_c.enhance(1.12)
        return enhanced_card
    except Exception:
        return Image.fromarray(cv2.cvtColor(cropped_bgr, cv2.COLOR_BGR2RGBA))

@app.route('/api/idcard/auto-crop', methods=['POST'])
def auto_crop_idcard():
    """Detect rectangular ID card contour using OpenCV and return cropped card.
    Supports both Aadhaar (Left=Front, Right=Back) and Ayushman/ABHA (Top=Front, Bottom=Back) layouts."""
    try:
        data = request.get_json(force=True, silent=True) or {}
        img_b64 = data.get('image')
        side = data.get('side', 'front').lower() # 'front' or 'back'
        card_type = data.get('cardType', '').lower()

        if not img_b64:
            return jsonify({"error": "No image provided"}), 400

        import cv2
        import numpy as np

        pil_img = decode_base64_image(img_b64)
        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        h_img, w_img = np_img.shape[:2]
        total_area = w_img * h_img
        is_a4_portrait = (h_img / float(w_img)) > 1.15 # Standard A4 sheet (e-Aadhaar, ABHA, PAN letter)

        if is_a4_portrait:
            is_voter = any(k in card_type for k in ['voter', 'epic', 'e-epic', 'election', 'nirvachan', 'matdata'])
            is_divyang = any(k in card_type for k in ['divyang', 'railway', 'divyangjan', 'concession'])
            is_aadhaar = any(k in card_type for k in ['aadhaar', 'uidai', 'aadhar'])
            is_pan = any(k in card_type for k in ['pan', 'epan', 'income tax', 'nsdl', 'uti', 'utiitsl'])
            is_dl = any(k in card_type for k in ['dl', 'driving', 'license', 'licence'])
            is_ayushman = any(k in card_type for k in ['ayushman', 'abha', 'health', 'pmjay'])
            is_ration = any(k in card_type for k in ['ration', 'khadya', 'fso', 'fps', 'food security'])
            is_other = any(k in card_type for k in ['other', 'general', 'image', 'special', 'custom', 'divyang', 'railway'])

            if is_voter:
                front_coords, back_coords = detect_voter_dual_cards(np_img)
            elif is_divyang:
                front_coords, back_coords = detect_divyang_card(np_img)
            elif is_aadhaar:
                front_coords, back_coords = detect_aadhaar_dual_cards(np_img)
            elif is_pan:
                front_coords, back_coords = detect_pan_dual_cards(np_img)
            elif is_dl:
                front_coords, back_coords = detect_dl_dual_cards(np_img)
            elif is_ayushman:
                front_coords, back_coords = detect_ayushman_dual_cards(np_img)
            elif is_ration:
                front_coords, back_coords = detect_ration_dual_cards(np_img)
            elif is_other:
                # For "Other ID Card", check if it's Divyang Railway card first
                is_div, div_box = check_is_divyang_card(np_img)
                if is_div and div_box:
                    front_coords, back_coords = div_box, div_box
                else:
                    front_coords, back_coords = detect_other_cards(np_img)
            else:
                # Fallback auto-detection when card_type is unspecified
                is_div, div_box = check_is_divyang_card(np_img)
                if is_div and div_box:
                    front_coords, back_coords = div_box, div_box
                else:
                    bottom_strip = np_img[int(h_img * 0.70):, :]
                    if np.mean(bottom_strip > 240) > 0.98:
                        try:
                            front_coords, back_coords = detect_ration_dual_cards(np_img)
                        except Exception:
                            front_coords, back_coords = detect_aadhaar_dual_cards(np_img)
                    else:
                        front_coords, back_coords = detect_aadhaar_dual_cards(np_img)

            def extract_b64(coords):
                x, y, w, h = coords["x"], coords["y"], coords["width"], coords["height"]
                cropped = np_img[y:y+h, x:x+w]
                enhanced_pil = enhance_card_text(cropped)
                return encode_pil_to_base64(enhanced_pil, format="PNG")

            front_b64 = extract_b64(front_coords)
            back_b64 = extract_b64(back_coords)

            # Auto-detect resident photo on front card
            fx, fy, fw, fh = front_coords["x"], front_coords["y"], front_coords["width"], front_coords["height"]
            front_bgr = np_img[fy:fy+fh, fx:fx+fw]
            photo_box = detect_id_photo(front_bgr)

            chosen_b64 = front_b64 if side == 'front' else back_b64
            chosen_crop = front_coords if side == 'front' else back_coords

            return jsonify({
                "success": True,
                "isDualCard": True,
                "photoBox": photo_box,
                "front": {
                    "croppedImage": front_b64,
                    "originalImage": img_b64,
                    "crop": front_coords,
                    "photoBox": photo_box,
                    "detected": True
                },
                "back": {
                    "croppedImage": back_b64,
                    "originalImage": img_b64,
                    "crop": back_coords,
                    "detected": True
                },
                "croppedImage": chosen_b64,
                "originalImage": img_b64,
                "detected": True,
                "crop": chosen_crop
            })

        # Non-A4 Single Card Detection
        gray = cv2.cvtColor(np_img, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edged = cv2.Canny(blurred, 25, 120)

        k_close = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        closed = cv2.morphologyEx(edged, cv2.MORPH_CLOSE, k_close)
        contours, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

        valid_cards = []
        for c in contours:
            area = cv2.contourArea(c)
            if area < (total_area * 0.05) or area > (total_area * 0.95):
                continue
            x, y, w, h = cv2.boundingRect(c)
            aspect = float(w) / h if h > 0 else 0
            if (1.12 <= aspect <= 2.2) or (0.45 <= aspect <= 0.88):
                valid_cards.append({
                    "x": x, "y": y, "w": w, "h": h,
                    "area": area,
                    "aspect": aspect,
                    "score": area * (1.0 - abs(aspect - 1.58) / 1.58)
                })

        best_bbox = None
        if valid_cards:
            best = max(valid_cards, key=lambda c: c["score"])
            best_bbox = (best["x"], best["y"], best["w"], best["h"])

        if best_bbox:
            x, y, w, h = best_bbox
            pad_x = int(w * 0.008)
            pad_y = int(h * 0.008)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(w_img, x + w + pad_x)
            y2 = min(h_img, y + h + pad_y)
            cropped_np = np_img[y1:y2, x1:x2]
            detected = True
            crop_coords = {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1}
        else:
            cropped_np = np_img
            detected = False
            crop_coords = {"x": 0, "y": 0, "width": w_img, "height": h_img}

        cropped_rgba = cv2.cvtColor(cropped_np, cv2.COLOR_BGR2RGBA)
        cropped_pil = Image.fromarray(cropped_rgba)
        cropped_b64 = encode_pil_to_base64(cropped_pil, format="PNG")

        photo_box = detect_id_photo(cropped_np) if side == 'front' else None

        return jsonify({
            "success": True,
            "isDualCard": False,
            "croppedImage": cropped_b64,
            "originalImage": img_b64,
            "detected": detected,
            "crop": crop_coords,
            "photoBox": photo_box
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Auto crop error: {e}", file=sys.stderr)
        return jsonify({
            "success": False,
            "isDualCard": False,
            "croppedImage": img_b64,
            "originalImage": img_b64,
            "detected": False,
            "error": str(e)
        }), 500

@app.route('/api/idcard/rearrange-aadhaar', methods=['POST'])
def rearrange_aadhaar():
    """Smart Aadhaar Rearrangement:
    - Removes or masks the central red warning text box.
    - Shifts the 12-digit Aadhaar ID number up into the vacated space.
    - Preserves the bottom tagline ('Mera Aadhaar, Meri Pehchaan') intact.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        img_b64 = data.get('image')
        if not img_b64:
            return jsonify({"error": "No image provided"}), 400

        import cv2
        import numpy as np

        pil_img = decode_base64_image(img_b64)
        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        H, W = np_img.shape[:2]

        # Detect red warning box in the lower-middle band (50% to 78% of card height)
        hsv = cv2.cvtColor(np_img, cv2.COLOR_BGR2HSV)
        mask1 = cv2.inRange(hsv, np.array([0, 60, 50]), np.array([12, 255, 255]))
        mask2 = cv2.inRange(hsv, np.array([168, 60, 50]), np.array([180, 255, 255]))
        red_mask = mask1 | mask2

        band_top = int(H * 0.50)
        band_bottom = int(H * 0.78)
        roi_mask = np.zeros_like(red_mask)
        roi_mask[band_top:band_bottom, :] = red_mask[band_top:band_bottom, :]

        contours, _ = cv2.findContours(roi_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = [cv2.boundingRect(c) for c in contours if cv2.contourArea(c) > 40]

        if boxes:
            min_y = min(b[1] for b in boxes)
            max_y = max(b[1] + b[3] for b in boxes)
            warning_y1 = max(int(H * 0.48), min_y - int(H * 0.015))
            warning_y2 = min(int(H * 0.78), max_y + int(H * 0.015))
        else:
            warning_y1 = int(H * 0.56)
            warning_y2 = int(H * 0.72)

        # Aadhaar number section (from warning_y2 to tagline)
        tagline_y1 = int(H * 0.865)
        tagline_y2 = H
        number_y1 = warning_y2
        number_y2 = tagline_y1

        num_strip = np_img[number_y1:number_y2, :].copy()
        tag_strip = np_img[tagline_y1:tagline_y2, :].copy()

        # Sample clean background color from demographic section
        bg_sample = np_img[int(H * 0.40), int(W * 0.95)].tolist()

        result_img = np_img.copy()
        # Erase from warning_y1 to bottom with clean background
        result_img[warning_y1:H, :] = bg_sample

        # Shift 12-digit number up into the vacated space
        target_num_y = warning_y1 + int(H * 0.02)
        num_h = min(num_strip.shape[0], tagline_y1 - target_num_y)
        if num_h > 0:
            result_img[target_num_y:target_num_y + num_h, :] = num_strip[:num_h, :]

        # Paste the bottom tagline intact
        result_img[tagline_y1:tagline_y2, :] = tag_strip

        res_rgba = cv2.cvtColor(result_img, cv2.COLOR_BGR2RGBA)
        res_pil = Image.fromarray(res_rgba)
        res_b64 = encode_pil_to_base64(res_pil, format="PNG")

        return jsonify({
            "success": True,
            "image": res_b64
        })
    except Exception as e:
        print(f"Rearrange Aadhaar error: {e}")
        return jsonify({"error": str(e)}), 500

def apply_scanner_effect(np_bgr, mode='original'):
    """
    Apply document scanner filter:
    - 'original': keep original colors
    - 'magic_color' or 'color_scan': clean paper background to pure white, remove shadows, sharpen text & stamps
    - 'bw' or 'black_white': crisp photocopy / xerox monochrome document
    - 'grayscale': clean grayscale document
    """
    if not mode or mode == 'original':
        return np_bgr

    try:
        if mode in ('bw', 'black_white', 'grayscale'):
            # Professional Black & White (Preserves photo grayscale tones, enhances text darkness & contrast)
            gray = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
            enhanced_gray = clahe.apply(gray)
            blurred = cv2.GaussianBlur(enhanced_gray, (0, 0), 2.0)
            sharp_gray = cv2.addWeighted(enhanced_gray, 1.18, blurred, -0.18, 0)
            return cv2.cvtColor(sharp_gray, cv2.COLOR_GRAY2BGR)

        elif mode in ('magic_color', 'color_scan', 'scan', 'auto_beautify', 'beautify'):
            # Professional ID Card & Document Beautification:
            # Cleans paper background, removes phone camera shadows, sharpens text & numbers,
            # while 100% PRESERVING human face photos, natural skin tones, and government stamps!
            lab = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)

            # 1. Gentle adaptive histogram equalization on Luminance only (enhances text without washing out faces)
            clahe = cv2.createCLAHE(clipLimit=1.35, tileGridSize=(8, 8))
            cl = clahe.apply(l)

            # 2. High-precision unsharp masking for ultra-crisp, readable text, DOB, UID & QR code
            blurred_l = cv2.GaussianBlur(cl, (0, 0), 2.0)
            sharp_l = cv2.addWeighted(cl, 1.20, blurred_l, -0.20, 0)

            # 3. Preserve natural color channels with a subtle +5% vibrance boost
            a_f = (a.astype(float) - 128.0) * 1.05 + 128.0
            b_f = (b.astype(float) - 128.0) * 1.05 + 128.0
            a_out = np.clip(a_f, 0, 255).astype(np.uint8)
            b_out = np.clip(b_f, 0, 255).astype(np.uint8)

            merged_lab = cv2.merge((sharp_l, a_out, b_out))
            beautified = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
            return beautified

        elif mode in ('correction', 'auto_correct'):
            # Document auto-tone & level correction (fixes low-light, phone glare & dull tones smoothly)
            lab = cv2.cvtColor(np_bgr, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=1.2, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            limg = cv2.merge((cl, a, b))
            corrected = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
            return cv2.convertScaleAbs(corrected, alpha=1.05, beta=2)


    except Exception as e:
        print(f"Error applying scanner effect {mode}: {e}")

    return np_bgr

def detect_document_corners(np_bgr):
    """
    Detect 4 corners of document or ID card in photo.
    Returns 4 percentage points: [TL, TR, BR, BL] and suggested orientation.
    """
    h, w = np_bgr.shape[:2]
    scale = 800.0 / max(h, w)
    small_w = int(w * scale)
    small_h = int(h * scale)
    small = cv2.resize(np_bgr, (small_w, small_h))

    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(blurred, 30, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edges, kernel, iterations=2)

    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)

    found_pts = None
    min_area = (small_w * small_h) * 0.10

    for cnt in contours[:5]:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.025 * peri, True)
        if len(approx) == 4:
            found_pts = approx.reshape(4, 2)
            break

    if found_pts is None and len(contours) > 0 and cv2.contourArea(contours[0]) >= min_area:
        rect = cv2.minAreaRect(contours[0])
        box = cv2.boxPoints(rect)
        found_pts = np.int0(box)

    if found_pts is not None:
        pts = found_pts.astype(np.float32)
        s = pts.sum(axis=1)
        diff = np.diff(pts, axis=1).flatten()

        tl = pts[np.argmin(s)]
        br = pts[np.argmax(s)]
        tr = pts[np.argmin(diff)]
        bl = pts[np.argmax(diff)]

        ordered = [tl, tr, br, bl]
        res_pts = []
        for p in ordered:
            px_orig = (p[0] / scale) / w * 100.0
            py_orig = (p[1] / scale) / h * 100.0
            res_pts.append({
                'x': round(float(np.clip(px_orig, 0, 100)), 1),
                'y': round(float(np.clip(py_orig, 0, 100)), 1)
            })
        return res_pts
    return None

@app.route('/api/idcard/detect-corners', methods=['POST'])
def detect_corners_endpoint():
    """Auto-detect 4 document/card corners using OpenCV contour detection"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        img_b64 = data.get('image')
        if not img_b64:
            return jsonify({"error": "Image required"}), 400

        pil_img = decode_base64_image(img_b64)
        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        points = detect_document_corners(np_img)

        # Check orientation
        h, w = np_img.shape[:2]
        suggested_rotation = 0
        if w > h * 1.2:
            # Document image is landscape, might need 90 deg rotation for portrait doc
            suggested_rotation = 90

        return jsonify({
            "success": True,
            "points": points,
            "hasDetection": points is not None,
            "suggestedRotation": suggested_rotation
        })
    except Exception as e:
        print(f"Detect corners error: {e}")
        return jsonify({"error": str(e), "hasDetection": False}), 500

@app.route('/api/idcard/apply-scan-effect', methods=['POST'])
def apply_scan_effect_endpoint():
    """Apply Magic Color Scan or B&W scanner effect to document or card"""
    try:
        data = request.get_json(force=True, silent=True) or {}
        img_b64 = data.get('image')
        mode = data.get('mode', 'magic_color') # 'original' | 'magic_color' | 'bw' | 'grayscale'
        if not img_b64:
            return jsonify({"error": "Image required"}), 400

        pil_img = decode_base64_image(img_b64)
        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        scanned = apply_scanner_effect(np_img, mode)
        scanned_pil = Image.fromarray(cv2.cvtColor(scanned, cv2.COLOR_BGR2RGB))
        b64_res = encode_pil_to_base64(scanned_pil, format="PNG")

        return jsonify({
            "success": True,
            "dataUrl": b64_res,
            "mode": mode
        })
    except Exception as e:
        print(f"Apply scan effect error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/idcard/perspective-crop', methods=['POST'])
def perspective_crop_idcard():
    """Warp 4-point perspective polygon to flat rectified document image (e.g. for WhatsApp skewed A4 docs)."""
    try:
        data = request.get_json(force=True, silent=True) or {}
        img_b64 = data.get('image')
        points = data.get('points')
        scan_mode = data.get('scanMode', 'original')
        raw_target_aspect = data.get('targetAspect')
        try:
            target_aspect = float(raw_target_aspect) if raw_target_aspect is not None else 1.414
        except (ValueError, TypeError):
            target_aspect = 1.414
        is_percent = data.get('isPercent', True)
        rotation = float(data.get('rotation', 0) or 0)

        if not img_b64 or not points or len(points) != 4:
            return jsonify({"error": "Valid image and 4 corner points required"}), 400

        pil_img = decode_base64_image(img_b64)
        if rotation != 0:
            pil_img = pil_img.rotate(-rotation, expand=True, resample=Image.BICUBIC)

        np_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGR)
        h_img, w_img = np_img.shape[:2]

        pts_src = []
        for pt in points:
            if is_percent:
                px = float(pt['x']) * w_img / 100.0
                py = float(pt['y']) * h_img / 100.0
            else:
                px = float(pt['x'])
                py = float(pt['y'])
            pts_src.append([px, py])

        pts_src = np.array(pts_src, dtype=np.float32)

        top_w = np.linalg.norm(pts_src[1] - pts_src[0])
        bot_w = np.linalg.norm(pts_src[2] - pts_src[3])
        left_h = np.linalg.norm(pts_src[3] - pts_src[0])
        right_h = np.linalg.norm(pts_src[2] - pts_src[1])

        dst_w = int(max(top_w, bot_w, 600))
        if target_aspect > 0:
            dst_h = int(dst_w * target_aspect)
        else:
            dst_h = int(max(left_h, right_h, 400))

        pts_dst = np.array([
            [0, 0],
            [dst_w, 0],
            [dst_w, dst_h],
            [0, dst_h]
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(pts_src, pts_dst)
        warped = cv2.warpPerspective(np_img, M, (dst_w, dst_h), flags=cv2.INTER_LANCZOS4)

        # Apply scanner effect if specified
        if scan_mode and scan_mode != 'original':
            warped = apply_scanner_effect(warped, scan_mode)

        enhanced_pil = enhance_card_text(warped)
        b64_res = encode_pil_to_base64(enhanced_pil, format="PNG")

        return jsonify({
            "success": True,
            "dataUrl": b64_res,
            "width": dst_w,
            "height": dst_h
        })
    except Exception as e:
        print(f"Perspective crop error: {e}")
        return jsonify({"error": f"Perspective crop failed: {str(e)}"}), 500

@app.route('/api/idcard/export-single', methods=['POST'])
def export_idcard_single():
    """Export single CR80 front+back pair at specified DPI"""
    try:
        data = request.get_json() or {}
        front_b64 = data.get('front')
        back_b64 = data.get('back')
        dpi = int(data.get('dpi', 300))
        img_format = data.get('format', 'PNG').upper()
        # CR80 standard: 85.6mm x 54mm. At 300 DPI: w=1011px, h=638px
        target_w = int(data.get('width', 1011))
        target_h = int(data.get('height', 638))
        margin_x = int(data.get('marginX', 0))
        margin_y = int(data.get('marginY', 0))
        raw_margin_x = int(round(margin_x * (dpi / 96.0))) if margin_x > 0 else 0
        scale_margin_x = max(50, raw_margin_x) if margin_x > 0 else 0
        scale_margin_y = int(round(margin_y * (dpi / 96.0))) if margin_y > 0 else 0

        front_img = decode_base64_image(front_b64) if front_b64 else None
        back_img = decode_base64_image(back_b64) if back_b64 else None

        if not front_img and not back_img:
            return jsonify({"error": "No image provided"}), 400

        # Resize individual cards to target dimensions
        resized_front = front_img.resize((target_w, target_h), Image.Resampling.LANCZOS) if front_img else Image.new("RGB", (target_w, target_h), (255, 255, 255))
        resized_back = back_img.resize((target_w, target_h), Image.Resampling.LANCZOS) if back_img else Image.new("RGB", (target_w, target_h), (255, 255, 255))

        # Combine side-by-side with 2px folding line strictly bounded by user margins
        folding_gap = 2
        pair_w = (target_w * 2) + folding_gap
        total_w = pair_w + (scale_margin_x * 2)
        total_h = target_h + (scale_margin_y * 2)
        combined = Image.new("RGB", (total_w, total_h), (255, 255, 255))
        
        combined.paste(resized_front.convert("RGB"), (scale_margin_x, scale_margin_y))
        # Draw central folding line
        draw = ImageDraw.Draw(combined)
        fold_x = scale_margin_x + target_w
        draw.line([(fold_x, scale_margin_y), (fold_x, scale_margin_y + target_h)], fill=(0, 0, 0), width=folding_gap)
        combined.paste(resized_back.convert("RGB"), (fold_x + folding_gap, scale_margin_y))
        
        # Outer cutting border
        draw.rectangle([scale_margin_x, scale_margin_y, scale_margin_x + pair_w - 1, scale_margin_y + target_h - 1], outline=(0, 0, 0), width=1)

        buffered = io.BytesIO()
        if img_format in ['JPG', 'JPEG']:
            combined.save(buffered, format="JPEG", quality=95, dpi=(dpi, dpi))
            mime = "image/jpeg"
            ext = "jpg"
        else:
            combined.save(buffered, format="PNG", dpi=(dpi, dpi))
            mime = "image/png"
            ext = "png"

        b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({
            "success": True,
            "dataUrl": f"data:{mime};base64,{b64}",
            "format": ext,
            "mime": mime
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/idcard/generate-sheet', methods=['POST'])
def generate_idcard_sheet():
    """Generate high-res 300 DPI A4 sheet for multiple ID card pairs with strict folding gap"""
    try:
        data = request.get_json() or {}
        items = data.get('items', [])
        out_format = data.get('format', 'PNG').upper()
        margin_x = int(data.get('marginX', 16))
        margin_y = int(data.get('marginY', 24))

        if not items:
            return jsonify({"error": "No ID cards provided"}), 400

        dpi = 300
        # A4: 210mm x 297mm -> 2480 x 3508 pixels at 300 DPI
        a4_w = 2480
        a4_h = 3508
        
        # CR80 standard card: 85.6mm x 54mm -> 1011 x 638 pixels at 300 DPI
        card_w = 1011
        card_h = 638
        folding_gap = 2

        if out_format == 'DOCX':
            # Create MS Word Document with exact ID card table
            doc = Document()
            for section in doc.sections:
                section.top_margin = Inches(margin_y / 96.0)
                section.bottom_margin = Inches(margin_y / 96.0)
                section.left_margin = Inches(margin_x / 96.0)
                section.right_margin = Inches(margin_x / 96.0)
                section.page_width = Inches(8.27)
                section.page_height = Inches(11.69)

            table = doc.add_table(rows=len(items), cols=2)
            table.alignment = WD_TABLE_ALIGNMENT.CENTER
            table.autofit = False

            for idx, item in enumerate(items):
                row = table.rows[idx]
                row.height = Pt(153) # ~54mm in points

                f_b64 = item.get('front')
                b_b64 = item.get('back')

                # Cell 0: Front
                if f_b64:
                    f_img = decode_base64_image(f_b64).convert("RGB")
                    f_buf = io.BytesIO()
                    f_img.save(f_buf, format="JPEG", quality=95)
                    f_buf.seek(0)
                    p0 = row.cells[0].paragraphs[0]
                    p0.paragraph_format.space_before = Pt(0)
                    p0.paragraph_format.space_after = Pt(0)
                    r0 = p0.add_run()
                    r0.add_picture(f_buf, width=Inches(3.37), height=Inches(2.125))

                # Cell 1: Back
                if b_b64:
                    b_img = decode_base64_image(b_b64).convert("RGB")
                    b_buf = io.BytesIO()
                    b_img.save(b_buf, format="JPEG", quality=95)
                    b_buf.seek(0)
                    p1 = row.cells[1].paragraphs[0]
                    p1.paragraph_format.space_before = Pt(0)
                    p1.paragraph_format.space_after = Pt(0)
                    r1 = p1.add_run()
                    r1.add_picture(b_buf, width=Inches(3.37), height=Inches(2.125))

            doc_io = io.BytesIO()
            doc.save(doc_io)
            b64_content = base64.b64encode(doc_io.getvalue()).decode('utf-8')
            return jsonify({
                "success": True,
                "dataUrl": f"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,{b64_content}",
                "format": "docx",
                "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            })

        # Standard A4 Sheet dimensions: 2480 x 3508 at 300 DPI (matching Print Preview full page)
        canvas = Image.new("RGB", (a4_w, a4_h), (255, 255, 255))
        draw = ImageDraw.Draw(canvas)

        preview_w = float(data.get('previewWidth', 240.0))
        if preview_w <= 0:
            preview_w = 240.0
        preview_h = preview_w * (3508.0 / 2480.0)

        # Proportional scale factor from live Print Preview to 300 DPI A4
        scale_x = a4_w / preview_w
        scale_y = a4_h / preview_h

        # Dynamic margins scaled proportionally from Print Preview container to 300 DPI A4
        raw_margin_x = int(round(margin_x * scale_x))
        margin_val = max(50, raw_margin_x)

        raw_margin_y = int(round(margin_y * scale_y))
        start_y = max(50, raw_margin_y)

        # Dynamic card sizing matching Print Preview's flex-1 layout inside equal margins
        available_w = a4_w - (margin_val * 2)
        card_w = int((available_w - folding_gap) / 2)
        card_h = int(round(card_w * (54.0 / 85.6))) # Strictly preserve CR80 85.6:54 ratio

        start_x = margin_val
        curr_y = start_y
        card_gap_input = int(data.get('cardGap', 10))
        gap_y = max(4, int(round(card_gap_input * scale_y))) # Dynamic vertical gap between cards

        for item in items:
            f_b64 = item.get('front')
            b_b64 = item.get('back')

            # Per-card individual X-Axis and Y-Axis margin offsets scaled proportionally
            item_offset_x = int(round(float(item.get('offsetX', 0)) * scale_x))
            item_offset_y = int(round(float(item.get('offsetY', 0)) * scale_y))

            # Docs Mode: Full page A4 document rendering
            if item.get('isDoc'):
                doc_b64 = item.get('docImage') or f_b64
                if doc_b64:
                    doc_img = decode_base64_image(doc_b64)
                    avail_w = a4_w - (margin_val * 2)
                    avail_h = a4_h - (start_y * 2)
                    doc_w = avail_w
                    doc_h = int(doc_w * 1.414)
                    if doc_h > avail_h:
                        doc_h = avail_h
                        doc_w = int(doc_h / 1.414)
                    res_doc = doc_img.resize((doc_w, doc_h), Image.Resampling.LANCZOS).convert("RGB")
                    doc_x = start_x + (avail_w - doc_w) // 2 + item_offset_x
                    doc_y = start_y + (avail_h - doc_h) // 2 + item_offset_y
                    canvas.paste(res_doc, (doc_x, doc_y))
                curr_y += a4_h
                continue

            card_start_x = max(0, min(a4_w - (card_w * 2 + folding_gap), start_x + item_offset_x))
            card_start_y = max(0, min(a4_h - card_h, curr_y + item_offset_y))

            f_img = decode_base64_image(f_b64) if f_b64 else None
            b_img = decode_base64_image(b_b64) if b_b64 else None

            # Render Front
            if f_img:
                res_f = f_img.resize((card_w, card_h), Image.Resampling.LANCZOS).convert("RGB")
                canvas.paste(res_f, (card_start_x, card_start_y))
            draw.rectangle([card_start_x, card_start_y, card_start_x + card_w, card_start_y + card_h], outline=(0, 0, 0), width=1)

            # Central Folding Line (strictly 1-2px)
            fold_x = card_start_x + card_w
            draw.line([(fold_x, card_start_y), (fold_x, card_start_y + card_h)], fill=(0, 0, 0), width=folding_gap)

            # Render Back
            back_x = fold_x + folding_gap
            if b_img:
                res_b = b_img.resize((card_w, card_h), Image.Resampling.LANCZOS).convert("RGB")
                canvas.paste(res_b, (back_x, card_start_y))
            draw.rectangle([back_x, card_start_y, back_x + card_w, card_start_y + card_h], outline=(0, 0, 0), width=1)

            curr_y += card_h + gap_y

        buffered = io.BytesIO()
        if out_format == 'PDF':
            canvas.save(buffered, format="PDF", resolution=dpi)
            mime = "application/pdf"
            ext = "pdf"
        else:
            canvas.save(buffered, format="PNG", dpi=(dpi, dpi))
            mime = "image/png"
            ext = "png"

        b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        return jsonify({
            "success": True,
            "dataUrl": f"data:{mime};base64,{b64}",
            "format": ext,
            "mime": mime
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/printers', methods=['GET'])
def get_printers():
    """Fetch installed Windows printers with zero latency via pywin32 or PowerShell fallback"""
    printers = []
    default_printer = "EPSON L3560 Series" # Default cyber cafe printer fallback

    if WIN32_PRINT_AVAILABLE and sys.platform == 'win32':
        try:
            enum_flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
            installed = win32print.EnumPrinters(enum_flags)
            try:
                def_p = win32print.GetDefaultPrinter()
            except Exception:
                def_p = ''

            for p_tuple in installed:
                p_name = p_tuple[2]
                is_def = (p_name == def_p)
                printers.append({
                    "name": p_name,
                    "isDefault": is_def,
                    "status": "Ready"
                })
                if is_def:
                    default_printer = p_name

            if not default_printer and printers:
                default_printer = printers[0]["name"]
        except Exception as e_w32:
            print(f"[Printers] win32print query notice: {e_w32}")

    if not printers:
        try:
            if sys.platform == 'win32':
                cmd = "Get-CimInstance Win32_Printer | Select-Object Name, Default, PrinterStatus | ConvertTo-Json"
                proc = subprocess.run(["powershell", "-NoProfile", "-Command", cmd], capture_output=True, text=True, timeout=5)
                if proc.returncode == 0 and proc.stdout.strip():
                    try:
                        data = json.loads(proc.stdout)
                        if isinstance(data, dict):
                            data = [data]
                        for p in data:
                            p_name = p.get('Name', '')
                            if p_name:
                                printers.append({
                                    "name": p_name,
                                    "isDefault": bool(p.get('Default', False)),
                                    "status": "Ready"
                                })
                                if p.get('Default'):
                                    default_printer = p_name
                    except Exception:
                        pass
        except Exception as e:
            print(f"Error querying printers via powershell: {e}")

    if not printers:
        printers = [
            {"name": "Epson L3560 Series", "isDefault": True, "status": "Ready"},
            {"name": "HP DeskJet Ink Advantage 2300", "isDefault": False, "status": "Ready"},
            {"name": "Canon PIXMA G3010", "isDefault": False, "status": "Ready"},
            {"name": "Microsoft Print to PDF", "isDefault": False, "status": "Ready"}
        ]

    return jsonify({
        "printers": printers,
        "activePrinter": default_printer
    })

@app.route('/api/native-print', methods=['POST'])
def native_print():
    """
    Bypasses Electron's Chromium print limitations entirely via Native Windows Print Spooler.
    Modifies the printer driver's DEVMODE structure to force Glossy Paper & High Quality in 1 click.
    """
    if not WIN32_PRINT_AVAILABLE:
        return jsonify({
            "success": False,
            "error": "Native Windows Print Spooler requires pywin32 on Windows OS."
        }), 500

    data = request.get_json(silent=True) or {}
    base64_image = data.get('base64_image') or data.get('snapshot') or data.get('image')
    requested_printer = data.get('printer_name') or data.get('printerName')
    paper_type = str(data.get('paper_type') or data.get('paperType') or 'Glossy').strip()
    quality = str(data.get('quality') or 'High').strip()
    copies = int(data.get('copies') or 1)
    color_mode = str(data.get('color_mode') or data.get('colorMode') or 'color').strip().lower()

    if not base64_image:
        return jsonify({
            "success": False,
            "error": "No base64 image data received for native print."
        }), 400

    # 1. Resolve Target Printer
    enum_flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    installed_printers = [p[2] for p in win32print.EnumPrinters(enum_flags)]
    target_printer = None

    if requested_printer:
        # Check exact match
        for p in installed_printers:
            if p.lower() == requested_printer.lower():
                target_printer = p
                break
        # Check substring match (e.g. 'Epson L3560' -> 'EPSOND9CD10 (L3560 Series)')
        if not target_printer:
            req_clean = requested_printer.lower().replace("series", "").strip()
            for p in installed_printers:
                p_clean = p.lower()
                if req_clean in p_clean or p_clean in req_clean:
                    target_printer = p
                    break

    # Fallback to system default printer
    if not target_printer:
        try:
            target_printer = win32print.GetDefaultPrinter()
        except Exception:
            if installed_printers:
                target_printer = installed_printers[0]

    if not target_printer:
        return jsonify({"success": False, "error": "No installed Windows printer detected."}), 404

    # 2. Decode Base64 Image
    try:
        if ',' in base64_image:
            base64_image = base64_image.split(',', 1)[1]
        img_bytes = base64.b64decode(base64_image)
        pil_image = Image.open(io.BytesIO(img_bytes))
        if pil_image.mode != 'RGB':
            pil_image = pil_image.convert('RGB')
    except Exception as img_err:
        return jsonify({"success": False, "error": f"Failed to decode image data: {img_err}"}), 400

    # 3. Access & Modify Printer DEVMODE Structure (Glossy Paper & High Quality)
    hPrinter = None
    devmode = None
    try:
        hPrinter = win32print.OpenPrinter(target_printer)
        pinfo = win32print.GetPrinter(hPrinter, 2)
        devmode = pinfo.get('pDevMode')

        if devmode is not None:
            # Force A4 Portrait Canvas
            devmode.Orientation = win32con.DMORIENT_PORTRAIT
            devmode.PaperSize = win32con.DMPAPER_A4

            # Force Color / Grayscale
            if color_mode in ['grayscale', 'mono', 'monochrome', 'black']:
                devmode.Color = win32con.DMCOLOR_MONOCHROME
            else:
                devmode.Color = win32con.DMCOLOR_COLOR

            # Force Print Quality: High (DMRES_HIGH signals driver to apply maximum DPI / fine detailing)
            devmode.PrintQuality = win32con.DMRES_HIGH

            # Force Media Type: Glossy Paper
            paper_lower = paper_type.lower()
            if any(k in paper_lower for k in ['glossy', 'photo', 'ultra', 'premium']):
                devmode.MediaType = win32con.DMMEDIA_GLOSSY  # Standard Windows DMMEDIA_GLOSSY = 3
            elif 'transparency' in paper_lower:
                devmode.MediaType = win32con.DMMEDIA_TRANSPARENCY
            else:
                devmode.MediaType = win32con.DMMEDIA_STANDARD

            if copies > 1:
                devmode.Copies = copies
                devmode.Fields |= win32con.DM_COPIES

            devmode.Fields |= (
                win32con.DM_ORIENTATION |
                win32con.DM_PAPERSIZE |
                win32con.DM_COLOR |
                win32con.DM_PRINTQUALITY |
                win32con.DM_MEDIATYPE
            )

            # Reconcile driver private DEVMODE fields (e.g. Epson driver private media types)
            try:
                win32print.DocumentProperties(
                    0, hPrinter, target_printer, devmode, devmode,
                    win32con.DM_IN_BUFFER | win32con.DM_OUT_BUFFER
                )
            except Exception as e_dp:
                print(f"[Native Print] DocumentProperties driver notice: {e_dp}")
    except Exception as e_dm:
        print(f"[Native Print] DEVMODE configuration warning: {e_dm}", file=sys.stderr)
    finally:
        if hPrinter:
            try:
                win32print.ClosePrinter(hPrinter)
            except Exception:
                pass

    # 4. Create Win32 Device Context with Modified DEVMODE & Execute Spooler Job
    hdc = None
    try:
        # Create DC with the modified DEVMODE containing Glossy & High Quality instructions
        if devmode is not None:
            hdc = win32gui.CreateDC("WINSPOOL", target_printer, devmode)
        else:
            hdc = win32gui.CreateDC("WINSPOOL", target_printer, None)

        dc = win32ui.CreateDCFromHandle(hdc)

        # Retrieve printer hardware capabilities
        dpi_x = dc.GetDeviceCaps(win32con.LOGPIXELSX) or 600
        dpi_y = dc.GetDeviceCaps(win32con.LOGPIXELSY) or 600
        printable_w = dc.GetDeviceCaps(win32con.HORZRES)
        printable_h = dc.GetDeviceCaps(win32con.VERTRES)
        phys_w = dc.GetDeviceCaps(win32con.PHYSICALWIDTH) or printable_w
        phys_h = dc.GetDeviceCaps(win32con.PHYSICALHEIGHT) or printable_h
        phys_offset_x = dc.GetDeviceCaps(win32con.PHYSICALOFFSETX) or 0
        phys_offset_y = dc.GetDeviceCaps(win32con.PHYSICALOFFSETY) or 0

        # Calculate exact 10px margin (scaled from 72 DPI CSS bounds to printer hardware dots)
        # 10px in standard 72 pt/in = (10.0 / 72.0) * dpi
        margin_dots_x = int(round((10.0 / 72.0) * dpi_x))
        margin_dots_y = int(round((10.0 / 72.0) * dpi_y))

        # Adjust for printer hardware non-printable offsets
        dest_x1 = max(0, margin_dots_x - phys_offset_x)
        dest_y1 = max(0, margin_dots_y - phys_offset_y)
        dest_x2 = min(printable_w, phys_w - margin_dots_x - phys_offset_x)
        dest_y2 = min(printable_h, phys_h - margin_dots_y - phys_offset_y)

        available_w = max(100, dest_x2 - dest_x1)
        available_h = max(100, dest_y2 - dest_y1)

        # Scale image to fit within bounds preserving exact aspect ratio
        img_w, img_h = pil_image.size
        scale = min(available_w / float(img_w), available_h / float(img_h))
        draw_w = int(round(img_w * scale))
        draw_h = int(round(img_h * scale))

        draw_x1 = dest_x1 + (available_w - draw_w) // 2
        draw_y1 = dest_y1
        draw_x2 = draw_x1 + draw_w
        draw_y2 = draw_y1 + draw_h

        # 5. Execute Spooler Job Natively
        job_name = f"Digital Cyber Cafe - {paper_type} Print"
        dc.StartDoc(job_name)
        dc.StartPage()

        dib = ImageWin.Dib(pil_image)
        dib.draw(hdc, (draw_x1, draw_y1, draw_x2, draw_y2))

        dc.EndPage()
        dc.EndDoc()

        print(f"[Native Print] Successfully spooled print job to '{target_printer}' (Media: {paper_type}, Quality: High)")
        return jsonify({
            "success": True,
            "message": f"Successfully spooled to '{target_printer}'",
            "printer": target_printer,
            "paperType": paper_type,
            "quality": quality,
            "copies": copies
        })
    except Exception as e_print:
        print(f"[Native Print Spooler Error]: {e_print}", file=sys.stderr)
        return jsonify({
            "success": False,
            "error": f"Native spooler error: {e_print}"
        }), 500
    finally:
        if hdc:
            try:
                win32gui.DeleteDC(hdc)
            except Exception:
                pass


if __name__ == '__main__':
    multiprocessing.freeze_support()
    print(f"Starting Digital Cyber Cafe Passport Service on port {PORT}...")
    app.run(host='127.0.0.1', port=PORT, debug=False)
