import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Link, usePage, Head } from '@inertiajs/react';
import {
  FiMenu, FiX, FiUsers, FiBox, FiTrendingUp, FiFileText, FiBarChart2,
  FiChevronDown, FiLogOut, FiSettings, FiAlertTriangle
} from 'react-icons/fi';
import FlashToaster from '@/Components/FlashToaster';
import BaseModal from '@/Components/BaseModal';

/* --------- Definiciones de navegación --------- */
const LINK_DEFS = {
  dashboard: { key: 'dashboard', name: 'Dashboard', icon: FiBox },
  usuarios:  { key: 'usuarios',  name: 'Usuarios',  icon: FiUsers },
  compras:   { key: 'compras',   name: 'Compras',   icon: FiTrendingUp },
  etiquetas: { key: 'etiquetas', name: 'Etiquetas', icon: FiFileText },
  ventas:    { key: 'ventas',    name: 'Ventas',    icon: FiTrendingUp },
  notas:     { key: 'notas',     name: 'Notas de crédito', icon: FiFileText },
  reportes:  { key: 'reportes',  name: 'Reporte Ventas',  icon: FiBarChart2 },
  rproductos: { key: 'productos', name: 'Reporte Productos', icon: FiBox },
  productos: { key: 'productos', name: 'Productos', icon: FiBox },

  // productos: { key: 'productos', name: 'Productos', icon: FiBox },
  // notas:     { key: 'notas',     name: 'Notas de crédito', icon: FiFileText },
  // reportes:  { key: 'reportes',  name: 'Reportes',  icon: FiBarChart2 },
};

const ADMIN_ROUTE_MAP = {
  dashboard: 'admin.dashboard.index',
  usuarios:  'admin.usuarios.index',
  compras:   'admin.compras.index',
  etiquetas: 'admin.etiquetas.index',
  ventas:    'admin.ventas.index',
  notas:     'admin.notas_credito.facturas',
  reportes:  'admin.reportes.index',
  rproductos: 'admin.reportes.productos.index',

};

const VENTAS_ROUTE_MAP = {
  dashboard: 'ventas.dashboard.index',
  ventas:   'ventas.ventas.index',
  productos: 'ventas.productos.index',
  reportes: 'ventas.reportes.index',
};

const PERMISSIONS = {
  Administrador: Object.keys(ADMIN_ROUTE_MAP),
  Ventas:        Object.keys(VENTAS_ROUTE_MAP),
};

/* --------- Helpers --------- */
const safeHref = (routeName, params = {}, fallback = '#') => {
  try {
    if (typeof route === 'function') return route(routeName, params);
  } catch (_) {}
  return fallback;
};

function useIsActive() {
  const { url } = usePage();
  return (routeName) => {
    try {
      if (typeof route === 'function' && route().current) return route().current(routeName);
      if (typeof route === 'function') {
        const href = route(routeName);
        const path = new URL(href, window.location.origin).pathname;
        return url.startsWith(path);
      }
    } catch {}
    return false;
  };
}

function useLinksForRole(role) {
  return useMemo(() => {
    const allowed = PERMISSIONS[role] ?? [];
    const map = role === 'Ventas' ? VENTAS_ROUTE_MAP : ADMIN_ROUTE_MAP;
    return allowed
      .map((k) => {
        const def = LINK_DEFS[k];
        const routeName = map[k];
        if (!def || !routeName) return null;
        return { ...def, routeName };
      })
      .filter(Boolean);
  }, [role]);
}

