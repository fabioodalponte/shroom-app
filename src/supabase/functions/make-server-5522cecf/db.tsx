import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Cliente Supabase para operações de banco de dados
export const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

export const FASES_OPERACIONAIS = [
  'esterilizacao',
  'inoculacao',
  'incubacao',
  'pronto_para_frutificacao',
  'frutificacao',
  'colheita',
  'encerramento',
] as const;

export type FaseOperacional = typeof FASES_OPERACIONAIS[number];

export const STATUS_BLOCO = [
  'inoculado',
  'incubacao',
  'frutificacao',
  'colhido',
  'descartado',
] as const;

type StatusBloco = typeof STATUS_BLOCO[number];

function faseOrNull(value: unknown): FaseOperacional | null {
  const normalized = String(value || '').trim().toLowerCase();
  return FASES_OPERACIONAIS.includes(normalized as FaseOperacional)
    ? (normalized as FaseOperacional)
    : null;
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function addDaysIso(baseIso: string, days: number) {
  const baseDate = new Date(baseIso);
  baseDate.setUTCDate(baseDate.getUTCDate() + days);
  return baseDate.toISOString();
}

function normalizeSalaLabel(value: unknown) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function resolveSalaCode(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

async function getProdutoPerfilCultivoByProdutoId(produtoId?: string | null) {
  if (!produtoId) return null;

  const { data, error } = await supabase
    .from('produtos_perfis_cultivo')
    .select('*')
    .eq('produto_id', produtoId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function resolveIncubacaoDiasPrevistos(perfilCultivo?: any | null) {
  const incubacaoConfig = perfilCultivo?.parametros_fases_json?.incubacao || {};
  return (
    toPositiveInteger(incubacaoConfig?.dias_previstos) ||
    toPositiveInteger(perfilCultivo?.ciclo_estimado_dias_min) ||
    toPositiveInteger(perfilCultivo?.ciclo_min_dias) ||
    14
  );
}

/**
 * SALAS
 */
export async function getSalas(filters?: { ativa?: boolean | null }) {
  let query = supabase
    .from('salas')
    .select('*')
    .order('nome');

  if (typeof filters?.ativa === 'boolean') {
    query = query.eq('ativa', filters.ativa);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getSalaById(id?: string | null) {
  const normalizedId = resolveSalaId(id);
  if (!normalizedId) return null;

  const { data, error } = await supabase
    .from('salas')
    .select('*')
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findSalaByLegacyName(name?: string | null) {
  const normalizedName = normalizeSalaLabel(name);
  if (!normalizedName) return null;
  return getSalaById(normalizedName);
}

async function resolveSalaAssignment(input: { sala_id?: unknown; sala?: unknown }) {
  const explicitSalaId = resolveSalaId(input.sala_id);
  if (explicitSalaId) {
    const sala = await getSalaById(explicitSalaId);
    if (sala) {
      return { sala_id: sala.id, sala: sala.nome };
    }
  }

  const legacySala = normalizeSalaLabel(input.sala);
  if (!legacySala) {
    return { sala_id: null, sala: null };
  }

  const sala = await findSalaByLegacyName(legacySala);
  if (sala) {
    return { sala_id: sala.id, sala: sala.nome };
  }

  return { sala_id: null, sala: legacySala };
}

export async function createSala(input: {
  id?: string | null;
  codigo?: string | null;
  nome?: string | null;
  tipo?: string | null;
  ativa?: boolean | null;
  descricao?: string | null;
}) {
  const nome = normalizeSalaLabel(input.nome);
  if (!nome) {
    throw new Error('nome é obrigatório para cadastrar sala');
  }

  const id = resolveSalaId(input.id ?? input.codigo ?? nome);
  if (!id) {
    throw new Error('Não foi possível gerar o identificador da sala');
  }

  const codigo = resolveSalaCode(input.codigo ?? nome);
  if (!codigo) {
    throw new Error('Não foi possível gerar o código da sala');
  }

  const { data, error } = await supabase
    .from('salas')
    .insert({
      id,
      codigo,
      nome,
      tipo: normalizeSalaLabel(input.tipo) || 'cultivo',
      ativa: input.ativa ?? true,
      descricao: normalizeSalaLabel(input.descricao) || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSala(id: string, updates: {
  codigo?: string | null;
  nome?: string | null;
  tipo?: string | null;
  ativa?: boolean | null;
  descricao?: string | null;
}) {
  const payload: Record<string, unknown> = {};

  if ('codigo' in updates) payload.codigo = resolveSalaCode(updates.codigo) || null;
  if ('nome' in updates) payload.nome = normalizeSalaLabel(updates.nome) || null;
  if ('tipo' in updates) payload.tipo = normalizeSalaLabel(updates.tipo) || 'cultivo';
  if ('descricao' in updates) payload.descricao = normalizeSalaLabel(updates.descricao) || null;
  if ('ativa' in updates && typeof updates.ativa === 'boolean') payload.ativa = updates.ativa;

  const { data, error } = await supabase
    .from('salas')
    .update(payload)
    .eq('id', resolveSalaId(id) || id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * LOTES
 */
export async function getLotes(filters?: { status?: string; sala?: string; fase_operacional?: string }) {
  let query = supabase
    .from('lotes')
    .select(`
      *,
      produto:produtos(
        *,
        perfil_cultivo:produtos_perfis_cultivo(
          co2_ideal_max,
          luminosidade_min_lux,
          luminosidade_max_lux,
          recomendacoes_json
        )
      ),
      sala_ref:salas(id, codigo, nome, tipo, ativa),
      responsavel:usuarios(id, nome, email),
      blocos:lotes_blocos(id, status_bloco, fase_operacional)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.sala) {
    query = query.eq('sala', filters.sala);
  }

  if (filters?.fase_operacional) {
    query = query.eq('fase_operacional', filters.fase_operacional);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function createLote(loteData: any) {
  // Gerar código único do lote
  const now = new Date();
  const year = now.getFullYear();
  const count = await supabase
    .from('lotes')
    .select('id', { count: 'exact', head: true });
  
  const nextNumber = (count.count || 0) + 1;
  const codigoLote = `LT-${year}-${String(nextNumber).padStart(3, '0')}`;
  
  const faseAtual = faseOrNull(loteData?.fase_operacional) || 'esterilizacao';
  const salaResolvida = await resolveSalaAssignment(loteData || {});

  const { data, error } = await supabase
    .from('lotes')
    .insert({
      ...loteData,
      codigo_lote: codigoLote,
      qr_code: codigoLote, // Pode ser usado para gerar QR code depois
      fase_operacional: faseAtual,
      fase_atual: faseAtual,
      fase_atualizada_em: new Date().toISOString(),
      sala_id: salaResolvida.sala_id,
      sala: salaResolvida.sala,
    })
    .select(`
      *,
      sala_ref:salas(id, codigo, nome, tipo, ativa),
      produto:produtos(*),
      responsavel:usuarios(id, nome, email)
    `)
    .single();

  if (error) throw error;

  await createLoteEvento({
    lote_id: data.id,
    fase_operacional: data.fase_operacional || 'esterilizacao',
    tipo_evento: 'lote_criado',
    usuario_id: loteData?.responsavel_id || null,
    detalhes: {
      codigo_lote: data.codigo_lote,
      produto_id: data.produto_id || null,
    },
  });

  return data;
}

export async function updateLote(id: string, updates: any) {
  const payload = { ...updates };
  const faseNormalizada = faseOrNull(payload.fase_operacional ?? payload.fase_atual);
  if (faseNormalizada) {
    payload.fase_operacional = faseNormalizada;
    payload.fase_atual = faseNormalizada;
    payload.fase_atualizada_em = new Date().toISOString();
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'sala') || Object.prototype.hasOwnProperty.call(payload, 'sala_id')) {
    const hasSalaValue = normalizeSalaLabel(payload.sala);
    const hasSalaIdValue = resolveSalaId(payload.sala_id);
    if (!hasSalaValue && !hasSalaIdValue) {
      payload.sala = null;
      payload.sala_id = null;
    } else {
      const salaResolvida = await resolveSalaAssignment(payload);
      payload.sala = salaResolvida.sala;
      payload.sala_id = salaResolvida.sala_id;
    }
  }

  const { data, error } = await supabase
    .from('lotes')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      sala_ref:salas(id, codigo, nome, tipo, ativa)
    `)
    .single();

  if (error) throw error;

  if (payload.fase_operacional) {
    await createLoteEvento({
      lote_id: id,
      fase_operacional: payload.fase_operacional,
      tipo_evento: 'lote_atualizado',
      detalhes: payload,
    });
  }

  return data;
}

export async function getLoteByCodigo(codigoLote: string) {
  const { data, error } = await supabase
    .from('lotes')
    .select('id, codigo_lote, sala, sala_id')
    .eq('codigo_lote', codigoLote)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getLoteById(loteId: string) {
  const { data, error } = await supabase
    .from('lotes')
    .select(`
      *,
      sala_ref:salas(id, codigo, nome, tipo, ativa),
      produto:produtos(
        *,
        perfil_cultivo:produtos_perfis_cultivo(*)
      ),
      responsavel:usuarios(id, nome, email)
    `)
    .eq('id', loteId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

interface LoteEventoInput {
  lote_id: string;
  bloco_id?: string | null;
  fase_operacional?: string | null;
  tipo_evento: string;
  origem?: string;
  detalhes?: Record<string, unknown>;
  usuario_id?: string | null;
}

export async function createLoteEvento(input: LoteEventoInput) {
  const payload = {
    lote_id: input.lote_id,
    bloco_id: input.bloco_id ?? null,
    fase_operacional: input.fase_operacional ?? null,
    tipo_evento: input.tipo_evento,
    origem: input.origem || 'app',
    detalhes: input.detalhes || {},
    usuario_id: input.usuario_id ?? null,
  };

  const { data, error } = await supabase
    .from('lotes_eventos')
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLoteEventos(loteId: string, limit = 120) {
  const { data, error } = await supabase
    .from('lotes_eventos')
    .select(`
      *,
      bloco:lotes_blocos(codigo_bloco),
      usuario:usuarios(id, nome)
    `)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getLoteBlocos(loteId: string) {
  const { data, error } = await supabase
    .from('lotes_blocos')
    .select('*')
    .eq('lote_id', loteId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

interface CreateBlocosInput {
  lote_id: string;
  quantidade: number;
  peso_substrato_kg?: number | null;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function createBlocosForLote(input: CreateBlocosInput) {
  const lote = await getLoteById(input.lote_id);
  if (!lote) {
    throw new Error('Lote não encontrado');
  }

  if (lote.data_inoculacao || ['incubacao', 'pronto_para_frutificacao', 'frutificacao', 'colheita', 'encerramento'].includes(String(lote.fase_operacional || ''))) {
    throw new Error('Blocos novos só podem ser criados antes da inoculação do lote.');
  }

  const quantidade = Math.max(1, Math.floor(Number(input.quantidade || 0)));

  const { count } = await supabase
    .from('lotes_blocos')
    .select('id', { count: 'exact', head: true })
    .eq('lote_id', input.lote_id);

  const start = (count || 0) + 1;
  const blocos = Array.from({ length: quantidade }).map((_, index) => {
    const numero = start + index;
    return {
      lote_id: input.lote_id,
      codigo_bloco: `${lote.codigo_lote}-B${String(numero).padStart(3, '0')}`,
      status_bloco: 'inoculado' as StatusBloco,
      fase_operacional: 'inoculacao',
      peso_substrato_kg: input.peso_substrato_kg ?? null,
      data_inoculacao: new Date().toISOString(),
      observacoes: input.observacoes ?? null,
    };
  });

  const { data, error } = await supabase
    .from('lotes_blocos')
    .insert(blocos)
    .select('*');

  if (error) throw error;

  await createLoteEvento({
    lote_id: input.lote_id,
    fase_operacional: 'inoculacao',
    tipo_evento: 'blocos_criados',
    usuario_id: input.usuario_id ?? null,
    detalhes: { quantidade: blocos.length },
  });

  return data || [];
}

interface UpdateLoteFaseInput {
  lote_id: string;
  fase_operacional: FaseOperacional;
  observacoes?: string | null;
  usuario_id?: string | null;
  detalhes?: Record<string, unknown>;
  extra_updates?: Record<string, unknown>;
}

export async function updateLoteFase(input: UpdateLoteFaseInput) {
  const updates: Record<string, unknown> = {
    fase_operacional: input.fase_operacional,
    fase_atual: input.fase_operacional,
    fase_atualizada_em: new Date().toISOString(),
    ...(input.extra_updates || {}),
  };

  if (input.fase_operacional === 'colheita' && !updates.status) {
    updates.status = 'Colhido';
  }

  if (input.fase_operacional === 'encerramento') {
    updates.status = 'Finalizado';
    updates.data_encerramento = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('lotes')
    .update(updates)
    .eq('id', input.lote_id)
    .select('*')
    .single();

  if (error) throw error;

  await createLoteEvento({
    lote_id: input.lote_id,
    fase_operacional: input.fase_operacional,
    tipo_evento: 'fase_alterada',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      observacoes: input.observacoes || null,
      ...(input.detalhes || {}),
    },
  });

  return data;
}

interface ConsumoInsumoInput {
  lote_id: string;
  insumo_id: string;
  quantidade: number;
  bloco_id?: string | null;
  fase_operacional?: string | null;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function getInsumos() {
  const { data, error } = await supabase
    .from('insumos')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getConsumoInsumosByLote(loteId: string) {
  const { data, error } = await supabase
    .from('consumo_insumos')
    .select(`
      *,
      insumo:insumos(id, nome, categoria, unidade),
      bloco:lotes_blocos(codigo_bloco),
      usuario:usuarios(id, nome)
    `)
    .eq('lote_id', loteId)
    .order('created_at', { ascending: false })
    .limit(150);

  if (error) throw error;
  return data || [];
}

export async function consumirInsumo(input: ConsumoInsumoInput) {
  const quantidade = Number(input.quantidade);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('quantidade deve ser maior que zero');
  }

  const { data: insumo, error: insumoError } = await supabase
    .from('insumos')
    .select('*')
    .eq('id', input.insumo_id)
    .single();

  if (insumoError) throw insumoError;
  if (!insumo) throw new Error('Insumo não encontrado');

  const estoqueAtual = Number(insumo.estoque_atual || 0);
  if (estoqueAtual < quantidade) {
    throw new Error(`Estoque insuficiente para ${insumo.nome}. Disponível: ${estoqueAtual}`);
  }

  const novoEstoque = Number((estoqueAtual - quantidade).toFixed(3));
  const { error: updateError } = await supabase
    .from('insumos')
    .update({ estoque_atual: novoEstoque })
    .eq('id', input.insumo_id);

  if (updateError) throw updateError;

  const fase = faseOrNull(input.fase_operacional);
  const payload = {
    lote_id: input.lote_id,
    bloco_id: input.bloco_id ?? null,
    insumo_id: input.insumo_id,
    quantidade,
    unidade: insumo.unidade,
    fase_operacional: fase,
    observacoes: input.observacoes ?? null,
    usuario_id: input.usuario_id ?? null,
  };

  const { data, error } = await supabase
    .from('consumo_insumos')
    .insert(payload)
    .select(`
      *,
      insumo:insumos(id, nome, categoria, unidade),
      bloco:lotes_blocos(codigo_bloco)
    `)
    .single();

  if (error) throw error;

  await createLoteEvento({
    lote_id: input.lote_id,
    bloco_id: input.bloco_id ?? null,
    fase_operacional: fase,
    tipo_evento: 'consumo_insumo',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      insumo_id: input.insumo_id,
      insumo_nome: insumo.nome,
      quantidade,
      unidade: insumo.unidade,
      estoque_restante: novoEstoque,
    },
  });

  return data;
}

interface RegistrarInoculacaoInput {
  lote_id: string;
  quantidade_blocos: number;
  peso_substrato_kg?: number | null;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function registrarInoculacao(input: RegistrarInoculacaoInput) {
  const loteAtual = await getLoteById(input.lote_id);
  if (!loteAtual) {
    throw new Error('Lote não encontrado');
  }

  if (loteAtual.data_inoculacao || ['incubacao', 'pronto_para_frutificacao', 'frutificacao', 'colheita', 'encerramento'].includes(String(loteAtual.fase_operacional || ''))) {
    throw new Error('Este lote já passou pela inoculação e não pode ser inoculado novamente.');
  }

  const dataInoculacao = new Date().toISOString();
  const perfilCultivo = await getProdutoPerfilCultivoByProdutoId(loteAtual.produto_id);
  const diasPrevistosIncubacao = resolveIncubacaoDiasPrevistos(perfilCultivo);
  const dataPrevistaFimIncubacao = addDaysIso(dataInoculacao, diasPrevistosIncubacao);

  await createLoteEvento({
    lote_id: input.lote_id,
    fase_operacional: 'inoculacao',
    tipo_evento: 'inoculacao_registrada',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      origem: 'operacao_inoculacao',
      quantidade_blocos: input.quantidade_blocos,
      peso_substrato_kg: input.peso_substrato_kg ?? null,
      dias_previstos_incubacao: diasPrevistosIncubacao,
      data_prevista_fim_incubacao: dataPrevistaFimIncubacao,
      observacoes: input.observacoes || null,
    },
  });

  const blocos = await createBlocosForLote({
    lote_id: input.lote_id,
    quantidade: input.quantidade_blocos,
    peso_substrato_kg: input.peso_substrato_kg ?? null,
    observacoes: input.observacoes ?? null,
    usuario_id: input.usuario_id ?? null,
  });

  const { error: updateBlocosError } = await supabase
    .from('lotes_blocos')
    .update({
      status_bloco: 'incubacao',
      fase_operacional: 'incubacao',
      data_incubacao: dataInoculacao,
    })
    .in('id', blocos.map((bloco) => bloco.id));

  if (updateBlocosError) {
    throw updateBlocosError;
  }

  const lote = await updateLoteFase({
    lote_id: input.lote_id,
    fase_operacional: 'incubacao',
    observacoes: 'Inoculação concluída e lote em incubação',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      blocos_criados: blocos.length,
      origem: 'operacao_inoculacao',
      dias_previstos_incubacao: diasPrevistosIncubacao,
      data_prevista_fim_incubacao: dataPrevistaFimIncubacao,
    },
    extra_updates: {
      data_inoculacao: dataInoculacao,
      data_prevista_fim_incubacao: dataPrevistaFimIncubacao,
      data_real_fim_incubacao: null,
    },
  });

  return {
    lote,
    blocos_criados: blocos.length,
    dias_previstos_incubacao: diasPrevistosIncubacao,
    data_prevista_fim_incubacao: dataPrevistaFimIncubacao,
  };
}

interface MarcarProntoParaFrutificacaoInput {
  lote_id: string;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function marcarLoteProntoParaFrutificacao(input: MarcarProntoParaFrutificacaoInput) {
  const loteAtual = await getLoteById(input.lote_id);
  if (!loteAtual) {
    throw new Error('Lote não encontrado');
  }

  if (!loteAtual.data_inoculacao) {
    throw new Error('O lote precisa ser inoculado antes de concluir a incubação.');
  }

  if (['frutificacao', 'colheita', 'encerramento'].includes(String(loteAtual.fase_operacional || ''))) {
    throw new Error('O lote já avançou além da incubação.');
  }

  if (loteAtual.fase_operacional === 'pronto_para_frutificacao') {
    return loteAtual;
  }

  const dataRealFimIncubacao = loteAtual.data_real_fim_incubacao || new Date().toISOString();
  const lote = await updateLoteFase({
    lote_id: input.lote_id,
    fase_operacional: 'pronto_para_frutificacao',
    observacoes: input.observacoes || 'Incubação concluída e lote pronto para frutificação',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      origem: 'operacao_incubacao',
      data_real_fim_incubacao: dataRealFimIncubacao,
    },
    extra_updates: {
      data_real_fim_incubacao: dataRealFimIncubacao,
    },
  });

  await createLoteEvento({
    lote_id: input.lote_id,
    fase_operacional: 'pronto_para_frutificacao',
    tipo_evento: 'incubacao_concluida',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      data_real_fim_incubacao: dataRealFimIncubacao,
      observacoes: input.observacoes || null,
    },
  });

  return lote;
}

interface RegistrarFrutificacaoInput {
  lote_id: string;
  bloco_ids?: string[] | null;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function registrarFrutificacao(input: RegistrarFrutificacaoInput) {
  const loteAtual = await getLoteById(input.lote_id);
  if (!loteAtual) {
    throw new Error('Lote não encontrado');
  }

  if (!loteAtual.data_inoculacao) {
    throw new Error('O lote precisa ser inoculado antes de entrar em frutificação.');
  }

  if (!['incubacao', 'pronto_para_frutificacao'].includes(String(loteAtual.fase_operacional || ''))) {
    throw new Error('Somente lotes em incubação ou prontos para frutificação podem avançar para frutificação.');
  }

  const blocosDoLote = await getLoteBlocos(input.lote_id);
  const elegiveis = blocosDoLote.filter((bloco) => String(bloco.status_bloco) === 'incubacao');

  const requestedIds = (input.bloco_ids || []).filter(Boolean);
  const selecionados = requestedIds.length
    ? elegiveis.filter((bloco) => requestedIds.includes(bloco.id))
    : elegiveis;

  if (!selecionados.length) {
    throw new Error('Nenhum bloco elegível para avançar para frutificação');
  }

  const selectedIds = selecionados.map((bloco) => bloco.id);
  const nowIso = new Date().toISOString();

  const { error: blocosError } = await supabase
    .from('lotes_blocos')
    .update({
      status_bloco: 'frutificacao',
      fase_operacional: 'frutificacao',
      data_frutificacao: nowIso,
    })
    .in('id', selectedIds);

  if (blocosError) throw blocosError;

  const lote = await updateLoteFase({
    lote_id: input.lote_id,
    fase_operacional: 'frutificacao',
    observacoes: input.observacoes,
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      blocos_movidos: selectedIds.length,
      origem: 'operacao_frutificacao',
    },
    extra_updates: {
      data_real_fim_incubacao: loteAtual.data_real_fim_incubacao || nowIso,
    },
  });

  await createLoteEvento({
    lote_id: input.lote_id,
    fase_operacional: 'frutificacao',
    tipo_evento: 'blocos_movidos_frutificacao',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      bloco_ids: selectedIds,
      observacoes: input.observacoes || null,
    },
  });

  return {
    lote,
    blocos_movidos: selectedIds.length,
    bloco_ids: selectedIds,
  };
}

export async function getBlocosResumoByLoteIds(loteIds: string[]) {
  const sanitized = [...new Set(loteIds.filter(Boolean))];
  if (!sanitized.length) {
    return new Map<string, { total: number; frutificacao: number; colhido: number }>();
  }

  const { data, error } = await supabase
    .from('lotes_blocos')
    .select('lote_id, status_bloco')
    .in('lote_id', sanitized);

  if (error) throw error;

  const resumo = new Map<string, { total: number; frutificacao: number; colhido: number }>();
  for (const row of data || []) {
    const loteId = row.lote_id as string;
    if (!resumo.has(loteId)) {
      resumo.set(loteId, { total: 0, frutificacao: 0, colhido: 0 });
    }
    const target = resumo.get(loteId)!;
    target.total += 1;
    if (row.status_bloco === 'frutificacao') target.frutificacao += 1;
    if (row.status_bloco === 'colhido') target.colhido += 1;
  }

  return resumo;
}

interface LeituraSensorInput {
  lote_id?: string | null;
  sala_id?: string | null;
  temperatura?: number | null;
  umidade?: number | null;
  co2_ppm?: number | null;
  luminosidade_lux?: number | null;
  timestamp?: string | null;
}

export function resolveSalaId(value: unknown) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || null;
}

export async function createLeituraSensor(input: LeituraSensorInput) {
  let resolvedSalaId = resolveSalaId(input.sala_id);

  if (!resolvedSalaId && input.lote_id) {
    const { data: lote, error: loteError } = await supabase
      .from('lotes')
      .select('id, sala')
      .eq('id', input.lote_id)
      .maybeSingle();

    if (loteError) throw loteError;
    resolvedSalaId = resolveSalaId(lote?.sala);
  }

  if (!resolvedSalaId && !input.lote_id) {
    throw new Error('sala_id ou lote_id é obrigatório para registrar leitura ambiental');
  }

  const payload: Record<string, unknown> = {};

  if (input.lote_id) payload.lote_id = input.lote_id;
  if (resolvedSalaId) payload.sala_id = resolvedSalaId;

  if (typeof input.temperatura === 'number') payload.temperatura = input.temperatura;
  if (typeof input.umidade === 'number') payload.umidade = input.umidade;
  if (typeof input.co2_ppm === 'number') payload.co2_ppm = input.co2_ppm;
  if (typeof input.luminosidade_lux === 'number') payload.luminosidade_lux = input.luminosidade_lux;
  if (input.timestamp) payload.timestamp = input.timestamp;

  const { data, error } = await supabase
    .from('leituras_sensores')
    .insert(payload)
    .select(`
      *,
      lote:lotes(
        id,
        codigo_lote,
        sala,
        fase_operacional,
        produto:produtos(
          temperatura_ideal_min,
          temperatura_ideal_max,
          umidade_ideal_min,
          umidade_ideal_max,
          perfil_cultivo:produtos_perfis_cultivo(
            co2_ideal_max,
            luminosidade_min_lux,
            luminosidade_max_lux,
            recomendacoes_json
          )
        )
      )
    `)
    .single();

  if (error) throw error;

  const loteUpdates: Record<string, unknown> = {};
  if (typeof input.temperatura === 'number') loteUpdates.temperatura_atual = input.temperatura;
  if (typeof input.umidade === 'number') loteUpdates.umidade_atual = input.umidade;

  if (input.lote_id && Object.keys(loteUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from('lotes')
      .update(loteUpdates)
      .eq('id', input.lote_id);

    if (updateError) {
      console.error('Erro ao atualizar lote com leitura de sensor:', updateError);
    }
  }

  return data;
}

interface GetLeiturasSensoresFilters {
  lote_id?: string;
  lote_ids?: string[];
  sala_id?: string;
  since?: string;
  limit?: number;
}

export async function getLeiturasSensores(filters?: GetLeiturasSensoresFilters) {
  let query = supabase
    .from('leituras_sensores')
    .select(`
      *,
      lote:lotes(
        id,
        codigo_lote,
        sala,
        fase_operacional,
        produto:produtos(
          temperatura_ideal_min,
          temperatura_ideal_max,
          umidade_ideal_min,
          umidade_ideal_max,
          perfil_cultivo:produtos_perfis_cultivo(
            co2_ideal_max,
            luminosidade_min_lux,
            luminosidade_max_lux,
            recomendacoes_json
          )
        )
      )
    `)
    .order('timestamp', { ascending: false })
    .limit(filters?.limit ?? 500);

  if (filters?.lote_id) {
    query = query.eq('lote_id', filters.lote_id);
  } else if (filters?.lote_ids?.length) {
    query = query.in('lote_id', filters.lote_ids);
  } else if (filters?.sala_id) {
    query = query.eq('sala_id', filters.sala_id);
  }

  if (filters?.since) {
    query = query.gte('timestamp', filters.since);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getLatestLeituraSensorByLoteId(loteId: string) {
  const leituras = await getLeiturasSensores({ lote_id: loteId, limit: 1 });
  return leituras[0] || null;
}

export async function getLeiturasSensoresBySalaId(
  salaId: string,
  filters?: Omit<GetLeiturasSensoresFilters, 'lote_id' | 'lote_ids' | 'sala_id'>,
) {
  const normalizedSalaId = resolveSalaId(salaId);
  if (!normalizedSalaId) return [];

  return getLeiturasSensores({
    sala_id: normalizedSalaId,
    since: filters?.since,
    limit: filters?.limit,
  });
}

export async function getLatestLeituraSensorBySalaId(salaId: string) {
  const leituras = await getLeiturasSensoresBySalaId(salaId, { limit: 1 });
  return leituras[0] || null;
}

async function getPreferredLoteIdsBySala(sala: string) {
  const normalizedSala = String(sala || '').trim();
  if (!normalizedSala) return [];

  const { data, error } = await supabase
    .from('lotes')
    .select('id, status, fase_operacional, fase_atual')
    .eq('sala', normalizedSala);

  if (error) throw error;

  const lotes = data || [];
  const lotesAtivos = lotes.filter((lote) => {
    const status = String(lote.status || '').trim().toLowerCase();
    const fase = String(lote.fase_operacional || lote.fase_atual || '').trim().toLowerCase();
    return status !== 'finalizado' && status !== 'encerrado' && fase !== 'encerramento';
  });

  return (lotesAtivos.length > 0 ? lotesAtivos : lotes).map((lote) => lote.id);
}

export async function getLeiturasSensoresBySala(
  sala: string,
  filters?: Omit<GetLeiturasSensoresFilters, 'lote_id' | 'lote_ids'>,
) {
  const leiturasPorSalaId = await getLeiturasSensoresBySalaId(sala, filters);
  if (leiturasPorSalaId.length > 0) {
    return leiturasPorSalaId;
  }

  const loteIds = await getPreferredLoteIdsBySala(sala);
  if (loteIds.length === 0) return [];

  return getLeiturasSensores({
    lote_ids: loteIds,
    since: filters?.since,
    limit: filters?.limit,
  });
}

export async function getLatestLeituraSensorBySala(sala: string) {
  const leituras = await getLeiturasSensoresBySala(sala, { limit: 1 });
  return leituras[0] || null;
}

/**
 * COLHEITAS
 */
export async function getColheitas(loteId?: string) {
  let query = supabase
    .from('colheitas')
    .select(`
      *,
      lote:lotes(codigo_lote, produto:produtos(nome)),
      bloco:lotes_blocos(codigo_bloco),
      responsavel:usuarios(nome)
    `)
    .order('data_colheita', { ascending: false });

  if (loteId) {
    query = query.eq('lote_id', loteId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createColheita(colheitaData: any) {
  console.log('createColheita - Dados recebidos:', JSON.stringify(colheitaData, null, 2));
  
  // Remover produto_id se existir (não é coluna da tabela colheitas)
  const { produto_id, ...dadosColheita } = colheitaData;
  
  console.log('createColheita - Dados limpos para inserção:', JSON.stringify(dadosColheita, null, 2));

  const loteAtual = await getLoteById(dadosColheita.lote_id);
  if (!loteAtual) {
    throw new Error('Lote não encontrado para registrar colheita');
  }

  if (!['frutificacao', 'colheita'].includes(String(loteAtual.fase_operacional || ''))) {
    throw new Error('A colheita só pode ser registrada para lotes em frutificação ou colheita.');
  }

  if (dadosColheita.bloco_id) {
    const { data: blocoAtual, error: blocoError } = await supabase
      .from('lotes_blocos')
      .select('id, lote_id, status_bloco')
      .eq('id', dadosColheita.bloco_id)
      .maybeSingle();

    if (blocoError) throw blocoError;
    if (!blocoAtual || blocoAtual.lote_id !== dadosColheita.lote_id) {
      throw new Error('Bloco inválido para o lote selecionado.');
    }
    if (String(blocoAtual.status_bloco) !== 'frutificacao') {
      throw new Error('A colheita só pode ser registrada para blocos em frutificação.');
    }
  }

  const faseRegistrada = faseOrNull(dadosColheita.fase_registrada || loteAtual.fase_operacional) || 'colheita';
  const payloadColheita = {
    ...dadosColheita,
    fase_registrada: faseRegistrada,
  };
  
  const { data, error } = await supabase
    .from('colheitas')
    .insert(payloadColheita)
    .select()
    .single();

  if (error) {
    console.error('Erro ao inserir colheita:', error);
    throw error;
  }

  // Buscar o produto_id do lote para atualizar estoque
  const { data: lote } = await supabase
    .from('lotes')
    .select('produto_id')
    .eq('id', dadosColheita.lote_id)
    .single();

  if (lote?.produto_id) {
    // Atualizar estoque após colheita
    await supabase.from('estoque').insert({
      produto_id: lote.produto_id,
      lote_id: payloadColheita.lote_id,
      quantidade_kg: payloadColheita.quantidade_kg,
      qualidade: payloadColheita.qualidade,
      status: 'Disponível'
    });
  }

  if (payloadColheita.bloco_id) {
    await supabase
      .from('lotes_blocos')
      .update({
        status_bloco: 'colhido',
        fase_operacional: 'colheita',
        data_colheita: new Date().toISOString(),
      })
      .eq('id', payloadColheita.bloco_id);
  }

  await updateLoteFase({
    lote_id: payloadColheita.lote_id,
    fase_operacional: 'colheita',
    observacoes: payloadColheita.observacoes || null,
    usuario_id: payloadColheita.responsavel_id || null,
    detalhes: {
      colheita_id: data.id,
      quantidade_kg: payloadColheita.quantidade_kg,
      qualidade: payloadColheita.qualidade,
      bloco_id: payloadColheita.bloco_id || null,
    },
  });

  await createLoteEvento({
    lote_id: payloadColheita.lote_id,
    bloco_id: payloadColheita.bloco_id || null,
    fase_operacional: 'colheita',
    tipo_evento: 'colheita_registrada',
    usuario_id: payloadColheita.responsavel_id || null,
    detalhes: {
      colheita_id: data.id,
      quantidade_kg: payloadColheita.quantidade_kg,
      qualidade: payloadColheita.qualidade,
    },
  });

  return data;
}

/**
 * PRODUTOS
 */
type ProdutoCatalogOptions = {
  includeInactive?: boolean;
  includeInactiveTrainings?: boolean;
};

function normalizeProdutoCatalogRow(
  produto: any,
  perfilMap: Map<string, any>,
  treinamentosMap: Map<string, any[]>,
) {
  const perfil = perfilMap.get(produto.id) || null;
  return {
    ...produto,
    perfil_cultivo: perfil
      ? {
          ...perfil,
          ciclo_estimado_dias_min: perfil.ciclo_estimado_dias_min ?? perfil.ciclo_min_dias ?? null,
          ciclo_estimado_dias_max: perfil.ciclo_estimado_dias_max ?? perfil.ciclo_max_dias ?? null,
        }
      : null,
    treinamentos: treinamentosMap.get(produto.id) || [],
  };
}

async function hydrateProdutosCatalog(produtos: any[], options?: ProdutoCatalogOptions) {
  if (!produtos.length) return [];

  const produtoIds = produtos.map((produto) => produto.id);

  let perfisQuery = supabase
    .from('produtos_perfis_cultivo')
    .select('*')
    .in('produto_id', produtoIds);

  if (!options?.includeInactive) {
    perfisQuery = perfisQuery.eq('ativo', true);
  }

  let treinamentosQuery = supabase
    .from('produtos_treinamentos')
    .select('*')
    .in('produto_id', produtoIds)
    .order('ordem', { ascending: true })
    .order('titulo', { ascending: true });

  if (!options?.includeInactiveTrainings) {
    treinamentosQuery = treinamentosQuery.eq('ativo', true);
  }

  const [{ data: perfis, error: perfisError }, { data: treinamentos, error: treinamentosError }] = await Promise.all([
    perfisQuery,
    treinamentosQuery,
  ]);

  if (perfisError) throw perfisError;
  if (treinamentosError) throw treinamentosError;

  const perfilMap = new Map<string, any>((perfis || []).map((perfil) => [perfil.produto_id, perfil]));
  const treinamentosMap = new Map<string, any[]>();

  for (const treinamento of treinamentos || []) {
    const bucket = treinamentosMap.get(treinamento.produto_id) || [];
    bucket.push(treinamento);
    treinamentosMap.set(treinamento.produto_id, bucket);
  }

  return produtos.map((produto) => normalizeProdutoCatalogRow(produto, perfilMap, treinamentosMap));
}

export async function getProdutos(options?: ProdutoCatalogOptions) {
  let query = supabase
    .from('produtos')
    .select('*')
    .order('nome');

  if (!options?.includeInactive) {
    query = query.eq('ativo', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return hydrateProdutosCatalog(data || [], options);
}

export async function getProdutoByIdCatalogo(id: string, options?: ProdutoCatalogOptions) {
  let query = supabase
    .from('produtos')
    .select('*')
    .eq('id', id);

  if (!options?.includeInactive) {
    query = query.eq('ativo', true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const hydrated = await hydrateProdutosCatalog([data], options);
  return hydrated[0] || null;
}

export async function getProdutoTreinamentos(produtoId: string, options?: { includeInactive?: boolean }) {
  let query = supabase
    .from('produtos_treinamentos')
    .select('*')
    .eq('produto_id', produtoId)
    .order('ordem', { ascending: true })
    .order('titulo', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('ativo', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createProduto(produtoData: any) {
  const payload = {
    nome: String(produtoData?.nome || '').trim(),
    descricao: produtoData?.descricao || null,
    variedade: produtoData?.variedade || null,
    peso_medio_g: produtoData?.peso_medio_g ?? null,
    preco_kg: produtoData?.preco_kg ?? null,
    tempo_cultivo_dias: produtoData?.tempo_cultivo_dias ?? null,
    temperatura_ideal_min: produtoData?.temperatura_ideal_min ?? null,
    temperatura_ideal_max: produtoData?.temperatura_ideal_max ?? null,
    umidade_ideal_min: produtoData?.umidade_ideal_min ?? null,
    umidade_ideal_max: produtoData?.umidade_ideal_max ?? null,
    ativo: produtoData?.ativo ?? true,
  };

  const { data, error } = await supabase
    .from('produtos')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  return getProdutoByIdCatalogo(data.id, { includeInactive: true, includeInactiveTrainings: true });
}

export async function updateProduto(id: string, produtoData: any) {
  const payload = {
    nome: produtoData?.nome !== undefined ? String(produtoData.nome || '').trim() : undefined,
    descricao: produtoData?.descricao !== undefined ? produtoData.descricao || null : undefined,
    variedade: produtoData?.variedade !== undefined ? produtoData.variedade || null : undefined,
    peso_medio_g: produtoData?.peso_medio_g !== undefined ? produtoData.peso_medio_g ?? null : undefined,
    preco_kg: produtoData?.preco_kg !== undefined ? produtoData.preco_kg ?? null : undefined,
    tempo_cultivo_dias: produtoData?.tempo_cultivo_dias !== undefined ? produtoData.tempo_cultivo_dias ?? null : undefined,
    temperatura_ideal_min: produtoData?.temperatura_ideal_min !== undefined ? produtoData.temperatura_ideal_min ?? null : undefined,
    temperatura_ideal_max: produtoData?.temperatura_ideal_max !== undefined ? produtoData.temperatura_ideal_max ?? null : undefined,
    umidade_ideal_min: produtoData?.umidade_ideal_min !== undefined ? produtoData.umidade_ideal_min ?? null : undefined,
    umidade_ideal_max: produtoData?.umidade_ideal_max !== undefined ? produtoData.umidade_ideal_max ?? null : undefined,
    ativo: produtoData?.ativo !== undefined ? produtoData.ativo : undefined,
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const { error } = await supabase
    .from('produtos')
    .update(cleanedPayload)
    .eq('id', id);

  if (error) throw error;
  return getProdutoByIdCatalogo(id, { includeInactive: true, includeInactiveTrainings: true });
}

export async function upsertProdutoPerfil(produtoId: string, perfilData: any) {
  const cicloEstimadoDiasMin = perfilData?.ciclo_estimado_dias_min ?? perfilData?.ciclo_min_dias ?? null;
  const cicloEstimadoDiasMax = perfilData?.ciclo_estimado_dias_max ?? perfilData?.ciclo_max_dias ?? null;

  const payload = {
    produto_id: produtoId,
    co2_ideal_max: perfilData?.co2_ideal_max ?? null,
    luminosidade_min_lux: perfilData?.luminosidade_min_lux ?? null,
    luminosidade_max_lux: perfilData?.luminosidade_max_lux ?? null,
    ciclo_estimado_dias_min: cicloEstimadoDiasMin,
    ciclo_estimado_dias_max: cicloEstimadoDiasMax,
    ciclo_min_dias: cicloEstimadoDiasMin,
    ciclo_max_dias: cicloEstimadoDiasMax,
    parametros_fases_json: perfilData?.parametros_fases_json || {},
    recomendacoes_json: perfilData?.recomendacoes_json || {},
    observacoes: perfilData?.observacoes || null,
    ativo: perfilData?.ativo ?? true,
  };

  const { data, error } = await supabase
    .from('produtos_perfis_cultivo')
    .upsert(payload, { onConflict: 'produto_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createProdutoTreinamento(produtoId: string, treinamentoData: any) {
  const payload = {
    produto_id: produtoId,
    slug: String(treinamentoData?.slug || '').trim(),
    categoria: String(treinamentoData?.categoria || 'operacional').trim(),
    titulo: String(treinamentoData?.titulo || '').trim(),
    objetivo: treinamentoData?.objetivo || null,
    conteudo_json: treinamentoData?.conteudo_json || {},
    ordem: Number.isFinite(Number(treinamentoData?.ordem)) ? Number(treinamentoData.ordem) : 0,
    ativo: treinamentoData?.ativo ?? true,
  };

  const { data, error } = await supabase
    .from('produtos_treinamentos')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function updateProdutoTreinamento(produtoId: string, treinamentoId: string, treinamentoData: any) {
  const payload = {
    slug: treinamentoData?.slug !== undefined ? String(treinamentoData.slug || '').trim() : undefined,
    categoria: treinamentoData?.categoria !== undefined ? String(treinamentoData.categoria || 'operacional').trim() : undefined,
    titulo: treinamentoData?.titulo !== undefined ? String(treinamentoData.titulo || '').trim() : undefined,
    objetivo: treinamentoData?.objetivo !== undefined ? treinamentoData.objetivo || null : undefined,
    conteudo_json: treinamentoData?.conteudo_json !== undefined ? treinamentoData.conteudo_json || {} : undefined,
    ordem: treinamentoData?.ordem !== undefined ? (Number.isFinite(Number(treinamentoData.ordem)) ? Number(treinamentoData.ordem) : 0) : undefined,
    ativo: treinamentoData?.ativo !== undefined ? treinamentoData.ativo : undefined,
  };

  const cleanedPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );

  const { data, error } = await supabase
    .from('produtos_treinamentos')
    .update(cleanedPayload)
    .eq('id', treinamentoId)
    .eq('produto_id', produtoId)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteProdutoTreinamento(produtoId: string, treinamentoId: string) {
  const { error } = await supabase
    .from('produtos_treinamentos')
    .delete()
    .eq('id', treinamentoId)
    .eq('produto_id', produtoId);

  if (error) throw error;
  return { success: true };
}

/**
 * ESTOQUE
 */
export async function getEstoque(filters?: { produto_id?: string; status?: string }) {
  let query = supabase
    .from('estoque')
    .select(`
      *,
      produto:produtos(nome, variedade),
      lote:lotes(codigo_lote)
    `)
    .order('data_entrada', { ascending: false });

  if (filters?.produto_id) {
    query = query.eq('produto_id', filters.produto_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * CLIENTES
 */
export async function getClientes(tipo?: 'B2B' | 'B2C') {
  let query = supabase
    .from('clientes')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (tipo) {
    query = query.eq('tipo_cliente', tipo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCliente(clienteData: any) {
  const { data, error } = await supabase
    .from('clientes')
    .insert(clienteData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * PEDIDOS
 */
export async function getPedidos(filters?: { status?: string; cliente_id?: string }) {
  let query = supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(nome, tipo_cliente),
      vendedor:usuarios(nome),
      itens:itens_pedido(
        *,
        produto:produtos(nome)
      )
    `)
    .order('data_pedido', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.cliente_id) {
    query = query.eq('cliente_id', filters.cliente_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPedido(pedidoData: {
  cliente_id: string;
  tipo_pedido: string;
  data_entrega_prevista?: string;
  vendedor_id: string;
  itens: Array<{
    produto_id: string;
    quantidade_kg: number;
    preco_unitario: number;
  }>;
}) {
  console.log('💼 createPedido - vendedor_id recebido:', pedidoData.vendedor_id);
  
  // Verificar se o vendedor existe na tabela usuarios
  const { data: vendedor, error: vendedorError } = await supabase
    .from('usuarios')
    .select('id, nome, tipo_usuario')
    .eq('id', pedidoData.vendedor_id)
    .maybeSingle();
  
  if (vendedorError) {
    console.error('❌ Erro ao verificar vendedor:', vendedorError);
  }
  
  if (!vendedor) {
    console.error('❌ VENDEDOR NÃO ENCONTRADO na tabela usuarios!');
    console.error('   vendedor_id fornecido:', pedidoData.vendedor_id);
    throw new Error(`Vendedor com ID ${pedidoData.vendedor_id} não encontrado na tabela usuarios. Execute o script SQL em /EXECUTE-AGORA.sql para corrigir as constraints.`);
  }
  
  console.log('✅ Vendedor encontrado:', vendedor);
  
  // Gerar número do pedido
  const numero_pedido = `PED-${Date.now()}`;
  
  // Calcular valor total
  const valor_total = pedidoData.itens.reduce(
    (sum, item) => sum + (item.quantidade_kg * item.preco_unitario),
    0
  );

  // Criar pedido
  const { data: pedido, error: pedidoError } = await supabase
    .from('pedidos')
    .insert({
      numero_pedido,
      cliente_id: pedidoData.cliente_id,
      tipo_pedido: pedidoData.tipo_pedido,
      data_entrega_prevista: pedidoData.data_entrega_prevista,
      vendedor_id: pedidoData.vendedor_id,
      valor_total,
      status: 'Pendente'
    })
    .select()
    .single();

  if (pedidoError) {
    console.error('❌ Erro ao inserir pedido:', pedidoError);
    throw pedidoError;
  }

  // Criar itens do pedido
  const itensComPedidoId = pedidoData.itens.map(item => ({
    pedido_id: pedido.id,
    produto_id: item.produto_id,
    quantidade_kg: item.quantidade_kg,
    preco_unitario: item.preco_unitario,
    subtotal: item.quantidade_kg * item.preco_unitario
  }));

  const { error: itensError } = await supabase
    .from('itens_pedido')
    .insert(itensComPedidoId);

  if (itensError) throw itensError;

  return pedido;
}

export async function updatePedidoStatus(id: string, status: string) {
  const { data, error } = await supabase
    .from('pedidos')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * ENTREGAS
 */
export async function getEntregas(filters?: { motorista_id?: string; status?: string }) {
  let query = supabase
    .from('entregas')
    .select(`
      *,
      pedido:pedidos(numero_pedido, cliente:clientes(nome)),
      motorista:usuarios(nome)
    `)
    .order('created_at', { ascending: false });

  if (filters?.motorista_id) {
    query = query.eq('motorista_id', filters.motorista_id);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createEntrega(entregaData: any) {
  const { data, error } = await supabase
    .from('entregas')
    .insert(entregaData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEntrega(id: string, updates: any) {
  const { data, error } = await supabase
    .from('entregas')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * FINANCEIRO
 */
export async function getFinanceiro(filters?: { tipo?: string; data_inicio?: string; data_fim?: string }) {
  let query = supabase
    .from('financeiro')
    .select('*')
    .order('data_transacao', { ascending: false });

  if (filters?.tipo) {
    query = query.eq('tipo', filters.tipo);
  }

  if (filters?.data_inicio) {
    query = query.gte('data_transacao', filters.data_inicio);
  }

  if (filters?.data_fim) {
    query = query.lte('data_transacao', filters.data_fim);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTransacao(transacaoData: any) {
  const { data, error } = await supabase
    .from('financeiro')
    .insert(transacaoData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * CÂMERAS
 */
export async function getCameras() {
  const { data, error } = await supabase
    .from('cameras')
    .select(`
      *,
      sala_ref:salas(id, codigo, nome, tipo, ativa)
    `)
    .order('localizacao');

  if (error) throw error;
  return data;
}

/**
 * CONTROLADORES DE SALA
 */
export async function getControladoresSala() {
  const { data, error } = await supabase
    .from('controladores_sala')
    .select(`
      id,
      nome,
      sala_id,
      localizacao,
      tipo,
      base_url,
      device_id,
      status,
      modo_padrao,
      relay_map,
      observacoes,
      created_at,
      updated_at,
      sala_ref:salas(id, codigo, nome, tipo, ativa)
    `)
    .order('localizacao');

  if (error) throw error;
  return data || [];
}

export async function getControladorSalaById(id: string) {
  const { data, error } = await supabase
    .from('controladores_sala')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * VISION PIPELINE RUNS
 */
const DEFAULT_VISION_STORAGE_BUCKET = 'vision-captures';
const VISION_STORAGE_BUCKET =
  Deno.env.get('SUPABASE_STORAGE_BUCKET') ||
  Deno.env.get('VISION_STORAGE_BUCKET') ||
  DEFAULT_VISION_STORAGE_BUCKET;
const VISION_PREVIEW_URL_EXPIRES_IN = 60 * 60;

function resolveVisionStorageBucket(run: any) {
  return (
    run?.storage_bucket ||
    run?.raw_result_json?.remote_persistence?.storage_bucket ||
    run?.raw_result_json?.remote_persistence?.storage_diagnostics?.bucket ||
    run?.raw_result_json?.storage_bucket ||
    VISION_STORAGE_BUCKET ||
    DEFAULT_VISION_STORAGE_BUCKET
  );
}

async function attachVisionPreviewUrl(run: any) {
  if (!run) return null;

  const storageBucket = resolveVisionStorageBucket(run);

  if (!run.image_storage_path || !storageBucket) {
    return {
      ...run,
      storage_bucket: storageBucket || null,
      preview_url: null,
      preview_expires_in_seconds: null,
    };
  }

  const { data, error } = await supabase
    .storage
    .from(storageBucket)
    .createSignedUrl(run.image_storage_path, VISION_PREVIEW_URL_EXPIRES_IN);

  if (error) {
    console.error('Erro ao criar signed URL da captura vision:', error);
    return {
      ...run,
      storage_bucket: storageBucket,
      preview_url: null,
      preview_expires_in_seconds: null,
      preview_error: error.message,
    };
  }

  return {
    ...run,
    storage_bucket: storageBucket,
    preview_url: data?.signedUrl || null,
    preview_expires_in_seconds: VISION_PREVIEW_URL_EXPIRES_IN,
  };
}

function normalizeTimelapseText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeCameraStreamUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function doesRunMatchCameraUrl(runUrl?: string | null, candidateUrl?: string | null) {
  const normalizedRun = normalizeCameraStreamUrl(runUrl);
  const normalizedCandidate = normalizeCameraStreamUrl(candidateUrl);
  if (!normalizedRun || !normalizedCandidate) return false;
  if (normalizedRun === normalizedCandidate) return true;

  try {
    const runParsed = new URL(normalizedRun);
    const candidateParsed = new URL(normalizedCandidate);
    return (
      runParsed.hostname === candidateParsed.hostname &&
      runParsed.pathname.replace(/\/$/, '') === candidateParsed.pathname.replace(/\/$/, '')
    );
  } catch {
    return normalizedRun === normalizedCandidate;
  }
}

function getVisionRunTimestamp(run: any) {
  return run?.captured_at || run?.executed_at || null;
}

function sampleVisionRunsAcrossTimeline(runs: any[], limit: number) {
  if (runs.length <= limit) {
    return runs;
  }

  if (limit <= 1) {
    return runs.slice(0, 1);
  }

  const sampledRuns = new Map<string, any>();
  const step = (runs.length - 1) / (limit - 1);

  for (let index = 0; index < limit; index += 1) {
    const targetIndex = Math.round(index * step);
    const run = runs[Math.min(targetIndex, runs.length - 1)];
    const key = String(run?.id || `${getVisionRunTimestamp(run) || 'run'}-${index}`);
    sampledRuns.set(key, run);
  }

  return Array.from(sampledRuns.values()).sort((a, b) => {
    const aDate = new Date(getVisionRunTimestamp(a) || 0).getTime();
    const bDate = new Date(getVisionRunTimestamp(b) || 0).getTime();
    return aDate - bDate;
  });
}

function getVisionRunDetections(run: any) {
  const candidates = [
    run?.raw_result_json?.detections,
    run?.summary_json?.detections,
    run?.raw_result_json?.summary?.detections,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(Boolean);
    }
  }

  return [];
}

function getVisionDetectionConfidence(detection: any) {
  const rawValue = detection?.confidence ?? detection?.score ?? detection?.conf ?? null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function getVisionRunBlockCount(run: any, detections: any[] = []) {
  const explicitCount = Number(
    run?.summary_json?.blocos_detectados ??
    run?.raw_result_json?.summary?.blocos_detectados ??
    run?.raw_result_json?.blocos_detectados ??
    NaN
  );

  if (Number.isFinite(explicitCount)) {
    return Math.max(0, Math.round(explicitCount));
  }

  return detections.length;
}

function getVisionRunAverageConfidence(detections: any[]) {
  const confidences = detections
    .map((detection) => getVisionDetectionConfidence(detection))
    .filter((value): value is number => value !== null);

  if (!confidences.length) return null;
  return confidences.reduce((sum, value) => sum + value, 0) / confidences.length;
}

function getVisionRunBlockCountSource(run: any) {
  if (Number.isFinite(Number(run?.summary_json?.blocos_detectados))) {
    return 'summary_json.blocos_detectados';
  }

  if (Number.isFinite(Number(run?.raw_result_json?.summary?.blocos_detectados))) {
    return 'raw_result_json.summary.blocos_detectados';
  }

  if (Number.isFinite(Number(run?.raw_result_json?.blocos_detectados))) {
    return 'raw_result_json.blocos_detectados';
  }

  return 'detections.length';
}

function getVisionRunDetectorError(run: any) {
  return (
    run?.raw_result_json?.block_detection?.error ||
    run?.summary_json?.block_detection_error ||
    null
  );
}

function sortVisionRunsByTimestampDesc(runs: any[]) {
  return [...runs].sort((a, b) => {
    const aDate = new Date(getVisionRunTimestamp(a) || 0).getTime();
    const bDate = new Date(getVisionRunTimestamp(b) || 0).getTime();
    return bDate - aDate;
  });
}

function dedupeVisionRunsById(runs: any[]) {
  const seen = new Set<string>();
  return runs.filter((run) => {
    const id = String(run?.id || '');
    if (!id || seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

function pickLatestVisionRun(loteLinkedRuns: any[], fallbackRuns: any[]) {
  const latestLoteLinkedRun = sortVisionRunsByTimestampDesc(loteLinkedRuns)[0] || null;
  const latestFallbackRun = sortVisionRunsByTimestampDesc(fallbackRuns)[0] || null;

  if (!latestLoteLinkedRun && !latestFallbackRun) {
    return { run: null, reason: 'no_candidates' as const };
  }

  if (latestLoteLinkedRun && !latestFallbackRun) {
    return { run: latestLoteLinkedRun, reason: 'latest_lote_linked_run' as const };
  }

  if (!latestLoteLinkedRun && latestFallbackRun) {
    return { run: latestFallbackRun, reason: 'latest_camera_fallback_run' as const };
  }

  const loteLinkedTimestamp = new Date(getVisionRunTimestamp(latestLoteLinkedRun) || 0).getTime();
  const fallbackTimestamp = new Date(getVisionRunTimestamp(latestFallbackRun) || 0).getTime();

  if (fallbackTimestamp > loteLinkedTimestamp) {
    return { run: latestFallbackRun, reason: 'camera_fallback_newer_than_lote_linked' as const };
  }

  return { run: latestLoteLinkedRun, reason: 'lote_linked_newer_or_equal' as const };
}

async function resolveExpectedBlockCountForLote(lote: any) {
  if (!lote?.id) {
    return { quantidadeEsperada: null, origem: null };
  }

  const blocos = await getLoteBlocos(lote.id);
  if (blocos.length) {
    return {
      quantidadeEsperada: blocos.length,
      origem: 'lotes_blocos',
    };
  }

  const unidade = normalizeTimelapseText(lote?.unidade);
  const quantidadeInicial = Number(lote?.quantidade_inicial);

  if (Number.isFinite(quantidadeInicial) && quantidadeInicial > 0 && unidade.includes('bloco')) {
    return {
      quantidadeEsperada: Math.max(0, Math.round(quantidadeInicial)),
      origem: 'quantidade_inicial',
    };
  }

  return { quantidadeEsperada: null, origem: null };
}

function getBlockAnalysisStatus(blocosDetectados: number | null, quantidadeEsperada: number | null) {
  if (blocosDetectados === null) {
    return { status: 'sem_analise', status_label: 'Sem análise' };
  }

  if (quantidadeEsperada === null || quantidadeEsperada <= 0) {
    return { status: 'sem_referencia', status_label: 'Sem referência' };
  }

  const diferencaRelativa = Math.abs(blocosDetectados - quantidadeEsperada) / quantidadeEsperada;

  if (diferencaRelativa <= 0.1) {
    return { status: 'ok', status_label: 'OK' };
  }

  if (diferencaRelativa <= 0.3) {
    return { status: 'atencao', status_label: 'Atenção' };
  }

  return { status: 'critico', status_label: 'Crítico' };
}

interface VisionRunFilters {
  quality_status?: string;
  remote_status?: 'ok' | 'failed' | 'pending';
  days?: number;
  limit?: number;
}

export async function getVisionPipelineLatestRun() {
  const { data, error } = await supabase
    .from('vision_pipeline_runs')
    .select('*')
    .order('executed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return attachVisionPreviewUrl(data);
}

export async function getVisionPipelineRuns(filters?: VisionRunFilters) {
  let query = supabase
    .from('vision_pipeline_runs')
    .select('*')
    .order('executed_at', { ascending: false });

  const limit = Math.max(1, Math.min(Number(filters?.limit || 20), 100));
  query = query.limit(Math.max(limit * 3, 50));

  if (filters?.quality_status) {
    query = query.eq('quality_status', filters.quality_status);
  }

  if (filters?.days && Number.isFinite(filters.days) && filters.days > 0) {
    const since = new Date(Date.now() - filters.days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('executed_at', since);
  }

  const { data, error } = await query;
  if (error) throw error;

  let runs = data || [];

  if (filters?.remote_status) {
    runs = runs.filter((run) => {
      const remote = run?.raw_result_json?.remote_persistence;
      if (!remote) {
        return filters.remote_status === 'pending';
      }

      if (filters.remote_status === 'ok') {
        return Boolean(remote.remote_persisted);
      }

      if (filters.remote_status === 'failed') {
        return Boolean(remote.error || remote.storage_uploaded || remote.db_record_created) && !remote.remote_persisted;
      }

      return !remote.remote_persisted && !remote.error && !remote.storage_uploaded && !remote.db_record_created;
    });
  }

  runs = runs.slice(0, limit);
  return Promise.all(runs.map((run) => attachVisionPreviewUrl(run)));
}

export async function getVisionPipelineRunById(id: string) {
  const { data, error } = await supabase
    .from('vision_pipeline_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return attachVisionPreviewUrl(data);
}

async function resolveVisionRunsForLote(loteId: string, limitHint = 120) {
  const lote = await getLoteById(loteId);
  if (!lote) return null;

  const sala = normalizeTimelapseText(lote.sala);
  const codigo = normalizeTimelapseText(lote.codigo_lote);
  const loteStartAt = lote.data_inoculacao || lote.data_inicio || null;
  const loteStartTime = loteStartAt ? new Date(loteStartAt).getTime() : null;
  const loteAgeDays = loteStartTime && Number.isFinite(loteStartTime)
    ? Math.max(1, Math.ceil((Date.now() - loteStartTime) / (1000 * 60 * 60 * 24)))
    : 30;
  const periodStartTime = loteStartTime && Number.isFinite(loteStartTime)
    ? loteStartTime - (24 * 60 * 60 * 1000)
    : null;
  const cameras = await getCameras();
  const camerasAtivas = cameras.filter((camera) => normalizeTimelapseText(camera.status || 'ativa') !== 'inativa');
  const cameraBase = camerasAtivas.length ? camerasAtivas : cameras;

  let matchedCameras = cameraBase.filter((camera) => {
    const nome = normalizeTimelapseText(camera.nome);
    const localizacao = normalizeTimelapseText(camera.localizacao);
    const matchSala =
      !!sala &&
      (nome.includes(sala) ||
        localizacao.includes(sala) ||
        sala.includes(nome) ||
        sala.includes(localizacao));
    const matchCodigo = !!codigo && (nome.includes(codigo) || localizacao.includes(codigo));
    return matchSala || matchCodigo;
  });

  const fetchLimit = Math.max(Math.min(Math.max(limitHint * 6, loteAgeDays * 48), 3000), 240);

  let query = supabase
    .from('vision_pipeline_runs')
    .select('*')
    .order('captured_at', { ascending: false, nullsFirst: false })
    .order('executed_at', { ascending: false })
    .limit(fetchLimit);

  const { data, error } = await query;
  if (error) throw error;

  const runs = (data || []).sort((a, b) => {
    const aDate = new Date(getVisionRunTimestamp(a) || 0).getTime();
    const bDate = new Date(getVisionRunTimestamp(b) || 0).getTime();
    return aDate - bDate;
  });
  const runsWithinLotePeriod = periodStartTime
    ? runs.filter((run) => {
        const timestamp = new Date(getVisionRunTimestamp(run) || 0).getTime();
        return Number.isFinite(timestamp) && timestamp >= periodStartTime;
      })
    : runs;

  const loteLinkedRuns = runsWithinLotePeriod.filter((run) => {
    const linkedLoteId =
      run?.lote_id ||
      run?.raw_result_json?.capture_metadata?.lote_id ||
      run?.raw_result_json?.lote_id ||
      run?.summary_json?.lote_id ||
      null;

    return linkedLoteId === loteId;
  });

  let selectedRuns = loteLinkedRuns;
  let matchStrategy: 'lote_id' | 'camera_period' | 'single_camera_fallback' | 'empty' = 'lote_id';

  if (!selectedRuns.length) {
    if (!matchedCameras.length) {
      if (cameraBase.length === 1) {
        matchedCameras = [cameraBase[0]];
      } else if (camerasAtivas.length === 1) {
        matchedCameras = [camerasAtivas[0]];
      }
    }

    const matchedCameraUrls = matchedCameras
      .map((camera) => String(camera.url_stream || '').trim())
      .filter(Boolean);

    if (matchedCameraUrls.length) {
      selectedRuns = runsWithinLotePeriod.filter((run) =>
        matchedCameraUrls.some((candidateUrl) => doesRunMatchCameraUrl(run.camera_url, candidateUrl))
      );
      matchStrategy = selectedRuns.length
        ? matchedCameras.length === 1 && !sala && !codigo
          ? 'single_camera_fallback'
          : 'camera_period'
        : 'empty';
    } else {
      matchStrategy = 'empty';
    }
  }

  const matchedCameraUrls = matchedCameras
    .map((camera) => String(camera.url_stream || '').trim())
    .filter(Boolean);

  const cameraMatchedRuns = matchedCameraUrls.length
    ? runsWithinLotePeriod.filter((run) =>
        matchedCameraUrls.some((candidateUrl) => doesRunMatchCameraUrl(run.camera_url, candidateUrl))
      )
    : [];

  return {
    lote,
    match_strategy: matchStrategy,
    matched_cameras: matchedCameras,
    lote_linked_runs: loteLinkedRuns,
    camera_fallback_runs: cameraMatchedRuns,
    selected_runs: selectedRuns,
  };
}

export async function getVisionTimelapseRunsByLoteId(loteId: string, limit = 120) {
  const resolution = await resolveVisionRunsForLote(loteId, limit);
  if (!resolution) return null;

  const { lote, match_strategy: matchStrategy, matched_cameras: matchedCameras, selected_runs: selectedRuns } = resolution;
  const totalFrameCount = selectedRuns.length;
  const limitedRuns = sampleVisionRunsAcrossTimeline(selectedRuns, limit);
  const frames = await Promise.all(
    limitedRuns.map(async (run, index) => {
      const withPreview = await attachVisionPreviewUrl(run);
      return {
        id: withPreview?.id,
        sequence_index: index,
        captured_at: withPreview?.captured_at || withPreview?.executed_at || null,
        executed_at: withPreview?.executed_at || null,
        preview_url: withPreview?.preview_url || null,
        image_storage_path: withPreview?.image_storage_path || null,
        quality_status: withPreview?.quality_status || withPreview?.raw_result_json?.quality_check?.status || null,
        dataset_class:
          withPreview?.dataset_class ||
          withPreview?.dataset_classification_json?.dataset_class ||
          withPreview?.raw_result_json?.dataset_classification?.dataset_class ||
          null,
        blocos_detectados:
          Number(
            withPreview?.summary_json?.blocos_detectados ??
            withPreview?.raw_result_json?.summary?.blocos_detectados ??
            0
          ) || 0,
      };
    })
  );

  return {
    lote: {
      id: lote.id,
      codigo_lote: lote.codigo_lote,
      sala: lote.sala || null,
      data_inicio: lote.data_inicio || null,
      data_inoculacao: lote.data_inoculacao || null,
      data_previsao_colheita: lote.data_previsao_colheita || null,
    },
    match_strategy: matchStrategy,
    matched_cameras: matchedCameras.map((camera) => ({
      id: camera.id,
      nome: camera.nome,
      localizacao: camera.localizacao,
      url_stream: camera.url_stream || null,
    })),
    frame_count: totalFrameCount,
    frames,
    empty_reason: frames.length
      ? null
      : matchStrategy === 'empty'
        ? 'Nenhuma captura vision vinculada por lote_id ou por câmera/sala no período do lote.'
        : 'Nenhuma captura vision encontrada para este lote.',
  };
}

export async function getVisionLatestBlockAnalysisByLoteId(loteId: string) {
  const resolution = await resolveVisionRunsForLote(loteId, 12);
  if (!resolution) return null;

  const {
    lote,
    match_strategy: matchStrategy,
    matched_cameras: matchedCameras,
    selected_runs: selectedRuns,
    lote_linked_runs: loteLinkedRuns,
    camera_fallback_runs: cameraFallbackRuns,
  } = resolution;
  const expectedBlockCount = await resolveExpectedBlockCountForLote(lote);

  const candidateRuns = dedupeVisionRunsById([...(loteLinkedRuns || []), ...(cameraFallbackRuns || [])]);
  const { run: selectedRunRaw, reason: selectionReason } = pickLatestVisionRun(
    loteLinkedRuns || [],
    cameraFallbackRuns || [],
  );
  const selectedRun = selectedRunRaw ? await attachVisionPreviewUrl(selectedRunRaw) : null;

  const detections = getVisionRunDetections(selectedRun);
  const blocosDetectados = selectedRun ? getVisionRunBlockCount(selectedRun, detections) : null;
  const blockCountSource = selectedRun ? getVisionRunBlockCountSource(selectedRun) : null;
  const detectorError = selectedRun ? getVisionRunDetectorError(selectedRun) : null;
  const confiancaMedia =
    selectedRun?.summary_json?.confianca_media_blocos ??
    selectedRun?.raw_result_json?.summary?.confianca_media_blocos ??
    (selectedRun ? getVisionRunAverageConfidence(detections) : null);
  const ultimoTimestampAnalise = selectedRun?.captured_at || selectedRun?.executed_at || null;
  const diferencaBlocos =
    blocosDetectados !== null && expectedBlockCount.quantidadeEsperada !== null
      ? blocosDetectados - expectedBlockCount.quantidadeEsperada
      : null;
  const statusInfo = getBlockAnalysisStatus(blocosDetectados, expectedBlockCount.quantidadeEsperada);
  const effectiveMatchStrategy =
    selectionReason === 'latest_camera_fallback_run' || selectionReason === 'camera_fallback_newer_than_lote_linked'
      ? matchedCameras.length === 1 && !(lote?.sala || lote?.codigo_lote)
        ? 'single_camera_fallback'
        : 'camera_period'
      : matchStrategy;

  console.log('[vision.analise_visual] selected run', {
    lote_id: lote.id,
    codigo_lote: lote.codigo_lote,
    match_strategy: effectiveMatchStrategy,
    selection_reason: selectionReason,
    selected_run_id: selectedRun?.id || null,
    selected_run_timestamp: ultimoTimestampAnalise,
    candidate_runs_count: candidateRuns.length,
    lote_linked_runs_count: loteLinkedRuns.length,
    camera_fallback_runs_count: cameraFallbackRuns.length,
    selected_run_blocos_detectados: blocosDetectados,
    selected_run_block_count_source: blockCountSource,
    selected_run_has_detections: detections.length > 0,
    selected_run_detector_error: detectorError,
    matched_cameras_count: matchedCameras.length,
  });

  return {
    lote: {
      id: lote.id,
      codigo_lote: lote.codigo_lote,
      sala: lote.sala || lote?.sala_ref?.nome || null,
    },
    analise_disponivel: Boolean(selectedRun),
    run_id: selectedRun?.id || null,
    match_strategy: effectiveMatchStrategy || null,
    run_diagnostics: {
      selected_run_id: selectedRun?.id || null,
      selected_run_timestamp: ultimoTimestampAnalise,
      selection_reason: selectionReason,
      candidate_runs_count: candidateRuns.length,
      lote_linked_runs_count: loteLinkedRuns.length,
      camera_fallback_runs_count: cameraFallbackRuns.length,
      block_count_source: blockCountSource,
      detector_error: detectorError,
      matched_cameras_count: matchedCameras.length,
    },
    blocos_detectados: blocosDetectados,
    quantidade_esperada: expectedBlockCount.quantidadeEsperada,
    quantidade_esperada_origem: expectedBlockCount.origem,
    diferenca_blocos: diferencaBlocos,
    confianca_media: confiancaMedia,
    ultimo_timestamp_analise: ultimoTimestampAnalise,
    status: statusInfo.status,
    status_label: statusInfo.status_label,
    imagem_preview_url: selectedRun?.preview_url || null,
    detections: detections.map((detection) => ({
      label: detection?.label || detection?.class_name || detection?.class || 'bloco',
      confidence: getVisionDetectionConfidence(detection),
      bbox: Array.isArray(detection?.bbox)
        ? detection.bbox
        : Array.isArray(detection?.box)
          ? detection.box
          : null,
    })),
  };
}

/**
 * USUÁRIOS
 */
export async function getUsuarios(tipo?: string) {
  let query = supabase
    .from('usuarios')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (tipo) {
    query = query.eq('tipo_usuario', tipo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * ROTAS E LOGÍSTICA
 */

// Buscar motoristas disponíveis
export async function getMotoristas() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, telefone')
    .eq('tipo_usuario', 'motorista')
    .eq('ativo', true)
    .order('nome');
  
  console.log('🚚 Buscando motoristas...');
  console.log('🚚 Motoristas encontrados:', data?.length || 0);
  if (data && data.length > 0) {
    console.log('🚚 Lista de motoristas:', data);
  }
  
  if (error) {
    console.error('❌ Erro ao buscar motoristas:', error);
    throw error;
  }
  
  return data;
}

// Criar motorista
export async function createMotorista(motoristaData: {
  nome: string;
  email: string;
  telefone?: string;
  cpf?: string;
  cnh?: string;
}) {
  // Gerar um UUID aleatório para o motorista (não precisa estar em auth.users)
  const motoristaId = crypto.randomUUID();
  
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id: motoristaId,
      ...motoristaData,
      tipo_usuario: 'motorista',
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Erro ao criar motorista no banco:', error);
    
    // Mensagens de erro amigáveis
    if (error.code === '23505') {
      // Unique violation
      if (error.message.includes('email')) {
        throw new Error(`Email ${motoristaData.email} já está cadastrado no sistema`);
      }
      throw new Error('Já existe um registro com esses dados');
    }
    
    if (error.code === '23503') {
      // Foreign key violation
      throw new Error('Erro de relacionamento no banco de dados. Por favor, execute o script SQL em /EXECUTE-AGORA.sql');
    }
    
    throw new Error(error.message || 'Erro ao criar motorista');
  }
  
  return data;
}

// Atualizar motorista
export async function updateMotorista(id: string, updates: any) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Desativar motorista (soft delete)
export async function deleteMotorista(id: string) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ ativo: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Buscar todas as rotas
export async function getRotas(filters?: { status?: string; motorista_id?: string }) {
  let query = supabase
    .from('rotas')
    .select(`
      *,
      motorista:usuarios!rotas_motorista_id_fkey(id, nome, telefone),
      paradas:rotas_paradas(
        *,
        pedido:pedidos(
          *,
          cliente:clientes(id, nome, endereco, telefone, bairro, cidade)
        )
      )
    `)
    .order('data_rota', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.motorista_id) {
    query = query.eq('motorista_id', filters.motorista_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Sugerir rotas automaticamente baseado em pedidos prontos
export async function sugerirRotas() {
  // Buscar pedidos com status "Pronto" ou "Confirmado"
  const { data: pedidos, error: pedidosError } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(id, nome, endereco, telefone, bairro, cidade)
    `)
    .in('status', ['Pronto', 'Confirmado'])
    .order('data_entrega_prevista', { ascending: true });

  if (pedidosError) throw pedidosError;

  // Agrupar pedidos por cidade/bairro
  const pedidosPorRegiao: Record<string, any[]> = {};
  
  pedidos?.forEach(pedido => {
    const regiao = pedido.cliente?.bairro || pedido.cliente?.cidade || 'Outros';
    if (!pedidosPorRegiao[regiao]) {
      pedidosPorRegiao[regiao] = [];
    }
    pedidosPorRegiao[regiao].push(pedido);
  });

  // Criar sugestões de rotas
  const sugestoes = Object.entries(pedidosPorRegiao).map(([regiao, pedidosRegiao]) => ({
    nome: `Rota ${regiao}`,
    regiao,
    pedidos: pedidosRegiao,
    total_pedidos: pedidosRegiao.length,
    estimativa_tempo: pedidosRegiao.length * 20, // 20 min por parada
  }));

  return sugestoes;
}

// Criar nova rota
export async function createRota(rotaData: {
  nome: string;
  motorista_id: string;
  data_rota: string;
  pedidos_ids: string[];
  observacoes?: string;
}) {
  console.log('createRota - Dados recebidos:', JSON.stringify(rotaData, null, 2));

  // Gerar código único da rota
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const count = await supabase
    .from('rotas')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-${month}-${day}T00:00:00`);
  
  const nextNumber = (count.count || 0) + 1;
  const codigoRota = `RT-${year}${month}${day}-${String(nextNumber).padStart(3, '0')}`;

  // Criar a rota
  const { data: rota, error: rotaError } = await supabase
    .from('rotas')
    .insert({
      codigo_rota: codigoRota,
      nome: rotaData.nome,
      motorista_id: rotaData.motorista_id,
      data_rota: rotaData.data_rota,
      status: 'Pendente',
      observacoes: rotaData.observacoes,
    })
    .select()
    .single();

  if (rotaError) throw rotaError;

  // Criar paradas para cada pedido
  const paradasData = rotaData.pedidos_ids.map((pedido_id, index) => ({
    rota_id: rota.id,
    pedido_id,
    ordem: index + 1,
    status: 'Pendente',
  }));

  const { error: paradasError } = await supabase
    .from('rotas_paradas')
    .insert(paradasData);

  if (paradasError) throw paradasError;

  // Atualizar status dos pedidos para "Em Preparação"
  const { error: pedidosError } = await supabase
    .from('pedidos')
    .update({ status: 'Preparando' })
    .in('id', rotaData.pedidos_ids);

  if (pedidosError) throw pedidosError;

  return rota;
}

// Iniciar rota (atualiza status para "Em Andamento")
export async function iniciarRota(rotaId: string) {
  const { data, error } = await supabase
    .from('rotas')
    .update({ 
      status: 'Em Andamento',
      hora_inicio: new Date().toISOString(),
    })
    .eq('id', rotaId)
    .select()
    .single();

  if (error) throw error;

  // Atualizar pedidos da rota para "Em Rota"
  const { data: paradas } = await supabase
    .from('rotas_paradas')
    .select('pedido_id')
    .eq('rota_id', rotaId);

  if (paradas && paradas.length > 0) {
    const pedidosIds = paradas.map(p => p.pedido_id);
    await supabase
      .from('pedidos')
      .update({ status: 'Em Rota' })
      .in('id', pedidosIds);
  }

  return data;
}

// Atualizar status de uma parada
export async function atualizarParada(paradaId: string, status: string, hora_entrega?: string) {
  const updates: any = { status };
  
  if (status === 'Entregue' && hora_entrega) {
    updates.hora_entrega = hora_entrega;
  }

  const { data, error } = await supabase
    .from('rotas_paradas')
    .update(updates)
    .eq('id', paradaId)
    .select()
    .single();

  if (error) throw error;

  // Se a parada foi entregue, atualizar o pedido
  if (status === 'Entregue') {
    await supabase
      .from('pedidos')
      .update({ status: 'Entregue', data_entrega_real: hora_entrega })
      .eq('id', data.pedido_id);
  }

  return data;
}

// Finalizar rota
export async function finalizarRota(rotaId: string) {
  const { data, error } = await supabase
    .from('rotas')
    .update({ 
      status: 'Concluída',
      hora_fim: new Date().toISOString(),
    })
    .eq('id', rotaId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Cancelar rota
export async function cancelarRota(rotaId: string, motivo?: string) {
  const { data, error } = await supabase
    .from('rotas')
    .update({ 
      status: 'Cancelada',
      observacoes: motivo,
    })
    .eq('id', rotaId)
    .select()
    .single();

  if (error) throw error;

  // Reverter status dos pedidos para "Pronto"
  const { data: paradas } = await supabase
    .from('rotas_paradas')
    .select('pedido_id')
    .eq('rota_id', rotaId);

  if (paradas && paradas.length > 0) {
    const pedidosIds = paradas.map(p => p.pedido_id);
    await supabase
      .from('pedidos')
      .update({ status: 'Pronto' })
      .in('id', pedidosIds);
  }

  return data;
}

/**
 * COMPRAS E FORNECEDORES
 */

// Buscar todas as compras
export async function getCompras() {
  const { data, error } = await supabase
    .from('compras')
    .select(`
      *,
      fornecedor:fornecedores(nome, tipo_fornecedor)
    `)
    .order('data_compra', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Criar compra
export async function createCompra(compraData: {
  fornecedor_id: string;
  categoria: string;
  tipo_custo: 'Fixo' | 'Variável';
  valor_total: number;
  data_compra: string;
  data_vencimento?: string | null;
  status_pagamento: string;
  observacoes?: string | null;
  itens?: any[];
}) {
  // Gerar número único da compra
  const now = new Date();
  const year = now.getFullYear();
  const count = await supabase
    .from('compras')
    .select('id', { count: 'exact', head: true });
  
  const nextNumber = (count.count || 0) + 1;
  const numeroCompra = `CP-${year}-${String(nextNumber).padStart(4, '0')}`;

  const { data, error } = await supabase
    .from('compras')
    .insert({
      numero_compra: numeroCompra,
      fornecedor_id: compraData.fornecedor_id,
      categoria: compraData.categoria,
      tipo_custo: compraData.tipo_custo,
      valor_total: compraData.valor_total,
      data_compra: compraData.data_compra,
      data_vencimento: compraData.data_vencimento,
      status_pagamento: compraData.status_pagamento,
      observacoes: compraData.observacoes,
      itens: compraData.itens || []
    })
    .select(`
      *,
      fornecedor:fornecedores(nome, tipo_fornecedor)
    `)
    .single();

  if (error) {
    console.error('Erro ao criar compra no banco:', error);
    throw error;
  }

  return data;
}

// Buscar todos os fornecedores
export async function getFornecedores() {
  const { data, error } = await supabase
    .from('fornecedores')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Criar fornecedor
export async function createFornecedor(fornecedorData: {
  nome: string;
  cnpj?: string | null;
  tipo_fornecedor: string;
  contato?: string | null;
  email?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
}) {
  const { data, error } = await supabase
    .from('fornecedores')
    .insert({
      nome: fornecedorData.nome,
      cnpj: fornecedorData.cnpj,
      tipo_fornecedor: fornecedorData.tipo_fornecedor,
      contato: fornecedorData.contato,
      email: fornecedorData.email,
      endereco: fornecedorData.endereco,
      observacoes: fornecedorData.observacoes
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao criar fornecedor no banco:', error);
    throw error;
  }

  return data;
}
