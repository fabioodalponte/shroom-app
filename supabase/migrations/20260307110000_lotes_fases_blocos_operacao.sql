-- ============================================
-- Evolução incremental do domínio de lotes
-- Fases operacionais + blocos + eventos + consumo de insumos
-- ============================================

-- 1) LOTES: fase operacional nativa
ALTER TABLE lotes
  ADD COLUMN IF NOT EXISTS fase_operacional VARCHAR(30) DEFAULT 'esterilizacao',
  ADD COLUMN IF NOT EXISTS fase_atualizada_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS data_encerramento TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lotes_fase_operacional_check'
  ) THEN
    ALTER TABLE lotes
      ADD CONSTRAINT lotes_fase_operacional_check
      CHECK (
        fase_operacional IN (
          'esterilizacao',
          'inoculacao',
          'incubacao',
          'frutificacao',
          'colheita',
          'encerramento'
        )
      );
  END IF;
END
$$;

UPDATE lotes
SET fase_operacional = COALESCE(fase_operacional, 'esterilizacao'),
    fase_atualizada_em = COALESCE(fase_atualizada_em, NOW())
WHERE fase_operacional IS NULL OR fase_atualizada_em IS NULL;

-- 2) BLOCOS POR LOTE
CREATE TABLE IF NOT EXISTS lotes_blocos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  codigo_bloco VARCHAR(80) NOT NULL,
  status_bloco VARCHAR(30) NOT NULL DEFAULT 'inoculado'
    CHECK (status_bloco IN ('inoculado', 'incubacao', 'frutificacao', 'colhido', 'descartado')),
  fase_operacional VARCHAR(30) NOT NULL DEFAULT 'inoculacao'
    CHECK (fase_operacional IN ('inoculacao', 'incubacao', 'frutificacao', 'colheita', 'encerramento')),
  peso_substrato_kg DECIMAL(10,3),
  data_inoculacao TIMESTAMP WITH TIME ZONE,
  data_incubacao TIMESTAMP WITH TIME ZONE,
  data_frutificacao TIMESTAMP WITH TIME ZONE,
  data_colheita TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(lote_id, codigo_bloco)
);

-- 3) HISTÓRICO DE EVENTOS (LOTE / BLOCO)
CREATE TABLE IF NOT EXISTS lotes_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  bloco_id UUID REFERENCES lotes_blocos(id) ON DELETE SET NULL,
  fase_operacional VARCHAR(30),
  tipo_evento VARCHAR(60) NOT NULL,
  origem VARCHAR(30) DEFAULT 'app',
  detalhes JSONB DEFAULT '{}'::jsonb,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4) INSUMOS + CONSUMO POR LOTE/BLOCO
CREATE TABLE IF NOT EXISTS insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL UNIQUE,
  categoria VARCHAR(80),
  unidade VARCHAR(20) NOT NULL DEFAULT 'kg',
  estoque_atual DECIMAL(12,3) NOT NULL DEFAULT 0,
  estoque_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consumo_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  bloco_id UUID REFERENCES lotes_blocos(id) ON DELETE SET NULL,
  insumo_id UUID NOT NULL REFERENCES insumos(id),
  quantidade DECIMAL(12,3) NOT NULL CHECK (quantidade > 0),
  unidade VARCHAR(20),
  fase_operacional VARCHAR(30),
  observacoes TEXT,
  usuario_id UUID REFERENCES usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5) COLHEITA POR BLOCO (compatível com fluxo atual)
ALTER TABLE colheitas
  ADD COLUMN IF NOT EXISTS bloco_id UUID REFERENCES lotes_blocos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fase_registrada VARCHAR(30);

-- 6) ÍNDICES
CREATE INDEX IF NOT EXISTS idx_lotes_fase_operacional ON lotes(fase_operacional);
CREATE INDEX IF NOT EXISTS idx_lotes_blocos_lote_id ON lotes_blocos(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_blocos_status ON lotes_blocos(status_bloco);
CREATE INDEX IF NOT EXISTS idx_lotes_eventos_lote_id ON lotes_eventos(lote_id);
CREATE INDEX IF NOT EXISTS idx_lotes_eventos_bloco_id ON lotes_eventos(bloco_id);
CREATE INDEX IF NOT EXISTS idx_lotes_eventos_created_at ON lotes_eventos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consumo_insumos_lote_id ON consumo_insumos(lote_id);
CREATE INDEX IF NOT EXISTS idx_consumo_insumos_insumo_id ON consumo_insumos(insumo_id);
CREATE INDEX IF NOT EXISTS idx_colheitas_bloco_id ON colheitas(bloco_id);

-- 7) TRIGGERS updated_at para novas tabelas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_lotes_blocos_updated_at') THEN
    CREATE TRIGGER update_lotes_blocos_updated_at
      BEFORE UPDATE ON lotes_blocos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_insumos_updated_at') THEN
    CREATE TRIGGER update_insumos_updated_at
      BEFORE UPDATE ON insumos
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END
$$;

-- 8) Seeds mínimos de insumos (idempotente)
INSERT INTO insumos (nome, categoria, unidade, estoque_atual, estoque_minimo)
VALUES
  ('Substrato Serragem', 'Substrato', 'kg', 120.000, 30.000),
  ('Farelo de Arroz', 'Suplemento', 'kg', 40.000, 10.000),
  ('Spawn (Inóculo)', 'Inoculação', 'kg', 18.000, 5.000),
  ('Álcool 70%', 'Higienização', 'L', 20.000, 4.000),
  ('Luvas Descartáveis', 'EPI', 'caixa', 12.000, 3.000)
ON CONFLICT (nome) DO NOTHING;

