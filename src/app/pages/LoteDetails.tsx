import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  Droplets,
  Eye,
  Info,
  Lightbulb,
  Loader2,
  Minus,
  Pause,
  Pencil,
  Play,
  Printer,
  QrCode,
  RefreshCcw,
  Scissors,
  Sparkles,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useCreateColheita } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';
import QRCode from 'qrcode';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { fetchServer } from '../../utils/supabase/client';
import { differenceInCalendarDays, differenceInDays, isValid, parseISO } from 'date-fns';
import { cn } from '../../components/ui/utils';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface SensorHistoryEntry {
  timestamp: string;
  temperatura: number;
  umidade: number;
  co2: number;
}

interface LoteData {
  id: string;
  codigo_lote: string;
  fase_operacional?: string | null;
  fase_atual?: string | null;
  data_inicio: string;
  data_inoculacao?: string | null;
  data_previsao_colheita?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  sala?: string | null;
  prateleira?: string | null;
  temperatura_atual?: number | null;
  umidade_atual?: number | null;
  quantidade_inicial?: number | null;
  unidade?: string | null;
  status?: string | null;
  observacoes?: string | null;
  produto?: {
    nome?: string | null;
    variedade?: string | null;
    descricao?: string | null;
    tempo_cultivo_dias?: number | null;
    temperatura_ideal_min?: number | null;
    temperatura_ideal_max?: number | null;
    umidade_ideal_min?: number | null;
    umidade_ideal_max?: number | null;
    perfil_cultivo?: {
      co2_ideal_max?: number | null;
    } | null;
  } | null;
}

interface TimeLapseFrame {
  id: string;
  sequence_index: number;
  captured_at: string | null;
  executed_at: string | null;
  preview_url: string | null;
  image_storage_path: string | null;
  quality_status: string | null;
  dataset_class: string | null;
  blocos_detectados: number;
}

interface TimeLapsePayload {
  lote?: {
    id?: string;
    codigo_lote?: string | null;
    sala?: string | null;
    data_inicio?: string | null;
    data_inoculacao?: string | null;
    data_previsao_colheita?: string | null;
  } | null;
  match_strategy?: string | null;
  frame_count?: number;
  frames?: TimeLapseFrame[];
  empty_reason?: string | null;
}

interface VisualAnalysisDetection {
  label?: string | null;
  confidence?: number | null;
  bbox?: number[] | null;
}

interface VisualAnalysisData {
  lote?: {
    id?: string;
    codigo_lote?: string | null;
    sala?: string | null;
  } | null;
  analise_disponivel?: boolean;
  run_id?: string | null;
  match_strategy?: string | null;
  blocos_detectados?: number | null;
  quantidade_esperada?: number | null;
  quantidade_esperada_origem?: string | null;
  diferenca_blocos?: number | null;
  confianca_media?: number | null;
  ultimo_timestamp_analise?: string | null;
  status?: 'ok' | 'atencao' | 'critico' | 'sem_referencia' | 'sem_analise';
  status_label?: string | null;
  imagem_preview_url?: string | null;
  run_diagnostics?: {
    selected_run_id?: string | null;
    selected_run_timestamp?: string | null;
    selection_reason?: string | null;
    candidate_runs_count?: number | null;
    block_count_source?: string | null;
    detector_error?: string | null;
    matched_cameras_count?: number | null;
  } | null;
  detections?: VisualAnalysisDetection[];
}

interface OperationalRecommendation {
  status_geral: 'ok' | 'atencao' | 'critico' | 'dados_insuficientes';
  score_operacional: number;
  ambiente_atual?: {
    temperatura?: number | null;
    umidade?: number | null;
    co2?: number | null;
    luminosidade_lux?: number | null;
    timestamp?: string | null;
    source?: string | null;
    metricas?: {
      temperatura?: OperationalMetricData | null;
      umidade?: OperationalMetricData | null;
      co2?: OperationalMetricData | null;
      luminosidade?: OperationalMetricData | null;
    } | null;
  } | null;
  limites_operacionais?: {
    temperatura_min?: number | null;
    temperatura_max?: number | null;
    umidade_min?: number | null;
    umidade_max?: number | null;
    co2_ideal_max?: number | null;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
    ciclo_estimado_dias_min?: number | null;
    ciclo_estimado_dias_max?: number | null;
  } | null;
  alertas?: Array<{
    codigo: string;
    severidade: 'warning' | 'critical';
    categoria: string;
    mensagem: string;
  }>;
  recomendacoes_priorizadas?: Array<{
    prioridade: 'alta' | 'media' | 'baixa';
    categoria: string;
    titulo: string;
    descricao: string;
  }>;
  resumo_recomendacoes?: string | null;
  fallback?: {
    ambiente_disponivel?: boolean;
    sensor_disponivel?: boolean;
    perfil_disponivel?: boolean;
    usando_fallback_sensor?: boolean;
    usando_fallback_perfil?: boolean;
    origens_por_metrica?: {
      temperatura?: string | null;
      umidade?: string | null;
      co2?: string | null;
      luminosidade?: string | null;
    } | null;
  } | null;
}

interface OperationalMetricData {
  valor?: number | null;
  origem?: 'sensor_tempo_real' | 'fallback_lote' | 'sem_leitura';
  origem_label?: string;
  timestamp?: string | null;
  status?: 'normal' | 'acima' | 'abaixo' | 'sem_leitura';
  status_label?: string;
  ideal_min?: number | null;
  ideal_max?: number | null;
  aviso?: string | null;
}

interface ProductionForecast {
  data_prevista_colheita?: string | null;
  producao_estimada_kg?: number | null;
  faixa_estimativa_kg_min?: number | null;
  faixa_estimativa_kg_max?: number | null;
  confianca?: 'baixa' | 'media' | 'alta' | null;
  observacoes?: string[];
  base_calculo?: {
    quantidade_blocos?: number | null;
    peso_medio_produto_kg?: number | null;
    substrato_total_kg?: number | null;
    ciclo_estimado_dias_min?: number | null;
    ciclo_estimado_dias_max?: number | null;
    score_operacional?: number | null;
    fator_ajuste_ambiente?: number | null;
    metodologia?: string | null;
  } | null;
  fallback?: {
    usando_quantidade_inicial?: boolean;
    usando_media_padrao_por_bloco?: boolean;
    usando_substrato?: boolean;
    usando_fallback_sensor?: boolean;
    usando_fallback_perfil?: boolean;
  } | null;
}

const MAX_TIMELAPSE_FRAMES = 36;
const TIMELAPSE_PLAY_INTERVAL_MS = 320;

function formatDateShort(value?: string | null) {
  if (!value) return 'N/D';
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('pt-BR');
}

