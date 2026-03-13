# Delivery GM

Aplicação de delivery da Gostinho Mineiro, construída com React + Vite + Supabase.

O sistema permite:
- cadastro de clientes com CPF e endereço
- login por telefone
- catálogo de produtos
- carrinho e checkout
- envio do pedido para WhatsApp
- persistência de pedidos no Supabase
- áreas administrativas e operacionais já existentes no projeto

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router
- TanStack Query

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo `.env` com as variáveis necessárias.

Exemplo:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_ADMIN_PHONES=
```

3. Rode o projeto:

```bash
npm run dev
```

4. Para gerar build:

```bash
npm run build
```

## Fluxo atual do pedido

1. O cliente faz cadastro ou login com telefone.
2. Monta o carrinho no catálogo.
3. Abre o carrinho e segue para o checkout.
4. No checkout informa/confirma:
   - nome
   - telefone
   - endereço
   - cidade de entrega
   - forma de pagamento
   - observações opcionais
5. O sistema:
   - grava o pedido no Supabase
   - monta uma mensagem detalhada
   - abre o WhatsApp para envio ao número `61985941557`

## Cadastro de clientes

O cadastro do delivery hoje trabalha com:
- nome completo
- telefone
- CPF
- endereço com busca automática por CEP
- campo "como conheceu a gente"

Os dados do cliente são mantidos no fluxo do app e reutilizados no checkout.

## Observações

- O projeto não usa mais integração com Google Sheets.
- O arquivo `google-service-account.json` foi removido do fluxo.
- Os cadastros e pedidos devem ficar centralizados no Supabase.

## Estrutura principal

Alguns arquivos importantes:

- [src/pages/Cadastro.tsx](./src/pages/Cadastro.tsx)
- [src/pages/Login.tsx](./src/pages/Login.tsx)
- [src/pages/Checkout.tsx](./src/pages/Checkout.tsx)
- [src/components/Cart.tsx](./src/components/Cart.tsx)
- [src/lib/customerAuth.ts](./src/lib/customerAuth.ts)
- [src/services/orders.ts](./src/services/orders.ts)
- [src/lib/supabase.ts](./src/lib/supabase.ts)

## Deploy

O projeto pode ser publicado em ambiente estático/frontend com acesso ao Supabase via variáveis de ambiente.

Antes de publicar, valide:
- variáveis do Supabase
- regras de acesso no banco
- número de WhatsApp de recebimento dos pedidos

