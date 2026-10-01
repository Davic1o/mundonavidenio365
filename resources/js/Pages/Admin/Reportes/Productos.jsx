import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import useCan from '@/Hooks/useCan';

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
  const can = useCan();
  const canExport = can('reportes_productos.export');

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
    <AdminLayout title="Catálogo de Productos y Costos Netos">
      <Head title="Catálogo de Productos y Costos Netos" />

      {/* Tarjetas resumen de encabezado */}
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Total En Catálogo</span>
          <div className="mt-1 text-2xl font-black text-emerald-950">{dataList.length} registros</div>
          <p className="text-[11px] text-emerald-700 mt-0.5">Mostrando productos cargados</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-800">Fórmula Precio Neto</span>
          <div className="mt-1 text-sm font-extrabold text-sky-950">Base + Gastos(%) + Factor 1(%)</div>
          <p className="text-[11px] text-sky-700 mt-0.5">Precio de compra neto unitario real</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Normativa de Etiqueta</span>
          <div className="mt-1 text-sm font-mono font-extrabold text-indigo-950">YY-ProdID-ProvID-INT-DEC</div>
          <p className="text-[11px] text-indigo-700 mt-0.5">Código de barras escaneable por producto</p>
        </div>
      </div>

      {/* Filtros + Export */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Buscar Producto</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.q}
                  onChange={(e) => setQ((s) => ({ ...s, q: e.target.value }))}
                  placeholder="Ej. Tornillo, Avena, etc."
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Código / Etiqueta</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.codigo}
                  onChange={(e) => setQ((s) => ({ ...s, codigo: e.target.value }))}
                  placeholder="Ej. 26-12-5-13-23"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wide">Proveedor</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.proveedor}
                  onChange={(e) => setQ((s) => ({ ...s, proveedor: e.target.value }))}
                  placeholder="Nombre o CI/RUC"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-medium"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <FiRefreshCw className="w-3.5 h-3.5" /> Limpiar Filtros
            </button>

            {canExport && (
              <div className="flex gap-2">
                <a
                  href={route('admin.reportes.productos.excel', exportParams)}
                  className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition shadow-xs"
                >
                  Descargar Excel (.xls)
                </a>
                <a
                  href={route('admin.reportes.productos.pdf', exportParams)}
                  className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition shadow-xs"
                >
                  Exportar PDF
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100/80 text-slate-700 uppercase font-extrabold tracking-wider border-b border-slate-200">
              <tr className="[&>th]:px-3.5 [&>th]:py-3 [&>th]:text-left">
                <th className="whitespace-nowrap">Lote ID</th>
                <th>Producto</th>
                <th>Etiqueta / Código</th>
                <th>Proveedor</th>
                <th className="text-right">Precio Base Unit.</th>
                <th className="text-center">Gastos %</th>
                <th className="text-center">Factor 1 %</th>
                <th className="text-right bg-emerald-100/60 text-emerald-950 font-black">Precio Compra Neto</th>
                <th className="text-right">PVP Final</th>
                <th className="text-center">Stock Disponible</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {dataList.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-medium">
                    No hay productos o compras registradas con los filtros seleccionados.
                  </td>
                </tr>
              )}

              {dataList.map((row, idx) => {
                const precioBase = Number(row?.precio_compra ?? 0);
                const gastosPct = Number(row?.costo_general ?? 0);
                const factor1Pct = Number(row?.costo_transporte ?? 0);

                const gastosMonto = precioBase * (gastosPct / 100);
                const costoTotalProd = precioBase + gastosMonto;
                const factor1Monto = costoTotalProd * (factor1Pct / 100);
                const precioCompraNeto = costoTotalProd + factor1Monto;

                const pvpFinal = Number(row?.precio_compra_final ?? 0);
                const stockDisponible = row?.producto?.cantidad_total ?? row?.cantidad_compra ?? 0;

                return (
                  <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-3 font-mono font-bold text-slate-500">#{row.id}</td>
                    <td className="px-3.5 py-3">
                      <div className="font-bold text-slate-900 text-sm">
                        {row.producto?.nombre ?? '—'}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Fecha: {fmtDate(row.fecha_compra)}</span>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="inline-block bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100 font-mono text-indigo-950 font-bold text-xs">
                        <FormattedCodigo codigo={row.producto?.codigo} />
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-600 font-medium">
                      {row.proveedor?.nombre ?? '—'}
                      {row.proveedor?.ci_o_ruc ? <span className="text-[10px] text-slate-400 block font-mono">{row.proveedor.ci_o_ruc}</span> : ''}
                    </td>
                    <td className="px-3.5 py-3 text-right font-semibold text-slate-700">{money(precioBase)}</td>
                    <td className="px-3.5 py-3 text-center text-slate-600 font-medium">
                      {gastosPct > 0 ? <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{gastosPct}%</span> : '0%'}
                    </td>
                    <td className="px-3.5 py-3 text-center text-slate-600 font-medium">
                      {factor1Pct > 0 ? <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{factor1Pct}%</span> : '0%'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-extrabold text-emerald-800 bg-emerald-50/70 border-x border-emerald-100 text-sm">
                      {money(precioCompraNeto)}
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-slate-900 text-sm">{money(pvpFinal)}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${stockDisponible > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {stockDisponible} u.
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Fila RESUMEN final */}
            {resumen && (
              <tfoot>
                <tr className="bg-slate-100/90 font-bold border-t border-slate-200">
                  <td colSpan={7} className="px-4 py-2.5 text-xs text-slate-700">
                    <span className="font-extrabold uppercase">Unidades Vendidas (Consulta):</span>{' '}
                    <span className="text-indigo-700 font-black">{resumen.vendidas ?? '—'} u.</span>
                  </td>
                  <td colSpan={3} className="px-4 py-2.5 text-xs text-right text-slate-700">
                    <span className="font-extrabold uppercase">Stock Total Disponible:</span>{' '}
                    <span className="text-emerald-700 font-black">{resumen.stock ?? '—'} u.</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <div className="px-4 pb-4 border-t border-slate-100 pt-2">
          <Pagination page={lotes} />
        </div>
      </div>
    </AdminLayout>
  );
}

