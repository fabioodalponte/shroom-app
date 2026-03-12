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
  X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format } from 'date-fns';
import { fetchServer } from '../../utils/supabase/client';

interface SensorData {
  timestamp: string;
  temperatura: number;
  umidade: number;
  co2: number;
  pm25?: number;
  pm10?: number;
}

interface LoteMonitoramento {
  id: string;
  codigo_lote: string;
  sala: string;
  fase_operacional?: string | null;
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    pm25?: number;
  };
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
  tipo?: string | null;
  status?: string | null;
  url_stream?: string | null;
  resolucao?: string | null;
  gravacao_ativa?: boolean | null;
}

interface SalaControllerConfig {
  id: string;
  nome: string;
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

function hasCameraStream(camera: CameraConfig | null | undefined) {
  return !!camera?.url_stream && camera.url_stream.trim().length > 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

export function Seguranca() {
  const [lotes, setLotes] = useState<LoteMonitoramento[]>([]);
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [controladoresSala, setControladoresSala] = useState<SalaControllerConfig[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<string>('todos');
  const [periodoHistorico, setPeriodoHistorico] = useState<'24h' | '7d'>('24h');
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
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 640px)').matches;
  });

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const hours = periodoHistorico === '24h' ? 24 : 168;
      const [sensoresResult, camerasResult, controladoresResult] = await Promise.allSettled([
        fetchServer(`/sensores/latest?hours=${hours}`),
        fetchServer('/cameras'),
        fetchServer('/controladores'),
      ]);

      if (sensoresResult.status === 'rejected') {
        throw sensoresResult.reason;
      }

      const sensores = (sensoresResult.value.sensores || []) as LoteMonitoramento[];
      setLotes(sensores);

      if (camerasResult.status === 'fulfilled') {
        setCameras((camerasResult.value.cameras || []) as CameraConfig[]);
      } else {
        console.warn('Não foi possível carregar câmeras:', camerasResult.reason);
        setCameras([]);
      }

