import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Beaker, Loader2, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';

type FaseOperacional = 'esterilizacao' | 'inoculacao' | 'incubacao' | 'pronto_para_frutificacao' | 'frutificacao' | 'colheita' | 'encerramento';

interface LoteResumo {
  id: string;
  codigo_lote: string;
  sala?: string;
  status?: string;
  fase_operacional?: FaseOperacional;
  data_inoculacao?: string | null;
  data_prevista_fim_incubacao?: string | null;
  data_real_fim_incubacao?: string | null;
  produto?: {
    nome?: string;
  } | null;
  blocos?: Array<{ id: string; status_bloco: string }>;
}

interface BlocoLote {
  id: string;
  codigo_bloco: string;
  status_bloco: string;
  fase_operacional?: string | null;
  created_at?: string;
}

interface LoteEvento {
  id: string;
  tipo_evento: string;
  fase_operacional?: string | null;
  created_at: string;
  detalhes?: Record<string, any> | null;
  bloco?: {
    codigo_bloco?: string;
  } | null;
  usuario?: {
    nome?: string;
  } | null;
}

interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  estoque_atual: number;
  categoria?: string | null;
}

interface ConsumoLinha {
  id: string;
  insumo_id: string;
  quantidade: string;
  observacoes: string;
}

const FASE_LABEL: Record<string, string> = {
  esterilizacao: 'Esterilização',
  inoculacao: 'Inoculação',
  incubacao: 'Incubação',
  pronto_para_frutificacao: 'Pronto para Frutificação',
  frutificacao: 'Frutificação',
  colheita: 'Colheita',
  encerramento: 'Encerramento',
};

const EVENTO_LABEL: Record<string, string> = {
  lote_criado: 'Lote criado',
  lote_atualizado: 'Lote atualizado',
  blocos_criados: 'Blocos criados',
  inoculacao_registrada: 'Inoculação registrada',
  fase_alterada: 'Fase alterada',
  incubacao_concluida: 'Incubação concluída',
  consumo_insumo: 'Consumo de insumo',
  colheita_registrada: 'Colheita registrada',
};

function formatFase(fase?: string | null) {
  if (!fase) return 'Não definida';
  return FASE_LABEL[fase] || fase;
}

function formatEvento(tipo?: string | null) {
  if (!tipo) return 'Evento';
  return EVENTO_LABEL[tipo] || tipo.replaceAll('_', ' ');
}

