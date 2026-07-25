import React, { useEffect, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiPlus, FiEdit2, FiRefreshCw, FiEye, FiCreditCard, FiTrash2 } from 'react-icons/fi';

/* Helpers paginator */
const getData = (p) => (Array.isArray(p) ? p : (p?.data ?? []));
const getLinks = (p) => p?.links ?? null;

function Pagination({ page }) {
  const links = getLinks(page);
  if (!links) return null;
  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {links.map((l, i) => {
        const label = l.label
          .replace('&laquo; Previous', '«')
          .replace('Next &raquo;', '»')
          .replace(/&laquo;|&raquo;/g, (m) => (m === '&laquo;' ? '«' : '»'));
        return l.url ? (
          <Link
            key={i}
            href={l.url}
            preserveScroll
            preserveState
            className={[
              'px-3 py-1.5 rounded-md border text-sm',
              l.active
                ? 'border-primary-600 text-primary-700 bg-primary-50'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700',
            ].join(' ')}
          >
            <span dangerouslySetInnerHTML={{ __html: label }} />
          </Link>
        ) : (
          <span
            key={i}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-400"
            dangerouslySetInnerHTML={{ __html: label }}
          />
        );
      })}
    </nav>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function money(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/** Normaliza el estado para comparaciones robustas */
function normalizeEstado(s) {
  return String(s ?? '').toLowerCase().trim();
}

function BadgeEstado({ estado }) {
  const map = {
    creada: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    emitida: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    firmada: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    AUTORIZADO: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    anulada: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  const cls = map[normalizeEstado(estado)] || map.creada;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {String(estado || 'creada').toUpperCase()}
    </span>
  );
}

export default function Index({ ventas, filtros }) {
  const dataList = getData(ventas);

  const [q, setQ] = useState({
    q: filtros?.q ?? '',
    estado: filtros?.estado ?? '',
    fecha_desde: filtros?.fecha_desde ?? '',
    fecha_hasta: filtros?.fecha_hasta ?? '',
  });

  useEffect(() => {
    const id = setTimeout(() => {
      router.get(route('ventas.ventas.index'), q, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [q.q, q.estado, q.fecha_desde, q.fecha_hasta]); // eslint-disable-line

  function clearFilters() {
    const empty = { q: '', estado: '', fecha_desde: '', fecha_hasta: '' };
    setQ(empty);
    router.get(route('ventas.ventas.index'), empty, {
      preserveState: true,
      replace: true,
      preserveScroll: true,
    });
  }

  // Acciones
  function nuevaVenta() {
    router.get(route('ventas.ventas.vista_cliente'));
  }

  /** Bloqueo duro dentro de los handlers */
  function irProductos(row) {
    if (normalizeEstado(row.estado) === 'AUTORIZADO') {
      // Opcional: mostrar toast/alerta
      // window.alert('Esta venta está AUTORIZADA. Solo lectura.');
      return;
    }
    router.get(route('ventas.ventas.vista_productos', row.id));
  }

  function irPagos(row) {
    if (normalizeEstado(row.estado) === 'AUTORIZADO') {
      // window.alert('Esta venta está AUTORIZADA. Solo lectura.');
      return;
    }
    router.get(route('ventas.ventas.vista_pagos', row.id));
  }

  return (
    <AdminLayout title="Ventas">
      <Head title="Ventas" />

      {/* Handlers de eliminación */}
      {(() => {
        window.confirmEliminar = (id) => {
          if (confirm('¿Estás seguro de que deseas eliminar esta venta borrador? Esta acción no se puede deshacer.')) {
            router.delete(route('ventas.ventas.destroy', id), {
              preserveScroll: true,
            });
          }
        };
      })()}

      {/* Botón crear */}
      <div className="mb-3 flex items-center justify-end">
        <button
          onClick={nuevaVenta}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <FiPlus className="w-4 h-4" /> Nueva venta
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cliente (nombre o CI/RUC)
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.q}
                  onChange={(e) => setQ((s) => ({ ...s, q: e.target.value }))}
                  placeholder="Ej. Juan, 1712..."
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
              <select
                value={q.estado}
                onChange={(e) => setQ((s) => ({ ...s, estado: e.target.value }))}
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Todos</option>
                <option value="creada">Creada</option>
                <option value="emitida">Emitida</option>
                <option value="firmada">Firmada</option>
                <option value="autorizada">Autorizada</option>
                <option value="anulada">Anulada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Desde</label>
              <input
                type="date"
                value={q.fecha_desde}
                onChange={(e) => setQ((s) => ({ ...s, fecha_desde: e.target.value }))}
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Hasta</label>
              <input
                type="date"
                value={q.fecha_hasta}
                onChange={(e) => setQ((s) => ({ ...s, fecha_hasta: e.target.value }))}
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <FiRefreshCw className="w-4 h-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Subtotal</th>
                <th>IVA 15%</th>
                <th>Total</th>
                <th className="w-1">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataList.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No hay ventas que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {dataList.map((row) => {
                const estadoNorm = normalizeEstado(row.estado);
                console.log({ estadoNorm });
                const puedeIrAPagos = Number(row.total || 0) > 0;
                const esAutorizada = estadoNorm === 'autorizado';
                const esAnulada = estadoNorm === 'anulada';
                const esEditable = !esAutorizada && !esAnulada;

                return (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{fmtDate(row.fecha)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={route('ventas.ventas.show', row.id)}
                        className="text-primary-700 hover:underline"
                        title="Ver detalle"
                      >
                        {row.cliente_nombres || '—'}
                      </Link>
                      {row.cliente_ci_o_ruc ? (
                        <span className="text-slate-500"> — [{row.cliente_ci_o_ruc}]</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <BadgeEstado estado={row.estado} />
                    </td>
                    <td className="px-4 py-3">{money(row.subtotal)}</td>
                    <td className="px-4 py-3">{money(row.impuesto_15)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{money(row.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={route('ventas.ventas.show', row.id)}
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-slate-200 text-slate-700 hover:bg-slate-50"
                          title="Ver"
                        >
                          <FiEye className="w-4 h-4" /> Ver
                        </Link>

                        {/* Productos */}
                        {esEditable ? (
                          <button
                            onClick={() => irProductos(row)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700"
                            title="Productos"
                          >
                            <FiEdit2 className="w-4 h-4" /> Productos
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-disabled
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                            title={esAutorizada ? 'Venta autorizada: solo lectura' : 'Venta anulada'}
                            onClick={(e) => e.preventDefault()}
                          >
                            <FiEdit2 className="w-4 h-4" /> Productos
                          </button>
                        )}

                        {/* Pagos */}
                        {esEditable ? (
                          <button
                            onClick={() => irPagos(row)}
                            disabled={!puedeIrAPagos}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
                            title="Pagos"
                          >
                            <FiCreditCard className="w-4 h-4" /> Pagos
                          </button>
                        ) : (
                          <button
                            type="button"
                            aria-disabled
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
                            title={esAutorizada ? 'Venta autorizada: solo lectura' : 'Venta anulada'}
                            onClick={(e) => e.preventDefault()}
                          >
                            <FiCreditCard className="w-4 h-4" /> Pagos
                          </button>
                        )}

                        {/* Eliminar (solo si es borrador / creada) */}
                        {estadoNorm === 'creada' && (
                          <button
                            onClick={() => window.confirmEliminar(row.id)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700"
                            title="Eliminar borrador"
                          >
                            <FiTrash2 className="w-4 h-4" /> Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <Pagination page={ventas} />
        </div>
      </div>
    </AdminLayout>
  );
}
