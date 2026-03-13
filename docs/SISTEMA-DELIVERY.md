# Sistema Delivery GM

Documentacao funcional e tecnica do sistema de delivery da Gostinho Mineiro.

## Visao Geral

O sistema foi construido para permitir que o cliente:

- entre no site
- faca cadastro ou login por telefone
- monte o carrinho
- finalize um pedido
- envie automaticamente um resumo detalhado para o WhatsApp da operacao

Ao mesmo tempo, o sistema oferece recursos de administracao, operacao e analise:

- gestao de produtos
- destaque de produtos no carrossel
- avisos internos
- operacao de pedidos
- acompanhamento de pedidos do cliente
- relatorios
- analise de conversao do delivery

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router
- TanStack Query

## Fluxo Principal do Cliente

### 1. Entrada no site

Quando o visitante acessa o catalogo, o sistema pode registrar a visita para analise de conversao.

Evento registrado:
- `site_visit`

### 2. Login

O login funciona por telefone.

Comportamento:
- o usuario informa o numero
- se ja existir cadastro local, entra normalmente
- se ainda nao existir cadastro, o sistema redireciona direto para a tela de cadastro
- o telefone digitado no login ja vai preenchido no cadastro

Arquivo principal:
- [Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx)

Evento registrado:
- `login_success`

### 3. Cadastro

O cadastro foi adaptado para o delivery atual e hoje inclui:

- nome completo
- telefone
- CPF
- endereco com busca automatica por CEP
- numero do endereco
- complemento
- campo de "como conheceu a gente"

Comportamentos importantes:

- o endereco pode ser preenchido automaticamente pelo CEP
- a busca do CEP acontece automaticamente ao completar os 8 digitos
- o foco pode seguir para o campo de numero do endereco
- o telefone pode vir pre-preenchido a partir da tela de login

Arquivo principal:
- [Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx)

Evento registrado:
- `signup_completed`

## Catalogo e Carrinho

O catalogo exibe os produtos cadastrados no Supabase.

Recursos existentes:

- listagem de produtos
- destaques
- favoritos
- recomendacoes no carrinho e checkout
- combos configuraveis
- cross-sell entre produtos

O carrinho hoje tem uma funcao clara:

- revisar itens
- ajustar quantidades
- seguir para o checkout unico

O fluxo antigo com dois checkouts foi removido.

Arquivos principais:
- [Index.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Index.tsx)
- [Cart.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/components/Cart.tsx)
- [CartContext.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/contexts/CartContext.tsx)
- [deliveryOffers.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/deliveryOffers.ts)

Evento registrado ao primeiro inicio real de carrinho:
- `cart_started`

## Checkout

Hoje o sistema usa um checkout unico.

No checkout o usuario informa ou confirma:

- nome
- telefone
- endereco
- cidade
- forma de pagamento
- observacoes

O checkout tambem:

- reaproveita dados salvos da sessao/localStorage
- tenta recuperar enderecos do cadastro pelo telefone
- calcula frete por cidade
- pode sugerir produtos complementares

Arquivo principal:
- [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)

Eventos registrados:
- `checkout_started`
- `checkout_view`

## Pedido e Envio para WhatsApp

Quando o pedido e confirmado:

1. o sistema grava o pedido no Supabase
2. grava os itens do pedido
3. atualiza a sessao local do cliente
4. monta uma mensagem detalhada
5. abre o WhatsApp para envio ao numero oficial

Numero configurado:
- `61985941557`

A mensagem enviada inclui:

- nome do cliente
- telefone
- CPF
- endereco
- cidade
- forma de pagamento
- frete
- total
- lista detalhada de itens com quantidade, valor unitario e subtotal
- observacoes, se existirem

Arquivos principais:
- [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)
- [orders.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/services/orders.ts)

Evento registrado:
- `order_completed`

## Meus Pedidos

O cliente pode consultar seus pedidos feitos no sistema.

Recursos:

- listagem por identificador do cliente logado
- visualizacao dos itens de cada pedido
- opcao de refazer pedido reaproveitando itens ainda disponiveis

Arquivo principal:
- [MyOrdersPage.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/MyOrdersPage.tsx)

## Areas Administrativas e Operacionais

### Admin de produtos

Permite:

- cadastrar produto
- editar produto
- excluir produto
- subir imagem para o bucket `products`
- editar preco de funcionario
- configurar categoria
- configurar `old_id`
- configurar embalagem, peso, destaque e lancamento

Arquivo principal:
- [Admin.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Admin.tsx)

### Destaques / carrossel

Permite:

- alternar entre modo automatico e manual
- salvar produtos destacados manualmente
- usar ranking automatico por vendas

Arquivos principais:
- [Destaques.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Destaques.tsx)
- [Index.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Index.tsx)

Tabela e RPC relevantes:
- `featured_products`
- `carousel_settings`
- `get_top_selling_products`

### Avisos

Permite:

- criar aviso
- editar aviso
- excluir aviso
- publicar imagem no bucket `notice-images`

Arquivo principal:
- [Avisos.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Avisos.tsx)

### Admin de pedidos

Permite:

- listar pedidos
- filtrar por CPF, numero ou status
- abrir itens do pedido
- cancelar pedido com motivo
- remover item inteiro do pedido
- remover quantidade parcial de um item
- consultar historico de acoes administrativas
- consultar historico de cancelamentos

Arquivo principal:
- [AdminOrders.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/AdminOrders.tsx)

RPCs utilizados:
- `admin_get_employees_basic`
- `admin_cancel_order_v2`
- `admin_remove_order_item_v3`
- `admin_remove_order_item_qty_v1`

### Operacao do delivery

Tela voltada para operacao simples do fluxo de pedidos.

Permite:

- listar pedidos recentes
- atualizar status do pedido
- visualizar metricas locais de abandono / inicio / conclusao

