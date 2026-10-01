import React, { useEffect, useMemo, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";
import { FiDownload, FiFilter, FiDollarSign, FiCreditCard, FiSend, FiInbox } from "react-icons/fi";
import useCan from "@/Hooks/useCan";

const fmt = (n) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

export default function Ventas({ auth }) {
  const can = useCan();
  const canExport = can('reportes_ventas.export');

  const { props } = usePage();
  const rows = props.rows ?? [];
  const tot = props.totales ?? {
    total_pagos: 0, pagos_efectivo: 0, pagos_transferencia: 0, pagos_tarjeta: 0, pagos_otros: 0,
    subtotal_pagos: 0, iva_pagos: 0, comision: 0,
    subtotal_ventas: 0, iva_ventas: 0, total_ventas: 0
  };
  const filtros = props.filtros ?? {};

  const [desde, setDesde]         = useState(filtros.desde !== undefined ? filtros.desde : "");
  const [hasta, setHasta]         = useState(filtros.hasta !== undefined ? filtros.hasta : "");
  const [estado, setEstado]       = useState(filtros.estado !== undefined ? filtros.estado : "autorizado");
  const [formaPago, setFormaPago] = useState(filtros.formaPago ?? "");

  useEffect(() => {
    if (filtros.desde !== undefined) setDesde(filtros.desde);
    if (filtros.hasta !== undefined) setHasta(filtros.hasta);
    if (filtros.estado !== undefined) setEstado(filtros.estado);
    if (filtros.formaPago !== undefined) setFormaPago(filtros.formaPago);
  }, [filtros.desde, filtros.hasta, filtros.estado, filtros.formaPago]);

  const onFiltrar = (e) => {
    e.preventDefault();
    router.get("/admin/reportes", { desde, hasta, estado, forma_pago: formaPago }, { preserveState: true, replace: true });
  };

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (desde) p.append('desde', desde);
    if (hasta) p.append('hasta', hasta);
    if (estado !== undefined && estado !== null) p.append('estado', estado);
    if (formaPago) p.append('forma_pago', formaPago);
    return p.toString();
  }, [desde, hasta, estado, formaPago]);

  const getBadgesFormaPago = (forma, cat) => {
    const norm = (forma || '').toLowerCase();
    if (norm.includes('efectivo') || cat === 'Efectivo') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
    if (norm.includes('transfer') || norm.includes('deposito') || cat === 'Transferencia') {
      return 'bg-sky-100 text-sky-800 border-sky-300';
    }
    if (norm.includes('tarjeta') || norm.includes('credito') || norm.includes('debito') || cat === 'Tarjeta') {
      return 'bg-amber-100 text-amber-800 border-amber-300';
    }
    return 'bg-slate-100 text-slate-700 border-slate-300';
  };

  return (
    <AdminLayout auth={auth} title="Reporte de Pagos por Venta">
      <Head title="Reporte de Pagos por Venta" />
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-6">
        
        {/* Header con título y botón de filtros */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reporte de Pagos por Venta</h1>
            <p className="text-xs text-slate-500 mt-1">Desglose de ingresos por forma de pago (Efectivo, Transferencias, Tarjetas) y detalle de ventas.</p>
          </div>
          
          {canExport && (
            <div className="flex items-center gap-2">
              <a 
                href={`/admin/reportes/excel?${qs}`} 
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 transition"
              >
                <FiDownload className="h-4 w-4" /> Excel
              </a>
              <a 
                href={`/admin/reportes/pdf?${qs}`} 
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 transition"
              >
                <FiDownload className="h-4 w-4" /> PDF
              </a>
            </div>
          )}
        </div>

        {/* Formulario de Filtros */}
        <form onSubmit={onFiltrar} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="flex flex-col min-w-[140px]">
            <label className="text-xs font-bold text-slate-700 mb-1">Desde</label>
            <input 
              type="date" 
              value={desde} 
              onChange={(e)=>setDesde(e.target.value)} 
              className="rounded-xl border-slate-300 text-xs font-medium focus:border-emerald-600 focus:ring-emerald-600" 
            />
          </div>
          
          <div className="flex flex-col min-w-[140px]">
            <label className="text-xs font-bold text-slate-700 mb-1">Hasta</label>
            <input 
              type="date" 
              value={hasta} 
              onChange={(e)=>setHasta(e.target.value)} 
              className="rounded-xl border-slate-300 text-xs font-medium focus:border-emerald-600 focus:ring-emerald-600" 
            />
          </div>
          
          <div className="flex flex-col min-w-[150px]">
            <label className="text-xs font-bold text-slate-700 mb-1">Estado Venta</label>
            <select 
              value={estado ?? ""} 
              onChange={(e)=>setEstado(e.target.value)} 
              className="rounded-xl border-slate-300 text-xs font-medium focus:border-emerald-600 focus:ring-emerald-600"
            >
              <option value="">(Todos los estados)</option>
              <option value="autorizado">AUTORIZADO</option>
              <option value="emitida">EMITIDA</option>
              <option value="anulado">ANULADO</option>
            </select>
          </div>

          <div className="flex flex-col min-w-[170px]">
            <label className="text-xs font-bold text-slate-700 mb-1">Forma de Pago</label>
            <select 
              value={formaPago ?? ""} 
              onChange={(e)=>setFormaPago(e.target.value)} 
              className="rounded-xl border-slate-300 text-xs font-medium focus:border-emerald-600 focus:ring-emerald-600"
            >
              <option value="">(Todas las formas de pago)</option>
              <option value="Efectivo">EFECTIVO 💵</option>
              <option value="Transferencia">TRANSFERENCIA 🏦</option>
              <option value="Tarjeta">TARJETA 💳</option>
              <option value="Otros">OTROS 🧾</option>
            </select>
          </div>

          <button 
            type="submit" 
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition"
          >
            <FiFilter className="h-3.5 w-3.5" /> Filtrar
          </button>
        </form>

        {/* 1. PRIMERO: TOTAL PAGOS Y DESGLOSE POR TIPO DE PAGO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <span>💳</span> Resumen de Recaudación y Formas de Pago
            </h2>
            <span className="text-xs text-slate-500 font-medium">Sumado por transacciones de pago</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* CARD DESTACADA: TOTAL PAGOS */}
            <div className="sm:col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-950 text-white p-4 shadow-lg border border-emerald-800/40 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-white">
                <FiDollarSign className="w-16 h-16" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">TOTAL PAGOS RECAUDADOS</span>
                <div className="text-2xl sm:text-3xl font-black text-white mt-1.5">${fmt(tot.total_pagos)}</div>
              </div>
              <div className="mt-3 text-[11px] font-semibold text-emerald-300 border-t border-emerald-800/60 pt-2">
                Ingresos totales en caja
              </div>
            </div>

            {/* CARD 2: EFECTIVO */}
            <div className="rounded-2xl bg-white border border-emerald-200/80 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase">Efectivo</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-base">💵</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-2">${fmt(tot.pagos_efectivo)}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">Recaudado en efectivo</div>
            </div>

            {/* CARD 3: TRANSFERENCIA */}
            <div className="rounded-2xl bg-white border border-sky-200/80 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-900 uppercase">Transferencia</span>
                <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700 font-bold text-base">🏦</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-2">${fmt(tot.pagos_transferencia)}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">Transferencias / Depósitos</div>
            </div>

            {/* CARD 4: TARJETAS */}
            <div className="rounded-2xl bg-white border border-amber-200/80 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">Tarjetas</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-base">💳</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-2">${fmt(tot.pagos_tarjeta)}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">Débito y Crédito</div>
            </div>

            {/* CARD 5: OTROS */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Otros</span>
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 font-bold text-base">🧾</span>
              </div>
              <div className="text-xl font-black text-slate-900 mt-2">${fmt(tot.pagos_otros)}</div>
              <div className="text-[11px] text-slate-500 mt-1 font-medium">Cheques / Convenios</div>
            </div>
          </div>
        </div>

        {/* TARJETA DESTACADA: VENTA NETA REAL */}
        <div className="rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-950 to-slate-900 text-white p-5 shadow-xl border border-sky-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-sky-500/20 text-sky-300 font-extrabold text-[11px] px-2.5 py-0.5 rounded-full border border-sky-400/30 uppercase tracking-wider">
                💰 CÁLCULO DE VENTA NETA REAL
              </span>
            </div>
            <div className="text-3xl font-black text-white mt-2">
              ${fmt(tot.venta_neta ?? (tot.total_pagos - tot.iva_pagos - tot.comision))}
            </div>
            <p className="text-xs text-sky-200 mt-1 font-medium">
              Fórmula de liquidez real: <b className="text-white">Total Pagos</b> (${fmt(tot.total_pagos)}) − <b className="text-rose-300">IVA 15%</b> (${fmt(tot.iva_pagos)}) − <b className="text-amber-300">Comisiones</b> (${fmt(tot.comision)})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="text-center px-3 py-1 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Pagos</span>
              <span className="font-extrabold text-emerald-400 text-sm">${fmt(tot.total_pagos)}</span>
            </div>
            <div className="text-center px-3 py-1 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">− IVA 15%</span>
              <span className="font-extrabold text-rose-400 text-sm">-${fmt(tot.iva_pagos)}</span>
            </div>
            <div className="text-center px-3 py-1 border-r border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block uppercase">− Comisión</span>
              <span className="font-extrabold text-amber-400 text-sm">-${fmt(tot.comision)}</span>
            </div>
            <div className="text-center px-3 py-1">
              <span className="text-[10px] text-sky-300 font-bold block uppercase">= Venta Neta</span>
              <span className="font-black text-sky-300 text-base">${fmt(tot.venta_neta ?? (tot.total_pagos - tot.iva_pagos - tot.comision))}</span>
            </div>
          </div>
        </div>

        {/* Totales Secundarios (Subtotal, IVA, Comisión, Venta Neta) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Subtotal (Pagos)</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">${fmt(tot.subtotal_pagos)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">IVA (Pagos)</div>
            <div className="text-lg font-bold text-slate-800 mt-0.5">${fmt(tot.iva_pagos)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="text-xs font-semibold text-slate-500">Comisión Tarjetas</div>
            <div className="text-lg font-bold text-amber-700 mt-0.5">${fmt(tot.comision)}</div>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 shadow-sm">
            <div className="text-xs font-bold text-sky-900 uppercase">Venta Neta</div>
            <div className="text-lg font-black text-sky-950 mt-0.5">${fmt(tot.venta_neta ?? (tot.total_pagos - tot.iva_pagos - tot.comision))}</div>
          </div>
        </div>

        {/* Referencia Única por Venta */}
        <div className="rounded-xl bg-slate-100/80 border border-slate-200/80 p-3 text-xs font-medium text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-800">Referencia (ventas únicas sin duplicar pagos):</span>
          <span>Subtotal Ventas: <b>${fmt(tot.subtotal_ventas)}</b> · IVA Ventas: <b>${fmt(tot.iva_ventas)}</b> · Total Ventas: <b>${fmt(tot.total_ventas)}</b></span>
        </div>

        {/* Tabla de Detalle de Pagos */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase tracking-wider text-[11px] font-bold">
                <tr>
                  <th className="p-3">Fecha</th>
                  <th className="p-3">N° Venta</th>
                  <th className="p-3">Forma de Pago</th>
                  <th className="p-3 text-right">Valor Pago</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">IVA</th>
                  <th className="p-3 text-right">Total Pago</th>
                  <th className="p-3 text-right">Subtotal Venta</th>
                  <th className="p-3 text-right">IVA Venta</th>
                  <th className="p-3 text-right">Total Venta</th>
                  <th className="p-3 text-right">Comisión</th>
                  <th className="p-3">Vendedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-slate-400">
                      No se encontraron registros de pagos para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 whitespace-nowrap">{r.fecha}</td>
                    <td className="p-3 whitespace-nowrap font-mono font-bold text-slate-900">{r.numero}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold border ${getBadgesFormaPago(r.forma_pago, r.categoria_pago)}`}>
                        {r.forma_pago}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900">${fmt(r.valor_pago)}</td>
                    <td className="p-3 text-right">${fmt(r.subtotal_pago)}</td>
                    <td className="p-3 text-right">${fmt(r.iva_pago)}</td>
                    <td className="p-3 text-right font-bold text-slate-900">${fmt(r.total_pago)}</td>
                    <td className="p-3 text-right text-slate-500">${fmt(r.subtotal_venta)}</td>
                    <td className="p-3 text-right text-slate-500">${fmt(r.iva_venta)}</td>
                    <td className="p-3 text-right text-slate-500">${fmt(r.total_venta)}</td>
                    <td className="p-3 text-right text-amber-700 font-semibold">${fmt(r.comision)}</td>
                    <td className="p-3 truncate max-w-[10rem]" title={r.vendedor}>{r.vendedor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
