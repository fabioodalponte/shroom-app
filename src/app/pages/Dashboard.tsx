import { useEffect, useState } from 'react';
import { TrendingUp, Package, AlertTriangle, ShoppingCart, DollarSign, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { fetchServer } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { format, isToday, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Dashboard() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    lotesAtivos: 0,
    colheitasHoje: 0,
    estoqueTotal: 0,
    pedidosPendentes: 0,
    receitaMes: 0,
  });
  const [lotes, setLotes] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);

      // Buscar lotes ativos
      const { lotes: lotesData } = await fetchServer('/lotes');
      setLotes(lotesData || []);

      const lotesAtivos = lotesData?.filter(l => l.status === 'Em Cultivo' || l.status === 'Pronto').length || 0;

      // Buscar colheitas de hoje
      const { colheitas } = await fetchServer('/colheitas');
      const colheitasHoje = colheitas?.filter(c => isToday(new Date(c.data_colheita))).length || 0;

      // Buscar estoque
      const { estoque } = await fetchServer('/estoque');
      const estoqueTotal = estoque?.reduce((sum, e) => sum + parseFloat(e.quantidade_kg || 0), 0) || 0;

      // Buscar pedidos pendentes
      const { pedidos } = await fetchServer('/pedidos');
      const pedidosPendentes = pedidos?.filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado').length || 0;

      // Buscar receita do mês
      const { transacoes } = await fetchServer('/financeiro');
      const inicioMes = startOfMonth(new Date());
      const receitaMes = transacoes
        ?.filter(t => t.tipo === 'Receita' && new Date(t.data_transacao) >= inicioMes)
        .reduce((sum, t) => sum + parseFloat(t.valor || 0), 0) || 0;

      setStats({
        lotesAtivos,
        colheitasHoje,
        estoqueTotal: Math.round(estoqueTotal * 10) / 10,
        pedidosPendentes,
        receitaMes,
      });

      // Gerar alertas
      const newAlerts = [];
      lotesData?.forEach(lote => {
        if (lote.temperatura_atual && lote.produto?.temperatura_ideal_min) {
          if (lote.temperatura_atual < lote.produto.temperatura_ideal_min) {
            newAlerts.push({
              severity: 'critical',
              message: `${lote.codigo_lote}: Temperatura baixa (${lote.temperatura_atual}°C)`
            });
          }
          if (lote.temperatura_atual > lote.produto.temperatura_ideal_max) {
            newAlerts.push({
              severity: 'critical',
              message: `${lote.codigo_lote}: Temperatura alta (${lote.temperatura_atual}°C)`
            });
          }
        }
        if (lote.umidade_atual && lote.produto?.umidade_ideal_min) {
          if (lote.umidade_atual < lote.produto.umidade_ideal_min) {
            newAlerts.push({
              severity: 'warning',
              message: `${lote.codigo_lote}: Umidade baixa (${lote.umidade_atual}%)`
            });
          }
        }
      });

      if (estoqueTotal < 50) {
        newAlerts.push({
          severity: 'warning',
          message: 'Estoque total abaixo de 50kg'
        });
      }

      setAlerts(newAlerts);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      // Set empty data instead of failing completely
      setStats({
        lotesAtivos: 0,
        colheitasHoje: 0,
        estoqueTotal: 0,
        pedidosPendentes: 0,
        receitaMes: 0,
      });
      setLotes([]);
      setAlerts([{
        severity: 'critical',
        message: 'Erro ao carregar dados do dashboard. Verifique sua conexão.'
      }]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const statsCards = [
    { 
      label: 'Lotes Ativos', 
      value: stats.lotesAtivos.toString(), 
      change: `${stats.lotesAtivos} em produção`, 
      trend: 'up',
      icon: Package 
    },
    { 
      label: 'Colheitas Hoje', 
      value: stats.colheitasHoje.toString(), 
      change: 'Registradas hoje', 
      trend: 'up',
      icon: TrendingUp 
    },
    { 
      label: 'Estoque Atual', 
      value: `${stats.estoqueTotal}kg`, 
      change: 'Disponível', 
      trend: stats.estoqueTotal < 50 ? 'alert' : 'up',
      icon: Package 
    },
    { 
      label: 'Pedidos Ativos', 
      value: stats.pedidosPendentes.toString(), 
      change: 'Em andamento', 
      trend: stats.pedidosPendentes > 10 ? 'alert' : 'up',
      icon: ShoppingCart 
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Dashboard
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Olá, {usuario?.nome} • {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm opacity-70">{stat.label}</CardTitle>
                <Icon className={`w-4 h-4 ${
                  stat.trend === 'alert' ? 'text-red-500' : 'text-[#546A4A]'
                }`} />
              </CardHeader>
              <CardContent>
                <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
                  {stat.value}
                </div>
                <p className={`text-xs mt-1 ${
                  stat.trend === 'up' ? 'text-green-600' : 
                  stat.trend === 'down' ? 'text-orange-600' : 
                  'text-red-600'
                }`}>
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Receita do Mês */}
      <Card className="border-l-4 border-l-emerald-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            Receita do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700 }}>
            R$ {stats.receitaMes.toFixed(2)}
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {format(new Date(), 'MMMM yyyy', { locale: ptBR })}
          </p>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Alertas Ativos ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  alert.severity === 'critical' 
                    ? 'bg-red-50 border border-red-200' 
                    : 'bg-yellow-50 border border-yellow-200'
                }`}
              >
                <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                  alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm ${
                    alert.severity === 'critical' ? 'text-red-900' : 'text-yellow-900'
                  }`}>
                    {alert.message}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Lotes Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Lotes em Produção</CardTitle>
        </CardHeader>
        <CardContent>
          {lotes.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum lote em produção</p>
          ) : (
            <div className="space-y-3">
              {lotes.slice(0, 5).map((lote) => (
                <div
                  key={lote.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold">{lote.codigo_lote}</h4>
                    <p className="text-sm text-gray-600">
                      {lote.produto?.nome} • {lote.sala}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    {lote.temperatura_atual && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Temp</p>
                        <p className="text-sm font-medium">{lote.temperatura_atual}°C</p>
                      </div>
                    )}
                    {lote.umidade_atual && (
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Umidade</p>
                        <p className="text-sm font-medium">{lote.umidade_atual}%</p>
                      </div>
                    )}
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      lote.status === 'Em Cultivo' ? 'bg-blue-100 text-blue-700' :
                      lote.status === 'Pronto' ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {lote.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
