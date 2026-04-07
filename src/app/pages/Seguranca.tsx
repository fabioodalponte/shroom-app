import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  Thermometer,
  Droplets,
  Wind,
  Radio,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Camera,
  RefreshCcw,
  SlidersHorizontal,
  Settings2,
  Lightbulb,
  Flame,
  Power,
  Plus,
  Sparkles,
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, formatDistanceToNowStrict, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { fetchServer } from '../../utils/supabase/client';

interface SensorData {
  timestamp: string;
  temperatura: number;
  umidade: number;
  co2: number;
  luminosidade_lux?: number;
  pm25?: number;
  pm10?: number;
}

interface LoteMonitoramento {
  id: string;
  codigo_lote: string;
  sala: string;
  sala_id?: string | null;
  sala_ref?: {
    id?: string | null;
    codigo?: string | null;
    nome?: string | null;
    primary_camera_id?: string | null;
  } | null;
  fase_operacional?: string | null;
  data_inoculacao?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    luminosidade_lux?: number;
    pm25?: number;
  };
  produto?: {
    nome?: string;
    perfil_cultivo?: {
      co2_ideal_max?: number | null;
      luminosidade_min_lux?: number | null;
      luminosidade_max_lux?: number | null;
      recomendacoes_json?: {
        resumo?: string;
        alertas?: string[];
      } | null;
    } | null;
  } | null;
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
  blocos_resumo?: {
    total: number;
    frutificacao: number;
    colhido: number;
  };
  historico: SensorData[];
  score_risco: number; // 0-100
  alertas: string[];
}

interface CameraConfig {
  id: string;
  nome: string;
  localizacao: string;
  sala_id?: string | null;
  tipo?: string | null;
  status?: string | null;
  url_stream?: string | null;
  resolucao?: string | null;
  gravacao_ativa?: boolean | null;
  planned_placeholder?: boolean;
}

interface SalaControllerConfig {
  id: string;
  nome: string;
  sala_id?: string | null;
  localizacao: string;
  tipo?: string | null;
  status?: string | null;
  base_url?: string | null;
  device_id?: string | null;
  modo_padrao?: 'manual' | 'remote' | null;
  relay_map?: Record<string, string> | null;
  observacoes?: string | null;
}

interface SalaControllerRelayState {
  name: string;
  state: boolean;
}

interface SalaControllerStatus {
  deviceId?: string;
  deviceName?: string;
  mode?: 'manual' | 'remote' | string;
  ip?: string;
  uptimeSeconds?: number;
  lastCommandMs?: number;
  relays?: Record<string, SalaControllerRelayState>;
}

type SensorMetricKey = 'temperatura' | 'umidade' | 'co2' | 'luminosidade_lux';
type TrendDirection = 'up' | 'down' | 'stable';

interface TrendInfo {
  icon: typeof TrendingUp | typeof TrendingDown | typeof Minus;
  color: string;
  label: string;
  direction: TrendDirection;
}

interface MetricIssue {
  key: SensorMetricKey;
  title: string;
  severity: 'critical' | 'warning';
  badgeClassName: string;
  message: string;
  actionLabel: string;
  productionImpact: string;
  activeSince: Date | null;
}

interface SalaOperacionalCard {
  salaId: string;
  salaLabel: string;
  primaryLote: LoteMonitoramento;
  lotes: LoteMonitoramento[];
  status: 'critical' | 'warning' | 'ok';
  statusLabel: string;
  statusBadgeClassName: string;
  priority: number;
  avgTemperatura: number;
  avgUmidade: number;
  avgCo2: number;
  impactedLots: number;
  topIssue: MetricIssue | null;
  topIssueLote: LoteMonitoramento | null;
  alertElapsed: string | null;
  trends: {
    temperatura: TrendInfo;
    umidade: TrendInfo;
    co2: TrendInfo;
  };
  sensorBounds: {
    tempMin: number;
    tempMax: number;
    umidMin: number;
    umidMax: number;
    co2IdealMax: number;
    co2Elevado: number;
    co2Critico: number;
    lumMin: number | null;
    lumMax: number | null;
  };
  sparkValues: number[];
  sparkToneClassName: string;
  productionImpact: string;
  actionLabel: string;
}

interface SalaCatalogConfig {
  id: string;
  codigo?: string | null;
  nome: string;
  tipo?: string | null;
  ativa?: boolean | null;
  primary_camera_id?: string | null;
}

const CAMERA_FRAME_SIZE_OPTIONS = ['QQVGA', 'QVGA', 'CIF', 'VGA', 'SVGA', 'XGA'] as const;
type CameraFrameSize = typeof CAMERA_FRAME_SIZE_OPTIONS[number];

interface CameraImageControls {
  framesize: CameraFrameSize;
  quality: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hmirror: boolean;
  vflip: boolean;
  exposureCtrl: boolean;
}

const DEFAULT_CAMERA_IMAGE_CONTROLS: CameraImageControls = {
  framesize: 'SVGA',
  quality: 12,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hmirror: false,
  vflip: false,
  exposureCtrl: true,
};

const PLANNED_VISION_CAMERAS: CameraConfig[] = [
  {
    id: 'planned-camera-colonizacao',
    nome: 'camera-colonizacao',
    localizacao: 'Colonizacao',
    tipo: 'Sala de Cultivo',
    status: 'Planejada',
    url_stream: null,
    resolucao: 'VGA',
    gravacao_ativa: false,
    planned_placeholder: true,
  },
  {
    id: 'planned-camera-frutificacao',
    nome: 'camera-frutificacao',
    localizacao: 'Frutificacao',
    tipo: 'Sala de Cultivo',
    status: 'Planejada',
    url_stream: null,
    resolucao: 'VGA',
    gravacao_ativa: false,
    planned_placeholder: true,
  },
];

function hasCameraStream(camera: CameraConfig | null | undefined) {
  return !!camera?.url_stream && camera.url_stream.trim().length > 0;
}

