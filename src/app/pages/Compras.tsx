import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, Building2, TrendingDown, Package, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';
import { format } from 'date-fns';
import { useNavigate } from 'react-router';

interface Compra {
  id: string;
  numero_compra: string;
  fornecedor: { nome: string; tipo_fornecedor: string };
  categoria: string;
  tipo_custo: 'Fixo' | 'Variável';
  valor_total: string;
  data_compra: string;
  data_vencimento?: string;
  status_pagamento: string;
  observacoes?: string;
  itens?: any[];
}

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  tipo_fornecedor: string;
  contato?: string;
  email?: string;
}

export function Compras() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    fornecedor_id: '',
    categoria: 'Substrato',
    tipo_custo: 'Variável' as 'Fixo' | 'Variável',
    valor_total: '',
    data_compra: new Date().toISOString().split('T')[0],
    data_vencimento: '',
    status_pagamento: 'Pendente',
    observacoes: '',
    itens: [{ descricao: '', quantidade: '', unidade: 'kg', valor_unitario: '' }]
  });

  const categorias = [
    'Substrato',
    'Spawn/Inóculo',
    'Embalagens',
    'Etiquetas',
    'Energia',
    'Água',
    'Internet/Telefonia',
    'Materiais de Limpeza',
    'EPIs/Descartáveis',
    'Manutenção',
    'Aluguel',
    'Seguros',
    'Licenças/Certificações',
    'Software/Tecnologia',
    'Contabilidade',
    'Transporte/Combustível',
    'Marketing',
    'Outros'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [comprasRes, fornecedoresRes] = await Promise.all([
        fetchServer('/compras'),
        fetchServer('/fornecedores')
      ]);
      
      console.log('📦 Compras carregadas:', comprasRes);
      console.log('🏢 Fornecedores carregados:', fornecedoresRes);
      
      setCompras(comprasRes.compras || []);
      setFornecedores(fornecedoresRes.fornecedores || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.fornecedor_id || formData.fornecedor_id.trim() === '') {
        toast.error('Por favor, selecione um fornecedor');
        return;
      }

      if (!formData.valor_total || parseFloat(formData.valor_total) <= 0) {
        toast.error('Por favor, insira um valor válido');
        return;
      }

      // Filtrar itens válidos
      const itensValidos = formData.itens.filter(item => 
        item.descricao && 
        item.descricao.trim() !== '' &&
        parseFloat(item.quantidade) > 0 &&
        parseFloat(item.valor_unitario) > 0
      );

      const dataToSend = {
        fornecedor_id: formData.fornecedor_id.trim(),
        categoria: formData.categoria,
        tipo_custo: formData.tipo_custo,
        valor_total: parseFloat(formData.valor_total),
        data_compra: formData.data_compra,
        data_vencimento: formData.data_vencimento || null,
        status_pagamento: formData.status_pagamento,
        observacoes: formData.observacoes || null,
        itens: itensValidos.length > 0 ? itensValidos.map(item => ({
          descricao: item.descricao.trim(),
          quantidade: parseFloat(item.quantidade),
          unidade: item.unidade,
          valor_unitario: parseFloat(item.valor_unitario)
        })) : []
      };

      console.log('📤 Enviando dados da compra:', JSON.stringify(dataToSend, null, 2));

      setCreating(true);
      const result = await fetchServer('/compras', {
        method: 'POST',
        body: JSON.stringify(dataToSend)
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Compra registrada com sucesso!');
      setIsDialogOpen(false);
      fetchData();
      
      // Reset form
      setFormData({
        fornecedor_id: '',
        categoria: 'Substrato',
        tipo_custo: 'Variável',
        valor_total: '',
        data_compra: new Date().toISOString().split('T')[0],
        data_vencimento: '',
        status_pagamento: 'Pendente',
        observacoes: '',
        itens: [{ descricao: '', quantidade: '', unidade: 'kg', valor_unitario: '' }]
      });
    } catch (error: any) {
      console.error('Erro ao criar compra:', error);
      toast.error(error.message || 'Erro ao registrar compra');
    } finally {
      setCreating(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      itens: [...formData.itens, { descricao: '', quantidade: '', unidade: 'kg', valor_unitario: '' }]
    });
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prevData => {
      const newItens = [...prevData.itens];
      newItens[index] = { ...newItens[index], [field]: value };
      
      // Calcular valor total automaticamente
      if (field === 'quantidade' || field === 'valor_unitario') {
        const qtd = parseFloat(field === 'quantidade' ? value : newItens[index].quantidade) || 0;
        const valorUnit = parseFloat(field === 'valor_unitario' ? value : newItens[index].valor_unitario) || 0;
        
        // Calcular total de todos os itens
        const total = prevData.itens.reduce((sum, item, idx) => {
          if (idx === index) {
            return sum + (qtd * valorUnit);
          } else {
            const q = parseFloat(item.quantidade) || 0;
            const v = parseFloat(item.valor_unitario) || 0;
            return sum + (q * v);
          }
        }, 0);
        
        return { 
          ...prevData, 
          itens: newItens,
          valor_total: total > 0 ? total.toFixed(2) : prevData.valor_total
        };
      }
      
      return { ...prevData, itens: newItens };
    });
  };

  const removeItem = (index: number) => {
    if (formData.itens.length > 1) {
      const newItens = formData.itens.filter((_, i) => i !== index);
      setFormData({ ...formData, itens: newItens });
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Pago': 'bg-green-100 text-green-700',
      'Pendente': 'bg-yellow-100 text-yellow-700',
      'Atrasado': 'bg-red-100 text-red-700',
      'Parcial': 'bg-blue-100 text-blue-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getTipoCustoColor = (tipo: string) => {
    return tipo === 'Fixo' ? 'bg-[#3B2F28] text-white' : 'bg-[#A88F52] text-white';
  };

  const filteredCompras = compras.filter(c => 
    c.numero_compra?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.fornecedor?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Estatísticas
  const totalCompras = compras.reduce((sum, c) => sum + parseFloat(c.valor_total || '0'), 0);
  const comprasPendentes = compras.filter(c => c.status_pagamento === 'Pendente' || c.status_pagamento === 'Atrasado').length;
  const totalPendente = compras
    .filter(c => c.status_pagamento === 'Pendente' || c.status_pagamento === 'Atrasado')
    .reduce((sum, c) => sum + parseFloat(c.valor_total || '0'), 0);
  const comprasMesAtual = compras.filter(c => {
    const dataCompra = new Date(c.data_compra);
    const hoje = new Date();
    return dataCompra.getMonth() === hoje.getMonth() && dataCompra.getFullYear() === hoje.getFullYear();
  });
  const totalMesAtual = comprasMesAtual.reduce((sum, c) => sum + parseFloat(c.valor_total || '0'), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#546A4A]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Compras
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Gestão de compras, fornecedores e controle de pagamentos
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="border-[#546A4A] text-[#546A4A] hover:bg-[#546A4A] hover:text-white"
            onClick={() => navigate('/fornecedores')}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Gerenciar Fornecedores
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#546A4A] hover:bg-[#3B5039]">
                <Plus className="w-4 h-4 mr-2" />
                Nova Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Nova Compra</DialogTitle>
                <DialogDescription>Insira os detalhes da compra realizada.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateCompra} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Fornecedor *</Label>
                    <Select
                      value={formData.fornecedor_id}
                      onValueChange={(value) => setFormData({ ...formData, fornecedor_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {fornecedores.length === 0 && (
                          <div className="p-2 text-sm text-gray-500">
                            Nenhum fornecedor cadastrado
                          </div>
                        )}
                        {fornecedores.map(fornecedor => (
                          <SelectItem key={fornecedor.id} value={fornecedor.id}>
                            {fornecedor.nome} ({fornecedor.tipo_fornecedor})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Categoria *</Label>
                    <Select
                      value={formData.categoria}
                      onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Tipo de Custo *</Label>
                    <Select
                      value={formData.tipo_custo}
                      onValueChange={(value: 'Fixo' | 'Variável') => setFormData({ ...formData, tipo_custo: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fixo">Custo Fixo</SelectItem>
                        <SelectItem value="Variável">Custo Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data da Compra *</Label>
                    <Input
                      type="date"
                      value={formData.data_compra}
                      onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Data de Vencimento</Label>
                    <Input
                      type="date"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Valor Total (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.valor_total}
                      onChange={(e) => setFormData({ ...formData, valor_total: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Status do Pagamento *</Label>
                    <Select
                      value={formData.status_pagamento}
                      onValueChange={(value) => setFormData({ ...formData, status_pagamento: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Pago">Pago</SelectItem>
                        <SelectItem value="Parcial">Parcial</SelectItem>
                        <SelectItem value="Atrasado">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Observações</Label>
                  <Input
                    placeholder="Notas adicionais sobre a compra..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Itens da Compra (opcional)</Label>
                  {formData.itens.map((item, index) => (
                    <div key={index} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 p-3 bg-gray-50 rounded">
                      <Input
                        placeholder="Descrição do item"
                        value={item.descricao}
                        onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                      />

                      <Input
                        type="number"
                        placeholder="Qtd"
                        step="0.01"
                        min="0"
                        value={item.quantidade}
                        onChange={(e) => updateItem(index, 'quantidade', e.target.value)}
                      />

                      <Select
                        value={item.unidade}
                        onValueChange={(value) => updateItem(index, 'unidade', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="un">un</SelectItem>
                          <SelectItem value="cx">cx</SelectItem>
                          <SelectItem value="l">l</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                        </SelectContent>
                      </Select>

                      <Input
                        type="number"
                        placeholder="R$ unit."
                        step="0.01"
                        min="0"
                        value={item.valor_unitario}
                        onChange={(e) => updateItem(index, 'valor_unitario', e.target.value)}
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

                <div className="flex gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={creating} className="flex-1 bg-[#546A4A] hover:bg-[#3B5039]">
                    {creating ? 'Registrando...' : 'Registrar Compra'}
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
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Compras (mês)</p>
                <p className="text-3xl font-bold text-[#546A4A] mt-2">
                  R$ {totalMesAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-[#546A4A] opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pagamentos Pendentes</p>
                <p className="text-3xl font-bold text-yellow-600 mt-2">{comprasPendentes}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-yellow-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valor Pendente</p>
                <p className="text-3xl font-bold text-red-600 mt-2">
                  R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <Package className="w-8 h-8 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Fornecedores Ativos</p>
                <p className="text-3xl font-bold text-[#A88F52] mt-2">{fornecedores.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-[#A88F52] opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar compras por número, fornecedor ou categoria..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Compras List */}
      <Card>
        <CardHeader>
          <CardTitle>Compras Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCompras.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Nenhuma compra encontrada' : 'Nenhuma compra registrada. Registre a primeira compra!'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredCompras.map((compra) => (
                <div
                  key={compra.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-semibold">{compra.numero_compra}</h4>
                      <Badge className={getStatusColor(compra.status_pagamento)}>
                        {compra.status_pagamento}
                      </Badge>
                      <Badge className={getTipoCustoColor(compra.tipo_custo)}>
                        {compra.tipo_custo}
                      </Badge>
                      <Badge variant="outline">{compra.categoria}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {compra.fornecedor?.nome} • {compra.fornecedor?.tipo_fornecedor}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Compra: {format(new Date(compra.data_compra), 'dd/MM/yyyy')}
                      {compra.data_vencimento && ` • Venc: ${format(new Date(compra.data_vencimento), 'dd/MM/yyyy')}`}
                    </p>
                    {compra.observacoes && (
                      <p className="text-xs text-gray-500 mt-1 italic">
                        {compra.observacoes}
                      </p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-bold text-lg text-[#546A4A]">
                      R$ {parseFloat(compra.valor_total || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    {compra.itens && compra.itens.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {compra.itens.length} {compra.itens.length === 1 ? 'item' : 'itens'}
                      </p>
                    )}
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
