import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as auth from "./auth.tsx";
import * as db from "./db.tsx";
import * as comprasKV from "./compras-kv.tsx";
import { buildOperationalRecommendation, resolveOperationalLimits } from "./recommendation-engine.ts";
import { buildProductionForecast } from "./production-forecast.ts";

const app = new Hono();
const isAdminUser = (user: any) => String(user?.tipo_usuario || '').toLowerCase() === 'admin';
const SENSOR_INGEST_HEADER = 'x-sensores-key';
const CONTROLADOR_REQUEST_TIMEOUT_MS = 8000;

function isTruthy(value: string | null | undefined) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function normalizeBaseUrl(value: unknown) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function getRelayProxyHeaders(apiToken?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiToken) {
    headers['X-API-Token'] = apiToken;
  }

  return headers;
}

async function parseProxyResponse(response: Response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function toPublicControlador(controlador: any) {
  if (!controlador) return null;
  const { api_token, ...rest } = controlador;
  return rest;
}

async function callControladorSala(
  controlador: any,
  endpoint: string,
  init: RequestInit = {},
) {
  const baseUrl = normalizeBaseUrl(controlador?.base_url);
  if (!baseUrl) {
    throw new Error('Controlador sem base_url configurada');
  }

  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONTROLADOR_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...getRelayProxyHeaders(controlador?.api_token),
        ...(init.headers || {}),
      },
    });

    const payload = await parseProxyResponse(response);
    if (!response.ok) {
      const detail = payload?.error || payload?.message || payload?.raw || `HTTP ${response.status}`;
      throw new Error(detail);
    }

    return payload;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao conectar com o controlador da sala');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

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

function validateExplicitSalaIdInput(value: unknown) {
  if (value === undefined || value === null) {
    return { provided: false, normalized: null, valid: true, raw: null };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { provided: true, normalized: null, valid: false, raw };
  }

  const normalized = db.resolveSalaId(raw);
  const validFormat = /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(raw);
  return {
    provided: true,
    normalized,
    valid: Boolean(validFormat && normalized === raw),
    raw,
  };
}

