import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Droplets,
  Eye,
  Loader2,
  MoreHorizontal,
  Thermometer,
  Wind,
} from 'lucide-react';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchServer } from '../../utils/supabase/client';

interface DashboardLote {
  id: string;
  codigo_lote: string;
  status?: string | null;
  sala?: string | null;
  temperatura_atual?: number | null;
  umidade_atual?: number | null;
  fase_operacional?: string | null;
  data_previsao_colheita?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  blocos_resumo?: {
    total?: number | null;
    frutificacao?: number | null;
    colhido?: number | null;
  } | null;
  produto?: {
    nome?: string | null;
  } | null;
}

interface DashboardSensorMonitoramento {
  id: string;
  score_risco: number;
  alertas: string[];
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    luminosidade_lux?: number;
  };
  limites_operacionais?: {
    temperatura_min?: number;
    temperatura_max?: number;
    umidade_min?: number;
    umidade_max?: number;
    co2_ideal_max?: number;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
  } | null;
}

interface DashboardColheita {
  id?: string;
  data_colheita?: string | null;
  quantidade_kg?: string | number | null;
  lote_id?: string | null;
  lote?: {
    codigo_lote?: string | null;
    sala?: string | null;
  } | null;
}

interface DashboardEstoque {
  quantidade_kg?: string | number | null;
}

interface VisionRun {
  id: string;
  executed_at: string;
  captured_at?: string | null;
  quality_status?: string | null;
  preview_url?: string | null;
  preview_error?: string | null;
  summary_json?: Record<string, any> | null;
  raw_result_json?: Record<string, any> | null;
}

type DashboardStatus = 'critical' | 'warning' | 'ok';

interface DashboardIssue {
  key: 'temperatura' | 'umidade' | 'co2' | 'geral';
  severity: DashboardStatus;
  badge: string;
  title: string;
  action: string;
  context: string;
  metricValue: string;
}

interface DashboardOperationalLote extends DashboardLote {
  scoreRisco: number;
  alertas: string[];
  temperatura: number | null;
  umidade: number | null;
  co2: number | null;
  faseLabel: string;
  statusTone: DashboardStatus;
  primaryIssue: DashboardIssue | null;
  nextEvent: {
    type: string;
    date: Date;
    label: string;
  } | null;
}

interface DashboardRoomCard {
  sala: string;
  status: DashboardStatus;
  statusLabel: string;
  phaseLabel: string;
  issue: DashboardIssue | null;
  primaryMetric: {
    value: string;
    icon: typeof Thermometer | typeof Droplets | typeof Wind | typeof AlertTriangle;
  };
  impactLots: number;
  actionLabel: string;
  actionHref: string;
}

interface DashboardActionItem {
  title: string;
  context: string;
  tone: DashboardStatus;
  href: string;
}

interface DashboardEventItem {
  key: string;
  title: string;
  subtitle: string;
  when: string;
  href: string;
}

const PHASE_LABELS: Record<string, string> = {
  esterilizacao: 'Esterilização',
  inoculacao: 'Inoculação',
  incubacao: 'Incubação',
  pronto_para_frutificacao: 'Pronto p/ frutificação',
  frutificacao: 'Frutificação',
  colheita: 'Colheita',
  encerramento: 'Encerramento',
  'em cultivo': 'Em cultivo',
  pronto: 'Pronto',
};

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const fallback = new Date(value);
  if (!Number.isNaN(fallback.getTime())) return fallback;
  return null;
}

function formatPhaseLabel(value?: string | null) {
  if (!value) return 'Monitoramento ativo';
  const normalized = value.trim().toLowerCase();
  return PHASE_LABELS[normalized] || value;
}

function formatShortDate(date?: Date | null) {
  if (!date) return '--';
  return format(date, 'dd/MM/yy', { locale: ptBR });
}

function formatRelativeEvent(date?: Date | null) {
  if (!date) return 'Sem previsão';
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanhã';
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: ptBR });
}

