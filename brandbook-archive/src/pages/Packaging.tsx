import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import gourmetPackaging from 'figma:asset/1d9dce24d6d305d665bafffa5ef98e3b827978d0.png';
import labelMockup from 'figma:asset/c0a614de4c0c26425ad87a6d6ccf9e0bebb46379.png';

export function Packaging() {
  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 06"
        title="Packaging System"
        description="Sistema de embalagens: etiquetas minimalistas e premium para diferentes linhas de produto."
      />

      <Section title="Embalagem Gourmet Premium">
        <div className="bg-gradient-to-br from-[#3B2F28] to-[#1A1A1A] rounded-lg p-8 mb-8">
          <img 
            src={gourmetPackaging} 
            alt="Gourmet Packaging" 
            className="w-full max-w-4xl mx-auto rounded-lg"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#546A4A] text-white rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Características
            </h3>
            <ul className="space-y-2">
              <li>• Fundo verde escuro premium</li>
              <li>• Tipografia dourada</li>
              <li>• Janela transparente</li>
              <li>• QR code para rastreamento</li>
              <li>• Informações nutricionais</li>
            </ul>
          </div>

          <div className="bg-white border-2 border-[#A88F52] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Aplicação
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Linha Gourmet Selection</li>
              <li>• Restaurantes parceiros</li>
              <li>• Lojas especializadas</li>
              <li>• Eventos gastronômicos</li>
              <li>• E-commerce premium</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Etiqueta Minimalista em Bandeja">
        <div className="bg-[#F8F6F2] rounded-lg p-8 mb-8">
          <img 
            src={labelMockup} 
            alt="Label Mockup" 
            className="w-full max-w-3xl mx-auto rounded-lg shadow-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-[#1A1A1A] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Características
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Fundo branco/creme</li>
              <li>• Tipografia preta</li>
              <li>• Ícone dourado sutil</li>
              <li>• QR code emoldurado</li>
              <li>• Layout limpo e direto</li>
            </ul>
          </div>

          <div className="bg-[#F8F6F2] border-2 border-[#E3E3E3] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Aplicação
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Bandejas de supermercado</li>
              <li>• Vendas diretas</li>
              <li>• Feiras orgânicas</li>
              <li>• Linha tradicional</li>
              <li>• Distribuidores</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Tamanhos Disponíveis">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-6 text-center hover:border-[#A88F52] transition-colors">
            <div className="font-['Cormorant_Garamond'] text-[#A88F52] mb-2" style={{ fontSize: '48px', fontWeight: 700 }}>
              200g
            </div>
            <p className="text-[#1A1A1A] opacity-70">Porção Individual</p>
          </div>

          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-6 text-center hover:border-[#A88F52] transition-colors">
            <div className="font-['Cormorant_Garamond'] text-[#A88F52] mb-2" style={{ fontSize: '48px', fontWeight: 700 }}>
              250g
            </div>
            <p className="text-[#1A1A1A] opacity-70">Padrão Família</p>
          </div>

          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-6 text-center hover:border-[#A88F52] transition-colors">
            <div className="font-['Cormorant_Garamond'] text-[#A88F52] mb-2" style={{ fontSize: '48px', fontWeight: 700 }}>
              300g
            </div>
            <p className="text-[#1A1A1A] opacity-70">Gourmet Selection</p>
          </div>

          <div className="bg-[#1A1A1A] border-2 border-[#A88F52] rounded-lg p-6 text-center">
            <div className="font-['Cormorant_Garamond'] text-[#A88F52] mb-2" style={{ fontSize: '36px', fontWeight: 700 }}>
              Custom
            </div>
            <p className="text-white opacity-90">Para Restaurantes</p>
          </div>
        </div>
      </Section>

      <Section title="Informações Obrigatórias">
        <div className="bg-white rounded-lg p-8 border-2 border-[#E3E3E3]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '24px', fontWeight: 600 }}>
                Etiqueta Frontal
              </h3>
              <ul className="space-y-2 text-[#1A1A1A]">
                <li>✓ Logo da marca</li>
                <li>✓ Nome do produto</li>
                <li>✓ Peso líquido</li>
                <li>✓ QR code de rastreamento</li>
                <li>✓ "Manter refrigerado"</li>
              </ul>
            </div>

            <div>
              <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '24px', fontWeight: 600 }}>
                Informações Adicionais
              </h3>
              <ul className="space-y-2 text-[#1A1A1A]">
                <li>✓ País de origem (Brasil)</li>
                <li>✓ Data de validade</li>
                <li>✓ Lote de produção</li>
                <li>✓ Ingredientes</li>
                <li>✓ Dados do produtor</li>
                <li>✓ Informações nutricionais</li>
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Materiais Recomendados">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#F8F6F2] rounded-lg p-6 border-2 border-[#E3E3E3]">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Etiquetas
            </h4>
            <p className="text-[#1A1A1A] opacity-80 mb-3">
              Papel adesivo fosco ou brilhante, resistente a umidade
            </p>
            <p className="text-sm text-[#1A1A1A] opacity-60">
              Recomendado: papel couché 90g
            </p>
          </div>

          <div className="bg-[#546A4A] text-white rounded-lg p-6">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Embalagens Premium
            </h4>
            <p className="opacity-90 mb-3">
              Stand-up pouch com janela, laminado fosco
            </p>
            <p className="text-sm opacity-70">
              Material: kraft verde + PET
            </p>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-[#A88F52]">
            <h4 className="font-['Cormorant_Garamond'] mb-3" style={{ fontSize: '20px', fontWeight: 600 }}>
              Bandejas
            </h4>
            <p className="text-[#1A1A1A] opacity-80 mb-3">
              PET transparente com tampa selável
            </p>
            <p className="text-sm text-[#1A1A1A] opacity-60">
              Atmosfera protetora opcional
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
