# Histórico de versões do gestaovia

Cada versão tem duas pastas em `versoes/vX.Y.Z/`:
- **alteracoes/** — só os arquivos que mudaram desde a versão anterior (mesmos caminhos do repositório) + `LEIA-ME-ALTERACOES.txt` com a lista do que trocar e do que apagar.
- **completo/** — o sistema inteiro daquela versão.

Numeração: **X** muda o sistema por inteiro, **Y** traz funções novas, **Z** corrige algo sem mudar o uso.
Mudanças no banco (Supabase) ficam em `supabase/migrations/` e já são aplicadas por Claude no projeto; não precisam ser enviadas ao GitHub Pages para funcionar.

## v1.10.0 — 16/10/2026
- **Documento do veículo para o condutor:** novo botão **Documento do veículo** no início do condutor e na tela do veículo. Mostra o CRLV-e mais recente do veículo que está com ele (exercício, RENAVAM e situação do licenciamento) para apresentar à fiscalização: foto em tela cheia ou PDF aberto no leitor do celular, e **Salvar no celular** para mostrar mesmo sem internet. Se o veículo ainda não tem CRLV no sistema, o condutor toca em **Avisar a gestão** e a gestão recebe o aviso.
- O condutor vê só o CRLV atual do veículo que está com ele (até 2 h depois de entregar, como no seguro). IPVA, taxa de licenciamento e exercícios anteriores continuam só com a gestão. Cada abertura do documento fica registrada na linha do tempo do veículo.
- Aba **Documentos** do veículo (gestão) informa que o CRLV mais recente aparece para o condutor.
- **Ícone do aplicativo com a logo oficial:** todos os ícones refeitos a partir da logo em alta resolução (`logo_gestaovia.png`): app instalado no Android (normal e adaptável, com o G dentro da área segura), iPhone (fundo verde cheio), aba do navegador (`favicon.ico`) e a logo dentro do sistema. O app instalado troca o ícone sozinho no Android em alguns dias; no iPhone, remova o atalho da tela de início e adicione de novo.
- Novo `scripts/icones.py`: refaz todos os ícones a partir de uma logo PNG (`python3 scripts/icones.py logo_gestaovia.png` e depois `python3 build.py`).
- Banco: migration `20261016000012_gestaovia_documento_veiculo_condutor` (função `vehicle_document` e leitura do arquivo do CRLV pelo condutor no Storage).

## v1.9.1 — 15/10/2026
- **Correção na premiação (modalidade B, checklist diário):** o prazo passa a valer para quem estava com o veículo no horário do prazo (10h). Essa pessoa precisa de um checklist até o prazo (diário, recebimento ou entrega); entregar o veículo mais tarde **não tira mais** o desconto de atraso (−10) nem o de ausência (−15). Antes, qualquer entrega ou recebimento no mesmo dia, em qualquer horário, apagava o desconto.
- Continua igual: quem entrega antes do prazo fica liberado do diário naquele dia; quem recebe depois do prazo tem o recebimento valendo como checklist do dia.
- O extrato explica a ausência quando houve entrega depois do prazo ("a entrega às 17:00 não substitui o diário").
- Vale para o período em aberto (recalculado automaticamente); períodos já fechados não mudam.

## v1.9.0 — 15/10/2026
- **Checklist de recebimento completo, entrega com confirmação rápida:** todo condutor que recebe um veículo faz o checklist completo (itens + 5 fotos). Na entrega ou transferência, quem fez o recebimento completo só responde "Houve alguma alteração no veículo desde o seu recebimento?": **Não, sem alterações** pede só a quilometragem (foto do painel opcional); **Sim, houve** abre o checklist completo. Quem recebeu sem checklist completo (registros antigos) continua fazendo a entrega completa.
- **Recebimento confere o checklist anterior (auditoria):** a tela de recebimento mostra o último checklist completo do veículo (de quem, quando, km, combustível, apontamentos e avarias) e avisa quando o condutor anterior entregou com a confirmação rápida. O que o novo condutor marcar pior do que no checklist anterior (ex.: Lataria OK → Ruim) ou avaria nova fica registrado como **divergência**: aparece no checklist, no PDF, na lista de checklists ("Divergência") e a gestão recebe aviso.
- **Premiação (modalidade A):** a entrega com confirmação rápida não gera desconto quando o recebimento daquela posse teve checklist completo. O recebimento sem checklist completo continua com desconto.
- **Negar a entrega:** o condutor que está com o veículo pode negar a solicitação (antes ou depois de aceitar, enquanto não entregou), com motivo obrigatório. O veículo continua com ele; quem pediu e a gestão recebem o motivo, que aparece na transferência e no início do solicitante por 24 h. Nova situação "Entrega negada" e filtro "Negadas ou canceladas" em Transferências.
- **Cancelar a solicitação:** quem pediu o veículo cancela pelo início, pela tela do veículo ou pela transferência, com motivo opcional; o condutor atual é avisado.
- **Multas: apagar pelo gestor:** botão "Apagar multa" (motivo obrigatório). A multa sai das listas, custos, relatórios, indicadores e do histórico do condutor, mas fica em **Multas › Apagadas** com quem apagou, quando e o motivo. O número da notificação é liberado para um novo lançamento correto.
- **QR Code único:** o QR Code do veículo não é mais gerado de novo. O botão "Gerar novo" virou **Imprimir QR Code** (etiqueta com logo, placa, modelo e o código; imprimir ou baixar PDF). O banco recusa criar um segundo QR Code, trocar ou revogar o existente.
- Ajustes: a quilometragem mínima aceita nos checklists considera o hodômetro atual do veículo; textos dos avisos sem quebras estranhas no celular.
- Banco: migration `20261015000011_gestaovia_checklist_transferencia_multas_qr`.

## v1.8.0 — 14/10/2026
- **Indicadores mensais** (menu Visão geral › Indicadores; gestão e supervisor): mês com setas, filtros por obra, veículo e frota própria/locada, que valem para todos os gráficos.
  - Resumo: custo total (com variação contra o mês anterior; no mês atual, contra o mesmo período do mês anterior), custo médio por km, consumo médio e preventiva em dia.
  - Custos: custo por obra (combustível, manutenção, locação, multas, incidentes e outros), manutenção por veículo e custo por km [(combustível + manutenção) ÷ km], separando própria e locada.
  - Desempenho: ranking de km rodados com a utilização (dias úteis em posse ÷ dias úteis disponíveis, fora de manutenção) e destaque do veículo que mais rodou; consumo km/l por veículo com alerta de consumo alto.
  - Manutenção preventiva: % de tarefas que venceram no mês e foram feitas até o vencimento (data ou km, o que vier primeiro); tarefas que ainda não venceram não contam; lista de vencidas em aberto.
  - Multas e incidentes: quantidade e custo, por veículo ou por obra.
  - Evolução mensal do custo operacional (até 12 meses), por categoria.
  - Cada gráfico tem "Ver tabela" com os números e mostra aviso quando não há dados (nada é estimado). "Dados a completar" lista o que falta registrar (km, valor da locação, custo de incidentes, plano de manutenção).
- **Custo de incidentes:** campo opcional ao resolver um problema e botão "Informar custo" nos Indicadores (gestor e administrador).
- **Início do condutor sem topo:** a tela começa direto pela foto/iniciais e nome do condutor e pelo veículo; mantém o botão verde Checklist diário, os botões de ação e o Pendente em vermelho. Nas outras telas continua o topo com voltar.

## v1.7.0 — 14/10/2026
- **Painel do condutor mais simples (conforme a imagem de referência):** topo só com a logo do GestaoVia; placa em destaque e clicável (abre os dados do veículo, no lugar do botão "Meu veículo"); "Checklist hoje" **Pendente em vermelho**; botão verde principal **Checklist diário** (com o prazo do dia) para quem está com veículo — quem está sem veículo continua vendo **Escanear veículo**; abaixo: Entregar veículo, Trocar obra, Informar problema, Registrar abastecimento (opcional) e Meus checklists. Avisos, Meu perfil, modo claro/escuro e Sair foram para o rodapé do início; aviso novo aparece como faixa no topo.
- **Excluir veículo (somente o proprietário):** botão Excluir na tela do veículo, com confirmação digitando a placa e a lista do que será apagado (posses, checklists, abastecimentos, QR Code, manutenção e localização daquele veículo). Outros veículos e condutores não são alterados; pedágios e multas pela placa continuam. A permissão é conferida no banco (função `delete_vehicle` e regra de exclusão da tabela de veículos só para o proprietário).
- **Abastecimento lançado pela gestão:** administrador, gestor de frota e supervisor (assistente administrativo) lançam o abastecimento de qualquer veículo em Abastecimentos › Lançar abastecimento (ou na aba Abastecimentos do veículo), com data e hora passadas, condutor e obra preenchidos pela posse daquele horário, fotos opcionais. O banco grava quem lançou e a origem (gestão ou condutor), e a lista mostra a coluna "Lançado por".
- **Abastecimento do condutor opcional:** continua disponível, não bloqueia nada e lançamentos da gestão não geram desconto na premiação do condutor.
- **Sem duplicidade:** mesmo veículo, quilometragem e litros iguais nas 24 h próximas são recusados (no aplicativo e no banco); registro parecido pede confirmação "É outro abastecimento". Gestor/administrador pode excluir um lançamento duplicado.
- Banco: migration `20261014000010_gestaovia_abastecimento_gestao_exclusao_veiculo` (a função de exclusão está também em `supabase/EXECUTAR-NO-SQL-EDITOR-v1.7.0.sql`).

## v1.6.0 — 10/10/2026
- **Formulários protegidos:** as janelas não fecham mais ao clicar fora (a janela balança); só saem por Cancelar, pelo X ou concluindo a ação. Nas telas com formulário (checklists, abastecimento, problema, perfil, configurações etc.), depois de começar a preencher, sair pelo menu, pelo voltar, por outra tela, pelo botão Sair ou recarregando a página pede confirmação ("Sair sem concluir?"). A atualização automática e a troca de tema não apagam mais o que foi digitado.
- **Cores do status do veículo:** amarelo = disponível, verde = com condutor (em uso, em deslocamento, aguardando transferência), vermelho = com problema (bloqueado ou com pendência). Em manutenção continua sem cor. Vale no mapa, na legenda, no painel, nos cartões, no app do condutor e nos filtros; novo filtro "Com problema" em Veículos.
- **Consultar por data** (Veículos e Condutores): escolha um dia ou um período (atalhos Hoje, Ontem, 7 dias) e veja quem estava com qual veículo, em qual obra, de que horas a que horas, quantos checklists e abastecimentos, e quais veículos ou condutores ficaram sem uso. Busca por placa, modelo ou nome.
- **Ícone do aplicativo com a logo do GestaoVia:** ícones novos gerados a partir da logo (sem a moldura clara), ícone do iPhone em quadrado cheio (`icons/apple-touch-icon.png`) e ícones do Android dentro da área segura. No celular, remova o atalho antigo da tela de início e adicione de novo para trocar o ícone.
- **Celular:** a logo do GestaoVia e a da empresa não se sobrepõem mais no topo do condutor (a empresa fica na linha de baixo, com logo pequena e nome). A janela "Minha pontuação" (e qualquer janela longa) agora tem fundo até o fim do conteúdo, sem mostrar a tela de trás.

## v1.5.0 — 09/10/2026
- **Premiação conforme o Regulamento do Programa de Pontuação e Bonificação (versão 00):** período de apuração do dia 26 ao dia 25; modalidades A (checklist de entrega e recebimento, 50 pts, −50 por transferência sem checklist completo), B (checklist diário, 30 pts, −10 atraso depois das 10h, −15 ausência) e C (abastecimento com foto do hodômetro, 20 pts, −10); descontos limitados aos pontos da modalidade; −10 por modalidade zerada; mínimo 0. Premiação = (R$ 300 × pontuação ÷ 100 + adicional R$ 100/R$ 50) × dias com posse ÷ dias úteis; adicional só com 15 dias ou mais de posse. Dias úteis sem fins de semana e feriados (nacionais automáticos + feriados cadastrados). Horário do checklist e do abastecimento gravado pelo servidor.
- Extrato do condutor com cada desconto, evidência, cálculo da pontuação e da premiação; extratos fechados liberados ao condutor 3 dias após o fim do período. Ranking com empate na mesma posição.
- Gestão: abonos (motivos do item 8), ocorrências lançadas pela gestão (ex.: abastecimento sem registro no extrato do cartão) e ajustes manuais, sempre com justificativa, nome, data e hora; nada é apagado (correção cancela o registro e o original fica visível).
- Parâmetros do item 11 com vigência: uma alteração só vale a partir do período seguinte, com histórico de versões. Fechamento automático no dia da divulgação (dia 28). PDF e Excel do fechamento com A, B, C, dias com posse e fator.
- Abastecimento: foto do hodômetro obrigatória (além do cupom).
- **Oficinas credenciadas** (menu Controle › Oficinas): cadastro com CNPJ, contato, endereço e serviços. Entrada em manutenção, saída, manutenção direta de veículo bloqueado e registro de serviço feito só com oficina credenciada (o banco também recusa).
- **Manutenção: editar e excluir** serviços realizados (data, km, serviços, custo, oficina, observações) e editar ou excluir a entrada em manutenção em andamento; o plano de manutenção acompanha; o histórico guarda o antes e depois.
- **Seguro e contato de emergência** por veículo (seguradora, apólice, vigência, assistência 24h, sinistro, corretor, franquia, contato de emergência e orientações). Vencimento do seguro entra nos alertas e no calendário.
- **Acionar seguro:** botão em destaque quando há problema crítico ou veículo parado (início do condutor, tela do veículo); ao informar um problema crítico o condutor vai direto para a tela de acionamento, com ligação para assistência 24h, sinistro e contato de emergência e cópia dos dados com o local. Cada acionamento avisa a gestão e fica no histórico.
- **Logo do GestaoVia dentro do sistema:** sempre no menu, no topo do celular e no início do condutor (antes a logo da empresa substituía a do aplicativo); a empresa aparece logo abaixo. Logo também nos PDFs.
- O prazo do checklist diário passou a ser parâmetro da premiação (Premiação › Parâmetros).
- Banco: migration `20261009000009_gestaovia_oficinas_seguro_premiacao`.

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
