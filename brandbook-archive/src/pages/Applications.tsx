import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { MushroomIcon } from '../components/MushroomIcon';
import { Mail, Phone, MapPin, Globe } from 'lucide-react';

export function Applications() {
  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 09"
        title="Brand Applications"
        description="Aplicações da marca em materiais de marketing, comunicação e pontos de contato com clientes."
      />

      <Section title="Cartão de Visita">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Front */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden border-2 border-[#E3E3E3]">
            <div className="aspect-[1.75/1] bg-[#1A1A1A] p-8 flex flex-col items-center justify-center">
              <MushroomIcon className="w-16 h-16 text-[#A88F52] mb-4" />
              <h3 className="font-['Cormorant_Garamond'] text-white text-center" style={{ fontSize: '28px', fontWeight: 700 }}>
                Shroom Bros
              </h3>
              <p className="text-[#A88F52] text-center mt-2">Cogumelos Premium</p>
            </div>
            <p className="text-center py-2 text-sm text-[#1A1A1A] opacity-50">FRENTE</p>
          </div>

          {/* Back */}
          <div className="bg-white rounded-lg shadow-xl overflow-hidden border-2 border-[#E3E3E3]">
            <div className="aspect-[1.75/1] bg-[#F8F6F2] p-8 flex flex-col justify-center">
              <h4 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '20px', fontWeight: 600 }}>
                João & Pedro Silva
              </h4>
              <div className="space-y-2 text-sm text-[#1A1A1A]">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-[#546A4A]" />
                  <span>+55 (47) 9 9999-9999</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-[#546A4A]" />
                  <span>contato@shroombros.com.br</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#546A4A]" />
                  <span>Cajinas - SP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[#546A4A]" />
                  <span>@shroombros</span>
                </div>
              </div>
            </div>
            <p className="text-center py-2 text-sm text-[#1A1A1A] opacity-50">VERSO</p>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg p-6 border-2 border-[#E3E3E3] max-w-3xl mx-auto">
          <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
            Especificações
          </h4>
          <ul className="space-y-1 text-[#1A1A1A]">
            <li>• Tamanho: 90×50mm (padrão brasileiro)</li>
            <li>• Material: Papel couché 300g fosco</li>
            <li>• Acabamento: Laminação fosca + hot stamping dourado (opcional)</li>
          </ul>
        </div>
      </Section>

      <Section title="Embalagem Kraft Grande">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-br from-[#3B2F28] to-[#546A4A] rounded-lg p-12">
            <div className="bg-[#D4B896] rounded-lg p-8 text-center">
              <MushroomIcon className="w-24 h-24 text-[#3B2F28] mx-auto mb-6" />
              <h3 className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '42px', fontWeight: 700 }}>
                Shroom Bros
              </h3>
              <p className="text-[#3B2F28] mt-3" style={{ fontSize: '18px' }}>
                Fresh Mushrooms • Cogumelos Frescos
              </p>
              <div className="mt-6 pt-6 border-t border-[#3B2F28]/20">
                <p className="text-sm text-[#3B2F28]">
                  Cultivados com ciência e cuidado
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg p-6 border-2 border-[#E3E3E3]">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Aplicação
            </h4>
            <p className="text-[#1A1A1A]">
              Sacola kraft premium para compras em feiras, eventos e entregas especiais.
              Reforça a identidade sustentável da marca.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Caixa para Restaurantes">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#1A1A1A] rounded-lg p-8 text-center">
            <div className="bg-white rounded p-6 inline-block">
              <MushroomIcon className="w-20 h-20 text-[#1A1A1A] mx-auto mb-4" />
              <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                SHROOM BROS
              </h4>
              <p className="text-sm mt-2 text-[#1A1A1A] opacity-70">PREMIUM MUSHROOMS</p>
            </div>
            <p className="text-white mt-6 opacity-70">Vista lateral da caixa</p>
          </div>

          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-8">
            <h4 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Características
            </h4>
            <ul className="space-y-3 text-[#1A1A1A]">
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Papelão ondulado resistente</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Logo em silk-screen ou adesivo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Alça opcional para transporte</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Capacidade: até 5kg de cogumelos</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Ventilação lateral para frescor</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Adesivos 'Shroom Bros'">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          {/* Round sticker - gold */}
          <div className="text-center">
            <div className="w-32 h-32 mx-auto rounded-full bg-[#A88F52] flex items-center justify-center shadow-lg border-4 border-white">
              <MushroomIcon className="w-16 h-16 text-white" />
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A]">Redondo - Dourado</p>
          </div>

          {/* Round sticker - green */}
          <div className="text-center">
            <div className="w-32 h-32 mx-auto rounded-full bg-[#546A4A] flex items-center justify-center shadow-lg border-4 border-white">
              <MushroomIcon className="w-16 h-16 text-white" />
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A]">Redondo - Verde</p>
          </div>

          {/* Square sticker - minimal */}
          <div className="text-center">
            <div className="w-32 h-32 mx-auto rounded-lg bg-[#F8F6F2] flex flex-col items-center justify-center shadow-lg border-2 border-[#1A1A1A]">
              <MushroomIcon className="w-12 h-12 text-[#1A1A1A] mb-2" />
              <span className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '14px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A]">Quadrado - Minimal</p>
          </div>

          {/* Die-cut mushroom */}
          <div className="text-center">
            <div className="w-32 h-32 mx-auto flex items-center justify-center">
              <MushroomIcon className="w-28 h-28 text-[#A88F52] drop-shadow-lg" />
            </div>
            <p className="mt-3 text-sm text-[#1A1A1A]">Recorte Especial</p>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg p-6 border-2 border-[#E3E3E3] max-w-3xl mx-auto">
          <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
            Usos Sugeridos
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[#1A1A1A]">
            <li>• Selar embalagens</li>
            <li>• Brinde para clientes</li>
            <li>• Decoração de stands</li>
            <li>• Material promocional</li>
            <li>• Identificação de produtos</li>
            <li>• Fechamento de sacolas</li>
          </ul>
        </div>
      </Section>

      <Section title="Placa de Entrada da Chácara">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-b from-[#87CEEB] to-[#98D8C8] rounded-lg p-12">
            <div className="bg-[#3B2F28] rounded-lg p-12 border-4 border-[#A88F52]">
              <div className="flex items-center justify-center gap-6 mb-6">
                <MushroomIcon className="w-24 h-24 text-[#A88F52]" />
                <div>
                  <h3 className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '48px', fontWeight: 700 }}>
                    Shroom Bros
                  </h3>
                  <p className="text-[#A88F52]" style={{ fontSize: '20px' }}>
                    Cultivo de Cogumelos Premium
                  </p>
                </div>
              </div>
              <div className="text-center text-white pt-6 border-t border-[#A88F52]/30">
                <p>Rua das Flores, 100 • Cajinas - SP</p>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-lg p-6 border-2 border-[#E3E3E3]">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Especificações
            </h4>
            <ul className="space-y-1 text-[#1A1A1A]">
              <li>• Tamanho: 120×80cm</li>
              <li>• Material: ACM (alumínio composto) ou madeira tratada</li>
              <li>• Acabamento: Impressão UV resistente às intempéries</li>
              <li>• Instalação: Postes ou fixação em muro</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Etiqueta de Rastreio para Restaurantes">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border-2 border-[#A88F52] rounded-lg p-8">
            <div className="border-b-2 border-[#A88F52] pb-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <MushroomIcon className="w-12 h-12 text-[#A88F52]" />
                  <div>
                    <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                      SHROOM BROS
                    </h4>
                    <p className="text-sm text-[#1A1A1A] opacity-70">Certificado de Rastreamento</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[#1A1A1A] opacity-70">LOTE</p>
                  <p className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                    #2024-001
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-[#A88F52] mb-1">Data de Colheita</p>
                <p className="text-[#1A1A1A]">03/12/2024</p>
              </div>
              <div>
                <p className="text-[#A88F52] mb-1">Melhor Até</p>
                <p className="text-[#1A1A1A]">10/12/2024</p>
              </div>
              <div>
                <p className="text-[#A88F52] mb-1">Variedade</p>
                <p className="text-[#1A1A1A]">Shiitake Premium</p>
              </div>
              <div>
                <p className="text-[#A88F52] mb-1">Peso Líquido</p>
                <p className="text-[#1A1A1A]">300g</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#E3E3E3] text-xs text-[#1A1A1A] opacity-60">
              <p>Cultivado em ambiente controlado • Cajinas - SP • Brasil</p>
              <p className="mt-1">Manter refrigerado entre 2-4°C</p>
            </div>
          </div>

          <div className="mt-6 bg-[#F8F6F2] rounded-lg p-6 border-2 border-[#E3E3E3]">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Função
            </h4>
            <p className="text-[#1A1A1A]">
              Etiqueta especial para restaurantes parceiros, garantindo rastreabilidade completa
              do produto e reforçando o compromisso com qualidade e transparência.
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
