import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from '@inertiajs/react';
import AutoComplete from '@/Components/AutoComplete';

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

  const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
    // IDs
    producto_id: initial?.producto_id ?? '',
    proveedor_id: initial?.proveedor_id ?? '',

    // proveedor (solo si "nuevo")
    proveedor: { nombre: '', ci_o_ruc: '', telefono: '' },

    // lote
    cantidad_compra: initial?.cantidad_compra ?? '',
    fecha_compra: initial?.fecha_compra ?? new Date().toISOString().slice(0, 10),

    // ⚠️ SIN ceros por defecto (todo en blanco)
    precio_compra: initial?.precio_compra ?? '',
    costo_general: initial?.costo_general ?? '',
    costo_transporte: initial?.costo_transporte ?? '',
    porcentaje_ganancia: initial?.porcentaje_ganancia ?? '',
    precio_compra_final: initial?.precio_compra_final ?? '',
  });

  /* ===========================
   * Modo Producto / Proveedor
   * =========================== */
  const [modoProducto, setModoProducto] = useState(initial?.producto_id ? 'existente' : 'existente');
  const [nuevoProductoNombre, setNuevoProductoNombre] = useState('');
  const [modoProveedor, setModoProveedor] = useState(initial?.proveedor_id ? 'existente' : 'existente');

  // Control de cálculo
  const [lastChanged, setLastChanged] = useState(null); // 'base'|'porcentaje'|'final'
  const justUpdatedRef = useRef(false);

  // ====== REFS ======
  const formRef = useRef(null);

  const refProdNuevo = useRef(null);
  const refProvNombre = useRef(null);
  const refProvCI = useRef(null);
  const refProvTel = useRef(null);

  const refCantidad = useRef(null);
  const refFecha = useRef(null);
  const refPrecio = useRef(null);
  const refGeneral = useRef(null);
  const refTransporte = useRef(null);
  const refPorcentaje = useRef(null);
  const refFinal = useRef(null);

  // Orden dinámico de enfoque según lo visible
  const orderedRefs = useMemo(() => {
    const arr = [];
    if (!isEdit && modoProducto === 'nuevo') arr.push({ key: 'prodNuevo', ref: refProdNuevo });
    if (modoProveedor === 'nuevo') {
      arr.push({ key: 'provNombre', ref: refProvNombre });
      arr.push({ key: 'provCI', ref: refProvCI });
      arr.push({ key: 'provTel', ref: refProvTel });
    }
    arr.push(
      { key: 'cantidad', ref: refCantidad },
      { key: 'fecha', ref: refFecha },
      { key: 'precio', ref: refPrecio },
      { key: 'general', ref: refGeneral },
      { key: 'transporte', ref: refTransporte },
      { key: 'porcentaje', ref: refPorcentaje },
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

  // Mapea el elemento activo a su key en orderedRefs
  function keyFromElement(el) {
    const idx = orderedRefs.findIndex(r => r.ref.current === el);
    return idx >= 0 ? orderedRefs[idx].key : null;
  }

  /** Captura global: las flechas SIEMPRE navegan entre campos visibles */
  function handleKeyDownCapture(e) {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;

    const el = e.target;
    const tag = el.tagName.toLowerCase();

    // Deja que textareas u otros widgets manejen sus flechas si prefieres
    if (tag === 'textarea') return;

    const key = keyFromElement(el);
    if (!key) return;

    // Evita el comportamiento nativo (spinners en number, calendario en date, mover cursor)
    e.preventDefault();

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      focusMove(key, +1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      focusMove(key, -1);
    }
  }

  useEffect(() => {
    // Reiniciar al cambiar de registro a editar
    setData({
      producto_id: initial?.producto_id ?? '',
      proveedor_id: initial?.proveedor_id ?? '',
      proveedor: { nombre: '', ci_o_ruc: '', telefono: '' },

      cantidad_compra: initial?.cantidad_compra ?? '',
      fecha_compra: initial?.fecha_compra ?? new Date().toISOString().slice(0, 10),

      precio_compra: initial?.precio_compra ?? '',
      costo_general: initial?.costo_general ?? '',
      costo_transporte: initial?.costo_transporte ?? '',
      porcentaje_ganancia: initial?.porcentaje_ganancia ?? '',
      precio_compra_final: initial?.precio_compra_final ?? '',
    });
    setModoProducto(initial?.producto_id ? 'existente' : 'existente');
    setModoProveedor(initial?.proveedor_id ? 'existente' : 'existente');
    setNuevoProductoNombre('');
    clearErrors();
    setLastChanged(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id]);

  /* ========== SOLO INFORMACIÓN: ÚLTIMA COMPRA ========== */
  const isCreateWithPreset = !isEdit && !!initial;
  const suggested = useMemo(() => {
    if (!isCreateWithPreset) return null;
    const prod = initial?.producto || null; // solo {codigo, nombre}
    return {
      producto: prod,
      fecha: initial?.fecha_compra ?? null,
    };
  }, [isCreateWithPreset, initial]);

  /* ========== Cálculos ========== */
  const cantidad = Number(data.cantidad_compra || 0);
  const precioUnitario = Number(data.precio_compra || 0);
  const pctGeneral = Number(data.costo_general || 0);
  const pctTransp  = Number(data.costo_transporte || 0);

  const addGeneralUnit = useMemo(() => (precioUnitario || 0) * (pctGeneral/100), [precioUnitario, pctGeneral]);
  const addTranspUnit  = useMemo(() => (precioUnitario || 0) * (pctTransp/100),  [precioUnitario, pctTransp]);

  const baseUnit = useMemo(() => {
    return (precioUnitario || 0) + addGeneralUnit + addTranspUnit;
  }, [precioUnitario, addGeneralUnit, addTranspUnit]);

  const porcentaje = data.porcentaje_ganancia === '' ? null : Number(data.porcentaje_ganancia);
  const finalUnitario = data.precio_compra_final === '' ? null : Number(data.precio_compra_final);

  useEffect(() => {
    if (justUpdatedRef.current) { justUpdatedRef.current = false; return; }

    if (lastChanged === 'base' || lastChanged === 'porcentaje') {
      if (baseUnit > 0 && porcentaje != null && !Number.isNaN(porcentaje)) {
        const nuevoFinal = +(baseUnit * (1 + (porcentaje / 100))).toFixed(2);
        const actualFinal = finalUnitario == null ? null : +Number(finalUnitario).toFixed(2);
        if (actualFinal === null || Math.abs(nuevoFinal - actualFinal) >= 0.01) {
          justUpdatedRef.current = true;
          setData('precio_compra_final', String(nuevoFinal));
        }
      }
    }

    if (lastChanged === 'final') {
      if (baseUnit > 0 && finalUnitario != null) {
        const nuevoPorc = +(((finalUnitario / baseUnit) - 1) * 100).toFixed(2);
        const actualPorc = porcentaje == null ? null : +Number(porcentaje).toFixed(2);
        if (actualPorc === null || Math.abs(nuevoPorc - actualPorc) >= 0.01) {
          justUpdatedRef.current = true;
          setData('porcentaje_ganancia', String(nuevoPorc));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUnit, porcentaje, finalUnitario, lastChanged]);

  const precioTotal = useMemo(() => {
    const cant = Number(data.cantidad_compra || 0);
    const unitFinal = Number(data.precio_compra_final || 0);
    return cant * unitFinal;
  }, [data.cantidad_compra, data.precio_compra_final]);

  /* Crear producto rápido por GET (sin CSRF) */
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
      setModoProducto('existente');
      setData('producto_id', String(nuevo.id));
      setNuevoProductoNombre('');
    } catch {
      alert('No se pudo crear el producto. Intenta con otro nombre.');
    }
  }

  /* Crear proveedor rápido por GET (sin CSRF) */
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
      setModoProveedor('existente');
      setData('proveedor_id', String(nuevo.id));
      setData('proveedor', { nombre: '', ci_o_ruc: '', telefono: '' });
    } catch {
      alert(errors?.proveedor || 'No se pudo crear el proveedor.');
    }
  }

  function submit(e) {
    e.preventDefault();
    const payload = {
      ...data,
      proveedor_id: (modoProveedor === 'existente') ? data.proveedor_id : null,
      proveedor:    (modoProveedor === 'nuevo')     ? data.proveedor    : null,
      base_unitario: +baseUnit.toFixed(4),
      costo_general_unit: +addGeneralUnit.toFixed(4),
      costo_transporte_unit: +addTranspUnit.toFixed(4),
    };
    const opts = { preserveScroll: true, onSuccess: () => { reset(); onSuccess?.(); } };
    // Nota: si quieres enviar "payload", usa post(url, payload, opts). Mantengo tu patrón original.
    if (isEdit) put(route('admin.compras.update', initial.id), opts);
    else post(route('admin.compras.store'), opts);
  }

  // defaultText para autocompletes (no autollenan, solo display)
  const defaultProdText = useMemo(() => {
    const p = productos.find(x => String(x.id) === String(data.producto_id)) ?? null;
    return fmtProdText(p);
  }, [productos, data.producto_id]);
  const defaultProvText = useMemo(() => {
    const p = proveedores.find(x => String(x.id) === String(data.proveedor_id)) ?? null;
    return fmtProvText(p);
  }, [proveedores, data.proveedor_id]);

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onKeyDownCapture={handleKeyDownCapture}
      className="space-y-6"
    >

      {/* ======= TARJETA INFORMATIVA: ÚLTIMA COMPRA ======= */}
      {isCreateWithPreset && suggested?.producto && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-amber-900">Último producto ingresado</h3>
                <Badge>informativo</Badge>
              </div>
              <div className="mt-2 text-sm text-amber-900/90 space-y-1">
                <div>
                  <span className="font-medium">Producto:</span>{' '}
                  {fmtProdText(suggested.producto) || '—'}
                </div>
                {initial?.producto?.codigo && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium">Código:</span>{' '}
                    <CodigoPretty codigo={initial.producto.codigo} />
                  </div>
                )}
                {suggested.fecha && (
                  <div>
                    <span className="font-medium">Fecha referencia:</span>{' '}
                    {fmtDateShort(suggested.fecha)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
              disabled={isEdit}
              searchRouteName="admin.productos.buscar"
              initialItems={productos}
              placeholder="Escribe para buscar producto por nombre o código"
              defaultText={defaultProdText}
              formatItem={(p) => fmtProdText(p)}
              onSelect={(p) => setData('producto_id', String(p.id))}
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
        </div>

        {modoProveedor === 'existente' ? (
          <div>
            <AutoComplete
              searchRouteName="admin.proveedores.buscar"
              initialItems={proveedores}
              placeholder="Escribe para buscar proveedor por nombre o CI/RUC"
              defaultText={defaultProvText}
              formatItem={(p) => fmtProvText(p)}
              onSelect={(p) => setData('proveedor_id', String(p.id))}
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

      {/* =================== DATOS DEL LOTE =================== */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad</label>
          <input
            ref={refCantidad}
            type="number"
            min="1"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.cantidad_compra}
            onChange={(e) => { setData('cantidad_compra', e.target.value); }}
            placeholder=""
            required
          />
          {errors.cantidad_compra && <p className="mt-1 text-sm text-secondary-600">{errors.cantidad_compra}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de compra</label>
          <input
            ref={refFecha}
            type="date"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.fecha_compra}
            onChange={(e) => setData('fecha_compra', e.target.value)}
            required
          />
          {errors.fecha_compra && <p className="mt-1 text-sm text-secondary-600">{errors.fecha_compra}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Precio compra</label>
          <input
            ref={refPrecio}
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.precio_compra}
            onChange={(e) => { setData('precio_compra', e.target.value); setLastChanged('base'); }}
            placeholder=""
            required
          />
          {errors.precio_compra && <p className="mt-1 text-sm text-secondary-600">{errors.precio_compra}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Costo general (%)</label>
          <input
            ref={refGeneral}
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.costo_general}
            onChange={(e) => { setData('costo_general', e.target.value); setLastChanged('base'); }}
            placeholder=""
            required
          />
          {errors.costo_general && <p className="mt-1 text-sm text-secondary-600">{errors.costo_general}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Transporte (%)</label>
          <input
            ref={refTransporte}
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.costo_transporte}
            onChange={(e) => { setData('costo_transporte', e.target.value); setLastChanged('base'); }}
            placeholder=""
            required
          />
          {errors.costo_transporte && <p className="mt-1 text-sm text-secondary-600">{errors.costo_transporte}</p>}
        </div>

        <div className="sm:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">% Ganancia</label>
          <input
            ref={refPorcentaje}
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.porcentaje_ganancia}
            onChange={(e) => { setData('porcentaje_ganancia', e.target.value); setLastChanged('porcentaje'); }}
            placeholder=""
            required
          />
          {errors.porcentaje_ganancia && <p className="mt-1 text-sm text-secondary-600">{errors.porcentaje_ganancia}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Precio final (unit.)</label>
          <input
            ref={refFinal}
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={data.precio_compra_final}
            onChange={(e) => { setData('precio_compra_final', e.target.value); setLastChanged('final'); }}
            placeholder=""
            required
          />
          {errors.precio_compra_final && <p className="mt-1 text-sm text-secondary-600">{errors.precio_compra_final}</p>}
        </div>

        <div className="sm:col-span-4">
          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Precio total (calculado):</div>
            <div className="text-lg font-semibold text-slate-900">$ {fmt(precioTotal)}</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
              <div>
                <div>Precio unit.: <b>$ {fmt(precioUnitario)}</b></div>
                <div>Costo general unit.: <b>$ {fmt(addGeneralUnit)}</b> ({fmt(pctGeneral)}%)</div>
              </div>
              <div>
                <div>Transporte unit.: <b>$ {fmt(addTranspUnit)}</b> ({fmt(pctTransp)}%)</div>
                <div>Base unit. (con %): <b>$ {fmt(baseUnit)}</b></div>
              </div>
              <div>
                <div>% Ganancia: <b>{data.porcentaje_ganancia || '—'}%</b></div>
                <div>Final unit.: <b>$ {fmt(data.precio_compra_final || 0)}</b></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={processing}
          className={[
            'px-3 py-2 rounded-md text-white',
            processing ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
          ].join(' ')}
        >
          {isEdit ? 'Guardar cambios' : 'Registrar compra'}
        </button>
      </div>
    </form>
  );
}
