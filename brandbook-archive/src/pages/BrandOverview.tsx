import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Sparkles, Target, Eye, Heart, Leaf, Shield, Users, Cpu } from 'lucide-react';

export function BrandOverview() {
  const values = [
    { icon: Sparkles, title: 'Pureza', description: 'Cogumelos frescos e naturais, sem aditivos' },
    { icon: Leaf, title: 'Sustentabilidade', description: 'Respeito ao meio ambiente em todo processo' },
    { icon: Shield, title: 'Honestidade', description: 'Transparência com clientes e parceiros' },
    { icon: Cpu, title: 'Tecnologia + Natureza', description: 'Cultivo científico e cuidadoso' },
    { icon: Users, title: 'Proximidade Familiar', description: 'Produção artesanal por dois irmãos' },
  ];

  const personality = [
    'Minimalista',
    'Gourmet',
    'Moderna',
    'Quente e acolhedora',
    'Transparente',
  ];

  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 01"
        title="Brand Overview"
        description="Fundamentos da marca Shroom Bros: essência, missão, visão, valores e personalidade."
      />

      <Section title="Brand Essence">
        <div className="bg-white border-2 border-[#A88F52] rounded-lg p-8">
          <p className="text-center" style={{ fontSize: '20px', lineHeight: 1.8 }}>
            Shroom Bros é uma marca de <strong>cogumelos frescos, naturais e de alta qualidade</strong>,
            produzidos por dois irmãos, com foco em <strong>sabor, sustentabilidade e simplicidade</strong>.
          </p>
        </div>
      </Section>

      <Section title="Missão">
        <div className="bg-[#F8F6F2] rounded-lg p-8 flex items-start gap-6">
          <div className="flex-shrink-0 p-4 bg-[#546A4A] rounded-full">
            <Target className="w-8 h-8 text-white" />
          </div>
          <p style={{ fontSize: '18px', lineHeight: 1.8 }}>
            Cultivar cogumelos premium com cuidado, ciência e respeito ao meio ambiente,
            entregando frescor e qualidade para famílias e restaurantes.
          </p>
        </div>
      </Section>

      <Section title="Visão">
        <div className="bg-[#F8F6F2] rounded-lg p-8 flex items-start gap-6">
          <div className="flex-shrink-0 p-4 bg-[#A88F52] rounded-full">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <p style={{ fontSize: '18px', lineHeight: 1.8 }}>
            Ser referência no mercado de cogumelos frescos do Sul do Brasil,
            expandindo para produtos especiais e linha gourmet.
          </p>
        </div>
      </Section>

      <Section title="Valores">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {values.map((value) => {
            const Icon = value.icon;
            return (
              <div key={value.title} className="bg-white border border-[#E3E3E3] rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-[#546A4A] rounded-lg">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 600 }}>
                    {value.title}
                  </h3>
                </div>
                <p className="text-[#1A1A1A] opacity-80">
                  {value.description}
                </p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Personalidade da Marca" className="bg-[#1A1A1A] text-white">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {personality.map((trait) => (
            <div
              key={trait}
              className="bg-[#2A2A2A] border border-[#A88F52] rounded-lg p-6 text-center hover:bg-[#A88F52] transition-colors group"
            >
              <Heart className="w-6 h-6 mx-auto mb-3 text-[#A88F52] group-hover:text-white" />
              <p className="font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 500 }}>
                {trait}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
