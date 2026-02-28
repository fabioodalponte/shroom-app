import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as auth from "./auth.tsx";
import * as db from "./db.tsx";
import * as comprasKV from "./compras-kv.tsx";

const app = new Hono();
const isAdminUser = (user: any) => String(user?.tipo_usuario || '').toLowerCase() === 'admin';
const SENSOR_INGEST_HEADER = 'x-sensores-key';

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof value === 'string') {
    const input = value.trim();
    if (!input) return null;

    if (/^\d+$/.test(input)) {
      const numericValue = Number.parseInt(input, 10);
      const millis = input.length >= 13 ? numericValue : numericValue * 1000;
      return new Date(millis).toISOString();
    }

    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function clampHours(value: string | null, fallback = 24) {
  const parsed = Number.parseInt(value || '', 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 24 * 7));
}

function calculateRisk(
  atual: { temperatura: number; umidade: number; co2: number },
  produto?: {
    temperatura_ideal_min?: number | null;
    temperatura_ideal_max?: number | null;
    umidade_ideal_min?: number | null;
    umidade_ideal_max?: number | null;
  } | null,
) {
  const alertas: string[] = [];
  let score = 0;

  const tempMin = parseNumber(produto?.temperatura_ideal_min) ?? 20;
  const tempMax = parseNumber(produto?.temperatura_ideal_max) ?? 26;
  const umidMin = parseNumber(produto?.umidade_ideal_min) ?? 80;
  const umidMax = parseNumber(produto?.umidade_ideal_max) ?? 90;

  if (atual.temperatura < tempMin) {
    score += 25;
    alertas.push(`Temperatura abaixo do ideal (${atual.temperatura.toFixed(1)}°C)`);
  }
  if (atual.temperatura > tempMax) {
    score += 25;
    alertas.push(`Temperatura acima do ideal (${atual.temperatura.toFixed(1)}°C)`);
  }

  if (atual.umidade < umidMin) {
    score += 20;
    alertas.push(`Umidade abaixo do ideal (${atual.umidade.toFixed(0)}%)`);
  }
  if (atual.umidade > umidMax) {
    score += 20;
    alertas.push(`Umidade acima do ideal (${atual.umidade.toFixed(0)}%)`);
  }

  if (atual.co2 > 2000) {
    score += 35;
    alertas.push(`CO2 crítico (${atual.co2.toFixed(0)} ppm)`);
  } else if (atual.co2 > 1500) {
    score += 25;
    alertas.push(`CO2 elevado (${atual.co2.toFixed(0)} ppm)`);
  } else if (atual.co2 > 1200) {
    score += 10;
    alertas.push(`CO2 em atenção (${atual.co2.toFixed(0)} ppm)`);
  }

  return {
    score: Math.min(100, score),
    alertas,
  };
}

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// ============================================
// HEALTH CHECK
// ============================================
app.get("/make-server-5522cecf/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /setup/status - Estado inicial do sistema
 */
app.get("/make-server-5522cecf/setup/status", async (c) => {
  try {
    const usersCount = await auth.getUsersCount();
    const setupComplete = usersCount > 0;
    return c.json({
      setup_complete: setupComplete,
      users_count: usersCount,
      allow_public_signup: !setupComplete,
      first_user_must_be_admin: !setupComplete,
    });
  } catch (error) {
    console.error('Erro ao verificar setup:', error);
    return c.json({ error: error.message || 'Erro ao verificar setup' }, 500);
  }
});

// ============================================
// SENSORES (INGESTÃO + MONITORAMENTO)
// ============================================

app.post("/make-server-5522cecf/sensores/ingest", async (c) => {
  try {
    const expectedKey = Deno.env.get('SENSORES_INGEST_KEY');
    if (!expectedKey) {
      return c.json({ error: 'SENSORES_INGEST_KEY não configurada no servidor' }, 500);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await c.req.json();
    } catch {
      try {
        body = (await c.req.parseBody()) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const providedKey =
      c.req.header(SENSOR_INGEST_HEADER) ||
      c.req.query('key') ||
      String(body.key ?? '');

    if (!providedKey || providedKey !== expectedKey) {
      return c.json({ error: 'Webhook não autorizado' }, 401);
    }

    const pin = String(body.pin ?? body.datastream ?? body.virtual_pin ?? '').toUpperCase();
    const singleValue = body.value ?? body.valor ?? body.data;

    let temperatura =
      parseNumber(body.temperatura ?? body.temperature ?? body.temp ?? body.v0 ?? body.V0 ?? c.req.query('temperatura'));
    let umidade =
      parseNumber(body.umidade ?? body.humidity ?? body.hum ?? body.v1 ?? body.V1 ?? c.req.query('umidade'));
    let co2 =
      parseNumber(body.co2_ppm ?? body.co2 ?? body.v2 ?? body.V2 ?? c.req.query('co2'));
    const luminosidade =
      parseNumber(body.luminosidade_lux ?? body.lux ?? body.v3 ?? body.V3 ?? c.req.query('luminosidade_lux'));

    if (pin === 'V0' && temperatura === null) temperatura = parseNumber(singleValue);
    if (pin === 'V1' && umidade === null) umidade = parseNumber(singleValue);
    if (pin === 'V2' && co2 === null) co2 = parseNumber(singleValue);

    if (temperatura === null && umidade === null && co2 === null && luminosidade === null) {
      return c.json({ error: 'Nenhuma métrica válida enviada (temperatura, umidade, co2, luminosidade)' }, 400);
    }

    let loteId = String(body.lote_id ?? body.loteId ?? c.req.query('lote_id') ?? '').trim();
    const codigoLote = String(body.codigo_lote ?? body.codigoLote ?? c.req.query('codigo_lote') ?? '').trim();

    if (!loteId && codigoLote) {
      const lote = await db.getLoteByCodigo(codigoLote);
      loteId = lote?.id || '';
    }

    if (!loteId) {
      return c.json({ error: 'lote_id (ou codigo_lote) é obrigatório para registrar leitura' }, 400);
    }

    const timestamp = parseTimestamp(body.timestamp ?? body.ts ?? c.req.query('timestamp'));

    const leitura = await db.createLeituraSensor({
      lote_id: loteId,
      temperatura,
      umidade,
      co2_ppm: co2,
      luminosidade_lux: luminosidade,
      timestamp,
    });

    return c.json({
      success: true,
      leitura_id: leitura.id,
      lote_id: loteId,
      received: {
        temperatura,
        umidade,
        co2,
        luminosidade_lux: luminosidade,
        timestamp: timestamp || leitura.timestamp,
      },
    }, 201);

  } catch (error) {
    console.error('Erro ao ingerir leitura de sensor:', error);
    return c.json({ error: error.message || 'Erro ao ingerir leitura de sensor' }, 500);
  }
});

app.get("/make-server-5522cecf/sensores/latest", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.query('lote_id') || undefined;
    const hours = clampHours(c.req.query('hours'), 24);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const leituras = await db.getLeiturasSensores({
      lote_id: loteId,
      since,
      limit: 4000,
    });

    const porLote = new Map<string, {
      id: string;
      codigo_lote: string;
      sala: string;
      produto?: any;
      historico: Array<{ timestamp: string; temperatura: number; umidade: number; co2: number; pm25?: number; pm10?: number }>;
    }>();

    for (const leitura of leituras) {
      const key = leitura.lote_id || 'sem-lote';
      if (!porLote.has(key)) {
        porLote.set(key, {
          id: key,
          codigo_lote: leitura.lote?.codigo_lote || 'Sem lote',
          sala: leitura.lote?.sala || 'Sem sala',
          produto: leitura.lote?.produto || null,
          historico: [],
        });
      }

      porLote.get(key)!.historico.push({
        timestamp: leitura.timestamp || leitura.created_at || new Date().toISOString(),
        temperatura: parseNumber(leitura.temperatura) ?? 0,
        umidade: parseNumber(leitura.umidade) ?? 0,
        co2: parseNumber(leitura.co2_ppm) ?? 0,
      });
    }

    const sensores = Array.from(porLote.values()).map((item) => {
      const historico = item.historico.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );
      const sensorAtual = historico[historico.length - 1] || {
        timestamp: new Date().toISOString(),
        temperatura: 0,
        umidade: 0,
        co2: 0,
      };

      const risco = calculateRisk(
        {
          temperatura: sensorAtual.temperatura,
          umidade: sensorAtual.umidade,
          co2: sensorAtual.co2,
        },
        item.produto,
      );

      return {
        id: item.id,
        codigo_lote: item.codigo_lote,
        sala: item.sala,
        sensor_atual: {
          temperatura: sensorAtual.temperatura,
          umidade: sensorAtual.umidade,
          co2: sensorAtual.co2,
        },
        historico,
        score_risco: risco.score,
        alertas: risco.alertas,
      };
    });

    sensores.sort((a, b) => a.codigo_lote.localeCompare(b.codigo_lote));

    return c.json({
      hours,
      generated_at: new Date().toISOString(),
      sensores,
    });

  } catch (error) {
    console.error('Erro ao buscar sensores latest:', error);
    return c.json({ error: error.message || 'Erro ao buscar sensores' }, 500);
  }
});

