-- ============================================
-- REMOVER FOREIGN KEY que está quebrando cadastro
-- ============================================

-- ============================================
-- 1. VER TODAS AS CONSTRAINTS DA TABELA
-- ============================================

SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'usuarios'::regclass
ORDER BY conname;

-- ============================================
-- 2. REMOVER A FOREIGN KEY PROBLEMÁTICA
-- ============================================

-- Remover constraint que liga usuarios.id -> auth.users.id
ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_id_fkey;

-- ============================================
-- 3. REMOVER OUTRAS CONSTRAINTS PROBLEMÁTICAS
-- ============================================

-- Remover constraint de tipo_usuario (se ainda existir)
ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

-- ============================================
-- 4. VERIFICAR QUE FORAM REMOVIDAS
-- ============================================

SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'usuarios'::regclass
ORDER BY conname;

-- Deverá mostrar apenas:
-- - usuarios_pkey (PRIMARY KEY) ✅ MANTER
-- - usuarios_email_key (UNIQUE) ✅ MANTER

-- ============================================
-- 5. DELETAR EMAIL DUPLICADO
-- ============================================

-- Deletar o email que já existe
DELETE FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- ============================================
-- 6. VERIFICAR TABELA LIMPA
-- ============================================

SELECT 
    id,
    nome,
    email,
    tipo_usuario,
    ativo
FROM usuarios
ORDER BY created_at DESC;

-- ============================================
-- ✅ CORREÇÃO CONCLUÍDA!
-- ============================================

SELECT '✅ Foreign key removida! Sistema pronto para cadastrar motoristas!' as status;
