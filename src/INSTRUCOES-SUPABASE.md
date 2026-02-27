# 🍄 Instruções para Configurar o Supabase - Shroom Bros

## ✅ Passo 1: Criar as Tabelas no Banco de Dados

1. Acesse seu projeto Supabase: https://supabase.com/dashboard/project/zgxxbguoijamtbydcxrm

2. No menu lateral, clique em **"SQL Editor"**

3. Clique em **"New Query"**

4. Abra o arquivo `/database-schema.sql` neste projeto

5. **Copie TODO o conteúdo** do arquivo `database-schema.sql`

6. **Cole no SQL Editor** do Supabase

7. Clique em **"Run"** (ou pressione Ctrl+Enter)

8. Aguarde a execução (pode levar alguns segundos)

9. Você verá uma mensagem de sucesso! ✅

---

## ✅ Passo 2: Verificar se as Tabelas foram Criadas

1. No menu lateral, clique em **"Table Editor"**

2. Você deve ver estas tabelas criadas:
   - ✅ usuarios
   - ✅ clientes
   - ✅ produtos
   - ✅ lotes
   - ✅ colheitas
   - ✅ estoque
   - ✅ pedidos
   - ✅ itens_pedido
   - ✅ entregas
   - ✅ cameras
   - ✅ financeiro
   - ✅ leituras_sensores

3. Clique em cada tabela para ver os campos criados

---

## ✅ Passo 3: Verificar Dados Iniciais (Seed)

1. Vá em **Table Editor** → **produtos**
2. Você deve ver 5 produtos já cadastrados:
   - Shiitake
   - Shimeji Branco
   - Shimeji Preto
   - Cogumelo Paris
   - Cogumelo Ostra

3. Vá em **Table Editor** → **cameras**
4. Você deve ver 5 câmeras já cadastradas

---

## ✅ Passo 4: Testar o Sistema

### 4.1. Criar sua primeira conta de Admin

1. Abra o aplicativo Shroom Bros
2. Clique em **"Não tem conta? Cadastre-se"**
3. Preencha os dados:
   - **Nome**: Fabio (ou seu nome)
   - **Email**: fabio@shroombros.com (ou seu email)
   - **Senha**: Fabio1243 (ou sua senha)
   - **Tipo de Usuário**: Administrador
4. Clique em **"Criar Conta"**

### 4.2. Fazer Login

1. Volte para a tela de login
2. Use o email e senha cadastrados
3. Você será redirecionado para o Dashboard! 🎉

---

## 📊 Estrutura do Banco de Dados

### Tabelas Principais:

**usuarios** → Equipe da Shroom Bros (Fabio, André, funcionários, motoristas)
- Integrado com Supabase Auth
- Tipos: admin, producao, motorista, vendas, cliente

**clientes** → Restaurantes B2B e consumidores B2C
- Armazena dados cadastrais
- CPF/CNPJ, endereço, etc

**produtos** → Tipos de cogumelos
- Shiitake, Shimeji, etc
- Preços, tempo de cultivo, condições ideais

**lotes** → Controle de produção
- Código de rastreabilidade
- Status, sala, temperatura, umidade
- QR Code para rastreamento

**colheitas** → Registros de colheita
- Vinculado ao lote
- Quantidade, qualidade, responsável

**estoque** → Controle de estoque
- Produtos disponíveis
- Qualidade (Premium, Padrão, Segunda)
- Status (Disponível, Reservado, Vendido)

**pedidos** → Vendas B2B e B2C
- Número do pedido
- Cliente, valor total, status

**itens_pedido** → Produtos do pedido
- Produto, quantidade, preço

**entregas** → Logística e rotas
- Motorista, veículo, status
- Localização GPS
- Comprovante de entrega

**financeiro** → Receitas e despesas
- Controle de fluxo de caixa
- Vinculado a pedidos

**cameras** → Câmeras de segurança
- Salas de cultivo, estoque, entrada

---

## 🔒 Segurança (RLS - Row Level Security)

As políticas de segurança estão configuradas para:
- ✅ Usuários autenticados podem ver todos os dados
- ✅ Usuários autenticados podem inserir/atualizar registros
- 🔐 Usuários não autenticados NÃO têm acesso

Futuramente podemos refinar as políticas por tipo de usuário (admin, produção, cliente, etc).

---

## 🚀 Próximos Passos

Agora que o banco está configurado, o sistema está pronto para:

1. ✅ **Cadastrar usuários** (equipe Shroom Bros)
2. ✅ **Criar lotes de produção**
3. ✅ **Registrar colheitas**
4. ✅ **Gerenciar estoque**
5. ✅ **Criar pedidos B2B/B2C**
6. ✅ **Controlar entregas**
7. ✅ **Monitorar financeiro**
8. ✅ **Rastreabilidade completa**

---

## 🐛 Resolução de Problemas

### Erro: "relation does not exist"
→ Você precisa executar o SQL no Supabase Dashboard primeiro

### Erro: "permission denied"
→ Verifique se você está logado com uma conta válida

### Erro no login: "Invalid login credentials"
→ Verifique se você criou a conta primeiro em /signup

### Tabelas não aparecem no Table Editor
→ Recarregue a página do Supabase Dashboard

---

## 📞 Suporte

Se tiver problemas, verifique:
1. Se executou o SQL completo
2. Se não houve erros na execução
3. Se as tabelas foram criadas corretamente
4. Se você está usando o projeto correto (zgxxbguoijamtbydcxrm)

---

**Feito com 🍄 por Shroom Bros**
