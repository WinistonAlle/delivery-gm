# Sistema Delivery GM

Documentação funcional e técnica do sistema de delivery da Gostinho Mineiro.

## Visão Geral

O sistema foi construído para permitir que o cliente:

- entre no site
- faça cadastro ou login por telefone
- monte o carrinho
- finalize um pedido
- envie automaticamente um resumo detalhado para o WhatsApp da operação

Ao mesmo tempo, o sistema oferece recursos de administração, operação e análise:

- gestão de produtos
- destaque de produtos no carrossel
- avisos internos
- operação de pedidos
- acompanhamento de pedidos do cliente
- relatórios
- análise de conversão do delivery

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

Quando o visitante acessa o catálogo, o sistema pode registrar a visita para análise de conversão.

Evento registrado:
- `site_visit`

### 2. Login

O login funciona por telefone.

Comportamento:
- o usuário informa o número
- se já existir cadastro local, entra normalmente
- se ainda não existir cadastro, o sistema redireciona direto para a tela de cadastro
- o telefone digitado no login já vai preenchido no cadastro

Arquivo principal:
- [Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx)

Evento registrado:
- `login_success`

### 3. Cadastro

O cadastro foi adaptado para o delivery atual e hoje inclui:

- nome completo
- telefone
- CPF
- endereço com busca automática por CEP
- número do endereço
- complemento
- campo de "como conheceu a gente"

Comportamentos importantes:

- o endereço pode ser preenchido automaticamente pelo CEP
- a busca do CEP acontece automaticamente ao completar os 8 dígitos
- o foco pode seguir para o campo de número do endereço
- o telefone pode vir pré-preenchido a partir da tela de login

Arquivo principal:
- [Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx)

Evento registrado:
- `signup_completed`

## Catálogo e Carrinho

O catálogo exibe os produtos cadastrados no Supabase.

Recursos existentes:

- listagem de produtos
- destaques
- favoritos
- recomendações no carrinho e checkout
- combos configuráveis
- cross-sell entre produtos

O carrinho hoje tem uma função clara:

- revisar itens
- ajustar quantidades
- seguir para o checkout único

O fluxo antigo com dois checkouts foi removido.

Arquivos principais:
- [Index.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Index.tsx)
- [Cart.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/components/Cart.tsx)
- [CartContext.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/contexts/CartContext.tsx)
- [deliveryOffers.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/deliveryOffers.ts)

Evento registrado ao primeiro início real de carrinho:
- `cart_started`

## Checkout

Hoje o sistema usa um checkout único.

No checkout o usuário informa ou confirma:

- nome
- telefone
- endereço
- cidade
- forma de pagamento
- observações

O checkout também:

- reaproveita dados salvos da sessão/localStorage
- tenta recuperar endereços do cadastro pelo telefone
- calcula frete por cidade
- pode sugerir produtos complementares

Arquivo principal:
- [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)

Eventos registrados:
- `checkout_started`
- `checkout_view`

## Pedido e Envio para WhatsApp

Quando o pedido é confirmado:

1. o sistema grava o pedido no Supabase
2. grava os itens do pedido
3. atualiza a sessão local do cliente
4. monta uma mensagem detalhada
5. abre o WhatsApp para envio ao número oficial

Número configurado:
- `61985941557`

A mensagem enviada inclui:

- nome do cliente
- telefone
- CPF
- endereço
- cidade
- forma de pagamento
- frete
- total
- lista detalhada de itens com quantidade, valor unitário e subtotal
- observações, se existirem

Arquivos principais:
- [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)
- [orders.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/services/orders.ts)

Evento registrado:
- `order_completed`

## Meus Pedidos

O cliente pode consultar seus pedidos feitos no sistema.

Recursos:

- listagem por identificador do cliente logado
- visualização dos itens de cada pedido
- opção de refazer pedido reaproveitando itens ainda disponíveis

Arquivo principal:
- [MyOrdersPage.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/MyOrdersPage.tsx)

## Áreas Administrativas e Operacionais

### Admin de produtos

Permite:

- cadastrar produto
- editar produto
- excluir produto
- subir imagem para o bucket `products`
- editar preço de funcionário
- configurar categoria
- configurar `old_id`
- configurar embalagem, peso, destaque e lançamento

Arquivo principal:
- [Admin.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Admin.tsx)

### Destaques / carrossel

Permite:

- alternar entre modo automático e manual
- salvar produtos destacados manualmente
- usar ranking automático por vendas

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
- filtrar por CPF, número ou status
- abrir itens do pedido
- cancelar pedido com motivo
- remover item inteiro do pedido
- remover quantidade parcial de um item
- consultar histórico de ações administrativas
- consultar histórico de cancelamentos

Arquivo principal:
- [AdminOrders.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/AdminOrders.tsx)

