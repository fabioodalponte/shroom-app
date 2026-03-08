import { NavLink } from 'react-router';
import { Bug, LogOut, PanelLeftClose, PanelLeftOpen, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MushroomIcon } from '../../components/MushroomIcon';
import { cn } from '../../components/ui/utils';

interface SidebarNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

interface SidebarNavigationProps {
  navItems: SidebarNavItem[];
  collapsed: boolean;
  mobile: boolean;
  usuarioNome?: string;
  usuarioTipo?: string;
  tipoUsuarioLabel: Record<string, string>;
  onNavigate: () => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
}

function renderLabel(label: string, collapsed: boolean) {
  return <span className={collapsed ? 'sr-only' : ''}>{label}</span>;
}

export function SidebarNavigation({
  navItems,
  collapsed,
  mobile,
  usuarioNome,
  usuarioTipo,
  tipoUsuarioLabel,
  onNavigate,
  onLogout,
  onToggleCollapse,
  onCloseMobile,
}: SidebarNavigationProps) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center border-b border-[#2A2A2A]',
          collapsed ? 'justify-center p-3' : 'justify-between p-5',
        )}
      >
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <MushroomIcon className="w-9 h-9 text-[#A88F52]" />
          {!collapsed && (
            <div>
              <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                Shroom Bros
              </h1>
              <p className="text-xs text-[#A88F52]">Gestão de Produção</p>
            </div>
          )}
        </div>

        {!mobile && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-2 text-[#E3E3E3] hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70"
            aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

        {mobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-md p-2 text-[#E3E3E3] hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-label={item.label}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  'group rounded-lg transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70',
                  collapsed
                    ? 'flex h-11 items-center justify-center px-2'
                    : 'flex h-11 items-center gap-3 px-4',
                  isActive
                    ? 'bg-[#A88F52] text-white shadow-sm'
                    : 'text-[#E3E3E3] hover:bg-[#2A2A2A] hover:text-white',
                )
              }
            >
              <Icon size={20} />
              {!collapsed && <span>{item.label}</span>}
              {collapsed && renderLabel(item.label, true)}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[#2A2A2A] p-3 space-y-2">
        <NavLink
          to="/debug"
          onClick={onNavigate}
          aria-label="Debug e testes"
          title={collapsed ? 'Debug & Testes' : undefined}
          className={cn(
            'rounded-lg transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70',
            collapsed
              ? 'flex h-10 items-center justify-center px-2 text-yellow-400 hover:bg-[#2A2A2A]'
              : 'flex items-center gap-3 px-4 py-2 text-xs text-yellow-400 hover:bg-[#2A2A2A]',
          )}
        >
          <Bug size={16} />
          {!collapsed && <span>Debug & Testes</span>}
          {collapsed && <span className="sr-only">Debug & Testes</span>}
        </NavLink>

        <NavLink
          to="/perfil"
          onClick={onNavigate}
          aria-label="Perfil do usuário"
          title={collapsed ? 'Perfil' : undefined}
          className={cn(
            'rounded-lg transition-colors motion-reduce:transition-none hover:bg-[#2A2A2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A88F52]/70',
            collapsed
              ? 'flex h-10 items-center justify-center px-2 text-[#E3E3E3]'
              : 'flex items-center gap-3 px-4 py-3 text-[#E3E3E3]',
          )}
        >
          <User size={20} />
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm truncate">{usuarioNome || 'Usuário'}</p>
              <p className="text-xs text-[#A88F52] truncate">
                {tipoUsuarioLabel[usuarioTipo || ''] || 'Sem perfil'}
              </p>
            </div>
          )}
          {collapsed && <span className="sr-only">Perfil</span>}
        </NavLink>

        <button
          type="button"
          onClick={onLogout}
          aria-label="Sair"
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'w-full rounded-lg transition-colors motion-reduce:transition-none hover:bg-red-900/20 text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60',
            collapsed
              ? 'flex h-10 items-center justify-center px-2'
              : 'flex items-center gap-3 px-4 py-3',
          )}
        >
          <LogOut size={20} />
          {!collapsed && <span>Sair</span>}
          {collapsed && <span className="sr-only">Sair</span>}
        </button>
      </div>
    </div>
  );
}
