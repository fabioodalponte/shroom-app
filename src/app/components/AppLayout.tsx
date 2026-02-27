import { Outlet, NavLink, useNavigate } from 'react-router';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Scissors, 
  Box, 
  ShoppingCart, 
  ShoppingBag,
  Truck, 
  GraduationCap, 
  DollarSign, 
  User, 
  Menu, 
  X,
  LogOut,
  Shield,
  Bug,
  ClipboardList
} from 'lucide-react';
import { MushroomIcon } from '../../components/MushroomIcon';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { usuario, signOut } = useAuth();

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
    { to: '/treinamento', icon: GraduationCap, label: 'Treinamento' },
    { to: '/checklists', icon: ClipboardList, label: 'Checklists' },
    { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
  ];

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
    cliente: 'Cliente'
  } as const;

  return (
    <div className="min-h-screen bg-[#F8F6F2]">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#1A1A1A] text-white">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <MushroomIcon className="w-8 h-8 text-[#A88F52]" />
            <span className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
              Shroom Bros
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 w-64 bg-[#1A1A1A] text-white z-40
          transition-transform duration-300 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="hidden lg:flex items-center gap-3 p-6 border-b border-[#2A2A2A]">
          <MushroomIcon className="w-10 h-10 text-[#A88F52]" />
          <div>
            <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
              Shroom Bros
            </h1>
            <p className="text-xs text-[#A88F52]">Gestão de Produção</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 mt-16 lg:mt-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[#A88F52] text-white'
                      : 'text-[#E3E3E3] hover:bg-[#2A2A2A]'
                  }`
                }
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#2A2A2A]">
          <NavLink
            to="/debug"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[#2A2A2A] transition-colors mb-2 text-xs text-yellow-400"
          >
            <Bug size={16} />
            <span>Debug & Testes</span>
          </NavLink>
          <NavLink
            to="/perfil"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-[#2A2A2A] transition-colors mb-2"
          >
            <User size={20} />
            <div className="flex-1">
              <p className="text-sm">{usuario?.nome || 'Usuário'}</p>
              <p className="text-xs text-[#A88F52]">
                {usuario?.tipo_usuario ? tipoUsuarioLabel[usuario.tipo_usuario] : 'Sem perfil'}
              </p>
            </div>
          </NavLink>
          <button
            onClick={() => {
              void handleLogout();
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-900/20 text-red-400 transition-colors w-full"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <Outlet />
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
