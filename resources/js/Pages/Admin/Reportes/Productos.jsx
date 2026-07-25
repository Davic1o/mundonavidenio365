import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';

/* Helpers paginator */
const getData  = (p) => Array.isArray(p) ? p : (p?.data ?? []);
const getLinks = (p) => p?.links ?? null;

function money(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Código con 2.º segmento más grande + negrita */
function FormattedCodigo({ codigo }) {
  if (!codigo) return '—';
  const parts = String(codigo).split('-');
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i === 1 ? <span className="font-bold text-lg">{p}</span> : <span>{p}</span>}
          {i < parts.length - 1 && <span>-</span>}
        </span>
      ))}
    </span>
  );
}

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

export default function Productos({ lotes, filtros }) {
  const dataList = getData(lotes);

  // Filtros EXACTOS del backend: q, codigo, proveedor
  const [q, setQ] = useState({
    q: filtros?.q ?? '',
    codigo: filtros?.codigo ?? '',
    proveedor: filtros?.proveedor ?? '',
  });

  // Debounce 400ms
  useEffect(() => {
    const id = setTimeout(() => {
      router.get(route('admin.reportes.productos.index'), q, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [q.q, q.codigo, q.proveedor]);

  function clearFilters() {
    const reset = { q: '', codigo: '', proveedor: '' };
    setQ(reset);
    router.get(route('admin.reportes.productos.index'), reset, {
      preserveState: true,
      replace: true,
      preserveScroll: true,
    });
  }

  // Params para exportar (solo los no vacíos)
  const exportParams = useMemo(() => {
    const p = {};
    for (const k of Object.keys(q)) {
      const v = q[k];
      if (v !== '' && v !== null && v !== undefined) p[k] = v;
    }
    return p;
  }, [q]);

  /** ===== Resumen final (una sola fila) =====
   * Tomamos el primer producto de la página y sumamos solo sus filas.
   * vendidas = Σ(cantidad_compra del producto en la página) − stock(cantidad_total).
   */
  const resumen = useMemo(() => {
    if (!dataList.length) return null;

    // Detectar "clave" del producto de referencia en la página
    const first = dataList[0];
    const key = first?.producto?.id ?? first?.producto_id ?? first?.producto?.codigo ?? first?.producto?.nombre;
    if (!key) return null;

    let sumCant = 0;
    let stock = first?.producto?.cantidad_total ?? null;

    for (const r of dataList) {
      const k = r?.producto?.id ?? r?.producto_id ?? r?.producto?.codigo ?? r?.producto?.nombre;
      if (k !== key) continue; // solo el producto principal
      sumCant += Number(r?.cantidad_compra ?? 0);
      if (stock == null && r?.producto?.cantidad_total != null) {
        stock = r.producto.cantidad_total;
      }
    }

    if (stock == null) return { stock: null, vendidas: null };
    const vendidas = Math.max(0, sumCant - Number(stock));
    return { stock, vendidas };
  }, [dataList]);

  return (
    <AdminLayout title="Reporte de Productos">
      <Head title="Reporte de Productos" />

      {/* Filtros + Export */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producto (nombre)</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.q}
                  onChange={(e) => setQ((s) => ({ ...s, q: e.target.value }))}
                  placeholder="Ej. Tornillo, Avena, etc."
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de producto</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.codigo}
                  onChange={(e) => setQ((s) => ({ ...s, codigo: e.target.value }))}
                  placeholder="Ej. 23-3456-34-345-35"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.proveedor}
                  onChange={(e) => setQ((s) => ({ ...s, proveedor: e.target.value }))}
                  placeholder="Nombre o CI/RUC"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <FiRefreshCw className="w-4 h-4" /> Limpiar
            </button>

            <div className="flex gap-2">
              <a
                href={route('admin.reportes.productos.csv', exportParams)}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Exportar CSV
              </a>
              <a
                href={route('admin.reportes.productos.pdf', exportParams)}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Exportar PDF
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                <th className="whitespace-nowrap">ID</th>
                <th>Producto</th>
                <th>Código</th>
                <th>Proveedor</th>
                <th>Fecha de compra</th>
                <th className="text-right">Cantidad</th>
                <th className="text-right">Precio final (unit.)</th>
                <th className="text-right">Compra total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {dataList.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No hay resultados para los filtros seleccionados.
                  </td>
                </tr>
              )}

              {dataList.map((row, idx) => {
                const precioTotal =
                  row?.precio_total != null
                    ? Number(row.precio_total)
                    : Number(row?.cantidad_compra ?? 0) * Number(row?.precio_compra_final ?? 0);

                return (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{row.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">
                        {row.producto?.nombre ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <FormattedCodigo codigo={row.producto?.codigo} />
                    </td>
                    <td className="px-4 py-3">
                      {row.proveedor?.nombre ?? '—'}
                      {row.proveedor?.ci_o_ruc ? ` — [${row.proveedor.ci_o_ruc}]` : ''}
                    </td>
                    <td className="px-4 py-3">{fmtDate(row.fecha_compra)}</td>
                    <td className="px-4 py-3 text-right">{row.cantidad_compra ?? 0}</td>
                    <td className="px-4 py-3 text-right">{money(row.precio_compra_final ?? 0)}</td>
                    <td className="px-4 py-3 text-right">{money(precioTotal)}</td>
                  </tr>
                );
              })}
            </tbody>

            {/* Fila RESUMEN final */}
            {resumen && (
              <tfoot>
                <tr className="bg-slate-50/60">
                  <td colSpan={6} className="px-4 py-2 text-xs text-slate-700">
                    <span className="font-medium">Vendidas (consulta):</span>{' '}
                    {resumen.vendidas ?? '—'}
                  </td>
                  <td colSpan={2} className="px-4 py-2 text-xs text-right text-slate-700">
                    <span className="font-medium">Stock:</span>{' '}
                    {resumen.stock ?? '—'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-4 pb-4">
          <Pagination page={lotes} />
        </div>
      </div>
    </AdminLayout>
  );
}

