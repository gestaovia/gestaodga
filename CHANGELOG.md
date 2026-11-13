# Histórico de versões do gestaovia

Cada versão tem duas pastas em `versoes/vX.Y.Z/`:
- **alteracoes/** — só os arquivos que mudaram desde a versão anterior (mesmos caminhos do repositório) + `LEIA-ME-ALTERACOES.txt` com a lista do que trocar e do que apagar.
- **completo/** — o sistema inteiro daquela versão.

Numeração: **X** muda o sistema por inteiro, **Y** traz funções novas, **Z** corrige algo sem mudar o uso.
Mudanças no banco (Supabase) ficam em `supabase/migrations/` e já são aplicadas por Claude no projeto; não precisam ser enviadas ao GitHub Pages para funcionar.

## v1.19.0 — 13/11/2026
- **Lavagem dos veículos.** Nova tela **Controle › Lavagens** (e aba **Lavagem** na tela do veículo). A gestão registra só **placa, dia, km e valor** — sem checklist. A lavagem pode ser editada ou excluída (com motivo); tudo fica na linha do tempo do veículo.
  - **Lembrete para levar ao lavador:**
    - pelo prazo: a cada **30 dias** depois da última lavagem, com aviso **5 dias antes** (os dois ajustáveis em **Configurações › Regras**);
    - pelo checklist: quando um checklist completo (recebimento, entrega, devolução, entrada/saída de manutenção) marca **Limpeza = Ruim** depois da última lavagem. A gestão recebe a notificação na hora.
  - O lembrete aparece em **Atenção** no painel, em **Próximos 30 dias**, no **Calendário**, no cartão do veículo e na tela Lavagens (filtro **Levar ao lavador**). Quando o prazo vence, a gestão recebe uma notificação (uma por prazo). Uma nova lavagem apaga o lembrete. Veículo na oficina ou inativo não gera lembrete; veículo sem nenhuma lavagem lançada só entra no lembrete pela limpeza ruim no checklist.
  - O valor das lavagens entra nos custos: coluna **Lavagem** nos relatórios por veículo e por obra, total da frota no painel e em Indicadores (categoria Outros).
- **Placas na cor Mercosul:** faixa azul no topo de todas as placas (na tela do veículo, com "BRASIL") e na etiqueta do QR Code.
- **Cartão "Disponíveis" mostrava 1 a mais.** O cartão contava também veículos inativos (ex.: devolvido à locadora), que não aparecem na lista. Agora todos os números do painel (Veículos, Em uso, Disponíveis, Manutenção, Locações) contam só a frota ativa, e veículo inativo não gera mais avisos em Atenção.
- **Painel da frota:** em *Status dos veículos*, os **disponíveis aparecem primeiro**.
- Testes: 124 casos (`UI=1 node tests/run.js`).
- Banco: sem migration (as lavagens ficam no próprio cadastro do veículo). Compatível com a v1.18.0.

## v1.18.0 — 10/11/2026
- **Administrador cancela transferência já entregue.** Quando o condutor anterior já entregou o veículo (*Aguardando recebimento* ou *Checklist de recebimento em andamento*) e o novo condutor desiste de receber ou o veículo fica parado, o administrador pode cancelar a transferência — pelo botão **Cancelar** na lista de **Transferências** ou por **Cancelar transferência** na tela da transferência. Motivo obrigatório. Ele escolhe o destino do veículo:
  - **Devolver ao condutor anterior:** a mesma posse é reaberta, como se a entrega não tivesse acontecido (não disponível se ele estiver inativo, já estiver com outro veículo, se o veículo estiver em manutenção ou se for transferência forçada — esta continua com "Cancelar transferência forçada");
  - **Deixar no pátio, sem condutor:** qualquer condutor pode receber depois, com o checklist completo.
  Os dois condutores são avisados; o motivo fica na transferência e na linha do tempo do veículo. Somente o perfil Administrador (antes da entrega, a gestão continua cancelando a solicitação como já fazia).
- **Serviços realizados no topo** da tela Manutenção (e da aba Manutenção do veículo), com o botão **Lançar manutenção realizada**.
- **Checklist de recebimento: km começa vazio.** O condutor confere o hodômetro e digita (antes vinha preenchido com o último km), como no checklist diário.
- Testes: 110 casos (`UI=1 node tests/run.js`).
- Banco: sem migration (a gestão já podia alterar transferências e posses no servidor). Compatível com a v1.17.0.

## v1.17.0 — 10/11/2026
- **Checklist diário sem foto: correção.** A regra da v1.16.0 (km digitado e foto do hodômetro obrigatórios) estava certa no sistema publicado, mas o aplicativo instalado no celular podia continuar aberto em segundo plano com a versão antiga na memória — e o banco aceitava o diário sem foto. Agora:
  - **O banco recusa** checklist diário sem quilometragem ou sem a foto do painel (migration `20261110000015_gestaovia_diario_foto_obrigatoria`, também em `supabase/EXECUTAR-NO-SQL-EDITOR-v1.17.0.sql`). Quem ainda estiver com a versão antiga recebe "Não foi possível salvar: … Feche e abra o aplicativo para atualizar".
  - **O aplicativo se atualiza sozinho:** ao voltar para a tela (e a cada 10 min) ele confere a versão publicada (`version.json`). Sem formulário em andamento, envia o que falta e recarrega; com formulário em andamento, mostra a faixa "Nova versão" e atualiza assim que o formulário termina. O service worker passa a buscar a página sempre direto da rede.
- **Km contratado nos veículos locados.** No cadastro do veículo locado: **Km contratado**, **Km contratado vale** (*por mês* — franquia mensal, contada a partir do dia da retirada — ou *no contrato todo*) e **Km na retirada** (opcional). Também dá para trocar o km contratado na **Renovação**.
  - Tela do veículo: barra com o km usado no mês (ou no contrato), quanto falta e a projeção no ritmo atual.
  - Aviso em **Atenção necessária** (painel), no cartão do veículo e na tela dele: *atenção* a partir de 80% do contratado ou quando o ritmo atual vai passar do contratado até o fim do ciclo; *urgente* a partir de 90%; *excedido* acima de 100%. Percentuais em Configurações › Regras.
  - O km usado é o km atual do veículo menos o último km registrado (checklists, abastecimentos e posses) até o início do ciclo.
- Testes: 102 casos (`UI=1 node tests/run.js`).
- Banco: migration `20261110000015_gestaovia_diario_foto_obrigatoria` (gatilho em `checklists`). Campos novos da locação ficam em `rental` (sem migration). Compatível com a v1.16.0.

## v1.16.0 — 09/11/2026
- **Checklist diário: foto do hodômetro obrigatória e km sem sugestão.** O campo de quilometragem começa vazio (antes vinha preenchido com o último km e o condutor confirmava sem conferir) e o diário só é concluído com o km digitado **e** a foto do painel com o hodômetro. Vale para os diários feitos a partir de hoje; os anteriores não mudam.
- **Abastecimento: limite por registro de 60 litros e R$ 500,00** (condutor e gestão). Acima disso o registro é recusado com "Confira os litros informados" / "Confira o valor total informado", sem mostrar o limite na tela.
- **Lançar manutenção realizada:** novo botão em **Manutenção › Serviços realizados** e na aba **Manutenção** do veículo para registrar serviços já feitos sem passar o veículo pela oficina: placa, data, oficina credenciada, km e serviços (custo e observações opcionais). O plano de manutenção avança quando o lançamento é o mais recente do item (lançamento mais antigo que o último registrado não volta o plano). O km não pode passar do km atual do veículo. Edição e exclusão como nos outros serviços.
- Testes: 96 casos (`UI=1 node tests/run.js`).
- Banco: sem migration. Compatível com a v1.15.0.

## v1.15.0 — 09/11/2026
- **Premiação: dia não útil considerado soma só nos dias com posse.** Quando a gestão considera um checklist feito em sábado, domingo ou feriado, o dia entra só nos **dias com posse** do condutor; os **dias úteis do período não mudam** (ex.: 18/20 + 1 = 19/20). Antes, o dia somava também nos dias úteis (18/20 + 1 = 19/21) e aumentava a quantidade de dias para a premiação completa.
  - O fator de participação fica limitado a 100% (no máximo 20/20): quem já tem todos os dias úteis contados não ganha além disso. A simulação de "Considerar" avisa quando o dia não muda a premiação.
  - Vale já para o período em aberto (26/10 a 25/11); períodos fechados não mudam.
- **Envio para manutenção sem checklist:** o botão **Enviar p/ manutenção** (tela do veículo) passa a ser só um registro, para qualquer veículo: oficina credenciada, motivo e quilometragem. O checklist completo continua na **saída** da manutenção.
  - Veículo com condutor: a posse é encerrada na hora, sem checklist de entrega e sem desconto na premiação, e o condutor é avisado (como já era para veículo bloqueado). Transferência em andamento do veículo é cancelada e o novo condutor é avisado.
  - Os indicadores de utilização continuam contando os dias na oficina (a saída guarda a data de entrada).
- **Cancelar transferência forçada (ação administrativa):** gestor de frota e administrador desfazem uma transferência forçada enquanto ninguém recebeu o veículo depois dela. Botão **Cancelar transf. forçada** na tela do veículo, na tela da transferência e na janela **Transferências › Transferência forçada** (lista das que podem ser canceladas).
  - A posse do condutor anterior é **reaberta** (continua a mesma posse, como se não tivesse sido encerrada); a liberação para o novo condutor é cancelada; o desconto de −50 pts (se marcado) é cancelado. Motivo obrigatório; vai para a linha do tempo, para a transferência e os dois condutores são avisados.
  - Não é possível cancelar depois que o novo condutor recebeu, com o veículo em manutenção, com o condutor anterior inativo ou já com outro veículo, nem quando o desconto caiu em período da premiação já fechado (o administrador reabre antes).
- Testes: 91 casos (`UI=1 node tests/run.js`).
- Banco: sem migration nesta versão (campos novos ficam em `extra`). Compatível com a v1.14.0.

## v1.14.0 — 20/10/2026
- **Frota comercial e motorista administrativo.** Novo **Tipo de motorista** no cadastro do condutor: *Motorista de obra* (padrão) ou *Motorista administrativo (comercial)*; o condutor é avisado quando a gestão muda o tipo.
  - Motorista administrativo: **não participa da premiação** (fora do ranking, do fechamento, da fila de dias não úteis e de ocorrências/abonos; o extrato mostra o aviso) e o **checklist diário é opcional** ("Opcional" em vez de "Pendente", sem item na lista de atenção). Recebimento e entrega continuam obrigatórios; no início dele, a ação principal com veículo é a entrega.
  - Obra reservada **COMERCIAL**: vem marcada para o motorista administrativo (ele pode escolher uma obra); não pode ser excluída nem desativada; não aparece para o motorista de obra; vira uma linha própria em custos, pedágios, multas e indicadores.
  - **Uso do veículo** no cadastro: *Frota de obra* ou *Frota comercial* (só classificação; qualquer condutor recebe qualquer veículo). Filtros em Veículos e Indicadores.
  - Finalidades novas: "Atividade comercial" e "Visita a cliente".
- Banco: migration `20261020013958_gestaovia_frota_comercial` (`drivers.kind`, `vehicles.fleet`, obra COMERCIAL protegida por gatilho).

## v1.13.0 — 20/10/2026
- **Premiação: checklist em fim de semana ou feriado avaliado pela gestão.** Todo checklist diário feito em sábado, domingo ou feriado por quem estava com o veículo entra sozinho na nova aba **Premiação › Dias não úteis** (o condutor não precisa pedir). A gestão recebe um aviso na hora e o ranking mostra quantos estão aguardando.
  - Para cada dia aparecem condutor, dia (ou nome do feriado), veículo, obra, horário do checklist (abre o checklist) e horas de posse no dia.
  - **Considerar** (verde): o dia entra como um dia útil a mais para aquele condutor, somando nos dias com posse **e** nos dias úteis dele (ex.: 18/20 + 1 = 19/21). Antes de confirmar, a tela mostra como ficam o fator e o prêmio. Observação opcional.
  - **Não considerar** (vermelho): o dia não muda a premiação; motivo obrigatório.
  - O condutor recebe aviso da decisão. A decisão vai para o histórico e para "Registros da gestão" no extrato; **Desfazer** (com motivo) devolve o dia para a fila. Período fechado não aceita decisões.
  - O extrato do condutor mostra os dias não úteis considerados e os que aguardam avaliação; o fechamento guarda os dias considerados.
  - Sem decisão, nada muda: fim de semana e feriado continuam sem desconto e sem contar dia.
- **Fotos com setas:** ao abrir uma foto (checklists, abastecimentos), setas **‹ ›** passam para a foto anterior/seguinte do mesmo registro, com contador ("2 de 5"), miniaturas para pular direto, teclas ← → no computador e deslizar o dedo no celular. A foto abre por cima do checklist: ao fechar (× ou Esc), o checklist continua aberto.
- Testes: 63 casos (`UI=1 node tests/run.js`).
- Banco: migration `20261020000014_gestaovia_premiacao_dias_nao_uteis` (novos tipos `diaextra`/`diarecusa` em `bonus_adjustments`). Compatível com a v1.12.0.

## v1.12.0 — 17/10/2026
- **Premiação: o checklist diário vale por dia.** Cada dia útil com posse só conta (pontuação e fator de participação) se tiver o **seu** checklist diário, feito naquele dia, na posse. Antes, um único diário validava a posse inteira (ex.: 20 dias com o carro e 1 diário = 20 dias contados).
  - No **dia do recebimento**, o checklist de recebimento vale como o do dia, desde que a posse tenha pelo menos um diário depois (o recebimento sozinho continua não comprovando o uso; a posse de 5 minutos continua sem pontos).
  - Vale para as quatro regras do dia (posse mínima e diário · só posse mínima · só diário · um ou outro). O extrato mostra "sem checklist diário neste dia" nos dias que não contaram.
  - Vale já para o período em aberto (26/09 a 25/10); períodos fechados não mudam.
- **Correção de quilometragem pela gestão:** botão **Corrigir km** na tela do veículo (gestor de frota e administrador). Informe o km do painel e o motivo; o sistema lista os registros que ficaram acima (checklists, abastecimentos, início/fim de posse, plano e serviços de manutenção) para corrigir um a um. O valor original fica guardado e a correção vai para a linha do tempo. Antes, um km digitado errado (ex.: um zero a mais) não podia ser baixado por ninguém e travava os checklists dos condutores seguintes.
- **Conferência de km no app do condutor:** quando o km informado sobe mais que o limite desde o último registro (padrão 2.000 km, em Configurações › Regras da frota), o app pede para conferir o painel e tocar de novo. Confirmado, a gestão recebe um aviso com o salto.
- **Registros feitos sem sinal não se perdem:** o que não foi enviado por falta de conexão (checklists, abastecimentos, posses, fotos) fica guardado no celular e é enviado quando o app abre de novo com internet, mesmo que tenha sido fechado. O registro fica marcado "feito sem conexão"; na premiação vale o horário do aparelho (até 24 h de atraso no envio), então o diário feito às 8h sem sinal não vira atraso.
  - Limite: protege o registro feito com o app aberto. O app ainda precisa de internet para abrir do zero.
- **Horário do servidor na posse:** o banco passa a gravar a hora em que recebeu o início e o fim de cada posse. Se o relógio do celular divergir mais de 15 min, a premiação usa o horário do servidor e as listas de posses mostram o aviso **relógio** (ou **sem conexão**, quando foi envio atrasado).
- **Fechamento mensal de pedágios:** em meses já encerrados, **Fechar o mês** congela o fechamento por obra e a lista de passagens (como foram enviados ao financeiro); o Excel do mês sai do fechamento. Depois de fechado, o banco recusa importar, lançar, ajustar ou excluir passagens daquele mês (a importação ignora as linhas desse mês). Se uma correção de obra mudar o cálculo depois, a tela avisa a diferença, mas o fechamento não muda. Só o administrador **reabre**, com motivo (fica na auditoria).
- Correção: erro interno ao trocar de tela logo depois de salvar um checklist com o teclado aberto (o registro já era salvo normalmente).
- Testes automáticos agora ficam no repositório (`tests/`, 43 casos): `UI=1 node tests/run.js`.
- Banco: migration `20261017000013_gestaovia_km_horario_posse_fechamento_pedagios` (horário do servidor na posse, tabela `toll_closings` com trava de passagens em mês fechado). Compatível com a v1.11.0.

## v1.11.0 — 17/10/2026
- **Premiação só para quem realmente usou o veículo:** o dia útil só conta como "dia com posse" (para a pontuação e para o fator de participação) quando atende à regra configurada em Premiação › Parâmetros. Padrão: **posse de 5 h ou mais no dia e ao menos um checklist diário feito na posse, depois do recebimento**. Quem só fez o checklist de recebimento e entregou logo depois (ou não fez nenhum diário) **não tem pontuação nem premiação** no período.
  - Parâmetros novos: **Regra para contar o dia com posse** (posse mínima e checklist diário · só posse mínima · só checklist diário · um ou outro) e **Posse mínima no dia** (horas; padrão 5 h).
  - O extrato mostra os dias com posse que não contaram e o motivo (ex.: "posse de 0 h 05 min no dia (mínimo 5,0 h) e sem checklist diário na posse depois do recebimento"). Ranking e cadastro do condutor mostram "sem uso comprovado".
  - Vale já para o período em aberto (26/09 a 25/10); períodos fechados não mudam. Alterações nos parâmetros continuam valendo a partir do período seguinte.
- **Adicional de 100 pontos para todos:** quem fecha com 100 pontos recebe o adicional, sem exigir 15 dias com posse (continua proporcional aos dias com posse ÷ dias úteis). O adicional de 90 a 99 pontos continua exigindo os dias mínimos (parâmetro renomeado para "Dias com posse mínimos para o adicional de 90 a 99 pontos").
- **Transferência forçada: descontar ou não a pontuação.** O gestor marca obrigatoriamente **Sim, descontar** (ocorrência de −50 pts na modalidade A no extrato do condutor que estava com o veículo, cancelável com motivo em Premiação) ou **Não descontar**. A escolha aparece na transferência, na linha do tempo e no aviso ao condutor.
- **Gestor corrige a obra informada pelo condutor:** botão **Corrigir** na coluna Obras das posses (veículo e condutor) e botão **Obra** na tela do veículo com posse ativa. Corrige cada trecho da posse, com motivo obrigatório; checklists e abastecimentos daquela posse vão junto para a obra certa; custos, pedágios, multas e indicadores por obra são recalculados. O original fica guardado ("corrigida"), a correção vai para a linha do tempo e o condutor recebe aviso.
- **Pedágios com fechamento mensal:**
  - **Importar fatura Sem Parar** (Excel .xlsx/.xls ou CSV, ou linhas coladas): o sistema acha o cabeçalho, reconhece as colunas (placa, data, hora, praça, valor, tipo, TAG — dá para trocar), mostra a prévia com a obra de cada passagem, ignora estacionamento/mensalidade/taxas (opcional) e não importa passagem repetida. A obra é a da posse no horário da passagem; sem posse no horário (ou sem hora), a da posse do veículo no mesmo dia. Importação pode ser desfeita.
  - **Lançar manual (sem TAG):** veículo, data, hora (opcional), praça, valor, quantidade de passagens e comprovante; a obra vem da posse do dia ou é escolhida.
  - Tela por **mês**: total, Sem Parar, manual, "Sem obra" para ajustar, **fechamento por obra**, faturas importadas e **Excel do mês** (abas Por obra e Passagens). Ajuste manual de obra/condutor em qualquer passagem, com volta ao automático.
  - Cadastro do veículo: **TAG de pedágio (Sem Parar)** — tem TAG / sem TAG — e nº da TAG.
- Banco: sem migration nesta versão (campos novos ficam em `extra` e nas configurações).

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