/* --------- User Menu (dropdown) --------- */
function UserMenu({ user, role }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const onClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  // Rutas del menú
  const empresaHref = safeHref('admin.empresa.index', {}, '/admin/empresa');
  const logoutHref  = safeHref('logout', {}, '/logout');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open ? 'true' : 'false'}
      >
        <div className="w-7 h-7 rounded-full ring-1 ring-slate-200 bg-white flex items-center justify-center">
          <span className="w-6 h-6 rounded-full bg-secondary-500 text-white text-xs font-semibold grid place-items-center">
            {(user?.name?.[0] || 'U').toUpperCase()}
          </span>
        </div>
        <FiChevronDown className="w-4 h-4 text-slate-500" />
      </button>

      {/* Dropdown */}
      <div
        className={[
          'absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-50',
          open ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 -translate-y-1',
          'transition-all',
        ].join(' ')}
        role="menu"
      >
        <div className="px-3 pt-2 pb-1">
          <div className="text-sm font-medium text-slate-900 truncate">{user?.name ?? 'Usuario'}</div>
          <div className="text-xs text-slate-500">{role || '—'}</div>
        </div>
        <div className="my-1 h-px bg-slate-100" />

        {/* Para Administrador: Empresa + Logout */}
        {role === 'Administrador' && (
          <>
            <Link
              href={empresaHref}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              role="menuitem"
            >
              <FiSettings className="w-4 h-4 text-slate-500" />
              Empresa
            </Link>
            <Link
              href={logoutHref}
              method="post"
              as="button"
              className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
              role="menuitem"
            >
              <FiLogOut className="w-4 h-4" />
              Cerrar sesión
            </Link>
          </>
        )}

        {/* Para Ventas: sólo Logout */}
        {role === 'Ventas' && (
          <Link
            href={logoutHref}
            method="post"
            as="button"
            className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50"
            role="menuitem"
          >
            <FiLogOut className="w-4 h-4" />
            Cerrar sesión
          </Link>
        )}
      </div>
    </div>
  );
}

