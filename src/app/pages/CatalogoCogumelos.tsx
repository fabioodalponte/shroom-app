import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileText, Plus, Save, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../contexts/AuthContext';
import {
  useCreateProdutoCatalogo,
  useCreateProdutoTreinamentoCatalogo,
  useDeleteProdutoTreinamentoCatalogo,
  useProdutos,
  useUpdateProdutoCatalogo,
  useUpdateProdutoTreinamentoCatalogo,
} from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';

interface ProdutoTreinamento {
  id: string;
  slug: string;
  categoria: string;
  titulo: string;
  objetivo?: string | null;
  conteudo_json?: Record<string, unknown>;
  ordem?: number;
  ativo?: boolean;
}

interface ProdutoCatalogo {
  id: string;
  nome: string;
  descricao?: string | null;
  variedade?: string | null;
  peso_medio_g?: number | null;
  preco_kg?: number | null;
  tempo_cultivo_dias?: number | null;
  temperatura_ideal_min?: number | null;
  temperatura_ideal_max?: number | null;
  umidade_ideal_min?: number | null;
  umidade_ideal_max?: number | null;
  ativo?: boolean;
  perfil_cultivo?: {
    co2_ideal_max?: number | null;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
    ciclo_estimado_dias_min?: number | null;
    ciclo_estimado_dias_max?: number | null;
    ciclo_min_dias?: number | null;
    ciclo_max_dias?: number | null;
    parametros_fases_json?: Record<string, unknown>;
    recomendacoes_json?: Record<string, unknown>;
    observacoes?: string | null;
    ativo?: boolean;
  } | null;
  treinamentos?: ProdutoTreinamento[];
}

const emptyProdutoForm = {
  nome: '',
  variedade: '',
  descricao: '',
  peso_medio_g: '',
  preco_kg: '',
  tempo_cultivo_dias: '',
  temperatura_ideal_min: '',
  temperatura_ideal_max: '',
  umidade_ideal_min: '',
  umidade_ideal_max: '',
  ativo: true,
};

const emptyPerfilForm = {
  co2_ideal_max: '',
  luminosidade_min_lux: '',
  luminosidade_max_lux: '',
  ciclo_estimado_dias_min: '',
  ciclo_estimado_dias_max: '',
  parametros_fases_json: '{\n  "incubacao": {},\n  "frutificacao": {}\n}',
  recomendacoes_json: '{\n  "resumo": "",\n  "alertas": []\n}',
  observacoes: '',
  ativo: true,
};

const emptyTreinamentoForm = {
  id: '',
  slug: '',
  categoria: 'operacional',
  titulo: '',
  objetivo: '',
  ordem: '0',
  ativo: true,
  conteudo_json: '{\n  "etapas": []\n}',
};

function toInputValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function stringifyJson(value: unknown, fallback = '{}') {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback), null, 2);
  } catch {
    return fallback;
  }
}

function parseNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonField(fieldLabel: string, rawValue: string) {
  try {
    return JSON.parse(rawValue || '{}');
  } catch {
    throw new Error(`JSON inválido em ${fieldLabel}`);
  }
}

function getProdutoFormFromCatalogo(produto?: ProdutoCatalogo | null) {
  if (!produto) return emptyProdutoForm;
  return {
    nome: produto.nome || '',
    variedade: produto.variedade || '',
    descricao: produto.descricao || '',
    peso_medio_g: toInputValue(produto.peso_medio_g),
    preco_kg: toInputValue(produto.preco_kg),
    tempo_cultivo_dias: toInputValue(produto.tempo_cultivo_dias),
    temperatura_ideal_min: toInputValue(produto.temperatura_ideal_min),
    temperatura_ideal_max: toInputValue(produto.temperatura_ideal_max),
    umidade_ideal_min: toInputValue(produto.umidade_ideal_min),
    umidade_ideal_max: toInputValue(produto.umidade_ideal_max),
    ativo: produto.ativo ?? true,
  };
}

