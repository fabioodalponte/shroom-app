-- ============================================
-- FIX: Corrigir Foreign Keys e Schema
-- ============================================
-- Execute este script se ainda houver erros de relacionamento

-- ============================================
-- 1. VERIFICAR TABELAS EXISTENTES
-- ============================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE columns.table_name = tables.table_name) as total_colunas
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('usuarios', 'pedidos', 'clientes', 'rotas', 'rotas_paradas', 'itens_pedido', 'pedidos_itens')
ORDER BY table_name;

-- ============================================
-- 2. CRIAR TABELA usuarios SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    telefone TEXT,
    tipo_usuario TEXT DEFAULT 'Funcionário',
    cpf TEXT,
    cnh TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRÍTICO: Garantir que a coluna id tem DEFAULT gen_random_uuid()
ALTER TABLE usuarios 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Remover constraint antiga que pode estar bloqueando
ALTER TABLE usuarios 
    DROP CONSTRAINT IF EXISTS usuarios_tipo_usuario_check;

-- Adicionar constraint com todos os tipos permitidos
ALTER TABLE usuarios
    ADD CONSTRAINT usuarios_tipo_usuario_check 
    CHECK (tipo_usuario IN (
        'Admin',
        'Gerente',
        'Funcionário',
        'Motorista',
        'Vendedor',
        'Produção',
        'Logística'
    ));

-- Adicionar índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);

-- ============================================
-- 3. CRIAR TABELA clientes SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    email TEXT,
    telefone TEXT,
    endereco TEXT,
    bairro TEXT,
    cidade TEXT,
    tipo_cliente TEXT DEFAULT 'B2C',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar índices
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_clientes_tipo ON clientes(tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_clientes_ativo ON clientes(ativo);

-- ============================================
-- 4. CRIAR TABELA pedidos SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS pedidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_pedido TEXT UNIQUE NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE RESTRICT,
    vendedor_id UUID REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_pedido TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente',
    valor_total NUMERIC(10, 2) DEFAULT 0,
    data_pedido TIMESTAMPTZ DEFAULT NOW(),
    data_entrega_prevista DATE,
    data_entrega_real TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar índices
CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_tipo ON pedidos(tipo_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_pedido ON pedidos(data_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega_prevista ON pedidos(data_entrega_prevista);
CREATE INDEX IF NOT EXISTS idx_pedidos_data_entrega_real ON pedidos(data_entrega_real);

-- ============================================
-- 5. CRIAR TABELA itens_pedido SE NÃO EXISTIR
-- ============================================

CREATE TABLE IF NOT EXISTS itens_pedido (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id UUID,
    quantidade_kg NUMERIC(10, 2) NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_itens_pedido_pedido ON itens_pedido(pedido_id);

-- ============================================
-- 6. RECRIAR TABELA rotas COM FOREIGN KEYS CORRETAS
-- ============================================

-- Primeiro, dropar a tabela rotas_paradas (depende de rotas)
DROP TABLE IF EXISTS rotas_paradas CASCADE;

-- Dropar e recriar rotas
DROP TABLE IF EXISTS rotas CASCADE;

CREATE TABLE rotas (
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
CREATE INDEX idx_rotas_motorista ON rotas(motorista_id);
CREATE INDEX idx_rotas_data ON rotas(data_rota);
CREATE INDEX idx_rotas_status ON rotas(status);
CREATE INDEX idx_rotas_codigo ON rotas(codigo_rota);

-- ============================================
-- 7. RECRIAR TABELA rotas_paradas
-- ============================================

CREATE TABLE rotas_paradas (
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

-- Índices
CREATE INDEX idx_rotas_paradas_rota ON rotas_paradas(rota_id);
CREATE INDEX idx_rotas_paradas_pedido ON rotas_paradas(pedido_id);
CREATE INDEX idx_rotas_paradas_status ON rotas_paradas(status);
CREATE INDEX idx_rotas_paradas_ordem ON rotas_paradas(rota_id, ordem);

-- ============================================
-- 8. HABILITAR RLS
-- ============================================

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rotas_paradas ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas para desenvolvimento
DROP POLICY IF EXISTS "Permitir acesso completo" ON usuarios;
CREATE POLICY "Permitir acesso completo"
    ON usuarios FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo" ON clientes;
CREATE POLICY "Permitir acesso completo"
    ON clientes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo" ON pedidos;
CREATE POLICY "Permitir acesso completo"
    ON pedidos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo" ON itens_pedido;
CREATE POLICY "Permitir acesso completo"
    ON itens_pedido FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo" ON rotas;
CREATE POLICY "Permitir acesso completo"
    ON rotas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso completo" ON rotas_paradas;
CREATE POLICY "Permitir acesso completo"
    ON rotas_paradas FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 9. INSERIR DADOS DE EXEMPLO (OPCIONAL)
-- ============================================

-- Descomente para criar dados de exemplo

/*
-- Inserir usuário admin
INSERT INTO usuarios (nome, email, tipo_usuario, ativo)
VALUES ('Admin', 'admin@shroombros.com', 'Admin', true)
ON CONFLICT (email) DO NOTHING;

-- Inserir motoristas de exemplo
INSERT INTO usuarios (nome, email, telefone, tipo_usuario, cpf, cnh, ativo)
VALUES 
    ('Carlos Silva', 'carlos@shroombros.com', '(11) 98765-4321', 'Motorista', '123.456.789-00', '12345678900', true),
    ('João Santos', 'joao@shroombros.com', '(11) 98765-4322', 'Motorista', '987.654.321-00', '09876543211', true)
ON CONFLICT (email) DO NOTHING;

-- Inserir cliente de exemplo
INSERT INTO clientes (nome, email, telefone, endereco, bairro, cidade, tipo_cliente, ativo)
VALUES 
    ('Restaurante Bella', 'contato@bella.com', '(11) 3333-4444', 'Rua das Flores, 123', 'Jardins', 'São Paulo', 'B2B', true),
    ('Maria Silva', 'maria@email.com', '(11) 99999-8888', 'Av. Paulista, 1000', 'Bela Vista', 'São Paulo', 'B2C', true)
ON CONFLICT DO NOTHING;
*/

-- ============================================
-- 10. VERIFICAR FOREIGN KEYS
-- ============================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('rotas', 'rotas_paradas', 'pedidos', 'itens_pedido')
ORDER BY tc.table_name;

-- ============================================
-- ✅ SCRIPT CONCLUÍDO!
-- ============================================

SELECT 'Script executado com sucesso! Verifique as foreign keys acima.' as status;