"""Gera dist/index.html (arquivo único) a partir de src/.
Uso: python3 build.py
A configuração pública (endereço do Supabase e chave publicável) vem de config.json.
Nunca coloque chaves secretas (service_role, sb_secret_..., token do Traccar) em config.json."""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / 'src'
ORDER = ['01-core.js', '02-logic.js', '03-shell.js', '04-driver.js', '05-manager.js', '07-calendar.js',
         '08-gps.js', '09-docs.js', '10-pdf.js', '11-cloud.js', '12-perfil.js', '13-relatorios.js', '06-modules.js']

cfg = json.loads((ROOT / 'config.json').read_text(encoding='utf-8'))
VERSION = (ROOT / 'VERSION').read_text(encoding='utf-8').strip() if (ROOT / 'VERSION').exists() else ''
public = {'version': VERSION, 'supabaseUrl': cfg.get('supabaseUrl', ''), 'supabaseKey': cfg.get('supabaseKey', '')}
key = public['supabaseKey']
# trava de segurança: só aceita chave publicável/anon
if key and not (key.startswith('sb_publishable_') or '"role":"anon"' in (lambda p: __import__('base64').urlsafe_b64decode(p + '=' * (-len(p) % 4)).decode('utf-8', 'ignore'))(key.split('.')[1] if key.count('.') == 2 else '')):
    sys.exit('ERRO: config.json deve conter apenas a chave PUBLICÁVEL (sb_publishable_...) ou anon. Nunca a service_role/secret.')

css = (SRC / 'styles.css').read_text(encoding='utf-8')
lcss = (ROOT / 'vendor' / 'leaflet.css').read_text(encoding='utf-8')
lcss = re.sub(r'/\*.*?\*/', '', lcss, flags=re.S)
lcss = re.sub(r'\n\s*\n', '\n', lcss)
bm = (SRC / 'basemap.json').read_text(encoding='utf-8')
js = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in ORDER)

import base64
b64 = lambda f: 'data:image/png;base64,' + base64.b64encode((ROOT / 'icons' / f).read_bytes()).decode()
FAV32, FAV192 = b64('icon-32.png'), b64('icon-192.png')
# manifest do app instalável (PWA) com a versão nos ícones, para o celular trocar o ícone em cada versão
(ROOT / 'manifest.webmanifest').write_text(json.dumps({
    'id': './', 'name': 'GestaoVia', 'short_name': 'GestaoVia', 'description': 'Sistema de Controle de Frotas', 'lang': 'pt-BR',
    'start_url': './', 'scope': './', 'display': 'standalone', 'orientation': 'any', 'background_color': '#F4EFE4', 'theme_color': '#0AF797',
    'icons': [{'src': f'icons/icon-{n}.png?v={VERSION}', 'sizes': f'{n}x{n}', 'type': 'image/png', 'purpose': 'any'} for n in (192, 512)]
           + [{'src': f'icons/maskable-{n}.png?v={VERSION}', 'sizes': f'{n}x{n}', 'type': 'image/png', 'purpose': 'maskable'} for n in (192, 512)]
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
LOGO = 'data:image/png;base64,' + base64.b64encode((ROOT / 'icons' / 'icon-128.png').read_bytes()).decode()
SB = public['supabaseUrl'].rstrip('/')
CSP = ("default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; "
       "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; "
       f"img-src 'self' data: blob: https://tile.openstreetmap.org {SB}; "
       f"connect-src 'self' {SB} {SB.replace('https://', 'wss://')}; worker-src 'self'; manifest-src 'self'")
head = f'''<title>GestaoVia | Sistema de Controle de Frotas</title>
<meta name="description" content="GestaoVia: controle de frotas com posse por QR Code, checklists, mapa, manutenção e premiação.">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" type="image/png" sizes="32x32" href="{FAV32}"><link rel="icon" type="image/png" sizes="192x192" href="{FAV192}">
<link rel="apple-touch-icon" href="icons/icon-180.png?v={VERSION}"><link rel="manifest" href="manifest.webmanifest?v={VERSION}">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="GestaoVia">
''' + '''<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400..800&family=Geist+Mono:wght@500;700&display=swap">
<script>try{var t=localStorage.getItem('vialink-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script src="https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js"></script>
'''
body = (f'<style>\n{lcss}\n{css}\n</style>\n<div id="app"></div>\n'
        f'<script>window.VIALINK_CONFIG={json.dumps(public)};window.GV_LOGO="{LOGO}";window.BASEMAP={bm};</script>\n'
        f'<script>\n"use strict";\n{js}\n</script>\n'
        "<script>if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(function(){})</script>\n")
out = ROOT / 'dist'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="theme-color" content="#F4EFE4">\n<meta name="color-scheme" content="light dark">\n' + head + '</head>\n<body>\n' + body + '</body>\n</html>\n', encoding='utf-8')
# cópia na raiz: GitHub Pages (e a Hostinger) abrem o index.html da pasta principal
(ROOT / 'index.html').write_text((out / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
(ROOT / '.nojekyll').write_text('', encoding='utf-8')
print('index.html e dist/index.html', len(head + body), 'bytes')
