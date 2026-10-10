# Histórico de versões do gestaovia

Cada versão tem duas pastas em `versoes/vX.Y.Z/`:
- **alteracoes/** — só os arquivos que mudaram desde a versão anterior (mesmos caminhos do repositório) + `LEIA-ME-ALTERACOES.txt` com a lista do que trocar e do que apagar.
- **completo/** — o sistema inteiro daquela versão.

Numeração: **X** muda o sistema por inteiro, **Y** traz funções novas, **Z** corrige algo sem mudar o uso.
Mudanças no banco (Supabase) ficam em `supabase/migrations/` e já são aplicadas por Claude no projeto; não precisam ser enviadas ao GitHub Pages para funcionar.

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
