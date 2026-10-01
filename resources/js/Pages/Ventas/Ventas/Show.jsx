import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import useCan from '@/Hooks/useCan';
import {
  FiChevronLeft,
  FiEdit2,
  FiDollarSign,
  FiCreditCard,
  FiFileText,
  FiPlus,
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
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {(estado || 'creada').toUpperCase()}
    </span>
  );
}

export default function Show({ initial }) {
  const can = useCan();
  const canCreate = can('ventas.create');
  const canEdit = can('ventas.edit');

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

  // ====== CÓDIGO DE BARRAS: canvas (vista) + overlay en PDF ======
  const sheetRef = useRef(null);
  const barcodeBoxRef = useRef(null);
  const barcodeCanvasRef = useRef(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState('');

  const authValue = (v.autorizacion || v.clave_acceso || '').toString().replace(/\s+/g, '');

  async function renderBarcodeToCanvas(canvas, value) {
    if (!canvas || !value) return '';
    const { default: JsBarcode } = await import('jsbarcode');

    const cssWidth = 200;
    const cssHeight = 64;

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
      fontSize: 12,
      textMargin: 4,
      margin: 0,
      width: 1.2,
      height: 42,
      background: '#ffffff',
      lineColor: '#111111',
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

      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      const pageImg = canvas.toDataURL('image/png');

      pdf.addImage(pageImg, 'PNG', 0, position, imgW, imgH);
      heightLeft -= pageH;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgH;
        pdf.addImage(pageImg, 'PNG', 0, position, imgW, imgH);
        heightLeft -= pageH;
      }

      if (barcodeDataUrl && barcodeBoxRef.current) {
        const sheetRect = el.getBoundingClientRect();
        const boxRect   = barcodeBoxRef.current.getBoundingClientRect();
        const ratio = pageW / sheetRect.width;

        const x = (boxRect.left - sheetRect.left) * ratio;
        const y = (boxRect.top  - sheetRect.top ) * ratio;
        const w = boxRect.width * ratio;
        const h = boxRect.height * ratio;

        pdf.setPage(1);
        pdf.addImage(barcodeDataUrl, 'PNG', x, y, w, h);
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      alert('Para exportar a PDF instala: npm i jspdf html2canvas');
      console.error(e);
    }
  };

  const [loadingNuevaVenta, setLoadingNuevaVenta] = useState(false);

  function nuevaVenta() {
    setLoadingNuevaVenta(true);
    router.get(route('ventas.ventas.vista_cliente'), {}, {
      onFinish: () => setLoadingNuevaVenta(false),
    });
  }

  // ======= BLOQUEO DE EDICIÓN SI ESTA AUTORIZADA =======
  const estadoNorm = normalizeEstado(v.estado);
  const esAutorizada = estadoNorm === 'AUTORIZADO';

  return (
    <AdminLayout title={`Venta ${invoiceNo ? `#${invoiceNo}` : ''}`}>
      <Head title={`Venta ${invoiceNo ? `#${invoiceNo}` : ''}`} />

      <div className="mx-auto max-w-6xl px-4 py-6 print:px-0">
        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={route('ventas.ventas.index')}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
            >
              <FiChevronLeft className="h-4 w-4" />
              Volver
            </Link>
            <h1 className="text-lg font-semibold text-primary-900">
              Factura <span className="text-primary-600">Nro</span> {invoiceNo}
            </h1>
            <BadgeEstado estado={v.estado} />
          </div>

          <div className="flex items-center gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={nuevaVenta}
                disabled={loadingNuevaVenta}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-700 disabled:opacity-75"
              >
                {loadingNuevaVenta ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Abriendo nueva venta...</span>
                  </>
                ) : (
                  <>
                    <FiPlus className="h-4 w-4" />
                    <span>Nueva venta</span>
                  </>
                )}
              </button>
            )}
            {/* Botón Editar: oculto si no tiene permiso, o si AUTORIZADA */}
            {canEdit && (
              esAutorizada ? (
                <button
                  type="button"
                  aria-disabled
                  title="Venta autorizada: solo lectura"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                  onClick={(e) => e.preventDefault()}
                >
                  <FiEdit2 className="h-4 w-4" />
                  Editar
                </button>
              ) : (
                <Link
                  href={route('ventas.ventas.vista_productos', v.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
                >
                  <FiEdit2 className="h-4 w-4" />
                  Editar
                </Link>
              )
            )}

            <button
              onClick={exportPDF}
              className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
              title="Ver PDF (blob)"
            >
              <FiFileText className="h-4 w-4" />
              Ver PDF
            </button>
          </div>
        </div>

        {/* FACTURA */}
        <div
          id="invoice-sheet"
          ref={sheetRef}
          className="rounded-2xl border border-primary-200 bg-white shadow-sm print:shadow-none print:border-0"
        >
          {/* Encabezado */}
          <div className="grid grid-cols-1 gap-4 border-b border-gray-100 p-6 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-900 font-bold text-white">
                  {(empresa?.nombre_comercial || 'MN').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-semibold leading-tight text-primary-900">
                    {empresa?.nombre_comercial || 'Mi Empresa'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    RUC: {empresa?.ruc || '0000000000001'} · Dirección: {empresa?.direccion || '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500">
                    {empresa?.telefono ? `Tel: ${empresa.telefono}` : ''}{' '}
                    {empresa?.email ? `· Email: ${empresa.email}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 md:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Factura</p>
              <p className="text-xs text-gray-500">Fecha: {fmtDate(v.fecha)}</p>

              {/* Numeración grande */}
              <div className="mt-2 inline-flex flex-col items-end gap-0.5 rounded-lg bg-primary-50 px-2 py-1 text-[25px] text-primary-700 ring-1 ring-gray-100">
                <span>
                  <b>{v.estab || '—'}</b>-<b>{v.pto_emision || '—'}</b>-<b>{v.secuencial || '—'}</b>
                </span>
              </div>

              {/* Autorización con código de barras */}
              {!!authValue && (
                <div className="mt-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                    Clave de Acceso / Autorización
                  </p>

                  <div
                    ref={barcodeBoxRef}
                    className="mt-2 inline-block rounded-md border border-gray-200 bg-white px-3 py-3 text-center"
                    style={{ width: 280 }}
                  >
                    <canvas
                      ref={barcodeCanvasRef}
                      aria-label="Código de barras autorización"
                      className="mx-auto block"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info cliente + Resumen */}
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
            <div className="rounded-xl bg-primary-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Cliente</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">Nombre</span>
                <span className="font-medium">{cliente?.nombres || cliente?.nombre || '—'}</span>
                <span className="text-gray-500">Identificación</span>
                <span className="font-medium">{cliente?.ci_o_ruc || cliente?.identificacion || '—'}</span>
                <span className="text-gray-500">Teléfono</span>
                <span className="font-medium">{cliente?.telefono || '—'}</span>
                <span className="text-gray-500">Correo</span>
                <span className="font-medium">{cliente?.correo || cliente?.email || '—'}</span>
                <span className="text-gray-500">Dirección</span>
                <span className="font-medium">{cliente?.direccion || '—'}</span>
              </div>
            </div>

            <div className="rounded-xl bg-primary-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Resumen</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">Estado</span>
                <span className="font-medium">{(v.estado || '').toUpperCase()}</span>
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">{fmtCurrency(v.subtotal)}</span>
                <span className="text-gray-500">IVA 15%</span>
                <span className="font-medium">{fmtCurrency(v.impuesto_15)}</span>
                <span className="text-gray-500">Descuento</span>
                <span className="font-medium">-{fmtCurrency(v.descuento)}</span>
                <span className="text-gray-500">Total</span>
                <span className="text-base font-semibold text-primary-900">{fmtCurrency(v.total)}</span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="px-6 pb-6">
            <div className="overflow-hidden rounded-xl border border-primary-200">
              <table className="min-w-full divide-y divide-primary-200">
                <thead className="bg-primary-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-primary-600">
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-right">Desc.</th>
                    <th className="px-4 py-3 text-right">Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                        Sin productos
                      </td>
                    </tr>
                  )}
                  {items.map((it, idx) => {
                    const sub =
                      Math.max(
                        0,
                        (Number(it.cantidad) || 0) * (Number(it.precio) || 0) - (Number(it.descuento) || 0)
                      );
                    return (
                      <tr key={idx} className="hover:bg-primary-50/60">
                        <td className="px-4 py-2">{it.producto?.codigo ?? '—'}</td>
                        <td className="px-4 py-2">{it.producto?.nombre ?? '—'}</td>
                        <td className="px-4 py-2 text-right">{it.cantidad}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(it.precio)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(it.descuento || 0)}</td>
                        <td className="px-4 py-2 text-right">{fmtCurrency(sub)}</td>
                      </tr>
                    );
                  })}
                  {/* Totales */}
                  <tr className="bg-primary-50/60">
                    <td className="px-4 py-2" colSpan={4}></td>
                    <td className="px-4 py-2 text-right text-[12px] text-primary-600">Subtotal</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtCurrency(v.subtotal)}</td>
                  </tr>
                  <tr className="bg-primary-50/60">
                    <td className="px-4 py-2" colSpan={4}></td>
                    <td className="px-4 py-2 text-right text-[12px] text-primary-600">IVA 15%</td>
                    <td className="px-4 py-2 text-right font-medium">{fmtCurrency(v.impuesto_15)}</td>
                  </tr>
                  <tr className="bg-primary-50/60">
                    <td className="px-4 py-2" colSpan={4}></td>
                    <td className="px-4 py-2 text-right text-[12px] text-primary-600">Descuento</td>
                    <td className="px-4 py-2 text-right font-medium">-{fmtCurrency(v.descuento)}</td>
                  </tr>
                  <tr className="bg-gray-100">
                    <td className="px-4 py-2" colSpan={4}></td>
                    <td className="px-4 py-2 text-right text-[12px] font-semibold">TOTAL</td>
                    <td className="px-4 py-2 text-right text-[15px] font-bold text-primary-900">
                      {fmtCurrency(v.total)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagos / Tarjeta */}
          <div className="grid grid-cols-1 gap-6 px-6 pb-6 md:grid-cols-2">
            <div className="rounded-xl border border-primary-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FiDollarSign className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-primary-700">Pagos recibidos</h3>
                </div>
              </div>
              <div className="p-4">
                {pagos.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin pagos registrados.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pagos.map((p, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm">
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium text-primary-800">
                            {p.nombre || p.codigo || 'Pago'}
                          </span>
                        </div>
                        <div className="font-semibold text-primary-900">{fmtCurrency(p.valor)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-primary-200">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-2">
                  <FiCreditCard className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-primary-700">Tarjeta</h3>
                </div>
              </div>
              <div className="p-4">
                {tarjetas.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin datos de tarjeta.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {tarjetas.map((t, i) => (
                      <li key={i} className="grid grid-cols-2 gap-x-3 gap-y-1 py-2 text-sm">
                        <span className="text-gray-500">Monto</span>
                        <span className="font-medium">{fmtCurrency(t.monto)}</span>
                        <span className="text-gray-500">Tipo</span>
                        <span className="font-medium">{t.tipo_tarjeta || '—'}</span>
                        <span className="text-gray-500">Plazo</span>
                        <span className="font-medium">{t.plazo ? `${t.plazo} meses` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Pie */}
          <div className="border-t border-gray-100 px-6 py-4 text-center text-[11px] text-gray-500">
            Documento generado por el sistema — {new Date().toLocaleString('es-EC')}
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:px-0 { padding-left: 0 !important; padding-right: 0 !important; }
          header, nav, .no-print, .inertia-progress { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          #invoice-sheet { box-shadow: none !important; border: 0 !important; }
        }
      `}</style>
    </AdminLayout>
  );
}
