# 🔌 API Documentation - Shroom Bros

## Base URL
```
https://zgxxbguoijamtbydcxrm.supabase.co/functions/v1/make-server-5522cecf
```

## Autenticação

Todas as rotas operacionais (exceto `/signup` e `/sensores/ingest`) requerem autenticação via Bearer Token no header:

```javascript
Authorization: Bearer {access_token}
```

Para obter o `access_token`, faça login usando o Supabase Auth Client no frontend.

Exceção:
- `POST /sensores/ingest` usa autenticação de ingestão por header `x-sensores-key`

---

## 🔐 Autenticação

### POST `/signup`
Criar nova conta de usuário

**Request:**
```json
{
  "email": "fabio@shroombros.com",
  "password": "Fabio1243",
  "nome": "Fabio Silva",
  "telefone": "(11) 98765-4321",
  "tipo_usuario": "admin"
}
```

**Tipos de usuário:**
- `admin` - Administrador
- `producao` - Equipe de produção
- `motorista` - Motorista/Entregador
- `vendas` - Equipe de vendas
- `cliente` - Cliente externo

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "fabio@shroombros.com",
    "nome": "Fabio Silva",
    "tipo_usuario": "admin"
  }
}
```

---

### GET `/me`
Obter dados do usuário autenticado

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "nome": "Fabio Silva",
    "email": "fabio@shroombros.com",
    "telefone": "(11) 98765-4321",
    "tipo_usuario": "admin",
    "avatar_url": null,
    "ativo": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

---

## 🍄 Lotes

### GET `/lotes`
Listar todos os lotes

**Query Parameters:**
- `status` (opcional): `Em Cultivo`, `Pronto`, `Colhido`, `Finalizado`
- `sala` (opcional): Filtrar por sala

**Response (200):**
```json
{
  "lotes": [
    {
      "id": "uuid",
      "codigo_lote": "LOT-2024-001",
      "data_inicio": "2024-01-01",
      "data_previsao_colheita": "2024-03-01",
      "quantidade_inicial": 100,
      "unidade": "kg",
      "status": "Em Cultivo",
      "sala": "Sala A",
      "prateleira": "P1",
      "temperatura_atual": 22.5,
      "umidade_atual": 82.0,
      "qr_code": "QR123456",
      "produto": {
        "id": "uuid",
        "nome": "Shiitake",
        "variedade": "Lentinula edodes"
      },
      "responsavel": {
        "id": "uuid",
        "nome": "Fabio Silva"
      }
    }
  ]
}
```

---

### POST `/lotes`
Criar novo lote

**Request:**
```json
{
  "codigo_lote": "LOT-2024-002",
  "produto_id": "uuid-do-produto",
  "data_inicio": "2024-01-15",
  "data_previsao_colheita": "2024-03-15",
  "quantidade_inicial": 150,
  "sala": "Sala B",
  "prateleira": "P2",
  "status": "Em Cultivo"
}
```

**Response (201):**
```json
{
  "lote": { ... }
}
```

---

### PUT `/lotes/:id`
Atualizar lote

**Request:**
```json
{
  "status": "Pronto",
  "temperatura_atual": 23.0,
  "umidade_atual": 83.5
}
```

**Response (200):**
```json
{
  "lote": { ... }
}
```

---

## 🌾 Colheitas

### GET `/colheitas`
Listar colheitas

**Query Parameters:**
- `lote_id` (opcional): Filtrar por lote

**Response (200):**
```json
{
  "colheitas": [
    {
      "id": "uuid",
      "data_colheita": "2024-03-01T10:30:00Z",
      "quantidade_kg": 45.5,
      "qualidade": "Premium",
      "observacoes": "Excelente qualidade",
      "lote": {
        "codigo_lote": "LOT-2024-001",
        "produto": {
          "nome": "Shiitake"
        }
      },
      "responsavel": {
        "nome": "André Costa"
      }
    }
  ]
}
```

---

### POST `/colheitas`
Registrar colheita

**Request:**
```json
{
  "lote_id": "uuid",
  "produto_id": "uuid",
  "quantidade_kg": 45.5,
  "qualidade": "Premium",
  "observacoes": "Excelente qualidade"
}
```

**Qualidades:**
- `Premium` - Cogumelos de primeira qualidade
- `Padrão` - Qualidade padrão
- `Segunda` - Segunda qualidade

**Response (201):**
```json
{
  "colheita": { ... }
}
```

**Nota:** Ao criar uma colheita, o estoque é automaticamente atualizado.

---

## 🌡️ Sensores

### POST `/sensores/ingest`
Ingerir leitura ambiental de sensor.

O caminho principal definitivo é `sala_id`.

**Base URL oficial da ingestão:**
```text
https://zgxxbguoijamtbydcxrm.supabase.co/functions/v1/make-server-5522cecf
```

**URL final da rota:**
```text
https://zgxxbguoijamtbydcxrm.supabase.co/functions/v1/make-server-5522cecf/sensores/ingest
```

**Header oficial de autenticação da ingestão:**
```http
x-sensores-key: SUA_SENSORES_INGEST_KEY
```

Compatibilidade temporária existente no backend:
- `key` em query string
- `key` no body

Esses formatos legados continuam aceitos hoje, mas não são o padrão oficial.

**Ordem de resolução do vínculo da leitura:**
1. `sala_id` explícito
2. `lote_id` ou `codigo_lote` com `lote.sala_id`
3. fallback legado por `sala` ou `codigo_sala`

**Campos obrigatórios:**
- pelo menos uma métrica válida:
  - `temperatura`
  - `umidade`
  - `co2` ou `co2_ppm`
  - `luminosidade_lux`

**Campos opcionais:**
- `sensor_id`
- `sala_id`
- `codigo_sala`
- `sala`
- `lote_id`
- `codigo_lote`
- `timestamp`
- aliases aceitos para métricas:
  - `temperature`, `temp`
  - `humidity`, `hum`
  - `co2_ppm`, `co2`
  - `lux`

**Regras de validação:**
- `sala_id` deve vir em `snake_case`
- formatos válidos:
  - `sala_1`
  - `sala_de_cultivo_2`
- se `sala_id` vier inválido, o endpoint responde `400`
- se métricas vierem presentes em formato não numérico, o endpoint responde `400`
- se não for possível resolver a sala, o endpoint responde `400` com `code = "sensor_room_unresolved"`

**Exemplo esperado para Sala 1:**
```json
{
  "sensor_id": "sensor_sala_1_a",
  "sala_id": "sala_1",
  "temperatura": 25.4,
  "umidade": 84.1,
  "co2": 520,
  "timestamp": "2026-03-23T19:00:00Z"
}
```

**Exemplo esperado para Sala 2:**
```json
{
  "sensor_id": "sensor_sala_2_a",
  "sala_id": "sala_de_cultivo_2",
  "temperatura": 24.8,
  "umidade": 87.2,
  "co2": 640,
  "timestamp": "2026-03-23T19:00:00Z"
}
```

**Exemplo oficial de teste manual com `curl` para Sala 2:**
```bash
curl -X POST "https://zgxxbguoijamtbydcxrm.supabase.co/functions/v1/make-server-5522cecf/sensores/ingest" \
  -H "Content-Type: application/json" \
  -H "x-sensores-key: SUA_SENSORES_INGEST_KEY" \
  -d '{
    "sensor_id": "sensor_sala_2_a",
    "sala_id": "sala_de_cultivo_2",
    "temperatura": 24.8,
    "umidade": 87.2,
    "co2": 640,
    "timestamp": "2026-03-23T19:00:00Z"
  }'
