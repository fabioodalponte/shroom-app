import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { ColorCard } from '../components/ColorCard';

export function ColorSystem() {
  const minimalPalette = [
    { name: 'Charcoal Black', hex: '#1A1A1A', color: '#1A1A1A' },
    { name: 'Cream White', hex: '#F8F6F2', color: '#F8F6F2' },
    { name: 'Soft Gray', hex: '#E3E3E3', color: '#E3E3E3' },
  ];

  const premiumPalette = [
    { name: 'Gold Deluxe', hex: '#A88F52', color: '#A88F52' },
    { name: 'Deep Forest Green', hex: '#546A4A', color: '#546A4A' },
    { name: 'Dark Earth Brown', hex: '#3B2F28', color: '#3B2F28' },
  ];

  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 04"
        title="Color System"
        description="Sistema híbrido de cores: paleta minimalista para o dia-a-dia e paleta premium gourmet para produtos especiais."
      />

      <Section title="Paleta Principal Minimalista">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {minimalPalette.map((color) => (
            <ColorCard key={color.hex} {...color} />
          ))}
        </div>
        <div className="bg-white border-l-4 border-[#1A1A1A] p-6 rounded">
          <p className="text-[#1A1A1A]">
            <strong>Aplicação:</strong> Embalagens do dia-a-dia, comunicação institucional, 
            rótulos padrão e identidade visual minimalista.
          </p>
        </div>
      </Section>

      <Section title="Paleta Premium Gourmet">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {premiumPalette.map((color) => (
            <ColorCard key={color.hex} {...color} />
          ))}
        </div>
        <div className="bg-white border-l-4 border-[#A88F52] p-6 rounded">
          <p className="text-[#1A1A1A]">
            <strong>Aplicação:</strong> Linha gourmet, rótulos especiais, embalagens premium, 
            comunicação sustentável e social media de alto padrão.
          </p>
        </div>
      </Section>

      <Section title="Diretrizes de Aplicação">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#F8F6F2] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Minimalista
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Embalagens do dia-a-dia</li>
              <li>• Website e e-commerce</li>
              <li>• Documentação técnica</li>
              <li>• Etiquetas básicas</li>
            </ul>
          </div>

          <div className="bg-[#546A4A] text-white rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Premium Gourmet
            </h3>
            <ul className="space-y-2">
              <li>• Linha gourmet selection</li>
              <li>• Embalagens especiais</li>
              <li>• Marketing premium</li>
              <li>• Comunicação sustentável</li>
            </ul>
          </div>

          <div className="bg-[#1A1A1A] text-white rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '24px', fontWeight: 600 }}>
              Preto + Dourado
            </h3>
            <ul className="space-y-2">
              <li>• Social media premium</li>
              <li>• Lançamentos especiais</li>
              <li>• Eventos e feiras</li>
              <li>• Materiais institucionais VIP</li>
            </ul>
          </div>

          <div className="bg-white border-2 border-[#546A4A] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#546A4A]" style={{ fontSize: '24px', fontWeight: 600 }}>
              Verde (Sustentabilidade)
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Comunicação ambiental</li>
              <li>• Certificações</li>
              <li>• Posts sobre cultivo</li>
              <li>• Conteúdo educativo</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Exemplos de Combinações">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Minimal combination */}
          <div className="rounded-lg overflow-hidden border-2 border-[#E3E3E3]">
            <div className="bg-[#F8F6F2] p-8 text-center">
              <h4 className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '28px', fontWeight: 700 }}>
                Minimal
              </h4>
              <p className="text-[#1A1A1A] mt-2">Clean & Simple</p>
            </div>
            <div className="bg-white p-4 flex gap-2">
              <div className="flex-1 h-8 bg-[#1A1A1A] rounded" />
              <div className="flex-1 h-8 bg-[#F8F6F2] rounded border border-[#E3E3E3]" />
              <div className="flex-1 h-8 bg-[#E3E3E3] rounded" />
            </div>
          </div>

          {/* Premium combination */}
          <div className="rounded-lg overflow-hidden border-2 border-[#A88F52]">
            <div className="bg-[#1A1A1A] p-8 text-center">
              <h4 className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 700 }}>
                Premium
              </h4>
              <p className="text-white mt-2">Luxurious & Elegant</p>
            </div>
            <div className="bg-white p-4 flex gap-2">
              <div className="flex-1 h-8 bg-[#1A1A1A] rounded" />
              <div className="flex-1 h-8 bg-[#A88F52] rounded" />
              <div className="flex-1 h-8 bg-[#3B2F28] rounded" />
            </div>
          </div>

          {/* Sustainable combination */}
          <div className="rounded-lg overflow-hidden border-2 border-[#546A4A]">
            <div className="bg-[#546A4A] p-8 text-center">
              <h4 className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '28px', fontWeight: 700 }}>
                Sustentável
              </h4>
              <p className="text-white mt-2 opacity-90">Natural & Organic</p>
            </div>
            <div className="bg-white p-4 flex gap-2">
              <div className="flex-1 h-8 bg-[#546A4A] rounded" />
              <div className="flex-1 h-8 bg-[#F8F6F2] rounded border border-[#E3E3E3]" />
              <div className="flex-1 h-8 bg-[#3B2F28] rounded" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
