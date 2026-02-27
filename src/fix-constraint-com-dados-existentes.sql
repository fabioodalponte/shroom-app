-- ============================================
-- FIX: Constraint com dados existentes
-- ============================================

-- ============================================
-- 1. VERIFICAR VALORES EXISTENTES
-- ============================================

-- Ver todos os valores de tipo_usuario que já existem
SELECT 
    tipo_usuario,
    COUNT(*) as total
FROM usuarios
GROUP BY tipo_usuario
ORDER BY total DESC;

-- ============================================
-- 2. REMOVER CONSTRAINT ANTIGA
-- ============================================

ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

-- ============================================
-- 3. ATUALIZAR REGISTROS COM VALORES NÃO PERMITIDOS
-- ============================================

-- Opção A: Atualizar NULL para 'Funcionário'
UPDATE usuarios
SET tipo_usuario = 'Funcionário'
WHERE tipo_usuario IS NULL;

-- Opção B: Atualizar valores vazios para 'Funcionário'
UPDATE usuarios
SET tipo_usuario = 'Funcionário'
WHERE tipo_usuario = '';

-- Opção C: Ver se tem outros valores estranhos
SELECT DISTINCT tipo_usuario
FROM usuarios
WHERE tipo_usuario NOT IN (
    'Admin',
    'Gerente',
    'Funcionário',
    'Motorista',
    'Vendedor',
    'Produção',
    'Logística'
)
OR tipo_usuario IS NULL;

-- ============================================
-- 4. ADICIONAR CONSTRAINT COM TODOS OS VALORES
-- ============================================

-- Incluir TODOS os valores que existem + os novos necessários
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_tipo_usuario_check 
    CHECK (tipo_usuario IN (
        'Admin',
        'Gerente',
        'Funcionário',
        'Motorista',
        'Vendedor',
        'Produção',
        'Logística',
        'funcionário',  -- minúscula (se existir)
        'admin',        -- minúscula (se existir)
        'gerente'       -- minúscula (se existir)
    ));

-- ============================================
-- 5. VERIFICAR SE FOI APLICADO
-- ============================================

SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'usuarios'::regclass
AND conname = 'usuarios_tipo_usuario_check';

-- ============================================
-- 6. VERIFICAR TIPOS ATUAIS
-- ============================================

SELECT 
    tipo_usuario,
    COUNT(*) as total
FROM usuarios
GROUP BY tipo_usuario
ORDER BY total DESC;

-- ============================================
-- ✅ CORREÇÃO CONCLUÍDA!
-- ============================================

SELECT '✅ Constraint atualizada considerando dados existentes!' as status;
