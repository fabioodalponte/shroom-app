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

function addDays(dateIso: string, days: number) {
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function daysBetween(dateIso: string, now = new Date()) {
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - base.getTime()) / (1000 * 60 * 60 * 24)));
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export interface ProductionForecastContext {
  lote: any;
  blocos?: any[];
  recommendation?: {
    status_geral?: string | null;
    score_operacional?: number | null;
    fallback?: {
      sensor_disponivel?: boolean;
      perfil_disponivel?: boolean;
      usando_fallback_sensor?: boolean;
      usando_fallback_perfil?: boolean;
    } | null;
  } | null;
}

export function buildProductionForecast(context: ProductionForecastContext) {
  const lote = context.lote || {};
  const produto = lote.produto || {};
  const perfil = produto.perfil_cultivo || {};
  const blocos = Array.isArray(context.blocos) ? context.blocos : [];

  const blockCount = blocos.length > 0 ? blocos.length : parseNumber(lote.quantidade_inicial);
  const pesoMedioKg = (() => {
    const pesoMedioG = parseNumber(produto.peso_medio_g);
    if (pesoMedioG === null) return null;
    return pesoMedioG / 1000;
  })();

  const substrateWeights = blocos
    .map((bloco) => parseNumber(bloco?.peso_substrato_kg))
    .filter((value): value is number => value !== null && value > 0);
  const totalSubstrateKg = substrateWeights.length ? substrateWeights.reduce((sum, value) => sum + value, 0) : null;
  const avgSubstrateKg = average(substrateWeights);

  const recommendationScore = parseNumber(context.recommendation?.score_operacional);
  const recommendationStatus = String(context.recommendation?.status_geral || "").trim().toLowerCase();
  const sensorDisponivel = Boolean(context.recommendation?.fallback?.sensor_disponivel);
  const perfilDisponivel = Boolean(context.recommendation?.fallback?.perfil_disponivel);

  let ajusteAmbiente = 1;
  if (recommendationScore !== null) {
    if (recommendationScore >= 85) ajusteAmbiente = 1;
    else if (recommendationScore >= 70) ajusteAmbiente = 0.93;
    else if (recommendationScore >= 50) ajusteAmbiente = 0.82;
    else ajusteAmbiente = 0.68;
  } else if (recommendationStatus === "dados_insuficientes") {
    ajusteAmbiente = 0.9;
  }

  let baseEstimativaKg: number | null = null;
  let metodologiaBase = "indisponivel";

  if (blockCount && pesoMedioKg) {
    baseEstimativaKg = blockCount * pesoMedioKg;
    metodologiaBase = "blocos_x_peso_medio_produto";
  } else if (totalSubstrateKg) {
    // Estimativa conservadora usando eficiência biológica simplificada.
    baseEstimativaKg = totalSubstrateKg * 0.2;
    metodologiaBase = "substrato_total_x_eficiencia";
  } else if (blockCount) {
    baseEstimativaKg = blockCount * 0.18;
    metodologiaBase = "blocos_x_media_padrao";
  } else if (pesoMedioKg && parseNumber(lote.quantidade_inicial)) {
    baseEstimativaKg = Number(lote.quantidade_inicial) * pesoMedioKg;
    metodologiaBase = "quantidade_inicial_x_peso_medio_produto";
  }

  const producaoEstimadaKg = baseEstimativaKg !== null ? Number((baseEstimativaKg * ajusteAmbiente).toFixed(2)) : null;

  const cicloMin =
    parseNumber(perfil.ciclo_estimado_dias_min) ??
    parseNumber(perfil.ciclo_min_dias) ??
    parseNumber(produto.tempo_cultivo_dias);
  const cicloMax =
    parseNumber(perfil.ciclo_estimado_dias_max) ??
    parseNumber(perfil.ciclo_max_dias) ??
    parseNumber(produto.tempo_cultivo_dias);
  const cicloReferencia = (() => {
    if (cicloMin !== null && cicloMax !== null) return Math.round((cicloMin + cicloMax) / 2);
    return cicloMax ?? cicloMin ?? null;
  })();

  const dataBaseColheita = lote.data_inoculacao || lote.data_inicio || null;
  const dataPrevistaColheita =
    lote.data_previsao_colheita ||
    (dataBaseColheita && cicloReferencia !== null ? addDays(dataBaseColheita, cicloReferencia) : null);

  const diasDesdeInoculacao = lote.data_inoculacao ? daysBetween(lote.data_inoculacao) : null;

  const confidenceSignals = [
    blockCount ? 1 : 0,
    pesoMedioKg || totalSubstrateKg ? 1 : 0,
    cicloReferencia !== null ? 1 : 0,
    lote.data_inoculacao ? 1 : 0,
    recommendationScore !== null && sensorDisponivel ? 1 : 0,
    perfilDisponivel ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  let confianca: "baixa" | "media" | "alta" = "baixa";
  if (confidenceSignals >= 5) confianca = "alta";
  else if (confidenceSignals >= 3) confianca = "media";

  const rangeMultiplier = confianca === "alta" ? 0.1 : confianca === "media" ? 0.2 : 0.35;
  const faixaEstimativaKgMin =
    producaoEstimadaKg !== null ? Number(Math.max(0, producaoEstimadaKg * (1 - rangeMultiplier)).toFixed(2)) : null;
  const faixaEstimativaKgMax =
    producaoEstimadaKg !== null ? Number((producaoEstimadaKg * (1 + rangeMultiplier)).toFixed(2)) : null;

  const observacoes: string[] = [];
  if (metodologiaBase === "blocos_x_peso_medio_produto") {
    observacoes.push("Estimativa baseada na quantidade de blocos e no peso médio do produto.");
  } else if (metodologiaBase === "substrato_total_x_eficiencia") {
    observacoes.push("Estimativa baseada no peso total do substrato com eficiência biológica simplificada.");
  } else if (metodologiaBase === "blocos_x_media_padrao") {
    observacoes.push("Estimativa usando média conservadora por bloco por falta de peso médio do produto.");
  } else {
    observacoes.push("Estimativa com baixa base histórica. Cadastre blocos e peso médio do produto para melhorar a precisão.");
  }

  if (recommendationScore !== null) {
    if (recommendationScore >= 85) {
      observacoes.push("Ambiente operacional alinhado ao perfil do produto, sem penalidade de produção.");
    } else if (recommendationScore >= 70) {
      observacoes.push("Ambiente levemente fora do ideal, com ajuste moderado na estimativa.");
    } else {
      observacoes.push("Ambiente fora do ideal reduziu a estimativa de produção.");
    }
  } else {
    observacoes.push("Sem dados ambientais suficientes; a previsão usa ajuste conservador.");
  }

  if (diasDesdeInoculacao !== null && cicloMax !== null && diasDesdeInoculacao > cicloMax) {
    observacoes.push("O lote já ultrapassou o ciclo estimado máximo desde a inoculação.");
  }

  return {
    data_prevista_colheita: dataPrevistaColheita,
    producao_estimada_kg: producaoEstimadaKg,
    faixa_estimativa_kg_min: faixaEstimativaKgMin,
    faixa_estimativa_kg_max: faixaEstimativaKgMax,
    confianca,
    observacoes,
    base_calculo: {
      quantidade_blocos: blockCount,
      peso_medio_produto_kg: pesoMedioKg,
      substrato_total_kg: totalSubstrateKg,
      substrato_medio_bloco_kg: avgSubstrateKg,
      ciclo_estimado_dias_min: cicloMin,
      ciclo_estimado_dias_max: cicloMax,
      ciclo_estimado_dias_referencia: cicloReferencia,
      score_operacional: recommendationScore,
      fator_ajuste_ambiente: ajusteAmbiente,
      metodologia: metodologiaBase,
    },
    fallback: {
      usando_quantidade_inicial: !blocos.length && parseNumber(lote.quantidade_inicial) !== null,
      usando_media_padrao_por_bloco: metodologiaBase === "blocos_x_media_padrao",
      usando_substrato: metodologiaBase === "substrato_total_x_eficiencia",
      usando_fallback_sensor: !sensorDisponivel,
      usando_fallback_perfil: !perfilDisponivel,
    },
  };
}
