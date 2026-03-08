import { Outlet, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import {
  Beaker,
  Box,
  ClipboardList,
  DollarSign,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Package,
  Scissors,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  Truck,
  User,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { MushroomIcon } from '../../components/MushroomIcon';
import { cn } from '../../components/ui/utils';
import { SidebarNavigation } from './SidebarNavigation';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'shroom.sidebar.collapsed';

export function AppLayout() {
  const navigate = useNavigate();
  const { usuario, signOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (stored !== null) return stored === '1';

    return window.matchMedia('(max-width: 1280px)').matches;
  });

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lotes', icon: Package, label: 'Lotes' },
    { to: '/colheita', icon: Scissors, label: 'Colheita' },
    { to: '/estoque', icon: Box, label: 'Estoque' },
    { to: '/vendas', icon: ShoppingCart, label: 'Vendas' },
    { to: '/compras', icon: ShoppingBag, label: 'Compras' },
    { to: '/logistica', icon: Truck, label: 'Logística' },
    { to: '/motoristas', icon: User, label: 'Motoristas' },
    { to: '/seguranca', icon: Shield, label: 'Segurança' },
    { to: '/operacao/inoculacao', icon: Beaker, label: 'Inoculação' },
    { to: '/operacao/frutificacao', icon: Sprout, label: 'Frutificação' },
    { to: '/treinamento', icon: GraduationCap, label: 'Treinamento' },
    { to: '/checklists', icon: ClipboardList, label: 'Checklists' },
    { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  ];

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (!mobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = () => {
      if (mediaQuery.matches) {
        setMobileSidebarOpen(false);
      }
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso!');
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const tipoUsuarioLabel = {
    admin: 'Administrador',
    producao: 'Produção',
    motorista: 'Motorista',
    vendas: 'Vendas',
    cliente: 'Cliente',
  } as const;

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-[#1A1A1A] text-white border-b border-[#2A2A2A]">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <MushroomIcon className="w-8 h-8 text-[#A88F52]" />
            <span className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
              Shroom Bros
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-md p-2 hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70"
            aria-label="Abrir menu principal"
            aria-expanded={mobileSidebarOpen}
            aria-controls="mobile-sidebar"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      <aside
        className={cn(
          'hidden lg:flex fixed top-0 left-0 bottom-0 z-40 bg-[#1A1A1A] text-white transition-[width] duration-300 motion-reduce:transition-none',
          sidebarCollapsed ? 'w-20' : 'w-64',
        )}
        aria-label="Menu lateral"
      >
        <SidebarNavigation
          navItems={navItems}
          collapsed={sidebarCollapsed}
          mobile={false}
          usuarioNome={usuario?.nome}
          usuarioTipo={usuario?.tipo_usuario}
          tipoUsuarioLabel={tipoUsuarioLabel as Record<string, string>}
          onNavigate={() => setMobileSidebarOpen(false)}
          onLogout={() => {
            void handleLogout();
          }}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        />
      </aside>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none lg:hidden',
          mobileSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        <button
          type="button"
          className="w-full h-full"
          aria-label="Fechar menu"
          onClick={() => setMobileSidebarOpen(false)}
        />
      </div>

      <aside
        id="mobile-sidebar"
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-[min(85vw,320px)] bg-[#1A1A1A] text-white transition-transform duration-300 motion-reduce:transition-none lg:hidden',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <SidebarNavigation
          navItems={navItems}
          collapsed={false}
          mobile
          usuarioNome={usuario?.nome}
          usuarioTipo={usuario?.tipo_usuario}
          tipoUsuarioLabel={tipoUsuarioLabel as Record<string, string>}
          onNavigate={() => setMobileSidebarOpen(false)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onLogout={() => {
            setMobileSidebarOpen(false);
            void handleLogout();
          }}
        />
      </aside>

      <main
        className={cn(
          'min-h-screen pt-16 lg:pt-0 transition-[margin-left] duration-300 motion-reduce:transition-none',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64',
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
