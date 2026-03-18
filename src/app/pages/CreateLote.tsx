import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { ArrowLeft, Loader2, QrCode } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { fetchServer } from '../../utils/supabase/client';
import { useCreateLote, useProdutos, useSalas, useUpdateLote } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';

interface ProdutoItem {
  id: string;
  nome: string;
  variedade?: string | null;
  tempo_cultivo_dias?: number | null;
  temperatura_ideal_min?: number | null;
  temperatura_ideal_max?: number | null;
  umidade_ideal_min?: number | null;
  umidade_ideal_max?: number | null;
  peso_medio_g?: number | null;
  preco_kg?: number | null;
  perfil_cultivo?: {
    ciclo_estimado_dias_min?: number | null;
    ciclo_estimado_dias_max?: number | null;
    ciclo_min_dias?: number | null;
    ciclo_max_dias?: number | null;
    co2_ideal_max?: number | null;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
    recomendacoes_json?: {
      resumo?: string | null;
    } | null;
  } | null;
}

interface SalaItem {
  id: string;
  codigo: string;
  nome: string;
  tipo?: string | null;
  ativa?: boolean | null;
}

interface LoteResponse {
  id: string;
  produto_id?: string | null;
  data_inicio?: string | null;
  data_previsao_colheita?: string | null;
  quantidade_inicial?: number | null;
  unidade?: string | null;
  sala?: string | null;
  sala_id?: string | null;
  prateleira?: string | null;
  temperatura_atual?: number | null;
  umidade_atual?: number | null;
  observacoes?: string | null;
  sala_ref?: {
    id?: string | null;
    nome?: string | null;
  } | null;
}

const MANUAL_SALA_VALUE = '__manual__';

const INITIAL_FORM = {
  produto_id: '',
  data_inicio: format(new Date(), 'yyyy-MM-dd'),
  data_previsao_colheita: '',
  quantidade_inicial: 0,
  unidade: 'kg',
  sala: '',
  sala_id: '',
  prateleira: '',
  temperatura_atual: 0,
  umidade_atual: 0,
  observacoes: '',
};

