import React, { useEffect, useMemo, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiRefreshCw } from 'react-icons/fi';
import BaseModal from '@/Components/BaseModal';
import LoteForm from './components/LoteForm';
import useCan from '@/Hooks/useCan';

/* Helpers paginator */
const getData = (p) => Array.isArray(p) ? p : (p?.data ?? []);
const getLinks = (p) => p?.links ?? null;

function FormattedCodigo({ codigo }) {
  if (!codigo) return '—';
  const parts = String(codigo).split('-');
  return (
    <span>
      {parts.map((p, i) => (
        <span key={i}>
          {i === 1 ? (
            <span className="font-bold text-lg">{p}</span>
          ) : (
            <span>{p}</span>
          )}
          {i < parts.length - 1 && <span>-</span>}
        </span>
      ))}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-EC', { dateStyle: 'short' });
}
function money(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(v);
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

export default function Index({ lotes, filtros, productos = [], proveedores = [] }) {
  const can = useCan();
  const canCreate = can('compras.create');
  const canEdit   = can('compras.edit');
  const canDelete = can('compras.delete');

  const hasActions = canEdit || canDelete;

  const dataList = getData(lotes);

  // filtros del controlador: q, codigo, proveedor
  const [q, setQ] = useState({
    q: filtros?.q ?? '',
    codigo: filtros?.codigo ?? '',
    proveedor: filtros?.proveedor ?? '',
  });

  useEffect(() => {
    const id = setTimeout(() => {
      router.get(route('admin.compras.index'), q, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [q.q, q.codigo, q.proveedor]);

  function clearFilters() {
    setQ({ q: '', codigo: '', proveedor: '' });
    router.get(route('admin.compras.index'), {}, { preserveState: true, replace: true, preserveScroll: true });
  }

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [initial, setInitial] = useState(null); // create: null / edit: row

  const isEdit = !!initial?.id;

  function openCreate() {
    setInitial(null); // Formulario completamente limpio sin productos preseleccionados
    setOpenModal(true);
  }

  function openEdit(row) {
    setInitial(row);
    setOpenModal(true);
  }

  function doDelete(row) {
    if (!confirm('¿Eliminar esta compra? Esto ajustará el stock.')) return;
    router.delete(route('admin.compras.destroy', row.id), {
      preserveScroll: true,
    });
  }

  return (
    <AdminLayout title="Compras">
      <Head title="Compras" />

      {/* Botón crear */}
      <div className="mb-3 flex items-center justify-end">
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition"
          >
            <FiPlus className="w-4 h-4" /> Nueva compra
          </button>
        )}
      </div>

      {/* Filtros */}
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
                  placeholder="Ej. 25-4-8-3-45"
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

      {/* Tabla de lotes */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                <th>Producto</th>
                <th>Código</th>
                <th>Proveedor</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Cantidad</th>
                <th>Disponible</th>
                <th>Precio unit. final</th>
                <th>Precio total</th>
                {hasActions && <th className="w-1">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataList.length === 0 && (
                <tr>
                  <td colSpan={hasActions ? 10 : 9} className="px-4 py-6 text-center text-slate-500">
                    No hay compras que coincidan con los filtros.
                  </td>
                </tr>
              )}

              {dataList.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.producto?.nombre}</div>
                  </td>
                  <td className="px-4 py-3">
                    <FormattedCodigo codigo={row.producto?.codigo} />
                  </td>
                  <td className="px-4 py-3">
                    {row.proveedor?.nombre} {row.proveedor?.ci_o_ruc ? `— [${row.proveedor.ci_o_ruc}]` : ''}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-semibold text-slate-800">
                      {row.registrado_por ? `[ID: ${row.registrado_por.id}] ${row.registrado_por.name}` : (row.registrado_por_id ? `[ID: ${row.registrado_por_id}]` : '—')}
                    </div>
                    {row.actualizado_por && row.actualizado_por.id !== row.registrado_por?.id && (
                      <div className="text-[10px] text-amber-700 mt-0.5">
                        Edit: [ID: {row.actualizado_por.id}] {row.actualizado_por.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{fmtDate(row.fecha_compra)}</td>
                  <td className="px-4 py-3">{row.cantidad_compra}</td>
                  <td className="px-4 py-3">{row.producto?.cantidad_total}</td>
                  <td className="px-4 py-3">{money(row.precio_compra_final)}</td>
                  <td className="px-4 py-3">{money(row.precio_total)}</td>
                  {hasActions && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition"
                            title="Editar"
                          >
                            <FiEdit2 className="w-4 h-4" /> Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => doDelete(row)}
                            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm transition"
                            title="Eliminar"
                          >
                            <FiTrash2 className="w-4 h-4" /> Eliminar
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <Pagination page={lotes} />
        </div>
      </div>

      {/* Modal crear/editar */}
      <BaseModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={isEdit ? 'Editar compra' : 'Registrar compra'}
        maxWidth="4xl"
      >
        <LoteForm
          key={initial?.id ? `edit-${initial.id}` : 'create'}
          productos={productos}
          proveedores={proveedores}
          initial={initial}
          onSuccess={() => setOpenModal(false)}
          onCancel={() => setOpenModal(false)}
        />
      </BaseModal>
    </AdminLayout>
  );
}
