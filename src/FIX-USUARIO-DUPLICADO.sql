-- ==========================================
-- FIX: USUÁRIO DUPLICADO
-- ==========================================
-- Problema: Usuário existe na auth.users mas tem ID diferente na tabela usuarios
-- Este script corrige o problema

-- 1. VERIFICAR SITUAÇÃO ATUAL
-- Execute este SELECT primeiro para ver a situação:

SELECT 
  'Tabela usuarios' as origem,
  id, 
  email, 
  nome, 
  tipo_usuario,
  created_at
FROM usuarios 
WHERE email = 'fabioodalponte@gmail.com'

UNION ALL

SELECT 
  'auth.users' as origem,
  id::text as id,
  email,
  raw_user_meta_data->>'name' as nome,
  'N/A' as tipo_usuario,
  created_at::timestamptz
FROM auth.users 
WHERE email = 'fabioodalponte@gmail.com';

-- ==========================================
-- 2. SOLUÇÃO: Atualizar o ID na tabela usuarios para corresponder ao ID do auth.users
-- ==========================================

-- ATENÇÃO: Isso pode quebrar foreign keys. Execute apenas se necessário!

BEGIN;

-- Passo 1: Buscar o ID correto do auth.users
DO $$
DECLARE
  auth_user_id uuid;
  old_user_id uuid;
BEGIN
  -- Pegar o ID do usuário no auth.users
  SELECT id INTO auth_user_id 
  FROM auth.users 
  WHERE email = 'fabioodalponte@gmail.com' 
  LIMIT 1;
  
  -- Pegar o ID antigo na tabela usuarios
  SELECT id INTO old_user_id 
  FROM usuarios 
  WHERE email = 'fabioodalponte@gmail.com' 
  LIMIT 1;
  
  RAISE NOTICE 'ID no auth.users: %', auth_user_id;
  RAISE NOTICE 'ID antigo na usuarios: %', old_user_id;
  
  -- Se os IDs são diferentes, atualizar
  IF auth_user_id IS NOT NULL AND old_user_id IS NOT NULL AND auth_user_id != old_user_id THEN
    
    -- Atualizar foreign keys nas tabelas relacionadas (se existirem)
    
    -- Atualizar pedidos.vendedor_id
    UPDATE pedidos 
    SET vendedor_id = auth_user_id 
    WHERE vendedor_id = old_user_id;
    
    -- Atualizar lotes.responsavel_id
    UPDATE lotes 
    SET responsavel_id = auth_user_id 
    WHERE responsavel_id = old_user_id;
    
    -- Atualizar colheitas.responsavel_id
    UPDATE colheitas 
    SET responsavel_id = auth_user_id 
    WHERE responsavel_id = old_user_id;
    
    -- Atualizar rotas.motorista_id
    UPDATE rotas 
    SET motorista_id = auth_user_id 
    WHERE motorista_id = old_user_id;
    
    -- Finalmente, atualizar o ID na tabela usuarios
    UPDATE usuarios 
    SET id = auth_user_id 
    WHERE id = old_user_id;
    
    RAISE NOTICE '✅ IDs sincronizados com sucesso!';
  ELSE
    RAISE NOTICE '⚠️ IDs já estão sincronizados ou usuário não encontrado';
  END IF;
  
END $$;

COMMIT;

-- ==========================================
-- 3. VERIFICAÇÃO PÓS-CORREÇÃO
-- ==========================================

SELECT 
  'Tabela usuarios' as origem,
  id, 
  email, 
  nome, 
  tipo_usuario
FROM usuarios 
WHERE email = 'fabioodalponte@gmail.com'

UNION ALL

SELECT 
  'auth.users' as origem,
  id::text as id,
  email,
  raw_user_meta_data->>'name' as nome,
  'N/A' as tipo_usuario
FROM auth.users 
WHERE email = 'fabioodalponte@gmail.com';

-- Os IDs devem ser IGUAIS agora!
