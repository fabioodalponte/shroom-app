import { useEffect, useState } from 'react';
import { Plus, Loader2, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import { useColheitas, useCreateColheita, useLotes, useProdutos } from '../../hooks/useApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Colheita() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    lote_id: '',
    produto_id: '',
    quantidade_kg: 0,
    qualidade: 'Premium',
    observacoes: ''
  });

  const { data: colheitasData, loading: colheitasLoading, fetch: fetchColheitas } = useColheitas();
  const { data: lotesData, loading: lotesLoading, fetch: fetchLotes } = useLotes();
  const { loading: produtosLoading, fetch: fetchProdutos } = useProdutos();
  const { post: createColheita, loading: creating } = useCreateColheita();

  useEffect(() => {
    fetchColheitas();
    fetchLotes();
    fetchProdutos();
  }, [fetchColheitas, fetchLotes, fetchProdutos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createColheita(formData);
      setIsDialogOpen(false);
      fetchColheitas(); // Recarregar lista
      
      // Reset form
      setFormData({
        lote_id: '',
        produto_id: '',
        quantidade_kg: 0,
        qualidade: 'Premium',
        observacoes: ''
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoteChange = (loteId: string) => {
    const lote = lotesData?.lotes?.find(l => l.id === loteId);
    setFormData({
      ...formData,
      lote_id: loteId,
      produto_id: lote?.produto?.id || ''
    });
  };

  const colheitas = colheitasData?.colheitas || [];
  const lotes = lotesData?.lotes || [];
  // Filtrar apenas lotes prontos para colheita
  const lotesDisponiveis = lotes.filter(l => l.status === 'Pronto' || l.status === 'Em Cultivo');

  // Calcular totais
  const totalColhido = colheitas.reduce((sum, c) => sum + parseFloat(c.quantidade_kg || 0), 0);
  const colheitasPremium = colheitas.filter(c => c.qualidade === 'Premium').length;
  const colheitasHoje = colheitas.filter(c => {
    const hoje = new Date().toDateString();
    return new Date(c.data_colheita).toDateString() === hoje;
  }).length;

  const getQualidadeBadge = (qualidade: string) => {
    const colors = {
      'Premium': 'bg-emerald-100 text-emerald-700',
      'Padrão': 'bg-blue-100 text-blue-700',
      'Segunda': 'bg-gray-100 text-gray-700'
    };
    return colors[qualidade as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  if (colheitasLoading || lotesLoading || produtosLoading) {
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
            Colheita
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Registro e controle de colheitas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#546A4A] hover:bg-[#546A4A]/90">
              <Plus className="w-4 h-4 mr-2" />
              Registrar Colheita
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Nova Colheita</DialogTitle>
              <DialogDescription>Preencha os dados da colheita para registro no sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Lote *</Label>
                <Select
                  value={formData.lote_id}
                  onValueChange={handleLoteChange}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponiveis.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        Nenhum lote disponível para colheita
                      </div>
                    ) : (
                      lotesDisponiveis.map(lote => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {lote.codigo_lote} - {lote.produto?.nome} ({lote.status})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade (kg) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.quantidade_kg || ''}
                  onChange={(e) => setFormData({ ...formData, quantidade_kg: parseFloat(e.target.value) })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Qualidade *</Label>
                <Select
                  value={formData.qualidade}
                  onValueChange={(value) => setFormData({ ...formData, qualidade: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Premium">Premium</SelectItem>
                    <SelectItem value="Padrão">Padrão</SelectItem>
                    <SelectItem value="Segunda">Segunda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais sobre a colheita..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
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
                  disabled={creating || lotesDisponiveis.length === 0} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {creating ? 'Registrando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Colheitas Hoje</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{colheitasHoje}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total Colhido</p>
            <p className="text-3xl font-bold text-emerald-600 mt-2">{totalColhido.toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Qualidade Premium</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{colheitasPremium}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total de Colheitas</p>
            <p className="text-3xl font-bold text-gray-600 mt-2">{colheitas.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Colheitas List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Colheitas</CardTitle>
        </CardHeader>
        <CardContent>
          {colheitas.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma colheita registrada ainda.</p>
              <p className="text-sm text-gray-400 mt-2">Clique em "Registrar Colheita" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {colheitas.map((colheita) => (
                <div
                  key={colheita.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-lg">
                          {colheita.lote?.produto?.nome || 'Produto não definido'}
                        </h4>
                        <Badge className={getQualidadeBadge(colheita.qualidade)}>
                          {colheita.qualidade}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Lote</p>
                          <p className="font-medium">{colheita.lote?.codigo_lote}</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Quantidade</p>
                          <p className="font-medium">{parseFloat(colheita.quantidade_kg).toFixed(2)} kg</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Data</p>
                          <p className="font-medium">
                            {format(new Date(colheita.data_colheita), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>

                        <div>
                          <p className="text-gray-500">Hora</p>
                          <p className="font-medium">
                            {format(new Date(colheita.data_colheita), 'HH:mm')}
                          </p>
                        </div>
                      </div>

                      {colheita.responsavel && (
                        <p className="text-xs text-gray-500 mt-2">
                          Responsável: {colheita.responsavel.nome}
                        </p>
                      )}

                      {colheita.observacoes && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          "{colheita.observacoes}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lotes Disponíveis para Colheita */}
      {lotesDisponiveis.length > 0 && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Package className="w-5 h-5" />
              Lotes Prontos para Colheita ({lotesDisponiveis.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lotesDisponiveis.map(lote => (
              <div key={lote.id} className="p-3 bg-green-50 rounded border border-green-200">
                <p className="text-sm text-green-900">
                  <strong>{lote.codigo_lote}</strong> - {lote.produto?.nome} ({lote.status})
                  {lote.sala && ` • ${lote.sala}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
