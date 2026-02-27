-- ============================================
-- TABELAS PARA SISTEMA DE COMPRAS
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  tipo_fornecedor TEXT NOT NULL, -- 'Matéria-Prima', 'Embalagens', 'Utilidades', 'Serviços', etc.
  contato TEXT,
  email TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Compras
CREATE TABLE IF NOT EXISTS compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_compra TEXT UNIQUE NOT NULL,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, -- 'Substrato', 'Spawn/Inóculo', 'Embalagens', 'Energia', etc.
  tipo_custo TEXT NOT NULL CHECK (tipo_custo IN ('Fixo', 'Variável')),
  valor_total DECIMAL(10, 2) NOT NULL,
  data_compra DATE NOT NULL,
  data_vencimento DATE,
  status_pagamento TEXT NOT NULL DEFAULT 'Pendente', -- 'Pendente', 'Pago', 'Atrasado', 'Parcial'
  observacoes TEXT,
  itens JSONB DEFAULT '[]'::jsonb, -- Array de itens: [{ descricao, quantidade, unidade, valor_unitario }]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_fornecedores_tipo ON fornecedores(tipo_fornecedor);
CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);

CREATE INDEX IF NOT EXISTS idx_compras_fornecedor ON compras(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_categoria ON compras(categoria);
CREATE INDEX IF NOT EXISTS idx_compras_tipo_custo ON compras(tipo_custo);
CREATE INDEX IF NOT EXISTS idx_compras_status ON compras(status_pagamento);
CREATE INDEX IF NOT EXISTS idx_compras_data ON compras(data_compra);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_fornecedores_updated_at
  BEFORE UPDATE ON fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compras_updated_at
  BEFORE UPDATE ON compras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DADOS INICIAIS (OPCIONAL - PARA TESTES)
-- ============================================

-- Inserir alguns fornecedores de exemplo
INSERT INTO fornecedores (nome, cnpj, tipo_fornecedor, contato, email) VALUES
('Substrato Brasil Ltda', '12.345.678/0001-90', 'Matéria-Prima', '(11) 98765-4321', 'contato@substratobrasil.com.br'),
('Embalagens Premium', '98.765.432/0001-10', 'Embalagens', '(11) 91234-5678', 'vendas@embalagenpremium.com.br'),
('Fornecedor de Spawn XYZ', '11.222.333/0001-44', 'Matéria-Prima', '(11) 99999-8888', 'spawn@xyz.com.br')
ON CONFLICT DO NOTHING;

-- Inserir algumas compras de exemplo
INSERT INTO compras (numero_compra, fornecedor_id, categoria, tipo_custo, valor_total, data_compra, status_pagamento, observacoes)
SELECT 
  'CP-2026-0001',
  f.id,
  'Substrato',
  'Variável',
  3500.00,
  '2026-02-01',
  'Pago',
  'Compra inicial de substrato para 12 lotes'
FROM fornecedores f
WHERE f.nome = 'Substrato Brasil Ltda'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICAÇÃO
-- ============================================

-- Verificar se as tabelas foram criadas
SELECT 
  table_name, 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name IN ('fornecedores', 'compras')
ORDER BY table_name;

-- Verificar dados inseridos
SELECT 'fornecedores' as tabela, COUNT(*) as total FROM fornecedores
UNION ALL
SELECT 'compras' as tabela, COUNT(*) as total FROM compras;