function validateNumericInput(rawValue: unknown, label: string) {
  if (rawValue === undefined || rawValue === null || rawValue === '') return null;
  if (parseNumber(rawValue) !== null) return null;
  return { field: label, received: rawValue };
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

function roundThreshold(value: number, step = 50) {
  return Math.round(value / step) * step;
}

function buildRealtimeSensorSnapshot(leitura: any) {
  if (!leitura) return null;

  return {
    temperatura: parseNumber(leitura.temperatura),
    umidade: parseNumber(leitura.umidade),
    co2: parseNumber(leitura.co2_ppm ?? leitura.co2),
    luminosidade_lux: parseNumber(leitura.luminosidade_lux),
    timestamp: leitura.timestamp || leitura.created_at || null,
    source: "leituras_sensores",
  };
}

function isOperationalLote(lote: any) {
  const fase = String(lote?.fase_operacional || lote?.fase_atual || '').trim().toLowerCase();
  const status = String(lote?.status || '').trim().toLowerCase();
  return fase !== 'encerramento' && status !== 'finalizado' && status !== 'encerrado';
}

async function resolveLeituraSensorForLote(loteId: string, lote?: any | null) {
  if (lote?.sala) {
    const leituraSala = await db.getLatestLeituraSensorBySala(lote.sala);
    if (leituraSala) {
      console.log('[sensores.ambiente] using sala reading', {
        lote_id: loteId,
        codigo_lote: lote?.codigo_lote || null,
        sala: lote?.sala || null,
        sala_id: db.resolveSalaId(lote?.sala) || leituraSala.sala_id || null,
        leitura_lote_id: leituraSala.lote_id || null,
        leitura_codigo_lote: leituraSala.lote?.codigo_lote || null,
        timestamp: leituraSala.timestamp || leituraSala.created_at || null,
      });
      return leituraSala;
    }
  }

  const leituraDireta = await db.getLatestLeituraSensorByLoteId(loteId);
  if (leituraDireta) {
    console.log('[sensores.fallback] using lote fallback', {
      lote_id: loteId,
      codigo_lote: lote?.codigo_lote || null,
      sala: lote?.sala || null,
      lote_leitura_id: leituraDireta.id || null,
      timestamp: leituraDireta.timestamp || leituraDireta.created_at || null,
    });
  }

  return leituraDireta;
}

async function resolveHistoricoSensoresForLote(
  loteId: string,
  lote: any | null,
  since: string,
  limit = 4000,
) {
  if (lote?.sala) {
    const leiturasSala = await db.getLeiturasSensoresBySala(lote.sala, {
      since,
      limit,
    });

    if (leiturasSala.length > 0) {
      const leituraMaisRecente = leiturasSala[0];
      console.log('[sensores.ambiente] using sala history', {
        lote_id: loteId,
        codigo_lote: lote?.codigo_lote || null,
        sala: lote?.sala || null,
        sala_id: db.resolveSalaId(lote?.sala) || leituraMaisRecente?.sala_id || null,
        leitura_lote_id: leituraMaisRecente?.lote_id || null,
        leitura_codigo_lote: leituraMaisRecente?.lote?.codigo_lote || null,
        total_leituras: leiturasSala.length,
      });
      return leiturasSala;
    }
  }

  const leiturasDiretas = await db.getLeiturasSensores({
    lote_id: loteId,
    since,
    limit,
  });

  if (leiturasDiretas.length > 0) {
    console.log('[sensores.fallback] using lote history fallback', {
      lote_id: loteId,
      codigo_lote: lote?.codigo_lote || null,
      sala: lote?.sala || null,
      total_leituras: leiturasDiretas.length,
    });
  }

  return leiturasDiretas;
}

function calculateRisk(
  atual: { temperatura: number; umidade: number; co2: number; luminosidade?: number | null },
  produto?: {
    temperatura_ideal_min?: number | null;
    temperatura_ideal_max?: number | null;
    umidade_ideal_min?: number | null;
    umidade_ideal_max?: number | null;
    perfil_cultivo?: {
      co2_ideal_max?: number | null;
      luminosidade_min_lux?: number | null;
      luminosidade_max_lux?: number | null;
      recomendacoes_json?: {
        resumo?: string;
        alertas?: string[];
      } | null;
    } | null;
  } | null,
) {
  const alertas: string[] = [];
  const recomendacoes = new Set<string>();
  let score = 0;

  const limites = resolveOperationalLimits(produto);
  const tempMin = limites.temperatura_min;
  const tempMax = limites.temperatura_max;
  const umidMin = limites.umidade_min;
  const umidMax = limites.umidade_max;
  const co2Atencao = limites.co2_ideal_max;
  const co2Elevado = limites.co2_elevado;
  const co2Critico = limites.co2_critico;
  const lumMin = limites.luminosidade_min_lux;
  const lumMax = limites.luminosidade_max_lux;

  if (atual.temperatura < tempMin) {
    score += 25;
    alertas.push(`Temperatura abaixo do ideal (${atual.temperatura.toFixed(1)}°C)`);
    recomendacoes.add(`Ajustar climatização para retornar acima de ${tempMin.toFixed(1)}°C.`);
  }
  if (atual.temperatura > tempMax) {
    score += 25;
    alertas.push(`Temperatura acima do ideal (${atual.temperatura.toFixed(1)}°C)`);
    recomendacoes.add(`Reduzir a temperatura para permanecer abaixo de ${tempMax.toFixed(1)}°C.`);
  }

  if (atual.umidade < umidMin) {
    score += 20;
    alertas.push(`Umidade abaixo do ideal (${atual.umidade.toFixed(0)}%)`);
    recomendacoes.add(`Elevar umidificação até pelo menos ${umidMin.toFixed(0)}%.`);
  }
  if (atual.umidade > umidMax) {
    score += 20;
    alertas.push(`Umidade acima do ideal (${atual.umidade.toFixed(0)}%)`);
    recomendacoes.add(`Reduzir umidade para abaixo de ${umidMax.toFixed(0)}% e reforçar circulação de ar.`);
  }

  if (atual.co2 > co2Critico) {
    score += 35;
    alertas.push(`CO2 crítico (${atual.co2.toFixed(0)} ppm)`);
    recomendacoes.add(`Aumentar ventilação imediatamente e retornar o CO2 para abaixo de ${co2Atencao.toFixed(0)} ppm.`);
  } else if (atual.co2 > co2Elevado) {
    score += 25;
    alertas.push(`CO2 elevado (${atual.co2.toFixed(0)} ppm)`);
    recomendacoes.add(`Revisar exaustão e ventilação para aproximar o CO2 de ${co2Atencao.toFixed(0)} ppm.`);
  } else if (atual.co2 > co2Atencao) {
    score += 10;
    alertas.push(`CO2 em atenção (${atual.co2.toFixed(0)} ppm)`);
    recomendacoes.add(`Monitorar troca de ar; referência atual do produto: até ${co2Atencao.toFixed(0)} ppm.`);
  }

  if (typeof atual.luminosidade === 'number' && lumMin !== null && atual.luminosidade < lumMin) {
    score += 10;
    alertas.push(`Luminosidade abaixo do ideal (${atual.luminosidade.toFixed(0)} lux)`);
    recomendacoes.add(`Ajustar iluminação para pelo menos ${lumMin.toFixed(0)} lux.`);
  }
  if (typeof atual.luminosidade === 'number' && lumMax !== null && atual.luminosidade > lumMax) {
    score += 10;
    alertas.push(`Luminosidade acima do ideal (${atual.luminosidade.toFixed(0)} lux)`);
    recomendacoes.add(`Reduzir iluminação para abaixo de ${lumMax.toFixed(0)} lux.`);
  }

  const recomendacoesDoPerfil = Array.isArray(produto?.perfil_cultivo?.recomendacoes_json?.alertas)
    ? produto?.perfil_cultivo?.recomendacoes_json?.alertas
    : [];

  for (const recomendacao of recomendacoesDoPerfil) {
    if (typeof recomendacao === 'string' && recomendacao.trim()) {
      recomendacoes.add(recomendacao.trim());
    }
  }

  return {
    score: Math.min(100, score),
    alertas,
    limites: {
      ...limites,
    },
    recomendacoes: Array.from(recomendacoes),
    resumo_recomendacoes: produto?.perfil_cultivo?.recomendacoes_json?.resumo || null,
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
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

    const rawTemperatura = body.temperatura ?? body.temperature ?? body.temp ?? body.v0 ?? body.V0 ?? c.req.query('temperatura');
    const rawUmidade = body.umidade ?? body.humidity ?? body.hum ?? body.v1 ?? body.V1 ?? c.req.query('umidade');
    const rawCo2 = body.co2_ppm ?? body.co2 ?? body.v2 ?? body.V2 ?? c.req.query('co2');
    const rawLuminosidade = body.luminosidade_lux ?? body.lux ?? body.v3 ?? body.V3 ?? c.req.query('luminosidade_lux');

    const invalidMetrics = [
      validateNumericInput(rawTemperatura, 'temperatura'),
      validateNumericInput(rawUmidade, 'umidade'),
      validateNumericInput(rawCo2, 'co2'),
      validateNumericInput(rawLuminosidade, 'luminosidade_lux'),
    ].filter(Boolean);

    if (invalidMetrics.length > 0) {
      return c.json({
        error: 'Payload contém métricas inválidas',
        code: 'sensor_invalid_metrics',
        details: invalidMetrics,
      }, 400);
    }

    let temperatura = parseNumber(rawTemperatura);
    let umidade = parseNumber(rawUmidade);
    let co2 = parseNumber(rawCo2);
    const luminosidade = parseNumber(rawLuminosidade);

    if (pin === 'V0' && temperatura === null) temperatura = parseNumber(singleValue);
    if (pin === 'V1' && umidade === null) umidade = parseNumber(singleValue);
    if (pin === 'V2' && co2 === null) co2 = parseNumber(singleValue);

    if (temperatura === null && umidade === null && co2 === null && luminosidade === null) {
      return c.json({ error: 'Nenhuma métrica válida enviada (temperatura, umidade, co2, luminosidade)' }, 400);
    }

    let loteId = String(body.lote_id ?? body.loteId ?? c.req.query('lote_id') ?? '').trim();
    const codigoLote = String(body.codigo_lote ?? body.codigoLote ?? c.req.query('codigo_lote') ?? '').trim();
    const sensorId =
      String(body.sensor_id ?? body.sensorId ?? body.device_id ?? body.deviceId ?? body.sensor ?? c.req.query('sensor_id') ?? '').trim() || null;
    const explicitSalaInput = body.sala_id ?? body.salaId ?? c.req.query('sala_id');
    const explicitSalaValidation = validateExplicitSalaIdInput(explicitSalaInput);
    if (explicitSalaValidation.provided && !explicitSalaValidation.valid) {
      return c.json({
        error: 'sala_id inválido',
        code: 'sensor_invalid_sala_id',
        details: {
          expected_format: 'snake_case, ex: sala_1 ou sala_de_cultivo_2',
          received: explicitSalaValidation.raw,
        },
      }, 400);
    }

    const requestedSalaId = explicitSalaValidation.normalized || null;
    const requestedCodigoSala =
      String(body.codigo_sala ?? body.codigoSala ?? c.req.query('codigo_sala') ?? '').trim() || null;
    const requestedSala =
      String(body.sala ?? c.req.query('sala') ?? '').trim() || null;
    let loteLookup: Awaited<ReturnType<typeof db.getLoteByCodigo>> | null = null;
    let loteById: Awaited<ReturnType<typeof db.getLoteById>> | null = null;

    if (!loteId && codigoLote) {
      loteLookup = await db.getLoteByCodigo(codigoLote);
      loteId = loteLookup?.id || '';
    }

    if (loteId && !loteLookup) {
      loteById = await db.getLoteById(loteId);
    }

    const salaResolution = await db.resolveSalaAssignment({
      sala_id: requestedSalaId,
      codigo_sala: requestedCodigoSala,
      sala: requestedSala,
      lote_id: loteId || null,
    });
    const resolvedSalaId = salaResolution.sala_id;

    const timestamp = parseTimestamp(body.timestamp ?? body.ts ?? c.req.query('timestamp'));

    console.log('[sensores.ingest] room resolution', {
      sensor_id: sensorId,
      requested_lote_id: String(body.lote_id ?? body.loteId ?? c.req.query('lote_id') ?? '').trim() || null,
      requested_codigo_lote: codigoLote || null,
      requested_sala_id: requestedSalaId,
      requested_codigo_sala: requestedCodigoSala,
      requested_sala: requestedSala,
      resolved_lote_id: loteId || null,
      resolved_codigo_lote: loteLookup?.codigo_lote || codigoLote || null,
      resolved_sala: loteLookup?.sala || null,
      resolved_sala_id: resolvedSalaId,
      resolution_strategy: salaResolution.strategy,
      fallback_used: salaResolution.fallback,
      resolution_details: salaResolution.details,
      metrics: {
        temperatura,
        umidade,
        co2,
        luminosidade_lux: luminosidade,
      },
      timestamp: timestamp || null,
    });

    if (!resolvedSalaId) {
      return c.json({
        error: 'Não foi possível resolver sala_id para a leitura',
        code: 'sensor_room_unresolved',
        warning: 'Envie sala_id explicitamente. Fallbacks aceitos temporariamente: lote vinculado, sala, codigo_sala.',
        details: {
          sensor_id: sensorId,
          requested_lote_id: loteId || null,
          requested_codigo_lote: codigoLote || null,
          requested_sala_id: requestedSalaId,
          requested_codigo_sala: requestedCodigoSala,
          requested_sala: requestedSala,
          resolution_strategy: salaResolution.strategy,
          resolution_order: ['sala_id', 'lote.sala_id', 'fallback legado por sala/codigo_sala'],
        },
      }, 400);
    }

    const leitura = await db.createLeituraSensor({
      sensor_id: sensorId,
      lote_id: loteId || null,
      sala_id: resolvedSalaId,
      codigo_sala: requestedCodigoSala,
      sala: requestedSala,
      temperatura,
      umidade,
      co2_ppm: co2,
      luminosidade_lux: luminosidade,
      timestamp,
    });

    console.log('[sensores.ingest] success', {
      sensor_id: sensorId,
      sala_id: resolvedSalaId,
      strategy: salaResolution.strategy,
      binding: salaResolution.fallback ? 'fallback_legacy_or_lote' : 'explicit_sala_id',
    });

    return c.json({
      success: true,
      leitura_id: leitura.id,
      sensor_id: sensorId,
      lote_id: loteId || null,
      sala_id: resolvedSalaId,
      resolution: {
        strategy: salaResolution.strategy,
        fallback_used: salaResolution.fallback,
      },
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

    const [leiturasRecentes, loteAlvo, lotesBase] = await Promise.all([
      db.getLeiturasSensores({ since, limit: 4000 }),
      loteId ? db.getLoteById(loteId) : Promise.resolve(null),
      loteId ? Promise.resolve([]) : db.getLotes(),
    ]);

    if (loteId && !loteAlvo) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    const lotesBaseArray = Array.isArray(lotesBase) ? lotesBase : [];
    const lotesOperacionais = lotesBaseArray.filter(isOperationalLote);
    const lotesMonitorados = loteAlvo
      ? [loteAlvo]
      : (lotesOperacionais.length > 0 ? lotesOperacionais : lotesBaseArray);

    const historicoPorSala = new Map<string, Array<{ timestamp: string; temperatura: number; umidade: number; co2: number; luminosidade_lux?: number }>>();
    const historicoDiretoPorLote = new Map<string, Array<{ timestamp: string; temperatura: number; umidade: number; co2: number; luminosidade_lux?: number }>>();

    for (const leitura of leiturasRecentes) {
      const sample = {
        timestamp: leitura.timestamp || leitura.created_at || new Date().toISOString(),
        temperatura: parseNumber(leitura.temperatura) ?? 0,
        umidade: parseNumber(leitura.umidade) ?? 0,
        co2: parseNumber(leitura.co2_ppm) ?? 0,
        luminosidade_lux: parseNumber(leitura.luminosidade_lux) ?? undefined,
      };

      if (leitura.lote_id) {
        if (!historicoDiretoPorLote.has(leitura.lote_id)) {
          historicoDiretoPorLote.set(leitura.lote_id, []);
        }
        historicoDiretoPorLote.get(leitura.lote_id)!.push(sample);
      }

      const salaKey = db.resolveSalaId(leitura.sala_id ?? leitura.lote?.sala_id ?? leitura.lote?.sala);
      if (salaKey) {
        if (!historicoPorSala.has(salaKey)) {
          historicoPorSala.set(salaKey, []);
        }
        historicoPorSala.get(salaKey)!.push(sample);
      }
    }

    const sensoresPorLote = lotesMonitorados
      .map((item) => {
        const salaKey = db.resolveSalaId(item.sala_id ?? item.sala_ref?.id ?? item.sala_ref?.codigo ?? item.sala);
        const historicoBase =
          (salaKey ? historicoPorSala.get(salaKey) : undefined) ||
          historicoDiretoPorLote.get(item.id) ||
          [];

        if (historicoBase.length === 0) {
          return null;
        }

        const historico = [...historicoBase].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const sensorAtual = historico[historico.length - 1] || {
          timestamp: new Date().toISOString(),
          temperatura: 0,
          umidade: 0,
          co2: 0,
          luminosidade_lux: undefined,
        };

        const risco = calculateRisk(
          {
            temperatura: sensorAtual.temperatura,
            umidade: sensorAtual.umidade,
            co2: sensorAtual.co2,
            luminosidade: sensorAtual.luminosidade_lux,
          },
          item.produto,
        );

        return {
          id: item.id,
          codigo_lote: item.codigo_lote,
          sala: item.sala || item.sala_ref?.nome || 'Sala não informada',
          sala_id: salaKey || item.sala_id || item.sala_ref?.id || null,
          sala_ref: item.sala_ref || null,
          fase_operacional: item.fase_operacional || item.fase_atual || null,
          data_inoculacao: item.data_inoculacao || null,
          data_prevista_fim_incubacao: item.data_prevista_fim_incubacao || null,
          data_real_fim_incubacao: item.data_real_fim_incubacao || null,
          ambiente_source: salaKey && historicoPorSala.has(salaKey) ? 'sala' : 'lote',
          sensor_atual: {
            temperatura: sensorAtual.temperatura,
            umidade: sensorAtual.umidade,
            co2: sensorAtual.co2,
            luminosidade_lux: sensorAtual.luminosidade_lux,
          },
          historico,
          score_risco: risco.score,
          alertas: risco.alertas,
          limites_operacionais: risco.limites,
          recomendacoes_operacionais: risco.recomendacoes,
          resumo_recomendacoes: risco.resumo_recomendacoes,
          produto: item.produto || null,
        };
      })
      .filter(Boolean);

    const loteIdsComLeitura = sensoresPorLote.map((item) => item!.id);
    const blocosResumoPorLote = await db.getBlocosResumoByLoteIds(loteIdsComLeitura);

    const sensores = sensoresPorLote.map((item) => ({
      ...item!,
      blocos_resumo: blocosResumoPorLote.get(item!.id) || { total: 0, frutificacao: 0, colhido: 0 },
    }));

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

    const lote = await db.getLoteById(loteId);
    if (!lote) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const leituras = await resolveHistoricoSensoresForLote(loteId, lote, since, 4000);

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
// SALAS
// ============================================

app.get("/make-server-5522cecf/salas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const ativaQuery = c.req.query('ativa');
    const ativa = typeof ativaQuery === 'undefined'
      ? undefined
      : ['1', 'true', 'yes', 'on'].includes(String(ativaQuery).trim().toLowerCase());

    const salas = await db.getSalas(
      typeof ativa === 'boolean'
        ? { ativa }
        : undefined,
    );

    return c.json({ salas });
  } catch (error) {
    console.error('Erro ao buscar salas:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.post("/make-server-5522cecf/salas", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(user)) {
      return c.json({ error: 'Apenas administradores podem cadastrar salas.' }, 403);
    }

    const body = await c.req.json();
    const sala = await db.createSala(body);

    return c.json({ sala }, 201);
  } catch (error) {
    console.error('Erro ao criar sala:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.put("/make-server-5522cecf/salas/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(user)) {
      return c.json({ error: 'Apenas administradores podem editar salas.' }, 403);
    }

    const id = c.req.param('id');
    const body = await c.req.json();
    const sala = await db.updateSala(id, body);

    return c.json({ sala });
  } catch (error) {
    console.error('Erro ao atualizar sala:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
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
    const fase_operacional = c.req.query('fase_operacional');

    const lotes = await db.getLotes({ status, sala, fase_operacional });
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

app.get("/make-server-5522cecf/lotes/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const lote = await db.getLoteById(id);

    if (!lote) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    return c.json({ lote });
  } catch (error) {
    console.error('Erro ao buscar lote:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/recomendacoes-operacionais", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const lote = await db.getLoteById(id);

    if (!lote) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    const leitura = await resolveLeituraSensorForLote(id, lote);
    const sensorAtual = buildRealtimeSensorSnapshot(leitura);

    const recommendation = buildOperationalRecommendation({
      lote,
      sensorAtual,
    });

    return c.json(recommendation);
  } catch (error) {
    console.error('Erro ao gerar recomendações operacionais do lote:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/previsao-producao", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const lote = await db.getLoteById(id);

    if (!lote) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    const [leitura, blocos] = await Promise.all([
      resolveLeituraSensorForLote(id, lote),
      db.getLoteBlocos(id),
    ]);

    const sensorAtual = buildRealtimeSensorSnapshot(leitura);

    const recommendation = buildOperationalRecommendation({
      lote,
      sensorAtual,
    });

    const previsao = buildProductionForecast({
      lote,
      blocos,
      recommendation,
    });

    return c.json(previsao);
  } catch (error) {
    console.error('Erro ao gerar previsão de produção do lote:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/timelapse", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const limitRaw = c.req.query('limit');
    const limit = limitRaw ? Number.parseInt(String(limitRaw), 10) : 120;

    const timelapse = await db.getVisionTimelapseRunsByLoteId(id, Number.isFinite(limit) ? limit : 120);
    if (!timelapse) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    return c.json(timelapse);
  } catch (error) {
    console.error('Erro ao buscar time-lapse do lote:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/analise-visual", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const id = c.req.param('id');
    const analiseVisual = await db.getVisionLatestBlockAnalysisByLoteId(id);

    if (!analiseVisual) {
      return c.json({ error: 'Lote não encontrado' }, 404);
    }

    return c.json(analiseVisual);
  } catch (error) {
    console.error('Erro ao buscar análise visual do lote:', error);
    return c.json({ error: error.message }, error.message === 'Não autorizado' ? 401 : 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/blocos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const blocos = await db.getLoteBlocos(loteId);
    return c.json({ blocos });
  } catch (error) {
    console.error('Erro ao buscar blocos do lote:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/lotes/:id/blocos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json();
    const quantidade = Number.parseInt(String(body.quantidade ?? body.quantidade_blocos ?? '0'), 10);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return c.json({ error: 'quantidade deve ser maior que zero' }, 400);
    }

    const blocos = await db.createBlocosForLote({
      lote_id: loteId,
      quantidade,
      peso_substrato_kg: parseNumber(body.peso_substrato_kg),
      observacoes: String(body.observacoes || '').trim() || null,
      usuario_id: user.id,
    });

    return c.json({ blocos, quantidade: blocos.length }, 201);
  } catch (error) {
    console.error('Erro ao criar blocos:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/eventos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const limit = Math.max(1, Math.min(300, Number.parseInt(c.req.query('limit') || '120', 10) || 120));
    const eventos = await db.getLoteEventos(loteId, limit);
    return c.json({ eventos });
  } catch (error) {
    console.error('Erro ao buscar eventos do lote:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.patch("/make-server-5522cecf/lotes/:id/fase", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json();
    const fase = String(body.fase_operacional || '').trim().toLowerCase();
    const fasesValidas = new Set(['esterilizacao', 'inoculacao', 'incubacao', 'pronto_para_frutificacao', 'frutificacao', 'colheita', 'encerramento']);

    if (!fasesValidas.has(fase)) {
      return c.json({ error: 'fase_operacional inválida' }, 400);
    }

    const lote = await db.updateLoteFase({
      lote_id: loteId,
      fase_operacional: fase as any,
      observacoes: String(body.observacoes || '').trim() || null,
      usuario_id: user.id,
      detalhes: body.detalhes && typeof body.detalhes === 'object' ? body.detalhes : {},
    });

    return c.json({ lote });
  } catch (error) {
    console.error('Erro ao atualizar fase do lote:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/lotes/:id/pronto-para-frutificacao", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const lote = await db.marcarLoteProntoParaFrutificacao({
      lote_id: loteId,
      observacoes: String(body?.observacoes || '').trim() || null,
      usuario_id: user.id,
    });

    return c.json({ lote });
  } catch (error) {
    console.error('Erro ao marcar lote como pronto para frutificação:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/lotes/:id/inoculacao", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json();
    const quantidadeBlocos = Number.parseInt(String(body.quantidade_blocos ?? body.quantidade ?? '0'), 10);

    if (!Number.isFinite(quantidadeBlocos) || quantidadeBlocos <= 0) {
      return c.json({ error: 'quantidade_blocos deve ser maior que zero' }, 400);
    }

    const resultado = await db.registrarInoculacao({
      lote_id: loteId,
      quantidade_blocos: quantidadeBlocos,
      peso_substrato_kg: parseNumber(body.peso_substrato_kg),
      observacoes: String(body.observacoes || '').trim() || null,
      usuario_id: user.id,
    });

    const consumos = Array.isArray(body.consumos) ? body.consumos : [];
    const consumosRegistrados: any[] = [];
    for (const consumo of consumos) {
      const insumoId = String(consumo?.insumo_id || '').trim();
      const quantidade = parseNumber(consumo?.quantidade);
      if (!insumoId || quantidade === null || quantidade <= 0) continue;

      const registro = await db.consumirInsumo({
        lote_id: loteId,
        insumo_id: insumoId,
        quantidade,
        fase_operacional: 'inoculacao',
        observacoes: String(consumo?.observacoes || '').trim() || null,
        usuario_id: user.id,
      });
      consumosRegistrados.push(registro);
    }

    return c.json({
      ...resultado,
      consumos_registrados: consumosRegistrados.length,
    }, 201);
  } catch (error) {
    console.error('Erro na operação de inoculação:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/lotes/:id/frutificacao", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json();
    const blocoIds = Array.isArray(body.bloco_ids)
      ? body.bloco_ids.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];

    const resultado = await db.registrarFrutificacao({
      lote_id: loteId,
      bloco_ids: blocoIds,
      observacoes: String(body.observacoes || '').trim() || null,
      usuario_id: user.id,
    });

    const consumos = Array.isArray(body.consumos) ? body.consumos : [];
    const consumosRegistrados: any[] = [];
    for (const consumo of consumos) {
      const insumoId = String(consumo?.insumo_id || '').trim();
      const quantidade = parseNumber(consumo?.quantidade);
      if (!insumoId || quantidade === null || quantidade <= 0) continue;

      const registro = await db.consumirInsumo({
        lote_id: loteId,
        insumo_id: insumoId,
        quantidade,
        bloco_id: String(consumo?.bloco_id || '').trim() || null,
        fase_operacional: 'frutificacao',
        observacoes: String(consumo?.observacoes || '').trim() || null,
        usuario_id: user.id,
      });
      consumosRegistrados.push(registro);
    }

    return c.json({
      ...resultado,
      consumos_registrados: consumosRegistrados.length,
    }, 201);
  } catch (error) {
    console.error('Erro na operação de frutificação:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/lotes/:id/consumos-insumos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const consumos = await db.getConsumoInsumosByLote(loteId);
    return c.json({ consumos });
  } catch (error) {
    console.error('Erro ao buscar consumos de insumos:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/lotes/:id/consumos-insumos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const user = await auth.requireAuth(accessToken ?? null);

    const loteId = c.req.param('id');
    const body = await c.req.json();
    const insumoId = String(body.insumo_id || '').trim();
    const quantidade = parseNumber(body.quantidade);

    if (!insumoId) {
      return c.json({ error: 'insumo_id é obrigatório' }, 400);
    }
    if (quantidade === null || quantidade <= 0) {
      return c.json({ error: 'quantidade deve ser maior que zero' }, 400);
    }

    const consumo = await db.consumirInsumo({
      lote_id: loteId,
      insumo_id: insumoId,
      quantidade,
      bloco_id: String(body.bloco_id || '').trim() || null,
      fase_operacional: String(body.fase_operacional || '').trim() || null,
      observacoes: String(body.observacoes || '').trim() || null,
      usuario_id: user.id,
    });

    return c.json({ consumo }, 201);
  } catch (error) {
    console.error('Erro ao registrar consumo de insumo:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/insumos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);
    const insumos = await db.getInsumos();
    return c.json({ insumos });
  } catch (error) {
    console.error('Erro ao buscar insumos:', error);
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

    const produtos = await db.getProdutos({
      includeInactive: isTruthy(c.req.query('include_inactive')),
      includeInactiveTrainings: isTruthy(c.req.query('include_inactive_trainings')),
    });
    return c.json({ produtos });

  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/produtos/:id/treinamentos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const treinamentos = await db.getProdutoTreinamentos(c.req.param('id'), {
      includeInactive: isTruthy(c.req.query('include_inactive')),
    });

    return c.json({ treinamentos });
  } catch (error) {
    console.error('Erro ao buscar treinamentos do produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/produtos/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const produto = await db.getProdutoByIdCatalogo(c.req.param('id'), {
      includeInactive: isTruthy(c.req.query('include_inactive')),
      includeInactiveTrainings: isTruthy(c.req.query('include_inactive_trainings')),
    });

    if (!produto) {
      return c.json({ error: 'Produto não encontrado' }, 404);
    }

    return c.json({ produto });
  } catch (error) {
    console.error('Erro ao buscar produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/produtos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem criar produtos.' }, 403);
    }

    const body = await c.req.json();
    if (!String(body?.nome || '').trim()) {
      return c.json({ error: 'Campo obrigatório: nome' }, 400);
    }

    const produto = await db.createProduto(body);
    return c.json({ produto }, 201);
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/produtos/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem atualizar produtos.' }, 403);
    }

    const body = await c.req.json();
    if (body?.nome !== undefined && !String(body.nome || '').trim()) {
      return c.json({ error: 'Campo nome não pode ser vazio' }, 400);
    }

    const produto = await db.updateProduto(c.req.param('id'), body);
    if (!produto) {
      return c.json({ error: 'Produto não encontrado' }, 404);
    }

    return c.json({ produto });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/produtos/:id/perfil", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem atualizar perfis de cultivo.' }, 403);
    }

    const body = await c.req.json();
    const perfil = await db.upsertProdutoPerfil(c.req.param('id'), body);
    return c.json({ perfil });
  } catch (error) {
    console.error('Erro ao salvar perfil de cultivo:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-5522cecf/produtos/:id/treinamentos", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem criar treinamentos de produto.' }, 403);
    }

    const body = await c.req.json();
    if (!String(body?.slug || '').trim() || !String(body?.titulo || '').trim()) {
      return c.json({ error: 'Campos obrigatórios: slug e titulo' }, 400);
    }

    const treinamento = await db.createProdutoTreinamento(c.req.param('id'), body);
    return c.json({ treinamento }, 201);
  } catch (error) {
    console.error('Erro ao criar treinamento do produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.put("/make-server-5522cecf/produtos/:id/treinamentos/:treinamentoId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem atualizar treinamentos de produto.' }, 403);
    }

    const body = await c.req.json();
    if (body?.slug !== undefined && !String(body.slug || '').trim()) {
      return c.json({ error: 'Campo slug não pode ser vazio' }, 400);
    }
    if (body?.titulo !== undefined && !String(body.titulo || '').trim()) {
      return c.json({ error: 'Campo titulo não pode ser vazio' }, 400);
    }

    const treinamento = await db.updateProdutoTreinamento(
      c.req.param('id'),
      c.req.param('treinamentoId'),
      body,
    );

    if (!treinamento) {
      return c.json({ error: 'Treinamento do produto não encontrado' }, 404);
    }

    return c.json({ treinamento });
  } catch (error) {
    console.error('Erro ao atualizar treinamento do produto:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-5522cecf/produtos/:id/treinamentos/:treinamentoId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const actor = await auth.requireAuth(accessToken ?? null);

    if (!isAdminUser(actor)) {
      return c.json({ error: 'Apenas administradores podem remover treinamentos de produto.' }, 403);
    }

    await db.deleteProdutoTreinamento(c.req.param('id'), c.req.param('treinamentoId'));
    return c.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover treinamento do produto:', error);
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
// CONTROLADORES DE SALA
// ============================================

app.get("/make-server-5522cecf/controladores", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const controladores = await db.getControladoresSala();
    return c.json({ controladores });
  } catch (error) {
    console.error('Erro ao buscar controladores de sala:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-5522cecf/controladores/:id/status", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const controlador = await db.getControladorSalaById(c.req.param('id'));
    if (!controlador) {
      return c.json({ error: 'Controlador não encontrado' }, 404);
    }

    const status = await callControladorSala(controlador, '/status', { method: 'GET' });
    return c.json({
      controlador: toPublicControlador(controlador),
      status,
    });
  } catch (error) {
    console.error('Erro ao consultar status do controlador:', error);
    return c.json({ error: error.message || 'Erro ao consultar controlador' }, 502);
  }
});

app.post("/make-server-5522cecf/controladores/:id/relay", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const controlador = await db.getControladorSalaById(c.req.param('id'));
    if (!controlador) {
      return c.json({ error: 'Controlador não encontrado' }, 404);
    }

    const body = await c.req.json();
    const relay = Number(body?.relay);
    const state = body?.state;

    if (![1, 2, 3, 4].includes(relay)) {
      return c.json({ error: 'relay deve ser 1..4' }, 400);
    }

    if (typeof state !== 'boolean') {
      return c.json({ error: 'state deve ser boolean' }, 400);
    }

    const status = await callControladorSala(controlador, '/relay', {
      method: 'POST',
      body: JSON.stringify({ relay, state }),
    });

    return c.json({
      controlador: toPublicControlador(controlador),
      status,
    });
  } catch (error) {
    console.error('Erro ao acionar relé do controlador:', error);
    return c.json({ error: error.message || 'Erro ao acionar relé' }, 502);
  }
});

app.post("/make-server-5522cecf/controladores/:id/relays", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const controlador = await db.getControladorSalaById(c.req.param('id'));
    if (!controlador) {
      return c.json({ error: 'Controlador não encontrado' }, 404);
    }

    const body = await c.req.json();
    const payload: Record<string, boolean> = {};

    for (const key of ['relay1', 'relay2', 'relay3', 'relay4']) {
      if (key in body) {
        if (typeof body[key] !== 'boolean') {
          return c.json({ error: `${key} deve ser boolean` }, 400);
        }
        payload[key] = body[key];
      }
    }

    if (!Object.keys(payload).length) {
      return c.json({ error: 'Informe pelo menos um relay para atualizar' }, 400);
    }

    const status = await callControladorSala(controlador, '/relays', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return c.json({
      controlador: toPublicControlador(controlador),
      status,
    });
  } catch (error) {
    console.error('Erro ao atualizar múltiplos relés do controlador:', error);
    return c.json({ error: error.message || 'Erro ao atualizar relés' }, 502);
  }
});

app.post("/make-server-5522cecf/controladores/:id/mode", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const controlador = await db.getControladorSalaById(c.req.param('id'));
    if (!controlador) {
      return c.json({ error: 'Controlador não encontrado' }, 404);
    }

    const body = await c.req.json();
    const mode = String(body?.mode || '').trim().toLowerCase();
    if (mode !== 'manual' && mode !== 'remote') {
      return c.json({ error: 'mode deve ser manual ou remote' }, 400);
    }

    const status = await callControladorSala(controlador, '/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });

    return c.json({
      controlador: toPublicControlador(controlador),
      status,
    });
  } catch (error) {
    console.error('Erro ao alterar modo do controlador:', error);
    return c.json({ error: error.message || 'Erro ao alterar modo do controlador' }, 502);
  }
});

// ============================================
// VISION PIPELINE
// ============================================

app.get("/make-server-5522cecf/vision/runs/latest", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const run = await db.getVisionPipelineLatestRun();
    return c.json({ run });
  } catch (error) {
    console.error('Erro ao buscar última captura vision:', error);
    return c.json({ error: error.message || 'Erro ao buscar última captura vision' }, 500);
  }
});

app.get("/make-server-5522cecf/vision/runs", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const qualityStatus = c.req.query('quality_status') || undefined;
    const remoteStatusRaw = c.req.query('remote_status') || undefined;
    const daysRaw = c.req.query('days');
    const limitRaw = c.req.query('limit');
    const remoteStatus = ['ok', 'failed', 'pending'].includes(String(remoteStatusRaw))
      ? (remoteStatusRaw as 'ok' | 'failed' | 'pending')
      : undefined;

    const runs = await db.getVisionPipelineRuns({
      quality_status: qualityStatus,
      remote_status: remoteStatus,
      days: daysRaw ? Number.parseInt(String(daysRaw), 10) : undefined,
      limit: limitRaw ? Number.parseInt(String(limitRaw), 10) : undefined,
    });

    return c.json({ runs });
  } catch (error) {
    console.error('Erro ao listar capturas vision:', error);
    return c.json({ error: error.message || 'Erro ao listar capturas vision' }, 500);
  }
});

app.get("/make-server-5522cecf/vision/runs/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    await auth.requireAuth(accessToken ?? null);

    const run = await db.getVisionPipelineRunById(c.req.param('id'));
    if (!run) {
      return c.json({ error: 'Captura vision não encontrada' }, 404);
    }

    return c.json({ run });
  } catch (error) {
    console.error('Erro ao buscar detalhe da captura vision:', error);
    return c.json({ error: error.message || 'Erro ao buscar detalhe da captura vision' }, 500);
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
