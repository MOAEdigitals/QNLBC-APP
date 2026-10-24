"""Regenerate Android brand assets from the full-resolution public church logo (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
res = root / 'android/app/src/main/res'
logo = Image.open(root / 'public/church-logo.png').convert('RGBA')
densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def centered(canvas_size, logo_size, background):
    canvas = Image.new('RGBA', canvas_size, background)
    scaled = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, ((canvas.width - logo_size) // 2, (canvas.height - logo_size) // 2))
    return canvas

def branded_splash(canvas_size, scale, system_icon=False):
    canvas = Image.new('RGBA', canvas_size, (0, 0, 0, 0) if system_icon else '#020617')
    logo_size = round((120 if system_icon else 160) * scale)
    font = ImageFont.truetype(str(root / 'public/fonts/plus-jakarta-sans-500.ttf'), round((11 if system_icon else 13) * scale))
    gap = round((8 if system_icon else 12) * scale)
    top = round(76 * scale) if system_icon else (canvas.height - logo_size - gap - round(17 * scale)) // 2
    scaled = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, ((canvas.width - logo_size) // 2, top))
    ImageDraw.Draw(canvas).text((canvas.width / 2, top + logo_size + gap), 'New Life Baptist Church', font=font, fill='#e2e8f0', anchor='mt')
    return canvas

for density, scale in densities.items():
    icons = res / f'mipmap-{density}'
    # Adaptive icons use a 108dp layer, not the legacy 48dp launcher bitmap.
    centered((round(108 * scale),) * 2, round(66 * scale), 'white').save(icons / 'ic_launcher_foreground.png')
    size = round(48 * scale)
    icon = centered((size,) * 2, round(44 * scale), 'white')
    icon.save(icons / 'ic_launcher.png')
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    icon.putalpha(mask)
    icon.save(icons / 'ic_launcher_round.png')
    drawables = res / f'drawable-{density}'
    drawables.mkdir(exist_ok=True)
    # Both the logo and caption fit inside Android's 192dp circular safe area.
    branded_splash((round(288 * scale),) * 2, scale, system_icon=True).save(drawables / 'qnlbc_splash_logo.png')
    for orientation in ['port', 'land']:
        target = res / f'drawable-{orientation}-{density}' / 'splash.png'
        with Image.open(target) as previous:
            size = previous.size
        branded_splash(size, scale).save(target)

branded_splash((480, 320), 1).save(res / 'drawable/splash.png')
