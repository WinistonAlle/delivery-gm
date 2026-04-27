# Delivery GM

Aplicação de delivery da Gostinho Mineiro, focada em cliente final, construída com React, Vite e Supabase.

## Visão Geral

O sistema cobre o fluxo completo do cliente:

- cadastro com telefone, CPF e endereço
- login por telefone
- catálogo de produtos
- favoritos
- carrinho
- checkout com frete por cidade
- gravação do pedido no Supabase
- envio do pedido para WhatsApp
- histórico em "Meus Pedidos"

Também inclui telas internas de administração para:

- produtos
- destaques do carrossel
- avisos
- operação de pedidos
- relatórios

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router
- TanStack Query

## Estrutura Principal

- [src/pages/Index.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Index.tsx): catálogo principal
- [src/pages/Login.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Login.tsx): entrada por telefone
- [src/pages/Cadastro.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Cadastro.tsx): cadastro de cliente
- [src/pages/Checkout.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/Checkout.tsx): checkout e fechamento do pedido
- [src/pages/MyOrdersPage.tsx](/Users/winistonalle/Desktop/copia-para-delivery/src/pages/MyOrdersPage.tsx): pedidos do cliente
- [src/services/orders.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/services/orders.ts): persistência do pedido
- [src/lib/customerAuth.ts](/Users/winistonalle/Desktop/copia-para-delivery/src/lib/customerAuth.ts): sessão e dados locais do cliente
- [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql): schema completo do banco

## Como Rodar

1. Instale as dependências:

```bash
npm install
```

2. Configure o `.env`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_ADMIN_PHONES=
```

3. Crie o banco usando:

- [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql)

4. Rode o projeto:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Produção em servidor próprio

Para subir em um servidor Node atrás do Cloudflare:

```bash
npm ci
npm run build
npm run start:prod
```

Documentação completa:

- [DEPLOY-CLOUDFLARE.md](/Users/winistonalle/Desktop/copia-para-delivery/docs/DEPLOY-CLOUDFLARE.md)

## Banco

O schema atual de `orders` foi ajustado para o modelo de cliente:

- `customer_name`
- `customer_phone`
- `customer_document_cpf`
- `customer_address`
- `customer_city`
- `customer_cep`
- `shipping_cost`
- `shipping_cents`

As colunas legadas `employee_name` e `employee_cpf` ficaram como compatibilidade para leitura antiga.

## Observações

- o sistema está orientado a cliente; módulos antigos de RH e separação foram removidos do app principal
- a sessão principal do cliente agora usa `customer_session`, com fallback temporário para `employee_session`
- o número de WhatsApp configurado para pedidos é `61985941557`
- a documentação funcional detalhada continua em [docs/SISTEMA-DELIVERY.md](/Users/winistonalle/Desktop/copia-para-delivery/docs/SISTEMA-DELIVERY.md)
