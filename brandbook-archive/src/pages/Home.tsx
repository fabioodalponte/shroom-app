import { Link } from 'react-router';
import { MushroomIcon } from '../components/MushroomIcon';
import { ArrowRight, Book, Palette, Type, Package, Image, Share2 } from 'lucide-react';
import brandBoard from 'figma:asset/0e43cee4198b31bb6344720bcec45edb39ce5c6e.png';

export function Home() {
  const sections = [
    { icon: Book, title: 'Brand Overview', path: '/brand-overview', description: 'Mission, vision, values & personality' },
    { icon: Palette, title: 'Logo System', path: '/logo-system', description: 'Logo variations & usage guidelines' },
    { icon: Type, title: 'Typography', path: '/typography', description: 'Font families & hierarchy system' },
    { icon: Palette, title: 'Color System', path: '/color-system', description: 'Minimal & premium color palettes' },
    { icon: Image, title: 'Visual Elements', path: '/visual-elements', description: 'Icons, textures & design elements' },
    { icon: Package, title: 'Packaging', path: '/packaging', description: 'Labels & packaging designs' },
    { icon: Share2, title: 'Social Media', path: '/social-media', description: 'Templates for digital platforms' },
    { icon: Image, title: 'Mockups', path: '/mockups', description: 'Product & branding mockups' },
    { icon: Book, title: 'Applications', path: '/applications', description: 'Business cards, stickers & more' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1A1A1A] to-[#3B2F28] text-white py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10">
            <MushroomIcon className="w-32 h-32" />
          </div>
          <div className="absolute bottom-10 right-10">
            <MushroomIcon className="w-48 h-48" />
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex items-center justify-center mb-8">
            <MushroomIcon className="w-20 h-20 text-[#A88F52]" />
          </div>
          
          <h1 className="text-center font-['Cormorant_Garamond']" style={{ fontSize: '72px', fontWeight: 700, lineHeight: 1.1 }}>
            Shroom Bros
          </h1>
          
          <p className="text-center text-[#A88F52] mt-4 font-['Cormorant_Garamond']" style={{ fontSize: '28px' }}>
            Brand Guidelines
          </p>
          
          <p className="text-center text-[#E3E3E3] mt-8 max-w-3xl mx-auto" style={{ fontSize: '18px' }}>
            Complete brand identity system for premium, sustainable mushrooms.
            <br />
            A hybrid approach combining minimal elegance with gourmet sophistication.
          </p>

          <div className="flex justify-center mt-12">
            <Link
              to="/brand-overview"
              className="inline-flex items-center gap-2 bg-[#A88F52] text-white px-8 py-4 rounded hover:bg-[#8F7742] transition-colors"
            >
              Explore the Guidelines
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Brand Board Preview */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-['Cormorant_Garamond'] mb-8" style={{ fontSize: '48px', fontWeight: 500 }}>
            Brand Overview
          </h2>
          <div className="rounded-lg overflow-hidden shadow-lg">
            <img src={brandBoard} alt="Shroom Bros Brand Board" className="w-full" />
          </div>
        </div>
      </section>

      {/* Navigation Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-['Cormorant_Garamond'] mb-12" style={{ fontSize: '48px', fontWeight: 500 }}>
            Guidelines Sections
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Link
                  key={section.path}
                  to={section.path}
                  className="group bg-white border-2 border-[#E3E3E3] rounded-lg p-6 hover:border-[#A88F52] transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#F8F6F2] rounded-lg group-hover:bg-[#A88F52] transition-colors">
                      <Icon className="w-6 h-6 text-[#1A1A1A] group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-['Cormorant_Garamond'] group-hover:text-[#A88F52] transition-colors" style={{ fontSize: '24px', fontWeight: 600 }}>
                        {section.title}
                      </h3>
                      <p className="text-[#1A1A1A] mt-2 opacity-70">
                        {section.description}
                      </p>
                      <div className="flex items-center gap-2 mt-4 text-[#A88F52] opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>View section</span>
                        <ArrowRight size={16} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Brand Essence */}
      <section className="py-16 bg-[#546A4A] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="font-['Cormorant_Garamond'] mb-6" style={{ fontSize: '48px', fontWeight: 500 }}>
            Brand Essence
          </h2>
          <p style={{ fontSize: '20px', lineHeight: 1.6 }}>
            Shroom Bros is a brand of fresh, natural, high-quality mushrooms, produced by two brothers,
            with focus on flavor, sustainability and simplicity.
          </p>
        </div>
      </section>
    </div>
  );
}
