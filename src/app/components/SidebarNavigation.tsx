import { NavLink } from 'react-router';
import { Bug, LogOut, PanelLeftClose, PanelLeftOpen, User, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MushroomIcon } from '../../components/MushroomIcon';
import { cn } from '../../components/ui/utils';

export type SidebarSectionKey = 'principal' | 'operacoes' | 'laboratorio' | 'administracao';

export interface SidebarNavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  section?: SidebarSectionKey;
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

const sectionOrder: Array<{ key: SidebarSectionKey; label?: string }> = [
  { key: 'principal' },
  { key: 'operacoes', label: 'Operações' },
  { key: 'laboratorio', label: 'Laboratório' },
  { key: 'administracao', label: 'Administração' },
];

function getSections(navItems: SidebarNavItem[]) {
  return sectionOrder
    .map((section) => ({
      ...section,
      items: navItems.filter((item) => (item.section || 'principal') === section.key),
    }))
    .filter((section) => section.items.length > 0);
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="lab-sidebar__brand-mark">
        <MushroomIcon className="size-6" />
      </div>
    );
  }

  return (
    <div className="lab-sidebar__brand">
      <h1 className="lab-sidebar__brand-title">Micélio Lab</h1>
      <p className="lab-sidebar__brand-subtitle">
        Laboratório Vivo
      </p>
    </div>
  );
}

function SidebarNavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: SidebarNavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'lab-sidebar__link',
          collapsed && 'is-collapsed',
          isActive && 'is-active',
        )
      }
    >
      {() => (
        <>
          <Icon size={18} className="shrink-0" />
          {!collapsed ? <span className="truncate font-medium">{item.label}</span> : null}
          {collapsed ? <span className="sr-only">{item.label}</span> : null}
        </>
      )}
    </NavLink>
  );
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
  const sections = getSections(navItems);

  return (
    <div className={cn('lab-sidebar', collapsed && 'is-collapsed', mobile && 'is-mobile')}>
      <div className="lab-sidebar__header">
        <div className={cn('flex items-start', collapsed ? 'justify-center w-full' : 'justify-between gap-3 w-full')}>
          <SidebarBrand collapsed={collapsed} />

          {!mobile && onToggleCollapse ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="lab-sidebar__control"
              aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          ) : null}

          {mobile && onCloseMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lab-sidebar__control"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Navegação principal" className="lab-sidebar__nav">
        {sections.map((section) => (
          <div key={section.key} className="lab-sidebar__section">
            {section.label && !collapsed ? (
              <div className="lab-sidebar__section-title">{section.label}</div>
            ) : null}

            {section.items.map((item) => (
              <SidebarNavLink
                key={item.to}
                item={item}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="lab-sidebar__footer">
        <div className={cn('space-y-2', collapsed && 'flex flex-col items-center')}>
          <NavLink
            to="/debug"
            onClick={onNavigate}
            aria-label="Debug e testes"
            title={collapsed ? 'Debug & Testes' : undefined}
            className={cn(
              'lab-sidebar__utility',
              collapsed && 'is-collapsed',
            )}
          >
            <Bug size={18} />
            {!collapsed ? <span className="font-medium">Debug & Testes</span> : null}
            {collapsed ? <span className="sr-only">Debug & Testes</span> : null}
          </NavLink>

          <NavLink
            to="/perfil"
            onClick={onNavigate}
            aria-label="Perfil do usuário"
            title={collapsed ? 'Perfil' : undefined}
            className={cn(
              'lab-sidebar__profile',
              collapsed && 'is-collapsed',
            )}
          >
            <div className="lab-sidebar__avatar">
              <User size={15} />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="lab-sidebar__user-name truncate">{usuarioNome || 'Usuário'}</p>
                <p className="lab-sidebar__user-role truncate">{tipoUsuarioLabel[usuarioTipo || ''] || 'Sem perfil'}</p>
              </div>
            ) : null}
            {collapsed ? <span className="sr-only">Perfil</span> : null}
          </NavLink>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'lab-sidebar__logout',
              collapsed && 'is-collapsed',
            )}
          >
            <LogOut size={18} />
            {!collapsed ? <span className="font-medium">Sair</span> : null}
            {collapsed ? <span className="sr-only">Sair</span> : null}
          </button>
        </div>
      </div>
    </div>
  );
}