app.get("/make-server-5522cecf/sensores/history", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    let loteId = c.req.query('lote_id') || '';
    const codigoLote = c.req.query('codigo_lote') || '';
    const hours = clampHours(c.req.query('hours'), 24);

    if (!loteId && codigoLote) {
      const lote = await db.getLoteByCodigo(codigoLote);
      loteId = lote?.id || '';
    }

    if (!loteId) {
      return c.json({ error: 'Informe lote_id ou codigo_lote' }, 400);
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const leituras = await db.getLeiturasSensores({
      lote_id: loteId,
      since,
      limit: 4000,
    });

    const historico = leituras
      .map((leitura) => ({
        timestamp: leitura.timestamp || leitura.created_at || new Date().toISOString(),
        temperatura: parseNumber(leitura.temperatura) ?? 0,
        umidade: parseNumber(leitura.umidade) ?? 0,
        co2: parseNumber(leitura.co2_ppm) ?? 0,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return c.json({
      lote_id: loteId,
      hours,
      historico,
    });

  } catch (error) {
    console.error('Erro ao buscar histórico de sensores:', error);
    return c.json({ error: error.message || 'Erro ao buscar histórico de sensores' }, 500);
  }
});

// ============================================
// AUTENTICAÇÃO
// ============================================

/**
 * POST /signup - Cadastro de novo usuário
 */
app.post("/make-server-5522cecf/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, nome, telefone, tipo_usuario } = body;
    const normalizedTipoUsuario = String(tipo_usuario || '').trim().toLowerCase();

    if (!email || !password || !nome) {
      return c.json({ error: 'Campos obrigatórios: email, password, nome' }, 400);
    }

    if (typeof tipo_usuario !== 'string' || !tipo_usuario.trim()) {
      return c.json({ error: 'tipo_usuario é obrigatório' }, 400);
    }

    const usersCount = await auth.getUsersCount();
    const isBootstrapMode = usersCount === 0;

    if (isBootstrapMode && normalizedTipoUsuario !== 'admin') {
      return c.json({ error: 'No primeiro acesso, o cadastro deve ser de um administrador' }, 400);
    }

    if (!isBootstrapMode) {
      const accessToken = c.req.header('Authorization')?.split(' ')[1];
      const { authenticated, user } = await auth.verifyAuth(accessToken ?? null);

      if (!authenticated || !user) {
        return c.json({ error: 'Cadastro público desativado. Faça login como administrador.' }, 401);
      }

      if (!isAdminUser(user)) {
        return c.json({ error: 'Apenas administradores podem criar novos usuários.' }, 403);
      }
    }

    const result = await auth.signUp({
      email,
      password,
      nome,
      telefone,
      tipo_usuario: normalizedTipoUsuario,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, user: result.user }, 201);

  } catch (error) {
    console.error('Erro no signup:', error);
    return c.json({ error: error.message || 'Erro ao criar usuário' }, 500);
  }
});

