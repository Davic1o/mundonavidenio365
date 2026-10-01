import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import useCan from '@/Hooks/useCan';
import { FiSearch, FiPrinter, FiRefreshCw, FiSliders, FiSave } from 'react-icons/fi';
import BaseModal from '@/Components/BaseModal';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JsBarcode from 'jsbarcode';

/* -----------------------------
 * Helpers de paginación y formato
 * ----------------------------- */
const getData = (p) => Array.isArray(p) ? p : (p?.data ?? []);
const getLinks = (p) => p?.links ?? null;

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-EC', { dateStyle: 'short' });
}
function money(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat('es-EC', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 2
  }).format(v);
}

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
              'px-3 py-1.5 rounded-md border text-sm',
              l.active
                ? 'border-primary-600 text-primary-700 bg-primary-50'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700',
            ].join(' ')}
          >
            <span dangerouslySetInnerHTML={{ __html: label }} />
          </Link>
        ) : (
          <span
            key={i}
            className="px-3 py-1.5 rounded-md border border-slate-200 text-sm text-slate-400"
            dangerouslySetInnerHTML={{ __html: label }}
          />
        );
      })}
    </nav>
  );
}

/* -----------------------------
 * Calibración y conversión de unidades
 * ----------------------------- */
const MM_TO_PT = 72 / 25.4;
const PT_TO_MM = 25.4 / 72;
const mm = (n) => n * MM_TO_PT;
const pt2mm = (n) => n * PT_TO_MM;

/* Tamaños de papel (solo etiquetas para UI) */
const PAPER_SIZES = {
  a4:     { width: 595.28, height: 841.89, label: 'A4 (210×297mm)' },
  letter: { width: 612,    height: 792,    label: 'Carta (216×279mm)' },
};

/* ================================
 * Plantillas base por tipo (fallback)
 * ================================ */
const TEMPLATES = {
  grandes: {
    paperSize: 'letter',
    page: { ...PAPER_SIZES.letter },
    cols: 5, rows: 10, // 50 por hoja
    margin: { top: mm(7), right: mm(5), bottom: mm(7), left: mm(5) },
    gap: { x: mm(2), y: mm(2) },
    labelSize: null,
    fonts: { storeName: 8, productCode: 6, price: 10, barcode: { height: 16 } }
  },
  pequenas: {
    paperSize: 'letter',
    page: { ...PAPER_SIZES.letter },
    cols: 10, rows: 10, // 100 por hoja
    margin: { top: mm(7), right: mm(5), bottom: mm(7), left: mm(5) },
    gap: { x: mm(2), y: mm(2) },
    labelSize: null,
    fonts: { storeName: 7, productCode: 5.5, price: 9, barcode: { height: 14 } }
  }
};

/* ============================================================
 * Navegación con flechas entre inputs
 * ============================================================ */
function focusByArrow(e) {
  const isArrow = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key);
  if (!isArrow) return;
  const inputs = Array.from(document.querySelectorAll('input[data-nav="labels"]'));
  const idx = inputs.indexOf(e.currentTarget);
  if (idx === -1) return;

  let nextIdx = idx;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIdx = Math.max(0, idx - 1);
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIdx = Math.min(inputs.length - 1, idx + 1);

  if (nextIdx !== idx) {
    e.preventDefault();
    const next = inputs[nextIdx];
    next?.focus();
    next?.select?.();
  }
}

/* ============================================================
 * Input numérico con borrado permitido y normalización en blur
 * ============================================================ */
function useDraftNumber(valueProp) {
  const [draft, setDraft] = useState(valueProp ?? '');
  useEffect(() => { setDraft(valueProp ?? ''); }, [valueProp]);
  return [draft, setDraft];
}

function normalizeNumber(d, { min, max, fallback='0' }) {
  if (d === '' || d === null || d === undefined) return fallback;
  let n = Number(d);
  if (!Number.isFinite(n)) return fallback;
  if (typeof min === 'number') n = Math.max(min, n);
  if (typeof max === 'number') n = Math.min(max, n);
  return String(n);
}

/* ============================================================
 * Modal de Impresión (personalizado + guardar en BD)
 * ============================================================ */
