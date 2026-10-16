"""Gera os pacotes de uma versão do gestaovia.
Uso: python3 scripts/release.py <versao> <versao_anterior> <pasta_saida>
Ex.:  python3 scripts/release.py v1.2.0 v1.1.0 /tmp/versoes
Cria <pasta_saida>/<versao>/alteracoes e <pasta_saida>/<versao>/completo a partir do git
(a tag <versao> precisa existir) e os dois .zip correspondentes."""
import pathlib, shutil, subprocess, sys, zipfile

ver, prev, out = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
ROOT = pathlib.Path(__file__).resolve().parent.parent
git = lambda *a: subprocess.run(['git', '-C', str(ROOT), *a], capture_output=True, text=True, check=True).stdout
dest = out / ver
shutil.rmtree(dest, ignore_errors=True)
alt, comp = dest / 'alteracoes', dest / 'completo'

def export(path, base):
    data = subprocess.run(['git', '-C', str(ROOT), 'show', f'{ver}:{path}'], capture_output=True, check=True).stdout
    f = base / path; f.parent.mkdir(parents=True, exist_ok=True); f.write_bytes(data)

files = [f for f in git('ls-tree', '-r', '--name-only', ver).splitlines() if f]
for f in files: export(f, comp)

changed, removed = [], []
for line in git('diff', '--name-status', '--no-renames', prev, ver).splitlines():
    st, path = line.split('\t', 1)
    (removed if st == 'D' else changed).append((st, path))
for st, path in changed: export(path, alt)

notes = git('show', f'{ver}:CHANGELOG.md') if 'CHANGELOG.md' in files else ''
sec = notes.split(f'## {ver}', 1)[1].split('\n## ', 1)[0].strip() if f'## {ver}' in notes else ''
lab = {'A': 'novo', 'M': 'alterado'}
txt = [f'gestaovia {ver} — alterações em relação à {prev}', '',
       'Como aplicar no GitHub: envie os arquivos desta pasta mantendo as mesmas pastas (substituindo os que já existem)',
       'e apague do repositório os arquivos da lista "Apagar", se houver.', '',
       'Arquivos para enviar:'] + [f'  [{lab.get(st, st)}] {p}' for st, p in changed] + ['']
txt += ['Apagar do repositório:'] + ([f'  {p}' for _, p in removed] or ['  (nenhum)']) + ['']
if sec: txt += ['O que mudou:', sec, '']
(alt / 'LEIA-ME-ALTERACOES.txt').write_text('\n'.join(txt), encoding='utf-8')

for name, base in (('alteracoes', alt), ('completo', comp)):
    z = dest / f'gestaovia-{ver}-{name}.zip'
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(base.rglob('*')):
            if f.is_file(): zf.write(f, f.relative_to(base))
print(f'{ver}: {len(changed)} alterado(s)/novo(s), {len(removed)} apagado(s), {len(files)} no completo')
