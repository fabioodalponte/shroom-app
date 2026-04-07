export type RoomStatus = 'critical' | 'warning' | 'ok';

export interface SalaRecord {
  id: string;
  codigo: string;
  nome: string;
  tipo?: string | null;
  ativa?: boolean | null;
  descricao?: string | null;
  primary_camera_id?: string | null;
}

export interface SalaRefRecord {
  id?: string | null;
  codigo?: string | null;
  nome?: string | null;
  tipo?: string | null;
  ativa?: boolean | null;
  primary_camera_id?: string | null;
}

export interface RoomLote {
  id: string;
  codigo_lote: string;
  status?: string | null;
  sala?: string | null;
  sala_id?: string | null;
  sala_ref?: SalaRefRecord | null;
  temperatura_atual?: number | null;
  umidade_atual?: number | null;
  fase_operacional?: string | null;
  data_previsao_colheita?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  data_inoculacao?: string | null;
  blocos_resumo?: {
    total?: number | null;
    frutificacao?: number | null;
    colhido?: number | null;
  } | null;
  produto?: {
    nome?: string | null;
    perfil_cultivo?: {
      co2_ideal_max?: number | null;
      luminosidade_min_lux?: number | null;
      luminosidade_max_lux?: number | null;
    } | null;
  } | null;
}

export interface RoomSensorSample {
  timestamp: string;
  temperatura: number;
  umidade: number;
  co2: number;
  luminosidade_lux?: number;
}

export interface RoomSensorMonitor {
  id: string;
  codigo_lote: string;
  sala?: string | null;
  sala_id?: string | null;
  ambiente_source?: 'sala' | 'lote' | string | null;
  fase_operacional?: string | null;
  data_inoculacao?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    luminosidade_lux?: number;
  };
  historico: RoomSensorSample[];
  score_risco: number;
  alertas: string[];
  limites_operacionais?: {
    temperatura_min?: number;
    temperatura_max?: number;
    umidade_min?: number;
    umidade_max?: number;
    co2_ideal_max?: number;
    co2_elevado?: number;
    co2_critico?: number;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
  } | null;
  recomendacoes_operacionais?: string[];
  resumo_recomendacoes?: string | null;
  produto?: {
    nome?: string | null;
  } | null;
  blocos_resumo?: {
    total?: number | null;
    frutificacao?: number | null;
    colhido?: number | null;
  } | null;
}

export interface RoomController {
  id: string;
  nome: string;
  sala_id?: string | null;
  localizacao?: string | null;
  tipo?: string | null;
  base_url?: string | null;
  device_id?: string | null;
  status?: string | null;
  modo_padrao?: 'manual' | 'remote' | string | null;
  relay_map?: Record<string, string> | null;
  observacoes?: string | null;
  sala_ref?: SalaRefRecord | null;
}

export interface RoomSensorNode {
  key: string;
  label: string;
  sourceLabel: string;
  online: boolean;
  lastSeen: Date | null;
  temperatura: number;
  umidade: number;
  co2: number;
  luminosidade: number | null;
  scoreRisco: number;
  alertas: string[];
  history: RoomSensorSample[];
  linkedLotId?: string | null;
  linkedLotCode?: string | null;
}

export interface RoomAutomationRule {
  id: string;
  title: string;
  description: string;
  tone: RoomStatus;
  active: boolean;
}

export interface RoomAlertItem {
  id: string;
  tone: RoomStatus;
  title: string;
  description: string;
}

export interface RoomAutomationTargets {
  temperatura: {
    min: number;
    max: number;
    source: 'sensor_limits' | 'lot_context' | 'fallback';
  };
  umidade: {
    min: number;
    max: number;
    source: 'sensor_limits' | 'lot_context' | 'fallback';
  };
  co2: {
    idealMax: number;
    source: 'sensor_limits' | 'lot_context' | 'fallback';
  };
  luminosidade: {
    min: number | null;
    max: number | null;
    source: 'sensor_limits' | 'lot_context' | 'fallback';
  };
}

