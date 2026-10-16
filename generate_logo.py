import os
from PIL import Image, ImageDraw, ImageFont

def create_swiss_mail_icon(size=1024, dark=True):
    # Colors matching ramazanoglu-web
    bg_color = (17, 17, 17, 255) if dark else (251, 251, 249, 255)
    primary_color = (251, 251, 249, 255) if dark else (17, 17, 17, 255)
    hairline_color = (45, 45, 45, 255) if dark else (226, 226, 223, 255)
    accent_color = (217, 56, 30, 255) # #D9381E International Orange
    muted_color = (120, 120, 115, 255) if dark else (136, 136, 132, 255)

    img = Image.new("RGBA", (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    # Hairline architectural boundary
    margin = int(size * 0.05)
    draw.rectangle([margin, margin, size - margin - 1, size - margin - 1], outline=hairline_color, width=max(1, int(size * 0.003)))

    # Architectural Corner Crosshairs (+)
    cross_len = int(size * 0.035)
    cross_w = max(1, int(size * 0.002))
    corners = [
        (margin, margin),
        (size - margin, margin),
        (margin, size - margin),
        (size - margin, size - margin)
    ]
    for cx, cy in corners:
        draw.line([(cx - cross_len, cy), (cx + cross_len, cy)], fill=muted_color, width=cross_w)
        draw.line([(cx, cy - cross_len), (cx, cy + cross_len)], fill=muted_color, width=cross_w)

    # Core Architectural "R" Monogram + Mail Envelope Fold
    # Grid coordinates within inner frame [0.22 * size to 0.78 * size]
    x0 = int(size * 0.24)
    y0 = int(size * 0.22)
    w = int(size * 0.52)
    h = int(size * 0.56)

    stem_w = int(w * 0.24)
    # 1. Solid Left Stem of "R"
    draw.rectangle([x0, y0, x0 + stem_w, y0 + h], fill=primary_color)

    # 2. Top Bar of "R"
    loop_h = int(h * 0.52)
    bar_h = int(loop_h * 0.38)
    draw.rectangle([x0 + stem_w, y0, x0 + w - int(w * 0.12), y0 + bar_h], fill=primary_color)

    # 3. Right Vertical of "R" Loop
    loop_right = x0 + w - int(w * 0.12)
    draw.rectangle([loop_right - stem_w, y0, loop_right, y0 + loop_h], fill=primary_color)

    # 4. Middle Cross Bar of "R"
    draw.rectangle([x0 + stem_w, y0 + loop_h - bar_h, loop_right, y0 + loop_h], fill=primary_color)

    # 5. Architectural Diagonal Leg of "R" (Solid geometric polygon)
    leg_start_x = x0 + int(w * 0.32)
    leg_start_y = y0 + loop_h - int(bar_h * 0.2)
    leg_end_x = x0 + w + int(w * 0.04)
    leg_end_y = y0 + h
    leg_pts = [
        (leg_start_x, leg_start_y),
        (leg_start_x + int(stem_w * 1.1), leg_start_y),
        (leg_end_x, leg_end_y),
        (leg_end_x - int(stem_w * 1.25), leg_end_y),
    ]
    draw.polygon(leg_pts, fill=primary_color)

    # 6. Envelope Mail Isometric Fold (Geometric Hairline Line)
    # Line connecting top-left of stem to the leg intersection, representing mail flap
    env_w = max(2, int(size * 0.005))
    draw.line([(x0, y0), (x0 + stem_w + int(w * 0.2), y0 + loop_h // 2)], fill=muted_color, width=env_w)

    # 7. Signature International Orange Focus Square (Strict Swiss Accent)
    # Positioned at upper right of the monogram
    sq_size = int(size * 0.11)
    sq_x = loop_right + int(size * 0.035)
    sq_y = y0
    draw.rectangle([sq_x, sq_y, sq_x + sq_size, sq_y + sq_size], fill=accent_color)

    # 8. Subtle Technical Label at Bottom
    try:
        # JetBrains Mono or basic sans
        font_size = int(size * 0.042)
        font = ImageFont.truetype("C:\\Windows\\Fonts\\consola.ttf", font_size)
    except Exception:
        font = ImageFont.load_default()

    label = "RAMAZANO\u011eLU // MAIL HQ"
    draw.text((x0, y0 + h + int(size * 0.05)), label, font=font, fill=muted_color)

    return img

def export_all():
    out_dir = r"C:\Users\PC\Desktop\Ramazanoglu_Tech_Logo_Suite"
    os.makedirs(out_dir, exist_ok=True)
    res_dir = r"C:\Users\PC\.gemini\antigravity\scratch\ramazanoglu-tech-mail-hq\desktop-cpp\resources"
    os.makedirs(res_dir, exist_ok=True)
    pwa_dir = r"C:\Users\PC\.gemini\antigravity\scratch\ramazanoglu-tech-mail-hq\mobile-pwa\public"

    print("Generating Master 1024x1024 Swiss Architectural Logos...")
    icon_dark = create_swiss_mail_icon(1024, dark=True)
    icon_light = create_swiss_mail_icon(1024, dark=False)

    icon_dark.save(os.path.join(out_dir, "ramazanoglu_mail_hq_dark_1024.png"), "PNG")
    icon_light.save(os.path.join(out_dir, "ramazanoglu_mail_hq_light_1024.png"), "PNG")

    # Downsampled versions
    for s in [512, 256, 128, 64, 32]:
        d_res = icon_dark.resize((s, s), Image.Resampling.LANCZOS)
        l_res = icon_light.resize((s, s), Image.Resampling.LANCZOS)
        d_res.save(os.path.join(out_dir, f"icon_dark_{s}x{s}.png"), "PNG")
        l_res.save(os.path.join(out_dir, f"icon_light_{s}x{s}.png"), "PNG")

    # Save multi-res Windows .ico file (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_layers = [icon_dark.resize(size, Image.Resampling.LANCZOS) for size in ico_sizes]
    
    desktop_ico = os.path.join(out_dir, "app.ico")
    cpp_ico = os.path.join(res_dir, "app.ico")
    
    icon_dark.save(desktop_ico, format="ICO", sizes=ico_sizes)
    icon_dark.save(cpp_ico, format="ICO", sizes=ico_sizes)

    # Save PWA icons
    pwa_icon_png = os.path.join(pwa_dir, "icon-512.png")
    icon_dark.resize((512, 512), Image.Resampling.LANCZOS).save(pwa_icon_png, "PNG")

    # Generate pure Scalable Vector SVG
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#111111"/>
  <!-- Architectural Outer Hairline -->
  <rect x="24" y="24" width="464" height="464" fill="none" stroke="#2D2D2D" stroke-width="1.5"/>
  <!-- Corner Crosshairs -->
  <path d="M 12 24 L 36 24 M 24 12 L 24 36" stroke="#787873" stroke-width="1"/>
  <path d="M 476 24 L 500 24 M 488 12 L 488 36" stroke="#787873" stroke-width="1"/>
  <path d="M 12 488 L 36 488 M 24 476 L 24 500" stroke="#787873" stroke-width="1"/>
  <path d="M 476 488 L 500 488 M 488 476 L 488 500" stroke="#787873" stroke-width="1"/>
  <!-- Core Monogram R -->
  <rect x="120" y="110" width="60" height="280" fill="#FBFBF9"/>
  <rect x="180" y="110" width="140" height="50" fill="#FBFBF9"/>
  <rect x="260" y="110" width="60" height="140" fill="#FBFBF9"/>
  <rect x="180" y="200" width="140" height="50" fill="#FBFBF9"/>
  <!-- Diagonal Leg -->
  <polygon points="200,240 265,240 380,390 315,390" fill="#FBFBF9"/>
  <!-- Mail Fold Hairline -->
  <line x1="120" y1="110" x2="235" y2="180" stroke="#787873" stroke-width="2"/>
  <!-- Signature International Orange Focus Square -->
  <rect x="340" y="110" width="55" height="55" fill="#D9381E"/>
  <!-- Technical Type -->
  <text x="120" y="435" font-family="'JetBrains Mono', Consolas, monospace" font-size="19" font-weight="600" letter-spacing="2" fill="#787873">RAMAZANOĞLU // MAIL HQ</text>
</svg>"""

    with open(os.path.join(out_dir, "ramazanoglu_mail_hq_logo.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)
    with open(os.path.join(res_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)
    with open(os.path.join(pwa_dir, "icon.svg"), "w", encoding="utf-8") as f:
        f.write(svg_content)

    print(f"Export completed successfully to:\n  - {out_dir}\n  - {res_dir}\n  - {pwa_dir}")

if __name__ == "__main__":
    export_all()
