import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { Droplet, Leaf, Sun, Package, QrCode } from 'lucide-react';
import { MushroomIcon } from '../components/MushroomIcon';

export function VisualElements() {
  const icons = [
    { icon: MushroomIcon, label: 'Cogumelo', description: 'Símbolo da marca' },
    { icon: Droplet, label: 'Gota d\'água', description: 'Frescor' },
    { icon: Leaf, label: 'Folha', description: 'Sustentável' },
    { icon: Sun, label: 'Sol', description: 'Natural' },
    { icon: Package, label: 'Caixa', description: 'Entrega' },
  ];

  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 05"
        title="Visual Elements"
        description="Elementos visuais exclusivos: ícones, molduras, texturas e detalhes que complementam a identidade."
      />

      <Section title="Ícones Exclusivos (Estilo 1C)">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {icons.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="bg-white border-2 border-[#E3E3E3] rounded-lg p-6 text-center hover:border-[#A88F52] transition-colors">
                <div className="flex justify-center mb-4">
                  <Icon className="w-12 h-12 text-[#1A1A1A]" />
                </div>
                <h4 className="font-['Cormorant_Garamond'] mb-1" style={{ fontSize: '18px', fontWeight: 600 }}>
                  {item.label}
                </h4>
                <p className="text-sm text-[#1A1A1A] opacity-60">{item.description}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Molduras Gourmet">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gold frame */}
          <div className="bg-[#1A1A1A] p-8">
            <div className="border-2 border-[#A88F52] rounded p-8">
              <h3 className="font-['Cormorant_Garamond'] text-[#A88F52] text-center" style={{ fontSize: '32px', fontWeight: 600 }}>
                GOURMET
              </h3>
              <p className="text-white text-center mt-4">
                Moldura dourada premium para produtos especiais
              </p>
            </div>
          </div>

          {/* Minimal frame */}
          <div className="bg-[#F8F6F2] p-8">
            <div className="border border-[#1A1A1A] rounded p-8">
              <h3 className="font-['Cormorant_Garamond'] text-[#1A1A1A] text-center" style={{ fontSize: '32px', fontWeight: 600 }}>
                MINIMAL
              </h3>
              <p className="text-[#1A1A1A] text-center mt-4">
                Linha fina minimalista para uso diário
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg p-8 border-2 border-[#E3E3E3]">
          <h4 className="font-['Cormorant_Garamond'] mb-4" style={{ fontSize: '24px', fontWeight: 600 }}>
            Especificações
          </h4>
          <ul className="space-y-2 text-[#1A1A1A]">
            <li>• <strong>Linhas finas douradas:</strong> 1-2px de espessura</li>
            <li>• <strong>Cantos arredondados:</strong> border-radius de 4px</li>
            <li>• <strong>Divisores minimalistas:</strong> linhas horizontais sutis</li>
          </ul>
        </div>
      </Section>

      <Section title="QR Code Frame Premium">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <div className="border-2 border-[#1A1A1A] rounded p-4 inline-block">
                <QrCode className="w-24 h-24 text-[#1A1A1A]" />
              </div>
              <p className="mt-4 text-center text-sm text-[#1A1A1A] opacity-70">
                QR Code com moldura minimal
              </p>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border-2 border-[#A88F52] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <div className="border-2 border-[#A88F52] rounded p-4 inline-block">
                <QrCode className="w-24 h-24 text-[#A88F52]" />
              </div>
              <p className="mt-4 text-center text-sm text-[#A88F52]">
                QR Code premium dourado
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Texturas">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Paper texture */}
          <div className="rounded-lg overflow-hidden border-2 border-[#E3E3E3]">
            <div 
              className="h-48 bg-[#F8F6F2] relative"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.05" /%3E%3C/svg%3E")',
              }}
            />
            <div className="p-4 bg-white">
              <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>
                Papel Artesanal
              </h4>
              <p className="text-sm text-[#1A1A1A] opacity-70 mt-1">
                Textura sutil para fundos
              </p>
            </div>
          </div>

          {/* Cream background */}
          <div className="rounded-lg overflow-hidden border-2 border-[#E3E3E3]">
            <div className="h-48 bg-[#F8F6F2]" />
            <div className="p-4 bg-white">
              <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>
                Fundo Creme
              </h4>
              <p className="text-sm text-[#1A1A1A] opacity-70 mt-1">
                Base neutra e acolhedora
              </p>
            </div>
          </div>

          {/* Black satin */}
          <div className="rounded-lg overflow-hidden border-2 border-[#A88F52]">
            <div 
              className="h-48 bg-[#1A1A1A]"
              style={{
                backgroundImage: 'linear-gradient(135deg, rgba(168,143,82,0.1) 0%, transparent 100%)',
              }}
            />
            <div className="p-4 bg-white">
              <h4 className="font-['Cormorant_Garamond']" style={{ fontSize: '18px', fontWeight: 600 }}>
                Preto Acetinado
              </h4>
              <p className="text-sm text-[#1A1A1A] opacity-70 mt-1">
                Premium com brilho sutil
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Divisores e Linhas">
        <div className="bg-white rounded-lg p-8 border-2 border-[#E3E3E3] space-y-8">
          <div>
            <p className="text-sm text-[#A88F52] mb-3">Linha dourada premium (2px)</p>
            <div className="h-0.5 bg-[#A88F52]" />
          </div>

          <div>
            <p className="text-sm text-[#1A1A1A] opacity-70 mb-3">Linha minimalista (1px)</p>
            <div className="h-px bg-[#1A1A1A]" />
          </div>

          <div>
            <p className="text-sm text-[#1A1A1A] opacity-70 mb-3">Linha suave (1px)</p>
            <div className="h-px bg-[#E3E3E3]" />
          </div>

          <div>
            <p className="text-sm text-[#A88F52] mb-3">Divisor com detalhes</p>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-[#A88F52]" />
              <MushroomIcon className="w-6 h-6 text-[#A88F52]" />
              <div className="flex-1 h-px bg-[#A88F52]" />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
