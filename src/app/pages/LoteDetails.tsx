import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Thermometer, Droplets, Wind, Calendar, Package, QrCode, Camera, Printer, Play, Pause, Download, Info, Scissors, Loader2, AlertTriangle, CheckCircle2, Clock3, Lightbulb, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useCreateColheita } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';
import QRCode from 'qrcode';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { fetchServer } from '../../utils/supabase/client';
import { differenceInCalendarDays, differenceInDays, isValid, parseISO } from 'date-fns';

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

function formatOptionalMetric(value?: number | null, digits = 1, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/D';
  return `${Number(value).toFixed(digits)}${suffix}`;
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
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'atencao':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'critico':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getVisualAnalysisStatusClass(status?: string | null) {
  if (status === 'ok' || status === 'atencao' || status === 'critico') {
    return getRecommendationStatusClass(status);
  }

  return 'border-slate-200 bg-slate-100 text-slate-700';
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
      return 'border-red-200 bg-red-50 text-red-700';
    case 'media':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getForecastConfidenceClass(confidence?: string | null) {
  switch (confidence) {
    case 'alta':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'media':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getMetricStatusClass(status?: string | null) {
  switch (status) {
    case 'normal':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'acima':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'abaixo':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-100 text-slate-700';
  }
}

function getMetricStatusTextClass(status?: string | null) {
  switch (status) {
    case 'normal':
      return 'text-emerald-700';
    case 'acima':
      return 'text-red-700';
    case 'abaixo':
      return 'text-amber-700';
    default:
      return 'text-slate-500';
  }
}

function getOperationalHeroClass(status?: string | null) {
  switch (status) {
    case 'ok':
      return 'border-[#2E5B45] bg-[#2E5B45] text-white';
    case 'atencao':
      return 'border-[#8A6B33] bg-[#8A6B33] text-white';
    case 'critico':
      return 'border-[#8B2C2C] bg-[#8B2C2C] text-white';
    default:
      return 'border-[#475569] bg-[#475569] text-white';
  }
}

function getOperationalHeroStyle(status?: string | null) {
  switch (status) {
    case 'ok':
      return { backgroundColor: '#2E5B45', borderColor: '#2E5B45', color: '#FFFFFF' };
    case 'atencao':
      return { backgroundColor: '#8A6B33', borderColor: '#8A6B33', color: '#FFFFFF' };
    case 'critico':
      return { backgroundColor: '#8B2C2C', borderColor: '#8B2C2C', color: '#FFFFFF' };
    default:
      return { backgroundColor: '#475569', borderColor: '#475569', color: '#FFFFFF' };
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
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (metric.status === 'normal') {
    return {
      label: 'OK',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
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
    ? { label: 'Crítico', badgeClass: 'border-red-200 bg-red-50 text-red-700' }
    : { label: 'Alerta', badgeClass: 'border-amber-200 bg-amber-50 text-amber-700' };
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
      className: 'text-slate-300',
    };
  }

  const samples = history.slice(-6);
  if (samples.length < 2) {
    return {
      label: 'Sem tendência',
      description: 'Histórico insuficiente para inferir tendência.',
      icon: Minus,
      className: 'text-slate-300',
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
      className: 'text-slate-300',
    };
  }

  const delta = previousStress - currentStress;
  if (delta > 0.03) {
    return {
      label: 'Melhorando',
      description: 'O ambiente recente está mais próximo da faixa ideal.',
      icon: TrendingUp,
      className: 'text-emerald-300',
    };
  }

  if (delta < -0.03) {
    return {
      label: 'Piorando',
      description: 'As leituras recentes se afastaram da faixa ideal.',
      icon: TrendingDown,
      className: 'text-red-300',
    };
  }

  return {
    label: 'Estável',
    description: 'Sem mudança relevante no comportamento recente.',
    icon: Minus,
    className: 'text-white/80',
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
    observacoes: ''
  });

  const { post: createColheita, loading: creating } = useCreateColheita();

  useEffect(() => {
    async function loadData() {
      if (!id) return;

      try {
        setLoading(true);
        setRecommendationLoading(true);
        setRecommendationError(null);
        setForecastLoading(true);
        setForecastError(null);
        setVisualAnalysisError(null);
        const loteResult = await fetchServer(`/lotes/${id}`);
        const [historyResult, recommendationResult, forecastResult, timelapseSummaryResult, visualAnalysisResult] = await Promise.allSettled([
          fetchServer(`/sensores/history?lote_id=${id}&hours=24`),
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
          setRecommendationError(recommendationResult.reason instanceof Error ? recommendationResult.reason.message : 'Não foi possível carregar as recomendações operacionais.');
        }

        if (forecastResult.status === 'fulfilled') {
          setForecastData((forecastResult.value || null) as ProductionForecast | null);
        } else {
          setForecastData(null);
          setForecastError(forecastResult.reason instanceof Error ? forecastResult.reason.message : 'Não foi possível carregar a previsão de produção.');
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
        setRecommendationLoading(false);
        setForecastLoading(false);
      }
    }

    void loadData();
  }, [id]);

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

  const dataInicioLote = parseDateValue(lote?.data_inicio);
  const dataInoculacaoLote = parseDateValue(lote?.data_inoculacao || lote?.data_inicio);
  const diasCultivo = dataInicioLote ? Math.max(0, differenceInDays(new Date(), dataInicioLote)) : 0;
  const diasDesdeInoculacao = dataInoculacaoLote ? Math.max(0, differenceInDays(new Date(), dataInoculacaoLote)) : 0;

  const tempData = sensorHistory.map((item, index) => ({
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    temperatura: item.temperatura,
    ordem: index + 1,
  }));

  const humidityData = sensorHistory.map((item, index) => ({
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    umidade: item.umidade,
    ordem: index + 1,
  }));

  const co2Data = sensorHistory.map((item, index) => ({
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    co2: item.co2,
    ordem: index + 1,
  }));

  const historicoDisponivel = tempData.length > 0 || humidityData.length > 0 || co2Data.length > 0;

  const timeline = [
    lote?.data_inicio ? { date: lote.data_inicio, event: 'Lote criado', type: 'start' } : null,
    lote?.data_inoculacao ? { date: lote.data_inoculacao, event: 'Inoculação registrada', type: 'milestone' } : null,
    lote?.data_prevista_fim_incubacao ? { date: lote.data_prevista_fim_incubacao, event: 'Fim da incubação previsto', type: 'milestone' } : null,
    lote?.data_real_fim_incubacao ? { date: lote.data_real_fim_incubacao, event: 'Incubação concluída', type: 'milestone' } : null,
    lote?.data_previsao_colheita ? { date: lote.data_previsao_colheita, event: 'Colheita prevista', type: 'ready' } : null,
  ].filter(Boolean) as Array<{ date: string; event: string; type: string }>;

  useEffect(() => {
    if (isQRCodeOpen) {
      QRCode.toDataURL(`${window.location.origin}/lotes/${id}`)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
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

  const handleColheitaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createColheita(formData);
      toast.success('Colheita registrada com sucesso!');
      setIsColheitaOpen(false);
      // Reset form
      setFormData({
        lote_id: id || '',
        quantidade_kg: 0,
        qualidade: 'Premium',
        observacoes: ''
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
      iconClass: 'text-[#A88F52]',
    },
    {
      key: 'umidade',
      titulo: 'Umidade',
      icon: Droplets,
      metric: operationalMetrics?.umidade || null,
      digits: 0,
      suffix: '%',
      idealSuffix: '%',
      iconClass: 'text-[#546A4A]',
    },
    {
      key: 'co2',
      titulo: 'CO₂',
      icon: Wind,
      metric: operationalMetrics?.co2 || null,
      digits: 0,
      suffix: ' ppm',
      idealSuffix: ' ppm',
      iconClass: 'text-[#1A1A1A]',
    },
    {
      key: 'luminosidade',
      titulo: 'Luminosidade',
      icon: Lightbulb,
      metric: operationalMetrics?.luminosidade || null,
      digits: 0,
      suffix: ' lux',
      idealSuffix: ' lux',
      iconClass: 'text-[#D9A441]',
    },
  ] as const;
  const operationalSourceSummary =
    operationalMetrics && environmentCards.some(({ metric }) => metric?.origem === 'sensor_tempo_real')
      ? 'Baseado nas mesmas leituras de sensor exibidas em Segurança.'
      : recommendationData?.fallback?.usando_fallback_sensor
        ? 'Sem leitura em tempo real. O painel usa apenas fallback salvo no lote para as métricas permitidas.'
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
  const trendToneClass =
    trend.label === 'Melhorando'
      ? 'text-emerald-600'
      : trend.label === 'Piorando'
        ? 'text-red-600'
        : 'text-slate-500';
  const visibleEnvironmentCards = environmentCards.filter(({ key, metric }) => {
    if (key !== 'luminosidade') return true;
    return Boolean(
      metric?.valor !== null && metric?.valor !== undefined ||
      metric?.ideal_min !== null && metric?.ideal_min !== undefined ||
      metric?.ideal_max !== null && metric?.ideal_max !== undefined,
    );
  });
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-20 animate-pulse rounded-2xl bg-[#F3EFE8]" />
        <div className="grid gap-4 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))]">
          <div className="h-40 animate-pulse rounded-2xl bg-[#E8E0D2]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#F3EFE8]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#F3EFE8]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#F3EFE8]" />
          <div className="h-32 animate-pulse rounded-2xl bg-[#F3EFE8]" />
        </div>
        <div className="h-40 animate-pulse rounded-2xl bg-[#F8F6F2]" />
      </div>
    );
  }

  if (!lote) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-gray-600">Lote não encontrado.</p>
            <Button variant="outline" onClick={() => navigate('/lotes')}>
              Voltar para lotes
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/lotes')}
            className="border-[#E3DDD2] bg-white"
          >
            <ArrowLeft size={20} />
          </Button>

          <div className="min-w-0">
            <h1 className="font-['Cormorant_Garamond'] text-[34px] font-bold leading-none text-[#1A1A1A] sm:text-[42px]">
              {lote.codigo_lote}
            </h1>
            <p className="mt-1 text-[#1A1A1A] opacity-70">{speciesLabel}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="outline">{formatFaseLabel(lote.fase_operacional || lote.fase_atual)}</Badge>
              <Badge className={getRecommendationStatusClass(recommendationStatus)}>
                {getRecommendationStatusLabel(recommendationStatus)}
              </Badge>
              <Badge variant="outline">Score {recommendationData?.score_operacional ?? '--'}</Badge>
              <Badge variant="outline">{diasDesdeInoculacao} dias desde inoculação</Badge>
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A] opacity-70">
              {recommendationLoading
                ? 'Atualizando a análise operacional do lote...'
                : recommendationError
                  ? 'A análise operacional está indisponível no momento.'
                  : operationalSourceSummary}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(`/lotes/${id}/editar`)}>
            <Pencil size={16} className="mr-2" />
            Editar lote
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsColheitaOpen(true)}>
            <Package size={16} className="mr-2" />
            Colheita
          </Button>
          <Button variant="outline" size="sm" onClick={openTimelapseDialog}>
            <Camera size={16} className="mr-2" />
            Time-lapse
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsQRCodeOpen(true)}>
            <QrCode size={16} className="mr-2" />
            QR Code
          </Button>
        </div>
      </div>

      {hasTimelapseHistory ? (
        <Card className="border-[#D9C89A] bg-[#FFF8EC]">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-[#A88F52]/12 p-2">
                <Camera className="h-5 w-5 text-[#A88F52]" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#1A1A1A]">Histórico visual do lote disponível</p>
                <p className="text-sm text-[#1A1A1A]/72">
                  {timelapseSummaryText || 'Este lote já possui uma trilha visual para apoiar rastreabilidade e acompanhamento do cultivo.'}
                </p>
                <p className="text-xs text-[#1A1A1A]/55">
                  Rastreabilidade visual vinculada ao link do lote e preparada para uso futuro por QR code.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lastTimelapseTimestamp ? (
                <Badge variant="outline">Última captura: {formatDateShort(lastTimelapseTimestamp)}</Badge>
              ) : null}
              <Button
                size="sm"
                className="bg-[#A88F52] hover:bg-[#8F7742]"
                onClick={openTimelapseDialog}
                data-share-path={timelapseSharePath || undefined}
              >
                <Camera size={16} className="mr-2" />
                Abrir histórico visual
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {recommendationError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">
            {recommendationError}
          </CardContent>
        </Card>
      ) : null}

      {recommendationLoading ? (
        <Card className="border border-[#E3DDD2] bg-[#F8F6F2]">
          <CardContent className="flex items-center gap-3 py-4 text-sm text-[#1A1A1A] opacity-70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando análise operacional do lote...
          </CardContent>
        </Card>
      ) : null}

      {(recommendationAlerts.length > 0 || primaryActionSummary) ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-700" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-yellow-900">Alertas do lote</p>
                {recommendationAlerts.length ? (
                  <ul className="space-y-2 text-sm text-yellow-900">
                    {recommendationAlerts.slice(0, 4).map((alerta) => (
                      <li key={`${alerta.codigo}-${alerta.mensagem}`} className="list-disc ml-5">
                        {alerta.mensagem}
                      </li>
                    ))}
                  </ul>
                ) : primaryActionSummary ? (
                  <p className="text-sm text-yellow-900">{primaryActionSummary}</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ações Recomendadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {quickActions.length ? (
            quickActions.map((item, index) => (
              <div
                key={`${item.ordem}-${item.titulo}`}
                className={`rounded-xl border p-4 ${index === 0 ? 'border-[#D9C89A] bg-[#FFF8EC]' : 'border-[#E8E0D2] bg-[#FCFBF8]'}`}
              >
                <div className="flex items-start gap-3">
                  <Badge className={getRecommendationPriorityClass(item.prioridade)}>
                    {getPriorityLabel(item.prioridade)}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A]">{item.titulo}</p>
                    <p className="mt-1 text-sm text-[#1A1A1A] opacity-70">{item.descricao}</p>
                  </div>
                </div>
              </div>
            ))
          ) : recommendationLoading ? (
            <p className="text-sm text-gray-500">Carregando recomendações...</p>
          ) : (
            <p className="text-sm text-gray-500">
              Nenhuma ação imediata necessária. Mantenha os parâmetros atuais e siga monitorando o lote.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Contagem Automática de Blocos</CardTitle>
            <p className="mt-1 text-sm text-[#1A1A1A]/65">
              Resumo da última análise visual relevante do lote, integrado ao pipeline Vision.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className={getVisualAnalysisStatusClass(visualAnalysisStatus)}>
              {visualAnalysisData?.status_label || 'Sem análise'}
            </Badge>
            {visualAnalysisData?.run_id ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/vision?run=${visualAnalysisData.run_id}`)}
              >
                Ver detalhes da análise
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {visualAnalysisError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {visualAnalysisError}
            </div>
          ) : visualAnalysisData?.analise_disponivel ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-[#E8E0D2] bg-[#FCFBF8] p-4">
                  <p className="text-xs text-gray-600">Blocos detectados</p>
                  <p className="mt-2 text-2xl font-semibold text-[#1A1A1A]">
                    {visualAnalysisHasDetections ? visualAnalysisDetectedCount : 'N/D'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {visualAnalysisDetectionsCount > 0
                      ? `${visualAnalysisDetectionsCount} detecção(ões) no último frame analisado`
                      : 'Análise concluída sem detecções válidas'}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E8E0D2] bg-[#FCFBF8] p-4">
                  <p className="text-xs text-gray-600">Quantidade esperada</p>
                  <p className="mt-2 text-2xl font-semibold text-[#1A1A1A]">
                    {visualAnalysisExpectedCount !== null && visualAnalysisExpectedCount !== undefined
                      ? visualAnalysisExpectedCount
                      : 'N/D'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {getExpectedBlockCountSourceLabel(visualAnalysisData?.quantidade_esperada_origem)}
                  </p>
                </div>

                <div className="rounded-xl border border-[#E8E0D2] bg-[#FCFBF8] p-4">
                  <p className="text-xs text-gray-600">Confiança média</p>
                  <p className="mt-2 text-2xl font-semibold text-[#1A1A1A]">
                    {formatConfidencePercent(visualAnalysisData?.confianca_media)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Média simples das detecções retornadas pelo modelo YOLO.
                  </p>
                </div>

                <div className="rounded-xl border border-[#E8E0D2] bg-[#FCFBF8] p-4">
                  <p className="text-xs text-gray-600">Última análise</p>
                  <p className="mt-2 text-xl font-semibold text-[#1A1A1A]">
                    {visualAnalysisData?.ultimo_timestamp_analise
                      ? formatDateShort(visualAnalysisData.ultimo_timestamp_analise)
                      : 'Sem data'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{visualAnalysisAgeText}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E8E0D2] bg-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium text-[#1A1A1A]">
                    {visualAnalysisDifferenceLabel
                      ? `Diferença entre esperado e detectado: ${visualAnalysisDifferenceLabel}`
                      : visualAnalysisExpectedCount !== null && visualAnalysisExpectedCount !== undefined
                        ? 'Detectado alinhado com a quantidade esperada do lote.'
                        : 'Sem referência esperada para comparar automaticamente.'}
                  </p>
                  {visualAnalysisData?.match_strategy ? (
                    <Badge variant="outline">Origem: {visualAnalysisData.match_strategy}</Badge>
                  ) : null}
                </div>
                {!visualAnalysisDetectionsCount ? (
                  <p className="mt-2 text-sm text-[#1A1A1A]/65">
                    A última análise visual foi registrada, mas não encontrou blocos visíveis nesta captura.
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D8D1C2] bg-[#FCFBF8] p-4">
              <p className="text-sm font-medium text-[#1A1A1A]">Sem análise visual ainda</p>
              <p className="mt-1 text-sm text-[#1A1A1A]/65">
                Quando o pipeline Vision processar uma captura relevante deste lote, a contagem automática de blocos aparecerá aqui.
              </p>
              {visualAnalysisExpectedCount !== null && visualAnalysisExpectedCount !== undefined ? (
                <p className="mt-2 text-sm text-[#1A1A1A]">
                  Quantidade esperada cadastrada: <strong>{visualAnalysisExpectedCount} blocos</strong>
                </p>
              ) : null}
              <p className="mt-2 text-xs text-[#1A1A1A]/55">
                {getExpectedBlockCountSourceLabel(visualAnalysisData?.quantidade_esperada_origem)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-600">Produção estimada</p>
                <p className="mt-2 font-['Cormorant_Garamond'] text-[40px] font-bold leading-none text-[#546A4A]">
                  {forecastData?.producao_estimada_kg !== null && forecastData?.producao_estimada_kg !== undefined
                    ? `${forecastData.producao_estimada_kg.toFixed(2)} kg`
                    : 'N/D'}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {forecastData?.data_prevista_colheita
                    ? `Colheita provável em ${formatDateShort(forecastData.data_prevista_colheita)}`
                    : 'Sem data provável disponível'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Faixa estimada: {forecastRangeText}
                </p>
              </div>
              <Package className="h-10 w-10 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className={impactEstimate.producaoImpacto > 10 ? 'border-yellow-300' : ''}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-600">Impacto potencial</p>
                <p className="mt-2 font-['Cormorant_Garamond'] text-[40px] font-bold leading-none text-[#546A4A]">
                  -{impactEstimate.producaoImpacto}%
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Possível atraso: {impactEstimate.atrasoDias} dia{impactEstimate.atrasoDias === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {impactEstimate.resumo}
                </p>
              </div>
              <Clock3 className="h-10 w-10 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Sensores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`grid grid-cols-1 gap-3 ${visibleEnvironmentCards.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
            {visibleEnvironmentCards.map(({ key, titulo, icon: Icon, metric, digits, suffix, idealSuffix, iconClass }) => {
              const displayState = getMetricDisplayState(key, metric);
              const hasReading = metric?.valor !== null && metric?.valor !== undefined;

              if (!hasReading) {
                return (
                  <div key={key} className="rounded-lg border border-dashed border-[#D8D1C2] bg-[#FCFBF8] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 opacity-40 ${iconClass}`} />
                        <span className="text-xs text-gray-600">{titulo}</span>
                      </div>
                      <span className="text-xs text-gray-500">Sem leitura</span>
                    </div>
                  </div>
                );
              }

              return (
                <Card
                  key={key}
                  className={metric?.status === 'acima' ? 'border-red-200' : metric?.status === 'abaixo' ? 'border-yellow-200' : ''}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">{titulo}</p>
                        <p className={`mt-1 text-xl font-bold ${getMetricStatusTextClass(metric?.status)}`}>
                          {formatMetricValue(metric?.valor, digits, suffix)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Ideal: {formatIdealMetric(metric?.ideal_min, metric?.ideal_max, idealSuffix)}
                        </p>
                      </div>
                      <Icon className={`h-7 w-7 opacity-20 ${iconClass}`} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <Badge className={displayState.badgeClass}>{displayState.label}</Badge>
                      <span className="text-[11px] text-gray-500">{metric?.origem_label || 'Sem origem'}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Tendência</p>
              <p className="mt-1 text-2xl font-bold text-[#546A4A]">{trend.label}</p>
              <p className="mt-1 text-sm text-gray-500">{trend.description}</p>
            </div>
            <TrendIcon className={`h-8 w-8 opacity-20 ${trendToneClass}`} />
          </div>
        </CardContent>
      </Card>

      {/* Colheita Dialog */}
      <Dialog open={isColheitaOpen} onOpenChange={setIsColheitaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-emerald-600" />
              Registrar Colheita
            </DialogTitle>
            <DialogDescription>
              Registre os dados da colheita para este lote
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
                  onChange={e => setFormData({ ...formData, quantidade_kg: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualidade">Qualidade</Label>
                <Select
                  value={formData.qualidade}
                  onValueChange={e => setFormData({ ...formData, qualidade: e })}
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
                  onChange={e => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                className="bg-[#A88F52] hover:bg-[#8F7742]"
                disabled={creating}
              >
                {creating ? 'Registrando...' : 'Registrar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Timelapse Dialog */}
      <Dialog open={isTimelapseOpen} onOpenChange={handleTimelapseDialogChange}>
        <DialogContent className="max-h-[calc(100vh-5rem)] overflow-hidden border-[#E8E0D2] p-0 sm:max-w-[900px]">
          <div className="flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden">
            <DialogHeader className="border-b border-[#E8E0D2] px-6 py-5">
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#A88F52]" />
                Time-lapse do Lote {lote.codigo_lote}
              </DialogTitle>
              <DialogDescription>
                Histórico visual do cultivo para acompanhar evolução e rastreabilidade do lote.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex flex-col gap-3 rounded-2xl border border-[#E8E0D2] bg-[#FCFBF8] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">Linha do tempo do cultivo</p>
                  <p className="mt-1 text-sm text-[#1A1A1A]/65">
                    Os momentos mais relevantes foram selecionados para formar a prova visual da evolução deste lote.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#1A1A1A]/70">
                  <Badge variant="outline">{sampledTimelapseFrames.length} momentos</Badge>
                  {timelapseCycleDays ? <Badge variant="outline">Ciclo estimado: {timelapseCycleDays} dias</Badge> : null}
                </div>
              </div>

            {timelapseLoading ? (
              <div className="flex h-[360px] items-center justify-center rounded-2xl border bg-gray-50 sm:h-[420px]">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando capturas reais do lote...
                </div>
              </div>
            ) : currentTimelapseFrame?.preview_url ? (
              <div className="space-y-4">
                <div
                  className="relative overflow-hidden rounded-2xl border border-[#E8E0D2] bg-[#ECE7DE]"
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

                <div className="space-y-2 rounded-2xl border border-[#E8E0D2] bg-white p-4">
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
                      className="h-full rounded-full bg-[#A88F52] transition-all duration-300"
                      style={{ width: `${Math.max(6, timelapseProgressRatio * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed bg-gray-50 px-6 text-center space-y-3 sm:h-[420px]">
                <Camera className="h-8 w-8 text-gray-400" />
                <div className="space-y-1">
                  <p className="font-medium text-gray-700">Nenhuma captura real disponível para este lote.</p>
                  <p className="text-sm text-gray-500">
                    {timelapseError ||
                      timelapseEmptyReason ||
                      'Quando houver imagens do lote ao longo do cultivo, elas aparecerão aqui em sequência cronológica.'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E8E0D2] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
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
                  className="bg-[#A88F52] hover:bg-[#8F7742]"
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
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    index === timelapseIndex ? 'bg-[#A88F52]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

              <div className="rounded-2xl border border-[#E8E0D2] bg-[#FCFBF8] p-4">
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

      {/* QR Code Dialog */}
      <Dialog open={isQRCodeOpen} onOpenChange={setIsQRCodeOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#A88F52]" />
              QR Code de Rastreabilidade
            </DialogTitle>
            <DialogDescription>
              Gere e imprima QR codes para rastreabilidade completa do produto
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center items-center p-6 bg-white border-2 border-gray-200 rounded-lg">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400">Gerando QR Code...</p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
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

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-green-600 mt-0.5" />
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
                className="flex-1 bg-[#A88F52] hover:bg-[#8F7742]"
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
