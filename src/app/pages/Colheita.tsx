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
import { fetchServer } from '../../utils/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FASE_LABEL: Record<string, string> = {
  esterilizacao: 'Esterilização',
  inoculacao: 'Inoculação',
  incubacao: 'Incubação',
  frutificacao: 'Frutificação',
  colheita: 'Colheita',
  encerramento: 'Encerramento',
};

function formatFase(fase?: string | null) {
  if (!fase) return 'Não definida';
  return FASE_LABEL[fase] || fase;
}

export function Colheita() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingBlocos, setLoadingBlocos] = useState(false);
  const [blocosDisponiveis, setBlocosDisponiveis] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    lote_id: '',
    produto_id: '',
    bloco_id: '',
    fase_registrada: 'colheita',
    quantidade_kg: 0,
    qualidade: 'Premium',
    observacoes: '',
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

  const loadBlocosByLote = async (loteId: string) => {
    if (!loteId) {
      setBlocosDisponiveis([]);
      return;
    }

    setLoadingBlocos(true);
    try {
      const result = await fetchServer(`/lotes/${loteId}/blocos`);
      const blocos = (result.blocos || []).filter((bloco: any) => ['frutificacao', 'incubacao'].includes(bloco.status_bloco));
      setBlocosDisponiveis(blocos);
    } catch (error) {
      console.error('Erro ao carregar blocos do lote:', error);
      setBlocosDisponiveis([]);
    } finally {
      setLoadingBlocos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await createColheita({
        ...formData,
        bloco_id: formData.bloco_id || undefined,
      });
      setIsDialogOpen(false);
      fetchColheitas();

      setFormData({
        lote_id: '',
        produto_id: '',
        bloco_id: '',
        fase_registrada: 'colheita',
        quantidade_kg: 0,
        qualidade: 'Premium',
        observacoes: '',
      });
      setBlocosDisponiveis([]);
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoteChange = (loteId: string) => {
    const lote = lotesData?.lotes?.find((l: any) => l.id === loteId);
    setFormData((prev) => ({
      ...prev,
      lote_id: loteId,
      produto_id: lote?.produto?.id || '',
      bloco_id: '',
    }));
    void loadBlocosByLote(loteId);
  };

  const colheitas = colheitasData?.colheitas || [];
  const lotes = lotesData?.lotes || [];
  const lotesDisponiveis = lotes.filter((l: any) => l.status === 'Pronto' || l.status === 'Em Cultivo' || l.fase_operacional === 'frutificacao');

  const totalColhido = colheitas.reduce((sum: number, c: any) => sum + parseFloat(c.quantidade_kg || 0), 0);
  const colheitasPremium = colheitas.filter((c: any) => c.qualidade === 'Premium').length;
  const colheitasHoje = colheitas.filter((c: any) => {
    const hoje = new Date().toDateString();
    return new Date(c.data_colheita).toDateString() === hoje;
  }).length;

  const getQualidadeBadge = (qualidade: string) => {
    const colors = {
      Premium: 'bg-emerald-100 text-emerald-700',
      Padrão: 'bg-blue-100 text-blue-700',
      Segunda: 'bg-gray-100 text-gray-700',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Colheita
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Registro de colheitas com vínculo opcional por bloco e fase operacional.
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
                <Select value={formData.lote_id} onValueChange={handleLoteChange} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponiveis.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">Nenhum lote disponível para colheita</div>
                    ) : (
                      lotesDisponiveis.map((lote: any) => (
                        <SelectItem key={lote.id} value={lote.id}>
                          {lote.codigo_lote} - {lote.produto?.nome} ({formatFase(lote.fase_operacional)})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Bloco (opcional)</Label>
                <Select value={formData.bloco_id || 'todos'} onValueChange={(value) => setFormData((prev) => ({ ...prev, bloco_id: value === 'todos' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingBlocos ? 'Carregando blocos...' : 'Selecionar bloco'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Registrar no lote (sem bloco)</SelectItem>
                    {blocosDisponiveis.map((bloco: any) => (
                      <SelectItem key={bloco.id} value={bloco.id}>
                        {bloco.codigo_bloco} ({bloco.status_bloco})
                      </SelectItem>
                    ))}
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, quantidade_kg: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label>Qualidade *</Label>
                <Select value={formData.qualidade} onValueChange={(value) => setFormData((prev) => ({ ...prev, qualidade: value }))}>
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
                  onChange={(e) => setFormData((prev) => ({ ...prev, observacoes: e.target.value }))}
                  placeholder="Informações adicionais sobre a colheita..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating || lotesDisponiveis.length === 0} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                  {creating ? 'Registrando...' : 'Registrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
              {colheitas.map((colheita: any) => (
                <div key={colheita.id} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <h4 className="font-semibold text-lg">{colheita.lote?.produto?.nome || 'Produto não definido'}</h4>
                        <Badge className={getQualidadeBadge(colheita.qualidade)}>{colheita.qualidade}</Badge>
                        <Badge variant="outline">{formatFase(colheita.fase_registrada || 'colheita')}</Badge>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Lote</p>
                          <p className="font-medium">{colheita.lote?.codigo_lote}</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Bloco</p>
                          <p className="font-medium">{colheita.bloco?.codigo_bloco || 'Lote'}</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Quantidade</p>
                          <p className="font-medium">{parseFloat(colheita.quantidade_kg).toFixed(2)} kg</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Data</p>
                          <p className="font-medium">{format(new Date(colheita.data_colheita), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        </div>

                        <div>
                          <p className="text-gray-500">Hora</p>
                          <p className="font-medium">{format(new Date(colheita.data_colheita), 'HH:mm')}</p>
                        </div>
                      </div>

                      {colheita.responsavel && (
                        <p className="text-xs text-gray-500 mt-2">Responsável: {colheita.responsavel.nome}</p>
                      )}

                      {colheita.observacoes && (
                        <p className="text-sm text-gray-600 mt-2 italic">"{colheita.observacoes}"</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {lotesDisponiveis.length > 0 && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Package className="w-5 h-5" />
              Lotes com janela de colheita ({lotesDisponiveis.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {lotesDisponiveis.map((lote: any) => (
              <div key={lote.id} className="p-3 bg-green-50 rounded border border-green-200">
                <p className="text-sm text-green-900">
                  <strong>{lote.codigo_lote}</strong> - {lote.produto?.nome} ({formatFase(lote.fase_operacional)})
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