      if (controladoresResult.status === 'fulfilled') {
        setControladoresSala((controladoresResult.value.controladores || []) as SalaControllerConfig[]);
      } else {
        console.warn('Não foi possível carregar controladores de sala:', controladoresResult.reason);
        setControladoresSala([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar monitoramento de sensores:', error);
      setErrorMessage(error.message || 'Erro ao carregar sensores');
      setLotes([]);
      setCameras([]);
      setControladoresSala([]);
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

    const sala = normalizeText(lote.sala || '');
    const codigo = normalizeText(lote.codigo_lote || '');

    const encontrada = universoBusca.find((camera) => {
      const nome = normalizeText(camera.nome || '');
      const localizacao = normalizeText(camera.localizacao || '');

      const matchSala =
        !!sala &&
        (nome.includes(sala) ||
          localizacao.includes(sala) ||
          sala.includes(nome) ||
          sala.includes(localizacao));

      const matchCodigo = !!codigo && (nome.includes(codigo) || localizacao.includes(codigo));

      return matchSala || matchCodigo;
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

    const sala = normalizeText(lote.sala || '');
    const codigo = normalizeText(lote.codigo_lote || '');

    const encontrado = base.find((controlador) => {
      const nome = normalizeText(controlador.nome || '');
      const localizacao = normalizeText(controlador.localizacao || '');

      const matchSala =
        !!sala &&
        (nome.includes(sala) ||
          localizacao.includes(sala) ||
          sala.includes(nome) ||
          sala.includes(localizacao));

      const matchCodigo = !!codigo && (nome.includes(codigo) || localizacao.includes(codigo));
      return matchSala || matchCodigo;
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

  const abrirCameraDoLote = useCallback((lote: LoteMonitoramento) => {
    const camera = getCameraForLote(lote);
    setCameraSelecionada(camera);
    setCameraErroCarregamento(null);
    setCameraFrameWithFlash(false);
    setCameraFrameToken(Date.now());
    setAutoAtualizarCamera(false);
    setCameraFlashInfo(null);
    setCameraFlashErro(null);
    setCameraDialogOpen(true);
  }, [getCameraForLote]);

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

  // Calcular médias gerais
  const mediaTemp = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.temperatura, 0) / lotes.length : 0;
  const mediaUmid = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.umidade, 0) / lotes.length : 0;
  const mediaCo2 = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.co2, 0) / lotes.length : 0;
  const lotesAlerta = lotes.filter(l => l.score_risco >= 70).length;
  const lotesAtencao = lotes.filter(l => l.score_risco >= 30 && l.score_risco < 70).length;

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
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond'] text-[34px] font-bold leading-none sm:text-[42px]">
          Segurança & Monitoramento
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Sensores IoT em tempo real, câmeras e análise de risco de contaminação
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={loteSelecionado} onValueChange={setLoteSelecionado}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Selecione um lote" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Lotes</SelectItem>
            {lotes.map(lote => (
              <SelectItem key={lote.id} value={lote.id}>
                {lote.codigo_lote} - {lote.sala} ({formatFaseLabel(lote.fase_operacional)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodoHistorico} onValueChange={(v: '24h' | '7d') => setPeriodoHistorico(v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24 horas</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => void carregarDados()} className="w-full sm:w-auto">
          Atualizar
        </Button>
      </div>

      {errorMessage && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">
            {errorMessage}
          </CardContent>
        </Card>
      )}

      {lotes.length === 0 && !errorMessage && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-gray-500">
            Nenhuma leitura de sensor encontrada. Configure o webhook e envie as primeiras medições.
          </CardContent>
        </Card>
      )}

      {/* Cards de Resumo - Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Temperatura Média</p>
                <p className="text-2xl font-bold text-[#546A4A] mt-1">
                  {mediaTemp.toFixed(1)}°C
                </p>
              </div>
              <Thermometer className="w-8 h-8 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Umidade Média</p>
                <p className="text-2xl font-bold text-[#546A4A] mt-1">
                  {mediaUmid.toFixed(0)}%
                </p>
              </div>
              <Droplets className="w-8 h-8 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">CO₂ Médio</p>
                <p className="text-2xl font-bold text-[#546A4A] mt-1">
                  {mediaCo2.toFixed(0)} ppm
                </p>
              </div>
              <Wind className="w-8 h-8 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500 border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-yellow-700">Lotes em Atenção</p>
                <p className="text-2xl font-bold text-yellow-600 mt-1">
                  {lotesAtencao}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500 border-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-red-700">Lotes em Perigo</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {lotesAlerta}
                </p>
              </div>
              <Shield className="w-8 h-8 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

	      {/* Painel de Lotes com Score de Risco */}
	      {lotesFiltrados.map(lote => {
	        const risco = getRiscoColor(lote.score_risco);
	        const tendTemp = getTendencia(lote.sensor_atual.temperatura, 22, 2);
	        const tendUmid = getTendencia(lote.sensor_atual.umidade, 85, 5);
	        const tendCo2 = getTendencia(lote.sensor_atual.co2, 1000, 200);
          const cameraLote = getCameraForLote(lote);
          const controladorLote = getControladorForLote(lote);

	        return (
	          <Card key={lote.id} className={`border-l-4 ${risco.border}`}>
	            <CardHeader>
	              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <CardTitle className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="text-xl font-['Cormorant_Garamond'] sm:text-2xl">{lote.codigo_lote}</span>
                    <Badge variant="outline">{lote.sala}</Badge>
                    <Badge variant="outline">{formatFaseLabel(lote.fase_operacional)}</Badge>
                    <Badge className={`${risco.bg} ${risco.text}`}>
                      {risco.label} ({lote.score_risco}%)
                    </Badge>
                    <Badge variant="outline">
                      Blocos: {lote.blocos_resumo?.total || 0}
                    </Badge>
                    <Badge variant="outline">
                      Frutificação: {lote.blocos_resumo?.frutificacao || 0}
                    </Badge>
                  </CardTitle>
                </div>
	                <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirControleDaSala(lote)}
                      disabled={!controladorLote}
                      className="flex-1 min-w-[150px] sm:flex-none"
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      {controladorLote ? 'Controle da Sala' : 'Sem Controle'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirConfiguracaoDoLote(lote)}
                      disabled={!cameraLote}
                      className="flex-1 min-w-[120px] sm:flex-none"
                    >
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      Configurar
                    </Button>
	                  <Button
                      variant="outline"
                      size="sm"
                      onClick={() => abrirCameraDoLote(lote)}
                      disabled={!cameraLote}
                      className="flex-1 min-w-[150px] sm:flex-none"
                    >
	                    <Eye className="w-4 h-4 mr-2" />
	                    {cameraLote ? 'Câmera ao Vivo' : 'Sem Câmera'}
	                  </Button>
                  </div>
	              </div>
	            </CardHeader>

            <CardContent className="space-y-6">
              {/* Alertas (se houver) */}
              {lote.alertas.length > 0 && (
                <div className={`p-4 rounded-lg ${risco.bg} border ${risco.border}`}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={`w-5 h-5 ${risco.text} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <h4 className={`font-semibold ${risco.text} mb-2`}>Alertas Ativos:</h4>
                      <ul className={`space-y-1 text-sm ${risco.text}`}>
                        {lote.alertas.map((alerta, idx) => (
                          <li key={idx}>• {alerta}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Sensores Atuais em Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Temperatura */}
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Thermometer className="w-5 h-5 text-orange-600" />
                    <tendTemp.icon className={`w-4 h-4 ${tendTemp.color}`} />
                  </div>
                  <p className="text-xs text-gray-600">Temperatura</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {lote.sensor_atual.temperatura.toFixed(1)}°C
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Ideal: 20-25°C</p>
                </div>

                {/* Umidade */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Droplets className="w-5 h-5 text-blue-600" />
                    <tendUmid.icon className={`w-4 h-4 ${tendUmid.color}`} />
                  </div>
                  <p className="text-xs text-gray-600">Umidade</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {lote.sensor_atual.umidade.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Ideal: 80-90%</p>
                </div>

                {/* CO2 */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Wind className="w-5 h-5 text-purple-600" />
                    <tendCo2.icon className={`w-4 h-4 ${tendCo2.color}`} />
                  </div>
                  <p className="text-xs text-gray-600">CO₂</p>
                  <p className="text-2xl font-bold text-purple-900 mt-1">
                    {lote.sensor_atual.co2.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">ppm (Ideal: {'<'}1000)</p>
                </div>

                {/* PM2.5 */}
                {lote.sensor_atual.pm25 && (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Radio className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-xs text-gray-600">Partículas PM2.5</p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {lote.sensor_atual.pm25.toFixed(0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">µg/m³ (Ideal: {'<'}25)</p>
                  </div>
                )}
              </div>

              {/* Gráficos de Histórico */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico Temperatura e Umidade */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Temperatura & Umidade - {periodoHistorico === '24h' ? 'Últimas 24h' : 'Últimos 7 dias'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={lote.historico}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          tickFormatter={(value) =>
                            format(new Date(value), periodoHistorico === '24h' ? 'HH:mm' : 'dd/MM HH:mm')
                          }
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip
                          labelFormatter={(value) =>
                            format(new Date(value as string), 'dd/MM/yyyy HH:mm')
                          }
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="temperatura" 
                          stroke="#f97316" 
                          strokeWidth={2}
                          name="Temp (°C)"
                          dot={false}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="umidade" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          name="Umidade (%)"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico CO2 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Nível de CO₂ - {periodoHistorico === '24h' ? 'Últimas 24h' : 'Últimos 7 dias'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={lote.historico}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                          tickFormatter={(value) =>
                            format(new Date(value), periodoHistorico === '24h' ? 'HH:mm' : 'dd/MM HH:mm')
                          }
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          labelFormatter={(value) =>
                            format(new Date(value as string), 'dd/MM/yyyy HH:mm')
                          }
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: '12px' }} />
                        <Area 
                          type="monotone" 
                          dataKey="co2" 
                          stroke="#9333ea" 
                          fill="#c084fc"
                          fillOpacity={0.3}
                          strokeWidth={2}
                          name="CO₂ (ppm)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        );
      })}

	      {/* Card de Informações dos Sensores */}
	      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Activity size={20} />
            Sensores IoT Configurados
          </CardTitle>
        </CardHeader>
	        <CardContent className="text-sm text-blue-900 space-y-2">
	          <p><strong>SHT45:</strong> Sensor de temperatura e umidade de alta precisão</p>
	          <p><strong>SCD41:</strong> Sensor NDIR de CO₂ para monitoramento contínuo da sala</p>
	          <p><strong>Origem dos dados:</strong> ESP32 WROOM enviando leituras para o endpoint de ingestão</p>
	          <p><strong>Câmeras conectadas:</strong> {cameras.length} cadastrada(s) na API</p>
	          <p><strong>Controladores de sala:</strong> {controladoresSala.length} cadastrado(s) na API</p>
	          <p><strong>Persistência:</strong> Leituras gravadas em `leituras_sensores` para histórico e análise</p>
	        </CardContent>
	      </Card>

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

      {/* Procedimentos de Emergência */}
      <Card className="bg-red-50 border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle size={20} />
            Procedimentos de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-900 space-y-2">
          <p><strong>Score de Risco &gt; 70%:</strong> Isolar lote imediatamente, verificar mancha visual, notificar supervisor</p>
          <p><strong>CO₂ &gt; 1500 ppm:</strong> Aumentar ventilação, verificar sistema de exaustão, monitorar crescimento anormal</p>
          <p><strong>Umidade &gt; 92%:</strong> Reduzir umidificação, aumentar circulação de ar, risco de contaminação bacteriana</p>
          <p><strong>PM2.5 &gt; 50 µg/m³:</strong> Verificar portas/janelas abertas, limpar filtros HEPA, suspeitar de esporos no ar</p>
        </CardContent>
      </Card>
    </div>
  );
}
