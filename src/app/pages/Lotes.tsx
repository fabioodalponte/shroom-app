import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { fetchServer } from '../../utils/supabase/client';
import { format, differenceInDays } from 'date-fns';

type FaseOperacional = 'esterilizacao' | 'inoculacao' | 'incubacao' | 'pronto_para_frutificacao' | 'frutificacao' | 'colheita' | 'encerramento';

const FASE_LABEL: Record<string, string> = {
  esterilizacao: 'Esterilização',
  inoculacao: 'Inoculação',
  incubacao: 'Incubação',
  pronto_para_frutificacao: 'Pronto para Frutificação',
  frutificacao: 'Frutificação',
  colheita: 'Colheita',
  encerramento: 'Encerramento',
};

const FASE_BADGE: Record<string, string> = {
  esterilizacao: 'bg-slate-100 text-slate-700',
  inoculacao: 'bg-amber-100 text-amber-700',
  incubacao: 'bg-indigo-100 text-indigo-700',
  pronto_para_frutificacao: 'bg-sky-100 text-sky-700',
  frutificacao: 'bg-emerald-100 text-emerald-700',
  colheita: 'bg-lime-100 text-lime-700',
  encerramento: 'bg-gray-100 text-gray-600',
};

interface LoteItem {
  id: string;
  codigo_lote: string;
  status?: string;
  fase_operacional?: FaseOperacional;
  fase_atual?: FaseOperacional;
  data_inoculacao?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  data_inicio: string;
  sala?: string;
  temperatura_atual?: number | null;
  umidade_atual?: number | null;
  produto?: {
    nome?: string;
  } | null;
  responsavel?: {
    nome?: string;
  } | null;
  blocos?: Array<{
    id: string;
    status_bloco: string;
    fase_operacional?: string;
  }>;
}

function formatFase(fase?: string | null) {
  if (!fase) return 'Não definida';
  return FASE_LABEL[fase] || fase;
}

