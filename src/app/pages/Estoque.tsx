import { useEffect, useState } from 'react';
import { Package, Search, Filter, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { useEstoque, useProdutos } from '../../hooks/useApi';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Estoque() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualidadeFilter, setQualidadeFilter] = useState('all');

  const { data: estoqueData, loading: estoqueLoading, fetch: fetchEstoque } = useEstoque();
  const { data: produtosData, loading: produtosLoading, fetch: fetchProdutos } = useProdutos();

  useEffect(() => {
    fetchEstoque();
    fetchProdutos();
  }, []);

  const estoque = estoqueData?.estoque || [];
  const produtos = produtosData?.produtos || [];

  // Filtrar estoque
  const filteredEstoque = estoque.filter(item => {
    const matchesSearch = item.produto?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.lote?.codigo_lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.localizacao?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesQualidade = qualidadeFilter === 'all' || item.qualidade === qualidadeFilter;
    
    return matchesSearch && matchesStatus && matchesQualidade;
  });

  // Calcular totais
  const totalDisponivel = estoque
    .filter(e => e.status === 'Disponível')
    .reduce((sum, e) => sum + parseFloat(e.quantidade_kg || 0), 0);

  const totalReservado = estoque
    .filter(e => e.status === 'Reservado')
    .reduce((sum, e) => sum + parseFloat(e.quantidade_kg || 0), 0);

  const totalGeral = estoque.reduce((sum, e) => sum + parseFloat(e.quantidade_kg || 0), 0);

  const getQualidadeBadge = (qualidade: string) => {
    const colors = {
      'Premium': 'bg-emerald-100 text-emerald-700',
      'Padrão': 'bg-blue-100 text-blue-700',
      'Segunda': 'bg-gray-100 text-gray-700'
    };
    return colors[qualidade as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      'Disponível': 'bg-green-100 text-green-700',
      'Reservado': 'bg-yellow-100 text-yellow-700',
      'Vendido': 'bg-gray-100 text-gray-700',
      'Descartado': 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const isExpiringSoon = (dataValidade: string | null) => {
    if (!dataValidade) return false;
    const days = differenceInDays(new Date(dataValidade), new Date());
    return days <= 3 && days >= 0;
  };

  const isExpired = (dataValidade: string | null) => {
    if (!dataValidade) return false;
    return new Date(dataValidade) < new Date();
  };

  if (estoqueLoading || produtosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Estoque
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Controle de produtos disponíveis e validades
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Disponível</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {totalDisponivel.toFixed(1)} kg
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Reservado</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              {totalReservado.toFixed(1)} kg
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Geral</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">
              {totalGeral.toFixed(1)} kg
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Itens em Estoque</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {estoque.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por produto, lote ou local..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Disponível">Disponível</SelectItem>
                <SelectItem value="Reservado">Reservado</SelectItem>
                <SelectItem value="Vendido">Vendido</SelectItem>
                <SelectItem value="Descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={qualidadeFilter} onValueChange={setQualidadeFilter}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Qualidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Qualidades</SelectItem>
                <SelectItem value="Premium">Premium</SelectItem>
                <SelectItem value="Padrão">Padrão</SelectItem>
                <SelectItem value="Segunda">Segunda</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Estoque List */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos em Estoque</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEstoque.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm || statusFilter !== 'all' || qualidadeFilter !== 'all'
                ? 'Nenhum item encontrado com os filtros aplicados.'
                : 'Estoque vazio. Registre colheitas para adicionar produtos.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEstoque.map((item) => {
                const expiringSoon = isExpiringSoon(item.data_validade);
                const expired = isExpired(item.data_validade);

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      expired ? 'border-red-300 bg-red-50' :
                      expiringSoon ? 'border-yellow-300 bg-yellow-50' :
                      'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-semibold text-lg">
                            {item.produto?.nome || 'Produto não definido'}
                          </h4>
                          <Badge className={getQualidadeBadge(item.qualidade)}>
                            {item.qualidade}
                          </Badge>
                          <Badge className={getStatusBadge(item.status)}>
                            {item.status}
                          </Badge>
                          {(expired || expiringSoon) && (
                            <Badge className="bg-red-100 text-red-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {expired ? 'Vencido' : 'Vence em breve'}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                          <div>
                            <p className="text-gray-500">Quantidade</p>
                            <p className="font-medium">{parseFloat(item.quantidade_kg).toFixed(2)} kg</p>
                          </div>

                          {item.lote?.codigo_lote && (
                            <div>
                              <p className="text-gray-500">Lote</p>
                              <p className="font-medium">{item.lote.codigo_lote}</p>
                            </div>
                          )}

                          {item.localizacao && (
                            <div>
                              <p className="text-gray-500">Localização</p>
                              <p className="font-medium">{item.localizacao}</p>
                            </div>
                          )}

                          {item.data_validade && (
                            <div>
                              <p className="text-gray-500">Validade</p>
                              <p className={`font-medium ${
                                expired ? 'text-red-600' :
                                expiringSoon ? 'text-yellow-600' :
                                'text-gray-900'
                              }`}>
                                {format(new Date(item.data_validade), 'dd/MM/yyyy')}
                                {!expired && !expiringSoon && item.data_validade && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    ({differenceInDays(new Date(item.data_validade), new Date())} dias)
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                          Entrada: {format(new Date(item.data_entrada), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alertas de Validade */}
      {estoque.filter(e => isExpiringSoon(e.data_validade) || isExpired(e.data_validade)).length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Alertas de Validade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {estoque
              .filter(e => isExpiringSoon(e.data_validade) || isExpired(e.data_validade))
              .map(item => (
                <div key={item.id} className="p-3 bg-red-50 rounded border border-red-200">
                  <p className="text-sm text-red-900">
                    <strong>{item.produto?.nome}</strong> ({item.quantidade_kg} kg) - {item.lote?.codigo_lote}
                    {isExpired(item.data_validade) ? ' está vencido' : ' vence em breve'}
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
