# 🍄 Shroom Bros - Instruções de Configuração

## ✅ ERROS CORRIGIDOS

### 1. ✅ Warning do React ref corrigido
- O componente `Button` agora usa `React.forwardRef`
- Não haverá mais warnings no console

### 2. ✅ Erro de login com mensagem melhorada
- Mensagens de erro mais claras e amigáveis
- Alerta na tela de login guiando usuários novos

---

## 🚀 PASSO A PASSO PARA COMEÇAR

### **Passo 1: Execute o SQL no Supabase** (SE AINDA NÃO FEZ)

1. Acesse: https://supabase.com/dashboard/project/zgxxbguoijamtbydcxrm
2. Clique em "SQL Editor" no menu lateral
3. Copie TODO o conteúdo do arquivo `/docs/schema.sql`
4. Cole no editor SQL
5. Clique em "Run" ou pressione Ctrl+Enter

**Isso criará:**
- 12 tabelas (usuarios, clientes, produtos, lotes, etc)
- Produtos de exemplo (Shiitake, Shimeji, Champignon)
- Relacionamentos e constraints

---

### **Passo 2: Crie sua Conta de Administrador**

1. Abra o app e vá para `/signup`
2. Preencha:
   - **Nome**: Seu nome (ex: Fabio)
   - **Email**: seu-email@exemplo.com
   - **Senha**: senha segura (mínimo 6 caracteres)
   - **Telefone**: (opcional)
   - **Tipo**: Administrador
3. Clique em "Cadastrar"
4. Aguarde a mensagem de sucesso

---

### **Passo 3: Faça Login**

1. Vá para `/login`
2. Use o **mesmo email e senha** que você acabou de criar
3. Clique em "Entrar"
4. Você será redirecionado para o Dashboard

---

### **Passo 4: Teste o Sistema**

Opção A - **Usar a Página de Debug** (RECOMENDADO):
```
1. Vá para /debug
2. Clique em "🔐 Testar Autenticação" → deve mostrar seu nome
3. Clique em "📦 Testar Produtos" → deve mostrar produtos cadastrados
4. Clique em "✨ Criar Lote Teste" → cria um lote automaticamente
5. Vá para /lotes → deve aparecer o lote criado!
```

Opção B - **Criar Lote Manualmente**:
```
1. Vá para /lotes
2. Clique em "Novo Lote"
3. Selecione um produto (ex: Shiitake Premium)
4. Preencha:
   - Sala: "Sala A"
   - Temperatura: 20
   - Umidade: 85
5. Clique em "Criar Lote"
6. Código do lote será gerado automaticamente (LT-2024-001)
```

---

## ❌ PROBLEMAS COMUNS E SOLUÇÕES

### ❌ "Email ou senha incorretos"
**Solução:**
- Você ainda NÃO tem conta! Clique em "Cadastre-se"
- Ou verifique se está usando o email/senha corretos

### ❌ "Nenhum produto cadastrado"
**Solução:**
- Você NÃO executou o SQL ainda
- Vá para o Supabase Dashboard → SQL Editor
- Execute o arquivo `/docs/schema.sql` COMPLETO

### ❌ "Erro ao criar lote"
**Solução:**
1. Abra o Console do navegador (F12)
2. Vá para a aba "Network"
3. Tente criar o lote novamente
4. Veja a requisição POST `/lotes`
5. Verifique o erro no Response

**Ou use a página /debug para diagnóstico automático!**

### ❌ "Unauthorized" ou "401"
**Solução:**
- Você não está logado ou o token expirou
- Faça logout e login novamente
- Verifique se o email está confirmado

---

## 🎯 PRÓXIMOS PASSOS APÓS O SETUP

1. ✅ Criar seus primeiros lotes de produção
2. ✅ Cadastrar clientes B2B (restaurantes)
3. ✅ Registrar colheitas
4. ✅ Criar pedidos de venda
5. ✅ Visualizar dashboard atualizado em tempo real

---

## 📊 ESTRUTURA DO BANCO DE DADOS

**Tabelas Criadas:**
- `usuarios` - Usuários do sistema (você!)
- `clientes` - Clientes B2B e B2C
- `produtos` - Tipos de cogumelos (Shiitake, Shimeji, etc)
- `lotes` - Lotes de produção
- `colheitas` - Registros de colheita
- `estoque` - Controle de estoque
- `pedidos` - Pedidos de venda
- `itens_pedido` - Itens dos pedidos
- `entregas` - Logística e entregas
- `cameras` - Câmeras de segurança
- `financeiro` - Transações financeiras
- `leituras_sensores` - Dados de sensores IoT

**Produtos de Exemplo Criados:**
- Shiitake Premium (R$ 55/kg)
- Shiitake Gourmet (R$ 48/kg)
- Champignon Branco (R$ 35/kg)
- Shimeji Branco (R$ 42/kg)
- Shimeji Preto (R$ 45/kg)
- Portobello (R$ 38/kg)

---

## 🔍 PRECISA DE AJUDA?

1. **Use a página /debug** para diagnóstico
2. Abra o Console do navegador (F12)
3. Veja os logs de erro
4. Verifique a aba Network
5. Me envie screenshots dos erros

---

## ✨ TUDO FUNCIONANDO?

Parabéns! Agora você pode:
- Gerenciar lotes de produção
- Controlar colheitas
- Monitorar estoque
- Criar pedidos
- Ver dashboard em tempo real
- Tudo com dados REAIS do Supabase!

🎉 **Bem-vindo ao Shroom Bros Management System!** 🍄
