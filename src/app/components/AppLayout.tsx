import { Outlet, useLocation, useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Beaker,
  Bell,
  Box,
  Building2,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Menu,
  Package,
  Search,
  ScanSearch,
  Scissors,
  Settings2,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  Truck,
  User,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../components/ui/utils';
import { SidebarNavigation } from './SidebarNavigation';
import type { SidebarNavItem } from './SidebarNavigation';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'shroom.sidebar.collapsed';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, signOut } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1023px)').matches;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;

    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (stored !== null) return stored === '1';

    return window.matchMedia('(max-width: 1280px)').matches;
  });

  const navItems: SidebarNavItem[] = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', section: 'principal' },
    { to: '/lotes', icon: Package, label: 'Lotes', section: 'principal' },
    { to: '/colheita', icon: Scissors, label: 'Colheita', section: 'principal' },
    { to: '/estoque', icon: Box, label: 'Estoque', section: 'principal' },
    { to: '/vendas', icon: ShoppingCart, label: 'Vendas', section: 'principal' },
    { to: '/compras', icon: ShoppingBag, label: 'Compras', section: 'operacoes' },
    { to: '/logistica', icon: Truck, label: 'Logística', section: 'operacoes' },
    { to: '/motoristas', icon: User, label: 'Motoristas', section: 'operacoes' },
    { to: '/seguranca', icon: Shield, label: 'Segurança', section: 'operacoes' },
    { to: '/vision', icon: ScanSearch, label: 'Vision', section: 'operacoes' },
    { to: '/operacao/inoculacao', icon: Beaker, label: 'Inoculação', section: 'laboratorio' },
    { to: '/operacao/frutificacao', icon: Sprout, label: 'Frutificação', section: 'laboratorio' },
    { to: '/treinamento', icon: GraduationCap, label: 'Treinamento', section: 'laboratorio' },
    { to: '/checklists', icon: ClipboardList, label: 'Checklists', section: 'laboratorio' },
    { to: '/financeiro', icon: DollarSign, label: 'Financeiro', section: 'administracao' },
  ];

  if (usuario?.tipo_usuario === 'admin') {
    navItems.push({ to: '/catalogo-cogumelos', icon: FileText, label: 'Catálogo', section: 'administracao' });
    navItems.push({ to: '/salas', icon: Building2, label: 'Salas', section: 'administracao' });
  }

  const pageTitle = useMemo(() => {
    const pathname = location.pathname;

    if (/^\/lotes\/[^/]+/.test(pathname)) return 'Detalhes do Lote';
    if (pathname.startsWith('/dashboard')) return 'Dashboard';
    if (pathname.startsWith('/lotes')) return 'Lotes';
    if (pathname.startsWith('/colheita')) return 'Colheita';
    if (pathname.startsWith('/estoque')) return 'Estoque';
    if (pathname.startsWith('/vendas')) return 'Vendas';
    if (pathname.startsWith('/compras')) return 'Compras';
    if (pathname.startsWith('/logistica')) return 'Logística';
    if (pathname.startsWith('/motoristas')) return 'Motoristas';
    if (pathname.startsWith('/seguranca')) return 'Segurança';
    if (pathname.startsWith('/vision')) return 'Vision';
    if (pathname.startsWith('/operacao/inoculacao')) return 'Inoculação';
    if (pathname.startsWith('/operacao/frutificacao')) return 'Frutificação';
    if (pathname.startsWith('/treinamento')) return 'Treinamento';
    if (pathname.startsWith('/checklists')) return 'Checklists';
    if (pathname.startsWith('/financeiro')) return 'Financeiro';
    if (pathname.startsWith('/catalogo-cogumelos')) return 'Catálogo';
    if (pathname.startsWith('/salas')) return 'Salas';
    if (pathname.startsWith('/perfil')) return 'Perfil';
    if (pathname.startsWith('/debug')) return 'Debug & Testes';

    return 'Micélio Lab';
  }, [location.pathname]);

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
    const mediaQuery = window.matchMedia('(max-width: 1023px)');

    const handleChange = () => {
      const mobile = mediaQuery.matches;
      setIsMobileViewport(mobile);
      if (!mobile) {
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
    <div className={cn('lab-shell', sidebarCollapsed && 'is-collapsed')}>
      <header className="lab-mobile-header">
        <div>
          <p className="lab-mobile-header__brand-title">Micélio Lab</p>
          <p className="lab-mobile-header__brand-subtitle">Laboratório Vivo</p>
        </div>

        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="lab-mobile-header__menu"
          aria-label="Abrir menu principal"
          aria-expanded={mobileSidebarOpen}
          aria-controls="mobile-sidebar"
        >
          <Menu size={20} />
        </button>
      </header>

      <header className="lab-topbar">
        <div className="lab-topbar__group">
          <div className="min-w-0">
            <p className="lab-topbar__title">{pageTitle}</p>
          </div>

          <label className="lab-topbar__search">
            <Search size={18} />
            <input type="search" placeholder="Buscar em laboratório..." />
          </label>
        </div>

        <div className="lab-topbar__actions">
          {[Bell, Settings2, HelpCircle].map((Icon, index) => (
            <button
              key={`${Icon.displayName || Icon.name}-${index}`}
              type="button"
              className="lab-topbar__icon"
              aria-label={index === 0 ? 'Notificações' : index === 1 ? 'Configurações' : 'Ajuda'}
            >
              <Icon size={19} />
            </button>
          ))}

          <div className="lab-topbar__divider" />

          <button
            type="button"
            onClick={() => navigate('/perfil')}
            className="lab-topbar__avatar"
            aria-label="Abrir perfil"
          >
            <span>{usuario?.nome?.trim()?.charAt(0)?.toUpperCase() || 'U'}</span>
          </button>
        </div>
      </header>

      <aside
        className="lab-shell__sidebar hidden lg:flex"
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

      {isMobileViewport && mobileSidebarOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden">
            <button
              type="button"
              className="h-full w-full"
              aria-label="Fechar menu"
              onClick={() => setMobileSidebarOpen(false)}
            />
          </div>

          <aside
            id="mobile-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="lab-mobile-sidebar lg:hidden"
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
        </>
      ) : null}

      <main
        className="lab-shell__content"
      >
        <Outlet />
      </main>
    </div>
  );
}
