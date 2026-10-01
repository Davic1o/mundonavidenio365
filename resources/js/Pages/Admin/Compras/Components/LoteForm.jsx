import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import AutoComplete from '@/Components/AutoComplete';
import useCan from '@/Hooks/useCan';

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
const fmtProdText = (p) => p ? `${p.nombre}${p.codigo ? ` — [${p.codigo}]` : ''}` : '';
const fmtProvText = (p) => p ? `${p.nombre}${p.ci_o_ruc ? ` — [${p.ci_o_ruc}]` : ''}` : '';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
      {children}
    </span>
  );
}

/** Render del código con el segundo bloque más grande y en negrita */
function CodigoPretty({ codigo }) {
  if (!codigo) return <span>—</span>;
  const parts = String(codigo).split('-');
  return (
    <span className="align-baseline">
      {parts.map((seg, i) => (
        <span key={i} className={i === 1 ? 'text-lg font-bold' : ''}>
          {seg}
          {i < parts.length - 1 ? <span className="px-1">-</span> : null}
        </span>
      ))}
    </span>
  );
}

export default function LoteForm({
  productos = [],
  proveedores = [],
  initial = null,
  onSuccess,
  onCancel,
}) {
  const isEdit = Boolean(initial?.id);
  const can = useCan();
  const canProveedores = can('compras.proveedores');

  const fCompraInit = initial?.fecha_compra
    ? String(initial.fecha_compra).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const { data, setData, post, put, transform, processing, errors, reset, clearErrors } = useForm({
    // IDs
    producto_id: initial?.producto_id ? String(initial.producto_id) : '',
    proveedor_id: initial?.proveedor_id ? String(initial.proveedor_id) : '',

    // proveedor (solo si "nuevo")
    proveedor: { nombre: '', ci_o_ruc: '', telefono: '' },

    // lote
    cantidad_compra: initial?.cantidad_compra != null ? String(initial.cantidad_compra) : '',
    fecha_compra: fCompraInit,

    precio_compra: initial?.precio_compra != null ? String(initial.precio_compra) : '',
    costo_general: initial?.costo_general != null ? String(initial.costo_general) : '',
    costo_transporte: initial?.costo_transporte != null ? String(initial.costo_transporte) : '',
    porcentaje_ganancia: initial?.porcentaje_ganancia != null ? String(initial.porcentaje_ganancia) : '',
    comision_pct: initial?.comision_pct != null ? String(initial.comision_pct) : '',
    precio_compra_final: initial?.precio_compra_final != null ? String(initial.precio_compra_final) : '',
  });

  /* ===========================
   * Modo Producto / Proveedor
   * =========================== */
  const [modoProducto, setModoProducto] = useState(initial?.producto_id ? 'existente' : 'existente');
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState('');
  const [modoProveedor, setModoProveedor] = useState(initial?.proveedor_id ? 'existente' : 'existente');

  /* ===========================
   * Estados de Gastos, Factor 1, Ganancia, Factor 2 (% / $)
   * =========================== */
  const [gastosModo, setGastosModo] = useState('pct'); // 'pct' | 'val'
  const [gastosVal, setGastosVal] = useState(initial?.costo_general != null ? String(initial.costo_general) : '');

  const [factor1Modo, setFactor1Modo] = useState('pct'); // 'pct' | 'val'
  const [factor1Val, setFactor1Val] = useState(initial?.costo_transporte != null ? String(initial.costo_transporte) : '');

  const [gananciaModo, setGananciaModo] = useState('pct'); // 'pct' | 'val'
  const [gananciaVal, setGananciaVal] = useState(initial?.porcentaje_ganancia != null ? String(initial.porcentaje_ganancia) : '');

  const [factor2Modo, setFactor2Modo] = useState('pct'); // 'pct'
  const [factor2Val, setFactor2Val] = useState(initial?.comision_pct != null ? String(initial.comision_pct) : '');

  const justUpdatedRef = useRef(false);

  // ====== REFS ======
  const formRef = useRef(null);

  const refProdExistente = useRef(null);
  const refProdNuevo = useRef(null);
  const refProvExistente = useRef(null);
  const refProvNombre = useRef(null);
  const refProvCI = useRef(null);
  const refProvTel = useRef(null);

  const refCantidad = useRef(null);
  const refFecha = useRef(null);
  const refPrecio = useRef(null);
  const refGastos = useRef(null);
  const refFactor1 = useRef(null);
  const refGanancia = useRef(null);
  const refFactor2 = useRef(null);
  const refFinal = useRef(null);

  function focusProveedor() {
    setTimeout(() => {
      if (modoProveedor === 'existente') {
        if (refProvExistente.current) {
          refProvExistente.current.focus();
          refProvExistente.current.select?.();
        }
      } else {
        if (refProvNombre.current) {
          refProvNombre.current.focus();
          refProvNombre.current.select?.();
        }
      }
    }, 50);
  }

  function focusCantidad() {
    setTimeout(() => {
      if (refCantidad.current) {
        refCantidad.current.focus();
        refCantidad.current.select?.();
      }
    }, 50);
  }

  // Orden dinámico de enfoque según lo visible
  const orderedRefs = useMemo(() => {
    const arr = [];
    if (!isEdit && modoProducto === 'existente') arr.push({ key: 'prodExistente', ref: refProdExistente });
    if (!isEdit && modoProducto === 'nuevo') arr.push({ key: 'prodNuevo', ref: refProdNuevo });
    if (modoProveedor === 'existente') arr.push({ key: 'provExistente', ref: refProvExistente });
    if (modoProveedor === 'nuevo') {
      arr.push({ key: 'provNombre', ref: refProvNombre });
      arr.push({ key: 'provCI', ref: refProvCI });
      arr.push({ key: 'provTel', ref: refProvTel });
    }
    arr.push(
      { key: 'cantidad', ref: refCantidad },
      { key: 'fecha', ref: refFecha },
      { key: 'precio', ref: refPrecio },
      { key: 'gastos', ref: refGastos },
      { key: 'factor1', ref: refFactor1 },
      { key: 'ganancia', ref: refGanancia },
      { key: 'factor2', ref: refFactor2 },
      { key: 'final', ref: refFinal },
    );
    return arr;
  }, [isEdit, modoProducto, modoProveedor]);

  function focusMove(fromKey, dir = 1) {
    const idx = orderedRefs.findIndex(r => r.key === fromKey);
    if (idx < 0) return;
    let next = idx;
    for (let i = 1; i <= orderedRefs.length; i++) {
      next = (idx + dir * i + orderedRefs.length) % orderedRefs.length;
      const el = orderedRefs[next]?.ref?.current;
      if (el && el.offsetParent !== null) { // visible
        el.focus();
        el.select?.();
        break;
      }
    }
  }

  function keyFromElement(el) {
    const idx = orderedRefs.findIndex(r => r.ref?.current === el);
    return idx >= 0 ? orderedRefs[idx].key : null;
  }

  /** Captura global: las flechas SIEMPRE navegan entre campos visibles */
  function handleKeyDownCapture(e) {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

    const el = e.target;
    const tag = el.tagName.toLowerCase();

    // Deja que textareas y autocompletes manejen sus propias flechas
    if (tag === 'textarea') return;
    if (el?.closest?.('[data-autocomplete]')) return;

    const key = keyFromElement(el);
    if (!key) return;

    e.preventDefault();

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      focusMove(key, +1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      focusMove(key, -1);
    }
  }

  useEffect(() => {
    if (!initial) return;

    const fCompra = initial.fecha_compra
      ? String(initial.fecha_compra).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    setData({
      producto_id: initial.producto_id ? String(initial.producto_id) : '',
      proveedor_id: initial.proveedor_id ? String(initial.proveedor_id) : '',
      proveedor: { nombre: '', ci_o_ruc: '', telefono: '' },

      cantidad_compra: initial.cantidad_compra != null ? String(initial.cantidad_compra) : '',
      fecha_compra: fCompra,

      precio_compra: initial.precio_compra != null ? String(initial.precio_compra) : '',
      costo_general: initial.costo_general != null ? String(initial.costo_general) : '',
      costo_transporte: initial.costo_transporte != null ? String(initial.costo_transporte) : '',
      porcentaje_ganancia: initial.porcentaje_ganancia != null ? String(initial.porcentaje_ganancia) : '',
      comision_pct: initial.comision_pct != null ? String(initial.comision_pct) : '',
      precio_compra_final: initial.precio_compra_final != null ? String(initial.precio_compra_final) : '',
    });

    setModoProducto(initial.producto_id ? 'existente' : 'existente');
    setModoProveedor(initial.proveedor_id ? 'existente' : 'existente');
    setNuevoProductoNombre('');
    setGastosVal(initial.costo_general != null ? String(initial.costo_general) : '');
    setFactor1Val(initial.costo_transporte != null ? String(initial.costo_transporte) : '');
    setGananciaVal(initial.porcentaje_ganancia != null ? String(initial.porcentaje_ganancia) : '');
    setFactor2Val(initial.comision_pct != null ? String(initial.comision_pct) : '');
    clearErrors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  /* ========== CÁLCULOS MATEMÁTICOS ========== */
  const cantNum = Number(data.cantidad_compra || 0);
  const precioCompraBase = Number(data.precio_compra || 0);

  // 1. GASTOS
  const gValNum = Number(gastosVal || 0);
  const gastosMonto = gastosModo === 'pct' ? precioCompraBase * (gValNum / 100) : gValNum;
  const gastosPctEquiv = precioCompraBase > 0 ? (gastosMonto / precioCompraBase) * 100 : 0;
  const costoTotalProducto = precioCompraBase + gastosMonto;

  // 2. FACTOR 1
  const f1ValNum = Number(factor1Val || 0);
  const factor1Monto = factor1Modo === 'pct' ? costoTotalProducto * (f1ValNum / 100) : f1ValNum;
  const factor1PctEquiv = costoTotalProducto > 0 ? (factor1Monto / costoTotalProducto) * 100 : 0;
  const subtotal1 = costoTotalProducto + factor1Monto;

  // 3. GANANCIA (%) - Fórmula Comercial Estándar: Subtotal 2 = Subtotal 1 / (1 - (Ganancia% / 100))
  const ganValNum = Number(gananciaVal || 0);
  const gananciaPctClamped = Math.min(99.99, Math.max(0, ganValNum));
  const factorMargen = (100 - gananciaPctClamped) / 100;
  const subtotal2 = (subtotal1 > 0 && factorMargen > 0) ? (subtotal1 / factorMargen) : subtotal1;
  const gananciaMonto = subtotal2 - subtotal1;
  const gananciaPctEquiv = ganValNum;

  // 4. IVA (%)
  const f2ValNum = Number(factor2Val || 0);
  const factor2Monto = subtotal2 * (f2ValNum / 100);
  const factor2PctEquiv = f2ValNum;

  // 5. PVP FINAL
  const pvpCalculado = subtotal2 + factor2Monto;

  useEffect(() => {
    if (justUpdatedRef.current) {
      justUpdatedRef.current = false;
      return;
    }
    if (pvpCalculado > 0) {
      const calcStr = pvpCalculado.toFixed(2);
      if (data.precio_compra_final !== calcStr) {
        setData('precio_compra_final', calcStr);
      }
    }
  }, [precioCompraBase, gastosVal, gastosModo, factor1Val, factor1Modo, gananciaVal, factor2Val, factor2Modo]);

  /* ========== PRECÁLCULO CÓDIGO ETIQUETA (NORMATIVA BACKEND YY-ProdID-ProvID-INT-DEC) ==========
   * Base Etiqueta = (Precio Compra + Gastos + Factor 1) * (1 + IVA%/100)
   */
  const valorEtiquetaBase = useMemo(() => {
    const ivaPct = Number(factor2Val || 0); // factor2Val representa %IVA
    const baseMasGastosFactor1 = subtotal1; // (precio_compra + gastos + factor1)
    return baseMasGastosFactor1 * (1 + (ivaPct / 100));
  }, [subtotal1, factor2Val]);

  const codigoEtiquetaProyectado = useMemo(() => {
    // Si estamos editando, el código del producto es fijo y no cambia
    if (isEdit && initial?.producto?.codigo) {
      return initial.producto.codigo;
    }

    const fStr = data.fecha_compra || new Date().toISOString().slice(0, 10);
    const d = new Date(fStr + 'T00:00:00');
    const fullYear = !isNaN(d.getFullYear()) ? d.getFullYear() : new Date().getFullYear();
    const yy = String(fullYear).slice(-2);

    const pId = data.producto_id || (modoProducto === 'nuevo' ? 'NUEVO' : '?');
    const provId = data.proveedor_id || (modoProveedor === 'nuevo' ? 'NUEVO' : '?');

    const totalRedondeado = Math.round((valorEtiquetaBase || 0) * 100) / 100;
    const entero = Math.floor(totalRedondeado);
    const decVal = Math.round((totalRedondeado - entero) * 100);
    const decStr = String(decVal).padStart(2, '0');

    return `${yy}-${pId}-${provId}-${entero}-${decStr}`;
  }, [data.fecha_compra, data.producto_id, modoProducto, data.proveedor_id, modoProveedor, valorEtiquetaBase, isEdit, initial]);

  function handleFinalChange(e) {
    const val = e.target.value;
    setData('precio_compra_final', val);
    justUpdatedRef.current = true;
    const finalNum = Number(val || 0);
    const targetSub2 = finalNum - factor2Monto;
    if (targetSub2 > 0 && subtotal1 > 0) {
      // Fórmula inversa comercial: Ganancia% = (1 - (Subtotal 1 / Subtotal 2)) * 100
      const porc = ((1 - (subtotal1 / targetSub2)) * 100).toFixed(2);
      setGananciaVal(porc);
    }
  }

  /* Crear producto rápido por GET */
  async function crearProductoRapido() {
    const nombre = (nuevoProductoNombre || '').trim().toUpperCase();
    if (!nombre) { alert('Ingresa el nombre del producto.'); return; }
    const params = new URLSearchParams({ nombre });
    try {
      const resp = await fetch(`${route('admin.productos.crear')}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) throw new Error('Error al crear producto');
      const nuevo = await resp.json();
      setLocalProductos(prev => [...prev, nuevo]);
      setModoProducto('existente');
      setData('producto_id', String(nuevo.id));
      setNuevoProductoNombre('');
      focusProveedor();
    } catch {
      alert('No se pudo crear el producto. Intenta con otro nombre.');
    }
  }

  /* Crear proveedor rápido por GET */
  async function crearProveedorRapido() {
    const payload = {
      nombre: data.proveedor?.nombre || '',
      ci_o_ruc: data.proveedor?.ci_o_ruc || '',
      telefono: data.proveedor?.telefono || '',
    };
    if (!payload.nombre || !payload.ci_o_ruc) {
      alert('Ingresa al menos Nombre y CI/RUC para crear el proveedor.');
      return;
    }
    const params = new URLSearchParams({
      nombre: payload.nombre,
      ci_o_ruc: payload.ci_o_ruc,
      ...(payload.telefono ? { telefono: payload.telefono } : {}),
    });
    try {
      const resp = await fetch(`${route('admin.proveedores.crear')}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) throw new Error('Error al crear proveedor');
      const nuevo = await resp.json();
      setLocalProveedores(prev => [...prev, nuevo]);
      setModoProveedor('existente');
      setData('proveedor_id', String(nuevo.id));
      setData('proveedor', { nombre: '', ci_o_ruc: '', telefono: '' });
      focusCantidad();
    } catch {
      alert(errors?.proveedor || 'No se pudo crear el proveedor.');
    }
  }

  function submit(e) {
    e.preventDefault();
    const finalVal = Number(data.precio_compra_final || pvpCalculado.toFixed(2));

    transform((currentData) => ({
      ...currentData,
      producto_id:         (modoProducto === 'existente')  ? (currentData.producto_id || null) : null,
      producto_nombre:     (modoProducto === 'nuevo')      ? (nuevoProductoNombre || '').trim().toUpperCase() : null,
      proveedor_id:        (modoProveedor === 'existente') ? (currentData.proveedor_id || null) : null,
      proveedor:           (modoProveedor === 'nuevo')     ? currentData.proveedor : null,
      valor_base_etiqueta: +(valorEtiquetaBase || 0).toFixed(4),
      costo_general:       +gastosPctEquiv.toFixed(2),
      costo_transporte:    +factor1PctEquiv.toFixed(2),
      porcentaje_ganancia: +gananciaPctEquiv.toFixed(2),
      comision_pct:        +factor2PctEquiv.toFixed(2),
      precio_compra_final: finalVal,
      base_unitario:       +costoTotalProducto.toFixed(4),
      costo_general_unit:  +gastosMonto.toFixed(4),
      costo_transporte_unit: +factor1Monto.toFixed(4),
    }));

    const opts = { preserveScroll: true, onSuccess: () => { reset(); onSuccess?.(); } };
    if (isEdit) put(route('admin.compras.update', initial.id), opts);
    else post(route('admin.compras.store'), opts);
  }

  const [localProductos, setLocalProductos] = useState(productos);
  const [localProveedores, setLocalProveedores] = useState(proveedores);

  useEffect(() => setLocalProductos(productos), [productos]);
  useEffect(() => setLocalProveedores(proveedores), [proveedores]);

  const defaultProdText = useMemo(() => {
    if (!data.producto_id) return '';
    if (isEdit && initial?.producto && String(initial.producto.id) === String(data.producto_id)) {
      return fmtProdText(initial.producto);
    }
    let p = localProductos.find(x => String(x.id) === String(data.producto_id)) ?? null;
    return fmtProdText(p);
  }, [localProductos, data.producto_id, isEdit, initial]);
  
  const defaultProvText = useMemo(() => {
    if (!data.proveedor_id) return '';
    if (isEdit && initial?.proveedor && String(initial.proveedor.id) === String(data.proveedor_id)) {
      return fmtProvText(initial.proveedor);
    }
    let p = localProveedores.find(x => String(x.id) === String(data.proveedor_id)) ?? null;
    return fmtProvText(p);
  }, [localProveedores, data.proveedor_id, isEdit, initial]);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onKeyDownCapture={handleKeyDownCapture}
      className="space-y-6"
    >

      {/* =================== PRODUCTO =================== */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm font-medium text-slate-700">Producto</span>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              className="rounded border-slate-300"
              checked={modoProducto === 'existente'}
              onChange={() => setModoProducto('existente')}
              disabled={isEdit}
            />
            Existente
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              className="rounded border-slate-300"
              checked={modoProducto === 'nuevo'}
              onChange={() => setModoProducto('nuevo')}
              disabled={isEdit}
            />
            Nuevo
          </label>
        </div>

        {modoProducto === 'existente' ? (
          <div>
            <AutoComplete
              inputRef={refProdExistente}
              disabled={isEdit}
              searchRouteName="admin.productos.buscar"
              initialItems={localProductos}
              placeholder="Escribe para buscar producto por nombre o código"
              defaultText={defaultProdText}
              formatItem={(p) => fmtProdText(p)}
              onSelect={(p) => {
                setData('producto_id', String(p.id));
                focusProveedor();
              }}
              onEnterKey={() => {
                focusProveedor();
              }}
            />
            {errors.producto_id && <p className="mt-1 text-sm text-secondary-600">{errors.producto_id}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del producto</label>
              <input
                ref={refProdNuevo}
                type="text"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                value={nuevoProductoNombre}
                onChange={(e) => setNuevoProductoNombre(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    crearProductoRapido();
                  }
                }}
                placeholder="Ej. Avena 1kg"
                disabled={isEdit}
                required
              />
            </div>
            <div className="sm:col-span-1 flex items-end">
              <button
                type="button"
                onClick={crearProductoRapido}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
                disabled={isEdit}
              >
                Crear y seleccionar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================== PROVEEDOR =================== */}
      <div>
        <div className="flex items-center gap-4 mb-2">
          <span className="text-sm font-medium text-slate-700">Proveedor</span>
          {canProveedores && (
            <>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="rounded border-slate-300"
                  checked={modoProveedor === 'existente'}
                  onChange={() => { setModoProveedor('existente'); setData('proveedor', { nombre:'', ci_o_ruc:'', telefono:'' }); }}
                />
                Existente
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  className="rounded border-slate-300"
                  checked={modoProveedor === 'nuevo'}
                  onChange={() => { setModoProveedor('nuevo'); setData('proveedor_id', ''); }}
                />
                Nuevo
              </label>
            </>
          )}
        </div>

        {modoProveedor === 'existente' ? (
          <div>
            <AutoComplete
              inputRef={refProvExistente}
              searchRouteName="admin.proveedores.buscar"
              initialItems={localProveedores}
              placeholder="Escribe para buscar proveedor por nombre o CI/RUC"
              defaultText={defaultProvText}
              formatItem={(p) => fmtProvText(p)}
              onSelect={(p) => {
                setData('proveedor_id', String(p.id));
                focusCantidad();
              }}
              onEnterKey={() => {
                focusCantidad();
              }}
            />
            {errors.proveedor_id && <p className="mt-1 text-sm text-secondary-600">{errors.proveedor_id}</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre</label>
              <input
                ref={refProvNombre}
                type="text"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                value={data.proveedor?.nombre ?? ''}
                onChange={(e) => setData('proveedor', { ...(data.proveedor||{}), nombre: e.target.value })}
                placeholder="Nombre del proveedor"
                required
              />
              {errors['proveedor.nombre'] && <p className="mt-1 text-sm text-secondary-600">{errors['proveedor.nombre']}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CI o RUC</label>
              <input
                ref={refProvCI}
                type="text"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                value={data.proveedor?.ci_o_ruc ?? ''}
                onChange={(e) => setData('proveedor', { ...(data.proveedor||{}), ci_o_ruc: e.target.value })}
                placeholder="Ej. 1712345678"
                required
              />
              {errors['proveedor.ci_o_ruc'] && <p className="mt-1 text-sm text-secondary-600">{errors['proveedor.ci_o_ruc']}</p>}
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Teléfono (opcional)</label>
              <input
                ref={refProvTel}
                type="text"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                value={data.proveedor?.telefono ?? ''}
                onChange={(e) => setData('proveedor', { ...(data.proveedor||{}), telefono: e.target.value })}
                placeholder="0987654321"
              />
              {errors['proveedor.telefono'] && <p className="mt-1 text-sm text-secondary-600">{errors['proveedor.telefono']}</p>}
            </div>

            <div className="sm:col-span-3 flex items-center justify-end">
              <button
                type="button"
                onClick={crearProveedorRapido}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-white bg-emerald-600 hover:bg-emerald-700"
              >
                Crear y seleccionar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =================== CÁLCULO FINANCIERO Y VALORES =================== */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span className="text-base">📊</span> Desglose de Costos, Comisión y PVP
          </h3>
          <span className="text-xs font-medium text-slate-500">Cálculo dinámico en tiempo real</span>
        </div>

        {/* TARJETA VISUAL: CÓDIGO DE ETIQUETA PROYECTADO (NORMATIVA BACKEND) */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm">🏷️</span>
              <h4 className="text-xs font-extrabold text-indigo-950 uppercase tracking-wide">Código de Etiqueta (Previsualización)</h4>
              <Badge>normativa backend</Badge>
            </div>
            <p className="text-[11px] text-indigo-900/80 mt-1 font-medium">
              Base Etiqueta: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 text-indigo-900 font-bold">(Precio Compra + Gastos + Factor 1) × (1 + %Comisión) = ${fmt(valorEtiquetaBase)}</code>
            </p>
          </div>
          <div className="bg-white border border-indigo-200 rounded-xl px-4 py-2 text-center shadow-xs min-w-[170px]">
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-500 block">Etiqueta Producto</span>
            <span className="text-xl font-mono font-black text-indigo-950 tracking-tight">
              <CodigoPretty codigo={codigoEtiquetaProyectado} />
            </span>
          </div>
        </div>

        {/* Fila 1: Cantidad, Fecha de Compra, Precio de Compra */}
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cantidad</label>
            <input
              ref={refCantidad}
              type="number"
              min="1"
              className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 font-semibold"
              value={data.cantidad_compra}
              onChange={(e) => setData('cantidad_compra', e.target.value)}
              placeholder="1"
              required
            />
            {errors.cantidad_compra && <p className="mt-1 text-xs text-secondary-600">{errors.cantidad_compra}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Fecha de compra</label>
            <input
              ref={refFecha}
              type="date"
              className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              value={data.fecha_compra}
              onChange={(e) => setData('fecha_compra', e.target.value)}
              required
            />
            {errors.fecha_compra && <p className="mt-1 text-xs text-secondary-600">{errors.fecha_compra}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Precio de Compra ($)</label>
            <input
              ref={refPrecio}
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 font-bold text-slate-900"
              value={data.precio_compra}
              onChange={(e) => setData('precio_compra', e.target.value)}
              placeholder="0.00"
              required
            />
            {errors.precio_compra && <p className="mt-1 text-xs text-secondary-600">{errors.precio_compra}</p>}
          </div>
        </div>

        {/* Fila 2: Gastos y Factor 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* GASTOS */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[10px]">1</span>
                Gastos
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setGastosModo('pct')}
                  className={`px-2.5 py-0.5 rounded-md transition ${gastosModo === 'pct' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setGastosModo('val')}
                  className={`px-2.5 py-0.5 rounded-md transition ${gastosModo === 'val' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  $
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                ref={refGastos}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-semibold pr-8"
                value={gastosVal}
                onChange={(e) => setGastosVal(e.target.value)}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                {gastosModo === 'pct' ? '%' : '$'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span>Monto: <b className="text-slate-800">+${fmt(gastosMonto)}</b></span>
              <span className="font-semibold text-emerald-700">Costo Total Prod.: <b>${fmt(costoTotalProducto)}</b></span>
            </div>
          </div>

          {/* FACTOR 1 */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[10px]">2</span>
                Factor 1
              </label>
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFactor1Modo('pct')}
                  className={`px-2.5 py-0.5 rounded-md transition ${factor1Modo === 'pct' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setFactor1Modo('val')}
                  className={`px-2.5 py-0.5 rounded-md transition ${factor1Modo === 'val' ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  $
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                ref={refFactor1}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-semibold pr-8"
                value={factor1Val}
                onChange={(e) => setFactor1Val(e.target.value)}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                {factor1Modo === 'pct' ? '%' : '$'}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span>Monto: <b className="text-slate-800">+${fmt(factor1Monto)}</b></span>
              <span className="font-semibold text-emerald-700">Subtotal 1: <b>${fmt(subtotal1)}</b></span>
            </div>
          </div>
        </div>

        {/* Fila 3: Ganancia y Factor 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* GANANCIA */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 grid place-items-center text-[10px]">3</span>
                Ganancia (%)
              </label>
              <span className="inline-flex rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-700 border border-emerald-200">
                % Margen Comercial
              </span>
            </div>
            <div className="relative">
              <input
                ref={refGanancia}
                type="number"
                min="0"
                max="99.99"
                step="0.01"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-semibold pr-8"
                value={gananciaVal}
                onChange={(e) => setGananciaVal(e.target.value)}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span>Monto: <b className="text-slate-800">+${fmt(gananciaMonto)}</b></span>
              <span className="font-semibold text-emerald-700">Subtotal 2: <b>${fmt(subtotal2)}</b></span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Fórmula: Subtotal 1 / (1 - %Ganancia)</p>
          </div>

          {/* COMISIÓN (%) */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 grid place-items-center text-[10px]">4</span>
                Comisión (%)
              </label>
              <span className="inline-flex rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-extrabold text-sky-700 border border-sky-200">
                % Comisión
              </span>
            </div>
            <div className="relative">
              <input
                ref={refFactor2}
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm font-semibold pr-8"
                value={factor2Val}
                onChange={(e) => setFactor2Val(e.target.value)}
                placeholder="Ej. 5"
              />
              <span className="absolute right-3 top-2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span>Monto Comisión: <b className="text-slate-800">+${fmt(factor2Monto)}</b></span>
              <span className="font-semibold text-emerald-700">PVP Calculado: <b>${fmt(pvpCalculado)}</b></span>
            </div>
          </div>
        </div>

        {/* Fila 4: PVP Final Unitario & Total Compra */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-900 mb-1 uppercase tracking-wide">PVP Final Unitario ($)</label>
            <input
              ref={refFinal}
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-xl border-2 border-emerald-600 bg-white px-3 py-2 text-xl font-black text-emerald-800 shadow-sm focus:border-emerald-700 focus:ring-emerald-700"
              value={data.precio_compra_final}
              onChange={handleFinalChange}
              placeholder="0.00"
              required
            />
            {errors.precio_compra_final && <p className="mt-1 text-xs text-secondary-600">{errors.precio_compra_final}</p>}
          </div>

          <div className="rounded-xl bg-gradient-to-r from-emerald-950 to-slate-950 text-white p-4 flex flex-col justify-center shadow-lg border border-emerald-900/30">
            <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Total Inversión / Compra</span>
            <div className="text-2xl font-black text-white">${fmt((cantNum > 0 ? cantNum : 1) * Number(data.precio_compra_final || pvpCalculado))}</div>
            <span className="text-[11px] text-emerald-300 font-medium mt-0.5">
              {cantNum || 1} {cantNum === 1 ? 'unidad' : 'unidades'} x ${fmt(data.precio_compra_final || pvpCalculado)} c/u
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={processing}
          className={[
            'px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md transition',
            processing ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-700 hover:bg-emerald-800 hover:shadow-lg'
          ].join(' ')}
        >
          {isEdit ? 'Guardar cambios' : 'Registrar compra'}
        </button>
      </div>
    </form>
  );
}
