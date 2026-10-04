import os
import zipfile

EXCLUDE_DIRS = {'node_modules', '.git', '__pycache__', '.pytest_cache', 'dist'}
EXCLUDE_EXTS = {'.pyc', '.zip', '.exe'}

root_dir = r"C:\Users\Aryan Singh\.gemini\antigravity\scratch\vendor-reliability-platform"
zip_path = os.path.join(root_dir, "vendor-reliability-platform.zip")

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for file in files:
            if any(file.endswith(ext) for ext in EXCLUDE_EXTS):
                continue
            if file == "vendoriq.db":
                continue
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, root_dir)
            try:
                zipf.write(full_path, arcname)
            except Exception as e:
                print(f"Skipping {file}: {e}")

print(f"Successfully packaged {zip_path}")
