import React, { useMemo, useState, useEffect } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import { FiPlus, FiTrash2, FiCheck } from 'react-icons/fi';

const money = (n) =>
  (Number(n) || 0).toLocaleString('es-EC', { style: 'currency', currency: 'USD' });

// Catálogo visual (dos entradas con código 20 como pediste)
const SRI_PAGOS = [
  { codigo: '01', nombre: 'EFECTIVO' },
  { codigo: '16', nombre: 'TARJETA DE DÉBITO' },
  { codigo: '19', nombre: 'TARJETA DE CRÉDITO' },
  { codigo: '20', nombre: 'TRANSFERENCIA' },
  { codigo: '20', nombre: 'DE UNA' },
];

// Tipos de tarjeta (para selector)
const CARD_TYPES = [
  'Visa',
  'MasterCard',
  'Diners Club',
  'American Express',
  'Discover',
  'Maestro',
  'Otro',
];

// Normaliza fila de pago SIN forzar nombre calculado
function normalizePago(p) {
  const fallback = SRI_PAGOS.find(x => x.codigo === p.codigo) || SRI_PAGOS[0];
  return {
    codigo: p.codigo || fallback.codigo,
    nombre: p.nombre || fallback.nombre,
    valor: (p.valor !== undefined && p.valor !== null && p.valor !== 0) ? String(p.valor) : '',
  };
}

// Planes y comisiones (porcentaje en decimal)
const PLANES_TC = [
  { key: 'corriente', label: 'Corriente (4,5%)', porcentaje: 0.045, plazo: 0 },
  { key: '3_sin',     label: '3 meses sin intereses (7%)', porcentaje: 0.07,  plazo: 3 },
  { key: '6_sin',     label: '6 meses sin intereses (10%)', porcentaje: 0.10, plazo: 6 },
  { key: '6_con',     label: '6 meses con intereses (6%)',  porcentaje: 0.06, plazo: 6 },
];

// Débito 2,24%
const COMISION_DEBITO = 0.0224;

/** Normaliza el estado para comparaciones robustas */
function normalizeEstado(s) {
  return String(s ?? '').toLowerCase().trim();
}

