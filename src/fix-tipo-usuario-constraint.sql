-- ============================================
-- FIX: Corrigir constraint de tipo_usuario
-- ============================================
-- Execute este script para permitir o valor 'Motorista'

-- ============================================
-- 1. VERIFICAR CONSTRAINT ATUAL
-- ============================================

-- Ver todas as constraints da tabela usuarios
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'usuarios'::regclass
AND contype = 'c';  -- 'c' = CHECK constraint

-- ============================================
-- 2. REMOVER CONSTRAINT ANTIGA
-- ============================================

-- Remover a constraint que está bloqueando
ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

-- ============================================
-- 3. ADICIONAR NOVA CONSTRAINT COM TODOS OS TIPOS
-- ============================================

-- Permitir todos os tipos de usuário necessários
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_tipo_usuario_check 
    CHECK (tipo_usuario IN (
        'Admin',
        'Gerente',
        'Funcionário',
        'Motorista',        -- ✅ Agora permite Motorista
        'Vendedor',
        'Produção',
        'Logística'
    ));

-- ============================================
-- 4. VERIFICAR SE FOI APLICADO
-- ============================================

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'usuarios'::regclass
AND contype = 'c'
AND conname = 'usuarios_tipo_usuario_check';

-- ============================================
-- 5. TESTE: Inserir motorista
-- ============================================

-- Descomente para testar
/*
INSERT INTO usuarios (nome, email, telefone, tipo_usuario, ativo)
VALUES ('Motorista Teste', 'teste.motorista@shroombros.com', '(11) 99999-9999', 'Motorista', true)
RETURNING id, nome, email, tipo_usuario;
*/

-- ============================================
-- ✅ CORREÇÃO CONCLUÍDA!
-- ============================================

SELECT '✅ Constraint atualizada! Agora aceita tipo_usuario = Motorista' as status;