function formatDateLong(value?: string | null) {
  if (!value) return 'N/D';
  const date = parseISO(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('pt-BR', { dateStyle: 'long' });
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatFaseLabel(fase?: string | null) {
  const labels: Record<string, string> = {
    esterilizacao: 'Esterilização',
    inoculacao: 'Inoculação',
    incubacao: 'Incubação',
    pronto_para_frutificacao: 'Pronto para Frutificação',
    frutificacao: 'Frutificação',
    colheita: 'Colheita',
    encerramento: 'Encerramento',
  };

  if (!fase) return 'Não definida';
  return labels[fase] || fase;
}

function formatMetricValue(value?: number | null, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sem leitura';
  return `${Number(value).toFixed(digits)}${suffix}`;
}

function formatIdealMetric(min?: number | null, max?: number | null, suffix = '') {
  if (max !== null && max !== undefined && (min === null || min === undefined)) {
    return `Até ${Number(max).toFixed(0)}${suffix}`;
  }

  if (min === null || min === undefined || max === null || max === undefined) {
    return 'Sem faixa ideal';
  }

  return `${Number(min).toFixed(0)}-${Number(max).toFixed(0)}${suffix}`;
}

function formatReadingAge(value?: string | null) {
  if (!value) return null;

  const date = parseISO(value);
  if (!isValid(date)) return null;

  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / (1000 * 60)));
  if (diffMinutes < 1) return 'Última leitura: agora';
  if (diffMinutes < 60) return `Última leitura: ${diffMinutes} min atrás`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Última leitura: ${diffHours} h atrás`;

  return `Última leitura: ${Math.round(diffHours / 24)} dia(s) atrás`;
}

function getRecommendationStatusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    ok: 'Estável',
    atencao: 'Atenção',
    critico: 'Crítico',
    dados_insuficientes: 'Dados insuficientes',
  };
  return labels[String(status || '')] || 'Sem status';
}

function getRecommendationStatusClass(status?: string | null) {
  switch (status) {
    case 'ok':
      return 'lot-badge--ok';
    case 'atencao':
      return 'lot-badge--attention';
    case 'critico':
      return 'lot-badge--critical';
    default:
      return 'lot-badge--neutral';
  }
}

function getPhaseBadgeClass(fase?: string | null) {
  switch (fase) {
    case 'frutificacao':
      return 'lot-badge--phase-earth';
    case 'incubacao':
      return 'lot-badge--phase-green';
    case 'esterilizacao':
      return 'lot-badge--phase-green';
    default:
      return 'lot-badge--neutral';
  }
}

function getVisualAnalysisStatusClass(status?: string | null) {
  if (status === 'ok' || status === 'atencao' || status === 'critico') {
    return getRecommendationStatusClass(status);
  }

  return 'lot-badge--neutral';
}

function getExpectedBlockCountSourceLabel(source?: string | null) {
  if (source === 'lotes_blocos') {
    return 'Esperado com base nos blocos cadastrados do lote.';
  }

  if (source === 'quantidade_inicial') {
    return 'Esperado com base na quantidade inicial informada no lote.';
  }

  return 'Cadastre a quantidade esperada para comparar detectado versus esperado.';
}

function formatConfidencePercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'N/D';
  }

  const numericValue = Number(value);
  const percentValue = numericValue <= 1 ? numericValue * 100 : numericValue;
  return `${Math.round(percentValue)}%`;
}

function formatBlockDifference(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value)) || value === 0) {
    return null;
  }

  return `${value > 0 ? '+' : ''}${Number(value)} bloco${Math.abs(Number(value)) === 1 ? '' : 's'}`;
}

function getRecommendationPriorityClass(priority?: string | null) {
  switch (priority) {
    case 'alta':
      return 'lot-chip--danger';
    case 'media':
      return 'lot-chip--warning';
    default:
      return 'lot-chip--neutral';
  }
}

function getForecastConfidenceClass(confidence?: string | null) {
  switch (confidence) {
    case 'alta':
      return 'lot-chip--success';
    case 'media':
      return 'lot-chip--warning';
    default:
      return 'lot-chip--neutral';
  }
}

function getMetricStatusClass(status?: string | null) {
  switch (status) {
    case 'normal':
      return 'lot-chip--success';
    case 'acima':
      return 'lot-chip--danger';
    case 'abaixo':
      return 'lot-chip--warning';
    default:
      return 'lot-chip--neutral';
  }
}

function getMetricStatusTextClass(status?: string | null) {
  switch (status) {
    case 'normal':
      return 'lot-sensor__value--success';
    case 'acima':
      return 'lot-sensor__value--danger';
    case 'abaixo':
      return 'lot-sensor__value--warning';
    default:
      return 'lot-sensor__value--muted';
  }
}

function getPriorityLabel(priority?: string | null) {
  switch (priority) {
    case 'alta':
      return 'Alta';
    case 'media':
      return 'Média';
    default:
      return 'Baixa';
  }
}

function getActionLead(priority?: string | null) {
  switch (priority) {
    case 'alta':
      return 'Faça agora';
    case 'media':
      return 'Próxima ação';
    default:
      return 'Acompanhe';
  }
}

function getMetricDisplayState(metricKey: string, metric?: OperationalMetricData | null) {
  if (!metric || metric.valor === null || metric.valor === undefined) {
    return {
      label: 'Sem leitura',
      badgeClass: 'lot-chip--neutral',
    };
  }

  if (metric.status === 'normal') {
    return {
      label: 'OK',
      badgeClass: 'lot-chip--success',
    };
  }

  const min = metric.ideal_min ?? null;
  const max = metric.ideal_max ?? null;
  const value = Number(metric.valor);

  let isCritical = false;
  if (metricKey === 'temperatura' && min !== null && max !== null) {
    isCritical = value < min - 2 || value > max + 2;
  } else if (metricKey === 'umidade' && min !== null && max !== null) {
    isCritical = value < min - 8 || value > max + 8;
  } else if (metricKey === 'co2' && max !== null) {
    isCritical = value > max * 1.5;
  } else if (metricKey === 'luminosidade' && min !== null && max !== null) {
    const range = Math.max(max - min, 1);
    isCritical = value < min - range * 0.25 || value > max + range * 0.25;
  }

  return isCritical
    ? { label: 'Crítico', badgeClass: 'lot-chip--danger' }
    : { label: 'Alerta', badgeClass: 'lot-chip--warning' };
}

function getMetricStress(value: number | null | undefined, min?: number | null, max?: number | null) {
  if (value === null || value === undefined) return null;

  if (max !== null && max !== undefined && value > max) {
    const base = max === 0 ? 1 : max;
    return (value - max) / base;
  }

  if (min !== null && min !== undefined && value < min) {
    const base = min === 0 ? 1 : min;
    return (min - value) / base;
  }

  return 0;
}

function getOperationalTrend(
  history: SensorHistoryEntry[],
  metrics?: OperationalRecommendation['ambiente_atual']['metricas'] | null,
) {
  if (!metrics) {
    return {
      label: 'Sem tendência',
      description: 'Histórico insuficiente para inferir tendência.',
      icon: Minus,
      className: 'lot-trend-icon--muted',
    };
  }

  const samples = history.slice(-6);
  if (samples.length < 2) {
    return {
      label: 'Sem tendência',
      description: 'Histórico insuficiente para inferir tendência.',
      icon: Minus,
      className: 'lot-trend-icon--muted',
    };
  }

  const midpoint = Math.max(1, Math.floor(samples.length / 2));
  const previousWindow = samples.slice(0, midpoint);
  const currentWindow = samples.slice(midpoint);

  const averageStress = (window: SensorHistoryEntry[]) => {
    const values = window
      .map((sample) => {
        const stressValues = [
          getMetricStress(sample.temperatura, metrics.temperatura?.ideal_min, metrics.temperatura?.ideal_max),
          getMetricStress(sample.umidade, metrics.umidade?.ideal_min, metrics.umidade?.ideal_max),
          getMetricStress(sample.co2, undefined, metrics.co2?.ideal_max),
        ].filter((value): value is number => value !== null);

        if (!stressValues.length) return null;
        return stressValues.reduce((sum, value) => sum + value, 0) / stressValues.length;
      })
      .filter((value): value is number => value !== null);

    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  const previousStress = averageStress(previousWindow);
  const currentStress = averageStress(currentWindow);

  if (previousStress === null || currentStress === null) {
    return {
      label: 'Sem tendência',
      description: 'Histórico insuficiente para inferir tendência.',
      icon: Minus,
      className: 'lot-trend-icon--muted',
    };
  }

  const delta = previousStress - currentStress;
  if (delta > 0.03) {
    return {
      label: 'Melhorando',
      description: 'O ambiente recente está mais próximo da faixa ideal.',
      icon: TrendingUp,
      className: 'lot-trend-icon--positive',
    };
  }

  if (delta < -0.03) {
    return {
      label: 'Piorando',
      description: 'As leituras recentes se afastaram da faixa ideal.',
      icon: TrendingDown,
      className: 'lot-trend-icon--negative',
    };
  }

  return {
    label: 'Estável',
    description: 'Sem mudança relevante no comportamento recente.',
    icon: Minus,
    className: 'lot-trend-icon--stable',
  };
}

function getOperationalImpact(score: number, status?: string | null) {
  let producaoImpacto = Math.round((100 - score) * 0.45);
  let atrasoDias = Math.max(0, Math.round((100 - score) / 12));

  if (status === 'critico') {
    producaoImpacto += 6;
    atrasoDias += 2;
  } else if (status === 'atencao') {
    producaoImpacto += 2;
    atrasoDias += 1;
  }

  producaoImpacto = Math.min(Math.max(producaoImpacto, 0), 40);
  atrasoDias = Math.min(Math.max(atrasoDias, 0), 10);

  return {
    producaoImpacto,
    atrasoDias,
    resumo:
      producaoImpacto <= 5
        ? 'Impacto operacional baixo no rendimento esperado.'
        : producaoImpacto <= 15
          ? 'Se nada mudar, o lote tende a perder rendimento moderado.'
          : 'O ambiente atual já pode comprometer materialmente produção e ciclo.',
  };
}

function formatHistoryAxisTick(value?: string | null) {
  if (!value) return '';
  const date = parseISO(value);
  if (!isValid(date)) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatHistoryTooltipLabel(value?: string | null) {
  if (!value) return '';
  const date = parseISO(value);
  if (!isValid(date)) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimelapseFrameTimestamp(frame?: TimeLapseFrame | null) {
  return frame?.captured_at || frame?.executed_at || null;
}

function parseTimelapseFrameDate(frame?: TimeLapseFrame | null) {
  const value = getTimelapseFrameTimestamp(frame);
  return parseDateValue(value);
}

function sortTimelapseFramesChronologically(frames: TimeLapseFrame[]) {
  return [...frames].sort((a, b) => {
    const aDate = parseTimelapseFrameDate(a);
    const bDate = parseTimelapseFrameDate(b);

    if (aDate && bDate) {
      return aDate.getTime() - bDate.getTime();
    }

    if (aDate) return -1;
    if (bDate) return 1;

    return (a.sequence_index || 0) - (b.sequence_index || 0);
  });
}

function getTimelapseFrameKey(frame: TimeLapseFrame, index: number) {
  return frame.id || `${frame.sequence_index || 0}-${index}`;
}

function getTimelapseCalendarDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dedupeTimelapseFrames(frames: TimeLapseFrame[]) {
  const uniqueFrames = new Map<string, TimeLapseFrame>();

  frames.forEach((frame, index) => {
    uniqueFrames.set(getTimelapseFrameKey(frame, index), frame);
  });

  return Array.from(uniqueFrames.values());
}

function sampleEvenlyDistributedFrames(frames: TimeLapseFrame[], limit: number) {
  if (limit <= 0) {
    return [];
  }

  if (frames.length <= limit) {
    return frames;
  }

  const step = (frames.length - 1) / (limit - 1);
  const sampledFrames = new Map<string, TimeLapseFrame>();

  for (let index = 0; index < limit; index += 1) {
    const targetIndex = Math.round(index * step);
    const frame = frames[Math.min(targetIndex, frames.length - 1)];
    sampledFrames.set(getTimelapseFrameKey(frame, index), frame);
  }

  return Array.from(sampledFrames.values());
}

function getCultivoDayNumber(target: Date | null, start: Date | null) {
  if (!target || !start) return null;
  return Math.max(1, differenceInCalendarDays(target, start) + 1);
}

function pickRepresentativeFrameForDay(frames: TimeLapseFrame[]) {
  if (frames.length <= 1) {
    return frames[0] || null;
  }

  return frames[Math.floor(frames.length / 2)] || frames[0] || null;
}

function formatTimelapseDateTime(value?: string | null) {
  const date = parseDateValue(value);
  if (!date) return 'Captura sem timestamp';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimelapseBucketKey(date: Date, totalHours: number) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');

  if (totalHours >= 24 * 10) {
    return `${year}-${month}-${day}`;
  }

  if (totalHours >= 24 * 2) {
    const bucketHour = Math.floor(date.getHours() / 6) * 6;
    return `${year}-${month}-${day}-${String(bucketHour).padStart(2, '0')}`;
  }

  if (totalHours >= 8) {
    return `${year}-${month}-${day}-${hour}`;
  }

  const bucketMinute = Math.floor(date.getMinutes() / 30) * 30;
  return `${year}-${month}-${day}-${hour}-${String(bucketMinute).padStart(2, '0')}`;
}

function sampleTimelapseFrames(frames: TimeLapseFrame[], limit = MAX_TIMELAPSE_FRAMES) {
  const orderedFrames = sortTimelapseFramesChronologically(frames);
  if (orderedFrames.length <= limit) {
    return orderedFrames;
  }

  if (limit <= 1) {
    return orderedFrames.slice(0, 1);
  }

  const datedFrames = orderedFrames
    .map((frame) => ({
      frame,
      date: parseTimelapseFrameDate(frame),
    }))
    .filter((item): item is { frame: TimeLapseFrame; date: Date } => Boolean(item.date));

  if (datedFrames.length <= limit) {
    return orderedFrames.slice(0, limit);
  }

  const firstFrame = orderedFrames[0];
  const lastFrame = orderedFrames[orderedFrames.length - 1];
  const middleSlots = Math.max(0, limit - 2);

  if (middleSlots === 0) {
    return dedupeTimelapseFrames([firstFrame, lastFrame]);
  }

  const middleDatedFrames = datedFrames.slice(1, -1);
  const framesByDay = new Map<string, TimeLapseFrame[]>();

  middleDatedFrames.forEach(({ frame, date }) => {
    const dayKey = getTimelapseCalendarDayKey(date);
    if (!framesByDay.has(dayKey)) {
      framesByDay.set(dayKey, []);
    }
    framesByDay.get(dayKey)!.push(frame);
  });

  const dailyRepresentativeFrames = sortTimelapseFramesChronologically(
    Array.from(framesByDay.values())
      .map((dayFrames) => pickRepresentativeFrameForDay(dayFrames))
      .filter((frame): frame is TimeLapseFrame => Boolean(frame)),
  );

  const sampledMiddleFrames = dailyRepresentativeFrames.length <= middleSlots
    ? dailyRepresentativeFrames
    : sampleEvenlyDistributedFrames(dailyRepresentativeFrames, middleSlots);

  const sampledFrames = dedupeTimelapseFrames([
    firstFrame,
    ...sampledMiddleFrames,
    lastFrame,
  ]);

  if (sampledFrames.length >= Math.min(limit, orderedFrames.length)) {
    return sortTimelapseFramesChronologically(sampledFrames);
  }

  const remainingSlots = limit - sampledFrames.length;
  const spanHours = Math.max(
    1,
    (datedFrames[datedFrames.length - 1].date.getTime() - datedFrames[0].date.getTime()) / (1000 * 60 * 60),
  );
  const sampledFrameKeys = new Set(
    sampledFrames.map((frame, index) => getTimelapseFrameKey(frame, index)),
  );
  const uniqueByBucket = new Map<string, TimeLapseFrame>();

  for (const item of middleDatedFrames) {
    const bucketKey = getTimelapseBucketKey(item.date, spanHours);
    const frameKey = getTimelapseFrameKey(item.frame, item.frame.sequence_index || 0);
    if (!sampledFrameKeys.has(frameKey) && !uniqueByBucket.has(bucketKey)) {
      uniqueByBucket.set(bucketKey, item.frame);
    }
  }

  const unsampledMiddleFrames = sortTimelapseFramesChronologically(Array.from(uniqueByBucket.values())).filter((frame) =>
    !sampledFrames.some((sampledFrame) => sampledFrame.id === frame.id && sampledFrame.sequence_index === frame.sequence_index),
  );

  return sortTimelapseFramesChronologically(
    dedupeTimelapseFrames([
      ...sampledFrames,
      ...sampleEvenlyDistributedFrames(unsampledMiddleFrames, remainingSlots),
    ]),
  ).slice(0, limit);
}

function estimateTimelapseCycleDays(
  lote: LoteData | null,
  recommendationData: OperationalRecommendation | null,
  forecastData: ProductionForecast | null,
) {
  const recommendationMin = recommendationData?.limites_operacionais?.ciclo_estimado_dias_min ?? null;
  const recommendationMax = recommendationData?.limites_operacionais?.ciclo_estimado_dias_max ?? null;
  const produtoTempo = lote?.produto?.tempo_cultivo_dias ?? null;

  if (typeof recommendationMax === 'number' && recommendationMax > 0) return recommendationMax;
  if (typeof recommendationMin === 'number' && recommendationMin > 0) return recommendationMin;
  if (typeof produtoTempo === 'number' && produtoTempo > 0) return produtoTempo;

  const inoculacao = parseDateValue(lote?.data_inoculacao || lote?.data_inicio);
  const colheita = parseDateValue(forecastData?.data_prevista_colheita || lote?.data_previsao_colheita);

  if (inoculacao && colheita) {
    return Math.max(1, differenceInCalendarDays(colheita, inoculacao));
  }

  return null;
}

export function LoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lote, setLote] = useState<LoteData | null>(null);
  const [sensorHistory, setSensorHistory] = useState<SensorHistoryEntry[]>([]);
  const [recommendationData, setRecommendationData] = useState<OperationalRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<ProductionForecast | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [visualAnalysisData, setVisualAnalysisData] = useState<VisualAnalysisData | null>(null);
  const [visualAnalysisError, setVisualAnalysisError] = useState<string | null>(null);
  const [isColheitaOpen, setIsColheitaOpen] = useState(false);
  const [isTimelapseOpen, setIsTimelapseOpen] = useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const [isAiInsightVisible, setIsAiInsightVisible] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelapseFrames, setTimelapseFrames] = useState<TimeLapseFrame[]>([]);
  const [timelapseLoading, setTimelapseLoading] = useState(false);
  const [timelapseError, setTimelapseError] = useState<string | null>(null);
  const [timelapseEmptyReason, setTimelapseEmptyReason] = useState<string | null>(null);
  const [timelapseSummary, setTimelapseSummary] = useState<TimeLapsePayload | null>(null);
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  const timelapseInterval = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    lote_id: id || '',
    quantidade_kg: 0,
    qualidade: 'Premium',
    observacoes: '',
  });

  const { post: createColheita, loading: creating } = useCreateColheita();

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    if (!id) return;

    const silent = options?.silent ?? false;

    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setRecommendationLoading(true);
      setRecommendationError(null);
      setForecastLoading(true);
      setForecastError(null);
      setVisualAnalysisError(null);

      const loteResult = await fetchServer(`/lotes/${id}`);
      const [historyResult, recommendationResult, forecastResult, timelapseSummaryResult, visualAnalysisResult] = await Promise.allSettled([
        fetchServer(`/sensores/history?lote_id=${id}&hours=168`),
        fetchServer(`/lotes/${id}/recomendacoes-operacionais`),
        fetchServer(`/lotes/${id}/previsao-producao`),
        fetchServer(`/lotes/${id}/timelapse?limit=12`),
        fetchServer(`/lotes/${id}/analise-visual`),
      ]);

      const loteData = (loteResult?.lote || null) as LoteData | null;

      setLote(loteData);
      if (historyResult.status === 'fulfilled') {
        setSensorHistory((historyResult.value?.historico || []) as SensorHistoryEntry[]);
      } else {
        setSensorHistory([]);
      }

      if (recommendationResult.status === 'fulfilled') {
        setRecommendationData((recommendationResult.value || null) as OperationalRecommendation | null);
      } else {
        setRecommendationData(null);
        setRecommendationError(
          recommendationResult.reason instanceof Error
            ? recommendationResult.reason.message
            : 'Não foi possível carregar as recomendações operacionais.',
        );
      }

      if (forecastResult.status === 'fulfilled') {
        setForecastData((forecastResult.value || null) as ProductionForecast | null);
      } else {
        setForecastData(null);
        setForecastError(
          forecastResult.reason instanceof Error
            ? forecastResult.reason.message
            : 'Não foi possível carregar a previsão de produção.',
        );
      }

      if (timelapseSummaryResult.status === 'fulfilled') {
        setTimelapseSummary((timelapseSummaryResult.value || null) as TimeLapsePayload | null);
      } else {
        setTimelapseSummary(null);
      }

      if (visualAnalysisResult.status === 'fulfilled') {
        setVisualAnalysisData((visualAnalysisResult.value || null) as VisualAnalysisData | null);
      } else {
        setVisualAnalysisData(null);
        setVisualAnalysisError(
          visualAnalysisResult.reason instanceof Error
            ? visualAnalysisResult.reason.message
            : 'Não foi possível carregar a análise visual do lote.',
        );
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes do lote:', error);
      toast.error('Erro ao carregar detalhes do lote.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setRecommendationLoading(false);
      setForecastLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!visualAnalysisData?.run_id) return;
    console.debug('[lote-details] visual analysis loaded', {
      lote_id: id,
      run_id: visualAnalysisData.run_id,
      ultimo_timestamp_analise: visualAnalysisData.ultimo_timestamp_analise || null,
      blocos_detectados: visualAnalysisData.blocos_detectados ?? null,
      diagnostics: visualAnalysisData.run_diagnostics || null,
    });
  }, [id, visualAnalysisData]);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      lote_id: id || '',
    }));
  }, [id]);

  const dataInicioLote = parseDateValue(lote?.data_inicio);
  const dataInoculacaoLote = parseDateValue(lote?.data_inoculacao || lote?.data_inicio);
  const diasCultivo = dataInicioLote ? Math.max(0, differenceInDays(new Date(), dataInicioLote)) : 0;
  const diasDesdeInoculacao = dataInoculacaoLote ? Math.max(0, differenceInDays(new Date(), dataInoculacaoLote)) : 0;

  useEffect(() => {
    if (isQRCodeOpen) {
      QRCode.toDataURL(`${window.location.origin}/lotes/${id}`)
        .then((url) => setQrCodeUrl(url))
        .catch((error) => console.error(error));
    }
  }, [isQRCodeOpen, id]);

  async function loadTimeLapse() {
    if (!id) return;

    try {
      setTimelapseLoading(true);
      setTimelapseError(null);
      const result = await fetchServer(`/lotes/${id}/timelapse?limit=180`);
      setTimelapseFrames((result?.frames || []) as TimeLapseFrame[]);
      setTimelapseEmptyReason(result?.empty_reason || null);
      setTimelapseIndex(0);
      setIsPlaying(false);
    } catch (error) {
      console.error('Erro ao carregar time-lapse do lote:', error);
      setTimelapseFrames([]);
      setTimelapseEmptyReason(null);
      setTimelapseError(error instanceof Error ? error.message : 'Não foi possível carregar o time-lapse.');
      setIsPlaying(false);
    } finally {
      setTimelapseLoading(false);
    }
  }

  function openTimelapseDialog() {
    setIsTimelapseOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('visual', '1');
    setSearchParams(nextParams, { replace: true });
  }

  function handleTimelapseDialogChange(open: boolean) {
    setIsTimelapseOpen(open);
    const nextParams = new URLSearchParams(searchParams);

    if (open) {
      nextParams.set('visual', '1');
    } else {
      nextParams.delete('visual');
    }

    setSearchParams(nextParams, { replace: true });
  }

  useEffect(() => {
    return () => {
      if (timelapseInterval.current) {
        clearInterval(timelapseInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTimelapseOpen) {
      if (timelapseInterval.current) {
        clearInterval(timelapseInterval.current);
      }
      setIsPlaying(false);
    }
  }, [isTimelapseOpen]);

  useEffect(() => {
    if (isTimelapseOpen) {
      void loadTimeLapse();
    }
  }, [id, isTimelapseOpen]);

  useEffect(() => {
    const visualParam = searchParams.get('visual');
    if (visualParam === '1') {
      setIsTimelapseOpen(true);
    }
  }, [searchParams]);

  const sampledTimelapseFrames = useMemo(
    () => sampleTimelapseFrames(timelapseFrames, MAX_TIMELAPSE_FRAMES),
    [timelapseFrames],
  );

  useEffect(() => {
    if (timelapseIndex >= sampledTimelapseFrames.length) {
      setTimelapseIndex(0);
    }
  }, [sampledTimelapseFrames.length, timelapseIndex]);

  useEffect(() => {
    if (!isPlaying || sampledTimelapseFrames.length <= 1) {
      if (timelapseInterval.current) {
        clearInterval(timelapseInterval.current);
        timelapseInterval.current = null;
      }
      return undefined;
    }

    timelapseInterval.current = setInterval(() => {
      setTimelapseIndex((prev) => (prev + 1) % sampledTimelapseFrames.length);
    }, TIMELAPSE_PLAY_INTERVAL_MS);

    return () => {
      if (timelapseInterval.current) {
        clearInterval(timelapseInterval.current);
        timelapseInterval.current = null;
      }
    };
  }, [isPlaying, sampledTimelapseFrames.length]);

  const handleColheitaSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createColheita(formData);
      toast.success('Colheita registrada com sucesso!');
      setIsColheitaOpen(false);
      setFormData({
        lote_id: id || '',
        quantidade_kg: 0,
        qualidade: 'Premium',
        observacoes: '',
      });
    } catch (error) {
      toast.error('Erro ao registrar colheita.');
      console.error('Erro ao registrar colheita:', error);
    }
  };

  const handleTimelapsePlay = () => {
    if (sampledTimelapseFrames.length <= 1) return;
    setIsPlaying((current) => !current);
  };

  const recommendationStatus = recommendationData?.status_geral || 'dados_insuficientes';
  const recommendationAlerts = recommendationData?.alertas || [];
  const prioritizedRecommendations = recommendationData?.recomendacoes_priorizadas || [];
  const operationalEnvironment = recommendationData?.ambiente_atual || null;
  const operationalMetrics = operationalEnvironment?.metricas || null;
  const trend = getOperationalTrend(sensorHistory, operationalMetrics);
  const impactEstimate = getOperationalImpact(recommendationData?.score_operacional || 0, recommendationStatus);
  const primaryForecast = forecastData?.data_prevista_colheita
    ? {
        titulo: 'Colheita provável',
        valor: formatDateShort(forecastData.data_prevista_colheita),
        subtitulo:
          forecastData.producao_estimada_kg !== null && forecastData.producao_estimada_kg !== undefined
            ? `${forecastData.producao_estimada_kg.toFixed(2)} kg estimados`
            : 'Previsão baseada no motor de produção',
      }
    : lote?.data_prevista_fim_incubacao
      ? {
          titulo: 'Fim da incubação',
          valor: formatDateShort(lote.data_prevista_fim_incubacao),
          subtitulo: 'Próximo marco operacional',
        }
      : lote?.data_previsao_colheita
        ? {
            titulo: 'Colheita prevista',
            valor: formatDateShort(lote.data_previsao_colheita),
            subtitulo: 'Planejamento atual do lote',
          }
        : {
            titulo: 'Previsão do lote',
            valor: 'Sem previsão',
            subtitulo: 'Aguardando base suficiente para estimar',
          };

  const environmentCards = [
    {
      key: 'temperatura',
      titulo: 'Temperatura',
      icon: Thermometer,
      metric: operationalMetrics?.temperatura || null,
      digits: 1,
      suffix: '°C',
      idealSuffix: '°C',
      iconClass: 'lot-sensor__icon--temperature',
    },
    {
      key: 'umidade',
      titulo: 'Umidade',
      icon: Droplets,
      metric: operationalMetrics?.umidade || null,
      digits: 0,
      suffix: '%',
      idealSuffix: '%',
      iconClass: 'lot-sensor__icon--humidity',
    },
    {
      key: 'co2',
      titulo: 'CO₂',
      icon: Wind,
      metric: operationalMetrics?.co2 || null,
      digits: 0,
      suffix: ' ppm',
      idealSuffix: ' ppm',
      iconClass: 'lot-sensor__icon--co2',
    },
    {
      key: 'luminosidade',
      titulo: 'Luminosidade',
      icon: Lightbulb,
      metric: operationalMetrics?.luminosidade || null,
      digits: 0,
      suffix: ' lux',
      idealSuffix: ' lux',
      iconClass: 'lot-sensor__icon--luminosidade',
    },
  ] as const;

  const operationalSourceSummary =
    operationalMetrics && environmentCards.some(({ metric }) => metric?.origem === 'sensor_tempo_real')
      ? 'Baseado nas mesmas leituras de sensor exibidas em Segurança.'
      : recommendationData?.fallback?.usando_fallback_sensor
        ? 'Sem leitura em tempo real. O painel usa fallback salvo no lote para as métricas permitidas.'
        : 'Sem leitura operacional disponível para este lote.';

  const actionItems = prioritizedRecommendations.length
    ? prioritizedRecommendations.map((item, index) => ({
        ...item,
        ordem: index + 1,
        lead: getActionLead(item.prioridade),
      }))
    : [];

  const quickActions = actionItems.slice(0, 3);
  const visibleActionItems = showAllRecommendations ? actionItems : quickActions;
  const primaryActionSummary = quickActions[0]?.titulo || null;
  const forecastConfidence = forecastData?.confianca || 'baixa';
  const forecastRangeText =
    forecastData?.faixa_estimativa_kg_min !== null &&
    forecastData?.faixa_estimativa_kg_min !== undefined &&
    forecastData?.faixa_estimativa_kg_max !== null &&
    forecastData?.faixa_estimativa_kg_max !== undefined
      ? `${forecastData.faixa_estimativa_kg_min.toFixed(2)}-${forecastData.faixa_estimativa_kg_max.toFixed(2)} kg`
      : 'N/D';
  const TrendIcon = trend.icon;
  const speciesLabel = lote?.produto?.variedade
    ? `${lote.produto?.nome} • ${lote.produto.variedade}`
    : lote?.produto?.nome || 'Produto não definido';
  const loteDisplayName = lote?.produto?.nome || lote?.produto?.variedade || lote?.codigo_lote || 'Lote';
  const visibleEnvironmentCards = environmentCards.filter(({ key, metric }) => {
    if (key !== 'luminosidade') return true;
    return Boolean(
      (metric?.valor !== null && metric?.valor !== undefined) ||
      (metric?.ideal_min !== null && metric?.ideal_min !== undefined) ||
      (metric?.ideal_max !== null && metric?.ideal_max !== undefined),
    );
  });
  const historyChartData = useMemo(
    () => sensorHistory.map((entry) => ({
      ...entry,
      label: formatHistoryAxisTick(entry.timestamp),
    })),
    [sensorHistory],
  );
  const productionEstimateLabel =
    forecastData?.producao_estimada_kg !== null && forecastData?.producao_estimada_kg !== undefined
      ? `${forecastData.producao_estimada_kg.toFixed(2)} kg`
      : 'N/D';
  const forecastDateCompact =
    forecastData?.data_prevista_colheita || lote?.data_previsao_colheita
      ? formatDateShort(forecastData?.data_prevista_colheita || lote?.data_previsao_colheita || null)
      : 'N/D';
  const confidencePercentLabel =
    forecastData?.confianca === 'alta'
      ? '94%'
      : forecastData?.confianca === 'media'
        ? '82%'
        : forecastData?.confianca === 'baixa'
          ? '68%'
          : formatConfidencePercent(recommendationData?.score_operacional ?? null);
  const confidenceBarWidth =
    forecastData?.confianca === 'alta'
      ? '94%'
      : forecastData?.confianca === 'media'
        ? '82%'
        : forecastData?.confianca === 'baixa'
          ? '68%'
          : `${Math.max(20, Math.min(100, recommendationData?.score_operacional ?? 40))}%`;
  const timelapseCycleDays = estimateTimelapseCycleDays(lote, recommendationData, forecastData);
  const timelapseStartDate = parseDateValue(lote?.data_inoculacao || lote?.data_inicio);
  const currentTimelapseFrame = sampledTimelapseFrames[timelapseIndex] || null;
  const currentTimelapseTimestamp = getTimelapseFrameTimestamp(currentTimelapseFrame);
  const currentTimelapseDate = parseTimelapseFrameDate(currentTimelapseFrame);
  const currentTimelapseDayNumber = getCultivoDayNumber(currentTimelapseDate, timelapseStartDate);
  const currentTimelapsePhaseLabel = formatFaseLabel(lote?.fase_operacional || lote?.fase_atual);
  const timelapseProgressRatio = currentTimelapseDayNumber !== null && timelapseCycleDays
    ? Math.min(1, Math.max(0, currentTimelapseDayNumber / Math.max(timelapseCycleDays, 1)))
    : sampledTimelapseFrames.length > 1
      ? timelapseIndex / (sampledTimelapseFrames.length - 1)
      : 0;
  const timelapseProgressText = currentTimelapseDayNumber !== null && timelapseCycleDays
    ? `Dia ${Math.min(currentTimelapseDayNumber, timelapseCycleDays)} de ${timelapseCycleDays}`
    : sampledTimelapseFrames.length
      ? `Momento ${timelapseIndex + 1} de ${sampledTimelapseFrames.length}`
      : 'Sem progresso disponível';
  const timelapseOverlayLabel = currentTimelapseDayNumber !== null
    ? `Dia ${currentTimelapseDayNumber} • ${currentTimelapsePhaseLabel}`
    : currentTimelapsePhaseLabel;
  const timelapseSummaryFrames = timelapseSummary?.frames || [];
  const timelapseFrameCount = timelapseSummary?.frame_count || 0;
  const hasTimelapseHistory = timelapseFrameCount > 0;
  const firstTimelapseFrame = timelapseSummaryFrames[0] || null;
  const lastTimelapseFrame = timelapseSummaryFrames[timelapseSummaryFrames.length - 1] || null;
  const firstTimelapseTimestamp = getTimelapseFrameTimestamp(firstTimelapseFrame);
  const lastTimelapseTimestamp = getTimelapseFrameTimestamp(lastTimelapseFrame);
  const timelapseSummaryText = hasTimelapseHistory
    ? lastTimelapseTimestamp && firstTimelapseTimestamp
      ? `${timelapseFrameCount} registros visuais entre ${formatDateShort(firstTimelapseTimestamp)} e ${formatDateShort(lastTimelapseTimestamp)}.`
      : `${timelapseFrameCount} registros visuais disponíveis para acompanhar o cultivo.`
    : null;
  const timelapseSharePath = id ? `/lotes/${id}?visual=1` : null;
  const visualAnalysisStatus = visualAnalysisData?.status || 'sem_analise';
  const visualAnalysisDetectedCount = visualAnalysisData?.blocos_detectados ?? null;
  const visualAnalysisExpectedCount = visualAnalysisData?.quantidade_esperada ?? null;
  const visualAnalysisDifferenceLabel = formatBlockDifference(visualAnalysisData?.diferenca_blocos);
  const visualAnalysisAgeText = visualAnalysisData?.ultimo_timestamp_analise
    ? formatReadingAge(visualAnalysisData.ultimo_timestamp_analise) || formatTimelapseDateTime(visualAnalysisData.ultimo_timestamp_analise)
    : 'Sem análise visual registrada';
  const visualAnalysisHasDetections = typeof visualAnalysisDetectedCount === 'number';
  const visualAnalysisDetectionsCount = Array.isArray(visualAnalysisData?.detections)
    ? visualAnalysisData?.detections.length
    : 0;
  const blockCountLabel = visualAnalysisExpectedCount
    ?? (lote?.quantidade_inicial !== null && lote?.quantidade_inicial !== undefined ? Math.round(lote.quantidade_inicial) : null);
  const visionPreviewUrl = visualAnalysisData?.imagem_preview_url || lastTimelapseFrame?.preview_url || firstTimelapseFrame?.preview_url || null;
  const visionStatusLabel = visualAnalysisData?.status_label
    || (visualAnalysisDifferenceLabel ? 'Anomalia detectada' : visualAnalysisHasDetections ? 'Monitoramento ativo' : 'Sem análise');
  const aiInsightText = recommendationData?.resumo_recomendacoes
    || recommendationAlerts[0]?.mensagem
    || primaryActionSummary
    || `O lote ${lote?.codigo_lote || id || ''} segue em monitoramento. Continue acompanhando sensores e análises visuais.`;
  const nextHarvestLabel = forecastData?.data_prevista_colheita
    ? formatDateShort(forecastData.data_prevista_colheita)
    : lote?.data_previsao_colheita
      ? formatDateShort(lote.data_previsao_colheita)
      : 'Sem previsão';
  const phaseLabel = formatFaseLabel(lote?.fase_operacional || lote?.fase_atual);
  const timelineItems = [
    {
      key: 'inoculacao',
      title: 'Inoculação',
      date: lote?.data_inoculacao || lote?.data_inicio || null,
      state: lote?.data_inoculacao || lote?.data_inicio ? 'done' : 'pending',
      detail: lote?.data_inoculacao ? formatDateLong(lote.data_inoculacao) : 'Registro inicial do lote',
    },
    {
      key: 'fim-incubacao',
      title: 'Fim da Incubação',
      date: lote?.data_real_fim_incubacao || lote?.data_prevista_fim_incubacao || null,
      state: lote?.data_real_fim_incubacao ? 'done' : phaseLabel === 'Incubação' ? 'current' : 'upcoming',
      detail: lote?.data_real_fim_incubacao
        ? 'Transição confirmada na operação.'
        : 'Marco monitorado durante o ciclo.',
    },
    {
      key: 'fase-atual',
      title: `${phaseLabel} em curso`,
      date: operationalEnvironment?.timestamp || visualAnalysisData?.ultimo_timestamp_analise || null,
      state: 'current',
      detail: recommendationAlerts[0]?.mensagem || operationalSourceSummary,
    },
    {
      key: 'colheita',
      title: 'Colheita prevista',
      date: forecastData?.data_prevista_colheita || lote?.data_previsao_colheita || null,
      state: forecastData?.data_prevista_colheita || lote?.data_previsao_colheita ? 'upcoming' : 'pending',
      detail: forecastData?.producao_estimada_kg !== null && forecastData?.producao_estimada_kg !== undefined
        ? `${forecastData.producao_estimada_kg.toFixed(2)} kg estimados`
        : 'Aguardando base suficiente para estimar.',
    },
  ] as const;

  if (loading) {
    return (
      <div className="lot-page">
        <div className="lot-page__grid">
          <div className="lot-page__main">
            <div className="lot-card animate-pulse" style={{ minHeight: 220, background: '#f4f4f0' }} />
            <div className="lot-card animate-pulse" style={{ minHeight: 128 }} />
            <div className="lot-card animate-pulse" style={{ minHeight: 164, background: '#fff8e7' }} />
            <div className="lot-stats-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="lot-card animate-pulse" style={{ minHeight: 132 }} />
              ))}
            </div>
            <div className="lot-card animate-pulse" style={{ minHeight: 360 }} />
          </div>
          <div className="lot-page__aside">
            <div className="lot-card animate-pulse" style={{ minHeight: 420 }} />
            <div className="lot-card animate-pulse" style={{ minHeight: 420, background: '#375328' }} />
          </div>
        </div>
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="lot-page">
        <div className="lot-card" style={{ maxWidth: 960, margin: '0 auto', padding: '2.5rem', textAlign: 'center' }}>
          <p className="lot-title" style={{ fontSize: '2rem' }}>Lote não encontrado</p>
          <p className="lot-copy" style={{ marginTop: '0.75rem' }}>
            Verifique a rota ou volte para a listagem de lotes.
          </p>
          <button
            type="button"
            onClick={() => navigate('/lotes')}
            className="lot-button lot-button--primary"
            style={{ marginTop: '1.5rem' }}
          >
            <ArrowLeft size={16} />
            Voltar para lotes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lot-page">
      <div className="lot-page__grid">
        <div className="lot-page__main">
          <section className="lot-hero">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div className="lot-hero__main">
                  <button
                    type="button"
                    onClick={() => navigate('/lotes')}
                    className="lot-back-button"
                    aria-label="Voltar para lotes"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div className="lot-hero__eyebrow">
                      <span className="lot-code">{lote.codigo_lote}</span>
                      <span className={cn('lot-badge', getPhaseBadgeClass(lote.fase_operacional || lote.fase_atual))}>
                        {phaseLabel}
                      </span>
                      <span className={cn('lot-badge', getRecommendationStatusClass(recommendationStatus))}>
                        {getRecommendationStatusLabel(recommendationStatus)}
                      </span>
                    </div>

                    <h1 className="lot-title">{loteDisplayName}</h1>

                    <div className="lot-pills">
                      <span className="lot-pill">Score {recommendationData?.score_operacional ?? '--'}</span>
                      <span className="lot-pill">{diasDesdeInoculacao} dias desde inoculação</span>
                      <span className="lot-pill__text">
                        {recommendationLoading ? 'Atualizando leitura operacional do lote...' : operationalSourceSummary}
                      </span>
                    </div>

                    <div className="lot-actions">
                      <button
                        type="button"
                        onClick={() => navigate(`/lotes/${id}/editar`)}
                        className="lot-button lot-button--secondary"
                      >
                        <Pencil size={16} />
                        Editar lote
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsColheitaOpen(true)}
                        className="lot-button lot-button--secondary"
                      >
                        <Scissors size={16} />
                        Colheita
                      </button>
                      <button
                        type="button"
                        onClick={openTimelapseDialog}
                        className="lot-button lot-button--secondary"
                      >
                        <Camera size={16} />
                        Time-lapse
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsQRCodeOpen(true)}
                        className="lot-button lot-button--secondary"
                      >
                        <QrCode size={16} />
                        QR Code
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void loadData({ silent: true })}
                  className="lot-button lot-button--primary"
                >
                  {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                  Atualizar lote
                </button>
              </div>
            </div>
          </section>

          <section className="lot-card lot-card--history">
            <div className="lot-history">
              <div className="lot-history__main">
                <div className="lot-history__icon">
                  <Camera size={20} />
                </div>
                <div>
                  <h2 className="lot-card-title">Histórico visual do lote disponível</h2>
                  <p className="lot-copy">
                    {timelapseSummaryText || 'Ainda não existem capturas suficientes para montar um histórico visual contínuo deste lote.'}
                  </p>
                </div>
              </div>

              <div className="lot-history__actions">
                <div>
                  <p className="lot-microcopy">Última captura</p>
                  <p className="lot-copy" style={{ marginTop: '0.35rem' }}>
                    {lastTimelapseTimestamp ? formatDateShort(lastTimelapseTimestamp) : 'Sem registro'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openTimelapseDialog}
                  data-share-path={timelapseSharePath || undefined}
                  className="lot-button lot-button--primary"
                  style={{ background: '#75584d', boxShadow: '0 12px 40px rgba(117, 88, 77, 0.18)' }}
                >
                  Abrir histórico visual
                </button>
              </div>
            </div>
          </section>

          {recommendationError || forecastError ? (
            <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recommendationError ? (
                <div className="lot-inline-alert lot-inline-alert--danger">{recommendationError}</div>
              ) : null}
              {forecastError ? (
                <div className="lot-inline-alert lot-inline-alert--warning">{forecastError}</div>
              ) : null}
            </section>
          ) : null}

          <section className="lot-card lot-card--impact">
            <div className="lot-impact">
              <div className="lot-impact__main">
                <div className="lot-impact__icon">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <p className="lot-impact__title">Impacto potencial</p>
                  <p className="lot-impact__value">-{impactEstimate.producaoImpacto}%</p>
                  <p className="lot-impact__lead">
                    Possível atraso: {impactEstimate.atrasoDias} dia{impactEstimate.atrasoDias === 1 ? '' : 's'}
                  </p>
                  <p className="lot-impact__copy">{impactEstimate.resumo}</p>
                </div>
              </div>

              <div className="lot-impact__badge">
                <Clock3 size={20} />
              </div>
            </div>
          </section>

          <section className="lot-stats-grid">
            {[
              {
                key: 'blocos',
                label: 'Blocos',
                value: blockCountLabel !== null && blockCountLabel !== undefined ? String(blockCountLabel) : 'N/D',
                valueClass: 'lot-stat-card__value--primary',
              },
              {
                key: 'fase',
                label: 'Fase',
                value: phaseLabel,
                valueClass: 'lot-stat-card__value--secondary',
              },
              {
                key: 'incubacao',
                label: 'Incubação',
                value: `${diasCultivo} dias`,
                valueClass: 'lot-stat-card__value--primary',
              },
              {
                key: 'proxima',
                label: 'Próx. Colheita',
                value: nextHarvestLabel,
                valueClass: 'lot-stat-card__value--tertiary',
              },
            ].map((item) => (
              <article key={item.key} className="lot-card lot-stat-card">
                <p className="lot-stat-card__label">{item.label}</p>
                <p className={cn('lot-stat-card__value', item.valueClass)}>{item.value}</p>
              </article>
            ))}
          </section>

          <section className="lot-card lot-card--vision">
            <div className="lot-vision__header">
              <div className="lot-vision__title">
                <Eye size={18} style={{ color: 'var(--app-primary)' }} />
                <h2 className="lot-card-title" style={{ fontSize: '1.55rem' }}>Monitoramento Vision</h2>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span className={cn('lot-badge', getVisualAnalysisStatusClass(visualAnalysisStatus))}>
                  {visionStatusLabel}
                </span>
                {visualAnalysisData?.run_id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/vision?run=${visualAnalysisData.run_id}`)}
                    className="lot-vision__action"
                  >
                    Ver análise
                  </button>
                ) : null}
              </div>
            </div>

            <div className="lot-vision__body">
              <div className="lot-vision__content">
                {visualAnalysisError ? (
                  <div className="lot-inline-alert lot-inline-alert--danger">{visualAnalysisError}</div>
                ) : (
                  <>
                    <div>
                      <div className="lot-vision__count">
                        <p className="lot-vision__count-value">
                          {visualAnalysisHasDetections ? visualAnalysisDetectedCount : 'N/D'}
                        </p>
                        <p className="lot-vision__count-copy">blocos detectados</p>
                      </div>

                      <div className="lot-vision__pill-row" style={{ marginTop: '1rem' }}>
                        <div className="lot-vision__alert-pill">
                          {visualAnalysisDifferenceLabel
                            ? `${visualAnalysisDifferenceLabel} vs esperado (${visualAnalysisExpectedCount ?? blockCountLabel ?? 'N/D'})`
                            : visualAnalysisExpectedCount !== null && visualAnalysisExpectedCount !== undefined
                              ? 'Detectado alinhado com o esperado'
                              : 'Sem referência comparável'}
                        </div>
                        <div className="lot-vision__sub-pill">{visualAnalysisAgeText}</div>
                      </div>
                    </div>

                    <div className="lot-vision__meta">
                      <div className="lot-vision__meta-card">
                        <p className="lot-microcopy">Esperado</p>
                        <p className="lot-vision__meta-value">{visualAnalysisExpectedCount ?? blockCountLabel ?? 'N/D'}</p>
                        <p className="lot-vision__meta-copy">
                          {getExpectedBlockCountSourceLabel(visualAnalysisData?.quantidade_esperada_origem)}
                        </p>
                      </div>

                      <div className="lot-vision__meta-card">
                        <p className="lot-microcopy">Confiança média</p>
                        <p className="lot-vision__meta-value">{formatConfidencePercent(visualAnalysisData?.confianca_media)}</p>
                        <p className="lot-vision__meta-copy">
                          {visualAnalysisDetectionsCount
                            ? `${visualAnalysisDetectionsCount} detecção(ões) válidas nesta rodada`
                            : 'Sem detecções válidas no último frame'}
                        </p>
                      </div>

                      <div className="lot-vision__meta-card">
                        <p className="lot-microcopy">Origem</p>
                        <p className="lot-vision__meta-value" style={{ fontSize: '1.35rem' }}>
                          {visualAnalysisData?.match_strategy || 'Pipeline Vision'}
                        </p>
                        <p className="lot-vision__meta-copy">
                          Lote vinculado ao último run relevante disponível.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="lot-vision__preview">
                {visionPreviewUrl ? (
                  <>
                    <ImageWithFallback
                      src={visionPreviewUrl}
                      alt={`Captura visual do lote ${lote.codigo_lote}`}
                      className="h-full w-full object-cover"
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent 45%)' }} />
                  </>
                ) : (
                  <div className="lot-vision__preview-fallback">
                    <div className="lot-vision__preview-badge">Aguardando imagem</div>
                  </div>
                )}
                <div className="lot-vision__preview-badge">Câmera Live</div>
              </div>
            </div>
          </section>

          <section>
            <p className="lot-section-label">Sensores</p>
            <div className="lot-sensors-grid" style={{ marginTop: '1rem' }}>
              {visibleEnvironmentCards.map(({ key, titulo, icon: Icon, metric, digits, suffix, idealSuffix, iconClass }) => {
                const displayState = getMetricDisplayState(key, metric);
                const hasReading = metric?.valor !== null && metric?.valor !== undefined;
                const cardClass = key === 'temperatura'
                  ? 'lot-sensor lot-sensor--temperature'
                  : key === 'umidade'
                    ? 'lot-sensor lot-sensor--humidity'
                    : key === 'co2'
                      ? 'lot-sensor lot-sensor--co2'
                      : 'lot-sensor lot-sensor--luminosidade';

                return (
                  <article key={key} className={cardClass}>
                    <div className="lot-sensor__head">
                      <div>
                        <p className="lot-sensor__label">{titulo}</p>
                        <p className={cn('lot-sensor__value', hasReading ? getMetricStatusTextClass(metric?.status) : 'lot-sensor__value--muted')}>
                          {hasReading ? formatMetricValue(metric?.valor, digits, suffix) : 'Sem leitura'}
                        </p>
                        <p className="lot-sensor__ideal">
                          Ideal: {formatIdealMetric(metric?.ideal_min, metric?.ideal_max, idealSuffix)}
                        </p>
                      </div>
                      <Icon className={cn('lot-sensor__icon', iconClass)} />
                    </div>

                    <div className="lot-sensor__footer">
                      <span className={cn('lot-chip', displayState.badgeClass)}>{displayState.label}</span>
                      <span className="lot-sensor__source">{metric?.origem_label || 'Tempo real'}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {historyChartData.length ? (
            <section className="lot-charts">
              {[
                {
                  key: 'temperatura',
                  title: 'Histórico de Temperatura (Últimos 7 dias)',
                  dataKey: 'temperatura',
                  color: '#264f1d',
                  formatter: (value: number) => `${Number(value).toFixed(1)}°C`,
                },
                {
                  key: 'umidade',
                  title: 'Histórico de Umidade (Últimos 7 dias)',
                  dataKey: 'umidade',
                  color: '#75584d',
                  formatter: (value: number) => `${Math.round(Number(value))}%`,
                },
                {
                  key: 'co2',
                  title: 'Histórico de CO₂ (Últimos 7 dias)',
                  dataKey: 'co2',
                  color: '#264f1d',
                  formatter: (value: number) => `${Math.round(Number(value))} ppm`,
                },
              ].map((chart) => (
                <article key={chart.key} className="lot-card lot-chart-card">
                  <p className="lot-section-label">{chart.title}</p>
                  <div className="lot-chart-card__canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={historyChartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="#ece8df" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#8f948a' }}
                          minTickGap={24}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#8f948a' }}
                          width={42}
                        />
                        <Tooltip
                          labelFormatter={(_, payload) => formatHistoryTooltipLabel(payload?.[0]?.payload?.timestamp)}
                          formatter={(value: number) => [chart.formatter(value), chart.title]}
                          contentStyle={{
                            borderRadius: 16,
                            border: '1px solid rgba(196,200,187,0.35)',
                            boxShadow: '0 12px 40px rgba(26, 28, 26, 0.05)',
                            background: '#fff',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey={chart.dataKey}
                          stroke={chart.color}
                          strokeWidth={2.5}
                          dot={{ r: 2.5, fill: chart.color, strokeWidth: 0 }}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <section id="acoes-recomendadas">
            <p className="lot-section-label">Ações recomendadas</p>
            <div className="lot-actions-list" style={{ marginTop: '1rem' }}>
              {visibleActionItems.length ? (
                visibleActionItems.map((item, index) => (
                  <article
                    key={`${item.ordem}-${item.titulo}`}
                    className="lot-card lot-action"
                    style={index === 0 && item.prioridade === 'alta' ? { background: '#fffaf4' } : undefined}
                  >
                    <div className="lot-action__row">
                      <span className={cn('lot-chip', getRecommendationPriorityClass(item.prioridade))}>
                        {getPriorityLabel(item.prioridade)}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p className="lot-action__title">{item.titulo}</p>
                        <p className="lot-action__copy">{item.descricao}</p>
                      </div>
                      <p className="lot-action__lead">{item.lead}</p>
                    </div>
                  </article>
                ))
              ) : (
                <div className="lot-card lot-action">
                  <p className="lot-action__copy">
                    {recommendationLoading
                      ? 'Carregando recomendações operacionais...'
                      : 'Nenhuma ação imediata necessária. Mantenha os parâmetros atuais e siga monitorando o lote.'}
                  </p>
                </div>
              )}
            </div>

            {actionItems.length > quickActions.length ? (
              <button
                type="button"
                onClick={() => setShowAllRecommendations((current) => !current)}
                className="lot-action-toggle"
                style={{ marginTop: '1rem' }}
              >
                {showAllRecommendations ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showAllRecommendations ? 'Mostrar menos' : 'Ver todas as recomendações'}
              </button>
            ) : null}
          </section>
        </div>

        <aside className="lot-page__aside">
          <section className="lot-card lot-card--timeline">
            <div className="lot-timeline__header">
              <Clock3 size={20} style={{ color: 'var(--app-primary)' }} />
              <h2 className="lot-card-title" style={{ fontSize: '1.55rem' }}>Progresso do Lote</h2>
            </div>

            <div className="lot-timeline__track">
              {timelineItems.map((item) => {
                const markerClass = item.state === 'done'
                  ? 'lot-timeline__marker lot-timeline__marker--done'
                  : item.state === 'current'
                    ? 'lot-timeline__marker lot-timeline__marker--current'
                    : item.state === 'upcoming'
                      ? 'lot-timeline__marker lot-timeline__marker--upcoming'
                      : 'lot-timeline__marker lot-timeline__marker--pending';

                const titleClass = item.state === 'current'
                  ? 'lot-timeline__title lot-timeline__title--current'
                  : item.state === 'done'
                    ? 'lot-timeline__title lot-timeline__title--done'
                    : 'lot-timeline__title lot-timeline__title--muted';

                return (
                  <div key={item.key} className="lot-timeline__item">
                    <div className={markerClass}>
                      {item.state === 'done' ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <span className="lot-timeline__marker-dot" />
                      )}
                    </div>

                    <div>
                      <p className={titleClass}>{item.title}</p>
                      <p className="lot-timeline__date">
                        {item.date ? formatTimelapseDateTime(item.date) : 'Sem data registrada'}
                      </p>
                      {item.state === 'current' ? (
                        <div className="lot-timeline__callout">{item.detail}</div>
                      ) : (
                        <p className="lot-timeline__copy">{item.detail}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="lot-card lot-card--operations">
            <p className="lot-ops__kicker">Detalhes operacionais</p>

            <div className="lot-ops__layout">
              <div className="lot-ops__grid">
                <div className="lot-ops__metric lot-ops__metric--trend">
                  <div className="lot-ops__mini-head">
                    <p className="lot-ops__panel-title">Tendência</p>
                    <TrendIcon className={trend.className} size={16} />
                  </div>
                  <p className="lot-ops__mini-value">{trend.label}</p>
                  <p className="lot-ops__mini-copy">{trend.description}</p>
                </div>

                <div className="lot-ops__metric">
                  <p className="lot-ops__panel-title">Colheita provável</p>
                  <p className="lot-ops__mini-value">{forecastDateCompact}</p>
                  <p className="lot-ops__mini-copy">{primaryForecast.subtitulo}</p>
                </div>

                <div className="lot-ops__metric">
                  <p className="lot-ops__panel-title">Produtividade est.</p>
                  <p className="lot-ops__mini-value">{productionEstimateLabel}</p>
                </div>

                <div className="lot-ops__metric">
                  <div className="lot-ops__mini-head">
                    <p className="lot-ops__panel-title">Confiança</p>
                    <span className="lot-ops__confidence-value">{confidencePercentLabel}</span>
                  </div>
                  <div className="lot-ops__confidence-bar">
                    <span className="lot-ops__confidence-fill" style={{ width: confidenceBarWidth }} />
                  </div>
                  <p className="lot-ops__mini-copy">{forecastRangeText}</p>
                </div>
              </div>
            </div>
          </section>

          {isAiInsightVisible ? (
            <section className="lot-card lot-card--glass">
              <div className="lot-glass__header">
                <div className="lot-glass__title-row">
                  <div className="lot-glass__icon">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <p className="lot-glass__title">Insight da IA</p>
                    <p className="lot-glass__subtitle">{lote.codigo_lote}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAiInsightVisible(false)}
                  className="lot-glass__close"
                  aria-label="Fechar insight"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="lot-glass__copy">{aiInsightText}</p>

              <button
                type="button"
                onClick={() => {
                  document.getElementById('acoes-recomendadas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="lot-button lot-button--primary lot-button--full"
              >
                Aplicar ajuste
              </button>
            </section>
          ) : null}
        </aside>
      </div>

      <Dialog open={isColheitaOpen} onOpenChange={setIsColheitaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-[#375328]" />
              Registrar Colheita
            </DialogTitle>
            <DialogDescription>
              Registre os dados da colheita para este lote.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleColheitaSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade_kg">Quantidade (kg)</Label>
                <Input
                  id="quantidade_kg"
                  type="number"
                  step="0.01"
                  value={formData.quantidade_kg}
                  onChange={(event) => setFormData({
                    ...formData,
                    quantidade_kg: Number.isNaN(parseFloat(event.target.value)) ? 0 : parseFloat(event.target.value),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualidade">Qualidade</Label>
                <Select
                  value={formData.qualidade}
                  onValueChange={(value) => setFormData({ ...formData, qualidade: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a qualidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Standard">Standard</SelectItem>
                    <SelectItem value="Econômico">Econômico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                className="bg-[#375328] hover:bg-[#2F4722]"
                disabled={creating}
              >
                {creating ? 'Registrando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTimelapseOpen} onOpenChange={handleTimelapseDialogChange}>
        <DialogContent className="max-h-[calc(100vh-5rem)] overflow-hidden border-[#E8E0D2] p-0 sm:max-w-[900px]">
          <div className="flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden">
            <DialogHeader className="border-b border-[#E8E0D2] px-6 py-5">
              <DialogTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-[#75584D]" />
                Time-lapse do Lote {lote.codigo_lote}
              </DialogTitle>
              <DialogDescription>
                Histórico visual do cultivo para acompanhar evolução e rastreabilidade do lote.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3 rounded-2xl bg-[#FCFBF8] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">Linha do tempo do cultivo</p>
                  <p className="mt-1 text-sm text-[#1A1A1A]/65">
                    Os momentos mais relevantes foram selecionados para formar a prova visual da evolução deste lote.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1A1A1A]/70">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-[0_12px_40px_rgba(26,28,26,0.05)]">
                    {sampledTimelapseFrames.length} momentos
                  </span>
                  {timelapseCycleDays ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold shadow-[0_12px_40px_rgba(26,28,26,0.05)]">
                      Ciclo estimado: {timelapseCycleDays} dias
                    </span>
                  ) : null}
                </div>
              </div>

              {timelapseLoading ? (
                <div className="flex h-[360px] items-center justify-center rounded-2xl bg-[#F8F6F2] sm:h-[420px]">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando capturas reais do lote...
                  </div>
                </div>
              ) : currentTimelapseFrame?.preview_url ? (
                <div className="space-y-4">
                  <div
                    className="relative overflow-hidden rounded-2xl bg-[#ECE7DE]"
                    style={{ height: 'min(42vh, 360px)' }}
                  >
                    <div className="flex h-full w-full items-center justify-center bg-[#ECE7DE] p-3">
                      <ImageWithFallback
                        src={currentTimelapseFrame.preview_url}
                        alt={`Time-lapse ${timelapseIndex + 1}`}
                        className="block max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="absolute left-4 top-4 rounded-full bg-black/55 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                      {timelapseOverlayLabel}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/70">captura selecionada</p>
                          <p className="text-lg font-semibold text-white">{timelapseProgressText}</p>
                          <p className="text-sm text-white/80">{formatTimelapseDateTime(currentTimelapseTimestamp)}</p>
                        </div>
                        <div className="rounded-full bg-white/14 px-3 py-1 text-sm text-white backdrop-blur">
                          {timelapseCycleDays
                            ? `${Math.round(timelapseProgressRatio * 100)}% do ciclo`
                            : `${timelapseIndex + 1} de ${sampledTimelapseFrames.length}`}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl bg-white p-4 shadow-[0_12px_40px_rgba(26,28,26,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#1A1A1A]">Progresso visual do lote</p>
                        <p className="text-sm text-[#1A1A1A]/65">{timelapseProgressText}</p>
                      </div>
                      <p className="text-sm text-[#1A1A1A]/60">
                        {sampledTimelapseFrames.length ? `${timelapseIndex + 1} de ${sampledTimelapseFrames.length}` : '0 de 0'}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#EEE8DC]">
                      <div
                        className="h-full rounded-full bg-[#75584D] transition-all duration-300"
                        style={{ width: `${Math.max(6, timelapseProgressRatio * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-[360px] flex-col items-center justify-center rounded-2xl bg-[#F8F6F2] px-6 text-center sm:h-[420px]">
                  <Camera className="h-8 w-8 text-gray-400" />
                  <div className="mt-3 space-y-1">
                    <p className="font-medium text-gray-700">Nenhuma captura real disponível para este lote.</p>
                    <p className="text-sm text-gray-500">
                      {timelapseError ||
                        timelapseEmptyReason ||
                        'Quando houver imagens do lote ao longo do cultivo, elas aparecerão aqui em sequência cronológica.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[0_12px_40px_rgba(26,28,26,0.05)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTimelapseIndex(Math.max(0, timelapseIndex - 1))}
                    disabled={timelapseLoading || sampledTimelapseFrames.length === 0 || timelapseIndex === 0}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#75584D] hover:bg-[#61483E]"
                    onClick={handleTimelapsePlay}
                    disabled={timelapseLoading || sampledTimelapseFrames.length <= 1}
                  >
                    {isPlaying ? (
                      <>
                        <Pause size={16} className="mr-2" />
                        Pausar
                      </>
                    ) : (
                      <>
                        <Play size={16} className="mr-2" />
                        Reproduzir
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTimelapseIndex(Math.min(sampledTimelapseFrames.length - 1, timelapseIndex + 1))}
                    disabled={timelapseLoading || sampledTimelapseFrames.length === 0 || timelapseIndex === sampledTimelapseFrames.length - 1}
                  >
                    Próximo
                  </Button>
                </div>
                <p className="text-sm text-[#1A1A1A]/60">
                  {sampledTimelapseFrames.length
                    ? `Reprodução ${isPlaying ? 'em andamento' : 'pausada'}`
                    : 'Aguardando imagens'}
                </p>
              </div>

              <div className="flex gap-1">
                {sampledTimelapseFrames.map((frame, index) => (
                  <button
                    key={frame.id || index}
                    onClick={() => setTimelapseIndex(index)}
                    aria-label={`Ir para o momento ${index + 1}`}
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      index === timelapseIndex ? 'bg-[#75584D]' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              <div className="rounded-2xl bg-[#FCFBF8] p-4">
                <p className="text-sm text-[#1A1A1A]/75">
                  {sampledTimelapseFrames.length
                    ? 'Registro visual cronológico do lote, pronto para apoiar acompanhamento, auditoria e futura referência por link ou QR code.'
                    : 'As imagens do time-lapse aparecerão aqui assim que o lote acumular capturas visuais suficientes.'}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isQRCodeOpen} onOpenChange={setIsQRCodeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-[#375328]" />
              QR Code de Rastreabilidade
            </DialogTitle>
            <DialogDescription>
              Gere e imprima QR codes para rastreabilidade completa do produto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-6">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="h-64 w-64" />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center bg-gray-100">
                  <p className="text-gray-400">Gerando QR Code...</p>
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lote:</span>
                <span className="font-medium">{lote.codigo_lote}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Variedade:</span>
                <span className="font-medium">{lote.produto?.variedade || lote.produto?.nome || 'Não informada'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Data de Inoculação:</span>
                <span className="font-medium">
                  {formatDateShort(lote.data_inoculacao || lote.data_inicio)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Localização:</span>
                <span className="font-medium">{[lote.sala, lote.prateleira].filter(Boolean).join(' • ') || 'Não informada'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
              <Info className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-sm text-green-800">
                Use este QR Code em etiquetas e embalagens para rastreabilidade total do produto.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrCodeUrl;
                  link.download = `QR-${lote.codigo_lote}.png`;
                  link.click();
                  toast.success('QR Code baixado com sucesso!');
                }}
              >
                <Download size={16} className="mr-2" />
                Baixar
              </Button>
              <Button
                className="flex-1 bg-[#375328] hover:bg-[#2F4722]"
                onClick={() => {
                  window.print();
                  toast.success('Enviado para impressão!');
                }}
              >
                <Printer size={16} className="mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
