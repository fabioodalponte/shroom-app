import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Eye,
  ImageOff,
  Loader2,
  Moon,
  RefreshCcw,
  ScanSearch,
  Sun,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
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

const QUALITY_STATUS_LABELS: Record<string, string> = {
  valid: 'Valida',
  too_dark: 'Escura demais',
  too_bright: 'Clara demais',
  too_blurry: 'Desfocada',
  low_resolution: 'Baixa resolucao',
  invalid_image: 'Imagem invalida',
};

const QUALITY_STATUS_CLASSNAMES: Record<string, string> = {
  valid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  too_dark: 'border-slate-200 bg-slate-100 text-slate-700',
  too_bright: 'border-amber-200 bg-amber-50 text-amber-700',
  too_blurry: 'border-violet-200 bg-violet-50 text-violet-700',
  low_resolution: 'border-orange-200 bg-orange-50 text-orange-700',
  invalid_image: 'border-red-200 bg-red-50 text-red-700',
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
  if (!status) return 'border-slate-200 bg-slate-100 text-slate-700';
  return QUALITY_STATUS_CLASSNAMES[status] || 'border-slate-200 bg-slate-100 text-slate-700';
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
  if (status === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
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

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-[0.16em] text-[#1A1A1A]/45">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-[#1A1A1A]">{value}</p>
        {helper ? <p className="mt-1 text-xs text-[#1A1A1A]/55">{helper}</p> : null}
      </CardContent>
    </Card>
  );
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
  const [selectedImageSize, setSelectedImageSize] = useState<{ width: number; height: number } | null>(null);
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
    setSelectedImageSize(null);
    setShowDetectionOverlay(true);
  }, [selectedRunId]);

  const latestRemote = useMemo(() => getRemotePersistence(latestRun), [latestRun]);
  const latestRemoteStatus = useMemo(() => getRemoteStatus(latestRun), [latestRun]);
  const selectedRunDetections = useMemo(() => getVisionDetections(selectedRun), [selectedRun]);
  const selectedRunDetectedBlocks = useMemo(() => getDetectedBlocksCount(selectedRun), [selectedRun]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#546A4A]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-['Cormorant_Garamond'] text-4xl font-bold text-[#1A1A1A] lg:text-[42px]">
            Vision Ops
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[#1A1A1A]/70 sm:text-base">
            Observabilidade operacional das capturas da ESP32-CAM, qualidade de imagem, classificacao de dataset e persistencia remota.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
          <Select value={qualityStatusFilter} onValueChange={setQualityStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue placeholder="Status de qualidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualidade: todas</SelectItem>
              <SelectItem value="valid">Valida</SelectItem>
              <SelectItem value="too_dark">Escura demais</SelectItem>
              <SelectItem value="too_bright">Clara demais</SelectItem>
              <SelectItem value="too_blurry">Desfocada</SelectItem>
              <SelectItem value="low_resolution">Baixa resolucao</SelectItem>
              <SelectItem value="invalid_image">Imagem invalida</SelectItem>
            </SelectContent>
          </Select>

          <Select value={remoteStatusFilter} onValueChange={setRemoteStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white">
              <SelectValue placeholder="Persistencia remota" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Persistencia: todas</SelectItem>
              <SelectItem value="ok">Persistencia OK</SelectItem>
              <SelectItem value="failed">Falha remota</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>

          <Select value={daysFilter} onValueChange={setDaysFilter}>
            <SelectTrigger className="w-full sm:w-[160px] bg-white">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Ultimo dia</SelectItem>
              <SelectItem value="7">Ultimos 7 dias</SelectItem>
              <SelectItem value="30">Ultimos 30 dias</SelectItem>
              <SelectItem value="all">Sem corte</SelectItem>
            </SelectContent>
          </Select>

          <Button type="button" variant="outline" onClick={() => void loadVisionData(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-700">Erro ao carregar dados do vision</p>
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => void loadVisionData(true)}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!latestRun ? (
        <Card>
          <CardContent className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
            <ScanSearch className="h-10 w-10 text-[#546A4A]/60" />
            <div>
              <p className="text-lg font-semibold text-[#1A1A1A]">Nenhuma captura vision encontrada</p>
              <p className="mt-1 text-sm text-[#1A1A1A]/65">
                Rode o pipeline local e confirme que os registros estao sendo persistidos na tabela <code>vision_pipeline_runs</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-3 border-b bg-white/70 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl text-[#1A1A1A]">
                  <Eye className="h-5 w-5 text-[#546A4A]" />
                  Ultima captura processada
                </CardTitle>
                <p className="mt-1 text-sm text-[#1A1A1A]/65">
                  Executada em {formatDateTime(latestRun.executed_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn('border', getQualityBadgeClassName(latestRun.quality_status))}>
                  {getQualityLabel(latestRun.quality_status)}
                </Badge>
                <Badge variant="outline" className={cn('border', getRemoteStatusClassName(latestRemoteStatus))}>
                  {getRemoteStatusLabel(latestRemoteStatus)}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="overflow-hidden rounded-2xl border bg-[#F8F6F2]">
                {latestRun.preview_url ? (
                  <img
                    src={latestRun.preview_url}
                    alt="Ultima captura do pipeline vision"
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-[#1A1A1A]/45">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <ImageOff className="h-8 w-8" />
                      <p className="text-sm">Preview indisponivel no Storage</p>
                      {latestRun.preview_error ? (
                        <p className="max-w-[260px] text-xs text-red-600">{latestRun.preview_error}</p>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <MetricCard label="Capturada em" value={formatDateTime(latestRun.captured_at)} />
                  <MetricCard label="Origem" value={latestRun.source || '-'} />
                  <MetricCard label="Dataset" value={latestRun.dataset_class || '-'} helper={latestRun.dataset_eligible ? 'Apta para dataset' : 'Nao apta para dataset'} />
                  <MetricCard label="Arquivo" value={latestRun.file_size ? `${Math.round((latestRun.file_size / 1024) * 10) / 10} KB` : '-'} helper={latestRun.storage_bucket ? `Bucket: ${latestRun.storage_bucket}` : undefined} />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Brilho" value={formatMetric(latestRun.brightness_mean)} helper="mean" />
                  <MetricCard label="Contraste" value={formatMetric(latestRun.contrast_stddev)} helper="stddev" />
                  <MetricCard label="Nitidez" value={formatMetric(latestRun.sharpness_score)} helper="score" />
                </div>

                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[#1A1A1A]/45">Persistencia remota</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className={latestRemote.remotePersisted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}>
                      <Cloud className="mr-1 h-3 w-3" />
                      remote_persisted: {latestRemote.remotePersisted ? 'true' : 'false'}
                    </Badge>
                    <Badge variant="outline" className={latestRemote.storageUploaded ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      <Database className="mr-1 h-3 w-3" />
                      storage_uploaded: {latestRemote.storageUploaded ? 'true' : 'false'}
                    </Badge>
                    <Badge variant="outline" className={latestRemote.dbRecordCreated ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      db_record_created: {latestRemote.dbRecordCreated ? 'true' : 'false'}
                    </Badge>
                  </div>
                  {latestRemote.error ? (
                    <p className="mt-3 text-sm text-red-600">{latestRemote.error}</p>
                  ) : null}
                </div>

                <Button type="button" className="w-full sm:w-auto" onClick={() => void openRunDetails(latestRun.id)}>
                  Ver detalhes completos
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[#1A1A1A]/70">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">Qualidade</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-[#1A1A1A]">{getQualityLabel(latestRun.quality_status)}</p>
                <p className="mt-2 text-sm text-[#1A1A1A]/65">
                  dataset_eligible: {latestRun.dataset_eligible ? 'true' : 'false'}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#546A4A]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[#1A1A1A]/70">
                  <ScanSearch className="h-4 w-4 text-[#546A4A]" />
                  <span className="text-sm font-medium">Classificacao de dataset</span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-[#1A1A1A]">{latestRun.dataset_class || '-'}</p>
                <p className="mt-2 text-sm text-[#1A1A1A]/65">Base para organizacao do dataset local e revisao operacional.</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-[#1A1A1A]/70">
                  {latestRun.quality_status === 'too_dark' ? <Moon className="h-4 w-4 text-amber-600" /> : <Sun className="h-4 w-4 text-amber-600" />}
                  <span className="text-sm font-medium">Leitura rapida</span>
                </div>
                <p className="mt-3 text-sm text-[#1A1A1A]/70">
                  Ultima captura em {formatDateTime(latestRun.executed_at)} com qualidade <strong>{getQualityLabel(latestRun.quality_status)}</strong>.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl text-[#1A1A1A]">Capturas recentes</CardTitle>
            <p className="text-sm text-[#1A1A1A]/65">Lista operacional das ultimas execucoes do pipeline vision.</p>
          </div>
          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
            {recentRuns.length} registros
          </Badge>
        </CardHeader>

        <CardContent className="space-y-3 p-4 sm:p-6">
          {recentRuns.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-[#1A1A1A]/60">
              Nenhuma captura encontrada para os filtros selecionados.
            </div>
          ) : (
            recentRuns.map((run) => {
              const remoteStatus = getRemoteStatus(run);
              return (
                <div
                  key={run.id}
                  className="flex flex-col gap-4 rounded-2xl border bg-white p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 xl:items-center xl:gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">Timestamp</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{formatDateTime(run.executed_at)}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">Qualidade</p>
                      <Badge variant="outline" className={cn('mt-1 border', getQualityBadgeClassName(run.quality_status))}>
                        {getQualityLabel(run.quality_status)}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">Dataset</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">{run.dataset_class || '-'}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">Persistencia</p>
                      <Badge variant="outline" className={cn('mt-1 border', getRemoteStatusClassName(remoteStatus))}>
                        {getRemoteStatusLabel(remoteStatus)}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] text-[#1A1A1A]/45">Brilho / Nitidez</p>
                      <p className="mt-1 text-sm font-medium text-[#1A1A1A]">
                        {formatMetric(run.brightness_mean)} / {formatMetric(run.sharpness_score)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button type="button" variant="outline" onClick={() => void openRunDetails(run.id)}>
                      Abrir detalhes
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

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
                        <img
                          src={selectedRun.preview_url}
                          alt="Preview da captura vision selecionada"
                          className="block h-auto w-full"
                          onLoad={(event) => {
                            const target = event.currentTarget;
                            setSelectedImageSize({
                              width: target.naturalWidth,
                              height: target.naturalHeight,
                            });
                          }}
                        />

                        {showDetectionOverlay && selectedImageSize && selectedRunDetections.length ? (
                          <div className="pointer-events-none absolute inset-0">
                            {selectedRunDetections.map((detection, index) => {
                              const [x1, y1, x2, y2] = detection.bbox;
                              const left = Math.max(0, Math.min(100, (x1 / selectedImageSize.width) * 100));
                              const top = Math.max(0, Math.min(100, (y1 / selectedImageSize.height) * 100));
                              const width = Math.max(0, Math.min(100, ((x2 - x1) / selectedImageSize.width) * 100));
                              const height = Math.max(0, Math.min(100, ((y2 - y1) / selectedImageSize.height) * 100));
                              const confidenceLabel = formatConfidencePercent(detection.confidence);

                              return (
                                <div
                                  key={`${detection.label}-${index}`}
                                  className="absolute rounded-md border-2 border-[#A88F52] bg-[#A88F52]/10 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                                  style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    width: `${width}%`,
                                    height: `${height}%`,
                                  }}
                                >
                                  <div className="absolute left-0 top-0 rounded-br-md bg-[#A88F52] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-white">
                                    {detection.label}
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
