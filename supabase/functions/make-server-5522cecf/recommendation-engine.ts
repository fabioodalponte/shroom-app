function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundThreshold(value: number, step = 50) {
  return Math.round(value / step) * step;
}

function daysBetween(dateIso: string, now = new Date()) {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)));
}

export type RecommendationStatus = "ok" | "atencao" | "critico" | "dados_insuficientes";
export type MetricSource = "sensor_tempo_real" | "fallback_lote" | "sem_leitura";
export type MetricStatus = "normal" | "acima" | "abaixo" | "sem_leitura";

export interface RecommendationContext {
  lote: any;
  sensorAtual?: {
    temperatura?: number | null;
    umidade?: number | null;
    co2?: number | null;
    luminosidade_lux?: number | null;
    timestamp?: string | null;
    source?: string | null;
  } | null;
}

export interface OperationalMetricSnapshot {
  valor: number | null;
  origem: MetricSource;
  origem_label: string;
  timestamp: string | null;
  status: MetricStatus;
  status_label: string;
  ideal_min?: number | null;
  ideal_max?: number | null;
  aviso: string | null;
}

export function resolveOperationalLimits(produto?: any | null) {
  const tempMin = parseNumber(produto?.temperatura_ideal_min) ?? 20;
  const tempMax = parseNumber(produto?.temperatura_ideal_max) ?? 25;
  const umidMin = parseNumber(produto?.umidade_ideal_min) ?? 80;
  const umidMax = parseNumber(produto?.umidade_ideal_max) ?? 90;
  const co2IdealMax = parseNumber(produto?.perfil_cultivo?.co2_ideal_max) ?? 1000;
  const lumMin = parseNumber(produto?.perfil_cultivo?.luminosidade_min_lux);
  const lumMax = parseNumber(produto?.perfil_cultivo?.luminosidade_max_lux);
  const cicloMin =
    parseNumber(produto?.perfil_cultivo?.ciclo_estimado_dias_min) ??
    parseNumber(produto?.perfil_cultivo?.ciclo_min_dias) ??
    null;
  const cicloMax =
    parseNumber(produto?.perfil_cultivo?.ciclo_estimado_dias_max) ??
    parseNumber(produto?.perfil_cultivo?.ciclo_max_dias) ??
    null;

  return {
    temperatura_min: tempMin,
    temperatura_max: tempMax,
    umidade_min: umidMin,
    umidade_max: umidMax,
    co2_ideal_max: co2IdealMax,
    co2_elevado: roundThreshold(co2IdealMax * 1.2),
    co2_critico: roundThreshold(co2IdealMax * 1.5),
    luminosidade_min_lux: lumMin,
    luminosidade_max_lux: lumMax,
    ciclo_estimado_dias_min: cicloMin,
    ciclo_estimado_dias_max: cicloMax,
  };
}

function buildPerfilRecommendations(produto?: any | null) {
  const recomendacoes = produto?.perfil_cultivo?.recomendacoes_json;
  return {
    resumo: typeof recomendacoes?.resumo === "string" ? recomendacoes.resumo : null,
    alertas: Array.isArray(recomendacoes?.alertas)
      ? recomendacoes.alertas.filter((value: unknown) => typeof value === "string" && value.trim())
      : [],
  };
}

function getMetricStatusLabel(status: MetricStatus) {
  switch (status) {
    case "normal":
      return "Normal";
    case "acima":
      return "Acima do ideal";
    case "abaixo":
      return "Abaixo do ideal";
    default:
      return "Sem leitura";
  }
}

function getMetricSourceLabel(source: MetricSource) {
  switch (source) {
    case "sensor_tempo_real":
      return "Sensor em tempo real";
    case "fallback_lote":
      return "Fallback do lote";
    default:
      return "Sem leitura";
  }
}

function resolveMetricStatus(
  value: number | null,
  limits: { min?: number | null; max?: number | null },
) {
  if (value === null) return "sem_leitura" as const;
  if (limits.max !== null && limits.max !== undefined && value > limits.max) return "acima" as const;
  if (limits.min !== null && limits.min !== undefined && value < limits.min) return "abaixo" as const;
  return "normal" as const;
}

