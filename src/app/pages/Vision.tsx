import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Camera,
  Cloud,
  DatabaseZap,
  Building2,
  Eye,
  ImageOff,
  Loader2,
  Package,
  RefreshCcw,
  ScanSearch,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { fetchServer } from '../../utils/supabase/client';
import { cn } from '../../components/ui/utils';

interface VisionRun {
  id: string;
  executed_at: string;
  captured_at?: string | null;
  source?: string | null;
  camera_url?: string | null;
  image_local_path?: string | null;
  image_storage_path?: string | null;
  file_size?: number | null;
  quality_status?: string | null;
  dataset_eligible?: boolean | null;
  dataset_class?: string | null;
  brightness_mean?: number | null;
  contrast_stddev?: number | null;
  sharpness_score?: number | null;
  summary_json?: Record<string, any> | null;
  raw_result_json?: Record<string, any> | null;
  dataset_classification_json?: Record<string, any> | null;
  preview_url?: string | null;
  storage_bucket?: string | null;
  preview_error?: string | null;
}

interface VisionDetection {
  label: string;
  confidence: number | null;
  bbox: [number, number, number, number];
}

type RemoteStatus = 'ok' | 'failed' | 'pending';
type VisionTone = 'ok' | 'warning' | 'critical' | 'neutral';

const QUALITY_STATUS_LABELS: Record<string, string> = {
  valid: 'Valida',
  too_dark: 'Escura demais',
  too_bright: 'Clara demais',
  too_blurry: 'Desfocada',
  low_resolution: 'Baixa resolucao',
  invalid_image: 'Imagem invalida',
};

const QUALITY_STATUS_CLASSNAMES: Record<string, string> = {
  valid: 'vision-pill--valid',
  too_dark: 'vision-pill--neutral',
  too_bright: 'vision-pill--warning',
  too_blurry: 'vision-pill--warning',
  low_resolution: 'vision-pill--warning',
  invalid_image: 'vision-pill--critical',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return format(parsed, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

function formatMetric(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(digits);
}

function getQualityLabel(status?: string | null) {
  if (!status) return 'Sem analise';
  return QUALITY_STATUS_LABELS[status] || status;
}

function getQualityBadgeClassName(status?: string | null) {
  if (!status) return 'vision-pill--neutral';
  return QUALITY_STATUS_CLASSNAMES[status] || 'vision-pill--neutral';
}

function getRemotePersistence(run?: VisionRun | null) {
  const remote = run?.raw_result_json?.remote_persistence;
  return {
    remotePersisted: Boolean(remote?.remote_persisted),
    storageUploaded: Boolean(remote?.storage_uploaded),
    dbRecordCreated: Boolean(remote?.db_record_created),
    retryManifestPath: remote?.retry_manifest_path || null,
    error: remote?.error || null,
    details: remote || null,
  };
}

function getRemoteStatus(run?: VisionRun | null): RemoteStatus {
  const remote = run?.raw_result_json?.remote_persistence;
  if (!remote) return 'pending';
  if (remote.remote_persisted) return 'ok';
  if (remote.storage_uploaded || remote.db_record_created || remote.error) return 'failed';
  return 'pending';
}

function getRemoteStatusLabel(status: RemoteStatus) {
  if (status === 'ok') return 'Persistencia OK';
  if (status === 'failed') return 'Falha remota';
  return 'Pendente';
}

function getRemoteStatusClassName(status: RemoteStatus) {
  if (status === 'ok') return 'vision-pill--valid';
  if (status === 'failed') return 'vision-pill--critical';
  return 'vision-pill--warning';
}

function getVisionDetections(run?: VisionRun | null): VisionDetection[] {
  const candidates = [
    run?.raw_result_json?.detections,
    run?.summary_json?.detections,
    run?.raw_result_json?.summary?.detections,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    return candidate
      .map((item) => {
        const bbox = Array.isArray(item?.bbox) ? item.bbox.map((value: unknown) => Number(value)) : [];
        if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) {
          return null;
        }

        const [rawX1, rawY1, rawX2, rawY2] = bbox;
        const x1 = Math.min(rawX1, rawX2);
        const y1 = Math.min(rawY1, rawY2);
        const x2 = Math.max(rawX1, rawX2);
        const y2 = Math.max(rawY1, rawY2);

        if (x2 <= x1 || y2 <= y1) {
          return null;
        }

        const confidenceRaw = Number(item?.confidence ?? item?.score ?? item?.conf ?? NaN);
        return {
          label: String(item?.label || item?.class_name || item?.class || 'bloco'),
          confidence: Number.isFinite(confidenceRaw) ? confidenceRaw : null,
          bbox: [x1, y1, x2, y2] as [number, number, number, number],
        };
      })
      .filter((item): item is VisionDetection => Boolean(item));
  }

  return [];
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

  return getVisionDetections(run).length;
}

function formatConfidencePercent(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const numericValue = Number(value);
  const percent = numericValue <= 1 ? numericValue * 100 : numericValue;
  return `${Math.round(percent)}%`;
}

function getConfidencePercentValue(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const numericValue = Number(value);
  return numericValue <= 1 ? numericValue * 100 : numericValue;
}

function buildVisionQuery(filters: { qualityStatus: string; remoteStatus: string; days: string; limit?: number }) {
  const params = new URLSearchParams();

  if (filters.qualityStatus !== 'all') {
    params.set('quality_status', filters.qualityStatus);
  }

  if (filters.remoteStatus !== 'all') {
    params.set('remote_status', filters.remoteStatus);
  }

  if (filters.days !== 'all') {
    params.set('days', filters.days);
  }

  params.set('limit', String(filters.limit || 20));
  return params.toString();
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-[#1A1A1A]">{title}</h3>
      <pre className="max-h-72 overflow-auto rounded-xl border bg-[#F8F6F2] p-4 text-xs leading-5 text-[#1A1A1A]/80 whitespace-pre-wrap break-all">
        {JSON.stringify(value ?? {}, null, 2)}
      </pre>
    </div>
  );
}

function getVisionQualityHeadline(status?: string | null) {
  switch (status) {
    case 'valid':
      return 'Excelente';
    case 'too_blurry':
      return 'Atenção';
    case 'too_dark':
    case 'too_bright':
      return 'Instável';
    default:
      return 'Em revisão';
  }
}

function getRunCaptureLabel(run?: VisionRun | null) {
  if (!run) return 'Captura não selecionada';
  const source = run.source || run.camera_url || 'vision-pipeline';
  return source;
}

function getRunRoomLabel(run?: VisionRun | null) {
  const room =
    run?.summary_json?.sala ||
    run?.summary_json?.room ||
    run?.raw_result_json?.sala ||
    run?.raw_result_json?.room ||
    null;
  return room ? String(room) : 'Sala não informada';
}

function getRunLotLabel(run?: VisionRun | null) {
  const lot =
    run?.summary_json?.codigo_lote ||
    run?.summary_json?.lote_codigo ||
    run?.summary_json?.lote ||
    run?.raw_result_json?.codigo_lote ||
    run?.raw_result_json?.lote_codigo ||
    null;
  return lot ? String(lot) : `Run ${run?.id?.slice(0, 8) || '--'}`;
}

function getAverageDetectionConfidence(detections: VisionDetection[]) {
  const values = detections
    .map((item) => item.confidence)
    .filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));

  if (!values.length) return null;
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return formatConfidencePercent(avg);
}

