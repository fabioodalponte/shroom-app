import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';

export function Typography() {
  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 03"
        title="Typography"
        description="Sistema tipográfico que combina elegância gourmet com clareza moderna."
      />

      <Section title="Fontes da Marca">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Cormorant Garamond */}
          <div className="bg-white border-2 border-[#A88F52] rounded-lg p-8">
            <div className="mb-6">
              <span className="inline-block px-4 py-1 bg-[#A88F52] text-white rounded-full text-sm mb-4">
                🅐 Títulos
              </span>
              <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700 }}>
                Cormorant Garamond
              </h3>
              <p className="text-[#1A1A1A] opacity-70 mt-2">
                Elegante, gourmet, sofisticada
              </p>
            </div>
            <div className="space-y-4 border-t border-[#E3E3E3] pt-6">
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Bold</p>
                <p className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Medium</p>
                <p className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 500 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Regular</p>
                <p className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 400 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
            </div>
          </div>

          {/* Inter */}
          <div className="bg-white border-2 border-[#546A4A] rounded-lg p-8">
            <div className="mb-6">
              <span className="inline-block px-4 py-1 bg-[#546A4A] text-white rounded-full text-sm mb-4">
                🅑 Corpo
              </span>
              <h3 style={{ fontSize: '36px', fontWeight: 700 }}>
                Inter
              </h3>
              <p className="text-[#1A1A1A] opacity-70 mt-2">
                Moderno, limpo, tecnológico
              </p>
            </div>
            <div className="space-y-4 border-t border-[#E3E3E3] pt-6">
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Bold</p>
                <p style={{ fontSize: '24px', fontWeight: 700 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Medium</p>
                <p style={{ fontSize: '24px', fontWeight: 500 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
              <div>
                <p className="text-sm text-[#1A1A1A] opacity-50 mb-1">Regular</p>
                <p style={{ fontSize: '24px', fontWeight: 400 }}>
                  Aa Bb Cc Dd Ee Ff Gg
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Hierarquia Tipográfica">
        <div className="bg-white rounded-lg p-8 border-2 border-[#E3E3E3] space-y-8">
          <div className="border-b border-[#E3E3E3] pb-6">
            <p className="text-sm text-[#A88F52] mb-2">H1 — Cormorant Garamond Bold 64</p>
            <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '64px', fontWeight: 700 }}>
              Cogumelos Premium
            </h1>
          </div>

          <div className="border-b border-[#E3E3E3] pb-6">
            <p className="text-sm text-[#A88F52] mb-2">H2 — Cormorant Medium 42</p>
            <h2 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 500 }}>
              Frescor e Qualidade
            </h2>
          </div>

          <div className="border-b border-[#E3E3E3] pb-6">
            <p className="text-sm text-[#A88F52] mb-2">H3 — Cormorant Regular 28</p>
            <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 400 }}>
              Cultivados com Ciência e Cuidado
            </h3>
          </div>

          <div className="border-b border-[#E3E3E3] pb-6">
            <p className="text-sm text-[#A88F52] mb-2">Body — Inter Regular 16–18</p>
            <p style={{ fontSize: '18px' }}>
              Nossa produção combina tecnologia moderna com respeito à natureza, 
              resultando em cogumelos frescos, saborosos e sustentáveis. Cada lote é 
              cuidadosamente cultivado pelos irmãos fundadores da Shroom Bros.
            </p>
          </div>

          <div>
            <p className="text-sm text-[#A88F52] mb-2">Captions — Inter Medium 12</p>
            <p style={{ fontSize: '12px', fontWeight: 500 }}>
              INFORMAÇÕES NUTRICIONAIS • LOTE #2024-001 • VALIDADE: 7 DIAS
            </p>
          </div>
        </div>
      </Section>

      <Section title="Exemplo de Aplicação">
        <div className="bg-[#F8F6F2] rounded-lg p-12">
          <div className="max-w-3xl mx-auto">
            <p className="text-[#A88F52] mb-2">NOVIDADE</p>
            <h2 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '48px', fontWeight: 700 }}>
              Linha Gourmet Selection
            </h2>
            <p style={{ fontSize: '18px', lineHeight: 1.8 }} className="mb-6">
              Apresentamos nossa nova coleção premium: cogumelos especialmente selecionados 
              para alta gastronomia. Cultivados em ambiente controlado, cada cogumelo passa 
              por rigoroso controle de qualidade.
            </p>
            <p style={{ fontSize: '12px', fontWeight: 500 }} className="text-[#1A1A1A] opacity-60">
              DISPONÍVEL EM EMBALAGENS DE 200G, 250G E 300G
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
