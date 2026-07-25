import React, { useMemo, useEffect, useRef, useState } from "react";
import { Head, Link, useForm } from "@inertiajs/react";
import AdminLayout from "@/Layouts/AdminLayout";
import {
  FiChevronLeft,
  FiEdit2,
  FiFileText,
  FiCheckCircle,
  FiLock,
  FiRefreshCw,
  FiPrinter,
} from "react-icons/fi";

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtCurrency(n) {
  return (Number(n) || 0).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function normalizeEstado(s) {
  return String(s ?? "").toLowerCase().trim();
}

function BadgeEstado({ estado, sriEstado }) {
  const isAuth = normalizeEstado(sriEstado) === "autorizado" || normalizeEstado(estado) === "emitida";
  const isRechazado = normalizeEstado(sriEstado) === "devuelta" || normalizeEstado(sriEstado) === "rechazado";

  if (isAuth) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
        🟢 AUTORIZADO (SRI)
      </span>
    );
  }

  if (isRechazado) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-rose-50 text-rose-700 ring-1 ring-rose-600/20">
        🔴 {sriEstado || "RECHAZADO"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
      🟡 {(estado || "BORRADOR").toUpperCase()}
    </span>
  );
}

export default function Show({ auth, nc, venta, cliente, empresa: propEmpresa, detalles = [], flash }) {
  const { post, processing } = useForm({});
  const sheetRef = useRef(null);
  const barcodeCanvasRef = useRef(null);

  const empresa = propEmpresa ?? {
    nombre_comercial: "Mundo Navideño 365",
    razon_social: "Mundo Navideño 365",
    ruc: "1790000000001",
    establecimiento: nc?.estab ?? "001",
    punto_emision: nc?.pto_emision ?? "001",
  };

  const numeroFactura = venta?.numero || `${venta?.estab || "001"}-${venta?.pto_emision || "001"}-${String(venta?.secuencial || 1).padStart(9, "0")}`;
  const numeroNC = nc?.numero || `${nc?.estab || "001"}-${nc?.pto_emision || "001"}-${String(nc?.secuencial || 1).padStart(9, "0")}`;

  const esAutorizada = normalizeEstado(nc?.sri_estado_autorizacion) === "autorizado" || normalizeEstado(nc?.estado) === "emitida";
  const authValue = (nc?.sri_numero_autorizacion || nc?.autorizacion || "").toString().replace(/\s+/g, "");

  // Generar código de barras en Canvas para RIDE PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authValue || !barcodeCanvasRef.current) return;
      try {
        const { default: JsBarcode } = await import("jsbarcode");
        const canvas = barcodeCanvasRef.current;
        const cssWidth = 220;
        const cssHeight = 55;
        const dpr = Math.max(1, window.devicePixelRatio || 1);

        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        JsBarcode(canvas, authValue, {
          format: "CODE128",
          displayValue: true,
          textAlign: "center",
          fontOptions: "bold",
          fontSize: 9,
          textMargin: 2,
          margin: 2,
          width: 1.1,
          height: 35,
          background: "#ffffff",
          lineColor: "#1e293b",
        });
      } catch (e) {
        console.error("Error al renderizar barcode:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [authValue]);

  // Exportar a PDF (RIDE)
  const exportPDF = async () => {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const el = sheetRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        foreignObjectRendering: false,
        logging: false,
      });

      const pdf = new jsPDF("p", "pt", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const margin = 36;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const pageImg = canvas.toDataURL("image/png");

      pdf.addImage(pageImg, "PNG", margin, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgH;
        pdf.addImage(pageImg, "PNG", margin, position, imgW, imgH);
        heightLeft -= pageH;
      }

      const blob = pdf.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (e) {
      alert("Error al exportar PDF. Verifique que html2canvas y jspdf estén disponibles.");
      console.error(e);
    }
  };

  function emitir(e) {
    e.preventDefault();
    if (esAutorizada) return;
    post(route("admin.notas_credito.emitir", nc.id));
  }

  return (
    <AdminLayout auth={auth} active="notas">
      <Head title={`Nota de Crédito ${numeroNC}`} />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Flash Notifications */}
        {flash?.success && (
          <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 text-sm font-medium flex items-center gap-2">
            <FiCheckCircle className="h-5 w-5 text-emerald-600" />
            {flash.success}
          </div>
        )}
        {flash?.error && (
          <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 text-sm font-medium">
            {flash.error}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={route("admin.notas_credito.facturas")}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <FiChevronLeft className="h-4 w-4" />
              Volver a Facturas
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Nota de Crédito <span className="text-primary-600">#{numeroNC}</span>
            </h1>
            <BadgeEstado estado={nc.estado} sriEstado={nc.sri_estado_autorizacion} />
          </div>

          <div className="flex items-center gap-2">
            {esAutorizada ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed">
                <FiLock className="h-4 w-4 text-slate-400" />
                Edición Bloqueada (Autorizado SRI)
              </span>
            ) : (
              <>
                <Link
                  href={route("admin.notas_credito.vista_items", nc.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <FiEdit2 className="h-4 w-4 text-slate-500" />
                  Editar Ítems
                </Link>

                <form onSubmit={emitir}>
                  <button
                    type="submit"
                    disabled={processing}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all"
                  >
                    <FiRefreshCw className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} />
                    {processing ? "Emitiendo SRI..." : "Emitir / Firmar / SRI"}
                  </button>
                </form>
              </>
            )}

            <button
              onClick={exportPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:bg-slate-800"
              title="Imprimir o Exportar PDF RIDE"
            >
              <FiPrinter className="h-4 w-4" />
              Imprimir / PDF (RIDE)
            </button>
          </div>
        </div>

        {/* NOTA DE CRÉDITO VISUALIZADOR (RIDE FORMAT) */}
        <div
          ref={sheetRef}
          className="overflow-hidden rounded-2xl bg-white shadow-xl border border-slate-200"
        >
          {/* BANNER AUTORIZADO SRI */}
          {esAutorizada && (
            <div className="bg-emerald-600 px-6 py-3 text-white flex flex-wrap items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="h-5 w-5 text-emerald-200" />
                <span>COMPROBANTE ELECTRÓNICO AUTORIZADO ANTE EL SRI</span>
              </div>
              <div className="flex items-center gap-4">
                <span>No. Autorización: <strong className="font-mono text-emerald-100">{nc.sri_numero_autorizacion || nc.autorizacion}</strong></span>
                {nc.sri_fecha_autorizacion && <span>Fecha: <strong className="text-emerald-100">{nc.sri_fecha_autorizacion}</strong></span>}
              </div>
            </div>
          )}

          {/* ENCABEZADO FISCAL */}
          <div className="border-b-2 border-slate-200 bg-slate-50/50 px-6 py-5">
            <div className="grid grid-cols-12 gap-4">
              {/* EMISOR */}
              <div className="col-span-12 md:col-span-5">
                <div className="mb-2 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white font-black text-lg shadow-sm">
                    {(empresa?.nombre_comercial || "MN").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-tight">
                      {empresa?.nombre_comercial || "Mundo Navideño 365"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium">Nota de Crédito Electrónica</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-600 border-l-2 border-slate-300 pl-3">
                  <p><strong className="text-slate-800">RUC:</strong> {empresa?.ruc || "1790000000001"}</p>
                  <p><strong className="text-slate-800">Dirección:</strong> {empresa?.direccion || "—"}</p>
                  <p><strong className="text-slate-800">Teléfono:</strong> {empresa?.telefono || "—"}</p>
                </div>
              </div>

              {/* DATOS COMPROBANTE NC */}
              <div className="col-span-12 md:col-span-3 flex flex-col items-center justify-center text-center border-y md:border-y-0 md:border-x border-slate-200 py-3 md:py-0 px-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-3 py-1 text-[10px] font-bold tracking-wider uppercase mb-2">
                  Nota de Crédito
                </span>
                <p className="text-xs font-semibold text-slate-500">Número de Comprobante</p>
                <p className="text-xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                  {numeroNC}
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Fecha Emisión: <strong>{fmtDate(nc.fecha)}</strong>
                </p>
              </div>

              {/* CLAVE DE ACCESO Y BARCODE */}
              <div className="col-span-12 md:col-span-4 flex flex-col items-end justify-center">
                {!!authValue && (
                  <div className="w-full max-w-[240px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 text-right">
                      Clave de Acceso SRI
                    </p>
                    <div className="rounded-xl border border-slate-200 bg-white p-2 text-center shadow-xs">
                      <canvas ref={barcodeCanvasRef} className="mx-auto block" />
                      <p className="mt-1 text-[8px] text-slate-500 font-mono break-all leading-tight">
                        {authValue}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DATOS SUSTENTO Y CLIENTE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 py-4 bg-white border-b border-slate-100">
            {/* Factura de Sustento */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/30 space-y-1.5 text-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
                Comprobante Modificado (Sustento)
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Tipo Comprobante:</span>
                <strong className="text-slate-900">Factura (01)</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Factura Modificada:</span>
                <strong className="text-slate-900 font-mono">{numeroFactura}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Fecha Factura:</span>
                <span className="text-slate-800 font-semibold">{fmtDate(venta?.fecha)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-500 font-medium">Motivo Modificación:</span>
                <span className="text-slate-900 font-bold italic">{nc.motivo || "Devolución de mercadería"}</span>
              </div>
            </div>

            {/* Datos del Cliente */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/30 space-y-1.5 text-xs">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">
                Datos del Comprador / Cliente
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Razón Social / Nombre:</span>
                <strong className="text-slate-900">{cliente?.nombres || "CONSUMIDOR FINAL"}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Identificación (RUC/CI):</span>
                <strong className="text-slate-900 font-mono">{cliente?.ci_o_ruc || "9999999999999"}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Teléfono:</span>
                <span className="text-slate-800">{cliente?.telefono || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Correo Electrónico:</span>
                <span className="text-slate-800">{cliente?.correo || cliente?.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* TABLA DE PRODUCTOS DEVUELTOS */}
          <div className="px-6 py-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
              Detalle de Productos Devueltos / Modificados
            </h3>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-900 text-white font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Código</th>
                    <th className="px-3 py-2.5 text-left">Descripción Producto</th>
                    <th className="px-3 py-2.5 text-right">Cant. Devuelta</th>
                    <th className="px-3 py-2.5 text-right">Precio Unit. (c/IVA)</th>
                    <th className="px-3 py-2.5 text-right">Desc.</th>
                    <th className="px-3 py-2.5 text-right">IVA</th>
                    <th className="px-3 py-2.5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {detalles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400 font-medium">
                        Sin productos cargados en esta nota de crédito.
                      </td>
                    </tr>
                  )}
                  {detalles.map((d, i) => {
                    const subtotalLinea = d.cantidad * d.precio - (d.descuento || 0);
                    return (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                        <td className="px-3 py-2 font-mono text-slate-600">{d.codigo ?? d.producto_id}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{d.nombre ?? "Producto"}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-800">{d.cantidad}</td>
                        <td className="px-3 py-2 text-right text-slate-700">${fmtCurrency(d.precio)}</td>
                        <td className="px-3 py-2 text-right text-rose-600">${fmtCurrency(d.descuento || 0)}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{Number(d.iva) === 15 ? "15%" : "0%"}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">${fmtCurrency(subtotalLinea)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* TOTALES */}
          <div className="px-6 py-4 bg-slate-50/40 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="text-xs text-slate-500 space-y-1">
              <p>• Comprobante emitido según normativa del Servicio de Rentas Internas del Ecuador (SRI).</p>
              <p>• Al autorizar la nota de crédito, el valor devuelto se ajusta contablemente sobre la factura de origen.</p>
            </div>

            <div className="w-full md:w-80 rounded-xl border border-slate-200 bg-white p-4 space-y-1.5 text-xs shadow-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 0%:</span>
                <span className="font-semibold text-slate-900">${fmtCurrency(nc.impuesto_0)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal 15%:</span>
                <span className="font-semibold text-slate-900">${fmtCurrency(nc.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>IVA 15%:</span>
                <span className="font-semibold text-slate-900">${fmtCurrency(nc.impuesto_15)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Descuento:</span>
                <span className="font-semibold text-rose-600">-${fmtCurrency(nc.descuento)}</span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>TOTAL A DEVOLVER:</span>
                <span className="text-emerald-600">${fmtCurrency(nc.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
