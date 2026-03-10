CREATE TABLE IF NOT EXISTS public.controladores_sala (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL,
  localizacao VARCHAR(120) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'Sala de Cultivo',
  base_url TEXT NOT NULL,
  device_id VARCHAR(120),
  api_token TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Manutenção')),
  modo_padrao VARCHAR(20) NOT NULL DEFAULT 'remote' CHECK (modo_padrao IN ('manual', 'remote')),
  relay_map JSONB NOT NULL DEFAULT '{"relay1":"ventilador","relay2":"luz","relay3":"aquecedor","relay4":"umidificador"}'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_controladores_sala_localizacao
  ON public.controladores_sala(localizacao);

CREATE INDEX IF NOT EXISTS idx_controladores_sala_status
  ON public.controladores_sala(status);

DROP TRIGGER IF EXISTS set_controladores_sala_updated_at ON public.controladores_sala;
CREATE TRIGGER set_controladores_sala_updated_at
BEFORE UPDATE ON public.controladores_sala
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