export function CreateLote() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { data: produtosData, loading: produtosLoading, fetch: fetchProdutos } = useProdutos();
  const { data: salasData, loading: salasLoading, fetch: fetchSalas } = useSalas();
  const { post: createLote, loading: creating } = useCreateLote();
  const { put: updateLote, loading: updating } = useUpdateLote(id || '');
  const [loteLoading, setLoteLoading] = useState(false);
  const [manualSalaMode, setManualSalaMode] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);

  useEffect(() => {
    void fetchProdutos();
    void fetchSalas();
  }, [fetchProdutos, fetchSalas]);

  useEffect(() => {
    if (!id) return;

    async function loadLote() {
      try {
        setLoteLoading(true);
        const result = await fetchServer(`/lotes/${id}`);
        const lote = (result?.lote || null) as LoteResponse | null;

        if (!lote) {
          toast.error('Lote não encontrado.');
          navigate('/lotes');
          return;
        }

        const resolvedSalaId = lote.sala_id || lote.sala_ref?.id || '';
        const resolvedSala = lote.sala_ref?.nome || lote.sala || '';

        setManualSalaMode(!resolvedSalaId && Boolean(resolvedSala));
        setFormData({
          produto_id: lote.produto_id || '',
          data_inicio: lote.data_inicio || format(new Date(), 'yyyy-MM-dd'),
          data_previsao_colheita: lote.data_previsao_colheita || '',
          quantidade_inicial: lote.quantidade_inicial || 0,
          unidade: lote.unidade || 'kg',
          sala: resolvedSala,
          sala_id: resolvedSalaId,
          prateleira: lote.prateleira || '',
          temperatura_atual: lote.temperatura_atual || 0,
          umidade_atual: lote.umidade_atual || 0,
          observacoes: lote.observacoes || '',
        });
      } catch (error) {
        console.error('Erro ao carregar lote:', error);
        toast.error('Não foi possível carregar o lote para edição.');
      } finally {
        setLoteLoading(false);
      }
    }

    void loadLote();
  }, [id, navigate]);

  const produtos = useMemo(() => (produtosData?.produtos || []) as ProdutoItem[], [produtosData?.produtos]);
  const salas = useMemo(() => (salasData?.salas || []) as SalaItem[], [salasData?.salas]);
  const usingManualSalaInput = salas.length === 0 || manualSalaMode;
  const saving = creating || updating;

  useEffect(() => {
    const produto = produtos.find((item) => item.id === formData.produto_id);
    if (!produto?.tempo_cultivo_dias || !formData.data_inicio) return;

    const dataInicio = parseISO(formData.data_inicio);
    if (!isValid(dataInicio)) return;

    setFormData((current) => {
      const dataBase = parseISO(current.data_inicio);
      if (!isValid(dataBase)) return current;

      const dataPrevisao = addDays(dataBase, produto.tempo_cultivo_dias || 0);
      const proximaPrevisao = format(dataPrevisao, 'yyyy-MM-dd');

      if (current.data_previsao_colheita === proximaPrevisao) {
        return current;
      }

      return {
        ...current,
        data_previsao_colheita: proximaPrevisao,
      };
    });
  }, [formData.data_inicio, formData.produto_id, produtos]);

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find((item) => item.id === produtoId);

    if (produto?.tempo_cultivo_dias) {
      const dataInicio = parseISO(formData.data_inicio);
      const dataPrevisao = isValid(dataInicio) ? addDays(dataInicio, produto.tempo_cultivo_dias) : null;

      setFormData((current) => ({
        ...current,
        produto_id: produtoId,
        data_previsao_colheita: dataPrevisao ? format(dataPrevisao, 'yyyy-MM-dd') : '',
        temperatura_atual: produto.temperatura_ideal_min || 0,
        umidade_atual: produto.umidade_ideal_min || 0,
      }));
      return;
    }

    setFormData((current) => ({ ...current, produto_id: produtoId }));
  };

  const handleSalaChange = (value: string) => {
    if (value === MANUAL_SALA_VALUE) {
      setManualSalaMode(true);
      setFormData((current) => ({
        ...current,
        sala_id: '',
      }));
      return;
    }

    const salaSelecionada = salas.find((item) => item.id === value);
    setManualSalaMode(false);
    setFormData((current) => ({
      ...current,
      sala_id: value,
      sala: salaSelecionada?.nome || current.sala,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      ...formData,
      quantidade_inicial: Number(formData.quantidade_inicial) || 0,
      temperatura_atual: Number(formData.temperatura_atual) || 0,
      umidade_atual: Number(formData.umidade_atual) || 0,
      sala: formData.sala.trim(),
      sala_id: formData.sala_id || undefined,
    };

    if (!payload.sala && !payload.sala_id) {
      toast.error('Selecione uma sala ou informe o nome legado da sala.');
      return;
    }

    try {
      if (isEditing) {
        await updateLote(payload);
      } else {
        await createLote(payload);
      }

      navigate('/lotes');
    } catch (error) {
      console.error('Erro ao salvar lote:', error);
    }
  };

  if (produtosLoading || salasLoading || loteLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate(isEditing && id ? `/lotes/${id}` : '/lotes')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-['Cormorant_Garamond'] text-[42px] font-bold leading-none text-[#1A1A1A]">
            {isEditing ? 'Editar Lote' : 'Criar Novo Lote'}
          </h1>
          <p className="mt-1 text-[#1A1A1A]/70">
            {isEditing
              ? 'Atualize a sala operacional e os dados principais do lote.'
              : 'Inicie um novo ciclo de produção com sala operacional definida.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Lote</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label>Produto / Variedade *</Label>
                  <Select value={formData.produto_id} onValueChange={handleProdutoChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">Nenhum produto cadastrado</div>
                      ) : (
                        produtos.map((produto) => (
                          <SelectItem key={produto.id} value={produto.id}>
                            {produto.nome}
                            {produto.variedade ? ` - ${produto.variedade}` : ''}
                            {produto.tempo_cultivo_dias ? ` (${produto.tempo_cultivo_dias} dias)` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Data de Início *</Label>
                    <Input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(event) => setFormData((current) => ({ ...current, data_inicio: event.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Previsão de Colheita</Label>
                    <Input
                      type="date"
                      value={formData.data_previsao_colheita}
                      onChange={(event) => setFormData((current) => ({ ...current, data_previsao_colheita: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quantidade Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.quantidade_inicial || ''}
                      onChange={(event) => setFormData((current) => ({
                        ...current,
                        quantidade_inicial: Number.parseFloat(event.target.value) || 0,
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select
                      value={formData.unidade}
                      onValueChange={(value) => setFormData((current) => ({ ...current, unidade: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                        <SelectItem value="unidades">Unidades</SelectItem>
                        <SelectItem value="blocos">Blocos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Sala operacional *</Label>
                    {salas.length > 0 ? (
                      <Select
                        value={usingManualSalaInput ? MANUAL_SALA_VALUE : formData.sala_id}
                        onValueChange={handleSalaChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a sala" />
                        </SelectTrigger>
                        <SelectContent>
                          {salas.map((sala) => (
                            <SelectItem key={sala.id} value={sala.id}>
                              {sala.nome} {sala.ativa === false ? '(inativa)' : ''}
                            </SelectItem>
                          ))}
                          <SelectItem value={MANUAL_SALA_VALUE}>Usar nome legado/manual</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : null}

                    {usingManualSalaInput ? (
                      <Input
                        placeholder="Ex: Sala A, Incubação 2"
                        value={formData.sala}
                        onChange={(event) => setFormData((current) => ({
                          ...current,
                          sala: event.target.value,
                          sala_id: '',
                        }))}
                        required
                      />
                    ) : (
                      <p className="text-xs text-[#1A1A1A]/60">
                        O ambiente do lote passa a usar a leitura mais recente da sala selecionada.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Prateleira</Label>
                    <Input
                      placeholder="Ex: Prateleira 3"
                      value={formData.prateleira}
                      onChange={(event) => setFormData((current) => ({ ...current, prateleira: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Temperatura Inicial (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="20.0"
                      value={formData.temperatura_atual || ''}
                      onChange={(event) => setFormData((current) => ({
                        ...current,
                        temperatura_atual: Number.parseFloat(event.target.value) || 0,
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Umidade Inicial (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="85"
                      value={formData.umidade_atual || ''}
                      onChange={(event) => setFormData((current) => ({
                        ...current,
                        umidade_atual: Number.parseFloat(event.target.value) || 0,
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Informações adicionais sobre o lote..."
                    rows={3}
                    value={formData.observacoes}
                    onChange={(event) => setFormData((current) => ({ ...current, observacoes: event.target.value }))}
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(isEditing && id ? `/lotes/${id}` : '/lotes')}
                    className="flex-1"
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={saving || produtos.length === 0}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : isEditing ? (
                      'Salvar Lote'
                    ) : (
                      'Criar Lote'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-[#546A4A] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Rastreabilidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm opacity-90">
                {isEditing
                  ? 'A sala escolhida passa a ser a referência operacional de ambiente do lote.'
                  : 'Ao criar o lote, um código único será gerado para rastreabilidade completa e vínculo com o ambiente da sala.'}
              </p>
            </CardContent>
          </Card>

          {formData.produto_id ? (
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros Ideais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const produto = produtos.find((item) => item.id === formData.produto_id);
                  if (!produto) return null;

                  return (
                    <div>
                      <h4 className="mb-2 font-semibold">{produto.nome}</h4>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {produto.temperatura_ideal_min && produto.temperatura_ideal_max ? (
                          <li>• Temperatura: {produto.temperatura_ideal_min}°C - {produto.temperatura_ideal_max}°C</li>
                        ) : null}
                        {produto.umidade_ideal_min && produto.umidade_ideal_max ? (
                          <li>• Umidade: {produto.umidade_ideal_min}% - {produto.umidade_ideal_max}%</li>
                        ) : null}
                        {produto.tempo_cultivo_dias ? <li>• Ciclo: ~{produto.tempo_cultivo_dias} dias</li> : null}
                        {(produto?.perfil_cultivo?.ciclo_estimado_dias_min ?? produto?.perfil_cultivo?.ciclo_min_dias) &&
                        (produto?.perfil_cultivo?.ciclo_estimado_dias_max ?? produto?.perfil_cultivo?.ciclo_max_dias) ? (
                          <li>
                            • Ciclo operacional: {produto.perfil_cultivo?.ciclo_estimado_dias_min ?? produto.perfil_cultivo?.ciclo_min_dias}
                            {' - '}
                            {produto.perfil_cultivo?.ciclo_estimado_dias_max ?? produto.perfil_cultivo?.ciclo_max_dias} dias
                          </li>
                        ) : null}
                        {produto.peso_medio_g ? <li>• Peso médio: {produto.peso_medio_g}g</li> : null}
                        {produto?.perfil_cultivo?.co2_ideal_max ? <li>• CO₂ ideal máximo: {produto.perfil_cultivo.co2_ideal_max} ppm</li> : null}
                        {produto?.perfil_cultivo?.luminosidade_min_lux !== null &&
                        produto?.perfil_cultivo?.luminosidade_min_lux !== undefined &&
                        produto?.perfil_cultivo?.luminosidade_max_lux !== null &&
                        produto?.perfil_cultivo?.luminosidade_max_lux !== undefined ? (
                          <li>
                            • Luminosidade: {produto.perfil_cultivo.luminosidade_min_lux} - {produto.perfil_cultivo.luminosidade_max_lux} lux
                          </li>
                        ) : null}
                      </ul>
                      {produto?.perfil_cultivo?.recomendacoes_json?.resumo ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                          <strong>Recomendação:</strong> {produto.perfil_cultivo.recomendacoes_json.resumo}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          ) : null}

          {!formData.produto_id && produtos.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Produtos Disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {produtos.slice(0, 5).map((produto) => (
                  <div key={produto.id} className="border-l-4 border-emerald-500 pl-3">
                    <h4 className="font-semibold">{produto.nome}</h4>
                    <p className="text-sm text-gray-600">
                      {produto.tempo_cultivo_dias ? `${produto.tempo_cultivo_dias} dias` : ''}
                      {produto.preco_kg ? ` • R$ ${produto.preco_kg}/kg` : ''}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Referência Operacional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[#1A1A1A]/75">
              <p>
                O lote continua guardando seu contexto próprio, mas o ambiente operacional passa a ser resolvido pela sala.
              </p>
              <p>
                Isso permite que novos lotes na mesma sala usem imediatamente o sensor correto, mesmo durante a transição dos dados legados.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
