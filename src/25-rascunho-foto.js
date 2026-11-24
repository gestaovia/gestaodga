/* ===================== Checklist não se perde ao tirar foto (v1.20.1) =====================
   Relato (24/11/2026): em alguns celulares, ao tirar a foto do veículo no checklist e tocar em "Salvar"/OK
   na câmera, o app travava e voltava para o início, perdendo tudo o que tinha sido preenchido.
   Causa: o botão de foto abre o aplicativo da câmera do celular. Com pouca memória livre, o Android encerra
   o navegador (ou o app instalado) enquanto a câmera está aberta, ou ao ler a foto em alta resolução.
   Ao voltar, a página abre do zero; o checklist em andamento (DRAFT) existia só na memória e era perdido.
   Correção:
   1) o checklist em andamento é guardado no aparelho (IndexedDB, por usuário) a cada alteração, ao tocar
      no botão de foto e quando o app sai da tela; ao reabrir (até 12 h), o app volta para a mesma tela com
      o que foi preenchido e as fotos já tiradas; sai do aparelho ao concluir ou cancelar;
   2) a foto é lida sem a cópia base64 do arquivo original (readPhoto em 03-shell.js), bem mais leve;
   3) enquanto a foto é preparada, o botão de concluir espera (antes enviava sem a foto). */
const DRAFT_KEEP = 12 * 36e5;
let PHOTO_BUSY = 0;
const DRAFT_STORE = {
  t: null, has: false, // has: há rascunho guardado no aparelho (evita apagar a cada troca de tela)
  key() { return CUR?.id ? 'rascunho:' + CUR.id : null; },
  snapshot() {
    if (!DRAFT || !CUR?.id || !ROUTE?.page || ROUTE.page === 'login' || ROUTE.page === 'senha') return null;
    // funções (_onChange, _onPhoto) não vão; a conferência do checklist anterior é recarregada do servidor
    let draft; try { draft = JSON.parse(JSON.stringify(DRAFT, (k, v) => k === 'ref' || k === 'refLoading' ? undefined : v)); } catch (e) { return null; }
    return { at: Date.now(), uid: CUR.id, route: { page: ROUTE.page, p: ROUTE.p || {} }, draft };
  },
  async saveNow() {
    clearTimeout(this.t); this.t = null;
    const k = this.key(); const s = this.snapshot(); if (!k || !s) return;
    this.has = true; try { await PENDING.put(k, s); } catch (e) { }
  },
  save() { clearTimeout(this.t); this.t = setTimeout(() => this.saveNow(), 400); },
  clear() { clearTimeout(this.t); this.t = null; if (!this.has) return; this.has = false; const k = this.key(); if (k) PENDING.del(k); },
  // rascunho válido do usuário que entrou (ou null, apagando o que não serve mais)
  async take() {
    const k = this.key(); if (!k) return null;
    const s = await PENDING.get(k); if (!s) return null;
    const ok = s.uid === CUR.id && s.draft && s.route?.page && PAGES[s.route.page] && !['login', 'senha'].includes(s.route.page) && Date.now() - (s.at || 0) <= DRAFT_KEEP;
    if (!ok) { await PENDING.del(k); return null; }
    this.has = true; return s;
  },
  resume(s) {
    DRAFT = s.draft;
    go(s.route.page, s.route.p || {}, { keepDraft: true, noPush: true });
    if (!DRAFT || !$('#app form')) return;
    FORM_DIRTY = true;
    const n = Object.values(DRAFT.photos || {}).filter(Boolean).length;
    toast(`O aplicativo foi fechado pelo celular, mas o que você preencheu foi recuperado${n ? ` (${n} foto${n > 1 ? 's' : ''})` : ''}. Confira e, se a última foto não aparecer, tire-a de novo.`);
  }
};
// antes de abrir a câmera/galeria: guarda já (o celular pode fechar o app enquanto a câmera está aberta)
document.addEventListener('click', e => { if (DRAFT && e.target?.matches?.('input[type="file"][data-photo]')) DRAFT_STORE.saveNow(); }, true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && DRAFT) DRAFT_STORE.saveNow(); });
window.addEventListener('pagehide', () => { if (DRAFT) DRAFT_STORE.saveNow(); });
// concluir enquanto a foto ainda está sendo preparada: espera
document.addEventListener('submit', e => {
  if (!PHOTO_BUSY || !e.target?.closest?.('#app')) return;
  e.preventDefault(); e.stopImmediatePropagation();
  toast('Aguarde um instante: a foto ainda está sendo preparada.');
}, true);
