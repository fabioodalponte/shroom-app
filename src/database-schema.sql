-- ============================================
-- SHROOM BROS - DATABASE SCHEMA
-- Sistema de Gestão de Produção de Cogumelos
-- ============================================

-- IMPORTANTE: Execute este SQL no Supabase Dashboard
-- Dashboard > SQL Editor > New Query > Cole e Execute

-- ============================================
-- 1. TABELA DE USUÁRIOS (integrada com auth)
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  telefone VARCHAR(20),
  tipo_usuario VARCHAR(50) NOT NULL CHECK (tipo_usuario IN ('admin', 'producao', 'motorista', 'vendas', 'cliente')),
  avatar_url TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. TABELA DE CLIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('B2B', 'B2C')),
  cpf_cnpj VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  telefone VARCHAR(20),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  cep VARCHAR(10),
  observacoes TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. TABELA DE PRODUTOS (Tipos de Cogumelos)
-- ============================================
CREATE TABLE IF NOT EXISTS produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  variedade VARCHAR(100),
  peso_medio_g DECIMAL(10,2),
  preco_kg DECIMAL(10,2),
  tempo_cultivo_dias INTEGER,
  temperatura_ideal_min DECIMAL(5,2),
  temperatura_ideal_max DECIMAL(5,2),
  umidade_ideal_min DECIMAL(5,2),
  umidade_ideal_max DECIMAL(5,2),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. TABELA DE LOTES
-- ============================================
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_lote VARCHAR(50) UNIQUE NOT NULL,
  produto_id UUID REFERENCES produtos(id),
  data_inicio DATE NOT NULL,
  data_previsao_colheita DATE,
  quantidade_inicial INTEGER,
  unidade VARCHAR(20) DEFAULT 'kg',
  status VARCHAR(50) DEFAULT 'Em Cultivo' CHECK (status IN ('Em Cultivo', 'Pronto', 'Colhido', 'Finalizado')),
  sala VARCHAR(50),
  prateleira VARCHAR(50),
  temperatura_atual DECIMAL(5,2),
  umidade_atual DECIMAL(5,2),
  observacoes TEXT,
  responsavel_id UUID REFERENCES usuarios(id),
  qr_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. TABELA DE COLHEITAS
-- ============================================
CREATE TABLE IF NOT EXISTS colheitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  data_colheita TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  quantidade_kg DECIMAL(10,2) NOT NULL,
  qualidade VARCHAR(20) CHECK (qualidade IN ('Premium', 'Padrão', 'Segunda')),
  responsavel_id UUID REFERENCES usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. TABELA DE ESTOQUE
-- ============================================
CREATE TABLE IF NOT EXISTS estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES produtos(id),
  lote_id UUID REFERENCES lotes(id),
  quantidade_kg DECIMAL(10,2) NOT NULL,
  qualidade VARCHAR(20) CHECK (qualidade IN ('Premium', 'Padrão', 'Segunda')),
  data_entrada TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_validade DATE,
  localizacao VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Disponível' CHECK (status IN ('Disponível', 'Reservado', 'Vendido', 'Descartado')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. TABELA DE PEDIDOS
-- ============================================
CREATE TABLE IF NOT EXISTS pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido VARCHAR(50) UNIQUE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  tipo_pedido VARCHAR(20) NOT NULL CHECK (tipo_pedido IN ('B2B', 'B2C')),
  data_pedido TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_entrega_prevista DATE,
  status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Preparando', 'Pronto', 'Em Rota', 'Entregue', 'Cancelado')),
  valor_total DECIMAL(10,2) DEFAULT 0,
  forma_pagamento VARCHAR(50),
  observacoes TEXT,
  vendedor_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. TABELA DE ITENS DO PEDIDO
-- ============================================
CREATE TABLE IF NOT EXISTS itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  estoque_id UUID REFERENCES estoque(id),
  quantidade_kg DECIMAL(10,2) NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 9. TABELA DE ENTREGAS/LOGÍSTICA
-- ============================================
CREATE TABLE IF NOT EXISTS entregas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES pedidos(id) ON DELETE CASCADE,
  motorista_id UUID REFERENCES usuarios(id),
  veiculo VARCHAR(50),
  data_saida TIMESTAMP WITH TIME ZONE,
  data_entrega TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Em Rota', 'Entregue', 'Problema', 'Cancelada')),
  endereco_entrega TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  distancia_km DECIMAL(10,2),
  observacoes TEXT,
  assinatura_url TEXT,
  foto_comprovante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. TABELA DE CÂMERAS DE SEGURANÇA
