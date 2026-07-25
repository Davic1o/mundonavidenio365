import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import NavbarPublic from '@/Components/Nabvar';
import BaseModal from '@/Components/BaseModal';
import { FiSearch, FiUser, FiExternalLink, FiFileText, FiDownload, FiPrinter } from 'react-icons/fi';

/* ========================= Helpers genéricos ========================= */
const getData = (p) => Array.isArray(p) ? p : (p?.data ?? []);
const getLinks = (p) => p?.links ?? null;

function Pagination({ page }) {
  const links = getLinks(page);
  if (!links) return null;
  return (
    <nav className="mt-4 flex flex-wrap gap-2">
      {links.map((l, i) => {
        const label = l.label
          .replace('&laquo; Previous', '«')
          .replace('Next &raquo;', '»')
          .replace(/&laquo;|&raquo;/g, (m) => (m === '&laquo;' ? '«' : '»'));
        return l.url ? (
          <Link
            key={i}
            href={l.url}
            preserveScroll
            preserveState
            className={[
              'px-3 py-1.5 rounded-lg border text-sm',
              l.active
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700',
            ].join(' ')}
          >
            <span dangerouslySetInnerHTML={{ __html: label }} />
          </Link>
        ) : (
          <span
            key={i}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-400"
            dangerouslySetInnerHTML={{ __html: label }}
          />
        );
      })}
    </nav>
  );
}

function Kpi({ title, value, color = 'emerald' }) {
  const ring =
    color === 'emerald'
      ? 'ring-emerald-200 text-emerald-800 bg-emerald-50'
      : color === 'slate'
      ? 'ring-slate-200 text-slate-800 bg-slate-50'
      : 'ring-rose-200 text-rose-800 bg-rose-50';

  return (
    <div className={`rounded-xl ${ring} ring-1 px-4 py-3`}>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-EC');
}
function money(n) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
}

/* ========================= Badge estado (mini) ========================= */
function BadgeEstadoMini({ estado }) {
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-600/20">
      {(estado ?? '—').toString().toUpperCase()}
    </span>
  );
}

/* ========================= Utils de visibilidad ========================= */
function waitVisible(el, timeout = 600) {
  const t0 = performance.now();
  return new Promise((resolve) => {
    (function check() {
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return resolve();
      if (performance.now() - t0 > timeout) return resolve();
      requestAnimationFrame(check);
    })();
  });
}

/* ========================= MODAL FACTURA COMPLETO ========================= */
function fmtCurrency(n) {
  return (Number(n) || 0).toLocaleString('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
}
function BadgeEstado({ estado }) {
  const map = {
    creada: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    emitida: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    autorizada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    anulada: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    borrador: 'bg-primary-50 text-primary-700 ring-primary-600/20',
  };
  const cls = map[(estado || '').toLowerCase()] || map.creada;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {(estado || 'CREADA').toUpperCase()}
    </span>
  );
}

