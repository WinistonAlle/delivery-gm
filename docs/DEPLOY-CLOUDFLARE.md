# Deploy no servidor com Cloudflare

Este projeto foi preparado para rodar em um servidor Node atrás do Cloudflare.

## O que sobe

- frontend Vite estático em `dist/`
- API Node/Express em [server.ts](/Users/winistonalle/Desktop/copia-para-delivery/server.ts)
- mesmas rotas usadas hoje pelo app:
  - `/api/auth/*`
  - `/api/orders`
  - `/api/customer-orders`
  - `/api/admin-orders`
  - `/api/reports-dashboard`
  - `/api/delivery-ops`

## Variáveis obrigatórias

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

Observações:

- `AUTH_SESSION_SECRET` deve ser um segredo forte próprio.
- `VITE_ADMIN_PHONES` e `ADMIN_PHONES` devem ficar com o telefone admin em formato numérico com DDI.

## Admin inicial

Antes de liberar produção, rode no Supabase:

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

Sugestão simples:

```bash
pm2 start npm --name delivery-gm -- run start:prod
pm2 save
```

## Cloudflare

No painel do Cloudflare:

- DNS do domínio apontando para o IP do servidor
- Proxy laranja habilitado
- SSL/TLS em `Full (strict)`
- Cache Rule: não fazer cache de `/api/*`

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

## Smoke test mínimo

Antes de abrir para uso:

1. Acessar `/healthz`
2. Abrir o catálogo
3. Fazer cadastro do admin
4. Fazer logout e login novamente
5. Criar um pedido de teste
6. Abrir `/meus-pedidos`
7. Confirmar acesso admin nas telas internas
