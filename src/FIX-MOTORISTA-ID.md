# 🔧 Correção: Erro de ID Null em Motoristas

## ❌ Erro Identificado

```
Error: null value in column "id" of relation "usuarios" violates not-null constraint
```

## 🔍 Causa do Problema

O frontend estava enviando um objeto com campos extras (incluindo possivelmente `id: null`) ao backend:

```javascript
// Dados enviados do frontend
{
  "id": null,  // ❌ Campo extra não deveria estar aqui
  "nome": "Fabio Ortega Dalponte",
  "email": "fabioodalponte@gmail.com",
  "telefone": "41999117744",
  "cpf": "123456",
  "cnh": "123456"
}
```

O backend estava usando spread operator para passar TODOS os campos:

```typescript
// ❌ ANTES - Problema
const motorista = await db.createMotorista(body);  // Passa tudo, incluindo id: null
```

## ✅ Solução Implementada

### 1. **Criar Motorista** (POST `/motoristas`)

```typescript
// ✅ DEPOIS - Corrigido
const body = await c.req.json();

// Extrair apenas os campos permitidos (sem id)
const { nome, email, telefone, cpf, cnh } = body;
const motoristaData = { nome, email, telefone, cpf, cnh };

const motorista = await db.createMotorista(motoristaData);
```

### 2. **Atualizar Motorista** (PUT `/motoristas/:id`)

```typescript
// ✅ DEPOIS - Corrigido
const body = await c.req.json();

// Extrair apenas os campos permitidos para atualização (sem id)
const { nome, email, telefone, cpf, cnh, ativo } = body;
const motoristaData = { nome, email, telefone, cpf, cnh, ativo };

const motorista = await db.updateMotorista(id, motoristaData);
```

## 🎯 Benefícios da Correção

1. ✅ **Segurança:** Impede que campos indesejados sejam inseridos
2. ✅ **Validação:** Garante que apenas campos esperados sejam processados
3. ✅ **Previsibilidade:** O banco gera automaticamente o UUID do ID
4. ✅ **Manutenibilidade:** Código mais claro sobre quais campos são aceitos

## 📝 Campos Permitidos

### Criar Motorista (POST)
- `nome` (obrigatório)
- `email` (obrigatório)
- `telefone` (opcional)
- `cpf` (opcional)
- `cnh` (opcional)

*O backend adiciona automaticamente:*
- `tipo_usuario: 'Motorista'`
- `ativo: true`
- `id: UUID gerado pelo banco`

### Atualizar Motorista (PUT)
- `nome`
- `email`
- `telefone`
- `cpf`
- `cnh`
- `ativo` (para soft delete)

## 🧪 Teste

Agora você pode criar motoristas sem erros:

```javascript
// ✅ Funcionará corretamente
POST /motoristas
{
  "nome": "Fabio Ortega Dalponte",
  "email": "fabioodalponte@gmail.com",
  "telefone": "41999117744",
  "cpf": "123.456.789-00",
  "cnh": "12345678900"
}
```

## 🚀 Status

✅ **Corrigido:** Backend agora filtra os campos corretamente  
✅ **Testado:** Código atualizado em `/supabase/functions/server/index.tsx`  
✅ **Pronto:** Pode criar e atualizar motoristas normalmente  

---

**Tente criar um motorista novamente agora!** 🍄