function getPerfilFormFromCatalogo(produto?: ProdutoCatalogo | null) {
  if (!produto?.perfil_cultivo) return emptyPerfilForm;
  const perfil = produto.perfil_cultivo;
  return {
    co2_ideal_max: toInputValue(perfil.co2_ideal_max),
    luminosidade_min_lux: toInputValue(perfil.luminosidade_min_lux),
    luminosidade_max_lux: toInputValue(perfil.luminosidade_max_lux),
    ciclo_estimado_dias_min: toInputValue(perfil.ciclo_estimado_dias_min ?? perfil.ciclo_min_dias),
    ciclo_estimado_dias_max: toInputValue(perfil.ciclo_estimado_dias_max ?? perfil.ciclo_max_dias),
    parametros_fases_json: stringifyJson(perfil.parametros_fases_json, '{\n  "incubacao": {},\n  "frutificacao": {}\n}'),
    recomendacoes_json: stringifyJson(perfil.recomendacoes_json, '{\n  "resumo": "",\n  "alertas": []\n}'),
    observacoes: perfil.observacoes || '',
    ativo: perfil.ativo ?? true,
  };
}

function getTreinamentoForm(treinamento?: ProdutoTreinamento | null) {
  if (!treinamento) return emptyTreinamentoForm;
  return {
    id: treinamento.id,
    slug: treinamento.slug || '',
    categoria: treinamento.categoria || 'operacional',
    titulo: treinamento.titulo || '',
    objetivo: treinamento.objetivo || '',
    ordem: String(treinamento.ordem ?? 0),
    ativo: treinamento.ativo ?? true,
    conteudo_json: stringifyJson(treinamento.conteudo_json, '{\n  "etapas": []\n}'),
  };
}