-- ============================================
CREATE TABLE IF NOT EXISTS cameras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  localizacao VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) CHECK (tipo IN ('Sala de Cultivo', 'Estoque', 'Entrada', 'Expedição')),
  url_stream TEXT,
  status VARCHAR(20) DEFAULT 'Ativa' CHECK (status IN ('Ativa', 'Inativa', 'Manutenção')),
  resolucao VARCHAR(20),
  gravacao_ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 11. TABELA FINANCEIRO
-- ============================================
CREATE TABLE IF NOT EXISTS financeiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
  categoria VARCHAR(100) NOT NULL,
  descricao TEXT,
  valor DECIMAL(10,2) NOT NULL,
  data_transacao DATE NOT NULL,
  pedido_id UUID REFERENCES pedidos(id),
  forma_pagamento VARCHAR(50),
  status VARCHAR(50) DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado')),
  responsavel_id UUID REFERENCES usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 12. TABELA DE SENSORES IOT (Opcional)
-- ============================================
CREATE TABLE IF NOT EXISTS leituras_sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID REFERENCES lotes(id) ON DELETE CASCADE,
  temperatura DECIMAL(5,2),
  umidade DECIMAL(5,2),
  co2_ppm INTEGER,
  luminosidade_lux INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lotes_status ON lotes(status);
CREATE INDEX IF NOT EXISTS idx_lotes_codigo ON lotes(codigo_lote);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_colheitas_lote ON colheitas(lote_id);
CREATE INDEX IF NOT EXISTS idx_estoque_produto ON estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_entregas_motorista ON entregas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_data ON financeiro(data_transacao);

-- ============================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON produtos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lotes_updated_at BEFORE UPDATE ON lotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estoque_updated_at BEFORE UPDATE ON estoque
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================

-- Habilitar RLS nas tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colheitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE entregas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE financeiro ENABLE ROW LEVEL SECURITY;

-- Política: Usuários autenticados podem ver todos os registros
CREATE POLICY "Usuários autenticados podem ver tudo" ON usuarios
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver clientes" ON clientes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver produtos" ON produtos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver lotes" ON lotes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver colheitas" ON colheitas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver estoque" ON estoque
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver pedidos" ON pedidos
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver itens" ON itens_pedido
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver entregas" ON entregas
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver cameras" ON cameras
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuários autenticados podem ver financeiro" ON financeiro
    FOR SELECT TO authenticated USING (true);

-- Política: Usuários autenticados podem inserir/atualizar (depois refinamos por role)
CREATE POLICY "Usuários autenticados podem inserir" ON clientes
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar clientes" ON clientes
    FOR UPDATE TO authenticated USING (true);

-- ============================================
-- DADOS INICIAIS (SEED)
-- ============================================

-- Inserir produtos padrão
INSERT INTO produtos (nome, descricao, variedade, preco_kg, tempo_cultivo_dias, temperatura_ideal_min, temperatura_ideal_max, umidade_ideal_min, umidade_ideal_max) VALUES
('Shiitake', 'Cogumelo Shiitake Premium', 'Lentinula edodes', 45.00, 60, 18, 24, 75, 85),
('Shimeji Branco', 'Shimeji Branco Fresco', 'Hypsizygus marmoreus', 35.00, 45, 15, 20, 80, 90),
('Shimeji Preto', 'Shimeji Preto Gourmet', 'Hypsizygus ulmarius', 38.00, 45, 15, 20, 80, 90),
('Cogumelo Paris', 'Champignon de Paris', 'Agaricus bisporus', 25.00, 30, 16, 22, 75, 85),
('Cogumelo Ostra', 'Pleurotus Premium', 'Pleurotus ostreatus', 30.00, 35, 20, 26, 80, 90)
ON CONFLICT DO NOTHING;

-- Inserir tipos de câmeras
INSERT INTO cameras (nome, localizacao, tipo, status, resolucao) VALUES
('Câmera Sala 1', 'Sala de Cultivo 1', 'Sala de Cultivo', 'Ativa', '1080p'),
('Câmera Sala 2', 'Sala de Cultivo 2', 'Sala de Cultivo', 'Ativa', '1080p'),
('Câmera Estoque', 'Área de Estoque Principal', 'Estoque', 'Ativa', '1080p'),
('Câmera Entrada', 'Portão de Entrada', 'Entrada', 'Ativa', '4K'),
('Câmera Expedição', 'Área de Expedição', 'Expedição', 'Ativa', '1080p')
ON CONFLICT DO NOTHING;

-- ============================================
-- FINALIZADO!
-- ============================================
-- Execute este script no Supabase Dashboard
-- Depois, vamos criar as rotas da API
