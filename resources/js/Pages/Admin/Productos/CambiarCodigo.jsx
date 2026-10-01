import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import useCan from '@/Hooks/useCan';
import BaseModal from '@/Components/BaseModal';
import AutoComplete from '@/Components/AutoComplete';
import {
  FiTag,
  FiSearch,
  FiEdit3,
  FiAlertTriangle,
  FiCheckCircle,
  FiShield,
  FiRefreshCw,
  FiCopy,
  FiCheck,
  FiFileText,
  FiArrowRight,
  FiAlertCircle,
  FiUserCheck,
  FiCalendar,
  FiDollarSign,
  FiCheckSquare,
} from 'react-icons/fi';

/* Helpers de formato */
const fmtProvText = (p) => (p ? `${p.nombre}${p.ci_o_ruc ? ` — [${p.ci_o_ruc}]` : ''}` : '');

function fmt(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getData(p) {
  return Array.isArray(p) ? p : p?.data ?? [];
}

function getLinks(p) {
  return p?.links ?? null;
}

/** Render del código con el segundo segmento destacado (estilo oficial Compras) */
function CodigoPretty({ codigo }) {
  if (!codigo) return <span>—</span>;
  const parts = String(codigo).split('-');
  return (
    <span className="align-baseline font-mono font-bold">
      {parts.map((seg, i) => (
        <span key={i} className={i === 1 ? 'text-lg font-black text-primary-700' : 'text-slate-800'}>
          {seg}
          {i < parts.length - 1 ? <span className="px-0.5 text-slate-400">-</span> : null}
        </span>
      ))}
    </span>
  );
}

function Pagination({ page }) {
  const links = getLinks(page);
  if (!links || links.length <= 1) return null;

  return (
    <nav className="mt-4 flex flex-wrap gap-2 items-center justify-center sm:justify-start">
      {links.map((l, i) => {
        const label = l.label
          .replace('&laquo; Previous', '« Anterior')
          .replace('Next &raquo;', 'Siguiente »')
          .replace(/&laquo;|&raquo;/g, (m) => (m === '&laquo;' ? '«' : '»'));

        return l.url ? (
          <Link
            key={i}
            href={l.url}
            preserveScroll
            preserveState
            className={[
              'px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition',
              l.active
                ? 'border-primary-600 text-primary-700 bg-primary-50 shadow-sm font-semibold'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-300',
            ].join(' ')}
          >
            <span dangerouslySetInnerHTML={{ __html: label }} />
          </Link>
        ) : (
          <span
            key={i}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-400 bg-slate-50/50 cursor-not-allowed"
            dangerouslySetInnerHTML={{ __html: label }}
          />
        );
      })}
    </nav>
  );
}

export default function CambiarCodigo({ productos, proveedores = [], filtros, stats }) {
  const can = useCan();
  const canView = can('cambio_codigo.view');
  const canUpdate = can('cambio_codigo.update');

  if (!canView) {
    return (
      <AdminLayout>
        <Head title="Acceso Denegado" />
        <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-xl shadow-xs border border-rose-200 text-center">
          <FiAlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800 mb-1">Acceso Restringido</h2>
          <p className="text-xs text-slate-600 mb-4">
            No tienes permisos suficientes para visualizar este módulo.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold"
          >
            Volver al Inicio
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const listado = getData(productos);

  // Filtro de búsqueda con debounce
  const [q, setQ] = useState(filtros?.q ?? '');
  const [copiedId, setCopiedId] = useState(null);

  // Lista local y reactiva de proveedores asegurando que se carguen siempre
  const [localProveedores, setLocalProveedores] = useState(() =>
    Array.isArray(proveedores) ? proveedores : (proveedores?.data ?? [])
  );
  const [busquedaProvModo, setBusquedaProvModo] = useState('select'); // 'select' | 'autocomplete'

  const getRoute = (name, params = {}, fallback = '') => {
    try {
      if (typeof route === 'function') return route(name, params);
    } catch (_) {}
    return fallback;
  };

  // Carga asíncrona de proveedores desde la API oficial de compras para garantizar que siempre haya datos
  useEffect(() => {
    if (Array.isArray(proveedores) && proveedores.length > 0) {
      setLocalProveedores(proveedores);
    }
    const apiUrl = getRoute('admin.proveedores.buscar', { q: '' }, '/admin/proveedores/buscar');
    fetch(apiUrl)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setLocalProveedores((prev) => {
            const map = new Map();
            data.forEach((item) => map.set(String(item.id), item));
            (prev || []).forEach((item) => {
              if (!map.has(String(item.id))) map.set(String(item.id), item);
            });
            return Array.from(map.values());
          });
        }
      })
      .catch((err) => {
        console.warn('Error fetching proveedores:', err);
      });
  }, [proveedores]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (q !== (filtros?.q ?? '')) {
        const url = getRoute('admin.productos.cambiar_codigo.index', { q }, '/admin/productos/cambiar-codigo');
        router.get(
          url,
          { q },
          {
            preserveState: true,
            replace: true,
            preserveScroll: true,
          }
        );
      }
    }, 350);
    return () => clearTimeout(id);
  }, [q, filtros?.q]);

  const handleClear = () => {
    setQ('');
    const url = getRoute('admin.productos.cambiar_codigo.index', {}, '/admin/productos/cambiar-codigo');
    router.get(
      url,
      { q: '' },
      { preserveState: true, replace: true, preserveScroll: true }
    );
  };

  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ====================================================================
   * ESTADO DEL MODAL (IDÉNTICO A COMPRAS - LOTEFORM)
   * ==================================================================== */
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { data, setData, put, processing, errors, reset, clearErrors } = useForm({
    nuevo_codigo: '',
    proveedor_id: '',
    precio_compra: '',
    fecha_compra: new Date().toISOString().slice(0, 10),
    anio: new Date().getFullYear(),
    costo_general: '0',
    costo_transporte: '0',
    porcentaje_ganancia: '0',
    comision_pct: '0',
    precio_compra_final: '',
    actualizar_lote: true,
    acepta_riesgo: false,
  });

  // Modos de cálculo (% o $) como en Compras
  const [gastosModo, setGastosModo] = useState('pct');
  const [gastosVal, setGastosVal] = useState('0');

  const [factor1Modo, setFactor1Modo] = useState('pct');
  const [factor1Val, setFactor1Val] = useState('0');

  const [gananciaVal, setGananciaVal] = useState('0');
  const [factor2Val, setFactor2Val] = useState('0');

  const [autoSyncCodigo, setAutoSyncCodigo] = useState(true);

  // Proveedor seleccionado activo para autocomplete y badges
  const provSeleccionado = useMemo(() => {
    if (!data.proveedor_id) return null;
    let found = localProveedores.find((x) => String(x.id) === String(data.proveedor_id));
    if (found) return found;
    if (
      selectedProduct &&
      String(selectedProduct.proveedor_id) === String(data.proveedor_id) &&
      selectedProduct.proveedor_nombre
    ) {
      return {
        id: selectedProduct.proveedor_id,
        nombre: selectedProduct.proveedor_nombre,
        ci_o_ruc: selectedProduct.proveedor_ruc,
      };
    }
    return null;
  }, [localProveedores, data.proveedor_id, selectedProduct]);

  const defaultProvText = useMemo(() => {
    if (!provSeleccionado) {
      return data.proveedor_id ? `Proveedor #${data.proveedor_id}` : '';
    }
    return fmtProvText(provSeleccionado);
  }, [provSeleccionado, data.proveedor_id]);

  /* Cálculos matemáticos idénticos a LoteForm (Compras) */
  const precioCompraBase = Number(data.precio_compra || 0);

  // 1. Gastos
  const gValNum = Number(gastosVal || 0);
  const gastosMonto = gastosModo === 'pct' ? precioCompraBase * (gValNum / 100) : gValNum;
  const costoTotalProducto = precioCompraBase + gastosMonto;

  // 2. Factor 1 (Transporte)
  const f1ValNum = Number(factor1Val || 0);
  const factor1Monto = factor1Modo === 'pct' ? costoTotalProducto * (f1ValNum / 100) : f1ValNum;
  const subtotal1 = costoTotalProducto + factor1Monto;

  // 3. Ganancia (Margen comercial)
  const ganValNum = Number(gananciaVal || 0);
  const subtotal2 = ganValNum > 0 && ganValNum < 100 ? subtotal1 / (1 - (ganValNum / 100)) : subtotal1;
  const gananciaMonto = subtotal2 - subtotal1;

  // 4. Factor 2 (Comisión / IVA)
  const f2ValNum = Number(factor2Val || 0);
  const factor2Monto = subtotal2 * (f2ValNum / 100);

  // 5. PVP Final Calculado
  const pvpCalculado = subtotal2 + factor2Monto;

  // Base Etiqueta: (Precio Compra + Gastos + Factor 1) × (1 + %Comisión)
  const valorEtiquetaBase = subtotal1 * (1 + (f2ValNum / 100));

  // Código de etiqueta proyectado
  const codigoEtiquetaProyectado = useMemo(() => {
    if (!selectedProduct) return '';

    const fStr = data.fecha_compra || new Date().toISOString().slice(0, 10);
    const d = new Date(fStr + 'T00:00:00');
    const fullYear = !isNaN(d.getFullYear()) ? d.getFullYear() : new Date().getFullYear();
    const yy = String(fullYear).slice(-2);

    const pId = selectedProduct.id;
    const provId = data.proveedor_id || (localProveedores?.[0]?.id ?? proveedores?.[0]?.id ?? '1');

    const totalRedondeado = Math.round((valorEtiquetaBase || 0) * 100) / 100;
    const entero = Math.floor(totalRedondeado);
    const decVal = Math.round((totalRedondeado - entero) * 100);
    const decStr = String(decVal).padStart(2, '0');

    return `${yy}-${pId}-${provId}-${entero}-${decStr}`;
  }, [selectedProduct, data.fecha_compra, data.proveedor_id, valorEtiquetaBase, localProveedores, proveedores]);

  // Si modalOpen está abierto y data.proveedor_id está vacío o no coincide, seleccionar el primero por defecto
  useEffect(() => {
    if (modalOpen && !data.proveedor_id && localProveedores.length > 0) {
      setData('proveedor_id', String(localProveedores[0].id));
    }
  }, [modalOpen, localProveedores, data.proveedor_id]);

  // Sincronizar automáticamente el campo del nuevo código cuando cambien los factores si autoSync está activo
  useEffect(() => {
    if (autoSyncCodigo && codigoEtiquetaProyectado) {
      setData('nuevo_codigo', codigoEtiquetaProyectado);
    }
  }, [autoSyncCodigo, codigoEtiquetaProyectado]);

  // Actualizar precio_compra_final si cambia el cálculo
  useEffect(() => {
    if (pvpCalculado > 0) {
      const calcStr = pvpCalculado.toFixed(2);
      if (data.precio_compra_final !== calcStr) {
        setData('precio_compra_final', calcStr);
      }
    }
    // Sincronizar inputs en data
    setData((s) => ({
      ...s,
      costo_general: String(gastosVal),
      costo_transporte: String(factor1Val),
      porcentaje_ganancia: String(gananciaVal),
      comision_pct: String(factor2Val),
    }));
  }, [precioCompraBase, gastosVal, gastosModo, factor1Val, factor1Modo, gananciaVal, factor2Val]);

  // Abrir Modal cargando todos los datos actuales del producto y de su lote
  const openChangeModal = (prod) => {
    setSelectedProduct(prod);

    const parts = String(prod.codigo || '').split('-');
    const provFromCode = parts.length >= 3 && !isNaN(parts[2]) ? String(parts[2]) : '';

    // Si el producto trae proveedor, asegurar que esté en localProveedores para que aparezca seleccionado
    if (prod.proveedor_id && prod.proveedor_nombre) {
      setLocalProveedores((prev) => {
        if ((prev || []).some((p) => String(p.id) === String(prod.proveedor_id))) return prev;
        return [
          {
            id: prod.proveedor_id,
            nombre: prod.proveedor_nombre,
            ci_o_ruc: prod.proveedor_ruc || '',
          },
          ...(prev || []),
        ];
      });
    }

    const provDefault = String(
      prod.proveedor_id ||
      provFromCode ||
      (localProveedores?.length > 0 ? localProveedores[0].id : '') ||
      (Array.isArray(proveedores) && proveedores.length > 0 ? proveedores[0].id : '1')
    );

    const precioFromCode = parts.length >= 5 && !isNaN(parts[3]) && !isNaN(parts[4]) ? `${parts[3]}.${parts[4]}` : '';
    const precioBase = prod.precio_compra > 0 ? String(prod.precio_compra) : (precioFromCode || '');

    const anioFromCode = parts.length >= 1 && !isNaN(parts[0]) ? (parts[0].length === 2 ? `20${parts[0]}` : parts[0]) : '';
    const anioBase = prod.anio || (anioFromCode ? Number(anioFromCode) : new Date().getFullYear());
    const fechaCompra = prod.fecha_compra || `${anioBase}-01-01`;

    const gVal = String(prod.costo_general ?? 0);
    const f1Val = String(prod.costo_transporte ?? 0);
    const ganVal = String(prod.porcentaje_ganancia ?? 0);
    const f2Val = String(prod.comision_pct ?? 0);
    const pvp = prod.precio_compra_final > 0 ? String(prod.precio_compra_final) : '';

    setGastosModo('pct');
    setGastosVal(gVal);
    setFactor1Modo('pct');
    setFactor1Val(f1Val);
    setGananciaVal(ganVal);
    setFactor2Val(f2Val);

    setData({
      nuevo_codigo: prod.codigo || '',
      proveedor_id: provDefault,
      precio_compra: precioBase,
      fecha_compra: fechaCompra,
      anio: anioBase,
      costo_general: gVal,
      costo_transporte: f1Val,
      porcentaje_ganancia: ganVal,
      comision_pct: f2Val,
      precio_compra_final: pvp,
      actualizar_lote: true,
      acepta_riesgo: false,
    });

    setAutoSyncCodigo(true);
    clearErrors();
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProduct(null);
    reset();
    clearErrors();
  };

  const handleFinalChange = (e) => {
    const val = e.target.value;
    setData('precio_compra_final', val);
    const finalNum = Number(val || 0);
    const targetSub2 = finalNum - factor2Monto;
    if (targetSub2 > 0 && subtotal1 > 0) {
      const porc = ((1 - (subtotal1 / targetSub2)) * 100).toFixed(2);
      setGananciaVal(porc);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const url = getRoute(
      'admin.productos.cambiar_codigo.update',
      selectedProduct.id,
      `/admin/productos/${selectedProduct.id}/cambiar-codigo`
    );

    put(url, {
      preserveScroll: true,
      onSuccess: () => {
        closeModal();
      },
    });
  };

  const isSameCode = useMemo(() => {
    if (!selectedProduct || !data.nuevo_codigo) return false;
    return data.nuevo_codigo.trim() === (selectedProduct.codigo || '').trim();
  }, [selectedProduct, data.nuevo_codigo]);

  const canSubmit = useMemo(() => {
    return Boolean(data.nuevo_codigo.trim()) && !isSameCode && Boolean(data.acepta_riesgo) && !processing;
  }, [data.nuevo_codigo, isSameCode, data.acepta_riesgo, processing]);

  return (
    <AdminLayout title="Cambio Exclusivo de Códigos">
      <Head title="Cambio de Códigos de Producto - Administrador" />

      {/* Cabecera Principal */}
      <div className="mb-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold mb-1">
              <FiShield className="w-3.5 h-3.5 text-amber-700" />
              Módulo Exclusivo para Administrador
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FiTag className="w-6 h-6 text-primary-600" />
              Gestión y Cambio de Códigos de Producto
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Actualice el código de barra y los parámetros que lo originan (proveedor, precios y costos) manteniendo todas las asociaciones intactas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs text-center">
              <div className="text-[11px] font-medium text-slate-500">Total Productos</div>
              <div className="text-base font-bold text-slate-800">{stats?.total_productos ?? 0}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs text-center">
              <div className="text-[11px] font-medium text-slate-500">Con Compras/Lotes</div>
              <div className="text-base font-bold text-primary-600">{stats?.total_con_lotes ?? 0}</div>
            </div>
          </div>
        </div>

        {/* ALERTA DE RIESGO SUPERIOR COMPACTA */}
        <div className="mt-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center gap-2 shadow-xs">
          <FiAlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Aviso de etiquetas:</strong> Modificar el código dejará sin validez las etiquetas físicas ya impresas en tienda. Deberá reimprimirlas desde el módulo de <Link href={getRoute('admin.etiquetas.index', {}, '/admin/etiquetas')} className="underline font-bold hover:text-amber-950">Etiquetas</Link>.
          </span>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, código o ID..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-300 text-xs sm:text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition"
            />
            {q && (
              <button onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1" title="Limpiar">
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition"
            >
              <FiRefreshCw className="w-3 h-3" />
              Restablecer
            </button>
            <span className="text-xs text-slate-500 font-medium">
              {listado.length} productos
            </span>
          </div>
        </div>
      </div>

      {/* Tabla de Productos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="px-3.5 py-3 w-14 text-center">ID</th>
                <th className="px-3.5 py-3">Producto</th>
                <th className="px-3.5 py-3">Código Actual</th>
                <th className="px-3.5 py-3">Proveedor Asignado</th>
                <th className="px-3.5 py-3">P. Compra / PVP</th>
                {canUpdate && <th className="px-3.5 py-3 text-center w-32">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
              {listado.length === 0 ? (
                <tr>
                  <td colSpan={canUpdate ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                    <FiTag className="mx-auto w-8 h-8 text-slate-300 mb-1" />
                    <p className="font-semibold text-slate-700 text-xs">No se encontraron productos</p>
                  </td>
                </tr>
              ) : (
                listado.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-3.5 py-2.5 text-center font-mono text-xs font-bold text-slate-500">
                      #{prod.id}
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="font-bold text-slate-900 leading-tight">{prod.nombre}</div>
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="inline-flex items-center gap-1 bg-slate-100 border border-slate-300/80 px-2 py-0.5 rounded">
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {prod.codigo || 'SIN CÓDIGO'}
                        </span>
                        {prod.codigo && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(prod.codigo, prod.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5"
                            title="Copiar código"
                          >
                            {copiedId === prod.id ? <FiCheck className="w-3 h-3 text-emerald-600" /> : <FiCopy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5">
                      <div className="font-medium text-slate-800 text-xs truncate max-w-[160px]">
                        {prod.proveedor_nombre || `Proveedor #${prod.proveedor_id || '1'}`}
                      </div>
                    </td>

                    <td className="px-3.5 py-2.5 text-xs">
                      <div>Base: <b className="font-mono">${Number(prod.precio_compra || 0).toFixed(2)}</b></div>
                      <div className="text-emerald-700">PVP: <b className="font-mono">${Number(prod.precio_compra_final || 0).toFixed(2)}</b></div>
                    </td>

                    {canUpdate && (
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          onClick={() => openChangeModal(prod)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold text-xs shadow-xs transition"
                        >
                          <FiEdit3 className="w-3 h-3" />
                          Cambiar Código
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <Pagination page={productos} />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL COMPACTO CON SCROLL (MISMO ESTILO VISUAL DE COMPRAS / LOTEFORM)      */}
      {/* ========================================================================= */}
      <BaseModal
        open={modalOpen}
        onClose={closeModal}
        title="Actualizar Código y Datos de Etiqueta"
        maxWidth="3xl"
      >
        {selectedProduct && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* CONTENEDOR CON SCROLL INTERNO PARA CONTROLAR LA ALTURA */}
            <div className="max-h-[66vh] overflow-y-auto pr-1.5 space-y-3">
              
              {/* Tarjeta Producto y Código Actual */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Producto #{selectedProduct.id}</span>
                  <div className="font-bold text-slate-900 text-sm">{selectedProduct.nombre}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">Código Actual:</span>
                  <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                    {selectedProduct.codigo || '—'}
                  </span>
                </div>
              </div>

              {/* TARJETA VISUAL: CÓDIGO DE ETIQUETA PROYECTADO (ESTILO EXACTO COMPRAS) */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🏷️</span>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">Código de Etiqueta (Previsualización)</h4>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white text-indigo-700 border border-indigo-200">
                      normativa backend
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-900/80 mt-0.5 font-medium">
                    Base Etiqueta: <code className="font-mono bg-white px-1 py-0.2 rounded border border-indigo-200 text-indigo-900 font-bold">(Precio Compra + Gastos + Factor 1) × (1 + %Comisión) = ${fmt(valorEtiquetaBase)}</code>
                  </p>
                </div>
                <div className="bg-white border border-indigo-200 rounded-lg px-3 py-1.5 text-center shadow-xs min-w-[170px]">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-500 block">Etiqueta Producto</span>
                  <span className="text-base font-mono font-black text-indigo-950 tracking-tight">
                    <CodigoPretty codigo={codigoEtiquetaProyectado} />
                  </span>
                </div>
              </div>

              {/* CONTENEDOR DESGLOSE DE COSTOS (IDÉNTICO A COMPRAS) */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>📊</span> Desglose de Costos, Comisión y PVP
                  </h3>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer select-none font-medium">
                    <input
                      type="checkbox"
                      checked={autoSyncCodigo}
                      onChange={(e) => setAutoSyncCodigo(e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    Sincronizar código en tiempo real
                  </label>
                </div>

                {/* Fila 1: Proveedor, Fecha y Precio Compra */}
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                  <div className="sm:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <FiUserCheck className="w-3 h-3 text-slate-500" />
                        Proveedor
                        {localProveedores.length > 0 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({localProveedores.length} disponibles)
                          </span>
                        )}
                      </label>
                      <button
                        type="button"
                        onClick={() => setBusquedaProvModo((m) => (m === 'select' ? 'autocomplete' : 'select'))}
                        className="text-[10px] text-primary-600 hover:text-primary-800 font-medium hover:underline"
                      >
                        {busquedaProvModo === 'select' ? '🔍 Buscar por texto' : '📋 Ver lista completa'}
                      </button>
                    </div>

                    {busquedaProvModo === 'autocomplete' ? (
                      <AutoComplete
                        searchRouteName="admin.proveedores.buscar"
                        initialItems={localProveedores}
                        placeholder="Escribe nombre o CI/RUC para buscar..."
                        defaultText={defaultProvText}
                        formatItem={(p) => fmtProvText(p)}
                        onSelect={(p) => {
                          setData('proveedor_id', String(p.id));
                          if (!localProveedores.some((x) => String(x.id) === String(p.id))) {
                            setLocalProveedores((prev) => [...prev, p]);
                          }
                        }}
                        className="w-full text-xs font-semibold"
                      />
                    ) : (
                      <select
                        value={String(data.proveedor_id || '')}
                        onChange={(e) => setData('proveedor_id', e.target.value)}
                        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-semibold py-1.5 px-2 bg-white"
                        required
                      >
                        {localProveedores.length === 0 ? (
                          <option value="">Cargando proveedores...</option>
                        ) : (
                          localProveedores.map((pr) => (
                            <option key={pr.id} value={String(pr.id)}>
                              #{pr.id} - {pr.nombre} {pr.ci_o_ruc ? `(${pr.ci_o_ruc})` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    )}

                    {/* Resumen del proveedor activo seleccionado */}
                    {provSeleccionado && (
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                        <span className="truncate">
                          Activo: <b className="text-primary-700">#{provSeleccionado.id} - {provSeleccionado.nombre}</b>
                        </span>
                        {provSeleccionado.ci_o_ruc && (
                          <span className="font-mono text-slate-400 font-medium">RUC: {provSeleccionado.ci_o_ruc}</span>
                        )}
                      </div>
                    )}
                    {errors.proveedor_id && (
                      <p className="mt-0.5 text-[11px] text-rose-600">{errors.proveedor_id}</p>
                    )}
                  </div>

                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fecha</label>
                    <input
                      type="date"
                      className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs py-1.5 px-2 bg-white"
                      value={data.fecha_compra}
                      onChange={(e) => {
                        const val = e.target.value;
                        const yr = val ? new Date(val + 'T00:00:00').getFullYear() : new Date().getFullYear();
                        setData((s) => ({ ...s, fecha_compra: val, anio: yr }));
                      }}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-800 mb-1">Precio de Compra ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-bold py-1.5 px-2 bg-white text-slate-900"
                      value={data.precio_compra}
                      onChange={(e) => setData('precio_compra', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {/* Fila 2: Gastos y Factor 1 (Idéntico a Compras) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* GASTOS */}
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[9px] font-bold">1</span>
                        Gastos
                      </label>
                      <div className="inline-flex rounded bg-slate-100 p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setGastosModo('pct')}
                          className={`px-1.5 py-0.5 rounded transition ${gastosModo === 'pct' ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setGastosModo('val')}
                          className={`px-1.5 py-0.5 rounded transition ${gastosModo === 'val' ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
                        >
                          $
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-semibold pr-6 py-1 px-2"
                        value={gastosVal}
                        onChange={(e) => setGastosVal(e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1 text-[11px] font-bold text-slate-400">
                        {gastosModo === 'pct' ? '%' : '$'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Monto: <b className="text-slate-700">+${fmt(gastosMonto)}</b></span>
                      <span className="font-semibold text-emerald-700">Costo Total: <b>${fmt(costoTotalProducto)}</b></span>
                    </div>
                  </div>

                  {/* FACTOR 1 */}
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[9px] font-bold">2</span>
                        Factor 1 (Transporte)
                      </label>
                      <div className="inline-flex rounded bg-slate-100 p-0.5 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setFactor1Modo('pct')}
                          className={`px-1.5 py-0.5 rounded transition ${factor1Modo === 'pct' ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setFactor1Modo('val')}
                          className={`px-1.5 py-0.5 rounded transition ${factor1Modo === 'val' ? 'bg-primary-600 text-white' : 'text-slate-600'}`}
                        >
                          $
                        </button>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-semibold pr-6 py-1 px-2"
                        value={factor1Val}
                        onChange={(e) => setFactor1Val(e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1 text-[11px] font-bold text-slate-400">
                        {factor1Modo === 'pct' ? '%' : '$'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Monto: <b className="text-slate-700">+${fmt(factor1Monto)}</b></span>
                      <span className="font-semibold text-emerald-700">Subtotal 1: <b>${fmt(subtotal1)}</b></span>
                    </div>
                  </div>
                </div>

                {/* Fila 3: Ganancia y Factor 2 (Comisión) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* GANANCIA */}
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 grid place-items-center text-[9px] font-bold">3</span>
                        Ganancia (%)
                      </label>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Margen Comercial
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="99.99"
                        step="0.01"
                        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-semibold pr-6 py-1 px-2"
                        value={gananciaVal}
                        onChange={(e) => setGananciaVal(e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1 text-[11px] font-bold text-slate-400">%</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Monto: <b className="text-slate-700">+${fmt(gananciaMonto)}</b></span>
                      <span className="font-semibold text-emerald-700">Subtotal 2: <b>${fmt(subtotal2)}</b></span>
                    </div>
                  </div>

                  {/* COMISIÓN (%) */}
                  <div className="rounded-lg bg-white border border-slate-200 p-2.5 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[9px] font-bold">4</span>
                        Comisión (%)
                      </label>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                        % Comisión
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-xs font-semibold pr-6 py-1 px-2"
                        value={factor2Val}
                        onChange={(e) => setFactor2Val(e.target.value)}
                        placeholder="0.00"
                      />
                      <span className="absolute right-2 top-1 text-[11px] font-bold text-slate-400">%</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>Monto Comisión: <b className="text-slate-700">+${fmt(factor2Monto)}</b></span>
                      <span className="font-semibold text-emerald-700">PVP Calc.: <b>${fmt(pvpCalculado)}</b></span>
                    </div>
                  </div>
                </div>

                {/* Fila 4: PVP Final Unitario & Nuevo Código */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-bold text-slate-900 mb-1">PVP Final Unitario ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border-2 border-emerald-600 bg-white px-2.5 py-1.5 text-base font-black text-emerald-800 shadow-xs focus:border-emerald-700 focus:ring-emerald-700"
                      value={data.precio_compra_final}
                      onChange={handleFinalChange}
                      placeholder="0.00"
                      required
                    />
                  </div>

                  <div className="sm:col-span-7">
                    <label className="block text-xs font-bold text-primary-950 mb-1 flex items-center justify-between">
                      <span>Nuevo Código del Producto *</span>
                      <span className="text-[10px] font-mono text-slate-400">{data.nuevo_codigo.length}/50</span>
                    </label>
                    <input
                      type="text"
                      value={data.nuevo_codigo}
                      onChange={(e) => {
                        setData('nuevo_codigo', e.target.value);
                        setAutoSyncCodigo(false);
                      }}
                      placeholder="YY-productoId-proveedorId-INT-DEC"
                      maxLength={50}
                      className="w-full font-mono font-bold text-sm text-slate-900 px-2.5 py-1.5 rounded-lg border border-primary-400 focus:border-primary-600 focus:ring-primary-600 bg-white shadow-xs"
                      required
                    />
                  </div>
                </div>

                {/* Casilla de actualización de lote */}
                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none font-medium">
                    <input
                      type="checkbox"
                      checked={data.actualizar_lote}
                      onChange={(e) => setData('actualizar_lote', e.target.checked)}
                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Actualizar también el registro de compra/lote con este proveedor y precio</span>
                  </label>
                </div>
              </div>

              {/* Error si el código es idéntico */}
              {isSameCode && (
                <div className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 bg-rose-50 p-2 rounded-md border border-rose-200">
                  <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                  El nuevo código debe ser diferente al actual.
                </div>
              )}

              {/* Errores de validación backend */}
              {errors.nuevo_codigo && (
                <div className="text-xs text-rose-600 font-semibold p-2 bg-rose-50 rounded border border-rose-200">
                  {errors.nuevo_codigo}
                </div>
              )}

              {/* ALERTA DE RIESGO DE ETIQUETAS CONCISA Y DIRECTA */}
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 space-y-1.5 text-xs text-amber-950">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <FiAlertTriangle className="w-4 h-4 text-amber-600" />
                  Advertencia sobre Etiquetas Físicas Impresas
                </div>
                <p className="text-[11px] leading-tight text-amber-800">
                  Las etiquetas físicas ya impresas con el código anterior dejarán de funcionar en los lectores y deberán reimprimirse. Sus ventas pasadas e inventario permanecen 100% seguros.
                </p>
                <label className="flex items-start gap-2 pt-1 cursor-pointer select-none border-t border-amber-200/80 font-bold text-amber-950">
                  <input
                    type="checkbox"
                    checked={data.acepta_riesgo}
                    onChange={(e) => setData('acepta_riesgo', e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="text-[11px]">Comprendo que las etiquetas físicas perderán validez y acepto el riesgo.</span>
                </label>
                {errors.acepta_riesgo && (
                  <div className="text-[11px] text-rose-600 font-bold pl-5">{errors.acepta_riesgo}</div>
                )}
              </div>
            </div>

            {/* BOTONES FIJOS EN EL PIE DEL MODAL */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={processing}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={!canSubmit}
                className={[
                  'inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition',
                  canSubmit
                    ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300',
                ].join(' ')}
              >
                {processing ? (
                  <>
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="w-3.5 h-3.5" />
                    Aceptar Riesgo y Guardar
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </BaseModal>
    </AdminLayout>
  );
}
