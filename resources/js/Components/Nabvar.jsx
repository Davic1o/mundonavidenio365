import React, { useState } from 'react';
import { Link } from '@inertiajs/react';
import { FiMenu, FiX, FiLogIn, FiSearch, FiFileText, FiStar, FiChevronRight } from 'react-icons/fi';
import ApplicationLogo from '@/Components/ApplicationLogo';

export default function NavbarPublic({ active = 'home' }) {
  const [open, setOpen] = useState(false);

  const hrefHome = typeof route === 'function' ? route('public.landing') : '/';
  const hrefConsulta = typeof route === 'function' ? route('public.consulta') : '/consultar';
  const hrefLogin = typeof route === 'function' ? route('login') : '/login';

  const itemCls = (key) =>
    [
      'px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5',
      active === key
        ? 'bg-emerald-900/90 text-amber-300 shadow-md ring-1 ring-amber-400/40'
        : 'text-slate-700 hover:text-emerald-950 hover:bg-emerald-50/80',
    ].join(' ');

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-900/10 bg-white/90 backdrop-blur-md shadow-sm">
      {/* Banner superior corporativo */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-amber-300 py-1.5 px-4 text-xs font-medium border-b border-amber-500/20">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block animate-pulse">🎄</span>
            <span className="font-semibold tracking-wide text-amber-200">Mundo Navideño 365</span>
            <span className="hidden sm:inline text-emerald-300/60">•</span>
            <span className="hidden sm:inline text-emerald-200/80">Plataforma Empresarial y Facturación SRI</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link 
              href={hrefConsulta} 
              className="flex items-center gap-1 text-amber-300 hover:text-amber-200 transition-colors font-semibold"
            >
              <FiSearch className="h-3 w-3" />
              <span>Consulta rápida de facturas</span>
              <FiChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand Logo & Name */}
        <Link href={hrefHome} className="group flex items-center gap-3 transition-transform hover:scale-[1.01]">
          <div className="relative">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-amber-400 to-emerald-600 opacity-30 blur group-hover:opacity-60 transition duration-300"></div>
            <ApplicationLogo className="relative h-11 w-11 drop-shadow-md" />
          </div>
          <div className="leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-950 transition-colors">
                MUNDO NAVIDEÑO
              </span>
              <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-500/30">
                365
              </span>
            </div>
            <div className="mt-1 text-[11px] font-semibold text-emerald-700 tracking-wide uppercase">
              Sistema Comercial & Facturación
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-1 lg:flex">
          <Link href={hrefHome} className={itemCls('home')}>
            Inicio
          </Link>

          <Link href={hrefConsulta} className={itemCls('consulta')}>
            <FiFileText className="h-4 w-4 text-emerald-600" />
            Consultar Facturas
          </Link>

          <a href="#caracteristicas" className={itemCls('caracteristicas')}>
            Servicios & Soluciones
          </a>

          <a href="#nosotros" className={itemCls('nosotros')}>
            Empresa
          </a>
        </nav>

        {/* CTA Login Button */}
        <div className="hidden lg:flex items-center gap-3">
          <Link
            href={hrefLogin}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-950/20 ring-1 ring-amber-400/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-900/30 hover:scale-[1.02] active:scale-95"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            <FiLogIn className="h-4 w-4 text-amber-300 transition-transform duration-300 group-hover:translate-x-0.5" />
            <span>Ingresar al Sistema</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(true)}
          className="lg:hidden rounded-xl p-2.5 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900 transition-colors ring-1 ring-slate-200"
          aria-label="Abrir menú"
        >
          <FiMenu className="h-6 w-6" />
        </button>
      </div>

      {/* Backdrop overlay for Mobile Drawer */}
      <div
        className={`fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Mobile Drawer */}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-80 max-w-[85vw] bg-white border-l border-emerald-100 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <ApplicationLogo className="h-8 w-8" />
            <div>
              <div className="text-sm font-bold text-white">MUNDO NAVIDEÑO 365</div>
              <div className="text-[10px] text-amber-300">Gestión Empresarial</div>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Cerrar menú"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <nav className="p-4 space-y-2 flex-1">
          <Link
            href={hrefHome}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 transition-colors"
          >
            <span>Inicio</span>
            <FiChevronRight className="h-4 w-4 text-slate-400" />
          </Link>

          <Link
            href={hrefConsulta}
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-emerald-900 bg-emerald-50/80 ring-1 ring-emerald-200/60"
          >
            <span className="flex items-center gap-2">
              <FiFileText className="h-4 w-4 text-emerald-700" />
              Consultar Facturas
            </span>
            <FiChevronRight className="h-4 w-4 text-emerald-700" />
          </Link>

          <a
            href="#caracteristicas"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>Servicios & Soluciones</span>
            <FiChevronRight className="h-4 w-4 text-slate-400" />
          </a>

          <a
            href="#nosotros"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span>Nuestra Empresa</span>
            <FiChevronRight className="h-4 w-4 text-slate-400" />
          </a>
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <Link
            href={hrefLogin}
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 px-4 py-3 text-sm font-bold text-amber-300 shadow-md ring-1 ring-amber-400/30"
          >
            <FiLogIn className="h-4 w-4" />
            <span>Ingresar al Sistema</span>
          </Link>
        </div>
      </aside>
    </header>
  );
}
