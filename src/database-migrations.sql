-- ============================================
-- MIGRATION: Sistema de Logística - Shroom Bros
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- Para acessar: Supabase Dashboard > SQL Editor > New Query

-- ============================================
-- 1. ADICIONAR CAMPOS NA TABELA USUARIOS (se não existirem)
-- ============================================

-- Adicionar coluna tipo_usuario se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'tipo_usuario'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN tipo_usuario TEXT DEFAULT 'Funcionário';
    END IF;
END $$;

-- Adicionar coluna cpf se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'cpf'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN cpf TEXT;
    END IF;
END $$;

-- Adicionar coluna cnh se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'usuarios' AND column_name = 'cnh'
    ) THEN
        ALTER TABLE usuarios ADD COLUMN cnh TEXT;
    END IF;
END $$;

-- ============================================
-- 2. CRIAR TABELA DE ROTAS
-- ============================================

CREATE TABLE IF NOT EXISTS rotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_rota TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    motorista_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    data_rota DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em Andamento', 'Concluída', 'Cancelada')),
    hora_inicio TIMESTAMPTZ,
    hora_fim TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rotas_motorista ON rotas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_rotas_data ON rotas(data_rota);
CREATE INDEX IF NOT EXISTS idx_rotas_status ON rotas(status);
CREATE INDEX IF NOT EXISTS idx_rotas_codigo ON rotas(codigo_rota);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rotas_updated_at ON rotas;
CREATE TRIGGER update_rotas_updated_at
    BEFORE UPDATE ON rotas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. CRIAR TABELA DE PARADAS DAS ROTAS
-- ============================================

CREATE TABLE IF NOT EXISTS rotas_paradas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rota_id UUID NOT NULL REFERENCES rotas(id) ON DELETE CASCADE,
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE RESTRICT,
    ordem INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em Trânsito', 'Entregue', 'Não Entregue')),
    hora_entrega TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(rota_id, pedido_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_rotas_paradas_rota ON rotas_paradas(rota_id);
CREATE INDEX IF NOT EXISTS idx_rotas_paradas_pedido ON rotas_paradas(pedido_id);
CREATE INDEX IF NOT EXISTS idx_rotas_paradas_status ON rotas_paradas(status);
CREATE INDEX IF NOT EXISTS idx_rotas_paradas_ordem ON rotas_paradas(rota_id, ordem);

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_rotas_paradas_updated_at ON rotas_paradas;
CREATE TRIGGER update_rotas_paradas_updated_at
    BEFORE UPDATE ON rotas_paradas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. ADICIONAR CAMPOS NA TABELA CLIENTES (se não existirem)
-- ============================================

-- Adicionar coluna bairro se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'bairro'
    ) THEN
        ALTER TABLE clientes ADD COLUMN bairro TEXT;
    END IF;
END $$;

-- Adicionar coluna cidade se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'cidade'
    ) THEN
        ALTER TABLE clientes ADD COLUMN cidade TEXT;
    END IF;
END $$;

-- ============================================
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas_paradas ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (permitir tudo para usuários autenticados)
DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON rotas;
CREATE POLICY "Permitir tudo para usuários autenticados"
    ON rotas FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir tudo para usuários autenticados" ON rotas_paradas;
CREATE POLICY "Permitir tudo para usuários autenticados"
    ON rotas_paradas FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 6. INSERIR MOTORISTAS DE EXEMPLO (OPCIONAL)
-- ============================================

-- Descomente as linhas abaixo se quiser criar motoristas de teste
/*
INSERT INTO usuarios (nome, email, telefone, tipo_usuario, cpf, cnh, ativo)
VALUES 
    ('Carlos Silva', 'carlos.motorista@shroombros.com', '(11) 98765-4321', 'Motorista', '123.456.789-00', '12345678900', true),
    ('João Santos', 'joao.motorista@shroombros.com', '(11) 98765-4322', 'Motorista', '987.654.321-00', '09876543211', true),
    ('Pedro Lima', 'pedro.motorista@shroombros.com', '(11) 98765-4323', 'Motorista', '456.789.123-00', '45678912344', true)
ON CONFLICT (email) DO NOTHING;
*/

-- ============================================
-- 7. VERIFICAR CRIAÇÃO DAS TABELAS
-- ============================================

-- Execute este SELECT para verificar se as tabelas foram criadas
SELECT 
    'rotas' as tabela,
    COUNT(*) as total_registros
FROM rotas
UNION ALL
SELECT 
    'rotas_paradas' as tabela,
    COUNT(*) as total_registros
FROM rotas_paradas;

-- ============================================
-- ✅ MIGRATION CONCLUÍDA!
-- ============================================
-- As tabelas foram criadas com sucesso!
-- Agora você pode usar o sistema de logística completo.
