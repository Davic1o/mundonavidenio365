import React, { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiPlus, FiEdit2, FiRefreshCw } from 'react-icons/fi';
import BaseModal from '@/Components/BaseModal';
import UsuarioForm from './Components/UsuarioForm';

/* Helpers paginator */
function getData(p) { return Array.isArray(p) ? p : (p?.data ?? []); }
function getLinks(p) { return p?.links ?? null; }

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' });
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

const ROLE_BADGES = {
  'Superadmin': 'bg-purple-50 text-purple-700 border-purple-200 font-bold',
  'Admin General': 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold',
  'Administrador': 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium',
  'Ventas': 'bg-amber-50 text-amber-700 border-amber-200 font-medium',
};

export default function Index({ users, filters, roles }) {
  const { props } = usePage();
  const auth = props?.auth || {};
  const isSuperAdmin = auth.isSuperAdmin || auth.user?.role === 'Superadmin';
  const permissions = auth.permissions || auth.user?.permissions || [];
  const canCreate = isSuperAdmin || permissions.includes('usuarios.create');
  const canEdit   = isSuperAdmin || permissions.includes('usuarios.edit');

  const dataList = getData(users);

  // Filtros con debounce
  const [q, setQ] = useState({
    name: filters?.name ?? '',
    email: filters?.email ?? '',
    role: filters?.role ?? '',
    per_page: String(filters?.per_page ?? 10),
  });

  useEffect(() => {
    const id = setTimeout(() => {
      router.get(route('admin.usuarios.index'), q, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.name, q.email, q.role, q.per_page]);

  function clearFilters() {
    setQ({ name: '', email: '', role: '', per_page: String(filters?.per_page ?? 10) });
    router.get(route('admin.usuarios.index'), { per_page: filters?.per_page ?? 10 }, {
      preserveState: true, replace: true, preserveScroll: true,
    });
  }

  // Modal create/edit
  const [openModal, setOpenModal] = useState(false);
  const [editing, setEditing] = useState(null);

  function openCreate() {
    setEditing(null);
    setOpenModal(true);
  }
  function openEdit(u) {
    setEditing(u);
    setOpenModal(true);
  }

  return (
    <AdminLayout title="Usuarios">
      <Head title="Usuarios" />

      {/* Botón dentro del componente (no en el layout) */}
      <div className="mb-3 flex items-center justify-end">
        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition"
          >
            <FiPlus className="w-4 h-4" /> Nuevo Usuario
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="col-span-1 lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.name}
                  onChange={(e) => setQ((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Buscar por nombre"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="col-span-1 lg:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={q.email}
                  onChange={(e) => setQ((s) => ({ ...s, email: e.target.value }))}
                  placeholder="Buscar por correo"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
              <select
                value={q.role}
                onChange={(e) => setQ((s) => ({ ...s, role: e.target.value }))}
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="">Todos</option>
                {(roles ?? []).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Por página</label>
              <select
                value={q.per_page}
                onChange={(e) => setQ((s) => ({ ...s, per_page: e.target.value }))}
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              >
                {[10, 15, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
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
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Creado</th>
                {canEdit && <th className="w-1">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataList.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron usuarios con los filtros aplicados.
                  </td>
                </tr>
              )}

              {dataList.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${
                      ROLE_BADGES[u.role] || 'bg-white border-slate-200 text-slate-700'
                    }`}>
                      {u.role || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fmtDate(u.created_at)}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition"
                        title="Editar"
                      >
                        <FiEdit2 className="w-4 h-4" /> Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 pb-4">
          <Pagination page={users} />
        </div>
      </div>

      {/* Modal crear/editar usando BaseModal */}
      <BaseModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title={editing ? 'Editar usuario' : 'Nuevo usuario'}
        maxWidth="md"
      >
        <UsuarioForm
          roles={roles}
          initial={editing}
          onSuccess={() => setOpenModal(false)}
          onCancel={() => setOpenModal(false)}
        />
      </BaseModal>
    </AdminLayout>
  );
}