function getAverageDetectionConfidenceValue(detections: VisionDetection[]) {
  const values = detections
    .map((item) => getConfidencePercentValue(item.confidence))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRunAverageConfidenceValue(run: VisionRun | null | undefined, detections: VisionDetection[]) {
  const explicitCandidates = [
    run?.summary_json?.confianca_media_blocos,
    run?.summary_json?.confianca_media,
    run?.raw_result_json?.summary?.confianca_media_blocos,
    run?.raw_result_json?.summary?.confianca_media,
    run?.raw_result_json?.confianca_media_blocos,
    run?.raw_result_json?.confianca_media,
  ];

  for (const candidate of explicitCandidates) {
    const normalized = getConfidencePercentValue(Number(candidate));
    if (normalized !== null) return normalized;
  }

  return getAverageDetectionConfidenceValue(detections);
}

function getRunExpectedBlocks(run?: VisionRun | null) {
  const candidates = [
    run?.summary_json?.quantidade_esperada,
    run?.summary_json?.expected_blocks,
    run?.summary_json?.expected_block_count,
    run?.raw_result_json?.summary?.quantidade_esperada,
    run?.raw_result_json?.summary?.expected_blocks,
    run?.raw_result_json?.summary?.expected_block_count,
    run?.raw_result_json?.quantidade_esperada,
    run?.raw_result_json?.expected_blocks,
  ];

  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) {
      return Math.max(0, Math.round(numeric));
    }
  }

  return null;
}

function getRelativeDateTime(value?: string | null) {
  if (!value) return 'Sem horário';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return formatDistanceToNowStrict(parsed, { addSuffix: true, locale: ptBR });
}

