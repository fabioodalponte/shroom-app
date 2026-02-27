-- ==========================================
-- SOLUÇÃO SIMPLES: DELETAR USUÁRIO DUPLICADO
-- ==========================================
-- Esta é a solução mais simples e segura

-- 1. VERIFICAR SITUAÇÃO ATUAL
SELECT id, email, nome, tipo_usuario, created_at 
FROM usuarios 
WHERE email = 'fabioodalponte@gmail.com';

-- Se aparecer 1 ou mais usuários, vamos deletar TODOS eles
-- O sistema vai recriar automaticamente no próximo login

-- 2. DELETAR USUÁRIO(S) DUPLICADO(S)
DELETE FROM usuarios 
WHERE email = 'fabioodalponte@gmail.com';

-- 3. VERIFICAR SE FOI DELETADO
SELECT id, email, nome, tipo_usuario 
FROM usuarios 
WHERE email = 'fabioodalponte@gmail.com';

-- Deve retornar 0 linhas (vazio)

-- ==========================================
-- 4. PRÓXIMO PASSO:
-- ==========================================
-- Depois de executar este SQL:
-- 1. Faça logout no app (se estiver logado)
-- 2. Faça login novamente
-- 3. O sistema vai criar o usuário automaticamente com o ID correto
-- ==========================================
