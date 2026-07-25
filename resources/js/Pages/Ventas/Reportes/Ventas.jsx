import React, { useMemo, useState } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";

const fmt = (n) =>
  new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(n ?? 0));

export default function Ventas({ auth }) {
  const { props } = usePage();
  const rows = props.rows ?? [];
  const tot = props.totales ?? {
    subtotal_pagos: 0, iva_pagos: 0, total_pagos: 0, comision: 0,
    subtotal_ventas: 0, iva_ventas: 0, total_ventas: 0
  };
  const filtros = props.filtros ?? {};

  const [desde, setDesde]   = useState(filtros.desde ?? "");
  const [hasta, setHasta]   = useState(filtros.hasta ?? "");
  const [estado, setEstado] = useState(filtros.estado ?? "autorizado");

  const onFiltrar = (e) => {
    e.preventDefault();
    router.get("/ventas/reportes", { desde, hasta, estado }, { preserveState: true, replace: true });
  };

  const qs = useMemo(() => {
    const p = new URLSearchParams({ desde, hasta, estado: estado ?? "" });
    return p.toString();
  }, [desde, hasta, estado]);

  return (
    <>
      <AdminLayout auth={auth} titulo="Reporte de Pagos por Venta" >
        <Head title="Reporte de Pagos por Venta" />
        <div className="p-6 max-w-[1400px] mx-auto">
          <h1 className="text-2xl font-semibold mb-4">Reporte de Pagos por Venta</h1>

          <form onSubmit={onFiltrar} className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium">Desde</label>
              <input type="date" value={desde} onChange={(e)=>setDesde(e.target.value)} className="border rounded p-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">Hasta</label>
              <input type="date" value={hasta} onChange={(e)=>setHasta(e.target.value)} className="border rounded p-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">Estado</label>
              <select value={estado ?? ""} onChange={(e)=>setEstado(e.target.value)} className="border rounded p-2">
                <option value="">(Todos)</option>
                <option value="autorizado">AUTORIZADO</option>
                <option value="emitida">EMITIDA</option>
                <option value="anulado">ANULADO</option>
              </select>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">Ver</button>

            <div className="ml-auto flex gap-2">
              <a href={`/ventas/reportes/csv?${qs}`} className="bg-emerald-600 text-white px-3 py-2 rounded">
                Descargar Excel
              </a>
              <a href={`/ventas/reportes/pdf?${qs}`} className="bg-rose-600 text-white px-3 py-2 rounded">
                Descargar PDF
              </a>
            </div>
          </form>

          {/* Totales: sumados por filas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-2">
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Subtotal (pagos)</div>
              <div className="text-xl font-semibold">${fmt(tot.subtotal_pagos)}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">IVA (pagos)</div>
              <div className="text-xl font-semibold">${fmt(tot.iva_pagos)}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Total (pagos)</div>
              <div className="text-xl font-semibold">${fmt(tot.total_pagos)}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-sm text-gray-500">Comisión</div>
              <div className="text-xl font-semibold">${fmt(tot.comision)}</div>
            </div>
          </div>
          {/* Referencia por ventas únicas */}
          <div className="text-xs text-gray-600 mb-4">
            Referencia (único por venta): Subtotal ${fmt(tot.subtotal_ventas)} · IVA ${fmt(tot.iva_ventas)} · Total ${fmt(tot.total_ventas)}
          </div>

          <div className="overflow-auto border rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-2">Fecha</th>
                  <th className="text-left p-2">N° Venta</th>
                  <th className="text-left p-2">Forma de pago</th>
                  <th className="text-right p-2">Valor del pago</th>
                  <th className="text-right p-2">Subtotal (pago)</th>
                  <th className="text-right p-2">IVA (pago)</th>
                  <th className="text-right p-2">Total (pago)</th>
                  <th className="text-right p-2">Subtotal (venta)</th>
                  <th className="text-right p-2">IVA (venta)</th>
                  <th className="text-right p-2">Total (venta)</th>
                  <th className="text-right p-2">Comisión</th>
                  {/* NUEVA COLUMNA AL FINAL */}
                  <th className="text-left p-2 w-48">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={12} className="p-3 text-center text-gray-500">Sin resultados</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.fecha}</td>
                    <td className="p-2 whitespace-nowrap tabular-nums">{r.numero}</td>
                    <td className="p-2">{r.forma_pago}</td>
                    <td className="p-2 text-right">${fmt(r.valor_pago)}</td>
                    <td className="p-2 text-right">${fmt(r.subtotal_pago)}</td>
                    <td className="p-2 text-right">${fmt(r.iva_pago)}</td>
                    <td className="p-2 text-right">${fmt(r.total_pago)}</td>
                    <td className="p-2 text-right">${fmt(r.subtotal_venta)}</td>
                    <td className="p-2 text-right">${fmt(r.iva_venta)}</td>
                    <td className="p-2 text-right">${fmt(r.total_venta)}</td>
                    <td className="p-2 text-right">${fmt(r.comision)}</td>
                    {/* NUEVA CELDA AL FINAL */}
                    <td className="p-2 max-w-[12rem] truncate" title={r.vendedor ?? ""}>
                      {r.vendedor ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