```

**Exemplo local equivalente para desenvolvimento:**
```bash
curl -X POST "http://localhost:3000/make-server-5522cecf/sensores/ingest" \
  -H "Content-Type: application/json" \
  -H "x-sensores-key: SUA_SENSORES_INGEST_KEY" \
  -d '{
    "sensor_id": "sensor_sala_2_a",
    "sala_id": "sala_de_cultivo_2",
    "temperatura": 24.8,
    "umidade": 87.2,
    "co2": 640,
    "timestamp": "2026-03-23T19:00:00Z"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "leitura_id": "uuid",
  "sensor_id": "sensor_sala_2_a",
  "lote_id": null,
  "sala_id": "sala_de_cultivo_2",
  "resolution": {
    "strategy": "explicit_sala_id",
    "fallback_used": false
  },
  "received": {
    "temperatura": 24.8,
    "umidade": 87.2,
    "co2": 640,
    "luminosidade_lux": null,
    "timestamp": "2026-03-23T19:00:00.000Z"
  }
}
```

**Erros estruturados possíveis:**

`400 sensor_invalid_sala_id`
```json
{
  "error": "sala_id inválido",
  "code": "sensor_invalid_sala_id",
  "details": {
    "expected_format": "snake_case, ex: sala_1 ou sala_de_cultivo_2",
    "received": "Sala 2"
  }
}
```

`400 sensor_invalid_metrics`
```json
{
  "error": "Payload contém métricas inválidas",
  "code": "sensor_invalid_metrics",
  "details": [
    {
      "field": "temperatura",
      "received": "vinte"
    }
  ]
}
```

`400 sensor_room_unresolved`
```json
{
  "error": "Não foi possível resolver sala_id para a leitura",
  "code": "sensor_room_unresolved",
  "warning": "Envie sala_id explicitamente. Fallbacks aceitos temporariamente: lote vinculado, sala, codigo_sala."
}
```

---

## 📦 Estoque

### GET `/estoque`
Listar itens do estoque

**Query Parameters:**
- `produto_id` (opcional): Filtrar por produto
- `status` (opcional): `Disponível`, `Reservado`, `Vendido`, `Descartado`

**Response (200):**
```json
{
  "estoque": [
    {
      "id": "uuid",
      "quantidade_kg": 45.5,
      "qualidade": "Premium",
      "data_entrada": "2024-03-01T10:30:00Z",
      "data_validade": "2024-03-15",
      "localizacao": "Câmara Fria 1",
      "status": "Disponível",
      "produto": {
        "nome": "Shiitake",
        "variedade": "Lentinula edodes"
      },
      "lote": {
        "codigo_lote": "LOT-2024-001"
      }
    }
  ]
}
```

---

## 🎯 Produtos

### GET `/produtos`
Listar produtos disponíveis

**Response (200):**
```json
{
  "produtos": [
    {
      "id": "uuid",
      "nome": "Shiitake",
      "descricao": "Cogumelo Shiitake Premium",
      "variedade": "Lentinula edodes",
      "peso_medio_g": 15.0,
      "preco_kg": 45.0,
      "tempo_cultivo_dias": 60,
      "temperatura_ideal_min": 18.0,
      "temperatura_ideal_max": 24.0,
      "umidade_ideal_min": 75.0,
      "umidade_ideal_max": 85.0,
      "ativo": true
    }
  ]
}
```

---

## 👥 Clientes

### GET `/clientes`
Listar clientes

**Query Parameters:**
- `tipo` (opcional): `B2B` ou `B2C`

**Response (200):**
```json
{
  "clientes": [
    {
      "id": "uuid",
      "nome": "Restaurante Sabor & Arte",
      "tipo_cliente": "B2B",
      "cpf_cnpj": "12.345.678/0001-99",
      "email": "contato@saborarte.com",
      "telefone": "(11) 3456-7890",
      "endereco": "Rua das Flores, 123",
      "cidade": "São Paulo",
      "estado": "SP",
      "cep": "01234-567",
      "ativo": true
    }
  ]
}
```

---

### POST `/clientes`
Cadastrar novo cliente

**Request:**
```json
{
  "nome": "Restaurante Sabor & Arte",
  "tipo_cliente": "B2B",
  "cpf_cnpj": "12.345.678/0001-99",
  "email": "contato@saborarte.com",
  "telefone": "(11) 3456-7890",
  "endereco": "Rua das Flores, 123",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01234-567"
}
```

**Response (201):**
```json
{
  "cliente": { ... }
}
```

---

## 🛒 Pedidos

### GET `/pedidos`
Listar pedidos

**Query Parameters:**
- `status` (opcional): `Pendente`, `Confirmado`, `Preparando`, `Pronto`, `Em Rota`, `Entregue`, `Cancelado`
- `cliente_id` (opcional): Filtrar por cliente

**Response (200):**
```json
{
  "pedidos": [
    {
      "id": "uuid",
      "numero_pedido": "PED-1234567890",
      "tipo_pedido": "B2B",
      "data_pedido": "2024-01-15T10:00:00Z",
      "data_entrega_prevista": "2024-01-17",
      "status": "Confirmado",
      "valor_total": 450.00,
      "forma_pagamento": "Boleto",
      "cliente": {
        "nome": "Restaurante Sabor & Arte",
        "tipo_cliente": "B2B"
      },
      "vendedor": {
        "nome": "Fabio Silva"
      },
      "itens": [
        {
          "id": "uuid",
          "quantidade_kg": 10.0,
          "preco_unitario": 45.0,
          "subtotal": 450.0,
          "produto": {
            "nome": "Shiitake"
          }
        }
      ]
    }
  ]
}
```

---

### POST `/pedidos`
Criar novo pedido

**Request:**
```json
{
  "cliente_id": "uuid",
  "tipo_pedido": "B2B",
  "data_entrega_prevista": "2024-01-17",
  "itens": [
    {
      "produto_id": "uuid",
      "quantidade_kg": 10.0,
      "preco_unitario": 45.0
    },
    {
      "produto_id": "uuid",
      "quantidade_kg": 5.0,
      "preco_unitario": 35.0
    }
  ]
}
```

**Response (201):**
```json
{
  "pedido": { ... }
}
```

**Nota:** O número do pedido é gerado automaticamente e o valor total é calculado.

---

### PUT `/pedidos/:id/status`
Atualizar status do pedido

**Request:**
```json
{
  "status": "Em Rota"
}
```

**Response (200):**
```json
{
  "pedido": { ... }
}
```

---

## 🚚 Entregas

### GET `/entregas`
Listar entregas

**Query Parameters:**
- `motorista_id` (opcional): Filtrar por motorista
- `status` (opcional): `Pendente`, `Em Rota`, `Entregue`, `Problema`, `Cancelada`

**Response (200):**
```json
{
  "entregas": [
    {
      "id": "uuid",
      "veiculo": "VAN-001",
      "data_saida": "2024-01-17T08:00:00Z",
      "data_entrega": "2024-01-17T11:30:00Z",
      "status": "Entregue",
      "endereco_entrega": "Rua das Flores, 123, São Paulo - SP",
      "latitude": -23.550520,
      "longitude": -46.633308,
      "distancia_km": 15.5,
      "pedido": {
        "numero_pedido": "PED-1234567890",
        "cliente": {
          "nome": "Restaurante Sabor & Arte"
        }
      },
      "motorista": {
        "nome": "Carlos Santos"
      }
    }
  ]
}
```

---

### POST `/entregas`
Criar nova entrega

**Request:**
```json
{
  "pedido_id": "uuid",
  "motorista_id": "uuid",
  "veiculo": "VAN-001",
  "endereco_entrega": "Rua das Flores, 123, São Paulo - SP",
  "latitude": -23.550520,
  "longitude": -46.633308,
  "distancia_km": 15.5
}
```

**Response (201):**
```json
{
  "entrega": { ... }
}
```

---

### PUT `/entregas/:id`
Atualizar entrega

**Request:**
```json
{
  "status": "Entregue",
  "data_entrega": "2024-01-17T11:30:00Z",
  "assinatura_url": "https://...",
  "foto_comprovante_url": "https://..."
}
```

**Response (200):**
```json
{
  "entrega": { ... }
}
```

---

## 💰 Financeiro

### GET `/financeiro`
Listar transações financeiras

**Query Parameters:**
- `tipo` (opcional): `Receita` ou `Despesa`
- `data_inicio` (opcional): Data inicial (YYYY-MM-DD)
- `data_fim` (opcional): Data final (YYYY-MM-DD)

**Response (200):**
```json
{
  "transacoes": [
    {
      "id": "uuid",
      "tipo": "Receita",
      "categoria": "Venda B2B",
      "descricao": "Venda para Restaurante Sabor & Arte",
      "valor": 450.00,
      "data_transacao": "2024-01-17",
      "forma_pagamento": "Boleto",
      "status": "Confirmado",
      "pedido_id": "uuid"
    }
  ]
}
```

---

### POST `/financeiro`
Criar transação financeira

**Request:**
```json
{
  "tipo": "Receita",
  "categoria": "Venda B2B",
  "descricao": "Venda para Restaurante Sabor & Arte",
  "valor": 450.00,
  "data_transacao": "2024-01-17",
  "forma_pagamento": "Boleto",
  "pedido_id": "uuid"
}
```

**Response (201):**
```json
{
  "transacao": { ... }
}
```

---

## 📹 Câmeras

### GET `/cameras`
Listar câmeras de segurança

**Response (200):**
```json
{
  "cameras": [
    {
      "id": "uuid",
      "nome": "Câmera Sala 1",
      "localizacao": "Sala de Cultivo 1",
      "tipo": "Sala de Cultivo",
      "url_stream": "rtsp://...",
      "status": "Ativa",
      "resolucao": "1080p",
      "gravacao_ativa": true
    }
  ]
}
```

---

## 👤 Usuários

### GET `/usuarios`
Listar usuários do sistema

**Query Parameters:**
- `tipo` (opcional): `admin`, `producao`, `motorista`, `vendas`, `cliente`

**Response (200):**
```json
{
  "usuarios": [
    {
      "id": "uuid",
      "nome": "Fabio Silva",
      "email": "fabio@shroombros.com",
      "telefone": "(11) 98765-4321",
      "tipo_usuario": "admin",
      "avatar_url": null,
      "ativo": true
    }
  ]
}
```

---

## ❌ Tratamento de Erros

Todas as rotas retornam erros no formato:

```json
{
  "error": "Mensagem de erro detalhada"
}
```

**Códigos HTTP:**
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Erro de validação
- `401` - Não autorizado
- `500` - Erro interno do servidor

---

## 🔧 Exemplo de Uso no Frontend

```typescript
import { fetchServer } from './utils/supabase/client';

// Buscar lotes
const { lotes } = await fetchServer('/lotes?status=Em Cultivo');

// Criar colheita
const { colheita } = await fetchServer('/colheitas', {
  method: 'POST',
  body: JSON.stringify({
    lote_id: 'uuid',
    quantidade_kg: 45.5,
    qualidade: 'Premium'
  })
});

// Atualizar pedido
const { pedido } = await fetchServer('/pedidos/uuid/status', {
  method: 'PUT',
  body: JSON.stringify({ status: 'Entregue' })
});
```

---

**🍄 Feito com amor pela Shroom Bros**
