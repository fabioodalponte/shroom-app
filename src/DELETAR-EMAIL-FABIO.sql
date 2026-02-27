-- ============================================
-- DELETAR EMAIL DO FABIO
-- ============================================

-- 1. Ver o registro atual
SELECT 
    id, 
    nome, 
    email, 
    tipo_usuario, 
    ativo,
    created_at
FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- 2. DELETAR o registro
DELETE FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- 3. Confirmar que foi deletado
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Email deletado com sucesso! Agora pode cadastrar novamente.'
        ELSE '❌ Email ainda existe!'
    END as status
FROM usuarios
WHERE email = 'fabioodalponte@gmail.com';

-- ============================================
-- ✅ PRONTO! Agora cadastre pelo app
-- ============================================
