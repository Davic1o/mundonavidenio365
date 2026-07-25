import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import NavbarPublic from '@/Components/Nabvar';
import ApplicationLogo from '@/Components/ApplicationLogo';
import { 
  FiFileText, 
  FiDollarSign, 
  FiBarChart2, 
  FiShield, 
  FiChevronRight, 
  FiStar, 
  FiUsers, 
  FiTrendingUp, 
  FiCheck, 
  FiClock, 
  FiZap, 
  FiDatabase,
  FiSearch,
  FiBox,
  FiShoppingBag,
  FiTruck,
  FiAward
} from 'react-icons/fi';

export default function Landing() {
  const [docInput, setDocInput] = useState('');

  const handleSearchDoc = (e) => {
    e.preventDefault();
    const cleanDoc = docInput.replace(/\D+/g, '');
    if (cleanDoc) {
      router.get(typeof route === 'function' ? route('public.consulta') : '/consultar', { doc: cleanDoc });
    } else {
      router.get(typeof route === 'function' ? route('public.consulta') : '/consultar');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      <Head title="Mundo Navideño 365 — Sistema de Gestión Comercial y Facturación" />
      <NavbarPublic active="home" />

      {/* HERO SECTION — PARTE INICIAL PRINCIPAL */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-emerald-950/80 to-slate-900 pb-20 pt-10 lg:pb-32 lg:pt-16">
        {/* Glows y Luces Navideñas Corporativas de Fondo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-600/20 blur-[120px]" />
          <div className="absolute top-1/3 -right-40 h-[500px] w-[500px] rounded-full bg-amber-500/15 blur-[120px]" />
          <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full bg-red-600/15 blur-[120px]" />
          
          {/* Grilla sutil de fondo */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            
            {/* Columna Izquierda: Mensaje Principal + Buscador Rápido */}
            <div className="space-y-8 lg:col-span-7">
              
              {/* Badge Corporativo Festivo */}
              <div className="inline-flex items-center gap-2.5 rounded-full bg-slate-900/90 px-4 py-2 text-xs sm:text-sm font-bold text-amber-300 ring-1 ring-amber-400/40 shadow-lg shadow-emerald-950/50 backdrop-blur-md">
                <span className="flex h-2.5 w-2.5 items-center justify-center">
                  <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-400 opacity-75"></span>
                  <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                </span>
                <span>🎄 MUNDO NAVIDEÑO 365</span>
                <span className="text-emerald-400/60">•</span>
                <span className="text-slate-300 font-medium">Sistema Oficial de Gestión Comercial</span>
              </div>

              {/* Titulares Principales */}
              <div className="space-y-4">
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.15]">
                  Magia, Calidad y{' '}
                  <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm">
                    Gestión Eficiente
                  </span>
                </h1>

                <p className="text-lg text-slate-300 sm:text-xl font-normal leading-relaxed max-w-2xl">
                  Plataforma empresarial de <strong className="text-white font-semibold">Mundo Navideño</strong>. 
                  Administración integral de ventas mayoristas y minoristas, facturación electrónica autorizada por el 
                  <strong className="text-amber-300 font-semibold"> SRI</strong> y portal directo de consulta de comprobantes para nuestros clientes.
                </p>
              </div>

              {/* CAJA DE CONSULTA RÁPIDA EN EL HERO */}
              <div className="rounded-2xl bg-slate-900/90 p-5 ring-1 ring-emerald-500/30 shadow-2xl backdrop-blur-xl max-w-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <label htmlFor="hero-doc-input" className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <FiSearch className="h-4 w-4 text-amber-400" />
                    <span>Consulta tu Factura o Nota de Crédito</span>
                  </label>
                  <span className="text-[11px] font-semibold text-slate-400">SRI Autorizado</span>
                </div>

                <form onSubmit={handleSearchDoc} className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      id="hero-doc-input"
                      type="text"
                      value={docInput}
                      onChange={(e) => setDocInput(e.target.value)}
                      placeholder="Ingresa tu Cédula o RUC (ej. 1790000000001)"
                      className="w-full rounded-xl bg-slate-950/80 border border-slate-700/80 px-4 py-3.5 text-sm font-medium text-white placeholder-slate-500 shadow-inner focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 hover:from-emerald-500 hover:to-emerald-700 hover:shadow-emerald-900/60 active:scale-95 transition-all duration-200"
                  >
                    <span>Buscar Factura</span>
                    <FiChevronRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="mt-3 flex items-center gap-2 text-[12px] text-slate-400">
                  <FiCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Obtén tus comprobantes autorizados ingresando tu número de identificación sin guiones.</span>
                </div>
              </div>

              {/* CTAs alternativos */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href={typeof route === 'function' ? route('login') : '/login'}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-amber-500/10 hover:bg-amber-300 hover:shadow-amber-500/20 active:scale-95 transition-all"
                >
                  <FiZap className="h-4 w-4" />
                  <span>Acceder al Sistema Interno</span>
                </Link>
                
                <a
                  href="#caracteristicas"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-5 py-3.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                >
                  <span>Conocer Nuestros Servicios</span>
                </a>
              </div>

              {/* Indicadores de Confianza */}
              <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2">
                    <div className="h-8 w-8 rounded-full bg-emerald-600 ring-2 ring-slate-900 flex items-center justify-center font-bold text-xs text-white">MN</div>
                    <div className="h-8 w-8 rounded-full bg-amber-500 ring-2 ring-slate-900 flex items-center justify-center font-bold text-xs text-slate-950">365</div>
                    <div className="h-8 w-8 rounded-full bg-red-600 ring-2 ring-slate-900 flex items-center justify-center fill-current text-xs text-white">🎄</div>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">+10,000 Comprobantes Procesados</span>
                </div>

                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <FiStar key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="text-slate-300 ml-1">Atención 365 días al año</span>
                </div>
              </div>

            </div>

            {/* Columna Derecha: Tarjetas Interactivas de Mundo Navideño */}
            <div className="lg:col-span-5">
              <div className="relative">
                {/* Glow decorativo de fondo */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-600 via-amber-500 to-red-600 opacity-30 blur-xl"></div>
                
                <div className="relative rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl">
                  {/* Header de la tarjeta principal */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <ApplicationLogo className="h-10 w-10" />
                      <div>
                        <h2 className="text-sm font-bold text-white">Mundo Navideño 365</h2>
                        <p className="text-[11px] font-semibold text-emerald-400">Portal Corporativo Activo</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">
                      En línea
                    </span>
                  </div>

                  {/* Grid 2x2 de funcionalidades destacadas */}
                  <div className="mt-5 grid grid-cols-2 gap-3.5">
                    
                    {/* Card 1: Facturación */}
                    <div className="group rounded-2xl bg-gradient-to-br from-emerald-950/80 to-slate-950 p-4 border border-emerald-800/40 hover:border-emerald-500/60 transition-all duration-300">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-500/30">
                        <FiFileText className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Facturación SRI</h3>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">Emisión de facturas y notas de crédito al instante.</p>
                    </div>

                    {/* Card 2: Catálogo Navideño */}
                    <div className="group rounded-2xl bg-gradient-to-br from-amber-950/60 to-slate-950 p-4 border border-amber-800/40 hover:border-amber-500/60 transition-all duration-300">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30">
                        <FiShoppingBag className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Stock Navideño</h3>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">Control de inventario de árboles, luces y decoración.</p>
                    </div>

                    {/* Card 3: Consultas 24/7 */}
                    <div className="group rounded-2xl bg-gradient-to-br from-red-950/60 to-slate-950 p-4 border border-red-800/40 hover:border-red-500/60 transition-all duration-300">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-600/20 text-red-400 ring-1 ring-red-500/30">
                        <FiSearch className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Consulta 24/7</h3>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">Descarga de RIDE PDF y archivos XML.</p>
                    </div>

                    {/* Card 4: Cobertura y Despacho */}
                    <div className="group rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-950 p-4 border border-slate-700/60 hover:border-slate-500/60 transition-all duration-300">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                        <FiTruck className="h-5 w-5" />
                      </div>
                      <h3 className="text-sm font-bold text-white">Despachos</h3>
                      <p className="mt-1 text-[11px] text-slate-400 leading-tight">Ventas por mayor y menor con cobertura nacional.</p>
                    </div>

                  </div>

                  {/* Pie de tarjeta con sello de autenticidad */}
                  <div className="mt-5 rounded-xl bg-slate-950/80 p-3.5 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <FiShield className="h-4 w-4 text-emerald-400" />
                      <span className="font-semibold text-slate-300">Comprobantes 100% Válidos SRI</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">v3.65 Pro</span>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS Y SERVICIOS DE MUNDO NAVIDEÑO */}
      <section id="caracteristicas" className="py-20 bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400">Soluciones Integrales</h2>
            <p className="mt-2 text-3xl font-black text-white sm:text-4xl">
              Nuestros Servicios y Tecnología Comercial
            </p>
            <p className="mt-4 text-slate-400 text-base">
              Diseñado para responder a las exigencias de importación, distribución y venta de productos festivos en Ecuador.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            <ServiceCard
              icon={FiFileText}
              title="Facturación SRI"
              description="Emisión garantizada de facturas electrónicas, notas de crédito y retenciones autorizadas ante el SRI."
              accentColor="emerald"
            />
            <ServiceCard
              icon={FiDatabase}
              title="Control de Inventario"
              description="Monitoreo de stock de artículos navideños en tiempo real con alertas y categorización por colecciones."
              accentColor="amber"
            />
            <ServiceCard
              icon={FiSearch}
              title="Portal de Consulta"
              description="Tus clientes pueden consultar, visualizar y descargar sus comprobantes usando solo su RUC o Cédula."
              accentColor="red"
            />
            <ServiceCard
              icon={FiShield}
              title="Respaldo Empresarial"
              description="Plataforma segura con altos estándares de encriptación y alta disponibilidad los 365 días del año."
              accentColor="blue"
            />
          </div>
        </div>
      </section>

      {/* SECCIÓN SOBRE MUNDO NAVIDEÑO */}
      <section id="nosotros" className="py-20 bg-slate-950 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-400 ring-1 ring-emerald-800">
                <FiAward className="h-3.5 w-3.5" />
                <span>Trayectoria y Calidad</span>
              </div>

              <h2 className="text-3xl font-black text-white sm:text-4xl leading-tight">
                Impulsando la Magia Navideña con Innovación Tecnológica
              </h2>

              <p className="text-slate-300 leading-relaxed text-base">
                En <strong className="text-white">Mundo Navideño 365</strong> nos especializamos en llevar la magia de las festividades a hogares, locales comerciales e instituciones de todo el país. Nuestro sistema corporativo simplifica los procesos tributarios y la atención al cliente, ofreciendo transparencia y eficiencia en cada transacción.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <FeatureCheck text="Cumplimiento 100% normativa SRI" />
                <FeatureCheck text="Emisión ágil de facturas y notas de crédito" />
                <FeatureCheck text="Portal para clientes 24/7" />
                <FeatureCheck text="Soporte técnico continuo" />
              </div>

              <div className="pt-4 flex items-center gap-8">
                <div>
                  <div className="text-3xl font-black text-amber-400">100%</div>
                  <div className="text-xs font-semibold text-slate-400">Digital & Seguro</div>
                </div>
                <div className="h-10 w-px bg-slate-800"></div>
                <div>
                  <div className="text-3xl font-black text-emerald-400">365</div>
                  <div className="text-xs font-semibold text-slate-400">Días Operativos</div>
                </div>
              </div>
            </div>

            {/* Banner Decorativo */}
            <div className="relative rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-8 border border-slate-800 shadow-2xl">
              <div className="space-y-6">
                <div className="h-12 w-12 rounded-2xl bg-amber-400/10 flex items-center justify-center text-amber-400 ring-1 ring-amber-400/30">
                  <FiStar className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-white">Compromiso con Nuestros Clientes</h3>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Ofrecemos atención personalizada y herramientas tecnológicas sencillas para que la gestión de compras y la obtención de comprobantes tributarios sea rápida y sin inconvenientes.
                </p>
                <div className="rounded-xl bg-slate-950/80 p-4 border border-slate-800">
                  <p className="text-xs italic text-slate-400">
                    "Garantizamos rapidez, transparencia y seguridad en cada comprobante emitido por Mundo Navideño 365."
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-16 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-950 border-t border-emerald-900/40">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            ¿Necesitas consultar un comprobante de Mundo Navideño?
          </h2>
          <p className="mt-3 text-slate-300 text-base">
            Ingresa a nuestro módulo de autoconsulta con tu número de RUC o Cédula y obtén tu factura electrónica en formato PDF y XML.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={typeof route === 'function' ? route('public.consulta') : '/consultar'}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-7 py-3.5 text-sm font-bold text-slate-950 shadow-xl hover:bg-amber-300 transition-all"
            >
              <FiSearch className="h-4 w-4" />
              <span>Ir al Portal de Consultas</span>
            </Link>

            <Link
              href={typeof route === 'function' ? route('login') : '/login'}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-slate-800 transition-all"
            >
              <span>Acceso Administrativo</span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-3">
              <ApplicationLogo className="h-8 w-8" />
              <div>
                <div className="text-sm font-bold text-white">MUNDO NAVIDEÑO 365</div>
                <div className="text-xs text-slate-500">© {new Date().getFullYear()} — Todos los derechos reservados</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-semibold">
              <Link href={typeof route === 'function' ? route('public.landing') : '/'} className="hover:text-amber-300 transition-colors">
                Inicio
              </Link>
              <Link href={typeof route === 'function' ? route('public.consulta') : '/consultar'} className="hover:text-amber-300 transition-colors">
                Consulta de Facturas
              </Link>
              <Link href={typeof route === 'function' ? route('login') : '/login'} className="hover:text-amber-300 transition-colors">
                Ingreso al Sistema
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

{/* Componentes auxiliares de tarjeta y lista */}
function ServiceCard({ icon: Icon, title, description, accentColor }) {
  const accentClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  }[accentColor] || 'bg-slate-800 text-white border-slate-700';

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 shadow-xl">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border ${accentClasses}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCheck({ text }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        <FiCheck className="h-3 w-3" />
      </div>
      <span className="text-xs sm:text-sm font-medium text-slate-300">{text}</span>
    </div>
  );
}
