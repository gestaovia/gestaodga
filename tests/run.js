/* Testes automáticos do gestaovia (sem servidor: o app roda a partir de dist/index.html com dados de exemplo).
   Uso: node tests/run.js            (regras: premiação, horário, km, pedágios, fila do aparelho)
        UI=1 node tests/run.js       (+ telas: correção de km, fechamento de pedágios, diário do condutor)
   Requer o Playwright (npm i -g playwright) e o Chromium dele; CHROME=<caminho> usa outro Chromium. */
const path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const fs = require('fs');
const NOW = new Date('2026-10-20T12:00:00-03:00').getTime();
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext({ timezoneId: 'America/Sao_Paulo', viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message + ' @ ' + (e.stack||'').split('\n').slice(1,3).join(' | ')));
  await p.addInitScript(`{ const N = ${NOW}; const D = Date; Date.now = () => N; }`);
  await p.route(/^https?:/, r => r.abort());
  await p.goto('file://' + path.join(__dirname, '..', 'dist', 'index.html'));
  await p.addScriptTag({ content: fs.readFileSync(__dirname + '/fixture.js', 'utf8') });
  const res = [];
  const ok = (name, cond, extra) => res.push((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  for (const t of require('./cases.js')) {
    try { const r = await p.evaluate(t.fn); ok(t.name, r === true || r?.ok === true, r === true ? undefined : r); }
    catch (e) { ok(t.name, false, e.message.split('\n')[0]); }
  }
  if (process.env.UI) { await require('./ui.js')(p, ok); await require('./ui.js').diario(p, ok); await require('./ui.js').v113(p, ok, process.env.SHOTS); await require('./ui.js').v114(p, ok, process.env.SHOTS); }
  console.log(res.join('\n'));
  console.log('Erros de página:', errs.length ? errs.slice(0, 5) : 'nenhum');
  console.log(`${res.filter(x => x.startsWith('OK')).length}/${res.length} OK`);
  await b.close();
})();