Arquivo principal:
- [DeliveryOps.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/DeliveryOps.tsx)

### Painel de separacao

Tela operacional em tempo real para pedidos em andamento.

Recursos:

- acompanha pedidos por status
- usa realtime do Supabase na tabela `orders`
- mostra pedidos relevantes para separacao
- destaca visualmente pedidos novos
- identifica contexto de pagamento

Arquivo principal:
- [SeparationBoard.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/SeparationBoard.tsx)

## Relatorios

### Dashboard de relatorios

Concentra dados como:

- total de pedidos
- receita total
- itens vendidos
- ticket medio
- top funcionarios
- top produtos
- resumo diario
- comparacao por periodo
- comparacao entre meses

Arquivo principal:
- [ReportsDashboard.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/ReportsDashboard.tsx)

### Relatorio RH

Focado em consumo por funcionario e desconto em folha.

Informacoes principais:

- funcionario
- CPF
- mes de referencia
- quantidade de pedidos
- total gasto
- desconto em folha
- valor pago na retirada

Arquivo principal:
- [RHSpendingReport.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/rh/RHSpendingReport.tsx)

Dependencias de banco:

- view `rh_spending_report`
- RPC `current_pay_cycle_key`

## Analise de Conversao do Delivery

Essa parte foi adicionada para medir comportamento antes da compra.

### Objetivo

Entender:

- quantas pessoas entraram no site
- quantas avancaram no funil
- quantas compraram
- quem nao concluiu pedido

### Tabela usada

- `delivery_customer_events`

### Eventos do funil

Eventos hoje previstos e utilizados:

- `site_visit`
- `signup_completed`
- `login_success`
- `cart_started`
- `checkout_started`
- `checkout_view`
- `order_completed`

### Como funciona

O sistema gera um `visitor_id` local para identificar o navegador/visitante.

Cada evento pode armazenar:

- `visitor_id`
- `event_name`
- `customer_name`
- `phone`
- `document_cpf`
- `path`
- `metadata`
- `user_agent`
- `created_at`

Arquivo responsavel pela captura:
- [customerInsights.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerInsights.ts)

### Onde os eventos sao disparados

- visita ao catalogo: [App.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/App.tsx)
- cadastro concluido: [Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx)
- login concluido: [Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx)
- inicio de carrinho: [CartContext.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/contexts/CartContext.tsx)
- visualizacao do checkout: [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)
- pedido concluido: [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)

### Indicadores gerados

No dashboard administrativo, a secao de conversao mostra:

- visitantes unicos
- visitantes cadastrados
- visitantes que chegaram ao checkout
- compradores
- visitantes sem compra

Tambem existe uma lista com os leads/visitantes que nao concluiram pedido.

Essa lista pode exibir:

- nome
- telefone
- CPF
- ultimo evento
- ultima rota acessada
- data/hora do ultimo contato

### Interpretacao pratica

Com essa analise voce consegue enxergar:

- trafego que nao converteu
- pessoas que se cadastraram mas nao compraram
- pessoas que iniciaram checkout e abandonaram
- sinais de interesse que podem virar acao comercial

### Limitacoes atuais

Algumas limitacoes importantes:

- a identificacao depende do navegador e do `localStorage`
- se o usuario trocar de aparelho ou limpar o navegador, vira outro visitante
- o cadastro do cliente ainda esta majoritariamente local no app
- hoje as policies e permissoes do banco foram deixadas abertas para facilitar operacao local/dev

Mesmo com isso, a analise ja entrega um funil util para operacao e marketing.

## Banco de Dados

O projeto hoje pode ser inicializado com um schema completo para Supabase local.

Arquivo SQL principal:
- [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql)

Esse script cria:

- catalogo
- pedidos
- itens do pedido
- funcionarios
- RH
- avisos
- destaques
- tema
- ofertas do delivery
- eventos de conversao
- buckets de storage
- RLS
- views e RPCs necessarios

## Variaveis de Ambiente

Exemplo minimo:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_ADMIN_PHONES=
```

## Como Rodar

### Frontend

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Banco local

1. Suba seu Supabase local.
2. Execute o SQL de [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql).
3. Configure as variaveis `.env`.
4. Rode o frontend.

## Estrutura Tecnica Relevante

Arquivos centrais do sistema:

- [src/lib/supabase.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/supabase.ts)
- [src/lib/customerAuth.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerAuth.ts)
- [src/lib/customerInsights.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerInsights.ts)
- [src/services/orders.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/services/orders.ts)
- [src/lib/deliveryOffers.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/deliveryOffers.ts)
- [src/lib/appTheme.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/appTheme.ts)

Paginas principais:

- [src/pages/Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx)
- [src/pages/Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx)
- [src/pages/Index.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Index.tsx)
- [src/pages/Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)
- [src/pages/MyOrdersPage.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/MyOrdersPage.tsx)
- [src/pages/Admin.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Admin.tsx)
- [src/pages/AdminOrders.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/AdminOrders.tsx)
- [src/pages/ReportsDashboard.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/ReportsDashboard.tsx)
- [src/pages/rh/RHSpendingReport.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/rh/RHSpendingReport.tsx)

## Status Atual do Projeto

O sistema hoje:

- nao usa mais Google Sheets
- nao depende mais de `google-service-account.json`
- concentra persistencia operacional no Supabase
- envia os pedidos por WhatsApp
- possui base para analytics e conversao
- possui schema SQL completo para Supabase local

## Proximos Passos Recomendados

- mover o cadastro do cliente do `localStorage` para Supabase
- endurecer RLS para producao
- criar autenticacao administrativa real no Supabase Auth
- criar painel de leads sem compra com filtros por periodo
- adicionar dashboards de conversao por dia, semana e mes
