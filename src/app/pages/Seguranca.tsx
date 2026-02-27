import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Camera, 
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
  Eye
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
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

export function Seguranca() {
  const [lotes, setLotes] = useState<LoteMonitoramento[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState<string>('todos');
  const [periodoHistorico, setPeriodoHistorico] = useState<'24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);

  // Dados simulados para demonstração (substitua pela API real)
  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = () => {
    // Simular dados de sensores (em produção, vir da API)
    const lotesSimulados: LoteMonitoramento[] = [
      {
        id: '1',
        codigo_lote: 'E1-P1-B1',
        sala: 'Frutificação 01',
        sensor_atual: {
          temperatura: 22.5,
          umidade: 87,
          co2: 980,
          pm25: 12
        },
        historico: gerarHistorico(22.5, 87, 980),
        score_risco: 15,
        alertas: []
      },
      {
        id: '2',
        codigo_lote: 'E1-P2-B2',
        sala: 'Frutificação 02',
        sensor_atual: {
          temperatura: 24.8,
          umidade: 93,
          co2: 1450,
          pm25: 28
        },
        historico: gerarHistorico(24.8, 93, 1450),
        score_risco: 68,
        alertas: [
          'Umidade acima do ideal (>92%)',
          'CO2 subindo rapidamente',
          'Possível contaminação detectada'
        ]
      },
      {
        id: '3',
        codigo_lote: 'E2-P1-B3',
        sala: 'Incubação 01',
        sensor_atual: {
          temperatura: 23.2,
          umidade: 85,
          co2: 1100,
          pm25: 15
        },
        historico: gerarHistorico(23.2, 85, 1100),
        score_risco: 35,
        alertas: [
          'CO2 ligeiramente elevado'
        ]
      }
    ];
    
    setLotes(lotesSimulados);
    setLoading(false);
  };

  // Função auxiliar para gerar histórico simulado
  const gerarHistorico = (tempBase: number, umidBase: number, co2Base: number): SensorData[] => {
    const dados: SensorData[] = [];
    const pontos = periodoHistorico === '24h' ? 24 : 168; // 24 horas ou 7 dias
    
    for (let i = pontos; i >= 0; i--) {
      dados.push({
        timestamp: new Date(Date.now() - i * 3600000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        temperatura: tempBase + (Math.random() - 0.5) * 2,
        umidade: umidBase + (Math.random() - 0.5) * 5,
        co2: co2Base + (Math.random() - 0.5) * 200,
        pm25: 10 + Math.random() * 20,
        pm10: 15 + Math.random() * 30
      });
    }
    
    return dados;
  };

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
          Sensores IoT, câmeras e análise de risco de contaminação
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
      </div>

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
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  Câmera ao Vivo
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
                        />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip />
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
                        />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
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
          <p><strong>AHT10:</strong> Sensor de temperatura e umidade de alta precisão</p>
          <p><strong>BME280:</strong> Sensor barométrico com leitura de temperatura, umidade e pressão</p>
          <p><strong>MH-Z19B (Planejado):</strong> Sensor de CO₂ para detecção precoce de contaminação</p>
          <p><strong>PMS5003 (Fase 2):</strong> Sensor de partículas PM2.5 e PM10 no ar</p>
        </CardContent>
      </Card>

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