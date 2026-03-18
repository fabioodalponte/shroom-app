import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { format, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Activity, Loader2, Plus, RefreshCcw, Sprout, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';

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
}

interface BlocoLote {
  id: string;
  codigo_bloco: string;
  status_bloco: string;
  fase_operacional?: string | null;
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
}

interface ConsumoLinha {
  id: string;
  insumo_id: string;
  quantidade: string;
  bloco_id: string;
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
  fase_alterada: 'Fase alterada',
  inoculacao_registrada: 'Inoculação registrada',
  incubacao_concluida: 'Incubação concluída',
  consumo_insumo: 'Consumo de insumo',
  blocos_movidos_frutificacao: 'Blocos movidos para frutificação',
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

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function createConsumoLinha(): ConsumoLinha {
  return {
    id: `consumo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    insumo_id: '',
    quantidade: '',
    bloco_id: '',
    observacoes: '',
  };
}

export function OperacaoFrutificacao() {
  const [loading, setLoading] = useState(true);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [insumosApiDisponivel, setInsumosApiDisponivel] = useState(true);
  const [lotes, setLotes] = useState<LoteResumo[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loteSelecionado, setLoteSelecionado] = useState('');
  const [blocos, setBlocos] = useState<BlocoLote[]>([]);
  const [eventos, setEventos] = useState<LoteEvento[]>([]);
  const [blocoIdsSelecionados, setBlocoIdsSelecionados] = useState<string[]>([]);
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
          ['incubacao', 'pronto_para_frutificacao', 'frutificacao'].includes(String(lote.fase_operacional || '')),
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
      setBlocoIdsSelecionados([]);
      return;
    }

    setLoadingDetalhes(true);
    try {
      const [blocosResult, eventosResult] = await Promise.all([
        fetchServer(`/lotes/${loteId}/blocos`),
        fetchServer(`/lotes/${loteId}/eventos?limit=80`),
      ]);

      const blocosLote = (blocosResult.blocos || []) as BlocoLote[];
      setBlocos(blocosLote);
      setEventos((eventosResult.eventos || []) as LoteEvento[]);

      const elegiveis = blocosLote.filter((bloco) => bloco.status_bloco === 'incubacao');
      setBlocoIdsSelecionados(elegiveis.map((bloco) => bloco.id));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar blocos e eventos do lote');
      setBlocos([]);
      setEventos([]);
      setBlocoIdsSelecionados([]);
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

  const blocosElegiveis = useMemo(() => {
    return blocos.filter((bloco) => bloco.status_bloco === 'incubacao');
  }, [blocos]);

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

  const todosElegiveisSelecionados = blocosElegiveis.length > 0 && blocosElegiveis.every((bloco) => blocoIdsSelecionados.includes(bloco.id));

  const toggleBlocoSelecionado = (blocoId: string, checked: boolean) => {
    setBlocoIdsSelecionados((prev) => {
      if (checked) {
        if (prev.includes(blocoId)) return prev;
        return [...prev, blocoId];
      }
      return prev.filter((id) => id !== blocoId);
    });
  };

  const toggleSelecionarTodos = (checked: boolean) => {
    if (checked) {
      setBlocoIdsSelecionados(blocosElegiveis.map((bloco) => bloco.id));
      return;
    }
    setBlocoIdsSelecionados([]);
  };

  const handleConsumoChange = (id: string, field: keyof ConsumoLinha, value: string) => {
    setConsumos((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoverConsumo = (id: string) => {
    setConsumos((prev) => {
      if (prev.length === 1) return [createConsumoLinha()];
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleRegistrarFrutificacao = async () => {
    if (!loteSelecionado) {
      toast.error('Selecione um lote para registrar a frutificação.');
      return;
    }

    if (blocosElegiveis.length === 0) {
      toast.error('Esse lote não possui blocos elegíveis para frutificação.');
      return;
    }

    setSubmitting(true);
    try {
      const consumosPayload = consumos
        .map((consumo) => ({
          insumo_id: consumo.insumo_id,
          quantidade: Number.parseFloat(consumo.quantidade),
          bloco_id: consumo.bloco_id || undefined,
          observacoes: consumo.observacoes?.trim() || undefined,
        }))
        .filter((consumo) => consumo.insumo_id && Number.isFinite(consumo.quantidade) && consumo.quantidade > 0);

      const payload = {
        bloco_ids: blocoIdsSelecionados,
        observacoes: observacoes?.trim() || undefined,
        consumos: consumosPayload,
      };

      const result = await fetchServer(`/lotes/${loteSelecionado}/frutificacao`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast.success(
        `Frutificação registrada. ${result.blocos_movidos || blocoIdsSelecionados.length} blocos avançaram de fase.`,
      );

      setObservacoes('');
      setConsumos([createConsumoLinha()]);

      await Promise.all([
        carregarBase(),
        carregarDetalhesLote(loteSelecionado),
      ]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar frutificação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarcarProntoParaFrutificacao = async () => {
    if (!loteSelecionado) {
      toast.error('Selecione um lote para concluir a incubação.');
      return;
    }

    setSubmitting(true);
    try {
      await fetchServer(`/lotes/${loteSelecionado}/pronto-para-frutificacao`, {
        method: 'POST',
        body: JSON.stringify({
          observacoes: observacoes?.trim() || undefined,
        }),
      });

      toast.success('Lote marcado como pronto para frutificação.');

      await Promise.all([
        carregarBase(),
        carregarDetalhesLote(loteSelecionado),
      ]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao concluir a incubação');
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
            Operação de Frutificação
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Movimentação de blocos para frutificação com rastreabilidade e consumo de insumos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/operacao/inoculacao">
            <Button variant="outline">Ir para Inoculação</Button>
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
            API de insumos não disponível no servidor publicado (`/insumos` retornando 404). Você pode avançar blocos de fase, mas o consumo de insumos ficará desabilitado até publicar a função atualizada.
          </CardContent>
        </Card>
      )}

      {lotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500">
            Nenhum lote elegível encontrado para operação de frutificação.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-3">
                <Label>Lote</Label>
                <Select value={loteSelecionado} onValueChange={setLoteSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.codigo_lote} • {lote.sala || 'Sem sala'} • {formatFase(lote.fase_operacional)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="bg-[#546A4A] hover:bg-[#45583C]"
                onClick={() => void handleRegistrarFrutificacao()}
                disabled={
                  submitting ||
                  !loteSelecionado ||
                  blocosElegiveis.length === 0 ||
                  blocoIdsSelecionados.length === 0 ||
                  !['incubacao', 'pronto_para_frutificacao'].includes(String(loteAtual?.fase_operacional || ''))
                }
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sprout className="w-4 h-4 mr-2" />}
                Registrar frutificação
              </Button>
            </CardContent>
          </Card>

          <Card className="border-sky-200 bg-sky-50/60">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-sky-900">Transição de incubação</p>
                <p className="text-xs text-sky-800/80">
                  Use este avanço manual quando o lote concluir a colonização e estiver pronto para frutificar.
                </p>
              </div>
              <Button
                variant="outline"
                className="border-sky-300 bg-white text-sky-900 hover:bg-sky-100"
                onClick={() => void handleMarcarProntoParaFrutificacao()}
                disabled={submitting || !loteSelecionado || !['incubacao', 'pronto_para_frutificacao'].includes(String(loteAtual?.fase_operacional || ''))}
              >
                Marcar pronto para frutificação
              </Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Blocos elegíveis para frutificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingDetalhes ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando blocos do lote...
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Selecionar todos elegíveis</p>
                        <p className="text-xs text-gray-500">Estados permitidos: blocos em incubação</p>
                      </div>
                      <Checkbox checked={todosElegiveisSelecionados} onCheckedChange={(checked) => toggleSelecionarTodos(Boolean(checked))} />
                    </div>

                    {blocosElegiveis.length === 0 ? (
                      <p className="text-sm text-gray-500">Não há blocos em incubação para avançar.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-auto pr-2">
                        {blocosElegiveis.map((bloco) => {
                          const checked = blocoIdsSelecionados.includes(bloco.id);
                          return (
                            <label key={bloco.id} className="rounded-md border p-3 flex items-center justify-between gap-3 cursor-pointer">
                              <div>
                                <p className="font-medium text-sm">{bloco.codigo_bloco}</p>
                                <p className="text-xs text-gray-500">{formatFase(bloco.fase_operacional || bloco.status_bloco)}</p>
                              </div>
                              <Checkbox checked={checked} onCheckedChange={(value) => toggleBlocoSelecionado(bloco.id, Boolean(value))} />
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo do Lote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Código</span>
                  <span className="font-medium">{loteAtual?.codigo_lote || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fase atual</span>
                  <Badge variant="outline">{formatFase(loteAtual?.fase_operacional)}</Badge>
                </div>
                {loteAtual && !['incubacao', 'pronto_para_frutificacao', 'frutificacao'].includes(String(loteAtual.fase_operacional || '')) && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    Este lote ainda não está em incubação. Faça a inoculação antes de tentar iniciar a frutificação.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Inoculação</span>
                  <span className="font-medium">
                    {parseDateValue(loteAtual?.data_inoculacao) ? format(parseDateValue(loteAtual?.data_inoculacao)!, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fim incubação previsto</span>
                  <span className="font-medium">
                    {parseDateValue(loteAtual?.data_prevista_fim_incubacao) ? format(parseDateValue(loteAtual?.data_prevista_fim_incubacao)!, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </span>
                </div>
                {parseDateValue(loteAtual?.data_prevista_fim_incubacao) && !loteAtual?.data_real_fim_incubacao && parseDateValue(loteAtual?.data_prevista_fim_incubacao)! < new Date() && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                    Incubação acima da previsão. Revise colonização visual e avance somente se o lote estiver pronto para frutificação.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Fim incubação real</span>
                  <span className="font-medium">
                    {parseDateValue(loteAtual?.data_real_fim_incubacao) ? format(parseDateValue(loteAtual?.data_real_fim_incubacao)!, 'dd/MM/yyyy', { locale: ptBR }) : '-'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-gray-500">Blocos totais</p>
                    <p className="font-semibold text-lg">{resumoBlocos.total}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-gray-500">Elegíveis agora</p>
                    <p className="font-semibold text-lg">{blocosElegiveis.length}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-gray-500">Em frutificação</p>
                    <p className="font-semibold text-lg">{resumoBlocos.frutificacao}</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <p className="text-xs text-gray-500">Colhidos</p>
                    <p className="font-semibold text-lg">{resumoBlocos.colhido}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Consumo de Insumos na Frutificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={observacoes}
                rows={2}
                placeholder="Ex.: ajuste de umidade e renovação de ar para abertura de primórdios"
                onChange={(event) => setObservacoes(event.target.value)}
              />

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
                  <div className="md:col-span-4">
                    <Label>Insumo</Label>
                    <Select value={consumo.insumo_id} onValueChange={(value) => handleConsumoChange(consumo.id, 'insumo_id', value)}>
                      <SelectTrigger disabled={!insumosApiDisponivel}>
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

                  <div className="md:col-span-2">
                    <Label>Qtd.</Label>
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
                    <Label>Bloco (opcional)</Label>
                    <Select value={consumo.bloco_id || 'todos'} onValueChange={(value) => handleConsumoChange(consumo.id, 'bloco_id', value === 'todos' ? '' : value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Aplicar ao lote</SelectItem>
                        {blocos.map((bloco) => (
                          <SelectItem key={bloco.id} value={bloco.id}>
                            {bloco.codigo_bloco}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <Label>Obs.</Label>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Histórico de Eventos
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
        </>
      )}
    </div>
  );
}
