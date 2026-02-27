import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import brandBoard from 'figma:asset/0e43cee4198b31bb6344720bcec45edb39ce5c6e.png';
import gourmetPackaging from 'figma:asset/1d9dce24d6d305d665bafffa5ef98e3b827978d0.png';
import labelMockup from 'figma:asset/c0a614de4c0c26425ad87a6d6ccf9e0bebb46379.png';

export function Mockups() {
  const mockupTypes = [
    { name: 'Bandeja com rótulo', description: 'Embalagem em bandeja PET transparente' },
    { name: 'Sacola kraft premium', description: 'Embalagem sustentável com logo' },
    { name: 'Caixa de transporte', description: 'Para distribuição e restaurantes' },
    { name: 'Uniforme', description: 'Avental e boné com branding' },
    { name: 'Fachada', description: 'Sinalização da sala de produção' },
    { name: 'Perfil Instagram', description: 'Identidade visual aplicada' },
  ];

  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 08"
        title="Mockups"
        description="Mockups realistas mostrando a aplicação da marca em diversos materiais e contextos."
      />

      <Section title="Brand Board Completo">
        <div className="bg-[#F8F6F2] rounded-lg p-8">
          <img 
            src={brandBoard} 
            alt="Brand Board" 
            className="w-full rounded-lg shadow-lg"
          />
        </div>
        <p className="text-center mt-4 text-[#1A1A1A] opacity-70">
          Visão geral dos principais elementos da marca
        </p>
      </Section>

      <Section title="Embalagem Premium">
        <div className="bg-gradient-to-br from-[#3B2F28] to-[#1A1A1A] rounded-lg p-12">
          <img 
            src={gourmetPackaging} 
            alt="Premium Packaging" 
            className="w-full max-w-4xl mx-auto rounded-lg"
          />
        </div>
        <p className="text-center mt-4 text-[#1A1A1A] opacity-70">
          Stand-up pouch com janela - Linha Gourmet Selection
        </p>
      </Section>

      <Section title="Etiqueta em Bandeja">
        <div className="bg-white rounded-lg p-12 border-2 border-[#E3E3E3]">
          <img 
            src={labelMockup} 
            alt="Label on Tray" 
            className="w-full max-w-3xl mx-auto rounded-lg shadow-xl"
          />
        </div>
        <p className="text-center mt-4 text-[#1A1A1A] opacity-70">
          Bandeja PET com etiqueta minimalista - Linha tradicional
        </p>
      </Section>

      <Section title="Tipos de Mockups Disponíveis">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockupTypes.map((mockup) => (
            <div 
              key={mockup.name}
              className="bg-white border-2 border-[#E3E3E3] rounded-lg p-6 hover:border-[#A88F52] transition-colors"
            >
              <h3 className="font-['Cormorant_Garamond'] mb-2" style={{ fontSize: '24px', fontWeight: 600 }}>
                {mockup.name}
              </h3>
              <p className="text-[#1A1A1A] opacity-70">
                {mockup.description}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Contextos de Aplicação">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Retail */}
          <div className="bg-[#F8F6F2] rounded-lg p-8">
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#1A1A1A]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Varejo & Supermercados
            </h3>
            <ul className="space-y-3 text-[#1A1A1A]">
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Bandejas refrigeradas com etiqueta minimalista</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Display de ponto de venda</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Material educativo para consumidores</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#546A4A]">•</span>
                <span>Sinalização de seção "produtos frescos"</span>
              </li>
            </ul>
          </div>

          {/* Food Service */}
          <div className="bg-[#1A1A1A] text-white rounded-lg p-8">
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Restaurantes & Food Service
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Embalagens gourmet premium</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Caixas de transporte com logo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Certificados de rastreamento</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Fichas técnicas de produto</span>
              </li>
            </ul>
          </div>

          {/* Events */}
          <div className="bg-[#546A4A] text-white rounded-lg p-8">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '28px', fontWeight: 600 }}>
              Feiras & Eventos
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Banner roll-up institucional</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Toalhas de mesa com logo</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Uniformes da equipe</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Amostras em embalagem especial</span>
              </li>
            </ul>
          </div>

          {/* Production */}
          <div className="bg-white border-2 border-[#A88F52] rounded-lg p-8">
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Produção & Instalações
            </h3>
            <ul className="space-y-3 text-[#1A1A1A]">
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Sinalização externa da propriedade</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Uniformes de produção</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Placas de segurança e higiene</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A88F52]">•</span>
                <span>Veículo de entrega adesivado</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Especificações Técnicas">
        <div className="bg-white rounded-lg p-8 border-2 border-[#E3E3E3]">
          <h3 className="font-['Cormorant_Garamond'] mb-6" style={{ fontSize: '28px', fontWeight: 600 }}>
            Arquivos e Formatos
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-[#A88F52] mb-3">Logos</h4>
              <ul className="space-y-1 text-sm text-[#1A1A1A]">
                <li>• SVG (vetorial)</li>
                <li>• PNG (alta resolução)</li>
                <li>• PDF (impressão)</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[#A88F52] mb-3">Embalagens</h4>
              <ul className="space-y-1 text-sm text-[#1A1A1A]">
                <li>• AI/EPS (fornecedor)</li>
                <li>• PDF (prova digital)</li>
                <li>• CMYK 300dpi</li>
              </ul>
            </div>

            <div>
              <h4 className="text-[#A88F52] mb-3">Digital</h4>
              <ul className="space-y-1 text-sm text-[#1A1A1A]">
                <li>• PNG/JPG (RGB)</li>
                <li>• 72-150dpi (web)</li>
                <li>• Dimensões específicas</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
