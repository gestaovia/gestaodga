# gestaovia

Gestão visual de frota: posse do veículo por QR Code, checklists com fotos, mapa da frota, calendário de manutenção, CRLV/IPVA, pedágios, multas, premiação de condutores e localização dos veículos pelo GPS do celular do condutor (sem rastreador nem serviço externo).

- **Front-end:** arquivo único `dist/index.html` (HTML + JS, sem build de framework). Fontes em `src/`.
- **Banco, login e arquivos:** Supabase (PostgreSQL com RLS, Auth, Storage e Edge Functions).
- **Hospedagem:** por enquanto o código fica no GitHub; na publicação, basta enviar `dist/index.html` para a Hostinger.

## Estrutura

```
src/                     código do aplicativo (JS e CSS)
vendor/leaflet.css       estilo do mapa
config.json              endereço do Supabase + chave PUBLICÁVEL (pública por definição)
build.py                 gera index.html e dist/index.html
VERSION / CHANGELOG.md   número da versão atual e histórico de versões
scripts/release.py       gera as pastas de uma versão (alteracoes e completo)
index.html               aplicativo pronto para publicar
icons/ favicon.ico       logo do GestaoVia (navegador e app instalado)
manifest.webmanifest     dados do app instalável (PWA)
sw.js                    service worker do PWA (abre a última versão sem internet) (cópia de dist/index.html, usada pelo GitHub Pages)
dist/index.html          aplicativo pronto para publicar
supabase/migrations/     tabelas, RLS, funções, bucket de arquivos e proprietário (todas aplicadas no projeto)
supabase/functions/      admin-users (roda no servidor)
```

## Segurança

| O quê | Onde fica | No navegador? |
|---|---|---|
| Endereço do projeto e chave publicável (`sb_publishable_…`) | `config.json` | Sim (é pública; o acesso é decidido pelo RLS) |
| Chave de serviço (`service_role` / `sb_secret_…`) | Variável automática das Edge Functions | **Nunca** |
| Senhas | Supabase Auth | Nunca armazenadas pelo app |

O `build.py` recusa gerar o site se `config.json` tiver qualquer chave que não seja a publicável/anon.

### Perfis e RLS

| Perfil | Pode |
|---|---|
| Administrador | Tudo, inclusive usuários, regras e integrações |
| Gestor de frota | Toda a operação: cadastros, transferência forçada, pedágios, multas, manutenção, premiação; cria acesso de **condutores** |
| Supervisor | Lê tudo; não altera cadastros nem movimentações |
| Condutor | Só o que é dele: a própria posse, checklists, abastecimentos, transferências e alertas; atualiza apenas a quilometragem do veículo que está com ele; não vê CNH/telefone de colegas |

- Todas as tabelas têm RLS. Visitante sem login não lê nada. Perfil inativo não lê nada.
- Gravações passam pela função `sync_apply`, que roda com o login de quem chamou (`SECURITY INVOKER`), então as políticas valem sempre; tudo de uma movimentação entra numa única transação.
- Gatilhos impedem o condutor de mudar placa/cadastro do veículo, diminuir quilometragem, reabrir posse ou forçar transferência.
- A restrição `custody_no_overlap` garante no banco que um veículo nunca tem dois condutores ao mesmo tempo.
- Fotos e documentos ficam no bucket privado `vialink-arquivos`; o app usa links assinados que expiram em 1 hora. O condutor só lê os arquivos que ele mesmo enviou.

## Proprietário e primeiro acesso

- O sistema já tem o **proprietário** criado: `mauriciosantos@dgaautomacao.com.br` (perfil Administrador, marcado como Proprietário).
- No primeiro login com a senha provisória, o sistema pede uma senha pessoal.
- O proprietário não pode ser inativado, rebaixado nem ter a senha redefinida por outro usuário (regra no banco e na função `admin-users`).
- Ordem sugerida para começar: **Configurações › Obras e centros de custo** (centros de custo e obras) → **Veículos** (cada veículo gera o QR Code) → **Condutores** (o acesso ao aplicativo é criado junto) → **Configurações › Usuários e perfis** (gestores e supervisores).
- Senha esquecida: "Esqueci minha senha" na tela de entrada (depende do SMTP configurado no Supabase) ou "Nova senha" na tela de Usuários.

## Localização dos veículos (sem Traccar)

- Enquanto o condutor está com um veículo e o gestaovia aberto no celular, o navegador envia a posição a cada intervalo (padrão 2 min) ou ao andar ~300 m.
- O painel mostra a última posição de cada veículo; a tela do veículo desenha o trajeto do dia.
- Velocidade medida pelo GPS acima do limite gera alerta para a gestão e conta na premiação (no máximo 1 alerta a cada 10 min por veículo).
- Configuração em **Configurações › Localização** (ligar/desligar, intervalo, velocidade máxima).
- Limite da web: com a tela bloqueada ou o app fechado o navegador para de enviar.

## Ajustes recomendados no painel do Supabase

- **Authentication › Sign In / Providers:** desligar *Allow new users to sign up* (os usuários são criados pela tela de Usuários; cadastro espontâneo já nasce sem acesso).
- **Authentication › URL Configuration:** *Site URL* = endereço publicado (ex.: `https://frota.suaempresa.com.br`) e o mesmo em *Redirect URLs*.
- **Authentication › SMTP:** configurar o e-mail da empresa. O e-mail padrão do Supabase só envia para membros da organização e tem limite baixo (recuperação de senha depende disso).
- **Edge Functions › Secrets (opcional):** `ALLOWED_ORIGIN=https://frota.suaempresa.com.br` para restringir quem chama as funções pelo navegador.

## Desenvolvimento

```bash
python3 build.py          # gera dist/index.html
```

Para aplicar as migrations em outro projeto: `supabase link --project-ref <ref>` e `supabase db push`; função: `supabase functions deploy admin-users`.

## Publicação no GitHub Pages

Suba o repositório inteiro (com o `index.html` na raiz). Em *Settings › Pages*, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`. Depois coloque o endereço do Pages (ex.: `https://usuario.github.io/gestaovia/`) em *Site URL* e *Redirect URLs* no Supabase.

## Publicação na Hostinger

Envie `dist/index.html` para a pasta `public_html` (ou subpasta). Ative HTTPS no domínio. Depois ajuste a *Site URL* do Supabase para o endereço final.

## Visual

- Tema neutro (bege e grafite) com **modo claro e escuro**: botão sol/lua no topo; a escolha fica salva no aparelho e, sem escolha, segue o sistema.
- Cor só onde ajuda a decidir: **verde** para confirmar/salvar, **vermelho** para excluir/inativar e escalas de urgência apenas no **calendário** e nos itens que pedem intervenção imediata (lista de atenção, vencimentos, plano de manutenção).
- Bordas pouco arredondadas (4–6 px). Fontes: Inter, JetBrains Mono (placas) e Playfair Display (marca).
- Responsivo de 320 px em diante: campos sem zoom no iPhone, janelas em tela cheia no celular, alvos de toque maiores e áreas seguras (notch).

## Créditos

- Ícones: [Lucide](https://lucide.dev) (licença ISC). Fontes: Geist e Geist Mono (SIL Open Font License). Mapa: © OpenStreetMap. Planilhas: SheetJS (Apache 2.0). PDF: jsPDF e jsPDF-AutoTable (MIT).