export function Lotes() {
  const [lotes, setLotes] = useState<LoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [faseFilter, setFaseFilter] = useState<'all' | FaseOperacional>('all');

  useEffect(() => {
    void loadLotes();
  }, []);

  async function loadLotes() {
    try {
      setLoading(true);
      const { lotes: lotesData } = await fetchServer('/lotes');
      setLotes((lotesData || []) as LoteItem[]);
    } catch (error) {
      console.error('Erro ao carregar lotes:', error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pronto': return 'bg-green-500';
      case 'Em Cultivo': return 'bg-blue-500';
      case 'Colhido': return 'bg-gray-500';
      case 'Finalizado': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Pronto': return 'bg-green-100 text-green-700';
      case 'Em Cultivo': return 'bg-blue-100 text-blue-700';
      case 'Colhido': return 'bg-gray-100 text-gray-700';
      case 'Finalizado': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const filteredLotes = useMemo(() => {
    return lotes.filter((lote) => {
      const matchesSearch = lote.codigo_lote?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.produto?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lote.sala?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || lote.status === statusFilter;
      const matchesFase = faseFilter === 'all' || lote.fase_operacional === faseFilter;

      return matchesSearch && matchesStatus && matchesFase;
    });
  }, [lotes, searchTerm, statusFilter, faseFilter]);

  const resumo = useMemo(() => {
    const agora = new Date();
    return {
      cultivo: lotes.filter((lote) => lote.status === 'Em Cultivo').length,
      incubacao: lotes.filter((lote) => lote.fase_operacional === 'incubacao').length,
      prontoParaFrutificacao: lotes.filter((lote) => lote.fase_operacional === 'pronto_para_frutificacao').length,
      frutificacao: lotes.filter((lote) => lote.fase_operacional === 'frutificacao').length,
      atrasados: lotes.filter((lote) => {
        if (!['incubacao', 'pronto_para_frutificacao'].includes(String(lote.fase_operacional || ''))) return false;
        if (!lote.data_prevista_fim_incubacao || lote.data_real_fim_incubacao) return false;
        return new Date(lote.data_prevista_fim_incubacao) < agora;
      }).length,
      totalBlocos: lotes.reduce((acc, lote) => acc + (lote.blocos?.length || 0), 0),
    };
  }, [lotes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Lotes de Produção
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Gerenciamento de lotes com fases operacionais e rastreabilidade por blocos.
          </p>
        </div>
        <Link to="/lotes/criar">
          <Button className="bg-[#546A4A] hover:bg-[#546A4A]/90">
            <Plus className="w-4 h-4 mr-2" />
            Novo Lote
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por código, produto ou sala..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-52">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Em Cultivo">Em Cultivo</SelectItem>
                <SelectItem value="Pronto">Pronto</SelectItem>
                <SelectItem value="Colhido">Colhido</SelectItem>
                <SelectItem value="Finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={faseFilter} onValueChange={(value: 'all' | FaseOperacional) => setFaseFilter(value)}>
              <SelectTrigger className="w-full lg:w-56">
                <SelectValue placeholder="Fase operacional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Fases</SelectItem>
                <SelectItem value="esterilizacao">Esterilização</SelectItem>
                <SelectItem value="inoculacao">Inoculação</SelectItem>
                <SelectItem value="incubacao">Incubação</SelectItem>
                <SelectItem value="pronto_para_frutificacao">Pronto para Frutificação</SelectItem>
                <SelectItem value="frutificacao">Frutificação</SelectItem>
                <SelectItem value="colheita">Colheita</SelectItem>
                <SelectItem value="encerramento">Encerramento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredLotes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' || faseFilter !== 'all'
                ? 'Nenhum lote encontrado com os filtros aplicados.'
                : 'Nenhum lote cadastrado. Crie o primeiro lote!'}
            </p>
            {!searchTerm && statusFilter === 'all' && faseFilter === 'all' && (
              <Link to="/lotes/criar">
                <Button className="mt-4 bg-[#546A4A] hover:bg-[#546A4A]/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Lote
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLotes.map((lote) => {
            const diasDesdeInicio = differenceInDays(new Date(), new Date(lote.data_inicio));
            const totalBlocos = lote.blocos?.length || 0;
            const blocosFrutificacao = (lote.blocos || []).filter((bloco) => bloco.status_bloco === 'frutificacao').length;
            const fimIncubacaoPrevisto = lote.data_prevista_fim_incubacao ? new Date(lote.data_prevista_fim_incubacao) : null;
            const fimIncubacaoReal = lote.data_real_fim_incubacao ? new Date(lote.data_real_fim_incubacao) : null;
            const incubacaoAtrasada = Boolean(
              fimIncubacaoPrevisto &&
              !fimIncubacaoReal &&
              ['incubacao', 'pronto_para_frutificacao'].includes(String(lote.fase_operacional || '')) &&
              fimIncubacaoPrevisto < new Date(),
            );

            return (
              <Link key={lote.id} to={`/lotes/${lote.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-lg">{lote.codigo_lote}</h3>
                        <p className="text-sm text-gray-600">{lote.produto?.nome || 'Produto não definido'}</p>
                      </div>
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(lote.status || '')}`} />
                    </div>

                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <Badge className={getStatusBadgeColor(lote.status || '')}>{lote.status || 'Sem status'}</Badge>
                      <Badge className={FASE_BADGE[lote.fase_operacional || ''] || 'bg-gray-100 text-gray-600'}>
                        {formatFase(lote.fase_operacional)}
                      </Badge>
                      {incubacaoAtrasada && (
                        <Badge className="bg-rose-100 text-rose-700">Incubação atrasada</Badge>
                      )}
                    </div>

                    <div className="space-y-3 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Início:</span>
                        <span className="font-medium">{format(new Date(lote.data_inicio), 'dd/MM/yyyy')}</span>
                      </div>

                      {lote.sala && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Local:</span>
                          <span className="font-medium">{lote.sala}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Blocos:</span>
                        <span className="font-medium">{totalBlocos}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Em frutificação:</span>
                        <span className="font-medium">{blocosFrutificacao}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Dias:</span>
                        <span className="font-medium">{diasDesdeInicio} dias</span>
                      </div>

                      {lote.data_inoculacao && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Inoculação:</span>
                          <span className="font-medium">{format(new Date(lote.data_inoculacao), 'dd/MM/yyyy')}</span>
                        </div>
                      )}

                      {fimIncubacaoPrevisto && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Fim incubação prev.:</span>
                          <span className="font-medium">{format(fimIncubacaoPrevisto, 'dd/MM/yyyy')}</span>
                        </div>
                      )}

                      {fimIncubacaoReal && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Incubação concluída:</span>
                          <span className="font-medium">{format(fimIncubacaoReal, 'dd/MM/yyyy')}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t">
                      {lote.responsavel && (
                        <span className="text-xs text-gray-500">Por: {lote.responsavel.nome}</span>
                      )}
                      {!lote.responsavel && <span className="text-xs text-gray-400">Sem responsável</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{resumo.cultivo}</p>
            <p className="text-sm text-gray-600">Em Cultivo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{resumo.incubacao}</p>
            <p className="text-sm text-gray-600">Incubação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-sky-600">{resumo.prontoParaFrutificacao}</p>
            <p className="text-sm text-gray-600">Prontos p/ Frutificar</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{resumo.frutificacao}</p>
            <p className="text-sm text-gray-600">Frutificação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-rose-600">{resumo.atrasados}</p>
            <p className="text-sm text-gray-600">Atrasados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{resumo.totalBlocos}</p>
            <p className="text-sm text-gray-600">Total de Blocos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
