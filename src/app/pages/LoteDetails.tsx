import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Thermometer, Droplets, Wind, Calendar, Package, QrCode, Camera, TrendingUp, Printer, Play, Pause, Download, Info, Scissors, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useState, useEffect, useRef } from 'react';
import { useCreateColheita } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';
import QRCode from 'qrcode';
import { ImageWithFallback } from '../../components/figma/ImageWithFallback';
import { fetchServer } from '../../utils/supabase/client';

interface LoteMonitoramento {
  id: string;
  codigo_lote?: string;
  sala?: string;
  sensor_atual: {
    temperatura: number;
    umidade: number;
    co2: number;
    luminosidade_lux?: number;
  };
  historico: Array<{
    timestamp: string;
    temperatura: number;
    umidade: number;
    co2: number;
  }>;
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

function formatRange(min?: number | null, max?: number | null, suffix = '') {
  if (min === null || min === undefined || max === null || max === undefined) return 'N/D';
  return `${min}-${max}${suffix}`;
}

function formatDateShort(value?: string | null) {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('pt-BR');
}

function formatDateLong(value?: string | null) {
  if (!value) return 'N/D';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/D';
  return date.toLocaleDateString('pt-BR', { dateStyle: 'long' });
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

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function LoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [lote, setLote] = useState<LoteData | null>(null);
  const [monitoramento, setMonitoramento] = useState<LoteMonitoramento | null>(null);
  const [isColheitaOpen, setIsColheitaOpen] = useState(false);
  const [isTimelapseOpen, setIsTimelapseOpen] = useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timelapseFrames, setTimelapseFrames] = useState<TimeLapseFrame[]>([]);
  const [timelapseLoading, setTimelapseLoading] = useState(false);
  const [timelapseError, setTimelapseError] = useState<string | null>(null);
  const [timelapseMatchStrategy, setTimelapseMatchStrategy] = useState<string | null>(null);
  const [timelapseEmptyReason, setTimelapseEmptyReason] = useState<string | null>(null);
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
        const [loteResult, sensoresResult] = await Promise.all([
          fetchServer(`/lotes/${id}`),
          fetchServer('/sensores/latest?hours=24'),
        ]);

        const loteData = (loteResult?.lote || null) as LoteData | null;
        const sensores = (sensoresResult?.sensores || []) as LoteMonitoramento[];
        const monitoramentoDoLote =
          sensores.find((item) => item.id === id) ||
          sensores.find((item) => normalizeText(item.codigo_lote) === normalizeText(loteData?.codigo_lote)) ||
          sensores.find((item) => normalizeText(item.sala) === normalizeText(loteData?.sala));

