import { useEffect, useState } from 'react';
import { MapPin, Truck, Package, Clock, CheckCircle, Plus, Calendar, AlertCircle, Play, XCircle, Users, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs';
import { toast } from 'sonner@2.0.3';
import { 
  useRotas, 
  useMotoristas, 
  useSugestoesRotas, 
  useCreateRota,
  usePedidos
} from '../../hooks/useApi';
import { fetchServer } from '../../utils/supabase/client';
import { format } from 'date-fns';

export function Logistica() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSugestoesOpen, setIsSugestoesOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState('ativas');
  
  const [formData, setFormData] = useState({
    nome: '',
    motorista_id: '',
    data_rota: format(new Date(), 'yyyy-MM-dd'),
    pedidos_ids: [] as string[],
    observacoes: '',
  });

  const { data: rotasData, loading: rotasLoading, fetch: fetchRotas } = useRotas();
  const { data: motoristasData, loading: motoristasLoading, fetch: fetchMotoristas } = useMotoristas();
  const { data: sugestoesData, loading: sugestoesLoading, fetch: fetchSugestoes } = useSugestoesRotas();
  const { data: pedidosData, loading: pedidosLoading, fetch: fetchPedidos } = usePedidos();
  const { post: createRota, loading: creating } = useCreateRota();

  useEffect(() => {
    fetchRotas();
    fetchMotoristas();
    fetchPedidos();
  }, []);

  const rotas = rotasData?.rotas || [];
  const motoristas = motoristasData?.motoristas || [];
  const sugestoes = sugestoesData?.sugestoes || [];
  const pedidos = pedidosData?.pedidos || [];

  // Debug: Log motoristas carregados
  useEffect(() => {
    console.log('📊 Motoristas carregados:', motoristas);
    console.log('📊 Total de motoristas:', motoristas.length);
  }, [motoristas]);

  // Filtrar pedidos prontos para entrega
  const pedidosProntos = pedidos.filter((p: any) => 
    ['Pronto', 'Confirmado'].includes(p.status)
  );

  // Estatísticas
  const rotasAtivas = rotas.filter((r: any) => ['Pendente', 'Em Andamento'].includes(r.status));
  const entregasHoje = rotas.filter((r: any) => 
    format(new Date(r.data_rota), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
  );
  const concluidas = rotas.filter((r: any) => r.status === 'Concluída');

  const handleCreateRota = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.motorista_id || formData.pedidos_ids.length === 0) {
      toast.error('Preencha todos os campos obrigatórios e selecione pelo menos um pedido');
      return;
    }

    try {
      await createRota(formData);
      setIsDialogOpen(false);
      fetchRotas();
      setFormData({
        nome: '',
        motorista_id: '',
        data_rota: format(new Date(), 'yyyy-MM-dd'),
        pedidos_ids: [],
        observacoes: '',
      });
    } catch (error) {
      console.error('Erro ao criar rota:', error);
    }
  };

  const handleIniciarRota = async (rotaId: string) => {
    try {
      await fetchServer(`/rotas/${rotaId}/iniciar`, { method: 'PATCH' });
      toast.success('Rota iniciada com sucesso!');
      fetchRotas();
    } catch (error) {
      console.error('Erro ao iniciar rota:', error);
    }
  };

  const handleFinalizarRota = async (rotaId: string) => {
    try {
      await fetchServer(`/rotas/${rotaId}/finalizar`, { method: 'PATCH' });
      toast.success('Rota finalizada!');
      fetchRotas();
    } catch (error) {
      console.error('Erro ao finalizar rota:', error);
    }
  };

  const handleCancelarRota = async (rotaId: string) => {
    try {
      await fetchServer(`/rotas/${rotaId}/cancelar`, { 
        method: 'PATCH',
        body: JSON.stringify({ motivo: 'Cancelado pelo usuário' })
      });
      toast.success('Rota cancelada');
      fetchRotas();
    } catch (error) {
      console.error('Erro ao cancelar rota:', error);
    }
  };

  const handleCarregarSugestoes = async () => {
    await fetchSugestoes();
    setIsSugestoesOpen(true);
  };

  const handleUsarSugestao = (sugestao: any) => {
    setFormData({
      ...formData,
      nome: sugestao.nome,
      pedidos_ids: sugestao.pedidos.map((p: any) => p.id),
    });
    setIsSugestoesOpen(false);
    setIsDialogOpen(true);
  };

  const togglePedido = (pedidoId: string) => {
    setFormData(prev => ({
      ...prev,
      pedidos_ids: prev.pedidos_ids.includes(pedidoId)
        ? prev.pedidos_ids.filter(id => id !== pedidoId)
        : [...prev.pedidos_ids, pedidoId]
    }));
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'Pendente': 'Pendente',
      'Em Andamento': 'Em Andamento',
      'Concluída': 'Concluída',
      'Cancelada': 'Cancelada',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'Pendente': 'bg-orange-100 text-orange-700',
      'Em Andamento': 'bg-blue-100 text-blue-700',
      'Concluída': 'bg-green-100 text-green-700',
      'Cancelada': 'bg-red-100 text-red-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Logística Inteligente
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Gestão automática de rotas e entregas
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            className="border-[#A88F52] text-[#A88F52] hover:bg-[#A88F52] hover:text-white"
            onClick={handleCarregarSugestoes}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Ver Sugestões
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#546A4A] hover:bg-[#3B2F28]">
                <Plus className="w-4 h-4 mr-2" />
                Nova Rota
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Nova Rota</DialogTitle>
                <DialogDescription>Defina motorista, data e selecione os pedidos para a rota.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateRota} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome da Rota *</Label>
                    <Input
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: Rota Centro"
                      required
                    />
                  </div>
                  <div>
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={formData.data_rota}
                      onChange={(e) => setFormData({ ...formData, data_rota: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label>Motorista *</Label>
                  <Select
                    value={formData.motorista_id}
                    onValueChange={(value) => setFormData({ ...formData, motorista_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        motoristasLoading 
                          ? "Carregando motoristas..." 
                          : motoristas.length === 0 
                          ? "⚠️ Nenhum motorista cadastrado" 
                          : "Selecione o motorista"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {motoristas.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          <p>Nenhum motorista disponível.</p>
                          <p className="mt-1">Cadastre um motorista primeiro em:</p>
                          <p className="mt-1 font-semibold text-[#546A4A]">Menu → Motoristas</p>
                        </div>
                      ) : (
                        motoristas.map((motorista: any) => (
                          <SelectItem key={motorista.id} value={motorista.id}>
                            {motorista.nome}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Input
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    placeholder="Instruções especiais..."
                  />
                </div>

                <div>
                  <Label>Pedidos para Entrega * ({formData.pedidos_ids.length} selecionados)</Label>
                  <div className="mt-2 border rounded-md p-4 max-h-[300px] overflow-y-auto space-y-2">
                    {pedidosProntos.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        Nenhum pedido pronto para entrega
                      </p>
                    ) : (
                      pedidosProntos.map((pedido: any) => (
                        <div
                          key={pedido.id}
                          className="flex items-start gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                          onClick={() => togglePedido(pedido.id)}
                        >
                          <Checkbox
                            checked={formData.pedidos_ids.includes(pedido.id)}
                            onCheckedChange={() => togglePedido(pedido.id)}
                          />
                          <div className="flex-1">
                            <p className="font-semibold">{pedido.numero_pedido}</p>
                            <p className="text-sm text-gray-600">
                              {pedido.cliente?.nome} • {pedido.tipo_pedido}
                            </p>
                            <p className="text-xs text-gray-500">
                              R$ {parseFloat(pedido.valor_total || 0).toFixed(2)}
                            </p>
                          </div>
                          <Badge className={getStatusColor(pedido.status)}>
                            {pedido.status}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-[#546A4A] hover:bg-[#3B2F28]"
                  >
                    {creating ? 'Criando...' : 'Criar Rota'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dialog de Sugestões */}
      <Dialog open={isSugestoesOpen} onOpenChange={setIsSugestoesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>🤖 Sugestões Automáticas de Rotas</DialogTitle>
            <DialogDescription>
              Rotas otimizadas baseadas em pedidos prontos agrupados por região
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {sugestoesLoading ? (
              <p className="text-center py-8 text-gray-500">Carregando sugestões...</p>
            ) : sugestoes.length === 0 ? (
              <p className="text-center py-8 text-gray-500">
                Nenhuma sugestão disponível no momento
              </p>
            ) : (
              sugestoes.map((sugestao: any, index: number) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{sugestao.nome}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          📍 {sugestao.regiao}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm">
                          <span className="text-gray-600">
                            <Package className="inline w-4 h-4 mr-1" />
                            {sugestao.total_pedidos} pedidos
                          </span>
                          <span className="text-gray-600">
                            <Clock className="inline w-4 h-4 mr-1" />
                            ~{sugestao.estimativa_tempo} min
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-[#A88F52] hover:bg-[#8F7742]"
                        onClick={() => handleUsarSugestao(sugestao)}
                      >
                        Usar Sugestão
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Entregas Hoje</CardTitle>
            <Truck className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {entregasHoje.length}
            </div>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">
              {rotasAtivas.length} rotas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Concluídas</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {concluidas.length}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {rotas.length > 0 ? Math.round((concluidas.length / rotas.length) * 100) : 0}% completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Pedidos Prontos</CardTitle>
            <Package className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {pedidosProntos.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">Aguardando rota</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Motoristas</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {motoristas.length}
            </div>
            <p className="text-xs text-blue-600 mt-1">Disponíveis</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Rotas */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="ativas">Rotas Ativas</TabsTrigger>
          <TabsTrigger value="todas">Todas as Rotas</TabsTrigger>
        </TabsList>

        <TabsContent value="ativas" className="space-y-4 mt-6">
          {rotasAtivas.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Nenhuma rota ativa no momento</p>
                <p className="text-sm text-gray-400 mt-1">
                  Crie uma nova rota ou use as sugestões automáticas
                </p>
              </CardContent>
            </Card>
          ) : (
            rotasAtivas.map((rota: any) => (
              <RotaCard
                key={rota.id}
                rota={rota}
                onIniciar={handleIniciarRota}
                onFinalizar={handleFinalizarRota}
                onCancelar={handleCancelarRota}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="todas" className="space-y-4 mt-6">
          {rotas.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Nenhuma rota cadastrada</p>
              </CardContent>
            </Card>
          ) : (
            rotas.map((rota: any) => (
              <RotaCard
                key={rota.id}
                rota={rota}
                onIniciar={handleIniciarRota}
                onFinalizar={handleFinalizarRota}
                onCancelar={handleCancelarRota}
                getStatusLabel={getStatusLabel}
                getStatusColor={getStatusColor}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Checklist de Transporte */}
      <Card className="bg-[#F8F6F2]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package size={20} />
            Checklist de Transporte Refrigerado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Temperatura do veículo entre 2-4°C',
              'Caixas térmicas devidamente vedadas',
              'Etiquetas de rastreamento conferidas',
              'Notas fiscais impressas',
              'Rota otimizada no GPS',
              'Kit de emergência verificado',
            ].map((item, index) => (
              <label key={index} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white/50">
                <Checkbox className="text-[#546A4A]" />
                <span className="text-sm">{item}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente auxiliar para Card de Rota
function RotaCard({ rota, onIniciar, onFinalizar, onCancelar, getStatusLabel, getStatusColor }: any) {
  const paradas = rota.paradas || [];
  const totalParadas = paradas.length;
  const paradasConcluidas = paradas.filter((p: any) => p.status === 'Entregue').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-[#546A4A]" />
            <div>
              <div className="flex items-center gap-3">
                <CardTitle>{rota.codigo_rota} - {rota.nome}</CardTitle>
                <Badge className={getStatusColor(rota.status)}>
                  {getStatusLabel(rota.status)}
                </Badge>
              </div>
              <p className="text-sm text-[#1A1A1A] opacity-70 mt-1">
                Motorista: {rota.motorista?.nome} • {totalParadas} paradas
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Data: {format(new Date(rota.data_rota), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {rota.status === 'Pendente' && (
              <>
                <Button
                  size="sm"
                  className="bg-[#546A4A] hover:bg-[#3B2F28]"
                  onClick={() => onIniciar(rota.id)}
                >
                  <Play className="w-4 h-4 mr-1" />
                  Iniciar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-50"
                  onClick={() => onCancelar(rota.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </>
            )}
            {rota.status === 'Em Andamento' && (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => onFinalizar(rota.id)}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Progresso */}
        {totalParadas > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Progresso</span>
              <span>{paradasConcluidas}/{totalParadas}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#546A4A] transition-all"
                style={{ width: `${(paradasConcluidas / totalParadas) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Paradas */}
        <div className="space-y-3">
          {paradas.map((parada: any, index: number) => (
            <div key={parada.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    parada.status === 'Entregue'
                      ? 'bg-green-500'
                      : parada.status === 'Em Trânsito'
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                >
                  {parada.status === 'Entregue' ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <span className="text-sm text-white">{index + 1}</span>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold">{parada.pedido?.numero_pedido}</h4>
                <p className="text-sm text-gray-600">
                  {parada.pedido?.cliente?.nome}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <MapPin size={12} />
                  <span>{parada.pedido?.cliente?.endereco}</span>
                </div>
              </div>
              <Badge className={getStatusColor(parada.status || 'Pendente')}>
                {parada.status || 'Pendente'}
              </Badge>
            </div>
          ))}
        </div>

        {rota.observacoes && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <AlertCircle className="inline w-4 h-4 mr-1" />
              {rota.observacoes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}