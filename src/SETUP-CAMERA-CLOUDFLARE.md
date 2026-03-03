# Setup de Camera ESP32-CAM com Cloudflare Tunnel

Guia oficial do projeto para publicar a camera local no app sem IP fixo.

Data de referencia: 2026-02-28
Versao cloudflared testada: 2026.2.0

## Objetivo

Expor a camera local (ex.: `http://192.168.68.61/capture`) para o frontend hospedado em servidor, sem abrir portas no roteador.

## Arquitetura

1. ESP32-CAM responde snapshot na rede local (`/capture`).
2. `cloudflared` roda em uma maquina local da mesma rede.
3. Cloudflare Tunnel publica uma URL HTTPS publica.
4. A URL publica e salva em `cameras.url_stream`.
5. A tela `Seguranca` usa essa URL no modal `Camera ao Vivo`.

## Pre-requisitos

1. Camera acessivel localmente:
   - `http://IP_DA_CAMERA/capture`
2. App e banco ja configurados.
3. `cloudflared` instalado:
   - macOS (Homebrew): `brew install cloudflared`

## Fluxo 1 - Teste rapido (Quick Tunnel)

Use este fluxo para validar em minutos.

1. Rode na maquina local:

```bash
cloudflared tunnel --url http://192.168.68.61
```

2. Copie a URL gerada (`https://xxxxx.trycloudflare.com`).
3. Teste no navegador:

```text
https://xxxxx.trycloudflare.com/capture
```

4. Atualize no banco:

```sql
update cameras
set
  url_stream = 'https://xxxxx.trycloudflare.com/capture',
  status = 'Ativa',
  updated_at = now()
where nome ilike '%sala 1%'
   or localizacao ilike '%sala de cultivo 1%';
```

5. Abra o app em `Seguranca` e clique em `Camera ao Vivo`.

### Observacoes importantes do Quick Tunnel

1. A URL muda quando o processo reinicia.
2. Nao ha garantia de uptime.
3. Se o terminal fechar, a camera sai do ar.

## Fluxo 2 - Producao (Named Tunnel com URL fixa)

Use este fluxo para operar de forma estavel.

Requisito: ter um dominio gerenciado no Cloudflare (DNS zone no painel Cloudflare).

1. Login do cloudflared:

```bash
cloudflared tunnel login
```

2. Criar tunnel:

```bash
cloudflared tunnel create shroom-cam
```

3. Criar DNS do tunnel:

```bash
cloudflared tunnel route dns shroom-cam camera.seudominio.com
```

4. Criar config em `~/.cloudflared/config.yml`:

```yaml
tunnel: shroom-cam
credentials-file: /Users/SEU_USUARIO/.cloudflared/TUNNEL_UUID.json

ingress:
  - hostname: camera.seudominio.com
    service: http://192.168.68.61
  - service: http_status:404
```

5. Rodar o tunnel:

```bash
cloudflared tunnel run shroom-cam
```

6. Testar:

```text
https://camera.seudominio.com/capture
```

7. Salvar URL fixa no banco:

```sql
update cameras
set
  url_stream = 'https://camera.seudominio.com/capture',
  status = 'Ativa',
  updated_at = now()
where nome ilike '%sala 1%'
   or localizacao ilike '%sala de cultivo 1%';
```

## Rodar como servico (sem deixar terminal aberto)

No macOS, o cloudflared pode rodar como launch agent:

```bash
cloudflared service install
```

Depois, use o tunnel nomeado com config valida em `~/.cloudflared/config.yml`.

## Checklist de operacao

1. Maquina local do tunnel ligada.
2. ESP32-CAM ligada e respondendo no IP local.
3. URL publica da camera funcionando em `/capture`.
4. Registro em `cameras.url_stream` apontando para URL atual.
5. Tela `Seguranca` mostrando imagem no modal.

## Troubleshooting

### Mensagem "Camera sem URL configurada"

1. Verifique se `url_stream` esta preenchido na tabela `cameras`.
2. Confirme que a camera selecionada esta com `status = 'Ativa'`.
3. Recarregue a pagina (`Ctrl/Cmd + Shift + R`).

### Modal abre, mas imagem nao carrega

1. Teste a URL direto no navegador.
2. Confirme que o processo `cloudflared` esta rodando.
3. Se for Quick Tunnel, valide se a URL nao mudou.

### Camera lenta

1. Prefira endpoint de snapshot (`/capture`) em vez de stream continuo.
2. No app, use refresh manual ou auto refresh com intervalo maior.

### App em HTTPS e camera em HTTP local

Sempre use a URL HTTPS do tunnel no `url_stream`. Evite colocar IP local no frontend publicado.

## Seguranca recomendada

1. Em producao, prefira Named Tunnel.
2. Considere proteger a URL com Cloudflare Access.
3. Nao exponha IP interno da camera no frontend publico.

## Comandos uteis

Ver versao:

```bash
cloudflared --version
```

Listar tunnels:

```bash
cloudflared tunnel list
```

Informacoes de conexao:

```bash
cloudflared tunnel info shroom-cam
```

## Referencias oficiais

1. https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
2. https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/
