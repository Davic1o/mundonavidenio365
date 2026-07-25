import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';

/* ================== Medidas del Modal (edítalas a tu gusto) ================== */
const MODAL_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
  xl: 'xl',
  '2xl': '2xl',
  '3xl': '3xl',
  '4xl': '4xl',
  full: 'full', // por si tu Modal soporta pantalla completa
};

/* ================== Helpers ================== */
const money = (n) =>
  new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    .format(Number(n || 0));
const to2 = (n) => Number(Number(n || 0).toFixed(2));

async function apiGET(url, params = {}) {
  const usp = new URLSearchParams(params);
  const resp = await fetch(`${url}?${usp.toString()}`, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error('Error de red');
  return await resp.json();
}

export default function VentaForm({ initial = null, onSuccess, onCancel }) {
  const isEdit = Boolean(initial?.id);

  /* ================== Estado principal ================== */
  const form = useForm({
    // Cliente
    cliente_id: initial?.cliente_id ?? '',
    cliente_label: initial?.cliente
      ? `${initial.cliente.nombres}${initial.cliente.ci_o_ruc ? ' — [' + initial.cliente.ci_o_ruc + ']' : ''}`
      : '',

    // Venta
    fecha: initial?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    estado: initial?.estado ?? 'emitida',

    // Detalle
    items:
      initial?.productosVendidos?.map((vp) => ({
        producto_id: String(vp.producto_id ?? ''),
        label: vp.producto?.nombre || `#${vp.producto_id}`,
        cantidad: String(vp.cantidad ?? 1),
        precio: String(vp.precio ?? 0),
        descuento: String(vp.descuento ?? 0),
        iva: vp?.producto?.iva === 0 ? 0 : 15,
        stock: vp.producto?.cantidad_total ?? null,
        codigo: vp.producto?.codigo ?? '',
      })) ?? [
        { producto_id: '', label: '', cantidad: '1', precio: '0', descuento: '0', iva: 15, stock: null, codigo: '' },
      ],

    // Pagos
    pagos:
      initial?.pagos?.map((p) => ({
        codigo: p.codigo || '',
        nombre: p.nombre || '',
        valor: String(p.valor || 0),
      })) ?? [{ codigo: 'EFE', nombre: 'Efectivo', valor: '0' }],

    // Tarjeta (opcional)
    tarjeta: initial?.tarjetas?.[0]
      ? {
          monto: String(initial.tarjetas[0].monto ?? 0),
          comision: String(initial.tarjetas[0].comision ?? 0),
          tipo_tarjeta: initial.tarjetas[0].tipo_tarjeta ?? '',
          plazo: String(initial.tarjetas[0].plazo ?? 0),
        }
      : null,
  });

  /* ================== Totales (base0/base15) ================== */
  const base0 = useMemo(
    () =>
      form.data.items.reduce(
        (a, it) => a + (Number(it.iva) === 0 ? to2((+it.cantidad || 0) * (+it.precio || 0) - (+it.descuento || 0)) : 0),
        0
      ),
    [form.data.items]
  );
  const base15 = useMemo(
    () =>
      form.data.items.reduce(
        (a, it) =>
          a + (Number(it.iva) === 15 ? to2((+it.cantidad || 0) * (+it.precio || 0) - (+it.descuento || 0)) : 0),
        0
      ),
    [form.data.items]
  );
  const subtotal = useMemo(() => to2(base0 + base15), [base0, base15]);
  const iva15 = useMemo(() => to2(base15 * 0.15), [base15]);
  const total = useMemo(() => to2(subtotal + iva15), [subtotal, iva15]);

  const sumPagos = useMemo(
    () => to2((form.data.pagos || []).reduce((a, p) => a + (+p.valor || 0), 0)),
    [form.data.pagos]
  );

  const pagosOk = Math.abs(sumPagos - total) < 0.01;
  const itemsOk = form.data.items.every(
    (it) => it.producto_id && +it.cantidad > 0 && +it.precio >= 0 && +it.descuento >= 0
  );
  const canSubmit = pagosOk && itemsOk && form.data.cliente_id;

  // Autollenar Efectivo si hay 1 solo pago
  useEffect(() => {
    if (isEdit) return;
    if (
      form.data.pagos.length === 1 &&
      (form.data.pagos[0].nombre || '').toLowerCase().includes('efect')
    ) {
      form.setData('pagos', [{ ...form.data.pagos[0], valor: String(to2(total)) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Mostrar/ocultar bloque tarjeta según pagos
  useEffect(() => {
    const idxTar = form.data.pagos.findIndex(
      (p) => (p.codigo || '').toUpperCase() === 'TAR' || (p.nombre || '').toLowerCase().includes('tarjeta')
    );
    if (idxTar >= 0) {
      const monto = String(form.data.pagos[idxTar].valor || '0');
      form.setData('tarjeta', {
        monto,
        comision: form.data.tarjeta?.comision || '0',
        tipo_tarjeta: form.data.tarjeta?.tipo_tarjeta || '',
        plazo: form.data.tarjeta?.plazo || '0',
      });
    } else {
      form.setData('tarjeta', null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form.data.pagos)]);

  /* ================== Modales: estado y lógica ================== */
  // Clientes
  const [cliOpen, setCliOpen] = useState(false);
  const [cliTerm, setCliTerm] = useState('');
  const [cliLoading, setCliLoading] = useState(false);
  const [cliResults, setCliResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = cliTerm.trim();
      if (!q) {
        setCliResults([]);
        return;
      }
      try {
        setCliLoading(true);
        const data = await apiGET(route('ventas.clientes.buscar'), { q });
        setCliResults(Array.isArray(data) ? data : []);
      } catch (e) {
        setCliResults([]);
      } finally {
        setCliLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cliTerm]);

  async function quickCreateCliente(payload) {
    return await apiGET(route('ventas.clientes.crear'), payload);
  }
  async function quickEditCliente(id, payload) {
    return await apiGET(route('ventas.clientes.editar'), { id, ...payload });
  }

  // Productos
  const [prdOpen, setPrdOpen] = useState(false);
  const [prdIdx, setPrdIdx] = useState(null); // fila en edición
  const [prdTerm, setPrdTerm] = useState('');
  const [prdLoading, setPrdLoading] = useState(false);
  const [prdResults, setPrdResults] = useState([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = prdTerm.trim();
      if (!q) {
        setPrdResults([]);
        return;
      }
      try {
        setPrdLoading(true);
        const data = await apiGET(route('ventas.productos.buscar'), { q });
        setPrdResults(Array.isArray(data) ? data : []);
      } catch (e) {
        setPrdResults([]);
      } finally {
        setPrdLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [prdTerm]);

  /* ================== Helpers items/pagos ================== */
  function setItem(i, patch) {
    const arr = [...form.data.items];
    arr[i] = { ...arr[i], ...patch };
    form.setData('items', arr);
  }
  function addItem() {
    form.setData('items', [
      ...form.data.items,
      { producto_id: '', label: '', cantidad: '1', precio: '0', descuento: '0', iva: 15, stock: null, codigo: '' },
    ]);
  }
  function removeItem(i) {
    const arr = [...form.data.items];
    arr.splice(i, 1);
    form.setData(
      'items',
      arr.length
        ? arr
        : [{ producto_id: '', label: '', cantidad: '1', precio: '0', descuento: '0', iva: 15, stock: null, codigo: '' }]
    );
  }
  function setPago(i, patch) {
    const arr = [...form.data.pagos];
    arr[i] = { ...arr[i], ...patch };
    form.setData('pagos', arr);
  }
  function addPago() {
    form.setData('pagos', [...form.data.pagos, { codigo: '', nombre: '', valor: '0' }]);
  }
  function removePago(i) {
    const arr = [...form.data.pagos];
    arr.splice(i, 1);
    form.setData(
      'pagos',
      arr.length
        ? arr
        : [{ codigo: 'EFE', nombre: 'Efectivo', valor: String(to2(total)) }]
    );
  }

  /* ================== Submit ================== */
  function onSubmit(e) {
    e.preventDefault();

    const payload = {
      cliente_id: form.data.cliente_id,
      fecha: form.data.fecha,
      estado: form.data.estado,
      items: form.data.items.map((it) => ({
        producto_id: Number(it.producto_id),
        cantidad: Number(it.cantidad),
        precio: Number(it.precio),
        descuento: Number(it.descuento || 0),
        iva: Number(it.iva),
      })),
      pagos: form.data.pagos.map((p) => ({
        codigo: p.codigo || null,
        nombre: p.nombre || '',
        valor: Number(p.valor || 0),
      })),
      tarjeta: form.data.tarjeta
        ? {
            monto: Number(form.data.tarjeta.monto || 0),
            comision: Number(form.data.tarjeta.comision || 0),
            tipo_tarjeta: form.data.tarjeta.tipo_tarjeta || null,
            plazo: Number(form.data.tarjeta.plazo || 0),
          }
        : null,
    };

    form.transform(() => payload);

    if (isEdit) {
      form.put(route('ventas.ventas.update', initial.id), {
        preserveScroll: true,
        onSuccess: () => onSuccess?.(),
      });
    } else {
      form.post(route('ventas.ventas.store'), {
        preserveScroll: true,
        onSuccess: () => onSuccess?.(),
      });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ===== Cliente + Fecha ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              placeholder="Selecciona cliente..."
              value={form.data.cliente_label || ''}
              readOnly
            />
            <button
              type="button"
              onClick={() => {
                setCliOpen(true);
                setCliTerm('');
                setCliResults([]);
              }}
              className="px-3 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
            >
              Buscar
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {form.data.cliente_id ? 'Cliente seleccionado' : 'Sin cliente seleccionado'}
          </p>
          {form.errors?.cliente_id && <p className="text-xs text-red-600 mt-1">{form.errors.cliente_id}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
          <input
            type="date"
            className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
            value={form.data.fecha}
            onChange={(e) => form.setData('fecha', e.target.value)}
          />
          {form.errors?.fecha && <p className="text-xs text-red-600 mt-1">{form.errors.fecha}</p>}
        </div>
      </div>

      {/* ===== Productos ===== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Productos</span>
          <button
            type="button"
            onClick={addItem}
            className="px-3 py-1.5 rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Agregar
          </button>
        </div>

        <div className="space-y-2">
          {form.data.items.map((it, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start">
              <div className="sm:col-span-4">
                <label className="sr-only">Producto</label>
                <div className="flex gap-2">
                  <input className="flex-1 rounded-md border-slate-300" placeholder="Producto..." value={it.label} readOnly />
                  <button
                    type="button"
                    onClick={() => {
                      setPrdIdx(i);
                      setPrdOpen(true);
                      setPrdTerm('');
                      setPrdResults([]);
                    }}
                    className="px-3 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800"
                  >
                    Buscar
                  </button>
                </div>
                {it.stock !== null && (
                  <div className="text-xs text-slate-500 mt-1">
                    Stock: {it.stock} {it.codigo ? `— Código: ${it.codigo}` : ''}
                  </div>
                )}
              </div>

              <input
                type="number"
                min="1"
                className="rounded-md border-slate-300"
                placeholder="Cant."
                value={it.cantidad}
                onChange={(e) => setItem(i, { cantidad: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-md border-slate-300"
                placeholder="Precio"
                value={it.precio}
                onChange={(e) => setItem(i, { precio: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-md border-slate-300"
                placeholder="Desc. $"
                value={it.descuento}
                onChange={(e) => setItem(i, { descuento: e.target.value })}
              />
              <select
                className="rounded-md border-slate-300"
                value={it.iva}
                onChange={(e) => setItem(i, { iva: Number(e.target.value) })}
              >
                <option value={15}>IVA 15%</option>
                <option value={0}>IVA 0%</option>
              </select>

              <div className="sm:col-span-2">
                <div className="rounded-md bg-slate-50 border border-slate-200 px-2 py-1.5 text-right">
                  {money(to2((+it.cantidad || 0) * (+it.precio || 0) - (+it.descuento || 0)))}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(i)}
                  className="px-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        {form.errors?.items && <p className="text-xs text-red-600 mt-1">{form.errors.items}</p>}
      </div>

      {/* ===== Totales ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-md border border-slate-200 p-3 bg-white">
          <div className="text-xs text-slate-500">Estado</div>
          <select
            className="mt-1 w-full rounded-md border-slate-300"
            value={form.data.estado}
            onChange={(e) => form.setData('estado', e.target.value)}
          >
            <option value="emitida">Emitida</option>
            <option value="borrador">Borrador</option>
            <option value="anulada">Anulada</option>
          </select>
        </div>

        <div className="rounded-md border border-slate-200 p-3 bg-slate-50">
          <div className="flex items-center justify-between text-sm">
            <span>Base 0%</span>
            <span>{money(base0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Base 15%</span>
            <span>{money(base15)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span>IVA 15%</span>
            <span>{money(iva15)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-lg font-semibold text-slate-900">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>

      {/* ===== Pagos ===== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Pagos</span>
          <button
            type="button"
            onClick={addPago}
            className="px-3 py-1.5 rounded-md text-white bg-primary-600 hover:bg-primary-700"
          >
            Agregar pago
          </button>
        </div>

        <div className="space-y-2">
          {form.data.pagos.map((p, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-start">
              <input
                className="rounded-md border-slate-300"
                placeholder="Código (p.ej. EFE, TAR)"
                value={p.codigo}
                onChange={(e) => setPago(i, { codigo: e.target.value })}
              />
              <input
                className="sm:col-span-3 rounded-md border-slate-300"
                placeholder="Nombre (Efectivo, Tarjeta, Transferencia)"
                value={p.nombre}
                onChange={(e) => setPago(i, { nombre: e.target.value })}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-md border-slate-300"
                placeholder="Valor"
                value={p.valor}
                onChange={(e) => setPago(i, { valor: e.target.value })}
              />
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => removePago(i)}
                  className="px-2 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 text-sm">
          <span className="text-slate-600">Suma pagos: </span>
          <span className={pagosOk ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
            {money(sumPagos)} {pagosOk ? '' : `(debe igualar ${money(total)})`}
          </span>
        </div>
      </div>

      {/* ===== Tarjeta (opcional) ===== */}
      {form.data.tarjeta && (
        <div className="rounded-md border border-slate-200 p-3 bg-white">
          <div className="text-sm font-medium text-slate-700 mb-2">Detalle tarjeta</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Monto</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border-slate-300"
                value={form.data.tarjeta.monto}
                onChange={(e) => form.setData('tarjeta', { ...form.data.tarjeta, monto: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Comisión</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border-slate-300"
                value={form.data.tarjeta.comision}
                onChange={(e) => form.setData('tarjeta', { ...form.data.tarjeta, comision: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo</label>
              <input
                type="text"
                className="w-full rounded-md border-slate-300"
                placeholder="Crédito, Débito, Visa..."
                value={form.data.tarjeta.tipo_tarjeta}
                onChange={(e) => form.setData('tarjeta', { ...form.data.tarjeta, tipo_tarjeta: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Plazo (meses)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-md border-slate-300"
                value={form.data.tarjeta.plazo}
                onChange={(e) => form.setData('tarjeta', { ...form.data.tarjeta, plazo: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== Acciones ===== */}
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
          disabled={form.processing || !canSubmit}
          className={[
            'px-3 py-2 rounded-md text-white',
            form.processing || !canSubmit ? 'bg-primary-400 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700',
          ].join(' ')}
        >
          {isEdit ? 'Guardar cambios' : 'Registrar venta'}
        </button>
      </div>

      {/* ================== MODAL: Clientes ================== */}
      <Modal
        show={cliOpen}
        onClose={() => setCliOpen(false)}
        size={MODAL_SIZES.xl}
        maxWidth={MODAL_SIZES.xl}  // compatibilidad si tu Modal usa maxWidth
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Buscar cliente</h3>
            <button onClick={() => setCliOpen(false)} className="text-slate-500 hover:text-slate-700">Cerrar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input
              className="sm:col-span-2 rounded-md border-slate-300"
              placeholder="Nombre o CI/RUC"
              value={cliTerm}
              onChange={(e) => setCliTerm(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setCliTerm(cliTerm)}
              className="px-3 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800"
            >
              {cliLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto border border-slate-200 rounded-md">
            {cliResults.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Sin resultados</div>
            ) : (
              cliResults.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
                  <div className="text-sm">
                    <div className="font-medium">{c.nombres}</div>
                    <div className="text-slate-500">{c.ci_o_ruc || '—'} · {c.telefono || '—'}</div>
                  </div>
                  <button
                    onClick={() => {
                      form.setData('cliente_id', String(c.id));
                      form.setData(
                        'cliente_label',
                        `${c.nombres}${c.ci_o_ruc ? ' — [' + c.ci_o_ruc + ']' : ''}`
                      );
                      setCliOpen(false);
                    }}
                    className="px-3 py-1.5 rounded-md bg-primary-600 text-white hover:bg-primary-700"
                  >
                    Seleccionar
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Quick create / edit */}
          <div className="mt-4 border-t pt-3">
            <div className="text-sm font-medium mb-2">Cliente rápido</div>
            <QuickCliente
              onCreate={async (payload) => {
                const nuevo = await quickCreateCliente(payload);
                form.setData('cliente_id', String(nuevo.id));
                form.setData(
                  'cliente_label',
                  `${nuevo.nombres}${nuevo.ci_o_ruc ? ' — [' + nuevo.ci_o_ruc + ']' : ''}`
                );
                setCliOpen(false);
              }}
              onEdit={async (payload) => {
                if (!form.data.cliente_id) {
                  alert('Selecciona un cliente a editar.');
                  return;
                }
                const upd = await quickEditCliente(form.data.cliente_id, payload);
                form.setData(
                  'cliente_label',
                  `${upd.nombres}${upd.ci_o_ruc ? ' — [' + upd.ci_o_ruc + ']' : ''}`
                );
                setCliOpen(false);
              }}
            />
          </div>
        </div>
      </Modal>

      {/* ================== MODAL: Productos ================== */}
      <Modal
        show={prdOpen}
        onClose={() => setPrdOpen(false)}
        size={MODAL_SIZES['4xl']}
        maxWidth={MODAL_SIZES['4xl']} // compatibilidad
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Buscar producto</h3>
            <button onClick={() => setPrdOpen(false)} className="text-slate-500 hover:text-slate-700">Cerrar</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <input
              className="sm:col-span-2 rounded-md border-slate-300"
              placeholder="Nombre o código"
              value={prdTerm}
              onChange={(e) => setPrdTerm(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setPrdTerm(prdTerm)}
              className="px-3 py-2 rounded-md bg-slate-700 text-white hover:bg-slate-800"
            >
              {prdLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          <div className="max-h-[75vh] overflow-auto border border-slate-200 rounded-md">
            {prdResults.length === 0 ? (
              <div className="p-3 text-sm text-slate-500">Sin resultados</div>
            ) : (
              prdResults.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-slate-100 items-center"
                >
                  <div className="col-span-6">
                    <div className="text-sm font-medium">{p.nombre}</div>
                    <div className="text-xs text-slate-500">Código: {p.codigo || '—'}</div>
                  </div>
                  <div className="col-span-3 text-sm">
                    Stock: <b>{p.cantidad_total ?? 0}</b>
                  </div>
                  <div className="col-span-2 text-sm">
                    PVP: <b>{money(p.pvp ?? p.precio_venta ?? p.precio ?? 0)}</b>
                  </div>

                  <div className="col-span-1 flex justify-end">
                    <button
                      onClick={() => {
                        if (prdIdx === null) { alert('Primero elige la fila del detalle.'); return; }
                        // Precio/IVA con fallbacks y tipos seguros
                        const precio = Number(p.pvp ?? p.precio_venta ?? p.precio ?? 0);
                        const iva = Number(p.iva) === 0 ? 0 : 15;

                        const arr = [...form.data.items];
                        const prev = arr[prdIdx] || {};
                        arr[prdIdx] = {
                          ...prev,
                          producto_id: String(p.id),
                          label: p.nombre || `#${p.id}`,
                          stock: p.cantidad_total ?? null,
                          codigo: p.codigo ?? '',
                          iva,
                          cantidad: prev.cantidad && String(prev.cantidad).trim() !== '' ? prev.cantidad : '1',
                          precio: String(to2(precio)),
                        };
                        form.setData('items', arr);
                        setPrdOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-md bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </form>
  );
}

/* ================== Subcomponente QuickCliente ================== */
function QuickCliente({ onCreate, onEdit }) {
  const [f, setF] = useState({
    nombres: '',
    ci_o_ruc: '',
    telefono: '',
    direccion: '',
    correo: '',
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
      <input
        className="sm:col-span-2 rounded-md border-slate-300"
        placeholder="Nombres"
        value={f.nombres}
        onChange={(e) => setF({ ...f, nombres: e.target.value.toUpperCase() })}
      />
      <input
        className="rounded-md border-slate-300"
        placeholder="CI/RUC"
        value={f.ci_o_ruc}
        onChange={(e) => setF({ ...f, ci_o_ruc: e.target.value })}
      />
      <input
        className="rounded-md border-slate-300"
        placeholder="Teléfono"
        value={f.telefono}
        onChange={(e) => setF({ ...f, telefono: e.target.value })}
      />
      <input
        className="sm:col-span-2 rounded-md border-slate-300"
        placeholder="Correo"
        value={f.correo}
        onChange={(e) => setF({ ...f, correo: e.target.value.toLowerCase() })}
      />
      <input
        className="sm:col-span-6 rounded-md border-slate-300"
        placeholder="Dirección"
        value={f.direccion}
        onChange={(e) => setF({ ...f, direccion: e.target.value.toUpperCase() })}
      />

      <div className="sm:col-span-6 flex items-center gap-2 mt-1">
        <button
          type="button"
          onClick={() => onCreate?.(f)}
          className="px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >
          Crear y seleccionar
        </button>
        <button
          type="button"
          onClick={() => onEdit?.(f)}
          className="px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700"
        >
          Editar seleccionado
        </button>
      </div>
    </div>
  );
}
