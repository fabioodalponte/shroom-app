# 🚚 Setup do Sistema de Logística - Shroom Bros

## ⚠️ ATENÇÃO: Execute estas etapas para corrigir os erros

### 🔴 Erro Atual:
```
"Could not find a relationship between 'pedidos' and 'pedidos_itens'"
```

### ✅ Solução: Execute o script corrigido

---

### 📋 Passo 1: Acessar o Supabase SQL Editor

1. Acesse o dashboard do seu projeto Supabase
2. No menu lateral, clique em **"SQL Editor"**
3. Clique em **"New query"**

### 📝 Passo 2: Executar o Script de Correção

1. Abra o arquivo `/fix-foreign-keys.sql` deste projeto
2. **Copie TODO o conteúdo** do arquivo
3. **Cole** no SQL Editor do Supabase
4. Clique em **"Run"** (ou pressione Ctrl/Cmd + Enter)
5. Aguarde ~10 segundos

⚠️ **IMPORTANTE:** Este script irá:
- Recriar as tabelas `rotas` e `rotas_paradas` (você perderá dados existentes)
- Corrigir todas as foreign keys
- Criar tabelas faltantes se necessário
- Configurar RLS e políticas de acesso

### ✅ Passo 3: Verificar a Criação

Após executar o script, você deve ver na última linha:

```
✓ Script executado com sucesso! Verifique as foreign keys acima.
```

E uma tabela mostrando todas as foreign keys criadas:

```
| table_name      | column_name  | foreign_table_name | foreign_column_name |
|-----------------|--------------|--------------------|--------------------|
| rotas           | motorista_id | usuarios           | id                 |
| rotas_paradas   | rota_id      | rotas              | id                 |
| rotas_paradas   | pedido_id    | pedidos            | id                 |
| pedidos         | cliente_id   | clientes           | id                 |
| pedidos         | vendedor_id  | usuarios           | id                 |
| itens_pedido    | pedido_id    | pedidos            | id                 |
```

### 🧪 Passo 4: (Opcional) Criar Dados de Teste

Se quiser criar dados de exemplo, descomente a seção 9 do arquivo SQL e execute novamente:

```sql
-- Remova os /* e */ para descomentar
INSERT INTO usuarios (nome, email, telefone, tipo_usuario, cpf, cnh, ativo)
VALUES 
    ('Carlos Silva', 'carlos@shroombros.com', '(11) 98765-4321', 'Motorista', '123.456.789-00', '12345678900', true),
    ('João Santos', 'joao@shroombros.com', '(11) 98765-4322', 'Motorista', '987.654.321-00', '09876543211', true);
```

---

## 🎯 O que foi criado:

### Tabelas:
- ✅ `rotas` - Rotas de entrega com motorista, data e status
- ✅ `rotas_paradas` - Paradas individuais de cada rota

### Campos adicionados:
- ✅ `usuarios.tipo_usuario` - Identifica motoristas
- ✅ `usuarios.cpf` - CPF do motorista
- ✅ `usuarios.cnh` - CNH do motorista
- ✅ `clientes.bairro` - Para agrupar rotas por região
- ✅ `clientes.cidade` - Para agrupar rotas por cidade

### Recursos:
- ✅ Índices para performance
- ✅ Triggers para updated_at
- ✅ Row Level Security (RLS)
- ✅ Foreign Keys e Constraints

---

## 🚀 Após executar o script:

1. Volte para o app Figma Make
2. Recarregue a página (F5)
3. Acesse `/motoristas` e cadastre motoristas
4. Acesse `/logistica` e crie sua primeira rota!

---

## 🔍 Troubleshooting

### Erro: "relation already exists"
**Solução:** As tabelas já existem! Pode ignorar este erro.

### Erro: "permission denied"
**Solução:** Certifique-se de estar usando o SQL Editor do Supabase com permissões de admin.

### Erro: "foreign key constraint"
**Solução:** Execute o script completo desde o início. Ele cria as dependências na ordem correta.

---

## 📞 Suporte

Se tiver problemas, verifique:
1. ✅ Script executado completamente?
2. ✅ Tabelas `usuarios` e `pedidos` já existem?
3. ✅ Políticas RLS configuradas?

**Tudo pronto! O sistema de logística está 100% operacional!** 🍄✨