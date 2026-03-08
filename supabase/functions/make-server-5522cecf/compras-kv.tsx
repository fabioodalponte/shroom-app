import * as kv from "./kv_store.tsx";

/**
 * COMPRAS E FORNECEDORES - Usando KV Store
 */

// Buscar todas as compras
export async function getComprasKV() {
  const compras = await kv.getByPrefix('compra:');
  return compras;
}

// Criar compra
export async function createCompraKV(compraData: {
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
  // Gerar ID e número único da compra
  const id = crypto.randomUUID();
  const now = new Date();
  const year = now.getFullYear();
  
  // Buscar compras existentes para gerar número sequencial
  const comprasExistentes = await kv.getByPrefix('compra:');
  const nextNumber = comprasExistentes.length + 1;
  const numeroCompra = `CP-${year}-${String(nextNumber).padStart(4, '0')}`;

  // Buscar fornecedor
  const fornecedor = await kv.get(`fornecedor:${compraData.fornecedor_id}`);

  const compra = {
    id,
    numero_compra: numeroCompra,
    fornecedor_id: compraData.fornecedor_id,
    fornecedor: fornecedor ? {
      nome: fornecedor.nome,
      tipo_fornecedor: fornecedor.tipo_fornecedor
    } : null,
    categoria: compraData.categoria,
    tipo_custo: compraData.tipo_custo,
    valor_total: compraData.valor_total,
    data_compra: compraData.data_compra,
    data_vencimento: compraData.data_vencimento,
    status_pagamento: compraData.status_pagamento,
    observacoes: compraData.observacoes,
    itens: compraData.itens || [],
    created_at: new Date().toISOString()
  };

  await kv.set(`compra:${id}`, compra);
  return compra;
}

// Buscar todos os fornecedores
export async function getFornecedoresKV() {
  const fornecedores = await kv.getByPrefix('fornecedor:');
  return fornecedores;
}

// Criar fornecedor
export async function createFornecedorKV(fornecedorData: {
  nome: string;
  cnpj?: string | null;
  tipo_fornecedor: string;
  contato?: string | null;
  email?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
}) {
  const id = crypto.randomUUID();
  
  const fornecedor = {
    id,
    nome: fornecedorData.nome,
    cnpj: fornecedorData.cnpj,
    tipo_fornecedor: fornecedorData.tipo_fornecedor,
    contato: fornecedorData.contato,
    email: fornecedorData.email,
    endereco: fornecedorData.endereco,
    observacoes: fornecedorData.observacoes,
    created_at: new Date().toISOString()
  };

  await kv.set(`fornecedor:${id}`, fornecedor);
  return fornecedor;
}

// Buscar progresso dos treinamentos
export async function getTreinamentosKV() {
  const processos = await kv.get('treinamentos:processos');
  return processos || [];
}

// Salvar progresso dos treinamentos
export async function salvarTreinamentosKV(processos: any[]) {
  await kv.set('treinamentos:processos', processos);
  return true;
}