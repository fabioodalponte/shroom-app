-- ============================================
-- SOLUÇÃO RÁPIDA: Remover constraint e deixar sem validação
-- ============================================

-- 1. Ver quais valores existem
SELECT DISTINCT tipo_usuario, COUNT(*) as total
FROM usuarios
GROUP BY tipo_usuario;

-- 2. Remover a constraint (permite qualquer valor)
ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

-- 3. PRONTO! Agora aceita qualquer valor (inclusive 'Motorista')

-- 4. Verificar
SELECT '✅ Constraint removida! Agora aceita qualquer tipo_usuario' as status;

-- ============================================
-- ALTERNATIVA: Se quiser manter validação
-- ============================================

-- Descomente as linhas abaixo SE quiser adicionar constraint
-- que aceite TODOS os valores que já existem + Motorista

/*
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_tipo_usuario_check 
    CHECK (
        tipo_usuario IS NULL 
        OR tipo_usuario IN (
            'Admin',
            'Gerente', 
            'Funcionário',
            'Motorista',
            'Vendedor',
            'Produção',
            'Logística'
        )
    );
*/