RPCs utilizados:
- `admin_get_employees_basic`
- `admin_cancel_order_v2`
- `admin_remove_order_item_v3`
- `admin_remove_order_item_qty_v1`

### Operação do delivery

Tela voltada para operação simples do fluxo de pedidos.

Permite:

- listar pedidos recentes
- atualizar status do pedido
- visualizar métricas locais de abandono / início / conclusão

Arquivo principal:
- [DeliveryOps.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/DeliveryOps.tsx)

### Painel de separação

Tela operacional em tempo real para pedidos em andamento.

Recursos:

- acompanha pedidos por status
- usa realtime do Supabase na tabela `orders`
- mostra pedidos relevantes para separação
- destaca visualmente pedidos novos
- identifica contexto de pagamento

Arquivo principal:
- [SeparationBoard.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/SeparationBoard.tsx)

## Relatórios

### Dashboard de relatórios

Concentra dados como:

- total de pedidos
- receita total
- itens vendidos
- ticket médio
- top funcionários
- top produtos
- resumo diário
- comparação por período
- comparação entre meses

Arquivo principal:
- [ReportsDashboard.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/ReportsDashboard.tsx)

### Relatório RH

Focado em consumo por funcionário e desconto em folha.

Informações principais:

- funcionário
- CPF
- mês de referência
- quantidade de pedidos
- total gasto
- desconto em folha
- valor pago na retirada

Arquivo principal:
- [RHSpendingReport.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/rh/RHSpendingReport.tsx)

Dependências de banco:

- view `rh_spending_report`
- RPC `current_pay_cycle_key`

## Análise de Conversão do Delivery

Essa parte foi adicionada para medir comportamento antes da compra.

### Objetivo

Entender:

- quantas pessoas entraram no site
- quantas avançaram no funil
- quantas compraram
- quem não concluiu pedido

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

Arquivo responsável pela captura:
- [customerInsights.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerInsights.ts)

### Onde os eventos são disparados

- visita ao catálogo: [App.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/App.tsx)
- cadastro concluído: [Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx)
- login concluído: [Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx)
- início de carrinho: [CartContext.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/contexts/CartContext.tsx)
- visualização do checkout: [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)
- pedido concluído: [Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx)

### Indicadores gerados

No dashboard administrativo, a seção de conversão mostra:

- visitantes únicos
- visitantes cadastrados
- visitantes que chegaram ao checkout
- compradores
- visitantes sem compra

Também existe uma lista com os leads/visitantes que não concluíram pedido.

Essa lista pode exibir:

- nome
- telefone
- CPF
- último evento
- última rota acessada
- data/hora do último contato

### Interpretação prática

Com essa análise você consegue enxergar:

- tráfego que não converteu
- pessoas que se cadastraram mas não compraram
- pessoas que iniciaram checkout e abandonaram
- sinais de interesse que podem virar ação comercial

### Limitações atuais

Algumas limitações importantes:

- a identificação depende do navegador e do `localStorage`
- se o usuário trocar de aparelho ou limpar o navegador, vira outro visitante
- o cadastro do cliente ainda está majoritariamente local no app
- hoje as policies e permissões do banco foram deixadas abertas para facilitar operação local/dev

Mesmo com isso, a análise já entrega um funil útil para operação e marketing.

## Banco de Dados

O projeto hoje pode ser inicializado com um schema completo para Supabase local.

Arquivo SQL principal:
- [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql)

Esse script cria:

- catálogo
- pedidos
- itens do pedido
- funcionários
- RH
- avisos
- destaques
- tema
- ofertas do delivery
- eventos de conversão
- buckets de storage
- RLS
- views e RPCs necessários

## Variáveis de Ambiente

Exemplo mínimo:

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
3. Configure as variáveis `.env`.
4. Rode o frontend.

## Estrutura Técnica Relevante

Arquivos centrais do sistema:

- [src/lib/supabase.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/supabase.ts)
- [src/lib/customerAuth.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerAuth.ts)
- [src/lib/customerInsights.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerInsights.ts)
- [src/services/orders.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/services/orders.ts)
- [src/lib/deliveryOffers.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/deliveryOffers.ts)
- [src/lib/appTheme.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/appTheme.ts)

Páginas principais:

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

- não usa mais Google Sheets
- não depende mais de `google-service-account.json`
- concentra persistência operacional no Supabase
- envia os pedidos por WhatsApp
- possui base para analytics e conversão
- possui schema SQL completo para Supabase local

## Próximos Passos Recomendados

- mover o cadastro do cliente do `localStorage` para Supabase
- endurecer RLS para produção
- criar autenticação administrativa real no Supabase Auth
- criar painel de leads sem compra com filtros por período
- adicionar dashboards de conversão por dia, semana e mês
