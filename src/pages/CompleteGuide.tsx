import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { MushroomIcon } from '../components/MushroomIcon';
import { ColorCard } from '../components/ColorCard';
import { Download, Printer } from 'lucide-react';
import { Sparkles, Target, Eye, Heart, Leaf, Shield, Users, Cpu, Check, X, Droplet, Sun, Package, QrCode, Instagram, MessageCircle, Facebook, Mail, Phone, MapPin, Globe } from 'lucide-react';
import brandBoard from 'figma:asset/0e43cee4198b31bb6344720bcec45edb39ce5c6e.png';
import gourmetPackaging from 'figma:asset/1d9dce24d6d305d665bafffa5ef98e3b827978d0.png';
import labelMockup from 'figma:asset/c0a614de4c0c26425ad87a6d6ccf9e0bebb46379.png';

export function CompleteGuide() {
  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print(); // Browser will handle "Save as PDF" option
  };

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

  const icons = [
    { icon: MushroomIcon, label: 'Cogumelo', description: 'Símbolo da marca' },
    { icon: Droplet, label: 'Gota d\'água', description: 'Frescor' },
    { icon: Leaf, label: 'Folha', description: 'Sustentável' },
    { icon: Sun, label: 'Sol', description: 'Natural' },
    { icon: Package, label: 'Caixa', description: 'Entrega' },
  ];

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

  const highlights = [
    { icon: '🍄', label: 'Produtos' },
    { icon: '🌱', label: 'Colheita' },
    { icon: '🏭', label: 'Produção' },
    { icon: '🎬', label: 'Bastidores' },
    { icon: '👨‍🍳', label: 'Receitas' },
    { icon: '📞', label: 'Contato' },
  ];

  return (
    <div className="complete-guide">
      {/* Export Buttons - Hidden on print */}
      <div className="fixed top-20 right-4 z-40 flex gap-2 print:hidden">
        <button
          onClick={handlePrint}
          className="bg-[#546A4A] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#3B2F28] transition-colors shadow-lg"
        >
          <Printer size={20} />
          Imprimir
        </button>
        <button
          onClick={handleExportPDF}
          className="bg-[#A88F52] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#8F7742] transition-colors shadow-lg"
        >
          <Download size={20} />
          Exportar PDF
        </button>
      </div>

      <PageHeader
        title="Guia Completo"
        description="Manual completo de identidade visual Shroom Bros — todas as diretrizes em uma única página."
      />

      {/* PÁGINA 01 — BRAND OVERVIEW */}
      <Section title="01 — Brand Overview">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Brand Essence
            </h3>
            <div className="bg-white border-2 border-[#A88F52] rounded-lg p-8">
              <p className="text-center" style={{ fontSize: '20px', lineHeight: 1.8 }}>
                Shroom Bros é uma marca de <strong>cogumelos frescos, naturais e de alta qualidade</strong>,
                produzidos por dois irmãos, com foco em <strong>sabor, sustentabilidade e simplicidade</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#F8F6F2] rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 p-3 bg-[#546A4A] rounded-full">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-['Cormorant_Garamond'] mb-2" style={{ fontSize: '24px', fontWeight: 600 }}>
                    Missão
                  </h3>
                  <p style={{ fontSize: '16px', lineHeight: 1.6 }}>
                    Cultivar cogumelos premium com cuidado, ciência e respeito ao meio ambiente,
                    entregando frescor e qualidade para famílias e restaurantes.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#F8F6F2] rounded-lg p-8">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 p-3 bg-[#A88F52] rounded-full">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-['Cormorant_Garamond'] mb-2" style={{ fontSize: '24px', fontWeight: 600 }}>
                    Visão
                  </h3>
                  <p style={{ fontSize: '16px', lineHeight: 1.6 }}>
                    Ser referência no mercado de cogumelos frescos do Sul do Brasil,
                    expandindo para produtos especiais e linha gourmet.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Valores
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {values.map((value) => {
                const Icon = value.icon;
                return (
                  <div key={value.title} className="bg-white border border-[#E3E3E3] rounded-lg p-4 text-center">
                    <div className="p-2 bg-[#546A4A] rounded-lg inline-block mb-2">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className="font-['Cormorant_Garamond'] mb-1" style={{ fontSize: '18px', fontWeight: 600 }}>
                      {value.title}
                    </h4>
                    <p className="text-xs text-[#1A1A1A] opacity-70">
                      {value.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Personalidade da Marca
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {personality.map((trait) => (
                <div
                  key={trait}
                  className="bg-[#1A1A1A] border border-[#A88F52] rounded-lg p-4 text-center"
                >
                  <Heart className="w-5 h-5 mx-auto mb-2 text-[#A88F52]" />
                  <p className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '16px', fontWeight: 500 }}>
                    {trait}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 02 — LOGO SYSTEM */}
      <Section title="02 — Logo System" className="bg-[#F8F6F2]">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Logo Principal
            </h3>
            <div className="bg-white rounded-lg p-8 border-2 border-[#E3E3E3]">
              <div className="max-w-md mx-auto">
                <div className="flex flex-col items-center">
                  <MushroomIcon className="w-20 h-20 text-[#A88F52] mb-4" />
                  <h2 className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '42px', fontWeight: 700 }}>
                    Shroom Bros
                  </h2>
                </div>
                <p className="text-center mt-4 text-[#1A1A1A] opacity-70">
                  Hybrid Minimal + Gourmet
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Variações
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Horizontal */}
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <MushroomIcon className="w-12 h-12 text-[#1A1A1A]" />
                  <span className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                    Shroom Bros
                  </span>
                </div>
                <p className="text-center text-xs text-[#1A1A1A] opacity-70">Horizontal</p>
              </div>

              {/* Vertical */}
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-6">
                <div className="flex flex-col items-center mb-2">
                  <MushroomIcon className="w-12 h-12 text-[#1A1A1A] mb-2" />
                  <span className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                    Shroom Bros
                  </span>
                </div>
                <p className="text-center text-xs text-[#1A1A1A] opacity-70">Vertical</p>
              </div>

              {/* Icon */}
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-6">
                <div className="flex justify-center mb-2">
                  <MushroomIcon className="w-12 h-12 text-[#1A1A1A]" />
                </div>
                <p className="text-center text-xs text-[#1A1A1A] opacity-70">Ícone Isolado</p>
              </div>

              {/* Gold */}
              <div className="bg-[#1A1A1A] border border-[#A88F52] rounded-lg p-6">
                <div className="flex flex-col items-center mb-2">
                  <MushroomIcon className="w-12 h-12 text-[#A88F52] mb-2" />
                  <span className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '24px', fontWeight: 700 }}>
                    Shroom Bros
                  </span>
                </div>
                <p className="text-center text-xs text-[#A88F52] opacity-70">Premium Dourado</p>
              </div>

              {/* Black */}
              <div className="bg-[#F8F6F2] border border-[#E3E3E3] rounded-lg p-6">
                <div className="flex flex-col items-center mb-2">
                  <MushroomIcon className="w-12 h-12 text-[#1A1A1A] mb-2" />
                  <span className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '24px', fontWeight: 700 }}>
                    Shroom Bros
                  </span>
                </div>
                <p className="text-center text-xs text-[#1A1A1A] opacity-70">Minimal Preto</p>
              </div>

              {/* White */}
              <div className="bg-[#3B2F28] border border-[#3B2F28] rounded-lg p-6">
                <div className="flex flex-col items-center mb-2">
                  <MushroomIcon className="w-12 h-12 text-white mb-2" />
                  <span className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '24px', fontWeight: 700 }}>
                    Shroom Bros
                  </span>
                </div>
                <p className="text-center text-xs text-white opacity-70">Branco Reverso</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Uso Apropriado
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border-2 border-green-500 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3 text-green-600">
                  <Check size={20} />
                  <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                    Práticas Recomendadas
                  </h4>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Manter proporções originais</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Usar cores da paleta oficial</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span>Respeitar área de respiro</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white border-2 border-red-500 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-3 text-red-600">
                  <X size={20} />
                  <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                    Evitar
                  </h4>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span>Não esticar ou distorcer</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span>Não alterar cores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <span>Não aplicar sombra dura</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 03 — TYPOGRAPHY */}
      <Section title="03 — Typography">
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border-2 border-[#A88F52] rounded-lg p-6">
              <span className="inline-block px-3 py-1 bg-[#A88F52] text-white rounded-full text-xs mb-3">
                🅐 Títulos
              </span>
              <h3 className="font-['Cormorant_Garamond'] mb-2" style={{ fontSize: '32px', fontWeight: 700 }}>
                Cormorant Garamond
              </h3>
              <p className="text-sm text-[#1A1A1A] opacity-70 mb-4">
                Elegante, gourmet, sofisticada
              </p>
              <p className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 400 }}>
                Aa Bb Cc Dd Ee Ff Gg
              </p>
            </div>

            <div className="bg-white border-2 border-[#546A4A] rounded-lg p-6">
              <span className="inline-block px-3 py-1 bg-[#546A4A] text-white rounded-full text-xs mb-3">
                🅑 Corpo
              </span>
              <h3 className="mb-2" style={{ fontSize: '32px', fontWeight: 700 }}>
                Inter
              </h3>
              <p className="text-sm text-[#1A1A1A] opacity-70 mb-4">
                Moderno, limpo, tecnológico
              </p>
              <p style={{ fontSize: '20px', fontWeight: 400 }}>
                Aa Bb Cc Dd Ee Ff Gg
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 border-2 border-[#E3E3E3] space-y-6">
            <div>
              <p className="text-xs text-[#A88F52] mb-2">H1 — Cormorant Garamond Bold 64</p>
              <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '48px', fontWeight: 700 }}>
                Cogumelos Premium
              </h1>
            </div>
            <div>
              <p className="text-xs text-[#A88F52] mb-2">H2 — Cormorant Medium 42</p>
              <h2 className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 500 }}>
                Frescor e Qualidade
              </h2>
            </div>
            <div>
              <p className="text-xs text-[#A88F52] mb-2">Body — Inter Regular 16–18</p>
              <p style={{ fontSize: '16px' }}>
                Nossa produção combina tecnologia moderna com respeito à natureza.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 04 — COLOR SYSTEM */}
      <Section title="04 — Color System" className="bg-[#F8F6F2]">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Paleta Principal Minimalista
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {minimalPalette.map((color) => (
                <ColorCard key={color.hex} {...color} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Paleta Premium Gourmet
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {premiumPalette.map((color) => (
                <ColorCard key={color.hex} {...color} />
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 05 — VISUAL ELEMENTS */}
      <Section title="05 — Visual Elements">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Ícones Exclusivos
            </h3>
            <div className="grid grid-cols-5 gap-4">
              {icons.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="bg-white border border-[#E3E3E3] rounded-lg p-4 text-center">
                    <Icon className="w-10 h-10 text-[#1A1A1A] mx-auto mb-2" />
                    <p className="text-xs text-[#1A1A1A]">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Molduras
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#1A1A1A] p-6">
                <div className="border-2 border-[#A88F52] rounded p-6 text-center">
                  <h4 className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '24px', fontWeight: 600 }}>
                    GOURMET
                  </h4>
                </div>
              </div>
              <div className="bg-[#F8F6F2] p-6">
                <div className="border border-[#1A1A1A] rounded p-6 text-center">
                  <h4 className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '24px', fontWeight: 600 }}>
                    MINIMAL
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 06 — PACKAGING */}
      <Section title="06 — Packaging System" className="bg-[#F8F6F2]">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Embalagem Gourmet Premium
            </h3>
            <div className="bg-white rounded-lg p-6">
              <img src={gourmetPackaging} alt="Gourmet Packaging" className="w-full max-w-2xl mx-auto rounded" />
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Etiqueta Minimalista
            </h3>
            <div className="bg-white rounded-lg p-6">
              <img src={labelMockup} alt="Label Mockup" className="w-full max-w-2xl mx-auto rounded" />
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Tamanhos Disponíveis
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-4 text-center">
                <div className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '36px', fontWeight: 700 }}>
                  200g
                </div>
              </div>
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-4 text-center">
                <div className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '36px', fontWeight: 700 }}>
                  250g
                </div>
              </div>
              <div className="bg-white border border-[#E3E3E3] rounded-lg p-4 text-center">
                <div className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '36px', fontWeight: 700 }}>
                  300g
                </div>
              </div>
              <div className="bg-[#1A1A1A] border border-[#A88F52] rounded-lg p-4 text-center">
                <div className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 700 }}>
                  Custom
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 07 — SOCIAL MEDIA */}
      <Section title="07 — Social Media Kit">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Plataformas Principais
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white rounded-lg p-6 text-center">
                <Instagram className="w-10 h-10 mx-auto mb-2" />
                <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                  Instagram
                </h4>
              </div>
              <div className="bg-[#25D366] text-white rounded-lg p-6 text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-2" />
                <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                  WhatsApp
                </h4>
              </div>
              <div className="bg-[#1877F2] text-white rounded-lg p-6 text-center">
                <Facebook className="w-10 h-10 mx-auto mb-2" />
                <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                  Facebook
                </h4>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Covers dos Destaques
            </h3>
            <div className="grid grid-cols-6 gap-4">
              {highlights.map((highlight) => (
                <div key={highlight.label} className="text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-[#546A4A] flex items-center justify-center border-2 border-[#A88F52]">
                    <span style={{ fontSize: '24px' }}>{highlight.icon}</span>
                  </div>
                  <p className="text-xs text-[#1A1A1A] mt-2">{highlight.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Hashtags Sugeridas
            </h3>
            <div className="bg-[#1A1A1A] rounded-lg p-6">
              <div className="flex flex-wrap gap-2">
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
                ].map((hashtag) => (
                  <span key={hashtag} className="px-3 py-1 bg-[#2A2A2A] rounded-full text-[#A88F52] text-xs">
                    {hashtag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 08 — MOCKUPS */}
      <Section title="08 — Mockups" className="bg-[#F8F6F2]">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Brand Board Completo
            </h3>
            <div className="bg-white rounded-lg p-6">
              <img src={brandBoard} alt="Brand Board" className="w-full rounded" />
            </div>
          </div>
        </div>
      </Section>

      {/* PÁGINA 09 — APPLICATIONS */}
      <Section title="09 — Brand Applications">
        <div className="space-y-8">
          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Cartão de Visita
            </h3>
            <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-[#E3E3E3]">
                <div className="aspect-[1.75/1] bg-[#1A1A1A] p-6 flex flex-col items-center justify-center">
                  <MushroomIcon className="w-12 h-12 text-[#A88F52] mb-2" />
                  <h3 className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '20px', fontWeight: 700 }}>
                    Shroom Bros
                  </h3>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-[#E3E3E3]">
                <div className="aspect-[1.75/1] bg-[#F8F6F2] p-6 flex flex-col justify-center text-xs">
                  <h4 className="font-['Cormorant_Garamond'] mb-2" style={{ fontSize: '16px', fontWeight: 600 }}>
                    João & Pedro Silva
                  </h4>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Phone size={10} className="text-[#546A4A]" />
                      <span>+55 (47) 9 9999-9999</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail size={10} className="text-[#546A4A]" />
                      <span>contato@shroombros.com.br</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-['Cormorant_Garamond'] mb-4 text-[#A88F52]" style={{ fontSize: '28px', fontWeight: 600 }}>
              Adesivos
            </h3>
            <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#A88F52] flex items-center justify-center border-2 border-white shadow-lg">
                  <MushroomIcon className="w-12 h-12 text-white" />
                </div>
                <p className="mt-2 text-xs">Dourado</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-[#546A4A] flex items-center justify-center border-2 border-white shadow-lg">
                  <MushroomIcon className="w-12 h-12 text-white" />
                </div>
                <p className="mt-2 text-xs">Verde</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto rounded-lg bg-[#F8F6F2] flex flex-col items-center justify-center border border-[#1A1A1A]">
                  <MushroomIcon className="w-10 h-10 text-[#1A1A1A]" />
                </div>
                <p className="mt-2 text-xs">Minimal</p>
              </div>
              <div className="text-center">
                <div className="w-20 h-20 mx-auto flex items-center justify-center">
                  <MushroomIcon className="w-16 h-16 text-[#A88F52]" />
                </div>
                <p className="mt-2 text-xs">Recorte</p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <div className="bg-[#1A1A1A] text-white py-8 print:bg-white print:text-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <MushroomIcon className="w-12 h-12 text-[#A88F52] mx-auto mb-4 print:hidden" />
          <p className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 600 }}>
            Shroom Bros
          </p>
          <p className="mt-2 text-sm opacity-70">
            Manual de Identidade Visual — Versão 1.0 • Dezembro 2024
          </p>
        </div>
      </div>
    </div>
  );
}
