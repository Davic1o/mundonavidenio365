import React, { useRef, useState, useEffect } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiSearch, FiArrowRight, FiUserPlus, FiAlertTriangle, FiEdit2, FiX } from 'react-icons/fi';

function normalizeEstado(s) {
  return String(s ?? '').toLowerCase().trim();
}

export default function ClienteSelect({ venta }) {
  const isReadOnly = normalizeEstado(venta?.estado) === 'autorizado';

  // Buscar existentes
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [backendError, setBackendError] = useState(null);

  // Navegación con flechas en la lista
  const [highlighted, setHighlighted] = useState(-1);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // Modo edición
  const [editingId, setEditingId] = useState(null);

  // Formulario "nuevo/editar cliente"
  const { data, setData, processing, errors, clearErrors, reset } = useForm({
    nombres: '',
    ci_o_ruc: '',
    telefono: '',
    direccion: '',
    correo: '',
  });

  async function buscar() {
    if (isReadOnly) return;
    setBackendError(null);
    clearErrors();
    if (!q) { setResults([]); setHighlighted(-1); return; }
    setLoading(true);
    try {
      const res = await fetch(route('admin.clientes.buscar', { q }), {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      if (!res.ok) {
        let msg = 'Error al buscar clientes.';
        try { msg = (await res.json()).message || msg; } catch {
          const asText = await res.text();
          if (asText?.startsWith('<')) msg = 'El servidor devolvió un error (500). Revisa el log.';
        }
        setBackendError(msg);
        setResults([]);
        setHighlighted(-1);
        return;
      }
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [];
      setResults(arr);
      setHighlighted(arr.length ? 0 : -1); // resalta el primero si hay resultados
    } catch {
      setBackendError('No se pudo conectar con el servidor.');
      setResults([]);
      setHighlighted(-1);
    } finally {
      setLoading(false);
    }
  }

  // Mantener el elemento resaltado a la vista
  useEffect(() => {
    if (highlighted < 0) return;
    const el = itemRefs.current[highlighted];
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlighted, results.length]);

  function seleccionar(cliente_id) {
    if (isReadOnly) return;
    setBackendError(null);
    clearErrors();
    router.post(
      route('admin.admin.iniciar_con_cliente', { venta: venta?.id }),
      { cliente_id },
      {
        preserveScroll: true,
        onError: (err) => setBackendError(err?.message || 'No se pudo iniciar la venta.'),
      }
    );
  }

  function setFormFromCliente(c) {
    setData({
      nombres: c?.nombres ?? '',
      ci_o_ruc: c?.ci_o_ruc ?? '',
      telefono: c?.telefono ?? '',
      direccion: c?.direccion ?? '',
      correo: c?.correo ?? '',
    });
  }

  function editar(c) {
    if (isReadOnly) return;
    clearErrors();
    setBackendError(null);
    setEditingId(c.id);
    setData(prev => ({ ...prev, id: c.id }));
    setFormFromCliente(c);
    setTimeout(() => refNombres.current?.focus(), 0);
  }

  function cancelarEdicion() {
    if (isReadOnly) return;
    setEditingId(null);
    reset();
    clearErrors();
    setBackendError(null);
  }

  // Crear o actualizar y continuar
  function submitForm(e) {
    e.preventDefault();
    if (isReadOnly) return;
    setBackendError(null);
    clearErrors();

    if (editingId) {
      router.put(
        route('admin.clientes.editar'),
        { id: editingId, ...data },
        {
          preserveScroll: true,
          onError: (err) => { if (err?.message) setBackendError(err.message); },
          onFinish: () => {
            if (backendError) return;
            seleccionar(editingId);
          },
        }
      );
    } else {
      router.post(
        route('admin.admin.iniciar_con_cliente', { venta: venta?.id }),
        { nuevo: { ...data } },
        {
          preserveScroll: true,
          onError: (err) => { if (err?.message) setBackendError(err.message); },
        }
      );
    }
  }

  // ======== NAV: Input búsqueda controla ↑/↓/Enter =========
  function onSearchKeyDown(e) {
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isReadOnly) return;
      const idx = highlighted >= 0 ? highlighted : 0;
      const c = results[idx];
      if (c) seleccionar(c.id);
    }
  }

  // También permite navegar desde la lista misma
  function onListKeyDown(e) {
    if (!results.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isReadOnly) return;
      const c = results[highlighted >= 0 ? highlighted : 0];
      if (c) seleccionar(c.id);
    }
  }

  // ======== Navegación con flechas en el formulario =========
  const refNombres = useRef(null);
  const refCiRuc = useRef(null);
  const refTelefono = useRef(null);
  const refCorreo = useRef(null);
  const refDireccion = useRef(null);

  const orderedRefs = [
    { key: 'nombres', ref: refNombres },
    { key: 'ci', ref: refCiRuc },
    { key: 'tel', ref: refTelefono },
    { key: 'correo', ref: refCorreo },
    { key: 'dir', ref: refDireccion },
  ];

  function focusMove(fromKey, dir = 1) {
    const idx = orderedRefs.findIndex(r => r.key === fromKey);
    if (idx < 0) return;
    const next = (idx + dir + orderedRefs.length) % orderedRefs.length;
    orderedRefs[next].ref.current?.focus();
    orderedRefs[next].ref.current?.select?.();
  }

  function onNavKeyDown(e, fieldKey) {
    const el = e.currentTarget;
    const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const caretAtEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

    if (e.key === 'ArrowDown') { e.preventDefault(); focusMove(fieldKey, +1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusMove(fieldKey, -1); }
    else if (e.key === 'ArrowRight' && caretAtEnd) { e.preventDefault(); focusMove(fieldKey, +1); }
    else if (e.key === 'ArrowLeft' && caretAtStart) { e.preventDefault(); focusMove(fieldKey, -1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (!processing && !isReadOnly) {
        const form = el.closest('form');
        form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  }

  return (
    <AdminLayout title="Nueva venta — Cliente">
      <Head title="Nueva venta — Cliente" />

      {/* Solo lectura */}
      {isReadOnly && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <strong>Venta AUTORIZADA:</strong> no es posible cambiar el cliente ni crear/editar clientes para esta venta.
        </div>
      )}

      {/* Error backend */}
      {backendError && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 flex items-start gap-2">
          <FiAlertTriangle className="mt-0.5 h-4 w-4" />
          <div className="text-sm">
            <p className="font-medium">Error del servidor</p>
            <p>{backendError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Buscar cliente */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Buscar cliente</h3>
          <div className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (!isReadOnly) { onSearchKeyDown(e); if (e.key === 'Enter' && !results.length) buscar(); } }}
                placeholder="Nombre o CI/RUC"
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 pl-9 focus:border-primary-500 focus:ring-primary-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <button
              onClick={buscar}
              disabled={isReadOnly}
              className={`rounded-md px-3 py-2 text-sm text-white ${isReadOnly ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800'}`}
            >
              {loading ? '...' : 'Buscar'}
            </button>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            tabIndex={0}
            onKeyDown={onListKeyDown}
            className="max-h-72 overflow-auto divide-y divide-slate-100 focus:outline-none rounded-md"
          >
            {(results || []).map((c, idx) => {
              const active = idx === highlighted;
              return (
                <li
                  key={c.id}
                  role="option"
                  aria-selected={active}
                  ref={el => (itemRefs.current[idx] = el)}
                  onMouseEnter={() => setHighlighted(idx)}
                  className={[
                    'flex items-center justify-between py-2 px-2 gap-2 cursor-pointer',
                    active ? 'bg-primary-400' : 'hover:bg-slate-50'
                  ].join(' ')}
                >
                  <div
                    className="min-w-0 flex-1"
                    onClick={() => !isReadOnly && setHighlighted(idx)}
                  >
                    <p className={`truncate text-sm font-medium ${active ? 'text-primary-800' : 'text-slate-800'}`}>{c.nombres}</p>
                    <p className="truncate text-xs text-slate-500">
                      {c.ci_o_ruc || '—'} {c.telefono ? `· ${c.telefono}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => editar(c)}
                      disabled={isReadOnly}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
                      title="Editar"
                      type="button"
                    >
                      <FiEdit2 className="h-4 w-4" /> Editar
                    </button>
                    <button
                      onClick={() => seleccionar(c.id)}
                      disabled={isReadOnly}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
                      title="Continuar"
                    >
                      Continuar <FiArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
            {(!results || results.length === 0) && (
              <li className="py-4 px-2 text-sm text-slate-500">Sin resultados.</li>
            )}
          </ul>
        </div>

        {/* Crear/Editar cliente */}
        <form onSubmit={submitForm} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">
              {editingId ? 'Editar cliente' : 'Crear cliente'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={cancelarEdicion}
                disabled={isReadOnly}
                className="inline-flex items-center gap-2 text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
                title="Cancelar edición"
              >
                <FiX className="h-4 w-4" /> Cancelar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div>
              <input
                ref={refNombres}
                required
                placeholder="Nombres*"
                value={data.nombres}
                onChange={(e) => setData('nombres', e.target.value.toUpperCase())}
                onKeyDown={(e) => onNavKeyDown(e, 'nombres')}
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {errors.nombres && <p className="mt-1 text-xs text-rose-600">{errors.nombres}</p>}
            </div>

            <div>
              <input
                ref={refCiRuc}
                placeholder="CI/RUC"
                value={data.ci_o_ruc}
                onChange={(e) => setData('ci_o_ruc', e.target.value)}
                onKeyDown={(e) => onNavKeyDown(e, 'ci')}
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {errors.ci_o_ruc && <p className="mt-1 text-xs text-rose-600">{errors.ci_o_ruc}</p>}
            </div>

            <div>
              <input
                ref={refTelefono}
                placeholder="Teléfono"
                value={data.telefono}
                onChange={(e) => setData('telefono', e.target.value)}
                onKeyDown={(e) => onNavKeyDown(e, 'tel')}
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {errors.telefono && <p className="mt-1 text-xs text-rose-600">{errors.telefono}</p>}
            </div>

            <div>
              <input
                ref={refCorreo}
                placeholder="Correo"
                value={data.correo}
                onChange={(e) => setData('correo', e.target.value.toLowerCase())}
                onKeyDown={(e) => onNavKeyDown(e, 'correo')}
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {errors.correo && <p className="mt-1 text-xs text-rose-600">{errors.correo}</p>}
            </div>

            <div>
              <input
                ref={refDireccion}
                placeholder="Dirección"
                value={data.direccion}
                onChange={(e) => setData('direccion', e.target.value.toUpperCase())}
                onKeyDown={(e) => onNavKeyDown(e, 'dir')}
                disabled={isReadOnly}
                className="w-full rounded-md border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {errors.direccion && <p className="mt-1 text-xs text-rose-600">{errors.direccion}</p>}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={processing || isReadOnly}
              className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-2 text-sm text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {editingId ? (
                <>
                  <FiEdit2 className="h-4 w-4" /> {processing ? 'Guardando...' : 'Guardar cambios'}
                </>
              ) : (
                <>
                  <FiUserPlus className="h-4 w-4" /> {processing ? 'Creando...' : 'Crear y continuar'}
                </>
              )}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={() => seleccionar(editingId)}
                disabled={isReadOnly}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400"
                title="Usar este cliente sin guardar cambios"
              >
                Continuar sin guardar <FiArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
