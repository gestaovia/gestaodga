/* ===================== Atualização automática do aplicativo (v1.17.0) =====================
   O app instalado no celular pode ficar dias aberto em segundo plano com a versão antiga na memória.
   A cada volta para a tela (e a cada 10 min) ele confere version.json no servidor; se houver versão nova:
   - sem formulário em andamento: envia o que falta e recarrega na hora;
   - com formulário em andamento: mostra a faixa "Nova versão" e recarrega assim que o formulário terminar. */
const UPD = { busy: false, newer: null, bar: false };
const verNum = v => String(v || '').split('.').map(n => parseInt(n, 10) || 0);
function verCmp(a, b) { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; }
const updBusy = () => FORM_DIRTY || !!DRAFT || !!$('#modal form');
async function updReload() {
  if (CLOUD.on) { try { await CLOUD.flush(); } catch (e) { } if (CLOUD.busy) return; }
  try { sessionStorage.setItem('gv-route', JSON.stringify(ROUTE)); } catch (e) { }
  location.reload();
}
function updBar(v) {
  if (UPD.bar) return; UPD.bar = true;
  const el = document.createElement('div'); el.id = 'upd-bar'; el.className = 'note warn'; el.setAttribute('role', 'status');
  el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:9999;max-width:min(560px,calc(100vw - 24px));box-shadow:0 6px 24px rgba(0,0,0,.18);align-items:center';
  el.innerHTML = `<div style="flex:1">Nova versão do GestaoVia (${esc(v)}). Conclua o que está fazendo: o aplicativo atualiza em seguida.</div><button type="button" class="btn sm" id="upd-now">Atualizar agora</button>`;
  document.body.appendChild(el);
  el.querySelector('#upd-now').addEventListener('click', () => { if (updBusy() && !confirm('Há um formulário em andamento. Atualizar agora e perder o que não foi concluído?')) return; FORM_DIRTY = false; DRAFT = null; updReload(); });
}
async function checkUpdate() {
  if (UPD.busy || !APP_VERSION || location.protocol === 'file:' || document.visibilityState === 'hidden') return;
  UPD.busy = true;
  try {
    if (!UPD.newer) {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = String((await r.json()).version || ''); if (v && verCmp(v, APP_VERSION) > 0) UPD.newer = v;
    }
    if (!UPD.newer) return;
    if (updBusy()) updBar(UPD.newer); else await updReload();
  } catch (e) { } finally { UPD.busy = false; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
window.addEventListener('online', () => checkUpdate());
setInterval(checkUpdate, 10 * MIN);
setTimeout(checkUpdate, 15000);
// formulário concluído ou abandonado (troca de tela): se já há versão nova, atualiza agora
const _goBeforeUpd = go;
go = function (page, p, opts) { _goBeforeUpd(page, p, opts); if (UPD.newer && !updBusy()) setTimeout(updReload, 400); };
