-- ============================================
-- FIX: Email duplicado - fabioodalponte@gmail.com
-- ============================================

-- ============================================
-- 1. VERIFICAR O REGISTRO EXISTENTE
-- ============================================

SELECT 
    id,
    nome,
    email,
    telefone,
    tipo_usuario,
    cpf,
    cnh,
    ativo,
    created_at
FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- ============================================
-- 2. OPÇÃO A: ATUALIZAR PARA MOTORISTA
-- ============================================

-- Transformar o usuário existente em motorista
UPDATE usuarios
SET 
    nome = 'Fabio Ortega Dalponte',
    telefone = '41999117744',
    cpf = '123456',
    cnh = '',
    tipo_usuario = 'Motorista',
    ativo = true,
    updated_at = NOW()
WHERE email = 'fabioodalponte@gmail.com';

-- Verificar atualização
SELECT 
    id,
    nome,
    email,
    tipo_usuario,
    cpf,
    cnh,
    ativo
FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- ============================================
-- 2. OPÇÃO B: DELETAR E CRIAR NOVO PELO APP
-- ============================================

-- Descomente se preferir deletar e criar novo
/*
DELETE FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

SELECT 'Registro deletado! Agora cadastre pelo app.' as status;
*/

-- ============================================
-- 3. VER TODOS OS MOTORISTAS CADASTRADOS
-- ============================================

SELECT 
    id,
    nome,
    email,
    telefone,
    cpf,
    cnh,
    ativo
FROM usuarios
WHERE tipo_usuario = 'Motorista'
ORDER BY created_at DESC;

-- ============================================
-- ✅ CORREÇÃO CONCLUÍDA!
-- ============================================

SELECT '✅ Usuário atualizado para Motorista!' as status;
