import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
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
  RefreshCcw
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
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    pm25?: number;
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

function hasCameraStream(camera: CameraConfig | null | undefined) {
  return !!camera?.url_stream && camera.url_stream.trim().length > 0;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildCameraImageUrl(url: string, token: number) {
  const trimmed = url.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    parsed.searchParams.set('t', String(token));
    return parsed.toString();
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}t=${token}`;
  }
}

export function Seguranca() {
  const [lotes, setLotes] = useState<LoteMonitoramento[]>([]);
  const [cameras, setCameras] = useState<CameraConfig[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<string>('todos');
  const [periodoHistorico, setPeriodoHistorico] = useState<'24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [cameraSelecionada, setCameraSelecionada] = useState<CameraConfig | null>(null);
  const [cameraFrameToken, setCameraFrameToken] = useState(Date.now());
  const [cameraErroCarregamento, setCameraErroCarregamento] = useState<string | null>(null);
  const [autoAtualizarCamera, setAutoAtualizarCamera] = useState(false);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const hours = periodoHistorico === '24h' ? 24 : 168;
      const [sensoresResult, camerasResult] = await Promise.allSettled([
        fetchServer(`/sensores/latest?hours=${hours}`),
        fetchServer('/cameras'),
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
    } catch (error: any) {
      console.error('Erro ao carregar monitoramento de sensores:', error);
      setErrorMessage(error.message || 'Erro ao carregar sensores');
      setLotes([]);
      setCameras([]);
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
    if (!cameraDialogOpen || !autoAtualizarCamera || !cameraSelecionada?.url_stream) return;

    const timerId = window.setInterval(() => {
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
    const baseComStream = base.filter(hasCameraStream);
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

  const abrirCameraDoLote = useCallback((lote: LoteMonitoramento) => {
    const camera = getCameraForLote(lote);
    setCameraSelecionada(camera);
    setCameraErroCarregamento(null);
    setCameraFrameToken(Date.now());
    setAutoAtualizarCamera(false);
    setCameraDialogOpen(true);
  }, [getCameraForLote]);

  const handleCameraDialogChange = useCallback((open: boolean) => {
    setCameraDialogOpen(open);

    if (!open) {
      setAutoAtualizarCamera(false);
      setCameraErroCarregamento(null);
      setCameraSelecionada(null);
    }
  }, []);

  const lotesFiltrados = loteSelecionado === 'todos' 
    ? lotes 
    : lotes.filter(l => l.id === loteSelecionado);

  // Calcular médias gerais
  const mediaTemp = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.temperatura, 0) / lotes.length : 0;
  const mediaUmid = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.umidade, 0) / lotes.length : 0;
  const mediaCo2 = lotes.length > 0 ? lotes.reduce((acc, l) => acc + l.sensor_atual.co2, 0) / lotes.length : 0;
  const lotesAlerta = lotes.filter(l => l.score_risco >= 70).length;
  const lotesAtencao = lotes.filter(l => l.score_risco >= 30 && l.score_risco < 70).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A4A]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Segurança & Monitoramento
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Sensores IoT em tempo real, câmeras e análise de risco de contaminação
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap items-center">
        <Select value={loteSelecionado} onValueChange={setLoteSelecionado}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um lote" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Lotes</SelectItem>
            {lotes.map(lote => (
              <SelectItem key={lote.id} value={lote.id}>
                {lote.codigo_lote} - {lote.sala}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={periodoHistorico} onValueChange={(v: '24h' | '7d') => setPeriodoHistorico(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24 horas</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={() => void carregarDados()}>
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

	        return (
	          <Card key={lote.id} className={`border-l-4 ${risco.border}`}>
	            <CardHeader>
	              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-2xl font-['Cormorant_Garamond']">{lote.codigo_lote}</span>
                    <Badge variant="outline">{lote.sala}</Badge>
                    <Badge className={`${risco.bg} ${risco.text}`}>
                      {risco.label} ({lote.score_risco}%)
                    </Badge>
                  </CardTitle>
                </div>
	                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => abrirCameraDoLote(lote)}
                    disabled={!cameraLote}
                  >
	                  <Eye className="w-4 h-4 mr-2" />
	                  {cameraLote ? 'Câmera ao Vivo' : 'Sem Câmera'}
	                </Button>
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
	          <p><strong>Persistência:</strong> Leituras gravadas em `leituras_sensores` para histórico e análise</p>
	        </CardContent>
	      </Card>

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
                    src={buildCameraImageUrl(cameraSelecionada.url_stream, cameraFrameToken)}
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
                <Button variant="outline" onClick={() => setCameraFrameToken(Date.now())}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Atualizar frame
                </Button>
                <Button
                  variant={autoAtualizarCamera ? 'default' : 'outline'}
                  onClick={() => setAutoAtualizarCamera((prev) => !prev)}
                >
                  {autoAtualizarCamera ? 'Auto atualização ON (8s)' : 'Auto atualização OFF'}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline">Fechar</Button>
                </DialogClose>
              </div>

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