export interface RoomLotContext {
  primaryPhase: string | null;
  phases: string[];
  lotCodes: string[];
  highlightedLotCode: string | null;
}

export interface RoomOwnershipModel {
  principalUnit: 'sala';
  sensorsOwnedBySala: boolean;
  actuatorsOwnedBySala: boolean;
  lotsContextualToSala: boolean;
  automationScope: 'room_average_with_lot_context';
  primaryReference: 'sala_id';
  compatibilityFallbacks: string[];
}

export interface RoomOperationalModel {
  sala: SalaRecord;
  lotes: RoomLote[];
  sensores: RoomSensorNode[];
  atuadores: RoomController[];
  mediaTemperatura: number | null;
  mediaUmidade: number | null;
  mediaCo2: number | null;
  mediaLuminosidade: number | null;
  sensoresOnline: number;
  lotesAtivos: number;
  status: RoomStatus;
  statusLabel: string;
  primaryAlert: RoomAlertItem | null;
  alerts: RoomAlertItem[];
  rules: RoomAutomationRule[];
  targets: RoomAutomationTargets;
  lotContext: RoomLotContext;
  ownership: RoomOwnershipModel;
  history: RoomSensorSample[];
  divergence: {
    temperatura: number;
    umidade: number;
    co2: number;
  };
  diagnostics: {
    aliases: string[];
    linkedLotes: number;
    linkedSensores: number;
    linkedAtuadores: number;
    offlineSensors: number;
    usedLegacyFallback: boolean;
  };
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function normalizeRoomKey(value?: string | null) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toAliasSet(...values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeRoomKey(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const direct = new Date(value);
  return Number.isNaN(direct.getTime()) ? null : direct;
}

function average(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function pickStrictRange(values: Array<number | null | undefined>, fallback: number, mode: 'min' | 'max') {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!filtered.length) return fallback;
  return mode === 'min' ? Math.max(...filtered) : Math.min(...filtered);
}

function maxSpread(values: Array<number | null | undefined>) {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length <= 1) return 0;
  return Math.max(...filtered) - Math.min(...filtered);
}

function isOperationalLote(lote: RoomLote) {
  const status = normalizeText(lote.status || '');
  const phase = normalizeText(lote.fase_operacional || '');
  return status !== 'encerrado' && status !== 'cancelado' && phase !== 'encerramento';
}

function resolveRoomStatus(args: {
  alerts: RoomAlertItem[];
  offlineSensors: number;
  divergence: { temperatura: number; umidade: number; co2: number };
}) {
  if (args.alerts.some((item) => item.tone === 'critical')) {
    return { status: 'critical' as RoomStatus, label: 'Crítico' };
  }

  if (
    args.offlineSensors > 0 ||
    args.divergence.temperatura >= 1.5 ||
    args.divergence.umidade >= 8 ||
    args.divergence.co2 >= 120 ||
    args.alerts.length > 0
  ) {
    return { status: 'warning' as RoomStatus, label: 'Atenção' };
  }

  return { status: 'ok' as RoomStatus, label: 'OK' };
}

function getSensorSourceKey(sensor: RoomSensorMonitor) {
  if (sensor.ambiente_source === 'sala') {
    return `room:${sensor.sala_id || normalizeRoomKey(sensor.sala) || 'shared'}`;
  }
  return `lot:${sensor.id}`;
}

function getSensorLabel(sensor: RoomSensorMonitor) {
  if (sensor.ambiente_source === 'sala') {
    return 'Sensor ambiente da sala';
  }
  return sensor.codigo_lote ? `Sensor ${sensor.codigo_lote}` : 'Sensor do lote';
}

function getSensorSourceLabel(sensor: RoomSensorMonitor) {
  if (sensor.ambiente_source === 'sala') {
    return 'Leitura compartilhada da sala';
  }
  return 'Leitura dedicada do lote';
}

function buildPrimaryAlert(alerts: RoomAlertItem[]) {
  return alerts.sort((a, b) => {
    const toneRank = { critical: 2, warning: 1, ok: 0 };
    return toneRank[b.tone] - toneRank[a.tone];
  })[0] || null;
}

function resolveRoomBase(
  sala: SalaRecord | null,
  fallbackName: string,
): SalaRecord {
  if (sala) return sala;

  const key = normalizeRoomKey(fallbackName) || 'sala_legada';
  const label = fallbackName || 'Sala legada';
  return {
    id: key,
    codigo: key.toUpperCase(),
    nome: label,
    tipo: 'legado',
    ativa: true,
    descricao: 'Sala derivada automaticamente a partir de lotes, sensores ou atuadores legados.',
  };
}

export function isRoomLinkDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('debugRooms') === '1' || window.localStorage.getItem('debugRooms') === '1';
  } catch {
    return false;
  }
}