function prepareCameraList(cameras: CameraConfig[]) {
  const merged = [...cameras];

  for (const plannedCamera of PLANNED_VISION_CAMERAS) {
    const alreadyExists = merged.some((camera) => {
      const normalizedName = normalizeText(String(camera.nome || ''));
      const normalizedLocation = normalizeText(String(camera.localizacao || ''));
      return (
        normalizedName === normalizeText(plannedCamera.nome) ||
        normalizedLocation === normalizeText(plannedCamera.localizacao)
      );
    });

    if (!alreadyExists) {
      merged.push(plannedCamera);
    }
  }

  return merged.sort((a, b) => String(a.localizacao || '').localeCompare(String(b.localizacao || ''), 'pt-BR'));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeSalaId(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
}

function resolveLoteSalaId(lote: Pick<LoteMonitoramento, 'sala_id' | 'sala_ref' | 'sala'>) {
  return (
    normalizeSalaId(lote.sala_id) ||
    normalizeSalaId(lote.sala_ref?.id) ||
    normalizeSalaId(lote.sala_ref?.codigo) ||
    (normalizeText(lote.sala || '').replace(/\s+/g, '_') || null)
  );
}

function resolveLoteSalaLabel(lote: Pick<LoteMonitoramento, 'sala_ref' | 'sala'>) {
  return lote.sala_ref?.nome || lote.sala || 'Sem sala';
}

function scoreCameraStreamUrl(url?: string | null) {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return -100;
  if (value.includes('cam.cogumelos.net')) return 100;
  if (value.includes('trycloudflare.com')) return 10;
  if (value.startsWith('http://10.') || value.startsWith('http://192.168.') || value.startsWith('http://172.16.')) {
    return 80;
  }
  if (value.startsWith('https://')) return 70;
  if (value.startsWith('http://')) return 60;
  return 0;
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

function buildCameraImageUrl(url: string, token: number, options?: { flash?: boolean }) {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.set('t', String(token));
    if (options?.flash) {
      parsed.searchParams.set('flash', '1');
    } else {
      parsed.searchParams.delete('flash');
    }
    return parsed.toString();
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?';
    const flashSuffix = options?.flash ? '&flash=1' : '';
    return `${trimmed}${separator}t=${token}${flashSuffix}`;
  }
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function formatIdealRange(min?: number | null, max?: number | null, suffix = '') {
  if (min === null || min === undefined || max === null || max === undefined) return null;
  return `${min}-${max}${suffix}`;
}

function normalizeCameraControls(payload: Record<string, any> | null | undefined): CameraImageControls {
  const frameCandidate = String(payload?.framesize || '').toUpperCase();
  const framesize = CAMERA_FRAME_SIZE_OPTIONS.includes(frameCandidate as CameraFrameSize)
    ? (frameCandidate as CameraFrameSize)
    : DEFAULT_CAMERA_IMAGE_CONTROLS.framesize;

  return {
    framesize,
    quality: clampNumber(Number(payload?.quality ?? DEFAULT_CAMERA_IMAGE_CONTROLS.quality), 10, 63),
    brightness: clampNumber(Number(payload?.brightness ?? DEFAULT_CAMERA_IMAGE_CONTROLS.brightness), -2, 2),
    contrast: clampNumber(Number(payload?.contrast ?? DEFAULT_CAMERA_IMAGE_CONTROLS.contrast), -2, 2),
    saturation: clampNumber(Number(payload?.saturation ?? DEFAULT_CAMERA_IMAGE_CONTROLS.saturation), -2, 2),
    hmirror: Boolean(Number(payload?.hmirror ?? 0)),
    vflip: Boolean(Number(payload?.vflip ?? 0)),
    exposureCtrl: Boolean(Number(payload?.exposure_ctrl ?? 1)),
  };
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function buildCameraControlUrl(
  streamUrl: string,
  endpointPath: string,
  query?: Record<string, string | number>,
) {
  const trimmed = streamUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

    if (parsed.pathname.endsWith('/capture')) {
      const basePath = parsed.pathname.slice(0, parsed.pathname.length - '/capture'.length) || '';
      parsed.pathname = `${basePath}${normalizedPath}`;
    } else {
      parsed.pathname = normalizedPath;
    }

    parsed.search = '';
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        parsed.searchParams.set(key, String(value));
      });
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function buildCameraFlashUrl(streamUrl: string, command: 'on' | 'off') {
  return buildCameraControlUrl(
    streamUrl,
    command === 'on' ? '/flash/on' : '/flash/off',
    command === 'on' ? { seconds: 3 } : undefined,
  );
}

function normalizeRelayKey(value: string) {
  const match = value.match(/^relay(\d+)$/i);
  if (!match) return value;
  return `relay${match[1]}`;
}

function relayOrder(key: string) {
  const match = key.match(/^relay(\d+)$/i);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function getRelayDisplayName(key: string, controller?: SalaControllerConfig | null, status?: SalaControllerStatus | null) {
  const normalizedKey = normalizeRelayKey(key);
  const statusName = status?.relays?.[normalizedKey]?.name;
  if (statusName) return statusName;

  const relayMapValue = controller?.relay_map?.[normalizedKey];
  if (relayMapValue) return relayMapValue;

  return normalizedKey;
}

function getRelayIcon(relayName: string) {
  const normalized = normalizeText(relayName);
  if (normalized.includes('umid')) return Droplets;
  if (normalized.includes('aquec')) return Flame;
  if (normalized.includes('luz')) return Lightbulb;
  return Wind;
}

function getSortedHistory(historico: SensorData[]) {
  return [...historico]
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function getSensorTrend(
  historico: SensorData[],
  key: SensorMetricKey,
  tolerance: number,
): TrendInfo {
  const sorted = getSortedHistory(historico);
  const recent = sorted
    .map((item) => Number(item[key] ?? NaN))
    .filter((value) => Number.isFinite(value))
    .slice(-4);

  if (recent.length < 2) {
    return { icon: Minus, color: 'text-gray-500', label: 'Estável', direction: 'stable' };
  }

  const last = recent[recent.length - 1];
  const previousAverage = recent.slice(0, -1).reduce((sum, value) => sum + value, 0) / (recent.length - 1);
  const diff = last - previousAverage;

  if (Math.abs(diff) <= tolerance) {
    return { icon: Minus, color: 'text-green-600', label: 'Estável', direction: 'stable' };
  }

  if (diff > 0) {
    return { icon: TrendingUp, color: 'text-rose-600', label: 'Subindo', direction: 'up' };
  }

  return { icon: TrendingDown, color: 'text-sky-600', label: 'Caindo', direction: 'down' };
}

function formatAlertElapsed(activeSince: Date | null) {
  if (!activeSince) return null;
  return formatDistanceToNowStrict(activeSince, { addSuffix: true, locale: ptBR });
}

function findActiveIssueStart(
  historico: SensorData[],
  predicate: (item: SensorData) => boolean,
) {
  const sorted = getSortedHistory(historico);
  if (!sorted.length) return null;

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    if (!predicate(sorted[index])) {
      const nextItem = sorted[index + 1];
      if (!nextItem) return null;
      const parsed = parseDateValue(nextItem.timestamp);
      return parsed;
    }
  }

  return parseDateValue(sorted[0].timestamp);
}

function getMetricIssues(
  lote: LoteMonitoramento,
  context: {
    tempMin: number;
    tempMax: number;
    umidMin: number;
    umidMax: number;
    co2IdealMax: number;
    co2Elevado: number;
    co2Critico: number;
    lumMin: number | null;
    lumMax: number | null;
  },
) {
  const issues: MetricIssue[] = [];
  const impactedBlocks = lote.blocos_resumo?.frutificacao || lote.blocos_resumo?.total || 0;

  if (lote.sensor_atual.temperatura > context.tempMax) {
    issues.push({
      key: 'temperatura',
      title: 'Temperatura alta',
      severity: lote.sensor_atual.temperatura >= context.tempMax + 2 ? 'critical' : 'warning',
      badgeClassName: lote.sensor_atual.temperatura >= context.tempMax + 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      message: `Temperatura acima do ideal (${lote.sensor_atual.temperatura.toFixed(1)}°C).`,
      actionLabel: 'Corrigir temperatura',
      productionImpact: impactedBlocks
        ? `${impactedBlocks} bloco(s) podem perder velocidade de desenvolvimento se o calor persistir.`
        : 'Pode acelerar estresse térmico e reduzir uniformidade do lote.',
      activeSince: findActiveIssueStart(lote.historico, (item) => item.temperatura > context.tempMax),
    });
  } else if (lote.sensor_atual.temperatura < context.tempMin) {
    issues.push({
      key: 'temperatura',
      title: 'Temperatura baixa',
      severity: 'warning',
      badgeClassName: 'bg-amber-100 text-amber-800',
      message: `Temperatura abaixo do ideal (${lote.sensor_atual.temperatura.toFixed(1)}°C).`,
      actionLabel: 'Ajustar aquecimento',
      productionImpact: 'Pode desacelerar colonização e alongar o ciclo produtivo.',
      activeSince: findActiveIssueStart(lote.historico, (item) => item.temperatura < context.tempMin),
    });
  }

  if (lote.sensor_atual.umidade < context.umidMin) {
    issues.push({
      key: 'umidade',
      title: 'Umidade baixa',
      severity: lote.sensor_atual.umidade <= context.umidMin - 8 ? 'critical' : 'warning',
      badgeClassName: lote.sensor_atual.umidade <= context.umidMin - 8 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      message: `Umidade abaixo da faixa ideal (${lote.sensor_atual.umidade.toFixed(0)}%).`,
      actionLabel: 'Aumentar umidificação',
      productionImpact: 'Pode comprometer pinagem e reduzir enchimento dos frutos.',
      activeSince: findActiveIssueStart(lote.historico, (item) => item.umidade < context.umidMin),
    });
  } else if (lote.sensor_atual.umidade > context.umidMax) {
    issues.push({
      key: 'umidade',
      title: 'Umidade alta',
      severity: lote.sensor_atual.umidade >= context.umidMax + 8 ? 'critical' : 'warning',
      badgeClassName: lote.sensor_atual.umidade >= context.umidMax + 8 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      message: `Umidade acima da faixa ideal (${lote.sensor_atual.umidade.toFixed(0)}%).`,
      actionLabel: 'Reduzir umidificação',
      productionImpact: 'Eleva risco de contaminação superficial e condensação nos blocos.',
      activeSince: findActiveIssueStart(lote.historico, (item) => item.umidade > context.umidMax),
    });
  }

  if (lote.sensor_atual.co2 > context.co2Elevado) {
    const isCritical = lote.sensor_atual.co2 >= context.co2Critico;
    issues.push({
      key: 'co2',
      title: isCritical ? 'CO₂ crítico' : 'CO₂ elevado',
      severity: isCritical ? 'critical' : 'warning',
      badgeClassName: isCritical ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800',
      message: `CO₂ acima do ideal (${lote.sensor_atual.co2.toFixed(0)} ppm).`,
      actionLabel: 'Aumentar ventilação',
      productionImpact: impactedBlocks
        ? `Pode reduzir qualidade de ${impactedBlocks} bloco(s) em frutificação se mantido nas próximas horas.`
        : 'Pode prejudicar morfologia e vigor dos frutos.',
      activeSince: findActiveIssueStart(lote.historico, (item) => item.co2 > context.co2Elevado),
    });
  }

  if (
    typeof lote.sensor_atual.luminosidade_lux === 'number' &&
    ((context.lumMin !== null && lote.sensor_atual.luminosidade_lux < context.lumMin) ||
      (context.lumMax !== null && lote.sensor_atual.luminosidade_lux > context.lumMax))
  ) {
    const isAbove = context.lumMax !== null && lote.sensor_atual.luminosidade_lux > context.lumMax;
    issues.push({
      key: 'luminosidade_lux',
      title: isAbove ? 'Luminosidade alta' : 'Luminosidade baixa',
      severity: 'warning',
      badgeClassName: 'bg-amber-100 text-amber-800',
      message: `Luminosidade fora da faixa ideal (${lote.sensor_atual.luminosidade_lux.toFixed(0)} lux).`,
      actionLabel: isAbove ? 'Reduzir iluminação' : 'Ajustar iluminação',
      productionImpact: 'Pode desalinhar resposta fisiológica e deixar o lote menos uniforme.',
      activeSince: findActiveIssueStart(
        lote.historico,
        (item) => {
          const value = item.luminosidade_lux;
          if (typeof value !== 'number') return false;
          if (context.lumMin !== null && value < context.lumMin) return true;
          if (context.lumMax !== null && value > context.lumMax) return true;
          return false;
        },
      ),
    });
  }

  return issues.sort((a, b) => {
    const severityWeight = { critical: 2, warning: 1 };
    return severityWeight[b.severity] - severityWeight[a.severity];
  });
}

function getSalaStatus(score: number, issues: MetricIssue[]) {
  if (issues.some((issue) => issue.severity === 'critical') || score >= 70) {
    return {
      status: 'critical' as const,
      label: 'Crítico',
      badgeClassName: 'bg-red-100 text-red-700 border-red-200',
      priority: 3,
    };
  }

  if (issues.length > 0 || score >= 30) {
    return {
      status: 'warning' as const,
      label: 'Atenção',
      badgeClassName: 'bg-amber-100 text-amber-800 border-amber-200',
      priority: 2,
    };
  }

  return {
    status: 'ok' as const,
    label: 'OK',
    badgeClassName: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    priority: 1,
  };
}

function buildSparkValues(historico: SensorData[], key: SensorMetricKey) {
  const values = getSortedHistory(historico)
    .map((item) => Number(item[key] ?? NaN))
    .filter((value) => Number.isFinite(value))
    .slice(-6);

  if (!values.length) return Array.from({ length: 6 }, () => 40);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values.map((value) => 28 + ((value - min) / range) * 42);
}

export function Seguranca() {
  const [lotes, setLotes] = useState<LoteMonitoramento[]>([]);
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [controladoresSala, setControladoresSala] = useState<SalaControllerConfig[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<string>('todos');
  const [periodoHistorico, setPeriodoHistorico] = useState<'24h' | '7d'>('24h');
  const [statusVisualFilter, setStatusVisualFilter] = useState<'all' | 'critical' | 'normal'>('all');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraSelecionada, setCameraSelecionada] = useState<CameraConfig | null>(null);
  const [cameraFrameToken, setCameraFrameToken] = useState(Date.now());
  const [cameraFrameWithFlash, setCameraFrameWithFlash] = useState(false);
  const [cameraErroCarregamento, setCameraErroCarregamento] = useState<string | null>(null);
  const [autoAtualizarCamera, setAutoAtualizarCamera] = useState(false);
  const [cameraFlashComando, setCameraFlashComando] = useState<'on' | 'off' | null>(null);
  const [cameraFlashInfo, setCameraFlashInfo] = useState<string | null>(null);
  const [cameraFlashErro, setCameraFlashErro] = useState<string | null>(null);
  const [cameraConfigDialogOpen, setCameraConfigDialogOpen] = useState(false);
  const [cameraConfigTarget, setCameraConfigTarget] = useState<CameraConfig | null>(null);
  const [cameraControls, setCameraControls] = useState<CameraImageControls>(DEFAULT_CAMERA_IMAGE_CONTROLS);
  const [cameraControlsLoading, setCameraControlsLoading] = useState(false);
  const [cameraControlsSaving, setCameraControlsSaving] = useState(false);
  const [cameraControlsInfo, setCameraControlsInfo] = useState<string | null>(null);
  const [cameraControlsErro, setCameraControlsErro] = useState<string | null>(null);
  const [controladorDialogOpen, setControladorDialogOpen] = useState(false);
  const [controladorSelecionado, setControladorSelecionado] = useState<SalaControllerConfig | null>(null);
  const [controladorStatus, setControladorStatus] = useState<SalaControllerStatus | null>(null);
  const [controladorLoading, setControladorLoading] = useState(false);
  const [controladorComando, setControladorComando] = useState<string | null>(null);
  const [controladorInfo, setControladorInfo] = useState<string | null>(null);
  const [controladorErro, setControladorErro] = useState<string | null>(null);
  const [salasCatalogo, setSalasCatalogo] = useState<SalaCatalogConfig[]>([]);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const hours = periodoHistorico === '24h' ? 24 : 168;
      const [sensoresResult, camerasResult, controladoresResult, salasResult] = await Promise.allSettled([
        fetchServer(`/sensores/latest?hours=${hours}`),
        fetchServer('/cameras'),
        fetchServer('/controladores'),
        fetchServer('/salas'),
      ]);

      if (sensoresResult.status === 'rejected') {
        throw sensoresResult.reason;
      }

      const sensores = (sensoresResult.value.sensores || []) as LoteMonitoramento[];
      setLotes(sensores);

      if (camerasResult.status === 'fulfilled') {
        setCameras(prepareCameraList((camerasResult.value.cameras || []) as CameraConfig[]));
      } else {
        console.warn('Não foi possível carregar câmeras:', camerasResult.reason);
        setCameras(prepareCameraList([]));
      }

      if (controladoresResult.status === 'fulfilled') {
        setControladoresSala((controladoresResult.value.controladores || []) as SalaControllerConfig[]);
      } else {
        console.warn('Não foi possível carregar controladores de sala:', controladoresResult.reason);
        setControladoresSala([]);
      }

      if (salasResult.status === 'fulfilled') {
        setSalasCatalogo((salasResult.value.salas || []) as SalaCatalogConfig[]);
      } else {
        console.warn('Não foi possível carregar salas:', salasResult.reason);
        setSalasCatalogo([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar monitoramento de sensores:', error);
      setErrorMessage(error.message || 'Erro ao carregar sensores');
      setLotes([]);
      setCameras(prepareCameraList([]));
      setControladoresSala([]);
      setSalasCatalogo([]);
    } finally {
      setLoading(false);
    }
  }, [periodoHistorico]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    if (loteSelecionado === 'todos') return;
    if (!lotes.some((lote) => lote.id === loteSelecionado)) {
      setLoteSelecionado('todos');
    }
  }, [lotes, loteSelecionado]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);

    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!cameraDialogOpen || !autoAtualizarCamera || !cameraSelecionada?.url_stream) return;

    const timerId = window.setInterval(() => {
      setCameraFrameWithFlash(false);
      setCameraFrameToken(Date.now());
    }, 8000);

    return () => window.clearInterval(timerId);
  }, [cameraDialogOpen, autoAtualizarCamera, cameraSelecionada?.id, cameraSelecionada?.url_stream]);

  const getRiscoColor = (score: number) => {
    if (score < 30) return { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-500', label: 'Seguro' };
    if (score < 70) return { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500', label: 'Atenção' };
    return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-500', label: 'Perigo' };
  };

  const getTendencia = (valor: number, ideal: number, tolerance: number) => {
    const diff = Math.abs(valor - ideal);
    if (diff <= tolerance) return { icon: Minus, color: 'text-green-600', label: 'Estável' };
    if (valor > ideal) return { icon: TrendingUp, color: 'text-red-600', label: 'Subindo' };
    return { icon: TrendingDown, color: 'text-blue-600', label: 'Caindo' };
  };

  const getCameraForLote = useCallback((lote: LoteMonitoramento) => {
    if (!cameras.length) return null;

    const camerasAtivas = cameras.filter((camera) => normalizeText(String(camera.status || 'ativa')) !== 'inativa');
    const base = camerasAtivas.length ? camerasAtivas : cameras;
    const baseComStream = [...base.filter(hasCameraStream)].sort(
      (a, b) => scoreCameraStreamUrl(b.url_stream) - scoreCameraStreamUrl(a.url_stream),
    );
    const universoBusca = baseComStream.length ? baseComStream : base;

    const salaId = resolveLoteSalaId(lote);
    const salaLabel = resolveLoteSalaLabel(lote);
    const sala = normalizeText(salaLabel);
    const codigo = normalizeText(lote.codigo_lote || '');
    const explicitCameraId = String(lote.sala_ref?.primary_camera_id || '').trim();

    if (explicitCameraId) {
      const explicitCamera = cameras.find((camera) => camera.id === explicitCameraId) || null;
      if (explicitCamera && hasCameraStream(explicitCamera)) return explicitCamera;
      if (explicitCamera) return explicitCamera;
    }

    const encontrada = universoBusca.find((camera) => {
      const nome = normalizeText(camera.nome || '');
      const localizacao = normalizeText(camera.localizacao || '');
      const localizacaoId = localizacao.replace(/\s+/g, '_');

      const matchSalaId =
        !!salaId && (localizacaoId.includes(salaId) || nome.includes(salaId));
      const matchSala =
        !!sala &&
        (nome.includes(sala) ||
          localizacao.includes(sala) ||
          sala.includes(nome) ||
          sala.includes(localizacao));

      const matchCodigo = !!codigo && (nome.includes(codigo) || localizacao.includes(codigo));

      return matchSalaId || matchSala || matchCodigo;
    });

    if (encontrada && hasCameraStream(encontrada)) return encontrada;

    const fallbackComStream =
      universoBusca.find(hasCameraStream) ||
      base.find(hasCameraStream) ||
      cameras.find(hasCameraStream) ||
      null;

    return fallbackComStream;
  }, [cameras]);

  const getControladorForLote = useCallback((lote: LoteMonitoramento) => {
    if (!controladoresSala.length) return null;

    const controladoresAtivos = controladoresSala.filter(
      (controlador) => normalizeText(String(controlador.status || 'ativo')) !== 'inativo',
    );
    const base = controladoresAtivos.length ? controladoresAtivos : controladoresSala;

    const salaId = resolveLoteSalaId(lote);
    const salaLabel = resolveLoteSalaLabel(lote);
    const sala = normalizeText(salaLabel);
    const codigo = normalizeText(lote.codigo_lote || '');

    const encontrado = base.find((controlador) => {
      const nome = normalizeText(controlador.nome || '');
      const localizacao = normalizeText(controlador.localizacao || '');
      const localizacaoId = localizacao.replace(/\s+/g, '_');

      const matchSalaId =
        !!salaId && (localizacaoId.includes(salaId) || nome.includes(salaId));
      const matchSala =
        !!sala &&
        (nome.includes(sala) ||
          localizacao.includes(sala) ||
          sala.includes(nome) ||
          sala.includes(localizacao));

      const matchCodigo = !!codigo && (nome.includes(codigo) || localizacao.includes(codigo));
      return matchSalaId || matchSala || matchCodigo;
    });

    return encontrado || base[0] || null;
  }, [controladoresSala]);

  const carregarStatusControladorSala = useCallback(async (controladorId: string, options?: { silent?: boolean }) => {
    if (!controladorId) return;

    setControladorLoading(true);
    if (!options?.silent) {
      setControladorInfo(null);
    }
    setControladorErro(null);

    try {
      const result = await fetchServer(`/controladores/${controladorId}/status`);
      setControladorStatus((result.status || null) as SalaControllerStatus | null);
      if (result.controlador) {
        setControladorSelecionado((result.controlador || null) as SalaControllerConfig | null);
      }
      if (!options?.silent) {
        setControladorInfo('Status do controlador atualizado.');
      }
    } catch (error: any) {
      setControladorErro(error.message || 'Erro ao consultar controlador da sala');
    } finally {
      setControladorLoading(false);
    }
  }, []);

  const abrirControleDaSala = useCallback((lote: LoteMonitoramento) => {
    const controlador = getControladorForLote(lote);
    if (!controlador) return;

    setControladorSelecionado(controlador);
    setControladorStatus(null);
    setControladorInfo(null);
    setControladorErro(null);
    setControladorComando(null);
    setControladorDialogOpen(true);
    void carregarStatusControladorSala(controlador.id);
  }, [carregarStatusControladorSala, getControladorForLote]);

  const abrirControlePorConfig = useCallback((controlador: SalaControllerConfig | null) => {
    if (!controlador) return;

    setControladorSelecionado(controlador);
    setControladorStatus(null);
    setControladorInfo(null);
    setControladorErro(null);
    setControladorComando(null);
    setControladorDialogOpen(true);
    void carregarStatusControladorSala(controlador.id);
  }, [carregarStatusControladorSala]);

  const alterarModoControladorSala = useCallback(async (mode: 'manual' | 'remote') => {
    if (!controladorSelecionado?.id) return;

    setControladorComando(`mode:${mode}`);
    setControladorInfo(null);
    setControladorErro(null);

    try {
      const result = await fetchServer(`/controladores/${controladorSelecionado.id}/mode`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      });

      setControladorStatus((result.status || null) as SalaControllerStatus | null);
      setControladorInfo(`Modo ${mode} aplicado com sucesso.`);
    } catch (error: any) {
      setControladorErro(error.message || 'Erro ao alterar modo do controlador');
    } finally {
      setControladorComando(null);
    }
  }, [controladorSelecionado?.id]);

  const controlarRelaySala = useCallback(async (relayKey: string, state: boolean) => {
    if (!controladorSelecionado?.id) return;

    const relay = relayOrder(relayKey);
    if (!Number.isFinite(relay) || relay < 1 || relay > 4) return;

    setControladorComando(`${relayKey}:${state ? 'on' : 'off'}`);
    setControladorInfo(null);
    setControladorErro(null);

    try {
      const result = await fetchServer(`/controladores/${controladorSelecionado.id}/relay`, {
        method: 'POST',
        body: JSON.stringify({ relay, state }),
      });

      setControladorStatus((result.status || null) as SalaControllerStatus | null);
      setControladorInfo(`${getRelayDisplayName(relayKey, controladorSelecionado, result.status)} ${state ? 'ligado' : 'desligado'}.`);
    } catch (error: any) {
      setControladorErro(error.message || 'Erro ao acionar relé');
    } finally {
      setControladorComando(null);
    }
  }, [controladorSelecionado]);

  const controlarTodosRelaysSala = useCallback(async (state: boolean) => {
    if (!controladorSelecionado?.id) return;

    const relayKeys = Object.keys(controladorStatus?.relays || controladorSelecionado?.relay_map || {
      relay1: true,
      relay2: true,
      relay3: true,
      relay4: true,
    });

    const payload = relayKeys.reduce<Record<string, boolean>>((acc, relayKey) => {
      acc[normalizeRelayKey(relayKey)] = state;
      return acc;
    }, {});

    setControladorComando(state ? 'all:on' : 'all:off');
    setControladorInfo(null);
    setControladorErro(null);

    try {
      const result = await fetchServer(`/controladores/${controladorSelecionado.id}/relays`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setControladorStatus((result.status || null) as SalaControllerStatus | null);
      setControladorInfo(state ? 'Todos os canais foram ligados.' : 'Todos os canais foram desligados.');
    } catch (error: any) {
      setControladorErro(error.message || 'Erro ao atualizar todos os relés');
    } finally {
      setControladorComando(null);
    }
  }, [controladorSelecionado, controladorStatus?.relays]);

  useEffect(() => {
    if (!controladorDialogOpen || !controladorSelecionado?.id) return;

    const timerId = window.setInterval(() => {
      void carregarStatusControladorSala(controladorSelecionado.id, { silent: true });
    }, 15000);

    return () => window.clearInterval(timerId);
  }, [carregarStatusControladorSala, controladorDialogOpen, controladorSelecionado?.id]);

  const abrirCamera = useCallback((camera: CameraConfig | null) => {
    setCameraSelecionada(camera);
    setCameraErroCarregamento(null);
    setCameraFrameWithFlash(false);
    setCameraFrameToken(Date.now());
    setAutoAtualizarCamera(false);
    setCameraFlashInfo(null);
    setCameraFlashErro(null);
    setCameraDialogOpen(true);
  }, []);

  const abrirCameraDoLote = useCallback((lote: LoteMonitoramento) => {
    const camera = getCameraForLote(lote);
    abrirCamera(camera);
  }, [abrirCamera, getCameraForLote]);

  const abrirConfiguracaoCamera = useCallback((camera: CameraConfig | null) => {
    if (!camera) return;
    setCameraConfigTarget(camera);
    setCameraControls(DEFAULT_CAMERA_IMAGE_CONTROLS);
    setCameraControlsInfo(null);
    setCameraControlsErro(null);
    setCameraConfigDialogOpen(true);
  }, []);

  const abrirConfiguracaoDoLote = useCallback((lote: LoteMonitoramento) => {
    const camera = getCameraForLote(lote);
    abrirConfiguracaoCamera(camera);
  }, [abrirConfiguracaoCamera, getCameraForLote]);

  const carregarControlesCamera = useCallback(async () => {
    if (!cameraConfigTarget?.url_stream) {
      setCameraControlsErro('Câmera sem URL configurada para leitura dos ajustes.');
      return;
    }

    const configUrl = buildCameraControlUrl(cameraConfigTarget.url_stream, '/camera/config');
    if (!configUrl) {
      setCameraControlsErro('Não foi possível montar a URL de configuração da câmera.');
      return;
    }

    setCameraControlsLoading(true);
    setCameraControlsInfo(null);
    setCameraControlsErro(null);

    try {
      const response = await fetch(configUrl, { method: 'GET', cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      }

      setCameraControls(normalizeCameraControls(payload));
      setCameraControlsInfo('Configuração carregada da câmera.');
    } catch (error: any) {
      setCameraControlsErro(`Falha ao carregar configuração: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setCameraControlsLoading(false);
    }
  }, [cameraConfigTarget?.url_stream]);

  const aplicarControlesCamera = useCallback(async () => {
    if (!cameraConfigTarget?.url_stream) {
      setCameraControlsErro('Câmera sem URL configurada para aplicar ajustes.');
      return;
    }

    const setUrl = buildCameraControlUrl(cameraConfigTarget.url_stream, '/camera/set', {
      framesize: cameraControls.framesize,
      quality: cameraControls.quality,
      brightness: cameraControls.brightness,
      contrast: cameraControls.contrast,
      saturation: cameraControls.saturation,
      hmirror: cameraControls.hmirror ? 1 : 0,
      vflip: cameraControls.vflip ? 1 : 0,
      exposure_ctrl: cameraControls.exposureCtrl ? 1 : 0,
    });

    if (!setUrl) {
      setCameraControlsErro('Não foi possível montar a URL para aplicar ajustes.');
      return;
    }

    setCameraControlsSaving(true);
    setCameraControlsInfo(null);
    setCameraControlsErro(null);

    try {
      const response = await fetch(setUrl, { method: 'GET', cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      }

      setCameraControls(normalizeCameraControls(payload));
      setCameraControlsInfo('Ajustes aplicados com sucesso.');
      if (cameraSelecionada?.id === cameraConfigTarget.id) {
        setCameraFrameToken(Date.now());
      }
    } catch (error: any) {
      setCameraControlsErro(`Falha ao aplicar ajustes: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setCameraControlsSaving(false);
    }
  }, [cameraConfigTarget, cameraControls, cameraSelecionada?.id]);

  const controlarFlashCamera = useCallback(async (command: 'on' | 'off') => {
    if (!cameraSelecionada?.url_stream) {
      setCameraFlashErro('Câmera sem URL configurada para controle de luz.');
      return;
    }

    const flashUrl = buildCameraFlashUrl(cameraSelecionada.url_stream, command);
    if (!flashUrl) {
      setCameraFlashErro('Não foi possível gerar a URL de controle da luz.');
      return;
    }

    setCameraFlashComando(command);
    setCameraFlashInfo(null);
    setCameraFlashErro(null);

    try {
      const response = await fetch(flashUrl, {
        method: 'GET',
        cache: 'no-store',
      });

      let payload: Record<string, any> | null = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
      }

      if (command === 'on') {
        const autoOffMs = Number(payload?.auto_off_ms);
        const autoOffInfo = Number.isFinite(autoOffMs) && autoOffMs > 0
          ? ` Auto-off em ${Math.round(autoOffMs / 1000)}s.`
          : '';
        setCameraFlashInfo(`Luz ligada e frame com flash solicitado.${autoOffInfo}`);
        setCameraFrameWithFlash(true);
        setCameraFrameToken(Date.now());
      } else {
        setCameraFlashInfo('Luz desligada.');
        setCameraFrameWithFlash(false);
      }
    } catch (error: any) {
      setCameraFlashErro(`Falha ao controlar luz: ${error?.message || 'erro desconhecido'}`);
    } finally {
      setCameraFlashComando(null);
    }
  }, [cameraSelecionada?.url_stream]);

  useEffect(() => {
    if (!cameraConfigDialogOpen || !cameraConfigTarget?.url_stream) return;
    void carregarControlesCamera();
  }, [cameraConfigDialogOpen, cameraConfigTarget?.id, cameraConfigTarget?.url_stream, carregarControlesCamera]);

  const handleCameraDialogChange = useCallback((open: boolean) => {
    setCameraDialogOpen(open);

    if (!open) {
      setAutoAtualizarCamera(false);
      setCameraErroCarregamento(null);
      setCameraSelecionada(null);
      setCameraFrameWithFlash(false);
      setCameraFlashComando(null);
      setCameraFlashInfo(null);
      setCameraFlashErro(null);
    }
  }, []);

  const handleCameraConfigDialogChange = useCallback((open: boolean) => {
    setCameraConfigDialogOpen(open);

    if (!open) {
      setCameraConfigTarget(null);
      setCameraControls(DEFAULT_CAMERA_IMAGE_CONTROLS);
      setCameraControlsLoading(false);
      setCameraControlsSaving(false);
      setCameraControlsInfo(null);
      setCameraControlsErro(null);
    }
  }, []);

  const handleControladorDialogChange = useCallback((open: boolean) => {
    setControladorDialogOpen(open);

    if (!open) {
      setControladorSelecionado(null);
      setControladorStatus(null);
      setControladorLoading(false);
      setControladorComando(null);
      setControladorInfo(null);
      setControladorErro(null);
    }
  }, []);

  const controladorRelayEntries = useMemo(() => {
    const fallbackKeys = ['relay1', 'relay2', 'relay3', 'relay4'];
    const relayKeys = Array.from(new Set([
      ...Object.keys(controladorSelecionado?.relay_map || {}),
      ...Object.keys(controladorStatus?.relays || {}),
      ...fallbackKeys,
    ])).sort((a, b) => relayOrder(a) - relayOrder(b));

    return relayKeys.map((relayKey) => {
      const normalizedKey = normalizeRelayKey(relayKey);
      const relayState = Boolean(controladorStatus?.relays?.[normalizedKey]?.state);
      const relayName = getRelayDisplayName(normalizedKey, controladorSelecionado, controladorStatus);

      return {
        key: normalizedKey,
        relayNumber: relayOrder(normalizedKey),
        name: relayName,
        state: relayState,
        icon: getRelayIcon(relayName),
      };
    });
  }, [controladorSelecionado, controladorStatus]);

  const lotesFiltrados = loteSelecionado === 'todos' 
    ? lotes 
    : lotes.filter(l => l.id === loteSelecionado);

  const recomendacoesOperacionais = useMemo(() => {
    const itens = new Set<string>();
    let resumo: string | null = null;

    for (const lote of lotesFiltrados) {
      if (!resumo && lote.resumo_recomendacoes) {
        resumo = lote.resumo_recomendacoes;
      }

      for (const recomendacao of lote.recomendacoes_operacionais || []) {
        if (recomendacao?.trim()) {
          itens.add(recomendacao.trim());
        }
      }
    }

    if (!itens.size) {
      itens.add('Score de risco alto: isolar lote, revisar visualmente e confirmar parâmetros ambientais do produto.');
      itens.add('CO₂ acima do limite ideal: aumentar ventilação e revisar exaustão da sala.');
      itens.add('Umidade acima do limite ideal: reduzir nebulização e reforçar circulação de ar.');
    }

    return {
      resumo,
      itens: Array.from(itens).slice(0, 6),
    };
  }, [lotesFiltrados]);

  const resumoOperacional = useMemo(() => {
    const agora = new Date();
    return {
      incubando: lotes.filter((lote) => lote.fase_operacional === 'incubacao').length,
      prontosParaFrutificacao: lotes.filter((lote) => lote.fase_operacional === 'pronto_para_frutificacao').length,
      frutificando: lotes.filter((lote) => lote.fase_operacional === 'frutificacao').length,
      atrasados: lotes.filter((lote) => {
        if (!['incubacao', 'pronto_para_frutificacao'].includes(String(lote.fase_operacional || ''))) return false;
        if (!lote.data_prevista_fim_incubacao || lote.data_real_fim_incubacao) return false;
        const dataPrevista = parseDateValue(lote.data_prevista_fim_incubacao);
        return !!dataPrevista && dataPrevista < agora;
      }).length,
    };
  }, [lotes]);

  // Calcular médias gerais
  const mediaTemp = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.temperatura, 0) / lotes.length : 0;
  const mediaUmid = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.umidade, 0) / lotes.length : 0;
  const mediaCo2 = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.co2, 0) / lotes.length : 0;
  const lotesAlerta = lotes.filter(l => l.score_risco >= 70).length;
  const lotesAtencao = lotes.filter(l => l.score_risco >= 30 && l.score_risco < 70).length;
  const salasOperacionais = useMemo<SalaOperacionalCard[]>(() => {
    const grouped = new Map<string, LoteMonitoramento[]>();

    for (const lote of lotesFiltrados) {
      const salaId = resolveLoteSalaId(lote) || 'sem_sala';
      const existing = grouped.get(salaId) || [];
      existing.push(lote);
      grouped.set(salaId, existing);
    }

    return Array.from(grouped.entries())
      .map(([salaId, lotesSala]) => {
        const orderedLotes = [...lotesSala].sort((a, b) => b.score_risco - a.score_risco);
        const primaryLote = orderedLotes[0];
        const salaLabel = resolveLoteSalaLabel(primaryLote);
        const primaryBounds = {
          tempMin: primaryLote.limites_operacionais?.temperatura_min ?? 20,
          tempMax: primaryLote.limites_operacionais?.temperatura_max ?? 25,
          umidMin: primaryLote.limites_operacionais?.umidade_min ?? 80,
          umidMax: primaryLote.limites_operacionais?.umidade_max ?? 90,
          co2IdealMax: primaryLote.limites_operacionais?.co2_ideal_max ?? 1000,
          co2Elevado: primaryLote.limites_operacionais?.co2_elevado ?? Math.max(primaryLote.limites_operacionais?.co2_ideal_max ?? 1000, 800),
          co2Critico: primaryLote.limites_operacionais?.co2_critico ?? Math.max((primaryLote.limites_operacionais?.co2_elevado ?? 800) + 150, 1000),
          lumMin: primaryLote.limites_operacionais?.luminosidade_min_lux ?? null,
          lumMax: primaryLote.limites_operacionais?.luminosidade_max_lux ?? null,
        };

        const roomIssues = orderedLotes.flatMap((roomLote) =>
          getMetricIssues(roomLote, {
            tempMin: roomLote.limites_operacionais?.temperatura_min ?? 20,
            tempMax: roomLote.limites_operacionais?.temperatura_max ?? 25,
            umidMin: roomLote.limites_operacionais?.umidade_min ?? 80,
            umidMax: roomLote.limites_operacionais?.umidade_max ?? 90,
            co2IdealMax: roomLote.limites_operacionais?.co2_ideal_max ?? 1000,
            co2Elevado: roomLote.limites_operacionais?.co2_elevado ?? Math.max(roomLote.limites_operacionais?.co2_ideal_max ?? 1000, 800),
            co2Critico: roomLote.limites_operacionais?.co2_critico ?? Math.max((roomLote.limites_operacionais?.co2_elevado ?? 800) + 150, 1000),
            lumMin: roomLote.limites_operacionais?.luminosidade_min_lux ?? null,
            lumMax: roomLote.limites_operacionais?.luminosidade_max_lux ?? null,
          }).map((issue) => ({ issue, lote: roomLote })),
        );

        const topIssueEntry = roomIssues.sort((a, b) => {
          const severityWeight = { critical: 2, warning: 1 };
          return severityWeight[b.issue.severity] - severityWeight[a.issue.severity] || b.lote.score_risco - a.lote.score_risco;
        })[0] || null;

        const status = getSalaStatus(primaryLote.score_risco, roomIssues.map((item) => item.issue));
        const impactedLots = orderedLotes.filter((item) => item.score_risco >= 30 || item.alertas.length > 0).length;
        const avgTemperatura = orderedLotes.reduce((sum, item) => sum + item.sensor_atual.temperatura, 0) / orderedLotes.length;
        const avgUmidade = orderedLotes.reduce((sum, item) => sum + item.sensor_atual.umidade, 0) / orderedLotes.length;
        const avgCo2 = orderedLotes.reduce((sum, item) => sum + item.sensor_atual.co2, 0) / orderedLotes.length;

        return {
          salaId,
          salaLabel,
          primaryLote,
          lotes: orderedLotes,
          status: status.status,
          statusLabel: status.label,
          statusBadgeClassName: status.badgeClassName,
          priority: status.priority,
          avgTemperatura,
          avgUmidade,
          avgCo2,
          impactedLots,
          topIssue: topIssueEntry?.issue || null,
          topIssueLote: topIssueEntry?.lote || null,
          alertElapsed: formatAlertElapsed(topIssueEntry?.issue.activeSince || null),
          trends: {
            temperatura: getSensorTrend(primaryLote.historico, 'temperatura', 0.6),
            umidade: getSensorTrend(primaryLote.historico, 'umidade', 2.5),
            co2: getSensorTrend(primaryLote.historico, 'co2', 45),
          },
          sensorBounds: primaryBounds,
          sparkValues: buildSparkValues(
            primaryLote.historico,
            topIssueEntry?.issue.key === 'co2'
              ? 'co2'
              : topIssueEntry?.issue.key === 'umidade'
                ? 'umidade'
                : 'temperatura',
          ),
          sparkToneClassName:
            status.status === 'critical'
              ? 'bg-red-200'
              : status.status === 'warning'
                ? 'bg-amber-200'
                : 'bg-emerald-200',
          productionImpact: topIssueEntry?.issue
            ? topIssueEntry.issue.productionImpact
            : primaryLote.blocos_resumo?.frutificacao
              ? `${primaryLote.blocos_resumo.frutificacao} bloco(s) em frutificação seguem sem desvio crítico nesta sala.`
              : 'Sem impacto produtivo imediato identificado nesta sala.',
          actionLabel: topIssueEntry?.issue.actionLabel || 'Controlar sala',
        };
      })
      .sort((a, b) => b.priority - a.priority || b.primaryLote.score_risco - a.primaryLote.score_risco);
  }, [lotesFiltrados]);
  const resumoSalas = useMemo(() => ({
    criticas: salasOperacionais.filter((item) => item.status === 'critical').length,
    atencao: salasOperacionais.filter((item) => item.status === 'warning').length,
    normais: salasOperacionais.filter((item) => item.status === 'ok').length,
  }), [salasOperacionais]);
  const visibleSalas = useMemo(() => {
    if (statusVisualFilter === 'critical') {
      return salasOperacionais.filter((item) => item.status === 'critical');
    }

    if (statusVisualFilter === 'normal') {
      return salasOperacionais.filter((item) => item.status === 'ok');
    }

    return salasOperacionais;
  }, [salasOperacionais, statusVisualFilter]);
  const destaquesOperacionais = useMemo(() => {
    return salasOperacionais
      .filter((item) => item.topIssue)
      .slice(0, 2)
      .map((item) => ({
        sala: item.salaLabel,
        prioridade: item.status === 'critical' ? 'Alta prioridade' : 'Média prioridade',
        timing: item.alertElapsed || 'Agora',
        title: item.actionLabel,
        description: item.productionImpact,
        action: item.status === 'critical' ? 'Executar ajuste automático' : 'Programar correção',
      }));
  }, [salasOperacionais]);
  const projecaoOperacional = useMemo(() => {
    const salaCritica = salasOperacionais.find((item) => item.status === 'critical') || null;
    const blocosFrutificando = lotes.reduce((sum, item) => sum + (item.blocos_resumo?.frutificacao || 0), 0);
    const blocosMonitorados = lotes.reduce((sum, item) => sum + (item.blocos_resumo?.total || 0), 0);
    const eficienciaBase = blocosMonitorados > 0
      ? ((blocosMonitorados - lotesAlerta) / Math.max(blocosMonitorados, 1)) * 100
      : 100;

    return {
      headline: salaCritica
        ? `A estabilidade da ${salaCritica.salaLabel} é a principal variável de risco produtivo nas próximas horas.`
        : 'O ambiente geral segue estável, com risco produtivo distribuído em níveis controlados.',
      emphasis: salaCritica?.salaLabel || null,
      blocosFrutificando,
      eficiencia: Math.max(0, Math.min(100, eficienciaBase)),
    };
  }, [lotes, lotesAlerta, salasOperacionais]);
  const getCameraForSalaConfig = useCallback((sala: SalaCatalogConfig) => {
    if (!cameras.length) return null;

    const camerasAtivas = cameras.filter((camera) => normalizeText(String(camera.status || 'ativa')) !== 'inativa');
    const base = camerasAtivas.length ? camerasAtivas : cameras;
    const baseComStream = [...base.filter(hasCameraStream)].sort(
      (a, b) => scoreCameraStreamUrl(b.url_stream) - scoreCameraStreamUrl(a.url_stream),
    );
    const universoBusca = baseComStream.length ? baseComStream : base;
    const explicitCameraId = String(sala.primary_camera_id || '').trim();
    const salaId = normalizeSalaId(sala.id) || normalizeSalaId(sala.codigo) || null;
    const salaNome = normalizeText(sala.nome || '');

    if (explicitCameraId) {
      const explicitCamera = cameras.find((camera) => camera.id === explicitCameraId) || null;
      if (explicitCamera) return explicitCamera;
    }

    return (
      universoBusca.find((camera) => normalizeSalaId(camera.sala_id) === salaId) ||
      universoBusca.find((camera) => {
        const nome = normalizeText(camera.nome || '');
        const localizacao = normalizeText(camera.localizacao || '');
        return (
          (!!salaId && (nome.includes(salaId) || localizacao.includes(salaId))) ||
          (!!salaNome && (nome.includes(salaNome) || localizacao.includes(salaNome) || salaNome.includes(nome) || salaNome.includes(localizacao)))
        );
      }) ||
      null
    );
  }, [cameras]);
  const getControladorForSalaConfig = useCallback((sala: SalaCatalogConfig) => {
    if (!controladoresSala.length) return null;

    const base = controladoresSala.filter((controlador) => normalizeText(String(controlador.status || 'ativo')) !== 'inativo');
    const universoBusca = base.length ? base : controladoresSala;
    const salaId = normalizeSalaId(sala.id) || normalizeSalaId(sala.codigo) || null;
    const salaNome = normalizeText(sala.nome || '');

    return (
      universoBusca.find((controlador) => normalizeSalaId(controlador.sala_id) === salaId) ||
      universoBusca.find((controlador) => {
        const nome = normalizeText(controlador.nome || '');
        const localizacao = normalizeText(controlador.localizacao || '');
        return (
          (!!salaId && (nome.includes(salaId) || localizacao.includes(salaId))) ||
          (!!salaNome && (nome.includes(salaNome) || localizacao.includes(salaNome) || salaNome.includes(nome) || salaNome.includes(localizacao)))
        );
      }) ||
      null
    );
  }, [controladoresSala]);
  const salasComCameraSemTelemetria = useMemo(() => {
    const salasOperacionaisIds = new Set(salasOperacionais.map((sala) => normalizeSalaId(sala.salaId)).filter(Boolean));

    return salasCatalogo
      .filter((sala) => sala.ativa !== false)
      .map((sala) => ({
        sala,
        camera: getCameraForSalaConfig(sala),
        controlador: getControladorForSalaConfig(sala),
      }))
      .filter((item) => item.camera && !salasOperacionaisIds.has(normalizeSalaId(item.sala.id)))
      .sort((a, b) => {
        const streamDiff = Number(hasCameraStream(b.camera)) - Number(hasCameraStream(a.camera));
        if (streamDiff !== 0) return streamDiff;
        return a.sala.nome.localeCompare(b.sala.nome, 'pt-BR');
      });
  }, [getCameraForSalaConfig, getControladorForSalaConfig, salasCatalogo, salasOperacionais]);

  const controladorDialogBody = controladorSelecionado ? (
    <div className="mt-4 space-y-4">
      <div className="shrink-0 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 sm:hidden">
          <div>
            <p className="text-xs text-gray-500">Modo atual</p>
            <p className="text-sm font-semibold capitalize">
              {controladorStatus?.mode || controladorSelecionado.modo_padrao || 'remote'}
            </p>
          </div>
          <Badge variant="outline">
            {typeof controladorStatus?.uptimeSeconds === 'number'
              ? `${Math.floor(controladorStatus.uptimeSeconds / 60)} min`
              : 'Sem uptime'}
          </Badge>
        </div>

        <div className="hidden grid-cols-2 gap-2 md:grid-cols-4 sm:grid">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-gray-500">Modo</p>
              <p className="mt-1 text-base font-semibold capitalize sm:text-lg">
                {controladorStatus?.mode || controladorSelecionado.modo_padrao || 'remote'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-gray-500">IP do dispositivo</p>
              <p className="mt-1 text-sm font-medium break-all">
                {controladorStatus?.ip || 'Aguardando status'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-gray-500">Uptime</p>
              <p className="mt-1 text-base font-semibold sm:text-lg">
                {typeof controladorStatus?.uptimeSeconds === 'number'
                  ? `${Math.floor(controladorStatus.uptimeSeconds / 60)} min`
                  : '--'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 sm:p-4">
              <p className="text-xs text-gray-500">Endpoint</p>
              <p className="mt-1 text-sm font-medium break-all">
                {controladorSelecionado.base_url || 'Não configurado'}
              </p>
            </CardContent>
          </Card>
        </div>

        <Accordion type="single" collapsible className="sm:hidden">
          <AccordionItem value="controller-details" className="rounded-lg border px-3">
            <AccordionTrigger className="py-3 text-sm">
              Detalhes do controlador
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 pb-2">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">Modo</p>
                    <p className="mt-1 text-sm font-semibold capitalize">
                      {controladorStatus?.mode || controladorSelecionado.modo_padrao || 'remote'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">Uptime</p>
                    <p className="mt-1 text-sm font-semibold">
                      {typeof controladorStatus?.uptimeSeconds === 'number'
                        ? `${Math.floor(controladorStatus.uptimeSeconds / 60)} min`
                        : '--'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">IP do dispositivo</p>
                    <p className="mt-1 text-sm font-medium break-all">
                      {controladorStatus?.ip || 'Aguardando status'}
                    </p>
                  </CardContent>
                </Card>
                <Card className="col-span-2">
                  <CardContent className="p-3">
                    <p className="text-xs text-gray-500">Endpoint</p>
                    <p className="mt-1 text-sm font-medium break-all">
                      {controladorSelecionado.base_url || 'Não configurado'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            onClick={() => void carregarStatusControladorSala(controladorSelecionado.id)}
            disabled={controladorLoading || !!controladorComando}
            className="w-full text-sm sm:w-auto"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {controladorLoading ? 'Atualizando...' : 'Atualizar status'}
          </Button>
          <Button
            variant={(controladorStatus?.mode || controladorSelecionado.modo_padrao || 'remote') === 'remote' ? 'default' : 'outline'}
            onClick={() => void alterarModoControladorSala('remote')}
            disabled={!!controladorComando}
            className="w-full text-sm sm:w-auto"
          >
            Modo Remote
          </Button>
          <Button
            variant={(controladorStatus?.mode || controladorSelecionado.modo_padrao || 'remote') === 'manual' ? 'default' : 'outline'}
            onClick={() => void alterarModoControladorSala('manual')}
            disabled={!!controladorComando}
            className="w-full text-sm sm:w-auto"
          >
            Modo Manual
          </Button>
          <Button
            variant="outline"
            onClick={() => void controlarTodosRelaysSala(true)}
            disabled={!!controladorComando}
            className="w-full text-sm sm:w-auto"
          >
            Ligar todos
          </Button>
          <Button
            variant="outline"
            onClick={() => void controlarTodosRelaysSala(false)}
            disabled={!!controladorComando}
            className="w-full text-sm sm:w-auto"
          >
            Desligar todos
          </Button>
          {!isMobileViewport && (
            <DialogClose asChild>
              <Button variant="outline" className="w-full text-sm sm:w-auto">Fechar</Button>
            </DialogClose>
          )}
        </div>

        {controladorInfo && (
          <p className="text-xs text-green-700">{controladorInfo}</p>
        )}
        {controladorErro && (
          <p className="text-xs text-red-600">{controladorErro}</p>
        )}
      </div>

      <div className="space-y-4 pb-24 pr-1 sm:pb-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {controladorRelayEntries.map((relay) => {
            const Icon = relay.icon;
            const isRunning = controladorComando === `${relay.key}:on` || controladorComando === `${relay.key}:off`;

            return (
              <Card key={relay.key} className={relay.state ? 'min-w-0 border-green-200 bg-green-50' : 'min-w-0 border-gray-200'}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`rounded-full p-2 ${relay.state ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-500">Canal {relay.relayNumber}</p>
                        <p className="break-words font-semibold capitalize">{relay.name}</p>
                      </div>
                    </div>
                    <Badge className={relay.state ? 'w-fit self-start bg-green-100 text-green-700' : 'w-fit self-start bg-gray-100 text-gray-700'}>
                      {relay.state ? 'Ligado' : 'Desligado'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      className="flex-1"
                      variant={relay.state ? 'outline' : 'default'}
                      onClick={() => void controlarRelaySala(relay.key, true)}
                      disabled={!!controladorComando}
                    >
                      {isRunning && controladorComando?.endsWith(':on') ? 'Ligando...' : 'Ligar'}
                    </Button>
                    <Button
                      className="flex-1"
                      variant={relay.state ? 'destructive' : 'outline'}
                      onClick={() => void controlarRelaySala(relay.key, false)}
                      disabled={!!controladorComando}
                    >
                      {isRunning && controladorComando?.endsWith(':off') ? 'Desligando...' : 'Desligar'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3 text-xs text-gray-600 space-y-1">
          <p className="flex items-center gap-2"><Power className="h-4 w-4" /> O app não chama o ESP direto; os comandos passam pela Supabase Function.</p>
          <p>Isso preserva o token do controlador, evita CORS/mixed content e mantém o acesso funcionando em produção.</p>
        </div>
      </div>
    </div>
  ) : (
    <Card className="mt-4 border-dashed">
      <CardContent className="py-8 text-center text-sm text-gray-600">
        Nenhum controlador de sala encontrado para este lote.
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A4A]"></div>
      </div>
    );
  }

  if (isMobileViewport && controladorDialogOpen) {
    return (
      <div className="min-h-screen bg-[#F8F6F2] pb-6">
        <div className="sticky top-0 z-20 border-b bg-[#F8F6F2]/95 px-4 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Settings2 className="h-5 w-5" />
                {controladorSelecionado?.nome || 'Controle da Sala'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {controladorSelecionado
                  ? `${controladorSelecionado.localizacao} • ${controladorSelecionado.status || 'Status não informado'}`
                  : 'Associe um controlador à sala para operar ventilação, luz, aquecimento e umidificação.'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleControladorDialogChange(false)} aria-label="Fechar controle da sala">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="p-4">
          {controladorDialogBody}
        </div>
      </div>
    );
  }

  return (
    <div className="security-page">
      {errorMessage && (
        <div className="security-inline-alert security-inline-alert--danger">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Falha ao atualizar monitoramento</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {lotes.length === 0 && !errorMessage && (
        <div className="security-empty">
          <strong>Nenhuma leitura de sensor encontrada</strong>
          <p>Configure o webhook e envie as primeiras medições para montar o painel operacional.</p>
        </div>
      )}

      <section className="security-summary">
        <article className="security-summary-card security-summary-card--critical">
          <span className="security-summary-card__label">Salas críticas</span>
          <strong className="security-summary-card__value security-summary-card__value--critical">
            {resumoSalas.criticas.toString().padStart(2, '0')}
          </strong>
        </article>

        <article className="security-summary-card security-summary-card--warning">
          <span className="security-summary-card__label">Lotes em atenção</span>
          <strong className="security-summary-card__value security-summary-card__value--warning">
            {(lotesAtencao + lotesAlerta).toString().padStart(2, '0')}
          </strong>
        </article>

        <article className="security-summary-card">
          <span className="security-summary-card__label">Temp média</span>
          <strong className="security-summary-card__value">
            {mediaTemp.toFixed(1)} <span>°C</span>
          </strong>
        </article>

        <article className="security-summary-card">
          <span className="security-summary-card__label">Umidade média</span>
          <strong className="security-summary-card__value">
            {mediaUmid.toFixed(0)} <span>%</span>
          </strong>
        </article>

        <article className="security-summary-card">
          <span className="security-summary-card__label">CO2 global</span>
          <strong className="security-summary-card__value">
            {mediaCo2.toFixed(0)} <span>ppm</span>
          </strong>
        </article>
      </section>

      <section className="security-toolbar-card">
        <div className="security-toolbar-card__copy">
          <span className="security-section-kicker">Monit. central</span>
          <h2 className="security-section-title">Monitoramento de Salas</h2>
          <p className="security-section-copy">
            Status em tempo real dos laboratórios ativos, com prioridade visual para criticidade, lotes afetados e ação imediata.
          </p>
        </div>

        <div className="security-toolbar">
          <div className="security-toolbar__filters">
            <Select value={loteSelecionado} onValueChange={setLoteSelecionado}>
              <SelectTrigger className="security-toolbar__select">
                <SelectValue placeholder="Todos os Lotes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Lotes</SelectItem>
                {lotes.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.codigo_lote} - {resolveLoteSalaLabel(lote)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={periodoHistorico} onValueChange={(v: '24h' | '7d') => setPeriodoHistorico(v)}>
              <SelectTrigger className="security-toolbar__select security-toolbar__select--compact">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Últimas 24 horas</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => void carregarDados()} className="security-toolbar__refresh">
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </Button>
          </div>

          <div className="security-toolbar__tabs" role="tablist" aria-label="Filtrar salas por status">
            <button
              type="button"
              className={`security-toolbar__tab ${statusVisualFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setStatusVisualFilter('all')}
            >
              Todos
            </button>
            <button
              type="button"
              className={`security-toolbar__tab security-toolbar__tab--critical ${statusVisualFilter === 'critical' ? 'is-active' : ''}`}
              onClick={() => setStatusVisualFilter('critical')}
            >
              Crítico
            </button>
            <button
              type="button"
              className={`security-toolbar__tab security-toolbar__tab--normal ${statusVisualFilter === 'normal' ? 'is-active' : ''}`}
              onClick={() => setStatusVisualFilter('normal')}
            >
              Normal
            </button>
          </div>
        </div>
      </section>

      <section className="security-rooms-section">
        <div className="security-room-grid">
          {visibleSalas.length > 0 ? visibleSalas.map((sala) => {
            const controller = getControladorForLote(sala.primaryLote);
            const camera = getCameraForLote(sala.primaryLote);
            const tempOut = sala.avgTemperatura > sala.sensorBounds.tempMax || sala.avgTemperatura < sala.sensorBounds.tempMin;
            const humidityOut = sala.avgUmidade > sala.sensorBounds.umidMax || sala.avgUmidade < sala.sensorBounds.umidMin;
            const co2Out = sala.avgCo2 > sala.sensorBounds.co2Elevado;
            const co2Critical = sala.avgCo2 >= sala.sensorBounds.co2Critico;
            const TempTrendIcon = sala.trends.temperatura.icon;
            const HumTrendIcon = sala.trends.umidade.icon;
            const Co2TrendIcon = sala.trends.co2.icon;

            return (
              <article key={sala.salaId} className={`security-room-card security-room-card--${sala.status}`}>
                <header className="security-room-card__header">
                  <div className="security-room-card__header-main">
                    <h3 className="security-room-card__name">{sala.salaLabel}</h3>
                    <div className="security-room-card__badges">
                      <span className={`security-room-card__status security-room-card__status--${sala.status}`}>
                        {sala.statusLabel}
                      </span>
                      <span className="security-room-card__lot-chip">
                        {sala.impactedLots} lote(s) impactado(s)
                      </span>
                    </div>
                  </div>

                  <span className={`security-room-card__status-icon security-room-card__status-icon--${sala.status}`} aria-hidden="true">
                    {sala.status === 'critical' ? <AlertTriangle className="h-4 w-4" /> : sala.status === 'warning' ? <Radio className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </span>
                </header>

                <div className={`security-room-card__alert security-room-card__alert--${sala.status}`}>
                  <div className="security-room-card__alert-main">
                    <span className="security-room-card__alert-label">
                      {sala.topIssue ? 'Alerta principal' : 'Status da sala'}
                    </span>
                    <strong className="security-room-card__alert-title">
                      {sala.topIssue
                        ? `${sala.topIssue.title} ${sala.topIssue.key === 'co2' ? `(${sala.avgCo2.toFixed(0)}ppm)` : sala.topIssue.key === 'umidade' ? `(${sala.avgUmidade.toFixed(0)}%)` : `(${sala.avgTemperatura.toFixed(1)}°C)`}`
                        : 'Ambiente estável'}
                    </strong>
                  </div>
                  <span className="security-room-card__alert-time">
                    {sala.alertElapsed || 'Sem alerta ativo'}
                  </span>
                </div>

                <div className="security-room-card__metrics">
                  <div className={`security-room-card__metric ${tempOut ? 'security-room-card__metric--critical' : ''}`}>
                    <div className="security-room-card__metric-head">
                      <span>Temperatura</span>
                      <span className={`security-room-card__trend security-room-card__trend--${sala.trends.temperatura.direction}`}>
                        <TempTrendIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <strong className="security-room-card__metric-value">{sala.avgTemperatura.toFixed(1)}°C</strong>
                    <span className="security-room-card__metric-copy">
                      Ideal {sala.sensorBounds.tempMin}-{sala.sensorBounds.tempMax}°C
                    </span>
                  </div>

                  <div className={`security-room-card__metric ${humidityOut ? 'security-room-card__metric--warning' : ''}`}>
                    <div className="security-room-card__metric-head">
                      <span>Umidade</span>
                      <span className={`security-room-card__trend security-room-card__trend--${sala.trends.umidade.direction}`}>
                        <HumTrendIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <strong className="security-room-card__metric-value">{sala.avgUmidade.toFixed(0)}%</strong>
                    <span className="security-room-card__metric-copy">
                      Ideal {sala.sensorBounds.umidMin}-{sala.sensorBounds.umidMax}%
                    </span>
                  </div>

                  <div className={`security-room-card__metric ${co2Out ? (co2Critical ? 'security-room-card__metric--critical' : 'security-room-card__metric--warning') : ''}`}>
                    <div className="security-room-card__metric-head">
                      <span>CO2</span>
                      <span className={`security-room-card__trend security-room-card__trend--${sala.trends.co2.direction}`}>
                        <Co2TrendIcon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <strong className="security-room-card__metric-value">{sala.avgCo2.toFixed(0)}ppm</strong>
                    <span className="security-room-card__metric-copy">
                      Ideal até {sala.sensorBounds.co2IdealMax}ppm
                    </span>
                  </div>
                </div>

                <div className="security-room-card__impact">
                  <div className="security-room-card__impact-grid">
                    <div className="security-room-card__impact-item">
                      <span className="security-room-card__impact-label">Impacto em lotes</span>
                      <strong className="security-room-card__impact-value">{sala.impactedLots} lote(s)</strong>
                    </div>
                    <div className="security-room-card__impact-item">
                      <span className="security-room-card__impact-label">Lote em risco</span>
                      <strong className="security-room-card__impact-value">{sala.topIssueLote?.codigo_lote || sala.primaryLote.codigo_lote}</strong>
                    </div>
                  </div>
                  <p className="security-room-card__impact-copy">{sala.productionImpact}</p>
                </div>

                <div className={`security-room-card__spark security-room-card__spark--${sala.status}`}>
                  {sala.sparkValues.map((value, index) => (
                    <span
                      key={`${sala.salaId}-${index}`}
                      className="security-room-card__spark-bar"
                      style={{ height: `${Math.max(16, value)}px` }}
                    />
                  ))}
                </div>

                <div className="security-room-card__actions">
                  <Button
                    onClick={() => abrirControleDaSala(sala.primaryLote)}
                    disabled={!controller}
                    className={`security-room-card__primary-action security-room-card__primary-action--${sala.status}`}
                  >
                    <Settings2 className="h-4 w-4" />
                    {controller ? sala.actionLabel : 'Sem controle'}
                  </Button>

                  <div className="security-room-card__secondary-actions">
                    <Button
                      variant="outline"
                      onClick={() => abrirCameraDoLote(sala.primaryLote)}
                      disabled={!camera}
                      className="security-room-card__secondary-action"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver câmera
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => abrirConfiguracaoDoLote(sala.primaryLote)}
                      disabled={!camera}
                      className="security-room-card__secondary-action"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="security-empty">
              <strong>Nenhuma sala encontrada para esse filtro</strong>
              <p>Altere o filtro de lote ou status para visualizar outras áreas monitoradas.</p>
            </div>
          )}
        </div>
      </section>

      {salasComCameraSemTelemetria.length > 0 && (
        <section className="security-rooms-section">
          <div className="security-details__head">
            <h3 className="security-section-title security-section-title--sm">Salas com câmera vinculada</h3>
            <p className="security-section-copy">Estas salas já têm câmera preparada, mas ainda aguardam a primeira leitura de sensor para entrar no monitoramento operacional principal.</p>
          </div>

          <div className="security-room-grid">
            {salasComCameraSemTelemetria.map(({ sala, camera, controlador }) => (
              <article key={`camera-only-${sala.id}`} className="security-room-card security-room-card--ok">
                <header className="security-room-card__header">
                  <div className="security-room-card__header-main">
                    <h3 className="security-room-card__name">{sala.nome}</h3>
                    <div className="security-room-card__badges">
                      <span className="security-room-card__status security-room-card__status--ok">
                        Aguardando telemetria
                      </span>
                      <span className="security-room-card__lot-chip">
                        {camera?.status || 'Status não informado'}
                      </span>
                    </div>
                  </div>

                  <span className="security-room-card__status-icon security-room-card__status-icon--ok" aria-hidden="true">
                    <Camera className="h-4 w-4" />
                  </span>
                </header>

                <div className="security-room-card__alert security-room-card__alert--ok">
                  <div className="security-room-card__alert-main">
                    <span className="security-room-card__alert-label">Preparação concluída</span>
                    <strong className="security-room-card__alert-title">
                      {camera?.nome || 'Câmera vinculada'}
                    </strong>
                  </div>
                  <span className="security-room-card__alert-time">Sem sensor online</span>
                </div>

                <div className="security-room-card__impact">
                  <div className="security-room-card__impact-grid">
                    <div className="security-room-card__impact-item">
                      <span className="security-room-card__impact-label">Sala</span>
                      <strong className="security-room-card__impact-value">{sala.codigo || sala.id}</strong>
                    </div>
                    <div className="security-room-card__impact-item">
                      <span className="security-room-card__impact-label">Feed</span>
                      <strong className="security-room-card__impact-value">
                        {hasCameraStream(camera) ? 'Disponível' : 'Sem URL'}
                      </strong>
                    </div>
                  </div>
                  <p className="security-room-card__impact-copy">
                    {hasCameraStream(camera)
                      ? `A câmera ${camera?.nome || ''} já pode ser aberta e configurada mesmo antes da primeira leitura ambiental.`
                      : 'Vincule uma URL de câmera para habilitar visualização e configuração desta sala.'}
                  </p>
                </div>

                <div className="security-room-card__actions">
                  <Button
                    onClick={() => abrirControlePorConfig(controlador)}
                    disabled={!controlador}
                    className="security-room-card__primary-action security-room-card__primary-action--ok"
                  >
                    <Settings2 className="h-4 w-4" />
                    {controlador ? 'Controlar sala' : 'Sem controle'}
                  </Button>

                  <div className="security-room-card__secondary-actions">
                    <Button
                      variant="outline"
                      onClick={() => abrirCamera(camera)}
                      disabled={!camera}
                      className="security-room-card__secondary-action"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver câmera
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => abrirConfiguracaoCamera(camera)}
                      disabled={!camera}
                      className="security-room-card__secondary-action"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Configurar
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="security-recommendations">
        <div className="security-recommendations__header">
          <div className="security-recommendations__title-row">
            <span className="security-recommendations__icon">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <h3 className="security-recommendations__title">Recomendações Operacionais</h3>
              <p className="security-recommendations__copy">Análise de IA baseada no estado atual das salas</p>
            </div>
          </div>
          <span className="security-recommendations__fab">
            <Plus className="h-4 w-4" />
          </span>
        </div>

        <div className="security-recommendations__grid">
          {(destaquesOperacionais.length
            ? destaquesOperacionais
            : recomendacoesOperacionais.itens.slice(0, 2).map((item, index) => ({
                sala: index === 0 ? 'Operação geral' : 'Acompanhamento',
                prioridade: index === 0 ? 'Alta prioridade' : 'Média prioridade',
                timing: 'Agora',
                title: item,
                description: item,
                action: 'Executar ação',
              }))).map((item) => (
            <article key={`${item.sala}-${item.title}`} className="security-recommendation-card">
              <span className={`security-recommendation-card__accent ${item.prioridade.startsWith('Alta') ? 'security-recommendation-card__accent--critical' : ''}`}></span>
              <div className="security-recommendation-card__body">
                <div className="security-recommendation-card__meta">
                  <span className={`security-recommendation-card__priority ${item.prioridade.startsWith('Alta') ? 'security-recommendation-card__priority--critical' : ''}`}>
                    {item.prioridade}
                  </span>
                  <span className="security-recommendation-card__timing">• {item.timing}</span>
                </div>
                <h4 className="security-recommendation-card__title">{item.title} na {item.sala}</h4>
                <p className="security-recommendation-card__copy">{item.description}</p>
                <button type="button" className="security-recommendation-card__action">
                  {item.action} →
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="security-projection">
        <div className="security-projection__media">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_eDXJ9LqoqTL2a8OTwGlI15nxEFS-03ABeNlY36TowxjnKNlByFUd8h-RjmAPSiVpq-GgA_TB5BNpNqQXi0KT3o66__RciM9C7dze37V0yLUen9DTnETV8DZIS2h2giE5AGgFujXxtocWHcfHQ0voAI9HU1L8IncjQuTqaFjQbAYT6Uvs95xNNNuIkDVMIoJ_FzrGgDfvhG7XqzPcn7PfPSPqgAMzNF7vAef6dTT0akYJfnhBfT1ezJezigWd1UY0jqnpsmpKHzA"
            alt="Microscopic view of mushroom mycelium structure"
            className="security-projection__image"
          />
        </div>

        <div className="security-projection__content">
          <span className="security-projection__eyebrow">
            <Sparkles className="h-4 w-4" />
            Conclusão de IA Mycelium Pro
          </span>
          <h2 className="security-projection__title">
            Projeção operacional da semana
          </h2>
          <p className="security-projection__headline">
            {projecaoOperacional.headline}
            {projecaoOperacional.emphasis ? (
              <span> A sala mais sensível agora é {projecaoOperacional.emphasis}.</span>
            ) : null}
          </p>
          <div className="security-projection__metrics">
            <div className="security-projection__metric">
              <span className="security-projection__metric-label">Blocos em frutificação</span>
              <strong className="security-projection__metric-value">{projecaoOperacional.blocosFrutificando}</strong>
            </div>
            <div className="security-projection__metric">
              <span className="security-projection__metric-label">Eficiência ambiental</span>
              <strong className="security-projection__metric-value">{projecaoOperacional.eficiencia.toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="security-details">
        <div className="security-details__head">
          <h3 className="security-section-title security-section-title--sm">Detalhes técnicos por sala</h3>
          <p className="security-section-copy">Os gráficos e controles continuam disponíveis, mas com menor protagonismo do que status, alertas e ação.</p>
        </div>

        <Accordion type="multiple" className="security-details__list">
          {visibleSalas.map((sala) => (
            <AccordionItem key={`tech-${sala.salaId}`} value={`tech-${sala.salaId}`} className="security-details__item">
              <AccordionTrigger className="security-details__trigger">
                <div className="security-details__trigger-copy">
                  <p className="security-details__trigger-title">{sala.salaLabel}</p>
                  <p className="security-details__trigger-subtitle">
                    Lote de referência: {sala.primaryLote.codigo_lote} • {sala.statusLabel}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="security-details__content">
                <div className="security-details__grid">
                  <div className="security-details__charts">
                    <Card className="security-details__card">
                      <CardHeader>
                        <CardTitle className="text-sm">Temperatura & Umidade • {periodoHistorico === '24h' ? 'Últimas 24h' : 'Últimos 7 dias'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={sala.primaryLote.historico}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickFormatter={(value) => format(new Date(value), periodoHistorico === '24h' ? 'HH:mm' : 'dd/MM HH:mm')} />
                            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                            <Tooltip labelFormatter={(value) => format(new Date(value as string), 'dd/MM/yyyy HH:mm')} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                            <Line yAxisId="left" type="monotone" dataKey="temperatura" stroke="#f97316" strokeWidth={2} name="Temp (°C)" dot={false} />
                            <Line yAxisId="right" type="monotone" dataKey="umidade" stroke="#3b82f6" strokeWidth={2} name="Umidade (%)" dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card className="security-details__card">
                      <CardHeader>
                        <CardTitle className="text-sm">Nível de CO₂ • {periodoHistorico === '24h' ? 'Últimas 24h' : 'Últimos 7 dias'}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={sala.primaryLote.historico}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} interval="preserveStartEnd" tickFormatter={(value) => format(new Date(value), periodoHistorico === '24h' ? 'HH:mm' : 'dd/MM HH:mm')} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip labelFormatter={(value) => format(new Date(value as string), 'dd/MM/yyyy HH:mm')} />
                            <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                            <Area type="monotone" dataKey="co2" stroke="#355f2f" fill="#86a77b" fillOpacity={0.22} strokeWidth={2} name="CO₂ (ppm)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="security-details__card security-details__card--aside">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4" />
                        Sensores & infraestrutura
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-[#445042]">
                      <p><strong>SHT45:</strong> temperatura e umidade</p>
                      <p><strong>SCD41:</strong> CO₂ contínuo na sala</p>
                      <p><strong>Câmeras:</strong> {cameras.length} cadastrada(s)</p>
                      <p><strong>Controladores:</strong> {controladoresSala.length} cadastrado(s)</p>
                      <p><strong>Persistência:</strong> leituras em <code>leituras_sensores</code></p>
                    </CardContent>
                  </Card>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <Dialog open={!isMobileViewport && controladorDialogOpen} onOpenChange={handleControladorDialogChange}>
        <DialogContent className="top-[50%] left-[50%] h-[82dvh] w-[76vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              {controladorSelecionado?.nome || 'Controle da Sala'}
            </DialogTitle>
            <DialogDescription>
              {controladorSelecionado
                ? `${controladorSelecionado.localizacao} • ${controladorSelecionado.status || 'Status não informado'}`
                : 'Associe um controlador à sala para operar ventilação, luz, aquecimento e umidificação.'}
            </DialogDescription>
          </DialogHeader>
          {controladorDialogBody}
        </DialogContent>
      </Dialog>

      <Dialog open={cameraDialogOpen} onOpenChange={handleCameraDialogChange}>
        <DialogContent className="w-[95vw] sm:max-w-5xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              {cameraSelecionada?.nome || 'Câmera não encontrada'}
            </DialogTitle>
            <DialogDescription>
              {cameraSelecionada
                ? `${cameraSelecionada.localizacao} • ${cameraSelecionada.status || 'Status não informado'}`
                : 'Cadastre uma câmera na tabela `cameras` com url_stream para visualizar as imagens.'}
            </DialogDescription>
          </DialogHeader>

          {cameraSelecionada?.url_stream ? (
            <div className="space-y-4">
              <div className="flex max-h-[65dvh] min-h-[220px] w-full items-center justify-center overflow-hidden rounded-lg border bg-black">
                {cameraErroCarregamento ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-red-300">
                    {cameraErroCarregamento}
                  </div>
                ) : (
                  <img
                    src={buildCameraImageUrl(cameraSelecionada.url_stream, cameraFrameToken, {
                      flash: cameraFrameWithFlash,
                    })}
                    alt={`Feed da ${cameraSelecionada.nome}`}
                    className="max-h-[65dvh] w-full select-none object-contain"
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    onLoad={() => setCameraErroCarregamento(null)}
                    onError={() => setCameraErroCarregamento('Falha ao carregar a câmera. Verifique a URL (ex.: http://IP_DA_CAM/capture) e se o dispositivo está online na mesma rede.')}
                  />
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCameraFrameWithFlash(false);
                    setCameraFrameToken(Date.now());
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Atualizar frame
                </Button>
                <Button
                  variant={autoAtualizarCamera ? 'default' : 'outline'}
                  onClick={() => setAutoAtualizarCamera((prev) => !prev)}
                >
                  {autoAtualizarCamera ? 'Auto atualização ON (8s)' : 'Auto atualização OFF'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void controlarFlashCamera('on')}
                  disabled={cameraFlashComando !== null}
                >
                  {cameraFlashComando === 'on' ? 'Ligando luz...' : 'Ligar luz (3s)'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void controlarFlashCamera('off')}
                  disabled={cameraFlashComando !== null}
                >
                  {cameraFlashComando === 'off' ? 'Desligando...' : 'Desligar luz'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => abrirConfiguracaoCamera(cameraSelecionada)}
                >
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Configurar imagem
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DialogClose>
              </div>

              {cameraFlashInfo && (
                <p className="text-xs text-green-700">{cameraFlashInfo}</p>
              )}
              {cameraFlashErro && (
                <p className="text-xs text-red-600">{cameraFlashErro}</p>
              )}

              {cameraSelecionada?.url_stream && (
                <p className="text-xs text-gray-500 break-all">
                  URL ativa: {cameraSelecionada.url_stream}
                </p>
              )}

              <p className="text-xs text-gray-500">
                Para ESP32-CAM com resposta lenta, use a URL de snapshot (ex.: `http://IP_DA_CAM/capture`) no campo `url_stream`.
              </p>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-gray-600">
                Câmera sem URL configurada. Preencha `url_stream` na tabela `cameras` para exibir no app.
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={cameraConfigDialogOpen} onOpenChange={handleCameraConfigDialogChange}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5" />
              Configuração da Câmera
            </DialogTitle>
            <DialogDescription>
              {cameraConfigTarget
                ? `${cameraConfigTarget.nome} • ${cameraConfigTarget.localizacao}`
                : 'Selecione uma câmera para configurar imagem.'}
            </DialogDescription>
          </DialogHeader>

          {cameraConfigTarget?.url_stream ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void carregarControlesCamera()}
                  disabled={cameraControlsLoading || cameraControlsSaving}
                >
                  {cameraControlsLoading ? 'Lendo...' : 'Ler câmera'}
                </Button>
                <Button
                  onClick={() => void aplicarControlesCamera()}
                  disabled={cameraControlsLoading || cameraControlsSaving}
                >
                  {cameraControlsSaving ? 'Aplicando...' : 'Salvar ajustes'}
                </Button>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">Perfis rápidos</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCameraControls({
                        framesize: 'SVGA',
                        quality: 12,
                        brightness: 0,
                        contrast: 0,
                        saturation: 0,
                        hmirror: false,
                        vflip: false,
                        exposureCtrl: true,
                      })
                    }
                  >
                    Padrão Cultivo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCameraControls({
                        framesize: 'VGA',
                        quality: 14,
                        brightness: 1,
                        contrast: 1,
                        saturation: 0,
                        hmirror: false,
                        vflip: false,
                        exposureCtrl: true,
                      })
                    }
                  >
                    Baixa Luz
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCameraControls({
                        framesize: 'XGA',
                        quality: 10,
                        brightness: 0,
                        contrast: 1,
                        saturation: 1,
                        hmirror: false,
                        vflip: false,
                        exposureCtrl: true,
                      })
                    }
                  >
                    Detalhe Máximo
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium">Ajuste fino de brilho</p>
                  <p className="text-xs text-gray-600">
                    Use só para compensar ambiente mais escuro ou muito claro.
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600">Brilho: {cameraControls.brightness}</p>
                  <input
                    type="range"
                    min={-2}
                    max={2}
                    step={1}
                    value={cameraControls.brightness}
                    onChange={(event) =>
                      setCameraControls((prev) => ({
                        ...prev,
                        brightness: clampNumber(Number.parseInt(event.target.value, 10), -2, 2),
                      }))
                    }
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCameraControls((prev) => ({
                        ...prev,
                        brightness: 0,
                      }))
                    }
                  >
                    Reset brilho
                  </Button>
                </div>
              </div>

              {cameraControlsInfo && (
                <p className="text-xs text-green-700">{cameraControlsInfo}</p>
              )}
              {cameraControlsErro && (
                <p className="text-xs text-red-600">{cameraControlsErro}</p>
              )}

              <p className="text-xs text-gray-500">
                Fluxo recomendado: escolha um perfil rápido, ajuste só o brilho e salve.
              </p>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-gray-600">
                Câmera sem URL configurada para ajustes.
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
