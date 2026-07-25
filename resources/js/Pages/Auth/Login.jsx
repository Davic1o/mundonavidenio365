import React, { useEffect, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import NavbarPublic from '@/Components/Nabvar';
import { FiMail, FiLock, FiLogIn } from 'react-icons/fi';

export default function Login({ status, canResetPassword }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    email: '',
    password: '',
    remember: false,
  });

  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => () => reset('password'), []); // limpia el pass al salir

  const submit = (e) => {
    e.preventDefault();
    post(route('login'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      <Head title="Ingresar" />
      {/* No queremos resaltar 'Inicio' ni 'Consultas' aquí */}
      <NavbarPublic active={null} />

      <main className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {/* Panel marca/beneficios */}
          <section className="order-2 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:order-1">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-700 text-white font-bold">
                SF
              </div>
              <div className="leading-tight">
                <h2 className="text-base font-semibold text-emerald-900">Sistema de Facturación</h2>
                <p className="text-xs text-emerald-600">Gestión empresarial</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <p className="text-slate-600">
                Bienvenido al panel. Gestiona ventas, clientes y productos con una interfaz moderna y ágil.
              </p>
              <ul className="grid gap-2">
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">✔ Flujo guiado de ventas</li>
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">✔ Reportes claros y rápidos</li>
                <li className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  ✔ Estilo consistente (emerald/rose)
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">Accesos rápidos</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={typeof route === 'function' ? route('public.landing') : '/'}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Ir al inicio público
                </Link>
                <Link
                  href={typeof route === 'function' ? route('public.consulta') : '/consulta'}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                >
                  Consultas clientes
                </Link>
              </div>
            </div>
          </section>

          {/* Panel login */}
          <section className="order-1 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:order-2">
            <h1 className="text-lg font-semibold text-emerald-900">Ingresar</h1>
            <p className="mt-1 text-sm text-slate-600">Usa tus credenciales para acceder al panel.</p>

            {/* Status (por ejemplo, link enviado) */}
            {status && (
              <div
                className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                role="status"
                aria-live="polite"
              >
                {status}
              </div>
            )}

            <form onSubmit={submit} className="mt-5 space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Correo electrónico
                </label>
                <div className="relative">
                  <FiMail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    autoComplete="username email"
                    className={[
                      'w-full rounded-lg border px-10 py-2 text-sm',
                      errors.email ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                                   : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500',
                    ].join(' ')}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1 text-xs text-rose-600">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    name="password"
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    autoComplete="current-password"
                    className={[
                      'w-full rounded-lg border px-10 py-2 pr-24 text-sm',
                      errors.password ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500'
                                      : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500',
                    ].join(' ')}
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                    tabIndex={-1}
                  >
                    {showPwd ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {errors.password && (
                  <p id="password-error" className="mt-1 text-xs text-rose-600">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* Remember + Forgot */}
              <div className="flex items-center justify-between">
                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={data.remember}
                    onChange={(e) => setData('remember', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Recordarme
                </label>

                {canResetPassword && (
                  <Link
                    href={route('password.request')}
                    className="text-sm text-emerald-700 hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={processing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-emerald-700/20 hover:bg-emerald-800 disabled:opacity-60"
                >
                  {processing ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  ) : (
                    <FiLogIn className="h-4 w-4" />
                  )}
                  Ingresar
                </button>
              </div>
            </form>

            {/* Línea secundaria */}
            <div className="mt-6 text-center text-xs text-slate-500">
              ¿Aún no tienes acceso? Contacta al administrador del sistema.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
