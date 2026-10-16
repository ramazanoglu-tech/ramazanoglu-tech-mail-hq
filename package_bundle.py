import os
import shutil
import zipfile

def prepare_staging_and_zip():
    base_dir = r"C:\Users\PC\.gemini\antigravity\scratch\ramazanoglu-tech-mail-hq"
    release_dir = os.path.join(base_dir, "desktop-cpp", "build", "Release")
    staging_dir = os.path.join(base_dir, "staging_bundle")
    zip_output = os.path.join(base_dir, "installer", "payload.zip")

    os.makedirs(os.path.dirname(zip_output), exist_ok=True)
    if os.path.exists(staging_dir):
        shutil.rmtree(staging_dir)
    os.makedirs(staging_dir, exist_ok=True)

    print("Copying Release files to staging...")
    for item in os.listdir(release_dir):
        # Skip pdb or intermediate obj if any
        if item.endswith(".pdb") or item.endswith(".obj") or item.endswith(".ilk") or item.endswith(".exp") or item.endswith(".lib"):
            continue
        src = os.path.join(release_dir, item)
        dst = os.path.join(staging_dir, item)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    # Copy app.ico
    ico_src = os.path.join(base_dir, "desktop-cpp", "resources", "app.ico")
    shutil.copy2(ico_src, os.path.join(staging_dir, "app.ico"))

    # Copy email templates
    templates_src = os.path.join(base_dir, "email-templates")
    if os.path.exists(templates_src):
        shutil.copytree(templates_src, os.path.join(staging_dir, "email-templates"))

    # Default config.json
    config_content = """{
  "api_base_url": "http://localhost:8765",
  "ws_url": "ws://localhost:8765/ws",
  "super_admin_key": "RamazanogluTech2026!Master",
  "domain": "@ramazanoglu.tech",
  "installation_target": "SUPER_ADMIN_PARTNER"
}"""
    with open(os.path.join(staging_dir, "config.json"), "w", encoding="utf-8") as f:
        f.write(config_content)

    readme_content = """================================================================================
RAMAZANOĞLU TECH // MAIL HQ (SUPER ADMIN SUITE)
Swiss-Style Architectural Minimalism & Zero-Local Dependency Engine
================================================================================
Bu yazılım Ramazanoğlu Tech ortakları (Yusuf & Nur) ve kurumsal çekirdek ekip
için özel olarak yapılandırılmış hibrit e-posta yönetim merkezidir.

Masaüstü Uygulaması: RamazanogluTechMailHQ.exe
Bulut API Uç Noktası: http://localhost:8765
Canlı WebSocket Akışı: ws://localhost:8765/ws
Kurumsal Kimlik Doğrulama: Zero-Trust Token / Super Admin Key Korunmaktadır.
================================================================================
"""
    with open(os.path.join(staging_dir, "README_KURULUM.txt"), "w", encoding="utf-8") as f:
        f.write(readme_content)

    print("Compressing staging_bundle into payload.zip...")
    with zipfile.ZipFile(zip_output, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(staging_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, staging_dir)
                zf.write(file_path, arcname)

    zip_size_mb = os.path.getsize(zip_output) / (1024 * 1024)
    print(f"payload.zip created successfully: {zip_output} ({zip_size_mb:.2f} MB)")

if __name__ == "__main__":
    prepare_staging_and_zip()
