-- ============================================
-- FIX URGENTE: Corrigir coluna ID da tabela usuarios
-- ============================================
-- Execute este script AGORA no Supabase SQL Editor

-- ============================================
-- 1. VERIFICAR ESTRUTURA ATUAL
-- ============================================

SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- ============================================
-- 2. ADICIONAR DEFAULT gen_random_uuid() NO ID
-- ============================================

-- Se a coluna id não tem DEFAULT, adicionar
ALTER TABLE usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ============================================
-- 3. VERIFICAR SE FOI APLICADO
-- ============================================

SELECT 
    column_name, 
    column_default
FROM information_schema.columns
WHERE table_name = 'usuarios' AND column_name = 'id';

-- ============================================
-- 4. TESTE: Inserir um motorista de teste
-- ============================================

-- Descomente as linhas abaixo para testar
/*
INSERT INTO usuarios (nome, email, telefone, tipo_usuario, ativo)
VALUES ('Motorista Teste', 'teste@shroombros.com', '(11) 99999-9999', 'Motorista', true)
RETURNING id, nome, email;
*/

-- ============================================
-- ✅ CORREÇÃO CONCLUÍDA!
-- ============================================

SELECT '✅ Script executado! A coluna id agora gera UUID automaticamente.' as status;
