import { Outlet, NavLink } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { MushroomIcon } from './MushroomIcon';

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Home' },
    { to: '/app', label: '🍄 Production App', highlight: true },
    { to: '/complete-guide', label: 'Guia Completo' },
    { to: '/brand-overview', label: 'Brand Overview' },
    { to: '/logo-system', label: 'Logo System' },
    { to: '/typography', label: 'Typography' },
    { to: '/color-system', label: 'Color System' },
    { to: '/visual-elements', label: 'Visual Elements' },
    { to: '/packaging', label: 'Packaging' },
    { to: '/social-media', label: 'Social Media' },
    { to: '/mockups', label: 'Mockups' },
    { to: '/applications', label: 'Applications' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#1A1A1A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <NavLink to="/" className="flex items-center gap-3">
              <MushroomIcon className="w-8 h-8 text-[#A88F52]" />
              <span className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 600 }}>
                Shroom Bros
              </span>
            </NavLink>
            
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded transition-colors ${
                      item.highlight 
                        ? 'bg-[#546A4A] text-white hover:bg-[#3B2F28]'
                        : isActive
                        ? 'bg-[#A88F52] text-white'
                        : 'text-[#E3E3E3] hover:bg-[#2A2A2A]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {menuOpen && (
          <nav className="lg:hidden border-t border-[#2A2A2A] bg-[#1A1A1A]">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded transition-colors ${
                      item.highlight
                        ? 'bg-[#546A4A] text-white hover:bg-[#3B2F28]'
                        : isActive
                        ? 'bg-[#A88F52] text-white'
                        : 'text-[#E3E3E3] hover:bg-[#2A2A2A]'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-16">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] text-[#E3E3E3] py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>© 2024 Shroom Bros. Brand Guidelines — All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}