/**
 * GET /me - Obter dados do usuário autenticado
 */
app.get("/make-server-5522cecf/me", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const { authenticated, user } = await auth.verifyAuth(accessToken ?? null);

    if (!authenticated || !user) {
      return c.json({ error: 'Não autorizado' }, 401);
    }

    return c.json({ user });

  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// LOTES
// ============================================

app.get("/make-server-5522cecf/lotes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const status = c.req.query('status');
    const sala = c.req.query('sala');

    const lotes = await db.getLotes({ status, sala });
    return c.json({ lotes });

  } catch (error) {
    console.error('Erro ao buscar lotes:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.post("/make-server-5522cecf/lotes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    const lote = await db.createLote({ ...body, responsavel_id: user.id });

    return c.json({ lote }, 201);

  } catch (error) {
    console.error('Erro ao criar lote:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/lotes/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const body = await c.req.json();
    const lote = await db.updateLote(id, body);

    return c.json({ lote });

  } catch (error) {
    console.error('Erro ao atualizar lote:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// COLHEITAS
// ============================================

app.get("/make-server-5522cecf/colheitas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const lote_id = c.req.query('lote_id');
    const colheitas = await db.getColheitas(lote_id);

    return c.json({ colheitas });

  } catch (error) {
    console.error('Erro ao buscar colheitas:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/colheitas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('Dados recebidos para colheita:', body);
    
    const colheita = await db.createColheita({ ...body, responsavel_id: user.id });

    return c.json({ colheita }, 201);

  } catch (error) {
    console.error('Erro ao criar colheita:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// PRODUTOS
// ============================================

app.get("/make-server-5522cecf/produtos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const produtos = await db.getProdutos();
    return c.json({ produtos });

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// ESTOQUE
// ============================================

app.get("/make-server-5522cecf/estoque", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const produto_id = c.req.query('produto_id');
    const status = c.req.query('status');

    const estoque = await db.getEstoque({ produto_id, status });
    return c.json({ estoque });

  } catch (error) {
    console.error('Erro ao buscar estoque:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// CLIENTES
// ============================================

app.get("/make-server-5522cecf/clientes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const tipo = c.req.query('tipo') as 'B2B' | 'B2C' | undefined;
    const clientes = await db.getClientes(tipo);

    return c.json({ clientes });

  } catch (error) {
    console.error('Erro ao buscar clientes:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/clientes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('📥 Dados recebidos para criar cliente:', JSON.stringify(body, null, 2));
    const cliente = await db.createCliente(body);

    return c.json({ cliente }, 201);

  } catch (error) {
    console.error('Erro ao criar cliente:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// PEDIDOS
// ============================================

app.get("/make-server-5522cecf/pedidos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const status = c.req.query('status');
    const cliente_id = c.req.query('cliente_id');

    const pedidos = await db.getPedidos({ status, cliente_id });
    return c.json({ pedidos });

  } catch (error) {
    console.error('Erro ao buscar pedidos:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/pedidos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    
    // Validar dados recebidos
    if (!body.cliente_id || body.cliente_id.trim() === '') {
      return c.json({ error: 'cliente_id é obrigatório' }, 400);
    }
    
    if (!body.itens || !Array.isArray(body.itens) || body.itens.length === 0) {
      return c.json({ error: 'Pelo menos um item é obrigatório' }, 400);
    }
    
    // Validar cada item
    for (const item of body.itens) {
      if (!item.produto_id || item.produto_id.trim() === '') {
        return c.json({ error: 'Todos os itens devem ter um produto_id válido' }, 400);
      }
      if (!item.quantidade_kg || item.quantidade_kg <= 0) {
        return c.json({ error: 'Todos os itens devem ter quantidade_kg maior que zero' }, 400);
      }
      if (!item.preco_unitario || item.preco_unitario <= 0) {
        return c.json({ error: 'Todos os itens devem ter preco_unitario maior que zero' }, 400);
      }
    }
    
    console.log('📥 Criando pedido com dados:', JSON.stringify(body, null, 2));
    console.log('👤 Vendedor ID (usuário autenticado):', user.id);
    console.log('👤 Dados completos do vendedor:', JSON.stringify(user, null, 2));
    
    const pedido = await db.createPedido({ ...body, vendedor_id: user.id });

    return c.json({ pedido }, 201);

  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/pedidos/:id/status", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const { status } = await c.req.json();

    const pedido = await db.updatePedidoStatus(id, status);
    return c.json({ pedido });

  } catch (error) {
    console.error('Erro ao atualizar status do pedido:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// ENTREGAS
// ============================================

app.get("/make-server-5522cecf/entregas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const motorista_id = c.req.query('motorista_id');
    const status = c.req.query('status');

    const entregas = await db.getEntregas({ motorista_id, status });
    return c.json({ entregas });

  } catch (error) {
    console.error('Erro ao buscar entregas:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/entregas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    const entrega = await db.createEntrega(body);

    return c.json({ entrega }, 201);

  } catch (error) {
    console.error('Erro ao criar entrega:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/entregas/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const body = await c.req.json();

    const entrega = await db.updateEntrega(id, body);
    return c.json({ entrega });

  } catch (error) {
    console.error('Erro ao atualizar entrega:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// FINANCEIRO
// ============================================

app.get("/make-server-5522cecf/financeiro", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const tipo = c.req.query('tipo');
    const data_inicio = c.req.query('data_inicio');
    const data_fim = c.req.query('data_fim');

    const transacoes = await db.getFinanceiro({ tipo, data_inicio, data_fim });
    return c.json({ transacoes });

  } catch (error) {
    console.error('Erro ao buscar financeiro:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/financeiro", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    const transacao = await db.createTransacao({ ...body, responsavel_id: user.id });

    return c.json({ transacao }, 201);

  } catch (error) {
    console.error('Erro ao criar transação:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// CÂMERAS
// ============================================

app.get("/make-server-5522cecf/cameras", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const cameras = await db.getCameras();
    return c.json({ cameras });

  } catch (error) {
    console.error('Erro ao buscar câmeras:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// USUÁRIOS
// ============================================

app.get("/make-server-5522cecf/usuarios", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem listar usuários.' }, 403);
    }

    const tipo = c.req.query('tipo');
    const usuarios = await db.getUsuarios(tipo);
    return c.json({ usuarios });

  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/usuarios", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem criar usuários.' }, 403);
    }

    const body = await c.req.json();
    const { email, password, nome, telefone, tipo_usuario } = body;
    const normalizedTipoUsuario = String(tipo_usuario || '').trim().toLowerCase();

    if (!email || !password || !nome || !normalizedTipoUsuario) {
      return c.json({ error: 'Campos obrigatórios: email, password, nome, tipo_usuario' }, 400);
    }

    const result = await auth.signUp({
      email,
      password,
      nome,
      telefone,
      tipo_usuario: normalizedTipoUsuario,
    });

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json({ success: true, user: result.user }, 201);

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return c.json({ error: error.message || 'Erro ao criar usuário' }, 500);
  }
});

// ============================================
// ROTAS E LOGÍSTICA
// ============================================

// Buscar motoristas
app.get("/make-server-5522cecf/motoristas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const motoristas = await db.getMotoristas();
    return c.json({ motoristas });

  } catch (error) {
    console.error('Erro ao buscar motoristas:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Criar motorista
app.post("/make-server-5522cecf/motoristas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('🚚 Criando motorista:', JSON.stringify(body, null, 2));

    // Extrair apenas os campos permitidos (sem id)
    const { nome, email, telefone, cpf, cnh } = body;
    const motoristaData = { nome, email, telefone, cpf, cnh };

    const motorista = await db.createMotorista(motoristaData);
    return c.json({ motorista }, 201);

  } catch (error) {
    console.error('Erro ao criar motorista:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Atualizar motorista
app.put("/make-server-5522cecf/motoristas/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Extrair apenas os campos permitidos para atualização (sem id)
    const { nome, email, telefone, cpf, cnh, ativo } = body;
    const motoristaData = { nome, email, telefone, cpf, cnh, ativo };
    
    const motorista = await db.updateMotorista(id, motoristaData);
    return c.json({ motorista });

  } catch (error) {
    console.error('Erro ao atualizar motorista:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Deletar motorista
app.delete("/make-server-5522cecf/motoristas/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const motorista = await db.deleteMotorista(id);
    return c.json({ motorista });

  } catch (error) {
    console.error('Erro ao deletar motorista:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Buscar rotas
app.get("/make-server-5522cecf/rotas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const status = c.req.query('status');
    const motorista_id = c.req.query('motorista_id');

    const rotas = await db.getRotas({ status, motorista_id });
    return c.json({ rotas });

  } catch (error) {
    console.error('Erro ao buscar rotas:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Sugerir rotas automaticamente
app.get("/make-server-5522cecf/rotas/sugestoes", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const sugestoes = await db.sugerirRotas();
    return c.json({ sugestoes });

  } catch (error) {
    console.error('Erro ao sugerir rotas:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Criar rota
app.post("/make-server-5522cecf/rotas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('🚚 Criando rota:', JSON.stringify(body, null, 2));

    const rota = await db.createRota(body);
    return c.json({ rota }, 201);

  } catch (error) {
    console.error('Erro ao criar rota:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Iniciar rota
app.patch("/make-server-5522cecf/rotas/:id/iniciar", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const rota = await db.iniciarRota(id);
    return c.json({ rota });

  } catch (error) {
    console.error('Erro ao iniciar rota:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Finalizar rota
app.patch("/make-server-5522cecf/rotas/:id/finalizar", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const rota = await db.finalizarRota(id);
    return c.json({ rota });

  } catch (error) {
    console.error('Erro ao finalizar rota:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Cancelar rota
app.patch("/make-server-5522cecf/rotas/:id/cancelar", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const body = await c.req.json();
    const rota = await db.cancelarRota(id, body.motivo);
    return c.json({ rota });

  } catch (error) {
    console.error('Erro ao cancelar rota:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Atualizar parada
app.patch("/make-server-5522cecf/paradas/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const body = await c.req.json();
    const parada = await db.atualizarParada(id, body.status, body.hora_entrega);
    return c.json({ parada });

  } catch (error) {
    console.error('Erro ao atualizar parada:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// COMPRAS E FORNECEDORES
// ============================================

// Buscar compras
app.get("/make-server-5522cecf/compras", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const compras = await comprasKV.getComprasKV();
    return c.json({ compras });

  } catch (error) {
    console.error('Erro ao buscar compras:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Criar compra
app.post("/make-server-5522cecf/compras", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('📦 Criando compra:', JSON.stringify(body, null, 2));

    const compra = await comprasKV.createCompraKV(body);
    return c.json({ compra }, 201);

  } catch (error) {
    console.error('Erro ao criar compra:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Buscar fornecedores
app.get("/make-server-5522cecf/fornecedores", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const fornecedores = await comprasKV.getFornecedoresKV();
    return c.json({ fornecedores });

  } catch (error) {
    console.error('Erro ao buscar fornecedores:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Criar fornecedor
app.post("/make-server-5522cecf/fornecedores", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('🏢 Criando fornecedor:', JSON.stringify(body, null, 2));

    const fornecedor = await comprasKV.createFornecedorKV(body);
    return c.json({ fornecedor }, 201);

  } catch (error) {
    console.error('Erro ao criar fornecedor:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// TREINAMENTOS E PROCESSOS
// ============================================

// Buscar processos de treinamento
app.get("/make-server-5522cecf/treinamentos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const processos = await comprasKV.getTreinamentosKV();
    return c.json({ processos });

  } catch (error) {
    console.error('Erro ao buscar treinamentos:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Salvar progresso dos treinamentos
app.post("/make-server-5522cecf/treinamentos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const body = await c.req.json();
    console.log('📚 Salvando progresso dos treinamentos');

    await comprasKV.salvarTreinamentosKV(body.processos);
    return c.json({ success: true }, 200);

  } catch (error) {
    console.error('Erro ao salvar treinamentos:', error);
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// START SERVER
// ============================================

Deno.serve(app.fetch);