function getVisionQualityHeadline(status?: string | null) {
  switch (status) {
    case 'valid':
      return 'Análise válida';
    case 'too_blurry':
      return 'Imagem desfocada';
    case 'too_dark':
      return 'Imagem escura';
    case 'too_bright':
      return 'Imagem clara demais';
    case 'invalid_image':
      return 'Análise crítica';
    default:
      return 'Em revisão';
  }
}

function getDetectedBlocksCount(run?: VisionRun | null) {
  const explicitCount = Number(
    run?.summary_json?.blocos_detectados ??
    run?.raw_result_json?.summary?.blocos_detectados ??
    run?.raw_result_json?.block_detection?.blocos_detectados ??
    NaN,
  );

  if (Number.isFinite(explicitCount)) {
    return Math.max(0, Math.round(explicitCount));
  }

  const detections = run?.raw_result_json?.detections ?? run?.summary_json?.detections;
  return Array.isArray(detections) ? detections.length : 0;
}

function getVisionLotLabel(run?: VisionRun | null) {
  const lot =
    run?.summary_json?.codigo_lote ||
    run?.summary_json?.lote_codigo ||
    run?.summary_json?.lote ||
    run?.raw_result_json?.codigo_lote ||
    run?.raw_result_json?.lote_codigo ||
    null;

  return lot ? String(lot) : 'Lote não identificado';
}

function getVisionAnomalyLabel(run?: VisionRun | null) {
  const alert =
    run?.summary_json?.anomalia ||
    run?.summary_json?.alerta ||
    run?.summary_json?.alertas?.[0] ||
    run?.raw_result_json?.summary?.anomalia ||
    run?.raw_result_json?.summary?.alerta ||
    run?.raw_result_json?.summary?.alertas?.[0] ||
    run?.preview_error ||
    null;

  if (alert) return String(alert);
  if (run?.quality_status && run.quality_status !== 'valid') {
    return getVisionQualityHeadline(run.quality_status);
  }
  return 'Última análise sem anomalia relevante.';
}

function getPrimaryIssue(
  lote: DashboardLote,
  sensor?: DashboardSensorMonitoramento | null,
): DashboardIssue | null {
  const temperatura = sensor?.sensor_atual?.temperatura ?? lote.temperatura_atual ?? null;
  const umidade = sensor?.sensor_atual?.umidade ?? lote.umidade_atual ?? null;
  const co2 = sensor?.sensor_atual?.co2 ?? null;
  const tempMin = sensor?.limites_operacionais?.temperatura_min ?? 20;
  const tempMax = sensor?.limites_operacionais?.temperatura_max ?? 25;
  const umidMin = sensor?.limites_operacionais?.umidade_min ?? 80;
  const umidMax = sensor?.limites_operacionais?.umidade_max ?? 90;
  const co2Ideal = sensor?.limites_operacionais?.co2_ideal_max ?? 1000;

  if (temperatura !== null && temperatura > tempMax) {
    return {
      key: 'temperatura',
      severity: temperatura >= tempMax + 2 ? 'critical' : 'warning',
      badge: 'Alerta de calor',
      title: 'Temperatura acima do ideal',
      action: 'Corrigir temperatura',
      context: `${temperatura.toFixed(1)}°C no ambiente atual.`,
      metricValue: `${temperatura.toFixed(1)}°C`,
    };
  }

  if (umidade !== null && umidade < umidMin) {
    return {
      key: 'umidade',
      severity: umidade <= umidMin - 8 ? 'critical' : 'warning',
      badge: 'Umidade baixa',
      title: 'Umidade abaixo da faixa ideal',
      action: 'Aumentar umidificação',
      context: `${umidade.toFixed(0)}% no ambiente atual.`,
      metricValue: `${umidade.toFixed(0)}%`,
    };
  }

  if (umidade !== null && umidade > umidMax) {
    return {
      key: 'umidade',
      severity: umidade >= umidMax + 8 ? 'critical' : 'warning',
      badge: 'Umidade alta',
      title: 'Umidade acima da faixa ideal',
      action: 'Reduzir umidificação',
      context: `${umidade.toFixed(0)}% no ambiente atual.`,
      metricValue: `${umidade.toFixed(0)}%`,
    };
  }

  if (co2 !== null && co2 > co2Ideal) {
    return {
      key: 'co2',
      severity: co2 >= co2Ideal + 180 ? 'critical' : 'warning',
      badge: 'CO2 elevado',
      title: 'CO2 acima do ideal',
      action: 'Aumentar ventilação',
      context: `${co2.toFixed(0)}ppm no ambiente atual.`,
      metricValue: `${co2.toFixed(0)}ppm`,
    };
  }

  if (sensor?.alertas?.[0]) {
    return {
      key: 'geral',
      severity: sensor.score_risco >= 70 ? 'critical' : 'warning',
      badge: sensor.score_risco >= 70 ? 'Crítico' : 'Atenção',
      title: sensor.alertas[0],
      action: 'Revisar sala',
      context: sensor.alertas[0],
      metricValue: 'Análise',
    };
  }

  return null;
}

