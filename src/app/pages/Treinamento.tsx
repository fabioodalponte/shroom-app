import { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Video, 
  FileText, 
  Thermometer, 
  Droplets, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  Circle,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Printer,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
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

export function Treinamento() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [processoExpandido, setProcessoExpandido] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Processos padrão do fluxo de produção
  const processosIniciais: Processo[] = [
    {
      id: '1',
      titulo: 'Limpeza e Preparação do Ambiente',
      objetivo: 'Eliminar poeira, fungos e bactérias da sala de cultivo',
      icon: 'Shield',
      color: 'bg-[#546A4A]',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '1-1',
          titulo: 'Limpeza Seca',
          descricao: 'Varrer o chão devagar ou usar aspirador de pó para não levantar sujeira',
          concluida: false
        },
        {
          id: '1-2',
          titulo: 'Limpeza Úmida',
          descricao: 'Passar pano no chão e limpar as prateleiras de metal com água e detergente neutro',
          concluida: false
        },
        {
          id: '1-3',
          titulo: 'Desinfecção',
          descricao: 'Pulverizar as prateleiras e bancadas com Álcool 70% e deixar secar naturalmente',
          concluida: false
        },
        {
          id: '1-4',
          titulo: 'Isolamento',
          descricao: 'Fechar janelas (vedadas com lona) e portas, desligar o ventilador e não permitir circulação desnecessária',
          concluida: false
        }
      ]
    },
    {
      id: '2',
      titulo: 'Preparo do Substrato',
      objetivo: 'Criar a base nutritiva ideal sem excesso de água',
      icon: 'FileText',
      color: 'bg-[#A88F52]',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '2-1',
          titulo: 'Proporção Seca',
          descricao: 'Misturar 80% de serragem de madeira dura (eucalipto) e 20% de farelo de trigo',
          concluida: false
        },
        {
          id: '2-2',
          titulo: 'Hidratação',
          descricao: 'Adicionar água aos poucos (aprox. 600 a 650 ml para cada 1 kg de mistura seca)',
          concluida: false
        },
        {
          id: '2-3',
          titulo: 'Teste da Mão (Crucial)',
          descricao: 'Apertar um punhado forte; deve formar um bloco firme e sair no máximo 1 a 4 gotinhas de água. Se escorrer, está encharcado; se esfarelar, está seco.',
          concluida: false
        },
        {
          id: '2-4',
          titulo: 'Ensaque',
          descricao: 'Colocar cerca de 1 a 1,2 kg de substrato úmido por saco (20x41cm) e compactar levemente para tirar bolsões de ar, sem esmagar como um tijolo',
          concluida: false
        }
      ]
    },
    {
      id: '3',
      titulo: 'Fechamento e Esterilização',
      objetivo: 'Eliminar qualquer vida biológica do substrato para receber o micélio',
      icon: 'Thermometer',
      color: 'bg-[#3B2F28]',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '3-1',
          titulo: 'Fechamento do Saco',
          descricao: 'Puxar o "pescoço" do saco, dobrar a base logo acima do bloco de substrato, e prender com arame dando 2 voltas. REGRA DE OURO: O filtro do saco deve ficar totalmente livre, voltado para cima, sem dobras ou fita por cima',
          concluida: false
        },
        {
          id: '3-2',
          titulo: 'Montagem da Panela',
          descricao: 'Colocar 2 a 4 cm de água e usar panos dobrados no fundo para o plástico não encostar no metal quente',
          concluida: false
        },
        {
          id: '3-3',
          titulo: 'Esterilização',
          descricao: 'Colocar os sacos em pé (filtro para cima). Após a panela pegar pressão (chiado leve e constante), contar cerca de 2h a 2h30',
          concluida: false
        },
        {
          id: '3-4',
          titulo: 'Resfriamento',
          descricao: 'Desligar o fogo e deixar esfriar naturalmente (12 a 24 horas) dentro da panela. NUNCA abrir ou inocular com o saco morno',
          concluida: false
        }
      ]
    },
    {
      id: '4',
      titulo: 'Inoculação (A Fase Crítica)',
      objetivo: 'Injetar o micélio sem deixar os esporos do ar entrarem',
      icon: 'Shield',
      color: 'bg-red-700',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '4-1',
          titulo: 'Setup da Área Limpa',
          descricao: 'Usar a prateleira do meio (limpa com álcool 70%). Ventilador e umidificador devem estar desligados',
          concluida: false
        },
        {
          id: '4-2',
          titulo: 'EPIs',
          descricao: 'Usar máscara, luvas e higienizar as mãos e a seringa com Álcool 70%',
          concluida: false
        },
        {
          id: '4-3',
          titulo: 'Aplicação',
          descricao: 'Agitar a seringa e flamejar a agulha com isqueiro até ficar vermelha. Esperar 5 a 10 segundos',
          concluida: false
        },
        {
          id: '4-4',
          titulo: 'Injeção',
          descricao: 'Abrir o mínimo possível do topo do saco (ou furar direto o filtro), injetar de 3 a 5 ml de cultura líquida, e retirar a agulha rapidamente',
          concluida: false
        },
        {
          id: '4-5',
          titulo: 'Vedação Imediata',
          descricao: 'Fechar o saco apertando o arame novamente e passar um durex/fita na dobra superior para selar qualquer fresta (sempre mantendo o filtro livre para respirar)',
          concluida: false
        }
      ]
    },
    {
      id: '5',
      titulo: 'Incubação e Colonização',
      objetivo: 'Deixar o micélio dominar o bloco no escuro',
      icon: 'BookOpen',
      color: 'bg-[#1A1A1A]',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '5-1',
          titulo: 'Posicionamento',
          descricao: 'Colocar os blocos na estante com alguns centímetros de distância entre eles. O filtro deve ficar para cima',
          concluida: false
        },
        {
          id: '5-2',
          titulo: 'Ambiente',
          descricao: 'Manter a temperatura estável (22 a 26°C), sem luz direta e sem ventilador batendo nos sacos',
          concluida: false
        },
        {
          id: '5-3',
          titulo: 'Regra de Ouro',
          descricao: 'NÃO mexer, NÃO apertar e NÃO abrir o saco',
          concluida: false
        },
        {
          id: '5-4',
          titulo: 'Monitoramento (Visual)',
          descricao: 'Acompanhar diariamente o crescimento branco. Manchas verdes ou pretas indicam contaminação e o bloco deve ser removido imediatamente. Esperar 100% de consolidação do bloco (todo branco e duro)',
          concluida: false
        }
      ]
    },
    {
      id: '6',
      titulo: 'Frutificação',
      objetivo: 'Mudar o ambiente para forçar o nascimento dos cogumelos',
      icon: 'Droplets',
      color: 'bg-emerald-600',
      iniciado: false,
      concluido: false,
      progresso: 0,
      etapas: [
        {
          id: '6-1',
          titulo: 'Gatilho',
          descricao: 'Quando o bloco estiver 100% colonizado, aguardar mais 3 a 5 dias de consolidação sem mexer',
          concluida: false
        },
        {
          id: '6-2',
          titulo: 'Condições do Quarto',
          descricao: 'Ajustar a umidade para 80-90%, manter temperatura entre 20-25°C, permitir luz indireta e ativar a ventilação leve',
          concluida: false
        },
        {
          id: '6-3',
          titulo: 'Abertura',
          descricao: 'Fazer um pequeno corte em "X" no plástico para o cogumelo nascer por ali',
          concluida: false
        }
      ]
    }
  ];

  useEffect(() => {
    carregarProcessos();
  }, []);

  const carregarProcessos = async () => {
    try {
      setLoading(true);
      const result = await fetchServer('/treinamentos');
      
      if (result.processos && result.processos.length > 0) {
        setProcessos(result.processos);
      } else {
        // Usar processos iniciais se não houver dados salvos
        setProcessos(processosIniciais);
      }
    } catch (error) {
      console.error('Erro ao carregar processos:', error);
      // Usar processos iniciais em caso de erro
      setProcessos(processosIniciais);
    } finally {
      setLoading(false);
    }
  };

  const salvarProgresso = async (processosAtualizados: Processo[]) => {
    try {
      await fetchServer('/treinamentos', {
        method: 'POST',
        body: JSON.stringify({ processos: processosAtualizados })
      });
    } catch (error) {
      console.error('Erro ao salvar progresso:', error);
    }
  };

  const iniciarProcesso = async (processoId: string) => {
    const novosProcessos = processos.map(p => 
      p.id === processoId ? { ...p, iniciado: true } : p
    );
    setProcessos(novosProcessos);
    setProcessoExpandido(processoId);
    await salvarProgresso(novosProcessos);
    toast.success('Processo iniciado!');
  };

  const toggleEtapa = async (processoId: string, etapaId: string) => {
    const novosProcessos = processos.map(processo => {
      if (processo.id === processoId) {
        const novasEtapas = processo.etapas.map(etapa =>
          etapa.id === etapaId ? { ...etapa, concluida: !etapa.concluida } : etapa
        );
        
        const etapasConcluidas = novasEtapas.filter(e => e.concluida).length;
        const progresso = Math.round((etapasConcluidas / novasEtapas.length) * 100);
        const concluido = progresso === 100;

        return {
          ...processo,
          etapas: novasEtapas,
          progresso,
          concluido
        };
      }
      return processo;
    });

    setProcessos(novosProcessos);
    await salvarProgresso(novosProcessos);
  };

  const reiniciarProcesso = async (processoId: string) => {
    const novosProcessos = processos.map(p => 
      p.id === processoId 
        ? { 
            ...p, 
            iniciado: false, 
            concluido: false, 
            progresso: 0,
            etapas: p.etapas.map(e => ({ ...e, concluida: false }))
          } 
        : p
    );
    setProcessos(novosProcessos);
    await salvarProgresso(novosProcessos);
    toast.success('Processo reiniciado!');
  };

  const idealParameters = [
    {
      variety: 'Shiitake',
      temp: '18-22°C',
      humidity: '80-90%',
      light: '500-1000 lux',
      cycle: '18-25 dias',
      co2: '<1000 ppm'
    },
    {
      variety: 'Champignon',
      temp: '14-18°C',
      humidity: '85-95%',
      light: 'Escuro',
      cycle: '21-28 dias',
      co2: '<2000 ppm'
    },
    {
      variety: 'Shimeji',
      temp: '16-20°C',
      humidity: '85-90%',
      light: '500-1000 lux',
      cycle: '14-21 dias',
      co2: '<1500 ppm'
    },
    {
      variety: 'Portobello',
      temp: '16-20°C',
      humidity: '85-90%',
      light: 'Escuro',
      cycle: '28-35 dias',
      co2: '<2000 ppm'
    },
  ];

  const videos = [
    { title: 'Como identificar ponto ideal de colheita', duration: '5:23', category: 'Colheita' },
    { title: 'Higienização completa da sala de cultivo', duration: '8:45', category: 'Higiene' },
    { title: 'Configuração de sensores de temperatura', duration: '6:12', category: 'Equipamentos' },
    { title: 'Detectar e prevenir contaminação', duration: '12:34', category: 'Qualidade' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#546A4A]"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Treinamento & Processos
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Fluxo de produção completo com etapas a serem seguidas
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="processos" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="processos">Processos</TabsTrigger>
          <TabsTrigger value="parameters">Parâmetros</TabsTrigger>
          <TabsTrigger value="videos">Vídeos</TabsTrigger>
        </TabsList>

        {/* Processos Tab */}
        <TabsContent value="processos" className="space-y-4">
          {processos.map((processo) => (
            <Card key={processo.id} className="overflow-hidden">
              <CardHeader className={`${processo.color} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {processo.icon === 'Shield' && <Shield size={28} />}
                      {processo.icon === 'FileText' && <FileText size={28} />}
                      {processo.icon === 'Thermometer' && <Thermometer size={28} />}
                      {processo.icon === 'BookOpen' && <BookOpen size={28} />}
                      {processo.icon === 'Droplets' && <Droplets size={28} />}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{processo.titulo}</CardTitle>
                      <p className="text-sm opacity-90 mt-1">{processo.objetivo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {processo.concluido && (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle2 size={14} className="mr-1" />
                        Concluído
                      </Badge>
                    )}
                    {processo.iniciado && !processo.concluido && (
                      <Badge className="bg-blue-500 text-white">
                        {processo.progresso}%
                      </Badge>
                    )}
                    {!processo.iniciado && (
                      <Button
                        size="sm"
                        onClick={() => iniciarProcesso(processo.id)}
                        className="bg-white text-[#1A1A1A] hover:bg-gray-100"
                      >
                        <Play size={14} className="mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {processo.iniciado && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setProcessoExpandido(
                          processoExpandido === processo.id ? null : processo.id
                        )}
                        className="text-white hover:bg-white/20"
                      >
                        {processoExpandido === processo.id ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
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
                        onClick={() => toggleEtapa(processo.id, etapa.id)}
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
                    <div className="mt-6 pt-6 border-t flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 size={20} />
                        <span className="font-semibold">Processo concluído com sucesso!</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reiniciarProcesso(processo.id)}
                      >
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

        {/* Parameters Tab */}
        <TabsContent value="parameters">
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros Ideais por Espécie</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E3E3E3]">
                      <th className="text-left p-4 font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>
                        Variedade
                      </th>
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
                        <td className="p-4 font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>
                          {param.variety}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Thermometer size={16} className="text-[#A88F52]" />
                            <span className="text-sm">{param.temp}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Droplets size={16} className="text-[#546A4A]" />
                            <span className="text-sm">{param.humidity}</span>
                          </div>
                        </td>
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
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos" className="space-y-4">
          {videos.map((video) => (
            <Card key={video.title} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-24 h-24 bg-[#1A1A1A] rounded-lg flex items-center justify-center">
                    <Video className="w-12 h-12 text-[#A88F52]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-['Cormorant_Garamond'] mb-1" style={{ fontSize: '20px', fontWeight: 600 }}>
                      {video.title}
                    </h3>
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

      {/* Alert Card */}
      <Card className="bg-red-50 border-l-4 border-l-red-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900">
            <AlertTriangle size={20} />
            Procedimentos de Emergência
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-900 space-y-2">
          <p><strong>Contaminação detectada:</strong> Isolar lote imediatamente, notificar supervisor, não misturar com outros lotes</p>
          <p><strong>Falha de energia:</strong> Acionar gerador de backup, monitorar temperatura manualmente a cada 30 min</p>
          <p><strong>Quebra de equipamento:</strong> Registrar no sistema, transferir lote para sala alternativa se necessário</p>
        </CardContent>
      </Card>
    </div>
  );
}