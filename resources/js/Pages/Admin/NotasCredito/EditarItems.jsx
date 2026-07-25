import React, { useMemo, useState } from "react";
import { Head, Link, useForm } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";
import { FiCheckSquare, FiSquare, FiRotateCcw, FiSave, FiArrowLeft, FiAlertCircle, FiCheckCircle, FiFileText } from "react-icons/fi";

function fmt(n, d = 2) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(v);
}

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function EditarItems({ auth, nc, venta, cliente, itemsFactura = [], detallesNC = [], flash }) {
  // Pre-cargar mapa de detalles existentes en la NC
  const byPidDetalle = useMemo(() => new Map(detallesNC.map(d => [d.producto_id, d])), [detallesNC]);

  // Estado local para checkboxes de selección e ítems
  const [itemsState, setItemsState] = useState(() => {
    return itemsFactura.map((f) => {
      const det = byPidDetalle.get(f.producto_id);
      const cantDetalle = toNum(det?.cantidad ?? 0);
      const isSelected = det ? cantDetalle > 0 : true; // por defecto seleccionar si hay detalle o si es nueva
      const cantFact = toNum(f.cantidad);

      return {
        selected: isSelected,
        producto_id: f.producto_id,
        nombre: f.nombre,
        codigo: f.codigo,
        facturado: cantFact,
        precio: toNum(det?.precio ?? f.precio), // precio con IVA
        descuento: toNum(det?.descuento ?? 0),
        iva: Number(det?.iva ?? f.iva ?? 15),
        cantidad: isSelected ? (cantDetalle > 0 ? cantDetalle : cantFact) : 0,
      };
    });
  });

  const { data, setData, put, processing, errors } = useForm({
    items: [],
    motivo: nc?.motivo ?? "Devolución de mercadería",
  });

  // Alternar selección de un producto individual
  function toggleSelect(idx) {
    setItemsState((prev) =>
      prev.map((it, i) => {
        if (i === idx) {
          const newSel = !it.selected;
          return {
            ...it,
            selected: newSel,
            cantidad: newSel ? (it.cantidad > 0 ? it.cantidad : it.facturado) : 0,
          };
        }
        return it;
      })
    );
  }

  // Devolución Total (Selecciona todos e iguala la cantidad al facturado original)
  function handleDevolucionTotal() {
    setItemsState((prev) =>
      prev.map((it) => ({
        ...it,
        selected: true,
        cantidad: it.facturado,
      }))
    );
  }

  // Seleccionar Todos
  function handleSeleccionarTodos() {
    setItemsState((prev) =>
      prev.map((it) => ({
        ...it,
        selected: true,
        cantidad: it.cantidad > 0 ? it.cantidad : it.facturado,
      }))
    );
  }

  // Deseleccionar Todos
  function handleDeseleccionarTodos() {
    setItemsState((prev) =>
      prev.map((it) => ({
        ...it,
        selected: false,
        cantidad: 0,
      }))
    );
  }

  // Actualizar atributo de un item
  function updateItemState(idx, key, val) {
    setItemsState((prev) =>
      prev.map((it, i) => {
        if (i === idx) {
          const updated = { ...it, [key]: val };
          if (key === "cantidad") {
            const n = toNum(val);
            if (n > 0) updated.selected = true;
          }
          return updated;
        }
        return it;
      })
    );
  }

  // Cálculo en vivo de totales
  const totales = useMemo(() => {
    let base0G = 0, base15G = 0, iva15G = 0, descG = 0;

    itemsState.forEach((it) => {
      if (!it.selected) return;
      const cant = Math.max(0, toNum(it.cantidad));
      const precio = Math.max(0, toNum(it.precio));
      const descL = Math.max(0, toNum(it.descuento));

      descG += descL;
      const brutoConIva = Math.max(0, cant * precio - descL);

      if (Number(it.iva) === 15) {
        const base = brutoConIva / 1.15;
        base15G += base;
        iva15G += base * 0.15;
      } else {
        base0G += brutoConIva;
      }
    });

    const subtotal = base0G + base15G;
    const total = subtotal + iva15G;

    return {
      base0: base0G,
      base15: base15G,
      subtotal,
      impuesto_15: iva15G,
      descuento: descG,
      total,
    };
  }, [itemsState]);

  // Envío del formulario
  function handleSubmit(e) {
    e.preventDefault();

    const selectedItems = itemsState
      .filter((it) => it.selected && toNum(it.cantidad) > 0)
      .map(({ producto_id, cantidad, precio, descuento, iva }) => ({
        producto_id,
        cantidad: toNum(cantidad),
        precio: toNum(precio),
        descuento: toNum(descuento),
        iva: Number(iva),
      }));

    if (selectedItems.length === 0) {
      alert("Debe seleccionar al menos un producto con cantidad mayor a 0 para generar la Nota de Crédito.");
      return;
    }

    // Actualizar datos en useForm y enviar
    data.items = selectedItems;
    put(route("admin.notas_credito.guardar_items", nc.id));
  }

  const esAutorizada = String(nc?.sri_estado_autorizacion || "").toLowerCase() === "autorizado" || String(nc?.estado || "").toLowerCase() === "emitida";

  return (
    <AdminLayout auth={auth} active="notas">
      <Head title={`Editar NC-${nc.estab}-${nc.pto_emision}-${String(nc.secuencial).padStart(9, "0")}`} />

      <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6">
        {/* Flash Notifications */}
        {flash?.success && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 flex items-center gap-2">
            <FiCheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span>{flash.success}</span>
          </div>
        )}
        {flash?.error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 flex items-center gap-2">
            <FiAlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />
            <span>{flash.error}</span>
          </div>
        )}

        {esAutorizada && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900 flex items-center gap-2">
            <FiAlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <span>Esta Nota de Crédito ya fue AUTORIZADA por el SRI. Los ítems están bloqueados en modo solo lectura.</span>
          </div>
        )}

        {/* Encabezado Principal */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <FiFileText className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  Nota de Crédito NC-{nc.estab}-{nc.pto_emision}-{String(nc.secuencial).padStart(9, "0")}
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  Factura Sustento: <span className="font-semibold text-slate-700">{venta.estab}-{venta.pto_emision}-{String(venta.secuencial).padStart(9, "0")}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-right">
              <p className="text-xs text-slate-500">Cliente</p>
              <p className="text-sm font-semibold text-slate-800">{cliente?.nombres || "Consumidor Final"}</p>
              <p className="text-xs text-slate-400">{cliente?.ci_o_ruc}</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2 text-right">
              <p className="text-xs text-slate-500">Estado NC</p>
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                {nc.estado}
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Barra de Acciones Rápidas */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDevolucionTotal}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-50 px-3.5 py-2 text-xs font-semibold text-primary-700 hover:bg-primary-100 transition-colors"
              >
                <FiRotateCcw className="h-4 w-4" /> Devolución Total
              </button>
              <button
                type="button"
                onClick={handleSeleccionarTodos}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <FiCheckSquare className="h-4 w-4 text-emerald-600" /> Seleccionar Todos
              </button>
              <button
                type="button"
                onClick={handleDeseleccionarTodos}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <FiSquare className="h-4 w-4 text-slate-400" /> Deseleccionar Todos
              </button>
            </div>

            <div className="text-xs font-medium text-slate-500">
              Seleccionados:{" "}
              <span className="font-bold text-slate-800">
                {itemsState.filter((i) => i.selected).length} de {itemsState.length}
              </span>
            </div>
          </div>

          {/* Tabla de Productos */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">Incluir</th>
                    <th className="px-4 py-3 text-left">Código</th>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-right">Facturado</th>
                    <th className="px-4 py-3 text-right">Precio c/IVA</th>
                    <th className="px-4 py-3 text-center">IVA</th>
                    <th className="px-4 py-3 text-right w-36">Cant. a Devolver</th>
                    <th className="px-4 py-3 text-right w-32">Descuento</th>
                    <th className="px-4 py-3 text-right">Subtotal c/IVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {itemsState.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No hay productos registrados en la factura sustento.
                      </td>
                    </tr>
                  )}
                  {itemsState.map((row, idx) => {
                    const cant = toNum(row.cantidad);
                    const precio = toNum(row.precio);
                    const desc = toNum(row.descuento);
                    const brutoConIva = row.selected ? Math.max(0, cant * precio - desc) : 0;
                    const maxCant = row.facturado ?? 0;

                    return (
                      <tr
                        key={row.producto_id}
                        className={`transition-colors ${
                          row.selected ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 opacity-60"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => toggleSelect(idx)}
                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>

                        {/* Código */}
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {row.codigo || row.producto_id}
                        </td>

                        {/* Nombre */}
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {row.nombre}
                        </td>

                        {/* Facturado */}
                        <td className="px-4 py-3 text-right font-medium text-slate-500">
                          {fmt(row.facturado, 2)}
                        </td>

                        {/* Precio */}
                        <td className="px-4 py-3 text-right font-medium text-slate-700">
                          ${fmt(row.precio, 2)}
                        </td>

                        {/* IVA */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                              row.iva === 15 ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.iva}%
                          </span>
                        </td>

                        {/* Cantidad a Devolver */}
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={maxCant}
                            step="0.0001"
                            disabled={!row.selected}
                            value={row.cantidad}
                            onChange={(e) => updateItemState(idx, "cantidad", e.target.value)}
                            className="w-28 text-right rounded-lg border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                          />
                          <div className="text-[10px] text-slate-400 mt-0.5">máx. {fmt(maxCant, 2)}</div>
                        </td>

                        {/* Descuento */}
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            disabled={!row.selected}
                            value={row.descuento}
                            onChange={(e) => updateItemState(idx, "descuento", e.target.value)}
                            className="w-28 text-right rounded-lg border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>

                        {/* Subtotal Línea */}
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          ${fmt(brutoConIva, 2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {errors?.items && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700 font-medium">
              {errors.items}
            </div>
          )}

          {/* Bloque Inferior: Motivo y Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <label className="block text-sm font-bold text-slate-700">
                Motivo de la Nota de Crédito <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="w-full rounded-xl border-slate-300 focus:ring-primary-500 focus:border-primary-500 text-sm p-3"
                rows={4}
                required
                placeholder="Indique la razón de la devolución o modificación..."
                value={data.motivo}
                onChange={(e) => setData("motivo", e.target.value)}
              />
              {errors?.motivo && <div className="text-xs text-rose-600 font-medium">{errors.motivo}</div>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
                Resumen de la Nota de Crédito
              </h3>
              <dl className="text-sm space-y-2">
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal 0%</dt>
                  <dd className="font-semibold">${fmt(totales.base0)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>Subtotal 15%</dt>
                  <dd className="font-semibold">${fmt(totales.base15)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>IVA 15%</dt>
                  <dd className="font-semibold">${fmt(totales.impuesto_15)}</dd>
                </div>
                <div className="flex justify-between text-slate-600">
                  <dt>Descuento total</dt>
                  <dd className="font-semibold text-rose-600">-${fmt(totales.descuento)}</dd>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-200 pt-3">
                  <dt>Total a Devolver</dt>
                  <dd className="text-primary-700">${fmt(totales.total)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href={route("admin.notas_credito.show", nc.id)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FiArrowLeft className="h-4 w-4" /> Cancelar
            </Link>
            <button
              type="submit"
              disabled={processing}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              <FiSave className="h-4 w-4" />
              {processing ? "Guardando…" : "Guardar y Continuar"}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
