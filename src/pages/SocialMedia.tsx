import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Instagram, MessageCircle, Facebook } from 'lucide-react';
import { MushroomIcon } from '../components/MushroomIcon';

export function SocialMedia() {
  const feedTemplates = [
    { name: 'Lançamento de Lote', bg: '#1A1A1A', accent: '#A88F52' },
    { name: 'Preço do Dia', bg: '#F8F6F2', accent: '#546A4A' },
    { name: 'Receita com Shiitake', bg: '#3B2F28', accent: '#A88F52' },
    { name: 'Post Institucional', bg: '#546A4A', accent: '#F8F6F2' },
  ];

  const storyTemplates = [
    'Aviso de Colheita',
    'Bastidores',
    'Diário da Produção',
    'Enquete para Clientes',
    'Preço Especial',
  ];

  const highlights = [
    { icon: '🍄', label: 'Produtos' },
    { icon: '🌱', label: 'Colheita' },
    { icon: '🏭', label: 'Produção' },
    { icon: '🎬', label: 'Bastidores' },
    { icon: '👨‍🍳', label: 'Receitas' },
    { icon: '📞', label: 'Contato' },
  ];

  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 07"
        title="Social Media Kit"
        description="Templates e diretrizes para presença digital: feed, stories, reels e destaques do Instagram."
      />

      <Section title="Plataformas Principais">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white rounded-lg p-8 text-center">
            <Instagram className="w-12 h-12 mx-auto mb-4" />
            <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 600 }}>
              Instagram
            </h3>
            <p className="mt-2 opacity-90">Plataforma principal</p>
          </div>

          <div className="bg-[#25D366] text-white rounded-lg p-8 text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-4" />
            <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 600 }}>
              WhatsApp Business
            </h3>
            <p className="mt-2 opacity-90">Atendimento e vendas</p>
          </div>

          <div className="bg-[#1877F2] text-white rounded-lg p-8 text-center">
            <Facebook className="w-12 h-12 mx-auto mb-4" />
            <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 600 }}>
              Facebook
            </h3>
            <p className="mt-2 opacity-90">Alcance regional</p>
          </div>
        </div>
      </Section>

      <Section title="Templates de Feed (1080×1350)">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {feedTemplates.map((template) => (
            <div key={template.name} className="rounded-lg overflow-hidden shadow-lg">
              <div 
                className="aspect-[4/5] flex flex-col items-center justify-center p-6 relative"
                style={{ backgroundColor: template.bg }}
              >
                <MushroomIcon 
                  className="w-20 h-20 mb-4" 
                  style={{ color: template.accent }}
                />
                <h4 
                  className="font-['Cormorant_Garamond'] text-center"
                  style={{ 
                    fontSize: '24px', 
                    fontWeight: 600,
                    color: template.accent
                  }}
                >
                  {template.name}
                </h4>
                <div 
                  className="absolute bottom-4 left-4 right-4 h-1 rounded-full opacity-30"
                  style={{ backgroundColor: template.accent }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-white rounded-lg p-6 border-2 border-[#E3E3E3]">
          <h4 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
            Tipos de Conteúdo
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#1A1A1A]">
            <li>• Lançamento de lote novo</li>
            <li>• Preço e disponibilidade do dia</li>
            <li>• Receitas com shiitake</li>
            <li>• Carrossel educativo ("como armazenar")</li>
            <li>• Post institucional</li>
            <li>• Foto premium (preto e dourado)</li>
            <li>• Foto clara (minimalista clean)</li>
            <li>• Depoimentos de clientes</li>
          </ul>
        </div>
      </Section>

      <Section title="Templates de Stories (1080×1920)">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {storyTemplates.map((template, index) => (
            <div key={template} className="rounded-lg overflow-hidden shadow-lg">
              <div 
                className="aspect-[9/16] flex items-center justify-center p-4 text-center"
                style={{ 
                  backgroundColor: index % 2 === 0 ? '#1A1A1A' : '#546A4A'
                }}
              >
                <span 
                  className="font-['Cormorant_Garamond']"
                  style={{ 
                    fontSize: '18px', 
                    fontWeight: 600,
                    color: index % 2 === 0 ? '#A88F52' : 'white'
                  }}
                >
                  {template}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-[#F8F6F2] rounded-lg p-6 border-2 border-[#E3E3E3]">
          <h4 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
            Conteúdo de Stories
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[#1A1A1A]">
            <li>• Aviso de colheita disponível</li>
            <li>• Bastidores da produção</li>
            <li>• Diário do cultivo</li>
            <li>• Enquetes e interação</li>
            <li>• Preços especiais/promoções</li>
            <li>• Tutoriais rápidos</li>
            <li>• Curiosidades sobre cogumelos</li>
            <li>• Parceiros e restaurantes</li>
          </ul>
        </div>
      </Section>

      <Section title="Covers dos Destaques">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
          {highlights.map((highlight) => (
            <div key={highlight.label} className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#546A4A] to-[#3B2F28] flex items-center justify-center mb-3 border-4 border-[#A88F52]">
                <span style={{ fontSize: '32px' }}>{highlight.icon}</span>
              </div>
              <p className="text-sm text-[#1A1A1A]">{highlight.label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Diretrizes de Conteúdo">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-[#546A4A] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] text-[#546A4A] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Tom de Voz
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Amigável e acessível</li>
              <li>• Educativo sem ser técnico demais</li>
              <li>• Transparente sobre processos</li>
              <li>• Orgulhoso da qualidade</li>
              <li>• Próximo e familiar</li>
            </ul>
          </div>

          <div className="bg-white border-2 border-[#A88F52] rounded-lg p-6">
            <h3 className="font-['Cormorant_Garamond'] text-[#A88F52] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
              Estilo Visual
            </h3>
            <ul className="space-y-2 text-[#1A1A1A]">
              <li>• Fotos naturais com boa iluminação</li>
              <li>• Fundos neutros ou escuros</li>
              <li>• Foco no produto</li>
              <li>• Mostrar frescor e textura</li>
              <li>• Usar elementos da paleta de cores</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Hashtags Sugeridas">
        <div className="bg-[#1A1A1A] text-white rounded-lg p-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              '#ShroomBros',
              '#CogumelosFrescos',
              '#Shiitake',
              '#CoguelosGourmet',
              '#AlimentosSustentáveis',
              '#FreshMushrooms',
              '#Cogumelos',
              '#MushroomFarm',
              '#OrganicFood',
              '#FarmToTable',
              '#SulDoBrasil',
              '#GourmetFood',
              '#HealthyEating',
              '#Sustentabilidade',
            ].map((hashtag) => (
              <span 
                key={hashtag}
                className="px-4 py-2 bg-[#2A2A2A] rounded-full text-[#A88F52] hover:bg-[#A88F52] hover:text-white transition-colors cursor-pointer"
              >
                {hashtag}
              </span>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