/* --------- Sidebar IZQUIERDO: FIXED en desktop --------- */
function LeftSidebarDesktop({ role = '' }) {
  const links = useLinksForRole(role);
  const isActive = useIsActive();

  return (
    <aside
      className="
        hidden lg:block fixed left-0 top-[4.25rem] bottom-0 w-64
        bg-white border-r border-slate-200 overflow-y-auto
      "
    >
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary-600" />
          <div className="text-sm font-semibold text-slate-900">Menú</div>
        </div>
      </div>

      <nav className="px-2 pb-3">
        {links.length === 0 && (
          <div className="text-sm text-slate-500 px-2 py-3">Sin accesos para tu rol.</div>
        )}
        <ul className="space-y-1">
          {links.map(({ key, name, icon: Icon, routeName }) => {
            const active = isActive(routeName);
            return (
              <li key={key}>
                <Link
                  href={safeHref(routeName)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                    active
                      ? 'bg-primary-500 text-primary-100'
                      : 'text-slate-700 hover:bg-primary-200 hover:text-slate-900',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r',
                      active ? 'bg-primary-600' : 'bg-transparent group-hover:bg-slate-200',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'inline-flex items-center justify-center rounded-md p-1.5 ring-1',
                      active
                        ? 'ring-primary-200 text-primary-100 bg-white'
                        : 'ring-slate-200 text-slate-600 bg-white group-hover:text-slate-800',
                    ].join(' ')}
                  >
                    <Icon className= {active ? 'font-semibold text-primary-500 w-4 h-4' : 'font-medium'} />
                  </span>
                  <span className={active ? 'font-semibold' : 'font-medium'}>{name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto h-0.5 bg-primary-600/80" />
    </aside>
  );
}

/* --------- Sidebar IZQUIERDO: Drawer en móvil --------- */
function LeftSidebarDrawer({ role = '', open, onClose }) {
  const links = useLinksForRole(role);
  const isActive = useIsActive();

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside
        className={[
          'lg:hidden fixed top-0 left-0 h-full w-72 z-50 bg-white border-r border-slate-200',
          'transform transition-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          'flex flex-col',
        ].join(' ')}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Menú</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="Cerrar menú"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-2 py-3 overflow-y-auto">
          {links.length === 0 && (
            <div className="text-sm text-slate-500 px-2 py-3">Sin accesos para tu rol.</div>
          )}
          <ul className="space-y-1">
            {links.map(({ key, name, icon: Icon, routeName }) => {
              const active = isActive(routeName);
              return (
                <li key={key}>
                  <Link
                    href={safeHref(routeName)}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      active
                        ? 'bg-primary-50 text-primary-800'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r',
                        active ? 'bg-primary-600' : 'bg-transparent group-hover:bg-slate-200',
                      ].join(' ')}
                    />
                    <span
                      className={[
                        'inline-flex items-center justify-center rounded-md p-1.5 ring-1',
                        active
                          ? 'ring-primary-200 text-primary-700 bg-white'
                          : 'ring-slate-200 text-slate-600 bg-white group-hover:text-slate-800',
                      ].join(' ')}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className={active ? 'font-semibold' : 'font-medium'}>{name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}

/* --------- Layout principal --------- */
export default function AdminLayout({ children, title = 'Panel Administrativo' }) {
  const { props } = usePage();
  const user = props?.auth?.user || {};
  const role = user?.role || '';
  const allowedRoles = ['Administrador', 'Ventas'];
  const isAllowed = allowedRoles.includes(role);

  const [openLeft, setOpenLeft] = useState(false);
  const { url } = usePage();

  // Guard: Si falta configurar la empresa, mostrar modal (solo si es Admin y no está en la ruta de empresa)
  const mustSetupEmpresa = props?.guards?.mustSetupEmpresa ?? false;
  const isAdmin = props?.ability?.isAdmin ?? false;
  const isOnEmpresaPage = url.includes('/admin/empresa');
  const showSetupModal = mustSetupEmpresa && isAdmin && !isOnEmpresaPage;

  return (
    <div className="min-h-screen bg-neutral-50 text-slate-800 antialiased">
      <Head title={title} />

      {/* Topbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Botón abre drawer IZQUIERDO en móvil */}
            <button
              className="lg:hidden p-2 rounded-md hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              onClick={() => setOpenLeft(true)}
              aria-label="Abrir menú"
            >
              <FiMenu className="w-5 h-5" />
            </button>
            <h1 className="text-[15px] sm:text-base font-semibold text-slate-900">{title}</h1>
          </div>

          {/* Usuario + menú */}
          <div className="flex items-center gap-3">
            {/* Indicador de ambiente */}
            {props.empresa?.exists && (
              <div className="hidden sm:block">
                {props.empresa?.basic?.ambiente === 1 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse"></div>
                    MODO PRUEBAS
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse"></div>
                    MODO PRODUCCIÓN
                  </span>
                )}
              </div>
            )}

            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-slate-900">{user?.name ?? 'Usuario'}</div>
              <div className="text-xs text-slate-500">{role || '—'}</div>
            </div>
            <UserMenu user={user} role={role} />
          </div>
        </div>
        {/* Línea de marca */}
        <div className="h-0.5 bg-primary-600" />
      </header>

      {/* Flash toaster */}
      <FlashToaster timeout={4200} />

      {/* Sidebar fijo a la IZQ + contenido con padding-left para no superponerse */}
      <LeftSidebarDesktop role={role} />
      <LeftSidebarDrawer role={role} open={openLeft} onClose={() => setOpenLeft(false)} />

      {/* El padding-left reserva el espacio del sidebar fijo solo en desktop */}
      <div className="lg:pl-64">
        <main className="py-6">
          {!isAllowed ? (
            <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
              No tienes acceso a este panel.
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6">
              <div className="max-w-10xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="p-4 sm:p-6">{children}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Obligatorio: Configurar Empresa */}
      <BaseModal
        open={showSetupModal}
        onClose={() => {}} // No permitir cerrar sin configurar
        title="Configuración Requerida"
        maxWidth="md"
      >
        <div className="flex flex-col items-center text-center p-2">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
            <FiAlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-slate-700 font-medium text-lg mb-2">
            ¡Falta configurar tu empresa!
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Debes registrar los datos de tu empresa para poder trabajar con el sistema, realizar ventas y emitir facturas.
          </p>
          <Link
            href={safeHref('admin.empresa.index', {}, '/admin/empresa')}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
          >
            Configurar empresa ahora
          </Link>
        </div>
      </BaseModal>
    </div>
  );
}
