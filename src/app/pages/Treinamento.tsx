import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Droplets,
  FileText,
  Play,
  RotateCcw,
  Shield,
  Thermometer,
  Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';

interface Etapa {
  id: string;
  titulo: string;
  descricao: string;
  concluida: boolean;
}

interface Processo {
  id: string;
  titulo: string;
  objetivo: string;
  icon: string;
  color: string;
  etapas: Etapa[];
  iniciado: boolean;
  concluido: boolean;
  progresso: number;
}

interface ProdutoTreinamento {
  id: string;
  slug: string;
  categoria: string;
  titulo: string;
  objetivo?: string | null;
  conteudo_json?: Record<string, any>;
  ordem?: number;
  ativo?: boolean;
}

interface ProdutoCatalogo {
  id: string;
  nome: string;
  variedade?: string | null;
  tempo_cultivo_dias?: number | null;
  temperatura_ideal_min?: number | null;
  temperatura_ideal_max?: number | null;
  umidade_ideal_min?: number | null;
  umidade_ideal_max?: number | null;
  perfil_cultivo?: {
    co2_ideal_max?: number | null;
    luminosidade_min_lux?: number | null;
    luminosidade_max_lux?: number | null;
    ciclo_min_dias?: number | null;
    ciclo_max_dias?: number | null;
    parametros_fases_json?: Record<string, any>;
    recomendacoes_json?: Record<string, any>;
  } | null;
  treinamentos?: ProdutoTreinamento[];
}

interface IdealParameterRow {
  variety: string;
  temp: string;
  humidity: string;
  light: string;
  cycle: string;
  co2: string;
}

function formatRange(min?: number | null, max?: number | null, suffix = '') {
  if (min === null || min === undefined || max === null || max === undefined) return 'N/D';
  return `${min}-${max}${suffix}`;
}

function formatCycle(min?: number | null, max?: number | null, fallback?: number | null) {
  if (min !== null && min !== undefined && max !== null && max !== undefined) {
    return `${min}-${max} dias`;
  }
  if (fallback !== null && fallback !== undefined) {
    return `~${fallback} dias`;
  }
  return 'N/D';
}

function mergeProcessosComProgresso(definicoes: Processo[], processosPersistidos: Processo[]) {
  const processosMap = new Map(processosPersistidos.map((processo) => [processo.id, processo]));

  return definicoes.map((processo) => {
    const persisted = processosMap.get(processo.id);
    if (!persisted) return processo;

    const etapasMap = new Map(persisted.etapas.map((etapa) => [etapa.id, etapa]));
    const etapas = processo.etapas.map((etapa) => ({
      ...etapa,
      concluida: etapasMap.get(etapa.id)?.concluida ?? false,
    }));

    const etapasConcluidas = etapas.filter((etapa) => etapa.concluida).length;
    const progresso = etapas.length ? Math.round((etapasConcluidas / etapas.length) * 100) : 0;

    return {
      ...processo,
      etapas,
      iniciado: persisted.iniciado || progresso > 0,
      concluido: progresso === 100,
      progresso,
    };
  });
}

function mergePersistedProcessos(processosAtuais: Processo[], processosPersistidos: Processo[]) {
  const persistedMap = new Map(processosPersistidos.map((processo) => [processo.id, processo]));

  for (const processo of processosAtuais) {
    persistedMap.set(processo.id, processo);
  }

  return Array.from(persistedMap.values());
}

function getTrainingVisuals(categoria: string, slug: string) {
  if (slug.includes('contaminacao') || categoria === 'qualidade') {
    return { icon: 'Shield', color: 'bg-red-700' };
  }

  if (slug.includes('frutificacao')) {
    return { icon: 'Droplets', color: 'bg-emerald-600' };
  }

  if (slug.includes('incubacao')) {
    return { icon: 'BookOpen', color: 'bg-[#1A1A1A]' };
  }

  return { icon: 'FileText', color: 'bg-[#546A4A]' };
}

