import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Printer, ClipboardList, Shield, Droplets, AlertTriangle, Check } from 'lucide-react';

export function Checklists() {
  const [checklistSelecionado, setChecklistSelecionado] = useState<string | null>(null);

  const imprimir = (titulo: string) => {
    const conteudo = document.getElementById(`checklist-${titulo}`);
    if (conteudo) {
      const janelaImpressao = window.open('', '_blank');
      if (janelaImpressao) {
        janelaImpressao.document.write(`
          <html>
            <head>
              <title>🍄 SHROOM BROS - ${titulo}</title>
              <style>
                @media print {
                  @page { margin: 1cm; }
                  body { 
                    font-family: Arial, sans-serif; 
                    font-size: 11pt;
                    line-height: 1.4;
                  }
                  h1 { 
                    font-size: 20pt; 
                    text-align: center; 
                    border-bottom: 3px solid #000;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                  }
                  h2 { 
                    font-size: 14pt; 
                    background: #f0f0f0; 
                    padding: 8px;
                    margin-top: 15px;
                    border-left: 4px solid #546A4A;
                  }
                  h3 { 
                    font-size: 12pt; 
                    margin-top: 10px;
                    color: #333;
                  }
                  .checkbox { 
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid #000;
                    margin-right: 8px;
                    vertical-align: middle;
                  }
                  .item { 
                    margin: 8px 0;
                    padding-left: 10px;
                  }
                  .alerta {
                    background: #ffebee;
                    border: 2px solid #c62828;
                    padding: 10px;
                    margin: 15px 0;
                    border-radius: 4px;
                  }
                  .destaque {
                    background: #fff9c4;
                    padding: 10px;
                    margin: 10px 0;
                    border-left: 4px solid #f57c00;
                  }
                }
              </style>
            </head>
            <body>
              ${conteudo.innerHTML}
            </body>
          </html>
        `);
        janelaImpressao.document.close();
        janelaImpressao.print();
      }
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Checklists Operacionais
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Mapas para impressão e uso nas salas de produção
        </p>
      </div>

      {/* Cards de Checklists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Checklist 1: Limpeza */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setChecklistSelecionado('limpeza')}>
          <CardHeader className="bg-[#546A4A] text-white">
            <CardTitle className="flex items-center gap-2">
              <Shield size={24} />
              <span>Rotinas de Limpeza</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600 mb-4">
              Checklist diário e semanal de limpeza e organização das salas de cultivo
            </p>
            <div className="flex gap-2">
              <Badge variant="outline">Diária (10-20 min)</Badge>
              <Badge variant="outline">Semanal (1-2h)</Badge>
            </div>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                imprimir('limpeza');
              }}
            >
              <Printer size={16} className="mr-2" />
              Imprimir
            </Button>
          </CardContent>
        </Card>

        {/* Checklist 2: Produção */}
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setChecklistSelecionado('producao')}>
          <CardHeader className="bg-[#A88F52] text-white">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList size={24} />
              <span>Processos de Produção</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="text-sm text-gray-600 mb-4">
              Passo a passo completo: preparo, esterilização, inoculação e frutificação
            </p>
            <div className="flex gap-2">
              <Badge variant="outline">Fase A-D</Badge>
              <Badge variant="outline">Crítico</Badge>
            </div>
            <Button 
              className="w-full mt-4" 
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                imprimir('producao');
              }}
            >
              <Printer size={16} className="mr-2" />
              Imprimir
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Conteúdo para Impressão - Limpeza */}
      <div id="checklist-limpeza" className="hidden print:block">
        <h1>🍄 MAPA OPERACIONAL SHROOM BROS 🍄</h1>
        <p style={{ textAlign: 'center', marginBottom: '20px' }}>
          <strong>Versão para Impressão - Fixar na Área Técnica</strong>
        </p>

        <h2>🧼 1. ROTINAS DE LIMPEZA E ORGANIZAÇÃO</h2>

        <h3>PRÉ-REQUISITOS (Itens necessários)</h3>
        <div className="item"><span className="checkbox"></span> Álcool 70% (frasco borrifador)</div>
        <div className="item"><span className="checkbox"></span> Detergente neutro e água sanitária</div>
        <div className="item"><span className="checkbox"></span> Panos limpos (exclusivos da área de produção)</div>
        <div className="item"><span className="checkbox"></span> Vassoura, rodo, balde e aspirador (se necessário)</div>
        <div className="item"><span className="checkbox"></span> Máscara e luvas (opcionais para limpeza, obrigatórias para processos)</div>

        <h3>DIÁRIA (10 a 20 min) - "Manutenção"</h3>
        <div className="item"><span className="checkbox"></span> Lavar as mãos com água e sabão e passar Álcool 70% antes de entrar</div>
        <div className="item"><span className="checkbox"></span> Usar roupa limpa/exclusiva e máscara</div>
        <div className="item"><span className="checkbox"></span> Varrer o chão muito devagar para não levantar poeira</div>
        <div className="item"><span className="checkbox"></span> Passar pano úmido no chão (água + detergente neutro)</div>
        <div className="item"><span className="checkbox"></span> Conferir a temperatura e umidade nos higrômetros</div>
        <div className="item"><span className="checkbox"></span> Fazer inspeção visual nos sacos (sem mexer ou apertar)</div>
        <div className="item"><span className="checkbox"></span> Proibido entrar com celular sem higienizar. Nada no chão.</div>

        <h3>SEMANAL (1 a 2 horas) - "Limpeza Pesada"</h3>
        <div className="item"><span className="checkbox"></span> Limpar a estante/prateleiras com pano e Álcool 70%</div>
        <div className="item"><span className="checkbox"></span> Lavar o chão e passar pano nas paredes até a altura das prateleiras</div>
        <div className="item"><span className="checkbox"></span> Limpar profundamente o umidificador e trocar a água do reservatório</div>
        <div className="item"><span className="checkbox"></span> Limpar o ventilador (tirar o pó)</div>
        <div className="item"><span className="checkbox"></span> Revisar estoque de insumos (álcool, luvas, sacos, etc.)</div>

        <h3>PÓS-COLHEITA E CONTAMINAÇÃO</h3>
        <div className="item"><span className="checkbox"></span> <strong>Após Colher:</strong> Remover restos de cogumelo do ambiente, higienizar tesouras/facas com Álcool 70%, limpar área usada</div>
        
        <div className="alerta">
          <strong>🚨 ALERTA VERDE/PRETO (Trichoderma):</strong><br/>
          Isolar o bloco IMEDIATAMENTE (colocar num saco de lixo sem apertar), retirar da sala, descartar longe da casa e limpar a prateleira com Álcool 70%.
        </div>

        <hr style={{ margin: '30px 0', border: '2px solid #000' }} />

        <p style={{ textAlign: 'center', fontSize: '10pt', color: '#666' }}>
          Data: _____/_____/_____ | Responsável: _________________________ | Visto: _____________
        </p>
      </div>

      {/* Conteúdo para Impressão - Produção */}
      <div id="checklist-producao" className="hidden print:block">
        <h1>🍄 MAPA OPERACIONAL SHROOM BROS 🍄</h1>
        <p style={{ textAlign: 'center', marginBottom: '20px' }}>
          <strong>Processos de Produção - Versão para Impressão</strong>
        </p>

        <h2>⚙️ PROCESSOS DE PRODUÇÃO (O PASSO A PASSO)</h2>

        <h3>FASE A: PREPARO DO SUBSTRATO (Área Suja)</h3>
        <div className="destaque">
          <strong>PRÉ-REQUISITOS:</strong>
        </div>
        <div className="item"><span className="checkbox"></span> Serragem de madeira dura (Eucalipto - sem MDF/Pinus)</div>
        <div className="item"><span className="checkbox"></span> Farelo de Trigo</div>
        <div className="item"><span className="checkbox"></span> Água limpa</div>
        <div className="item"><span className="checkbox"></span> Sacos PP autoclaváveis com filtro (ex: 20x41 cm ou até 2kg)</div>

        <div style={{ marginTop: '15px' }}>
          <div className="item"><span className="checkbox"></span> <strong>Proporção Seca:</strong> Misturar 80% de serragem e 20% de farelo de trigo MUITO BEM</div>
          <div className="item"><span className="checkbox"></span> <strong>Hidratação:</strong> Adicionar água aos poucos (aprox. 600-650ml por 1kg seco)</div>
          <div className="item"><span className="checkbox"></span> <strong>Teste da Mão:</strong> Apertar um punhado forte; deve formar um bloco firme e sair de 1 a 4 gotinhas no máximo. Se escorrer, adicione serragem seca. Se esfarelar, adicione água.</div>
          <div className="item"><span className="checkbox"></span> <strong>Ensaque:</strong> Colocar aprox. 1 a 1,2 kg úmido por saco. Bater levemente para acomodar e tirar bolsões de ar, sem deixar duro como um tijolo</div>
          <div className="item"><span className="checkbox"></span> <strong>Fechamento para Panela:</strong> Limpar topo interno, fazer o "pescoço/chaminé". Amarrar com arame logo acima do substrato, abaixo do filtro. O filtro fica 100% LIVRE.</div>
        </div>

        <h3>FASE B: ESTERILIZAÇÃO (Área Suja)</h3>
        <div className="destaque">
          <strong>PRÉ-REQUISITOS:</strong>
        </div>
        <div className="item"><span className="checkbox"></span> Panela de Pressão (20L Rochedo)</div>
        <div className="item"><span className="checkbox"></span> Panos limpos ou grade (para forrar o fundo)</div>
        <div className="item"><span className="checkbox"></span> Sacos de substrato fechados e prontos</div>

        <div style={{ marginTop: '15px' }}>
          <div className="item"><span className="checkbox"></span> Colocar 3 a 4 cm de água no fundo da panela</div>
          <div className="item"><span className="checkbox"></span> Colocar pano dobrado ou grade no fundo (os sacos não podem tocar o fundo quente nem ficar submersos)</div>
          <div className="item"><span className="checkbox"></span> Colocar os sacos em pé (filtro sempre para cima)</div>
          <div className="item"><span className="checkbox"></span> Após pegar pressão (chiar constante), manter em fogo médio/baixo por 2h a 2h30</div>
          <div className="item"><span className="checkbox"></span> Desligar o fogo e deixar esfriar naturalmente dentro da panela (12-24h). NUNCA ABRA QUENTE.</div>
        </div>

        <h3>FASE C: INOCULAÇÃO (Área Limpa) ⚠️ FASE CRÍTICA</h3>
        <div className="destaque">
          <strong>PRÉ-REQUISITOS:</strong>
        </div>
        <div className="item"><span className="checkbox"></span> Seringa de cultura líquida (Micélio)</div>
        <div className="item"><span className="checkbox"></span> Álcool 70% (frasco borrifador)</div>
        <div className="item"><span className="checkbox"></span> Isqueiro ou maçarico (para flamejar a agulha)</div>
        <div className="item"><span className="checkbox"></span> Papel toalha e fita/Durex</div>
        <div className="item"><span className="checkbox"></span> Luvas descartáveis e Máscara</div>

        <div style={{ marginTop: '15px' }}>
          <div className="item"><span className="checkbox"></span> Desligar ventilador e umidificador. Fechar a porta (isolar ambiente)</div>
          <div className="item"><span className="checkbox"></span> Limpar a prateleira do meio (mesa de inoculação) com Álcool 70%</div>
          <div className="item"><span className="checkbox"></span> Confirmar que os sacos estão frios (temperatura ambiente)</div>
          <div className="item"><span className="checkbox"></span> Higienizar as mãos/luvas e borrifar Álcool 70% nos equipamentos</div>
          <div className="item"><span className="checkbox"></span> Agitar a seringa e flamejar a agulha com isqueiro (esperar 5s)</div>
          <div className="item"><span className="checkbox"></span> Soltar o arame levemente, abrir uma fresta mínima no topo do saco, inserir a agulha e injetar a cultura líquida (3 a 5 ml por saco)</div>
          <div className="item"><span className="checkbox"></span> Retirar a agulha, fechar imediatamente. Reapertar o arame na base e colocar durex no topo para organizar. (Não cobrir o filtro)</div>
          <div className="item"><span className="checkbox"></span> Massagear suavemente para espalhar o líquido e etiquetar o lote (Data + Espécie)</div>
        </div>

        <h3>FASE D: INCUBAÇÃO E FRUTIFICAÇÃO</h3>
        <div className="destaque">
          <strong>PRÉ-REQUISITOS:</strong>
        </div>
        <div className="item"><span className="checkbox"></span> Sacos inoculados e fechados</div>
        <div className="item"><span className="checkbox"></span> Estante limpa e organizada</div>
        <div className="item"><span className="checkbox"></span> Seladora a vácuo (DZ-300T/Cetro) e sacos lisos PA/PE (para o fim do processo)</div>

        <div style={{ marginTop: '15px' }}>
          <div className="item"><span className="checkbox"></span> <strong>Incubação:</strong> Colocar os sacos na estante, deixando espaço entre eles. Manter no escuro, temperatura estável (22 a 26°C). NÃO MEXER por 5 a 15 dias.</div>
          <div className="item"><span className="checkbox"></span> <strong>Frutificação:</strong> Quando o bloco estiver 100% colonizado (todo branco), aguardar de 3 a 5 dias para consolidar. Após isso, mudar a umidade para 80-90% e dar ventilação leve.</div>
          <div className="item"><span className="checkbox"></span> <strong>Colheita:</strong> Colher no ponto (quando o chapéu estiver abrindo, mas as bordas ainda levemente curvadas para baixo). Fazer um corte limpo.</div>
          <div className="item"><span className="checkbox"></span> <strong>Embalagem Final:</strong> Pesar pacotes de 250g e selar com a DZ-300T/Cetro com vácuo leve (não esmagar o cogumelo). Etiquetar e armazenar sob refrigeração.</div>
        </div>

        <div className="alerta" style={{ marginTop: '30px' }}>
          <strong>⚠️ ALERTAS IMPORTANTES:</strong><br/>
          • NUNCA abrir a panela quente - risco de contaminação<br/>
          • Filtro SEMPRE livre - sem fita ou dobra por cima<br/>
          • Manchas verdes/pretas = ISOLAR IMEDIATAMENTE<br/>
          • Temperatura crítica: manter entre 22-26°C na incubação
        </div>

        <hr style={{ margin: '30px 0', border: '2px solid #000' }} />

        <p style={{ textAlign: 'center', fontSize: '10pt', color: '#666' }}>
          Lote: ________________ | Data: _____/_____/_____ | Responsável: _________________________ | Visto: _____________
        </p>
      </div>

      {/* Preview Expandido */}
      {checklistSelecionado && (
        <Card className="border-2 border-[#546A4A]">
          <CardHeader className="bg-[#F8F6F2]">
            <div className="flex items-center justify-between">
              <CardTitle>
                Preview: {checklistSelecionado === 'limpeza' ? 'Rotinas de Limpeza' : 'Processos de Produção'}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => imprimir(checklistSelecionado)}
                >
                  <Printer size={16} className="mr-2" />
                  Imprimir
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => setChecklistSelecionado(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: document.getElementById(`checklist-${checklistSelecionado}`)?.innerHTML || '' 
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Instruções de Uso */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <ClipboardList size={20} />
            Como Usar os Checklists
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-2">
          <p><strong>1. Clique no card</strong> para visualizar o preview completo do checklist</p>
          <p><strong>2. Use o botão "Imprimir"</strong> para gerar uma versão otimizada para papel A4</p>
          <p><strong>3. Fixe nas áreas técnicas</strong> correspondentes (sala de cultivo, área de preparo, etc.)</p>
          <p><strong>4. Marque os checkboxes</strong> com caneta conforme completa cada item</p>
          <p><strong>5. Arquive as versões preenchidas</strong> para rastreabilidade e controle de qualidade</p>
        </CardContent>
      </Card>
    </div>
  );
}