function buildMetricSnapshot(options: {
  sensorValue?: unknown;
  fallbackValue?: unknown;
  fallbackEnabled?: boolean;
  timestamp?: string | null;
  idealMin?: number | null;
  idealMax?: number | null;
}) {
  const sensorValue = parseNumber(options.sensorValue);
  const fallbackValue = options.fallbackEnabled ? parseNumber(options.fallbackValue) : null;

  let valor: number | null = null;
  let origem: MetricSource = "sem_leitura";
  let timestamp: string | null = null;

  if (sensorValue !== null) {
    valor = sensorValue;
    origem = "sensor_tempo_real";
    timestamp = options.timestamp || null;
  } else if (fallbackValue !== null) {
    valor = fallbackValue;
    origem = "fallback_lote";
  }

  const status = resolveMetricStatus(valor, {
    min: options.idealMin,
    max: options.idealMax,
  });

  return {
    valor,
    origem,
    origem_label: getMetricSourceLabel(origem),
    timestamp,
    status,
    status_label: getMetricStatusLabel(status),
    ideal_min: options.idealMin ?? null,
    ideal_max: options.idealMax ?? null,
    aviso:
      origem === "fallback_lote"
        ? "Usando fallback salvo no lote."
        : origem === "sem_leitura"
          ? "Sem leitura disponível."
          : null,
  } satisfies OperationalMetricSnapshot;
}

export function resolveOperationalEnvironment(
  lote: any,
  sensorAtual?: RecommendationContext["sensorAtual"],
  limits?: ReturnType<typeof resolveOperationalLimits>,
) {
  const limites = limits || resolveOperationalLimits(lote?.produto || null);
  const sensor = sensorAtual || null;

  const temperatura = buildMetricSnapshot({
    sensorValue: sensor?.temperatura,
    fallbackValue: lote?.temperatura_atual,
    fallbackEnabled: true,
    timestamp: sensor?.timestamp || null,
    idealMin: limites.temperatura_min,
    idealMax: limites.temperatura_max,
  });

  const umidade = buildMetricSnapshot({
    sensorValue: sensor?.umidade,
    fallbackValue: lote?.umidade_atual,
    fallbackEnabled: true,
    timestamp: sensor?.timestamp || null,
    idealMin: limites.umidade_min,
    idealMax: limites.umidade_max,
  });

  const co2 = buildMetricSnapshot({
    sensorValue: sensor?.co2,
    fallbackEnabled: false,
    timestamp: sensor?.timestamp || null,
    idealMax: limites.co2_ideal_max,
  });

  const luminosidade = buildMetricSnapshot({
    sensorValue: sensor?.luminosidade_lux,
    fallbackEnabled: false,
    timestamp: sensor?.timestamp || null,
    idealMin: limites.luminosidade_min_lux,
    idealMax: limites.luminosidade_max_lux,
  });

  const metricas = {
    temperatura,
    umidade,
    co2,
    luminosidade,
  };

  const metricSources = new Set(
    Object.values(metricas)
      .map((metric) => metric.origem)
      .filter((source) => source !== "sem_leitura"),
  );

  let source: string | null = null;
  if (metricSources.size === 1) {
    source = Array.from(metricSources)[0] || null;
  } else if (metricSources.size > 1) {
    source = "misto";
  }

  const sensorTimestamp = Object.values(metricas).find((metric) => metric.origem === "sensor_tempo_real")?.timestamp || null;

  return {
    temperatura: temperatura.valor,
    umidade: umidade.valor,
    co2: co2.valor,
    luminosidade_lux: luminosidade.valor,
    timestamp: sensorTimestamp,
    source: source || "indisponivel",
    metricas,
  };
}

