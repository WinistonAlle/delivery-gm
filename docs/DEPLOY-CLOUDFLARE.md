# Deploy no servidor com Cloudflare

Este projeto foi preparado para rodar em um servidor Node atras do Cloudflare.

## O que sobe

- frontend Vite estatico em `dist/`
- API Node/Express em [server.ts](/Users/winistonalle/Desktop/copia-para-delivery/server.ts)
- mesmas rotas usadas hoje pelo app:
  - `/api/auth/*`
  - `/api/orders`
  - `/api/customer-orders`
  - `/api/admin-orders`
  - `/api/reports-dashboard`
  - `/api/delivery-ops`

## Variaveis obrigatorias

Configure no servidor:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
AUTH_SESSION_SECRET=
VITE_ADMIN_PHONES=5561998824141
ADMIN_PHONES=5561998824141
PORT=4174
```

Observacoes:

- `AUTH_SESSION_SECRET` deve ser um segredo forte proprio.
- `VITE_ADMIN_PHONES` e `ADMIN_PHONES` devem ficar com o telefone admin em formato numerico com DDI.

## Admin inicial

Antes de liberar producao, rode no Supabase:

- [seed_admin_delivery_customer.sql](/Users/winistonalle/Desktop/copia-para-delivery/docs/seed_admin_delivery_customer.sql)

Isso cria ou atualiza o cliente admin inicial:

- telefone: `61998824141`
- CPF: `03554321109`

## Passo a passo no servidor

```bash
npm ci
cp .env.example .env
# editar .env com os valores reais
npm run build
npm run start:prod
```

## PM2

Sugestao simples:

```bash
pm2 start npm --name delivery-gm -- run start:prod
pm2 save
```

## Cloudflare

No painel do Cloudflare:

- DNS do dominio apontando para o IP do servidor
- Proxy laranja habilitado
- SSL/TLS em `Full (strict)`
- Cache Rule: nao fazer cache de `/api/*`

## Reverse proxy

Se estiver usando Nginx na frente do Node:

```nginx
server {
    listen 80;
    server_name funcionarios.seudominio.com;

    location / {
        proxy_pass http://127.0.0.1:4174;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Smoke test minimo

Antes de abrir para uso:

1. Acessar `/healthz`
2. Abrir o catalogo
3. Fazer cadastro do admin
4. Fazer logout e login novamente
5. Criar um pedido de teste
6. Abrir `/meus-pedidos`
7. Confirmar acesso admin nas telas internas