/** ModalFactura: exporta PDF tal cual se ve el modal (1 sola página A4, sin overlays) */
function ModalFactura({ open, onClose, venta, empresa }) {
  const v = venta ?? {};
  const cliente  = v.cliente ?? null;
  const items    = v.productosVendidos ?? [];
  const pagos    = v.pagos ?? [];
  const tarjetas = v.tarjetas ?? [];

  const invoiceNo =
    v.numero ||
    [v.estab, v.pto_emision, v.secuencial].filter(Boolean).join('-') ||
    (v.id ? `#${v.id}` : '—');

  // ====== Refs y estado ======
  const sheetRef = useRef(null);
  const barcodeSvgRef = useRef(null);   // <— usamos SVG en vez de canvas
  const [barcodeReady, setBarcodeReady] = useState(false);
  const rawAuth = (v.autorizacion || v.clave_acceso || '').toString();
  const authValue = rawAuth.replace(/\s+/g, '');

  // ====== Render del código de barras (SVG) ======
  async function renderBarcodeToSVG(svgEl, value) {
    if (!svgEl || !value) return;

    // Limpieza de nodos previos (si se re-renderiza)
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    const { default: JsBarcode } = await import('jsbarcode');

    // Generar el código
    JsBarcode(svgEl, value, {
      xmlDocument: document,
      format: 'CODE128',
      displayValue: true,
      textAlign: 'center',
      fontOptions: 'bold',
      fontSize: 12,
      textMargin: 4,
      margin: 0,
      width: 1.2,
      height: 50,
      background: '#ffffff',
      lineColor: '#111111',
    });

    // viewBox para que escale bien si cambias el contenedor
    if (!svgEl.getAttribute('viewBox')) {
      const w = Number(svgEl.getAttribute('width')) || 320;
      const h = Number(svgEl.getAttribute('height')) || 80;
      svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBarcodeReady(false);

      if (!open) return; // modal cerrado
      const value = (authValue || '').replace(/\s+/g, '');
      if (!value) { setBarcodeReady(true); return; }

      // 1) Esperar que el contenedor esté visible (tras la animación del modal)
      const host = barcodeSvgRef.current?.parentElement; // div con borde
      if (host) await waitVisible(host);

      // 2) doble RAF para asegurar layout listo
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      try {
        await renderBarcodeToSVG(barcodeSvgRef.current, value);
      } catch (e) {
        console.error('Error barcode SVG:', e);
      } finally {
        if (!cancelled) setBarcodeReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [open, authValue]);

  // ====== PDF (tal cual modal), anclado arriba con poco margen ======
  const waitForFontsAndSVG = async () => {
    try { if (document.fonts?.ready) await document.fonts.ready; } catch {}
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  };

  const buildPDF = async () => {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const el = sheetRef.current;
    if (!el) return null;

    await waitForFontsAndSVG();

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      foreignObjectRendering: false,
      logging: false,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const pdf = new jsPDF('p', 'pt', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgWpx = canvas.width;
    const imgHpx = canvas.height;
    const imgData = canvas.toDataURL('image/png');

    // Márgenes pequeños y anclado arriba
    const marginX = 18;     // ~6.3 mm
    const marginTop = 12;   // ~4.2 mm
    const marginBottom = 12;

    const maxW = pageW - marginX * 2;
    const maxH = pageH - marginTop - marginBottom;

    const ratio = Math.min(maxW / imgWpx, maxH / imgHpx);
    const drawW = imgWpx * ratio;
    const drawH = imgHpx * ratio;

    const offsetX = (pageW - drawW) / 2; // centrado horizontal
    const offsetY = marginTop;           // pegado arriba

    pdf.addImage(imgData, 'PNG', offsetX, offsetY, drawW, drawH);
    return pdf;
  };

  const previewPDF = async () => {
    try {
      const pdf = await buildPDF();
      if (!pdf) return;
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      alert('Para exportar a PDF instala: npm i jspdf html2canvas');
      console.error(e);
    }
  };

  const downloadPDF = async () => {
    try {
      const pdf = await buildPDF();
      if (!pdf) return;
      const filename = `factura_${invoiceNo || v.id || 'documento'}.pdf`;
      pdf.save(filename);
    } catch (e) {
      alert('Para exportar a PDF instala: npm i jspdf html2canvas');
      console.error(e);
    }
  };

  const handlePrint = () => {
    const html = sheetRef.current?.outerHTML || '';
    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) return;
    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>Imprimir factura</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, "Helvetica Neue", Arial; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border-color: #e5e7eb; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  return (
    <BaseModal open={open} onClose={onClose} title={`Factura ${invoiceNo ? `#${invoiceNo}` : ''}`} maxWidth="6xl">
      {/* Acciones */}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button onClick={previewPDF} className="inline-flex items-center gap-2 rounded-md border border-primary-200 bg-white px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">
          <FiFileText className="h-4 w-4" /> Ver PDF
        </button>
        <button onClick={downloadPDF} className="inline-flex items-center gap-2 rounded-md border border-primary-200 bg-white px-3 py-2 text-sm text-primary-700 hover:bg-primary-50">
          <FiDownload className="h-4 w-4" /> Descargar
        </button>

        <button onClick={onClose} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Cerrar
        </button>
      </div>

      {/* Contenido scrolleable */}
      <div className="max-h-[75vh] overflow-y-auto rounded-xl border border-primary-200 bg-white shadow-sm">
        <div id="invoice-sheet" ref={sheetRef}>
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
                    {empresa?.telefono ? `Tel: ${empresa.telefono}` : ''}{empresa?.email ? ` · Email: ${empresa.email}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-1 md:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Factura</p>
              <p className="text-xs text-gray-500">Fecha: {fmtDate(v.fecha)}</p>

              <div className="mt-2 inline-flex flex-col items-end gap-0.5 rounded-lg bg-primary-50 px-2 py-1 text-[25px] text-primary-700 ring-1 ring-gray-100">
                <span>
                  <b>{v.estab}-{v.pto_emision}-{v.secuencial}</b>
                </span>
              </div>

              {/* Autorización (SVG capturable por html2canvas) */}
              <div className="mt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
                  Clave de Acceso
                </p>
                <div
                  className="mt-2 inline-block rounded-md border border-gray-200 px-3 py-3 text-center"
                  style={{ width: 405 }}
                >
                  {(!authValue?.trim()) && (
                    <div className="text-[20px] text-gray-500">Sin clave de acceso</div>
                  )}
                  <svg
                    ref={barcodeSvgRef}
                    aria-label="Código de barras autorización"
                    xmlns="http://www.w3.org/2000/svg"
                    width="320"
                    height="80"
                    style={{ display: 'block', margin: '0 auto', background: '#fff' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cliente + Resumen */}
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
                      <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Sin productos</td>
                    </tr>
                  )}
                  {items.map((it, idx) => {
                    const sub = Math.max(0,(Number(it.cantidad)||0)*(Number(it.precio)||0)-(Number(it.descuento)||0));
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
                    <td className="px-4 py-2 text-right text-[15px] font-bold text-primary-900">{fmtCurrency(v.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagos / Tarjeta */}
          <div className="grid grid-cols-1 gap-6 px-6 pb-6 md:grid-cols-2">
            <div className="rounded-xl border border-primary-200">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-primary-700">Pagos recibidos</h3>
              </div>
              <div className="p-4">
                {pagos.length === 0 ? (
                  <p className="text-sm text-gray-500">Sin pagos registrados.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {pagos.map((p, i) => (
                      <li key={i} className="flex items-center justify-between py-2 text-sm">
                        <span className="font-medium text-primary-800">{p.nombre || p.codigo || 'Pago'}</span>
                        <span className="font-semibold text-primary-900">{fmtCurrency(p.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-primary-200">
              <div className="border-b border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-primary-700">Tarjeta</h3>
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

          <div className="border-t border-gray-100 px-6 py-4 text-center text-[11px] text-gray-500">
            Documento generado por el sistema — {new Date().toLocaleString('es-EC')}
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

/* ========================= Página de Consulta ========================= */
export default function ConsultaFacturas({ doc: initialDoc = '', errors = {}, ventas = null, empresa = null }) {
  const [q, setQ] = useState({ doc: initialDoc ?? '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { setQ({ doc: initialDoc ?? '' }); }, [initialDoc]);

  const data = getData(ventas);
  const ultimaVenta = data[0] || null; // SOLO la última venta
  const totalReg = ventas?.total ?? data.length ?? 0;
  const totalAcum = useMemo(() => data.reduce((a, b) => a + (Number(b.total) || 0), 0), [data]);

  function cleanNumber(v) { return (v || '').replace(/\D+/g, ''); }

  function buscar(e) {
    e?.preventDefault();
    const doc = cleanNumber(q.doc);
    if (!doc || doc.length < 8 || doc.length > 13) {
      alert('Ingrese cédula (10) o RUC (13). Se permiten 8–13 por flexibilidad.');
      return;
    }
    setLoading(true);
    router.get(
      route('public.consulta'),
      { doc },
      { preserveScroll: true, preserveState: true, onFinish: () => setLoading(false) }
    );
  }

  function limpiar() {
    setQ({ doc: '' });
    setLoading(true);
    router.get(route('public.consulta'), {}, {
      preserveScroll: true, preserveState: false, onFinish: () => setLoading(false),
    });
  }

  // Modal factura
  const [openFactura, setOpenFactura] = useState(false);
  const [ventaSel, setVentaSel] = useState(null);
  function verEnModal(venta) {
    setVentaSel(venta);
    setOpenFactura(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-emerald-50">
      <Head title="Consultas — Sistema de Facturación" />
      <NavbarPublic active="consulta" />

      {/* Encabezado */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-2xl font-extrabold text-slate-900">Consulta de documentos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Consulta tus compras ingresando tu número de cédula o RUC.
        </p>

        {/* Buscador */}
        <form onSubmit={buscar} className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-slate-700">Número de Identificación</label>
              <div className="relative">
                <FiUser className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={q.doc}
                  onChange={(e) => setQ({ doc: cleanNumber(e.target.value) })}
                  placeholder="Ingrese su cédula o RUC"
                  className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-3 text-lg focus:border-emerald-500 focus:ring-emerald-500"
                  maxLength={13}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Ejemplo: 0912345678 (cédula) o 1790012345001 (RUC)</p>
              {errors?.doc && <div className="mt-1 text-sm text-rose-600">{errors.doc}</div>}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors disabled:opacity-60"
              >
                <FiSearch className="h-4 w-4" />
                {loading ? 'Buscando…' : 'Buscar'}
              </button>
              <button
                type="button"
                onClick={limpiar}
                disabled={loading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                Limpiar
              </button>
            </div>
          </div>
        </form>

        {/* KPIs */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi title="Resultados" value={String(totalReg)} />
          <Kpi title="Total acumulado (página)" value={money(totalAcum)} />
          <Kpi title="Estado" value={data.length ? 'EMITIDAS' : '—'} color={data.length ? 'emerald' : 'slate'} />
        </div>

        {/* Solo la ÚLTIMA venta en card superior */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ultimaVenta ? (
            <article className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{ultimaVenta.numero ?? '—'}</h3>
                <BadgeEstadoMini estado={ultimaVenta.estado} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-slate-500">Cliente</div>
                  <div className="font-medium text-slate-900">
                    {ultimaVenta.cliente?.nombre ?? ultimaVenta.cliente?.nombres ?? '—'}
                    {ultimaVenta.cliente?.ci_ruc ? (
                      <span className="text-slate-500"> — [{ultimaVenta.cliente.ci_ruc}]</span>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-slate-500">Fecha</div>
                  <div className="font-medium text-slate-900">{ultimaVenta.fecha ? fmtDate(ultimaVenta.fecha) : '—'}</div>
                </div>
                <div>
                  <div className="text-slate-500">Total</div>
                  <div className="font-semibold text-emerald-700">{money(ultimaVenta.total)}</div>
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => verEnModal(ultimaVenta)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                    title="Ver documento"
                  >
                    Ver documento <FiExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <FiUser className="mx-auto h-12 w-12 text-slate-400 mb-3" />
              <p className="text-sm text-slate-500 mb-1">No hay resultados para mostrar</p>
              <p className="text-xs text-slate-400">Ingrese su número de identificación para buscar sus compras</p>
            </div>
          )}
        </div>

        {/* Tabla con TODAS las ventas + paginación */}
        {data.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-xl border border-emerald-200 bg-white">
            <div className="border-b border-emerald-100 px-4 py-3 text-sm font-semibold text-emerald-800">Detalle de resultados</div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-emerald-200 text-sm">
                <thead className="bg-emerald-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    <th className="px-4 py-2">Número</th>
                    <th className="px-4 py-2">Fecha</th>
                    <th className="px-4 py-2">Cliente</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                    <th className="px-4 py-2 text-right">Imp 15%</th>
                    <th className="px-4 py-2 text-right">Imp 0%</th>
                    <th className="px-4 py-2 text-right">Desc</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-100">
                  {data.map((r) => (
                    <tr key={r.id} className="hover:bg-emerald-50/40">
                      <td className="px-4 py-2">{r.numero ?? '—'}</td>
                      <td className="px-4 py-2">{r.fecha ? fmtDate(r.fecha) : '—'}</td>
                      <td className="px-4 py-2">
                        {r.cliente?.nombre ?? r.cliente?.nombres ?? '—'}
                        {r.cliente?.ci_ruc ? <span className="text-slate-500"> — [{r.cliente.ci_ruc}]</span> : null}
                      </td>
                      <td className="px-4 py-2 text-right">{money(r.subtotal ?? 0)}</td>
                      <td className="px-4 py-2 text-right">{money(r.impuesto_15 ?? 0)}</td>
                      <td className="px-4 py-2 text-right">{money(r.impuesto_0 ?? 0)}</td>
                      <td className="px-4 py-2 text-right">{money(r.descuento ?? 0)}</td>
                      <td className="px-4 py-2 text-right font-semibold">{money(r.total ?? 0)}</td>
                      <td className="px-4 py-2"><BadgeEstadoMini estado={r.estado} /></td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => verEnModal(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50"
                          title="Ver documento"
                        >
                          Ver <FiExternalLink className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 pb-4">
              <Pagination page={ventas} />
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-sm text-slate-600">
          <div>© {new Date().getFullYear()} Sistema de Facturación</div>
          <div className="flex items-center gap-4">
            <a href={typeof route === 'function' && route().has?.('public.index') ? route('public.index') : '/'} className="hover:text-slate-800">Inicio</a>
            <a href="#" className="hover:text-slate-800">Contacto</a>
          </div>
        </div>
      </footer>

      {/* Modal de Factura */}
      <ModalFactura open={openFactura} onClose={() => setOpenFactura(false)} venta={ventaSel} empresa={empresa} />
    </div>
  );
}
