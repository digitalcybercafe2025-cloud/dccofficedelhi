# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller Spec Configuration for Digital Cyber Cafe Python Backend
Includes: rembg, ONNXRuntime, PyMuPDF, OpenCV Cascades, docx templates, Win32 Spooler
Target Footprint: Lightweight without PyTorch/Matplotlib bloat
"""
import os
import sys
from PyInstaller.utils.hooks import collect_data_files, collect_all

block_cipher = None
project_root = os.path.abspath(os.path.dirname(__file__))

datas = []
binaries = []
hiddenimports = [
    'win32print', 'win32ui', 'win32gui', 'win32con',
    'flask', 'flask_cors',
    'PIL.ImageWin', 'PIL.Image', 'PIL.ImageEnhance', 'PIL.ImageDraw', 'PIL.ImageOps',
    'onnxruntime', 'rembg', 'fitz', 'pymupdf',
    'docx', 'docx.shared', 'docx.enum.text', 'docx.enum.table'
]

# Collect all package assets and dynamic libraries
for pkg in ['pymupdf', 'fitz', 'docx', 'rembg', 'onnxruntime', 'cv2']:
    try:
        t = collect_all(pkg)
        datas += t[0]
        binaries += t[1]
        hiddenimports += t[2]
    except Exception as e:
        print(f"Hook notice for {pkg}: {e}")

# Bundled OpenCV cascades & models
cv2_data_dir = os.path.join(project_root, 'clean_env', 'Lib', 'site-packages', 'cv2', 'data')
if os.path.exists(cv2_data_dir):
    datas.append((cv2_data_dir, 'cv2/data'))

models_dir = os.path.join(project_root, 'resources_build', 'backend', 'models')
if os.path.exists(models_dir):
    datas.append((models_dir, 'models'))

a = Analysis(
    [os.path.join(project_root, 'backend', 'app.py')],
    pathex=[project_root],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch', 'torchvision', 'torchaudio', 'tensorboard',
        'matplotlib', 'matplotlib.backends', 'scipy', 'pandas',
        'IPython', 'jupyter', 'notebook', 'pytest', 'unittest',
        'test', 'setuptools', 'distutils', 'pip', 'wheel',
        'tkinter', 'sympy'
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='py_backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
