# Deploy no Coolify (Docker) + Dominio `www.cogumelos.net`

## 1) Subir o app no Coolify

1. No Coolify, crie um novo recurso de **Application** a partir deste repositório.
2. Escolha **Dockerfile** como tipo de build.
3. Configure:
   - **Dockerfile path**: `./Dockerfile`
   - **Porta interna**: `80`
   - **Healthcheck path**: `/`
4. Faça o primeiro deploy.
5. Valide se a URL temporária do Coolify abre o app.

## 2) Configurar dominio no Coolify

1. Na aplicação, abra **Domains**.
2. Adicione `www.cogumelos.net`.
3. Salve e aguarde o Coolify provisionar o certificado SSL.

## 3) Configurar DNS do dominio

No provedor onde `cogumelos.net` foi comprado:

1. Crie um registro para `www` apontando para o servidor do Coolify:
   - Opção A: `CNAME` `www` -> host público do servidor
   - Opção B: `A` `www` -> IP público do servidor
2. Aguarde propagação (normalmente alguns minutos, podendo levar até 24h).

## 4) Opcional: redirecionar raiz para `www`

Se quiser forçar sempre `www.cogumelos.net`:

1. Adicione também `cogumelos.net` nos domínios do app no Coolify.
2. Crie redirect 301 de `https://cogumelos.net` para `https://www.cogumelos.net`.

## 5) Checklist final

1. `https://www.cogumelos.net` abre sem erro de SSL.
2. Atualizar a página em uma rota interna (ex.: `/seguranca`) funciona sem 404.
3. Deploy automático pelo Git está ativo.