function buildEtapasFromConteudo(processoId: string, conteudo: Record<string, any> | undefined) {
  const etapasArray = Array.isArray(conteudo?.etapas) ? conteudo.etapas : [];
  if (etapasArray.length) {
    return etapasArray.map((etapa: any, index: number) => ({
      id: `${processoId}:etapa:${index + 1}`,
      titulo: String(etapa?.titulo || `Etapa ${index + 1}`),
      descricao: String(etapa?.descricao || ''),
      concluida: false,
    }));
  }

  const sinais = Array.isArray(conteudo?.sinais) ? conteudo.sinais : [];
  const acoes = Array.isArray(conteudo?.acao_imediata) ? conteudo.acao_imediata : [];
  if (sinais.length || acoes.length) {
    return [
      ...sinais.map((sinal: string, index: number) => ({
        id: `${processoId}:sinal:${index + 1}`,
        titulo: `Sinal de atenção ${index + 1}`,
        descricao: String(sinal),
        concluida: false,
      })),
      ...acoes.map((acao: string, index: number) => ({
        id: `${processoId}:acao:${index + 1}`,
        titulo: `Ação imediata ${index + 1}`,
        descricao: String(acao),
        concluida: false,
      })),
    ];
  }

  return [
    {
      id: `${processoId}:fallback:1`,
      titulo: 'Revisar conteúdo operacional',
      descricao: 'Conteúdo cadastrado sem etapas estruturadas. Revise o treinamento no catálogo.',
      concluida: false,
    },
  ];
}

function buildCatalogProcessos(produto: ProdutoCatalogo): Processo[] {
  const treinamentos = (produto.treinamentos || []).filter((treinamento) => treinamento.ativo !== false);
  if (!treinamentos.length) return [];

  return treinamentos.map((treinamento) => {
    const processoId = `produto:${produto.id}:${treinamento.slug}`;
    const { icon, color } = getTrainingVisuals(treinamento.categoria || 'operacional', treinamento.slug || 'treinamento');

    return {
      id: processoId,
      titulo: treinamento.titulo,
      objetivo: treinamento.objetivo || 'Treinamento operacional do cultivo',
      icon,
      color,
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: buildEtapasFromConteudo(processoId, treinamento.conteudo_json),
    };
  });
}

function renderProcessIcon(icon: string) {
  if (icon === 'Shield') return <Shield size={28} />;
  if (icon === 'Thermometer') return <Thermometer size={28} />;
  if (icon === 'Droplets') return <Droplets size={28} />;
  if (icon === 'BookOpen') return <BookOpen size={28} />;
  return <FileText size={28} />;
}

const fallbackProcessos: Processo[] = [
  {
    id: 'legacy:limpeza-preparo',
    titulo: 'Limpeza e Preparação do Ambiente',
    objetivo: 'Eliminar poeira, fungos e bactérias da sala de cultivo',
    icon: 'Shield',
    color: 'bg-[#546A4A]',
    iniciado: false,
    concluido: false,
    progresso: 0,
    etapas: [
      { id: 'legacy:1-1', titulo: 'Limpeza seca', descricao: 'Remover sujeira sem levantar poeira excessiva.', concluida: false },
      { id: 'legacy:1-2', titulo: 'Desinfecção', descricao: 'Sanitizar bancadas, prateleiras e superfícies críticas.', concluida: false },
      { id: 'legacy:1-3', titulo: 'Isolamento', descricao: 'Reduzir circulação e estabilizar o ambiente antes da inoculação.', concluida: false },
    ],
  },
  {
    id: 'legacy:inoculacao',
    titulo: 'Inoculação',
    objetivo: 'Injetar o micélio sem permitir contaminação externa.',
    icon: 'FileText',
    color: 'bg-red-700',
    iniciado: false,
    concluido: false,
    progresso: 0,
    etapas: [
      { id: 'legacy:4-1', titulo: 'Área limpa', descricao: 'Preparar bancada e EPIs antes de abrir o saco.', concluida: false },
      { id: 'legacy:4-2', titulo: 'Aplicação', descricao: 'Aplicar a cultura líquida no saco esterilizado com vedação imediata.', concluida: false },
      { id: 'legacy:4-3', titulo: 'Registro', descricao: 'Registrar lote inoculado e iniciar incubação.', concluida: false },
    ],
  },
  {
    id: 'legacy:incubacao',
    titulo: 'Incubação e Colonização',
    objetivo: 'Consolidar o bloco no escuro antes da frutificação.',
    icon: 'BookOpen',
    color: 'bg-[#1A1A1A]',
    iniciado: false,
    concluido: false,
    progresso: 0,
    etapas: [
      { id: 'legacy:5-1', titulo: 'Posicionamento', descricao: 'Manter blocos espaçados e sem perfurar o saco.', concluida: false },
      { id: 'legacy:5-2', titulo: 'Monitoramento visual', descricao: 'Acompanhar consolidação branca e remover blocos contaminados.', concluida: false },
      { id: 'legacy:5-3', titulo: 'Consolidação', descricao: 'Aguardar consolidação total antes de abrir para frutificação.', concluida: false },
    ],
  },
];