        setLote(loteData);
        setMonitoramento(monitoramentoDoLote || null);
      } catch (error) {
        console.error('Erro ao carregar detalhes do lote:', error);
        toast.error('Erro ao carregar detalhes do lote.');
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [id]);

  const diasCultivo = lote?.data_inicio
    ? Math.max(0, Math.floor((Date.now() - new Date(lote.data_inicio).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const temperaturaAtual = monitoramento?.sensor_atual?.temperatura ?? lote?.temperatura_atual ?? null;
  const umidadeAtual = monitoramento?.sensor_atual?.umidade ?? lote?.umidade_atual ?? null;
  const co2Atual = monitoramento?.sensor_atual?.co2 ?? null;
  const temperaturaIdeal = formatRange(lote?.produto?.temperatura_ideal_min, lote?.produto?.temperatura_ideal_max, '°C');
  const umidadeIdeal = formatRange(lote?.produto?.umidade_ideal_min, lote?.produto?.umidade_ideal_max, '%');
  const co2Ideal = lote?.produto?.perfil_cultivo?.co2_ideal_max ? `<${Math.round(lote.produto.perfil_cultivo.co2_ideal_max)} ppm` : 'N/D';
  const previsaoPrincipal = lote?.data_prevista_fim_incubacao
    ? { titulo: 'Fim incubação previsto', valor: formatDateShort(lote.data_prevista_fim_incubacao), subtitulo: 'Próximo marco operacional' }
    : lote?.data_previsao_colheita
      ? { titulo: 'Colheita prevista', valor: formatDateShort(lote.data_previsao_colheita), subtitulo: 'Planejamento do lote' }
      : lote?.produto?.tempo_cultivo_dias
        ? { titulo: 'Ciclo estimado', valor: `~${lote.produto.tempo_cultivo_dias} dias`, subtitulo: 'Referência do produto' }
        : { titulo: 'Previsão do lote', valor: 'N/D', subtitulo: 'Sem previsão registrada' };

  const tempData = (monitoramento?.historico || []).map((item, index) => ({
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    temperatura: item.temperatura,
    ordem: index + 1,
  }));

  const humidityData = (monitoramento?.historico || []).map((item, index) => ({
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    umidade: item.umidade,
    ordem: index + 1,
  }));

  const co2Data = (monitoramento?.historico || []).map((item, index) => ({
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
      setTimelapseMatchStrategy(result?.match_strategy || null);
      setTimelapseEmptyReason(result?.empty_reason || null);
      setTimelapseIndex(0);
    } catch (error) {
      console.error('Erro ao carregar time-lapse do lote:', error);
      setTimelapseFrames([]);
      setTimelapseMatchStrategy(null);
      setTimelapseEmptyReason(null);
      setTimelapseError(error instanceof Error ? error.message : 'Não foi possível carregar o time-lapse.');
    } finally {
      setTimelapseLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (timelapseInterval.current) {
        clearInterval(timelapseInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isTimelapseOpen && timelapseInterval.current) {
      clearInterval(timelapseInterval.current);
      setIsPlaying(false);
    }
  }, [isTimelapseOpen]);

  useEffect(() => {
    if (isTimelapseOpen) {
      void loadTimeLapse();
    }
  }, [id, isTimelapseOpen]);

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
    if (timelapseFrames.length <= 1) return;

    if (isPlaying) {
      clearInterval(timelapseInterval.current!);
      setIsPlaying(false);
    } else {
      timelapseInterval.current = setInterval(() => {
        setTimelapseIndex(prev => (prev + 1) % timelapseFrames.length);
      }, 1000);
      setIsPlaying(true);
    }
  };

  const currentTimelapseFrame = timelapseFrames[timelapseIndex] || null;
  const currentTimelapseTimestamp = currentTimelapseFrame?.captured_at || currentTimelapseFrame?.executed_at || null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/lotes')}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
                {lote.codigo_lote}
              </h1>
              <Badge className="bg-[#546A4A] text-white">
                {formatFaseLabel(lote.fase_operacional || lote.fase_atual)}
              </Badge>
            </div>
            <p className="text-[#1A1A1A] opacity-70">
              {lote.produto?.variedade ? `${lote.produto?.nome} • ${lote.produto.variedade}` : lote.produto?.nome || 'Produto não definido'} • {diasCultivo} dias de cultivo
            </p>
          </div>
        </div>
        <Button className="bg-[#A88F52] hover:bg-[#8F7742] flex items-center gap-2">
          <QrCode size={20} />
          Ver QR Code
        </Button>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Temperatura</CardTitle>
            <Thermometer className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {temperaturaAtual !== null && temperaturaAtual !== undefined ? `${temperaturaAtual.toFixed(1)}°C` : 'N/D'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Temperatura atual</p>
            <p className="text-xs text-green-600 mt-1">Ideal: {temperaturaIdeal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Umidade</CardTitle>
            <Droplets className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {umidadeAtual !== null && umidadeAtual !== undefined ? `${umidadeAtual.toFixed(0)}%` : 'N/D'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Umidade atual</p>
            <p className="text-xs text-green-600 mt-1">Ideal: {umidadeIdeal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">CO₂</CardTitle>
            <Wind className="w-4 h-4 text-[#1A1A1A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {co2Atual !== null && co2Atual !== undefined ? Math.round(co2Atual).toString() : 'N/D'}
            </div>
            <p className="text-xs text-gray-500 mt-1">CO₂ atual</p>
            <p className="text-xs text-green-600 mt-1">Limite ideal: {co2Ideal}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">{previsaoPrincipal.titulo}</CardTitle>
            <TrendingUp className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {previsaoPrincipal.valor}
            </div>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">{previsaoPrincipal.subtitulo}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Temperatura</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="temperatura" stroke="#A88F52" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            {tempData.length === 0 && (
              <p className="text-sm text-gray-500 mt-3">
                Sem histórico de temperatura disponível. Esse gráfico usa as mesmas leituras reais vinculadas ao lote na tela Segurança.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Umidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={humidityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="umidade" stroke="#546A4A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            {humidityData.length === 0 && (
              <p className="text-sm text-gray-500 mt-3">
                Sem histórico de umidade disponível. Esse gráfico usa as mesmas leituras reais vinculadas ao lote na tela Segurança.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de CO₂</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={co2Data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="label" />
                <YAxis label={{ value: 'ppm', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="co2" stroke="#7C3AED" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            {co2Data.length === 0 && (
              <p className="text-sm text-gray-500 mt-3">
                Sem histórico de CO₂ disponível. Esse gráfico usa as mesmas leituras reais vinculadas ao lote na tela Segurança.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {!historicoDisponivel && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            Não foi encontrado histórico de sensores vinculado diretamente a este lote nas últimas 24 horas.
            O detalhe tenta localizar o monitoramento por <strong>ID do lote</strong>, depois por <strong>código do lote</strong> e por fim por <strong>sala</strong>.
          </CardContent>
        </Card>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Detalhes do Lote</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Data de Inoculação</p>
              <p className="text-sm">{formatDateLong(lote.data_inoculacao || lote.data_inicio)}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Dias de Cultivo</p>
              <p className="text-sm">{diasCultivo} dias</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Observações</p>
              <p className="text-sm">{lote.observacoes || 'Não informadas'}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Localização</p>
              <p className="text-sm">{[lote.sala, lote.prateleira].filter(Boolean).join(' • ') || 'Não informada'}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Variedade</p>
              <p className="text-sm">{lote.produto?.variedade || lote.produto?.nome || 'Não informada'}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Status</p>
              <Badge className="bg-green-500 text-white">{formatFaseLabel(lote.fase_operacional || lote.fase_atual || lote.status)}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-[#1A1A1A] text-white">
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              onClick={() => setIsColheitaOpen(true)}
              className="w-full bg-[#A88F52] hover:bg-[#8F7742] flex items-center gap-2"
            >
              <Package size={20} />
              Registrar Colheita
            </Button>
            <Button 
              onClick={() => setIsTimelapseOpen(true)}
              variant="outline" 
              className="w-full border-white text-white hover:bg-white/10 flex items-center gap-2"
            >
              <Camera size={20} />
              Time-lapse
            </Button>
            <Button 
              onClick={() => setIsQRCodeOpen(true)}
              variant="outline" 
              className="w-full border-white text-white hover:bg-white/10 flex items-center gap-2"
            >
              <QrCode size={20} />
              Imprimir QR Code
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Linha do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {timeline.map((event, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className={`w-3 h-3 rounded-full mt-1 ${
                  event.type === 'ready' ? 'bg-green-500' :
                  event.type === 'milestone' ? 'bg-[#A88F52]' :
                  'bg-[#546A4A]'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={14} className="text-[#1A1A1A] opacity-50" />
                    <p className="text-sm text-[#1A1A1A] opacity-70">
                      {new Date(event.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm">{event.event}</p>
                </div>
              </div>
            ))}
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
      <Dialog open={isTimelapseOpen} onOpenChange={setIsTimelapseOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#A88F52]" />
              Time-lapse do Lote {lote.codigo_lote}
            </DialogTitle>
            <DialogDescription>
              Visualize a evolução do lote através das capturas reais persistidas pelo módulo vision.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {timelapseLoading ? (
              <div className="flex h-80 items-center justify-center rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando capturas reais do lote...
                </div>
              </div>
            ) : currentTimelapseFrame?.preview_url ? (
              <div className="relative w-full h-80 bg-gray-100 rounded-lg overflow-hidden">
                <ImageWithFallback
                  src={currentTimelapseFrame.preview_url}
                  alt={`Time-lapse ${timelapseIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 space-y-2">
                  <p className="text-white text-sm">
                    {currentTimelapseTimestamp
                      ? new Date(currentTimelapseTimestamp).toLocaleString('pt-BR')
                      : 'Captura sem timestamp'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {currentTimelapseFrame.quality_status && (
                      <Badge className="bg-white/90 text-[#1A1A1A] hover:bg-white/90">
                        Qualidade: {currentTimelapseFrame.quality_status}
                      </Badge>
                    )}
                    {currentTimelapseFrame.dataset_class && (
                      <Badge className="bg-white/90 text-[#1A1A1A] hover:bg-white/90">
                        Dataset: {currentTimelapseFrame.dataset_class}
                      </Badge>
                    )}
                    <Badge className="bg-white/90 text-[#1A1A1A] hover:bg-white/90">
                      Blocos detectados: {currentTimelapseFrame.blocos_detectados}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed bg-gray-50 px-6 text-center space-y-3">
                <Camera className="h-8 w-8 text-gray-400" />
                <div className="space-y-1">
                  <p className="font-medium text-gray-700">Nenhuma captura real disponível para este lote.</p>
                  <p className="text-sm text-gray-500">
                    {timelapseError ||
                      timelapseEmptyReason ||
                      'O time-lapse tenta vincular capturas por lote_id e, em fallback, por câmera da mesma sala dentro do período do lote.'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTimelapseIndex(Math.max(0, timelapseIndex - 1))}
                  disabled={timelapseLoading || timelapseFrames.length === 0 || timelapseIndex === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  className="bg-[#A88F52] hover:bg-[#8F7742]"
                  onClick={handleTimelapsePlay}
                  disabled={timelapseLoading || timelapseFrames.length <= 1}
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
                  onClick={() => setTimelapseIndex(Math.min(timelapseFrames.length - 1, timelapseIndex + 1))}
                  disabled={timelapseLoading || timelapseFrames.length === 0 || timelapseIndex === timelapseFrames.length - 1}
                >
                  Próximo
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                {timelapseFrames.length ? `${timelapseIndex + 1} de ${timelapseFrames.length}` : '0 de 0'}
              </p>
            </div>

            <div className="flex gap-1">
              {timelapseFrames.map((frame, index) => (
                <button
                  key={frame.id || index}
                  onClick={() => setTimelapseIndex(index)}
                  className={`flex-1 h-2 rounded-full transition-colors ${
                    index === timelapseIndex ? 'bg-[#A88F52]' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5" />
              <p className="text-sm text-blue-800">
                {timelapseFrames.length
                  ? `Sequência cronológica de ${timelapseFrames.length} captura(s) reais, vinculadas por ${
                      timelapseMatchStrategy === 'lote_id'
                        ? 'lote_id'
                        : timelapseMatchStrategy === 'single_camera_fallback'
                          ? 'câmera ativa única do ambiente'
                          : 'câmera da mesma sala no período do lote'
                    }.`
                  : 'Quando houver capturas reais do módulo vision associadas ao lote, elas aparecerão aqui em ordem cronológica.'}
              </p>
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