export function buildOperationalRecommendation(context: RecommendationContext) {
  const lote = context.lote || {};
  const produto = lote.produto || null;
  const limites = resolveOperationalLimits(produto);
  const ambiente = resolveOperationalEnvironment(lote, context.sensorAtual, limites);
  const perfilRecommendations = buildPerfilRecommendations(produto);
  const fase = String(lote.fase_operacional || lote.fase_atual || lote.status || "").trim().toLowerCase() || null;
  const diasDesdeInoculacao = lote.data_inoculacao ? daysBetween(lote.data_inoculacao) : null;

  const temperatura = ambiente.metricas.temperatura.valor;
  const umidade = ambiente.metricas.umidade.valor;
  const co2 = ambiente.metricas.co2.valor;
  const luminosidade = ambiente.metricas.luminosidade.valor;

  const alertas: Array<Record<string, unknown>> = [];
  const recomendacoes: Array<Record<string, unknown>> = [];
  let penalty = 0;

  const pushRecommendation = (
    prioridade: "alta" | "media" | "baixa",
    categoria: string,
    titulo: string,
    descricao: string,
  ) => {
    if (recomendacoes.some((item) => item.titulo === titulo && item.descricao === descricao)) return;
    recomendacoes.push({ prioridade, categoria, titulo, descricao });
  };

  const pushAlert = (
    codigo: string,
    severidade: "warning" | "critical",
    categoria: string,
    mensagem: string,
    penaltyPoints: number,
  ) => {
    penalty += penaltyPoints;
    alertas.push({ codigo, severidade, categoria, mensagem });
  };

  if (temperatura !== null) {
    if (temperatura < limites.temperatura_min) {
      const critical = temperatura < limites.temperatura_min - 2;
      pushAlert(
        "temperatura_baixa",
        critical ? "critical" : "warning",
        "temperatura",
        `Temperatura abaixo do ideal (${temperatura.toFixed(1)}°C).`,
        critical ? 18 : 10,
      );
      pushRecommendation(
        critical ? "alta" : "media",
        "temperatura",
        "Ajustar climatização",
        `Elevar a temperatura para a faixa ${limites.temperatura_min.toFixed(1)}-${limites.temperatura_max.toFixed(1)}°C.`,
      );
    } else if (temperatura > limites.temperatura_max) {
      const critical = temperatura > limites.temperatura_max + 2;
      pushAlert(
        "temperatura_alta",
        critical ? "critical" : "warning",
        "temperatura",
        `Temperatura acima do ideal (${temperatura.toFixed(1)}°C).`,
        critical ? 18 : 10,
      );
      pushRecommendation(
        critical ? "alta" : "media",
        "temperatura",
        "Reduzir temperatura",
        `Reduzir a temperatura para permanecer abaixo de ${limites.temperatura_max.toFixed(1)}°C.`,
      );
    }
  }

  if (umidade !== null) {
    if (umidade < limites.umidade_min) {
      const critical = umidade < limites.umidade_min - 8;
      pushAlert(
        "umidade_baixa",
        critical ? "critical" : "warning",
        "umidade",
        `Umidade abaixo do ideal (${umidade.toFixed(0)}%).`,
        critical ? 16 : 9,
      );
      pushRecommendation(
        critical ? "alta" : "media",
        "umidade",
        "Elevar umidificação",
        `Ajustar para pelo menos ${limites.umidade_min.toFixed(0)}%.`,
      );
    } else if (umidade > limites.umidade_max) {
      const critical = umidade > limites.umidade_max + 8;
      pushAlert(
        "umidade_alta",
        critical ? "critical" : "warning",
        "umidade",
        `Umidade acima do ideal (${umidade.toFixed(0)}%).`,
        critical ? 16 : 9,
      );
      pushRecommendation(
        critical ? "alta" : "media",
        "umidade",
        "Reduzir umidade",
        `Reduzir para abaixo de ${limites.umidade_max.toFixed(0)}% e reforçar circulação de ar.`,
      );
    }
  }

  if (co2 !== null) {
    if (co2 > limites.co2_critico) {
      pushAlert("co2_critico", "critical", "co2", `CO2 crítico (${co2.toFixed(0)} ppm).`, 20);
      pushRecommendation("alta", "co2", "Aumentar ventilação", `Retornar o CO2 para abaixo de ${limites.co2_ideal_max.toFixed(0)} ppm imediatamente.`);
    } else if (co2 > limites.co2_elevado) {
      pushAlert("co2_elevado", "warning", "co2", `CO2 elevado (${co2.toFixed(0)} ppm).`, 12);
      pushRecommendation("media", "co2", "Revisar troca de ar", `Aproximar o CO2 de ${limites.co2_ideal_max.toFixed(0)} ppm.`);
    } else if (co2 > limites.co2_ideal_max) {
      pushAlert("co2_atencao", "warning", "co2", `CO2 em atenção (${co2.toFixed(0)} ppm).`, 6);
      pushRecommendation("media", "co2", "Monitorar ventilação", `Manter CO2 abaixo de ${limites.co2_ideal_max.toFixed(0)} ppm.`);
    }
  }

  if (luminosidade !== null && limites.luminosidade_min_lux !== null && luminosidade < limites.luminosidade_min_lux) {
    pushAlert("luminosidade_baixa", "warning", "luminosidade", `Luminosidade abaixo do ideal (${luminosidade.toFixed(0)} lux).`, 6);
    pushRecommendation("media", "luminosidade", "Ajustar iluminação", `Elevar a iluminação para pelo menos ${limites.luminosidade_min_lux.toFixed(0)} lux.`);
  }

  if (luminosidade !== null && limites.luminosidade_max_lux !== null && luminosidade > limites.luminosidade_max_lux) {
    pushAlert("luminosidade_alta", "warning", "luminosidade", `Luminosidade acima do ideal (${luminosidade.toFixed(0)} lux).`, 6);
    pushRecommendation("media", "luminosidade", "Reduzir iluminação", `Reduzir a iluminação para abaixo de ${limites.luminosidade_max_lux.toFixed(0)} lux.`);
  }

  if (["incubacao", "pronto_para_frutificacao"].includes(String(fase || ""))) {
    const previstaFimIncubacao = lote.data_prevista_fim_incubacao ? new Date(lote.data_prevista_fim_incubacao) : null;
    const incubacaoConcluida = Boolean(lote.data_real_fim_incubacao);
    if (previstaFimIncubacao && !incubacaoConcluida && !Number.isNaN(previstaFimIncubacao.getTime())) {
      const diffDias = Math.floor((Date.now() - previstaFimIncubacao.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias >= 0) {
        const critical = diffDias >= 3;
        pushAlert(
          "incubacao_atrasada",
          critical ? "critical" : "warning",
          "ciclo",
          `Incubação atrasada em ${diffDias} dia(s).`,
          critical ? 18 : 10,
        );
        pushRecommendation(
          critical ? "alta" : "media",
          "ciclo",
          "Avaliar transição de fase",
          "Revisar visualmente a colonização e decidir se o lote está pronto para frutificação ou precisa de intervenção.",
        );
      }
    }
  }

  if (diasDesdeInoculacao !== null && limites.ciclo_estimado_dias_max !== null && diasDesdeInoculacao > limites.ciclo_estimado_dias_max) {
    pushRecommendation(
      "baixa",
      "ciclo",
      "Revisar histórico do lote",
      `O lote está com ${diasDesdeInoculacao} dia(s) desde a inoculação, acima do ciclo estimado máximo de ${limites.ciclo_estimado_dias_max} dias.`,
    );
  }

  for (const recomendacaoPerfil of perfilRecommendations.alertas) {
    pushRecommendation("baixa", "perfil", "Recomendação da espécie", recomendacaoPerfil);
  }

  const metricas = Object.values(ambiente.metricas);
  const ambienteDisponivel = metricas.some((metric) => metric.valor !== null);
  const sensorTempoRealDisponivel = metricas.some((metric) => metric.origem === "sensor_tempo_real");
  const usandoFallbackSensor = metricas.some((metric) => metric.origem === "fallback_lote");
  const perfilDisponivel = Boolean(produto?.perfil_cultivo);

  let statusGeral: RecommendationStatus = "ok";
  if (!ambienteDisponivel) {
    statusGeral = "dados_insuficientes";
  } else if (alertas.some((item) => item.severidade === "critical")) {
    statusGeral = "critico";
  } else if (alertas.length > 0) {
    statusGeral = "atencao";
  }

  const scoreOperacional = ambienteDisponivel ? Math.max(0, 100 - penalty) : 0;

  return {
    status_geral: statusGeral,
    score_operacional: scoreOperacional,
    lote: {
      id: lote.id,
      codigo_lote: lote.codigo_lote,
      sala: lote.sala || null,
      fase_atual: lote.fase_atual || lote.fase_operacional || null,
      fase_operacional: lote.fase_operacional || lote.fase_atual || null,
      data_inoculacao: lote.data_inoculacao || null,
      dias_desde_inoculacao: diasDesdeInoculacao,
      produto: produto
        ? {
            id: produto.id,
            nome: produto.nome || null,
            variedade: produto.variedade || null,
          }
        : null,
    },
    ambiente_atual: ambiente,
    limites_operacionais: limites,
    alertas,
    recomendacoes_priorizadas: recomendacoes.sort((a, b) => {
      const order = { alta: 0, media: 1, baixa: 2 };
      return order[a.prioridade as keyof typeof order] - order[b.prioridade as keyof typeof order];
    }),
    resumo_recomendacoes: perfilRecommendations.resumo,
    fallback: {
      ambiente_disponivel: ambienteDisponivel,
      sensor_disponivel: sensorTempoRealDisponivel,
      perfil_disponivel: perfilDisponivel,
      usando_fallback_sensor: usandoFallbackSensor,
      usando_fallback_perfil: !perfilDisponivel,
      origens_por_metrica: {
        temperatura: ambiente.metricas.temperatura.origem,
        umidade: ambiente.metricas.umidade.origem,
        co2: ambiente.metricas.co2.origem,
        luminosidade: ambiente.metricas.luminosidade.origem,
      },
    },
  };
}
