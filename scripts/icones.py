"""Gera os ícones do aplicativo (PWA, iPhone e navegador) a partir da logo oficial.
Uso: python3 scripts/icones.py <logo_gestaovia.png>
A logo é o quadrado verde arredondado com o G (fundo transparente em volta; o recorte é automático).
- icons/icon-N.png ......... quadrado arredondado, cantos transparentes (ícone "any" do Android/computador)
- icons/maskable-N.png ..... fundo verde cheio, G dentro da área segura (o Android recorta em círculo/gota)
- icons/apple-touch-icon.png e icon-180.png ... fundo verde cheio (o iPhone arredonda sozinho)
- favicon.ico .............. 16, 32, 48 e 64 px
"""
import sys, pathlib
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ICONS = ROOT / 'icons'
GREEN = (10, 247, 151)  # #0AF797, mesma cor do theme_color

src = Image.open(sys.argv[1]).convert('RGBA')
a = np.array(src)
ys, xs = np.where(a[:, :, 3] > 10)
side = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
cx, cy = (xs.min() + xs.max() + 1) // 2, (ys.min() + ys.max() + 1) // 2
box = src.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side))  # quadrado arredondado
b = np.array(box).astype(int); n = b.shape[0]

# marca (G branco com pontilhado): tudo o que não é o verde do fundo, longe da borda arredondada
diff = np.abs(b[:, :, :3] - np.array(GREEN)).sum(2)
edge = int(n * 0.065)
inner = np.zeros((n, n), bool); inner[edge:n - edge, edge:n - edge] = True
mark = (diff > 40) & inner & (b[:, :, 3] > 200)
my, mx = np.where(mark)
assert mx.min() > edge and my.min() > edge and mx.max() < n - edge and my.max() < n - edge, 'marca encosta na borda'

# versão de fundo cheio: verde em todo o quadrado + miolo do original (sem cantos transparentes nem brilho da borda)
full = Image.new('RGBA', (n, n), GREEN + (255,))
full.paste(box.crop((edge, edge, n - edge, n - edge)), (edge, edge))
full = full.convert('RGB')

# maskable: a marca inteira dentro do círculo seguro (raio de 40% do ícone), com folga
r = np.sqrt((mx - n / 2) ** 2 + (my - n / 2) ** 2).max()
scale = min(1.0, (0.40 * 0.94 * n) / r)
small = full.resize((round(n * scale), round(n * scale)), Image.LANCZOS)
mask = Image.new('RGB', (n, n), GREEN); mask.paste(small, ((n - small.width) // 2, (n - small.height) // 2))

def out(img, size, path):
    im = img.resize((size, size), Image.LANCZOS)
    im.save(path, optimize=True)

for s in (16, 32, 48, 64, 128, 192, 256, 512): out(box, s, ICONS / f'icon-{s}.png')
for s in (192, 512): out(mask, s, ICONS / f'maskable-{s}.png')
out(full, 180, ICONS / 'apple-touch-icon.png'); out(full, 180, ICONS / 'icon-180.png')
box.resize((256, 256), Image.LANCZOS).save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print(f'logo {n}px · marca ocupa {(mx.max()-mx.min())/n:.0%} × {(my.max()-my.min())/n:.0%} · maskable em {scale:.0%}')
