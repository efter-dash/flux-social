import os
import zipfile

root_dir = os.path.abspath(".")
output_zip = os.path.join(root_dir, "public", "flux-desktop-local.zip")

# Files and directories to include
include_files = [
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "tailwind.config.js",
    "postcss.config.js",
    "index.html",
    "README.md",
    "README-MAC.txt",
    "Launch-FLUX-Mac.command",
    "Start-Ollama-Mac.command",
    "Launch-FLUX-Windows.bat",
    "Start-Ollama-Windows.bat",
    "LICENSE",
    ".env.example"
]

include_dirs = [
    "src",
    "dist"
]

print("Creating zip archive at", output_zip)
os.makedirs(os.path.join(root_dir, "public"), exist_ok=True)

with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
    # Add root files
    for f in include_files:
        full_path = os.path.join(root_dir, f)
        if os.path.exists(full_path):
            z.write(full_path, arcname=os.path.join("flux-local", f))
            print(f"Added file: {f}")

    # Add public directory (excluding zip itself)
    public_dir = os.path.join(root_dir, "public")
    for root, dirs, files in os.walk(public_dir):
        for f in files:
            if f.endswith(".zip"):
                continue
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, root_dir)
            z.write(full_path, arcname=os.path.join("flux-local", rel_path))

    # Add directories
    for d in include_dirs:
        dir_path = os.path.join(root_dir, d)
        if os.path.exists(dir_path):
            for root, dirs, files in os.walk(dir_path):
                for f in files:
                    full_path = os.path.join(root, f)
                    rel_path = os.path.relpath(full_path, root_dir)
                    z.write(full_path, arcname=os.path.join("flux-local", rel_path))
            print(f"Added directory: {d}")

print("Successfully created:", output_zip, f"({os.path.getsize(output_zip)} bytes)")