export function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lotes, setLotes] = useState<DashboardLote[]>([]);
  const [sensores, setSensores] = useState<DashboardSensorMonitoramento[]>([]);
  const [colheitas, setColheitas] = useState<DashboardColheita[]>([]);
  const [estoqueTotal, setEstoqueTotal] = useState(0);
  const [latestVisionRun, setLatestVisionRun] = useState<VisionRun | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        const [
          lotesResponse,
          sensoresResponse,
          colheitasResponse,
          estoqueResponse,
          latestVisionResponse,
        ] = await Promise.all([
          fetchServer('/lotes'),
          fetchServer('/sensores/latest?hours=24'),
          fetchServer('/colheitas'),
          fetchServer('/estoque'),
          fetchServer('/vision/runs/latest'),
        ]);

        setLotes((lotesResponse?.lotes || []) as DashboardLote[]);
        setSensores((sensoresResponse?.sensores || []) as DashboardSensorMonitoramento[]);
        setColheitas((colheitasResponse?.colheitas || []) as DashboardColheita[]);

        const estoqueKg = ((estoqueResponse?.estoque || []) as DashboardEstoque[]).reduce((sum, item) => {
          return sum + Number(item.quantidade_kg || 0);
        }, 0);
        setEstoqueTotal(Math.round(estoqueKg * 10) / 10);
        setLatestVisionRun((latestVisionResponse?.run || null) as VisionRun | null);
      } catch (error: any) {
        console.error('Erro ao carregar dashboard:', error);
        setErrorMessage(error?.message || 'Erro ao carregar dados do dashboard.');
        setLotes([]);
        setSensores([]);
        setColheitas([]);
        setEstoqueTotal(0);
        setLatestVisionRun(null);
      } finally {
        setLoading(false);
      }
    }

    void loadDashboardData();
  }, []);

  const sensoresPorLote = useMemo(() => {
    return new Map<string, DashboardSensorMonitoramento>(sensores.map((sensor) => [sensor.id, sensor]));
  }, [sensores]);

  const operationalLotes = useMemo<DashboardOperationalLote[]>(() => {
    return lotes.map((lote) => {
      const sensor = sensoresPorLote.get(lote.id) || null;
      const temperatura = sensor?.sensor_atual?.temperatura ?? lote.temperatura_atual ?? null;
      const umidade = sensor?.sensor_atual?.umidade ?? lote.umidade_atual ?? null;
      const co2 = sensor?.sensor_atual?.co2 ?? null;
      const primaryIssue = getPrimaryIssue(lote, sensor);
      const scoreRisco = sensor?.score_risco ?? 0;

      const statusTone: DashboardStatus =
        primaryIssue?.severity === 'critical' || scoreRisco >= 70
          ? 'critical'
          : primaryIssue?.severity === 'warning' || scoreRisco >= 30 || Boolean(sensor?.alertas?.length)
            ? 'warning'
            : 'ok';

      const harvestDate = parseDateValue(lote.data_previsao_colheita);
      const incubacaoDate = !lote.data_real_fim_incubacao ? parseDateValue(lote.data_prevista_fim_incubacao) : null;

      const nextEvent = harvestDate
        ? { type: 'colheita', date: harvestDate, label: 'Próxima colheita' }
        : incubacaoDate
          ? { type: 'incubacao', date: incubacaoDate, label: 'Fim de incubação' }
          : null;

      return {
        ...lote,
        scoreRisco,
        alertas: sensor?.alertas || [],
        temperatura,
        umidade,
        co2,
        faseLabel: formatPhaseLabel(lote.fase_operacional || lote.status),
        statusTone,
        primaryIssue,
        nextEvent,
      };
    });
  }, [lotes, sensoresPorLote]);

  const roomCards = useMemo<DashboardRoomCard[]>(() => {
    const grouped = new Map<string, DashboardOperationalLote[]>();

    for (const lote of operationalLotes) {
      const sala = lote.sala || 'Sala não informada';
      const current = grouped.get(sala) || [];
      current.push(lote);
      grouped.set(sala, current);
    }

    return Array.from(grouped.entries())
      .map(([sala, roomLotes]) => {
        const ordered = [...roomLotes].sort((a, b) => b.scoreRisco - a.scoreRisco);
        const topLote = ordered[0];
        const issue = topLote.primaryIssue;
        const impactLots = ordered.filter((item) => item.statusTone !== 'ok').length || ordered.length;
        const status = ordered.some((item) => item.statusTone === 'critical')
          ? 'critical'
          : ordered.some((item) => item.statusTone === 'warning')
            ? 'warning'
            : 'ok';

        const primaryMetric = issue?.key === 'umidade'
          ? { value: issue.metricValue, icon: Droplets }
          : issue?.key === 'co2'
            ? { value: issue.metricValue, icon: Wind }
            : issue?.key === 'geral'
              ? { value: issue.metricValue, icon: AlertTriangle }
              : { value: issue?.metricValue || `${(topLote.temperatura ?? 0).toFixed(1)}°C`, icon: Thermometer };

        return {
          sala,
          status,
          statusLabel: status === 'critical' ? 'Crítico' : status === 'warning' ? 'Atenção' : 'OK',
          phaseLabel: topLote.faseLabel,
          issue,
          primaryMetric,
          impactLots,
          actionLabel: issue?.action || 'Ver sala',
          actionHref: '/seguranca',
        };
      })
      .sort((a, b) => {
        const rank = { critical: 2, warning: 1, ok: 0 };
        return rank[b.status] - rank[a.status];
      });
  }, [operationalLotes]);

  const featuredCriticalRooms = useMemo(() => {
    const visible = roomCards.filter((room) => room.status !== 'ok');
    return (visible.length ? visible : roomCards).slice(0, 3);
  }, [roomCards]);

  const importantLotes = useMemo(() => {
    return [...operationalLotes]
      .sort((a, b) => {
        const statusRank = { critical: 2, warning: 1, ok: 0 };
        const rankDiff = statusRank[b.statusTone] - statusRank[a.statusTone];
        if (rankDiff !== 0) return rankDiff;

        if (a.nextEvent && b.nextEvent) {
          return a.nextEvent.date.getTime() - b.nextEvent.date.getTime();
        }

        if (a.nextEvent) return -1;
        if (b.nextEvent) return 1;
        return b.scoreRisco - a.scoreRisco;
      })
      .slice(0, 6);
  }, [operationalLotes]);

  const priorityActions = useMemo<DashboardActionItem[]>(() => {
    const actions: DashboardActionItem[] = featuredCriticalRooms.map((room) => ({
      title: `${room.actionLabel} na ${room.sala}`,
      context: room.issue?.context || `${room.impactLots} lote(s) sob monitoramento nesta sala.`,
      tone: room.status,
      href: room.actionHref,
    }));

    const anomalousLot = importantLotes.find((lote) => lote.statusTone !== 'ok' && lote.primaryIssue);
    if (anomalousLot) {
      actions.push({
        title: `Revisar lote ${anomalousLot.codigo_lote}`,
        context: anomalousLot.primaryIssue?.title || 'Lote com anomalia operacional detectada.',
        tone: anomalousLot.statusTone,
        href: `/lotes/${anomalousLot.id}`,
      });
    }

    if (latestVisionRun) {
      actions.push({
        title: `Checar última análise do Vision`,
        context: getVisionAnomalyLabel(latestVisionRun),
        tone: latestVisionRun.quality_status === 'valid' ? 'ok' : 'warning',
        href: `/vision${latestVisionRun.id ? `?run=${latestVisionRun.id}` : ''}`,
      });
    }

    return actions.slice(0, 4);
  }, [featuredCriticalRooms, importantLotes, latestVisionRun]);

  const nextHarvest = useMemo(() => {
    return operationalLotes
      .map((lote) => lote.nextEvent)
      .filter((item): item is NonNullable<DashboardOperationalLote['nextEvent']> => Boolean(item) && item.type === 'colheita')
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] || null;
  }, [operationalLotes]);

  const productionEstimate = useMemo(() => {
    const blocks = operationalLotes.reduce((sum, lote) => {
      return sum + Number(lote.blocos_resumo?.frutificacao || lote.blocos_resumo?.total || 0);
    }, 0);

    if (estoqueTotal > 0) {
      return {
        value: `${Math.round(estoqueTotal)}`,
        unit: 'kg',
        meta: 'Baseado na produção disponível atual.',
      };
    }

    return {
      value: `${blocks}`,
      unit: 'blocos',
      meta: 'Fallback com blocos monitorados em produção.',
    };
  }, [estoqueTotal, operationalLotes]);

  const summaryCards = useMemo(() => {
    return [
      {
        label: 'Salas Críticas',
        value: roomCards.filter((room) => room.status === 'critical').length.toString().padStart(2, '0'),
        meta: roomCards.filter((room) => room.status === 'critical').length > 0 ? 'requerem atenção' : 'sem alerta crítico',
        tone: 'critical',
      },
      {
        label: 'Lotes em Atenção',
        value: operationalLotes.filter((lote) => lote.statusTone !== 'ok').length.toString().padStart(2, '0'),
        meta: 'monitorando',
        tone: 'warning',
      },
      {
        label: 'Próximas Colheitas',
        value: nextHarvest ? formatShortDate(nextHarvest.date) : '--',
        meta: nextHarvest ? `Estimado ${formatRelativeEvent(nextHarvest.date)}` : 'Sem colheita prevista',
        tone: 'ok',
      },
      {
        label: 'Produção Estimada',
        value: productionEstimate.value,
        meta: productionEstimate.meta,
        tone: 'ok',
        unit: productionEstimate.unit,
      },
    ];
  }, [nextHarvest, operationalLotes, productionEstimate, roomCards]);

  const events = useMemo<DashboardEventItem[]>(() => {
    const upcomingFromLotes = operationalLotes
      .filter((lote) => lote.nextEvent)
      .map((lote) => ({
        key: `${lote.id}-${lote.nextEvent?.type}`,
        title: lote.nextEvent?.type === 'colheita' ? `Colheita ${lote.produto?.nome || lote.codigo_lote}` : 'Fim incubação',
        subtitle: `${lote.sala || 'Sala não informada'} • ${lote.codigo_lote}`,
        when: formatRelativeEvent(lote.nextEvent?.date || null),
        href: `/lotes/${lote.id}`,
        date: lote.nextEvent?.date || new Date(8640000000000000),
      }));

    const harvestedToday = colheitas
      .map((item) => {
        const date = parseDateValue(item.data_colheita);
        if (!date || !isToday(date)) return null;
        return {
          key: `colheita-${item.id || item.lote_id || date.toISOString()}`,
          title: item.lote?.codigo_lote ? `Colheita ${item.lote.codigo_lote}` : 'Colheita registrada',
          subtitle: item.lote?.sala || 'Registro operacional',
          when: format(date, 'HH:mm'),
          href: '/colheita',
          date,
        };
      })
      .filter((item): item is DashboardEventItem & { date: Date } => Boolean(item));

    return [...upcomingFromLotes, ...harvestedToday]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 5)
      .map(({ date: _date, ...item }) => item);
  }, [colheitas, operationalLotes]);

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#375328]" />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {errorMessage && (
        <div className="dashboard-inline-alert dashboard-inline-alert--danger">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Falha ao carregar a dashboard</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      <section className="dashboard-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className={`dashboard-summary-card dashboard-summary-card--${card.tone}`}>
            <span className="dashboard-summary-card__label">{card.label}</span>
            <div className="dashboard-summary-card__value-row">
              <strong className="dashboard-summary-card__value">{card.value}</strong>
              {card.unit ? <span className="dashboard-summary-card__unit">{card.unit}</span> : null}
            </div>
            <p className="dashboard-summary-card__meta">{card.meta}</p>
          </article>
        ))}
      </section>

      <div className="dashboard-layout">
        <div className="dashboard-main">
          <section className="dashboard-section">
            <div className="dashboard-section__header">
              <div className="dashboard-section__title-row">
                <AlertTriangle className="h-5 w-5 text-[#c52d27]" />
                <h2 className="dashboard-section__title">Salas Críticas</h2>
              </div>
            </div>

            <div className="dashboard-critical-grid">
              {featuredCriticalRooms.length > 0 ? featuredCriticalRooms.map((room) => {
                const MetricIcon = room.primaryMetric.icon;
                return (
                  <article key={room.sala} className={`dashboard-room-card dashboard-room-card--${room.status}`}>
                    <div className="dashboard-room-card__header">
                      <div>
                        <h3 className="dashboard-room-card__title">{room.sala}</h3>
                        <p className="dashboard-room-card__phase">{room.phaseLabel}</p>
                      </div>
                      <span className={`dashboard-room-card__badge dashboard-room-card__badge--${room.status}`}>
                        {room.issue?.badge || room.statusLabel}
                      </span>
                    </div>

                    <div className="dashboard-room-card__metric-row">
                      <div className="dashboard-room-card__metric">
                        <span className={`dashboard-room-card__metric-icon dashboard-room-card__metric-icon--${room.status}`}>
                          <MetricIcon className="h-4 w-4" />
                        </span>
                        <strong className="dashboard-room-card__metric-value">{room.primaryMetric.value}</strong>
                      </div>
                      <div className="dashboard-room-card__impact">
                        <span className="dashboard-room-card__impact-label">Impacto</span>
                        <strong className="dashboard-room-card__impact-value">{room.impactLots} lotes</strong>
                      </div>
                    </div>

                    <Link to={room.actionHref} className={`dashboard-room-card__cta dashboard-room-card__cta--${room.status}`}>
                      {room.actionLabel}
                    </Link>
                  </article>
                );
              }) : (
                <div className="dashboard-empty">
                  <strong>Nenhuma sala crítica neste momento</strong>
                  <p>O ambiente está estável. Acompanhe o painel para novos desvios operacionais.</p>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section__header">
              <h2 className="dashboard-section__title">Lotes Importantes</h2>
            </div>

            <div className="dashboard-lots-card">
              <div className="dashboard-lots-card__head">
                <span>Identificador</span>
                <span>Fase Atual</span>
                <span>Status</span>
                <span>Observação</span>
                <span></span>
              </div>

              <div className="dashboard-lots-card__body">
                {importantLotes.length > 0 ? importantLotes.map((lote) => (
                  <div key={lote.id} className="dashboard-lot-row">
                    <div className="dashboard-lot-row__id">
                      <strong>{lote.codigo_lote}</strong>
                    </div>
                    <div className="dashboard-lot-row__phase">{lote.faseLabel}</div>
                    <div className="dashboard-lot-row__status">
                      <span className={`dashboard-lot-status dashboard-lot-status--${lote.statusTone}`}>
                        {lote.statusTone === 'critical' ? 'Crítico' : lote.statusTone === 'warning' ? 'Risco médio' : 'OK'}
                      </span>
                    </div>
                    <div className="dashboard-lot-row__note">
                      {lote.primaryIssue?.title || lote.nextEvent?.label || 'Monitoramento contínuo'}
                    </div>
                    <div className="dashboard-lot-row__action">
                      <Link to={`/lotes/${lote.id}`} className="dashboard-lot-row__link" aria-label={`Abrir ${lote.codigo_lote}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )) : (
                  <div className="dashboard-empty">
                    <strong>Sem lotes destacados</strong>
                    <p>Os lotes monitorados aparecerão aqui conforme risco, evento próximo ou desvio operacional.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="dashboard-aside">
          <section className="dashboard-side-card dashboard-side-card--actions">
            <div className="dashboard-side-card__header">
              <h3 className="dashboard-side-card__title">Ações Prioritárias</h3>
            </div>
            <div className="dashboard-action-list">
              {priorityActions.length > 0 ? priorityActions.map((item) => (
                <Link key={`${item.title}-${item.href}`} to={item.href} className="dashboard-action-item">
                  <span className={`dashboard-action-item__dot dashboard-action-item__dot--${item.tone}`}></span>
                  <div className="dashboard-action-item__copy">
                    <strong>{item.title}</strong>
                    <p>{item.context}</p>
                  </div>
                </Link>
              )) : (
                <div className="dashboard-empty dashboard-empty--compact">
                  <strong>Sem ação pendente</strong>
                  <p>Quando houver desvios ou alertas, a fila operacional aparecerá aqui.</p>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-side-card dashboard-side-card--vision">
            <div className="dashboard-side-card__header dashboard-side-card__header--vision">
              <h3 className="dashboard-side-card__title dashboard-side-card__title--vision">IA Lab Vision</h3>
              <span className={`dashboard-live-badge ${latestVisionRun?.quality_status === 'valid' ? 'is-live' : ''}`}>
                {latestVisionRun ? 'Live' : 'Offline'}
              </span>
            </div>

            <div className="dashboard-vision-card">
              <div className="dashboard-vision-card__preview">
                {latestVisionRun?.preview_url ? (
                  <img src={latestVisionRun.preview_url} alt="Preview da última análise Vision" className="dashboard-vision-card__image" />
                ) : (
                  <div className="dashboard-vision-card__fallback">
                    <Eye className="h-7 w-7" />
                    <span>Sem preview disponível</span>
                  </div>
                )}
                <span className="dashboard-vision-card__caption">
                  {getVisionLotLabel(latestVisionRun)} • {formatRelativeEvent(parseDateValue(latestVisionRun?.captured_at || latestVisionRun?.executed_at))}
                </span>
              </div>

              <div className="dashboard-vision-card__stats">
                <div className="dashboard-vision-card__stat">
                  <span>Blocos Detectados</span>
                  <strong>{getDetectedBlocksCount(latestVisionRun)}</strong>
                </div>
              </div>

              <div className={`dashboard-vision-card__alert ${latestVisionRun?.quality_status === 'valid' ? '' : 'dashboard-vision-card__alert--warning'}`}>
                <div className="dashboard-vision-card__alert-title">
                  {getVisionQualityHeadline(latestVisionRun?.quality_status)}
                </div>
                <p>{getVisionAnomalyLabel(latestVisionRun)}</p>
              </div>

              <Link to={`/vision${latestVisionRun?.id ? `?run=${latestVisionRun.id}` : ''}`} className="dashboard-side-card__footer-link">
                Abrir Vision
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </section>

          <section className="dashboard-side-card dashboard-side-card--events">
            <div className="dashboard-side-card__header">
              <h3 className="dashboard-side-card__title">Próximos Eventos</h3>
            </div>
            <div className="dashboard-events-list">
              {events.length > 0 ? events.map((event) => (
                <Link key={event.key} to={event.href} className="dashboard-event-item">
                  <span className="dashboard-event-item__icon">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                  <div className="dashboard-event-item__copy">
                    <strong>{event.title}</strong>
                    <span>{event.subtitle}</span>
                  </div>
                  <span className="dashboard-event-item__time">{event.when}</span>
                </Link>
              )) : (
                <div className="dashboard-empty dashboard-empty--compact">
                  <strong>Sem eventos próximos</strong>
                  <p>Colheitas e marcos do ciclo aparecerão aqui quando houver previsão registrada.</p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
