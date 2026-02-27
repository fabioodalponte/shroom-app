import { PageHeader } from '../components/PageHeader';
import { Section } from '../components/Section';
import { MushroomIcon } from '../components/MushroomIcon';
import { Check, X } from 'lucide-react';

export function LogoSystem() {
  return (
    <div>
      <PageHeader
        pageNumber="PÁGINA 02"
        title="Logo System"
        description="Sistema de identidade visual: variações do logo, áreas de respiro e boas práticas de aplicação."
      />

      <Section title="Logo Principal">
        <div className="bg-white rounded-lg p-12 border-2 border-[#E3E3E3]">
          <div className="max-w-md mx-auto">
            <div className="flex flex-col items-center">
              <MushroomIcon className="w-24 h-24 text-[#A88F52] mb-6" />
              <h2 className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '48px', fontWeight: 700 }}>
                Shroom Bros
              </h2>
            </div>
            <p className="text-center mt-6 text-[#1A1A1A] opacity-70">
              Hybrid Minimal + Gourmet
            </p>
          </div>
        </div>
      </Section>

      <Section title="Variações">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Horizontal */}
          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-8">
            <div className="flex items-center justify-center gap-4">
              <MushroomIcon className="w-16 h-16 text-[#1A1A1A]" />
              <span className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="text-center mt-4 text-sm text-[#1A1A1A] opacity-70">Horizontal</p>
          </div>

          {/* Vertical (main) */}
          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <MushroomIcon className="w-16 h-16 text-[#1A1A1A] mb-3" />
              <span className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="text-center mt-4 text-sm text-[#1A1A1A] opacity-70">Vertical</p>
          </div>

          {/* Icon only */}
          <div className="bg-white border-2 border-[#E3E3E3] rounded-lg p-8">
            <div className="flex justify-center">
              <MushroomIcon className="w-16 h-16 text-[#1A1A1A]" />
            </div>
            <p className="text-center mt-4 text-sm text-[#1A1A1A] opacity-70">Ícone Isolado</p>
          </div>

          {/* Gold premium */}
          <div className="bg-[#1A1A1A] border-2 border-[#A88F52] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <MushroomIcon className="w-16 h-16 text-[#A88F52] mb-3" />
              <span className="font-['Cormorant_Garamond'] text-[#A88F52]" style={{ fontSize: '32px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="text-center mt-4 text-sm text-[#A88F52] opacity-70">Símbolo Dourado (Premium)</p>
          </div>

          {/* Black minimal */}
          <div className="bg-[#F8F6F2] border-2 border-[#E3E3E3] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <MushroomIcon className="w-16 h-16 text-[#1A1A1A] mb-3" />
              <span className="font-['Cormorant_Garamond'] text-[#1A1A1A]" style={{ fontSize: '32px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="text-center mt-4 text-sm text-[#1A1A1A] opacity-70">Preto (Minimal)</p>
          </div>

          {/* White reverse */}
          <div className="bg-[#3B2F28] border-2 border-[#3B2F28] rounded-lg p-8">
            <div className="flex flex-col items-center">
              <MushroomIcon className="w-16 h-16 text-white mb-3" />
              <span className="font-['Cormorant_Garamond'] text-white" style={{ fontSize: '32px', fontWeight: 700 }}>
                Shroom Bros
              </span>
            </div>
            <p className="text-center mt-4 text-sm text-white opacity-70">Branco (Reverso)</p>
          </div>
        </div>
      </Section>

      <Section title="Área de Respiro (Clear Space)">
        <div className="bg-white rounded-lg p-12 border-2 border-[#E3E3E3]">
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-block relative p-16 border-2 border-dashed border-[#A88F52]">
              <div className="flex flex-col items-center">
                <MushroomIcon className="w-20 h-20 text-[#1A1A1A] mb-4" />
                <span className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700 }}>
                  Shroom Bros
                </span>
              </div>
              <div className="absolute top-2 left-2 right-2 bottom-2 border border-[#A88F52] opacity-30 pointer-events-none" />
            </div>
            <p className="mt-6 text-[#1A1A1A] opacity-70">
              Manter 0,5x do tamanho do ícone ao redor da marca
            </p>
          </div>
        </div>
      </Section>

      <Section title="Uso Apropriado">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Do's */}
          <div className="bg-white border-2 border-green-500 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4 text-green-600">
              <Check size={24} />
              <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 600 }}>
                Práticas Recomendadas
              </h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <Check size={20} className="text-green-500 flex-shrink-0 mt-1" />
                <span>Manter proporções originais</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={20} className="text-green-500 flex-shrink-0 mt-1" />
                <span>Usar cores da paleta oficial</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={20} className="text-green-500 flex-shrink-0 mt-1" />
                <span>Fundos escuros → logo branco ou dourado</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={20} className="text-green-500 flex-shrink-0 mt-1" />
                <span>Fundos claros → logo preto</span>
              </li>
              <li className="flex items-start gap-2">
                <Check size={20} className="text-green-500 flex-shrink-0 mt-1" />
                <span>Respeitar área de respiro</span>
              </li>
            </ul>
          </div>

          {/* Don'ts */}
          <div className="bg-white border-2 border-red-500 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4 text-red-600">
              <X size={24} />
              <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 600 }}>
                Evitar
              </h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <X size={20} className="text-red-500 flex-shrink-0 mt-1" />
                <span>Não esticar ou distorcer</span>
              </li>
              <li className="flex items-start gap-2">
                <X size={20} className="text-red-500 flex-shrink-0 mt-1" />
                <span>Não rotacionar</span>
              </li>
              <li className="flex items-start gap-2">
                <X size={20} className="text-red-500 flex-shrink-0 mt-1" />
                <span>Não alterar cores</span>
              </li>
              <li className="flex items-start gap-2">
                <X size={20} className="text-red-500 flex-shrink-0 mt-1" />
                <span>Não aplicar sombra dura</span>
              </li>
              <li className="flex items-start gap-2">
                <X size={20} className="text-red-500 flex-shrink-0 mt-1" />
                <span>Não usar texturas atrás do logo minimalista</span>
              </li>
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}
