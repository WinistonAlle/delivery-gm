# Delivery GM

Aplicacao de delivery da Gostinho Mineiro, construida com React + Vite + Supabase.

## O que o sistema faz

- cadastro de clientes com CPF e endereco
- login por telefone
- catalogo de produtos
- carrinho e checkout unico
- envio do pedido para WhatsApp
- persistencia de pedidos no Supabase
- areas administrativas e operacionais
- relatorios gerenciais
- analise de metricas de conversao do delivery

## Documentacao completa

A documentacao principal do sistema esta em:

- [docs/SISTEMA-DELIVERY.md](/Users/winistonalle/Desktop/copia-para-delivery/docs/SISTEMA-DELIVERY.md)

Esse documento cobre:

- fluxo do cliente
- cadastro, login, carrinho e checkout
- WhatsApp do pedido
- admin, operacao e relatorios
- funil e metricas de conversao
- banco de dados e schema local do Supabase

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router
- TanStack Query

## Como rodar localmente

1. Instale as dependencias:

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

3. Se for usar Supabase local, execute:

- [supabase-local-complete.sql](/Users/winistonalle/Desktop/copia-para-delivery/supabase-local-complete.sql)

4. Rode o projeto:

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Observacoes

- o projeto nao usa mais Google Sheets
- `google-service-account.json` saiu do fluxo
- o numero de WhatsApp configurado para pedidos e `61985941557`
