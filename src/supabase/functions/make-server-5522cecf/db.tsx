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

/**
 * LOTES
 */
export async function getLotes(filters?: { status?: string; sala?: string; fase_operacional?: string }) {
  let query = supabase
    .from('lotes')
    .select(`
      *,
      produto:produtos(*),
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
  
  const { data, error } = await supabase
    .from('lotes')
    .insert({
      ...loteData,
      codigo_lote: codigoLote,
      qr_code: codigoLote, // Pode ser usado para gerar QR code depois
      fase_operacional: faseOrNull(loteData?.fase_operacional) || 'esterilizacao',
      fase_atualizada_em: new Date().toISOString(),
    })
    .select(`
      *,
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
  if (payload.fase_operacional) {
    const fase = faseOrNull(payload.fase_operacional);
    payload.fase_operacional = fase || payload.fase_operacional;
    payload.fase_atualizada_em = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('lotes')
    .update(payload)
    .eq('id', id)
    .select()
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
    .select('id, codigo_lote, sala')
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
      produto:produtos(*),
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
}

export async function updateLoteFase(input: UpdateLoteFaseInput) {
  const updates: Record<string, unknown> = {
    fase_operacional: input.fase_operacional,
    fase_atualizada_em: new Date().toISOString(),
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
  const faseAtualizada = await updateLoteFase({
    lote_id: input.lote_id,
    fase_operacional: 'inoculacao',
    observacoes: input.observacoes,
    usuario_id: input.usuario_id ?? null,
    detalhes: { origem: 'operacao_inoculacao' },
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
      data_incubacao: new Date().toISOString(),
    })
    .in('id', blocos.map((bloco) => bloco.id));

  if (updateBlocosError) {
    throw updateBlocosError;
  }

  await updateLoteFase({
    lote_id: input.lote_id,
    fase_operacional: 'incubacao',
    observacoes: 'Inoculação concluída e lote em incubação',
    usuario_id: input.usuario_id ?? null,
    detalhes: {
      blocos_criados: blocos.length,
      origem: 'operacao_inoculacao',
    },
  });

  return {
    lote: faseAtualizada,
    blocos_criados: blocos.length,
  };
}

interface RegistrarFrutificacaoInput {
  lote_id: string;
  bloco_ids?: string[] | null;
  observacoes?: string | null;
  usuario_id?: string | null;
}

export async function registrarFrutificacao(input: RegistrarFrutificacaoInput) {
  const blocosDoLote = await getLoteBlocos(input.lote_id);
  const elegiveis = blocosDoLote.filter((bloco) => ['inoculado', 'incubacao'].includes(String(bloco.status_bloco)));

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
  lote_id: string;
  temperatura?: number | null;
  umidade?: number | null;
  co2_ppm?: number | null;
  luminosidade_lux?: number | null;
  timestamp?: string | null;
}

export async function createLeituraSensor(input: LeituraSensorInput) {
  const payload: Record<string, unknown> = {
    lote_id: input.lote_id,
  };

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
          umidade_ideal_max
        )
      )
    `)
    .single();

  if (error) throw error;

  const loteUpdates: Record<string, unknown> = {};
  if (typeof input.temperatura === 'number') loteUpdates.temperatura_atual = input.temperatura;
  if (typeof input.umidade === 'number') loteUpdates.umidade_atual = input.umidade;

  if (Object.keys(loteUpdates).length > 0) {
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
          umidade_ideal_max
        )
      )
    `)
    .order('timestamp', { ascending: false })
    .limit(filters?.limit ?? 500);

  if (filters?.lote_id) {
    query = query.eq('lote_id', filters.lote_id);
  }

  if (filters?.since) {
    query = query.gte('timestamp', filters.since);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
export async function getProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) throw error;
  return data;
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
    .select('*')
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
    .select('id, nome, localizacao, tipo, base_url, device_id, status, modo_padrao, relay_map, observacoes, created_at, updated_at')
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
const VISION_STORAGE_BUCKET =
  Deno.env.get('SUPABASE_STORAGE_BUCKET') ||
  Deno.env.get('VISION_STORAGE_BUCKET') ||
  '';
const VISION_PREVIEW_URL_EXPIRES_IN = 60 * 60;

async function attachVisionPreviewUrl(run: any) {
  if (!run) return null;

  if (!run.image_storage_path || !VISION_STORAGE_BUCKET) {
    return {
      ...run,
      storage_bucket: VISION_STORAGE_BUCKET || null,
      preview_url: null,
      preview_expires_in_seconds: null,
    };
  }

  const { data, error } = await supabase
    .storage
    .from(VISION_STORAGE_BUCKET)
    .createSignedUrl(run.image_storage_path, VISION_PREVIEW_URL_EXPIRES_IN);

  if (error) {
    console.error('Erro ao criar signed URL da captura vision:', error);
    return {
      ...run,
      storage_bucket: VISION_STORAGE_BUCKET,
      preview_url: null,
      preview_expires_in_seconds: null,
      preview_error: error.message,
    };
  }

  return {
    ...run,
    storage_bucket: VISION_STORAGE_BUCKET,
    preview_url: data?.signedUrl || null,
    preview_expires_in_seconds: VISION_PREVIEW_URL_EXPIRES_IN,
  };
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
