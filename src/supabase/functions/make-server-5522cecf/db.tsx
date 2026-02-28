import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Cliente Supabase para operações de banco de dados
export const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

/**
 * LOTES
 */
export async function getLotes(filters?: { status?: string; sala?: string }) {
  let query = supabase
    .from('lotes')
    .select(`
      *,
      produto:produtos(*),
      responsavel:usuarios(id, nome, email)
    `)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.sala) {
    query = query.eq('sala', filters.sala);
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
      qr_code: codigoLote // Pode ser usado para gerar QR code depois
    })
    .select(`
      *,
      produto:produtos(*),
      responsavel:usuarios(id, nome, email)
    `)
    .single();

  if (error) throw error;
  return data;
}

export async function updateLote(id: string, updates: any) {
  const { data, error } = await supabase
    .from('lotes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
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
  
  const { data, error } = await supabase
    .from('colheitas')
    .insert(dadosColheita)
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
      lote_id: dadosColheita.lote_id,
      quantidade_kg: dadosColheita.quantidade_kg,
      qualidade: dadosColheita.qualidade,
      status: 'Disponível'
    });
  }

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
