"""Regenerate Android brand assets from the full-resolution public church logo (Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
res = root / 'android/app/src/main/res'
logo = Image.open(root / 'public/church-logo.png').convert('RGBA')
densities = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}

def centered(canvas_size, logo_size, background):
    canvas = Image.new('RGBA', canvas_size, background)
    scaled = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(scaled, ((canvas.width - logo_size) // 2, (canvas.height - logo_size) // 2))
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
    # Android's circular splash mask fits a full 136dp square inside its 192dp safe circle.
    centered((round(288 * scale),) * 2, round(136 * scale), (0, 0, 0, 0)).save(drawables / 'qnlbc_splash_logo.png')
    for orientation in ['port', 'land']:
        target = res / f'drawable-{orientation}-{density}' / 'splash.png'
        with Image.open(target) as previous:
            size = previous.size
        centered(size, round(160 * scale), '#020617').save(target)

centered((480, 320), 160, '#020617').save(res / 'drawable/splash.png')