export function CatalogoCogumelos() {
  const { usuario } = useAuth();
  const { data, loading, fetch } = useProdutos();
  const { post: createProduto, loading: creatingProduto } = useCreateProdutoCatalogo();
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>('');
  const [produtoForm, setProdutoForm] = useState(emptyProdutoForm);
  const [perfilForm, setPerfilForm] = useState(emptyPerfilForm);
  const [treinamentoForm, setTreinamentoForm] = useState(emptyTreinamentoForm);
  const [trainingMode, setTrainingMode] = useState<'new' | 'edit'>('new');

  const { put: updateProduto, loading: updatingProduto } = useUpdateProdutoCatalogo(selectedProdutoId || 'novo');
  const { post: createTreinamento, loading: creatingTreinamento } = useCreateProdutoTreinamentoCatalogo(selectedProdutoId || 'novo');
  const { put: updateTreinamento, loading: updatingTreinamento } = useUpdateProdutoTreinamentoCatalogo(
    selectedProdutoId || 'novo',
    treinamentoForm.id || 'novo',
  );
  const { delete: deleteTreinamento, loading: deletingTreinamento } = useDeleteProdutoTreinamentoCatalogo(
    selectedProdutoId || 'novo',
    treinamentoForm.id || 'novo',
  );

  const produtos = useMemo<ProdutoCatalogo[]>(
    () => (data as any)?.produtos || [],
    [data],
  );

  const selectedProduto = useMemo(
    () => produtos.find((produto) => produto.id === selectedProdutoId) || null,
    [produtos, selectedProdutoId],
  );

  const refreshCatalogo = async (nextSelectedId?: string) => {
    const result = await fetch({
      include_inactive: 'true',
      include_inactive_trainings: 'true',
    });
    const produtosAtualizados: ProdutoCatalogo[] = result?.produtos || [];
    if (nextSelectedId) {
      setSelectedProdutoId(nextSelectedId);
      return;
    }
    if (!produtosAtualizados.length) {
      setSelectedProdutoId('');
      return;
    }
    setSelectedProdutoId((current) => {
      if (current && produtosAtualizados.some((produto) => produto.id === current)) {
        return current;
      }
      return produtosAtualizados[0].id;
    });
  };

  useEffect(() => {
    void refreshCatalogo();
  }, []);

  useEffect(() => {
    if (!selectedProduto) {
      setProdutoForm(emptyProdutoForm);
      setPerfilForm(emptyPerfilForm);
      setTreinamentoForm(emptyTreinamentoForm);
      setTrainingMode('new');
      return;
    }

    setProdutoForm(getProdutoFormFromCatalogo(selectedProduto));
    setPerfilForm(getPerfilFormFromCatalogo(selectedProduto));
    setTreinamentoForm(emptyTreinamentoForm);
    setTrainingMode('new');
  }, [selectedProduto]);

  const handleNewProduto = () => {
    setSelectedProdutoId('');
    setProdutoForm(emptyProdutoForm);
    setPerfilForm(emptyPerfilForm);
    setTreinamentoForm(emptyTreinamentoForm);
    setTrainingMode('new');
  };

  const handleSaveProduto = async () => {
    const payload = {
      nome: produtoForm.nome.trim(),
      variedade: produtoForm.variedade.trim() || null,
      descricao: produtoForm.descricao.trim() || null,
      peso_medio_g: parseNumberOrNull(produtoForm.peso_medio_g),
      preco_kg: parseNumberOrNull(produtoForm.preco_kg),
      tempo_cultivo_dias: parseIntegerOrNull(produtoForm.tempo_cultivo_dias),
      temperatura_ideal_min: parseNumberOrNull(produtoForm.temperatura_ideal_min),
      temperatura_ideal_max: parseNumberOrNull(produtoForm.temperatura_ideal_max),
      umidade_ideal_min: parseNumberOrNull(produtoForm.umidade_ideal_min),
      umidade_ideal_max: parseNumberOrNull(produtoForm.umidade_ideal_max),
      ativo: produtoForm.ativo,
    };

    if (!payload.nome) {
      toast.error('Informe o nome do tipo de cogumelo.');
      return;
    }

    const perfilPayload = {
      co2_ideal_max: parseNumberOrNull(perfilForm.co2_ideal_max),
      luminosidade_min_lux: parseNumberOrNull(perfilForm.luminosidade_min_lux),
      luminosidade_max_lux: parseNumberOrNull(perfilForm.luminosidade_max_lux),
      ciclo_estimado_dias_min: parseIntegerOrNull(perfilForm.ciclo_estimado_dias_min),
      ciclo_estimado_dias_max: parseIntegerOrNull(perfilForm.ciclo_estimado_dias_max),
      parametros_fases_json: parseJsonField('parâmetros por fase', perfilForm.parametros_fases_json),
      recomendacoes_json: parseJsonField('recomendações operacionais', perfilForm.recomendacoes_json),
      observacoes: perfilForm.observacoes.trim() || null,
      ativo: perfilForm.ativo,
    };

    const produtoResponse = selectedProdutoId
      ? await updateProduto(payload)
      : await createProduto(payload);

    const produtoSalvo = produtoResponse?.produto;
    const produtoId = produtoSalvo?.id || selectedProdutoId;
    if (!produtoId) {
      throw new Error('Não foi possível determinar o produto salvo.');
    }

    await fetchServer(`/produtos/${produtoId}/perfil`, {
      method: 'PUT',
      body: JSON.stringify(perfilPayload),
    });
    await refreshCatalogo(produtoId);
  };

  const handleEditTreinamento = (treinamento: ProdutoTreinamento) => {
    setTreinamentoForm(getTreinamentoForm(treinamento));
    setTrainingMode('edit');
  };

  const handleNewTreinamento = () => {
    setTreinamentoForm(emptyTreinamentoForm);
    setTrainingMode('new');
  };

  const handleSaveTreinamento = async () => {
    if (!selectedProdutoId) {
      toast.error('Selecione ou crie um tipo de cogumelo antes de editar treinamentos.');
      return;
    }

    const payload = {
      slug: treinamentoForm.slug.trim(),
      categoria: treinamentoForm.categoria.trim() || 'operacional',
      titulo: treinamentoForm.titulo.trim(),
      objetivo: treinamentoForm.objetivo.trim() || null,
      ordem: parseIntegerOrNull(treinamentoForm.ordem) ?? 0,
      ativo: treinamentoForm.ativo,
      conteudo_json: parseJsonField('conteúdo do treinamento', treinamentoForm.conteudo_json),
    };

    if (!payload.slug || !payload.titulo) {
      toast.error('Slug e título do treinamento são obrigatórios.');
      return;
    }

    if (trainingMode === 'edit' && treinamentoForm.id) {
      await updateTreinamento(payload);
    } else {
      await createTreinamento(payload);
    }

    await refreshCatalogo(selectedProdutoId);
    handleNewTreinamento();
  };

  const handleDeleteTreinamento = async () => {
    if (!selectedProdutoId || !treinamentoForm.id) return;
    await deleteTreinamento();
    await refreshCatalogo(selectedProdutoId);
    handleNewTreinamento();
  };

  if (usuario?.tipo_usuario !== 'admin') {
    return (
      <div className="p-6">
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <ShieldAlert size={20} />
              Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-900">
            Apenas administradores podem gerenciar o catálogo mestre de cogumelos.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Catálogo de Cogumelos
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Fonte central de verdade para espécies, perfis de cultivo e treinamentos.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={handleNewProduto}>
          <Plus size={16} className="mr-2" />
          Novo tipo
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Espécies e variedades</span>
              <Badge variant="secondary">{produtos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && <p className="text-sm text-gray-500">Carregando catálogo...</p>}
            {!loading && !produtos.length && (
              <p className="text-sm text-gray-500">Nenhum tipo de cogumelo cadastrado ainda.</p>
            )}
            {produtos.map((produto) => (
              <button
                type="button"
                key={produto.id}
                onClick={() => setSelectedProdutoId(produto.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selectedProdutoId === produto.id
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-[#E3E3E3] hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#1A1A1A]">{produto.nome}</p>
                    <p className="text-sm text-gray-500">{produto.variedade || 'Sem variedade definida'}</p>
                  </div>
                  <Badge variant={produto.ativo ? 'default' : 'secondary'}>
                    {produto.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  {produto.perfil_cultivo && <span>Perfil configurado</span>}
                  <span>{produto.treinamentos?.length || 0} treinamentos</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Tabs defaultValue="produto" className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-3">
            <TabsTrigger value="produto">Produto</TabsTrigger>
            <TabsTrigger value="perfil">Perfil de Cultivo</TabsTrigger>
            <TabsTrigger value="treinamentos">Treinamentos</TabsTrigger>
          </TabsList>

          <TabsContent value="produto">
            <Card>
              <CardHeader>
                <CardTitle>{selectedProdutoId ? 'Editar tipo de cogumelo' : 'Novo tipo de cogumelo'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={produtoForm.nome} onChange={(e) => setProdutoForm((prev) => ({ ...prev, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Variedade</Label>
                    <Input value={produtoForm.variedade} onChange={(e) => setProdutoForm((prev) => ({ ...prev, variedade: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea rows={3} value={produtoForm.descricao} onChange={(e) => setProdutoForm((prev) => ({ ...prev, descricao: e.target.value }))} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Peso médio (g)</Label>
                    <Input value={produtoForm.peso_medio_g} onChange={(e) => setProdutoForm((prev) => ({ ...prev, peso_medio_g: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço por kg</Label>
                    <Input value={produtoForm.preco_kg} onChange={(e) => setProdutoForm((prev) => ({ ...prev, preco_kg: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tempo de cultivo (dias)</Label>
                    <Input value={produtoForm.tempo_cultivo_dias} onChange={(e) => setProdutoForm((prev) => ({ ...prev, tempo_cultivo_dias: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura ideal mínima</Label>
                    <Input value={produtoForm.temperatura_ideal_min} onChange={(e) => setProdutoForm((prev) => ({ ...prev, temperatura_ideal_min: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura ideal máxima</Label>
                    <Input value={produtoForm.temperatura_ideal_max} onChange={(e) => setProdutoForm((prev) => ({ ...prev, temperatura_ideal_max: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Umidade ideal mínima</Label>
                    <Input value={produtoForm.umidade_ideal_min} onChange={(e) => setProdutoForm((prev) => ({ ...prev, umidade_ideal_min: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Umidade ideal máxima</Label>
                    <Input value={produtoForm.umidade_ideal_max} onChange={(e) => setProdutoForm((prev) => ({ ...prev, umidade_ideal_max: e.target.value }))} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={produtoForm.ativo}
                    onCheckedChange={(checked) => setProdutoForm((prev) => ({ ...prev, ativo: checked }))}
                  />
                  <Label>Produto ativo no sistema</Label>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => void handleSaveProduto()}
                    disabled={creatingProduto || updatingProduto}
                  >
                    <Save size={16} className="mr-2" />
                    Salvar produto e perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="perfil">
            <Card>
              <CardHeader>
                <CardTitle>Perfil de cultivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>CO₂ ideal máximo (ppm)</Label>
                    <Input value={perfilForm.co2_ideal_max} onChange={(e) => setPerfilForm((prev) => ({ ...prev, co2_ideal_max: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Luminosidade mínima (lux)</Label>
                    <Input value={perfilForm.luminosidade_min_lux} onChange={(e) => setPerfilForm((prev) => ({ ...prev, luminosidade_min_lux: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Luminosidade máxima (lux)</Label>
                    <Input value={perfilForm.luminosidade_max_lux} onChange={(e) => setPerfilForm((prev) => ({ ...prev, luminosidade_max_lux: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciclo estimado mínimo (dias)</Label>
                    <Input type="number" min="0" value={perfilForm.ciclo_estimado_dias_min} onChange={(e) => setPerfilForm((prev) => ({ ...prev, ciclo_estimado_dias_min: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciclo estimado máximo (dias)</Label>
                    <Input type="number" min="0" value={perfilForm.ciclo_estimado_dias_max} onChange={(e) => setPerfilForm((prev) => ({ ...prev, ciclo_estimado_dias_max: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Parâmetros por fase (JSON)</Label>
                  <Textarea rows={10} value={perfilForm.parametros_fases_json} onChange={(e) => setPerfilForm((prev) => ({ ...prev, parametros_fases_json: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Recomendações operacionais (JSON)</Label>
                  <Textarea rows={8} value={perfilForm.recomendacoes_json} onChange={(e) => setPerfilForm((prev) => ({ ...prev, recomendacoes_json: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea rows={4} value={perfilForm.observacoes} onChange={(e) => setPerfilForm((prev) => ({ ...prev, observacoes: e.target.value }))} />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={perfilForm.ativo}
                    onCheckedChange={(checked) => setPerfilForm((prev) => ({ ...prev, ativo: checked }))}
                  />
                  <Label>Perfil ativo</Label>
                </div>

                <div className="rounded-xl border border-[#E3E3E3] bg-[#F8F6F2] p-4 text-sm text-gray-600">
                  O perfil de cultivo centraliza CO₂, luminosidade, ciclo e recomendações por espécie. O backend usa fallback seguro se algum campo complementar não existir.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="treinamentos">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Treinamentos cadastrados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedProduto && (
                    <p className="text-sm text-gray-500">Selecione um tipo de cogumelo para gerenciar treinamentos.</p>
                  )}
                  {selectedProduto?.treinamentos?.map((treinamento) => (
                    <button
                      type="button"
                      key={treinamento.id}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        treinamentoForm.id === treinamento.id
                          ? 'border-emerald-600 bg-emerald-50'
                          : 'border-[#E3E3E3] hover:border-emerald-300'
                      }`}
                      onClick={() => handleEditTreinamento(treinamento)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#1A1A1A]">{treinamento.titulo}</p>
                          <p className="text-sm text-gray-500">{treinamento.slug}</p>
                        </div>
                        <Badge variant={treinamento.ativo ? 'default' : 'secondary'}>
                          {treinamento.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                        <span>{treinamento.categoria}</span>
                        <span>Ordem {treinamento.ordem ?? 0}</span>
                      </div>
                    </button>
                  ))}
                  {!!selectedProduto && (
                    <Button type="button" variant="outline" onClick={handleNewTreinamento}>
                      <Plus size={16} className="mr-2" />
                      Novo treinamento
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{trainingMode === 'edit' ? 'Editar treinamento' : 'Novo treinamento'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Slug *</Label>
                    <Input value={treinamentoForm.slug} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, slug: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input value={treinamentoForm.categoria} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, categoria: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input value={treinamentoForm.titulo} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, titulo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Objetivo</Label>
                    <Textarea rows={3} value={treinamentoForm.objetivo} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, objetivo: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ordem</Label>
                    <Input value={treinamentoForm.ordem} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, ordem: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={treinamentoForm.ativo}
                      onCheckedChange={(checked) => setTreinamentoForm((prev) => ({ ...prev, ativo: checked }))}
                    />
                    <Label>Treinamento ativo</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Conteúdo (JSON)</Label>
                    <Textarea rows={12} value={treinamentoForm.conteudo_json} onChange={(e) => setTreinamentoForm((prev) => ({ ...prev, conteudo_json: e.target.value }))} />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      onClick={() => void handleSaveTreinamento()}
                      disabled={!selectedProduto || creatingTreinamento || updatingTreinamento}
                    >
                      <Save size={16} className="mr-2" />
                      Salvar treinamento
                    </Button>
                    {trainingMode === 'edit' && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleDeleteTreinamento()}
                        disabled={deletingTreinamento}
                      >
                        Remover treinamento
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Card className="border-l-4 border-l-emerald-600 bg-emerald-50">
        <CardContent className="pt-6 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="mt-0.5" />
            <div>
              <p className="font-semibold">Estratégia aplicada</p>
              <p>
                <strong>produtos</strong> seguem como catálogo principal. Perfil de cultivo e treinamentos ficam acoplados ao produto no banco, com fallback para o conteúdo legado enquanto o catálogo é completado.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
