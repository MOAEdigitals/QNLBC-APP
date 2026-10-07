from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
source = Image.open(root / "public" / "church-logo.png").convert("RGBA")

def launcher(size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), "white")
    logo = source.copy()
    logo.thumbnail((int(size * 0.88), int(size * 0.88)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo, ((size - logo.width) // 2, (size - logo.height) // 2))
    return canvas.convert("RGB")

sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
res = root / "android" / "app" / "src" / "main" / "res"
for density, size in sizes.items():
    folder = res / f"mipmap-{density}"
    icon = launcher(size)
    icon.save(folder / "ic_launcher.png")
    icon.save(folder / "ic_launcher_foreground.png")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    rounded = Image.new("RGBA", (size, size))
    rounded.paste(icon, mask=mask)
    rounded.save(folder / "ic_launcher_round.png")

for folder in list(res.glob("drawable-*-*")) + [res / "drawable"]:
    target = folder / "splash.png"
    if not target.exists():
        continue
    width, height = Image.open(target).size
    splash = Image.new("RGB", (width, height), "#071124")
    logo = source.copy()
    logo.thumbnail((int(width * 0.48), int(height * 0.48)), Image.Resampling.LANCZOS)
    splash.paste(logo, ((width - logo.width) // 2, (height - logo.height) // 2), logo)
    splash.save(target)
