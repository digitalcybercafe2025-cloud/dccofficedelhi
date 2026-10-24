import os
import sys
import shutil
import subprocess

def build_backend():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    backend_script = os.path.join(project_root, 'backend', 'app.py')
    output_dir = os.path.join(project_root, 'resources_build', 'backend')
    build_work_dir = os.path.join(project_root, 'resources_build', 'build_temp')

    print("==========================================================")
    print("  Digital Cyber Cafe - Lightweight Packaging Pipeline     ")
    print("  Stack: Pure ONNXRuntime + OpenCV + Native Win32 Spooler ")
    print("==========================================================")
    print(f"Project Root: {project_root}")
    print(f"Backend Script: {backend_script}")
    print(f"Target Output: {output_dir}")

    # Clean old build temp if present
    if os.path.exists(build_work_dir):
        try:
            shutil.rmtree(build_work_dir, ignore_errors=True)
        except Exception:
            pass

    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(build_work_dir, exist_ok=True)

    # Find cv2 Haar cascades directory
    cv2_data_dir = None
    try:
        import cv2
        if hasattr(cv2, 'data') and hasattr(cv2.data, 'haarcascades'):
            cv2_data_dir = cv2.data.haarcascades
    except Exception:
        pass
    if not cv2_data_dir or not os.path.exists(cv2_data_dir):
        fallback_cv2 = os.path.join(project_root, 'clean_env', 'Lib', 'site-packages', 'cv2', 'data')
        if os.path.exists(fallback_cv2):
            cv2_data_dir = fallback_cv2

    models_dir = os.path.join(project_root, 'backend', 'models')
    if not os.path.exists(models_dir) or not os.listdir(models_dir):
        models_dir = os.path.join(project_root, 'resources_build', 'backend', 'models')

    # 1. Run PyInstaller with STRICT exclusion of PyTorch and heavy bloat (~450MB target)
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconsole",
        "--onefile",
        "--distpath", output_dir,
        "--workpath", build_work_dir,
        "--specpath", build_work_dir,
        "--name", "py_backend",
        "--clean",
        # Exclude bloatware: torch, tensorboard, matplotlib, test suites (~450MB savings)
        "--exclude-module", "torch",
        "--exclude-module", "torchvision",
        "--exclude-module", "torchaudio",
        "--exclude-module", "tensorboard",
        "--exclude-module", "matplotlib",
        "--exclude-module", "matplotlib.backends",
        "--exclude-module", "scipy",
        "--exclude-module", "pandas",
        "--exclude-module", "IPython",
        "--exclude-module", "jupyter",
        "--exclude-module", "notebook",
        "--exclude-module", "pytest",
        "--exclude-module", "unittest",
        "--exclude-module", "test",
        "--exclude-module", "setuptools",
        "--exclude-module", "distutils",
        "--exclude-module", "pip",
        "--exclude-module", "wheel",
        "--exclude-module", "pkg_resources",
        "--exclude-module", "tkinter",
        "--exclude-module", "sympy",
        # Essential Lightweight Stack
        "--hidden-import", "win32print",
        "--hidden-import", "win32ui",
        "--hidden-import", "win32gui",
        "--hidden-import", "win32con",
        "--hidden-import", "flask",
        "--hidden-import", "flask_cors",
        "--hidden-import", "PIL.ImageWin",
        "--hidden-import", "PIL.Image",
        "--hidden-import", "PIL.ImageEnhance",
        "--hidden-import", "PIL.ImageDraw",
        "--hidden-import", "PIL.ImageOps",
        "--hidden-import", "onnxruntime",
        "--hidden-import", "rembg",
        "--hidden-import", "fitz",
        "--hidden-import", "pymupdf",
        "--hidden-import", "docx",
        "--hidden-import", "docx.shared",
        "--hidden-import", "docx.enum.text",
        "--hidden-import", "docx.enum.table",
        "--collect-all", "docx",
        "--collect-all", "rembg",
        "--collect-all", "onnxruntime",
        "--collect-all", "pymupdf",
        "--collect-all", "fitz",
        "--collect-all", "cv2",
    ]
    if cv2_data_dir and os.path.exists(cv2_data_dir):
        cmd.extend(["--add-data", f"{cv2_data_dir}{os.pathsep}cv2/data"])
    if os.path.exists(models_dir):
        cmd.extend(["--add-data", f"{models_dir}{os.pathsep}models"])
    cmd.append(backend_script)

    print("\n[Step 1/3] Compiling ultra-fast lightweight Python backend...")
    print("Executing:", " ".join(cmd))
    res = subprocess.run(cmd, cwd=project_root)
    if res.returncode != 0:
        print("PyInstaller compilation failed!", file=sys.stderr)
        sys.exit(res.returncode)

    print("\n[Step 2/3] Bundling essential offline ONNX models...")
    target_models_dir = os.path.join(output_dir, 'models')
    os.makedirs(target_models_dir, exist_ok=True)

    # Copy isnet-general-use.onnx (High-precision hair & edge delineation)
    user_u2net = os.path.expanduser('~/.u2net')
    isnet_src = os.path.join(user_u2net, 'isnet-general-use.onnx')
    if not os.path.exists(isnet_src):
        # Fallback check inside project
        p_isnet = os.path.join(project_root, 'resources_build', 'backend', 'models', 'isnet-general-use.onnx')
        if os.path.exists(p_isnet):
            isnet_src = p_isnet

    if os.path.exists(isnet_src):
        dst_isnet = os.path.join(target_models_dir, 'isnet-general-use.onnx')
        if not os.path.exists(dst_isnet) or os.path.getsize(dst_isnet) != os.path.getsize(isnet_src):
            print(f"Copying IS-Net ONNX model -> {dst_isnet}...")
            shutil.copy2(isnet_src, dst_isnet)
    else:
        print("Notice: isnet-general-use.onnx not found locally, will be loaded via rembg runtime if present.")

    # Remove duplicate or heavy models not needed
    old_u2net = os.path.join(target_models_dir, 'u2net.onnx')
    if os.path.exists(old_u2net):
        try: os.remove(old_u2net)
        except Exception: pass

    old_gfpgan = os.path.join(target_models_dir, 'GFPGANv1.4.pth')
    if os.path.exists(old_gfpgan):
        try: os.remove(old_gfpgan)
        except Exception: pass

    old_weights_dir = os.path.join(output_dir, 'gfpgan')
    if os.path.exists(old_weights_dir):
        try: shutil.rmtree(old_weights_dir, ignore_errors=True)
        except Exception: pass

    # Copy eng.traineddata OCR model if present
    eng_ocr = os.path.join(project_root, 'eng.traineddata')
    if os.path.exists(eng_ocr):
        dst_ocr = os.path.join(output_dir, 'eng.traineddata')
        if not os.path.exists(dst_ocr) or os.path.getsize(dst_ocr) != os.path.getsize(eng_ocr):
            print(f"Copying OCR model eng.traineddata -> {dst_ocr}...")
            shutil.copy2(eng_ocr, dst_ocr)

    # Copy cv2 Haar cascades to target backend directory as well
    if cv2_data_dir and os.path.exists(cv2_data_dir):
        target_cv2_dir = os.path.join(output_dir, 'cv2', 'data')
        os.makedirs(target_cv2_dir, exist_ok=True)
        for item in os.listdir(cv2_data_dir):
            if item.endswith('.xml'):
                s_file = os.path.join(cv2_data_dir, item)
                d_file = os.path.join(target_cv2_dir, item)
                if not os.path.exists(d_file):
                    shutil.copy2(s_file, d_file)
        print("Bundled OpenCV Haar Cascades ->", target_cv2_dir)

    print("\n[Step 3/3] Lightweight backend bundle ready in:", output_dir)
    print("Files in target backend bundle:")
    total_size = 0
    for root, dirs, files in os.walk(output_dir):
        rel = os.path.relpath(root, output_dir)
        for f in files:
            f_path = os.path.join(root, f)
            size_mb = os.path.getsize(f_path) / (1024 * 1024)
            total_size += size_mb
            print(f"  - {os.path.join(rel, f)} ({size_mb:.2f} MB)")

    print(f"\nTotal Lightweight Backend Footprint: {total_size:.2f} MB")
    print("PyInstaller backend build completed successfully!")

if __name__ == '__main__':
    build_backend()
