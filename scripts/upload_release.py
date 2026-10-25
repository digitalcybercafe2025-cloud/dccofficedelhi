import os
import sys
import json
import urllib.request

TOKEN = os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
if not TOKEN:
    # Try reading from git config or environment
    try:
        import subprocess
        remote_url = subprocess.check_output(['git', 'remote', 'get-url', 'origin'], text=True).strip()
        if '@' in remote_url and 'x-access-token:' in remote_url:
            TOKEN = remote_url.split('x-access-token:')[1].split('@')[0]
    except Exception:
        pass
REPO = 'digitalcybercafe2025-cloud/dccofficedelhi'
TAG = 'v2.0.4'
RELEASE_ID = 422877705

HEADERS = {
    'User-Agent': 'DCC-Release-Uploader',
    'Authorization': f'token {TOKEN}',
    'Accept': 'application/vnd.github.v3+json'
}

def get_existing_assets():
    url = f'https://api.github.com/repos/{REPO}/releases/{RELEASE_ID}/assets'
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def delete_asset(asset_id, name):
    print(f"Deleting old asset: {name} ({asset_id})...")
    url = f'https://api.github.com/repos/{REPO}/releases/assets/{asset_id}'
    req = urllib.request.Request(url, headers=HEADERS, method='DELETE')
    with urllib.request.urlopen(req) as resp:
        print(f"Deleted {name} (status {resp.status})")

def upload_file(file_path):
    filename = os.path.basename(file_path)
    size = os.path.getsize(file_path)
    size_mb = size / (1024 * 1024)
    print(f"Uploading {filename} ({size_mb:.2f} MB)...")

    content_type = 'application/octet-stream'
    if filename.endswith('.yml'):
        content_type = 'text/yaml'

    upload_url = f'https://uploads.github.com/repos/{REPO}/releases/{RELEASE_ID}/assets?name={filename}'
    
    with open(file_path, 'rb') as f:
        data = f.read()

    req = urllib.request.Request(
        upload_url,
        data=data,
        headers={
            **HEADERS,
            'Content-Type': content_type,
            'Content-Length': str(len(data))
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode())
        print(f"Successfully uploaded {filename} (ID: {res.get('id')})")

def main():
    print(f"--- Updating GitHub Release {TAG} ---")
    files_to_upload = [
        os.path.join('release', 'latest.yml'),
        os.path.join('release', 'DigitalCyberCafe_Setup_v2.0.4.exe.blockmap'),
        os.path.join('release', 'DigitalCyberCafe_Setup_v2.0.4.exe')
    ]

    for f in files_to_upload:
        if not os.path.exists(f):
            print(f"Error: Required file not found: {f}")
            sys.exit(1)

    existing = get_existing_assets()
    file_names = {os.path.basename(f): f for f in files_to_upload}

    for a in existing:
        if a['name'] in file_names:
            delete_asset(a['id'], a['name'])

    for f in files_to_upload:
        upload_file(f)

    print("\n All release files successfully published to GitHub Release v2.0.4!")

if __name__ == '__main__':
    main()
