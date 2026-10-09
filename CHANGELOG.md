# Histórico de versões do gestaovia

Cada versão tem duas pastas em `versoes/vX.Y.Z/`:
- **alteracoes/** — só os arquivos que mudaram desde a versão anterior (mesmos caminhos do repositório) + `LEIA-ME-ALTERACOES.txt` com a lista do que trocar e do que apagar.
- **completo/** — o sistema inteiro daquela versão.

Numeração: **X** muda o sistema por inteiro, **Y** traz funções novas, **Z** corrige algo sem mudar o uso.
Mudanças no banco (Supabase) ficam em `supabase/migrations/` e já são aplicadas por Claude no projeto; não precisam ser enviadas ao GitHub Pages para funcionar.

## v1.4.0 — 09/10/2026
- Ícone (favicon) agora vai dentro da própria página, então aparece mesmo se o navegador guardou o antigo; manifest do app instalado com versão nos ícones para o celular atualizar.
- Centro de custo removido: o número da obra é o centro de custo (cadastro, recebimento, troca de obra, pedágios, PDF).
- Aba "Banco de dados" removida das Configurações.
- Fonte Geist (e Geist Mono nas placas); novo pacote de ícones (Lucide), com ícone de carro novo.
- Relatórios mensais por veículo, condutor e obra, em PDF e Excel, e "Excel completo do mês" com todas as abas.
- Fechamento da premiação para o RH: o mês fechado guarda pontuação e prêmio de cada condutor; PDF com campos de assinatura e Excel com a nota de cada critério. Fechamento manual ou automático no dia configurado (Premiação › Métricas). Só o administrador reabre.
- Correção: condutor sem posse de veículo no mês não recebe prêmio (antes aparecia com 100 pontos e prêmio).
- Banco: migration `20261009000008_gestaovia_fechamento_premiacao`.

## v1.3.0 — 09/10/2026
- Marca GestaoVia: logo no ícone do navegador (favicon), no app instalado (PWA "GestaoVia") e no menu; título "GestaoVia | Sistema de Controle de Frotas".
- Tela de entrada simples: só a logo, e-mail, senha e "Esqueci minha senha".
- Ao recarregar a página não aparece mais a tela de entrada por um instante (mostra a logo enquanto confere a sessão) e o sistema volta para a mesma tela.
- Configurações › Organização: razão social, nome personalizado, CNPJ (com validação) e logo da empresa (menu, app do condutor e PDF do checklist).
- Meu perfil (todos os usuários, inclusive no celular): nome, foto e senha. A foto aparece no lugar das iniciais do condutor nas telas da gestão.
- Condutor: "Meus checklists" com o histórico de todas as posses, fotos e PDF.
- Veículo bloqueado por problema crítico: gestor/administrador envia direto para manutenção, sem checklist; a posse do condutor é encerrada e ele é avisado. Na saída da manutenção o problema é dado como resolvido.
- Segurança: condutor não lê mais locação, documentos e custos dos veículos; checklists gravados só podem ser alterados pela gestão; abastecimento só no veículo que está com o condutor; condutor só envia aviso à gestão ou a quem está na mesma transferência; proteção contra conteúdo malicioso em links e fotos; política de segurança de conteúdo (CSP) na página; funções antigas do Traccar desativadas no servidor.
- Banco: migration `20261009000007_gestaovia_perfil_seguranca`.

## v1.2.0 — 09/10/2026
- Mapa: ruas do OpenStreetMap (gratuito, sem chave de acesso) no lugar do CARTO, que passou a exigir chave. Modo escuro com as ruas escurecidas. Zoom liberado até o Brasil inteiro.
- Controle de versões: número da versão aparece no menu lateral e na tela de entrada; arquivos `VERSION` e `CHANGELOG.md`.

## v1.1.0 — 09/10/2026
- Localização pelo GPS do celular do condutor (sem Traccar): posição a cada intervalo ou ~300 m, trajeto do dia, alerta de velocidade e Configurações › Localização.
- Traccar removido do sistema; campo "Rastreador" saiu do cadastro do veículo.
- Banco: migration `20261009000006_gestaovia_gps_celular`.

## v1.0.0 — 09/10/2026
- Primeira versão de produção: login pelo Supabase, proprietário protegido, cadastro de centros de custo e obras, sem dados de exemplo.
- `index.html` na raiz para o GitHub Pages.
- Banco: migration `20261009000005_gestaovia_proprietario`.