export default function Pagos({ venta, cliente, pagos, tarjetas }) {
  const isReadOnly = normalizeEstado(venta?.estado) === 'autorizado';

  const initRows = (pagos || []).map(normalizePago);
  const [rows, setRows] = useState(
    initRows.length ? initRows : [{ codigo: '01', nombre: 'EFECTIVO', valor: '' }]
  );

  // Estado envío en cadena
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasFlashError = (page) => !!(page?.props?.flash?.error);

  // Tarjeta de crédito (una sola sección)
  const [tarjeta, setTarjeta] = useState(() => {
    const t0 = tarjetas?.[0] || {};
    let planKey = '';
    if (t0?.plazo === 3) planKey = '3_sin';
    else if (t0?.plazo === 6 && Number(t0?.comision || 0) / Math.max(1, Number(t0?.monto || 0)) > 0.08) planKey = '6_sin';
    else if (t0?.plazo === 6) planKey = '6_con';
    else if ((t0?.plazo ?? 0) === 0) planKey = 'corriente';

    return {
      monto: (t0.monto && Number(t0.monto) !== 0) ? String(t0.monto) : '',
      comision: (t0.comision && Number(t0.comision) !== 0) ? String(t0.comision) : '',
      plan: planKey,
      plazo: (t0.plazo && Number(t0.plazo) !== 0)
        ? String(t0.plazo)
        : (planKey ? String(PLANES_TC.find(p => p.key===planKey)?.plazo ?? 0) : ''),
      tipo_tarjeta: t0.tipo_tarjeta || '',
    };
  });

  const cardRow = useMemo(() => rows.find(r => r.codigo === '19'), [rows]);

  // Sincroniza monto de tarjeta con la fila 19 si existe
  useEffect(() => {
    if (cardRow && String(cardRow.valor ?? '') !== String(tarjeta.monto ?? '')) {
      setTarjeta(t => ({ ...t, monto: String(cardRow.valor ?? '') }));
    }
    if (!cardRow && (tarjeta.monto !== '' || tarjeta.plan || tarjeta.comision || tarjeta.tipo_tarjeta || tarjeta.plazo)) {
      setTarjeta(t => ({ ...t, monto: '', comision: '', plan: '', plazo: '', tipo_tarjeta: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardRow?.valor, cardRow]);

  function add() {
    if (isReadOnly) return;
    setRows(s => [...s, { codigo: '01', nombre: 'EFECTIVO', valor: '' }]);
  }
  function setRow(i, patch) {
    if (isReadOnly) return;
    setRows(s => s.map((r, ix) => (ix === i ? { ...r, ...patch } : r)));
  }
  function onSelectForma(i, codigo, nombreElegido) {
    if (isReadOnly) return;
    setRow(i, { codigo, nombre: nombreElegido });
  }
  function onSetValor(i, v) {
    if (isReadOnly) return;
    setRow(i, { valor: v });
  }
  function del(i) {
    if (isReadOnly) return;
    setRows(s => s.filter((_, ix) => ix !== i));
  }

  // Auto-cálculo comisión TC según plan
  const planSel = PLANES_TC.find(p => p.key === tarjeta.plan) || null;
  useEffect(() => {
    if (!cardRow || isReadOnly) return; // solo si hay pago TC y no es solo lectura
    const monto = Number(tarjeta.monto) || 0;
    if (!planSel) return;
    const com = +(monto * planSel.porcentaje).toFixed(2);
    setTarjeta(t => ({ ...t, comision: String(com), plazo: String(planSel.plazo) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tarjeta.monto, tarjeta.plan, cardRow?.valor, isReadOnly]);

  // Total de pagos (redondeado)
  const totalPagos = useMemo(() => {
    const sumNoCard = rows
      .filter(r => r.codigo !== '19')
      .reduce((a, b) => a + (Number(b.valor) || 0), 0);
    return +(sumNoCard + (Number(tarjeta.monto) || 0)).toFixed(2);
  }, [rows, tarjeta.monto]);

  // Resumen: Subtotal SIN IVA, IVA desglosado y TOTAL con IVA
  const subtotalSinIva = +(Number(venta.subtotal) || 0).toFixed(2);
  const ivaDesglosado  = +(Number(venta.impuesto_15) || 0).toFixed(2);
  const totalVenta     = +(Number(venta.total) || 0).toFixed(2);
  const diff           = +(totalVenta - totalPagos).toFixed(2);

  // ====== UN SOLO BOTÓN: guardar pagos + emitir + generar XML + firmar/enviar SRI ======
  function finalizar() {
    if (isReadOnly) return; // bloqueo duro si autorizada
    if (Math.abs(diff) >= 0.01 || !tieneAlgunaForma || isSubmitting) return;
    setIsSubmitting(true);

    // 1) Enviamos TODOS los pagos, incluyendo la tarjeta (código 19)
    const pagosPayload = rows
      .filter(r => r.codigo !== '19') // primero todos menos TC
      .map(r => ({ codigo: r.codigo, nombre: r.nombre, valor: Number(r.valor) || 0 }));

    // Si hay fila de TC o datos de TC, añadimos también el pago de tarjeta a 'pagos'
    const cardMonto = Number(tarjeta.monto) || 0;
    if (cardRow || cardMonto > 0) {
      pagosPayload.push({
        codigo: '19',
        nombre: cardRow?.nombre || 'TARJETA DE CRÉDITO',
        valor: cardMonto,
      });
    }

    // Además, mantenemos el objeto 'tarjeta' con su detalle
    const tarjetaPayload =
      cardRow || tarjeta.monto || tarjeta.plan || tarjeta.comision || tarjeta.tipo_tarjeta
        ? {
            monto: cardMonto,
            comision: Number(tarjeta.comision) || 0,
            tipo_tarjeta: tarjeta.tipo_tarjeta || null,
            plazo: Number(tarjeta.plazo) || 0,
            plan: tarjeta.plan || null,
          }
        : null;

    // 2) Guardar pagos y emitir
    router.post(route('ventas.ventas.pagos.guardar', venta.id), {
      pagos: pagosPayload,
      tarjeta: tarjetaPayload,
    }, {
      preserveScroll: true,
      onSuccess: (page) => {
        if (hasFlashError(page)) { setIsSubmitting(false); return; }
      },
      onError: () => setIsSubmitting(false),
    });
  }

  const tieneAlgunaForma =
    rows.some(r => r.codigo !== '19' && Number(r.valor) > 0) || Number(tarjeta.monto) > 0;

  // Helpers Débito (informativo)
  const debitoMonto = useMemo(
    () => rows.filter(r => r.codigo === '16').reduce((a,b)=>a + (Number(b.valor)||0), 0),
    [rows]
  );
  const debitoComision = useMemo(
    () => +(debitoMonto * COMISION_DEBITO).toFixed(2),
    [debitoMonto]
  );

  return (
    <AdminLayout title={venta.id === 'nueva' ? 'Nueva Venta — Pagos' : `Venta #${venta.id} — Pagos`}>
      <Head title={venta.id === 'nueva' ? 'Nueva Venta — Pagos' : `Venta #${venta.id} — Pagos`} />

      {/* Banda de solo lectura si está AUTORIZADA */}
      {isReadOnly && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <strong>Venta AUTORIZADA:</strong> esta pantalla está en <span className="font-semibold">solo lectura</span>. No se pueden modificar pagos ni confirmar.
        </div>
      )}

      {/* Cliente */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Cliente</p>
            <p className="text-base font-semibold text-slate-800">
              {cliente?.nombres} {cliente?.ci_o_ruc ? `— [${cliente.ci_o_ruc}]` : ''}
            </p>
          </div>
          <Link
            href={route('ventas.ventas.vista_productos', venta.id)}
            className="text-sm text-primary-700 hover:underline"
          >
            Volver a productos
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Pagos */}
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Pagos</h3>
            <button
              onClick={add}
              disabled={isReadOnly}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                isReadOnly
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isReadOnly ? 'Venta autorizada: solo lectura' : 'Agregar pago'}
            >
              <FiPlus className="h-4 w-4" /> Agregar pago
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 && <p className="text-sm text-slate-500">Agrega al menos un pago.</p>}
            {rows.map((p, i) => (
              <div key={`${p.codigo}-${i}`} className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                {/* Forma de pago (mostrar el catálogo tal cual) */}
                <div className="sm:col-span-6">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Forma de pago (SRI)</label>
                  <select
                    value={`${p.codigo}|${p.nombre}`}
                    onChange={(e) => {
                      const [codigo, nombre] = e.target.value.split('|');
                      onSelectForma(i, codigo, nombre);
                    }}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    {SRI_PAGOS.map((opt, idx) => (
                      <option key={`${opt.codigo}-${idx}`} value={`${opt.codigo}|${opt.nombre}`}>
                        {opt.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Valor */}
                <div className="sm:col-span-5">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Valor</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={p.valor}
                    onChange={(e) => onSetValor(i, e.target.value)}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                  />
                  {p.codigo === '16' && (
                    <p className="mt-1 text-[15px] text-slate-500">
                      Comisión débito 2,24% ≈ {money((Number(p.valor)||0)*COMISION_DEBITO)}
                    </p>
                  )}
                </div>

                {/* Eliminar */}
                <div className="sm:col-span-1 flex items-end justify-end">
                  <button
                    onClick={() => del(i)}
                    disabled={isReadOnly}
                    className={`mb-0.5 rounded-md px-2 py-1 text-xs text-white ${
                      isReadOnly
                        ? 'cursor-not-allowed bg-slate-300'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                    title={isReadOnly ? 'Venta autorizada: solo lectura' : 'Eliminar pago'}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tarjeta de crédito */}
          {cardRow && (
            <div className="mt-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-700">Tarjeta de crédito</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Monto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tarjeta.monto}
                    onChange={(e) => setTarjeta((s) => ({ ...s, monto: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Plan</label>
                  <select
                    value={tarjeta.plan}
                    onChange={(e) => setTarjeta(s => ({ ...s, plan: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">Seleccione…</option>
                    {PLANES_TC.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  {planSel && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Comisión {Math.round(planSel.porcentaje*10000)/100}% sobre el monto.
                    </p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Plazo</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="meses"
                    value={tarjeta.plazo}
                    onChange={(e) => setTarjeta((s) => ({ ...s, plazo: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Tipo de tarjeta</label>
                  <select
                    value={tarjeta.tipo_tarjeta}
                    onChange={(e) => setTarjeta(s => ({ ...s, tipo_tarjeta: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">Seleccione…</option>
                    {CARD_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Comisión</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={tarjeta.comision}
                    onChange={(e) => setTarjeta((s) => ({ ...s, comision: e.target.value }))}
                    disabled={isReadOnly}
                    className="w-full rounded border-slate-300 text-right disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resumen (SIN IVA en subtotal) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Resumen</h3>

          {(debitoMonto > 0 || Number(tarjeta.comision) > 0) && (
            <div className="mb-3 rounded border border-slate-200 p-2">
              <p className="text-xs font-medium text-slate-700">Comisiones estimadas</p>
              {debitoMonto > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span>Débito (2,24%) sobre {money(debitoMonto)}</span>
                  <span className="font-medium">{money(debitoComision)}</span>
                </div>
              )}
              {Number(tarjeta.comision) > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span>Crédito — {PLANES_TC.find(p=>p.key===tarjeta.plan)?.label || 'Plan'} </span>
                  <span className="font-medium">{money(tarjeta.comision)}</span>
                </div>
              )}
            </div>
          )}

          <dl className="space-y-1 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">Subtotal (sin IVA)</dt>
              <dd className="font-medium">{money(subtotalSinIva)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">IVA 15% (desglosado)</dt>
              <dd className="font-medium">{money(ivaDesglosado)}</dd>
            </div>

            {Number(venta.descuento) > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Descuento</dt>
                <dd className="font-medium">-{money(venta.descuento)}</dd>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
              <dt className="text-base font-semibold">TOTAL</dt>
              <dd className="text-base font-semibold">{money(totalVenta)}</dd>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <dt className="text-slate-500">Pagos</dt>
              <dd className="font-medium">{money(totalPagos)}</dd>
            </div>
            <div className={`mt-1 flex items-center justify-between ${Math.abs(diff)<0.01?'text-emerald-700':'text-amber-700'}`}>
              <dt>Diferencia</dt><dd className="font-semibold">{money(diff)}</dd>
            </div>
          </dl>

          <button
            onClick={finalizar}
            disabled={isReadOnly || isSubmitting || Math.abs(diff) >= 0.01 || !tieneAlgunaForma}
            className={`mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white ${
              isReadOnly
                ? 'cursor-not-allowed bg-slate-400'
                : 'bg-emerald-600 hover:bg-emerald-700'
            } disabled:opacity-60`}
            title={
              isReadOnly
                ? 'Venta autorizada: solo lectura'
                : (Math.abs(diff) >= 0.01 ? 'Los pagos deben igualar al total' : 'Guardar, emitir, generar XML y enviar al SRI')
            }
          >
            <FiCheck className="h-4 w-4" />
            {isReadOnly ? 'Solo lectura' : (isSubmitting ? 'Procesando…' : 'Confirmar, emitir, XML y SRI')}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