const fallbackIdealParameters: IdealParameterRow[] = [
  { variety: 'Shiitake', temp: '18-22°C', humidity: '80-90%', light: '500-1000 lux', cycle: '18-25 dias', co2: '<1000 ppm' },
  { variety: 'Champignon', temp: '14-18°C', humidity: '85-95%', light: 'Escuro', cycle: '21-28 dias', co2: '<2000 ppm' },
  { variety: 'Shimeji', temp: '16-20°C', humidity: '85-90%', light: '500-1000 lux', cycle: '14-21 dias', co2: '<1500 ppm' },
  { variety: 'Portobello', temp: '16-20°C', humidity: '85-90%', light: 'Escuro', cycle: '28-35 dias', co2: '<2000 ppm' },
];

const videos = [
  { title: 'Como identificar ponto ideal de colheita', duration: '5:23', category: 'Colheita' },
  { title: 'Higienização completa da sala de cultivo', duration: '8:45', category: 'Higiene' },
  { title: 'Configuração de sensores de temperatura', duration: '6:12', category: 'Equipamentos' },
  { title: 'Detectar e prevenir contaminação', duration: '12:34', category: 'Qualidade' },
];

export function Treinamento() {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [produtoSelecionadoId, setProdutoSelecionadoId] = useState<string>('');
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processosPersistidos, setProcessosPersistidos] = useState<Processo[]>([]);
  const [processoExpandido, setProcessoExpandido] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const produtoSelecionado = useMemo(
    () => produtos.find((produto) => produto.id === produtoSelecionadoId) || null,
    [produtos, produtoSelecionadoId],
  );

  const definicoesProcessos = useMemo(() => {
    if (produtoSelecionado) {
      const catalogados = buildCatalogProcessos(produtoSelecionado);
      if (catalogados.length) return catalogados;
    }
    return fallbackProcessos;
  }, [produtoSelecionado]);

  const idealParameters = useMemo<IdealParameterRow[]>(() => {
    if (!produtos.length) return fallbackIdealParameters;

    return produtos.map((produto) => {
      const perfil = produto.perfil_cultivo;
      const lightFromLux = perfil?.luminosidade_min_lux !== null && perfil?.luminosidade_min_lux !== undefined
        && perfil?.luminosidade_max_lux !== null && perfil?.luminosidade_max_lux !== undefined
          ? `${perfil.luminosidade_min_lux}-${perfil.luminosidade_max_lux} lux`
          : String(perfil?.parametros_fases_json?.frutificacao?.luz || 'N/D');

      const co2Label = perfil?.co2_ideal_max ? `<${perfil.co2_ideal_max} ppm` : 'N/D';

      return {
        variety: produto.variedade ? `${produto.nome} • ${produto.variedade}` : produto.nome,
        temp: formatRange(produto.temperatura_ideal_min, produto.temperatura_ideal_max, '°C'),
        humidity: formatRange(produto.umidade_ideal_min, produto.umidade_ideal_max, '%'),
        light: lightFromLux,
        cycle: formatCycle(perfil?.ciclo_min_dias, perfil?.ciclo_max_dias, produto.tempo_cultivo_dias),
        co2: co2Label,
      };
    });
  }, [produtos]);

  const carregarTreinamento = useCallback(async () => {
    try {
      setLoading(true);
      const [catalogoResult, progressoResult] = await Promise.all([
        fetchServer('/produtos'),
        fetchServer('/treinamentos'),
      ]);

      const produtosCatalogo = (catalogoResult?.produtos || []) as ProdutoCatalogo[];
      const processosSalvos = (progressoResult?.processos || []) as Processo[];

      setProdutos(produtosCatalogo);
      setProcessosPersistidos(processosSalvos);
      setProdutoSelecionadoId((atual) => atual || produtosCatalogo[0]?.id || '');
    } catch (error) {
      console.error('Erro ao carregar treinamento:', error);
      setProdutos([]);
      setProcessosPersistidos([]);
      toast.error('Não foi possível carregar o catálogo de treinamento. Usando fallback local.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregarTreinamento();
  }, [carregarTreinamento]);

  useEffect(() => {
    const merged = mergeProcessosComProgresso(definicoesProcessos, processosPersistidos);
    setProcessos(merged);
    setProcessoExpandido((current) => (current && merged.some((item) => item.id === current) ? current : null));
  }, [definicoesProcessos, processosPersistidos]);

  const salvarProgresso = async (processosAtualizados: Processo[]) => {
    const merged = mergePersistedProcessos(processosAtualizados, processosPersistidos);
    setProcessosPersistidos(merged);

    try {
      await fetchServer('/treinamentos', {
        method: 'POST',
        body: JSON.stringify({ processos: merged }),
      });
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
      toast.error('Erro ao salvar progresso do treinamento.');
    }
  };

  const iniciarProcesso = async (processoId: string) => {
    const novosProcessos = processos.map((processo) =>
      processo.id === processoId ? { ...processo, iniciado: true } : processo,
    );
    setProcessos(novosProcessos);
    setProcessoExpandido(processoId);
    await salvarProgresso(novosProcessos);
    toast.success('Processo iniciado!');
  };

  const toggleEtapa = async (processoId: string, etapaId: string) => {
    const novosProcessos = processos.map((processo) => {
      if (processo.id !== processoId) return processo;

      const novasEtapas = processo.etapas.map((etapa) =>
        etapa.id === etapaId ? { ...etapa, concluida: !etapa.concluida } : etapa,
      );

      const etapasConcluidas = novasEtapas.filter((etapa) => etapa.concluida).length;
      const progresso = novasEtapas.length ? Math.round((etapasConcluidas / novasEtapas.length) * 100) : 0;

      return {
        ...processo,
        iniciado: true,
        etapas: novasEtapas,
        progresso,
        concluido: progresso === 100,
      };
    });

    setProcessos(novosProcessos);
    await salvarProgresso(novosProcessos);
  };

  const reiniciarProcesso = async (processoId: string) => {
    const novosProcessos = processos.map((processo) =>
      processo.id === processoId
        ? {
            ...processo,
            iniciado: false,
            concluido: false,
            progresso: 0,
            etapas: processo.etapas.map((etapa) => ({ ...etapa, concluida: false })),
          }
        : processo,
    );

    setProcessos(novosProcessos);
    await salvarProgresso(novosProcessos);
    toast.success('Processo reiniciado!');
  };

  const recomendacoesSelecionadas = produtoSelecionado?.perfil_cultivo?.recomendacoes_json || null;
  const alertasSelecionados = Array.isArray(recomendacoesSelecionadas?.alertas)
    ? recomendacoesSelecionadas.alertas
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A4A]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Treinamento & Processos
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Fluxo operacional guiado pelo catálogo mestre de cogumelos.
          </p>
        </div>

        <div className="w-full max-w-md space-y-2">
          <span className="text-sm font-medium text-[#1A1A1A]">Tipo de cogumelo</span>
          <Select value={produtoSelecionadoId} onValueChange={setProdutoSelecionadoId}>
            <SelectTrigger>
              <SelectValue placeholder={produtos.length ? 'Selecione um cogumelo' : 'Fallback legado ativo'} />
            </SelectTrigger>
            <SelectContent>
              {produtos.map((produto) => (
                <SelectItem key={produto.id} value={produto.id}>
                  {produto.nome}{produto.variedade ? ` • ${produto.variedade}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="processos" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="parameters">Parâmetros</TabsTrigger>
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
        </TabsList>

        <TabsContent value="processos" className="space-y-4">
          {!produtoSelecionado && produtos.length > 0 && (
            <Card className="border-dashed">
              <CardContent className="pt-6 text-sm text-gray-600">
                Selecione um tipo de cogumelo para ver os treinamentos específicos cadastrados no catálogo.
              </CardContent>
            </Card>
          )}

          {processos.map((processo) => (
            <Card key={processo.id} className="overflow-hidden">
              <CardHeader className={`${processo.color} text-white`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-2xl">{renderProcessIcon(processo.icon)}</div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{processo.titulo}</CardTitle>
                      <p className="text-sm opacity-90 mt-1">{processo.objetivo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {processo.concluido && (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle2 size={14} className="mr-1" />
                        Concluído
                      </Badge>
                    )}
                    {processo.iniciado && !processo.concluido && (
                      <Badge className="bg-blue-500 text-white">{processo.progresso}%</Badge>
                    )}
                    {!processo.iniciado && (
                      <Button size="sm" onClick={() => void iniciarProcesso(processo.id)} className="bg-white text-[#1A1A1A] hover:bg-gray-100">
                        <Play size={14} className="mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {processo.iniciado && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setProcessoExpandido(processoExpandido === processo.id ? null : processo.id)}
                        className="text-white hover:bg-white/20"
                      >
                        {processoExpandido === processo.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {processo.iniciado && processoExpandido === processo.id && (
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {processo.etapas.map((etapa) => (
                      <div
                        key={etapa.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          etapa.concluida
                            ? 'bg-green-50 border-green-500'
                            : 'bg-gray-50 border-gray-200 hover:border-[#A88F52]'
                        }`}
                        onClick={() => void toggleEtapa(processo.id, etapa.id)}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {etapa.concluida ? (
                            <CheckCircle2 size={24} className="text-green-600" />
                          ) : (
                            <Circle size={24} className="text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold ${etapa.concluida ? 'text-green-900' : 'text-[#1A1A1A]'}`}>
                            {etapa.titulo}
                          </h4>
                          <p className={`text-sm mt-1 ${etapa.concluida ? 'text-green-700' : 'text-gray-600'}`}>
                            {etapa.descricao}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {processo.concluido && (
                    <div className="mt-6 pt-6 border-t flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={20} />
                        <span className="font-semibold">Processo concluído com sucesso!</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void reiniciarProcesso(processo.id)}>
                        <RotateCcw size={14} className="mr-2" />
                        Reiniciar
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="parameters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros Ideais por Espécie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E3E3E3]">
                      <th className="text-left p-4 font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>Variedade</th>
                      <th className="text-left p-4">Temperatura</th>
                      <th className="text-left p-4">Umidade</th>
                      <th className="text-left p-4">Iluminação</th>
                      <th className="text-left p-4">Ciclo</th>
                      <th className="text-left p-4">CO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {idealParameters.map((param) => (
                      <tr key={param.variety} className="border-b border-[#E3E3E3] hover:bg-[#F8F6F2] transition-colors">
                        <td className="p-4 font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>{param.variety}</td>
                        <td className="p-4"><div className="flex items-center gap-2"><Thermometer size={16} className="text-[#A88F52]" /><span className="text-sm">{param.temp}</span></div></td>
                        <td className="p-4"><div className="flex items-center gap-2"><Droplets size={16} className="text-[#546A4A]" /><span className="text-sm">{param.humidity}</span></div></td>
                        <td className="p-4 text-sm">{param.light}</td>
                        <td className="p-4 text-sm">{param.cycle}</td>
                        <td className="p-4 text-sm">{param.co2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 border-l-4 border-l-emerald-600">
            <CardHeader>
              <CardTitle>Recomendações do catálogo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-emerald-950">
              <p>
                {recomendacoesSelecionadas?.resumo || 'Nenhuma recomendação específica cadastrada para esta espécie. O sistema mantém fallback seguro.'}
              </p>
              {alertasSelecionados.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {alertasSelecionados.map((alerta: string) => (
                    <li key={alerta}>{alerta}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="videos" className="space-y-4">
          {videos.map((video) => (
            <Card key={video.title} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-24 h-24 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
                    <Video className="w-12 h-12 text-[#A88F52]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-['Cormorant_Garamond'] mb-1" style={{ fontSize: '20px', fontWeight: 600 }}>{video.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-[#1A1A1A] opacity-70">
                      <span>{video.category}</span>
                      <span>•</span>
                      <span>{video.duration}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Card className="bg-red-50 border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle size={20} />
            Procedimentos de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-900 space-y-2">
          <p><strong>Contaminação detectada:</strong> Isolar lote imediatamente, notificar supervisor e não misturar com outros lotes.</p>
          <p><strong>Falha de energia:</strong> Acionar backup e monitorar temperatura/umidade manualmente a cada 30 minutos.</p>
          <p><strong>Quebra de equipamento:</strong> Registrar no sistema e transferir o lote para ambiente alternativo quando necessário.</p>
        </CardContent>
      </Card>
    </div>
  );
}