function matchControllerToRoom(controller: RoomController, room: SalaRecord) {
  const roomAliases = toAliasSet(room.id, room.codigo, room.nome);
  const controllerAliases = toAliasSet(
    controller.sala_id,
    controller.sala_ref?.id,
    controller.sala_ref?.codigo,
    controller.sala_ref?.nome,
    controller.localizacao,
  );

  if (controllerAliases.some((alias) => roomAliases.includes(alias))) return true;

  const segmentedCandidates = [controller.localizacao, controller.nome]
    .flatMap((value) => normalizeText(value).split(/[^a-z0-9]+/g))
    .filter(Boolean);

  return segmentedCandidates.some((token) => roomAliases.includes(normalizeRoomKey(token)));
}

export function aggregateRooms(args: {
  salas: SalaRecord[];
  lotes: RoomLote[];
  sensores: RoomSensorMonitor[];
  atuadores: RoomController[];
}) {
  const salasMap = new Map<string, SalaRecord>();
  const salasById = new Map<string, SalaRecord>();

  const registerSala = (sala: SalaRecord) => {
    salasById.set(sala.id, sala);
    for (const alias of toAliasSet(sala.id, sala.codigo, sala.nome)) {
      salasMap.set(alias, sala);
    }
  };

  for (const sala of args.salas) {
    registerSala(sala);
  }

  const resolveSala = (...candidates: Array<string | null | undefined>) => {
    for (const candidate of candidates) {
      const alias = normalizeRoomKey(candidate);
      if (alias && salasMap.has(alias)) return salasMap.get(alias) || null;
      if (candidate && salasById.has(candidate)) return salasById.get(candidate) || null;
    }
    return null;
  };

  const roomBuckets = new Map<string, { sala: SalaRecord; lotes: RoomLote[]; sensores: RoomSensorMonitor[]; atuadores: RoomController[] }>();

  const ensureBucket = (roomBase: SalaRecord) => {
    const key = roomBase.id;
    if (!roomBuckets.has(key)) {
      roomBuckets.set(key, {
        sala: roomBase,
        lotes: [],
        sensores: [],
        atuadores: [],
      });
    }
    return roomBuckets.get(key)!;
  };

  for (const sala of args.salas) {
    ensureBucket(sala);
  }

  for (const lote of args.lotes) {
    const linkedSala = resolveSala(
      lote.sala_id,
      lote.sala_ref?.id,
      lote.sala_ref?.codigo,
      lote.sala_ref?.nome,
      lote.sala,
    );

    const roomBase = resolveRoomBase(linkedSala, lote.sala_ref?.nome || lote.sala || 'Sala não informada');
    ensureBucket(roomBase).lotes.push(lote);
  }

  for (const sensor of args.sensores) {
    const linkedSala = resolveSala(sensor.sala_id, sensor.sala);

    const fallbackName = sensor.sala || sensor.codigo_lote || 'Sala não informada';
    const roomBase = resolveRoomBase(linkedSala, fallbackName);
    ensureBucket(roomBase).sensores.push(sensor);
  }

  for (const atuador of args.atuadores) {
    const explicitSala = resolveSala(
      atuador.sala_id,
      atuador.sala_ref?.id,
      atuador.sala_ref?.codigo,
      atuador.sala_ref?.nome,
    );

    const roomBase = explicitSala || resolveRoomBase(null, atuador.sala_ref?.nome || atuador.localizacao || atuador.nome);
    ensureBucket(roomBase).atuadores.push(atuador);
  }

  for (const bucket of roomBuckets.values()) {
    bucket.lotes = bucket.lotes.filter((lote, index, list) => {
      return list.findIndex((candidate) => candidate.id === lote.id) === index;
    });

    bucket.atuadores = bucket.atuadores.filter((atuador, index, list) => {
      return list.findIndex((candidate) => candidate.id === atuador.id) === index;
    });

    bucket.sensores = bucket.sensores.filter((sensor, index, list) => {
      return list.findIndex((candidate) => candidate.id === sensor.id && candidate.ambiente_source === sensor.ambiente_source) === index;
    });
  }

  args.atuadores.forEach((atuador) => {
    if (atuador.sala_id || atuador.sala_ref?.id) return;

    const room = Array.from(roomBuckets.values()).find((bucket) => matchControllerToRoom(atuador, bucket.sala));
    if (room && !room.atuadores.some((item) => item.id === atuador.id)) {
      room.atuadores.push(atuador);
    }
  });

  const rooms = Array.from(roomBuckets.values()).map<RoomOperationalModel>((bucket) => {
    const sensorFeeds = bucket.sensores
      .reduce<RoomSensorNode[]>((acc, sensor) => {
        const key = getSensorSourceKey(sensor);
        if (acc.some((item) => item.key === key)) return acc;

        const lastSample = sensor.historico?.[sensor.historico.length - 1];
        const lastSeen = parseDateValue(lastSample?.timestamp || null);
        const online = Boolean(lastSeen && Date.now() - lastSeen.getTime() <= 1000 * 60 * 90);

        acc.push({
          key,
          label: getSensorLabel(sensor),
          sourceLabel: getSensorSourceLabel(sensor),
          online,
          lastSeen,
          temperatura: sensor.sensor_atual.temperatura,
          umidade: sensor.sensor_atual.umidade,
          co2: sensor.sensor_atual.co2,
          luminosidade: typeof sensor.sensor_atual.luminosidade_lux === 'number' ? sensor.sensor_atual.luminosidade_lux : null,
          scoreRisco: sensor.score_risco,
          alertas: sensor.alertas || [],
          history: sensor.historico || [],
          linkedLotId: sensor.id,
          linkedLotCode: sensor.codigo_lote,
        });

        return acc;
      }, [])
      .sort((a, b) => Number(b.online) - Number(a.online) || b.scoreRisco - a.scoreRisco);

    const medias = {
      temperatura: average(sensorFeeds.map((item) => item.temperatura)),
      umidade: average(sensorFeeds.map((item) => item.umidade)),
      co2: average(sensorFeeds.map((item) => item.co2)),
      luminosidade: average(sensorFeeds.map((item) => item.luminosidade)),
    };

    const divergence = {
      temperatura: maxSpread(sensorFeeds.map((item) => item.temperatura)),
      umidade: maxSpread(sensorFeeds.map((item) => item.umidade)),
      co2: maxSpread(sensorFeeds.map((item) => item.co2)),
    };

    const offlineSensors = sensorFeeds.filter((item) => !item.online).length;
    const alerts: RoomAlertItem[] = [];

    const highestRiskSensor = [...sensorFeeds].sort((a, b) => b.scoreRisco - a.scoreRisco)[0] || null;
    if (highestRiskSensor?.alertas?.length) {
      alerts.push({
        id: `${bucket.sala.id}-primary-sensor`,
        tone: highestRiskSensor.scoreRisco >= 70 ? 'critical' : 'warning',
        title: highestRiskSensor.alertas[0],
        description: `${highestRiskSensor.label} • ${highestRiskSensor.sourceLabel}`,
      });
    }

    if (offlineSensors > 0) {
      alerts.push({
        id: `${bucket.sala.id}-offline`,
        tone: 'warning',
        title: `${offlineSensors} sensor(es) offline`,
        description: 'Verifique conectividade e alimentação dos sensores da sala.',
      });
    }

    if (divergence.temperatura >= 1.5 || divergence.umidade >= 8 || divergence.co2 >= 120) {
      alerts.push({
        id: `${bucket.sala.id}-divergence`,
        tone: 'warning',
        title: 'Desvio entre sensores',
        description: 'Sensores da mesma sala estão divergindo além da tolerância operacional.',
      });
    }

    const statusInfo = resolveRoomStatus({
      alerts,
      offlineSensors,
      divergence,
    });

    const rules: RoomAutomationRule[] = [];
    const tempMinValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.temperatura_min);
    const tempMaxValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.temperatura_max);
    const umidMinValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.umidade_min);
    const umidMaxValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.umidade_max);
    const co2IdealValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.co2_ideal_max);
    const lumMinValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.luminosidade_min_lux);
    const lumMaxValues = bucket.sensores.map((sensor) => sensor.limites_operacionais?.luminosidade_max_lux);
    const lotCo2Values = bucket.lotes.map((lote) => lote.produto?.perfil_cultivo?.co2_ideal_max);
    const lotLumMinValues = bucket.lotes.map((lote) => lote.produto?.perfil_cultivo?.luminosidade_min_lux);
    const lotLumMaxValues = bucket.lotes.map((lote) => lote.produto?.perfil_cultivo?.luminosidade_max_lux);

    const hasSensorTempTargets = tempMinValues.some((value) => typeof value === 'number') || tempMaxValues.some((value) => typeof value === 'number');
    const hasSensorHumidityTargets = umidMinValues.some((value) => typeof value === 'number') || umidMaxValues.some((value) => typeof value === 'number');
    const hasSensorCo2Targets = co2IdealValues.some((value) => typeof value === 'number');
    const hasSensorLightTargets = lumMinValues.some((value) => typeof value === 'number') || lumMaxValues.some((value) => typeof value === 'number');
    const hasLotLightTargets = lotLumMinValues.some((value) => typeof value === 'number') || lotLumMaxValues.some((value) => typeof value === 'number');

    const targets: RoomAutomationTargets = {
      temperatura: {
        min: pickStrictRange(tempMinValues, 20, 'min'),
        max: pickStrictRange(tempMaxValues, 25, 'max'),
        source: hasSensorTempTargets ? 'sensor_limits' : 'fallback',
      },
      umidade: {
        min: pickStrictRange(umidMinValues, 80, 'min'),
        max: pickStrictRange(umidMaxValues, 90, 'max'),
        source: hasSensorHumidityTargets ? 'sensor_limits' : 'fallback',
      },
      co2: {
        idealMax: pickStrictRange([...co2IdealValues, ...lotCo2Values], 1000, 'max'),
        source: hasSensorCo2Targets ? 'sensor_limits' : lotCo2Values.some((value) => typeof value === 'number') ? 'lot_context' : 'fallback',
      },
      luminosidade: {
        min: hasSensorLightTargets || hasLotLightTargets ? pickStrictRange([...lumMinValues, ...lotLumMinValues], 0, 'min') : null,
        max: hasSensorLightTargets || hasLotLightTargets ? pickStrictRange([...lumMaxValues, ...lotLumMaxValues], 0, 'max') : null,
        source: hasSensorLightTargets ? 'sensor_limits' : hasLotLightTargets ? 'lot_context' : 'fallback',
      },
    };

    const activePhaseCounts = new Map<string, number>();
    for (const lote of bucket.lotes.filter(isOperationalLote)) {
      const phase = lote.fase_operacional || 'sem fase';
      activePhaseCounts.set(phase, (activePhaseCounts.get(phase) || 0) + 1);
    }
    const primaryPhase = Array.from(activePhaseCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const lotContext: RoomLotContext = {
      primaryPhase,
      phases: Array.from(activePhaseCounts.keys()),
      lotCodes: bucket.lotes.map((lote) => lote.codigo_lote),
      highlightedLotCode: bucket.lotes.sort((a, b) => Number((b.blocos_resumo?.total || 0)) - Number((a.blocos_resumo?.total || 0)))[0]?.codigo_lote || null,
    };

    rules.push({
      id: `${bucket.sala.id}-temp`,
      title: 'Temperatura média da sala',
      description: medias.temperatura !== null && medias.temperatura > targets.temperatura.max
        ? `Acionar correção térmica porque a média está em ${medias.temperatura.toFixed(1)}°C.`
        : medias.temperatura !== null && medias.temperatura < targets.temperatura.min
          ? `Aquecer a sala porque a média está em ${medias.temperatura.toFixed(1)}°C.`
          : `Manter temperatura entre ${targets.temperatura.min}°C e ${targets.temperatura.max}°C.`,
      tone:
        medias.temperatura !== null && (medias.temperatura > targets.temperatura.max + 1.5 || medias.temperatura < targets.temperatura.min - 1.5)
          ? 'critical'
          : medias.temperatura !== null && (medias.temperatura > targets.temperatura.max || medias.temperatura < targets.temperatura.min)
            ? 'warning'
            : 'ok',
      active: medias.temperatura !== null && (medias.temperatura > targets.temperatura.max || medias.temperatura < targets.temperatura.min),
    });

    rules.push({
      id: `${bucket.sala.id}-humidity`,
      title: 'Umidade média da sala',
      description: medias.umidade !== null && medias.umidade < targets.umidade.min
        ? `Aumentar umidificação porque a média está em ${medias.umidade.toFixed(0)}%.`
        : medias.umidade !== null && medias.umidade > targets.umidade.max
          ? `Reduzir umidificação porque a média está em ${medias.umidade.toFixed(0)}%.`
          : `Manter umidade entre ${targets.umidade.min}% e ${targets.umidade.max}%.`,
      tone:
        medias.umidade !== null && (medias.umidade < targets.umidade.min - 8 || medias.umidade > targets.umidade.max + 8)
          ? 'critical'
          : medias.umidade !== null && (medias.umidade < targets.umidade.min || medias.umidade > targets.umidade.max)
            ? 'warning'
            : 'ok',
      active: medias.umidade !== null && (medias.umidade < targets.umidade.min || medias.umidade > targets.umidade.max),
    });

    rules.push({
      id: `${bucket.sala.id}-co2`,
      title: 'CO2 médio da sala',
      description: medias.co2 !== null && medias.co2 > targets.co2.idealMax
        ? `Aumentar ventilação/exaustão porque a média está em ${medias.co2.toFixed(0)} ppm.`
        : `Manter CO2 abaixo de ${targets.co2.idealMax} ppm.`,
      tone:
        medias.co2 !== null && medias.co2 > targets.co2.idealMax + 180
          ? 'critical'
          : medias.co2 !== null && medias.co2 > targets.co2.idealMax
            ? 'warning'
            : 'ok',
      active: medias.co2 !== null && medias.co2 > targets.co2.idealMax,
    });

    rules.push({
      id: `${bucket.sala.id}-light`,
      title: 'Luminosidade média da sala',
      description:
        medias.luminosidade === null || (targets.luminosidade.min === null && targets.luminosidade.max === null)
          ? 'Sem referência suficiente de luz para automação da sala.'
          : targets.luminosidade.min !== null && medias.luminosidade < targets.luminosidade.min
            ? `Elevar iluminação porque a média está em ${medias.luminosidade.toFixed(0)} lux.`
            : targets.luminosidade.max !== null && medias.luminosidade > targets.luminosidade.max
              ? `Reduzir iluminação porque a média está em ${medias.luminosidade.toFixed(0)} lux.`
              : `Manter iluminação dentro da faixa ${targets.luminosidade.min ?? 0}-${targets.luminosidade.max ?? 0} lux.`,
      tone:
        medias.luminosidade !== null &&
        ((targets.luminosidade.min !== null && medias.luminosidade < targets.luminosidade.min) ||
          (targets.luminosidade.max !== null && medias.luminosidade > targets.luminosidade.max))
          ? 'warning'
          : 'ok',
      active:
        medias.luminosidade !== null &&
        ((targets.luminosidade.min !== null && medias.luminosidade < targets.luminosidade.min) ||
          (targets.luminosidade.max !== null && medias.luminosidade > targets.luminosidade.max)),
    });

    rules.push({
      id: `${bucket.sala.id}-sync`,
      title: 'Coerência entre sensores',
      description: offlineSensors > 0
        ? `${offlineSensors} sensor(es) sem atualização recente.`
        : divergence.temperatura >= 1.5 || divergence.umidade >= 8 || divergence.co2 >= 120
          ? 'Há divergência entre sensores e a automação deve considerar inspeção manual.'
          : 'Sensores coerentes e aptos para automação por média da sala.',
      tone:
        offlineSensors > 0
          ? 'warning'
          : divergence.temperatura >= 1.5 || divergence.umidade >= 8 || divergence.co2 >= 120
            ? 'warning'
            : 'ok',
      active: offlineSensors > 0 || divergence.temperatura >= 1.5 || divergence.umidade >= 8 || divergence.co2 >= 120,
    });

    const history = sensorFeeds.find((item) => item.sourceLabel === 'Leitura compartilhada da sala')?.history ||
      sensorFeeds[0]?.history ||
      [];

    const aliases = toAliasSet(bucket.sala.id, bucket.sala.codigo, bucket.sala.nome);

    return {
      sala: bucket.sala,
      lotes: bucket.lotes.sort((a, b) => Number((b.blocos_resumo?.total || 0)) - Number((a.blocos_resumo?.total || 0))),
      sensores: sensorFeeds,
      atuadores: bucket.atuadores.sort((a, b) => normalizeText(a.nome).localeCompare(normalizeText(b.nome))),
      mediaTemperatura: medias.temperatura,
      mediaUmidade: medias.umidade,
      mediaCo2: medias.co2,
      mediaLuminosidade: medias.luminosidade,
      sensoresOnline: sensorFeeds.filter((item) => item.online).length,
      lotesAtivos: bucket.lotes.filter(isOperationalLote).length,
      status: statusInfo.status,
      statusLabel: statusInfo.label,
      primaryAlert: buildPrimaryAlert(alerts),
      alerts,
      rules,
      targets,
      lotContext,
      ownership: {
        principalUnit: 'sala',
        sensorsOwnedBySala: true,
        actuatorsOwnedBySala: true,
        lotsContextualToSala: true,
        automationScope: 'room_average_with_lot_context',
        primaryReference: 'sala_id',
        compatibilityFallbacks: bucket.sala.tipo === 'legado'
          ? ['nome/codigo/localizacao legados']
          : [],
      },
      history,
      divergence,
      diagnostics: {
        aliases,
        linkedLotes: bucket.lotes.length,
        linkedSensores: sensorFeeds.length,
        linkedAtuadores: bucket.atuadores.length,
        offlineSensors,
        usedLegacyFallback: bucket.sala.tipo === 'legado',
      },
    };
  });

  const sortedRooms = rooms.sort((a, b) => {
    const rank = { critical: 2, warning: 1, ok: 0 };
    return rank[b.status] - rank[a.status] || a.sala.nome.localeCompare(b.sala.nome);
  });

  if (isRoomLinkDebugEnabled()) {
    console.groupCollapsed('[rooms] aggregateRooms diagnostics');
    console.table(
      sortedRooms.map((room) => ({
        sala: room.sala.nome,
        id: room.sala.id,
        aliases: room.diagnostics.aliases.join(', '),
        lotes: room.diagnostics.linkedLotes,
        sensores: room.diagnostics.linkedSensores,
        atuadores: room.diagnostics.linkedAtuadores,
        offline: room.diagnostics.offlineSensors,
        fallback: room.diagnostics.usedLegacyFallback ? 'legacy' : 'explicit',
        status: room.status,
      })),
    );
    console.groupEnd();
  }

  return sortedRooms;
}
