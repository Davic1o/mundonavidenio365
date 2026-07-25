import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import {
  FiChevronLeft,
  FiEdit2,
  FiDollarSign,
  FiCreditCard,
  FiFileText,
  FiCheckCircle,
} from 'react-icons/fi';

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtCurrency(n) {
  return (Number(n) || 0).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}

/** Normaliza el estado para comparaciones robustas */
function normalizeEstado(s) {
  return String(s ?? '').toLowerCase().trim();
}

function BadgeEstado({ estado }) {
  const map = {
    creada: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    emitida: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    firmada: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    autorizado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    anulada: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  const cls = map[normalizeEstado(estado)] || map.creada;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {(estado || 'creada').toUpperCase()}
    </span>
  );
}

export default function Show({ initial }) {
  const v = initial ?? {};
  const cliente  = v.cliente ?? null;
  const items    = v.productosVendidos ?? [];
  const pagos    = v.pagos ?? [];
  const tarjetas = v.tarjetas ?? [];

  const empresa = v.empresa ?? {
    nombre_comercial: v.nombre_comercial,
    ruc: v.ruc_emisor,
    telefono: v.tel_emisor,
    email: v.email_emisor,
    direccion: v.dir_emisor,
  };

  const invoiceNo =
    v.numero ||
    [v.estab, v.pto_emision, v.secuencial].filter(Boolean).join('-') ||
    (v.id ? `#${v.id}` : '—');

  const totales = useMemo(
    () => [
      { label: 'Base 0%', value: v.base0 ?? v.impuesto_0 ?? 0 },
      { label: 'Base 15%', value: v.base15 ?? (v.subtotal - (v.impuesto_0 ?? 0)) ?? 0 },
      { label: 'Subtotal', value: v.subtotal ?? 0 },
      { label: 'IVA 15%', value: v.impuesto_15 ?? 0 },
      { label: 'Descuento', value: v.descuento ?? 0 },
      { label: 'TOTAL', value: v.total ?? 0, strong: true },
    ],
    [v]
  );

  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(String(txt || '')); } catch {}
  };

  // ====== CÓDIGO DE BARRAS ======
  const sheetRef = useRef(null);
  const barcodeBoxRef = useRef(null);
  const barcodeCanvasRef = useRef(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  const authValue = (v.autorizacion || v.clave_acceso || '').toString().replace(/\s+/g, '');

  async function renderBarcodeToCanvas(canvas, value) {
    if (!canvas || !value) return '';
    const { default: JsBarcode } = await import('jsbarcode');

    const cssWidth = 220;
    const cssHeight = 55;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    JsBarcode(canvas, value, {
      format: 'CODE128',
      displayValue: true,
      textAlign: 'center',
      fontOptions: 'bold',
      fontSize: 9,
      textMargin: 2,
      margin: 2,
      width: 1.1,
      height: 35,
      background: '#ffffff',
      lineColor: '#1e293b',
    });

    return canvas.toDataURL('image/png');
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!authValue) { setBarcodeDataUrl(''); return; }
      try {
        const url = await renderBarcodeToCanvas(barcodeCanvasRef.current, authValue);
        if (!cancelled) setBarcodeDataUrl(url || '');
      } catch (e) {
        console.error('Error dibujando barcode:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [authValue]);

  const exportPDF = async () => {
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const el = sheetRef.current;
      if (!el) return;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        foreignObjectRendering: false,
        logging: false,
      });

      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      // Márgenes laterales de 48pt (~1.7cm cada lado)
      const margin = 48;
      const imgW = pageW - (margin * 2);
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const pageImg = canvas.toDataURL('image/png');

      pdf.addImage(pageImg, 'PNG', margin, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgH;
        pdf.addImage(pageImg, 'PNG', margin, position, imgW, imgH);
        heightLeft -= pageH;
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      alert('Para exportar a PDF instala: npm i jspdf html2canvas');
      console.error(e);
    }
  };

  const estadoNorm = normalizeEstado(v.estado);
  const esAutorizada = estadoNorm === 'autorizado';

  return (
    <AdminLayout title={`Factura ${invoiceNo}`}>
      <Head title={`Factura ${invoiceNo}`} />

      <div className="mx-auto max-w-6xl px-4 py-6 print:px-0">
        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={route('admin.ventas.index')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-400"
            >
              <FiChevronLeft className="h-4 w-4" />
              Volver
            </Link>
            <h1 className="text-xl font-bold text-slate-900">
              Factura <span className="text-primary-600">#{invoiceNo}</span>
            </h1>
            <BadgeEstado estado={v.estado} />
          </div>

          <div className="flex items-center gap-2">
            {esAutorizada ? (
              <button
                type="button"
                aria-disabled
                title="Venta autorizada: solo lectura"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-400 bg-slate-50 cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                <FiEdit2 className="h-4 w-4" />
                Editar
              </button>
            ) : (
              <Link
                href={route('admin.ventas.vista_productos', v.id)}
                className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 shadow-sm transition-all hover:bg-primary-100"
              >
                <FiEdit2 className="h-4 w-4" />
                Editar
              </Link>
            )}

            <button
              onClick={exportPDF}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-lg"
              title="Exportar PDF"
            >
              <FiFileText className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        {/* FACTURA PROFESIONAL */}
        <div
          id="invoice-sheet"
          ref={sheetRef}
          className="overflow-hidden rounded-2xl bg-white shadow-xl print:shadow-none print:rounded-none"
          style={{ border: '1px solid #e2e8f0' }}
        >
          {/* ENCABEZADO OPTIMIZADO PARA IMPRESIÓN */}
          <div className="relative border-b-2 border-slate-300 bg-white px-6 py-4 print-no-bg print-border">
            <div className="grid grid-cols-12 gap-4">
              {/* COLUMNA IZQUIERDA: Datos de la empresa */}
              <div className="col-span-12 md:col-span-4">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-slate-800 bg-white text-base font-black text-slate-900">
                    {(empresa?.nombre_comercial || 'MN').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight text-slate-900">
                      {empresa?.nombre_comercial || 'Mi Empresa'}
                    </h2>
                    <p className="text-[9px] text-slate-600">Facturación Electrónica</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 text-[10px] text-slate-700 border-l-2 border-slate-300 pl-2">
                  <p><span className="font-semibold">RUC:</span> {empresa?.ruc || '0000000000001'}</p>
                  <p><span className="font-semibold">Dir:</span> {empresa?.direccion || '—'}</p>
                  <p><span className="font-semibold">Tel:</span> {empresa?.telefono || '—'}</p>
                  {empresa?.email && <p><span className="font-semibold">Email:</span> {empresa.email}</p>}
                </div>
              </div>

              {/* COLUMNA CENTRAL: Información de la factura */}
              <div className="col-span-12 md:col-span-4 flex flex-col items-center justify-center text-center">
                {/* Indicador de Ambiente */}
                {empresa?.ambiente && (
                  <div className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-[10px] font-bold mb-2 ${
                    empresa.ambiente === 2 
                      ? 'border-emerald-600 bg-white text-emerald-700' 
                      : 'border-amber-600 bg-white text-amber-700'
                  }`}>
                    {empresa.ambiente === 2 ? '🟢 PRODUCCIÓN' : '🟡 PRUEBAS'}
                  </div>
                )}
                
                <div className="mt-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-800">Factura Electrónica</p>
                  <p className="mt-1 text-[10px] text-slate-600">Fecha: {fmtDate(v.fecha)}</p>
                </div>

                {/* Numeración destacada */}
                <div className="mt-3 inline-flex flex-col items-center gap-0.5 rounded-lg border-2 border-slate-800 bg-white px-4 py-2">
                  <span className="text-[9px] font-medium text-slate-600">No. Factura</span>
                  <span className="text-2xl font-black tracking-tight text-slate-900">
                    {v.estab || '—'}-{v.pto_emision || '—'}-{v.secuencial || '—'}
                  </span>
                </div>
              </div>

              {/* COLUMNA DERECHA: Código de barras */}
              <div className="col-span-12 md:col-span-4 flex flex-col items-end justify-center">
                {!!authValue && (
                  <div className="w-full max-w-[230px]">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600 mb-1 text-right">
                      Clave de Acceso
                    </p>
                    <div
                      ref={barcodeBoxRef}
                      className="rounded-md border border-slate-300 bg-white p-2"
                    >
                      <canvas
                        ref={barcodeCanvasRef}
                        aria-label="Código de barras autorización"
                        className="mx-auto block"
                      />
                    </div>
                    <p className="mt-1 text-[8px] text-slate-500 text-center break-all">
                      {authValue}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* INFORMACIÓN CLIENTE Y RESUMEN */}
          <div className="grid grid-cols-1 gap-4 px-6 py-3 md:grid-cols-2 print-light-bg">
            {/* Cliente */}
            <div className="rounded-lg border border-slate-300 bg-white p-3 print-compact">
              <div className="mb-2 flex items-center gap-2 border-b border-slate-200 pb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-400 text-slate-700">
                  <FiCheckCircle className="h-3 w-3" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">Datos del Cliente</h3>
              </div>
              <div className="space-y-1 text-xs">
                <div className="grid grid-cols-3 gap-1">
                  <span className="font-medium text-slate-500">Nombre:</span>
                  <span className="col-span-2 font-semibold text-slate-900">{cliente?.nombres || cliente?.nombre || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="font-medium text-slate-500">CI/RUC:</span>
                  <span className="col-span-2 font-semibold text-slate-900">{cliente?.ci_o_ruc || cliente?.identificacion || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="font-medium text-slate-500">Teléfono:</span>
                  <span className="col-span-2 font-semibold text-slate-900">{cliente?.telefono || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="font-medium text-slate-500">Email:</span>
                  <span className="col-span-2 font-semibold text-slate-900">{cliente?.correo || cliente?.email || '—'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <span className="font-medium text-slate-500">Dirección:</span>
                  <span className="col-span-2 font-semibold text-slate-900">{cliente?.direccion || '—'}</span>
                </div>
              </div>
            </div>

            {/* Resumen */}
            <div className="rounded-lg border-2 border-slate-400 bg-white p-3 print-compact">
              <div className="mb-2 flex items-center gap-2 border-b border-slate-300 pb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-600 text-slate-700">
                  <FiDollarSign className="h-3 w-3" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">Resumen de Pago</h3>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Estado:</span>
                  <span className="font-bold text-slate-900">{(v.estado || '').toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-900">{fmtCurrency(v.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">IVA 15%:</span>
                  <span className="font-semibold text-slate-900">{fmtCurrency(v.impuesto_15)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-slate-600">Descuento:</span>
                  <span className="font-semibold text-red-600">-{fmtCurrency(v.descuento)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t-2 border-slate-800 pt-2">
                  <span className="text-sm font-black text-slate-900">TOTAL:</span>
                  <span className="text-lg font-black text-slate-900">{fmtCurrency(v.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TABLA DE PRODUCTOS */}
          <div className="px-6 py-3">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">Detalle de Productos</h3>
            <div className="overflow-hidden rounded-lg border border-slate-300">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-white border-b-2 border-slate-800 print-no-bg">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-900">
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Descripción</th>
                    <th className="px-2 py-2 text-right">Cant.</th>
                    <th className="px-2 py-2 text-right">Precio Unit.</th>
                    <th className="px-2 py-2 text-right">Desc.</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-[10px]">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2 py-4 text-center text-slate-500">
                        Sin productos registrados
                      </td>
                    </tr>
                  )}
                  {items.map((it, idx) => {
                    const sub = Math.max(
                      0,
                      (Number(it.cantidad) || 0) * (Number(it.precio) || 0) - (Number(it.descuento) || 0)
                    );
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-2 py-1.5 font-mono text-[9px] text-slate-600">{it.producto?.codigo ?? '—'}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-900">{it.producto?.nombre ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-700">{it.cantidad}</td>
                        <td className="px-2 py-1.5 text-right text-slate-700">{fmtCurrency(it.precio)}</td>
                        <td className="px-2 py-1.5 text-right text-red-600">{fmtCurrency(it.descuento || 0)}</td>
                        <td className="px-2 py-1.5 text-right font-bold text-slate-900">{fmtCurrency(sub)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-white print-light-bg">
                  <tr className="border-t-2 border-slate-300">
                    <td colSpan={4} className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-right text-[10px] font-semibold text-slate-700">Subtotal:</td>
                    <td className="px-2 py-1.5 text-right text-[10px] font-bold text-slate-900">{fmtCurrency(v.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-2 py-1"></td>
                    <td className="px-2 py-1 text-right text-[10px] font-semibold text-slate-700">IVA 15%:</td>
                    <td className="px-2 py-1 text-right text-[10px] font-bold text-slate-900">{fmtCurrency(v.impuesto_15)}</td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="px-2 py-1"></td>
                    <td className="px-2 py-1 text-right text-[10px] font-semibold text-slate-700">Descuento:</td>
                    <td className="px-2 py-1 text-right text-[10px] font-bold text-red-600">-{fmtCurrency(v.descuento)}</td>
                  </tr>
                  <tr className="border-t-2 border-slate-800">
                    <td colSpan={4} className="px-2 py-2"></td>
                    <td className="px-2 py-2 text-right text-xs font-black uppercase text-slate-900">Total:</td>
                    <td className="px-2 py-2 text-right text-base font-black text-slate-900">{fmtCurrency(v.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* PAGOS Y TARJETAS */}
          <div className="grid grid-cols-1 gap-3 px-6 py-2 md:grid-cols-2 print-light-bg">
            {/* Pagos */}
            <div className="rounded-lg border border-slate-300 bg-white print-compact">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <FiDollarSign className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-700">Pagos Recibidos</h3>
              </div>
              <div className="p-2">
                {pagos.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin pagos registrados.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {pagos.map((p, i) => (
                      <li key={i} className="flex items-center justify-between py-1.5 text-xs">
                        <span className="font-medium text-slate-700">{p.nombre || p.codigo || 'Pago'}</span>
                        <span className="font-bold text-emerald-700">{fmtCurrency(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Tarjetas */}
            <div className="rounded-lg border border-slate-300 bg-white print-compact">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                <FiCreditCard className="h-4 w-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-700">Información de Tarjeta</h3>
              </div>
              <div className="p-2">
                {tarjetas.length === 0 ? (
                  <p className="text-xs text-slate-500">Sin datos de tarjeta.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {tarjetas.map((t, i) => (
                      <li key={i} className="grid grid-cols-2 gap-x-2 gap-y-1 py-1.5 text-xs">
                        <span className="text-slate-500">Monto:</span>
                        <span className="font-bold text-slate-900">{fmtCurrency(t.monto)}</span>
                        <span className="text-slate-500">Tipo:</span>
                        <span className="font-medium text-slate-900">{t.tipo_tarjeta || '—'}</span>
                        <span className="text-slate-500">Plazo:</span>
                        <span className="font-medium text-slate-900">{t.plazo ? `${t.plazo} meses` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* FOOTER SIMPLE */}
          <div className="border-t border-slate-300 bg-white px-6 py-3 text-center print-light-bg">
            <p className="text-[10px] font-medium text-slate-600">
              Documento generado electrónicamente — {new Date().toLocaleString('es-EC')}
            </p>
            <p className="mt-0.5 text-[9px] text-slate-500">
              Este documento es válido sin firma ni sello según la normativa vigente de facturación electrónica
            </p>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
          header, nav, .no-print, .inertia-progress { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #invoice-sheet { 
            box-shadow: none !important; 
            border: 1px solid #000 !important;
            font-size: 11px !important;
          }
          /* Eliminar fondos oscuros para ahorrar tinta */
          .print-no-bg {
            background: white !important;
            color: #000 !important;
          }
          .print-border {
            border: 2px solid #000 !important;
          }
          .print-light-bg {
            background: white !important;
          }
          /* Reducir espaciado para que quepa en una página */
          .print-compact {
            padding: 0.25rem !important;
            margin: 0.25rem 0 !important;
          }
          table thead {
            background: white !important;
            border-bottom: 2px solid #000 !important;
          }
          table thead th {
            color: #000 !important;
            font-weight: bold !important;
          }
          table tfoot {
            background: white !important;
          }
        }
      `}</style>
    </AdminLayout>
  );
}