function formatDetectionLabel(label?: string | null) {
  const normalized = String(label || 'Bloco').trim();
  if (!normalized) return 'Bloco';
  if (normalized.toLowerCase() === 'bloco' || normalized.toLowerCase() === 'block') return 'Bloco';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getDetectionTone(confidence?: number | null): VisionTone {
  const percent = getConfidencePercentValue(confidence);
  if (percent === null) return 'warning';
  if (percent >= 85) return 'ok';
  if (percent >= 70) return 'warning';
  return 'critical';
}

function getDifferenceTone(difference: number | null, expected: number | null): VisionTone {
  if (difference === null || expected === null) return 'neutral';
  const ratio = expected > 0 ? Math.abs(difference) / expected : Math.abs(difference);
  if (ratio >= 0.2) return 'critical';
  if (ratio >= 0.08) return 'warning';
  return 'ok';
}

function getDifferenceLabel(detected: number, expected: number | null) {
  if (expected === null) {
    return {
      value: 'Sem referência',
      meta: 'Lote sem base comparável nesta captura.',
      tone: 'neutral' as VisionTone,
    };
  }

  const difference = detected - expected;
  if (difference === 0) {
    return {
      value: 'Dentro do esperado',
      meta: `Esperado ${expected} bloco(s).`,
      tone: 'ok' as VisionTone,
    };
  }

  const direction = difference > 0 ? 'acima' : 'abaixo';
  return {
    value: `${Math.abs(difference)} ${direction}`,
    meta: `Esperado ${expected} bloco(s).`,
    tone: getDifferenceTone(difference, expected),
  };
}

function getVisionOverallStatus({
  qualityStatus,
  confidence,
  difference,
  expected,
}: {
  qualityStatus?: string | null;
  confidence: number | null;
  difference: number | null;
  expected: number | null;
}) {
  let severity = 0;

  if (qualityStatus === 'invalid_image') severity = Math.max(severity, 2);
  if (qualityStatus === 'too_blurry' || qualityStatus === 'low_resolution') severity = Math.max(severity, 1);
  if (qualityStatus === 'too_dark' || qualityStatus === 'too_bright') severity = Math.max(severity, 1);

  if (confidence !== null) {
    if (confidence < 70) severity = Math.max(severity, 2);
    else if (confidence < 85) severity = Math.max(severity, 1);
  }

  const differenceTone = getDifferenceTone(difference, expected);
  if (differenceTone === 'critical') severity = Math.max(severity, 2);
  if (differenceTone === 'warning') severity = Math.max(severity, 1);

  if (severity === 2) {
    return {
      tone: 'critical' as VisionTone,
      label: 'Crítico',
      summary: 'Imagem ou contagem pedem revisão manual antes de usar a captura como referência.',
    };
  }

  if (severity === 1) {
    return {
      tone: 'warning' as VisionTone,
      label: 'Atenção',
      summary: 'A captura é utilizável, mas há sinais visuais para validar antes da decisão operacional.',
    };
  }

  return {
    tone: 'ok' as VisionTone,
    label: 'OK',
    summary: 'Leitura estável, com confiança consistente e pronta para acompanhamento operacional.',
  };
}

function getVisionRecommendations({
  qualityStatus,
  confidence,
  difference,
  expected,
  detected,
  remoteStatus,
}: {
  qualityStatus?: string | null;
  confidence: number | null;
  difference: number | null;
  expected: number | null;
  detected: number;
  remoteStatus: RemoteStatus;
}) {
  const recommendations: Array<{ title: string; impact: string }> = [];

  if (qualityStatus === 'too_dark' || qualityStatus === 'too_bright') {
    recommendations.push({
      title: 'Ajustar iluminação da captura',
      impact: 'Melhora leitura do modelo e reduz ruído nas próximas análises.',
    });
  }

  if (qualityStatus === 'too_blurry' || qualityStatus === 'low_resolution') {
    recommendations.push({
      title: 'Revisar foco e enquadramento da câmera',
      impact: 'Aumenta nitidez das boxes e reduz falso positivo em nova rodada.',
    });
  }

  if (difference !== null && expected !== null && Math.abs(difference) > 0) {
    recommendations.push({
      title: difference < 0 ? 'Revisar possível subcontagem' : 'Validar excesso de blocos detectados',
      impact: `${Math.abs(difference)} bloco(s) ${difference < 0 ? 'abaixo' : 'acima'} do esperado para este lote.`,
    });
  }

  if (confidence !== null && confidence < 80) {
    recommendations.push({
      title: 'Validar manualmente regiões com baixa confiança',
      impact: 'Evita decisão operacional baseada em detecções frágeis.',
    });
  }

  if (remoteStatus !== 'ok') {
    recommendations.push({
      title: 'Confirmar persistência da rodada',
      impact: 'Garante histórico íntegro e rastreabilidade da captura selecionada.',
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: 'Manter captura como referência operacional',
      impact: `${detected} bloco(s) com leitura estável e pronta para comparação futura.`,
    });
  }

  return recommendations.slice(0, 2);
}

export function Vision() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<VisionRun | null>(null);
  const [recentRuns, setRecentRuns] = useState<VisionRun[]>([]);
  const [qualityStatusFilter, setQualityStatusFilter] = useState('all');
  const [remoteStatusFilter, setRemoteStatusFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState('7');
  const [selectedRun, setSelectedRun] = useState<VisionRun | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [showDetectionOverlay, setShowDetectionOverlay] = useState(true);
  const [featuredImageSize, setFeaturedImageSize] = useState<{ width: number; height: number } | null>(null);
  const [detailImageSize, setDetailImageSize] = useState<{ width: number; height: number } | null>(null);
  const [featuredImageLoading, setFeaturedImageLoading] = useState(false);
  const [detailImageLoading, setDetailImageLoading] = useState(false);
  const selectedRunId = searchParams.get('run');

  const loadVisionData = useCallback(async (withRefreshing = false) => {
    try {
      setError(null);
      if (withRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const query = buildVisionQuery({
        qualityStatus: qualityStatusFilter,
        remoteStatus: remoteStatusFilter,
        days: daysFilter,
        limit: 20,
      });

      const [latestResponse, runsResponse] = await Promise.all([
        fetchServer('/vision/runs/latest'),
        fetchServer(`/vision/runs?${query}`),
      ]);

      setLatestRun(latestResponse?.run || null);
      setRecentRuns(runsResponse?.runs || []);
    } catch (err: any) {
      console.error('Erro ao carregar dashboard vision:', err);
      setError(err?.message || 'Erro ao carregar dados do pipeline vision');
      setLatestRun(null);
      setRecentRuns([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [daysFilter, qualityStatusFilter, remoteStatusFilter]);

  useEffect(() => {
    void loadVisionData();
  }, [loadVisionData]);

  const updateSelectedRunQuery = useCallback((runId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (runId) {
      nextParams.set('run', runId);
    } else {
      nextParams.delete('run');
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openRunDetails = useCallback((runId: string) => {
    if (!runId || runId === selectedRunId) return;
    updateSelectedRunQuery(runId);
  }, [selectedRunId, updateSelectedRunQuery]);

  useEffect(() => {
    if (!selectedRunId) {
      setSelectedRun(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSelectedRun() {
      try {
        setDetailsLoading(true);
        setDetailsError(null);
        const response = await fetchServer(`/vision/runs/${selectedRunId}`);
        if (!cancelled) {
          setSelectedRun(response?.run || null);
          console.debug('[vision] run selected', {
            run_id: selectedRunId,
            executed_at: response?.run?.executed_at || null,
            captured_at: response?.run?.captured_at || null,
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Erro ao carregar detalhe da captura vision:', err);
          setDetailsError(err?.message || 'Erro ao carregar detalhes da captura');
          setSelectedRun(null);
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    }

    void loadSelectedRun();

    return () => {
      cancelled = true;
    };
  }, [selectedRunId]);

  useEffect(() => {
    setShowDetectionOverlay(true);
  }, [selectedRunId]);

  const selectedRunDetections = useMemo(() => getVisionDetections(selectedRun), [selectedRun]);
  const selectedRunDetectedBlocks = useMemo(() => getDetectedBlocksCount(selectedRun), [selectedRun]);
  const featuredRun = selectedRun || latestRun;
  const featuredRemote = useMemo(() => getRemotePersistence(featuredRun), [featuredRun]);
  const featuredRemoteStatus = useMemo(() => getRemoteStatus(featuredRun), [featuredRun]);
  const featuredDetections = useMemo(() => getVisionDetections(featuredRun), [featuredRun]);
  const featuredDetectedBlocks = useMemo(() => getDetectedBlocksCount(featuredRun), [featuredRun]);
  const featuredConfidence = useMemo(() => getRunAverageConfidenceValue(featuredRun, featuredDetections), [featuredDetections, featuredRun]);
  const featuredConfidenceLabel = useMemo(() => formatConfidencePercent(featuredConfidence), [featuredConfidence]);
  const featuredRunLabel = selectedRun ? 'Captura selecionada' : 'Última captura processada';
  const featuredExpectedBlocks = useMemo(() => getRunExpectedBlocks(featuredRun), [featuredRun]);
  const featuredDifference = featuredExpectedBlocks !== null ? featuredDetectedBlocks - featuredExpectedBlocks : null;
  const featuredDifferenceInfo = useMemo(
    () => getDifferenceLabel(featuredDetectedBlocks, featuredExpectedBlocks),
    [featuredDetectedBlocks, featuredExpectedBlocks],
  );
  const featuredStatus = useMemo(
    () => getVisionOverallStatus({
      qualityStatus: featuredRun?.quality_status,
      confidence: featuredConfidence,
      difference: featuredDifference,
      expected: featuredExpectedBlocks,
    }),
    [featuredConfidence, featuredDifference, featuredExpectedBlocks, featuredRun?.quality_status],
  );
  const featuredRecommendations = useMemo(
    () => getVisionRecommendations({
      qualityStatus: featuredRun?.quality_status,
      confidence: featuredConfidence,
      difference: featuredDifference,
      expected: featuredExpectedBlocks,
      detected: featuredDetectedBlocks,
      remoteStatus: featuredRemoteStatus,
    }),
    [featuredConfidence, featuredDetectedBlocks, featuredDifference, featuredExpectedBlocks, featuredRemoteStatus, featuredRun?.quality_status],
  );
  const featuredAnalysisRelative = useMemo(
    () => getRelativeDateTime(featuredRun?.captured_at || featuredRun?.executed_at),
    [featuredRun?.captured_at, featuredRun?.executed_at],
  );
  const featuredAnalysisTimestamp = useMemo(
    () => formatDateTime(featuredRun?.captured_at || featuredRun?.executed_at),
    [featuredRun?.captured_at, featuredRun?.executed_at],
  );

  useEffect(() => {
    setFeaturedImageSize(null);
    setFeaturedImageLoading(Boolean(featuredRun?.preview_url));
  }, [featuredRun?.id, featuredRun?.preview_url]);

  useEffect(() => {
    setDetailImageSize(null);
    setDetailImageLoading(Boolean(selectedRun?.preview_url));
  }, [selectedRun?.id, selectedRun?.preview_url]);

  if (loading) {
    return (
      <div className="vision-page">
        <div className="vision-shell vision-shell--loading">
          <div className="vision-main">
            <section className="vision-skeleton vision-skeleton--hero" />
            <section className="vision-summary-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="vision-skeleton vision-skeleton--card" />
              ))}
            </section>
            <section className="vision-skeleton vision-skeleton--analysis" />
            <section className="vision-capture-layout">
              <div className="vision-skeleton vision-skeleton--image" />
              <div className="vision-skeleton vision-skeleton--aside" />
            </section>
          </div>
          <aside className="vision-aside">
            <div className="vision-skeleton vision-skeleton--history" />
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="vision-page">
      <div className="vision-shell">
        <div className="vision-main">
          <header className="vision-header">
            <div>
              <div className="vision-header__eyebrow">
                <span className="vision-pill vision-pill--soft">Análise concluída</span>
                <span className="vision-header__meta">Capture ID: #{featuredRun?.id?.slice(0, 8) || 'VIS-0000'}</span>
              </div>
              <h1 className="vision-title">Monitoramento de Visão</h1>
              <div className="vision-meta-row">
                <span className="vision-chip">
                  <Camera size={14} />
                  {getRunCaptureLabel(featuredRun)}
                </span>
                <span className="vision-chip">
                  <Building2 size={14} />
                  {getRunRoomLabel(featuredRun)}
                </span>
                <span className="vision-chip">
                  <Package size={14} />
                  {getRunLotLabel(featuredRun)}
                </span>
              </div>
            </div>

            <div className="vision-header__actions">
              <Button type="button" variant="outline" onClick={() => void loadVisionData(true)} disabled={refreshing} className="vision-action vision-action--secondary">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Recalibrar
              </Button>
              {featuredRun ? (
                <Button type="button" onClick={() => void openRunDetails(featuredRun.id)} className="vision-action vision-action--primary">
                  <Eye className="h-4 w-4" />
                  Abrir captura
                </Button>
              ) : null}
            </div>
          </header>

          <section className="vision-filters">
            <Select value={qualityStatusFilter} onValueChange={setQualityStatusFilter}>
              <SelectTrigger className="vision-select">
                <SelectValue placeholder="Status de qualidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualidade: todas</SelectItem>
                <SelectItem value="valid">Válida</SelectItem>
                <SelectItem value="too_dark">Escura demais</SelectItem>
                <SelectItem value="too_bright">Clara demais</SelectItem>
                <SelectItem value="too_blurry">Desfocada</SelectItem>
                <SelectItem value="low_resolution">Baixa resolução</SelectItem>
                <SelectItem value="invalid_image">Imagem inválida</SelectItem>
              </SelectContent>
            </Select>

            <Select value={remoteStatusFilter} onValueChange={setRemoteStatusFilter}>
              <SelectTrigger className="vision-select">
                <SelectValue placeholder="Persistência remota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Persistência: todas</SelectItem>
                <SelectItem value="ok">Persistência OK</SelectItem>
                <SelectItem value="failed">Falha remota</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
              </SelectContent>
            </Select>

            <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger className="vision-select vision-select--compact">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Último dia</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Sem corte</SelectItem>
              </SelectContent>
            </Select>
          </section>

          {latestRun ? (
            <section className={cn('vision-status-card', `vision-status-card--${featuredStatus.tone}`)}>
              <div className="vision-status-card__main">
                <div className="vision-status-card__eyebrow">
                  <span className={cn('vision-status-card__dot', `vision-status-card__dot--${featuredStatus.tone}`)} />
                  Status geral da análise
                </div>
                <div className="vision-status-card__headline">
                  <strong>{featuredStatus.label}</strong>
                  <span>{featuredStatus.summary}</span>
                </div>
              </div>
              <div className="vision-status-card__meta">
                <span>{getQualityLabel(featuredRun?.quality_status)}</span>
                <span>{featuredConfidenceLabel || 'Sem confiança'}</span>
                <span>{featuredExpectedBlocks !== null ? `Esperado ${featuredExpectedBlocks}` : 'Sem referência'}</span>
              </div>
            </section>
          ) : null}

          {error ? (
            <section className="vision-inline-alert">
              <div className="vision-inline-alert__content">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="vision-inline-alert__title">Erro ao carregar dados do vision</p>
                  <p className="vision-inline-alert__copy">{error}</p>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => void loadVisionData(true)}>Tentar novamente</Button>
            </section>
          ) : null}

          {!latestRun ? (
            <section className="vision-empty">
              <ScanSearch className="h-10 w-10 text-[#546A4A]/60" />
              <div>
                <p className="vision-empty__title">Nenhuma captura vision encontrada</p>
                <p className="vision-empty__copy">
                  Rode o pipeline local e confirme que os registros estão sendo persistidos na tabela <code>vision_pipeline_runs</code>.
                </p>
              </div>
            </section>
          ) : (
            <>
              <section className="vision-summary-grid">
                <article className="vision-summary-card">
                  <p className="vision-summary-card__label">Blocos detectados</p>
                  <p className="vision-summary-card__value">{featuredDetectedBlocks}</p>
                  <p className="vision-summary-card__meta">
                    {featuredExpectedBlocks !== null ? `Base esperada: ${featuredExpectedBlocks} bloco(s)` : 'Sem base comparável vinculada'}
                  </p>
                </article>
                <article className={cn('vision-summary-card', `vision-summary-card--${featuredDifferenceInfo.tone}`)}>
                  <p className="vision-summary-card__label">Diferença vs esperado</p>
                  <p className="vision-summary-card__value">{featuredDifferenceInfo.value}</p>
                  <p className="vision-summary-card__meta">{featuredDifferenceInfo.meta}</p>
                </article>
                <article className={cn('vision-summary-card', `vision-summary-card--${featuredStatus.tone}`)}>
                  <p className="vision-summary-card__label">Status geral</p>
                  <p className="vision-summary-card__value">{featuredStatus.label}</p>
                  <p className="vision-summary-card__meta">
                    {featuredConfidenceLabel ? `Confiança média ${featuredConfidenceLabel}` : 'Sem confiança média calculada'}
                  </p>
                </article>
                <article className="vision-summary-card">
                  <p className="vision-summary-card__label">Última análise</p>
                  <p className="vision-summary-card__value vision-summary-card__value--tertiary">{featuredAnalysisRelative}</p>
                  <p className="vision-summary-card__meta">{featuredAnalysisTimestamp}</p>
                </article>
              </section>

              <section className="vision-analysis-card">
                <div className="vision-analysis-card__header">
                  <div className="vision-analysis-card__icon">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="vision-analysis-card__title">Conclusões da Análise</h2>
                    <p className="vision-analysis-card__meta">
                      Model: vision-pipeline • Processado em {formatDateTime(featuredRun?.executed_at)}
                    </p>
                  </div>
                </div>

                <div className="vision-analysis-columns">
                  <div className="vision-analysis-column">
                    <div className="vision-analysis-column__eyebrow">
                      <span className="vision-analysis-column__dot vision-analysis-column__dot--primary" />
                      Desenvolvimento de frutos
                    </div>
                    <p className="vision-analysis-column__copy">
                      Detectamos <strong>{featuredDetectedBlocks} bloco(s)</strong> com confiança média de <strong>{featuredConfidenceLabel || 'N/D'}</strong>.
                      {featuredDetections.length
                        ? ' A distribuição das detecções está pronta para revisão visual com overlay.'
                        : ' Esta captura não retornou detecções válidas nesta rodada.'}
                    </p>
                  </div>

                  <div className="vision-analysis-column">
                    <div className="vision-analysis-column__eyebrow">
                      <span className="vision-analysis-column__dot vision-analysis-column__dot--tertiary" />
                      Alertas e anomalias
                    </div>
                    <p className="vision-analysis-column__copy">
                      {featuredRun?.preview_error
                        ? `Preview indisponível: ${featuredRun.preview_error}`
                        : featuredRemote.error
                          ? `Persistência remota com alerta: ${featuredRemote.error}`
                          : `Qualidade classificada como ${getQualityLabel(featuredRun?.quality_status)} e status remoto ${getRemoteStatusLabel(featuredRemoteStatus).toLowerCase()}.`}
                    </p>
                  </div>

                  <div className="vision-analysis-column">
                    <div className="vision-analysis-column__eyebrow">
                      <span className="vision-analysis-column__dot vision-analysis-column__dot--soft" />
                      Otimização de colheita
                    </div>
                    <p className="vision-analysis-column__copy">
                      Dataset classificado como <strong>{featuredRun?.dataset_class || '-'}</strong>.
                      {featuredRemote.remotePersisted
                        ? ' Captura pronta para consulta operacional e histórico.'
                        : ' Revisar persistência antes de considerar esta captura como referência oficial.'}
                    </p>
                  </div>
                </div>
              </section>

              <section className="vision-capture-layout">
                <div>
                  <p className="vision-section-label">{featuredRunLabel}</p>
                  <div className="vision-capture-card">
                    <div className="vision-capture-toolbar">
                      <div className="vision-capture-pills">
                        <span className="vision-pill vision-pill--soft">
                          {featuredDetectedBlocks} bloco{featuredDetectedBlocks === 1 ? '' : 's'}
                        </span>
                        <span className={cn('vision-pill', getQualityBadgeClassName(featuredRun?.quality_status))}>
                          {getQualityLabel(featuredRun?.quality_status)}
                        </span>
                        <span className={cn('vision-pill', getRemoteStatusClassName(featuredRemoteStatus))}>
                          {getRemoteStatusLabel(featuredRemoteStatus)}
                        </span>
                      </div>

                      {featuredDetections.length ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowDetectionOverlay((current) => !current)}
                          className="vision-toggle"
                        >
                          {showDetectionOverlay ? 'Ocultar overlay' : 'Mostrar overlay'}
                        </Button>
                      ) : null}
                    </div>

                    <div className="vision-capture-frame">
                      {featuredImageLoading ? <div className="vision-image-loader" /> : null}
                      {featuredRun?.preview_url ? (
                        <>
                          <img
                            key={featuredRun.id}
                            src={featuredRun.preview_url}
                            alt="Preview da captura vision"
                            className={cn('vision-capture-image', featuredImageLoading && 'is-loading')}
                            onLoad={(event) => {
                              const target = event.currentTarget;
                              setFeaturedImageSize({
                                width: target.naturalWidth,
                                height: target.naturalHeight,
                              });
                              setFeaturedImageLoading(false);
                            }}
                            onError={() => {
                              setFeaturedImageLoading(false);
                            }}
                          />

                          {showDetectionOverlay && featuredImageSize && featuredDetections.length ? (
                            <div className="vision-overlay">
                              {featuredDetections.map((detection, index) => {
                                const [x1, y1, x2, y2] = detection.bbox;
                                const left = Math.max(0, Math.min(100, (x1 / featuredImageSize.width) * 100));
                                const top = Math.max(0, Math.min(100, (y1 / featuredImageSize.height) * 100));
                                const width = Math.max(0, Math.min(100, ((x2 - x1) / featuredImageSize.width) * 100));
                                const height = Math.max(0, Math.min(100, ((y2 - y1) / featuredImageSize.height) * 100));
                                const confidenceLabel = formatConfidencePercent(detection.confidence);
                                const overlayTone = getDetectionTone(detection.confidence);

                                return (
                                  <div
                                    key={`${detection.label}-${index}`}
                                    className={cn('vision-overlay__box', `vision-overlay__box--${overlayTone}`)}
                                    title={`${formatDetectionLabel(detection.label)}${confidenceLabel ? ` • ${confidenceLabel}` : ''}`}
                                    style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                                  >
                                    <span className="vision-overlay__label">
                                      {formatDetectionLabel(detection.label)}
                                      {confidenceLabel ? ` • ${confidenceLabel}` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="vision-capture-empty">
                          <ImageOff className="h-8 w-8" />
                          <p>Preview indisponível</p>
                          {featuredRun?.preview_error ? <p className="vision-capture-empty__error">{featuredRun.preview_error}</p> : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <aside className="vision-context-card">
                  <div className="vision-context-card__header">
                    <div className="vision-context-card__icon">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="vision-context-card__title">Assistente Contextual</h3>
                      <p className="vision-context-card__subtitle">{getRunLotLabel(featuredRun)}</p>
                    </div>
                  </div>
                  <div className="vision-context-card__list">
                    {featuredRecommendations.map((recommendation) => (
                      <div key={recommendation.title} className="vision-context-card__item">
                        <p className="vision-context-card__item-title">{recommendation.title}</p>
                        <p className="vision-context-card__item-impact">{recommendation.impact}</p>
                      </div>
                    ))}
                  </div>
                  <div className="vision-context-card__footer">
                    <button type="button" className="vision-context-card__button">
                      Aplicar ajuste
                    </button>
                    <button type="button" className="vision-context-card__action" onClick={() => featuredRun && openRunDetails(featuredRun.id)}>
                      <DatabaseZap className="h-4 w-4" />
                      Abrir em tela cheia
                    </button>
                  </div>
                </aside>
              </section>
            </>
          )}
        </div>

        <aside className="vision-aside">
          <div className="vision-history-card">
            <div className="vision-history-card__header">
              <div>
                <h2 className="vision-history-card__title">Histórico de Capturas</h2>
                <p className="vision-history-card__copy">{recentRuns.length} registro(s) para revisão operacional.</p>
              </div>
            </div>

            {recentRuns.length === 0 ? (
              <div className="vision-history-card__empty">Nenhuma captura encontrada para os filtros selecionados.</div>
            ) : (
              <div className="vision-history-list">
                {recentRuns.map((run) => {
                  const remoteStatus = getRemoteStatus(run);
                  const detectedBlocks = getDetectedBlocksCount(run);

                  return (
                    <button
                      key={run.id}
                      type="button"
                      className={cn('vision-history-item', selectedRunId === run.id && 'is-active')}
                      onClick={() => void openRunDetails(run.id)}
                    >
                    <div className="vision-history-item__thumb">
                        {run.preview_url ? (
                          <img src={run.preview_url} alt={`Captura ${run.id}`} className="vision-history-item__image" />
                        ) : (
                          <ImageOff className="h-5 w-5 text-[#9ba092]" />
                        )}
                      </div>

                      <div className="vision-history-item__body">
                        <div className="vision-history-item__top">
                          <span className="vision-history-item__time">{formatDateTime(run.executed_at)}</span>
                          <span className={cn('vision-pill', getQualityBadgeClassName(run.quality_status))}>
                            {getQualityLabel(run.quality_status)}
                          </span>
                        </div>
                        <p className="vision-history-item__title">{getRunLotLabel(run)}</p>
                        <p className="vision-history-item__meta">
                          <Package size={13} />
                          {detectedBlocks > 0 ? `${detectedBlocks} blocos` : '-- blocos'}
                        </p>
                        <p className="vision-history-item__meta">
                          <Cloud size={13} />
                          {getRemoteStatusLabel(remoteStatus)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(selectedRunId)} onOpenChange={(open) => {
        if (!open) {
          setSelectedRun(null);
          setDetailsError(null);
          setDetailsLoading(false);
          updateSelectedRunQuery(null);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalhes da captura vision</DialogTitle>
            <DialogDescription>
              Revisao operacional completa da execucao selecionada.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="flex min-h-[240px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#546A4A]" />
            </div>
          ) : detailsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {detailsError}
            </div>
          ) : selectedRun ? (
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="overflow-hidden rounded-2xl border bg-[#F8F6F2]">
                  {selectedRun.preview_url ? (
                    <div className="space-y-4 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-[#D9C89A] bg-[#FFF8EC] text-[#8F7742]">
                            {selectedRunDetectedBlocks} bloco{selectedRunDetectedBlocks === 1 ? '' : 's'} detectado{selectedRunDetectedBlocks === 1 ? '' : 's'}
                          </Badge>
                          {selectedRunDetections.length ? (
                            <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                              Overlay {showDetectionOverlay ? 'ativo' : 'oculto'}
                            </Badge>
                          ) : null}
                        </div>

                        {selectedRunDetections.length ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDetectionOverlay((current) => !current)}
                          >
                            {showDetectionOverlay ? 'Ocultar overlay' : 'Mostrar overlay'}
                          </Button>
                        ) : null}
                      </div>

                      <div className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded-2xl border border-[#E8E0D2] bg-black/5">
                        {detailImageLoading ? <div className="vision-image-loader" /> : null}
                        <img
                          src={selectedRun.preview_url}
                          alt="Preview da captura vision selecionada"
                          className={cn('block h-auto w-full transition-opacity duration-300', detailImageLoading && 'opacity-0')}
                          onLoad={(event) => {
                            const target = event.currentTarget;
                            setDetailImageSize({
                              width: target.naturalWidth,
                              height: target.naturalHeight,
                            });
                            setDetailImageLoading(false);
                          }}
                          onError={() => {
                            setDetailImageLoading(false);
                          }}
                        />

                        {showDetectionOverlay && detailImageSize && selectedRunDetections.length ? (
                          <div className="pointer-events-none absolute inset-0">
                            {selectedRunDetections.map((detection, index) => {
                              const [x1, y1, x2, y2] = detection.bbox;
                              const left = Math.max(0, Math.min(100, (x1 / detailImageSize.width) * 100));
                              const top = Math.max(0, Math.min(100, (y1 / detailImageSize.height) * 100));
                              const width = Math.max(0, Math.min(100, ((x2 - x1) / detailImageSize.width) * 100));
                              const height = Math.max(0, Math.min(100, ((y2 - y1) / detailImageSize.height) * 100));
                              const confidenceLabel = formatConfidencePercent(detection.confidence);
                              const overlayTone = getDetectionTone(detection.confidence);

                              return (
                                <div
                                  key={`${detection.label}-${index}`}
                                  className={cn('vision-overlay__box', `vision-overlay__box--${overlayTone}`)}
                                  style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                  }}
                                >
                                  <div className="vision-overlay__label">
                                    {formatDetectionLabel(detection.label)}
                                    {confidenceLabel ? ` • ${confidenceLabel}` : ''}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>

                      <p className="text-sm text-[#1A1A1A]/65">
                        {selectedRunDetections.length
                          ? 'Overlay das detecções do modelo sobre a captura original, para conferir posição e contagem com confiança visual.'
                          : 'Esta execução não retornou blocos detectados para desenhar overlay.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-[#1A1A1A]/45">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <ImageOff className="h-8 w-8" />
                        <p className="text-sm">Preview indisponivel</p>
                        {selectedRun.preview_error ? (
                          <p className="max-w-[260px] text-xs text-red-600">{selectedRun.preview_error}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-2xl border bg-white p-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">executed_at</p>
                    <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatDateTime(selectedRun.executed_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">captured_at</p>
                    <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatDateTime(selectedRun.captured_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">source</p>
                    <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{selectedRun.source || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">quality_status</p>
                    <Badge variant="outline" className={cn('mt-1 border', getQualityBadgeClassName(selectedRun.quality_status))}>
                      {getQualityLabel(selectedRun.quality_status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">dataset_class</p>
                    <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{selectedRun.dataset_class || '-'}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">brightness_mean</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatMetric(selectedRun.brightness_mean)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">contrast_stddev</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatMetric(selectedRun.contrast_stddev)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">sharpness_score</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatMetric(selectedRun.sharpness_score)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Badge variant="outline" className={selectedRun.dataset_eligible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700'}>
                      dataset_eligible: {selectedRun.dataset_eligible ? 'true' : 'false'}
                    </Badge>
                    <Badge variant="outline" className="border-[#D9C89A] bg-[#FFF8EC] text-[#8F7742]">
                      blocos_detectados: {selectedRunDetectedBlocks}
                    </Badge>
                    <Badge variant="outline" className={getRemotePersistence(selectedRun).remotePersisted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
                      remote_persisted: {getRemotePersistence(selectedRun).remotePersisted ? 'true' : 'false'}
                    </Badge>
                    <Badge variant="outline" className={getRemotePersistence(selectedRun).storageUploaded ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      storage_uploaded: {getRemotePersistence(selectedRun).storageUploaded ? 'true' : 'false'}
                    </Badge>
                    <Badge variant="outline" className={getRemotePersistence(selectedRun).dbRecordCreated ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      db_record_created: {getRemotePersistence(selectedRun).dbRecordCreated ? 'true' : 'false'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-6">
                <JsonBlock title="quality_check" value={selectedRun.raw_result_json?.quality_check} />
                <JsonBlock title="summary" value={selectedRun.summary_json} />
                <JsonBlock title="dataset_classification" value={selectedRun.dataset_classification_json || selectedRun.raw_result_json?.dataset_classification} />
                <JsonBlock title="remote_persistence" value={selectedRun.raw_result_json?.remote_persistence} />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[#1A1A1A]/60">
              Nenhum detalhe carregado.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
