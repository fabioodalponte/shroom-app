import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Thermometer, Droplets, Wind, Calendar, Package, QrCode, Camera, TrendingUp, Printer, Play, Pause, Download, Info, Scissors } from 'lucide-react';
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

export function LoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isColheitaOpen, setIsColheitaOpen] = useState(false);
  const [isTimelapseOpen, setIsTimelapseOpen] = useState(false);
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [timelapseIndex, setTimelapseIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const timelapseInterval = useRef<NodeJS.Timeout | null>(null);
  
  const [formData, setFormData] = useState({
    lote_id: id || '',
    quantidade_kg: 0,
    qualidade: 'Premium',
    observacoes: ''
  });

  const { post: createColheita, loading: creating } = useCreateColheita();

  // Time-lapse images
  const timelapseImages = [
    {
      url: 'https://images.unsplash.com/photo-1735282260417-cb781d757604?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNocm9vbSUyMGZhcm0lMjBteWNlbGl1bXxlbnwxfHx8fDE3NjQ4MDE2MjJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      day: 0,
      stage: 'Inoculação'
    },
    {
      url: 'https://images.unsplash.com/photo-1693296654707-4ca9c808f703?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNocm9vbSUyMGdyb3dpbmclMjB0aW1lbGFwc2V8ZW58MXx8fHwxNzY0ODAxNjIyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      day: 7,
      stage: 'Micélio Crescendo'
    },
    {
      url: 'https://images.unsplash.com/photo-1735282260417-cb781d757604?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaGlpdGFrZSUyMG11c2hyb29tJTIwY3VsdGl2YXRpb258ZW58MXx8fHwxNzY0ODAxNjIyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      day: 14,
      stage: 'Primórdios Formando'
    },
    {
      url: 'https://images.unsplash.com/photo-1693296654707-4ca9c808f703?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtdXNocm9vbSUyMGdyb3dpbmclMjBzdGFnZXN8ZW58MXx8fHwxNzY0ODAxNjIzfDA&ixlib=rb-4.1.0&q=80&w=1080',
      day: 18,
      stage: 'Crescimento Ativo'
    },
    {
      url: 'https://images.unsplash.com/photo-1735282260417-cb781d757604?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHNoaWl0YWtlJTIwbXVzaHJvb21zJTIwaGFydmVzdHxlbnwxfHx8fDE3NjQ4MDE2MjN8MA&ixlib=rb-4.1.0&q=80&w=1080',
      day: 21,
      stage: 'Pronto para Colheita'
    }
  ];

  const lote = {
    id: id || 'LT-2024-042',
    variety: 'Shiitake Premium',
    stage: 'Colheita',
    startDate: '2024-11-12',
    substrate: 'Serragem de Carvalho',
    container: 'Sala A - Prateleira 3',
    temp: 18.5,
    humidity: 85,
    co2: 450,
    days: 21,
    status: 'ready',
    expectedYield: '25kg',
    actualYield: null,
  };

  const tempData = [
    { day: 1, value: 24 },
    { day: 5, value: 22 },
    { day: 10, value: 20 },
    { day: 15, value: 19 },
    { day: 20, value: 18.5 },
    { day: 21, value: 18.5 },
  ];

  const humidityData = [
    { day: 1, value: 70 },
    { day: 5, value: 75 },
    { day: 10, value: 80 },
    { day: 15, value: 82 },
    { day: 20, value: 85 },
    { day: 21, value: 85 },
  ];

  const timeline = [
    { date: '2024-11-12', event: 'Inoculação iniciada', type: 'start' },
    { date: '2024-11-19', event: 'Fase de incubação concluída', type: 'milestone' },
    { date: '2024-11-26', event: 'Primórdios visíveis', type: 'milestone' },
    { date: '2024-12-03', event: 'Ponto ideal de colheita', type: 'ready' },
  ];

  useEffect(() => {
    if (isQRCodeOpen) {
      QRCode.toDataURL(`https://example.com/lotes/${id}`)
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    }
  }, [isQRCodeOpen, id]);

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
    if (isPlaying) {
      clearInterval(timelapseInterval.current!);
      setIsPlaying(false);
    } else {
      timelapseInterval.current = setInterval(() => {
        setTimelapseIndex(prev => (prev + 1) % 5);
      }, 1000);
      setIsPlaying(true);
    }
  };

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
                {lote.id}
              </h1>
              <Badge className="bg-[#546A4A] text-white">
                {lote.stage}
              </Badge>
            </div>
            <p className="text-[#1A1A1A] opacity-70">
              {lote.variety} • {lote.days} dias de cultivo
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
              {lote.temp}°C
            </div>
            <p className="text-xs text-green-600 mt-1">Ideal: 18-22°C</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Umidade</CardTitle>
            <Droplets className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {lote.humidity}%
            </div>
            <p className="text-xs text-green-600 mt-1">Ideal: 80-90%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">CO₂</CardTitle>
            <Wind className="w-4 h-4 text-[#1A1A1A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {lote.co2}
            </div>
            <p className="text-xs text-green-600 mt-1">ppm • Normal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Previsão</CardTitle>
            <TrendingUp className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {lote.expectedYield}
            </div>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">Rendimento esperado</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Temperatura</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={tempData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="day" label={{ value: 'Dias', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: '°C', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#A88F52" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
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
                <XAxis dataKey="day" label={{ value: 'Dias', position: 'insideBottom', offset: -5 }} />
                <YAxis label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#546A4A" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

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
              <p className="text-sm">{new Date(lote.startDate).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Dias de Cultivo</p>
              <p className="text-sm">{lote.days} dias</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Substrato</p>
              <p className="text-sm">{lote.substrate}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Localização</p>
              <p className="text-sm">{lote.container}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Variedade</p>
              <p className="text-sm">{lote.variety}</p>
            </div>
            <div>
              <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Status</p>
              <Badge className="bg-green-500 text-white">Pronto para Colheita</Badge>
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
              Time-lapse do Lote {lote.id}
            </DialogTitle>
            <DialogDescription>
              Visualize a evolução do lote através das fotos capturadas durante o cultivo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative w-full h-80 bg-gray-100 rounded-lg overflow-hidden">
              <ImageWithFallback 
                src={timelapseImages[timelapseIndex].url} 
                alt={`Timelapse ${timelapseIndex + 1}`} 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <p className="text-white text-sm">
                  Dia {timelapseImages[timelapseIndex].day} - {timelapseImages[timelapseIndex].stage}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTimelapseIndex(Math.max(0, timelapseIndex - 1))}
                  disabled={timelapseIndex === 0}
                >
                  Anterior
                </Button>
                <Button
                  size="sm"
                  className="bg-[#A88F52] hover:bg-[#8F7742]"
                  onClick={handleTimelapsePlay}
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
                  onClick={() => setTimelapseIndex(Math.min(timelapseImages.length - 1, timelapseIndex + 1))}
                  disabled={timelapseIndex === timelapseImages.length - 1}
                >
                  Próximo
                </Button>
              </div>
              <p className="text-sm text-gray-500">
                {timelapseIndex + 1} de {timelapseImages.length}
              </p>
            </div>

            <div className="flex gap-1">
              {timelapseImages.map((_, index) => (
                <button
                  key={index}
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
                Este time-lapse mostra a evolução do lote durante os {lote.days} dias de cultivo, 
                desde a inoculação até o ponto ideal de colheita.
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
                <span className="font-medium">{lote.id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Variedade:</span>
                <span className="font-medium">{lote.variety}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Data de Inoculação:</span>
                <span className="font-medium">
                  {new Date(lote.startDate).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Localização:</span>
                <span className="font-medium">{lote.container}</span>
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
                  link.download = `QR-${lote.id}.png`;
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