function ModalImpresion({
  open,
  onClose,
  lotes = [],
  preselect = null,
  tienda = 'Mundo navideño 365',
  presetsTable = [],
}) {
  const can = useCan();
  const canPresets = can('etiquetas.presets');

  // Elecciones del usuario
  const [labelKind, setLabelKind] = useState('grandes'); // grandes | pequenas
  const [paper, setPaper] = useState('letter'); // letter | a4

  // Local "nombre" e "is_active" del preset
  const currentPreset = useMemo(() => {
    return presetsTable.find(p => p.categoria === labelKind && p.paper_size === paper) || null;
  }, [presetsTable, labelKind, paper]);

  const [presetNombre, setPresetNombre] = useState('');
  const [presetActivo, setPresetActivo] = useState(true);

  // Config editable (siempre personalizada) para la PREVIEW
  const [cfg, setCfg] = useState(() => ({ ...TEMPLATES.grandes }));

  // Sincroniza cfg y campos meta al cambiar tipo/papel o al cargar BD
  useEffect(() => {
    const basePaper = paper === 'a4' ? PAPER_SIZES.a4 : PAPER_SIZES.letter;
    if (!currentPreset) {
      // Fallback a plantilla
      const base = labelKind === 'grandes' ? TEMPLATES.grandes : TEMPLATES.pequenas;
      setCfg({ ...base, paperSize: paper, page: { ...basePaper } });
      setPresetNombre(`${labelKind} - ${paper.toUpperCase()}`);
      setPresetActivo(true);
      return;
    }
    // Cargar desde BD -> puntos/mm/pt
    const mmToPt = (mmv) => mm(Number(mmv || 0));
    const cfgFromDb = {
      paperSize: paper,
      page: { ...basePaper },
      cols: Number(currentPreset.cols || 1),
      rows: Number(currentPreset.rows || 1),
      margin: {
        top: mmToPt(currentPreset.margin_top_mm),
        right: mmToPt(currentPreset.margin_right_mm),
        bottom: mmToPt(currentPreset.margin_bottom_mm),
        left: mmToPt(currentPreset.margin_left_mm),
      },
      gap: {
        x: mmToPt(currentPreset.gap_x_mm),
        y: mmToPt(currentPreset.gap_y_mm),
      },
      labelSize: (currentPreset.label_w_mm && currentPreset.label_h_mm)
        ? { width: mmToPt(currentPreset.label_w_mm), height: mmToPt(currentPreset.label_h_mm) }
        : null,
      fonts: {
        storeName: Number(currentPreset.font_store_name_pt || 8),
        productCode: Number(currentPreset.font_product_code_pt || 6),
        price: Number(currentPreset.font_price_pt || 10),
        barcode: { height: Number(currentPreset.barcode_height_pt || 15) }
      }
    };
    setCfg(cfgFromDb);
    setPresetNombre(currentPreset.nombre || `${labelKind} - ${paper.toUpperCase()}`);
    setPresetActivo(!!currentPreset.is_active);
  }, [currentPreset, labelKind, paper]);

  // Derivados UI
  const derivedLabelSize = useMemo(() => {
    const { width: PW, height: PH } = cfg.page || {};
    const M = cfg.margin || { top:0, right:0, bottom:0, left:0 };
    const gapX = cfg.gap?.x ?? 0;
    const gapY = cfg.gap?.y ?? 0;
    const cols = Number(cfg.cols || 1);
    const rows = Number(cfg.rows || 1);

    let w = 0, h = 0;
    if (cfg.labelSize?.width > 0 && cfg.labelSize?.height > 0) {
      w = cfg.labelSize.width;
      h = cfg.labelSize.height;
    } else if (PW && PH) {
      w = (PW - (M.left + M.right) - gapX * (cols - 1)) / cols;
      h = (PH - (M.top + M.bottom) - gapY * (rows - 1)) / rows;
    }
    return { w, h };
  }, [cfg]);

  const ui = useMemo(() => ({
    paperSize: cfg.paperSize || 'a4',
    pageW: pt2mm(cfg.page.width).toFixed(2),
    pageH: pt2mm(cfg.page.height).toFixed(2),
    cols: String(cfg.cols),
    rows: String(cfg.rows),
    mTop: pt2mm(cfg.margin.top).toFixed(2),
    mRight: pt2mm(cfg.margin.right).toFixed(2),
    mBottom: pt2mm(cfg.margin.bottom).toFixed(2),
    mLeft: pt2mm(cfg.margin.left).toFixed(2),
    gX: pt2mm(cfg.gap.x).toFixed(2),
    gY: pt2mm(cfg.gap.y).toFixed(2),
    labelW: pt2mm(derivedLabelSize.w).toFixed(2),
    labelH: pt2mm(derivedLabelSize.h).toFixed(2),
    fontStoreName: String(cfg.fonts?.storeName || 8),
    fontProductCode: String(cfg.fonts?.productCode || 6),
    fontPrice: String(cfg.fonts?.price || 10),
    fontBarcodeHeight: String(cfg.fonts?.barcode?.height || 15),
  }), [cfg, derivedLabelSize]);

  function handleUiChange(part, value) {
    if (value === '') return;
    setCfg((prev) => {
      const n = JSON.parse(JSON.stringify(prev));
      if (part === 'paperSize') {
        const paperData = PAPER_SIZES[value] || PAPER_SIZES.a4;
        n.paperSize = value;
        n.page = { ...paperData };
        setPaper(value); // reflejar selección
      } else if (part === 'pageW') {
        n.page.width = mm(Number(value));
      } else if (part === 'pageH') {
        n.page.height = mm(Number(value));
      } else if (part === 'cols') {
        n.cols = Math.max(1, parseInt(value));
      } else if (part === 'rows') {
        n.rows = Math.max(1, parseInt(value));
      } else if (part === 'mTop') {
        n.margin.top = mm(Number(value));
      } else if (part === 'mRight') {
        n.margin.right = mm(Number(value));
      } else if (part === 'mBottom') {
        n.margin.bottom = mm(Number(value));
      } else if (part === 'mLeft') {
        n.margin.left = mm(Number(value));
      } else if (part === 'gX') {
        n.gap.x = mm(Number(value));
      } else if (part === 'gY') {
        n.gap.y = mm(Number(value));
      } else if (part === 'labelW') {
        if (!n.labelSize) n.labelSize = { width: 0, height: 0 };
        n.labelSize.width = mm(Number(value));
      } else if (part === 'labelH') {
        if (!n.labelSize) n.labelSize = { width: 0, height: 0 };
        n.labelSize.height = mm(Number(value));
      } else if (part === 'fontStoreName') {
        if (!n.fonts) n.fonts = {};
        n.fonts.storeName = Math.max(4, Math.min(20, Number(value)));
      } else if (part === 'fontProductCode') {
        if (!n.fonts) n.fonts = {};
        n.fonts.productCode = Math.max(4, Math.min(16, Number(value)));
      } else if (part === 'fontPrice') {
        if (!n.fonts) n.fonts = {};
        n.fonts.price = Math.max(4, Math.min(24, Number(value)));
      } else if (part === 'fontBarcodeHeight') {
        if (!n.fonts) n.fonts = {};
        if (!n.fonts.barcode) n.fonts.barcode = {};
        n.fonts.barcode.height = Math.max(8, Math.min(40, Number(value)));
      }
      return n;
    });
  }

  // ======== Lógica de impresión / preview ========
  const [loteId, setLoteId] = useState(preselect?.id ?? '');
  const [startAt, setStartAt] = useState(String(1));
  const [count, setCount] = useState(String(preselect?.cantidad_compra ?? 1));
  const [blobUrl, setBlobUrl] = useState(null);
  const printFrameRef = useRef(null);

  useEffect(() => {
    setLoteId(preselect?.id ?? '');
    setCount(String(preselect?.cantidad_compra ?? 1));
  }, [preselect?.id]);

  const totalSlots = (Number(cfg.cols) || 0) * (Number(cfg.rows) || 0);

  const selected = useMemo(
    () => lotes.find((x) => String(x.id) === String(loteId)) || preselect || null,
    [loteId, lotes, preselect]
  );

  const cells = useMemo(() => {
    const startNum = Math.max(1, Math.min(Number(startAt || 1), totalSlots));
    const countNum = Math.max(1, Math.min(Number(count || 1), 4000));
    const blanks = Math.max(0, Math.min(startNum - 1, totalSlots));
    const fill = Math.max(0, Math.min(countNum, 4000));
    const arr = [];
    for (let i = 0; i < blanks; i++) arr.push(null);
    for (let i = 0; i < fill; i++) arr.push(selected);
    return arr;
  }, [startAt, count, selected, totalSlots]);

  async function makeBarcodePng(value, pxHeight, barWidth = 2) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      try {
        JsBarcode(canvas, String(value || ''), {
          format: 'CODE128',
          displayValue: false,
          margin: 0,
          width: barWidth,
          height: Math.max(12, pxHeight),
        });
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(null); }
    });
  }

  async function buildPdfUrl() {
    if (!selected) return null;

    const { width: PW, height: PH } = cfg.page;
    const M = cfg.margin;
    const gapX = cfg.gap.x;
    const gapY = cfg.gap.y;

    let cellW, cellH;
    if (cfg.labelSize && cfg.labelSize.width > 0 && cfg.labelSize.height > 0) {
      cellW = cfg.labelSize.width;
      cellH = cfg.labelSize.height;
    } else {
      cellW = (PW - (M.left + M.right) - gapX * (cfg.cols - 1)) / cfg.cols;
      cellH = (PH - (M.top + M.bottom) - gapY * (cfg.rows - 1)) / cfg.rows;
    }

    const pad = mm(1.5);
    const nameSize = cfg.fonts?.storeName || 8;
    const codeSize = cfg.fonts?.productCode || 6;
    const priceSize = cfg.fonts?.price || 10;
    const bcHeight = cfg.fonts?.barcode?.height || 15;
    const bcBarW = 2;

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const codigo = selected?.producto?.codigo || '';
    const precioTxt = money(selected?.precio_compra_final ?? 0);

    const bcDataUrl = await makeBarcodePng(codigo, Math.round(bcHeight), bcBarW);
    const bcImg = bcDataUrl ? await doc.embedPng(bcDataUrl) : null;

    const perPage = cfg.cols * cfg.rows;
    const pagesNeeded = Math.ceil(cells.length / perPage) || 1;
    let idx = 0;

    for (let p = 0; p < pagesNeeded; p++) {
      const page = doc.addPage([PW, PH]);

      for (let r = 0; r < cfg.rows; r++) {
        for (let c = 0; c < cfg.cols; c++) {
          if (idx >= cells.length) break;
          const item = cells[idx++];
          const x = M.left + c * (cellW + gapX);
          const yTop = PH - M.top - r * (cellH + gapY);
          if (!item) continue;

          let cursorY = yTop - pad;
          const maxW = cellW - pad * 2;
          const centerX = x + pad + maxW / 2; // eje horizontal

          // === NOMBRE TIENDA (centrado) ===
          {
            const text = tienda || '';
            const tW = fontBold.widthOfTextAtSize(text, nameSize);
            page.drawText(text, {
              x: centerX - tW / 2,
              y: cursorY - nameSize,
              size: nameSize,
              font: fontBold,
              color: rgb(0, 0, 0),
            });
            cursorY -= (nameSize + mm(0.8));
          }

          // === CÓDIGO DE BARRAS (centrado) ===
          if (bcImg && codigo) {
            const bcW = Math.min(maxW, cellW * 0.8);
            const bcH = bcHeight;
            const bcX = centerX - bcW / 2;
            const bcY = cursorY - bcH;
            page.drawImage(bcImg, { x: bcX, y: bcY, width: bcW, height: bcH });
            cursorY = bcY - mm(0.6);
          }

          // === CÓDIGO (línea propia, centrado) ===
          if (codigo) {
            const tw = font.widthOfTextAtSize(codigo, codeSize);
            const yBase = cursorY - codeSize;
            page.drawText(codigo, {
              x: centerX - tw / 2,
              y: yBase,
              size: codeSize,
              font,
              color: rgb(0,0,0)
            });
            cursorY = yBase - mm(0.6);
          }

          // === PRECIO (línea propia, centrado y en negrita) ===
          {
            const pw = fontBold.widthOfTextAtSize(precioTxt, priceSize);
            const yBase = cursorY - priceSize;
            page.drawText(precioTxt, {
              x: centerX - pw / 2,
              y: yBase,
              size: priceSize,
              font: fontBold,
              color: rgb(0,0,0)
            });
            cursorY = yBase - mm(0.6);
          }

          // Guía tenue (opcional)
          page.drawRectangle({
            x,
            y: yTop - cellH,
            width: cellW,
            height: cellH,
            borderColor: rgb(0.85,0.85,0.85),
            borderWidth: 0.2,
            opacity: 0.18
          });
        }
      }
    }

    const bytes = await doc.save();
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }

  useEffect(() => {
    let revoked = null;
    (async () => {
      if (!open || !selected) { setBlobUrl(null); return; }
      const url = await buildPdfUrl();
      if (url) { setBlobUrl(url); revoked = url; }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected?.id, cfg, startAt, count]);

  function handlePrint() {
    if (!blobUrl || !selected) return;
    const totalSlots = (Number(cfg.cols) || 0) * (Number(cfg.rows) || 0);
    const startNum = Math.max(1, Math.min(Number(startAt || 1), totalSlots));
    if (!Number.isFinite(startNum) || startNum < 1 || startNum > totalSlots) {
      alert(`"Desde etiqueta #" debe estar entre 1 y ${totalSlots}.`);
      return;
    }
    const countNum = Math.max(1, Number(count || 1));

    const sizeInfo = `${cfg.cols} columnas × ${cfg.rows} filas`;
    const ok = confirm(`Imprimir ${countNum} etiqueta(s)\nMalla: ${sizeInfo}\nDesde etiqueta #: ${startNum}\n\n¿Deseas continuar?`);
    if (!ok) return;

    const frame = printFrameRef.current;
    if (!frame) return;
    frame.src = blobUrl;
    frame.onload = () => {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch { window.open(blobUrl, '_blank'); }
    };
  }

  // ======== Guardar preset actual en BD ========
  function savePresetToDB() {
    if (!currentPreset?.id) {
      alert('No existe un preset en BD para esta combinación. Verifica el seeder de LabelPreset.');
      return;
    }

    // Convertir cfg (pt) -> payload BD (mm/pt)
    const payload = {
      id: currentPreset.id,
      nombre: presetNombre || `${labelKind} - ${paper.toUpperCase()}`,
      is_active: presetActivo,

      cols: Number(cfg.cols || 1),
      rows: Number(cfg.rows || 1),

      margin_top_mm: Number(pt2mm(cfg.margin.top).toFixed(2)),
      margin_right_mm: Number(pt2mm(cfg.margin.right).toFixed(2)),
      margin_bottom_mm: Number(pt2mm(cfg.margin.bottom).toFixed(2)),
      margin_left_mm: Number(pt2mm(cfg.margin.left).toFixed(2)),

      gap_x_mm: Number(pt2mm(cfg.gap.x).toFixed(2)),
      gap_y_mm: Number(pt2mm(cfg.gap.y).toFixed(2)),

      // si labelSize es null, mandamos null para que se calcule por grid
      label_w_mm: cfg.labelSize?.width ? Number(pt2mm(cfg.labelSize.width).toFixed(2)) : null,
      label_h_mm: cfg.labelSize?.height ? Number(pt2mm(cfg.labelSize.height).toFixed(2)) : null,

      font_store_name_pt: Number(cfg.fonts?.storeName || 8),
      font_product_code_pt: Number(cfg.fonts?.productCode || 6),
      font_price_pt: Number(cfg.fonts?.price || 10),
      barcode_height_pt: Number(cfg.fonts?.barcode?.height || 15),
    };

    router.put(route('admin.presets.update'), { preset: payload }, {
      preserveScroll: true,
      onSuccess: () => {
        // Opcional: cerrar modal o mostrar toast. Por ahora, mantenemos abierto.
      }
    });
  }

  return (
    <BaseModal open={open} onClose={onClose} title="Imprimir etiquetas" maxWidth="7xl">
      <iframe ref={printFrameRef} style={{ display: 'none' }} title="print-frame" />

      <div className="p-2 sm:p-3 space-y-5 max-h-[80vh] overflow-y-auto">
        {/* Elección: Grandes vs Pequeñas y Papel */}
        <div className="rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <FiSliders/> Tipo & Papel
            </div>
            {canPresets && (
              <div className="flex items-center gap-2">
                <button
                  onClick={savePresetToDB}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-white bg-primary-600 hover:bg-primary-700 text-sm"
                  title="Guardar cambios en BD"
                >
                  <FiSave className="w-4 h-4" /> Guardar cambios
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tipo de etiqueta</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={labelKind === 'grandes'}
                    onChange={() => setLabelKind('grandes')}
                  />
                  Grandes (≈ 50/hoja)
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={labelKind === 'pequenas'}
                    onChange={() => setLabelKind('pequenas')}
                  />
                  Pequeñas (≈ 100/hoja)
                </label>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Papel</label>
              <div className="flex items-center gap-6">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={paper === 'letter'}
                    onChange={() => setPaper('letter')}
                  />
                  Carta
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={paper === 'a4'}
                    onChange={() => setPaper('a4')}
                  />
                  A4
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-600 text-xs">Nombre del preset</span>
                <input
                  type="text"
                  value={presetNombre}
                  onChange={(e)=>setPresetNombre(e.target.value)}
                  className="mt-1 w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 text-xs">Activo</span><br/>
                <input
                  type="checkbox"
                  className="mt-2"
                  checked={presetActivo}
                  onChange={(e)=>setPresetActivo(e.target.checked)}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Controles de configuración (siempre personalizados) */}
        <div className="rounded-xl border p-3">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-4 space-y-4">
              {/* Tamaño de papel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tamaño de papel</label>
                  <select
                    value={cfg.paperSize}
                    onChange={(e) => handleUiChange('paperSize', e.target.value)}
                    className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                  >
                    {Object.entries(PAPER_SIZES).map(([key, data]) => (
                      <option key={key} value={key}>{data.label}</option>
                    ))}
                  </select>
                </div>

                <LabeledNumber
                  label="Ancho página (mm)"
                  value={ui.pageW}
                  onChange={(v)=>handleUiChange('pageW', v)}
                  onBlurNormalize={(v)=>handleUiChange('pageW', v)}
                  step="0.1"
                  min="100"
                />
                <LabeledNumber
                  label="Alto página (mm)"
                  value={ui.pageH}
                  onChange={(v)=>handleUiChange('pageH', v)}
                  onBlurNormalize={(v)=>handleUiChange('pageH', v)}
                  step="0.1"
                  min="100"
                />
              </div>

              {/* Tamaño de etiquetas (editable: si se define, deja de calcular por grid) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <LabeledNumber
                  label="Ancho etiqueta (mm)"
                  value={ui.labelW}
                  onChange={(v)=>handleUiChange('labelW', v)}
                  onBlurNormalize={(v)=>handleUiChange('labelW', v)}
                  step="0.1"
                  min="5"
                />
                <LabeledNumber
                  label="Alto etiqueta (mm)"
                  value={ui.labelH}
                  onChange={(v)=>handleUiChange('labelH', v)}
                  onBlurNormalize={(v)=>handleUiChange('labelH', v)}
                  step="0.1"
                  min="5"
                />
              </div>

              {/* Márgenes y gaps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Márgenes página (mm)</div>
                  <div className="grid grid-cols-4 gap-2">
                    <LabeledNumber label="Sup" value={ui.mTop} onChange={(v)=>handleUiChange('mTop', v)} onBlurNormalize={(v)=>handleUiChange('mTop', v)} step="0.1" min="0" />
                    <LabeledNumber label="Der" value={ui.mRight} onChange={(v)=>handleUiChange('mRight', v)} onBlurNormalize={(v)=>handleUiChange('mRight', v)} step="0.1" min="0" />
                    <LabeledNumber label="Inf" value={ui.mBottom} onChange={(v)=>handleUiChange('mBottom', v)} onBlurNormalize={(v)=>handleUiChange('mBottom', v)} step="0.1" min="0" />
                    <LabeledNumber label="Izq" value={ui.mLeft} onChange={(v)=>handleUiChange('mLeft', v)} onBlurNormalize={(v)=>handleUiChange('mLeft', v)} step="0.1" min="0" />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Espacios entre etiquetas (mm)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledNumber label="Horizontal" value={ui.gX} onChange={(v)=>handleUiChange('gX', v)} onBlurNormalize={(v)=>handleUiChange('gX', v)} step="0.1" min="0" />
                    <LabeledNumber label="Vertical" value={ui.gY} onChange={(v)=>handleUiChange('gY', v)} onBlurNormalize={(v)=>handleUiChange('gY', v)} step="0.1" min="0" />
                  </div>
                </div>
              </div>

              {/* Malla y fuentes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Distribución (filas × columnas)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledNumber label="Columnas" value={ui.cols} onChange={(v)=>handleUiChange('cols', v)} onBlurNormalize={(v)=>handleUiChange('cols', v)} step="1" min="1" />
                    <LabeledNumber label="Filas" value={ui.rows} onChange={(v)=>handleUiChange('rows', v)} onBlurNormalize={(v)=>handleUiChange('rows', v)} step="1" min="1" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Total por hoja: {cfg.cols * cfg.rows} etiquetas
                  </p>
                </div>

                <div>
                  <div className="text-sm font-medium text-slate-700 mb-2">Tamaños de fuente (pt)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <LabeledNumber label="Nombre tienda" value={ui.fontStoreName} onChange={(v)=>handleUiChange('fontStoreName', v)} onBlurNormalize={(v)=>handleUiChange('fontStoreName', v)} step="0.5" min="4" max="20" />
                    <LabeledNumber label="Código producto" value={ui.fontProductCode} onChange={(v)=>handleUiChange('fontProductCode', v)} onBlurNormalize={(v)=>handleUiChange('fontProductCode', v)} step="0.5" min="4" max="16" />
                    <LabeledNumber label="Precio" value={ui.fontPrice} onChange={(v)=>handleUiChange('fontPrice', v)} onBlurNormalize={(v)=>handleUiChange('fontPrice', v)} step="0.5" min="4" max="24" />
                    <LabeledNumber label="Alto código barras" value={ui.fontBarcodeHeight} onChange={(v)=>handleUiChange('fontBarcodeHeight', v)} onBlurNormalize={(v)=>handleUiChange('fontBarcodeHeight', v)} step="1" min="8" max="40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selector de lote y parámetros de impresión */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Lote / Producto</label>
            <select
              className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
              value={loteId}
              onChange={(e) => setLoteId(e.target.value)}
            >
              <option value="">Seleccione un lote</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.producto?.nombre ?? '—'} {l.producto?.codigo ? `— [${l.producto.codigo}]` : ''} · {fmtDate(l.fecha_compra)} · {money(l.precio_compra_final)}
                </option>
              ))}
            </select>
          </div>

          <NumberInput
            label="Desde etiqueta #"
            value={startAt}
            setValue={setStartAt}
            min={1}
            max={totalSlots}
            hint={`La hoja tiene ${totalSlots} posiciones.`}
          />

          <NumberInput
            label="Cantidad de etiquetas"
            value={count}
            setValue={setCount}
            min={1}
          />
        </div>

        {/* Preview PDF */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          {!selected ? (
            <div className="text-slate-500 text-sm">Selecciona un lote para generar la vista previa.</div>
          ) : (
            <div className="h-[50vh]">
              {blobUrl ? (
                <iframe
                  src={blobUrl}
                  title="pdf-preview"
                  className="w-full h-full rounded-md bg-white"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                  Generando vista previa…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info config actual */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm text-blue-800">
            <div className="font-medium mb-2">Configuración actual ({labelKind === 'grandes' ? 'Grandes' : 'Pequeñas'} · {paper.toUpperCase()}):</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div>• Papel: {PAPER_SIZES[ui.paperSize]?.label || 'Personalizado'} ({ui.pageW}×{ui.pageH} mm)</div>
              <div>• Etiquetas: {ui.labelW}×{ui.labelH} mm</div>
              <div>• Distribución: {cfg.cols} columnas × {cfg.rows} filas = {cfg.cols * cfg.rows} etiquetas/hoja</div>
              <div>• Espacios: {ui.gX}mm horizontal, {ui.gY}mm vertical</div>
              <div>• Fuentes: Tienda {ui.fontStoreName}pt, Código {ui.fontProductCode}pt, Precio {ui.fontPrice}pt</div>
              <div>• Código de barras: {ui.fontBarcodeHeight}pt de altura</div>
            </div>
          </div>
        </div>

        {/* Acciones impresión */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            {selected ? (
              <>
                Listo para imprimir: <b>{Number(count || 1)}</b> etiqueta(s), desde posición <b>#{Math.max(1, Math.min(Number(startAt || 1), totalSlots))}</b>
                {Number(count || 1) > totalSlots - Math.max(1, Math.min(Number(startAt || 1), totalSlots)) + 1 && (
                  <span className="text-amber-600 font-medium">
                    {' '}(se necesitarán {Math.ceil(((Math.max(1, Math.min(Number(startAt || 1), totalSlots))) - 1 + Number(count || 1)) / totalSlots)} hojas)
                  </span>
                )}
              </>
            ) : (
              'Selecciona lote y parámetros.'
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <a
              href={blobUrl || '#'}
              download={selected ? `etiquetas_${selected?.producto?.codigo || 'producto'}.pdf` : undefined}
              className={[
                'px-3 py-2 rounded-md border text-sm',
                blobUrl
                  ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  : 'pointer-events-none opacity-50 border-slate-100 bg-white text-slate-400'
              ].join(' ')}
            >
              Descargar PDF
            </a>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!blobUrl}
              className={[
                'inline-flex items-center gap-2 px-3 py-2 rounded-md text-white text-sm',
                blobUrl
                  ? 'bg-primary-600 hover:bg-primary-700'
                  : 'bg-primary-300 cursor-not-allowed'
              ].join(' ')}
            >
              <FiPrinter className="w-4 h-4" /> Imprimir
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

/* =========================================
 * Componentes de entrada con UX mejorada
 * ========================================= */
function LabeledNumber({ label, value, onChange, onBlurNormalize, step='1', min, max }) {
  const [draft, setDraft] = useDraftNumber(value);

  function handleChange(e) {
    const v = e.target.value;
    setDraft(v);
    if (v !== '') onChange?.(v);
  }

  function handleBlur() {
    const normalized = normalizeNumber(draft, { min: min !== undefined ? Number(min) : undefined, max: max !== undefined ? Number(max) : undefined, fallback: '0' });
    setDraft(normalized);
    onChange?.(normalized);
    onBlurNormalize?.(normalized);
  }

  function handleKeyDown(e) {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      focusByArrow(e);
      return;
    }
    if (e.key === 'Enter') e.currentTarget.blur();
  }

  return (
    <label className="block text-sm">
      <span className="text-slate-600 text-xs">{label}</span>
      <input
        type="number"
        data-nav="labels"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="mt-1 w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500 text-sm"
      />
    </label>
  );
}

function NumberInput({ label, value, setValue, min, max, hint }) {
  const [draft, setDraft] = useDraftNumber(value);

  function handleChange(e) {
    const v = e.target.value;
    setDraft(v);
    if (v !== '') setValue(v);
  }
  function handleBlur() {
    const normalized = normalizeNumber(draft, { min: min !== undefined ? Number(min) : undefined, max: max !== undefined ? Number(max) : undefined, fallback: String(min ?? 0) });
    setDraft(normalized);
    setValue(normalized);
  }
  function handleKeyDown(e) {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      focusByArrow(e);
      return;
    }
    if (e.key === 'Enter') e.currentTarget.blur();
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input
        type="number"
        data-nav="labels"
        min={min}
        max={max}
        value={draft}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/* ===================================
 * Página principal: listado + modal
 * =================================== */
export default function Index({ lotes, filtros, presetsTable }) {
  const [q, setQ] = useState({
    q: filtros?.q ?? '',
    codigo: filtros?.codigo ?? '',
    proveedor: filtros?.proveedor ?? '',
  });

  useEffect(() => {
    const id = setTimeout(() => {
      router.get(route('admin.etiquetas.index'), q, {
        preserveState: true,
        replace: true,
        preserveScroll: true,
      });
    }, 400);
    return () => clearTimeout(id);
  }, [q.q, q.codigo, q.proveedor]);

  function clearFilters() {
    setQ({ q: '', codigo: '', proveedor: '' });
    router.get(route('admin.etiquetas.index'), {}, {
      preserveState: true,
      replace: true,
      preserveScroll: true
    });
  }

  const [openModal, setOpenModal] = useState(false);
  const [selectedLote, setSelectedLote] = useState(null);

  function openPrintFor(row = null) {
    setSelectedLote(row);
    setOpenModal(true);
  }

  return (
    <AdminLayout title="Etiquetas">
      <Head title="Etiquetas" />

      <div className="mb-3 flex items-center justify-end">
        <button
          onClick={() => openPrintFor(null)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          <FiPrinter className="w-4 h-4" /> Imprimir / Configurar etiquetas
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white">
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Producto (nombre)</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.q}
                  onChange={(e) => setQ((s) => ({ ...s, q: e.target.value }))}
                  placeholder="Ej. Tornillo, Avena, etc."
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código de producto</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.codigo}
                  onChange={(e) => setQ((s) => ({ ...s, codigo: e.target.value }))}
                  placeholder="Ej. 25-4-8-3-45"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={q.proveedor}
                  onChange={(e) => setQ((s) => ({ ...s, proveedor: e.target.value }))}
                  placeholder="Nombre o CI/RUC"
                  className="w-full pl-9 rounded-md border-slate-300 focus:border-primary-500 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            >
              <FiRefreshCw className="w-4 h-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de compras/lotes */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr className="[&>th]:px-4 [&>th]:py-3 [&>th]:text-left">
                <th>Producto</th>
                <th>Código</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th>Cantidad</th>
                <th>Precio unit. final</th>
                <th>Precio total</th>
                <th className="w-1">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {getData(lotes).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    No hay compras que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {getData(lotes).map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.producto?.nombre}</div>
                  </td>
                  <td className="px-4 py-3">{row.producto?.codigo || '—'}</td>
                  <td className="px-4 py-3">
                    {row.proveedor?.nombre} {row.proveedor?.ci_o_ruc ? `— [${row.proveedor.ci_o_ruc}]` : ''}
                  </td>
                  <td className="px-4 py-3">{fmtDate(row.fecha_compra)}</td>
                  <td className="px-4 py-3">{row.cantidad_compra}</td>
                  <td className="px-4 py-3">{money(row.precio_compra_final)}</td>
                  <td className="px-4 py-3">{money(row.precio_total)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openPrintFor(row)}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700"
                      title="Imprimir etiquetas"
                    >
                      <FiPrinter className="w-4 h-4" /> Imprimir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-4">
          <Pagination page={lotes} />
        </div>
      </div>

      <ModalImpresion
        open={openModal}
        onClose={() => setOpenModal(false)}
        lotes={getData(lotes)}
        preselect={selectedLote}
        tienda="Mundo navideño 365"
        presetsTable={presetsTable}
      />
    </AdminLayout>
  );
}
