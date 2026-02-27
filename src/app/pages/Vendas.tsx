import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { useCreatePedido, usePedidos, useClientes, useProdutos } from '../../hooks/useApi';
import { format } from 'date-fns';
import { useNavigate } from 'react-router';

export function Vendas() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    cliente_id: '',
    tipo_pedido: 'B2B',
    data_entrega_prevista: '',
    itens: [{ produto_id: '', quantidade_kg: 0, preco_unitario: 0 }]
  });

  const { data: pedidosData, loading: pedidosLoading, fetch: fetchPedidos } = usePedidos();
  const { data: clientesData, loading: clientesLoading, fetch: fetchClientes } = useClientes();
  const { data: produtosData, loading: produtosLoading, fetch: fetchProdutos } = useProdutos();
  const { post: createPedido, loading: creating } = useCreatePedido();

  useEffect(() => {
    fetchPedidos();
    fetchClientes();
    fetchProdutos();
  }, []);

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validar cliente_id
      if (!formData.cliente_id || formData.cliente_id.trim() === '') {
        toast.error('Por favor, selecione um cliente');
        return;
      }

      // Filtrar e validar itens do pedido
      const itensValidos = formData.itens.filter(item => 
        item.produto_id && 
        item.produto_id.trim() !== '' &&
        item.quantidade_kg > 0 &&
        item.preco_unitario > 0
      );

      if (itensValidos.length === 0) {
        toast.error('Por favor, adicione pelo menos um item válido ao pedido');
        return;
      }

      // Preparar dados para envio
      const dataToSend: any = {
        cliente_id: formData.cliente_id.trim(),
        tipo_pedido: formData.tipo_pedido,
        itens: itensValidos.map(item => ({
          produto_id: item.produto_id.trim(),
          quantidade_kg: parseFloat(item.quantidade_kg.toString()),
          preco_unitario: parseFloat(item.preco_unitario.toString())
        }))
      };

      // Adicionar data_entrega_prevista apenas se não estiver vazia
      if (formData.data_entrega_prevista && formData.data_entrega_prevista.trim() !== '') {
        dataToSend.data_entrega_prevista = formData.data_entrega_prevista;
      }

      console.log('📤 Enviando dados do pedido:', JSON.stringify(dataToSend, null, 2));

      await createPedido(dataToSend);
      setIsDialogOpen(false);
      fetchPedidos(); // Recarregar lista
      
      // Reset form
      setFormData({
        cliente_id: '',
        tipo_pedido: 'B2B',
        data_entrega_prevista: '',
        itens: [{ produto_id: '', quantidade_kg: 0, preco_unitario: 0 }]
      });
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      itens: [...formData.itens, { produto_id: '', quantidade_kg: 0, preco_unitario: 0 }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prevData => {
      const newItens = [...prevData.itens];
      newItens[index] = { ...newItens[index], [field]: value };
      console.log(`📝 Atualizando item ${index}, campo ${field}:`, value);
      console.log('📦 Novo estado de itens:', newItens);
      return { ...prevData, itens: newItens };
    });
  };

  const removeItem = (index: number) => {
    if (formData.itens.length > 1) {
      const newItens = formData.itens.filter((_, i) => i !== index);
      setFormData({ ...formData, itens: newItens });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      'Pendente': 'Pendente',
      'Confirmado': 'Confirmado',
      'Preparando': 'Preparando',
      'Pronto': 'Pronto',
      'Em Rota': 'Em Rota',
      'Entregue': 'Entregue',
      'Cancelado': 'Cancelado'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Pendente': 'bg-yellow-100 text-yellow-700',
      'Confirmado': 'bg-blue-100 text-blue-700',
      'Preparando': 'bg-orange-100 text-orange-700',
      'Pronto': 'bg-purple-100 text-purple-700',
      'Em Rota': 'bg-indigo-100 text-indigo-700',
      'Entregue': 'bg-green-100 text-green-700',
      'Cancelado': 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const pedidos = pedidosData?.pedidos || [];
  const clientes = clientesData?.clientes || [];
  const produtos = produtosData?.produtos || [];

  // Debug: verificar se produtos estão carregando
  useEffect(() => {
    console.log('🍄 Produtos carregados:', produtos);
    console.log('🍄 Total de produtos:', produtos.length);
  }, [produtos]);

  const clientesB2B = clientes.filter(c => c.tipo_cliente === 'B2B');
  const clientesB2C = clientes.filter(c => c.tipo_cliente === 'B2C');

  const filteredPedidos = pedidos.filter(p => 
    p.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (pedidosLoading || clientesLoading || produtosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Vendas
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Gestão de clientes e pedidos B2B/B2C
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-[#A88F52] text-[#A88F52] hover:bg-[#A88F52] hover:text-white"
            onClick={() => navigate('/clientes')}
          >
            <Users className="w-4 h-4 mr-2" />
            Gerenciar Clientes
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#A88F52] hover:bg-[#8F7742]">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Pedido</DialogTitle>
                <DialogDescription>Insira os detalhes do pedido para criar um novo registro.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateOrder} className="space-y-4">
                <div>
                  <Label>Cliente *</Label>
                  <Select
                    value={formData.cliente_id}
                    onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} ({cliente.tipo_cliente})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Tipo de Pedido *</Label>
                  <Select
                    value={formData.tipo_pedido}
                    onValueChange={(value) => setFormData({ ...formData, tipo_pedido: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">B2B - Restaurante</SelectItem>
                      <SelectItem value="B2C">B2C - Consumidor Final</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data de Entrega Prevista</Label>
                  <Input
                    type="date"
                    value={formData.data_entrega_prevista}
                    onChange={(e) => setFormData({ ...formData, data_entrega_prevista: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Itens do Pedido *</Label>
                  {formData.itens.map((item, index) => (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 p-3 bg-gray-50 rounded">
                      <div>
                        <Select
                          value={item.produto_id}
                          onValueChange={(value) => {
                            console.log('🎯 Produto selecionado:', value);
                            updateItem(index, 'produto_id', value);
                            const produto = produtos.find(p => p.id === value);
                            console.log('🍄 Produto encontrado:', produto);
                            if (produto) {
                              updateItem(index, 'preco_unitario', produto.preco_kg);
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.length === 0 && (
                              <div className="p-2 text-sm text-gray-500">Nenhum produto cadastrado</div>
                            )}
                            {produtos.map(produto => (
                              <SelectItem key={produto.id} value={produto.id}>
                                {produto.nome} - R$ {produto.preco_kg}/kg
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <Input
                        type="number"
                        placeholder="Qtd (kg)"
                        step="0.01"
                        min="0"
                        value={item.quantidade_kg > 0 ? item.quantidade_kg : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          updateItem(index, 'quantidade_kg', isNaN(val) ? 0 : val);
                        }}
                      />

                      <Input
                        type="number"
                        placeholder="Preço/kg"
                        step="0.01"
                        min="0"
                        value={item.preco_unitario > 0 ? item.preco_unitario : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          updateItem(index, 'preco_unitario', isNaN(val) ? 0 : val);
                        }}
                      />

                      {formData.itens.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          ✕
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addItem} className="w-full">
                    + Adicionar Item
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                    {creating ? 'Criando...' : 'Criar Pedido'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Clientes B2B</p>
            <p className="text-3xl font-bold text-[#546A4A] mt-2">{clientesB2B.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Clientes B2C</p>
            <p className="text-3xl font-bold text-[#A88F52] mt-2">{clientesB2C.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Pedidos Ativos</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {pedidos.filter(p => p.status !== 'Entregue' && p.status !== 'Cancelado').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Pedidos</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{pedidos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar pedidos..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Pedidos List */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPedidos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum pedido encontrado</p>
          ) : (
            <div className="space-y-3">
              {filteredPedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="font-semibold">{pedido.numero_pedido}</h4>
                      <Badge className={getStatusColor(pedido.status)}>
                        {getStatusLabel(pedido.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {pedido.cliente?.nome} • {pedido.tipo_pedido}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(pedido.data_pedido), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">R$ {parseFloat(pedido.valor_total || 0).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">
                      {pedido.itens?.length || 0} {pedido.itens?.length === 1 ? 'item' : 'itens'}
                    </p>
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