function createConsumoLinha(): ConsumoLinha {
  return {
    id: `consumo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    insumo_id: '',
    quantidade: '',
    observacoes: '',
  };
}

export function OperacaoInoculacao() {
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insumosApiDisponivel, setInsumosApiDisponivel] = useState(true);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState('');
  const [blocos, setBlocos] = useState<BlocoLote[]>([]);
  const [eventos, setEventos] = useState<LoteEvento[]>([]);
  const [quantidadeBlocos, setQuantidadeBlocos] = useState('10');
  const [pesoSubstrato, setPesoSubstrato] = useState('2.5');
  const [observacoes, setObservacoes] = useState('');
  const [consumos, setConsumos] = useState<ConsumoLinha[]>([createConsumoLinha()]);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    try {
      const [lotesResult, insumosResult] = await Promise.allSettled([
        fetchServer('/lotes'),
        fetchServer('/insumos'),
      ]);

      if (lotesResult.status !== 'fulfilled') {
        throw lotesResult.reason;
      }

      const lotesAtivos = ((lotesResult.value.lotes || []) as LoteResumo[])
        .filter((lote) =>
          lote.status !== 'Finalizado' &&
          ['esterilizacao', 'inoculacao'].includes(String(lote.fase_operacional || 'esterilizacao')) &&
          !lote.data_inoculacao,
        )
        .sort((a, b) => a.codigo_lote.localeCompare(b.codigo_lote));

      setLotes(lotesAtivos);
      if (insumosResult.status === 'fulfilled') {
        setInsumos((insumosResult.value.insumos || []) as Insumo[]);
        setInsumosApiDisponivel(true);
      } else {
        setInsumos([]);
        setInsumosApiDisponivel(false);
      }
      setLoteSelecionado((prev) => {
        if (!prev && lotesAtivos.length > 0) return lotesAtivos[0].id;
        if (prev && !lotesAtivos.some((lote) => lote.id === prev)) return lotesAtivos[0]?.id || '';
        return prev;
      });
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar contexto operacional');
      setLotes([]);
      setInsumos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarDetalhesLote = useCallback(async (loteId: string) => {
    if (!loteId) {
      setBlocos([]);
      setEventos([]);
      return;
    }

    setLoadingDetalhes(true);
    try {
      const [blocosResult, eventosResult] = await Promise.all([
        fetchServer(`/lotes/${loteId}/blocos`),
        fetchServer(`/lotes/${loteId}/eventos?limit=80`),
      ]);

      setBlocos((blocosResult.blocos || []) as BlocoLote[]);
      setEventos((eventosResult.eventos || []) as LoteEvento[]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar blocos e eventos do lote');
      setBlocos([]);
      setEventos([]);
    } finally {
      setLoadingDetalhes(false);
    }
  }, []);

  useEffect(() => {
    void carregarBase();
  }, [carregarBase]);

  useEffect(() => {
    void carregarDetalhesLote(loteSelecionado);
  }, [loteSelecionado, carregarDetalhesLote]);

  const loteAtual = useMemo(
    () => lotes.find((lote) => lote.id === loteSelecionado) || null,
    [lotes, loteSelecionado],
  );

  const resumoBlocos = useMemo(() => {
    return blocos.reduce(
      (acc, bloco) => {
        acc.total += 1;
        if (bloco.status_bloco === 'incubacao') acc.incubacao += 1;
        if (bloco.status_bloco === 'frutificacao') acc.frutificacao += 1;
        if (bloco.status_bloco === 'colhido') acc.colhido += 1;
        return acc;
      },
      { total: 0, incubacao: 0, frutificacao: 0, colhido: 0 },
    );
  }, [blocos]);

  const lotesElegiveis = useMemo(() => {
    return lotes.filter((lote) =>
      ['esterilizacao', 'inoculacao'].includes(String(lote.fase_operacional || 'esterilizacao')) &&
      !lote.data_inoculacao,
    );
  }, [lotes]);

  const handleConsumoChange = (id: string, field: keyof ConsumoLinha, value: string) => {
    setConsumos((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoverConsumo = (id: string) => {
    setConsumos((prev) => {
      if (prev.length === 1) return [createConsumoLinha()];
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleRegistrarInoculacao = async () => {
    if (!loteSelecionado) {
      toast.error('Selecione um lote para registrar a inoculação.');
      return;
    }

    const quantidade = Number.parseInt(quantidadeBlocos, 10);
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error('Quantidade de blocos deve ser maior que zero.');
      return;
    }

    setSubmitting(true);
    try {
      const consumosPayload = consumos
        .map((consumo) => ({
          insumo_id: consumo.insumo_id,
          quantidade: Number.parseFloat(consumo.quantidade),
          observacoes: consumo.observacoes?.trim() || undefined,
        }))
        .filter((consumo) => consumo.insumo_id && Number.isFinite(consumo.quantidade) && consumo.quantidade > 0);

      const payload = {
        quantidade_blocos: quantidade,
        peso_substrato_kg: pesoSubstrato ? Number.parseFloat(pesoSubstrato) : undefined,
        observacoes: observacoes?.trim() || undefined,
        consumos: consumosPayload,
      };

      const result = await fetchServer(`/lotes/${loteSelecionado}/inoculacao`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(
        `Inoculação registrada. ${result.blocos_criados || quantidade} blocos em incubação até ${result.data_prevista_fim_incubacao ? format(new Date(result.data_prevista_fim_incubacao), 'dd/MM/yyyy', { locale: ptBR }) : 'data não definida'}.`,
      );

      setObservacoes('');
      setConsumos([createConsumoLinha()]);

      await Promise.all([
        carregarBase(),
        carregarDetalhesLote(loteSelecionado),
      ]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar inoculação');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#546A4A]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Operação de Inoculação
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Criar blocos por lote, consumir insumos e iniciar incubação de forma rastreável.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/operacao/frutificacao">
            <Button variant="outline">Ir para Frutificação</Button>
          </Link>
          <Button variant="outline" onClick={() => void carregarBase()}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {!insumosApiDisponivel && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-3 text-sm text-yellow-900">
            API de insumos não disponível no servidor publicado (`/insumos` retornando 404). Os lotes seguem carregando, mas o consumo de insumos ficará desabilitado até publicar a função atualizada.
          </CardContent>
        </Card>
      )}

      {lotesElegiveis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            Nenhum lote elegível encontrado para operação de inoculação.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-2">
                <Label>Lote</Label>
                <Select value={loteSelecionado} onValueChange={setLoteSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesElegiveis.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.codigo_lote} • {lote.sala || 'Sem sala'} • {formatFase(lote.fase_operacional)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade de blocos</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantidadeBlocos}
                  onChange={(event) => setQuantidadeBlocos(event.target.value)}
                />
              </div>

              <Button
                className="bg-[#546A4A] hover:bg-[#45583C]"
                onClick={() => void handleRegistrarInoculacao()}
                disabled={submitting || !loteSelecionado || !loteAtual || !lotesElegiveis.some((lote) => lote.id === loteSelecionado)}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Beaker className="w-4 h-4 mr-2" />}
                Registrar inoculação
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Consumo de Insumos na Inoculação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Peso por bloco (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      value={pesoSubstrato}
                      onChange={(event) => setPesoSubstrato(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Observações operacionais</Label>
                    <Textarea
                      value={observacoes}
                      rows={2}
                      placeholder="Ex.: assepsia concluída, sala estabilizada em 24°C"
                      onChange={(event) => setObservacoes(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-700">Itens consumidos</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!insumosApiDisponivel}
                      onClick={() => setConsumos((prev) => [...prev, createConsumoLinha()])}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar item
                    </Button>
                  </div>

                  {consumos.map((consumo) => (
                    <div key={consumo.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                      <div className="md:col-span-5">
                        <Label>Insumo</Label>
                        <Select
                          value={consumo.insumo_id}
                          disabled={!insumosApiDisponivel}
                          onValueChange={(value) => handleConsumoChange(consumo.id, 'insumo_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {insumos.map((insumo) => (
                              <SelectItem key={insumo.id} value={insumo.id}>
                                {insumo.nome} ({insumo.estoque_atual} {insumo.unidade})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-3">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          disabled={!insumosApiDisponivel}
                          value={consumo.quantidade}
                          onChange={(event) => handleConsumoChange(consumo.id, 'quantidade', event.target.value)}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <Label>Observação</Label>
                        <Input
                          disabled={!insumosApiDisponivel}
                          value={consumo.observacoes}
                          onChange={(event) => handleConsumoChange(consumo.id, 'observacoes', event.target.value)}
                        />
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={!insumosApiDisponivel}
                        onClick={() => handleRemoverConsumo(consumo.id)}
                        className="md:col-span-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo do Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {loadingDetalhes ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando dados do lote...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Código</span>
                      <span className="font-medium">{loteAtual?.codigo_lote || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Fase atual</span>
                      <Badge variant="outline">{formatFase(loteAtual?.fase_operacional)}</Badge>
                    </div>
                    {loteAtual && !lotesElegiveis.some((lote) => lote.id === loteAtual.id) && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Este lote já saiu da etapa de inoculação. Use esta tela apenas para lotes ainda não inoculados.
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Inoculação</span>
                      <span className="font-medium">
                        {loteAtual?.data_inoculacao ? format(new Date(loteAtual.data_inoculacao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Fim incubação previsto</span>
                      <span className="font-medium">
                        {loteAtual?.data_prevista_fim_incubacao ? format(new Date(loteAtual.data_prevista_fim_incubacao), 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Produto</span>
                      <span className="font-medium">{loteAtual?.produto?.nome || 'Não definido'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-gray-500">Blocos totais</p>
                        <p className="font-semibold text-lg">{resumoBlocos.total}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-gray-500">Em incubação</p>
                        <p className="font-semibold text-lg">{resumoBlocos.incubacao}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-gray-500">Frutificação</p>
                        <p className="font-semibold text-lg">{resumoBlocos.frutificacao}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <p className="text-xs text-gray-500">Colhidos</p>
                        <p className="font-semibold text-lg">{resumoBlocos.colhido}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Histórico de Eventos do Lote
                </CardTitle>
              </CardHeader>
              <CardContent>
                {eventos.length === 0 ? (
                  <p className="text-sm text-gray-500">Sem eventos registrados para este lote.</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-auto pr-2">
                    {eventos.map((evento) => (
                      <div key={evento.id} className="rounded-md border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{formatEvento(evento.tipo_evento)}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(evento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {evento.usuario?.nome ? ` • ${evento.usuario.nome}` : ''}
                              {evento.bloco?.codigo_bloco ? ` • ${evento.bloco.codigo_bloco}` : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {formatFase(evento.fase_operacional)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blocos do Lote</CardTitle>
              </CardHeader>
              <CardContent>
                {blocos.length === 0 ? (
                  <p className="text-sm text-gray-500">Este lote ainda não possui blocos criados.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-auto pr-2">
                    {blocos.map((bloco) => (
                      <div key={bloco.id} className="rounded-md border p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{bloco.codigo_bloco}</p>
                          <p className="text-xs text-gray-500">{formatFase(bloco.fase_operacional || bloco.status_bloco)}</p>
                        </div>
                        <Badge variant="secondary">{bloco.status_bloco}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
